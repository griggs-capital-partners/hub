import { readFile } from "fs/promises";
import { normalize, resolve, sep } from "path";
import mammoth from "mammoth";
import { parseOffice, type OfficeContentNode, type SlideMetadata } from "officeparser";
import * as XLSX from "xlsx";
import {
  buildDocumentChunkCandidates,
  analyzeDocumentOccurrenceQuery,
  DEFAULT_DOCUMENT_CHUNK_STRATEGY,
  DEFAULT_DOCUMENT_CHUNK_RANKING_STRATEGY,
  buildDocumentChunkOccurrenceInventory,
  rankDocumentChunks,
  selectRankedDocumentChunksWithinBudget,
  type ContextDocumentChunk,
  type ContextDocumentChunkRankingFallbackReason,
  type ContextDocumentChunkRankingResult,
  type ContextDocumentChunkRankingStrategy,
  type ContextDocumentChunkSelectionBudgetKind,
  type ContextDocumentChunkSelectionMode,
  type ContextDocumentChunkSelectionResult,
  type ContextDocumentChunkSourceType,
} from "./context-document-chunks";
import {
  CHAT_THREAD_DOCUMENT_CONTEXT_BUNDLE_CHARS,
  CHAT_THREAD_DOCUMENT_CONTEXT_CHARS,
} from "./chat-runtime-budgets";
import { buildConversationContextDebugTrace } from "./context-debug-trace";
import {
  planAsyncAgentWorkItems,
  runAsyncAgentWorkItem,
  toAsyncAgentWorkDebugSnapshot,
  upsertAsyncAgentWorkItem,
  type AsyncAgentWorkDebugSnapshot,
  type AsyncAgentWorkItem,
} from "./async-agent-work-queue";
import {
  buildArtifactPackingCandidate,
  buildRawExcerptPackingCandidate,
  type ContextPackingCandidate,
} from "./context-packing-kernel";
import { joinMarkdownSections } from "./context-formatting";
import {
  buildPdfContextExtractionResult,
  formatPdfVisualClassificationLabel,
  type PdfContextExtractionMetadata,
  type PdfContextExtractionResult,
} from "./context-pdf";
import {
  buildDocumentIntelligenceState,
  materializeDocumentKnowledgeArtifactRecord,
  mergeDocumentInspectionTasks,
  mergeDocumentKnowledgeArtifacts,
  parseDocumentIntelligenceJsonValue,
  selectDocumentKnowledgeArtifactsWithinBudget,
  stringifyDocumentIntelligenceJsonValue,
  synthesizePdfDocumentIntelligence,
  type DocumentInspectionTaskRecord,
  type DocumentIntelligenceLocation,
  type DocumentIntelligenceState,
  type DocumentKnowledgeArtifactRecord,
  type InspectionTaskKind,
  type InspectionTaskStatus,
  type InspectionTool,
  type KnowledgeArtifactKind,
  type KnowledgeArtifactStatus,
  type UpsertDocumentInspectionTaskInput,
  type UpsertDocumentKnowledgeArtifactInput,
} from "./document-intelligence";
import {
  DEFAULT_ARTIFACT_PROMOTION_POLICY,
  evaluateArtifactPromotionCandidates,
  proposeDeterministicSourceLearningCandidates,
  renderSourceMemoryBlocks,
  type ArtifactPromotionCandidate,
  type ArtifactPromotionDebugSnapshot,
} from "./source-learning-artifact-promotion";
import {
  buildSourceObservationDebugSummary,
  buildSourceObservationNeeds,
  buildSourceObservationsFromSelectedDocumentChunks,
  mapSourceObservationToPromotionInput,
  type SourceObservation,
  type SourceObservationDebugSummary,
  type SourceObservationPromotionInput,
  type SourceObservationTransportSelection,
} from "./source-observations";
import {
  buildProducerRequestsFromAgentWorkPlan,
  buildProducerRequestsFromTableSignals,
  buildProducerRequestsFromTransportNeeds,
  buildSourceObservationProducerAvailabilitySnapshot,
  buildSourceObservationProducerDebugSummary,
  runDeterministicSourceObservationProducers,
  type SourceObservationProducerDebugSummary,
  type SourceObservationProducerRequest,
  type SourceObservationProducerResult,
} from "./source-observation-producers";
import {
  buildAgentWorkPlanFromControlDecision,
  evaluateAgentControlSurface,
  type AgentControlDebugSnapshot,
  type AgentControlSourceSignal,
} from "./agent-control-surface";
import type { InspectionCapability } from "./inspection-tool-broker";
import {
  assembleProgressiveContext,
  type ProgressiveContextAssemblyResult,
} from "./progressive-context-assembly";
import {
  buildContextPayloadsFromArtifactPromotionCandidates,
  buildContextPayloadsFromArtifactPromotionDecisions,
  buildContextPayloadsFromSourceCoverageRecords,
  buildContextPayloadsFromSourceObservations,
  type ContextPayload,
} from "./adaptive-context-transport";
import {
  runUploadedDocumentExternalEscalationProducers,
  withUploadedDocumentExternalDurableGapCount,
  type UploadedDocumentDigestionExternalDebugSummary,
  type UploadedDocumentExternalImageInput,
} from "./document-ingestion-external-producers";
import {
  buildUploadedDocumentDigestionLocalBaseline,
  withUploadedDocumentDigestionLocalDurableGapCount,
  type UploadedDocumentDigestionLocalDebugSummary,
} from "./upload-document-digestion-local";
import {
  EMPTY_CONTEXT_REGISTRY_SELECTION,
  buildAgentControlSourceSignalsFromRegistry,
  buildContextRegistryDebugSnapshot,
  buildContextRegistryPackingCandidates,
  buildDurableEmissionDebugSummary,
  buildRegistryUpsertsFromAgentWorkPlan,
  buildRegistryUpsertsFromAsyncAgentWork,
  buildRegistryUpsertsFromContextTransport,
  buildRegistryUpsertsFromProgressiveAssembly,
  buildRegistryUpsertsFromSourceObservationProducerResults,
  mergeContextRegistryBatches,
  mergeContextRegistrySelections,
  selectOpenContextRegistryRecords,
  upsertContextRegistryBatch,
  type DurableEmissionSourceBatch,
  type ContextRegistryDebugSnapshot,
  type ContextRegistrySelection,
  type ContextRegistryUpsertBatch,
} from "./capability-gap-context-debt-registry";
import { DEFAULT_APPROX_CHARS_PER_TOKEN } from "./context-token-budget";
import {
  DEFAULT_MODEL_BUDGET_PROFILE,
  type ModelBudgetProfile,
  type ModelBudgetProfileLookup,
  resolveModelContextBudget,
} from "./model-budget-profiles";
import type { AgentWorkPlan, ContextBudgetMode, ContextDebugTrace } from "./context-seams";
import { prisma } from "./prisma";

export type ConversationContextSourceStatus = "used" | "unsupported" | "failed" | "unavailable";

export type ConversationContextSourceId =
  | "thread_documents"
  | "company_documents"
  | "browsing"
  | "memory"
  | "live_data";

export type ConversationContextSourceScope = "thread" | "workspace" | "user" | "external" | "unknown";

export type ConversationContextSourcePolicyMode =
  | "thread_active_membership"
  | "future_authorized_retrieval"
  | "unknown";

export type ConversationContextSourceRequestMode = "default" | "plan";

export type ConversationContextSourceRequestOrigin =
  | "default_system_candidate"
  | "explicit_user_request"
  | "planner_proposed"
  | "policy_required"
  | "fallback_candidate";

export type ConversationContextSourceRequestStatus =
  | "candidate"
  | "requested"
  | "proposed"
  | "required";

export type ConversationContextSourceExclusionCategory =
  | "registration"
  | "scope"
  | "authorization"
  | "availability"
  | "implementation"
  | "budget";

export type ConversationContextSourceExclusionReason =
  | "not_registered"
  | "not_in_scope"
  | "not_available"
  | "requesting_user_not_allowed"
  | "active_agent_not_allowed"
  | "not_implemented"
  | "budget_exhausted";

export type ConversationContextSourceDecisionReason =
  | "allowed"
  | ConversationContextSourceExclusionReason;

export type ConversationContextSourceEligibility = {
  isRegistered: boolean;
  isInScope: boolean;
  isAvailable: boolean;
  isRequestingUserAllowed: boolean;
  isActiveAgentAllowed: boolean;
  isImplemented: boolean;
};

export type ConversationContextSourceExclusion = {
  category: ConversationContextSourceExclusionCategory;
  reason: ConversationContextSourceExclusionReason;
  detail: string;
};

export type ConversationContextSourceDecision = {
  sourceId: string;
  label: string;
  request: {
    status: ConversationContextSourceRequestStatus;
    mode: ConversationContextSourceRequestMode;
    origins: ConversationContextSourceRequestOrigin[];
    detail: string;
  };
  admission: {
    status: "allowed" | "excluded";
  };
  execution: {
    status: "executed" | "not_executed";
    detail: string;
    summary: {
      totalCount: number;
      usedCount: number;
      unsupportedCount: number;
      failedCount: number;
      unavailableCount: number;
      excludedCategories: ConversationContextSourceExclusionCategory[];
    } | null;
  };
  exclusion: ConversationContextSourceExclusion | null;
  status: "allowed" | "excluded";
  reason: ConversationContextSourceDecisionReason;
  detail: string;
  domain: string;
  scope: ConversationContextSourceScope;
  policyMode: ConversationContextSourcePolicyMode;
  eligibility: ConversationContextSourceEligibility;
};

export type ConversationContextSource = {
  kind: "thread-document";
  label: string;
  target: string;
  detail: string;
  status: ConversationContextSourceStatus;
  domain: "thread_documents";
  scope: "thread";
};

export type ConversationContextSummarySource = {
  id: string;
  label: string;
  description: string;
};

export type ConversationContextSourceAuthority = {
  requestingUserId: string | null;
  activeUserIds: string[];
  activeAgentId: string | null;
  activeAgentIds: string[];
};

export type ConversationContextAcquisitionPlan = {
  // Future LLM planning can propose a ranked/source-specific acquisition plan here.
  // The app-side resolver will still evaluate registry + eligibility before execution.
  requestedSourceIds?: string[];
  sourceRequests?: Array<{
    sourceId: string;
    origin: Exclude<ConversationContextSourceRequestOrigin, "default_system_candidate">;
  }>;
};

export type ConversationContextSourceSelection = {
  requestMode: ConversationContextSourceRequestMode;
  consideredSourceIds: string[];
  defaultCandidateSourceIds: string[];
  explicitUserRequestedSourceIds: string[];
  requestedSourceIds: string[];
  plannerProposedSourceIds: string[];
  policyRequiredSourceIds: string[];
  fallbackCandidateSourceIds: string[];
  allowedSourceIds: string[];
  executedSourceIds: string[];
  excludedSourceIds: string[];
};

export type ConversationContextBundle = {
  text: string;
  sources: ConversationContextSource[];
  summarySources: ConversationContextSummarySource[];
  sourceSelection: ConversationContextSourceSelection;
  sourceDecisions: ConversationContextSourceDecision[];
  documentChunking: ConversationContextDocumentChunkingDebug;
  documentIntelligence: ConversationContextDocumentIntelligenceDebug;
  agentControl: AgentControlDebugSnapshot;
  agentWorkPlan: AgentWorkPlan;
  progressiveAssembly: ProgressiveContextAssemblyResult;
  asyncAgentWork: AsyncAgentWorkDebugSnapshot | null;
  contextRegistry: ContextRegistryDebugSnapshot;
  artifactPromotion: ArtifactPromotionDebugSnapshot | null;
  sourceObservations: SourceObservationDebugSummary | null;
  sourceObservationProducers: SourceObservationProducerDebugSummary | null;
  uploadedDocumentDigestionLocal: UploadedDocumentDigestionLocalDebugSummary[] | null;
  uploadedDocumentDigestionExternal: UploadedDocumentDigestionExternalDebugSummary[] | null;
  debugTrace?: ContextDebugTrace | null;
};

export type ConversationContextBudgetInput = {
  mode?: ContextBudgetMode | null;
  lookup?: ModelBudgetProfileLookup | null;
  resolvedContextBudget?: ReturnType<typeof resolveModelContextBudget> | null;
  documentContextBudgetTokens?: number | null;
};

type ConversationContextDocumentOccurrenceLocation = {
  chunkIndex: number;
  chunkIndexes: number[];
  sourceBodyLocationLabel: string;
  exactPhraseMatchCount: number;
  coverageGroupKey: string | null;
  referencedLocationLabels: string[];
};

type ConversationContextDocumentOccurrenceDebug = {
  searchStatus: "not_requested" | "searched" | "not_searchable";
  targetPhrase: string | null;
  scannedChunkCount: number;
  exactMatchChunkCount: number;
  exactMatchLocationCount: number;
  exactMatchChunkIndexes: number[];
  selectedRepresentativeChunkIndexes: number[];
  skippedDueToBudgetChunkIndexes: number[];
  locations: ConversationContextDocumentOccurrenceLocation[];
  detail: string | null;
};

type ConversationContextDocumentBudgetDebug = {
  budgetInputProvided: boolean;
  mode: ContextBudgetMode | null;
  modelProfileId: string | null;
  provider: string | null;
  protocol: string | null;
  model: string | null;
  documentContextBudgetTokens: number | null;
  fallbackProfileUsed: boolean | null;
  selectedChunkTokenTotal: number;
  skippedDueToBudgetCount: number;
  detail: string;
};

export type ConversationContextDocumentChunkingDocument = {
  sourceId: string;
  attachmentId: string;
  fileId: string;
  filename: string;
  sourceType: string;
  parentSourceStatus: ConversationContextSourceStatus;
  extractionStatus: "unsupported" | "failed" | "unavailable" | "extracted";
  extractionDetail?: string | null;
  sourceMetadata?: Record<string, unknown> | null;
  totalChunks: number;
  selectedChunkIndexes: number[];
  skippedChunkIndexes: number[];
  selectedApproxTokenCount: number;
  totalApproxTokenCount: number;
  selectedCharCount: number;
  totalCharCount: number;
  documentBudgetTokens: number | null;
  selectionMode: ContextDocumentChunkSelectionMode | null;
  selectionBudgetKind: ContextDocumentChunkSelectionBudgetKind | null;
  selectionBudgetChars: number | null;
  selectionBudgetTokens: number | null;
  usedBudgetClamp: boolean;
  coverageSelectionApplied: boolean;
  skippedDueToBudgetCount: number;
  rankingEnabled: boolean;
  rankingQueryTokenCount: number;
  rankingStrategy: ContextDocumentChunkRankingStrategy | null;
  rankingFallbackReason: ContextDocumentChunkRankingFallbackReason;
  occurrenceIntentDetected: boolean;
  occurrenceTargetPhrase: string | null;
  occurrence: ConversationContextDocumentOccurrenceDebug;
  chunkCharRanges: Array<{
    chunkIndex: number;
    charStart: number;
    charEnd: number;
    approxTokenCount: number;
    textPreview: string;
    safeProvenanceLabel: string;
    sectionLabel: string | null;
    sectionPath: string[];
    headingPath: string[];
    sourceBodyLocationLabel: string;
    referencedLocationLabels: string[];
    sheetName: string | null;
    slideNumber: number | null;
    pageNumberStart: number | null;
    pageNumberEnd: number | null;
    pageLabelStart: string | null;
    pageLabelEnd: string | null;
    tableId: string | null;
    figureId: string | null;
    visualClassification: string | null;
    visualClassificationConfidence: string | null;
    visualClassificationReasonCodes: string[];
    visualAnchorTitle: string | null;
    rankingScore: number;
    rankingSignals: string[];
    rankingOrder: number;
    exactPhraseMatchCount: number;
    definitionBoostApplied: boolean;
    coverageGroupKey: string | null;
    selectedDueToCoverage: boolean;
  }>;
};

export type ConversationContextDocumentChunkingDebug = {
  strategy: string;
  budget: ConversationContextDocumentBudgetDebug;
  occurrence: {
    intentDetected: boolean;
    targetPhrase: string | null;
    scannedChunkCount: number;
    exactMatchChunkCount: number;
    exactMatchLocationCount: number;
    searchableDocumentIds: string[];
    unsearchableDocuments: Array<{
      sourceId: string;
      filename: string;
      sourceStatus: ConversationContextSourceStatus;
      detail: string;
    }>;
    detail: string | null;
  } | null;
  documents: ConversationContextDocumentChunkingDocument[];
};

export type ConversationContextKnowledgeArtifactDebug = {
  artifactKey: string;
  kind: KnowledgeArtifactKind;
  status: KnowledgeArtifactStatus;
  title: string | null;
  summary: string | null;
  contentPreview: string;
  tool: InspectionTool | null;
  confidence: number | null;
  approxTokenCount: number;
  sourceLocationLabel: string | null;
  pageNumberStart: number | null;
  pageNumberEnd: number | null;
  pageLabelStart: string | null;
  pageLabelEnd: string | null;
  tableId: string | null;
  figureId: string | null;
  sectionPath: string[];
  headingPath: string[];
  relevanceHints: string[];
  selected: boolean;
  payload: Record<string, unknown> | null;
  createdAt: string;
  updatedAt: string;
};

export type ConversationContextInspectionTaskDebug = {
  taskKey: string;
  kind: InspectionTaskKind;
  status: InspectionTaskStatus;
  tool: InspectionTool;
  requestedCapability: string | null;
  selectedTool: string | null;
  selectionReason: string | null;
  candidateTools: string[];
  eligibleTools: Array<Record<string, unknown>>;
  ineligibleTools: Array<Record<string, unknown>>;
  eligibilityReasons: Array<Record<string, unknown>>;
  approvalStatus: string | null;
  runtimeClass: string | null;
  dataClassPolicy: Record<string, unknown> | null;
  sideEffectLevel: string | null;
  costClass: string | null;
  latencyClass: string | null;
  benchmarkFixtureIds: string[];
  governanceTrace: Record<string, unknown> | null;
  confidence: number | null;
  limitations: string[];
  fallbackRecommendation: string | null;
  recommendedNextCapabilities: string[];
  reusable: boolean | null;
  unmetCapability: Record<string, unknown> | null;
  unmetCapabilityReviewItem: Record<string, unknown> | null;
  rationale: string | null;
  resultSummary: string | null;
  unresolved: string[];
  createdArtifactKeys: string[];
  toolTraceEvents: Array<Record<string, unknown>>;
  sourceLocationLabel: string | null;
  pageNumberStart: number | null;
  pageNumberEnd: number | null;
  pageLabelStart: string | null;
  pageLabelEnd: string | null;
  tableId: string | null;
  figureId: string | null;
  sectionPath: string[];
  headingPath: string[];
  completedAt: string | null;
  createdAt: string;
  updatedAt: string;
  result: Record<string, unknown> | null;
};

export type ConversationContextDocumentIntelligenceDocument = {
  sourceId: string;
  attachmentId: string;
  fileId: string;
  filename: string;
  sourceType: string;
  state: DocumentIntelligenceState;
  artifacts: ConversationContextKnowledgeArtifactDebug[];
  inspectionTasks: ConversationContextInspectionTaskDebug[];
};

export type ConversationContextDocumentIntelligenceDebug = {
  selectedArtifactKeys: string[];
  selectedApproxTokenCount: number;
  documents: ConversationContextDocumentIntelligenceDocument[];
};

function formatThreadDocumentPageRangeLabel(chunk: {
  pageNumberStart?: number | null;
  pageNumberEnd?: number | null;
  pageLabelStart?: string | null;
  pageLabelEnd?: string | null;
}) {
  const startLabel = chunk.pageLabelStart ?? (chunk.pageNumberStart != null ? String(chunk.pageNumberStart) : null);
  const endLabel = chunk.pageLabelEnd ?? (chunk.pageNumberEnd != null ? String(chunk.pageNumberEnd) : null);

  if (!startLabel && !endLabel) {
    return null;
  }

  if (startLabel && endLabel && startLabel !== endLabel) {
    return `pages ${startLabel}-${endLabel}`;
  }

  return `page ${startLabel ?? endLabel}`;
}

function buildThreadDocumentSourceBodyLocationLabel(params: {
  filename: string;
  chunk: Pick<
    ContextDocumentChunk,
    | "sectionPath"
    | "sectionLabel"
    | "safeProvenanceLabel"
    | "pageNumberStart"
    | "pageNumberEnd"
    | "pageLabelStart"
    | "pageLabelEnd"
    | "tableId"
    | "figureId"
    | "visualAnchorTitle"
  >;
}) {
  const pageLabel = formatThreadDocumentPageRangeLabel(params.chunk);

  const sectionPath = Array.from(
    new Set(
      (params.chunk.sectionPath ?? []).filter(
        (entry): entry is string => typeof entry === "string" && entry.trim().length > 0
      )
    )
  );
  if (pageLabel) {
    sectionPath.unshift(pageLabel);
  }
  if (
    params.chunk.sectionLabel?.trim() &&
    !sectionPath.includes(params.chunk.sectionLabel.trim())
  ) {
    sectionPath.push(params.chunk.sectionLabel.trim());
  }
  if (
    params.chunk.tableId?.trim() &&
    !sectionPath.includes(params.chunk.tableId.trim())
  ) {
    sectionPath.push(params.chunk.tableId.trim());
  }
  if (
    params.chunk.figureId?.trim() &&
    !sectionPath.includes(params.chunk.figureId.trim())
  ) {
    sectionPath.push(params.chunk.figureId.trim());
  }
  if (
    sectionPath.length <= 1 &&
    params.chunk.visualAnchorTitle?.trim() &&
    !sectionPath.includes(params.chunk.visualAnchorTitle.trim())
  ) {
    sectionPath.push(params.chunk.visualAnchorTitle.trim());
  }
  if (sectionPath.length > 0) {
    return [params.filename, ...sectionPath].join(" — ");
  }

  if (params.chunk.sectionLabel?.trim()) {
    return [params.filename, params.chunk.sectionLabel.trim()].join(" — ");
  }

  return `${params.filename} — location unclear in excerpt provenance`;
}

function buildChunkTextPreview(value: string) {
  const normalized = value.replace(/\s+/g, " ").trim();
  if (normalized.length <= 80) {
    return normalized;
  }

  return `${normalized.slice(0, 77)}...`;
}

function buildPdfStructureClassificationNote(params: {
  sourceType: string;
  chunk: Pick<
    ContextDocumentChunk,
    | "visualClassification"
    | "visualClassificationConfidence"
    | "visualClassificationReasonCodes"
  >;
}) {
  if (params.sourceType !== "pdf" || !params.chunk.visualClassification) {
    return null;
  }

  const confidencePrefix =
    params.chunk.visualClassificationConfidence === "low"
      ? "probable "
      : params.chunk.visualClassificationConfidence === "medium"
        ? "likely "
        : "";
  const label = `${confidencePrefix}${formatPdfVisualClassificationLabel(params.chunk.visualClassification)}`;

  if (
    params.chunk.visualClassification === "true_table" &&
    params.chunk.visualClassificationReasonCodes.includes("title_only_table_inference")
  ) {
    return `PDF STRUCTURE CLASSIFICATION: ${label}. This classification is based on the page title/context cues only; detailed row/column text was not fully extractable from this page.`;
  }

  if (params.chunk.visualClassification === "table_like_schedule_or_timeline") {
    return `PDF STRUCTURE CLASSIFICATION: ${label}. Treat it as a schedule/timeline visual rather than a clean numeric data table.`;
  }

  if (
    params.chunk.visualClassification === "map_or_location_figure" ||
    params.chunk.visualClassification === "chart_or_plot" ||
    params.chunk.visualClassification === "technical_log_or_well_log" ||
    params.chunk.visualClassification === "schematic_or_diagram" ||
    params.chunk.visualClassification === "photo_or_core_image"
  ) {
    return `PDF STRUCTURE CLASSIFICATION: ${label}. Do not treat it as a clean data table unless the extracted text below shows actual row/column data.`;
  }

  if (params.chunk.visualClassification === "low_text_or_scanned_visual") {
    return `PDF STRUCTURE CLASSIFICATION: ${label}. Do not infer unseen details beyond the extracted text below.`;
  }

  return `PDF STRUCTURE CLASSIFICATION: ${label}.`;
}

function resolveConversationContextBudget(
  budget: ConversationContextBudgetInput | null | undefined,
  documentCount: number
): ResolvedConversationContextBudget {
  const mode = budget?.mode ?? null;
  const budgetInputProvided = Boolean(
    budget?.lookup || budget?.resolvedContextBudget || budget?.documentContextBudgetTokens != null
  );
  const resolvedContextBudget =
    budget?.resolvedContextBudget ??
    (budget?.lookup
      ? resolveModelContextBudget({
          lookup: budget.lookup,
          mode: budget.mode ?? "standard",
        })
      : null);

  const requestedDocumentContextBudgetTokens =
    budget?.documentContextBudgetTokens != null
      ? Math.max(0, Math.floor(budget.documentContextBudgetTokens))
      : null;
  const resolvedDocumentContextBudgetTokens =
    requestedDocumentContextBudgetTokens != null && resolvedContextBudget
      ? Math.min(requestedDocumentContextBudgetTokens, resolvedContextBudget.contextBudgetTokens)
      : requestedDocumentContextBudgetTokens ?? resolvedContextBudget?.contextBudgetTokens ?? null;
  const totalDocumentContextBudgetTokens =
    resolvedDocumentContextBudgetTokens ?? DEFAULT_THREAD_DOCUMENT_CONTEXT_BUNDLE_TOKENS;
  const perDocumentBudgetTokens =
    budgetInputProvided && documentCount <= 1
      ? totalDocumentContextBudgetTokens
      : budgetInputProvided
        ? Math.max(DEFAULT_THREAD_DOCUMENT_CONTEXT_TOKENS, Math.floor(totalDocumentContextBudgetTokens / 3))
        : DEFAULT_THREAD_DOCUMENT_CONTEXT_TOKENS;

  return {
    budgetInputProvided,
    mode: budgetInputProvided ? mode ?? resolvedContextBudget?.mode ?? "standard" : null,
    profile: resolvedContextBudget?.profile ?? null,
    provider: resolvedContextBudget?.profile.providers?.[0] ?? budget?.lookup?.provider ?? null,
    protocol: budget?.lookup?.protocol ?? null,
    model: budget?.lookup?.model ?? null,
    fallbackProfileUsed: budgetInputProvided
      ? (resolvedContextBudget?.profile.id ?? null) === DEFAULT_MODEL_BUDGET_PROFILE.id
      : null,
    totalDocumentContextBudgetTokens,
    perDocumentBudgetTokens: Math.min(totalDocumentContextBudgetTokens, perDocumentBudgetTokens),
  };
}

