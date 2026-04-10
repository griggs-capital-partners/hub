import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET() {
  await auth();

  const notes = await prisma.weeklyNote.findMany({
    orderBy: { weekStart: "desc" },
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

  return NextResponse.json(notes);
}

export async function POST(req: NextRequest) {
  await auth();

  const { weekStart } = await req.json();
  if (!weekStart) return NextResponse.json({ error: "weekStart required" }, { status: 400 });

  // Normalize to midnight UTC on Monday
  const date = new Date(weekStart);
  date.setUTCHours(0, 0, 0, 0);

  const note = await prisma.weeklyNote.create({
    data: { weekStart: date },
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

  return NextResponse.json(note, { status: 201 });
}
