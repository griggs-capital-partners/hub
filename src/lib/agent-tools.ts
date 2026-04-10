import { prisma } from "@/lib/prisma";
import { isDoneColumn, parseJsonArray, parseWeeklyItems, formatWeekStart } from "@/lib/agent-context";
import { mapWellPriorityToHealthScore, mapWellPriorityToTier } from "@/lib/well-compat";

// ─── Tool Definition (OpenAI function-calling format) ─────────────────────────

export type AgentToolDefinition = {
  type: "function";
  function: {
    name: string;
    description: string;
    parameters: Record<string, unknown>;
  };
};

// ─── Tool Catalog ─────────────────────────────────────────────────────────────

export const agentChatTools: AgentToolDefinition[] = [
  // ── Tasks / Kanban ───────────────────────────────────────────────────────────
  {
    type: "function",
    function: {
      name: "get_active_tasks",
      description:
        "Fetch planner and kanban tasks with optional filters and sorting. " +
        "Use this for questions about tasks, planner items, kanban cards, what's on the board, who is working on what, what was created most recently, backlog, priorities, or task counts.",
      parameters: {
        type: "object",
        properties: {
          status_scope: {
            type: "string",
            enum: ["active", "all", "done"],
            description: "Whether to return only active tasks, all tasks, or only done tasks. Defaults to active.",
          },
          sort_by: {
            type: "string",
            enum: ["board", "newest", "updated", "priority"],
            description: "How to order the tasks. Defaults to board.",
          },
          limit: {
            type: "integer",
            description: "Maximum number of tasks to return. Defaults to 50.",
          },
          board_name: {
            type: "string",
            description: "Optional board name filter.",
          },
          assignee: {
            type: "string",
            description: "Optional assignee name filter.",
          },
          search: {
            type: "string",
            description: "Optional text filter that matches task title, body, labels, board, or column.",
          },
        },
        required: [],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "list_kanban_boards",
      description:
        "List every kanban board with ALL columns and cards including their IDs. Call this before creating, moving, or updating a card — you need the column ID or card ID first.",
      parameters: { type: "object", properties: {}, required: [] },
    },
  },
  {
    type: "function",
    function: {
      name: "create_kanban_card",
      description: "Create a new card in a specific kanban column.",
      parameters: {
        type: "object",
        required: ["column_id", "title"],
        properties: {
          column_id: { type: "string", description: "ID of the column to create the card in" },
          title: { type: "string", description: "Short title for the card" },
          body: { type: "string", description: "Detailed description or acceptance criteria" },
          priority: {
            type: "string",
            enum: ["low", "medium", "high", "critical"],
            description: "Priority level of the card",
          },
          labels: { type: "array", items: { type: "string" }, description: "Labels to apply" },
          assignees: { type: "array", items: { type: "string" }, description: "Assignee names" },
        },
      },
    },
  },
  {
    type: "function",
    function: {
      name: "update_kanban_card",
      description:
        "Update one or more fields on an existing kanban card (title, description, priority, labels, assignees, or state). Only include fields you want to change.",
      parameters: {
        type: "object",
        required: ["card_id"],
        properties: {
          card_id: { type: "string", description: "ID of the card to update" },
          title: { type: "string" },
          body: { type: "string", description: "New description" },
          priority: { type: "string", enum: ["low", "medium", "high", "critical"] },
          state: { type: "string", description: "New state value" },
          labels: { type: "array", items: { type: "string" }, description: "Replaces existing labels" },
          assignees: { type: "array", items: { type: "string" }, description: "Replaces existing assignees" },
        },
      },
    },
  },
  {
    type: "function",
    function: {
      name: "move_kanban_card",
      description: "Move a card to a different column (e.g. from Backlog to In Progress).",
      parameters: {
        type: "object",
        required: ["card_id", "column_id"],
        properties: {
          card_id: { type: "string", description: "ID of the card to move" },
          column_id: { type: "string", description: "ID of the destination column" },
        },
      },
    },
  },
  {
    type: "function",
    function: {
      name: "delete_kanban_card",
      description: "Permanently delete a kanban card. Use with caution — this cannot be undone.",
      parameters: {
        type: "object",
        required: ["card_id"],
        properties: {
          card_id: { type: "string", description: "ID of the card to delete" },
        },
      },
    },
  },
  // ── Customers ────────────────────────────────────────────────────────────────
  {
    type: "function",
    function: {
      name: "get_customer_details",
      description:
        "Fetch full details for a customer by name: health score, tier, industry, primary contacts, and recent weekly notes. " +
        "Call this when the user asks about a specific customer's status, contacts, or recent activity.",
      parameters: {
        type: "object",
        required: ["name"],
        properties: {
          name: { type: "string", description: "Customer name or partial name to look up" },
        },
      },
    },
  },
  // ── Weekly Notes ─────────────────────────────────────────────────────────────
  {
    type: "function",
    function: {
      name: "get_weekly_notes",
      description:
        "Fetch the last two weeks of customer weekly notes across the whole org. " +
        "Call this when the user asks about recent updates, what happened this week, or customer check-ins.",
      parameters: { type: "object", properties: {}, required: [] },
    },
  },
  // ── Repos / Code ────────────────────────────────────────────────────────────
  {
    type: "function",
    function: {
      name: "list_repos",
      description: "List all connected code repositories in the workspace (name, language, description, GitHub URL).",
      parameters: { type: "object", properties: {}, required: [] },
    },
  },
  {
    type: "function",
    function: {
      name: "get_repo_details",
      description:
        "Get detailed information about a specific repository including its kanban cards, linked AWS resources, and recent activity.",
      parameters: {
        type: "object",
        required: ["repo_id"],
        properties: {
          repo_id: { type: "string", description: "ID of the repository" },
        },
      },
    },
  },
];

// ─── Human-readable labels shown in chat UI ───────────────────────────────────

export const TOOL_LABELS: Record<string, string> = {
  get_active_tasks: "Fetching active tasks",
  list_kanban_boards: "Reading kanban boards",
  create_kanban_card: "Creating card",
  update_kanban_card: "Updating card",
  move_kanban_card: "Moving card",
  delete_kanban_card: "Deleting card",
  get_customer_details: "Looking up customer",
  get_weekly_notes: "Fetching weekly notes",
  list_repos: "Listing repositories",
  get_repo_details: "Fetching repo details",
};

// ─── Tool Executor ────────────────────────────────────────────────────────────

async function buildAssigneeNameMap() {
  const [users, agents] = await Promise.all([
    prisma.user.findMany({
      select: { id: true, name: true, displayName: true },
    }),
    prisma.aIAgent.findMany({
      select: { id: true, name: true },
    }),
  ]);

  const entries: Array<[string, string]> = [
    ...users.map((user) => [user.id, user.displayName || user.name || user.id] as [string, string]),
    ...agents.map((agent) => [agent.id, agent.name] as [string, string]),
  ];

  return new Map<string, string>(entries);
}

function priorityWeight(priority: string | null | undefined) {
  switch ((priority ?? "").toLowerCase()) {
    case "critical":
      return 4;
    case "high":
      return 3;
    case "medium":
      return 2;
    case "low":
      return 1;
    default:
      return 0;
  }
}

function resolveAssigneeNames(rawAssignees: string, assigneeNameMap: Map<string, string>) {
  return parseJsonArray(rawAssignees).map((assignee) => assigneeNameMap.get(assignee) ?? assignee);
}

export async function executeAgentTool(
  name: string,
  args: Record<string, unknown>
): Promise<string> {
  switch (name) {
    // ── get_active_tasks ─────────────────────────────────────────────────────
    case "get_active_tasks": {
      const assigneeNameMap = await buildAssigneeNameMap();
      const statusScope = typeof args.status_scope === "string" ? args.status_scope : "active";
      const sortBy = typeof args.sort_by === "string" ? args.sort_by : "board";
      const boardNameFilter = typeof args.board_name === "string" ? args.board_name.trim().toLowerCase() : "";
      const assigneeFilter = typeof args.assignee === "string" ? args.assignee.trim().toLowerCase() : "";
      const searchFilter = typeof args.search === "string" ? args.search.trim().toLowerCase() : "";
      const requestedLimit = typeof args.limit === "number" ? args.limit : Number(args.limit ?? 50);
      const limit = Number.isFinite(requestedLimit) ? Math.max(1, Math.min(100, Math.floor(requestedLimit))) : 50;

      const boards = await prisma.kanbanBoard.findMany({
        include: {
          columns: {
            orderBy: { position: "asc" },
            include: {
              cards: {
                orderBy: [{ position: "asc" }],
                select: {
                  id: true,
                  title: true,
                  body: true,
                  priority: true,
                  state: true,
                  labels: true,
                  assignees: true,
                  position: true,
                  createdAt: true,
                  updatedAt: true,
                  taskGroup: { select: { name: true } },
                },
              },
            },
          },
        },
        orderBy: { name: "asc" },
      });

      const matchingCards = boards.flatMap((board) =>
        board.columns.flatMap((column) => {
          const isDone = isDoneColumn(column.name);
          if (statusScope === "active" && isDone) return [];
          if (statusScope === "done" && !isDone) return [];
          if (boardNameFilter && !board.name.toLowerCase().includes(boardNameFilter)) return [];

          return column.cards
            .map((card) => {
              const assignees = resolveAssigneeNames(card.assignees, assigneeNameMap);
              const labels = parseJsonArray(card.labels);
              const searchHaystack = [
                board.name,
                column.name,
                card.title,
                card.body ?? "",
                card.state ?? "",
                card.priority ?? "",
                card.taskGroup?.name ?? "",
                ...assignees,
                ...labels,
              ].join(" ").toLowerCase();

              if (assigneeFilter && !assignees.some((assignee) => assignee.toLowerCase().includes(assigneeFilter))) {
                return null;
              }

              if (searchFilter && !searchHaystack.includes(searchFilter)) {
                return null;
              }

              return {
                boardName: board.name,
                columnName: column.name,
                isDone,
                card,
                assignees,
                labels,
              };
            })
            .filter((item): item is NonNullable<typeof item> => Boolean(item));
        })
      );

      if (sortBy === "newest") {
        matchingCards.sort((a, b) => b.card.createdAt.getTime() - a.card.createdAt.getTime());
      } else if (sortBy === "updated") {
        matchingCards.sort((a, b) => b.card.updatedAt.getTime() - a.card.updatedAt.getTime());
      } else if (sortBy === "priority") {
        matchingCards.sort((a, b) => {
          const priorityDiff = priorityWeight(b.card.priority) - priorityWeight(a.card.priority);
          if (priorityDiff !== 0) return priorityDiff;
          return b.card.updatedAt.getTime() - a.card.updatedAt.getTime();
        });
      } else {
        matchingCards.sort((a, b) =>
          a.boardName.localeCompare(b.boardName)
          || a.columnName.localeCompare(b.columnName)
          || a.card.position - b.card.position
        );
      }

      const limitedCards = matchingCards.slice(0, limit);
      if (limitedCards.length === 0) {
        return statusScope === "all" ? "No matching tasks found." : `No matching ${statusScope} tasks found.`;
      }

      const scopeLabel = statusScope === "all" ? "tasks" : `${statusScope} tasks`;
      const lines: string[] = [
        `Found ${matchingCards.length} matching ${scopeLabel}. Showing ${limitedCards.length}${matchingCards.length > limitedCards.length ? ` of ${matchingCards.length}` : ""}.`,
      ];

      if (sortBy === "board") {
        let currentBoard = "";
        let currentColumn = "";
        for (const item of limitedCards) {
          if (item.boardName !== currentBoard) {
            currentBoard = item.boardName;
            currentColumn = "";
            lines.push(`Board: "${item.boardName}"`);
          }
          if (item.columnName !== currentColumn) {
            currentColumn = item.columnName;
            lines.push(`  [${item.columnName}]`);
          }
          const parts: string[] = [
            `    - [${item.card.id}] ${item.card.title}`,
            `priority: ${item.card.priority}`,
            `state: ${item.card.state}`,
            `created: ${item.card.createdAt.toISOString().slice(0, 10)}`,
            `updated: ${item.card.updatedAt.toISOString().slice(0, 10)}`,
          ];
          if (item.assignees.length > 0) parts.push(`assignees: ${item.assignees.join(", ")}`);
          if (item.card.taskGroup?.name) parts.push(`group: ${item.card.taskGroup.name}`);
          lines.push(parts.join(" | "));
        }
      } else {
        for (const item of limitedCards) {
          const parts: string[] = [
            `- [${item.card.id}] ${item.card.title}`,
            `${item.boardName} / ${item.columnName}`,
            `priority: ${item.card.priority}`,
            `state: ${item.card.state}`,
            `created: ${item.card.createdAt.toISOString().slice(0, 10)}`,
            `updated: ${item.card.updatedAt.toISOString().slice(0, 10)}`,
          ];
          if (item.assignees.length > 0) parts.push(`assignees: ${item.assignees.join(", ")}`);
          if (item.card.taskGroup?.name) parts.push(`group: ${item.card.taskGroup.name}`);
          lines.push(parts.join(" | "));
        }
      }

      return lines.join("\n");
    }

    // ── list_kanban_boards ───────────────────────────────────────────────────
    case "list_kanban_boards": {
      const assigneeNameMap = await buildAssigneeNameMap();
      const boards = await prisma.kanbanBoard.findMany({
        include: {
          columns: {
            orderBy: { position: "asc" },
            include: {
              cards: {
                orderBy: { position: "asc" },
                select: {
                  id: true,
                  title: true,
                  priority: true,
                  state: true,
                  labels: true,
                  assignees: true,
                },
              },
            },
          },
        },
      });

      if (!boards.length) return "No kanban boards found.";

      return boards
        .map((board) => {
          const cols = board.columns
            .map((col) => {
              const cards = col.cards.length
                ? col.cards
                    .map((c) => {
                      const assignees = resolveAssigneeNames(c.assignees, assigneeNameMap);
                      const meta = [
                        c.priority,
                        c.state,
                        assignees.length > 0 ? `assignees: ${assignees.join(", ")}` : null,
                      ].filter(Boolean).join(", ");
                      return `    - [${c.id}] ${c.title}${meta ? ` (${meta})` : ""}`;
                    })
                    .join("\n")
                : "    (empty)";
              return `  Column: "${col.name}" [id: ${col.id}]\n${cards}`;
            })
            .join("\n");
          return `Board: "${board.name}" [id: ${board.id}]\n${cols}`;
        })
        .join("\n\n");
    }

    // ── create_kanban_card ───────────────────────────────────────────────────
    case "create_kanban_card": {
      const columnId = String(args.column_id ?? "").trim();
      const title = String(args.title ?? "").trim();
      if (!columnId || !title) return "Error: column_id and title are required.";

      const column = await prisma.kanbanColumn.findUnique({ where: { id: columnId } });
      if (!column) return `Error: Column "${columnId}" not found.`;

      const agg = await prisma.kanbanCard.aggregate({
        where: { columnId },
        _max: { position: true },
      });

      const card = await prisma.kanbanCard.create({
        data: {
          columnId,
          title,
          body: typeof args.body === "string" ? args.body : undefined,
          priority: typeof args.priority === "string" ? args.priority : undefined,
          state: typeof args.state === "string" ? args.state : undefined,
          labels: JSON.stringify(Array.isArray(args.labels) ? args.labels : []),
          assignees: JSON.stringify(Array.isArray(args.assignees) ? args.assignees : []),
          position: (agg._max.position ?? -1) + 1,
        },
      });

      return `Created card "${card.title}" [id: ${card.id}] in column "${column.name}".`;
    }

    // ── update_kanban_card ───────────────────────────────────────────────────
    case "update_kanban_card": {
      const cardId = String(args.card_id ?? "").trim();
      if (!cardId) return "Error: card_id is required.";

      const existing = await prisma.kanbanCard.findUnique({ where: { id: cardId } });
      if (!existing) return `Error: Card "${cardId}" not found.`;

      const data: Record<string, unknown> = {};
      if (typeof args.title === "string") data.title = args.title;
      if (typeof args.body === "string") data.body = args.body;
      if (typeof args.priority === "string") data.priority = args.priority;
      if (typeof args.state === "string") data.state = args.state;
      if (Array.isArray(args.labels)) data.labels = JSON.stringify(args.labels);
      if (Array.isArray(args.assignees)) data.assignees = JSON.stringify(args.assignees);

      if (!Object.keys(data).length) return "No fields provided to update.";

      const updated = await prisma.kanbanCard.update({ where: { id: cardId }, data });
      return `Updated card "${updated.title}" [id: ${updated.id}].`;
    }

    // ── move_kanban_card ─────────────────────────────────────────────────────
    case "move_kanban_card": {
      const cardId = String(args.card_id ?? "").trim();
      const columnId = String(args.column_id ?? "").trim();
      if (!cardId || !columnId) return "Error: card_id and column_id are required.";

      const [card, column] = await Promise.all([
        prisma.kanbanCard.findUnique({ where: { id: cardId } }),
        prisma.kanbanColumn.findUnique({ where: { id: columnId } }),
      ]);
      if (!card) return `Error: Card "${cardId}" not found.`;
      if (!column) return `Error: Column "${columnId}" not found.`;

      const agg = await prisma.kanbanCard.aggregate({
        where: { columnId },
        _max: { position: true },
      });

      await prisma.kanbanCard.update({
        where: { id: cardId },
        data: { columnId, position: (agg._max.position ?? -1) + 1 },
      });

      return `Moved card "${card.title}" → column "${column.name}".`;
    }

    // ── delete_kanban_card ───────────────────────────────────────────────────
    case "delete_kanban_card": {
      const cardId = String(args.card_id ?? "").trim();
      if (!cardId) return "Error: card_id is required.";

      const card = await prisma.kanbanCard.findUnique({ where: { id: cardId } });
      if (!card) return `Error: Card "${cardId}" not found.`;

      await prisma.kanbanCard.delete({ where: { id: cardId } });
      return `Deleted card "${card.title}" [id: ${cardId}].`;
    }

    // ── get_customer_details ─────────────────────────────────────────────────
    case "get_customer_details": {
      const nameQuery = String(args.name ?? "").trim();
      if (!nameQuery) return "Error: name is required.";

      const twoWeeksAgo = new Date();
      twoWeeksAgo.setDate(twoWeeksAgo.getDate() - 16);

      const [customer, weeklyNotes] = await Promise.all([
        prisma.oilWell.findFirst({
          where: { name: { contains: nameQuery, mode: "insensitive" } },
          include: {
            contacts: {
              select: { name: true, title: true, email: true, isPrimary: true },
              orderBy: { isPrimary: "desc" },
            },
          },
        }),
        prisma.weeklyNote.findMany({
          where: { weekStart: { gte: twoWeeksAgo } },
          include: { entries: { orderBy: { order: "asc" } } },
          orderBy: { weekStart: "desc" },
          take: 2,
        }),
      ]);

      if (!customer) return `No customer found matching "${nameQuery}".`;

      const lines: string[] = [
        `Oil Well: ${customer.name}`,
        `  Tier: ${mapWellPriorityToTier(customer.priority)}  Health: ${mapWellPriorityToHealthScore(customer.priority)}/5  Status: ${customer.status}`,
      ];

      if (customer.contacts.length > 0) {
        lines.push("  Contacts:");
        for (const c of customer.contacts) {
          let line = `    - ${c.name}`;
          if (c.title) line += ` (${c.title})`;
          if (c.email) line += ` <${c.email}>`;
          if (c.isPrimary) line += " [primary]";
          lines.push(line);
        }
      }

      // Include weekly note entries for this customer
      const customerNameLower = customer.name.toLowerCase();
      const relevantEntries = weeklyNotes.flatMap((note) =>
        note.entries
          .filter((e) => e.customerName.toLowerCase().includes(customerNameLower))
          .map((e) => ({ weekStart: note.weekStart, entry: e }))
      );

      if (relevantEntries.length > 0) {
        lines.push("  Recent weekly notes:");
        for (const { weekStart, entry } of relevantEntries) {
          lines.push(`    Week of ${formatWeekStart(weekStart)}:`);
          const items = parseWeeklyItems(entry.items).filter((i) => i.content?.trim());
          for (const item of items.slice(0, 10)) {
            const check = item.isChecked ? "[x]" : "[ ]";
            const indent = "  ".repeat((item.indent ?? 0) + 3);
            lines.push(`${indent}${check} ${item.content}`);
          }
          if (items.length > 10) lines.push(`      ... +${items.length - 10} more`);
        }
      }

      return lines.join("\n");
    }

    // ── get_weekly_notes ─────────────────────────────────────────────────────
    case "get_weekly_notes": {
      const twoWeeksAgo = new Date();
      twoWeeksAgo.setDate(twoWeeksAgo.getDate() - 16);

      const weeklyNotes = await prisma.weeklyNote.findMany({
        where: { weekStart: { gte: twoWeeksAgo } },
        include: { entries: { orderBy: { order: "asc" } } },
        orderBy: { weekStart: "desc" },
        take: 2,
      });

      if (!weeklyNotes.length) return "No weekly notes found for the past two weeks.";

      const lines: string[] = [];
      for (const week of weeklyNotes) {
        lines.push(`Week of ${formatWeekStart(week.weekStart)}`);
        if (week.entries.length === 0) {
          lines.push("  (no entries)");
          continue;
        }
        for (const entry of week.entries) {
          lines.push(`  ${entry.customerName}:`);
          const items = parseWeeklyItems(entry.items).filter((i) => i.content?.trim());
          if (items.length === 0) {
            lines.push("    (empty)");
          } else {
            for (const item of items.slice(0, 10)) {
              const check = item.isChecked ? "[x]" : "[ ]";
              const indent = "  ".repeat((item.indent ?? 0) + 2);
              lines.push(`${indent}${check} ${item.content}`);
            }
            if (items.length > 10) lines.push(`    ... +${items.length - 10} more`);
          }
        }
      }

      return lines.join("\n");
    }

    // ── list_repos ───────────────────────────────────────────────────────────
    case "list_repos": {
      const repos = await prisma.repo.findMany({
        where: { connected: true },
        orderBy: { name: "asc" },
        select: {
          id: true,
          name: true,
          fullName: true,
          description: true,
          language: true,
          url: true,
          starCount: true,
          openIssues: true,
          pushedAt: true,
        },
      });

      if (!repos.length) return "No connected repositories found.";

      return repos
        .map((r) => {
          const meta = [r.language, r.starCount ? `${r.starCount} stars` : null, r.openIssues ? `${r.openIssues} open issues` : null]
            .filter(Boolean)
            .join(", ");
          const lastPush = r.pushedAt ? `Last push: ${r.pushedAt.toISOString().slice(0, 10)}` : null;
          return [
            `Repo: "${r.name}" [id: ${r.id}]`,
            `  Full name: ${r.fullName}`,
            r.description ? `  Description: ${r.description}` : null,
            meta ? `  ${meta}` : null,
            lastPush ? `  ${lastPush}` : null,
            `  URL: ${r.url}`,
          ]
            .filter(Boolean)
            .join("\n");
        })
        .join("\n\n");
    }

    // ── get_repo_details ─────────────────────────────────────────────────────
    case "get_repo_details": {
      const repoId = String(args.repo_id ?? "").trim();
      if (!repoId) return "Error: repo_id is required.";

      const repo = await prisma.repo.findUnique({
        where: { id: repoId },
        include: {
          boards: {
            include: {
              columns: {
                orderBy: { position: "asc" },
                include: {
                  cards: {
                    orderBy: { position: "asc" },
                    select: { id: true, title: true, priority: true, state: true },
                  },
                },
              },
            },
          },
          awsLinks: {
            select: { service: true, label: true, resourceId: true },
          },
        },
      });

      if (!repo) return `Error: Repository "${repoId}" not found.`;

      const lines: string[] = [
        `Repo: "${repo.name}" [id: ${repo.id}]`,
        `  Full name: ${repo.fullName}`,
        repo.description ? `  Description: ${repo.description}` : null,
        `  Language: ${repo.language ?? "unknown"}`,
        `  Stars: ${repo.starCount}  Open issues: ${repo.openIssues}`,
        repo.pushedAt ? `  Last push: ${repo.pushedAt.toISOString().slice(0, 10)}` : null,
        `  URL: ${repo.url}`,
      ].filter((l): l is string => l !== null);

      if (repo.awsLinks.length) {
        lines.push("  AWS resources:");
        repo.awsLinks.forEach((l) => lines.push(`    - ${l.service}: ${l.label} (${l.resourceId})`));
      }

      repo.boards.forEach((board) => {
        lines.push(`  Kanban board: "${board.name}" [id: ${board.id}]`);
        board.columns.forEach((col) => {
          lines.push(`    Column "${col.name}" [id: ${col.id}]: ${col.cards.length} cards`);
          col.cards.forEach((c) => lines.push(`      - [${c.id}] ${c.title}`));
        });
      });

      return lines.join("\n");
    }

    default:
      return `Error: Unknown tool "${name}".`;
  }
}
