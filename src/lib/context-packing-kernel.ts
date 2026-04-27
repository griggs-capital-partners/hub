import type {
  CreationDepth,
  RuntimeBudgetProfile,
  SourceCoverageTarget,
  TaskFidelityLevel,
  ValidationDepth,
} from "./agent-control-surface";
import { estimateTextTokens } from "./context-token-budget";
import type { DocumentKnowledgeArtifactRecord } from "./document-intelligence";
import type { ContextDocumentChunk } from "./context-document-chunks";
import type { ModelBudgetProfile } from "./model-budget-profiles";

export type ContextCoverageTarget = SourceCoverageTarget;

export type ContextPackingCandidateKind =
  | "artifact"
  | "source"
  | "excerpt"
  | "inspection_result";

export type ContextPackingOmissionReason =
  | "budget_exhausted"
  | "policy_limit"
  | "lower_priority"
  | "duplicate"
  | "not_relevant"
  | "source_unavailable"
  | "approval_required"
  | "tool_budget_exhausted"
  | "pass_not_allowed";

export type ContextReadinessSignal =
  | "complete"
  | "limited"
  | "needs_expansion"
  | "needs_approval"
  | "needs_async"
  | "blocked";

export type ContextPackingTrace = {
  type:
    | "packing_started"
    | "candidate_considered"
    | "candidate_selected"
    | "candidate_excluded"
    | "packing_completed";
  timestamp: string;
  passName: string;
  candidateId: string | null;
  detail: string;
  metadata: Record<string, unknown> | null;
};

export type ContextPackingCandidate = {
  id: string;
  kind: ContextPackingCandidateKind;
  sourceId: string;
  sourceType: string;
  label: string;
  content: string;
  approxTokenCount?: number | null;
  priority?: number | null;
  confidence?: number | null;
  artifactKind?: string | null;
  artifactStatus?: string | null;
  locationLabel?: string | null;
  provenance?: Record<string, unknown> | null;
  freshness?: {
    sourceUpdatedAt?: string | null;
    artifactUpdatedAt?: string | null;
    stale?: boolean;
  } | null;
  rankingHints?: string[];
  required?: boolean;
  metadata?: Record<string, unknown> | null;
};

export type ExcludedContextCandidate = {
  candidate: ContextPackingCandidate;
  reason: ContextPackingOmissionReason;
  detail: string;
  estimatedTokensNeeded: number | null;
};

export type ContextPackingRequest = {
  selectedBudgetProfile: RuntimeBudgetProfile;
  modelProfile?: ModelBudgetProfile | null;
  modelProfileCeilingTokens?: number | null;
  allowedContextBudgetTokens: number;
  outputBudgetHints?: {
    requestedTokens?: number | null;
    grantedTokens?: number | null;
    deliverableType?: string | null;
  } | null;
  taskFidelityLevel: TaskFidelityLevel;
  sourceCoverageTarget: ContextCoverageTarget;
  creationDepth: CreationDepth;
  validationDepth: ValidationDepth;
  artifactPriorityHints?: string[];
  sourceCandidateSet?: ContextPackingCandidate[];
  artifactCandidateSet?: ContextPackingCandidate[];
  rawExcerptCandidateSet?: ContextPackingCandidate[];
  freshnessHints?: Record<string, unknown> | null;
  provenanceRequirements?: string[];
  rankingHints?: string[];
  passName: string;
  assemblyStage: string;
  policyLimits?: Array<Record<string, unknown>>;
  traceRequirements?: {
    includeSelectedCandidates?: boolean;
    includeExcludedCandidates?: boolean;
    includeBudgetEvents?: boolean;
  } | null;
};

export type ContextPackingResult = {
  passName: string;
  assemblyStage: string;
  selectedCandidates: ContextPackingCandidate[];
  excludedCandidates: ExcludedContextCandidate[];
  selectedMix: {
    artifactCount: number;
    sourceCount: number;
    excerptCount: number;
    inspectionResultCount: number;
  };
  provenanceSummary: {
    sourceIds: string[];
    artifactIds: string[];
    excerptIds: string[];
    inspectionResultIds: string[];
  };
  budgetUsedTokens: number;
  budgetRemainingTokens: number;
  totalCandidateTokens: number;
  packingConfidence: number;
  completenessSignal: ContextReadinessSignal;
  limitations: string[];
  traceEvents: ContextPackingTrace[];
};

function nowIso() {
  return new Date().toISOString();
}

function buildTraceEvent(params: Omit<ContextPackingTrace, "timestamp">): ContextPackingTrace {
  return {
    ...params,
    timestamp: nowIso(),
  };
}

