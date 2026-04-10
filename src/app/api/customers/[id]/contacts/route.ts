import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id: customerId } = await params;
  const body = await req.json();
  const { name, email, phone, title, isPrimary, notes } = body;

  if (!name) return NextResponse.json({ error: "name required" }, { status: 400 });

  // If isPrimary, clear existing primary
  if (isPrimary) {
    await prisma.customerContact.updateMany({
      where: { customerId, isPrimary: true },
      data: { isPrimary: false },
    });
  }

  const contact = await prisma.customerContact.create({
    data: { customerId, name, email: email || null, phone: phone || null, title: title || null, isPrimary: isPrimary ?? false, notes: notes || null },
  });

  return NextResponse.json({ contact });
}
