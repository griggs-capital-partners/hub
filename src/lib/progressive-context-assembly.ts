import type {
  AgentControlDecision,
  ExternalEscalationRecommendation,
  SourceCoverageTarget,
} from "./agent-control-surface";
import {
  ContextPackingKernel,
  type ContextPackingCandidate,
  type ContextPackingRequest,
  type ContextPackingResult,
  type ContextPackingTrace,
  type ExcludedContextCandidate,
} from "./context-packing-kernel";
import {
  buildContextPayloadsFromPackingCandidates,
  planAdaptiveContextTransport,
  type ContextPayload,
  type ContextTransportResult,
} from "./adaptive-context-transport";
import type {
  InspectionCapability,
  InspectionToolBroker,
  InspectionToolInvocation,
  InspectionToolResult,
} from "./inspection-tool-broker";

export type AssemblyStopReason =
  | "none"
  | "sufficient_context"
  | "context_budget_exhausted"
  | "tool_budget_exhausted"
  | "approval_required"
  | "async_recommended"
  | "blocked_by_policy"
  | "policy_limit"
  | "insufficient_context";

export type ContextAssemblyPassName =
  | "artifact_reuse"
  | "raw_source_excerpt_expansion"
  | "approved_synchronous_inspection"
  | "gap_detection"
  | "sufficiency_assessment"
  | "next_action_recommendation";

export type ContextAssemblyPassStatus =
  | "planned"
  | "completed"
  | "skipped"
  | "blocked";

export type ContextAssemblyPass = {
  name: ContextAssemblyPassName;
  status: ContextAssemblyPassStatus;
  detail: string;
  budgetTokensAllocated: number;
  toolCallsAllocated: number;
};

export type ContextExpansionRequest = {
  id: string;
  kind:
    | "artifact_reuse"
    | "raw_source_excerpt"
    | "approved_inspection"
    | "approval_gated_expansion"
    | "async_deep_work";
  sourceId?: string | null;
  capability?: InspectionCapability | null;
  requestedTokens?: number | null;
  allowed: boolean;
  requiresApproval: boolean;
  asyncRecommended: boolean;
  reason: string;
};

export type ContextRefreshRequest = {
  id: string;
  sourceId: string;
  reason: "stale_artifact" | "weak_artifact" | "coverage_upgrade" | "full_document_ingestion";
  capability?: InspectionCapability | null;
  requiresApproval: boolean;
  asyncRecommended: boolean;
};

export type ArtifactReuseDecision = {
  artifactId: string;
  sourceId: string;
  selected: boolean;
  reason: string;
  confidence: number | null;
  status: string | null;
  kind: string | null;
};

export type SourceExpansionDecision = {
  candidateId: string;
  sourceId: string;
  selected: boolean;
  reason: string;
  budgetTokensNeeded: number | null;
};

export type ContextGapKind =
  | "weak_artifact"
  | "missing_table_body"
  | "stale_artifact"
  | "unresolved_source_section"
  | "excluded_candidate_budget"
  | "insufficient_source_coverage"
  | "external_escalation_needed"
  | "approval_required"
  | "async_recommended"
  | "blocked_by_policy"
  | "raw_parser_output_insufficient"
  | "artifact_confidence_too_low"
  | "output_budget_insufficient"
  | "tool_budget_exhausted"
  | "context_budget_exhausted";

export type ContextGap = {
  id: string;
  kind: ContextGapKind;
  sourceId?: string | null;
  candidateId?: string | null;
  severity: "info" | "warning" | "blocking";
  summary: string;
  detail: string;
  requiredCapability?: InspectionCapability | null;
  recommendedCapabilities: InspectionCapability[];
  budgetTokensNeeded?: number | null;
  requiresApproval: boolean;
  asyncRecommended: boolean;
  metadata: Record<string, unknown> | null;
};

export type ContextDebtCandidate = {
  id: string;
  gapId: string;
  sourceId?: string | null;
  reason: string;
  resolvingCapabilities: InspectionCapability[];
  requiresApproval: boolean;
  asyncRecommended: boolean;
  shouldPersistLater: boolean;
  priority: "low" | "medium" | "high";
  detail: string;
};

export type ContextSufficiencyStatus =
  | "sufficient"
  | "sufficient_with_limitations"
  | "insufficient_needs_expansion"
  | "insufficient_needs_approval"
  | "insufficient_needs_async"
  | "blocked_by_policy";

export type ContextSufficiencyAssessment = {
  status: ContextSufficiencyStatus;
  readyForAnswer: boolean;
  confidence: number;
  reasons: string[];
  limitations: string[];
  gaps: ContextGap[];
};

export type AssemblyTraceEvent = {
  type:
    | "plan_created"
    | "pass_started"
    | "pass_completed"
    | "pass_skipped"
    | "packing_kernel_invoked"
    | "gap_detected"
    | "sufficiency_assessed"
    | "next_action_recommended"
    | "stop_reason_recorded";
  timestamp: string;
  passName: ContextAssemblyPassName | null;
  detail: string;
  metadata: Record<string, unknown> | null;
};

export type AssemblyPassResult = {
  pass: ContextAssemblyPass;
  packingRequest?: ContextPackingRequest | null;
  packingResult?: ContextPackingResult | null;
  reusedArtifactIds: string[];
  expandedExcerptIds: string[];
  inspectionsRun: Array<{
    invocationId: string;
    requestedCapability: InspectionCapability;
    status: InspectionToolResult["status"];
    selectedToolId: string | null;
    executedUnapprovedTool: false;
    recommendedNextCapabilities: InspectionCapability[];
  }>;
  toolCallsUsed: number;
  contextTokensUsed: number;
  gaps: ContextGap[];
  traceEvents: AssemblyTraceEvent[];
};

export type ExpandedContextBundle = {
  selectedCandidates: ContextPackingCandidate[];
  selectedArtifactIds: string[];
  selectedExcerptIds: string[];
  selectedSourceIds: string[];
  selectedInspectionResultIds: string[];
  excludedCandidates: ExcludedContextCandidate[];
  budgetUsedTokens: number;
  budgetRemainingTokens: number;
  limitations: string[];
};

export type ContextAssemblyPlan = {
  id: string;
  controlDecisionId: string;
  taskFidelityLevel: AgentControlDecision["taskFidelityLevel"];
  runtimeBudgetProfile: AgentControlDecision["runtimeBudgetProfile"];
  executionMode: AgentControlDecision["executionMode"];
  inspectionDepth: AgentControlDecision["inspectionDepth"];
  creationDepth: AgentControlDecision["creationDepth"];
  validationDepth: AgentControlDecision["validationDepth"];
  memoryDensity: AgentControlDecision["memoryDensity"];
  sourceCoverageTarget: SourceCoverageTarget;
  memoryRefreshDepth: AgentControlDecision["memoryRefreshDepth"];
  allowedContextBudgetTokens: number;
  allowedToolCalls: number;
  passes: ContextAssemblyPass[];
  expansionRequests: ContextExpansionRequest[];
  refreshRequests: ContextRefreshRequest[];
  stopReason: AssemblyStopReason;
  detail: string;
};

