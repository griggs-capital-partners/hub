import type { AgentControlDecision } from "./agent-control-surface";
import {
  ContextPackingKernel,
  type ContextPackingCandidate,
  type ContextPackingResult,
} from "./context-packing-kernel";
import {
  DEFAULT_CONTEXT_PROMPT_CACHE_STRATEGY,
  estimateTextTokens,
  type ContextBudgetMode,
  type ContextCompactionStrategy,
  type ContextPromptCacheStrategy,
} from "./context-token-budget";
import type { AgentWorkPlan } from "./context-seams";
import type {
  AsyncAgentWorkDebugSnapshot,
  AsyncAgentWorkItem,
} from "./async-agent-work-queue";
import type {
  CapabilityGapRecord,
  ContextDebtRecord,
  SourceCoverageRecord,
} from "./capability-gap-context-debt-registry";
import type {
  DocumentKnowledgeArtifactRecord,
} from "./document-intelligence";
import type {
  ArtifactPromotionCandidate,
  ArtifactPromotionDecision,
  SourceObservation,
} from "./source-learning-artifact-promotion";
import type {
  InspectionCapability,
  ToolCostClass,
  ToolExecutionBoundary,
  ToolLatencyClass,
  ToolSideEffectLevel,
} from "./inspection-tool-broker";
import {
  resolveCatalogForAdaptiveContextTransport,
  type CatalogDebugSnapshot,
  type CatalogResolutionResult,
} from "./context-catalog-bootstrap";

export type ContextPayloadType = string;

export type ContextPayloadTypeStatus = "known" | "proposed" | "unsupported";

export type ContextPayloadRepresentation =
  | "text"
  | "summary_text"
  | "json"
  | "structured_data"
  | "image"
  | "native_file"
  | "binary_reference"
  | "debug_trace";

export type ContextPayloadClass =
  | "source"
  | "memory"
  | "artifact"
  | "diagnostic"
  | "runtime"
  | "creation"
  | "validation";

export type ContextPayloadProvenance = {
  sourceId: string | null;
  sourceType: string | null;
  sourceDocumentId?: string | null;
  sourceVersion?: string | null;
  location?: Record<string, unknown> | null;
  artifactKey?: string | null;
  observationIds?: string[];
  registryKey?: string | null;
  producedByToolId?: string | null;
  producedByModelId?: string | null;
  extractionMethod?: string | null;
  confidence?: number | null;
};

export type ContextPayloadOwnership = {
  scope: "thread" | "workspace" | "user" | "system" | "external" | "unknown";
  ownerId?: string | null;
  policyMode?: string | null;
};

export type ContextPayload = {
  id: string;
  type: ContextPayloadType;
  payloadClass: ContextPayloadClass;
  label: string;
  sourceId: string | null;
  sourceType: string | null;
  representation: ContextPayloadRepresentation;
  text: string | null;
  data: Record<string, unknown> | Array<Record<string, unknown>> | null;
  uri?: string | null;
  mimeType?: string | null;
  approxTokenCount: number;
  priority: number;
  confidence: number | null;
  available: boolean;
  executable: boolean;
  requiresApproval: boolean;
  provenance: ContextPayloadProvenance;
  ownership: ContextPayloadOwnership;
  persistence: {
    artifactEligible: boolean;
    sourceObservationEligible: boolean;
    contextDebtEligible: boolean;
    capabilityGapEligible: boolean;
    alreadyPersisted: boolean;
    policy: string;
  };
  metadata: Record<string, unknown>;
};

export type ContextPayloadTypeDefinition = {
  type: ContextPayloadType;
  label: string;
  description: string;
  status: ContextPayloadTypeStatus;
  textLike: boolean;
  executableNow: boolean;
  defaultRepresentation: ContextPayloadRepresentation;
  supportedRepresentations: ContextPayloadRepresentation[];
  defaultBoundary: TransportBoundary;
  artifactPolicy: PayloadToArtifactPolicy;
  observationPolicy: PayloadToObservationPolicy;
  compactionPolicy: PayloadCompactionPolicy;
  notes?: string[];
};

export type ContextPayloadProducerManifest = {
  manifestId: string;
  producerId: string;
  producedPayloadTypes: ContextPayloadType[];
  requiredInputPayloadTypes: ContextPayloadType[];
  outputConfidenceSignals: string[];
  outputValidationNeeds: string[];
  artifactTypesProduced: string[];
  sourceObservationTypesProduced: string[];
  costClass: ToolCostClass | "free_local" | "unknown";
  latencyClass: ToolLatencyClass | "unknown";
  dataEgressClass: "none" | "internal" | "tenant" | "external" | "unknown";
  sideEffectLevel: ToolSideEffectLevel | "none" | "unknown";
  executionBoundary: ToolExecutionBoundary | "memory" | "debug_trace" | "not_executable";
  fallbackCapabilities: InspectionCapability[];
  executable: boolean;
  notes: string[];
};

export type ContextPayloadConsumerManifest = {
  manifestId: string;
  consumerId: string;
  provider: string;
  acceptedPayloadTypes: ContextPayloadType[];
  preferredRepresentations: ContextPayloadRepresentation[];
  maxTextTokens?: number | null;
  policyRestrictions: string[];
  notes: string[];
};

export type ModelCapabilityManifest = ContextPayloadConsumerManifest & {
  modelId: string;
  modelProfileId: string;
  provider: string;
  protocol?: string | null;
  availabilityStatus?: string | null;
  inputModalities: string[];
  outputModality: string;
  maxContextTokens?: number | null;
  maxOutputTokens?: number | null;
  reservedSystemPromptTokens?: number | null;
  reservedResponseTokens?: number | null;
  contextBudgetTokensByMode: Record<ContextBudgetMode, number | null>;
  budgetModeDefaults: Record<
    ContextBudgetMode,
    {
      mode: ContextBudgetMode;
      contextBudgetTokens: number | null;
      maxOutputTokens: number | null;
      compactionStrategies: ContextCompactionStrategy[];
      promptCache: ContextPromptCacheStrategy;
    }
  >;
  maxImageInputs?: number | null;
  maxFileInputs?: number | null;
  supportedFileTypes: string[];
  supportedPayloadLanes: string[];
  unavailableLanes: Array<{
    laneId: string;
    payloadTypes: string[];
    reason: string;
  }>;
  nativePayloadSupport: Array<{
    payloadType: string;
    supported: boolean;
    reason: string;
  }>;
  capabilityFlags: Record<
    string,
    {
      status: "supported" | "unsupported" | "catalog_only" | "approval_required" | "unknown";
      reason: string;
      noExecutionClaimed: true;
    }
  >;
  supportsVision: boolean;
  supportsNativePdf: boolean;
  supportsStructuredOutput: boolean;
  supportsToolCalling: boolean;
  costClass: "low" | "medium" | "high" | "variable" | "unknown";
  latencyClass: "sync_safe" | "async_preferred" | "batch_only" | "unknown";
  limitations: string[];
};

export type ToolOutputManifest = ContextPayloadProducerManifest & {
  toolId: string;
};

export type PayloadToArtifactPolicy = {
  mode:
    | "not_artifact"
    | "already_knowledge_artifact"
    | "eligible_for_artifact_promotion"
    | "diagnostic_artifact_only"
    | "future_artifact_type_needed";
  artifactKinds: string[];
  persistenceContract: string;
};

export type PayloadToObservationPolicy = {
  mode:
    | "not_observation"
    | "already_source_observation"
    | "eligible_for_source_observation"
    | "future_observation_type_needed";
  observationTypes: string[];
  persistenceContract: string;
};

export type PayloadCompactionPolicy = {
  strategy:
    | "none"
    | "a03_text_pack"
    | "metadata_only"
    | "summary_required"
    | "not_supported";
  maxTokens?: number | null;
  detail: string;
};

export type PayloadExclusionReason =
  | "not_registered"
  | "payload_unavailable"
  | "producer_missing"
  | "model_payload_unsupported"
  | "representation_unsupported"
  | "policy_blocked"
  | "approval_required"
  | "budget_exhausted"
  | "a03_budget_exhausted"
  | "transport_lane_missing"
  | "execution_not_available"
  | "non_text_lane_not_executable";

export type TransportBoundary =
  | "in_memory"
  | "a03_text_packing_kernel"
  | "artifact_memory"
  | "source_observation_memory"
  | "context_registry"
  | "async_work_queue"
  | "debug_trace"
  | "future_tool_boundary"
  | "blocked";

export type TransportEligibilityDecision = {
  payloadId: string;
  payloadType: ContextPayloadType;
  eligible: boolean;
  reason: PayloadExclusionReason | "eligible";
  detail: string;
  boundary: TransportBoundary;
  requiresApproval: boolean;
};

export type TransportNegotiationDecision = {
  requirementId: string;
  payloadType: ContextPayloadType;
  status: "satisfied" | "partially_satisfied" | "missing" | "excluded";
  selectedPayloadIds: string[];
  excludedPayloadIds: string[];
  missingPayloadCapabilityIds: string[];
  detail: string;
};

export type MissingPayloadCapability = {
  id: string;
  payloadType: ContextPayloadType;
  sourceId: string | null;
  neededCapability: string;
  reason: string;
  candidateToolIds: string[];
  existingCapabilityGapKeys: string[];
  requiresApproval: boolean;
  asyncRecommended: boolean;
  noUnavailableToolExecutionClaimed: true;
};

export type MissingContextLaneProposal = {
  id: string;
  missingPayloadType: ContextPayloadType;
  candidateContextLanes: string[];
  boundary: TransportBoundary;
  reason: string;
  associatedCapabilities: string[];
  status: "proposed" | "known_missing" | "unsupported";
  noUnavailableToolExecutionClaimed: true;
};

export type ContextPayloadRequirement = {
  id: string;
  payloadType: ContextPayloadType;
  required: boolean;
  reason: string;
  sourceId?: string | null;
  minConfidence?: number | null;
  acceptedRepresentations?: ContextPayloadRepresentation[];
};

export type ContextTransportBudget = {
  runtimeBudgetProfile: AgentControlDecision["runtimeBudgetProfile"] | "unknown";
  budgetMode: ContextBudgetMode | "unknown";
  contextTokens: number;
  outputTokens: number;
  toolCalls: number;
  reservedTextLaneTokens: number;
  budgetByPayloadClass: Record<string, number>;
};

export type ContextTransportTrace = {
  type:
    | "transport_plan_created"
    | "payload_registered"
    | "payload_considered"
    | "payload_selected"
    | "payload_compacted"
    | "payload_excluded"
    | "missing_payload_recorded"
    | "a03_text_lane_invoked"
    | "transport_completed";
  timestamp: string;
  payloadId: string | null;
  payloadType: ContextPayloadType | null;
  detail: string;
  metadata: Record<string, unknown> | null;
};

