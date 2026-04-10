import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string; contactId: string }> }) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id: wellId, contactId } = await params;
  const body = await req.json();

  if (body.isPrimary) {
    await prisma.wellContact.updateMany({
      where: { wellId, isPrimary: true },
      data: { isPrimary: false },
    });
  }

  const contact = await prisma.wellContact.update({
    where: { id: contactId },
    data: {
      ...(body.name !== undefined && { name: body.name }),
      ...(body.email !== undefined && { email: body.email || null }),
      ...(body.phone !== undefined && { phone: body.phone || null }),
      ...(body.title !== undefined && { title: body.title || null }),
      ...(body.notes !== undefined && { notes: body.notes || null }),
      ...(body.isPrimary !== undefined && { isPrimary: body.isPrimary }),
    },
  });

  return NextResponse.json({ contact });
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string; contactId: string }> }) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { contactId } = await params;
  await prisma.wellContact.delete({ where: { id: contactId } });

  return NextResponse.json({ ok: true });
}
