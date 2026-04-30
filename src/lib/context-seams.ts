/**
 * Draft, non-runtime contracts for a source-flexible context layer.
 *
 * These types are intentionally GCPHUB-owned so parser/retrieval helpers can be
 * swapped without surrendering provenance, permissions, budgeting, or Inspector parity.
 */

import type { AgentControlDebugSnapshot } from "./agent-control-surface";
import type { AsyncAgentWorkDebugSnapshot } from "./async-agent-work-queue";
import type { ContextTransportDebugSnapshot } from "./adaptive-context-transport";
import type { ContextRegistryDebugSnapshot } from "./capability-gap-context-debt-registry";
import type { CapabilityGapApprovalCenterSummary } from "./capability-gap-approval-types";
import type { ArtifactPromotionDebugSnapshot } from "./source-learning-artifact-promotion";
import type { SourceObservationProducerDebugSummary } from "./source-observation-producers";
import type { SourceObservationDebugSummary } from "./source-observations";
import type { UploadedDocumentDigestionExternalDebugSummary } from "./document-ingestion-external-producers";
import type { UploadedDocumentDigestionLocalDebugSummary } from "./upload-document-digestion-local";
import type { ProgressiveContextAssemblyResult } from "./progressive-context-assembly";
import type { VisualInspectionDebugSnapshot } from "./visual-inspection-pack";
import type {
  ContextBudgetMode,
  ContextCompactionStrategy,
  ContextPromptCacheStrategy,
} from "./context-token-budget";

export type {
  ContextBudgetMode,
  ContextCompactionStrategy,
  ContextPromptCacheStrategy,
} from "./context-token-budget";

export type ContextSourceType =
  | "thread_document"
  | "company_document"
  | "document"
  | "text"
  | "markdown"
  | "pdf"
  | "docx"
  | "pptx"
  | "email"
  | "web"
  | "browser"
  | "spreadsheet"
  | "presentation"
  | "time_series"
  | "memory"
  | "live_data"
  | "generic";

export type ContextScope = "thread" | "workspace" | "user" | "external" | "system" | "unknown";

export type ContextRequestMode = "default" | "plan";

export type ContextEligibilityReason =
  | "allowed"
  | "not_registered"
  | "not_in_scope"
  | "not_available"
  | "requesting_user_not_allowed"
  | "active_agent_not_allowed"
  | "not_implemented"
  | "budget_exhausted";

export type ContextSelectionDisposition = "selected" | "skipped";

export type ContextSelectionReason =
  | "high_rank"
  | "coverage"
  | "document_order"
  | "manual_request"
  | "recency"
  | "required_by_policy"
  | "budget_exhausted"
  | "not_authorized"
  | "not_available"
  | "not_supported"
  | "low_relevance"
  | "cross_reference_only";

export type ContextLocationKind =
  | "document_location"
  | "legal_section_location"
  | "spreadsheet_range_location"
  | "slide_location"
  | "email_message_location"
  | "web_location"
  | "time_series_location"
  | "generic_location";

export type ContextCrossReferenceRelation =
  | "references"
  | "links_to"
  | "quoted_from"
  | "reply_to"
  | "attachment_of"
  | "derived_from";

export interface ContextNumericRange {
  start: number;
  end: number;
}

export interface ContextTimeRange {
  start: string | null;
  end: string | null;
}

export interface ContextSourceAuthority {
  requestingUserId: string | null;
  activeUserIds: string[];
  activeAgentId: string | null;
  activeAgentIds: string[];
}

export interface ContextSourceEligibility {
  sourceId: string;
  sourceType: ContextSourceType | string;
  label?: string | null;
  domain?: string | null;
  scope: ContextScope;
  policyMode?: string | null;
  requestStatus?: string | null;
  executionStatus?: string | null;
  isRegistered: boolean;
  isInScope: boolean;
  isAvailable: boolean;
  isRequestingUserAllowed: boolean;
  isActiveAgentAllowed: boolean;
  isImplemented: boolean;
  decision: "allowed" | "excluded";
  reason: ContextEligibilityReason;
  detail: string;
}

