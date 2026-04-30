import type { ContextDocumentChunk } from "./context-document-chunks";
import type { DocumentKnowledgeArtifactRecord } from "./document-intelligence";
import type { PdfContextExtractionMetadata } from "./context-pdf";
import {
  buildSourceObservationsFromDocumentMetadata,
  buildSourceObservationsFromKnowledgeArtifacts,
  buildSourceObservationsFromPdfSignals,
  buildSourceObservationsFromSelectedDocumentChunks,
  normalizeSourceObservationLocator,
  selectSourceObservationsForTransport,
  type SourceObservation,
  type SourceObservationBuildOptions,
  type SourceObservationNeed,
  type SourceObservationPayloadKind,
  type SourceObservationTransportSelection,
  type SourceObservationType,
} from "./source-observations";
import {
  DEFAULT_SOURCE_OBSERVATION_PRODUCER_MANIFESTS,
  buildSourceObservationProducerAvailabilitySnapshot,
  runDeterministicSourceObservationProducers,
  type SourceObservationProducerAvailabilityContext,
  type SourceObservationProducerManifest,
  type SourceObservationProducerRequest,
  type SourceObservationProducerResult,
} from "./source-observation-producers";

export type UploadedDocumentLocalContextKind =
  | "text"
  | "pdf"
  | "docx"
  | "pptx"
  | "spreadsheet"
  | "image"
  | string;

export type UploadedDocumentLocalAvailabilityState =
  | "available_executable"
  | "newly_enabled_dependency"
  | "available_but_not_needed"
  | "cataloged_not_installed"
  | "unavailable_missing_dependency"
  | "unavailable_no_safe_sandbox"
  | "unavailable_no_safe_wrapper"
  | "unavailable_requires_worker_runtime"
  | "unavailable_runtime_install_forbidden"
  | "unavailable_not_supported"
  | "blocked_by_policy"
  | "deferred"
  | "failed";

export type UploadedDocumentExternalAvailabilityState =
  | "configured"
  | "unconfigured"
  | "approval_required"
  | "policy_blocked"
  | "catalog_only"
  | "unavailable"
  | "deferred_to_wp4a2";

export type UploadedDocumentLocalCandidateSummary = {
  toolId: string;
  producerId: string;
  capabilityId: string;
  payloadTypes: string[];
  dependencyNames: string[];
  availabilityState: UploadedDocumentLocalAvailabilityState;
  resultState:
    | "completed_with_evidence"
    | "skipped"
    | "unavailable"
    | "missing"
    | "catalog_only"
    | "approval_required"
    | "blocked_by_policy"
    | "deferred"
    | "failed";
  reason: string;
  deferredPackage?: "WP4A2" | "WP4C" | "WP6" | "WP7" | null;
  newlyEnabledInWp4A3?: boolean;
  noExecutionClaimed: true;
};

export type UploadedDocumentExternalCandidateSummary = {
  toolId: string;
  producerId: string;
  capabilityId: string;
  availabilityState: UploadedDocumentExternalAvailabilityState;
  configured: boolean;
  reason: string;
  deferredPackage: "WP4A2";
  noExternalCallMade: true;
  noExecutionClaimed: true;
};

export type UploadedDocumentLocalDependencyInventory = {
  inspected: true;
  packageDependenciesInspected: true;
  dependencyVersions: Record<string, string | null>;
  availableDependencies: string[];
  missingDependencies: string[];
  safeSandboxAvailable: boolean;
  localBinaryExecutionAllowed: false;
  packageInstallOrDeploymentAttempted: false;
  optionalLocalTools: UploadedDocumentLocalCandidateSummary[];
  externalCandidates: UploadedDocumentExternalCandidateSummary[];
  noSecretsIncluded: true;
  noExecutionClaimed: true;
};

export type UploadedDocumentDigestionLocalExecutedProducerSummary = {
  producerId: string;
  capabilityId: string;
  observationCount: number;
  evidenceObservationIds: string[];
};

export type UploadedDocumentDigestionLocalDebugSummary = {
  traceId: string | null;
  planId: string | null;
  conversationDocumentId: string | null;
  sourceId: string | null;
  filename: string | null;
  contextKind: UploadedDocumentLocalContextKind;
  dependencyInventory: UploadedDocumentLocalDependencyInventory;
  inventoryInspectedBeforeProducerSelection: true;
  executionBackedLocalProducerLimit: number;
  executedLocalProducerCount: number;
  executedLocalProducers: UploadedDocumentDigestionLocalExecutedProducerSummary[];
  localToolEnablement: {
    renderedPageImageInputStatus:
      | "not_needed"
      | "completed_with_evidence"
      | "missing_input"
      | "unavailable"
      | "failed";
    renderedPageImageInputCount: number;
    ocrStatus:
      | "not_needed"
      | "completed_with_evidence"
      | "unavailable_requires_worker_runtime"
      | "unavailable_runtime_install_forbidden"
      | "failed";
    officeStructureStatus: "not_needed" | "completed_with_evidence" | "failed";
    spreadsheetStructureStatus: "not_needed" | "completed_with_evidence" | "failed";
    tableExtractionStatus: "not_needed" | "completed_with_evidence" | "unresolved_need";
    newlyEnabledDependencies: string[];
    noRuntimeInstallAttempted: true;
    noRawImageBytesInObservations: true;
    noSemanticVisionClaimedByRendering: true;
  };
  availableButNotNeededLocalProducers: UploadedDocumentLocalCandidateSummary[];
  unavailableCatalogOnlyLocalProducers: UploadedDocumentLocalCandidateSummary[];
  externalCandidateProducers: UploadedDocumentExternalCandidateSummary[];
  skippedDeferredProducers: UploadedDocumentLocalCandidateSummary[];
  producerStatesByToolCapability: Record<string, string>;
  completedObservationCount: number;
  completedObservationCountsByType: Record<string, number>;
  missingObservationNeeds: SourceObservationNeed[];
  durableGapDebtCandidateCount: number;
  selectedTransportObservationCount: number;
  cappedTransportObservationCount: number;
  noExecutionWarnings: string[];
  noExternalCallsMade: true;
  noPackageInstallOrDeploymentAttempted: true;
  noConnectorReadsOrBrowserSnapshots: true;
  noToolOutputBypassesSourceObservation: true;
  noExecutionClaimWithoutCompletedWithEvidence: true;
};

