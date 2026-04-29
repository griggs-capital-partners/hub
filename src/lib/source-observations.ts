import type { ContextDocumentChunk } from "./context-document-chunks";
import type {
  DocumentIntelligenceLocation,
  DocumentKnowledgeArtifactRecord,
} from "./document-intelligence";
import type {
  PdfContextExtractionMetadata,
  PdfPageStructureSummary,
  PdfVisualClassificationConfidence,
} from "./context-pdf";

export type SourceObservationType =
  | "document_text"
  | "document_metadata"
  | "chunk_excerpt"
  | "table_signal"
  | "table_structure_hint"
  | "extraction_warning"
  | "visual_region_hint"
  | "source_coverage_signal"
  | "artifact_reference"
  | "parser_text_excerpt"
  | "extracted_text_chunk"
  | "rendered_page_image"
  | "page_crop_image"
  | "ocr_text"
  | "vision_observation"
  | "document_ai_result"
  | "structured_table_observation"
  | "spreadsheet_range"
  | "spreadsheet_formula_map"
  | "connector_file_snapshot"
  | "tool_observation"
  | "manual_user_supplied_observation"
  | "calculation_trace_future"
  | "dataset_profile_future"
  | "computed_metric_future"
  | "validation_result_future"
  | "connector_snapshot_future"
  | "model_vision_result_future"
  | "ocr_text_future"
  | "rendered_page_result_future"
  | "python_analysis_result_future";

export type SourceObservationSourceKind =
  | "uploaded_document"
  | "parsed_document"
  | "pdf_page"
  | "spreadsheet_source_metadata"
  | "tool_output"
  | "user_supplied"
  | "system_derived"
  | "artifact_reference"
  | "connector_snapshot_future";

export type SourceObservationPayloadKind =
  | "text"
  | "structured"
  | "numeric"
  | "table"
  | "image_reference"
  | "artifact_reference"
  | "warning"
  | "empty";

export type SourceObservationProducerKind =
  | "parser"
  | "document_intelligence"
  | "artifact_memory"
  | "tool"
  | "model"
  | "transport"
  | "analysis_sandbox_future"
  | "connector_future"
  | "system";

export type SourceObservationExecutionState =
  | "executed"
  | "deterministically_derived"
  | "planned"
  | "unavailable"
  | "future";

export type SourceObservationProducer = {
  producerId: string;
  producerKind: SourceObservationProducerKind;
  capabilityId?: string | null;
  executionState: SourceObservationExecutionState;
  executionEvidence?: Record<string, unknown> | null;
  noUnavailableToolExecutionClaimed: true;
};

export type SourceObservationLocator = Partial<DocumentIntelligenceLocation> & {
  sourceLocationLabel?: string | null;
  page?: number | null;
  chunkId?: string | null;
  chunkIndex?: number | null;
  charStart?: number | null;
  charEnd?: number | null;
  section?: string | null;
  tableId?: string | null;
  sheetName?: string | null;
  rowRange?: { start: number; end: number } | null;
  columnRange?: { start: number; end: number } | null;
  boundingRegion?: Record<string, unknown> | null;
  connectorPath?: string | null;
  attributionAmbiguous?: boolean;
};

export type SourceObservationPayload =
  | Record<string, unknown>
  | Array<Record<string, unknown>>;

export type SourceObservationPromotionHints = {
  eligible?: boolean;
  bucketHints?: string[];
  reason?: string | null;
};

export type SourceObservationGapHint = {
  id: string;
  kind:
    | "missing_observation_need"
    | "missing_table_body"
    | "source_coverage_gap"
    | "missing_context_lane"
    | "missing_model_capability"
    | "missing_tool";
  capability?: string | null;
  payloadType?: string | null;
  reason: string;
  sourceId?: string | null;
  conversationDocumentId?: string | null;
  locator?: SourceObservationLocator | null;
};

export type SourceObservationNeed = {
  id: string;
  observationType: SourceObservationType | string;
  sourceId: string | null;
  conversationDocumentId?: string | null;
  capability?: string | null;
  payloadType?: string | null;
  state: "needed" | "planned" | "deferred" | "unavailable" | "approval_required";
  reason: string;
  noExecutionClaimed: true;
};

export type SourceObservation = {
  id: string;
  type: SourceObservationType;
  traceId?: string | null;
  planId?: string | null;
  conversationId?: string | null;
  messageId?: string | null;
  conversationDocumentId?: string | null;
  sourceId?: string | null;
  sourceDocumentId: string | null;
  sourceKind: SourceObservationSourceKind;
  sourceVersion: string | null;
  sourceChecksum?: string | null;
  sourceLocator: SourceObservationLocator;
  content: string;
  payloadKind: SourceObservationPayloadKind;
  payload: SourceObservationPayload | null;
  producer: SourceObservationProducer;
  extractionMethod: string;
  confidence: number | null;
  limitations: string[];
  sourceCoverageContribution?: {
    selected: boolean;
    target?: string | null;
    detail?: string | null;
  } | null;
  promotionHints?: SourceObservationPromotionHints | null;
  relatedGapHints?: SourceObservationGapHint[];
  selectedForTransport?: boolean;
  transportSelectionReason?: string | null;
  createdAt?: string | null;
};

