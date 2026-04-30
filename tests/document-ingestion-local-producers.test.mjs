import assert from "node:assert/strict";
import path from "node:path";
import { fileURLToPath } from "node:url";
import * as XLSX from "xlsx";
import createJiti from "jiti";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const jiti = createJiti(import.meta.url, { moduleCache: false });
const {
  runUploadedDocumentLocalToolEnablementProducers,
} = jiti(path.join(__dirname, "..", "src", "lib", "document-ingestion-local-producers.ts"));
const {
  buildUploadedDocumentDigestionLocalBaseline,
} = jiti(path.join(__dirname, "..", "src", "lib", "upload-document-digestion-local.ts"));

const tests = [];

function runTest(name, fn) {
  tests.push({ name, fn });
}

function makeDocument(overrides = {}) {
  return {
    id: overrides.id ?? "doc-wp4a3",
    conversationId: overrides.conversationId ?? "conv-wp4a3",
    filename: overrides.filename ?? "source.pdf",
    mimeType: overrides.mimeType ?? "application/pdf",
    fileType: overrides.fileType ?? "pdf",
  };
}

function makeChunk(overrides = {}) {
  return {
    sourceId: overrides.sourceId ?? "doc-wp4a3",
    attachmentId: overrides.attachmentId ?? "doc-wp4a3",
    fileId: overrides.fileId ?? "doc-wp4a3",
    sourceOrderIndex: overrides.sourceOrderIndex ?? 0,
    filename: overrides.filename ?? "source.pdf",
    sourceType: overrides.sourceType ?? "pdf",
    chunkIndex: overrides.chunkIndex ?? 0,
    text: overrides.text ?? "A selected chunk with a table-like visual signal.",
    approxTokenCount: overrides.approxTokenCount ?? 10,
    charStart: overrides.charStart ?? 0,
    charEnd: overrides.charEnd ?? 50,
    extractionStatus: "extracted",
    parentSourceStatus: "used",
    safeProvenanceLabel: overrides.safeProvenanceLabel ?? "page 1",
    sectionLabel: overrides.sectionLabel ?? null,
    sectionPath: overrides.sectionPath ?? [],
    headingPath: overrides.headingPath ?? [],
    referencedLocationLabels: overrides.referencedLocationLabels ?? [],
    sheetName: overrides.sheetName ?? null,
    slideNumber: overrides.slideNumber ?? null,
    pageNumberStart: overrides.pageNumberStart ?? 1,
    pageNumberEnd: overrides.pageNumberEnd ?? 1,
    pageLabelStart: overrides.pageLabelStart ?? "1",
    pageLabelEnd: overrides.pageLabelEnd ?? "1",
    tableId: overrides.tableId ?? null,
    figureId: overrides.figureId ?? null,
    visualClassification: overrides.visualClassification ?? "true_table",
    visualClassificationConfidence: overrides.visualClassificationConfidence ?? "medium",
    visualClassificationReasonCodes: overrides.visualClassificationReasonCodes ?? ["table_title_keyword"],
    visualAnchorTitle: overrides.visualAnchorTitle ?? null,
  };
}

function makePdfBuffer() {
  return Buffer.from(
    "%PDF-1.1\n" +
      "1 0 obj<< /Type /Catalog /Pages 2 0 R >>endobj\n" +
      "2 0 obj<< /Type /Pages /Kids [3 0 R] /Count 1 >>endobj\n" +
      "3 0 obj<< /Type /Page /Parent 2 0 R /MediaBox [0 0 200 200] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>endobj\n" +
      "4 0 obj<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>endobj\n" +
      "5 0 obj<< /Length 44 >>stream\n" +
      "BT /F1 18 Tf 20 100 Td (Hello WP4A3) Tj ET\n" +
      "endstream\n" +
      "endobj\n" +
      "xref\n" +
      "0 6\n" +
      "0000000000 65535 f \n" +
      "trailer<< /Root 1 0 R /Size 6 >>\n" +
      "startxref\n" +
      "0\n" +
      "%%EOF"
  );
}

