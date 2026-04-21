import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id: wellId } = await params;
  const body = await req.json();
  const { name, email, phone, title, isPrimary, notes } = body;

  if (!name) return NextResponse.json({ error: "name required" }, { status: 400 });

  if (isPrimary) {
    await prisma.wellContact.updateMany({
      where: { wellId, isPrimary: true },
      data: { isPrimary: false },
    });
  }

  const contact = await prisma.wellContact.create({
    data: { wellId, name, email: email || null, phone: phone || null, title: title || null, isPrimary: isPrimary ?? false, notes: notes || null },
  });

  return NextResponse.json({ contact });
}
