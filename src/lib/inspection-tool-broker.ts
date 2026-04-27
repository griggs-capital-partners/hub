export type InspectionCapability =
  | "text_extraction"
  | "pdf_page_classification"
  | "pdf_table_detection"
  | "pdf_table_body_recovery"
  | "rendered_page_inspection"
  | "ocr"
  | "vision_page_understanding"
  | "document_ai_table_recovery"
  | "geometry_layout_extraction"
  | "spreadsheet_inventory"
  | "spreadsheet_formula_map"
  | "docx_structure_extraction"
  | "pptx_slide_inventory"
  | "web_snapshot"
  | "source_connector_read"
  | "code_repository_inspection"
  | "artifact_summarization"
  | "artifact_validation";

export type ToolApprovalStatus = "built_in" | "approved" | "proposed" | "blocked" | "deprecated";

export type ToolRuntimeClass =
  | "local"
  | "local_sandboxed"
  | "external_api"
  | "mcp_server"
  | "saas_broker"
  | "model_provider"
  | "browser_automation"
  | "code_sandbox"
  | "connector";

export type ToolExecutionBoundary =
  | "in_process"
  | "local_process"
  | "external_api"
  | "mcp_server"
  | "saas_connector"
  | "sandbox"
  | "model_provider"
  | "browser_automation"
  | "code_sandbox"
  | "connector";

export type ToolDataClass = "public" | "internal" | "confidential" | "restricted";

export type ToolSideEffectLevel =
  | "read_only"
  | "creates_internal_artifact"
  | "writes_internal_state"
  | "mutates_external_source"
  | "sends_external_message"
  | "executes_code";

export type ToolCostClass = "free_local" | "low" | "medium" | "high" | "variable";

export type ToolLatencyClass = "sync_safe" | "async_preferred" | "batch_only";

export type ToolPermissionGrant =
  | "network"
  | "user_approval"
  | "admin_approval"
  | "read_source_document"
  | "write_artifacts"
  | "tenant_scope"
  | "external_execution"
  | "execute_code";

export type ToolPermissionRequirement = {
  requiresNetwork: boolean;
  requiresUserApproval: boolean;
  requiresAdminApproval: boolean;
  readsSourceDocument: boolean;
  writesArtifacts: boolean;
  tenantScoped: boolean;
};

export type ToolDataPolicy = {
  allowedDataClasses: ToolDataClass[];
  tenantScoped: boolean;
  leavesTenantBoundary: boolean;
  storesExternalCopy: boolean;
};

export type ToolCostEstimate = {
  costClass: ToolCostClass;
  metered: boolean;
  unitLabel: string | null;
  estimatedUnitCostUsd: number | null;
};

export type ToolFallbackPolicy = {
  fallbackCapabilities: InspectionCapability[];
  recommendWhenConfidenceBelow: number | null;
  fallbackRecommendation: string | null;
};

export type CapabilityCard = {
  id: InspectionCapability;
  label: string;
  description: string;
  artifactKinds: string[];
  recommendedFallbackCapabilities: InspectionCapability[];
  benchmarkFixtureIds: string[];
  requiresApprovalForExternalExecution: boolean;
};

export type ToolCard = {
  id: string;
  label: string;
  description: string;
  capabilities: InspectionCapability[];
  sourceTypes: string[];
  approvalStatus: ToolApprovalStatus;
  runtimeClass: ToolRuntimeClass;
  executionBoundary: ToolExecutionBoundary;
  dataPolicy: ToolDataPolicy;
  sideEffectLevel: ToolSideEffectLevel;
  permissionRequirement: ToolPermissionRequirement;
  costEstimate: ToolCostEstimate;
  latencyClass: ToolLatencyClass;
  artifactContracts: string[];
  benchmarkFixtureIds: string[];
  fallbackPolicy: ToolFallbackPolicy;
  reliability: number;
  reusableResult: boolean;
  limitations: string[];
  selectionPriority: number;
};

export type ToolBenchmarkFixture = {
  id: string;
  label: string;
  description: string;
  status: "active" | "pending";
  linkedCapabilities: InspectionCapability[];
  linkedToolIds: string[];
  acceptanceCriteria: string[];
};

export type ToolBenchmarkResult = {
  fixtureId: string;
  toolId: string;
  capability: InspectionCapability;
  status: "pass" | "fail" | "pending" | "not_applicable";
  summary: string;
  evidence: Record<string, unknown>;
};

export type ToolEligibilityPolicy = {
  allowedRuntimeClasses: ToolRuntimeClass[];
  availableRuntimeClasses: ToolRuntimeClass[];
  allowedBoundaries: ToolExecutionBoundary[];
  allowedDataClasses: ToolDataClass[];
  allowedSideEffectLevels: ToolSideEffectLevel[];
  maxCostClass: ToolCostClass;
  maxLatencyClass: ToolLatencyClass;
  grantedPermissions: ToolPermissionGrant[];
};

export type ToolSelectionPolicy = ToolEligibilityPolicy & {
  preferReusableResults: boolean;
  allowUnapprovedTools: false;
};

export type ToolCapabilityScore = {
  toolId: string;
  capability: InspectionCapability;
  score: number;
  reasons: string[];
  limitations: string[];
};

