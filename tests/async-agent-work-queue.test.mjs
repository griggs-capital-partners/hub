import assert from "node:assert/strict";
import path from "node:path";
import { fileURLToPath } from "node:url";
import createJiti from "jiti";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const jiti = createJiti(import.meta.url, { moduleCache: false });
const { evaluateAgentControlSurface } = jiti(
  path.join(__dirname, "..", "src", "lib", "agent-control-surface.ts")
);
const { assembleProgressiveContext } = jiti(
  path.join(__dirname, "..", "src", "lib", "progressive-context-assembly.ts")
);
const { buildConversationContextDebugTrace } = jiti(
  path.join(__dirname, "..", "src", "lib", "context-debug-trace.ts")
);
const {
  canTransitionAsyncAgentWorkStatus,
  createAsyncAgentWorkItemFromControlDecision,
  createAsyncAgentWorkItemFromProgressiveAssembly,
  planAsyncAgentWorkItems,
  runAsyncAgentWorkItem,
  toAsyncAgentWorkDebugSnapshot,
  transitionAsyncAgentWorkStatus,
} = jiti(path.join(__dirname, "..", "src", "lib", "async-agent-work-queue.ts"));

const tests = [];

function runTest(name, fn) {
  tests.push({ name, fn });
}

function makeSourceSignal(overrides = {}) {
  return {
    sourceId: overrides.sourceId ?? "doc-t5",
    sourceType: overrides.sourceType ?? "pdf",
    filename: overrides.filename ?? "T5 Summary Deck V1.7ext.pdf",
    sourceVersion: overrides.sourceVersion,
    sourceUpdatedAt: overrides.sourceUpdatedAt,
    artifactUpdatedAt: overrides.artifactUpdatedAt,
    hasWeakArtifact: overrides.hasWeakArtifact ?? false,
    hasStaleArtifact: overrides.hasStaleArtifact ?? false,
    artifactKinds: overrides.artifactKinds ?? [],
    warningArtifactKinds: overrides.warningArtifactKinds ?? [],
    recommendedNextCapabilities: overrides.recommendedNextCapabilities ?? [],
    unmetCapabilities: overrides.unmetCapabilities ?? [],
    sourceCoverageHints: overrides.sourceCoverageHints,
    dataClass: overrides.dataClass ?? "internal",
    containsUntrustedInstructions: overrides.containsUntrustedInstructions ?? false,
    detail: overrides.detail ?? null,
  };
}

function makeArtifactCandidate(overrides = {}) {
  return {
    id: overrides.id ?? "doc-t5:artifact:table_candidate:15",
    kind: "artifact",
    sourceId: overrides.sourceId ?? "doc-t5",
    sourceType: overrides.sourceType ?? "pdf",
    label: overrides.label ?? "Likely table detected on page 15",
    content:
      overrides.content ??
      "Likely true data table detected on page 15. The current parser did not recover a structured table body. Do not infer missing columns, cell values, or headers.",
    approxTokenCount: overrides.approxTokenCount ?? 42,
    priority: overrides.priority ?? 90,
    confidence: overrides.confidence ?? 0.7,
    artifactKind: overrides.artifactKind ?? "table_candidate",
    artifactStatus: overrides.artifactStatus ?? "partial",
    locationLabel: overrides.locationLabel ?? "T5 Summary Deck V1.7ext.pdf - page 15 - Smackover Water Chemistry",
    provenance: overrides.provenance ?? { artifactKey: "table_candidate:15", tool: "pdf_table_candidate_detection" },
    freshness: overrides.freshness ?? { artifactUpdatedAt: "2026-04-26T00:00:00.000Z" },
    rankingHints: overrides.rankingHints ?? ["table", "page 15", "Smackover Water Chemistry"],
    required: overrides.required ?? false,
    metadata: overrides.metadata ?? { artifactKey: "table_candidate:15" },
  };
}

function makeWarningArtifact(overrides = {}) {
  return makeArtifactCandidate({
    id: "doc-t5:artifact:extraction_warning:15:table_body_missing",
    label: "Sparse extraction warning for page 15",
    content:
      "Sparse extraction warning for page 15. No structured row or column body was recovered from the current parser output.",
    approxTokenCount: 38,
    priority: 85,
    artifactKind: "extraction_warning",
    artifactStatus: "warning",
    required: true,
    metadata: { artifactKey: "extraction_warning:15:table_body_missing" },
    ...overrides,
  });
}

