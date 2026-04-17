import { prisma } from "./prisma";
import { parseKanbanSubtasks } from "./kanban-subtasks";
import { mapWellPriorityToHealthScore, mapWellPriorityToTier } from "./well-compat";
import { DEFAULT_AGENT_LLM_ROUTING_POLICY, type AgentLlmRoutingPolicy } from "./agent-llm-config";

export const AGENT_ACTION_TYPES = {
  generate_docs: {
    label: "Generate Documentation",
    description: "Write technical docs from task description and context",
    prompt:
      "Generate comprehensive technical documentation for this task. Include: purpose and business context, technical approach and architecture, any API or component details, edge cases, and usage/integration examples. Format with clear headings and be specific to this task's details.",
  },
  write_tests: {
    label: "Write Test Cases",
    description: "Generate QA and unit test scenarios for this feature",
    prompt:
      "Generate thorough test cases for this task. Include: unit test scenarios with inputs/outputs, integration test cases, edge cases and boundary conditions, acceptance criteria checklist, and manual QA steps. Be specific to the task's functionality.",
  },
  code_review: {
    label: "Review Implementation",
    description: "Assess technical approach and implementation quality",
    prompt:
      "Review the implementation approach for this task. Analyze: technical design decisions, potential security concerns, performance implications, code quality and maintainability, alignment with existing patterns in the codebase, and specific recommendations for improvement.",
  },
  break_down: {
    label: "Break Down Task",
    description: "Decompose into concrete subtasks with dependencies",
    prompt:
      "Break this task into concrete, actionable subtasks. For each subtask include: a clear title, what needs to be done, estimated complexity (S/M/L), dependencies on other subtasks, and which team role should handle it. Order them by execution sequence.",
  },
  estimate_points: {
    label: "Estimate Story Points",
    description: "Analyze complexity and suggest story point value",
    prompt:
      "Estimate the story points for this task using Fibonacci scale (1, 2, 3, 5, 8, 13). Analyze: technical complexity, unknowns and risks, scope of changes required, testing effort, and integration points. Provide your estimate with detailed reasoning.",
  },
  draft_pr: {
    label: "Draft PR Description",
    description: "Create a ready-to-paste pull request description",
    prompt:
      "Write a pull request description for this task. Include: a concise title, summary of what changed and why, list of changes made, how to test the changes, any deployment notes or migration steps, and screenshots placeholder if UI changes. Format it as a GitHub PR description.",
  },
  identify_risks: {
    label: "Identify Risks & Blockers",
    description: "Surface dependencies, risks, and potential blockers",
    prompt:
      "Identify risks, blockers, and dependencies for this task. Cover: technical risks and unknowns, external dependencies (APIs, services, teams), customer impact if delayed or broken, testing complexity, performance risks, and recommended mitigation strategies for each risk identified.",
  },
  customer_update: {
    label: "Write Customer Update",
    description: "Draft a customer-facing progress or completion summary",
    prompt:
      "Write a customer-facing update about this task. Tone: professional, non-technical, focused on business value. Include: what is being built and why it matters to the customer, current status, expected timeline, and any action required from the customer. Keep it concise and positive.",
  },
  suggest_implementation: {
    label: "Suggest Implementation",
    description: "Recommend a technical approach with steps",
    prompt:
      "Suggest a concrete implementation approach for this task. Include: recommended architecture or pattern, step-by-step implementation plan, files/components likely to be touched, potential libraries or tools to use, and pitfalls to avoid. Ground your suggestions in the existing codebase context.",
  },
  qa_checklist: {
    label: "Generate QA Checklist",
    description: "Build acceptance criteria and testing checklist",
    prompt:
      "Generate a detailed QA checklist for this task. Include: functional acceptance criteria (done-when statements), browser/device testing requirements, performance benchmarks if applicable, regression test areas, accessibility considerations, and a sign-off checklist for the team.",
  },
} as const;

export type AgentActionType = keyof typeof AGENT_ACTION_TYPES;
export type AgentAbility = {
  id: string;
  label: string;
  description: string;
  prompt: string;
  policy?: AgentLlmRoutingPolicy;
};
export const ALL_AGENT_ACTION_TYPES = Object.keys(AGENT_ACTION_TYPES) as AgentActionType[];