export type ToolEligibilityDecision = {
  toolId: string;
  eligible: boolean;
  reasons: string[];
  approvalStatus: ToolApprovalStatus;
  runtimeClass: ToolRuntimeClass;
  executionBoundary: ToolExecutionBoundary;
  dataPolicy: ToolDataPolicy;
  sideEffectLevel: ToolSideEffectLevel;
  costClass: ToolCostClass;
  latencyClass: ToolLatencyClass;
  benchmarkFixtureIds: string[];
  artifactContracts: string[];
};

export type ToolGovernanceTrace = {
  requestedCapability: InspectionCapability;
  sourceDocumentId: string;
  sourceType: string;
  dataClass: ToolDataClass;
  candidateTools: string[];
  eligibleTools: string[];
  ineligibleTools: ToolEligibilityDecision[];
  eligibilityDecisions: ToolEligibilityDecision[];
  selectedTool: string | null;
  selectionPolicy: Omit<ToolSelectionPolicy, "grantedPermissions"> & {
    grantedPermissions: ToolPermissionGrant[];
  };
  unmetCapabilityReviewItem: UnmetCapabilityReviewItem | null;
  executedUnapprovedTool: false;
};

export type ToolTraceEvent = {
  type:
    | "capability_requested"
    | "tool_selected"
    | "tool_rejected"
    | "tool_executed"
    | "unmet_capability_recorded";
  timestamp: string;
  capability: InspectionCapability;
  toolId: string | null;
  detail: string;
  metadata: Record<string, unknown> | null;
};

export type ToolRecommendation = {
  capability: InspectionCapability;
  label: string;
  rationale: string;
  approvalRequired: boolean;
  exampleToolPaths: string[];
};

export type UnmetCapabilityReviewItem = {
  requestedCapability: InspectionCapability;
  sourceDocumentId: string;
  sourceType: string;
  taskPurpose: string;
  location: Record<string, unknown> | null;
  insufficiencyReasons: string[];
  recommendedNextCapabilities: InspectionCapability[];
  candidateToolCategories: ToolRuntimeClass[];
  externalExecutionRequired: boolean;
  dataSecurityConsiderations: string[];
  benchmarkFixtureNeeded: string[];
  executedUnapprovedTool: false;
};

export type UnmetCapability = {
  capability: InspectionCapability;
  sourceDocumentId: string;
  sourceType: string;
  reason: string;
  recommendedNextCapabilities: InspectionCapability[];
  proposedToolPaths: string[];
  recordedForAdminReview: boolean;
  executedUnapprovedTool: false;
  reviewItem: UnmetCapabilityReviewItem;
};

export type InspectionToolInvocation = {
  invocationId: string;
  sourceDocumentId: string;
  sourceType: string;
  requestedCapability: InspectionCapability;
  purpose: string;
  input: Record<string, unknown>;
  location: Record<string, unknown> | null;
  dataClass?: ToolDataClass;
  recommendedNextCapabilities?: InspectionCapability[];
  proposedToolPaths?: string[];
};

export type InspectionToolResultStatus = "completed" | "failed" | "unmet";

export type InspectionToolResult = {
  invocation: InspectionToolInvocation;
  status: InspectionToolResultStatus;
  requestedCapability: InspectionCapability;
  selectedTool: InspectionToolDefinition | null;
  selectionReason: string;
  selectionScore: ToolCapabilityScore | null;
  candidateScores: ToolCapabilityScore[];
  rejectedToolIds: string[];
  eligibleTools: ToolEligibilityDecision[];
  ineligibleTools: ToolEligibilityDecision[];
  governanceTrace: ToolGovernanceTrace;
  confidence: number | null;
  summary: string | null;
  output: Record<string, unknown>;
  limitations: string[];
  fallbackRecommendation: string | null;
  recommendedNextCapabilities: InspectionCapability[];
  reusable: boolean;
  traceEvents: ToolTraceEvent[];
  unmetCapability: UnmetCapability | null;
  unmetCapabilityReviewItem: UnmetCapabilityReviewItem | null;
};

export type InspectionToolExecute = (params: {
  invocation: InspectionToolInvocation;
  tool: InspectionToolDefinition;
}) => InspectionToolResult;

export type InspectionToolDefinition = {
  id: string;
  label: string;
  description: string;
  capabilities: InspectionCapability[];
  sourceTypes: string[];
  approvalStatus: ToolApprovalStatus;
  runtimeClass: ToolRuntimeClass;
  executionBoundary: ToolExecutionBoundary;
  dataPolicy: ToolDataPolicy;
  sideEffectLevel: ToolSideEffectLevel;
  permissionRequirement: ToolPermissionRequirement;
  costEstimate: ToolCostEstimate;
  latencyClass: ToolLatencyClass;
  fallbackPolicy: ToolFallbackPolicy;
  reliability: number;
  reusableResult: boolean;
  artifactContract: string | null;
  artifactContracts: string[];
  benchmarkFixtureIds: string[];
  toolCard: ToolCard;
  limitations: string[];
  selectionPriority: number;
  execute?: InspectionToolExecute;
};

