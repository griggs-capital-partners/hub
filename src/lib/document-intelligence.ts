import type { ContextDocumentStructuredRangeInput } from "./context-document-chunks";
import type {
  PdfContextExtractionMetadata,
  PdfPageStructureSummary,
  PdfVisualClassificationConfidence,
} from "./context-pdf";
import { estimateTextTokens } from "./context-token-budget";
import {
  buildCompletedToolResult,
  createToolTracePayload,
  InspectionToolBroker,
  InspectionToolRegistry,
  type InspectionCapability,
  type InspectionToolDefinition,
  type InspectionToolResult,
  type ToolCostEstimate,
  type ToolDataPolicy,
  type ToolExecutionBoundary,
  type ToolFallbackPolicy,
  type ToolLatencyClass,
  type ToolPermissionRequirement,
  type ToolRuntimeClass,
  type ToolSideEffectLevel,
} from "./inspection-tool-broker";

export type InspectionTaskKind =
  | "inspect_page"
  | "inspect_table"
  | "inspect_figure"
  | "inspect_section"
  | "inspect_clause"
  | "inspect_visual"
  | "inspect_scanned_page"
  | "inspect_whole_document_summary";

export type InspectionTaskStatus = "planned" | "completed" | "failed";

export type InspectionTool =
  | "existing_parser_text_extraction"
  | "pdf_page_classification"
  | "pdf_table_candidate_detection"
  | "pdf_sparse_table_warning"
  | "artifact_reuse_selector"
  | "unmet_capability"
  | "parser_text_extraction"
  | "pdf_page_structure_classification"
  | "page_rendering"
  | "ocr"
  | "vision"
  | "table_extractor"
  | "summarizer"
  | "entity_extractor"
  | "clause_extractor"
  | "spreadsheet_range_extractor"
  | "web_page_extractor"
  | "email_thread_extractor";

export type KnowledgeArtifactKind =
  | "document_summary"
  | "page_summary"
  | "section_summary"
  | "table_candidate"
  | "table_extraction"
  | "figure_interpretation"
  | "chart_interpretation"
  | "map_interpretation"
  | "schematic_interpretation"
  | "clause_inventory"
  | "exhibit_schedule_appendix_inventory"
  | "named_entity_inventory"
  | "key_fact_inventory"
  | "extraction_warning"
  | "open_question"
  | "source_memory";

export type KnowledgeArtifactStatus = "active" | "partial" | "warning" | "open" | "superseded";

export type DocumentIntelligenceLocation = {
  pageNumberStart: number | null;
  pageNumberEnd: number | null;
  pageLabelStart: string | null;
  pageLabelEnd: string | null;
  tableId: string | null;
  figureId: string | null;
  sectionPath: string[];
  headingPath: string[];
};

export type DocumentKnowledgeArtifactRecord = {
  id: string;
  sourceDocumentId: string;
  artifactKey: string;
  kind: KnowledgeArtifactKind;
  status: KnowledgeArtifactStatus;
  title: string | null;
  summary: string | null;
  content: string;
  tool: InspectionTool | null;
  confidence: number | null;
  location: DocumentIntelligenceLocation;
  sourceLocationLabel: string | null;
  payload: Record<string, unknown> | null;
  relevanceHints: string[];
  createdAt: string;
  updatedAt: string;
  approxTokenCount: number;
};

export type DocumentInspectionTaskRecord = {
  id: string;
  sourceDocumentId: string;
  taskKey: string;
  kind: InspectionTaskKind;
  status: InspectionTaskStatus;
  tool: InspectionTool;
  rationale: string | null;
  location: DocumentIntelligenceLocation;
  sourceLocationLabel: string | null;
  resultSummary: string | null;
  result: Record<string, unknown> | null;
  unresolved: string[];
  createdArtifactKeys: string[];
  createdAt: string;
  updatedAt: string;
  completedAt: string | null;
};

export type UpsertDocumentKnowledgeArtifactInput = Omit<
  DocumentKnowledgeArtifactRecord,
  "id" | "createdAt" | "updatedAt" | "approxTokenCount"
>;

export type UpsertDocumentInspectionTaskInput = Omit<
  DocumentInspectionTaskRecord,
  "id" | "createdAt" | "updatedAt"
>;

export type KnowledgeArtifactSelectionResult = {
  selectedArtifacts: DocumentKnowledgeArtifactRecord[];
  skippedArtifacts: DocumentKnowledgeArtifactRecord[];
  selectedApproxTokenCount: number;
  totalApproxTokenCount: number;
};

export type DocumentIntelligenceState = {
  sourceDocumentId: string;
  sourceType: string;
  filename: string;
  stateStatus: "empty" | "partial" | "learned";
  artifactCount: number;
  warningArtifactCount: number;
  openQuestionArtifactCount: number;
  selectedArtifactKeys: string[];
  lastInspectedAt: string | null;
  lastInspectionTool: InspectionTool | null;
};

const ARTIFACT_RANKING_STOPWORDS = new Set([
  "a",
  "an",
  "and",
  "any",
  "are",
  "be",
  "can",
  "do",
  "for",
  "from",
  "give",
  "how",
  "i",
  "in",
  "is",
  "it",
  "me",
  "of",
  "on",
  "or",
  "our",
  "please",
  "show",
  "summarize",
  "summary",
  "tell",
  "the",
  "this",
  "to",
  "us",
  "what",
  "where",
  "which",
  "with",
]);

function normalizeWhitespace(value: string | null | undefined) {
  return (value ?? "").replace(/\s+/g, " ").trim();
}

function normalizeTextToken(token: string) {
  return token.trim().toLowerCase();
}