function candidateTokenCount(candidate: ContextPackingCandidate) {
  return Math.max(
    0,
    Math.ceil(candidate.approxTokenCount ?? estimateTextTokens(candidate.content))
  );
}

function candidateKindRank(candidate: ContextPackingCandidate) {
  switch (candidate.kind) {
    case "artifact":
      return 0;
    case "inspection_result":
      return 1;
    case "source":
      return 2;
    case "excerpt":
      return 3;
    default:
      return 9;
  }
}

function artifactKindRank(candidate: ContextPackingCandidate, priorityHints: string[]) {
  if (candidate.kind !== "artifact") {
    return 0;
  }

  const hintedIndex = candidate.artifactKind
    ? priorityHints.indexOf(candidate.artifactKind)
    : -1;
  if (hintedIndex >= 0) {
    return 100 - hintedIndex;
  }

  switch (candidate.artifactKind) {
    case "table_extraction":
      return 80;
    case "table_candidate":
      return 70;
    case "extraction_warning":
      return 65;
    case "document_summary":
    case "source_memory":
      return 55;
    default:
      return 40;
  }
}

function candidateStatusRank(candidate: ContextPackingCandidate) {
  switch (candidate.artifactStatus) {
    case "active":
      return 4;
    case "partial":
      return 3;
    case "warning":
    case "open":
      return 2;
    case "superseded":
      return 0;
    default:
      return 1;
  }
}

function normalizeCandidates(request: ContextPackingRequest) {
  const candidates = [
    ...(request.artifactCandidateSet ?? []),
    ...(request.sourceCandidateSet ?? []),
    ...(request.rawExcerptCandidateSet ?? []),
  ];
  const seen = new Set<string>();

  return candidates
    .filter((candidate) => {
      if (seen.has(candidate.id)) {
        return false;
      }

      seen.add(candidate.id);
      return true;
    })
    .sort((left, right) => {
      const leftRequired = left.required ? 1 : 0;
      const rightRequired = right.required ? 1 : 0;
      if (leftRequired !== rightRequired) return rightRequired - leftRequired;

      const kindRank = candidateKindRank(left) - candidateKindRank(right);
      if (kindRank !== 0) return kindRank;

      const leftPriority = left.priority ?? 0;
      const rightPriority = right.priority ?? 0;
      if (leftPriority !== rightPriority) return rightPriority - leftPriority;

      const artifactRank =
        artifactKindRank(right, request.artifactPriorityHints ?? []) -
        artifactKindRank(left, request.artifactPriorityHints ?? []);
      if (artifactRank !== 0) return artifactRank;

      const statusRank = candidateStatusRank(right) - candidateStatusRank(left);
      if (statusRank !== 0) return statusRank;

      const confidenceRank = (right.confidence ?? 0) - (left.confidence ?? 0);
      if (confidenceRank !== 0) return confidenceRank;

      const tokenRank = candidateTokenCount(left) - candidateTokenCount(right);
      if (tokenRank !== 0) return tokenRank;

      return left.id.localeCompare(right.id);
    });
}

function buildSelectedMix(candidates: ContextPackingCandidate[]) {
  return {
    artifactCount: candidates.filter((candidate) => candidate.kind === "artifact").length,
    sourceCount: candidates.filter((candidate) => candidate.kind === "source").length,
    excerptCount: candidates.filter((candidate) => candidate.kind === "excerpt").length,
    inspectionResultCount: candidates.filter((candidate) => candidate.kind === "inspection_result").length,
  };
}

function buildProvenanceSummary(candidates: ContextPackingCandidate[]) {
  return {
    sourceIds: Array.from(new Set(candidates.map((candidate) => candidate.sourceId))),
    artifactIds: candidates.filter((candidate) => candidate.kind === "artifact").map((candidate) => candidate.id),
    excerptIds: candidates.filter((candidate) => candidate.kind === "excerpt").map((candidate) => candidate.id),
    inspectionResultIds: candidates
      .filter((candidate) => candidate.kind === "inspection_result")
      .map((candidate) => candidate.id),
  };
}

