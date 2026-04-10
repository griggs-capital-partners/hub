import { prisma } from "./prisma";
import { mapWellPriorityToTier } from "./well-compat";

function parseJsonArray(raw: string): string[] {
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter((item): item is string => typeof item === "string") : [];
  } catch {
    return [];
  }
}

export async function buildOrgContext(): Promise<string> {
  const [users, repos, knowledgeRepo, wells, agents, boards] = await Promise.all([
    prisma.user.findMany({
      select: { name: true, displayName: true },
      orderBy: { name: "asc" },
    }),
    prisma.repo.findMany({
      where: { connected: true },
      select: { name: true, fullName: true, language: true, description: true, openIssues: true },
      orderBy: { name: "asc" },
    }),
    prisma.knowledgeRepo.findFirst({
      select: { repoOwner: true, repoName: true, branch: true, description: true },
    }),
    prisma.oilWell.findMany({
      where: { status: { not: "inactive" } },
      select: { name: true, priority: true, status: true },
      orderBy: [{ priority: "asc" }, { name: "asc" }],
    }),
    prisma.aIAgent.findMany({
      select: { name: true, role: true, status: true },
      orderBy: { name: "asc" },
    }),
    prisma.kanbanBoard.findMany({
      select: {
        name: true,
        columns: {
          orderBy: { position: "asc" },
          select: {
            name: true,
            cards: {
              orderBy: [{ createdAt: "desc" }],
              take: 3,
              select: {
                title: true,
                createdAt: true,
              },
            },
          },
        },
      },
      orderBy: { name: "asc" },
    }),
  ]);

  const sections: string[] = [];

  sections.push(
    "## Griggs Capital Partners — Live Organization Context\n" +
    "The following is real-time data from the hub. Use it to give accurate, grounded answers about the team, codebase, current work, and customers. " +
    "Treat this as your internal knowledge — do not preface answers with 'according to the data' or similar hedging.\n" +
    "Use your available tools to fetch active tasks, full customer details, or weekly notes when the conversation calls for them."
  );

  // ── Team ──────────────────────────────────────────────────────────────────
  if (users.length > 0) {
    const lines = users.map((u) => `- ${u.displayName || u.name || "Unknown"}`);
    sections.push(`### Team (${users.length} members)\n${lines.join("\n")}`);
  }

  if (agents.length > 0) {
    const lines = agents.map((a) => `- ${a.name} — ${a.role} [${a.status}]`);
    sections.push(`### AI Agents\n${lines.join("\n")}`);
  }

  const activeBoardSummaries = boards
    .map((board) => {
      const activeColumns = board.columns.filter((column) => !isDoneColumn(column.name));
      const activeCount = activeColumns.reduce((sum, column) => sum + column.cards.length, 0);
      return activeCount > 0
        ? {
            name: board.name,
            activeCount,
            activeColumns,
          }
        : null;
    })
    .filter((board): board is NonNullable<typeof board> => Boolean(board))
    .sort((a, b) => b.activeCount - a.activeCount || a.name.localeCompare(b.name));

  if (activeBoardSummaries.length > 0) {
    const totalActiveTasks = activeBoardSummaries.reduce((sum, board) => sum + board.activeCount, 0);
    const recentCards = boards
      .flatMap((board) =>
        board.columns.flatMap((column) =>
          column.cards.map((card) => ({
            boardName: board.name,
            columnName: column.name,
            title: card.title,
            createdAt: card.createdAt,
          }))
        )
      )
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
      .slice(0, 5);

    const boardLines = activeBoardSummaries
      .slice(0, 8)
      .map((board) => {
        const columnSummary = board.activeColumns
          .filter((column) => column.cards.length > 0)
          .map((column) => `${column.name}: ${column.cards.length}`)
          .join(", ");
        return `- ${board.name} (${board.activeCount} active)${columnSummary ? ` — ${columnSummary}` : ""}`;
      });

    const recentLines = recentCards.map(
      (card) => `- ${card.title} — ${card.boardName} / ${card.columnName} (${card.createdAt.toISOString().slice(0, 10)})`
    );

    sections.push(
      `### Planner / Kanban\n` +
      `In this workspace, "tasks", "planner", "kanban", "board", "cards", and "work items" usually refer to the internal planner/kanban system, not code repositories.\n` +
      `There are currently ${totalActiveTasks} active tasks across ${activeBoardSummaries.length} active boards.\n` +
      `${boardLines.join("\n")}\n` +
      `_Call \`get_active_tasks\` for live task lists, newest tasks, active work, board-specific questions, and assignee lookups._\n` +
      (recentLines.length > 0 ? `Recent cards:\n${recentLines.join("\n")}` : "")
    );
  }

  // ── Repositories ──────────────────────────────────────────────────────────
  if (repos.length > 0) {
    const knowledgeFullName = knowledgeRepo ? `${knowledgeRepo.repoOwner}/${knowledgeRepo.repoName}` : null;

    const lines = repos.map((r) => {
      let line = `- ${r.fullName}`;
      if (r.language) line += ` (${r.language})`;
      if (r.description) line += ` — ${r.description}`;
      if (r.openIssues > 0) line += ` [${r.openIssues} open issues]`;
      if (knowledgeFullName && r.fullName.toLowerCase() === knowledgeFullName.toLowerCase()) {
        line += " ⟵ KNOWLEDGE BASE";
      }
      return line;
    });
    sections.push(`### Repositories (${repos.length})\n${lines.join("\n")}`);
  }

  if (knowledgeRepo) {
    const kbLines = [
      `GitHub: ${knowledgeRepo.repoOwner}/${knowledgeRepo.repoName} (branch: ${knowledgeRepo.branch})`,
    ];
    if (knowledgeRepo.description) kbLines.push(`Description: ${knowledgeRepo.description}`);
    kbLines.push(
      "Primary source of truth for internal docs, specs, and processes. " +
      "File structure and contents are fetched on demand via the retrieval layer."
    );
    sections.push(`### Knowledge Base\n${kbLines.join("\n")}`);
  }

  // ── Oil Wells (name + priority tier only — call get_customer_details for full info)
  if (wells.length > 0) {
    const lines = wells.map((well) => {
      let line = `- ${well.name} (${mapWellPriorityToTier(well.priority)})`;
      if (well.priority) line += ` [priority: ${well.priority}]`;
      if (well.status !== "active") line += ` [${well.status}]`;
      return line;
    });
    sections.push(
      `### Oil Wells (${wells.length} active)\n` +
      `${lines.join("\n")}\n` +
      `_Call \`get_customer_details\` for contacts and notes on any well._`
    );
  }

  return sections.join("\n\n");
}

// ── Shared helpers used by agent-tools.ts ────────────────────────────────────

export const DONE_COLUMN_NAMES = new Set(["done", "deployed", "closed", "complete", "completed", "released", "shipped"]);

export function isDoneColumn(columnName: string) {
  return DONE_COLUMN_NAMES.has(columnName.toLowerCase().trim());
}

export function parseWeeklyItems(raw: string): Array<{ content?: string; isChecked?: boolean; indent?: number }> {
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function formatWeekStart(date: Date): string {
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

export { parseJsonArray };
