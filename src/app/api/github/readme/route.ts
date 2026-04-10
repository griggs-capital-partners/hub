import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { getRepoReadme } from "@/lib/github";

export async function GET(request: Request) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const owner = searchParams.get("owner");
  const repo = searchParams.get("repo");

  if (!owner || !repo) {
    return NextResponse.json({ error: "owner and repo required" }, { status: 400 });
  }

  const html = await getRepoReadme(owner, repo);
  return NextResponse.json({ html });
}
