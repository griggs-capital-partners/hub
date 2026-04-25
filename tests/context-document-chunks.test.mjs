import assert from "node:assert/strict";
import path from "node:path";
import { fileURLToPath } from "node:url";
import createJiti from "jiti";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const jiti = createJiti(import.meta.url, { moduleCache: false });
const {
  DEFAULT_DOCUMENT_CHUNK_STRATEGY,
  DEFAULT_DOCUMENT_CHUNK_RANKING_STRATEGY,
  buildDocumentChunkCandidates,
  rankDocumentChunks,
  selectDocumentChunksInOrder,
} = jiti(path.join(__dirname, "..", "src", "lib", "context-document-chunks.ts"));

function makeTestChunk({
  sourceId,
  sourceOrderIndex = 0,
  chunkIndex,
  filename = "agreement.pdf",
  sourceType = "pdf",
  text,
  charStart,
  sectionPath = [],
  sectionLabel = null,
  referencedLocationLabels = [],
}) {
  return {
    sourceId,
    attachmentId: sourceId,
    fileId: sourceId,
    sourceOrderIndex,
    filename,
    sourceType,
    chunkIndex,
    text,
    approxTokenCount: Math.max(1, Math.ceil(text.length / 4)),
    charStart,
    charEnd: charStart + text.length,
    extractionStatus: "extracted",
    parentSourceStatus: "used",
    safeProvenanceLabel: `Excerpt ${chunkIndex + 1} (chars ${charStart + 1}-${charStart + text.length})`,
    sectionLabel,
    sectionPath,
    referencedLocationLabels,
    sheetName: null,
    slideNumber: null,
  };
}

assert.equal(DEFAULT_DOCUMENT_CHUNK_STRATEGY, "thread-document-paragraphs-v1");
assert.equal(DEFAULT_DOCUMENT_CHUNK_RANKING_STRATEGY, "deterministic-query-overlap-v1");
assert.equal(buildDocumentChunkCandidates({
  sourceId: "doc-empty",
  filename: "empty.md",
  sourceType: "markdown",
  text: "   \n\n",
}).length, 0);

const longMarkdownText = [
  "# Incident Overview",
  Array.from(
    { length: 30 },
    (_, index) => `Cooling loop ${index + 1} remained steady but requires a valve inspection before restart.`
  ).join(" "),
  "## Root Cause",
  Array.from(
    { length: 28 },
    (_, index) => `Root cause note ${index + 1} ties the pressure dip to deferred maintenance on the relief assembly.`
  ).join(" "),
  "## Mitigation",
  Array.from(
    { length: 28 },
    (_, index) => `Mitigation step ${index + 1} keeps the compressor offline until verification is complete.`
  ).join(" "),
].join("\n\n");

const markdownChunks = buildDocumentChunkCandidates({
  sourceId: "doc-markdown",
  attachmentId: "doc-markdown",
  fileId: "doc-markdown",
  filename: "incident.md",
  sourceType: "markdown",
  text: longMarkdownText,
  maxChunkTokens: 80,
});

assert.ok(markdownChunks.length > 1);
assert.deepEqual(
  markdownChunks.map((chunk) => chunk.chunkIndex),
  markdownChunks.map((_, index) => index)
);
assert.ok(markdownChunks.every((chunk) => chunk.approxTokenCount > 0));
assert.ok(markdownChunks.every((chunk, index, all) => index === 0 || chunk.charStart >= all[index - 1].charEnd));
assert.match(markdownChunks[0].safeProvenanceLabel, /Excerpt 1/);
assert.ok(markdownChunks.some((chunk) => chunk.sectionLabel === "Root Cause"));

