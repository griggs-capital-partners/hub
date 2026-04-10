import { auth } from "@/lib/auth";
import { commitKnowledgeFilesViaContents } from "@/lib/github";
import { NextResponse } from "next/server";

export async function POST(request: Request) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { owner, repo, branch = "main", message, files } = await request.json();

  if (!owner || !repo || !message || !Array.isArray(files) || files.length === 0) {
    return NextResponse.json(
      { error: "owner, repo, message, and at least one file are required" },
      { status: 400 }
    );
  }

  try {
    const result = await commitKnowledgeFilesViaContents(owner, repo, branch, message, files);
    return NextResponse.json({ ok: true, mode: result.mode, commits: result.commits });
  } catch (error) {
    console.error("Failed to commit knowledge files:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to commit knowledge files" },
      { status: 500 }
    );
  }
}