export const DEFAULT_LLM_ROUTING_ABILITY: AgentAbility = {
  id: "llm_routing",
  label: "LLM Routing",
  description: "Defines how this agent should prefer speed, cost, context, coding strength, and escalation when routing conversations onto an allowed model.",
  prompt:
    "Use this ability as the structured routing policy for model selection. Keep the policy aligned with the agent's intended quality bar, escalation rules, and task mix. This is not an execution ability for user-facing work products.",
  policy: DEFAULT_AGENT_LLM_ROUTING_POLICY,
};

function ensureRoutingAbility(abilities: AgentAbility[]) {
  const routingAbility = abilities.find((ability) => ability.id === DEFAULT_LLM_ROUTING_ABILITY.id);
  if (routingAbility) {
    return abilities.map((ability) =>
      ability.id === DEFAULT_LLM_ROUTING_ABILITY.id
        ? {
            ...DEFAULT_LLM_ROUTING_ABILITY,
            ...ability,
            policy: ability.policy ?? DEFAULT_LLM_ROUTING_ABILITY.policy,
          }
        : ability
    );
  }

  return [...abilities, DEFAULT_LLM_ROUTING_ABILITY];
}

export function isAgentActionType(value: string): value is AgentActionType {
  return value in AGENT_ACTION_TYPES;
}

export function getDefaultAgentAbilities(): AgentAbility[] {
  return ensureRoutingAbility(ALL_AGENT_ACTION_TYPES.map((id) => ({
    id,
    label: AGENT_ACTION_TYPES[id].label,
    description: AGENT_ACTION_TYPES[id].description,
    prompt: AGENT_ACTION_TYPES[id].prompt,
  })));
}

export function slugifyAbilityId(value: string) {
  const normalized = value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");

  return normalized || `ability_${Math.random().toString(36).slice(2, 8)}`;
}

function coerceAbility(value: unknown): AgentAbility | null {
  if (typeof value === "string" && isAgentActionType(value)) {
    return {
      id: value,
      label: AGENT_ACTION_TYPES[value].label,
      description: AGENT_ACTION_TYPES[value].description,
      prompt: AGENT_ACTION_TYPES[value].prompt,
    };
  }

  if (!value || typeof value !== "object") return null;

  const raw = value as Partial<AgentAbility>;
  const id = typeof raw.id === "string" && raw.id.trim() ? slugifyAbilityId(raw.id) : "";
  const label = typeof raw.label === "string" ? raw.label.trim() : "";
  const description = typeof raw.description === "string" ? raw.description.trim() : "";
  const prompt = typeof raw.prompt === "string" ? raw.prompt.trim() : "";
  const policy = raw.policy && typeof raw.policy === "object"
    ? {
        ...DEFAULT_AGENT_LLM_ROUTING_POLICY,
        ...raw.policy,
        escalationConditions: Array.isArray((raw.policy as Partial<AgentLlmRoutingPolicy>).escalationConditions)
          ? (raw.policy as Partial<AgentLlmRoutingPolicy>).escalationConditions!.filter(
              (entry): entry is string => typeof entry === "string" && entry.trim().length > 0
            )
          : DEFAULT_AGENT_LLM_ROUTING_POLICY.escalationConditions,
      }
    : undefined;

  if (!id || !label || !prompt) return null;
  return { id, label, description, prompt, ...(policy ? { policy } : {}) };
}

export function parseAgentAbilities(raw: string | null | undefined): AgentAbility[] {
  try {
    const parsed = JSON.parse(raw ?? "[]");
    if (!Array.isArray(parsed)) return [];
    return parsed
      .map((value) => coerceAbility(value))
      .filter((value): value is AgentAbility => Boolean(value));
  } catch {
    return [];
  }
}

export function normalizeAgentAbilities(raw: string | null | undefined): AgentAbility[] {
  const parsed = parseAgentAbilities(raw);
  return parsed.length > 0 ? ensureRoutingAbility(parsed) : getDefaultAgentAbilities();
}

export function normalizeAgentAbilitiesInput(value: unknown): AgentAbility[] {
  if (typeof value === "string") return normalizeAgentAbilities(value);

  if (Array.isArray(value)) {
    const parsed = value
      .map((entry) => coerceAbility(entry))
      .filter((entry): entry is AgentAbility => Boolean(entry));

    return parsed.length > 0 ? ensureRoutingAbility(parsed) : getDefaultAgentAbilities();
  }

  return getDefaultAgentAbilities();
}

export function findAgentAbility(raw: string | null | undefined, abilityId: string): AgentAbility | null {
  return normalizeAgentAbilities(raw).find((ability) => ability.id === abilityId) ?? null;
}