function tokenizeForRanking(value: string | null | undefined) {
  return Array.from(
    new Set(
      normalizeWhitespace(value)
        .toLowerCase()
        .split(/[^a-z0-9]+/i)
        .map(normalizeTextToken)
        .filter((token) => token.length >= 2 && !ARTIFACT_RANKING_STOPWORDS.has(token))
    )
  );
}

function buildArtifactSearchText(artifact: DocumentKnowledgeArtifactRecord) {
  return [
    artifact.kind,
    artifact.status,
    artifact.title,
    artifact.summary,
    artifact.content,
    artifact.sourceLocationLabel,
    artifact.location.tableId,
    artifact.location.figureId,
    ...artifact.location.sectionPath,
    ...artifact.location.headingPath,
    ...artifact.relevanceHints,
  ]
    .filter((value): value is string => typeof value === "string" && value.trim().length > 0)
    .join(" ");
}

function hasTableIntent(query: string | null | undefined) {
  return /\btable|tables|tabular|rows|columns|chemistry\b/i.test(query ?? "");
}

function hasWarningIntent(query: string | null | undefined) {
  return /\bwarning|warn|missing|sparse|unresolved|unclear|limit|limitations|why\b/i.test(query ?? "");
}

function artifactKindIntentBoost(artifact: DocumentKnowledgeArtifactRecord, query: string | null | undefined) {
  let score = 0;

  if (hasTableIntent(query) && (artifact.kind === "table_extraction" || artifact.kind === "table_candidate")) {
    score += artifact.kind === "table_extraction" ? 12 : 10;
  }

  if (hasWarningIntent(query) && (artifact.kind === "extraction_warning" || artifact.kind === "open_question")) {
    score += 10;
  }

  if (artifact.status === "warning") {
    score += 1;
  }

  return score;
}

function compareIsoDateDescending(left: string | null | undefined, right: string | null | undefined) {
  const leftTime = left ? Date.parse(left) : 0;
  const rightTime = right ? Date.parse(right) : 0;
  return rightTime - leftTime;
}

function confidenceToNumber(confidence: PdfVisualClassificationConfidence) {
  switch (confidence) {
    case "high":
      return 0.9;
    case "medium":
      return 0.7;
    default:
      return 0.45;
  }
}

function buildPageReference(pageNumber: number | null | undefined, pageLabel: string | null | undefined) {
  if (pageLabel?.trim()) {
    return `page ${pageLabel.trim()}`;
  }

  if (pageNumber != null) {
    return `page ${pageNumber}`;
  }

  return "page location unavailable";
}

function buildPageLocationTitle(page: Pick<PdfPageStructureSummary, "pageNumber" | "pageLabel" | "title">) {
  const reference = buildPageReference(page.pageNumber, page.pageLabel);
  return page.title?.trim() ? `${reference} (${page.title.trim()})` : reference;
}

function buildUniqueStrings(values: Array<string | null | undefined>) {
  return Array.from(
    new Set(
      values
        .map((value) => normalizeWhitespace(value))
        .filter((value) => value.length > 0)
    )
  );
}

export function buildKnowledgeArtifactSourceLocationLabel(
  filename: string,
  location: DocumentIntelligenceLocation,
  fallbackTitle?: string | null
) {
  const labels: string[] = [filename];
  const pageReference = buildPageReference(location.pageNumberStart, location.pageLabelStart);

  if (pageReference !== "page location unavailable") {
    labels.push(pageReference);
  }

  if (location.tableId?.trim()) {
    labels.push(location.tableId.trim());
  } else if (location.figureId?.trim()) {
    labels.push(location.figureId.trim());
  } else if (fallbackTitle?.trim()) {
    labels.push(fallbackTitle.trim());
  } else if (location.sectionPath.length > 0) {
    labels.push(location.sectionPath[location.sectionPath.length - 1]);
  }

  return labels.join(" - ");
}

export function parseDocumentIntelligenceJsonValue<T>(value: string | null | undefined, fallback: T): T {
  if (!value?.trim()) {
    return fallback;
  }

  try {
    return JSON.parse(value) as T;
  } catch {
    return fallback;
  }
}

export function stringifyDocumentIntelligenceJsonValue(value: unknown) {
  return JSON.stringify(value ?? null);
}

export function mergeDocumentKnowledgeArtifacts(
  existingArtifacts: DocumentKnowledgeArtifactRecord[],
  nextArtifacts: DocumentKnowledgeArtifactRecord[]
) {
  const merged = new Map<string, DocumentKnowledgeArtifactRecord>();

  for (const artifact of existingArtifacts) {
    merged.set(artifact.artifactKey, artifact);
  }

  for (const artifact of nextArtifacts) {
    merged.set(artifact.artifactKey, artifact);
  }

  return [...merged.values()].sort((left, right) =>
    compareIsoDateDescending(left.updatedAt, right.updatedAt) ||
    left.artifactKey.localeCompare(right.artifactKey)
  );
}

export function mergeDocumentInspectionTasks(
  existingTasks: DocumentInspectionTaskRecord[],
  nextTasks: DocumentInspectionTaskRecord[]
) {
  const merged = new Map<string, DocumentInspectionTaskRecord>();

  for (const task of existingTasks) {
    merged.set(task.taskKey, task);
  }

  for (const task of nextTasks) {
    merged.set(task.taskKey, task);
  }

  return [...merged.values()].sort((left, right) =>
    compareIsoDateDescending(left.completedAt ?? left.updatedAt, right.completedAt ?? right.updatedAt) ||
    left.taskKey.localeCompare(right.taskKey)
  );
}