export type ContextTransportStep = {
  stepId: string;
  kind:
    | "discover_payloads"
    | "negotiate_model_consumption"
    | "apply_governance"
    | "route_text_payloads_to_a03"
    | "select_non_text_payloads"
    | "record_missing_payloads"
    | "complete_transport_plan";
  status: "planned" | "completed" | "skipped" | "blocked";
  boundary: TransportBoundary;
  payloadType?: ContextPayloadType | null;
  payloadIds: string[];
  detail: string;
};

export type CompactedContextPayload = {
  payloadId: string;
  payloadType: ContextPayloadType;
  strategy: PayloadCompactionPolicy["strategy"];
  originalTokenCount: number;
  transportedTokenCount: number;
  boundary: TransportBoundary;
  detail: string;
};

export type ContextTransportExclusion = {
  payloadId: string | null;
  payloadType: ContextPayloadType;
  requirementId?: string | null;
  reason: PayloadExclusionReason;
  detail: string;
  estimatedTokensNeeded?: number | null;
  boundary: TransportBoundary;
};

export type ContextTransportPlan = {
  planId: string;
  agentWorkPlanId?: string | null;
  agentWorkPlanTraceId?: string | null;
  request: string | null;
  budget: ContextTransportBudget;
  requestedPayloads: ContextPayloadRequirement[];
  availablePayloads: ContextPayload[];
  modelCapabilityManifest: ModelCapabilityManifest;
  toolOutputManifestsConsidered: ToolOutputManifest[];
  steps: ContextTransportStep[];
  boundaries: TransportBoundary[];
  relationshipToA03: {
    a03IsTextPackingLane: true;
    detail: string;
  };
};

export type ContextTransportResult = {
  plan: ContextTransportPlan;
  selectedPayloads: ContextPayload[];
  compactedPayloads: CompactedContextPayload[];
  excludedPayloads: ContextTransportExclusion[];
  eligibilityDecisions: TransportEligibilityDecision[];
  negotiationDecisions: TransportNegotiationDecision[];
  missingPayloadCapabilities: MissingPayloadCapability[];
  missingContextLaneProposals: MissingContextLaneProposal[];
  a03PackingResults: ContextPackingResult[];
  payloadsEligibleForArtifactPromotion: string[];
  payloadsEligibleForSourceObservation: string[];
  persistedPayloadIds: string[];
  traceEvents: ContextTransportTrace[];
  debugSnapshot: ContextTransportDebugSnapshot;
  noUnavailableToolExecutionClaimed: true;
};

export type ContextTransportDebugSnapshot = {
  planId: string;
  agentWorkPlanId?: string | null;
  agentWorkPlanTraceId?: string | null;
  requestedPayloads: ContextPayloadRequirement[];
  availablePayloads: Array<Pick<ContextPayload, "id" | "type" | "label" | "available" | "representation" | "approxTokenCount">>;
  selectedPayloads: Array<Pick<ContextPayload, "id" | "type" | "label" | "representation" | "approxTokenCount">>;
  compactedPayloads: CompactedContextPayload[];
  excludedPayloads: ContextTransportExclusion[];
  exclusionReasons: PayloadExclusionReason[];
  modelCapabilityManifestUsed: ModelCapabilityManifest;
  toolOutputManifestsConsidered: ToolOutputManifest[];
  missingPayloadCapabilities: MissingPayloadCapability[];
  missingContextLaneProposals: MissingContextLaneProposal[];
  budgetUsedByPayloadClass: Record<string, number>;
  relationshipToA03PackingKernel: ContextTransportPlan["relationshipToA03"];
  payloadPersistence: {
    artifactEligiblePayloadIds: string[];
    sourceObservationEligiblePayloadIds: string[];
    alreadyPersistedPayloadIds: string[];
  };
  catalogDebugSnapshot: CatalogDebugSnapshot | null;
  visualInspectionDebugSnapshot: Record<string, unknown> | null;
  traceEvents: ContextTransportTrace[];
  noUnavailableToolExecutionClaimed: true;
};

export interface ContextPayloadAdapter<TInput = unknown> {
  adapterId: string;
  producedPayloadTypes: ContextPayloadType[];
  from(input: TInput): ContextPayload[];
}

export type ContextTransportPlannerInput = {
  request?: string | null;
  agentControl?: AgentControlDecision | null;
  agentWorkPlan?: AgentWorkPlan | null;
  availablePayloads?: ContextPayload[];
  requestedPayloads?: ContextPayloadRequirement[];
  modelManifest?: ModelCapabilityManifest | null;
  toolManifests?: ToolOutputManifest[];
  registry?: ContextPayloadRegistry;
  catalogResolution?: CatalogResolutionResult | null;
  visualInspectionDebugSnapshot?: Record<string, unknown> | null;
  budget?: Partial<ContextTransportBudget>;
  packingKernel?: ContextPackingKernel;
  a03PackingResults?: ContextPackingResult[];
  now?: () => Date;
};

function nowIso(now?: () => Date) {
  return (now ? now() : new Date()).toISOString();
}

function unique<T>(values: T[]) {
  return Array.from(new Set(values));
}

function normalizeWhitespace(value: string | null | undefined) {
  return (value ?? "").replace(/\s+/g, " ").trim();
}

function shortHash(value: string) {
  let hash = 0;
  for (let index = 0; index < value.length; index += 1) {
    hash = (hash * 31 + value.charCodeAt(index)) >>> 0;
  }
  return hash.toString(36);
}

function payloadTokenCount(payload: ContextPayload) {
  return Math.max(0, Math.ceil(payload.approxTokenCount || estimateTextTokens(payload.text ?? "")));
}

function traceEvent(
  params: Omit<ContextTransportTrace, "timestamp">,
  now?: () => Date
): ContextTransportTrace {
  return {
    ...params,
    timestamp: nowIso(now),
  };
}

function artifactPolicy(
  mode: PayloadToArtifactPolicy["mode"],
  artifactKinds: string[],
  persistenceContract: string
): PayloadToArtifactPolicy {
  return { mode, artifactKinds, persistenceContract };
}

function observationPolicy(
  mode: PayloadToObservationPolicy["mode"],
  observationTypes: string[],
  persistenceContract: string
): PayloadToObservationPolicy {
  return { mode, observationTypes, persistenceContract };
}

function compactionPolicy(
  strategy: PayloadCompactionPolicy["strategy"],
  detail: string,
  maxTokens?: number | null
): PayloadCompactionPolicy {
  return { strategy, detail, maxTokens };
}

const TEXT_LIKE_COMPACTION = compactionPolicy(
  "a03_text_pack",
  "Text-like payloads can be routed through A-03 Context Packing Kernel as one transport lane."
);

const METADATA_ONLY_COMPACTION = compactionPolicy(
  "metadata_only",
  "Payload is represented as metadata/debug trace until an executable rich lane exists."
);

const FUTURE_UNSUPPORTED_COMPACTION = compactionPolicy(
  "not_supported",
  "Payload type is representable in the registry, but no executable transport lane exists in A-04h."
);