export interface BaseContextLocation {
  kind: ContextLocationKind;
  sourceId: string;
  sourceType: ContextSourceType | string;
  filename?: string | null;
  title?: string | null;
  url?: string | null;
  pageNumber?: number | null;
  pageRange?: ContextNumericRange | null;
  headingPath?: string[];
  sectionPath?: string[];
  articlePath?: string[];
  paragraphIndex?: number | null;
  tableId?: string | null;
  figureId?: string | null;
  slideNumber?: number | null;
  slideTitle?: string | null;
  sheetName?: string | null;
  cellRange?: string | null;
  rowRange?: ContextNumericRange | null;
  columnHeaders?: string[];
  sender?: string | null;
  sentAt?: string | null;
  retrievedAt?: string | null;
  timestampRange?: ContextTimeRange | null;
  assetId?: string | null;
  tagName?: string | null;
  unit?: string | null;
  confidence?: number | null;
  label?: string | null;
}

export interface DocumentLocation extends BaseContextLocation {
  kind: "document_location";
}

export interface LegalSectionLocation extends BaseContextLocation {
  kind: "legal_section_location";
  exhibitId?: string | null;
  scheduleId?: string | null;
  clauseId?: string | null;
}

export interface SpreadsheetRangeLocation extends BaseContextLocation {
  kind: "spreadsheet_range_location";
}

export interface SlideLocation extends BaseContextLocation {
  kind: "slide_location";
}

export interface EmailMessageLocation extends BaseContextLocation {
  kind: "email_message_location";
  threadId?: string | null;
  messageId?: string | null;
  recipients?: string[];
}

export interface WebLocation extends BaseContextLocation {
  kind: "web_location";
}

export interface TimeSeriesLocation extends BaseContextLocation {
  kind: "time_series_location";
}

export interface GenericLocation extends BaseContextLocation {
  kind: "generic_location";
}

export type ContextLocation =
  | DocumentLocation
  | LegalSectionLocation
  | SpreadsheetRangeLocation
  | SlideLocation
  | EmailMessageLocation
  | WebLocation
  | TimeSeriesLocation
  | GenericLocation;

export interface ContextCrossReference {
  id: string;
  relation: ContextCrossReferenceRelation;
  label: string;
  sourceBodyLocation: ContextLocation | null;
  targetLocation: ContextLocation;
  resolved: boolean;
  detail?: string | null;
}

export interface ContextProvenance {
  sourceId: string;
  sourceType: ContextSourceType | string;
  displayLabel: string;
  sourceBodyLocation: ContextLocation;
  referencedLocations: ContextCrossReference[];
  extractionMethod?: string | null;
  extractorVersion?: string | null;
  safeCitationLabel?: string | null;
  retrievedAt?: string | null;
  confidence?: number | null;
}

export interface ContextDocument {
  id: string;
  sourceId: string;
  sourceType: ContextSourceType | string;
  title: string;
  mimeType?: string | null;
  uri?: string | null;
  text?: string | null;
  createdAt?: string | null;
  updatedAt?: string | null;
  metadata: Record<string, unknown>;
  eligibility: ContextSourceEligibility;
  primaryLocation?: ContextLocation | null;
  crossReferences: ContextCrossReference[];
}

export interface ContextChunkSelection {
  disposition: ContextSelectionDisposition;
  reason: ContextSelectionReason;
  detail?: string | null;
  selectedDueToCoverage?: boolean;
}

export interface ContextChunk {
  id: string;
  sourceId: string;
  documentId: string;
  sourceType: ContextSourceType | string;
  chunkIndex: number;
  text: string;
  textPreview?: string | null;
  charStart?: number | null;
  charEnd?: number | null;
  tokenEstimate: number;
  metadata: Record<string, unknown>;
  provenance: ContextProvenance;
  selection: ContextChunkSelection;
  ranking?: {
    strategy: string | null;
    score: number;
    order: number;
    signals: string[];
    fallbackReason?: string | null;
  };
}

