import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { AgentsDashboard } from "@/components/team/AgentsDashboard";
import type { ExecutionRecord } from "@/components/agents/AgentExecutionBoard";

export const dynamic = "force-dynamic";

export default async function AgentsPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  const [agents, rawExecutions] = await Promise.all([
    prisma.aIAgent.findMany({
      include: {
        sprintTasks: {
          where: { status: { not: "done" } },
          orderBy: { position: "asc" },
          // Omit description — can be long and is not needed in the agent list panel
          select: { id: true, title: true, status: true, priority: true, createdAt: true, updatedAt: true },
        },
        createdBy: { select: { displayName: true, name: true } },
      },
      orderBy: { createdAt: "asc" },
    }),
    prisma.agentTaskExecution.findMany({
      include: {
        // Omit abilities — large JSON blob repeated per execution; resolved client-side
        // from default ability list (covers all built-in types). Fetched on-demand in drawer.
        agent: { select: { id: true, name: true, role: true, avatar: true } },
        // Omit response and kanbanCard.body — fetched on-demand in detail drawer
        kanbanCard: { select: { id: true, title: true, priority: true, state: true, labels: true, githubIssueUrl: true } },
        triggeredBy: { select: { displayName: true, name: true, image: true } },
      },
      orderBy: { createdAt: "desc" },
      take: 50,
    }),
  ]);

  const serialized = agents.map((agent) => ({
    id: agent.id,
    name: agent.name,
    role: agent.role,
    description: agent.description,
    avatar: agent.avatar,
    status: agent.status,
    llmStatus: agent.llmStatus,
    llmModel: agent.llmModel,
    llmLastCheckedAt: agent.llmLastCheckedAt?.toISOString() ?? null,
    createdAt: agent.createdAt.toISOString(),
    createdBy: agent.createdBy.displayName || agent.createdBy.name || "Unknown",
    sprintTasks: agent.sprintTasks.map((task) => ({
      id: task.id,
      title: task.title,
      description: null, // stripped — not needed in the agent list view
      status: task.status,
      priority: task.priority,
      createdAt: task.createdAt.toISOString(),
      updatedAt: task.updatedAt.toISOString(),
    })),
  }));

  const executions: ExecutionRecord[] = rawExecutions.map((e) => ({
    id: e.id,
    kanbanCardId: e.kanbanCardId,
    agentId: e.agentId,
    actionType: e.actionType,
    status: e.status,
    response: null,        // stripped — fetched on-demand in detail drawer
    errorMessage: e.errorMessage,
    modelUsed: e.modelUsed,
    notes: e.notes,
    createdAt: e.createdAt.toISOString(),
    updatedAt: e.updatedAt.toISOString(),
    agent: { ...e.agent, abilities: null }, // abilities stripped — large JSON, fetched on-demand
    kanbanCard: { ...e.kanbanCard, body: null }, // body stripped — fetched on-demand
    triggeredBy: e.triggeredBy
      ? { displayName: e.triggeredBy.displayName, name: e.triggeredBy.name, image: e.triggeredBy.image }
      : null,
  }));

  return <AgentsDashboard agents={serialized} initialExecutions={executions} />;
}
