import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string; commentId: string }> }
) {
  await auth();
  const { commentId } = await params;
  await prisma.sprintComment.delete({ where: { id: commentId } });
  return NextResponse.json({ ok: true });
}
