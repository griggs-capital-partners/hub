import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { notifyTaskAssigned } from "@/lib/web-push";

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; taskId: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { taskId } = await params;
  const body = await req.json();

  const existingTask = await prisma.sprintTask.findUnique({
    where: { id: taskId },
    select: {
      id: true,
      assigneeId: true,
      title: true,
      sprint: { select: { id: true, name: true } },
    },
  });

  if (!existingTask) {
    return NextResponse.json({ error: "Task not found" }, { status: 404 });
  }

  const task = await prisma.sprintTask.update({
    where: { id: taskId },
    data: {
      ...(body.title !== undefined && { title: body.title }),
      ...(body.description !== undefined && { description: body.description }),
      ...(body.status !== undefined && { status: body.status }),
      ...(body.priority !== undefined && { priority: body.priority }),
      ...(body.storyPoints !== undefined && { storyPoints: body.storyPoints ? Number(body.storyPoints) : null }),
      ...(body.assigneeId !== undefined && { assigneeId: body.assigneeId }),
      ...(body.githubIssueUrl !== undefined && { githubIssueUrl: body.githubIssueUrl }),
      ...(body.position !== undefined && { position: Number(body.position) }),
    },
    include: {
      sprint: { select: { id: true, name: true } },
      assignee: true,
      kanbanCard: {
        select: {
          id: true,
          title: true,
          priority: true,
          column: { select: { name: true, board: { select: { repo: { select: { id: true, name: true } } } } } },
        },
      },
    },
  });

  if (
    body.assigneeId !== undefined
    && task.assigneeId
    && task.assigneeId !== existingTask.assigneeId
  ) {
    try {
      await notifyTaskAssigned({
        userId: task.assigneeId,
        taskId: task.id,
        taskTitle: task.title,
        contextLabel: task.sprint.name,
        assignedByName: session.user.name ?? "A teammate",
      });
    } catch (error) {
      console.error("Failed to send task reassignment notification", { taskId: task.id, error });
    }
  }

  return NextResponse.json(task);
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string; taskId: string }> }
) {
  await auth();
  const { taskId } = await params;
  await prisma.sprintTask.delete({ where: { id: taskId } });
  return NextResponse.json({ ok: true });
}