const realisticLegalAgreementText = [
  "TABLE OF CONTENTS",
  "Article V — Operator & Managing Partner ........ 9",
  "Article VII — Expenditures and Liability of Parties ........ 13",
  "Article XV — Miscellaneous ........ 17",
  "Article XVI — Other Provisions ........ 18",
  "Exhibit C — Accounting Procedure ........ 25",
  "Exhibit D — Insurance ........ 26",
  "ARTICLE V.",
  "OPERATOR & MANAGING PARTNER",
  "D. Rights and Duties of Operator",
  "1. Competitive Rates and Use of Affiliates: Operator may use affiliates at competitive rates.",
  "2. Discharge of Joint Account Obligations: The Operator shall discharge Joint Account obligations in accordance with Exhibit C and provide monthly support.",
  "3. Protection from Liens: The Operator shall protect operations for the joint account from liens incurred during operations.",
  "5. Access to Contract Area and Records: Non-Operators may review joint account records concerning Contract Area access.",
  "8. Cost Estimates: Upon written request, Operator shall furnish estimates of current and cumulative costs incurred for the joint account.",
  "9. Insurance: Operator shall maintain insurance and may charge insurance premiums to the joint account where allowed.",
  "ARTICLE VII.",
  "EXPENDITURES AND LIABILITY OF PARTIES",
  "F. Taxes",
  "Taxes charged through the Joint Account shall be allocated as provided in Exhibit C.",
  "-- 15 of 22 --",
  "-13-",
  "ARTICLE XV.",
  "MISCELLANEOUS",
  "This article covers unrelated general provisions only and does not define the joint account.",
  "ARTICLE XVI.",
  "OTHER PROVISIONS",
  "1. Existing Operator-owned equipment shall not be charged to the Joint Account unless agreed in writing.",
  "2. The term Joint Account means the shared project cost ledger and the Joint Account records charge allocations.",
  "4. Project Fees shall be charged to the Joint Account when incurred for the project.",
  "5. Each Non-Operator may audit the Joint Account and inspect Joint Account support and backup.",
].join("\n");

const pptxChunks = buildDocumentChunkCandidates({
  sourceId: "doc-slides",
  filename: "briefing.pptx",
  sourceType: "pptx",
  text: [
    "### Slide 1",
    "Content:",
    "- Compressor status is nominal.",
    "",
    "### Slide 2",
    "Content:",
    "- Maintenance backlog remains the top risk.",
  ].join("\n"),
  maxChunkTokens: 12,
});

assert.equal(pptxChunks[0].slideNumber, 1);
assert.match(pptxChunks[0].safeProvenanceLabel, /Slide 1/);

const legalAgreementChunks = buildDocumentChunkCandidates({
  sourceId: "doc-legal",
  attachmentId: "doc-legal",
  fileId: "doc-legal",
  filename: "agreement.pdf",
  sourceType: "pdf",
  text: realisticLegalAgreementText,
  maxChunkTokens: 60,
});

const tocChunk = legalAgreementChunks.find((chunk) => /TABLE OF CONTENTS/i.test(chunk.text));
const operatorChunk = legalAgreementChunks.find((chunk) => /discharge Joint Account obligations/i.test(chunk.text));
const costEstimatesChunk = legalAgreementChunks.find((chunk) => /furnish estimates of current and cumulative costs/i.test(chunk.text));
const insuranceChunk = legalAgreementChunks.find((chunk) => /maintain insurance and may charge insurance premiums/i.test(chunk.text));
const taxesChunk = legalAgreementChunks.find((chunk) => /Taxes charged through the Joint Account/i.test(chunk.text));
const clauseOneChunk = legalAgreementChunks.find((chunk) => /Existing Operator-owned equipment/i.test(chunk.text));
const definitionChunk = legalAgreementChunks.find((chunk) => /The term Joint Account means/i.test(chunk.text));
const feesChunk = legalAgreementChunks.find((chunk) => /Project Fees shall be charged to the Joint Account/i.test(chunk.text));
const auditChunk = legalAgreementChunks.find((chunk) => /Each Non-Operator may audit the Joint Account/i.test(chunk.text));

assert.ok(tocChunk);
assert.deepEqual(tocChunk.sectionPath, []);
assert.ok(operatorChunk);
assert.match(operatorChunk.sectionPath.join(" | "), /Article V/i);
assert.match(operatorChunk.sectionPath.join(" | "), /Article V\.D/i);
assert.match(operatorChunk.sectionPath.join(" | "), /Article V\.D\.2/i);
assert.doesNotMatch(operatorChunk.sectionPath.join(" | "), /Article V\.B/i);
assert.ok(operatorChunk.referencedLocationLabels.includes("Exhibit C"));
assert.ok(costEstimatesChunk);
assert.match(costEstimatesChunk.sectionPath.join(" | "), /Article V\.D\.8/i);
assert.doesNotMatch(costEstimatesChunk.sectionPath.join(" | "), /Article VII\.B/i);
assert.ok(insuranceChunk);
assert.match(insuranceChunk.sectionPath.join(" | "), /Article V\.D\.9/i);
assert.doesNotMatch(insuranceChunk.sectionPath.join(" | "), /Article VII\.B/i);
assert.ok(taxesChunk);
assert.match(taxesChunk.sectionPath.join(" | "), /Article VII/i);
assert.match(taxesChunk.sectionPath.join(" | "), /Article VII\.F/i);
assert.doesNotMatch(taxesChunk.sectionPath.join(" | "), /Article VII\.D|Article XV\b/i);
assert.ok(taxesChunk.referencedLocationLabels.includes("Exhibit C"));
assert.ok(clauseOneChunk);
assert.match(clauseOneChunk.sectionPath.join(" | "), /Article XVI\.1/i);
assert.doesNotMatch(clauseOneChunk.sectionPath.join(" | "), /Exhibit C/i);
assert.ok(definitionChunk);
assert.match(definitionChunk.sectionPath.join(" | "), /Article XVI/i);
assert.match(definitionChunk.sectionPath.join(" | "), /Other Provisions/i);
assert.match(definitionChunk.sectionPath.join(" | "), /Article XVI\.2/i);
assert.doesNotMatch(definitionChunk.sectionPath.join(" | "), /Article XV\b|Exhibit C|Exhibit D/i);
assert.ok(definitionChunk.referencedLocationLabels.length === 0 || !definitionChunk.referencedLocationLabels.includes("Exhibit C"));
assert.match(definitionChunk.safeProvenanceLabel, /Article XVI\.2/i);
assert.ok(feesChunk);
assert.match(feesChunk.sectionPath.join(" | "), /Article XVI\.4/i);
assert.doesNotMatch(feesChunk.sectionPath.join(" | "), /Article XV\b|Exhibit C|Exhibit D/i);
assert.ok(auditChunk);
assert.match(auditChunk.sectionPath.join(" | "), /Article XVI\.5/i);
assert.doesNotMatch(auditChunk.sectionPath.join(" | "), /Article XV\b|Exhibit C|Exhibit D/i);

