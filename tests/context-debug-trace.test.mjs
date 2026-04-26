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
const { buildConversationContextDebugTrace } = jiti(
  path.join(__dirname, "..", "src", "lib", "context-debug-trace.ts")
);
const { buildDocumentChunkCandidates, rankDocumentChunks } = jiti(
  path.join(__dirname, "..", "src", "lib", "context-document-chunks.ts")
);
const { buildPdfContextExtractionResult } = jiti(
  path.join(__dirname, "..", "src", "lib", "context-pdf.ts")
);

function makeAuthority(overrides = {}) {
  return {
    requestingUserId: overrides.requestingUserId ?? "user-1",
    activeUserIds: overrides.activeUserIds ?? ["user-1"],
    activeAgentId: overrides.activeAgentId ?? "agent-1",
    activeAgentIds: overrides.activeAgentIds ?? ["agent-1"],
  };
}

function makeSourceDecision(overrides = {}) {
  return {
    sourceId: overrides.sourceId ?? "thread_documents",
    label: overrides.label ?? "Thread Documents",
    request: {
      status: overrides.request?.status ?? "candidate",
      mode: overrides.request?.mode ?? "default",
      origins: overrides.request?.origins ?? ["default_system_candidate"],
      detail: overrides.request?.detail ?? "Default thread candidate.",
    },
    admission: {
      status: overrides.admission?.status ?? "allowed",
    },
    execution: {
      status: overrides.execution?.status ?? "executed",
      detail: overrides.execution?.detail ?? "Thread documents were evaluated for this resolver pass.",
      summary: overrides.execution?.summary ?? {
        totalCount: 0,
        usedCount: 0,
        unsupportedCount: 0,
        failedCount: 0,
        unavailableCount: 0,
        excludedCategories: [],
      },
    },
    exclusion: overrides.exclusion ?? null,
    status: overrides.status ?? "allowed",
    reason: overrides.reason ?? "allowed",
    detail: overrides.detail ?? "Allowed by the current policy.",
    domain: overrides.domain ?? "thread_documents",
    scope: overrides.scope ?? "thread",
    policyMode: overrides.policyMode ?? "thread_active_membership",
    eligibility: {
      isRegistered: overrides.eligibility?.isRegistered ?? true,
      isInScope: overrides.eligibility?.isInScope ?? true,
      isAvailable: overrides.eligibility?.isAvailable ?? true,
      isRequestingUserAllowed: overrides.eligibility?.isRequestingUserAllowed ?? true,
      isActiveAgentAllowed: overrides.eligibility?.isActiveAgentAllowed ?? true,
      isImplemented: overrides.eligibility?.isImplemented ?? true,
    },
  };
}

function makeChunkRange(overrides = {}) {
  return {
    chunkIndex: overrides.chunkIndex ?? 0,
    charStart: overrides.charStart ?? 0,
    charEnd: overrides.charEnd ?? 40,
    approxTokenCount: overrides.approxTokenCount ?? 10,
    textPreview: overrides.textPreview ?? "Preview text only.",
    safeProvenanceLabel: overrides.safeProvenanceLabel ?? "Excerpt 1 (chars 1-40)",
    sectionLabel: overrides.sectionLabel ?? null,
    sectionPath: overrides.sectionPath ?? [],
    headingPath: overrides.headingPath ?? overrides.sectionPath ?? [],
    sourceBodyLocationLabel:
      overrides.sourceBodyLocationLabel ?? "notes.md — Excerpt 1 (chars 1-40)",
    referencedLocationLabels: overrides.referencedLocationLabels ?? [],
    sheetName: overrides.sheetName ?? null,
    slideNumber: overrides.slideNumber ?? null,
    pageNumberStart: overrides.pageNumberStart ?? null,
    pageNumberEnd: overrides.pageNumberEnd ?? overrides.pageNumberStart ?? null,
    pageLabelStart: overrides.pageLabelStart ?? null,
    pageLabelEnd: overrides.pageLabelEnd ?? overrides.pageLabelStart ?? null,
    tableId: overrides.tableId ?? null,
    figureId: overrides.figureId ?? null,
    visualClassification: overrides.visualClassification ?? null,
    visualClassificationConfidence: overrides.visualClassificationConfidence ?? null,
    visualClassificationReasonCodes: overrides.visualClassificationReasonCodes ?? [],
    visualAnchorTitle: overrides.visualAnchorTitle ?? null,
    rankingScore: overrides.rankingScore ?? 0,
    rankingSignals: overrides.rankingSignals ?? [],
    rankingOrder: overrides.rankingOrder ?? 0,
    exactPhraseMatchCount: overrides.exactPhraseMatchCount ?? 0,
    definitionBoostApplied: overrides.definitionBoostApplied ?? false,
    coverageGroupKey: overrides.coverageGroupKey ?? null,
    selectedDueToCoverage: overrides.selectedDueToCoverage ?? false,
  };
}

