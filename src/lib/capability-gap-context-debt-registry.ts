import type {
  AgentControlDecision,
  AgentControlSourceSignal,
  SourceCoverageTarget as AgentControlSourceCoverageTarget,
} from "./agent-control-surface";
import type {
  AsyncAgentWorkDebugSnapshot,
  AsyncAgentWorkItem,
} from "./async-agent-work-queue";
import type {
  ContextTransportDebugSnapshot,
  ContextTransportResult,
  ContextPayload,
  ContextTransportExclusion,
} from "./adaptive-context-transport";
import type { ContextPackingCandidate } from "./context-packing-kernel";
import type { InspectionCapability, ToolRuntimeClass } from "./inspection-tool-broker";
import { prisma } from "./prisma";
import type {
  ContextGap,
  ProgressiveContextAssemblyResult,
} from "./progressive-context-assembly";
import type { TruthfulExecutionClaimSnapshot } from "./truthful-execution-claim-guard";
import type {
  AgentWorkPlan,
  AgentWorkPlanCapabilityNeed,
  AgentWorkPlanModelNeed,
  AgentWorkPlanSourceNeed,
  AgentWorkPlanState,
} from "./context-seams";

export type ContextDebtStatus =
  | "open"
  | "planned"
  | "in_progress"
  | "waiting_for_approval"
  | "blocked_by_policy"
  | "resolved"
  | "resolved_with_limitations"
  | "superseded"
  | "dismissed";

export type ContextDebtKind =
  | "missing_table_body"
  | "weak_table_candidate"
  | "unresolved_figure"
  | "unresolved_chart"
  | "stale_artifact"
  | "incomplete_source_coverage"
  | "incomplete_table_coverage"
  | "incomplete_page_coverage"
  | "incomplete_attachment_coverage"
  | "excluded_context_candidate"
  | "deferred_capability_needed"
  | "approval_required"
  | "async_required"
  | "validation_gap"
  | "output_budget_gap"
  | "blocked_by_policy"
  | "source_freshness_unknown";

export type ContextDebtSeverity = "low" | "medium" | "high" | "critical";

export type ContextDebtSourceScope =
  | "document"
  | "page"
  | "page_range"
  | "table"
  | "figure"
  | "chart"
  | "sheet"
  | "slide"
  | "attachment"
  | "source_section"
  | "source_collection"
  | "conversation_document"
  | "conversation"
  | "workspace";

export type ContextDebtResolutionPath =
  | "reuse_existing_artifact"
  | "expand_context"
  | "run_approved_builtin_inspection"
  | "create_async_work_item"
  | "request_approval"
  | "rendered_page_inspection_needed"
  | "ocr_needed"
  | "vision_needed"
  | "document_ai_needed"
  | "external_tool_needed"
  | "manual_review_needed"
  | "blocked_by_policy";

export type ContextDebtUpsertPolicy = {
  mode: "stable_key_merge";
  dedupeFields: string[];
  preserveOpenStatus: boolean;
  detail: string;
};

export type ContextDebtSelectionPolicy = {
  statuses: ContextDebtStatus[];
  maxRecords: number;
  includeResolved: false;
  prioritizeSeverity: true;
};

export type ContextDebtReuseDecision = {
  debtKey: string;
  selected: boolean;
  reason: string;
  status: ContextDebtStatus;
  severity: ContextDebtSeverity;
};

export type ContextDebtResolutionAttempt = {
  attemptedAt: string;
  path: ContextDebtResolutionPath;
  status: "planned" | "attempted" | "blocked" | "deferred";
  detail: string;
  executedUnavailableCapability: false;
};

export type ContextDebtTraceEvent = {
  type:
    | "context_debt_created"
    | "context_debt_updated"
    | "context_debt_reused"
    | "context_debt_selected"
    | "context_debt_skipped";
  timestamp: string;
  debtKey: string;
  detail: string;
  metadata: Record<string, unknown> | null;
};

export type ContextDebtArtifactLink = {
  debtKey: string;
  artifactKey: string;
  linkType: "evidence" | "weak_artifact" | "warning" | "candidate";
  detail: string;
};

export type ContextDebtAsyncWorkLink = {
  debtKey: string;
  asyncAgentWorkItemId: string;
  linkType: "created_from" | "updated_from" | "planned_resolution";
  detail: string;
};

export type ContextDebtRecord = {
  id: string;
  debtKey: string;
  workspaceId: string | null;
  conversationId: string | null;
  conversationDocumentId: string | null;
  asyncAgentWorkItemId: string | null;
  artifactKey: string | null;
  sourceId: string | null;
  kind: ContextDebtKind;
  status: ContextDebtStatus;
  severity: ContextDebtSeverity;
  sourceScope: ContextDebtSourceScope;
  sourceLocator: Record<string, unknown>;
  title: string;
  description: string;
  whyItMatters: string | null;
  resolutionPath: ContextDebtResolutionPath;
  resolutionPaths: ContextDebtResolutionPath[];
  deferredCapabilities: InspectionCapability[];
  requiredApprovalReasons: string[];
  policyBlockers: string[];
  sourceCoverageTarget: Record<string, unknown>;
  evidence: Record<string, unknown>;
  traceEvents: ContextDebtTraceEvent[];
  linkedArtifactKeys: string[];
  firstSeenAt: string;
  lastSeenAt: string;
  resolvedAt: string | null;
  createdAt: string;
  updatedAt: string;
};

export type CapabilityGapStatus =
  | "detected"
  | "proposed"
  | "review_needed"
  | "approved"
  | "planned"
  | "implemented"
  | "configured"
  | "execution_enabled"
  | "validated"
  | "resolved"
  | "superseded"
  | "blocked"
  | "dismissed";

export type CapabilityGapKind =
  | "missing_context_lane"
  | "missing_tool"
  | "missing_model_capability"
  | "missing_connector"
  | "missing_artifact_type"
  | "missing_budget_profile"
  | "missing_validation_capability"
  | "missing_creation_capability"
  | "missing_storage_policy"
  | "missing_approval_path"
  | "missing_runtime_mode"
  | "missing_source_coverage_capability"
  | "missing_context_transport"
  | "missing_external_configuration"
  | "missing_benchmark_fixture";

export type CapabilityGapSeverity = ContextDebtSeverity;

export type CapabilityGapResolutionPath =
  | "register_context_lane"
  | "register_tool"
  | "register_model_capability"
  | "add_tool_catalog_entry"
  | "add_model_manifest"
  | "add_payload_manifest"
  | "add_artifact_type"
  | "add_approval_policy"
  | "add_budget_profile"
  | "add_connector"
  | "add_creation_pipeline"
  | "add_validation_tool"
  | "add_capability_pack"
  | "configure_external_service"
  | "add_benchmark_fixture"
  | "manual_review_needed"
  | "blocked_by_policy";

export type CapabilityGapUpsertPolicy = {
  mode: "stable_key_merge";
  dedupeFields: string[];
  preserveNonResolvedStatus: boolean;
  detail: string;
};

export type CapabilityGapSelectionPolicy = {
  statuses: CapabilityGapStatus[];
  maxRecords: number;
  includeResolved: false;
  prioritizeSeverity: true;
};

export type CapabilityGapReviewState =
  | "needs_review"
  | "candidate"
  | "approved_for_planning"
  | "blocked"
  | "dismissed";

export type CapabilityGapTraceEvent = {
  type:
    | "capability_gap_created"
    | "capability_gap_updated"
    | "capability_gap_reused"
    | "capability_gap_selected"
    | "capability_gap_skipped";
  timestamp: string;
  gapKey: string;
  detail: string;
  metadata: Record<string, unknown> | null;
};

export type CapabilityGapContextDebtLink = {
  gapKey: string;
  debtKey: string;
  linkType: "needed_to_resolve" | "created_from" | "supports_future_resolution";
  detail: string;
};

export type CapabilityGapAsyncWorkLink = {
  gapKey: string;
  asyncAgentWorkItemId: string;
  linkType: "created_from" | "updated_from" | "blocked_work";
  detail: string;
};

export type CapabilityGapBenchmarkFixtureLink = {
  gapKey: string;
  benchmarkFixtureId: string;
  linkType: "required" | "recommended";
  detail: string;
};

export type DeferredCapabilityNeed = {
  capability: string;
  kind: CapabilityGapKind;
  reason: string;
  sourceId: string | null;
  requiresApproval: boolean;
  asyncRecommended: boolean;
  benchmarkFixtureIds: string[];
};

export type MissingContextLaneNeed = DeferredCapabilityNeed & {
  kind: "missing_context_lane" | "missing_context_transport";
  missingPayloadType: string;
  candidateContextLanes: string[];
};

export type MissingToolNeed = DeferredCapabilityNeed & {
  kind: "missing_tool";
  missingToolId: string;
  candidateToolCategories: ToolRuntimeClass[];
};

export type MissingModelCapabilityNeed = DeferredCapabilityNeed & {
  kind: "missing_model_capability";
  missingModelCapability: string;
  candidateModelCapabilities: string[];
};

export type MissingArtifactTypeNeed = DeferredCapabilityNeed & {
  kind: "missing_artifact_type";
  missingArtifactType: string;
  requiredArtifactTypes: string[];
};

export type MissingConnectorNeed = DeferredCapabilityNeed & {
  kind: "missing_connector";
  missingConnector: string;
};

export type MissingApprovalPathNeed = DeferredCapabilityNeed & {
  kind: "missing_approval_path";
  missingApprovalPath: string;
};

export type MissingBudgetProfileNeed = DeferredCapabilityNeed & {
  kind: "missing_budget_profile";
  missingBudgetProfile: string;
};

export type MissingValidationNeed = DeferredCapabilityNeed & {
  kind: "missing_validation_capability";
  missingArtifactType?: string | null;
};

export type MissingCreationCapabilityNeed = DeferredCapabilityNeed & {
  kind: "missing_creation_capability";
  missingArtifactType?: string | null;
};

export type CapabilityNeed =
  | MissingContextLaneNeed
  | MissingToolNeed
  | MissingModelCapabilityNeed
  | MissingArtifactTypeNeed
  | MissingConnectorNeed
  | MissingApprovalPathNeed
  | MissingBudgetProfileNeed
  | MissingValidationNeed
  | MissingCreationCapabilityNeed
  | DeferredCapabilityNeed;

export type CapabilityGapRecord = {
  id: string;
  gapKey: string;
  workspaceId: string | null;
  conversationId: string | null;
  conversationDocumentId: string | null;
  asyncAgentWorkItemId: string | null;
  relatedContextDebtId: string | null;
  relatedContextDebtKey: string | null;
  sourceId: string | null;
  kind: CapabilityGapKind;
  status: CapabilityGapStatus;
  severity: CapabilityGapSeverity;
  reviewState: CapabilityGapReviewState;
  neededCapability: string;
  missingPayloadType: string | null;
  missingToolId: string | null;
  missingModelCapability: string | null;
  missingArtifactType: string | null;
  missingConnector: string | null;
  missingApprovalPath: string | null;
  missingBudgetProfile: string | null;
  title: string;
  description: string;
  whyNeeded: string | null;
  currentLimitation: string | null;
  recommendedResolution: string | null;
  resolutionPath: CapabilityGapResolutionPath;
  resolutionPaths: CapabilityGapResolutionPath[];
  candidateToolCategories: ToolRuntimeClass[];
  candidateModelCapabilities: string[];
  candidateContextLanes: string[];
  requiredArtifactTypes: string[];
  requiredApprovalPolicy: Record<string, unknown>;
  requiredBudgetProfile: Record<string, unknown>;
  securityConsiderations: string[];
  dataEgressConsiderations: string[];
  benchmarkFixtureIds: string[];
  evidence: Record<string, unknown>;
  traceEvents: CapabilityGapTraceEvent[];
  firstSeenAt: string;
  lastSeenAt: string;
  resolvedAt: string | null;
  createdAt: string;
  updatedAt: string;
};

export type SourceCoverageStatus =
  | "unknown"
  | "uninspected"
  | "partially_inspected"
  | "inspected_with_limitations"
  | "inspected"
  | "verified"
  | "stale"
  | "blocked";

export type SourceCoverageScope =
  | "document"
  | "page"
  | "page_range"
  | "table"
  | "figure"
  | "chart"
  | "sheet"
  | "slide"
  | "attachment"
  | "source_section"
  | "source_collection"
  | "conversation_document";

export type SourceCoverageTarget = {
  target: AgentControlSourceCoverageTarget | string | null;
  detail: string;
  requestedBy:
    | "agent_control"
    | "agent_work_plan"
    | "progressive_assembly"
    | "adaptive_transport"
    | "async_work"
    | "truthful_guard";
};

export type SourceCoverageRecord = {
  id: string;
  coverageKey: string;
  workspaceId: string | null;
  conversationId: string | null;
  conversationDocumentId: string | null;
  asyncAgentWorkItemId: string | null;
  sourceId: string;
  sourceScope: SourceCoverageScope;
  sourceLocator: Record<string, unknown>;
  coverageStatus: SourceCoverageStatus;
  coverageTarget: SourceCoverageTarget;
  inspectedBy: string[];
  limitations: string[];
  relatedDebtIds: string[];
  selectedCandidateCount: number;
  totalCandidateCount: number;
  evidence: Record<string, unknown>;
  traceEvents: Array<Record<string, unknown>>;
  createdAt: string;
  updatedAt: string;
};

export type ContextDebtDebugSnapshot = {
  records: ContextDebtRecord[];
  selectedRecords: ContextDebtRecord[];
  reuseDecisions: ContextDebtReuseDecision[];
  traceEvents: ContextDebtTraceEvent[];
};

export type CapabilityGapDebugSnapshot = {
  records: CapabilityGapRecord[];
  selectedRecords: CapabilityGapRecord[];
  traceEvents: CapabilityGapTraceEvent[];
};

export type SourceCoverageDebugSnapshot = {
  records: SourceCoverageRecord[];
  traceEvents: Array<Record<string, unknown>>;
};

export type DurableEmissionDebugSummary = {
  candidateCount: number;
  contextDebtCandidateCount: number;
  capabilityGapCandidateCount: number;
  sourceCoverageCandidateCount: number;
  createdOrPersistedCount: number;
  updatedOrMergedCount: number;
  dedupedOrAlreadyExistingCount: number;
  skippedCount: number;
  alreadyResolvedCount: number;
  insufficientEvidenceCount: number;
  topMissingCapabilities: string[];
  topMissingPayloadLanes: string[];
  sourceCoverageGaps: Array<{
    sourceId: string;
    conversationDocumentId: string | null;
    coverageStatus: SourceCoverageStatus;
    target: string | null;
  }>;
  asyncCandidates: Array<{
    state: string;
    asyncAgentWorkItemId: string | null;
    reason: string;
  }>;
  recordsLinkedToDocumentCount: number;
  recordsLinkedToSourceCount: number;
  conversationLevelRecordCount: number;
  ambiguousAttributionCount: number;
  skippedReasons: string[];
  sourceBatchSummaries: Array<{
    source: string;
    contextDebtCandidates: number;
    capabilityGapCandidates: number;
    sourceCoverageCandidates: number;
  }>;
  noUnavailableToolExecutionClaimed: true;
};

export type DurableEmissionSourceBatch = {
  source: string;
  batch: ContextRegistryUpsertBatch;
};

export type DurableEmissionSkippedCandidate = {
  source: string;
  reason:
    | "insufficient_evidence"
    | "already_resolved"
    | "executed_evidence_present"
    | "not_actionable"
    | "empty_candidate";
  detail: string;
};

export type ContextRegistryDebugSnapshot = {
  contextDebt: ContextDebtDebugSnapshot;
  capabilityGaps: CapabilityGapDebugSnapshot;
  sourceCoverage: SourceCoverageDebugSnapshot;
  durableEmission?: DurableEmissionDebugSummary | null;
  noUnavailableToolExecutionClaimed: true;
};

export type ContextRegistrySelection = {
  contextDebtRecords: ContextDebtRecord[];
  capabilityGapRecords: CapabilityGapRecord[];
  sourceCoverageRecords: SourceCoverageRecord[];
  traceEvents: Array<ContextDebtTraceEvent | CapabilityGapTraceEvent | Record<string, unknown>>;
};

export const EMPTY_CONTEXT_REGISTRY_SELECTION = {
  contextDebtRecords: [],
  capabilityGapRecords: [],
  sourceCoverageRecords: [],
  traceEvents: [],
} satisfies ContextRegistrySelection;

export type ContextDebtUpsertInput = Omit<
  ContextDebtRecord,
  "id" | "firstSeenAt" | "lastSeenAt" | "createdAt" | "updatedAt" | "resolvedAt" | "traceEvents"
> & {
  id?: string;
  firstSeenAt?: string;
  lastSeenAt?: string;
  resolvedAt?: string | null;
  traceEvents?: ContextDebtTraceEvent[];
};

export type CapabilityGapUpsertInput = Omit<
  CapabilityGapRecord,
  "id" | "relatedContextDebtId" | "firstSeenAt" | "lastSeenAt" | "createdAt" | "updatedAt" | "resolvedAt" | "traceEvents"
> & {
  id?: string;
  relatedContextDebtId?: string | null;
  firstSeenAt?: string;
  lastSeenAt?: string;
  resolvedAt?: string | null;
  traceEvents?: CapabilityGapTraceEvent[];
};

export type SourceCoverageUpsertInput = Omit<
  SourceCoverageRecord,
  "id" | "createdAt" | "updatedAt" | "traceEvents"