function buildCompletenessSignal(params: {
  request: ContextPackingRequest;
  selectedCandidates: ContextPackingCandidate[];
  excludedCandidates: ExcludedContextCandidate[];
}) {
  if (params.excludedCandidates.length === 0) {
    return "complete" satisfies ContextReadinessSignal;
  }

  if (params.excludedCandidates.some((candidate) => candidate.reason === "approval_required")) {
    return "needs_approval" satisfies ContextReadinessSignal;
  }

  if (
    params.request.taskFidelityLevel === "highest_fidelity_ingestion" ||
    params.request.taskFidelityLevel === "highest_fidelity_creation" ||
    params.request.sourceCoverageTarget === "full_document" ||
    params.request.sourceCoverageTarget === "all_pages" ||
    params.request.sourceCoverageTarget === "all_tables"
  ) {
    return "needs_async" satisfies ContextReadinessSignal;
  }

  return params.selectedCandidates.length > 0
    ? ("limited" satisfies ContextReadinessSignal)
    : ("needs_expansion" satisfies ContextReadinessSignal);
}

function buildLimitations(params: {
  request: ContextPackingRequest;
  excludedCandidates: ExcludedContextCandidate[];
}) {
  const limitations: string[] = [];

  if (params.excludedCandidates.some((candidate) => candidate.reason === "budget_exhausted")) {
    limitations.push("Some relevant context candidates did not fit inside the selected context budget.");
  }

  if (
    params.request.sourceCoverageTarget === "full_document" ||
    params.request.sourceCoverageTarget === "all_pages" ||
    params.request.sourceCoverageTarget === "all_tables"
  ) {
    limitations.push("Packing preserved the requested source-coverage intent, but it does not decide whether coverage is sufficient.");
  }

  if (params.request.outputBudgetHints?.requestedTokens && params.request.outputBudgetHints?.grantedTokens) {
    if (params.request.outputBudgetHints.requestedTokens > params.request.outputBudgetHints.grantedTokens) {
      limitations.push("Output budget hints indicate the requested deliverable may exceed the granted output budget.");
    }
  }

  return limitations;
}

export function packContext(request: ContextPackingRequest): ContextPackingResult {
  const allowedContextBudgetTokens = Math.max(0, Math.floor(request.allowedContextBudgetTokens));
  const orderedCandidates = normalizeCandidates(request);
  const traceEvents: ContextPackingTrace[] = [
    buildTraceEvent({
      type: "packing_started",
      passName: request.passName,
      candidateId: null,
      detail: `Packing ${orderedCandidates.length} candidate(s) for ${request.assemblyStage}.`,
      metadata: {
        selectedBudgetProfile: request.selectedBudgetProfile,
        sourceCoverageTarget: request.sourceCoverageTarget,
        allowedContextBudgetTokens,
      },
    }),
  ];
  const selectedCandidates: ContextPackingCandidate[] = [];
  const excludedCandidates: ExcludedContextCandidate[] = [];
  let budgetUsedTokens = 0;

  for (const candidate of orderedCandidates) {
    const tokenCount = candidateTokenCount(candidate);
    traceEvents.push(
      buildTraceEvent({
        type: "candidate_considered",
        passName: request.passName,
        candidateId: candidate.id,
        detail: `Considering ${candidate.kind} candidate "${candidate.label}".`,
        metadata: {
          tokenCount,
          priority: candidate.priority ?? null,
          confidence: candidate.confidence ?? null,
          artifactKind: candidate.artifactKind ?? null,
          artifactStatus: candidate.artifactStatus ?? null,
        },
      })
    );

    if (budgetUsedTokens + tokenCount <= allowedContextBudgetTokens) {
      selectedCandidates.push(candidate);
      budgetUsedTokens += tokenCount;
      traceEvents.push(
        buildTraceEvent({
          type: "candidate_selected",
          passName: request.passName,
          candidateId: candidate.id,
          detail: `Selected candidate within budget.`,
          metadata: {
            tokenCount,
            budgetUsedTokens,
            budgetRemainingTokens: Math.max(0, allowedContextBudgetTokens - budgetUsedTokens),
          },
        })
      );
      continue;
    }

    const estimatedTokensNeeded = Math.max(0, budgetUsedTokens + tokenCount - allowedContextBudgetTokens);
    const excluded = {
      candidate,
      reason: "budget_exhausted",
      detail: `Candidate required ${tokenCount} token(s), with ${Math.max(
        0,
        allowedContextBudgetTokens - budgetUsedTokens
      )} token(s) remaining.`,
      estimatedTokensNeeded,
    } satisfies ExcludedContextCandidate;
    excludedCandidates.push(excluded);
    traceEvents.push(
      buildTraceEvent({
        type: "candidate_excluded",
        passName: request.passName,
        candidateId: candidate.id,
        detail: excluded.detail,
        metadata: {
          reason: excluded.reason,
          estimatedTokensNeeded,
        },
      })
    );
  }

  const totalCandidateTokens = orderedCandidates.reduce(
    (sum, candidate) => sum + candidateTokenCount(candidate),
    0
  );
  const completenessSignal = buildCompletenessSignal({
    request,
    selectedCandidates,
    excludedCandidates,
  });
  const packingConfidence = totalCandidateTokens === 0
    ? 0
    : Math.min(1, budgetUsedTokens / totalCandidateTokens);

  traceEvents.push(
    buildTraceEvent({
      type: "packing_completed",
      passName: request.passName,
      candidateId: null,
      detail: `Selected ${selectedCandidates.length} candidate(s); excluded ${excludedCandidates.length}.`,
      metadata: {
        budgetUsedTokens,
        budgetRemainingTokens: Math.max(0, allowedContextBudgetTokens - budgetUsedTokens),
        completenessSignal,
      },
    })
  );

  return {
    passName: request.passName,
    assemblyStage: request.assemblyStage,
    selectedCandidates,
    excludedCandidates,
    selectedMix: buildSelectedMix(selectedCandidates),
    provenanceSummary: buildProvenanceSummary(selectedCandidates),
    budgetUsedTokens,
    budgetRemainingTokens: Math.max(0, allowedContextBudgetTokens - budgetUsedTokens),
    totalCandidateTokens,
    packingConfidence,
    completenessSignal,
    limitations: buildLimitations({
      request,
      excludedCandidates,
    }),
    traceEvents,
  };
}