export const LEGACY_A04H_PAYLOAD_TYPE_DEFINITIONS: ContextPayloadTypeDefinition[] = [
  {
    type: "text_excerpt",
    label: "Text excerpt",
    description: "Parser or source text excerpt that can enter the text context lane.",
    status: "known",
    textLike: true,
    executableNow: true,
    defaultRepresentation: "text",
    supportedRepresentations: ["text", "summary_text"],
    defaultBoundary: "a03_text_packing_kernel",
    artifactPolicy: artifactPolicy("eligible_for_artifact_promotion", ["source_memory"], "May become source learning through the existing artifact promotion seam."),
    observationPolicy: observationPolicy("eligible_for_source_observation", ["parser_text_excerpt", "extracted_text_chunk"], "May be persisted as SourceObservation substrate by existing source-learning semantics."),
    compactionPolicy: TEXT_LIKE_COMPACTION,
  },
  {
    type: "knowledge_artifact",
    label: "Knowledge artifact",
    description: "Durable ConversationDocumentKnowledgeArtifact rendered as reusable memory.",
    status: "known",
    textLike: true,
    executableNow: true,
    defaultRepresentation: "text",
    supportedRepresentations: ["text", "json", "summary_text"],
    defaultBoundary: "artifact_memory",
    artifactPolicy: artifactPolicy("already_knowledge_artifact", ["document_summary", "table_candidate", "source_memory"], "Already persisted in the KnowledgeArtifact table."),
    observationPolicy: observationPolicy("not_observation", [], "Artifacts are promoted durable memory, not raw SourceObservation substrate."),
    compactionPolicy: TEXT_LIKE_COMPACTION,
  },
  {
    type: "source_observation",
    label: "Source observation",
    description: "Raw extracted source substrate from parser text, tools, or future inspections.",
    status: "known",
    textLike: true,
    executableNow: true,
    defaultRepresentation: "text",
    supportedRepresentations: ["text", "json", "structured_data"],
    defaultBoundary: "source_observation_memory",
    artifactPolicy: artifactPolicy("eligible_for_artifact_promotion", ["source_summary", "metric_measurement", "table_structured_data"], "Can feed the existing artifact promotion seam."),
    observationPolicy: observationPolicy("already_source_observation", ["parser_text_excerpt", "extracted_text_chunk"], "Already conforms to SourceObservation semantics."),
    compactionPolicy: TEXT_LIKE_COMPACTION,
  },
  {
    type: "context_debt",
    label: "Context debt",
    description: "Durable missing, weak, stale, or incomplete source understanding.",
    status: "known",
    textLike: true,
    executableNow: true,
    defaultRepresentation: "summary_text",
    supportedRepresentations: ["summary_text", "json"],
    defaultBoundary: "context_registry",
    artifactPolicy: artifactPolicy("diagnostic_artifact_only", ["open_question"], "Diagnostic memory routes through existing ContextDebtRecord semantics."),
    observationPolicy: observationPolicy("not_observation", [], "Context debt is diagnostic memory, not raw source observation."),
    compactionPolicy: TEXT_LIKE_COMPACTION,
  },
  {
    type: "capability_gap",
    label: "Capability gap",
    description: "Durable missing capability, context lane, model support, or tool proposal.",
    status: "known",
    textLike: true,
    executableNow: true,
    defaultRepresentation: "summary_text",
    supportedRepresentations: ["summary_text", "json"],
    defaultBoundary: "context_registry",
    artifactPolicy: artifactPolicy("diagnostic_artifact_only", ["source_memory"], "Diagnostic memory routes through existing CapabilityGapRecord semantics."),
    observationPolicy: observationPolicy("not_observation", [], "Capability gaps are system capability memory, not source observations."),
    compactionPolicy: TEXT_LIKE_COMPACTION,
  },
  {
    type: "source_coverage",
    label: "Source coverage",
    description: "Durable coverage status for pages, tables, documents, or source collections.",
    status: "known",
    textLike: true,
    executableNow: true,
    defaultRepresentation: "summary_text",
    supportedRepresentations: ["summary_text", "json"],
    defaultBoundary: "context_registry",
    artifactPolicy: artifactPolicy("diagnostic_artifact_only", ["source_memory"], "Coverage uses existing SourceCoverageRecord semantics."),
    observationPolicy: observationPolicy("not_observation", [], "Coverage is inspection status, not raw source observation."),
    compactionPolicy: TEXT_LIKE_COMPACTION,
  },
  {
    type: "inspection_trace",
    label: "Inspection trace",
    description: "Runtime inspection or broker trace intended for debug and Inspector parity.",
    status: "known",
    textLike: true,
    executableNow: true,
    defaultRepresentation: "debug_trace",
    supportedRepresentations: ["debug_trace", "summary_text", "json"],
    defaultBoundary: "debug_trace",
    artifactPolicy: artifactPolicy("not_artifact", [], "Trace payloads are debug records unless a future policy promotes them."),
    observationPolicy: observationPolicy("not_observation", [], "Trace payloads are not source observations."),
    compactionPolicy: TEXT_LIKE_COMPACTION,
  },
  {
    type: "async_work_summary",
    label: "Async work summary",
    description: "Async Agent Work Queue snapshot or work item summary.",
    status: "known",
    textLike: true,
    executableNow: true,
    defaultRepresentation: "summary_text",
    supportedRepresentations: ["summary_text", "json"],
    defaultBoundary: "async_work_queue",
    artifactPolicy: artifactPolicy("diagnostic_artifact_only", ["open_question", "source_memory"], "Async summaries can link to existing async/debt/gap records."),
    observationPolicy: observationPolicy("not_observation", [], "Async work summary is workflow memory, not raw observation."),
    compactionPolicy: TEXT_LIKE_COMPACTION,
  },
  {
    type: "artifact_promotion_candidate",
    label: "Artifact promotion candidate",
    description: "Candidate from the A-05a source-learning promotion seam.",
    status: "known",
    textLike: true,
    executableNow: true,
    defaultRepresentation: "summary_text",
    supportedRepresentations: ["summary_text", "json"],
    defaultBoundary: "artifact_memory",
    artifactPolicy: artifactPolicy("eligible_for_artifact_promotion", ["source_summary", "metric_measurement", "table_structured_data"], "Candidate is eligible for existing artifact promotion evaluation."),
    observationPolicy: observationPolicy("not_observation", [], "Promotion candidates are derived from SourceObservations."),
    compactionPolicy: TEXT_LIKE_COMPACTION,
  },
  {
    type: "artifact_promotion_result",
    label: "Artifact promotion result",
    description: "Accepted/rejected result from the source-learning promotion seam.",
    status: "known",
    textLike: true,
    executableNow: true,
    defaultRepresentation: "summary_text",
    supportedRepresentations: ["summary_text", "json"],
    defaultBoundary: "artifact_memory",
    artifactPolicy: artifactPolicy("already_knowledge_artifact", ["source_memory"], "Accepted results route through existing KnowledgeArtifact persistence."),
    observationPolicy: observationPolicy("not_observation", [], "Promotion results are decisions, not raw observations."),
    compactionPolicy: TEXT_LIKE_COMPACTION,
  },
  {
    type: "structured_table",
    label: "Structured table",
    description: "Rows, columns, cells, or table-shaped data.",
    status: "proposed",
    textLike: false,
    executableNow: false,
    defaultRepresentation: "structured_data",
    supportedRepresentations: ["structured_data", "json", "summary_text"],
    defaultBoundary: "future_tool_boundary",
    artifactPolicy: artifactPolicy("future_artifact_type_needed", ["table_extraction"], "A future table recovery lane can promote this as structured table artifact memory."),
    observationPolicy: observationPolicy("future_observation_type_needed", ["structured_table_observation"], "A future table recovery lane can persist this as SourceObservation substrate."),
    compactionPolicy: METADATA_ONLY_COMPACTION,
    notes: ["Representable in A-04h, not executable in this pass."],
  },
  {
    type: "rendered_page_image",
    label: "Rendered page image",
    description: "Full rendered page bitmap or image reference.",
    status: "unsupported",
    textLike: false,
    executableNow: false,
    defaultRepresentation: "image",
    supportedRepresentations: ["image", "binary_reference"],
    defaultBoundary: "future_tool_boundary",
    artifactPolicy: artifactPolicy("future_artifact_type_needed", ["figure_interpretation", "table_candidate"], "Future rendered/vision pack may derive artifacts."),
    observationPolicy: observationPolicy("future_observation_type_needed", ["rendered_page_image"], "No rendered-page SourceObservation execution exists in A-04h."),
    compactionPolicy: FUTURE_UNSUPPORTED_COMPACTION,
  },
  {
    type: "page_crop_image",
    label: "Page crop image",
    description: "Rendered crop around a table, chart, figure, or selected page region.",
    status: "unsupported",
    textLike: false,
    executableNow: false,
    defaultRepresentation: "image",
    supportedRepresentations: ["image", "binary_reference"],
    defaultBoundary: "future_tool_boundary",
    artifactPolicy: artifactPolicy("future_artifact_type_needed", ["figure_interpretation", "table_candidate"], "Future rendered/vision pack may derive artifacts."),
    observationPolicy: observationPolicy("future_observation_type_needed", ["page_crop_image"], "No page-crop SourceObservation execution exists in A-04h."),
    compactionPolicy: FUTURE_UNSUPPORTED_COMPACTION,
  },
  {
    type: "native_file_reference",
    label: "Native file reference",
    description: "Pointer to a source file suitable for a model/tool that supports native file input.",
    status: "proposed",
    textLike: false,
    executableNow: false,
    defaultRepresentation: "native_file",
    supportedRepresentations: ["native_file", "binary_reference"],
    defaultBoundary: "future_tool_boundary",
    artifactPolicy: artifactPolicy("not_artifact", [], "Native file reference is transport substrate, not durable source learning by itself."),
    observationPolicy: observationPolicy("future_observation_type_needed", ["connector_file_snapshot"], "A connector/file snapshot lane would own persistence."),
    compactionPolicy: METADATA_ONLY_COMPACTION,
  },
  {
    type: "ocr_text",
    label: "OCR text",
    description: "Text recovered from rendered/scanned images.",
    status: "unsupported",
    textLike: true,
    executableNow: false,
    defaultRepresentation: "text",
    supportedRepresentations: ["text", "json"],
    defaultBoundary: "future_tool_boundary",
    artifactPolicy: artifactPolicy("eligible_for_artifact_promotion", ["source_memory", "table_extraction"], "Future OCR output can feed artifact promotion."),
    observationPolicy: observationPolicy("future_observation_type_needed", ["ocr_text"], "No OCR SourceObservation execution exists in A-04h."),
    compactionPolicy: FUTURE_UNSUPPORTED_COMPACTION,
  },
  {
    type: "vision_observation",
    label: "Vision observation",
    description: "Model/tool visual observation of a page, crop, figure, chart, or table.",
    status: "unsupported",
    textLike: true,
    executableNow: false,
    defaultRepresentation: "summary_text",
    supportedRepresentations: ["summary_text", "json"],
    defaultBoundary: "future_tool_boundary",
    artifactPolicy: artifactPolicy("eligible_for_artifact_promotion", ["figure_interpretation", "table_extraction"], "Future vision output can feed artifact promotion."),
    observationPolicy: observationPolicy("future_observation_type_needed", ["vision_observation"], "No vision SourceObservation execution exists in A-04h."),
    compactionPolicy: FUTURE_UNSUPPORTED_COMPACTION,
  },
  {
    type: "document_ai_result",
    label: "Document AI result",
    description: "External or specialized document-AI extraction result.",
    status: "unsupported",
    textLike: true,
    executableNow: false,
    defaultRepresentation: "json",
    supportedRepresentations: ["json", "structured_data", "summary_text"],
    defaultBoundary: "future_tool_boundary",
    artifactPolicy: artifactPolicy("eligible_for_artifact_promotion", ["table_extraction", "source_memory"], "Future document-AI output can feed artifact promotion."),
    observationPolicy: observationPolicy("future_observation_type_needed", ["document_ai_result"], "No document-AI SourceObservation execution exists in A-04h."),
    compactionPolicy: FUTURE_UNSUPPORTED_COMPACTION,
  },
  {
    type: "spreadsheet_range",
    label: "Spreadsheet range",
    description: "Structured spreadsheet range from existing parser output or future connector reads.",
    status: "proposed",
    textLike: false,
    executableNow: false,
    defaultRepresentation: "structured_data",
    supportedRepresentations: ["structured_data", "json", "summary_text"],
    defaultBoundary: "future_tool_boundary",
    artifactPolicy: artifactPolicy("eligible_for_artifact_promotion", ["table_extraction"], "Can become structured source learning when parser/connector output is normalized."),
    observationPolicy: observationPolicy("eligible_for_source_observation", ["spreadsheet_range"], "Existing SourceObservation types already name spreadsheet ranges."),
    compactionPolicy: METADATA_ONLY_COMPACTION,
  },
  {
    type: "spreadsheet_formula_map",
    label: "Spreadsheet formula map",
    description: "Formula/dependency map for spreadsheet cells.",
    status: "proposed",
    textLike: false,
    executableNow: false,
    defaultRepresentation: "structured_data",
    supportedRepresentations: ["structured_data", "json", "summary_text"],
    defaultBoundary: "future_tool_boundary",
    artifactPolicy: artifactPolicy("future_artifact_type_needed", ["source_memory"], "Future spreadsheet formula analysis can produce artifacts."),
    observationPolicy: observationPolicy("eligible_for_source_observation", ["spreadsheet_formula_map"], "Existing SourceObservation types already name formula maps."),
    compactionPolicy: METADATA_ONLY_COMPACTION,
  },
  {
    type: "tool_observation",
    label: "Tool observation",
    description: "Generic internal tool observation payload.",
    status: "known",
    textLike: true,
    executableNow: true,
    defaultRepresentation: "summary_text",
    supportedRepresentations: ["summary_text", "json"],
    defaultBoundary: "debug_trace",
    artifactPolicy: artifactPolicy("eligible_for_artifact_promotion", ["source_memory"], "Only source-grounded tool observations should be promoted."),
    observationPolicy: observationPolicy("eligible_for_source_observation", ["tool_observation"], "Existing SourceObservation types already name tool observations."),
    compactionPolicy: TEXT_LIKE_COMPACTION,
  },
  {
    type: "creation_plan",
    label: "Creation plan",
    description: "Future deliverable creation planning payload.",
    status: "proposed",
    textLike: true,
    executableNow: false,
    defaultRepresentation: "summary_text",
    supportedRepresentations: ["summary_text", "json"],
    defaultBoundary: "future_tool_boundary",
    artifactPolicy: artifactPolicy("future_artifact_type_needed", ["source_memory"], "Creation pipeline is not implemented in A-04h."),
    observationPolicy: observationPolicy("not_observation", [], "Creation plans are workflow payloads, not source observations."),
    compactionPolicy: METADATA_ONLY_COMPACTION,
  },
  {
    type: "validation_result",
    label: "Validation result",
    description: "Future claim/source/deliverable validation result payload.",
    status: "proposed",
    textLike: true,
    executableNow: false,
    defaultRepresentation: "summary_text",
    supportedRepresentations: ["summary_text", "json"],
    defaultBoundary: "future_tool_boundary",
    artifactPolicy: artifactPolicy("future_artifact_type_needed", ["source_memory"], "Validation pipeline is not implemented in A-04h."),
    observationPolicy: observationPolicy("not_observation", [], "Validation results are workflow payloads, not raw observations."),
    compactionPolicy: METADATA_ONLY_COMPACTION,
  },
];

