import type { PdfContextExtractionMetadata } from "./context-pdf";
import {
  isCompletedSourceObservation,
  normalizeSourceObservationLocator,
  selectSourceObservationsForTransport,
  type SourceObservation,
  type SourceObservationLocator,
  type SourceObservationPayload,
  type SourceObservationPayloadKind,
  type SourceObservationProducerKind,
  type SourceObservationSourceKind,
  type SourceObservationTransportSelection,
  type SourceObservationType,
} from "./source-observations";
import type {
  SourceObservationProducerAvailabilitySignal,
  SourceObservationProducerAvailabilitySource,
  SourceObservationProducerManifest,
  SourceObservationProducerRequest,
  SourceObservationProducerResult,
  SourceObservationProducerResultState,
} from "./source-observation-producers";

type EnvLike = Record<string, string | undefined>;
type MaybePromise<T> = T | Promise<T>;

export type UploadedDocumentExternalProviderId =
  | "mistral_ocr"
  | "llamaparse_agentic_parse"
  | "google_document_ai"
  | "azure_document_intelligence"
  | "aws_textract"
  | "adobe_pdf_extract"
  | "openai_vision"
  | "anthropic_vision"
  | "gemini_vision"
  | "e2b_sandbox"
  | "daytona_sandbox"
  | "unstructured_external";

export type UploadedDocumentExternalCapabilityId =
  | "ocr"
  | "document_ai_table_recovery"
  | "vision_page_understanding"
  | "spreadsheet_formula_map"
  | "external_sandbox_execution";

export type UploadedDocumentExternalAvailabilityState =
  | "runtime_callable_when_configured"
  | "mock_tested_callable_only"
  | "config_required"
  | "unconfigured"
  | "approval_required"
  | "policy_blocked"
  | "catalog_only"
  | "unavailable"
  | "missing_image_input"
  | "deferred_adapter_missing"
  | "failed"
  | "completed_with_evidence"
  | "skipped_local_sufficient";

export type UploadedDocumentExternalProviderManifest = {
  providerId: UploadedDocumentExternalProviderId;
  providerName: string;
  producerId: string;
  capabilityId: UploadedDocumentExternalCapabilityId;
  producerKind: SourceObservationProducerKind;
  supportedObservationTypes: SourceObservationType[];
  expectedOutputObservationTypes: SourceObservationType[];
  acceptedSourceKinds: string[];
  requiredPayloadType: string;
  requiredConfigEnvKeys: string[];
  requiredConfigEnvKeyGroups: string[][];
  approvalRequired: boolean;
  policyDataClassRequirement: "tenant_source" | "external_execution";
  externalDataEgress: boolean;
  runtimeCallableWhenConfigured: boolean;
  mockTestedCallableOnly: boolean;
  requiresImageInput: boolean;
  realExecutionPath: boolean;
  deferredBecauseSafeAdapterMissing: boolean;
  costClass: "low" | "medium" | "high";
  latencyClass: "short" | "async_preferred";
  notes: string;
};

export type UploadedDocumentExternalProviderStatus = {
  providerId: UploadedDocumentExternalProviderId;
  providerName: string;
  producerId: string;
  capabilityId: UploadedDocumentExternalCapabilityId;
  taskRelevant: boolean;
  localSufficient: boolean;
  availabilityState: UploadedDocumentExternalAvailabilityState;
  runtimeCallableWhenConfigured: boolean;
  mockTestedCallable: boolean;
  configRequired: boolean;
  unconfigured: boolean;
  approvalRequired: boolean;
  policyBlocked: boolean;
  blockedByMissingImageInput: boolean;
  deferredBecauseSafeAdapterMissing: boolean;
  externalDataEgress: boolean;
  requiredConfigEnvKeys: string[];
  missingConfigEnvKeys: string[];
  requiredInputState: "available" | "missing_image_input" | "not_required";
  reason: string;
  noExternalCallMade: boolean;
  noExecutionClaimed: true;
};

export type UploadedDocumentExternalImageInput = {
  id: string;
  mimeType: string;
  dataBase64?: string | null;
  dataUrl?: string | null;
  sourceLocator?: SourceObservationLocator | null;
  pageNumber?: number | null;
  cropId?: string | null;
  sourceLocationLabel?: string | null;
  sourceObservationId?: string | null;
  producerId?: string | null;
  renderedPageImage?: boolean | null;
};

export type UploadedDocumentExternalDocumentRef = {
  id: string;
  conversationId?: string | null;
  filename: string;
  mimeType?: string | null;
  fileType?: string | null;
};

export type UploadedDocumentExternalMockObservation = {
  type: SourceObservationType;
  content: string;
  payloadKind?: SourceObservationPayloadKind;
  payload?: SourceObservationPayload | null;
  locator?: SourceObservationLocator | null;
  confidence?: number | null;
  limitations?: string[];
};

export type UploadedDocumentExternalMockResult = {
  status: "completed" | "failed";
  observations?: UploadedDocumentExternalMockObservation[];
  providerRequestId?: string | null;
  modelOrVersion?: string | null;
  evidenceSummary?: string | null;
  failureReason?: string | null;
  limitations?: string[];
};

export type UploadedDocumentExternalAdapterRequest = {
  manifest: UploadedDocumentExternalProviderManifest;
  document: UploadedDocumentExternalDocumentRef;
  contextKind: string;
  taskPrompt: string | null;
  imageInputs: UploadedDocumentExternalImageInput[];
  selectedPages: number[];
  traceId?: string | null;
  planId?: string | null;
};

export type UploadedDocumentExternalAdapter = (
  request: UploadedDocumentExternalAdapterRequest
) => MaybePromise<UploadedDocumentExternalMockResult>;

export type UploadedDocumentExternalEscalationPolicyInput = {
  taskPrompt?: string | null;
  contextKind: string;
  localObservations?: SourceObservation[] | null;
  localProducerResults?: SourceObservationProducerResult[] | null;
  pdfExtractionMetadata?: PdfContextExtractionMetadata | null;
};

export type UploadedDocumentExternalEscalationPolicyResult = {
  localBaselineEvaluated: true;
  localSufficientCapabilities: UploadedDocumentExternalCapabilityId[];
  neededCapabilities: UploadedDocumentExternalCapabilityId[];
  localInsufficiencyReasons: string[];
  taskTriggers: string[];
};

export type RunUploadedDocumentExternalEscalationProducersParams =
  UploadedDocumentExternalEscalationPolicyInput & {
    document: UploadedDocumentExternalDocumentRef;
    sourceMetadata?: Record<string, unknown> | null;
    selectedPages?: number[] | null;
    imageInputs?: UploadedDocumentExternalImageInput[] | null;
    env?: EnvLike | null;
    policy?: {
      allowExternalProcessing?: boolean;
      dataClassAllowsExternalProcessing?: boolean;
      approvalGranted?: boolean;
      approvedProviderIds?: UploadedDocumentExternalProviderId[];
      approvedCapabilityIds?: UploadedDocumentExternalCapabilityId[];
      maxImageInputs?: number | null;
      maxExternalObservations?: number | null;
      maxExternalObservationsPerDocument?: number | null;
      maxOutputChars?: number | null;
    } | null;
    adapters?: Partial<Record<UploadedDocumentExternalProviderId, UploadedDocumentExternalAdapter>>;
    mockResultsByProviderId?: Partial<Record<UploadedDocumentExternalProviderId, UploadedDocumentExternalMockResult>>;
    allowMockExecution?: boolean;
    fetchImpl?: typeof fetch | null;
    traceId?: string | null;
    planId?: string | null;
    conversationId?: string | null;
    messageId?: string | null;
    nowIso?: string | null;
  };

export type UploadedDocumentDigestionExternalDebugSummary = {
  documentId: string;
  filename: string;
  contextKind: string;
  localBaselineEvaluatedFirst: true;
  approvedExternalCandidateCount: number;
  providerStatuses: UploadedDocumentExternalProviderStatus[];
  selectedProviderIds: UploadedDocumentExternalProviderId[];
  localInsufficiencyReasons: string[];
  externalAttemptedCount: number;
  externalCompletedWithEvidenceCount: number;
  externalFailedCount: number;
  externalSkippedCount: number;
  externalBlockedCount: number;
  externalApprovalRequiredCount: number;
  externalUnconfiguredCount: number;
  missingRequiredInputCount: number;
  observationsProducedByProvider: Record<string, number>;
  rawProviderOutputOmittedCount: number;
  selectedTransportObservationCount: number;
  cappedTransportObservationCount: number;
  durableGapDebtCandidateCount: number;
  noExecutionWarnings: string[];
  noSecretsLogged: true;
  noRawProviderOutputLogged: true;
  noToolOutputBypassesSourceObservation: true;
  noExecutionClaimWithoutCompletedWithEvidence: true;
};

