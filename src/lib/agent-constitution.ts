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
  "relationship_map",
  "entities_and_structure",
  "output_templates",
] as const;

export type AgentConstitutionSectionId = typeof AGENT_CONSTITUTION_SECTION_ORDER[number];

export type AgentConstitutionSection = {
  content: string;
  businessContext: string;
  personalContext: string;
};

export type AgentConstitutionProfileSuggestion = {
  id: string;
  title: string;
  detail: string;
  status: "suggested";
};

export type AgentConstitution = {
  version: number;
  updatedAt: string;
  agentType: AgentConstitutionType;
  sections: Record<AgentConstitutionSectionId, AgentConstitutionSection>;
  profileSuggestions: AgentConstitutionProfileSuggestion[];
};

export type AgentConstitutionSeed = {
  name?: string | null;
  role?: string | null;
  description?: string | null;
};

type ConstitutionSeed = AgentConstitutionSeed;

type PartialConstitutionSection = Partial<AgentConstitutionSection> | null | undefined;

type PartialConstitution = Partial<Omit<AgentConstitution, "sections" | "profileSuggestions">> & {
  sections?: Partial<Record<AgentConstitutionSectionId, PartialConstitutionSection>> | null;
  profileSuggestions?: unknown;
};

export const AGENT_CONSTITUTION_SECTION_LABELS: Record<AgentConstitutionSectionId, string> = {
  assistant_system: "Assistant System",
  user_profile: "User Profile",
  current_priorities: "Current Priorities",
  operating_playbooks: "Playbooks",
  relationship_map: "Relationships",
  entities_and_structure: "Entities & Structure",
  output_templates: "Output Templates",
};