export type ProgressiveContextAssemblyInput = {
  request: string | null;
  agentControl: AgentControlDecision;
  artifactCandidates?: ContextPackingCandidate[];
  sourceCandidates?: ContextPackingCandidate[];
  rawExcerptCandidates?: ContextPackingCandidate[];
  transportPayloads?: ContextPayload[];
  inspectionInvocations?: InspectionToolInvocation[];
  toolBroker?: InspectionToolBroker | null;
  packingKernel?: ContextPackingKernel;
};

export type ProgressiveContextAssemblyResult = {
  plan: ContextAssemblyPlan;
  passResults: AssemblyPassResult[];
  packingRequests: ContextPackingRequest[];
  packingResults: ContextPackingResult[];
  contextTransport: ContextTransportResult;
  artifactReuseDecisions: ArtifactReuseDecision[];
  sourceExpansionDecisions: SourceExpansionDecision[];
  expandedContextBundle: ExpandedContextBundle;
  gaps: ContextGap[];
  contextDebtCandidates: ContextDebtCandidate[];
  sufficiency: ContextSufficiencyAssessment;
  stopReason: AssemblyStopReason;
  recommendedNextAction:
    | "answer"
    | "answer_with_limitations"
    | "expand_context"
    | "run_approved_inspection"
    | "request_approval"
    | "recommend_async_job"
    | "record_context_debt_candidate"
    | "stop_blocked_by_policy";
  traceEvents: AssemblyTraceEvent[];
  packingTraceEvents: ContextPackingTrace[];
  metrics: {
    contextBudgetUsedTokens: number;
    contextBudgetRemainingTokens: number;
    toolCallsUsed: number;
    toolCallsRemaining: number;
  };
};

const EXTERNAL_TABLE_RECOVERY_CAPABILITIES = [
  "rendered_page_inspection",
  "ocr",
  "vision_page_understanding",
  "document_ai_table_recovery",
] as const satisfies InspectionCapability[];

function nowIso() {
  return new Date().toISOString();
}

function buildTraceEvent(params: Omit<AssemblyTraceEvent, "timestamp">): AssemblyTraceEvent {
  return {
    ...params,
    timestamp: nowIso(),
  };
}

function unique<T>(values: T[]) {
  return Array.from(new Set(values));
}

function budgetForPass(params: {
  agentControl: AgentControlDecision;
  passName: ContextAssemblyPassName;
}) {
  const total = Math.max(0, Math.floor(params.agentControl.contextBudgetRequest.grantedTokens));

  if (params.passName === "artifact_reuse") {
    return Math.max(1, Math.floor(total * 0.35));
  }

  if (params.passName === "raw_source_excerpt_expansion") {
    return Math.max(1, Math.floor(total * 0.6));
  }

  return Math.max(0, Math.floor(total * 0.05));
}

function hasFullCoverageIntent(target: SourceCoverageTarget) {
  return (
    target === "full_document" ||
    target === "all_pages" ||
    target === "all_tables" ||
    target === "all_attachments" ||
    target === "linked_sources" ||
    target === "approval_required_full_workspace"
  );
}

function shouldRunRawExpansion(input: ProgressiveContextAssemblyInput) {
  const decision = input.agentControl;
  if (decision.blockedByPolicy) {
    return false;
  }

  if (decision.approvalRequired && decision.executionMode === "approval_required") {
    return false;
  }

  if (decision.inspectionDepth === "artifact_reuse_only" && (input.artifactCandidates ?? []).length > 0) {
    return false;
  }

  return (
    decision.runtimeBudgetProfile === "expanded_context" ||
    decision.runtimeBudgetProfile === "deep_inspection" ||
    decision.runtimeBudgetProfile === "high_fidelity_ingestion" ||
    decision.runtimeBudgetProfile === "high_fidelity_creation" ||
    decision.taskFidelityLevel === "deep_inspection" ||
    decision.taskFidelityLevel === "highest_fidelity_ingestion" ||
    decision.taskFidelityLevel === "highest_fidelity_creation" ||
    hasFullCoverageIntent(decision.sourceCoverageTarget) ||
    (input.artifactCandidates ?? []).length === 0
  );
}

function shouldRunInspection(input: ProgressiveContextAssemblyInput) {
  const decision = input.agentControl;
  if (decision.blockedByPolicy || decision.approvalRequired) {
    return false;
  }

  if ((input.inspectionInvocations ?? []).length === 0 || !input.toolBroker) {
    return false;
  }

  return (
    decision.inspectionDepth === "broker_supported" ||
    decision.inspectionDepth === "deep_inspection_recommended" ||
    decision.taskFidelityLevel === "deep_inspection"
  );
}

function buildPass(params: {
  name: ContextAssemblyPassName;
  status?: ContextAssemblyPassStatus;
  detail: string;
  agentControl: AgentControlDecision;
  toolCallsAllocated?: number;
}): ContextAssemblyPass {
  return {
    name: params.name,
    status: params.status ?? "planned",
    detail: params.detail,
    budgetTokensAllocated: budgetForPass({
      agentControl: params.agentControl,
      passName: params.name,
    }),
    toolCallsAllocated: params.toolCallsAllocated ?? 0,
  };
}

function buildPackingRequest(params: {
  passName: ContextAssemblyPassName;
  assemblyStage: string;
  agentControl: AgentControlDecision;
  candidates: {
    artifactCandidateSet?: ContextPackingCandidate[];
    sourceCandidateSet?: ContextPackingCandidate[];
    rawExcerptCandidateSet?: ContextPackingCandidate[];
  };
  budgetTokens: number;
}): ContextPackingRequest {
  const decision = params.agentControl;
  return {
    selectedBudgetProfile: decision.runtimeBudgetProfile,
    modelProfileCeilingTokens: decision.contextBudgetRequest.profileMaxTokens,
    allowedContextBudgetTokens: params.budgetTokens,
    outputBudgetHints: {
      requestedTokens: decision.outputBudgetRequest.requestedTokens,
      grantedTokens: decision.outputBudgetRequest.grantedTokens,
      deliverableType:
        decision.taskFidelityLevel === "highest_fidelity_creation"
          ? "deliverable"
          : null,
    },
    taskFidelityLevel: decision.taskFidelityLevel,
    sourceCoverageTarget: decision.sourceCoverageTarget,
    creationDepth: decision.creationDepth,
    validationDepth: decision.validationDepth,
    artifactPriorityHints: [
      "table_extraction",
      "table_candidate",
      "extraction_warning",
      "document_summary",
      "source_memory",
    ],
    ...params.candidates,
    freshnessHints: {
      memoryRefreshDepth: decision.memoryRefreshDepth,
      staleSourceIds: decision.sourceFreshness.staleSourceIds,
      weakArtifactSourceIds: decision.sourceFreshness.weakArtifactSourceIds,
    },
    provenanceRequirements: ["source_id", "source_location", "tool_trace"],
    rankingHints: [
      decision.taskFidelityLevel,
      decision.sourceCoverageTarget,
      decision.creationDepth,
      decision.validationDepth,
    ],
    passName: params.passName,
    assemblyStage: params.assemblyStage,
    policyLimits: decision.policyConfiguredLimitsApplied.map((limit) => ({
      id: limit.id,
      control: limit.control,
      value: limit.value,
    })),
    traceRequirements: {
      includeSelectedCandidates: true,
      includeExcludedCandidates: true,
      includeBudgetEvents: true,
    },
  };
}