export type UploadedDocumentExternalEscalationResult = {
  observations: SourceObservation[];
  producerRequests: SourceObservationProducerRequest[];
  producerResults: SourceObservationProducerResult[];
  transportSelection: SourceObservationTransportSelection;
  debugSummary: UploadedDocumentDigestionExternalDebugSummary;
  policy: UploadedDocumentExternalEscalationPolicyResult;
};

const OPENAI_CHAT_COMPLETIONS_URL = "https://api.openai.com/v1/chat/completions";
const DEFAULT_EXTERNAL_MAX_OBSERVATIONS = 6;
const DEFAULT_EXTERNAL_MAX_OBSERVATIONS_PER_DOCUMENT = 4;
const DEFAULT_EXTERNAL_MAX_OUTPUT_CHARS = 1_400;
const DEFAULT_MAX_IMAGE_INPUTS = 2;

function manifest(input: UploadedDocumentExternalProviderManifest) {
  return input;
}

export const APPROVED_UPLOADED_DOCUMENT_EXTERNAL_PRODUCER_MANIFESTS = [
  manifest({
    providerId: "mistral_ocr",
    providerName: "Mistral OCR",
    producerId: "mistral_ocr_extractor",
    capabilityId: "ocr",
    producerKind: "document_intelligence",
    supportedObservationTypes: ["ocr_text", "ocr_page_text", "extraction_warning", "table_extraction"],
    expectedOutputObservationTypes: ["ocr_text", "ocr_page_text", "extraction_warning"],
    acceptedSourceKinds: ["uploaded_document", "pdf", "image"],
    requiredPayloadType: "ocr_text",
    requiredConfigEnvKeys: ["MISTRAL_API_KEY"],
    requiredConfigEnvKeyGroups: [["MISTRAL_API_KEY"]],
    approvalRequired: true,
    policyDataClassRequirement: "external_execution",
    externalDataEgress: true,
    runtimeCallableWhenConfigured: false,
    mockTestedCallableOnly: true,
    requiresImageInput: false,
    realExecutionPath: false,
    deferredBecauseSafeAdapterMissing: false,
    costClass: "medium",
    latencyClass: "async_preferred",
    notes: "Approved OCR candidate. WP4A2 provides the governed contract and mock adapter; no Mistral SDK or runtime adapter is added.",
  }),
  manifest({
    providerId: "llamaparse_agentic_parse",
    providerName: "LlamaParse / Agentic Parse",
    producerId: "llamaparse_document_parser",
    capabilityId: "document_ai_table_recovery",
    producerKind: "document_intelligence",
    supportedObservationTypes: ["document_elements", "layout_map", "table_extraction", "pdf_structure", "extraction_warning"],
    expectedOutputObservationTypes: ["document_ai_result", "document_elements", "table_extraction", "pdf_structure"],
    acceptedSourceKinds: ["uploaded_document", "pdf", "pptx", "docx"],
    requiredPayloadType: "document_ai_result",
    requiredConfigEnvKeys: ["LLAMA_CLOUD_API_KEY", "LLAMAPARSE_API_KEY"],
    requiredConfigEnvKeyGroups: [["LLAMA_CLOUD_API_KEY"], ["LLAMAPARSE_API_KEY"]],
    approvalRequired: true,
    policyDataClassRequirement: "external_execution",
    externalDataEgress: true,
    runtimeCallableWhenConfigured: false,
    mockTestedCallableOnly: true,
    requiresImageInput: false,
    realExecutionPath: false,
    deferredBecauseSafeAdapterMissing: false,
    costClass: "medium",
    latencyClass: "async_preferred",
    notes: "Approved parser candidate. WP4A2 adds contract/mock behavior only because no existing safe LlamaParse runtime adapter is present.",
  }),
  manifest({
    providerId: "google_document_ai",
    providerName: "Google Document AI",
    producerId: "google_document_ai_parser",
    capabilityId: "document_ai_table_recovery",
    producerKind: "document_intelligence",
    supportedObservationTypes: ["document_ai_result", "document_elements", "table_extraction", "form_fields", "key_value_extraction"],
    expectedOutputObservationTypes: ["document_ai_result", "table_extraction", "form_fields", "key_value_extraction"],
    acceptedSourceKinds: ["uploaded_document", "pdf", "image"],
    requiredPayloadType: "document_ai_result",
    requiredConfigEnvKeys: ["GOOGLE_DOCUMENT_AI_PROCESSOR_ID", "GOOGLE_APPLICATION_CREDENTIALS"],
    requiredConfigEnvKeyGroups: [["GOOGLE_DOCUMENT_AI_PROCESSOR_ID", "GOOGLE_APPLICATION_CREDENTIALS"]],
    approvalRequired: true,
    policyDataClassRequirement: "external_execution",
    externalDataEgress: true,
    runtimeCallableWhenConfigured: false,
    mockTestedCallableOnly: false,
    requiresImageInput: false,
    realExecutionPath: false,
    deferredBecauseSafeAdapterMissing: true,
    costClass: "high",
    latencyClass: "async_preferred",
    notes: "Approved document-AI candidate; deferred because current repo patterns do not include a safe Document AI adapter.",
  }),
  manifest({
    providerId: "azure_document_intelligence",
    providerName: "Azure Document Intelligence",
    producerId: "azure_document_intelligence_parser",
    capabilityId: "document_ai_table_recovery",
    producerKind: "document_intelligence",
    supportedObservationTypes: ["document_ai_result", "document_elements", "table_extraction", "form_fields", "key_value_extraction"],
    expectedOutputObservationTypes: ["document_ai_result", "table_extraction", "form_fields", "key_value_extraction"],
    acceptedSourceKinds: ["uploaded_document", "pdf", "image"],
    requiredPayloadType: "document_ai_result",
    requiredConfigEnvKeys: ["AZURE_DOCUMENT_INTELLIGENCE_ENDPOINT", "AZURE_DOCUMENT_INTELLIGENCE_KEY"],
    requiredConfigEnvKeyGroups: [["AZURE_DOCUMENT_INTELLIGENCE_ENDPOINT", "AZURE_DOCUMENT_INTELLIGENCE_KEY"]],
    approvalRequired: true,
    policyDataClassRequirement: "external_execution",
    externalDataEgress: true,
    runtimeCallableWhenConfigured: false,
    mockTestedCallableOnly: false,
    requiresImageInput: false,
    realExecutionPath: false,
    deferredBecauseSafeAdapterMissing: true,
    costClass: "high",
    latencyClass: "async_preferred",
    notes: "Approved document-AI candidate; deferred because current repo patterns do not include a safe Azure adapter.",
  }),
  manifest({
    providerId: "aws_textract",
    providerName: "AWS Textract",
    producerId: "aws_textract_parser",
    capabilityId: "document_ai_table_recovery",
    producerKind: "document_intelligence",
    supportedObservationTypes: ["document_ai_result", "document_elements", "table_extraction", "form_fields", "key_value_extraction"],
    expectedOutputObservationTypes: ["document_ai_result", "table_extraction", "form_fields", "key_value_extraction"],
    acceptedSourceKinds: ["uploaded_document", "pdf", "image"],
    requiredPayloadType: "document_ai_result",
    requiredConfigEnvKeys: ["AWS_ACCESS_KEY_ID", "AWS_SECRET_ACCESS_KEY", "AWS_REGION"],
    requiredConfigEnvKeyGroups: [["AWS_ACCESS_KEY_ID", "AWS_SECRET_ACCESS_KEY", "AWS_REGION"]],
    approvalRequired: true,
    policyDataClassRequirement: "external_execution",
    externalDataEgress: true,
    runtimeCallableWhenConfigured: false,
    mockTestedCallableOnly: false,
    requiresImageInput: false,
    realExecutionPath: false,
    deferredBecauseSafeAdapterMissing: true,
    costClass: "high",
    latencyClass: "async_preferred",
    notes: "Approved document-AI candidate; deferred because current repo patterns do not include a safe Textract adapter.",
  }),
  manifest({
    providerId: "adobe_pdf_extract",
    providerName: "Adobe PDF Extract API",
    producerId: "adobe_pdf_extract_parser",
    capabilityId: "document_ai_table_recovery",
    producerKind: "document_intelligence",
    supportedObservationTypes: ["document_ai_result", "document_elements", "layout_map", "table_extraction", "pdf_structure"],
    expectedOutputObservationTypes: ["document_ai_result", "document_elements", "layout_map", "pdf_structure"],
    acceptedSourceKinds: ["uploaded_document", "pdf"],
    requiredPayloadType: "document_ai_result",
    requiredConfigEnvKeys: ["ADOBE_PDF_EXTRACT_CLIENT_ID", "ADOBE_PDF_EXTRACT_CLIENT_SECRET"],
    requiredConfigEnvKeyGroups: [["ADOBE_PDF_EXTRACT_CLIENT_ID", "ADOBE_PDF_EXTRACT_CLIENT_SECRET"]],
    approvalRequired: true,
    policyDataClassRequirement: "external_execution",
    externalDataEgress: true,
    runtimeCallableWhenConfigured: false,
    mockTestedCallableOnly: false,
    requiresImageInput: false,
    realExecutionPath: false,
    deferredBecauseSafeAdapterMissing: true,
    costClass: "high",
    latencyClass: "async_preferred",
    notes: "Approved PDF parser candidate; deferred because current repo patterns do not include a safe Adobe adapter.",
  }),
  manifest({
    providerId: "openai_vision",
    providerName: "OpenAI vision-capable model",
    producerId: "openai_vision_inspector",
    capabilityId: "vision_page_understanding",
    producerKind: "model",
    supportedObservationTypes: ["model_vision_result", "figure_interpretation", "chart_interpretation", "visual_region_assessment", "extraction_warning"],
    expectedOutputObservationTypes: ["model_vision_result", "figure_interpretation", "chart_interpretation"],
    acceptedSourceKinds: ["uploaded_document", "rendered_page_image", "page_crop_image", "image"],
    requiredPayloadType: "vision_observation",
    requiredConfigEnvKeys: ["OPENAI_API_KEY", "OPENAI_VISION_MODEL"],
    requiredConfigEnvKeyGroups: [["OPENAI_API_KEY", "OPENAI_VISION_MODEL"]],
    approvalRequired: true,
    policyDataClassRequirement: "external_execution",
    externalDataEgress: true,
    runtimeCallableWhenConfigured: true,
    mockTestedCallableOnly: true,
    requiresImageInput: true,
    realExecutionPath: true,
    deferredBecauseSafeAdapterMissing: false,
    costClass: "medium",
    latencyClass: "short",
    notes: "WP4A2's single real external execution path. It uses the existing fetch/JSON/Bearer pattern and only runs with real image input plus config, policy, approval, and local insufficiency gates.",
  }),
  manifest({
    providerId: "anthropic_vision",
    providerName: "Anthropic vision-capable model",
    producerId: "anthropic_vision_inspector",
    capabilityId: "vision_page_understanding",
    producerKind: "model",
    supportedObservationTypes: ["model_vision_result", "figure_interpretation", "chart_interpretation", "visual_region_assessment"],
    expectedOutputObservationTypes: ["model_vision_result", "figure_interpretation", "chart_interpretation"],
    acceptedSourceKinds: ["uploaded_document", "rendered_page_image", "page_crop_image", "image"],
    requiredPayloadType: "vision_observation",
    requiredConfigEnvKeys: ["ANTHROPIC_API_KEY", "ANTHROPIC_VISION_MODEL"],
    requiredConfigEnvKeyGroups: [["ANTHROPIC_API_KEY", "ANTHROPIC_VISION_MODEL"]],
    approvalRequired: true,
    policyDataClassRequirement: "external_execution",
    externalDataEgress: true,
    runtimeCallableWhenConfigured: false,
    mockTestedCallableOnly: false,
    requiresImageInput: true,
    realExecutionPath: false,
    deferredBecauseSafeAdapterMissing: true,
    costClass: "medium",
    latencyClass: "short",
    notes: "Approved vision candidate; deferred because WP4A2 selects OpenAI as the single real path and no shared Anthropic vision adapter is added.",
  }),
  manifest({
    providerId: "gemini_vision",
    providerName: "Gemini vision-capable model",
    producerId: "gemini_vision_inspector",
    capabilityId: "vision_page_understanding",
    producerKind: "model",
    supportedObservationTypes: ["model_vision_result", "figure_interpretation", "chart_interpretation", "visual_region_assessment"],
    expectedOutputObservationTypes: ["model_vision_result", "figure_interpretation", "chart_interpretation"],
    acceptedSourceKinds: ["uploaded_document", "rendered_page_image", "page_crop_image", "image"],
    requiredPayloadType: "vision_observation",
    requiredConfigEnvKeys: ["GOOGLE_GENERATIVE_AI_API_KEY", "GEMINI_VISION_MODEL"],
    requiredConfigEnvKeyGroups: [["GOOGLE_GENERATIVE_AI_API_KEY", "GEMINI_VISION_MODEL"]],
    approvalRequired: true,
    policyDataClassRequirement: "external_execution",
    externalDataEgress: true,
    runtimeCallableWhenConfigured: false,
    mockTestedCallableOnly: false,
    requiresImageInput: true,
    realExecutionPath: false,
    deferredBecauseSafeAdapterMissing: true,
    costClass: "medium",
    latencyClass: "short",
    notes: "Approved vision candidate; deferred because WP4A2 selects OpenAI as the single real path and no shared Gemini vision adapter is added.",
  }),
  manifest({
    providerId: "e2b_sandbox",
    providerName: "E2B",
    producerId: "e2b_uploaded_document_sandbox",
    capabilityId: "external_sandbox_execution",
    producerKind: "analysis_sandbox_future",
    supportedObservationTypes: ["calculation_trace_future", "spreadsheet_formula_map"],
    expectedOutputObservationTypes: ["calculation_trace_future", "spreadsheet_formula_map"],
    acceptedSourceKinds: ["uploaded_document", "spreadsheet"],
    requiredPayloadType: "code_analysis_result",
    requiredConfigEnvKeys: ["E2B_API_KEY"],
    requiredConfigEnvKeyGroups: [["E2B_API_KEY"]],
    approvalRequired: true,
    policyDataClassRequirement: "external_execution",
    externalDataEgress: true,
    runtimeCallableWhenConfigured: false,
    mockTestedCallableOnly: false,
    requiresImageInput: false,
    realExecutionPath: false,
    deferredBecauseSafeAdapterMissing: true,
    costClass: "medium",
    latencyClass: "async_preferred",
    notes: "Approved sandbox candidate only. WP4A2 does not add arbitrary code execution; robust sandbox remains WP4C.",
  }),
  manifest({
    providerId: "daytona_sandbox",
    providerName: "Daytona",
    producerId: "daytona_uploaded_document_sandbox",
    capabilityId: "external_sandbox_execution",
    producerKind: "analysis_sandbox_future",
    supportedObservationTypes: ["calculation_trace_future", "spreadsheet_formula_map"],
    expectedOutputObservationTypes: ["calculation_trace_future", "spreadsheet_formula_map"],
    acceptedSourceKinds: ["uploaded_document", "spreadsheet"],
    requiredPayloadType: "code_analysis_result",
    requiredConfigEnvKeys: ["DAYTONA_API_KEY"],
    requiredConfigEnvKeyGroups: [["DAYTONA_API_KEY"]],
    approvalRequired: true,
    policyDataClassRequirement: "external_execution",
    externalDataEgress: true,
    runtimeCallableWhenConfigured: false,
    mockTestedCallableOnly: false,
    requiresImageInput: false,
    realExecutionPath: false,
    deferredBecauseSafeAdapterMissing: true,
    costClass: "medium",
    latencyClass: "async_preferred",
    notes: "Approved sandbox candidate only. WP4A2 does not add arbitrary code execution; robust sandbox remains WP4C.",
  }),
  manifest({
    providerId: "unstructured_external",
    providerName: "Unstructured external/hybrid",
    producerId: "unstructured_external_parser",
    capabilityId: "document_ai_table_recovery",
    producerKind: "document_intelligence",
    supportedObservationTypes: ["document_ai_result", "document_elements", "layout_map", "table_extraction", "extraction_warning"],
    expectedOutputObservationTypes: ["document_ai_result", "document_elements", "table_extraction"],
    acceptedSourceKinds: ["uploaded_document", "pdf", "docx", "pptx"],
    requiredPayloadType: "document_ai_result",
    requiredConfigEnvKeys: ["UNSTRUCTURED_API_KEY", "UNSTRUCTURED_API_URL"],
    requiredConfigEnvKeyGroups: [["UNSTRUCTURED_API_KEY", "UNSTRUCTURED_API_URL"]],
    approvalRequired: true,
    policyDataClassRequirement: "external_execution",
    externalDataEgress: true,
    runtimeCallableWhenConfigured: false,
    mockTestedCallableOnly: false,
    requiresImageInput: false,
    realExecutionPath: false,
    deferredBecauseSafeAdapterMissing: true,
    costClass: "medium",
    latencyClass: "async_preferred",
    notes: "Approved external/hybrid parser candidate if configured later; no safe adapter is present in WP4A2.",
  }),
] as const satisfies readonly UploadedDocumentExternalProviderManifest[];