export type ToolSelectionResult = {
  selectedTool: InspectionToolDefinition | null;
  selectionReason: string;
  selectedScore: ToolCapabilityScore | null;
  candidateScores: ToolCapabilityScore[];
  rejectedToolIds: string[];
  eligibleTools: ToolEligibilityDecision[];
  ineligibleTools: ToolEligibilityDecision[];
  governanceTrace: ToolGovernanceTrace;
  traceEvents: ToolTraceEvent[];
  unmetCapability: UnmetCapability | null;
  unmetCapabilityReviewItem: UnmetCapabilityReviewItem | null;
};

const EXECUTABLE_APPROVAL_STATUSES: ToolApprovalStatus[] = ["built_in", "approved"];

const DEFAULT_SELECTION_POLICY: ToolSelectionPolicy = {
  allowedRuntimeClasses: ["local", "local_sandboxed"],
  availableRuntimeClasses: ["local", "local_sandboxed"],
  allowedBoundaries: ["in_process", "local_process"],
  allowedDataClasses: ["public", "internal", "confidential"],
  allowedSideEffectLevels: ["read_only", "creates_internal_artifact", "writes_internal_state"],
  maxCostClass: "variable",
  maxLatencyClass: "sync_safe",
  grantedPermissions: ["read_source_document", "write_artifacts", "tenant_scope"],
  preferReusableResults: true,
  allowUnapprovedTools: false,
};

const COST_CLASS_ORDER: Record<ToolCostClass, number> = {
  free_local: 0,
  low: 1,
  medium: 2,
  high: 3,
  variable: 4,
};

const LATENCY_CLASS_ORDER: Record<ToolLatencyClass, number> = {
  sync_safe: 0,
  async_preferred: 1,
  batch_only: 2,
};

const RUNTIME_CLASS_SCORE: Record<ToolRuntimeClass, number> = {
  local: 12,
  local_sandboxed: 10,
  connector: 7,
  model_provider: 6,
  code_sandbox: 5,
  browser_automation: 5,
  mcp_server: 4,
  saas_broker: 3,
  external_api: 2,
};

const EXTERNAL_RUNTIME_CLASSES = new Set<ToolRuntimeClass>([
  "external_api",
  "mcp_server",
  "saas_broker",
  "model_provider",
  "browser_automation",
  "code_sandbox",
  "connector",
]);

const DEFAULT_RECOMMENDED_CAPABILITIES: Partial<Record<InspectionCapability, InspectionCapability[]>> = {
  pdf_table_body_recovery: [
    "rendered_page_inspection",
    "ocr",
    "vision_page_understanding",
    "document_ai_table_recovery",
  ],
  rendered_page_inspection: ["vision_page_understanding", "document_ai_table_recovery"],
  ocr: ["vision_page_understanding", "document_ai_table_recovery"],
  vision_page_understanding: ["document_ai_table_recovery"],
  document_ai_table_recovery: ["ocr", "vision_page_understanding"],
};

const DEFAULT_PROPOSED_TOOL_PATHS: Partial<Record<InspectionCapability, string[]>> = {
  rendered_page_inspection: ["approved rendered-page inspection capability"],
  ocr: ["approved OCR capability"],
  vision_page_understanding: ["approved vision model/provider capability"],
  document_ai_table_recovery: ["approved document AI table extraction capability"],
  pdf_table_body_recovery: [
    "approved rendered-page inspection capability",
    "approved OCR capability",
    "approved vision model/provider capability",
    "approved document AI table extraction capability",
  ],
};

const DEFAULT_CANDIDATE_TOOL_CATEGORIES: Partial<Record<InspectionCapability, ToolRuntimeClass[]>> = {
  rendered_page_inspection: ["browser_automation", "external_api", "model_provider"],
  ocr: ["external_api", "model_provider"],
  vision_page_understanding: ["model_provider", "external_api"],
  document_ai_table_recovery: ["external_api", "model_provider"],
  pdf_table_body_recovery: ["external_api", "model_provider", "browser_automation"],
};

const DEFAULT_BENCHMARK_FIXTURES_BY_CAPABILITY: Partial<Record<InspectionCapability, string[]>> = {
  pdf_table_detection: ["t5_pdf_page_15_visible_table"],
  artifact_validation: ["t5_pdf_page_15_visible_table"],
  pdf_table_body_recovery: ["t5_pdf_page_15_visible_table", "scanned_pdf_text_recovery"],
  rendered_page_inspection: ["js_rendered_web_page", "t5_pdf_page_15_visible_table"],
  ocr: ["scanned_pdf_text_recovery", "t5_pdf_page_15_visible_table"],
  vision_page_understanding: ["t5_pdf_page_15_visible_table", "chart_heavy_deck"],
  document_ai_table_recovery: ["t5_pdf_page_15_visible_table"],
};

function nowIso() {
  return new Date().toISOString();
}

function buildToolTraceEvent(params: Omit<ToolTraceEvent, "timestamp">): ToolTraceEvent {
  return {
    ...params,
    timestamp: nowIso(),
  };
}

function sourceTypeMatches(tool: InspectionToolDefinition, sourceType: string) {
  return tool.sourceTypes.includes("*") || tool.sourceTypes.includes(sourceType);
}

function costClassWithinLimit(costClass: ToolCostClass, maxCostClass: ToolCostClass) {
  return COST_CLASS_ORDER[costClass] <= COST_CLASS_ORDER[maxCostClass];
}

