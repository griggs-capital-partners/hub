import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { buildAgentRuntimePreview, probeAgentLlm } from "@/lib/agent-llm";
import { buildOrgContext } from "@/lib/agent-context";
import { getConversationForUser, isMissingChatTablesError } from "@/lib/chat";
import { prisma } from "@/lib/prisma";

function buildReadiness(llmStatus: string, llmLastError: string | null) {
  if (llmStatus === "online") {
    return {
      phase: "ready" as const,
      canSend: true,
      label: "Ready",
      detail: "The agent is initialized and ready for chat.",
    };
  }

  if (llmStatus === "offline") {
    return {
      phase: "offline" as const,
      canSend: false,
      label: "Offline",
      detail: llmLastError || "The configured model endpoint could not be reached.",
    };
  }

  return {
    phase: "disconnected" as const,
    canSend: false,
    label: "Not connected",
    detail: "This agent does not have an LLM endpoint configured yet.",
  };
}

export async function GET(
  _request: Request,
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

    const agentMember = conversation.type === "direct"
      ? conversation.members.find((member) => member.agentId)
      : null;

    const agent = agentMember?.agent ?? null;

    if (!agent) {
      return NextResponse.json({ error: "Inspector is only available for direct agent chats" }, { status: 400 });
    }

    const recentMessages = await prisma.chatMessage.findMany({
      where: { conversationId: conversation.id },
      include: {
        senderUser: {
          select: {
            id: true,
            name: true,
            displayName: true,
          },
        },
        senderAgent: {
          select: {
            id: true,
            name: true,
          },
        },
      },
      orderBy: { createdAt: "desc" },
      take: 12,
    });

    const [llmHealth, orgContext, senderUser] = await Promise.all([
      probeAgentLlm(agent),
      buildOrgContext(),
      prisma.user.findUnique({
        where: { id: session.user.id },
        select: { displayName: true, name: true },
      }),
    ]);

    await prisma.aIAgent.update({
      where: { id: agent.id },
      data: {
        llmStatus: llmHealth.llmStatus,
        llmModel: llmHealth.llmModel,
        llmLastCheckedAt: llmHealth.llmLastCheckedAt,
        llmLastError: llmHealth.llmLastError,
      },
    });

    const currentUserName = senderUser?.displayName || senderUser?.name || null;
    const history = recentMessages.reverse().map((entry) => ({
      role: entry.senderAgentId ? ("assistant" as const) : ("user" as const),
      content: entry.body,
    }));
    const runtimePreview = buildAgentRuntimePreview({
      ...agent,
      orgContext,
      currentUserName,
      history,
    });

    return NextResponse.json({
      conversationId: conversation.id,
      readiness: buildReadiness(llmHealth.llmStatus, llmHealth.llmLastError),
      agent: {
        id: agent.id,
        name: agent.name,
        role: agent.role,
        status: agent.status,
        llmStatus: llmHealth.llmStatus,
        llmModel: llmHealth.llmModel ?? agent.llmModel ?? null,
        llmThinkingMode: agent.llmThinkingMode,
        llmLastCheckedAt: llmHealth.llmLastCheckedAt?.toISOString() ?? agent.llmLastCheckedAt?.toISOString() ?? null,
        llmLastError: llmHealth.llmLastError,
        endpointConfigured: Boolean(agent.llmEndpointUrl?.trim()),
      },
      context: {
        estimatedTokens: runtimePreview.estimatedTokens,
        estimatedSystemPromptTokens: runtimePreview.estimatedSystemPromptTokens,
        estimatedHistoryTokens: runtimePreview.estimatedHistoryTokens,
        recentHistoryCount: runtimePreview.recentHistoryCount,
        historyWindowSize: 12,
        knowledgeSources: runtimePreview.knowledgeSources,
      },
      payload: {
        currentUserName,
        systemPrompt: runtimePreview.systemPrompt,
        history: runtimePreview.history,
        orgContext,
      },
    });
  } catch (error) {
    if (isMissingChatTablesError(error)) {
      return NextResponse.json(
        { error: "Team chat is not ready yet. The new chat tables still need to be migrated." },
        { status: 503 }
      );
    }

    console.error("[chat/conversations/inspect][GET]", error);
    return NextResponse.json({ error: "Failed to inspect agent chat context" }, { status: 500 });
  }
}
