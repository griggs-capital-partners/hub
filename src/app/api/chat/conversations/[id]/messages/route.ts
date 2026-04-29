import { NextResponse } from "next/server";
import type { Prisma } from "@prisma/client";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import {
  buildAgentRuntimePreview,
  generateAgentReply,
  probeAgentLlm,
  resolveThinkingMode,
  streamAgentReply,
} from "@/lib/agent-llm";
import { CHAT_HISTORY_MESSAGE_WINDOW } from "@/lib/chat-runtime-budgets";
import {
  applyResolvedThreadModel,
  buildExecutionTargetRuntimeConfig,
  normalizeAgentLlmConfig,
  planConversationLlmSelection,
  serializeConversationLlmThreadState,
} from "@/lib/agent-llm-config";
import { agentChatTools, executeAgentTool } from "@/lib/agent-tools";
import { buildOrgContext } from "@/lib/agent-context";
import {
  type TeamChatConversationAccessSnapshot,
  getConversationForMessagesRoute,
  getReadableConversationForUser,
  getTeamChatConversationAccessSnapshot,
  isMissingChatTablesError,
  listMessagesForConversation,
  reconcileMessagesRouteAccessWithReadableConversation,
  resolveMessagesRouteAccessGate,
  resolveConversationRuntimeState,
  serializeConversation,
} from "@/lib/chat";
import type { LlmMessage } from "@/lib/agent-llm";
import { resolveAgentLlmRoutingPolicy } from "@/lib/agent-task-context";
import { resolveConversationContextBundle } from "@/lib/conversation-context";
import {
  TEAM_CHAT_MESSAGES_ROUTE,
  TEAM_CHAT_ROUTE_DIAGNOSTIC_VERSION,
  buildTeamChatMessagesRouteTopMarker,
  logTeamChatDetailRouteDiagnostics,
  resolveTeamChatConversationRouteParams,
} from "@/lib/chat-route-diagnostics";
import {
  describeUnknownRuntimeError,
  getSanitizedDatabaseTarget,
  summarizeAgentLlmConnections,
} from "@/lib/runtime-diagnostics";
import {
  buildTruthfulExecutionClaimSnapshot,
  enforceTruthfulExecutionClaims,
  renderTruthfulExecutionClaimContext,
  shouldUseBufferedTruthfulExecutionResponse,
  type TruthfulExecutionClaimSnapshot,
} from "@/lib/truthful-execution-claim-guard";
import { upsertTruthfulExecutionRegistryCandidates } from "@/lib/capability-gap-context-debt-registry";

export const dynamic = "force-dynamic";

const TEAM_CHAT_NO_STORE_HEADERS = {
  "Cache-Control": "no-store",
  Vary: "Cookie",
};

type CreatedChatMessage = Prisma.ChatMessageGetPayload<{
  include: {
    senderUser: {
      select: {
        id: true;
        name: true;
        displayName: true;
        image: true;
      };
    };
    senderAgent: {
      select: {
        id: true;
        name: true;
        avatar: true;
      };
    };
  };
}>;

function serializeCreatedMessage(entry: {
  id: string;
  body: string;
  createdAt: Date;
  senderUser: { id: string; name: string | null; displayName: string | null; image: string | null } | null;
  senderAgent: { id: string; name: string; avatar: string | null } | null;
}) {
  return {
    id: entry.id,
    body: entry.body,
    createdAt: entry.createdAt.toISOString(),
    sender: entry.senderUser
      ? {
          kind: "user" as const,
          id: entry.senderUser.id,
          name: entry.senderUser.displayName || entry.senderUser.name || "Unknown user",
          image: entry.senderUser.image,
        }
      : entry.senderAgent
        ? {
            kind: "agent" as const,
            id: entry.senderAgent.id,
            name: entry.senderAgent.name,
            image: entry.senderAgent.avatar,
          }
        : null,
  };
}

function normalizeAgentExecutionConfig(agent: {
  llmConfig?: string | null;
  llmEndpointUrl?: string | null;
  llmUsername?: string | null;
  llmPassword?: string | null;
  llmModel?: string | null;
  llmThinkingMode?: string | null;
}) {
  return normalizeAgentLlmConfig(agent.llmConfig, {
    llmEndpointUrl: agent.llmEndpointUrl,
    llmUsername: agent.llmUsername,
    llmPassword: agent.llmPassword,
    llmModel: agent.llmModel,
    llmThinkingMode: agent.llmThinkingMode,
  });
}

type RuntimeSnapshot = {
  context: {
    estimatedTokens: number;
    estimatedSystemPromptTokens: number;
    estimatedHistoryTokens: number;
    recentHistoryCount: number;
    historyWindowSize: number;
    knowledgeSources: ReturnType<typeof buildAgentRuntimePreview>["knowledgeSources"];
    sourceSelection: Awaited<ReturnType<typeof resolveConversationContextBundle>>["sourceSelection"];
    sourceDecisions: Awaited<ReturnType<typeof resolveConversationContextBundle>>["sourceDecisions"];
    resolvedSources: Awaited<ReturnType<typeof resolveConversationContextBundle>>["sources"];
    documentChunking: Awaited<ReturnType<typeof resolveConversationContextBundle>>["documentChunking"];
    documentIntelligence: Awaited<ReturnType<typeof resolveConversationContextBundle>>["documentIntelligence"];
    agentControl: Awaited<ReturnType<typeof resolveConversationContextBundle>>["agentControl"];
    asyncAgentWork: Awaited<ReturnType<typeof resolveConversationContextBundle>>["asyncAgentWork"];
    debugTrace: Awaited<ReturnType<typeof resolveConversationContextBundle>>["debugTrace"];
    truthfulExecutionClaims: TruthfulExecutionClaimSnapshot;
  };
  payload: {
    currentUserName: string | null;
    systemPrompt: string;
    history: Array<{
      role: LlmMessage["role"];
      content: string | null;
    }>;
    orgContext: string;
    resolvedContextText: string;
  };
};

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