function latencyClassWithinLimit(latencyClass: ToolLatencyClass, maxLatencyClass: ToolLatencyClass) {
  return LATENCY_CLASS_ORDER[latencyClass] <= LATENCY_CLASS_ORDER[maxLatencyClass];
}

function compareToolScores(
  left: { tool: InspectionToolDefinition; score: ToolCapabilityScore },
  right: { tool: InspectionToolDefinition; score: ToolCapabilityScore }
) {
  return (
    right.score.score - left.score.score ||
    left.tool.selectionPriority - right.tool.selectionPriority ||
    left.tool.id.localeCompare(right.tool.id)
  );
}

function normalizePolicy(policy: Partial<ToolSelectionPolicy> | null | undefined): ToolSelectionPolicy {
  return {
    ...DEFAULT_SELECTION_POLICY,
    ...(policy ?? {}),
    allowUnapprovedTools: false,
  };
}

function defaultRecommendedCapabilities(invocation: InspectionToolInvocation) {
  return [
    ...(invocation.recommendedNextCapabilities ?? []),
    ...(DEFAULT_RECOMMENDED_CAPABILITIES[invocation.requestedCapability] ?? []),
  ].filter((capability, index, capabilities) => capabilities.indexOf(capability) === index);
}

function defaultProposedToolPaths(invocation: InspectionToolInvocation, capabilities: InspectionCapability[]) {
  return [
    ...(invocation.proposedToolPaths ?? []),
    ...capabilities.flatMap((capability) => DEFAULT_PROPOSED_TOOL_PATHS[capability] ?? []),
    ...(DEFAULT_PROPOSED_TOOL_PATHS[invocation.requestedCapability] ?? []),
  ].filter((path, index, paths) => paths.indexOf(path) === index);
}

function defaultCandidateToolCategories(
  invocation: InspectionToolInvocation,
  capabilities: InspectionCapability[],
  decisions: ToolEligibilityDecision[]
) {
  return [
    ...decisions.map((decision) => decision.runtimeClass),
    ...(DEFAULT_CANDIDATE_TOOL_CATEGORIES[invocation.requestedCapability] ?? []),
    ...capabilities.flatMap((capability) => DEFAULT_CANDIDATE_TOOL_CATEGORIES[capability] ?? []),
  ].filter((runtimeClass, index, runtimeClasses) => runtimeClasses.indexOf(runtimeClass) === index);
}

function defaultBenchmarkFixtures(invocation: InspectionToolInvocation, capabilities: InspectionCapability[]) {
  return [
    ...(DEFAULT_BENCHMARK_FIXTURES_BY_CAPABILITY[invocation.requestedCapability] ?? []),
    ...capabilities.flatMap((capability) => DEFAULT_BENCHMARK_FIXTURES_BY_CAPABILITY[capability] ?? []),
  ].filter((fixtureId, index, fixtureIds) => fixtureIds.indexOf(fixtureId) === index);
}

function permissionReasons(tool: InspectionToolDefinition, policy: ToolSelectionPolicy) {
  const grants = new Set(policy.grantedPermissions);
  const missing: string[] = [];

  if (tool.permissionRequirement.requiresNetwork && !grants.has("network")) {
    missing.push("network");
  }
  if (tool.permissionRequirement.requiresUserApproval && !grants.has("user_approval")) {
    missing.push("user_approval");
  }
  if (tool.permissionRequirement.requiresAdminApproval && !grants.has("admin_approval")) {
    missing.push("admin_approval");
  }
  if (tool.permissionRequirement.readsSourceDocument && !grants.has("read_source_document")) {
    missing.push("read_source_document");
  }
  if (tool.permissionRequirement.writesArtifacts && !grants.has("write_artifacts")) {
    missing.push("write_artifacts");
  }
  if (tool.permissionRequirement.tenantScoped && !grants.has("tenant_scope")) {
    missing.push("tenant_scope");
  }
  if (EXTERNAL_RUNTIME_CLASSES.has(tool.runtimeClass) && !grants.has("external_execution")) {
    missing.push("external_execution");
  }
  if (tool.sideEffectLevel === "executes_code" && !grants.has("execute_code")) {
    missing.push("execute_code");
  }

  return missing.map((permission) => `Missing required permission: ${permission}.`);
}