function gapSeverity(kind: ContextGapKind, decision: AgentControlDecision) {
  if (kind === "blocked_by_policy") return "blocking" as const;
  if (kind === "approval_required" && decision.approvalRequired) return "blocking" as const;
  if (kind === "async_recommended" && decision.asyncRecommended) return "warning" as const;
  if (kind === "missing_table_body") return "warning" as const;
  if (kind === "insufficient_source_coverage") return "warning" as const;
  return "info" as const;
}

function buildContextGap(params: {
  kind: ContextGapKind;
  decision: AgentControlDecision;
  sourceId?: string | null;
  candidateId?: string | null;
  summary: string;
  detail: string;
  requiredCapability?: InspectionCapability | null;
  recommendedCapabilities?: InspectionCapability[];
  budgetTokensNeeded?: number | null;
  requiresApproval?: boolean;
  asyncRecommended?: boolean;
  metadata?: Record<string, unknown> | null;
}): ContextGap {
  const id = [
    params.kind,
    params.sourceId ?? "workspace",
    params.candidateId ?? "general",
  ].join(":");
  return {
    id,
    kind: params.kind,
    sourceId: params.sourceId ?? null,
    candidateId: params.candidateId ?? null,
    severity: gapSeverity(params.kind, params.decision),
    summary: params.summary,
    detail: params.detail,
    requiredCapability: params.requiredCapability ?? null,
    recommendedCapabilities: unique(params.recommendedCapabilities ?? []),
    budgetTokensNeeded: params.budgetTokensNeeded ?? null,
    requiresApproval: params.requiresApproval ?? params.decision.approvalRequired,
    asyncRecommended: params.asyncRecommended ?? params.decision.asyncRecommended,
    metadata: params.metadata ?? null,
  };
}

function capabilityRecommendations(decision: AgentControlDecision) {
  return unique([
    ...decision.externalEscalation.capabilities,
    ...decision.toolGovernance.recommendedCapabilities,
  ]);
}

function isWeakArtifact(candidate: ContextPackingCandidate) {
  return (
    candidate.kind === "artifact" &&
    (candidate.artifactStatus === "partial" ||
      candidate.artifactStatus === "warning" ||
      candidate.artifactStatus === "open" ||
      candidate.artifactKind === "table_candidate" ||
      candidate.artifactKind === "extraction_warning")
  );
}

function isMissingTableBodyArtifact(candidate: ContextPackingCandidate) {
  const text = [
    candidate.artifactKind,
    candidate.artifactStatus,
    candidate.label,
    candidate.content,
    ...(candidate.rankingHints ?? []),
  ].join(" ");

  return (
    candidate.kind === "artifact" &&
    (candidate.artifactKind === "table_candidate" ||
      candidate.artifactKind === "extraction_warning") &&
    /\b(table body missing|missing table body|did not recover a structured table body|sparse extraction|do not infer missing columns)\b/i.test(text)
  );
}

