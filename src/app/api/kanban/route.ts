import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { isKanbanTaskState } from "@/components/kanban/taskState";
import { notifyTaskAssigned } from "@/lib/web-push";
import { sanitizeKanbanSubtasks, serializeKanbanSubtasks } from "@/lib/kanban-subtasks";
import {
  ACTIVE_COLUMN,
  DEFAULT_KANBAN_COLUMN_DEFINITIONS,
  isLegacyActiveColumnName,
  normalizeKanbanColumnName,
} from "@/lib/kanban-columns";

let kanbanSubtasksColumnExistsPromise: Promise<boolean> | null = null;

async function hasKanbanSubtasksColumn() {
  if (!kanbanSubtasksColumnExistsPromise) {
    kanbanSubtasksColumnExistsPromise = prisma.$queryRaw<Array<{ exists: boolean }>>`
      SELECT EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name = 'kanban_cards'
          AND column_name = 'subtasks'
      ) AS "exists"
    `
      .then((rows) => rows[0]?.exists ?? false)
      .catch(() => false);
  }

  return await kanbanSubtasksColumnExistsPromise;
}

function getCardSelect(includeSubtasks: boolean) {
  return {
    id: true,
    title: true,
    body: true,
    ...(includeSubtasks ? { subtasks: true } : {}),
    priority: true,
    state: true,
    labels: true,
    githubIssueId: true,
    githubIssueUrl: true,
    position: true,
    assignees: true,
    updatedAt: true,
    taskGroupId: true,
    customers: {
      select: { id: true, name: true, logoUrl: true, status: true },
      orderBy: { name: "asc" as const },
    },
    notes: {
      select: {
        id: true,
        body: true,
        image: true,
        createdAt: true,
        author: { select: { id: true, name: true, displayName: true, image: true, email: true } },
      },
      orderBy: { createdAt: "desc" as const },
    },
    sprintTask: {
      select: {
        id: true,
        sprintId: true,
        sprint: { select: { id: true, name: true, status: true } },
      },
    },
    agentExecutions: {
      where: { status: { not: "archived" as const } },
      orderBy: { createdAt: "desc" as const },
      take: 3,
      select: {
        id: true,
        actionType: true,
        status: true,
        createdAt: true,
        agent: {
          select: {
            id: true,
            name: true,
            avatar: true,
            abilities: true,
          },
        },
      },
    },
    linkedRepos: {
      select: { repoId: true },
    },
    taskGroup: {
      select: { id: true, name: true, status: true, color: true },
    },
  } as const;
}

function getBoardSelect(includeSubtasks: boolean) {
  return {
    id: true,
    name: true,
    repoId: true,
    createdAt: true,
    updatedAt: true,
    columns: {
      orderBy: { position: "asc" as const },
      select: {
        id: true,
        name: true,
        color: true,
        position: true,
        cards: {
          orderBy: { position: "asc" as const },
          select: getCardSelect(includeSubtasks),
        },
      },
    },
  } as const;
}

function withSubtasksFallback<T extends { subtasks?: string | null }>(card: T, includeSubtasks: boolean) {
  return {
    ...card,
    subtasks: includeSubtasks ? (card.subtasks ?? "[]") : "[]",
  };
}