function evaluateToolEligibility(params: {
  tool: InspectionToolDefinition;
  invocation: InspectionToolInvocation;
  policy: ToolSelectionPolicy;
}): ToolEligibilityDecision {
  const { tool, invocation, policy } = params;
  const dataClass = invocation.dataClass ?? "internal";
  const rejectedReasons: string[] = [];

  if (!EXECUTABLE_APPROVAL_STATUSES.includes(tool.approvalStatus)) {
    rejectedReasons.push(
      `Approval status ${tool.approvalStatus} does not permit runtime execution.`
    );
  }

  if (!policy.allowedRuntimeClasses.includes(tool.runtimeClass)) {
    rejectedReasons.push(`Runtime class ${tool.runtimeClass} is not allowed by policy.`);
  }

  if (!policy.availableRuntimeClasses.includes(tool.runtimeClass)) {
    rejectedReasons.push(`Runtime class ${tool.runtimeClass} is not available in this execution boundary.`);
  }

  if (!policy.allowedBoundaries.includes(tool.executionBoundary)) {
    rejectedReasons.push(`Execution boundary ${tool.executionBoundary} is not allowed by policy.`);
  }

  if (!sourceTypeMatches(tool, invocation.sourceType)) {
    rejectedReasons.push(`Tool does not support source type ${invocation.sourceType}.`);
  }

  if (!policy.allowedDataClasses.includes(dataClass)) {
    rejectedReasons.push(`Task data class ${dataClass} is not allowed by policy.`);
  }

  if (!tool.dataPolicy.allowedDataClasses.includes(dataClass)) {
    rejectedReasons.push(`Tool data policy does not allow ${dataClass} sources.`);
  }

  if (!policy.allowedSideEffectLevels.includes(tool.sideEffectLevel)) {
    rejectedReasons.push(`Side effect level ${tool.sideEffectLevel} is not allowed by policy.`);
  }

  if (!costClassWithinLimit(tool.costEstimate.costClass, policy.maxCostClass)) {
    rejectedReasons.push(`Tool cost class ${tool.costEstimate.costClass} exceeds policy.`);
  }

  if (!latencyClassWithinLimit(tool.latencyClass, policy.maxLatencyClass)) {
    rejectedReasons.push(`Tool latency class ${tool.latencyClass} exceeds policy.`);
  }

  rejectedReasons.push(...permissionReasons(tool, policy));

  return {
    toolId: tool.id,
    eligible: rejectedReasons.length === 0,
    reasons:
      rejectedReasons.length > 0
        ? rejectedReasons
        : [
            `Approval status ${tool.approvalStatus} permits execution.`,
            `Runtime class ${tool.runtimeClass} is available.`,
            `Data class ${dataClass} is allowed.`,
            `Side effect level ${tool.sideEffectLevel} is allowed.`,
            `Cost class ${tool.costEstimate.costClass} is within policy.`,
            `Latency class ${tool.latencyClass} is within policy.`,
          ],
    approvalStatus: tool.approvalStatus,
    runtimeClass: tool.runtimeClass,
    executionBoundary: tool.executionBoundary,
    dataPolicy: tool.dataPolicy,
    sideEffectLevel: tool.sideEffectLevel,
    costClass: tool.costEstimate.costClass,
    latencyClass: tool.latencyClass,
    benchmarkFixtureIds: [...tool.benchmarkFixtureIds],
    artifactContracts: [...tool.artifactContracts],
  };
}

function buildGovernanceTrace(params: {
  invocation: InspectionToolInvocation;
  policy: ToolSelectionPolicy;
  decisions: ToolEligibilityDecision[];
  selectedToolId: string | null;
  unmetCapabilityReviewItem: UnmetCapabilityReviewItem | null;
}): ToolGovernanceTrace {
  return {
    requestedCapability: params.invocation.requestedCapability,
    sourceDocumentId: params.invocation.sourceDocumentId,
    sourceType: params.invocation.sourceType,
    dataClass: params.invocation.dataClass ?? "internal",
    candidateTools: params.decisions.map((decision) => decision.toolId),
    eligibleTools: params.decisions.filter((decision) => decision.eligible).map((decision) => decision.toolId),
    ineligibleTools: params.decisions.filter((decision) => !decision.eligible),
    eligibilityDecisions: params.decisions,
    selectedTool: params.selectedToolId,
    selectionPolicy: {
      ...params.policy,
      grantedPermissions: [...params.policy.grantedPermissions],
    },
    unmetCapabilityReviewItem: params.unmetCapabilityReviewItem,
    executedUnapprovedTool: false,
  };
}

function buildEmptyGovernanceTrace(invocation: InspectionToolInvocation): ToolGovernanceTrace {
  const policy = normalizePolicy(null);

  return buildGovernanceTrace({
    invocation,
    policy,
    decisions: [],
    selectedToolId: null,
    unmetCapabilityReviewItem: null,
  });
}

function buildUnmetCapabilityReviewItem(params: {
  invocation: InspectionToolInvocation;
  decisions: ToolEligibilityDecision[];
  recommendedNextCapabilities: InspectionCapability[];
}) {
  const insufficiencyReasons =
    params.decisions.length === 0
      ? ["No registered tool advertises the requested capability."]
      : params.decisions.flatMap((decision) =>
          decision.eligible ? [] : decision.reasons.map((reason) => `${decision.toolId}: ${reason}`)
        );
  const candidateToolCategories = defaultCandidateToolCategories(
    params.invocation,
    params.recommendedNextCapabilities,
    params.decisions
  );
  const externalExecutionRequired = candidateToolCategories.some((runtimeClass) =>
    EXTERNAL_RUNTIME_CLASSES.has(runtimeClass)
  );
  const dataClass = params.invocation.dataClass ?? "internal";

  return {
    requestedCapability: params.invocation.requestedCapability,
    sourceDocumentId: params.invocation.sourceDocumentId,
    sourceType: params.invocation.sourceType,
    taskPurpose: params.invocation.purpose,
    location: params.invocation.location,
    insufficiencyReasons,
    recommendedNextCapabilities: [...params.recommendedNextCapabilities],
    candidateToolCategories,
    externalExecutionRequired,
    dataSecurityConsiderations: [
      `Source data class: ${dataClass}.`,
      externalExecutionRequired
        ? "External execution would require explicit runtime, permission, tenant, and data-retention approval."
        : "Current recommendation can remain inside local/internal execution if an eligible tool is registered.",
      "No unapproved tool was executed.",
    ],
    benchmarkFixtureNeeded: defaultBenchmarkFixtures(
      params.invocation,
      params.recommendedNextCapabilities
    ),
    executedUnapprovedTool: false,
  } satisfies UnmetCapabilityReviewItem;
}