function buildGaps(params: {
  decision: AgentControlDecision;
  packingResults: ContextPackingResult[];
  selectedCandidates: ContextPackingCandidate[];
  allCandidates: ContextPackingCandidate[];
  toolCallsUsed: number;
}) {
  const decision = params.decision;
  const gaps: ContextGap[] = [];

  if (decision.blockedByPolicy) {
    gaps.push(
      buildContextGap({
        kind: "blocked_by_policy",
        decision,
        summary: "Agent Control Surface blocked further assembly.",
        detail: decision.blockedByPolicyReasons.join(" ") || "Policy blocked this context path.",
        recommendedCapabilities: [],
        requiresApproval: false,
        asyncRecommended: false,
      })
    );
    return gaps;
  }

  if (decision.approvalRequired) {
    gaps.push(
      buildContextGap({
        kind: "approval_required",
        decision,
        summary: "Approval is required before restricted expansion.",
        detail: `Required approval reason(s): ${decision.approvalRequiredReasons.join(", ")}.`,
        recommendedCapabilities: capabilityRecommendations(decision),
        requiresApproval: true,
        asyncRecommended: decision.asyncRecommended,
      })
    );
  }

  if (decision.asyncRecommended) {
    gaps.push(
      buildContextGap({
        kind: "async_recommended",
        decision,
        summary: "The requested fidelity is better handled as staged async work.",
        detail: decision.asyncRecommendedReason ?? "Agent Control Surface recommended async deep work.",
        recommendedCapabilities: capabilityRecommendations(decision),
        requiresApproval: decision.approvalRequired,
        asyncRecommended: true,
      })
    );
  }

  if (params.toolCallsUsed >= decision.toolBudgetRequest.grantedToolCalls && decision.toolBudgetRequest.grantedToolCalls > 0) {
    gaps.push(
      buildContextGap({
        kind: "tool_budget_exhausted",
        decision,
        summary: "Tool budget was consumed.",
        detail: "No additional synchronous inspection calls should run in this assembly pass.",
        recommendedCapabilities: capabilityRecommendations(decision),
        requiresApproval: decision.approvalRequired,
      })
    );
  }

  for (const result of params.packingResults) {
    for (const excluded of result.excludedCandidates) {
      gaps.push(
        buildContextGap({
          kind: "excluded_candidate_budget",
          decision,
          sourceId: excluded.candidate.sourceId,
          candidateId: excluded.candidate.id,
          summary: "Relevant context candidate did not fit.",
          detail: excluded.detail,
          recommendedCapabilities: [],
          budgetTokensNeeded: excluded.estimatedTokensNeeded,
          requiresApproval: decision.approvalRequired,
        })
      );
    }
  }

  for (const candidate of params.selectedCandidates) {
    if (isWeakArtifact(candidate)) {
      gaps.push(
        buildContextGap({
          kind: "weak_artifact",
          decision,
          sourceId: candidate.sourceId,
          candidateId: candidate.id,
          summary: "A reusable artifact is weak or partial.",
          detail: "The artifact can ground a limited answer, but a stronger artifact should supersede it later.",
          recommendedCapabilities: capabilityRecommendations(decision),
          requiresApproval: decision.approvalRequired,
        })
      );
    }

    if (isMissingTableBodyArtifact(candidate)) {
      gaps.push(
        buildContextGap({
          kind: "missing_table_body",
          decision,
          sourceId: candidate.sourceId,
          candidateId: candidate.id,
          summary: "Table body is missing from durable memory.",
          detail:
            "Existing table_candidate / extraction_warning artifacts were reused, but approved built-in parser tools did not recover the rendered table body.",
          requiredCapability: "document_ai_table_recovery",
          recommendedCapabilities: capabilityRecommendations(decision).length > 0
            ? capabilityRecommendations(decision)
            : [...EXTERNAL_TABLE_RECOVERY_CAPABILITIES],
          requiresApproval: decision.externalEscalation.level === "approval_required" || decision.approvalRequired,
          asyncRecommended: decision.asyncRecommended || decision.externalEscalation.level === "recommended",
          metadata: {
            approvedBuiltInToolsEnough: false,
            unavailableCapabilities: [...EXTERNAL_TABLE_RECOVERY_CAPABILITIES],
          },
        })
      );
      gaps.push(
        buildContextGap({
          kind: "raw_parser_output_insufficient",
          decision,
          sourceId: candidate.sourceId,
          candidateId: candidate.id,
          summary: "Parser output is insufficient for table-body reconstruction.",
          detail: "Parser text can remain supporting evidence, but it is not the ceiling for document truth.",
          recommendedCapabilities: [...EXTERNAL_TABLE_RECOVERY_CAPABILITIES],
          requiresApproval: decision.approvalRequired,
          asyncRecommended: true,
        })
      );
    }
  }

  if (hasFullCoverageIntent(decision.sourceCoverageTarget)) {
    const selectedSourceIds = new Set(params.selectedCandidates.map((candidate) => candidate.sourceId));
    const allSourceIds = new Set(params.allCandidates.map((candidate) => candidate.sourceId));
    const selectedCount = params.selectedCandidates.length;
    const allCount = params.allCandidates.length;
    if (selectedCount < allCount || selectedSourceIds.size < allSourceIds.size) {
      gaps.push(
        buildContextGap({
          kind: "insufficient_source_coverage",
          decision,
          summary: "Requested source coverage was not fully achieved synchronously.",
          detail: `Coverage target ${decision.sourceCoverageTarget} considered ${allCount} candidate(s) and selected ${selectedCount}.`,
          recommendedCapabilities: capabilityRecommendations(decision),
          requiresApproval: decision.approvalRequired,
          asyncRecommended: true,
          metadata: {
            sourceCoverageTarget: decision.sourceCoverageTarget,
            selectedCandidateCount: selectedCount,
            totalCandidateCount: allCount,
          },
        })
      );
    }
  }

  if (decision.externalEscalation.level !== "none" && decision.externalEscalation.capabilities.length > 0) {
    gaps.push(
      buildContextGap({
        kind: "external_escalation_needed",
        decision,
        summary: "External or not-yet-approved capability remains the truthful next step.",
        detail: decision.externalEscalation.detail,
        recommendedCapabilities: decision.externalEscalation.capabilities,
        requiresApproval: decision.externalEscalation.level === "approval_required" || decision.approvalRequired,
        asyncRecommended: decision.asyncRecommended,
        metadata: {
          externalEscalation: decision.externalEscalation,
        },
      })
    );
  }

  if (
    decision.taskFidelityLevel === "highest_fidelity_creation" &&
    decision.outputBudgetRequest.requestedTokens > decision.outputBudgetRequest.grantedTokens
  ) {
    gaps.push(
      buildContextGap({
        kind: "output_budget_insufficient",
        decision,
        summary: "Requested deliverable may exceed the granted output budget.",
        detail: decision.outputBudgetRequest.reason,
        recommendedCapabilities: [],
        requiresApproval: decision.approvalRequired,
        asyncRecommended: decision.asyncRecommended,
      })
    );
  }

  return dedupeGaps(gaps);
}

function dedupeGaps(gaps: ContextGap[]) {
  const byId = new Map<string, ContextGap>();
  for (const gap of gaps) {
    byId.set(gap.id, gap);
  }
  return [...byId.values()];
}

function buildDebtCandidates(gaps: ContextGap[]) {
  return gaps
    .filter((gap) =>
      gap.asyncRecommended ||
      gap.kind === "missing_table_body" ||
      gap.kind === "insufficient_source_coverage" ||
      gap.kind === "raw_parser_output_insufficient"
    )
    .map((gap) => ({
      id: `context_debt:${gap.id}`,
      gapId: gap.id,
      sourceId: gap.sourceId ?? null,
      reason: gap.summary,
      resolvingCapabilities: [...gap.recommendedCapabilities],
      requiresApproval: gap.requiresApproval,
      asyncRecommended: gap.asyncRecommended,
      shouldPersistLater: true,
      priority: gap.kind === "missing_table_body" || gap.kind === "insufficient_source_coverage"
        ? "high"
        : "medium",
      detail: gap.detail,
    }) satisfies ContextDebtCandidate);
}

function assessSufficiency(params: {
  decision: AgentControlDecision;
  gaps: ContextGap[];
  selectedCandidates: ContextPackingCandidate[];
}) {
  const decision = params.decision;
  const limitations = params.gaps
    .filter((gap) => gap.severity !== "info")
    .map((gap) => gap.summary);
  const reasons: string[] = [];

  if (decision.blockedByPolicy) {
    reasons.push("Policy blocked the requested context path.");
    return {
      status: "blocked_by_policy",
      readyForAnswer: false,
      confidence: 0,
      reasons,
      limitations,
      gaps: params.gaps,
    } satisfies ContextSufficiencyAssessment;
  }

  if (decision.approvalRequired && params.gaps.some((gap) => gap.requiresApproval)) {
    reasons.push("Approval is required before enough context can be assembled.");
    return {
      status: "insufficient_needs_approval",
      readyForAnswer: false,
      confidence: 0.35,
      reasons,
      limitations,
      gaps: params.gaps,
    } satisfies ContextSufficiencyAssessment;
  }

  if (
    decision.asyncRecommended &&
    (decision.taskFidelityLevel === "highest_fidelity_ingestion" ||
      decision.taskFidelityLevel === "highest_fidelity_creation" ||
      params.gaps.some((gap) => gap.kind === "insufficient_source_coverage"))
  ) {
    reasons.push("Requested fidelity requires staged or async work for honest completion.");
    return {
      status: "insufficient_needs_async",
      readyForAnswer: false,
      confidence: 0.45,
      reasons,
      limitations,
      gaps: params.gaps,
    } satisfies ContextSufficiencyAssessment;
  }

  if (params.selectedCandidates.length === 0) {
    reasons.push("No reusable artifact, source, or excerpt candidate was selected.");
    return {
      status: "insufficient_needs_expansion",
      readyForAnswer: false,
      confidence: 0.2,
      reasons,
      limitations,
      gaps: params.gaps,
    } satisfies ContextSufficiencyAssessment;
  }

  if (params.gaps.some((gap) => gap.kind === "missing_table_body" || gap.kind === "weak_artifact")) {
    reasons.push("Context can support a limited answer, but a stronger artifact or external recovery is still needed.");
    return {
      status: "sufficient_with_limitations",
      readyForAnswer: true,
      confidence: 0.62,
      reasons,
      limitations,
      gaps: params.gaps,
    } satisfies ContextSufficiencyAssessment;
  }

  reasons.push("Selected context satisfies the current fidelity boundary.");
  return {
    status: "sufficient",
    readyForAnswer: true,
    confidence: 0.82,
    reasons,
    limitations,
    gaps: params.gaps,
  } satisfies ContextSufficiencyAssessment;
}