export class ContextPayloadRegistry {
  private readonly definitions = new Map<ContextPayloadType, ContextPayloadTypeDefinition>();

  constructor(definitions: ContextPayloadTypeDefinition[] = resolveCatalogForAdaptiveContextTransport().payloadTypeDefinitions) {
    this.registerMany(definitions);
  }

  register(definition: ContextPayloadTypeDefinition) {
    this.definitions.set(definition.type, definition);
    return this;
  }

  registerMany(definitions: ContextPayloadTypeDefinition[]) {
    for (const definition of definitions) {
      this.register(definition);
    }
    return this;
  }

  has(type: ContextPayloadType) {
    return this.definitions.has(type);
  }

  get(type: ContextPayloadType) {
    return this.definitions.get(type) ?? null;
  }

  list() {
    return [...this.definitions.values()];
  }

  isTextLike(type: ContextPayloadType) {
    return this.definitions.get(type)?.textLike ?? false;
  }
}

export function buildDefaultContextPayloadRegistry() {
  return new ContextPayloadRegistry(resolveCatalogForAdaptiveContextTransport().payloadTypeDefinitions);
}

const DEFAULT_CATALOG_RESOLUTION = resolveCatalogForAdaptiveContextTransport();

export function buildDefaultContextCatalogResolution(input: {
  request?: string | null;
  agentControl?: AgentControlDecision | null;
} = {}) {
  return resolveCatalogForAdaptiveContextTransport(input);
}

export const DEFAULT_MODEL_CAPABILITY_MANIFEST =
  DEFAULT_CATALOG_RESOLUTION.selectedModelManifest satisfies ModelCapabilityManifest;

export const DEFAULT_TOOL_OUTPUT_MANIFESTS =
  DEFAULT_CATALOG_RESOLUTION.toolOutputManifests satisfies ToolOutputManifest[];

function basePayload(params: {
  id: string;
  type: ContextPayloadType;
  payloadClass: ContextPayloadClass;
  label: string;
  sourceId?: string | null;
  sourceType?: string | null;
  representation?: ContextPayloadRepresentation;
  text?: string | null;
  data?: Record<string, unknown> | Array<Record<string, unknown>> | null;
  uri?: string | null;
  mimeType?: string | null;
  approxTokenCount?: number | null;
  priority?: number | null;
  confidence?: number | null;
  available?: boolean;
  executable?: boolean;
  requiresApproval?: boolean;
  provenance?: Partial<ContextPayloadProvenance>;
  ownership?: Partial<ContextPayloadOwnership>;
  persistence?: Partial<ContextPayload["persistence"]>;
  metadata?: Record<string, unknown>;
}): ContextPayload {
  const text = params.text ?? null;
  return {
    id: params.id,
    type: params.type,
    payloadClass: params.payloadClass,
    label: params.label,
    sourceId: params.sourceId ?? params.provenance?.sourceId ?? null,
    sourceType: params.sourceType ?? params.provenance?.sourceType ?? null,
    representation: params.representation ?? (text ? "text" : "json"),
    text,
    data: params.data ?? null,
    uri: params.uri ?? null,
    mimeType: params.mimeType ?? null,
    approxTokenCount: Math.max(0, Math.ceil(params.approxTokenCount ?? estimateTextTokens(text ?? ""))),
    priority: params.priority ?? 50,
    confidence: params.confidence ?? params.provenance?.confidence ?? null,
    available: params.available ?? true,
    executable: params.executable ?? true,
    requiresApproval: params.requiresApproval ?? false,
    provenance: {
      sourceId: params.sourceId ?? params.provenance?.sourceId ?? null,
      sourceType: params.sourceType ?? params.provenance?.sourceType ?? null,
      sourceDocumentId: params.provenance?.sourceDocumentId ?? null,
      sourceVersion: params.provenance?.sourceVersion ?? null,
      location: params.provenance?.location ?? null,
      artifactKey: params.provenance?.artifactKey ?? null,
      observationIds: params.provenance?.observationIds ?? [],
      registryKey: params.provenance?.registryKey ?? null,
      producedByToolId: params.provenance?.producedByToolId ?? null,
      producedByModelId: params.provenance?.producedByModelId ?? null,
      extractionMethod: params.provenance?.extractionMethod ?? null,
      confidence: params.confidence ?? params.provenance?.confidence ?? null,
    },
    ownership: {
      scope: params.ownership?.scope ?? "thread",
      ownerId: params.ownership?.ownerId ?? null,
      policyMode: params.ownership?.policyMode ?? null,
    },
    persistence: {
      artifactEligible: params.persistence?.artifactEligible ?? false,
      sourceObservationEligible: params.persistence?.sourceObservationEligible ?? false,
      contextDebtEligible: params.persistence?.contextDebtEligible ?? false,
      capabilityGapEligible: params.persistence?.capabilityGapEligible ?? false,
      alreadyPersisted: params.persistence?.alreadyPersisted ?? false,
      policy: params.persistence?.policy ?? "transport_debug_only",
    },
    metadata: params.metadata ?? {},
  };
}

export function buildContextPayloadsFromPackingCandidates(
  candidates: ContextPackingCandidate[]
): ContextPayload[] {
  return candidates.map((candidate) => {
    const registryType =
      typeof candidate.metadata?.registryType === "string" ? candidate.metadata.registryType : null;
    const payloadType =
      registryType === "context_debt"
        ? "context_debt"
        : registryType === "capability_gap"
          ? "capability_gap"
          : candidate.kind === "artifact"
            ? "knowledge_artifact"
            : "text_excerpt";

    return basePayload({
      id: candidate.id,
      type: payloadType,
      payloadClass:
        payloadType === "knowledge_artifact"
          ? "artifact"
          : payloadType === "context_debt" || payloadType === "capability_gap"
            ? "diagnostic"
            : "source",
      label: candidate.label,
      sourceId: candidate.sourceId,
      sourceType: candidate.sourceType,
      representation: "text",
      text: candidate.content,
      data: candidate.metadata ?? null,
      approxTokenCount: candidate.approxTokenCount,
      priority: candidate.priority,
      confidence: candidate.confidence,
      provenance: {
        sourceId: candidate.sourceId,
        sourceType: candidate.sourceType,
        location: candidate.provenance ?? null,
        artifactKey:
          typeof candidate.metadata?.artifactKey === "string"
            ? candidate.metadata.artifactKey
            : null,
        registryKey:
          typeof candidate.metadata?.debtKey === "string"
            ? candidate.metadata.debtKey
            : typeof candidate.metadata?.gapKey === "string"
              ? candidate.metadata.gapKey
              : null,
      },
      persistence: {
        artifactEligible: payloadType === "text_excerpt",
        contextDebtEligible: payloadType === "context_debt",
        capabilityGapEligible: payloadType === "capability_gap",
        alreadyPersisted: payloadType !== "text_excerpt",
        policy: payloadType === "text_excerpt" ? "eligible_for_source_learning" : "already_persisted_memory",
      },
      metadata: {
        ...(candidate.metadata ?? {}),
        packingCandidateKind: candidate.kind,
        a03CandidateId: candidate.id,
      },
    });
  });
}

export function buildContextPayloadsFromSourceObservations(
  observations: SourceObservation[]
): ContextPayload[] {
  return observations.flatMap((observation) => {
    const shared = {
      sourceId: observation.sourceDocumentId,
      sourceType: "thread_document",
      label: observation.sourceLocator.sourceLocationLabel ?? observation.id,
      text: observation.content,
      data: observation.payload,
      approxTokenCount: estimateTextTokens(observation.content),
      confidence: observation.confidence,
      provenance: {
        sourceId: observation.sourceDocumentId,
        sourceType: "thread_document",
        sourceDocumentId: observation.sourceDocumentId,
        sourceVersion: observation.sourceVersion,
        location: observation.sourceLocator,
        observationIds: [observation.id],
        extractionMethod: observation.extractionMethod,
        confidence: observation.confidence,
      },
      persistence: {
        artifactEligible: true,
        sourceObservationEligible: true,
        alreadyPersisted: true,
        policy: "source_observation_substrate",
      },
      metadata: {
        sourceObservationType: observation.type,
        limitations: observation.limitations,
      },
    };

    return [
      basePayload({
        ...shared,
        id: `source-observation:${observation.id}`,
        type: "source_observation",
        payloadClass: "source",
        representation: "text",
      }),
      basePayload({
        ...shared,
        id: `text-excerpt:${observation.id}`,
        type: "text_excerpt",
        payloadClass: "source",
        representation: "text",
        persistence: {
          artifactEligible: true,
          sourceObservationEligible: true,
          alreadyPersisted: false,
          policy: "derived_text_excerpt_from_source_observation",
        },
      }),
    ];
  });
}

