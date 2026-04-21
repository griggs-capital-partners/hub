import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id: wellId } = await params;
  const body = await req.json();
  const { type, body: noteBody } = body;

  if (!noteBody?.trim()) return NextResponse.json({ error: "body required" }, { status: 400 });

  const note = await prisma.wellNote.create({
    data: {
      wellId,
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

  const { id: wellId } = await params;
  const { noteId } = await req.json();

  const note = await prisma.wellNote.findFirst({ where: { id: noteId, wellId } });
  if (!note) return NextResponse.json({ error: "Not found" }, { status: 404 });

  await prisma.wellNote.delete({ where: { id: noteId } });
  return NextResponse.json({ ok: true });
}
