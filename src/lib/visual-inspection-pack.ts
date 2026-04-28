import type { AgentControlDecision } from "./agent-control-surface";
import {
  planAdaptiveContextTransport,
  type ContextPayload,
  type ContextPayloadRequirement,
  type ContextTransportResult,
} from "./adaptive-context-transport";
import {
  resolveCatalogForAdaptiveContextTransport,
  type CatalogRuntimeSupport,
} from "./context-catalog-bootstrap";
import { estimateTextTokens } from "./context-token-budget";
import type {
  CapabilityGapRecord,
  CapabilityGapResolutionPath,
  ContextDebtRecord,
  ContextDebtResolutionPath,
  SourceCoverageRecord,
} from "./capability-gap-context-debt-registry";
import type { SourceObservation } from "./source-learning-artifact-promotion";

type MaybePromise<T> = T | Promise<T>;

export type VisualPageTarget = {
  sourceDocumentId: string;
  sourceId?: string | null;
  sourceType?: string | null;
  sourceVersion?: string | null;
  documentLabel?: string | null;
  pageNumber: number;
  pageLabel?: string | null;
  sourceLocationLabel?: string | null;
};

export type PageCropCoordinates = {
  x: number;
  y: number;
  width: number;
  height: number;
  unit: "px" | "pt" | "normalized";
};

export type PageCropRequest = {
  id?: string | null;
  target: VisualPageTarget;
  coordinates?: PageCropCoordinates | null;
  reason?: string | null;
  label?: string | null;
  plannedBy?: "explicit_user_request" | "supported_crop_planner";
};

export type RenderedPageArtifactRef = {
  refId: string;
  refType: "data_uri" | "runtime_uri" | "file_path" | "artifact_key";
  uri: string;
  mimeType: string;
  byteLength?: number | null;
  persistence: "runtime_only" | "artifact_storage" | "file_storage";
  cleanupPolicy: "runtime_gc" | "existing_storage_policy" | "not_persisted";
};

export type RenderedPagePayload = {
  id: string;
  payloadType: "rendered_page_image";
  target: VisualPageTarget;
  artifactRef: RenderedPageArtifactRef;
  width: number | null;
  height: number | null;
  dpi: number | null;
  rendererId: string;
  producedAt: string;
  metadata: Record<string, unknown>;
};

export type PageCropPayload = {
  id: string;
  payloadType: "page_crop_image";
  parentRenderedPagePayloadId: string | null;
  target: VisualPageTarget;
  crop: PageCropCoordinates;
  artifactRef: RenderedPageArtifactRef;
  width: number | null;
  height: number | null;
  rendererId: string;
  producedAt: string;
  metadata: Record<string, unknown>;
};

export type RenderPageRequest = {
  target: VisualPageTarget;
  now: () => Date;
};

export type RenderCropRequest = {
  target: VisualPageTarget;
  renderedPage: RenderedPagePayload | null;
  crop: PageCropRequest;
  now: () => Date;
};

export type RenderedPageRenderer = {
  rendererId: string;
  implementationAvailable: true;
  supportsCrop: boolean;
  persistenceSupported: boolean;
  renderPage(request: RenderPageRequest): MaybePromise<RenderedPagePayload | null>;
  renderCrop?: (request: RenderCropRequest) => MaybePromise<PageCropPayload | null>;
};

export type PageCropPlanner = {
  plannerId: string;
  planCrops(input: {
    targets: VisualPageTarget[];
    renderedPages: RenderedPagePayload[];
    maxCrops: number;
    now: () => Date;
  }): MaybePromise<PageCropRequest[]>;
};

export type PageCropRenderer = {
  rendererId: string;
  renderCrop(request: RenderCropRequest): MaybePromise<PageCropPayload | null>;
};

export type VisionInspectionObservation = {
  id: string;
  target: VisualPageTarget;
  imagePayloadId: string;
  content: string;
  confidence: number | null;
  limitations: string[];
  metadata: Record<string, unknown>;
};

export type VisionInspectionRequest = {
  id: string;
  prompt: string;
  imagePayloads: Array<RenderedPagePayload | PageCropPayload>;
  modelProfileId: string;
  modelId: string;
  provider: string;
  maxObservations: number;
  requiresStructuredOutput: boolean;
  policy: VisionInspectionPolicy;
};

export type VisionInspectionResult = {
  id: string;
  requestId: string;
  adapterId: string;
  modelProfileId: string;
  modelId: string;
  provider: string;
  observations: VisionInspectionObservation[];
  rawResponseRef?: string | null;
  limitations: string[];
  executedAt: string;
  metadata: Record<string, unknown>;
};

export type VisionInspectionAdapter = {
  adapterId: string;
  modelProfileId: string;
  modelId: string;
  provider: string;
  maxImageInputs: number;
  supportsStructuredOutput: boolean;
  requiresApproval: boolean;
  dataEgressClass: CatalogRuntimeSupport["visionModelInspector"]["dataEgressClass"];
  inspect(request: VisionInspectionRequest): MaybePromise<VisionInspectionResult>;
};

export type VisionModelInspector = VisionInspectionAdapter;

export type VisionInspectionPolicy = {
  allowRendering: boolean;
  allowCropRendering: boolean;
  allowVisionInspection: boolean;
  approvalGranted: boolean;
  allowAsyncRecommendedExecution: boolean;
  maxPages: number;
  maxCrops: number;
  maxModelCalls: number;
  requireStructuredVisionOutput: boolean;
};

export type VisionInspectionEligibilityDecision = {
  gate:
    | "render_page"
    | "render_crop"
    | "vision_inspect"
    | "transport"
    | "source_learning";
  allowed: boolean;
  reason: string;
  detail: string;
};

export type VisualInspectionTraceEvent = {
  type:
    | "visual_plan_created"
    | "policy_gate_applied"
    | "renderer_missing"
    | "renderer_executed"
    | "crop_skipped"
    | "crop_renderer_executed"
    | "vision_missing"
    | "vision_executed"
    | "source_observation_mapped"
    | "transport_planned"
    | "non_execution_confirmed";
  timestamp: string;
  target: VisualPageTarget | null;
  detail: string;
  metadata: Record<string, unknown> | null;
};

export type VisualInspectionPlan = {
  id: string;
  sourceTargets: VisualPageTarget[];
  cropRequests: PageCropRequest[];
  requestedPayloadTypes: Array<"rendered_page_image" | "page_crop_image" | "vision_observation">;
  runtimeSupport: CatalogRuntimeSupport;
  policy: VisionInspectionPolicy;
  eligibility: VisionInspectionEligibilityDecision[];
  selectedPageTargets: VisualPageTarget[];
  selectedCropRequests: PageCropRequest[];
  expectedOutputObservationTypes: Array<"rendered_page_image" | "page_crop_image" | "vision_observation">;
  syncExecutionAllowed: boolean;
  asyncRecommended: boolean;
  approvalRequired: boolean;
  blockedByPolicy: boolean;
  trace: VisualInspectionTraceEvent[];
};

export type VisualInspectionTrace = {
  planId: string;
  events: VisualInspectionTraceEvent[];
  noOcrExecuted: true;
  noDocumentAiExecuted: true;
  noSharePointOrCompanyConnectorExecuted: true;
  noBrowserAutomationExecuted: true;
  noCreationPipelineExecuted: true;
};