function makeDebugDocument(overrides = {}) {
  const chunkCharRanges = overrides.chunkCharRanges ?? [makeChunkRange()];

  return {
    sourceId: overrides.sourceId ?? "doc-1",
    attachmentId: overrides.attachmentId ?? overrides.sourceId ?? "doc-1",
    fileId: overrides.fileId ?? overrides.sourceId ?? "doc-1",
    filename: overrides.filename ?? "notes.md",
    sourceType: overrides.sourceType ?? "markdown",
    parentSourceStatus: overrides.parentSourceStatus ?? "used",
    extractionStatus: overrides.extractionStatus ?? "extracted",
    extractionDetail: overrides.extractionDetail,
    sourceMetadata: overrides.sourceMetadata,
    totalChunks: overrides.totalChunks ?? chunkCharRanges.length,
    selectedChunkIndexes: overrides.selectedChunkIndexes ?? [0],
    skippedChunkIndexes: overrides.skippedChunkIndexes ?? [],
    selectedApproxTokenCount: overrides.selectedApproxTokenCount ?? chunkCharRanges[0].approxTokenCount,
    totalApproxTokenCount:
      overrides.totalApproxTokenCount ??
      chunkCharRanges.reduce((sum, chunk) => sum + chunk.approxTokenCount, 0),
    selectedCharCount: overrides.selectedCharCount ?? 40,
    totalCharCount: overrides.totalCharCount ?? 40,
    documentBudgetTokens: overrides.documentBudgetTokens ?? null,
    selectionMode: overrides.selectionMode ?? "document-order",
    selectionBudgetKind: overrides.selectionBudgetKind ?? "chars",
    selectionBudgetChars: overrides.selectionBudgetChars ?? null,
    selectionBudgetTokens: overrides.selectionBudgetTokens ?? null,
    usedBudgetClamp: overrides.usedBudgetClamp ?? false,
    coverageSelectionApplied: overrides.coverageSelectionApplied ?? false,
    skippedDueToBudgetCount: overrides.skippedDueToBudgetCount ?? 0,
    rankingEnabled: overrides.rankingEnabled ?? false,
    rankingQueryTokenCount: overrides.rankingQueryTokenCount ?? 0,
    rankingStrategy: overrides.rankingStrategy ?? "deterministic-query-overlap-v1",
    rankingFallbackReason: overrides.rankingFallbackReason ?? null,
    occurrenceIntentDetected: overrides.occurrenceIntentDetected ?? false,
    occurrenceTargetPhrase: overrides.occurrenceTargetPhrase ?? null,
    occurrence: overrides.occurrence ?? {
      searchStatus: "not_requested",
      targetPhrase: null,
      scannedChunkCount: 0,
      exactMatchChunkCount: 0,
      exactMatchLocationCount: 0,
      exactMatchChunkIndexes: [],
      selectedRepresentativeChunkIndexes: [0],
      skippedDueToBudgetChunkIndexes: [],
      locations: [],
      detail: null,
    },
    chunkCharRanges,
  };
}

function makeBundle(overrides = {}) {
  const defaultDocumentChunking = {
    strategy: "thread-document-paragraphs-v1",
    budget: {
      budgetInputProvided: false,
      mode: null,
      modelProfileId: null,
      provider: null,
      protocol: null,
      model: null,
      documentContextBudgetTokens: null,
      fallbackProfileUsed: null,
      selectedChunkTokenTotal: 0,
      skippedDueToBudgetCount: 0,
      detail: "Legacy-equivalent fallback budget.",
    },
    occurrence: null,
    documents: [],
  };

  return {
    text: overrides.text ?? "",
    sources: overrides.sources ?? [],
    summarySources: overrides.summarySources ?? [],
    sourceSelection: overrides.sourceSelection ?? {
      requestMode: "default",
      consideredSourceIds: ["thread_documents", "company_documents", "browsing", "memory", "live_data"],
      defaultCandidateSourceIds: ["thread_documents", "company_documents", "browsing", "memory", "live_data"],
      explicitUserRequestedSourceIds: [],
      requestedSourceIds: [],
      plannerProposedSourceIds: [],
      policyRequiredSourceIds: [],
      fallbackCandidateSourceIds: [],
      allowedSourceIds: ["thread_documents"],
      executedSourceIds: ["thread_documents"],
      excludedSourceIds: ["company_documents", "browsing", "memory", "live_data"],
    },
    sourceDecisions: overrides.sourceDecisions ?? [makeSourceDecision()],
    documentChunking: {
      ...defaultDocumentChunking,
      ...(overrides.documentChunking ?? {}),
    },
  };
}