export function buildContextPayloadsFromKnowledgeArtifacts(
  artifacts: DocumentKnowledgeArtifactRecord[]
): ContextPayload[] {
  return artifacts.map((artifact) =>
    basePayload({
      id: `knowledge-artifact:${artifact.id}`,
      type: "knowledge_artifact",
      payloadClass: "artifact",
      label: artifact.title ?? artifact.summary ?? artifact.artifactKey,
      sourceId: artifact.sourceDocumentId,
      sourceType: "thread_document",
      representation: "text",
      text: [artifact.title, artifact.summary, artifact.content].filter(Boolean).join("\n"),
      data: artifact.payload,
      approxTokenCount: artifact.approxTokenCount,
      priority:
        artifact.kind === "table_extraction"
          ? 90
          : artifact.kind === "table_candidate" || artifact.kind === "extraction_warning"
            ? 80
            : 55,
      confidence: artifact.confidence,
      provenance: {
        sourceId: artifact.sourceDocumentId,
        sourceType: "thread_document",
        sourceDocumentId: artifact.sourceDocumentId,
        location: artifact.location,
        artifactKey: artifact.artifactKey,
        producedByToolId: artifact.tool,
        confidence: artifact.confidence,
      },
      persistence: {
        artifactEligible: true,
        alreadyPersisted: true,
        policy: "conversation_document_knowledge_artifact",
      },
      metadata: {
        artifactKind: artifact.kind,
        artifactStatus: artifact.status,
        relevanceHints: artifact.relevanceHints,
      },
    })
  );
}

export function buildContextPayloadsFromContextDebtRecords(
  records: ContextDebtRecord[]
): ContextPayload[] {
  return records.map((record) =>
    basePayload({
      id: `context-debt:${record.debtKey}`,
      type: "context_debt",
      payloadClass: "diagnostic",
      label: record.title,
      sourceId: record.sourceId ?? record.conversationDocumentId ?? record.conversationId,
      sourceType: "context_registry",
      representation: "summary_text",
      text: [
        `Context debt: ${record.title}`,
        `Status: ${record.status}. Severity: ${record.severity}.`,
        record.description,
        record.whyItMatters ? `Why it matters: ${record.whyItMatters}` : null,
        record.deferredCapabilities.length > 0
          ? `Deferred capabilities: ${record.deferredCapabilities.join(", ")}. These have not executed.`
          : null,
      ].filter(Boolean).join("\n"),
      data: record as unknown as Record<string, unknown>,
      approxTokenCount: 80,
      priority: record.severity === "critical" ? 100 : record.severity === "high" ? 85 : 60,
      provenance: {
        sourceId: record.sourceId ?? record.conversationDocumentId ?? record.conversationId,
        sourceType: "context_registry",
        location: record.sourceLocator,
        registryKey: record.debtKey,
      },
      persistence: {
        contextDebtEligible: true,
        alreadyPersisted: true,
        policy: "context_debt_record",
      },
      metadata: {
        kind: record.kind,
        resolutionPaths: record.resolutionPaths,
        noUnavailableToolExecutionClaimed: true,
      },
    })
  );
}

export function buildContextPayloadsFromCapabilityGapRecords(
  records: CapabilityGapRecord[]
): ContextPayload[] {
  return records.map((record) =>
    basePayload({
      id: `capability-gap:${record.gapKey}`,
      type: "capability_gap",
      payloadClass: "diagnostic",
      label: record.title,
      sourceId: record.sourceId ?? record.conversationDocumentId ?? record.conversationId,
      sourceType: "context_registry",
      representation: "summary_text",
      text: [
        `Capability gap: ${record.neededCapability}`,
        `Kind: ${record.kind}. Status: ${record.status}.`,
        record.description,
        record.recommendedResolution ? `Recommended resolution: ${record.recommendedResolution}` : null,
        "This is a durable proposal/gap only; it is not an executed tool.",
      ].filter(Boolean).join("\n"),
      data: record as unknown as Record<string, unknown>,
      approxTokenCount: 75,
      priority: record.severity === "critical" ? 100 : record.severity === "high" ? 85 : 60,
      provenance: {
        sourceId: record.sourceId ?? record.conversationDocumentId ?? record.conversationId,
        sourceType: "context_registry",
        registryKey: record.gapKey,
      },
      persistence: {
        capabilityGapEligible: true,
        alreadyPersisted: true,
        policy: "capability_gap_record",
      },
      metadata: {
        kind: record.kind,
        missingPayloadType: record.missingPayloadType,
        candidateContextLanes: record.candidateContextLanes,
        noUnavailableToolExecutionClaimed: true,
      },
    })
  );
}

export function buildContextPayloadsFromSourceCoverageRecords(
  records: SourceCoverageRecord[]
): ContextPayload[] {
  return records.map((record) =>
    basePayload({
      id: `source-coverage:${record.coverageKey}`,
      type: "source_coverage",
      payloadClass: "diagnostic",
      label: `Coverage for ${record.sourceId}`,
      sourceId: record.sourceId,
      sourceType: "context_registry",
      representation: "summary_text",
      text: [
        `Source coverage: ${record.coverageStatus}.`,
        `Target: ${record.coverageTarget.target ?? "unknown"}.`,
        record.limitations.length > 0 ? `Limitations: ${record.limitations.join("; ")}` : null,
      ].filter(Boolean).join("\n"),
      data: record as unknown as Record<string, unknown>,
      approxTokenCount: 50,
      priority: record.coverageStatus === "inspected_with_limitations" ? 72 : 50,
      provenance: {
        sourceId: record.sourceId,
        sourceType: "context_registry",
        location: record.sourceLocator,
        registryKey: record.coverageKey,
      },
      persistence: {
        alreadyPersisted: true,
        policy: "source_coverage_record",
      },
      metadata: {
        coverageTarget: record.coverageTarget,
        inspectedBy: record.inspectedBy,
      },
    })
  );
}

export function buildContextPayloadsFromAsyncAgentWork(
  items: Array<AsyncAgentWorkItem | AsyncAgentWorkDebugSnapshot>
): ContextPayload[] {
  return items.map((item) => {
    const id = "workItemId" in item ? item.workItemId : item.id;
    const type = item.type;
    const status = item.status;
    const limitations = "limitations" in item ? item.limitations : item.result?.limitations ?? [];
    return basePayload({
      id: `async-work:${id}`,
      type: "async_work_summary",
      payloadClass: "runtime",
      label: `Async work ${type}: ${status}`,
      sourceId: "conversationDocumentId" in item ? item.conversationDocumentId : null,
      sourceType: "async_agent_work",
      representation: "summary_text",
      text: [
        `Async work item ${id} is ${status}.`,
        `Type: ${type}.`,
        limitations.length > 0 ? `Limitations: ${limitations.join("; ")}` : null,
        "No unavailable rendered/OCR/vision/document-AI tool execution is claimed by this summary.",
      ].filter(Boolean).join("\n"),
      data: item as unknown as Record<string, unknown>,
      approxTokenCount: 80,
      priority: 65,
      provenance: {
        sourceId: "conversationDocumentId" in item ? item.conversationDocumentId : null,
        sourceType: "async_agent_work",
        registryKey: id,
      },
      persistence: {
        alreadyPersisted: true,
        policy: "async_agent_work_queue_v1",
      },
      metadata: {
        status,
        type,
        noUnavailableToolExecutionClaimed: true,
      },
    });
  });
}

export function buildContextPayloadsFromArtifactPromotionCandidates(
  candidates: ArtifactPromotionCandidate[]
): ContextPayload[] {
  return candidates.map((candidate) =>
    basePayload({
      id: `artifact-promotion-candidate:${candidate.candidateId}`,
      type: "artifact_promotion_candidate",
      payloadClass: "artifact",
      label: candidate.title,
      sourceId: candidate.metadata.sourceDocumentId,
      sourceType: "source_observation",
      representation: "summary_text",
      text: [candidate.title, candidate.summary, candidate.payload.content].filter(Boolean).join("\n"),
      data: candidate as unknown as Record<string, unknown>,
      approxTokenCount: estimateTextTokens(candidate.payload.content),
      priority: 70,
      confidence: candidate.metadata.confidence,
      provenance: {
        sourceId: candidate.metadata.sourceDocumentId,
        sourceType: "source_observation",
        sourceDocumentId: candidate.metadata.sourceDocumentId,
        sourceVersion: candidate.metadata.sourceVersion,
        location: candidate.metadata.sourceLocator,
        observationIds: candidate.metadata.sourceObservationIds,
        extractionMethod: candidate.metadata.extractionMethod,
        confidence: candidate.metadata.confidence,
      },
      persistence: {
        artifactEligible: true,
        alreadyPersisted: false,
        policy: "artifact_promotion_candidate",
      },
      metadata: {
        bucket: candidate.bucket,
        proposedBy: candidate.proposedBy,
        reason: candidate.reason,
      },
    })
  );
}

export function buildContextPayloadsFromArtifactPromotionDecisions(
  decisions: ArtifactPromotionDecision[]
): ContextPayload[] {
  return decisions.map((decision) =>
    basePayload({
      id: `artifact-promotion-result:${decision.candidateId}`,
      type: "artifact_promotion_result",
      payloadClass: "artifact",
      label: `Artifact promotion ${decision.accepted ? "accepted" : "rejected"}: ${decision.candidateId}`,
      sourceId: decision.artifact?.sourceDocumentId ?? null,
      sourceType: "artifact_promotion",
      representation: "summary_text",
      text: [
        `Artifact promotion ${decision.accepted ? "accepted" : "rejected"} for ${decision.candidateId}.`,
        `Validation state: ${decision.validationState}.`,
        decision.reasons.join(" "),
      ].join("\n"),
      data: decision as unknown as Record<string, unknown>,
      approxTokenCount: 60,
      priority: decision.accepted ? 75 : 55,
      provenance: {
        sourceId: decision.artifact?.sourceDocumentId ?? null,
        sourceType: "artifact_promotion",
        artifactKey: decision.artifact?.artifactKey ?? null,
      },
      persistence: {
        artifactEligible: Boolean(decision.artifact),
        alreadyPersisted: Boolean(decision.artifact),
        policy: "artifact_promotion_result",
      },
      metadata: {
        accepted: decision.accepted,
        validationState: decision.validationState,
      },
    })
  );
}

