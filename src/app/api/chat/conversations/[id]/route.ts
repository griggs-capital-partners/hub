import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import {
  getConversationForUser,
  isMissingChatTablesError,
  serializeConversation,
} from "@/lib/chat";
import {
  normalizeConversationLlmThreadState,
  serializeConversationLlmThreadState,
} from "@/lib/agent-llm-config";
import { prisma } from "@/lib/prisma";

function parseIdList(value: unknown) {
  return Array.isArray(value)
    ? Array.from(new Set(
        value.filter((entry: unknown): entry is string => typeof entry === "string" && entry.trim().length > 0)
      ))
    : [];
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { id } = await params;
    const conversation = await getConversationForUser(id, session.user.id);

    if (!conversation) {
      return NextResponse.json({ error: "Conversation not found" }, { status: 404 });
    }

    const body = (await request.json()) as Record<string, unknown>;
    const addUserIds = parseIdList(body?.addUserIds);
    const addAgentIds = parseIdList(body?.addAgentIds);
    const removeUserIds = parseIdList(body?.removeUserIds);
    const removeAgentIds = parseIdList(body?.removeAgentIds);
    const requestedName =
      typeof body?.name === "string"
        ? body.name.trim() || null
        : body?.name === null
          ? null
          : undefined;
    const projectId =
      typeof body?.projectId === "string" && body.projectId.trim().length > 0
        ? body.projectId.trim()
        : body?.projectId === null
          ? null
          : undefined;
    const activeAgentId =
      typeof body?.activeAgentId === "string" && body.activeAgentId.trim().length > 0
        ? body.activeAgentId.trim()
        : body?.activeAgentId === null
          ? null
          : undefined;

    if (
      addUserIds.length + addAgentIds.length + removeUserIds.length + removeAgentIds.length === 0
      && activeAgentId === undefined
      && projectId === undefined
      && requestedName === undefined
    ) {
      return NextResponse.json({ error: "No thread updates were requested" }, { status: 400 });
    }

    const existingUserIds = new Set(conversation.members.flatMap((member) => (member.userId ? [member.userId] : [])));
    const existingAgentIds = new Set(conversation.members.flatMap((member) => (member.agentId ? [member.agentId] : [])));
    const nextUserIds = addUserIds.filter((userId) => userId !== session.user.id && !existingUserIds.has(userId));
    const nextAgentIds = addAgentIds.filter((agentId) => !existingAgentIds.has(agentId));
    const nextRemoveUserIds = removeUserIds.filter((userId) => userId !== session.user.id && existingUserIds.has(userId));
    const nextRemoveAgentIds = removeAgentIds.filter((agentId) => existingAgentIds.has(agentId));
    const nextName = requestedName === undefined ? conversation.name : requestedName;
    const projectAssignmentChanged = projectId !== undefined && conversation.chatProjectId !== projectId;
    const nameChanged = requestedName !== undefined && (conversation.name ?? null) !== nextName;

    if (removeUserIds.includes(session.user.id)) {
      return NextResponse.json({ error: "You cannot remove yourself from a thread yet" }, { status: 400 });
    }

    const hasParticipantChanges =
      nextUserIds.length + nextAgentIds.length + nextRemoveUserIds.length + nextRemoveAgentIds.length > 0;

    const orderedExistingAgentIds = conversation.members.flatMap((member) => (member.agentId ? [member.agentId] : []));
    const remainingOrderedAgentIds = orderedExistingAgentIds.filter((agentId) => !nextRemoveAgentIds.includes(agentId));
    const nextOrderedAgentIds = [...remainingOrderedAgentIds, ...nextAgentIds];
    const currentThreadState = normalizeConversationLlmThreadState(conversation.llmThreadState);
    let nextActiveAgentId = currentThreadState.activeAgentId;

    if (nextOrderedAgentIds.length === 0) {
      nextActiveAgentId = null;
    }

    if (activeAgentId !== undefined) {
      if (activeAgentId === null) {
        nextActiveAgentId = null;
      } else if (!nextOrderedAgentIds.includes(activeAgentId)) {
        return NextResponse.json({ error: "Choose an agent who is already on this thread" }, { status: 400 });
      } else {
        nextActiveAgentId = activeAgentId;
      }
    } else if (nextActiveAgentId && !nextOrderedAgentIds.includes(nextActiveAgentId)) {
      nextActiveAgentId = null;
    }

    const nextParticipantCount =
      conversation.members.length
      + nextUserIds.length
      + nextAgentIds.length
      - nextRemoveUserIds.length
      - nextRemoveAgentIds.length;

    if (hasParticipantChanges && nextParticipantCount < 2) {
      return NextResponse.json(
        { error: "A thread needs at least one other participant to stay active" },
        { status: 400 }
      );
    }

    if (!hasParticipantChanges && activeAgentId === undefined && !projectAssignmentChanged && !nameChanged) {
      return NextResponse.json({ conversation: serializeConversation(conversation) });
    }

    if (projectId) {
      const project = await prisma.chatProject.findUnique({
        where: { id: projectId },
        select: { id: true },
      });

      if (!project) {
        return NextResponse.json({ error: "Project not found" }, { status: 404 });
      }
    }

    const [users, agents] = await Promise.all([
      prisma.user.findMany({
        where: { id: { in: nextUserIds } },
        select: { id: true },
      }),
      nextAgentIds.length > 0
        ? prisma.aIAgent.findMany({
            where: { id: { in: nextAgentIds } },
            select: { id: true },
          })
        : Promise.resolve([]),
    ]);

    if (users.length !== nextUserIds.length) {
      return NextResponse.json({ error: "One or more selected teammates were not found" }, { status: 400 });
    }

    if (agents.length !== nextAgentIds.length) {
      return NextResponse.json({ error: "One or more selected agents were not found" }, { status: 400 });
    }

    const shouldUpdateLlmThreadState =
      activeAgentId !== undefined
      || currentThreadState.activeAgentId !== nextActiveAgentId;

    await prisma.conversation.update({
      where: { id: conversation.id },
      data: {
        type:
          conversation.type === "direct" && (nextUserIds.length + nextAgentIds.length > 0)
            ? "group"
            : conversation.type,
        ...(requestedName !== undefined ? { name: nextName } : {}),
        updatedAt: new Date(),
        ...(projectId !== undefined ? { chatProjectId: projectId } : {}),
        ...(shouldUpdateLlmThreadState
          ? {
              llmThreadState: serializeConversationLlmThreadState({
                ...currentThreadState,
                activeAgentId: nextActiveAgentId,
              }),
            }
          : {}),
        members: {
          ...(nextRemoveUserIds.length + nextRemoveAgentIds.length > 0
            ? {
                deleteMany: [
                  ...nextRemoveUserIds.map((userId) => ({ userId })),
                  ...nextRemoveAgentIds.map((agentId) => ({ agentId })),
                ],
              }
            : {}),
          create: [
            ...nextUserIds.map((userId) => ({ userId })),
            ...nextAgentIds.map((agentId) => ({ agentId })),
          ],
        },
      },
    });

    const updatedConversation = await getConversationForUser(conversation.id, session.user.id);

    if (!updatedConversation) {
      return NextResponse.json({ error: "Conversation not found" }, { status: 404 });
    }

    return NextResponse.json({ conversation: serializeConversation(updatedConversation) });
  } catch (error) {
    if (isMissingChatTablesError(error)) {
      return NextResponse.json(
        { error: "Team chat is not ready yet. The new chat tables still need to be migrated." },
        { status: 503 }
      );
    }

    console.error("[chat/conversations/:id][PATCH]", error);
    return NextResponse.json({ error: "Failed to update conversation" }, { status: 500 });
  }
}
