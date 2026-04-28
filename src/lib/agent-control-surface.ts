import { CHAT_REPLY_MAX_OUTPUT_TOKENS, CHAT_REPLY_REQUEST_TIMEOUT_MS } from "./chat-runtime-budgets";
import {
  DEFAULT_CONTEXT_PROMPT_CACHE_STRATEGY,
  normalizeContextBudgetMode,
  type ContextBudgetMode,
  type ContextCompactionStrategy,
} from "./context-token-budget";
import type { InspectionCapability, ToolCostClass } from "./inspection-tool-broker";
import type {
  AgentWorkPlan,
  AgentWorkPlanCapabilityNeed,
  AgentWorkPlanDecision,
  AgentWorkPlanLimitation,
  AgentWorkPlanModelNeed,
  AgentWorkPlanSourceNeed,
  AgentWorkPlanStep,
} from "./context-seams";
import {
  DEFAULT_MODEL_BUDGET_PROFILE,
  resolveModelBudgetProfile,
  resolveContextBudgetTokens,
  resolveModelContextBudget,
  type ModelBudgetProfile,
  type ModelBudgetProfileLookup,
} from "./model-budget-profiles";

export type ControlBoundaryType = "hard_enforcement" | "policy_configured" | "agentic_request";

export type TaskFidelityLevel =
  | "fast_answer"
  | "standard_grounded_answer"
  | "deep_inspection"
  | "highest_fidelity_ingestion"
  | "highest_fidelity_creation"
  | "audit_grade_answer";

export type RuntimeBudgetProfile =
  | "default_chat"
  | "expanded_context"
  | "expanded_output"
  | "deep_inspection"
  | "high_fidelity_ingestion"
  | "high_fidelity_creation"
  | "audit_grade"
  | "async_deep_work"
  | "approval_required_expansion";

export type ExecutionMode =
  | "synchronous"
  | "staged_synchronous"
  | "async_recommended"
  | "approval_required"
  | "blocked_by_policy";

export type InspectionDepth =
  | "none"
  | "artifact_reuse_only"
  | "parser_supported"
  | "broker_supported"
  | "deep_inspection_recommended"
  | "external_escalation_recommended";

export type CreationDepth =
  | "none"
  | "one_pass"
  | "structured_outline"
  | "multi_pass_draft"
  | "deliverable_grade"
  | "validation_required";

export type ValidationDepth =
  | "none"
  | "basic_grounding"
  | "citation_check"
  | "claim_check"
  | "audit_grade";

export type MemoryDensity =
  | "none"
  | "minimal_trace_only"
  | "artifact_summary"
  | "structured_artifacts"
  | "dense_source_memory"
  | "approval_required_dense_memory";

export type SourceCoverageTarget =
  | "none"
  | "relevant_artifacts_only"
  | "relevant_source_sections"
  | "full_document"
  | "all_tables"
  | "all_pages"
  | "all_attachments"
  | "linked_sources"
  | "approval_required_full_workspace";

export type MemoryRefreshDepth =
  | "none"
  | "reuse_current"
  | "check_freshness"
  | "refresh_stale_artifacts"
  | "supersede_weak_artifacts"
  | "deep_reinspection_recommended";

export type ControlCostClass = ToolCostClass | "approval_required";

export type ControlLatencyClass = "sync_safe" | "staged" | "async_preferred" | "batch_only";

export type ControlDecisionReason =
  | "default_budget_sufficient"
  | "default_budget_insufficient"
  | "request_mentions_highest_fidelity_ingestion"
  | "request_mentions_highest_fidelity_creation"
  | "request_mentions_audit_or_verification"
  | "weak_artifact_requires_deeper_inspection"
  | "external_escalation_recommended_but_not_executed"
  | "external_mutation_requires_approval"
  | "restricted_data_requires_policy_decision"
  | "source_freshness_requires_check"
  | "stale_artifacts_require_refresh"
  | "untrusted_source_content_treated_as_data"
  | "policy_limit_prevents_silent_expansion"
  | "blocked_by_hard_boundary";

export type ApprovalRequiredReason =
  | "exceeds_context_budget"
  | "exceeds_output_budget"
  | "exceeds_tool_budget"
  | "exceeds_runtime_limit"
  | "exceeds_cost_limit"
  | "restricted_data"
  | "external_data_egress"
  | "external_tool_required"
  | "external_mutation"
  | "code_execution"
  | "dense_memory_creation"
  | "audit_grade_required"
  | "source_coverage_too_large"
  | "policy_uncertain";

export type ControlBoundary = {
  id: string;
  type: ControlBoundaryType;
  label: string;
  detail: string;
  enforced: boolean;
};

export type PolicyConfiguredLimit = {
  id: string;
  type: ControlBoundaryType;
  control: string;
  value: string | number | boolean | string[];
  source: "default_workspace_policy_v1" | "runtime_model_profile" | "test_override" | "future_policy_store";
  enforced: true;
  detail: string;
};

export type ContextBudgetRequest = {
  requestedTokens: number;
  grantedTokens: number;
  profileMaxTokens: number;
  exceedsPolicy: boolean;
  reason: string;
};

export type OutputBudgetRequest = {
  requestedTokens: number;
  grantedTokens: number;
  profileMaxTokens: number;
  exceedsPolicy: boolean;
  reason: string;
};

export type ToolBudgetRequest = {
  requestedToolCalls: number;
  grantedToolCalls: number;
  exceedsPolicy: boolean;
  reason: string;
};

export type RuntimeBudgetRequest = {
  requestedMs: number;
  grantedMs: number;
  syncCutoffMs: number;
  exceedsPolicy: boolean;
  reason: string;
};

export type BudgetExpansionRequest = {
  requestedProfile: RuntimeBudgetProfile;
  approvedProfile: RuntimeBudgetProfile;
  approvalRequired: boolean;
  reasons: ApprovalRequiredReason[];
  detail: string;
};

export type ModelCapabilityRequest = {
  currentProvider: string | null;
  currentProtocol: string | null;
  currentModel: string | null;
  currentProfileId: string;
  requestedCapability: "current_model_ok" | "long_context" | "strong_reasoning" | "tool_reliable" | "audit_grade";
  requiresProviderChange: boolean;
  withinPolicy: boolean;
  reason: string;
};

export type ExternalEscalationRecommendation = {
  level: "none" | "recommended" | "approval_required" | "blocked_by_policy";
  capabilities: InspectionCapability[];
  unavailableOrUnapproved: boolean;
  dataEgressRisk: boolean;
  externalMutationRisk: boolean;
  detail: string;
};

export type ApprovalPacketDraft = {
  id: string;
  title: string;
  summary: string;
  reasons: ApprovalRequiredReason[];
  requestedControls: string[];
  policyLimits: string[];
  risks: string[];
  proposedNextStep: string;
};

export type ControlTraceEvent = {
  type:
    | "task_classified"
    | "boundary_applied"
    | "policy_limit_applied"
    | "agentic_control_requested"
    | "approval_packet_prepared"
    | "async_recommended"
    | "blocked_by_policy"
    | "untrusted_content_ignored"
    | "source_freshness_evaluated"
    | "tool_governance_referenced";
  timestamp: string;
  reason: ControlDecisionReason;
  detail: string;
  metadata: Record<string, unknown> | null;
};

export type AgentControlPolicy = {
  allowedBudgetProfiles: RuntimeBudgetProfile[];
  maxContextTokens: number;
  maxOutputTokens: number;
  defaultToolCallLimit: number;
  maxToolCallLimit: number;
  syncRuntimeCutoffMs: number;
  maxRuntimeMs: number;
  maxCostClass: ControlCostClass;
  allowAsyncRecommendation: boolean;
  allowExternalEscalationRecommendation: boolean;
  requireApprovalForExternalEscalation: boolean;
  requireApprovalForExternalMutation: boolean;
  requireApprovalForDenseMemory: boolean;
  blockRestrictedDataExternalEscalation: boolean;
  blockCodeExecution: boolean;
  allowedSourceCoverageTargets: SourceCoverageTarget[];
  allowedMemoryDensities: MemoryDensity[];
};

export type AgentControlSourceSignal = {
  sourceId: string;
  sourceType: string;
  filename?: string | null;
  sourceVersion?: string | null;
  sourceUpdatedAt?: string | null;
  artifactUpdatedAt?: string | null;
  hasWeakArtifact?: boolean;
  hasStaleArtifact?: boolean;
  artifactKinds?: string[];
  warningArtifactKinds?: string[];
  recommendedNextCapabilities?: InspectionCapability[];
  unmetCapabilities?: InspectionCapability[];
  sourceCoverageHints?: SourceCoverageTarget[];
  dataClass?: "public" | "internal" | "confidential" | "restricted";
  containsUntrustedInstructions?: boolean;
  detail?: string | null;
};

