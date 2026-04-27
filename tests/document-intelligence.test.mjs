import assert from "node:assert/strict";
import path from "node:path";
import { fileURLToPath } from "node:url";
import createJiti from "jiti";
import {
  getPageAwarePdfExtractionFixture,
  getPageAwarePdfExpectations,
  getT5DeckExpectations,
  getT5DeckPdfExtractionFixture,
} from "./fixtures/context-pdf-fixtures.mjs";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const jiti = createJiti(import.meta.url, { moduleCache: false });
const { buildPdfContextExtractionResult } = jiti(
  path.join(__dirname, "..", "src", "lib", "context-pdf.ts")
);
const {
  buildDocumentIntelligenceState,
  materializeDocumentKnowledgeArtifactRecord,
  selectDocumentKnowledgeArtifactsWithinBudget,
  synthesizePdfDocumentIntelligence,
} = jiti(path.join(__dirname, "..", "src", "lib", "document-intelligence.ts"));

const tests = [];

function runTest(name, fn) {
  tests.push({ name, fn });
}

runTest("synthesizes extracted table artifacts for parser-recovered PDF tables", () => {
  const expectations = getPageAwarePdfExpectations();
  const extraction = buildPdfContextExtractionResult(getPageAwarePdfExtractionFixture());
  const intelligence = synthesizePdfDocumentIntelligence({
    sourceDocumentId: expectations.sourceId,
    filename: expectations.filename,
    extractionMetadata: extraction.metadata,
    structuredRanges: extraction.structuredRanges,
  });

  assert.equal(intelligence.artifacts.some((artifact) => artifact.kind === "table_extraction"), true);
  assert.equal(intelligence.artifacts.some((artifact) => artifact.kind === "table_candidate"), false);
  assert.equal(intelligence.inspectionTasks.some((task) => task.kind === "inspect_table"), true);
});

runTest("creates a durable table candidate and warning for the sparse T5 page 15 table", () => {
  const expectations = getT5DeckExpectations();
  const extraction = buildPdfContextExtractionResult(getT5DeckPdfExtractionFixture());
  const intelligence = synthesizePdfDocumentIntelligence({
    sourceDocumentId: expectations.sourceId,
    filename: expectations.filename,
    extractionMetadata: extraction.metadata,
    structuredRanges: extraction.structuredRanges,
  });

  assert.equal(intelligence.artifacts.some((artifact) => artifact.artifactKey === "table_candidate:15"), true);
  assert.equal(
    intelligence.artifacts.some((artifact) => artifact.artifactKey === "extraction_warning:15:table_body_missing"),
    true
  );
  assert.equal(
    intelligence.artifacts.some(
      (artifact) => artifact.kind === "table_extraction" && artifact.location.pageNumberStart === 15
    ),
    false
  );
  const task = intelligence.inspectionTasks.find((entry) => entry.taskKey === "inspect_table_candidate:15");
  assert.ok(task);
  assert.equal(task.result?.toolTrace?.requestedCapability, "pdf_table_detection");
  assert.equal(task.result?.toolTrace?.selectedTool, "pdf_table_candidate_detection");
  assert.equal(task.result?.toolTrace?.approvalStatus, "built_in");
  assert.equal(task.result?.toolTrace?.runtimeClass, "local");
  assert.equal(task.result?.toolTrace?.sideEffectLevel, "creates_internal_artifact");
  assert.equal(task.result?.toolTrace?.benchmarkFixtureIds.includes("t5_pdf_page_15_visible_table"), true);
  assert.equal(task.result?.toolTrace?.governanceTrace?.selectedTool, "pdf_table_candidate_detection");
  assert.equal(task.result?.toolTrace?.recommendedNextCapabilities.includes("ocr"), true);
  assert.equal(task.result?.toolTrace?.executedUnapprovedTool, false);
});