function defaultBudget(
  input: ContextTransportPlannerInput,
  modelManifest: ModelCapabilityManifest = DEFAULT_MODEL_CAPABILITY_MANIFEST
): ContextTransportBudget {
  const decision = input.agentControl;
  const budgetMode = input.agentWorkPlan?.budget.mode ?? decision?.budgetMode ?? "unknown";
  const manifestBudget =
    budgetMode !== "unknown"
      ? modelManifest.budgetModeDefaults?.[budgetMode]?.contextBudgetTokens ??
        modelManifest.contextBudgetTokensByMode?.[budgetMode]
      : null;
  const contextTokens =
    input.budget?.contextTokens ??
    input.agentWorkPlan?.budget.contextTokens.granted ??
    decision?.contextBudgetRequest.grantedTokens ??
    manifestBudget ??
    modelManifest.maxTextTokens ??
    4096;
  const outputTokens =
    input.budget?.outputTokens ??
    input.agentWorkPlan?.budget.outputTokens.granted ??
    decision?.outputBudgetRequest.grantedTokens ??
    modelManifest.maxOutputTokens ??
    0;
  const toolCalls =
    input.budget?.toolCalls ??
    input.agentWorkPlan?.budget.toolCalls.granted ??
    decision?.toolBudgetRequest.grantedToolCalls ??
    0;
  return {
    runtimeBudgetProfile: input.budget?.runtimeBudgetProfile ?? decision?.runtimeBudgetProfile ?? "unknown",
    budgetMode,
    contextTokens,
    outputTokens,
    toolCalls,
    reservedTextLaneTokens:
      input.budget?.reservedTextLaneTokens ?? Math.max(0, Math.floor(contextTokens * 0.85)),
    budgetByPayloadClass: input.budget?.budgetByPayloadClass ?? {},
  };
}

function needsVisualTableRecovery(request: string | null | undefined, agentControl?: AgentControlDecision | null) {
  const text = request ?? "";
  return (
    /page\s*15|smackover water chemistry|table body|water chemistry|recover.*table|what does .*table/i.test(text) ||
    agentControl?.sourceCoverageTarget === "all_tables"
  );
}

function defaultRequirement(
  payloadType: ContextPayloadType,
  reason: string,
  required = false,
  sourceId?: string | null
): ContextPayloadRequirement {
  return {
    id: `need:${payloadType}:${shortHash(`${sourceId ?? "any"}:${reason}`)}`,
    payloadType,
    required,
    reason,
    sourceId: sourceId ?? null,
  };
}

export function buildDefaultContextPayloadRequirements(input: {
  request?: string | null;
  agentControl?: AgentControlDecision | null;
  agentWorkPlan?: AgentWorkPlan | null;
  availablePayloads?: ContextPayload[];
  catalogResolution?: CatalogResolutionResult | null;
}): ContextPayloadRequirement[] {
  const availableTypes = unique((input.availablePayloads ?? []).map((payload) => payload.type));
  const requirements: ContextPayloadRequirement[] = availableTypes.map((payloadType) =>
    defaultRequirement(payloadType, "Available payload type should be considered for transport.", false)
  );
  const add = (payloadType: string, reason: string, required = false) => {
    if (!requirements.some((requirement) => requirement.payloadType === payloadType && requirement.reason === reason)) {
      requirements.push(defaultRequirement(payloadType, reason, required));
    }
  };

  for (const requirement of input.catalogResolution?.recommendedPayloadRequirements ?? []) {
    add(requirement.payloadType, requirement.reason, requirement.required);
  }

  const agentWorkPlan = input.agentWorkPlan;
  const agentWorkPlanId = agentWorkPlan?.planId ?? "unscoped";
  for (const need of agentWorkPlan?.capabilityNeeds ?? []) {
    for (const payloadType of need.payloadTypes) {
      add(
        payloadType,
        `AgentWorkPlan ${agentWorkPlanId} records ${need.capability} as ${need.state}.`,
        need.state === "needed" || need.state === "approval_required"
      );
    }
  }

  if (!input.catalogResolution && needsVisualTableRecovery(input.request, input.agentControl)) {
    for (const payloadType of [
      "knowledge_artifact",
      "text_excerpt",
      "source_observation",
      "context_debt",
      "capability_gap",
      "source_coverage",
      "rendered_page_image",
      "page_crop_image",
      "vision_observation",
      "ocr_text",
      "document_ai_result",
      "structured_table",
    ]) {
      add(payloadType, "T5/page-table fidelity needs current memory plus unavailable visual/table recovery payloads.", false);
    }
  }

  if (!input.catalogResolution && input.agentControl?.taskFidelityLevel === "highest_fidelity_ingestion") {
    for (const payloadType of [
      "source_observation",
      "text_excerpt",
      "knowledge_artifact",
      "rendered_page_image",
      "page_crop_image",
      "structured_table",
      "ocr_text",
      "vision_observation",
      "document_ai_result",
      "source_coverage",
      "context_debt",
      "capability_gap",
    ]) {
      add(payloadType, "Highest-fidelity ingestion benefits from source, memory, visual, OCR, document-AI, coverage, debt, and gap payloads.", false);
    }
  }

  if (!input.catalogResolution && input.agentControl?.taskFidelityLevel === "highest_fidelity_creation") {
    for (const payloadType of [
      "knowledge_artifact",
      "source_observation",
      "source_coverage",
      "context_debt",
      "capability_gap",
      "creation_plan",
      "validation_result",
    ]) {
      add(payloadType, "Highest-fidelity creation benefits from positive source learning, limitations, planning, and validation payloads.", false);
    }
  }

  return requirements;
}

function payloadToPackingCandidate(payload: ContextPayload): ContextPackingCandidate {
  const kind: ContextPackingCandidate["kind"] =
    payload.type === "knowledge_artifact"
      ? "artifact"
      : payload.type === "text_excerpt" || payload.type === "source_observation"
        ? "excerpt"
        : "inspection_result";

  return {
    id: payload.id,
    kind,
    sourceId: payload.sourceId ?? "unknown",
    sourceType: payload.sourceType ?? "context_payload",
    label: payload.label,
    content: payload.text ?? normalizeWhitespace(JSON.stringify(payload.data ?? {})),
    approxTokenCount: payload.approxTokenCount,
    priority: payload.priority,
    confidence: payload.confidence,
    artifactKind: payload.type === "knowledge_artifact" ? String(payload.metadata.artifactKind ?? "knowledge_artifact") : payload.type,
    artifactStatus: typeof payload.metadata.artifactStatus === "string" ? payload.metadata.artifactStatus : null,
    locationLabel:
      typeof payload.provenance.location?.sourceLocationLabel === "string"
        ? payload.provenance.location.sourceLocationLabel
        : null,
    provenance: {
      ...payload.provenance,
      contextPayloadId: payload.id,
      contextPayloadType: payload.type,
    },
    required: false,
    metadata: {
      ...payload.metadata,
      contextPayloadId: payload.id,
      contextPayloadType: payload.type,
    },
  };
}

function buildPackingResultFromExisting(results: ContextPackingResult[], textPayloads: ContextPayload[]) {
  if (results.length === 0) return null;
  const textIds = new Set(textPayloads.map((payload) => payload.id));
  const selected = new Set<string>();
  const excluded = new Map<string, { reason: PayloadExclusionReason; detail: string; estimatedTokensNeeded: number | null }>();

  for (const result of results) {
    for (const candidate of result.selectedCandidates) {
      if (textIds.has(candidate.id)) {
        selected.add(candidate.id);
      }
    }
    for (const candidate of result.excludedCandidates) {
      if (textIds.has(candidate.candidate.id)) {
        excluded.set(candidate.candidate.id, {
          reason: candidate.reason === "budget_exhausted" ? "a03_budget_exhausted" : "budget_exhausted",
          detail: candidate.detail,
          estimatedTokensNeeded: candidate.estimatedTokensNeeded,
        });
      }
    }
  }

  return { selected, excluded };
}

function canModelConsume(params: {
  payload: ContextPayload;
  modelManifest: ModelCapabilityManifest;
  requirement?: ContextPayloadRequirement | null;
}) {
  if (!params.modelManifest.acceptedPayloadTypes.includes(params.payload.type)) {
    return false;
  }
  const acceptedRepresentations = params.requirement?.acceptedRepresentations;
  if (acceptedRepresentations && acceptedRepresentations.length > 0) {
    return acceptedRepresentations.includes(params.payload.representation);
  }
  return params.modelManifest.preferredRepresentations.includes(params.payload.representation);
}

function buildMissingCapability(params: {
  payloadType: ContextPayloadType;
  requirement: ContextPayloadRequirement;
  registry: ContextPayloadRegistry;
  toolManifests: ToolOutputManifest[];
  agentControl?: AgentControlDecision | null;
  catalogResolution?: CatalogResolutionResult | null;
}): MissingPayloadCapability {
  const producerToolIds = params.toolManifests
    .filter((manifest) => manifest.producedPayloadTypes.includes(params.payloadType))
    .map((manifest) => manifest.toolId);
  const definition = params.registry.get(params.payloadType);
  const catalogLaneCapability = params.catalogResolution?.snapshot.transportLaneEntries.find((lane) =>
    lane.acceptedPayloadTypes.includes(params.payloadType)
  )?.missingCapabilityGapKind;
  const neededCapability =
    catalogLaneCapability ??
    (params.payloadType === "rendered_page_image" || params.payloadType === "page_crop_image"
      ? "rendered_page_inspection"
      : params.payloadType === "ocr_text"
        ? "ocr"
        : params.payloadType === "vision_observation"
          ? "vision_page_understanding"
          : params.payloadType === "document_ai_result" || params.payloadType === "structured_table"
            ? "document_ai_table_recovery"
            : `payload:${params.payloadType}`);

  return {
    id: `missing-payload:${params.payloadType}:${shortHash(params.requirement.id)}`,
    payloadType: params.payloadType,
    sourceId: params.requirement.sourceId ?? null,
    neededCapability,
    reason:
      definition?.executableNow === false
        ? `Payload type ${params.payloadType} is declared but not executable in A-04h.`
        : `No available eligible payload satisfied ${params.payloadType}.`,
    candidateToolIds: producerToolIds,
    existingCapabilityGapKeys: [],
    requiresApproval: params.agentControl?.approvalRequired ?? false,
    asyncRecommended: params.agentControl?.asyncRecommended ?? true,
    noUnavailableToolExecutionClaimed: true,
  };
}

