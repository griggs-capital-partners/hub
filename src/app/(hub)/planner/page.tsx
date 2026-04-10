import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { GlobalKanbanClient } from "@/components/kanban/GlobalKanbanClient";
import {
  ACTIVE_COLUMN,
  DEFAULT_KANBAN_COLUMN_DEFINITIONS,
  isLegacyActiveColumnName,
  normalizeKanbanColumnName,
} from "@/lib/kanban-columns";

const BASE_BOARD_CARD_SELECT = {
  id: true,
  title: true,
  body: true,
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
    orderBy: { name: "asc" as const },
    select: { id: true, name: true, logoUrl: true, status: true },
  },
  notes: {
    orderBy: { createdAt: "desc" as const },
    select: {
      id: true,
      body: true,
      image: true,
      createdAt: true,
      author: { select: { id: true, name: true, displayName: true, image: true, email: true } },
    },
  },
  sprintTask: {
    select: { id: true },
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
};

function getBoardCardSelect(includeSubtasks: boolean) {
  return {
    ...BASE_BOARD_CARD_SELECT,
    ...(includeSubtasks ? { subtasks: true as const } : {}),
  };
}

async function hasKanbanSubtasksColumn() {
  const rows = await prisma.$queryRaw<Array<{ exists: boolean }>>`
    SELECT EXISTS (
      SELECT 1
      FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name = 'kanban_cards'
        AND column_name = 'subtasks'
    ) AS "exists"
  `;

  return rows[0]?.exists ?? false;
}

async function syncBoardColumns(boardId: string, tx: Parameters<Parameters<typeof prisma.$transaction>[0]>[0]) {
  const columns = await tx.kanbanColumn.findMany({
    where: { boardId },
    select: { id: true, name: true, position: true },
    orderBy: { position: "asc" },
  });

  const activeColumns = columns.filter((column) => normalizeKanbanColumnName(column.name) === ACTIVE_COLUMN);
  let primaryActiveColumn = activeColumns.find((column) => column.name === ACTIVE_COLUMN)
    ?? activeColumns.find((column) => column.name === "In Progress")
    ?? activeColumns[0];

  if (primaryActiveColumn) {
    await tx.kanbanColumn.update({
      where: { id: primaryActiveColumn.id },
      data: { name: ACTIVE_COLUMN, color: "#F7941D" },
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
      data: { boardId, name: ACTIVE_COLUMN, color: "#F7941D", position: 1 },
    });
  }

  const existingColumnNames = new Set(columns.map((column) => normalizeKanbanColumnName(column.name)));

  for (const column of DEFAULT_KANBAN_COLUMN_DEFINITIONS) {
    if (existingColumnNames.has(column.name)) continue;
    await tx.kanbanColumn.create({ data: { boardId, ...column } });
  }

  const normalizedColumns = await tx.kanbanColumn.findMany({
    where: { boardId },
    select: { id: true, name: true },
  });

  const desiredOrder = new Map(
    DEFAULT_KANBAN_COLUMN_DEFINITIONS.map((column) => [
      column.name,
      { position: column.position, color: column.color },
    ])
  );

  await Promise.all(
    normalizedColumns.map((col) => {
      const normalizedColumnName = normalizeKanbanColumnName(col.name) as (typeof DEFAULT_KANBAN_COLUMN_DEFINITIONS)[number]["name"];
      const desired = desiredOrder.get(normalizedColumnName);
      if (!desired) return Promise.resolve();
      return tx.kanbanColumn.update({
        where: { id: col.id },
        data: {
          name: normalizedColumnName,
          position: desired.position,
          color: desired.color,
        },
      });
    })
  );
}