export type AgentControlEvaluationInput = {
  conversationId?: string | null;
  request?: string | null;
  model?: (ModelBudgetProfileLookup & { mode?: ContextBudgetMode | null }) | null;
  policy?: Partial<AgentControlPolicy> | null;
  sourceSignals?: AgentControlSourceSignal[];
  untrustedSourceContent?: string | null;
};

export type AgentControlDecision = {
  decisionId: string;
  taskFidelityLevel: TaskFidelityLevel;
  runtimeBudgetProfile: RuntimeBudgetProfile;
  budgetMode: ContextBudgetMode;
  budgetExpansionRequest: BudgetExpansionRequest;
  contextBudgetRequest: ContextBudgetRequest;
  outputBudgetRequest: OutputBudgetRequest;
  toolBudgetRequest: ToolBudgetRequest;
  runtimeBudgetRequest: RuntimeBudgetRequest;
  inspectionDepth: InspectionDepth;
  creationDepth: CreationDepth;
  validationDepth: ValidationDepth;
  memoryDensity: MemoryDensity;
  sourceCoverageTarget: SourceCoverageTarget;
  memoryRefreshDepth: MemoryRefreshDepth;
  modelCapabilityRequest: ModelCapabilityRequest;
  executionMode: ExecutionMode;
  approvalRequired: boolean;
  approvalRequiredReasons: ApprovalRequiredReason[];
  asyncRecommended: boolean;
  asyncRecommendedReason: string | null;
  blockedByPolicy: boolean;
  blockedByPolicyReasons: string[];
  defaultBudgetSufficient: boolean;
  defaultBudgetInsufficiencyReasons: string[];
  hardBoundariesApplied: ControlBoundary[];
  policyConfiguredLimitsApplied: PolicyConfiguredLimit[];
  agenticControlRequests: ControlBoundary[];
  externalEscalation: ExternalEscalationRecommendation;
  toolGovernance: {
    brokerGoverned: true;
    approvedToolsOnly: true;
    executedUnapprovedTool: false;
    recommendedCapabilities: InspectionCapability[];
    unmetCapabilities: InspectionCapability[];
    detail: string;
  };
  dataEgressRisk: boolean;
  externalMutationRisk: boolean;
  untrustedContentHandling: string;
  sourceFreshness: {
    evaluated: boolean;
    staleSourceIds: string[];
    weakArtifactSourceIds: string[];
    detail: string;
  };
  reasons: ControlDecisionReason[];
  traceEvents: ControlTraceEvent[];
  approvalPacketDraft: ApprovalPacketDraft | null;
};

export type AgentControlDebugSnapshot = AgentControlDecision;

export type AgentWorkPlanProjectionInput = {
  conversationId?: string | null;
  messageId?: string | null;
  request?: string | null;
  decision: AgentControlDecision;
  sourceSignals?: AgentControlSourceSignal[];
  artifactPromotion?: {
    candidateCount: number;
    acceptedCount: number;
    rejectedCount: number;
  } | null;
  scopedPlanLinks?: Partial<AgentWorkPlan["scopedPlanLinks"]>;
};

type ProfilePlan = {
  contextMultiplier: number;
  outputMultiplier: number;
  toolCalls: number;
  runtimeMs: number;
  costClass: ControlCostClass;
};

const COST_CLASS_ORDER: Record<ControlCostClass, number> = {
  free_local: 0,
  low: 1,
  medium: 2,
  high: 3,
  variable: 4,
  approval_required: 5,
};

const PROFILE_PLAN: Record<RuntimeBudgetProfile, ProfilePlan> = {
  default_chat: {
    contextMultiplier: 1,
    outputMultiplier: 1,
    toolCalls: 2,
    runtimeMs: CHAT_REPLY_REQUEST_TIMEOUT_MS,
    costClass: "low",
  },
  expanded_context: {
    contextMultiplier: 1.6,
    outputMultiplier: 1,
    toolCalls: 3,
    runtimeMs: CHAT_REPLY_REQUEST_TIMEOUT_MS,
    costClass: "low",
  },
  expanded_output: {
    contextMultiplier: 1.2,
    outputMultiplier: 1.75,
    toolCalls: 3,
    runtimeMs: CHAT_REPLY_REQUEST_TIMEOUT_MS,
    costClass: "low",
  },
  deep_inspection: {
    contextMultiplier: 1.8,
    outputMultiplier: 1,
    toolCalls: 6,
    runtimeMs: CHAT_REPLY_REQUEST_TIMEOUT_MS * 2,
    costClass: "medium",
  },
  high_fidelity_ingestion: {
    contextMultiplier: 2,
    outputMultiplier: 1,
    toolCalls: 8,
    runtimeMs: CHAT_REPLY_REQUEST_TIMEOUT_MS * 2.5,
    costClass: "medium",
  },
  high_fidelity_creation: {
    contextMultiplier: 1.8,
    outputMultiplier: 2,
    toolCalls: 6,
    runtimeMs: CHAT_REPLY_REQUEST_TIMEOUT_MS * 2,
    costClass: "medium",
  },
  audit_grade: {
    contextMultiplier: 2,
    outputMultiplier: 1.5,
    toolCalls: 8,
    runtimeMs: CHAT_REPLY_REQUEST_TIMEOUT_MS * 2.5,
    costClass: "high",
  },
  async_deep_work: {
    contextMultiplier: 2,
    outputMultiplier: 2,
    toolCalls: 8,
    runtimeMs: CHAT_REPLY_REQUEST_TIMEOUT_MS * 2.5,
    costClass: "medium",
  },
  approval_required_expansion: {
    contextMultiplier: 2.5,
    outputMultiplier: 2.5,
    toolCalls: 12,
    runtimeMs: CHAT_REPLY_REQUEST_TIMEOUT_MS * 4,
    costClass: "approval_required",
  },
};

const DEFAULT_ALLOWED_SOURCE_COVERAGE_TARGETS: SourceCoverageTarget[] = [
  "none",
  "relevant_artifacts_only",
  "relevant_source_sections",
  "full_document",
  "all_tables",
  "all_pages",
  "all_attachments",
  "linked_sources",
];

const DEFAULT_ALLOWED_MEMORY_DENSITIES: MemoryDensity[] = [
  "none",
  "minimal_trace_only",
  "artifact_summary",
  "structured_artifacts",
  "dense_source_memory",
];

const HARD_BOUNDARIES: ControlBoundary[] = [
  {
    id: "tenant_workspace_isolation",
    type: "hard_enforcement",
    label: "Tenant and workspace isolation",
    detail: "Conversation context can only use sources admitted by the app-side source authority and ACL checks.",
    enforced: true,
  },
  {
    id: "identity_permission_enforcement",
    type: "hard_enforcement",
    label: "Identity and permission enforcement",
    detail: "The agent cannot grant itself access or impersonate a user.",
    enforced: true,
  },
  {
    id: "untrusted_source_content_boundary",
    type: "hard_enforcement",
    label: "Untrusted source content boundary",
    detail: "Documents, PDFs, web pages, spreadsheets, code, and emails are treated as data, not operational instructions.",
    enforced: true,
  },
  {
    id: "approval_enforcement",
    type: "hard_enforcement",
    label: "Approval enforcement",
    detail: "The agent can prepare approval packets but cannot approve, bypass, or silently exceed gated controls.",
    enforced: true,
  },
  {
    id: "tool_governance_enforcement",
    type: "hard_enforcement",
    label: "Tool governance enforcement",
    detail: "Only A-04b/A-04c eligible approved tools may execute; unmet capabilities are recorded as recommendations.",
    enforced: true,
  },
  {
    id: "source_version_provenance",
    type: "hard_enforcement",
    label: "Source version and provenance",
    detail: "Reusable artifacts must remain source-grounded and subject to freshness or supersession checks.",
    enforced: true,
  },
  {
    id: "external_mutation_boundary",
    type: "hard_enforcement",
    label: "External mutation boundary",
    detail: "Sending, posting, changing files, updating SaaS records, or executing code requires explicit approval or a future narrow pre-approved policy.",
    enforced: true,
  },
];

function nowIso() {
  return new Date().toISOString();
}

function buildTraceEvent(params: Omit<ControlTraceEvent, "timestamp">): ControlTraceEvent {
  return {
    ...params,
    timestamp: nowIso(),
  };
}

function normalizeRequest(value: string | null | undefined) {
  return value?.trim() ?? "";
}

function hasAnyPattern(value: string, patterns: RegExp[]) {
  return patterns.some((pattern) => pattern.test(value));
}

function unique<T>(values: T[]) {
  return values.filter((value, index, array) => array.indexOf(value) === index);
}

