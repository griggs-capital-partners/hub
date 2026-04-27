import assert from "node:assert/strict";
import path from "node:path";
import { fileURLToPath } from "node:url";
import createJiti from "jiti";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const jiti = createJiti(import.meta.url, { moduleCache: false });
const {
  EMPTY_CONTEXT_REGISTRY_SELECTION,
  InMemoryCapabilityGapContextDebtRegistry,
  buildAgentControlSourceSignalsFromRegistry,
  buildContextRegistryDebugSnapshot,
  buildContextRegistryPackingCandidates,
  buildRegistryUpsertsFromAsyncAgentWork,
  buildRegistryUpsertsFromProgressiveAssembly,
  buildRegistryUpsertsFromTruthfulExecutionSnapshot,
  mergeContextRegistryBatches,
  upsertTruthfulExecutionRegistryCandidates,
} = jiti(path.join(__dirname, "..", "src", "lib", "capability-gap-context-debt-registry.ts"));
const { evaluateAgentControlSurface } = jiti(
  path.join(__dirname, "..", "src", "lib", "agent-control-surface.ts")
);
const {
  createAsyncAgentWorkItemFromProgressiveAssembly,
  runAsyncAgentWorkItem,
} = jiti(path.join(__dirname, "..", "src", "lib", "async-agent-work-queue.ts"));
const { buildTruthfulExecutionClaimSnapshot } = jiti(
  path.join(__dirname, "..", "src", "lib", "truthful-execution-claim-guard.ts")
);

const tests = [];

function runTest(name, fn) {
  tests.push({ name, fn });
}

function makeSourceSignal(overrides = {}) {
  return {
    sourceId: overrides.sourceId ?? "doc-t5",
    sourceType: overrides.sourceType ?? "pdf",
    filename: overrides.filename ?? "T5 Summary Deck V1.7ext.pdf",
    hasWeakArtifact: overrides.hasWeakArtifact ?? true,
    hasStaleArtifact: overrides.hasStaleArtifact ?? false,
    artifactKinds: overrides.artifactKinds ?? ["table_candidate", "extraction_warning"],
    warningArtifactKinds: overrides.warningArtifactKinds ?? ["extraction_warning"],
    recommendedNextCapabilities:
      overrides.recommendedNextCapabilities ?? [
        "rendered_page_inspection",
        "ocr",
        "vision_page_understanding",
        "document_ai_table_recovery",
      ],
    unmetCapabilities: overrides.unmetCapabilities ?? [],
    sourceCoverageHints: overrides.sourceCoverageHints,
    dataClass: overrides.dataClass ?? "internal",
    containsUntrustedInstructions: false,
    detail: overrides.detail ?? "Weak table memory exists for page 15.",
  };
}

function makeDecision(overrides = {}) {
  const decision = evaluateAgentControlSurface({
    conversationId: overrides.conversationId ?? "conv-a04g",
    request: overrides.request ?? "What does the page 15 table say?",
    sourceSignals: overrides.sourceSignals ?? [makeSourceSignal()],
    policy: overrides.policy,
  });

  return {
    ...decision,
    ...(overrides.patch ?? {}),
    contextBudgetRequest: {
      ...decision.contextBudgetRequest,
      ...(overrides.patch?.contextBudgetRequest ?? {}),
    },
    outputBudgetRequest: {
      ...decision.outputBudgetRequest,
      ...(overrides.patch?.outputBudgetRequest ?? {}),
    },
    toolBudgetRequest: {
      ...decision.toolBudgetRequest,
      ...(overrides.patch?.toolBudgetRequest ?? {}),
    },
    approvalRequiredReasons:
      overrides.patch?.approvalRequiredReasons ?? decision.approvalRequiredReasons,
    blockedByPolicyReasons:
      overrides.patch?.blockedByPolicyReasons ?? decision.blockedByPolicyReasons,
  };
}

