import type {
  ContextTransportDebugSnapshot,
  ContextTransportResult,
  MissingPayloadCapability,
} from "./adaptive-context-transport";
import {
  isCompletedSourceObservation,
  summarizeObservationEvidence,
} from "./source-observations";
import type {
  SourceObservation,
  SourceObservationGapHint,
  SourceObservationLocator,
  SourceObservationNeed,
  SourceObservationPayloadKind,
  SourceObservationProducerKind,
  SourceObservationTransportSelection,
  SourceObservationType,
} from "./source-observations";

type SourceObservationProducerAgentWorkPlan = {
  planId: string;
  traceId: string;
  conversationId?: string | null;
  messageId?: string | null;
  sourceNeeds: Array<{
    sourceId: string;
    state: SourceObservationNeed["state"] | "executed";
    coverageTarget?: string | null;
    reason: string;
    detail?: string | null;
  }>;
  capabilityNeeds: Array<{
    capability: string;
    state: SourceObservationNeed["state"] | "executed";
    payloadTypes: string[];
    reason: string;
  }>;
  modelCapabilityNeeds: Array<{
    capability: string;
    state: SourceObservationNeed["state"] | "executed";
    unavailablePayloadTypes: string[];
    reason: string;
  }>;
};

export const SOURCE_OBSERVATION_PRODUCER_RESULT_STATES = [
  "completed_with_evidence",
  "skipped",
  "unavailable",
  "missing",
  "catalog_only",
  "approval_required",
  "blocked_by_policy",
  "deferred",
  "failed",
] as const;

export type SourceObservationProducerResultState =
  (typeof SOURCE_OBSERVATION_PRODUCER_RESULT_STATES)[number];

export type SourceObservationProducerAvailability =
  | "available_read_only"
  | "catalog_only"
  | "unavailable"
  | "approval_required"
  | "blocked_by_policy"
  | "deferred";

export type SourceObservationProducerAvailabilitySource =
  | "producer_manifest"
  | "catalog"
  | "broker"
  | "model_manifest"
  | "runtime"
  | "transport"
  | "policy"
  | "approval"
  | "source_evidence"
  | "deterministic_producer"
  | "async";

export type SourceObservationProducerAvailabilitySignalStatus =
  | "available"
  | "catalog_only"
  | "unavailable"
  | "missing"
  | "approval_required"
  | "blocked_by_policy"
  | "deferred"
  | "unknown";

export type SourceObservationProducerAvailabilitySignal = {
  id: string;
  source: SourceObservationProducerAvailabilitySource;
  status: SourceObservationProducerAvailabilitySignalStatus;
  producerId?: string | null;
  capabilityId?: string | null;
  brokerCapabilityId?: string | null;
  payloadType?: string | null;
  payloadTypes?: string[];
  laneId?: string | null;
  laneIds?: string[];
  observationType?: string | null;
  observationTypes?: string[];
  sourceId?: string | null;
  conversationDocumentId?: string | null;
  runtimeExecutable?: boolean | null;
  modelSupported?: boolean | null;
  transportSupported?: boolean | null;
  evidenceAvailable?: boolean | null;
  deterministicEvidenceAvailable?: boolean | null;
  reason: string;
  evidenceSummary?: string | null;
  missingRequirements?: string[];
  approvalPath?: string | null;
  asyncRecommended?: boolean | null;
  noExecutionClaimed: true;
};

export type SourceObservationProducerAvailabilityContext = {
  traceId?: string | null;
  planId?: string | null;
  catalogCapabilities?: SourceObservationProducerAvailabilitySignal[];
  catalogLanes?: SourceObservationProducerAvailabilitySignal[];
  brokerCapabilities?: SourceObservationProducerAvailabilitySignal[];
  modelCapabilities?: SourceObservationProducerAvailabilitySignal[];
  runtimeSupport?: SourceObservationProducerAvailabilitySignal[];
  transportSupport?: SourceObservationProducerAvailabilitySignal[];
  policyConstraints?: SourceObservationProducerAvailabilitySignal[];
  approvalStates?: SourceObservationProducerAvailabilitySignal[];
  sourceEvidence?: SourceObservationProducerAvailabilitySignal[];
  deterministicEvidence?: SourceObservationProducerAvailabilitySignal[];
  asyncSuitability?: SourceObservationProducerAvailabilitySignal[];
  noExecutionClaimed: true;
};

export type SourceObservationProducerCapability = {
  capabilityId: string;
  brokerCapabilityId?: string | null;
  payloadTypes: string[];
  currentAvailability: SourceObservationProducerAvailability;
  reason?: string | null;
};

export type SourceObservationProducerInput = {
  payloadType?: string | null;
  sourceKind?: string | null;
  locator?: SourceObservationLocator | null;
  sourceObservationNeedId?: string | null;
  transportRequirementId?: string | null;
  evidenceObservationIds?: string[];
  metadata?: Record<string, unknown> | null;
};

export type SourceObservationProducerOutput = {
  observationIds: string[];
  payloadKinds: SourceObservationPayloadKind[];
  evidenceSummary: string;
  metadata?: Record<string, unknown> | null;
};

export type SourceObservationProducerManifest = {
  producerId: string;
  capabilityId: string;
  producerKind: SourceObservationProducerKind;
  acceptedSourceKinds: string[];
  requiredInputLanes: string[];
  producedObservationTypes: Array<SourceObservationType | string>;
  producedPayloadKinds: string[];
  producedPayloadTypes: string[];
  modelRequirements: string[];
  toolRequirements: string[];
  laneRequirements: string[];
  approvalRequired: boolean;
  policyDataClass: "none" | "tenant_source" | "connector_source" | "external_execution";
  sideEffects: "none" | "read_current_evidence" | "external_read" | "external_write";
  costEstimate: "none" | "low" | "medium" | "high";
  latencyEstimate: "in_memory" | "short" | "long_running";
  currentAvailability: SourceObservationProducerAvailability;
  reasonUnavailable?: string | null;
  executionEvidenceRequirement: string;
  canonicalCatalogIds: {
    payloadTypes: string[];
    laneIds: string[];
    toolIds: string[];
    capabilityIds: string[];
  };
  noUnavailableToolExecutionClaimed: true;
};

export type SourceObservationProducerRequestPriority = "low" | "normal" | "high" | "critical";

export type SourceObservationProducerRequest = {
  id: string;
  traceId?: string | null;
  planId?: string | null;
  conversationId?: string | null;
  messageId?: string | null;
  conversationDocumentId?: string | null;
  sourceId?: string | null;
  sourceKind?: string | null;
  sourceLocator?: SourceObservationLocator | null;
  requestedObservationType: SourceObservationType | string;
  requestedCapabilityId: string;
  requestedPayloadType?: string | null;
  reason: string;
  priority: SourceObservationProducerRequestPriority;
  severity?: "low" | "medium" | "high" | "critical";
  sourceNeedId?: string | null;
  workPlanDecisionId?: string | null;
  transportLaneNeed?: string | null;
  approvalPath?: string | null;
  producerId?: string | null;
  input?: SourceObservationProducerInput | null;
  noExecutionClaimed: true;
};

export type SourceObservationProducerResolution = {
  state: SourceObservationProducerResultState;
  producerId: string | null;
  capabilityId: string;
  payloadType?: string | null;
  governedBy: string[];
  availabilitySources: SourceObservationProducerAvailabilitySource[];
  primaryAvailabilitySource: SourceObservationProducerAvailabilitySource;
  availabilityDetails: SourceObservationProducerAvailabilitySignal[];
  catalogPayloadType?: string | null;
  catalogLaneId?: string | null;
  brokerCapabilityId?: string | null;
  executableNow: boolean;
  reason: string;
  evidenceSummary?: string | null;
  missingRequirements: string[];
  approvalPath?: string | null;
  sourceLocator?: SourceObservationLocator | null;
  traceId?: string | null;
  planId?: string | null;
  requiresApproval: boolean;
  blockedByPolicy: boolean;
  asyncRecommended: boolean;
  asyncSuitability?: {
    recommended: boolean;
    reason?: string | null;
  } | null;
  noExecutionClaimed: true;
};

export type SourceObservationProducerResult = {
  requestId: string;
  request: SourceObservationProducerRequest;
  producerId: string | null;
  capabilityId: string;
  state: SourceObservationProducerResultState;
  resolution: SourceObservationProducerResolution;
  observations: SourceObservation[];
  observationIds: string[];
  output: SourceObservationProducerOutput | null;
  unresolvedNeeds: SourceObservationNeed[];
  evidence: {
    summary: string;
    observationIds: string[];
    sourceIds: string[];
    locator?: SourceObservationLocator | null;
    noUnavailableToolExecutionClaimed: true;
  } | null;
  reason: string;
  recommendedResolution?: string | null;
  requiresApproval: boolean;
  asyncRecommended: boolean;
  noExecutionClaimed: true;
};

export type SourceObservationProducerDebugSummary = {
  producerRequestCount: number;
  resultCount: number;
  completedWithEvidenceCount: number;
  countsByState: Record<string, number>;
  countsByProducerId: Record<string, number>;
  countsByCapabilityId: Record<string, number>;
  countsByRequestedObservationType: Record<string, number>;
  availability: {
    sourcesConsulted: SourceObservationProducerAvailabilitySource[];
    countsByAvailabilitySource: Record<string, number>;
    runtimeExecutableCount: number;
    runtimeUnsupportedCount: number;
    modelLaneSupportedButRuntimeMissingCount: number;
    sourceEvidenceAvailableCount: number;
    deterministicEvidenceAvailableCount: number;
    noExecutionWarningCount: number;
  };
  nativeFileLane: {
    plannedCount: number;
    supportedCount: number;
    unavailableCount: number;
    catalogOnlyCount: number;
  };
  tableBodyRecovery: {
    requestedCount: number;
    attemptedDeterministicCount: number;
    completedCount: number;
    unavailableCount: number;
  };
  missingProducerNeedCount: number;
  durableGapDebtCandidateCount: number;
  sourceDocumentAttributionCount: number;
  ambiguousAttributionCount: number;
  selectedForTransportCount: number;
  cappedOrDroppedCount: number;
  reusedCatalogIdentifierCount: number;
  newlyIntroducedIdentifierCount: number;
  reusedCatalogIdentifiers: string[];
  newIdentifiers: string[];
  missingProducerNeeds: Array<{
    requestId: string;
    producerId: string | null;
    capabilityId: string;
    payloadType: string | null;
    state: SourceObservationProducerResultState;
    reason: string;
  }>;
  noUnavailableToolExecutionClaimed: true;
};