function makePdfMetadata() {
  return {
    extractor: "pdf-parse",
    extractorVersion: "fixture",
    totalPages: 1,
    extractedPageCount: 1,
    lowTextPageNumbers: [],
    lowTextPageLabels: [],
    suppressedHeaderLines: [],
    suppressedFooterLines: [],
    detectedTableCount: 1,
    retainedTableSummaryCount: 0,
    rejectedTableCandidateCount: 0,
    detectedTableCaptionCount: 0,
    detectedFigureCaptionCount: 0,
    pageLabelsAvailable: true,
    partialExtraction: false,
    ocrStatus: "not_implemented",
    tableExtractionStatus: "used",
    tableExtractionDetail: null,
    classificationCounts: {},
    pageStructures: [
      {
        pageNumber: 1,
        pageLabel: "1",
        title: "Hello WP4A3",
        primaryClassification: "true_table",
        confidence: "medium",
        reasonCodes: ["table_title_keyword"],
        lowText: false,
        textLineCount: 1,
        extractedTableCandidateCount: 1,
        retainedTableSummaryCount: 0,
        rejectedTableCandidateCount: 0,
        detectedCaptionCount: 0,
      },
    ],
    detail: "Fixture PDF metadata.",
  };
}

function makeWorkbookBuffer() {
  const workbook = XLSX.utils.book_new();
  const sheet = XLSX.utils.aoa_to_sheet([
    ["Region", "Revenue", "Projected"],
    ["North", 10, { f: "B2*2", v: 20 }],
    ["South", 20, { f: "B3*2", v: 40 }],
  ]);
  XLSX.utils.book_append_sheet(workbook, sheet, "Revenue");
  return XLSX.write(workbook, { type: "buffer", bookType: "xlsx" });
}

runTest("renders selected PDF pages into traceable image-reference observations without raw image payloads", async () => {
  const result = await runUploadedDocumentLocalToolEnablementProducers({
    document: makeDocument(),
    contextKind: "pdf",
    fileBuffer: makePdfBuffer(),
    selectedChunks: [makeChunk()],
    pdfExtractionMetadata: makePdfMetadata(),
    taskPrompt: "Render page 1 so the vision path can inspect the figure.",
    forcePdfRendering: true,
    observationOptions: { conversationId: "conv-wp4a3", traceId: "trace-wp4a3", planId: "plan-wp4a3" },
  });

  assert.equal(result.debugSummary.renderedPageImageInputStatus, "completed_with_evidence");
  assert.equal(result.observations.length, 1);
  assert.equal(result.observations[0].type, "rendered_page_image");
  assert.equal(result.observations[0].payloadKind, "image_reference");
  assert.equal(result.observations[0].producer.producerId, "rendered_page_renderer");
  assert.equal(result.observations[0].producer.executionState, "executed");
  assert.equal(result.observations[0].sourceLocator.pageNumberStart, 1);
  assert.equal(result.observations[0].payload.dataUrlIncludedInObservation, false);
  assert.equal("dataUrl" in result.observations[0].payload, false);
  assert.equal(result.imageInputs.length, 1);
  assert.equal(result.imageInputs[0].renderedPageImage, true);
  assert.ok(result.imageInputs[0].dataUrl.startsWith("data:image/png;base64,"));
  assert.equal(result.producerResults[0].state, "completed_with_evidence");
});

runTest("local OCR remains unavailable without creating fake OCR observations", async () => {
  const result = await runUploadedDocumentLocalToolEnablementProducers({
    document: makeDocument(),
    contextKind: "pdf",
    selectedChunks: [makeChunk({ visualClassification: "low_text_or_scanned_visual" })],
    pdfExtractionMetadata: { ...makePdfMetadata(), lowTextPageNumbers: [1], lowTextPageLabels: ["1"] },
    taskPrompt: "Run OCR on the scanned page.",
  });

  assert.equal(result.observations.some((observation) => observation.type === "ocr_text"), false);
  assert.equal(result.debugSummary.ocrStatus, "unavailable_runtime_install_forbidden");
  assert.equal(result.producerResults.some((producerResult) => producerResult.producerId === "ocr_extractor"), true);
  assert.equal(
    result.producerResults.find((producerResult) => producerResult.producerId === "ocr_extractor").state,
    "unavailable"
  );
  assert.match(JSON.stringify(result.producerResults), /pinned_ocr_language_assets|runtime downloads/);
});