export type UploadedDocumentDigestionLocalResult = {
  observations: SourceObservation[];
  transportSelection: SourceObservationTransportSelection;
  producerRequests: SourceObservationProducerRequest[];
  producerAvailability: SourceObservationProducerAvailabilityContext;
  producerResults: SourceObservationProducerResult[];
  debugSummary: UploadedDocumentDigestionLocalDebugSummary;
};

type SourceObservationDocumentRef = {
  id: string;
  conversationId?: string | null;
  filename?: string | null;
  mimeType?: string | null;
  fileType?: string | null;
};

type LocalCandidateDefinition = {
  toolId: string;
  producerId: string;
  capabilityId: string;
  payloadTypes: string[];
  dependencyNames: string[];
  relevantContextKinds: UploadedDocumentLocalContextKind[];
  implemented: boolean;
  requiresSafeSandbox?: boolean;
  requiresOptionalBinary?: boolean;
  requiresWorkerRuntime?: boolean;
  requiresPinnedRuntimeAssets?: boolean;
  newlyEnabledInWp4A3?: boolean;
  deferredPackage?: "WP4A2" | "WP4C" | "WP6" | "WP7" | null;
  reasonUnavailable: string;
};

const DEFAULT_DEPENDENCY_VERSIONS: Record<string, string | null> = {
  "pdf-parse": "^2.4.5",
  mammoth: "^1.12.0",
  officeparser: "^6.1.0",
  xlsx: "^0.18.5",
  "pdfjs-dist": null,
  "tesseract.js": null,
};

const LOCAL_CANDIDATE_DEFINITIONS: LocalCandidateDefinition[] = [
  {
    toolId: "parser_text_extraction",
    producerId: "parser_text_extraction",
    capabilityId: "text_extraction",
    payloadTypes: ["text_excerpt", "source_observation"],
    dependencyNames: [],
    relevantContextKinds: ["text", "pdf", "docx", "pptx", "spreadsheet"],
    implemented: true,
    reasonUnavailable: "Existing uploaded-document parser chunks are the local baseline text evidence.",
  },
  {
    toolId: "pdf-parse",
    producerId: "pdf_context_extraction",
    capabilityId: "pdf_text_extraction",
    payloadTypes: ["source_observation"],
    dependencyNames: ["pdf-parse"],
    relevantContextKinds: ["pdf"],
    implemented: true,
    reasonUnavailable: "PDF parser metadata is only available when pdf-parse succeeds for an uploaded PDF.",
  },
  {
    toolId: "pdf-parse-page-renderer",
    producerId: "rendered_page_renderer",
    capabilityId: "rendered_page_inspection",
    payloadTypes: ["rendered_page_image", "image_reference", "source_observation"],
    dependencyNames: ["pdf-parse"],
    relevantContextKinds: ["pdf"],
    implemented: true,
    newlyEnabledInWp4A3: true,
    reasonUnavailable:
      "PDF page rendering is available only when WP4A3 rendered-page evidence exists for selected uploaded PDF pages.",
  },
  {
    toolId: "xlsx",
    producerId: "spreadsheet_range_reader",
    capabilityId: "spreadsheet_inventory",
    payloadTypes: [
      "source_observation",
      "spreadsheet_range",
      "workbook_metadata",
      "sheet_inventory",
      "spreadsheet_formula_map",
      "table_extraction",
    ],
    dependencyNames: ["xlsx"],
    relevantContextKinds: ["spreadsheet"],
    implemented: true,
    newlyEnabledInWp4A3: true,
    reasonUnavailable:
      "Spreadsheet inventory uses existing xlsx representative rows only; computation and formulas remain deferred.",
  },
  {
    toolId: "office-structure-parser",
    producerId: "office_document_structure_extractor",
    capabilityId: "document_structure_extraction",
    payloadTypes: ["document_outline", "deck_outline", "slide_summary", "source_observation"],
    dependencyNames: ["mammoth", "officeparser"],
    relevantContextKinds: ["docx", "pptx"],
    implemented: true,
    newlyEnabledInWp4A3: true,
    reasonUnavailable:
      "Office structure extraction is available only when WP4A3 selected DOCX/PPTX parser chunks produce bounded structural observations.",
  },
  {
    toolId: "mammoth",
    producerId: "parser_text_extraction",
    capabilityId: "text_extraction",
    payloadTypes: ["text_excerpt"],
    dependencyNames: ["mammoth"],
    relevantContextKinds: ["docx"],
    implemented: false,
    reasonUnavailable: "Mammoth is dependency-backed through the existing text parser path, not a separate WP4A1 producer.",
  },
  {
    toolId: "officeparser",
    producerId: "parser_text_extraction",
    capabilityId: "text_extraction",
    payloadTypes: ["text_excerpt"],
    dependencyNames: ["officeparser"],
    relevantContextKinds: ["pptx"],
    implemented: false,
    reasonUnavailable: "Officeparser is dependency-backed through the existing PPTX parser path with OCR disabled.",
  },
  {
    toolId: "markitdown",
    producerId: "markitdown_converter",
    capabilityId: "document_conversion",
    payloadTypes: ["text_excerpt"],
    dependencyNames: ["markitdown"],
    relevantContextKinds: ["pdf", "docx", "pptx", "spreadsheet"],
    implemented: false,
    requiresOptionalBinary: true,
    requiresWorkerRuntime: true,
    deferredPackage: "WP4C",
    reasonUnavailable: "MarkItDown conversion remains deferred to the WP4C worker runtime.",
  },
  {
    toolId: "pandoc",
    producerId: "pandoc_converter",
    capabilityId: "document_conversion",
    payloadTypes: ["text_excerpt"],
    dependencyNames: ["pandoc"],
    relevantContextKinds: ["docx", "pptx"],
    implemented: false,
    requiresOptionalBinary: true,
    requiresWorkerRuntime: true,
    deferredPackage: "WP4C",
    reasonUnavailable: "Pandoc conversion remains deferred to the WP4C worker runtime; no app-level binary wrapper is allowed.",
  },
  {
    toolId: "tesseract",
    producerId: "ocr_extractor",
    capabilityId: "ocr",
    payloadTypes: ["ocr_text"],
    dependencyNames: ["tesseract"],
    relevantContextKinds: ["pdf", "image"],
    implemented: false,
    requiresOptionalBinary: true,
    requiresWorkerRuntime: true,
    deferredPackage: "WP4C",
    reasonUnavailable: "System Tesseract/OCRmyPDF/PaddleOCR-style OCR remains deferred to the WP4C worker runtime.",
  },
  {
    toolId: "tesseract.js",
    producerId: "ocr_extractor",
    capabilityId: "ocr",
    payloadTypes: ["ocr_text"],
    dependencyNames: ["tesseract.js"],
    relevantContextKinds: ["pdf", "image"],
    implemented: false,
    requiresPinnedRuntimeAssets: true,
    deferredPackage: "WP4C",
    reasonUnavailable:
      "tesseract.js is not enabled as a local OCR producer because traineddata assets are not pinned as app-level assets and runtime downloads are forbidden.",
  },
  {
    toolId: "python-dataframe-sandbox",
    producerId: "python_analysis_sandbox",
    capabilityId: "spreadsheet_computation",
    payloadTypes: ["python_analysis_result_future"],
    dependencyNames: ["python", "duckdb", "pandas", "polars"],
    relevantContextKinds: ["spreadsheet"],
    implemented: false,
    requiresSafeSandbox: true,
    deferredPackage: "WP4C",
    reasonUnavailable: "Python/DuckDB/pandas/polars analysis requires a safe sandbox and remains WP4C.",
  },
  {
    toolId: "libreoffice",
    producerId: "libreoffice_headless_converter",
    capabilityId: "document_conversion",
    payloadTypes: ["text_excerpt"],
    dependencyNames: ["libreoffice"],
    relevantContextKinds: ["docx", "pptx", "spreadsheet"],
    implemented: false,
    requiresOptionalBinary: true,
    requiresWorkerRuntime: true,
    deferredPackage: "WP4C",
    reasonUnavailable: "LibreOffice headless conversion and recalculation remain deferred to the WP4C worker runtime.",
  },
  {
    toolId: "poppler-or-pymupdf",
    producerId: "rendered_page_renderer",
    capabilityId: "rendered_page_inspection",
    payloadTypes: ["rendered_page_image"],
    dependencyNames: ["poppler", "pymupdf"],
    relevantContextKinds: ["pdf"],
    implemented: false,
    requiresWorkerRuntime: true,
    deferredPackage: "WP4C",
    reasonUnavailable: "Poppler/PyMuPDF rendering belongs in WP4C worker runtime, not WP4A3 app-level execution.",
  },
  {
    toolId: "pdfplumber-or-docling",
    producerId: "document_ai_table_extractor",
    capabilityId: "document_ai_table_recovery",
    payloadTypes: ["structured_table", "table_extraction"],
    dependencyNames: ["pdfplumber", "docling"],
    relevantContextKinds: ["pdf"],
    implemented: false,
    requiresWorkerRuntime: true,
    deferredPackage: "WP4C",
    reasonUnavailable: "pdfplumber/Docling table recovery remains deferred to WP4C worker runtime.",
  },
];

