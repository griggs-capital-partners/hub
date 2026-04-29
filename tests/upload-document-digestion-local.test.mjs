import assert from "node:assert/strict";
import path from "node:path";
import { fileURLToPath } from "node:url";
import createJiti from "jiti";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const jiti = createJiti(import.meta.url, { moduleCache: false });
const {
  buildUploadedDocumentDigestionLocalBaseline,
  buildUploadedDocumentLocalDependencyInventory,
} = jiti(path.join(__dirname, "..", "src", "lib", "upload-document-digestion-local.ts"));

const tests = [];

function runTest(name, fn) {
  tests.push({ name, fn });
}

function makeDocument(overrides = {}) {
  return {
    id: overrides.id ?? "doc-a",
    conversationId: overrides.conversationId ?? "thread-a",
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
    detail:
      "Extracted readable text from 19 of 20 PDF pages. 1 page had little or no extractable text; OCR is not implemented in this pass.",
  };
}

runTest("inventories dependencies and keeps optional/external candidates non-executing", () => {
  const inventory = buildUploadedDocumentLocalDependencyInventory({
    contextKind: "pdf",
    packageDependencies: {
      "pdf-parse": "2.4.5",
      mammoth: "1.12.0",
      officeparser: "6.1.0",
      xlsx: "0.18.5",
    },
    env: {
      OPENAI_API_KEY: "configured-but-not-called",
    },
  });

  assert.equal(inventory.inspected, true);
  assert.equal(inventory.packageDependenciesInspected, true);
  assert.equal(inventory.packageInstallOrDeploymentAttempted, false);
  assert.equal(inventory.localBinaryExecutionAllowed, false);
  assert.equal(inventory.safeSandboxAvailable, false);
  assert.ok(inventory.availableDependencies.includes("pdf-parse"));
  assert.ok(inventory.missingDependencies.includes("tesseract"));
  assert.equal(
    inventory.optionalLocalTools.find((tool) => tool.toolId === "tesseract")?.availabilityState,
    "cataloged_not_installed"
  );
  assert.equal(
    inventory.optionalLocalTools.find((tool) => tool.toolId === "python-dataframe-sandbox")?.availabilityState,
    "unavailable_no_safe_sandbox"
  );
  const vision = inventory.externalCandidates.find((candidate) => candidate.toolId === "model_vision_inspector");
  assert.equal(vision?.configured, true);
  assert.equal(vision?.availabilityState, "approval_required");
  assert.equal(vision?.noExternalCallMade, true);
});

runTest("digital PDF baseline produces completed observations, local producer evidence, and capped transport", () => {
  const result = buildUploadedDocumentDigestionLocalBaseline({
    document: makeDocument(),
    contextKind: "pdf",
    selectedChunks: Array.from({ length: 12 }, (_, index) =>
      makeChunk({
        chunkIndex: index,
        pageNumberStart: index + 1,
        pageNumberEnd: index + 1,
        pageLabelStart: String(index + 1),
        pageLabelEnd: String(index + 1),
        text: index === 0 ? "Smackover Water Chemistry" : `Extracted paragraph ${index + 1}.`,
        visualClassification: index === 0 ? "true_table" : "text_heavy",
      })
    ),
    pdfExtractionMetadata: makePdfMetadata(),
    sourceMetadata: { detail: "Metadata detail.", totalPages: 20 },
    observationOptions: { conversationId: "thread-a", maxObservationsPerDocument: 12 },
    transportMaxObservations: 6,
    transportMaxObservationsPerDocument: 4,
  });

  assert.equal(result.debugSummary.inventoryInspectedBeforeProducerSelection, true);
  assert.ok(result.observations.some((observation) => observation.type === "chunk_excerpt"));
  assert.ok(result.observations.some((observation) => observation.type === "source_coverage_signal"));
  assert.equal(result.observations.some((observation) => observation.type === "ocr_text"), false);
  assert.ok(result.producerResults.some((producerResult) => producerResult.state === "completed_with_evidence"));
  assert.ok(result.debugSummary.executedLocalProducerCount <= 3);
  assert.ok(
    result.debugSummary.executedLocalProducers.some((producer) => producer.producerId === "parser_text_extraction")
  );
  assert.ok(
    result.debugSummary.executedLocalProducers.some((producer) => producer.producerId === "pdf_context_extraction")
  );
  assert.equal(result.transportSelection.selectedObservations.length, 4);
  assert.ok(result.transportSelection.cappedObservationCount > 0);
  assert.equal(result.debugSummary.noExternalCallsMade, true);
  assert.equal(result.debugSummary.noToolOutputBypassesSourceObservation, true);
  assert.equal(result.debugSummary.noExecutionClaimWithoutCompletedWithEvidence, true);
});

runTest("spreadsheet baseline stays inventory-only and defers Python computation", () => {
  const result = buildUploadedDocumentDigestionLocalBaseline({
    document: makeDocument({
      filename: "workbook.xlsx",
      mimeType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      fileType: "spreadsheet",
    }),
    contextKind: "spreadsheet",
    selectedChunks: [
      makeChunk({
        filename: "workbook.xlsx",
        sourceType: "spreadsheet",
        sheetName: "Sheet1",
        text: "### Sheet: Sheet1\nColumns: Region | Revenue\nRows:\n- North | 10\n- South | 20",
        visualClassification: null,
        visualClassificationConfidence: null,
        visualClassificationReasonCodes: [],
      }),
    ],
    observationOptions: { conversationId: "thread-a" },
  });

  const spreadsheetObservation = result.observations.find((observation) => observation.type === "spreadsheet_range");
  assert.ok(spreadsheetObservation);
  assert.equal(spreadsheetObservation.producer.producerId, "spreadsheet_range_reader");
  assert.equal(spreadsheetObservation.producer.executionState, "executed");
  assert.equal(spreadsheetObservation.payload?.pythonExecution, false);
  assert.equal(spreadsheetObservation.payload?.formulaEvaluation, false);
  assert.ok(
    result.producerResults.some(
      (producerResult) =>
        producerResult.producerId === "spreadsheet_range_reader" &&
        producerResult.state === "completed_with_evidence"
    )
  );
  assert.equal(
    result.debugSummary.producerStatesByToolCapability["python-dataframe-sandbox:spreadsheet_computation"],
    "unavailable_no_safe_sandbox"
  );
  assert.match(
    result.debugSummary.noExecutionWarnings.join("\n"),
    /Python\/DuckDB\/pandas\/polars analysis requires a safe sandbox/
  );
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
  console.log(`\n${tests.length} upload-document-digestion-local test(s) passed.`);
}
