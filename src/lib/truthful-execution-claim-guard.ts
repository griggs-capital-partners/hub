import { getDefaultCapabilityCards } from "./capability-evaluation";
import { buildDefaultInspectionToolRegistry } from "./document-intelligence";
import type { InspectionCapability } from "./inspection-tool-broker";

type CapabilityAvailabilityStatus =
  | "executable"
  | "local_parser_flow_only"
  | "recommended_deferred"
  | "control_or_async_intent_only"
  | "absent"
  | "blocked_or_not_configured";

type DependencyStatus =
  | "direct"
  | "transitive_not_enabled"
  | "optional_peer_only"
  | "local_parser_dependencies_only"
  | "none";

export type AuditedExecutionCapabilityId =
  | "document_processor"
  | "table_extraction_enhanced"
  | "ocr"
  | "vision_page_understanding"
  | "rendered_page_inspection"
  | "document_ai_table_recovery"
  | "high_fidelity_document_ingestion"
  | "high_precision_table_extraction"
  | "external_table_extraction"
  | "external_document_ai"
  | "sharepoint_company_file_connector"
  | "code_sandbox"
  | "browser_automation";

export type CapabilityAvailabilityAuditEntry = {
  id: AuditedExecutionCapabilityId;
  label: string;
  installedDependency: DependencyStatus;
  registeredCapability: boolean;
  relatedCapabilityIds: InspectionCapability[];
  registeredToolIds: string[];
  approvedExecutableToolIds: string[];
  relatedApprovedBuiltinToolIds: string[];
  configuredWithCredentials: boolean;
  executionEnabled: boolean;
  availability: CapabilityAvailabilityStatus;
  onlyRecommendedOrDeferred: boolean;
  evidence: string[];
};

export type ExecutedCapabilitySummaryEntry = {
  toolId: string;
  capability: string | null;
  source: "inspection_task" | "async_work";
};

export type TruthfulExecutionClaimSnapshot = {
  executedTools: ExecutedCapabilitySummaryEntry[];
  deferredCapabilities: string[];
  recommendedCapabilities: string[];
  unavailableCapabilities: AuditedExecutionCapabilityId[];
  asyncWorkCreated: boolean;
  asyncWorkStatus: string | null;
  asyncWorkType: string | null;
  asyncWorkExecutedSteps: string[];
  asyncWorkDeferredSteps: string[];
  createdArtifactKeys: string[];
  reusedArtifactKeys: string[];
  persistedMemoryUpdates: string[];
  inspectionTaskResults: string[];
  contextGapKinds: string[];
  limitations: string[];
  capabilityAudit: CapabilityAvailabilityAuditEntry[];
};

export type TruthfulExecutionClaimValidation = {
  ok: boolean;
  violations: string[];
};

export type TruthfulExecutionResponseMode = "stream_raw" | "buffer_then_guard";

export type TruthfulExecutionGuardableStreamEvent =
  | { type: "thinking_delta"; delta: string }
  | { type: "content_delta"; delta: string }
  | { type: "done"; model?: string }
  | { type: "tool_call"; id?: string; name?: string; args?: Record<string, unknown> }
  | { type: "tool_result"; id?: string; name?: string; result?: string }
  | { type: "tool_context"; messages?: unknown[] };

export type GuardedTruthfulExecutionStreamResult = {
  mode: TruthfulExecutionResponseMode;
  rawAnswer: string;
  visibleAnswer: string;
  savedAnswer: string;
  clientEvents: TruthfulExecutionGuardableStreamEvent[];
  validation: TruthfulExecutionClaimValidation;
  debug: {
    guardedClaimCount: number;
    violations: string[];
  };
};

export const TRUTHFUL_EXECUTION_CLAIM_SYSTEM_INSTRUCTIONS =
  "Truthful execution claim rules:\n" +
  "- Core rule: no trace, no claim.\n" +
  "- Only claim a tool was called, processing ran, extraction completed, memory was updated, or artifacts were persisted when that action is present in executed tool traces, async work results, inspection task results, or persisted artifact records provided in this prompt.\n" +
  "- Deferred capabilities, recommended capabilities, unavailable capabilities, and unmet capability review items are not executed tools.\n" +
  "- Async work item creation, planning, queuing, or completion with limitations is not the same as OCR, vision, rendered-page inspection, document-AI extraction, or high-fidelity ingestion completion.\n" +
  "- Do not invent bracketed tool-call transcripts such as `[Call Tool: ...]` or `[Calling Tool: ...]`. Mention tools only when the runtime tool trace lists the exact tool id as executed.\n" +
  "- If OCR, vision, rendered-page inspection, document-AI table recovery, document_processor, or table_extraction_enhanced are unavailable or deferred, describe them as unavailable/deferred/recommended, not executed.\n" +
  "- Do not say `processing complete`, `extraction complete`, `high-fidelity ingestion completed`, or `memory updated` unless the execution evidence section proves it.\n" +
  "- Do not fabricate table rows, columns, or cells from surrounding facts. If a table candidate exists but the body was not recovered, say the body was not recovered and label any surrounding values as coming from other context.";