export interface ContextBudgetProfile {
  id?: string | null;
  label?: string | null;
  mode?: ContextBudgetMode | null;
  modelProfileId?: string | null;
  model?: string | null;
  provider?: string | null;
  protocol?: string | null;
  maxContextTokens?: number | null;
  reservedSystemPromptTokens?: number | null;
  reservedResponseTokens?: number | null;
  availableContextTokens?: number | null;
  requestedContextTokens?: number | null;
  documentContextBudgetTokens?: number | null;
  fallbackProfileUsed?: boolean | null;
}

export type AgentWorkPlanBudgetMode = ContextBudgetMode;

export type AgentWorkPlanState =
  | "needed"
  | "planned"
  | "deferred"
  | "unavailable"
  | "approval_required"
  | "executed";

export type AgentWorkPlanAnswerReadinessStatus =
  | "ready"
  | "ready_with_limitations"
  | "not_ready"
  | "approval_required"
  | "async_recommended"
  | "blocked";

export interface AgentWorkPlanAnswerReadiness {
  status: AgentWorkPlanAnswerReadinessStatus;
  readyForAnswer: boolean;
  confidence: number | null;
  reasons: string[];
  limitations: string[];
}

export interface AgentWorkPlannerEvaluatorStatus {
  status: "not_configured" | "disabled" | "planned";
  noLlmPlanningExecuted: true;
  reason?: string;
}

export interface AgentWorkPlanBudget {
  mode: AgentWorkPlanBudgetMode;
  runtimeBudgetProfile: string;
  contextTokens: {
    requested: number;
    granted: number;
    profileMax: number;
  };
  outputTokens: {
    requested: number;
    granted: number;
    profileMax: number;
  };
  toolCalls: {
    requested: number;
    granted: number;
  };
  runtimeMs: {
    requested: number;
    granted: number;
    syncCutoff: number;
  };
  compactionStrategies: ContextCompactionStrategy[];
  promptCache: ContextPromptCacheStrategy;
}

export interface AgentWorkPlanSourceNeed {
  sourceId: string;
  sourceType?: string | null;
  scope?: ContextScope | string | null;
  state: AgentWorkPlanState;
  coverageTarget?: string | null;
  reason: string;
  detail?: string | null;
  executionEvidenceIds?: string[];
}

export interface AgentWorkPlanCapabilityNeed {
  capability: string;
  state: AgentWorkPlanState;
  payloadTypes: string[];
  requiresApproval: boolean;
  asyncRecommended: boolean;
  reason: string;
  executionEvidenceIds: string[];
  noExecutionClaimed: true;
}

export interface AgentWorkPlanModelNeed {
  capability: string;
  state: AgentWorkPlanState;
  currentProvider: string | null;
  currentModel: string | null;
  currentProfileId: string | null;
  requiresProviderChange: boolean;
  acceptedPayloadTypes: string[];
  unavailablePayloadTypes: string[];
  reason: string;
  noExecutionClaimed: true;
}

export interface AgentWorkPlanDecision {
  id: string;
  type:
    | "classification"
    | "budget"
    | "source"
    | "capability"
    | "model"
    | "approval"
    | "async"
    | "truthfulness";
  state: AgentWorkPlanState;
  reason: string;
  detail: string;
  traceEventIds: string[];
}

export interface AgentWorkPlanLimitation {
  id: string;
  state: AgentWorkPlanState;
  summary: string;
  capability?: string | null;
  sourceId?: string | null;
  traceEventIds: string[];
}

export interface AgentWorkPlanStep {
  id: string;
  label: string;
  owner:
    | "agent_control"
    | "conversation_context"
    | "progressive_assembly"
    | "adaptive_transport"
    | "async_agent_work"
    | "debug_trace";
  state: AgentWorkPlanState;
  reason: string;
  linkedPlanId?: string | null;
  traceEventIds: string[];
}