function makeArtifactCandidate(overrides = {}) {
  const artifactKey = overrides.artifactKey ?? "table_candidate:15";
  return {
    id: overrides.id ?? `doc-t5:artifact:${artifactKey}`,
    kind: "artifact",
    sourceId: overrides.sourceId ?? "doc-t5",
    sourceType: "pdf",
    label: overrides.label ?? "Likely table detected on page 15",
    content:
      overrides.content ??
      "Likely true data table detected on page 15. The parser did not recover a structured table body. Do not infer missing columns, cells, or headers.",
    approxTokenCount: 48,
    priority: 90,
    confidence: 0.68,
    artifactKind: overrides.artifactKind ?? "table_candidate",
    artifactStatus: overrides.artifactStatus ?? "warning",
    locationLabel: overrides.locationLabel ?? "T5 Summary Deck V1.7ext.pdf - page 15 - Smackover Water Chemistry",
    provenance: {
      artifactKey,
      pageNumberStart: 15,
      ...(overrides.provenance ?? {}),
    },
    rankingHints: ["page 15", "table", "water chemistry"],
    required: overrides.required ?? false,
    metadata: {
      artifactKey,
      pageNumberStart: 15,
      ...(overrides.metadata ?? {}),
    },
  };
}

function makeGap(overrides = {}) {
  return {
    id: overrides.id ?? "gap-page-15-table-body",
    kind: overrides.kind ?? "missing_table_body",
    sourceId: overrides.sourceId ?? "doc-t5",
    candidateId: overrides.candidateId ?? "doc-t5:artifact:table_candidate:15",
    severity: overrides.severity ?? "warning",
    summary: overrides.summary ?? "Table body is missing from durable memory.",
    detail:
      overrides.detail ??
      "Existing table_candidate / extraction_warning artifacts were reused, but approved built-in parser tools did not recover the rendered table body.",
    requiredCapability: overrides.requiredCapability ?? "document_ai_table_recovery",
    recommendedCapabilities:
      overrides.recommendedCapabilities ?? [
        "rendered_page_inspection",
        "ocr",
        "vision_page_understanding",
        "document_ai_table_recovery",
      ],
    budgetTokensNeeded: overrides.budgetTokensNeeded ?? null,
    requiresApproval: overrides.requiresApproval ?? false,
    asyncRecommended: overrides.asyncRecommended ?? true,
    metadata: overrides.metadata ?? { pageNumber: 15, approvedBuiltInToolsEnough: false },
  };
}