const AUDITED_CAPABILITY_DEFINITIONS: Array<{
  id: AuditedExecutionCapabilityId;
  label: string;
  installedDependency: DependencyStatus;
  relatedCapabilityIds: InspectionCapability[];
  relatedApprovedBuiltinToolIds?: string[];
  availability: CapabilityAvailabilityStatus;
  evidence: string[];
}> = [
  {
    id: "document_processor",
    label: "document_processor",
    installedDependency: "local_parser_dependencies_only",
    relatedCapabilityIds: ["text_extraction", "pdf_table_body_recovery"],
    relatedApprovedBuiltinToolIds: ["existing_parser_text_extraction"],
    availability: "local_parser_flow_only",
    evidence: [
      "No exact document_processor chat or broker tool is registered.",
      "Approved local parsing exists through existing_parser_text_extraction and conversation context readers.",
    ],
  },
  {
    id: "table_extraction_enhanced",
    label: "table_extraction_enhanced",
    installedDependency: "local_parser_dependencies_only",
    relatedCapabilityIds: ["pdf_table_body_recovery", "pdf_table_detection"],
    relatedApprovedBuiltinToolIds: ["existing_parser_text_extraction", "pdf_table_candidate_detection"],
    availability: "absent",
    evidence: [
      "No exact table_extraction_enhanced tool is registered.",
      "Current table body recovery is limited to approved parser output and warning artifacts.",
    ],
  },
  {
    id: "ocr",
    label: "OCR",
    installedDependency: "transitive_not_enabled",
    relatedCapabilityIds: ["ocr"],
    availability: "recommended_deferred",
    evidence: [
      "The ocr capability card exists, but the default registry has no approved OCR tool.",
      "tesseract.js appears only as an officeparser transitive dependency and is not wired as an approved OCR execution path.",
    ],
  },
  {
    id: "vision_page_understanding",
    label: "Vision page understanding",
    installedDependency: "none",
    relatedCapabilityIds: ["vision_page_understanding"],
    availability: "recommended_deferred",
    evidence: [
      "The vision_page_understanding capability card exists, but the default registry has no approved vision tool.",
    ],
  },
  {
    id: "rendered_page_inspection",
    label: "Rendered page inspection",
    installedDependency: "none",
    relatedCapabilityIds: ["rendered_page_inspection"],
    availability: "recommended_deferred",
    evidence: [
      "The rendered_page_inspection capability card exists, but no approved browser/rendering tool is registered.",
    ],
  },
  {
    id: "document_ai_table_recovery",
    label: "Document AI table recovery",
    installedDependency: "none",
    relatedCapabilityIds: ["document_ai_table_recovery"],
    availability: "recommended_deferred",
    evidence: [
      "The document_ai_table_recovery capability card exists, but no approved external document AI tool is registered.",
    ],
  },
  {
    id: "high_fidelity_document_ingestion",
    label: "High-fidelity document ingestion",
    installedDependency: "none",
    relatedCapabilityIds: [
      "text_extraction",
      "pdf_table_detection",
      "pdf_table_body_recovery",
      "rendered_page_inspection",
      "ocr",
      "vision_page_understanding",
      "document_ai_table_recovery",
    ],
    relatedApprovedBuiltinToolIds: [
      "existing_parser_text_extraction",
      "pdf_table_candidate_detection",
      "pdf_sparse_table_warning",
    ],
    availability: "control_or_async_intent_only",
    evidence: [
      "High-fidelity ingestion is an agent-control/async work intent, not an approved executable tool id.",
      "Current approved steps can reuse parser artifacts and record deferred capabilities only.",
    ],
  },
  {
    id: "high_precision_table_extraction",
    label: "High-precision table extraction",
    installedDependency: "none",
    relatedCapabilityIds: ["pdf_table_body_recovery", "document_ai_table_recovery", "ocr", "vision_page_understanding"],
    availability: "recommended_deferred",
    evidence: [
      "No high_precision_table_extraction tool is registered.",
      "Precision beyond parser output is deferred to future rendered/OCR/vision/document-AI tools.",
    ],
  },
  {
    id: "external_table_extraction",
    label: "External table extraction",
    installedDependency: "none",
    relatedCapabilityIds: ["document_ai_table_recovery", "ocr", "vision_page_understanding"],
    availability: "recommended_deferred",
    evidence: [
      "External table extraction appears only as proposed tool paths and candidate runtime categories.",
    ],
  },
  {
    id: "external_document_ai",
    label: "External document AI",
    installedDependency: "none",
    relatedCapabilityIds: ["document_ai_table_recovery"],
    availability: "recommended_deferred",
    evidence: [
      "No Google Document AI, Azure Document Intelligence, AWS Textract, Adobe PDF Extract, Mistral OCR, LlamaParse, or Docling runtime tool is registered.",
    ],
  },
  {
    id: "sharepoint_company_file_connector",
    label: "SharePoint/company-file connector",
    installedDependency: "none",
    relatedCapabilityIds: ["source_connector_read"],
    availability: "absent",
    evidence: [
      "source_connector_read is a future capability category, but no SharePoint/company-file connector is registered.",
    ],
  },
  {
    id: "code_sandbox",
    label: "Code sandbox",
    installedDependency: "none",
    relatedCapabilityIds: ["code_repository_inspection"],
    availability: "blocked_or_not_configured",
    evidence: [
      "code_sandbox is a governance runtime class only; no code sandbox tool is registered or configured.",
    ],
  },
  {
    id: "browser_automation",
    label: "Browser automation",
    installedDependency: "optional_peer_only",
    relatedCapabilityIds: ["rendered_page_inspection", "web_snapshot"],
    availability: "absent",
    evidence: [
      "Browser automation is a governance runtime class only; no approved browser automation tool is registered.",
      "Any Playwright mention is an optional peer/lockfile artifact, not a direct runtime dependency in package.json.",
    ],
  },
];

