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
  buildDurableEmissionDebugSummary,
  buildRegistryUpsertsFromAgentWorkPlan,
  buildRegistryUpsertsFromAsyncAgentWork,
  buildRegistryUpsertsFromContextTransport,
  buildRegistryUpsertsFromProgressiveAssembly,
  buildRegistryUpsertsFromSourceObservationProducerResults,
  buildRegistryUpsertsFromTruthfulExecutionSnapshot,
  mergeContextRegistryBatches,
  upsertTruthfulExecutionRegistryCandidates,
} = jiti(path.join(__dirname, "..", "src", "lib", "capability-gap-context-debt-registry.ts"));
const { buildAgentWorkPlanFromControlDecision, evaluateAgentControlSurface } = jiti(
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

function makeTransportResult(overrides = {}) {
  const payload = {
    id: "payload-rendered-page",
    type: "rendered_page_image",
    payloadClass: "source",
    label: "Doc B rendered page candidate",
    sourceId: "doc-b",
    sourceType: "pdf",
    representation: "image",
    text: null,
    data: null,
    binaryRef: null,
    approxTokens: 180,
    confidence: null,
    provenance: {
      sourceId: "doc-b",
      sourceType: "pdf",
      sourceDocumentId: "doc-b",
      location: { pageNumber: 7, locationLabel: "Doc B page 7" },
    },
    ownership: { scope: "thread" },
    policy: {
      allowedNow: true,
      requiresApproval: false,
      restrictions: [],
      reason: "Test payload.",
    },
    persistence: {
      artifactEligible: false,
      sourceObservationEligible: false,
      alreadyPersisted: false,
      persistenceKey: null,
    },
    metadata: { pageNumber: 7 },
  };
  const debugSnapshot = {
    planId: overrides.planId ?? "context-transport:wp2",
    agentWorkPlanId: overrides.agentWorkPlanId ?? "agent-work-plan:wp2",
    agentWorkPlanTraceId: overrides.agentWorkPlanTraceId ?? "agent-work-trace:wp2",
    selectedPayloadIds: [],
    selectedPayloadTypes: [],
    excludedPayloads: [
      {
        payloadId: payload.id,
        payloadType: payload.type,
        requirementId: "req-rendered",
        reason: "model_payload_unsupported",
        detail: "Requested model cannot consume rendered page images.",
        boundary: "model_capability",
      },
      {
        payloadId: payload.id,
        payloadType: payload.type,
        requirementId: "req-rendered-budget",
        reason: "budget_exhausted",
        detail: "Rendered page payload was excluded because the transport budget was exhausted.",
        estimatedTokensNeeded: 180,
        boundary: "a03_budget",
      },
    ],
    missingPayloadCapabilities: [
      {
        payloadType: "ocr_text",
        sourceId: "doc-a",
        reason: "OCR text payload is needed but unavailable in this runtime.",
        requiresApproval: false,
        asyncRecommended: true,
      },
    ],
    missingContextLaneProposals: [
      {
        id: "missing-code-analysis-lane",
        missingPayloadType: "code_analysis_result",
        candidateContextLanes: ["code_analysis_result"],
        status: "known_missing",
        reason: "Code analysis payload lane is cataloged as future tooling only.",
        boundary: "future_tool_boundary",
      },
    ],
    budgetUsedByPayloadClass: {},
    relationshipToA03PackingKernel: "transport_wraps_a03",
    payloadPersistence: {
      artifactEligiblePayloadIds: [],
      sourceObservationEligiblePayloadIds: [],
      alreadyPersistedPayloadIds: [],
    },
    catalogDebugSnapshot: null,
    visualInspectionDebugSnapshot: null,
    negotiationDecisions: [],
    modelCapabilityManifestUsed: {
      manifestId: "model-manifest:test",
      modelId: "test-model",
      provider: "test",
      acceptedPayloadTypes: ["text_excerpt"],
      preferredRepresentations: ["text"],
      unavailableLanes: [
        {
          laneId: "native_file_lane",
          payloadTypes: ["native_file_reference"],
          reason: "Native file payload support is not available for this model.",
        },
      ],
      nativePayloadSupport: [
        {
          payloadType: "native_file_reference",
          supported: false,
          reason: "Native model file lane unavailable.",
        },
      ],
      capabilityFlags: {},
      notes: [],
    },
    traceEvents: [],
    noUnavailableToolExecutionClaimed: true,
  };

  return {
    plan: {
      planId: debugSnapshot.planId,
      availablePayloads: [payload],
    },
    debugSnapshot,
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

runTest("AgentWorkPlan needs produce durable gap, debt, coverage, async, and attribution candidates", () => {
  const sourceSignals = [
    makeSourceSignal({
      sourceId: "doc-a",
      filename: "Doc A.pdf",
      unmetCapabilities: ["ocr", "rendered_page_inspection"],
      detail: "Doc A needs OCR and rendered page inspection for page-level coverage.",
    }),
    makeSourceSignal({
      sourceId: "doc-b",
      filename: "Doc B.pdf",
      unmetCapabilities: ["source_connector_read"],
      detail: "Doc B needs governed connector retrieval before deep inspection.",
    }),
  ];
  const decision = makeDecision({
    conversationId: "conv-wp2",
    request: "Inspect both documents deeply and recover missing table evidence.",
    sourceSignals,
    patch: {
      asyncRecommended: true,
      asyncRecommendedReason: "The work is too deep for synchronous execution.",
      executionMode: "async_recommended",
    },
  });
  const workPlan = buildAgentWorkPlanFromControlDecision({
    conversationId: "conv-wp2",
    messageId: "msg-wp2",
    request: "Inspect both documents deeply and recover missing table evidence.",
    decision,
    sourceSignals,
  });
  const enrichedWorkPlan = {
    ...workPlan,
    asyncRecommendation: {
      state: "deferred",
      recommended: true,
      reason: "Async deep work is recommended, but no worker execution is part of WP2.",
    },
    capabilityNeeds: [
      ...workPlan.capabilityNeeds,
      {
        capability: "code_repository_inspection",
        state: "deferred",
        payloadTypes: ["code_analysis_result"],
        requiresApproval: false,
        asyncRecommended: true,
        reason: "Python/code analysis capability is needed later but unavailable now.",
        executionEvidenceIds: [],
        noExecutionClaimed: true,
      },
      {
        capability: "source_connector_read",
        state: "approval_required",
        payloadTypes: ["native_file_reference"],
        requiresApproval: true,
        asyncRecommended: false,
        reason: "Connector read needs a governed approval path.",
        executionEvidenceIds: [],
        noExecutionClaimed: true,
      },
      {
        capability: "ocr",
        state: "executed",
        payloadTypes: ["ocr_text"],
        requiresApproval: false,
        asyncRecommended: false,
        reason: "Executed-only capability needs must not become proposal records.",
        executionEvidenceIds: ["tool:ocr-test"],
        noExecutionClaimed: true,
      },
    ],
    modelCapabilityNeeds: [
      {
        ...workPlan.modelCapabilityNeeds[0],
        capability: "native_file_payload_support",
        state: "unavailable",
        requiresProviderChange: true,
        acceptedPayloadTypes: ["text_excerpt"],
        unavailablePayloadTypes: ["native_file_reference", "rendered_page_image"],
        reason: "The current model profile cannot consume native files or rendered page images.",
      },
    ],
    truthfulLimitations: [
      ...workPlan.truthfulLimitations,
      {
        id: "truthful-python-needed",
        state: "deferred",
        summary: "Python analysis is needed later, but no Python execution occurred.",
        capability: "code_repository_inspection",
        sourceId: "doc-b",
        traceEventIds: [],
      },
    ],
  };

  const batch = buildRegistryUpsertsFromAgentWorkPlan({
    conversationId: "conv-wp2",
    conversationDocumentId: null,
    asyncState: "recommended",
    agentWorkPlan: enrichedWorkPlan,
    conversationDocumentIdsBySourceId: {
      "doc-a": "doc-a",
      "doc-b": "doc-b",
    },
  });

  assert.ok(batch.contextDebtRecords.some((debt) => debt.kind === "async_required"));
  assert.ok(batch.contextDebtRecords.some((debt) => debt.evidence.truthfulLimitation?.id === "truthful-python-needed"));
  assert.ok(batch.capabilityGapRecords.some((gap) => gap.kind === "missing_connector"));
  assert.ok(batch.capabilityGapRecords.some((gap) => gap.neededCapability === "code_repository_inspection"));
  assert.ok(batch.capabilityGapRecords.some((gap) => gap.missingPayloadType === "native_file_reference"));
  assert.ok(batch.capabilityGapRecords.every((gap) => gap.evidence.capabilityNeed?.state !== "executed"));
  assert.ok(batch.sourceCoverageRecords.some((record) => record.conversationDocumentId === "doc-a"));
  assert.ok(batch.sourceCoverageRecords.some((record) => record.conversationDocumentId === "doc-b"));
  assert.ok(batch.sourceCoverageRecords.every((record) => record.coverageStatus !== "inspected"));
  assert.ok(batch.sourceCoverageRecords.every((record) => record.inspectedBy.length === 0));
  assert.ok(batch.contextDebtRecords.every((debt) => debt.evidence.executionClaimed !== true));
  assert.ok(batch.capabilityGapRecords.every((gap) => gap.evidence.executionClaimed === false));
});

runTest("ContextTransport missing lanes and model incompatibilities produce durable proposal candidates", () => {
  const batch = buildRegistryUpsertsFromContextTransport({
    conversationId: "conv-wp2-transport",
    conversationDocumentId: null,
    transport: makeTransportResult(),
    conversationDocumentIdsBySourceId: {
      "doc-a": "doc-a",
      "doc-b": "doc-b",
    },
  });

  const ocrGap = batch.capabilityGapRecords.find((gap) => gap.missingPayloadType === "ocr_text");
  assert.ok(ocrGap);
  assert.equal(ocrGap.conversationDocumentId, "doc-a");
  assert.equal(ocrGap.status, "detected");
  assert.equal(ocrGap.evidence.executionClaimed, false);

  const modelGap = batch.capabilityGapRecords.find((gap) => gap.missingModelCapability === "accepts:rendered_page_image");
  assert.ok(modelGap);
  assert.equal(modelGap.conversationDocumentId, "doc-b");
  assert.equal(modelGap.kind, "missing_model_capability");

  assert.ok(batch.capabilityGapRecords.some((gap) => gap.missingPayloadType === "code_analysis_result"));
  assert.ok(batch.capabilityGapRecords.some((gap) => gap.missingPayloadType === "native_file_reference"));
  assert.ok(batch.contextDebtRecords.some((debt) => debt.sourceLocator.pageNumber === 7));
  assert.ok(batch.contextDebtRecords.every((debt) => debt.evidence.executionClaimed === false));
});

runTest("durable emission summary reports merged, deduped, source-linked, and ambiguous candidates", () => {
  const sourceSignals = [
    makeSourceSignal({
      sourceId: "doc-a",
      unmetCapabilities: ["ocr"],
      detail: "Doc A still needs OCR.",
    }),
  ];
  const decision = makeDecision({
    conversationId: "conv-wp2-summary",
    sourceSignals,
    patch: {
      asyncRecommended: true,
      asyncRecommendedReason: "Async follow-up is useful.",
      executionMode: "async_recommended",
    },
  });
  const workPlan = buildAgentWorkPlanFromControlDecision({
    conversationId: "conv-wp2-summary",
    request: "Recover table body.",
    decision,
    sourceSignals,
  });
  const agentBatch = buildRegistryUpsertsFromAgentWorkPlan({
    conversationId: "conv-wp2-summary",
    agentWorkPlan: workPlan,
    conversationDocumentIdsBySourceId: { "doc-a": "doc-a" },
  });
  const transportBatch = buildRegistryUpsertsFromContextTransport({
    conversationId: "conv-wp2-summary",
    transport: makeTransportResult(),
    conversationDocumentIdsBySourceId: { "doc-a": "doc-a", "doc-b": "doc-b" },
  });
  const sourceBatches = [
    { source: "agent_work_plan", batch: agentBatch },
    { source: "adaptive_transport", batch: transportBatch },
  ];
  const combined = mergeContextRegistryBatches(...sourceBatches.map((entry) => entry.batch));
  const registry = new InMemoryCapabilityGapContextDebtRegistry();
  const first = registry.upsertBatch(combined);
  const firstSummary = buildDurableEmissionDebugSummary({
    sourceBatches,
    candidateBatch: combined,
    persistedSelection: first,
    priorSelection: EMPTY_CONTEXT_REGISTRY_SELECTION,
  });
  const second = registry.upsertBatch(combined);
  const secondSummary = buildDurableEmissionDebugSummary({
    sourceBatches,
    candidateBatch: combined,
    persistedSelection: second,
    priorSelection: first,
  });
  const debug = buildContextRegistryDebugSnapshot(second, { durableEmission: secondSummary });

  assert.ok(firstSummary.candidateCount > 0);
  assert.ok(firstSummary.createdOrPersistedCount > 0);
  assert.ok(secondSummary.updatedOrMergedCount > 0);
  assert.ok(secondSummary.dedupedOrAlreadyExistingCount > 0);
  assert.ok(secondSummary.topMissingPayloadLanes.includes("ocr_text"));
  assert.ok(secondSummary.recordsLinkedToDocumentCount > 0);
  assert.ok(secondSummary.ambiguousAttributionCount > 0);
  assert.equal(debug.durableEmission.candidateCount, secondSummary.candidateCount);
  assert.equal(debug.durableEmission.noUnavailableToolExecutionClaimed, true);
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

runTest("async candidate source coverage remains uninspected without execution evidence", () => {
  const decision = makeDecision({
    conversationId: "conv-async-truthful",
    patch: {
      asyncRecommended: true,
      asyncRecommendedReason: "A staged follow-up is recommended.",
      executionMode: "async_recommended",
    },
  });
  const assembly = makeAssembly({ decision });
  const queuedItem = createAsyncAgentWorkItemFromProgressiveAssembly({
    conversationId: "conv-async-truthful",
    conversationDocumentId: "doc-t5",
    createdById: "user-1",
    request: "Inspect the table later.",
    controlDecision: decision,
    assembly,
  });
  const queuedBatch = buildRegistryUpsertsFromAsyncAgentWork({
    conversationId: "conv-async-truthful",
    conversationDocumentId: "doc-t5",
    item: queuedItem,
  });
  const completedWithoutToolsBatch = buildRegistryUpsertsFromAsyncAgentWork({
    conversationId: "conv-async-truthful",
    conversationDocumentId: "doc-t5",
    item: runAsyncAgentWorkItem(queuedItem),
  });

  assert.ok(queuedBatch.sourceCoverageRecords.length > 0);
  assert.ok(queuedBatch.sourceCoverageRecords.every((record) => record.coverageStatus !== "inspected"));
  assert.ok(queuedBatch.sourceCoverageRecords.every((record) => record.inspectedBy.length === 0));
  assert.ok(completedWithoutToolsBatch.sourceCoverageRecords.every((record) => record.evidence.inspectedCoverageUpdated === false));
  assert.ok(completedWithoutToolsBatch.sourceCoverageRecords.every((record) => record.inspectedBy.length === 0));
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

runTest("routes unresolved SourceObservation producer results into existing durable debt and gaps", () => {
  const batch = buildRegistryUpsertsFromSourceObservationProducerResults({
    conversationId: "conv-producer",
    conversationDocumentId: "doc-t5",
    results: [
      {
        requestId: "producer-request-table",
        request: {
          id: "producer-request-table",
          traceId: "trace-producer",
          planId: "plan-producer",
          conversationId: "conv-producer",
          messageId: "msg-producer",
          conversationDocumentId: "doc-t5",
          sourceId: "doc-t5",
          sourceKind: "pdf_page",
          sourceLocator: {
            pageNumberStart: 15,
            pageLabelStart: "15",
            tableId: "table-1",
            sourceLocationLabel: "T5 page 15 table",
          },
          requestedObservationType: "structured_table_observation",
          requestedCapabilityId: "pdf_table_body_recovery",
          requestedPayloadType: "structured_table",
          reason: "Parser detected a table but no body was recovered.",
          priority: "high",
          severity: "high",
          sourceNeedId: "need-table",
          workPlanDecisionId: null,
          transportLaneNeed: null,
          approvalPath: null,
          producerId: "existing_parser_text_extraction",
          input: null,
          noExecutionClaimed: true,
        },
        producerId: "existing_parser_text_extraction",
        capabilityId: "pdf_table_body_recovery",
        state: "missing",
        resolution: {
          state: "missing",
          producerId: "existing_parser_text_extraction",
          capabilityId: "pdf_table_body_recovery",
          payloadType: "structured_table",
          governedBy: [
            "context-catalog-bootstrap",
            "inspection-tool-broker",
            "adaptive-context-transport",
          ],
          catalogPayloadType: "structured_table",
          catalogLaneId: "document_ai_table_lane",
          brokerCapabilityId: "pdf_table_body_recovery",
          availabilitySources: ["producer_manifest", "source_evidence"],
          primaryAvailabilitySource: "producer_manifest",
          availabilityDetails: [],
          executableNow: true,
          reason: "No completed structured table observation exists in current deterministic evidence.",
          evidenceSummary: null,
          missingRequirements: ["document_ai_table_recovery"],
          approvalPath: null,
          sourceLocator: {
            pageNumberStart: 15,
            pageLabelStart: "15",
            tableId: "table-1",
          },
          traceId: "trace-producer",
          planId: "plan-producer",
          requiresApproval: false,
          blockedByPolicy: false,
          asyncRecommended: false,
          asyncSuitability: {
            recommended: false,
            reason: null,
          },
          noExecutionClaimed: true,
        },
        observations: [],
        observationIds: [],
        output: null,
        unresolvedNeeds: [
          {
            id: "producer-need-table",
            observationType: "structured_table_observation",
            sourceId: "doc-t5",
            conversationDocumentId: "doc-t5",
            capability: "pdf_table_body_recovery",
            payloadType: "structured_table",
            state: "unavailable",
            reason: "Table body recovery could not complete from current deterministic evidence.",
            noExecutionClaimed: true,
          },
          {
            id: "producer-need-ocr",
            observationType: "ocr_text",
            sourceId: "doc-t5",
            conversationDocumentId: "doc-t5",
            capability: "ocr",
            payloadType: "ocr_text",
            state: "unavailable",
            reason: "OCR is unavailable in WP3B.",
            noExecutionClaimed: true,
          },
        ],
        evidence: null,
        reason: "No completed structured table observation exists in current deterministic evidence.",
        recommendedResolution: "Route this unresolved producer result through existing durable gap/debt emission.",
        requiresApproval: false,
        asyncRecommended: false,
        noExecutionClaimed: true,
      },
    ],
  });

  assert.ok(batch.contextDebtRecords.some((debt) => debt.kind === "missing_table_body"));
  assert.ok(batch.capabilityGapRecords.some((gap) => gap.missingToolId === "ocr"));
  assert.ok(batch.capabilityGapRecords.every((gap) => gap.evidence.noUnavailableToolExecutionClaimed));
  assert.ok(batch.contextDebtRecords.every((debt) => debt.evidence.noUnavailableToolExecutionClaimed));
  assert.ok(batch.contextDebtRecords.some((debt) =>
    Array.isArray(debt.sourceLocator.availabilitySources) &&
    debt.sourceLocator.availabilitySources.includes("producer_manifest")
  ));
  assert.ok(batch.capabilityGapRecords.some((gap) =>
    Array.isArray(gap.evidence.missingRequirements) &&
    gap.evidence.missingRequirements.includes("document_ai_table_recovery")
  ));
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
