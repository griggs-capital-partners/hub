import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import {
  getConversationForUser,
  isMissingChatTablesError,
  planConversationMembershipMutation,
  serializeConversation,
  toConversationMembershipRecord,
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
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;
    const conversation = await getConversationForUser(id, session.user.id, { memberScope: "all" });

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

    if (removeUserIds.includes(session.user.id)) {
      return NextResponse.json({ error: "You cannot remove yourself from a thread yet" }, { status: 400 });
    }

    const currentThreadState = normalizeConversationLlmThreadState(conversation.llmThreadState);
    const membershipPlan = planConversationMembershipMutation({
      members: conversation.members.map(toConversationMembershipRecord),
      currentUserId: session.user.id,
      addUserIds,
      addAgentIds,
      removeUserIds,
      removeAgentIds,
      requestedActiveAgentId: activeAgentId,
      currentPinnedActiveAgentId: currentThreadState.activeAgentId,
    });
    const nextName = requestedName === undefined ? conversation.name : requestedName;
    const projectAssignmentChanged = projectId !== undefined && conversation.chatProjectId !== projectId;
    const nameChanged = requestedName !== undefined && (conversation.name ?? null) !== nextName;

    if (membershipPlan.invalidRequestedActiveAgentId) {
      return NextResponse.json({ error: "Choose an agent who is already on this thread" }, { status: 400 });
    }

    if (membershipPlan.hasParticipantChanges && membershipPlan.nextParticipantCount < 2) {
      return NextResponse.json(
        { error: "A thread needs at least one other participant to stay active" },
        { status: 400 }
      );
    }

    if (!membershipPlan.hasParticipantChanges && activeAgentId === undefined && !projectAssignmentChanged && !nameChanged) {
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
      membershipPlan.createUserIds.length > 0
        ? prisma.user.findMany({
            where: { id: { in: membershipPlan.createUserIds } },
            select: { id: true },
          })
        : Promise.resolve([]),
      membershipPlan.createAgentIds.length > 0
        ? prisma.aIAgent.findMany({
            where: { id: { in: membershipPlan.createAgentIds } },
            select: { id: true },
          })
        : Promise.resolve([]),
    ]);

    if (users.length !== membershipPlan.createUserIds.length) {
      return NextResponse.json({ error: "One or more selected teammates were not found" }, { status: 400 });
    }

    if (agents.length !== membershipPlan.createAgentIds.length) {
      return NextResponse.json({ error: "One or more selected agents were not found" }, { status: 400 });
    }

    const shouldUpdateLlmThreadState =
      activeAgentId !== undefined
      || currentThreadState.activeAgentId !== membershipPlan.nextPinnedActiveAgentId;
    const now = new Date();

    await prisma.$transaction(async (tx) => {
      await tx.conversation.update({
        where: { id: conversation.id },
        data: {
          type:
            conversation.type === "direct" && membershipPlan.nextParticipantCount > 2
              ? "group"
              : conversation.type,
          ...(requestedName !== undefined ? { name: nextName } : {}),
          updatedAt: now,
          ...(projectId !== undefined ? { chatProjectId: projectId } : {}),
          ...(shouldUpdateLlmThreadState
            ? {
                llmThreadState: serializeConversationLlmThreadState({
                  ...currentThreadState,
                  activeAgentId: membershipPlan.nextPinnedActiveAgentId,
                }),
              }
            : {}),
        },
      });

      if (membershipPlan.removeUserMemberIds.length > 0) {
        await tx.conversationMember.updateMany({
          where: {
            conversationId: conversation.id,
            id: { in: membershipPlan.removeUserMemberIds },
          },
          data: { removedAt: now },
        });
      }

      if (membershipPlan.removeAgentMemberIds.length > 0) {
        await tx.conversationMember.updateMany({
          where: {
            conversationId: conversation.id,
            id: { in: membershipPlan.removeAgentMemberIds },
          },
          data: { removedAt: now },
        });
      }

      if (membershipPlan.reactivateUserMemberIds.length > 0) {
        await tx.conversationMember.updateMany({
          where: {
            conversationId: conversation.id,
            id: { in: membershipPlan.reactivateUserMemberIds },
          },
          data: { removedAt: null },
        });
      }

      if (membershipPlan.reactivateAgentMemberIds.length > 0) {
        await tx.conversationMember.updateMany({
          where: {
            conversationId: conversation.id,
            id: { in: membershipPlan.reactivateAgentMemberIds },
          },
          data: { removedAt: null },
        });
      }

      const createMembers = [
        ...membershipPlan.createUserIds.map((userId) => ({
          conversationId: conversation.id,
          userId,
        })),
        ...membershipPlan.createAgentIds.map((agentId) => ({
          conversationId: conversation.id,
          agentId,
        })),
      ];

      if (createMembers.length > 0) {
        await tx.conversationMember.createMany({
          data: createMembers,
        });
      }
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