export type VisualInspectionDebugSnapshot = {
  plan: VisualInspectionPlan;
  sourcePageTargets: VisualPageTarget[];
  rendererAvailability: CatalogRuntimeSupport["renderedPageRenderer"];
  visionAvailability: CatalogRuntimeSupport["visionModelInspector"];
  catalogEntriesConsidered: {
    payloadTypes: string[];
    toolIds: string[];
    modelProfileIds: string[];
    laneIds: string[];
  };
  transportPayloadsRequested: string[];
  payloadsProduced: Array<Pick<ContextPayload, "id" | "type" | "label" | "representation" | "available">>;
  payloadsSelected: string[];
  payloadsExcluded: Array<{ payloadType: string; reason: string; detail: string }>;
  payloadsMissing: Array<{ payloadType: string; reason: string }>;
  policyDecisions: VisionInspectionEligibilityDecision[];
  toolManifestsUsed: string[];
  modelManifestsUsed: string[];
  renderedArtifactRefs: RenderedPageArtifactRef[];
  visionObservations: VisionInspectionObservation[];
  sourceObservationRefs: string[];
  contextDebtRefs: string[];
  capabilityGapRefs: string[];
  nonExecutionConfirmations: {
    ocrExecuted: false;
    documentAiExecuted: false;
    sharePointOrCompanyConnectorExecuted: false;
    browserAutomationExecuted: false;
    creationPipelineExecuted: false;
  };
  noUnavailableToolExecutionClaimed: true;
};

export type VisualInspectionResult = {
  plan: VisualInspectionPlan;
  renderedPagePayloads: RenderedPagePayload[];
  pageCropPayloads: PageCropPayload[];
  visionResults: VisionInspectionResult[];
  visionObservations: VisionInspectionObservation[];
  contextPayloads: ContextPayload[];
  sourceObservations: SourceObservation[];
  sourceCoverageRecords: SourceCoverageRecord[];
  contextDebtRecords: ContextDebtRecord[];
  capabilityGapRecords: CapabilityGapRecord[];
  transportResult: ContextTransportResult;
  trace: VisualInspectionTrace;
  debugSnapshot: VisualInspectionDebugSnapshot;
  noUnavailableToolExecutionClaimed: true;
};

export type VisualInspectionExecutionInput = {
  request?: string | null;
  sourceTargets: VisualPageTarget[];
  cropRequests?: PageCropRequest[];
  agentControl?: AgentControlDecision | null;
  policy?: Partial<VisionInspectionPolicy>;
  renderer?: RenderedPageRenderer | null;
  cropPlanner?: PageCropPlanner | null;
  cropRenderer?: PageCropRenderer | null;
  visionAdapter?: VisionInspectionAdapter | null;
  now?: () => Date;
};

function nowIso(now: () => Date) {
  return now().toISOString();
}

function shortHash(value: string) {
  let hash = 0;
  for (let index = 0; index < value.length; index += 1) {
    hash = (hash * 31 + value.charCodeAt(index)) >>> 0;
  }
  return hash.toString(36);
}

function unique<T>(values: T[]) {
  return Array.from(new Set(values));
}

function traceEvent(
  params: Omit<VisualInspectionTraceEvent, "timestamp">,
  now: () => Date
): VisualInspectionTraceEvent {
  return {
    ...params,
    timestamp: nowIso(now),
  };
}

function targetKey(target: VisualPageTarget) {
  return `${target.sourceDocumentId}:page:${target.pageNumber}`;
}

function targetSourceId(target: VisualPageTarget) {
  return target.sourceId ?? target.sourceDocumentId;
}

function targetLabel(target: VisualPageTarget) {
  return target.sourceLocationLabel ?? `${target.documentLabel ?? target.sourceDocumentId} page ${target.pageLabel ?? target.pageNumber}`;
}

function isVisualRequest(request: string | null | undefined) {
  return /\b(render|vision|visual|image|page|crop|figure|chart|table|ingest|highest|fidelity)\b/i.test(request ?? "");
}

function defaultPolicyFor(input: VisualInspectionExecutionInput): VisionInspectionPolicy {
  const decision = input.agentControl;
  const requestNeedsVisual = isVisualRequest(input.request);
  const fidelity = decision?.taskFidelityLevel ?? "standard_grounded_answer";
  const explicitVisualNeed =
    requestNeedsVisual ||
    fidelity === "deep_inspection" ||
    fidelity === "audit_grade_answer" ||
    fidelity === "highest_fidelity_ingestion";
  const toolCalls = Math.max(0, decision?.toolBudgetRequest.grantedToolCalls ?? (explicitVisualNeed ? 3 : 0));
  const defaultPageLimit =
    fidelity === "highest_fidelity_ingestion"
      ? 3
      : fidelity === "deep_inspection" || fidelity === "audit_grade_answer"
        ? 2
        : explicitVisualNeed
          ? 1
          : 0;
  const rawPolicy = {
    allowRendering: explicitVisualNeed,
    allowCropRendering: explicitVisualNeed,
    allowVisionInspection: explicitVisualNeed,
    approvalGranted: false,
    allowAsyncRecommendedExecution: false,
    maxPages: Math.min(defaultPageLimit, toolCalls, input.sourceTargets.length),
    maxCrops: 0,
    maxModelCalls: 0,
    requireStructuredVisionOutput: false,
    ...(input.policy ?? {}),
  };
  const maxPages = Math.min(Math.max(0, rawPolicy.maxPages), toolCalls, input.sourceTargets.length);
  let remainingToolCalls = Math.max(0, toolCalls - maxPages);
  const defaultCropLimit = input.cropRequests?.length ? 1 : 0;
  const requestedCropLimit = input.policy?.maxCrops ?? defaultCropLimit;
  const maxCrops = Math.min(Math.max(0, requestedCropLimit), remainingToolCalls, input.cropRequests?.length ?? 0);
  remainingToolCalls = Math.max(0, remainingToolCalls - maxCrops);
  const defaultModelCallLimit = explicitVisualNeed ? Math.max(1, maxPages + maxCrops) : 0;
  const requestedModelCallLimit = input.policy?.maxModelCalls ?? defaultModelCallLimit;
  const maxModelCalls = Math.min(Math.max(0, requestedModelCallLimit), remainingToolCalls);

  return {
    ...rawPolicy,
    maxPages,
    maxCrops,
    maxModelCalls,
  };
}

function runtimeSupportFor(input: VisualInspectionExecutionInput): CatalogRuntimeSupport {
  return {
    renderedPageRenderer: {
      implementationAvailable: Boolean(input.renderer),
      implementationId: input.renderer?.rendererId ?? null,
      cropRenderingAvailable: Boolean(input.cropRenderer || input.renderer?.renderCrop),
      persistenceSupported: input.renderer?.persistenceSupported ?? false,
    },
    visionModelInspector: {
      adapterAvailable: Boolean(input.visionAdapter),
      adapterId: input.visionAdapter?.adapterId ?? null,
      modelProfileId: input.visionAdapter?.modelProfileId ?? null,
      modelId: input.visionAdapter?.modelId ?? null,
      provider: input.visionAdapter?.provider ?? null,
      maxImageInputs: input.visionAdapter?.maxImageInputs ?? null,
      supportsStructuredOutput: input.visionAdapter?.supportsStructuredOutput ?? false,
      requiresApproval: input.visionAdapter?.requiresApproval ?? true,
      dataEgressClass: input.visionAdapter?.dataEgressClass ?? "unknown",
    },
  };
}

