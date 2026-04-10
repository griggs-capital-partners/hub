import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

// GET /api/agents/[id]/chat — fetch message thread between current user and agent
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;

  const messages = await prisma.agentMessage.findMany({
    where: { agentId: id, userId: session.user.id },
    orderBy: { createdAt: "asc" },
  });

  return NextResponse.json({ messages });
}

// POST /api/agents/[id]/chat — send a message from user to agent; auto-reply with canned response
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const body = await request.json();
  const { message } = body;

  if (!message?.trim()) {
    return NextResponse.json({ error: "message is required" }, { status: 400 });
  }

  const agent = await prisma.aIAgent.findUnique({ where: { id } });
  if (!agent) {
    return NextResponse.json({ error: "Agent not found" }, { status: 404 });
  }

  // Store the user's message
  const userMessage = await prisma.agentMessage.create({
    data: {
      agentId: id,
      userId: session.user.id,
      body: message.trim(),
      sender: "user",
    },
  });

  // Auto-reply: canned response based on agent role (LLM not connected yet)
  const autoReply = buildAutoReply(agent.name, agent.role, agent.persona, message.trim());
  const agentMessage = await prisma.agentMessage.create({
    data: {
      agentId: id,
      userId: session.user.id,
      body: autoReply,
      sender: "agent",
    },
  });

  return NextResponse.json({ userMessage, agentMessage }, { status: 201 });
}

function buildAutoReply(name: string, role: string, persona: string, _message: string): string {
  const replies = [
    `Got it. I'm tracking this as part of my ${role} responsibilities. I'll have an update ready soon.`,
    `Noted! As your ${role}, I'll look into this and prioritize accordingly.`,
    `Understood. I'll incorporate this into my workflow and follow up when I have something concrete.`,
    `Thanks for the heads up. This aligns with my focus area — I'm on it.`,
    `Received. I'll analyze this and get back to you with a plan of action.`,
  ];

  // Use persona if set, otherwise pick a generic reply
  if (persona?.trim()) {
    return `${replies[Math.floor(Math.random() * replies.length)]}`;
  }

  return replies[Math.floor(Math.random() * replies.length)];
}