const compoundLegalHeadingChunks = buildDocumentChunkCandidates({
  sourceId: "doc-legal-compound",
  attachmentId: "doc-legal-compound",
  fileId: "doc-legal-compound",
  filename: "compound-agreement.pdf",
  sourceType: "pdf",
  text: [
    "ARTICLE V.",
    "OPERATOR",
    "D. Rights and Duties of Operator",
    "D.2 Discharge of Joint Account Obligations",
    "The Operator shall satisfy Joint Account obligations when due and maintain supporting records.",
  ].join("\n\n"),
  maxChunkTokens: 50,
});

const compoundClauseChunk = compoundLegalHeadingChunks.find((chunk) => /satisfy Joint Account obligations/i.test(chunk.text));
assert.ok(compoundClauseChunk);
assert.match(compoundClauseChunk.sectionPath.join(" | "), /Article V\.D/i);
assert.match(compoundClauseChunk.sectionPath.join(" | "), /Article V\.D\.2/i);

const rankedLateSectionChunks = rankDocumentChunks({
  query: "maintenance backlog risk",
  chunks: buildDocumentChunkCandidates({
    sourceId: "doc-ranked",
    attachmentId: "doc-ranked",
    fileId: "doc-ranked",
    sourceOrderIndex: 0,
    filename: "operations.md",
    sourceType: "markdown",
    text: [
      "# Overview",
      Array.from(
        { length: 24 },
        () => "General startup notes cover schedules, staffing, and shift coverage."
      ).join(" "),
      "## Risk Register",
      Array.from(
        { length: 18 },
        () => "Maintenance backlog remains the top risk for the compressor restart plan."
      ).join(" "),
    ].join("\n\n"),
    maxChunkTokens: 50,
  }),
});

assert.equal(rankedLateSectionChunks.rankingEnabled, true);
assert.equal(rankedLateSectionChunks.rankingStrategy, DEFAULT_DOCUMENT_CHUNK_RANKING_STRATEGY);
assert.ok(rankedLateSectionChunks.rankedChunks[0].chunkIndex > 0);
assert.match(rankedLateSectionChunks.rankedChunks[0].text, /Maintenance backlog remains the top risk/i);
assert.ok(rankedLateSectionChunks.details[0].signalLabels.includes("phrase_overlap"));

const filenameRankedChunks = rankDocumentChunks({
  query: "pump maintenance plan",
  chunks: [
    ...buildDocumentChunkCandidates({
      sourceId: "doc-filename-1",
      sourceOrderIndex: 0,
      filename: "pump-maintenance-plan.md",
      sourceType: "markdown",
      text: "Checklist and approval steps.",
      maxChunkTokens: 40,
    }),
    ...buildDocumentChunkCandidates({
      sourceId: "doc-filename-2",
      sourceOrderIndex: 1,
      filename: "handoff-notes.md",
      sourceType: "markdown",
      text: "Checklist and approval steps.",
      maxChunkTokens: 40,
    }),
  ],
});

assert.equal(filenameRankedChunks.rankedChunks[0].sourceId, "doc-filename-1");
assert.ok(filenameRankedChunks.details[0].signalLabels.includes("filename_match"));

