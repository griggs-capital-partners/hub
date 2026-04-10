import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import {
  findDirectConversation,
  isMissingChatTablesError,
  listConversationsForUser,
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

  const body = await request.json();
  const type = body?.type === "group" ? "group" : "direct";

  try {
    if (type === "group") {
    const name = typeof body?.name === "string" ? body.name.trim() : "";
    const memberUserIds = Array.isArray(body?.memberUserIds)
      ? body.memberUserIds.filter((id: unknown): id is string => typeof id === "string" && id.trim().length > 0)
      : [];

    const uniqueMemberUserIds = Array.from(new Set([session.user.id, ...memberUserIds]));
    if (!name) {
      return NextResponse.json({ error: "Group name is required" }, { status: 400 });
    }

    if (uniqueMemberUserIds.length < 2) {
      return NextResponse.json({ error: "Choose at least one teammate" }, { status: 400 });
    }

    const users = await prisma.user.findMany({
      where: { id: { in: uniqueMemberUserIds } },
      select: { id: true },
    });

    if (users.length !== uniqueMemberUserIds.length) {
      return NextResponse.json({ error: "One or more selected teammates were not found" }, { status: 400 });
    }

      const conversation = await prisma.conversation.create({
      data: {
        type: "group",
        name,
        createdById: session.user.id,
        members: {
          create: uniqueMemberUserIds.map((userId) => ({
            userId,
          })),
        },
      },
      include: {
        members: {
          include: {
            user: {
              select: {
                id: true,
                name: true,
                displayName: true,
                email: true,
                image: true,
                role: true,
                lastSeen: true,
              },
            },
            agent: {
              select: {
                id: true,
                name: true,
                role: true,
                avatar: true,
                status: true,
                llmThinkingMode: true,
                llmStatus: true,
                llmLastCheckedAt: true,
              },
            },
          },
          orderBy: { joinedAt: "asc" },
        },
        messages: {
          take: 1,
          orderBy: { createdAt: "desc" },
          include: {
            senderUser: {
              select: {
                id: true,
                name: true,
                displayName: true,
                image: true,
              },
            },
            senderAgent: {
              select: {
                id: true,
                name: true,
                avatar: true,
              },
            },
          },
        },
      },
    });

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

    const existingConversation = await findDirectConversation({
      currentUserId: session.user.id,
      otherUserId: otherUserId || undefined,
      agentId: agentId || undefined,
    });

    if (existingConversation) {
      return NextResponse.json({ conversation: serializeConversation(existingConversation) });
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

    const conversation = await prisma.conversation.create({
      data: {
        type: "direct",
        createdById: session.user.id,
        members: {
          create: otherUserId
            ? [{ userId: session.user.id }, { userId: otherUserId }]
            : [{ userId: session.user.id }, { agentId }],
        },
      },
      include: {
        members: {
          include: {
            user: {
              select: {
                id: true,
                name: true,
                displayName: true,
                email: true,
                image: true,
                role: true,
                lastSeen: true,
              },
            },
            agent: {
              select: {
                id: true,
                name: true,
                role: true,
                avatar: true,
                status: true,
                llmThinkingMode: true,
                llmStatus: true,
                llmLastCheckedAt: true,
              },
            },
          },
          orderBy: { joinedAt: "asc" },
        },
        messages: {
          take: 1,
          orderBy: { createdAt: "desc" },
          include: {
            senderUser: {
              select: {
                id: true,
                name: true,
                displayName: true,
                image: true,
              },
            },
            senderAgent: {
              select: {
                id: true,
                name: true,
                avatar: true,
              },
            },
          },
        },
      },
    });

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