export const UPLOADED_DOCUMENT_EXTERNAL_SOURCE_OBSERVATION_PRODUCER_MANIFESTS =
  APPROVED_UPLOADED_DOCUMENT_EXTERNAL_PRODUCER_MANIFESTS.map((entry) => ({
    producerId: entry.producerId,
    capabilityId: entry.capabilityId,
    producerKind: entry.producerKind,
    acceptedSourceKinds: entry.acceptedSourceKinds,
    requiredInputLanes: [entry.requiredPayloadType],
    producedObservationTypes: entry.expectedOutputObservationTypes,
    producedPayloadKinds: ["text", "structured", "table", "warning"],
    producedPayloadTypes: [entry.requiredPayloadType],
    modelRequirements: entry.producerKind === "model" ? [entry.providerId] : [],
    toolRequirements: entry.producerKind === "model" ? [] : [entry.providerId],
    laneRequirements: [entry.requiredPayloadType],
    approvalRequired: entry.approvalRequired,
    policyDataClass: entry.policyDataClassRequirement,
    sideEffects: entry.externalDataEgress ? "external_read" : "read_current_evidence",
    costEstimate: entry.costClass,
    latencyEstimate: entry.latencyClass === "short" ? "short" : "long_running",
    currentAvailability: entry.realExecutionPath ? "approval_required" : entry.deferredBecauseSafeAdapterMissing ? "deferred" : "catalog_only",
    reasonUnavailable: entry.notes,
    executionEvidenceRequirement:
      "A completed external producer must emit SourceObservations with provider id, request/model evidence, source locator, confidence, limitations, and completed_with_evidence producer result.",
    canonicalCatalogIds: {
      payloadTypes: [entry.requiredPayloadType],
      laneIds: [entry.requiredPayloadType],
      toolIds: [entry.producerId, entry.providerId],
      capabilityIds: [entry.capabilityId],
    },
    noUnavailableToolExecutionClaimed: true,
  })) satisfies SourceObservationProducerManifest[];

