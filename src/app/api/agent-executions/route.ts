import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { resolveAgentActionPrompt } from "@/lib/agent-task-context";

export const maxDuration = 300;

const EXECUTION_INCLUDE = {
  agent: { select: { id: true, name: true, role: true, avatar: true, abilities: true } },
  kanbanCard: {
    select: {
      id: true,
      title: true,
      priority: true,
      body: true,
      state: true,
      labels: true,
      githubIssueUrl: true,
      column: { select: { name: true } },
    },
  },
  triggeredBy: { select: { displayName: true, name: true, image: true } },
} as const;

// ── GET /api/agent-executions ─────────────────────────────────────────────────
// Returns all executions, optionally filtered by status or kanbanCardId.

export async function GET(request: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const status = searchParams.get("status");
  const kanbanCardId = searchParams.get("kanbanCardId");

  const executions = await prisma.agentTaskExecution.findMany({
    where: {
      ...(status ? { status } : {}),
      ...(kanbanCardId ? { kanbanCardId } : {}),
    },
    include: EXECUTION_INCLUDE,
    orderBy: { createdAt: "desc" },
    take: 200,
  });

  return NextResponse.json(executions);
}

// ── POST /api/agent-executions ────────────────────────────────────────────────
// Creates a new execution, returns immediately, and finishes the LLM work in
// the background so the request itself does not hit provider or proxy timeouts.

export async function POST(request: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json() as {
    kanbanCardId?: string;
    agentId?: string;
    actionType?: string;
    notes?: string;
  };

  const { kanbanCardId, agentId, actionType, notes } = body;

  if (!kanbanCardId || !agentId || !actionType) {
    return NextResponse.json({ error: "kanbanCardId, agentId, and actionType are required" }, { status: 400 });
  }

  // Verify card and agent exist
  const [card, agent] = await Promise.all([
    prisma.kanbanCard.findUnique({ where: { id: kanbanCardId }, select: { id: true, title: true } }),
    prisma.aIAgent.findUnique({
      where: { id: agentId },
      select: {
        id: true, name: true, role: true, description: true,
        persona: true, duties: true,
        abilities: true,
        llmEndpointUrl: true, llmUsername: true, llmPassword: true,
        llmModel: true, llmThinkingMode: true,
      },
    }),
  ]);

  if (!card) return NextResponse.json({ error: "Card not found" }, { status: 404 });
  if (!agent) return NextResponse.json({ error: "Agent not found" }, { status: 404 });
  if (!resolveAgentActionPrompt(actionType, agent.abilities)) {
    return NextResponse.json({ error: "Invalid actionType for selected agent" }, { status: 400 });
  }

  // Create the execution record (in-process)
  const execution = await prisma.agentTaskExecution.create({
    data: {
      kanbanCardId,
      agentId,
      actionType,
      status: "in-process",
      notes: notes ?? null,
      triggeredById: session.user.id,
    },
  });

  return NextResponse.json(
    await prisma.agentTaskExecution.findUnique({
      where: { id: execution.id },
      include: EXECUTION_INCLUDE,
    }),
    { status: 202 }
  );
}
