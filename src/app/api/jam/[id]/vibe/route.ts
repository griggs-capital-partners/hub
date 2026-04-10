import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

// POST /api/jam/[id]/vibe — fire reaction, logs an activity event
export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;

  const jam = await prisma.jamSession.findUnique({
    where: { id },
    include: { host: { select: { name: true, displayName: true } } },
  });
  if (!jam || !jam.isActive) {
    return NextResponse.json({ error: "No active session" }, { status: 404 });
  }

  // Log a vibe reaction as an activity event
  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { name: true, displayName: true, image: true },
  });

  await prisma.activityEvent.create({
    data: {
      type: "jam.vibe",
      payload: JSON.stringify({ sessionId: id }),
      actorName: user?.displayName || user?.name || "Someone",
      actorImage: user?.image || null,
    },
  });

  return NextResponse.json({ ok: true });
}