export function buildDocumentIntelligenceState(params: {
  sourceDocumentId: string;
  sourceType: string;
  filename: string;
  artifacts: DocumentKnowledgeArtifactRecord[];
  inspectionTasks: DocumentInspectionTaskRecord[];
  selectedArtifactKeys: string[];
}) {
  const warningArtifactCount = params.artifacts.filter((artifact) => artifact.kind === "extraction_warning").length;
  const openQuestionArtifactCount = params.artifacts.filter((artifact) => artifact.kind === "open_question").length;
  const latestTask = [...params.inspectionTasks].sort((left, right) =>
    compareIsoDateDescending(left.completedAt ?? left.updatedAt, right.completedAt ?? right.updatedAt)
  )[0];
  const lastInspectedAt =
    latestTask?.completedAt ??
    latestTask?.updatedAt ??
    [...params.artifacts].sort((left, right) => compareIsoDateDescending(left.updatedAt, right.updatedAt))[0]?.updatedAt ??
    null;

  return {
    sourceDocumentId: params.sourceDocumentId,
    sourceType: params.sourceType,
    filename: params.filename,
    stateStatus:
      params.artifacts.length === 0
        ? "empty"
        : warningArtifactCount > 0 || openQuestionArtifactCount > 0
          ? "partial"
          : "learned",
    artifactCount: params.artifacts.length,
    warningArtifactCount,
    openQuestionArtifactCount,
    selectedArtifactKeys: [...params.selectedArtifactKeys],
    lastInspectedAt,
    lastInspectionTool: latestTask?.tool ?? null,
  } satisfies DocumentIntelligenceState;
}

function buildDefaultLocation(): DocumentIntelligenceLocation {
  return {
    pageNumberStart: null,
    pageNumberEnd: null,
    pageLabelStart: null,
    pageLabelEnd: null,
    tableId: null,
    figureId: null,
    sectionPath: [],
    headingPath: [],
  };
}

function buildStructuredRangeLocation(range: ContextDocumentStructuredRangeInput): DocumentIntelligenceLocation {
  return {
    pageNumberStart: range.pageNumber ?? null,
    pageNumberEnd: range.pageNumber ?? null,
    pageLabelStart: range.pageLabel ?? null,
    pageLabelEnd: range.pageLabel ?? null,
    tableId: range.tableId ?? null,
    figureId: range.figureId ?? null,
    sectionPath: [...(range.sectionPath ?? [])],
    headingPath: [...(range.headingPath ?? [])],
  };
}

function buildPageStructureLocation(page: Pick<PdfPageStructureSummary, "pageNumber" | "pageLabel">): DocumentIntelligenceLocation {
  return {
    ...buildDefaultLocation(),
    pageNumberStart: page.pageNumber,
    pageNumberEnd: page.pageNumber,
    pageLabelStart: page.pageLabel,
    pageLabelEnd: page.pageLabel,
  };
}

function buildArtifactApproxTokenCount(content: string, summary: string | null, title: string | null) {
  return estimateTextTokens([title, summary, content].filter(Boolean).join("\n"));
}

const BUILT_IN_PERMISSION_REQUIREMENT = {
  requiresNetwork: false,
  requiresUserApproval: false,
  requiresAdminApproval: false,
  readsSourceDocument: true,
  writesArtifacts: true,
  tenantScoped: true,
} satisfies ToolPermissionRequirement;

const FREE_IN_PROCESS_COST = {
  costClass: "free_local",
  metered: false,
  unitLabel: null,
  estimatedUnitCostUsd: null,
} satisfies ToolCostEstimate;

const BUILT_IN_DATA_POLICY = {
  allowedDataClasses: ["public", "internal", "confidential"],
  tenantScoped: true,
  leavesTenantBoundary: false,
  storesExternalCopy: false,
} satisfies ToolDataPolicy;

const NO_FALLBACK_POLICY = {
  fallbackCapabilities: [],
  recommendWhenConfidenceBelow: null,
  fallbackRecommendation: null,
} satisfies ToolFallbackPolicy;

const TABLE_BODY_RECOVERY_FALLBACK_POLICY = {
  fallbackCapabilities: [
    "rendered_page_inspection",
    "ocr",
    "vision_page_understanding",
    "document_ai_table_recovery",
  ],
  recommendWhenConfidenceBelow: 0.7,
  fallbackRecommendation:
    "Current approved parser output did not recover a structured table body. Request approval for rendered-page inspection, OCR, vision page understanding, or document AI table recovery before attempting deeper extraction.",
} satisfies ToolFallbackPolicy;