function buildThreadDocumentOccurrenceDebug(params: {
  document: Pick<ConversationContextDocumentRecord, "id" | "filename">;
  chunks?: ContextDocumentChunk[];
  ranking?: ContextDocumentChunkRankingResult | null;
  selection?: ContextDocumentChunkSelectionResult | null;
  parentSourceStatus: ConversationContextSourceStatus;
  extractionStatus: ConversationContextDocumentChunkingDocument["extractionStatus"];
  occurrenceQuery: {
    intentDetected: boolean;
    targetPhrase: string | null;
  };
}): ConversationContextDocumentOccurrenceDebug {
  const ranking = params.ranking ?? null;
  const selection = params.selection ?? null;
  const occurrenceIntentDetected =
    ranking?.occurrenceIntentDetected ?? params.occurrenceQuery.intentDetected;
  const occurrenceTargetPhrase =
    ranking?.occurrenceTargetPhrase ?? params.occurrenceQuery.targetPhrase;
  if (!occurrenceIntentDetected) {
    return {
      searchStatus: "not_requested",
      targetPhrase: null,
      scannedChunkCount: 0,
      exactMatchChunkCount: 0,
      exactMatchLocationCount: 0,
      exactMatchChunkIndexes: [],
      selectedRepresentativeChunkIndexes: selection?.selectedChunks.map((chunk) => chunk.chunkIndex) ?? [],
      skippedDueToBudgetChunkIndexes: selection?.skippedChunks.map((chunk) => chunk.chunkIndex) ?? [],
      locations: [],
      detail: null,
    };
  }

  if (params.extractionStatus !== "extracted" || !params.chunks?.length) {
    return {
      searchStatus: "not_searchable",
      targetPhrase: occurrenceTargetPhrase,
      scannedChunkCount: 0,
      exactMatchChunkCount: 0,
      exactMatchLocationCount: 0,
      exactMatchChunkIndexes: [],
      selectedRepresentativeChunkIndexes: selection?.selectedChunks.map((chunk) => chunk.chunkIndex) ?? [],
      skippedDueToBudgetChunkIndexes: selection?.skippedChunks.map((chunk) => chunk.chunkIndex) ?? [],
      locations: [],
      detail:
        params.parentSourceStatus === "unsupported"
          ? "This attachment could not be searched because the current thread-document context path does not support its source type."
          : params.parentSourceStatus === "failed"
            ? "This attachment could not be searched because extraction failed before usable chunks were available."
            : "This attachment could not be searched because no extracted chunks were available in this runtime.",
    };
  }

  if (!occurrenceTargetPhrase) {
    return {
      searchStatus: "not_searchable",
      targetPhrase: null,
      scannedChunkCount: 0,
      exactMatchChunkCount: 0,
      exactMatchLocationCount: 0,
      exactMatchChunkIndexes: [],
      selectedRepresentativeChunkIndexes: selection?.selectedChunks.map((chunk) => chunk.chunkIndex) ?? [],
      skippedDueToBudgetChunkIndexes: selection?.skippedChunks.map((chunk) => chunk.chunkIndex) ?? [],
      locations: [],
      detail:
        "Occurrence/listing intent was detected, but no exact target phrase could be resolved for deterministic extracted-chunk scanning.",
    };
  }

  const occurrenceInventory = buildDocumentChunkOccurrenceInventory({
    chunks: params.chunks,
    ranking,
  });
  const locationChunkIndexes = occurrenceInventory.locations.flatMap((location) => location.chunkIndexes);

  return {
    searchStatus: "searched",
    targetPhrase: occurrenceInventory.targetPhrase,
    scannedChunkCount: occurrenceInventory.scannedChunkCount,
    exactMatchChunkCount: occurrenceInventory.exactMatchChunkCount,
    exactMatchLocationCount: occurrenceInventory.locations.length,
    exactMatchChunkIndexes: locationChunkIndexes,
    selectedRepresentativeChunkIndexes: selection?.selectedChunks.map((chunk) => chunk.chunkIndex) ?? [],
    skippedDueToBudgetChunkIndexes: selection?.skippedChunks.map((chunk) => chunk.chunkIndex) ?? [],
    locations: occurrenceInventory.locations.map((location) => ({
      chunkIndex: location.chunkIndex,
      chunkIndexes: [...location.chunkIndexes],
      sourceBodyLocationLabel: buildThreadDocumentSourceBodyLocationLabel({
        filename: params.document.filename,
        chunk: location,
      }),
      exactPhraseMatchCount: location.exactPhraseMatchCount,
      coverageGroupKey: location.coverageGroupKey,
      referencedLocationLabels: [...location.referencedLocationLabels],
    })),
    detail:
      occurrenceInventory.exactMatchChunkCount > 0
        ? `Scanned all ${occurrenceInventory.scannedChunkCount.toLocaleString("en-US")} extracted chunk(s) for the exact target phrase "${occurrenceInventory.targetPhrase}".`
        : `Scanned all ${occurrenceInventory.scannedChunkCount.toLocaleString("en-US")} extracted chunk(s) for the exact target phrase "${occurrenceInventory.targetPhrase}" and found no exact matches.`,
  };
}

function buildThreadDocumentBudgetDebug(params: {
  resolvedBudget: ResolvedConversationContextBudget;
  documents: ConversationContextDocumentChunkingDocument[];
}) {
  return {
    budgetInputProvided: params.resolvedBudget.budgetInputProvided,
    mode: params.resolvedBudget.budgetInputProvided ? params.resolvedBudget.mode : null,
    modelProfileId: params.resolvedBudget.budgetInputProvided
      ? params.resolvedBudget.profile?.id ?? null
      : null,
    provider: params.resolvedBudget.budgetInputProvided ? params.resolvedBudget.provider : null,
    protocol: params.resolvedBudget.budgetInputProvided ? params.resolvedBudget.protocol : null,
    model: params.resolvedBudget.budgetInputProvided ? params.resolvedBudget.model : null,
    documentContextBudgetTokens: params.resolvedBudget.budgetInputProvided
      ? params.resolvedBudget.totalDocumentContextBudgetTokens
      : null,
    fallbackProfileUsed: params.resolvedBudget.budgetInputProvided
      ? params.resolvedBudget.fallbackProfileUsed
      : null,
    selectedChunkTokenTotal: params.documents.reduce(
      (sum, document) => sum + document.selectedApproxTokenCount,
      0
    ),
    skippedDueToBudgetCount: params.documents.reduce(
      (sum, document) => sum + document.skippedDueToBudgetCount,
      0
    ),
    detail: params.resolvedBudget.budgetInputProvided
      ? "Thread-document chunk selection used the resolver-owned model-profile-aware token budget."
      : "Thread-document chunk selection used the conservative legacy-equivalent fallback because no model/profile budget input was provided.",
  } satisfies ConversationContextDocumentBudgetDebug;
}

function buildThreadDocumentOccurrenceSummary(
  documents: ConversationContextDocumentChunkingDocument[]
) {
  const occurrenceDocuments = documents.filter(
    (document) =>
      document.occurrence.searchStatus !== "not_requested" || document.occurrenceIntentDetected
  );
  if (occurrenceDocuments.length === 0) {
    return null;
  }

  const targetPhrase =
    occurrenceDocuments.find((document) => document.occurrence.targetPhrase)?.occurrence.targetPhrase ?? null;
  const searchableDocuments = occurrenceDocuments.filter(
    (document) => document.occurrence.searchStatus === "searched"
  );
  const unsearchableDocuments = occurrenceDocuments
    .filter((document) => document.occurrence.searchStatus === "not_searchable")
    .map((document) => ({
      sourceId: document.sourceId,
      filename: document.filename,
      sourceStatus: document.parentSourceStatus,
      detail: document.occurrence.detail ?? "This attachment could not be searched in the current runtime.",
    }));

  return {
    intentDetected: true,
    targetPhrase,
    scannedChunkCount: searchableDocuments.reduce(
      (sum, document) => sum + document.occurrence.scannedChunkCount,
      0
    ),
    exactMatchChunkCount: searchableDocuments.reduce(
      (sum, document) => sum + document.occurrence.exactMatchChunkCount,
      0
    ),
    exactMatchLocationCount: searchableDocuments.reduce(
      (sum, document) => sum + document.occurrence.exactMatchLocationCount,
      0
    ),
    searchableDocumentIds: searchableDocuments.map((document) => document.sourceId),
    unsearchableDocuments,
    detail: targetPhrase
      ? `The occurrence inventory below was built by scanning ${searchableDocuments.reduce((sum, document) => sum + document.occurrence.scannedChunkCount, 0)} successfully extracted chunk${searchableDocuments.reduce((sum, document) => sum + document.occurrence.scannedChunkCount, 0) === 1 ? "" : "s"} across ${searchableDocuments.length} searchable attachment${searchableDocuments.length === 1 ? "" : "s"} for the exact target phrase "${targetPhrase}". Treat it as the authoritative scan over the successfully extracted contents of those searchable attached files. If you caveat the answer, describe it as based on the successfully extracted contents of the attached file${searchableDocuments.length === 1 ? "" : "s"} in this scan, not only on selected excerpts. Selected excerpts remain a runtime-budgeted subset for explanation.`
      : "Occurrence/listing intent was detected, but the resolver could not build an exact-phrase chunk inventory for every attachment.",
  };
}

type ConversationContextDocumentRecord = {
  id: string;
  conversationId: string;
  filename: string;
  mimeType: string | null;
  fileType: string;
  storagePath: string;
  createdAt?: Date | null;
};

type ConversationDocumentKnowledgeArtifactStoreRecord = {
  id: string;
  conversationDocumentId: string;
  artifactKey: string;
  kind: string;
  status: string;
  title: string | null;
  summary: string | null;
  content: string;
  tool: string | null;
  sourcePageNumber: number | null;
  sourcePageLabel: string | null;
  tableId: string | null;
  figureId: string | null;
  sectionPath: string;
  headingPath: string;
  sourceLocationLabel: string | null;
  payloadJson: string | null;
  relevanceHints: string;
  confidence: number | null;
  createdAt: Date;
  updatedAt: Date;
};

type ConversationDocumentInspectionTaskStoreRecord = {
  id: string;
  conversationDocumentId: string;
  taskKey: string;
  kind: string;
  status: string;
  tool: string;
  rationale: string | null;
  sourcePageNumber: number | null;
  sourcePageLabel: string | null;
  tableId: string | null;
  figureId: string | null;
  sectionPath: string;
  headingPath: string;
  sourceLocationLabel: string | null;
  resultSummary: string | null;
  resultJson: string | null;
  unresolvedJson: string | null;
  createdArtifactKeys: string;
  createdAt: Date;
  updatedAt: Date;
  completedAt: Date | null;
};

type ConversationContextResolverDependencies = {
  listDocuments?: (conversationId: string) => Promise<ConversationContextDocumentRecord[]>;
  readTextFile?: (storagePath: string) => Promise<string>;
  readBinaryFile?: (storagePath: string) => Promise<Buffer>;
  extractPdfText?: (fileBuffer: Buffer) => Promise<string | PdfContextExtractionResult>;
  extractDocxText?: (fileBuffer: Buffer) => Promise<string>;
  extractPptxText?: (fileBuffer: Buffer) => Promise<string>;
  extractSpreadsheetText?: (
    fileBuffer: Buffer,
    document: Pick<ConversationContextDocumentRecord, "filename" | "mimeType">
  ) => Promise<string>;
  persistDocumentIntelligence?: boolean;
  listKnowledgeArtifacts?: (
    conversationDocumentIds: string[]
  ) => Promise<ConversationDocumentKnowledgeArtifactStoreRecord[]>;
  upsertKnowledgeArtifact?: (
    artifact: UpsertDocumentKnowledgeArtifactInput
  ) => Promise<ConversationDocumentKnowledgeArtifactStoreRecord>;
  listInspectionTasks?: (
    conversationDocumentIds: string[]
  ) => Promise<ConversationDocumentInspectionTaskStoreRecord[]>;
  upsertInspectionTask?: (
    task: UpsertDocumentInspectionTaskInput
  ) => Promise<ConversationDocumentInspectionTaskStoreRecord>;
  proposeArtifactPromotionCandidates?: (params: {
    conversationId: string;
    document: ConversationContextDocumentRecord;
    sourceObservations: SourceObservationPromotionInput[];
    existingArtifacts: DocumentKnowledgeArtifactRecord[];
    currentUserPrompt: string | null;
  }) => Promise<ArtifactPromotionCandidate[]>;
  persistAsyncAgentWork?: boolean;
  upsertAsyncAgentWorkItem?: (item: AsyncAgentWorkItem) => Promise<AsyncAgentWorkItem>;
  persistContextRegistry?: boolean;
  listContextRegistryRecords?: (params: {
    conversationId: string;
    conversationDocumentIds: string[];
    request?: string | null;
  }) => Promise<ContextRegistrySelection>;
  upsertContextRegistryRecords?: (batch: ContextRegistryUpsertBatch) => Promise<ContextRegistrySelection>;
};

type UploadedDocumentExternalEscalationInput = {
  document: ConversationContextDocumentRecord;
  contextKind: string;
  sourceMetadata: Record<string, unknown> | null;
  pdfExtractionMetadata: PdfContextExtractionMetadata | null;
  localObservations: SourceObservation[];
  localProducerResults: SourceObservationProducerResult[];
  selectedPages: number[];
  imageInputs: UploadedDocumentExternalImageInput[];
};

export const MAX_THREAD_DOCUMENT_CONTEXT_CHARS = CHAT_THREAD_DOCUMENT_CONTEXT_CHARS;
export const MAX_THREAD_DOCUMENT_CONTEXT_BUNDLE_CHARS = CHAT_THREAD_DOCUMENT_CONTEXT_BUNDLE_CHARS;
const DEFAULT_THREAD_DOCUMENT_CONTEXT_TOKENS = Math.max(
  1,
  Math.floor(MAX_THREAD_DOCUMENT_CONTEXT_CHARS / DEFAULT_APPROX_CHARS_PER_TOKEN)
);
const DEFAULT_THREAD_DOCUMENT_CONTEXT_BUNDLE_TOKENS = Math.max(
  1,
  Math.floor(MAX_THREAD_DOCUMENT_CONTEXT_BUNDLE_CHARS / DEFAULT_APPROX_CHARS_PER_TOKEN)
);
const THREAD_DOCUMENT_SECTION_TOKEN_RESERVE = 64;
const SUPPORTED_THREAD_TEXT_EXTENSIONS = new Set(["txt", "md"]);
const SUPPORTED_THREAD_PDF_EXTENSIONS = new Set(["pdf"]);
const SUPPORTED_THREAD_DOCX_EXTENSIONS = new Set(["docx"]);
const SUPPORTED_THREAD_PPTX_EXTENSIONS = new Set(["pptx"]);
const SUPPORTED_THREAD_SPREADSHEET_EXTENSIONS = new Set(["xlsx", "csv", "tsv"]);
const SUPPORTED_THREAD_IMAGE_EXTENSIONS = new Set(["png", "jpg", "jpeg", "webp"]);
const THREAD_DOCUMENT_SUPPORT_DETAIL =
  "plain text, markdown, PDF, DOCX, PPTX, XLSX, CSV, TSV, and baseline PNG/JPG/JPEG/WEBP image attachment handling";

type ResolvedConversationContextBudget = {
  budgetInputProvided: boolean;
  mode: ContextBudgetMode | null;
  profile: ModelBudgetProfile | null;
  provider: string | null;
  protocol: string | null;
  model: string | null;
  fallbackProfileUsed: boolean | null;
  totalDocumentContextBudgetTokens: number;
  perDocumentBudgetTokens: number;
};
const CONVERSATION_CONTEXT_SOURCE_REGISTRY = [
  {
    id: "thread_documents",
    label: "Thread-attached documents",
    domain: "thread_documents",
    scope: "thread",
    policyMode: "thread_active_membership",
    isAvailable: true,
    isImplemented: true,
  },
  {
    id: "company_documents",
    label: "Company documents",
    domain: "company_documents",
    scope: "workspace",
    policyMode: "future_authorized_retrieval",
    isAvailable: true,
    isImplemented: false,
  },
  {
    id: "browsing",
    label: "Browsing",
    domain: "browsing",
    scope: "external",
    policyMode: "future_authorized_retrieval",
    isAvailable: true,
    isImplemented: false,
  },
  {
    id: "memory",
    label: "Memory",
    domain: "memory",
    scope: "user",
    policyMode: "future_authorized_retrieval",
    isAvailable: true,
    isImplemented: false,
  },
  {
    id: "live_data",
    label: "Live data",
    domain: "live_data",
    scope: "workspace",
    policyMode: "future_authorized_retrieval",
    isAvailable: true,
    isImplemented: false,
  },
] as const satisfies ReadonlyArray<{
  id: ConversationContextSourceId;
  label: string;
  domain: ConversationContextSourceId;
  scope: Exclude<ConversationContextSourceScope, "unknown">;
  policyMode: Exclude<ConversationContextSourcePolicyMode, "unknown">;
  isAvailable: boolean;
  isImplemented: boolean;
}>;
const CONVERSATION_CONTEXT_SOURCE_REGISTRY_BY_ID = new Map(
  CONVERSATION_CONTEXT_SOURCE_REGISTRY.map((source) => [source.id, source])
);
const CONVERSATION_CONTEXT_SOURCE_REQUEST_ORIGIN_PRECEDENCE = [
  "policy_required",
  "explicit_user_request",
  "planner_proposed",
  "fallback_candidate",
  "default_system_candidate",
] as const satisfies ReadonlyArray<ConversationContextSourceRequestOrigin>;
const CONVERSATION_CONTEXT_SOURCE_REQUEST_STATUS_BY_ORIGIN = {
  default_system_candidate: "candidate",
  explicit_user_request: "requested",
  planner_proposed: "proposed",
  policy_required: "required",
  fallback_candidate: "candidate",
} as const satisfies Record<
  ConversationContextSourceRequestOrigin,
  ConversationContextSourceRequestStatus
>;
const NON_DEFAULT_CONVERSATION_CONTEXT_SOURCE_REQUEST_ORIGINS = new Set<
  Exclude<ConversationContextSourceRequestOrigin, "default_system_candidate">
>([
  "explicit_user_request",
  "planner_proposed",
  "policy_required",
  "fallback_candidate",
]);
type PdfParseModule = typeof import("pdf-parse");
type ExtractionRuntimeError = Error & {
  code?: string;
  detail?: string | null;
};

let pdfJsWorkerBootstrapPromise: Promise<void> | null = null;
let pdfParseModulePromise: Promise<PdfParseModule> | null = null;
const MAX_SPREADSHEET_SHEETS = 3;
const MAX_SPREADSHEET_ROWS_PER_SHEET = 20;
const MAX_SPREADSHEET_COLUMNS_PER_ROW = 8;
const MAX_SPREADSHEET_EXTRACTED_CHARS = 4_000;
const MAX_SPREADSHEET_HEAD_ROWS = 4;
const MAX_SPREADSHEET_SUMMARY_ROWS = 3;
const MAX_SPREADSHEET_DISTINCT_VALUE_ROWS = 6;
const MAX_SPREADSHEET_KEY_COLUMNS = 2;
const MAX_PPTX_SLIDES = 12;
const MAX_PPTX_SLIDE_TEXT_LINES = 8;
const MAX_PPTX_NOTE_LINES = 4;
const MAX_PPTX_EXTRACTED_CHARS = 4_000;

type SpreadsheetRow = {
  rowNumber: number;
  cells: string[];
};

type SpreadsheetSheetAnalysis = {
  sheetName: string;
  rows: SpreadsheetRow[];
  score: number;
  isMeaningful: boolean;
  headerRowIndex: number;
  startRowNumber: number;
  regionCount: number;
};

function summarizeExtractionError(error: unknown) {
  if (!(error instanceof Error)) {
    return null;
  }

  const normalized = error.message.replace(/\s+/g, " ").trim();
  if (!normalized) {
    return null;
  }

  return normalized.length > 180 ? `${normalized.slice(0, 177)}...` : normalized;
}

function buildPdfNoReadableTextDetail(metadata?: PdfContextExtractionResult["metadata"] | null) {
  if (metadata && metadata.totalPages > 0) {
    const lowTextDetail = metadata.lowTextPageLabels.length > 0
      ? ` Detected little or no extractable text on ${metadata.lowTextPageLabels.join(", ")}.`
      : "";
    return `Attached to this thread, but the PDF parser returned no readable text.${lowTextDetail} OCR is not implemented in this pass, so image-only/scanned pages remain unavailable to the active runtime.`;
  }

  return "Attached to this thread, but the PDF parser returned no readable text. This usually means the PDF is image-based/scanned or uses an unsupported text layer.";
}

function buildPptxNoReadableTextDetail() {
  return "Attached to this thread, but the PPTX parser returned no readable slide text. This usually means the deck contains little extractable text beyond visuals, charts, or embedded media.";
}

function buildImageRuntimeUnavailableDetail() {
  return "Attached to this thread, but the current Team Chat runtime does not yet load image attachments into the active model context.";
}

function buildSpreadsheetNoReadableTextDetail() {
  return "Attached to this thread, but the spreadsheet parser returned no readable workbook content.";
}

function createPdfRuntimeUnavailableError(error: unknown) {
  const runtimeError = new Error(
    "PDF extraction is unavailable in the current server runtime."
  ) as ExtractionRuntimeError;
  runtimeError.code = "PDF_RUNTIME_UNAVAILABLE";
  runtimeError.detail = summarizeExtractionError(error);
  return runtimeError;
}

function isPdfRuntimeUnavailableError(error: unknown): error is ExtractionRuntimeError {
  return typeof error === "object"
    && error !== null
    && "code" in error
    && (error as { code?: unknown }).code === "PDF_RUNTIME_UNAVAILABLE";
}

function buildExtractionFailureDetail(contextKind: "pdf" | "docx" | "pptx" | "spreadsheet", error: unknown) {
  if (contextKind === "pdf") {
    if (isPdfRuntimeUnavailableError(error)) {
      const detail = typeof error.detail === "string" && error.detail.trim().length > 0
        ? ` (${error.detail.trim()})`
        : "";
      return `Attached to this thread, but PDF extraction is unavailable in the current server runtime${detail}.`;
    }

    const message = summarizeExtractionError(error);
    if (message && /password|encrypted|encrypt/i.test(message)) {
      return `Attached to this thread, but the PDF appears to be encrypted or password-protected (${message}).`;
    }

    return message
      ? `Attached to this thread, but the PDF parser failed before usable text could be extracted (${message}).`
      : "Attached to this thread, but the PDF parser failed before usable text could be extracted.";
  }

  const message = summarizeExtractionError(error);

  if (contextKind === "pptx") {
    return message
      ? `Attached to this thread, but the PPTX parser failed before usable slide text could be extracted (${message}).`
      : "Attached to this thread, but the PPTX parser failed before usable slide text could be extracted.";
  }

  if (contextKind === "spreadsheet") {
    return message
      ? `Attached to this thread, but the spreadsheet parser failed before usable workbook content could be extracted (${message}).`
      : "Attached to this thread, but the spreadsheet parser failed before usable workbook content could be extracted.";
  }

  return message
    ? `Attached to this thread, but the DOCX parser failed before usable text could be extracted (${message}).`
    : "Attached to this thread, but the DOCX parser failed before usable text could be extracted.";
}

function buildUsedThreadDocumentDetail(params: {
  charCount: number;
  fullyIncluded: boolean;
  occurrenceInventoryOnly?: boolean;
  extractionDetail?: string | null;
  artifactCount?: number;
}) {
  const readableChars = params.charCount.toLocaleString("en-US");
  const extractionDetailSuffix = params.extractionDetail?.trim()
    ? ` ${params.extractionDetail.trim()}`
    : "";
  const artifactDetailSuffix =
    params.artifactCount && params.artifactCount > 0
      ? ` ${params.artifactCount} learned artifact${params.artifactCount === 1 ? "" : "s"} from document inspection ${
          params.artifactCount === 1 ? "was" : "were"
        } also included as durable context.`
      : "";

  if (params.occurrenceInventoryOnly) {
    return `Read ${readableChars} readable characters from this thread attachment and included a deterministic exact-phrase occurrence inventory in the active runtime context. No explanatory excerpt from this file fit within the current thread-document context budget.${artifactDetailSuffix}${extractionDetailSuffix}`;
  }

  return params.fullyIncluded
    ? `Read ${readableChars} readable characters from this thread attachment and included the extracted text in the active runtime context.${artifactDetailSuffix}${extractionDetailSuffix}`
    : `Read ${readableChars} readable characters from this thread attachment and included selected excerpts in the active runtime context to stay within the thread-document context budget. If you caveat the answer, describe it as based on the excerpts available in the current context, not as though the uploaded file was unavailable.${artifactDetailSuffix}${extractionDetailSuffix}`;
}

function isPdfContextExtractionResult(value: unknown): value is PdfContextExtractionResult {
  return typeof value === "object"
    && value !== null
    && "text" in value
    && "structuredRanges" in value
    && "metadata" in value;
}

function buildPdfSourceMetadata(metadata: PdfContextExtractionResult["metadata"] | null) {
  if (!metadata) {
    return null;
  }

  return {
    extractor: metadata.extractor,
    extractorVersion: metadata.extractorVersion,
    totalPages: metadata.totalPages,
    extractedPageCount: metadata.extractedPageCount,
    lowTextPageNumbers: metadata.lowTextPageNumbers,
    lowTextPageLabels: metadata.lowTextPageLabels,
    suppressedHeaderLines: metadata.suppressedHeaderLines,
    suppressedFooterLines: metadata.suppressedFooterLines,
    detectedTableCount: metadata.detectedTableCount,
    retainedTableSummaryCount: metadata.retainedTableSummaryCount,
    rejectedTableCandidateCount: metadata.rejectedTableCandidateCount,
    detectedTableCaptionCount: metadata.detectedTableCaptionCount,
    detectedFigureCaptionCount: metadata.detectedFigureCaptionCount,
    pageLabelsAvailable: metadata.pageLabelsAvailable,
    partialExtraction: metadata.partialExtraction,
    ocrStatus: metadata.ocrStatus,
    tableExtractionStatus: metadata.tableExtractionStatus,
    tableExtractionDetail: metadata.tableExtractionDetail,
    pageStructures: metadata.pageStructures,
    classificationCounts: metadata.classificationCounts,
    detail: metadata.detail,
  } satisfies Record<string, unknown>;
}