const EXTERNAL_CANDIDATES = [
  {
    toolId: "llamaparse",
    producerId: "llamaparse_document_ai",
    capabilityId: "document_ai_table_recovery",
    envNames: ["LLAMA_CLOUD_API_KEY", "LLAMAPARSE_API_KEY"],
  },
  {
    toolId: "mistral_ocr",
    producerId: "mistral_ocr_extractor",
    capabilityId: "ocr",
    envNames: ["MISTRAL_API_KEY"],
  },
  {
    toolId: "google_document_ai",
    producerId: "google_document_ai_extractor",
    capabilityId: "document_ai_table_recovery",
    envNames: ["GOOGLE_APPLICATION_CREDENTIALS", "GOOGLE_DOCUMENT_AI_PROCESSOR_ID"],
  },
  {
    toolId: "azure_document_intelligence",
    producerId: "azure_document_intelligence_extractor",
    capabilityId: "document_ai_table_recovery",
    envNames: ["AZURE_DOCUMENT_INTELLIGENCE_ENDPOINT", "AZURE_DOCUMENT_INTELLIGENCE_KEY"],
  },
  {
    toolId: "aws_textract",
    producerId: "aws_textract_extractor",
    capabilityId: "document_ai_table_recovery",
    envNames: ["AWS_ACCESS_KEY_ID", "AWS_SECRET_ACCESS_KEY", "AWS_REGION"],
  },
  {
    toolId: "adobe_pdf_extract",
    producerId: "adobe_pdf_extract_extractor",
    capabilityId: "document_ai_table_recovery",
    envNames: ["ADOBE_PDF_SERVICES_CLIENT_ID", "ADOBE_PDF_SERVICES_CLIENT_SECRET"],
  },
  {
    toolId: "model_vision_inspector",
    producerId: "model_vision_inspector",
    capabilityId: "vision_page_understanding",
    envNames: ["OPENAI_API_KEY", "ANTHROPIC_API_KEY", "GOOGLE_GENERATIVE_AI_API_KEY"],
  },
] as const;

