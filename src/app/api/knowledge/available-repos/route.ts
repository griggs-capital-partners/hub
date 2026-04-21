import { auth } from "@/lib/auth";
import { discoverRepos } from "@/lib/github";
import { NextResponse } from "next/server";

// GET: list all GitHub repos available for connecting as a knowledge base
export async function GET() {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const repos = await discoverRepos();
    const simplified = repos.map((r) => ({
      id: r.id,
      owner: r.owner?.login ?? "",
      name: r.name,
      fullName: r.full_name,
      description: r.description,
      isPrivate: r.private,
      defaultBranch: r.default_branch ?? "main",
    }));
    return NextResponse.json({ repos: simplified });
  } catch (error) {
    console.error("Failed to list repos:", error);
    return NextResponse.json({ error: "Failed to list repos" }, { status: 500 });
  }
}