export default async function PlannerPage() {
  const session = await auth();
  const includeSubtasks = await hasKanbanSubtasksColumn();
  const boardCardSelect = getBoardCardSelect(includeSubtasks);

  const boardsNeedingColumnSync = await prisma.kanbanBoard.findMany({
    where: {
      OR: [
        { columns: { none: { name: "QA Testing" } } },
        { columns: { none: { name: "PO Review" } } },
        { columns: { none: { name: ACTIVE_COLUMN } } },
        { columns: { some: { name: "In Review" } } },
        { columns: { some: { name: "In Progress" } } },
        { columns: { some: { name: "Research & Investigation" } } },
      ],
    },
    select: { id: true },
  });

  if (boardsNeedingColumnSync.length > 0) {
    await Promise.all(
      boardsNeedingColumnSync.map((board) =>
        prisma.$transaction((tx) => syncBoardColumns(board.id, tx))
      )
    );
  }

  const [repos, users, customers, taskGroupsRaw] = await Promise.all([
    prisma.repo.findMany({
      where: { connected: true },
      orderBy: { name: "asc" },
      select: {
        id: true,
        name: true,
        fullName: true,
        updatedAt: true,
        boards: {
          select: {
            columns: {
              orderBy: { position: "asc" },
              select: {
                id: true,
                name: true,
                color: true,
                position: true,
                cards: {
                  orderBy: { position: "asc" },
                  select: boardCardSelect,
                },
              },
            },
          },
        },
      },
    }),
    prisma.user.findMany({
      orderBy: { name: "asc" },
      select: { id: true, name: true, displayName: true, email: true, image: true },
    }),
    prisma.customer.findMany({
      orderBy: { name: "asc" },
      select: { id: true, name: true, logoUrl: true, status: true },
    }),
    prisma.taskGroup.findMany({
      orderBy: { createdAt: "asc" },
      select: {
        id: true,
        name: true,
        description: true,
        status: true,
        color: true,
        cards: { select: { id: true } },
      },
    }),
  ]);

  let generalBoard = await prisma.kanbanBoard.findFirst({
    where: { repoId: null },
    select: {
      id: true,
      columns: {
        orderBy: { position: "asc" },
        select: {
          id: true,
          name: true,
          color: true,
          position: true,
          cards: {
            orderBy: { position: "asc" },
            select: boardCardSelect,
          },
        },
      },
    },
  });

  if (!generalBoard) {
    generalBoard = await prisma.kanbanBoard.create({
      data: {
        repoId: null,
        name: "General",
        columns: {
          create: DEFAULT_KANBAN_COLUMN_DEFINITIONS.map((col) => ({ ...col })),
        },
      },
      select: {
        id: true,
        columns: {
          orderBy: { position: "asc" },
          select: {
            id: true,
            name: true,
            color: true,
            position: true,
            cards: {
              orderBy: { position: "asc" },
              select: boardCardSelect,
            },
          },
        },
      },
    });
  }

  const kanbanCards = repos.flatMap((repo, repoIndex) =>
    repo.boards.flatMap((board) =>
      board.columns.flatMap((column) =>
        column.cards.map((card) => ({
          ...card,
          updatedAt: card.updatedAt.toISOString(),
          notes: card.notes.map((n) => ({
            ...n,
            createdAt: n.createdAt.toISOString(),
          })),
          agentExecutions: card.agentExecutions.map((execution) => ({
            ...execution,
            createdAt: execution.createdAt.toISOString(),
          })),
          sprintTask: null,
          columnId: column.id,
          columnName: column.name,
          columnPosition: column.position,
          repoId: repo.id,
          repoName: repo.name,
          repoFullName: repo.fullName,
          repoIndex,
          isSprintOnly: false as const,
          linkedRepoIds: card.linkedRepos.map((lr) => lr.repoId),
          taskGroupId: card.taskGroupId ?? null,
          subtasks: includeSubtasks && "subtasks" in card ? card.subtasks : "[]",
        }))
      )
    )
  );

  const GENERAL_REPO_INDEX = -2;
  const generalCards = generalBoard.columns.flatMap((column) =>
    column.cards.map((card) => ({
      ...card,
      updatedAt: card.updatedAt.toISOString(),
      notes: card.notes.map((n) => ({
        ...n,
        createdAt: n.createdAt.toISOString(),
      })),
      agentExecutions: card.agentExecutions.map((execution) => ({
        ...execution,
        createdAt: execution.createdAt.toISOString(),
      })),
      sprintTask: null,
      columnId: column.id,
      columnName: column.name,
      columnPosition: column.position,
      repoId: "general",
      repoName: "General",
      repoFullName: "General",
      repoIndex: GENERAL_REPO_INDEX,
      isSprintOnly: false as const,
      linkedRepoIds: card.linkedRepos.map((lr) => lr.repoId),
      taskGroupId: card.taskGroupId ?? null,
      subtasks: includeSubtasks && "subtasks" in card ? card.subtasks : "[]",
    }))
  );

  const taskGroups = taskGroupsRaw.map((group) => ({
    ...group,
    cardIds: group.cards.map((card) => card.id),
  }));

  const plannerRepos = [
    ...repos.map((repo, index) => ({
      id: repo.id,
      name: repo.name,
      fullName: repo.fullName,
      updatedAt: repo.updatedAt.toISOString(),
      index,
      columns: repo.boards[0]?.columns.map((column) => ({
        id: column.id,
        name: column.name,
        position: column.position,
      })) ?? [],
    })),
    {
      id: "general",
      name: "General",
      fullName: "General",
      updatedAt: new Date().toISOString(),
      index: GENERAL_REPO_INDEX,
      columns: generalBoard.columns.map((column) => ({
        id: column.id,
        name: column.name,
        position: column.position,
      })),
    },
  ];

  return (
    <GlobalKanbanClient
      cards={[...kanbanCards, ...generalCards]}
      repos={plannerRepos}
      sprints={[]}
      users={users}
      customers={customers}
      currentUserId={session?.user?.id ?? null}
      taskGroups={taskGroups}
    />
  );
}