function unique<T>(values: T[]): T[] {
  return values.filter((value, index, all) => all.indexOf(value) === index);
}

function normalizeText(value: string | null | undefined) {
  return (value ?? "").replace(/\s+/g, " ").trim();
}

function capText(value: string, maxChars: number) {
  const normalized = normalizeText(value);
  if (normalized.length <= maxChars) return normalized;
  return `${normalized.slice(0, Math.max(0, maxChars - 16)).trim()} [truncated]`;
}

function shortHash(value: string) {
  let hash = 0;
  for (let index = 0; index < value.length; index += 1) {
    hash = (hash * 31 + value.charCodeAt(index)) >>> 0;
  }
  return hash.toString(36);
}

function configuredEnv(env: EnvLike, manifest: UploadedDocumentExternalProviderManifest) {
  const configuredGroup = manifest.requiredConfigEnvKeyGroups.find((group) =>
    group.every((key) => Boolean(env[key]?.trim()))
  );
  const expectedKeys = configuredGroup ?? manifest.requiredConfigEnvKeyGroups[0] ?? manifest.requiredConfigEnvKeys;
  const missing = expectedKeys.filter((key) => !env[key]?.trim());
  return {
    configured: missing.length === 0,
    missing,
  };
}

function capabilityHasCompletedObservation(
  observations: SourceObservation[],
  capabilityId: UploadedDocumentExternalCapabilityId
) {
  const completed = observations.filter(isCompletedSourceObservation);
  if (capabilityId === "ocr") {
    return completed.some((observation) => observation.type === "ocr_text" || observation.type === "ocr_page_text");
  }
  if (capabilityId === "vision_page_understanding") {
    return completed.some((observation) =>
      observation.type === "vision_observation" ||
      observation.type === "model_vision_result" ||
      observation.type === "figure_interpretation" ||
      observation.type === "chart_interpretation" ||
      observation.type === "visual_region_assessment"
    );
  }
  if (capabilityId === "document_ai_table_recovery") {
    return completed.some((observation) =>
      observation.type === "document_ai_result" ||
      observation.type === "document_elements" ||
      observation.type === "layout_map" ||
      observation.type === "table_extraction" ||
      observation.type === "form_fields" ||
      observation.type === "key_value_extraction" ||
      observation.type === "pdf_structure" ||
      observation.type === "structured_table_observation"
    );
  }
  if (capabilityId === "spreadsheet_formula_map") {
    return completed.some((observation) => observation.type === "spreadsheet_formula_map");
  }
  return false;
}

function hasUnresolvedNeed(results: SourceObservationProducerResult[], pattern: RegExp) {
  return results.some((result) =>
    result.unresolvedNeeds.some((need) =>
      pattern.test(`${need.capability ?? ""} ${need.payloadType ?? ""} ${need.reason}`)
    )
  );
}

function inferTaskTriggers(prompt: string | null | undefined) {
  const value = prompt ?? "";
  return {
    highFidelity: /\b(high[-\s]?fidelity|deep|audit|best\s+possible|full\s+(?:document|ingestion|extraction)|complete\s+extraction)\b/i.test(value),
    ocr: /\b(ocr|scanned|image[-\s]?only|read\s+(?:the\s+)?scanned|low[-\s]?text)\b/i.test(value),
    vision: /\b(chart|figure|diagram|visual|image|photo|appearance|page\s+look|plot|map|schematic)\b/i.test(value),
    documentAi: /\b(form|key[-\s]?value|table\s+body|tables?|layout|columns?|rows?|complex\s+pdf|agentic\s+parse|document[-\s]?ai|parser)\b/i.test(value),
    sandbox: /\b(python|dataframe|duckdb|pandas|polars|macro|formula\s+eval|calculate\s+from\s+spreadsheet)\b/i.test(value),
  };
}

export function evaluateUploadedDocumentExternalEscalationPolicy(
  input: UploadedDocumentExternalEscalationPolicyInput
): UploadedDocumentExternalEscalationPolicyResult {
  const observations = input.localObservations ?? [];
  const results = input.localProducerResults ?? [];
  const triggers = inferTaskTriggers(input.taskPrompt);
  const lowTextPages = input.pdfExtractionMetadata?.lowTextPageNumbers ?? [];
  const tableSignalWithoutBody = observations.some((observation) =>
    observation.type === "table_signal" ||
    observation.relatedGapHints?.some((hint) => hint.kind === "missing_table_body")
  );
  const localInsufficiencyReasons: string[] = [];
  const taskTriggers: string[] = [];

  if (triggers.highFidelity) taskTriggers.push("high_fidelity_or_audit_request");
  if (triggers.ocr) taskTriggers.push("ocr_or_scanned_document_request");
  if (triggers.vision) taskTriggers.push("semantic_visual_understanding_request");
  if (triggers.documentAi) taskTriggers.push("document_ai_or_table_form_request");
  if (triggers.sandbox) taskTriggers.push("external_sandbox_or_spreadsheet_computation_request");

  if (lowTextPages.length > 0) {
    localInsufficiencyReasons.push(`Local PDF evidence reported ${lowTextPages.length} low-text/scanned page(s); OCR is not implemented locally.`);
  }
  if (tableSignalWithoutBody || hasUnresolvedNeed(results, /structured_table|table_body|document_ai/i)) {
    localInsufficiencyReasons.push("Local parser evidence detected a table/form need but did not prove a recovered structured body.");
  }
  if (hasUnresolvedNeed(results, /ocr|vision_observation|document_ai_result|code_analysis_result/i)) {
    localInsufficiencyReasons.push("Existing producer results contain unresolved richer-ingestion needs.");
  }

  const needed = new Set<UploadedDocumentExternalCapabilityId>();
  if ((triggers.ocr || (triggers.highFidelity && lowTextPages.length > 0)) && !capabilityHasCompletedObservation(observations, "ocr")) {
    needed.add("ocr");
  }
  if (triggers.vision && !capabilityHasCompletedObservation(observations, "vision_page_understanding")) {
    needed.add("vision_page_understanding");
  }
  if (
    (triggers.documentAi || triggers.highFidelity || tableSignalWithoutBody || hasUnresolvedNeed(results, /structured_table|document_ai/i)) &&
    !capabilityHasCompletedObservation(observations, "document_ai_table_recovery")
  ) {
    needed.add("document_ai_table_recovery");
  }
  if ((triggers.sandbox || hasUnresolvedNeed(results, /code_analysis_result|spreadsheet_formula/i)) &&
    !capabilityHasCompletedObservation(observations, "spreadsheet_formula_map")) {
    needed.add("external_sandbox_execution");
  }

  const localSufficientCapabilities = ([
    "ocr",
    "document_ai_table_recovery",
    "vision_page_understanding",
    "spreadsheet_formula_map",
  ] as UploadedDocumentExternalCapabilityId[]).filter((capability) =>
    capabilityHasCompletedObservation(observations, capability)
  );

  if (needed.size === 0 && taskTriggers.length > 0 && localSufficientCapabilities.length > 0) {
    localInsufficiencyReasons.push("Local completed SourceObservations already satisfy the requested external-capability class.");
  }

  return {
    localBaselineEvaluated: true,
    localSufficientCapabilities,
    neededCapabilities: [...needed],
    localInsufficiencyReasons: unique(localInsufficiencyReasons),
    taskTriggers,
  };
}