const CANONICAL_PAYLOAD_ALIASES = new Map<string, string>([
  ["table_body", "structured_table"],
  ["table_body_recovery", "structured_table"],
  ["table_extraction", "structured_table"],
  ["structured_table_observation", "structured_table"],
  ["native_file", "native_file_reference"],
  ["uploaded_file_reference", "native_file_reference"],
  ["connector_file_reference", "native_file_reference"],
  ["connector_snapshot", "native_file_reference"],
  ["connector_file_snapshot", "native_file_reference"],
  ["rendered_page", "rendered_page_image"],
  ["page_image", "rendered_page_image"],
  ["page_crop", "page_crop_image"],
  ["ocr", "ocr_text"],
  ["vision", "vision_observation"],
  ["model_vision_result", "vision_observation"],
  ["document_ai", "document_ai_result"],
  ["spreadsheet_profile", "spreadsheet_range"],
  ["python_analysis_result", "code_analysis_result"],
]);

const PAYLOAD_TO_OBSERVATION_TYPE: Record<string, SourceObservationType | string> = {
  source_observation: "source_coverage_signal",
  text_excerpt: "chunk_excerpt",
  structured_table: "structured_table_observation",
  rendered_page_image: "rendered_page_image",
  page_crop_image: "page_crop_image",
  native_file_reference: "connector_file_snapshot",
  ocr_text: "ocr_text",
  vision_observation: "vision_observation",
  document_ai_result: "document_ai_result",
  spreadsheet_range: "spreadsheet_range",
  spreadsheet_formula_map: "spreadsheet_formula_map",
  code_analysis_result: "python_analysis_result_future",
};

const PAYLOAD_TO_CAPABILITY: Record<string, string> = {
  source_observation: "source_observation_reuse",
  text_excerpt: "text_extraction",
  structured_table: "document_ai_table_recovery",
  rendered_page_image: "rendered_page_inspection",
  page_crop_image: "rendered_page_inspection",
  native_file_reference: "source_connector_read",
  ocr_text: "ocr",
  vision_observation: "vision_page_understanding",
  document_ai_result: "document_ai_table_recovery",
  spreadsheet_range: "spreadsheet_inventory",
  spreadsheet_formula_map: "spreadsheet_formula_map",
  code_analysis_result: "code_repository_inspection",
};

const PAYLOAD_TO_PRODUCER: Record<string, string> = {
  source_observation: "source_observation_reuse",
  text_excerpt: "parser_text_extraction",
  structured_table: "document_ai_table_extractor",
  rendered_page_image: "rendered_page_renderer",
  page_crop_image: "rendered_page_renderer",
  native_file_reference: "sharepoint_file_connector",
  ocr_text: "ocr_extractor",
  vision_observation: "model_vision_inspector",
  document_ai_result: "document_ai_table_extractor",
  spreadsheet_range: "spreadsheet_range_reader",
  spreadsheet_formula_map: "spreadsheet_range_reader",
  code_analysis_result: "code_repository_inspection",
};

const PAYLOAD_TO_LANE: Record<string, string> = {
  source_observation: "memory_reuse_lane",
  text_excerpt: "a03_text_packing_lane",
  structured_table: "document_ai_table_lane",
  rendered_page_image: "rendered_page_image_lane",
  page_crop_image: "rendered_page_image_lane",
  native_file_reference: "native_file_reference_lane",
  ocr_text: "ocr_text_lane",
  vision_observation: "vision_observation_lane",
  document_ai_result: "document_ai_table_lane",
};

const CURRENT_EVIDENCE_PRODUCER_IDS = new Set([
  "parser_text_extraction",
  "pdf_context_extraction",
  "spreadsheet_range_reader",
  "existing_parser_text_extraction",
  "source_observation_reuse",
]);

const CATALOG_ONLY_PAYLOAD_TYPES = new Set([
  "native_file_reference",
  "spreadsheet_range",
  "spreadsheet_formula_map",
]);

const UNAVAILABLE_PAYLOAD_TYPES = new Set([
  "ocr_text",
  "vision_observation",
  "rendered_page_image",
  "page_crop_image",
  "document_ai_result",
  "code_analysis_result",
]);

const CANONICAL_IDENTIFIER_SET = new Set([
  ...Object.keys(PAYLOAD_TO_OBSERVATION_TYPE),
  ...Object.values(PAYLOAD_TO_CAPABILITY),
  ...Object.values(PAYLOAD_TO_PRODUCER),
  ...Object.values(PAYLOAD_TO_LANE),
  "pdf_table_body_recovery",
  "pdf_context_extraction",
  "pdf_text_extraction",
  "spreadsheet_inventory",
  "spreadsheet_range_reader",
  "existing_parser_text_extraction",
]);

export const DEFAULT_SOURCE_OBSERVATION_PRODUCER_MANIFESTS: SourceObservationProducerManifest[] = [
  {
    producerId: "parser_text_extraction",
    capabilityId: "text_extraction",
    producerKind: "parser",
    acceptedSourceKinds: ["uploaded_document", "parsed_document", "pdf_page"],
    requiredInputLanes: ["a03_text_packing_lane"],
    producedObservationTypes: ["chunk_excerpt", "document_text", "table_signal", "parser_text_excerpt"],
    producedPayloadKinds: ["text", "warning"],
    producedPayloadTypes: ["text_excerpt", "source_observation"],
    modelRequirements: [],
    toolRequirements: ["parser_text_extraction"],
    laneRequirements: ["a03_text_packing_lane"],
    approvalRequired: false,
    policyDataClass: "tenant_source",
    sideEffects: "read_current_evidence",
    costEstimate: "none",
    latencyEstimate: "in_memory",
    currentAvailability: "available_read_only",
    executionEvidenceRequirement: "Existing parser/chunk evidence must already be loaded for the current resolver pass.",
    canonicalCatalogIds: {
      payloadTypes: ["text_excerpt", "source_observation"],
      laneIds: ["a03_text_packing_lane"],
      toolIds: ["parser_text_extraction", "existing_parser_text_extraction"],
      capabilityIds: ["text_extraction"],
    },
    noUnavailableToolExecutionClaimed: true,
  },
  {
    producerId: "source_observation_reuse",
    capabilityId: "source_observation_reuse",
    producerKind: "system",
    acceptedSourceKinds: ["system_derived", "artifact_reference", "uploaded_document", "parsed_document"],
    requiredInputLanes: ["memory_reuse_lane"],
    producedObservationTypes: ["source_coverage_signal", "artifact_reference", "extraction_warning"],
    producedPayloadKinds: ["structured", "artifact_reference", "warning"],
    producedPayloadTypes: ["source_observation"],
    modelRequirements: [],
    toolRequirements: ["source_observation_reuse"],
    laneRequirements: ["memory_reuse_lane"],
    approvalRequired: false,
    policyDataClass: "tenant_source",
    sideEffects: "read_current_evidence",
    costEstimate: "none",
    latencyEstimate: "in_memory",
    currentAvailability: "available_read_only",
    executionEvidenceRequirement: "Completed SourceObservations must already exist in resolver-owned evidence.",
    canonicalCatalogIds: {
      payloadTypes: ["source_observation"],
      laneIds: ["memory_reuse_lane"],
      toolIds: ["source_observation_reuse"],
      capabilityIds: ["source_observation_reuse"],
    },
    noUnavailableToolExecutionClaimed: true,
  },
  {
    producerId: "existing_parser_text_extraction",
    capabilityId: "pdf_table_body_recovery",
    producerKind: "document_intelligence",
    acceptedSourceKinds: ["uploaded_document", "parsed_document", "pdf_page"],
    requiredInputLanes: ["a03_text_packing_lane", "document_ai_table_lane"],
    producedObservationTypes: ["structured_table_observation", "table_signal", "table_structure_hint"],
    producedPayloadKinds: ["table", "structured", "warning"],
    producedPayloadTypes: ["structured_table", "source_observation"],
    modelRequirements: [],
    toolRequirements: ["existing_parser_text_extraction", "parser_text_extraction"],
    laneRequirements: ["document_ai_table_lane"],
    approvalRequired: false,
    policyDataClass: "tenant_source",
    sideEffects: "read_current_evidence",
    costEstimate: "none",
    latencyEstimate: "in_memory",
    currentAvailability: "available_read_only",
    executionEvidenceRequirement:
      "A structured_table_observation from current parser/document-intelligence evidence must exist before completion.",
    canonicalCatalogIds: {
      payloadTypes: ["structured_table", "source_observation"],
      laneIds: ["document_ai_table_lane"],
      toolIds: ["existing_parser_text_extraction", "parser_text_extraction"],
      capabilityIds: ["pdf_table_body_recovery", "document_ai_table_recovery"],
    },
    noUnavailableToolExecutionClaimed: true,
  },
];

function normalizePayloadType(value: string | null | undefined) {
  if (!value) return null;
  return CANONICAL_PAYLOAD_ALIASES.get(value) ?? value;
}

function increment(record: Record<string, number>, key: string | null | undefined) {
  const normalized = key?.trim() || "unknown";
  record[normalized] = (record[normalized] ?? 0) + 1;
}

