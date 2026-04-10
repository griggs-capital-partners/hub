import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

// PUT /api/roadmap/repos — update roadmapOrder for all repos
// Body: { order: [{ id, roadmapOrder }] }
export async function PUT(req: Request) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { order } = await req.json() as { order: { id: string; roadmapOrder: number }[] };

  if (!Array.isArray(order)) {
    return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
  }

  await prisma.$transaction(
    order.map(({ id, roadmapOrder }) =>
      prisma.repo.update({ where: { id }, data: { roadmapOrder } })
    )
  );

  return NextResponse.json({ success: true });
}

// PATCH /api/roadmap/repos — toggle showInRoadmap for a single repo
// Body: { id, showInRoadmap }
export async function PATCH(req: Request) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id, showInRoadmap } = await req.json() as { id: string; showInRoadmap: boolean };

  const repo = await prisma.repo.update({
    where: { id },
    data: { showInRoadmap },
    select: { id: true, name: true, fullName: true, description: true, roadmapOrder: true, showInRoadmap: true },
  });

  return NextResponse.json(repo);
}
