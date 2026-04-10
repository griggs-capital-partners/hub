import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id: sprintId } = await params;
  const body = await req.json();

  const { body: commentBody, type } = body;
  if (!commentBody?.trim()) return NextResponse.json({ error: "body required" }, { status: 400 });

  const comment = await prisma.sprintComment.create({
    data: {
      sprintId,
      authorId: session.user.id,
      body: commentBody.trim(),
      type: type ?? "comment",
    },
    include: {
      author: { select: { id: true, name: true, displayName: true, image: true, email: true } },
    },
  });

  return NextResponse.json(comment, { status: 201 });
}