function recommendedNextAction(params: {
  decision: AgentControlDecision;
  sufficiency: ContextSufficiencyAssessment;
  gaps: ContextGap[];
}) {
  if (params.sufficiency.status === "blocked_by_policy") {
    return "stop_blocked_by_policy" as const;
  }

  if (params.sufficiency.status === "insufficient_needs_approval") {
    return "request_approval" as const;
  }

  if (params.sufficiency.status === "insufficient_needs_async") {
    return "recommend_async_job" as const;
  }

  if (params.sufficiency.status === "insufficient_needs_expansion") {
    return params.gaps.some((gap) => gap.recommendedCapabilities.length > 0)
      ? ("run_approved_inspection" as const)
      : ("expand_context" as const);
  }

  if (params.sufficiency.status === "sufficient_with_limitations") {
    return "answer_with_limitations" as const;
  }

  return "answer" as const;
}

function stopReasonFor(params: {
  decision: AgentControlDecision;
  sufficiency: ContextSufficiencyAssessment;
}) {
  if (params.sufficiency.status === "blocked_by_policy") return "blocked_by_policy" as const;
  if (params.sufficiency.status === "insufficient_needs_approval") return "approval_required" as const;
  if (params.sufficiency.status === "insufficient_needs_async") return "async_recommended" as const;
  if (params.sufficiency.status === "insufficient_needs_expansion") return "insufficient_context" as const;
  if (params.sufficiency.status === "sufficient" || params.sufficiency.status === "sufficient_with_limitations") {
    return "sufficient_context" as const;
  }
  return "none" as const;
}

function buildExpandedContextBundle(params: {
  packingResults: ContextPackingResult[];
  allowedContextBudgetTokens: number;
}) {
  const selectedCandidates = params.packingResults.flatMap((result) => result.selectedCandidates);
  const excludedCandidates = params.packingResults.flatMap((result) => result.excludedCandidates);
  const budgetUsedTokens = params.packingResults.reduce(
    (sum, result) => sum + result.budgetUsedTokens,
    0
  );

  return {
    selectedCandidates,
    selectedArtifactIds: selectedCandidates
      .filter((candidate) => candidate.kind === "artifact")
      .map((candidate) => candidate.id),
    selectedExcerptIds: selectedCandidates
      .filter((candidate) => candidate.kind === "excerpt")
      .map((candidate) => candidate.id),
    selectedSourceIds: unique(selectedCandidates.map((candidate) => candidate.sourceId)),
    selectedInspectionResultIds: selectedCandidates
      .filter((candidate) => candidate.kind === "inspection_result")
      .map((candidate) => candidate.id),
    excludedCandidates,
    budgetUsedTokens,
    budgetRemainingTokens: Math.max(0, params.allowedContextBudgetTokens - budgetUsedTokens),
    limitations: unique(params.packingResults.flatMap((result) => result.limitations)),
  } satisfies ExpandedContextBundle;
}

function buildTransportPayloads(input: ProgressiveContextAssemblyInput) {
  return [
    ...buildContextPayloadsFromPackingCandidates([
      ...(input.artifactCandidates ?? []),
      ...(input.sourceCandidates ?? []),
      ...(input.rawExcerptCandidates ?? []),
    ]),
    ...(input.transportPayloads ?? []),
  ];
}

function buildArtifactReuseDecisions(result: ContextPackingResult | null) {
  if (!result) return [] satisfies ArtifactReuseDecision[];
  const selectedIds = new Set(result.selectedCandidates.map((candidate) => candidate.id));
  return [
    ...result.selectedCandidates,
    ...result.excludedCandidates.map((excluded) => excluded.candidate),
  ]
    .filter((candidate) => candidate.kind === "artifact")
    .map((candidate) => ({
      artifactId: candidate.id,
      sourceId: candidate.sourceId,
      selected: selectedIds.has(candidate.id),
      reason: selectedIds.has(candidate.id)
        ? "Selected during artifact reuse pass."
        : "Excluded during artifact reuse pass.",
      confidence: candidate.confidence ?? null,
      status: candidate.artifactStatus ?? null,
      kind: candidate.artifactKind ?? null,
    }) satisfies ArtifactReuseDecision);
}

function buildSourceExpansionDecisions(result: ContextPackingResult | null) {
  if (!result) return [] satisfies SourceExpansionDecision[];
  const selectedIds = new Set(result.selectedCandidates.map((candidate) => candidate.id));
  return [
    ...result.selectedCandidates,
    ...result.excludedCandidates.map((excluded) => excluded.candidate),
  ]
    .filter((candidate) => candidate.kind === "excerpt" || candidate.kind === "source")
    .map((candidate) => ({
      candidateId: candidate.id,
      sourceId: candidate.sourceId,
      selected: selectedIds.has(candidate.id),
      reason: selectedIds.has(candidate.id)
        ? "Selected during source expansion pass."
        : "Excluded during source expansion pass.",
      budgetTokensNeeded:
        result.excludedCandidates.find((excluded) => excluded.candidate.id === candidate.id)
          ?.estimatedTokensNeeded ?? null,
    }) satisfies SourceExpansionDecision);
}

