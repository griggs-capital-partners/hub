import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { notifyAgentExecutionEmail } from "@/lib/agent-execution-email";
import { prisma } from "@/lib/prisma";
import { resolveAgentActionLabel } from "@/lib/agent-task-context";
import { notifyAgentExecutionStatus } from "@/lib/web-push";

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

// ── GET /api/agent-executions/[id] ────────────────────────────────────────────

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;

  const execution = await prisma.agentTaskExecution.findUnique({
    where: { id },
    include: EXECUTION_INCLUDE,
  });

  if (!execution) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  return NextResponse.json(execution);
}

// ── PATCH /api/agent-executions/[id] ─────────────────────────────────────────
// Allows updating status (e.g. "needs-input", "completed", "failed")
// and optionally a response override.

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const body = await request.json() as {
    status?: string;
    response?: string;
    notes?: string;
  };

  const ALLOWED_STATUSES = ["in-process", "needs-input", "completed", "failed", "archived"];
  if (body.status && !ALLOWED_STATUSES.includes(body.status)) {
    return NextResponse.json({ error: "Invalid status" }, { status: 400 });
  }

  const execution = await prisma.agentTaskExecution.findUnique({ where: { id } });
  if (!execution) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const updated = await prisma.agentTaskExecution.update({
    where: { id },
    data: {
      ...(body.status ? { status: body.status } : {}),
      ...(body.response !== undefined ? { response: body.response } : {}),
      ...(body.notes !== undefined ? { notes: body.notes } : {}),
    },
    include: EXECUTION_INCLUDE,
  });

  if (
    body.status
    && body.status !== execution.status
    && (body.status === "completed" || body.status === "failed")
    && updated.triggeredById
  ) {
    try {
      await Promise.all([
        notifyAgentExecutionStatus({
            userId: updated.triggeredById,
            executionId: updated.id,
            agentName: updated.agent.name,
            actionLabel: resolveAgentActionLabel(updated.actionType, updated.agent.abilities),
            cardTitle: updated.kanbanCard.title,
            status: body.status,
        }),
        notifyAgentExecutionEmail(updated.id),
      ]);
    } catch (error) {
      console.error("Failed to send agent execution status notification", { executionId: updated.id, error });
    }
  }

  return NextResponse.json(updated);
}

// ── DELETE /api/agent-executions/[id] ────────────────────────────────────────

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;

  const execution = await prisma.agentTaskExecution.findUnique({ where: { id } });
  if (!execution) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  await prisma.agentTaskExecution.delete({ where: { id } });
  return new NextResponse(null, { status: 204 });
}
