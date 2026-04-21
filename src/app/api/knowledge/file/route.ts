import { auth } from "@/lib/auth";
import { getFileContent, upsertFile, deleteRepoFile } from "@/lib/github";
import { NextResponse } from "next/server";

// GET: /api/knowledge/file?owner=&repo=&path=&branch=
export async function GET(request: Request) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const owner = searchParams.get("owner");
  const repo = searchParams.get("repo");
  const path = searchParams.get("path");
  const branch = searchParams.get("branch") ?? "main";

  if (!owner || !repo || !path) {
    return NextResponse.json({ error: "owner, repo, and path are required" }, { status: 400 });
  }

  const result = await getFileContent(owner, repo, path, branch);
  if (!result) {
    return NextResponse.json({ error: "File not found" }, { status: 404 });
  }
  return NextResponse.json(result);
}

// POST: create or update a file
export async function POST(request: Request) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { owner, repo, path, content, message, branch = "main", sha } = await request.json();
  if (!owner || !repo || !path || content === undefined || !message) {
    return NextResponse.json({ error: "owner, repo, path, content, and message are required" }, { status: 400 });
  }

  try {
    const result = await upsertFile(owner, repo, path, content, message, branch, sha);
    return NextResponse.json({ ok: true, commit: result.commit?.sha });
  } catch (error) {
    console.error("Failed to save file:", error);
    return NextResponse.json({ error: "Failed to save file" }, { status: 500 });
  }
}

// DELETE: delete a file
export async function DELETE(request: Request) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { owner, repo, path, message, sha, branch = "main" } = await request.json();
  if (!owner || !repo || !path || !message || !sha) {
    return NextResponse.json({ error: "owner, repo, path, message, and sha are required" }, { status: 400 });
  }

  try {
    await deleteRepoFile(owner, repo, path, message, sha, branch);
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("Failed to delete file:", error);
    return NextResponse.json({ error: "Failed to delete file" }, { status: 500 });
  }
}
