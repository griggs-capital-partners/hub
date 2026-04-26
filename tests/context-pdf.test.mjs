import assert from "node:assert/strict";
import path from "node:path";
import { fileURLToPath } from "node:url";
import createJiti from "jiti";
import {
  getPageAwarePdfExpectations,
  getPageAwarePdfExtractionFixture,
  getT5DeckExpectations,
  getT5DeckPdfExtractionFixture,
} from "./fixtures/context-pdf-fixtures.mjs";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const jiti = createJiti(import.meta.url, { moduleCache: false });
const {
  buildPdfContextExtractionResult,
} = jiti(path.join(__dirname, "..", "src", "lib", "context-pdf.ts"));

const tests = [];

function runTest(name, fn) {
  tests.push({ name, fn });
}

runTest("builds page-aware PDF extraction metadata conservatively", () => {
  const fixture = getPageAwarePdfExtractionFixture();
  const expectations = getPageAwarePdfExpectations();
  const result = buildPdfContextExtractionResult(fixture);

  assert.equal(result.metadata.totalPages, 3);
  assert.equal(result.metadata.extractedPageCount, 2);
  assert.deepEqual(result.metadata.lowTextPageNumbers, expectations.lowTextPageNumbers);
  assert.ok(result.metadata.partialExtraction);
  assert.equal(result.metadata.ocrStatus, "not_implemented");
  assert.equal(result.metadata.tableExtractionStatus, "used");
  assert.ok(result.metadata.suppressedHeaderLines.includes("CONFIDENTIAL"));
  assert.ok(result.metadata.suppressedFooterLines.includes("Page 1 of 3"));
  assert.ok(result.structuredRanges.some((range) => range.pageLabel === "A-1"));
  assert.ok(result.structuredRanges.some((range) => range.figureId === expectations.figureLabel));
  assert.ok(result.structuredRanges.some((range) => range.tableId === expectations.tableLabel));
  assert.match(result.text, /Quarter\tVolume/);
  assert.match(result.metadata.detail, /OCR is not implemented/i);
});

runTest("classifies T5 deck visual pages and rejects fake table candidates conservatively", () => {
  const fixture = getT5DeckPdfExtractionFixture();
  const expectations = getT5DeckExpectations();
  const result = buildPdfContextExtractionResult(fixture);
  const pages = new Map(result.metadata.pageStructures.map((page) => [page.pageNumber, page]));

  for (const [pageNumberText, expectedClassification] of Object.entries(expectations.expectedPageClassifications)) {
    const pageNumber = Number(pageNumberText);
    assert.equal(pages.get(pageNumber)?.primaryClassification, expectedClassification);
  }

  assert.equal(result.metadata.classificationCounts.true_table, 1);
  assert.equal(result.metadata.classificationCounts.table_like_schedule_or_timeline, 1);
  assert.equal(result.metadata.retainedTableSummaryCount, 0);
  assert.equal(result.metadata.rejectedTableCandidateCount >= 6, true);
  assert.match(result.metadata.detail, /Classified 1 page as true data table/i);
  assert.match(result.metadata.detail, /schedule\/timeline visuals/i);
  assert.equal(
    result.structuredRanges.some(
      (range) =>
        range.pageNumber != null &&
        range.pageNumber >= 9 &&
        range.pageNumber <= 13 &&
        range.tableId != null
    ),
    false
  );
  assert.equal(
    result.structuredRanges.some((range) => range.pageNumber === 18 && range.tableId != null),
    false
  );
  assert.deepEqual(
    pages.get(15)?.reasonCodes.includes("table_title_keyword"),
    true
  );
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
  console.log(`${passed} context-pdf test(s) passed.`);
}