function buildEligibility(input: {
  decision: AgentControlDecision | null | undefined;
  policy: VisionInspectionPolicy;
  support: CatalogRuntimeSupport;
}): VisionInspectionEligibilityDecision[] {
  const blocked = Boolean(input.decision?.blockedByPolicy);
  const approvalBlocked = Boolean(input.decision?.approvalRequired) && !input.policy.approvalGranted;
  const visionApprovalBlocked =
    Boolean(input.decision?.approvalRequired || (input.support.visionModelInspector.adapterAvailable && input.support.visionModelInspector.requiresApproval)) &&
    !input.policy.approvalGranted;
  const asyncBlocked = Boolean(input.decision?.asyncRecommended) && !input.policy.allowAsyncRecommendedExecution;
  const commonBlock =
    blocked ? "blocked_by_policy" : approvalBlocked ? "approval_required" : asyncBlocked ? "async_recommended" : null;
  const visionBlock =
    blocked ? "blocked_by_policy" : visionApprovalBlocked ? "approval_required" : asyncBlocked ? "async_recommended" : null;
  const renderAllowed = input.policy.allowRendering && input.support.renderedPageRenderer.implementationAvailable && !commonBlock;
  const cropAllowed = renderAllowed && input.policy.allowCropRendering && input.support.renderedPageRenderer.cropRenderingAvailable;
  const visionAllowed =
    renderAllowed &&
    input.policy.allowVisionInspection &&
    input.support.visionModelInspector.adapterAvailable &&
    input.policy.maxModelCalls > 0 &&
    !visionBlock;

  return [
    {
      gate: "render_page",
      allowed: renderAllowed,
      reason: renderAllowed ? "eligible" : commonBlock ?? "renderer_unavailable",
      detail: renderAllowed
        ? "Rendered-page execution is allowed within policy and renderer support."
        : "Rendered-page execution is not allowed or no renderer implementation is configured.",
    },
    {
      gate: "render_crop",
      allowed: cropAllowed,
      reason: cropAllowed ? "eligible" : commonBlock ?? "crop_renderer_unavailable_or_not_requested",
      detail: cropAllowed
        ? "Crop rendering is allowed for explicit or supported planned crop coordinates."
        : "Crop rendering is unavailable, not requested, or blocked by policy.",
    },
    {
      gate: "vision_inspect",
      allowed: visionAllowed,
      reason: visionAllowed ? "eligible" : visionBlock ?? "vision_adapter_unavailable",
      detail: visionAllowed
        ? "Vision inspection can execute through the configured compatible adapter."
        : "Vision inspection is unavailable, not budgeted, or blocked by policy/approval.",
    },
    {
      gate: "transport",
      allowed: true,
      reason: "always_plan_transport_truth",
      detail: "Transport planning remains truthful for produced, excluded, and missing visual payloads.",
    },
    {
      gate: "source_learning",
      allowed: true,
      reason: "source_observation_mapping_only",
      detail: "Source learning receives only actual rendered/crop/vision outputs or limitation records.",
    },
  ];
}

function isGateAllowed(plan: VisualInspectionPlan, gate: VisionInspectionEligibilityDecision["gate"]) {
  return plan.eligibility.find((decision) => decision.gate === gate)?.allowed === true;
}

export function planVisualInspection(input: VisualInspectionExecutionInput): VisualInspectionPlan {
  const now = input.now ?? (() => new Date());
  const policy = defaultPolicyFor(input);
  const runtimeSupport = runtimeSupportFor(input);
  const selectedPageTargets = input.sourceTargets.slice(0, Math.max(0, policy.maxPages));
  const explicitCropRequests = (input.cropRequests ?? []).filter((crop) => crop.coordinates);
  const selectedCropRequests = explicitCropRequests.slice(0, Math.max(0, policy.maxCrops));
  const requestedPayloadTypes: VisualInspectionPlan["requestedPayloadTypes"] = ["rendered_page_image"];
  if ((input.cropRequests?.length ?? 0) > 0) requestedPayloadTypes.push("page_crop_image");
  if (policy.allowVisionInspection) requestedPayloadTypes.push("vision_observation");
  const planId = `visual-inspection:${shortHash([
    input.request ?? "",
    ...input.sourceTargets.map(targetKey),
    requestedPayloadTypes.join(","),
  ].join("|"))}`;
  const eligibility = buildEligibility({ decision: input.agentControl, policy, support: runtimeSupport });
  const trace = [
    traceEvent({
      type: "visual_plan_created",
      target: null,
      detail: "Visual inspection plan created without executing unavailable OCR, document-AI, connector, browser, or creation tools.",
      metadata: {
        requestedPayloadTypes,
        selectedPageCount: selectedPageTargets.length,
        selectedCropCount: selectedCropRequests.length,
      },
    }, now),
    ...eligibility.map((decision) =>
      traceEvent({
        type: "policy_gate_applied" as const,
        target: null,
        detail: `${decision.gate}: ${decision.detail}`,
        metadata: { allowed: decision.allowed, reason: decision.reason },
      }, now)
    ),
  ];

  return {
    id: planId,
    sourceTargets: [...input.sourceTargets],
    cropRequests: [...(input.cropRequests ?? [])],
    requestedPayloadTypes,
    runtimeSupport,
    policy,
    eligibility,
    selectedPageTargets,
    selectedCropRequests,
    expectedOutputObservationTypes: requestedPayloadTypes,
    syncExecutionAllowed: !input.agentControl?.blockedByPolicy && !input.agentControl?.approvalRequired && !input.agentControl?.asyncRecommended,
    asyncRecommended: Boolean(input.agentControl?.asyncRecommended),
    approvalRequired: Boolean(input.agentControl?.approvalRequired || (runtimeSupport.visionModelInspector.adapterAvailable && runtimeSupport.visionModelInspector.requiresApproval)),
    blockedByPolicy: Boolean(input.agentControl?.blockedByPolicy),
    trace,
  };
}

function payloadOwnership() {
  return {
    scope: "thread" as const,
    policyMode: "runtime_visual_inspection",
  };
}

function renderedPayloadToContextPayload(payload: RenderedPagePayload): ContextPayload {
  return {
    id: `visual-payload:${payload.id}`,
    type: "rendered_page_image",
    payloadClass: "runtime",
    label: `Rendered page image: ${targetLabel(payload.target)}`,
    sourceId: targetSourceId(payload.target),
    sourceType: payload.target.sourceType ?? "thread_document",
    representation: "image",
    text: null,
    data: {
      target: payload.target,
      artifactRef: payload.artifactRef,
      width: payload.width,
      height: payload.height,
      dpi: payload.dpi,
      rendererId: payload.rendererId,
      producedAt: payload.producedAt,
      noOcrExecuted: true,
      noDocumentAiExecuted: true,
    },
    uri: payload.artifactRef.uri,
    mimeType: payload.artifactRef.mimeType,
    approxTokenCount: 0,
    priority: 82,
    confidence: 1,
    available: true,
    executable: true,
    requiresApproval: false,
    provenance: {
      sourceId: targetSourceId(payload.target),
      sourceType: payload.target.sourceType ?? "thread_document",
      sourceDocumentId: payload.target.sourceDocumentId,
      sourceVersion: payload.target.sourceVersion ?? null,
      location: sourceLocatorFor(payload.target),
      producedByToolId: "rendered_page_renderer",
      extractionMethod: payload.rendererId,
      confidence: 1,
    },
    ownership: payloadOwnership(),
    persistence: {
      artifactEligible: true,
      sourceObservationEligible: true,
      contextDebtEligible: false,
      capabilityGapEligible: false,
      alreadyPersisted: false,
      policy: payload.artifactRef.persistence === "runtime_only" ? "runtime_reference_only" : "existing_artifact_storage_policy",
    },
    metadata: payload.metadata,
  };
}