function normalizeToolDefinition(tool: InspectionToolDefinition): InspectionToolDefinition {
  return {
    ...tool,
    artifactContracts: tool.artifactContracts.length > 0
      ? [...tool.artifactContracts]
      : tool.artifactContract
        ? [tool.artifactContract]
        : [],
    benchmarkFixtureIds: [...tool.benchmarkFixtureIds],
    toolCard: {
      ...tool.toolCard,
      artifactContracts: [...tool.toolCard.artifactContracts],
      benchmarkFixtureIds: [...tool.toolCard.benchmarkFixtureIds],
      dataPolicy: {
        ...tool.toolCard.dataPolicy,
        allowedDataClasses: [...tool.toolCard.dataPolicy.allowedDataClasses],
      },
      capabilities: [...tool.toolCard.capabilities],
      sourceTypes: [...tool.toolCard.sourceTypes],
      fallbackPolicy: {
        ...tool.toolCard.fallbackPolicy,
        fallbackCapabilities: [...tool.toolCard.fallbackPolicy.fallbackCapabilities],
      },
      limitations: [...tool.toolCard.limitations],
    },
  };
}

export function createToolTracePayload(result: InspectionToolResult, createdArtifactKeys: string[] = []) {
  const selectedToolCard = result.selectedTool?.toolCard ?? null;

  return {
    requestedCapability: result.requestedCapability,
    selectedTool: result.selectedTool?.id ?? null,
    selectionReason: result.selectionReason,
    selectionScore: result.selectionScore,
    candidateScores: result.candidateScores,
    candidateTools: result.governanceTrace.candidateTools,
    rejectedToolIds: result.rejectedToolIds,
    eligibleTools: result.eligibleTools,
    ineligibleTools: result.ineligibleTools,
    eligibilityReasons: result.governanceTrace.eligibilityDecisions.map((decision) => ({
      toolId: decision.toolId,
      eligible: decision.eligible,
      reasons: decision.reasons,
    })),
    approvalStatus: selectedToolCard?.approvalStatus ?? null,
    runtimeClass: selectedToolCard?.runtimeClass ?? null,
    dataClassPolicy: selectedToolCard?.dataPolicy ?? null,
    sideEffectLevel: selectedToolCard?.sideEffectLevel ?? null,
    costClass: selectedToolCard?.costEstimate.costClass ?? null,
    latencyClass: selectedToolCard?.latencyClass ?? null,
    benchmarkFixtureIds: selectedToolCard?.benchmarkFixtureIds ?? [],
    governanceTrace: result.governanceTrace,
    confidence: result.confidence,
    limitations: [...result.limitations],
    fallbackRecommendation: result.fallbackRecommendation,
    recommendedNextCapabilities: [...result.recommendedNextCapabilities],
    createdArtifactKeys: [...createdArtifactKeys],
    reusable: result.reusable,
    unmetCapability: result.unmetCapability,
    unmetCapabilityReviewItem: result.unmetCapabilityReviewItem,
    traceEvents: result.traceEvents,
    executedUnapprovedTool: false,
  };
}

export function buildCompletedToolResult(params: {
  invocation: InspectionToolInvocation;
  tool: InspectionToolDefinition;
  selectionReason?: string;
  selectionScore?: ToolCapabilityScore | null;
  candidateScores?: ToolCapabilityScore[];
  rejectedToolIds?: string[];
  eligibleTools?: ToolEligibilityDecision[];
  ineligibleTools?: ToolEligibilityDecision[];
  governanceTrace?: ToolGovernanceTrace;
  confidence: number | null;
  summary: string | null;
  output?: Record<string, unknown>;
  limitations?: string[];
  fallbackRecommendation?: string | null;
  recommendedNextCapabilities?: InspectionCapability[];
  reusable?: boolean;
  traceEvents?: ToolTraceEvent[];
}): InspectionToolResult {
  const recommendedNextCapabilities = [
    ...(params.recommendedNextCapabilities ?? []),
    ...params.tool.fallbackPolicy.fallbackCapabilities,
  ].filter((capability, index, capabilities) => capabilities.indexOf(capability) === index);
  const limitations = [
    ...params.tool.limitations,
    ...(params.limitations ?? []),
  ].filter((limitation, index, limitations) => limitations.indexOf(limitation) === index);

  return {
    invocation: params.invocation,
    status: "completed",
    requestedCapability: params.invocation.requestedCapability,
    selectedTool: params.tool,
    selectionReason: params.selectionReason ?? "Selected approved registered tool.",
    selectionScore: params.selectionScore ?? null,
    candidateScores: params.candidateScores ?? [],
    rejectedToolIds: params.rejectedToolIds ?? [],
    eligibleTools: params.eligibleTools ?? [],
    ineligibleTools: params.ineligibleTools ?? [],
    governanceTrace: params.governanceTrace ?? buildEmptyGovernanceTrace(params.invocation),
    confidence: params.confidence,
    summary: params.summary,
    output: params.output ?? {},
    limitations,
    fallbackRecommendation: params.fallbackRecommendation ?? params.tool.fallbackPolicy.fallbackRecommendation,
    recommendedNextCapabilities,
    reusable: params.reusable ?? params.tool.reusableResult,
    traceEvents: [
      ...(params.traceEvents ?? []),
      buildToolTraceEvent({
        type: "tool_executed",
        capability: params.invocation.requestedCapability,
        toolId: params.tool.id,
        detail: "Approved inspection tool executed inside its registered boundary.",
        metadata: {
          approvalStatus: params.tool.approvalStatus,
          runtimeClass: params.tool.runtimeClass,
          executionBoundary: params.tool.executionBoundary,
          sideEffectLevel: params.tool.sideEffectLevel,
          costClass: params.tool.costEstimate.costClass,
          latencyClass: params.tool.latencyClass,
          benchmarkFixtureIds: params.tool.benchmarkFixtureIds,
        },
      }),
    ],
    unmetCapability: null,
    unmetCapabilityReviewItem: null,
  };
}