function normalizePolicy(
  policy: Partial<AgentControlPolicy> | null | undefined,
  profile: ModelBudgetProfile
): AgentControlPolicy {
  const modelContextBudget = Math.max(
    0,
    profile.maxContextTokens - profile.reservedSystemPromptTokens - profile.reservedResponseTokens
  );

  return {
    allowedBudgetProfiles: [
      "default_chat",
      "expanded_context",
      "expanded_output",
      "deep_inspection",
      "high_fidelity_ingestion",
      "high_fidelity_creation",
      "audit_grade",
      "async_deep_work",
      "approval_required_expansion",
    ],
    maxContextTokens: modelContextBudget,
    maxOutputTokens: profile.maxOutputTokens,
    defaultToolCallLimit: 2,
    maxToolCallLimit: 8,
    syncRuntimeCutoffMs: CHAT_REPLY_REQUEST_TIMEOUT_MS,
    maxRuntimeMs: CHAT_REPLY_REQUEST_TIMEOUT_MS * 2.5,
    maxCostClass: "medium",
    allowAsyncRecommendation: true,
    allowExternalEscalationRecommendation: true,
    requireApprovalForExternalEscalation: true,
    requireApprovalForExternalMutation: true,
    requireApprovalForDenseMemory: false,
    blockRestrictedDataExternalEscalation: true,
    blockCodeExecution: true,
    allowedSourceCoverageTargets: DEFAULT_ALLOWED_SOURCE_COVERAGE_TARGETS,
    allowedMemoryDensities: DEFAULT_ALLOWED_MEMORY_DENSITIES,
    ...(policy ?? {}),
  };
}

function buildPolicyLimits(policy: AgentControlPolicy, profile: ModelBudgetProfile): PolicyConfiguredLimit[] {
  return [
    {
      id: "allowed_budget_profiles",
      type: "policy_configured",
      control: "runtimeBudgetProfile",
      value: policy.allowedBudgetProfiles,
      source: "default_workspace_policy_v1",
      enforced: true,
      detail: "Workspace policy controls which budget profiles the agent may request.",
    },
    {
      id: "model_context_ceiling",
      type: "policy_configured",
      control: "contextBudgetRequest",
      value: policy.maxContextTokens,
      source: "runtime_model_profile",
      enforced: true,
      detail: `Context requests are capped by profile ${profile.id}.`,
    },
    {
      id: "output_token_ceiling",
      type: "policy_configured",
      control: "outputBudgetRequest",
      value: policy.maxOutputTokens,
      source: "runtime_model_profile",
      enforced: true,
      detail: "Output token requests are capped by the selected model/runtime policy.",
    },
    {
      id: "tool_call_ceiling",
      type: "policy_configured",
      control: "toolBudgetRequest",
      value: policy.maxToolCallLimit,
      source: "default_workspace_policy_v1",
      enforced: true,
      detail: "Tool-call expansion is a request and cannot silently exceed policy.",
    },
    {
      id: "runtime_duration_ceiling",
      type: "policy_configured",
      control: "runtimeBudgetRequest",
      value: policy.maxRuntimeMs,
      source: "default_workspace_policy_v1",
      enforced: true,
      detail: "Runtime expansion can recommend staging or async work, but cannot exceed policy silently.",
    },
    {
      id: "cost_ceiling",
      type: "policy_configured",
      control: "costClass",
      value: policy.maxCostClass,
      source: "default_workspace_policy_v1",
      enforced: true,
      detail: "Cost class expansion above policy produces approval_required instead of auto-spend.",
    },
    {
      id: "external_escalation_approval",
      type: "policy_configured",
      control: "externalEscalation",
      value: policy.requireApprovalForExternalEscalation,
      source: "default_workspace_policy_v1",
      enforced: true,
      detail: "External tools and data egress remain gated by approval and tool governance.",
    },
  ];
}

function buildAgenticRequest(id: string, label: string, detail: string): ControlBoundary {
  return {
    id,
    type: "agentic_request",
    label,
    detail,
    enforced: false,
  };
}

function determineTaskKind(request: string, sourceSignals: AgentControlSourceSignal[]) {
  const lower = request.toLowerCase();
  const weakArtifact = sourceSignals.some((signal) => signal.hasWeakArtifact);
  const staleArtifact = sourceSignals.some((signal) => signal.hasStaleArtifact);
  const recommendedCapabilities = unique(sourceSignals.flatMap((signal) => signal.recommendedNextCapabilities ?? []));
  const hasExternalRecommendation = recommendedCapabilities.some((capability) =>
    ["rendered_page_inspection", "ocr", "vision_page_understanding", "document_ai_table_recovery"].includes(capability)
  );
  const highestFidelityIngestion = hasAnyPattern(lower, [
    /\bingest\b.*\b(highest|maximum|full|complete|all|best)\b/i,
    /\b(highest|maximum|full|complete|best)\b.*\bingest/i,
    /\bhighest[- ]fidelity\b.*\bingestion\b/i,
    /\b(all pages|all tables|full document|dense source memory)\b/i,
  ]);
  const highestFidelityCreation = hasAnyPattern(lower, [
    /\b(create|draft|write|build|produce|generate)\b.*\b(best possible|deliverable|report|deck|workbook|memo|brief|proposal)\b/i,
    /\b(best possible|deliverable[- ]grade)\b.*\b(report|deck|workbook|memo|brief|proposal)\b/i,
  ]);
  const audit = hasAnyPattern(lower, [
    /\b(audit|verify|validate|fact[- ]check|claim[- ]check|citation[- ]check|source[- ]check|compliance check)\b/i,
    /\baudit[- ]grade\b/i,
  ]);
  const externalMutation = hasAnyPattern(lower, [
    /\b(send|email|post|publish|submit|file|update|modify|delete|create)\b.*\b(email|message|crm|ticket|spreadsheet|external|salesforce|hubspot|slack|github|jira)\b/i,
    /\bchange\b.*\b(file|spreadsheet|crm|ticket|external system)\b/i,
    /\bexecute\b.*\b(code|script|command)\b/i,
  ]);
  const codeExecution = /\bexecute\b.*\b(code|script|command)\b/i.test(lower);
  const restrictedData = sourceSignals.some((signal) => signal.dataClass === "restricted") || /\b(restricted|secret|credential|api key|password)\b/i.test(lower);
  const tableBodyMissing =
    weakArtifact &&
    hasAnyPattern(lower, [
      /\b(table|page 15|body|row|column|cell|water chemistry|missing)\b/i,
    ]);

  return {
    weakArtifact,
    staleArtifact,
    recommendedCapabilities,
    hasExternalRecommendation,
    highestFidelityIngestion,
    highestFidelityCreation,
    audit,
    externalMutation,
    codeExecution,
    restrictedData,
    tableBodyMissing,
  };
}

function chooseRuntimeProfile(params: {
  taskFidelityLevel: TaskFidelityLevel;
  tableBodyMissing: boolean;
}) {
  if (params.taskFidelityLevel === "highest_fidelity_ingestion") {
    return "high_fidelity_ingestion" satisfies RuntimeBudgetProfile;
  }
  if (params.taskFidelityLevel === "highest_fidelity_creation") {
    return "high_fidelity_creation" satisfies RuntimeBudgetProfile;
  }
  if (params.taskFidelityLevel === "audit_grade_answer") {
    return "audit_grade" satisfies RuntimeBudgetProfile;
  }
  if (params.taskFidelityLevel === "deep_inspection" || params.tableBodyMissing) {
    return "deep_inspection" satisfies RuntimeBudgetProfile;
  }
  return "default_chat" satisfies RuntimeBudgetProfile;
}

function classifyFidelity(kind: ReturnType<typeof determineTaskKind>): TaskFidelityLevel {
  if (kind.highestFidelityIngestion) {
    return "highest_fidelity_ingestion";
  }
  if (kind.highestFidelityCreation) {
    return "highest_fidelity_creation";
  }
  if (kind.audit) {
    return "audit_grade_answer";
  }
  if (kind.tableBodyMissing || kind.hasExternalRecommendation || kind.weakArtifact) {
    return "deep_inspection";
  }
  return "standard_grounded_answer";
}