export function resolveAgentActionLabel(actionType: string, rawAbilities?: string | null) {
  return findAgentAbility(rawAbilities, actionType)?.label ?? actionType
    .split("_")
    .filter(Boolean)
    .map((part) => part[0]?.toUpperCase() + part.slice(1))
    .join(" ");
}

export function resolveAgentActionDescription(actionType: string, rawAbilities?: string | null) {
  return findAgentAbility(rawAbilities, actionType)?.description ?? "";
}

export function resolveAgentActionPrompt(actionType: string, rawAbilities?: string | null) {
  return findAgentAbility(rawAbilities, actionType)?.prompt ?? null;
}

export function resolveAgentLlmRoutingPolicy(rawAbilities?: string | null) {
  return findAgentAbility(rawAbilities, DEFAULT_LLM_ROUTING_ABILITY.id)?.policy ?? DEFAULT_LLM_ROUTING_ABILITY.policy!;
}

export interface TaskContext {
  task: {
    id: string;
    title: string;
    body: string | null;
    subtasks: { title: string; state: string }[];
    priority: string;
    state: string;
    labels: string[];
    assignees: string[];
    githubIssueUrl: string | null;
    column: string;
    board: string;
  };
  taskGroup: { name: string; status: string; description: string | null } | null;
  sprint: { name: string; goal: string | null; status: string } | null;
  linkedRepos: { name: string; fullName: string; language: string | null; description: string | null }[];
  customers: {
    name: string;
    tier: string;
    healthScore: number;
    status: string;
    industry: string | null;
    contacts: { name: string; title: string | null }[];
    recentNotes: { type: string; body: string }[];
  }[];
  issueNotes: { author: string; body: string; createdAt: string }[];
  knowledgeBase: { owner: string; repo: string; branch: string; description: string | null } | null;
}

export async function buildTaskContext(kanbanCardId: string): Promise<TaskContext> {
  const card = await prisma.kanbanCard.findUnique({
    where: { id: kanbanCardId },
    include: {
      column: {
        include: {
          board: {
            include: { repo: { select: { name: true, fullName: true } } },
          },
        },
      },
      taskGroup: { select: { name: true, status: true, description: true } },
      wells: {
        include: {
          contacts: {
            where: { isPrimary: true },
            select: { name: true, title: true },
            take: 3,
          },
          noteItems: {
            orderBy: { createdAt: "desc" },
            select: { type: true, body: true },
            take: 5,
          },
        },
      },
      notes: {
        include: {
          author: { select: { name: true, displayName: true } },
        },
        orderBy: { createdAt: "desc" },
        take: 15,
      },
      sprintTask: {
        include: { sprint: { select: { name: true, goal: true, status: true } } },
      },
      linkedRepos: {
        include: {
          repo: { select: { name: true, fullName: true, language: true, description: true } },
        },
      },
    },
  });

  if (!card) {
    throw new Error(`KanbanCard ${kanbanCardId} not found`);
  }

  const knowledgeBase = await prisma.knowledgeRepo.findFirst({
    select: { repoOwner: true, repoName: true, branch: true, description: true },
  });

  const parseStrArray = (raw: string): string[] => {
    try {
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed.filter((v): v is string => typeof v === "string") : [];
    } catch {
      return [];
    }
  };

  const boardName = card.column.board.repo?.name ?? "General";

  return {
    task: {
      id: card.id,
      title: card.title,
      body: card.body,
      subtasks: parseKanbanSubtasks(card.subtasks).map((subtask) => ({
        title: subtask.title,
        state: subtask.state,
      })),
      priority: card.priority,
      state: card.state,
      labels: parseStrArray(card.labels),
      assignees: parseStrArray(card.assignees),
      githubIssueUrl: card.githubIssueUrl,
      column: card.column.name,
      board: boardName,
    },
    taskGroup: card.taskGroup
      ? { name: card.taskGroup.name, status: card.taskGroup.status, description: card.taskGroup.description }
      : null,
    sprint: card.sprintTask?.sprint
      ? { name: card.sprintTask.sprint.name, goal: card.sprintTask.sprint.goal, status: card.sprintTask.sprint.status }
      : null,
    linkedRepos: card.linkedRepos.map((lr) => ({
      name: lr.repo.name,
      fullName: lr.repo.fullName,
      language: lr.repo.language,
      description: lr.repo.description,
    })),
    customers: card.wells.map((c) => ({
      name: c.name,
      tier: mapWellPriorityToTier(c.priority),
      healthScore: mapWellPriorityToHealthScore(c.priority),
      status: c.status,
      industry: c.address,
      contacts: c.contacts.map((contact) => ({ name: contact.name, title: contact.title })),
      recentNotes: c.noteItems.map((n) => ({ type: n.type, body: n.body })),
    })),
    issueNotes: card.notes.map((n) => ({
      author: n.author.displayName ?? n.author.name ?? "Unknown",
      body: n.body,
      createdAt: n.createdAt.toISOString(),
    })),
    knowledgeBase: knowledgeBase
      ? {
          owner: knowledgeBase.repoOwner,
          repo: knowledgeBase.repoName,
          branch: knowledgeBase.branch,
          description: knowledgeBase.description,
        }
      : null,
  };
}