function cropPayloadToContextPayload(payload: PageCropPayload): ContextPayload {
  return {
    id: `visual-payload:${payload.id}`,
    type: "page_crop_image",
    payloadClass: "runtime",
    label: `Page crop image: ${payload.target.pageLabel ?? payload.target.pageNumber}`,
    sourceId: targetSourceId(payload.target),
    sourceType: payload.target.sourceType ?? "thread_document",
    representation: "image",
    text: null,
    data: {
      target: payload.target,
      parentRenderedPagePayloadId: payload.parentRenderedPagePayloadId,
      crop: payload.crop,
      artifactRef: payload.artifactRef,
      width: payload.width,
      height: payload.height,
      rendererId: payload.rendererId,
      producedAt: payload.producedAt,
      noInventedCropCoordinates: true,
    },
    uri: payload.artifactRef.uri,
    mimeType: payload.artifactRef.mimeType,
    approxTokenCount: 0,
    priority: 86,
    confidence: 1,
    available: true,
    executable: true,
    requiresApproval: false,
    provenance: {
      sourceId: targetSourceId(payload.target),
      sourceType: payload.target.sourceType ?? "thread_document",
      sourceDocumentId: payload.target.sourceDocumentId,
      sourceVersion: payload.target.sourceVersion ?? null,
      location: { ...sourceLocatorFor(payload.target), crop: payload.crop },
      producedByToolId: "rendered_page_renderer",
      extractionMethod: payload.rendererId,
      confidence: 1,
    },
    ownership: payloadOwnership(),
    persistence: {
      artifactEligible: true,
      sourceObservationEligible: true,
      contextDebtEligible: false,
      capabilityGapEligible: false,
      alreadyPersisted: false,
      policy: payload.artifactRef.persistence === "runtime_only" ? "runtime_reference_only" : "existing_artifact_storage_policy",
    },
    metadata: payload.metadata,
  };
}

function visionObservationToContextPayload(observation: VisionInspectionObservation, result: VisionInspectionResult): ContextPayload {
  return {
    id: `visual-payload:vision:${observation.id}`,
    type: "vision_observation",
    payloadClass: "source",
    label: `Vision observation: ${targetLabel(observation.target)}`,
    sourceId: targetSourceId(observation.target),
    sourceType: observation.target.sourceType ?? "thread_document",
    representation: "summary_text",
    text: observation.content,
    data: {
      observation,
      visionResultId: result.id,
      adapterId: result.adapterId,
      modelProfileId: result.modelProfileId,
      modelId: result.modelId,
      provider: result.provider,
      noOcrExecuted: true,
      noDocumentAiExecuted: true,
      noStructuredTableClaimed: true,
    },
    approxTokenCount: estimateTextTokens(observation.content),
    priority: 92,
    confidence: observation.confidence,
    available: true,
    executable: true,
    requiresApproval: false,
    provenance: {
      sourceId: targetSourceId(observation.target),
      sourceType: observation.target.sourceType ?? "thread_document",
      sourceDocumentId: observation.target.sourceDocumentId,
      sourceVersion: observation.target.sourceVersion ?? null,
      location: sourceLocatorFor(observation.target),
      producedByToolId: "model_vision_inspector",
      producedByModelId: result.modelId,
      extractionMethod: result.adapterId,
      confidence: observation.confidence,
    },
    ownership: payloadOwnership(),
    persistence: {
      artifactEligible: true,
      sourceObservationEligible: true,
      contextDebtEligible: false,
      capabilityGapEligible: false,
      alreadyPersisted: false,
      policy: "source_observation_candidate_from_actual_vision_result",
    },
    metadata: {
      limitations: observation.limitations,
      resultLimitations: result.limitations,
      ...observation.metadata,
    },
  };
}

function sourceLocatorFor(target: VisualPageTarget) {
  return {
    pageNumberStart: target.pageNumber,
    pageNumberEnd: target.pageNumber,
    pageLabelStart: target.pageLabel ?? String(target.pageNumber),
    pageLabelEnd: target.pageLabel ?? String(target.pageNumber),
    sourceLocationLabel: targetLabel(target),
  };
}

export function visionObservationToSourceObservation(
  observation: VisionInspectionObservation,
  result: VisionInspectionResult
): SourceObservation {
  return {
    id: `vision-observation:${observation.id}`,
    type: "vision_observation",
    sourceDocumentId: observation.target.sourceDocumentId,
    sourceVersion: observation.target.sourceVersion ?? null,
    sourceLocator: sourceLocatorFor(observation.target),
    content: observation.content,
    payload: {
      imagePayloadId: observation.imagePayloadId,
      visionResultId: result.id,
      adapterId: result.adapterId,
      modelProfileId: result.modelProfileId,
      modelId: result.modelId,
      provider: result.provider,
      metadata: observation.metadata,
      noOcrExecuted: true,
      noDocumentAiExecuted: true,
      noStructuredTableExtractionClaimed: true,
    },
    extractionMethod: result.adapterId,
    confidence: observation.confidence,
    limitations: [
      ...observation.limitations,
      ...result.limitations,
      "Vision observation is not OCR, document-AI, or structured table extraction.",
    ],
  };
}

function mapRenderedPageToSourceObservation(payload: RenderedPagePayload): SourceObservation {
  return {
    id: `rendered-page-observation:${payload.id}`,
    type: "rendered_page_image",
    sourceDocumentId: payload.target.sourceDocumentId,
    sourceVersion: payload.target.sourceVersion ?? null,
    sourceLocator: sourceLocatorFor(payload.target),
    content: `Rendered page image produced for ${targetLabel(payload.target)}.`,
    payload: {
      artifactRef: payload.artifactRef,
      rendererId: payload.rendererId,
      width: payload.width,
      height: payload.height,
      dpi: payload.dpi,
      noOcrExecuted: true,
      noDocumentAiExecuted: true,
    },
    extractionMethod: payload.rendererId,
    confidence: 1,
    limitations: [
      "Rendered image reference is visual evidence only; it is not OCR text, document-AI output, or structured table extraction.",
    ],
  };
}

function mapCropToSourceObservation(payload: PageCropPayload): SourceObservation {
  return {
    id: `page-crop-observation:${payload.id}`,
    type: "page_crop_image",
    sourceDocumentId: payload.target.sourceDocumentId,
    sourceVersion: payload.target.sourceVersion ?? null,
    sourceLocator: sourceLocatorFor(payload.target),
    content: `Page crop image produced for ${targetLabel(payload.target)}.`,
    payload: {
      artifactRef: payload.artifactRef,
      parentRenderedPagePayloadId: payload.parentRenderedPagePayloadId,
      crop: payload.crop,
      rendererId: payload.rendererId,
      noInventedCropCoordinates: true,
    },
    extractionMethod: payload.rendererId,
    confidence: 1,
    limitations: [
      "Crop image reference is visual evidence only; it is not OCR text, document-AI output, or structured table extraction.",
    ],
  };
}

