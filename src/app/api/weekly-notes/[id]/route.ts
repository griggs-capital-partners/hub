import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  await auth();
  const { id } = await params;

  const note = await prisma.weeklyNote.findUnique({
    where: { id },
    include: {
      entries: {
        orderBy: { order: "asc" },
        include: {
          customer: {
            select: { id: true, name: true, logoUrl: true, healthScore: true, tier: true, status: true },
          },
        },
      },
    },
  });

  if (!note) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json(note);
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  await auth();
  const { id } = await params;

  await prisma.weeklyNote.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