function buildBuiltInInspectionTool(params: {
  id: InspectionTool;
  label: string;
  description: string;
  capabilities: InspectionCapability[];
  sourceTypes: string[];
  runtimeClass?: ToolRuntimeClass;
  executionBoundary?: ToolExecutionBoundary;
  sideEffectLevel?: ToolSideEffectLevel;
  fallbackPolicy?: ToolFallbackPolicy;
  latencyClass?: ToolLatencyClass;
  reliability: number;
  artifactContract: string | null;
  benchmarkFixtureIds?: string[];
  limitations: string[];
  selectionPriority: number;
}): InspectionToolDefinition {
  const runtimeClass = params.runtimeClass ?? "local";
  const executionBoundary = params.executionBoundary ?? "in_process";
  const sideEffectLevel = params.sideEffectLevel ?? "read_only";
  const latencyClass = params.latencyClass ?? "sync_safe";
  const fallbackPolicy = params.fallbackPolicy ?? NO_FALLBACK_POLICY;
  const artifactContracts = params.artifactContract ? [params.artifactContract] : [];
  const benchmarkFixtureIds = params.benchmarkFixtureIds ?? [];

  return {
    id: params.id,
    label: params.label,
    description: params.description,
    capabilities: params.capabilities,
    sourceTypes: params.sourceTypes,
    approvalStatus: "built_in",
    runtimeClass,
    executionBoundary,
    dataPolicy: BUILT_IN_DATA_POLICY,
    sideEffectLevel,
    permissionRequirement: BUILT_IN_PERMISSION_REQUIREMENT,
    costEstimate: FREE_IN_PROCESS_COST,
    latencyClass,
    fallbackPolicy,
    reliability: params.reliability,
    reusableResult: true,
    artifactContract: params.artifactContract,
    artifactContracts,
    benchmarkFixtureIds,
    toolCard: {
      id: params.id,
      label: params.label,
      description: params.description,
      capabilities: params.capabilities,
      sourceTypes: params.sourceTypes,
      approvalStatus: "built_in",
      runtimeClass,
      executionBoundary,
      dataPolicy: BUILT_IN_DATA_POLICY,
      sideEffectLevel,
      permissionRequirement: BUILT_IN_PERMISSION_REQUIREMENT,
      costEstimate: FREE_IN_PROCESS_COST,
      latencyClass,
      artifactContracts,
      benchmarkFixtureIds,
      fallbackPolicy,
      reliability: params.reliability,
      reusableResult: true,
      limitations: params.limitations,
      selectionPriority: params.selectionPriority,
    },
    limitations: params.limitations,
    selectionPriority: params.selectionPriority,
    execute: ({ invocation, tool }) => {
      const confidence =
        typeof invocation.input.confidence === "number"
          ? invocation.input.confidence
          : typeof invocation.input.confidence === "string"
            ? confidenceToNumber(invocation.input.confidence as PdfVisualClassificationConfidence)
            : tool.reliability;
      const hasExtractedText = invocation.input.hasExtractedText !== false;
      const summary =
        typeof invocation.input.summary === "string"
          ? invocation.input.summary
          : hasExtractedText
            ? `${tool.label} produced an approved built-in inspection signal.`
            : `${tool.label} ran, but no structured table body was recovered from approved parser output.`;

      return buildCompletedToolResult({
        invocation,
        tool,
        confidence: hasExtractedText ? confidence : Math.min(confidence, 0.35),
        summary,
        output: {
          ...invocation.input,
          executedBoundary: tool.executionBoundary,
          runtimeClass: tool.runtimeClass,
          approvalStatus: tool.approvalStatus,
          approvedRuntimeTool: true,
          recoveredBody: hasExtractedText,
        },
        limitations: hasExtractedText
          ? []
          : ["No structured row or column body was recovered from the current approved parser output."],
        fallbackRecommendation: hasExtractedText
          ? tool.fallbackPolicy.fallbackRecommendation
          : TABLE_BODY_RECOVERY_FALLBACK_POLICY.fallbackRecommendation,
      });
    },
  };
}

export function buildDefaultInspectionToolRegistry() {
  return new InspectionToolRegistry().registerMany([
    buildBuiltInInspectionTool({
      id: "existing_parser_text_extraction",
      label: "Existing parser text extraction",
      description:
        "Uses the app's current local parsers and structured ranges. It can preserve text already extracted by approved parser code, but it cannot recover unseen OCR, rendered-page, or vision content.",
      capabilities: ["text_extraction", "pdf_table_body_recovery"],
      sourceTypes: ["text", "markdown", "pdf", "docx", "pptx", "spreadsheet"],
      fallbackPolicy: TABLE_BODY_RECOVERY_FALLBACK_POLICY,
      reliability: 0.72,
      artifactContract: "table_extraction or extraction_warning",
      sideEffectLevel: "creates_internal_artifact",
      benchmarkFixtureIds: ["t5_pdf_page_15_visible_table"],
      limitations: [
        "Parser-first text is a supporting signal and may miss rendered, scanned, or image-only content.",
      ],
      selectionPriority: 10,
    }),
    buildBuiltInInspectionTool({
      id: "pdf_page_classification",
      label: "PDF page classification",
      description:
        "Classifies already-extracted PDF page text and parser metadata into page-level visual/content categories.",
      capabilities: ["pdf_page_classification"],
      sourceTypes: ["pdf"],
      reliability: 0.68,
      artifactContract: "inspection trace",
      sideEffectLevel: "read_only",
      benchmarkFixtureIds: ["t5_pdf_page_15_visible_table"],
      limitations: [
        "Classification is based on extracted text and conservative structural signals, not rendered page vision.",
      ],
      selectionPriority: 20,
    }),
    buildBuiltInInspectionTool({
      id: "pdf_table_candidate_detection",
      label: "PDF table candidate detection",
      description:
        "Detects likely table pages from approved PDF page classification metadata and records table candidates without inventing missing cells.",
      capabilities: ["pdf_table_detection"],
      sourceTypes: ["pdf"],
      fallbackPolicy: TABLE_BODY_RECOVERY_FALLBACK_POLICY,
      reliability: 0.7,
      artifactContract: "table_candidate",
      sideEffectLevel: "creates_internal_artifact",
      benchmarkFixtureIds: ["t5_pdf_page_15_visible_table"],
      limitations: [
        "Detects likely table pages only; it does not recover missing row or column body content.",
      ],
      selectionPriority: 30,
    }),
    buildBuiltInInspectionTool({
      id: "pdf_sparse_table_warning",
      label: "PDF sparse table warning",
      description:
        "Records a warning when a likely table exists but approved extraction did not recover a structured body.",
      capabilities: ["artifact_validation"],
      sourceTypes: ["pdf"],
      fallbackPolicy: TABLE_BODY_RECOVERY_FALLBACK_POLICY,
      reliability: 0.78,
      artifactContract: "extraction_warning",
      sideEffectLevel: "creates_internal_artifact",
      benchmarkFixtureIds: ["t5_pdf_page_15_visible_table"],
      limitations: [
        "Warning-only tool; it records the limitation and recommended next capabilities instead of fabricating table values.",
      ],
      selectionPriority: 40,
    }),
    buildBuiltInInspectionTool({
      id: "artifact_reuse_selector",
      label: "Artifact reuse selector",
      description:
        "Ranks stored knowledge artifacts for reuse in future context before weaker raw parser excerpts.",
      capabilities: ["artifact_summarization", "artifact_validation"],
      sourceTypes: ["*"],
      reliability: 0.76,
      artifactContract: "inspection trace",
      sideEffectLevel: "read_only",
      benchmarkFixtureIds: ["artifact_supersession"],
      limitations: [
        "Selection uses deterministic text and kind signals; it is not an LLM semantic reranker in this pass.",
      ],
      selectionPriority: 50,
    }),
  ]);
}