function chooseDepths(params: {
  fidelity: TaskFidelityLevel;
  kind: ReturnType<typeof determineTaskKind>;
  sourceSignals: AgentControlSourceSignal[];
}) {
  let inspectionDepth: InspectionDepth = "artifact_reuse_only";
  let creationDepth: CreationDepth = "none";
  let validationDepth: ValidationDepth = "basic_grounding";
  let memoryDensity: MemoryDensity = "minimal_trace_only";
  let sourceCoverageTarget: SourceCoverageTarget = "relevant_artifacts_only";
  let memoryRefreshDepth: MemoryRefreshDepth = "reuse_current";

  if (params.kind.hasExternalRecommendation) {
    inspectionDepth = "external_escalation_recommended";
  } else if (params.fidelity === "deep_inspection") {
    inspectionDepth = "deep_inspection_recommended";
  } else if (params.sourceSignals.length > 0) {
    inspectionDepth = "parser_supported";
  }

  if (params.fidelity === "highest_fidelity_ingestion") {
    inspectionDepth = params.kind.hasExternalRecommendation ? "external_escalation_recommended" : "deep_inspection_recommended";
    validationDepth = "citation_check";
    memoryDensity = "dense_source_memory";
    sourceCoverageTarget = params.sourceSignals.some((signal) => signal.sourceCoverageHints?.includes("all_tables"))
      ? "all_tables"
      : "all_pages";
    memoryRefreshDepth = params.kind.staleArtifact ? "refresh_stale_artifacts" : "check_freshness";
  }

  if (params.fidelity === "highest_fidelity_creation") {
    creationDepth = "deliverable_grade";
    validationDepth = "claim_check";
    memoryDensity = "structured_artifacts";
    sourceCoverageTarget = "relevant_source_sections";
    inspectionDepth = params.kind.hasExternalRecommendation ? "external_escalation_recommended" : "broker_supported";
    memoryRefreshDepth = params.kind.staleArtifact ? "refresh_stale_artifacts" : "check_freshness";
  }

  if (params.fidelity === "audit_grade_answer") {
    inspectionDepth = params.kind.hasExternalRecommendation ? "external_escalation_recommended" : "deep_inspection_recommended";
    validationDepth = "audit_grade";
    memoryDensity = "structured_artifacts";
    sourceCoverageTarget = "relevant_source_sections";
    memoryRefreshDepth = params.kind.staleArtifact ? "refresh_stale_artifacts" : "check_freshness";
  }

  if (params.fidelity === "deep_inspection") {
    validationDepth = "citation_check";
    memoryDensity = "artifact_summary";
    sourceCoverageTarget = "relevant_source_sections";
    memoryRefreshDepth = params.kind.weakArtifact
      ? "supersede_weak_artifacts"
      : params.kind.staleArtifact
        ? "refresh_stale_artifacts"
        : "check_freshness";
  }

  if (params.kind.staleArtifact && memoryRefreshDepth === "reuse_current") {
    memoryRefreshDepth = "refresh_stale_artifacts";
  }

  if (params.kind.weakArtifact && memoryRefreshDepth !== "refresh_stale_artifacts") {
    memoryRefreshDepth = "supersede_weak_artifacts";
  }

  return {
    inspectionDepth,
    creationDepth,
    validationDepth,
    memoryDensity,
    sourceCoverageTarget,
    memoryRefreshDepth,
  };
}

function buildBudgetRequests(params: {
  profile: ModelBudgetProfile;
  mode: ContextBudgetMode;
  runtimeBudgetProfile: RuntimeBudgetProfile;
  policy: AgentControlPolicy;
}) {
  const defaultContext = resolveModelContextBudget({
    lookup: {
      provider: params.profile.providers?.[0] ?? null,
      model: null,
    },
    mode: params.mode,
  });
  const baseContextTokens = resolveContextBudgetTokens(params.profile, params.mode);
  const plan = PROFILE_PLAN[params.runtimeBudgetProfile];
  const requestedContextTokens = Math.ceil(baseContextTokens * plan.contextMultiplier);
  const requestedOutputTokens = Math.ceil(CHAT_REPLY_MAX_OUTPUT_TOKENS * plan.outputMultiplier);
  const requestedToolCalls = plan.toolCalls;
  const requestedRuntimeMs = Math.ceil(plan.runtimeMs);

  return {
    contextBudgetRequest: {
      requestedTokens: requestedContextTokens,
      grantedTokens: Math.min(requestedContextTokens, params.policy.maxContextTokens),
      profileMaxTokens: params.policy.maxContextTokens,
      exceedsPolicy: requestedContextTokens > params.policy.maxContextTokens,
      reason:
        requestedContextTokens > baseContextTokens
          ? "Agent requested expanded context for the classified task fidelity."
          : "Default context budget is sufficient for the classified task.",
    } satisfies ContextBudgetRequest,
    outputBudgetRequest: {
      requestedTokens: requestedOutputTokens,
      grantedTokens: Math.min(requestedOutputTokens, params.policy.maxOutputTokens),
      profileMaxTokens: params.policy.maxOutputTokens,
      exceedsPolicy: requestedOutputTokens > params.policy.maxOutputTokens,
      reason:
        requestedOutputTokens > CHAT_REPLY_MAX_OUTPUT_TOKENS
          ? "Agent requested expanded output for creation, audit, or dense inspection."
          : "Default output budget is sufficient for the classified task.",
    } satisfies OutputBudgetRequest,
    toolBudgetRequest: {
      requestedToolCalls,
      grantedToolCalls: Math.min(requestedToolCalls, params.policy.maxToolCallLimit),
      exceedsPolicy: requestedToolCalls > params.policy.maxToolCallLimit,
      reason:
        requestedToolCalls > params.policy.defaultToolCallLimit
          ? "Agent requested additional tool calls for inspection, validation, or staged work."
          : "Default tool-call budget is sufficient for the classified task.",
    } satisfies ToolBudgetRequest,
    runtimeBudgetRequest: {
      requestedMs: requestedRuntimeMs,
      grantedMs: Math.min(requestedRuntimeMs, params.policy.maxRuntimeMs),
      syncCutoffMs: params.policy.syncRuntimeCutoffMs,
      exceedsPolicy: requestedRuntimeMs > params.policy.maxRuntimeMs,
      reason:
        requestedRuntimeMs > params.policy.syncRuntimeCutoffMs
          ? "Agent requested more runtime than the synchronous cutoff, so staged or async execution is recommended."
          : "Default synchronous runtime is sufficient for the classified task.",
    } satisfies RuntimeBudgetRequest,
    defaultContextTokens: defaultContext.contextBudgetTokens,
  };
}

function sourceFreshnessSummary(sourceSignals: AgentControlSourceSignal[]) {
  const staleSourceIds = unique(sourceSignals.filter((signal) => signal.hasStaleArtifact).map((signal) => signal.sourceId));
  const weakArtifactSourceIds = unique(sourceSignals.filter((signal) => signal.hasWeakArtifact).map((signal) => signal.sourceId));
  const versionedSignals = sourceSignals.filter(
    (signal) => signal.sourceVersion || signal.sourceUpdatedAt || signal.artifactUpdatedAt
  );

  return {
    evaluated: versionedSignals.length > 0 || staleSourceIds.length > 0 || weakArtifactSourceIds.length > 0,
    staleSourceIds,
    weakArtifactSourceIds,
    detail:
      staleSourceIds.length > 0
        ? "One or more artifacts appear older than available source-version metadata and should be refreshed before strong reuse."
        : weakArtifactSourceIds.length > 0
          ? "Weak or warning artifacts are reusable but should be superseded by stronger inspection when available."
          : versionedSignals.length > 0
            ? "Source-version metadata was present; no stale artifact signal was detected."
            : "No source-version freshness metadata was available for this control decision.",
  };
}

function buildApprovalPacket(params: {
  reasons: ApprovalRequiredReason[];
  profile: RuntimeBudgetProfile;
  contextBudgetRequest: ContextBudgetRequest;
  outputBudgetRequest: OutputBudgetRequest;
  toolBudgetRequest: ToolBudgetRequest;
  runtimeBudgetRequest: RuntimeBudgetRequest;
  externalEscalation: ExternalEscalationRecommendation;
  policyLimits: PolicyConfiguredLimit[];
}) {
  if (params.reasons.length === 0) {
    return null;
  }

  const requestedControls = [
    `budgetProfile:${params.profile}`,
    `contextTokens:${params.contextBudgetRequest.requestedTokens}`,
    `outputTokens:${params.outputBudgetRequest.requestedTokens}`,
    `toolCalls:${params.toolBudgetRequest.requestedToolCalls}`,
    `runtimeMs:${params.runtimeBudgetRequest.requestedMs}`,
    params.externalEscalation.level !== "none"
      ? `externalCapabilities:${params.externalEscalation.capabilities.join(",")}`
      : null,
  ].filter((entry): entry is string => Boolean(entry));

  return {
    id: `approval:${params.profile}:${params.reasons.join("+")}`,
    title: "Agent control expansion approval",
    summary:
      "The agent determined that the requested fidelity exceeds one or more current policy-configured limits. No expansion or external action has been executed.",
    reasons: [...params.reasons],
    requestedControls,
    policyLimits: params.policyLimits.map((limit) => `${limit.id}=${Array.isArray(limit.value) ? limit.value.join(",") : limit.value}`),
    risks: [
      params.reasons.includes("external_data_egress") ? "External data egress may expose source content outside the workspace boundary." : null,
      params.reasons.includes("external_mutation") ? "External mutation could change third-party or user-owned systems." : null,
      params.reasons.includes("code_execution") ? "Code execution requires a sandbox and explicit approval." : null,
      params.reasons.includes("dense_memory_creation") ? "Dense memory creation increases durable source retention and should match policy." : null,
      params.reasons.includes("exceeds_cost_limit") ? "Requested cost class exceeds current workspace policy." : null,
    ].filter((risk): risk is string => Boolean(risk)),
    proposedNextStep:
      "Ask an authorized user to approve the requested control expansion or select a lower-fidelity staged path inside current policy.",
  } satisfies ApprovalPacketDraft;
}