const slideRankedChunks = rankDocumentChunks({
  query: "slide 2 staffing risk",
  chunks: buildDocumentChunkCandidates({
    sourceId: "doc-slide-rank",
    sourceOrderIndex: 0,
    filename: "briefing.pptx",
    sourceType: "pptx",
    text: [
      "### Slide 1",
      "Content:",
      "- Operations are stable.",
      "",
      "### Slide 2",
      "Content:",
      "- Staffing risk remains open.",
    ].join("\n"),
    maxChunkTokens: 12,
  }),
});

assert.equal(slideRankedChunks.rankedChunks[0].slideNumber, 2);
assert.ok(slideRankedChunks.details[0].signalLabels.includes("slide_number_match"));

const jointAccountChunks = [
  makeTestChunk({
    sourceId: "doc-joa",
    chunkIndex: 0,
    charStart: 0,
    text: [
      "Article II Operations",
      "The Joint Account may be used for startup mobilization entries.",
    ].join("\n"),
    sectionLabel: "Article II",
    sectionPath: ["Article II — Operations"],
  }),
  makeTestChunk({
    sourceId: "doc-joa",
    chunkIndex: 1,
    charStart: 140,
    text: [
      "Article VII General Provisions",
      "Joint operating procedures and account controls are described in general terms.",
    ].join("\n"),
    sectionLabel: "Article VII",
    sectionPath: ["Article VII — General Provisions"],
  }),
  makeTestChunk({
    sourceId: "doc-joa",
    chunkIndex: 2,
    charStart: 320,
    text: [
      "Article XVI.2 Joint Account",
      "The term Joint Account means the shared project cost ledger.",
      "The Joint Account captures charge allocations, and the Joint Account supports settlement review.",
    ].join("\n"),
    sectionLabel: "Article XVI.2 — Joint Account",
    sectionPath: ["Article XVI — Other Provisions", "Article XVI.2 — Joint Account"],
  }),
  makeTestChunk({
    sourceId: "doc-joa",
    chunkIndex: 3,
    charStart: 620,
    text: [
      "Article XVI.4 Project Fees",
      "Project Fees shall be charged to the Joint Account when incurred.",
    ].join("\n"),
    sectionLabel: "Article XVI.4 — Project Fees",
    sectionPath: ["Article XVI — Other Provisions", "Article XVI.4 — Project Fees"],
  }),
  makeTestChunk({
    sourceId: "doc-joa",
    chunkIndex: 4,
    charStart: 820,
    text: [
      "Article XVI.5 Audit Rights",
      "Each Party may audit the Joint Account and inspect Joint Account records.",
    ].join("\n"),
    sectionLabel: "Article XVI.5 — Audit Rights",
    sectionPath: ["Article XVI — Other Provisions", "Article XVI.5 — Audit Rights"],
  }),
];

const occurrenceRanking = rankDocumentChunks({
  query: "Summarize what articles the joint account appears in",
  chunks: jointAccountChunks,
});

assert.equal(occurrenceRanking.rankingEnabled, true);
assert.equal(occurrenceRanking.occurrenceIntentDetected, true);
assert.equal(occurrenceRanking.occurrenceTargetPhrase, "joint account");
assert.equal(occurrenceRanking.rankedChunks[0].chunkIndex, 2);
assert.match(occurrenceRanking.rankedChunks[0].text, /The term Joint Account means/i);
assert.ok(occurrenceRanking.details[0].signalLabels.includes("exact_target_phrase_match"));
assert.ok(occurrenceRanking.details[0].signalLabels.includes("definition_context"));
assert.ok(occurrenceRanking.details[0].exactPhraseMatchCount >= 3);
assert.equal(occurrenceRanking.details[0].definitionBoostApplied, true);
assert.match(occurrenceRanking.details[0].coverageGroupKey ?? "", /section:xvi\.2/i);
assert.ok(
  occurrenceRanking.rankedChunks.findIndex((chunk) => chunk.chunkIndex === 2) <
    occurrenceRanking.rankedChunks.findIndex((chunk) => chunk.chunkIndex === 1)
);

const occurrenceSelection = selectDocumentChunksInOrder({
  chunks: occurrenceRanking.rankedChunks,
  maxChars: 500,
  selectionMode: "ranked-order",
  ranking: occurrenceRanking,
});

assert.equal(occurrenceSelection.coverageSelectionApplied, true);
assert.ok(occurrenceSelection.selectedChunks.some((chunk) => chunk.chunkIndex === 2));
assert.ok(occurrenceSelection.selectedChunks.some((chunk) => chunk.chunkIndex === 3));
assert.ok(occurrenceSelection.selectedChunks.some((chunk) => chunk.chunkIndex === 4));
assert.ok(
  occurrenceSelection.selectedDueToCoverageChunkKeys.includes("doc-joa:2") &&
    occurrenceSelection.selectedDueToCoverageChunkKeys.includes("doc-joa:3")
);