export class ContextPackingKernel {
  pack(request: ContextPackingRequest) {
    return packContext(request);
  }
}

export function buildArtifactPackingCandidate(params: {
  artifact: DocumentKnowledgeArtifactRecord;
  sourceType: string;
  priority?: number;
  required?: boolean;
}): ContextPackingCandidate {
  return {
    id: params.artifact.id,
    kind: "artifact",
    sourceId: params.artifact.sourceDocumentId,
    sourceType: params.sourceType,
    label:
      params.artifact.title ??
      params.artifact.summary ??
      `${params.artifact.kind}:${params.artifact.artifactKey}`,
    content: [
      params.artifact.title,
      params.artifact.summary,
      params.artifact.content,
    ].filter(Boolean).join("\n"),
    approxTokenCount: params.artifact.approxTokenCount,
    priority: params.priority,
    confidence: params.artifact.confidence,
    artifactKind: params.artifact.kind,
    artifactStatus: params.artifact.status,
    locationLabel: params.artifact.sourceLocationLabel,
    provenance: {
      artifactKey: params.artifact.artifactKey,
      tool: params.artifact.tool,
      location: params.artifact.location,
    },
    freshness: {
      artifactUpdatedAt: params.artifact.updatedAt,
    },
    rankingHints: [...params.artifact.relevanceHints],
    required: params.required,
    metadata: {
      artifactKey: params.artifact.artifactKey,
      tool: params.artifact.tool,
      payload: params.artifact.payload,
    },
  };
}

export function buildRawExcerptPackingCandidate(params: {
  chunk: ContextDocumentChunk;
  priority?: number;
  required?: boolean;
}): ContextPackingCandidate {
  return {
    id: `${params.chunk.sourceId}:${params.chunk.chunkIndex}`,
    kind: "excerpt",
    sourceId: params.chunk.sourceId,
    sourceType: params.chunk.sourceType,
    label: params.chunk.safeProvenanceLabel,
    content: params.chunk.text,
    approxTokenCount: params.chunk.approxTokenCount,
    priority: params.priority,
    confidence: null,
    locationLabel: params.chunk.safeProvenanceLabel,
    provenance: {
      chunkIndex: params.chunk.chunkIndex,
      pageNumberStart: params.chunk.pageNumberStart,
      pageNumberEnd: params.chunk.pageNumberEnd,
      tableId: params.chunk.tableId,
      figureId: params.chunk.figureId,
      headingPath: params.chunk.headingPath,
      sectionPath: params.chunk.sectionPath,
    },
    rankingHints: [
      params.chunk.sectionLabel,
      params.chunk.tableId,
      params.chunk.figureId,
      params.chunk.visualAnchorTitle,
      ...params.chunk.referencedLocationLabels,
    ].filter((value): value is string => Boolean(value)),
    required: params.required,
    metadata: {
      chunkIndex: params.chunk.chunkIndex,
      sourceOrderIndex: params.chunk.sourceOrderIndex,
      visualClassification: params.chunk.visualClassification,
      visualClassificationConfidence: params.chunk.visualClassificationConfidence,
      visualClassificationReasonCodes: params.chunk.visualClassificationReasonCodes,
      wasBudgetClamped: params.chunk.wasBudgetClamped ?? false,
    },
  };
}