export interface AgentWorkPlan {
  planId: string;
  traceId: string;
  conversationId: string | null;
  messageId?: string | null;
  prompt: {
    preview: string | null;
    intentClassification: string;
    taskType: string;
    outputExpectation: string;
  };
  requiredFidelity: string;
  answerReadiness: AgentWorkPlanAnswerReadiness;
  sourceCoverageTarget: string;
  memoryReuse: {
    state: AgentWorkPlanState;
    memoryDensity: string;
    memoryRefreshDepth: string;
    artifactReuseIntent: AgentWorkPlanState;
    reason: string;
  };
  budget: AgentWorkPlanBudget;
  sourceNeeds: AgentWorkPlanSourceNeed[];
  capabilityNeeds: AgentWorkPlanCapabilityNeed[];
  modelCapabilityNeeds: AgentWorkPlanModelNeed[];
  approvedActionsNow: AgentWorkPlanStep[];
  deferredActions: AgentWorkPlanStep[];
  asyncRecommendation: {
    state: "planned" | "deferred" | "approval_required" | "unavailable";
    recommended: boolean;
    reason: string | null;
  };
  artifactPromotion: {
    candidateCount: number;
    acceptedCount: number;
    rejectedCount: number;
    state: AgentWorkPlanState;
    reason: string;
  };
  truthfulLimitations: AgentWorkPlanLimitation[];
  unavailableCapabilities: AgentWorkPlanCapabilityNeed[];
  decisions: AgentWorkPlanDecision[];
  plannerEvaluator: AgentWorkPlannerEvaluatorStatus;
  scopedPlanLinks: {
    agentControlDecisionId: string | null;
    assemblyPlanId?: string | null;
    transportPlanId?: string | null;
    asyncWorkItemId?: string | null;
  };
  noUnavailableToolExecutionClaimed: true;
}

export interface AgentWorkPlanDebugSummary {
  planId: string;
  traceId: string;
  budgetMode: AgentWorkPlanBudgetMode;
  answerReadiness: AgentWorkPlanAnswerReadiness;
  plannerEvaluator: AgentWorkPlannerEvaluatorStatus;
  modelCapabilitySummary: {
    needs: AgentWorkPlanModelNeed[];
    acceptedPayloadTypes: string[];
    unavailablePayloadTypes: string[];
  };
  sourceNeeds: AgentWorkPlanSourceNeed[];
  capabilityNeeds: AgentWorkPlanCapabilityNeed[];
  unavailableLanes: string[];
  asyncRecommendation: AgentWorkPlan["asyncRecommendation"];
  truthfulLimitations: AgentWorkPlanLimitation[];
  scopedPlanLinks: AgentWorkPlan["scopedPlanLinks"];
  noUnavailableToolExecutionClaimed: true;
}

export interface ContextAssemblyPlan {
  conversationId: string;
  requestMode: ContextRequestMode;
  budgetProfile: ContextBudgetProfile | null;
  selectedChunks: ContextChunk[];
  skippedChunks: Array<{
    chunkId: string;
    sourceId: string;
    reason: ContextSelectionReason;
    detail?: string | null;
    tokenEstimate: number;
  }>;
  estimatedInputTokens: number;
  estimatedSelectedTokens: number;
  promptSections: Array<{
    id: string;
    label: string;
    text: string;
    tokenEstimate: number;
    provenance: ContextProvenance[];
  }>;
  inspectorParityKey: string;
}

