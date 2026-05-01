import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { buildAgentRuntimePreview, probeAgentLlm } from "@/lib/agent-llm";
import { CHAT_HISTORY_MESSAGE_WINDOW } from "@/lib/chat-runtime-budgets";
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
  getReadableConversationForUser,
  isMissingChatTablesError,
  resolveConversationRuntimeState,
  serializeConversationActiveMembership,
} from "@/lib/chat";
import { resolveConversationContextBundle } from "@/lib/conversation-context";
import { logTeamChatDetailRouteDiagnostics } from "@/lib/chat-route-diagnostics";
import { prisma } from "@/lib/prisma";
import {
  describeUnknownRuntimeError,
  getSanitizedDatabaseTarget,
  summarizeAgentLlmConnections,
} from "@/lib/runtime-diagnostics";
import {
  buildTruthfulExecutionClaimSnapshot,
  renderTruthfulExecutionClaimContext,
} from "@/lib/truthful-execution-claim-guard";
import {
  parseChatMessageRuntimeTraceEnvelope,
} from "@/lib/chat-message-runtime-trace";
import {
  buildNativeRuntimeTraceVerdict,
  inferNativeRuntimeTraceVerdictSelector,
  summarizeNativeRuntimePayloadTraces,
} from "@/lib/native-runtime-payloads";

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

type RuntimeErrorDescription = ReturnType<typeof describeUnknownRuntimeError>;

type OptionalRuntimeValue<T> = {
  label: string;
  value: T | null;
  error: RuntimeErrorDescription | null;
};

async function resolveOptionalRuntimeValue<T>(
  label: string,
  load: () => Promise<T>
): Promise<OptionalRuntimeValue<T>> {
  try {
    return {
      label,
      value: await load(),
      error: null,
    };
  } catch (error) {
    return {
      label,
      value: null,
      error: describeUnknownRuntimeError(error),
    };
  }
}

function renderRuntimeContextWarning(contextError: RuntimeErrorDescription | null) {
  if (!contextError) return "";

  return [
    "Runtime context warning:",
    "The thread context resolver was unavailable for this inspection.",
    `Reason: ${contextError.message}`,
    "Do not claim that thread documents, source memories, or retrieved context were inspected from this diagnostic payload.",
  ].join(" ");
}

function logOptionalRuntimeFailures(params: {
  route: string;
  conversationId: string;
  agentId: string;
  sessionUserId: string;
  sessionUserEmail: string | null;
  results: Array<OptionalRuntimeValue<unknown>>;
}) {
  for (const result of params.results) {
    if (!result.error) continue;

    console.warn(
      "[chat/inspect][GET][runtime-prep-degraded]",
      JSON.stringify({
        dbTarget: getSanitizedDatabaseTarget(),
        route: params.route,
        conversationId: params.conversationId,
        agentId: params.agentId,
        sessionUserId: params.sessionUserId,
        sessionUserEmail: params.sessionUserEmail,
        stage: result.label,
        errorName: result.error.name,
        errorMessage: result.error.message,
      })
    );
  }
}