export type SourceObservationPromotionInput = {
  id: string;
  type: SourceObservationType;
  sourceDocumentId: string;
  sourceVersion: string | null;
  sourceLocator: SourceObservationLocator;
  content: string;
  payload: SourceObservationPayload | null;
  extractionMethod: string;
  confidence: number | null;
  limitations: string[];
};

export type SourceObservationBuildOptions = {
  traceId?: string | null;
  planId?: string | null;
  conversationId?: string | null;
  messageId?: string | null;
  sourceVersion?: string | null;
  maxObservations?: number | null;
  maxObservationsPerDocument?: number | null;
  maxTextPreviewChars?: number | null;
  selectedOnly?: boolean;
  includeUnselectedInventorySummary?: boolean;
  nowIso?: string | null;
};

export type SourceObservationTransportSelection = {
  selectedObservations: SourceObservation[];
  excludedObservations: Array<{
    observationId: string;
    reason: "unavailable_or_future" | "empty_payload" | "budget_cap" | "document_cap";
    detail: string;
  }>;
  selectedObservationIds: string[];
  excludedObservationIds: string[];
  cappedObservationCount: number;
  maxObservations: number;
  maxObservationsPerDocument: number;
};

export type SourceObservationDebugSummary = {
  totalCompletedObservationCount: number;
  countsByObservationType: Record<string, number>;
  countsBySourceDocument: Record<string, number>;
  countsByProducerKind: Record<string, number>;
  selectedForTransportCount: number;
  excludedFromTransportCount: number;
  cappedOrDroppedCount: number;
  confidence: {
    min: number | null;
    max: number | null;
    average: number | null;
    missingCount: number;
  };
  limitationSummary: {
    observationCountWithLimitations: number;
    topLimitations: string[];
  };
  promotedArtifactCandidateCount: number | null;
  observationDerivedGapDebtCandidateCount: number | null;
  missingObservationNeeds: SourceObservationNeed[];
  conversationLevelObservationCount: number;
  hasAmbiguousAttribution: boolean;
  payloadPreviewSuppressed: true;
  noUnavailableToolExecutionClaimed: true;
};

type SourceObservationDocumentRef = {
  id: string;
  conversationId?: string | null;
  filename?: string | null;
  mimeType?: string | null;
  fileType?: string | null;
};

function normalizeWhitespace(value: string | null | undefined) {
  return (value ?? "").replace(/\s+/g, " ").trim();
}

function stableHash(value: string) {
  let hash = 0;
  for (let index = 0; index < value.length; index += 1) {
    hash = (hash * 31 + value.charCodeAt(index)) >>> 0;
  }
  return hash.toString(36);
}

function capText(value: string, maxChars?: number | null) {
  const normalized = normalizeWhitespace(value);
  if (!maxChars || maxChars <= 0 || normalized.length <= maxChars) {
    return normalized;
  }
  return `${normalized.slice(0, Math.max(0, maxChars - 16)).trim()} [truncated]`;
}

function increment(map: Record<string, number>, key: string | null | undefined) {
  const normalized = key?.trim() || "unknown";
  map[normalized] = (map[normalized] ?? 0) + 1;
}

function sourceKindFor(contextKind: string, chunk?: ContextDocumentChunk | null): SourceObservationSourceKind {
  if (contextKind === "pdf" || chunk?.sourceType === "pdf") return "pdf_page";
  if (contextKind === "spreadsheet" || chunk?.sourceType === "spreadsheet") return "spreadsheet_source_metadata";
  return "parsed_document";
}

function confidenceFromParserSignal(confidence: PdfVisualClassificationConfidence | null | undefined) {
  if (confidence === "high") return 0.9;
  if (confidence === "medium") return 0.72;
  if (confidence === "low") return 0.56;
  return 0.68;
}

function completedProducer(params: {
  producerId: string;
  producerKind: SourceObservationProducerKind;
  capabilityId?: string | null;
  executionState?: SourceObservationExecutionState;
  executionEvidence?: Record<string, unknown> | null;
}): SourceObservationProducer {
  return {
    producerId: params.producerId,
    producerKind: params.producerKind,
    capabilityId: params.capabilityId ?? null,
    executionState: params.executionState ?? "deterministically_derived",
    executionEvidence: params.executionEvidence ?? null,
    noUnavailableToolExecutionClaimed: true,
  };
}

