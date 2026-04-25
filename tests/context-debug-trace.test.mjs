import assert from "node:assert/strict";
import path from "node:path";
import { fileURLToPath } from "node:url";
import createJiti from "jiti";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const jiti = createJiti(import.meta.url, { moduleCache: false });
const { buildConversationContextDebugTrace } = jiti(
  path.join(__dirname, "..", "src", "lib", "context-debug-trace.ts")
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
    sourceBodyLocationLabel:
      overrides.sourceBodyLocationLabel ?? "notes.md — Excerpt 1 (chars 1-40)",
    referencedLocationLabels: overrides.referencedLocationLabels ?? [],
    sheetName: overrides.sheetName ?? null,
    slideNumber: overrides.slideNumber ?? null,
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
    totalChunks: overrides.totalChunks ?? chunkCharRanges.length,
    selectedChunkIndexes: overrides.selectedChunkIndexes ?? [0],
    skippedChunkIndexes: overrides.skippedChunkIndexes ?? [],
    selectedApproxTokenCount: overrides.selectedApproxTokenCount ?? chunkCharRanges[0].approxTokenCount,
    totalApproxTokenCount:
      overrides.totalApproxTokenCount ??
      chunkCharRanges.reduce((sum, chunk) => sum + chunk.approxTokenCount, 0),
    selectedCharCount: overrides.selectedCharCount ?? 40,
    totalCharCount: overrides.totalCharCount ?? 40,
    selectionMode: overrides.selectionMode ?? "document-order",
    usedBudgetClamp: overrides.usedBudgetClamp ?? false,
    coverageSelectionApplied: overrides.coverageSelectionApplied ?? false,
    rankingEnabled: overrides.rankingEnabled ?? false,
    rankingQueryTokenCount: overrides.rankingQueryTokenCount ?? 0,
    rankingStrategy: overrides.rankingStrategy ?? "deterministic-query-overlap-v1",
    rankingFallbackReason: overrides.rankingFallbackReason ?? null,
    occurrenceIntentDetected: overrides.occurrenceIntentDetected ?? false,
    occurrenceTargetPhrase: overrides.occurrenceTargetPhrase ?? null,
    chunkCharRanges,
  };
}

function makeBundle(overrides = {}) {
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
    documentChunking: overrides.documentChunking ?? {
      strategy: "thread-document-paragraphs-v1",
      documents: [],
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
    selectionMode: "ranked-order",
    rankingEnabled: true,
    rankingQueryTokenCount: 6,
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
  assert.equal(legalSkippedChunk.selection.reason, "low_relevance");
  assert.equal(legalSkippedChunk.ranking.score, 0.12);
  assert.deepEqual(legalSkippedChunk.ranking.signals, ["filename_overlap"]);
  assert.equal(sheetChunk.provenance.sourceBodyLocation.kind, "spreadsheet_range_location");
  assert.equal(sheetChunk.provenance.sourceBodyLocation.sheetName, "Summary");
  assert.equal(sheetChunk.selection.reason, "document_order");
  assert.equal(slideChunk.provenance.sourceBodyLocation.kind, "slide_location");
  assert.equal(slideChunk.provenance.sourceBodyLocation.slideNumber, 3);
  assert.equal(trace.assembly.estimatedSelectedTokens, 44);
  assert.equal("text" in legalRankedChunk, false);
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