> & {
  id?: string;
  traceEvents?: Array<Record<string, unknown>>;
};

export type ContextRegistryUpsertBatch = {
  contextDebtRecords: ContextDebtUpsertInput[];
  capabilityGapRecords: CapabilityGapUpsertInput[];
  sourceCoverageRecords: SourceCoverageUpsertInput[];
};

type RegistryPrismaRecord = Record<string, unknown> & {
  id: string;
  createdAt: Date;
  updatedAt: Date;
};

type ContextRegistryPrismaClient = {
  contextDebtRecord: {
    upsert: (params: {
      where: { debtKey: string };
      create: Record<string, unknown>;
      update: Record<string, unknown>;
    }) => Promise<RegistryPrismaRecord>;
    findMany: (params: Record<string, unknown>) => Promise<RegistryPrismaRecord[]>;
  };
  capabilityGapRecord: {
    upsert: (params: {
      where: { gapKey: string };
      create: Record<string, unknown>;
      update: Record<string, unknown>;
    }) => Promise<RegistryPrismaRecord>;
    findMany: (params: Record<string, unknown>) => Promise<RegistryPrismaRecord[]>;
  };
  sourceCoverageRecord: {
    upsert: (params: {
      where: { coverageKey: string };
      create: Record<string, unknown>;
      update: Record<string, unknown>;
    }) => Promise<RegistryPrismaRecord>;
    findMany: (params: Record<string, unknown>) => Promise<RegistryPrismaRecord[]>;
  };
};

export const CONTEXT_DEBT_UPSERT_POLICY = {
  mode: "stable_key_merge",
  dedupeFields: ["conversationId", "conversationDocumentId", "sourceId", "sourceLocator", "kind"],
  preserveOpenStatus: true,
  detail: "A-04g dedupes durable debt by source locator and kind, then refreshes evidence instead of creating parallel records.",
} satisfies ContextDebtUpsertPolicy;

export const CAPABILITY_GAP_UPSERT_POLICY = {
  mode: "stable_key_merge",
  dedupeFields: ["conversationId", "conversationDocumentId", "sourceId", "relatedContextDebtKey", "neededCapability", "kind"],
  preserveNonResolvedStatus: true,
  detail: "A-04g dedupes capability gaps by missing capability and source/debt scope; governance enables capabilities later.",
} satisfies CapabilityGapUpsertPolicy;

export const DEFAULT_CONTEXT_DEBT_SELECTION_POLICY = {
  statuses: ["open", "planned", "in_progress", "waiting_for_approval", "blocked_by_policy"],
  maxRecords: 12,
  includeResolved: false,
  prioritizeSeverity: true,
} satisfies ContextDebtSelectionPolicy;

export const DEFAULT_CAPABILITY_GAP_SELECTION_POLICY = {
  statuses: [
    "detected",
    "proposed",
    "review_needed",
    "approved",
    "planned",
    "blocked",
  ],
  maxRecords: 12,
  includeResolved: false,
  prioritizeSeverity: true,
} satisfies CapabilityGapSelectionPolicy;

const CONTEXT_DEBT_RESOLVED_STATUSES = new Set<ContextDebtStatus>([
  "resolved",
  "resolved_with_limitations",
  "superseded",
  "dismissed",
]);

const CAPABILITY_GAP_RESOLVED_STATUSES = new Set<CapabilityGapStatus>([
  "implemented",
  "configured",
  "execution_enabled",
  "validated",
  "resolved",
  "superseded",
  "dismissed",
]);

const EXTERNAL_TABLE_RECOVERY_CAPABILITIES = [
  "rendered_page_inspection",
  "ocr",
  "vision_page_understanding",
  "document_ai_table_recovery",
] as const satisfies InspectionCapability[];

const KNOWN_INSPECTION_CAPABILITIES = new Set<string>([
  "text_extraction",
  "pdf_page_classification",
  "pdf_table_detection",
  "pdf_table_body_recovery",
  "rendered_page_inspection",
  "ocr",
  "vision_page_understanding",
  "document_ai_table_recovery",
  "geometry_layout_extraction",
  "spreadsheet_inventory",
  "spreadsheet_formula_map",
  "docx_structure_extraction",
  "pptx_slide_inventory",
  "web_snapshot",
  "source_connector_read",
  "code_repository_inspection",
  "artifact_summarization",
  "artifact_validation",
]);

function nowIso(now: () => Date = () => new Date()) {
  return now().toISOString();
}

function json(value: unknown) {
  return JSON.stringify(value ?? null);
}

function parseJson<T>(value: unknown, fallback: T): T {
  if (typeof value !== "string" || !value.trim()) {
    return fallback;
  }

  try {
    return JSON.parse(value) as T;
  } catch {
    return fallback;
  }
}

function asDateIso(value: unknown) {
  return value instanceof Date ? value.toISOString() : typeof value === "string" ? value : nowIso();
}

function unique<T>(values: T[]) {
  return Array.from(new Set(values.filter((value) => value != null)));
}

function uniqueStrings(values: Array<string | null | undefined>) {
  return unique(values.map((value) => value?.trim()).filter((value): value is string => Boolean(value)));
}

function uniqueInspectionCapabilities(values: Array<string | null | undefined>): InspectionCapability[] {
  return uniqueStrings(values).filter((value): value is InspectionCapability =>
    KNOWN_INSPECTION_CAPABILITIES.has(value)
  );
}