function baseObservation(params: {
  id: string;
  type: SourceObservationType;
  document: SourceObservationDocumentRef;
  sourceKind: SourceObservationSourceKind;
  sourceLocator: SourceObservationLocator;
  content: string;
  payloadKind: SourceObservationPayloadKind;
  payload: SourceObservationPayload | null;
  producer: SourceObservationProducer;
  extractionMethod: string;
  confidence: number | null;
  limitations: string[];
  options?: SourceObservationBuildOptions;
  promotionHints?: SourceObservationPromotionHints | null;
  relatedGapHints?: SourceObservationGapHint[];
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
    content: capText(params.content, params.options?.maxTextPreviewChars),
    payloadKind: params.payloadKind,
    payload: params.payload,
    producer: params.producer,
    extractionMethod: params.extractionMethod,
    confidence: params.confidence,
    limitations: summarizeSourceObservationLimitations(params.limitations),
    promotionHints: params.promotionHints ?? null,
    relatedGapHints: params.relatedGapHints ?? [],
    createdAt: params.options?.nowIso ?? null,
  };
}

function limitByDocument<T extends { sourceDocumentId?: string | null; conversationDocumentId?: string | null }>(
  values: T[],
  maxPerDocument: number
) {
  if (maxPerDocument <= 0) return [];
  const counts = new Map<string, number>();
  return values.filter((value) => {
    const key = value.sourceDocumentId ?? value.conversationDocumentId ?? "conversation";
    const next = (counts.get(key) ?? 0) + 1;
    counts.set(key, next);
    return next <= maxPerDocument;
  });
}

function sourceLocationLabel(document: SourceObservationDocumentRef, chunk: ContextDocumentChunk) {
  if (chunk.safeProvenanceLabel?.trim()) {
    return `${document.filename ?? chunk.filename} - ${chunk.safeProvenanceLabel}`;
  }
  if (chunk.pageNumberStart != null) {
    return `${document.filename ?? chunk.filename} - page ${chunk.pageLabelStart ?? chunk.pageNumberStart}`;
  }
  return document.filename ?? chunk.filename ?? document.id;
}

export function normalizeSourceObservationLocator(
  locator: SourceObservationLocator | null | undefined
): SourceObservationLocator {
  return {
    pageNumberStart: locator?.pageNumberStart ?? locator?.page ?? null,
    pageNumberEnd: locator?.pageNumberEnd ?? locator?.pageNumberStart ?? locator?.page ?? null,
    pageLabelStart: locator?.pageLabelStart ?? null,
    pageLabelEnd: locator?.pageLabelEnd ?? locator?.pageLabelStart ?? null,
    tableId: locator?.tableId ?? null,
    figureId: locator?.figureId ?? null,
    sectionPath: [...(locator?.sectionPath ?? [])],
    headingPath: [...(locator?.headingPath ?? [])],
    sourceLocationLabel: locator?.sourceLocationLabel ?? null,
    page: locator?.page ?? locator?.pageNumberStart ?? null,
    chunkId: locator?.chunkId ?? null,
    chunkIndex: locator?.chunkIndex ?? null,
    charStart: locator?.charStart ?? null,
    charEnd: locator?.charEnd ?? null,
    section: locator?.section ?? null,
    sheetName: locator?.sheetName ?? null,
    rowRange: locator?.rowRange ?? null,
    columnRange: locator?.columnRange ?? null,
    boundingRegion: locator?.boundingRegion ?? null,
    connectorPath: locator?.connectorPath ?? null,
    attributionAmbiguous: locator?.attributionAmbiguous ?? false,
  };
}

export function summarizeSourceObservationLimitations(limitations: string[]) {
  return Array.from(
    new Set(
      limitations
        .map(normalizeWhitespace)
        .filter(Boolean)
    )
  );
}

export function isCompletedSourceObservation(
  observation: SourceObservation | null | undefined
): boolean {
  return (
    observation?.producer?.executionState === "executed" ||
    observation?.producer?.executionState === "deterministically_derived"
  );
}

export function summarizeObservationEvidence(observation: SourceObservation | null | undefined) {
  if (!observation) return null;
  const producer = observation.producer;
  return {
    observationId: observation.id,
    observationType: observation.type,
    sourceDocumentId: observation.sourceDocumentId ?? observation.conversationDocumentId ?? null,
    sourceKind: observation.sourceKind,
    producerId: producer?.producerId ?? null,
    producerKind: producer?.producerKind ?? null,
    capabilityId: producer?.capabilityId ?? null,
    executionState: producer?.executionState ?? null,
    hasExecutionEvidence: Boolean(producer?.executionEvidence),
    extractionMethod: observation.extractionMethod,
    locator: {
      pageNumberStart: observation.sourceLocator.pageNumberStart ?? observation.sourceLocator.page ?? null,
      pageNumberEnd: observation.sourceLocator.pageNumberEnd ?? observation.sourceLocator.page ?? null,
      tableId: observation.sourceLocator.tableId ?? null,
      sheetName: observation.sourceLocator.sheetName ?? null,
      chunkId: observation.sourceLocator.chunkId ?? null,
      attributionAmbiguous: observation.sourceLocator.attributionAmbiguous ?? false,
    },
    noUnavailableToolExecutionClaimed: true as const,
  };
}