function buildExpansionRequests(input: ProgressiveContextAssemblyInput) {
  const decision = input.agentControl;
  const requests: ContextExpansionRequest[] = [
    {
      id: "artifact_reuse",
      kind: "artifact_reuse",
      requestedTokens: budgetForPass({ agentControl: decision, passName: "artifact_reuse" }),
      allowed: !decision.blockedByPolicy,
      requiresApproval: false,
      asyncRecommended: false,
      reason: "Reusable durable artifacts are considered before raw parser excerpts.",
    },
  ];

  requests.push({
    id: "raw_source_excerpt_expansion",
    kind: decision.approvalRequired ? "approval_gated_expansion" : "raw_source_excerpt",
    requestedTokens: budgetForPass({
      agentControl: decision,
      passName: "raw_source_excerpt_expansion",
    }),
    allowed: shouldRunRawExpansion(input),
    requiresApproval: decision.approvalRequired,
    asyncRecommended: decision.asyncRecommended,
    reason: shouldRunRawExpansion(input)
      ? "Source excerpt expansion is allowed by the current control decision."
      : "Source excerpt expansion is not needed or is gated by the control decision.",
  });

  for (const capability of capabilityRecommendations(decision)) {
    requests.push({
      id: `capability:${capability}`,
      kind: decision.asyncRecommended ? "async_deep_work" : "approved_inspection",
      capability,
      allowed: shouldRunInspection(input),
      requiresApproval: decision.approvalRequired || decision.externalEscalation.level === "approval_required",
      asyncRecommended: decision.asyncRecommended,
      reason: "Capability came from Agent Control Surface or broker governance recommendation.",
    });
  }

  return requests;
}

function buildRefreshRequests(input: ProgressiveContextAssemblyInput) {
  const decision = input.agentControl;
  const requests: ContextRefreshRequest[] = [];

  requests.push(
    ...unique(decision.sourceFreshness.weakArtifactSourceIds).map((sourceId) => ({
      id: `refresh:${sourceId}:weak_artifact`,
      sourceId,
      reason: "weak_artifact",
      capability: capabilityRecommendations(decision)[0] ?? null,
      requiresApproval: decision.approvalRequired,
      asyncRecommended: decision.asyncRecommended,
    }) satisfies ContextRefreshRequest)
  );
  requests.push(
    ...unique(decision.sourceFreshness.staleSourceIds).map((sourceId) => ({
        id: `refresh:${sourceId}:stale_artifact`,
        sourceId,
        reason: "stale_artifact",
        capability: "artifact_validation",
        requiresApproval: decision.approvalRequired,
        asyncRecommended: decision.asyncRecommended,
      }) satisfies ContextRefreshRequest)
  );

  return requests;
}

function externalEscalationDetail(externalEscalation: ExternalEscalationRecommendation) {
  if (externalEscalation.level === "none") {
    return "No external escalation was recommended.";
  }

  return `${externalEscalation.level}: ${externalEscalation.capabilities.join(", ")}. ${externalEscalation.detail}`;
}