export function buildDefaultInspectionToolBroker() {
  return new InspectionToolBroker(buildDefaultInspectionToolRegistry());
}

function buildInspectionInvocationId(params: {
  sourceDocumentId: string;
  capability: InspectionCapability;
  locationKey: string;
}) {
  return `${params.sourceDocumentId}:${params.capability}:${params.locationKey.replace(/[^a-z0-9:_-]+/gi, "_")}`;
}

function getSelectedInspectionTool(result: InspectionToolResult, fallback: InspectionTool): InspectionTool {
  return (result.selectedTool?.id ?? fallback) as InspectionTool;
}

function mergeUniqueCapabilities(results: InspectionToolResult[]) {
  return Array.from(
    new Set(results.flatMap((result) => result.recommendedNextCapabilities))
  );
}

function mergeUniqueStringsFromResults(results: InspectionToolResult[], selector: (result: InspectionToolResult) => string[]) {
  return Array.from(new Set(results.flatMap(selector).filter((value) => value.trim().length > 0)));
}

function buildCombinedToolTracePayload(params: {
  primaryResult: InspectionToolResult;
  supportingResults?: InspectionToolResult[];
  createdArtifactKeys: string[];
}) {
  const supportingResults = params.supportingResults ?? [];
  const allResults = [params.primaryResult, ...supportingResults];
  const fallbackRecommendation =
    allResults.map((result) => result.fallbackRecommendation).find((value): value is string => Boolean(value)) ?? null;

  return {
    ...createToolTracePayload(params.primaryResult, params.createdArtifactKeys),
    limitations: mergeUniqueStringsFromResults(allResults, (result) => result.limitations),
    fallbackRecommendation,
    recommendedNextCapabilities: mergeUniqueCapabilities(allResults),
    supportingToolTraces: supportingResults.map((result) =>
      createToolTracePayload(result, params.createdArtifactKeys)
    ),
    traceEvents: allResults.flatMap((result) => result.traceEvents),
    executedUnapprovedTool: false,
  };
}

export function rankDocumentKnowledgeArtifacts(params: {
  artifacts: DocumentKnowledgeArtifactRecord[];
  query: string | null | undefined;
}) {
  const queryTokens = tokenizeForRanking(params.query);
  const queryPhrase = normalizeWhitespace(params.query).toLowerCase();

  return [...params.artifacts]
    .map((artifact) => {
      const searchText = buildArtifactSearchText(artifact).toLowerCase();
      const tokenHits = queryTokens.reduce((sum, token) => sum + (searchText.includes(token) ? 1 : 0), 0);
      const exactPhraseHit =
        queryPhrase.length >= 4 && searchText.includes(queryPhrase) ? 1 : 0;
      const score =
        tokenHits * 4 +
        exactPhraseHit * 10 +
        artifactKindIntentBoost(artifact, params.query) +
        (artifact.confidence ?? 0);

      return {
        artifact,
        score,
      };
    })
    .sort((left, right) =>
      right.score - left.score ||
      compareIsoDateDescending(left.artifact.updatedAt, right.artifact.updatedAt) ||
      left.artifact.artifactKey.localeCompare(right.artifact.artifactKey)
    );
}

export function selectDocumentKnowledgeArtifactsWithinBudget(params: {
  artifacts: DocumentKnowledgeArtifactRecord[];
  query: string | null | undefined;
  maxTokens: number;
  maxArtifacts?: number;
}) {
  const ranked = rankDocumentKnowledgeArtifacts({
    artifacts: params.artifacts,
    query: params.query,
  });
  const selectedArtifacts: DocumentKnowledgeArtifactRecord[] = [];
  const skippedArtifacts: DocumentKnowledgeArtifactRecord[] = [];
  const maxArtifacts = params.maxArtifacts ?? 3;
  let selectedApproxTokenCount = 0;

  for (const { artifact, score } of ranked) {
    if (selectedArtifacts.length >= maxArtifacts) {
      skippedArtifacts.push(artifact);
      continue;
    }

    const artifactTokens = artifact.approxTokenCount;
    const shouldSelect =
      selectedArtifacts.length === 0
        ? artifactTokens <= params.maxTokens && (score > 0 || params.artifacts.length === 1)
        : selectedApproxTokenCount + artifactTokens <= params.maxTokens && score > 0;

    if (shouldSelect) {
      selectedArtifacts.push(artifact);
      selectedApproxTokenCount += artifactTokens;
    } else {
      skippedArtifacts.push(artifact);
    }
  }

  return {
    selectedArtifacts,
    skippedArtifacts,
    selectedApproxTokenCount,
    totalApproxTokenCount: params.artifacts.reduce((sum, artifact) => sum + artifact.approxTokenCount, 0),
  } satisfies KnowledgeArtifactSelectionResult;
}