export function assertCompletedObservationHasEvidence(observation: SourceObservation): void {
  if (!isCompletedSourceObservation(observation)) {
    throw new Error(`SourceObservation ${observation.id} is not completed with execution-backed evidence.`);
  }
  if (!observation.producer.executionEvidence && !normalizeWhitespace(observation.extractionMethod)) {
    throw new Error(`SourceObservation ${observation.id} is missing trace-safe execution evidence.`);
  }
}

export function buildSourceObservationsFromSelectedDocumentChunks(params: {
  document: SourceObservationDocumentRef;
  contextKind: string;
  chunks: ContextDocumentChunk[];
  options?: SourceObservationBuildOptions;
}): SourceObservation[] {
  const maxPerDocument = params.options?.maxObservationsPerDocument ?? params.options?.maxObservations ?? params.chunks.length;
  return params.chunks.slice(0, Math.max(0, maxPerDocument)).map((chunk) => {
    const id = `${params.document.id}:chunk:${chunk.chunkIndex}`;
    const sourceKind = sourceKindFor(params.contextKind, chunk);
    const tableLike =
      chunk.visualClassification === "true_table" ||
      chunk.visualClassification === "table_like_schedule_or_timeline";
    return baseObservation({
      id,
      type: tableLike ? "table_signal" : "chunk_excerpt",
      document: params.document,
      sourceKind,
      sourceLocator: {
        pageNumberStart: chunk.pageNumberStart,
        pageNumberEnd: chunk.pageNumberEnd,
        pageLabelStart: chunk.pageLabelStart,
        pageLabelEnd: chunk.pageLabelEnd,
        tableId: chunk.tableId,
        figureId: chunk.figureId,
        sectionPath: [...chunk.sectionPath],
        headingPath: [...chunk.headingPath],
        sourceLocationLabel: sourceLocationLabel(params.document, chunk),
        chunkId: id,
        chunkIndex: chunk.chunkIndex,
        charStart: chunk.charStart,
        charEnd: chunk.charEnd,
        sheetName: chunk.sheetName,
      },
      content: chunk.text,
      payloadKind: "text",
      payload: {
        chunkIndex: chunk.chunkIndex,
        sourceType: chunk.sourceType,
        visualClassification: chunk.visualClassification,
        visualClassificationConfidence: chunk.visualClassificationConfidence,
        visualClassificationReasonCodes: [...chunk.visualClassificationReasonCodes],
        selectedForContext: params.options?.selectedOnly !== false,
      },
      producer: completedProducer({
        producerId: params.contextKind === "pdf" ? "pdf_parser" : "document_parser",
        producerKind: "parser",
        capabilityId: params.contextKind === "pdf" ? "pdf_text_extraction" : "text_extraction",
        executionState: "executed",
        executionEvidence: {
          chunkIndex: chunk.chunkIndex,
          extractionStatus: chunk.extractionStatus,
        },
      }),
      extractionMethod: params.contextKind === "pdf" ? "parser_pdf_text_extraction" : "parser_text_extraction",
      confidence: confidenceFromParserSignal(chunk.visualClassificationConfidence),
      limitations: tableLike
        ? [
            "Parser-derived table signal may not contain structured rows, columns, or cells.",
            "No OCR, model vision, rendered-page inspection, or document-AI table recovery is implied by this observation.",
          ]
        : ["Observation is extracted parser text substrate and is not automatically durable source learning."],
      options: params.options,
      promotionHints: {
        eligible: true,
        reason: "Parser text observation can feed the existing source-learning artifact promotion policy.",
      },
      relatedGapHints: tableLike
        ? [
            {
              id: `${id}:table-body-need`,
              kind: "missing_table_body",
              capability: "document_ai_table_recovery",
              payloadType: "structured_table",
              reason: "Table-like parser signal may need rendered-page/OCR/vision/document-AI follow-up before cell-level claims.",
              sourceId: params.document.id,
              conversationDocumentId: params.document.id,
              locator: { pageNumberStart: chunk.pageNumberStart, tableId: chunk.tableId },
            },
          ]
        : [],
    });
  });
}