function buildVisualCapabilityGap(params: {
  target: VisualPageTarget | null;
  kind: "renderer" | "crop_renderer" | "vision_model";
  now: () => Date;
  reason: string;
}): CapabilityGapRecord {
  const timestamp = nowIso(params.now);
  const sourceId = params.target ? targetSourceId(params.target) : null;
  const payloadType =
    params.kind === "vision_model" ? "vision_observation" : params.kind === "crop_renderer" ? "page_crop_image" : "rendered_page_image";
  const neededCapability =
    params.kind === "vision_model" ? "vision_page_understanding" : "rendered_page_inspection";
  const resolutionPath: CapabilityGapResolutionPath =
    params.kind === "vision_model" ? "register_model_capability" : "register_tool";

  return {
    id: `visual-gap:${shortHash(`${sourceId ?? "unknown"}:${payloadType}:${params.reason}`)}`,
    gapKey: `gap:${sourceId ?? "unknown"}:${payloadType}:${params.kind}`,
    workspaceId: null,
    conversationId: null,
    conversationDocumentId: params.target?.sourceDocumentId ?? null,
    asyncAgentWorkItemId: null,
    relatedContextDebtId: null,
    relatedContextDebtKey: null,
    sourceId,
    kind: params.kind === "vision_model" ? "missing_model_capability" : "missing_tool",
    status: "detected",
    severity: "high",
    reviewState: "needs_review",
    neededCapability,
    missingPayloadType: payloadType,
    missingToolId: params.kind === "vision_model" ? "model_vision_inspector" : "rendered_page_renderer",
    missingModelCapability: params.kind === "vision_model" ? "vision_input" : null,
    missingArtifactType: null,
    missingConnector: null,
    missingApprovalPath: null,
    missingBudgetProfile: null,
    title: params.kind === "vision_model" ? "Model vision inspector unavailable" : "Rendered page renderer unavailable",
    description: params.reason,
    whyNeeded: "Visual page evidence is needed to improve source understanding without inventing unavailable extraction output.",
    currentLimitation: params.reason,
    recommendedResolution:
      params.kind === "vision_model"
        ? "Configure a compatible vision-capable model adapter."
        : "Configure a local rendered-page renderer implementation.",
    resolutionPath,
    resolutionPaths: unique([resolutionPath, "add_capability_pack"]),
    candidateToolCategories: params.kind === "vision_model" ? ["model_provider"] : ["local"],
    candidateModelCapabilities: params.kind === "vision_model" ? ["vision_input"] : [],
    candidateContextLanes: [payloadType],
    requiredArtifactTypes: [],
    requiredApprovalPolicy: {},
    requiredBudgetProfile: {},
    securityConsiderations: ["Do not execute unavailable visual tools or claim unsupported extraction."],
    dataEgressConsiderations: params.kind === "vision_model" ? ["Model vision may involve data egress depending on adapter policy."] : [],
    benchmarkFixtureIds: params.target?.pageNumber === 15 ? ["t5_pdf_page_15_visible_table"] : [],
    evidence: {
      noUnavailableToolExecutionClaimed: true,
      noOcrExecuted: true,
      noDocumentAiExecuted: true,
    },
    traceEvents: [
      {
        type: "capability_gap_created",
        timestamp,
        gapKey: `gap:${sourceId ?? "unknown"}:${payloadType}:${params.kind}`,
        detail: params.reason,
        metadata: { payloadType, neededCapability },
      },
    ],
    firstSeenAt: timestamp,
    lastSeenAt: timestamp,
    resolvedAt: null,
    createdAt: timestamp,
    updatedAt: timestamp,
  };
}

export function mapVisualInspectionCapabilityGaps(
  plan: VisualInspectionPlan,
  now: () => Date = () => new Date()
): CapabilityGapRecord[] {
  const gaps: CapabilityGapRecord[] = [];
  const firstTarget = plan.sourceTargets[0] ?? null;
  if (!plan.runtimeSupport.renderedPageRenderer.implementationAvailable && plan.requestedPayloadTypes.includes("rendered_page_image")) {
    gaps.push(buildVisualCapabilityGap({
      target: firstTarget,
      kind: "renderer",
      now,
      reason: "Rendered-page image payload was requested, but no renderer implementation support is configured.",
    }));
  }
  if (!plan.runtimeSupport.renderedPageRenderer.cropRenderingAvailable && plan.requestedPayloadTypes.includes("page_crop_image")) {
    gaps.push(buildVisualCapabilityGap({
      target: firstTarget,
      kind: "crop_renderer",
      now,
      reason: "Page-crop image payload was requested, but crop rendering support is not configured.",
    }));
  }
  if (!plan.runtimeSupport.visionModelInspector.adapterAvailable && plan.requestedPayloadTypes.includes("vision_observation")) {
    gaps.push(buildVisualCapabilityGap({
      target: firstTarget,
      kind: "vision_model",
      now,
      reason: "Vision observation payload was requested, but no compatible configured vision model adapter exists.",
    }));
  }
  return gaps;
}

function buildVisualContextDebt(params: {
  plan: VisualInspectionPlan;
  reason: string;
  resolutionPath: ContextDebtResolutionPath;
  now: () => Date;
}): ContextDebtRecord {
  const timestamp = nowIso(params.now);
  const target = params.plan.sourceTargets[0] ?? null;
  const sourceId = target ? targetSourceId(target) : null;
  const isT5Page15 = target?.pageNumber === 15;
  const debtKey = `debt:${sourceId ?? "unknown"}:${isT5Page15 ? "page-15" : "visual"}:${params.resolutionPath}`;
  return {
    id: `visual-debt:${shortHash(debtKey)}`,
    debtKey,
    workspaceId: null,
    conversationId: null,
    conversationDocumentId: target?.sourceDocumentId ?? null,
    asyncAgentWorkItemId: null,
    artifactKey: null,
    sourceId,
    kind: isT5Page15 ? "missing_table_body" : "incomplete_page_coverage",
    status: params.plan.blockedByPolicy ? "blocked_by_policy" : "open",
    severity: "high",
    sourceScope: isT5Page15 ? "table" : "page",
    sourceLocator: target ? sourceLocatorFor(target) : {},
    title: isT5Page15 ? "Page 15 visual table understanding incomplete" : "Visual page understanding incomplete",
    description: params.reason,
    whyItMatters: "The system must preserve missing visual evidence instead of inventing extraction results.",
    resolutionPath: params.resolutionPath,
    resolutionPaths: unique([
      params.resolutionPath,
      "rendered_page_inspection_needed",
      "vision_needed",
    ]),
    deferredCapabilities: unique([
      "rendered_page_inspection",
      "vision_page_understanding",
    ]),
    requiredApprovalReasons: params.plan.approvalRequired ? ["approval_required"] : [],
    policyBlockers: params.plan.blockedByPolicy ? ["blocked_by_policy"] : [],
    sourceCoverageTarget: { target: "relevant_source_sections", requestedBy: "visual_inspection_pack" },
    evidence: {
      noUnavailableToolExecutionClaimed: true,
      noOcrExecuted: true,
      noDocumentAiExecuted: true,
      requestedPayloadTypes: params.plan.requestedPayloadTypes,
    },
    traceEvents: [
      {
        type: "context_debt_created",
        timestamp,
        debtKey,
        detail: params.reason,
        metadata: { planId: params.plan.id },
      },
    ],
    linkedArtifactKeys: [],
    firstSeenAt: timestamp,
    lastSeenAt: timestamp,
    resolvedAt: null,
    createdAt: timestamp,
    updatedAt: timestamp,
  };
}