const lowSignalRanking = rankDocumentChunks({
  query: "please help",
  chunks: [
    ...buildDocumentChunkCandidates({
      sourceId: "doc-low-1",
      sourceOrderIndex: 0,
      filename: "alpha.md",
      sourceType: "markdown",
      text: "Alpha context.",
      maxChunkTokens: 20,
    }),
    ...buildDocumentChunkCandidates({
      sourceId: "doc-low-2",
      sourceOrderIndex: 1,
      filename: "beta.md",
      sourceType: "markdown",
      text: "Beta context.",
      maxChunkTokens: 20,
    }),
  ],
});

assert.equal(lowSignalRanking.rankingEnabled, false);
assert.equal(lowSignalRanking.fallbackReason, "low_signal_query");
assert.deepEqual(
  lowSignalRanking.rankedChunks.map((chunk) => [chunk.sourceOrderIndex, chunk.chunkIndex]),
  [
    [0, 0],
    [1, 0],
  ]
);

const lowSignalOccurrenceRanking = rankDocumentChunks({
  query: "which articles discuss this",
  chunks: jointAccountChunks,
});

assert.equal(lowSignalOccurrenceRanking.rankingEnabled, false);
assert.equal(lowSignalOccurrenceRanking.fallbackReason, "low_signal_query");
assert.equal(lowSignalOccurrenceRanking.occurrenceIntentDetected, true);
assert.equal(lowSignalOccurrenceRanking.occurrenceTargetPhrase, null);

const tieRankedChunks = rankDocumentChunks({
  query: "status",
  chunks: [
    {
      sourceId: "doc-tie-1",
      attachmentId: "doc-tie-1",
      fileId: "doc-tie-1",
      sourceOrderIndex: 0,
      filename: "alpha.md",
      sourceType: "markdown",
      chunkIndex: 0,
      text: "Status steady.",
      approxTokenCount: 4,
      charStart: 0,
      charEnd: 14,
      extractionStatus: "extracted",
      parentSourceStatus: "used",
      safeProvenanceLabel: "Excerpt 1 (chars 1-14)",
      sectionLabel: null,
      sectionPath: [],
      sheetName: null,
      slideNumber: null,
    },
    {
      sourceId: "doc-tie-1",
      attachmentId: "doc-tie-1",
      fileId: "doc-tie-1",
      sourceOrderIndex: 0,
      filename: "alpha.md",
      sourceType: "markdown",
      chunkIndex: 1,
      text: "Status steady.",
      approxTokenCount: 4,
      charStart: 15,
      charEnd: 29,
      extractionStatus: "extracted",
      parentSourceStatus: "used",
      safeProvenanceLabel: "Excerpt 2 (chars 16-29)",
      sectionLabel: null,
      sectionPath: [],
      sheetName: null,
      slideNumber: null,
    },
    {
      sourceId: "doc-tie-2",
      attachmentId: "doc-tie-2",
      fileId: "doc-tie-2",
      sourceOrderIndex: 1,
      filename: "beta.md",
      sourceType: "markdown",
      chunkIndex: 0,
      text: "Status steady.",
      approxTokenCount: 4,
      charStart: 0,
      charEnd: 14,
      extractionStatus: "extracted",
      parentSourceStatus: "used",
      safeProvenanceLabel: "Excerpt 1 (chars 1-14)",
      sectionLabel: null,
      sectionPath: [],
      sheetName: null,
      slideNumber: null,
    },
  ],
});

assert.deepEqual(
  tieRankedChunks.rankedChunks.map((chunk) => [chunk.sourceOrderIndex, chunk.chunkIndex]),
  [
    [0, 0],
    [0, 1],
    [1, 0],
  ]
);

const selection = selectDocumentChunksInOrder({
  chunks: buildDocumentChunkCandidates({
    sourceId: "doc-budget",
    filename: "budget.txt",
    sourceType: "text",
    text: "A".repeat(2_400),
    maxChunkTokens: 50,
  }),
  maxChars: 360,
});

assert.equal(selection.selectionMode, "document-order");
assert.equal(selection.selectedChunks.length, 2);
assert.equal(selection.selectedChunks[1].wasBudgetClamped, true);
assert.equal(selection.usedBudgetClamp, true);
assert.equal(selection.selectedChunks[1].text.length, 160);

console.log("ok - context document chunks stay deterministic and preserve chunk provenance");