function buildMissingLaneProposal(params: {
  payloadType: ContextPayloadType;
  registry: ContextPayloadRegistry;
  missingCapability: MissingPayloadCapability;
  catalogResolution?: CatalogResolutionResult | null;
}): MissingContextLaneProposal {
  const definition = params.registry.get(params.payloadType);
  const catalogLanes = params.catalogResolution?.snapshot.transportLaneEntries.filter((lane) =>
    lane.acceptedPayloadTypes.includes(params.payloadType)
  ) ?? [];
  const candidateContextLanes =
    catalogLanes.length > 0
      ? catalogLanes.map((lane) => lane.laneId)
      : params.payloadType === "rendered_page_image" || params.payloadType === "page_crop_image"
        ? ["rendered_page_image", "page_crop_image", "model_vision_input"]
        : params.payloadType === "ocr_text"
          ? ["ocr_text", "rendered_page_image"]
          : params.payloadType === "vision_observation"
            ? ["vision_observation", "model_vision_input"]
            : params.payloadType === "document_ai_result" || params.payloadType === "structured_table"
              ? ["document_ai_result", "structured_table"]
              : [params.payloadType];

  return {
    id: `missing-lane:${params.payloadType}:${shortHash(params.missingCapability.id)}`,
    missingPayloadType: params.payloadType,
    candidateContextLanes,
    boundary: catalogLanes[0]?.executionBoundary ?? definition?.defaultBoundary ?? "future_tool_boundary",
    reason:
      catalogLanes[0]
        ? `Catalog lane ${catalogLanes[0].laneId} is ${catalogLanes[0].currentAvailability} for ${params.payloadType}.`
        : definition?.status === "unsupported"
        ? `Payload lane ${params.payloadType} is known but unsupported in this pass.`
        : `Payload lane ${params.payloadType} needs a registered producer/consumer path.`,
    associatedCapabilities: [params.missingCapability.neededCapability],
    status:
      definition?.status === "unsupported" || catalogLanes[0]?.currentAvailability?.startsWith("unavailable")
        ? "unsupported"
        : "proposed",
    noUnavailableToolExecutionClaimed: true,
  };
}

function buildBudgetUsedByClass(payloads: ContextPayload[]) {
  return payloads.reduce<Record<string, number>>((accumulator, payload) => {
    accumulator[payload.payloadClass] = (accumulator[payload.payloadClass] ?? 0) + payloadTokenCount(payload);
    return accumulator;
  }, {});
}

function debugSnapshot(params: {
  plan: ContextTransportPlan;
  selectedPayloads: ContextPayload[];
  compactedPayloads: CompactedContextPayload[];
  excludedPayloads: ContextTransportExclusion[];
  missingPayloadCapabilities: MissingPayloadCapability[];
  missingContextLaneProposals: MissingContextLaneProposal[];
  traceEvents: ContextTransportTrace[];
  catalogDebugSnapshot?: CatalogDebugSnapshot | null;
  visualInspectionDebugSnapshot?: Record<string, unknown> | null;
}): ContextTransportDebugSnapshot {
  return {
    planId: params.plan.planId,
    agentWorkPlanId: params.plan.agentWorkPlanId ?? null,
    agentWorkPlanTraceId: params.plan.agentWorkPlanTraceId ?? null,
    requestedPayloads: params.plan.requestedPayloads,
    availablePayloads: params.plan.availablePayloads.map((payload) => ({
      id: payload.id,
      type: payload.type,
      label: payload.label,
      available: payload.available,
      representation: payload.representation,
      approxTokenCount: payload.approxTokenCount,
    })),
    selectedPayloads: params.selectedPayloads.map((payload) => ({
      id: payload.id,
      type: payload.type,
      label: payload.label,
      representation: payload.representation,
      approxTokenCount: payload.approxTokenCount,
    })),
    compactedPayloads: params.compactedPayloads,
    excludedPayloads: params.excludedPayloads,
    exclusionReasons: unique(params.excludedPayloads.map((excluded) => excluded.reason)),
    modelCapabilityManifestUsed: params.plan.modelCapabilityManifest,
    toolOutputManifestsConsidered: params.plan.toolOutputManifestsConsidered,
    missingPayloadCapabilities: params.missingPayloadCapabilities,
    missingContextLaneProposals: params.missingContextLaneProposals,
    budgetUsedByPayloadClass: buildBudgetUsedByClass(params.selectedPayloads),
    relationshipToA03PackingKernel: params.plan.relationshipToA03,
    payloadPersistence: {
      artifactEligiblePayloadIds: params.selectedPayloads
        .filter((payload) => payload.persistence.artifactEligible)
        .map((payload) => payload.id),
      sourceObservationEligiblePayloadIds: params.selectedPayloads
        .filter((payload) => payload.persistence.sourceObservationEligible)
        .map((payload) => payload.id),
      alreadyPersistedPayloadIds: params.selectedPayloads
        .filter((payload) => payload.persistence.alreadyPersisted)
        .map((payload) => payload.id),
    },
    catalogDebugSnapshot: params.catalogDebugSnapshot ?? null,
    visualInspectionDebugSnapshot: params.visualInspectionDebugSnapshot ?? null,
    traceEvents: params.traceEvents,
    noUnavailableToolExecutionClaimed: true,
  };
}