const failures = [];
let completed = 0;

async function runTest(name, fn) {
  try {
    await fn();
    completed += 1;
    console.log(`ok - ${name}`);
  } catch (error) {
    failures.push({ name, error });
    console.error(`not ok - ${name}`);
    console.error(error instanceof Error ? error.stack ?? error.message : error);
  }
}

await runTest("maps an empty executed bundle without mutating the input", async () => {
  const authority = makeAuthority();
  const bundle = makeBundle();
  const authorityBefore = structuredClone(authority);
  const bundleBefore = structuredClone(bundle);

  const trace = buildConversationContextDebugTrace({
    conversationId: "thread-1",
    authority,
    currentUserPrompt: null,
    bundle,
  });

  assert.deepEqual(authority, authorityBefore);
  assert.deepEqual(bundle, bundleBefore);
  assert.equal(trace.requestMode, "default");
  assert.deepEqual(trace.requestedSourceIds, []);
  assert.equal(trace.sourceEligibility.length, 1);
  assert.equal(trace.sourceEligibility[0].sourceId, "thread_documents");
  assert.equal(trace.retrieval.length, 1);
  assert.equal(trace.retrieval[0].sourceId, "thread_documents");
  assert.deepEqual(trace.retrieval[0].selectedChunkIds, []);
  assert.deepEqual(trace.retrieval[0].skippedChunkIds, []);
  assert.equal(trace.budgetProfile, null);
  assert.equal(trace.assembly.documentChunkBudgetTokens, null);
  assert.equal(trace.occurrence, null);
  assert.equal(trace.renderedContext.text, null);
  assert.equal(trace.renderedContext.safeTextPreview, null);
  assert.equal(trace.inspectorParity.payloadMatchesRenderedContext, true);
});

await runTest("maps plan-mode exclusions from source decisions without changing execution ownership", async () => {
  const bundle = makeBundle({
    text: "Plan-mode request.",
    sourceSelection: {
      requestMode: "plan",
      consideredSourceIds: ["thread_documents", "browsing", "not_real"],
      defaultCandidateSourceIds: [],
      explicitUserRequestedSourceIds: [],
      requestedSourceIds: ["thread_documents", "browsing", "not_real"],
      plannerProposedSourceIds: ["thread_documents", "browsing", "not_real"],
      policyRequiredSourceIds: [],
      fallbackCandidateSourceIds: [],
      allowedSourceIds: ["thread_documents"],
      executedSourceIds: ["thread_documents"],
      excludedSourceIds: ["browsing", "not_real"],
    },
    sourceDecisions: [
      makeSourceDecision(),
      makeSourceDecision({
        sourceId: "browsing",
        label: "Browsing",
        request: {
          status: "proposed",
          mode: "plan",
          origins: ["planner_proposed"],
          detail: "Planner requested browsing.",
        },
        admission: { status: "excluded" },
        execution: { status: "not_executed", detail: "Browsing is not implemented yet.", summary: null },
        status: "excluded",
        reason: "not_implemented",
        detail: "Browsing is not implemented yet.",
        domain: "browsing",
        scope: "external",
        eligibility: {
          isRegistered: true,
          isInScope: true,
          isAvailable: true,
          isRequestingUserAllowed: true,
          isActiveAgentAllowed: true,
          isImplemented: false,
        },
      }),
      makeSourceDecision({
        sourceId: "not_real",
        label: "Unknown Source",
        request: {
          status: "proposed",
          mode: "plan",
          origins: ["planner_proposed"],
          detail: "Planner requested an unknown source.",
        },
        admission: { status: "excluded" },
        execution: { status: "not_executed", detail: "Source is not registered.", summary: null },
        status: "excluded",
        reason: "not_registered",
        detail: "Source is not registered.",
        domain: "unknown",
        scope: "unknown",
        eligibility: {
          isRegistered: false,
          isInScope: false,
          isAvailable: false,
          isRequestingUserAllowed: false,
          isActiveAgentAllowed: false,
          isImplemented: false,
        },
      }),
    ],
  });

  const trace = buildConversationContextDebugTrace({
    conversationId: "thread-2",
    authority: makeAuthority(),
    currentUserPrompt: "Use thread docs if available.",
    bundle,
  });

  assert.equal(trace.requestMode, "plan");
  assert.deepEqual(trace.requestedSourceIds, ["thread_documents", "browsing", "not_real"]);
  assert.deepEqual(
    trace.sourceEligibility.map((entry) => ({
      sourceId: entry.sourceId,
      decision: entry.decision,
      reason: entry.reason,
      executionStatus: entry.executionStatus,
    })),
    [
      {
        sourceId: "thread_documents",
        decision: "allowed",
        reason: "allowed",
        executionStatus: "executed",
      },
      {
        sourceId: "browsing",
        decision: "excluded",
        reason: "not_implemented",
        executionStatus: "not_executed",
      },
      {
        sourceId: "not_real",
        decision: "excluded",
        reason: "not_registered",
        executionStatus: "not_executed",
      },
    ]
  );
  assert.deepEqual(trace.retrieval.map((entry) => entry.sourceId), ["thread_documents"]);
});