function deriveExecutionMode(params: {
  approvalRequired: boolean;
  blockedByPolicy: boolean;
  runtimeBudgetRequest: RuntimeBudgetRequest;
  policy: AgentControlPolicy;
  profile: RuntimeBudgetProfile;
}) {
  if (params.blockedByPolicy) {
    return "blocked_by_policy" satisfies ExecutionMode;
  }
  if (params.approvalRequired) {
    return "approval_required" satisfies ExecutionMode;
  }
  if (
    params.runtimeBudgetRequest.requestedMs > params.runtimeBudgetRequest.syncCutoffMs ||
    params.profile === "high_fidelity_ingestion" ||
    params.profile === "async_deep_work"
  ) {
    return params.policy.allowAsyncRecommendation
      ? ("async_recommended" satisfies ExecutionMode)
      : ("staged_synchronous" satisfies ExecutionMode);
  }
  if (params.profile === "deep_inspection" || params.profile === "high_fidelity_creation" || params.profile === "audit_grade") {
    return "staged_synchronous" satisfies ExecutionMode;
  }
  return "synchronous" satisfies ExecutionMode;
}

function workPlanTaskType(fidelity: TaskFidelityLevel) {
  if (fidelity === "highest_fidelity_ingestion") return "ingestion";
  if (fidelity === "highest_fidelity_creation") return "creation";
  if (fidelity === "audit_grade_answer") return "audit";
  if (fidelity === "deep_inspection") return "inspection";
  if (fidelity === "fast_answer") return "fast_answer";
  return "grounded_answer";
}

function workPlanOutputExpectation(fidelity: TaskFidelityLevel) {
  if (fidelity === "highest_fidelity_creation") return "deliverable_grade_output";
  if (fidelity === "audit_grade_answer") return "audit_grade_answer";
  if (fidelity === "highest_fidelity_ingestion") return "source_memory_and_gap_trace";
  if (fidelity === "deep_inspection") return "grounded_answer_with_limitations";
  return "grounded_answer";
}

function workPlanAnswerReadiness(decision: AgentControlDecision): AgentWorkPlan["answerReadiness"] {
  if (decision.blockedByPolicy) {
    return {
      status: "blocked",
      readyForAnswer: false,
      confidence: 0,
      reasons: decision.blockedByPolicyReasons,
      limitations: ["Policy blocks the requested execution path."],
    };
  }

  if (decision.approvalRequired) {
    return {
      status: "approval_required",
      readyForAnswer: false,
      confidence: 0.25,
      reasons: decision.approvalRequiredReasons,
      limitations: ["Approval is required before expanded execution can run."],
    };
  }

  if (decision.asyncRecommended) {
    return {
      status: "async_recommended",
      readyForAnswer: true,
      confidence: 0.45,
      reasons: [decision.asyncRecommendedReason ?? "Async or staged work is recommended."],
      limitations: ["A synchronous answer may need limitations until async deep work runs."],
    };
  }

  return {
    status: decision.defaultBudgetSufficient ? "ready" : "ready_with_limitations",
    readyForAnswer: true,
    confidence: decision.defaultBudgetSufficient ? 0.8 : 0.6,
    reasons: decision.defaultBudgetSufficient
      ? ["Deterministic control decision stayed within current policy."]
      : decision.defaultBudgetInsufficiencyReasons,
    limitations: decision.defaultBudgetInsufficiencyReasons,
  };
}

function capabilityPayloadTypes(capability: string) {
  switch (capability) {
    case "rendered_page_inspection":
      return ["rendered_page_image", "page_crop_image"];
    case "ocr":
      return ["ocr_text"];
    case "vision_page_understanding":
      return ["vision_observation"];
    case "document_ai_table_recovery":
      return ["document_ai_result", "structured_table"];
    case "source_connector_read":
      return ["native_file_reference"];
    case "code_repository_inspection":
      return ["code_analysis_result"];
    default:
      return [];
  }
}

function capabilityState(decision: AgentControlDecision): AgentWorkPlanCapabilityNeed["state"] {
  if (decision.blockedByPolicy) return "unavailable";
  if (decision.approvalRequired) return "approval_required";
  if (decision.asyncRecommended) return "deferred";
  return "needed";
}

function buildCapabilityNeeds(decision: AgentControlDecision): AgentWorkPlanCapabilityNeed[] {
  const capabilities = unique([
    ...decision.toolGovernance.recommendedCapabilities,
    ...decision.toolGovernance.unmetCapabilities,
    ...decision.externalEscalation.capabilities,
  ]);
  return capabilities.map((capability) => ({
    capability,
    state: capabilityState(decision),
    payloadTypes: capabilityPayloadTypes(capability),
    requiresApproval:
      decision.approvalRequired ||
      decision.externalEscalation.level === "approval_required",
    asyncRecommended: decision.asyncRecommended || decision.externalEscalation.level === "recommended",
    reason:
      decision.externalEscalation.capabilities.includes(capability)
        ? decision.externalEscalation.detail
        : "Capability was recommended by deterministic control/tool governance.",
    executionEvidenceIds: [],
    noExecutionClaimed: true,
  }));
}

function buildModelNeed(decision: AgentControlDecision): AgentWorkPlanModelNeed {
  const request = decision.modelCapabilityRequest;
  return {
    capability: request.requestedCapability,
    state: request.requiresProviderChange
      ? request.withinPolicy
        ? "needed"
        : "approval_required"
      : "planned",
    currentProvider: request.currentProvider,
    currentModel: request.currentModel,
    currentProfileId: request.currentProfileId,
    requiresProviderChange: request.requiresProviderChange,
    acceptedPayloadTypes: [],
    unavailablePayloadTypes: request.requestedCapability === "long_context" ? ["large_context"] : [],
    reason: request.reason,
    noExecutionClaimed: true,
  };
}

function buildSourceNeeds(input: AgentWorkPlanProjectionInput): AgentWorkPlanSourceNeed[] {
  const decision = input.decision;
  return (input.sourceSignals ?? []).map((signal) => ({
    sourceId: signal.sourceId,
    sourceType: signal.sourceType,
    scope: null,
    state:
      signal.hasStaleArtifact || signal.hasWeakArtifact
        ? decision.approvalRequired
          ? "approval_required"
          : decision.asyncRecommended
            ? "deferred"
            : "needed"
        : "planned",
    coverageTarget: decision.sourceCoverageTarget,
    reason: signal.detail ?? decision.sourceFreshness.detail,
    detail:
      signal.hasStaleArtifact
        ? "Source has stale artifact memory."
        : signal.hasWeakArtifact
          ? "Source has weak or warning artifact memory."
          : "Source is part of the deterministic context-control scope.",
    executionEvidenceIds: [],
  }));
}

function buildCompactionStrategies(decision: AgentControlDecision): ContextCompactionStrategy[] {
  const strategies: ContextCompactionStrategy[] = ["artifact_first", "deterministic_pack"];
  if (
    decision.taskFidelityLevel === "deep_inspection" ||
    decision.taskFidelityLevel === "highest_fidelity_ingestion" ||
    decision.taskFidelityLevel === "highest_fidelity_creation" ||
    decision.taskFidelityLevel === "audit_grade_answer"
  ) {
    strategies.push("summary_then_excerpt");
  }
  if (decision.asyncRecommended) {
    strategies.push("defer_to_async");
  } else {
    strategies.push("cache_reuse_candidate");
  }
  return unique(strategies);
}

function buildWorkPlanSteps(decision: AgentControlDecision): {
  approvedActionsNow: AgentWorkPlanStep[];
  deferredActions: AgentWorkPlanStep[];
} {
  const approvedActionsNow: AgentWorkPlanStep[] = [];
  const deferredActions: AgentWorkPlanStep[] = [];

  approvedActionsNow.push({
    id: "resolve_context",
    label: "Resolve available context through the canonical resolver",
    owner: "conversation_context",
    state: "planned",
    reason: "Resolver-owned context assembly is available inside current policy.",
    traceEventIds: [],
  });

  approvedActionsNow.push({
    id: "assemble_progressive_context",
    label: "Assemble progressive context and assess sufficiency",
    owner: "progressive_assembly",
    state: "planned",
    reason: "Progressive assembly owns sufficiency decisions.",
    linkedPlanId: `assembly:${decision.decisionId}`,
    traceEventIds: [],
  });

  approvedActionsNow.push({
    id: "negotiate_adaptive_transport",
    label: "Negotiate adaptive context transport",
    owner: "adaptive_transport",
    state: "planned",
    reason: "Adaptive transport owns payload compatibility and lane exclusions.",
    linkedPlanId: `context-transport:${decision.decisionId}`,
    traceEventIds: [],
  });

  if (decision.asyncRecommended) {
    deferredActions.push({
      id: "async_deep_work",
      label: "Recommend async deep work",
      owner: "async_agent_work",
      state: "deferred",
      reason: decision.asyncRecommendedReason ?? "Deep work is outside the synchronous path.",
      traceEventIds: [],
    });
  }

  if (decision.externalEscalation.level !== "none") {
    deferredActions.push({
      id: "external_capability_expansion",
      label: "Record missing or gated external capability expansion",
      owner: "agent_control",
      state: decision.externalEscalation.level === "approval_required" ? "approval_required" : "deferred",
      reason: decision.externalEscalation.detail,
      traceEventIds: [],
    });
  }

  return { approvedActionsNow, deferredActions };
}

