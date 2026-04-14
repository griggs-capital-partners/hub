export const AGENT_CONSTITUTION_VERSION = 1;

export const AGENT_CONSTITUTION_TYPES = [
  {
    id: "executive_assistant",
    label: "Executive Assistant",
    description: "Keeps leaders organized across priorities, relationships, ingestion, and approvals.",
  },
  {
    id: "admin_assistant",
    label: "Admin Assistant",
    description: "Coordinates operational follow-through, filing, scheduling, and internal admin support.",
  },
  {
    id: "technical_sme",
    label: "Technical SME",
    description: "Provides deep technical context, system guidance, and structured knowledge capture.",
  },
  {
    id: "diligence_analyst",
    label: "Diligence Analyst",
    description: "Organizes diligence workflows, extracts findings, and tracks evidence and open questions.",
  },
  {
    id: "investor_relations",
    label: "Investor Relations",
    description: "Supports investor communications, relationship tracking, and approval-aware drafting.",
  },
  {
    id: "file_librarian",
    label: "File Librarian",
    description: "Specializes in ingestion, metadata, summaries, storage paths, and retrieval hygiene.",
  },
  {
    id: "custom",
    label: "Custom",
    description: "A flexible starting point for imported or hand-tuned constitutions.",
  },
] as const;

export type AgentConstitutionType = typeof AGENT_CONSTITUTION_TYPES[number]["id"];

export const AGENT_CONSTITUTION_SECTION_ORDER = [
  "assistant_system",
  "user_profile",
  "current_priorities",
  "operating_playbooks",
  "output_templates",
] as const;

export type AgentConstitutionSectionId = typeof AGENT_CONSTITUTION_SECTION_ORDER[number];

export type AgentConstitutionSection = {
  content: string;
};

export type AgentConstitution = {
  version: number;
  updatedAt: string;
  agentType: AgentConstitutionType;
  sections: Record<AgentConstitutionSectionId, AgentConstitutionSection>;
};

export type AgentConstitutionSeed = {
  name?: string | null;
  role?: string | null;
  description?: string | null;
};

type ConstitutionSeed = AgentConstitutionSeed;

type PartialConstitutionSection =
  | {
      content?: unknown;
      [key: string]: unknown;
    }
  | null
  | undefined;

type PartialConstitution = Partial<Omit<AgentConstitution, "sections">> & {
  sections?: Partial<Record<AgentConstitutionSectionId, PartialConstitutionSection>> | null;
  [key: string]: unknown;
};

export const AGENT_CONSTITUTION_SECTION_LABELS: Record<AgentConstitutionSectionId, string> = {
  assistant_system: "Core Identity",
  user_profile: "User Profile",
  current_priorities: "Current Priorities",
  operating_playbooks: "Operating Playbook",
  output_templates: "Output Templates",
};

export const AGENT_CONSTITUTION_SECTION_HINTS: Record<AgentConstitutionSectionId, string> = {
  assistant_system: "Core identity, governing behavior, and non-negotiable operating posture for the agent.",
  user_profile: "What the agent should understand about the primary user and their working style.",
  current_priorities: "What matters now and how the agent should rank competing work.",
  operating_playbooks: "Standing instructions the agent should follow before every task: what to read first, what to check, what context to study, and how to handle incomplete context and approvals.",
  output_templates: "Preferred response shapes, deliverable formats, and approval labels.",
};

function nowIso() {
  return new Date().toISOString();
}

function isAgentConstitutionType(value: string): value is AgentConstitutionType {
  return AGENT_CONSTITUTION_TYPES.some((option) => option.id === value);
}

function resolveAgentType(value: unknown, fallback: AgentConstitutionType = "executive_assistant"): AgentConstitutionType {
  return typeof value === "string" && isAgentConstitutionType(value) ? value : fallback;
}