export function formatTaskContextForLlm(ctx: TaskContext): string {
  const lines: string[] = [];

  lines.push("## Task Being Worked On");
  lines.push(`**Title:** ${ctx.task.title}`);
  lines.push(`**Priority:** ${ctx.task.priority} | **State:** ${ctx.task.state} | **Column:** ${ctx.task.column} (${ctx.task.board} board)`);

  if (ctx.task.labels.length > 0) {
    lines.push(`**Labels:** ${ctx.task.labels.join(", ")}`);
  }
  if (ctx.task.assignees.length > 0) {
    lines.push(`**Assignees:** ${ctx.task.assignees.join(", ")}`);
  }
  if (ctx.task.githubIssueUrl) {
    lines.push(`**GitHub Issue:** ${ctx.task.githubIssueUrl}`);
  }
  if (ctx.task.body?.trim()) {
    lines.push(`\n**Description:**\n${ctx.task.body.trim()}`);
  }
  if (ctx.task.subtasks.length > 0) {
    lines.push("\n**Subtasks:**");
    for (const subtask of ctx.task.subtasks) {
      lines.push(`- [${subtask.state}] ${subtask.title}`);
    }
  }

  if (ctx.taskGroup) {
    lines.push(`\n## Task Group: ${ctx.taskGroup.name} [${ctx.taskGroup.status}]`);
    if (ctx.taskGroup.description) lines.push(ctx.taskGroup.description);
  }

  if (ctx.sprint) {
    lines.push(`\n## Sprint: ${ctx.sprint.name} [${ctx.sprint.status}]`);
    if (ctx.sprint.goal) lines.push(`Goal: ${ctx.sprint.goal}`);
  }

  if (ctx.linkedRepos.length > 0) {
    lines.push("\n## Linked Repositories");
    for (const repo of ctx.linkedRepos) {
      let line = `- **${repo.fullName}**`;
      if (repo.language) line += ` (${repo.language})`;
      if (repo.description) line += ` — ${repo.description}`;
      lines.push(line);
    }
  }

  if (ctx.customers.length > 0) {
    lines.push("\n## Affected Customers");
    for (const customer of ctx.customers) {
      lines.push(`\n### ${customer.name} (${customer.tier}, health: ${customer.healthScore}/5)`);
      if (customer.industry) lines.push(`Industry: ${customer.industry}`);
      if (customer.contacts.length > 0) {
        const contacts = customer.contacts.map((c) => (c.title ? `${c.name} (${c.title})` : c.name)).join(", ");
        lines.push(`Primary contacts: ${contacts}`);
      }
      if (customer.recentNotes.length > 0) {
        lines.push("Recent notes:");
        for (const note of customer.recentNotes) {
          lines.push(`  [${note.type}] ${note.body.substring(0, 200)}${note.body.length > 200 ? "…" : ""}`);
        }
      }
    }
  }

  if (ctx.issueNotes.length > 0) {
    lines.push("\n## Team Discussion Notes");
    for (const note of ctx.issueNotes) {
      const date = new Date(note.createdAt).toLocaleDateString("en-US", { month: "short", day: "numeric" });
      lines.push(`**${note.author}** (${date}): ${note.body.substring(0, 300)}${note.body.length > 300 ? "…" : ""}`);
    }
  }

  if (ctx.knowledgeBase) {
    lines.push("\n## Knowledge Base");
    lines.push(`Repo: ${ctx.knowledgeBase.owner}/${ctx.knowledgeBase.repo} (branch: ${ctx.knowledgeBase.branch})`);
    if (ctx.knowledgeBase.description) lines.push(ctx.knowledgeBase.description);
  }

  return lines.join("\n");
}