export class InspectionToolRegistry {
  private readonly tools = new Map<string, InspectionToolDefinition>();

  register(tool: InspectionToolDefinition) {
    this.tools.set(tool.id, normalizeToolDefinition(tool));
    return this;
  }

  registerMany(tools: InspectionToolDefinition[]) {
    for (const tool of tools) {
      this.register(tool);
    }

    return this;
  }

  getTool(toolId: string) {
    return this.tools.get(toolId) ?? null;
  }

  getTools() {
    return [...this.tools.values()].sort(
      (left, right) => left.selectionPriority - right.selectionPriority || left.id.localeCompare(right.id)
    );
  }

  getToolsByCapability(capability: InspectionCapability, params?: { includeUnapproved?: boolean }) {
    return this.getTools().filter(
      (tool) =>
        tool.capabilities.includes(capability) &&
        (params?.includeUnapproved || EXECUTABLE_APPROVAL_STATUSES.includes(tool.approvalStatus))
    );
  }
}

export class InspectionToolBroker {
  constructor(
    private readonly registry: InspectionToolRegistry,
    private readonly policy: Partial<ToolSelectionPolicy> = {}
  ) {}

  selectTool(invocation: InspectionToolInvocation): ToolSelectionResult {
    const policy = normalizePolicy(this.policy);
    const allCapabilityTools = this.registry.getToolsByCapability(invocation.requestedCapability, {
      includeUnapproved: true,
    });
    const traceEvents: ToolTraceEvent[] = [
      buildToolTraceEvent({
        type: "capability_requested",
        capability: invocation.requestedCapability,
        toolId: null,
        detail: invocation.purpose,
        metadata: {
          sourceDocumentId: invocation.sourceDocumentId,
          sourceType: invocation.sourceType,
          location: invocation.location,
          dataClass: invocation.dataClass ?? "internal",
        },
      }),
    ];
    const rejectedToolIds: string[] = [];
    const scoredTools: Array<{ tool: InspectionToolDefinition; score: ToolCapabilityScore }> = [];
    const eligibilityDecisions = allCapabilityTools.map((tool) =>
      evaluateToolEligibility({
        tool,
        invocation,
        policy,
      })
    );

    for (const tool of allCapabilityTools) {
      const eligibility = eligibilityDecisions.find((decision) => decision.toolId === tool.id);

      if (!eligibility?.eligible) {
        rejectedToolIds.push(tool.id);
        traceEvents.push(
          buildToolTraceEvent({
            type: "tool_rejected",
            capability: invocation.requestedCapability,
            toolId: tool.id,
            detail: eligibility?.reasons.join(" ") ?? "Tool was ineligible.",
            metadata: eligibility ?? null,
          })
        );
        continue;
      }

      const reasons = [
        "Capability match.",
        sourceTypeMatches(tool, invocation.sourceType) ? "Source type match." : "Wildcard source type match.",
        `Runtime class score ${RUNTIME_CLASS_SCORE[tool.runtimeClass]}.`,
        `Reliability ${tool.reliability}.`,
        ...eligibility.reasons,
      ];
      const score =
        100 +
        (tool.sourceTypes.includes(invocation.sourceType) ? 20 : 5) +
        RUNTIME_CLASS_SCORE[tool.runtimeClass] +
        tool.reliability * 10 +
        (tool.costEstimate.costClass === "free_local" ? 5 : 0) +
        (policy.preferReusableResults && tool.reusableResult ? 3 : 0);

      scoredTools.push({
        tool,
        score: {
          toolId: tool.id,
          capability: invocation.requestedCapability,
          score,
          reasons,
          limitations: [...tool.limitations],
        },
      });
    }

    const candidateScores = scoredTools.map((entry) => entry.score).sort((left, right) =>
      right.score - left.score || left.toolId.localeCompare(right.toolId)
    );
    const selected = [...scoredTools].sort(compareToolScores)[0] ?? null;
    const eligibleTools = eligibilityDecisions.filter((decision) => decision.eligible);
    const ineligibleTools = eligibilityDecisions.filter((decision) => !decision.eligible);

    if (!selected) {
      const recommendedNextCapabilities = defaultRecommendedCapabilities(invocation);
      const reviewItem = buildUnmetCapabilityReviewItem({
        invocation,
        decisions: eligibilityDecisions,
        recommendedNextCapabilities,
      });
      const unmetCapability: UnmetCapability = {
        capability: invocation.requestedCapability,
        sourceDocumentId: invocation.sourceDocumentId,
        sourceType: invocation.sourceType,
        reason:
          allCapabilityTools.length === 0
            ? "No registered approved tool satisfies the requested capability."
            : "Registered tools for this capability were unavailable under approval, runtime, boundary, source, data, side-effect, cost, latency, or permission policy.",
        recommendedNextCapabilities,
        proposedToolPaths: defaultProposedToolPaths(invocation, recommendedNextCapabilities),
        recordedForAdminReview: true,
        executedUnapprovedTool: false,
        reviewItem,
      };
      const governanceTrace = buildGovernanceTrace({
        invocation,
        policy,
        decisions: eligibilityDecisions,
        selectedToolId: null,
        unmetCapabilityReviewItem: reviewItem,
      });

      traceEvents.push(
        buildToolTraceEvent({
          type: "unmet_capability_recorded",
          capability: invocation.requestedCapability,
          toolId: null,
          detail: unmetCapability.reason,
          metadata: {
            recommendedNextCapabilities,
            proposedToolPaths: unmetCapability.proposedToolPaths,
            rejectedToolIds,
            reviewItem,
          },
        })
      );

      return {
        selectedTool: null,
        selectionReason: unmetCapability.reason,
        selectedScore: null,
        candidateScores,
        rejectedToolIds,
        eligibleTools,
        ineligibleTools,
        governanceTrace,
        traceEvents,
        unmetCapability,
        unmetCapabilityReviewItem: reviewItem,
      };
    }

    const selectionReason = `Selected ${selected.tool.id} as the highest-ranked eligible approved tool for ${invocation.requestedCapability}.`;
    const governanceTrace = buildGovernanceTrace({
      invocation,
      policy,
      decisions: eligibilityDecisions,
      selectedToolId: selected.tool.id,
      unmetCapabilityReviewItem: null,
    });
    traceEvents.push(
      buildToolTraceEvent({
        type: "tool_selected",
        capability: invocation.requestedCapability,
        toolId: selected.tool.id,
        detail: selectionReason,
        metadata: {
          score: selected.score.score,
          reasons: selected.score.reasons,
          governance: governanceTrace,
        },
      })
    );

    return {
      selectedTool: selected.tool,
      selectionReason,
      selectedScore: selected.score,
      candidateScores,
      rejectedToolIds,
      eligibleTools,
      ineligibleTools,
      governanceTrace,
      traceEvents,
      unmetCapability: null,
      unmetCapabilityReviewItem: null,
    };
  }