export const UPLOADED_DOCUMENT_LOCAL_PRODUCER_MANIFESTS: SourceObservationProducerManifest[] = [
  ...DEFAULT_SOURCE_OBSERVATION_PRODUCER_MANIFESTS,
  {
    producerId: "pdf_context_extraction",
    capabilityId: "pdf_text_extraction",
    producerKind: "parser",
    acceptedSourceKinds: ["uploaded_document", "parsed_document", "pdf_page"],
    requiredInputLanes: ["a03_text_packing_lane"],
    producedObservationTypes: [
      "source_coverage_signal",
      "table_signal",
      "table_structure_hint",
      "visual_region_hint",
    ],
    producedPayloadKinds: ["structured", "warning"],
    producedPayloadTypes: ["source_observation"],
    modelRequirements: [],
    toolRequirements: ["pdf-parse", "pdf_context_extraction"],
    laneRequirements: ["a03_text_packing_lane"],
    approvalRequired: false,
    policyDataClass: "tenant_source",
    sideEffects: "read_current_evidence",
    costEstimate: "none",
    latencyEstimate: "in_memory",
    currentAvailability: "available_read_only",
    executionEvidenceRequirement:
      "PDF parser/page metadata must already be loaded for the current uploaded-document resolver pass.",
    canonicalCatalogIds: {
      payloadTypes: ["source_observation"],
      laneIds: ["a03_text_packing_lane"],
      toolIds: ["pdf-parse", "pdf_context_extraction"],
      capabilityIds: ["pdf_text_extraction", "pdf_page_classification"],
    },
    noUnavailableToolExecutionClaimed: true,
  },
  {
    producerId: "spreadsheet_range_reader",
    capabilityId: "spreadsheet_inventory",
    producerKind: "parser",
    acceptedSourceKinds: ["uploaded_document", "spreadsheet_source_metadata", "parsed_document"],
    requiredInputLanes: ["a03_text_packing_lane"],
    producedObservationTypes: [
      "spreadsheet_range",
      "workbook_metadata",
      "sheet_inventory",
      "spreadsheet_formula_map",
      "table_extraction",
    ],
    producedPayloadKinds: ["table", "structured"],
    producedPayloadTypes: ["source_observation", "spreadsheet_range"],
    modelRequirements: [],
    toolRequirements: ["xlsx", "spreadsheet_range_reader"],
    laneRequirements: ["a03_text_packing_lane"],
    approvalRequired: false,
    policyDataClass: "tenant_source",
    sideEffects: "read_current_evidence",
    costEstimate: "none",
    latencyEstimate: "in_memory",
    currentAvailability: "available_read_only",
    executionEvidenceRequirement:
      "Representative spreadsheet inventory must already exist in current resolver-owned chunk evidence.",
    canonicalCatalogIds: {
      payloadTypes: ["source_observation", "spreadsheet_range"],
      laneIds: ["a03_text_packing_lane"],
      toolIds: ["xlsx", "spreadsheet_range_reader"],
      capabilityIds: ["spreadsheet_inventory"],
    },
    noUnavailableToolExecutionClaimed: true,
  },
  {
    producerId: "rendered_page_renderer",
    capabilityId: "rendered_page_inspection",
    producerKind: "tool",
    acceptedSourceKinds: ["uploaded_document", "pdf_page"],
    requiredInputLanes: ["a03_text_packing_lane"],
    producedObservationTypes: ["rendered_page_image"],
    producedPayloadKinds: ["image_reference", "structured"],
    producedPayloadTypes: ["rendered_page_image", "source_observation"],
    modelRequirements: [],
    toolRequirements: ["pdf-parse", "PDFParse.getScreenshot"],
    laneRequirements: ["a03_text_packing_lane"],
    approvalRequired: false,
    policyDataClass: "tenant_source",
    sideEffects: "read_current_evidence",
    costEstimate: "none",
    latencyEstimate: "short",
    currentAvailability: "available_read_only",
    executionEvidenceRequirement:
      "A scoped uploaded PDF buffer must be rendered by the WP4A3 app-level local producer and produce capped image-reference observations.",
    canonicalCatalogIds: {
      payloadTypes: ["rendered_page_image", "source_observation"],
      laneIds: ["a03_text_packing_lane"],
      toolIds: ["pdf-parse-page-renderer", "rendered_page_renderer"],
      capabilityIds: ["rendered_page_inspection"],
    },
    noUnavailableToolExecutionClaimed: true,
  },
  {
    producerId: "office_document_structure_extractor",
    capabilityId: "document_structure_extraction",
    producerKind: "parser",
    acceptedSourceKinds: ["uploaded_document", "parsed_document"],
    requiredInputLanes: ["a03_text_packing_lane"],
    producedObservationTypes: ["document_outline", "deck_outline", "slide_summary"],
    producedPayloadKinds: ["structured"],
    producedPayloadTypes: ["source_observation"],
    modelRequirements: [],
    toolRequirements: ["mammoth", "officeparser", "office_document_structure_extractor"],
    laneRequirements: ["a03_text_packing_lane"],
    approvalRequired: false,
    policyDataClass: "tenant_source",
    sideEffects: "read_current_evidence",
    costEstimate: "none",
    latencyEstimate: "in_memory",
    currentAvailability: "available_read_only",
    executionEvidenceRequirement:
      "DOCX/PPTX parser chunks must exist and be normalized into bounded structure observations.",
    canonicalCatalogIds: {
      payloadTypes: ["source_observation"],
      laneIds: ["a03_text_packing_lane"],
      toolIds: ["mammoth", "officeparser", "office_document_structure_extractor"],
      capabilityIds: ["document_structure_extraction"],
    },
    noUnavailableToolExecutionClaimed: true,
  },
];

function normalizeStateForResult(
  state: UploadedDocumentLocalAvailabilityState
): UploadedDocumentLocalCandidateSummary["resultState"] {
  switch (state) {
    case "available_executable":
    case "newly_enabled_dependency":
      return "completed_with_evidence";
    case "available_but_not_needed":
      return "skipped";
    case "cataloged_not_installed":
      return "catalog_only";
    case "blocked_by_policy":
      return "blocked_by_policy";
    case "deferred":
      return "deferred";
    case "failed":
      return "failed";
    default:
      return "unavailable";
  }
}