export interface ContextDebugDocument {
  documentId: string;
  sourceId: string;
  sourceType: ContextSourceType | string;
  title: string;
  sourceStatus?: string | null;
  extractionStatus?: string | null;
  extractionDetail?: string | null;
  totalChunks: number;
  selectedChunkIds: string[];
  skippedChunkIds: string[];
  selectedTokenEstimate?: number | null;
  totalTokenEstimate?: number | null;
  selectedCharCount?: number | null;
  totalCharCount?: number | null;
  documentBudgetTokens?: number | null;
  skippedDueToBudgetCount?: number | null;
  selectionMode?: string | null;
  selectionBudgetKind?: string | null;
  usedBudgetClamp?: boolean;
  coverageSelectionApplied?: boolean;
  ranking?: {
    enabled: boolean;
    strategy: string | null;
    queryTokenCount?: number | null;
    fallbackReason?: string | null;
    occurrenceIntentDetected?: boolean;
    occurrenceTargetPhrase?: string | null;
  } | null;
  occurrence?: {
    searchStatus: "not_requested" | "searched" | "not_searchable";
    targetPhrase?: string | null;
    scannedChunkCount?: number | null;
    exactMatchChunkCount?: number | null;
    exactMatchLocationCount?: number | null;
    locations?: Array<{
      chunkId: string;
      chunkIndex: number;
      label: string;
      exactPhraseMatchCount: number;
      coverageGroupKey?: string | null;
      referencedLocationLabels?: string[];
    }>;
    selectedRepresentativeChunkIds?: string[];
    skippedDueToBudgetChunkIds?: string[];
    detail?: string | null;
  } | null;
  metadata?: Record<string, unknown> | null;
}

export interface ContextDebugChunk {
  id: string;
  sourceId: string;
  documentId: string;
  sourceType: ContextSourceType | string;
  sourceStatus?: string | null;
  title?: string | null;
  chunkIndex: number;
  tokenEstimate: number | null;
  charRange?: ContextNumericRange | null;
  textPreview?: string | null;
  metadata: Record<string, unknown>;
  provenance: ContextProvenance;
  selection: ContextChunkSelection;
  ranking?: {
    strategy: string | null;
    score: number | null;
    order: number | null;
    signals: string[];
    fallbackReason?: string | null;
    exactPhraseMatchCount?: number | null;
    definitionBoostApplied?: boolean;
    coverageGroupKey?: string | null;
  };
}

export interface ContextDebugKnowledgeArtifact {
  id: string;
  sourceId: string;
  documentId: string;
  sourceType: ContextSourceType | string;
  kind: string;
  status: string;
  title?: string | null;
  summary?: string | null;
  textPreview?: string | null;
  tokenEstimate?: number | null;
  confidence?: number | null;
  tool?: string | null;
  selected: boolean;
  metadata: Record<string, unknown>;
  sourceBodyLocation?: ContextLocation | null;
}

export interface ContextDebugInspectionTask {
  id: string;
  sourceId: string;
  documentId: string;
  sourceType: ContextSourceType | string;
  kind: string;
  status: string;
  tool: string;
  requestedCapability?: string | null;
  selectedTool?: string | null;
  selectionReason?: string | null;
  candidateTools?: string[];
  eligibleTools?: Array<Record<string, unknown>>;
  ineligibleTools?: Array<Record<string, unknown>>;
  eligibilityReasons?: Array<Record<string, unknown>>;
  approvalStatus?: string | null;
  runtimeClass?: string | null;
  dataClassPolicy?: Record<string, unknown> | null;
  sideEffectLevel?: string | null;
  costClass?: string | null;
  latencyClass?: string | null;
  benchmarkFixtureIds?: string[];
  governanceTrace?: Record<string, unknown> | null;
  confidence?: number | null;
  limitations?: string[];
  fallbackRecommendation?: string | null;
  recommendedNextCapabilities?: string[];
  reusable?: boolean | null;
  unmetCapability?: Record<string, unknown> | null;
  unmetCapabilityReviewItem?: Record<string, unknown> | null;
  rationale?: string | null;
  resultSummary?: string | null;
  unresolved: string[];
  createdArtifactKeys?: string[];
  createdArtifactIds: string[];
  toolTraceEvents?: Array<Record<string, unknown>>;
  sourceBodyLocation?: ContextLocation | null;
  metadata: Record<string, unknown>;
}