await runTest("maps selected and skipped chunks with source-native locations and separate references", async () => {
  const legalDocument = makeDebugDocument({
    sourceId: "doc-legal",
    filename: "agreement.pdf",
    sourceType: "pdf",
    selectedChunkIndexes: [2, 0],
    skippedChunkIndexes: [1],
    selectedApproxTokenCount: 31,
    totalApproxTokenCount: 44,
    selectedCharCount: 128,
    totalCharCount: 192,
    documentBudgetTokens: 32,
    selectionMode: "ranked-order",
    selectionBudgetKind: "tokens",
    selectionBudgetTokens: 32,
    rankingEnabled: true,
    rankingQueryTokenCount: 6,
    skippedDueToBudgetCount: 1,
    occurrenceIntentDetected: true,
    occurrenceTargetPhrase: "joint account",
    occurrence: {
      searchStatus: "searched",
      targetPhrase: "joint account",
      scannedChunkCount: 3,
      exactMatchChunkCount: 2,
      exactMatchLocationCount: 2,
      exactMatchChunkIndexes: [0, 2],
      selectedRepresentativeChunkIndexes: [2, 0],
      skippedDueToBudgetChunkIndexes: [1],
      locations: [
        {
          chunkIndex: 0,
          chunkIndexes: [0],
          sourceBodyLocationLabel: "agreement.pdf â€” Article V â€” Article V.D â€” Article V.D.2",
          exactPhraseMatchCount: 1,
          coverageGroupKey: "section:v.d.2",
          referencedLocationLabels: ["Exhibit C"],
        },
        {
          chunkIndex: 2,
          chunkIndexes: [2],
          sourceBodyLocationLabel: "agreement.pdf â€” Article XVI â€” Article XVI.2",
          exactPhraseMatchCount: 2,
          coverageGroupKey: "section:xvi.2",
          referencedLocationLabels: [],
        },
      ],
      detail: "Scanned all extracted chunks for the exact target phrase.",
    },
    chunkCharRanges: [
      makeChunkRange({
        chunkIndex: 0,
        charStart: 0,
        charEnd: 60,
        approxTokenCount: 12,
        textPreview: "The Operator shall discharge Joint Account obligations.",
        safeProvenanceLabel: "Article V.D.2",
        sectionLabel: "Article V.D.2",
        sectionPath: ["Article V", "Article V.D", "Article V.D.2"],
        sourceBodyLocationLabel: "agreement.pdf — Article V — Article V.D — Article V.D.2",
        referencedLocationLabels: ["Exhibit C"],
        rankingScore: 0.96,
        rankingSignals: ["phrase_overlap"],
        rankingOrder: 1,
        exactPhraseMatchCount: 1,
      }),
      makeChunkRange({
        chunkIndex: 1,
        charStart: 61,
        charEnd: 120,
        approxTokenCount: 13,
        textPreview: "This article covers unrelated general provisions only.",
        safeProvenanceLabel: "Article XV",
        sectionLabel: "Article XV",
        sectionPath: ["Article XV"],
        sourceBodyLocationLabel: "agreement.pdf — Article XV",
        rankingScore: 0.12,
        rankingSignals: ["filename_overlap"],
        rankingOrder: 2,
      }),
      makeChunkRange({
        chunkIndex: 2,
        charStart: 121,
        charEnd: 192,
        approxTokenCount: 19,
        textPreview: "The term Joint Account means the shared project cost ledger.",
        safeProvenanceLabel: "Article XVI.2",
        sectionLabel: "Article XVI.2",
        sectionPath: ["Article XVI", "Article XVI.2"],
        sourceBodyLocationLabel: "agreement.pdf — Article XVI — Article XVI.2",
        rankingScore: 0.99,
        rankingSignals: ["phrase_overlap", "definition_boost"],
        rankingOrder: 0,
        exactPhraseMatchCount: 2,
        definitionBoostApplied: true,
        coverageGroupKey: "Article XVI",
        selectedDueToCoverage: true,
      }),
    ],
  });
  const spreadsheetDocument = makeDebugDocument({
    sourceId: "doc-sheet",
    filename: "metrics.xlsx",
    sourceType: "spreadsheet",
    selectedChunkIndexes: [0],
    skippedChunkIndexes: [],
    selectedApproxTokenCount: 5,
    totalApproxTokenCount: 5,
    selectedCharCount: 24,
    totalCharCount: 24,
    selectionMode: "document-order",
    rankingEnabled: false,
    chunkCharRanges: [
      makeChunkRange({
        chunkIndex: 0,
        charStart: 0,
        charEnd: 24,
        approxTokenCount: 5,
        textPreview: "Metric | Value | Pressure | 60 psi",
        safeProvenanceLabel: "Summary sheet rows 1-2",
        sectionLabel: null,
        sourceBodyLocationLabel: "metrics.xlsx — Summary",
        sheetName: "Summary",
      }),
    ],
  });
  const slideDocument = makeDebugDocument({
    sourceId: "doc-slides",
    filename: "briefing.pptx",
    sourceType: "pptx",
    selectedChunkIndexes: [0],
    skippedChunkIndexes: [],
    selectedApproxTokenCount: 8,
    totalApproxTokenCount: 8,
    selectedCharCount: 36,
    totalCharCount: 36,
    selectionMode: "document-order",
    rankingEnabled: false,
    chunkCharRanges: [
      makeChunkRange({
        chunkIndex: 0,
        charStart: 0,
        charEnd: 36,
        approxTokenCount: 8,
        textPreview: "Maintenance backlog remains the top risk.",
        safeProvenanceLabel: "Slide 3",
        sectionLabel: "Maintenance",
        sourceBodyLocationLabel: "briefing.pptx — Slide 3",
        slideNumber: 3,
      }),
    ],
  });
  const bundle = makeBundle({
    text: "Thread document context is rendered elsewhere.",
    sourceDecisions: [
      makeSourceDecision({
        execution: {
          status: "executed",
          detail: "Thread documents were loaded into context.",
          summary: {
            totalCount: 3,
            usedCount: 3,
            unsupportedCount: 0,
            failedCount: 0,
            unavailableCount: 0,
            excludedCategories: [],
          },
        },
      }),
    ],
    documentChunking: {
      strategy: "thread-document-paragraphs-v1",
      budget: {
        budgetInputProvided: true,
        mode: "standard",
        modelProfileId: "openai-direct-chat-conservative",
        provider: "openai",
        protocol: "auto",
        model: "gpt-4.1",
        documentContextBudgetTokens: 32,
        fallbackProfileUsed: false,
        selectedChunkTokenTotal: 44,
        skippedDueToBudgetCount: 1,
        detail: "Profile-aware thread-document budget applied.",
      },
      occurrence: {
        intentDetected: true,
        targetPhrase: "joint account",
        scannedChunkCount: 3,
        exactMatchChunkCount: 2,
        exactMatchLocationCount: 2,
        searchableDocumentIds: ["doc-legal"],
        unsearchableDocuments: [],
        detail: "Scanned all extracted chunks for the exact target phrase.",
      },
      documents: [legalDocument, spreadsheetDocument, slideDocument],
    },
  });

  const trace = buildConversationContextDebugTrace({
    conversationId: "thread-3",
    authority: makeAuthority(),
    currentUserPrompt: "Where is Joint Account defined?",
    bundle,
  });

  const legalRankedChunk = trace.chunks.find((chunk) => chunk.id === "doc-legal:0");
  const legalSkippedChunk = trace.chunks.find((chunk) => chunk.id === "doc-legal:1");
  const legalCoverageChunk = trace.chunks.find((chunk) => chunk.id === "doc-legal:2");
  const sheetChunk = trace.chunks.find((chunk) => chunk.id === "doc-sheet:0");
  const slideChunk = trace.chunks.find((chunk) => chunk.id === "doc-slides:0");

  assert.ok(legalRankedChunk);
  assert.ok(legalSkippedChunk);
  assert.ok(legalCoverageChunk);
  assert.ok(sheetChunk);
  assert.ok(slideChunk);
  assert.deepEqual(trace.documents[0].selectedChunkIds, ["doc-legal:2", "doc-legal:0"]);
  assert.deepEqual(trace.documents[0].skippedChunkIds, ["doc-legal:1"]);
  assert.deepEqual(trace.assembly.selectedChunkIds, [
    "doc-legal:2",
    "doc-legal:0",
    "doc-sheet:0",
    "doc-slides:0",
  ]);
  assert.equal(legalRankedChunk.provenance.sourceBodyLocation.kind, "legal_section_location");
  assert.deepEqual(legalRankedChunk.provenance.sourceBodyLocation.sectionPath, [
    "Article V",
    "Article V.D",
    "Article V.D.2",
  ]);
  assert.equal(legalRankedChunk.provenance.referencedLocations.length, 1);
  assert.equal(legalRankedChunk.provenance.referencedLocations[0].label, "Exhibit C");
  assert.equal(
    legalRankedChunk.provenance.referencedLocations[0].sourceBodyLocation.label,
    legalRankedChunk.provenance.sourceBodyLocation.label
  );
  assert.equal(
    legalRankedChunk.provenance.referencedLocations[0].targetLocation.label,
    "Exhibit C"
  );
  assert.equal(legalRankedChunk.selection.reason, "high_rank");
  assert.equal(legalCoverageChunk.selection.reason, "coverage");
  assert.equal(legalCoverageChunk.selection.selectedDueToCoverage, true);
  assert.equal(legalSkippedChunk.selection.disposition, "skipped");
  assert.equal(legalSkippedChunk.selection.reason, "budget_exhausted");
  assert.equal(legalSkippedChunk.ranking.score, 0.12);
  assert.deepEqual(legalSkippedChunk.ranking.signals, ["filename_overlap"]);
  assert.equal(sheetChunk.provenance.sourceBodyLocation.kind, "spreadsheet_range_location");
  assert.equal(sheetChunk.provenance.sourceBodyLocation.sheetName, "Summary");
  assert.equal(sheetChunk.selection.reason, "document_order");
  assert.equal(slideChunk.provenance.sourceBodyLocation.kind, "slide_location");
  assert.equal(slideChunk.provenance.sourceBodyLocation.slideNumber, 3);
  assert.equal(trace.assembly.estimatedSelectedTokens, 44);
  assert.equal(trace.budgetProfile?.modelProfileId, "openai-direct-chat-conservative");
  assert.equal(trace.assembly.documentChunkBudgetTokens, 32);
  assert.equal(trace.assembly.skippedDueToBudgetCount, 1);
  assert.equal(trace.documents[0].occurrence?.exactMatchLocationCount, 2);
  assert.equal(trace.occurrence?.targetPhrase, "joint account");
  assert.equal("text" in legalRankedChunk, false);
});