function makeRawCandidate(overrides = {}) {
  return {
    id: overrides.id ?? "doc-t5:15",
    kind: "excerpt",
    sourceId: overrides.sourceId ?? "doc-t5",
    sourceType: overrides.sourceType ?? "pdf",
    label: overrides.label ?? "T5 Summary Deck V1.7ext.pdf - page 15",
    content: overrides.content ?? "Smackover Water Chemistry 17",
    approxTokenCount: overrides.approxTokenCount ?? 8,
    priority: overrides.priority ?? 20,
    confidence: null,
    locationLabel: overrides.locationLabel ?? "T5 Summary Deck V1.7ext.pdf - page 15",
    provenance: overrides.provenance ?? { pageNumberStart: 15 },
    rankingHints: overrides.rankingHints ?? ["page 15"],
    required: overrides.required ?? false,
    metadata: overrides.metadata ?? { parserSignal: true },
  };
}

function makeAssembly({ request, sourceSignals = [], patch = {}, artifactCandidates, rawExcerptCandidates, inspectionInvocations } = {}) {
  const decision = {
    ...evaluateAgentControlSurface({
      conversationId: "thread-a04f",
      request: request ?? "Summarize the learned artifacts.",
      sourceSignals,
    }),
    ...patch,
  };
  const assembly = assembleProgressiveContext({
    request: request ?? "Summarize the learned artifacts.",
    agentControl: decision,
    artifactCandidates: artifactCandidates ?? [makeArtifactCandidate()],
    rawExcerptCandidates: rawExcerptCandidates ?? [makeRawCandidate()],
    inspectionInvocations,
  });

  return { decision, assembly };
}

function makeDebugBundle({ agentControl, progressiveAssembly, asyncAgentWork }) {
  return {
    text: "Resolved context text is rendered elsewhere.",
    sourceSelection: {
      requestMode: "default",
      consideredSourceIds: ["thread_documents"],
      defaultCandidateSourceIds: ["thread_documents"],
      explicitUserRequestedSourceIds: [],
      requestedSourceIds: [],
      plannerProposedSourceIds: [],
      policyRequiredSourceIds: [],
      fallbackCandidateSourceIds: [],
      allowedSourceIds: ["thread_documents"],
      executedSourceIds: ["thread_documents"],
      excludedSourceIds: [],
    },
    sourceDecisions: [
      {
        sourceId: "thread_documents",
        label: "Thread Documents",
        request: {
          status: "candidate",
          mode: "default",
          origins: ["default_system_candidate"],
          detail: "Default thread candidate.",
        },
        admission: { status: "allowed" },
        execution: {
          status: "executed",
          detail: "Thread documents were evaluated.",
          summary: {
            totalCount: 1,
            usedCount: 1,
            unsupportedCount: 0,
            failedCount: 0,
            unavailableCount: 0,
            excludedCategories: [],
          },
        },
        exclusion: null,
        status: "allowed",
        reason: "allowed",
        detail: "Allowed.",
        domain: "thread_documents",
        scope: "thread",
        policyMode: "thread_active_membership",
        eligibility: {
          isRegistered: true,
          isInScope: true,
          isAvailable: true,
          isRequestingUserAllowed: true,
          isActiveAgentAllowed: true,
          isImplemented: true,
        },
      },
    ],
    documentChunking: {
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
        detail: "Fallback budget.",
      },
      occurrence: null,
      documents: [],
    },
    documentIntelligence: {
      selectedArtifactKeys: [],
      selectedApproxTokenCount: 0,
      documents: [],
    },
    agentControl,
    progressiveAssembly,
    asyncAgentWork,
  };
}

runTest("creates AsyncAgentWorkItem from AgentControlDecision", () => {
  const decision = evaluateAgentControlSurface({
    conversationId: "thread-ingest",
    request: "Ingest this document at the highest level across all pages and all tables.",
    sourceSignals: [makeSourceSignal({ sourceCoverageHints: ["all_tables"] })],
  });
  const item = createAsyncAgentWorkItemFromControlDecision({
    conversationId: "thread-ingest",
    conversationDocumentId: "doc-t5",
    createdById: "user-1",
    request: "Ingest this document at the highest level across all pages and all tables.",
    controlDecision: decision,
  });

  assert.equal(item.type, "highest_fidelity_ingestion");
  assert.equal(item.trigger, "progressive_assembly_recommendation");
  assert.equal(item.status, "queued");
  assert.equal(item.controlSnapshot.decisionId, decision.decisionId);
  assert.equal(item.budgetSnapshot.sourceCoverageTarget, "all_tables");
  assert.equal(item.idempotencyKey, item.workKey);
});