function buildTableExtractionArtifact(params: {
  sourceDocumentId: string;
  range: ContextDocumentStructuredRangeInput;
  filename: string;
  toolResult: InspectionToolResult;
}) {
  const location = buildStructuredRangeLocation(params.range);
  const pageReference = buildPageReference(location.pageNumberStart, location.pageLabelStart);
  const title = params.range.tableId?.trim()
    ? `${params.range.tableId.trim()} extracted from ${pageReference}`
    : `Extracted table text from ${pageReference}`;
  const summary = `Parser-recovered table content from ${pageReference}. This artifact preserves only extracted table text without inferring missing values.`;
  const content = normalizeWhitespace(params.range.text);
  const artifactKey = `table_extraction:${location.pageNumberStart ?? "na"}:${location.tableId ?? "table"}`;
  const sourceLocationLabel = buildKnowledgeArtifactSourceLocationLabel(
    params.filename,
    location,
    params.range.tableId ?? params.range.visualAnchorTitle ?? null
  );

  return {
    artifactKey,
    sourceDocumentId: params.sourceDocumentId,
    kind: "table_extraction",
    status: "active",
    title,
    summary,
    content,
    tool: getSelectedInspectionTool(params.toolResult, "existing_parser_text_extraction"),
    confidence:
      params.range.visualClassification === "true_table"
        ? 0.9
        : params.range.visualClassification === "table_like_schedule_or_timeline"
          ? 0.5
          : 0.7,
    location,
    sourceLocationLabel,
    payload: {
      extractedText: content,
      visualClassification: params.range.visualClassification ?? null,
      visualClassificationConfidence: params.range.visualClassificationConfidence ?? null,
      toolTrace: createToolTracePayload(params.toolResult, [artifactKey]),
    },
    relevanceHints: buildUniqueStrings([
      "table",
      pageReference,
      params.range.tableId ?? null,
      params.range.visualAnchorTitle ?? null,
    ]),
  } satisfies UpsertDocumentKnowledgeArtifactInput;
}

function buildTableExtractionTask(params: {
  sourceDocumentId: string;
  artifact: UpsertDocumentKnowledgeArtifactInput;
  toolResult: InspectionToolResult;
}) {
  return {
    taskKey: `inspect_table:${params.artifact.artifactKey}`,
    sourceDocumentId: params.sourceDocumentId,
    kind: "inspect_table",
    status: "completed",
    tool: getSelectedInspectionTool(params.toolResult, "existing_parser_text_extraction"),
    rationale: params.toolResult.selectionReason,
    location: params.artifact.location,
    sourceLocationLabel: params.artifact.sourceLocationLabel,
    resultSummary: params.artifact.summary,
    result: {
      artifactKind: params.artifact.kind,
      persistedArtifactKey: params.artifact.artifactKey,
      toolTrace: createToolTracePayload(params.toolResult, [params.artifact.artifactKey]),
    },
    unresolved: [],
    createdArtifactKeys: [params.artifact.artifactKey],
    completedAt: new Date().toISOString(),
  } satisfies UpsertDocumentInspectionTaskInput;
}