function renderRuntimeContextWarning(
  contextError: RuntimeErrorDescription | null
) {
  if (!contextError) return "";

  return [
    "Runtime context warning:",
    "The thread context resolver was unavailable for this turn.",
    `Reason: ${contextError.message}`,
    "Do not claim that thread documents, source memories, or retrieved context were inspected for this response.",
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
      "[chat/messages][runtime-prep-degraded]",
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

function isLlmRuntimeFailureStage(stage: string) {
  return stage === "llm_health" || stage === "llm_stream" || stage === "llm_generate";
}

function formatRuntimeFailureStage(stage: string) {
  return stage.replace(/_/g, " ");
}

function serializeRuntimeHistory(history: LlmMessage[]) {
  return history.map((entry) => ({
    role: entry.role,
    content: entry.content,
  }));
}

function logMessagesRouteTopMarker(params: {
  conversationId: string;
  sessionUserId: string | null;
  sessionUserEmail: string | null;
  paramsIdResolved: boolean;
}) {
  const marker = buildTeamChatMessagesRouteTopMarker(params);
  console.info(
    "[chat/messages][GET][top-marker]",
    JSON.stringify(marker)
  );

  return marker.routeTopMarkerReached;
}

type MessagesAccessLogSnapshot = Pick<
  TeamChatConversationAccessSnapshot,
  | "conversationExists"
  | "archivedAt"
  | "projectId"
  | "activeMembershipCountForUser"
  | "userMembershipRemovedAt"
  | "messageCount"
  | "readable"
  | "status"
  | "accessStatus"
  | "notFoundReason"
  | "readableHelperPassed"
  | "postHelperLookupFailed"
>;

function buildMessagesAccessLogPayload(params: {
  conversationId: string;
  sessionUserId: string;
  sessionUserEmail: string | null;
  access: MessagesAccessLogSnapshot;
  routeTopMarkerReached: boolean;
  paramsIdResolved: boolean;
  conversationLookupSource?: string;
  readableSnapshotFallbackPassed?: boolean;
  notFoundReason?: string | null;
  serializationFailed?: boolean;
  errorName?: string | null;
  errorMessage?: string | null;
}) {
  return {
    dbTarget: getSanitizedDatabaseTarget(),
    route: TEAM_CHAT_MESSAGES_ROUTE,
    diagnosticVersion: TEAM_CHAT_ROUTE_DIAGNOSTIC_VERSION,
    conversationId: params.conversationId,
    sessionUserId: params.sessionUserId,
    sessionUserEmail: params.sessionUserEmail,
    conversationExists: params.access.conversationExists,
    archivedAt: params.access.archivedAt,
    projectId: params.access.projectId,
    activeMembershipCountForUser: params.access.activeMembershipCountForUser,
    userMembershipRemovedAt: params.access.userMembershipRemovedAt,
    messageCount: params.access.messageCount,
    accessStatus: params.access.accessStatus ?? params.access.status,
    readable: params.access.readable,
    notFoundReason: params.notFoundReason ?? params.access.notFoundReason,
    readableHelperPassed: params.access.readableHelperPassed,
    postHelperLookupFailed: params.access.postHelperLookupFailed,
    routeTopMarkerReached: params.routeTopMarkerReached,
    routeHandlerTopMarkerReached: params.routeTopMarkerReached,
    paramsIdResolved: params.paramsIdResolved,
    conversationLookupSource: params.conversationLookupSource ?? null,
    readableSnapshotFallbackPassed: params.readableSnapshotFallbackPassed ?? false,
    serializationFailed: params.serializationFailed ?? false,
    sourceRouteFile: "src/app/api/chat/conversations/[id]/messages/route.ts",
    routeHandlerMarker: "messages-route-parity-v1",
    ...(params.errorName ? { errorName: params.errorName } : {}),
    ...(params.errorMessage ? { errorMessage: params.errorMessage } : {}),
  };
}

function buildRuntimeSnapshot(params: {
  runtimePreview: ReturnType<typeof buildAgentRuntimePreview>;
  sourceSelection: Awaited<ReturnType<typeof resolveConversationContextBundle>>["sourceSelection"];
  sourceDecisions: Awaited<ReturnType<typeof resolveConversationContextBundle>>["sourceDecisions"];
  resolvedSources: Awaited<ReturnType<typeof resolveConversationContextBundle>>["sources"];
  documentChunking: Awaited<ReturnType<typeof resolveConversationContextBundle>>["documentChunking"];
  documentIntelligence: Awaited<ReturnType<typeof resolveConversationContextBundle>>["documentIntelligence"];
  agentControl: Awaited<ReturnType<typeof resolveConversationContextBundle>>["agentControl"];
  asyncAgentWork: Awaited<ReturnType<typeof resolveConversationContextBundle>>["asyncAgentWork"];
  debugTrace: Awaited<ReturnType<typeof resolveConversationContextBundle>>["debugTrace"];
  truthfulExecutionClaims: TruthfulExecutionClaimSnapshot;
  currentUserName: string | null;
  history: LlmMessage[];
  orgContext: string;
  resolvedContextText: string;
}): RuntimeSnapshot {
  return {
    context: {
      estimatedTokens: params.runtimePreview.estimatedTokens,
      estimatedSystemPromptTokens: params.runtimePreview.estimatedSystemPromptTokens,
      estimatedHistoryTokens: params.runtimePreview.estimatedHistoryTokens,
      recentHistoryCount: params.runtimePreview.recentHistoryCount,
      historyWindowSize: CHAT_HISTORY_MESSAGE_WINDOW,
      knowledgeSources: params.runtimePreview.knowledgeSources,
      sourceSelection: params.sourceSelection,
      sourceDecisions: params.sourceDecisions,
      resolvedSources: params.resolvedSources,
      documentChunking: params.documentChunking,
      documentIntelligence: params.documentIntelligence,
      agentControl: params.agentControl,
      asyncAgentWork: params.asyncAgentWork,
      debugTrace: params.debugTrace,
      truthfulExecutionClaims: params.truthfulExecutionClaims,
    },
    payload: {
      currentUserName: params.currentUserName,
      systemPrompt: params.runtimePreview.systemPrompt,
      history: serializeRuntimeHistory(params.history),
      orgContext: params.orgContext,
      resolvedContextText: params.resolvedContextText,
    },
  };
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id, paramsIdResolved } = await resolveTeamChatConversationRouteParams(params);
  const routeTopMarkerReached = logMessagesRouteTopMarker({
    conversationId: id,
    sessionUserId: null,
    sessionUserEmail: null,
    paramsIdResolved,
  });
  const session = await auth();

  if (!session?.user?.id) {
    return NextResponse.json(
      { error: "Unauthorized" },
      { status: 401, headers: TEAM_CHAT_NO_STORE_HEADERS }
    );
  }

  try {
    const [accessSnapshotRaw, conversation] = await Promise.all([
      getTeamChatConversationAccessSnapshot({
        conversationId: id,
        sessionUserId: session.user.id,
      }),
      getConversationForMessagesRoute(id),
    ]);

    const accessGate = resolveMessagesRouteAccessGate({
      accessSnapshot: accessSnapshotRaw,
      directConversation: conversation,
      sessionUserId: session.user.id,
    });
    const conversationReadable = accessGate.directConversationReadable;
    const accessSnapshot = reconcileMessagesRouteAccessWithReadableConversation({
      accessSnapshot: accessSnapshotRaw,
      readableConversation: accessGate.conversation,
      sessionUserId: session.user.id,
    });
    if (!conversation || !conversationReadable || !accessSnapshotRaw.readable) {
      console.info(
        "[chat/messages][GET][access_lookup]",
        JSON.stringify({
          dbTarget: getSanitizedDatabaseTarget(),
          route: TEAM_CHAT_MESSAGES_ROUTE,
          diagnosticVersion: TEAM_CHAT_ROUTE_DIAGNOSTIC_VERSION,
          conversationId: id,
          sessionUserId: session.user.id,
          sessionUserEmail: session.user.email ?? null,
          accessSnapshotReadable: accessSnapshotRaw.readable,
          accessSnapshotStatus: accessSnapshotRaw.status,
          directConversationFound: Boolean(conversation),
          directConversationReadable: conversationReadable,
          conversationLookupSource: "access_snapshot_authorized_direct_lookup",
          notFoundReason: accessSnapshotRaw.notFoundReason,
        })
      );
    }
    const accessDiagnostic = await logTeamChatDetailRouteDiagnostics({
      route: TEAM_CHAT_MESSAGES_ROUTE,
      session: {
        userId: session.user.id,
        email: session.user.email ?? null,
      },
      conversationId: id,
      accessFound: Boolean(conversation),
      accessSnapshot,
      readableHelperPassed: accessSnapshot.readableHelperPassed,
      postHelperLookupFailed: false,
      routeTopMarkerReached,
      paramsIdResolved,
      notFoundReason: accessSnapshot.notFoundReason,
      sourceRouteFile: "src/app/api/chat/conversations/[id]/messages/route.ts",
      routeHandlerMarker: "messages-route-parity-v1",
    });

    if (accessGate.status === "not_found") {
      const diagnostic = buildMessagesAccessLogPayload({
        conversationId: id,
        sessionUserId: session.user.id,
        sessionUserEmail: session.user.email ?? null,
        access: accessSnapshot,
        routeTopMarkerReached,
        paramsIdResolved,
        notFoundReason:
          accessGate.notFoundReason ??
          accessSnapshot.notFoundReason ??
          accessDiagnostic.notFoundReason,
      });
      console.warn(
        "[chat/messages][GET][not_found]",
        JSON.stringify(diagnostic)
      );
      return NextResponse.json(
        { error: "Conversation not found", diagnostic },
        { status: 404, headers: TEAM_CHAT_NO_STORE_HEADERS }
      );
    }

    if (accessGate.status === "lookup_mismatch") {
      const diagnostic = buildMessagesAccessLogPayload({
        conversationId: id,
        sessionUserId: session.user.id,
        sessionUserEmail: session.user.email ?? null,
        access: accessSnapshot,
        routeTopMarkerReached,
        paramsIdResolved,
        conversationLookupSource: "access_snapshot_authorized_direct_lookup",
        notFoundReason: accessGate.notFoundReason,
      });
      console.error(
        "[chat/messages][GET][readable_route_lookup_mismatch]",
        JSON.stringify({
          ...diagnostic,
          accessSnapshotReadable: accessSnapshotRaw.readable,
          directConversationFound: Boolean(conversation),
          directConversationReadable: conversationReadable,
        })
      );
      return NextResponse.json(
        { error: "Readable conversation could not be loaded by the messages route", diagnostic },
        { status: accessGate.httpStatus, headers: TEAM_CHAT_NO_STORE_HEADERS }
      );
    }

    const readableConversation = accessGate.conversation;
    if (!readableConversation) {
      const diagnostic = buildMessagesAccessLogPayload({
        conversationId: id,
        sessionUserId: session.user.id,
        sessionUserEmail: session.user.email ?? null,
        access: accessSnapshot,
        routeTopMarkerReached,
        paramsIdResolved,
        conversationLookupSource: "access_snapshot_authorized_direct_lookup",
        notFoundReason: "readable_route_lookup_mismatch",
      });
      console.error(
        "[chat/messages][GET][readable_route_lookup_mismatch]",
        JSON.stringify(diagnostic)
      );
      return NextResponse.json(
        { error: "Readable conversation could not be loaded by the messages route", diagnostic },
        { status: 500, headers: TEAM_CHAT_NO_STORE_HEADERS }
      );
    }

    let messages: Awaited<ReturnType<typeof listMessagesForConversation>>;
    try {
      messages = await listMessagesForConversation(readableConversation.id);
    } catch (error) {
      const failureAccess = {
        ...accessSnapshot,
        postHelperLookupFailed: true,
      };
      const failureDiagnostic = await logTeamChatDetailRouteDiagnostics({
        route: TEAM_CHAT_MESSAGES_ROUTE,
        session: {
          userId: session.user.id,
          email: session.user.email ?? null,
        },
        conversationId: id,
        accessFound: true,
        accessSnapshot: failureAccess,
        readableHelperPassed: true,
        postHelperLookupFailed: true,
        routeTopMarkerReached,
        paramsIdResolved,
        notFoundReason: "post_helper_message_query_failed",
        sourceRouteFile: "src/app/api/chat/conversations/[id]/messages/route.ts",
        routeHandlerMarker: "messages-route-parity-v1",
      });
      const diagnostic = buildMessagesAccessLogPayload({
        conversationId: id,
        sessionUserId: session.user.id,
        sessionUserEmail: session.user.email ?? null,
        access: {
          ...failureAccess,
          messageCount: failureDiagnostic.messageCount,
        },
        routeTopMarkerReached,
        paramsIdResolved,
        notFoundReason: "post_helper_message_query_failed",
        errorName: error instanceof Error ? error.name : "UnknownError",
        errorMessage: error instanceof Error ? error.message : String(error),
      });

      console.error(
        "[chat/messages][GET][post_helper_message_query_failed]",
        JSON.stringify(diagnostic)
      );

      return NextResponse.json(
        { error: "Failed to load conversation messages", diagnostic },
        { status: 500, headers: TEAM_CHAT_NO_STORE_HEADERS }
      );
    }

    let serializedConversation: ReturnType<typeof serializeConversation>;
    try {
      serializedConversation = serializeConversation(readableConversation);
    } catch (error) {
      const serializationAccess = {
        ...accessSnapshot,
        messageCount: messages.length,
      };
      await logTeamChatDetailRouteDiagnostics({
        route: TEAM_CHAT_MESSAGES_ROUTE,
        session: {
          userId: session.user.id,
          email: session.user.email ?? null,
        },
        conversationId: id,
        accessFound: true,
        accessSnapshot: serializationAccess,
        readableHelperPassed: true,
        postHelperLookupFailed: false,
        routeTopMarkerReached,
        paramsIdResolved,
        serializationFailed: true,
        notFoundReason: "message_serialization_failed",
        sourceRouteFile: "src/app/api/chat/conversations/[id]/messages/route.ts",
        routeHandlerMarker: "messages-route-parity-v1",
      });
      const diagnostic = buildMessagesAccessLogPayload({
        conversationId: id,
        sessionUserId: session.user.id,
        sessionUserEmail: session.user.email ?? null,
        access: serializationAccess,
        routeTopMarkerReached,
        paramsIdResolved,
        serializationFailed: true,
        notFoundReason: "message_serialization_failed",
        errorName: error instanceof Error ? error.name : "UnknownError",
        errorMessage: error instanceof Error ? error.message : String(error),
      });

      console.error(
        "[chat/messages][GET][serialization_failed]",
        JSON.stringify(diagnostic)
      );

      return NextResponse.json(
        { error: "Failed to serialize conversation messages", diagnostic },
        { status: 500, headers: TEAM_CHAT_NO_STORE_HEADERS }
      );
    }

    if (messages.length === 0) {
      const runtimeState = resolveConversationRuntimeState(readableConversation);
      const activeAgent = runtimeState.activeAgentMember?.agent ?? null;

      console.warn(
        "[chat/messages][GET][empty]",
        JSON.stringify({
          dbTarget: getSanitizedDatabaseTarget(),
          conversationId: readableConversation.id,
          sessionUserId: session.user.id,
          sessionUserEmail: session.user.email ?? null,
          activeMembershipCount: runtimeState.activeMembers.length,
          activeUserCount: runtimeState.activeUserIds.length,
          activeAgentCount: runtimeState.activeAgentIds.length,
          activeAgentId: activeAgent?.id ?? null,
          activeAgentName: activeAgent?.name ?? null,
          activeAgentLlmConnections: activeAgent
            ? summarizeAgentLlmConnections(activeAgent.llmConfig, {
                llmEndpointUrl: activeAgent.llmEndpointUrl,
                llmUsername: activeAgent.llmUsername,
                llmPassword: activeAgent.llmPassword,
                llmModel: activeAgent.llmModel,
                llmThinkingMode: activeAgent.llmThinkingMode,
              })
            : [],
          conversationUpdatedAt: readableConversation.updatedAt.toISOString(),
          conversationCreatedAt: readableConversation.createdAt.toISOString(),
          latestConversationMessageId: readableConversation.messages[0]?.id ?? null,
        })
      );
    }
    return NextResponse.json(
      {
        conversation: serializedConversation,
        messages,
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

    console.error(
      "[chat/messages][GET]",
      JSON.stringify({
        dbTarget: getSanitizedDatabaseTarget(),
        route: TEAM_CHAT_MESSAGES_ROUTE,
        diagnosticVersion: TEAM_CHAT_ROUTE_DIAGNOSTIC_VERSION,
        conversationId: id,
        sessionUserId: session.user.id,
        sessionUserEmail: session.user.email ?? null,
        routeTopMarkerReached,
        routeHandlerTopMarkerReached: routeTopMarkerReached,
        paramsIdResolved,
        errorName: error instanceof Error ? error.name : "UnknownError",
        errorMessage: error instanceof Error ? error.message : String(error),
      })
    );
    return NextResponse.json(
      { error: "Failed to load conversation messages" },
      { status: 500, headers: TEAM_CHAT_NO_STORE_HEADERS }
    );
  }
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { id } = await params;
    const conversation = await getReadableConversationForUser(id, session.user.id);

    if (!conversation) {
      return NextResponse.json({ error: "Conversation not found" }, { status: 404 });
    }

    const body = await request.json();
    const message = typeof body?.message === "string" ? body.message.trim() : "";
    const stream = body?.stream === true;
    if (!message) {
      return NextResponse.json({ error: "message is required" }, { status: 400 });
    }

    const userMessage = await prisma.chatMessage.create({
      data: {
        conversationId: conversation.id,
        senderUserId: session.user.id,
        body: message,
      },
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
    });

    const runtimeState = resolveConversationRuntimeState(conversation);
    const agentMember = runtimeState.activeAgentMember;
    const agent = agentMember?.agent ?? null;

    if (stream && agent) {
      const encoder = new TextEncoder();

      const responseStream = new ReadableStream({
        async start(controller) {
          const writeEvent = (payload: unknown) => {
            controller.enqueue(encoder.encode(`${JSON.stringify(payload)}\n`));
          };
          let retrievalSources: Awaited<ReturnType<typeof resolveConversationContextBundle>>["sources"] = [];
          let truthfulExecutionClaims: TruthfulExecutionClaimSnapshot | null = null;
          let selectedTargetSummary: {
            connectionId: string;
            provider: string;
            model: string | null;
            region: string | null;
          } | null = null;
          let failureStage = "message_history";

          try {
            const recentMessages = await prisma.chatMessage.findMany({
              where: { conversationId: conversation.id },
              select: {
                id: true,
                body: true,
                toolContext: true,
                senderUserId: true,
                senderAgentId: true,
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
            const agentConfig = normalizeAgentExecutionConfig(agent);
            const currentThreadLlmState = runtimeState.threadLlmState;
            const threadLlmPlan = planConversationLlmSelection({
              config: agentConfig,
              currentState: currentThreadLlmState,
              message,
              historyCount: recentMessages.length,
              routingPolicy: resolveAgentLlmRoutingPolicy(agent.abilities),
            });
            const selectedTarget = threadLlmPlan.target;
            selectedTargetSummary = selectedTarget
              ? {
                  connectionId: selectedTarget.connectionId,
                  provider: selectedTarget.provider,
                  model: selectedTarget.model,
                  region: selectedTarget.region,
                }
              : null;
            const selectedRuntimeConfig = selectedTarget ? buildExecutionTargetRuntimeConfig(selectedTarget) : null;
            const selectedThinkingMode = selectedTarget?.thinkingMode ?? agent.llmThinkingMode;
            const enableThinking = resolveThinkingMode({ ...agent, llmThinkingMode: selectedThinkingMode }, message);
            writeEvent({ type: "meta", thinking: enableThinking });

            failureStage = "llm_health";
            const llmHealth = await probeAgentLlm(selectedRuntimeConfig ?? agent);
            if (llmHealth.llmStatus !== "online") {
              throw new Error(llmHealth.llmLastError || "LLM brain is offline");
            }

            failureStage = "runtime_context";
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
                currentUserPrompt: message,
                budget: selectedTarget
                  ? {
                      mode: "standard",
                      lookup: {
                        provider: selectedTarget.provider,
                        protocol: selectedTarget.protocol,
                        model: selectedTarget.model,
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
              route: "api/chat/conversations/[id]/messages.POST:stream",
              conversationId: conversation.id,
              agentId: agent.id,
              sessionUserId: session.user.id,
              sessionUserEmail: session.user.email ?? null,
              results: [orgContextResult, contextBundleResult, senderUserResult],
            });
            const orgContext = orgContextResult.value ?? "";
            const contextBundle = contextBundleResult.value;
            retrievalSources = contextBundle?.sources ?? [];
            const currentUserName = senderUserResult.value?.displayName || senderUserResult.value?.name || null;
            const runtimeTruthfulExecutionClaims = contextBundle
              ? buildTruthfulExecutionClaimSnapshot({
                  documentIntelligence: contextBundle.documentIntelligence,
                  agentControl: contextBundle.agentControl,
                  progressiveAssembly: contextBundle.progressiveAssembly,
                  asyncAgentWork: contextBundle.asyncAgentWork,
                  debugTrace: contextBundle.debugTrace,
                })
              : null;
            truthfulExecutionClaims = runtimeTruthfulExecutionClaims;
            if (runtimeTruthfulExecutionClaims) {
              await upsertTruthfulExecutionRegistryCandidates({
                conversationId: conversation.id,
                snapshot: runtimeTruthfulExecutionClaims,
              }).catch((error) => {
                const registryError = describeUnknownRuntimeError(error);
                console.warn(
                  "[chat/messages][truthful-execution-registry]",
                  JSON.stringify({
                    conversationId: conversation.id,
                    agentId: agent.id,
                    errorName: registryError.name,
                    errorMessage: registryError.message,
                  })
                );
              });
            }
            const truthfulExecutionContext = runtimeTruthfulExecutionClaims
              ? renderTruthfulExecutionClaimContext(runtimeTruthfulExecutionClaims)
              : "";
            const bufferExecutionSensitiveResponse = runtimeTruthfulExecutionClaims
              ? shouldUseBufferedTruthfulExecutionResponse({
                  userPrompt: message,
                  snapshot: runtimeTruthfulExecutionClaims,
                  contextText: contextBundle?.text ?? "",
                })
              : false;
            failureStage = "thread_state_persistence";
            await prisma.conversation.update({
              where: { id: conversation.id },
              data: {
                llmThreadState: serializeConversationLlmThreadState(threadLlmPlan.state),
                updatedAt: new Date(),
              },
            });
            failureStage = "agent_status_persistence";
            await prisma.aIAgent.update({
              where: { id: agent.id },
              data: {
                llmStatus: llmHealth.llmStatus,
                llmModel: llmHealth.llmModel,
                llmLastCheckedAt: llmHealth.llmLastCheckedAt,
                llmLastError: llmHealth.llmLastError,
              },
            });

            if (retrievalSources.length > 0) {
              writeEvent({ type: "retrieval", sources: retrievalSources });
            }

            let finalThinking = "";
            let finalContent = "";
            let resolvedModel = llmHealth.llmModel ?? selectedTarget?.model ?? agent.llmModel ?? null;
            let capturedToolContext: LlmMessage[] | null = null;
            let runtimeSnapshot: RuntimeSnapshot | null = null;

            // Filter the tool catalog to only tools this agent has enabled.
            let disabledToolNames: string[] = [];
            try { disabledToolNames = JSON.parse(agent.disabledTools ?? "[]"); } catch { /* keep empty */ }
            const enabledTools = agentChatTools.filter((t) => !disabledToolNames.includes(t.function.name));

            // Build history, expanding tool context from previous turns so the model
            // sees the full tool interaction (tool_calls + tool_results) not just the
            // final assistant reply.
            const history = recentMessages.reverse().flatMap((entry) => {
              if (entry.senderAgentId && entry.toolContext) {
                try {
                  const toolMsgs = JSON.parse(entry.toolContext) as LlmMessage[];
                  return [
                    ...toolMsgs,
                    { role: "assistant" as const, content: entry.body },
                  ];
                } catch { /* fall through to plain entry */ }
              }
              return [{ role: (entry.senderAgentId ? "assistant" : "user") as "assistant" | "user", content: entry.body }];
            });

            const runtimeContextWarning = renderRuntimeContextWarning(contextBundleResult.error);
            const runtimeOrgContext = [
              orgContext,
              contextBundle?.text,
              truthfulExecutionContext,
              runtimeContextWarning,
            ].filter(Boolean).join("\n\n");
            const runtimeConfig = {
              ...agent,
              ...(selectedRuntimeConfig ?? {}),
              llmThinkingMode: selectedThinkingMode,
              orgContext: runtimeOrgContext,
              contextSources: contextBundle?.summarySources ?? [],
              resolvedSources: contextBundle?.sources ?? [],
              currentUserName,
            };
            const runtimePreview = buildAgentRuntimePreview({
              ...runtimeConfig,
              history: history.flatMap((entry) =>
                (entry.role === "user" || entry.role === "assistant") && typeof entry.content === "string"
                  ? [{
                      role: entry.role,
                      content: entry.content,
                    }]
                  : []
              ),
            });
            runtimeSnapshot = contextBundle && runtimeTruthfulExecutionClaims
              ? buildRuntimeSnapshot({
                  runtimePreview,
                  sourceSelection: contextBundle.sourceSelection,
                  sourceDecisions: contextBundle.sourceDecisions,
                  resolvedSources: contextBundle.sources,
                  documentChunking: contextBundle.documentChunking,
                  documentIntelligence: contextBundle.documentIntelligence,
                  agentControl: contextBundle.agentControl,
                  asyncAgentWork: contextBundle.asyncAgentWork,
                  debugTrace: contextBundle.debugTrace,
                  truthfulExecutionClaims: runtimeTruthfulExecutionClaims,
                  currentUserName,
                  history,
                  orgContext: runtimeOrgContext,
                  resolvedContextText: contextBundle.text,
                })
              : null;

            failureStage = "llm_stream";
            for await (const event of streamAgentReply({
              ...runtimeConfig,
              enableThinking,
              tools: enabledTools,
              executeTool: executeAgentTool,
              history,
            })) {
              if (event.type === "thinking_delta") {
                finalThinking += event.delta;
                if (!bufferExecutionSensitiveResponse) {
                  writeEvent(event);
                }
              } else if (event.type === "content_delta") {
                finalContent += event.delta;
                if (!bufferExecutionSensitiveResponse) {
                  writeEvent(event);
                }
              } else if (event.type === "done") {
                resolvedModel = event.model;
                if (!bufferExecutionSensitiveResponse) {
                  writeEvent(event);
                }
              } else if (event.type === "tool_call" || event.type === "tool_result") {
                if (!bufferExecutionSensitiveResponse) {
                  writeEvent(event);
                }
              } else if (event.type === "tool_context") {
                capturedToolContext = event.messages;
              }
            }

            const trimmedContent = finalContent.trim();
            if (!trimmedContent) {
              throw new Error("The LLM returned an empty response");
            }
            failureStage = "truthfulness_guard";
            const guarded = truthfulExecutionClaims
              ? enforceTruthfulExecutionClaims(trimmedContent, truthfulExecutionClaims)
              : { answer: trimmedContent, validation: { ok: true, violations: [] } };
            if (!guarded.validation.ok) {
              console.warn(
                "[chat/messages][truthful-execution-guard]",
                JSON.stringify({
                  conversationId: conversation.id,
                  agentId: agent.id,
                  mode: bufferExecutionSensitiveResponse ? "buffer_then_guard" : "post_stream_guard",
                  violations: guarded.validation.violations,
                })
              );
            }

            if (bufferExecutionSensitiveResponse) {
              writeEvent({ type: "content_delta", delta: guarded.answer });
              writeEvent({ type: "done", model: resolvedModel ?? agent.llmModel ?? "unknown" });
            }

            failureStage = "agent_message_persistence";
            const agentMessage = await prisma.chatMessage.create({
              data: {
                conversationId: conversation.id,
                senderAgentId: agent.id,
                body: guarded.answer,
                toolContext: capturedToolContext ? JSON.stringify(capturedToolContext) : undefined,
              },
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
            });

            failureStage = "agent_status_persistence";
            await prisma.aIAgent.update({
              where: { id: agent.id },
              data: {
                llmStatus: "online",
                llmModel: resolvedModel,
                llmLastCheckedAt: new Date(),
                llmLastError: null,
              },
            });

            const resolvedThreadState = applyResolvedThreadModel(threadLlmPlan.state, resolvedModel);
            failureStage = "thread_state_persistence";
            await prisma.conversation.update({
              where: { id: conversation.id },
              data: {
                llmThreadState: serializeConversationLlmThreadState(resolvedThreadState),
                updatedAt: new Date(),
              },
            });

            try {
              writeEvent({
                type: "final_messages",
                messages: [serializeCreatedMessage(userMessage), serializeCreatedMessage(agentMessage)],
                thinking: finalThinking,
                retrievalSources,
                runtimeSnapshot,
              });
            } catch {
              // Stream was cancelled (client disconnected) — nothing to do.
            }
            try { controller.close(); } catch { /* already closed */ }
          } catch (error) {
            const runtimeError = describeUnknownRuntimeError(error);
            const details = runtimeError.message;
            const isLlmFailure = isLlmRuntimeFailureStage(failureStage);
            console.error(
              "[chat/messages][stream] Agent reply error:",
              JSON.stringify({
                conversationId: conversation.id,
                agentId: agent.id,
                agentName: agent.name,
                selectedTarget: selectedTargetSummary,
                failureStage,
                errorName: runtimeError.name,
                errorMessage: details,
              })
            );

            // Each DB operation is wrapped independently so a single failure
            // cannot prevent the subsequent steps from running. The goal is
            // to always emit a final_messages event and close the stream so
            // the client receives a clean response instead of "Something went wrong."
            if (isLlmFailure) {
              try {
                await prisma.aIAgent.update({
                  where: { id: agent.id },
                  data: {
                    llmStatus: "offline",
                    llmLastCheckedAt: new Date(),
                    llmLastError: details,
                  },
                });
              } catch (dbErr) {
                console.error("[chat/messages][stream] Failed to update agent status:", dbErr);
              }
            }

            let fallbackMessage: CreatedChatMessage | null = null;
            const fallbackBody = isLlmFailure
              ? `I couldn't reach my configured LLM brain just now. Please check my endpoint settings and try again.\n\nDetails: ${details}`
              : `I couldn't finish this chat turn because the ${formatRuntimeFailureStage(failureStage)} step failed. Please try again.\n\nDetails: ${details}`;
            try {
              fallbackMessage = await prisma.chatMessage.create({
                data: {
                  conversationId: conversation.id,
                  senderAgentId: agent.id,
                  body: fallbackBody,
                },
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
              });
            } catch (dbErr) {
              console.error("[chat/messages][stream] Failed to create fallback message:", dbErr);
            }

            try {
              await prisma.conversation.update({
                where: { id: conversation.id },
                data: { updatedAt: new Date() },
              });
            } catch (dbErr) {
              console.error("[chat/messages][stream] Failed to update conversation:", dbErr);
            }

            try {
              writeEvent({
                type: "final_messages",
                messages: fallbackMessage
                  ? [serializeCreatedMessage(userMessage), serializeCreatedMessage(fallbackMessage)]
                  : [serializeCreatedMessage(userMessage)],
                error: details,
                errorStage: failureStage,
                retrievalSources,
                runtimeSnapshot,
              });
            } catch {
              // Stream was cancelled (client disconnected) — nothing to do.
            }
            try { controller.close(); } catch { /* already closed */ }
          }
        },
      });

      return new Response(responseStream, {
        headers: {
          "Content-Type": "application/x-ndjson; charset=utf-8",
          "Cache-Control": "no-cache, no-transform",
          Connection: "keep-alive",
        },
      });
    }

    let agentMessage = null;
    let retrievalSources: Awaited<ReturnType<typeof resolveConversationContextBundle>>["sources"] = [];
    let runtimeSnapshot: RuntimeSnapshot | null = null;
    if (agent) {
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

      let agentReply: string;
      const agentConfig = normalizeAgentExecutionConfig(agent);
      const currentThreadLlmState = runtimeState.threadLlmState;
      const threadLlmPlan = planConversationLlmSelection({
        config: agentConfig,
        currentState: currentThreadLlmState,
        message,
        historyCount: recentMessages.length,
        routingPolicy: resolveAgentLlmRoutingPolicy(agent.abilities),
      });
      const selectedTarget = threadLlmPlan.target;
      const selectedTargetSummary = selectedTarget
        ? {
            connectionId: selectedTarget.connectionId,
            provider: selectedTarget.provider,
            model: selectedTarget.model,
            region: selectedTarget.region,
          }
        : null;
      let failureStage = "llm_health";
      try {
        const selectedRuntimeConfig = selectedTarget ? buildExecutionTargetRuntimeConfig(selectedTarget) : null;
        const selectedThinkingMode = selectedTarget?.thinkingMode ?? agent.llmThinkingMode;
        const llmHealth = await probeAgentLlm(selectedRuntimeConfig ?? agent);
        if (llmHealth.llmStatus !== "online") {
          throw new Error(llmHealth.llmLastError || "LLM brain is offline");
        }

        failureStage = "runtime_context";
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
            currentUserPrompt: message,
            budget: selectedTarget
              ? {
                  mode: "standard",
                  lookup: {
                    provider: selectedTarget.provider,
                    protocol: selectedTarget.protocol,
                    model: selectedTarget.model,
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
          route: "api/chat/conversations/[id]/messages.POST",
          conversationId: conversation.id,
          agentId: agent.id,
          sessionUserId: session.user.id,
          sessionUserEmail: session.user.email ?? null,
          results: [orgContextResult, contextBundleResult, senderUserResult],
        });
        const orgContext = orgContextResult.value ?? "";
        const contextBundle = contextBundleResult.value;
        const currentUserName = senderUserResult.value?.displayName || senderUserResult.value?.name || null;
        const truthfulExecutionClaims = contextBundle
          ? buildTruthfulExecutionClaimSnapshot({
              documentIntelligence: contextBundle.documentIntelligence,
              agentControl: contextBundle.agentControl,
              progressiveAssembly: contextBundle.progressiveAssembly,
              asyncAgentWork: contextBundle.asyncAgentWork,
              debugTrace: contextBundle.debugTrace,
            })
          : null;
        if (truthfulExecutionClaims) {
          await upsertTruthfulExecutionRegistryCandidates({
            conversationId: conversation.id,
            snapshot: truthfulExecutionClaims,
          }).catch((error) => {
            const registryError = describeUnknownRuntimeError(error);
            console.warn(
              "[chat/messages][truthful-execution-registry]",
              JSON.stringify({
                conversationId: conversation.id,
                agentId: agent.id,
                errorName: registryError.name,
                errorMessage: registryError.message,
              })
            );
          });
        }
        const truthfulExecutionContext = truthfulExecutionClaims
          ? renderTruthfulExecutionClaimContext(truthfulExecutionClaims)
          : "";
        retrievalSources = contextBundle?.sources ?? [];
        const history: Array<{ role: "user" | "assistant"; content: string }> = recentMessages.reverse().map((entry) => ({
          role: (entry.senderAgentId ? "assistant" : "user") as "assistant" | "user",
          content: entry.body,
        }));
        const runtimeContextWarning = renderRuntimeContextWarning(contextBundleResult.error);
        const runtimeOrgContext = [
          orgContext,
          contextBundle?.text,
          truthfulExecutionContext,
          runtimeContextWarning,
        ].filter(Boolean).join("\n\n");
        const runtimeConfig = {
          ...agent,
          ...(selectedRuntimeConfig ?? {}),
          llmThinkingMode: selectedThinkingMode,
          orgContext: runtimeOrgContext,
          contextSources: contextBundle?.summarySources ?? [],
          resolvedSources: contextBundle?.sources ?? [],
          currentUserName,
        };
        const runtimePreview = buildAgentRuntimePreview({
          ...runtimeConfig,
          history: history.map((entry) => ({
            role: entry.role,
            content: entry.content ?? "",
          })),
        });
        runtimeSnapshot = contextBundle && truthfulExecutionClaims
          ? buildRuntimeSnapshot({
              runtimePreview,
              sourceSelection: contextBundle.sourceSelection,
              sourceDecisions: contextBundle.sourceDecisions,
              resolvedSources: contextBundle.sources,
              documentChunking: contextBundle.documentChunking,
              documentIntelligence: contextBundle.documentIntelligence,
              agentControl: contextBundle.agentControl,
              asyncAgentWork: contextBundle.asyncAgentWork,
              debugTrace: contextBundle.debugTrace,
              truthfulExecutionClaims,
              currentUserName,
              history,
              orgContext: runtimeOrgContext,
              resolvedContextText: contextBundle.text,
            })
          : null;
        failureStage = "thread_state_persistence";
        await prisma.conversation.update({
          where: { id: conversation.id },
          data: {
            llmThreadState: serializeConversationLlmThreadState(threadLlmPlan.state),
            updatedAt: new Date(),
          },
        });
        failureStage = "agent_status_persistence";
        await prisma.aIAgent.update({
          where: { id: agent.id },
          data: {
            llmStatus: llmHealth.llmStatus,
            llmModel: llmHealth.llmModel,
            llmLastCheckedAt: llmHealth.llmLastCheckedAt,
            llmLastError: llmHealth.llmLastError,
          },
        });

        failureStage = "llm_generate";
        const response = await generateAgentReply({
          ...runtimeConfig,
          enableThinking: resolveThinkingMode({ ...agent, llmThinkingMode: selectedThinkingMode }, message),
          history,
        });

        failureStage = "truthfulness_guard";
        const guarded = truthfulExecutionClaims
          ? enforceTruthfulExecutionClaims(response.content, truthfulExecutionClaims)
          : { answer: response.content, validation: { ok: true, violations: [] } };
        if (!guarded.validation.ok) {
          console.warn(
            "[chat/messages][truthful-execution-guard]",
            JSON.stringify({
              conversationId: conversation.id,
              agentId: agent.id,
              violations: guarded.validation.violations,
            })
          );
        }
        agentReply = guarded.answer;

        failureStage = "agent_status_persistence";
        await prisma.aIAgent.update({
          where: { id: agent.id },
          data: {
            llmStatus: "online",
            llmModel: response.model,
            llmLastCheckedAt: new Date(),
            llmLastError: null,
          },
        });
        failureStage = "thread_state_persistence";
        await prisma.conversation.update({
          where: { id: conversation.id },
          data: {
            llmThreadState: serializeConversationLlmThreadState(
              applyResolvedThreadModel(threadLlmPlan.state, response.model)
            ),
            updatedAt: new Date(),
          },
        });
      } catch (error) {
        const runtimeError = describeUnknownRuntimeError(error);
        const details = runtimeError.message;
        const isLlmFailure = isLlmRuntimeFailureStage(failureStage);
        console.error(
          "[chat/messages] Agent reply error:",
          JSON.stringify({
            conversationId: conversation.id,
            agentId: agent.id,
            agentName: agent.name,
            selectedTarget: selectedTargetSummary,
            failureStage,
            errorName: runtimeError.name,
            errorMessage: details,
          })
        );

        if (isLlmFailure) {
          await prisma.aIAgent.update({
            where: { id: agent.id },
            data: {
              llmStatus: "offline",
              llmLastCheckedAt: new Date(),
              llmLastError: details,
            },
          });
        }

        agentReply = isLlmFailure
          ? `I couldn't reach my configured LLM brain just now. Please check my endpoint settings and try again.\n\nDetails: ${details}`
          : `I couldn't finish this chat turn because the ${formatRuntimeFailureStage(failureStage)} step failed. Please try again.\n\nDetails: ${details}`;
      }

      agentMessage = await prisma.chatMessage.create({
        data: {
          conversationId: conversation.id,
          senderAgentId: agent.id,
          body: agentReply,
        },
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
      });
    }

    await prisma.conversation.update({
      where: { id: conversation.id },
      data: {
        ...(agent
          ? {}
          : {
              llmThreadState: serializeConversationLlmThreadState(runtimeState.threadLlmState),
            }),
        updatedAt: new Date(),
      },
    });

    const messages = [userMessage, agentMessage]
      .filter((entry): entry is NonNullable<typeof entry> => entry !== null)
      .map(serializeCreatedMessage);

    return NextResponse.json({ messages, retrievalSources, runtimeSnapshot }, { status: 201 });
  } catch (error) {
    if (isMissingChatTablesError(error)) {
      return NextResponse.json(
        { error: "Team chat is not ready yet. The new chat tables still need to be migrated." },
        { status: 503 }
      );
    }

    throw error;
  }
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { id } = await params;
    const conversation = await getReadableConversationForUser(id, session.user.id);

    if (!conversation) {
      return NextResponse.json({ error: "Conversation not found" }, { status: 404 });
    }

    const isDirectAgentConversation =
      conversation.type === "direct" && conversation.members.some((member) => member.agentId);

    if (!isDirectAgentConversation) {
      return NextResponse.json({ error: "Only direct AI chats can be cleared here" }, { status: 400 });
    }

    await prisma.chatMessage.deleteMany({
      where: { conversationId: conversation.id },
    });

    await prisma.conversation.update({
      where: { id: conversation.id },
      data: { updatedAt: new Date() },
    });

    return NextResponse.json({ ok: true });
  } catch (error) {
    if (isMissingChatTablesError(error)) {
      return NextResponse.json(
        { error: "Team chat is not ready yet. The new chat tables still need to be migrated." },
        { status: 503 }
      );
    }

    console.error("[chat/messages][DELETE]", error);
    return NextResponse.json({ error: "Failed to clear chat history" }, { status: 500 });
  }
}
