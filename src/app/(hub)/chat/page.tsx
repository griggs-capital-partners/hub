import { Suspense } from "react";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { TeamClient } from "@/components/team/TeamClient";
import { ensurePlaceholderUsersForInvites, inviteUserId } from "@/lib/team-invites";
import { listChatProjects, listConversationsForUser } from "@/lib/chat";
import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

export default async function TeamPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");

  const [invites, agents, conversations, chatProjects] = await Promise.all([
    prisma.teamInvite.findMany({
      where: { usedAt: null },
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        email: true,
        createdAt: true,
      },
    }),
    prisma.aIAgent.findMany({
      orderBy: { createdAt: "asc" },
      include: {
        createdBy: { select: { id: true, name: true, displayName: true } },
        _count: { select: { sprintTasks: true } },
      },
    }),
    listConversationsForUser(session.user.id),
    listChatProjects(),
  ]);

  await ensurePlaceholderUsersForInvites(prisma, invites);

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
    },
  });

  const pendingInviteUsers = pendingInviteEmails.length > 0
    ? await prisma.user.findMany({
        where: { email: { in: pendingInviteEmails } },
        select: {
          id: true,
          name: true,
          displayName: true,
          email: true,
          image: true,
        },
      })
    : [];

  const pendingInviteUserMap = new Map(
    pendingInviteUsers.map((user) => [user.email.toLowerCase(), user])
  );

  const serializedUsers = users.map((u) => ({
    ...u,
    lastSeen: u.lastSeen?.toISOString() ?? null,
    sprintTasks: [],
  }));

  const serializedInvites = invites.map((invite) => ({
    id: invite.id,
    userId: pendingInviteUserMap.get(invite.email.toLowerCase())?.id ?? inviteUserId(invite.id),
    name: pendingInviteUserMap.get(invite.email.toLowerCase())?.displayName
      ?? pendingInviteUserMap.get(invite.email.toLowerCase())?.name
      ?? null,
    image: pendingInviteUserMap.get(invite.email.toLowerCase())?.image ?? null,
    email: invite.email,
    createdAt: invite.createdAt.toISOString(),
  }));

  const serializedAgents = agents.map((a) => ({
    ...a,
    createdAt: a.createdAt.toISOString(),
    updatedAt: a.updatedAt.toISOString(),
    llmLastCheckedAt: a.llmLastCheckedAt?.toISOString() ?? null,
  }));
  const serializedProjects = chatProjects.map((project) => ({
    id: project.id,
    name: project.name,
  }));

  return (
    <Suspense>
      <TeamClient
        currentUserId={session.user.id}
        users={serializedUsers}
        invites={serializedInvites}
        agents={serializedAgents}
        projects={serializedProjects}
        initialConversations={conversations}
        activeSprint={null}
      />
    </Suspense>
  );
}