await runTest("preserves page-aware PDF metadata and region provenance in the debug trace", async () => {
  const expectations = getPageAwarePdfExpectations();
  const extraction = buildPdfContextExtractionResult(getPageAwarePdfExtractionFixture());
  const chunks = buildDocumentChunkCandidates({
    sourceId: expectations.sourceId,
    attachmentId: expectations.sourceId,
    fileId: expectations.sourceId,
    filename: expectations.filename,
    sourceType: "pdf",
    text: extraction.text,
    structuredRanges: extraction.structuredRanges,
    maxChunkTokens: 50,
  });
  const appendixChunk = chunks.find((chunk) => /Contractor rates remain fixed/i.test(chunk.text));
  const tableChunk = chunks.find((chunk) => chunk.tableId === expectations.tableLabel);
  assert.ok(appendixChunk);
  assert.ok(tableChunk);

  const appendixChunkRange = makeChunkRange({
    ...appendixChunk,
    textPreview: appendixChunk.text,
    sourceBodyLocationLabel: `${expectations.filename} — page A-1 — ${appendixChunk.sectionPath.join(" — ")}`,
  });
  const tableChunkRange = makeChunkRange({
    ...tableChunk,
    textPreview: tableChunk.text,
    sourceBodyLocationLabel: `${expectations.filename} — page A-1 — ${tableChunk.sectionPath.join(" — ")}`,
  });

  const bundle = makeBundle({
    text: `## Thread Document: ${expectations.filename}\n\nSelected excerpts.`,
    documentChunking: {
      strategy: "thread-document-paragraphs-v1",
      documents: [
        makeDebugDocument({
          sourceId: expectations.sourceId,
          attachmentId: expectations.sourceId,
          fileId: expectations.sourceId,
          filename: expectations.filename,
          sourceType: "pdf",
          extractionDetail: extraction.metadata.detail,
          sourceMetadata: extraction.metadata,
          selectedChunkIndexes: [appendixChunkRange.chunkIndex, tableChunkRange.chunkIndex],
          skippedChunkIndexes: [],
          selectionMode: "ranked-order",
          rankingEnabled: true,
          rankingQueryTokenCount: 3,
          selectedApproxTokenCount: appendixChunkRange.approxTokenCount + tableChunkRange.approxTokenCount,
          totalApproxTokenCount: appendixChunkRange.approxTokenCount + tableChunkRange.approxTokenCount,
          selectedCharCount:
            appendixChunkRange.charEnd - appendixChunkRange.charStart +
            tableChunkRange.charEnd - tableChunkRange.charStart,
          totalCharCount:
            appendixChunkRange.charEnd - appendixChunkRange.charStart +
            tableChunkRange.charEnd - tableChunkRange.charStart,
          chunkCharRanges: [appendixChunkRange, tableChunkRange],
        }),
      ],
    },
  });

  const trace = buildConversationContextDebugTrace({
    conversationId: "thread-5",
    authority: makeAuthority(),
    currentUserPrompt: "Summarize the attachment on page 2.",
    bundle,
  });

  const appendixTraceChunk = trace.chunks.find(
    (chunk) => chunk.id === `${expectations.sourceId}:${appendixChunkRange.chunkIndex}`
  );
  const tableTraceChunk = trace.chunks.find(
    (chunk) => chunk.id === `${expectations.sourceId}:${tableChunkRange.chunkIndex}`
  );

  assert.equal(trace.documents[0].extractionDetail, extraction.metadata.detail);
  assert.equal(trace.documents[0].metadata?.detectedTableCount, 1);
  assert.ok(appendixTraceChunk);
  assert.ok(tableTraceChunk);
  assert.equal(appendixTraceChunk.provenance.sourceBodyLocation.pageRange, undefined);
  assert.equal(appendixTraceChunk.provenance.sourceBodyLocation.pageNumber, 2);
  assert.match(
    appendixTraceChunk.provenance.sourceBodyLocation.headingPath.join(" | "),
    /Appendix A\b.*Pricing Terms/i
  );
  assert.match(
    appendixTraceChunk.provenance.sourceBodyLocation.headingPath.join(" | "),
    /Attachment 1\b.*Contractor Rates/i
  );
  assert.equal(tableTraceChunk.provenance.sourceBodyLocation.tableId, expectations.tableLabel);
});

