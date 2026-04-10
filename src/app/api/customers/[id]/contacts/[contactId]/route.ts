import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string; contactId: string }> }) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id: customerId, contactId } = await params;
  const body = await req.json();
  const { name, email, phone, title, isPrimary, notes } = body;

  if (isPrimary) {
    await prisma.customerContact.updateMany({
      where: { customerId, isPrimary: true },
      data: { isPrimary: false },
    });
  }

  const contact = await prisma.customerContact.update({
    where: { id: contactId },
    data: {
      ...(name !== undefined && { name }),
      ...(email !== undefined && { email: email || null }),
      ...(phone !== undefined && { phone: phone || null }),
      ...(title !== undefined && { title: title || null }),
      ...(isPrimary !== undefined && { isPrimary }),
      ...(notes !== undefined && { notes: notes || null }),
    },
  });

  return NextResponse.json({ contact });
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ contactId: string }> }) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { contactId } = await params;
  await prisma.customerContact.delete({ where: { id: contactId } });

  return NextResponse.json({ ok: true });
}