function unique(values: string[]) {
  return values.filter((value, index, all) => value.trim().length > 0 && all.indexOf(value) === index);
}

export function isExecutionSensitivePrompt(value: string) {
  return /\b(?:ocr|ocr\/vision|vision|rendered[-\s]?page|page\s+snapshot|document[-\s]?ai|document\s+processor|table[-_\s]extraction|extract(?:ion|ed)?\s+(?:every|all)?\s*tables?|high[-\s]fidelity|high[-\s]precision|run\s+(?:the\s+)?tools?|process(?:ing)?\s+(?:the\s+)?document|best\s+possible\s+(?:report|deck|workbook)|async\s+work|memory\s+update|artifact\s+(?:update|persist|refresh)|unavailable\s+capabilit|deferred\s+capabilit|recommended\s+capabilit|page\s*15\s+table)\b/i.test(value);
}

export function shouldUseBufferedTruthfulExecutionResponse(params: {
  userPrompt: string;
  snapshot: TruthfulExecutionClaimSnapshot;
  contextText?: string | null;
}) {
  if (isExecutionSensitivePrompt(params.userPrompt)) {
    return true;
  }

  if (params.contextText && isExecutionSensitivePrompt(params.contextText)) {
    return true;
  }

  return params.snapshot.deferredCapabilities.length > 0 ||
    params.snapshot.recommendedCapabilities.length > 0 ||
    params.snapshot.asyncWorkCreated ||
    params.snapshot.asyncWorkDeferredSteps.length > 0 ||
    params.snapshot.contextGapKinds.length > 0 ||
    params.snapshot.limitations.length > 0;
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function asArray(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

function stringValue(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function stringArray(value: unknown) {
  return asArray(value).flatMap((entry) => {
    const normalized = stringValue(entry);
    return normalized ? [normalized] : [];
  });
}

function getRecordArray(record: Record<string, unknown> | null, key: string) {
  return asArray(record?.[key]).flatMap((entry) => {
    const normalized = asRecord(entry);
    return normalized ? [normalized] : [];
  });
}

function getContextRegistryRecord(debugTrace: unknown) {
  return asRecord(asRecord(debugTrace)?.contextRegistry);
}

function getRegistryRecordArray(debugTrace: unknown, section: "contextDebt" | "capabilityGaps", key: string) {
  return getRecordArray(asRecord(getContextRegistryRecord(debugTrace)?.[section]), key);
}

function capabilityCardExists(capability: InspectionCapability) {
  return getDefaultCapabilityCards().some((card) => card.id === capability);
}

export function buildCapabilityAvailabilityAudit(): CapabilityAvailabilityAuditEntry[] {
  const registry = buildDefaultInspectionToolRegistry();

  return AUDITED_CAPABILITY_DEFINITIONS.map((definition) => {
    const registeredToolIds = unique(
      definition.relatedCapabilityIds.flatMap((capability) =>
        registry.getToolsByCapability(capability, { includeUnapproved: true }).map((tool) => tool.id)
      )
    );
    const approvedExecutableToolIds = unique(
      definition.relatedCapabilityIds.flatMap((capability) =>
        registry
          .getToolsByCapability(capability)
          .filter((tool) =>
            (tool.approvalStatus === "built_in" || tool.approvalStatus === "approved") &&
            (tool.runtimeClass === "local" || tool.runtimeClass === "local_sandboxed") &&
            (tool.executionBoundary === "in_process" || tool.executionBoundary === "local_process") &&
            typeof tool.execute === "function"
          )
          .map((tool) => tool.id)
      )
    );
    const registeredCapability = definition.relatedCapabilityIds.some(capabilityCardExists);
    const executionEnabled = definition.availability === "executable";
    const relatedApprovedBuiltinToolIds = unique(definition.relatedApprovedBuiltinToolIds ?? []);

    return {
      id: definition.id,
      label: definition.label,
      installedDependency: definition.installedDependency,
      registeredCapability,
      relatedCapabilityIds: [...definition.relatedCapabilityIds],
      registeredToolIds,
      approvedExecutableToolIds: executionEnabled ? approvedExecutableToolIds : [],
      relatedApprovedBuiltinToolIds,
      configuredWithCredentials: false,
      executionEnabled,
      availability: definition.availability,
      onlyRecommendedOrDeferred:
        definition.availability === "recommended_deferred" ||
        definition.availability === "control_or_async_intent_only",
      evidence: [...definition.evidence],
    };
  });
}

function getToolTraceFromInspectionTask(task: Record<string, unknown>) {
  const result = asRecord(task.result);
  return asRecord(result?.toolTrace);
}

function collectExecutedToolTraces(documentIntelligence: unknown, asyncAgentWork: unknown) {
  const executed: ExecutedCapabilitySummaryEntry[] = [];
  const documents = getRecordArray(asRecord(documentIntelligence), "documents");

  for (const document of documents) {
    for (const task of getRecordArray(document, "inspectionTasks")) {
      const toolTrace = getToolTraceFromInspectionTask(task);
      for (const event of getRecordArray(toolTrace, "traceEvents")) {
        if (event.type !== "tool_executed") continue;
        const toolId = stringValue(event.toolId);
        if (!toolId) continue;
        executed.push({
          toolId,
          capability: stringValue(event.capability),
          source: "inspection_task",
        });
      }
    }
  }

  const asyncRecord = asRecord(asyncAgentWork);
  const completionState = asRecord(asyncRecord?.completionState);
  for (const toolId of stringArray(completionState?.executedToolIds)) {
    executed.push({
      toolId,
      capability: null,
      source: "async_work",
    });
  }

  const seen = new Set<string>();
  return executed.filter((entry) => {
    const key = `${entry.toolId}:${entry.capability ?? ""}:${entry.source}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function collectInspectionTaskResultIds(documentIntelligence: unknown) {
  const values: string[] = [];
  const documents = getRecordArray(asRecord(documentIntelligence), "documents");

  for (const document of documents) {
    for (const task of getRecordArray(document, "inspectionTasks")) {
      const id = stringValue(task.id) ?? stringValue(task.taskKey) ?? stringValue(task.inspectionKey);
      const tool = stringValue(task.tool);
      if (id || tool) {
        values.push([id, tool].filter(Boolean).join(":"));
      }
    }
  }

  return unique(values);
}

function collectCreatedArtifactKeys(documentIntelligence: unknown, asyncAgentWork: unknown) {
  const keys: string[] = [];
  const documents = getRecordArray(asRecord(documentIntelligence), "documents");

  for (const document of documents) {
    for (const task of getRecordArray(document, "inspectionTasks")) {
      keys.push(...stringArray(task.createdArtifactKeys));
      const toolTrace = getToolTraceFromInspectionTask(task);
      keys.push(...stringArray(toolTrace?.createdArtifactKeys));
    }
  }

  const asyncRecord = asRecord(asyncAgentWork);
  const completionState = asRecord(asyncRecord?.completionState);
  keys.push(...stringArray(completionState?.createdArtifactKeys));

  return unique(keys);
}

function collectReusedArtifactKeys(asyncAgentWork: unknown) {
  const asyncRecord = asRecord(asyncAgentWork);
  const keys = stringArray(asRecord(asyncRecord?.completionState)?.reusedArtifactKeys);

  for (const link of getRecordArray(asyncRecord, "artifactLinks")) {
    if (link.linkType === "reused") {
      const artifactKey = stringValue(link.artifactKey);
      if (artifactKey) keys.push(artifactKey);
    }
  }

  return unique(keys);
}

function collectDeferredCapabilities(params: {
  agentControl?: unknown;
  progressiveAssembly?: unknown;
  asyncAgentWork?: unknown;
  debugTrace?: unknown;
}) {
  const capabilities: string[] = [];
  const asyncRecord = asRecord(params.asyncAgentWork);
  for (const entry of getRecordArray(asyncRecord, "deferredCapabilities")) {
    const capability = stringValue(entry.capability);
    if (capability) capabilities.push(capability);
  }

  const completionState = asRecord(asyncRecord?.completionState);
  for (const entry of getRecordArray(completionState, "deferredCapabilities")) {
    const capability = stringValue(entry.capability);
    if (capability) capabilities.push(capability);
  }

  const controlRecord = asRecord(params.agentControl);
  const externalEscalation = asRecord(controlRecord?.externalEscalation);
  capabilities.push(...stringArray(externalEscalation?.capabilities));

  const governance = asRecord(controlRecord?.toolGovernance);
  capabilities.push(...stringArray(governance?.recommendedCapabilities));

  const assemblyRecord = asRecord(params.progressiveAssembly);
  for (const gap of getRecordArray(assemblyRecord, "gaps")) {
    capabilities.push(...stringArray(gap.recommendedCapabilities));
  }
  for (const debt of [
    ...getRegistryRecordArray(params.debugTrace, "contextDebt", "records"),
    ...getRegistryRecordArray(params.debugTrace, "contextDebt", "selectedRecords"),
  ]) {
    capabilities.push(...stringArray(debt.deferredCapabilities));
  }

  return unique(capabilities);
}

function collectRecommendedCapabilities(params: {
  documentIntelligence?: unknown;
  agentControl?: unknown;
  progressiveAssembly?: unknown;
  debugTrace?: unknown;
}) {
  const capabilities: string[] = [];
  const documents = getRecordArray(asRecord(params.documentIntelligence), "documents");

  for (const document of documents) {
    for (const task of getRecordArray(document, "inspectionTasks")) {
      capabilities.push(...stringArray(task.recommendedNextCapabilities));
      const toolTrace = getToolTraceFromInspectionTask(task);
      capabilities.push(...stringArray(toolTrace?.recommendedNextCapabilities));
    }
  }

  const controlRecord = asRecord(params.agentControl);
  const governance = asRecord(controlRecord?.toolGovernance);
  capabilities.push(...stringArray(governance?.recommendedCapabilities));

  const assemblyRecord = asRecord(params.progressiveAssembly);
  for (const gap of getRecordArray(assemblyRecord, "gaps")) {
    capabilities.push(...stringArray(gap.recommendedCapabilities));
  }
  for (const gap of [
    ...getRegistryRecordArray(params.debugTrace, "capabilityGaps", "records"),
    ...getRegistryRecordArray(params.debugTrace, "capabilityGaps", "selectedRecords"),
  ]) {
    const capability = stringValue(gap.neededCapability);
    if (capability) capabilities.push(capability);
    capabilities.push(...stringArray(gap.candidateModelCapabilities));
    capabilities.push(...stringArray(gap.candidateContextLanes));
  }

  return unique(capabilities);
}

function collectContextGapKinds(progressiveAssembly: unknown, asyncAgentWork: unknown, debugTrace?: unknown) {
  const kinds: string[] = [];
  for (const gap of getRecordArray(asRecord(progressiveAssembly), "gaps")) {
    const kind = stringValue(gap.kind);
    if (kind) kinds.push(kind);
  }
  for (const gap of getRecordArray(asRecord(asyncAgentWork), "contextGapSnapshots")) {
    const kind = stringValue(gap.kind);
    if (kind) kinds.push(kind);
  }
  for (const debt of [
    ...getRegistryRecordArray(debugTrace, "contextDebt", "records"),
    ...getRegistryRecordArray(debugTrace, "contextDebt", "selectedRecords"),
  ]) {
    const kind = stringValue(debt.kind);
    if (kind) kinds.push(kind);
  }
  return unique(kinds);
}

function collectLimitations(asyncAgentWork: unknown, debugTrace?: unknown) {
  const asyncRecord = asRecord(asyncAgentWork);
  const limitations = [
    ...stringArray(asyncRecord?.limitations),
    ...stringArray(asRecord(asyncRecord?.completionState)?.limitations),
    ...getRegistryRecordArray(debugTrace, "contextDebt", "selectedRecords").flatMap((debt) => [
      stringValue(debt.title),
      stringValue(debt.description),
    ]),
    ...getRegistryRecordArray(debugTrace, "capabilityGaps", "selectedRecords").flatMap((gap) => [
      stringValue(gap.title),
      stringValue(gap.currentLimitation),
    ]),
  ];
  return unique(limitations.filter((value): value is string => Boolean(value)));
}

export function buildTruthfulExecutionClaimSnapshot(params: {
  documentIntelligence?: unknown;
  agentControl?: unknown;
  progressiveAssembly?: unknown;
  asyncAgentWork?: unknown;
  debugTrace?: unknown;
}): TruthfulExecutionClaimSnapshot {
  const capabilityAudit = buildCapabilityAvailabilityAudit();
  const asyncRecord = asRecord(params.asyncAgentWork);
  const createdArtifactKeys = collectCreatedArtifactKeys(params.documentIntelligence, params.asyncAgentWork);
  const reusedArtifactKeys = collectReusedArtifactKeys(params.asyncAgentWork);
  const unavailableCapabilities = capabilityAudit
    .filter((entry) => !entry.executionEnabled)
    .map((entry) => entry.id);

  return {
    executedTools: collectExecutedToolTraces(params.documentIntelligence, params.asyncAgentWork),
    deferredCapabilities: collectDeferredCapabilities(params),
    recommendedCapabilities: collectRecommendedCapabilities(params),
    unavailableCapabilities,
    asyncWorkCreated: Boolean(asyncRecord?.workItemId || asyncRecord?.workKey),
    asyncWorkStatus: stringValue(asyncRecord?.status),
    asyncWorkType: stringValue(asyncRecord?.type),
    asyncWorkExecutedSteps: stringArray(asyncRecord?.executedSteps),
    asyncWorkDeferredSteps: stringArray(asyncRecord?.skippedOrDeferredSteps),
    createdArtifactKeys,
    reusedArtifactKeys,
    persistedMemoryUpdates: createdArtifactKeys,
    inspectionTaskResults: collectInspectionTaskResultIds(params.documentIntelligence),
    contextGapKinds: collectContextGapKinds(params.progressiveAssembly, params.asyncAgentWork, params.debugTrace),
    limitations: collectLimitations(params.asyncAgentWork, params.debugTrace),
    capabilityAudit,
  };
}

function formatList(values: string[], empty: string) {
  return values.length > 0 ? values.map((value) => `- ${value}`).join("\n") : `- ${empty}`;
}

export function buildExecutedCapabilitySummary(snapshot: TruthfulExecutionClaimSnapshot) {
  return snapshot.executedTools.length > 0
    ? snapshot.executedTools
        .map((entry) => `- ${entry.toolId}${entry.capability ? ` (${entry.capability})` : ""} via ${entry.source}`)
        .join("\n")
    : "- none in the provided runtime trace";
}

export function buildDeferredCapabilitySummary(snapshot: TruthfulExecutionClaimSnapshot) {
  return formatList(snapshot.deferredCapabilities, "none recorded");
}

export function buildUnavailableCapabilitySummary(snapshot: TruthfulExecutionClaimSnapshot) {
  return formatList(snapshot.unavailableCapabilities, "none recorded");
}

export function buildPersistedMemoryUpdateSummary(snapshot: TruthfulExecutionClaimSnapshot) {
  if (snapshot.persistedMemoryUpdates.length === 0 && snapshot.reusedArtifactKeys.length === 0) {
    return "- no turn-created artifact or reused artifact keys are present in this evidence summary";
  }

  return [
    snapshot.persistedMemoryUpdates.length > 0
      ? `- turn-created/persisted artifact keys: ${snapshot.persistedMemoryUpdates.join(", ")}`
      : "- turn-created/persisted artifact keys: none",
    snapshot.reusedArtifactKeys.length > 0
      ? `- reused artifact keys: ${snapshot.reusedArtifactKeys.join(", ")}`
      : "- reused artifact keys: none",
  ].join("\n");
}

export function renderTruthfulExecutionClaimContext(snapshot: TruthfulExecutionClaimSnapshot) {
  const asyncLine = snapshot.asyncWorkCreated
    ? `- asyncWorkCreated: true; asyncWorkStatus: ${snapshot.asyncWorkStatus ?? "unknown"}; asyncWorkType: ${snapshot.asyncWorkType ?? "unknown"}`
    : "- asyncWorkCreated: false";

  return [
    "## Execution Claim Evidence",
    "Use this section as authoritative evidence for what the final answer may claim about execution.",
    TRUTHFUL_EXECUTION_CLAIM_SYSTEM_INSTRUCTIONS,
    "",
    "Executed tools:",
    buildExecutedCapabilitySummary(snapshot),
    "",
    "Deferred capabilities (not executed):",
    buildDeferredCapabilitySummary(snapshot),
    "",
    "Recommended capabilities (not executed unless also listed under Executed tools):",
    formatList(snapshot.recommendedCapabilities, "none recorded"),
    "",
    "Unavailable or not execution-enabled capabilities:",
    buildUnavailableCapabilitySummary(snapshot),
    "",
    "Async work state:",
    asyncLine,
    `- asyncWorkExecutedSteps: ${snapshot.asyncWorkExecutedSteps.length > 0 ? snapshot.asyncWorkExecutedSteps.join(", ") : "none"}`,
    `- asyncWorkDeferredSteps: ${snapshot.asyncWorkDeferredSteps.length > 0 ? snapshot.asyncWorkDeferredSteps.join(", ") : "none"}`,
    "",
    "Persisted memory/artifact evidence:",
    buildPersistedMemoryUpdateSummary(snapshot),
    "",
    "Inspection task results:",
    formatList(snapshot.inspectionTaskResults, "none recorded"),
    "",
    "Context gaps:",
    formatList(snapshot.contextGapKinds, "none recorded"),
    "",
    "Limitations:",
    formatList(snapshot.limitations, "none recorded"),
    "",
    "Answering consequence:",
    "- If OCR, vision, rendered-page inspection, document-AI, document_processor, or table_extraction_enhanced are not listed under Executed tools, say they did not run.",
    "- If async work exists, report only its actual status and steps; do not describe it as completed extraction unless extraction is listed under Executed tools or persisted artifacts.",
  ].join("\n");
}

export function buildTruthfulExecutionClaimContext(params: {
  documentIntelligence?: unknown;
  agentControl?: unknown;
  progressiveAssembly?: unknown;
  asyncAgentWork?: unknown;
  debugTrace?: unknown;
}) {
  return renderTruthfulExecutionClaimContext(buildTruthfulExecutionClaimSnapshot(params));
}

function containsNegation(value: string) {
  return /\b(no|not|never|without|did not|does not|cannot|can't|has not|have not|unavailable|deferred|recommended)\b/i.test(value);
}

function hasPositiveExecutionPhrase(answer: string, capabilityPattern: RegExp) {
  const sentences = answer.split(/(?<=[.!?])\s+|\n+/g);
  return sentences.some((sentence) => {
    if (!capabilityPattern.test(sentence)) return false;
    if (containsNegation(sentence)) return false;
    return /\b(ran|run|executed|called|calling|used|processed|processing|complete|completed|recovered|extracted|extraction)\b/i.test(sentence);
  });
}

function hasExecutedTool(snapshot: TruthfulExecutionClaimSnapshot, toolId: string) {
  return snapshot.executedTools.some((entry) => entry.toolId === toolId);
}

function hasExecutedCapability(snapshot: TruthfulExecutionClaimSnapshot, capability: string) {
  return snapshot.executedTools.some((entry) => entry.capability === capability);
}

function hasAnyExecutedTool(snapshot: TruthfulExecutionClaimSnapshot, toolIds: string[]) {
  return toolIds.some((toolId) => hasExecutedTool(snapshot, toolId));
}

function hasTableBodyEvidence(snapshot: TruthfulExecutionClaimSnapshot) {
  return snapshot.createdArtifactKeys.some((key) => /table_extraction/i.test(key)) ||
    hasExecutedTool(snapshot, "existing_parser_text_extraction");
}

function hasHighFidelityCompletionEvidence(snapshot: TruthfulExecutionClaimSnapshot) {
  return snapshot.asyncWorkType === "highest_fidelity_ingestion" &&
    snapshot.asyncWorkStatus === "completed" &&
    snapshot.deferredCapabilities.length === 0 &&
    snapshot.limitations.length === 0;
}

export function validateAnswerExecutionClaims(
  answer: string,
  snapshot: TruthfulExecutionClaimSnapshot
): TruthfulExecutionClaimValidation {
  const violations: string[] = [];
  const normalized = answer.trim();

  for (const match of normalized.matchAll(/\[(?:Call(?:ing)? Tool|Calling Tool):\s*([^\]\n]+)\]/gi)) {
    const claimedTool = match[1]?.trim();
    if (claimedTool && !hasExecutedTool(snapshot, claimedTool)) {
      violations.push(`Bracketed tool-call transcript claims ${claimedTool}, but no executed tool trace lists it.`);
    }
  }

  for (const toolId of ["document_processor", "table_extraction_enhanced"]) {
    const pattern = new RegExp(`\\b${toolId}\\b`, "i");
    if (hasPositiveExecutionPhrase(normalized, pattern) && !hasExecutedTool(snapshot, toolId)) {
      violations.push(`${toolId} is described as executed, but no executed tool trace lists it.`);
    }
  }

  if (/engine\s*=\s*ocr\+vision/i.test(normalized) && !hasAnyExecutedTool(snapshot, ["ocr", "vision_page_understanding"])) {
    violations.push("OCR/vision engine execution is claimed without OCR or vision execution trace.");
  }

  if (hasPositiveExecutionPhrase(normalized, /\b(?:ocr|ocr\/vision)\b/i) && !hasExecutedTool(snapshot, "ocr")) {
    violations.push("OCR execution is claimed without an OCR execution trace.");
  }

  if (hasPositiveExecutionPhrase(normalized, /\bvision(?:[-_\s]page[-_\s]understanding)?\b/i) && !hasExecutedTool(snapshot, "vision_page_understanding")) {
    violations.push("Vision execution is claimed without a vision execution trace.");
  }

  if (hasPositiveExecutionPhrase(normalized, /\brendered[-\s]page\b/i) && !hasExecutedTool(snapshot, "rendered_page_inspection")) {
    violations.push("Rendered-page inspection is claimed without rendered-page execution trace.");
  }

  if (hasPositiveExecutionPhrase(normalized, /\bdocument[-_\s]?ai\b/i) && !hasExecutedTool(snapshot, "document_ai_table_recovery")) {
    violations.push("Document-AI execution is claimed without document-AI execution trace.");
  }

  if (/\b(?:processing complete|extraction complete)\b/i.test(normalized) && snapshot.executedTools.length === 0 && !snapshot.asyncWorkStatus?.startsWith("completed")) {
    violations.push("Completion is claimed without executed tool trace or completed async work result.");
  }

  if (/\b(?:extraction complete|extraction completed|completed extraction)\b/i.test(normalized) && !hasTableBodyEvidence(snapshot)) {
    violations.push("Extraction completion is claimed without extraction evidence.");
  }

  if (
    /\b(?:deliverable[-\s]grade validation|full validation|claim[-\s]checked validation)\b.{0,80}\b(?:completed|complete|ran|performed|validated)\b/i.test(normalized) &&
    !hasExecutedCapability(snapshot, "artifact_validation")
  ) {
    violations.push("Deliverable-grade validation is claimed without a validation execution trace.");
  }

  if (/\bhigh[-\s]fidelity\b.{0,80}\b(?:completed|complete|recovered|processed)\b/i.test(normalized) && !hasHighFidelityCompletionEvidence(snapshot)) {
    violations.push("High-fidelity completion is claimed without completed high-fidelity evidence.");
  }

  if (/\b(?:persistent document memory|document memory|memory)\b.{0,80}\b(?:updated|persisted|saved)\b/i.test(normalized) && snapshot.persistedMemoryUpdates.length === 0) {
    violations.push("Memory update is claimed without turn-created persisted artifact evidence.");
  }

  if (/\brecovered structured tables\b/i.test(normalized) && !hasTableBodyEvidence(snapshot)) {
    violations.push("Structured table recovery is claimed without table body extraction evidence.");
  }

  if (
    snapshot.contextGapKinds.includes("missing_table_body") &&
    /\bpage\s*15\b/i.test(normalized) &&
    /(?:650\s*ppm\s*Li|235\s*(?:F|\u00b0F)|250,?000\s*ppm\s*TDS)/i.test(normalized) &&
    !/\b(?:elsewhere|other slides?|other context|not extracted|not recovered|should not be treated as extracted)\b/i.test(normalized)
  ) {
    violations.push("Surrounding T5 values are presented as page 15 extracted table cells despite a missing_table_body gap.");
  }

  return {
    ok: violations.length === 0,
    violations,
  };
}

export function buildTruthfulExecutionCorrection(
  snapshot: TruthfulExecutionClaimSnapshot,
  violations: string[]
) {
  const mentionsOcrOrVision = violations.some((violation) => /OCR|vision|table_extraction_enhanced/i.test(violation));
  const mentionsHighFidelity = violations.some((violation) => /high-fidelity|document_processor/i.test(violation));
  const opening = mentionsOcrOrVision
    ? "I cannot run OCR/vision-enhanced extraction yet because those capabilities are not approved, configured, or execution-enabled in the current tool registry."
    : mentionsHighFidelity
      ? "I cannot complete highest-fidelity ingestion with the currently approved tools."
      : "I can only report execution that appears in the runtime trace.";
  const deferredCapabilities = unique([
    ...snapshot.deferredCapabilities,
    ...snapshot.recommendedCapabilities,
  ]);
  const lines = [
    opening,
    "",
    "What I can confirm:",
    snapshot.executedTools.length > 0
      ? `- Executed tool traces: ${snapshot.executedTools.map((entry) => entry.toolId).join(", ")}.`
      : "- Executed tool traces: none for OCR, vision, rendered-page inspection, document-AI, document_processor, or table_extraction_enhanced.",
    snapshot.asyncWorkCreated
      ? `- Async work item: ${snapshot.asyncWorkType ?? "unknown"} with status ${snapshot.asyncWorkStatus ?? "unknown"}.`
      : "- Async work item: none shown in this runtime evidence.",
    snapshot.contextGapKinds.includes("missing_table_body")
      ? "- A table candidate exists, but the structured table body was not recovered by the current approved tools."
      : null,
    deferredCapabilities.length > 0
      ? `- Deferred or recommended capabilities: ${deferredCapabilities.join(", ")}.`
      : "- Deferred capabilities: none recorded.",
    snapshot.persistedMemoryUpdates.length > 0
      ? `- Persisted artifact keys available: ${snapshot.persistedMemoryUpdates.join(", ")}.`
      : "- No turn-created persisted artifact keys are available for a memory-updated claim.",
    "",
    "No OCR, vision, rendered-page inspection, document-AI, document_processor, or table_extraction_enhanced tool has run unless it is listed above as an executed tool trace.",
  ].filter((line): line is string => Boolean(line));

  return lines.join("\n");
}

export function enforceTruthfulExecutionClaims(answer: string, snapshot: TruthfulExecutionClaimSnapshot) {
  const validation = validateAnswerExecutionClaims(answer, snapshot);
  if (validation.ok) {
    return {
      answer,
      validation,
    };
  }

  return {
    answer: buildTruthfulExecutionCorrection(snapshot, validation.violations),
    validation,
  };
}

export function buildGuardedTruthfulExecutionStreamResult(params: {
  events: TruthfulExecutionGuardableStreamEvent[];
  snapshot: TruthfulExecutionClaimSnapshot;
  userPrompt: string;
  contextText?: string | null;
}): GuardedTruthfulExecutionStreamResult {
  const shouldBuffer = shouldUseBufferedTruthfulExecutionResponse({
    userPrompt: params.userPrompt,
    snapshot: params.snapshot,
    contextText: params.contextText,
  });
  const rawAnswer = params.events
    .filter((event): event is { type: "content_delta"; delta: string } => event.type === "content_delta")
    .map((event) => event.delta)
    .join("")
    .trim();
  const guarded = enforceTruthfulExecutionClaims(rawAnswer, params.snapshot);

  if (!shouldBuffer) {
    return {
      mode: "stream_raw",
      rawAnswer,
      visibleAnswer: rawAnswer,
      savedAnswer: guarded.answer,
      clientEvents: params.events.filter((event) => event.type !== "tool_context"),
      validation: guarded.validation,
      debug: {
        guardedClaimCount: guarded.validation.violations.length,
        violations: guarded.validation.violations,
      },
    };
  }

  const model = [...params.events].reverse().find((event) => event.type === "done" && typeof event.model === "string");

  return {
    mode: "buffer_then_guard",
    rawAnswer,
    visibleAnswer: guarded.answer,
    savedAnswer: guarded.answer,
    clientEvents: [
      { type: "content_delta", delta: guarded.answer },
      { type: "done", model: model?.type === "done" ? model.model : undefined },
    ],
    validation: guarded.validation,
    debug: {
      guardedClaimCount: guarded.validation.violations.length,
      violations: guarded.validation.violations,
    },
  };
}
