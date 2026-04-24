import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { buildAgentRuntimePreview, probeAgentLlm } from "@/lib/agent-llm";
import {
  buildExecutionTargetRuntimeConfig,
  getPublicAgentLlmCatalog,
  getPublicConversationLlmState,
  hasAgentLlmConnection,
  normalizeAgentLlmConfig,
  resolveThreadExecutionTarget,
  serializeConversationLlmThreadState,
} from "@/lib/agent-llm-config";
import { buildOrgContext } from "@/lib/agent-context";
import {
  getConversationForUser,
  isMissingChatTablesError,
  resolveConversationRuntimeState,
  serializeConversationActiveMembership,
} from "@/lib/chat";
import { resolveConversationContextBundle } from "@/lib/conversation-context";
import { logTeamChatDetailRouteDiagnostics } from "@/lib/chat-route-diagnostics";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

const TEAM_CHAT_NO_STORE_HEADERS = {
  "Cache-Control": "no-store",
  Vary: "Cookie",
};

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
  const { id } = await params;
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json(
      { error: "Unauthorized" },
      { status: 401, headers: TEAM_CHAT_NO_STORE_HEADERS }
    );
  }

  try {
    const conversation = await getConversationForUser(id, session.user.id);
    await logTeamChatDetailRouteDiagnostics({
      route: "api/chat/conversations/[id]/inspect.GET",
      session: {
        userId: session.user.id,
        email: session.user.email ?? null,
      },
      conversationId: id,
      accessFound: Boolean(conversation),
    });

    if (!conversation) {
      return NextResponse.json(
        { error: "Conversation not found" },
        { status: 404, headers: TEAM_CHAT_NO_STORE_HEADERS }
      );
    }

    const runtimeState = resolveConversationRuntimeState(conversation);
    const membership = serializeConversationActiveMembership(conversation);
    const agentMember = runtimeState.activeAgentMember;
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
    const storedThreadLlmState = runtimeState.storedThreadLlmState;
    const threadLlmState = runtimeState.threadLlmState;
    const threadExecutionTarget = resolveThreadExecutionTarget(llmConfig, threadLlmState);
    const shouldPersistThreadLlmState =
      serializeConversationLlmThreadState(threadLlmState) !== serializeConversationLlmThreadState(storedThreadLlmState);

    const [llmHealth, orgContext, contextBundle, senderUser] = await Promise.all([
      probeAgentLlm(threadExecutionTarget ? buildExecutionTargetRuntimeConfig(threadExecutionTarget) : agent),
      buildOrgContext(),
      resolveConversationContextBundle({
        conversationId: conversation.id,
        authority: {
          requestingUserId: session.user.id,
          activeUserIds: runtimeState.activeUserIds,
          activeAgentId: runtimeState.activeAgentMember?.agent.id ?? null,
          activeAgentIds: runtimeState.activeAgentIds,
        },
      }),
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

    return NextResponse.json(
      {
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
        membership,
        context: {
          estimatedTokens: runtimePreview.estimatedTokens,
          estimatedSystemPromptTokens: runtimePreview.estimatedSystemPromptTokens,
          estimatedHistoryTokens: runtimePreview.estimatedHistoryTokens,
          recentHistoryCount: runtimePreview.recentHistoryCount,
          historyWindowSize: 12,
          knowledgeSources: runtimePreview.knowledgeSources,
          sourceSelection: contextBundle.sourceSelection,
          sourceDecisions: contextBundle.sourceDecisions,
          resolvedSources: contextBundle.sources,
        },
        payload: {
          currentUserName,
          systemPrompt: runtimePreview.systemPrompt,
          history: runtimePreview.history,
          orgContext,
          resolvedContextText: contextBundle.text,
        },
      },
      { headers: TEAM_CHAT_NO_STORE_HEADERS }
    );
  } catch (error) {
    if (isMissingChatTablesError(error)) {
      return NextResponse.json(
        { error: "Team chat is not ready yet. The new chat tables still need to be migrated." },
        { status: 503, headers: TEAM_CHAT_NO_STORE_HEADERS }
      );
    }

    console.error("[chat/conversations/inspect][GET]", error);
    return NextResponse.json(
      { error: "Failed to inspect agent chat context" },
      { status: 500, headers: TEAM_CHAT_NO_STORE_HEADERS }
    );
  }
}