function capabilityMatches(
  manifest: UploadedDocumentExternalProviderManifest,
  policy: UploadedDocumentExternalEscalationPolicyResult
) {
  if (manifest.capabilityId === "external_sandbox_execution") {
    return policy.neededCapabilities.includes("external_sandbox_execution");
  }
  return policy.neededCapabilities.includes(manifest.capabilityId);
}

function statusReason(params: {
  manifest: UploadedDocumentExternalProviderManifest;
  state: UploadedDocumentExternalAvailabilityState;
  missingConfig: string[];
}) {
  const provider = params.manifest.providerName;
  switch (params.state) {
    case "catalog_only":
      return `${provider} is approved in the external uploaded-document catalogue but is not task-needed for this turn.`;
    case "skipped_local_sufficient":
      return `Local completed SourceObservations already satisfy the current need; ${provider} was not escalated.`;
    case "policy_blocked":
      return `${provider} would require external data processing that current policy blocks.`;
    case "approval_required":
      return `${provider} requires approval before uploaded document data can leave the local runtime.`;
    case "missing_image_input":
      return `${provider} requires real rendered/page/crop/image input; none is available for this request.`;
    case "config_required":
    case "unconfigured":
      return `${provider} is not configured. Missing env key(s): ${params.missingConfig.join(", ")}.`;
    case "runtime_callable_when_configured":
      return `${provider} has a governed runtime path available under current config, policy, approval, task-need, local-insufficiency, and input gates.`;
    case "mock_tested_callable_only":
      return `${provider} is callable through the mock/test adapter contract only; no production runtime adapter is enabled in WP4A2.`;
    case "deferred_adapter_missing":
      return `${provider} is approved but deferred because a safe existing runtime adapter is missing.`;
    case "failed":
      return `${provider} execution failed; no completed observation was created.`;
    case "completed_with_evidence":
      return `${provider} completed with execution evidence and produced SourceObservations.`;
    default:
      return `${provider} is unavailable for this turn.`;
  }
}

export function resolveUploadedDocumentExternalProducerStatuses(params: {
  policy: UploadedDocumentExternalEscalationPolicyResult;
  env?: EnvLike | null;
  approvalGranted?: boolean;
  approvedProviderIds?: UploadedDocumentExternalProviderId[] | null;
  approvedCapabilityIds?: UploadedDocumentExternalCapabilityId[] | null;
  policyAllowsExternalProcessing?: boolean;
  dataClassAllowsExternalProcessing?: boolean;
  imageInputs?: UploadedDocumentExternalImageInput[] | null;
}): UploadedDocumentExternalProviderStatus[] {
  const env = params.env ?? {};
  const imageInputs = params.imageInputs ?? [];
  const approvedProviderIds = new Set(params.approvedProviderIds ?? []);
  const approvedCapabilityIds = new Set(params.approvedCapabilityIds ?? []);
  return APPROVED_UPLOADED_DOCUMENT_EXTERNAL_PRODUCER_MANIFESTS.map((entry) => {
    const config = configuredEnv(env, entry);
    const taskRelevant = capabilityMatches(entry, params.policy);
    const approvalGrantedForEntry =
      params.approvalGranted ||
      approvedProviderIds.has(entry.providerId) ||
      approvedCapabilityIds.has(entry.capabilityId);
    const localSufficient =
      !taskRelevant && params.policy.localSufficientCapabilities.includes(entry.capabilityId);
    let availabilityState: UploadedDocumentExternalAvailabilityState = "catalog_only";
    if (localSufficient) {
      availabilityState = "skipped_local_sufficient";
    } else if (taskRelevant && params.policyAllowsExternalProcessing === false) {
      availabilityState = "policy_blocked";
    } else if (taskRelevant && params.dataClassAllowsExternalProcessing === false) {
      availabilityState = "policy_blocked";
    } else if (taskRelevant && entry.approvalRequired && !approvalGrantedForEntry) {
      availabilityState = "approval_required";
    } else if (taskRelevant && entry.requiresImageInput && imageInputs.length === 0) {
      availabilityState = "missing_image_input";
    } else if (taskRelevant && !config.configured) {
      availabilityState = "config_required";
    } else if (taskRelevant && entry.realExecutionPath) {
      availabilityState = "runtime_callable_when_configured";
    } else if (taskRelevant && entry.mockTestedCallableOnly) {
      availabilityState = "mock_tested_callable_only";
    } else if (taskRelevant && entry.deferredBecauseSafeAdapterMissing) {
      availabilityState = "deferred_adapter_missing";
    } else if (taskRelevant) {
      availabilityState = "unavailable";
    }

    return {
      providerId: entry.providerId,
      providerName: entry.providerName,
      producerId: entry.producerId,
      capabilityId: entry.capabilityId,
      taskRelevant,
      localSufficient,
      availabilityState,
      runtimeCallableWhenConfigured: entry.runtimeCallableWhenConfigured,
      mockTestedCallable: entry.mockTestedCallableOnly,
      configRequired: taskRelevant && !config.configured,
      unconfigured: taskRelevant && !config.configured,
      approvalRequired: taskRelevant && entry.approvalRequired && !approvalGrantedForEntry,
      policyBlocked: availabilityState === "policy_blocked",
      blockedByMissingImageInput: availabilityState === "missing_image_input",
      deferredBecauseSafeAdapterMissing: taskRelevant && entry.deferredBecauseSafeAdapterMissing,
      externalDataEgress: entry.externalDataEgress,
      requiredConfigEnvKeys: entry.requiredConfigEnvKeys,
      missingConfigEnvKeys: config.missing,
      requiredInputState: entry.requiresImageInput
        ? imageInputs.length > 0 ? "available" : "missing_image_input"
        : "not_required",
      reason: statusReason({ manifest: entry, state: availabilityState, missingConfig: config.missing }),
      noExternalCallMade: true,
      noExecutionClaimed: true,
    } satisfies UploadedDocumentExternalProviderStatus;
  });
}

function resultStateFromAvailability(state: UploadedDocumentExternalAvailabilityState): SourceObservationProducerResultState {
  if (state === "approval_required") return "approval_required";
  if (state === "policy_blocked") return "blocked_by_policy";
  if (state === "catalog_only") return "catalog_only";
  if (state === "deferred_adapter_missing" || state === "mock_tested_callable_only") return "deferred";
  if (state === "failed") return "failed";
  if (state === "skipped_local_sufficient") return "skipped";
  return "unavailable";
}

function availabilitySignalStatus(
  state: UploadedDocumentExternalAvailabilityState
): SourceObservationProducerAvailabilitySignal["status"] {
  if (state === "approval_required") return "approval_required";
  if (state === "policy_blocked") return "blocked_by_policy";
  if (state === "catalog_only") return "catalog_only";
  if (state === "deferred_adapter_missing" || state === "mock_tested_callable_only") return "deferred";
  if (state === "config_required" || state === "unconfigured" || state === "missing_image_input") return "missing";
  if (state === "runtime_callable_when_configured" || state === "completed_with_evidence") return "available";
  return "unavailable";
}

function primaryAvailabilitySource(state: UploadedDocumentExternalAvailabilityState): SourceObservationProducerAvailabilitySource {
  if (state === "approval_required") return "approval";
  if (state === "policy_blocked") return "policy";
  if (state === "config_required" || state === "unconfigured" || state === "runtime_callable_when_configured") return "runtime";
  if (state === "missing_image_input") return "source_evidence";
  return "producer_manifest";
}

function buildProducerRequest(params: {
  manifest: UploadedDocumentExternalProviderManifest;
  document: UploadedDocumentExternalDocumentRef;
  stateReason: string;
  traceId?: string | null;
  planId?: string | null;
  conversationId?: string | null;
  messageId?: string | null;
  locator?: SourceObservationLocator | null;
}): SourceObservationProducerRequest {
  return {
    id: [
      "uploaded-document-external-producer",
      params.manifest.producerId,
      params.document.id,
      shortHash(`${params.traceId ?? ""}:${params.planId ?? ""}:${params.stateReason}`),
    ].join(":"),
    traceId: params.traceId ?? null,
    planId: params.planId ?? null,
    conversationId: params.conversationId ?? params.document.conversationId ?? null,
    messageId: params.messageId ?? null,
    conversationDocumentId: params.document.id,
    sourceId: params.document.id,
    sourceKind: "uploaded_document",
    sourceLocator: normalizeSourceObservationLocator(params.locator),
    requestedObservationType: params.manifest.expectedOutputObservationTypes[0] ?? "tool_observation",
    requestedCapabilityId: params.manifest.capabilityId,
    requestedPayloadType: params.manifest.requiredPayloadType,
    reason: params.stateReason,
    priority: "high",
    severity: "medium",
    approvalPath: params.manifest.approvalRequired ? "uploaded_document_external_escalation" : null,
    producerId: params.manifest.producerId,
    input: {
      payloadType: params.manifest.requiredPayloadType,
      sourceKind: "uploaded_document",
      locator: normalizeSourceObservationLocator(params.locator),
      metadata: {
        providerId: params.manifest.providerId,
        externalDataEgress: params.manifest.externalDataEgress,
      },
    },
    noExecutionClaimed: true,
  };
}