export function buildSourceObservationsFromDocumentMetadata(params: {
  document: SourceObservationDocumentRef;
  contextKind: string;
  sourceMetadata: Record<string, unknown> | null | undefined;
  options?: SourceObservationBuildOptions;
}): SourceObservation[] {
  const metadata = params.sourceMetadata ?? {};
  if (Object.keys(metadata).length === 0) return [];
  const contentParts = [
    `Document metadata observed for ${params.document.filename ?? params.document.id}.`,
    typeof metadata.detail === "string" ? metadata.detail : null,
  ].filter((part): part is string => Boolean(part));

  return [
    baseObservation({
      id: `${params.document.id}:metadata:${stableHash(JSON.stringify(metadata))}`,
      type: "document_metadata",
      document: params.document,
      sourceKind: sourceKindFor(params.contextKind),
      sourceLocator: {
        sourceLocationLabel: params.document.filename ?? params.document.id,
      },
      content: contentParts.join(" "),
      payloadKind: "structured",
      payload: metadata,
      producer: completedProducer({
        producerId: "document_context_metadata",
        producerKind: "parser",
        capabilityId: "document_metadata_extraction",
        executionState: "deterministically_derived",
        executionEvidence: {
          metadataKeys: Object.keys(metadata).sort(),
        },
      }),
      extractionMethod: "document_metadata_normalization",
      confidence: 1,
      limitations: [
        "Metadata observation reflects parser/debug metadata only; it is not OCR, rendered-page inspection, model vision, or connector execution.",
      ],
      options: params.options,
    }),
  ];
}

function pdfSignalContent(page: PdfPageStructureSummary) {
  return [
    `PDF page ${page.pageLabel ?? page.pageNumber} parser structure signal: ${page.primaryClassification}.`,
    page.title ? `Title: ${page.title}.` : null,
    `Confidence: ${page.confidence}.`,
    page.reasonCodes.length > 0 ? `Reason codes: ${page.reasonCodes.join(", ")}.` : null,
  ].filter((part): part is string => Boolean(part)).join(" ");
}

function pdfSignalType(page: PdfPageStructureSummary): SourceObservationType {
  if (page.primaryClassification === "true_table") return "table_signal";
  if (page.primaryClassification === "table_like_schedule_or_timeline") return "table_structure_hint";
  if (page.lowText) return "source_coverage_signal";
  return "visual_region_hint";
}

export function buildSourceObservationsFromPdfSignals(params: {
  document: SourceObservationDocumentRef;
  extractionMetadata: PdfContextExtractionMetadata | null | undefined;
  options?: SourceObservationBuildOptions;
}): SourceObservation[] {
  const metadata = params.extractionMetadata;
  if (!metadata) return [];
  const max = params.options?.maxObservationsPerDocument ?? params.options?.maxObservations ?? 12;
  const observations: SourceObservation[] = [];

  observations.push(
    baseObservation({
      id: `${params.document.id}:pdf:coverage`,
      type: "source_coverage_signal",
      document: params.document,
      sourceKind: "pdf_page",
      sourceLocator: {
        sourceLocationLabel: params.document.filename ?? params.document.id,
      },
      content: metadata.detail,
      payloadKind: "structured",
      payload: {
        totalPages: metadata.totalPages,
        extractedPageCount: metadata.extractedPageCount,
        lowTextPageNumbers: metadata.lowTextPageNumbers,
        detectedTableCount: metadata.detectedTableCount,
        retainedTableSummaryCount: metadata.retainedTableSummaryCount,
        rejectedTableCandidateCount: metadata.rejectedTableCandidateCount,
        ocrStatus: metadata.ocrStatus,
        tableExtractionStatus: metadata.tableExtractionStatus,
      },
      producer: completedProducer({
        producerId: "pdf_context_extraction",
        producerKind: "parser",
        capabilityId: "pdf_text_extraction",
        executionState: "executed",
        executionEvidence: {
          extractor: metadata.extractor,
          extractorVersion: metadata.extractorVersion,
          totalPages: metadata.totalPages,
        },
      }),
      extractionMethod: "pdf_context_extraction_metadata",
      confidence: 0.82,
      limitations: [
        "PDF coverage signal is derived from current parser metadata and does not claim OCR, model vision, or rendered-page inspection.",
      ],
      options: params.options,
      relatedGapHints: metadata.lowTextPageNumbers.length > 0
        ? [
            {
              id: `${params.document.id}:pdf:low-text-pages`,
              kind: "missing_observation_need",
              capability: "ocr",
              payloadType: "ocr_text",
              reason: "One or more PDF pages had little or no extractable text; OCR has not executed.",
              sourceId: params.document.id,
              conversationDocumentId: params.document.id,
            },
          ]
        : [],
    })
  );

  const signalPages = metadata.pageStructures
    .filter((page) =>
      page.lowText ||
      page.primaryClassification === "true_table" ||
      page.primaryClassification === "table_like_schedule_or_timeline" ||
      page.extractedTableCandidateCount > 0 ||
      page.detectedCaptionCount > 0
    )
    .slice(0, Math.max(0, max - observations.length));

  for (const page of signalPages) {
    observations.push(
      baseObservation({
        id: `${params.document.id}:pdf:page:${page.pageNumber}:signal`,
        type: pdfSignalType(page),
        document: params.document,
        sourceKind: "pdf_page",
        sourceLocator: {
          pageNumberStart: page.pageNumber,
          pageNumberEnd: page.pageNumber,
          pageLabelStart: page.pageLabel,
          pageLabelEnd: page.pageLabel,
          sourceLocationLabel: `${params.document.filename ?? params.document.id} - page ${page.pageLabel ?? page.pageNumber}`,
        },
        content: pdfSignalContent(page),
        payloadKind: "structured",
        payload: {
          title: page.title,
          primaryClassification: page.primaryClassification,
          confidence: page.confidence,
          reasonCodes: [...page.reasonCodes],
          lowText: page.lowText,
          textLineCount: page.textLineCount,
          extractedTableCandidateCount: page.extractedTableCandidateCount,
          retainedTableSummaryCount: page.retainedTableSummaryCount,
          rejectedTableCandidateCount: page.rejectedTableCandidateCount,
          detectedCaptionCount: page.detectedCaptionCount,
        },
        producer: completedProducer({
          producerId: "pdf_page_structure_classification",
          producerKind: "document_intelligence",
          capabilityId: "pdf_page_classification",
          executionState: "deterministically_derived",
          executionEvidence: {
            pageNumber: page.pageNumber,
            reasonCodes: [...page.reasonCodes],
          },
        }),
        extractionMethod: "pdf_parser_structure_classification",
        confidence: confidenceFromParserSignal(page.confidence),
        limitations: [
          "Page structure signal is based on extracted text and parser metadata, not rendered-page vision.",
          ...(page.primaryClassification === "true_table"
            ? ["Table body may still be missing unless a table_extraction artifact exists."]
            : []),
        ],
        options: params.options,
        relatedGapHints: page.primaryClassification === "true_table" && page.retainedTableSummaryCount === 0
          ? [
              {
                id: `${params.document.id}:pdf:page:${page.pageNumber}:table-body-need`,
                kind: "missing_table_body",
                capability: "document_ai_table_recovery",
                payloadType: "structured_table",
                reason: "Parser classified the page as a true table, but no retained structured table summary exists.",
                sourceId: params.document.id,
                conversationDocumentId: params.document.id,
                locator: { pageNumberStart: page.pageNumber },
              },
            ]
          : [],
      })
    );
  }

  return observations;
}