runTest("creates AsyncAgentWorkItem from ProgressiveContextAssembly result", () => {
  const { decision, assembly } = makeAssembly({
    request: "What is in the water chemistry table body on page 15?",
    sourceSignals: [makeSourceSignal({ hasWeakArtifact: true, artifactKinds: ["table_candidate", "extraction_warning"] })],
    artifactCandidates: [makeArtifactCandidate(), makeWarningArtifact()],
  });
  const item = createAsyncAgentWorkItemFromProgressiveAssembly({
    conversationId: "thread-t5",
    conversationDocumentId: "doc-t5",
    controlDecision: decision,
    assembly,
  });

  assert.equal(item.type, "context_gap_resolution");
  assert.equal(item.assemblySnapshot.plan.id, assembly.plan.id);
  assert.equal(item.contextGapSnapshots.some((gap) => gap.kind === "missing_table_body"), true);
  assert.equal(item.artifactLinks.some((link) => link.artifactKey === "table_candidate:15"), true);
});

runTest("preserves control, assembly, context gaps, and debt candidates", () => {
  const { decision, assembly } = makeAssembly({
    request: "Ingest this document at the highest level across all pages and all tables.",
    sourceSignals: [makeSourceSignal({ sourceCoverageHints: ["all_tables"] })],
    artifactCandidates: [makeArtifactCandidate({ approxTokenCount: 40 })],
    rawExcerptCandidates: [
      makeRawCandidate({ id: "doc-t5:1", approxTokenCount: 40 }),
      makeRawCandidate({ id: "doc-t5:2", approxTokenCount: 40 }),
      makeRawCandidate({ id: "doc-t5:3", approxTokenCount: 40 }),
    ],
  });
  const item = createAsyncAgentWorkItemFromProgressiveAssembly({
    conversationId: "thread-ingest",
    conversationDocumentId: "doc-t5",
    controlDecision: decision,
    assembly,
  });

  assert.equal(item.controlSnapshot.decision.taskFidelityLevel, "highest_fidelity_ingestion");
  assert.equal(item.assemblySnapshot.contextDebtCandidates.length > 0, true);
  assert.equal(item.contextGapSnapshots.some((gap) => gap.futureRegistryPersistenceRecommended), true);
  assert.equal(item.sourceLinks.some((link) => link.coverageTarget === "all_tables"), true);
});

runTest("status transitions are deterministic and valid", () => {
  const { decision, assembly } = makeAssembly();
  const item = createAsyncAgentWorkItemFromProgressiveAssembly({
    conversationId: "thread-transition",
    controlDecision: decision,
    assembly,
  });
  const planned = transitionAsyncAgentWorkStatus(item, "planned");
  const running = transitionAsyncAgentWorkStatus(planned, "running");

  assert.equal(canTransitionAsyncAgentWorkStatus("queued", "planned"), true);
  assert.equal(running.status, "running");
  assert.throws(() => transitionAsyncAgentWorkStatus(running, "queued"), /Invalid AsyncAgentWorkStatus transition/);
});

runTest("T5 page 15 weak table path plans context gap resolution work", () => {
  const { decision, assembly } = makeAssembly({
    request: "What is in the water chemistry table body on page 15?",
    sourceSignals: [makeSourceSignal({ hasWeakArtifact: true, artifactKinds: ["table_candidate", "extraction_warning"] })],
    artifactCandidates: [makeArtifactCandidate(), makeWarningArtifact()],
  });
  const items = planAsyncAgentWorkItems({
    conversationId: "thread-t5",
    conversationDocumentId: "doc-t5",
    controlDecision: decision,
    assembly,
  });

  assert.equal(items.length, 1);
  assert.equal(["context_gap_resolution", "deep_inspection"].includes(items[0].type), true);
  assert.equal(items[0].contextGapSnapshots.some((gap) => gap.kind === "missing_table_body"), true);
});

runTest("T5 page 15 records deferred rendered/OCR/vision/document-AI without claiming execution", () => {
  const { decision, assembly } = makeAssembly({
    request: "Recover the page 15 table body.",
    sourceSignals: [makeSourceSignal({ hasWeakArtifact: true, artifactKinds: ["table_candidate", "extraction_warning"] })],
    artifactCandidates: [makeArtifactCandidate(), makeWarningArtifact()],
  });
  const item = runAsyncAgentWorkItem(createAsyncAgentWorkItemFromProgressiveAssembly({
    conversationId: "thread-t5",
    conversationDocumentId: "doc-t5",
    controlDecision: decision,
    assembly,
  }));
  const deferred = item.deferredCapabilities.map((entry) => entry.capability);

  assert.equal(deferred.includes("rendered_page_inspection"), true);
  assert.equal(deferred.includes("ocr"), true);
  assert.equal(deferred.includes("vision_page_understanding"), true);
  assert.equal(deferred.includes("document_ai_table_recovery"), true);
  assert.equal(item.result.executedUnavailableCapabilities.length, 0);
  assert.equal(item.result.unavailableToolExecutionClaimed, false);
  assert.equal(item.deferredCapabilities.every((entry) => entry.executed === false), true);
});

