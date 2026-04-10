import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { mapWellToWeeklyCustomerSnap } from "@/lib/well-compat";

function serializeNote<T extends { entries: Array<{ customer: { id: string; name: string; status: string; priority: string | null } | null }> }>(note: T) {
  return {
    ...note,
    entries: note.entries.map((entry) => ({
      ...entry,
      customer: mapWellToWeeklyCustomerSnap(entry.customer),
    })),
  };
}

export async function GET() {
  await auth();

  const notes = await prisma.weeklyNote.findMany({
    orderBy: { weekStart: "desc" },
    include: {
      entries: {
        orderBy: { order: "asc" },
        include: {
          customer: {
            select: { id: true, name: true, status: true, priority: true },
          },
        },
      },
    },
  });

  return NextResponse.json(notes.map(serializeNote));
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
            select: { id: true, name: true, status: true, priority: true },
          },
        },
      },
    },
  });

  return NextResponse.json(serializeNote(note), { status: 201 });
}
