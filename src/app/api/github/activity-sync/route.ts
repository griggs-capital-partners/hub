import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { getRepoCommits, getRepoPullRequests } from "@/lib/github";
import { prisma } from "@/lib/prisma";

/**
 * Syncs recent GitHub activity (commits + PRs) for connected repos into the
 * ActivityEvent table. Resolves GitHub logins to team users so the actor
 * name/avatar is always our hub identity, not the raw GitHub identity.
 *
 * Deduplication: before inserting we check for an existing event whose payload
 * contains the commit SHA or PR node ID — cheap string search that works for
 * our dataset sizes.
 */
export async function POST() {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  // Build GitHub login → team user map
  const linkedAccounts = await prisma.connectedAccount.findMany({
    where: { provider: "github" },
    include: { user: true },
  });

  const loginToUser = new Map<string, { name: string | null; displayName: string | null; image: string | null }>();
  for (const acct of linkedAccounts) {
    loginToUser.set(acct.providerAccountId.toLowerCase(), {
      name: acct.user.name,
      displayName: acct.user.displayName,
      image: acct.user.image,
    });
  }

  // Get connected repos
  const connectedRepos = await prisma.repo.findMany({
    where: { connected: true },
    select: { fullName: true, name: true },
  });

  let commitsSynced = 0;
  let prsSynced = 0;

  for (const repo of connectedRepos) {
    const [owner, repoName] = repo.fullName.split("/");
    if (!owner || !repoName) continue;

    // ── Commits ────────────────────────────────────────────────────────────
    const commits = await getRepoCommits(owner, repoName, undefined, 15);

    for (const commit of commits) {
      const sha = commit.sha;

      // Dedup: skip if we already stored this commit
      const existing = await prisma.activityEvent.findFirst({
        where: { type: "github.commit", payload: { contains: sha } },
        select: { id: true },
      });
      if (existing) continue;

      // Resolve actor — prefer team user identity
      const ghLogin = commit.author?.login?.toLowerCase() ?? "";
      const teamUser = ghLogin ? loginToUser.get(ghLogin) : undefined;
      const actorName =
        teamUser?.displayName ?? teamUser?.name ?? commit.commit.author?.name ?? null;
      // If a hub user is linked, only use their hub image (never the GitHub avatar).
      // A null hub image will render as initials in the UI, which is correct.
      const actorImage = teamUser ? teamUser.image : (commit.author?.avatar_url ?? null);

      const message = commit.commit.message.split("\n")[0]; // first line only
      const payload = JSON.stringify({
        message: `${actorName ?? "Someone"} pushed to ${repo.name}: ${message}`,
        sha,
        repo: repo.fullName,
        url: commit.html_url,
        ghLogin: commit.author?.login ?? null,
      });

      await prisma.activityEvent.create({
        data: {
          type: "github.commit",
          payload,
          actorName,
          actorImage,
          createdAt: commit.commit.author?.date
            ? new Date(commit.commit.author.date)
            : new Date(),
        },
      });
      commitsSynced++;
    }

    // ── Pull Requests ───────────────────────────────────────────────────────
    const prs = await getRepoPullRequests(owner, repoName, "all");
    // Only look at the 10 most recently updated
    const recentPRs = prs.slice(0, 10);

    for (const pr of recentPRs) {
      const nodeId = pr.node_id;

      // Dedup: one event per PR node ID regardless of current state
      const existing = await prisma.activityEvent.findFirst({
        where: { payload: { contains: nodeId } },
        select: { id: true },
      });
      if (existing) continue;

      const ghLogin = pr.user?.login?.toLowerCase() ?? "";
      const teamUser = ghLogin ? loginToUser.get(ghLogin) : undefined;
      const actorName =
        teamUser?.displayName ?? teamUser?.name ?? pr.user?.login ?? null;
      // Same policy as commits: linked hub users always show their hub image.
      const actorImage = teamUser ? teamUser.image : (pr.user?.avatar_url ?? null);

      const isMerged = pr.merged_at != null;
      const type = isMerged ? "github.pr_merged" : pr.state === "closed" ? "github.pr_closed" : "github.pr_opened";

      const verb = isMerged ? "merged" : pr.state === "closed" ? "closed" : "opened";
      const payload = JSON.stringify({
        message: `${actorName ?? "Someone"} ${verb} PR #${pr.number} in ${repo.name}: ${pr.title}`,
        prNumber: pr.number,
        nodeId,
        repo: repo.fullName,
        url: pr.html_url,
        ghLogin: pr.user?.login ?? null,
      });

      await prisma.activityEvent.create({
        data: {
          type,
          payload,
          actorName,
          actorImage,
          createdAt: new Date(pr.updated_at),
        },
      });
      prsSynced++;
    }
  }

  return NextResponse.json({ ok: true, commitsSynced, prsSynced });
}