runTest("highest-fidelity ingestion preserves full-document all-pages all-tables intent", () => {
  const { decision, assembly } = makeAssembly({
    request: "Ingest this document at the highest level across the full document, all pages, and all tables.",
    sourceSignals: [makeSourceSignal({ sourceCoverageHints: ["all_pages", "all_tables"] })],
    artifactCandidates: [makeArtifactCandidate({ approxTokenCount: 40 })],
    rawExcerptCandidates: [makeRawCandidate({ id: "doc-t5:1", approxTokenCount: 60 })],
  });
  const item = createAsyncAgentWorkItemFromProgressiveAssembly({
    conversationId: "thread-ingest",
    conversationDocumentId: "doc-t5",
    controlDecision: decision,
    assembly,
  });

  assert.equal(item.type, "highest_fidelity_ingestion");
  assert.equal(item.budgetSnapshot.sourceCoverageTarget, "all_tables");
  assert.equal(item.plan.summary.includes("highest-fidelity ingestion"), true);
});

runTest("highest-fidelity ingestion completes with limitations when full fidelity is unavailable", () => {
  const { decision, assembly } = makeAssembly({
    request: "Ingest this document at the highest level across all pages and all tables.",
    sourceSignals: [makeSourceSignal({ sourceCoverageHints: ["all_tables"] })],
    artifactCandidates: [makeArtifactCandidate({ approxTokenCount: 40 })],
    rawExcerptCandidates: [
      makeRawCandidate({ id: "doc-t5:1", approxTokenCount: 40 }),
      makeRawCandidate({ id: "doc-t5:2", approxTokenCount: 40 }),
    ],
  });
  const item = runAsyncAgentWorkItem(createAsyncAgentWorkItemFromProgressiveAssembly({
    conversationId: "thread-ingest",
    conversationDocumentId: "doc-t5",
    controlDecision: decision,
    assembly,
  }));

  assert.equal(item.status, "completed_with_limitations");
  assert.equal(item.result.executedUnapprovedTool, false);
  assert.equal(item.result.limitations.length > 0, true);
});

runTest("highest-fidelity creation plans deliverable creation work with output and validation needs", () => {
  const { decision, assembly } = makeAssembly({
    request: "Create the best possible report from this document.",
    artifactCandidates: [makeArtifactCandidate({ artifactKind: "source_memory", artifactStatus: "active" })],
  });
  const item = createAsyncAgentWorkItemFromProgressiveAssembly({
    conversationId: "thread-create",
    conversationDocumentId: "doc-t5",
    controlDecision: decision,
    assembly,
  });

  assert.equal(item.type, "deliverable_creation_planning");
  assert.equal(item.status, "waiting_for_approval");
  assert.equal(item.budgetSnapshot.creationDepth, "deliverable_grade");
  assert.equal(item.budgetSnapshot.validationDepth, "claim_check");
  assert.equal(item.controlSnapshot.approvalRequiredReasons.includes("exceeds_output_budget"), true);
});

runTest("approval-required control decision waits and does not execute restricted steps", () => {
  const { decision, assembly } = makeAssembly({
    request: "Create the best possible workbook from this document.",
  });
  const item = runAsyncAgentWorkItem(createAsyncAgentWorkItemFromProgressiveAssembly({
    conversationId: "thread-approval",
    controlDecision: decision,
    assembly,
  }));

  assert.equal(item.status, "waiting_for_approval");
  assert.deepEqual(item.result.executedSteps, []);
  assert.equal(item.result.approvalBlockers.length > 0, true);
});

runTest("blocked-by-policy control decision records blocker and prevents execution", () => {
  const { decision, assembly } = makeAssembly({
    request: "Recover the missing table body with OCR.",
    sourceSignals: [
      makeSourceSignal({
        dataClass: "restricted",
        hasWeakArtifact: true,
        recommendedNextCapabilities: ["ocr", "vision_page_understanding"],
      }),
    ],
  });
  const item = runAsyncAgentWorkItem(createAsyncAgentWorkItemFromProgressiveAssembly({
    conversationId: "thread-blocked",
    conversationDocumentId: "doc-t5",
    controlDecision: decision,
    assembly,
  }));

  assert.equal(item.status, "blocked_by_policy");
  assert.deepEqual(item.result.executedSteps, []);
  assert.equal(item.result.policyBlockers.length > 0, true);
});

