import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import {
  findDirectConversation,
  getConversationForUser,
  isMissingChatTablesError,
  listConversationsForUser,
  resolveChatProjectSelection,
  serializeConversation,
} from "@/lib/chat";

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const conversations = await listConversationsForUser(session.user.id);
    return NextResponse.json({ conversations });
  } catch (error) {
    if (isMissingChatTablesError(error)) {
      return NextResponse.json(
        { error: "Team chat is not ready yet. The new chat tables still need to be migrated." },
        { status: 503 }
      );
    }

    console.error("[chat/conversations][GET]", error);
    return NextResponse.json({ error: "Failed to load conversations" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = (await request.json()) as Record<string, unknown>;
  const type = body?.type === "group" ? "group" : "direct";
  const forceNew = body?.forceNew === true;
  const requestedProjectId = typeof body?.projectId === "string" ? body.projectId.trim() : "";
  const requestedProjectName = typeof body?.projectName === "string" ? body.projectName.trim() : "";

  try {
    let resolvedProject: Awaited<ReturnType<typeof resolveChatProjectSelection>>;
    try {
      resolvedProject = await resolveChatProjectSelection({
        projectId: requestedProjectId,
        projectName: requestedProjectName,
      });
    } catch (error) {
      if (error instanceof Error && error.message === "Project not found") {
        return NextResponse.json({ error: "Project not found" }, { status: 404 });
      }

      throw error;
    }

    if (type === "group") {
      const name = typeof body?.name === "string" ? body.name.trim() : "";
      const memberUserIds = Array.isArray(body?.memberUserIds)
        ? body.memberUserIds.filter((id: unknown): id is string => typeof id === "string" && id.trim().length > 0)
        : [];
      const memberAgentIds = Array.isArray(body?.memberAgentIds)
        ? body.memberAgentIds.filter((id: unknown): id is string => typeof id === "string" && id.trim().length > 0)
        : [];

      const uniqueMemberUserIds = Array.from(new Set([session.user.id, ...memberUserIds]));
      const uniqueMemberAgentIds = Array.from(new Set(memberAgentIds));

      if (uniqueMemberUserIds.length + uniqueMemberAgentIds.length < 2) {
        return NextResponse.json({ error: "Choose at least one teammate or agent" }, { status: 400 });
      }

      const [users, agents] = await Promise.all([
        prisma.user.findMany({
          where: { id: { in: uniqueMemberUserIds } },
          select: { id: true },
        }),
        uniqueMemberAgentIds.length > 0
          ? prisma.aIAgent.findMany({
              where: { id: { in: uniqueMemberAgentIds } },
              select: { id: true },
            })
          : Promise.resolve([]),
      ]);

      if (users.length !== uniqueMemberUserIds.length) {
        return NextResponse.json({ error: "One or more selected teammates were not found" }, { status: 400 });
      }

      if (agents.length !== uniqueMemberAgentIds.length) {
        return NextResponse.json({ error: "One or more selected agents were not found" }, { status: 400 });
      }

      const createdConversation = await prisma.conversation.create({
        data: {
          type: "group",
          name: name || null,
          createdById: session.user.id,
          ...(resolvedProject.project ? { chatProjectId: resolvedProject.project.id } : {}),
          members: {
            create: [
              ...uniqueMemberUserIds.map((userId) => ({
                userId,
              })),
              ...uniqueMemberAgentIds.map((agentId) => ({
                agentId,
              })),
            ],
          },
        },
      });

      const conversation = await getConversationForUser(createdConversation.id, session.user.id);
      if (!conversation) {
        return NextResponse.json({ error: "Unable to load the new thread" }, { status: 500 });
      }

      return NextResponse.json({ conversation: serializeConversation(conversation) }, { status: 201 });
    }

    const otherUserId = typeof body?.userId === "string" ? body.userId.trim() : "";
    const agentId = typeof body?.agentId === "string" ? body.agentId.trim() : "";

    if (!otherUserId && !agentId) {
      return NextResponse.json({ error: "A teammate or agent is required" }, { status: 400 });
    }

    if (otherUserId && agentId) {
      return NextResponse.json({ error: "Choose either a teammate or an agent" }, { status: 400 });
    }

    if (otherUserId === session.user.id) {
      return NextResponse.json({ error: "You already have your own notes app for that" }, { status: 400 });
    }

    if (!forceNew) {
      const existingConversation = await findDirectConversation({
        currentUserId: session.user.id,
        otherUserId: otherUserId || undefined,
        agentId: agentId || undefined,
      });

      if (existingConversation) {
        return NextResponse.json({ conversation: serializeConversation(existingConversation) });
      }
    }

    if (otherUserId) {
      const user = await prisma.user.findUnique({
        where: { id: otherUserId },
        select: { id: true },
      });

      if (!user) {
        return NextResponse.json({ error: "Teammate not found" }, { status: 404 });
      }
    }

    if (agentId) {
      const agent = await prisma.aIAgent.findUnique({
        where: { id: agentId },
        select: { id: true },
      });

      if (!agent) {
        return NextResponse.json({ error: "Agent not found" }, { status: 404 });
      }
    }

    const createdConversation = await prisma.conversation.create({
      data: {
        type: "direct",
        createdById: session.user.id,
        ...(resolvedProject.project ? { chatProjectId: resolvedProject.project.id } : {}),
        members: {
          create: otherUserId
            ? [{ userId: session.user.id }, { userId: otherUserId }]
            : [{ userId: session.user.id }, { agentId }],
        },
      },
    });

    const conversation = await getConversationForUser(createdConversation.id, session.user.id);
    if (!conversation) {
      return NextResponse.json({ error: "Unable to load the new thread" }, { status: 500 });
    }

    return NextResponse.json({ conversation: serializeConversation(conversation) }, { status: 201 });
  } catch (error) {
    if (isMissingChatTablesError(error)) {
      return NextResponse.json(
        { error: "Team chat is not ready yet. The new chat tables still need to be migrated." },
        { status: 503 }
      );
    }

    console.error("[chat/conversations][POST]", error);
    return NextResponse.json({ error: "Failed to create conversation" }, { status: 500 });
  }
}
