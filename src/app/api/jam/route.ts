import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

// GET /api/jam — fetch the current active jam session
export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const jam = await prisma.jamSession.findFirst({
    where: { isActive: true },
    orderBy: { startedAt: "desc" },
    include: {
      host: { select: { id: true, name: true, displayName: true, image: true } },
      listeners: {
        include: {
          user: { select: { id: true, name: true, displayName: true, image: true } },
        },
        orderBy: { joinedAt: "asc" },
      },
    },
  });

  return NextResponse.json({ jam });
}

// POST /api/jam — start a new jam session (ends any existing one first)
export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { jamLink, note } = await req.json();

  if (!jamLink?.trim()) {
    return NextResponse.json({ error: "Spotify Jam link is required" }, { status: 400 });
  }

  // Validate it looks like a Spotify link
  if (!jamLink.includes("spotify")) {
    return NextResponse.json({ error: "Please paste a valid Spotify Jam link" }, { status: 400 });
  }

  // End any existing active sessions
  await prisma.jamSession.updateMany({
    where: { isActive: true },
    data: { isActive: false, endedAt: new Date() },
  });

  const jam = await prisma.jamSession.create({
    data: {
      hostId: session.user.id,
      jamLink: jamLink.trim(),
      note: note?.trim() || null,
      // Auto-add host as first listener
      listeners: {
        create: { userId: session.user.id },
      },
    },
    include: {
      host: { select: { id: true, name: true, displayName: true, image: true } },
      listeners: {
        include: {
          user: { select: { id: true, name: true, displayName: true, image: true } },
        },
      },
    },
  });

  return NextResponse.json({ jam }, { status: 201 });
}