function sourceKindFor(contextKind: string, observationType: SourceObservationType): SourceObservationSourceKind {
  if (contextKind === "pdf") return "pdf_page";
  if (contextKind === "spreadsheet") return "spreadsheet_source_metadata";
  if (observationType === "model_vision_result" || observationType === "figure_interpretation" || observationType === "chart_interpretation") {
    return "uploaded_document";
  }
  return "parsed_document";
}

function buildExternalObservation(params: {
  manifest: UploadedDocumentExternalProviderManifest;
  document: UploadedDocumentExternalDocumentRef;
  contextKind: string;
  observation: UploadedDocumentExternalMockObservation;
  providerRequestId?: string | null;
  modelOrVersion?: string | null;
  confidence?: number | null;
  limitations?: string[];
  traceId?: string | null;
  planId?: string | null;
  conversationId?: string | null;
  messageId?: string | null;
  nowIso?: string | null;
  mockExecution?: boolean;
  maxOutputChars: number;
}): SourceObservation {
  const locator = normalizeSourceObservationLocator(params.observation.locator);
  const content = capText(params.observation.content, params.maxOutputChars);
  const observationId = [
    "external-observation",
    params.manifest.providerId,
    params.document.id,
    params.observation.type,
    shortHash(`${content}:${JSON.stringify(locator)}`),
  ].join(":");

  return {
    id: observationId,
    type: params.observation.type,
    traceId: params.traceId ?? null,
    planId: params.planId ?? null,
    conversationId: params.conversationId ?? params.document.conversationId ?? null,
    messageId: params.messageId ?? null,
    conversationDocumentId: params.document.id,
    sourceId: params.document.id,
    sourceDocumentId: params.document.id,
    sourceKind: sourceKindFor(params.contextKind, params.observation.type),
    sourceVersion: null,
    sourceLocator: locator,
    content,
    payloadKind: params.observation.payloadKind ?? "text",
    payload: params.observation.payload ?? null,
    producer: {
      producerId: params.manifest.producerId,
      producerKind: params.manifest.producerKind,
      capabilityId: params.manifest.capabilityId,
      executionState: "executed",
      executionEvidence: {
        producerResultState: "completed_with_evidence",
        providerId: params.manifest.providerId,
        providerName: params.manifest.providerName,
        providerRequestId: params.providerRequestId ?? null,
        modelOrVersion: params.modelOrVersion ?? null,
        externalDataEgress: params.manifest.externalDataEgress,
        mockExecution: params.mockExecution ?? false,
        rawProviderOutputOmitted: true,
        noSecretsLogged: true,
      },
      noUnavailableToolExecutionClaimed: true,
    },
    extractionMethod: params.mockExecution
      ? `${params.manifest.providerId}:mock_adapter`
      : `${params.manifest.providerId}:external_adapter`,
    confidence: params.observation.confidence ?? params.confidence ?? null,
    limitations: unique([...(params.observation.limitations ?? []), ...(params.limitations ?? [])]),
    promotionHints: {
      eligible: true,
      bucketHints:
        params.manifest.capabilityId === "vision_page_understanding"
          ? ["visual_figure_observation"]
          : params.manifest.capabilityId === "document_ai_table_recovery"
            ? ["table_structured_data"]
            : [],
      reason: "Completed external uploaded-document SourceObservation is eligible for existing artifact-promotion policy.",
    },
    relatedGapHints: [],
    createdAt: params.nowIso ?? null,
  };
}

function buildProducerResult(params: {
  manifest: UploadedDocumentExternalProviderManifest;
  status: UploadedDocumentExternalProviderStatus;
  request: SourceObservationProducerRequest;
  observations: SourceObservation[];
  providerRequestId?: string | null;
  modelOrVersion?: string | null;
  failureReason?: string | null;
  evidenceSummary?: string | null;
}): SourceObservationProducerResult {
  const completed = params.observations.length > 0;
  const state: SourceObservationProducerResultState = completed
    ? "completed_with_evidence"
    : resultStateFromAvailability(params.status.availabilityState);
  const sourceIds = unique(params.observations.map((observation) =>
    observation.sourceId ?? observation.sourceDocumentId ?? observation.conversationDocumentId ?? params.request.sourceId ?? null
  ).filter((value): value is string => Boolean(value)));
  const signal = {
    id: `external-availability:${params.manifest.providerId}:${params.request.sourceId ?? "unknown"}`,
    source: primaryAvailabilitySource(params.status.availabilityState),
    status: completed ? "available" : availabilitySignalStatus(params.status.availabilityState),
    producerId: params.manifest.producerId,
    capabilityId: params.manifest.capabilityId,
    providerId: params.manifest.providerId,
    payloadType: params.manifest.requiredPayloadType,
    observationTypes: params.manifest.expectedOutputObservationTypes,
    sourceId: params.request.sourceId ?? null,
    conversationDocumentId: params.request.conversationDocumentId ?? null,
    runtimeExecutable: completed || params.status.availabilityState === "runtime_callable_when_configured",
    modelSupported: params.manifest.producerKind === "model",
    evidenceAvailable: completed,
    reason: params.failureReason ?? params.status.reason,
    evidenceSummary: completed
      ? params.evidenceSummary ?? `${params.manifest.providerName} produced ${params.observations.length} completed SourceObservation(s).`
      : null,
    missingRequirements: completed ? [] : [
      ...params.status.missingConfigEnvKeys.map((key) => `env:${key}`),
      params.status.blockedByMissingImageInput ? "input:rendered_or_uploaded_image" : null,
    ].filter((value): value is string => Boolean(value)),
    approvalPath: params.manifest.approvalRequired ? "uploaded_document_external_escalation" : null,
    asyncRecommended: params.manifest.latencyClass === "async_preferred",
    noExecutionClaimed: true,
  } satisfies SourceObservationProducerAvailabilitySignal;

  return {
    requestId: params.request.id,
    request: params.request,
    producerId: params.manifest.producerId,
    capabilityId: params.manifest.capabilityId,
    state,
    resolution: {
      state,
      producerId: params.manifest.producerId,
      capabilityId: params.manifest.capabilityId,
      payloadType: params.manifest.requiredPayloadType,
      governedBy: [
        "uploaded-document-external-producer-catalogue",
        "source-observation-producer-result",
        "agent-control-policy",
      ],
      availabilitySources: [signal.source],
      primaryAvailabilitySource: signal.source,
      availabilityDetails: [signal],
      catalogPayloadType: params.manifest.requiredPayloadType,
      catalogLaneId: params.manifest.requiredPayloadType,
      brokerCapabilityId: params.manifest.capabilityId,
      executableNow: completed,
      reason: params.failureReason ?? params.status.reason,
      evidenceSummary: completed
        ? params.evidenceSummary ?? `${params.manifest.providerName} completed with execution evidence.`
        : null,
      missingRequirements: signal.missingRequirements ?? [],
      approvalPath: params.manifest.approvalRequired ? "uploaded_document_external_escalation" : null,
      sourceLocator: params.request.sourceLocator ?? null,
      traceId: params.request.traceId ?? null,
      planId: params.request.planId ?? null,
      requiresApproval: !completed && params.status.availabilityState === "approval_required",
      blockedByPolicy: !completed && params.status.availabilityState === "policy_blocked",
      asyncRecommended: params.manifest.latencyClass === "async_preferred",
      asyncSuitability: {
        recommended: params.manifest.latencyClass === "async_preferred",
        reason: params.manifest.latencyClass === "async_preferred" ? "Provider may exceed synchronous budget." : null,
      },
      noExecutionClaimed: true,
    },
    observations: completed ? params.observations : [],
    observationIds: completed ? params.observations.map((observation) => observation.id) : [],
    output: completed
      ? {
          observationIds: params.observations.map((observation) => observation.id),
          payloadKinds: unique(params.observations.map((observation) => observation.payloadKind)),
          evidenceSummary:
            params.evidenceSummary ?? `${params.manifest.providerName} normalized output through SourceObservations.`,
          metadata: {
            providerId: params.manifest.providerId,
            producerId: params.manifest.producerId,
            providerRequestId: params.providerRequestId ?? null,
            modelOrVersion: params.modelOrVersion ?? null,
            rawProviderOutputOmitted: true,
          },
        }
      : null,
    unresolvedNeeds: completed || state === "skipped"
      ? []
      : [
          {
            id: `external-producer-need:${params.request.id}`,
            observationType: params.request.requestedObservationType,
            sourceId: params.request.sourceId ?? null,
            conversationDocumentId: params.request.conversationDocumentId ?? null,
            capability: params.manifest.capabilityId,
            payloadType: params.manifest.requiredPayloadType,
            state: state === "approval_required" ? "approval_required" : state === "deferred" ? "deferred" : "unavailable",
            reason: params.failureReason ?? params.status.reason,
            noExecutionClaimed: true,
          },
        ],
    evidence: completed
      ? {
          summary: params.evidenceSummary ?? `${params.manifest.providerName} completed with execution evidence.`,
          observationIds: params.observations.map((observation) => observation.id),
          sourceIds,
          locator: params.observations[0]?.sourceLocator ?? params.request.sourceLocator ?? null,
          noUnavailableToolExecutionClaimed: true,
        }
      : null,
    reason: params.failureReason ?? params.status.reason,
    recommendedResolution: completed
      ? null
      : params.status.blockedByMissingImageInput
        ? "Provide a governed rendered-page/image/crop input before model vision can run."
        : params.manifest.providerId === "e2b_sandbox" || params.manifest.providerId === "daytona_sandbox"
          ? "Defer robust sandbox execution to WP4C."
          : "Route this unresolved external producer result through existing durable gap/debt emission.",
    requiresApproval: !completed && params.status.availabilityState === "approval_required",
    asyncRecommended: params.manifest.latencyClass === "async_preferred",
    noExecutionClaimed: true,
  };
}

