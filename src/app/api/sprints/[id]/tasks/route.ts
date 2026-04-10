import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { notifyTaskAssigned } from "@/lib/web-push";

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id: sprintId } = await params;
  const body = await req.json();

  const { title, description, assigneeId, priority, storyPoints, githubIssueUrl, status, kanbanCardId } = body;

  // If linking to a kanban card, auto-populate fields from the card
  let resolvedTitle = title;
  let resolvedPriority = priority ?? "medium";
  let resolvedGithubIssueUrl = githubIssueUrl ?? null;
  let resolvedDescription = description ?? null;

  if (kanbanCardId) {
    const card = await prisma.kanbanCard.findUnique({ where: { id: kanbanCardId } });
    if (!card) return NextResponse.json({ error: "kanban card not found" }, { status: 404 });

    // Check not already in a sprint
    const existing = await prisma.sprintTask.findUnique({ where: { kanbanCardId } });
    if (existing) return NextResponse.json({ error: "card already in a sprint" }, { status: 409 });

    resolvedTitle = title ?? card.title;
    resolvedPriority = priority ?? card.priority;
    resolvedGithubIssueUrl = githubIssueUrl ?? card.githubIssueUrl ?? null;
    resolvedDescription = description ?? card.body ?? null;
  }

  if (!resolvedTitle) return NextResponse.json({ error: "title required" }, { status: 400 });

  const count = await prisma.sprintTask.count({ where: { sprintId } });

  const task = await prisma.sprintTask.create({
    data: {
      sprintId,
      title: resolvedTitle,
      description: resolvedDescription,
      assigneeId: assigneeId ?? null,
      priority: resolvedPriority,
      storyPoints: storyPoints ? Number(storyPoints) : null,
      githubIssueUrl: resolvedGithubIssueUrl,
      status: status ?? "todo",
      position: count,
      kanbanCardId: kanbanCardId ?? null,
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

  if (task.assigneeId) {
    try {
      await notifyTaskAssigned({
        userId: task.assigneeId,
        taskId: task.id,
        taskTitle: task.title,
        contextLabel: task.sprint.name,
        assignedByName: session.user.name ?? "A teammate",
      });
    } catch (error) {
      console.error("Failed to send task assignment notification", { taskId: task.id, error });
    }
  }

  return NextResponse.json(task, { status: 201 });
}