runTest("ranks learned table artifacts ahead of generic source memory for table-focused questions", () => {
  const tableCandidate = materializeDocumentKnowledgeArtifactRecord({
    id: "artifact-1",
    sourceDocumentId: "doc-1",
    artifactKey: "table_candidate:15",
    kind: "table_candidate",
    status: "partial",
    title: "Likely table detected on page 15",
    summary: "Sparse water chemistry table extraction.",
    content: "Probable true data table detected on page 15. Do not infer missing columns or values.",
    tool: "pdf_page_structure_classification",
    confidence: 0.45,
    location: {
      pageNumberStart: 15,
      pageNumberEnd: 15,
      pageLabelStart: null,
      pageLabelEnd: null,
      tableId: null,
      figureId: null,
      sectionPath: [],
      headingPath: [],
    },
    sourceLocationLabel: "T5 Summary Deck V1.7ext.pdf - page 15 - Smackover Water Chemistry",
    payload: { reasonCodes: ["table_title_keyword", "title_only_table_inference"] },
    relevanceHints: ["table", "Smackover Water Chemistry"],
    createdAt: "2026-04-26T12:00:00.000Z",
    updatedAt: "2026-04-26T12:00:00.000Z",
  });
  const genericMemory = materializeDocumentKnowledgeArtifactRecord({
    id: "artifact-2",
    sourceDocumentId: "doc-1",
    artifactKey: "source_memory:1",
    kind: "source_memory",
    status: "active",
    title: "General document memory",
    summary: "A broad memory of the T5 deck.",
    content: "This deck covers regional structure, temperatures, chemistry, and timeline material.",
    tool: "parser_text_extraction",
    confidence: 0.7,
    location: {
      pageNumberStart: null,
      pageNumberEnd: null,
      pageLabelStart: null,
      pageLabelEnd: null,
      tableId: null,
      figureId: null,
      sectionPath: [],
      headingPath: [],
    },
    sourceLocationLabel: "T5 Summary Deck V1.7ext.pdf",
    payload: null,
    relevanceHints: ["summary", "deck"],
    createdAt: "2026-04-26T12:00:00.000Z",
    updatedAt: "2026-04-26T12:00:00.000Z",
  });

  const selection = selectDocumentKnowledgeArtifactsWithinBudget({
    artifacts: [genericMemory, tableCandidate],
    query: "What do we know about the water chemistry table?",
    maxTokens: 200,
    maxArtifacts: 2,
  });

  assert.equal(selection.selectedArtifacts[0]?.artifactKey, "table_candidate:15");
});

runTest("marks the document intelligence state as partial when warnings remain unresolved", () => {
  const artifact = materializeDocumentKnowledgeArtifactRecord({
    id: "artifact-1",
    sourceDocumentId: "doc-1",
    artifactKey: "extraction_warning:15:table_body_missing",
    kind: "extraction_warning",
    status: "warning",
    title: "Sparse extraction warning",
    summary: "Body extraction was incomplete.",
    content: "No structured row or column body was recovered from the parser output.",
    tool: "pdf_page_structure_classification",
    confidence: 0.45,
    location: {
      pageNumberStart: 15,
      pageNumberEnd: 15,
      pageLabelStart: null,
      pageLabelEnd: null,
      tableId: null,
      figureId: null,
      sectionPath: [],
      headingPath: [],
    },
    sourceLocationLabel: "T5 Summary Deck V1.7ext.pdf - page 15",
    payload: null,
    relevanceHints: ["warning"],
    createdAt: "2026-04-26T12:00:00.000Z",
    updatedAt: "2026-04-26T12:00:00.000Z",
  });
  const state = buildDocumentIntelligenceState({
    sourceDocumentId: "doc-1",
    sourceType: "pdf",
    filename: "T5 Summary Deck V1.7ext.pdf",
    artifacts: [artifact],
    inspectionTasks: [],
    selectedArtifactKeys: ["extraction_warning:15:table_body_missing"],
  });

  assert.equal(state.stateStatus, "partial");
  assert.equal(state.warningArtifactCount, 1);
});

let passed = 0;

for (const test of tests) {
  try {
    await test.fn();
    passed += 1;
    console.log(`ok - ${test.name}`);
  } catch (error) {
    console.error(`not ok - ${test.name}`);
    console.error(error);
    process.exitCode = 1;
    break;
  }
}

if (!process.exitCode) {
  console.log(`${passed} document-intelligence test(s) passed.`);
}