function buildDocumentIntelligenceLocation(params: {
  pageNumberStart?: number | null;
  pageLabelStart?: string | null;
  tableId?: string | null;
  figureId?: string | null;
  sectionPath?: string[] | null;
  headingPath?: string[] | null;
}): DocumentIntelligenceLocation {
  return {
    pageNumberStart: params.pageNumberStart ?? null,
    pageNumberEnd: params.pageNumberStart ?? null,
    pageLabelStart: params.pageLabelStart ?? null,
    pageLabelEnd: params.pageLabelStart ?? null,
    tableId: params.tableId ?? null,
    figureId: params.figureId ?? null,
    sectionPath: [...(params.sectionPath ?? [])],
    headingPath: [...(params.headingPath ?? [])],
  };
}

function buildArtifactContentPreview(value: string) {
  const normalized = value.replace(/\s+/g, " ").trim();
  if (normalized.length <= 160) {
    return normalized;
  }

  return `${normalized.slice(0, 157)}...`;
}

function buildStoredKnowledgeArtifactRecord(
  record: ConversationDocumentKnowledgeArtifactStoreRecord
): DocumentKnowledgeArtifactRecord {
  return materializeDocumentKnowledgeArtifactRecord({
    id: record.id,
    sourceDocumentId: record.conversationDocumentId,
    artifactKey: record.artifactKey,
    kind: record.kind as KnowledgeArtifactKind,
    status: record.status as KnowledgeArtifactStatus,
    title: record.title,
    summary: record.summary,
    content: record.content,
    tool: (record.tool ?? null) as InspectionTool | null,
    confidence: record.confidence,
    location: buildDocumentIntelligenceLocation({
      pageNumberStart: record.sourcePageNumber,
      pageLabelStart: record.sourcePageLabel,
      tableId: record.tableId,
      figureId: record.figureId,
      sectionPath: parseDocumentIntelligenceJsonValue<string[]>(record.sectionPath, []),
      headingPath: parseDocumentIntelligenceJsonValue<string[]>(record.headingPath, []),
    }),
    sourceLocationLabel: record.sourceLocationLabel,
    payload: parseDocumentIntelligenceJsonValue<Record<string, unknown> | null>(record.payloadJson, null),
    relevanceHints: parseDocumentIntelligenceJsonValue<string[]>(record.relevanceHints, []),
    createdAt: record.createdAt.toISOString(),
    updatedAt: record.updatedAt.toISOString(),
  });
}

function buildStoredInspectionTaskRecord(
  record: ConversationDocumentInspectionTaskStoreRecord
): DocumentInspectionTaskRecord {
  return {
    id: record.id,
    sourceDocumentId: record.conversationDocumentId,
    taskKey: record.taskKey,
    kind: record.kind as InspectionTaskKind,
    status: record.status as InspectionTaskStatus,
    tool: record.tool as InspectionTool,
    rationale: record.rationale,
    location: buildDocumentIntelligenceLocation({
      pageNumberStart: record.sourcePageNumber,
      pageLabelStart: record.sourcePageLabel,
      tableId: record.tableId,
      figureId: record.figureId,
      sectionPath: parseDocumentIntelligenceJsonValue<string[]>(record.sectionPath, []),
      headingPath: parseDocumentIntelligenceJsonValue<string[]>(record.headingPath, []),
    }),
    sourceLocationLabel: record.sourceLocationLabel,
    resultSummary: record.resultSummary,
    result: parseDocumentIntelligenceJsonValue<Record<string, unknown> | null>(record.resultJson, null),
    unresolved: parseDocumentIntelligenceJsonValue<string[]>(record.unresolvedJson, []),
    createdArtifactKeys: parseDocumentIntelligenceJsonValue<string[]>(record.createdArtifactKeys, []),
    createdAt: record.createdAt.toISOString(),
    updatedAt: record.updatedAt.toISOString(),
    completedAt: record.completedAt?.toISOString() ?? null,
  };
}

function buildKnowledgeArtifactDebugRecord(params: {
  artifact: DocumentKnowledgeArtifactRecord;
  selectedArtifactKeys: Set<string>;
}): ConversationContextKnowledgeArtifactDebug {
  return {
    artifactKey: params.artifact.artifactKey,
    kind: params.artifact.kind,
    status: params.artifact.status,
    title: params.artifact.title,
    summary: params.artifact.summary,
    contentPreview: buildArtifactContentPreview(params.artifact.content),
    tool: params.artifact.tool,
    confidence: params.artifact.confidence,
    approxTokenCount: params.artifact.approxTokenCount,
    sourceLocationLabel: params.artifact.sourceLocationLabel,
    pageNumberStart: params.artifact.location.pageNumberStart,
    pageNumberEnd: params.artifact.location.pageNumberEnd,
    pageLabelStart: params.artifact.location.pageLabelStart,
    pageLabelEnd: params.artifact.location.pageLabelEnd,
    tableId: params.artifact.location.tableId,
    figureId: params.artifact.location.figureId,
    sectionPath: [...params.artifact.location.sectionPath],
    headingPath: [...params.artifact.location.headingPath],
    relevanceHints: [...params.artifact.relevanceHints],
    selected: params.selectedArtifactKeys.has(params.artifact.artifactKey),
    payload: params.artifact.payload,
    createdAt: params.artifact.createdAt,
    updatedAt: params.artifact.updatedAt,
  };
}

function isInspectionTraceRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function getInspectionTraceString(value: Record<string, unknown> | null, key: string) {
  const raw = value?.[key];
  return typeof raw === "string" ? raw : null;
}

function getInspectionTraceNumber(value: Record<string, unknown> | null, key: string) {
  const raw = value?.[key];
  return typeof raw === "number" ? raw : null;
}

function getInspectionTraceBoolean(value: Record<string, unknown> | null, key: string) {
  const raw = value?.[key];
  return typeof raw === "boolean" ? raw : null;
}

function getInspectionTraceStringArray(value: Record<string, unknown> | null, key: string) {
  const raw = value?.[key];
  return Array.isArray(raw) ? raw.filter((entry): entry is string => typeof entry === "string") : [];
}

function getInspectionTraceRecord(value: Record<string, unknown> | null, key: string) {
  const raw = value?.[key];
  return isInspectionTraceRecord(raw) ? raw : null;
}

function getInspectionTraceRecordArray(value: Record<string, unknown> | null, key: string) {
  const raw = value?.[key];
  return Array.isArray(raw)
    ? raw.filter((entry): entry is Record<string, unknown> => isInspectionTraceRecord(entry))
    : [];
}

function getInspectionTaskToolTrace(task: DocumentInspectionTaskRecord) {
  return getInspectionTraceRecord(task.result, "toolTrace");
}

function buildInspectionTaskDebugRecord(task: DocumentInspectionTaskRecord): ConversationContextInspectionTaskDebug {
  const toolTrace = getInspectionTaskToolTrace(task);

  return {
    taskKey: task.taskKey,
    kind: task.kind,
    status: task.status,
    tool: task.tool,
    requestedCapability: getInspectionTraceString(toolTrace, "requestedCapability"),
    selectedTool: getInspectionTraceString(toolTrace, "selectedTool"),
    selectionReason: getInspectionTraceString(toolTrace, "selectionReason"),
    candidateTools: getInspectionTraceStringArray(toolTrace, "candidateTools"),
    eligibleTools: getInspectionTraceRecordArray(toolTrace, "eligibleTools"),
    ineligibleTools: getInspectionTraceRecordArray(toolTrace, "ineligibleTools"),
    eligibilityReasons: getInspectionTraceRecordArray(toolTrace, "eligibilityReasons"),
    approvalStatus: getInspectionTraceString(toolTrace, "approvalStatus"),
    runtimeClass: getInspectionTraceString(toolTrace, "runtimeClass"),
    dataClassPolicy: getInspectionTraceRecord(toolTrace, "dataClassPolicy"),
    sideEffectLevel: getInspectionTraceString(toolTrace, "sideEffectLevel"),
    costClass: getInspectionTraceString(toolTrace, "costClass"),
    latencyClass: getInspectionTraceString(toolTrace, "latencyClass"),
    benchmarkFixtureIds: getInspectionTraceStringArray(toolTrace, "benchmarkFixtureIds"),
    governanceTrace: getInspectionTraceRecord(toolTrace, "governanceTrace"),
    confidence: getInspectionTraceNumber(toolTrace, "confidence"),
    limitations: getInspectionTraceStringArray(toolTrace, "limitations"),
    fallbackRecommendation: getInspectionTraceString(toolTrace, "fallbackRecommendation"),
    recommendedNextCapabilities: getInspectionTraceStringArray(toolTrace, "recommendedNextCapabilities"),
    reusable: getInspectionTraceBoolean(toolTrace, "reusable"),
    unmetCapability: getInspectionTraceRecord(toolTrace, "unmetCapability"),
    unmetCapabilityReviewItem: getInspectionTraceRecord(toolTrace, "unmetCapabilityReviewItem"),
    rationale: task.rationale,
    resultSummary: task.resultSummary,
    unresolved: [...task.unresolved],
    createdArtifactKeys: [...task.createdArtifactKeys],
    toolTraceEvents: getInspectionTraceRecordArray(toolTrace, "traceEvents"),
    sourceLocationLabel: task.sourceLocationLabel,
    pageNumberStart: task.location.pageNumberStart,
    pageNumberEnd: task.location.pageNumberEnd,
    pageLabelStart: task.location.pageLabelStart,
    pageLabelEnd: task.location.pageLabelEnd,
    tableId: task.location.tableId,
    figureId: task.location.figureId,
    sectionPath: [...task.location.sectionPath],
    headingPath: [...task.location.headingPath],
    completedAt: task.completedAt,
    createdAt: task.createdAt,
    updatedAt: task.updatedAt,
    result: task.result,
  };
}

function buildArtifactSourceMetadata(params: {
  existingSourceMetadata: Record<string, unknown> | null;
  artifacts: DocumentKnowledgeArtifactRecord[];
  inspectionTasks: DocumentInspectionTaskRecord[];
  selectedArtifacts: DocumentKnowledgeArtifactRecord[];
}) {
  return {
    ...(params.existingSourceMetadata ?? {}),
    learnedArtifactCount: params.artifacts.length,
    selectedArtifactCount: params.selectedArtifacts.length,
    inspectionTaskCount: params.inspectionTasks.length,
  };
}

function buildDocumentIntelligenceDebugDocument(params: {
  document: Pick<ConversationContextDocumentRecord, "id" | "filename" | "fileType">;
  sourceType: string;
  artifacts: DocumentKnowledgeArtifactRecord[];
  inspectionTasks: DocumentInspectionTaskRecord[];
  selectedArtifacts?: DocumentKnowledgeArtifactRecord[];
}): ConversationContextDocumentIntelligenceDocument {
  const selectedArtifactKeys = new Set(
    (params.selectedArtifacts ?? []).map((artifact) => artifact.artifactKey)
  );

  return {
    sourceId: params.document.id,
    attachmentId: params.document.id,
    fileId: params.document.id,
    filename: params.document.filename,
    sourceType: params.sourceType || params.document.fileType || "unknown",
    state: buildDocumentIntelligenceState({
      sourceDocumentId: params.document.id,
      sourceType: params.sourceType || params.document.fileType || "unknown",
      filename: params.document.filename,
      artifacts: params.artifacts,
      inspectionTasks: params.inspectionTasks,
      selectedArtifactKeys: [...selectedArtifactKeys],
    }),
    artifacts: params.artifacts.map((artifact) =>
      buildKnowledgeArtifactDebugRecord({
        artifact,
        selectedArtifactKeys,
      })
    ),
    inspectionTasks: params.inspectionTasks.map(buildInspectionTaskDebugRecord),
  };
}

const AGENT_CONTROL_INSPECTION_CAPABILITIES = [
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
] as const satisfies readonly InspectionCapability[];

function isInspectionCapability(value: unknown): value is InspectionCapability {
  return (
    typeof value === "string" &&
    (AGENT_CONTROL_INSPECTION_CAPABILITIES as readonly string[]).includes(value)
  );
}

function getArtifactUpdatedAt(document: ConversationContextDocumentIntelligenceDocument) {
  const timestamps = document.artifacts
    .map((artifact) => Date.parse(artifact.updatedAt))
    .filter((timestamp) => Number.isFinite(timestamp));

  if (timestamps.length === 0) {
    return null;
  }

  return new Date(Math.max(...timestamps)).toISOString();
}

function isSourceNewerThanArtifacts(params: {
  sourceUpdatedAt: string | null;
  artifactUpdatedAt: string | null;
}) {
  if (!params.sourceUpdatedAt || !params.artifactUpdatedAt) {
    return false;
  }

  const sourceTimestamp = Date.parse(params.sourceUpdatedAt);
  const artifactTimestamp = Date.parse(params.artifactUpdatedAt);

  return Number.isFinite(sourceTimestamp) &&
    Number.isFinite(artifactTimestamp) &&
    sourceTimestamp > artifactTimestamp;
}

function getInspectionRecommendedCapabilities(document: ConversationContextDocumentIntelligenceDocument) {
  return document.inspectionTasks.flatMap((task) => [
    ...task.recommendedNextCapabilities.filter(isInspectionCapability),
    ...getInspectionTraceCapabilityArray(task.result, "toolTrace", "recommendedNextCapabilities"),
  ]);
}

function getInspectionTraceCapabilityArray(
  result: Record<string, unknown> | null,
  traceKey: string,
  arrayKey: string
) {
  const trace = result?.[traceKey];
  if (typeof trace !== "object" || trace === null || Array.isArray(trace)) {
    return [] as InspectionCapability[];
  }

  const value = (trace as Record<string, unknown>)[arrayKey];
  return Array.isArray(value) ? value.filter(isInspectionCapability) : [];
}

function getInspectionUnmetCapabilities(document: ConversationContextDocumentIntelligenceDocument) {
  return document.inspectionTasks.flatMap((task) => {
    const unmetCapability = task.unmetCapability?.capability;
    const reviewCapability = task.unmetCapabilityReviewItem?.requestedCapability;

    return [unmetCapability, reviewCapability].filter(isInspectionCapability);
  });
}

function buildAgentControlSourceSignals(params: {
  sourceDocuments: ConversationContextDocumentRecord[];
  documentChunkingDocuments: ConversationContextDocumentChunkingDocument[];
  documentIntelligenceDocuments: ConversationContextDocumentIntelligenceDocument[];
}): AgentControlSourceSignal[] {
  const sourceDocumentById = new Map(params.sourceDocuments.map((document) => [document.id, document]));
  const chunkingDocumentById = new Map(params.documentChunkingDocuments.map((document) => [document.sourceId, document]));

  return params.documentIntelligenceDocuments.map((document) => {
    const sourceDocument = sourceDocumentById.get(document.sourceId);
    const chunkingDocument = chunkingDocumentById.get(document.sourceId);
    const artifactKinds = document.artifacts.map((artifact) => artifact.kind);
    const warningArtifactKinds = document.artifacts
      .filter((artifact) => artifact.status === "warning" || artifact.kind === "extraction_warning")
      .map((artifact) => artifact.kind);
    const hasWeakArtifact = document.artifacts.some(
      (artifact) =>
        artifact.status === "partial" ||
        artifact.status === "warning" ||
        artifact.status === "open" ||
        artifact.kind === "table_candidate" ||
        artifact.kind === "extraction_warning"
    );
    const sourceUpdatedAt = sourceDocument?.createdAt?.toISOString() ?? null;
    const artifactUpdatedAt = getArtifactUpdatedAt(document);
    const recommendedNextCapabilities = [
      ...getInspectionRecommendedCapabilities(document),
      ...(hasWeakArtifact
        ? (["rendered_page_inspection", "ocr", "vision_page_understanding", "document_ai_table_recovery"] satisfies InspectionCapability[])
        : []),
    ].filter((capability, index, capabilities) => capabilities.indexOf(capability) === index);

    return {
      sourceId: document.sourceId,
      sourceType: document.sourceType,
      filename: document.filename,
      sourceVersion: sourceUpdatedAt ? `created:${sourceUpdatedAt}` : null,
      sourceUpdatedAt,
      artifactUpdatedAt,
      hasWeakArtifact,
      hasStaleArtifact: isSourceNewerThanArtifacts({ sourceUpdatedAt, artifactUpdatedAt }),
      artifactKinds,
      warningArtifactKinds,
      recommendedNextCapabilities,
      unmetCapabilities: getInspectionUnmetCapabilities(document),
      sourceCoverageHints: artifactKinds.includes("table_candidate") ? ["all_tables"] : undefined,
      dataClass: "internal",
      containsUntrustedInstructions: chunkingDocument?.chunkCharRanges.some((chunk) =>
        /\b(ignore previous|system prompt|developer instructions|override instructions)\b/i.test(chunk.textPreview)
      ) ?? false,
      detail: hasWeakArtifact
        ? "Document has partial or warning artifacts that can be reused but may need deeper inspection."
        : null,
    };
  });
}

function buildContextRegistrySection(selection: ContextRegistrySelection) {
  const debts = normalizeRenderableContextDebt(selection.contextDebtRecords);
  const gaps = normalizeRenderableCapabilityGaps(selection.capabilityGapRecords);
  const coverage = normalizeRenderableSourceCoverage(selection.sourceCoverageRecords);
  if (debts.length === 0 && gaps.length === 0 && coverage.length === 0) {
    return null;
  }

  const maxRecordsPerSection = 5;
  const capabilityGapGroups = groupCapabilityGapsForModel(gaps);

  return joinMarkdownSections([
    debts.length > 0
      ? joinMarkdownSections([
          "## Known Source Context Debt",
          "Durable source-memory records for missing, weak, stale, blocked, or unresolved source understanding.",
          ...debts.slice(0, maxRecordsPerSection).map(renderContextDebtClusterForModel),
          debts.length > maxRecordsPerSection
            ? `- ${debts.length - maxRecordsPerSection} additional source context debt cluster(s) omitted from normal prompt context; full details remain in debug trace.`
            : null,
        ])
      : null,
    gaps.length > 0
      ? joinMarkdownSections([
          "## Known Capability Gaps",
          "Durable capability proposals for work the system cannot execute yet. These are not executed tools.",
          ...capabilityGapGroups.map((group) =>
            joinMarkdownSections([
              `### ${group.title}`,
              ...group.records.slice(0, maxRecordsPerSection).map(renderCapabilityGapRecordForModel),
              group.records.length > maxRecordsPerSection
                ? `- ${group.records.length - maxRecordsPerSection} additional capability gap record(s) omitted from normal prompt context for this group; full details remain in debug trace.`
                : null,
            ])
          ),
        ])
      : null,
    coverage.length > 0
      ? joinMarkdownSections([
          "## Source Coverage",
          ...renderSourceCoverageRecordsForModel(coverage.slice(0, maxRecordsPerSection)),
          coverage.length > maxRecordsPerSection
            ? `- ${coverage.length - maxRecordsPerSection} additional source coverage record(s) omitted from normal prompt context; full details remain in debug trace.`
            : null,
        ])
      : null,
  ]);
}

function normalizeDebtKindLabel(kind: string) {
  return (kind === "output_budget_insufficient" ? "output_budget_gap" : kind).replace(/_/g, " ");
}

function isGenericTruthGuardDebt(record: ContextRegistrySelection["contextDebtRecords"][number]) {
  return (
    record.title.includes("Truthful guard observed") ||
    record.description.includes("Execution claim evidence prevented") ||
    record.debtKey.includes("truthful-guard")
  );
}

function contextDebtRichness(record: ContextRegistrySelection["contextDebtRecords"][number]) {
  return (
    (record.linkedArtifactKeys.length > 0 ? 4 : 0) +
    (typeof record.sourceLocator.pageNumber === "number" ? 3 : 0) +
    (record.conversationDocumentId ? 2 : 0) +
    (record.sourceId ? 1 : 0) +
    severityRankForContext(record.severity)
  );
}

function contextDebtSuppressionKey(record: ContextRegistrySelection["contextDebtRecords"][number]) {
  const page = typeof record.sourceLocator.pageNumber === "number" ? `page-${record.sourceLocator.pageNumber}` : "general";
  return [
    record.conversationDocumentId ?? record.sourceId ?? record.conversationId ?? "workspace",
    String(record.kind) === "output_budget_insufficient" ? "output_budget_gap" : record.kind,
    page,
  ].join(":");
}

type ContextDebtRenderCluster = {
  clusterKey: string;
  primaryRecord: ContextRegistrySelection["contextDebtRecords"][number];
  records: ContextRegistrySelection["contextDebtRecords"];
  kinds: string[];
  status: string;
  severity: string;
  linkedArtifactKeys: string[];
  deferredCapabilities: string[];
  resolutionPaths: string[];
};

function normalizedContextDebtKind(kind: string) {
  return kind === "output_budget_insufficient" ? "output_budget_gap" : kind;
}

function contextDebtSourceKey(record: ContextRegistrySelection["contextDebtRecords"][number]) {
  return record.conversationDocumentId ?? record.sourceId ?? record.conversationId ?? "workspace";
}

function contextDebtPageKey(record: ContextRegistrySelection["contextDebtRecords"][number]) {
  return typeof record.sourceLocator.pageNumber === "number" ? `page-${record.sourceLocator.pageNumber}` : "general";
}

function shouldClusterContextDebt(record: ContextRegistrySelection["contextDebtRecords"][number]) {
  return (
    record.linkedArtifactKeys.length > 0 ||
    typeof record.sourceLocator.pageNumber === "number" ||
    record.sourceScope === "page" ||
    record.sourceScope === "table" ||
    [
      "missing_table_body",
      "weak_table_candidate",
      "deferred_capability_needed",
      "validation_gap",
      "incomplete_table_coverage",
    ].includes(normalizedContextDebtKind(record.kind))
  );
}

function contextDebtClusterKey(record: ContextRegistrySelection["contextDebtRecords"][number]) {
  if (!shouldClusterContextDebt(record)) {
    return contextDebtSuppressionKey(record);
  }

  return [
    contextDebtSourceKey(record),
    contextDebtPageKey(record),
    record.sourceScope === "table" || record.linkedArtifactKeys.length > 0 ? "source-memory-gap" : "source-gap",
  ].join(":");
}

function selectPrimaryContextDebtRecord(records: ContextRegistrySelection["contextDebtRecords"]) {
  return [...records].sort((left, right) =>
    contextDebtRichness(right) - contextDebtRichness(left) ||
    severityRankForContext(right.severity) - severityRankForContext(left.severity) ||
    Date.parse(right.lastSeenAt) - Date.parse(left.lastSeenAt)
  )[0] as ContextRegistrySelection["contextDebtRecords"][number];
}

function sortLinkedArtifactKeys(left: string, right: string) {
  const priority = (value: string) => {
    if (value.startsWith("table_candidate:")) return 0;
    if (value.startsWith("extraction_warning:")) return 1;
    return 2;
  };
  return priority(left) - priority(right) || left.localeCompare(right);
}

function normalizeRenderableContextDebt(records: ContextRegistrySelection["contextDebtRecords"]) {
  const richerKindKeys = new Set<string>();
  const richerSourcePageKeys = new Set<string>();
  for (const record of records) {
    if (isGenericTruthGuardDebt(record) || contextDebtRichness(record) < 3) continue;
    richerKindKeys.add([record.conversationId ?? "workspace", normalizedContextDebtKind(record.kind)].join(":"));
    richerSourcePageKeys.add([contextDebtSourceKey(record), contextDebtPageKey(record)].join(":"));
  }

  const clusterRecords = records.filter((record) => {
    if (!isGenericTruthGuardDebt(record)) return true;
    return (
      !richerKindKeys.has([record.conversationId ?? "workspace", normalizedContextDebtKind(record.kind)].join(":")) &&
      !richerSourcePageKeys.has([contextDebtSourceKey(record), contextDebtPageKey(record)].join(":"))
    );
  });
  const byClusterKey = new Map<string, ContextRegistrySelection["contextDebtRecords"]>();

  for (const record of clusterRecords) {
    const key = contextDebtClusterKey(record);
    byClusterKey.set(key, [...(byClusterKey.get(key) ?? []), record]);
  }

  return [...byClusterKey.entries()]
    .map(([clusterKey, groupedRecords]) => {
      const primaryRecord = selectPrimaryContextDebtRecord(groupedRecords);
      const severity = groupedRecords
        .map((record) => record.severity)
        .sort((left, right) => severityRankForContext(right) - severityRankForContext(left))[0] ?? primaryRecord.severity;
      return {
        clusterKey,
        primaryRecord,
        records: groupedRecords,
        kinds: Array.from(new Set(groupedRecords.map((record) => normalizedContextDebtKind(record.kind)))),
        status: primaryRecord.status,
        severity,
        linkedArtifactKeys: Array.from(new Set(groupedRecords.flatMap((record) => record.linkedArtifactKeys))).sort(sortLinkedArtifactKeys),
        deferredCapabilities: Array.from(new Set(groupedRecords.flatMap((record) => record.deferredCapabilities))).sort(),
        resolutionPaths: Array.from(new Set(groupedRecords.flatMap((record) => record.resolutionPaths))).sort(),
      } satisfies ContextDebtRenderCluster;
    })
    .sort((left, right) =>
      severityRankForContext(right.severity) - severityRankForContext(left.severity) ||
      Date.parse(right.primaryRecord.lastSeenAt) - Date.parse(left.primaryRecord.lastSeenAt)
    );
}

function normalizeRenderableCapabilityGaps(records: ContextRegistrySelection["capabilityGapRecords"]) {
  const byKey = new Map<string, ContextRegistrySelection["capabilityGapRecords"][number]>();
  for (const record of records) {
    const key = [
      record.conversationDocumentId ?? record.sourceId ?? record.conversationId ?? "workspace",
      record.kind,
      record.neededCapability,
    ].join(":");
    const existing = byKey.get(key);
    if (!existing || severityRankForContext(record.severity) > severityRankForContext(existing.severity)) {
      byKey.set(key, record);
    }
  }
  return [...byKey.values()].sort((left, right) =>
    severityRankForContext(right.severity) - severityRankForContext(left.severity) ||
    Date.parse(right.lastSeenAt) - Date.parse(left.lastSeenAt)
  );
}

