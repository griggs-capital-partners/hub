import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

// GET /api/team — fetch all team members with active (or planning) sprint data
export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Prefer active sprint; fall back to most recent planning sprint
  const currentSprint = await prisma.sprint.findFirst({
    where: { status: { in: ["active", "planning"] } },
    orderBy: [{ status: "asc" }, { startDate: "desc" }],
    select: { id: true, name: true, status: true, startDate: true, endDate: true },
  });

  const invites = await prisma.teamInvite.findMany({
    where: { usedAt: null },
    select: { email: true },
  });

  const pendingInviteEmails = invites.map((invite) => invite.email.toLowerCase());

  const users = await prisma.user.findMany({
    where: {
      ...(pendingInviteEmails.length > 0 ? { email: { notIn: pendingInviteEmails } } : {}),
    },
    orderBy: { name: "asc" },
    select: {
      id: true,
      name: true,
      displayName: true,
      email: true,
      image: true,
      role: true,
      lastSeen: true,
      sprintTasks: currentSprint
        ? {
            where: { sprintId: currentSprint.id },
            select: {
              id: true,
              title: true,
              status: true,
              priority: true,
              storyPoints: true,
            },
            orderBy: { position: "asc" },
          }
        : false,
    },
  });

  return NextResponse.json({ users, activeSprint: currentSprint });
}