function buildTrueTableCandidateArtifacts(params: {
  sourceDocumentId: string;
  filename: string;
  page: PdfPageStructureSummary;
  detectionResult: InspectionToolResult;
  bodyRecoveryResult: InspectionToolResult;
  warningResult: InspectionToolResult;
}) {
  const location = buildPageStructureLocation(params.page);
  const locationTitle = buildPageLocationTitle(params.page);
  const title = `Likely table detected on ${locationTitle}`;
  const summary =
    params.page.title?.trim()
      ? `The page titled "${params.page.title.trim()}" is classified as a probable true table, but structured body extraction remained sparse.`
      : "A page is classified as a probable true table, but structured body extraction remained sparse.";
  const sourceLocationLabel = buildKnowledgeArtifactSourceLocationLabel(
    params.filename,
    location,
    params.page.title
  );
  const unresolved = [
    "No structured row or column body was recovered from the current parser output.",
    "Do not infer missing columns, cell values, or headers from this artifact alone.",
  ];
  const candidateArtifact = {
    artifactKey: `table_candidate:${params.page.pageNumber}`,
    sourceDocumentId: params.sourceDocumentId,
    kind: "table_candidate",
    status: "partial",
    title,
    summary,
    content: [
      `${params.page.confidence === "low" ? "Probable" : "Likely"} true data table detected on ${buildPageReference(params.page.pageNumber, params.page.pageLabel)}.`,
      params.page.title?.trim() ? `Page title: ${params.page.title.trim()}.` : null,
      "The current parser did not recover a structured table body for this page.",
      "Persist this as a durable table candidate and treat deeper rendered-page, OCR, or vision follow-up as the next inspection step when row/column detail is needed.",
    ]
      .filter((part): part is string => Boolean(part))
      .join(" "),
    tool: getSelectedInspectionTool(params.detectionResult, "pdf_table_candidate_detection"),
    confidence: confidenceToNumber(params.page.confidence),
    location,
    sourceLocationLabel,
    payload: {
      primaryClassification: params.page.primaryClassification,
      confidence: params.page.confidence,
      reasonCodes: [...params.page.reasonCodes],
      lowText: params.page.lowText,
      extractedTableCandidateCount: params.page.extractedTableCandidateCount,
      retainedTableSummaryCount: params.page.retainedTableSummaryCount,
      toolTrace: createToolTracePayload(params.detectionResult, [`table_candidate:${params.page.pageNumber}`]),
    },
    relevanceHints: buildUniqueStrings([
      "table",
      "table candidate",
      buildPageReference(params.page.pageNumber, params.page.pageLabel),
      params.page.title,
    ]),
  } satisfies UpsertDocumentKnowledgeArtifactInput;
  const warningArtifact = {
    artifactKey: `extraction_warning:${params.page.pageNumber}:table_body_missing`,
    sourceDocumentId: params.sourceDocumentId,
    kind: "extraction_warning",
    status: "warning",
    title: `Sparse extraction warning for ${locationTitle}`,
    summary: "A likely true table was detected, but the current extraction toolchain did not recover the body text.",
    content: [
      `Sparse extraction warning for ${buildPageReference(params.page.pageNumber, params.page.pageLabel)}.`,
      params.page.title?.trim() ? `Page title: ${params.page.title.trim()}.` : null,
      ...unresolved,
    ]
      .filter((part): part is string => Boolean(part))
      .join(" "),
    tool: getSelectedInspectionTool(params.warningResult, "pdf_sparse_table_warning"),
    confidence: confidenceToNumber(params.page.confidence),
    location,
    sourceLocationLabel,
    payload: {
      unresolved,
      reasonCodes: [...params.page.reasonCodes],
      toolTrace: createToolTracePayload(params.warningResult, [
        `extraction_warning:${params.page.pageNumber}:table_body_missing`,
      ]),
      bodyRecoveryTrace: createToolTracePayload(params.bodyRecoveryResult, [
        `extraction_warning:${params.page.pageNumber}:table_body_missing`,
      ]),
    },
    relevanceHints: buildUniqueStrings([
      "warning",
      "missing table body",
      "sparse extraction",
      buildPageReference(params.page.pageNumber, params.page.pageLabel),
      params.page.title,
    ]),
  } satisfies UpsertDocumentKnowledgeArtifactInput;
  const inspectionTask = {
    taskKey: `inspect_table_candidate:${params.page.pageNumber}`,
    sourceDocumentId: params.sourceDocumentId,
    kind: "inspect_table",
    status: "completed",
    tool: getSelectedInspectionTool(params.detectionResult, "pdf_table_candidate_detection"),
    rationale: params.detectionResult.selectionReason,
    location,
    sourceLocationLabel,
    resultSummary: summary,
    result: {
      primaryClassification: params.page.primaryClassification,
      confidence: params.page.confidence,
      reasonCodes: [...params.page.reasonCodes],
      toolTrace: buildCombinedToolTracePayload({
        primaryResult: params.detectionResult,
        supportingResults: [params.bodyRecoveryResult, params.warningResult],
        createdArtifactKeys: [
          candidateArtifact.artifactKey,
          warningArtifact.artifactKey,
        ],
      }),
    },
    unresolved,
    createdArtifactKeys: [candidateArtifact.artifactKey, warningArtifact.artifactKey],
    completedAt: new Date().toISOString(),
  } satisfies UpsertDocumentInspectionTaskInput;

  return {
    candidateArtifact,
    warningArtifact,
    inspectionTask,
  };
}

