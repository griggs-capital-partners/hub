import { auth } from "@/lib/auth";
import { getRepoTree } from "@/lib/github";
import { NextResponse } from "next/server";

// GET: /api/knowledge/tree?owner=&repo=&branch=
export async function GET(request: Request) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const owner = searchParams.get("owner");
  const repo = searchParams.get("repo");
  const branch = searchParams.get("branch") ?? "main";

  if (!owner || !repo) {
    return NextResponse.json({ error: "owner and repo are required" }, { status: 400 });
  }

  try {
    const tree = await getRepoTree(owner, repo, branch);
    return NextResponse.json({ tree });
  } catch (error) {
    console.error("Failed to fetch repo tree:", error);
    return NextResponse.json({ error: "Failed to fetch repo tree" }, { status: 500 });
  }
}
