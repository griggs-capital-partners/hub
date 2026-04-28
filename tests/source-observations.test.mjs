import assert from "node:assert/strict";
import path from "node:path";
import { fileURLToPath } from "node:url";
import createJiti from "jiti";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const jiti = createJiti(import.meta.url, { moduleCache: false });
const {
  buildSourceObservationDebugSummary,
  buildSourceObservationNeeds,
  buildSourceObservationsFromDocumentMetadata,
  buildSourceObservationsFromKnowledgeArtifacts,
  buildSourceObservationsFromPdfSignals,
  buildSourceObservationsFromSelectedDocumentChunks,
  mapSourceObservationToPromotionInput,
  selectSourceObservationsForTransport,
} = jiti(path.join(__dirname, "..", "src", "lib", "source-observations.ts"));

const tests = [];

function runTest(name, fn) {
  tests.push({ name, fn });
}

function makeDocument(overrides = {}) {
  return {
    id: overrides.id ?? "doc-a",
    conversationId: overrides.conversationId ?? "thread-1",
    filename: overrides.filename ?? "source.pdf",
    mimeType: overrides.mimeType ?? "application/pdf",
    fileType: overrides.fileType ?? "pdf",
  };
}

function makeChunk(overrides = {}) {
  return {
    sourceId: overrides.sourceId ?? "doc-a",
    attachmentId: overrides.attachmentId ?? "doc-a",
    fileId: overrides.fileId ?? "doc-a",
    sourceOrderIndex: overrides.sourceOrderIndex ?? 0,
    filename: overrides.filename ?? "source.pdf",
    sourceType: overrides.sourceType ?? "pdf",
    chunkIndex: overrides.chunkIndex ?? 0,
    text: overrides.text ?? "Smackover Water Chemistry",
    approxTokenCount: overrides.approxTokenCount ?? 8,
    charStart: overrides.charStart ?? 0,
    charEnd: overrides.charEnd ?? 25,
    extractionStatus: "extracted",
    parentSourceStatus: "used",
    safeProvenanceLabel: overrides.safeProvenanceLabel ?? "page 15",
    sectionLabel: overrides.sectionLabel ?? null,
    sectionPath: overrides.sectionPath ?? ["Smackover Water Chemistry"],
    headingPath: overrides.headingPath ?? ["Smackover Water Chemistry"],
    referencedLocationLabels: overrides.referencedLocationLabels ?? [],
    sheetName: overrides.sheetName ?? null,
    slideNumber: overrides.slideNumber ?? null,
    pageNumberStart: overrides.pageNumberStart ?? 15,
    pageNumberEnd: overrides.pageNumberEnd ?? 15,
    pageLabelStart: overrides.pageLabelStart ?? "15",
    pageLabelEnd: overrides.pageLabelEnd ?? "15",
    tableId: overrides.tableId ?? null,
    figureId: overrides.figureId ?? null,
    visualClassification: overrides.visualClassification ?? "true_table",
    visualClassificationConfidence: overrides.visualClassificationConfidence ?? "medium",
    visualClassificationReasonCodes: overrides.visualClassificationReasonCodes ?? ["table_title_keyword"],
    visualAnchorTitle: overrides.visualAnchorTitle ?? "Smackover Water Chemistry",
  };
}

