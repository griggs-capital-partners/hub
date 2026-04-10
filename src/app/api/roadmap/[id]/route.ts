import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

// PUT /api/roadmap/[id] — update a roadmap card
export async function PUT(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const { title, description, status, uid } = await req.json();

  const card = await prisma.roadmapCard.update({
    where: { id },
    data: { title, description, status, uid },
  });

  return NextResponse.json(card);
}

// DELETE /api/roadmap/[id] — delete a roadmap card
export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;

  await prisma.roadmapCard.delete({ where: { id } });

  return NextResponse.json({ success: true });
}