runTest("async work obeys approved-tool-only governance", () => {
  const { decision, assembly } = makeAssembly({
    request: "Recover the page 15 table body.",
    sourceSignals: [
      makeSourceSignal({
        hasWeakArtifact: true,
        unmetCapabilities: ["ocr"],
        recommendedNextCapabilities: ["ocr"],
      }),
    ],
    artifactCandidates: [makeArtifactCandidate(), makeWarningArtifact()],
  });
  const item = runAsyncAgentWorkItem(createAsyncAgentWorkItemFromProgressiveAssembly({
    conversationId: "thread-governed",
    conversationDocumentId: "doc-t5",
    controlDecision: decision,
    assembly,
  }));

  assert.equal(item.controlSnapshot.toolGovernance.approvedToolsOnly, true);
  assert.equal(item.controlSnapshot.toolGovernance.executedUnapprovedTool, false);
  assert.equal(item.result.executedUnapprovedTool, false);
});

runTest("async work links to reused KnowledgeArtifacts", () => {
  const { decision, assembly } = makeAssembly({
    request: "What is in the water chemistry table body on page 15?",
    sourceSignals: [makeSourceSignal({ hasWeakArtifact: true })],
    artifactCandidates: [makeArtifactCandidate(), makeWarningArtifact()],
  });
  const item = createAsyncAgentWorkItemFromProgressiveAssembly({
    conversationId: "thread-links",
    conversationDocumentId: "doc-t5",
    controlDecision: decision,
    assembly,
  });

  assert.equal(item.artifactLinks.some((link) => link.linkType === "reused"), true);
  assert.equal(item.artifactLinks.some((link) => link.artifactKey === "extraction_warning:15:table_body_missing"), true);
});

runTest("debug trace exposes async work status plan snapshots and deferred capabilities", () => {
  const { decision, assembly } = makeAssembly({
    request: "Recover the page 15 table body.",
    sourceSignals: [makeSourceSignal({ hasWeakArtifact: true })],
    artifactCandidates: [makeArtifactCandidate(), makeWarningArtifact()],
  });
  const item = runAsyncAgentWorkItem(createAsyncAgentWorkItemFromProgressiveAssembly({
    conversationId: "thread-debug",
    conversationDocumentId: "doc-t5",
    controlDecision: decision,
    assembly,
  }));
  const asyncAgentWork = toAsyncAgentWorkDebugSnapshot(item);
  const trace = buildConversationContextDebugTrace({
    conversationId: "thread-debug",
    authority: {
      requestingUserId: "user-1",
      activeUserIds: ["user-1"],
      activeAgentId: "agent-1",
      activeAgentIds: ["agent-1"],
    },
    currentUserPrompt: "Recover the page 15 table body.",
    bundle: makeDebugBundle({
      agentControl: decision,
      progressiveAssembly: assembly,
      asyncAgentWork,
    }),
  });

  assert.equal(trace.asyncAgentWork.status, "completed_with_limitations");
  assert.equal(trace.asyncAgentWork.plannedSteps.some((step) => step.step === "record_deferred_capability"), true);
  assert.equal(trace.asyncAgentWork.deferredCapabilities.some((entry) => entry.capability === "ocr"), true);
  assert.equal(trace.asyncAgentWork.noUnavailableToolExecutionClaimed, true);
  assert.equal(trace.renderedContext.text, null);
});

runTest("idempotency key is stable for the same recommendation", () => {
  const { decision, assembly } = makeAssembly({
    request: "Recover the page 15 table body.",
    sourceSignals: [makeSourceSignal({ hasWeakArtifact: true })],
    artifactCandidates: [makeArtifactCandidate(), makeWarningArtifact()],
  });
  const first = createAsyncAgentWorkItemFromProgressiveAssembly({
    conversationId: "thread-idempotent",
    conversationDocumentId: "doc-t5",
    controlDecision: decision,
    assembly,
  });
  const second = createAsyncAgentWorkItemFromProgressiveAssembly({
    conversationId: "thread-idempotent",
    conversationDocumentId: "doc-t5",
    controlDecision: decision,
    assembly,
  });
  const fakeQueue = [];
  for (const item of [first, second]) {
    if (!fakeQueue.some((entry) => entry.idempotencyKey === item.idempotencyKey)) {
      fakeQueue.push(item);
    }
  }

  assert.equal(first.idempotencyKey, second.idempotencyKey);
  assert.equal(fakeQueue.length, 1);
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
  console.log(`${passed} async-agent-work-queue test(s) passed.`);
}
