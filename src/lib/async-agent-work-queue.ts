import type { AgentControlDecision } from "./agent-control-surface";
import type { InspectionCapability } from "./inspection-tool-broker";
import type {
  ContextDebtCandidate,
  ContextGap,
  ProgressiveContextAssemblyResult,
} from "./progressive-context-assembly";
import { prisma } from "./prisma";

export type AsyncAgentWorkStatus =
  | "queued"
  | "planned"
  | "running"
  | "waiting_for_approval"
  | "blocked_by_policy"
  | "completed"
  | "completed_with_limitations"
  | "failed"
  | "cancelled"
  | "superseded";

export type AsyncAgentWorkType =
  | "deep_inspection"
  | "highest_fidelity_ingestion"
  | "context_gap_resolution"
  | "artifact_refresh"
  | "artifact_validation"
  | "source_coverage_expansion"
  | "deliverable_creation_planning"
  | "deferred_capability_review";

export type AsyncAgentWorkPriority = "low" | "normal" | "high" | "urgent";

export type AsyncAgentWorkTrigger =
  | "user_request"
  | "progressive_assembly_recommendation"
  | "context_debt_candidate"
  | "artifact_stale"
  | "weak_artifact"
  | "source_changed"
  | "manual_debug_action";

export type AsyncAgentWorkStep =
  | "reuse_existing_artifacts"
  | "expand_source_context"
  | "run_approved_builtin_inspection"
  | "create_or_update_artifacts"
  | "assess_sufficiency"
  | "record_deferred_capability"
  | "prepare_approval_packet"
  | "stop_blocked_by_policy";

export type AsyncAgentWorkPlanStepStatus =
  | "planned"
  | "running"
  | "completed"
  | "skipped"
  | "deferred"
  | "blocked";

export type AsyncAgentWorkTraceEventType =
  | "work_item_created"
  | "status_transitioned"
  | "plan_created"
  | "step_started"
  | "step_completed"
  | "step_skipped"
  | "step_deferred"
  | "blocked_by_policy"
  | "waiting_for_approval"
  | "deferred_capability_recorded"
  | "artifact_link_recorded"
  | "source_link_recorded"
  | "work_completed"
  | "work_failed";

export type AsyncAgentWorkTraceEvent = {
  type: AsyncAgentWorkTraceEventType;
  timestamp: string;
  status: AsyncAgentWorkStatus;
  step: AsyncAgentWorkStep | null;
  detail: string;
  metadata: Record<string, unknown> | null;
};

export type AsyncAgentWorkPlanStep = {
  step: AsyncAgentWorkStep;
  status: AsyncAgentWorkPlanStepStatus;
  detail: string;
  requiresApproval: boolean;
  blockedByPolicy: boolean;
  capabilities: InspectionCapability[];
  executedToolIds: string[];
  deferredCapabilities: InspectionCapability[];
};

export type AsyncAgentWorkPlan = {
  planId: string;
  workType: AsyncAgentWorkType;
  summary: string;
  createdFrom: {
    controlDecisionId: string;
    assemblyPlanId: string | null;
    recommendedNextAction: string | null;
  };
  steps: AsyncAgentWorkPlanStep[];
  limitations: string[];
};

export type AsyncAgentWorkResumePolicy = {
  mode: "manual" | "resume_when_approved" | "resume_when_capability_available";
  reason: string;
};

export type AsyncAgentWorkRetryPolicy = {
  maxAttempts: number;
  retryable: boolean;
  reason: string;
};

export type AsyncAgentWorkBudgetSnapshot = {
  runtimeBudgetProfile: AgentControlDecision["runtimeBudgetProfile"];
  contextBudgetRequest: AgentControlDecision["contextBudgetRequest"];
  outputBudgetRequest: AgentControlDecision["outputBudgetRequest"];
  toolBudgetRequest: AgentControlDecision["toolBudgetRequest"];
  runtimeBudgetRequest: AgentControlDecision["runtimeBudgetRequest"];
  sourceCoverageTarget: AgentControlDecision["sourceCoverageTarget"];
  memoryDensity: AgentControlDecision["memoryDensity"];
  validationDepth: AgentControlDecision["validationDepth"];
  creationDepth: AgentControlDecision["creationDepth"];
};

export type AsyncAgentWorkControlSnapshot = {
  decisionId: string;
  taskFidelityLevel: AgentControlDecision["taskFidelityLevel"];
  executionMode: AgentControlDecision["executionMode"];
  approvalRequired: boolean;
  approvalRequiredReasons: string[];
  asyncRecommended: boolean;
  asyncRecommendedReason: string | null;
  blockedByPolicy: boolean;
  blockedByPolicyReasons: string[];
  externalEscalation: AgentControlDecision["externalEscalation"];
  toolGovernance: AgentControlDecision["toolGovernance"];
  hardBoundariesApplied: AgentControlDecision["hardBoundariesApplied"];
  policyConfiguredLimitsApplied: AgentControlDecision["policyConfiguredLimitsApplied"];
  sourceFreshness: AgentControlDecision["sourceFreshness"];
  controlTrace: AgentControlDecision["traceEvents"];
  decision: AgentControlDecision;
};

export type AsyncAgentWorkAssemblySnapshot = {
  plan: ProgressiveContextAssemblyResult["plan"];
  sufficiency: ProgressiveContextAssemblyResult["sufficiency"];
  stopReason: ProgressiveContextAssemblyResult["stopReason"];
  recommendedNextAction: ProgressiveContextAssemblyResult["recommendedNextAction"];
  metrics: ProgressiveContextAssemblyResult["metrics"];
  contextDebtCandidates: ContextDebtCandidate[];
  selectedArtifactIds: string[];
  selectedSourceIds: string[];
  selectedInspectionResultIds: string[];
  passResults: Array<{
    passName: string;
    status: string;
    reusedArtifactIds: string[];
    expandedExcerptIds: string[];
    inspectionsRun: Array<{
      invocationId: string;
      requestedCapability: InspectionCapability;
      status: string;
      selectedToolId: string | null;
      executedUnapprovedTool: false;
      recommendedNextCapabilities: InspectionCapability[];
    }>;
  }>;
  traceEvents: ProgressiveContextAssemblyResult["traceEvents"];
};

export type AsyncAgentWorkContextGapSnapshot = ContextGap & {
  futureRegistryPersistenceRecommended: boolean;
};

export type AsyncAgentWorkDeferredCapability = {
  capability: InspectionCapability;
  sourceId: string | null;
  gapId: string | null;
  reason: string;
  requiresApproval: boolean;
  asyncRecommended: boolean;
  executed: false;
  executionClaimed: false;
  futureToolingRecommended: boolean;
};

