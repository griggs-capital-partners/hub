import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: {
      id: true,
      name: true,
      displayName: true,
      email: true,
      image: true,
      role: true,
      connectedAccounts: {
        select: { provider: true, providerAccountId: true, scope: true },
      },
    },
  });

  if (!user) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  return NextResponse.json({ user });
}

export async function PATCH(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json();
  const { displayName, image } = body;
  const targetUserId = typeof body?.userId === "string" && body.userId.trim().length > 0
    ? body.userId.trim()
    : session.user.id;

  if (targetUserId !== session.user.id) {
    const targetUser = await prisma.user.findUnique({
      where: { id: targetUserId },
      select: { id: true },
    });

    if (!targetUser?.id.startsWith("invite:")) {
      return NextResponse.json({ error: "You can only edit your own profile or a pending invite profile" }, { status: 403 });
    }

    const invite = await prisma.teamInvite.findUnique({
      where: { id: targetUser.id.replace(/^invite:/, "") },
      select: { usedAt: true },
    });

    if (!invite || invite.usedAt) {
      return NextResponse.json({ error: "Invite is no longer pending" }, { status: 403 });
    }
  }

  // Validate display name
  if (displayName !== undefined) {
    if (typeof displayName !== "string") {
      return NextResponse.json({ error: "Invalid display name" }, { status: 400 });
    }
    const trimmed = displayName.trim();
    if (trimmed.length > 64) {
      return NextResponse.json({ error: "Display name must be 64 characters or fewer" }, { status: 400 });
    }
  }

  // Validate avatar: must be a data URL or an https URL
  if (image !== undefined && image !== null) {
    if (typeof image !== "string") {
      return NextResponse.json({ error: "Invalid image" }, { status: 400 });
    }
    const isDataUrl = image.startsWith("data:image/");
    const isHttps = image.startsWith("https://");
    if (!isDataUrl && !isHttps) {
      return NextResponse.json({ error: "Image must be a data URL or HTTPS URL" }, { status: 400 });
    }
    // Limit base64 size to ~400 KB encoded (roughly 300 KB decoded)
    if (isDataUrl && image.length > 400_000) {
      return NextResponse.json({ error: "Image too large. Max 300 KB." }, { status: 400 });
    }
  }

  const updated = await prisma.user.update({
    where: { id: targetUserId },
    data: {
      ...(displayName !== undefined && { displayName: displayName.trim() || null }),
      ...(image !== undefined && { image }),
    },
    select: {
      id: true,
      name: true,
      displayName: true,
      email: true,
      image: true,
    },
  });

  return NextResponse.json({ user: updated });
}
