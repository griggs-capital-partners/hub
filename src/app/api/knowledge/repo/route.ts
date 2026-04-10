import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";

// GET: return the connected knowledge repo (or null)
export async function GET() {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const repo = await prisma.knowledgeRepo.findFirst();
  return NextResponse.json({ repo });
}

// POST: connect a repo
export async function POST(request: Request) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { repoOwner, repoName, branch = "main", description } = await request.json();
  if (!repoOwner || !repoName) {
    return NextResponse.json({ error: "repoOwner and repoName are required" }, { status: 400 });
  }

  // Only one knowledge repo at a time — upsert by owner+name
  const existing = await prisma.knowledgeRepo.findFirst();
  let repo;
  if (existing) {
    repo = await prisma.knowledgeRepo.update({
      where: { id: existing.id },
      data: { repoOwner, repoName, branch, description },
    });
  } else {
    repo = await prisma.knowledgeRepo.create({
      data: { repoOwner, repoName, branch, description },
    });
  }

  return NextResponse.json({ repo });
}

// DELETE: disconnect the knowledge repo
export async function DELETE() {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const existing = await prisma.knowledgeRepo.findFirst();
  if (existing) {
    await prisma.knowledgeRepo.delete({ where: { id: existing.id } });
  }
  return NextResponse.json({ ok: true });
}
