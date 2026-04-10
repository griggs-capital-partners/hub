import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { discoverRepos } from "@/lib/github";
import { prisma } from "@/lib/prisma";

// POST /api/github/repos/add
// Body: { githubIds: number[] }
// Saves the selected repos to the projects table with connected: true.
export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const githubIds: number[] = body.githubIds;

  if (!Array.isArray(githubIds) || githubIds.length === 0) {
    return NextResponse.json({ error: "githubIds must be a non-empty array" }, { status: 400 });
  }

  // Fetch current GitHub data to get accurate metadata
  let allRepos;
  try {
    allRepos = await discoverRepos();
  } catch (err) {
    const message = err instanceof Error ? err.message : "GitHub API error";
    return NextResponse.json({ error: message }, { status: 500 });
  }

  const selectedRepos = allRepos.filter((r) => githubIds.includes(r.id));

  for (const repo of selectedRepos) {
    await prisma.repo.upsert({
      where: { githubId: repo.id },
      create: {
        githubId: repo.id,
        name: repo.name,
        fullName: repo.full_name,
        description: repo.description ?? null,
        url: repo.html_url,
        language: repo.language ?? null,
        isPrivate: repo.private,
        starCount: repo.stargazers_count ?? 0,
        openIssues: repo.open_issues_count ?? 0,
        connected: true,
        lastSyncedAt: new Date(),
      },
      update: {
        name: repo.name,
        fullName: repo.full_name,
        description: repo.description ?? null,
        language: repo.language ?? null,
        isPrivate: repo.private,
        starCount: repo.stargazers_count ?? 0,
        openIssues: repo.open_issues_count ?? 0,
        connected: true,
        lastSyncedAt: new Date(),
      },
    });
  }

  const updatedRepos = await prisma.repo.findMany({
    orderBy: [{ connected: "desc" }, { name: "asc" }],
  });

  return NextResponse.json({ added: selectedRepos.length, repos: updatedRepos });
}
