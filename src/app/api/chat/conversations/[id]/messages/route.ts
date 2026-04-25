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
  getConversationForUser,
  isMissingChatTablesError,
  listMessagesForConversation,
  resolveConversationRuntimeState,
  serializeConversation,
} from "@/lib/chat";
import type { LlmMessage } from "@/lib/agent-llm";
import { resolveAgentLlmRoutingPolicy } from "@/lib/agent-task-context";
import { resolveConversationContextBundle } from "@/lib/conversation-context";
import { logTeamChatDetailRouteDiagnostics } from "@/lib/chat-route-diagnostics";
import {
  getSanitizedDatabaseTarget,
  summarizeAgentLlmConnections,
} from "@/lib/runtime-diagnostics";

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

function serializeRuntimeHistory(history: LlmMessage[]) {
  return history.map((entry) => ({
    role: entry.role,
    content: entry.content,
  }));
}

function buildRuntimeSnapshot(params: {
  runtimePreview: ReturnType<typeof buildAgentRuntimePreview>;
  sourceSelection: Awaited<ReturnType<typeof resolveConversationContextBundle>>["sourceSelection"];
  sourceDecisions: Awaited<ReturnType<typeof resolveConversationContextBundle>>["sourceDecisions"];
  resolvedSources: Awaited<ReturnType<typeof resolveConversationContextBundle>>["sources"];
  documentChunking: Awaited<ReturnType<typeof resolveConversationContextBundle>>["documentChunking"];
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
      route: "api/chat/conversations/[id]/messages.GET",
      session: {
        userId: session.user.id,
        email: session.user.email ?? null,
      },
      conversationId: id,
      accessFound: Boolean(conversation),
    });

    if (!conversation) {
      console.warn(
        "[chat/messages][GET][not_found]",
        JSON.stringify({
          dbTarget: getSanitizedDatabaseTarget(),
          conversationId: id,
          sessionUserId: session.user.id,
          sessionUserEmail: session.user.email ?? null,
        })
      );
      return NextResponse.json(
        { error: "Conversation not found" },
        { status: 404, headers: TEAM_CHAT_NO_STORE_HEADERS }
      );
    }

    const messages = await listMessagesForConversation(conversation.id);
    if (messages.length === 0) {
      const runtimeState = resolveConversationRuntimeState(conversation);
      const activeAgent = runtimeState.activeAgentMember?.agent ?? null;

      console.warn(
        "[chat/messages][GET][empty]",
        JSON.stringify({
          dbTarget: getSanitizedDatabaseTarget(),
          conversationId: conversation.id,
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
          conversationUpdatedAt: conversation.updatedAt.toISOString(),
          conversationCreatedAt: conversation.createdAt.toISOString(),
          latestConversationMessageId: conversation.messages[0]?.id ?? null,
        })
      );
    }
    return NextResponse.json(
      {
        conversation: serializeConversation(conversation),
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
        conversationId: id,
        sessionUserId: session.user.id,
        sessionUserEmail: session.user.email ?? null,
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
    const conversation = await getConversationForUser(id, session.user.id);

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
          let selectedTargetSummary: {
            connectionId: string;
            provider: string;
            model: string | null;
            region: string | null;
          } | null = null;

          try {
            const [recentMessages, orgContext, contextBundle, senderUser] = await Promise.all([
              prisma.chatMessage.findMany({
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
              }),
              buildOrgContext(),
              resolveConversationContextBundle({
                conversationId: conversation.id,
                authority: {
                  requestingUserId: session.user.id,
                  activeUserIds: runtimeState.activeUserIds,
                  activeAgentId: runtimeState.activeAgentMember?.agent.id ?? null,
                  activeAgentIds: runtimeState.activeAgentIds,
                },
                currentUserPrompt: message,
              }),
              prisma.user.findUnique({
                where: { id: session.user.id },
                select: { displayName: true, name: true },
              }),
            ]);
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
            const llmHealth = await probeAgentLlm(selectedTarget ? buildExecutionTargetRuntimeConfig(selectedTarget) : agent);
            retrievalSources = contextBundle.sources;
            const currentUserName = senderUser?.displayName || senderUser?.name || null;
            await prisma.conversation.update({
              where: { id: conversation.id },
              data: {
                llmThreadState: serializeConversationLlmThreadState(threadLlmPlan.state),
                updatedAt: new Date(),
              },
            });
            await prisma.aIAgent.update({
              where: { id: agent.id },
              data: {
                llmStatus: llmHealth.llmStatus,
                llmModel: llmHealth.llmModel,
                llmLastCheckedAt: llmHealth.llmLastCheckedAt,
                llmLastError: llmHealth.llmLastError,
              },
            });

            if (llmHealth.llmStatus !== "online") {
              throw new Error(llmHealth.llmLastError || "LLM brain is offline");
            }
            if (contextBundle.sources.length > 0) {
              writeEvent({ type: "retrieval", sources: contextBundle.sources });
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

            const runtimeOrgContext = [orgContext, contextBundle.text].filter(Boolean).join("\n\n");
            const runtimeConfig = {
              ...agent,
              ...(selectedRuntimeConfig ?? {}),
              llmThinkingMode: selectedThinkingMode,
              orgContext: runtimeOrgContext,
              contextSources: contextBundle.summarySources,
              resolvedSources: contextBundle.sources,
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
            runtimeSnapshot = buildRuntimeSnapshot({
              runtimePreview,
              sourceSelection: contextBundle.sourceSelection,
              sourceDecisions: contextBundle.sourceDecisions,
              resolvedSources: contextBundle.sources,
              documentChunking: contextBundle.documentChunking,
              currentUserName,
              history,
              orgContext,
              resolvedContextText: contextBundle.text,
            });

            for await (const event of streamAgentReply({
              ...runtimeConfig,
              enableThinking,
              tools: enabledTools,
              executeTool: executeAgentTool,
              history,
            })) {
              if (event.type === "thinking_delta") {
                finalThinking += event.delta;
                writeEvent(event);
              } else if (event.type === "content_delta") {
                finalContent += event.delta;
                writeEvent(event);
              } else if (event.type === "done") {
                resolvedModel = event.model;
                writeEvent(event);
              } else if (event.type === "tool_call" || event.type === "tool_result") {
                writeEvent(event);
              } else if (event.type === "tool_context") {
                capturedToolContext = event.messages;
              }
            }

            const trimmedContent = finalContent.trim();
            if (!trimmedContent) {
              throw new Error("The LLM returned an empty response");
            }

            const agentMessage = await prisma.chatMessage.create({
              data: {
                conversationId: conversation.id,
                senderAgentId: agent.id,
                body: trimmedContent,
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
            const details = error instanceof Error ? error.message : "Unable to reach the configured LLM endpoint";
            console.error(
              "[chat/messages][stream] Agent reply error:",
              JSON.stringify({
                conversationId: conversation.id,
                agentId: agent.id,
                agentName: agent.name,
                selectedTarget: selectedTargetSummary,
                error: details,
              })
            );

            // Each DB operation is wrapped independently so a single failure
            // cannot prevent the subsequent steps from running. The goal is
            // to always emit a final_messages event and close the stream so
            // the client receives a clean response instead of "Something went wrong."
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

            let fallbackMessage: CreatedChatMessage | null = null;
            try {
              fallbackMessage = await prisma.chatMessage.create({
                data: {
                  conversationId: conversation.id,
                  senderAgentId: agent.id,
                  body: `I couldn't reach my configured LLM brain just now. Please check my endpoint settings and try again.\n\nDetails: ${details}`,
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
      try {
        const [orgContext, contextBundle, senderUser] = await Promise.all([
          buildOrgContext(),
          resolveConversationContextBundle({
            conversationId: conversation.id,
            authority: {
              requestingUserId: session.user.id,
              activeUserIds: runtimeState.activeUserIds,
              activeAgentId: runtimeState.activeAgentMember?.agent.id ?? null,
              activeAgentIds: runtimeState.activeAgentIds,
            },
            currentUserPrompt: message,
          }),
          prisma.user.findUnique({
            where: { id: session.user.id },
            select: { displayName: true, name: true },
          }),
        ]);
        const selectedRuntimeConfig = selectedTarget ? buildExecutionTargetRuntimeConfig(selectedTarget) : null;
        const selectedThinkingMode = selectedTarget?.thinkingMode ?? agent.llmThinkingMode;
        const llmHealth = await probeAgentLlm(selectedTarget ? buildExecutionTargetRuntimeConfig(selectedTarget) : agent);
        const currentUserName = senderUser?.displayName || senderUser?.name || null;
        retrievalSources = contextBundle.sources;
        const history: Array<{ role: "user" | "assistant"; content: string }> = recentMessages.reverse().map((entry) => ({
          role: (entry.senderAgentId ? "assistant" : "user") as "assistant" | "user",
          content: entry.body,
        }));
        const runtimeOrgContext = [orgContext, contextBundle.text].filter(Boolean).join("\n\n");
        const runtimeConfig = {
          ...agent,
          ...(selectedRuntimeConfig ?? {}),
          llmThinkingMode: selectedThinkingMode,
          orgContext: runtimeOrgContext,
          contextSources: contextBundle.summarySources,
          resolvedSources: contextBundle.sources,
          currentUserName,
        };
        const runtimePreview = buildAgentRuntimePreview({
          ...runtimeConfig,
          history: history.map((entry) => ({
            role: entry.role,
            content: entry.content ?? "",
          })),
        });
        runtimeSnapshot = buildRuntimeSnapshot({
          runtimePreview,
          sourceSelection: contextBundle.sourceSelection,
          sourceDecisions: contextBundle.sourceDecisions,
          resolvedSources: contextBundle.sources,
          documentChunking: contextBundle.documentChunking,
          currentUserName,
          history,
          orgContext,
          resolvedContextText: contextBundle.text,
        });
        await prisma.conversation.update({
          where: { id: conversation.id },
          data: {
            llmThreadState: serializeConversationLlmThreadState(threadLlmPlan.state),
            updatedAt: new Date(),
          },
        });
        await prisma.aIAgent.update({
          where: { id: agent.id },
          data: {
            llmStatus: llmHealth.llmStatus,
            llmModel: llmHealth.llmModel,
            llmLastCheckedAt: llmHealth.llmLastCheckedAt,
            llmLastError: llmHealth.llmLastError,
          },
        });

        if (llmHealth.llmStatus !== "online") {
          throw new Error(llmHealth.llmLastError || "LLM brain is offline");
        }

        const response = await generateAgentReply({
          ...runtimeConfig,
          enableThinking: resolveThinkingMode({ ...agent, llmThinkingMode: selectedThinkingMode }, message),
          history,
        });

        agentReply = response.content;

        await prisma.aIAgent.update({
          where: { id: agent.id },
          data: {
            llmStatus: "online",
            llmModel: response.model,
            llmLastCheckedAt: new Date(),
            llmLastError: null,
          },
        });
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
        const details = error instanceof Error ? error.message : "Unable to reach the configured LLM endpoint";
        console.error(
          "[chat/messages] Agent reply error:",
          JSON.stringify({
            conversationId: conversation.id,
            agentId: agent.id,
            agentName: agent.name,
            selectedTarget: selectedTargetSummary,
            error: details,
          })
        );

        await prisma.aIAgent.update({
          where: { id: agent.id },
          data: {
            llmStatus: "offline",
            llmLastCheckedAt: new Date(),
            llmLastError: details,
          },
        });

        agentReply = `I couldn't reach my configured LLM brain just now. Please check my endpoint settings and try again.\n\nDetails: ${details}`;
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
    const conversation = await getConversationForUser(id, session.user.id);

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