function buildWorkPlanDecisions(decision: AgentControlDecision): AgentWorkPlanDecision[] {
  const traceEventIds = decision.traceEvents.map((event, index) => `agent-control:${index}:${event.type}`);
  return [
    {
      id: "task_classification",
      type: "classification",
      state: "planned",
      reason: decision.taskFidelityLevel,
      detail: `Task classified as ${decision.taskFidelityLevel}.`,
      traceEventIds,
    },
    {
      id: "budget_mode",
      type: "budget",
      state: decision.approvalRequired ? "approval_required" : "planned",
      reason: decision.runtimeBudgetProfile,
      detail: decision.budgetExpansionRequest.detail,
      traceEventIds,
    },
    {
      id: "truthfulness_boundary",
      type: "truthfulness",
      state: "planned",
      reason: "no_trace_no_claim",
      detail: "Needed, recommended, unavailable, deferred, and approval-gated capabilities are not execution evidence.",
      traceEventIds,
    },
  ];
}

function buildWorkPlanLimitations(decision: AgentControlDecision): AgentWorkPlanLimitation[] {
  return [
    ...decision.defaultBudgetInsufficiencyReasons.map((summary, index) => ({
      id: `budget-limitation:${index}`,
      state: "needed" as const,
      summary,
      traceEventIds: [],
    })),
    ...decision.externalEscalation.capabilities.map((capability) => ({
      id: `capability-limitation:${capability}`,
      state: decision.externalEscalation.level === "approval_required" ? "approval_required" as const : "deferred" as const,
      summary: `Capability ${capability} is needed or recommended but not executed by this work plan.`,
      capability,
      traceEventIds: [],
    })),
  ];
}

export function buildAgentWorkPlanFromControlDecision(
  input: AgentWorkPlanProjectionInput
): AgentWorkPlan {
  const decision = input.decision;
  const capabilityNeeds = buildCapabilityNeeds(decision);
  const sourceNeeds = buildSourceNeeds(input);
  const modelCapabilityNeeds = [buildModelNeed(decision)];
  const steps = buildWorkPlanSteps(decision);
  const artifactPromotion = input.artifactPromotion ?? {
    candidateCount: 0,
    acceptedCount: 0,
    rejectedCount: 0,
  };

  return {
    planId: `agent-work-plan:${decision.decisionId}`,
    traceId: `agent-work-trace:${decision.decisionId}`,
    conversationId: input.conversationId ?? null,
    messageId: input.messageId ?? null,
    prompt: {
      preview: input.request?.slice(0, 240) ?? null,
      intentClassification: decision.taskFidelityLevel,
      taskType: workPlanTaskType(decision.taskFidelityLevel),
      outputExpectation: workPlanOutputExpectation(decision.taskFidelityLevel),
    },
    requiredFidelity: decision.taskFidelityLevel,
    answerReadiness: workPlanAnswerReadiness(decision),
    sourceCoverageTarget: decision.sourceCoverageTarget,
    memoryReuse: {
      state: decision.memoryDensity === "none" ? "unavailable" : "planned",
      memoryDensity: decision.memoryDensity,
      memoryRefreshDepth: decision.memoryRefreshDepth,
      artifactReuseIntent: decision.inspectionDepth === "artifact_reuse_only" ? "planned" : "needed",
      reason: decision.sourceFreshness.detail,
    },
    budget: {
      mode: decision.budgetMode,
      runtimeBudgetProfile: decision.runtimeBudgetProfile,
      contextTokens: {
        requested: decision.contextBudgetRequest.requestedTokens,
        granted: decision.contextBudgetRequest.grantedTokens,
        profileMax: decision.contextBudgetRequest.profileMaxTokens,
      },
      outputTokens: {
        requested: decision.outputBudgetRequest.requestedTokens,
        granted: decision.outputBudgetRequest.grantedTokens,
        profileMax: decision.outputBudgetRequest.profileMaxTokens,
      },
      toolCalls: {
        requested: decision.toolBudgetRequest.requestedToolCalls,
        granted: decision.toolBudgetRequest.grantedToolCalls,
      },
      runtimeMs: {
        requested: decision.runtimeBudgetRequest.requestedMs,
        granted: decision.runtimeBudgetRequest.grantedMs,
        syncCutoff: decision.runtimeBudgetRequest.syncCutoffMs,
      },
      compactionStrategies: buildCompactionStrategies(decision),
      promptCache: DEFAULT_CONTEXT_PROMPT_CACHE_STRATEGY,
    },
    sourceNeeds,
    capabilityNeeds,
    modelCapabilityNeeds,
    approvedActionsNow: steps.approvedActionsNow,
    deferredActions: steps.deferredActions,
    asyncRecommendation: {
      state: decision.asyncRecommended
        ? "deferred"
        : decision.approvalRequired
          ? "approval_required"
          : "unavailable",
      recommended: decision.asyncRecommended,
      reason: decision.asyncRecommendedReason,
    },
    artifactPromotion: {
      ...artifactPromotion,
      state: artifactPromotion.candidateCount > 0 ? "planned" : "unavailable",
      reason:
        artifactPromotion.candidateCount > 0
          ? "Artifact promotion candidates were proposed through the existing source-learning seam."
          : "No artifact promotion candidates are present in this turn-level plan.",
    },
    truthfulLimitations: buildWorkPlanLimitations(decision),
    unavailableCapabilities: capabilityNeeds.filter((need) => need.state === "unavailable"),
    decisions: buildWorkPlanDecisions(decision),
    plannerEvaluator: {
      status: "not_configured",
      noLlmPlanningExecuted: true,
      reason: "WP1 records a placeholder only; no bounded LLM planner/evaluator is executed.",
    },
    scopedPlanLinks: {
      agentControlDecisionId: decision.decisionId,
      assemblyPlanId: `assembly:${decision.decisionId}`,
      transportPlanId: `context-transport:${decision.decisionId}`,
      asyncWorkItemId: null,
      ...input.scopedPlanLinks,
    },
    noUnavailableToolExecutionClaimed: true,
  };
}

function buildModelCapabilityRequest(params: {
  model: (ModelBudgetProfileLookup & { mode?: ContextBudgetMode | null }) | null | undefined;
  profile: ModelBudgetProfile;
  fidelity: TaskFidelityLevel;
  contextExceeded: boolean;
}) {
  let requestedCapability: ModelCapabilityRequest["requestedCapability"] = "current_model_ok";
  let reason = "The current model budget profile is sufficient for the selected control path.";

  if (params.contextExceeded) {
    requestedCapability = "long_context";
    reason = "The task would benefit from a longer-context model or a staged context path.";
  } else if (params.fidelity === "audit_grade_answer") {
    requestedCapability = "audit_grade";
    reason = "Audit-grade work should prefer stronger reasoning and stricter grounding when policy allows.";
  } else if (params.fidelity === "deep_inspection") {
    requestedCapability = "tool_reliable";
    reason = "Deep inspection benefits from reliable tool-call handling and broker traceability.";
  } else if (params.fidelity === "highest_fidelity_creation" || params.fidelity === "highest_fidelity_ingestion") {
    requestedCapability = "strong_reasoning";
    reason = "Highest-fidelity work benefits from stronger reasoning, larger context, and staged validation.";
  }

  return {
    currentProvider: params.model?.provider ?? null,
    currentProtocol: params.model?.protocol ?? null,
    currentModel: params.model?.model ?? null,
    currentProfileId: params.profile.id,
    requestedCapability,
    requiresProviderChange: false,
    withinPolicy: !params.contextExceeded,
    reason,
  } satisfies ModelCapabilityRequest;
}

