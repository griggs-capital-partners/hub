import * as XLSX from "xlsx";

import type { ContextDocumentChunk } from "./context-document-chunks";
import type { PdfContextExtractionMetadata } from "./context-pdf";
import type { UploadedDocumentExternalImageInput } from "./document-ingestion-external-producers";
import {
  normalizeSourceObservationLocator,
  type SourceObservation,
  type SourceObservationBuildOptions,
  type SourceObservationLocator,
  type SourceObservationNeed,
  type SourceObservationPayload,
  type SourceObservationPayloadKind,
  type SourceObservationProducerKind,
  type SourceObservationSourceKind,
  type SourceObservationType,
} from "./source-observations";
import type {
  SourceObservationProducerRequest,
  SourceObservationProducerResult,
  SourceObservationProducerResultState,
} from "./source-observation-producers";

const MAX_RENDERED_PDF_PAGES = 2;
const MAX_RENDERED_IMAGE_WIDTH = 1024;
const MAX_RENDERED_IMAGE_BYTES = 2_000_000;
const MAX_OFFICE_OUTLINE_ITEMS = 12;
const MAX_SLIDE_SUMMARIES = 4;
const MAX_SPREADSHEET_SHEETS = 3;
const MAX_SPREADSHEET_ROWS = 8;
const MAX_SPREADSHEET_COLUMNS = 8;
const MAX_FORMULA_CELLS = 12;

type UploadedDocumentLocalToolDocumentRef = {
  id: string;
  conversationId?: string | null;
  filename?: string | null;
  mimeType?: string | null;
  fileType?: string | null;
};

type LocalProducerDependencyVersions = Record<string, string | null | undefined>;

export type UploadedDocumentLocalToolEnablementDebugSummary = {
  executedProducerIds: string[];
  skippedProducerIds: string[];
  unavailableProducerIds: string[];
  failedProducerIds: string[];
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
  noOcrClaimedWithoutOcrProducerEvidence: true;
};

export type UploadedDocumentLocalToolEnablementResult = {
  observations: SourceObservation[];
  producerRequests: SourceObservationProducerRequest[];
  producerResults: SourceObservationProducerResult[];
  imageInputs: UploadedDocumentExternalImageInput[];
  debugSummary: UploadedDocumentLocalToolEnablementDebugSummary;
};

export type UploadedDocumentLocalToolEnablementInput = {
  document: UploadedDocumentLocalToolDocumentRef;
  contextKind: string;
  fileBuffer?: Buffer | null;
  selectedChunks?: ContextDocumentChunk[] | null;
  pdfExtractionMetadata?: PdfContextExtractionMetadata | null;
  taskPrompt?: string | null;
  observationOptions?: SourceObservationBuildOptions;
  packageDependencies?: LocalProducerDependencyVersions | null;
  forcePdfRendering?: boolean;
  forceOfficeStructure?: boolean;
  forceSpreadsheetStructure?: boolean;
  maxRenderedPdfPages?: number | null;
};

type PdfScreenshotPage = {
  pageNumber: number | null;
  width: number | null;
  height: number | null;
  dataBuffer: Buffer | null;
  dataUrl: string | null;
};

type PdfParseScreenshotRunner = {
  getScreenshot: (params: {
    partial?: number[];
    desiredWidth?: number;
    imageDataUrl?: boolean;
    imageBuffer?: boolean;
  }) => Promise<unknown>;
  destroy?: () => Promise<void> | void;
};