function makeAssembly({ decision, gaps, candidates, sourceCoverageTarget } = {}) {
  const resolvedDecision = decision ?? makeDecision();
  const selectedCandidates = candidates ?? [
    makeArtifactCandidate(),
    makeArtifactCandidate({
      artifactKey: "extraction_warning:15:table_body_missing",
      id: "doc-t5:artifact:extraction_warning:15:table_body_missing",
      artifactKind: "extraction_warning",
      label: "Extraction warning on page 15",
    }),
  ];
  const resolvedGaps = gaps ?? [
    makeGap(),
    makeGap({
      id: "gap-page-15-extraction-warning",
      candidateId: "doc-t5:artifact:extraction_warning:15:table_body_missing",
    }),
  ];

  return {
    plan: {
      id: "assembly-a04g",
      controlDecisionId: resolvedDecision.decisionId,
      taskFidelityLevel: resolvedDecision.taskFidelityLevel,
      runtimeBudgetProfile: resolvedDecision.runtimeBudgetProfile,
      executionMode: resolvedDecision.executionMode,
      inspectionDepth: resolvedDecision.inspectionDepth,
      creationDepth: resolvedDecision.creationDepth,
      validationDepth: resolvedDecision.validationDepth,
      memoryDensity: resolvedDecision.memoryDensity,
      sourceCoverageTarget: sourceCoverageTarget ?? resolvedDecision.sourceCoverageTarget,
      memoryRefreshDepth: resolvedDecision.memoryRefreshDepth,
      allowedContextBudgetTokens: resolvedDecision.contextBudgetRequest.grantedTokens,
      allowedToolCalls: resolvedDecision.toolBudgetRequest.grantedToolCalls,
      passes: [],
      expansionRequests: [],
      refreshRequests: [],
      stopReason: "async_recommended",
      detail: "Test assembly for A-04g registry.",
    },
    passResults: [],
    packingRequests: [],
    packingResults: [],
    artifactReuseDecisions: [],
    sourceExpansionDecisions: [],
    expandedContextBundle: {
      selectedCandidates,
      selectedArtifactIds: selectedCandidates.map((candidate) => candidate.id),
      selectedExcerptIds: [],
      selectedSourceIds: ["doc-t5"],
      selectedInspectionResultIds: [],
      excludedCandidates: [],
      budgetUsedTokens: 160,
      budgetRemainingTokens: 400,
      limitations: ["Current parser memory lacks the rendered table body."],
    },
    gaps: resolvedGaps,
    contextDebtCandidates: resolvedGaps.map((gap) => ({
      id: `context_debt:${gap.id}`,
      gapId: gap.id,
      sourceId: gap.sourceId,
      reason: gap.summary,
      resolvingCapabilities: gap.recommendedCapabilities,
      requiresApproval: gap.requiresApproval,
      asyncRecommended: gap.asyncRecommended,
      shouldPersistLater: true,
      priority: "high",
      detail: gap.detail,
    })),
    sufficiency: {
      status: "sufficient_with_limitations",
      readyForAnswer: true,
      confidence: 0.62,
      reasons: ["Known weak table artifact."],
      limitations: ["Table body recovery remains unavailable."],
      gaps: resolvedGaps,
    },
    stopReason: "async_recommended",
    recommendedNextAction: "recommend_async_job",
    traceEvents: [],
    packingTraceEvents: [],
    metrics: {
      contextBudgetUsedTokens: 160,
      contextBudgetRemainingTokens: 400,
      toolCallsUsed: 0,
      toolCallsRemaining: resolvedDecision.toolBudgetRequest.grantedToolCalls,
    },
  };
}

function makeTruthfulSnapshot(overrides = {}) {
  return {
    executedTools: overrides.executedTools ?? [],
    deferredCapabilities: overrides.deferredCapabilities ?? ["ocr"],
    recommendedCapabilities: overrides.recommendedCapabilities ?? ["rendered_page_inspection"],
    unavailableCapabilities: overrides.unavailableCapabilities ?? ["vision_page_understanding"],
    asyncWorkCreated: overrides.asyncWorkCreated ?? false,
    asyncWorkStatus: overrides.asyncWorkStatus ?? null,
    asyncWorkType: overrides.asyncWorkType ?? null,
    asyncWorkExecutedSteps: overrides.asyncWorkExecutedSteps ?? [],
    asyncWorkDeferredSteps: overrides.asyncWorkDeferredSteps ?? [],
    createdArtifactKeys: overrides.createdArtifactKeys ?? [],
    reusedArtifactKeys: overrides.reusedArtifactKeys ?? [],
    persistedMemoryUpdates: overrides.persistedMemoryUpdates ?? [],
    inspectionTaskResults: overrides.inspectionTaskResults ?? [],
    contextGapKinds: overrides.contextGapKinds ?? ["missing_table_body"],
    limitations: overrides.limitations ?? [],
    capabilityAudit: overrides.capabilityAudit ?? [],
  };
}