  invoke(invocation: InspectionToolInvocation): InspectionToolResult {
    const selection = this.selectTool(invocation);

    if (!selection.selectedTool) {
      return {
        invocation,
        status: "unmet",
        requestedCapability: invocation.requestedCapability,
        selectedTool: null,
        selectionReason: selection.selectionReason,
        selectionScore: null,
        candidateScores: selection.candidateScores,
        rejectedToolIds: selection.rejectedToolIds,
        eligibleTools: selection.eligibleTools,
        ineligibleTools: selection.ineligibleTools,
        governanceTrace: selection.governanceTrace,
        confidence: null,
        summary: selection.unmetCapability?.reason ?? null,
        output: {},
        limitations: ["No approved eligible registered tool was executed."],
        fallbackRecommendation: selection.unmetCapability
          ? `Request review for one of: ${selection.unmetCapability.recommendedNextCapabilities.join(", ")}.`
          : null,
        recommendedNextCapabilities: selection.unmetCapability?.recommendedNextCapabilities ?? [],
        reusable: false,
        traceEvents: selection.traceEvents,
        unmetCapability: selection.unmetCapability,
        unmetCapabilityReviewItem: selection.unmetCapabilityReviewItem,
      };
    }

    const rawResult = selection.selectedTool.execute
      ? selection.selectedTool.execute({
          invocation,
          tool: selection.selectedTool,
        })
      : buildCompletedToolResult({
          invocation,
          tool: selection.selectedTool,
          confidence: selection.selectedTool.reliability,
          summary: "Approved inspection tool selected; no execution adapter is implemented in this pass.",
          limitations: ["Selection-only tool definition."],
        });

    return {
      ...rawResult,
      selectedTool: selection.selectedTool,
      selectionReason: selection.selectionReason,
      selectionScore: selection.selectedScore,
      candidateScores: selection.candidateScores,
      rejectedToolIds: selection.rejectedToolIds,
      eligibleTools: selection.eligibleTools,
      ineligibleTools: selection.ineligibleTools,
      governanceTrace: selection.governanceTrace,
      traceEvents: [...selection.traceEvents, ...rawResult.traceEvents],
      unmetCapability: null,
      unmetCapabilityReviewItem: null,
    };
  }
}
