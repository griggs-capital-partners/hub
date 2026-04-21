import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { getRepoIssues, createGithubIssue } from "@/lib/github";

export async function GET(request: Request) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const owner = searchParams.get("owner") ?? "griggs-capital-partners";
  const repo = searchParams.get("repo");
  const state = (searchParams.get("state") ?? "open") as "open" | "closed" | "all";

  if (!repo) return NextResponse.json({ error: "repo required" }, { status: 400 });

  const issues = await getRepoIssues(owner, repo, state);
  return NextResponse.json({ issues });
}

export async function POST(request: Request) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await request.json();
  const { owner = "griggs-capital-partners", repo, title, body: issueBody, labels } = body;

  if (!repo || !title) {
    return NextResponse.json({ error: "repo and title required" }, { status: 400 });
  }

  const issue = await createGithubIssue(owner, repo, title, issueBody ?? "", labels);
  return NextResponse.json({ issue });
}
