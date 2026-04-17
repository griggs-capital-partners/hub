import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import {
  getPublicConversationLlmState,
  normalizeAgentLlmConfig,
  normalizeConversationLlmThreadState,
  reconcileConversationLlmThreadState,
} from "@/lib/agent-llm-config";

const conversationInclude = {
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
          description: true,
          role: true,
          persona: true,
          duties: true,
          avatar: true,
          status: true,
          llmConfig: true,
          llmEndpointUrl: true,
          llmUsername: true,
          llmPassword: true,
          llmModel: true,
          llmThinkingMode: true,
          disabledTools: true,
          abilities: true,
          llmStatus: true,
          llmLastCheckedAt: true,
          llmLastError: true,
        },
      },
    },
    orderBy: { joinedAt: "asc" as const },
  },
  messages: {
    take: 1,
    orderBy: { createdAt: "desc" as const },
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
} as const;

const messageInclude = {
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
} as const;

type ConversationWithRelations = Prisma.ConversationGetPayload<{
  include: typeof conversationInclude;
}>;

function displayUserName(user: {
  displayName: string | null;
  name: string | null;
  email: string;
}) {
  return user.displayName || user.name || user.email;
}

function serializeConversationMember(
  member: ConversationWithRelations["members"][number]
) {
  if (member.user) {
    return {
      kind: "user" as const,
      id: member.user.id,
      name: displayUserName(member.user),
      email: member.user.email,
      image: member.user.image,
      role: member.user.role,
      lastSeen: member.user.lastSeen?.toISOString() ?? null,
    };
  }

  if (!member.agent) {
    return null;
  }

  return {
    kind: "agent" as const,
    id: member.agent.id,
    name: member.agent.name,
    image: member.agent.avatar,
    role: member.agent.role,
    status: member.agent.status,
    llmModel: member.agent.llmModel,
    llmThinkingMode: member.agent.llmThinkingMode,
    llmStatus: member.agent.llmStatus,
    llmLastCheckedAt: member.agent.llmLastCheckedAt?.toISOString() ?? null,
    llmLastError: member.agent.llmLastError,
  };
}

function serializeLatestMessage(
  message: ConversationWithRelations["messages"][number] | undefined
) {
  if (!message) return null;

  const sender =
    message.senderUser
      ? {
          kind: "user" as const,
          id: message.senderUser.id,
          name: message.senderUser.displayName || message.senderUser.name || "Unknown user",
          image: message.senderUser.image,
        }
      : message.senderAgent
        ? {
            kind: "agent" as const,
            id: message.senderAgent.id,
            name: message.senderAgent.name,
            image: message.senderAgent.avatar,
          }
        : null;

  return {
    id: message.id,
    body: message.body,
    createdAt: message.createdAt.toISOString(),
    sender,
  };
}

export function serializeConversation(
  conversation: ConversationWithRelations
) {
  const agentMember = conversation.members.find((member) => member.agent)?.agent ?? null;
  const storedThreadLlmState = normalizeConversationLlmThreadState(conversation.llmThreadState);
  const threadLlmState = agentMember
    ? reconcileConversationLlmThreadState(
        normalizeAgentLlmConfig(agentMember.llmConfig, {
          llmEndpointUrl: agentMember.llmEndpointUrl,
          llmUsername: agentMember.llmUsername,
          llmPassword: agentMember.llmPassword,
          llmModel: agentMember.llmModel,
          llmThinkingMode: agentMember.llmThinkingMode,
        }),
        storedThreadLlmState
      )
    : storedThreadLlmState;

  return {
    id: conversation.id,
    type: conversation.type,
    name: conversation.name,
    llmThread: getPublicConversationLlmState(threadLlmState),
    createdAt: conversation.createdAt.toISOString(),
    updatedAt: conversation.updatedAt.toISOString(),
    members: conversation.members
      .map(serializeConversationMember)
      .filter((member): member is NonNullable<typeof member> => member !== null),
    latestMessage: serializeLatestMessage(conversation.messages[0]),
  };
}

export async function listConversationsForUser(userId: string) {
  try {
    const conversations = await prisma.conversation.findMany({
      where: {
        members: {
          some: { userId },
        },
      },
      include: conversationInclude,
      orderBy: [{ updatedAt: "desc" }],
    });

    return conversations.map(serializeConversation);
  } catch (error) {
    if (isMissingChatTablesError(error)) {
      return [];
    }

    throw error;
  }
}

export async function getConversationForUser(conversationId: string, userId: string) {
  try {
    return await prisma.conversation.findFirst({
      where: {
        id: conversationId,
        members: {
          some: { userId },
        },
      },
      include: conversationInclude,
    });
  } catch (error) {
    if (isMissingChatTablesError(error)) {
      return null;
    }

    throw error;
  }
}

export async function listMessagesForConversation(conversationId: string) {
  try {
    const messages = await prisma.chatMessage.findMany({
      where: { conversationId },
      include: messageInclude,
      orderBy: { createdAt: "asc" },
    });

    return messages.map((message) => ({
      id: message.id,
      body: message.body,
      createdAt: message.createdAt.toISOString(),
      sender: message.senderUser
        ? {
            kind: "user" as const,
            id: message.senderUser.id,
            name: message.senderUser.displayName || message.senderUser.name || "Unknown user",
            image: message.senderUser.image,
          }
        : message.senderAgent
          ? {
              kind: "agent" as const,
              id: message.senderAgent.id,
              name: message.senderAgent.name,
              image: message.senderAgent.avatar,
            }
          : null,
    }));
  } catch (error) {
    if (isMissingChatTablesError(error)) {
      return [];
    }

    throw error;
  }
}

export async function findDirectConversation(params: {
  currentUserId: string;
  otherUserId?: string;
  agentId?: string;
}) {
  try {
    const conversations = await prisma.conversation.findMany({
      where: {
        type: "direct",
        members: {
          some: { userId: params.currentUserId },
        },
      },
      include: conversationInclude,
    });

    return conversations.find((conversation) => {
      const userIds = conversation.members.flatMap((member) => (member.userId ? [member.userId] : []));
      const agentIds = conversation.members.flatMap((member) => (member.agentId ? [member.agentId] : []));

      if (params.otherUserId) {
        return userIds.length === 2
          && agentIds.length === 0
          && userIds.includes(params.currentUserId)
          && userIds.includes(params.otherUserId);
      }

      if (params.agentId) {
        return userIds.length === 1
          && agentIds.length === 1
          && userIds[0] === params.currentUserId
          && agentIds[0] === params.agentId;
      }

      return false;
    });
  } catch (error) {
    if (isMissingChatTablesError(error)) {
      return null;
    }

    throw error;
  }
}

export function isMissingChatTablesError(error: unknown) {
  if (!error || typeof error !== "object") {
    return false;
  }

  const prismaError = error as {
    code?: unknown;
    meta?: {
      table?: unknown;
    };
  };

  return prismaError.code === "P2021"
    && typeof prismaError.meta?.table === "string"
    && ["public.conversations", "public.conversation_members", "public.chat_messages"].includes(prismaError.meta.table);
}