function normalizeKeySegment(value: string | null | undefined) {
  return (value ?? "none")
    .trim()
    .replace(/[^a-zA-Z0-9:_-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 96) || "none";
}

function severityRank(value: ContextDebtSeverity) {
  return { critical: 4, high: 3, medium: 2, low: 1 }[value] ?? 0;
}

function candidateArtifactKey(candidate: ContextPackingCandidate | null | undefined) {
  const metadataArtifactKey =
    typeof candidate?.metadata?.artifactKey === "string" ? candidate.metadata.artifactKey : null;
  const provenanceArtifactKey =
    typeof candidate?.provenance?.artifactKey === "string" ? candidate.provenance.artifactKey : null;
  return metadataArtifactKey ?? provenanceArtifactKey ?? null;
}

function pageNumberFromText(value: string | null | undefined) {
  const match = value?.match(/\bpage\s*([0-9]+)\b/i) ?? value?.match(/(?:^|:)([0-9]{1,4})(?::|$)/);
  return match?.[1] ? Number(match[1]) : null;
}

function sourceLocatorFromGap(gap: ContextGap, candidate: ContextPackingCandidate | null) {
  const artifactKey = candidateArtifactKey(candidate);
  const pageNumber =
    typeof candidate?.provenance?.pageNumberStart === "number"
      ? candidate.provenance.pageNumberStart
      : typeof candidate?.metadata?.pageNumberStart === "number"
        ? candidate.metadata.pageNumberStart
        : pageNumberFromText(artifactKey) ??
          pageNumberFromText(candidate?.locationLabel) ??
          pageNumberFromText(candidate?.id) ??
          pageNumberFromText(gap.candidateId);
  const tableId =
    typeof candidate?.provenance?.tableId === "string"
      ? candidate.provenance.tableId
      : typeof candidate?.metadata?.tableId === "string"
        ? candidate.metadata.tableId
        : null;
  const figureId =
    typeof candidate?.provenance?.figureId === "string"
      ? candidate.provenance.figureId
      : typeof candidate?.metadata?.figureId === "string"
        ? candidate.metadata.figureId
        : null;

  return {
    sourceId: gap.sourceId ?? candidate?.sourceId ?? null,
    candidateId: gap.candidateId ?? candidate?.id ?? null,
    artifactKey,
    pageNumber,
    tableId,
    figureId,
    locationLabel: candidate?.locationLabel ?? null,
  };
}

function locatorKey(locator: Record<string, unknown>) {
  if (typeof locator.pageNumber === "number") {
    return `page-${locator.pageNumber}`;
  }
  if (typeof locator.tableId === "string" && locator.tableId.trim()) {
    return `table-${locator.tableId.trim()}`;
  }
  if (typeof locator.figureId === "string" && locator.figureId.trim()) {
    return `figure-${locator.figureId.trim()}`;
  }
  if (typeof locator.locationLabel === "string" && locator.locationLabel.trim()) {
    return normalizeKeySegment(locator.locationLabel);
  }
  if (typeof locator.candidateId === "string" && locator.candidateId.trim()) {
    return normalizeKeySegment(locator.candidateId);
  }
  return "general";
}

function mapGapKindToDebtKind(gap: ContextGap): ContextDebtKind {
  switch (gap.kind) {
    case "missing_table_body":
      return "missing_table_body";
    case "weak_artifact":
    case "artifact_confidence_too_low":
    case "raw_parser_output_insufficient":
      return "weak_table_candidate";
    case "stale_artifact":
      return "stale_artifact";
    case "excluded_candidate_budget":
    case "context_budget_exhausted":
      return "excluded_context_candidate";
    case "insufficient_source_coverage":
      return "incomplete_source_coverage";
    case "approval_required":
      return "approval_required";
    case "async_recommended":
      return "async_required";
    case "blocked_by_policy":
      return "blocked_by_policy";
    case "output_budget_insufficient":
      return "output_budget_gap";
    case "external_escalation_needed":
    case "tool_budget_exhausted":
      return "deferred_capability_needed";
    case "unresolved_source_section":
      return "source_freshness_unknown";
    default:
      return "validation_gap";
  }
}

function mapGapSeverity(gap: ContextGap): ContextDebtSeverity {
  if (gap.severity === "blocking") return "critical";
  if (gap.kind === "missing_table_body" || gap.kind === "insufficient_source_coverage") return "high";
  if (gap.kind === "output_budget_insufficient" || gap.kind === "approval_required") return "high";
  if (gap.severity === "warning") return "medium";
  return "low";
}

function statusFromGap(gap: ContextGap): ContextDebtStatus {
  if (gap.kind === "blocked_by_policy") return "blocked_by_policy";
  if (gap.requiresApproval || gap.kind === "approval_required") return "waiting_for_approval";
  if (gap.asyncRecommended || gap.kind === "async_recommended") return "planned";
  return "open";
}

function sourceScopeFromLocator(locator: Record<string, unknown>, kind: ContextDebtKind): ContextDebtSourceScope {
  if (kind === "incomplete_source_coverage") return "conversation_document";
  if (kind === "incomplete_table_coverage" || typeof locator.tableId === "string") return "table";
  if (kind === "unresolved_figure" || typeof locator.figureId === "string") return "figure";
  if (typeof locator.pageNumber === "number") return "page";
  return "conversation_document";
}

function resolutionPathsFromGap(gap: ContextGap): ContextDebtResolutionPath[] {
  const paths: ContextDebtResolutionPath[] = [];
  if (gap.kind === "blocked_by_policy") paths.push("blocked_by_policy");
  if (gap.requiresApproval) paths.push("request_approval");
  if (gap.asyncRecommended) paths.push("create_async_work_item");
  if (gap.recommendedCapabilities.includes("rendered_page_inspection")) paths.push("rendered_page_inspection_needed");
  if (gap.recommendedCapabilities.includes("ocr")) paths.push("ocr_needed");
  if (gap.recommendedCapabilities.includes("vision_page_understanding")) paths.push("vision_needed");
  if (gap.recommendedCapabilities.includes("document_ai_table_recovery")) paths.push("document_ai_needed");
  if (gap.recommendedCapabilities.length > 0 && paths.length === 0) paths.push("external_tool_needed");
  if (paths.length === 0 && gap.kind === "excluded_candidate_budget") paths.push("expand_context");
  if (paths.length === 0) paths.push("manual_review_needed");
  return unique(paths);
}

function benchmarkFixturesForCapability(capability: string) {
  if (
    capability === "rendered_page_inspection" ||
    capability === "ocr" ||
    capability === "vision_page_understanding" ||
    capability === "document_ai_table_recovery" ||
    capability === "rendered_page_image"
  ) {
    return ["t5_pdf_page_15_visible_table"];
  }
  if (capability === "artifact_validation") {
    return ["t5_pdf_page_15_visible_table"];
  }
  return [];
}

function traceDebt(type: ContextDebtTraceEvent["type"], debtKey: string, detail: string): ContextDebtTraceEvent {
  return {
    type,
    timestamp: nowIso(),
    debtKey,
    detail,
    metadata: null,
  };
}

function traceGap(type: CapabilityGapTraceEvent["type"], gapKey: string, detail: string): CapabilityGapTraceEvent {
  return {
    type,
    timestamp: nowIso(),
    gapKey,
    detail,
    metadata: null,
  };
}

function buildDebtKey(params: {
  conversationId: string | null;
  conversationDocumentId: string | null;
  sourceId: string | null;
  kind: ContextDebtKind;
  locator: Record<string, unknown>;
}) {
  return [
    "context-debt",
    normalizeKeySegment(params.conversationId),
    normalizeKeySegment(params.conversationDocumentId),
    normalizeKeySegment(params.sourceId ?? "workspace"),
    params.kind,
    locatorKey(params.locator),
  ].join(":");
}

function buildCapabilityGapKey(params: {
  conversationId: string | null;
  conversationDocumentId: string | null;
  sourceId: string | null;
  relatedContextDebtKey: string | null;
  kind: CapabilityGapKind;
  neededCapability: string;
}) {
  return [
    "capability-gap",
    normalizeKeySegment(params.conversationId),
    normalizeKeySegment(params.conversationDocumentId),
    normalizeKeySegment(params.sourceId ?? "workspace"),
    normalizeKeySegment(params.relatedContextDebtKey ?? "control"),
    params.kind,
    normalizeKeySegment(params.neededCapability),
  ].join(":");
}

function buildCoverageKey(params: {
  conversationId: string | null;
  conversationDocumentId: string | null;
  sourceId: string;
  target: string;
  locator: Record<string, unknown>;
}) {
  return [
    "source-coverage",
    normalizeKeySegment(params.conversationId),
    normalizeKeySegment(params.conversationDocumentId),
    normalizeKeySegment(params.sourceId),
    normalizeKeySegment(params.target),
    locatorKey(params.locator),
  ].join(":");
}

function buildContextDebtFromGap(params: {
  conversationId?: string | null;
  conversationDocumentId?: string | null;
  asyncAgentWorkItemId?: string | null;
  agentControl?: AgentControlDecision | null;
  assembly?: ProgressiveContextAssemblyResult | null;
  gap: ContextGap;
  candidate?: ContextPackingCandidate | null;
}): ContextDebtUpsertInput {
  const kind = mapGapKindToDebtKind(params.gap);
  const locator = sourceLocatorFromGap(params.gap, params.candidate ?? null);
  const sourceId = params.gap.sourceId ?? (typeof locator.sourceId === "string" ? locator.sourceId : null);
  const debtKey = buildDebtKey({
    conversationId: params.conversationId ?? null,
    conversationDocumentId: params.conversationDocumentId ?? null,
    sourceId,
    kind,
    locator,
  });
  const resolutionPaths = resolutionPathsFromGap(params.gap);
  const linkedArtifactKeys = uniqueStrings([candidateArtifactKey(params.candidate), typeof locator.artifactKey === "string" ? locator.artifactKey : null]);
  const deferredCapabilities = unique([
    ...(params.gap.requiredCapability ? [params.gap.requiredCapability] : []),
    ...params.gap.recommendedCapabilities,
  ]);

  return {
    debtKey,
    workspaceId: null,
    conversationId: params.conversationId ?? null,
    conversationDocumentId: params.conversationDocumentId ?? null,
    asyncAgentWorkItemId: params.asyncAgentWorkItemId ?? null,
    artifactKey: linkedArtifactKeys[0] ?? null,
    sourceId,
    kind,
    status: statusFromGap(params.gap),
    severity: mapGapSeverity(params.gap),
    sourceScope: sourceScopeFromLocator(locator, kind),
    sourceLocator: locator,
    title: params.gap.summary,
    description: params.gap.detail,
    whyItMatters:
      kind === "missing_table_body"
        ? "The current source memory knows a table likely exists, but it does not contain the table body needed for table-cell answers."
        : "Future answers should know this context path is incomplete instead of rediscovering the same limitation.",
    resolutionPath: resolutionPaths[0],
    resolutionPaths,
    deferredCapabilities,
    requiredApprovalReasons: params.agentControl?.approvalRequiredReasons ?? [],
    policyBlockers: params.agentControl?.blockedByPolicyReasons ?? [],
    sourceCoverageTarget: {
      target: params.agentControl?.sourceCoverageTarget ?? params.assembly?.plan.sourceCoverageTarget ?? null,
      gapKind: params.gap.kind,
    },
    evidence: {
      gap: params.gap,
      candidate: params.candidate ?? null,
      noUnavailableToolExecutionClaimed: true,
    },
    linkedArtifactKeys,
    traceEvents: [
      traceDebt("context_debt_created", debtKey, "Context debt candidate materialized from Progressive Context Assembly or async snapshot."),
    ],
  };
}

function capabilityNeedsFromCapability(params: {
  capability: string;
  reason: string;
  sourceId: string | null;
  requiresApproval: boolean;
  asyncRecommended: boolean;
}): CapabilityNeed[] {
  const shared = {
    capability: params.capability,
    reason: params.reason,
    sourceId: params.sourceId,
    requiresApproval: params.requiresApproval,
    asyncRecommended: params.asyncRecommended,
    benchmarkFixtureIds: benchmarkFixturesForCapability(params.capability),
  };

  if (params.capability === "rendered_page_inspection") {
    return [
      {
        ...shared,
        capability: "rendered_page_image",
        kind: "missing_context_lane",
        missingPayloadType: "rendered_page_image",
        candidateContextLanes: ["rendered_page_image", "table_crop_image"],
      } satisfies MissingContextLaneNeed,
    ];
  }

  if (params.capability === "ocr" || params.capability === "document_ai_table_recovery") {
    return [
      {
        ...shared,
        kind: "missing_tool",
        missingToolId: params.capability,
        candidateToolCategories: ["external_api", "model_provider"],
      } satisfies MissingToolNeed,
    ];
  }

  if (params.capability === "vision_page_understanding") {
    return [
      {
        ...shared,
        kind: "missing_model_capability",
        missingModelCapability: "native_image_input",
        candidateModelCapabilities: ["vision_page_understanding", "native_image_input"],
      } satisfies MissingModelCapabilityNeed,
    ];
  }

  if (params.capability === "source_connector_read") {
    return [
      {
        ...shared,
        kind: "missing_connector",
        missingConnector: "source_connector_read",
      } satisfies MissingConnectorNeed,
    ];
  }

  if (params.capability === "web_snapshot") {
    return [
      {
        ...shared,
        kind: "missing_tool",
        missingToolId: "web_snapshot",
        candidateToolCategories: ["browser_automation", "connector"],
      } satisfies MissingToolNeed,
    ];
  }

  if (params.capability === "code_repository_inspection") {
    return [
      {
        ...shared,
        kind: "missing_tool",
        missingToolId: "code_repository_inspection",
        candidateToolCategories: ["code_sandbox", "connector", "local_sandboxed"],
      } satisfies MissingToolNeed,
    ];
  }

  return [
    {
      ...shared,
      kind: "missing_tool",
      missingToolId: params.capability,
      candidateToolCategories: ["external_api", "model_provider", "connector"],
    } satisfies MissingToolNeed,
  ];
}

function resolutionPathsForNeed(need: CapabilityNeed): CapabilityGapResolutionPath[] {
  switch (need.kind) {
    case "missing_context_lane":
    case "missing_context_transport":
      return ["register_context_lane", "add_payload_manifest", "add_capability_pack"];
    case "missing_tool":
      return ["register_tool", "configure_external_service", "add_capability_pack"];
    case "missing_model_capability":
      return ["add_model_manifest", "register_model_capability", "add_capability_pack"];
    case "missing_artifact_type":
      return ["add_artifact_type", "add_benchmark_fixture"];
    case "missing_connector":
      return ["add_connector", "configure_external_service"];
    case "missing_approval_path":
      return ["add_approval_policy", "manual_review_needed"];
    case "missing_budget_profile":
      return ["add_budget_profile", "manual_review_needed"];
    case "missing_runtime_mode":
      return ["add_budget_profile", "manual_review_needed"];
    case "missing_validation_capability":
      return ["add_validation_tool", "add_benchmark_fixture"];
    case "missing_creation_capability":
      return ["add_creation_pipeline", "add_artifact_type"];
    default:
      return ["manual_review_needed"];
  }
}

function buildCapabilityGapFromNeed(params: {
  conversationId?: string | null;
  conversationDocumentId?: string | null;
  asyncAgentWorkItemId?: string | null;
  relatedContextDebtKey?: string | null;
  relatedContextDebtId?: string | null;
  sourceId?: string | null;
  severity?: CapabilityGapSeverity;
  status?: CapabilityGapStatus;
  need: CapabilityNeed;
  evidence?: Record<string, unknown> | null;
}): CapabilityGapUpsertInput {
  const resolutionPaths = resolutionPathsForNeed(params.need);
  const gapKey = buildCapabilityGapKey({
    conversationId: params.conversationId ?? null,
    conversationDocumentId: params.conversationDocumentId ?? null,
    sourceId: params.sourceId ?? params.need.sourceId ?? null,
    relatedContextDebtKey: params.relatedContextDebtKey ?? null,
    kind: params.need.kind,
    neededCapability: params.need.capability,
  });
  const candidateToolCategories =
    "candidateToolCategories" in params.need ? params.need.candidateToolCategories : [];
  const candidateModelCapabilities =
    "candidateModelCapabilities" in params.need ? params.need.candidateModelCapabilities : [];
  const candidateContextLanes =
    "candidateContextLanes" in params.need ? params.need.candidateContextLanes : [];
  const requiredArtifactTypes =
    "requiredArtifactTypes" in params.need ? params.need.requiredArtifactTypes : [];

  return {
    gapKey,
    workspaceId: null,
    conversationId: params.conversationId ?? null,
    conversationDocumentId: params.conversationDocumentId ?? null,
    asyncAgentWorkItemId: params.asyncAgentWorkItemId ?? null,
    relatedContextDebtId: params.relatedContextDebtId ?? null,
    relatedContextDebtKey: params.relatedContextDebtKey ?? null,
    sourceId: params.sourceId ?? params.need.sourceId ?? null,
    kind: params.need.kind,
    status: params.status ?? (params.need.requiresApproval ? "review_needed" : "detected"),
    severity: params.severity ?? "high",
    reviewState: "needs_review",
    neededCapability: params.need.capability,
    missingPayloadType: "missingPayloadType" in params.need ? params.need.missingPayloadType ?? null : null,
    missingToolId: "missingToolId" in params.need ? params.need.missingToolId ?? null : null,
    missingModelCapability:
      "missingModelCapability" in params.need ? params.need.missingModelCapability ?? null : null,
    missingArtifactType: "missingArtifactType" in params.need ? params.need.missingArtifactType ?? null : null,
    missingConnector: "missingConnector" in params.need ? params.need.missingConnector ?? null : null,
    missingApprovalPath: "missingApprovalPath" in params.need ? params.need.missingApprovalPath ?? null : null,
    missingBudgetProfile: "missingBudgetProfile" in params.need ? params.need.missingBudgetProfile ?? null : null,
    title: `Capability gap: ${params.need.capability}`,
    description: params.need.reason,
    whyNeeded: params.need.reason,
    currentLimitation: "No approved executable path is currently available for this capability in A-04g.",
    recommendedResolution: resolutionPaths.join(", "),
    resolutionPath: resolutionPaths[0],
    resolutionPaths,
    candidateToolCategories,
    candidateModelCapabilities,
    candidateContextLanes,
    requiredArtifactTypes,
    requiredApprovalPolicy: params.need.requiresApproval
      ? { approvalRequired: true, reason: params.need.reason }
      : {},
    requiredBudgetProfile: {},
    securityConsiderations: params.need.requiresApproval
      ? ["Capability may require approval, external execution, or data egress review."]
      : [],
    dataEgressConsiderations:
      candidateToolCategories.includes("external_api") || candidateToolCategories.includes("model_provider")
        ? ["External execution would require tenant, credential, retention, and approval policy before enablement."]
        : [],
    benchmarkFixtureIds: params.need.benchmarkFixtureIds,
    evidence: {
      ...(params.evidence ?? {}),
      executed: false,
      executionClaimed: false,
      futureToolingRecommended: true,
    },
    traceEvents: [
      traceGap("capability_gap_created", gapKey, "Capability gap candidate materialized from deferred or unavailable capability evidence."),
    ],
  };
}

function mergeDebtInputs(inputs: ContextDebtUpsertInput[]) {
  const byKey = new Map<string, ContextDebtUpsertInput>();
  for (const input of inputs) {
    const existing = byKey.get(input.debtKey);
    if (!existing) {
      byKey.set(input.debtKey, input);
      continue;
    }
    byKey.set(input.debtKey, {
      ...existing,
      conversationId: existing.conversationId ?? input.conversationId,
      conversationDocumentId: existing.conversationDocumentId ?? input.conversationDocumentId,
      asyncAgentWorkItemId: existing.asyncAgentWorkItemId ?? input.asyncAgentWorkItemId,
      artifactKey: existing.artifactKey ?? input.artifactKey,
      sourceId: existing.sourceId ?? input.sourceId,
      severity: severityRank(input.severity) > severityRank(existing.severity) ? input.severity : existing.severity,
      status: existing.status === "open" ? input.status : existing.status,
      deferredCapabilities: unique([...existing.deferredCapabilities, ...input.deferredCapabilities]),
      linkedArtifactKeys: uniqueStrings([...existing.linkedArtifactKeys, ...input.linkedArtifactKeys]),
      evidence: {
        ...existing.evidence,
        mergedEvidence: [...(Array.isArray(existing.evidence.mergedEvidence) ? existing.evidence.mergedEvidence : []), input.evidence],
      },
      traceEvents: [...(existing.traceEvents ?? []), ...(input.traceEvents ?? [])],
    });
  }
  return [...byKey.values()];
}

function mergeCapabilityGapInputs(inputs: CapabilityGapUpsertInput[]) {
  const byKey = new Map<string, CapabilityGapUpsertInput>();
  for (const input of inputs) {
    const existing = byKey.get(input.gapKey);
    if (!existing) {
      byKey.set(input.gapKey, input);
      continue;
    }
    byKey.set(input.gapKey, {
      ...existing,
      conversationId: existing.conversationId ?? input.conversationId,
      conversationDocumentId: existing.conversationDocumentId ?? input.conversationDocumentId,
      asyncAgentWorkItemId: existing.asyncAgentWorkItemId ?? input.asyncAgentWorkItemId,
      relatedContextDebtId: existing.relatedContextDebtId ?? input.relatedContextDebtId,
      relatedContextDebtKey: existing.relatedContextDebtKey ?? input.relatedContextDebtKey,
      sourceId: existing.sourceId ?? input.sourceId,
      severity: severityRank(input.severity) > severityRank(existing.severity) ? input.severity : existing.severity,
      status: existing.status === "detected" ? input.status : existing.status,
      benchmarkFixtureIds: uniqueStrings([...existing.benchmarkFixtureIds, ...input.benchmarkFixtureIds]),
      candidateToolCategories: unique([...existing.candidateToolCategories, ...input.candidateToolCategories]),
      candidateModelCapabilities: uniqueStrings([
        ...existing.candidateModelCapabilities,
        ...input.candidateModelCapabilities,
      ]),
      candidateContextLanes: uniqueStrings([...existing.candidateContextLanes, ...input.candidateContextLanes]),
      traceEvents: [...(existing.traceEvents ?? []), ...(input.traceEvents ?? [])],
    });
  }
  return [...byKey.values()];
}

function mergeCoverageInputs(inputs: SourceCoverageUpsertInput[]) {
  const byKey = new Map<string, SourceCoverageUpsertInput>();
  for (const input of inputs) {
    const existing = byKey.get(input.coverageKey);
    if (!existing) {
      byKey.set(input.coverageKey, input);
      continue;
    }
    byKey.set(input.coverageKey, {
      ...existing,
      limitations: uniqueStrings([...existing.limitations, ...input.limitations]),
      relatedDebtIds: uniqueStrings([...existing.relatedDebtIds, ...input.relatedDebtIds]),
      selectedCandidateCount: Math.max(existing.selectedCandidateCount, input.selectedCandidateCount),
      totalCandidateCount: Math.max(existing.totalCandidateCount, input.totalCandidateCount),
      traceEvents: [...(existing.traceEvents ?? []), ...(input.traceEvents ?? [])],
    });
  }
  return [...byKey.values()];
}

function buildSourceCoverageFromAssembly(params: {
  conversationId?: string | null;
  conversationDocumentId?: string | null;
  asyncAgentWorkItemId?: string | null;
  assembly: ProgressiveContextAssemblyResult;
  debtInputs: ContextDebtUpsertInput[];
}): SourceCoverageUpsertInput[] {
  const records: SourceCoverageUpsertInput[] = [];
  for (const gap of params.assembly.gaps) {
    if (gap.kind !== "insufficient_source_coverage") continue;
    const sourceId = gap.sourceId ?? params.conversationDocumentId ?? params.conversationId ?? "workspace";
    const locator = {
      sourceId,
      gapId: gap.id,
      sourceCoverageTarget: params.assembly.plan.sourceCoverageTarget,
    };
    const coverageKey = buildCoverageKey({
      conversationId: params.conversationId ?? null,
      conversationDocumentId: params.conversationDocumentId ?? null,
      sourceId,
      target: params.assembly.plan.sourceCoverageTarget,
      locator,
    });

    records.push({
      coverageKey,
      workspaceId: null,
      conversationId: params.conversationId ?? null,
      conversationDocumentId: params.conversationDocumentId ?? null,
      asyncAgentWorkItemId: params.asyncAgentWorkItemId ?? null,
      sourceId,
      sourceScope: "conversation_document",
      sourceLocator: locator,
      coverageStatus: "partially_inspected",
      coverageTarget: {
        target: params.assembly.plan.sourceCoverageTarget,
        detail: gap.detail,
        requestedBy: "progressive_assembly",
      },
      inspectedBy: ["progressive_context_assembly", "context_packing_kernel"],
      limitations: [gap.summary, gap.detail],
      relatedDebtIds: params.debtInputs.map((debt) => debt.debtKey),
      selectedCandidateCount:
        typeof gap.metadata?.selectedCandidateCount === "number"
          ? gap.metadata.selectedCandidateCount
          : params.assembly.expandedContextBundle.selectedCandidates.length,
      totalCandidateCount:
        typeof gap.metadata?.totalCandidateCount === "number"
          ? gap.metadata.totalCandidateCount
          : params.assembly.expandedContextBundle.selectedCandidates.length +
            params.assembly.expandedContextBundle.excludedCandidates.length,
      evidence: {
        gap,
        noUnavailableToolExecutionClaimed: true,
      },
      traceEvents: [
        {
          type: "source_coverage_record_created",
          timestamp: nowIso(),
          coverageKey,
          detail: "Source coverage limitation materialized from Progressive Context Assembly.",
        },
      ],
    });
  }

  if (
    params.assembly.plan.sourceCoverageTarget === "full_document" ||
    params.assembly.plan.sourceCoverageTarget === "all_pages" ||
    params.assembly.plan.sourceCoverageTarget === "all_tables" ||
    params.assembly.plan.sourceCoverageTarget === "all_attachments"
  ) {
    const sourceId = params.conversationDocumentId ?? params.conversationId ?? "workspace";
    const locator = { sourceId, sourceCoverageTarget: params.assembly.plan.sourceCoverageTarget };
    const coverageKey = buildCoverageKey({
      conversationId: params.conversationId ?? null,
      conversationDocumentId: params.conversationDocumentId ?? null,
      sourceId,
      target: params.assembly.plan.sourceCoverageTarget,
      locator,
    });
    records.push({
      coverageKey,
      workspaceId: null,
      conversationId: params.conversationId ?? null,
      conversationDocumentId: params.conversationDocumentId ?? null,
      asyncAgentWorkItemId: params.asyncAgentWorkItemId ?? null,
      sourceId,
      sourceScope: "conversation_document",
      sourceLocator: locator,
      coverageStatus: params.assembly.sufficiency.readyForAnswer ? "inspected_with_limitations" : "partially_inspected",
      coverageTarget: {
        target: params.assembly.plan.sourceCoverageTarget,
        detail: "Highest-fidelity or full-coverage request recorded for future source coverage work.",
        requestedBy: "agent_control",
      },
      inspectedBy: ["progressive_context_assembly"],
      limitations: [...params.assembly.sufficiency.limitations],
      relatedDebtIds: params.debtInputs.map((debt) => debt.debtKey),
      selectedCandidateCount: params.assembly.expandedContextBundle.selectedCandidates.length,
      totalCandidateCount:
        params.assembly.expandedContextBundle.selectedCandidates.length +
        params.assembly.expandedContextBundle.excludedCandidates.length,
      evidence: {
        sourceCoverageTarget: params.assembly.plan.sourceCoverageTarget,
        sufficiency: params.assembly.sufficiency.status,
      },
      traceEvents: [
        {
          type: "source_coverage_record_created",
          timestamp: nowIso(),
          coverageKey,
          detail: "Full-fidelity source coverage target recorded for future expansion.",
        },
      ],
    });
  }

  return mergeCoverageInputs(records);
}

function buildControlCapabilityGaps(params: {
  conversationId?: string | null;
  conversationDocumentId?: string | null;
  asyncAgentWorkItemId?: string | null;
  agentControl: AgentControlDecision;
}) {
  const needs: CapabilityNeed[] = [];
  if (params.agentControl.taskFidelityLevel === "highest_fidelity_ingestion") {
    needs.push(
      {
        capability: "native_pdf_input",
        kind: "missing_context_lane",
        reason: "Highest-fidelity ingestion will eventually need native file or rendered payload lanes beyond parser text.",
        sourceId: params.conversationDocumentId ?? null,
        requiresApproval: params.agentControl.approvalRequired,
        asyncRecommended: params.agentControl.asyncRecommended,
        benchmarkFixtureIds: ["t5_pdf_page_15_visible_table"],
        missingPayloadType: "native_pdf_input",
        candidateContextLanes: ["native_pdf_input", "rendered_page_image", "structured_table"],
      } satisfies MissingContextLaneNeed,
      {
        capability: "table_validation_artifact",
        kind: "missing_artifact_type",
        reason: "Highest-fidelity ingestion needs validation artifacts to prove full table/page/source coverage.",
        sourceId: params.conversationDocumentId ?? null,
        requiresApproval: false,
        asyncRecommended: true,
        benchmarkFixtureIds: ["t5_pdf_page_15_visible_table"],
        missingArtifactType: "table_validation_artifact",
        requiredArtifactTypes: ["table_validation_artifact", "source_coverage_summary"],
      } satisfies MissingArtifactTypeNeed
    );
  }

  if (params.agentControl.taskFidelityLevel === "highest_fidelity_creation") {
    needs.push(
      {
        capability: "deliverable_creation_pipeline",
        kind: "missing_creation_capability",
        reason: "Deliverable-grade creation needs a creation/export pipeline and validation loop that A-04g only records.",
        sourceId: params.conversationDocumentId ?? null,
        requiresApproval: params.agentControl.approvalRequired,
        asyncRecommended: params.agentControl.asyncRecommended,
        benchmarkFixtureIds: [],
        missingArtifactType: "deliverable_export_artifact",
      } satisfies MissingCreationCapabilityNeed,
      {
        capability: "deliverable_validation",
        kind: "missing_validation_capability",
        reason: "Best-possible reports/decks/workbooks need claim and citation validation before completion can be claimed.",
        sourceId: params.conversationDocumentId ?? null,
        requiresApproval: params.agentControl.approvalRequired,
        asyncRecommended: true,
        benchmarkFixtureIds: [],
        missingArtifactType: "validation_report_artifact",
      } satisfies MissingValidationNeed
    );
  }

  if (params.agentControl.approvalRequired) {
    needs.push({
      capability: "approval_path",
      kind: "missing_approval_path",
      reason: `Approval is required for: ${params.agentControl.approvalRequiredReasons.join(", ")}.`,
      sourceId: params.conversationDocumentId ?? null,
      requiresApproval: true,
      asyncRecommended: params.agentControl.asyncRecommended,
      benchmarkFixtureIds: [],
      missingApprovalPath: "agent_control_approval_path",
    } satisfies MissingApprovalPathNeed);
  }

  if (
    params.agentControl.contextBudgetRequest.exceedsPolicy ||
    params.agentControl.outputBudgetRequest.exceedsPolicy ||
    params.agentControl.toolBudgetRequest.exceedsPolicy
  ) {
    needs.push({
      capability: params.agentControl.runtimeBudgetProfile,
      kind: "missing_budget_profile",
      reason: "The requested fidelity exceeded at least one active budget boundary.",
      sourceId: params.conversationDocumentId ?? null,
      requiresApproval: params.agentControl.approvalRequired,
      asyncRecommended: params.agentControl.asyncRecommended,
      benchmarkFixtureIds: [],
      missingBudgetProfile: params.agentControl.runtimeBudgetProfile,
    } satisfies MissingBudgetProfileNeed);
  }

  return needs.map((need) =>
    buildCapabilityGapFromNeed({
      conversationId: params.conversationId ?? null,
      conversationDocumentId: params.conversationDocumentId ?? null,
      asyncAgentWorkItemId: params.asyncAgentWorkItemId ?? null,
      sourceId: params.conversationDocumentId ?? null,
      severity: need.kind === "missing_approval_path" ? "high" : "medium",
      need,
      evidence: {
        agentControlDecisionId: params.agentControl.decisionId,
        taskFidelityLevel: params.agentControl.taskFidelityLevel,
        noUnavailableToolExecutionClaimed: true,
      },
    })
  );
}

export function buildRegistryUpsertsFromProgressiveAssembly(params: {
  conversationId?: string | null;
  conversationDocumentId?: string | null;
  agentControl?: AgentControlDecision | null;
  assembly: ProgressiveContextAssemblyResult;
}): ContextRegistryUpsertBatch {
  const selectedCandidateById = new Map(
    params.assembly.expandedContextBundle.selectedCandidates.map((candidate) => [candidate.id, candidate])
  );
  const debtInputs = mergeDebtInputs(
    params.assembly.gaps.map((gap) =>
      buildContextDebtFromGap({
        conversationId: params.conversationId ?? null,
        conversationDocumentId: params.conversationDocumentId ?? null,
        agentControl: params.agentControl ?? null,
        assembly: params.assembly,
        gap,
        candidate: gap.candidateId ? selectedCandidateById.get(gap.candidateId) ?? null : null,
      })
    )
  );
  const debtBySourceAndKind = new Map(
    debtInputs.map((debt) => [`${debt.sourceId ?? "none"}:${debt.kind}:${locatorKey(debt.sourceLocator)}`, debt])
  );
  const gapInputs: CapabilityGapUpsertInput[] = [];

  for (const gap of params.assembly.gaps) {
    const debtKind = mapGapKindToDebtKind(gap);
    const candidate = gap.candidateId ? selectedCandidateById.get(gap.candidateId) ?? null : null;
    const locator = sourceLocatorFromGap(gap, candidate);
    const debt = debtBySourceAndKind.get(`${gap.sourceId ?? "none"}:${debtKind}:${locatorKey(locator)}`);
    const capabilities = unique([
      ...(gap.requiredCapability ? [gap.requiredCapability] : []),
      ...gap.recommendedCapabilities,
    ]);

    for (const capability of capabilities) {
      for (const need of capabilityNeedsFromCapability({
        capability,
        reason: gap.summary,
        sourceId: gap.sourceId ?? null,
        requiresApproval: gap.requiresApproval,
        asyncRecommended: gap.asyncRecommended,
      })) {
        gapInputs.push(
          buildCapabilityGapFromNeed({
            conversationId: params.conversationId ?? null,
            conversationDocumentId: params.conversationDocumentId ?? null,
            relatedContextDebtKey: debt?.debtKey ?? null,
            sourceId: gap.sourceId ?? null,
            severity: debt?.severity ?? mapGapSeverity(gap),
            status: gap.requiresApproval ? "review_needed" : "detected",
            need,
            evidence: {
              gap,
              relatedContextDebtKey: debt?.debtKey ?? null,
              noUnavailableToolExecutionClaimed: true,
            },
          })
        );
      }
    }
  }

  if (params.agentControl) {
    gapInputs.push(
      ...buildControlCapabilityGaps({
        conversationId: params.conversationId ?? null,
        conversationDocumentId: params.conversationDocumentId ?? null,
        agentControl: params.agentControl,
      })
    );
  }

  return {
    contextDebtRecords: debtInputs,
    capabilityGapRecords: mergeCapabilityGapInputs(gapInputs),
    sourceCoverageRecords: buildSourceCoverageFromAssembly({
      conversationId: params.conversationId ?? null,
      conversationDocumentId: params.conversationDocumentId ?? null,
      assembly: params.assembly,
      debtInputs,
    }),
  };
}

function asyncWorkId(item: AsyncAgentWorkItem | AsyncAgentWorkDebugSnapshot) {
  return "workItemId" in item ? item.workItemId : item.id;
}

function asyncWorkConversationId(item: AsyncAgentWorkItem | AsyncAgentWorkDebugSnapshot) {
  return "conversationId" in item ? item.conversationId : null;
}

function asyncWorkDocumentId(item: AsyncAgentWorkItem | AsyncAgentWorkDebugSnapshot) {
  return "conversationDocumentId" in item ? item.conversationDocumentId : null;
}

function asyncWorkLimitations(item: AsyncAgentWorkItem | AsyncAgentWorkDebugSnapshot) {
  return "limitations" in item ? item.limitations : item.result?.limitations ?? item.plan.limitations ?? [];
}

function asyncWorkExecutedToolIds(item: AsyncAgentWorkItem | AsyncAgentWorkDebugSnapshot) {
  return "completionState" in item
    ? item.completionState?.executedToolIds ?? []
    : item.result?.executedToolIds ?? [];
}

function sourceCoverageStatusFromAsyncWork(item: AsyncAgentWorkItem | AsyncAgentWorkDebugSnapshot): SourceCoverageStatus {
  if (asyncWorkExecutedToolIds(item).length > 0) {
    return item.status === "completed" ? "inspected" : "inspected_with_limitations";
  }
  if (item.status === "waiting_for_approval" || item.status === "blocked_by_policy") {
    return "blocked";
  }
  return "uninspected";
}

export function buildRegistryUpsertsFromAsyncAgentWork(params: {
  conversationId?: string | null;
  conversationDocumentId?: string | null;
  item: AsyncAgentWorkItem | AsyncAgentWorkDebugSnapshot;
}): ContextRegistryUpsertBatch {
  const item = params.item;
  const workId = asyncWorkId(item);
  const conversationId = params.conversationId ?? asyncWorkConversationId(item) ?? null;
  const conversationDocumentId = params.conversationDocumentId ?? asyncWorkDocumentId(item) ?? null;
  const contextGapSnapshots = item.contextGapSnapshots ?? [];
  const debtInputs = mergeDebtInputs(
    contextGapSnapshots.map((gap) =>
      buildContextDebtFromGap({
        conversationId,
        conversationDocumentId,
        asyncAgentWorkItemId: workId,
        agentControl: item.controlSnapshot.decision,
        gap,
        candidate: null,
      })
    )
  );
  const gapInputs = mergeCapabilityGapInputs(
    (item.deferredCapabilities ?? []).flatMap((entry) => {
      const relatedDebt = debtInputs.find((debt) => entry.gapId && debt.evidence.gap && (debt.evidence.gap as ContextGap).id === entry.gapId);
      return capabilityNeedsFromCapability({
        capability: entry.capability,
        reason: entry.reason,
        sourceId: entry.sourceId,
        requiresApproval: entry.requiresApproval,
        asyncRecommended: entry.asyncRecommended,
      }).map((need) =>
        buildCapabilityGapFromNeed({
          conversationId,
          conversationDocumentId,
          asyncAgentWorkItemId: workId,
          relatedContextDebtKey: relatedDebt?.debtKey ?? null,
          sourceId: entry.sourceId,
          severity: relatedDebt?.severity ?? "high",
          need,
          evidence: {
            deferredCapability: entry,
            asyncAgentWorkItemId: workId,
            executed: false,
            executionClaimed: false,
          },
        })
      );
    })
  );
  const coverageInputs = mergeCoverageInputs(
    (item.sourceLinks ?? []).map((link) => {
      const sourceId = link.sourceId;
      const locator = { sourceId, conversationDocumentId: link.conversationDocumentId };
      const executedToolIds = asyncWorkExecutedToolIds(item);
      const coverageStatus = sourceCoverageStatusFromAsyncWork(item);
      return {
        coverageKey: buildCoverageKey({
          conversationId,
          conversationDocumentId,
          sourceId,
          target: link.coverageTarget,
          locator,
        }),
        workspaceId: null,
        conversationId,
        conversationDocumentId,
        asyncAgentWorkItemId: workId,
        sourceId,
        sourceScope: "conversation_document",
        sourceLocator: locator,
        coverageStatus,
        coverageTarget: {
          target: link.coverageTarget,
          detail:
            coverageStatus === "inspected" || coverageStatus === "inspected_with_limitations"
              ? "Async work completed with execution evidence for this source coverage target."
              : "Async work preserved this source coverage target for future registry reuse without marking it inspected.",
          requestedBy: "async_work",
        },
        inspectedBy: executedToolIds.length > 0 ? ["async_agent_work_queue_v1", ...executedToolIds] : [],
        limitations: asyncWorkLimitations(item),
        relatedDebtIds: link.debtCandidateIds ?? [],
        selectedCandidateCount: 0,
        totalCandidateCount: 0,
        evidence: {
          sourceLink: link,
          asyncAgentWorkItemId: workId,
          asyncWorkStatus: item.status,
          executedToolIds,
          inspectedCoverageUpdated: executedToolIds.length > 0,
          noUnavailableToolExecutionClaimed: true,
        },
        traceEvents: [
          {
            type: "source_coverage_record_updated",
            timestamp: nowIso(),
            detail: "Source coverage record updated from async work snapshot.",
          },
        ],
      } satisfies SourceCoverageUpsertInput;
    })
  );

  return {
    contextDebtRecords: debtInputs,
    capabilityGapRecords: gapInputs,
    sourceCoverageRecords: coverageInputs,
  };
}

export function buildRegistryUpsertsFromTruthfulExecutionSnapshot(params: {
  conversationId?: string | null;
  conversationDocumentId?: string | null;
  snapshot: TruthfulExecutionClaimSnapshot;
}): ContextRegistryUpsertBatch {
  const debtInputs = mergeDebtInputs(
    params.snapshot.contextGapKinds.map((kind) =>
      buildContextDebtFromGap({
        conversationId: params.conversationId ?? null,
        conversationDocumentId: params.conversationDocumentId ?? null,
        gap: {
          id: `truthful-guard:${kind}`,
          kind: kind as ContextGap["kind"],
          sourceId: params.conversationDocumentId ?? null,
          candidateId: null,
          severity: kind === "missing_table_body" ? "warning" : "info",
          summary: `Truthful guard observed unresolved context gap: ${kind}.`,
          detail: "Execution claim evidence prevented this gap from being represented as completed work.",
          requiredCapability: null,
          recommendedCapabilities: [],
          requiresApproval: false,
          asyncRecommended: false,
          metadata: { source: "truthful_execution_claim_guard" },
        },
        candidate: null,
      })
    )
  );

  const directCapabilityIds = uniqueStrings([
    ...params.snapshot.deferredCapabilities,
    ...params.snapshot.recommendedCapabilities,
  ]);
  const hasDurableGapEvidence =
    debtInputs.length > 0 ||
    directCapabilityIds.length > 0 ||
    params.snapshot.limitations.length > 0;
  const auditedCapabilityIds = hasDurableGapEvidence
    ? params.snapshot.unavailableCapabilities.filter((capability) =>
        [
          "rendered_page_inspection",
          "ocr",
          "vision_page_understanding",
          "document_ai_table_recovery",
        ].includes(capability)
      )
    : [];
  const capabilityIds = uniqueStrings([...directCapabilityIds, ...auditedCapabilityIds]);
  const gapInputs = mergeCapabilityGapInputs(
    capabilityIds.flatMap((capability) =>
      capabilityNeedsFromCapability({
        capability,
        reason: "Truthful Execution Claim Guard observed this capability as unavailable, deferred, or recommended but not executed.",
        sourceId: params.conversationDocumentId ?? null,
        requiresApproval: true,
        asyncRecommended: true,
      }).map((need) =>
        buildCapabilityGapFromNeed({
          conversationId: params.conversationId ?? null,
          conversationDocumentId: params.conversationDocumentId ?? null,
          sourceId: params.conversationDocumentId ?? null,
          need,
          evidence: {
            truthfulExecutionSnapshot: {
              asyncWorkCreated: params.snapshot.asyncWorkCreated,
              unavailableCapabilities: params.snapshot.unavailableCapabilities,
              deferredCapabilities: params.snapshot.deferredCapabilities,
              executedTools: params.snapshot.executedTools,
            },
            executed: false,
            executionClaimed: false,
          },
        })
      )
    )
  );

  return {
    contextDebtRecords: debtInputs,
    capabilityGapRecords: gapInputs,
    sourceCoverageRecords: [],
  };
}

function emptyRegistryBatch(): ContextRegistryUpsertBatch {
  return {
    contextDebtRecords: [],
    capabilityGapRecords: [],
    sourceCoverageRecords: [],
  };
}

function documentIdForSource(params: {
  fallbackConversationDocumentId?: string | null;
  conversationDocumentIdsBySourceId?: Record<string, string | null | undefined>;
  sourceId?: string | null;
}) {
  if (params.fallbackConversationDocumentId) return params.fallbackConversationDocumentId;
  if (!params.sourceId) return null;
  return params.conversationDocumentIdsBySourceId?.[params.sourceId] ?? null;
}

function workPlanStateToDebtStatus(state: AgentWorkPlanState): ContextDebtStatus {
  if (state === "approval_required") return "waiting_for_approval";
  if (state === "unavailable") return "blocked_by_policy";
  if (state === "deferred" || state === "planned") return "planned";
  return "open";
}

function workPlanStateToGapStatus(state: AgentWorkPlanState, requiresApproval: boolean): CapabilityGapStatus {
  if (requiresApproval || state === "approval_required") return "review_needed";
  if (state === "unavailable") return "blocked";
  if (state === "deferred") return "proposed";
  if (state === "planned") return "planned";
  return "detected";
}

function workPlanStateToSeverity(state: AgentWorkPlanState): ContextDebtSeverity {
  if (state === "approval_required" || state === "unavailable") return "high";
  if (state === "deferred") return "medium";
  return "low";
}

function coverageStatusFromWorkPlanState(state: AgentWorkPlanState): SourceCoverageStatus {
  if (state === "approval_required" || state === "unavailable") return "blocked";
  return "uninspected";
}

function buildWorkPlanSourceCoverage(params: {
  conversationId: string | null;
  conversationDocumentId: string | null;
  workPlan: AgentWorkPlan;
  sourceNeed: AgentWorkPlanSourceNeed;
}): SourceCoverageUpsertInput {
  const sourceId = params.sourceNeed.sourceId;
  const target = params.sourceNeed.coverageTarget ?? params.workPlan.sourceCoverageTarget;
  const locator = {
    sourceId,
    conversationDocumentId: params.conversationDocumentId,
    coverageTarget: target,
    planId: params.workPlan.planId,
    sourceNeedState: params.sourceNeed.state,
    locationLabel: params.sourceNeed.detail ?? params.sourceNeed.reason,
  };
  const coverageKey = buildCoverageKey({
    conversationId: params.conversationId,
    conversationDocumentId: params.conversationDocumentId,
    sourceId,
    target,
    locator,
  });

  return {
    coverageKey,
    workspaceId: null,
    conversationId: params.conversationId,
    conversationDocumentId: params.conversationDocumentId,
    asyncAgentWorkItemId: null,
    sourceId,
    sourceScope: "conversation_document",
    sourceLocator: locator,
    coverageStatus: coverageStatusFromWorkPlanState(params.sourceNeed.state),
    coverageTarget: {
      target,
      detail: params.sourceNeed.reason,
      requestedBy: "agent_work_plan",
    },
    inspectedBy: [],
    limitations: [
      params.sourceNeed.detail ?? params.sourceNeed.reason,
      "AgentWorkPlan recorded a coverage need; this does not mark the source as inspected.",
    ],
    relatedDebtIds: [],
    selectedCandidateCount: 0,
    totalCandidateCount: 0,
    evidence: {
      planId: params.workPlan.planId,
      traceId: params.workPlan.traceId,
      sourceNeed: params.sourceNeed,
      asyncState: "not_created",
      noUnavailableToolExecutionClaimed: true,
    },
    traceEvents: [
      {
        type: "source_coverage_record_created",
        timestamp: nowIso(),
        coverageKey,
        detail: "Source coverage need materialized from AgentWorkPlan without claiming inspection.",
      },
    ],
  };
}

function buildWorkPlanSourceDebt(params: {
  conversationId: string | null;
  conversationDocumentId: string | null;
  workPlan: AgentWorkPlan;
  sourceNeed: AgentWorkPlanSourceNeed;
}): ContextDebtUpsertInput {
  const gap = {
    id: `agent-work-plan:${params.workPlan.planId}:source:${params.sourceNeed.sourceId}:${params.sourceNeed.coverageTarget ?? "coverage"}`,
    kind: "insufficient_source_coverage",
    sourceId: params.sourceNeed.sourceId,
    candidateId: `agent-work-plan-source:${params.sourceNeed.sourceId}:${params.sourceNeed.coverageTarget ?? "coverage"}`,
    severity: workPlanStateToSeverity(params.sourceNeed.state) === "high" ? "warning" : "info",
    summary: `Source coverage need: ${params.sourceNeed.coverageTarget ?? params.workPlan.sourceCoverageTarget}`,
    detail: params.sourceNeed.reason,
    requiredCapability: null,
    recommendedCapabilities: [],
    requiresApproval: params.sourceNeed.state === "approval_required",
    asyncRecommended: params.sourceNeed.state === "deferred" || params.workPlan.asyncRecommendation.recommended,
    metadata: {
      planId: params.workPlan.planId,
      traceId: params.workPlan.traceId,
      sourceNeed: params.sourceNeed,
      noUnavailableToolExecutionClaimed: true,
    },
  } satisfies ContextGap;

  return {
    ...buildContextDebtFromGap({
      conversationId: params.conversationId,
      conversationDocumentId: params.conversationDocumentId,
      gap,
      candidate: null,
    }),
    status: workPlanStateToDebtStatus(params.sourceNeed.state),
    sourceCoverageTarget: {
      target: params.sourceNeed.coverageTarget ?? params.workPlan.sourceCoverageTarget,
      detail: params.sourceNeed.reason,
      requestedBy: "agent_work_plan",
    },
    evidence: {
      planId: params.workPlan.planId,
      traceId: params.workPlan.traceId,
      sourceNeed: params.sourceNeed,
      executed: false,
      executionClaimed: false,
      noUnavailableToolExecutionClaimed: true,
    },
  };
}

function buildWorkPlanCapabilityGaps(params: {
  conversationId: string | null;
  conversationDocumentId: string | null;
  asyncAgentWorkItemId?: string | null;
  workPlan: AgentWorkPlan;
  capabilityNeed: AgentWorkPlanCapabilityNeed;
}): CapabilityGapUpsertInput[] {
  if (params.capabilityNeed.state === "executed") {
    return [];
  }

  return capabilityNeedsFromCapability({
    capability: params.capabilityNeed.capability,
    reason: params.capabilityNeed.reason,
    sourceId: null,
    requiresApproval:
      params.capabilityNeed.requiresApproval || params.capabilityNeed.state === "approval_required",
    asyncRecommended:
      params.capabilityNeed.asyncRecommended || params.capabilityNeed.state === "deferred",
  }).map((need) =>
    buildCapabilityGapFromNeed({
      conversationId: params.conversationId,
      conversationDocumentId: params.conversationDocumentId,
      asyncAgentWorkItemId: params.asyncAgentWorkItemId ?? null,
      severity: workPlanStateToSeverity(params.capabilityNeed.state),
      status: workPlanStateToGapStatus(
        params.capabilityNeed.state,
        params.capabilityNeed.requiresApproval
      ),
      need,
      evidence: {
        planId: params.workPlan.planId,
        traceId: params.workPlan.traceId,
        capabilityNeed: params.capabilityNeed,
        workPlanState: params.capabilityNeed.state,
        payloadTypes: params.capabilityNeed.payloadTypes,
        executed: false,
        executionClaimed: false,
        noUnavailableToolExecutionClaimed: true,
      },
    })
  );
}

function buildWorkPlanModelGaps(params: {
  conversationId: string | null;
  conversationDocumentId: string | null;
  workPlan: AgentWorkPlan;
  modelNeed: AgentWorkPlanModelNeed;
}): CapabilityGapUpsertInput[] {
  const shouldRecord =
    params.modelNeed.state !== "executed" &&
    (params.modelNeed.requiresProviderChange ||
      params.modelNeed.unavailablePayloadTypes.length > 0 ||
      params.modelNeed.state === "approval_required" ||
      params.modelNeed.state === "unavailable" ||
      params.modelNeed.capability !== "current_model_ok");
  if (!shouldRecord) {
    return [];
  }

  const status = workPlanStateToGapStatus(params.modelNeed.state, params.modelNeed.state === "approval_required");
  const modelCapabilityGap = buildCapabilityGapFromNeed({
    conversationId: params.conversationId,
    conversationDocumentId: params.conversationDocumentId,
    severity: workPlanStateToSeverity(params.modelNeed.state),
    status,
    need: {
      capability: params.modelNeed.capability,
      kind: "missing_model_capability",
      reason: params.modelNeed.reason,
      sourceId: null,
      requiresApproval: params.modelNeed.state === "approval_required",
      asyncRecommended: params.workPlan.asyncRecommendation.recommended,
      benchmarkFixtureIds: [],
      missingModelCapability: params.modelNeed.capability,
      candidateModelCapabilities: [
        params.modelNeed.capability,
        ...params.modelNeed.acceptedPayloadTypes,
      ],
    } satisfies MissingModelCapabilityNeed,
    evidence: {
      planId: params.workPlan.planId,
      traceId: params.workPlan.traceId,
      modelNeed: params.modelNeed,
      executed: false,
      executionClaimed: false,
      noUnavailableToolExecutionClaimed: true,
    },
  });

  const laneGaps = params.modelNeed.unavailablePayloadTypes.map((payloadType) =>
    buildCapabilityGapFromNeed({
      conversationId: params.conversationId,
      conversationDocumentId: params.conversationDocumentId,
      severity: "medium",
      status,
      need: {
        capability: `model_payload_lane:${payloadType}`,
        kind: "missing_context_lane",
        reason: `Current model profile cannot consume payload type ${payloadType}. ${params.modelNeed.reason}`,
        sourceId: null,
        requiresApproval: params.modelNeed.state === "approval_required",
        asyncRecommended: params.workPlan.asyncRecommendation.recommended,
        benchmarkFixtureIds: [],
        missingPayloadType: payloadType,
        candidateContextLanes: [payloadType],
      } satisfies MissingContextLaneNeed,
      evidence: {
        planId: params.workPlan.planId,
        traceId: params.workPlan.traceId,
        modelNeed: params.modelNeed,
        payloadType,
        workPlanState: params.modelNeed.state,
        executed: false,
        executionClaimed: false,
        noUnavailableToolExecutionClaimed: true,
      },
    })
  );

  return [modelCapabilityGap, ...laneGaps];
}

function buildWorkPlanLimitationDebt(params: {
  conversationId: string | null;
  conversationDocumentId: string | null;
  workPlan: AgentWorkPlan;
  limitation: AgentWorkPlan["truthfulLimitations"][number];
}): ContextDebtUpsertInput {
  const sourceId = params.limitation.sourceId ?? null;
  const gap = {
    id: `agent-work-plan:${params.workPlan.planId}:limitation:${params.limitation.id}`,
    kind: "external_escalation_needed",
    sourceId,
    candidateId: `agent-work-plan-limitation:${params.limitation.id}`,
    severity: params.limitation.state === "approval_required" || params.limitation.state === "unavailable"
      ? "warning"
      : "info",
    summary: params.limitation.summary,
    detail: params.limitation.summary,
    requiredCapability: null,
    recommendedCapabilities: uniqueInspectionCapabilities([params.limitation.capability]),
    requiresApproval: params.limitation.state === "approval_required",
    asyncRecommended: params.limitation.state === "deferred",
    metadata: {
      planId: params.workPlan.planId,
      traceId: params.workPlan.traceId,
      limitation: params.limitation,
      noUnavailableToolExecutionClaimed: true,
    },
  } satisfies ContextGap;

  return {
    ...buildContextDebtFromGap({
      conversationId: params.conversationId,
      conversationDocumentId: params.conversationDocumentId,
      gap,
      candidate: null,
    }),
    status: workPlanStateToDebtStatus(params.limitation.state),
    evidence: {
      planId: params.workPlan.planId,
      traceId: params.workPlan.traceId,
      truthfulLimitation: params.limitation,
      executed: false,
      executionClaimed: false,
      noUnavailableToolExecutionClaimed: true,
    },
  };
}

function buildWorkPlanAsyncDebt(params: {
  conversationId: string | null;
  conversationDocumentId: string | null;
  asyncAgentWorkItemId?: string | null;
  asyncState?: string | null;
  workPlan: AgentWorkPlan;
}): ContextDebtUpsertInput | null {
  if (!params.workPlan.asyncRecommendation.recommended) {
    return null;
  }

  const locator = {
    planId: params.workPlan.planId,
    traceId: params.workPlan.traceId,
    candidateId: "async_deep_work",
    locationLabel: "AgentWorkPlan async deep work recommendation",
  };
  const debtKey = buildDebtKey({
    conversationId: params.conversationId,
    conversationDocumentId: params.conversationDocumentId,
    sourceId: null,
    kind: "async_required",
    locator,
  });
  const asyncState = params.asyncState ?? (params.asyncAgentWorkItemId ? "queued" : "recommended");

  return {
    debtKey,
    workspaceId: null,
    conversationId: params.conversationId,
    conversationDocumentId: params.conversationDocumentId,
    asyncAgentWorkItemId: params.asyncAgentWorkItemId ?? null,
    artifactKey: null,
    sourceId: null,
    kind: "async_required",
    status:
      params.workPlan.asyncRecommendation.state === "approval_required"
        ? "waiting_for_approval"
        : params.workPlan.asyncRecommendation.state === "unavailable"
          ? "blocked_by_policy"
          : "planned",
    severity: "medium",
    sourceScope: "conversation",
    sourceLocator: locator,
    title: "Async deep work is recommended",
    description: params.workPlan.asyncRecommendation.reason ?? "AgentWorkPlan recommends async deep work.",
    whyItMatters: "Future turns should preserve that this was a recommendation, not completed async execution.",
    resolutionPath: "create_async_work_item",
    resolutionPaths: ["create_async_work_item", "manual_review_needed"],
    deferredCapabilities: [],
    requiredApprovalReasons:
      params.workPlan.asyncRecommendation.state === "approval_required" ? ["approval_required"] : [],
    policyBlockers:
      params.workPlan.asyncRecommendation.state === "unavailable" ? ["async_unavailable"] : [],
    sourceCoverageTarget: {
      target: params.workPlan.sourceCoverageTarget,
      detail: params.workPlan.asyncRecommendation.reason ?? "Async deep work recommended.",
      requestedBy: "agent_work_plan",
    },
    evidence: {
      planId: params.workPlan.planId,
      traceId: params.workPlan.traceId,
      asyncRecommendation: params.workPlan.asyncRecommendation,
      asyncState,
      asyncAgentWorkItemId: params.asyncAgentWorkItemId ?? null,
      inspectedCoverageUpdated: false,
      executed: false,
      executionClaimed: false,
      noUnavailableToolExecutionClaimed: true,
    },
    linkedArtifactKeys: [],
    traceEvents: [
      traceDebt("context_debt_created", debtKey, "Async recommendation materialized from AgentWorkPlan without claiming completion."),
    ],
  };
}

export function buildRegistryUpsertsFromAgentWorkPlan(params: {
  conversationId?: string | null;
  conversationDocumentId?: string | null;
  asyncAgentWorkItemId?: string | null;
  asyncState?: string | null;
  agentWorkPlan: AgentWorkPlan;
  conversationDocumentIdsBySourceId?: Record<string, string | null | undefined>;
}): ContextRegistryUpsertBatch {
  const conversationId = params.conversationId ?? params.agentWorkPlan.conversationId ?? null;
  const sourceDebtInputs = params.agentWorkPlan.sourceNeeds
    .filter((sourceNeed) => sourceNeed.state !== "executed" && sourceNeed.state !== "planned")
    .map((sourceNeed) => {
      const conversationDocumentId = documentIdForSource({
        fallbackConversationDocumentId: params.conversationDocumentId ?? null,
        conversationDocumentIdsBySourceId: params.conversationDocumentIdsBySourceId,
        sourceId: sourceNeed.sourceId,
      });
      return buildWorkPlanSourceDebt({
        conversationId,
        conversationDocumentId,
        workPlan: params.agentWorkPlan,
        sourceNeed,
      });
    });
  const sourceCoverageInputs = params.agentWorkPlan.sourceNeeds
    .filter((sourceNeed) => sourceNeed.state !== "executed" && sourceNeed.state !== "planned")
    .map((sourceNeed) => {
      const conversationDocumentId = documentIdForSource({
        fallbackConversationDocumentId: params.conversationDocumentId ?? null,
        conversationDocumentIdsBySourceId: params.conversationDocumentIdsBySourceId,
        sourceId: sourceNeed.sourceId,
      });
      return buildWorkPlanSourceCoverage({
        conversationId,
        conversationDocumentId,
        workPlan: params.agentWorkPlan,
        sourceNeed,
      });
    });
  const capabilityGapInputs = params.agentWorkPlan.capabilityNeeds.flatMap((capabilityNeed) =>
    buildWorkPlanCapabilityGaps({
      conversationId,
      conversationDocumentId: params.conversationDocumentId ?? null,
      asyncAgentWorkItemId: params.asyncAgentWorkItemId ?? null,
      workPlan: params.agentWorkPlan,
      capabilityNeed,
    })
  );
  const modelGapInputs = params.agentWorkPlan.modelCapabilityNeeds.flatMap((modelNeed) =>
    buildWorkPlanModelGaps({
      conversationId,
      conversationDocumentId: params.conversationDocumentId ?? null,
      workPlan: params.agentWorkPlan,
      modelNeed,
    })
  );
  const limitationDebtInputs = params.agentWorkPlan.truthfulLimitations
    .filter((limitation) => limitation.state !== "executed")
    .map((limitation) =>
      buildWorkPlanLimitationDebt({
        conversationId,
        conversationDocumentId: documentIdForSource({
          fallbackConversationDocumentId: params.conversationDocumentId ?? null,
          conversationDocumentIdsBySourceId: params.conversationDocumentIdsBySourceId,
          sourceId: limitation.sourceId ?? null,
        }),
        workPlan: params.agentWorkPlan,
        limitation,
      })
    );
  const asyncDebt = buildWorkPlanAsyncDebt({
    conversationId,
    conversationDocumentId: params.conversationDocumentId ?? null,
    asyncAgentWorkItemId: params.asyncAgentWorkItemId ?? null,
    asyncState: params.asyncState ?? null,
    workPlan: params.agentWorkPlan,
  });

  return {
    contextDebtRecords: mergeDebtInputs([
      ...sourceDebtInputs,
      ...limitationDebtInputs,
      ...(asyncDebt ? [asyncDebt] : []),
    ]),
    capabilityGapRecords: mergeCapabilityGapInputs([...capabilityGapInputs, ...modelGapInputs]),
    sourceCoverageRecords: mergeCoverageInputs(sourceCoverageInputs),
  };
}

function transportDebugSnapshot(
  transport: ContextTransportResult | ContextTransportDebugSnapshot
): ContextTransportDebugSnapshot {
  return "debugSnapshot" in transport ? transport.debugSnapshot : transport;
}

function transportPlan(
  transport: ContextTransportResult | ContextTransportDebugSnapshot
) {
  return "plan" in transport ? transport.plan : null;
}

function transportPayloadById(
  transport: ContextTransportResult | ContextTransportDebugSnapshot
) {
  const plan = transportPlan(transport);
  return new Map((plan?.availablePayloads ?? []).map((payload) => [payload.id, payload]));
}

function payloadTypeToCapability(payloadType: string) {
  switch (payloadType) {
    case "rendered_page_image":
    case "page_crop_image":
      return "rendered_page_inspection";
    case "ocr_text":
      return "ocr";
    case "vision_observation":
      return "vision_page_understanding";
    case "document_ai_result":
    case "structured_table":
      return "document_ai_table_recovery";
    case "native_file_reference":
      return "source_connector_read";
    case "code_analysis_result":
      return "code_repository_inspection";
    case "web_snapshot":
      return "web_snapshot";
    default:
      return `payload_lane:${payloadType}`;
  }
}

function transportStatusFromProposal(status: "proposed" | "known_missing" | "unsupported"): CapabilityGapStatus {
  if (status === "unsupported") return "blocked";
  if (status === "known_missing") return "detected";
  return "proposed";
}

function transportMissingPayloadGap(params: {
  conversationId: string | null;
  conversationDocumentId: string | null;
  transport: ContextTransportResult | ContextTransportDebugSnapshot;
  payloadType: string;
  sourceId: string | null;
  reason: string;
  requiresApproval: boolean;
  asyncRecommended: boolean;
  status?: CapabilityGapStatus;
  candidateContextLanes?: string[];
  evidence: Record<string, unknown>;
}): CapabilityGapUpsertInput {
  return buildCapabilityGapFromNeed({
    conversationId: params.conversationId,
    conversationDocumentId: params.conversationDocumentId,
    sourceId: params.sourceId,
    status: params.status ?? (params.requiresApproval ? "review_needed" : "detected"),
    severity: params.requiresApproval ? "high" : "medium",
    need: {
      capability: `payload_lane:${params.payloadType}`,
      kind: "missing_context_transport",
      reason: params.reason,
      sourceId: params.sourceId,
      requiresApproval: params.requiresApproval,
      asyncRecommended: params.asyncRecommended,
      benchmarkFixtureIds: benchmarkFixturesForCapability(payloadTypeToCapability(params.payloadType)),
      missingPayloadType: params.payloadType,
      candidateContextLanes: uniqueStrings([
        params.payloadType,
        ...(params.candidateContextLanes ?? []),
      ]),
    } satisfies MissingContextLaneNeed,
    evidence: {
      ...params.evidence,
      transportPlanId: transportDebugSnapshot(params.transport).planId,
      executed: false,
      executionClaimed: false,
      noUnavailableToolExecutionClaimed: true,
    },
  });
}

function transportModelGap(params: {
  conversationId: string | null;
  conversationDocumentId: string | null;
  transport: ContextTransportResult | ContextTransportDebugSnapshot;
  payloadType: string;
  sourceId: string | null;
  reason: string;
  evidence: Record<string, unknown>;
}): CapabilityGapUpsertInput {
  const snapshot = transportDebugSnapshot(params.transport);
  return buildCapabilityGapFromNeed({
    conversationId: params.conversationId,
    conversationDocumentId: params.conversationDocumentId,
    sourceId: params.sourceId,
    status: "review_needed",
    severity: "medium",
    need: {
      capability: `model_payload_support:${params.payloadType}`,
      kind: "missing_model_capability",
      reason: params.reason,
      sourceId: params.sourceId,
      requiresApproval: false,
      asyncRecommended: false,
      benchmarkFixtureIds: [],
      missingModelCapability: `accepts:${params.payloadType}`,
      candidateModelCapabilities: [
        `accepts:${params.payloadType}`,
        snapshot.modelCapabilityManifestUsed.modelId,
      ],
    } satisfies MissingModelCapabilityNeed,
    evidence: {
      ...params.evidence,
      transportPlanId: snapshot.planId,
      modelManifestId: snapshot.modelCapabilityManifestUsed.manifestId,
      executed: false,
      executionClaimed: false,
      noUnavailableToolExecutionClaimed: true,
    },
  });
}

function transportApprovalGap(params: {
  conversationId: string | null;
  conversationDocumentId: string | null;
  transport: ContextTransportResult | ContextTransportDebugSnapshot;
  payloadType: string;
  sourceId: string | null;
  reason: string;
  evidence: Record<string, unknown>;
}): CapabilityGapUpsertInput {
  return buildCapabilityGapFromNeed({
    conversationId: params.conversationId,
    conversationDocumentId: params.conversationDocumentId,
    sourceId: params.sourceId,
    status: "review_needed",
    severity: "high",
    need: {
      capability: `approval_path:${params.payloadType}`,
      kind: "missing_approval_path",
      reason: params.reason,
      sourceId: params.sourceId,
      requiresApproval: true,
      asyncRecommended: false,
      benchmarkFixtureIds: [],
      missingApprovalPath: `payload_transport:${params.payloadType}`,
    } satisfies MissingApprovalPathNeed,
    evidence: {
      ...params.evidence,
      transportPlanId: transportDebugSnapshot(params.transport).planId,
      executed: false,
      executionClaimed: false,
      noUnavailableToolExecutionClaimed: true,
    },
  });
}

function transportDebtFromExclusion(params: {
  conversationId: string | null;
  conversationDocumentId: string | null;
  transport: ContextTransportResult | ContextTransportDebugSnapshot;
  exclusion: ContextTransportExclusion;
  payload: ContextPayload | null;
}): ContextDebtUpsertInput {
  const sourceId = params.payload?.sourceId ?? null;
  const recommendedCapabilities = uniqueInspectionCapabilities([
    payloadTypeToCapability(params.exclusion.payloadType),
  ]);
  const gap = {
    id: `transport:${transportDebugSnapshot(params.transport).planId}:excluded:${params.exclusion.payloadId ?? params.exclusion.payloadType}:${params.exclusion.reason}`,
    kind:
      params.exclusion.reason === "budget_exhausted" ||
      params.exclusion.reason === "a03_budget_exhausted"
        ? "excluded_candidate_budget"
        : "external_escalation_needed",
    sourceId,
    candidateId: params.exclusion.payloadId ?? `transport:${params.exclusion.payloadType}:${params.exclusion.reason}`,
    severity:
      params.exclusion.reason === "approval_required" ||
      params.exclusion.reason === "policy_blocked"
        ? "blocking"
        : "warning",
    summary: `Transport excluded ${params.exclusion.payloadType}`,
    detail: params.exclusion.detail,
    requiredCapability: recommendedCapabilities[0] ?? null,
    recommendedCapabilities,
    budgetTokensNeeded: params.exclusion.estimatedTokensNeeded ?? null,
    requiresApproval: params.exclusion.reason === "approval_required",
    asyncRecommended:
      params.exclusion.reason === "execution_not_available" ||
      params.exclusion.reason === "non_text_lane_not_executable" ||
      params.exclusion.boundary === "future_tool_boundary",
    metadata: {
      transportPlanId: transportDebugSnapshot(params.transport).planId,
      exclusion: params.exclusion,
      payloadProvenance: params.payload?.provenance ?? null,
      noUnavailableToolExecutionClaimed: true,
    },
  } satisfies ContextGap;

  return {
    ...buildContextDebtFromGap({
      conversationId: params.conversationId,
      conversationDocumentId: params.conversationDocumentId,
      gap,
      candidate: null,
    }),
    sourceLocator: {
      ...(params.payload?.provenance.location ?? {}),
      sourceId,
      payloadId: params.exclusion.payloadId,
      payloadType: params.exclusion.payloadType,
      candidateId: params.exclusion.payloadId ?? `transport:${params.exclusion.payloadType}`,
      locationLabel: params.payload?.label ?? params.exclusion.detail,
      attributionAmbiguous: sourceId == null,
    },
    sourceCoverageTarget: {
      target: params.exclusion.payloadType,
      detail: params.exclusion.detail,
      requestedBy: "adaptive_transport",
    },
    evidence: {
      transportPlanId: transportDebugSnapshot(params.transport).planId,
      exclusion: params.exclusion,
      payload: params.payload
        ? {
            id: params.payload.id,
            type: params.payload.type,
            provenance: params.payload.provenance,
            metadata: params.payload.metadata,
          }
        : null,
      executed: false,
      executionClaimed: false,
      noUnavailableToolExecutionClaimed: true,
    },
  };
}

export function buildRegistryUpsertsFromContextTransport(params: {
  conversationId?: string | null;
  conversationDocumentId?: string | null;
  transport: ContextTransportResult | ContextTransportDebugSnapshot | null | undefined;
  conversationDocumentIdsBySourceId?: Record<string, string | null | undefined>;
}): ContextRegistryUpsertBatch {
  if (!params.transport) {
    return emptyRegistryBatch();
  }

  const transport = params.transport;
  const snapshot = transportDebugSnapshot(transport);
  const payloadById = transportPayloadById(transport);
  const conversationId = params.conversationId ?? null;
  const gapInputs: CapabilityGapUpsertInput[] = [];
  const debtInputs: ContextDebtUpsertInput[] = [];

  for (const missing of snapshot.missingPayloadCapabilities) {
    const conversationDocumentId = documentIdForSource({
      fallbackConversationDocumentId: params.conversationDocumentId ?? null,
      conversationDocumentIdsBySourceId: params.conversationDocumentIdsBySourceId,
      sourceId: missing.sourceId,
    });
    gapInputs.push(
      transportMissingPayloadGap({
        conversationId,
        conversationDocumentId,
        transport,
        payloadType: missing.payloadType,
        sourceId: missing.sourceId,
        reason: missing.reason,
        requiresApproval: missing.requiresApproval,
        asyncRecommended: missing.asyncRecommended,
        candidateContextLanes: [],
        evidence: {
          missingPayloadCapability: missing,
          workPlanId: snapshot.agentWorkPlanId ?? null,
          workPlanTraceId: snapshot.agentWorkPlanTraceId ?? null,
        },
      })
    );
  }

  for (const proposal of snapshot.missingContextLaneProposals) {
    gapInputs.push(
      transportMissingPayloadGap({
        conversationId,
        conversationDocumentId: params.conversationDocumentId ?? null,
        transport,
        payloadType: proposal.missingPayloadType,
        sourceId: null,
        reason: proposal.reason,
        requiresApproval: false,
        asyncRecommended: proposal.boundary === "future_tool_boundary",
        status: transportStatusFromProposal(proposal.status),
        candidateContextLanes: proposal.candidateContextLanes,
        evidence: {
          missingContextLaneProposal: proposal,
          workPlanId: snapshot.agentWorkPlanId ?? null,
          workPlanTraceId: snapshot.agentWorkPlanTraceId ?? null,
        },
      })
    );
  }

  for (const exclusion of snapshot.excludedPayloads) {
    const payload = exclusion.payloadId ? payloadById.get(exclusion.payloadId) ?? null : null;
    const conversationDocumentId = documentIdForSource({
      fallbackConversationDocumentId: params.conversationDocumentId ?? null,
      conversationDocumentIdsBySourceId: params.conversationDocumentIdsBySourceId,
      sourceId: payload?.sourceId ?? null,
    });
    if (
      exclusion.reason === "budget_exhausted" ||
      exclusion.reason === "a03_budget_exhausted" ||
      exclusion.reason === "execution_not_available" ||
      exclusion.reason === "non_text_lane_not_executable" ||
      exclusion.reason === "transport_lane_missing" ||
      exclusion.reason === "policy_blocked" ||
      exclusion.reason === "approval_required"
    ) {
      debtInputs.push(
        transportDebtFromExclusion({
          conversationId,
          conversationDocumentId,
          transport,
          exclusion,
          payload,
        })
      );
    }

    if (exclusion.reason === "model_payload_unsupported" || exclusion.reason === "representation_unsupported") {
      gapInputs.push(
        transportModelGap({
          conversationId,
          conversationDocumentId,
          transport,
          payloadType: exclusion.payloadType,
          sourceId: payload?.sourceId ?? null,
          reason: exclusion.detail,
          evidence: { exclusion, payloadId: exclusion.payloadId },
        })
      );
    }
    if (exclusion.reason === "approval_required") {
      gapInputs.push(
        transportApprovalGap({
          conversationId,
          conversationDocumentId,
          transport,
          payloadType: exclusion.payloadType,
          sourceId: payload?.sourceId ?? null,
          reason: exclusion.detail,
          evidence: { exclusion, payloadId: exclusion.payloadId },
        })
      );
    }
  }

  for (const lane of snapshot.modelCapabilityManifestUsed.unavailableLanes ?? []) {
    for (const payloadType of lane.payloadTypes) {
      gapInputs.push(
        transportMissingPayloadGap({
          conversationId,
          conversationDocumentId: params.conversationDocumentId ?? null,
          transport,
          payloadType,
          sourceId: null,
          reason: lane.reason,
          requiresApproval: false,
          asyncRecommended: false,
          status: "detected",
          candidateContextLanes: [lane.laneId],
          evidence: {
            modelUnavailableLane: lane,
            modelManifestId: snapshot.modelCapabilityManifestUsed.manifestId,
          },
        })
      );
    }
  }

  for (const nativePayload of snapshot.modelCapabilityManifestUsed.nativePayloadSupport ?? []) {
    if (nativePayload.supported) continue;
    gapInputs.push(
      transportModelGap({
        conversationId,
        conversationDocumentId: params.conversationDocumentId ?? null,
        transport,
        payloadType: nativePayload.payloadType,
        sourceId: null,
        reason: nativePayload.reason,
        evidence: {
          nativePayloadSupport: nativePayload,
          modelManifestId: snapshot.modelCapabilityManifestUsed.manifestId,
        },
      })
    );
  }

  return {
    contextDebtRecords: mergeDebtInputs(debtInputs),
    capabilityGapRecords: mergeCapabilityGapInputs(gapInputs),
    sourceCoverageRecords: [],
  };
}

export async function upsertTruthfulExecutionRegistryCandidates(params: {
  conversationId?: string | null;
  conversationDocumentId?: string | null;
  snapshot: TruthfulExecutionClaimSnapshot;
}): Promise<ContextRegistrySelection> {
  const batch = buildRegistryUpsertsFromTruthfulExecutionSnapshot(params);
  if (
    batch.contextDebtRecords.length === 0 &&
    batch.capabilityGapRecords.length === 0 &&
    batch.sourceCoverageRecords.length === 0
  ) {
    return EMPTY_CONTEXT_REGISTRY_SELECTION;
  }

  return upsertContextRegistryBatch(batch);
}

function serializeContextDebt(input: ContextDebtUpsertInput, includeId: boolean) {
  return {
    ...(includeId && input.id ? { id: input.id } : {}),
    debtKey: input.debtKey,
    workspaceId: input.workspaceId,
    conversationId: input.conversationId,
    conversationDocumentId: input.conversationDocumentId,
    asyncAgentWorkItemId: input.asyncAgentWorkItemId,
    artifactKey: input.artifactKey,
    sourceId: input.sourceId,
    kind: input.kind,
    status: input.status,
    severity: input.severity,
    sourceScope: input.sourceScope,
    sourceLocatorJson: json(input.sourceLocator),
    title: input.title,
    description: input.description,
    whyItMatters: input.whyItMatters,
    resolutionPath: input.resolutionPath,
    resolutionPathsJson: json(input.resolutionPaths),
    deferredCapabilitiesJson: json(input.deferredCapabilities),
    requiredApprovalReasonsJson: json(input.requiredApprovalReasons),
    policyBlockersJson: json(input.policyBlockers),
    sourceCoverageTargetJson: json(input.sourceCoverageTarget),
    evidenceJson: json(input.evidence),
    traceJson: json(input.traceEvents ?? []),
    linkedArtifactKeysJson: json(input.linkedArtifactKeys),
    lastSeenAt: new Date(input.lastSeenAt ?? nowIso()),
    resolvedAt: input.resolvedAt ? new Date(input.resolvedAt) : null,
  };
}

function serializeCapabilityGap(input: CapabilityGapUpsertInput, includeId: boolean) {
  return {
    ...(includeId && input.id ? { id: input.id } : {}),
    gapKey: input.gapKey,
    workspaceId: input.workspaceId,
    conversationId: input.conversationId,
    conversationDocumentId: input.conversationDocumentId,
    asyncAgentWorkItemId: input.asyncAgentWorkItemId,
    relatedContextDebtId: input.relatedContextDebtId,
    sourceId: input.sourceId,
    kind: input.kind,
    status: input.status,
    severity: input.severity,
    reviewState: input.reviewState,
    neededCapability: input.neededCapability,
    missingPayloadType: input.missingPayloadType,
    missingToolId: input.missingToolId,
    missingModelCapability: input.missingModelCapability,
    missingArtifactType: input.missingArtifactType,
    missingConnector: input.missingConnector,
    missingApprovalPath: input.missingApprovalPath,
    missingBudgetProfile: input.missingBudgetProfile,
    title: input.title,
    description: input.description,
    whyNeeded: input.whyNeeded,
    currentLimitation: input.currentLimitation,
    recommendedResolution: input.recommendedResolution,
    resolutionPath: input.resolutionPath,
    resolutionPathsJson: json(input.resolutionPaths),
    candidateToolCategoriesJson: json(input.candidateToolCategories),
    candidateModelCapabilitiesJson: json(input.candidateModelCapabilities),
    candidateContextLanesJson: json(input.candidateContextLanes),
    requiredArtifactTypesJson: json(input.requiredArtifactTypes),
    requiredApprovalPolicyJson: json(input.requiredApprovalPolicy),
    requiredBudgetProfileJson: json(input.requiredBudgetProfile),
    securityConsiderationsJson: json(input.securityConsiderations),
    dataEgressConsiderationsJson: json(input.dataEgressConsiderations),
    benchmarkFixtureIdsJson: json(input.benchmarkFixtureIds),
    evidenceJson: json(input.evidence),
    traceJson: json(input.traceEvents ?? []),
    lastSeenAt: new Date(input.lastSeenAt ?? nowIso()),
    resolvedAt: input.resolvedAt ? new Date(input.resolvedAt) : null,
  };
}

function serializeSourceCoverage(input: SourceCoverageUpsertInput, includeId: boolean) {
  return {
    ...(includeId && input.id ? { id: input.id } : {}),
    coverageKey: input.coverageKey,
    workspaceId: input.workspaceId,
    conversationId: input.conversationId,
    conversationDocumentId: input.conversationDocumentId,
    asyncAgentWorkItemId: input.asyncAgentWorkItemId,
    sourceId: input.sourceId,
    sourceScope: input.sourceScope,
    sourceLocatorJson: json(input.sourceLocator),
    coverageStatus: input.coverageStatus,
    coverageTargetJson: json(input.coverageTarget),
    inspectedByJson: json(input.inspectedBy),
    limitationsJson: json(input.limitations),
    relatedDebtIdsJson: json(input.relatedDebtIds),
    selectedCandidateCount: input.selectedCandidateCount,
    totalCandidateCount: input.totalCandidateCount,
    evidenceJson: json(input.evidence),
    traceJson: json(input.traceEvents ?? []),
  };
}

export function hydrateContextDebtRecord(record: RegistryPrismaRecord): ContextDebtRecord {
  return {
    id: String(record.id),
    debtKey: String(record.debtKey),
    workspaceId: (record.workspaceId as string | null) ?? null,
    conversationId: (record.conversationId as string | null) ?? null,
    conversationDocumentId: (record.conversationDocumentId as string | null) ?? null,
    asyncAgentWorkItemId: (record.asyncAgentWorkItemId as string | null) ?? null,
    artifactKey: (record.artifactKey as string | null) ?? null,
    sourceId: (record.sourceId as string | null) ?? null,
    kind: record.kind as ContextDebtKind,
    status: record.status as ContextDebtStatus,
    severity: record.severity as ContextDebtSeverity,
    sourceScope: record.sourceScope as ContextDebtSourceScope,
    sourceLocator: parseJson(record.sourceLocatorJson, {}),
    title: String(record.title),
    description: String(record.description),
    whyItMatters: (record.whyItMatters as string | null) ?? null,
    resolutionPath: record.resolutionPath as ContextDebtResolutionPath,
    resolutionPaths: parseJson(record.resolutionPathsJson, []),
    deferredCapabilities: parseJson(record.deferredCapabilitiesJson, []),
    requiredApprovalReasons: parseJson(record.requiredApprovalReasonsJson, []),
    policyBlockers: parseJson(record.policyBlockersJson, []),
    sourceCoverageTarget: parseJson(record.sourceCoverageTargetJson, {}),
    evidence: parseJson(record.evidenceJson, {}),
    traceEvents: parseJson(record.traceJson, []),
    linkedArtifactKeys: parseJson(record.linkedArtifactKeysJson, []),
    firstSeenAt: asDateIso(record.firstSeenAt),
    lastSeenAt: asDateIso(record.lastSeenAt),
    resolvedAt: record.resolvedAt ? asDateIso(record.resolvedAt) : null,
    createdAt: asDateIso(record.createdAt),
    updatedAt: asDateIso(record.updatedAt),
  };
}

export function hydrateCapabilityGapRecord(record: RegistryPrismaRecord): CapabilityGapRecord {
  return {
    id: String(record.id),
    gapKey: String(record.gapKey),
    workspaceId: (record.workspaceId as string | null) ?? null,
    conversationId: (record.conversationId as string | null) ?? null,
    conversationDocumentId: (record.conversationDocumentId as string | null) ?? null,
    asyncAgentWorkItemId: (record.asyncAgentWorkItemId as string | null) ?? null,
    relatedContextDebtId: (record.relatedContextDebtId as string | null) ?? null,
    relatedContextDebtKey: null,
    sourceId: (record.sourceId as string | null) ?? null,
    kind: record.kind as CapabilityGapKind,
    status: record.status as CapabilityGapStatus,
    severity: record.severity as CapabilityGapSeverity,
    reviewState: record.reviewState as CapabilityGapReviewState,
    neededCapability: String(record.neededCapability),
    missingPayloadType: (record.missingPayloadType as string | null) ?? null,
    missingToolId: (record.missingToolId as string | null) ?? null,
    missingModelCapability: (record.missingModelCapability as string | null) ?? null,
    missingArtifactType: (record.missingArtifactType as string | null) ?? null,
    missingConnector: (record.missingConnector as string | null) ?? null,
    missingApprovalPath: (record.missingApprovalPath as string | null) ?? null,
    missingBudgetProfile: (record.missingBudgetProfile as string | null) ?? null,
    title: String(record.title),
    description: String(record.description),
    whyNeeded: (record.whyNeeded as string | null) ?? null,
    currentLimitation: (record.currentLimitation as string | null) ?? null,
    recommendedResolution: (record.recommendedResolution as string | null) ?? null,
    resolutionPath: record.resolutionPath as CapabilityGapResolutionPath,
    resolutionPaths: parseJson(record.resolutionPathsJson, []),
    candidateToolCategories: parseJson(record.candidateToolCategoriesJson, []),
    candidateModelCapabilities: parseJson(record.candidateModelCapabilitiesJson, []),
    candidateContextLanes: parseJson(record.candidateContextLanesJson, []),
    requiredArtifactTypes: parseJson(record.requiredArtifactTypesJson, []),
    requiredApprovalPolicy: parseJson(record.requiredApprovalPolicyJson, {}),
    requiredBudgetProfile: parseJson(record.requiredBudgetProfileJson, {}),
    securityConsiderations: parseJson(record.securityConsiderationsJson, []),
    dataEgressConsiderations: parseJson(record.dataEgressConsiderationsJson, []),
    benchmarkFixtureIds: parseJson(record.benchmarkFixtureIdsJson, []),
    evidence: parseJson(record.evidenceJson, {}),
    traceEvents: parseJson(record.traceJson, []),
    firstSeenAt: asDateIso(record.firstSeenAt),
    lastSeenAt: asDateIso(record.lastSeenAt),
    resolvedAt: record.resolvedAt ? asDateIso(record.resolvedAt) : null,
    createdAt: asDateIso(record.createdAt),
    updatedAt: asDateIso(record.updatedAt),
  };
}

export function hydrateSourceCoverageRecord(record: RegistryPrismaRecord): SourceCoverageRecord {
  return {
    id: String(record.id),
    coverageKey: String(record.coverageKey),
    workspaceId: (record.workspaceId as string | null) ?? null,
    conversationId: (record.conversationId as string | null) ?? null,
    conversationDocumentId: (record.conversationDocumentId as string | null) ?? null,
    asyncAgentWorkItemId: (record.asyncAgentWorkItemId as string | null) ?? null,
    sourceId: String(record.sourceId),
    sourceScope: record.sourceScope as SourceCoverageScope,
    sourceLocator: parseJson(record.sourceLocatorJson, {}),
    coverageStatus: record.coverageStatus as SourceCoverageStatus,
    coverageTarget: parseJson(record.coverageTargetJson, {
      target: "unknown",
      detail: "No stored target.",
      requestedBy: "progressive_assembly",
    }),
    inspectedBy: parseJson(record.inspectedByJson, []),
    limitations: parseJson(record.limitationsJson, []),
    relatedDebtIds: parseJson(record.relatedDebtIdsJson, []),
    selectedCandidateCount: Number(record.selectedCandidateCount ?? 0),
    totalCandidateCount: Number(record.totalCandidateCount ?? 0),
    evidence: parseJson(record.evidenceJson, {}),
    traceEvents: parseJson(record.traceJson, []),
    createdAt: asDateIso(record.createdAt),
    updatedAt: asDateIso(record.updatedAt),
  };
}

export class ContextDebtRegistry {
  constructor(private readonly client: ContextRegistryPrismaClient = prisma as unknown as ContextRegistryPrismaClient) {}

  async upsertMany(inputs: ContextDebtUpsertInput[]) {
    const records: ContextDebtRecord[] = [];
    for (const input of mergeDebtInputs(inputs)) {
      const create = serializeContextDebt(input, true);
      const update = serializeContextDebt(input, false);
      const record = await this.client.contextDebtRecord.upsert({
        where: { debtKey: input.debtKey },
        create,
        update,
      });
      records.push(hydrateContextDebtRecord(record));
    }
    return records;
  }

  async selectOpen(params: {
    conversationId?: string | null;
    conversationDocumentIds?: string[];
    policy?: Partial<ContextDebtSelectionPolicy>;
  }) {
    const policy = { ...DEFAULT_CONTEXT_DEBT_SELECTION_POLICY, ...(params.policy ?? {}) };
    const or = [
      params.conversationId ? { conversationId: params.conversationId } : null,
      params.conversationDocumentIds?.length
        ? { conversationDocumentId: { in: params.conversationDocumentIds } }
        : null,
    ].filter(Boolean);
    const records = await this.client.contextDebtRecord.findMany({
      where: {
        status: { in: policy.statuses },
        ...(or.length > 0 ? { OR: or } : {}),
      },
      orderBy: [{ severity: "desc" }, { lastSeenAt: "desc" }],
      take: policy.maxRecords,
    });
    return records
      .map(hydrateContextDebtRecord)
      .filter((record) => !CONTEXT_DEBT_RESOLVED_STATUSES.has(record.status))
      .sort((left, right) => severityRank(right.severity) - severityRank(left.severity));
  }
}

export class CapabilityGapRegistry {
  constructor(private readonly client: ContextRegistryPrismaClient = prisma as unknown as ContextRegistryPrismaClient) {}

  async upsertMany(inputs: CapabilityGapUpsertInput[]) {
    const records: CapabilityGapRecord[] = [];
    for (const input of mergeCapabilityGapInputs(inputs)) {
      const create = serializeCapabilityGap(input, true);
      const update = serializeCapabilityGap(input, false);
      const record = await this.client.capabilityGapRecord.upsert({
        where: { gapKey: input.gapKey },
        create,
        update,
      });
      records.push(hydrateCapabilityGapRecord(record));
    }
    return records;
  }

  async selectOpen(params: {
    conversationId?: string | null;
    conversationDocumentIds?: string[];
    policy?: Partial<CapabilityGapSelectionPolicy>;
  }) {
    const policy = { ...DEFAULT_CAPABILITY_GAP_SELECTION_POLICY, ...(params.policy ?? {}) };
    const or = [
      params.conversationId ? { conversationId: params.conversationId } : null,
      params.conversationDocumentIds?.length
        ? { conversationDocumentId: { in: params.conversationDocumentIds } }
        : null,
    ].filter(Boolean);
    const records = await this.client.capabilityGapRecord.findMany({
      where: {
        status: { in: policy.statuses },
        ...(or.length > 0 ? { OR: or } : {}),
      },
      orderBy: [{ severity: "desc" }, { lastSeenAt: "desc" }],
      take: policy.maxRecords,
    });
    return records
      .map(hydrateCapabilityGapRecord)
      .filter((record) => !CAPABILITY_GAP_RESOLVED_STATUSES.has(record.status))
      .sort((left, right) => severityRank(right.severity) - severityRank(left.severity));
  }
}

export class SourceCoverageRegistry {
  constructor(private readonly client: ContextRegistryPrismaClient = prisma as unknown as ContextRegistryPrismaClient) {}

  async upsertMany(inputs: SourceCoverageUpsertInput[]) {
    const records: SourceCoverageRecord[] = [];
    for (const input of mergeCoverageInputs(inputs)) {
      const create = serializeSourceCoverage(input, true);
      const update = serializeSourceCoverage(input, false);
      const record = await this.client.sourceCoverageRecord.upsert({
        where: { coverageKey: input.coverageKey },
        create,
        update,
      });
      records.push(hydrateSourceCoverageRecord(record));
    }
    return records;
  }

  async selectOpen(params: {
    conversationId?: string | null;
    conversationDocumentIds?: string[];
    maxRecords?: number;
  }) {
    const or = [
      params.conversationId ? { conversationId: params.conversationId } : null,
      params.conversationDocumentIds?.length
        ? { conversationDocumentId: { in: params.conversationDocumentIds } }
        : null,
    ].filter(Boolean);
    const records = await this.client.sourceCoverageRecord.findMany({
      where: {
        coverageStatus: {
          in: ["unknown", "uninspected", "partially_inspected", "inspected_with_limitations", "stale", "blocked"],
        },
        ...(or.length > 0 ? { OR: or } : {}),
      },
      orderBy: [{ updatedAt: "desc" }],
      take: params.maxRecords ?? 12,
    });
    return records.map(hydrateSourceCoverageRecord);
  }
}

export async function upsertContextRegistryBatch(
  batch: ContextRegistryUpsertBatch,
  client: ContextRegistryPrismaClient = prisma as unknown as ContextRegistryPrismaClient
): Promise<ContextRegistrySelection> {
  const contextDebt = new ContextDebtRegistry(client);
  const capabilityGaps = new CapabilityGapRegistry(client);
  const sourceCoverage = new SourceCoverageRegistry(client);
  const debtRecords = await contextDebt.upsertMany(batch.contextDebtRecords);
  const debtIdByKey = new Map(debtRecords.map((record) => [record.debtKey, record.id]));
  const gapInputs = batch.capabilityGapRecords.map((gap) => ({
    ...gap,
    relatedContextDebtId: gap.relatedContextDebtId ?? (gap.relatedContextDebtKey ? debtIdByKey.get(gap.relatedContextDebtKey) ?? null : null),
  }));
  const gapRecords = await capabilityGaps.upsertMany(gapInputs);
  const coverageRecords = await sourceCoverage.upsertMany(batch.sourceCoverageRecords);

  return {
    contextDebtRecords: debtRecords,
    capabilityGapRecords: gapRecords,
    sourceCoverageRecords: coverageRecords,
    traceEvents: [
      ...debtRecords.flatMap((record) => record.traceEvents),
      ...gapRecords.flatMap((record) => record.traceEvents),
      ...coverageRecords.flatMap((record) => record.traceEvents),
    ],
  };
}

export async function selectOpenContextRegistryRecords(params: {
  conversationId?: string | null;
  conversationDocumentIds?: string[];
  client?: ContextRegistryPrismaClient;
}): Promise<ContextRegistrySelection> {
  const client = params.client ?? (prisma as unknown as ContextRegistryPrismaClient);
  const [contextDebtRecords, capabilityGapRecords, sourceCoverageRecords] = await Promise.all([
    new ContextDebtRegistry(client).selectOpen(params),
    new CapabilityGapRegistry(client).selectOpen(params),
    new SourceCoverageRegistry(client).selectOpen(params),
  ]);

  return {
    contextDebtRecords,
    capabilityGapRecords,
    sourceCoverageRecords,
    traceEvents: [
      ...contextDebtRecords.map((record) =>
        traceDebt("context_debt_selected", record.debtKey, "Open context debt selected for future context/control.")
      ),
      ...capabilityGapRecords.map((record) =>
        traceGap("capability_gap_selected", record.gapKey, "Open capability gap selected for future context/control.")
      ),
    ],
  };
}

export function mergeContextRegistryBatches(...batches: ContextRegistryUpsertBatch[]): ContextRegistryUpsertBatch {
  return {
    contextDebtRecords: mergeDebtInputs(batches.flatMap((batch) => batch.contextDebtRecords)),
    capabilityGapRecords: mergeCapabilityGapInputs(batches.flatMap((batch) => batch.capabilityGapRecords)),
    sourceCoverageRecords: mergeCoverageInputs(batches.flatMap((batch) => batch.sourceCoverageRecords)),
  };
}

export function mergeContextRegistrySelections(
  ...selections: ContextRegistrySelection[]
): ContextRegistrySelection {
  const contextDebtByKey = new Map<string, ContextDebtRecord>();
  const capabilityGapByKey = new Map<string, CapabilityGapRecord>();
  const sourceCoverageByKey = new Map<string, SourceCoverageRecord>();

  for (const selection of selections) {
    for (const record of selection.contextDebtRecords) {
      contextDebtByKey.set(record.debtKey, record);
    }
    for (const record of selection.capabilityGapRecords) {
      capabilityGapByKey.set(record.gapKey, record);
    }
    for (const record of selection.sourceCoverageRecords) {
      sourceCoverageByKey.set(record.coverageKey, record);
    }
  }

  return {
    contextDebtRecords: [...contextDebtByKey.values()],
    capabilityGapRecords: [...capabilityGapByKey.values()],
    sourceCoverageRecords: [...sourceCoverageByKey.values()],
    traceEvents: selections.flatMap((selection) => selection.traceEvents),
  };
}

function batchCandidateCount(batch: ContextRegistryUpsertBatch) {
  return batch.contextDebtRecords.length + batch.capabilityGapRecords.length + batch.sourceCoverageRecords.length;
}

function batchRecordKeys(batch: ContextRegistryUpsertBatch) {
  return [
    ...batch.contextDebtRecords.map((record) => `debt:${record.debtKey}`),
    ...batch.capabilityGapRecords.map((record) => `gap:${record.gapKey}`),
    ...batch.sourceCoverageRecords.map((record) => `coverage:${record.coverageKey}`),
  ];
}

function selectionRecordKeys(selection: ContextRegistrySelection | null | undefined) {
  return new Set([
    ...(selection?.contextDebtRecords ?? []).map((record) => `debt:${record.debtKey}`),
    ...(selection?.capabilityGapRecords ?? []).map((record) => `gap:${record.gapKey}`),
    ...(selection?.sourceCoverageRecords ?? []).map((record) => `coverage:${record.coverageKey}`),
  ]);
}

function frequencyTop(values: string[], max = 8) {
  const counts = new Map<string, number>();
  for (const value of values.filter(Boolean)) {
    counts.set(value, (counts.get(value) ?? 0) + 1);
  }
  return [...counts.entries()]
    .sort((left, right) => right[1] - left[1] || left[0].localeCompare(right[0]))
    .slice(0, max)
    .map(([value]) => value);
}

function recordHasDocumentLink(record: {
  conversationDocumentId: string | null;
}) {
  return Boolean(record.conversationDocumentId);
}

function recordHasSourceLink(record: {
  sourceId?: string | null;
}) {
  return Boolean(record.sourceId);
}

function recordHasAmbiguousAttribution(record: {
  conversationDocumentId?: string | null;
  sourceId?: string | null;
  sourceLocator?: Record<string, unknown>;
  evidence?: Record<string, unknown>;
}) {
  return Boolean(
    record.sourceLocator?.attributionAmbiguous ||
    record.evidence?.attributionAmbiguous ||
    (!record.conversationDocumentId && !record.sourceId)
  );
}

export function buildDurableEmissionDebugSummary(params: {
  sourceBatches?: DurableEmissionSourceBatch[];
  candidateBatch?: ContextRegistryUpsertBatch | null;
  persistedSelection?: ContextRegistrySelection | null;
  priorSelection?: ContextRegistrySelection | null;
  skipped?: DurableEmissionSkippedCandidate[];
}): DurableEmissionDebugSummary {
  const sourceBatches = params.sourceBatches ?? [];
  const candidateBatch =
    params.candidateBatch ??
    (sourceBatches.length > 0
      ? mergeContextRegistryBatches(...sourceBatches.map((entry) => entry.batch))
      : emptyRegistryBatch());
  const rawCandidateCount =
    sourceBatches.length > 0
      ? sourceBatches.reduce((sum, entry) => sum + batchCandidateCount(entry.batch), 0)
      : batchCandidateCount(candidateBatch);
  const candidateKeys = new Set(batchRecordKeys(candidateBatch));
  const priorKeys = selectionRecordKeys(params.priorSelection);
  const persistedKeys = selectionRecordKeys(params.persistedSelection);
  const persistedCandidateKeys = [...candidateKeys].filter((key) => persistedKeys.has(key));
  const skipped = params.skipped ?? [];
  const duplicateCandidateCount = Math.max(0, rawCandidateCount - candidateKeys.size);
  const alreadyExistingCount = [...candidateKeys].filter((key) => priorKeys.has(key)).length;
  const allRecords = [
    ...candidateBatch.contextDebtRecords,
    ...candidateBatch.capabilityGapRecords,
    ...candidateBatch.sourceCoverageRecords,
  ];

  return {
    candidateCount: candidateKeys.size,
    contextDebtCandidateCount: candidateBatch.contextDebtRecords.length,
    capabilityGapCandidateCount: candidateBatch.capabilityGapRecords.length,
    sourceCoverageCandidateCount: candidateBatch.sourceCoverageRecords.length,
    createdOrPersistedCount: persistedCandidateKeys.filter((key) => !priorKeys.has(key)).length,
    updatedOrMergedCount: persistedCandidateKeys.filter((key) => priorKeys.has(key)).length,
    dedupedOrAlreadyExistingCount: duplicateCandidateCount + alreadyExistingCount,
    skippedCount: skipped.length,
    alreadyResolvedCount: skipped.filter((entry) => entry.reason === "already_resolved").length,
    insufficientEvidenceCount: skipped.filter((entry) => entry.reason === "insufficient_evidence").length,
    topMissingCapabilities: frequencyTop([
      ...candidateBatch.capabilityGapRecords.map((record) => record.neededCapability),
      ...candidateBatch.contextDebtRecords.flatMap((record) => record.deferredCapabilities),
    ]),
    topMissingPayloadLanes: frequencyTop([
      ...candidateBatch.capabilityGapRecords.flatMap((record) =>
        uniqueStrings([record.missingPayloadType, ...record.candidateContextLanes])
      ),
      ...candidateBatch.sourceCoverageRecords.map((record) =>
        typeof record.coverageTarget.target === "string" ? record.coverageTarget.target : null
      ).filter((value): value is string => Boolean(value)),
    ]),
    sourceCoverageGaps: candidateBatch.sourceCoverageRecords.map((record) => ({
      sourceId: record.sourceId,
      conversationDocumentId: record.conversationDocumentId,
      coverageStatus: record.coverageStatus,
      target: typeof record.coverageTarget.target === "string" ? record.coverageTarget.target : null,
    })),
    asyncCandidates: candidateBatch.contextDebtRecords
      .filter((record) => record.kind === "async_required" || record.asyncAgentWorkItemId)
      .map((record) => ({
        state:
          typeof record.evidence.asyncState === "string"
            ? record.evidence.asyncState
            : record.asyncAgentWorkItemId
              ? "queued"
              : "recommended",
        asyncAgentWorkItemId: record.asyncAgentWorkItemId,
        reason: record.description,
      })),
    recordsLinkedToDocumentCount: allRecords.filter(recordHasDocumentLink).length,
    recordsLinkedToSourceCount: allRecords.filter(recordHasSourceLink).length,
    conversationLevelRecordCount: allRecords.filter((record) => !record.conversationDocumentId && !record.sourceId).length,
    ambiguousAttributionCount: allRecords.filter(recordHasAmbiguousAttribution).length,
    skippedReasons: uniqueStrings(skipped.map((entry) => `${entry.source}:${entry.reason}:${entry.detail}`)),
    sourceBatchSummaries: sourceBatches.map((entry) => ({
      source: entry.source,
      contextDebtCandidates: entry.batch.contextDebtRecords.length,
      capabilityGapCandidates: entry.batch.capabilityGapRecords.length,
      sourceCoverageCandidates: entry.batch.sourceCoverageRecords.length,
    })),
    noUnavailableToolExecutionClaimed: true,
  };
}

export function buildContextRegistryPackingCandidates(selection: ContextRegistrySelection): ContextPackingCandidate[] {
  const debtCandidates = selection.contextDebtRecords.map((record) => ({
    id: `registry:context-debt:${record.debtKey}`,
    kind: "artifact" as const,
    sourceId: record.sourceId ?? record.conversationDocumentId ?? record.conversationId ?? "context-registry",
    sourceType: "memory",
    label: record.title,
    content: [
      `Known context debt: ${record.title}`,
      `Status: ${record.status}. Severity: ${record.severity}.`,
      record.description,
      record.whyItMatters ? `Why it matters: ${record.whyItMatters}` : null,
      `Resolution path: ${record.resolutionPaths.join(", ")}.`,
      record.deferredCapabilities.length > 0
        ? `Deferred capabilities: ${record.deferredCapabilities.join(", ")}. These have not executed.`
        : null,
    ].filter(Boolean).join("\n"),
    approxTokenCount: 80,
    priority: severityRank(record.severity) * 20,
    confidence: null,
    artifactKind: "context_debt_record",
    artifactStatus: record.status,
    locationLabel: typeof record.sourceLocator.locationLabel === "string" ? record.sourceLocator.locationLabel : null,
    provenance: {
      debtKey: record.debtKey,
      sourceLocator: record.sourceLocator,
      linkedArtifactKeys: record.linkedArtifactKeys,
    },
    rankingHints: [record.kind, record.status, ...record.deferredCapabilities],
    required: record.severity === "critical",
    metadata: {
      registryType: "context_debt",
      debtKey: record.debtKey,
      noUnavailableToolExecutionClaimed: true,
    },
  }));
  const gapCandidates = selection.capabilityGapRecords.map((record) => ({
    id: `registry:capability-gap:${record.gapKey}`,
    kind: "artifact" as const,
    sourceId: record.sourceId ?? record.conversationDocumentId ?? record.conversationId ?? "capability-registry",
    sourceType: "memory",
    label: record.title,
    content: [
      `Known capability gap: ${record.neededCapability}`,
      `Kind: ${record.kind}. Status: ${record.status}.`,
      record.description,
      `Recommended resolution: ${record.resolutionPaths.join(", ")}.`,
      "This is a durable proposal/gap only; it is not an executed tool.",
    ].join("\n"),
    approxTokenCount: 70,
    priority: severityRank(record.severity) * 18,
    confidence: null,
    artifactKind: "capability_gap_record",
    artifactStatus: record.status,
    locationLabel: null,
    provenance: {
      gapKey: record.gapKey,
      relatedContextDebtId: record.relatedContextDebtId,
      benchmarkFixtureIds: record.benchmarkFixtureIds,
    },
    rankingHints: [record.kind, record.neededCapability, ...record.candidateContextLanes],
    required: record.severity === "critical",
    metadata: {
      registryType: "capability_gap",
      gapKey: record.gapKey,
      noUnavailableToolExecutionClaimed: true,
    },
  }));

  return [...debtCandidates, ...gapCandidates];
}

export function buildAgentControlSourceSignalsFromRegistry(selection: ContextRegistrySelection): AgentControlSourceSignal[] {
  const sourceIds = uniqueStrings([
    ...selection.contextDebtRecords.map((record) => record.sourceId ?? record.conversationDocumentId),
    ...selection.capabilityGapRecords.map((record) => record.sourceId ?? record.conversationDocumentId),
  ]);

  return sourceIds.map((sourceId) => {
    const debts = selection.contextDebtRecords.filter(
      (record) => (record.sourceId ?? record.conversationDocumentId) === sourceId
    );
    const gaps = selection.capabilityGapRecords.filter(
      (record) => (record.sourceId ?? record.conversationDocumentId) === sourceId
    );
    const recommended = unique(
      gaps.flatMap((gap) =>
        (EXTERNAL_TABLE_RECOVERY_CAPABILITIES as readonly InspectionCapability[]).includes(
          gap.neededCapability as InspectionCapability
        )
          ? [gap.neededCapability as InspectionCapability]
          : []
      )
    );

    return {
      sourceId,
      sourceType: "context_registry",
      filename: null,
      hasWeakArtifact: debts.some((debt) => debt.kind === "missing_table_body" || debt.kind === "weak_table_candidate"),
      hasStaleArtifact: debts.some((debt) => debt.kind === "stale_artifact"),
      artifactKinds: debts.map((debt) => debt.kind),
      warningArtifactKinds: debts.filter((debt) => debt.severity === "high" || debt.severity === "critical").map((debt) => debt.kind),
      recommendedNextCapabilities: recommended,
      unmetCapabilities: recommended,
      sourceCoverageHints: debts.some((debt) => debt.kind === "incomplete_source_coverage")
        ? ["full_document"]
        : undefined,
      detail: `A-04g selected ${debts.length} open debt record(s) and ${gaps.length} capability gap(s) for this source.`,
    };
  });
}

export function buildContextRegistryDebugSnapshot(
  selection: ContextRegistrySelection,
  options: { durableEmission?: DurableEmissionDebugSummary | null } = {}
): ContextRegistryDebugSnapshot {
  const selectedDebt = selection.contextDebtRecords.filter((record) => !CONTEXT_DEBT_RESOLVED_STATUSES.has(record.status));
  const selectedGaps = selection.capabilityGapRecords.filter((record) => !CAPABILITY_GAP_RESOLVED_STATUSES.has(record.status));

  return {
    contextDebt: {
      records: selection.contextDebtRecords,
      selectedRecords: selectedDebt,
      reuseDecisions: selection.contextDebtRecords.map((record) => ({
        debtKey: record.debtKey,
        selected: selectedDebt.includes(record),
        reason: selectedDebt.includes(record)
          ? "Open debt remains relevant to future context."
          : "Resolved, superseded, dismissed, or outside selection policy.",
        status: record.status,
        severity: record.severity,
      })),
      traceEvents: selection.contextDebtRecords.flatMap((record) => record.traceEvents),
    },
    capabilityGaps: {
      records: selection.capabilityGapRecords,
      selectedRecords: selectedGaps,
      traceEvents: selection.capabilityGapRecords.flatMap((record) => record.traceEvents),
    },
    sourceCoverage: {
      records: selection.sourceCoverageRecords,
      traceEvents: selection.sourceCoverageRecords.flatMap((record) => record.traceEvents),
    },
    durableEmission: options.durableEmission ?? null,
    noUnavailableToolExecutionClaimed: true,
  };
}

export class InMemoryCapabilityGapContextDebtRegistry {
  private readonly debtRecords = new Map<string, ContextDebtRecord>();
  private readonly gapRecords = new Map<string, CapabilityGapRecord>();
  private readonly coverageRecords = new Map<string, SourceCoverageRecord>();

  upsertBatch(batch: ContextRegistryUpsertBatch): ContextRegistrySelection {
    const timestamp = nowIso();
    const debtRecords = mergeDebtInputs(batch.contextDebtRecords).map((input) => {
      const existing = this.debtRecords.get(input.debtKey);
      const record: ContextDebtRecord = {
        ...input,
        id: existing?.id ?? input.id ?? input.debtKey,
        firstSeenAt: existing?.firstSeenAt ?? input.firstSeenAt ?? timestamp,
        lastSeenAt: timestamp,
        resolvedAt: input.resolvedAt ?? existing?.resolvedAt ?? null,
        createdAt: existing?.createdAt ?? timestamp,
        updatedAt: timestamp,
        traceEvents: [
          ...(existing?.traceEvents ?? []),
          ...(input.traceEvents ?? []),
          traceDebt(existing ? "context_debt_updated" : "context_debt_created", input.debtKey, "In-memory registry upsert completed."),
        ],
      };
      this.debtRecords.set(input.debtKey, record);
      return record;
    });
    const debtIdByKey = new Map([...this.debtRecords.values()].map((record) => [record.debtKey, record.id]));
    const gapRecords = mergeCapabilityGapInputs(batch.capabilityGapRecords).map((input) => {
      const existing = this.gapRecords.get(input.gapKey);
      const relatedContextDebtId =
        input.relatedContextDebtId ?? (input.relatedContextDebtKey ? debtIdByKey.get(input.relatedContextDebtKey) ?? null : null);
      const record: CapabilityGapRecord = {
        ...input,
        id: existing?.id ?? input.id ?? input.gapKey,
        relatedContextDebtId,
        firstSeenAt: existing?.firstSeenAt ?? input.firstSeenAt ?? timestamp,
        lastSeenAt: timestamp,
        resolvedAt: input.resolvedAt ?? existing?.resolvedAt ?? null,
        createdAt: existing?.createdAt ?? timestamp,
        updatedAt: timestamp,
        traceEvents: [
          ...(existing?.traceEvents ?? []),
          ...(input.traceEvents ?? []),
          traceGap(existing ? "capability_gap_updated" : "capability_gap_created", input.gapKey, "In-memory registry upsert completed."),
        ],
      };
      this.gapRecords.set(input.gapKey, record);
      return record;
    });
    const sourceCoverageRecords = mergeCoverageInputs(batch.sourceCoverageRecords).map((input) => {
      const existing = this.coverageRecords.get(input.coverageKey);
      const record: SourceCoverageRecord = {
        ...input,
        id: existing?.id ?? input.id ?? input.coverageKey,
        createdAt: existing?.createdAt ?? timestamp,
        updatedAt: timestamp,
        traceEvents: [...(existing?.traceEvents ?? []), ...(input.traceEvents ?? [])],
      };
      this.coverageRecords.set(input.coverageKey, record);
      return record;
    });

    return {
      contextDebtRecords: debtRecords,
      capabilityGapRecords: gapRecords,
      sourceCoverageRecords,
      traceEvents: [
        ...debtRecords.flatMap((record) => record.traceEvents),
        ...gapRecords.flatMap((record) => record.traceEvents),
        ...sourceCoverageRecords.flatMap((record) => record.traceEvents),
      ],
    };
  }

  selectOpen(params: { conversationId?: string | null; conversationDocumentIds?: string[] } = {}): ContextRegistrySelection {
    const matchesScope = (record: { conversationId: string | null; conversationDocumentId: string | null }) =>
      (!params.conversationId && !params.conversationDocumentIds?.length) ||
      record.conversationId === params.conversationId ||
      (record.conversationDocumentId != null && (params.conversationDocumentIds ?? []).includes(record.conversationDocumentId));
    const contextDebtRecords = [...this.debtRecords.values()]
      .filter((record) => matchesScope(record) && !CONTEXT_DEBT_RESOLVED_STATUSES.has(record.status))
      .sort((left, right) => severityRank(right.severity) - severityRank(left.severity));
    const capabilityGapRecords = [...this.gapRecords.values()]
      .filter((record) => matchesScope(record) && !CAPABILITY_GAP_RESOLVED_STATUSES.has(record.status))
      .sort((left, right) => severityRank(right.severity) - severityRank(left.severity));
    const sourceCoverageRecords = [...this.coverageRecords.values()].filter((record) => matchesScope(record));

    return {
      contextDebtRecords,
      capabilityGapRecords,
      sourceCoverageRecords,
      traceEvents: [
        ...contextDebtRecords.map((record) =>
          traceDebt("context_debt_selected", record.debtKey, "Open context debt selected from in-memory registry.")
        ),
        ...capabilityGapRecords.map((record) =>
          traceGap("capability_gap_selected", record.gapKey, "Open capability gap selected from in-memory registry.")
        ),
      ],
    };
  }
}
