import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  await auth();
  const { id: wellId } = await params;

  const entries = await prisma.weeklyNoteEntry.findMany({
    where: { customerId: wellId },
    orderBy: { weeklyNote: { weekStart: "desc" } },
    include: {
      weeklyNote: {
        select: { id: true, weekStart: true },
      },
    },
  });

  return NextResponse.json(entries);
}
