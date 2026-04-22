import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { buildAgentRuntimePreview, probeAgentLlm } from "@/lib/agent-llm";
import {
  buildExecutionTargetRuntimeConfig,
  getPublicAgentLlmCatalog,
  getPublicConversationLlmState,
  hasAgentLlmConnection,
  normalizeAgentLlmConfig,
  normalizeConversationLlmThreadState,
  reconcileConversationLlmThreadState,
  resolveThreadExecutionTarget,
  serializeConversationLlmThreadState,
} from "@/lib/agent-llm-config";
import { buildOrgContext } from "@/lib/agent-context";
import { getConversationForUser, isMissingChatTablesError, resolveConversationAgentMember } from "@/lib/chat";
import { resolveConversationContextBundle } from "@/lib/conversation-context";
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

    const agentMember = resolveConversationAgentMember(conversation);

    const agent = agentMember?.agent ?? null;

    if (!agent) {
      return NextResponse.json({ error: "Inspector is only available for threads with an agent participant" }, { status: 400 });
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
    const llmConfig = normalizeAgentLlmConfig(agent.llmConfig, {
      llmEndpointUrl: agent.llmEndpointUrl,
      llmUsername: agent.llmUsername,
      llmPassword: agent.llmPassword,
      llmModel: agent.llmModel,
      llmThinkingMode: agent.llmThinkingMode,
    });
    const storedThreadLlmState = normalizeConversationLlmThreadState(conversation.llmThreadState);
    const threadLlmState = reconcileConversationLlmThreadState(llmConfig, storedThreadLlmState);
    const threadExecutionTarget = resolveThreadExecutionTarget(llmConfig, threadLlmState);
    const shouldPersistThreadLlmState =
      serializeConversationLlmThreadState(threadLlmState) !== serializeConversationLlmThreadState(storedThreadLlmState);

    const [llmHealth, orgContext, contextBundle, senderUser] = await Promise.all([
      probeAgentLlm(threadExecutionTarget ? buildExecutionTargetRuntimeConfig(threadExecutionTarget) : agent),
      buildOrgContext(),
      resolveConversationContextBundle({ conversationId: conversation.id }),
      prisma.user.findUnique({
        where: { id: session.user.id },
        select: { displayName: true, name: true },
      }),
    ]);

    await Promise.all([
      prisma.aIAgent.update({
        where: { id: agent.id },
        data: {
          llmStatus: llmHealth.llmStatus,
          llmModel: llmHealth.llmModel,
          llmLastCheckedAt: llmHealth.llmLastCheckedAt,
          llmLastError: llmHealth.llmLastError,
        },
      }),
      shouldPersistThreadLlmState
        ? prisma.conversation.update({
            where: { id: conversation.id },
            data: {
              llmThreadState: serializeConversationLlmThreadState(threadLlmState),
              updatedAt: new Date(),
            },
          })
        : Promise.resolve(null),
    ]);

    const currentUserName = senderUser?.displayName || senderUser?.name || null;
    const history = recentMessages.reverse().map((entry) => ({
      role: entry.senderAgentId ? ("assistant" as const) : ("user" as const),
      content: entry.body,
    }));
    const runtimePreview = buildAgentRuntimePreview({
      ...agent,
      orgContext: [orgContext, contextBundle.text].filter(Boolean).join("\n\n"),
      contextSources: contextBundle.summarySources,
      resolvedSources: contextBundle.sources,
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
        endpointConfigured: hasAgentLlmConnection(llmConfig) || Boolean(agent.llmEndpointUrl?.trim()),
      },
      threadLlm: {
        ...getPublicConversationLlmState(threadLlmState),
        availableModels: getPublicAgentLlmCatalog(llmConfig),
        autoRoute: llmConfig.routing.autoRoute,
        allowUserOverride: llmConfig.routing.allowUserOverride,
        allowEscalation: llmConfig.routing.allowEscalation,
      },
      context: {
        estimatedTokens: runtimePreview.estimatedTokens,
        estimatedSystemPromptTokens: runtimePreview.estimatedSystemPromptTokens,
        estimatedHistoryTokens: runtimePreview.estimatedHistoryTokens,
        recentHistoryCount: runtimePreview.recentHistoryCount,
        historyWindowSize: 12,
        knowledgeSources: runtimePreview.knowledgeSources,
        resolvedSources: contextBundle.sources,
      },
      payload: {
        currentUserName,
        systemPrompt: runtimePreview.systemPrompt,
        history: runtimePreview.history,
        orgContext,
        resolvedContextText: contextBundle.text,
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