function buildEmptySourceSelection(): Awaited<ReturnType<typeof resolveConversationContextBundle>>["sourceSelection"] {
  return {
    requestMode: "default",
    consideredSourceIds: [],
    defaultCandidateSourceIds: [],
    explicitUserRequestedSourceIds: [],
    requestedSourceIds: [],
    plannerProposedSourceIds: [],
    policyRequiredSourceIds: [],
    fallbackCandidateSourceIds: [],
    allowedSourceIds: [],
    executedSourceIds: [],
    excludedSourceIds: [],
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
    const conversation = await getReadableConversationForUser(id, session.user.id);
    const accessDiagnostic = await logTeamChatDetailRouteDiagnostics({
      route: "api/chat/conversations/[id]/inspect.GET",
      session: {
        userId: session.user.id,
        email: session.user.email ?? null,
      },
      conversationId: id,
      accessFound: Boolean(conversation),
    });

    if (!conversation) {
      console.warn(
        "[chat/inspect][GET][not_found]",
        JSON.stringify({
          dbTarget: getSanitizedDatabaseTarget(),
          route: accessDiagnostic.route,
          conversationId: id,
          sessionUserId: session.user.id,
          sessionUserEmail: session.user.email ?? null,
          conversationExists: accessDiagnostic.conversationExists,
          archivedAt: accessDiagnostic.archivedAt,
          projectId: accessDiagnostic.projectId,
          activeMembershipCountForUser: accessDiagnostic.activeMembershipCountForUser,
          userMembershipRemovedAt: accessDiagnostic.userMembershipRemovedAt,
          notFoundReason: accessDiagnostic.notFoundReason,
        })
      );
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
      take: CHAT_HISTORY_MESSAGE_WINDOW,
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
    const latestUserPrompt = recentMessages.find((entry) => !entry.senderAgentId)?.body ?? null;
    const endpointConfigured = hasAgentLlmConnection(llmConfig) || Boolean(agent.llmEndpointUrl?.trim());
    const targetRuntimeConfig = threadExecutionTarget ? buildExecutionTargetRuntimeConfig(threadExecutionTarget) : null;
    const llmHealthResult = await resolveOptionalRuntimeValue("llm_health", () =>
      probeAgentLlm(targetRuntimeConfig ?? agent)
    );
    const llmHealth = llmHealthResult.value ?? {
      llmStatus: endpointConfigured ? "offline" : "disconnected",
      llmModel: threadExecutionTarget?.model ?? agent.llmModel ?? null,
      llmLastCheckedAt: new Date(),
      llmLastError: llmHealthResult.error?.message ?? "Unable to reach the configured LLM endpoint",
    };

    const [orgContextResult, contextBundleResult, senderUserResult] = await Promise.all([
      resolveOptionalRuntimeValue("org_context", () => buildOrgContext()),
      resolveOptionalRuntimeValue("conversation_context", () => resolveConversationContextBundle({
        conversationId: conversation.id,
        authority: {
          requestingUserId: session.user.id,
          activeUserIds: runtimeState.activeUserIds,
          activeAgentId: runtimeState.activeAgentMember?.agent.id ?? null,
          activeAgentIds: runtimeState.activeAgentIds,
        },
        currentUserPrompt: latestUserPrompt,
        budget: threadExecutionTarget
          ? {
              mode: "standard",
              lookup: {
                provider: threadExecutionTarget.provider,
                protocol: threadExecutionTarget.protocol,
                model: threadExecutionTarget.model,
              },
            }
          : null,
      })),
      resolveOptionalRuntimeValue("sender_user", () => prisma.user.findUnique({
        where: { id: session.user.id },
        select: { displayName: true, name: true },
      })),
    ]);
    logOptionalRuntimeFailures({
      route: "api/chat/conversations/[id]/inspect.GET",
      conversationId: conversation.id,
      agentId: agent.id,
      sessionUserId: session.user.id,
      sessionUserEmail: session.user.email ?? null,
      results: [llmHealthResult, orgContextResult, contextBundleResult, senderUserResult],
    });

    if (!endpointConfigured || llmHealth.llmStatus !== "online") {
      console.warn(
        "[chat/inspect][GET][not_ready]",
        JSON.stringify({
          dbTarget: getSanitizedDatabaseTarget(),
          conversationId: conversation.id,
          sessionUserId: session.user.id,
          sessionUserEmail: session.user.email ?? null,
          agentId: agent.id,
          agentName: agent.name,
          readiness: buildReadiness(llmHealth.llmStatus, llmHealth.llmLastError),
          llmStatus: llmHealth.llmStatus,
          llmModel: llmHealth.llmModel ?? agent.llmModel ?? null,
          llmLastError: llmHealth.llmLastError,
          llmConnections: summarizeAgentLlmConnections(agent.llmConfig, {
            llmEndpointUrl: agent.llmEndpointUrl,
            llmUsername: agent.llmUsername,
            llmPassword: agent.llmPassword,
            llmModel: agent.llmModel,
            llmThinkingMode: agent.llmThinkingMode,
          }),
        })
      );
    }

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
    ]).catch((error) => {
      const persistError = describeUnknownRuntimeError(error);
      console.warn(
        "[chat/inspect][GET][status-persist-failed]",
        JSON.stringify({
          dbTarget: getSanitizedDatabaseTarget(),
          conversationId: conversation.id,
          sessionUserId: session.user.id,
          sessionUserEmail: session.user.email ?? null,
          agentId: agent.id,
          errorName: persistError.name,
          errorMessage: persistError.message,
        })
      );
    });

    const orgContext = orgContextResult.value ?? "";
    const contextBundle = contextBundleResult.value;
    const latestPersistedNativeRuntimePayloadTrace = recentMessages
      .filter((entry) => Boolean(entry.senderAgentId))
      .map((entry) => parseChatMessageRuntimeTraceEnvelope(entry.toolContext).nativeRuntimePayloadTrace)
      .find((trace) => trace.length > 0) ?? [];
    const nativeRuntimePayloadTrace =
      latestPersistedNativeRuntimePayloadTrace.length > 0
        ? latestPersistedNativeRuntimePayloadTrace
        : contextBundle?.progressiveAssembly?.contextTransport?.nativeRuntimePayloadTraces ?? [];
    const nativeRuntimeTraceSelector = inferNativeRuntimeTraceVerdictSelector({
      prompt: latestUserPrompt,
      traces: nativeRuntimePayloadTrace,
      providerTarget: threadExecutionTarget?.provider ?? null,
      modelTarget: threadExecutionTarget?.model ?? llmHealth.llmModel ?? null,
    });
    const nativeRuntimeTraceCheck = buildNativeRuntimeTraceVerdict({
      traces: nativeRuntimePayloadTrace,
      selector: nativeRuntimeTraceSelector,
    });
    const currentUserName = senderUserResult.value?.displayName || senderUserResult.value?.name || null;
    const history = recentMessages.reverse().map((entry) => ({
      role: entry.senderAgentId ? ("assistant" as const) : ("user" as const),
      content: entry.body,
    }));
    const truthfulExecutionClaims = contextBundle
      ? buildTruthfulExecutionClaimSnapshot({
          documentIntelligence: contextBundle.documentIntelligence,
          agentControl: contextBundle.agentControl,
          progressiveAssembly: contextBundle.progressiveAssembly,
          asyncAgentWork: contextBundle.asyncAgentWork,
          debugTrace: contextBundle.debugTrace,
          nativeRuntimePayloadTrace,
          nativeRuntimeTraceVerdictSelector: nativeRuntimeTraceSelector,
        })
      : null;
    const truthfulExecutionContext = truthfulExecutionClaims
      ? renderTruthfulExecutionClaimContext(truthfulExecutionClaims)
      : "";
    const contextFailureSource = contextBundleResult.error
      ? [{
          kind: "runtime-context",
          label: "Runtime context",
          target: "conversation_context",
          status: "failed" as const,
          domain: "thread",
          scope: "thread",
          detail: `Context preparation failed: ${contextBundleResult.error.message}`,
        }]
      : [];
    const runtimeContextWarning = renderRuntimeContextWarning(contextBundleResult.error);
    const runtimeOrgContext = [
      orgContext,
      contextBundle?.text,
      truthfulExecutionContext,
      runtimeContextWarning,
    ].filter(Boolean).join("\n\n");
    const runtimePreview = buildAgentRuntimePreview({
      ...agent,
      ...(targetRuntimeConfig ?? {}),
      llmThinkingMode: threadExecutionTarget?.thinkingMode ?? agent.llmThinkingMode,
      orgContext: runtimeOrgContext,
      contextSources: contextBundle?.summarySources ?? [],
      resolvedSources: contextBundle?.sources ?? contextFailureSource,
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
          endpointConfigured,
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
          historyWindowSize: CHAT_HISTORY_MESSAGE_WINDOW,
          knowledgeSources: runtimePreview.knowledgeSources,
          sourceSelection: contextBundle?.sourceSelection ?? buildEmptySourceSelection(),
          sourceDecisions: contextBundle?.sourceDecisions ?? [],
          resolvedSources: contextBundle?.sources ?? contextFailureSource,
          documentChunking: contextBundle?.documentChunking ?? null,
          documentIntelligence: contextBundle?.documentIntelligence ?? null,
          agentControl: contextBundle?.agentControl ?? null,
          asyncAgentWork: contextBundle?.asyncAgentWork ?? null,
          capabilityGapApprovals: contextBundle?.capabilityGapApprovals ?? null,
          truthfulExecutionClaims,
          nativeRuntimePayloadTrace,
          nativeRuntimeLaneSummary: summarizeNativeRuntimePayloadTraces(nativeRuntimePayloadTrace),
          nativeRuntimeTraceCheck,
          nativeRuntimeTraceSource:
            latestPersistedNativeRuntimePayloadTrace.length > 0 ? "latest_agent_message_tool_context" : "pre_runtime_context",
          debugTrace: contextBundle?.debugTrace ?? null,
        },
        payload: {
          currentUserName,
          systemPrompt: runtimePreview.systemPrompt,
          history: runtimePreview.history,
          orgContext: runtimeOrgContext,
          resolvedContextText: contextBundle?.text ?? "",
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

    const runtimeError = describeUnknownRuntimeError(error);
    console.error(
      "[chat/inspect][GET]",
      JSON.stringify({
        dbTarget: getSanitizedDatabaseTarget(),
        conversationId: id,
        sessionUserId: session.user.id,
        sessionUserEmail: session.user.email ?? null,
        errorName: runtimeError.name,
        errorMessage: runtimeError.message,
      })
    );
    return NextResponse.json(
      { error: "Failed to inspect agent chat context" },
      { status: 500, headers: TEAM_CHAT_NO_STORE_HEADERS }
    );
  }
}
