import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

// GET /api/roadmap — fetch all repos (with roadmapOrder) and all roadmap cards
export async function GET() {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const [repos, cards] = await Promise.all([
    prisma.repo.findMany({
      where: { connected: true },
      select: { id: true, name: true, fullName: true, description: true, roadmapOrder: true },
      orderBy: { roadmapOrder: "asc" },
    }),
    prisma.roadmapCard.findMany({
      orderBy: [{ year: "asc" }, { quarter: "asc" }],
    }),
  ]);

  return NextResponse.json({ repos, cards });
}

// POST /api/roadmap — create or upsert a roadmap card
export async function POST(req: Request) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { repoId, quarter, year, title, description, status, uid } = await req.json();

  if (!repoId || !quarter || !year || !title) {
    return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
  }

  const card = await prisma.roadmapCard.upsert({
    where: { repoId_quarter_year: { repoId, quarter, year } },
    update: { title, description, status, uid },
    create: { repoId, quarter, year, title, description, status: status ?? "planning", uid },
  });

  return NextResponse.json(card);
}