function externalEscalationRecommendation(params: {
  kind: ReturnType<typeof determineTaskKind>;
  policy: AgentControlPolicy;
}) {
  const capabilities = unique(params.kind.recommendedCapabilities);
  const hasCapabilities = capabilities.length > 0;
  const dataEgressRisk = hasCapabilities && capabilities.some((capability) =>
    ["rendered_page_inspection", "ocr", "vision_page_understanding", "document_ai_table_recovery"].includes(capability)
  );
  let level: ExternalEscalationRecommendation["level"] = "none";
  let detail = "No external escalation is recommended for this control decision.";

  if (hasCapabilities) {
    level = params.policy.requireApprovalForExternalEscalation ? "approval_required" : "recommended";
    detail =
      "A-04b/A-04c may have recorded unmet or next capabilities; this control decision can recommend them but does not execute unapproved external tools.";
  }

  if (params.kind.restrictedData && dataEgressRisk && params.policy.blockRestrictedDataExternalEscalation) {
    level = "blocked_by_policy";
    detail =
      "Restricted data cannot be sent to external inspection capabilities under the current policy-configured boundary.";
  }

  return {
    level,
    capabilities,
    unavailableOrUnapproved: hasCapabilities,
    dataEgressRisk,
    externalMutationRisk: params.kind.externalMutation,
    detail,
  } satisfies ExternalEscalationRecommendation;
}

function costExceedsPolicy(requested: ControlCostClass, max: ControlCostClass) {
  return COST_CLASS_ORDER[requested] > COST_CLASS_ORDER[max];
}

function requestedProfileAllowed(profile: RuntimeBudgetProfile, policy: AgentControlPolicy) {
  return policy.allowedBudgetProfiles.includes(profile);
}