export interface ContextDebugTrace {
  traceId: string;
  conversationId: string;
  requestMode: ContextRequestMode;
  requestedSourceIds: string[];
  authority: ContextSourceAuthority;
  budgetProfile: ContextBudgetProfile | null;
  agentWorkPlan?: AgentWorkPlanDebugSummary | null;
  agentControl: AgentControlDebugSnapshot;
  asyncAgentWork?: AsyncAgentWorkDebugSnapshot | null;
  contextRegistry?: ContextRegistryDebugSnapshot | null;
  artifactPromotion?: ArtifactPromotionDebugSnapshot | null;
  sourceObservations?: SourceObservationDebugSummary | null;
  sourceObservationProducers?: SourceObservationProducerDebugSummary | null;
  uploadedDocumentDigestionLocal?: UploadedDocumentDigestionLocalDebugSummary[] | null;
  uploadedDocumentDigestionExternal?: UploadedDocumentDigestionExternalDebugSummary[] | null;
  capabilityGapApprovals?: CapabilityGapApprovalCenterSummary | null;
  sourceEligibility: ContextSourceEligibility[];
  documents: ContextDebugDocument[];
  chunks: ContextDebugChunk[];
  knowledgeArtifacts: ContextDebugKnowledgeArtifact[];
  inspections: ContextDebugInspectionTask[];
  occurrence?: {
    intentDetected: boolean;
    targetPhrase: string | null;
    scannedChunkCount: number;
    exactMatchChunkCount: number;
    exactMatchLocationCount: number;
    searchableDocumentIds: string[];
    unsearchableDocuments: Array<{
      documentId: string;
      sourceId: string;
      title: string;
      sourceStatus?: string | null;
      detail: string;
    }>;
    detail?: string | null;
  } | null;
  retrieval: Array<{
    adapterId: string;
    sourceId?: string | null;
    sourceType?: ContextSourceType | string | null;
    sourceStatus?: string | null;
    query: string | null;
    selectedChunkIds: string[];
    skippedChunkIds: string[];
    reranker?: string | null;
    detail?: string | null;
  }>;
  assembly: {
    selectedChunkIds: string[];
    skippedChunkIds: string[];
    selectedArtifactIds: string[];
    estimatedTokens?: number | null;
    estimatedSelectedTokens?: number | null;
    estimatedArtifactTokens?: number | null;
    documentChunkBudgetTokens?: number | null;
    skippedDueToBudgetCount?: number | null;
    budgetMode?: ContextBudgetMode | null;
    modelProfileId?: string | null;
    fallbackProfileUsed?: boolean | null;
    detail?: string | null;
    progressive?: ProgressiveContextAssemblyResult | null;
    transport?: ContextTransportDebugSnapshot | null;
    visualInspection?: VisualInspectionDebugSnapshot | null;
  };
  renderedContext: {
    text?: string | null;
    safeTextPreview?: string | null;
    estimatedTokens?: number | null;
    inspectorParityKey: string;
  };
  inspectorParity: {
    payloadMatchesRenderedContext: boolean;
    detail: string;
  };
}

export interface ContextPlannerResult {
  candidateSourceIds: string[];
  selectedSourceIds: string[];
  skippedSourceIds: string[];
  plan: ContextAssemblyPlan;
  debugTrace: ContextDebugTrace;
  transport?: ContextTransportDebugSnapshot | null;
}

export interface ContextSourceAdapter {
  adapterId: string;
  label: string;
  supportedSourceTypes: Array<ContextSourceType | string>;
  canHandle(source: {
    sourceType: ContextSourceType | string;
    mimeType?: string | null;
  }): boolean;
  resolveDocument(params: {
    sourceId: string;
    conversationId: string;
    requestMode: ContextRequestMode;
    authority: ContextSourceAuthority;
    budgetProfile: ContextBudgetProfile;
    currentUserPrompt?: string | null;
  }): Promise<ContextDocument>;
  buildChunks?(params: {
    document: ContextDocument;
    budgetProfile: ContextBudgetProfile;
    currentUserPrompt?: string | null;
  }): Promise<ContextChunk[]>;
}

export interface ContextRetrievalAdapter {
  adapterId: string;
  label: string;
  rankAndSelect(params: {
    query: string | null;
    documents: ContextDocument[];
    chunks: ContextChunk[];
    budgetProfile: ContextBudgetProfile;
    requestMode: ContextRequestMode;
  }): Promise<ContextPlannerResult>;
}