await runTest("surfaces PDF visual classification and selection visibility for table-focused ranking", async () => {
  const expectations = getT5DeckExpectations();
  const extraction = buildPdfContextExtractionResult(getT5DeckPdfExtractionFixture());
  const chunks = buildDocumentChunkCandidates({
    sourceId: expectations.sourceId,
    attachmentId: expectations.sourceId,
    fileId: expectations.sourceId,
    filename: expectations.filename,
    sourceType: "pdf",
    text: extraction.text,
    structuredRanges: extraction.structuredRanges,
    maxChunkTokens: 80,
  });
  const ranking = rankDocumentChunks({
    query: expectations.tableQuery,
    chunks,
  });
  const selectedChunkIndexes = ranking.rankedChunks.slice(0, 2).map((chunk) => chunk.chunkIndex);
  const skippedChunkIndexes = chunks
    .filter((chunk) => !selectedChunkIndexes.includes(chunk.chunkIndex))
    .map((chunk) => chunk.chunkIndex);
  const totalApproxTokenCount = chunks.reduce((sum, chunk) => sum + chunk.approxTokenCount, 0);
  const totalCharCount = chunks.reduce((sum, chunk) => sum + (chunk.charEnd - chunk.charStart), 0);
  const selectedApproxTokenCount = ranking.rankedChunks
    .slice(0, 2)
    .reduce((sum, chunk) => sum + chunk.approxTokenCount, 0);
  const selectedCharCount = ranking.rankedChunks
    .slice(0, 2)
    .reduce((sum, chunk) => sum + (chunk.charEnd - chunk.charStart), 0);

  const bundle = makeBundle({
    text: `## Thread Document: ${expectations.filename}\n\nSelected excerpts.`,
    documentChunking: {
      strategy: "thread-document-paragraphs-v1",
      documents: [
        makeDebugDocument({
          sourceId: expectations.sourceId,
          attachmentId: expectations.sourceId,
          fileId: expectations.sourceId,
          filename: expectations.filename,
          sourceType: "pdf",
          extractionDetail: extraction.metadata.detail,
          sourceMetadata: extraction.metadata,
          selectedChunkIndexes,
          skippedChunkIndexes,
          selectionMode: "ranked-order",
          rankingEnabled: true,
          rankingQueryTokenCount: 2,
          selectedApproxTokenCount,
          totalApproxTokenCount,
          selectedCharCount,
          totalCharCount,
          chunkCharRanges: chunks.map((chunk) => {
            const detail = ranking.details.find((entry) => entry.chunkIndex === chunk.chunkIndex);
            return makeChunkRange({
              ...chunk,
              textPreview: chunk.text,
              sourceBodyLocationLabel: `${expectations.filename} — page ${chunk.pageNumberStart ?? "?"}`,
              rankingScore: detail?.score ?? 0,
              rankingSignals: detail?.signalLabels ?? [],
              rankingOrder: detail?.rankingOrder ?? chunk.chunkIndex,
              exactPhraseMatchCount: detail?.exactPhraseMatchCount ?? 0,
              definitionBoostApplied: detail?.definitionBoostApplied ?? false,
              coverageGroupKey: detail?.coverageGroupKey ?? null,
              selectedDueToCoverage: false,
            });
          }),
        }),
      ],
    },
  });

  const trace = buildConversationContextDebugTrace({
    conversationId: "thread-6",
    authority: makeAuthority(),
    currentUserPrompt: expectations.tableQuery,
    bundle,
  });

  const topChunk = trace.chunks.find((chunk) => chunk.id === `${expectations.sourceId}:${selectedChunkIndexes[0]}`);
  const mapChunk = trace.chunks.find((chunk) => chunk.provenance.sourceBodyLocation.pageNumber === 9);

  assert.equal(trace.documents[0].metadata?.pageStructures.find((page) => page.pageNumber === 15)?.primaryClassification, "true_table");
  assert.equal(trace.documents[0].metadata?.pageStructures.find((page) => page.pageNumber === 18)?.primaryClassification, "table_like_schedule_or_timeline");
  assert.ok(topChunk);
  assert.equal(topChunk.metadata.visualClassification, "true_table");
  assert.ok(topChunk.ranking.signals.includes("true_table_classification"));
  assert.ok(mapChunk);
  assert.notEqual(mapChunk.metadata.visualClassification, "true_table");
  assert.ok(mapChunk.ranking.signals.includes("non_table_visual_penalty"));
});