export function synthesizePdfDocumentIntelligence(params: {
  sourceDocumentId: string;
  filename: string;
  extractionMetadata: PdfContextExtractionMetadata | null;
  structuredRanges: ContextDocumentStructuredRangeInput[] | undefined;
  toolBroker?: InspectionToolBroker | null;
}) {
  if (!params.extractionMetadata) {
    return {
      artifacts: [] as UpsertDocumentKnowledgeArtifactInput[],
      inspectionTasks: [] as UpsertDocumentInspectionTaskInput[],
    };
  }

  const toolBroker = params.toolBroker ?? buildDefaultInspectionToolBroker();
  const artifacts: UpsertDocumentKnowledgeArtifactInput[] = [];
  const inspectionTasks: UpsertDocumentInspectionTaskInput[] = [];
  const tableRangeGroups = new Map<string, ContextDocumentStructuredRangeInput[]>();

  for (const range of params.structuredRanges ?? []) {
    if (!range.tableId || !normalizeWhitespace(range.text)) {
      continue;
    }

    const groupKey = `${range.pageNumber ?? "na"}:${range.pageLabel ?? "na"}:${range.tableId}`;
    const group = tableRangeGroups.get(groupKey) ?? [];
    group.push(range);
    tableRangeGroups.set(groupKey, group);
  }

  for (const groupedRanges of tableRangeGroups.values()) {
    const representativeRange = groupedRanges[0];
    const mergedText = buildUniqueStrings(groupedRanges.map((range) => range.text)).join("\n");
    if (!mergedText) {
      continue;
    }

    const pageNumber = representativeRange.pageNumber ?? null;
    const tableId = representativeRange.tableId ?? "table";
    const toolResult = toolBroker.invoke({
      invocationId: buildInspectionInvocationId({
        sourceDocumentId: params.sourceDocumentId,
        capability: "pdf_table_body_recovery",
        locationKey: `${pageNumber ?? "na"}:${tableId}`,
      }),
      sourceDocumentId: params.sourceDocumentId,
      sourceType: "pdf",
      requestedCapability: "pdf_table_body_recovery",
      purpose: "Recover and persist structured table body text already available from approved parser output.",
      input: {
        hasExtractedText: true,
        pageNumber,
        pageLabel: representativeRange.pageLabel ?? null,
        tableId,
        textLength: mergedText.length,
        visualClassification: representativeRange.visualClassification ?? null,
        confidence: representativeRange.visualClassificationConfidence ?? null,
        summary: `Approved parser output recovered table body text for ${buildPageReference(pageNumber, representativeRange.pageLabel)}.`,
      },
      location: {
        pageNumber,
        pageLabel: representativeRange.pageLabel ?? null,
        tableId,
      },
    });
    const artifact = buildTableExtractionArtifact({
      sourceDocumentId: params.sourceDocumentId,
      range: {
        ...representativeRange,
        text: mergedText,
      },
      filename: params.filename,
      toolResult,
    });
    artifacts.push(artifact);
    inspectionTasks.push(buildTableExtractionTask({
      sourceDocumentId: params.sourceDocumentId,
      artifact,
      toolResult,
    }));
  }

  const extractedTablePages = new Set(
    artifacts
      .filter((artifact) => artifact.kind === "table_extraction")
      .map((artifact) => artifact.location.pageNumberStart)
      .filter((pageNumber): pageNumber is number => typeof pageNumber === "number")
  );

  for (const page of params.extractionMetadata.pageStructures) {
    if (page.primaryClassification !== "true_table" || extractedTablePages.has(page.pageNumber)) {
      continue;
    }

    const detectionResult = toolBroker.invoke({
      invocationId: buildInspectionInvocationId({
        sourceDocumentId: params.sourceDocumentId,
        capability: "pdf_table_detection",
        locationKey: `${page.pageNumber}`,
      }),
      sourceDocumentId: params.sourceDocumentId,
      sourceType: "pdf",
      requestedCapability: "pdf_table_detection",
      purpose: "Detect whether approved PDF page classification signals should become a durable table candidate.",
      input: {
        pageNumber: page.pageNumber,
        pageLabel: page.pageLabel,
        title: page.title,
        primaryClassification: page.primaryClassification,
        confidence: page.confidence,
        reasonCodes: [...page.reasonCodes],
        hasExtractedText: true,
        summary: `Approved page classification detected a likely table candidate on ${buildPageReference(page.pageNumber, page.pageLabel)}.`,
      },
      location: {
        pageNumber: page.pageNumber,
        pageLabel: page.pageLabel,
      },
      recommendedNextCapabilities: [
        "pdf_table_body_recovery",
        "rendered_page_inspection",
        "ocr",
        "vision_page_understanding",
        "document_ai_table_recovery",
      ],
    });
    const bodyRecoveryResult = toolBroker.invoke({
      invocationId: buildInspectionInvocationId({
        sourceDocumentId: params.sourceDocumentId,
        capability: "pdf_table_body_recovery",
        locationKey: `${page.pageNumber}:missing_body`,
      }),
      sourceDocumentId: params.sourceDocumentId,
      sourceType: "pdf",
      requestedCapability: "pdf_table_body_recovery",
      purpose: "Attempt approved table body recovery before recording a sparse extraction warning.",
      input: {
        hasExtractedText: false,
        pageNumber: page.pageNumber,
        pageLabel: page.pageLabel,
        title: page.title,
        primaryClassification: page.primaryClassification,
        confidence: page.confidence,
        reasonCodes: [...page.reasonCodes],
        summary: `Approved parser output did not recover a structured table body for ${buildPageReference(page.pageNumber, page.pageLabel)}.`,
      },
      location: {
        pageNumber: page.pageNumber,
        pageLabel: page.pageLabel,
      },
      recommendedNextCapabilities: [
        "rendered_page_inspection",
        "ocr",
        "vision_page_understanding",
        "document_ai_table_recovery",
      ],
      proposedToolPaths: [
        "approved rendered-page inspection service",
        "approved OCR provider",
        "approved vision model/provider capability",
        "approved document AI table extraction service",
      ],
    });
    const warningResult = toolBroker.invoke({
      invocationId: buildInspectionInvocationId({
        sourceDocumentId: params.sourceDocumentId,
        capability: "artifact_validation",
        locationKey: `${page.pageNumber}:table_body_missing`,
      }),
      sourceDocumentId: params.sourceDocumentId,
      sourceType: "pdf",
      requestedCapability: "artifact_validation",
      purpose: "Record reusable extraction warning metadata for sparse table body recovery.",
      input: {
        hasExtractedText: true,
        pageNumber: page.pageNumber,
        pageLabel: page.pageLabel,
        title: page.title,
        confidence: page.confidence,
        warning: "table_body_missing",
        summary: `Sparse table extraction warning recorded for ${buildPageReference(page.pageNumber, page.pageLabel)}.`,
      },
      location: {
        pageNumber: page.pageNumber,
        pageLabel: page.pageLabel,
      },
      recommendedNextCapabilities: bodyRecoveryResult.recommendedNextCapabilities,
    });
    const synthesized = buildTrueTableCandidateArtifacts({
      sourceDocumentId: params.sourceDocumentId,
      filename: params.filename,
      page,
      detectionResult,
      bodyRecoveryResult,
      warningResult,
    });
    artifacts.push(synthesized.candidateArtifact, synthesized.warningArtifact);
    inspectionTasks.push(synthesized.inspectionTask);
  }

  return {
    artifacts,
    inspectionTasks,
  };
}

export function materializeDocumentKnowledgeArtifactRecord(
  record: UpsertDocumentKnowledgeArtifactInput & {
    id: string;
    createdAt: string;
    updatedAt: string;
  }
) {
  return {
    ...record,
    approxTokenCount: buildArtifactApproxTokenCount(record.content, record.summary, record.title),
  } satisfies DocumentKnowledgeArtifactRecord;
}
