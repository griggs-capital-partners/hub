import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { probeAgentLlm } from "@/lib/agent-llm";
import { normalizeAgentAbilitiesInput } from "@/lib/agent-task-context";
import {
  createAgentConstitutionSeed,
  parseAgentConstitution,
  resolveAgentConstitutionPersistence,
} from "@/lib/agent-constitution";

// GET /api/agents/[id] — fetch a single agent with stats
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;

  const agent = await prisma.aIAgent.findUnique({
    where: { id },
    include: {
      createdBy: { select: { id: true, name: true, displayName: true } },
      _count: { select: { sprintTasks: true, messages: true, taskExecutions: true } },
    },
  });

  if (!agent) {
    return NextResponse.json({ error: "Agent not found" }, { status: 404 });
  }

  return NextResponse.json({ agent });
}

// PATCH /api/agents/[id] — update agent
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const body = await request.json();
  const {
    name,
    role,
    description,
    constitution,
    persona,
    duties,
    avatar,
    status,
    abilities,
    disabledTools,
    llmEndpointUrl,
    llmUsername,
    llmPassword,
    llmModel,
    llmThinkingMode,
    refreshLlmStatus,
  } = body;

  const existing = await prisma.aIAgent.findUnique({ where: { id } });
  if (!existing) {
    return NextResponse.json({ error: "Agent not found" }, { status: 404 });
  }

  const nextName = name !== undefined ? name.trim() : existing.name;
  const nextRole = role !== undefined ? role.trim() : existing.role;
  const nextDescription = description !== undefined ? description?.trim() ?? null : existing.description;
  const existingConstitution = parseAgentConstitution(existing.constitution);
  const constitutionPersistence = resolveAgentConstitutionPersistence({
    constitution,
    persona,
    existingConstitution: existing.constitution,
    existingPersona: existing.persona,
    fallbackAgentType: existingConstitution?.agentType ?? "executive_assistant",
    seed: createAgentConstitutionSeed({
      name: nextName,
      role: nextRole,
      description: nextDescription,
    }),
  });

  const nextLlmEndpointUrl = llmEndpointUrl !== undefined ? llmEndpointUrl?.trim() || null : existing.llmEndpointUrl;
  const nextLlmUsername = llmUsername !== undefined ? llmUsername?.trim() || null : existing.llmUsername;
  const nextLlmPassword = llmPassword !== undefined ? llmPassword?.trim() || null : existing.llmPassword;
  // llmModel override: empty string means "auto-detect", otherwise use the provided value.
  const nextLlmModelOverride = llmModel !== undefined ? llmModel?.trim() || null : existing.llmModel;

  const llmFieldsChanged = llmEndpointUrl !== undefined || llmUsername !== undefined || llmPassword !== undefined || llmModel !== undefined;
  const nextLlmStatus = (llmFieldsChanged || refreshLlmStatus)
    ? await probeAgentLlm({
        llmEndpointUrl: nextLlmEndpointUrl,
        llmUsername: nextLlmUsername,
        llmPassword: nextLlmPassword,
        llmModel: nextLlmModelOverride,
      })
    : null;

  const agent = await prisma.aIAgent.update({
    where: { id },
    data: {
      ...(name !== undefined && { name: name.trim() }),
      ...(role !== undefined && { role: role.trim() }),
      ...(description !== undefined && { description: description?.trim() ?? null }),
      ...(constitution !== undefined && { constitution: constitutionPersistence.serializedConstitution ?? "" }),
      ...(
        constitution !== undefined
          ? {
              persona: constitutionPersistence.persona,
            }
          : persona !== undefined
            ? { persona: persona.trim() }
            : {}
      ),
      ...(duties !== undefined && { duties: Array.isArray(duties) ? JSON.stringify(duties) : "[]" }),
      ...(avatar !== undefined && { avatar: avatar?.trim() ?? null }),
      ...(status !== undefined && { status }),
      ...(abilities !== undefined && { abilities: JSON.stringify(normalizeAgentAbilitiesInput(abilities)) }),
      ...(llmEndpointUrl !== undefined && { llmEndpointUrl: nextLlmEndpointUrl }),
      ...(llmUsername !== undefined && { llmUsername: nextLlmUsername }),
      ...(llmPassword !== undefined && { llmPassword: nextLlmPassword }),
      ...(llmModel !== undefined && { llmModel: nextLlmModelOverride }),
      ...(llmThinkingMode !== undefined && { llmThinkingMode }),
      ...(disabledTools !== undefined && { disabledTools: Array.isArray(disabledTools) ? JSON.stringify(disabledTools) : "[]" }),
      ...(nextLlmStatus && {
        llmStatus: nextLlmStatus.llmStatus,
        llmModel: nextLlmStatus.llmModel,
        llmLastCheckedAt: nextLlmStatus.llmLastCheckedAt,
        llmLastError: nextLlmStatus.llmLastError,
      }),
    },
    include: {
      createdBy: { select: { id: true, name: true, displayName: true } },
      _count: { select: { sprintTasks: true, messages: true, taskExecutions: true } },
    },
  });

  return NextResponse.json({ agent });
}

// DELETE /api/agents/[id] — delete agent
export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;

  const existing = await prisma.aIAgent.findUnique({ where: { id } });
  if (!existing) {
    return NextResponse.json({ error: "Agent not found" }, { status: 404 });
  }

  await prisma.aIAgent.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