runTest("creates T5 page 15 context debt and capability gaps without claiming unavailable execution", () => {
  const decision = makeDecision();
  const assembly = makeAssembly({ decision });
  const batch = buildRegistryUpsertsFromProgressiveAssembly({
    conversationId: "conv-a04g",
    conversationDocumentId: "doc-t5",
    agentControl: decision,
    assembly,
  });

  assert.equal(batch.contextDebtRecords.length, 1);
  const debt = batch.contextDebtRecords[0];
  assert.equal(debt.kind, "missing_table_body");
  assert.equal(debt.sourceScope, "page");
  assert.equal(debt.sourceLocator.pageNumber, 15);
  assert.equal(debt.severity, "high");
  assert.ok(debt.linkedArtifactKeys.includes("table_candidate:15"));
  assert.ok(debt.linkedArtifactKeys.includes("extraction_warning:15:table_body_missing"));
  assert.deepEqual(debt.deferredCapabilities.sort(), [
    "document_ai_table_recovery",
    "ocr",
    "rendered_page_inspection",
    "vision_page_understanding",
  ].sort());
  assert.ok(debt.resolutionPaths.includes("rendered_page_inspection_needed"));
  assert.ok(debt.resolutionPaths.includes("ocr_needed"));
  assert.ok(debt.resolutionPaths.includes("vision_needed"));
  assert.ok(debt.resolutionPaths.includes("document_ai_needed"));
  assert.equal(debt.evidence.noUnavailableToolExecutionClaimed, true);

  const gapsByKind = new Map(batch.capabilityGapRecords.map((gap) => [gap.kind, gap]));
  assert.equal(gapsByKind.get("missing_context_lane")?.neededCapability, "rendered_page_image");
  assert.equal(gapsByKind.get("missing_tool")?.missingToolId, "ocr");
  assert.equal(gapsByKind.get("missing_model_capability")?.missingModelCapability, "native_image_input");
  for (const capability of ["rendered_page_image", "ocr", "vision_page_understanding", "document_ai_table_recovery"]) {
    const gap = batch.capabilityGapRecords.find((record) => record.neededCapability === capability);
    assert.ok(gap, `expected capability gap for ${capability}`);
    assert.ok(gap.benchmarkFixtureIds.includes("t5_pdf_page_15_visible_table"));
    assert.equal(gap.evidence.executionClaimed, false);
  }
});

runTest("upserts avoid duplicates and preserve links, async work, source coverage, and open selection", () => {
  const registry = new InMemoryCapabilityGapContextDebtRegistry();
  const decision = makeDecision();
  const assembly = makeAssembly({ decision });
  const progressiveBatch = buildRegistryUpsertsFromProgressiveAssembly({
    conversationId: "conv-a04g",
    conversationDocumentId: "doc-t5",
    agentControl: decision,
    assembly,
  });
  const workItem = runAsyncAgentWorkItem(
    createAsyncAgentWorkItemFromProgressiveAssembly({
      conversationId: "conv-a04g",
      conversationDocumentId: "doc-t5",
      createdById: "user-1",
      request: "What does the page 15 table say?",
      controlDecision: decision,
      assembly,
    })
  );
  const asyncBatch = buildRegistryUpsertsFromAsyncAgentWork({
    conversationId: "conv-a04g",
    conversationDocumentId: "doc-t5",
    item: workItem,
  });

  registry.upsertBatch(mergeContextRegistryBatches(progressiveBatch, asyncBatch));
  registry.upsertBatch(mergeContextRegistryBatches(progressiveBatch, asyncBatch));
  const selected = registry.selectOpen({ conversationId: "conv-a04g", conversationDocumentIds: ["doc-t5"] });

  assert.equal(selected.contextDebtRecords.length, 1);
  assert.equal(selected.contextDebtRecords[0].asyncAgentWorkItemId, workItem.id);
  assert.ok(selected.capabilityGapRecords.some((gap) => gap.asyncAgentWorkItemId === workItem.id));
  assert.ok(selected.capabilityGapRecords.some((gap) => gap.relatedContextDebtId === selected.contextDebtRecords[0].id));
  assert.ok(selected.sourceCoverageRecords.length >= 1);
  assert.ok(selected.contextDebtRecords[0].deferredCapabilities.includes("ocr"));
});

