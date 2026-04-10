import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

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
        select: { id: true, name: true, logoUrl: true, healthScore: true, tier: true, status: true },
      },
    },
  });

  return NextResponse.json(entry);
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
