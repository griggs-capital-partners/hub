import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getDefaultAgentAbilities, normalizeAgentAbilitiesInput } from "@/lib/agent-task-context";

// GET /api/agents — list all agents
export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const agents = await prisma.aIAgent.findMany({
    orderBy: { createdAt: "asc" },
    include: {
      createdBy: { select: { id: true, name: true, displayName: true } },
      _count: { select: { sprintTasks: true } },
    },
  });

  return NextResponse.json({ agents });
}

// POST /api/agents — create a new agent
export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json();
  const { name, role, description, persona, duties, avatar, status, abilities } = body;

  if (!name?.trim() || !role?.trim()) {
    return NextResponse.json({ error: "name and role are required" }, { status: 400 });
  }

  const agent = await prisma.aIAgent.create({
    data: {
      name: name.trim(),
      role: role.trim(),
      description: description?.trim() ?? null,
      persona: persona?.trim() ?? "",
      duties: Array.isArray(duties) ? JSON.stringify(duties) : "[]",
      avatar: avatar?.trim() ?? null,
      status: status ?? "active",
      abilities: JSON.stringify(abilities !== undefined ? normalizeAgentAbilitiesInput(abilities) : getDefaultAgentAbilities()),
      llmThinkingMode: "auto",
      llmStatus: "disconnected",
      createdById: session.user.id,
    },
    include: {
      createdBy: { select: { id: true, name: true, displayName: true } },
      _count: { select: { sprintTasks: true } },
    },
  });

  return NextResponse.json({ agent }, { status: 201 });
}
