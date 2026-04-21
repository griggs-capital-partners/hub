import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id: agentId } = await params;

  const agent = await prisma.aIAgent.findUnique({ where: { id: agentId } });
  if (!agent) {
    return NextResponse.json({ error: "Agent not found" }, { status: 404 });
  }

  const body = await request.json();
  const title = typeof body?.title === "string" ? body.title.trim() : "";
  const description = typeof body?.description === "string" ? body.description.trim() || null : null;
  const priority = ["critical", "high", "medium", "low"].includes(body?.priority) ? body.priority : "medium";

  if (!title) {
    return NextResponse.json({ error: "title is required" }, { status: 400 });
  }

  // Find or create the shared "Agent Tasks" sprint used as an agent work queue
  let sprint = await prisma.sprint.findFirst({
    where: { name: "Agent Tasks", status: { in: ["active", "planning"] } },
    orderBy: { createdAt: "desc" },
  });

  if (!sprint) {
    sprint = await prisma.sprint.create({
      data: {
        name: "Agent Tasks",
        status: "active",
        startDate: new Date(),
        endDate: new Date("2099-12-31"),
      },
    });
  }

  const maxPosition = await prisma.sprintTask.aggregate({
    where: { sprintId: sprint.id },
    _max: { position: true },
  });

  const task = await prisma.sprintTask.create({
    data: {
      sprintId: sprint.id,
      agentAssigneeId: agentId,
      title,
      description,
      priority,
      status: "todo",
      position: (maxPosition._max.position ?? 0) + 1,
    },
  });

  return NextResponse.json({ task }, { status: 201 });
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id: agentId } = await params;
  const body = await request.json();
  const taskId = typeof body?.taskId === "string" ? body.taskId : null;

  if (!taskId) {
    return NextResponse.json({ error: "taskId is required" }, { status: 400 });
  }

  const task = await prisma.sprintTask.findFirst({
    where: { id: taskId, agentAssigneeId: agentId },
  });

  if (!task) {
    return NextResponse.json({ error: "Task not found" }, { status: 404 });
  }

  await prisma.sprintTask.delete({ where: { id: taskId } });
  return NextResponse.json({ ok: true });
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id: agentId } = await params;
  const body = await request.json();
  const taskId = typeof body?.taskId === "string" ? body.taskId : null;
  const status = typeof body?.status === "string" ? body.status : null;

  if (!taskId || !status) {
    return NextResponse.json({ error: "taskId and status are required" }, { status: 400 });
  }

  const task = await prisma.sprintTask.findFirst({
    where: { id: taskId, agentAssigneeId: agentId },
  });

  if (!task) {
    return NextResponse.json({ error: "Task not found" }, { status: 404 });
  }

  const updated = await prisma.sprintTask.update({
    where: { id: taskId },
    data: { status },
  });

  return NextResponse.json({ task: updated });
}