function stableSegment(value: string | number | boolean | null | undefined) {
  return String(value ?? "none")
    .replace(/[^a-zA-Z0-9:_-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80) || "none";
}

function locatorKey(locator: SourceObservationLocator | null | undefined) {
  if (!locator) return "none";
  return [
    locator.pageNumberStart ?? locator.page ?? "no-page",
    locator.tableId ?? "no-table",
    locator.sheetName ?? "no-sheet",
    locator.rowRange ? `${locator.rowRange.start}-${locator.rowRange.end}` : "no-rows",
    locator.chunkId ?? locator.chunkIndex ?? "no-chunk",
  ].map(stableSegment).join(":");
}

function uniqueById<T extends { id: string }>(items: T[]) {
  const seen = new Set<string>();
  const result: T[] = [];
  for (const item of items) {
    if (seen.has(item.id)) continue;
    seen.add(item.id);
    result.push(item);
  }
  return result;
}

function uniqueStrings(values: Array<string | null | undefined>) {
  return Array.from(new Set(values.filter((value): value is string => Boolean(value))));
}

function toSourceObservationNeedState(
  state: SourceObservationNeed["state"] | "executed"
): SourceObservationNeed["state"] {
  return state === "executed" ? "unavailable" : state;
}

function payloadTypeToObservationType(payloadType: string | null | undefined) {
  const canonical = normalizePayloadType(payloadType);
  return canonical ? PAYLOAD_TO_OBSERVATION_TYPE[canonical] ?? canonical : "source_coverage_signal";
}

function payloadTypeToCapability(payloadType: string | null | undefined) {
  const canonical = normalizePayloadType(payloadType);
  return canonical ? PAYLOAD_TO_CAPABILITY[canonical] ?? canonical : "source_observation_reuse";
}

function payloadTypeToProducer(payloadType: string | null | undefined) {
  const canonical = normalizePayloadType(payloadType);
  return canonical ? PAYLOAD_TO_PRODUCER[canonical] ?? "source_observation_reuse" : "source_observation_reuse";
}

function payloadTypeToLane(payloadType: string | null | undefined) {
  const canonical = normalizePayloadType(payloadType);
  return canonical ? PAYLOAD_TO_LANE[canonical] ?? canonical : null;
}

function buildRequestId(params: {
  traceId?: string | null;
  planId?: string | null;
  sourceId?: string | null;
  producerId?: string | null;
  capabilityId: string;
  payloadType?: string | null;
  observationType: string;
  locator?: SourceObservationLocator | null;
}) {
  return [
    "source-observation-producer-request",
    stableSegment(params.traceId ?? params.planId),
    stableSegment(params.sourceId),
    stableSegment(params.producerId),
    stableSegment(params.capabilityId),
    stableSegment(params.payloadType),
    stableSegment(params.observationType),
    locatorKey(params.locator),
  ].join(":");
}

function buildRequest(params: {
  traceId?: string | null;
  planId?: string | null;
  conversationId?: string | null;
  messageId?: string | null;
  conversationDocumentId?: string | null;
  sourceId?: string | null;
  sourceKind?: string | null;
  sourceLocator?: SourceObservationLocator | null;
  requestedObservationType: SourceObservationType | string;
  requestedCapabilityId: string;
  requestedPayloadType?: string | null;
  reason: string;
  priority?: SourceObservationProducerRequestPriority;
  severity?: SourceObservationProducerRequest["severity"];
  sourceNeedId?: string | null;
  workPlanDecisionId?: string | null;
  transportLaneNeed?: string | null;
  approvalPath?: string | null;
  producerId?: string | null;
  input?: SourceObservationProducerInput | null;
}): SourceObservationProducerRequest {
  const payloadType = normalizePayloadType(params.requestedPayloadType);
  const producerId = params.producerId ?? payloadTypeToProducer(payloadType);
  const request = {
    id: buildRequestId({
      traceId: params.traceId,
      planId: params.planId,
      sourceId: params.sourceId,
      producerId,
      capabilityId: params.requestedCapabilityId,
      payloadType,
      observationType: params.requestedObservationType,
      locator: params.sourceLocator,
    }),
    traceId: params.traceId ?? null,
    planId: params.planId ?? null,
    conversationId: params.conversationId ?? null,
    messageId: params.messageId ?? null,
    conversationDocumentId: params.conversationDocumentId ?? null,
    sourceId: params.sourceId ?? null,
    sourceKind: params.sourceKind ?? null,
    sourceLocator: params.sourceLocator ?? null,
    requestedObservationType: params.requestedObservationType,
    requestedCapabilityId: params.requestedCapabilityId,
    requestedPayloadType: payloadType,
    reason: params.reason,
    priority: params.priority ?? "normal",
    severity: params.severity ?? "medium",
    sourceNeedId: params.sourceNeedId ?? null,
    workPlanDecisionId: params.workPlanDecisionId ?? null,
    transportLaneNeed: params.transportLaneNeed ?? null,
    approvalPath: params.approvalPath ?? null,
    producerId,
    input: params.input ?? null,
    noExecutionClaimed: true,
  } satisfies SourceObservationProducerRequest;
  return request;
}

function requestFromNeed(params: {
  need: SourceObservationNeed;
  traceId?: string | null;
  planId?: string | null;
  conversationId?: string | null;
  messageId?: string | null;
}) {
  const payloadType = normalizePayloadType(params.need.payloadType ?? params.need.observationType);
  const observationType = payloadTypeToObservationType(payloadType);
  const capability = params.need.capability ?? payloadTypeToCapability(payloadType);
  return buildRequest({
    traceId: params.traceId,
    planId: params.planId,
    conversationId: params.conversationId,
    messageId: params.messageId,
    conversationDocumentId: params.need.conversationDocumentId ?? null,
    sourceId: params.need.sourceId ?? null,
    requestedObservationType: observationType,
    requestedCapabilityId: capability,
    requestedPayloadType: payloadType,
    reason: params.need.reason,
    priority: params.need.state === "approval_required" || params.need.state === "unavailable" ? "high" : "normal",
    sourceNeedId: params.need.id,
    approvalPath: params.need.state === "approval_required" ? `source_observation_need:${params.need.id}` : null,
    input: {
      payloadType,
      sourceObservationNeedId: params.need.id,
      metadata: {
        sourceObservationNeedState: params.need.state,
      },
    },
  });
}

export function buildProducerRequestsFromSourceObservationNeeds(params: {
  needs?: SourceObservationNeed[] | null;
  traceId?: string | null;
  planId?: string | null;
  conversationId?: string | null;
  messageId?: string | null;
}): SourceObservationProducerRequest[] {
  return uniqueById(
    (params.needs ?? []).map((need) =>
      requestFromNeed({
        need,
        traceId: params.traceId,
        planId: params.planId,
        conversationId: params.conversationId,
        messageId: params.messageId,
      })
    )
  );
}

export function buildProducerRequestsFromAgentWorkPlan(params: {
  agentWorkPlan?: SourceObservationProducerAgentWorkPlan | null;
  sourceObservationNeeds?: SourceObservationNeed[] | null;
}): SourceObservationProducerRequest[] {
  if (!params.agentWorkPlan) return [];
  const workPlan = params.agentWorkPlan;
  const needs = [
    ...(params.sourceObservationNeeds ?? []),
    ...workPlan.sourceNeeds
      .filter((need) => need.state !== "executed" && need.state !== "planned")
      .map((need) => ({
        id: `agent-work-plan:source:${need.sourceId}:${need.coverageTarget}`,
        observationType: "source_coverage_signal",
        sourceId: need.sourceId,
        capability: null,
        payloadType: "source_observation",
        state: toSourceObservationNeedState(need.state),
        reason: need.detail ?? need.reason,
        noExecutionClaimed: true,
      } satisfies SourceObservationNeed)),
    ...workPlan.capabilityNeeds
      .filter((need) => need.state !== "executed")
      .flatMap((need) =>
        need.payloadTypes.map((payloadType) => ({
          id: `agent-work-plan:capability:${need.capability}:${payloadType}`,
          observationType: payloadTypeToObservationType(payloadType),
          sourceId: null,
          capability: need.capability,
          payloadType,
          state: toSourceObservationNeedState(need.state),
          reason: need.reason,
          noExecutionClaimed: true,
        } satisfies SourceObservationNeed))
      ),
    ...workPlan.modelCapabilityNeeds
      .filter((need) => need.state !== "executed")
      .flatMap((need) =>
        need.unavailablePayloadTypes.map((payloadType) => ({
          id: `agent-work-plan:model:${need.capability}:${payloadType}`,
          observationType: payloadTypeToObservationType(payloadType),
          sourceId: null,
          capability: need.capability,
          payloadType,
          state: toSourceObservationNeedState(need.state),
          reason: need.reason,
          noExecutionClaimed: true,
        } satisfies SourceObservationNeed))
      ),
  ];
  return buildProducerRequestsFromSourceObservationNeeds({
    needs,
    traceId: workPlan.traceId,
    planId: workPlan.planId,
    conversationId: workPlan.conversationId,
    messageId: workPlan.messageId ?? null,
  });
}

function tableLocatorFromGap(gap: SourceObservationGapHint, fallback: SourceObservation) {
  return gap.locator ?? fallback.sourceLocator ?? null;
}

function hasTableBodyGap(observation: SourceObservation) {
  return (observation.relatedGapHints ?? []).some((gap) =>
    gap.kind === "missing_table_body" ||
    gap.payloadType === "structured_table" ||
    gap.capability === "document_ai_table_recovery"
  );
}

export function buildProducerRequestsFromTableSignals(params: {
  observations?: SourceObservation[] | null;
  traceId?: string | null;
  planId?: string | null;
  conversationId?: string | null;
  messageId?: string | null;
}): SourceObservationProducerRequest[] {
  const requests: SourceObservationProducerRequest[] = [];
  for (const observation of params.observations ?? []) {
    if (
      observation.type !== "table_signal" &&
      observation.type !== "table_structure_hint" &&
      observation.type !== "extraction_warning" &&
      !hasTableBodyGap(observation)
    ) {
      continue;
    }
    const tableGap =
      (observation.relatedGapHints ?? []).find((gap) => gap.kind === "missing_table_body") ?? null;
    const locator = tableGap ? tableLocatorFromGap(tableGap, observation) : observation.sourceLocator;
    const reason =
      tableGap?.reason ??
      (observation.type === "extraction_warning"
        ? observation.content
        : "Table signal requires governed table-body recovery before table cells can be claimed.");
    requests.push(buildRequest({
      traceId: params.traceId ?? observation.traceId ?? null,
      planId: params.planId ?? observation.planId ?? null,
      conversationId: params.conversationId ?? observation.conversationId ?? null,
      messageId: params.messageId ?? observation.messageId ?? null,
      conversationDocumentId: observation.conversationDocumentId ?? observation.sourceDocumentId ?? null,
      sourceId: tableGap?.sourceId ?? observation.sourceId ?? observation.sourceDocumentId ?? null,
      sourceKind: observation.sourceKind,
      sourceLocator: locator,
      requestedObservationType: "structured_table_observation",
      requestedCapabilityId: "pdf_table_body_recovery",
      requestedPayloadType: "structured_table",
      reason,
      priority: "high",
      severity: "high",
      producerId: "existing_parser_text_extraction",
      input: {
        payloadType: "structured_table",
        locator,
        evidenceObservationIds: [observation.id],
        metadata: {
          triggeringObservationId: observation.id,
          triggeringObservationType: observation.type,
          reusedDocumentIntelligenceFallback: true,
        },
      },
    }));
  }
  return uniqueById(requests);
}

function transportSnapshot(
  transport: ContextTransportResult | ContextTransportDebugSnapshot | null | undefined
): ContextTransportDebugSnapshot | null {
  if (!transport) return null;
  return "debugSnapshot" in transport ? transport.debugSnapshot : transport;
}

export function buildProducerRequestsFromTransportNeeds(params: {
  transport?: ContextTransportResult | ContextTransportDebugSnapshot | null;
  traceId?: string | null;
  planId?: string | null;
  conversationId?: string | null;
  messageId?: string | null;
}): SourceObservationProducerRequest[] {
  const snapshot = transportSnapshot(params.transport);
  if (!snapshot) return [];
  const fromMissing = snapshot.missingPayloadCapabilities.map((missing: MissingPayloadCapability) => {
    const payloadType = normalizePayloadType(missing.payloadType);
    return buildRequest({
      traceId: params.traceId ?? snapshot.agentWorkPlanTraceId ?? null,
      planId: params.planId ?? snapshot.agentWorkPlanId ?? null,
      conversationId: params.conversationId,
      messageId: params.messageId,
      sourceId: missing.sourceId ?? null,
      requestedObservationType: payloadTypeToObservationType(payloadType),
      requestedCapabilityId: payloadTypeToCapability(payloadType),
      requestedPayloadType: payloadType,
      reason: missing.reason,
      priority: missing.requiresApproval ? "critical" : missing.asyncRecommended ? "high" : "normal",
      transportLaneNeed: missing.id,
      approvalPath: missing.requiresApproval ? `transport_payload:${payloadType}` : null,
      input: {
        payloadType,
        transportRequirementId: missing.id,
        metadata: {
          transportPlanId: snapshot.planId,
          missingPayloadCapabilityId: missing.id,
        },
      },
    });
  });
  const fromLaneProposals = snapshot.missingContextLaneProposals.map((proposal) => {
    const payloadType = normalizePayloadType(proposal.missingPayloadType);
    return buildRequest({
      traceId: params.traceId ?? snapshot.agentWorkPlanTraceId ?? null,
      planId: params.planId ?? snapshot.agentWorkPlanId ?? null,
      conversationId: params.conversationId,
      messageId: params.messageId,
      requestedObservationType: payloadTypeToObservationType(payloadType),
      requestedCapabilityId: payloadTypeToCapability(payloadType),
      requestedPayloadType: payloadType,
      reason: proposal.reason,
      priority: proposal.boundary === "future_tool_boundary" ? "high" : "normal",
      transportLaneNeed: proposal.id,
      input: {
        payloadType,
        metadata: {
          transportPlanId: snapshot.planId,
          missingContextLaneProposalId: proposal.id,
          candidateContextLanes: proposal.candidateContextLanes,
        },
      },
    });
  });
  return uniqueById([...fromMissing, ...fromLaneProposals]);
}

function availabilityStatusFromProducerAvailability(
  availability: SourceObservationProducerAvailability | null | undefined
): SourceObservationProducerAvailabilitySignalStatus {
  if (availability === "available_read_only") return "available";
  return availability ?? "unknown";
}

function observationTypeToPayloadType(type: string | null | undefined) {
  switch (type) {
    case "structured_table_observation":
      return "structured_table";
    case "rendered_page_image":
      return "rendered_page_image";
    case "page_crop_image":
      return "page_crop_image";
    case "ocr_text":
      return "ocr_text";
    case "vision_observation":
      return "vision_observation";
    case "document_ai_result":
      return "document_ai_result";
    case "spreadsheet_range":
      return "spreadsheet_range";
    case "spreadsheet_formula_map":
      return "spreadsheet_formula_map";
    case "connector_file_snapshot":
      return "native_file_reference";
    case "chunk_excerpt":
    case "document_text":
    case "parser_text_excerpt":
    case "extracted_text_chunk":
      return "text_excerpt";
    default:
      return "source_observation";
  }
}

function availabilitySignal(params: {
  id?: string | null;
  source: SourceObservationProducerAvailabilitySource;
  status: SourceObservationProducerAvailabilitySignalStatus;
  producerId?: string | null;
  capabilityId?: string | null;
  brokerCapabilityId?: string | null;
  payloadType?: string | null;
  payloadTypes?: string[];
  laneId?: string | null;
  laneIds?: string[];
  observationType?: string | null;
  observationTypes?: string[];
  sourceId?: string | null;
  conversationDocumentId?: string | null;
  runtimeExecutable?: boolean | null;
  modelSupported?: boolean | null;
  transportSupported?: boolean | null;
  evidenceAvailable?: boolean | null;
  deterministicEvidenceAvailable?: boolean | null;
  reason: string;
  evidenceSummary?: string | null;
  missingRequirements?: string[];
  approvalPath?: string | null;
  asyncRecommended?: boolean | null;
}): SourceObservationProducerAvailabilitySignal {
  return {
    id: params.id ?? [
      "availability",
      params.source,
      stableSegment(params.producerId ?? params.capabilityId ?? params.payloadType ?? params.laneId),
      stableSegment(params.sourceId ?? params.conversationDocumentId),
      stableSegment(params.status),
    ].join(":"),
    source: params.source,
    status: params.status,
    producerId: params.producerId ?? null,
    capabilityId: params.capabilityId ?? null,
    brokerCapabilityId: params.brokerCapabilityId ?? null,
    payloadType: normalizePayloadType(params.payloadType),
    payloadTypes: uniqueStrings((params.payloadTypes ?? []).map(normalizePayloadType)),
    laneId: params.laneId ?? null,
    laneIds: uniqueStrings(params.laneIds ?? []),
    observationType: params.observationType ?? null,
    observationTypes: uniqueStrings(params.observationTypes ?? []),
    sourceId: params.sourceId ?? null,
    conversationDocumentId: params.conversationDocumentId ?? null,
    runtimeExecutable: params.runtimeExecutable ?? null,
    modelSupported: params.modelSupported ?? null,
    transportSupported: params.transportSupported ?? null,
    evidenceAvailable: params.evidenceAvailable ?? null,
    deterministicEvidenceAvailable: params.deterministicEvidenceAvailable ?? null,
    reason: params.reason,
    evidenceSummary: params.evidenceSummary ?? null,
    missingRequirements: uniqueStrings(params.missingRequirements ?? []),
    approvalPath: params.approvalPath ?? null,
    asyncRecommended: params.asyncRecommended ?? null,
    noExecutionClaimed: true,
  };
}

function transportMissingSignalStatus(missing: MissingPayloadCapability): SourceObservationProducerAvailabilitySignalStatus {
  if (missing.requiresApproval) return "approval_required";
  if (missing.asyncRecommended) return "deferred";
  return "unavailable";
}

function laneProposalSignalStatus(status: string): SourceObservationProducerAvailabilitySignalStatus {
  if (status === "unsupported" || status === "known_missing") return "unavailable";
  return "catalog_only";
}

export function buildSourceObservationProducerAvailabilitySnapshot(params: {
  requests?: SourceObservationProducerRequest[] | null;
  observations?: SourceObservation[] | null;
  transport?: ContextTransportResult | ContextTransportDebugSnapshot | null;
  manifests?: SourceObservationProducerManifest[] | null;
  traceId?: string | null;
  planId?: string | null;
}): SourceObservationProducerAvailabilityContext {
  const transport = transportSnapshot(params.transport);
  const manifests = params.manifests ?? DEFAULT_SOURCE_OBSERVATION_PRODUCER_MANIFESTS;
  const catalogCapabilities = manifests.map((manifest) =>
    availabilitySignal({
      id: `producer-manifest:${manifest.producerId}:catalog-capability`,
      source: "catalog",
      status: "available",
      producerId: manifest.producerId,
      capabilityId: manifest.capabilityId,
      payloadTypes: manifest.canonicalCatalogIds.payloadTypes,
      laneIds: manifest.canonicalCatalogIds.laneIds,
      reason: "Producer capability is declared in the SourceObservation producer manifest.",
      asyncRecommended: manifest.latencyEstimate === "long_running",
    })
  );
  const catalogLanes = manifests.flatMap((manifest) =>
    manifest.canonicalCatalogIds.laneIds.map((laneId) =>
      availabilitySignal({
        id: `producer-manifest:${manifest.producerId}:catalog-lane:${laneId}`,
        source: "catalog",
        status: "available",
        producerId: manifest.producerId,
        capabilityId: manifest.capabilityId,
        laneId,
        payloadTypes: manifest.canonicalCatalogIds.payloadTypes,
        reason: "Catalog lane is declared for producer planning; this does not imply runtime execution.",
      })
    )
  );
  const brokerCapabilities = manifests.flatMap((manifest) =>
    manifest.toolRequirements.map((toolId) =>
      availabilitySignal({
        id: `producer-manifest:${manifest.producerId}:broker:${toolId}`,
        source: "broker",
        status: availabilityStatusFromProducerAvailability(manifest.currentAvailability),
        producerId: manifest.producerId,
        capabilityId: manifest.capabilityId,
        brokerCapabilityId: toolId,
        payloadTypes: manifest.producedPayloadTypes,
        runtimeExecutable:
          manifest.currentAvailability === "available_read_only" &&
          CURRENT_EVIDENCE_PRODUCER_IDS.has(manifest.producerId),
        reason: manifest.reasonUnavailable ?? manifest.executionEvidenceRequirement,
      })
    )
  );
  const runtimeSupport = manifests.map((manifest) =>
    availabilitySignal({
      id: `producer-manifest:${manifest.producerId}:runtime`,
      source: "runtime",
      status: availabilityStatusFromProducerAvailability(manifest.currentAvailability),
      producerId: manifest.producerId,
      capabilityId: manifest.capabilityId,
      payloadTypes: manifest.producedPayloadTypes,
      laneIds: manifest.laneRequirements,
      runtimeExecutable:
        manifest.currentAvailability === "available_read_only" &&
        CURRENT_EVIDENCE_PRODUCER_IDS.has(manifest.producerId),
      reason:
        manifest.currentAvailability === "available_read_only"
          ? manifest.executionEvidenceRequirement
          : manifest.reasonUnavailable ?? "Producer is not executable in the current runtime.",
      asyncRecommended: manifest.latencyEstimate === "long_running",
    })
  );

  const transportSupport: SourceObservationProducerAvailabilitySignal[] = [];
  if (transport) {
    for (const missing of transport.missingPayloadCapabilities) {
      transportSupport.push(availabilitySignal({
        id: `transport:${transport.planId}:missing:${missing.id}`,
        source: "transport",
        status: transportMissingSignalStatus(missing),
        capabilityId: missing.neededCapability,
        payloadType: missing.payloadType,
        sourceId: missing.sourceId,
        transportSupported: false,
        runtimeExecutable: false,
        reason: missing.reason,
        missingRequirements: [missing.neededCapability, ...missing.candidateToolIds],
        approvalPath: missing.requiresApproval ? `transport_payload:${missing.payloadType}` : null,
        asyncRecommended: missing.asyncRecommended,
      }));
    }
    for (const proposal of transport.missingContextLaneProposals) {
      transportSupport.push(availabilitySignal({
        id: `transport:${transport.planId}:lane:${proposal.id}`,
        source: "transport",
        status: laneProposalSignalStatus(proposal.status),
        capabilityId: proposal.associatedCapabilities[0] ?? null,
        payloadType: proposal.missingPayloadType,
        laneIds: proposal.candidateContextLanes,
        transportSupported: false,
        runtimeExecutable: false,
        reason: proposal.reason,
        missingRequirements: proposal.associatedCapabilities,
        asyncRecommended: proposal.boundary === "future_tool_boundary",
      }));
    }
  }

  const modelCapabilities: SourceObservationProducerAvailabilitySignal[] = [];
  const modelManifest = transport?.modelCapabilityManifestUsed ?? null;
  if (modelManifest) {
    for (const laneId of modelManifest.supportedPayloadLanes ?? []) {
      modelCapabilities.push(availabilitySignal({
        id: `model:${modelManifest.manifestId}:lane:${laneId}`,
        source: "model_manifest",
        status: "available",
        laneId,
        modelSupported: true,
        reason: `Model manifest ${modelManifest.manifestId} declares payload lane support.`,
      }));
    }
    for (const lane of modelManifest.unavailableLanes ?? []) {
      modelCapabilities.push(availabilitySignal({
        id: `model:${modelManifest.manifestId}:unavailable-lane:${lane.laneId}`,
        source: "model_manifest",
        status: "unavailable",
        laneId: lane.laneId,
        payloadTypes: lane.payloadTypes,
        modelSupported: false,
        reason: lane.reason,
        missingRequirements: [`model_payload_lane:${lane.laneId}`],
      }));
    }
    for (const nativePayload of modelManifest.nativePayloadSupport ?? []) {
      modelCapabilities.push(availabilitySignal({
        id: `model:${modelManifest.manifestId}:native:${nativePayload.payloadType}`,
        source: "model_manifest",
        status: nativePayload.supported ? "available" : "unavailable",
        payloadType: nativePayload.payloadType,
        modelSupported: nativePayload.supported,
        reason: nativePayload.reason,
        missingRequirements: nativePayload.supported ? [] : [`model_native_payload:${nativePayload.payloadType}`],
      }));
    }
    for (const [capabilityId, flag] of Object.entries(modelManifest.capabilityFlags ?? {})) {
      modelCapabilities.push(availabilitySignal({
        id: `model:${modelManifest.manifestId}:capability:${capabilityId}`,
        source: "model_manifest",
        status:
          flag.status === "supported"
            ? "available"
            : flag.status === "unsupported"
              ? "unavailable"
              : flag.status,
        capabilityId,
        modelSupported: flag.status === "supported",
        reason: flag.reason,
      }));
    }
  }

  const sourceEvidence: SourceObservationProducerAvailabilitySignal[] = [];
  const deterministicEvidence: SourceObservationProducerAvailabilitySignal[] = [];
  for (const observation of params.observations ?? []) {
    const completed = isCompletedSourceObservation(observation);
    const evidence = summarizeObservationEvidence(observation);
    const payloadType = observationTypeToPayloadType(observation.type);
    const producer = observation.producer;
    const signal = availabilitySignal({
      id: `source-evidence:${observation.id}`,
      source: "source_evidence",
      status: completed ? "available" : "unavailable",
      producerId: producer?.producerId ?? null,
      capabilityId: producer?.capabilityId ?? null,
      payloadType,
      observationType: observation.type,
      sourceId: observation.sourceId ?? observation.sourceDocumentId ?? observation.conversationDocumentId ?? null,
      conversationDocumentId: observation.conversationDocumentId ?? null,
      evidenceAvailable: completed,
      deterministicEvidenceAvailable: producer?.executionState === "deterministically_derived",
      evidenceSummary: evidence ? JSON.stringify(evidence) : null,
      reason: completed
        ? "Completed SourceObservation evidence is already loaded in the current resolver pass."
        : "SourceObservation exists but is not completed execution-backed evidence.",
    });
    sourceEvidence.push(signal);
    if (completed) {
      deterministicEvidence.push({
        ...signal,
        id: `deterministic-evidence:${observation.id}`,
        source: "deterministic_producer",
        deterministicEvidenceAvailable: true,
        reason: "Current deterministic resolver evidence can satisfy matching producer requests.",
      });
    }
  }

  return {
    traceId: params.traceId ?? transport?.agentWorkPlanTraceId ?? null,
    planId: params.planId ?? transport?.agentWorkPlanId ?? null,
    catalogCapabilities,
    catalogLanes,
    brokerCapabilities,
    modelCapabilities,
    runtimeSupport,
    transportSupport,
    policyConstraints: [],
    approvalStates: [],
    sourceEvidence,
    deterministicEvidence,
    asyncSuitability: [],
    noExecutionClaimed: true,
  };
}

const AVAILABILITY_CONTEXT_KEYS = [
  "catalogCapabilities",
  "catalogLanes",
  "brokerCapabilities",
  "modelCapabilities",
  "runtimeSupport",
  "transportSupport",
  "policyConstraints",
  "approvalStates",
  "sourceEvidence",
  "deterministicEvidence",
  "asyncSuitability",
] as const;

function availabilityContextSignals(context: SourceObservationProducerAvailabilityContext | null | undefined) {
  if (!context) return [];
  return AVAILABILITY_CONTEXT_KEYS.flatMap((key) => context[key] ?? []);
}

function sourceMatchesRequest(
  signal: SourceObservationProducerAvailabilitySignal,
  request: SourceObservationProducerRequest
) {
  const requestSourceId = request.sourceId ?? request.conversationDocumentId ?? null;
  const signalSourceId = signal.sourceId ?? signal.conversationDocumentId ?? null;
  return !requestSourceId || !signalSourceId || requestSourceId === signalSourceId;
}

function signalAppliesToRequest(params: {
  signal: SourceObservationProducerAvailabilitySignal;
  request: SourceObservationProducerRequest;
  manifest: SourceObservationProducerManifest | null;
  producerId: string;
  capabilityId: string;
  payloadType: string | null;
  laneId: string | null;
}) {
  const { signal, request, manifest, producerId, capabilityId, payloadType, laneId } = params;
  if (!sourceMatchesRequest(signal, request)) return false;
  const selectors = [
    signal.producerId ? signal.producerId === producerId : null,
    signal.capabilityId ? signal.capabilityId === capabilityId : null,
    signal.brokerCapabilityId ? signal.brokerCapabilityId === capabilityId : null,
    signal.payloadType && payloadType ? signal.payloadType === payloadType : null,
    signal.payloadTypes?.length && payloadType ? signal.payloadTypes.includes(payloadType) : null,
    signal.laneId && laneId ? signal.laneId === laneId : null,
    signal.laneIds?.length && laneId ? signal.laneIds.includes(laneId) : null,
    signal.observationType ? signal.observationType === request.requestedObservationType : null,
    signal.observationTypes?.length ? signal.observationTypes.includes(request.requestedObservationType) : null,
    manifest ? Boolean(signal.payloadTypes?.some((value) => manifest.producedPayloadTypes.includes(value))) : null,
  ].filter((value): value is boolean => value !== null && value !== undefined);
  return selectors.length === 0 ? true : selectors.some(Boolean);
}

function staticAvailabilitySignalsForRequest(params: {
  request: SourceObservationProducerRequest;
  manifest: SourceObservationProducerManifest | null;
  producerId: string;
  capabilityId: string;
  payloadType: string | null;
  laneId: string | null;
}) {
  const signals: SourceObservationProducerAvailabilitySignal[] = [];
  const { request, manifest, producerId, capabilityId, payloadType, laneId } = params;
  if (manifest) {
    signals.push(availabilitySignal({
      id: `request:${request.id}:producer-manifest:${manifest.producerId}`,
      source: "producer_manifest",
      status: availabilityStatusFromProducerAvailability(manifest.currentAvailability),
      producerId: manifest.producerId,
      capabilityId: manifest.capabilityId,
      payloadTypes: manifest.producedPayloadTypes,
      laneIds: manifest.laneRequirements,
      runtimeExecutable:
        manifest.currentAvailability === "available_read_only" &&
        CURRENT_EVIDENCE_PRODUCER_IDS.has(manifest.producerId),
      reason: manifest.reasonUnavailable ?? manifest.executionEvidenceRequirement,
      missingRequirements:
        manifest.currentAvailability === "available_read_only" ? [] : [manifest.capabilityId],
      asyncRecommended: manifest.latencyEstimate === "long_running",
    }));
  } else {
    signals.push(availabilitySignal({
      id: `request:${request.id}:producer-manifest:missing`,
      source: "producer_manifest",
      status: "missing",
      producerId,
      capabilityId,
      payloadType,
      laneId,
      reason: "No SourceObservation producer manifest matched this request.",
      missingRequirements: [producerId, capabilityId],
      asyncRecommended: true,
    }));
  }
  if (payloadType) {
    signals.push(availabilitySignal({
      id: `request:${request.id}:catalog-payload:${payloadType}`,
      source: "catalog",
      status: CATALOG_ONLY_PAYLOAD_TYPES.has(payloadType) ? "catalog_only" : "available",
      producerId,
      capabilityId,
      payloadType,
      laneId,
      reason: CATALOG_ONLY_PAYLOAD_TYPES.has(payloadType)
        ? `${payloadType} is cataloged for planning but not runtime-executable in this package.`
        : `${payloadType} is represented by the existing SourceObservation payload mapping.`,
      asyncRecommended: CATALOG_ONLY_PAYLOAD_TYPES.has(payloadType),
    }));
  }
  if (payloadType && UNAVAILABLE_PAYLOAD_TYPES.has(payloadType)) {
    signals.push(availabilitySignal({
      id: `request:${request.id}:runtime-unavailable:${payloadType}`,
      source: "runtime",
      status: "unavailable",
      producerId,
      capabilityId,
      payloadType,
      laneId,
      runtimeExecutable: false,
      reason: `${payloadType} has a cataloged future producer/lane but no executable runtime in WP3C.`,
      missingRequirements: [capabilityId],
      asyncRecommended: true,
    }));
  }
  return signals;
}

type SourceObservationProducerAvailabilityAnalysis = {
  details: SourceObservationProducerAvailabilitySignal[];
  sources: SourceObservationProducerAvailabilitySource[];
  primarySource: SourceObservationProducerAvailabilitySource;
  evidenceSummary: string | null;
  missingRequirements: string[];
  approvalPath: string | null;
  asyncRecommended: boolean;
  asyncReason: string | null;
  requiresApproval: boolean;
  blockedByPolicy: boolean;
  runtimeUnavailable: boolean;
  catalogOnly: boolean;
  sourceLocator: SourceObservationLocator | null;
  traceId: string | null;
  planId: string | null;
};

function buildProducerAvailabilityAnalysis(params: {
  request: SourceObservationProducerRequest;
  manifest: SourceObservationProducerManifest | null;
  producerId: string;
  capabilityId: string;
  payloadType: string | null;
  laneId: string | null;
  context?: SourceObservationProducerAvailabilityContext | null;
}): SourceObservationProducerAvailabilityAnalysis {
  const staticSignals = staticAvailabilitySignalsForRequest(params);
  const contextSignals = availabilityContextSignals(params.context).filter((signal) =>
    signalAppliesToRequest({
      signal,
      request: params.request,
      manifest: params.manifest,
      producerId: params.producerId,
      capabilityId: params.capabilityId,
      payloadType: params.payloadType,
      laneId: params.laneId,
    })
  );
  const details = uniqueById([...staticSignals, ...contextSignals]).slice(0, 40);
  const sources = uniqueStrings(details.map((signal) => signal.source)) as SourceObservationProducerAvailabilitySource[];
  const blocking = details.find((signal) => signal.status === "blocked_by_policy") ?? null;
  const approval = details.find((signal) => signal.status === "approval_required" || signal.approvalPath) ?? null;
  const catalogOnly = details.some((signal) => signal.status === "catalog_only");
  const runtimeUnavailable = details.some((signal) =>
    (signal.source === "runtime" || signal.source === "transport") &&
    (signal.status === "unavailable" || signal.status === "missing") &&
    signal.runtimeExecutable === false
  );
  const asyncSignal = details.find((signal) => signal.asyncRecommended || signal.status === "deferred") ?? null;
  const evidenceSignal =
    details.find((signal) => signal.source === "deterministic_producer" && signal.status === "available") ??
    details.find((signal) => signal.source === "source_evidence" && signal.status === "available") ??
    null;
  const missingRequirements = uniqueStrings(details.flatMap((signal) =>
    signal.status === "available" ? [] : signal.missingRequirements ?? []
  ));
  return {
    details,
    sources: sources.length > 0 ? sources : ["producer_manifest"],
    primarySource: blocking?.source ?? approval?.source ?? evidenceSignal?.source ?? details[0]?.source ?? "producer_manifest",
    evidenceSummary: evidenceSignal?.evidenceSummary ?? null,
    missingRequirements,
    approvalPath: params.request.approvalPath ?? approval?.approvalPath ?? null,
    asyncRecommended: Boolean(asyncSignal),
    asyncReason: asyncSignal?.reason ?? null,
    requiresApproval: Boolean(params.request.approvalPath || approval),
    blockedByPolicy: Boolean(blocking),
    runtimeUnavailable,
    catalogOnly,
    sourceLocator: params.request.sourceLocator ?? null,
    traceId: params.request.traceId ?? params.context?.traceId ?? null,
    planId: params.request.planId ?? params.context?.planId ?? null,
  };
}

type SourceObservationProducerResolutionBase = Omit<
  SourceObservationProducerResolution,
  | "availabilitySources"
  | "primaryAvailabilitySource"
  | "availabilityDetails"
  | "evidenceSummary"
  | "missingRequirements"
  | "approvalPath"
  | "sourceLocator"
  | "traceId"
  | "planId"
  | "asyncSuitability"
>;

function withAvailabilityAnalysis(
  base: SourceObservationProducerResolutionBase,
  analysis: SourceObservationProducerAvailabilityAnalysis
): SourceObservationProducerResolution {
  return {
    ...base,
    availabilitySources: analysis.sources,
    primaryAvailabilitySource: analysis.primarySource,
    availabilityDetails: analysis.details,
    evidenceSummary: analysis.evidenceSummary,
    missingRequirements: analysis.missingRequirements,
    approvalPath: analysis.approvalPath,
    sourceLocator: analysis.sourceLocator,
    traceId: analysis.traceId,
    planId: analysis.planId,
    asyncRecommended: base.asyncRecommended || analysis.asyncRecommended,
    asyncSuitability: {
      recommended: base.asyncRecommended || analysis.asyncRecommended,
      reason: analysis.asyncReason,
    },
  };
}

function manifestForRequest(
  request: SourceObservationProducerRequest,
  manifests: SourceObservationProducerManifest[]
) {
  const requestedProducerId = request.producerId ?? payloadTypeToProducer(request.requestedPayloadType);
  return manifests.find((manifest) => manifest.producerId === requestedProducerId) ??
    manifests.find((manifest) => manifest.capabilityId === request.requestedCapabilityId) ??
    null;
}

export function resolveSourceObservationProducerRequest(params: {
  request: SourceObservationProducerRequest;
  manifests?: SourceObservationProducerManifest[] | null;
  availabilityContext?: SourceObservationProducerAvailabilityContext | null;
}): SourceObservationProducerResolution {
  const request = params.request;
  const payloadType = normalizePayloadType(request.requestedPayloadType);
  const manifest = manifestForRequest(request, params.manifests ?? DEFAULT_SOURCE_OBSERVATION_PRODUCER_MANIFESTS);
  const producerId = manifest?.producerId ?? request.producerId ?? payloadTypeToProducer(payloadType);
  const laneId = payloadTypeToLane(payloadType);
  const capabilityId = request.requestedCapabilityId || manifest?.capabilityId || payloadTypeToCapability(payloadType);
  const analysis = buildProducerAvailabilityAnalysis({
    request,
    manifest,
    producerId,
    capabilityId,
    payloadType,
    laneId,
    context: params.availabilityContext,
  });
  const governedBy = uniqueStrings([
    "context-catalog-bootstrap",
    "inspection-tool-broker",
    "adaptive-context-transport",
    manifest ? `producer-manifest:${manifest.producerId}` : null,
    laneId ? `catalog-lane:${laneId}` : null,
    payloadType ? `catalog-payload:${payloadType}` : null,
    ...analysis.sources.map((source) => `availability:${source}`),
  ]);
  const common = {
    producerId,
    capabilityId,
    payloadType,
    governedBy,
    catalogPayloadType: payloadType,
    catalogLaneId: laneId,
    brokerCapabilityId: capabilityId,
    noExecutionClaimed: true as const,
  };

  if (analysis.blockedByPolicy) {
    return withAvailabilityAnalysis({
      ...common,
      state: "blocked_by_policy",
      executableNow: false,
      reason:
        analysis.details.find((signal) => signal.status === "blocked_by_policy")?.reason ??
        "Producer request is blocked by policy.",
      requiresApproval: false,
      blockedByPolicy: true,
      asyncRecommended: false,
    }, analysis);
  }

  if (analysis.requiresApproval) {
    return withAvailabilityAnalysis({
      ...common,
      state: "approval_required",
      executableNow: false,
      reason:
        request.approvalPath
          ? `Producer request requires approval path ${request.approvalPath}.`
          : analysis.details.find((signal) => signal.status === "approval_required")?.reason ??
            "Producer request requires approval before execution.",
      requiresApproval: true,
      blockedByPolicy: false,
      asyncRecommended: false,
    }, analysis);
  }

  if (payloadType && CATALOG_ONLY_PAYLOAD_TYPES.has(payloadType)) {
    return withAvailabilityAnalysis({
      ...common,
      state: "catalog_only",
      executableNow: false,
      reason: `${payloadType} is cataloged for transport planning, but WP3C does not add runtime attachment, connector reads, or spreadsheet execution.`,
      requiresApproval: false,
      blockedByPolicy: false,
      asyncRecommended: true,
    }, analysis);
  }

  if (payloadType && UNAVAILABLE_PAYLOAD_TYPES.has(payloadType)) {
    return withAvailabilityAnalysis({
      ...common,
      state: "unavailable",
      executableNow: false,
      reason: `${payloadType} requires a governed producer that is cataloged but not executable in WP3C.`,
      requiresApproval: false,
      blockedByPolicy: false,
      asyncRecommended: true,
    }, analysis);
  }

  if (analysis.catalogOnly && !manifest) {
    return withAvailabilityAnalysis({
      ...common,
      state: "catalog_only",
      executableNow: false,
      reason: "Availability context found catalog support, but no runtime producer manifest can execute this request.",
      requiresApproval: false,
      blockedByPolicy: false,
      asyncRecommended: analysis.asyncRecommended,
    }, analysis);
  }

  if (analysis.runtimeUnavailable && !CURRENT_EVIDENCE_PRODUCER_IDS.has(producerId)) {
    return withAvailabilityAnalysis({
      ...common,
      state: "unavailable",
      executableNow: false,
      reason: "Availability context indicates the needed runtime or transport lane is not executable now.",
      requiresApproval: false,
      blockedByPolicy: false,
      asyncRecommended: analysis.asyncRecommended,
    }, analysis);
  }

  if (manifest?.currentAvailability === "available_read_only" && CURRENT_EVIDENCE_PRODUCER_IDS.has(producerId)) {
    return withAvailabilityAnalysis({
      ...common,
      state: "deferred",
      executableNow: true,
      reason: "Producer is governed and may complete only if matching current resolver evidence already exists.",
      requiresApproval: false,
      blockedByPolicy: false,
      asyncRecommended: false,
    }, analysis);
  }

  return withAvailabilityAnalysis({
    ...common,
    state: "missing",
    executableNow: false,
    reason: "No governed current-evidence producer is available for this request.",
    requiresApproval: false,
    blockedByPolicy: false,
    asyncRecommended: true,
  }, analysis);
}

export function resolveSourceObservationProducerAvailability(params: {
  request: SourceObservationProducerRequest;
  manifests?: SourceObservationProducerManifest[] | null;
  availabilityContext?: SourceObservationProducerAvailabilityContext | null;
}): SourceObservationProducerResolution {
  return resolveSourceObservationProducerRequest(params);
}

function observationHasCompletedEvidence(observation: SourceObservation) {
  return isCompletedSourceObservation(observation);
}

function locatorsOverlap(requestLocator: SourceObservationLocator | null | undefined, observationLocator: SourceObservationLocator) {
  if (!requestLocator) return true;
  const requestPage = requestLocator.pageNumberStart ?? requestLocator.page ?? null;
  const observationPage = observationLocator.pageNumberStart ?? observationLocator.page ?? null;
  if (requestPage != null && observationPage != null && requestPage !== observationPage) {
    return false;
  }
  if (requestLocator.tableId && observationLocator.tableId && requestLocator.tableId !== observationLocator.tableId) {
    return false;
  }
  if (requestLocator.sheetName && observationLocator.sheetName && requestLocator.sheetName !== observationLocator.sheetName) {
    return false;
  }
  return true;
}

function requestMatchesObservation(request: SourceObservationProducerRequest, observation: SourceObservation) {
  if (!observationHasCompletedEvidence(observation)) return false;
  const requestedType = request.requestedObservationType;
  const requestedPayloadType = normalizePayloadType(request.requestedPayloadType);
  if (
    observation.type !== requestedType &&
    (requestedPayloadType == null || payloadTypeToObservationType(requestedPayloadType) !== observation.type)
  ) {
    return false;
  }
  const requestSourceId = request.sourceId ?? request.conversationDocumentId ?? null;
  const observationSourceId = observation.sourceId ?? observation.sourceDocumentId ?? observation.conversationDocumentId ?? null;
  if (requestSourceId && observationSourceId && requestSourceId !== observationSourceId) {
    return false;
  }
  return locatorsOverlap(request.sourceLocator, observation.sourceLocator);
}

function unresolvedNeedsForRequest(
  request: SourceObservationProducerRequest,
  resolution: SourceObservationProducerResolution
): SourceObservationNeed[] {
  if (resolution.state === "completed_with_evidence" || resolution.state === "skipped") return [];
  const payloadType = normalizePayloadType(request.requestedPayloadType);
  const baseNeed = {
    id: `producer-need:${request.id}:${payloadType ?? request.requestedObservationType}`,
    observationType: request.requestedObservationType,
    sourceId: request.sourceId ?? null,
    conversationDocumentId: request.conversationDocumentId ?? null,
    capability: request.requestedCapabilityId,
    payloadType,
    state:
      resolution.state === "approval_required"
        ? "approval_required"
        : resolution.state === "deferred"
          ? "deferred"
          : "unavailable",
    reason: resolution.reason,
    noExecutionClaimed: true,
  } satisfies SourceObservationNeed;

  if (
    request.requestedCapabilityId === "pdf_table_body_recovery" ||
    payloadType === "structured_table"
  ) {
    return [
      baseNeed,
      ...["rendered_page_image", "ocr_text", "vision_observation", "document_ai_result"].map((missingPayload) => ({
        id: `producer-need:${request.id}:${missingPayload}`,
        observationType: payloadTypeToObservationType(missingPayload),
        sourceId: request.sourceId ?? null,
        conversationDocumentId: request.conversationDocumentId ?? null,
        capability: payloadTypeToCapability(missingPayload),
        payloadType: missingPayload,
        state: "unavailable",
        reason:
          "Table body recovery could not complete from current deterministic parser/chunk/PDF evidence; richer governed extraction remains unavailable in the current package.",
        noExecutionClaimed: true,
      } satisfies SourceObservationNeed)),
    ];
  }

  return [baseNeed];
}

export function canProducerResultCreateObservation(
  resultOrState: SourceObservationProducerResult | SourceObservationProducerResultState | null | undefined
) {
  const state = typeof resultOrState === "string" ? resultOrState : resultOrState?.state;
  return state === "completed_with_evidence";
}

function resultForRequest(params: {
  request: SourceObservationProducerRequest;
  resolution: SourceObservationProducerResolution;
  state: SourceObservationProducerResultState;
  observations?: SourceObservation[];
  reason?: string | null;
  recommendedResolution?: string | null;
}): SourceObservationProducerResult {
  const completedObservations = canProducerResultCreateObservation(params.state)
    ? (params.observations ?? []).filter(observationHasCompletedEvidence)
    : [];
  const output = completedObservations.length > 0
    ? {
        observationIds: completedObservations.map((observation) => observation.id),
        payloadKinds: uniqueStrings(completedObservations.map((observation) => observation.payloadKind)) as SourceObservationPayloadKind[],
        evidenceSummary: `Matched ${completedObservations.length} completed SourceObservation(s) from current resolver evidence.`,
        metadata: {
          requestedObservationType: params.request.requestedObservationType,
          requestedPayloadType: params.request.requestedPayloadType ?? null,
        },
      } satisfies SourceObservationProducerOutput
    : null;
  const evidence = completedObservations.length > 0
    ? {
        summary: output?.evidenceSummary ?? "Matched completed SourceObservation evidence.",
        observationIds: completedObservations.map((observation) => observation.id),
        sourceIds: uniqueStrings(completedObservations.map((observation) =>
          observation.sourceId ?? observation.sourceDocumentId ?? observation.conversationDocumentId ?? null
        )),
        locator: completedObservations[0]?.sourceLocator ?? params.request.sourceLocator ?? null,
        noUnavailableToolExecutionClaimed: true as const,
      }
    : null;
  const resolution = {
    ...params.resolution,
    state: params.state,
    executableNow: params.state === "completed_with_evidence" ? true : params.resolution.executableNow,
    reason: params.reason ?? params.resolution.reason,
    evidenceSummary:
      params.state === "completed_with_evidence"
        ? output?.evidenceSummary ?? params.resolution.evidenceSummary ?? null
        : params.resolution.evidenceSummary ?? null,
    missingRequirements:
      params.state === "completed_with_evidence"
        ? []
        : params.resolution.missingRequirements,
  } satisfies SourceObservationProducerResolution;
  return {
    requestId: params.request.id,
    request: params.request,
    producerId: resolution.producerId,
    capabilityId: resolution.capabilityId,
    state: params.state,
    resolution,
    observations: completedObservations,
    observationIds: completedObservations.map((observation) => observation.id),
    output,
    unresolvedNeeds: completedObservations.length > 0 ? [] : unresolvedNeedsForRequest(params.request, resolution),
    evidence,
    reason: params.reason ?? resolution.reason,
    recommendedResolution:
      params.recommendedResolution ??
      (completedObservations.length > 0
        ? null
        : "Route this unresolved producer result through existing durable gap/debt emission."),
    requiresApproval: resolution.requiresApproval,
    asyncRecommended: resolution.asyncRecommended,
    noExecutionClaimed: true,
  };
}

export function runDeterministicSourceObservationProducer(params: {
  request: SourceObservationProducerRequest;
  observations?: SourceObservation[] | null;
  manifests?: SourceObservationProducerManifest[] | null;
  availabilityContext?: SourceObservationProducerAvailabilityContext | null;
}): SourceObservationProducerResult {
  const resolution = resolveSourceObservationProducerRequest({
    request: params.request,
    manifests: params.manifests,
    availabilityContext: params.availabilityContext,
  });
  const matched = (params.observations ?? []).filter((observation) =>
    requestMatchesObservation(params.request, observation)
  );
  if (
    matched.length > 0 &&
    resolution.executableNow &&
    !resolution.requiresApproval &&
    !resolution.blockedByPolicy
  ) {
    return resultForRequest({
      request: params.request,
      resolution,
      state: "completed_with_evidence",
      observations: matched,
      reason: "Completed from current resolver-owned SourceObservation evidence.",
    });
  }

  if (resolution.executableNow) {
    const state =
      params.request.requestedCapabilityId === "pdf_table_body_recovery" ||
      normalizePayloadType(params.request.requestedPayloadType) === "structured_table"
        ? "missing"
        : "deferred";
    return resultForRequest({
      request: params.request,
      resolution,
      state,
      reason:
        state === "missing"
          ? "No completed structured table observation exists in current deterministic evidence."
          : "No matching completed SourceObservation exists in current resolver evidence.",
    });
  }

  return resultForRequest({
    request: params.request,
    resolution,
    state: resolution.state,
  });
}

export function runDeterministicSourceObservationProducers(params: {
  requests?: SourceObservationProducerRequest[] | null;
  observations?: SourceObservation[] | null;
  manifests?: SourceObservationProducerManifest[] | null;
  availabilityContext?: SourceObservationProducerAvailabilityContext | null;
}): SourceObservationProducerResult[] {
  return uniqueById(params.requests ?? []).map((request) =>
    runDeterministicSourceObservationProducer({
      request,
      observations: params.observations,
      manifests: params.manifests,
      availabilityContext: params.availabilityContext,
    })
  );
}

export function buildSourceObservationProducerDebugSummary(params: {
  requests?: SourceObservationProducerRequest[] | null;
  results?: SourceObservationProducerResult[] | null;
  transportSelections?: SourceObservationTransportSelection[] | null;
  durableGapDebtCandidateCount?: number | null;
}): SourceObservationProducerDebugSummary {
  const requests = uniqueById(params.requests ?? []);
  const results = params.results ?? [];
  const countsByState: Record<string, number> = {};
  const countsByProducerId: Record<string, number> = {};
  const countsByCapabilityId: Record<string, number> = {};
  const countsByRequestedObservationType: Record<string, number> = {};
  const countsByAvailabilitySource: Record<string, number> = {};
  const availabilitySources = new Set<SourceObservationProducerAvailabilitySource>();
  const reusedIdentifiers = new Set<string>();
  const newIdentifiers = new Set<string>();
  let runtimeExecutableCount = 0;
  let runtimeUnsupportedCount = 0;
  let modelLaneSupportedButRuntimeMissingCount = 0;
  let sourceEvidenceAvailableCount = 0;
  let deterministicEvidenceAvailableCount = 0;
  let noExecutionWarningCount = 0;
  let nativePlanned = 0;
  let nativeSupported = 0;
  let nativeUnavailable = 0;
  let nativeCatalogOnly = 0;
  let tableRequested = 0;
  let tableAttempted = 0;
  let tableCompleted = 0;
  let tableUnavailable = 0;
  let attributed = 0;
  let ambiguous = 0;

  for (const request of requests) {
    increment(countsByRequestedObservationType, request.requestedObservationType);
    for (const identifier of [
      request.requestedPayloadType,
      request.requestedCapabilityId,
      request.producerId,
      payloadTypeToLane(request.requestedPayloadType),
    ]) {
      if (!identifier) continue;
      if (CANONICAL_IDENTIFIER_SET.has(identifier)) {
        reusedIdentifiers.add(identifier);
      } else {
        newIdentifiers.add(identifier);
      }
    }
    if (request.requestedPayloadType === "native_file_reference") {
      nativePlanned += 1;
    }
    if (
      request.requestedCapabilityId === "pdf_table_body_recovery" ||
      request.requestedPayloadType === "structured_table"
    ) {
      tableRequested += 1;
    }
    if (request.sourceId || request.conversationDocumentId) {
      attributed += 1;
    } else {
      ambiguous += 1;
    }
  }

  for (const result of results) {
    increment(countsByState, result.state);
    increment(countsByProducerId, result.producerId);
    increment(countsByCapabilityId, result.capabilityId);
    for (const source of result.resolution.availabilitySources ?? []) {
      availabilitySources.add(source);
      increment(countsByAvailabilitySource, source);
    }
    for (const signal of result.resolution.availabilityDetails ?? []) {
      availabilitySources.add(signal.source);
      increment(countsByAvailabilitySource, signal.source);
      if (signal.runtimeExecutable) runtimeExecutableCount += 1;
      if (signal.runtimeExecutable === false || signal.status === "unavailable") runtimeUnsupportedCount += 1;
      if (signal.source === "source_evidence" && signal.status === "available") sourceEvidenceAvailableCount += 1;
      if (signal.source === "deterministic_producer" && signal.status === "available") {
        deterministicEvidenceAvailableCount += 1;
      }
      if (signal.noExecutionClaimed) noExecutionWarningCount += 1;
    }
    const modelSupportsLane = (result.resolution.availabilityDetails ?? []).some((signal) =>
      signal.source === "model_manifest" &&
      signal.status === "available" &&
      (signal.laneId || signal.laneIds?.length)
    );
    const runtimeMissing = (result.resolution.availabilityDetails ?? []).some((signal) =>
      (signal.source === "runtime" || signal.source === "transport") &&
      (signal.runtimeExecutable === false || signal.status === "unavailable" || signal.status === "missing")
    );
    if (modelSupportsLane && runtimeMissing) {
      modelLaneSupportedButRuntimeMissingCount += 1;
    }
    if (result.request.requestedPayloadType === "native_file_reference") {
      if (result.state === "completed_with_evidence") nativeSupported += 1;
      if (result.state === "catalog_only") nativeCatalogOnly += 1;
      if (result.state === "unavailable" || result.state === "missing") nativeUnavailable += 1;
    }
    if (
      result.request.requestedCapabilityId === "pdf_table_body_recovery" ||
      result.request.requestedPayloadType === "structured_table"
    ) {
      if (result.resolution.executableNow) tableAttempted += 1;
      if (result.state === "completed_with_evidence") tableCompleted += 1;
      if (result.state !== "completed_with_evidence") tableUnavailable += 1;
    }
  }

  const selectedForTransportCount = params.transportSelections?.reduce(
    (sum, selection) => sum + selection.selectedObservationIds.length,
    0
  ) ?? 0;
  const cappedOrDroppedCount = params.transportSelections?.reduce(
    (sum, selection) => sum + selection.cappedObservationCount,
    0
  ) ?? 0;
  const unresolvedResults = results.filter((result) =>
    result.state !== "completed_with_evidence" && result.state !== "skipped"
  );

  return {
    producerRequestCount: requests.length,
    resultCount: results.length,
    completedWithEvidenceCount: results.filter((result) => result.state === "completed_with_evidence").length,
    countsByState,
    countsByProducerId,
    countsByCapabilityId,
    countsByRequestedObservationType,
    availability: {
      sourcesConsulted: [...availabilitySources].sort(),
      countsByAvailabilitySource,
      runtimeExecutableCount,
      runtimeUnsupportedCount,
      modelLaneSupportedButRuntimeMissingCount,
      sourceEvidenceAvailableCount,
      deterministicEvidenceAvailableCount,
      noExecutionWarningCount,
    },
    nativeFileLane: {
      plannedCount: nativePlanned,
      supportedCount: nativeSupported,
      unavailableCount: nativeUnavailable,
      catalogOnlyCount: nativeCatalogOnly,
    },
    tableBodyRecovery: {
      requestedCount: tableRequested,
      attemptedDeterministicCount: tableAttempted,
      completedCount: tableCompleted,
      unavailableCount: tableUnavailable,
    },
    missingProducerNeedCount: unresolvedResults.reduce((sum, result) => sum + result.unresolvedNeeds.length, 0),
    durableGapDebtCandidateCount: params.durableGapDebtCandidateCount ?? 0,
    sourceDocumentAttributionCount: attributed,
    ambiguousAttributionCount: ambiguous,
    selectedForTransportCount,
    cappedOrDroppedCount,
    reusedCatalogIdentifierCount: reusedIdentifiers.size,
    newlyIntroducedIdentifierCount: newIdentifiers.size,
    reusedCatalogIdentifiers: [...reusedIdentifiers].sort(),
    newIdentifiers: [...newIdentifiers].sort(),
    missingProducerNeeds: unresolvedResults.slice(0, 24).map((result) => ({
      requestId: result.requestId,
      producerId: result.producerId,
      capabilityId: result.capabilityId,
      payloadType: result.request.requestedPayloadType ?? null,
      state: result.state,
      reason: result.reason,
    })),
    noUnavailableToolExecutionClaimed: true,
  };
}