async function ensureBoardColumns(boardId: string) {
  const existingColumns = await prisma.kanbanColumn.findMany({
    where: { boardId },
    select: { id: true, name: true, position: true },
    orderBy: { position: "asc" },
  });

  await prisma.$transaction(async (tx) => {
    const activeColumns = existingColumns.filter((column) => normalizeKanbanColumnName(column.name) === ACTIVE_COLUMN);
    let primaryActiveColumn = activeColumns.find((column) => column.name === ACTIVE_COLUMN)
      ?? activeColumns.find((column) => column.name === "In Progress")
      ?? activeColumns[0];

    if (primaryActiveColumn) {
      await tx.kanbanColumn.update({
        where: { id: primaryActiveColumn.id },
        data: {
          name: ACTIVE_COLUMN,
          color: "#F7941D",
        },
      });

      let nextPosition = (
        await tx.kanbanCard.aggregate({
          where: { columnId: primaryActiveColumn.id },
          _max: { position: true },
        })
      )._max.position ?? -1;

      for (const legacyColumn of activeColumns) {
        if (legacyColumn.id === primaryActiveColumn.id || !isLegacyActiveColumnName(legacyColumn.name)) continue;

        const legacyCards = await tx.kanbanCard.findMany({
          where: { columnId: legacyColumn.id },
          select: { id: true },
          orderBy: { position: "asc" },
        });

        for (const card of legacyCards) {
          nextPosition += 1;
          await tx.kanbanCard.update({
            where: { id: card.id },
            data: {
              columnId: primaryActiveColumn.id,
              position: nextPosition,
            },
          });
        }

        await tx.kanbanColumn.delete({ where: { id: legacyColumn.id } });
      }
    } else {
      primaryActiveColumn = await tx.kanbanColumn.create({
        data: {
          boardId,
          name: ACTIVE_COLUMN,
          color: "#F7941D",
          position: 1,
        },
      });
    }

    const existingColumnNames = new Set(existingColumns.map((column) => normalizeKanbanColumnName(column.name)));
    for (const column of DEFAULT_KANBAN_COLUMN_DEFINITIONS) {
      if (existingColumnNames.has(column.name)) continue;
      await tx.kanbanColumn.create({ data: { boardId, ...column } });
    }

    const refreshedColumns = await tx.kanbanColumn.findMany({
      where: { boardId },
      select: { id: true, name: true },
    });

    const positions = new Map(DEFAULT_KANBAN_COLUMN_DEFINITIONS.map((column) => [column.name as string, column.position]));
    const colors = new Map(DEFAULT_KANBAN_COLUMN_DEFINITIONS.map((column) => [column.name as string, column.color]));

    for (const column of refreshedColumns) {
      const normalizedName = normalizeKanbanColumnName(column.name);
      const nextPosition = positions.get(normalizedName);
      const nextColor = colors.get(normalizedName);
      if (nextPosition === undefined || nextColor === undefined) continue;

      await tx.kanbanColumn.update({
        where: { id: column.id },
        data: { name: normalizedName, position: nextPosition, color: nextColor },
      });
    }
  });
}

function parseAssigneeIds(value: unknown): string[] {
  if (typeof value !== "string") return [];

  try {
    const parsed = JSON.parse(value) as unknown;
    return Array.isArray(parsed) ? parsed.filter((item): item is string => typeof item === "string") : [];
  } catch {
    return [];
  }
}

// GET /api/kanban?repoId=xxx  OR  ?general=true
export async function GET(request: Request) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const includeSubtasks = await hasKanbanSubtasksColumn();
  const boardSelect = getBoardSelect(includeSubtasks);

  const { searchParams } = new URL(request.url);
  const repoId = searchParams.get("repoId");
  const isGeneral = searchParams.get("general") === "true";

  if (!repoId && !isGeneral) {
    return NextResponse.json({ error: "repoId or general=true required" }, { status: 400 });
  }

  const boardWhere = isGeneral ? { repoId: null } : { repoId };

  let board = await prisma.kanbanBoard.findFirst({
    where: boardWhere,
    select: boardSelect,
  });

  // Auto-create board if none exists
  if (!board) {
    board = await prisma.kanbanBoard.create({
      data: {
        repoId: isGeneral ? null : repoId,
        name: isGeneral ? "General" : "Main Board",
        columns: {
          create: DEFAULT_KANBAN_COLUMN_DEFINITIONS.map((column) => ({ ...column })),
        },
      },
      select: boardSelect,
    });
  }

  await ensureBoardColumns(board.id);

  board = await prisma.kanbanBoard.findFirst({
    where: boardWhere,
    select: boardSelect,
  });

  return NextResponse.json({ board });
}