export function planAdaptiveContextTransport(
  input: ContextTransportPlannerInput
): ContextTransportResult {
  const catalogResolution =
    input.catalogResolution ??
    resolveCatalogForAdaptiveContextTransport({
      request: input.request,
      agentControl: input.agentControl,
    });
  const registry = input.registry ?? new ContextPayloadRegistry(catalogResolution.payloadTypeDefinitions);
  const modelCapabilityManifest = input.modelManifest ?? catalogResolution.selectedModelManifest ?? DEFAULT_MODEL_CAPABILITY_MANIFEST;
  const toolOutputManifestsConsidered = input.toolManifests ?? [...catalogResolution.toolOutputManifests];
  const budget = defaultBudget(input, modelCapabilityManifest);
  const requestedPayloads =
    input.requestedPayloads ??
    buildDefaultContextPayloadRequirements({
      request: input.request,
      agentControl: input.agentControl,
      agentWorkPlan: input.agentWorkPlan,
      availablePayloads: input.availablePayloads,
      catalogResolution,
    });
  const availablePayloads = input.availablePayloads ?? [];
  const planId = `context-transport:${input.agentControl?.decisionId ?? shortHash(input.request ?? "default")}`;
  const traceEvents: ContextTransportTrace[] = [
    traceEvent({
      type: "transport_plan_created",
      payloadId: null,
      payloadType: null,
      detail: "Adaptive context transport plan created from payload registry, model manifest, tool manifests, policy, and budget.",
      metadata: {
        planId,
        requestedPayloadTypes: requestedPayloads.map((requirement) => requirement.payloadType),
        catalogId: catalogResolution.catalogId,
      },
    }, input.now),
  ];
  const steps: ContextTransportStep[] = [
    {
      stepId: `${planId}:discover`,
      kind: "discover_payloads",
      status: "completed",
      boundary: "in_memory",
      payloadIds: availablePayloads.map((payload) => payload.id),
      detail: `Discovered ${availablePayloads.length} available payload(s).`,
    },
    {
      stepId: `${planId}:negotiate`,
      kind: "negotiate_model_consumption",
      status: "completed",
      boundary: "in_memory",
      payloadIds: [],
      detail: `Negotiated consumption against model manifest ${modelCapabilityManifest.manifestId}.`,
    },
  ];
  const eligibilityDecisions: TransportEligibilityDecision[] = [];
  const immediateSelected: ContextPayload[] = [];
  const excludedPayloads: ContextTransportExclusion[] = [];
  const requestedByType = new Map<ContextPayloadType, ContextPayloadRequirement[]>();
  for (const requirement of requestedPayloads) {
    const existing = requestedByType.get(requirement.payloadType) ?? [];
    existing.push(requirement);
    requestedByType.set(requirement.payloadType, existing);
  }

  for (const payload of availablePayloads) {
    const definition = registry.get(payload.type);
    const requirement = requestedByType.get(payload.type)?.[0] ?? null;
    traceEvents.push(traceEvent({
      type: "payload_considered",
      payloadId: payload.id,
      payloadType: payload.type,
      detail: `Considering payload ${payload.id}.`,
      metadata: {
        representation: payload.representation,
        available: payload.available,
      },
    }, input.now));

    let reason: PayloadExclusionReason | "eligible" = "eligible";
    let detail = "Payload is eligible for transport.";
    let boundary = definition?.defaultBoundary ?? "in_memory";

    if (!definition) {
      reason = "not_registered";
      detail = `Payload type ${payload.type} is not registered.`;
      boundary = "blocked";
    } else if (!payload.available) {
      reason = "payload_unavailable";
      detail = `Payload ${payload.id} is not available.`;
    } else if (input.agentControl?.blockedByPolicy) {
      reason = "policy_blocked";
      detail = "Agent Control Surface blocked this context path.";
      boundary = "blocked";
    } else if (payload.requiresApproval) {
      reason = "approval_required";
      detail = "Payload transport requires approval under its payload policy.";
      boundary = "blocked";
    } else if (!canModelConsume({ payload, modelManifest: modelCapabilityManifest, requirement })) {
      reason = "model_payload_unsupported";
      detail = `Model manifest ${modelCapabilityManifest.manifestId} does not accept ${payload.type} as ${payload.representation}.`;
    } else if (!definition.executableNow && !payload.executable) {
      reason = definition.textLike ? "execution_not_available" : "non_text_lane_not_executable";
      detail = `Payload type ${payload.type} is representable but not executable in A-04h.`;
      boundary = "future_tool_boundary";
    }

    const eligible = reason === "eligible";
    eligibilityDecisions.push({
      payloadId: payload.id,
      payloadType: payload.type,
      eligible,
      reason,
      detail,
      boundary,
      requiresApproval: payload.requiresApproval,
    });

    if (!eligible) {
      excludedPayloads.push({
        payloadId: payload.id,
        payloadType: payload.type,
        requirementId: requirement?.id ?? null,
        reason: reason as PayloadExclusionReason,
        detail,
        boundary,
      });
      traceEvents.push(traceEvent({
        type: "payload_excluded",
        payloadId: payload.id,
        payloadType: payload.type,
        detail,
        metadata: { reason },
      }, input.now));
      continue;
    }

    immediateSelected.push(payload);
  }

  const textPayloads = immediateSelected.filter((payload) => registry.isTextLike(payload.type));
  const nonTextPayloads = immediateSelected.filter((payload) => !registry.isTextLike(payload.type));
  const selectedPayloads: ContextPayload[] = [];
  const compactedPayloads: CompactedContextPayload[] = [];
  const a03PackingResults: ContextPackingResult[] = [];
  const existingPacking = buildPackingResultFromExisting(input.a03PackingResults ?? [], textPayloads);

  if (textPayloads.length > 0) {
    steps.push({
      stepId: `${planId}:a03-text-lane`,
      kind: "route_text_payloads_to_a03",
      status: "completed",
      boundary: "a03_text_packing_kernel",
      payloadIds: textPayloads.map((payload) => payload.id),
      detail: "Text-like payloads route through A-03 Context Packing Kernel as one lane.",
    });
    traceEvents.push(traceEvent({
      type: "a03_text_lane_invoked",
      payloadId: null,
      payloadType: "text_excerpt",
      detail: "A-03 Context Packing Kernel used for text-like payload transport.",
      metadata: {
        payloadIds: textPayloads.map((payload) => payload.id),
        reusedExistingPackingResults: Boolean(existingPacking),
      },
    }, input.now));

    if (existingPacking) {
      selectedPayloads.push(...textPayloads.filter((payload) => existingPacking.selected.has(payload.id)));
      for (const payload of textPayloads.filter((payload) => existingPacking.selected.has(payload.id))) {
        compactedPayloads.push({
          payloadId: payload.id,
          payloadType: payload.type,
          strategy: "a03_text_pack",
          originalTokenCount: payloadTokenCount(payload),
          transportedTokenCount: payloadTokenCount(payload),
          boundary: "a03_text_packing_kernel",
          detail: "Payload selected by existing A-03 packing result.",
        });
      }
      for (const [payloadId, excluded] of existingPacking.excluded.entries()) {
        const payload = textPayloads.find((candidate) => candidate.id === payloadId);
        if (payload) {
          excludedPayloads.push({
            payloadId: payload.id,
            payloadType: payload.type,
            reason: excluded.reason,
            detail: excluded.detail,
            estimatedTokensNeeded: excluded.estimatedTokensNeeded,
            boundary: "a03_text_packing_kernel",
          });
        }
      }
    } else {
      const kernel = input.packingKernel ?? new ContextPackingKernel();
      const packingResult = kernel.pack({
        selectedBudgetProfile:
          input.agentControl?.runtimeBudgetProfile ?? "default_chat",
        allowedContextBudgetTokens: budget.reservedTextLaneTokens,
        taskFidelityLevel:
          input.agentControl?.taskFidelityLevel ?? "standard_grounded_answer",
        sourceCoverageTarget:
          input.agentControl?.sourceCoverageTarget ?? "relevant_source_sections",
        creationDepth:
          input.agentControl?.creationDepth ?? "none",
        validationDepth:
          input.agentControl?.validationDepth ?? "none",
        artifactCandidateSet: textPayloads
          .filter((payload) => payload.type === "knowledge_artifact")
          .map(payloadToPackingCandidate),
        rawExcerptCandidateSet: textPayloads
          .filter((payload) => payload.type !== "knowledge_artifact")
          .map(payloadToPackingCandidate),
        passName: "adaptive_transport_text_lane",
        assemblyStage: "a04h_adaptive_context_transport",
        traceRequirements: {
          includeSelectedCandidates: true,
          includeExcludedCandidates: true,
          includeBudgetEvents: true,
        },
      });
      a03PackingResults.push(packingResult);
      const selectedIds = new Set(packingResult.selectedCandidates.map((candidate) => candidate.id));
      selectedPayloads.push(...textPayloads.filter((payload) => selectedIds.has(payload.id)));
      for (const payload of textPayloads.filter((payload) => selectedIds.has(payload.id))) {
        compactedPayloads.push({
          payloadId: payload.id,
          payloadType: payload.type,
          strategy: "a03_text_pack",
          originalTokenCount: payloadTokenCount(payload),
          transportedTokenCount: payloadTokenCount(payload),
          boundary: "a03_text_packing_kernel",
          detail: "Payload selected by A-03 text packing lane.",
        });
      }
      for (const excluded of packingResult.excludedCandidates) {
        excludedPayloads.push({
          payloadId: excluded.candidate.id,
          payloadType:
            typeof excluded.candidate.metadata?.contextPayloadType === "string"
              ? excluded.candidate.metadata.contextPayloadType
              : "text_excerpt",
          reason: excluded.reason === "budget_exhausted" ? "a03_budget_exhausted" : "budget_exhausted",
          detail: excluded.detail,
          estimatedTokensNeeded: excluded.estimatedTokensNeeded,
          boundary: "a03_text_packing_kernel",
        });
      }
    }
  }

  if (nonTextPayloads.length > 0) {
    steps.push({
      stepId: `${planId}:non-text`,
      kind: "select_non_text_payloads",
      status: "completed",
      boundary: "in_memory",
      payloadIds: nonTextPayloads.map((payload) => payload.id),
      detail: "Non-text payloads selected only when available, supported by the model manifest, and executable inside current boundaries.",
    });
    selectedPayloads.push(...nonTextPayloads);
  }

  const selectedByType = new Map<ContextPayloadType, ContextPayload[]>();
  for (const payload of selectedPayloads) {
    const existing = selectedByType.get(payload.type) ?? [];
    existing.push(payload);
    selectedByType.set(payload.type, existing);
    traceEvents.push(traceEvent({
      type: "payload_selected",
      payloadId: payload.id,
      payloadType: payload.type,
      detail: `Selected payload ${payload.id} for transport.`,
      metadata: {
        representation: payload.representation,
      },
    }, input.now));
  }
  for (const compacted of compactedPayloads) {
    traceEvents.push(traceEvent({
      type: "payload_compacted",
      payloadId: compacted.payloadId,
      payloadType: compacted.payloadType,
      detail: compacted.detail,
      metadata: {
        strategy: compacted.strategy,
        boundary: compacted.boundary,
      },
    }, input.now));
  }

  const missingPayloadCapabilities: MissingPayloadCapability[] = [];
  const missingContextLaneProposals: MissingContextLaneProposal[] = [];
  const negotiationDecisions: TransportNegotiationDecision[] = [];

  for (const requirement of requestedPayloads) {
    const selectedForRequirement = (selectedByType.get(requirement.payloadType) ?? []).filter((payload) =>
      requirement.sourceId ? payload.sourceId === requirement.sourceId : true
    );
    const excludedForRequirement = excludedPayloads.filter((excluded) => excluded.payloadType === requirement.payloadType);

    if (selectedForRequirement.length > 0) {
      negotiationDecisions.push({
        requirementId: requirement.id,
        payloadType: requirement.payloadType,
        status: excludedForRequirement.length > 0 ? "partially_satisfied" : "satisfied",
        selectedPayloadIds: selectedForRequirement.map((payload) => payload.id),
        excludedPayloadIds: excludedForRequirement.flatMap((excluded) => excluded.payloadId ? [excluded.payloadId] : []),
        missingPayloadCapabilityIds: [],
        detail: `Requirement ${requirement.id} satisfied by available payload(s).`,
      });
      continue;
    }

    const missingCapability = buildMissingCapability({
      payloadType: requirement.payloadType,
      requirement,
      registry,
      toolManifests: toolOutputManifestsConsidered,
      agentControl: input.agentControl,
      catalogResolution,
    });
    const missingLane = buildMissingLaneProposal({
      payloadType: requirement.payloadType,
      registry,
      missingCapability,
      catalogResolution,
    });
    missingPayloadCapabilities.push(missingCapability);
    missingContextLaneProposals.push(missingLane);
    excludedPayloads.push({
      payloadId: null,
      payloadType: requirement.payloadType,
      requirementId: requirement.id,
      reason: registry.has(requirement.payloadType)
        ? (registry.get(requirement.payloadType)?.executableNow === false ? "execution_not_available" : "payload_unavailable")
        : "not_registered",
      detail: missingCapability.reason,
      boundary: missingLane.boundary,
    });
    negotiationDecisions.push({
      requirementId: requirement.id,
      payloadType: requirement.payloadType,
      status: "missing",
      selectedPayloadIds: [],
      excludedPayloadIds: [],
      missingPayloadCapabilityIds: [missingCapability.id],
      detail: missingCapability.reason,
    });
    traceEvents.push(traceEvent({
      type: "missing_payload_recorded",
      payloadId: null,
      payloadType: requirement.payloadType,
      detail: missingCapability.reason,
      metadata: {
        missingCapability,
        missingLane,
      },
    }, input.now));
  }

  steps.push({
    stepId: `${planId}:missing`,
    kind: "record_missing_payloads",
    status: missingPayloadCapabilities.length > 0 ? "completed" : "skipped",
    boundary: "debug_trace",
    payloadIds: [],
    detail:
      missingPayloadCapabilities.length > 0
        ? `Recorded ${missingPayloadCapabilities.length} missing payload capability need(s).`
        : "No missing payload capabilities were recorded.",
  });
  steps.push({
    stepId: `${planId}:complete`,
    kind: "complete_transport_plan",
    status: "completed",
    boundary: "debug_trace",
    payloadIds: selectedPayloads.map((payload) => payload.id),
    detail: "Adaptive context transport planning completed without executing unavailable tools.",
  });
  traceEvents.push(traceEvent({
    type: "transport_completed",
    payloadId: null,
    payloadType: null,
    detail: `Selected ${selectedPayloads.length} payload(s); excluded ${excludedPayloads.length}; missing ${missingPayloadCapabilities.length}.`,
    metadata: {
      noUnavailableToolExecutionClaimed: true,
    },
  }, input.now));

  const plan: ContextTransportPlan = {
    planId,
    agentWorkPlanId: input.agentWorkPlan?.planId ?? null,
    agentWorkPlanTraceId: input.agentWorkPlan?.traceId ?? null,
    request: input.request ?? null,
    budget,
    requestedPayloads,
    availablePayloads,
    modelCapabilityManifest,
    toolOutputManifestsConsidered,
    steps,
    boundaries: unique(steps.map((step) => step.boundary)),
    relationshipToA03: {
      a03IsTextPackingLane: true,
      detail:
        "A-03 remains the deterministic text/artifact packing lane. A-04h negotiates payload transport across registry-driven lanes and routes only text-like payloads through A-03.",
    },
  };

  const result = {
    plan,
    selectedPayloads,
    compactedPayloads,
    excludedPayloads,
    eligibilityDecisions,
    negotiationDecisions,
    missingPayloadCapabilities,
    missingContextLaneProposals,
    a03PackingResults: [...(input.a03PackingResults ?? []), ...a03PackingResults],
    payloadsEligibleForArtifactPromotion: selectedPayloads
      .filter((payload) => payload.persistence.artifactEligible)
      .map((payload) => payload.id),
    payloadsEligibleForSourceObservation: selectedPayloads
      .filter((payload) => payload.persistence.sourceObservationEligible)
      .map((payload) => payload.id),
    persistedPayloadIds: selectedPayloads
      .filter((payload) => payload.persistence.alreadyPersisted)
      .map((payload) => payload.id),
    traceEvents,
    noUnavailableToolExecutionClaimed: true,
  } satisfies Omit<ContextTransportResult, "debugSnapshot">;

  return {
    ...result,
    debugSnapshot: debugSnapshot({
      plan,
      selectedPayloads,
      compactedPayloads,
      excludedPayloads,
      missingPayloadCapabilities,
      missingContextLaneProposals,
      traceEvents,
      catalogDebugSnapshot: catalogResolution.debugSnapshot,
      visualInspectionDebugSnapshot: input.visualInspectionDebugSnapshot ?? null,
    }),
  };
}