runTest("truthful guard evidence creates debt/gaps and registry evidence feeds later guard snapshots", () => {
  const batch = buildRegistryUpsertsFromTruthfulExecutionSnapshot({
    conversationId: "conv-a04g",
    conversationDocumentId: "doc-t5",
    snapshot: makeTruthfulSnapshot(),
  });
  assert.ok(batch.contextDebtRecords.some((debt) => debt.kind === "missing_table_body"));
  assert.ok(batch.capabilityGapRecords.some((gap) => gap.neededCapability === "rendered_page_image"));
  assert.ok(batch.capabilityGapRecords.some((gap) => gap.neededCapability === "ocr"));
  assert.ok(batch.capabilityGapRecords.every((gap) => gap.evidence.executionClaimed === false));

  const registry = new InMemoryCapabilityGapContextDebtRegistry();
  const selected = registry.upsertBatch(batch);
  const debug = buildContextRegistryDebugSnapshot(selected);
  const truthful = buildTruthfulExecutionClaimSnapshot({
    debugTrace: {
      contextRegistry: debug,
    },
  });
  assert.ok(truthful.contextGapKinds.includes("missing_table_body"));
  assert.ok(truthful.recommendedCapabilities.includes("ocr"));
  assert.ok(truthful.recommendedCapabilities.includes("rendered_page_image"));
});

runTest("highest-fidelity ingestion and creation produce durable debt, coverage, and capability proposals", () => {
  const ingestionDecision = makeDecision({
    request: "Ingest this document at the highest level with all pages and all tables.",
  });
  assert.equal(ingestionDecision.taskFidelityLevel, "highest_fidelity_ingestion");
  const ingestionAssembly = makeAssembly({
    decision: ingestionDecision,
    sourceCoverageTarget: "all_tables",
    gaps: [
      makeGap({ kind: "insufficient_source_coverage", id: "gap-all-tables", candidateId: null }),
      makeGap({ kind: "async_recommended", id: "gap-async", candidateId: null, recommendedCapabilities: [] }),
    ],
  });
  const ingestionBatch = buildRegistryUpsertsFromProgressiveAssembly({
    conversationId: "conv-ingest",
    conversationDocumentId: "doc-t5",
    agentControl: ingestionDecision,
    assembly: ingestionAssembly,
  });
  assert.ok(ingestionBatch.contextDebtRecords.some((debt) => debt.kind === "incomplete_source_coverage"));
  assert.ok(ingestionBatch.contextDebtRecords.some((debt) => debt.kind === "async_required"));
  assert.ok(ingestionBatch.sourceCoverageRecords.some((record) => record.coverageStatus === "partially_inspected"));
  assert.ok(ingestionBatch.capabilityGapRecords.some((gap) => gap.neededCapability === "native_pdf_input"));
  assert.ok(ingestionBatch.capabilityGapRecords.some((gap) => gap.kind === "missing_artifact_type"));

  const creationDecision = makeDecision({
    request: "Create the best possible report from this document.",
    patch: {
      approvalRequired: true,
      approvalRequiredReasons: ["audit_grade_required"],
      contextBudgetRequest: { exceedsPolicy: true },
    },
  });
  const creationAssembly = makeAssembly({
    decision: creationDecision,
    gaps: [
      makeGap({ kind: "output_budget_insufficient", id: "gap-output", candidateId: null, recommendedCapabilities: [] }),
      makeGap({ kind: "insufficient_source_coverage", id: "gap-coverage", candidateId: null }),
      makeGap({ kind: "approval_required", id: "gap-approval", candidateId: null, recommendedCapabilities: [] }),
    ],
  });
  const creationBatch = buildRegistryUpsertsFromProgressiveAssembly({
    conversationId: "conv-create",
    conversationDocumentId: "doc-t5",
    agentControl: creationDecision,
    assembly: creationAssembly,
  });
  assert.ok(creationBatch.contextDebtRecords.some((debt) => debt.kind === "output_budget_gap"));
  assert.ok(creationBatch.contextDebtRecords.some((debt) => debt.kind === "approval_required"));
  assert.ok(creationBatch.capabilityGapRecords.some((gap) => gap.kind === "missing_creation_capability"));
  assert.ok(creationBatch.capabilityGapRecords.some((gap) => gap.kind === "missing_validation_capability"));
  assert.ok(creationBatch.capabilityGapRecords.some((gap) => gap.kind === "missing_approval_path"));
  assert.ok(creationBatch.capabilityGapRecords.some((gap) => gap.kind === "missing_budget_profile"));
});

