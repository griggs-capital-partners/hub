import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { getOrgRepos } from "@/lib/github";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const existingRepos = await prisma.repo.findMany({
    orderBy: [
      { connected: "desc" },
      { pushedAt: "desc" },
      { name: "asc" }
    ],
  });

  if (!process.env.GITHUB_TOKEN?.trim()) {
    return NextResponse.json({
      repos: existingRepos,
      synced: 0,
      disabled: true,
      reason: "GitHub sync is not configured for this workspace.",
    });
  }

  let repos;
  try {
    repos = await getOrgRepos();
  } catch (err) {
    const message = err instanceof Error ? err.message : "GitHub API error";
    return NextResponse.json({ error: message }, { status: 500 });
  }

  const existingIds = new Set(existingRepos.map((repo) => repo.githubId));

  // Refresh metadata only for repos that already exist in the workspace DB.
  // Discovery/addition happens through the integrations flow, not this sync.
  let synced = 0;
  for (const repo of repos) {
    if (!existingIds.has(repo.id)) continue;

    await prisma.repo.update({
      where: { githubId: repo.id },
      data: {
        name: repo.name,
        fullName: repo.full_name,
        description: repo.description ?? null,
        url: repo.html_url,
        language: repo.language ?? null,
        isPrivate: repo.private,
        starCount: repo.stargazers_count ?? 0,
        openIssues: repo.open_issues_count ?? 0,
        pushedAt: repo.pushed_at ? new Date(repo.pushed_at) : null,
        lastSyncedAt: new Date(),
        // NOTE: connected is intentionally NOT updated — preserve user's toggle choice
      },
    });
    synced++;
  }

  // Return all repos (including ones toggled off) for the integrations page
  const allRepos = await prisma.repo.findMany({
    orderBy: [
      { connected: "desc" },
      { pushedAt: "desc" },
      { name: "asc" }
    ],
  });

  return NextResponse.json({ repos: allRepos, synced });
}