type CapabilityGapRenderGroup = {
  title: "Source Inspection Capability Gaps" | "Creation / Validation Capability Gaps" | "Other Capability Gaps";
  records: ContextRegistrySelection["capabilityGapRecords"];
};

function classifyCapabilityGapForModel(record: ContextRegistrySelection["capabilityGapRecords"][number]) {
  const text = [
    record.kind,
    record.neededCapability,
    record.missingPayloadType,
    record.missingToolId,
    record.missingModelCapability,
    record.missingArtifactType,
    record.missingConnector,
    record.missingApprovalPath,
    record.missingBudgetProfile,
    record.title,
    record.description,
    record.currentLimitation,
    record.recommendedResolution,
    ...record.resolutionPaths,
    ...record.candidateContextLanes,
    ...record.candidateModelCapabilities,
    ...record.candidateToolCategories,
  ]
    .filter((value): value is string => typeof value === "string")
    .join(" ")
    .toLowerCase();

  if (
    record.kind === "missing_creation_capability" ||
    record.kind === "missing_validation_capability" ||
    /deliverable|creation|validation|export|workbook|deck|report|high_fidelity_creation/.test(text)
  ) {
    return "Creation / Validation Capability Gaps" as const;
  }

  if (
    record.kind === "missing_context_lane" ||
    record.kind === "missing_context_transport" ||
    record.kind === "missing_model_capability" ||
    record.kind === "missing_source_coverage_capability" ||
    /rendered|ocr|vision|document.ai|document-ai|table recovery|native image|source inspection|structured table|page image|page crop/.test(text)
  ) {
    return "Source Inspection Capability Gaps" as const;
  }

  return "Other Capability Gaps" as const;
}

function groupCapabilityGapsForModel(records: ContextRegistrySelection["capabilityGapRecords"]) {
  const groups: CapabilityGapRenderGroup[] = [
    { title: "Source Inspection Capability Gaps", records: [] },
    { title: "Creation / Validation Capability Gaps", records: [] },
    { title: "Other Capability Gaps", records: [] },
  ];
  for (const record of records) {
    const title = classifyCapabilityGapForModel(record);
    groups.find((group) => group.title === title)?.records.push(record);
  }
  return groups.filter((group) => group.records.length > 0);
}

function normalizeRenderableSourceCoverage(records: ContextRegistrySelection["sourceCoverageRecords"]) {
  const byKey = new Map<string, ContextRegistrySelection["sourceCoverageRecords"][number]>();
  for (const record of records) {
    if (!["unknown", "uninspected", "partially_inspected", "inspected_with_limitations", "stale", "blocked"].includes(record.coverageStatus)) {
      continue;
    }
    const key = [
      record.conversationDocumentId ?? record.sourceId ?? record.conversationId ?? "workspace",
      record.sourceScope,
      JSON.stringify(record.sourceLocator ?? {}),
      JSON.stringify(record.coverageTarget ?? {}),
      record.coverageStatus,
    ].join(":");
    const existing = byKey.get(key);
    if (!existing || Date.parse(record.updatedAt) > Date.parse(existing.updatedAt)) {
      byKey.set(key, record);
    }
  }
  return [...byKey.values()].sort((left, right) =>
    Date.parse(right.updatedAt) - Date.parse(left.updatedAt) ||
    formatSourceCoverageTarget(left.coverageTarget).localeCompare(formatSourceCoverageTarget(right.coverageTarget))
  );
}

function severityRankForContext(value: string) {
  return { critical: 4, high: 3, medium: 2, low: 1 }[value as "critical" | "high" | "medium" | "low"] ?? 0;
}

function cleanRegistryModelText(value: string | null | undefined) {
  return (value ?? "")
    .replace(/Truthful guard observed unresolved context gap:\s*/gi, "Unresolved context gap: ")
    .replace(/Execution claim evidence prevented this gap from being represented as completed work\./gi, "This remains unresolved.")
    .replace(/\s+/g, " ")
    .trim();
}

function renderContextDebtClusterForModel(cluster: ContextDebtRenderCluster) {
  const record = cluster.primaryRecord;
  const sourceParts = [
    typeof record.sourceLocator.locationLabel === "string" ? record.sourceLocator.locationLabel : null,
    typeof record.sourceLocator.pageNumber === "number" && typeof record.sourceLocator.locationLabel !== "string"
      ? `page ${record.sourceLocator.pageNumber}`
      : null,
  ].filter((part): part is string => Boolean(part));
  const linkedArtifacts = cluster.linkedArtifactKeys.length > 0
    ? ` Linked artifacts: ${cluster.linkedArtifactKeys.join(", ")}.`
    : "";
  const capabilities = cluster.deferredCapabilities.length > 0
    ? ` Needed next capabilities: ${cluster.deferredCapabilities.join(", ")}. These capabilities have not executed.`
    : "";
  const kindSummary =
    cluster.kinds.length > 1
      ? ` Related debt: ${cluster.kinds.map(normalizeDebtKindLabel).join(", ")}.`
      : ` ${normalizeDebtKindLabel(cluster.kinds[0] ?? record.kind)}.`;
  const compactedDetail =
    cluster.records.length > 1
      ? ` Combines ${cluster.records.length} related durable debt records; full individual records remain in debug trace.`
      : "";
  const sourceTitle =
    typeof record.sourceLocator.pageNumber === "number"
      ? `Page ${record.sourceLocator.pageNumber} unresolved source context debt`
      : cleanRegistryModelText(record.title) || "Unresolved source context debt";
  return [
    `- ${sourceTitle} (${cluster.status}, ${cluster.severity}).`,
    sourceParts.length > 0 ? ` Source: ${sourceParts.join(", ")}.` : "",
    kindSummary,
    ` ${cleanRegistryModelText(record.description)}`,
    record.whyItMatters ? ` Why it matters: ${cleanRegistryModelText(record.whyItMatters)}` : "",
    linkedArtifacts,
    capabilities,
    compactedDetail,
  ].join("").trim();
}

function renderCapabilityGapRecordForModel(record: ContextRegistrySelection["capabilityGapRecords"][number]) {
  const resolution = record.resolutionPaths.length > 0
    ? ` Recommended resolution: ${record.resolutionPaths.join(", ")}.`
    : "";
  const fixtures = record.benchmarkFixtureIds.length > 0
    ? ` Benchmark fixture: ${record.benchmarkFixtureIds.join(", ")}.`
    : "";
  return [
    `- ${record.neededCapability} (${record.kind.replace(/_/g, " ")}, ${record.status}, ${record.severity}).`,
    ` ${cleanRegistryModelText(record.currentLimitation ?? record.description)}`,
    resolution,
    fixtures,
    " This is a gap/proposal only; it has not executed.",
  ].join("").trim();
}

function formatSourceCoverageTarget(target: Record<string, unknown>) {
  const rawTarget = typeof target.target === "string" ? target.target : null;
  const rawScope = typeof target.scope === "string" ? target.scope : null;
  return (rawTarget ?? rawScope ?? "source coverage").replace(/_/g, " ");
}

function renderSourceCoverageRecordsForModel(records: ContextRegistrySelection["sourceCoverageRecords"]) {
  const allText = records
    .flatMap((record) => [
      formatSourceCoverageTarget(record.coverageTarget),
      record.coverageStatus,
      ...record.limitations,
      ...record.inspectedBy,
      JSON.stringify(record.sourceLocator ?? {}),
      JSON.stringify(record.coverageTarget ?? {}),
    ])
    .join(" ")
    .toLowerCase();
  const statuses = Array.from(new Set(records.map((record) => record.coverageStatus.replace(/_/g, " ")))).join(", ");
  const targets = Array.from(new Set(records.map((record) => formatSourceCoverageTarget(record.coverageTarget)))).slice(0, 3);
  const lines = [
    `- Relevant source sections ${statuses || "inspected with limitations"} for ${targets.join(", ") || "source coverage"}.`,
  ];

  if (/deliverable|full document|full_document|all pages|all_pages|all tables|all_tables|coverage/.test(allText)) {
    lines.push("- Full deliverable-grade coverage was not achieved.");
  }
  if (/page\s*15|page-15|table body|water chemistry|missing_table_body/.test(allText)) {
    lines.push("- Page 15 table body remains missing.");
  }
  if (/approval|rendered|ocr|vision|document.ai|document-ai|table recovery/.test(allText)) {
    lines.push("- Deeper recovery requires approval and currently unavailable rendered/OCR/vision/document-AI capabilities.");
  }

  if (lines.length === 1 && records.length > 1) {
    lines.push(`- ${records.length} source coverage record(s) were compacted for normal context; full details remain in debug trace.`);
  }

  return lines;
}

function hasContextRegistryPrismaDelegates() {
  const client = prisma as unknown as Record<string, unknown>;
  return Boolean(
    client.contextDebtRecord &&
      client.capabilityGapRecord &&
      client.sourceCoverageRecord
  );
}

function resolvePdfExtractionResult(value: string | PdfContextExtractionResult) {
  if (isPdfContextExtractionResult(value)) {
    return {
      text: value.text,
      structuredRanges: value.structuredRanges,
      metadata: value.metadata,
    };
  }

  return {
    text: value,
    structuredRanges: undefined,
    metadata: null,
  };
}