export type AsyncAgentWorkArtifactLink = {
  artifactKey: string | null;
  artifactId: string | null;
  sourceId: string | null;
  linkType: "created" | "reused" | "validated" | "affected";
  detail: string;
};

export type AsyncAgentWorkSourceLink = {
  sourceId: string;
  sourceType: string | null;
  conversationDocumentId: string | null;
  coverageTarget: AgentControlDecision["sourceCoverageTarget"];
  gapIds: string[];
  debtCandidateIds: string[];
};

export type AsyncAgentWorkFailure = {
  code: string;
  message: string;
  retryable: boolean;
  detail: string | null;
};

export type AsyncAgentWorkResult = {
  status: AsyncAgentWorkStatus;
  summary: string;
  limitations: string[];
  executedSteps: AsyncAgentWorkStep[];
  skippedSteps: AsyncAgentWorkStep[];
  deferredCapabilities: AsyncAgentWorkDeferredCapability[];
  artifactLinks: AsyncAgentWorkArtifactLink[];
  sourceLinks: AsyncAgentWorkSourceLink[];
  createdArtifactKeys: string[];
  reusedArtifactKeys: string[];
  linkedInspectionTaskKeys: string[];
  executedToolIds: string[];
  executedUnapprovedTool: false;
  executedUnavailableCapabilities: InspectionCapability[];
  unavailableToolExecutionClaimed: false;
  approvalBlockers: string[];
  policyBlockers: string[];
};

export type AsyncAgentWorkItem = {
  id: string;
  workKey: string;
  idempotencyKey: string;
  conversationId: string | null;
  conversationDocumentId: string | null;
  createdById: string | null;
  status: AsyncAgentWorkStatus;
  type: AsyncAgentWorkType;
  trigger: AsyncAgentWorkTrigger;
  priority: AsyncAgentWorkPriority;
  plan: AsyncAgentWorkPlan;
  resumePolicy: AsyncAgentWorkResumePolicy;
  retryPolicy: AsyncAgentWorkRetryPolicy;
  budgetSnapshot: AsyncAgentWorkBudgetSnapshot;
  controlSnapshot: AsyncAgentWorkControlSnapshot;
  assemblySnapshot: AsyncAgentWorkAssemblySnapshot | null;
  contextGapSnapshots: AsyncAgentWorkContextGapSnapshot[];
  deferredCapabilities: AsyncAgentWorkDeferredCapability[];
  artifactLinks: AsyncAgentWorkArtifactLink[];
  sourceLinks: AsyncAgentWorkSourceLink[];
  result: AsyncAgentWorkResult | null;
  failure: AsyncAgentWorkFailure | null;
  traceEvents: AsyncAgentWorkTraceEvent[];
  createdAt: string;
  updatedAt: string;
  completedAt: string | null;
};

export type AsyncAgentWorkDebugSnapshot = {
  workItemId: string;
  workKey: string;
  status: AsyncAgentWorkStatus;
  type: AsyncAgentWorkType;
  trigger: AsyncAgentWorkTrigger;
  priority: AsyncAgentWorkPriority;
  controlSnapshot: AsyncAgentWorkControlSnapshot;
  assemblySnapshot: AsyncAgentWorkAssemblySnapshot | null;
  contextGapSnapshots: AsyncAgentWorkContextGapSnapshot[];
  plannedSteps: AsyncAgentWorkPlanStep[];
  executedSteps: AsyncAgentWorkStep[];
  skippedOrDeferredSteps: AsyncAgentWorkStep[];
  deferredCapabilities: AsyncAgentWorkDeferredCapability[];
  artifactLinks: AsyncAgentWorkArtifactLink[];
  sourceLinks: AsyncAgentWorkSourceLink[];
  completionState: AsyncAgentWorkResult | null;
  limitations: string[];
  policyBlockers: string[];
  approvalBlockers: string[];
  noUnavailableToolExecutionClaimed: true;
  traceEvents: AsyncAgentWorkTraceEvent[];
};

type CreateAsyncAgentWorkItemParams = {
  conversationId?: string | null;
  conversationDocumentId?: string | null;
  createdById?: string | null;
  request?: string | null;
  controlDecision: AgentControlDecision;
  assembly?: ProgressiveContextAssemblyResult | null;
  trigger?: AsyncAgentWorkTrigger;
  priority?: AsyncAgentWorkPriority;
  now?: () => Date;
};

type AsyncAgentWorkPrismaRecord = {
  id: string;
  workKey: string;
  conversationId: string | null;
  conversationDocumentId: string | null;
  createdById: string | null;
  status: string;
  type: string;
  trigger: string;
  priority: string;
  planJson: string;
  resumePolicyJson: string;
  retryPolicyJson: string;
  budgetSnapshotJson: string;
  controlSnapshotJson: string;
  assemblySnapshotJson: string | null;
  contextGapsJson: string;
  deferredCapabilitiesJson: string;
  artifactLinksJson: string;
  sourceLinksJson: string;
  resultJson: string | null;
  traceJson: string;
  errorJson: string | null;
  createdAt: Date;
  updatedAt: Date;
  completedAt: Date | null;
};

type AsyncAgentWorkPrismaClient = {
  asyncAgentWorkItem: {
    upsert: (params: {
      where: { workKey: string };
      create: Record<string, unknown>;
      update: Record<string, unknown>;
    }) => Promise<AsyncAgentWorkPrismaRecord>;
  };
};

const VALID_STATUS_TRANSITIONS: Record<AsyncAgentWorkStatus, AsyncAgentWorkStatus[]> = {
  queued: ["planned", "running", "waiting_for_approval", "blocked_by_policy", "cancelled", "superseded", "failed"],
  planned: ["running", "waiting_for_approval", "blocked_by_policy", "cancelled", "superseded", "failed"],
  running: ["completed", "completed_with_limitations", "waiting_for_approval", "blocked_by_policy", "failed", "cancelled"],
  waiting_for_approval: ["planned", "running", "cancelled", "superseded", "blocked_by_policy"],
  blocked_by_policy: ["cancelled", "superseded"],
  completed: ["superseded"],
  completed_with_limitations: ["superseded"],
  failed: ["queued", "cancelled", "superseded"],
  cancelled: [],
  superseded: [],
};

const UNAVAILABLE_EXTERNAL_CAPABILITIES = new Set<InspectionCapability>([
  "rendered_page_inspection",
  "ocr",
  "vision_page_understanding",
  "document_ai_table_recovery",
  "web_snapshot",
  "source_connector_read",
  "code_repository_inspection",
]);