export function buildSourceObservationsFromKnowledgeArtifacts(params: {
  document: SourceObservationDocumentRef;
  artifacts: DocumentKnowledgeArtifactRecord[];
  options?: SourceObservationBuildOptions;
}): SourceObservation[] {
  const max = params.options?.maxObservationsPerDocument ?? params.options?.maxObservations ?? params.artifacts.length;
  return params.artifacts.slice(0, Math.max(0, max)).map((artifact) => {
    const type: SourceObservationType =
      artifact.kind === "table_candidate"
        ? "table_signal"
        : artifact.kind === "table_extraction"
          ? "structured_table_observation"
          : artifact.kind === "extraction_warning"
            ? "extraction_warning"
            : "artifact_reference";
    const payloadKind: SourceObservationPayloadKind =
      artifact.kind === "table_extraction"
        ? "table"
        : artifact.kind === "extraction_warning"
          ? "warning"
          : "artifact_reference";
    return baseObservation({
      id: `${params.document.id}:artifact:${artifact.artifactKey}`,
      type,
      document: params.document,
      sourceKind: "artifact_reference",
      sourceLocator: {
        ...artifact.location,
        sourceLocationLabel: artifact.sourceLocationLabel,
      },
      content: [artifact.title, artifact.summary, artifact.content].filter(Boolean).join(" "),
      payloadKind,
      payload: {
        artifactKey: artifact.artifactKey,
        kind: artifact.kind,
        status: artifact.status,
        payload: artifact.payload,
        relevanceHints: [...artifact.relevanceHints],
      },
      producer: completedProducer({
        producerId: "document_knowledge_artifact",
        producerKind: "artifact_memory",
        capabilityId: artifact.tool,
        executionState: "deterministically_derived",
        executionEvidence: {
          artifactKey: artifact.artifactKey,
          artifactKind: artifact.kind,
          status: artifact.status,
        },
      }),
      extractionMethod: artifact.tool ?? "knowledge_artifact_reference",
      confidence: artifact.confidence,
      limitations: artifact.kind === "table_candidate" || artifact.kind === "extraction_warning"
        ? [
            "Artifact reference records a source-linked limitation; it is not recovered structured table body data.",
            "No unavailable OCR, vision, rendered-page, or document-AI execution is implied.",
          ]
        : ["Artifact reference is durable source memory, not raw parser output."],
      options: params.options,
      promotionHints: {
        eligible: false,
        reason: "Existing knowledge artifacts are already durable memory and should not bypass promotion policy.",
      },
    });
  });
}

