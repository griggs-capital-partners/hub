import type { AgentControlDecision } from "./agent-control-surface";
import type {
  ContextPayloadRepresentation,
  ContextPayloadRequirement,
  ContextPayloadTypeDefinition,
  ModelCapabilityManifest,
  PayloadCompactionPolicy,
  PayloadToArtifactPolicy,
  PayloadToObservationPolicy,
  ToolOutputManifest,
  TransportBoundary,
} from "./adaptive-context-transport";
import type {
  InspectionCapability,
  ToolCostClass,
  ToolExecutionBoundary as InspectionToolExecutionBoundary,
  ToolLatencyClass,
  ToolSideEffectLevel,
} from "./inspection-tool-broker";
import {
  DEFAULT_CONTEXT_PROMPT_CACHE_STRATEGY,
  type ContextBudgetMode,
} from "./context-token-budget";
import {
  resolveModelBudgetModeDefaults,
  resolveModelBudgetProfile,
} from "./model-budget-profiles";

export type CatalogEntryKind = "payload" | "representation" | "lane" | "model" | "tool";

export type CatalogAvailabilityStatus =
  | "available"
  | "available_read_only"
  | "available_approval_required"
  | "unsupported"
  | "proposed"
  | "blocked"
  | "deprecated"
  | "unavailable_missing_connector"
  | "unavailable_missing_model_support"
  | "unavailable_missing_tool_implementation";

export type PayloadAvailabilityStatus = CatalogAvailabilityStatus;
export type ToolAvailabilityStatus = CatalogAvailabilityStatus;
export type ModelAvailabilityStatus = CatalogAvailabilityStatus;
export type LaneAvailabilityStatus = CatalogAvailabilityStatus;

export type PayloadRepresentationId =
  | "text"
  | "summary_text"
  | "json"
  | "structured"
  | "image_ref"
  | "file_ref"
  | "binary_ref"
  | "debug_trace";

export type CatalogBudgetClass =
  | "free_text"
  | "low_text"
  | "rich_media"
  | "external_metered"
  | "debug_only"
  | "unknown";

export type CatalogCostClass = ToolCostClass | "free_local" | "unknown";
export type CatalogLatencyClass = ToolLatencyClass | "unknown";

export type CatalogDataEgressClass = "none" | "internal" | "tenant" | "external" | "unknown";

export type CatalogSideEffectLevel = ToolSideEffectLevel | "none" | "unknown";

export type ToolBoundary =
  | "local_parser"
  | "memory_registry"
  | "debug_runtime"
  | "model_provider"
  | "future_extension"
  | "external_connector"
  | "blocked";

export type CatalogToolExecutionBoundary =
  | InspectionToolExecutionBoundary
  | "memory"
  | "debug_trace"
  | "not_executable";

export type CatalogSource = {
  sourceId: string;
  sourceType: "bootstrap_code" | "runtime_registration" | "test_fixture";
  label: string;
  version: string;
};

export type CatalogProvenance = {
  source: CatalogSource;
  registeredBy: string;
  registeredAt: string;
  rationale: string;
};

export type CatalogEntry = {
  catalogKind: CatalogEntryKind;
  displayName: string;
  description: string;
  availabilityStatus: CatalogAvailabilityStatus;
  limitations: string[];
  notes: string[];
  provenance: CatalogProvenance;
};

export type PayloadCatalogEntry = CatalogEntry & {
  catalogKind: "payload";
  payloadType: string;
  representations: PayloadRepresentationId[];
  isTextLike: boolean;
  isMultimodal: boolean;
  isPersistable: boolean;
  artifactEligibility: boolean;
  sourceObservationEligibility: boolean;
  contextDebtEligibility: boolean;
  capabilityGapEligibility: boolean;
  defaultBudgetClass: CatalogBudgetClass;
  defaultCompactionPolicy: PayloadCompactionPolicy;
  defaultExclusionPolicy: string;
  defaultBoundary: TransportBoundary;
  artifactPolicy: PayloadToArtifactPolicy;
  observationPolicy: PayloadToObservationPolicy;
  producerToolIds: string[];
  consumerModelIds: string[];
  consumerProfileIds: string[];
  fallbackPayloadTypes: string[];
};

export type PayloadRepresentationCatalogEntry = CatalogEntry & {
  catalogKind: "representation";
  representationId: PayloadRepresentationId;
  transportRepresentation: ContextPayloadRepresentation;
  modelCompatibilityNotes: string[];
  budgetAccountingUnit: "tokens" | "bytes" | "file_reference" | "image_reference" | "rows" | "debug_events";
  compactionBehavior: PayloadCompactionPolicy["strategy"];
  persistenceBehavior: "inline" | "reference_only" | "metadata_only" | "debug_only" | "not_persisted";
  unsupportedFutureNotes: string[];
};

export type TransportLaneCatalogEntry = CatalogEntry & {
  catalogKind: "lane";
  laneId: string;
  acceptedPayloadTypes: string[];
  acceptedRepresentations: PayloadRepresentationId[];
  currentAvailability: LaneAvailabilityStatus;
  executionBoundary: TransportBoundary;
  budgetClass: CatalogBudgetClass;
  usesA03PackingKernel: boolean;
  requiresApproval: boolean;
  sideEffectLevel: CatalogSideEffectLevel;
  missingCapabilityGapKind: string | null;
  fallbackLaneIds: string[];
};

export type ModelPayloadCompatibility = {
  payloadType: string;
  acceptedRepresentations: PayloadRepresentationId[];
  compatibility: "accepted" | "conceptual" | "unsupported";
  notes: string[];
};

export type ModelCatalogEntry = CatalogEntry & {
  catalogKind: "model";
  modelId: string;
  modelProfileId: string;
  provider: string;
  acceptedPayloadTypes: string[];
  acceptedRepresentations: PayloadRepresentationId[];
  maxTextTokens: number | null;
  maxOutputTokens: number | null;
  maxImageInputs: number | null;
  maxFileInputs: number | null;
  supportedFileTypes: string[];
  supportsVision: boolean;
  supportsNativePdf: boolean;
  supportsStructuredOutput: boolean;
  supportsToolCalling: boolean;
  costClass: "low" | "medium" | "high" | "variable" | "unknown";
  latencyClass: "sync_safe" | "async_preferred" | "batch_only" | "unknown";
  policyRestrictions: string[];
  payloadCompatibility: ModelPayloadCompatibility[];
};

export type ToolPayloadProductionCapability = {
  payloadType: string;
  representations: PayloadRepresentationId[];
  availabilityStatus: ToolAvailabilityStatus;
  confidenceSignals: string[];
  validationNeeds: string[];
};

export type ToolPayloadConsumptionRequirement = {
  payloadType: string;
  representations: PayloadRepresentationId[];
  required: boolean;
  notes: string[];
};

export type ToolCatalogEntry = CatalogEntry & {
  catalogKind: "tool";
  toolId: string;
  producedPayloadTypes: string[];
  requiredInputPayloadTypes: string[];
  outputRepresentations: PayloadRepresentationId[];
  outputConfidenceSignals: string[];
  outputValidationNeeds: string[];
  artifactTypesProduced: string[];
  sourceObservationTypesProduced: string[];
  costClass: CatalogCostClass;
  latencyClass: CatalogLatencyClass;
  dataEgressClass: CatalogDataEgressClass;
  sideEffectLevel: CatalogSideEffectLevel;
  toolBoundary: ToolBoundary;
  executionBoundary: CatalogToolExecutionBoundary;
  requiresApproval: boolean;
  isExecutable: boolean;
  fallbackCapabilities: InspectionCapability[];
  productionCapabilities: ToolPayloadProductionCapability[];
  consumptionRequirements: ToolPayloadConsumptionRequirement[];
};

export type CatalogValidationIssue = {
  code:
    | "duplicate_payload_type"
    | "duplicate_representation_id"
    | "duplicate_lane_id"
    | "duplicate_tool_id"
    | "duplicate_model_profile_id"
    | "tool_produces_unknown_payload"
    | "tool_requires_unknown_payload"
    | "model_accepts_unknown_payload"
    | "lane_accepts_unknown_payload"
    | "available_tool_without_outputs"
    | "available_model_without_payloads"
    | "unavailable_tool_marked_executable"
    | "executable_renderer_without_support"
    | "executable_vision_inspector_without_vision_model"
    | "available_payload_without_producer"
    | "missing_catalog_provenance";
  severity: "error" | "warning";
  catalogKind: CatalogEntryKind;
  entryId: string;
  message: string;
};

export type CatalogValidationResult = {
  valid: boolean;
  issues: CatalogValidationIssue[];
};

export type CatalogRegistrationPolicy = {
  allowDuplicateEntries: boolean;
  allowAvailablePayloadWithoutProducer: boolean;
  requireProvenance: boolean;
};

export type CatalogRenderedPageRendererSupport = {
  implementationAvailable: boolean;
  implementationId: string | null;
  cropRenderingAvailable: boolean;
  persistenceSupported: boolean;
};

export type CatalogVisionModelInspectorSupport = {
  adapterAvailable: boolean;
  adapterId: string | null;
  modelProfileId: string | null;
  modelId: string | null;
  provider: string | null;
  maxImageInputs: number | null;
  supportsStructuredOutput: boolean;
  requiresApproval: boolean;
  dataEgressClass: CatalogDataEgressClass;
};

export type CatalogRuntimeSupport = {
  renderedPageRenderer: CatalogRenderedPageRendererSupport;
  visionModelInspector: CatalogVisionModelInspectorSupport;
};

export type CatalogBootstrapOptions = {
  catalogId?: string;
  includeProposedEntries?: boolean;
  registrationPolicy?: Partial<CatalogRegistrationPolicy>;
  runtimeSupport?: Partial<{
    renderedPageRenderer: Partial<CatalogRenderedPageRendererSupport>;
    visionModelInspector: Partial<CatalogVisionModelInspectorSupport>;
  }>;
};

export type CatalogSnapshot = {
  catalogId: string;
  generatedAt: string;
  registrationPolicy: CatalogRegistrationPolicy;
  runtimeSupport: CatalogRuntimeSupport;
  payloadEntries: PayloadCatalogEntry[];
  representationEntries: PayloadRepresentationCatalogEntry[];
  transportLaneEntries: TransportLaneCatalogEntry[];
  modelEntries: ModelCatalogEntry[];
  toolEntries: ToolCatalogEntry[];
};

export type CatalogDiff = {
  addedEntryIds: string[];
  removedEntryIds: string[];
  changedEntryIds: string[];
};

export type CatalogDebugSnapshot = {
  catalogId: string;
  runtimeSupport: CatalogRuntimeSupport;
  payloadEntriesConsidered: Array<Pick<PayloadCatalogEntry, "payloadType" | "displayName" | "availabilityStatus" | "producerToolIds" | "fallbackPayloadTypes">>;
  representationEntriesConsidered: Array<Pick<PayloadRepresentationCatalogEntry, "representationId" | "transportRepresentation" | "availabilityStatus">>;
  modelEntriesConsidered: Array<Pick<ModelCatalogEntry, "modelProfileId" | "modelId" | "provider" | "availabilityStatus" | "supportsVision" | "supportsNativePdf">>;
  toolEntriesConsidered: Array<Pick<ToolCatalogEntry, "toolId" | "availabilityStatus" | "isExecutable" | "requiresApproval" | "producedPayloadTypes" | "executionBoundary">>;
  laneEntriesConsidered: Array<Pick<TransportLaneCatalogEntry, "laneId" | "currentAvailability" | "executionBoundary" | "usesA03PackingKernel" | "acceptedPayloadTypes">>;
  selectedAvailableProducerToolIds: string[];
  selectedConsumerModelProfileId: string | null;
  compatibleVisionModelProfileIds: string[];
  unavailableProducerToolsByPayloadType: Record<string, string[]>;
  mappingToAdaptiveTransport: {
    payloadDefinitionIds: string[];
    modelManifestIds: string[];
    toolManifestIds: string[];
  };
  validationIssues: CatalogValidationIssue[];
  agentControlAnnotations: string[];
  noUnavailableToolExecutionClaimed: true;
};

export type CatalogResolutionResult = {
  catalogId: string;
  snapshot: CatalogSnapshot;
  validation: CatalogValidationResult;
  payloadTypeDefinitions: ContextPayloadTypeDefinition[];
  modelCapabilityManifests: ModelCapabilityManifest[];
  toolOutputManifests: ToolOutputManifest[];
  selectedModelManifest: ModelCapabilityManifest;
  selectedAvailableProducerToolIds: string[];
  unavailableProducerToolsByPayloadType: Record<string, string[]>;
  recommendedPayloadRequirements: Array<Pick<ContextPayloadRequirement, "payloadType" | "reason" | "required">>;
  debugSnapshot: CatalogDebugSnapshot;
};

const BOOTSTRAP_SOURCE: CatalogSource = {
  sourceId: "a04i_catalog_bootstrap_v1",
  sourceType: "bootstrap_code",
  label: "A-04i Tool / Model / Payload Catalog Bootstrap v1",
  version: "a04i-v1",
};

const BOOTSTRAP_REGISTERED_AT = "2026-04-27T00:00:00.000Z";

const DEFAULT_REGISTRATION_POLICY: CatalogRegistrationPolicy = {
  allowDuplicateEntries: false,
  allowAvailablePayloadWithoutProducer: false,
  requireProvenance: true,
};

const DEFAULT_CATALOG_RUNTIME_SUPPORT: CatalogRuntimeSupport = {
  renderedPageRenderer: {
    implementationAvailable: false,
    implementationId: null,
    cropRenderingAvailable: false,
    persistenceSupported: false,
  },
  visionModelInspector: {
    adapterAvailable: false,
    adapterId: null,
    modelProfileId: null,
    modelId: null,
    provider: null,
    maxImageInputs: null,
    supportsStructuredOutput: false,
    requiresApproval: true,
    dataEgressClass: "unknown",
  },
};

function normalizeCatalogRuntimeSupport(
  support?: CatalogBootstrapOptions["runtimeSupport"] | CatalogRuntimeSupport | null
): CatalogRuntimeSupport {
  return {
    renderedPageRenderer: {
      ...DEFAULT_CATALOG_RUNTIME_SUPPORT.renderedPageRenderer,
      ...(support?.renderedPageRenderer ?? {}),
    },
    visionModelInspector: {
      ...DEFAULT_CATALOG_RUNTIME_SUPPORT.visionModelInspector,
      ...(support?.visionModelInspector ?? {}),
    },
  };
}

function visualAvailabilityStatus(params: {
  available: boolean;
  approvalRequired?: boolean;
  unavailableStatus: CatalogAvailabilityStatus;
}): CatalogAvailabilityStatus {
  if (!params.available) return params.unavailableStatus;
  return params.approvalRequired ? "available_approval_required" : "available";
}

