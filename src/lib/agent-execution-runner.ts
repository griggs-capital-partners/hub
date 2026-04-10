import { prisma } from "@/lib/prisma";
import { buildTaskContext, formatTaskContextForLlm, resolveAgentActionLabel, resolveAgentActionPrompt } from "@/lib/agent-task-context";
import { buildOrgContext } from "@/lib/agent-context";
import { notifyAgentExecutionEmail } from "@/lib/agent-execution-email";
import { notifyAgentExecutionStatus } from "@/lib/web-push";
import { probeAgentLlm, streamAgentReply } from "@/lib/agent-llm";

type RunAgentExecutionArgs = {
  executionId: string;
  currentUserName: string | null;
};

const PROCESSING_LOCK_PREFIX = "__processing__:";
const PROCESSING_LOCK_STALE_MS = 2 * 60_000;

const EXECUTION_INCLUDE = {
  agent: {
    select: {
      id: true,
      name: true,
      role: true,
      avatar: true,
      description: true,
      persona: true,
      duties: true,
      llmEndpointUrl: true,
      llmUsername: true,
      llmPassword: true,
      llmModel: true,
      llmThinkingMode: true,
      abilities: true,
      llmStatus: true,
      llmLastCheckedAt: true,
      llmLastError: true,
    },
  },
  kanbanCard: { select: { id: true, title: true, priority: true } },
  triggeredBy: { select: { displayName: true, name: true, image: true } },
} as const;

function formatExecutionError(error: unknown) {
  if (!(error instanceof Error)) return "Unknown error";
  if (error.name === "TimeoutError" || error.name === "AbortError") {
    return "The agent request took too long and was cancelled. Try a faster model, reduce the task context, or increase the LLM timeout.";
  }
  return error.message;
}