function stableSegment(value: string | number | boolean | null | undefined) {
  return String(value ?? "none")
    .replace(/[^a-zA-Z0-9:_-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80) || "none";
}

function uniqueStrings(values: Array<string | null | undefined>) {
  return Array.from(new Set(values.filter((value): value is string => Boolean(value))));
}

function normalizeText(value: string | null | undefined) {
  return (value ?? "").replace(/\s+/g, " ").trim();
}

function capText(value: string | null | undefined, max = 800) {
  const normalized = normalizeText(value);
  return normalized.length > max ? `${normalized.slice(0, max).trim()}...` : normalized;
}

function numberValue(value: unknown) {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function stringValue(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function recordValue(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function extensionFor(filename: string | null | undefined) {
  return (filename ?? "").split(".").pop()?.toLowerCase() ?? "";
}

function buildObservation(params: {
  document: UploadedDocumentLocalToolDocumentRef;
  id: string;
  type: SourceObservationType;
  sourceKind: SourceObservationSourceKind;
  sourceLocator: SourceObservationLocator;
  content: string;
  payloadKind: SourceObservationPayloadKind;
  payload: SourceObservationPayload | null;
  producerId: string;
  producerKind: SourceObservationProducerKind;
  capabilityId: string;
  executionEvidence: Record<string, unknown>;
  extractionMethod: string;
  confidence: number | null;
  limitations: string[];
  options?: SourceObservationBuildOptions;
  promotionEligible?: boolean;
  promotionReason?: string | null;
  relatedGapHints?: SourceObservation["relatedGapHints"];
}): SourceObservation {
  return {
    id: params.id,
    type: params.type,
    traceId: params.options?.traceId ?? null,
    planId: params.options?.planId ?? null,
    conversationId: params.options?.conversationId ?? params.document.conversationId ?? null,
    messageId: params.options?.messageId ?? null,
    conversationDocumentId: params.document.id,
    sourceId: params.document.id,
    sourceDocumentId: params.document.id,
    sourceKind: params.sourceKind,
    sourceVersion: params.options?.sourceVersion ?? null,
    sourceLocator: normalizeSourceObservationLocator(params.sourceLocator),
    content: params.content,
    payloadKind: params.payloadKind,
    payload: params.payload,
    producer: {
      producerId: params.producerId,
      producerKind: params.producerKind,
      capabilityId: params.capabilityId,
      executionState: "executed",
      executionEvidence: params.executionEvidence,
      noUnavailableToolExecutionClaimed: true,
    },
    extractionMethod: params.extractionMethod,
    confidence: params.confidence,
    limitations: params.limitations,
    promotionHints:
      params.promotionEligible === undefined
        ? undefined
        : {
            eligible: params.promotionEligible,
            reason: params.promotionReason ?? null,
          },
    relatedGapHints: params.relatedGapHints ?? [],
    createdAt: params.options?.nowIso ?? null,
  };
}

function buildProducerRequest(params: {
  document: UploadedDocumentLocalToolDocumentRef;
  producerId: string;
  capabilityId: string;
  observationType: SourceObservationType | string;
  payloadType: string;
  reason: string;
  sourceLocator?: SourceObservationLocator | null;
  options?: SourceObservationBuildOptions;
  priority?: SourceObservationProducerRequest["priority"];
  severity?: SourceObservationProducerRequest["severity"];
  metadata?: Record<string, unknown> | null;
}) {
  return {
    id: [
      "uploaded-document-local-tool",
      stableSegment(params.options?.traceId ?? params.options?.planId),
      stableSegment(params.document.id),
      stableSegment(params.producerId),
      stableSegment(params.capabilityId),
      stableSegment(params.observationType),
    ].join(":"),
    traceId: params.options?.traceId ?? null,
    planId: params.options?.planId ?? null,
    conversationId: params.options?.conversationId ?? params.document.conversationId ?? null,
    messageId: params.options?.messageId ?? null,
    conversationDocumentId: params.document.id,
    sourceId: params.document.id,
    sourceKind: "uploaded_document",
    sourceLocator: normalizeSourceObservationLocator(
      params.sourceLocator ?? { sourceLocationLabel: params.document.filename ?? params.document.id }
    ),
    requestedObservationType: params.observationType,
    requestedCapabilityId: params.capabilityId,
    requestedPayloadType: params.payloadType,
    reason: params.reason,
    priority: params.priority ?? "normal",
    severity: params.severity ?? "medium",
    producerId: params.producerId,
    input: {
      payloadType: params.payloadType,
      metadata: {
        uploadedDocumentLocalToolEnablement: true,
        ...(params.metadata ?? {}),
      },
    },
    noExecutionClaimed: true,
  } satisfies SourceObservationProducerRequest;
}

function buildProducerResult(params: {
  request: SourceObservationProducerRequest;
  producerId: string;
  capabilityId: string;
  state: SourceObservationProducerResultState;
  observations?: SourceObservation[];
  payloadType?: string | null;
  reason: string;
  evidenceSummary?: string | null;
  missingRequirements?: string[];
  unresolvedNeeds?: SourceObservationNeed[];
  recommendedResolution?: string | null;
  metadata?: Record<string, unknown> | null;
}): SourceObservationProducerResult {
  const observations = params.observations ?? [];
  const observationIds = observations.map((observation) => observation.id);
  const completed = params.state === "completed_with_evidence";
  const sourceIds = uniqueStrings(
    observations.map((observation) => observation.sourceId ?? observation.sourceDocumentId)
  );
  const payloadKinds: SourceObservationPayloadKind[] = Array.from(
    new Set(observations.map((observation) => observation.payloadKind))
  );

  return {
    requestId: params.request.id,
    request: params.request,
    producerId: params.producerId,
    capabilityId: params.capabilityId,
    state: params.state,
    resolution: {
      state: params.state,
      producerId: params.producerId,
      capabilityId: params.capabilityId,
      payloadType: params.payloadType ?? params.request.requestedPayloadType ?? null,
      governedBy: ["wp4a3_local_tool_enablement", "source_observation_producer_result"],
      availabilitySources: completed ? ["runtime", "source_evidence"] : ["runtime"],
      primaryAvailabilitySource: "runtime",
      availabilityDetails: [],
      catalogPayloadType: params.payloadType ?? params.request.requestedPayloadType ?? null,
      catalogLaneId: null,
      brokerCapabilityId: params.capabilityId,
      executableNow: completed,
      reason: params.reason,
      evidenceSummary: params.evidenceSummary ?? null,
      missingRequirements: params.missingRequirements ?? [],
      approvalPath: null,
      sourceLocator: params.request.sourceLocator ?? null,
      traceId: params.request.traceId ?? null,
      planId: params.request.planId ?? null,
      requiresApproval: false,
      blockedByPolicy: false,
      asyncRecommended: false,
      noExecutionClaimed: true,
    },
    observations,
    observationIds,
    output: completed
      ? {
          observationIds,
          payloadKinds,
          evidenceSummary: params.evidenceSummary ?? params.reason,
          metadata: params.metadata ?? null,
        }
      : null,
    unresolvedNeeds: params.unresolvedNeeds ?? [],
    evidence: completed
      ? {
          summary: params.evidenceSummary ?? params.reason,
          observationIds,
          sourceIds,
          locator: params.request.sourceLocator ?? null,
          noUnavailableToolExecutionClaimed: true,
        }
      : null,
    reason: params.reason,
    recommendedResolution: params.recommendedResolution ?? null,
    requiresApproval: false,
    asyncRecommended: false,
    noExecutionClaimed: true,
  } satisfies SourceObservationProducerResult;
}

function taskNeedsPdfRendering(params: {
  contextKind: string;
  taskPrompt?: string | null;
  pdfExtractionMetadata?: PdfContextExtractionMetadata | null;
  selectedChunks: ContextDocumentChunk[];
  forcePdfRendering?: boolean;
}) {
  if (params.forcePdfRendering) return true;
  if (params.contextKind !== "pdf") return false;
  const prompt = normalizeText(params.taskPrompt);
  if (!prompt) return false;
  if (
    /\b(render|screenshot|image|visual|figure|chart|diagram|map|logo|signature|scan|scanned|ocr|page\s+\d+)\b/i.test(
      prompt
    )
  ) {
    return true;
  }
  if (/\b(table|row|column|cell|grid)\b/i.test(prompt)) {
    return params.selectedChunks.some(
      (chunk) =>
        chunk.visualClassification === "true_table" ||
        chunk.visualClassification === "table_like_schedule_or_timeline" ||
        chunk.visualClassification === "chart_or_plot" ||
        chunk.visualClassification === "low_text_or_scanned_visual"
    );
  }
  return Boolean(params.pdfExtractionMetadata?.lowTextPageNumbers?.length);
}

function taskNeedsOcr(params: {
  contextKind: string;
  taskPrompt?: string | null;
  pdfExtractionMetadata?: PdfContextExtractionMetadata | null;
}) {
  if (params.contextKind !== "pdf" && params.contextKind !== "image") return false;
  const prompt = normalizeText(params.taskPrompt);
  if (/\b(ocr|scanned|scan|image-only|read text from image|text in the image)\b/i.test(prompt)) {
    return true;
  }
  return Boolean(params.pdfExtractionMetadata?.lowTextPageNumbers?.length && /\b(read|extract|text|table)\b/i.test(prompt));
}

function taskNeedsOfficeStructure(params: {
  contextKind: string;
  taskPrompt?: string | null;
  forceOfficeStructure?: boolean;
  forceSpreadsheetStructure?: boolean;
}) {
  if (params.forceOfficeStructure && (params.contextKind === "docx" || params.contextKind === "pptx")) return true;
  if (params.forceSpreadsheetStructure && params.contextKind === "spreadsheet") return true;
  const prompt = normalizeText(params.taskPrompt);
  if (!prompt) return false;
  if (params.contextKind === "docx") {
    return /\b(document|section|heading|outline|table|structure|summarize|summary)\b/i.test(prompt);
  }
  if (params.contextKind === "pptx") {
    return /\b(deck|slide|presentation|notes|outline|structure|summarize|summary)\b/i.test(prompt);
  }
  if (params.contextKind === "spreadsheet") {
    return /\b(workbook|spreadsheet|sheet|range|table|formula|row|column|cell|data|summarize|summary)\b/i.test(prompt);
  }
  return false;
}

function promptPageNumbers(prompt?: string | null) {
  const values: number[] = [];
  for (const match of normalizeText(prompt).matchAll(/\bpage\s+(\d{1,4})\b/gi)) {
    const page = Number(match[1]);
    if (Number.isFinite(page) && page > 0) values.push(page);
  }
  return values;
}

function selectPdfRenderPages(params: {
  selectedChunks: ContextDocumentChunk[];
  pdfExtractionMetadata?: PdfContextExtractionMetadata | null;
  taskPrompt?: string | null;
  maxPages: number;
}) {
  const candidates = [
    ...promptPageNumbers(params.taskPrompt),
    ...(params.pdfExtractionMetadata?.lowTextPageNumbers ?? []),
    ...params.selectedChunks.flatMap((chunk) => {
      const pages = [chunk.pageNumberStart, chunk.pageNumberEnd].filter(
        (page): page is number => typeof page === "number" && Number.isFinite(page) && page > 0
      );
      const visual =
        chunk.visualClassification === "true_table" ||
        chunk.visualClassification === "table_like_schedule_or_timeline" ||
        chunk.visualClassification === "chart_or_plot" ||
        chunk.visualClassification === "technical_log_or_well_log" ||
        chunk.visualClassification === "schematic_or_diagram" ||
        chunk.visualClassification === "map_or_location_figure" ||
        chunk.visualClassification === "low_text_or_scanned_visual";
      return visual ? pages : [];
    }),
    params.pdfExtractionMetadata?.pageStructures?.[0]?.pageNumber,
    1,
  ];
  return uniqueStrings(
    candidates
      .filter((page): page is number => typeof page === "number" && Number.isFinite(page) && page > 0)
      .map((page) => String(page))
  )
    .map((page) => Number(page))
    .slice(0, Math.max(1, params.maxPages));
}

function bufferFromUnknown(value: unknown) {
  if (Buffer.isBuffer(value)) return value;
  if (value instanceof Uint8Array) return Buffer.from(value);
  return null;
}

function parseDataUrl(value: string | null) {
  if (!value) return { mimeType: null, base64: null };
  const match = /^data:([^;,]+);base64,(.+)$/i.exec(value);
  return {
    mimeType: match?.[1] ?? null,
    base64: match?.[2] ?? null,
  };
}

function normalizePdfScreenshotPages(raw: unknown, selectedPages: number[]): PdfScreenshotPage[] {
  const rawRecord = recordValue(raw);
  const rawPages = rawRecord?.pages;
  const records: unknown[] = Array.isArray(raw) ? raw : Array.isArray(rawPages) ? rawPages : [];
  return records.map((value, index) => {
    const record = recordValue(value) ?? {};
    const dataUrl = stringValue(record.dataUrl) ?? stringValue(record.imageDataUrl);
    const dataBuffer =
      bufferFromUnknown(record.data) ??
      bufferFromUnknown(record.imageBuffer) ??
      bufferFromUnknown(record.buffer) ??
      (() => {
        const parsed = parseDataUrl(dataUrl);
        return parsed.base64 ? Buffer.from(parsed.base64, "base64") : null;
      })();
    return {
      pageNumber: numberValue(record.pageNumber) ?? numberValue(record.page) ?? selectedPages[index] ?? null,
      width: numberValue(record.width),
      height: numberValue(record.height),
      dataBuffer,
      dataUrl,
    };
  });
}

async function createPdfScreenshotRunner(fileBuffer: Buffer): Promise<PdfParseScreenshotRunner> {
  const imported = (await import("pdf-parse")) as Record<string, unknown>;
  const PDFParse = imported.PDFParse;
  if (typeof PDFParse !== "function") {
    throw new Error("pdf-parse PDFParse export is unavailable.");
  }
  return new (PDFParse as new (params: { data: Buffer }) => PdfParseScreenshotRunner)({ data: fileBuffer });
}

async function runPdfRenderingProducer(params: UploadedDocumentLocalToolEnablementInput & {
  selectedChunks: ContextDocumentChunk[];
}): Promise<Pick<UploadedDocumentLocalToolEnablementResult, "observations" | "producerRequests" | "producerResults" | "imageInputs">> {
  const observations: SourceObservation[] = [];
  const imageInputs: UploadedDocumentExternalImageInput[] = [];
  const producerRequests: SourceObservationProducerRequest[] = [];
  const producerResults: SourceObservationProducerResult[] = [];
  const maxPages = Math.min(Math.max(1, params.maxRenderedPdfPages ?? MAX_RENDERED_PDF_PAGES), MAX_RENDERED_PDF_PAGES);
  const selectedPages = selectPdfRenderPages({
    selectedChunks: params.selectedChunks,
    pdfExtractionMetadata: params.pdfExtractionMetadata,
    taskPrompt: params.taskPrompt,
    maxPages,
  });
  const request = buildProducerRequest({
    document: params.document,
    producerId: "rendered_page_renderer",
    capabilityId: "rendered_page_inspection",
    observationType: "rendered_page_image",
    payloadType: "rendered_page_image",
    reason: "WP4A3 selected bounded PDF pages for local rendering into traceable image references.",
    sourceLocator: { pageNumberStart: selectedPages[0] ?? null, sourceLocationLabel: params.document.filename ?? params.document.id },
    options: params.observationOptions,
    metadata: {
      selectedPages,
      maxPages,
      maxImageBytes: MAX_RENDERED_IMAGE_BYTES,
      desiredWidth: MAX_RENDERED_IMAGE_WIDTH,
    },
  });
  producerRequests.push(request);

  if (!params.fileBuffer || params.fileBuffer.byteLength === 0) {
    producerResults.push(
      buildProducerResult({
        request,
        producerId: "rendered_page_renderer",
        capabilityId: "rendered_page_inspection",
        state: "missing",
        payloadType: "rendered_page_image",
        reason: "PDF rendering could not run because no uploaded-document file buffer was available.",
        missingRequirements: ["uploaded_document_pdf_file_buffer"],
        unresolvedNeeds: [
          {
            id: `${request.id}:missing-pdf-buffer`,
            observationType: "rendered_page_image",
            sourceId: params.document.id,
            conversationDocumentId: params.document.id,
            capability: "rendered_page_inspection",
            payloadType: "rendered_page_image",
            state: "unavailable",
            reason: "A rendered page image was task-needed, but the scoped uploaded PDF buffer was unavailable.",
            noExecutionClaimed: true,
          },
        ],
        recommendedResolution: "Keep rendering within the uploaded-document file-read path or defer to WP4C runtime if the source is unavailable.",
      })
    );
    return { observations, producerRequests, producerResults, imageInputs };
  }

  let runner: PdfParseScreenshotRunner | null = null;
  try {
    runner = await createPdfScreenshotRunner(params.fileBuffer);
    const screenshots = normalizePdfScreenshotPages(
      await runner.getScreenshot({
        partial: selectedPages,
        desiredWidth: MAX_RENDERED_IMAGE_WIDTH,
        imageDataUrl: true,
        imageBuffer: true,
      }),
      selectedPages
    );

    for (const page of screenshots) {
      const pageNumber = page.pageNumber;
      if (!pageNumber || !page.dataBuffer) continue;
      if (page.dataBuffer.byteLength > MAX_RENDERED_IMAGE_BYTES) continue;
      const dataUrl =
        page.dataUrl ??
        `data:image/png;base64,${page.dataBuffer.toString("base64")}`;
      const parsed = parseDataUrl(dataUrl);
      const imageInputId = `rendered-page:${stableSegment(params.document.id)}:${pageNumber}`;
      const observationId = `${params.document.id}:rendered-page:${pageNumber}`;
      const sourceLocator = normalizeSourceObservationLocator({
        pageNumberStart: pageNumber,
        pageNumberEnd: pageNumber,
        pageLabelStart: String(pageNumber),
        pageLabelEnd: String(pageNumber),
        sourceLocationLabel: `${params.document.filename ?? params.document.id} page ${pageNumber}`,
      });
      observations.push(
        buildObservation({
          document: params.document,
          id: observationId,
          type: "rendered_page_image",
          sourceKind: "pdf_page",
          sourceLocator,
          content: `Rendered page image reference produced for page ${pageNumber}. This is image evidence only; it is not semantic vision, OCR, or table extraction.`,
          payloadKind: "image_reference",
          payload: {
            imageReferenceId: imageInputId,
            mimeType: parsed.mimeType ?? "image/png",
            byteLength: page.dataBuffer.byteLength,
            width: page.width,
            height: page.height,
            desiredWidth: MAX_RENDERED_IMAGE_WIDTH,
            storage: "runtime_memory_only",
            rawBytesIncludedInObservation: false,
            dataUrlIncludedInObservation: false,
            semanticVisionExecuted: false,
            ocrExecuted: false,
            tableExtractionExecuted: false,
          },
          producerId: "rendered_page_renderer",
          producerKind: "tool",
          capabilityId: "rendered_page_inspection",
          executionEvidence: {
            dependency: "pdf-parse",
            method: "PDFParse.getScreenshot",
            pageNumber,
            byteLength: page.dataBuffer.byteLength,
            desiredWidth: MAX_RENDERED_IMAGE_WIDTH,
            maxPages,
            rawBytesIncludedInObservation: false,
          },
          extractionMethod: "pdf_parse_get_screenshot",
          confidence: 0.84,
          limitations: [
            "Rendering produced a page image reference only; it does not interpret figures, charts, signatures, logos, or table bodies.",
            "Raw image bytes and data URLs are kept out of SourceObservation payloads and are available only as bounded runtime image input.",
          ],
          options: params.observationOptions,
          promotionEligible: false,
          promotionReason: "Rendered page references are runtime evidence and are not automatically durable artifacts.",
        })
      );
      imageInputs.push({
        id: imageInputId,
        mimeType: parsed.mimeType ?? "image/png",
        dataBase64: parsed.base64 ?? page.dataBuffer.toString("base64"),
        dataUrl,
        sourceLocator,
        pageNumber,
        sourceLocationLabel: sourceLocator.sourceLocationLabel ?? null,
        sourceObservationId: observationId,
        producerId: "rendered_page_renderer",
        renderedPageImage: true,
      });
    }

    if (observations.length === 0) {
      producerResults.push(
        buildProducerResult({
          request,
          producerId: "rendered_page_renderer",
          capabilityId: "rendered_page_inspection",
          state: "failed",
          payloadType: "rendered_page_image",
          reason: "PDF rendering ran but did not produce any page image within configured caps.",
          missingRequirements: ["rendered_page_image_within_caps"],
          unresolvedNeeds: [
            {
              id: `${request.id}:rendered-image-cap`,
              observationType: "rendered_page_image",
              sourceId: params.document.id,
              conversationDocumentId: params.document.id,
              capability: "rendered_page_inspection",
              payloadType: "rendered_page_image",
              state: "unavailable",
              reason: "Rendered page output was unavailable after local rendering caps were applied.",
              noExecutionClaimed: true,
            },
          ],
          recommendedResolution: "Use a worker/container rendering runtime in WP4C if app-level rendering cannot produce a capped image.",
        })
      );
    } else {
      producerResults.push(
        buildProducerResult({
          request,
          producerId: "rendered_page_renderer",
          capabilityId: "rendered_page_inspection",
          state: "completed_with_evidence",
          observations,
          payloadType: "rendered_page_image",
          reason: "Selected PDF pages rendered into traceable image-reference SourceObservations.",
          evidenceSummary: `Rendered ${observations.length} PDF page image reference(s) with pdf-parse.`,
          metadata: {
            selectedPages,
            renderedObservationIds: observations.map((observation) => observation.id),
            imageInputIds: imageInputs.map((input) => input.id),
            rawBytesIncludedInObservations: false,
          },
        })
      );
    }
  } catch (error) {
    producerResults.push(
      buildProducerResult({
        request,
        producerId: "rendered_page_renderer",
        capabilityId: "rendered_page_inspection",
        state: "failed",
        payloadType: "rendered_page_image",
        reason: `PDF rendering failed in the app-level local adapter: ${error instanceof Error ? error.message : "unknown error"}.`,
        missingRequirements: ["successful_pdf_page_render"],
        unresolvedNeeds: [
          {
            id: `${request.id}:render-failed`,
            observationType: "rendered_page_image",
            sourceId: params.document.id,
            conversationDocumentId: params.document.id,
            capability: "rendered_page_inspection",
            payloadType: "rendered_page_image",
            state: "unavailable",
            reason: "Local PDF rendering failed before traceable image evidence was produced.",
            noExecutionClaimed: true,
          },
        ],
        recommendedResolution: "Keep app-level rendering optional and route heavier rendering failures to WP4C worker-runtime planning.",
      })
    );
  } finally {
    await runner?.destroy?.();
  }

  return { observations, producerRequests, producerResults, imageInputs };
}

function runOcrUnavailableProducer(params: UploadedDocumentLocalToolEnablementInput) {
  const request = buildProducerRequest({
    document: params.document,
    producerId: "ocr_extractor",
    capabilityId: "ocr",
    observationType: "ocr_text",
    payloadType: "ocr_text",
    reason: "Task needs OCR, but WP4A3 has no pinned app-level OCR traineddata assets and runtime downloads are forbidden.",
    sourceLocator: {
      pageNumberStart: params.pdfExtractionMetadata?.lowTextPageNumbers?.[0] ?? null,
      sourceLocationLabel: params.document.filename ?? params.document.id,
    },
    options: params.observationOptions,
    severity: "high",
    metadata: {
      tesseractJsTransitiveDependencyObserved: true,
      pinnedTrainedDataAssetsAvailable: false,
      runtimeDownloadsAllowed: false,
      systemTesseractAllowed: false,
    },
  });
  return {
    producerRequests: [request],
    producerResults: [
      buildProducerResult({
        request,
        producerId: "ocr_extractor",
        capabilityId: "ocr",
        state: "unavailable",
        payloadType: "ocr_text",
        reason:
          "Local OCR did not execute because tesseract.js traineddata/model assets are not pinned as app-level assets and runtime downloads/manual installs are forbidden.",
        missingRequirements: ["pinned_ocr_language_assets", "safe_local_ocr_runtime"],
        unresolvedNeeds: [
          {
            id: `${request.id}:ocr-runtime-gap`,
            observationType: "ocr_text",
            sourceId: params.document.id,
            conversationDocumentId: params.document.id,
            capability: "ocr",
            payloadType: "ocr_text",
            state: "unavailable",
            reason:
              "OCR text is task-needed, but no approved app-level local OCR producer can execute without runtime asset download or WP4C worker runtime.",
            noExecutionClaimed: true,
          },
        ],
        recommendedResolution:
          "Add pinned app-level tesseract.js language assets in a later pass or route system Tesseract/OCRmyPDF/PaddleOCR through WP4C worker runtime.",
      }),
    ],
  };
}

function buildDocxOutlineObservations(params: UploadedDocumentLocalToolEnablementInput & {
  selectedChunks: ContextDocumentChunk[];
}) {
  const headings = uniqueStrings(
    params.selectedChunks.flatMap((chunk) => [...chunk.headingPath, ...chunk.sectionPath].map(normalizeText))
  ).slice(0, MAX_OFFICE_OUTLINE_ITEMS);
  if (headings.length === 0) return [];
  return [
    buildObservation({
      document: params.document,
      id: `${params.document.id}:docx:outline`,
      type: "document_outline",
      sourceKind: "parsed_document",
      sourceLocator: {
        sourceLocationLabel: params.document.filename ?? params.document.id,
        sectionPath: headings,
      },
      content: `DOCX outline extracted from parser chunk structure: ${headings.join(" > ")}`,
      payloadKind: "structured",
      payload: {
        headings,
        headingCount: headings.length,
        chunkCount: params.selectedChunks.length,
        dependency: "mammoth",
        tableExtractionExecuted: false,
        conversionTool: null,
      },
      producerId: "office_document_structure_extractor",
      producerKind: "parser",
      capabilityId: "document_structure_extraction",
      executionEvidence: {
        dependency: "mammoth",
        selectedChunkCount: params.selectedChunks.length,
        headingCount: headings.length,
        source: "selected_parser_chunks",
      },
      extractionMethod: "mammoth_parser_chunk_outline",
      confidence: 0.72,
      limitations: [
        "DOCX structure is derived from parser chunk headings and section paths.",
        "No Pandoc, MarkItDown, LibreOffice, OCR, vision, or document-AI conversion executed.",
      ],
      options: params.observationOptions,
      promotionEligible: true,
      promotionReason: "Document outline can feed existing source-learning promotion policy.",
    }),
  ];
}

function buildPptxStructureObservations(params: UploadedDocumentLocalToolEnablementInput & {
  selectedChunks: ContextDocumentChunk[];
}) {
  const slides = params.selectedChunks
    .filter((chunk) => typeof chunk.slideNumber === "number" || /slide\s+\d+/i.test(chunk.safeProvenanceLabel ?? ""))
    .slice(0, MAX_SLIDE_SUMMARIES);
  if (slides.length === 0) return [];
  const observations: SourceObservation[] = [
    buildObservation({
      document: params.document,
      id: `${params.document.id}:pptx:deck-outline`,
      type: "deck_outline",
      sourceKind: "parsed_document",
      sourceLocator: { sourceLocationLabel: params.document.filename ?? params.document.id },
      content: `PPTX deck outline extracted for ${slides.length} selected slide(s).`,
      payloadKind: "structured",
      payload: {
        slideCountRepresented: slides.length,
        slideNumbers: slides.map((chunk) => chunk.slideNumber).filter((value): value is number => typeof value === "number"),
        dependency: "officeparser",
        ocrEnabled: false,
        slideRenderingExecuted: false,
      },
      producerId: "office_document_structure_extractor",
      producerKind: "parser",
      capabilityId: "document_structure_extraction",
      executionEvidence: {
        dependency: "officeparser",
        selectedSlideChunkCount: slides.length,
        source: "selected_parser_chunks",
        ocrEnabled: false,
      },
      extractionMethod: "officeparser_slide_outline",
      confidence: 0.7,
      limitations: [
        "PPTX structure is derived from text parser chunks; slide snapshots were not rendered.",
        "Officeparser OCR remains disabled and no vision or document-AI interpretation executed.",
      ],
      options: params.observationOptions,
      promotionEligible: true,
      promotionReason: "Deck outline can feed existing source-learning promotion policy.",
    }),
  ];

  for (const chunk of slides) {
    const slideNumber = chunk.slideNumber ?? null;
    observations.push(
      buildObservation({
        document: params.document,
        id: `${params.document.id}:pptx:slide:${stableSegment(slideNumber ?? chunk.chunkIndex)}`,
        type: "slide_summary",
        sourceKind: "parsed_document",
        sourceLocator: {
          sourceLocationLabel:
            chunk.safeProvenanceLabel?.trim() || `${params.document.filename ?? params.document.id} slide ${slideNumber ?? chunk.chunkIndex + 1}`,
          slideNumber,
          chunkIndex: chunk.chunkIndex,
          charStart: chunk.charStart,
          charEnd: chunk.charEnd,
          sectionPath: [...chunk.sectionPath],
          headingPath: [...chunk.headingPath],
        },
        content: capText(chunk.text, 700),
        payloadKind: "structured",
        payload: {
          slideNumber,
          chunkIndex: chunk.chunkIndex,
          dependency: "officeparser",
          notesIncludedIfPresentInParserText: true,
          ocrEnabled: false,
          slideRenderingExecuted: false,
        },
        producerId: "office_document_structure_extractor",
        producerKind: "parser",
        capabilityId: "document_structure_extraction",
        executionEvidence: {
          dependency: "officeparser",
          chunkIndex: chunk.chunkIndex,
          slideNumber,
          ocrEnabled: false,
        },
        extractionMethod: "officeparser_slide_text_summary",
        confidence: 0.68,
        limitations: [
          "Slide summary is text extraction only and not a rendered slide or visual interpretation.",
          "No OCR, semantic vision, or slide image analysis executed.",
        ],
        options: params.observationOptions,
        promotionEligible: true,
        promotionReason: "Slide text summary can feed existing source-learning promotion policy.",
      })
    );
  }
  return observations;
}

function sheetDimensions(sheet: XLSX.WorkSheet) {
  const ref = typeof sheet["!ref"] === "string" ? sheet["!ref"] : null;
  if (!ref) return null;
  const range = XLSX.utils.decode_range(ref);
  return {
    ref,
    rowCount: range.e.r - range.s.r + 1,
    columnCount: range.e.c - range.s.c + 1,
    startRow: range.s.r + 1,
    endRow: range.e.r + 1,
    startColumn: range.s.c + 1,
    endColumn: range.e.c + 1,
  };
}

function cellDisplayValue(cell: unknown) {
  const record = recordValue(cell);
  if (!record) return "";
  const formatted = stringValue(record.w);
  if (formatted) return formatted;
  const value = record.v;
  return value === null || value === undefined ? "" : String(value);
}

function formulaCells(sheet: XLSX.WorkSheet, sheetName: string) {
  const formulas: Array<{ sheetName: string; address: string; formula: string; displayedValue: string }> = [];
  for (const address of Object.keys(sheet)) {
    if (address.startsWith("!")) continue;
    const cell = recordValue(sheet[address]);
    const formula = stringValue(cell?.f);
    if (!formula) continue;
    formulas.push({
      sheetName,
      address,
      formula,
      displayedValue: cellDisplayValue(cell),
    });
    if (formulas.length >= MAX_FORMULA_CELLS) break;
  }
  return formulas;
}

function readWorkbook(fileBuffer: Buffer, document: UploadedDocumentLocalToolDocumentRef) {
  const extension = extensionFor(document.filename);
  if (extension === "csv" || extension === "tsv") {
    return XLSX.read(fileBuffer.toString("utf8"), {
      type: "string",
      raw: false,
      FS: extension === "tsv" ? "\t" : ",",
    });
  }
  return XLSX.read(fileBuffer, {
    type: "buffer",
    dense: false,
    cellFormula: true,
    cellHTML: false,
    cellStyles: false,
    cellText: true,
  });
}

function rowsForSheet(sheet: XLSX.WorkSheet) {
  return XLSX.utils
    .sheet_to_json<Array<string | number | boolean | null>>(sheet, {
      header: 1,
      raw: false,
      defval: "",
      blankrows: false,
    })
    .slice(0, MAX_SPREADSHEET_ROWS)
    .map((row) => row.slice(0, MAX_SPREADSHEET_COLUMNS).map((value) => normalizeText(String(value ?? ""))));
}

function buildSpreadsheetStructure(params: UploadedDocumentLocalToolEnablementInput) {
  const observations: SourceObservation[] = [];
  const producerRequests: SourceObservationProducerRequest[] = [];
  const producerResults: SourceObservationProducerResult[] = [];
  const request = buildProducerRequest({
    document: params.document,
    producerId: "spreadsheet_range_reader",
    capabilityId: "spreadsheet_inventory",
    observationType: "sheet_inventory",
    payloadType: "source_observation",
    reason: "WP4A3 reads bounded workbook structure, sheet dimensions, formulas-as-text, and deterministic table previews through xlsx.",
    options: params.observationOptions,
    metadata: {
      formulaEvaluation: false,
      macroExecution: false,
      pythonExecution: false,
      maxSheets: MAX_SPREADSHEET_SHEETS,
      maxRows: MAX_SPREADSHEET_ROWS,
      maxColumns: MAX_SPREADSHEET_COLUMNS,
    },
  });
  producerRequests.push(request);

  if (!params.fileBuffer || params.fileBuffer.byteLength === 0) {
    producerResults.push(
      buildProducerResult({
        request,
        producerId: "spreadsheet_range_reader",
        capabilityId: "spreadsheet_inventory",
        state: "missing",
        payloadType: "source_observation",
        reason: "Spreadsheet enrichment could not run because no uploaded-document workbook buffer was available.",
        missingRequirements: ["uploaded_spreadsheet_file_buffer"],
        recommendedResolution: "Keep workbook structure extraction inside the uploaded-document scoped file-read path.",
      })
    );
    return { observations, producerRequests, producerResults };
  }

  try {
    const workbook = readWorkbook(params.fileBuffer, params.document);
    const sheetNames = workbook.SheetNames.slice(0, MAX_SPREADSHEET_SHEETS);
    const allFormulaCells = sheetNames.flatMap((sheetName) => {
      const sheet = workbook.Sheets[sheetName];
      return sheet ? formulaCells(sheet, sheetName) : [];
    }).slice(0, MAX_FORMULA_CELLS);
    observations.push(
      buildObservation({
        document: params.document,
        id: `${params.document.id}:spreadsheet:workbook-metadata`,
        type: "workbook_metadata",
        sourceKind: "spreadsheet_source_metadata",
        sourceLocator: { sourceLocationLabel: params.document.filename ?? params.document.id },
        content: `Workbook metadata extracted for ${workbook.SheetNames.length} sheet(s); formulas were read as text only.`,
        payloadKind: "structured",
        payload: {
          sheetCount: workbook.SheetNames.length,
          sheetNames,
          formulaCellCountCapped: allFormulaCells.length,
          dependency: "xlsx",
          macroExecution: false,
          formulaEvaluation: false,
          pythonExecution: false,
        },
        producerId: "spreadsheet_range_reader",
        producerKind: "parser",
        capabilityId: "spreadsheet_inventory",
        executionEvidence: {
          dependency: "xlsx",
          sheetCount: workbook.SheetNames.length,
          sheetCountCapped: sheetNames.length,
          formulaEvaluation: false,
          macroExecution: false,
          pythonExecution: false,
        },
        extractionMethod: "xlsx_workbook_metadata",
        confidence: 0.8,
        limitations: [
          "Workbook structure only; formulas are not recalculated and macros are not executed.",
          "No Python, DuckDB, pandas, polars, or LibreOffice computation executed.",
        ],
        options: params.observationOptions,
        promotionEligible: true,
        promotionReason: "Workbook metadata can feed existing source-learning promotion policy.",
      })
    );

    for (const sheetName of sheetNames) {
      const sheet = workbook.Sheets[sheetName];
      if (!sheet) continue;
      const dimensions = sheetDimensions(sheet);
      const rows = rowsForSheet(sheet);
      observations.push(
        buildObservation({
          document: params.document,
          id: `${params.document.id}:spreadsheet:sheet:${stableSegment(sheetName)}`,
          type: "sheet_inventory",
          sourceKind: "spreadsheet_source_metadata",
          sourceLocator: {
            sourceLocationLabel: `${params.document.filename ?? params.document.id} sheet ${sheetName}`,
            sheetName,
            rowRange: dimensions ? { start: dimensions.startRow, end: Math.min(dimensions.endRow, dimensions.startRow + MAX_SPREADSHEET_ROWS - 1) } : null,
            columnRange: dimensions ? { start: dimensions.startColumn, end: Math.min(dimensions.endColumn, dimensions.startColumn + MAX_SPREADSHEET_COLUMNS - 1) } : null,
          },
          content: `Sheet ${sheetName} inventory: ${dimensions?.ref ?? "unknown range"} with ${rows.length} preview row(s).`,
          payloadKind: "structured",
          payload: {
            sheetName,
            dimensions,
            previewRows: rows,
            formulaCellCountInPreview: formulaCells(sheet, sheetName).length,
            macroExecution: false,
            formulaEvaluation: false,
            pythonExecution: false,
          },
          producerId: "spreadsheet_range_reader",
          producerKind: "parser",
          capabilityId: "spreadsheet_inventory",
          executionEvidence: {
            dependency: "xlsx",
            sheetName,
            dimensions,
            previewRowCount: rows.length,
            formulaEvaluation: false,
            macroExecution: false,
            pythonExecution: false,
          },
          extractionMethod: "xlsx_sheet_inventory",
          confidence: 0.78,
          limitations: [
            "Sheet inventory is capped and does not evaluate formulas or execute macros.",
            "Robust dataframe computation remains deferred to WP4C.",
          ],
          options: params.observationOptions,
          promotionEligible: true,
          promotionReason: "Sheet inventory can feed existing source-learning promotion policy.",
        })
      );

      if (rows.some((row) => row.some(Boolean))) {
        observations.push(
          buildObservation({
            document: params.document,
            id: `${params.document.id}:spreadsheet:table:${stableSegment(sheetName)}`,
            type: "table_extraction",
            sourceKind: "spreadsheet_source_metadata",
            sourceLocator: {
              sourceLocationLabel: `${params.document.filename ?? params.document.id} sheet ${sheetName}`,
              sheetName,
              tableId: `sheet:${sheetName}:preview`,
              rowRange: dimensions ? { start: dimensions.startRow, end: Math.min(dimensions.endRow, dimensions.startRow + rows.length - 1) } : null,
              columnRange: dimensions ? { start: dimensions.startColumn, end: Math.min(dimensions.endColumn, dimensions.startColumn + MAX_SPREADSHEET_COLUMNS - 1) } : null,
            },
            content: `Deterministic table preview extracted from sheet ${sheetName} with ${rows.length} capped row(s).`,
            payloadKind: "table",
            payload: {
              sheetName,
              tableId: `sheet:${sheetName}:preview`,
              rows,
              rowCountCapped: rows.length,
              columnCountCapped: Math.max(0, ...rows.map((row) => row.length)),
              deterministicEvidence: true,
              macroExecution: false,
              formulaEvaluation: false,
              pythonExecution: false,
            },
            producerId: "spreadsheet_range_reader",
            producerKind: "parser",
            capabilityId: "spreadsheet_inventory",
            executionEvidence: {
              dependency: "xlsx",
              sheetName,
              rowCountCapped: rows.length,
              deterministicRowsExtracted: true,
              formulaEvaluation: false,
              macroExecution: false,
              pythonExecution: false,
            },
            extractionMethod: "xlsx_sheet_to_json_table_preview",
            confidence: 0.82,
            limitations: [
              "Table extraction is a deterministic capped sheet preview, not formula recalculation or semantic table interpretation.",
              "Do not treat omitted rows or columns as absent from the workbook.",
            ],
            options: params.observationOptions,
            promotionEligible: true,
            promotionReason: "Deterministic spreadsheet table preview can feed artifact promotion policy.",
          })
        );
      }
    }

    if (allFormulaCells.length > 0) {
      observations.push(
        buildObservation({
          document: params.document,
          id: `${params.document.id}:spreadsheet:formula-map`,
          type: "spreadsheet_formula_map",
          sourceKind: "spreadsheet_source_metadata",
          sourceLocator: { sourceLocationLabel: params.document.filename ?? params.document.id },
          content: `Formula map extracted for ${allFormulaCells.length} capped formula cell(s); formulas were not evaluated.`,
          payloadKind: "structured",
          payload: {
            formulas: allFormulaCells,
            formulaEvaluation: false,
            macroExecution: false,
            pythonExecution: false,
          },
          producerId: "spreadsheet_range_reader",
          producerKind: "parser",
          capabilityId: "spreadsheet_inventory",
          executionEvidence: {
            dependency: "xlsx",
            formulaCellCountCapped: allFormulaCells.length,
            formulaEvaluation: false,
            macroExecution: false,
            pythonExecution: false,
          },
          extractionMethod: "xlsx_formula_map_text_only",
          confidence: 0.76,
          limitations: [
            "Formula strings were read without recalculation.",
            "Spreadsheet computation remains unavailable until WP4C worker runtime.",
          ],
          options: params.observationOptions,
          promotionEligible: true,
          promotionReason: "Formula presence can feed source-learning without computation.",
        })
      );
    }

    producerResults.push(
      buildProducerResult({
        request,
        producerId: "spreadsheet_range_reader",
        capabilityId: "spreadsheet_inventory",
        state: "completed_with_evidence",
        observations,
        payloadType: "source_observation",
        reason: "Bounded xlsx workbook structure extraction completed with evidence.",
        evidenceSummary: `Extracted ${observations.length} spreadsheet structure observation(s) with xlsx.`,
        metadata: {
          sheetCount: workbook.SheetNames.length,
          observationTypes: uniqueStrings(observations.map((observation) => observation.type)),
          formulaEvaluation: false,
          macroExecution: false,
          pythonExecution: false,
        },
      })
    );
  } catch (error) {
    producerResults.push(
      buildProducerResult({
        request,
        producerId: "spreadsheet_range_reader",
        capabilityId: "spreadsheet_inventory",
        state: "failed",
        payloadType: "source_observation",
        reason: `Spreadsheet structure extraction failed: ${error instanceof Error ? error.message : "unknown error"}.`,
        missingRequirements: ["readable_xlsx_workbook"],
        recommendedResolution: "Keep spreadsheet computation unavailable and defer deeper workbook analysis to WP4C.",
      })
    );
  }

  return { observations, producerRequests, producerResults };
}

function buildOfficeStructure(params: UploadedDocumentLocalToolEnablementInput & {
  selectedChunks: ContextDocumentChunk[];
}) {
  const observations =
    params.contextKind === "docx"
      ? buildDocxOutlineObservations(params)
      : params.contextKind === "pptx"
        ? buildPptxStructureObservations(params)
        : [];
  if (observations.length === 0) {
    return { observations, producerRequests: [], producerResults: [] };
  }
  const request = buildProducerRequest({
    document: params.document,
    producerId: "office_document_structure_extractor",
    capabilityId: "document_structure_extraction",
    observationType: params.contextKind === "pptx" ? "deck_outline" : "document_outline",
    payloadType: "source_observation",
    reason: "WP4A3 enriches Office parser output into bounded structural SourceObservations.",
    options: params.observationOptions,
    metadata: {
      contextKind: params.contextKind,
      conversionToolsExecuted: [],
    },
  });
  return {
    observations,
    producerRequests: [request],
    producerResults: [
      buildProducerResult({
        request,
        producerId: "office_document_structure_extractor",
        capabilityId: "document_structure_extraction",
        state: "completed_with_evidence",
        observations,
        payloadType: "source_observation",
        reason: "Office structure enrichment completed from selected parser chunks.",
        evidenceSummary: `Produced ${observations.length} Office structure observation(s).`,
        metadata: {
          contextKind: params.contextKind,
          observationTypes: uniqueStrings(observations.map((observation) => observation.type)),
          pandocExecuted: false,
          markItDownExecuted: false,
          libreOfficeExecuted: false,
        },
      }),
    ],
  };
}

function mergeProducerResults(
  target: UploadedDocumentLocalToolEnablementResult,
  next: Pick<UploadedDocumentLocalToolEnablementResult, "observations" | "producerRequests" | "producerResults"> &
    Partial<Pick<UploadedDocumentLocalToolEnablementResult, "imageInputs">>
) {
  target.observations.push(...next.observations);
  target.producerRequests.push(...next.producerRequests);
  target.producerResults.push(...next.producerResults);
  target.imageInputs.push(...(next.imageInputs ?? []));
}

function buildDebugSummary(result: Omit<UploadedDocumentLocalToolEnablementResult, "debugSummary">): UploadedDocumentLocalToolEnablementDebugSummary {
  const completedProducerIds = uniqueStrings(
    result.producerResults
      .filter((producerResult) => producerResult.state === "completed_with_evidence")
      .map((producerResult) => producerResult.producerId)
  );
  const unavailableProducerIds = uniqueStrings(
    result.producerResults
      .filter((producerResult) => producerResult.state === "unavailable" || producerResult.state === "missing")
      .map((producerResult) => producerResult.producerId)
  );
  const failedProducerIds = uniqueStrings(
    result.producerResults
      .filter((producerResult) => producerResult.state === "failed")
      .map((producerResult) => producerResult.producerId)
  );
  const renderedCount = result.observations.filter((observation) => observation.type === "rendered_page_image").length;
  const ocrCompleted = result.observations.some((observation) => observation.type === "ocr_text" || observation.type === "ocr_page_text");
  const ocrUnavailable = result.producerResults.some(
    (producerResult) => producerResult.producerId === "ocr_extractor" && producerResult.state === "unavailable"
  );
  const officeCompleted = result.observations.some(
    (observation) => observation.type === "document_outline" || observation.type === "deck_outline" || observation.type === "slide_summary"
  );
  const spreadsheetCompleted = result.observations.some(
    (observation) =>
      observation.type === "workbook_metadata" ||
      observation.type === "sheet_inventory" ||
      observation.type === "spreadsheet_formula_map"
  );
  const tableCompleted = result.observations.some((observation) => observation.type === "table_extraction");
  const tableUnresolved = result.producerResults.some((producerResult) =>
    producerResult.unresolvedNeeds.some(
      (need) => need.payloadType === "structured_table" || need.observationType === "table_extraction"
    )
  );

  return {
    executedProducerIds: completedProducerIds,
    skippedProducerIds: [],
    unavailableProducerIds,
    failedProducerIds,
    renderedPageImageInputStatus:
      renderedCount > 0
        ? "completed_with_evidence"
        : failedProducerIds.includes("rendered_page_renderer")
          ? "failed"
          : unavailableProducerIds.includes("rendered_page_renderer")
            ? "missing_input"
            : "not_needed",
    renderedPageImageInputCount: result.imageInputs.length,
    ocrStatus: ocrCompleted
      ? "completed_with_evidence"
      : failedProducerIds.includes("ocr_extractor")
        ? "failed"
        : ocrUnavailable
          ? "unavailable_runtime_install_forbidden"
          : "not_needed",
    officeStructureStatus: officeCompleted
      ? "completed_with_evidence"
      : failedProducerIds.includes("office_document_structure_extractor")
        ? "failed"
        : "not_needed",
    spreadsheetStructureStatus: spreadsheetCompleted
      ? "completed_with_evidence"
      : failedProducerIds.includes("spreadsheet_range_reader")
        ? "failed"
        : "not_needed",
    tableExtractionStatus: tableCompleted ? "completed_with_evidence" : tableUnresolved ? "unresolved_need" : "not_needed",
    newlyEnabledDependencies: renderedCount > 0 ? ["pdf-parse"] : [],
    noRuntimeInstallAttempted: true,
    noRawImageBytesInObservations: true,
    noSemanticVisionClaimedByRendering: true,
    noOcrClaimedWithoutOcrProducerEvidence: true,
  };
}

export async function runUploadedDocumentLocalToolEnablementProducers(
  params: UploadedDocumentLocalToolEnablementInput
): Promise<UploadedDocumentLocalToolEnablementResult> {
  const selectedChunks = params.selectedChunks ?? [];
  const result: UploadedDocumentLocalToolEnablementResult = {
    observations: [],
    producerRequests: [],
    producerResults: [],
    imageInputs: [],
    debugSummary: {
      executedProducerIds: [],
      skippedProducerIds: [],
      unavailableProducerIds: [],
      failedProducerIds: [],
      renderedPageImageInputStatus: "not_needed",
      renderedPageImageInputCount: 0,
      ocrStatus: "not_needed",
      officeStructureStatus: "not_needed",
      spreadsheetStructureStatus: "not_needed",
      tableExtractionStatus: "not_needed",
      newlyEnabledDependencies: [],
      noRuntimeInstallAttempted: true,
      noRawImageBytesInObservations: true,
      noSemanticVisionClaimedByRendering: true,
      noOcrClaimedWithoutOcrProducerEvidence: true,
    },
  };

  if (
    taskNeedsPdfRendering({
      contextKind: params.contextKind,
      taskPrompt: params.taskPrompt,
      pdfExtractionMetadata: params.pdfExtractionMetadata,
      selectedChunks,
      forcePdfRendering: params.forcePdfRendering,
    })
  ) {
    mergeProducerResults(result, await runPdfRenderingProducer({ ...params, selectedChunks }));
  }

  if (
    taskNeedsOcr({
      contextKind: params.contextKind,
      taskPrompt: params.taskPrompt,
      pdfExtractionMetadata: params.pdfExtractionMetadata,
    })
  ) {
    const ocr = runOcrUnavailableProducer(params);
    result.producerRequests.push(...ocr.producerRequests);
    result.producerResults.push(...ocr.producerResults);
  }

  if (
    taskNeedsOfficeStructure({
      contextKind: params.contextKind,
      taskPrompt: params.taskPrompt,
      forceOfficeStructure: params.forceOfficeStructure,
      forceSpreadsheetStructure: params.forceSpreadsheetStructure,
    })
  ) {
    if (params.contextKind === "spreadsheet") {
      mergeProducerResults(result, buildSpreadsheetStructure(params));
    } else {
      mergeProducerResults(result, buildOfficeStructure({ ...params, selectedChunks }));
    }
  }

  result.debugSummary = buildDebugSummary(result);
  return result;
}