function stableSegment(value: string | number | boolean | null | undefined) {
  return String(value ?? "none")
    .replace(/[^a-zA-Z0-9:_-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80) || "none";
}

function uniqueStrings(values: Array<string | null | undefined>) {
  return Array.from(new Set(values.filter((value): value is string => Boolean(value))));
}

function increment(record: Record<string, number>, key: string | null | undefined) {
  const normalized = key?.trim() || "unknown";
  record[normalized] = (record[normalized] ?? 0) + 1;
}

function hasDependency(
  versions: Record<string, string | null>,
  dependencyName: string
) {
  return Boolean(versions[dependencyName]?.trim());
}

function localCandidateState(params: {
  candidate: LocalCandidateDefinition;
  contextKind: UploadedDocumentLocalContextKind;
  dependencyVersions: Record<string, string | null>;
  safeSandboxAvailable: boolean;
  producerEvidenceAvailable: boolean;
}) {
  const { candidate } = params;
  const relevant = candidate.relevantContextKinds.includes(params.contextKind);
  const dependenciesAvailable = candidate.dependencyNames.every((dependency) =>
    hasDependency(params.dependencyVersions, dependency)
  );

  if (candidate.requiresSafeSandbox && !params.safeSandboxAvailable) {
    return "unavailable_no_safe_sandbox" satisfies UploadedDocumentLocalAvailabilityState;
  }

  if (!relevant) {
    return "available_but_not_needed" satisfies UploadedDocumentLocalAvailabilityState;
  }

  if (candidate.requiresWorkerRuntime && !candidate.requiresOptionalBinary) {
    return "unavailable_requires_worker_runtime" satisfies UploadedDocumentLocalAvailabilityState;
  }

  if (!dependenciesAvailable) {
    return candidate.requiresOptionalBinary
      ? ("cataloged_not_installed" satisfies UploadedDocumentLocalAvailabilityState)
      : ("unavailable_missing_dependency" satisfies UploadedDocumentLocalAvailabilityState);
  }

  if (candidate.requiresWorkerRuntime) {
    return "unavailable_requires_worker_runtime" satisfies UploadedDocumentLocalAvailabilityState;
  }

  if (candidate.requiresPinnedRuntimeAssets) {
    return "unavailable_runtime_install_forbidden" satisfies UploadedDocumentLocalAvailabilityState;
  }

  if (!candidate.implemented) {
    return "deferred" satisfies UploadedDocumentLocalAvailabilityState;
  }

  if (candidate.newlyEnabledInWp4A3 && params.producerEvidenceAvailable) {
    return "newly_enabled_dependency" satisfies UploadedDocumentLocalAvailabilityState;
  }

  return params.producerEvidenceAvailable
    ? ("available_executable" satisfies UploadedDocumentLocalAvailabilityState)
    : ("deferred" satisfies UploadedDocumentLocalAvailabilityState);
}

function configuredFromEnv(env: Record<string, string | undefined>, names: readonly string[]) {
  return names.some((name) => Boolean(env[name]?.trim()));
}

export function buildUploadedDocumentLocalDependencyInventory(params?: {
  packageDependencies?: Record<string, string | null> | null;
  packageDevDependencies?: Record<string, string | null> | null;
  env?: Record<string, string | undefined> | null;
  contextKind?: UploadedDocumentLocalContextKind | null;
  evidenceAvailableByProducerId?: Record<string, boolean> | null;
  safeSandboxAvailable?: boolean | null;
}): UploadedDocumentLocalDependencyInventory {
  const dependencyVersions = {
    ...DEFAULT_DEPENDENCY_VERSIONS,
    ...(params?.packageDependencies ?? {}),
    ...(params?.packageDevDependencies ?? {}),
  };
  const contextKind = params?.contextKind ?? "text";
  const safeSandboxAvailable = params?.safeSandboxAvailable ?? false;
  const evidenceByProducer = params?.evidenceAvailableByProducerId ?? {};
  const optionalLocalTools = LOCAL_CANDIDATE_DEFINITIONS.map((candidate) => {
    const availabilityState = localCandidateState({
      candidate,
      contextKind,
      dependencyVersions,
      safeSandboxAvailable,
      producerEvidenceAvailable: Boolean(evidenceByProducer[candidate.producerId]),
    });
    return {
      toolId: candidate.toolId,
      producerId: candidate.producerId,
      capabilityId: candidate.capabilityId,
      payloadTypes: [...candidate.payloadTypes],
      dependencyNames: [...candidate.dependencyNames],
      availabilityState,
      resultState: normalizeStateForResult(availabilityState),
      reason:
        availabilityState === "available_executable" || availabilityState === "newly_enabled_dependency"
          ? "Current uploaded-document resolver evidence is available for this local producer."
          : candidate.reasonUnavailable,
      deferredPackage: candidate.deferredPackage ?? null,
      newlyEnabledInWp4A3: candidate.newlyEnabledInWp4A3,
      noExecutionClaimed: true,
    } satisfies UploadedDocumentLocalCandidateSummary;
  });
  const env = params?.env ?? {};
  const externalCandidates = EXTERNAL_CANDIDATES.map((candidate) => {
    const configured = configuredFromEnv(env, candidate.envNames);
    return {
      toolId: candidate.toolId,
      producerId: candidate.producerId,
      capabilityId: candidate.capabilityId,
      availabilityState: configured ? "approval_required" : "deferred_to_wp4a2",
      configured,
      reason: configured
        ? "Configuration presence was detected, but WP4A1 does not call external document/OCR/vision services."
        : "External candidate is catalog-only in WP4A1 and deferred to WP4A2.",
      deferredPackage: "WP4A2",
      noExternalCallMade: true,
      noExecutionClaimed: true,
    } satisfies UploadedDocumentExternalCandidateSummary;
  });

  return {
    inspected: true,
    packageDependenciesInspected: true,
    dependencyVersions,
    availableDependencies: Object.entries(dependencyVersions)
      .filter(([, version]) => Boolean(version?.trim()))
      .map(([name]) => name)
      .sort(),
    missingDependencies: uniqueStrings(
      LOCAL_CANDIDATE_DEFINITIONS.flatMap((candidate) => candidate.dependencyNames)
        .filter((dependency) => !hasDependency(dependencyVersions, dependency))
    ).sort(),
    safeSandboxAvailable,
    localBinaryExecutionAllowed: false,
    packageInstallOrDeploymentAttempted: false,
    optionalLocalTools,
    externalCandidates,
    noSecretsIncluded: true,
    noExecutionClaimed: true,
  };
}

function buildSpreadsheetRangeObservations(params: {
  document: SourceObservationDocumentRef;
  chunks: ContextDocumentChunk[];
  options?: SourceObservationBuildOptions;
}): SourceObservation[] {
  const max =
    params.options?.maxObservationsPerDocument ??
    params.options?.maxObservations ??
    params.chunks.length;
  return params.chunks
    .filter((chunk) => chunk.sourceType === "spreadsheet")
    .slice(0, Math.max(0, max))
    .map((chunk) => {
      const id = `${params.document.id}:spreadsheet:range:${chunk.chunkIndex}`;
      const sourceLocator = normalizeSourceObservationLocator({
        sourceLocationLabel:
          chunk.safeProvenanceLabel?.trim()
            ? `${params.document.filename ?? chunk.filename} - ${chunk.safeProvenanceLabel}`
            : params.document.filename ?? chunk.filename ?? params.document.id,
        chunkId: id,
        chunkIndex: chunk.chunkIndex,
        charStart: chunk.charStart,
        charEnd: chunk.charEnd,
        sheetName: chunk.sheetName,
        pageNumberStart: chunk.pageNumberStart,
        pageNumberEnd: chunk.pageNumberEnd,
        sectionPath: [...chunk.sectionPath],
        headingPath: [...chunk.headingPath],
      });

      return {
        id,
        type: "spreadsheet_range",
        traceId: params.options?.traceId ?? null,
        planId: params.options?.planId ?? null,
        conversationId: params.options?.conversationId ?? params.document.conversationId ?? null,
        messageId: params.options?.messageId ?? null,
        conversationDocumentId: params.document.id,
        sourceId: params.document.id,
        sourceDocumentId: params.document.id,
        sourceKind: "spreadsheet_source_metadata",
        sourceVersion: params.options?.sourceVersion ?? null,
        sourceLocator,
        content: chunk.text,
        payloadKind: "table" satisfies SourceObservationPayloadKind,
        payload: {
          chunkIndex: chunk.chunkIndex,
          sheetName: chunk.sheetName,
          selectedForContext: true,
          inventoryOnly: true,
          macroExecution: false,
          formulaEvaluation: false,
          pythonExecution: false,
        },
        producer: {
          producerId: "spreadsheet_range_reader",
          producerKind: "parser",
          capabilityId: "spreadsheet_inventory",
          executionState: "executed",
          executionEvidence: {
            dependency: "xlsx",
            chunkIndex: chunk.chunkIndex,
            sheetName: chunk.sheetName,
            macroExecution: false,
            formulaEvaluation: false,
            pythonExecution: false,
          },
          noUnavailableToolExecutionClaimed: true,
        },
        extractionMethod: "xlsx_spreadsheet_inventory",
        confidence: 0.72,
        limitations: [
          "Spreadsheet observation is compact representative inventory only.",
          "No workbook macros, Python, DuckDB, pandas, polars, formula evaluation, or computation executed.",
        ],
        promotionHints: {
          eligible: true,
          reason: "Spreadsheet inventory can feed existing source-learning promotion policy without computation.",
        },
        relatedGapHints: [],
        createdAt: params.options?.nowIso ?? null,
      } satisfies SourceObservation;
    });
}

function buildLocalProducerRequest(params: {
  traceId?: string | null;
  planId?: string | null;
  conversationId?: string | null;
  messageId?: string | null;
  document: SourceObservationDocumentRef;
  producerId: string;
  requestedObservationType: SourceObservationType | string;
  requestedCapabilityId: string;
  requestedPayloadType: string;
  reason: string;
}) {
  const id = [
    "uploaded-document-local-producer",
    stableSegment(params.traceId ?? params.planId),
    stableSegment(params.document.id),
    stableSegment(params.producerId),
    stableSegment(params.requestedCapabilityId),
    stableSegment(params.requestedPayloadType),
    stableSegment(params.requestedObservationType),
  ].join(":");

  return {
    id,
    traceId: params.traceId ?? null,
    planId: params.planId ?? null,
    conversationId: params.conversationId ?? params.document.conversationId ?? null,
    messageId: params.messageId ?? null,
    conversationDocumentId: params.document.id,
    sourceId: params.document.id,
    sourceKind: "uploaded_document",
    sourceLocator: {
      sourceLocationLabel: params.document.filename ?? params.document.id,
    },
    requestedObservationType: params.requestedObservationType,
    requestedCapabilityId: params.requestedCapabilityId,
    requestedPayloadType: params.requestedPayloadType,
    reason: params.reason,
    priority: "normal",
    severity: "medium",
    producerId: params.producerId,
    input: {
      payloadType: params.requestedPayloadType,
      metadata: {
        uploadedDocumentLocalBaseline: true,
      },
    },
    noExecutionClaimed: true,
  } satisfies SourceObservationProducerRequest;
}

function buildLocalProducerRequests(params: {
  document: SourceObservationDocumentRef;
  contextKind: UploadedDocumentLocalContextKind;
  observations: SourceObservation[];
  traceId?: string | null;
  planId?: string | null;
  conversationId?: string | null;
  messageId?: string | null;
}) {
  const requests: SourceObservationProducerRequest[] = [];
  const observationTypes = new Set(params.observations.map((observation) => observation.type));
  for (const observationType of ["chunk_excerpt", "table_signal"] as const) {
    if (!observationTypes.has(observationType)) continue;
    requests.push(
      buildLocalProducerRequest({
        ...params,
        producerId: "parser_text_extraction",
        requestedObservationType: observationType,
        requestedCapabilityId: "text_extraction",
        requestedPayloadType: "text_excerpt",
        reason: "WP4A1 local parser text producer reuses completed uploaded-document chunk evidence.",
      })
    );
  }
  if (
    params.contextKind === "pdf" &&
    params.observations.some((observation) => observation.type === "source_coverage_signal")
  ) {
    requests.push(
      buildLocalProducerRequest({
        ...params,
        producerId: "pdf_context_extraction",
        requestedObservationType: "source_coverage_signal",
        requestedCapabilityId: "pdf_text_extraction",
        requestedPayloadType: "source_observation",
        reason: "WP4A1 PDF local producer reuses completed pdf-parse coverage and page-structure evidence.",
      })
    );
  }
  if (
    params.contextKind === "spreadsheet" &&
    params.observations.some((observation) => observation.type === "spreadsheet_range")
  ) {
    requests.push(
      buildLocalProducerRequest({
        ...params,
        producerId: "spreadsheet_range_reader",
        requestedObservationType: "spreadsheet_range",
        requestedCapabilityId: "spreadsheet_inventory",
        requestedPayloadType: "source_observation",
        reason:
          "WP4A1 spreadsheet local producer reuses completed xlsx representative-range inventory evidence without computation.",
      })
    );
  }

  const seen = new Set<string>();
  return requests.filter((request) => {
    if (seen.has(request.id)) return false;
    seen.add(request.id);
    return true;
  });
}

function summarizeExecutedProducers(results: SourceObservationProducerResult[]) {
  const byProducer = new Map<string, UploadedDocumentDigestionLocalExecutedProducerSummary>();
  for (const result of results) {
    if (result.state !== "completed_with_evidence" || !result.producerId) continue;
    const existing = byProducer.get(result.producerId) ?? {
      producerId: result.producerId,
      capabilityId: result.capabilityId,
      observationCount: 0,
      evidenceObservationIds: [],
    };
    existing.observationCount += result.observationIds.length;
    existing.evidenceObservationIds.push(...result.observationIds);
    byProducer.set(result.producerId, existing);
  }
  return [...byProducer.values()].map((entry) => ({
    ...entry,
    evidenceObservationIds: uniqueStrings(entry.evidenceObservationIds).slice(0, 24),
  }));
}

function buildProducerStatesByToolCapability(
  localCandidates: UploadedDocumentLocalCandidateSummary[],
  externalCandidates: UploadedDocumentExternalCandidateSummary[]
) {
  const states: Record<string, string> = {};
  for (const candidate of localCandidates) {
    states[`${candidate.toolId}:${candidate.capabilityId}`] = candidate.availabilityState;
  }
  for (const candidate of externalCandidates) {
    states[`${candidate.toolId}:${candidate.capabilityId}`] = candidate.availabilityState;
  }
  return states;
}

function buildNoExecutionWarnings(
  localCandidates: UploadedDocumentLocalCandidateSummary[],
  externalCandidates: UploadedDocumentExternalCandidateSummary[]
) {
  const warnings = [
    "WP4A3 local tool enablement does not install packages at runtime, deploy tools, call external services, read connectors, or create browser snapshots.",
  ];
  for (const candidate of localCandidates) {
    if (
      candidate.availabilityState !== "available_executable" &&
      candidate.availabilityState !== "newly_enabled_dependency" &&
      candidate.availabilityState !== "available_but_not_needed"
    ) {
      warnings.push(`${candidate.toolId}: ${candidate.reason}`);
    }
  }
  for (const candidate of externalCandidates) {
    warnings.push(`${candidate.toolId}: ${candidate.reason}`);
  }
  return warnings.slice(0, 18);
}

function buildLocalToolEnablementDebug(params: {
  observations: SourceObservation[];
  producerResults: SourceObservationProducerResult[];
  localCandidates: UploadedDocumentLocalCandidateSummary[];
}) {
  const resultState = (producerId: string) =>
    params.producerResults.find((result) => result.producerId === producerId)?.state ?? null;
  const renderedCount = params.observations.filter((observation) => observation.type === "rendered_page_image").length;
  const ocrCompleted = params.observations.some(
    (observation) => observation.type === "ocr_text" || observation.type === "ocr_page_text"
  );
  const officeCompleted = params.observations.some(
    (observation) =>
      observation.type === "document_outline" ||
      observation.type === "deck_outline" ||
      observation.type === "slide_summary"
  );
  const spreadsheetCompleted = params.observations.some(
    (observation) =>
      observation.type === "workbook_metadata" ||
      observation.type === "sheet_inventory" ||
      observation.type === "spreadsheet_formula_map"
  );
  const tableCompleted = params.observations.some((observation) => observation.type === "table_extraction");
  const tableUnresolved = params.producerResults.some((result) =>
    result.unresolvedNeeds.some(
      (need) => need.payloadType === "structured_table" || need.observationType === "table_extraction"
    )
  );
  const newlyEnabledDependencies = uniqueStrings(
    params.localCandidates
      .filter((candidate) => candidate.availabilityState === "newly_enabled_dependency")
      .flatMap((candidate) => candidate.dependencyNames)
  );

  return {
    renderedPageImageInputStatus:
      renderedCount > 0
        ? "completed_with_evidence"
        : resultState("rendered_page_renderer") === "failed"
          ? "failed"
          : resultState("rendered_page_renderer") === "missing"
            ? "missing_input"
            : resultState("rendered_page_renderer") === "unavailable"
              ? "unavailable"
              : "not_needed",
    renderedPageImageInputCount: renderedCount,
    ocrStatus: ocrCompleted
      ? "completed_with_evidence"
      : resultState("ocr_extractor") === "failed"
        ? "failed"
        : resultState("ocr_extractor") === "unavailable"
          ? "unavailable_runtime_install_forbidden"
          : "not_needed",
    officeStructureStatus: officeCompleted
      ? "completed_with_evidence"
      : resultState("office_document_structure_extractor") === "failed"
        ? "failed"
        : "not_needed",
    spreadsheetStructureStatus: spreadsheetCompleted
      ? "completed_with_evidence"
      : resultState("spreadsheet_range_reader") === "failed"
        ? "failed"
        : "not_needed",
    tableExtractionStatus: tableCompleted ? "completed_with_evidence" : tableUnresolved ? "unresolved_need" : "not_needed",
    newlyEnabledDependencies,
    noRuntimeInstallAttempted: true,
    noRawImageBytesInObservations: true,
    noSemanticVisionClaimedByRendering: true,
  } satisfies UploadedDocumentDigestionLocalDebugSummary["localToolEnablement"];
}

function buildDebugSummary(params: {
  document: SourceObservationDocumentRef;
  contextKind: UploadedDocumentLocalContextKind;
  observations: SourceObservation[];
  transportSelection: SourceObservationTransportSelection;
  producerResults: SourceObservationProducerResult[];
  inventory: UploadedDocumentLocalDependencyInventory;
  traceId?: string | null;
  planId?: string | null;
  durableGapDebtCandidateCount?: number | null;
}) {
  const completedObservationCountsByType: Record<string, number> = {};
  for (const observation of params.observations) {
    increment(completedObservationCountsByType, observation.type);
  }
  const executedLocalProducers = summarizeExecutedProducers(params.producerResults);
  const missingObservationNeeds = params.producerResults.flatMap((result) => result.unresolvedNeeds);
  const localCandidates = params.inventory.optionalLocalTools;

  return {
    traceId: params.traceId ?? null,
    planId: params.planId ?? null,
    conversationDocumentId: params.document.id,
    sourceId: params.document.id,
    filename: params.document.filename ?? null,
    contextKind: params.contextKind,
    dependencyInventory: params.inventory,
    inventoryInspectedBeforeProducerSelection: true,
    executionBackedLocalProducerLimit: 3,
    executedLocalProducerCount: executedLocalProducers.length,
    executedLocalProducers,
    localToolEnablement: buildLocalToolEnablementDebug({
      observations: params.observations,
      producerResults: params.producerResults,
      localCandidates,
    }),
    availableButNotNeededLocalProducers: localCandidates.filter(
      (candidate) => candidate.availabilityState === "available_but_not_needed"
    ),
    unavailableCatalogOnlyLocalProducers: localCandidates.filter((candidate) =>
      candidate.availabilityState === "cataloged_not_installed" ||
      candidate.availabilityState === "unavailable_missing_dependency" ||
      candidate.availabilityState === "unavailable_no_safe_sandbox" ||
      candidate.availabilityState === "unavailable_no_safe_wrapper" ||
      candidate.availabilityState === "unavailable_requires_worker_runtime" ||
      candidate.availabilityState === "unavailable_runtime_install_forbidden" ||
      candidate.availabilityState === "unavailable_not_supported"
    ),
    externalCandidateProducers: params.inventory.externalCandidates,
    skippedDeferredProducers: localCandidates.filter((candidate) =>
      candidate.availabilityState === "deferred" ||
      candidate.availabilityState === "blocked_by_policy" ||
      candidate.availabilityState === "failed"
    ),
    producerStatesByToolCapability: buildProducerStatesByToolCapability(
      localCandidates,
      params.inventory.externalCandidates
    ),
    completedObservationCount: params.observations.length,
    completedObservationCountsByType,
    missingObservationNeeds,
    durableGapDebtCandidateCount: params.durableGapDebtCandidateCount ?? 0,
    selectedTransportObservationCount: params.transportSelection.selectedObservationIds.length,
    cappedTransportObservationCount: params.transportSelection.cappedObservationCount,
    noExecutionWarnings: buildNoExecutionWarnings(localCandidates, params.inventory.externalCandidates),
    noExternalCallsMade: true,
    noPackageInstallOrDeploymentAttempted: true,
    noConnectorReadsOrBrowserSnapshots: true,
    noToolOutputBypassesSourceObservation: true,
    noExecutionClaimWithoutCompletedWithEvidence: true,
  } satisfies UploadedDocumentDigestionLocalDebugSummary;
}

export function buildUploadedDocumentDigestionLocalBaseline(params: {
  document: SourceObservationDocumentRef;
  contextKind: UploadedDocumentLocalContextKind;
  selectedChunks: ContextDocumentChunk[];
  sourceMetadata?: Record<string, unknown> | null;
  pdfExtractionMetadata?: PdfContextExtractionMetadata | null;
  selectedArtifacts?: DocumentKnowledgeArtifactRecord[] | null;
  observationOptions?: SourceObservationBuildOptions;
  parserMaxObservationsPerDocument?: number | null;
  pdfMaxObservationsPerDocument?: number | null;
  artifactMaxObservationsPerDocument?: number | null;
  spreadsheetMaxObservationsPerDocument?: number | null;
  transportMaxObservations?: number | null;
  transportMaxObservationsPerDocument?: number | null;
  enrichmentObservations?: SourceObservation[] | null;
  enrichmentProducerRequests?: SourceObservationProducerRequest[] | null;
  enrichmentProducerResults?: SourceObservationProducerResult[] | null;
  packageDependencies?: Record<string, string | null> | null;
  packageDevDependencies?: Record<string, string | null> | null;
  env?: Record<string, string | undefined> | null;
  safeSandboxAvailable?: boolean | null;
  durableGapDebtCandidateCount?: number | null;
}): UploadedDocumentDigestionLocalResult {
  const parserObservations = buildSourceObservationsFromSelectedDocumentChunks({
    document: params.document,
    contextKind: params.contextKind,
    chunks: params.selectedChunks,
    options: {
      ...params.observationOptions,
      maxObservationsPerDocument:
        params.parserMaxObservationsPerDocument ??
        params.observationOptions?.maxObservationsPerDocument ??
        12,
    },
  });
  const metadataObservations = buildSourceObservationsFromDocumentMetadata({
    document: params.document,
    contextKind: params.contextKind,
    sourceMetadata: params.sourceMetadata,
    options: params.observationOptions,
  });
  const pdfObservations =
    params.contextKind === "pdf"
      ? buildSourceObservationsFromPdfSignals({
          document: params.document,
          extractionMetadata: params.pdfExtractionMetadata,
          options: {
            ...params.observationOptions,
            maxObservationsPerDocument:
              params.pdfMaxObservationsPerDocument ?? 8,
          },
        })
      : [];
  const spreadsheetObservations =
    params.contextKind === "spreadsheet"
      ? buildSpreadsheetRangeObservations({
          document: params.document,
          chunks: params.selectedChunks,
          options: {
            ...params.observationOptions,
            maxObservationsPerDocument: Math.min(
              params.spreadsheetMaxObservationsPerDocument ?? 3,
              3
            ),
          },
        })
      : [];
  const artifactObservations = buildSourceObservationsFromKnowledgeArtifacts({
    document: params.document,
    artifacts: params.selectedArtifacts ?? [],
    options: {
      ...params.observationOptions,
      maxObservationsPerDocument:
        params.artifactMaxObservationsPerDocument ?? 6,
    },
  });
  const observations = [
    ...parserObservations,
    ...metadataObservations,
    ...pdfObservations,
    ...spreadsheetObservations,
    ...artifactObservations,
    ...(params.enrichmentObservations ?? []),
  ];
  const evidenceAvailableByProducerId = observations.reduce<Record<string, boolean>>((acc, observation) => {
    if (
      observation.producer.executionState === "executed" ||
      observation.producer.executionState === "deterministically_derived"
    ) {
      acc[observation.producer.producerId] = true;
    }
    return acc;
  }, {
    parser_text_extraction: parserObservations.length > 0,
    pdf_context_extraction: pdfObservations.length > 0,
    spreadsheet_range_reader: spreadsheetObservations.length > 0,
  });
  const inventory = buildUploadedDocumentLocalDependencyInventory({
    packageDependencies: params.packageDependencies,
    packageDevDependencies: params.packageDevDependencies,
    env: params.env,
    contextKind: params.contextKind,
    evidenceAvailableByProducerId,
    safeSandboxAvailable: params.safeSandboxAvailable ?? false,
  });
  const producerRequests = [
    ...buildLocalProducerRequests({
      document: params.document,
      contextKind: params.contextKind,
      observations,
      traceId: params.observationOptions?.traceId,
      planId: params.observationOptions?.planId,
      conversationId: params.observationOptions?.conversationId,
      messageId: params.observationOptions?.messageId,
    }),
    ...(params.enrichmentProducerRequests ?? []),
  ];
  const producerAvailability = buildSourceObservationProducerAvailabilitySnapshot({
    requests: producerRequests,
    observations,
    manifests: UPLOADED_DOCUMENT_LOCAL_PRODUCER_MANIFESTS,
    traceId: params.observationOptions?.traceId,
    planId: params.observationOptions?.planId,
  });
  const deterministicProducerRequests = producerRequests.filter(
    (request) =>
      !(params.enrichmentProducerRequests ?? []).some((enrichmentRequest) => enrichmentRequest.id === request.id)
  );
  const producerResults = [
    ...runDeterministicSourceObservationProducers({
      requests: deterministicProducerRequests,
      observations,
      manifests: UPLOADED_DOCUMENT_LOCAL_PRODUCER_MANIFESTS,
      availabilityContext: producerAvailability,
    }),
    ...(params.enrichmentProducerResults ?? []),
  ];
  const transportSelection = selectSourceObservationsForTransport({
    observations,
    maxObservations: params.transportMaxObservations ?? 16,
    maxObservationsPerDocument: params.transportMaxObservationsPerDocument ?? 8,
  });

  return {
    observations,
    transportSelection,
    producerRequests,
    producerAvailability,
    producerResults,
    debugSummary: buildDebugSummary({
      document: params.document,
      contextKind: params.contextKind,
      observations,
      transportSelection,
      producerResults,
      inventory,
      traceId: params.observationOptions?.traceId,
      planId: params.observationOptions?.planId,
      durableGapDebtCandidateCount: params.durableGapDebtCandidateCount,
    }),
  };
}

export function withUploadedDocumentDigestionLocalDurableGapCount(
  summary: UploadedDocumentDigestionLocalDebugSummary,
  durableGapDebtCandidateCount: number
): UploadedDocumentDigestionLocalDebugSummary {
  return {
    ...summary,
    durableGapDebtCandidateCount,
  };
}
