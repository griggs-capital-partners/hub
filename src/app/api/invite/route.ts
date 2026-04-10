import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { deriveInviteName, ensurePlaceholderUsersForInvites, inviteUserId } from "@/lib/team-invites";

// GET /api/invite — list all invites
export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const invites = await prisma.teamInvite.findMany({
    orderBy: { createdAt: "desc" },
  });

  await ensurePlaceholderUsersForInvites(
    prisma,
    invites.filter((invite) => !invite.usedAt)
  );

  return NextResponse.json({ invites });
}

// POST /api/invite — add an email to the invite list
export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json();
  const email = (body?.email as string | undefined)?.toLowerCase().trim();

  if (!email) {
    return NextResponse.json({ error: "email is required" }, { status: 400 });
  }

  const existing = await prisma.teamInvite.findUnique({ where: { email } });
  if (existing) {
    return NextResponse.json({ error: "That email is already invited" }, { status: 409 });
  }

  const existingUser = await prisma.user.findUnique({ where: { email } });
  if (existingUser && !existingUser.id.startsWith("invite:")) {
    return NextResponse.json({ error: "That email already belongs to a team member" }, { status: 409 });
  }

  const invite = await prisma.$transaction(async (tx) => {
    const createdInvite = await tx.teamInvite.create({
      data: { email, createdBy: session.user.id },
    });

    await ensurePlaceholderUsersForInvites(tx, [{ id: createdInvite.id, email }]);

    return createdInvite;
  });

  return NextResponse.json({ invite }, { status: 201 });
}

// DELETE /api/invite — revoke an invite by id
export async function DELETE(request: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await request.json();
  if (!id) return NextResponse.json({ error: "id required" }, { status: 400 });

  const invite = await prisma.teamInvite.findUnique({ where: { id } });
  if (!invite) {
    return NextResponse.json({ error: "Invite not found" }, { status: 404 });
  }

  await prisma.$transaction(async (tx) => {
    await tx.teamInvite.delete({ where: { id } });
    await tx.user.deleteMany({
      where: {
        email: invite.email,
        id: inviteUserId(invite.id),
        connectedAccounts: { none: {} },
      },
    });
  });

  return NextResponse.json({ ok: true });
}
