import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { processAgentExecution } from "@/lib/agent-execution-runner";

export const maxDuration = 300;

export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  console.log("[agent-execution/process] request received", {
    executionId: id,
    userId: session.user.id,
  });

  const existing = await prisma.agentTaskExecution.findUnique({
    where: { id },
    select: { id: true, status: true },
  });

  if (!existing) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  if (existing.status !== "in-process") {
    console.log("[agent-execution/process] skipped", {
      executionId: id,
      reason: "not-in-process",
      status: existing.status,
    });
    return NextResponse.json({ ok: true, skipped: true, reason: "not-in-process" });
  }

  const started = await processAgentExecution({
    executionId: id,
    currentUserName: session.user.name ?? null,
  });
  console.log("[agent-execution/process] processAgentExecution returned", {
    executionId: id,
    started,
  });

  const updated = await prisma.agentTaskExecution.findUnique({
    where: { id },
    select: {
      id: true,
      status: true,
      errorMessage: true,
      response: true,
      updatedAt: true,
    },
  });

  return NextResponse.json({
    ok: true,
    started,
    execution: updated,
  });
}
