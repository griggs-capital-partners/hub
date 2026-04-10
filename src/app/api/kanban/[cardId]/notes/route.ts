import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ cardId: string }> }
) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { cardId } = await params;
  const body = await request.json();
  const noteBody = typeof body.body === "string" ? body.body.trim() : "";
  const noteImage = typeof body.image === "string" ? body.image.trim() : "";

  if (!noteBody && !noteImage) {
    return NextResponse.json({ error: "body or image required" }, { status: 400 });
  }

  if (noteImage) {
    const isDataUrl = noteImage.startsWith("data:image/");
    const isHttps = noteImage.startsWith("https://");
    if (!isDataUrl && !isHttps) {
      return NextResponse.json({ error: "Image must be a data URL or HTTPS URL" }, { status: 400 });
    }
    if (isDataUrl && noteImage.length > 1_500_000) {
      return NextResponse.json({ error: "Image too large. Max about 1 MB." }, { status: 400 });
    }
  }

  const note = await prisma.issueNote.create({
    data: {
      cardId,
      authorId: session.user.id,
      body: noteBody,
      image: noteImage || null,
    },
    select: {
      id: true,
      body: true,
      image: true,
      createdAt: true,
      author: {
        select: {
          id: true,
          name: true,
          displayName: true,
          image: true,
          email: true,
        },
      },
    },
  });

  return NextResponse.json({
    note: {
      ...note,
      createdAt: note.createdAt.toISOString(),
    },
  });
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ cardId: string }> }
) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { cardId } = await params;
  const { searchParams } = new URL(request.url);
  const noteId = searchParams.get("noteId");

  if (!noteId) {
    return NextResponse.json({ error: "noteId required" }, { status: 400 });
  }

  const note = await prisma.issueNote.findFirst({
    where: { id: noteId, cardId },
    select: { id: true, authorId: true },
  });

  if (!note) {
    return NextResponse.json({ error: "Note not found" }, { status: 404 });
  }

  if (note.authorId !== session.user.id) {
    return NextResponse.json({ error: "You can only delete your own notes" }, { status: 403 });
  }

  await prisma.issueNote.delete({ where: { id: noteId } });

  return NextResponse.json({ success: true });
}