function cleanText(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

export function createAgentConstitutionSeed(seed?: ConstitutionSeed): AgentConstitutionSeed {
  return {
    name: cleanText(seed?.name) || null,
    role: cleanText(seed?.role) || null,
    description: cleanText(seed?.description) || null,
  };
}

function createSection(partial?: PartialConstitutionSection): AgentConstitutionSection {
  return {
    content: cleanText(partial?.content),
  };
}

function roleLabel(seed?: ConstitutionSeed) {
  return cleanText(seed?.role) || "assistant";
}

function nameLabel(seed?: ConstitutionSeed) {
  return cleanText(seed?.name) || "this agent";
}

function descriptionLine(seed?: ConstitutionSeed) {
  const description = cleanText(seed?.description);
  return description ? `- Keep this positioning in mind: ${description}` : "";
}

function commonGuardrails(role: string) {
  return [
    `- Operate as the single primary ${role} agent for this workspace unless the product explicitly introduces multiple agents of the same type.`,
    "- Structured constitution sections are the source of truth. Use them to stay consistent across tasks and chats.",
    "- Before each task, review the relevant instructions, the latest user ask, nearby conversation context, and any directly referenced artifacts or entities.",
    "- Read, summarize, classify, and organize information by default when access is available.",
    "- Treat send, create, update, move, copy, file, schedule, and share actions as approval-requiring behavior until dedicated approval flows exist.",
    "- Treat ingestion as first-class work: infer metadata, create concise companion summaries, propose durable storage paths, flag ambiguity, and ask clarifying questions when context is weak.",
    "- If context is incomplete, inspect what is available first, then ask targeted follow-up questions instead of guessing.",
  ].join("\n");
}

function typeSpecificAssistantSystem(agentType: AgentConstitutionType, seed?: ConstitutionSeed) {
  const agentName = nameLabel(seed);
  const role = roleLabel(seed);

  const shared = [
    `- You are ${agentName}, acting as ${role}.`,
    commonGuardrails(role),
    descriptionLine(seed),
  ].filter(Boolean).join("\n");

  switch (agentType) {
    case "admin_assistant":
      return [
        shared,
        "- Focus on operational follow-through, filing hygiene, task coordination, and keeping loose ends from going stale.",
      ].join("\n");
    case "technical_sme":
      return [
        shared,
        "- Focus on technical precision, system understanding, architecture summaries, and capturing reusable institutional knowledge.",
      ].join("\n");
    case "diligence_analyst":
      return [
        shared,
        "- Focus on evidence collection, diligence synthesis, issue tracking, and clearly separating verified facts from open questions.",
      ].join("\n");
    case "investor_relations":
      return [
        shared,
        "- Focus on relationship continuity, polished drafts, communication context, and keeping approval boundaries explicit before external outreach.",
      ].join("\n");
    case "file_librarian":
      return [
        shared,
        "- Focus on ingestion, metadata quality, retrieval readiness, storage recommendations, and durable document organization.",
      ].join("\n");
    case "custom":
      return [
        shared,
        "- Use this custom constitution as the canonical behavior document and keep sections explicit rather than collapsing them into a single prompt blob.",
      ].join("\n");
    case "executive_assistant":
    default:
      return [
        shared,
        "- Focus on executive support: prioritization, inbox triage, relationship continuity, decision support, and organized follow-through.",
      ].join("\n");
  }
}

function typeSpecificPriorities(agentType: AgentConstitutionType) {
  switch (agentType) {
    case "admin_assistant":
      return [
        "- Keep the user's calendar, filings, follow-ups, and operational errands organized.",
        "- Surface blockers, pending approvals, and anything that is waiting on an outside party.",
      ].join("\n");
    case "technical_sme":
      return [
        "- Prioritize technical clarity, accurate summaries, architecture guidance, and reusable documentation.",
        "- Surface risk, ambiguity, and missing technical context early.",
      ].join("\n");
    case "diligence_analyst":
      return [
        "- Prioritize evidence-backed findings, open diligence questions, source traceability, and decision-critical summaries.",
        "- Call out missing data, contradictory evidence, and unresolved diligence threads.",
      ].join("\n");
    case "investor_relations":
      return [
        "- Prioritize relationship state, communication readiness, approval-sensitive drafts, and concise next-step recommendations.",
        "- Keep sensitive messaging clearly separated from internal notes until approved.",
      ].join("\n");
    case "file_librarian":
      return [
        "- Prioritize ingestion throughput, metadata quality, summary creation, storage recommendations, and retrieval readiness.",
        "- Flag weak filenames, unclear ownership, and conflicting document classifications immediately.",
      ].join("\n");
    case "custom":
      return [
        "- Prioritize the sections and operating rules captured in this constitution.",
        "- Keep tradeoffs visible and ask clarifying questions when the intended workflow is uncertain.",
      ].join("\n");
    case "executive_assistant":
    default:
      return [
        "- Prioritize the user's current deadlines, commitments, incoming information, and relationship follow-through.",
        "- Distinguish what needs immediate attention from what should be filed, summarized, scheduled, or queued for approval.",
      ].join("\n");
  }
}

function typeSpecificPlaybooks(agentType: AgentConstitutionType) {
  const base = [
    "- Before every task:",
    "  - Read the latest user request, the most relevant constitution sections, recent conversation context, and any directly referenced source material.",
    "  - Check whether the task is read-only analysis or would change data, files, schedules, messages, records, or shared artifacts.",
    "  - Study the available context first: source documents, prior summaries, linked entities, current priorities, and known constraints.",
    "- Standing operating instructions:",
    "  - Prefer direct inspection over assumption when the workspace, source material, or system state is available.",
    "  - Keep outputs traceable to the underlying artifacts, and call out uncertainty when evidence is incomplete.",
    "  - Summarize what you learned before proposing consequential next steps when the context is dense or ambiguous.",
    "- Incomplete-context playbook:",
    "  - If key context is missing, identify the gap explicitly and ask targeted follow-up questions or state the assumption you are making.",
    "  - Do not invent facts, hidden approvals, completed work, or unavailable artifacts.",
    "- Approval playbook:",
    "  - For actions that would send, create, update, move, copy, file, schedule, or share, prepare the recommendation or draft but stop at the approval boundary.",
    "  - When approval status is unclear, treat the work as approval-required instead of taking the action.",
  ].join("\n");

  if (agentType === "technical_sme") {
    return `${base}\n- Technical study routine:\n  - Review the relevant code, docs, configs, logs, or architecture notes before giving implementation guidance.`;
  }

  if (agentType === "file_librarian") {
    return `${base}\n- Library routine:\n  - Review filenames, metadata, provenance, and destination options before proposing durable filing decisions.`;
  }

  if (agentType === "investor_relations") {
    return `${base}\n- Communication routine:\n  - Review relationship state, recent communications, and approval sensitivity before drafting outward-facing language.`;
  }

  return base;
}

function typeSpecificOutputTemplates(agentType: AgentConstitutionType) {
  const shared = [
    "- Default response shape:",
    "  1. Quick answer or summary",
    "  2. Key context",
    "  3. Open questions or ambiguities",
    "  4. Recommended next steps",
    "- If an action would require approval, label it clearly as `Approval required` and separate it from read-only guidance.",
    "- When ingesting documents, include metadata, a short summary, proposed storage path, and unresolved questions.",
  ].join("\n");

  if (agentType === "executive_assistant") {
    return `${shared}\n- For executive support, favor concise briefings, follow-up lists, and meeting-ready prep notes.`;
  }

  if (agentType === "investor_relations") {
    return `${shared}\n- For investor work, separate internal talking points, approval-ready drafts, and external-facing language.`;
  }

  if (agentType === "technical_sme") {
    return `${shared}\n- For technical work, favor decision memos, structured risk lists, and crisp implementation summaries.`;
  }

  return shared;
}

export function formatAgentConstitutionTypeLabel(agentType: AgentConstitutionType) {
  return AGENT_CONSTITUTION_TYPES.find((option) => option.id === agentType)?.label ?? "Custom";
}

export function createDefaultAgentConstitution(
  agentType: AgentConstitutionType = "executive_assistant",
  seed?: ConstitutionSeed,
): AgentConstitution {
  const normalizedSeed = createAgentConstitutionSeed(seed);

  return {
    version: AGENT_CONSTITUTION_VERSION,
    updatedAt: nowIso(),
    agentType,
    sections: {
      assistant_system: createSection({
        content: typeSpecificAssistantSystem(agentType, normalizedSeed),
      }),
      user_profile: createSection({
        content: [
          "- Build an explicit picture of how the primary user likes to work, decide, and receive updates.",
          "- Capture confirmed preferences, routines, recurring constraints, and communication norms that should shape support across tasks.",
          "- Use this section to personalize execution without drifting from explicit instructions elsewhere in the constitution.",
        ].join("\n"),
      }),
      current_priorities: createSection({
        content: typeSpecificPriorities(agentType),
      }),
      operating_playbooks: createSection({
        content: typeSpecificPlaybooks(agentType),
      }),
      output_templates: createSection({
        content: typeSpecificOutputTemplates(agentType),
      }),
    },
  };
}

function normalizeSections(
  value: PartialConstitution["sections"],
  baseSections: Record<AgentConstitutionSectionId, AgentConstitutionSection>,
) {
  const next = {} as Record<AgentConstitutionSectionId, AgentConstitutionSection>;

  for (const sectionId of AGENT_CONSTITUTION_SECTION_ORDER) {
    const rawSection = value && typeof value === "object" ? value[sectionId] : null;
    const base = baseSections[sectionId];
    next[sectionId] = {
      content: typeof rawSection?.content === "string" ? rawSection.content.trim() : base.content,
    };
  }

  return next;
}

export function parseAgentConstitution(raw: string | null | undefined): AgentConstitution | null {
  if (!raw?.trim()) return null;

  try {
    return normalizeAgentConstitutionInput(JSON.parse(raw), { fallbackAgentType: "custom" });
  } catch {
    return null;
  }
}

export function normalizeAgentConstitutionInput(
  value: unknown,
  options?: {
    fallbackAgentType?: AgentConstitutionType;
    seed?: ConstitutionSeed;
  },
): AgentConstitution {
  const fallbackAgentType = options?.fallbackAgentType ?? "executive_assistant";
  const normalizedSeed = createAgentConstitutionSeed(options?.seed);
  let parsedValue = value;

  if (typeof parsedValue === "string" && parsedValue.trim()) {
    try {
      parsedValue = JSON.parse(parsedValue);
    } catch {
      parsedValue = {};
    }
  }

  const parsed = parsedValue && typeof parsedValue === "object" ? parsedValue as PartialConstitution : {};
  const agentType = resolveAgentType(parsed.agentType, fallbackAgentType);
  const base = createDefaultAgentConstitution(agentType, normalizedSeed);

  return {
    version: typeof parsed.version === "number" && parsed.version > 0 ? parsed.version : AGENT_CONSTITUTION_VERSION,
    updatedAt: cleanText(parsed.updatedAt) || nowIso(),
    agentType,
    sections: normalizeSections(parsed.sections, base.sections),
  };
}

export function buildLegacyConstitutionFromPersona(
  persona: string,
  options?: {
    agentType?: AgentConstitutionType;
    seed?: ConstitutionSeed;
  },
): AgentConstitution {
  const base = createDefaultAgentConstitution(options?.agentType ?? "custom", options?.seed);

  return {
    ...base,
    updatedAt: nowIso(),
    sections: {
      ...base.sections,
      assistant_system: {
        ...base.sections.assistant_system,
        content: cleanText(persona) || base.sections.assistant_system.content,
      },
    },
  };
}

export function getAgentConstitutionForEditor(options: {
  constitution?: string | null;
  persona?: string | null;
  fallbackAgentType?: AgentConstitutionType;
  seed?: ConstitutionSeed;
}) {
  const parsed = parseAgentConstitution(options.constitution);
  if (parsed) return parsed;

  if (cleanText(options.persona)) {
    return buildLegacyConstitutionFromPersona(options.persona ?? "", {
      agentType: options.fallbackAgentType ?? "custom",
      seed: options.seed,
    });
  }

  return createDefaultAgentConstitution(options.fallbackAgentType ?? "executive_assistant", options.seed);
}

export function hasStoredAgentConstitution(raw: string | null | undefined) {
  return parseAgentConstitution(raw) !== null;
}

export function serializeAgentConstitution(constitution: AgentConstitution) {
  const normalized = normalizeAgentConstitutionInput(constitution, {
    fallbackAgentType: constitution.agentType,
  });

  return JSON.stringify({
    version: normalized.version,
    updatedAt: normalized.updatedAt,
    agentType: normalized.agentType,
    sections: normalized.sections,
  });
}

export function getConstitutionSection(
  constitution: AgentConstitution,
  sectionId: AgentConstitutionSectionId,
) {
  return constitution.sections[sectionId];
}

export function updateConstitutionSection(
  constitution: AgentConstitution,
  sectionId: AgentConstitutionSectionId,
  patch: Partial<AgentConstitutionSection>,
): AgentConstitution {
  return {
    ...constitution,
    updatedAt: nowIso(),
    sections: {
      ...constitution.sections,
      [sectionId]: {
        ...constitution.sections[sectionId],
        ...createSection({
          ...constitution.sections[sectionId],
          ...patch,
        }),
      },
    },
  };
}

export function applyConstitutionSectionContentOverrides(
  constitution: AgentConstitution,
  overrides: Partial<Record<AgentConstitutionSectionId, string | null | undefined>>,
): AgentConstitution {
  let next = constitution;

  for (const sectionId of AGENT_CONSTITUTION_SECTION_ORDER) {
    const override = overrides[sectionId];
    if (typeof override !== "string") continue;

    next = updateConstitutionSection(next, sectionId, { content: override });
  }

  return next;
}

export function updateConstitutionAgentType(
  constitution: AgentConstitution,
  agentType: AgentConstitutionType,
): AgentConstitution {
  return {
    ...constitution,
    agentType,
    updatedAt: nowIso(),
  };
}

function renderSectionBlock(sectionId: AgentConstitutionSectionId, section: AgentConstitutionSection) {
  const content = cleanText(section.content);
  if (!content) return "";
  return `## ${AGENT_CONSTITUTION_SECTION_LABELS[sectionId]}\n${content}`;
}

export function renderConstitutionAsPersona(constitution: AgentConstitution) {
  const header = [
    `Structured Constitution v${constitution.version}`,
    `Agent type: ${formatAgentConstitutionTypeLabel(constitution.agentType)}`,
    "Use this constitution as the source of truth for behavior, task preparation, outputs, and approval posture.",
  ].join("\n");

  const sectionBlocks = AGENT_CONSTITUTION_SECTION_ORDER
    .map((sectionId) => renderSectionBlock(sectionId, constitution.sections[sectionId]))
    .filter(Boolean);

  return [header, ...sectionBlocks].filter(Boolean).join("\n\n");
}

type ResolveAgentConstitutionPersistenceOptions = {
  constitution?: unknown;
  persona?: string | null;
  existingConstitution?: string | null;
  existingPersona?: string | null;
  fallbackAgentType?: AgentConstitutionType;
  seed?: ConstitutionSeed;
};

export function resolveAgentConstitutionPersistence(
  options: ResolveAgentConstitutionPersistenceOptions,
) {
  if (options.constitution === undefined) {
    return {
      serializedConstitution: undefined,
      persona: cleanText(options.persona) || cleanText(options.existingPersona),
    };
  }

  const hasStructuredConstitution =
    options.constitution !== null &&
    !(typeof options.constitution === "string" && options.constitution.trim() === "");

  if (!hasStructuredConstitution) {
    return {
      serializedConstitution: "",
      persona: cleanText(options.persona) || cleanText(options.existingPersona),
    };
  }

  const normalizedConstitution = normalizeAgentConstitutionInput(options.constitution, {
    fallbackAgentType: options.fallbackAgentType ?? "executive_assistant",
    seed: options.seed,
  });

  return {
    serializedConstitution: serializeAgentConstitution(normalizedConstitution),
    persona: renderConstitutionAsPersona(normalizedConstitution),
  };
}