function provenance(rationale: string): CatalogProvenance {
  return {
    source: BOOTSTRAP_SOURCE,
    registeredBy: "catalog_bootstrap",
    registeredAt: BOOTSTRAP_REGISTERED_AT,
    rationale,
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
  "Text-like payloads can route through the single A-03 Context Packing Kernel lane."
);

const METADATA_ONLY_COMPACTION = compactionPolicy(
  "metadata_only",
  "Catalog entry is represented as metadata until a richer executable lane exists."
);

const FUTURE_UNSUPPORTED_COMPACTION = compactionPolicy(
  "not_supported",
  "Catalog entry is known, but no executable transport lane exists in this pass."
);

function isAvailableStatus(status: CatalogAvailabilityStatus) {
  return status === "available" || status === "available_read_only" || status === "available_approval_required";
}

function isUnavailableStatus(status: CatalogAvailabilityStatus) {
  return !isAvailableStatus(status);
}

function representationToTransport(representation: PayloadRepresentationId): ContextPayloadRepresentation {
  switch (representation) {
    case "structured":
      return "structured_data";
    case "image_ref":
      return "image";
    case "file_ref":
      return "native_file";
    case "binary_ref":
      return "binary_reference";
    default:
      return representation;
  }
}

function unique<T>(values: T[]) {
  return Array.from(new Set(values));
}

function payloadStatusToTransportStatus(status: PayloadAvailabilityStatus): ContextPayloadTypeDefinition["status"] {
  if (status === "available" || status === "available_read_only" || status === "available_approval_required") {
    return "known";
  }
  return status === "proposed" ? "proposed" : "unsupported";
}

function payloadEntry(params: Omit<PayloadCatalogEntry, "catalogKind" | "provenance"> & { rationale: string }): PayloadCatalogEntry {
  return {
    ...params,
    catalogKind: "payload",
    provenance: provenance(params.rationale),
  };
}

function representationEntry(
  params: Omit<PayloadRepresentationCatalogEntry, "catalogKind" | "provenance"> & { rationale: string }
): PayloadRepresentationCatalogEntry {
  return {
    ...params,
    catalogKind: "representation",
    provenance: provenance(params.rationale),
  };
}

function laneEntry(params: Omit<TransportLaneCatalogEntry, "catalogKind" | "provenance"> & { rationale: string }): TransportLaneCatalogEntry {
  return {
    ...params,
    catalogKind: "lane",
    provenance: provenance(params.rationale),
  };
}

function modelEntry(params: Omit<ModelCatalogEntry, "catalogKind" | "provenance"> & { rationale: string }): ModelCatalogEntry {
  return {
    ...params,
    catalogKind: "model",
    provenance: provenance(params.rationale),
  };
}

function toolEntry(params: Omit<ToolCatalogEntry, "catalogKind" | "provenance"> & { rationale: string }): ToolCatalogEntry {
  return {
    ...params,
    catalogKind: "tool",
    provenance: provenance(params.rationale),
  };
}

function payloadProduction(
  payloadType: string,
  representations: PayloadRepresentationId[],
  availabilityStatus: ToolAvailabilityStatus,
  confidenceSignals: string[],
  validationNeeds: string[]
): ToolPayloadProductionCapability {
  return { payloadType, representations, availabilityStatus, confidenceSignals, validationNeeds };
}

function payloadConsumption(
  payloadType: string,
  representations: PayloadRepresentationId[],
  required: boolean,
  notes: string[] = []
): ToolPayloadConsumptionRequirement {
  return { payloadType, representations, required, notes };
}

function defaultPayloadEntries(support: CatalogRuntimeSupport = DEFAULT_CATALOG_RUNTIME_SUPPORT) {
  const textConsumers = ["text_only_context_model_profile"];
  const renderedPageAvailable = support.renderedPageRenderer.implementationAvailable;
  const pageCropAvailable = renderedPageAvailable && support.renderedPageRenderer.cropRenderingAvailable;
  const visionAvailable = support.visionModelInspector.adapterAvailable;
  const visionModelProfileId = support.visionModelInspector.modelProfileId ?? "future_vision_model_profile";
  return [
    payloadEntry({
      payloadType: "text_excerpt",
      displayName: "Text excerpt",
      description: "Parser or source text excerpt that can enter the deterministic text context lane.",
      availabilityStatus: "available",
      representations: ["text", "summary_text"],
      isTextLike: true,
      isMultimodal: false,
      isPersistable: true,
      artifactEligibility: true,
      sourceObservationEligibility: true,
      contextDebtEligibility: false,
      capabilityGapEligibility: false,
      defaultBudgetClass: "free_text",
      defaultCompactionPolicy: TEXT_LIKE_COMPACTION,
      defaultExclusionPolicy: "exclude only for policy, approval, model incompatibility, or A-03 budget pressure",
      defaultBoundary: "a03_text_packing_kernel",
      artifactPolicy: artifactPolicy("eligible_for_artifact_promotion", ["source_memory"], "May become source learning through the existing artifact promotion seam."),
      observationPolicy: observationPolicy("eligible_for_source_observation", ["parser_text_excerpt", "extracted_text_chunk"], "May persist as SourceObservation substrate."),
      producerToolIds: ["parser_text_extraction"],
      consumerModelIds: [],
      consumerProfileIds: textConsumers,
      fallbackPayloadTypes: ["knowledge_artifact", "source_observation"],
      limitations: [],
      notes: ["Current safe default; no OCR, rendering, vision, or external API execution is implied."],
      rationale: "A-04h already transports parser text through A-03.",
    }),
    payloadEntry({
      payloadType: "knowledge_artifact",
      displayName: "Knowledge artifact",
      description: "Durable ConversationDocumentKnowledgeArtifact rendered as reusable memory.",
      availabilityStatus: "available",
      representations: ["text", "json", "summary_text"],
      isTextLike: true,
      isMultimodal: false,
      isPersistable: true,
      artifactEligibility: true,
      sourceObservationEligibility: false,
      contextDebtEligibility: false,
      capabilityGapEligibility: false,
      defaultBudgetClass: "free_text",
      defaultCompactionPolicy: TEXT_LIKE_COMPACTION,
      defaultExclusionPolicy: "prefer active artifacts; preserve source location and limitations",
      defaultBoundary: "artifact_memory",
      artifactPolicy: artifactPolicy("already_knowledge_artifact", ["document_summary", "table_candidate", "source_memory"], "Already persisted in the KnowledgeArtifact table."),
      observationPolicy: observationPolicy("not_observation", [], "Artifacts are promoted durable memory, not raw source observations."),
      producerToolIds: ["artifact_reuse"],
      consumerModelIds: [],
      consumerProfileIds: textConsumers,
      fallbackPayloadTypes: ["source_observation", "text_excerpt"],
      limitations: [],
      notes: ["Current safe default; reuse only, no fake promotion execution."],
      rationale: "A-05a provides durable knowledge artifacts for reuse.",
    }),
    payloadEntry({
      payloadType: "source_observation",
      displayName: "Source observation",
      description: "Raw extracted source substrate from parser text, persisted observations, or future inspections.",
      availabilityStatus: "available",
      representations: ["text", "json", "structured"],
      isTextLike: true,
      isMultimodal: false,
      isPersistable: true,
      artifactEligibility: true,
      sourceObservationEligibility: true,
      contextDebtEligibility: false,
      capabilityGapEligibility: false,
      defaultBudgetClass: "free_text",
      defaultCompactionPolicy: TEXT_LIKE_COMPACTION,
      defaultExclusionPolicy: "preserve locator, confidence, extraction method, and limitations",
      defaultBoundary: "source_observation_memory",
      artifactPolicy: artifactPolicy("eligible_for_artifact_promotion", ["source_summary", "metric_measurement", "table_structured_data"], "Can feed the existing artifact promotion seam."),
      observationPolicy: observationPolicy("already_source_observation", ["parser_text_excerpt", "extracted_text_chunk"], "Already conforms to SourceObservation semantics."),
      producerToolIds: ["parser_text_extraction", "source_observation_reuse"],
      consumerModelIds: [],
      consumerProfileIds: textConsumers,
      fallbackPayloadTypes: ["text_excerpt", "knowledge_artifact"],
      limitations: [],
      notes: ["Current safe default; future inspections may also produce this payload type."],
      rationale: "Source learning already stores and reuses observations.",
    }),
    payloadEntry({
      payloadType: "context_debt",
      displayName: "Context debt",
      description: "Durable missing, weak, stale, or incomplete source understanding.",
      availabilityStatus: "available",
      representations: ["summary_text", "json"],
      isTextLike: true,
      isMultimodal: false,
      isPersistable: true,
      artifactEligibility: true,
      sourceObservationEligibility: false,
      contextDebtEligibility: true,
      capabilityGapEligibility: false,
      defaultBudgetClass: "free_text",
      defaultCompactionPolicy: TEXT_LIKE_COMPACTION,
      defaultExclusionPolicy: "include open or relevant limitations when they affect answer faithfulness",
      defaultBoundary: "context_registry",
      artifactPolicy: artifactPolicy("diagnostic_artifact_only", ["open_question"], "Diagnostic memory routes through existing ContextDebtRecord semantics."),
      observationPolicy: observationPolicy("not_observation", [], "Context debt is diagnostic memory, not raw source observation."),
      producerToolIds: ["context_debt_registry"],
      consumerModelIds: [],
      consumerProfileIds: textConsumers,
      fallbackPayloadTypes: ["capability_gap", "source_coverage"],
      limitations: [],
      notes: ["Current safe default using existing registry records."],
      rationale: "A-04f/A-04g introduced durable context debt semantics.",
    }),
    payloadEntry({
      payloadType: "capability_gap",
      displayName: "Capability gap",
      description: "Durable missing capability, context lane, model support, or tool proposal.",
      availabilityStatus: "available",
      representations: ["summary_text", "json"],
      isTextLike: true,
      isMultimodal: false,
      isPersistable: true,
      artifactEligibility: true,
      sourceObservationEligibility: false,
      contextDebtEligibility: false,
      capabilityGapEligibility: true,
      defaultBudgetClass: "free_text",
      defaultCompactionPolicy: TEXT_LIKE_COMPACTION,
      defaultExclusionPolicy: "include gaps that explain missing high-fidelity context or tools",
      defaultBoundary: "context_registry",
      artifactPolicy: artifactPolicy("diagnostic_artifact_only", ["source_memory"], "Diagnostic memory routes through existing CapabilityGapRecord semantics."),
      observationPolicy: observationPolicy("not_observation", [], "Capability gaps are system capability memory, not source observations."),
      producerToolIds: ["capability_gap_registry"],
      consumerModelIds: [],
      consumerProfileIds: textConsumers,
      fallbackPayloadTypes: ["context_debt", "source_coverage"],
      limitations: [],
      notes: ["Current safe default using existing registry records."],
      rationale: "A-04f/A-04g introduced durable capability gap semantics.",
    }),
    payloadEntry({
      payloadType: "source_coverage",
      displayName: "Source coverage",
      description: "Durable coverage status for pages, tables, documents, or source collections.",
      availabilityStatus: "available",
      representations: ["summary_text", "json"],
      isTextLike: true,
      isMultimodal: false,
      isPersistable: true,
      artifactEligibility: true,
      sourceObservationEligibility: false,
      contextDebtEligibility: false,
      capabilityGapEligibility: false,
      defaultBudgetClass: "free_text",
      defaultCompactionPolicy: TEXT_LIKE_COMPACTION,
      defaultExclusionPolicy: "include when coverage status changes answer confidence",
      defaultBoundary: "context_registry",
      artifactPolicy: artifactPolicy("diagnostic_artifact_only", ["source_memory"], "Coverage uses existing SourceCoverageRecord semantics."),
      observationPolicy: observationPolicy("not_observation", [], "Coverage is inspection status, not raw source observation."),
      producerToolIds: ["source_coverage_registry"],
      consumerModelIds: [],
      consumerProfileIds: textConsumers,
      fallbackPayloadTypes: ["context_debt", "capability_gap"],
      limitations: [],
      notes: ["Current safe default using existing registry records."],
      rationale: "Source coverage explains what is known and not known about source spans.",
    }),
    payloadEntry({
      payloadType: "inspection_trace",
      displayName: "Inspection trace",
      description: "Runtime inspection or broker trace intended for debug and Inspector parity.",
      availabilityStatus: "available",
      representations: ["debug_trace", "summary_text", "json"],
      isTextLike: true,
      isMultimodal: false,
      isPersistable: true,
      artifactEligibility: false,
      sourceObservationEligibility: false,
      contextDebtEligibility: false,
      capabilityGapEligibility: false,
      defaultBudgetClass: "debug_only",
      defaultCompactionPolicy: TEXT_LIKE_COMPACTION,
      defaultExclusionPolicy: "debug visibility only; keep rendered context text private",
      defaultBoundary: "debug_trace",
      artifactPolicy: artifactPolicy("not_artifact", [], "Trace payloads are debug records unless a future policy promotes them."),
      observationPolicy: observationPolicy("not_observation", [], "Trace payloads are not source observations."),
      producerToolIds: ["context_debug_trace"],
      consumerModelIds: [],
      consumerProfileIds: textConsumers,
      fallbackPayloadTypes: ["async_work_summary"],
      limitations: [],
      notes: ["Debug payloads are visible in snapshots, not external execution."],
      rationale: "A-04h already emits debug traces for transport inspection.",
    }),
    payloadEntry({
      payloadType: "async_work_summary",
      displayName: "Async work summary",
      description: "Async Agent Work Queue snapshot or work item summary.",
      availabilityStatus: "available",
      representations: ["summary_text", "json"],
      isTextLike: true,
      isMultimodal: false,
      isPersistable: true,
      artifactEligibility: true,
      sourceObservationEligibility: false,
      contextDebtEligibility: false,
      capabilityGapEligibility: false,
      defaultBudgetClass: "free_text",
      defaultCompactionPolicy: TEXT_LIKE_COMPACTION,
      defaultExclusionPolicy: "summary only; do not claim deferred tools executed",
      defaultBoundary: "async_work_queue",
      artifactPolicy: artifactPolicy("diagnostic_artifact_only", ["open_question", "source_memory"], "Async summaries can link to existing async/debt/gap records."),
      observationPolicy: observationPolicy("not_observation", [], "Async work summary is workflow memory, not raw observation."),
      producerToolIds: ["async_work_queue"],
      consumerModelIds: [],
      consumerProfileIds: textConsumers,
      fallbackPayloadTypes: ["context_debt", "capability_gap"],
      limitations: [],
      notes: ["Current safe default summarizing existing work queue state only."],
      rationale: "A-04g/A-05a context can include async work summary payloads.",
    }),
    payloadEntry({
      payloadType: "artifact_promotion_candidate",
      displayName: "Artifact promotion candidate",
      description: "Candidate from the A-05a source-learning promotion seam.",
      availabilityStatus: "available",
      representations: ["summary_text", "json"],
      isTextLike: true,
      isMultimodal: false,
      isPersistable: true,
      artifactEligibility: true,
      sourceObservationEligibility: false,
      contextDebtEligibility: false,
      capabilityGapEligibility: false,
      defaultBudgetClass: "free_text",
      defaultCompactionPolicy: TEXT_LIKE_COMPACTION,
      defaultExclusionPolicy: "candidate only; no fake LLM promotion",
      defaultBoundary: "artifact_memory",
      artifactPolicy: artifactPolicy("eligible_for_artifact_promotion", ["source_summary", "metric_measurement", "table_structured_data"], "Candidate is eligible for existing deterministic promotion evaluation."),
      observationPolicy: observationPolicy("not_observation", [], "Promotion candidates are derived from SourceObservations."),
      producerToolIds: ["artifact_promotion_seam"],
      consumerModelIds: [],
      consumerProfileIds: textConsumers,
      fallbackPayloadTypes: ["source_observation"],
      limitations: ["Does not imply full LLM artifact lifecycle execution."],
      notes: ["Current safe default for existing non-LLM seam behavior."],
      rationale: "A-05a added deterministic artifact promotion candidates.",
    }),
    payloadEntry({
      payloadType: "artifact_promotion_result",
      displayName: "Artifact promotion result",
      description: "Accepted or rejected result from the source-learning promotion seam.",
      availabilityStatus: "available",
      representations: ["summary_text", "json"],
      isTextLike: true,
      isMultimodal: false,
      isPersistable: true,
      artifactEligibility: true,
      sourceObservationEligibility: false,
      contextDebtEligibility: false,
      capabilityGapEligibility: false,
      defaultBudgetClass: "free_text",
      defaultCompactionPolicy: TEXT_LIKE_COMPACTION,
      defaultExclusionPolicy: "decision only; preserve validation state and source refs",
      defaultBoundary: "artifact_memory",
      artifactPolicy: artifactPolicy("already_knowledge_artifact", ["source_memory"], "Accepted results route through existing KnowledgeArtifact persistence."),
      observationPolicy: observationPolicy("not_observation", [], "Promotion results are decisions, not raw observations."),
      producerToolIds: ["artifact_promotion_seam"],
      consumerModelIds: [],
      consumerProfileIds: textConsumers,
      fallbackPayloadTypes: ["knowledge_artifact", "source_observation"],
      limitations: ["Does not imply full LLM artifact lifecycle execution."],
      notes: ["Current safe default for existing non-LLM seam behavior."],
      rationale: "A-05a added deterministic artifact promotion decisions.",
    }),
    payloadEntry({
      payloadType: "structured_table",
      displayName: "Structured table",
      description: "Rows, columns, cells, or table-shaped data recovered by a future table parser or document-AI path.",
      availabilityStatus: "proposed",
      representations: ["structured", "json", "summary_text"],
      isTextLike: false,
      isMultimodal: false,
      isPersistable: true,
      artifactEligibility: true,
      sourceObservationEligibility: true,
      contextDebtEligibility: false,
      capabilityGapEligibility: false,
      defaultBudgetClass: "rich_media",
      defaultCompactionPolicy: METADATA_ONLY_COMPACTION,
      defaultExclusionPolicy: "catalog-only until a table recovery lane exists",
      defaultBoundary: "future_tool_boundary",
      artifactPolicy: artifactPolicy("future_artifact_type_needed", ["table_extraction"], "A future table recovery lane can promote this as structured table artifact memory."),
      observationPolicy: observationPolicy("future_observation_type_needed", ["structured_table_observation"], "A future table recovery lane can persist this as SourceObservation substrate."),
      producerToolIds: ["document_ai_table_extractor", "future_table_parser"],
      consumerModelIds: [],
      consumerProfileIds: ["text_only_context_model_profile"],
      fallbackPayloadTypes: ["text_excerpt", "source_observation", "knowledge_artifact"],
      limitations: ["No executable structured-table recovery tool exists in A-04i."],
      notes: ["Represents the T5 page 15 unresolved-table gap without executing recovery."],
      rationale: "A-04i must catalog structured table support as future/proposed only.",
    }),
    payloadEntry({
      payloadType: "rendered_page_image",
      displayName: "Rendered page image",
      description: "Full rendered page bitmap or image reference.",
      availabilityStatus: renderedPageAvailable ? "available_read_only" : "unavailable_missing_tool_implementation",
      representations: ["image_ref", "binary_ref"],
      isTextLike: false,
      isMultimodal: true,
      isPersistable: false,
      artifactEligibility: true,
      sourceObservationEligibility: true,
      contextDebtEligibility: false,
      capabilityGapEligibility: true,
      defaultBudgetClass: "rich_media",
      defaultCompactionPolicy: renderedPageAvailable ? METADATA_ONLY_COMPACTION : FUTURE_UNSUPPORTED_COMPACTION,
      defaultExclusionPolicy: renderedPageAvailable
        ? "include only when a renderer-produced runtime image reference exists and the consuming model/lane accepts it"
        : "blocked until rendered page renderer exists",
      defaultBoundary: renderedPageAvailable ? "in_memory" : "future_tool_boundary",
      artifactPolicy: artifactPolicy("future_artifact_type_needed", ["figure_interpretation", "table_candidate"], "Future rendered/vision pack may derive artifacts."),
      observationPolicy: observationPolicy(
        renderedPageAvailable ? "eligible_for_source_observation" : "future_observation_type_needed",
        ["rendered_page_image"],
        renderedPageAvailable
          ? "A-04j can emit source-grounded rendered-page image references when an actual renderer runs."
          : "No rendered-page SourceObservation execution exists without an enabled A-04j renderer."
      ),
      producerToolIds: ["rendered_page_renderer"],
      consumerModelIds: [],
      consumerProfileIds: [visionModelProfileId],
      fallbackPayloadTypes: ["text_excerpt", "source_observation", "knowledge_artifact"],
      limitations: renderedPageAvailable
        ? [
            support.renderedPageRenderer.persistenceSupported
              ? "Rendered images follow the configured artifact/file storage policy."
              : "Rendered image references are runtime-safe and not persisted as binary DB blobs.",
          ]
        : ["No rendered-page execution is implemented or invoked."],
      notes: renderedPageAvailable
        ? [`A-04j renderer support enabled by ${support.renderedPageRenderer.implementationId ?? "runtime support flag"}.`]
        : ["Catalog-only capability gap until A-04j renderer support is configured."],
      rationale: "Rendered pages are required for high-fidelity visual recovery, but availability must follow actual renderer support.",
    }),
    payloadEntry({
      payloadType: "page_crop_image",
      displayName: "Page crop image",
      description: "Rendered crop around a table, chart, figure, or selected page region.",
      availabilityStatus: pageCropAvailable ? "available_read_only" : "unavailable_missing_tool_implementation",
      representations: ["image_ref", "binary_ref"],
      isTextLike: false,
      isMultimodal: true,
      isPersistable: false,
      artifactEligibility: true,
      sourceObservationEligibility: true,
      contextDebtEligibility: false,
      capabilityGapEligibility: true,
      defaultBudgetClass: "rich_media",
      defaultCompactionPolicy: pageCropAvailable ? METADATA_ONLY_COMPACTION : FUTURE_UNSUPPORTED_COMPACTION,
      defaultExclusionPolicy: pageCropAvailable
        ? "include only when explicit crop coordinates or a supported crop planner produced a real crop"
        : "blocked until rendered page crop support exists",
      defaultBoundary: pageCropAvailable ? "in_memory" : "future_tool_boundary",
      artifactPolicy: artifactPolicy("future_artifact_type_needed", ["figure_interpretation", "table_candidate"], "Future rendered/vision pack may derive artifacts."),
      observationPolicy: observationPolicy(
        pageCropAvailable ? "eligible_for_source_observation" : "future_observation_type_needed",
        ["page_crop_image"],
        pageCropAvailable
          ? "A-04j can emit source-grounded crop image references when explicit crop geometry is supplied or planned."
          : "No page-crop SourceObservation execution exists without enabled crop rendering."
      ),
      producerToolIds: ["rendered_page_renderer"],
      consumerModelIds: [],
      consumerProfileIds: [visionModelProfileId],
      fallbackPayloadTypes: ["text_excerpt", "source_observation", "knowledge_artifact"],
      limitations: pageCropAvailable
        ? [
            "Crop payloads require explicit crop coordinates or a supported crop planner; A-04j must not invent crop coordinates.",
          ]
        : ["No page-crop rendering execution is implemented or invoked."],
      notes: pageCropAvailable
        ? [`A-04j crop support enabled by ${support.renderedPageRenderer.implementationId ?? "runtime support flag"}.`]
        : ["Catalog-only capability gap until A-04j crop support is configured."],
      rationale: "Page crops bridge rendered pages and visual inspection only when crop support actually exists.",
    }),
    payloadEntry({
      payloadType: "native_file_reference",
      displayName: "Native file reference",
      description: "Pointer to a source file suitable for a model or tool that supports native file input.",
      availabilityStatus: "unavailable_missing_connector",
      representations: ["file_ref", "binary_ref"],
      isTextLike: false,
      isMultimodal: true,
      isPersistable: false,
      artifactEligibility: false,
      sourceObservationEligibility: true,
      contextDebtEligibility: false,
      capabilityGapEligibility: true,
      defaultBudgetClass: "rich_media",
      defaultCompactionPolicy: METADATA_ONLY_COMPACTION,
      defaultExclusionPolicy: "blocked until a governed native file connector exists",
      defaultBoundary: "future_tool_boundary",
      artifactPolicy: artifactPolicy("not_artifact", [], "Native file reference is transport substrate, not durable source learning by itself."),
      observationPolicy: observationPolicy("future_observation_type_needed", ["connector_file_snapshot"], "A connector/file snapshot lane would own persistence."),
      producerToolIds: ["sharepoint_file_connector"],
      consumerModelIds: [],
      consumerProfileIds: ["future_native_file_model_profile", "future_vision_model_profile"],
      fallbackPayloadTypes: ["text_excerpt", "source_observation"],
      limitations: ["No SharePoint/company connector or native file transport execution exists in A-04i."],
      notes: ["Catalog-only connector gap."],
      rationale: "Native file references must be visible before implementing connector execution.",
    }),
    payloadEntry({
      payloadType: "ocr_text",
      displayName: "OCR text",
      description: "Text recovered from rendered or scanned images.",
      availabilityStatus: "unavailable_missing_tool_implementation",
      representations: ["text", "json"],
      isTextLike: true,
      isMultimodal: false,
      isPersistable: true,
      artifactEligibility: true,
      sourceObservationEligibility: true,
      contextDebtEligibility: false,
      capabilityGapEligibility: true,
      defaultBudgetClass: "rich_media",
      defaultCompactionPolicy: FUTURE_UNSUPPORTED_COMPACTION,
      defaultExclusionPolicy: "blocked until OCR extractor exists",
      defaultBoundary: "future_tool_boundary",
      artifactPolicy: artifactPolicy("eligible_for_artifact_promotion", ["source_memory", "table_extraction"], "Future OCR output can feed artifact promotion."),
      observationPolicy: observationPolicy("future_observation_type_needed", ["ocr_text"], "No OCR SourceObservation execution exists in A-04i."),
      producerToolIds: ["ocr_extractor"],
      consumerModelIds: [],
      consumerProfileIds: textConsumers,
      fallbackPayloadTypes: ["text_excerpt", "source_observation", "knowledge_artifact"],
      limitations: ["No OCR execution is implemented or invoked."],
      notes: ["Catalog-only capability gap for future A-04k."],
      rationale: "OCR must be represented honestly before execution exists.",
    }),
    payloadEntry({
      payloadType: "vision_observation",
      displayName: "Vision observation",
      description: "Model or tool visual observation of a page, crop, figure, chart, or table.",
      availabilityStatus: visualAvailabilityStatus({
        available: visionAvailable,
        approvalRequired: support.visionModelInspector.requiresApproval,
        unavailableStatus: "unavailable_missing_model_support",
      }),
      representations: ["summary_text", "json"],
      isTextLike: true,
      isMultimodal: true,
      isPersistable: true,
      artifactEligibility: true,
      sourceObservationEligibility: true,
      contextDebtEligibility: false,
      capabilityGapEligibility: true,
      defaultBudgetClass: "rich_media",
      defaultCompactionPolicy: visionAvailable ? TEXT_LIKE_COMPACTION : FUTURE_UNSUPPORTED_COMPACTION,
      defaultExclusionPolicy: visionAvailable
        ? "include only when an approved configured vision adapter actually produced the observation"
        : "blocked until governed vision model adapter exists",
      defaultBoundary: visionAvailable ? "source_observation_memory" : "future_tool_boundary",
      artifactPolicy: artifactPolicy("eligible_for_artifact_promotion", ["figure_interpretation", "table_extraction"], "Future vision output can feed artifact promotion."),
      observationPolicy: observationPolicy(
        visionAvailable ? "eligible_for_source_observation" : "future_observation_type_needed",
        ["vision_observation"],
        visionAvailable
          ? "A-04j can convert actual vision adapter results into SourceObservation-compatible records."
          : "No vision SourceObservation execution exists without an enabled model adapter."
      ),
      producerToolIds: ["model_vision_inspector"],
      consumerModelIds: [],
      consumerProfileIds: ["text_only_context_model_profile", visionModelProfileId],
      fallbackPayloadTypes: ["text_excerpt", "source_observation", "knowledge_artifact"],
      limitations: visionAvailable
        ? ["Vision observations are model observations with confidence and limitations; they are not OCR or document-AI output."]
        : ["No vision model execution is implemented or invoked."],
      notes: visionAvailable
        ? [`A-04j vision adapter support enabled by ${support.visionModelInspector.adapterId ?? "runtime support flag"}.`]
        : ["Catalog-only capability gap until A-04j vision support is configured."],
      rationale: "Vision observations must be inspectable and executable only when a compatible configured adapter exists.",
    }),
    payloadEntry({
      payloadType: "document_ai_result",
      displayName: "Document AI result",
      description: "Specialized document-AI extraction result.",
      availabilityStatus: "unavailable_missing_tool_implementation",
      representations: ["json", "structured", "summary_text"],
      isTextLike: true,
      isMultimodal: false,
      isPersistable: true,
      artifactEligibility: true,
      sourceObservationEligibility: true,
      contextDebtEligibility: false,
      capabilityGapEligibility: true,
      defaultBudgetClass: "external_metered",
      defaultCompactionPolicy: FUTURE_UNSUPPORTED_COMPACTION,
      defaultExclusionPolicy: "blocked until document-AI extractor exists and is approved",
      defaultBoundary: "future_tool_boundary",
      artifactPolicy: artifactPolicy("eligible_for_artifact_promotion", ["table_extraction", "source_memory"], "Future document-AI output can feed artifact promotion."),
      observationPolicy: observationPolicy("future_observation_type_needed", ["document_ai_result"], "No document-AI SourceObservation execution exists in A-04i."),
      producerToolIds: ["document_ai_table_extractor"],
      consumerModelIds: [],
      consumerProfileIds: ["text_only_context_model_profile", "future_native_file_model_profile"],
      fallbackPayloadTypes: ["text_excerpt", "source_observation", "knowledge_artifact"],
      limitations: ["No document-AI execution or external API is implemented or invoked."],
      notes: ["Catalog-only capability gap for future A-04k."],
      rationale: "Document-AI must be visible as unavailable before recovery tooling exists.",
    }),
    payloadEntry({
      payloadType: "spreadsheet_range",
      displayName: "Spreadsheet range",
      description: "Structured spreadsheet range from parser output or future connector reads.",
      availabilityStatus: "proposed",
      representations: ["structured", "json", "summary_text"],
      isTextLike: false,
      isMultimodal: false,
      isPersistable: true,
      artifactEligibility: true,
      sourceObservationEligibility: true,
      contextDebtEligibility: false,
      capabilityGapEligibility: true,
      defaultBudgetClass: "rich_media",
      defaultCompactionPolicy: METADATA_ONLY_COMPACTION,
      defaultExclusionPolicy: "blocked until spreadsheet range reader is normalized as a transport tool",
      defaultBoundary: "future_tool_boundary",
      artifactPolicy: artifactPolicy("eligible_for_artifact_promotion", ["table_extraction"], "Can become structured source learning when parser/connector output is normalized."),
      observationPolicy: observationPolicy("eligible_for_source_observation", ["spreadsheet_range"], "Existing SourceObservation types already name spreadsheet ranges."),
      producerToolIds: ["spreadsheet_range_reader"],
      consumerModelIds: [],
      consumerProfileIds: ["text_only_context_model_profile"],
      fallbackPayloadTypes: ["text_excerpt", "source_observation"],
      limitations: ["No spreadsheet connector execution is added in A-04i."],
      notes: ["Catalog-only until an existing parser path is promoted into a tool boundary."],
      rationale: "Spreadsheet payloads need catalog visibility without adding connector execution.",
    }),
    payloadEntry({
      payloadType: "spreadsheet_formula_map",
      displayName: "Spreadsheet formula map",
      description: "Formula/dependency map for spreadsheet cells.",
      availabilityStatus: "proposed",
      representations: ["structured", "json", "summary_text"],
      isTextLike: false,
      isMultimodal: false,
      isPersistable: true,
      artifactEligibility: true,
      sourceObservationEligibility: true,
      contextDebtEligibility: false,
      capabilityGapEligibility: true,
      defaultBudgetClass: "rich_media",
      defaultCompactionPolicy: METADATA_ONLY_COMPACTION,
      defaultExclusionPolicy: "blocked until spreadsheet formula reader is normalized as a transport tool",
      defaultBoundary: "future_tool_boundary",
      artifactPolicy: artifactPolicy("future_artifact_type_needed", ["source_memory"], "Future spreadsheet formula analysis can produce artifacts."),
      observationPolicy: observationPolicy("eligible_for_source_observation", ["spreadsheet_formula_map"], "Existing SourceObservation types already name formula maps."),
      producerToolIds: ["spreadsheet_range_reader"],
      consumerModelIds: [],
      consumerProfileIds: ["text_only_context_model_profile"],
      fallbackPayloadTypes: ["text_excerpt", "source_observation"],
      limitations: ["No spreadsheet connector execution is added in A-04i."],
      notes: ["Catalog-only until an existing parser path is promoted into a tool boundary."],
      rationale: "Spreadsheet formula payloads need catalog visibility without connector execution.",
    }),
    payloadEntry({
      payloadType: "tool_observation",
      displayName: "Tool observation",
      description: "Generic internal tool observation payload from a future normalized tool boundary.",
      availabilityStatus: "proposed",
      representations: ["summary_text", "json"],
      isTextLike: true,
      isMultimodal: false,
      isPersistable: true,
      artifactEligibility: true,
      sourceObservationEligibility: true,
      contextDebtEligibility: false,
      capabilityGapEligibility: true,
      defaultBudgetClass: "debug_only",
      defaultCompactionPolicy: METADATA_ONLY_COMPACTION,
      defaultExclusionPolicy: "catalog-only unless produced by an existing safe tool boundary",
      defaultBoundary: "debug_trace",
      artifactPolicy: artifactPolicy("eligible_for_artifact_promotion", ["source_memory"], "Only source-grounded tool observations should be promoted."),
      observationPolicy: observationPolicy("eligible_for_source_observation", ["tool_observation"], "Existing SourceObservation types already name tool observations."),
      producerToolIds: ["context_debug_trace"],
      consumerModelIds: [],
      consumerProfileIds: textConsumers,
      fallbackPayloadTypes: ["inspection_trace"],
      limitations: ["No new tool execution path is added for generic observations in A-04i."],
      notes: ["Representable as a future normalization point."],
      rationale: "A-04i catalogs tool observation as a future extension point.",
    }),
    payloadEntry({
      payloadType: "creation_plan",
      displayName: "Creation plan",
      description: "Future deliverable creation planning payload.",
      availabilityStatus: "proposed",
      representations: ["summary_text", "json"],
      isTextLike: true,
      isMultimodal: false,
      isPersistable: true,
      artifactEligibility: true,
      sourceObservationEligibility: false,
      contextDebtEligibility: false,
      capabilityGapEligibility: true,
      defaultBudgetClass: "free_text",
      defaultCompactionPolicy: METADATA_ONLY_COMPACTION,
      defaultExclusionPolicy: "blocked until creation quality pipeline exists",
      defaultBoundary: "future_tool_boundary",
      artifactPolicy: artifactPolicy("future_artifact_type_needed", ["source_memory"], "Creation pipeline is not implemented in A-04i."),
      observationPolicy: observationPolicy("not_observation", [], "Creation plans are workflow payloads, not source observations."),
      producerToolIds: ["creation_pipeline"],
      consumerModelIds: [],
      consumerProfileIds: textConsumers,
      fallbackPayloadTypes: ["knowledge_artifact", "context_debt", "capability_gap", "source_coverage"],
      limitations: ["No creation pipeline execution is implemented or invoked."],
      notes: ["Catalog-only capability gap for future A-06."],
      rationale: "Highest-fidelity creation should expose the missing creation pipeline honestly.",
    }),
    payloadEntry({
      payloadType: "validation_result",
      displayName: "Validation result",
      description: "Future claim, source, or deliverable validation result payload.",
      availabilityStatus: "proposed",
      representations: ["summary_text", "json"],
      isTextLike: true,
      isMultimodal: false,
      isPersistable: true,
      artifactEligibility: true,
      sourceObservationEligibility: false,
      contextDebtEligibility: false,
      capabilityGapEligibility: true,
      defaultBudgetClass: "free_text",
      defaultCompactionPolicy: METADATA_ONLY_COMPACTION,
      defaultExclusionPolicy: "blocked until validation pipeline exists",
      defaultBoundary: "future_tool_boundary",
      artifactPolicy: artifactPolicy("future_artifact_type_needed", ["source_memory"], "Validation pipeline is not implemented in A-04i."),
      observationPolicy: observationPolicy("not_observation", [], "Validation results are workflow payloads, not raw observations."),
      producerToolIds: ["creation_pipeline"],
      consumerModelIds: [],
      consumerProfileIds: textConsumers,
      fallbackPayloadTypes: ["knowledge_artifact", "source_observation", "source_coverage"],
      limitations: ["No validation pipeline execution is implemented or invoked."],
      notes: ["Catalog-only capability gap for future A-06."],
      rationale: "Highest-fidelity creation should expose the missing validation pipeline honestly.",
    }),
  ] satisfies PayloadCatalogEntry[];
}

function defaultRepresentationEntries() {
  return [
    representationEntry({
      representationId: "text",
      transportRepresentation: "text",
      displayName: "Text",
      description: "Inline text suitable for token accounting and A-03 packing.",
      availabilityStatus: "available",
      modelCompatibilityNotes: ["Accepted by the current text-only profile."],
      budgetAccountingUnit: "tokens",
      compactionBehavior: "a03_text_pack",
      persistenceBehavior: "inline",
      unsupportedFutureNotes: [],
      limitations: [],
      notes: [],
      rationale: "Text is the current deterministic transport substrate.",
    }),
    representationEntry({
      representationId: "summary_text",
      transportRepresentation: "summary_text",
      displayName: "Summary text",
      description: "Compact text summary of memory, diagnostics, or workflow state.",
      availabilityStatus: "available",
      modelCompatibilityNotes: ["Accepted by the current text-only profile."],
      budgetAccountingUnit: "tokens",
      compactionBehavior: "a03_text_pack",
      persistenceBehavior: "inline",
      unsupportedFutureNotes: [],
      limitations: [],
      notes: [],
      rationale: "Summary text keeps diagnostic payloads compact.",
    }),
    representationEntry({
      representationId: "json",
      transportRepresentation: "json",
      displayName: "JSON",
      description: "Structured JSON value carried inline or summarized.",
      availabilityStatus: "available",
      modelCompatibilityNotes: ["Accepted by the current profile when serialized or summarized."],
      budgetAccountingUnit: "tokens",
      compactionBehavior: "metadata_only",
      persistenceBehavior: "inline",
      unsupportedFutureNotes: [],
      limitations: ["Large JSON payloads should be summarized before transport."],
      notes: [],
      rationale: "JSON is already used for debug and source-learning metadata.",
    }),
    representationEntry({
      representationId: "structured",
      transportRepresentation: "structured_data",
      displayName: "Structured data",
      description: "Rows, cells, ranges, or typed data shapes.",
      availabilityStatus: "proposed",
      modelCompatibilityNotes: ["Currently represented by summaries unless future structured lanes exist."],
      budgetAccountingUnit: "rows",
      compactionBehavior: "metadata_only",
      persistenceBehavior: "metadata_only",
      unsupportedFutureNotes: ["Requires table/spreadsheet normalization before full execution."],
      limitations: ["No new structured extraction execution is implemented in A-04i."],
      notes: [],
      rationale: "Structured table and spreadsheet payloads need a durable catalog slot.",
    }),
    representationEntry({
      representationId: "image_ref",
      transportRepresentation: "image",
      displayName: "Image reference",
      description: "Reference to a rendered page, page crop, chart, or figure image.",
      availabilityStatus: "unavailable_missing_tool_implementation",
      modelCompatibilityNotes: ["Requires a future vision-capable model profile."],
      budgetAccountingUnit: "image_reference",
      compactionBehavior: "not_supported",
      persistenceBehavior: "reference_only",
      unsupportedFutureNotes: ["No rendered-page or vision execution exists in A-04i."],
      limitations: ["Catalog-only; no image payloads are generated."],
      notes: [],
      rationale: "Rendered-page and vision gaps need explicit representation metadata.",
    }),
    representationEntry({
      representationId: "file_ref",
      transportRepresentation: "native_file",
      displayName: "File reference",
      description: "Reference to a native source file for a future connector or native-file model lane.",
      availabilityStatus: "unavailable_missing_connector",
      modelCompatibilityNotes: ["Requires a future native-file model profile or governed connector."],
      budgetAccountingUnit: "file_reference",
      compactionBehavior: "not_supported",
      persistenceBehavior: "reference_only",
      unsupportedFutureNotes: ["No SharePoint/company connector or native file execution exists in A-04i."],
      limitations: ["Catalog-only; no connector reads are performed."],
      notes: [],
      rationale: "Native file references must be modeled before connector execution exists.",
    }),
    representationEntry({
      representationId: "binary_ref",
      transportRepresentation: "binary_reference",
      displayName: "Binary reference",
      description: "Reference to binary content managed outside the prompt payload.",
      availabilityStatus: "unavailable_missing_tool_implementation",
      modelCompatibilityNotes: ["Requires future binary-aware tools or model adapters."],
      budgetAccountingUnit: "bytes",
      compactionBehavior: "not_supported",
      persistenceBehavior: "reference_only",
      unsupportedFutureNotes: ["No binary transport execution exists in A-04i."],
      limitations: ["Catalog-only."],
      notes: [],
      rationale: "Binary references are future substrate for images and native files.",
    }),
    representationEntry({
      representationId: "debug_trace",
      transportRepresentation: "debug_trace",
      displayName: "Debug trace",
      description: "Structured runtime trace intended for inspector/debug visibility.",
      availabilityStatus: "available",
      modelCompatibilityNotes: ["Summaries can be carried by the current text profile."],
      budgetAccountingUnit: "debug_events",
      compactionBehavior: "a03_text_pack",
      persistenceBehavior: "debug_only",
      unsupportedFutureNotes: [],
      limitations: [],
      notes: ["Rendered context text remains private in debug traces."],
      rationale: "A-04h already exposes transport debug traces.",
    }),
  ] satisfies PayloadRepresentationCatalogEntry[];
}

function defaultModelEntries(support: CatalogRuntimeSupport = DEFAULT_CATALOG_RUNTIME_SUPPORT) {
  const textPayloads = [
    "text_excerpt",
    "knowledge_artifact",
    "source_observation",
    "context_debt",
    "capability_gap",
    "source_coverage",
    "inspection_trace",
    "async_work_summary",
    "artifact_promotion_candidate",
    "artifact_promotion_result",
    "tool_observation",
    "creation_plan",
    "validation_result",
    "ocr_text",
    "vision_observation",
    "document_ai_result",
  ];
  const visionSupport = support.visionModelInspector;
  const visionModelAvailable = visionSupport.adapterAvailable;
  const visionModelProfileId = visionSupport.modelProfileId ?? "future_vision_model_profile";
  const visionModelId = visionSupport.modelId ?? visionModelProfileId;
  const visionProvider = visionSupport.provider ?? (visionModelAvailable ? "configured_vision_model_provider" : "catalog_profile_only");
  const visionImagePayloads = ["rendered_page_image", "page_crop_image"];
  const visionPayloads = [...visionImagePayloads, "vision_observation", "native_file_reference"];
  const visionRepresentations: PayloadRepresentationId[] = visionModelAvailable
    ? ["image_ref", "binary_ref", "summary_text", "json"]
    : ["image_ref", "binary_ref", "file_ref", "summary_text", "json"];
  return [
    modelEntry({
      modelId: "text_only_context_model_profile",
      modelProfileId: "text_only_context_model_profile",
      provider: "configured_llm_provider",
      displayName: "Text-only context model profile",
      description: "Current safe model profile for text, JSON summaries, diagnostics, and structured summaries.",
      availabilityStatus: "available",
      acceptedPayloadTypes: textPayloads,
      acceptedRepresentations: ["text", "summary_text", "json", "structured", "debug_trace"],
      maxTextTokens: null,
      maxOutputTokens: null,
      maxImageInputs: 0,
      maxFileInputs: 0,
      supportedFileTypes: [],
      supportsVision: false,
      supportsNativePdf: false,
      supportsStructuredOutput: true,
      supportsToolCalling: true,
      costClass: "unknown",
      latencyClass: "sync_safe",
      policyRestrictions: ["No rendered-page, OCR, vision, document-AI, browser, connector, or external API execution in A-04i."],
      payloadCompatibility: textPayloads.map((payloadType) => ({
        payloadType,
        acceptedRepresentations: ["text", "summary_text", "json", "structured", "debug_trace"],
        compatibility: "accepted",
        notes: ["Accepted only when payload content already exists inside current safe boundaries."],
      })),
      limitations: ["Vision, native PDF, and native file lanes are not available in this pass."],
      notes: ["Profile, not a concrete provider override."],
      rationale: "Matches the existing A-04h text-only behavior.",
    }),
    modelEntry({
      modelId: visionModelId,
      modelProfileId: visionModelProfileId,
      provider: visionProvider,
      displayName: visionModelAvailable ? "Configured vision model profile" : "Future vision model profile",
      description: visionModelAvailable
        ? "Configured model profile for A-04j rendered-page and crop vision inspection."
        : "Conceptual model profile for rendered pages, crops, and visual observations.",
      availabilityStatus: visualAvailabilityStatus({
        available: visionModelAvailable,
        approvalRequired: visionSupport.requiresApproval,
        unavailableStatus: "unavailable_missing_model_support",
      }),
      acceptedPayloadTypes: visionPayloads,
      acceptedRepresentations: visionRepresentations,
      maxTextTokens: null,
      maxOutputTokens: null,
      maxImageInputs: visionModelAvailable ? Math.max(1, visionSupport.maxImageInputs ?? 4) : null,
      maxFileInputs: null,
      supportedFileTypes: visionModelAvailable ? ["image/png", "image/jpeg", "image/webp", "image/svg+xml"] : [],
      supportsVision: true,
      supportsNativePdf: false,
      supportsStructuredOutput: visionSupport.supportsStructuredOutput,
      supportsToolCalling: false,
      costClass: "unknown",
      latencyClass: "async_preferred",
      policyRestrictions: visionModelAvailable
        ? [
            "Must execute only through the configured A-04j vision inspection adapter.",
            visionSupport.requiresApproval ? "Requires approval before model vision execution." : "Execution is allowed inside current policy when budget permits.",
          ]
        : ["Catalog-only; must not be selected for execution until a real adapter exists."],
      payloadCompatibility: visionPayloads.map((payloadType) => ({
        payloadType,
        acceptedRepresentations: visionRepresentations,
        compatibility: visionModelAvailable && (visionImagePayloads.includes(payloadType) || payloadType === "vision_observation")
          ? "accepted"
          : "conceptual",
        notes: visionModelAvailable
          ? ["Accepted only for image payloads or already-produced vision observations inside A-04j policy gates."]
          : ["Future-only compatibility. No execution adapter exists in A-04i."],
      })),
      limitations: visionModelAvailable
        ? ["Vision observations are not OCR, document-AI, or structured table extraction."]
        : ["No vision adapter is implemented."],
      notes: visionModelAvailable
        ? [`Vision adapter ${visionSupport.adapterId ?? "configured_adapter"} supplies this profile.`]
        : ["Explains missing visual support without implying provider availability."],
      rationale: "A-04j attaches concrete vision support only when a compatible configured adapter exists.",
    }),
    modelEntry({
      modelId: "future_native_file_model_profile",
      modelProfileId: "future_native_file_model_profile",
      provider: "catalog_profile_only",
      displayName: "Future native file model profile",
      description: "Conceptual model profile for native files and document-AI outputs.",
      availabilityStatus: "unavailable_missing_model_support",
      acceptedPayloadTypes: ["native_file_reference", "document_ai_result", "structured_table"],
      acceptedRepresentations: ["file_ref", "binary_ref", "json", "structured", "summary_text"],
      maxTextTokens: null,
      maxOutputTokens: null,
      maxImageInputs: null,
      maxFileInputs: null,
      supportedFileTypes: [],
      supportsVision: false,
      supportsNativePdf: true,
      supportsStructuredOutput: true,
      supportsToolCalling: false,
      costClass: "unknown",
      latencyClass: "async_preferred",
      policyRestrictions: ["Catalog-only; must not be selected for execution until a real adapter exists."],
      payloadCompatibility: ["native_file_reference", "document_ai_result", "structured_table"].map((payloadType) => ({
        payloadType,
        acceptedRepresentations: ["file_ref", "binary_ref", "json", "structured", "summary_text"],
        compatibility: "conceptual",
        notes: ["Future-only compatibility. No native-file adapter exists in A-04i."],
      })),
      limitations: ["No native PDF or native file adapter is implemented."],
      notes: ["Explains missing native file support without implying provider availability."],
      rationale: "A future connector/native-file pass can attach concrete support later.",
    }),
  ] satisfies ModelCatalogEntry[];
}

function defaultToolEntries(support: CatalogRuntimeSupport = DEFAULT_CATALOG_RUNTIME_SUPPORT) {
  const rendererAvailable = support.renderedPageRenderer.implementationAvailable;
  const cropAvailable = rendererAvailable && support.renderedPageRenderer.cropRenderingAvailable;
  const rendererPayloadStatus: ToolAvailabilityStatus = rendererAvailable ? "available_read_only" : "unavailable_missing_tool_implementation";
  const visionAvailable = support.visionModelInspector.adapterAvailable;
  const visionToolStatus = visualAvailabilityStatus({
    available: visionAvailable,
    approvalRequired: support.visionModelInspector.requiresApproval,
    unavailableStatus: "unavailable_missing_model_support",
  }) satisfies ToolAvailabilityStatus;
  return [
    toolEntry({
      toolId: "parser_text_extraction",
      displayName: "Parser text extraction",
      description: "Existing local parser behavior that produces text excerpts and source observations.",
      availabilityStatus: "available_read_only",
      producedPayloadTypes: ["text_excerpt", "source_observation"],
      requiredInputPayloadTypes: [],
      outputRepresentations: ["text", "json"],
      outputConfidenceSignals: ["parser_extraction_status", "visual_classification_confidence"],
      outputValidationNeeds: ["source_location", "parser_limitations"],
      artifactTypesProduced: ["table_candidate", "extraction_warning", "document_summary"],
      sourceObservationTypesProduced: ["parser_text_excerpt", "extracted_text_chunk", "spreadsheet_range"],
      costClass: "free_local",
      latencyClass: "sync_safe",
      dataEgressClass: "none",
      sideEffectLevel: "read_only",
      toolBoundary: "local_parser",
      executionBoundary: "in_process",
      requiresApproval: false,
      isExecutable: true,
      fallbackCapabilities: ["rendered_page_inspection", "ocr", "vision_page_understanding", "document_ai_table_recovery"],
      productionCapabilities: [
        payloadProduction("text_excerpt", ["text"], "available_read_only", ["parser_extraction_status"], ["source_location"]),
        payloadProduction("source_observation", ["text", "json"], "available_read_only", ["parser_extraction_status"], ["source_location", "limitations"]),
      ],
      consumptionRequirements: [],
      limitations: ["Does not execute OCR, vision, rendering, document AI, browser automation, or external APIs."],
      notes: ["Current safe default."],
      rationale: "Existing parser behavior is already available inside document ingestion.",
    }),
    toolEntry({
      toolId: "artifact_reuse",
      displayName: "Artifact reuse",
      description: "Reuse already-persisted KnowledgeArtifacts.",
      availabilityStatus: "available_read_only",
      producedPayloadTypes: ["knowledge_artifact"],
      requiredInputPayloadTypes: [],
      outputRepresentations: ["text", "json", "summary_text"],
      outputConfidenceSignals: ["artifact_status", "artifact_confidence", "artifact_freshness"],
      outputValidationNeeds: ["source_location", "artifact_status"],
      artifactTypesProduced: [],
      sourceObservationTypesProduced: [],
      costClass: "free_local",
      latencyClass: "sync_safe",
      dataEgressClass: "none",
      sideEffectLevel: "none",
      toolBoundary: "memory_registry",
      executionBoundary: "memory",
      requiresApproval: false,
      isExecutable: true,
      fallbackCapabilities: [],
      productionCapabilities: [payloadProduction("knowledge_artifact", ["text", "json", "summary_text"], "available_read_only", ["artifact_status"], ["source_location"])],
      consumptionRequirements: [],
      limitations: [],
      notes: ["Reuses existing memory only."],
      rationale: "Knowledge artifacts are already persisted and selected for context.",
    }),
    toolEntry({
      toolId: "source_observation_reuse",
      displayName: "Source observation reuse",
      description: "Reuse already-persisted SourceObservation substrate.",
      availabilityStatus: "available_read_only",
      producedPayloadTypes: ["source_observation"],
      requiredInputPayloadTypes: [],
      outputRepresentations: ["text", "json", "structured"],
      outputConfidenceSignals: ["observation_confidence", "extraction_method"],
      outputValidationNeeds: ["source_locator", "limitations"],
      artifactTypesProduced: [],
      sourceObservationTypesProduced: [],
      costClass: "free_local",
      latencyClass: "sync_safe",
      dataEgressClass: "none",
      sideEffectLevel: "none",
      toolBoundary: "memory_registry",
      executionBoundary: "memory",
      requiresApproval: false,
      isExecutable: true,
      fallbackCapabilities: [],
      productionCapabilities: [payloadProduction("source_observation", ["text", "json", "structured"], "available_read_only", ["observation_confidence"], ["source_locator"])],
      consumptionRequirements: [],
      limitations: [],
      notes: ["Reuses existing source-learning substrate only."],
      rationale: "Source observations are already persisted by source-learning semantics.",
    }),
    toolEntry({
      toolId: "context_debt_registry",
      displayName: "Context debt registry",
      description: "Expose existing ContextDebtRecord entries as transport payloads.",
      availabilityStatus: "available_read_only",
      producedPayloadTypes: ["context_debt"],
      requiredInputPayloadTypes: [],
      outputRepresentations: ["summary_text", "json"],
      outputConfidenceSignals: ["debt_status", "debt_severity"],
      outputValidationNeeds: ["source_locator", "resolution_path"],
      artifactTypesProduced: ["open_question"],
      sourceObservationTypesProduced: [],
      costClass: "free_local",
      latencyClass: "sync_safe",
      dataEgressClass: "none",
      sideEffectLevel: "none",
      toolBoundary: "memory_registry",
      executionBoundary: "memory",
      requiresApproval: false,
      isExecutable: true,
      fallbackCapabilities: [],
      productionCapabilities: [payloadProduction("context_debt", ["summary_text", "json"], "available_read_only", ["debt_status"], ["resolution_path"])],
      consumptionRequirements: [],
      limitations: [],
      notes: ["Read-only for transport summary purposes."],
      rationale: "Context debt is already durable registry memory.",
    }),
    toolEntry({
      toolId: "capability_gap_registry",
      displayName: "Capability gap registry",
      description: "Expose existing CapabilityGapRecord entries as transport payloads.",
      availabilityStatus: "available_read_only",
      producedPayloadTypes: ["capability_gap"],
      requiredInputPayloadTypes: [],
      outputRepresentations: ["summary_text", "json"],
      outputConfidenceSignals: ["gap_status", "gap_kind"],
      outputValidationNeeds: ["recommended_resolution"],
      artifactTypesProduced: ["source_memory"],
      sourceObservationTypesProduced: [],
      costClass: "free_local",
      latencyClass: "sync_safe",
      dataEgressClass: "none",
      sideEffectLevel: "none",
      toolBoundary: "memory_registry",
      executionBoundary: "memory",
      requiresApproval: false,
      isExecutable: true,
      fallbackCapabilities: [],
      productionCapabilities: [payloadProduction("capability_gap", ["summary_text", "json"], "available_read_only", ["gap_status"], ["recommended_resolution"])],
      consumptionRequirements: [],
      limitations: [],
      notes: ["Read-only for transport summary purposes."],
      rationale: "Capability gaps are already durable registry memory.",
    }),
    toolEntry({
      toolId: "source_coverage_registry",
      displayName: "Source coverage registry",
      description: "Expose source coverage records as transport payloads.",
      availabilityStatus: "available_read_only",
      producedPayloadTypes: ["source_coverage"],
      requiredInputPayloadTypes: [],
      outputRepresentations: ["summary_text", "json"],
      outputConfidenceSignals: ["coverage_status", "selected_candidate_count", "total_candidate_count"],
      outputValidationNeeds: ["coverage_target"],
      artifactTypesProduced: ["source_memory"],
      sourceObservationTypesProduced: [],
      costClass: "free_local",
      latencyClass: "sync_safe",
      dataEgressClass: "none",
      sideEffectLevel: "none",
      toolBoundary: "memory_registry",
      executionBoundary: "memory",
      requiresApproval: false,
      isExecutable: true,
      fallbackCapabilities: [],
      productionCapabilities: [payloadProduction("source_coverage", ["summary_text", "json"], "available_read_only", ["coverage_status"], ["coverage_target"])],
      consumptionRequirements: [],
      limitations: [],
      notes: ["Read-only for transport summary purposes."],
      rationale: "Source coverage is already durable context state.",
    }),
    toolEntry({
      toolId: "async_work_queue",
      displayName: "Async work queue",
      description: "Summarize existing async work for transport without running deferred capabilities.",
      availabilityStatus: "available_read_only",
      producedPayloadTypes: ["async_work_summary"],
      requiredInputPayloadTypes: ["context_debt", "capability_gap"],
      outputRepresentations: ["summary_text", "json"],
      outputConfidenceSignals: ["work_status", "deferred_capabilities"],
      outputValidationNeeds: ["no_unavailable_tool_execution_claimed"],
      artifactTypesProduced: [],
      sourceObservationTypesProduced: [],
      costClass: "free_local",
      latencyClass: "sync_safe",
      dataEgressClass: "none",
      sideEffectLevel: "none",
      toolBoundary: "memory_registry",
      executionBoundary: "memory",
      requiresApproval: false,
      isExecutable: true,
      fallbackCapabilities: [],
      productionCapabilities: [payloadProduction("async_work_summary", ["summary_text", "json"], "available_read_only", ["work_status"], ["no_unavailable_tool_execution_claimed"])],
      consumptionRequirements: [
        payloadConsumption("context_debt", ["summary_text", "json"], false),
        payloadConsumption("capability_gap", ["summary_text", "json"], false),
      ],
      limitations: ["Does not run missing tools."],
      notes: ["Read-only for transport summary purposes."],
      rationale: "Async work summary payloads already exist in A-04h.",
    }),
    toolEntry({
      toolId: "artifact_promotion_seam",
      displayName: "Artifact promotion seam",
      description: "Existing non-LLM source-learning promotion seam.",
      availabilityStatus: "available_read_only",
      producedPayloadTypes: ["artifact_promotion_candidate", "artifact_promotion_result"],
      requiredInputPayloadTypes: ["source_observation"],
      outputRepresentations: ["summary_text", "json"],
      outputConfidenceSignals: ["promotion_validation_state", "candidate_confidence"],
      outputValidationNeeds: ["source_observation_refs", "limitations", "confidence"],
      artifactTypesProduced: ["source_summary", "metric_measurement", "table_structured_data", "source_memory"],
      sourceObservationTypesProduced: [],
      costClass: "free_local",
      latencyClass: "sync_safe",
      dataEgressClass: "none",
      sideEffectLevel: "none",
      toolBoundary: "memory_registry",
      executionBoundary: "memory",
      requiresApproval: false,
      isExecutable: true,
      fallbackCapabilities: [],
      productionCapabilities: [
        payloadProduction("artifact_promotion_candidate", ["summary_text", "json"], "available_read_only", ["candidate_confidence"], ["source_observation_refs"]),
        payloadProduction("artifact_promotion_result", ["summary_text", "json"], "available_read_only", ["promotion_validation_state"], ["source_observation_refs"]),
      ],
      consumptionRequirements: [payloadConsumption("source_observation", ["text", "json", "structured"], true)],
      limitations: ["Does not fake full LLM promotion."],
      notes: ["Describes existing deterministic seam behavior only."],
      rationale: "A-05a source-learning tests already validate the seam.",
    }),
    toolEntry({
      toolId: "context_debug_trace",
      displayName: "Context debug trace",
      description: "Expose runtime trace/debug payloads for inspector visibility.",
      availabilityStatus: "available_read_only",
      producedPayloadTypes: ["inspection_trace", "tool_observation"],
      requiredInputPayloadTypes: [],
      outputRepresentations: ["debug_trace", "summary_text", "json"],
      outputConfidenceSignals: ["trace_event_count", "no_unavailable_tool_execution_claimed"],
      outputValidationNeeds: ["private_rendered_text_redacted"],
      artifactTypesProduced: [],
      sourceObservationTypesProduced: [],
      costClass: "free_local",
      latencyClass: "sync_safe",
      dataEgressClass: "none",
      sideEffectLevel: "none",
      toolBoundary: "debug_runtime",
      executionBoundary: "debug_trace",
      requiresApproval: false,
      isExecutable: true,
      fallbackCapabilities: [],
      productionCapabilities: [
        payloadProduction("inspection_trace", ["debug_trace", "summary_text", "json"], "available_read_only", ["trace_event_count"], ["private_rendered_text_redacted"]),
        payloadProduction("tool_observation", ["summary_text", "json"], "proposed", ["trace_event_count"], ["source_grounding"]),
      ],
      consumptionRequirements: [],
      limitations: ["Debug visibility only."],
      notes: ["Does not execute tools."],
      rationale: "A-04h exposes transport snapshots through debug traces.",
    }),
    toolEntry({
      toolId: "rendered_page_renderer",
      displayName: "Rendered page renderer",
      description: rendererAvailable
        ? "Configured renderer for full page images and explicit page crops."
        : "Renderer boundary for full page images and page crops.",
      availabilityStatus: rendererPayloadStatus,
      producedPayloadTypes: ["rendered_page_image", "page_crop_image"],
      requiredInputPayloadTypes: [],
      outputRepresentations: ["image_ref", "binary_ref"],
      outputConfidenceSignals: ["render_status", "page_geometry"],
      outputValidationNeeds: ["source_page_locator", "rendered_asset_reference"],
      artifactTypesProduced: [],
      sourceObservationTypesProduced: cropAvailable ? ["rendered_page_image", "page_crop_image"] : ["rendered_page_image"],
      costClass: rendererAvailable ? "free_local" : "unknown",
      latencyClass: rendererAvailable ? "sync_safe" : "async_preferred",
      dataEgressClass: "none",
      sideEffectLevel: "read_only",
      toolBoundary: "future_extension",
      executionBoundary: rendererAvailable ? "in_process" : "not_executable",
      requiresApproval: false,
      isExecutable: rendererAvailable,
      fallbackCapabilities: ["ocr", "vision_page_understanding"],
      productionCapabilities: [
        payloadProduction("rendered_page_image", ["image_ref", "binary_ref"], rendererPayloadStatus, ["render_status"], ["rendered_asset_reference"]),
        payloadProduction(
          "page_crop_image",
          ["image_ref", "binary_ref"],
          cropAvailable ? "available_read_only" : "unavailable_missing_tool_implementation",
          ["render_status"],
          ["crop_geometry"]
        ),
      ],
      consumptionRequirements: [],
      limitations: rendererAvailable
        ? [
            cropAvailable
              ? "Crop rendering requires explicit crop coordinates or a supported crop planner."
              : "Full-page rendering is available, but crop rendering support is not configured.",
          ]
        : ["No rendered-page execution is implemented or invoked."],
      notes: rendererAvailable
        ? [`A-04j renderer ${support.renderedPageRenderer.implementationId ?? "configured_renderer"} is executable inside its local boundary.`]
        : ["Candidate for A-04j."],
      rationale: "Explains rendered-page payload availability without executing unsupported rendering.",
    }),
    toolEntry({
      toolId: "model_vision_inspector",
      displayName: "Model vision inspector",
      description: visionAvailable
        ? "Configured model vision inspection of rendered pages or crops."
        : "Future vision model inspection of rendered pages, crops, or native file references.",
      availabilityStatus: visionToolStatus,
      producedPayloadTypes: ["vision_observation"],
      requiredInputPayloadTypes: ["rendered_page_image", "page_crop_image", "native_file_reference"],
      outputRepresentations: ["summary_text", "json"],
      outputConfidenceSignals: ["model_confidence", "visual_grounding"],
      outputValidationNeeds: ["source_image_reference", "no_invented_cells"],
      artifactTypesProduced: ["figure_interpretation", "table_extraction"],
      sourceObservationTypesProduced: ["vision_observation"],
      costClass: "unknown",
      latencyClass: "async_preferred",
      dataEgressClass: support.visionModelInspector.dataEgressClass,
      sideEffectLevel: "read_only",
      toolBoundary: "model_provider",
      executionBoundary: visionAvailable ? "model_provider" : "not_executable",
      requiresApproval: support.visionModelInspector.requiresApproval,
      isExecutable: visionAvailable,
      fallbackCapabilities: ["ocr", "document_ai_table_recovery"],
      productionCapabilities: [payloadProduction("vision_observation", ["summary_text", "json"], visionToolStatus, ["model_confidence"], ["source_image_reference"])],
      consumptionRequirements: [
        payloadConsumption("rendered_page_image", ["image_ref", "binary_ref"], false),
        payloadConsumption("page_crop_image", ["image_ref", "binary_ref"], false),
        payloadConsumption("native_file_reference", ["file_ref", "binary_ref"], false),
      ],
      limitations: visionAvailable
        ? ["Model vision observations are not OCR, document-AI, or structured table extraction."]
        : ["No vision execution or model adapter is implemented or invoked."],
      notes: visionAvailable
        ? [`A-04j vision adapter ${support.visionModelInspector.adapterId ?? "configured_adapter"} is executable through ${support.visionModelInspector.provider ?? "configured provider"}.`]
        : ["Candidate for A-04j."],
      rationale: "Explains missing vision observations without selecting future models or fake adapters.",
    }),
    toolEntry({
      toolId: "ocr_extractor",
      displayName: "OCR extractor",
      description: "Future OCR extractor for rendered or scanned content.",
      availabilityStatus: "unavailable_missing_tool_implementation",
      producedPayloadTypes: ["ocr_text"],
      requiredInputPayloadTypes: ["rendered_page_image", "page_crop_image"],
      outputRepresentations: ["text", "json"],
      outputConfidenceSignals: ["ocr_confidence", "page_region"],
      outputValidationNeeds: ["source_image_reference", "uncertain_tokens"],
      artifactTypesProduced: ["source_memory", "table_extraction"],
      sourceObservationTypesProduced: ["ocr_text"],
      costClass: "unknown",
      latencyClass: "async_preferred",
      dataEgressClass: "unknown",
      sideEffectLevel: "read_only",
      toolBoundary: "future_extension",
      executionBoundary: "not_executable",
      requiresApproval: true,
      isExecutable: false,
      fallbackCapabilities: ["vision_page_understanding", "document_ai_table_recovery"],
      productionCapabilities: [payloadProduction("ocr_text", ["text", "json"], "unavailable_missing_tool_implementation", ["ocr_confidence"], ["uncertain_tokens"])],
      consumptionRequirements: [
        payloadConsumption("rendered_page_image", ["image_ref", "binary_ref"], false),
        payloadConsumption("page_crop_image", ["image_ref", "binary_ref"], false),
      ],
      limitations: ["No OCR execution is implemented or invoked."],
      notes: ["Candidate for A-04k."],
      rationale: "Explains missing OCR payloads without executing OCR.",
    }),
    toolEntry({
      toolId: "document_ai_table_extractor",
      displayName: "Document-AI table extractor",
      description: "Future document-AI/table recovery tool.",
      availabilityStatus: "unavailable_missing_tool_implementation",
      producedPayloadTypes: ["document_ai_result", "structured_table"],
      requiredInputPayloadTypes: ["native_file_reference", "rendered_page_image", "page_crop_image"],
      outputRepresentations: ["json", "structured", "summary_text"],
      outputConfidenceSignals: ["table_confidence", "cell_confidence"],
      outputValidationNeeds: ["source_locator", "no_invented_cells", "table_schema"],
      artifactTypesProduced: ["table_extraction", "source_memory"],
      sourceObservationTypesProduced: ["document_ai_result", "structured_table_observation"],
      costClass: "unknown",
      latencyClass: "async_preferred",
      dataEgressClass: "unknown",
      sideEffectLevel: "read_only",
      toolBoundary: "future_extension",
      executionBoundary: "not_executable",
      requiresApproval: true,
      isExecutable: false,
      fallbackCapabilities: ["ocr", "vision_page_understanding"],
      productionCapabilities: [
        payloadProduction("document_ai_result", ["json", "structured", "summary_text"], "unavailable_missing_tool_implementation", ["table_confidence"], ["source_locator"]),
        payloadProduction("structured_table", ["structured", "json", "summary_text"], "proposed", ["cell_confidence"], ["table_schema"]),
      ],
      consumptionRequirements: [
        payloadConsumption("native_file_reference", ["file_ref", "binary_ref"], false),
        payloadConsumption("rendered_page_image", ["image_ref", "binary_ref"], false),
        payloadConsumption("page_crop_image", ["image_ref", "binary_ref"], false),
      ],
      limitations: ["No document-AI execution or external API is implemented or invoked."],
      notes: ["Candidate for A-04k."],
      rationale: "Explains missing document-AI/table recovery without executing it.",
    }),
    toolEntry({
      toolId: "spreadsheet_range_reader",
      displayName: "Spreadsheet range reader",
      description: "Future normalized spreadsheet range/formula reader.",
      availabilityStatus: "proposed",
      producedPayloadTypes: ["spreadsheet_range", "spreadsheet_formula_map"],
      requiredInputPayloadTypes: ["native_file_reference"],
      outputRepresentations: ["structured", "json", "summary_text"],
      outputConfidenceSignals: ["sheet_name", "range_address", "formula_count"],
      outputValidationNeeds: ["cell_range", "formula_dependencies"],
      artifactTypesProduced: ["table_extraction", "source_memory"],
      sourceObservationTypesProduced: ["spreadsheet_range", "spreadsheet_formula_map"],
      costClass: "free_local",
      latencyClass: "sync_safe",
      dataEgressClass: "none",
      sideEffectLevel: "read_only",
      toolBoundary: "future_extension",
      executionBoundary: "not_executable",
      requiresApproval: false,
      isExecutable: false,
      fallbackCapabilities: ["spreadsheet_inventory", "spreadsheet_formula_map"],
      productionCapabilities: [
        payloadProduction("spreadsheet_range", ["structured", "json", "summary_text"], "proposed", ["sheet_name", "range_address"], ["cell_range"]),
        payloadProduction("spreadsheet_formula_map", ["structured", "json", "summary_text"], "proposed", ["formula_count"], ["formula_dependencies"]),
      ],
      consumptionRequirements: [payloadConsumption("native_file_reference", ["file_ref", "binary_ref"], false)],
      limitations: ["No spreadsheet connector execution is added in A-04i."],
      notes: ["Catalog-only if absent from current parser flow."],
      rationale: "Spreadsheet payloads are represented without adding execution.",
    }),
    toolEntry({
      toolId: "sharepoint_file_connector",
      displayName: "SharePoint file connector",
      description: "Future SharePoint/OneDrive/company file read connector.",
      availabilityStatus: "unavailable_missing_connector",
      producedPayloadTypes: ["native_file_reference", "source_observation"],
      requiredInputPayloadTypes: [],
      outputRepresentations: ["file_ref", "json", "summary_text"],
      outputConfidenceSignals: ["connector_status", "file_version"],
      outputValidationNeeds: ["tenant_scope", "authorization", "file_identity"],
      artifactTypesProduced: [],
      sourceObservationTypesProduced: ["connector_file_snapshot"],
      costClass: "unknown",
      latencyClass: "async_preferred",
      dataEgressClass: "tenant",
      sideEffectLevel: "read_only",
      toolBoundary: "external_connector",
      executionBoundary: "not_executable",
      requiresApproval: true,
      isExecutable: false,
      fallbackCapabilities: ["source_connector_read"],
      productionCapabilities: [
        payloadProduction("native_file_reference", ["file_ref"], "unavailable_missing_connector", ["file_version"], ["authorization"]),
        payloadProduction("source_observation", ["json", "summary_text"], "unavailable_missing_connector", ["connector_status"], ["tenant_scope"]),
      ],
      consumptionRequirements: [],
      limitations: ["No SharePoint/company connector is implemented or invoked."],
      notes: ["Candidate for A-10."],
      rationale: "Connector gaps must be inspectable before company-file paths exist.",
    }),
    toolEntry({
      toolId: "creation_pipeline",
      displayName: "Creation pipeline",
      description: "Future report, deck, workbook creation quality pipeline.",
      availabilityStatus: "proposed",
      producedPayloadTypes: ["creation_plan", "validation_result"],
      requiredInputPayloadTypes: ["knowledge_artifact", "source_observation", "context_debt", "capability_gap", "source_coverage"],
      outputRepresentations: ["summary_text", "json"],
      outputConfidenceSignals: ["source_grounding", "validation_depth"],
      outputValidationNeeds: ["claim_source_mapping", "freshness", "completeness"],
      artifactTypesProduced: ["source_memory"],
      sourceObservationTypesProduced: [],
      costClass: "unknown",
      latencyClass: "async_preferred",
      dataEgressClass: "unknown",
      sideEffectLevel: "writes_internal_state",
      toolBoundary: "future_extension",
      executionBoundary: "not_executable",
      requiresApproval: true,
      isExecutable: false,
      fallbackCapabilities: ["artifact_summarization", "artifact_validation"],
      productionCapabilities: [
        payloadProduction("creation_plan", ["summary_text", "json"], "proposed", ["source_grounding"], ["claim_source_mapping"]),
        payloadProduction("validation_result", ["summary_text", "json"], "proposed", ["validation_depth"], ["freshness", "completeness"]),
      ],
      consumptionRequirements: [
        payloadConsumption("knowledge_artifact", ["text", "json", "summary_text"], true),
        payloadConsumption("source_observation", ["text", "json", "structured"], false),
        payloadConsumption("context_debt", ["summary_text", "json"], false),
        payloadConsumption("capability_gap", ["summary_text", "json"], false),
        payloadConsumption("source_coverage", ["summary_text", "json"], false),
      ],
      limitations: ["No creation pipeline is implemented or invoked."],
      notes: ["Candidate for A-06."],
      rationale: "Highest-fidelity creation should expose missing planning/validation capabilities.",
    }),
  ] satisfies ToolCatalogEntry[];
}

function defaultTransportLaneEntries(
  payloadEntries: PayloadCatalogEntry[],
  support: CatalogRuntimeSupport = DEFAULT_CATALOG_RUNTIME_SUPPORT
) {
  const textLikePayloads = payloadEntries.filter((entry) => entry.isTextLike).map((entry) => entry.payloadType);
  const renderedLaneStatus: LaneAvailabilityStatus = support.renderedPageRenderer.implementationAvailable
    ? "available_read_only"
    : "unavailable_missing_tool_implementation";
  const visionLaneStatus = visualAvailabilityStatus({
    available: support.visionModelInspector.adapterAvailable,
    approvalRequired: support.visionModelInspector.requiresApproval,
    unavailableStatus: "unavailable_missing_model_support",
  }) satisfies LaneAvailabilityStatus;
  return [
    laneEntry({
      laneId: "a03_text_packing_lane",
      displayName: "A-03 text packing lane",
      description: "The deterministic text/artifact Context Packing Kernel lane.",
      availabilityStatus: "available",
      acceptedPayloadTypes: textLikePayloads,
      acceptedRepresentations: ["text", "summary_text", "json", "debug_trace"],
      currentAvailability: "available",
      executionBoundary: "a03_text_packing_kernel",
      budgetClass: "free_text",
      usesA03PackingKernel: true,
      requiresApproval: false,
      sideEffectLevel: "none",
      missingCapabilityGapKind: null,
      fallbackLaneIds: [],
      limitations: ["A-03 is one text-like lane, not the full bridge."],
      notes: ["A-04h remains responsible for transport planning."],
      rationale: "A-03 remains the deterministic packing kernel for text-like payloads.",
    }),
    laneEntry({
      laneId: "memory_reuse_lane",
      displayName: "Memory reuse lane",
      description: "Read-only reuse of artifacts, observations, registries, async summaries, and debug traces.",
      availabilityStatus: "available_read_only",
      acceptedPayloadTypes: [
        "knowledge_artifact",
        "source_observation",
        "context_debt",
        "capability_gap",
        "source_coverage",
        "inspection_trace",
        "async_work_summary",
        "artifact_promotion_candidate",
        "artifact_promotion_result",
      ],
      acceptedRepresentations: ["text", "summary_text", "json", "debug_trace", "structured"],
      currentAvailability: "available_read_only",
      executionBoundary: "in_memory",
      budgetClass: "free_text",
      usesA03PackingKernel: false,
      requiresApproval: false,
      sideEffectLevel: "none",
      missingCapabilityGapKind: null,
      fallbackLaneIds: ["a03_text_packing_lane"],
      limitations: ["Memory reuse does not run missing extraction tools."],
      notes: ["Catalog lane for current safe reuse surfaces."],
      rationale: "Existing registries and artifacts are available without external execution.",
    }),
    laneEntry({
      laneId: "rendered_page_image_lane",
      displayName: "Rendered page image lane",
      description: support.renderedPageRenderer.implementationAvailable
        ? "Rendered-page and explicit-crop transport lane."
        : "Future rendered-page and crop transport lane.",
      availabilityStatus: renderedLaneStatus,
      acceptedPayloadTypes: ["rendered_page_image", "page_crop_image"],
      acceptedRepresentations: ["image_ref", "binary_ref"],
      currentAvailability: renderedLaneStatus,
      executionBoundary: support.renderedPageRenderer.implementationAvailable ? "in_memory" : "future_tool_boundary",
      budgetClass: "rich_media",
      usesA03PackingKernel: false,
      requiresApproval: false,
      sideEffectLevel: "read_only",
      missingCapabilityGapKind: "rendered_page_inspection",
      fallbackLaneIds: ["a03_text_packing_lane", "memory_reuse_lane"],
      limitations: support.renderedPageRenderer.implementationAvailable
        ? ["Lane carries only renderer-produced image references, never invented rendered-page evidence."]
        : ["No rendered-page execution exists without A-04j renderer support."],
      notes: support.renderedPageRenderer.implementationAvailable ? ["A-04j renderer lane enabled by runtime support."] : ["Candidate for A-04j."],
      rationale: "T5 page 15 needs this lane in a future pass.",
    }),
    laneEntry({
      laneId: "vision_observation_lane",
      displayName: "Vision observation lane",
      description: support.visionModelInspector.adapterAvailable
        ? "Model-vision observation transport lane."
        : "Future model-vision observation lane.",
      availabilityStatus: visionLaneStatus,
      acceptedPayloadTypes: ["vision_observation"],
      acceptedRepresentations: ["summary_text", "json"],
      currentAvailability: visionLaneStatus,
      executionBoundary: support.visionModelInspector.adapterAvailable ? "source_observation_memory" : "future_tool_boundary",
      budgetClass: "rich_media",
      usesA03PackingKernel: false,
      requiresApproval: support.visionModelInspector.requiresApproval,
      sideEffectLevel: "read_only",
      missingCapabilityGapKind: "vision_page_understanding",
      fallbackLaneIds: ["rendered_page_image_lane", "a03_text_packing_lane"],
      limitations: support.visionModelInspector.adapterAvailable
        ? ["Lane carries only actual vision adapter observations with confidence and limitations."]
        : ["No vision execution exists without a configured A-04j vision adapter."],
      notes: support.visionModelInspector.adapterAvailable ? ["A-04j vision lane enabled by runtime support."] : ["Candidate for A-04j."],
      rationale: "Vision observations are future-only until a governed model adapter exists.",
    }),
    laneEntry({
      laneId: "ocr_text_lane",
      displayName: "OCR text lane",
      description: "Future OCR text transport lane.",
      availabilityStatus: "unavailable_missing_tool_implementation",
      acceptedPayloadTypes: ["ocr_text"],
      acceptedRepresentations: ["text", "json"],
      currentAvailability: "unavailable_missing_tool_implementation",
      executionBoundary: "future_tool_boundary",
      budgetClass: "rich_media",
      usesA03PackingKernel: false,
      requiresApproval: true,
      sideEffectLevel: "read_only",
      missingCapabilityGapKind: "ocr",
      fallbackLaneIds: ["rendered_page_image_lane", "a03_text_packing_lane"],
      limitations: ["No OCR execution exists in A-04i."],
      notes: ["Candidate for A-04k."],
      rationale: "OCR output would become text-like only after future extraction.",
    }),
    laneEntry({
      laneId: "document_ai_table_lane",
      displayName: "Document-AI table lane",
      description: "Future document-AI and structured table recovery lane.",
      availabilityStatus: "unavailable_missing_tool_implementation",
      acceptedPayloadTypes: ["document_ai_result", "structured_table"],
      acceptedRepresentations: ["json", "structured", "summary_text"],
      currentAvailability: "unavailable_missing_tool_implementation",
      executionBoundary: "future_tool_boundary",
      budgetClass: "external_metered",
      usesA03PackingKernel: false,
      requiresApproval: true,
      sideEffectLevel: "read_only",
      missingCapabilityGapKind: "document_ai_table_recovery",
      fallbackLaneIds: ["a03_text_packing_lane", "memory_reuse_lane"],
      limitations: ["No document-AI execution or external API exists in A-04i."],
      notes: ["Candidate for A-04k."],
      rationale: "Structured table recovery must be cataloged before execution exists.",
    }),
    laneEntry({
      laneId: "native_file_reference_lane",
      displayName: "Native file reference lane",
      description: "Future native-file and company-file connector lane.",
      availabilityStatus: "unavailable_missing_connector",
      acceptedPayloadTypes: ["native_file_reference"],
      acceptedRepresentations: ["file_ref", "binary_ref"],
      currentAvailability: "unavailable_missing_connector",
      executionBoundary: "future_tool_boundary",
      budgetClass: "rich_media",
      usesA03PackingKernel: false,
      requiresApproval: true,
      sideEffectLevel: "read_only",
      missingCapabilityGapKind: "source_connector_read",
      fallbackLaneIds: ["a03_text_packing_lane", "memory_reuse_lane"],
      limitations: ["No SharePoint/company connector exists in A-04i."],
      notes: ["Candidate for A-10."],
      rationale: "Native references need a catalog slot before connector execution.",
    }),
    laneEntry({
      laneId: "creation_quality_lane",
      displayName: "Creation quality lane",
      description: "Future creation planning and validation lane.",
      availabilityStatus: "proposed",
      acceptedPayloadTypes: ["creation_plan", "validation_result"],
      acceptedRepresentations: ["summary_text", "json"],
      currentAvailability: "proposed",
      executionBoundary: "future_tool_boundary",
      budgetClass: "unknown",
      usesA03PackingKernel: false,
      requiresApproval: true,
      sideEffectLevel: "writes_internal_state",
      missingCapabilityGapKind: "artifact_validation",
      fallbackLaneIds: ["a03_text_packing_lane", "memory_reuse_lane"],
      limitations: ["No creation pipeline exists in A-04i."],
      notes: ["Candidate for A-06."],
      rationale: "Highest-fidelity creation should show missing planning and validation payloads.",
    }),
  ] satisfies TransportLaneCatalogEntry[];
}

export class CatalogBootstrap {
  readonly catalogId: string;
  readonly registrationPolicy: CatalogRegistrationPolicy;
  readonly runtimeSupport: CatalogRuntimeSupport;
  private readonly payloadEntries: PayloadCatalogEntry[] = [];
  private readonly representationEntries: PayloadRepresentationCatalogEntry[] = [];
  private readonly transportLaneEntries: TransportLaneCatalogEntry[] = [];
  private readonly modelEntries: ModelCatalogEntry[] = [];
  private readonly toolEntries: ToolCatalogEntry[] = [];

  constructor(options: CatalogBootstrapOptions = {}) {
    this.catalogId = options.catalogId ?? "default_context_catalog_bootstrap_v1";
    this.registrationPolicy = {
      ...DEFAULT_REGISTRATION_POLICY,
      ...(options.registrationPolicy ?? {}),
    };
    this.runtimeSupport = normalizeCatalogRuntimeSupport(options.runtimeSupport);
  }

  registerPayload(entry: PayloadCatalogEntry) {
    this.payloadEntries.push(entry);
    return this;
  }

  registerPayloadRepresentation(entry: PayloadRepresentationCatalogEntry) {
    this.representationEntries.push(entry);
    return this;
  }

  registerTransportLane(entry: TransportLaneCatalogEntry) {
    this.transportLaneEntries.push(entry);
    return this;
  }

  registerModel(entry: ModelCatalogEntry) {
    this.modelEntries.push(entry);
    return this;
  }

  registerTool(entry: ToolCatalogEntry) {
    this.toolEntries.push(entry);
    return this;
  }

  snapshot(): CatalogSnapshot {
    return {
      catalogId: this.catalogId,
      generatedAt: BOOTSTRAP_REGISTERED_AT,
      registrationPolicy: this.registrationPolicy,
      runtimeSupport: this.runtimeSupport,
      payloadEntries: [...this.payloadEntries],
      representationEntries: [...this.representationEntries],
      transportLaneEntries: [...this.transportLaneEntries],
      modelEntries: [...this.modelEntries],
      toolEntries: [...this.toolEntries],
    };
  }
}

export function buildDefaultCatalogBootstrap(options: CatalogBootstrapOptions = {}) {
  const bootstrap = new CatalogBootstrap(options);
  const payloadEntries = defaultPayloadEntries(bootstrap.runtimeSupport);
  for (const entry of payloadEntries) bootstrap.registerPayload(entry);
  for (const entry of defaultRepresentationEntries()) bootstrap.registerPayloadRepresentation(entry);
  for (const entry of defaultTransportLaneEntries(payloadEntries, bootstrap.runtimeSupport)) bootstrap.registerTransportLane(entry);
  for (const entry of defaultModelEntries(bootstrap.runtimeSupport)) bootstrap.registerModel(entry);
  for (const entry of defaultToolEntries(bootstrap.runtimeSupport)) bootstrap.registerTool(entry);
  return bootstrap;
}

export function buildDefaultCatalogSnapshot(options: CatalogBootstrapOptions = {}) {
  return buildDefaultCatalogBootstrap(options).snapshot();
}

function addDuplicateIssues<T>(
  issues: CatalogValidationIssue[],
  entries: T[],
  keyOf: (entry: T) => string,
  kind: CatalogEntryKind,
  code: CatalogValidationIssue["code"]
) {
  const seen = new Set<string>();
  const duplicates = new Set<string>();
  for (const entry of entries) {
    const key = keyOf(entry);
    if (seen.has(key)) duplicates.add(key);
    seen.add(key);
  }
  for (const duplicate of duplicates) {
    issues.push({
      code,
      severity: "error",
      catalogKind: kind,
      entryId: duplicate,
      message: `Duplicate ${kind} catalog entry registered for ${duplicate}.`,
    });
  }
}

function provenanceMissing(entry: CatalogEntry) {
  return !entry.provenance?.source?.sourceId || !entry.provenance.source.sourceType || !entry.provenance.registeredBy || !entry.provenance.registeredAt;
}

function compatibleVisionModelProfileIds(snapshot: CatalogSnapshot) {
  return snapshot.modelEntries
    .filter((entry) => {
      if (!isAvailableStatus(entry.availabilityStatus) || !entry.supportsVision) return false;
      if (entry.maxImageInputs !== null && entry.maxImageInputs <= 0) return false;
      const acceptsVisualPayload = entry.acceptedPayloadTypes.some((payloadType) =>
        payloadType === "rendered_page_image" || payloadType === "page_crop_image"
      );
      const acceptsImageRepresentation = entry.acceptedRepresentations.some((representation) =>
        representation === "image_ref" || representation === "binary_ref"
      );
      return acceptsVisualPayload && acceptsImageRepresentation;
    })
    .map((entry) => entry.modelProfileId);
}

export function validateCatalogSnapshot(snapshot: CatalogSnapshot): CatalogValidationResult {
  const issues: CatalogValidationIssue[] = [];
  const runtimeSupport = normalizeCatalogRuntimeSupport(snapshot.runtimeSupport);
  const payloadTypes = new Set(snapshot.payloadEntries.map((entry) => entry.payloadType));
  const availableToolIds = new Set(
    snapshot.toolEntries.filter((entry) => isAvailableStatus(entry.availabilityStatus) && entry.isExecutable).map((entry) => entry.toolId)
  );
  const visionCompatibleProfileIds = compatibleVisionModelProfileIds(snapshot);

  if (!snapshot.registrationPolicy.allowDuplicateEntries) {
    addDuplicateIssues(issues, snapshot.payloadEntries, (entry) => entry.payloadType, "payload", "duplicate_payload_type");
    addDuplicateIssues(issues, snapshot.representationEntries, (entry) => entry.representationId, "representation", "duplicate_representation_id");
    addDuplicateIssues(issues, snapshot.transportLaneEntries, (entry) => entry.laneId, "lane", "duplicate_lane_id");
    addDuplicateIssues(issues, snapshot.toolEntries, (entry) => entry.toolId, "tool", "duplicate_tool_id");
    addDuplicateIssues(issues, snapshot.modelEntries, (entry) => entry.modelProfileId, "model", "duplicate_model_profile_id");
  }

  if (snapshot.registrationPolicy.requireProvenance) {
    for (const entry of [
      ...snapshot.payloadEntries,
      ...snapshot.representationEntries,
      ...snapshot.transportLaneEntries,
      ...snapshot.modelEntries,
      ...snapshot.toolEntries,
    ]) {
      if (provenanceMissing(entry)) {
        const entryId =
          entry.catalogKind === "payload"
            ? entry.payloadType
            : entry.catalogKind === "representation"
              ? entry.representationId
              : entry.catalogKind === "lane"
                ? entry.laneId
                : entry.catalogKind === "model"
                  ? entry.modelProfileId
                  : entry.toolId;
        issues.push({
          code: "missing_catalog_provenance",
          severity: "error",
          catalogKind: entry.catalogKind,
          entryId,
          message: `Catalog entry ${entryId} is missing required provenance/source fields.`,
        });
      }
    }
  }

  for (const tool of snapshot.toolEntries) {
    for (const payloadType of tool.producedPayloadTypes) {
      if (!payloadTypes.has(payloadType)) {
        issues.push({
          code: "tool_produces_unknown_payload",
          severity: "error",
          catalogKind: "tool",
          entryId: tool.toolId,
          message: `Tool ${tool.toolId} produces unknown payload type ${payloadType}.`,
        });
      }
    }
    for (const payloadType of tool.requiredInputPayloadTypes) {
      if (!payloadTypes.has(payloadType)) {
        issues.push({
          code: "tool_requires_unknown_payload",
          severity: "warning",
          catalogKind: "tool",
          entryId: tool.toolId,
          message: `Tool ${tool.toolId} requires unknown payload type ${payloadType}.`,
        });
      }
    }
    if (isAvailableStatus(tool.availabilityStatus) && tool.producedPayloadTypes.length === 0) {
      issues.push({
        code: "available_tool_without_outputs",
        severity: "error",
        catalogKind: "tool",
        entryId: tool.toolId,
        message: `Available tool ${tool.toolId} must declare produced payload types.`,
      });
    }
    if (isUnavailableStatus(tool.availabilityStatus) && tool.isExecutable) {
      issues.push({
        code: "unavailable_tool_marked_executable",
        severity: "error",
        catalogKind: "tool",
        entryId: tool.toolId,
        message: `Tool ${tool.toolId} is ${tool.availabilityStatus} but marked executable.`,
      });
    }
    if (
      tool.toolId === "rendered_page_renderer" &&
      isAvailableStatus(tool.availabilityStatus) &&
      tool.isExecutable &&
      !runtimeSupport.renderedPageRenderer.implementationAvailable
    ) {
      issues.push({
        code: "executable_renderer_without_support",
        severity: "error",
        catalogKind: "tool",
        entryId: tool.toolId,
        message: "Rendered page renderer is marked executable, but runtime renderer implementation support is disabled.",
      });
    }
    if (
      tool.toolId === "model_vision_inspector" &&
      isAvailableStatus(tool.availabilityStatus) &&
      tool.isExecutable &&
      visionCompatibleProfileIds.length === 0
    ) {
      issues.push({
        code: "executable_vision_inspector_without_vision_model",
        severity: "error",
        catalogKind: "tool",
        entryId: tool.toolId,
        message: "Model vision inspector is marked executable without a compatible available vision model profile.",
      });
    }
  }

  for (const model of snapshot.modelEntries) {
    for (const payloadType of model.acceptedPayloadTypes) {
      if (!payloadTypes.has(payloadType)) {
        issues.push({
          code: "model_accepts_unknown_payload",
          severity: "error",
          catalogKind: "model",
          entryId: model.modelProfileId,
          message: `Model/profile ${model.modelProfileId} accepts unknown payload type ${payloadType}.`,
        });
      }
    }
    if (isAvailableStatus(model.availabilityStatus) && model.acceptedPayloadTypes.length === 0) {
      issues.push({
        code: "available_model_without_payloads",
        severity: "error",
        catalogKind: "model",
        entryId: model.modelProfileId,
        message: `Available model/profile ${model.modelProfileId} must accept at least one payload type.`,
      });
    }
  }

  for (const lane of snapshot.transportLaneEntries) {
    for (const payloadType of lane.acceptedPayloadTypes) {
      if (!payloadTypes.has(payloadType)) {
        issues.push({
          code: "lane_accepts_unknown_payload",
          severity: "error",
          catalogKind: "lane",
          entryId: lane.laneId,
          message: `Transport lane ${lane.laneId} accepts unknown payload type ${payloadType}.`,
        });
      }
    }
  }

  if (!snapshot.registrationPolicy.allowAvailablePayloadWithoutProducer) {
    for (const payload of snapshot.payloadEntries) {
      if (!isAvailableStatus(payload.availabilityStatus)) continue;
      const hasAvailableProducer = payload.producerToolIds.some((toolId) => availableToolIds.has(toolId));
      const hasFallbackExplanation = payload.fallbackPayloadTypes.length > 0 || payload.limitations.length > 0 || payload.notes.length > 0;
      if (!hasAvailableProducer && !hasFallbackExplanation) {
        issues.push({
          code: "available_payload_without_producer",
          severity: "error",
          catalogKind: "payload",
          entryId: payload.payloadType,
          message: `Available payload ${payload.payloadType} has no available producer and no fallback explanation.`,
        });
      }
    }
  }

  return {
    valid: issues.filter((issue) => issue.severity === "error").length === 0,
    issues,
  };
}

export function catalogPayloadEntriesToContextPayloadTypeDefinitions(
  payloadEntries: PayloadCatalogEntry[]
): ContextPayloadTypeDefinition[] {
  return payloadEntries.map((entry) => ({
    type: entry.payloadType,
    label: entry.displayName,
    description: entry.description,
    status: payloadStatusToTransportStatus(entry.availabilityStatus),
    textLike: entry.isTextLike,
    executableNow: isAvailableStatus(entry.availabilityStatus),
    defaultRepresentation: representationToTransport(entry.representations[0] ?? "json"),
    supportedRepresentations: unique(entry.representations.map(representationToTransport)),
    defaultBoundary: entry.defaultBoundary,
    artifactPolicy: entry.artifactPolicy,
    observationPolicy: entry.observationPolicy,
    compactionPolicy: entry.defaultCompactionPolicy,
    notes: [
      ...entry.notes,
      ...entry.limitations.map((limitation) => `Limitation: ${limitation}`),
      `Catalog availability: ${entry.availabilityStatus}.`,
    ],
  }));
}

function modelInputModalities(entry: ModelCatalogEntry) {
  return unique([
    "text",
    entry.supportsVision || (entry.maxImageInputs ?? 0) > 0 ? "image_input" : null,
    entry.maxFileInputs === null || entry.maxFileInputs > 0 || entry.supportsNativePdf ? "file_payload" : null,
    entry.acceptedPayloadTypes.some((payloadType) => payloadType.includes("trace")) ? "trace_payload" : null,
  ].filter((value): value is string => Boolean(value)));
}

function modelCapabilityFlags(entry: ModelCatalogEntry): ModelCapabilityManifest["capabilityFlags"] {
  const supports = (status: ModelCapabilityManifest["capabilityFlags"][string]["status"], reason: string) => ({
    status,
    reason,
    noExecutionClaimed: true as const,
  });
  return {
    large_context: supports(entry.maxTextTokens === null || entry.maxTextTokens > 16_000 ? "supported" : "unknown", "Context size is governed by the selected budget profile and catalog model entry."),
    image_input: supports(entry.supportsVision ? "supported" : "unsupported", entry.supportsVision ? "Model catalog accepts image-like payloads." : "Model catalog does not accept image input."),
    file_payload: supports(entry.supportsNativePdf || (entry.maxFileInputs ?? 0) > 0 ? "supported" : "unsupported", "File/native payload support is catalog metadata only unless a governed adapter runs."),
    tool_calling: supports(entry.supportsToolCalling ? "supported" : "unsupported", "Tool/function support is a model capability flag, not an execution claim."),
    analysis_sandbox: supports("unsupported", "No analysis sandbox adapter is configured in this work package."),
    connector_snapshot: supports("catalog_only", "Connector snapshots are represented as future/catalog lanes only."),
    rendered_page_image: supports(entry.acceptedPayloadTypes.includes("rendered_page_image") ? "supported" : "unsupported", "Rendered-page image support describes model input compatibility only."),
    structured_table: supports(entry.acceptedPayloadTypes.includes("structured_table") ? "supported" : "unsupported", "Structured-table support describes payload compatibility only."),
    document_text: supports(entry.acceptedPayloadTypes.includes("text_excerpt") ? "supported" : "unsupported", "Document text support describes payload compatibility only."),
    trace_payload: supports(entry.acceptedRepresentations.includes("debug_trace") ? "supported" : "unsupported", "Trace payload support is diagnostic context only."),
  };
}

function nativePayloadSupport(entry: ModelCatalogEntry) {
  return entry.payloadCompatibility.map((compatibility) => ({
    payloadType: compatibility.payloadType,
    supported: compatibility.compatibility === "accepted",
    reason: compatibility.notes.join(" ") || `Catalog compatibility is ${compatibility.compatibility}.`,
  }));
}

export function catalogModelEntriesToModelCapabilityManifests(
  modelEntries: ModelCatalogEntry[],
  transportLaneEntries: TransportLaneCatalogEntry[] = []
): ModelCapabilityManifest[] {
  return modelEntries.map((entry) => {
    const budgetProfile = resolveModelBudgetProfile({
      provider: entry.provider,
      model: entry.modelId,
    });
    const budgetModeDefaults = resolveModelBudgetModeDefaults(budgetProfile);
    const contextBudgetTokensByMode = Object.fromEntries(
      Object.entries(budgetModeDefaults).map(([mode, budget]) => [mode, budget.contextBudgetTokens])
    ) as Record<ContextBudgetMode, number | null>;
    const compatibleLanes = transportLaneEntries.filter((lane) =>
      lane.acceptedPayloadTypes.some((payloadType) => entry.acceptedPayloadTypes.includes(payloadType))
    );
    const unavailableLanes = compatibleLanes
      .filter((lane) => !isAvailableStatus(lane.currentAvailability))
      .map((lane) => ({
        laneId: lane.laneId,
        payloadTypes: [...lane.acceptedPayloadTypes],
        reason: `Lane availability is ${lane.currentAvailability}.`,
      }));

    return {
      manifestId: `model:${entry.modelProfileId}`,
      consumerId: entry.modelProfileId,
      modelId: entry.modelId,
      modelProfileId: entry.modelProfileId,
      provider: entry.provider,
      protocol: null,
      availabilityStatus: entry.availabilityStatus,
      inputModalities: modelInputModalities(entry),
      outputModality: "text",
      acceptedPayloadTypes: [...entry.acceptedPayloadTypes],
      preferredRepresentations: unique(entry.acceptedRepresentations.map(representationToTransport)),
      maxContextTokens: entry.maxTextTokens ?? budgetProfile.maxContextTokens,
      maxTextTokens: entry.maxTextTokens ?? budgetProfile.maxContextTokens,
      maxOutputTokens: entry.maxOutputTokens ?? budgetProfile.maxOutputTokens,
      reservedSystemPromptTokens: budgetProfile.reservedSystemPromptTokens,
      reservedResponseTokens: budgetProfile.reservedResponseTokens,
      contextBudgetTokensByMode,
      budgetModeDefaults: Object.fromEntries(
        Object.entries(budgetModeDefaults).map(([mode, budget]) => [
          mode,
          {
            mode: mode as ContextBudgetMode,
            contextBudgetTokens: budget.contextBudgetTokens,
            maxOutputTokens: budget.maxOutputTokens,
            compactionStrategies: budget.compactionStrategies,
            promptCache: budget.promptCache ?? DEFAULT_CONTEXT_PROMPT_CACHE_STRATEGY,
          },
        ])
      ) as ModelCapabilityManifest["budgetModeDefaults"],
      maxImageInputs: entry.maxImageInputs,
      maxFileInputs: entry.maxFileInputs,
      supportedFileTypes: [...entry.supportedFileTypes],
      supportedPayloadLanes: compatibleLanes
        .filter((lane) => isAvailableStatus(lane.currentAvailability))
        .map((lane) => lane.laneId),
      unavailableLanes,
      nativePayloadSupport: nativePayloadSupport(entry),
      capabilityFlags: modelCapabilityFlags(entry),
      supportsVision: entry.supportsVision,
      supportsNativePdf: entry.supportsNativePdf,
      supportsStructuredOutput: entry.supportsStructuredOutput,
      supportsToolCalling: entry.supportsToolCalling,
      costClass: entry.costClass,
      latencyClass: entry.latencyClass,
      policyRestrictions: [...entry.policyRestrictions],
      notes: [
        ...entry.notes,
        `Catalog availability: ${entry.availabilityStatus}.`,
      ],
      limitations: [...entry.limitations],
    };
  });
}

export function catalogToolEntriesToToolOutputManifests(toolEntries: ToolCatalogEntry[]): ToolOutputManifest[] {
  return toolEntries.map((entry) => ({
    manifestId: `tool-output:${entry.toolId}`,
    producerId: entry.toolId,
    toolId: entry.toolId,
    producedPayloadTypes: [...entry.producedPayloadTypes],
    requiredInputPayloadTypes: [...entry.requiredInputPayloadTypes],
    outputConfidenceSignals: [...entry.outputConfidenceSignals],
    outputValidationNeeds: [...entry.outputValidationNeeds],
    artifactTypesProduced: [...entry.artifactTypesProduced],
    sourceObservationTypesProduced: [...entry.sourceObservationTypesProduced],
    costClass: entry.costClass,
    latencyClass: entry.latencyClass,
    dataEgressClass: entry.dataEgressClass,
    sideEffectLevel: entry.sideEffectLevel,
    executionBoundary: entry.executionBoundary,
    fallbackCapabilities: [...entry.fallbackCapabilities],
    executable: entry.isExecutable && isAvailableStatus(entry.availabilityStatus),
    notes: [
      ...entry.notes,
      ...entry.limitations.map((limitation) => `Limitation: ${limitation}`),
      `Catalog availability: ${entry.availabilityStatus}.`,
      entry.isExecutable && isAvailableStatus(entry.availabilityStatus)
        ? "Executable within current declared boundary."
        : "Catalog-only/unavailable entry; must not be executed.",
    ],
  }));
}

function missingToolsByPayload(snapshot: CatalogSnapshot) {
  const result: Record<string, string[]> = {};
  for (const tool of snapshot.toolEntries) {
    if (tool.isExecutable && isAvailableStatus(tool.availabilityStatus)) continue;
    for (const payloadType of tool.producedPayloadTypes) {
      result[payloadType] = [...(result[payloadType] ?? []), tool.toolId];
    }
  }
  return result;
}

function recommendedRequirementsForCatalog(input: {
  request?: string | null;
  agentControl?: AgentControlDecision | null;
}) {
  const request = (input.request ?? "").toLowerCase();
  const requirements: Array<Pick<ContextPayloadRequirement, "payloadType" | "reason" | "required">> = [];
  const add = (payloadType: string, reason: string, required = false) => {
    if (!requirements.some((requirement) => requirement.payloadType === payloadType && requirement.reason === reason)) {
      requirements.push({ payloadType, reason, required });
    }
  };

  if (
    request.includes("page 15") ||
    request.includes("smackover water chemistry") ||
    (request.includes("table") && (request.includes("ocr") || request.includes("vision") || request.includes("render")))
  ) {
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
      add(payloadType, "Catalog maps T5/page-table fidelity to current memory plus unavailable visual/table recovery payloads.");
    }
  }

  if (input.agentControl?.taskFidelityLevel === "highest_fidelity_ingestion") {
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
      "native_file_reference",
      "source_coverage",
      "context_debt",
      "capability_gap",
    ]) {
      add(payloadType, "Catalog maps highest-fidelity ingestion to available source/memory payloads plus unavailable rich extraction payloads.");
    }
  }

  if (input.agentControl?.taskFidelityLevel === "highest_fidelity_creation") {
    for (const payloadType of [
      "knowledge_artifact",
      "source_observation",
      "source_coverage",
      "context_debt",
      "capability_gap",
      "inspection_trace",
      "creation_plan",
      "validation_result",
    ]) {
      add(payloadType, "Catalog maps highest-fidelity creation to available memory/limitation payloads plus proposed planning and validation payloads.");
    }
  }

  return requirements;
}