function selectedProviderIdsFor(policy: UploadedDocumentExternalEscalationPolicyResult) {
  const selected: UploadedDocumentExternalProviderId[] = [];
  if (policy.neededCapabilities.includes("ocr")) selected.push("mistral_ocr");
  if (policy.neededCapabilities.includes("document_ai_table_recovery")) selected.push("llamaparse_agentic_parse");
  if (policy.neededCapabilities.includes("vision_page_understanding")) selected.push("openai_vision");
  if (policy.neededCapabilities.includes("external_sandbox_execution")) selected.push("e2b_sandbox");
  return selected;
}

function mockResultFor(
  manifest: UploadedDocumentExternalProviderManifest,
  params: RunUploadedDocumentExternalEscalationProducersParams
) {
  const direct = params.mockResultsByProviderId?.[manifest.providerId];
  if (direct) return direct;
  const adapter = params.adapters?.[manifest.providerId];
  if (!adapter) return null;
  return adapter({
    manifest,
    document: params.document,
    contextKind: params.contextKind,
    taskPrompt: params.taskPrompt ?? null,
    imageInputs: params.imageInputs ?? [],
    selectedPages: params.selectedPages ?? [],
    traceId: params.traceId ?? null,
    planId: params.planId ?? null,
  });
}

function imageToDataUrl(input: UploadedDocumentExternalImageInput) {
  if (input.dataUrl?.startsWith("data:")) return input.dataUrl;
  if (!input.dataBase64) return null;
  return `data:${input.mimeType};base64,${input.dataBase64}`;
}

async function executeOpenAiVision(params: {
  manifest: UploadedDocumentExternalProviderManifest;
  document: UploadedDocumentExternalDocumentRef;
  contextKind: string;
  taskPrompt: string | null | undefined;
  imageInputs: UploadedDocumentExternalImageInput[];
  env: EnvLike;
  fetchImpl: typeof fetch;
  traceId?: string | null;
  planId?: string | null;
  conversationId?: string | null;
  messageId?: string | null;
  nowIso?: string | null;
  maxOutputChars: number;
}): Promise<UploadedDocumentExternalMockResult> {
  const apiKey = params.env.OPENAI_API_KEY?.trim();
  const model = params.env.OPENAI_VISION_MODEL?.trim();
  if (!apiKey || !model) {
    return {
      status: "failed",
      failureReason: "OpenAI vision config was missing at execution time.",
    };
  }
  const dataUrls = params.imageInputs
    .slice(0, DEFAULT_MAX_IMAGE_INPUTS)
    .map(imageToDataUrl)
    .filter((value): value is string => Boolean(value));
  if (dataUrls.length === 0) {
    return {
      status: "failed",
      failureReason: "OpenAI vision requires real data URL image input.",
    };
  }

  const userText =
    params.taskPrompt?.trim() ||
    "Inspect this uploaded document image/page. Return a concise, source-grounded description of visible figures, charts, tables, and limitations.";
  const response = await params.fetchImpl(OPENAI_CHAT_COMPLETIONS_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model,
      messages: [
        {
          role: "user",
          content: [
            {
              type: "text",
              text:
                `${userText}\n\nReturn only trace-safe findings. Do not infer hidden text or claim OCR/table extraction unless visible evidence supports it.`,
            },
            ...dataUrls.map((url) => ({
              type: "image_url",
              image_url: { url, detail: "high" },
            })),
          ],
        },
      ],
      max_tokens: 700,
    }),
  });
  if (!response.ok) {
    return {
      status: "failed",
      failureReason: `OpenAI vision request failed with status ${response.status}.`,
    };
  }
  const data = await response.json() as {
    id?: string;
    model?: string;
    choices?: Array<{ message?: { content?: string | Array<{ text?: string }> } }>;
  };
  const contentValue = data.choices?.[0]?.message?.content;
  const content = Array.isArray(contentValue)
    ? contentValue.map((part) => part.text).filter(Boolean).join("\n")
    : contentValue;
  if (!content?.trim()) {
    return {
      status: "failed",
      failureReason: "OpenAI vision response did not contain usable text content.",
    };
  }
  return {
    status: "completed",
    providerRequestId: data.id ?? null,
    modelOrVersion: data.model ?? model,
    evidenceSummary: "OpenAI vision returned a concise semantic visual observation; raw response body was omitted from trace.",
    observations: [
      {
        type: "model_vision_result",
        content: capText(content, params.maxOutputChars),
        payloadKind: "structured",
        payload: {
          providerId: params.manifest.providerId,
          imageInputCount: dataUrls.length,
          rawProviderOutputOmitted: true,
        },
        locator: params.imageInputs[0]?.sourceLocator ?? {
          sourceLocationLabel: params.imageInputs[0]?.sourceLocationLabel ?? params.document.filename,
          pageNumberStart: params.imageInputs[0]?.pageNumber ?? null,
          pageNumberEnd: params.imageInputs[0]?.pageNumber ?? null,
        },
        confidence: 0.74,
        limitations: [
          "Semantic vision observation only; not OCR, document-AI, or table-structure extraction.",
          "Input image count was capped before the provider call.",
        ],
      },
    ],
  };
}

async function executeSelectedProvider(params: {
  manifest: UploadedDocumentExternalProviderManifest;
  status: UploadedDocumentExternalProviderStatus;
  runParams: RunUploadedDocumentExternalEscalationProducersParams;
  maxOutputChars: number;
}) {
  if (params.runParams.allowMockExecution) {
    const mock = await mockResultFor(params.manifest, params.runParams);
    if (mock) return { result: mock, mockExecution: true };
  }

  if (params.manifest.providerId === "openai_vision" &&
    params.status.availabilityState === "runtime_callable_when_configured") {
    const fetchImpl = params.runParams.fetchImpl ?? globalThis.fetch;
    if (!fetchImpl) {
      return {
        result: {
          status: "failed",
          failureReason: "Fetch runtime is unavailable for OpenAI vision execution.",
        } satisfies UploadedDocumentExternalMockResult,
        mockExecution: false,
      };
    }
    return {
      result: await executeOpenAiVision({
        manifest: params.manifest,
        document: params.runParams.document,
        contextKind: params.runParams.contextKind,
        taskPrompt: params.runParams.taskPrompt,
        imageInputs: (params.runParams.imageInputs ?? []).slice(0, params.runParams.policy?.maxImageInputs ?? DEFAULT_MAX_IMAGE_INPUTS),
        env: params.runParams.env ?? {},
        fetchImpl,
        traceId: params.runParams.traceId ?? null,
        planId: params.runParams.planId ?? null,
        conversationId: params.runParams.conversationId ?? null,
        messageId: params.runParams.messageId ?? null,
        nowIso: params.runParams.nowIso ?? null,
        maxOutputChars: params.maxOutputChars,
      }),
      mockExecution: false,
    };
  }

  return {
    result: null,
    mockExecution: false,
  };
}

