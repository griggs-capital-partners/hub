import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { discoverRepos } from "@/lib/github";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  let githubRepos;
  try {
    githubRepos = await discoverRepos();
  } catch (err) {
    const message = err instanceof Error ? err.message : "GitHub API error";
    return NextResponse.json({ error: message }, { status: 500 });
  }

  // Find which repos are already in the workspace DB
  const existingRepos = await prisma.repo.findMany({
    select: { githubId: true, connected: true },
  });
  const existingRepoState = new Map(existingRepos.map((r) => [r.githubId, r.connected]));

  const repos = githubRepos.map((r) => {
    const connected = existingRepoState.get(r.id) ?? null;
    return {
      id: r.id,
      name: r.name,
      fullName: r.full_name,
      description: r.description ?? null,
      url: r.html_url,
      language: r.language ?? null,
      isPrivate: r.private,
      starCount: r.stargazers_count ?? 0,
      openIssues: r.open_issues_count ?? 0,
      owner: r.owner?.login ?? null,
      alreadyAdded: connected === true,
      wasAddedBefore: connected === false,
    };
  });

  return NextResponse.json({ repos });
}