export class ProgressiveContextAssembler {
  assemble(input: ProgressiveContextAssemblyInput): ProgressiveContextAssemblyResult {
    const packingKernel = input.packingKernel ?? new ContextPackingKernel();
    const decision = input.agentControl;
    const availableTransportPayloads = buildTransportPayloads(input);
    const passResults: AssemblyPassResult[] = [];
    const packingRequests: ContextPackingRequest[] = [];
    const packingResults: ContextPackingResult[] = [];
    const traceEvents: AssemblyTraceEvent[] = [
      buildTraceEvent({
        type: "plan_created",
        passName: null,
        detail: "Progressive context assembly plan created from Agent Control Surface decision.",
        metadata: {
          decisionId: decision.decisionId,
          executionMode: decision.executionMode,
          externalEscalation: externalEscalationDetail(decision.externalEscalation),
        },
      }),
    ];

    const plannedPasses: ContextAssemblyPass[] = [
      buildPass({
        name: "artifact_reuse",
        detail: "Reuse relevant durable knowledge artifacts before weaker raw parser excerpts.",
        agentControl: decision,
      }),
      buildPass({
        name: "raw_source_excerpt_expansion",
        status: shouldRunRawExpansion(input) ? "planned" : "skipped",
        detail: "Expand raw source excerpts only when needed and allowed by the control decision.",
        agentControl: decision,
      }),
      buildPass({
        name: "approved_synchronous_inspection",
        status: shouldRunInspection(input) ? "planned" : "skipped",
        detail: "Run only approved synchronous broker tools when allowed by tool budget and governance.",
        agentControl: decision,
        toolCallsAllocated: decision.toolBudgetRequest.grantedToolCalls,
      }),
      buildPass({
        name: "gap_detection",
        detail: "Detect missing, weak, stale, excluded, approval-gated, async, or policy-blocked context.",
        agentControl: decision,
      }),
      buildPass({
        name: "sufficiency_assessment",
        detail: "Assess whether assembled context is enough for the requested fidelity.",
        agentControl: decision,
      }),
      buildPass({
        name: "next_action_recommendation",
        detail: "Recommend the next truthful action for the current turn.",
        agentControl: decision,
      }),
    ];

    const plan: ContextAssemblyPlan = {
      id: `assembly:${decision.decisionId}`,
      controlDecisionId: decision.decisionId,
      taskFidelityLevel: decision.taskFidelityLevel,
      runtimeBudgetProfile: decision.runtimeBudgetProfile,
      executionMode: decision.executionMode,
      inspectionDepth: decision.inspectionDepth,
      creationDepth: decision.creationDepth,
      validationDepth: decision.validationDepth,
      memoryDensity: decision.memoryDensity,
      sourceCoverageTarget: decision.sourceCoverageTarget,
      memoryRefreshDepth: decision.memoryRefreshDepth,
      allowedContextBudgetTokens: decision.contextBudgetRequest.grantedTokens,
      allowedToolCalls: decision.toolBudgetRequest.grantedToolCalls,
      passes: plannedPasses,
      expansionRequests: buildExpansionRequests(input),
      refreshRequests: buildRefreshRequests(input),
      stopReason: decision.blockedByPolicy ? "blocked_by_policy" : "none",
      detail: "A-04e owns assembly strategy; A-03 packing is invoked as a deterministic subordinate kernel.",
    };

    if (decision.blockedByPolicy) {
      const blockedPass = { ...plannedPasses[0], status: "blocked" as const };
      const blockedGap = buildContextGap({
        kind: "blocked_by_policy",
        decision,
        summary: "Policy blocked further context assembly.",
        detail: decision.blockedByPolicyReasons.join(" ") || "Blocked by Agent Control Surface.",
        requiresApproval: false,
        asyncRecommended: false,
      });
      const sufficiency = assessSufficiency({
        decision,
        gaps: [blockedGap],
        selectedCandidates: [],
      });
      const stopReason = stopReasonFor({ decision, sufficiency });
      const action = recommendedNextAction({ decision, sufficiency, gaps: [blockedGap] });
      traceEvents.push(
        buildTraceEvent({
          type: "stop_reason_recorded",
          passName: blockedPass.name,
          detail: "Blocked-by-policy control decision prevented further assembly.",
          metadata: { stopReason },
        })
      );

      return {
        plan: {
          ...plan,
          passes: plannedPasses.map((pass) => ({ ...pass, status: "blocked" })),
          stopReason,
        },
        passResults: [
          {
            pass: blockedPass,
            reusedArtifactIds: [],
            expandedExcerptIds: [],
            inspectionsRun: [],
            toolCallsUsed: 0,
            contextTokensUsed: 0,
            gaps: [blockedGap],
            traceEvents,
          },
        ],
        packingRequests,
        packingResults,
        contextTransport: planAdaptiveContextTransport({
          request: input.request,
          agentControl: decision,
          availablePayloads: availableTransportPayloads,
          a03PackingResults: packingResults,
        }),
        artifactReuseDecisions: [],
        sourceExpansionDecisions: [],
        expandedContextBundle: buildExpandedContextBundle({
          packingResults,
          allowedContextBudgetTokens: decision.contextBudgetRequest.grantedTokens,
        }),
        gaps: [blockedGap],
        contextDebtCandidates: [],
        sufficiency,
        stopReason,
        recommendedNextAction: action,
        traceEvents,
        packingTraceEvents: [],
        metrics: {
          contextBudgetUsedTokens: 0,
          contextBudgetRemainingTokens: decision.contextBudgetRequest.grantedTokens,
          toolCallsUsed: 0,
          toolCallsRemaining: decision.toolBudgetRequest.grantedToolCalls,
        },
      };
    }

    const artifactPass = { ...plannedPasses[0], status: "completed" as const };
    traceEvents.push(
      buildTraceEvent({
        type: "pass_started",
        passName: artifactPass.name,
        detail: artifactPass.detail,
        metadata: null,
      })
    );
    const artifactPackingRequest = buildPackingRequest({
      passName: "artifact_reuse",
      assemblyStage: "pass_1_artifact_reuse",
      agentControl: decision,
      candidates: {
        artifactCandidateSet: input.artifactCandidates ?? [],
      },
      budgetTokens: artifactPass.budgetTokensAllocated,
    });
    packingRequests.push(artifactPackingRequest);
    traceEvents.push(
      buildTraceEvent({
        type: "packing_kernel_invoked",
        passName: "artifact_reuse",
        detail: "A-03 Context Packing Kernel invoked for artifact reuse.",
        metadata: {
          candidateCount: input.artifactCandidates?.length ?? 0,
          allowedContextBudgetTokens: artifactPackingRequest.allowedContextBudgetTokens,
        },
      })
    );
    const artifactPackingResult = packingKernel.pack(artifactPackingRequest);
    packingResults.push(artifactPackingResult);
    passResults.push({
      pass: artifactPass,
      packingRequest: artifactPackingRequest,
      packingResult: artifactPackingResult,
      reusedArtifactIds: artifactPackingResult.selectedCandidates.map((candidate) => candidate.id),
      expandedExcerptIds: [],
      inspectionsRun: [],
      toolCallsUsed: 0,
      contextTokensUsed: artifactPackingResult.budgetUsedTokens,
      gaps: [],
      traceEvents: [
        buildTraceEvent({
          type: "pass_completed",
          passName: "artifact_reuse",
          detail: "Artifact reuse pass completed.",
          metadata: {
            selectedArtifactIds: artifactPackingResult.selectedCandidates.map((candidate) => candidate.id),
          },
        }),
      ],
    });

    let rawPackingResult: ContextPackingResult | null = null;
    if (shouldRunRawExpansion(input)) {
      const rawPass = { ...plannedPasses[1], status: "completed" as const };
      traceEvents.push(
        buildTraceEvent({
          type: "pass_started",
          passName: rawPass.name,
          detail: rawPass.detail,
          metadata: null,
        })
      );
      const rawPackingRequest = buildPackingRequest({
        passName: "raw_source_excerpt_expansion",
        assemblyStage: "pass_2_raw_source_excerpt_expansion",
        agentControl: decision,
        candidates: {
          sourceCandidateSet: input.sourceCandidates ?? [],
          rawExcerptCandidateSet: input.rawExcerptCandidates ?? [],
        },
        budgetTokens: rawPass.budgetTokensAllocated,
      });
      packingRequests.push(rawPackingRequest);
      traceEvents.push(
        buildTraceEvent({
          type: "packing_kernel_invoked",
          passName: "raw_source_excerpt_expansion",
          detail: "A-03 Context Packing Kernel invoked for source excerpt expansion.",
          metadata: {
            sourceCandidateCount: input.sourceCandidates?.length ?? 0,
            rawExcerptCandidateCount: input.rawExcerptCandidates?.length ?? 0,
            sourceCoverageTarget: decision.sourceCoverageTarget,
          },
        })
      );
      rawPackingResult = packingKernel.pack(rawPackingRequest);
      packingResults.push(rawPackingResult);
      passResults.push({
        pass: rawPass,
        packingRequest: rawPackingRequest,
        packingResult: rawPackingResult,
        reusedArtifactIds: [],
        expandedExcerptIds: rawPackingResult.selectedCandidates.map((candidate) => candidate.id),
        inspectionsRun: [],
        toolCallsUsed: 0,
        contextTokensUsed: rawPackingResult.budgetUsedTokens,
        gaps: [],
        traceEvents: [
          buildTraceEvent({
            type: "pass_completed",
            passName: "raw_source_excerpt_expansion",
            detail: "Raw source excerpt expansion pass completed.",
            metadata: {
              expandedExcerptIds: rawPackingResult.selectedCandidates.map((candidate) => candidate.id),
            },
          }),
        ],
      });
    } else {
      const skippedPass = { ...plannedPasses[1], status: "skipped" as const };
      passResults.push({
        pass: skippedPass,
        reusedArtifactIds: [],
        expandedExcerptIds: [],
        inspectionsRun: [],
        toolCallsUsed: 0,
        contextTokensUsed: 0,
        gaps: [],
        traceEvents: [
          buildTraceEvent({
            type: "pass_skipped",
            passName: "raw_source_excerpt_expansion",
            detail: skippedPass.detail,
            metadata: {
              approvalRequired: decision.approvalRequired,
              inspectionDepth: decision.inspectionDepth,
            },
          }),
        ],
      });
    }

    let toolCallsUsed = 0;
    if (shouldRunInspection(input)) {
      const inspectionPass = { ...plannedPasses[2], status: "completed" as const };
      const inspectionsRun: AssemblyPassResult["inspectionsRun"] = [];
      const maxToolCalls = Math.max(0, decision.toolBudgetRequest.grantedToolCalls);
      for (const invocation of input.inspectionInvocations ?? []) {
        if (toolCallsUsed >= maxToolCalls) {
          break;
        }

        const result = input.toolBroker?.invoke(invocation);
        if (!result) {
          continue;
        }

        toolCallsUsed += 1;
        inspectionsRun.push({
          invocationId: invocation.invocationId,
          requestedCapability: invocation.requestedCapability,
          status: result.status,
          selectedToolId: result.selectedTool?.id ?? null,
          executedUnapprovedTool: false,
          recommendedNextCapabilities: [...result.recommendedNextCapabilities],
        });
      }
      passResults.push({
        pass: inspectionPass,
        reusedArtifactIds: [],
        expandedExcerptIds: [],
        inspectionsRun,
        toolCallsUsed,
        contextTokensUsed: 0,
        gaps: [],
        traceEvents: [
          buildTraceEvent({
            type: "pass_completed",
            passName: "approved_synchronous_inspection",
            detail: "Approved synchronous inspection pass completed inside broker/governance limits.",
            metadata: {
              toolCallsUsed,
              grantedToolCalls: decision.toolBudgetRequest.grantedToolCalls,
              selectedToolIds: inspectionsRun.map((inspection) => inspection.selectedToolId),
            },
          }),
        ],
      });
    } else {
      const skippedPass = { ...plannedPasses[2], status: "skipped" as const };
      passResults.push({
        pass: skippedPass,
        reusedArtifactIds: [],
        expandedExcerptIds: [],
        inspectionsRun: [],
        toolCallsUsed: 0,
        contextTokensUsed: 0,
        gaps: [],
        traceEvents: [
          buildTraceEvent({
            type: "pass_skipped",
            passName: "approved_synchronous_inspection",
            detail: skippedPass.detail,
            metadata: {
              approvalRequired: decision.approvalRequired,
              blockedByPolicy: decision.blockedByPolicy,
              hasToolBroker: Boolean(input.toolBroker),
              invocationCount: input.inspectionInvocations?.length ?? 0,
            },
          }),
        ],
      });
    }

    const expandedContextBundle = buildExpandedContextBundle({
      packingResults,
      allowedContextBudgetTokens: decision.contextBudgetRequest.grantedTokens,
    });
    const allCandidates = [
      ...(input.artifactCandidates ?? []),
      ...(input.sourceCandidates ?? []),
      ...(input.rawExcerptCandidates ?? []),
    ];
    const gaps = buildGaps({
      decision,
      packingResults,
      selectedCandidates: expandedContextBundle.selectedCandidates,
      allCandidates,
      toolCallsUsed,
    });
    traceEvents.push(
      ...gaps.map((gap) =>
        buildTraceEvent({
          type: "gap_detected",
          passName: "gap_detection",
          detail: gap.summary,
          metadata: {
            gap,
          },
        })
      )
    );
    passResults.push({
      pass: { ...plannedPasses[3], status: "completed" },
      reusedArtifactIds: [],
      expandedExcerptIds: [],
      inspectionsRun: [],
      toolCallsUsed: 0,
      contextTokensUsed: 0,
      gaps,
      traceEvents: [
        buildTraceEvent({
          type: "pass_completed",
          passName: "gap_detection",
          detail: `Detected ${gaps.length} context gap(s).`,
          metadata: {
            gapKinds: unique(gaps.map((gap) => gap.kind)),
          },
        }),
      ],
    });

    const sufficiency = assessSufficiency({
      decision,
      gaps,
      selectedCandidates: expandedContextBundle.selectedCandidates,
    });
    traceEvents.push(
      buildTraceEvent({
        type: "sufficiency_assessed",
        passName: "sufficiency_assessment",
        detail: `Context sufficiency assessed as ${sufficiency.status}.`,
        metadata: {
          readyForAnswer: sufficiency.readyForAnswer,
          confidence: sufficiency.confidence,
          limitations: sufficiency.limitations,
        },
      })
    );
    passResults.push({
      pass: { ...plannedPasses[4], status: "completed" },
      reusedArtifactIds: [],
      expandedExcerptIds: [],
      inspectionsRun: [],
      toolCallsUsed: 0,
      contextTokensUsed: 0,
      gaps: sufficiency.gaps,
      traceEvents: [
        buildTraceEvent({
          type: "pass_completed",
          passName: "sufficiency_assessment",
          detail: `Sufficiency status: ${sufficiency.status}.`,
          metadata: { sufficiency },
        }),
      ],
    });

    const nextAction = recommendedNextAction({ decision, sufficiency, gaps });
    const stopReason = stopReasonFor({ decision, sufficiency });
    traceEvents.push(
      buildTraceEvent({
        type: "next_action_recommended",
        passName: "next_action_recommendation",
        detail: `Recommended next action: ${nextAction}.`,
        metadata: {
          stopReason,
        },
      })
    );
    passResults.push({
      pass: { ...plannedPasses[5], status: "completed" },
      reusedArtifactIds: [],
      expandedExcerptIds: [],
      inspectionsRun: [],
      toolCallsUsed: 0,
      contextTokensUsed: 0,
      gaps,
      traceEvents: [
        buildTraceEvent({
          type: "pass_completed",
          passName: "next_action_recommendation",
          detail: `Recommended next action: ${nextAction}.`,
          metadata: { stopReason },
        }),
      ],
    });

    const contextDebtCandidates = buildDebtCandidates(gaps);
    const packingTraceEvents = packingResults.flatMap((result) => result.traceEvents);
    const contextBudgetUsedTokens = expandedContextBundle.budgetUsedTokens;
    const contextTransport = planAdaptiveContextTransport({
      request: input.request,
      agentControl: decision,
      availablePayloads: availableTransportPayloads,
      a03PackingResults: packingResults,
    });

    return {
      plan: {
        ...plan,
        passes: plannedPasses.map((pass) => {
          const result = passResults.find((passResult) => passResult.pass.name === pass.name);
          return result?.pass ?? pass;
        }),
        stopReason,
      },
      passResults,
      packingRequests,
      packingResults,
      contextTransport,
      artifactReuseDecisions: buildArtifactReuseDecisions(artifactPackingResult),
      sourceExpansionDecisions: buildSourceExpansionDecisions(rawPackingResult),
      expandedContextBundle,
      gaps,
      contextDebtCandidates,
      sufficiency,
      stopReason,
      recommendedNextAction: nextAction,
      traceEvents,
      packingTraceEvents,
      metrics: {
        contextBudgetUsedTokens,
        contextBudgetRemainingTokens: Math.max(
          0,
          decision.contextBudgetRequest.grantedTokens - contextBudgetUsedTokens
        ),
        toolCallsUsed,
        toolCallsRemaining: Math.max(
          0,
          decision.toolBudgetRequest.grantedToolCalls - toolCallsUsed
        ),
      },
    };
  }
}

export function assembleProgressiveContext(input: ProgressiveContextAssemblyInput) {
  return new ProgressiveContextAssembler().assemble(input);
}