export class AgentControlSurface {
  evaluate(input: AgentControlEvaluationInput): AgentControlDecision {
    const request = normalizeRequest(input.request);
    const lower = request.toLowerCase();
    const modelLookup = input.model ?? null;
    const profile = modelLookup ? resolveModelBudgetProfile(modelLookup) : DEFAULT_MODEL_BUDGET_PROFILE;
    const mode = normalizeContextBudgetMode(modelLookup?.mode, "standard");
    const policy = normalizePolicy(input.policy, profile);
    const policyLimits = buildPolicyLimits(policy, profile);
    const sourceSignals = input.sourceSignals ?? [];
    const kind = determineTaskKind(request, sourceSignals);
    const fidelity = classifyFidelity(kind);
    const requestedRuntimeProfile = chooseRuntimeProfile({
      taskFidelityLevel: fidelity,
      tableBodyMissing: kind.tableBodyMissing,
    });
    const runtimeBudgetProfile = requestedProfileAllowed(requestedRuntimeProfile, policy)
      ? requestedRuntimeProfile
      : "approval_required_expansion";
    const plan = PROFILE_PLAN[runtimeBudgetProfile];
    const depths = chooseDepths({ fidelity, kind, sourceSignals });
    const budgetRequests = buildBudgetRequests({
      profile,
      mode,
      runtimeBudgetProfile,
      policy,
    });
    const freshness = sourceFreshnessSummary(sourceSignals);
    const externalEscalation = externalEscalationRecommendation({ kind, policy });
    const approvalReasons: ApprovalRequiredReason[] = [];
    const blockedReasons: string[] = [];
    const reasons: ControlDecisionReason[] = [];
    const defaultBudgetInsufficiencyReasons: string[] = [];

    if (fidelity === "highest_fidelity_ingestion") {
      reasons.push("request_mentions_highest_fidelity_ingestion");
    }
    if (fidelity === "highest_fidelity_creation") {
      reasons.push("request_mentions_highest_fidelity_creation");
    }
    if (fidelity === "audit_grade_answer") {
      reasons.push("request_mentions_audit_or_verification");
    }
    if (kind.weakArtifact) {
      reasons.push("weak_artifact_requires_deeper_inspection");
    }
    if (freshness.evaluated) {
      reasons.push(kind.staleArtifact ? "stale_artifacts_require_refresh" : "source_freshness_requires_check");
    }

    if (runtimeBudgetProfile !== "default_chat") {
      reasons.push("default_budget_insufficient");
      defaultBudgetInsufficiencyReasons.push(`Task fidelity ${fidelity} selected ${runtimeBudgetProfile}.`);
    } else {
      reasons.push("default_budget_sufficient");
    }

    if (budgetRequests.contextBudgetRequest.exceedsPolicy) {
      approvalReasons.push("exceeds_context_budget");
      defaultBudgetInsufficiencyReasons.push("Requested context tokens exceed the active policy/model ceiling.");
    }
    if (budgetRequests.outputBudgetRequest.exceedsPolicy) {
      approvalReasons.push("exceeds_output_budget");
      defaultBudgetInsufficiencyReasons.push("Requested output tokens exceed the active policy/model ceiling.");
    }
    if (budgetRequests.toolBudgetRequest.exceedsPolicy) {
      approvalReasons.push("exceeds_tool_budget");
      defaultBudgetInsufficiencyReasons.push("Requested tool calls exceed the active policy ceiling.");
    }
    if (budgetRequests.runtimeBudgetRequest.exceedsPolicy) {
      approvalReasons.push("exceeds_runtime_limit");
      defaultBudgetInsufficiencyReasons.push("Requested runtime exceeds the active policy ceiling.");
    }
    if (costExceedsPolicy(plan.costClass, policy.maxCostClass)) {
      approvalReasons.push("exceeds_cost_limit");
      defaultBudgetInsufficiencyReasons.push(`Requested cost class ${plan.costClass} exceeds policy ${policy.maxCostClass}.`);
    }
    if (!requestedProfileAllowed(requestedRuntimeProfile, policy)) {
      approvalReasons.push("policy_uncertain");
      defaultBudgetInsufficiencyReasons.push(`Requested budget profile ${requestedRuntimeProfile} is not currently allowed.`);
    }
    if (kind.restrictedData) {
      approvalReasons.push("restricted_data");
      reasons.push("restricted_data_requires_policy_decision");
    }
    if (externalEscalation.level === "approval_required") {
      approvalReasons.push("external_tool_required");
      if (externalEscalation.dataEgressRisk) {
        approvalReasons.push("external_data_egress");
      }
      reasons.push("external_escalation_recommended_but_not_executed");
    }
    if (kind.externalMutation && policy.requireApprovalForExternalMutation) {
      approvalReasons.push("external_mutation");
      reasons.push("external_mutation_requires_approval");
    }
    if (kind.codeExecution && policy.blockCodeExecution) {
      approvalReasons.push("code_execution");
      blockedReasons.push("Code execution requires a future approved sandbox boundary and is blocked in this pass.");
    }
    if (depths.memoryDensity === "dense_source_memory" && policy.requireApprovalForDenseMemory) {
      approvalReasons.push("dense_memory_creation");
    }
    if (!policy.allowedMemoryDensities.includes(depths.memoryDensity)) {
      approvalReasons.push("dense_memory_creation");
      defaultBudgetInsufficiencyReasons.push(`Memory density ${depths.memoryDensity} is not allowed by current policy.`);
    }
    if (!policy.allowedSourceCoverageTargets.includes(depths.sourceCoverageTarget)) {
      approvalReasons.push("source_coverage_too_large");
      defaultBudgetInsufficiencyReasons.push(`Source coverage target ${depths.sourceCoverageTarget} is not allowed by current policy.`);
    }
    if (fidelity === "audit_grade_answer") {
      approvalReasons.push("audit_grade_required");
    }
    if (externalEscalation.level === "blocked_by_policy") {
      blockedReasons.push(externalEscalation.detail);
      reasons.push("blocked_by_hard_boundary");
    }

    if (input.untrustedSourceContent || sourceSignals.some((signal) => signal.containsUntrustedInstructions)) {
      reasons.push("untrusted_source_content_treated_as_data");
    }

    if (
      budgetRequests.contextBudgetRequest.exceedsPolicy ||
      budgetRequests.outputBudgetRequest.exceedsPolicy ||
      budgetRequests.toolBudgetRequest.exceedsPolicy ||
      budgetRequests.runtimeBudgetRequest.exceedsPolicy ||
      !requestedProfileAllowed(requestedRuntimeProfile, policy)
    ) {
      reasons.push("policy_limit_prevents_silent_expansion");
    }

    const uniqueApprovalReasons = unique(approvalReasons);
    const blockedByPolicy = blockedReasons.length > 0;
    const approvalRequired = uniqueApprovalReasons.length > 0;
    const executionMode = deriveExecutionMode({
      approvalRequired,
      blockedByPolicy,
      runtimeBudgetRequest: budgetRequests.runtimeBudgetRequest,
      policy,
      profile: runtimeBudgetProfile,
    });
    const asyncRecommended = executionMode === "async_recommended";
    const agenticControlRequests = [
      runtimeBudgetProfile !== "default_chat"
        ? buildAgenticRequest(
            "runtime_budget_profile_request",
            "Runtime budget profile request",
            `Agent requested ${runtimeBudgetProfile} for ${fidelity}.`
          )
        : null,
      budgetRequests.contextBudgetRequest.requestedTokens > budgetRequests.defaultContextTokens
        ? buildAgenticRequest(
            "context_budget_request",
            "Context budget request",
            `Agent requested ${budgetRequests.contextBudgetRequest.requestedTokens} context tokens.`
          )
        : null,
      budgetRequests.outputBudgetRequest.requestedTokens > CHAT_REPLY_MAX_OUTPUT_TOKENS
        ? buildAgenticRequest(
            "output_budget_request",
            "Output budget request",
            `Agent requested ${budgetRequests.outputBudgetRequest.requestedTokens} output tokens.`
          )
        : null,
      budgetRequests.toolBudgetRequest.requestedToolCalls > policy.defaultToolCallLimit
        ? buildAgenticRequest(
            "tool_budget_request",
            "Tool-call budget request",
            `Agent requested up to ${budgetRequests.toolBudgetRequest.requestedToolCalls} tool calls.`
          )
        : null,
      buildAgenticRequest(
        "fidelity_depth_request",
        "Fidelity and depth request",
        `Agent selected inspection=${depths.inspectionDepth}, creation=${depths.creationDepth}, validation=${depths.validationDepth}, memory=${depths.memoryDensity}.`
      ),
    ].filter((entry): entry is ControlBoundary => entry !== null);

    const traceEvents: ControlTraceEvent[] = [
      buildTraceEvent({
        type: "task_classified",
        reason: reasons.includes("default_budget_insufficient")
          ? "default_budget_insufficient"
          : "default_budget_sufficient",
        detail: `Task classified as ${fidelity}; selected control profile ${runtimeBudgetProfile}.`,
        metadata: { requestPreview: request.slice(0, 160), taskFidelityLevel: fidelity, runtimeBudgetProfile },
      }),
      ...HARD_BOUNDARIES.map((boundary) =>
        buildTraceEvent({
          type: "boundary_applied" as const,
          reason:
            boundary.id === "untrusted_source_content_boundary"
              ? "untrusted_source_content_treated_as_data"
              : "policy_limit_prevents_silent_expansion",
          detail: boundary.detail,
          metadata: { boundaryId: boundary.id },
        })
      ),
      ...policyLimits.map((limit) =>
        buildTraceEvent({
          type: "policy_limit_applied" as const,
          reason: "policy_limit_prevents_silent_expansion",
          detail: limit.detail,
          metadata: { limitId: limit.id, value: limit.value },
        })
      ),
      ...agenticControlRequests.map((control) =>
        buildTraceEvent({
          type: "agentic_control_requested" as const,
          reason: runtimeBudgetProfile === "default_chat" ? "default_budget_sufficient" : "default_budget_insufficient",
          detail: control.detail,
          metadata: { controlId: control.id },
        })
      ),
      buildTraceEvent({
        type: "tool_governance_referenced",
        reason: kind.hasExternalRecommendation
          ? "external_escalation_recommended_but_not_executed"
          : "policy_limit_prevents_silent_expansion",
        detail:
          "Control recommendations defer execution eligibility to the A-04b/A-04c broker/governance layer and do not execute unapproved tools.",
        metadata: {
          recommendedCapabilities: kind.recommendedCapabilities,
          externalEscalationLevel: externalEscalation.level,
        },
      }),
    ];

    if (input.untrustedSourceContent || sourceSignals.some((signal) => signal.containsUntrustedInstructions)) {
      traceEvents.push(
        buildTraceEvent({
          type: "untrusted_content_ignored",
          reason: "untrusted_source_content_treated_as_data",
          detail: "Source-embedded instructions were classified as source content and did not alter control boundaries.",
          metadata: { sourceContentPreview: input.untrustedSourceContent?.slice(0, 160) ?? null },
        })
      );
    }

    if (freshness.evaluated) {
      traceEvents.push(
        buildTraceEvent({
          type: "source_freshness_evaluated",
          reason: kind.staleArtifact ? "stale_artifacts_require_refresh" : "source_freshness_requires_check",
          detail: freshness.detail,
          metadata: freshness,
        })
      );
    }

    if (asyncRecommended) {
      traceEvents.push(
        buildTraceEvent({
          type: "async_recommended",
          reason: "default_budget_insufficient",
          detail: "The task should be staged or moved to a future async queue; no async queue is executed in this pass.",
          metadata: { requestedRuntimeMs: budgetRequests.runtimeBudgetRequest.requestedMs },
        })
      );
    }

    if (blockedByPolicy) {
      traceEvents.push(
        buildTraceEvent({
          type: "blocked_by_policy",
          reason: "blocked_by_hard_boundary",
          detail: blockedReasons.join(" "),
          metadata: { blockedReasons },
        })
      );
    }

    const approvalPacketDraft = buildApprovalPacket({
      reasons: uniqueApprovalReasons,
      profile: runtimeBudgetProfile,
      contextBudgetRequest: budgetRequests.contextBudgetRequest,
      outputBudgetRequest: budgetRequests.outputBudgetRequest,
      toolBudgetRequest: budgetRequests.toolBudgetRequest,
      runtimeBudgetRequest: budgetRequests.runtimeBudgetRequest,
      externalEscalation,
      policyLimits,
    });

    if (approvalPacketDraft) {
      traceEvents.push(
        buildTraceEvent({
          type: "approval_packet_prepared",
          reason: "policy_limit_prevents_silent_expansion",
          detail: "Prepared a lightweight approval packet draft; no approval workflow was executed.",
          metadata: { approvalPacketId: approvalPacketDraft.id, reasons: approvalPacketDraft.reasons },
        })
      );
    }

    return {
      decisionId: `agent-control:${input.conversationId ?? "runtime"}:${runtimeBudgetProfile}`,
      taskFidelityLevel: fidelity,
      runtimeBudgetProfile,
      budgetMode: mode,
      budgetExpansionRequest: {
        requestedProfile: requestedRuntimeProfile,
        approvedProfile: approvalRequired || blockedByPolicy ? "approval_required_expansion" : runtimeBudgetProfile,
        approvalRequired,
        reasons: uniqueApprovalReasons,
        detail: approvalRequired
          ? "The agent requested a higher-control path, but at least one policy-configured boundary requires approval."
          : "The agent control request remains inside current policy-configured limits.",
      },
      contextBudgetRequest: budgetRequests.contextBudgetRequest,
      outputBudgetRequest: budgetRequests.outputBudgetRequest,
      toolBudgetRequest: budgetRequests.toolBudgetRequest,
      runtimeBudgetRequest: budgetRequests.runtimeBudgetRequest,
      inspectionDepth: depths.inspectionDepth,
      creationDepth: depths.creationDepth,
      validationDepth: depths.validationDepth,
      memoryDensity: depths.memoryDensity,
      sourceCoverageTarget: depths.sourceCoverageTarget,
      memoryRefreshDepth: depths.memoryRefreshDepth,
      modelCapabilityRequest: buildModelCapabilityRequest({
        model: modelLookup,
        profile,
        fidelity,
        contextExceeded: budgetRequests.contextBudgetRequest.exceedsPolicy,
      }),
      executionMode,
      approvalRequired,
      approvalRequiredReasons: uniqueApprovalReasons,
      asyncRecommended,
      asyncRecommendedReason: asyncRecommended
        ? "Requested runtime or fidelity exceeds the synchronous cutoff; future async/staged execution is recommended."
        : null,
      blockedByPolicy,
      blockedByPolicyReasons: blockedReasons,
      defaultBudgetSufficient: !reasons.includes("default_budget_insufficient") && uniqueApprovalReasons.length === 0,
      defaultBudgetInsufficiencyReasons,
      hardBoundariesApplied: HARD_BOUNDARIES.map((boundary) => ({ ...boundary })),
      policyConfiguredLimitsApplied: policyLimits,
      agenticControlRequests,
      externalEscalation,
      toolGovernance: {
        brokerGoverned: true,
        approvedToolsOnly: true,
        executedUnapprovedTool: false,
        recommendedCapabilities: kind.recommendedCapabilities,
        unmetCapabilities: unique(sourceSignals.flatMap((signal) => signal.unmetCapabilities ?? [])),
        detail:
          "A-04d can recommend deeper inspection or escalation, while A-04b/A-04c remain the execution gate for approved eligible tools.",
      },
      dataEgressRisk: externalEscalation.dataEgressRisk,
      externalMutationRisk: kind.externalMutation,
      untrustedContentHandling:
        lower || input.untrustedSourceContent || sourceSignals.some((signal) => signal.containsUntrustedInstructions)
          ? "Source content is treated as data and cannot override system, developer, user, policy, approval, or tool-governance boundaries."
          : "No source-content instruction risk was detected in the control inputs.",
      sourceFreshness: freshness,
      reasons: unique(reasons),
      traceEvents,
      approvalPacketDraft,
    };
  }
}

export function evaluateAgentControlSurface(input: AgentControlEvaluationInput) {
  return new AgentControlSurface().evaluate(input);
}