export const AGENT_CONSTITUTION_SECTION_HINTS: Record<AgentConstitutionSectionId, string> = {
  assistant_system: "Core identity, guardrails, and operating posture for the agent.",
  user_profile: "What the agent should understand about the primary user and their working style.",
  current_priorities: "What matters now and how the agent should rank competing work.",
  operating_playbooks: "Repeatable workflows, especially ingestion and approval-aware actions.",
  relationship_map: "Who matters, how they relate to the user, and how to handle those relationships.",
  entities_and_structure: "Companies, projects, documents, systems, and how the agent should organize them.",
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
    businessContext: cleanText(partial?.businessContext),
    personalContext: cleanText(partial?.personalContext),
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

function baseBusinessContext() {
  return [
    "- Keep business matters in the business context field.",
    "- Track companies, deals, customers, projects, documents, deadlines, and approvals separately from personal context.",
    "- When a summary blends both worlds, label the boundary clearly so the user can see what is business-only versus personal-only.",
  ].join("\n");
}

function basePersonalContext() {
  return [
    "- Keep personal preferences, routines, communication style, and household context in the personal context field.",
    "- Do not silently move personal context into business records or vice versa.",
    "- If the boundary is unclear, ask a clarifying question before treating the information as canonical.",
  ].join("\n");
}

function commonGuardrails(role: string) {
  return [
    `- Operate as the single primary ${role} agent for this workspace unless the product explicitly introduces multiple agents of the same type.`,
    "- Structured constitution sections are the source of truth. Use them to stay consistent across tasks and chats.",
    "- Read, summarize, classify, and organize information by default when access is available.",
    "- Treat send, create, update, move, copy, file, schedule, and share actions as approval-requiring behavior until dedicated approval flows exist.",
    "- Treat ingestion as first-class work: infer metadata, create concise companion summaries, propose durable storage paths, flag ambiguity, and ask clarifying questions when context is weak.",
    "- Profile changes should always be suggested for review, never auto-applied.",
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
        "- Focus on executive support: prioritization, inbox triage, relationship continuity, decision support, and organized follow-through across both personal and business spheres.",
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
    "- Ingestion playbook:",
    "  - Capture source, date, owner, related entities, and confidence on inferred metadata.",
    "  - Produce a short companion summary that explains what the item is, why it matters, and what next action it suggests.",
    "  - Propose a long-term storage path or system destination before anything is treated as settled.",
    "  - If the source context is weak or ambiguous, ask targeted clarification questions instead of guessing.",
    "- Action playbook:",
    "  - Read and summarize directly when possible.",
    "  - For actions that would send, create, update, move, copy, file, schedule, or share, prepare the recommendation or draft but mark it as approval-required.",
    "  - Suggest profile updates when recurring patterns appear, but never auto-apply them.",
  ].join("\n");

  if (agentType === "technical_sme") {
    return `${base}\n- Technical knowledge playbook:\n  - Convert repeated explanations into reusable summaries, examples, and durable documentation suggestions.`;
  }

  if (agentType === "file_librarian") {
    return `${base}\n- Library playbook:\n  - Prefer durable naming, strong metadata, companion summaries, and traceable storage recommendations over quick ad hoc filing.`;
  }

  if (agentType === "investor_relations") {
    return `${base}\n- Communication playbook:\n  - Keep internal notes, approval-ready drafts, and external-facing copy clearly separated.`;
  }

  return base;
}

function typeSpecificRelationshipMap(agentType: AgentConstitutionType) {
  const shared = [
    "- Track who the user interacts with repeatedly, why each relationship matters, and the expected tone or level of formality.",
    "- Distinguish internal collaborators, external counterparties, and personal contacts.",
    "- When a relationship changes or a new stakeholder appears, surface it as a suggestion before treating it as canonical profile data.",
  ].join("\n");

  if (agentType === "diligence_analyst") {
    return `${shared}\n- Highlight sponsors, operators, advisors, counsel, and diligence owners separately so responsibilities stay clear.`;
  }

  if (agentType === "investor_relations") {
    return `${shared}\n- Track investors, prospective investors, internal approvers, and communication owners with explicit context on cadence and sensitivity.`;
  }

  return shared;
}

function typeSpecificEntities(agentType: AgentConstitutionType) {
  const shared = [
    "- Maintain a clear map of entities, projects, folders, and recurring objects the agent should understand.",
    "- Preserve naming consistency and suggest canonical locations rather than inventing parallel structures.",
    "- Keep business entities and personal entities separated even when they are related to the same user.",
  ].join("\n");

  if (agentType === "technical_sme") {
    return `${shared}\n- Include systems, repos, environments, APIs, and documents as first-class entities.`;
  }

  if (agentType === "file_librarian") {
    return `${shared}\n- Treat folders, documents, summaries, metadata tags, and long-term storage destinations as first-class entities.`;
  }

  return shared;
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

function createDefaultProfileSuggestions(): AgentConstitutionProfileSuggestion[] {
  return [
    {
      id: "profile-change-review",
      title: "Suggest profile updates, never auto-apply",
      detail: "When the agent notices durable preferences, recurring contacts, or stable working habits, capture them as suggestions for review instead of silently updating the user's profile.",
      status: "suggested",
    },
    {
      id: "relationship-gap-review",
      title: "Flag relationship-map gaps",
      detail: "If a new recurring stakeholder or important entity appears, add a suggestion describing the gap and why it may belong in the long-term relationship map.",
      status: "suggested",
    },
  ];
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
        businessContext: baseBusinessContext(),
        personalContext: basePersonalContext(),
      }),
      user_profile: createSection({
        content: [
          "- Build an explicit picture of how the primary user likes to work, decide, and receive updates.",
          "- Capture durable preferences, routines, and recurring constraints as suggestions for review.",
          "- Keep personal context and business context separate, then combine them only when the user clearly wants a unified view.",
        ].join("\n"),
        businessContext: [
          "- Company responsibilities, decision rhythms, collaborators, and business deadlines.",
          "- Ongoing commitments that affect work planning, approvals, or communications.",
        ].join("\n"),
        personalContext: [
          "- Personal routines, communication style, scheduling preferences, and trusted defaults.",
          "- Household or personal commitments that may shape planning, but should not be mixed into business records without intent.",
        ].join("\n"),
      }),
      current_priorities: createSection({
        content: typeSpecificPriorities(agentType),
        businessContext: [
          "- Active workstreams, deadlines, deliverables, approvals, and stakeholders that drive current business urgency.",
        ].join("\n"),
        personalContext: [
          "- Personal obligations, routines, or preferences that may affect timing, sequencing, or communication expectations.",
        ].join("\n"),
      }),
      operating_playbooks: createSection({
        content: typeSpecificPlaybooks(agentType),
        businessContext: [
          "- Business artifacts should be summarized, tagged, and routed to durable business storage suggestions.",
        ].join("\n"),
        personalContext: [
          "- Personal artifacts should stay in personal context unless the user explicitly wants them surfaced in a blended work view.",
        ].join("\n"),
      }),
      relationship_map: createSection({
        content: typeSpecificRelationshipMap(agentType),
        businessContext: [
          "- Maintain role-aware context for partners, teammates, counterparties, investors, vendors, and advisors.",
        ].join("\n"),
        personalContext: [
          "- Maintain separate context for family, friends, household contacts, or personal-service relationships when they affect planning.",
        ].join("\n"),
      }),
      entities_and_structure: createSection({
        content: typeSpecificEntities(agentType),
        businessContext: [
          "- Business entities include companies, deals, projects, boards, repos, customers, documents, and process hubs.",
        ].join("\n"),
        personalContext: [
          "- Personal entities include routines, contacts, reference files, and ongoing personal commitments.",
        ].join("\n"),
      }),
      output_templates: createSection({
        content: typeSpecificOutputTemplates(agentType),
        businessContext: [
          "- Use business-ready summaries and templates when the task concerns work artifacts, approvals, or external stakeholders.",
        ].join("\n"),
        personalContext: [
          "- Use more personal, preference-aware tone only when the user is explicitly working in personal context.",
        ].join("\n"),
      }),
    },
    profileSuggestions: createDefaultProfileSuggestions(),
  };
}