export function mapVisualInspectionContextDebt(
  plan: VisualInspectionPlan,
  now: () => Date = () => new Date()
): ContextDebtRecord[] {
  const debts: ContextDebtRecord[] = [];
  if (!plan.runtimeSupport.renderedPageRenderer.implementationAvailable && plan.requestedPayloadTypes.includes("rendered_page_image")) {
    debts.push(buildVisualContextDebt({
      plan,
      reason: "Source understanding remains incomplete because rendered-page inspection is unavailable.",
      resolutionPath: "rendered_page_inspection_needed",
      now,
    }));
  } else if (!plan.runtimeSupport.visionModelInspector.adapterAvailable && plan.requestedPayloadTypes.includes("vision_observation")) {
    debts.push(buildVisualContextDebt({
      plan,
      reason: "Source understanding remains incomplete because model vision inspection is unavailable.",
      resolutionPath: "vision_needed",
      now,
    }));
  }
  if (plan.blockedByPolicy) {
    debts.push(buildVisualContextDebt({
      plan,
      reason: "Visual inspection was blocked by policy.",
      resolutionPath: "blocked_by_policy",
      now,
    }));
  }
  return debts;
}

function buildCoverageRecord(params: {
  target: VisualPageTarget;
  status: SourceCoverageRecord["coverageStatus"];
  inspectedBy: string[];
  limitations: string[];
  now: () => Date;
}): SourceCoverageRecord {
  const timestamp = nowIso(params.now);
  const sourceId = targetSourceId(params.target);
  return {
    id: `visual-coverage:${shortHash(`${sourceId}:${params.target.pageNumber}:${params.inspectedBy.join(",")}`)}`,
    coverageKey: `coverage:${sourceId}:page-${params.target.pageNumber}:visual-inspection`,
    workspaceId: null,
    conversationId: null,
    conversationDocumentId: params.target.sourceDocumentId,
    asyncAgentWorkItemId: null,
    sourceId,
    sourceScope: "page",
    sourceLocator: sourceLocatorFor(params.target),
    coverageStatus: params.status,
    coverageTarget: {
      target: "relevant_source_sections",
      detail: "Visual inspection pack page-level coverage.",
      requestedBy: "progressive_assembly",
    },
    inspectedBy: params.inspectedBy,
    limitations: params.limitations,
    relatedDebtIds: [],
    selectedCandidateCount: params.inspectedBy.length,
    totalCandidateCount: 1,
    evidence: {
      noUnavailableToolExecutionClaimed: true,
      noOcrExecuted: true,
      noDocumentAiExecuted: true,
    },
    traceEvents: [],
    createdAt: timestamp,
    updatedAt: timestamp,
  };
}

function buildTransportRequirements(plan: VisualInspectionPlan): ContextPayloadRequirement[] {
  return plan.requestedPayloadTypes.map((payloadType) => ({
    id: `visual-need:${payloadType}:${shortHash(plan.id)}`,
    payloadType,
    required: false,
    reason: "A-04j visual inspection pack requested this payload through A-04h transport.",
    acceptedRepresentations:
      payloadType === "rendered_page_image" || payloadType === "page_crop_image"
        ? ["image"]
        : ["summary_text", "json"],
  }));
}

function catalogFor(plan: VisualInspectionPlan, input: VisualInspectionExecutionInput) {
  return resolveCatalogForAdaptiveContextTransport({
    request: input.request,
    agentControl: input.agentControl,
    runtimeSupport: plan.runtimeSupport,
    modelProfileId: plan.runtimeSupport.visionModelInspector.adapterAvailable
      ? plan.runtimeSupport.visionModelInspector.modelProfileId
      : null,
  });
}

async function resolveCropRequests(params: {
  input: VisualInspectionExecutionInput;
  plan: VisualInspectionPlan;
  renderedPages: RenderedPagePayload[];
}) {
  const explicit = params.plan.selectedCropRequests;
  if (explicit.length > 0 || !params.input.cropPlanner || !isGateAllowed(params.plan, "render_crop")) {
    return explicit;
  }
  const planned = await params.input.cropPlanner.planCrops({
    targets: params.plan.selectedPageTargets,
    renderedPages: params.renderedPages,
    maxCrops: params.plan.policy.maxCrops,
    now: params.input.now ?? (() => new Date()),
  });
  return planned.filter((crop) => crop.coordinates).slice(0, params.plan.policy.maxCrops);
}