function nowIso(now: () => Date = () => new Date()) {
  return now().toISOString();
}

function traceEvent(params: {
  type: AsyncAgentWorkTraceEventType;
  status: AsyncAgentWorkStatus;
  step?: AsyncAgentWorkStep | null;
  detail: string;
  metadata?: Record<string, unknown> | null;
  now?: () => Date;
}): AsyncAgentWorkTraceEvent {
  return {
    type: params.type,
    timestamp: nowIso(params.now),
    status: params.status,
    step: params.step ?? null,
    detail: params.detail,
    metadata: params.metadata ?? null,
  };
}

function unique<T>(values: T[]) {
  return Array.from(new Set(values));
}

function json(value: unknown) {
  return JSON.stringify(value ?? null);
}

function parseJson<T>(value: string | null | undefined, fallback: T): T {
  if (!value?.trim()) {
    return fallback;
  }

  try {
    return JSON.parse(value) as T;
  } catch {
    return fallback;
  }
}

function normalizeKeySegment(value: string | null | undefined) {
  return (value ?? "none")
    .trim()
    .replace(/[^a-zA-Z0-9:_-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 96) || "none";
}

function buildWorkKey(params: {
  conversationId: string | null;
  conversationDocumentId: string | null;
  controlDecision: AgentControlDecision;
  assembly: ProgressiveContextAssemblyResult | null;
  type: AsyncAgentWorkType;
  trigger: AsyncAgentWorkTrigger;
}) {
  return [
    "async-agent-work",
    normalizeKeySegment(params.conversationId),
    normalizeKeySegment(params.conversationDocumentId),
    normalizeKeySegment(params.controlDecision.decisionId),
    normalizeKeySegment(params.assembly?.plan.id ?? null),
    params.type,
    params.trigger,
  ].join(":");
}

function initialStatus(decision: AgentControlDecision): AsyncAgentWorkStatus {
  if (decision.blockedByPolicy) {
    return "blocked_by_policy";
  }

  if (decision.approvalRequired || decision.executionMode === "approval_required") {
    return "waiting_for_approval";
  }

  return "queued";
}

function deriveWorkType(params: {
  decision: AgentControlDecision;
  assembly: ProgressiveContextAssemblyResult | null;
}): AsyncAgentWorkType {
  const gaps = params.assembly?.gaps ?? [];

  if (params.decision.taskFidelityLevel === "highest_fidelity_ingestion") {
    return "highest_fidelity_ingestion";
  }

  if (params.decision.taskFidelityLevel === "highest_fidelity_creation") {
    return "deliverable_creation_planning";
  }

  if (params.decision.memoryRefreshDepth === "refresh_stale_artifacts") {
    return "artifact_refresh";
  }

  if (gaps.some((gap) => gap.kind === "missing_table_body" || gap.kind === "raw_parser_output_insufficient")) {
    return "context_gap_resolution";
  }

  if (gaps.some((gap) => gap.kind === "insufficient_source_coverage")) {
    return "source_coverage_expansion";
  }

  if (params.decision.toolGovernance.unmetCapabilities.length > 0 || params.decision.externalEscalation.capabilities.length > 0) {
    return "deferred_capability_review";
  }

  if (params.decision.validationDepth !== "none") {
    return "artifact_validation";
  }

  return "deep_inspection";
}

function deriveTrigger(params: {
  decision: AgentControlDecision;
  assembly: ProgressiveContextAssemblyResult | null;
  requestedTrigger?: AsyncAgentWorkTrigger;
}): AsyncAgentWorkTrigger {
  if (params.requestedTrigger) {
    return params.requestedTrigger;
  }

  if (params.assembly?.recommendedNextAction === "recommend_async_job" || params.decision.asyncRecommended) {
    return "progressive_assembly_recommendation";
  }

  if ((params.assembly?.contextDebtCandidates.length ?? 0) > 0) {
    return "context_debt_candidate";
  }

  if (params.decision.sourceFreshness.staleSourceIds.length > 0) {
    return "artifact_stale";
  }

  if (params.decision.sourceFreshness.weakArtifactSourceIds.length > 0) {
    return "weak_artifact";
  }

  return "user_request";
}

function derivePriority(params: {
  decision: AgentControlDecision;
  assembly: ProgressiveContextAssemblyResult | null;
  requestedPriority?: AsyncAgentWorkPriority;
}): AsyncAgentWorkPriority {
  if (params.requestedPriority) {
    return params.requestedPriority;
  }

  if (params.decision.blockedByPolicy || params.decision.approvalRequired) {
    return "high";
  }

  if (params.decision.taskFidelityLevel === "highest_fidelity_ingestion" || params.decision.taskFidelityLevel === "highest_fidelity_creation") {
    return "high";
  }

  if ((params.assembly?.contextDebtCandidates ?? []).some((candidate) => candidate.priority === "high")) {
    return "high";
  }

  return "normal";
}

function budgetSnapshot(decision: AgentControlDecision): AsyncAgentWorkBudgetSnapshot {
  return {
    runtimeBudgetProfile: decision.runtimeBudgetProfile,
    contextBudgetRequest: decision.contextBudgetRequest,
    outputBudgetRequest: decision.outputBudgetRequest,
    toolBudgetRequest: decision.toolBudgetRequest,
    runtimeBudgetRequest: decision.runtimeBudgetRequest,
    sourceCoverageTarget: decision.sourceCoverageTarget,
    memoryDensity: decision.memoryDensity,
    validationDepth: decision.validationDepth,
    creationDepth: decision.creationDepth,
  };
}

function controlSnapshot(decision: AgentControlDecision): AsyncAgentWorkControlSnapshot {
  return {
    decisionId: decision.decisionId,
    taskFidelityLevel: decision.taskFidelityLevel,
    executionMode: decision.executionMode,
    approvalRequired: decision.approvalRequired,
    approvalRequiredReasons: [...decision.approvalRequiredReasons],
    asyncRecommended: decision.asyncRecommended,
    asyncRecommendedReason: decision.asyncRecommendedReason,
    blockedByPolicy: decision.blockedByPolicy,
    blockedByPolicyReasons: [...decision.blockedByPolicyReasons],
    externalEscalation: {
      ...decision.externalEscalation,
      capabilities: [...decision.externalEscalation.capabilities],
    },
    toolGovernance: {
      ...decision.toolGovernance,
      recommendedCapabilities: [...decision.toolGovernance.recommendedCapabilities],
      unmetCapabilities: [...decision.toolGovernance.unmetCapabilities],
    },
    hardBoundariesApplied: decision.hardBoundariesApplied.map((boundary) => ({ ...boundary })),
    policyConfiguredLimitsApplied: decision.policyConfiguredLimitsApplied.map((limit) => ({ ...limit })),
    sourceFreshness: {
      ...decision.sourceFreshness,
      staleSourceIds: [...decision.sourceFreshness.staleSourceIds],
      weakArtifactSourceIds: [...decision.sourceFreshness.weakArtifactSourceIds],
    },
    controlTrace: decision.traceEvents.map((event) => ({ ...event })),
    decision,
  };
}

function assemblySnapshot(assembly: ProgressiveContextAssemblyResult | null): AsyncAgentWorkAssemblySnapshot | null {
  if (!assembly) {
    return null;
  }

  return {
    plan: assembly.plan,
    sufficiency: assembly.sufficiency,
    stopReason: assembly.stopReason,
    recommendedNextAction: assembly.recommendedNextAction,
    metrics: assembly.metrics,
    contextDebtCandidates: assembly.contextDebtCandidates.map((candidate) => ({ ...candidate })),
    selectedArtifactIds: [...assembly.expandedContextBundle.selectedArtifactIds],
    selectedSourceIds: [...assembly.expandedContextBundle.selectedSourceIds],
    selectedInspectionResultIds: [...assembly.expandedContextBundle.selectedInspectionResultIds],
    passResults: assembly.passResults.map((result) => ({
      passName: result.pass.name,
      status: result.pass.status,
      reusedArtifactIds: [...result.reusedArtifactIds],
      expandedExcerptIds: [...result.expandedExcerptIds],
      inspectionsRun: result.inspectionsRun.map((inspection) => ({
        invocationId: inspection.invocationId,
        requestedCapability: inspection.requestedCapability,
        status: inspection.status,
        selectedToolId: inspection.selectedToolId,
        executedUnapprovedTool: false,
        recommendedNextCapabilities: [...inspection.recommendedNextCapabilities],
      })),
    })),
    traceEvents: assembly.traceEvents.map((event) => ({ ...event })),
  };
}

function contextGapSnapshots(assembly: ProgressiveContextAssemblyResult | null): AsyncAgentWorkContextGapSnapshot[] {
  return (assembly?.gaps ?? []).map((gap) => ({
    ...gap,
    recommendedCapabilities: [...gap.recommendedCapabilities],
    futureRegistryPersistenceRecommended:
      gap.asyncRecommended ||
      gap.kind === "missing_table_body" ||
      gap.kind === "insufficient_source_coverage" ||
      gap.kind === "raw_parser_output_insufficient",
  }));
}

function capabilityReason(gap: ContextGap | null, decision: AgentControlDecision) {
  if (gap) {
    return gap.summary;
  }

  if (decision.externalEscalation.capabilities.length > 0) {
    return decision.externalEscalation.detail;
  }

  return decision.toolGovernance.detail;
}

function collectDeferredCapabilities(params: {
  decision: AgentControlDecision;
  assembly: ProgressiveContextAssemblyResult | null;
}): AsyncAgentWorkDeferredCapability[] {
  const entries = new Map<string, AsyncAgentWorkDeferredCapability>();
  const gaps = params.assembly?.gaps ?? [];

  function add(capability: InspectionCapability, gap: ContextGap | null) {
    if (!UNAVAILABLE_EXTERNAL_CAPABILITIES.has(capability) && !params.decision.toolGovernance.unmetCapabilities.includes(capability)) {
      return;
    }

    const key = `${capability}:${gap?.id ?? "control"}`;
    entries.set(key, {
      capability,
      sourceId: gap?.sourceId ?? null,
      gapId: gap?.id ?? null,
      reason: capabilityReason(gap, params.decision),
      requiresApproval:
        gap?.requiresApproval ??
        (params.decision.approvalRequired ||
          params.decision.externalEscalation.level === "approval_required"),
      asyncRecommended: gap?.asyncRecommended ?? params.decision.asyncRecommended,
      executed: false,
      executionClaimed: false,
      futureToolingRecommended: true,
    });
  }

  for (const capability of params.decision.externalEscalation.capabilities) {
    add(capability, null);
  }

  for (const capability of params.decision.toolGovernance.unmetCapabilities) {
    add(capability, null);
  }

  for (const gap of gaps) {
    if (gap.requiredCapability) {
      add(gap.requiredCapability, gap);
    }
    for (const capability of gap.recommendedCapabilities) {
      add(capability, gap);
    }
    const unavailable = Array.isArray(gap.metadata?.unavailableCapabilities)
      ? gap.metadata.unavailableCapabilities
      : [];
    for (const capability of unavailable) {
      if (typeof capability === "string") {
        add(capability as InspectionCapability, gap);
      }
    }
  }

  return [...entries.values()].sort((left, right) =>
    left.capability.localeCompare(right.capability) ||
    (left.gapId ?? "").localeCompare(right.gapId ?? "")
  );
}

function artifactKeyFromCandidateId(id: string) {
  const marker = ":artifact:";
  const index = id.indexOf(marker);
  return index >= 0 ? id.slice(index + marker.length) : null;
}

function artifactLinks(assembly: ProgressiveContextAssemblyResult | null): AsyncAgentWorkArtifactLink[] {
  if (!assembly) {
    return [];
  }

  const selected = assembly.expandedContextBundle.selectedArtifactIds;
  const links = selected.map((artifactId) => ({
    artifactId,
    artifactKey: artifactKeyFromCandidateId(artifactId),
    sourceId:
      assembly.expandedContextBundle.selectedCandidates.find((candidate) => candidate.id === artifactId)?.sourceId ?? null,
    linkType: "reused" as const,
    detail: "Async work item preserves the artifact reused by progressive context assembly.",
  }));

  return links;
}

function sourceLinks(params: {
  conversationDocumentId: string | null;
  decision: AgentControlDecision;
  assembly: ProgressiveContextAssemblyResult | null;
}): AsyncAgentWorkSourceLink[] {
  const sourceIds = unique([
    ...(params.assembly?.expandedContextBundle.selectedSourceIds ?? []),
    ...(params.assembly?.gaps ?? []).map((gap) => gap.sourceId).filter((value): value is string => Boolean(value)),
    ...(params.assembly?.contextDebtCandidates ?? []).map((candidate) => candidate.sourceId).filter((value): value is string => Boolean(value)),
    ...params.decision.sourceFreshness.staleSourceIds,
    ...params.decision.sourceFreshness.weakArtifactSourceIds,
    ...(params.conversationDocumentId ? [params.conversationDocumentId] : []),
  ]);

  return sourceIds.map((sourceId) => ({
    sourceId,
    sourceType:
      params.assembly?.expandedContextBundle.selectedCandidates.find((candidate) => candidate.sourceId === sourceId)?.sourceType ??
      null,
    conversationDocumentId: sourceId === params.conversationDocumentId ? params.conversationDocumentId : null,
    coverageTarget: params.decision.sourceCoverageTarget,
    gapIds: (params.assembly?.gaps ?? []).filter((gap) => gap.sourceId === sourceId).map((gap) => gap.id),
    debtCandidateIds: (params.assembly?.contextDebtCandidates ?? [])
      .filter((candidate) => candidate.sourceId === sourceId)
      .map((candidate) => candidate.id),
  }));
}

function planLimitations(params: {
  decision: AgentControlDecision;
  assembly: ProgressiveContextAssemblyResult | null;
  deferredCapabilities: AsyncAgentWorkDeferredCapability[];
}) {
  return unique([
    ...(params.assembly?.sufficiency.limitations ?? []),
    ...params.decision.defaultBudgetInsufficiencyReasons,
    ...params.decision.blockedByPolicyReasons,
    ...params.decision.approvalRequiredReasons.map((reason) => `Approval required: ${reason}.`),
    ...params.deferredCapabilities.map((entry) => `Deferred capability: ${entry.capability}.`),
  ]);
}

function buildStep(params: {
  step: AsyncAgentWorkStep;
  detail: string;
  decision: AgentControlDecision;
  capabilities?: InspectionCapability[];
  deferredCapabilities?: InspectionCapability[];
  blockedByPolicy?: boolean;
  requiresApproval?: boolean;
  status?: AsyncAgentWorkPlanStepStatus;
}): AsyncAgentWorkPlanStep {
  return {
    step: params.step,
    status: params.status ?? "planned",
    detail: params.detail,
    requiresApproval: params.requiresApproval ?? params.decision.approvalRequired,
    blockedByPolicy: params.blockedByPolicy ?? params.decision.blockedByPolicy,
    capabilities: unique(params.capabilities ?? []),
    executedToolIds: [],
    deferredCapabilities: unique(params.deferredCapabilities ?? []),
  };
}

function buildPlan(params: {
  type: AsyncAgentWorkType;
  decision: AgentControlDecision;
  assembly: ProgressiveContextAssemblyResult | null;
  deferredCapabilities: AsyncAgentWorkDeferredCapability[];
}) {
  const steps: AsyncAgentWorkPlanStep[] = [];

  if (params.decision.blockedByPolicy) {
    steps.push(
      buildStep({
        step: "stop_blocked_by_policy",
        detail: "Agent Control Surface blocked this work item; no execution steps are permitted.",
        decision: params.decision,
        blockedByPolicy: true,
        requiresApproval: false,
        status: "blocked",
      })
    );
  } else if (params.decision.approvalRequired || params.decision.executionMode === "approval_required") {
    steps.push(
      buildStep({
        step: "prepare_approval_packet",
        detail: "Prepare a lightweight approval packet and wait; restricted work is not executed.",
        decision: params.decision,
        requiresApproval: true,
        status: "planned",
      })
    );
  } else {
    steps.push(
      buildStep({
        step: "reuse_existing_artifacts",
        detail: "Reuse durable knowledge artifacts selected by progressive context assembly.",
        decision: params.decision,
        requiresApproval: false,
      }),
      buildStep({
        step: "expand_source_context",
        detail: "Preserve selected source coverage from A-04e without exceeding its granted context boundary.",
        decision: params.decision,
        requiresApproval: false,
      }),
      buildStep({
        step: "run_approved_builtin_inspection",
        detail: "Run no unavailable tools; v1 only executes approved built-in work if an explicit safe adapter is present.",
        decision: params.decision,
        capabilities: params.assembly?.passResults.flatMap((result) =>
          result.inspectionsRun.map((inspection) => inspection.requestedCapability)
        ),
        deferredCapabilities: params.deferredCapabilities.map((entry) => entry.capability),
        requiresApproval: false,
      }),
      buildStep({
        step: "create_or_update_artifacts",
        detail: "Link created/reused KnowledgeArtifacts or InspectionTasks through existing document intelligence paths.",
        decision: params.decision,
        requiresApproval: false,
      }),
      buildStep({
        step: "assess_sufficiency",
        detail: "Record whether the work can complete truthfully with available context and approved built-ins.",
        decision: params.decision,
        requiresApproval: false,
      })
    );

    if (params.deferredCapabilities.length > 0) {
      steps.push(
        buildStep({
          step: "record_deferred_capability",
          detail: "Record unavailable or approval-gated capabilities without claiming execution.",
          decision: params.decision,
          deferredCapabilities: params.deferredCapabilities.map((entry) => entry.capability),
          requiresApproval: false,
        })
      );
    }
  }

  const limitations = planLimitations({
    decision: params.decision,
    assembly: params.assembly,
    deferredCapabilities: params.deferredCapabilities,
  });

  return {
    planId: `async-plan:${params.decision.decisionId}`,
    workType: params.type,
    summary: buildPlanSummary(params.type, params.decision),
    createdFrom: {
      controlDecisionId: params.decision.decisionId,
      assemblyPlanId: params.assembly?.plan.id ?? null,
      recommendedNextAction: params.assembly?.recommendedNextAction ?? null,
    },
    steps,
    limitations,
  } satisfies AsyncAgentWorkPlan;
}

function buildPlanSummary(type: AsyncAgentWorkType, decision: AgentControlDecision) {
  if (type === "highest_fidelity_ingestion") {
    return `Plan highest-fidelity ingestion inside ${decision.runtimeBudgetProfile} boundaries.`;
  }

  if (type === "deliverable_creation_planning") {
    return `Plan deliverable-grade creation with ${decision.creationDepth} creation and ${decision.validationDepth} validation.`;
  }

  if (type === "context_gap_resolution") {
    return "Plan context gap resolution while preserving deferred capability records.";
  }

  if (type === "source_coverage_expansion") {
    return `Plan source coverage expansion toward ${decision.sourceCoverageTarget}.`;
  }

  if (type === "artifact_refresh") {
    return "Plan artifact refresh for stale or weak document memory.";
  }

  if (type === "deferred_capability_review") {
    return "Plan deferred capability review without running unapproved tools.";
  }

  return "Plan deep inspection within approved built-in boundaries.";
}

function resumePolicy(decision: AgentControlDecision): AsyncAgentWorkResumePolicy {
  if (decision.blockedByPolicy) {
    return {
      mode: "manual",
      reason: "Blocked work requires a policy change or narrower user request before it can resume.",
    };
  }

  if (decision.approvalRequired) {
    return {
      mode: "resume_when_approved",
      reason: "The work item can resume only after approval-required controls are granted.",
    };
  }

  return {
    mode: "resume_when_capability_available",
    reason: "Deferred capabilities can be resumed when a future approved broker tool exists.",
  };
}

function retryPolicy(decision: AgentControlDecision): AsyncAgentWorkRetryPolicy {
  return {
    maxAttempts: decision.blockedByPolicy || decision.approvalRequired ? 0 : 1,
    retryable: false,
    reason: "A-04f v1 uses deterministic local lifecycle steps and does not retry unavailable tools.",
  };
}

export function shouldCreateAsyncAgentWorkItem(params: {
  controlDecision: AgentControlDecision;
  assembly?: ProgressiveContextAssemblyResult | null;
}) {
  const assembly = params.assembly ?? null;
  const decision = params.controlDecision;

  return (
    decision.asyncRecommended ||
    decision.approvalRequired ||
    decision.blockedByPolicy ||
    decision.taskFidelityLevel === "highest_fidelity_ingestion" ||
    decision.taskFidelityLevel === "highest_fidelity_creation" ||
    assembly?.recommendedNextAction === "recommend_async_job" ||
    assembly?.recommendedNextAction === "request_approval" ||
    assembly?.recommendedNextAction === "stop_blocked_by_policy" ||
    (assembly?.contextDebtCandidates.length ?? 0) > 0 ||
    (assembly?.gaps ?? []).some((gap) =>
      gap.asyncRecommended ||
      gap.kind === "missing_table_body" ||
      gap.kind === "insufficient_source_coverage" ||
      gap.kind === "raw_parser_output_insufficient"
    )
  );
}

export function createAsyncAgentWorkItemFromControlDecision(params: CreateAsyncAgentWorkItemParams): AsyncAgentWorkItem {
  return createAsyncAgentWorkItem({
    ...params,
    assembly: params.assembly ?? null,
  });
}

export function createAsyncAgentWorkItemFromProgressiveAssembly(params: CreateAsyncAgentWorkItemParams & {
  assembly: ProgressiveContextAssemblyResult;
}): AsyncAgentWorkItem {
  return createAsyncAgentWorkItem(params);
}

export function planAsyncAgentWorkItems(params: CreateAsyncAgentWorkItemParams): AsyncAgentWorkItem[] {
  if (!shouldCreateAsyncAgentWorkItem({
    controlDecision: params.controlDecision,
    assembly: params.assembly ?? null,
  })) {
    return [];
  }

  return [createAsyncAgentWorkItem(params)];
}

function createAsyncAgentWorkItem(params: CreateAsyncAgentWorkItemParams): AsyncAgentWorkItem {
  const assembly = params.assembly ?? null;
  const type = deriveWorkType({ decision: params.controlDecision, assembly });
  const trigger = deriveTrigger({
    decision: params.controlDecision,
    assembly,
    requestedTrigger: params.trigger,
  });
  const priority = derivePriority({
    decision: params.controlDecision,
    assembly,
    requestedPriority: params.priority,
  });
  const status = initialStatus(params.controlDecision);
  const deferredCapabilities = collectDeferredCapabilities({
    decision: params.controlDecision,
    assembly,
  });
  const plan = buildPlan({
    type,
    decision: params.controlDecision,
    assembly,
    deferredCapabilities,
  });
  const createdAt = nowIso(params.now);
  const workKey = buildWorkKey({
    conversationId: params.conversationId ?? null,
    conversationDocumentId: params.conversationDocumentId ?? null,
    controlDecision: params.controlDecision,
    assembly,
    type,
    trigger,
  });
  const workItem: AsyncAgentWorkItem = {
    id: workKey,
    workKey,
    idempotencyKey: workKey,
    conversationId: params.conversationId ?? null,
    conversationDocumentId: params.conversationDocumentId ?? null,
    createdById: params.createdById ?? null,
    status,
    type,
    trigger,
    priority,
    plan,
    resumePolicy: resumePolicy(params.controlDecision),
    retryPolicy: retryPolicy(params.controlDecision),
    budgetSnapshot: budgetSnapshot(params.controlDecision),
    controlSnapshot: controlSnapshot(params.controlDecision),
    assemblySnapshot: assemblySnapshot(assembly),
    contextGapSnapshots: contextGapSnapshots(assembly),
    deferredCapabilities,
    artifactLinks: artifactLinks(assembly),
    sourceLinks: sourceLinks({
      conversationDocumentId: params.conversationDocumentId ?? null,
      decision: params.controlDecision,
      assembly,
    }),
    result: null,
    failure: null,
    traceEvents: [
      traceEvent({
        type: "work_item_created",
        status,
        detail: "Async Agent Work Queue item created from Agent Control and Progressive Context Assembly snapshots.",
        metadata: {
          type,
          trigger,
          priority,
          requestPreview: params.request?.slice(0, 160) ?? null,
        },
        now: params.now,
      }),
      traceEvent({
        type: "plan_created",
        status,
        detail: plan.summary,
        metadata: {
          plannedSteps: plan.steps.map((step) => step.step),
          limitations: plan.limitations,
        },
        now: params.now,
      }),
    ],
    createdAt,
    updatedAt: createdAt,
    completedAt: null,
  };

  if (status === "waiting_for_approval") {
    workItem.traceEvents.push(
      traceEvent({
        type: "waiting_for_approval",
        status,
        step: "prepare_approval_packet",
        detail: "Approval-required work item created; restricted steps were not executed.",
        metadata: {
          approvalRequiredReasons: params.controlDecision.approvalRequiredReasons,
          approvalPacketDraft: params.controlDecision.approvalPacketDraft,
        },
        now: params.now,
      })
    );
  }

  if (status === "blocked_by_policy") {
    workItem.traceEvents.push(
      traceEvent({
        type: "blocked_by_policy",
        status,
        step: "stop_blocked_by_policy",
        detail: params.controlDecision.blockedByPolicyReasons.join(" ") || "Blocked by policy.",
        metadata: {
          blockedByPolicyReasons: params.controlDecision.blockedByPolicyReasons,
        },
        now: params.now,
      })
    );
  }

  return workItem;
}

export function canTransitionAsyncAgentWorkStatus(
  from: AsyncAgentWorkStatus,
  to: AsyncAgentWorkStatus
) {
  return from === to || VALID_STATUS_TRANSITIONS[from].includes(to);
}

export function transitionAsyncAgentWorkStatus(
  item: AsyncAgentWorkItem,
  nextStatus: AsyncAgentWorkStatus,
  params: { detail?: string; now?: () => Date } = {}
): AsyncAgentWorkItem {
  if (!canTransitionAsyncAgentWorkStatus(item.status, nextStatus)) {
    throw new Error(`Invalid AsyncAgentWorkStatus transition: ${item.status} -> ${nextStatus}`);
  }

  const timestamp = nowIso(params.now);

  return {
    ...item,
    status: nextStatus,
    updatedAt: timestamp,
    completedAt:
      nextStatus === "completed" || nextStatus === "completed_with_limitations" || nextStatus === "failed"
        ? timestamp
        : item.completedAt,
    traceEvents: [
      ...item.traceEvents,
      traceEvent({
        type: "status_transitioned",
        status: nextStatus,
        detail: params.detail ?? `Status transitioned from ${item.status} to ${nextStatus}.`,
        metadata: {
          from: item.status,
          to: nextStatus,
        },
        now: params.now,
      }),
    ],
  };
}

function updatePlanStep(
  steps: AsyncAgentWorkPlanStep[],
  step: AsyncAgentWorkStep,
  status: AsyncAgentWorkPlanStepStatus
) {
  return steps.map((entry) =>
    entry.step === step
      ? {
          ...entry,
          status,
        }
      : entry
  );
}

export function runAsyncAgentWorkItem(
  item: AsyncAgentWorkItem,
  params: { now?: () => Date } = {}
): AsyncAgentWorkItem {
  if (item.status === "waiting_for_approval" || item.status === "blocked_by_policy") {
    const result = buildNonExecutableResult(item);

    return {
      ...item,
      result,
      updatedAt: nowIso(params.now),
    };
  }

  let next = item;
  if (next.status === "queued") {
    next = transitionAsyncAgentWorkStatus(next, "planned", {
      detail: "Async work item moved into deterministic local planning.",
      now: params.now,
    });
  }
  if (next.status === "planned") {
    next = transitionAsyncAgentWorkStatus(next, "running", {
      detail: "Async work item started v1 local runner.",
      now: params.now,
    });
  }

  const executedSteps: AsyncAgentWorkStep[] = [];
  const skippedSteps: AsyncAgentWorkStep[] = [];
  let steps = next.plan.steps;
  const traceEvents = [...next.traceEvents];

  for (const step of next.plan.steps) {
    traceEvents.push(
      traceEvent({
        type: "step_started",
        status: "running",
        step: step.step,
        detail: step.detail,
        metadata: null,
        now: params.now,
      })
    );

    if (step.step === "run_approved_builtin_inspection" && step.capabilities.length === 0) {
      skippedSteps.push(step.step);
      steps = updatePlanStep(steps, step.step, "skipped");
      traceEvents.push(
        traceEvent({
          type: "step_skipped",
          status: "running",
          step: step.step,
          detail: "No async v1 approved built-in inspection adapter was attached; unavailable tools were not run.",
          metadata: {
            deferredCapabilities: step.deferredCapabilities,
            executedUnavailableCapabilities: [],
          },
          now: params.now,
        })
      );
      continue;
    }

    if (step.step === "run_approved_builtin_inspection" && step.deferredCapabilities.length > 0) {
      skippedSteps.push(step.step);
      steps = updatePlanStep(steps, step.step, "deferred");
      traceEvents.push(
        traceEvent({
          type: "step_deferred",
          status: "running",
          step: step.step,
          detail: "Requested deeper capabilities are deferred to future approved broker tools.",
          metadata: {
            deferredCapabilities: step.deferredCapabilities,
            executedUnavailableCapabilities: [],
            executedUnapprovedTool: false,
          },
          now: params.now,
        })
      );
      continue;
    }

    executedSteps.push(step.step);
    steps = updatePlanStep(steps, step.step, "completed");
    traceEvents.push(
      traceEvent({
        type: step.step === "record_deferred_capability" ? "deferred_capability_recorded" : "step_completed",
        status: "running",
        step: step.step,
        detail:
          step.step === "record_deferred_capability"
            ? "Deferred capability records were persisted into the work item trace."
            : "Safe deterministic work step completed.",
        metadata:
          step.step === "record_deferred_capability"
            ? { deferredCapabilities: next.deferredCapabilities }
            : null,
        now: params.now,
      })
    );
  }

  const completedStatus =
    next.deferredCapabilities.length > 0 ||
    next.plan.limitations.length > 0 ||
    next.contextGapSnapshots.some((gap) => gap.severity !== "info")
      ? "completed_with_limitations"
      : "completed";
  const completedAt = nowIso(params.now);
  const result = {
    status: completedStatus,
    summary:
      completedStatus === "completed_with_limitations"
        ? "Async v1 completed the safe local lifecycle and recorded limitations for future capability work."
        : "Async v1 completed the safe local lifecycle.",
    limitations: [...next.plan.limitations],
    executedSteps,
    skippedSteps,
    deferredCapabilities: next.deferredCapabilities,
    artifactLinks: next.artifactLinks,
    sourceLinks: next.sourceLinks,
    createdArtifactKeys: next.artifactLinks
      .filter((link) => link.linkType === "created" && link.artifactKey)
      .map((link) => link.artifactKey as string),
    reusedArtifactKeys: next.artifactLinks
      .filter((link) => link.linkType === "reused" && link.artifactKey)
      .map((link) => link.artifactKey as string),
    linkedInspectionTaskKeys: unique(
      next.assemblySnapshot?.passResults.flatMap((pass) =>
        pass.inspectionsRun.map((inspection) => inspection.invocationId)
      ) ?? []
    ),
    executedToolIds: [],
    executedUnapprovedTool: false,
    executedUnavailableCapabilities: [],
    unavailableToolExecutionClaimed: false,
    approvalBlockers: [],
    policyBlockers: [],
  } satisfies AsyncAgentWorkResult;

  return {
    ...next,
    status: completedStatus,
    plan: {
      ...next.plan,
      steps,
    },
    result,
    traceEvents: [
      ...traceEvents,
      traceEvent({
        type: "work_completed",
        status: completedStatus,
        detail: result.summary,
        metadata: {
          executedSteps,
          skippedSteps,
          deferredCapabilities: next.deferredCapabilities.map((entry) => entry.capability),
        },
        now: params.now,
      }),
    ],
    updatedAt: completedAt,
    completedAt,
  };
}

function buildNonExecutableResult(item: AsyncAgentWorkItem): AsyncAgentWorkResult {
  const approvalBlockers =
    item.status === "waiting_for_approval"
      ? item.controlSnapshot.approvalRequiredReasons
      : [];
  const policyBlockers =
    item.status === "blocked_by_policy"
      ? item.controlSnapshot.blockedByPolicyReasons
      : [];

  return {
    status: item.status,
    summary:
      item.status === "blocked_by_policy"
        ? "Async work is blocked by policy and no execution steps ran."
        : "Async work is waiting for approval and no restricted steps ran.",
    limitations: [...item.plan.limitations],
    executedSteps: [],
    skippedSteps: item.plan.steps.map((step) => step.step),
    deferredCapabilities: item.deferredCapabilities,
    artifactLinks: item.artifactLinks,
    sourceLinks: item.sourceLinks,
    createdArtifactKeys: [],
    reusedArtifactKeys: item.artifactLinks
      .filter((link) => link.linkType === "reused" && link.artifactKey)
      .map((link) => link.artifactKey as string),
    linkedInspectionTaskKeys: [],
    executedToolIds: [],
    executedUnapprovedTool: false,
    executedUnavailableCapabilities: [],
    unavailableToolExecutionClaimed: false,
    approvalBlockers,
    policyBlockers,
  };
}

export function toAsyncAgentWorkDebugSnapshot(
  item: AsyncAgentWorkItem | null
): AsyncAgentWorkDebugSnapshot | null {
  if (!item) {
    return null;
  }

  const executedSteps = item.result?.executedSteps ?? [];
  const skippedOrDeferredSteps = item.result?.skippedSteps ?? item.plan.steps
    .filter((step) => step.status === "skipped" || step.status === "deferred" || step.status === "blocked")
    .map((step) => step.step);

  return {
    workItemId: item.id,
    workKey: item.workKey,
    status: item.status,
    type: item.type,
    trigger: item.trigger,
    priority: item.priority,
    controlSnapshot: item.controlSnapshot,
    assemblySnapshot: item.assemblySnapshot,
    contextGapSnapshots: item.contextGapSnapshots,
    plannedSteps: item.plan.steps,
    executedSteps,
    skippedOrDeferredSteps,
    deferredCapabilities: item.deferredCapabilities,
    artifactLinks: item.artifactLinks,
    sourceLinks: item.sourceLinks,
    completionState: item.result,
    limitations: item.result?.limitations ?? item.plan.limitations,
    policyBlockers: item.result?.policyBlockers ?? item.controlSnapshot.blockedByPolicyReasons,
    approvalBlockers: item.result?.approvalBlockers ?? item.controlSnapshot.approvalRequiredReasons,
    noUnavailableToolExecutionClaimed: true,
    traceEvents: item.traceEvents,
  };
}

export function hydrateAsyncAgentWorkItem(record: AsyncAgentWorkPrismaRecord): AsyncAgentWorkItem {
  return {
    id: record.id,
    workKey: record.workKey,
    idempotencyKey: record.workKey,
    conversationId: record.conversationId,
    conversationDocumentId: record.conversationDocumentId,
    createdById: record.createdById,
    status: record.status as AsyncAgentWorkStatus,
    type: record.type as AsyncAgentWorkType,
    trigger: record.trigger as AsyncAgentWorkTrigger,
    priority: record.priority as AsyncAgentWorkPriority,
    plan: parseJson(record.planJson, {} as AsyncAgentWorkPlan),
    resumePolicy: parseJson(record.resumePolicyJson, {
      mode: "manual",
      reason: "No resume policy was stored.",
    } satisfies AsyncAgentWorkResumePolicy),
    retryPolicy: parseJson(record.retryPolicyJson, {
      maxAttempts: 0,
      retryable: false,
      reason: "No retry policy was stored.",
    } satisfies AsyncAgentWorkRetryPolicy),
    budgetSnapshot: parseJson(record.budgetSnapshotJson, {} as AsyncAgentWorkBudgetSnapshot),
    controlSnapshot: parseJson(record.controlSnapshotJson, {} as AsyncAgentWorkControlSnapshot),
    assemblySnapshot: parseJson(record.assemblySnapshotJson, null as AsyncAgentWorkAssemblySnapshot | null),
    contextGapSnapshots: parseJson(record.contextGapsJson, [] as AsyncAgentWorkContextGapSnapshot[]),
    deferredCapabilities: parseJson(record.deferredCapabilitiesJson, [] as AsyncAgentWorkDeferredCapability[]),
    artifactLinks: parseJson(record.artifactLinksJson, [] as AsyncAgentWorkArtifactLink[]),
    sourceLinks: parseJson(record.sourceLinksJson, [] as AsyncAgentWorkSourceLink[]),
    result: parseJson(record.resultJson, null as AsyncAgentWorkResult | null),
    failure: parseJson(record.errorJson, null as AsyncAgentWorkFailure | null),
    traceEvents: parseJson(record.traceJson, [] as AsyncAgentWorkTraceEvent[]),
    createdAt: record.createdAt.toISOString(),
    updatedAt: record.updatedAt.toISOString(),
    completedAt: record.completedAt?.toISOString() ?? null,
  };
}

export async function upsertAsyncAgentWorkItem(
  item: AsyncAgentWorkItem,
  client: AsyncAgentWorkPrismaClient = prisma as unknown as AsyncAgentWorkPrismaClient
) {
  const create = serializeAsyncAgentWorkItemForPersistence(item, true);
  const update = serializeAsyncAgentWorkItemForPersistence(item, false);
  const record = await client.asyncAgentWorkItem.upsert({
    where: {
      workKey: item.workKey,
    },
    create,
    update,
  });

  return hydrateAsyncAgentWorkItem(record);
}

function serializeAsyncAgentWorkItemForPersistence(item: AsyncAgentWorkItem, includeId: boolean) {
  return {
    ...(includeId ? { id: item.id } : {}),
    workKey: item.workKey,
    conversationId: item.conversationId,
    conversationDocumentId: item.conversationDocumentId,
    createdById: item.createdById,
    status: item.status,
    type: item.type,
    trigger: item.trigger,
    priority: item.priority,
    planJson: json(item.plan),
    resumePolicyJson: json(item.resumePolicy),
    retryPolicyJson: json(item.retryPolicy),
    budgetSnapshotJson: json(item.budgetSnapshot),
    controlSnapshotJson: json(item.controlSnapshot),
    assemblySnapshotJson: item.assemblySnapshot ? json(item.assemblySnapshot) : null,
    contextGapsJson: json(item.contextGapSnapshots),
    deferredCapabilitiesJson: json(item.deferredCapabilities),
    artifactLinksJson: json(item.artifactLinks),
    sourceLinksJson: json(item.sourceLinks),
    resultJson: item.result ? json(item.result) : null,
    traceJson: json(item.traceEvents),
    errorJson: item.failure ? json(item.failure) : null,
    completedAt: item.completedAt ? new Date(item.completedAt) : null,
  };
}