function makePdfMetadata() {
  return {
    extractor: "pdf-parse",
    extractorVersion: "fixture",
    totalPages: 20,
    extractedPageCount: 19,
    lowTextPageNumbers: [4],
    lowTextPageLabels: ["4"],
    suppressedHeaderLines: [],
    suppressedFooterLines: [],
    detectedTableCount: 2,
    retainedTableSummaryCount: 0,
    rejectedTableCandidateCount: 1,
    detectedTableCaptionCount: 0,
    detectedFigureCaptionCount: 0,
    pageLabelsAvailable: true,
    partialExtraction: true,
    ocrStatus: "not_implemented",
    tableExtractionStatus: "used",
    tableExtractionDetail: null,
    classificationCounts: {
      true_table: 1,
      table_like_schedule_or_timeline: 0,
      chart_or_plot: 0,
      technical_diagram_or_well_log: 0,
      map_or_spatial_visual: 0,
      caption_or_callout: 0,
      text_heavy: 18,
      low_text_or_scanned_visual: 1,
      unknown_visual: 0,
    },
    pageStructures: [
      {
        pageNumber: 15,
        pageLabel: "15",
        title: "Smackover Water Chemistry",
        primaryClassification: "true_table",
        confidence: "medium",
        reasonCodes: ["table_title_keyword"],
        lowText: false,
        textLineCount: 2,
        extractedTableCandidateCount: 1,
        retainedTableSummaryCount: 0,
        rejectedTableCandidateCount: 1,
        detectedCaptionCount: 0,
      },
      {
        pageNumber: 4,
        pageLabel: "4",
        title: null,
        primaryClassification: "low_text_or_scanned_visual",
        confidence: "low",
        reasonCodes: ["low_text"],
        lowText: true,
        textLineCount: 0,
        extractedTableCandidateCount: 0,
        retainedTableSummaryCount: 0,
        rejectedTableCandidateCount: 0,
        detectedCaptionCount: 0,
      },
    ],
    detail: "Extracted readable text from 19 of 20 PDF pages. 1 page had little or no extractable text; OCR is not implemented in this pass.",
  };
}

function makeArtifact(overrides = {}) {
  return {
    id: overrides.id ?? "artifact-1",
    sourceDocumentId: overrides.sourceDocumentId ?? "doc-a",
    artifactKey: overrides.artifactKey ?? "table_candidate:15",
    kind: overrides.kind ?? "table_candidate",
    status: overrides.status ?? "partial",
    title: overrides.title ?? "Likely table detected on page 15",
    summary: overrides.summary ?? "Parser signals indicate a likely table.",
    content: overrides.content ?? "Likely true data table detected on page 15. The current parser did not recover a structured table body.",
    tool: overrides.tool ?? "pdf_table_candidate_detection",
    confidence: overrides.confidence ?? 0.72,
    location: overrides.location ?? {
      pageNumberStart: 15,
      pageNumberEnd: 15,
      pageLabelStart: "15",
      pageLabelEnd: "15",
      tableId: null,
      figureId: null,
      sectionPath: [],
      headingPath: [],
    },
    sourceLocationLabel: overrides.sourceLocationLabel ?? "source.pdf - page 15",
    payload: overrides.payload ?? { unresolved: ["No structured row or column body was recovered."] },
    relevanceHints: overrides.relevanceHints ?? ["table", "page 15"],
    createdAt: "2026-04-28T00:00:00.000Z",
    updatedAt: "2026-04-28T00:00:00.000Z",
    approxTokenCount: 40,
  };
}

runTest("selected parsed chunks become completed canonical SourceObservations with attribution", () => {
  const observations = buildSourceObservationsFromSelectedDocumentChunks({
    document: makeDocument(),
    contextKind: "pdf",
    chunks: [makeChunk()],
    options: { conversationId: "thread-1" },
  });

  assert.equal(observations.length, 1);
  assert.equal(observations[0].sourceDocumentId, "doc-a");
  assert.equal(observations[0].conversationDocumentId, "doc-a");
  assert.equal(observations[0].sourceLocator.pageNumberStart, 15);
  assert.equal(observations[0].producer.executionState, "executed");
  assert.equal(observations[0].producer.noUnavailableToolExecutionClaimed, true);
  assert.equal(observations[0].type, "table_signal");
});