await runTest("maps ordinary unstructured documents safely and keeps parity deterministic", async () => {
  const bundle = makeBundle({
    text: "## Thread Document: notes.txt\n\nCompressor restart checklist.",
    documentChunking: {
      strategy: "thread-document-paragraphs-v1",
      documents: [
        makeDebugDocument({
          sourceId: "doc-text",
          filename: "notes.txt",
          sourceType: "text",
          selectedChunkIndexes: [0],
          skippedChunkIndexes: [],
          selectedApproxTokenCount: 6,
          totalApproxTokenCount: 6,
          selectionMode: "document-order",
          rankingEnabled: false,
          chunkCharRanges: [
            makeChunkRange({
              chunkIndex: 0,
              textPreview: "Compressor restart checklist.",
              safeProvenanceLabel: "Excerpt 1 (chars 1-29)",
              sourceBodyLocationLabel: "notes.txt — Excerpt 1 (chars 1-29)",
            }),
          ],
        }),
      ],
    },
  });

  const traceA = buildConversationContextDebugTrace({
    conversationId: "thread-4",
    authority: makeAuthority(),
    currentUserPrompt: "Summarize the checklist.",
    bundle,
  });
  const traceB = buildConversationContextDebugTrace({
    conversationId: "thread-4",
    authority: makeAuthority(),
    currentUserPrompt: "Summarize the checklist.",
    bundle,
  });
  const traceC = buildConversationContextDebugTrace({
    conversationId: "thread-4",
    authority: makeAuthority(),
    currentUserPrompt: "Summarize the checklist.",
    bundle: {
      ...bundle,
      text: `${bundle.text}\n\nAdditional availability note.`,
    },
  });

  assert.equal(traceA.chunks[0].provenance.sourceBodyLocation.kind, "document_location");
  assert.deepEqual(traceA.chunks[0].provenance.referencedLocations, []);
  assert.equal(traceA.chunks[0].selection.reason, "document_order");
  assert.equal(traceA.renderedContext.text, null);
  assert.equal(
    traceA.renderedContext.inspectorParityKey,
    traceB.renderedContext.inspectorParityKey
  );
  assert.notEqual(
    traceA.renderedContext.inspectorParityKey,
    traceC.renderedContext.inspectorParityKey
  );
});

if (failures.length > 0) {
  console.error(`\n${failures.length} test(s) failed.`);
  process.exitCode = 1;
} else {
  console.log(`\n${completed} context-debug-trace test(s) passed.`);
}