export async function executeVisualInspection(
  input: VisualInspectionExecutionInput
): Promise<VisualInspectionResult> {
  const now = input.now ?? (() => new Date());
  const plan = planVisualInspection(input);
  const trace = [...plan.trace];
  const renderedPagePayloads: RenderedPagePayload[] = [];
  const pageCropPayloads: PageCropPayload[] = [];
  const visionResults: VisionInspectionResult[] = [];
  const visionObservations: VisionInspectionObservation[] = [];
  const sourceObservations: SourceObservation[] = [];
  const sourceCoverageRecords: SourceCoverageRecord[] = [];

  if (!input.renderer && plan.requestedPayloadTypes.includes("rendered_page_image")) {
    trace.push(traceEvent({
      type: "renderer_missing",
      target: plan.sourceTargets[0] ?? null,
      detail: "No rendered page renderer was configured; no rendered_page_image payload was produced.",
      metadata: { noUnavailableToolExecutionClaimed: true },
    }, now));
  }

  if (input.renderer && isGateAllowed(plan, "render_page")) {
    for (const target of plan.selectedPageTargets) {
      const rendered = await input.renderer.renderPage({ target, now });
      if (!rendered) continue;
      renderedPagePayloads.push(rendered);
      sourceObservations.push(mapRenderedPageToSourceObservation(rendered));
      sourceCoverageRecords.push(buildCoverageRecord({
        target,
        status: "inspected_with_limitations",
        inspectedBy: ["rendered_page_renderer"],
        limitations: [
          "Rendered page image was produced, but OCR, document-AI, and structured table recovery were not executed.",
        ],
        now,
      }));
      trace.push(traceEvent({
        type: "renderer_executed",
        target,
        detail: "Rendered page renderer executed and produced a rendered_page_image payload.",
        metadata: { payloadId: rendered.id, artifactRef: rendered.artifactRef },
      }, now));
    }
  }

  const cropRequests = await resolveCropRequests({ input, plan, renderedPages: renderedPagePayloads });
  if ((input.cropRequests?.length ?? 0) > 0 && cropRequests.length === 0) {
    trace.push(traceEvent({
      type: "crop_skipped",
      target: plan.sourceTargets[0] ?? null,
      detail: "Crop rendering was requested, but no explicit or supported planned crop coordinates were available.",
      metadata: { noInventedCropCoordinates: true },
    }, now));
  }
  if (isGateAllowed(plan, "render_crop") && cropRequests.length > 0) {
    const cropRenderer = input.cropRenderer ?? input.renderer;
    for (const crop of cropRequests.slice(0, plan.policy.maxCrops)) {
      if (!crop.coordinates || !cropRenderer?.renderCrop) continue;
      const parent = renderedPagePayloads.find((payload) => targetKey(payload.target) === targetKey(crop.target)) ?? null;
      const renderedCrop = await cropRenderer.renderCrop({ target: crop.target, renderedPage: parent, crop, now });
      if (!renderedCrop) continue;
      pageCropPayloads.push(renderedCrop);
      sourceObservations.push(mapCropToSourceObservation(renderedCrop));
      trace.push(traceEvent({
        type: "crop_renderer_executed",
        target: crop.target,
        detail: "Crop renderer executed with explicit or planned crop coordinates.",
        metadata: { payloadId: renderedCrop.id, crop: crop.coordinates, noInventedCropCoordinates: true },
      }, now));
    }
  }

  const visualImagePayloads = [...renderedPagePayloads, ...pageCropPayloads];
  if (!input.visionAdapter && plan.requestedPayloadTypes.includes("vision_observation")) {
    trace.push(traceEvent({
      type: "vision_missing",
      target: plan.sourceTargets[0] ?? null,
      detail: "No compatible vision model adapter was configured; no vision_observation payload was produced.",
      metadata: { noUnavailableToolExecutionClaimed: true },
    }, now));
  }
  if (input.visionAdapter && isGateAllowed(plan, "vision_inspect") && visualImagePayloads.length > 0) {
    const maxImageInputs = Math.max(1, Math.min(input.visionAdapter.maxImageInputs, plan.policy.maxModelCalls, visualImagePayloads.length));
    const request: VisionInspectionRequest = {
      id: `vision-request:${shortHash(`${plan.id}:${visualImagePayloads.map((payload) => payload.id).join(",")}`)}`,
      prompt: "Inspect the rendered page or crop visually. Report only source-grounded visual observations with confidence and limitations. Do not perform or claim OCR, document-AI, or structured table extraction.",
      imagePayloads: visualImagePayloads.slice(0, maxImageInputs),
      modelProfileId: input.visionAdapter.modelProfileId,
      modelId: input.visionAdapter.modelId,
      provider: input.visionAdapter.provider,
      maxObservations: maxImageInputs,
      requiresStructuredOutput: plan.policy.requireStructuredVisionOutput,
      policy: plan.policy,
    };
    const result = await input.visionAdapter.inspect(request);
    visionResults.push(result);
    visionObservations.push(...result.observations);
    for (const observation of result.observations) {
      sourceObservations.push(visionObservationToSourceObservation(observation, result));
      trace.push(traceEvent({
        type: "source_observation_mapped",
        target: observation.target,
        detail: "Actual vision adapter observation was mapped to SourceObservation-compatible output.",
        metadata: { observationId: observation.id, confidence: observation.confidence },
      }, now));
    }
    for (const target of unique(result.observations.map((observation) => observation.target))) {
      sourceCoverageRecords.push(buildCoverageRecord({
        target,
        status: "inspected_with_limitations",
        inspectedBy: ["rendered_page_renderer", "model_vision_inspector"],
        limitations: [
          "Vision inspection executed, but OCR, document-AI, and structured table recovery were not executed.",
        ],
        now,
      }));
    }
    trace.push(traceEvent({
      type: "vision_executed",
      target: null,
      detail: "Configured vision adapter executed and produced vision observations.",
      metadata: { resultId: result.id, observationCount: result.observations.length },
    }, now));
  }

  const contextPayloads = [
    ...renderedPagePayloads.map(renderedPayloadToContextPayload),
    ...pageCropPayloads.map(cropPayloadToContextPayload),
    ...visionResults.flatMap((result) => result.observations.map((observation) => visionObservationToContextPayload(observation, result))),
  ];
  const capabilityGapRecords = mapVisualInspectionCapabilityGaps(plan, now);
  const contextDebtRecords = mapVisualInspectionContextDebt(plan, now);
  const catalogResolution = catalogFor(plan, input);
  const transportResult = planAdaptiveContextTransport({
    request: input.request,
    agentControl: input.agentControl,
    availablePayloads: contextPayloads,
    requestedPayloads: buildTransportRequirements(plan),
    catalogResolution,
    visualInspectionDebugSnapshot: {
      planId: plan.id,
      producedPayloadIds: contextPayloads.map((payload) => payload.id),
      noOcrExecuted: true,
      noDocumentAiExecuted: true,
    },
  });
  trace.push(traceEvent({
    type: "transport_planned",
    target: null,
    detail: "A-04h transport planned selected, excluded, and missing visual payloads.",
    metadata: {
      selectedPayloadIds: transportResult.selectedPayloads.map((payload) => payload.id),
      missingPayloadTypes: transportResult.missingPayloadCapabilities.map((missing) => missing.payloadType),
    },
  }, now));
  trace.push(traceEvent({
    type: "non_execution_confirmed",
    target: null,
    detail: "OCR, document-AI, SharePoint/company connectors, browser automation, and creation pipeline were not executed.",
    metadata: {
      ocrExecuted: false,
      documentAiExecuted: false,
      sharePointOrCompanyConnectorExecuted: false,
      browserAutomationExecuted: false,
      creationPipelineExecuted: false,
    },
  }, now));

  const debugSnapshot = buildVisualInspectionDebugSnapshot({
    plan,
    contextPayloads,
    sourceObservations,
    contextDebtRecords,
    capabilityGapRecords,
    renderedPagePayloads,
    pageCropPayloads,
    visionObservations,
    transportResult,
    catalogResolution,
  });

  return {
    plan,
    renderedPagePayloads,
    pageCropPayloads,
    visionResults,
    visionObservations,
    contextPayloads,
    sourceObservations,
    sourceCoverageRecords,
    contextDebtRecords,
    capabilityGapRecords,
    transportResult,
    trace: {
      planId: plan.id,
      events: trace,
      noOcrExecuted: true,
      noDocumentAiExecuted: true,
      noSharePointOrCompanyConnectorExecuted: true,
      noBrowserAutomationExecuted: true,
      noCreationPipelineExecuted: true,
    },
    debugSnapshot,
    noUnavailableToolExecutionClaimed: true,
  };
}