export async function runAgentExecution({ executionId, currentUserName }: RunAgentExecutionArgs) {
  console.log("[agent-execution] run started", { executionId });
  const execution = await prisma.agentTaskExecution.findUnique({
    where: { id: executionId },
    include: EXECUTION_INCLUDE,
  });

  if (!execution) {
    return;
  }

  try {
    const actionPrompt = resolveAgentActionPrompt(execution.actionType, execution.agent.abilities);
    if (!actionPrompt) {
      throw new Error(`Invalid actionType: ${execution.actionType}`);
    }

    const agent = execution.agent;
    const llmRecentlyChecked =
      agent.llmStatus === "online" &&
      agent.llmLastCheckedAt instanceof Date &&
      Date.now() - agent.llmLastCheckedAt.getTime() < 60_000;

    console.log("[agent-execution] checking llm health", {
      executionId,
      agentId: agent.id,
      llmRecentlyChecked,
      endpointConfigured: Boolean(agent.llmEndpointUrl?.trim()),
      model: agent.llmModel ?? null,
    });

    const llmHealth = llmRecentlyChecked
      ? {
          llmStatus: agent.llmStatus,
          llmModel: agent.llmModel,
          llmLastCheckedAt: agent.llmLastCheckedAt,
          llmLastError: agent.llmLastError,
        }
      : await probeAgentLlm(agent);

    console.log("[agent-execution] llm health resolved", {
      executionId,
      llmStatus: llmHealth.llmStatus,
      llmModel: llmHealth.llmModel,
      llmLastError: llmHealth.llmLastError,
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

    console.log("[agent-execution] building task and org context", {
      executionId,
      kanbanCardId: execution.kanbanCardId,
    });
    const [taskCtx, orgContext] = await Promise.all([
      buildTaskContext(execution.kanbanCardId),
      buildOrgContext(),
    ]);
    console.log("[agent-execution] context built", {
      executionId,
      taskTitle: taskCtx.task.title,
      customerCount: taskCtx.customers.length,
      repoCount: taskCtx.linkedRepos.length,
      orgContextLength: orgContext.length,
    });

    const taskContextFormatted = formatTaskContextForLlm(taskCtx);
    const userMessage = [
      actionPrompt,
      execution.notes?.trim() ? `\nAdditional context from the team:\n${execution.notes.trim()}` : "",
      `\n\n---\n\n${taskContextFormatted}`,
    ]
      .filter(Boolean)
      .join("");

    let finalContent = "";
    let resolvedModel = llmHealth.llmModel ?? agent.llmModel ?? null;
    let sawFirstDelta = false;

    console.log("[agent-execution] starting llm stream", {
      executionId,
      model: llmHealth.llmModel ?? agent.llmModel ?? null,
      promptLength: userMessage.length,
    });

    for await (const event of streamAgentReply({
      ...agent,
      llmModel: llmHealth.llmModel ?? agent.llmModel,
      orgContext,
      currentUserName,
      history: [{ role: "user", content: userMessage }],
      enableThinking: false,
    })) {
      if (event.type === "content_delta") {
        if (!sawFirstDelta) {
          sawFirstDelta = true;
          console.log("[agent-execution] first content delta", { executionId });
        }
        finalContent += event.delta;
      } else if (event.type === "done") {
        resolvedModel = event.model;
        console.log("[agent-execution] llm stream done", {
          executionId,
          model: event.model,
        });
      }
    }

    const trimmedContent = finalContent.trim();
    if (!trimmedContent) {
      throw new Error("The LLM returned an empty response");
    }

    const updated = await prisma.agentTaskExecution.update({
      where: { id: execution.id },
      data: {
        status: "completed",
        contextJson: JSON.stringify(taskCtx),
        prompt: userMessage,
        response: trimmedContent,
        errorMessage: null,
        modelUsed: resolvedModel,
      },
      include: {
        agent: { select: { id: true, name: true, role: true, avatar: true, abilities: true } },
        kanbanCard: { select: { id: true, title: true, priority: true } },
        triggeredBy: { select: { displayName: true, name: true, image: true } },
      },
    });
    console.log("[agent-execution] run completed", {
      executionId,
      status: updated.status,
      modelUsed: resolvedModel,
      responseLength: trimmedContent.length,
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

    if (updated.triggeredById) {
      try {
        await Promise.all([
          notifyAgentExecutionStatus({
            userId: updated.triggeredById,
            executionId: updated.id,
            agentName: updated.agent.name,
            actionLabel: resolveAgentActionLabel(updated.actionType, execution.agent.abilities),
            cardTitle: updated.kanbanCard.title,
            status: "completed",
          }),
          notifyAgentExecutionEmail(updated.id),
        ]);
      } catch (error) {
        console.error("Failed to send agent execution notification", { executionId: updated.id, error });
      }
    }
  } catch (error) {
    const message = formatExecutionError(error);
    console.error("[agent-execution] run failed", { executionId, message });

    const existing = await prisma.agentTaskExecution.findUnique({
      where: { id: executionId },
      include: {
        agent: { select: { id: true, name: true, role: true, avatar: true, abilities: true } },
        kanbanCard: { select: { id: true, title: true, priority: true } },
        triggeredBy: { select: { displayName: true, name: true, image: true } },
      },
    });

    if (!existing) {
      return;
    }

    await prisma.aIAgent.update({
      where: { id: existing.agentId },
      data: {
        llmStatus: "offline",
        llmLastCheckedAt: new Date(),
        llmLastError: message,
      },
    });

    const updated = await prisma.agentTaskExecution.update({
      where: { id: executionId },
      data: {
        status: "failed",
        errorMessage: message,
      },
      include: {
        agent: { select: { id: true, name: true, role: true, avatar: true } },
        kanbanCard: { select: { id: true, title: true, priority: true } },
        triggeredBy: { select: { displayName: true, name: true, image: true } },
      },
    });

    if (updated.triggeredById) {
      try {
        await Promise.all([
          notifyAgentExecutionStatus({
            userId: updated.triggeredById,
            executionId: updated.id,
            agentName: updated.agent.name,
            actionLabel: resolveAgentActionLabel(updated.actionType, existing.agent.abilities ?? null),
            cardTitle: updated.kanbanCard.title,
            status: "failed",
          }),
          notifyAgentExecutionEmail(updated.id),
        ]);
      } catch (notifyError) {
        console.error("Failed to send agent execution failure notification", { executionId: updated.id, error: notifyError });
      }
    }
  }
}

export async function claimAgentExecutionForProcessing(executionId: string) {
  const lockToken = `${PROCESSING_LOCK_PREFIX}${Date.now()}:${Math.random().toString(36).slice(2)}`;
  const staleCutoff = new Date(Date.now() - PROCESSING_LOCK_STALE_MS);

  const claimed = await prisma.agentTaskExecution.updateMany({
    where: {
      id: executionId,
      status: "in-process",
      OR: [
        { errorMessage: null },
        { errorMessage: { not: { startsWith: PROCESSING_LOCK_PREFIX } } },
        { updatedAt: { lt: staleCutoff } },
      ],
    },
    data: {
      errorMessage: lockToken,
    },
  });

  console.log("[agent-execution] claim attempted", {
    executionId,
    claimed: claimed.count > 0,
  });

  return claimed.count > 0;
}

export async function processAgentExecution(args: RunAgentExecutionArgs) {
  const claimed = await claimAgentExecutionForProcessing(args.executionId);
  if (!claimed) {
    return false;
  }

  await runAgentExecution(args);
  return true;
}