export function buildSourceObservationsFromTableSignals(params: {
  document: SourceObservationDocumentRef;
  artifacts: DocumentKnowledgeArtifactRecord[];
  options?: SourceObservationBuildOptions;
}): SourceObservation[] {
  return buildSourceObservationsFromKnowledgeArtifacts({
    ...params,
    artifacts: params.artifacts.filter((artifact) =>
      artifact.kind === "table_candidate" ||
      artifact.kind === "table_extraction" ||
      artifact.kind === "extraction_warning"
    ),
  });
}

export function mapSourceObservationToPromotionInput(
  observation: SourceObservation
): SourceObservationPromotionInput | null {
  const sourceDocumentId = observation.sourceDocumentId ?? observation.conversationDocumentId ?? observation.sourceId ?? null;
  if (!sourceDocumentId) return null;
  if (!normalizeWhitespace(observation.content)) return null;
  if (!isCompletedSourceObservation(observation)) return null;

  return {
    id: observation.id,
    type: observation.type,
    sourceDocumentId,
    sourceVersion: observation.sourceVersion,
    sourceLocator: observation.sourceLocator,
    content: observation.content,
    payload: observation.payload,
    extractionMethod: observation.extractionMethod,
    confidence: observation.confidence,
    limitations: observation.limitations,
  };
}

export function selectSourceObservationsForTransport(params: {
  observations: SourceObservation[];
  maxObservations?: number | null;
  maxObservationsPerDocument?: number | null;
}): SourceObservationTransportSelection {
  const maxObservations = Math.max(0, params.maxObservations ?? 16);
  const maxObservationsPerDocument = Math.max(1, params.maxObservationsPerDocument ?? 8);
  const excludedObservations: SourceObservationTransportSelection["excludedObservations"] = [];
  const eligible = params.observations.filter((observation) => {
    if (!isCompletedSourceObservation(observation)) {
      excludedObservations.push({
        observationId: observation.id,
        reason: "unavailable_or_future",
        detail: "Only completed or deterministically derived observations can enter transport.",
      });
      return false;
    }
    if (!normalizeWhitespace(observation.content) && observation.payloadKind !== "structured") {
      excludedObservations.push({
        observationId: observation.id,
        reason: "empty_payload",
        detail: "Observation has no transportable text or structured metadata payload.",
      });
      return false;
    }
    return true;
  });
  const perDocumentLimited = limitByDocument(eligible, maxObservationsPerDocument);
  const perDocumentSelected = new Set(perDocumentLimited.map((observation) => observation.id));

  for (const observation of eligible) {
    if (!perDocumentSelected.has(observation.id)) {
      excludedObservations.push({
        observationId: observation.id,
        reason: "document_cap",
        detail: `Source observation transport is capped at ${maxObservationsPerDocument} observation(s) per document.`,
      });
    }
  }

  const selectedRaw = perDocumentLimited.slice(0, maxObservations);
  const selected = selectedRaw.map((observation) => ({
    ...observation,
    selectedForTransport: true,
    transportSelectionReason: "Selected by capped SourceObservation transport selector.",
  }));
  const selectedIds = new Set(selected.map((observation) => observation.id));

  for (const observation of perDocumentLimited) {
    if (!selectedIds.has(observation.id)) {
      excludedObservations.push({
        observationId: observation.id,
        reason: "budget_cap",
        detail: `Source observation transport is capped at ${maxObservations} observation(s) for this resolver pass.`,
      });
    }
  }

  return {
    selectedObservations: selected,
    excludedObservations,
    selectedObservationIds: [...selectedIds],
    excludedObservationIds: excludedObservations.map((entry) => entry.observationId),
    cappedObservationCount: Math.max(0, params.observations.length - selected.length),
    maxObservations,
    maxObservationsPerDocument,
  };
}