function buildCatalogDebugSnapshot(params: {
  snapshot: CatalogSnapshot;
  validation: CatalogValidationResult;
  modelManifests: ModelCapabilityManifest[];
  toolManifests: ToolOutputManifest[];
  selectedModel: ModelCapabilityManifest;
  selectedAvailableProducerToolIds: string[];
  unavailableProducerToolsByPayloadType: Record<string, string[]>;
  agentControl?: AgentControlDecision | null;
}): CatalogDebugSnapshot {
  const annotations: string[] = [];
  if (params.agentControl?.blockedByPolicy) annotations.push("Agent Control Surface marked this request blocked by policy.");
  if (params.agentControl?.approvalRequired) annotations.push("Agent Control Surface indicates approval is required for expanded execution.");
  if (params.agentControl?.taskFidelityLevel) annotations.push(`Task fidelity: ${params.agentControl.taskFidelityLevel}.`);
  if (params.agentControl?.runtimeBudgetProfile) annotations.push(`Runtime budget profile: ${params.agentControl.runtimeBudgetProfile}.`);

  return {
    catalogId: params.snapshot.catalogId,
    runtimeSupport: normalizeCatalogRuntimeSupport(params.snapshot.runtimeSupport),
    payloadEntriesConsidered: params.snapshot.payloadEntries.map((entry) => ({
      payloadType: entry.payloadType,
      displayName: entry.displayName,
      availabilityStatus: entry.availabilityStatus,
      producerToolIds: [...entry.producerToolIds],
      fallbackPayloadTypes: [...entry.fallbackPayloadTypes],
    })),
    representationEntriesConsidered: params.snapshot.representationEntries.map((entry) => ({
      representationId: entry.representationId,
      transportRepresentation: entry.transportRepresentation,
      availabilityStatus: entry.availabilityStatus,
    })),
    modelEntriesConsidered: params.snapshot.modelEntries.map((entry) => ({
      modelProfileId: entry.modelProfileId,
      modelId: entry.modelId,
      provider: entry.provider,
      availabilityStatus: entry.availabilityStatus,
      supportsVision: entry.supportsVision,
      supportsNativePdf: entry.supportsNativePdf,
    })),
    toolEntriesConsidered: params.snapshot.toolEntries.map((entry) => ({
      toolId: entry.toolId,
      availabilityStatus: entry.availabilityStatus,
      isExecutable: entry.isExecutable,
      requiresApproval: entry.requiresApproval,
      producedPayloadTypes: [...entry.producedPayloadTypes],
      executionBoundary: entry.executionBoundary,
    })),
    laneEntriesConsidered: params.snapshot.transportLaneEntries.map((entry) => ({
      laneId: entry.laneId,
      currentAvailability: entry.currentAvailability,
      executionBoundary: entry.executionBoundary,
      usesA03PackingKernel: entry.usesA03PackingKernel,
      acceptedPayloadTypes: [...entry.acceptedPayloadTypes],
    })),
    selectedAvailableProducerToolIds: [...params.selectedAvailableProducerToolIds],
    selectedConsumerModelProfileId: params.selectedModel.consumerId,
    compatibleVisionModelProfileIds: compatibleVisionModelProfileIds(params.snapshot),
    unavailableProducerToolsByPayloadType: params.unavailableProducerToolsByPayloadType,
    mappingToAdaptiveTransport: {
      payloadDefinitionIds: params.snapshot.payloadEntries.map((entry) => entry.payloadType),
      modelManifestIds: params.modelManifests.map((manifest) => manifest.manifestId),
      toolManifestIds: params.toolManifests.map((manifest) => manifest.manifestId),
    },
    validationIssues: params.validation.issues,
    agentControlAnnotations: annotations,
    noUnavailableToolExecutionClaimed: true,
  };
}