runTest("document metadata, PDF signals, and artifacts become execution-backed observations", () => {
  const document = makeDocument();
  const metadataObservations = buildSourceObservationsFromDocumentMetadata({
    document,
    contextKind: "pdf",
    sourceMetadata: { totalPages: 20, detail: "Metadata detail." },
  });
  const pdfObservations = buildSourceObservationsFromPdfSignals({
    document,
    extractionMetadata: makePdfMetadata(),
  });
  const artifactObservations = buildSourceObservationsFromKnowledgeArtifacts({
    document,
    artifacts: [makeArtifact()],
  });

  assert.equal(metadataObservations[0].type, "document_metadata");
  assert.equal(pdfObservations.some((observation) => observation.type === "source_coverage_signal"), true);
  assert.equal(pdfObservations.some((observation) => observation.type === "table_signal"), true);
  assert.equal(artifactObservations[0].type, "table_signal");
  assert.equal(pdfObservations.every((observation) => observation.producer.executionState !== "planned"), true);
});

runTest("missing OCR and table body needs are gap hints and needs, not completed future observations", () => {
  const observations = buildSourceObservationsFromPdfSignals({
    document: makeDocument(),
    extractionMetadata: makePdfMetadata(),
  });
  const needs = buildSourceObservationNeeds({
    capabilityNeeds: [
      {
        capability: "ocr",
        state: "deferred",
        payloadTypes: ["ocr_text"],
        reason: "Low-text page needs OCR.",
      },
    ],
  });

  assert.equal(observations.some((observation) => observation.type === "ocr_text_future"), false);
  assert.equal(observations.flatMap((observation) => observation.relatedGapHints ?? []).some((hint) => hint.capability === "ocr"), true);
  assert.equal(needs[0].observationType, "ocr_text");
  assert.equal(needs[0].noExecutionClaimed, true);
});

runTest("promotion mapper preserves compatibility and rejects future/unavailable observations", () => {
  const [observation] = buildSourceObservationsFromSelectedDocumentChunks({
    document: makeDocument(),
    contextKind: "pdf",
    chunks: [makeChunk()],
  });
  const promotion = mapSourceObservationToPromotionInput(observation);
  const future = mapSourceObservationToPromotionInput({
    ...observation,
    id: "future",
    type: "ocr_text_future",
    producer: {
      ...observation.producer,
      executionState: "future",
    },
  });

  assert.equal(promotion?.sourceDocumentId, "doc-a");
  assert.equal(promotion?.sourceLocator.pageNumberStart, 15);
  assert.equal(future, null);
});

runTest("transport selector caps large observation sets without losing attribution in summary", () => {
  const observations = buildSourceObservationsFromSelectedDocumentChunks({
    document: makeDocument(),
    contextKind: "pdf",
    chunks: Array.from({ length: 12 }, (_, index) =>
      makeChunk({
        chunkIndex: index,
        pageNumberStart: index + 1,
        pageNumberEnd: index + 1,
        pageLabelStart: String(index + 1),
        pageLabelEnd: String(index + 1),
        visualClassification: "text_heavy",
        text: `Chunk ${index + 1} parser text.`,
      })
    ),
  });
  const selection = selectSourceObservationsForTransport({
    observations,
    maxObservations: 5,
    maxObservationsPerDocument: 4,
  });
  const summary = buildSourceObservationDebugSummary({
    observations,
    transportSelections: [selection],
    promotedArtifactCandidateCount: 2,
    observationDerivedGapDebtCandidateCount: 1,
  });

  assert.equal(selection.selectedObservations.length, 4);
  assert.equal(selection.cappedObservationCount, 8);
  assert.equal(summary.totalCompletedObservationCount, 12);
  assert.equal(summary.selectedForTransportCount, 4);
  assert.equal(summary.cappedOrDroppedCount, 8);
  assert.equal(summary.countsBySourceDocument["doc-a"], 12);
  assert.equal(summary.payloadPreviewSuppressed, true);
});

for (const { name, fn } of tests) {
  try {
    await fn();
    console.log(`ok - ${name}`);
  } catch (error) {
    console.error(`not ok - ${name}`);
    console.error(error);
    process.exitCode = 1;
    break;
  }
}

if (!process.exitCode) {
  console.log(`\n${tests.length} source-observations test(s) passed.`);
}
