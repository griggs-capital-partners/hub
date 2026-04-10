import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

// POST /api/jam/[id]/join — mark current user as a listener
export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;

  const jam = await prisma.jamSession.findUnique({ where: { id } });
  if (!jam || !jam.isActive) {
    return NextResponse.json({ error: "No active session" }, { status: 404 });
  }

  await prisma.jamListener.upsert({
    where: { sessionId_userId: { sessionId: id, userId: session.user.id } },
    update: {},
    create: { sessionId: id, userId: session.user.id },
  });

  return NextResponse.json({ ok: true });
}
