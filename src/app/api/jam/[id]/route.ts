import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

// DELETE /api/jam/[id] — end jam session (host only)
export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;

  const jam = await prisma.jamSession.findUnique({ where: { id } });
  if (!jam) {
    return NextResponse.json({ error: "Session not found" }, { status: 404 });
  }
  if (jam.hostId !== session.user.id) {
    return NextResponse.json({ error: "Only the host can end the jam" }, { status: 403 });
  }

  await prisma.jamSession.update({
    where: { id },
    data: { isActive: false, endedAt: new Date() },
  });

  return NextResponse.json({ ok: true });
}