runTest("resolved and dismissed records are not selected, while open debt/gaps become context/control signals", () => {
  const registry = new InMemoryCapabilityGapContextDebtRegistry();
  const decision = makeDecision();
  const openBatch = buildRegistryUpsertsFromProgressiveAssembly({
    conversationId: "conv-select",
    conversationDocumentId: "doc-t5",
    agentControl: decision,
    assembly: makeAssembly({ decision }),
  });
  const inactiveBatch = {
    contextDebtRecords: openBatch.contextDebtRecords.map((debt) => ({
      ...debt,
      debtKey: `${debt.debtKey}:resolved`,
      status: "resolved",
    })),
    capabilityGapRecords: openBatch.capabilityGapRecords.map((gap) => ({
      ...gap,
      gapKey: `${gap.gapKey}:dismissed`,
      status: "dismissed",
    })),
    sourceCoverageRecords: [],
  };
  registry.upsertBatch(mergeContextRegistryBatches(openBatch, inactiveBatch));
  const selected = registry.selectOpen({ conversationId: "conv-select", conversationDocumentIds: ["doc-t5"] });
  assert.ok(selected.contextDebtRecords.every((debt) => debt.status !== "resolved"));
  assert.ok(selected.capabilityGapRecords.every((gap) => gap.status !== "dismissed"));

  const candidates = buildContextRegistryPackingCandidates(selected);
  assert.ok(candidates.some((candidate) => candidate.content.includes("These have not executed")));
  const signals = buildAgentControlSourceSignalsFromRegistry(selected);
  assert.ok(signals.some((signal) => signal.hasWeakArtifact));

  const debug = buildContextRegistryDebugSnapshot(selected);
  assert.equal(debug.noUnavailableToolExecutionClaimed, true);
  assert.ok(debug.contextDebt.selectedRecords.length > 0);
  assert.ok(debug.capabilityGaps.selectedRecords.length > 0);
});

runTest("empty registry selection remains safe for resolver defaults", () => {
  assert.deepEqual(EMPTY_CONTEXT_REGISTRY_SELECTION.contextDebtRecords, []);
  assert.deepEqual(EMPTY_CONTEXT_REGISTRY_SELECTION.capabilityGapRecords, []);
  assert.deepEqual(EMPTY_CONTEXT_REGISTRY_SELECTION.sourceCoverageRecords, []);

  const auditOnly = buildRegistryUpsertsFromTruthfulExecutionSnapshot({
    conversationId: "conv-audit-only",
    snapshot: makeTruthfulSnapshot({
      deferredCapabilities: [],
      recommendedCapabilities: [],
      unavailableCapabilities: ["ocr", "vision_page_understanding"],
      contextGapKinds: [],
      limitations: [],
    }),
  });
  assert.equal(auditOnly.contextDebtRecords.length, 0);
  assert.equal(auditOnly.capabilityGapRecords.length, 0);

  return upsertTruthfulExecutionRegistryCandidates({
    conversationId: "conv-audit-only",
    snapshot: makeTruthfulSnapshot({
      deferredCapabilities: [],
      recommendedCapabilities: [],
      unavailableCapabilities: ["ocr"],
      contextGapKinds: [],
      limitations: [],
    }),
  }).then((selection) => {
    assert.deepEqual(selection, EMPTY_CONTEXT_REGISTRY_SELECTION);
  });
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