runTest("spreadsheet enrichment emits workbook sheet table and formula observations without computation", async () => {
  const result = await runUploadedDocumentLocalToolEnablementProducers({
    document: makeDocument({
      filename: "revenue.xlsx",
      mimeType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      fileType: "spreadsheet",
    }),
    contextKind: "spreadsheet",
    fileBuffer: makeWorkbookBuffer(),
    selectedChunks: [makeChunk({ sourceType: "spreadsheet", filename: "revenue.xlsx", sheetName: "Revenue" })],
    taskPrompt: "Summarize the workbook sheets, formulas, and table data.",
    forceSpreadsheetStructure: true,
  });

  const types = result.observations.map((observation) => observation.type);
  assert.equal(types.includes("workbook_metadata"), true);
  assert.equal(types.includes("sheet_inventory"), true);
  assert.equal(types.includes("table_extraction"), true);
  assert.equal(types.includes("spreadsheet_formula_map"), true);
  assert.equal(result.debugSummary.spreadsheetStructureStatus, "completed_with_evidence");
  assert.equal(result.debugSummary.tableExtractionStatus, "completed_with_evidence");

  const table = result.observations.find((observation) => observation.type === "table_extraction");
  assert.equal(table.sourceLocator.sheetName, "Revenue");
  assert.equal(table.payload.formulaEvaluation, false);
  assert.equal(table.payload.macroExecution, false);
  assert.equal(table.payload.pythonExecution, false);
});

runTest("DOCX and PPTX structure enrichment preserves section and slide attribution", async () => {
  const docx = await runUploadedDocumentLocalToolEnablementProducers({
    document: makeDocument({ filename: "brief.docx", mimeType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document", fileType: "document" }),
    contextKind: "docx",
    selectedChunks: [
      makeChunk({
        sourceType: "docx",
        filename: "brief.docx",
        headingPath: ["Executive Summary"],
        sectionPath: ["Executive Summary"],
        visualClassification: "text_heavy",
      }),
    ],
    taskPrompt: "Summarize the document outline.",
    forceOfficeStructure: true,
  });
  assert.equal(docx.observations.some((observation) => observation.type === "document_outline"), true);
  assert.equal(docx.observations[0].sourceLocator.sectionPath.includes("Executive Summary"), true);

  const pptx = await runUploadedDocumentLocalToolEnablementProducers({
    document: makeDocument({ filename: "deck.pptx", mimeType: "application/vnd.openxmlformats-officedocument.presentationml.presentation", fileType: "document" }),
    contextKind: "pptx",
    selectedChunks: [
      makeChunk({
        sourceType: "pptx",
        filename: "deck.pptx",
        slideNumber: 2,
        safeProvenanceLabel: "slide 2",
        text: "Slide 2: Market outlook",
        visualClassification: "text_heavy",
      }),
    ],
    taskPrompt: "Summarize the deck slides.",
    forceOfficeStructure: true,
  });
  const slide = pptx.observations.find((observation) => observation.type === "slide_summary");
  assert.ok(slide);
  assert.equal(slide.sourceLocator.slideNumber, 2);
  assert.equal(slide.payload.ocrEnabled, false);
  assert.equal(slide.payload.slideRenderingExecuted, false);
});

runTest("enriched observations flow through local baseline transport caps and debug summary", async () => {
  const enrichment = await runUploadedDocumentLocalToolEnablementProducers({
    document: makeDocument(),
    contextKind: "pdf",
    fileBuffer: makePdfBuffer(),
    selectedChunks: [makeChunk()],
    pdfExtractionMetadata: makePdfMetadata(),
    taskPrompt: "Render page 1 for visual inspection.",
    forcePdfRendering: true,
  });
  const baseline = buildUploadedDocumentDigestionLocalBaseline({
    document: makeDocument(),
    contextKind: "pdf",
    selectedChunks: [makeChunk()],
    pdfExtractionMetadata: makePdfMetadata(),
    enrichmentObservations: enrichment.observations,
    enrichmentProducerRequests: enrichment.producerRequests,
    enrichmentProducerResults: enrichment.producerResults,
    transportMaxObservations: 2,
    transportMaxObservationsPerDocument: 2,
  });

  assert.equal(baseline.observations.some((observation) => observation.type === "rendered_page_image"), true);
  assert.equal(
    baseline.producerResults.some(
      (producerResult) =>
        producerResult.producerId === "rendered_page_renderer" &&
        producerResult.state === "completed_with_evidence"
    ),
    true
  );
  assert.equal(baseline.debugSummary.localToolEnablement.renderedPageImageInputStatus, "completed_with_evidence");
  assert.equal(baseline.transportSelection.selectedObservations.length, 2);
  assert.ok(baseline.transportSelection.cappedObservationCount > 0);
});

for (const { name, fn } of tests) {
  try {
    await fn();
    console.log(`ok - ${name}`);
  } catch (error) {
    console.error(`not ok - ${name}`);
    console.error(error);
    process.exitCode = 1;
  }
}