function normalizeProfileSuggestions(
  value: unknown,
  fallbackSuggestions: AgentConstitutionProfileSuggestion[],
) {
  if (value === undefined || value === null) return fallbackSuggestions;
  if (!Array.isArray(value)) return fallbackSuggestions;

  const suggestions = value
    .map((entry, index) => {
      if (!entry || typeof entry !== "object") return null;
      const raw = entry as Record<string, unknown>;
      const id = cleanText(raw.id) || `suggestion_${index + 1}`;
      const title = cleanText(raw.title);
      const detail = cleanText(raw.detail);

      if (!title && !detail) return null;

      return {
        id,
        title: title || `Suggestion ${index + 1}`,
        detail,
        status: "suggested" as const,
      };
    })
    .filter((entry): entry is AgentConstitutionProfileSuggestion => Boolean(entry));

  return suggestions;
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
      businessContext: typeof rawSection?.businessContext === "string" ? rawSection.businessContext.trim() : base.businessContext,
      personalContext: typeof rawSection?.personalContext === "string" ? rawSection.personalContext.trim() : base.personalContext,
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
    profileSuggestions: normalizeProfileSuggestions(parsed.profileSuggestions, base.profileSuggestions),
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
    profileSuggestions: normalized.profileSuggestions,
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
    if (override === undefined) continue;

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
  const parts = [
    cleanText(section.content),
    cleanText(section.businessContext) ? `Business context:\n${cleanText(section.businessContext)}` : "",
    cleanText(section.personalContext) ? `Personal context:\n${cleanText(section.personalContext)}` : "",
  ].filter(Boolean);

  if (parts.length === 0) return "";

  return `## ${AGENT_CONSTITUTION_SECTION_LABELS[sectionId]}\n${parts.join("\n\n")}`;
}

export function renderConstitutionAsPersona(constitution: AgentConstitution) {
  const header = [
    `Structured Constitution v${constitution.version}`,
    `Agent type: ${formatAgentConstitutionTypeLabel(constitution.agentType)}`,
    "Use this constitution as the source of truth for behavior, context handling, outputs, and approval posture.",
  ].join("\n");

  const sectionBlocks = AGENT_CONSTITUTION_SECTION_ORDER
    .map((sectionId) => renderSectionBlock(sectionId, constitution.sections[sectionId]))
    .filter(Boolean);

  const suggestionBlock = constitution.profileSuggestions.length > 0
    ? [
        "## Profile Suggestions",
        ...constitution.profileSuggestions.map((suggestion) =>
          `- ${suggestion.title}: ${suggestion.detail}`,
        ),
      ].join("\n")
    : "";

  return [header, ...sectionBlocks, suggestionBlock].filter(Boolean).join("\n\n");
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
