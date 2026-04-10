import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id: customerId } = await params;
  const body = await req.json();
  const { type, body: noteBody } = body;

  if (!noteBody?.trim()) return NextResponse.json({ error: "body required" }, { status: 400 });

  const note = await prisma.customerNote.create({
    data: {
      customerId,
      authorId: session.user.id,
      type: type || "general",
      body: noteBody.trim(),
    },
    include: {
      author: { select: { id: true, name: true, displayName: true, image: true } },
    },
  });

  return NextResponse.json({ note });
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id: customerId } = await params;
  const { noteId } = await req.json();

  // Only allow deletion of own notes (or admin can delete any)
  const note = await prisma.customerNote.findFirst({ where: { id: noteId, customerId } });
  if (!note) return NextResponse.json({ error: "Not found" }, { status: 404 });

  await prisma.customerNote.delete({ where: { id: noteId } });
  return NextResponse.json({ ok: true });
}