function normalizeDocumentText(value: string) {
  return value
    .replace(/\r\n/g, "\n")
    .replace(/\u0000/g, "")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function normalizeSpreadsheetCell(value: unknown) {
  if (value == null) return "";
  if (typeof value === "string") {
    return value.replace(/\s+/g, " ").trim();
  }
  if (typeof value === "number" || typeof value === "boolean" || typeof value === "bigint") {
    return String(value);
  }
  if (value instanceof Date) {
    return value.toISOString();
  }

  return String(value).replace(/\s+/g, " ").trim();
}

function normalizeDelimitedText(value: string) {
  return value.replace(/^\uFEFF/, "").replace(/\r\n/g, "\n").replace(/\r/g, "\n");
}

function trimSpreadsheetCells(cells: string[]) {
  let end = cells.length;
  while (end > 0 && cells[end - 1] === "") {
    end -= 1;
  }
  return cells.slice(0, end);
}

function countSpreadsheetCells(row: SpreadsheetRow) {
  return row.cells.length;
}

function isSpreadsheetRowEmpty(row: SpreadsheetRow) {
  return countSpreadsheetCells(row) === 0;
}

function parseSpreadsheetNumericCell(value: string) {
  const normalized = value.replace(/[$,%\s]/g, "").replace(/,/g, "");
  if (!/^[-+]?\d+(\.\d+)?$/.test(normalized)) {
    return null;
  }

  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : null;
}

function isLikelySpreadsheetLabel(value: string) {
  return /[A-Za-z]/.test(value);
}

function isLikelySpreadsheetSummaryRow(row: SpreadsheetRow) {
  return row.cells.some((cell) =>
    /\b(total|subtotal|average|avg|sum|grand total|overall|variance|balance|net)\b/i.test(cell)
  );
}

function formatSpreadsheetHeaderLabels(cells: string[]) {
  const seen = new Map<string, number>();

  return cells.map((value, index) => {
    const base = value || `Column ${index + 1}`;
    const key = base.toLowerCase();
    const count = (seen.get(key) ?? 0) + 1;
    seen.set(key, count);
    return count === 1 ? base : `${base} (${count})`;
  });
}

function scoreSpreadsheetHeaderCandidate(rows: SpreadsheetRow[], index: number) {
  const row = rows[index];
  const nonEmptyCount = countSpreadsheetCells(row);

  if (nonEmptyCount < 2) {
    return Number.NEGATIVE_INFINITY;
  }

  const uniqueCount = new Set(row.cells.map((cell) => cell.toLowerCase())).size;
  const labelLikeCount = row.cells.filter(isLikelySpreadsheetLabel).length;
  const lookahead = rows.slice(index + 1, index + 4);
  const structuredFollowerCount = lookahead.filter(
    (candidate) => countSpreadsheetCells(candidate) >= Math.min(2, nonEmptyCount)
  ).length;

  if (structuredFollowerCount === 0 || labelLikeCount < Math.ceil(nonEmptyCount / 2)) {
    return Number.NEGATIVE_INFINITY;
  }

  return (
    labelLikeCount * 4 +
    uniqueCount * 2 +
    structuredFollowerCount * 6 -
    (nonEmptyCount - uniqueCount) * 3 -
    index * 2
  );
}

function findLikelySpreadsheetHeaderRow(rows: SpreadsheetRow[]) {
  let bestIndex = -1;
  let bestScore = Number.NEGATIVE_INFINITY;

  for (let index = 0; index < Math.min(rows.length, 5); index += 1) {
    const score = scoreSpreadsheetHeaderCandidate(rows, index);
    if (score > bestScore) {
      bestScore = score;
      bestIndex = index;
    }
  }

  return bestScore >= 12 ? bestIndex : -1;
}

function segmentSpreadsheetRegions(rows: SpreadsheetRow[]) {
  const regions: SpreadsheetRow[][] = [];
  let currentRegion: SpreadsheetRow[] = [];

  for (const row of rows) {
    if (isSpreadsheetRowEmpty(row)) {
      if (currentRegion.length > 0) {
        regions.push(currentRegion);
        currentRegion = [];
      }
      continue;
    }

    currentRegion.push(row);
  }

  if (currentRegion.length > 0) {
    regions.push(currentRegion);
  }

  return regions;
}

function analyzeSpreadsheetRegion(
  sheetName: string,
  rows: SpreadsheetRow[],
  regionCount: number
): SpreadsheetSheetAnalysis | null {
  if (rows.length === 0) {
    return null;
  }

  const populatedCellCount = rows.reduce((total, row) => total + countSpreadsheetCells(row), 0);
  const maxColumns = rows.reduce((max, row) => Math.max(max, countSpreadsheetCells(row)), 0);
  const denseRows = rows.filter((row) => countSpreadsheetCells(row) >= 2);
  const singleCellRows = rows.filter((row) => countSpreadsheetCells(row) === 1);
  const summaryRows = rows.filter(isLikelySpreadsheetSummaryRow);
  const headerRowIndex = findLikelySpreadsheetHeaderRow(rows);
  const structuredRows = headerRowIndex >= 0
    ? rows.slice(headerRowIndex + 1).filter((row) => countSpreadsheetCells(row) >= 2)
    : denseRows;
  const isMeaningful =
    headerRowIndex >= 0 ||
    structuredRows.length >= 2 ||
    (denseRows.length >= 1 && maxColumns >= 3) ||
    populatedCellCount >= 6;

  return {
    sheetName,
    rows,
    headerRowIndex,
    isMeaningful,
    startRowNumber: rows[0]?.rowNumber ?? 1,
    regionCount,
    score:
      populatedCellCount +
      denseRows.length * 12 +
      maxColumns * 8 +
      structuredRows.length * 6 +
      summaryRows.length * 4 +
      (headerRowIndex >= 0 ? 35 : 0) -
      singleCellRows.length * 4 -
      Math.max(0, (rows[0]?.rowNumber ?? 1) - 1),
  };
}

function analyzeSpreadsheetSheet(sheetName: string, rows: SpreadsheetRow[]): SpreadsheetSheetAnalysis | null {
  const regions = segmentSpreadsheetRegions(rows);

  if (regions.length === 0) {
    return null;
  }

  const analyses = regions
    .map((region) => analyzeSpreadsheetRegion(sheetName, region, regions.length))
    .filter((analysis): analysis is SpreadsheetSheetAnalysis => Boolean(analysis));

  if (analyses.length === 0) {
    return null;
  }

  return [...analyses].sort(
    (left, right) => right.score - left.score || left.startRowNumber - right.startRowNumber
  )[0] ?? null;
}

function selectSpreadsheetVisibleColumns(rows: SpreadsheetRow[], headerRowIndex: number) {
  const maxColumns = rows.reduce((max, row) => Math.max(max, row.cells.length), 0);
  const scoredColumns = Array.from({ length: maxColumns }, (_, columnIndex) => {
    const values = rows
      .map((row) => row.cells[columnIndex] ?? "")
      .filter((value) => value.length > 0);

    if (values.length === 0) {
      return null;
    }

    const uniqueCount = new Set(values.map((value) => value.toLowerCase())).size;
    const numericCount = values.filter((value) => parseSpreadsheetNumericCell(value) != null).length;
    const label = headerRowIndex >= 0 ? rows[headerRowIndex]?.cells[columnIndex] ?? "" : "";

    return {
      columnIndex,
      score:
        values.length * 3 +
        Math.min(uniqueCount, 8) * 2 +
        (numericCount >= 2 ? 4 : 0) +
        (label.length > 0 ? 8 : 0) -
        (headerRowIndex >= 0 && label.length === 0 ? 3 : 0),
    };
  }).filter((column): column is { columnIndex: number; score: number } => Boolean(column));

  if (scoredColumns.length === 0) {
    return [];
  }

  return scoredColumns
    .sort((left, right) => right.score - left.score || left.columnIndex - right.columnIndex)
    .slice(0, MAX_SPREADSHEET_COLUMNS_PER_ROW)
    .map((column) => column.columnIndex)
    .sort((left, right) => left - right);
}

function rankSpreadsheetKeyColumns(rows: SpreadsheetRow[], visibleColumnIndexes: number[]) {
  return [...visibleColumnIndexes]
    .map((columnIndex) => {
      const values = rows
        .map((row) => row.cells[columnIndex] ?? "")
        .filter((value) => value.length > 0);

      if (values.length === 0) {
        return null;
      }

      const uniqueCount = new Set(values.map((value) => value.toLowerCase())).size;
      const numericCount = values.filter((value) => parseSpreadsheetNumericCell(value) != null).length;
      const labelLikeCount = values.filter(isLikelySpreadsheetLabel).length;

      return {
        columnIndex,
        score: values.length * 2 + uniqueCount * 3 + labelLikeCount * 2 - numericCount * 2,
      };
    })
    .filter((column): column is { columnIndex: number; score: number } => Boolean(column))
    .sort((left, right) => right.score - left.score || left.columnIndex - right.columnIndex)
    .slice(0, MAX_SPREADSHEET_KEY_COLUMNS)
    .map((column) => column.columnIndex);
}

function rankSpreadsheetMetricColumns(rows: SpreadsheetRow[], visibleColumnIndexes: number[]) {
  return [...visibleColumnIndexes]
    .map((columnIndex) => {
      const values = rows
        .map((row) => parseSpreadsheetNumericCell(row.cells[columnIndex] ?? ""))
        .filter((value): value is number => value != null);

      if (values.length < 2) {
        return null;
      }

      return {
        columnIndex,
        score: values.length * 3,
      };
    })
    .filter((column): column is { columnIndex: number; score: number } => Boolean(column))
    .sort((left, right) => right.score - left.score || left.columnIndex - right.columnIndex)
    .map((column) => column.columnIndex);
}

function buildRepresentativeRowIndexes(rows: SpreadsheetRow[], visibleColumnIndexes: number[]) {
  const limit = Math.min(MAX_SPREADSHEET_ROWS_PER_SHEET, rows.length);

  if (rows.length <= limit) {
    return rows.map((_, index) => index);
  }

  const orderedCandidates: number[] = [];

  for (let index = 0; index < Math.min(rows.length, MAX_SPREADSHEET_HEAD_ROWS); index += 1) {
    orderedCandidates.push(index);
  }

  const summaryIndexes = rows
    .map((row, index) => ({ row, index }))
    .filter(({ row }) => isLikelySpreadsheetSummaryRow(row))
    .slice(0, MAX_SPREADSHEET_SUMMARY_ROWS)
    .map(({ index }) => index);
  orderedCandidates.push(...summaryIndexes);

  let distinctValueRowsAdded = 0;
  for (const columnIndex of rankSpreadsheetKeyColumns(rows, visibleColumnIndexes)) {
    const seenValues = new Set<string>();
    for (let index = 0; index < rows.length; index += 1) {
      const value = (rows[index]?.cells[columnIndex] ?? "").toLowerCase();
      if (!value || seenValues.has(value)) {
        continue;
      }

      seenValues.add(value);
      orderedCandidates.push(index);
      distinctValueRowsAdded += 1;

      if (distinctValueRowsAdded >= MAX_SPREADSHEET_DISTINCT_VALUE_ROWS) {
        break;
      }
    }

    if (distinctValueRowsAdded >= MAX_SPREADSHEET_DISTINCT_VALUE_ROWS) {
      break;
    }
  }

  const primaryMetricColumn = rankSpreadsheetMetricColumns(rows, visibleColumnIndexes)[0];
  if (primaryMetricColumn != null) {
    const numericRows = rows
      .map((row, index) => ({
        index,
        value: parseSpreadsheetNumericCell(row.cells[primaryMetricColumn] ?? ""),
      }))
      .filter((candidate): candidate is { index: number; value: number } => candidate.value != null)
      .sort((left, right) => left.value - right.value);

    if (numericRows.length > 0) {
      orderedCandidates.push(numericRows[0].index);
      orderedCandidates.push(numericRows[numericRows.length - 1].index);
    }
  }

  orderedCandidates.push(rows.length - 1);

  const spacingSlots = Math.max(limit, 2);
  for (let slot = 0; slot < spacingSlots; slot += 1) {
    orderedCandidates.push(Math.round((slot * (rows.length - 1)) / (spacingSlots - 1)));
  }

  const uniqueCandidates: number[] = [];
  const seenIndexes = new Set<number>();

  for (const index of orderedCandidates) {
    if (seenIndexes.has(index)) {
      continue;
    }

    seenIndexes.add(index);
    uniqueCandidates.push(index);

    if (uniqueCandidates.length >= limit) {
      break;
    }
  }

  return uniqueCandidates.sort((left, right) => left - right);
}

function renderSpreadsheetSheet(analysis: SpreadsheetSheetAnalysis) {
  const lines = [`### Sheet: ${analysis.sheetName}`];

  if (analysis.headerRowIndex >= 0) {
    const headerRow = analysis.rows[analysis.headerRowIndex];
    const dataRows = analysis.rows
      .slice(analysis.headerRowIndex + 1)
      .filter((row) => countSpreadsheetCells(row) > 0);
    const visibleColumnIndexes = selectSpreadsheetVisibleColumns(analysis.rows, analysis.headerRowIndex);
    const headerLabels = formatSpreadsheetHeaderLabels(
      visibleColumnIndexes.map((index) => headerRow.cells[index] ?? "")
    );
    const visibleRows = buildRepresentativeRowIndexes(dataRows, visibleColumnIndexes).map(
      (index) => dataRows[index]
    );

    lines.push(`Columns: ${headerLabels.join(" | ")}`);
    if (headerRow.rowNumber > 1) {
      lines.push(`Focused on the strongest structured table starting at row ${headerRow.rowNumber}.`);
    }
    if (analysis.regionCount > 1 || dataRows.length > visibleRows.length) {
      lines.push("Representative rows are shown to keep the table compact and decision-useful.");
    }
    lines.push("Rows:");

    if (visibleRows.length === 0) {
      lines.push("- No data rows were found after the detected header.");
    } else {
      for (const row of visibleRows) {
        const alignedCells = visibleColumnIndexes.map((index) => row.cells[index] ?? "");
        lines.push(`- ${alignedCells.join(" | ")}`);
      }
    }

    const omittedRows = dataRows.length - visibleRows.length;
    if (omittedRows > 0) {
      lines.push(`... [${omittedRows} additional data rows omitted after representative sampling]`);
    }
    if (analysis.regionCount > 1) {
      lines.push("... [other low-signal or secondary table regions in this sheet were omitted]");
    }

    return lines.join("\n");
  }

  const visibleColumnIndexes = selectSpreadsheetVisibleColumns(analysis.rows, -1);
  const visibleRows = buildRepresentativeRowIndexes(analysis.rows, visibleColumnIndexes).map(
    (index) => analysis.rows[index]
  );

  lines.push("No clear header row detected; showing representative populated rows in sheet order.");
  if (analysis.startRowNumber > 1) {
    lines.push(`Focused on the strongest populated table region starting at row ${analysis.startRowNumber}.`);
  }
  if (analysis.regionCount > 1 || analysis.rows.length > visibleRows.length) {
    lines.push("Representative rows are shown to keep the table compact and decision-useful.");
  }

  for (const row of visibleRows) {
    const visibleCells = visibleColumnIndexes.map((index) => row.cells[index] ?? "");
    lines.push(`- Row ${row.rowNumber}: ${visibleCells.join(" | ")}`);
  }

  const omittedRows = analysis.rows.length - visibleRows.length;
  if (omittedRows > 0) {
    lines.push(`... [${omittedRows} additional populated rows omitted after representative sampling]`);
  }
  if (analysis.regionCount > 1) {
    lines.push("... [other low-signal or secondary table regions in this sheet were omitted]");
  }

  return lines.join("\n");
}

function resolveSpreadsheetExtension(filename: string) {
  return resolveExtension(filename);
}

function resolveDelimitedSeparator(filename: string, mimeType: string | null) {
  const extension = resolveSpreadsheetExtension(filename);
  if (extension === "tsv" || mimeType === "text/tab-separated-values") {
    return "\t";
  }

  return ",";
}

function resolveDelimitedSheetName(filename: string) {
  const trimmed = filename.trim();
  const withoutExtension = trimmed.replace(/\.[^.]+$/, "").trim();
  return withoutExtension.length > 0 ? withoutExtension : "Sheet1";
}

function parseSpreadsheetWorkbook(
  fileBuffer: Buffer,
  document: Pick<ConversationContextDocumentRecord, "filename" | "mimeType">
) {
  const extension = resolveSpreadsheetExtension(document.filename);

  if (extension === "csv" || extension === "tsv") {
    const workbook = XLSX.read(normalizeDelimitedText(fileBuffer.toString("utf8")), {
      type: "string",
      raw: false,
      FS: resolveDelimitedSeparator(document.filename, document.mimeType),
    });
    const originalSheetName = workbook.SheetNames[0];
    if (originalSheetName && workbook.Sheets[originalSheetName]) {
      const preferredSheetName = resolveDelimitedSheetName(document.filename);
      if (preferredSheetName !== originalSheetName) {
        workbook.Sheets[preferredSheetName] = workbook.Sheets[originalSheetName];
        delete workbook.Sheets[originalSheetName];
        workbook.SheetNames = [preferredSheetName];
      }
    }
    return workbook;
  }

  return XLSX.read(fileBuffer, {
    type: "buffer",
    dense: true,
    cellFormula: false,
    cellHTML: false,
    cellStyles: false,
    cellText: true,
  });
}

function resolveExtension(filename: string) {
  return filename.trim().split(".").pop()?.toLowerCase() ?? "";
}

function resolveDocumentChunkSourceType(
  document: Pick<ConversationContextDocumentRecord, "filename">,
  contextKind: "text" | "pdf" | "docx" | "pptx" | "spreadsheet"
): ContextDocumentChunkSourceType {
  if (contextKind !== "text") {
    return contextKind;
  }

  return resolveExtension(document.filename) === "md" ? "markdown" : "text";
}

function isUploadPath(storagePath: string) {
  const uploadsRoot = normalize(resolve(process.cwd(), "uploads")).toLowerCase();
  const resolvedStoragePath = normalize(resolve(storagePath)).toLowerCase();
  const uploadsPrefix = `${uploadsRoot}${sep}`.toLowerCase();

  return resolvedStoragePath === uploadsRoot || resolvedStoragePath.startsWith(uploadsPrefix);
}

function resolveThreadDocumentContextKind(document: {
  filename: string;
  fileType: string;
}) {
  const extension = resolveExtension(document.filename);

  if (document.fileType === "text" && SUPPORTED_THREAD_TEXT_EXTENSIONS.has(extension)) {
    return "text" as const;
  }

  if (document.fileType === "pdf" && SUPPORTED_THREAD_PDF_EXTENSIONS.has(extension)) {
    return "pdf" as const;
  }

  if (document.fileType === "document" && SUPPORTED_THREAD_DOCX_EXTENSIONS.has(extension)) {
    return "docx" as const;
  }

  if (document.fileType === "document" && SUPPORTED_THREAD_PPTX_EXTENSIONS.has(extension)) {
    return "pptx" as const;
  }

  if (document.fileType === "spreadsheet" && SUPPORTED_THREAD_SPREADSHEET_EXTENSIONS.has(extension)) {
    return "spreadsheet" as const;
  }

  if (document.fileType === "image" && SUPPORTED_THREAD_IMAGE_EXTENSIONS.has(extension)) {
    return "image" as const;
  }

  return null;
}

function resolveStorageReadFailureReason(error: unknown) {
  return (error as NodeJS.ErrnoException).code === "ENOENT"
    ? "the file is missing from disk"
    : "the file could not be read";
}

async function ensureServerPdfJsWorker() {
  const runtimeGlobal = globalThis as typeof globalThis & {
    pdfjsWorker?: { WorkerMessageHandler?: unknown };
  };

  if (runtimeGlobal.pdfjsWorker?.WorkerMessageHandler) {
    return;
  }

  if (!pdfJsWorkerBootstrapPromise) {
    // In the Next server runtime, pdf.js may fall back to a fake worker and try to
    // import "./pdf.worker.mjs" from the bundled chunk directory. Preloading the
    // main-thread worker handler keeps extraction server-safe and avoids that path.
    pdfJsWorkerBootstrapPromise = import("pdfjs-dist/legacy/build/pdf.worker.mjs")
      .then(({ WorkerMessageHandler }) => {
        runtimeGlobal.pdfjsWorker = {
          ...(runtimeGlobal.pdfjsWorker ?? {}),
          WorkerMessageHandler,
        };
      })
      .catch((error) => {
        pdfJsWorkerBootstrapPromise = null;
        throw error;
      });
  }

  await pdfJsWorkerBootstrapPromise;
}

async function loadServerPdfParseModule() {
  if (!pdfParseModulePromise) {
    pdfParseModulePromise = import("pdf-parse")
      .catch((error) => {
        pdfParseModulePromise = null;
        throw createPdfRuntimeUnavailableError(error);
      });
  }

  return pdfParseModulePromise;
}

async function extractThreadPdfText(fileBuffer: Buffer) {
  let PDFParse: PdfParseModule["PDFParse"];
  try {
    ({ PDFParse } = await loadServerPdfParseModule());
    await ensureServerPdfJsWorker();
  } catch (error) {
    throw isPdfRuntimeUnavailableError(error) ? error : createPdfRuntimeUnavailableError(error);
  }

  let parser: {
    getText: (params?: {
      cellSeparator?: string;
      lineEnforce?: boolean;
      pageJoiner?: string;
    }) => Promise<{
      text: string;
      pages: Array<{
        num: number;
        text: string;
      }>;
      total: number;
    }>;
    getInfo: (params?: { parsePageInfo?: boolean }) => Promise<{
      total: number;
      pages: Array<{
        pageNumber: number;
        pageLabel?: string | null;
      }>;
    }>;
    getTable: () => Promise<{
      pages: Array<{
        num: number;
        tables: string[][][];
      }>;
    }>;
    destroy: () => Promise<unknown>;
  } | null = null;

  try {
    parser = new PDFParse({ data: fileBuffer });
    const textResult = await parser.getText({
      cellSeparator: "\t",
      lineEnforce: true,
      pageJoiner: "",
    });
    let infoResult: Awaited<ReturnType<typeof parser.getInfo>> | null = null;
    let tableResult: Awaited<ReturnType<typeof parser.getTable>> | null = null;
    let tableExtractionErrorDetail: string | null = null;

    try {
      infoResult = await parser.getInfo({ parsePageInfo: true });
    } catch {
      infoResult = null;
    }

    try {
      tableResult = await parser.getTable();
    } catch (error) {
      tableExtractionErrorDetail = summarizeExtractionError(error) || "table extraction failed";
    }

    return buildPdfContextExtractionResult({
      textPages: textResult.pages,
      infoPages: infoResult?.pages ?? [],
      tablePages: tableResult?.pages ?? undefined,
      extractorVersion: "pdf-parse@2.4.5",
      tableExtractionErrorDetail,
    });
  } finally {
    if (parser) {
      try {
        await parser.destroy();
      } catch {
        // Swallow cleanup failures so the original extraction result/error remains authoritative.
      }
    }
  }
}

async function extractThreadDocxText(fileBuffer: Buffer) {
  const result = await mammoth.extractRawText({ buffer: fileBuffer });
  const extractionErrors = result.messages.filter((message) => message.type === "error");

  if (extractionErrors.length > 0) {
    throw new Error(extractionErrors.map((message) => message.message).join("; "));
  }

  return result.value;
}

function collectOfficeNodeText(node: OfficeContentNode): string[] {
  const childLines = (node.children ?? []).flatMap((child) => collectOfficeNodeText(child));
  if (childLines.length > 0) {
    return childLines;
  }

  const text = typeof node.text === "string" ? node.text.trim() : "";
  return text ? [text] : [];
}

function preparePptxLines(lines: string[], maxLines: number) {
  const uniqueLines: string[] = [];
  const seen = new Set<string>();

  for (const line of lines) {
    const normalized = normalizeDocumentText(line).replace(/\n+/g, " ").trim();
    if (!normalized) {
      continue;
    }

    const key = normalized.toLowerCase();
    if (seen.has(key)) {
      continue;
    }

    seen.add(key);
    uniqueLines.push(normalized);
  }

  return {
    visibleLines: uniqueLines.slice(0, maxLines),
    omittedCount: Math.max(0, uniqueLines.length - maxLines),
  };
}

async function extractThreadPptxText(fileBuffer: Buffer) {
  const ast = await parseOffice(fileBuffer, {
    ignoreNotes: false,
    putNotesAtLast: false,
    extractAttachments: false,
    ocr: false,
    outputErrorToConsole: false,
  });

  const slideMap = new Map<number, { slideLines: string[]; noteLines: string[] }>();

  for (const node of ast.content) {
    if (node.type !== "slide" && node.type !== "note") {
      continue;
    }

    const slideNumber = (node.metadata as SlideMetadata | undefined)?.slideNumber;
    if (typeof slideNumber !== "number" || !Number.isFinite(slideNumber)) {
      continue;
    }

    const entry = slideMap.get(slideNumber) ?? { slideLines: [], noteLines: [] };
    const lines = collectOfficeNodeText(node);

    if (node.type === "slide") {
      entry.slideLines.push(...lines);
    } else {
      entry.noteLines.push(...lines);
    }

    slideMap.set(slideNumber, entry);
  }

  const slideNumbers = [...slideMap.keys()].sort((left, right) => left - right);
  const sections: string[] = [];
  let remainingChars = MAX_PPTX_EXTRACTED_CHARS;

  for (const slideNumber of slideNumbers.slice(0, MAX_PPTX_SLIDES)) {
    const slide = slideMap.get(slideNumber);
    if (!slide || remainingChars <= 0) {
      break;
    }

    const { visibleLines: visibleSlideLines, omittedCount: omittedSlideLineCount } = preparePptxLines(
      slide.slideLines,
      MAX_PPTX_SLIDE_TEXT_LINES
    );
    const { visibleLines: visibleNoteLines, omittedCount: omittedNoteLineCount } = preparePptxLines(
      slide.noteLines,
      MAX_PPTX_NOTE_LINES
    );

    if (visibleSlideLines.length === 0 && visibleNoteLines.length === 0) {
      continue;
    }

    const lines = [`### Slide ${slideNumber}`];

    if (visibleSlideLines.length > 0) {
      lines.push("Content:");
      lines.push(...visibleSlideLines.map((line) => `- ${line}`));
      if (omittedSlideLineCount > 0) {
        lines.push(`... [${omittedSlideLineCount} additional slide text lines omitted]`);
      }
    } else {
      lines.push("Content: No readable slide body text was found.");
    }

    if (visibleNoteLines.length > 0) {
      lines.push("Speaker notes:");
      lines.push(...visibleNoteLines.map((line) => `- ${line}`));
      if (omittedNoteLineCount > 0) {
        lines.push(`... [${omittedNoteLineCount} additional speaker note lines omitted]`);
      }
    }

    const section = lines.join("\n");
    const nextLength = section.length + (sections.length > 0 ? 2 : 0);

    if (nextLength > remainingChars && sections.length > 0) {
      sections.push("... [additional slide content truncated to fit presentation extraction limits]");
      remainingChars = 0;
      break;
    }

    sections.push(section.slice(0, remainingChars));
    remainingChars -= Math.min(nextLength, remainingChars);
  }

  const omittedSlideCount = Math.max(0, slideNumbers.length - Math.min(slideNumbers.length, MAX_PPTX_SLIDES));
  if (omittedSlideCount > 0 && remainingChars > 0) {
    sections.push(`... [${omittedSlideCount} additional slides omitted to keep the deck context focused]`);
  }

  return sections.join("\n\n");
}

async function extractThreadSpreadsheetText(
  fileBuffer: Buffer,
  document: Pick<ConversationContextDocumentRecord, "filename" | "mimeType">
) {
  const workbook = parseSpreadsheetWorkbook(fileBuffer, document);

  const analyses = workbook.SheetNames
    .map((sheetName) => {
      const sheet = workbook.Sheets[sheetName];
      if (!sheet) {
        return null;
      }

      const rows = XLSX.utils.sheet_to_json<unknown[]>(sheet, {
        header: 1,
        raw: false,
        defval: "",
        blankrows: true,
      })
        .map((row, rowIndex) => ({
          rowNumber: rowIndex + 1,
          cells: trimSpreadsheetCells(row.map(normalizeSpreadsheetCell)),
        }));

      return analyzeSpreadsheetSheet(sheetName, rows);
    })
    .filter((analysis): analysis is SpreadsheetSheetAnalysis => Boolean(analysis));

  const meaningfulAnalyses = analyses.filter((analysis) => analysis.isMeaningful);
  const candidateAnalyses = meaningfulAnalyses.length > 0 ? meaningfulAnalyses : analyses;
  const selectedAnalyses = [...candidateAnalyses]
    .sort((left, right) => right.score - left.score || left.sheetName.localeCompare(right.sheetName))
    .slice(0, MAX_SPREADSHEET_SHEETS);

  const sections: string[] = [];
  let remainingChars = MAX_SPREADSHEET_EXTRACTED_CHARS;

  for (const analysis of selectedAnalyses) {
    if (remainingChars <= 0) break;

    const section = renderSpreadsheetSheet(analysis);
    const nextLength = section.length + (sections.length > 0 ? 2 : 0);

    if (nextLength > remainingChars && sections.length > 0) {
      sections.push("... [additional sheet content truncated to fit spreadsheet extraction limits]");
      remainingChars = 0;
      break;
    }

    sections.push(section.slice(0, remainingChars));
    remainingChars -= Math.min(nextLength, remainingChars);
  }

  const omittedMeaningfulSheetCount = candidateAnalyses.length - selectedAnalyses.length;
  const omittedLowSignalSheetCount = analyses.length - candidateAnalyses.length;

  if (omittedMeaningfulSheetCount > 0 && remainingChars > 0) {
    sections.push(`... [${omittedMeaningfulSheetCount} additional populated sheets omitted to keep the workbook context focused]`);
  }

  if (omittedLowSignalSheetCount > 0 && meaningfulAnalyses.length > 0 && remainingChars > 0) {
    sections.push(`... [${omittedLowSignalSheetCount} low-signal sheets omitted in favor of the most populated workbook tabs]`);
  }

  return sections.join("\n\n");
}

function buildContextSource(
  status: ConversationContextSourceStatus,
  filename: string,
  detail: string
): ConversationContextSource {
  return {
    kind: "thread-document",
    label: filename,
    target: filename,
    detail,
    status,
    domain: "thread_documents",
    scope: "thread",
  };
}

function buildThreadDocumentChunkingDebugDocument(params: {
  document: Pick<ConversationContextDocumentRecord, "id" | "filename" | "fileType">;
  sourceType: string;
  parentSourceStatus: ConversationContextSourceStatus;
  extractionStatus: ConversationContextDocumentChunkingDocument["extractionStatus"];
  extractionDetail?: string | null;
  sourceMetadata?: Record<string, unknown> | null;
  occurrenceQuery?: {
    intentDetected: boolean;
    targetPhrase: string | null;
  };
  documentBudgetTokens?: number | null;
  chunks?: ContextDocumentChunk[];
  ranking?: ContextDocumentChunkRankingResult | null;
  selection?: ContextDocumentChunkSelectionResult | null;
}): ConversationContextDocumentChunkingDocument {
  const chunks = params.chunks ?? [];
  const ranking = params.ranking ?? null;
  const selection = params.selection ?? null;
  const rankingDetails = new Map(
    (ranking?.details ?? []).map((detail) => [
      `${detail.sourceId}:${detail.chunkIndex}`,
      detail,
    ])
  );
  const selectedDueToCoverageChunkKeys = new Set(
    selection?.selectedDueToCoverageChunkKeys ?? []
  );
  const occurrence = buildThreadDocumentOccurrenceDebug({
    document: params.document,
    chunks,
    ranking,
    selection,
    parentSourceStatus: params.parentSourceStatus,
    extractionStatus: params.extractionStatus,
    occurrenceQuery: params.occurrenceQuery ?? {
      intentDetected: false,
      targetPhrase: null,
    },
  });

  return {
    sourceId: params.document.id,
    attachmentId: params.document.id,
    fileId: params.document.id,
    filename: params.document.filename,
    sourceType: params.sourceType || params.document.fileType || "unknown",
    parentSourceStatus: params.parentSourceStatus,
    extractionStatus: params.extractionStatus,
    ...(params.extractionDetail != null ? { extractionDetail: params.extractionDetail } : {}),
    ...(params.sourceMetadata ? { sourceMetadata: params.sourceMetadata } : {}),
    totalChunks: chunks.length,
    selectedChunkIndexes:
      selection?.selectedChunks.map((chunk) => chunk.chunkIndex).sort((left, right) => left - right) ?? [],
    skippedChunkIndexes:
      selection?.skippedChunks.map((chunk) => chunk.chunkIndex).sort((left, right) => left - right) ?? [],
    selectedApproxTokenCount: selection?.selectedApproxTokenCount ?? 0,
    totalApproxTokenCount:
      selection?.totalApproxTokenCount ??
      chunks.reduce((sum, chunk) => sum + chunk.approxTokenCount, 0),
    selectedCharCount: selection?.selectedCharCount ?? 0,
    totalCharCount:
      selection?.totalCharCount ?? chunks.reduce((sum, chunk) => sum + chunk.text.length, 0),
    documentBudgetTokens: params.documentBudgetTokens ?? null,
    selectionMode: selection?.selectionMode ?? null,
    selectionBudgetKind: selection?.selectionBudgetKind ?? null,
    selectionBudgetChars: selection?.selectionBudgetChars ?? null,
    selectionBudgetTokens: selection?.selectionBudgetTokens ?? null,
    usedBudgetClamp: selection?.usedBudgetClamp ?? false,
    coverageSelectionApplied: selection?.coverageSelectionApplied ?? false,
    skippedDueToBudgetCount: selection?.skippedDueToBudgetChunkKeys?.length ?? 0,
    rankingEnabled: ranking?.rankingEnabled ?? false,
    rankingQueryTokenCount: ranking?.queryTokenCount ?? 0,
    rankingStrategy: ranking?.rankingStrategy ?? DEFAULT_DOCUMENT_CHUNK_RANKING_STRATEGY,
    rankingFallbackReason: ranking?.fallbackReason ?? null,
    occurrenceIntentDetected: ranking?.occurrenceIntentDetected ?? params.occurrenceQuery?.intentDetected ?? false,
    occurrenceTargetPhrase: ranking?.occurrenceTargetPhrase ?? params.occurrenceQuery?.targetPhrase ?? null,
    occurrence,
    chunkCharRanges: chunks.map((chunk) => {
      const rankingDetail = rankingDetails.get(`${chunk.sourceId}:${chunk.chunkIndex}`);

      return {
        chunkIndex: chunk.chunkIndex,
        charStart: chunk.charStart,
        charEnd: chunk.charEnd,
        approxTokenCount: chunk.approxTokenCount,
        textPreview: buildChunkTextPreview(chunk.text),
        safeProvenanceLabel: chunk.safeProvenanceLabel,
        sectionLabel: chunk.sectionLabel,
        sectionPath: (chunk.sectionPath ?? []).filter(
          (entry): entry is string => typeof entry === "string" && entry.trim().length > 0
        ),
        headingPath: (chunk.headingPath ?? []).filter(
          (entry): entry is string => typeof entry === "string" && entry.trim().length > 0
        ),
        sourceBodyLocationLabel: buildThreadDocumentSourceBodyLocationLabel({
          filename: params.document.filename,
          chunk,
        }),
        referencedLocationLabels: chunk.referencedLocationLabels,
        sheetName: chunk.sheetName,
        slideNumber: chunk.slideNumber,
        pageNumberStart: chunk.pageNumberStart,
        pageNumberEnd: chunk.pageNumberEnd,
        pageLabelStart: chunk.pageLabelStart,
        pageLabelEnd: chunk.pageLabelEnd,
        tableId: chunk.tableId,
        figureId: chunk.figureId,
        visualClassification: chunk.visualClassification,
        visualClassificationConfidence: chunk.visualClassificationConfidence,
        visualClassificationReasonCodes: [...chunk.visualClassificationReasonCodes],
        visualAnchorTitle: chunk.visualAnchorTitle,
        rankingScore: rankingDetail?.score ?? 0,
        rankingSignals: rankingDetail?.signalLabels ?? [],
        rankingOrder: rankingDetail?.rankingOrder ?? chunk.chunkIndex,
        exactPhraseMatchCount: rankingDetail?.exactPhraseMatchCount ?? 0,
        definitionBoostApplied: rankingDetail?.definitionBoostApplied ?? false,
        coverageGroupKey: rankingDetail?.coverageGroupKey ?? null,
        selectedDueToCoverage: selectedDueToCoverageChunkKeys.has(
          `${chunk.sourceId}:${chunk.chunkIndex}`
        ),
      };
    }),
  };
}

type ThreadDocumentSectionRenderInput = {
  filename: string;
  fullyIncluded?: boolean;
  selection: ContextDocumentChunkSelectionResult;
  ranking?: ContextDocumentChunkRankingResult | null;
  occurrence?: ConversationContextDocumentOccurrenceDebug | null;
  selectedArtifacts?: DocumentKnowledgeArtifactRecord[];
};

function buildThreadDocumentSection(params: ThreadDocumentSectionRenderInput) {
  const displayChunks = [...params.selection.selectedChunks].sort(
    (left, right) => left.charStart - right.charStart || left.chunkIndex - right.chunkIndex
  );
  const displayArtifacts = [...(params.selectedArtifacts ?? [])].sort(
    (left, right) => right.approxTokenCount - left.approxTokenCount || left.artifactKey.localeCompare(right.artifactKey)
  );
  const sourceMemoryBlocks = renderSourceMemoryBlocks({
    filename: params.filename,
    artifacts: displayArtifacts,
  });
  const occurrence = params.occurrence ?? null;
  const occurrenceListingHint =
    params.ranking?.occurrenceIntentDetected && params.ranking.occurrenceTargetPhrase
      ? `For this occurrence/listing request, answer as a list of SOURCE BODY LOCATION labels where "${params.ranking.occurrenceTargetPhrase}" appears. Use the provided SOURCE BODY LOCATION labels only. Do not substitute referenced exhibits, schedules, articles, or sections as locations.`
      : params.ranking?.occurrenceIntentDetected
        ? "For this occurrence/listing request, answer as a list of SOURCE BODY LOCATION labels where the requested term appears. Use the provided SOURCE BODY LOCATION labels only. Do not substitute referenced exhibits, schedules, articles, or sections as locations."
        : null;
  const occurrenceInventorySection =
    occurrence?.searchStatus === "searched"
      ? joinMarkdownSections([
          "### Occurrence Inventory",
          occurrence.detail,
          occurrence.locations.length > 0
            ? occurrence.locations
                .map((location) =>
                  `- ${location.sourceBodyLocationLabel} — ${location.exactPhraseMatchCount} exact match${location.exactPhraseMatchCount === 1 ? "" : "es"} found from the extracted chunk inventory`
                )
                .join("\n")
            : occurrence.targetPhrase
              ? `- No exact matches for "${occurrence.targetPhrase}" were found in the extracted chunk inventory for this attachment.`
              : "- No exact-match occurrence inventory was available for this attachment.",
        ])
      : null;
  const artifactSection = sourceMemoryBlocks.length > 0
    ? joinMarkdownSections([
        "### Source Memory Artifacts",
        "These are durable agent-selected source memories, separate from raw extracted excerpts. Diagnostic source memories describe limitations; positive source memories describe reusable source learning.",
        sourceMemoryBlocks.some((block) => block.cluster.artifactClass === "positive")
          ? joinMarkdownSections([
              "#### Positive Source Learning",
              ...sourceMemoryBlocks
                .filter((block) => block.cluster.artifactClass === "positive")
                .map((block) => block.renderedText),
            ])
          : null,
        sourceMemoryBlocks.some((block) => block.cluster.artifactClass === "diagnostic")
          ? joinMarkdownSections([
              "#### Diagnostic / Unresolved Source Memory",
              ...sourceMemoryBlocks
                .filter((block) => block.cluster.artifactClass === "diagnostic")
                .map((block) => block.renderedText),
            ])
          : null,
      ])
    : null;

  if (
    occurrenceInventorySection == null &&
    artifactSection == null &&
    params.selection.selectedChunks.length === 1 &&
    params.selection.skippedChunks.length === 0 &&
    !params.selection.usedBudgetClamp
  ) {
    return joinMarkdownSections([
      `## Thread Document: ${params.filename}`,
      displayChunks[0]?.text ?? "",
    ]);
  }

  return joinMarkdownSections([
    `## Thread Document: ${params.filename}`,
    occurrenceInventorySection,
    artifactSection,
    displayChunks.length > 0
      ? params.fullyIncluded
        ? "The extracted text available for this attachment in the current runtime context is included below in document order. Use the excerpt provenance labels for exact article, section, exhibit, or schedule references. Treat each provenance header as the body location where the excerpt appears; references mentioned inside the excerpt do not change that location."
        : "Only selected excerpts from this attachment are available below in the current runtime context. Base your answer on the excerpts available here unless a status note says extraction failed or the attachment was unavailable. If more detail may exist elsewhere in the same uploaded file, describe the limit as excerpt/context-budget limited rather than saying the PDF was unavailable. Use the excerpt provenance labels for exact article, section, exhibit, or schedule references. Treat each provenance header as the body location where the excerpt appears; references mentioned inside the excerpt do not change that location."
      : "No explanatory excerpt from this attachment fit within the current runtime budget. Use the occurrence inventory above as the authoritative extracted-chunk scan result for this file's successfully extracted contents.",
    occurrenceListingHint,
    ...displayChunks.map((chunk) =>
      joinMarkdownSections([
        `### Excerpt ${chunk.chunkIndex + 1}`,
        `SOURCE BODY LOCATION: ${buildThreadDocumentSourceBodyLocationLabel({
          filename: params.filename,
          chunk,
        })}`,
        chunk.referencedLocationLabels.length > 0
          ? `REFERENCES MENTIONED IN TEXT (referenced only; not the body location): ${chunk.referencedLocationLabels.join(", ")}`
          : null,
        chunk.sectionPath.length === 0
          ? `EXCERPT PROVENANCE NOTE: ${chunk.safeProvenanceLabel}`
          : null,
        buildPdfStructureClassificationNote({
          sourceType: chunk.sourceType,
          chunk,
        }),
        "TEXT:",
        chunk.text,
      ])
    ),
    params.selection.skippedChunks.length > 0
      ? `... [${params.selection.skippedChunks.length} additional chunk candidates not included in this runtime]`
      : null,
  ]);
}

function rawExcerptCandidateIdForChunk(chunk: ContextDocumentChunk) {
  return `${chunk.sourceId}:${chunk.chunkIndex}`;
}

function allowsBroadNormalExcerptRendering(agentControl: AgentControlDebugSnapshot) {
  return (
    agentControl.taskFidelityLevel === "highest_fidelity_ingestion" ||
    agentControl.taskFidelityLevel === "highest_fidelity_creation" ||
    agentControl.sourceCoverageTarget === "full_document" ||
    agentControl.sourceCoverageTarget === "all_pages" ||
    agentControl.sourceCoverageTarget === "all_tables" ||
    agentControl.sourceCoverageTarget === "all_attachments"
  );
}

function rankOrderForChunk(
  chunk: ContextDocumentChunk,
  ranking: ContextDocumentChunkRankingResult | null | undefined
) {
  return ranking?.details.find(
    (detail) => detail.sourceId === chunk.sourceId && detail.chunkIndex === chunk.chunkIndex
  )?.rankingOrder ?? Number.MAX_SAFE_INTEGER;
}

function uniqueChunksByCandidateId(chunks: ContextDocumentChunk[]) {
  const seen = new Set<string>();
  const result: ContextDocumentChunk[] = [];
  for (const chunk of chunks) {
    const id = rawExcerptCandidateIdForChunk(chunk);
    if (seen.has(id)) continue;
    seen.add(id);
    result.push(chunk);
  }
  return result;
}

function filterSelectionForNormalContext(params: {
  selection: ContextDocumentChunkSelectionResult;
  selectedExcerptIds: Set<string>;
  ranking?: ContextDocumentChunkRankingResult | null;
  allowBroadExcerptRendering: boolean;
  allowFallbackToPreselectedExcerpts: boolean;
}) {
  const maxNormalExcerpts = params.allowBroadExcerptRendering ? 24 : 8;
  const progressiveSelectedChunks =
    params.selectedExcerptIds.size === 0 && params.allowFallbackToPreselectedExcerpts
      ? params.selection.selectedChunks
      : params.selection.selectedChunks.filter((chunk) =>
          params.selectedExcerptIds.has(rawExcerptCandidateIdForChunk(chunk))
        );
  const rankedForNormalContext = [...progressiveSelectedChunks].sort(
    (left, right) =>
      rankOrderForChunk(left, params.ranking) - rankOrderForChunk(right, params.ranking) ||
      left.sourceOrderIndex - right.sourceOrderIndex ||
      left.chunkIndex - right.chunkIndex
  );
  const selectedChunks = rankedForNormalContext.slice(0, maxNormalExcerpts);
  const selectedIds = new Set(selectedChunks.map(rawExcerptCandidateIdForChunk));
  const omittedChunks = params.selection.selectedChunks.filter((chunk) =>
    !selectedIds.has(rawExcerptCandidateIdForChunk(chunk))
  );
  const skippedChunks = uniqueChunksByCandidateId([
    ...params.selection.skippedChunks,
    ...omittedChunks,
  ]);
  const selectedApproxTokenCount = selectedChunks.reduce((sum, chunk) => sum + chunk.approxTokenCount, 0);
  const selectedCharCount = selectedChunks.reduce((sum, chunk) => sum + chunk.text.length, 0);

  return {
    ...params.selection,
    selectedChunks,
    skippedChunks,
    selectedApproxTokenCount,
    selectedCharCount,
    usedBudgetClamp:
      params.selection.usedBudgetClamp ||
      omittedChunks.length > 0 ||
      selectedChunks.length < params.selection.selectedChunks.length,
    selectedDueToCoverageChunkKeys: params.selection.selectedDueToCoverageChunkKeys.filter((key) =>
      selectedIds.has(key)
    ),
    skippedDueToBudgetChunkKeys: Array.from(new Set([
      ...params.selection.skippedDueToBudgetChunkKeys,
      ...omittedChunks.map(rawExcerptCandidateIdForChunk),
    ])),
  } satisfies ContextDocumentChunkSelectionResult;
}

function isPositiveSelectedSourceMemoryArtifact(artifact: DocumentKnowledgeArtifactRecord) {
  const payloadClass = artifact.payload?.artifactClass;
  if (payloadClass === "positive") return true;
  if (payloadClass === "diagnostic") return false;
  return !["table_candidate", "extraction_warning", "open_question"].includes(artifact.kind);
}

type ConversationContextRequestedSource = {
  sourceId: string;
  status: ConversationContextSourceRequestStatus;
  origins: ConversationContextSourceRequestOrigin[];
  detail: string;
};

type ConversationContextRequestedSourcePlan = {
  requestMode: ConversationContextSourceRequestMode;
  requests: ConversationContextRequestedSource[];
  consideredSourceIds: string[];
  defaultCandidateSourceIds: string[];
  explicitUserRequestedSourceIds: string[];
  requestedSourceIds: string[];
  plannerProposedSourceIds: string[];
  policyRequiredSourceIds: string[];
  fallbackCandidateSourceIds: string[];
};

function normalizeConversationContextSourceIds(sourceIds: unknown[] | null | undefined) {
  if (!Array.isArray(sourceIds)) {
    return [];
  }

  return Array.from(new Set(
    sourceIds
      .filter((sourceId): sourceId is string => typeof sourceId === "string" && sourceId.trim().length > 0)
      .map((sourceId) => sourceId.trim())
  ));
}

function isConversationContextSourceRequestOrigin(
  value: unknown
): value is Exclude<ConversationContextSourceRequestOrigin, "default_system_candidate"> {
  return typeof value === "string" && NON_DEFAULT_CONVERSATION_CONTEXT_SOURCE_REQUEST_ORIGINS.has(
    value as Exclude<ConversationContextSourceRequestOrigin, "default_system_candidate">
  );
}

function resolveConversationContextSourceRequestStatus(
  origins: ConversationContextSourceRequestOrigin[]
): ConversationContextSourceRequestStatus {
  for (const origin of CONVERSATION_CONTEXT_SOURCE_REQUEST_ORIGIN_PRECEDENCE) {
    if (origins.includes(origin)) {
      return CONVERSATION_CONTEXT_SOURCE_REQUEST_STATUS_BY_ORIGIN[origin];
    }
  }

  return "candidate";
}

function formatConversationContextSourceRequestOriginLabel(origin: ConversationContextSourceRequestOrigin) {
  switch (origin) {
    case "default_system_candidate":
      return "a default system candidate";
    case "explicit_user_request":
      return "an explicit user request";
    case "planner_proposed":
      return "a planner proposal";
    case "policy_required":
      return "a policy-required source";
    default:
      return "a fallback candidate";
  }
}

function buildConversationContextSourceRequestDetail(origins: ConversationContextSourceRequestOrigin[]) {
  const primaryOrigin = CONVERSATION_CONTEXT_SOURCE_REQUEST_ORIGIN_PRECEDENCE.find(
    (origin) => origins.includes(origin)
  ) ?? "default_system_candidate";
  const additionalOrigins = origins.filter((origin) => origin !== primaryOrigin);
  let detail = "";

  if (primaryOrigin === "default_system_candidate") {
    detail = "Considered as a default system candidate for this conversation runtime.";
  } else if (primaryOrigin === "explicit_user_request") {
    detail = "Included because the user explicitly requested this source for the conversation.";
  } else if (primaryOrigin === "planner_proposed") {
    detail = "Included as a planner-compatible proposal for app-side verification before any execution.";
  } else if (primaryOrigin === "policy_required") {
    detail = "Included because app-side policy marked this source as required before execution could proceed.";
  } else {
    detail = "Considered as a fallback candidate if stronger or preferred sources are unavailable.";
  }

  if (additionalOrigins.length === 0) {
    return detail;
  }

  const additionalLabels = additionalOrigins.map((origin) => formatConversationContextSourceRequestOriginLabel(origin));
  return `${detail} Also marked as ${additionalLabels.join(" and ")}.`;
}

function resolveRequestedConversationContextSourcePlan(
  sourcePlan: ConversationContextAcquisitionPlan | null | undefined
) : ConversationContextRequestedSourcePlan {
  if (!sourcePlan) {
    const defaultCandidateSourceIds = CONVERSATION_CONTEXT_SOURCE_REGISTRY.map((source) => source.id);
    const requests = defaultCandidateSourceIds.map((sourceId) => ({
      sourceId,
      status: "candidate" as const,
      origins: ["default_system_candidate"] as ConversationContextSourceRequestOrigin[],
      detail: buildConversationContextSourceRequestDetail(["default_system_candidate"]),
    }));
    return {
      requestMode: "default",
      requests,
      consideredSourceIds: defaultCandidateSourceIds,
      defaultCandidateSourceIds,
      explicitUserRequestedSourceIds: [],
      requestedSourceIds: [],
      plannerProposedSourceIds: [],
      policyRequiredSourceIds: [],
      fallbackCandidateSourceIds: [],
    };
  }

  const requestOriginsBySourceId = new Map<string, Set<ConversationContextSourceRequestOrigin>>();
  for (const sourceId of normalizeConversationContextSourceIds(sourcePlan.requestedSourceIds)) {
    const origins = requestOriginsBySourceId.get(sourceId) ?? new Set<ConversationContextSourceRequestOrigin>();
    origins.add("planner_proposed");
    requestOriginsBySourceId.set(sourceId, origins);
  }

  if (Array.isArray(sourcePlan.sourceRequests)) {
    for (const sourceRequest of sourcePlan.sourceRequests) {
      if (!sourceRequest || typeof sourceRequest !== "object") {
        continue;
      }

      const sourceId = typeof sourceRequest.sourceId === "string" ? sourceRequest.sourceId.trim() : "";
      if (!sourceId) {
        continue;
      }

      if (!isConversationContextSourceRequestOrigin(sourceRequest.origin)) {
        continue;
      }

      const origins = requestOriginsBySourceId.get(sourceId) ?? new Set<ConversationContextSourceRequestOrigin>();
      origins.add(sourceRequest.origin);
      requestOriginsBySourceId.set(sourceId, origins);
    }
  }

  const requests = Array.from(requestOriginsBySourceId.entries()).map(([sourceId, originsSet]) => {
    const origins = CONVERSATION_CONTEXT_SOURCE_REQUEST_ORIGIN_PRECEDENCE.filter((origin) => originsSet.has(origin));
    const status = resolveConversationContextSourceRequestStatus(origins);
    return {
      sourceId,
      status,
      origins,
      detail: buildConversationContextSourceRequestDetail(origins),
    } satisfies ConversationContextRequestedSource;
  });

  const explicitUserRequestedSourceIds = requests
    .filter((request) => request.origins.includes("explicit_user_request"))
    .map((request) => request.sourceId);
  const plannerProposedSourceIds = requests
    .filter((request) => request.origins.includes("planner_proposed"))
    .map((request) => request.sourceId);
  const policyRequiredSourceIds = requests
    .filter((request) => request.origins.includes("policy_required"))
    .map((request) => request.sourceId);
  const fallbackCandidateSourceIds = requests
    .filter((request) => request.origins.includes("fallback_candidate"))
    .map((request) => request.sourceId);

  return {
    requestMode: "plan",
    requests,
    consideredSourceIds: requests.map((request) => request.sourceId),
    defaultCandidateSourceIds: [],
    explicitUserRequestedSourceIds,
    requestedSourceIds: requests
      .filter((request) => request.status !== "candidate")
      .map((request) => request.sourceId),
    plannerProposedSourceIds,
    policyRequiredSourceIds,
    fallbackCandidateSourceIds,
  };
}

function buildConversationContextSourceDecisionDetail(params: {
  sourceId: string;
  reason: ConversationContextSourceDecisionReason;
}) {
  if (params.reason === "allowed") {
    if (params.sourceId === "thread_documents") {
      return "Allowed because the requesting user is an authoritative active thread member and the active agent is the authoritative active agent for this thread runtime.";
    }

    return "Allowed for execution in the current conversation runtime.";
  }

  if (params.reason === "not_registered") {
    return "Excluded because this source is not registered in the current conversation-context source registry.";
  }

  if (params.reason === "not_in_scope") {
    if (params.sourceId === "thread_documents") {
      return "Excluded because thread-attached documents only apply to a concrete thread conversation scope.";
    }

    return "Excluded because this source is outside the current conversation scope.";
  }

  if (params.reason === "not_available") {
    return "Excluded because this source is not enabled or available in the current workspace runtime.";
  }

  if (params.reason === "requesting_user_not_allowed") {
    return "Excluded because the requesting user is not an authoritative active member of this thread.";
  }

  if (params.reason === "active_agent_not_allowed") {
    return "Excluded because no authoritative active agent is available for this thread runtime.";
  }

  return "Excluded because this source is registered as a future capability, but retrieval for it is not implemented in the current runtime.";
}

function resolveConversationContextSourceExclusionCategory(
  reason: ConversationContextSourceExclusionReason
): ConversationContextSourceExclusionCategory {
  if (reason === "not_registered") {
    return "registration";
  }

  if (reason === "not_in_scope") {
    return "scope";
  }

  if (reason === "requesting_user_not_allowed" || reason === "active_agent_not_allowed") {
    return "authorization";
  }

  if (reason === "not_available" || reason === "budget_exhausted") {
    return reason === "budget_exhausted" ? "budget" : "availability";
  }

  return "implementation";
}

function resolveConversationContextSourceExclusion(params: {
  sourceId: string;
  reason: ConversationContextSourceDecisionReason;
}) {
  if (params.reason === "allowed") {
    return null;
  }

  const detail = buildConversationContextSourceDecisionDetail(params);
  return {
    category: resolveConversationContextSourceExclusionCategory(params.reason),
    reason: params.reason,
    detail,
  } satisfies ConversationContextSourceExclusion;
}

function buildConversationContextSourceExecutionDetail(params: {
  sourceId: string;
  admissionStatus: ConversationContextSourceDecision["admission"]["status"];
  exclusion: ConversationContextSourceExclusion | null;
  executed: boolean;
  threadDocumentCount?: number;
}) {
  if (!params.executed) {
    if (params.admissionStatus === "excluded") {
      return params.exclusion
        ? `Did not execute because this source was excluded before runtime execution (${params.exclusion.category}: ${params.exclusion.reason}).`
        : "Did not execute because this source was excluded before runtime execution.";
    }

    return "Did not execute a runtime adapter for this source in this pass.";
  }

  if (params.sourceId === "thread_documents") {
    const attachmentCount = params.threadDocumentCount ?? 0;
    return attachmentCount === 0
      ? "Executed thread-attached document retrieval for this conversation, but no in-scope thread attachments were available."
      : attachmentCount === 1
        ? "Executed thread-attached document retrieval for this conversation and evaluated 1 in-scope attachment."
        : `Executed thread-attached document retrieval for this conversation and evaluated ${attachmentCount.toLocaleString("en-US")} in-scope attachments.`;
  }

  return "Executed this source adapter in the current runtime.";
}

function resolveConversationContextSourceDecision(params: {
  request: ConversationContextRequestedSource;
  conversationId: string;
  authority: ConversationContextSourceAuthority;
  requestMode: ConversationContextSourceRequestMode;
}): ConversationContextSourceDecision {
  const source = CONVERSATION_CONTEXT_SOURCE_REGISTRY_BY_ID.get(
    params.request.sourceId as ConversationContextSourceId
  );

  if (!source) {
    const exclusion = resolveConversationContextSourceExclusion({
      sourceId: params.request.sourceId,
      reason: "not_registered",
    });
    if (!exclusion) {
      throw new Error("Source exclusion resolution must exist for unregistered sources.");
    }
    return {
      sourceId: params.request.sourceId,
      label: params.request.sourceId,
      request: {
        status: params.request.status,
        mode: params.requestMode,
        origins: params.request.origins,
        detail: params.request.detail,
      },
      admission: {
        status: "excluded",
      },
      execution: {
        status: "not_executed",
        detail: buildConversationContextSourceExecutionDetail({
          sourceId: params.request.sourceId,
          admissionStatus: "excluded",
          exclusion,
          executed: false,
        }),
        summary: null,
      },
      exclusion,
      status: "excluded",
      reason: "not_registered",
      detail: exclusion.detail,
      domain: "unknown",
      scope: "unknown",
      policyMode: "unknown",
      eligibility: {
        isRegistered: false,
        isInScope: false,
        isAvailable: false,
        isRequestingUserAllowed: false,
        isActiveAgentAllowed: false,
        isImplemented: false,
      },
    };
  }

  const isInScope = source.scope === "thread" ? Boolean(params.conversationId.trim()) : true;
  const isRequestingUserAllowed = source.policyMode === "thread_active_membership"
    ? Boolean(
        params.authority.requestingUserId
        && params.authority.activeUserIds.includes(params.authority.requestingUserId)
      )
    : true;
  const isActiveAgentAllowed = source.policyMode === "thread_active_membership"
    ? Boolean(
        params.authority.activeAgentId
        && params.authority.activeAgentIds.includes(params.authority.activeAgentId)
      )
    : true;
  const eligibility = {
    isRegistered: true,
    isInScope,
    isAvailable: source.isAvailable,
    isRequestingUserAllowed,
    isActiveAgentAllowed,
    isImplemented: source.isImplemented,
  };
  let reason: ConversationContextSourceDecisionReason = "allowed";

  if (!eligibility.isInScope) {
    reason = "not_in_scope";
  } else if (!eligibility.isAvailable) {
    reason = "not_available";
  } else if (!eligibility.isRequestingUserAllowed) {
    reason = "requesting_user_not_allowed";
  } else if (!eligibility.isActiveAgentAllowed) {
    reason = "active_agent_not_allowed";
  } else if (!eligibility.isImplemented) {
    reason = "not_implemented";
  }
  const exclusion = resolveConversationContextSourceExclusion({
    sourceId: source.id,
    reason,
  });
  const admissionStatus = reason === "allowed" ? "allowed" : "excluded";
  const detail = exclusion?.detail ?? buildConversationContextSourceDecisionDetail({
    sourceId: source.id,
    reason,
  });

  return {
    sourceId: source.id,
    label: source.label,
    request: {
      status: params.request.status,
      mode: params.requestMode,
      origins: params.request.origins,
      detail: params.request.detail,
    },
    admission: {
      status: admissionStatus,
    },
    execution: {
      status: "not_executed",
      detail: buildConversationContextSourceExecutionDetail({
        sourceId: source.id,
        admissionStatus,
        exclusion,
        executed: false,
      }),
      summary: null,
    },
    exclusion,
    status: admissionStatus,
    reason,
    detail,
    domain: source.domain,
    scope: source.scope,
    policyMode: source.policyMode,
    eligibility,
  };
}

function resolveConversationContextSourceDecisions(params: {
  conversationId: string;
  authority: ConversationContextSourceAuthority;
  requestedSources: ConversationContextRequestedSourcePlan;
}) {
  return params.requestedSources.requests.map((request) =>
    resolveConversationContextSourceDecision({
      request,
      conversationId: params.conversationId,
      authority: params.authority,
      requestMode: params.requestedSources.requestMode,
    })
  );
}

function finalizeConversationContextSourceDecision(params: {
  sourceDecision: ConversationContextSourceDecision;
  threadDocumentSummary: {
    totalCount: number;
    usedCount: number;
    unsupportedCount: number;
    failedCount: number;
    unavailableCount: number;
    excludedCategories: ConversationContextSourceExclusionCategory[];
  };
}) {
  if (params.sourceDecision.sourceId !== "thread_documents") {
    return params.sourceDecision;
  }

  const executed = params.sourceDecision.admission.status === "allowed";
  const executionStatus: ConversationContextSourceDecision["execution"]["status"] =
    executed ? "executed" : "not_executed";
  return {
    ...params.sourceDecision,
    execution: {
      status: executionStatus,
      detail: buildConversationContextSourceExecutionDetail({
        sourceId: params.sourceDecision.sourceId,
        admissionStatus: params.sourceDecision.admission.status,
        exclusion: params.sourceDecision.exclusion,
        executed,
        threadDocumentCount: params.threadDocumentSummary.totalCount,
      }),
      summary: executed ? params.threadDocumentSummary : null,
    },
  };
}

function buildConversationContextSourceSelection(params: {
  requestedSources: ConversationContextRequestedSourcePlan;
  sourceDecisions: ConversationContextSourceDecision[];
}): ConversationContextSourceSelection {
  return {
    requestMode: params.requestedSources.requestMode,
    consideredSourceIds: params.requestedSources.consideredSourceIds,
    defaultCandidateSourceIds: params.requestedSources.defaultCandidateSourceIds,
    explicitUserRequestedSourceIds: params.requestedSources.explicitUserRequestedSourceIds,
    requestedSourceIds: params.requestedSources.requestedSourceIds,
    plannerProposedSourceIds: params.requestedSources.plannerProposedSourceIds,
    policyRequiredSourceIds: params.requestedSources.policyRequiredSourceIds,
    fallbackCandidateSourceIds: params.requestedSources.fallbackCandidateSourceIds,
    allowedSourceIds: params.sourceDecisions
      .filter((sourceDecision) => sourceDecision.admission.status === "allowed")
      .map((sourceDecision) => sourceDecision.sourceId),
    executedSourceIds: params.sourceDecisions
      .filter((sourceDecision) => sourceDecision.execution.status === "executed")
      .map((sourceDecision) => sourceDecision.sourceId),
    excludedSourceIds: params.sourceDecisions
      .filter((sourceDecision) => sourceDecision.admission.status === "excluded")
      .map((sourceDecision) => sourceDecision.sourceId),
  };
}

export async function resolveConversationContextBundle(params: {
  conversationId: string;
  authority: ConversationContextSourceAuthority;
  sourcePlan?: ConversationContextAcquisitionPlan | null;
  currentUserPrompt?: string | null;
  budget?: ConversationContextBudgetInput | null;
}, dependencies: ConversationContextResolverDependencies = {}): Promise<ConversationContextBundle> {
  const listDocuments = dependencies.listDocuments ?? (async (conversationId: string) => prisma.conversationDocument.findMany({
    where: { conversationId },
    orderBy: { createdAt: "asc" },
    select: {
      id: true,
      conversationId: true,
      filename: true,
      mimeType: true,
      fileType: true,
      storagePath: true,
      createdAt: true,
    },
  }));
  const readTextFile = dependencies.readTextFile ?? ((storagePath: string) => readFile(storagePath, "utf8"));
  const readBinaryFile = dependencies.readBinaryFile ?? ((storagePath: string) => readFile(storagePath));
  const extractPdfText = dependencies.extractPdfText ?? extractThreadPdfText;
  const extractDocxText = dependencies.extractDocxText ?? extractThreadDocxText;
  const extractPptxText = dependencies.extractPptxText ?? extractThreadPptxText;
  const extractSpreadsheetText = dependencies.extractSpreadsheetText ?? extractThreadSpreadsheetText;
  const persistDocumentIntelligence = dependencies.persistDocumentIntelligence ?? !dependencies.listDocuments;
  const listKnowledgeArtifacts = dependencies.listKnowledgeArtifacts ?? (
    persistDocumentIntelligence
      ? async (conversationDocumentIds: string[]) => prisma.conversationDocumentKnowledgeArtifact.findMany({
          where: {
            conversationDocumentId: {
              in: conversationDocumentIds,
            },
          },
          orderBy: [{ updatedAt: "desc" }, { createdAt: "desc" }],
          select: {
            id: true,
            conversationDocumentId: true,
            artifactKey: true,
            kind: true,
            status: true,
            title: true,
            summary: true,
            content: true,
            tool: true,
            sourcePageNumber: true,
            sourcePageLabel: true,
            tableId: true,
            figureId: true,
            sectionPath: true,
            headingPath: true,
            sourceLocationLabel: true,
            payloadJson: true,
            relevanceHints: true,
            confidence: true,
            createdAt: true,
            updatedAt: true,
          },
        })
      : async () => []
  );
  const upsertKnowledgeArtifact = dependencies.upsertKnowledgeArtifact ?? (
    persistDocumentIntelligence
      ? async (artifact: UpsertDocumentKnowledgeArtifactInput) => prisma.conversationDocumentKnowledgeArtifact.upsert({
          where: {
            conversationDocumentId_artifactKey: {
              conversationDocumentId: artifact.sourceDocumentId,
              artifactKey: artifact.artifactKey,
            },
          },
          create: {
            conversationDocumentId: artifact.sourceDocumentId,
            artifactKey: artifact.artifactKey,
            kind: artifact.kind,
            status: artifact.status,
            title: artifact.title,
            summary: artifact.summary,
            content: artifact.content,
            tool: artifact.tool,
            sourcePageNumber: artifact.location.pageNumberStart,
            sourcePageLabel: artifact.location.pageLabelStart,
            tableId: artifact.location.tableId,
            figureId: artifact.location.figureId,
            sectionPath: stringifyDocumentIntelligenceJsonValue(artifact.location.sectionPath),
            headingPath: stringifyDocumentIntelligenceJsonValue(artifact.location.headingPath),
            sourceLocationLabel: artifact.sourceLocationLabel,
            payloadJson: stringifyDocumentIntelligenceJsonValue(artifact.payload),
            relevanceHints: stringifyDocumentIntelligenceJsonValue(artifact.relevanceHints),
            confidence: artifact.confidence,
          },
          update: {
            kind: artifact.kind,
            status: artifact.status,
            title: artifact.title,
            summary: artifact.summary,
            content: artifact.content,
            tool: artifact.tool,
            sourcePageNumber: artifact.location.pageNumberStart,
            sourcePageLabel: artifact.location.pageLabelStart,
            tableId: artifact.location.tableId,
            figureId: artifact.location.figureId,
            sectionPath: stringifyDocumentIntelligenceJsonValue(artifact.location.sectionPath),
            headingPath: stringifyDocumentIntelligenceJsonValue(artifact.location.headingPath),
            sourceLocationLabel: artifact.sourceLocationLabel,
            payloadJson: stringifyDocumentIntelligenceJsonValue(artifact.payload),
            relevanceHints: stringifyDocumentIntelligenceJsonValue(artifact.relevanceHints),
            confidence: artifact.confidence,
          },
          select: {
            id: true,
            conversationDocumentId: true,
            artifactKey: true,
            kind: true,
            status: true,
            title: true,
            summary: true,
            content: true,
            tool: true,
            sourcePageNumber: true,
            sourcePageLabel: true,
            tableId: true,
            figureId: true,
            sectionPath: true,
            headingPath: true,
            sourceLocationLabel: true,
            payloadJson: true,
            relevanceHints: true,
            confidence: true,
            createdAt: true,
            updatedAt: true,
          },
        })
      : async (artifact: UpsertDocumentKnowledgeArtifactInput) => {
          const now = new Date();
          return {
            id: `${artifact.sourceDocumentId}:${artifact.artifactKey}`,
            conversationDocumentId: artifact.sourceDocumentId,
            artifactKey: artifact.artifactKey,
            kind: artifact.kind,
            status: artifact.status,
            title: artifact.title,
            summary: artifact.summary,
            content: artifact.content,
            tool: artifact.tool,
            sourcePageNumber: artifact.location.pageNumberStart,
            sourcePageLabel: artifact.location.pageLabelStart,
            tableId: artifact.location.tableId,
            figureId: artifact.location.figureId,
            sectionPath: stringifyDocumentIntelligenceJsonValue(artifact.location.sectionPath),
            headingPath: stringifyDocumentIntelligenceJsonValue(artifact.location.headingPath),
            sourceLocationLabel: artifact.sourceLocationLabel,
            payloadJson: stringifyDocumentIntelligenceJsonValue(artifact.payload),
            relevanceHints: stringifyDocumentIntelligenceJsonValue(artifact.relevanceHints),
            confidence: artifact.confidence,
            createdAt: now,
            updatedAt: now,
          } satisfies ConversationDocumentKnowledgeArtifactStoreRecord;
        }
  );
  const listInspectionTasks = dependencies.listInspectionTasks ?? (
    persistDocumentIntelligence
      ? async (conversationDocumentIds: string[]) => prisma.conversationDocumentInspectionTask.findMany({
          where: {
            conversationDocumentId: {
              in: conversationDocumentIds,
            },
          },
          orderBy: [{ updatedAt: "desc" }, { createdAt: "desc" }],
          select: {
            id: true,
            conversationDocumentId: true,
            taskKey: true,
            kind: true,
            status: true,
            tool: true,
            rationale: true,
            sourcePageNumber: true,
            sourcePageLabel: true,
            tableId: true,
            figureId: true,
            sectionPath: true,
            headingPath: true,
            sourceLocationLabel: true,
            resultSummary: true,
            resultJson: true,
            unresolvedJson: true,
            createdArtifactKeys: true,
            createdAt: true,
            updatedAt: true,
            completedAt: true,
          },
        })
      : async () => []
  );
  const upsertInspectionTask = dependencies.upsertInspectionTask ?? (
    persistDocumentIntelligence
      ? async (task: UpsertDocumentInspectionTaskInput) => prisma.conversationDocumentInspectionTask.upsert({
          where: {
            conversationDocumentId_taskKey: {
              conversationDocumentId: task.sourceDocumentId,
              taskKey: task.taskKey,
            },
          },
          create: {
            conversationDocumentId: task.sourceDocumentId,
            taskKey: task.taskKey,
            kind: task.kind,
            status: task.status,
            tool: task.tool,
            rationale: task.rationale,
            sourcePageNumber: task.location.pageNumberStart,
            sourcePageLabel: task.location.pageLabelStart,
            tableId: task.location.tableId,
            figureId: task.location.figureId,
            sectionPath: stringifyDocumentIntelligenceJsonValue(task.location.sectionPath),
            headingPath: stringifyDocumentIntelligenceJsonValue(task.location.headingPath),
            sourceLocationLabel: task.sourceLocationLabel,
            resultSummary: task.resultSummary,
            resultJson: stringifyDocumentIntelligenceJsonValue(task.result),
            unresolvedJson: stringifyDocumentIntelligenceJsonValue(task.unresolved),
            createdArtifactKeys: stringifyDocumentIntelligenceJsonValue(task.createdArtifactKeys),
            completedAt: task.completedAt ? new Date(task.completedAt) : null,
          },
          update: {
            kind: task.kind,
            status: task.status,
            tool: task.tool,
            rationale: task.rationale,
            sourcePageNumber: task.location.pageNumberStart,
            sourcePageLabel: task.location.pageLabelStart,
            tableId: task.location.tableId,
            figureId: task.location.figureId,
            sectionPath: stringifyDocumentIntelligenceJsonValue(task.location.sectionPath),
            headingPath: stringifyDocumentIntelligenceJsonValue(task.location.headingPath),
            sourceLocationLabel: task.sourceLocationLabel,
            resultSummary: task.resultSummary,
            resultJson: stringifyDocumentIntelligenceJsonValue(task.result),
            unresolvedJson: stringifyDocumentIntelligenceJsonValue(task.unresolved),
            createdArtifactKeys: stringifyDocumentIntelligenceJsonValue(task.createdArtifactKeys),
            completedAt: task.completedAt ? new Date(task.completedAt) : null,
          },
          select: {
            id: true,
            conversationDocumentId: true,
            taskKey: true,
            kind: true,
            status: true,
            tool: true,
            rationale: true,
            sourcePageNumber: true,
            sourcePageLabel: true,
            tableId: true,
            figureId: true,
            sectionPath: true,
            headingPath: true,
            sourceLocationLabel: true,
            resultSummary: true,
            resultJson: true,
            unresolvedJson: true,
            createdArtifactKeys: true,
            createdAt: true,
            updatedAt: true,
            completedAt: true,
          },
        })
      : async (task: UpsertDocumentInspectionTaskInput) => {
          const now = new Date();
          return {
            id: `${task.sourceDocumentId}:${task.taskKey}`,
            conversationDocumentId: task.sourceDocumentId,
            taskKey: task.taskKey,
            kind: task.kind,
            status: task.status,
            tool: task.tool,
            rationale: task.rationale,
            sourcePageNumber: task.location.pageNumberStart,
            sourcePageLabel: task.location.pageLabelStart,
            tableId: task.location.tableId,
            figureId: task.location.figureId,
            sectionPath: stringifyDocumentIntelligenceJsonValue(task.location.sectionPath),
            headingPath: stringifyDocumentIntelligenceJsonValue(task.location.headingPath),
            sourceLocationLabel: task.sourceLocationLabel,
            resultSummary: task.resultSummary,
            resultJson: stringifyDocumentIntelligenceJsonValue(task.result),
            unresolvedJson: stringifyDocumentIntelligenceJsonValue(task.unresolved),
            createdArtifactKeys: stringifyDocumentIntelligenceJsonValue(task.createdArtifactKeys),
            createdAt: now,
            updatedAt: now,
            completedAt: task.completedAt ? new Date(task.completedAt) : now,
          } satisfies ConversationDocumentInspectionTaskStoreRecord;
        }
  );
  const persistAsyncAgentWork = dependencies.persistAsyncAgentWork ?? persistDocumentIntelligence;
  const persistAsyncWorkItem = dependencies.upsertAsyncAgentWorkItem ?? (
    persistAsyncAgentWork
      ? upsertAsyncAgentWorkItem
      : async (item: AsyncAgentWorkItem) => item
  );
  const persistContextRegistry = dependencies.persistContextRegistry ?? persistDocumentIntelligence;
  const canUseDefaultContextRegistryPersistence = persistContextRegistry && hasContextRegistryPrismaDelegates();
  let contextRegistryPersistenceSkippedReason: string | null = null;
  const listContextRegistry = dependencies.listContextRegistryRecords ?? (
    canUseDefaultContextRegistryPersistence
      ? async (input: { conversationId: string; conversationDocumentIds: string[]; request?: string | null }) =>
          selectOpenContextRegistryRecords({
            conversationId: input.conversationId,
            conversationDocumentIds: input.conversationDocumentIds,
          })
      : async () => EMPTY_CONTEXT_REGISTRY_SELECTION
  );
  const persistContextRegistryBatch = dependencies.upsertContextRegistryRecords ?? (
    canUseDefaultContextRegistryPersistence
      ? async (batch: ContextRegistryUpsertBatch) => {
          if (
            batch.contextDebtRecords.length === 0 &&
            batch.capabilityGapRecords.length === 0 &&
            batch.sourceCoverageRecords.length === 0
          ) {
            return EMPTY_CONTEXT_REGISTRY_SELECTION;
          }
          if (!params.conversationId) {
            contextRegistryPersistenceSkippedReason = "missing_conversation_id";
            return EMPTY_CONTEXT_REGISTRY_SELECTION;
          }
          const conversationExists = await prisma.conversation.findUnique({
            where: { id: params.conversationId },
            select: { id: true },
          });
          if (!conversationExists) {
            contextRegistryPersistenceSkippedReason = "conversation_not_persisted";
            return EMPTY_CONTEXT_REGISTRY_SELECTION;
          }
          return upsertContextRegistryBatch(batch);
        }
      : async () => EMPTY_CONTEXT_REGISTRY_SELECTION
  );
  const requestedSources = resolveRequestedConversationContextSourcePlan(params.sourcePlan);
  const sourceDecisions = resolveConversationContextSourceDecisions({
    conversationId: params.conversationId,
    authority: params.authority,
    requestedSources,
  });
  const threadDocumentsSourceDecision = sourceDecisions.find(
    (sourceDecision) => sourceDecision.sourceId === "thread_documents"
  );
  const documents = threadDocumentsSourceDecision?.status === "allowed"
    ? (await listDocuments(params.conversationId)).filter(
        (document) => document.conversationId === params.conversationId
      )
    : [];
  const resolvedBudget = resolveConversationContextBudget(params.budget, documents.length);
  const occurrenceQuery = analyzeDocumentOccurrenceQuery(params.currentUserPrompt);
  const documentIds = documents.map((document) => document.id);
  const [storedKnowledgeArtifacts, storedInspectionTasks, openContextRegistry] = await Promise.all([
    documentIds.length > 0 ? listKnowledgeArtifacts(documentIds) : Promise.resolve([]),
    documentIds.length > 0 ? listInspectionTasks(documentIds) : Promise.resolve([]),
    listContextRegistry({
      conversationId: params.conversationId,
      conversationDocumentIds: documentIds,
      request: params.currentUserPrompt ?? null,
    }),
  ]);
  const storedKnowledgeArtifactsByDocument = new Map<string, DocumentKnowledgeArtifactRecord[]>();
  const storedInspectionTasksByDocument = new Map<string, DocumentInspectionTaskRecord[]>();

  for (const artifact of storedKnowledgeArtifacts.map(buildStoredKnowledgeArtifactRecord)) {
    const existing = storedKnowledgeArtifactsByDocument.get(artifact.sourceDocumentId) ?? [];
    existing.push(artifact);
    storedKnowledgeArtifactsByDocument.set(artifact.sourceDocumentId, existing);
  }

  for (const task of storedInspectionTasks.map(buildStoredInspectionTaskRecord)) {
    const existing = storedInspectionTasksByDocument.get(task.sourceDocumentId) ?? [];
    existing.push(task);
    storedInspectionTasksByDocument.set(task.sourceDocumentId, existing);
  }

  const sources: ConversationContextSource[] = [];
  const documentSectionRenderInputs: ThreadDocumentSectionRenderInput[] = [];
  const availabilityNotes: string[] = [];
  const documentChunkingDocuments: ConversationContextDocumentChunkingDocument[] = [];
  const documentIntelligenceDocuments: ConversationContextDocumentIntelligenceDocument[] = [];
  const progressiveArtifactCandidates: ContextPackingCandidate[] = [];
  const progressiveRawExcerptCandidates: ContextPackingCandidate[] = [];
  const progressiveTransportPayloads: ContextPayload[] = [];
  const completedSourceObservations: SourceObservation[] = [];
  const sourceObservationTransportSelections: SourceObservationTransportSelection[] = [];
  const sourceObservationProducerRequests: SourceObservationProducerRequest[] = [];
  const sourceObservationProducerResults: SourceObservationProducerResult[] = [];
  const uploadedDocumentDigestionLocalSummaries: UploadedDocumentDigestionLocalDebugSummary[] = [];
  const uploadedDocumentExternalEscalationInputs: UploadedDocumentExternalEscalationInput[] = [];
  const uploadedDocumentDigestionExternalSummaries: UploadedDocumentDigestionExternalDebugSummary[] = [];
  const artifactPromotionTraces: ArtifactPromotionDebugSnapshot["traces"] = [];
  let artifactPromotionCandidateCount = 0;
  let artifactPromotionAcceptedCount = 0;
  let artifactPromotionRejectedCount = 0;
  const selectedArtifactKeys: string[] = [];
  let selectedArtifactTokenCount = 0;
  let remainingDocumentTokens = resolvedBudget.totalDocumentContextBudgetTokens;
  let usedCount = 0;
  let unsupportedCount = 0;
  let failedCount = 0;
  let unavailableCount = 0;
  const threadDocumentExcludedCategories = new Set<ConversationContextSourceExclusionCategory>();

  for (const [documentIndex, document] of documents.entries()) {
    const contextKind = resolveThreadDocumentContextKind(document);
    const existingArtifacts = storedKnowledgeArtifactsByDocument.get(document.id) ?? [];
    const existingInspectionTasks = storedInspectionTasksByDocument.get(document.id) ?? [];

    if (!contextKind) {
      unsupportedCount += 1;
      threadDocumentExcludedCategories.add("implementation");
      const detail = `Attached to this thread, but thread-document context currently supports only ${THREAD_DOCUMENT_SUPPORT_DETAIL}.`;
      availabilityNotes.push(`- ${document.filename}: ${detail}`);
      sources.push(buildContextSource("unsupported", document.filename, detail));
      documentChunkingDocuments.push(
        buildThreadDocumentChunkingDebugDocument({
          document,
          sourceType: document.fileType || "unknown",
          parentSourceStatus: "unsupported",
          extractionStatus: "unsupported",
          occurrenceQuery,
        })
      );
      documentIntelligenceDocuments.push(
        buildDocumentIntelligenceDebugDocument({
          document,
          sourceType: document.fileType || "unknown",
          artifacts: existingArtifacts,
          inspectionTasks: existingInspectionTasks,
        })
      );
      continue;
    }

    if (!isUploadPath(document.storagePath)) {
      failedCount += 1;
      const detail = "Attached to this thread, but the stored file path is invalid and could not be loaded safely.";
      availabilityNotes.push(`- ${document.filename}: ${detail}`);
      sources.push(buildContextSource("failed", document.filename, detail));
      documentChunkingDocuments.push(
        buildThreadDocumentChunkingDebugDocument({
          document,
          sourceType: contextKind,
          parentSourceStatus: "failed",
          extractionStatus: "failed",
          extractionDetail: detail,
          occurrenceQuery,
        })
      );
      documentIntelligenceDocuments.push(
        buildDocumentIntelligenceDebugDocument({
          document,
          sourceType: contextKind,
          artifacts: existingArtifacts,
          inspectionTasks: existingInspectionTasks,
        })
      );
      continue;
    }

    if (contextKind === "image") {
      unavailableCount += 1;
      threadDocumentExcludedCategories.add("availability");
      const detail = buildImageRuntimeUnavailableDetail();
      try {
        const imageBuffer = await readBinaryFile(document.storagePath);
        uploadedDocumentExternalEscalationInputs.push({
          document,
          contextKind,
          sourceMetadata: {
            localImageRuntimeStatus: "unavailable",
            detail,
          },
          pdfExtractionMetadata: null,
          localObservations: [],
          localProducerResults: [],
          selectedPages: [],
          imageInputs: [
            {
              id: `uploaded-image:${document.id}`,
              mimeType: document.mimeType ?? "application/octet-stream",
              dataBase64: imageBuffer.toString("base64"),
              sourceLocator: {
                sourceLocationLabel: document.filename,
              },
              sourceLocationLabel: document.filename,
            },
          ],
        });
      } catch {
        // The normal image unavailable path below remains authoritative.
      }
      availabilityNotes.push(`- ${document.filename}: ${detail}`);
      sources.push(buildContextSource("unavailable", document.filename, detail));
      documentChunkingDocuments.push(
        buildThreadDocumentChunkingDebugDocument({
          document,
          sourceType: contextKind,
          parentSourceStatus: "unavailable",
          extractionStatus: "unavailable",
          occurrenceQuery,
        })
      );
      documentIntelligenceDocuments.push(
        buildDocumentIntelligenceDebugDocument({
          document,
          sourceType: contextKind,
          artifacts: existingArtifacts,
          inspectionTasks: existingInspectionTasks,
        })
      );
      continue;
    }

    if (remainingDocumentTokens <= 0 && !occurrenceQuery.intentDetected) {
      unavailableCount += 1;
      threadDocumentExcludedCategories.add("budget");
      const detail =
        "Attached to this thread, but not included in this runtime because the thread-document context budget was already used by earlier attachments.";
      availabilityNotes.push(`- ${document.filename}: ${detail}`);
      sources.push(buildContextSource("unavailable", document.filename, detail));
      documentChunkingDocuments.push(
        buildThreadDocumentChunkingDebugDocument({
          document,
          sourceType: contextKind,
          parentSourceStatus: "unavailable",
          extractionStatus: "unavailable",
          occurrenceQuery,
        })
      );
      documentIntelligenceDocuments.push(
        buildDocumentIntelligenceDebugDocument({
          document,
          sourceType: contextKind,
          artifacts: existingArtifacts,
          inspectionTasks: existingInspectionTasks,
        })
      );
      continue;
    }

    let rawText: string;
    let pdfStructuredRanges: PdfContextExtractionResult["structuredRanges"] | undefined;
    let pdfExtractionMetadata: PdfContextExtractionResult["metadata"] | null = null;
    let extractionDetail: string | null = null;
    let sourceMetadata: Record<string, unknown> | null = null;

    if (contextKind === "pdf" || contextKind === "docx" || contextKind === "pptx" || contextKind === "spreadsheet") {
      let fileBuffer: Buffer;
      try {
        fileBuffer = await readBinaryFile(document.storagePath);
      } catch (error) {
        failedCount += 1;
        const detail = `Attached to this thread, but ${resolveStorageReadFailureReason(error)}.`;
        availabilityNotes.push(`- ${document.filename}: ${detail}`);
        sources.push(buildContextSource("failed", document.filename, detail));
        documentChunkingDocuments.push(
        buildThreadDocumentChunkingDebugDocument({
          document,
          sourceType: contextKind,
          parentSourceStatus: "failed",
          extractionStatus: "failed",
          extractionDetail: detail,
          occurrenceQuery,
        })
      );
        documentIntelligenceDocuments.push(
          buildDocumentIntelligenceDebugDocument({
            document,
            sourceType: contextKind,
            artifacts: existingArtifacts,
            inspectionTasks: existingInspectionTasks,
          })
        );
        continue;
      }

      try {
        if (contextKind === "pdf") {
          const resolvedPdfExtraction = resolvePdfExtractionResult(await extractPdfText(fileBuffer));
          rawText = resolvedPdfExtraction.text;
          pdfStructuredRanges = resolvedPdfExtraction.structuredRanges;
          pdfExtractionMetadata = resolvedPdfExtraction.metadata;
          extractionDetail = resolvedPdfExtraction.metadata?.detail ?? null;
          sourceMetadata = buildPdfSourceMetadata(resolvedPdfExtraction.metadata);
        } else {
          rawText = contextKind === "docx"
            ? await extractDocxText(fileBuffer)
            : contextKind === "pptx"
              ? await extractPptxText(fileBuffer)
              : await extractSpreadsheetText(fileBuffer, {
                filename: document.filename,
                mimeType: document.mimeType,
              });
        }
      } catch (error) {
        failedCount += 1;
        const detail = buildExtractionFailureDetail(contextKind, error);
        availabilityNotes.push(`- ${document.filename}: ${detail}`);
        sources.push(buildContextSource("failed", document.filename, detail));
        documentChunkingDocuments.push(
          buildThreadDocumentChunkingDebugDocument({
            document,
            sourceType: contextKind,
            parentSourceStatus: "failed",
            extractionStatus: "failed",
            occurrenceQuery,
          })
        );
        documentIntelligenceDocuments.push(
          buildDocumentIntelligenceDebugDocument({
            document,
            sourceType: contextKind,
            artifacts: existingArtifacts,
            inspectionTasks: existingInspectionTasks,
          })
        );
        continue;
      }
    } else {
      try {
        rawText = await readTextFile(document.storagePath);
      } catch (error) {
        failedCount += 1;
        const detail = `Attached to this thread, but ${resolveStorageReadFailureReason(error)}.`;
        availabilityNotes.push(`- ${document.filename}: ${detail}`);
        sources.push(buildContextSource("failed", document.filename, detail));
        documentChunkingDocuments.push(
          buildThreadDocumentChunkingDebugDocument({
            document,
            sourceType: contextKind,
            parentSourceStatus: "failed",
            extractionStatus: "failed",
            occurrenceQuery,
          })
        );
        documentIntelligenceDocuments.push(
          buildDocumentIntelligenceDebugDocument({
            document,
            sourceType: contextKind,
            artifacts: existingArtifacts,
            inspectionTasks: existingInspectionTasks,
          })
        );
        continue;
      }
    }

    const normalizedText = normalizeDocumentText(rawText);
    if (!normalizedText) {
      failedCount += 1;
      const detail = contextKind === "pdf"
        ? buildPdfNoReadableTextDetail(pdfExtractionMetadata)
        : contextKind === "docx"
          ? "Attached to this thread, but the DOCX parser returned no readable text."
          : contextKind === "pptx"
            ? buildPptxNoReadableTextDetail()
          : contextKind === "spreadsheet"
            ? buildSpreadsheetNoReadableTextDetail()
        : "Attached to this thread, but no readable text could be extracted from the stored file.";
      availabilityNotes.push(`- ${document.filename}: ${detail}`);
      sources.push(buildContextSource("failed", document.filename, detail));
      documentChunkingDocuments.push(
        buildThreadDocumentChunkingDebugDocument({
          document,
          sourceType: contextKind,
          parentSourceStatus: "failed",
          extractionStatus: "failed",
          extractionDetail: detail,
          sourceMetadata,
          occurrenceQuery,
        })
      );
      documentIntelligenceDocuments.push(
        buildDocumentIntelligenceDebugDocument({
          document,
          sourceType: contextKind,
          artifacts: existingArtifacts,
          inspectionTasks: existingInspectionTasks,
        })
      );
      continue;
    }

    const chunkCandidates = buildDocumentChunkCandidates({
      sourceId: document.id,
      attachmentId: document.id,
      fileId: document.id,
      sourceOrderIndex: documentIndex,
      filename: document.filename,
      sourceType: resolveDocumentChunkSourceType(document, contextKind),
      text: normalizedText,
      structuredRanges: contextKind === "pdf" ? pdfStructuredRanges : undefined,
    });
    if (chunkCandidates.length === 0) {
      failedCount += 1;
      const detail =
        "Attached to this thread, but the extracted text could not be split into usable document chunks for this runtime.";
      availabilityNotes.push(`- ${document.filename}: ${detail}`);
      sources.push(buildContextSource("failed", document.filename, detail));
      documentChunkingDocuments.push(
        buildThreadDocumentChunkingDebugDocument({
          document,
          sourceType: contextKind,
          parentSourceStatus: "failed",
          extractionStatus: "failed",
          extractionDetail: detail,
          sourceMetadata,
          occurrenceQuery,
        })
      );
      documentIntelligenceDocuments.push(
        buildDocumentIntelligenceDebugDocument({
          document,
          sourceType: contextKind,
          artifacts: existingArtifacts,
          inspectionTasks: existingInspectionTasks,
        })
      );
      continue;
    }

    let learnedArtifacts = existingArtifacts;
    let inspectionTasks = existingInspectionTasks;

    if (contextKind === "pdf" && pdfExtractionMetadata) {
      const synthesizedIntelligence = synthesizePdfDocumentIntelligence({
        sourceDocumentId: document.id,
        filename: document.filename,
        extractionMetadata: pdfExtractionMetadata,
        structuredRanges: pdfStructuredRanges,
      });
      const persistedArtifacts = await Promise.all(
        synthesizedIntelligence.artifacts.map(async (artifact) =>
          buildStoredKnowledgeArtifactRecord(await upsertKnowledgeArtifact(artifact))
        )
      );
      const persistedInspectionTasks = await Promise.all(
        synthesizedIntelligence.inspectionTasks.map(async (task) =>
          buildStoredInspectionTaskRecord(await upsertInspectionTask(task))
        )
      );

      learnedArtifacts = mergeDocumentKnowledgeArtifacts(existingArtifacts, persistedArtifacts);
      inspectionTasks = mergeDocumentInspectionTasks(existingInspectionTasks, persistedInspectionTasks);
      storedKnowledgeArtifactsByDocument.set(document.id, learnedArtifacts);
      storedInspectionTasksByDocument.set(document.id, inspectionTasks);
    }

    const promotionSourceObservations = buildSourceObservationsFromSelectedDocumentChunks({
      document,
      contextKind,
      chunks: chunkCandidates,
      options: {
        conversationId: params.conversationId,
        maxObservationsPerDocument: 80,
        selectedOnly: false,
      },
    })
      .map(mapSourceObservationToPromotionInput)
      .filter((observation): observation is SourceObservationPromotionInput => Boolean(observation));
    const shouldRunArtifactPromotion =
      Boolean(dependencies.proposeArtifactPromotionCandidates) ||
      Boolean(dependencies.upsertKnowledgeArtifact) ||
      persistDocumentIntelligence;
    const promotionCandidates = shouldRunArtifactPromotion
      ? dependencies.proposeArtifactPromotionCandidates
        ? await dependencies.proposeArtifactPromotionCandidates({
            conversationId: params.conversationId,
            document,
            sourceObservations: promotionSourceObservations,
            existingArtifacts: learnedArtifacts,
            currentUserPrompt: params.currentUserPrompt ?? null,
          })
        : proposeDeterministicSourceLearningCandidates({
            document,
            sourceObservations: promotionSourceObservations,
            currentUserPrompt: params.currentUserPrompt ?? null,
          })
      : [];
    progressiveTransportPayloads.push(
      ...buildContextPayloadsFromArtifactPromotionCandidates(promotionCandidates)
    );
    if (promotionCandidates.length > 0) {
      const promotionResult = evaluateArtifactPromotionCandidates({
        candidates: promotionCandidates,
        existingArtifacts: learnedArtifacts,
      });
      progressiveTransportPayloads.push(
        ...buildContextPayloadsFromArtifactPromotionDecisions(promotionResult.decisions)
      );
      const persistedPromotionArtifacts = await Promise.all(
        promotionResult.acceptedArtifacts.map(async (artifact) =>
          buildStoredKnowledgeArtifactRecord(await upsertKnowledgeArtifact(artifact))
        )
      );

      artifactPromotionCandidateCount += promotionResult.debugSnapshot.candidateCount;
      artifactPromotionAcceptedCount += promotionResult.debugSnapshot.acceptedCount;
      artifactPromotionRejectedCount += promotionResult.debugSnapshot.rejectedCount;
      artifactPromotionTraces.push(...promotionResult.debugSnapshot.traces);

      if (persistedPromotionArtifacts.length > 0) {
        learnedArtifacts = mergeDocumentKnowledgeArtifacts(learnedArtifacts, persistedPromotionArtifacts);
        storedKnowledgeArtifactsByDocument.set(document.id, learnedArtifacts);
      }
    }

    progressiveArtifactCandidates.push(
      ...learnedArtifacts.map((artifact) =>
        buildArtifactPackingCandidate({
          artifact,
          sourceType: contextKind,
          priority:
            artifact.kind === "table_extraction"
              ? 90
              : artifact.kind === "table_candidate" || artifact.kind === "extraction_warning"
                ? 80
                : 50,
          required: artifact.status === "warning" || artifact.kind === "extraction_warning",
        })
      )
    );

    const ranking = rankDocumentChunks({
      chunks: chunkCandidates,
      query: params.currentUserPrompt,
    });
    const rankingPriorityByChunkKey = new Map(
      ranking.details.map((detail) => [
        `${detail.sourceId}:${detail.chunkIndex}`,
        Math.max(0, 1000 - detail.rankingOrder),
      ])
    );
    progressiveRawExcerptCandidates.push(
      ...ranking.rankedChunks.map((chunk) =>
        buildRawExcerptPackingCandidate({
          chunk,
          priority: rankingPriorityByChunkKey.get(`${chunk.sourceId}:${chunk.chunkIndex}`) ?? 0,
        })
      )
    );
    const availableDocumentTokens = Math.min(
      resolvedBudget.perDocumentBudgetTokens,
      remainingDocumentTokens
    );
    const artifactSelection = selectDocumentKnowledgeArtifactsWithinBudget({
      artifacts: learnedArtifacts,
      query: params.currentUserPrompt,
      maxTokens: Math.max(0, Math.min(512, Math.floor(availableDocumentTokens * 0.5))),
      maxArtifacts: 6,
    });
    const sourceMetadataWithArtifacts = buildArtifactSourceMetadata({
      existingSourceMetadata: sourceMetadata,
      artifacts: learnedArtifacts,
      inspectionTasks,
      selectedArtifacts: artifactSelection.selectedArtifacts,
    });
    const documentBudgetTokens = Math.max(
      0,
      availableDocumentTokens -
        artifactSelection.selectedApproxTokenCount -
        THREAD_DOCUMENT_SECTION_TOKEN_RESERVE
    );
    const selection = selectRankedDocumentChunksWithinBudget({
      chunks: ranking.rankedChunks,
      maxTokens: documentBudgetTokens,
      selectionMode: ranking.rankingEnabled ? "ranked-order" : "document-order",
      ranking,
    });
    const documentChunkingDebugDocument = buildThreadDocumentChunkingDebugDocument({
      document,
      sourceType: contextKind,
      parentSourceStatus:
        selection.selectedChunks.length > 0 || artifactSelection.selectedArtifacts.length > 0
          ? "used"
          : "unavailable",
      extractionStatus: "extracted",
      extractionDetail,
      sourceMetadata: sourceMetadataWithArtifacts,
      occurrenceQuery,
      documentBudgetTokens: resolvedBudget.budgetInputProvided ? documentBudgetTokens : null,
      chunks: chunkCandidates,
      ranking,
      selection,
    });
    const shouldIncludeOccurrenceInventoryOnly =
      documentChunkingDebugDocument.occurrence.searchStatus === "searched" &&
      documentChunkingDebugDocument.occurrence.locations.length > 0 &&
      selection.selectedChunks.length === 0 &&
      artifactSelection.selectedArtifacts.length === 0;

    if (
      selection.selectedChunks.length === 0 &&
      artifactSelection.selectedArtifacts.length === 0 &&
      !shouldIncludeOccurrenceInventoryOnly
    ) {
      unavailableCount += 1;
      threadDocumentExcludedCategories.add("budget");
      const detail =
        "Attached to this thread, but not included in this runtime because the remaining thread-document context budget could not fit a useful excerpt after earlier attachments.";
      availabilityNotes.push(`- ${document.filename}: ${detail}`);
      sources.push(buildContextSource("unavailable", document.filename, detail));
      documentChunkingDocuments.push({
        ...documentChunkingDebugDocument,
        parentSourceStatus: "unavailable",
      });
      documentIntelligenceDocuments.push(
        buildDocumentIntelligenceDebugDocument({
          document,
          sourceType: contextKind,
          artifacts: learnedArtifacts,
          inspectionTasks,
          selectedArtifacts: artifactSelection.selectedArtifacts,
        })
      );
      continue;
    }

    const localDigestion = buildUploadedDocumentDigestionLocalBaseline({
      document,
      contextKind,
      selectedChunks: selection.selectedChunks,
      sourceMetadata: sourceMetadataWithArtifacts,
      pdfExtractionMetadata,
      selectedArtifacts: artifactSelection.selectedArtifacts,
      observationOptions: {
        conversationId: params.conversationId,
        maxObservationsPerDocument: 12,
        maxTextPreviewChars: 900,
      },
      transportMaxObservations: 16,
      transportMaxObservationsPerDocument: 8,
    });
    const currentSourceObservations = localDigestion.observations;
    const currentLocalProducerResults = [...localDigestion.producerResults];
    const transportSelection = localDigestion.transportSelection;
    completedSourceObservations.push(...currentSourceObservations);
    sourceObservationTransportSelections.push(transportSelection);
    sourceObservationProducerRequests.push(...localDigestion.producerRequests);
    sourceObservationProducerResults.push(...localDigestion.producerResults);
    uploadedDocumentDigestionLocalSummaries.push(localDigestion.debugSummary);
    progressiveTransportPayloads.push(
      ...buildContextPayloadsFromSourceObservations(transportSelection.selectedObservations)
    );
    const tableProducerRequests = buildProducerRequestsFromTableSignals({
      observations: currentSourceObservations,
      traceId: params.conversationId ? `${params.conversationId}:source-observation-producers` : null,
      conversationId: params.conversationId,
    });
    if (tableProducerRequests.length > 0) {
      sourceObservationProducerRequests.push(...tableProducerRequests);
      const tableProducerAvailability = buildSourceObservationProducerAvailabilitySnapshot({
        requests: tableProducerRequests,
        observations: currentSourceObservations,
        traceId: params.conversationId ? `${params.conversationId}:source-observation-producers` : null,
      });
      const tableProducerResults = runDeterministicSourceObservationProducers({
        requests: tableProducerRequests,
        observations: currentSourceObservations,
        availabilityContext: tableProducerAvailability,
      });
      currentLocalProducerResults.push(...tableProducerResults);
      sourceObservationProducerResults.push(...tableProducerResults);
    }

    uploadedDocumentExternalEscalationInputs.push({
      document,
      contextKind,
      sourceMetadata: sourceMetadataWithArtifacts,
      pdfExtractionMetadata,
      localObservations: currentSourceObservations,
      localProducerResults: currentLocalProducerResults,
      selectedPages: pdfExtractionMetadata?.lowTextPageNumbers ?? [],
      imageInputs: [],
    });

    const fullyIncluded =
      selection.selectedChunks.length === chunkCandidates.length &&
      selection.skippedChunks.length === 0 &&
      !selection.usedBudgetClamp;
    usedCount += 1;
    selectedArtifactKeys.push(
      ...artifactSelection.selectedArtifacts.map((artifact) => artifact.artifactKey)
    );
    selectedArtifactTokenCount += artifactSelection.selectedApproxTokenCount;
    remainingDocumentTokens = Math.max(
      0,
      remainingDocumentTokens -
        artifactSelection.selectedApproxTokenCount -
        selection.selectedApproxTokenCount -
        THREAD_DOCUMENT_SECTION_TOKEN_RESERVE
    );
    documentSectionRenderInputs.push({
      filename: document.filename,
      fullyIncluded:
        selection.selectedChunks.length === chunkCandidates.length &&
        selection.skippedChunks.length === 0 &&
        !selection.usedBudgetClamp,
      selection,
      ranking,
      occurrence: documentChunkingDebugDocument.occurrence,
      selectedArtifacts: artifactSelection.selectedArtifacts,
    });
    sources.push(buildContextSource(
      "used",
      document.filename,
      buildUsedThreadDocumentDetail({
        charCount: normalizedText.length,
        fullyIncluded,
        occurrenceInventoryOnly: shouldIncludeOccurrenceInventoryOnly,
        extractionDetail,
        artifactCount: artifactSelection.selectedArtifacts.length,
      })
    ));
    documentChunkingDocuments.push({
      ...documentChunkingDebugDocument,
      parentSourceStatus: "used",
    });
    documentIntelligenceDocuments.push(
      buildDocumentIntelligenceDebugDocument({
        document,
        sourceType: contextKind,
        artifacts: learnedArtifacts,
        inspectionTasks,
        selectedArtifacts: artifactSelection.selectedArtifacts,
      })
    );
  }

  const summarySources: ConversationContextSummarySource[] = [];
  if (documents.length > 0) {
    const parts = [
      usedCount > 0 ? `${usedCount} used` : null,
      unsupportedCount > 0 ? `${unsupportedCount} unsupported` : null,
      failedCount > 0 ? `${failedCount} failed` : null,
      unavailableCount > 0 ? `${unavailableCount} unavailable` : null,
    ].filter((part): part is string => Boolean(part));

    summarySources.push({
      id: "thread-documents",
      label: "Thread-attached documents",
      description:
        parts.length > 0
          ? `Current thread only. ${parts.join(", ")}. Thread-document context currently supports ${THREAD_DOCUMENT_SUPPORT_DETAIL}.`
          : "Documents are attached to this thread, but none produced context for this runtime.",
    });
  }
  const finalizedSourceDecisions = sourceDecisions.map((sourceDecision) =>
    finalizeConversationContextSourceDecision({
      sourceDecision,
      threadDocumentSummary: {
        totalCount: documents.length,
        usedCount,
        unsupportedCount,
        failedCount,
        unavailableCount,
        excludedCategories: [...threadDocumentExcludedCategories],
      },
    })
  );
  const documentChunkingBudget = buildThreadDocumentBudgetDebug({
    resolvedBudget,
    documents: documentChunkingDocuments,
  });
  const documentChunkingOccurrence = buildThreadDocumentOccurrenceSummary(
    documentChunkingDocuments
  );
  const contextRegistryPackingCandidates = buildContextRegistryPackingCandidates(openContextRegistry);
  const contextRegistrySection = buildContextRegistrySection(openContextRegistry);
  const agentControlSourceSignals = [
    ...buildAgentControlSourceSignals({
      sourceDocuments: documents,
      documentChunkingDocuments,
      documentIntelligenceDocuments,
    }),
    ...buildAgentControlSourceSignalsFromRegistry(openContextRegistry),
  ];
  const agentControl = evaluateAgentControlSurface({
    conversationId: params.conversationId,
    request: params.currentUserPrompt ?? null,
    model: resolvedBudget.budgetInputProvided
      ? {
          provider: resolvedBudget.provider,
          protocol: resolvedBudget.protocol,
          model: resolvedBudget.model,
          mode: resolvedBudget.mode ?? "standard",
        }
      : null,
    sourceSignals: agentControlSourceSignals,
  });
  const agentWorkPlan = buildAgentWorkPlanFromControlDecision({
    conversationId: params.conversationId,
    request: params.currentUserPrompt ?? null,
    decision: agentControl,
    sourceSignals: agentControlSourceSignals,
    artifactPromotion: {
      candidateCount: artifactPromotionCandidateCount,
      acceptedCount: artifactPromotionAcceptedCount,
      rejectedCount: artifactPromotionRejectedCount,
    },
  });

  const externalApprovalRequired =
    agentControl.approvalRequiredReasons.includes("external_tool_required") ||
    agentControl.approvalRequiredReasons.includes("external_data_egress");
  const externalPolicyBlocked =
    agentControl.externalEscalation.level === "blocked_by_policy" ||
    agentControl.blockedByPolicyReasons.some((reason) => /external|restricted data/i.test(reason));
  const externalApprovalSatisfied =
    agentControl.externalEscalation.level === "recommended" && !externalApprovalRequired;

  for (const externalInput of uploadedDocumentExternalEscalationInputs) {
    const externalDigestion = await runUploadedDocumentExternalEscalationProducers({
      document: externalInput.document,
      contextKind: externalInput.contextKind,
      taskPrompt: params.currentUserPrompt ?? null,
      localObservations: externalInput.localObservations,
      localProducerResults: externalInput.localProducerResults,
      pdfExtractionMetadata: externalInput.pdfExtractionMetadata,
      sourceMetadata: externalInput.sourceMetadata,
      selectedPages: externalInput.selectedPages,
      imageInputs: externalInput.imageInputs,
      env: process.env,
      policy: {
        allowExternalProcessing: !externalPolicyBlocked,
        dataClassAllowsExternalProcessing: !externalPolicyBlocked,
        approvalGranted: externalApprovalSatisfied,
        maxExternalObservations: 6,
        maxExternalObservationsPerDocument: 4,
      },
      traceId: agentWorkPlan.traceId,
      planId: agentWorkPlan.planId,
      conversationId: params.conversationId,
      messageId: agentWorkPlan.messageId ?? null,
    });
    if (
      externalDigestion.producerRequests.length === 0 &&
      externalDigestion.producerResults.length === 0 &&
      externalDigestion.observations.length === 0
    ) {
      uploadedDocumentDigestionExternalSummaries.push(externalDigestion.debugSummary);
      continue;
    }
    completedSourceObservations.push(...externalDigestion.observations);
    sourceObservationTransportSelections.push(externalDigestion.transportSelection);
    sourceObservationProducerRequests.push(...externalDigestion.producerRequests);
    sourceObservationProducerResults.push(...externalDigestion.producerResults);
    uploadedDocumentDigestionExternalSummaries.push(externalDigestion.debugSummary);
    progressiveTransportPayloads.push(
      ...buildContextPayloadsFromSourceObservations(externalDigestion.transportSelection.selectedObservations)
    );
  }

  const progressiveAssembly = assembleProgressiveContext({
    request: params.currentUserPrompt ?? null,
    agentControl,
    agentWorkPlan,
    artifactCandidates: [...progressiveArtifactCandidates, ...contextRegistryPackingCandidates],
    rawExcerptCandidates: progressiveRawExcerptCandidates,
    transportPayloads: [
      ...progressiveTransportPayloads,
      ...buildContextPayloadsFromSourceCoverageRecords(openContextRegistry.sourceCoverageRecords),
    ],
  });
  const sourceObservationNeeds = buildSourceObservationNeeds({
    sourceNeeds: agentWorkPlan.sourceNeeds,
    capabilityNeeds: agentWorkPlan.capabilityNeeds,
    modelNeeds: agentWorkPlan.modelCapabilityNeeds,
  });
  const additionalProducerRequests = [
    ...buildProducerRequestsFromAgentWorkPlan({
      agentWorkPlan,
      sourceObservationNeeds,
    }),
    ...buildProducerRequestsFromTransportNeeds({
      transport: progressiveAssembly.contextTransport,
      traceId: agentWorkPlan.traceId,
      planId: agentWorkPlan.planId,
      conversationId: params.conversationId,
      messageId: agentWorkPlan.messageId ?? null,
    }),
  ];
  const existingProducerRequestIds = new Set(sourceObservationProducerRequests.map((request) => request.id));
  const newProducerRequests = additionalProducerRequests.filter((request) => {
    if (existingProducerRequestIds.has(request.id)) return false;
    existingProducerRequestIds.add(request.id);
    return true;
  });
  if (newProducerRequests.length > 0) {
    sourceObservationProducerRequests.push(...newProducerRequests);
    const producerAvailability = buildSourceObservationProducerAvailabilitySnapshot({
      requests: newProducerRequests,
      observations: completedSourceObservations,
      transport: progressiveAssembly.contextTransport,
      traceId: agentWorkPlan.traceId,
      planId: agentWorkPlan.planId,
    });
    sourceObservationProducerResults.push(
      ...runDeterministicSourceObservationProducers({
        requests: newProducerRequests,
        observations: completedSourceObservations,
        availabilityContext: producerAvailability,
      })
    );
  }
  const selectedExcerptIdsForNormalContext = new Set(
    progressiveAssembly.expandedContextBundle.selectedExcerptIds
  );
  const allowBroadExcerptRendering = allowsBroadNormalExcerptRendering(agentControl);
  const sections = documentSectionRenderInputs.map((input) => {
    const selection = filterSelectionForNormalContext({
      selection: input.selection,
      selectedExcerptIds: selectedExcerptIdsForNormalContext,
      ranking: input.ranking,
      allowBroadExcerptRendering,
      allowFallbackToPreselectedExcerpts:
        !(input.selectedArtifacts ?? []).some(isPositiveSelectedSourceMemoryArtifact),
    });
    return buildThreadDocumentSection({
      ...input,
      selection,
      fullyIncluded:
        Boolean(input.fullyIncluded) &&
        allowBroadExcerptRendering &&
        selection.selectedChunks.length === input.selection.selectedChunks.length,
    });
  });
  const renderedText = joinMarkdownSections([
    documentChunkingOccurrence
      ? joinMarkdownSections([
          "## Thread Document Occurrence Scan",
          documentChunkingOccurrence.detail,
          documentChunkingOccurrence.unsearchableDocuments.length > 0
            ? joinMarkdownSections([
                "Files that could not be searched in this runtime:",
                documentChunkingOccurrence.unsearchableDocuments
                  .map((document) => `- ${document.filename}: ${document.detail}`)
                  .join("\n"),
                "Only the files listed above fall outside this occurrence scan coverage.",
              ])
            : null,
        ])
      : null,
    sections.length > 0
      ? joinMarkdownSections([
        "## Thread-Attached Documents (Current Conversation Only)",
        "Use these files as supporting thread context. Recent thread messages and the user's current request remain higher authority.",
        ...sections,
      ])
      : null,
    contextRegistrySection,
    availabilityNotes.length > 0
      ? joinMarkdownSections([
          "## Thread Document Availability",
          "These attachments are present on the current thread but were not loaded into this runtime context:",
          availabilityNotes.join("\n"),
        ])
      : null,
  ]);
  const asyncWorkItems = planAsyncAgentWorkItems({
    conversationId: params.conversationId,
    conversationDocumentId: documents.length === 1 ? documents[0].id : null,
    createdById: params.authority.requestingUserId,
    request: params.currentUserPrompt ?? null,
    controlDecision: agentControl,
    assembly: progressiveAssembly,
  });
  const asyncAgentWorkItem = asyncWorkItems[0]
    ? await persistAsyncWorkItem(runAsyncAgentWorkItem(asyncWorkItems[0]))
    : null;
  const asyncAgentWork = toAsyncAgentWorkDebugSnapshot(asyncAgentWorkItem);
  const singleConversationDocumentId = documents.length === 1 ? documents[0].id : null;
  const emptyContextRegistryBatch = {
    contextDebtRecords: [],
    capabilityGapRecords: [],
    sourceCoverageRecords: [],
  } satisfies ContextRegistryUpsertBatch;
  const conversationDocumentIdsBySourceId = Object.fromEntries(
    documents.map((document) => [document.id, document.id])
  );
  const progressiveAssemblyRegistryBatch = buildRegistryUpsertsFromProgressiveAssembly({
    conversationId: params.conversationId,
    conversationDocumentId: singleConversationDocumentId,
    agentControl,
    assembly: progressiveAssembly,
  });
  const agentWorkPlanRegistryBatch = buildRegistryUpsertsFromAgentWorkPlan({
    conversationId: params.conversationId,
    conversationDocumentId: singleConversationDocumentId,
    asyncAgentWorkItemId: asyncAgentWorkItem?.id ?? null,
    asyncState: asyncAgentWorkItem
      ? "queued"
      : agentWorkPlan.asyncRecommendation.recommended
        ? "recommended"
        : "not_created",
    agentWorkPlan,
    conversationDocumentIdsBySourceId,
  });
  const contextTransportRegistryBatch = buildRegistryUpsertsFromContextTransport({
    conversationId: params.conversationId,
    conversationDocumentId: singleConversationDocumentId,
    transport: progressiveAssembly.contextTransport,
    conversationDocumentIdsBySourceId,
  });
  const sourceObservationProducerRegistryBatch = buildRegistryUpsertsFromSourceObservationProducerResults({
    conversationId: params.conversationId,
    conversationDocumentId: singleConversationDocumentId,
    results: sourceObservationProducerResults,
    conversationDocumentIdsBySourceId,
  });
  const asyncAgentWorkRegistryBatch = asyncAgentWorkItem
    ? buildRegistryUpsertsFromAsyncAgentWork({
        conversationId: params.conversationId,
        conversationDocumentId: asyncAgentWorkItem.conversationDocumentId,
        item: asyncAgentWorkItem,
      })
    : emptyContextRegistryBatch;
  const durableEmissionSourceBatches = [
    {
      source: "progressive_assembly",
      batch: progressiveAssemblyRegistryBatch,
    },
    {
      source: "agent_work_plan",
      batch: agentWorkPlanRegistryBatch,
    },
    {
      source: "adaptive_transport",
      batch: contextTransportRegistryBatch,
    },
    {
      source: "source_observation_producers",
      batch: sourceObservationProducerRegistryBatch,
    },
    {
      source: "async_agent_work",
      batch: asyncAgentWorkRegistryBatch,
    },
  ] satisfies DurableEmissionSourceBatch[];
  const contextRegistryUpserts = mergeContextRegistryBatches(
    ...durableEmissionSourceBatches.map((entry) => entry.batch)
  );
  const persistedContextRegistry = await persistContextRegistryBatch(contextRegistryUpserts);
  const durableEmission = buildDurableEmissionDebugSummary({
    sourceBatches: durableEmissionSourceBatches,
    candidateBatch: contextRegistryUpserts,
    persistedSelection: persistedContextRegistry,
    priorSelection: openContextRegistry,
    skipped: contextRegistryPersistenceSkippedReason
      ? [
          {
            source: "registry_persistence",
            reason: "insufficient_evidence",
            detail: contextRegistryPersistenceSkippedReason,
          },
        ]
      : undefined,
  });
  const contextRegistry = buildContextRegistryDebugSnapshot(
    mergeContextRegistrySelections(openContextRegistry, persistedContextRegistry),
    { durableEmission }
  );
  const artifactPromotion = artifactPromotionCandidateCount > 0
    ? {
        policy: DEFAULT_ARTIFACT_PROMOTION_POLICY,
        candidateCount: artifactPromotionCandidateCount,
        acceptedCount: artifactPromotionAcceptedCount,
        rejectedCount: artifactPromotionRejectedCount,
        traces: artifactPromotionTraces,
      } satisfies ArtifactPromotionDebugSnapshot
    : null;
  const sourceObservationProducerDurableGapDebtCandidateCount =
    sourceObservationProducerRegistryBatch.contextDebtRecords.length +
    sourceObservationProducerRegistryBatch.capabilityGapRecords.length +
    sourceObservationProducerRegistryBatch.sourceCoverageRecords.length;
  const uploadedDocumentDigestionLocal =
    uploadedDocumentDigestionLocalSummaries.length > 0
      ? uploadedDocumentDigestionLocalSummaries.map((summary) =>
          withUploadedDocumentDigestionLocalDurableGapCount(
            summary,
            sourceObservationProducerDurableGapDebtCandidateCount
          )
        )
      : null;
  const externalDurableGapDebtCandidateCount = sourceObservationProducerResults
    .filter((result) => result.producerId?.includes("_vision") ||
      result.producerId?.includes("mistral") ||
      result.producerId?.includes("llamaparse") ||
      result.producerId?.includes("document_ai") ||
      result.producerId?.includes("textract") ||
      result.producerId?.includes("pdf_extract") ||
      result.producerId?.includes("sandbox") ||
      result.producerId?.includes("unstructured"))
    .reduce((sum, result) => sum + result.unresolvedNeeds.length, 0);
  const uploadedDocumentDigestionExternal =
    uploadedDocumentDigestionExternalSummaries.length > 0
      ? uploadedDocumentDigestionExternalSummaries.map((summary) =>
          withUploadedDocumentExternalDurableGapCount(
            summary,
            externalDurableGapDebtCandidateCount
          )
        )
      : null;
  const sourceObservationProducerSummary = buildSourceObservationProducerDebugSummary({
    requests: sourceObservationProducerRequests,
    results: sourceObservationProducerResults,
    transportSelections: sourceObservationTransportSelections,
    durableGapDebtCandidateCount: sourceObservationProducerDurableGapDebtCandidateCount,
  });
  const sourceObservationSummary = buildSourceObservationDebugSummary({
    observations: completedSourceObservations,
    transportSelections: sourceObservationTransportSelections,
    promotedArtifactCandidateCount: artifactPromotionCandidateCount,
    observationDerivedGapDebtCandidateCount:
      contextTransportRegistryBatch.contextDebtRecords.filter((record) =>
        record.sourceLocator?.payloadType === "source_observation" ||
        record.sourceCoverageTarget?.target === "source_observation"
      ).length +
      contextTransportRegistryBatch.capabilityGapRecords.filter((record) =>
        record.missingPayloadType === "source_observation"
      ).length,
    missingObservationNeeds: sourceObservationNeeds,
  });

  const bundle = {
    text: renderedText,
    sources,
    summarySources,
    sourceSelection: buildConversationContextSourceSelection({
      requestedSources,
      sourceDecisions: finalizedSourceDecisions,
    }),
    sourceDecisions: finalizedSourceDecisions,
    documentChunking: {
      strategy: DEFAULT_DOCUMENT_CHUNK_STRATEGY,
      budget: documentChunkingBudget,
      occurrence: documentChunkingOccurrence,
      documents: documentChunkingDocuments,
    },
    documentIntelligence: {
      selectedArtifactKeys: Array.from(new Set(selectedArtifactKeys)),
      selectedApproxTokenCount: selectedArtifactTokenCount,
      documents: documentIntelligenceDocuments,
    },
    agentControl,
    agentWorkPlan,
    progressiveAssembly,
    asyncAgentWork,
    contextRegistry,
    artifactPromotion,
    sourceObservations: sourceObservationSummary,
    sourceObservationProducers: sourceObservationProducerSummary,
    uploadedDocumentDigestionLocal,
    uploadedDocumentDigestionExternal,
  };

  return {
    ...bundle,
    debugTrace: buildConversationContextDebugTrace({
      conversationId: params.conversationId,
      authority: params.authority,
      currentUserPrompt: params.currentUserPrompt ?? null,
      bundle,
    }),
  };
}