export function buildSourceObservationNeeds(params: {
  sourceNeeds?: Array<{
    sourceId: string;
    state: string;
    coverageTarget?: string | null;
    reason: string;
    detail?: string | null;
  }>;
  capabilityNeeds?: Array<{
    capability: string;
    state: string;
    payloadTypes: string[];
    reason: string;
  }>;
  modelNeeds?: Array<{
    capability: string;
    state: string;
    unavailablePayloadTypes: string[];
    reason: string;
  }>;
}): SourceObservationNeed[] {
  const needs: SourceObservationNeed[] = [];
  for (const need of params.sourceNeeds ?? []) {
    if (need.state === "executed" || need.state === "planned") continue;
    needs.push({
      id: `source-need:${need.sourceId}:${need.coverageTarget ?? "coverage"}`,
      observationType: "source_coverage_signal",
      sourceId: need.sourceId,
      state: need.state as SourceObservationNeed["state"],
      reason: need.detail ?? need.reason,
      noExecutionClaimed: true,
    });
  }
  for (const need of params.capabilityNeeds ?? []) {
    if (need.state === "executed") continue;
    for (const payloadType of need.payloadTypes) {
      needs.push({
        id: `capability-need:${need.capability}:${payloadType}`,
        observationType: payloadType,
        sourceId: null,
        capability: need.capability,
        payloadType,
        state: need.state as SourceObservationNeed["state"],
        reason: need.reason,
        noExecutionClaimed: true,
      });
    }
  }
  for (const need of params.modelNeeds ?? []) {
    if (need.state === "executed") continue;
    for (const payloadType of need.unavailablePayloadTypes) {
      needs.push({
        id: `model-need:${need.capability}:${payloadType}`,
        observationType: payloadType,
        sourceId: null,
        capability: need.capability,
        payloadType,
        state: need.state as SourceObservationNeed["state"],
        reason: need.reason,
        noExecutionClaimed: true,
      });
    }
  }
  return needs;
}

export function buildSourceObservationDebugSummary(params: {
  observations: SourceObservation[];
  transportSelections?: SourceObservationTransportSelection[];
  promotedArtifactCandidateCount?: number | null;
  observationDerivedGapDebtCandidateCount?: number | null;
  missingObservationNeeds?: SourceObservationNeed[];
}): SourceObservationDebugSummary {
  const completed = params.observations.filter(isCompletedSourceObservation);
  const countsByObservationType: Record<string, number> = {};
  const countsBySourceDocument: Record<string, number> = {};
  const countsByProducerKind: Record<string, number> = {};
  let limitationCount = 0;
  const limitationFrequency = new Map<string, number>();
  const confidences: number[] = [];
  let missingConfidenceCount = 0;
  let conversationLevelObservationCount = 0;
  let hasAmbiguousAttribution = false;

  for (const observation of completed) {
    increment(countsByObservationType, observation.type);
    increment(countsBySourceDocument, observation.sourceDocumentId ?? observation.conversationDocumentId ?? "conversation");
    increment(countsByProducerKind, observation.producer.producerKind);
    if (!observation.sourceDocumentId || observation.sourceLocator.attributionAmbiguous) {
      conversationLevelObservationCount += 1;
      hasAmbiguousAttribution = true;
    }
    if (typeof observation.confidence === "number") {
      confidences.push(observation.confidence);
    } else {
      missingConfidenceCount += 1;
    }
    if (observation.limitations.length > 0) {
      limitationCount += 1;
      for (const limitation of observation.limitations) {
        const normalized = normalizeWhitespace(limitation);
        if (!normalized) continue;
        limitationFrequency.set(normalized, (limitationFrequency.get(normalized) ?? 0) + 1);
      }
    }
  }

  const selectedForTransportCount = params.transportSelections?.reduce(
    (sum, selection) => sum + selection.selectedObservationIds.length,
    0
  ) ?? completed.filter((observation) => observation.selectedForTransport).length;
  const excludedFromTransportCount = params.transportSelections?.reduce(
    (sum, selection) => sum + selection.excludedObservationIds.length,
    0
  ) ?? 0;
  const cappedOrDroppedCount = params.transportSelections?.reduce(
    (sum, selection) => sum + selection.cappedObservationCount,
    0
  ) ?? Math.max(0, completed.length - selectedForTransportCount);

  return {
    totalCompletedObservationCount: completed.length,
    countsByObservationType,
    countsBySourceDocument,
    countsByProducerKind,
    selectedForTransportCount,
    excludedFromTransportCount,
    cappedOrDroppedCount,
    confidence: {
      min: confidences.length > 0 ? Math.min(...confidences) : null,
      max: confidences.length > 0 ? Math.max(...confidences) : null,
      average: confidences.length > 0
        ? Number((confidences.reduce((sum, value) => sum + value, 0) / confidences.length).toFixed(3))
        : null,
      missingCount: missingConfidenceCount,
    },
    limitationSummary: {
      observationCountWithLimitations: limitationCount,
      topLimitations: [...limitationFrequency.entries()]
        .sort((left, right) => right[1] - left[1] || left[0].localeCompare(right[0]))
        .slice(0, 6)
        .map(([limitation]) => limitation),
    },
    promotedArtifactCandidateCount: params.promotedArtifactCandidateCount ?? null,
    observationDerivedGapDebtCandidateCount: params.observationDerivedGapDebtCandidateCount ?? null,
    missingObservationNeeds: params.missingObservationNeeds ?? [],
    conversationLevelObservationCount,
    hasAmbiguousAttribution,
    payloadPreviewSuppressed: true,
    noUnavailableToolExecutionClaimed: true,
  };
}
