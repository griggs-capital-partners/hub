import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { mapWellToWeeklyCustomerSnap } from "@/lib/well-compat";

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  await auth();
  const { id: weeklyNoteId } = await params;
  const { customerId, customerName, order } = await req.json();

  if (!customerName) return NextResponse.json({ error: "customerName required" }, { status: 400 });

  const entry = await prisma.weeklyNoteEntry.create({
    data: {
      weeklyNoteId,
      customerId: customerId ?? null,
      customerName,
      order: order ?? 0,
      items: "[]",
    },
    include: {
      customer: {
        select: { id: true, name: true, status: true, priority: true },
      },
    },
  });

  return NextResponse.json({
    ...entry,
    customer: mapWellToWeeklyCustomerSnap(entry.customer),
  }, { status: 201 });
}