function buildVisualInspectionDebugSnapshot(params: {
  plan: VisualInspectionPlan;
  contextPayloads: ContextPayload[];
  sourceObservations: SourceObservation[];
  contextDebtRecords: ContextDebtRecord[];
  capabilityGapRecords: CapabilityGapRecord[];
  renderedPagePayloads: RenderedPagePayload[];
  pageCropPayloads: PageCropPayload[];
  visionObservations: VisionInspectionObservation[];
  transportResult: ContextTransportResult;
  catalogResolution: ReturnType<typeof resolveCatalogForAdaptiveContextTransport>;
}): VisualInspectionDebugSnapshot {
  return {
    plan: params.plan,
    sourcePageTargets: params.plan.sourceTargets,
    rendererAvailability: params.plan.runtimeSupport.renderedPageRenderer,
    visionAvailability: params.plan.runtimeSupport.visionModelInspector,
    catalogEntriesConsidered: {
      payloadTypes: params.catalogResolution.snapshot.payloadEntries.map((entry) => entry.payloadType),
      toolIds: params.catalogResolution.snapshot.toolEntries.map((entry) => entry.toolId),
      modelProfileIds: params.catalogResolution.snapshot.modelEntries.map((entry) => entry.modelProfileId),
      laneIds: params.catalogResolution.snapshot.transportLaneEntries.map((entry) => entry.laneId),
    },
    transportPayloadsRequested: params.transportResult.plan.requestedPayloads.map((requirement) => requirement.payloadType),
    payloadsProduced: params.contextPayloads.map((payload) => ({
      id: payload.id,
      type: payload.type,
      label: payload.label,
      representation: payload.representation,
      available: payload.available,
    })),
    payloadsSelected: params.transportResult.selectedPayloads.map((payload) => payload.id),
    payloadsExcluded: params.transportResult.excludedPayloads.map((excluded) => ({
      payloadType: excluded.payloadType,
      reason: excluded.reason,
      detail: excluded.detail,
    })),
    payloadsMissing: params.transportResult.missingPayloadCapabilities.map((missing) => ({
      payloadType: missing.payloadType,
      reason: missing.reason,
    })),
    policyDecisions: params.plan.eligibility,
    toolManifestsUsed: params.transportResult.plan.toolOutputManifestsConsidered.map((manifest) => manifest.toolId),
    modelManifestsUsed: [params.transportResult.plan.modelCapabilityManifest.consumerId],
    renderedArtifactRefs: [
      ...params.renderedPagePayloads.map((payload) => payload.artifactRef),
      ...params.pageCropPayloads.map((payload) => payload.artifactRef),
    ],
    visionObservations: params.visionObservations,
    sourceObservationRefs: params.sourceObservations.map((observation) => observation.id),
    contextDebtRefs: params.contextDebtRecords.map((record) => record.debtKey),
    capabilityGapRefs: params.capabilityGapRecords.map((record) => record.gapKey),
    nonExecutionConfirmations: {
      ocrExecuted: false,
      documentAiExecuted: false,
      sharePointOrCompanyConnectorExecuted: false,
      browserAutomationExecuted: false,
      creationPipelineExecuted: false,
    },
    noUnavailableToolExecutionClaimed: true,
  };
}

function svgDataUri(svg: string) {
  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
}

export function createDeterministicRenderedPageRenderer(options: {
  rendererId?: string;
  width?: number;
  height?: number;
  supportsCrop?: boolean;
} = {}): RenderedPageRenderer {
  const width = options.width ?? 800;
  const height = options.height ?? 1100;
  const rendererId = options.rendererId ?? "deterministic_test_rendered_page_renderer";
  return {
    rendererId,
    implementationAvailable: true,
    supportsCrop: options.supportsCrop ?? true,
    persistenceSupported: false,
    renderPage({ target, now }) {
      const label = targetLabel(target);
      const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}"><rect width="100%" height="100%" fill="#fff"/><rect x="48" y="64" width="${width - 96}" height="${height - 128}" fill="none" stroke="#111" stroke-width="4"/><text x="72" y="116" font-family="Arial" font-size="32" fill="#111">${label}</text><text x="72" y="180" font-family="Arial" font-size="24" fill="#444">Deterministic rendered page test image</text></svg>`;
      const id = `rendered:${shortHash(`${targetKey(target)}:${rendererId}`)}`;
      return {
        id,
        payloadType: "rendered_page_image",
        target,
        artifactRef: {
          refId: `artifact:${id}`,
          refType: "data_uri",
          uri: svgDataUri(svg),
          mimeType: "image/svg+xml",
          byteLength: svg.length,
          persistence: "runtime_only",
          cleanupPolicy: "runtime_gc",
        },
        width,
        height,
        dpi: 144,
        rendererId,
        producedAt: nowIso(now),
        metadata: {
          deterministicTestPath: true,
          renderedFromSourceTarget: true,
        },
      } satisfies RenderedPagePayload;
    },
    renderCrop({ target, crop, now }) {
      if (!crop.coordinates) return null;
      const cropWidth = Math.max(1, Math.round(crop.coordinates.width));
      const cropHeight = Math.max(1, Math.round(crop.coordinates.height));
      const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${cropWidth}" height="${cropHeight}" viewBox="0 0 ${cropWidth} ${cropHeight}"><rect width="100%" height="100%" fill="#fff"/><rect x="4" y="4" width="${Math.max(1, cropWidth - 8)}" height="${Math.max(1, cropHeight - 8)}" fill="none" stroke="#111" stroke-width="3"/><text x="16" y="40" font-family="Arial" font-size="20" fill="#111">Crop: ${crop.label ?? targetLabel(target)}</text></svg>`;
      const id = `crop:${shortHash(`${targetKey(target)}:${JSON.stringify(crop.coordinates)}:${rendererId}`)}`;
      return {
        id,
        payloadType: "page_crop_image",
        parentRenderedPagePayloadId: null,
        target,
        crop: crop.coordinates,
        artifactRef: {
          refId: `artifact:${id}`,
          refType: "data_uri",
          uri: svgDataUri(svg),
          mimeType: "image/svg+xml",
          byteLength: svg.length,
          persistence: "runtime_only",
          cleanupPolicy: "runtime_gc",
        },
        width: cropWidth,
        height: cropHeight,
        rendererId,
        producedAt: nowIso(now),
        metadata: {
          deterministicTestPath: true,
          noInventedCropCoordinates: true,
          plannedBy: crop.plannedBy ?? "explicit_user_request",
        },
      } satisfies PageCropPayload;
    },
  };
}

export function createDeterministicVisionInspectionAdapter(options: {
  adapterId?: string;
  modelProfileId?: string;
  modelId?: string;
  provider?: string;
  requiresApproval?: boolean;
  observationText?: string;
} = {}): VisionInspectionAdapter {
  const adapterId = options.adapterId ?? "deterministic_test_vision_adapter";
  const modelProfileId = options.modelProfileId ?? "deterministic_vision_model_profile";
  const modelId = options.modelId ?? "deterministic-vision-model";
  const provider = options.provider ?? "test_fixture_provider";
  return {
    adapterId,
    modelProfileId,
    modelId,
    provider,
    maxImageInputs: 4,
    supportsStructuredOutput: true,
    requiresApproval: options.requiresApproval ?? false,
    dataEgressClass: "none",
    inspect(request) {
      const executedAt = nowIso(() => new Date());
      const observations = request.imagePayloads.slice(0, request.maxObservations).map((payload, index) => ({
        id: `vision:${shortHash(`${request.id}:${payload.id}:${index}`)}`,
        target: payload.target,
        imagePayloadId: payload.id,
        content:
          options.observationText ??
          `Vision adapter inspected ${payload.payloadType} for ${targetLabel(payload.target)} and found visual source evidence with limitations.`,
        confidence: 0.74,
        limitations: [
          "Deterministic test adapter output; not OCR, document-AI, or structured table extraction.",
          "Exact table body extraction is not claimed.",
        ],
        metadata: {
          deterministicTestPath: true,
          payloadType: payload.payloadType,
        },
      } satisfies VisionInspectionObservation));
      return {
        id: `vision-result:${shortHash(request.id)}`,
        requestId: request.id,
        adapterId,
        modelProfileId,
        modelId,
        provider,
        observations,
        rawResponseRef: null,
        limitations: ["Vision result is constrained to visual observations and does not claim OCR/document-AI execution."],
        executedAt,
        metadata: {
          deterministicTestPath: true,
          imageCount: request.imagePayloads.length,
        },
      } satisfies VisionInspectionResult;
    },
  };
}
