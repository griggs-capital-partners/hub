import { NextResponse } from "next/server";
import type { Prisma } from "@prisma/client";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { generateAgentReply, probeAgentLlm, resolveThinkingMode, streamAgentReply } from "@/lib/agent-llm";
import {
  applyResolvedThreadModel,
  buildExecutionTargetRuntimeConfig,
  normalizeAgentLlmConfig,
  normalizeConversationLlmThreadState,
  planConversationLlmSelection,
  reconcileConversationLlmThreadState,
  serializeConversationLlmThreadState,
} from "@/lib/agent-llm-config";
import { agentChatTools, executeAgentTool } from "@/lib/agent-tools";
import { buildOrgContext } from "@/lib/agent-context";
import { buildMessageRetrievalContext } from "@/lib/agent-retrieval";
import {
  getConversationForUser,
  isMissingChatTablesError,
  listMessagesForConversation,
  resolveConversationAgentMember,
  serializeConversation,
} from "@/lib/chat";
import type { LlmMessage } from "@/lib/agent-llm";
import { resolveAgentLlmRoutingPolicy } from "@/lib/agent-task-context";

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

    const messages = await listMessagesForConversation(conversation.id);
    return NextResponse.json({
      conversation: serializeConversation(conversation),
      messages,
    });
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

    const agentMember = resolveConversationAgentMember(conversation);

    const agent = agentMember?.agent ?? null;

    if (stream && agent) {
      const encoder = new TextEncoder();

      const responseStream = new ReadableStream({
        async start(controller) {
          const writeEvent = (payload: unknown) => {
            controller.enqueue(encoder.encode(`${JSON.stringify(payload)}\n`));
          };
          let retrievalSources: Awaited<ReturnType<typeof buildMessageRetrievalContext>>["sources"] = [];

          try {
            const [recentMessages, orgContext, retrievedContext, senderUser] = await Promise.all([
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
                take: 12,
              }),
              buildOrgContext(),
              buildMessageRetrievalContext(message),
              prisma.user.findUnique({
                where: { id: session.user.id },
                select: { displayName: true, name: true },
              }),
            ]);
            const agentConfig = normalizeAgentExecutionConfig(agent);
            const currentThreadLlmState = reconcileConversationLlmThreadState(
              agentConfig,
              normalizeConversationLlmThreadState(conversation.llmThreadState)
            );
            const threadLlmPlan = planConversationLlmSelection({
              config: agentConfig,
              currentState: currentThreadLlmState,
              message,
              historyCount: recentMessages.length,
              routingPolicy: resolveAgentLlmRoutingPolicy(agent.abilities),
            });
            const selectedTarget = threadLlmPlan.target;
            const selectedRuntimeConfig = selectedTarget ? buildExecutionTargetRuntimeConfig(selectedTarget) : null;
            const selectedThinkingMode = selectedTarget?.thinkingMode ?? agent.llmThinkingMode;
            const enableThinking = resolveThinkingMode({ ...agent, llmThinkingMode: selectedThinkingMode }, message);
            writeEvent({ type: "meta", thinking: enableThinking });
            const llmHealth = await probeAgentLlm(selectedTarget ? buildExecutionTargetRuntimeConfig(selectedTarget) : agent);
            retrievalSources = retrievedContext.sources;
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
            if (retrievedContext.sources.length > 0) {
              writeEvent({ type: "retrieval", sources: retrievedContext.sources });
            }

            let finalThinking = "";
            let finalContent = "";
            let resolvedModel = llmHealth.llmModel ?? selectedTarget?.model ?? agent.llmModel ?? null;
            let capturedToolContext: LlmMessage[] | null = null;

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

            for await (const event of streamAgentReply({
              ...agent,
              ...(selectedRuntimeConfig ?? {}),
              llmThinkingMode: selectedThinkingMode,
              orgContext: [orgContext, retrievedContext.text].filter(Boolean).join("\n\n"),
              currentUserName,
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
              });
            } catch {
              // Stream was cancelled (client disconnected) — nothing to do.
            }
            try { controller.close(); } catch { /* already closed */ }
          } catch (error) {
            const details = error instanceof Error ? error.message : "Unable to reach the configured LLM endpoint";
            console.error("[chat/messages][stream] Agent reply error:", details);

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
    let retrievalSources: Awaited<ReturnType<typeof buildMessageRetrievalContext>>["sources"] = [];
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
        take: 12,
      });

      let agentReply: string;
      const agentConfig = normalizeAgentExecutionConfig(agent);
      const currentThreadLlmState = reconcileConversationLlmThreadState(
        agentConfig,
        normalizeConversationLlmThreadState(conversation.llmThreadState)
      );
      const threadLlmPlan = planConversationLlmSelection({
        config: agentConfig,
        currentState: currentThreadLlmState,
        message,
        historyCount: recentMessages.length,
        routingPolicy: resolveAgentLlmRoutingPolicy(agent.abilities),
      });
      const selectedTarget = threadLlmPlan.target;
      try {
        const [orgContext, retrievedContext, senderUser] = await Promise.all([
          buildOrgContext(),
          buildMessageRetrievalContext(message),
          prisma.user.findUnique({
            where: { id: session.user.id },
            select: { displayName: true, name: true },
          }),
        ]);
        const selectedRuntimeConfig = selectedTarget ? buildExecutionTargetRuntimeConfig(selectedTarget) : null;
        const selectedThinkingMode = selectedTarget?.thinkingMode ?? agent.llmThinkingMode;
        const llmHealth = await probeAgentLlm(selectedTarget ? buildExecutionTargetRuntimeConfig(selectedTarget) : agent);
        const currentUserName = senderUser?.displayName || senderUser?.name || null;
        retrievalSources = retrievedContext.sources;
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
          ...agent,
          ...(selectedRuntimeConfig ?? {}),
          llmThinkingMode: selectedThinkingMode,
          orgContext: [orgContext, retrievedContext.text].filter(Boolean).join("\n\n"),
          currentUserName,
          enableThinking: resolveThinkingMode({ ...agent, llmThinkingMode: selectedThinkingMode }, message),
          history: recentMessages.reverse().map((entry) => ({
            role: entry.senderAgentId ? "assistant" : "user",
            content: entry.body,
          })),
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
        llmThreadState: serializeConversationLlmThreadState(normalizeConversationLlmThreadState("")),
        updatedAt: new Date(),
      },
    });

    const messages = [userMessage, agentMessage]
      .filter((entry): entry is NonNullable<typeof entry> => entry !== null)
      .map(serializeCreatedMessage);

    return NextResponse.json({ messages, retrievalSources }, { status: 201 });
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
