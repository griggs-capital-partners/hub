import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import {
  getPublicConversationLlmState,
  normalizeAgentLlmConfig,
  normalizeConversationLlmThreadState,
  reconcileConversationLlmThreadState,
} from "@/lib/agent-llm-config";

const conversationInclude = {
  chatProject: {
    select: {
      id: true,
      name: true,
    },
  },
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
  documents: {
    orderBy: { createdAt: "desc" as const },
    include: {
      uploader: {
        select: {
          id: true,
          name: true,
          displayName: true,
          email: true,
          image: true,
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

const SEARCH_RESULT_LIMIT = 50;

type ConversationWithRelations = Prisma.ConversationGetPayload<{
  include: typeof conversationInclude;
}>;

type ChatProjectSummary = {
  id: string;
  name: string;
};

function resolveConversationAgentMemberInternal(
  conversation: ConversationWithRelations
) {
  const storedThreadLlmState = normalizeConversationLlmThreadState(conversation.llmThreadState);
  const agentMembers = conversation.members.filter(
    (member): member is ConversationWithRelations["members"][number] & { agent: NonNullable<ConversationWithRelations["members"][number]["agent"]> } =>
      Boolean(member.agent)
  );

  if (storedThreadLlmState.activeAgentId) {
    const explicitAgentMember = agentMembers.find((member) => member.agent.id === storedThreadLlmState.activeAgentId);
    if (explicitAgentMember) {
      return explicitAgentMember;
    }
  }

  return agentMembers[0] ?? null;
}

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

function serializeConversationDocument(
  document: ConversationWithRelations["documents"][number]
) {
  return {
    id: document.id,
    filename: document.filename,
    mimeType: document.mimeType,
    fileType: document.fileType,
    fileSize: document.fileSize,
    createdAt: document.createdAt.toISOString(),
    uploader: {
      id: document.uploader.id,
      name: document.uploader.displayName || document.uploader.name || document.uploader.email,
      email: document.uploader.email,
      image: document.uploader.image,
    },
  };
}

export function serializeConversation(
  conversation: ConversationWithRelations
) {
  const activeAgentMember = resolveConversationAgentMemberInternal(conversation)?.agent ?? null;
  const storedThreadLlmState = normalizeConversationLlmThreadState(conversation.llmThreadState);
  const threadLlmState = activeAgentMember
    ? reconcileConversationLlmThreadState(
        normalizeAgentLlmConfig(activeAgentMember.llmConfig, {
          llmEndpointUrl: activeAgentMember.llmEndpointUrl,
          llmUsername: activeAgentMember.llmUsername,
          llmPassword: activeAgentMember.llmPassword,
          llmModel: activeAgentMember.llmModel,
          llmThinkingMode: activeAgentMember.llmThinkingMode,
        }),
        storedThreadLlmState
      )
    : storedThreadLlmState;
  const publicThreadLlmState = {
    ...threadLlmState,
    activeAgentId:
      threadLlmState.activeAgentId && activeAgentMember?.id === threadLlmState.activeAgentId
        ? threadLlmState.activeAgentId
        : null,
  };

  return {
    id: conversation.id,
    type: conversation.type,
    name: conversation.name,
    project: conversation.chatProject
      ? {
          id: conversation.chatProject.id,
          name: conversation.chatProject.name,
        }
      : null,
    llmThread: getPublicConversationLlmState(publicThreadLlmState),
    createdAt: conversation.createdAt.toISOString(),
    updatedAt: conversation.updatedAt.toISOString(),
    members: conversation.members
      .map(serializeConversationMember)
      .filter((member): member is NonNullable<typeof member> => member !== null),
    latestMessage: serializeLatestMessage(conversation.messages[0]),
    documents: conversation.documents.map(serializeConversationDocument),
  };
}

function includesNormalizedQuery(value: string | null | undefined, normalizedQuery: string) {
  return value?.toLocaleLowerCase().includes(normalizedQuery) ?? false;
}

function buildMessageMatchSnippet(body: string, query: string) {
  const collapsedBody = body.replace(/\s+/g, " ").trim();
  if (!collapsedBody) {
    return "Matched in message content.";
  }

  const normalizedBody = collapsedBody.toLocaleLowerCase();
  const normalizedQuery = query.trim().toLocaleLowerCase();
  const matchIndex = normalizedBody.indexOf(normalizedQuery);

  if (matchIndex < 0) {
    return collapsedBody.length > 160
      ? `${collapsedBody.slice(0, 157).trimEnd()}...`
      : collapsedBody;
  }

  const radius = 72;
  const start = Math.max(0, matchIndex - radius);
  const end = Math.min(collapsedBody.length, matchIndex + query.trim().length + radius);
  const prefix = start > 0 ? "..." : "";
  const suffix = end < collapsedBody.length ? "..." : "";

  return `${prefix}${collapsedBody.slice(start, end).trim()}${suffix}`;
}

function getSerializedSearchSenderName(message: {
  senderUser: {
    name: string | null;
    displayName: string | null;
  } | null;
  senderAgent: {
    name: string;
  } | null;
}) {
  if (message.senderUser) {
    return message.senderUser.displayName || message.senderUser.name || "Unknown user";
  }

  if (message.senderAgent) {
    return message.senderAgent.name;
  }

  return null;
}

export function resolveConversationAgentMember(
  conversation: ConversationWithRelations
) {
  return resolveConversationAgentMemberInternal(conversation);
}

export async function listChatProjects() {
  try {
    return await prisma.chatProject.findMany({
      orderBy: { name: "asc" },
      select: {
        id: true,
        name: true,
      },
    });
  } catch (error) {
    if (isMissingChatTablesError(error)) {
      return [];
    }

    throw error;
  }
}

export async function resolveChatProjectSelection(params: {
  projectId?: string | null;
  projectName?: string | null;
}): Promise<{ project: ChatProjectSummary | null; created: boolean }> {
  const requestedProjectId = params.projectId?.trim() ?? "";
  const requestedProjectName = params.projectName?.trim() ?? "";

  if (requestedProjectId) {
    const project = await prisma.chatProject.findUnique({
      where: { id: requestedProjectId },
      select: { id: true, name: true },
    });

    if (!project) {
      throw new Error("Project not found");
    }

    return { project, created: false };
  }

  if (!requestedProjectName) {
    return { project: null, created: false };
  }

  const existingProject = await prisma.chatProject.findFirst({
    where: {
      name: {
        equals: requestedProjectName,
        mode: "insensitive",
      },
    },
    select: { id: true, name: true },
  });

  if (existingProject) {
    return { project: existingProject, created: false };
  }

  const createdProject = await prisma.chatProject.create({
    data: { name: requestedProjectName },
    select: { id: true, name: true },
  });

  return { project: createdProject, created: true };
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
      column?: unknown;
    };
  };

  const missingChatTable = prismaError.code === "P2021"
    && typeof prismaError.meta?.table === "string"
    && [
      "public.conversations",
      "public.conversation_members",
      "public.chat_messages",
      "public.chat_projects",
      "public.conversation_documents",
    ].includes(prismaError.meta.table);

  const missingChatColumn = prismaError.code === "P2022"
    && typeof prismaError.meta?.column === "string"
    && [
      "conversations.chatProjectId",
      "public.conversations.chatProjectId",
      "conversations.repoId",
      "public.conversations.repoId",
    ].includes(prismaError.meta.column);

  return missingChatTable || missingChatColumn;
}

export async function searchConversationsForUser(userId: string, rawQuery: string) {
  const query = rawQuery.trim();

  if (!query) {
    return [];
  }

  try {
    const conversations = await prisma.conversation.findMany({
      where: {
        members: {
          some: { userId },
        },
        OR: [
          {
            name: {
              contains: query,
              mode: "insensitive",
            },
          },
          {
            chatProject: {
              is: {
                name: {
                  contains: query,
                  mode: "insensitive",
                },
              },
            },
          },
          {
            members: {
              some: {
                OR: [
                  {
                    user: {
                      is: {
                        displayName: {
                          contains: query,
                          mode: "insensitive",
                        },
                      },
                    },
                  },
                  {
                    user: {
                      is: {
                        name: {
                          contains: query,
                          mode: "insensitive",
                        },
                      },
                    },
                  },
                  {
                    user: {
                      is: {
                        email: {
                          contains: query,
                          mode: "insensitive",
                        },
                      },
                    },
                  },
                  {
                    agent: {
                      is: {
                        name: {
                          contains: query,
                          mode: "insensitive",
                        },
                      },
                    },
                  },
                  {
                    agent: {
                      is: {
                        role: {
                          contains: query,
                          mode: "insensitive",
                        },
                      },
                    },
                  },
                ],
              },
            },
          },
          {
            messages: {
              some: {
                body: {
                  contains: query,
                  mode: "insensitive",
                },
              },
            },
          },
        ],
      },
      include: conversationInclude,
      orderBy: [{ updatedAt: "desc" }],
      take: SEARCH_RESULT_LIMIT,
    });

    const serializedConversations = conversations.map(serializeConversation);
    const normalizedQuery = query.toLocaleLowerCase();
    const conversationIds = conversations.map((conversation) => conversation.id);
    const matchingMessageByConversationId = new Map<string, Prisma.ChatMessageGetPayload<{ include: typeof messageInclude }>>();

    if (conversationIds.length > 0) {
      const matchingMessages = await prisma.chatMessage.findMany({
        where: {
          conversationId: { in: conversationIds },
          body: {
            contains: query,
            mode: "insensitive",
          },
        },
        include: messageInclude,
        orderBy: [{ createdAt: "desc" }],
      });

      for (const message of matchingMessages) {
        if (!matchingMessageByConversationId.has(message.conversationId)) {
          matchingMessageByConversationId.set(message.conversationId, message);
        }
      }
    }

    return serializedConversations.map((conversation) => {
      const matchingMessage = matchingMessageByConversationId.get(conversation.id);
      if (matchingMessage) {
        return {
          conversation,
          match: {
            kind: "message" as const,
            snippet: buildMessageMatchSnippet(matchingMessage.body, query),
            senderName: getSerializedSearchSenderName(matchingMessage),
            matchedAt: matchingMessage.createdAt.toISOString(),
          },
        };
      }

      const customName = conversation.name?.trim() ?? "";
      if (includesNormalizedQuery(customName, normalizedQuery)) {
        return {
          conversation,
          match: {
            kind: "thread" as const,
            snippet: customName,
            senderName: null,
            matchedAt: conversation.updatedAt,
          },
        };
      }

      const projectName = conversation.project?.name?.trim() || "General";
      if (includesNormalizedQuery(projectName, normalizedQuery)) {
        return {
          conversation,
          match: {
            kind: "project" as const,
            snippet: projectName,
            senderName: null,
            matchedAt: conversation.updatedAt,
          },
        };
      }

      const matchingMember = conversation.members.find((member) =>
        includesNormalizedQuery(member.name, normalizedQuery)
        || includesNormalizedQuery(member.role, normalizedQuery)
        || includesNormalizedQuery(member.email, normalizedQuery)
      );

      if (matchingMember) {
        return {
          conversation,
          match: {
            kind: "participant" as const,
            snippet: matchingMember.role
              ? `${matchingMember.name} / ${matchingMember.role}`
              : matchingMember.name,
            senderName: null,
            matchedAt: conversation.updatedAt,
          },
        };
      }

      return {
        conversation,
        match: {
          kind: "thread" as const,
          snippet: conversation.latestMessage?.body || customName || "Conversation match",
          senderName: null,
          matchedAt: conversation.updatedAt,
        },
      };
    });
  } catch (error) {
    if (isMissingChatTablesError(error)) {
      return [];
    }

    throw error;
  }
}