export async function runUploadedDocumentExternalEscalationProducers(
  params: RunUploadedDocumentExternalEscalationProducersParams
): Promise<UploadedDocumentExternalEscalationResult> {
  const policy = evaluateUploadedDocumentExternalEscalationPolicy(params);
  const maxOutputChars = Math.max(200, params.policy?.maxOutputChars ?? DEFAULT_EXTERNAL_MAX_OUTPUT_CHARS);
  const imageInputs = (params.imageInputs ?? []).slice(0, params.policy?.maxImageInputs ?? DEFAULT_MAX_IMAGE_INPUTS);
  const providerStatuses = resolveUploadedDocumentExternalProducerStatuses({
    policy,
    env: params.env ?? {},
    approvalGranted: params.policy?.approvalGranted ?? false,
    approvedProviderIds: params.policy?.approvedProviderIds ?? [],
    approvedCapabilityIds: params.policy?.approvedCapabilityIds ?? [],
    policyAllowsExternalProcessing: params.policy?.allowExternalProcessing ?? true,
    dataClassAllowsExternalProcessing: params.policy?.dataClassAllowsExternalProcessing ?? true,
    imageInputs,
  });
  const statusByProvider = new Map(providerStatuses.map((status) => [status.providerId, status]));
  const selectedProviderIds = selectedProviderIdsFor(policy);
  const selectedManifests = selectedProviderIds
    .flatMap((providerId) => APPROVED_UPLOADED_DOCUMENT_EXTERNAL_PRODUCER_MANIFESTS.find((entry) => entry.providerId === providerId) ?? []);

  const observations: SourceObservation[] = [];
  const producerRequests: SourceObservationProducerRequest[] = [];
  const producerResults: SourceObservationProducerResult[] = [];
  const noExecutionWarnings: string[] = [];
  let rawProviderOutputOmittedCount = 0;
  let attemptedCount = 0;

  for (const entry of selectedManifests) {
    const status = statusByProvider.get(entry.providerId);
    if (!status) continue;
    const request = buildProducerRequest({
      manifest: entry,
      document: params.document,
      stateReason: status.reason,
      traceId: params.traceId ?? null,
      planId: params.planId ?? null,
      conversationId: params.conversationId ?? null,
      messageId: params.messageId ?? null,
      locator: params.imageInputs?.[0]?.sourceLocator ?? null,
    });
    producerRequests.push(request);

    let finalStatus: UploadedDocumentExternalProviderStatus = status;
    let providerResult: UploadedDocumentExternalMockResult | null = null;
    let mockExecution = false;
    if (
      status.availabilityState === "runtime_callable_when_configured" ||
      (params.allowMockExecution && status.availabilityState === "mock_tested_callable_only")
    ) {
      attemptedCount += 1;
      const executed = await executeSelectedProvider({
        manifest: entry,
        status,
        runParams: params,
        maxOutputChars,
      });
      providerResult = executed.result;
      mockExecution = executed.mockExecution;
      if (!providerResult) {
        finalStatus = {
          ...status,
          availabilityState: entry.mockTestedCallableOnly ? "mock_tested_callable_only" : "deferred_adapter_missing",
          reason: entry.mockTestedCallableOnly
            ? `${entry.providerName} has only a mock adapter contract in this execution context.`
            : `${entry.providerName} has no safe adapter available in this execution context.`,
        };
      } else if (providerResult.status === "failed") {
        finalStatus = {
          ...status,
          availabilityState: "failed",
          reason: providerResult.failureReason ?? `${entry.providerName} failed without completed evidence.`,
        };
      }
    }

    const completedObservations =
      providerResult?.status === "completed"
        ? (providerResult.observations ?? []).map((observation) =>
            buildExternalObservation({
              manifest: entry,
              document: params.document,
              contextKind: params.contextKind,
              observation,
              providerRequestId: providerResult?.providerRequestId ?? null,
              modelOrVersion: providerResult?.modelOrVersion ?? null,
              confidence: observation.confidence ?? null,
              limitations: providerResult.limitations ?? [],
              traceId: params.traceId ?? null,
              planId: params.planId ?? null,
              conversationId: params.conversationId ?? null,
              messageId: params.messageId ?? null,
              nowIso: params.nowIso ?? null,
              mockExecution,
              maxOutputChars,
            })
          )
        : [];
    if (completedObservations.length > 0) {
      rawProviderOutputOmittedCount += 1;
      observations.push(...completedObservations);
      finalStatus = {
        ...finalStatus,
        availabilityState: "completed_with_evidence",
        reason: statusReason({ manifest: entry, state: "completed_with_evidence", missingConfig: [] }),
        noExternalCallMade: false,
      };
    } else if (finalStatus.availabilityState !== "catalog_only" && finalStatus.availabilityState !== "skipped_local_sufficient") {
      noExecutionWarnings.push(finalStatus.reason);
    }

    producerResults.push(buildProducerResult({
      manifest: entry,
      status: finalStatus,
      request,
      observations: completedObservations,
      providerRequestId: providerResult?.providerRequestId ?? null,
      modelOrVersion: providerResult?.modelOrVersion ?? null,
      failureReason: providerResult?.status === "failed" ? providerResult.failureReason ?? null : null,
      evidenceSummary: providerResult?.evidenceSummary ?? null,
    }));
  }

  const transportSelection = selectSourceObservationsForTransport({
    observations,
    maxObservations: params.policy?.maxExternalObservations ?? DEFAULT_EXTERNAL_MAX_OBSERVATIONS,
    maxObservationsPerDocument:
      params.policy?.maxExternalObservationsPerDocument ?? DEFAULT_EXTERNAL_MAX_OBSERVATIONS_PER_DOCUMENT,
  });
  const observationsProducedByProvider = observations.reduce<Record<string, number>>((counts, observation) => {
    const providerId = String(observation.producer.executionEvidence?.providerId ?? "unknown");
    counts[providerId] = (counts[providerId] ?? 0) + 1;
    return counts;
  }, {});
  const completedCount = producerResults.filter((result) => result.state === "completed_with_evidence").length;
  const failedCount = producerResults.filter((result) => result.state === "failed").length;
  const debugSummary: UploadedDocumentDigestionExternalDebugSummary = {
    documentId: params.document.id,
    filename: params.document.filename,
    contextKind: params.contextKind,
    localBaselineEvaluatedFirst: true,
    approvedExternalCandidateCount: APPROVED_UPLOADED_DOCUMENT_EXTERNAL_PRODUCER_MANIFESTS.length,
    providerStatuses: providerStatuses.map((status) => {
      const completedResult = producerResults.find((result) =>
        result.producerId === status.producerId && result.state === "completed_with_evidence"
      );
      return completedResult
        ? {
            ...status,
            availabilityState: "completed_with_evidence",
            reason: statusReason({
              manifest: APPROVED_UPLOADED_DOCUMENT_EXTERNAL_PRODUCER_MANIFESTS.find((entry) => entry.providerId === status.providerId) ?? APPROVED_UPLOADED_DOCUMENT_EXTERNAL_PRODUCER_MANIFESTS[0],
              state: "completed_with_evidence",
              missingConfig: [],
            }),
            noExternalCallMade: false,
          }
        : status;
    }),
    selectedProviderIds,
    localInsufficiencyReasons: policy.localInsufficiencyReasons,
    externalAttemptedCount: attemptedCount,
    externalCompletedWithEvidenceCount: completedCount,
    externalFailedCount: failedCount,
    externalSkippedCount: producerResults.filter((result) => result.state === "skipped").length,
    externalBlockedCount: producerResults.filter((result) => result.state === "blocked_by_policy").length,
    externalApprovalRequiredCount: producerResults.filter((result) => result.state === "approval_required").length,
    externalUnconfiguredCount: providerStatuses.filter((status) => status.unconfigured && status.taskRelevant).length,
    missingRequiredInputCount: producerResults.filter((result) =>
      result.resolution.availabilityDetails.some((detail) =>
        detail.missingRequirements?.includes("input:rendered_or_uploaded_image")
      )
    ).length,
    observationsProducedByProvider,
    rawProviderOutputOmittedCount,
    selectedTransportObservationCount: transportSelection.selectedObservations.length,
    cappedTransportObservationCount: transportSelection.cappedObservationCount,
    durableGapDebtCandidateCount: 0,
    noExecutionWarnings: unique(noExecutionWarnings),
    noSecretsLogged: true,
    noRawProviderOutputLogged: true,
    noToolOutputBypassesSourceObservation: true,
    noExecutionClaimWithoutCompletedWithEvidence: true,
  };

  return {
    observations,
    producerRequests,
    producerResults,
    transportSelection,
    debugSummary,
    policy,
  };
}

export function withUploadedDocumentExternalDurableGapCount(
  summary: UploadedDocumentDigestionExternalDebugSummary,
  durableGapDebtCandidateCount: number
): UploadedDocumentDigestionExternalDebugSummary {
  return {
    ...summary,
    durableGapDebtCandidateCount,
  };
}
