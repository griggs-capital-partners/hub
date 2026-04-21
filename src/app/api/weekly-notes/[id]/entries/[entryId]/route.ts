import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { mapWellToWeeklyCustomerSnap } from "@/lib/well-compat";

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; entryId: string }> }
) {
  await auth();
  const { entryId } = await params;
  const body = await req.json();

  const entry = await prisma.weeklyNoteEntry.update({
    where: { id: entryId },
    data: {
      ...(body.items !== undefined && { items: JSON.stringify(body.items) }),
      ...(body.customerName !== undefined && { customerName: body.customerName }),
      ...(body.order !== undefined && { order: body.order }),
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
  });
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string; entryId: string }> }
) {
  await auth();
  const { entryId } = await params;

  await prisma.weeklyNoteEntry.delete({ where: { id: entryId } });
  return NextResponse.json({ ok: true });
}