export function resolveCatalogForAdaptiveContextTransport(input: {
  request?: string | null;
  agentControl?: AgentControlDecision | null;
  snapshot?: CatalogSnapshot | null;
  runtimeSupport?: CatalogBootstrapOptions["runtimeSupport"] | CatalogRuntimeSupport | null;
  modelProfileId?: string | null;
} = {}): CatalogResolutionResult {
  const snapshot = input.snapshot ?? buildDefaultCatalogSnapshot({ runtimeSupport: input.runtimeSupport ?? undefined });
  const validation = validateCatalogSnapshot(snapshot);
  const payloadTypeDefinitions = catalogPayloadEntriesToContextPayloadTypeDefinitions(snapshot.payloadEntries);
  const modelCapabilityManifests = catalogModelEntriesToModelCapabilityManifests(
    snapshot.modelEntries,
    snapshot.transportLaneEntries
  );
  const toolOutputManifests = catalogToolEntriesToToolOutputManifests(snapshot.toolEntries);
  const selectedModelEntry =
    snapshot.modelEntries.find((entry) => entry.modelProfileId === input.modelProfileId && isAvailableStatus(entry.availabilityStatus)) ??
    snapshot.modelEntries.find((entry) => entry.modelProfileId === "text_only_context_model_profile" && isAvailableStatus(entry.availabilityStatus)) ??
    snapshot.modelEntries.find((entry) => isAvailableStatus(entry.availabilityStatus));
  const selectedModel = modelCapabilityManifests.find((manifest) => manifest.consumerId === selectedModelEntry?.modelProfileId);

  if (!selectedModel) {
    throw new Error("Catalog resolution failed: no model manifests are registered.");
  }

  const selectedAvailableProducerToolIds = snapshot.toolEntries
    .filter((entry) => isAvailableStatus(entry.availabilityStatus) && entry.isExecutable)
    .map((entry) => entry.toolId);
  const unavailableProducerToolsByPayloadType = missingToolsByPayload(snapshot);
  const recommendedPayloadRequirements = recommendedRequirementsForCatalog(input);
  const debugSnapshot = buildCatalogDebugSnapshot({
    snapshot,
    validation,
    modelManifests: modelCapabilityManifests,
    toolManifests: toolOutputManifests,
    selectedModel,
    selectedAvailableProducerToolIds,
    unavailableProducerToolsByPayloadType,
    agentControl: input.agentControl,
  });

  return {
    catalogId: snapshot.catalogId,
    snapshot,
    validation,
    payloadTypeDefinitions,
    modelCapabilityManifests,
    toolOutputManifests,
    selectedModelManifest: selectedModel,
    selectedAvailableProducerToolIds,
    unavailableProducerToolsByPayloadType,
    recommendedPayloadRequirements,
    debugSnapshot,
  };
}

export function diffCatalogSnapshots(before: CatalogSnapshot, after: CatalogSnapshot): CatalogDiff {
  const beforeIds = new Set([
    ...before.payloadEntries.map((entry) => `payload:${entry.payloadType}`),
    ...before.representationEntries.map((entry) => `representation:${entry.representationId}`),
    ...before.transportLaneEntries.map((entry) => `lane:${entry.laneId}`),
    ...before.modelEntries.map((entry) => `model:${entry.modelProfileId}`),
    ...before.toolEntries.map((entry) => `tool:${entry.toolId}`),
  ]);
  const afterIds = new Set([
    ...after.payloadEntries.map((entry) => `payload:${entry.payloadType}`),
    ...after.representationEntries.map((entry) => `representation:${entry.representationId}`),
    ...after.transportLaneEntries.map((entry) => `lane:${entry.laneId}`),
    ...after.modelEntries.map((entry) => `model:${entry.modelProfileId}`),
    ...after.toolEntries.map((entry) => `tool:${entry.toolId}`),
  ]);
  return {
    addedEntryIds: [...afterIds].filter((id) => !beforeIds.has(id)),
    removedEntryIds: [...beforeIds].filter((id) => !afterIds.has(id)),
    changedEntryIds: [],
  };
}