// POST /api/kanban - create card
export async function POST(request: Request) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const includeSubtasks = await hasKanbanSubtasksColumn();
  const cardSelect = getCardSelect(includeSubtasks);

  const body = await request.json();
  const { columnId, title, body: cardBody, priority, state, labels, assignees, githubIssueId, githubIssueUrl, customerIds, linkedRepoIds, subtasks } = body;

  if (!columnId || !title) {
    return NextResponse.json({ error: "columnId and title required" }, { status: 400 });
  }

  // Get max position in column
  const maxCard = await prisma.kanbanCard.findFirst({
    where: { columnId },
    orderBy: { position: "desc" },
  });

  const card = await prisma.kanbanCard.create({
    data: {
      columnId,
      title,
      body: cardBody ?? "",
      ...(includeSubtasks ? { subtasks: serializeKanbanSubtasks(sanitizeKanbanSubtasks(subtasks)) } : {}),
      priority: priority ?? "medium",
      state: isKanbanTaskState(state) ? state : "normal",
      labels: JSON.stringify(labels ?? []),
      assignees: assignees ?? "[]",
      position: (maxCard?.position ?? -1) + 1,
      githubIssueId: githubIssueId ?? null,
      githubIssueUrl: githubIssueUrl ?? null,
      customers: customerIds?.length
        ? { connect: customerIds.map((id: string) => ({ id })) }
        : undefined,
      linkedRepos: linkedRepoIds?.length
        ? { create: linkedRepoIds.map((repoId: string) => ({ repoId })) }
        : undefined,
    },
    select: cardSelect,
  });

  const assigneeIds = parseAssigneeIds(card.assignees);
  if (assigneeIds.length > 0) {
    await Promise.all(
      assigneeIds.map(async (userId) => {
        try {
          await notifyTaskAssigned({
            userId,
            taskId: card.id,
            taskTitle: card.title,
            contextLabel: "Kanban Board",
            url: "/planner",
            assignedByName: session.user.name ?? "A teammate",
          });
        } catch (error) {
          console.error("Failed to send kanban assignment notification", { cardId: card.id, userId, error });
        }
      })
    );
  }

  return NextResponse.json({ card: withSubtasksFallback(card, includeSubtasks) });
}

// DELETE /api/kanban - delete card
export async function DELETE(request: Request) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const cardId = searchParams.get("cardId");
  if (!cardId) return NextResponse.json({ error: "cardId required" }, { status: 400 });

  await prisma.kanbanCard.deleteMany({ where: { id: cardId } });

  return NextResponse.json({ success: true });
}

// PATCH /api/kanban - move/update card
export async function PATCH(request: Request) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const includeSubtasks = await hasKanbanSubtasksColumn();
  const cardSelect = getCardSelect(includeSubtasks);

  const body = await request.json();
  const { cardId, columnId, position } = body;

  if (!cardId) return NextResponse.json({ error: "cardId required" }, { status: 400 });

  const existingCard = body.assignees !== undefined
    ? await prisma.kanbanCard.findUnique({
        where: { id: cardId },
        select: { id: true, assignees: true, title: true },
      })
    : null;

  const card = await prisma.kanbanCard.update({
    where: { id: cardId },
    data: {
      ...(columnId && { columnId }),
      ...(position !== undefined && { position }),
      ...(body.assignees !== undefined && { assignees: body.assignees }),
      ...(body.title !== undefined && { title: body.title }),
      ...(body.body !== undefined && { body: body.body }),
      ...(includeSubtasks && body.subtasks !== undefined && { subtasks: serializeKanbanSubtasks(sanitizeKanbanSubtasks(body.subtasks)) }),
      ...(body.labels !== undefined && { labels: JSON.stringify(body.labels) }),
      ...(body.priority !== undefined && { priority: body.priority }),
      ...(body.state !== undefined && { state: isKanbanTaskState(body.state) ? body.state : "normal" }),
      ...(body.customerIds !== undefined && {
        customers: {
          set: body.customerIds.map((id: string) => ({ id })),
        },
      }),
      ...(body.linkedRepoIds !== undefined && {
        linkedRepos: {
          deleteMany: {},
          create: body.linkedRepoIds.map((repoId: string) => ({ repoId })),
        },
      }),
      ...(body.taskGroupId !== undefined && { taskGroupId: body.taskGroupId }),
    },
    select: cardSelect,
  });

  if (body.assignees !== undefined) {
    const previousAssignees = new Set(parseAssigneeIds(existingCard?.assignees));
    const nextAssignees = parseAssigneeIds(card.assignees);
    const addedAssignees = nextAssignees.filter((userId) => !previousAssignees.has(userId));

    if (addedAssignees.length > 0) {
      await Promise.all(
        addedAssignees.map(async (userId) => {
          try {
            await notifyTaskAssigned({
              userId,
              taskId: card.id,
              taskTitle: card.title,
              contextLabel: "Kanban Board",
              url: "/planner",
              assignedByName: session.user.name ?? "A teammate",
            });
          } catch (error) {
            console.error("Failed to send kanban reassignment notification", { cardId: card.id, userId, error });
          }
        })
      );
    }
  }

  return NextResponse.json({ card: withSubtasksFallback(card, includeSubtasks) });
}
