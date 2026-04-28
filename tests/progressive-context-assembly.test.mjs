import assert from "node:assert/strict";
import path from "node:path";
import { fileURLToPath } from "node:url";
import createJiti from "jiti";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const jiti = createJiti(import.meta.url, { moduleCache: false });
const {
  ContextPackingKernel,
} = jiti(path.join(__dirname, "..", "src", "lib", "context-packing-kernel.ts"));
const {
  assembleProgressiveContext,
} = jiti(path.join(__dirname, "..", "src", "lib", "progressive-context-assembly.ts"));
const { buildAgentWorkPlanFromControlDecision, evaluateAgentControlSurface } = jiti(
  path.join(__dirname, "..", "src", "lib", "agent-control-surface.ts")
);
const { buildDefaultInspectionToolBroker } = jiti(
  path.join(__dirname, "..", "src", "lib", "document-intelligence.ts")
);
const {
  createDeterministicRenderedPageRenderer,
  createDeterministicVisionInspectionAdapter,
  executeVisualInspection,
} = jiti(path.join(__dirname, "..", "src", "lib", "visual-inspection-pack.ts"));

const tests = [];

function runTest(name, fn) {
  tests.push({ name, fn });
}

function makeSourceSignal(overrides = {}) {
  return {
    sourceId: overrides.sourceId ?? "doc-t5",
    sourceType: overrides.sourceType ?? "pdf",
    filename: overrides.filename ?? "t5.pdf",
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

function standardDecision(overrides = {}) {
  const decision = evaluateAgentControlSurface({
    conversationId: "thread-standard",
    request: overrides.request ?? "Summarize the learned artifacts.",
    sourceSignals: overrides.sourceSignals ?? [],
    policy: overrides.policy,
  });

  return {
    ...decision,
    ...overrides.patch,
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
    locationLabel: overrides.locationLabel ?? "t5.pdf - page 15 - Smackover Water Chemistry",
    provenance: overrides.provenance ?? { artifactKey: "table_candidate:15", tool: "pdf_table_candidate_detection" },
    freshness: overrides.freshness ?? { artifactUpdatedAt: "2026-04-26T00:00:00.000Z" },
    rankingHints: overrides.rankingHints ?? ["table", "page 15", "Smackover Water Chemistry"],
    required: overrides.required ?? false,
    metadata: overrides.metadata ?? { artifactKey: "table_candidate:15" },
  };
}

function visualTarget() {
  return {
    sourceDocumentId: "doc-t5",
    sourceId: "doc-t5",
    sourceType: "thread_document",
    sourceVersion: "v1",
    documentLabel: "T5 Summary Deck V1.7ext.pdf",
    pageNumber: 15,
    pageLabel: "15",
    sourceLocationLabel: "T5 Summary Deck V1.7ext.pdf - page 15",
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
    label: overrides.label ?? "t5.pdf - page 15",
    content: overrides.content ?? "Smackover Water Chemistry 17",
    approxTokenCount: overrides.approxTokenCount ?? 8,
    priority: overrides.priority ?? 20,
    confidence: null,
    locationLabel: overrides.locationLabel ?? "t5.pdf - page 15",
    provenance: overrides.provenance ?? { pageNumberStart: 15 },
    rankingHints: overrides.rankingHints ?? ["page 15"],
    required: overrides.required ?? false,
    metadata: overrides.metadata ?? { parserSignal: true },
  };
}

function makeInspectionInvocation(overrides = {}) {
  return {
    invocationId: overrides.invocationId ?? "inspect:doc-t5:pdf_table_detection:15",
    sourceDocumentId: overrides.sourceDocumentId ?? "doc-t5",
    sourceType: overrides.sourceType ?? "pdf",
    requestedCapability: overrides.requestedCapability ?? "pdf_table_detection",
    purpose: overrides.purpose ?? "Detect approved parser-supported PDF table candidates.",
    input: overrides.input ?? { pageNumber: 15, hasExtractedText: true },
    location: overrides.location ?? { pageNumber: 15 },
    dataClass: overrides.dataClass ?? "internal",
    recommendedNextCapabilities:
      overrides.recommendedNextCapabilities ??
      ["rendered_page_inspection", "ocr", "vision_page_understanding", "document_ai_table_recovery"],
  };
}

runTest("ProgressiveContextAssembler creates a deterministic plan from AgentControlDecision", () => {
  const decision = standardDecision();
  const first = assembleProgressiveContext({
    request: "Summarize the learned artifacts.",
    agentControl: decision,
    artifactCandidates: [makeArtifactCandidate({ artifactStatus: "active", artifactKind: "source_memory" })],
  });
  const second = assembleProgressiveContext({
    request: "Summarize the learned artifacts.",
    agentControl: decision,
    artifactCandidates: [makeArtifactCandidate({ artifactStatus: "active", artifactKind: "source_memory" })],
  });

  assert.deepEqual(first.plan.passes.map((pass) => pass.name), second.plan.passes.map((pass) => pass.name));
  assert.equal(first.plan.controlDecisionId, decision.decisionId);
  assert.equal(first.plan.runtimeBudgetProfile, decision.runtimeBudgetProfile);
});

runTest("Progressive assembly preserves scoped plans and links them to AgentWorkPlan", () => {
  const request = "Recover the page 15 table body with OCR and vision.";
  const sourceSignals = [
    makeSourceSignal({
      hasWeakArtifact: true,
      recommendedNextCapabilities: ["ocr", "vision_page_understanding"],
    }),
  ];
  const decision = standardDecision({ request, sourceSignals });
  const agentWorkPlan = buildAgentWorkPlanFromControlDecision({
    conversationId: "thread-standard",
    request,
    decision,
    sourceSignals,
  });
  const result = assembleProgressiveContext({
    request,
    agentControl: decision,
    agentWorkPlan,
    artifactCandidates: [makeArtifactCandidate(), makeWarningArtifact()],
    rawExcerptCandidates: [makeRawCandidate()],
  });

  assert.equal(result.agentWorkPlan.planId, agentWorkPlan.planId);
  assert.equal(result.plan.agentWorkPlanId, agentWorkPlan.planId);
  assert.equal(result.plan.agentWorkPlanTraceId, agentWorkPlan.traceId);
  assert.equal(result.contextTransport.plan.agentWorkPlanId, agentWorkPlan.planId);
  assert.equal(result.contextTransport.plan.agentWorkPlanTraceId, agentWorkPlan.traceId);
  assert.notEqual(result.plan.id, result.contextTransport.plan.planId);
  assert.equal(result.plan.controlDecisionId, decision.decisionId);
  assert.equal(result.contextTransport.plan.relationshipToA03.a03IsTextPackingLane, true);
});

runTest("A-03 is invoked as packing kernel, not assembly strategy owner", () => {
  const decision = standardDecision();
  const result = assembleProgressiveContext({
    request: "Summarize the learned artifacts.",
    agentControl: decision,
    artifactCandidates: [makeArtifactCandidate({ artifactStatus: "active", artifactKind: "source_memory" })],
  });

  assert.equal(result.packingRequests[0].passName, "artifact_reuse");
  assert.match(result.plan.detail, /A-04e owns assembly strategy/i);
  assert.equal("sufficiency" in result.packingResults[0], false);
  assert.ok(result.sufficiency.status);
});

runTest("ContextPackingRequest accepts control, output, coverage, priority, and trace hints", () => {
  const kernel = new ContextPackingKernel();
  const result = kernel.pack({
    selectedBudgetProfile: "high_fidelity_creation",
    modelProfileCeilingTokens: 32000,
    allowedContextBudgetTokens: 80,
    outputBudgetHints: { requestedTokens: 12000, grantedTokens: 4096, deliverableType: "deck" },
    taskFidelityLevel: "highest_fidelity_creation",
    sourceCoverageTarget: "all_pages",
    creationDepth: "deliverable_grade",
    validationDepth: "claim_check",
    artifactPriorityHints: ["table_extraction", "table_candidate"],
    artifactCandidateSet: [makeArtifactCandidate()],
    rawExcerptCandidateSet: [makeRawCandidate()],
    freshnessHints: { memoryRefreshDepth: "check_freshness" },
    provenanceRequirements: ["source_location", "tool_trace"],
    rankingHints: ["deliverable", "validation"],
    passName: "artifact_reuse",
    assemblyStage: "test",
    policyLimits: [{ id: "limit", value: 80 }],
    traceRequirements: {
      includeSelectedCandidates: true,
      includeExcludedCandidates: true,
      includeBudgetEvents: true,
    },
  });

  assert.equal(result.passName, "artifact_reuse");
  assert.equal(result.selectedCandidates.length > 0, true);
  assert.equal(result.limitations.some((limitation) => /Output budget/i.test(limitation)), true);
  assert.equal(result.traceEvents.some((event) => event.type === "packing_started"), true);
});

runTest("ContextPackingResult includes selected, excluded, omissions, budget, and limitations", () => {
  const kernel = new ContextPackingKernel();
  const result = kernel.pack({
    selectedBudgetProfile: "expanded_context",
    allowedContextBudgetTokens: 30,
    taskFidelityLevel: "standard_grounded_answer",
    sourceCoverageTarget: "relevant_source_sections",
    creationDepth: "none",
    validationDepth: "basic_grounding",
    artifactCandidateSet: [makeArtifactCandidate({ approxTokenCount: 20 })],
    rawExcerptCandidateSet: [makeRawCandidate({ id: "doc-t5:16", approxTokenCount: 20 })],
    passName: "raw_source_excerpt_expansion",
    assemblyStage: "test",
  });

  assert.equal(result.selectedCandidates.length, 1);
  assert.equal(result.excludedCandidates.length, 1);
  assert.equal(result.excludedCandidates[0].reason, "budget_exhausted");
  assert.equal(result.budgetUsedTokens, 20);
  assert.equal(result.budgetRemainingTokens, 10);
  assert.equal(result.limitations.some((limitation) => /did not fit/i.test(limitation)), true);
});

runTest("simple standard answer reuses artifacts and remains synchronous", () => {
  const decision = standardDecision();
  const result = assembleProgressiveContext({
    request: "Summarize the learned artifact.",
    agentControl: decision,
    artifactCandidates: [makeArtifactCandidate({ artifactKind: "source_memory", artifactStatus: "active" })],
    rawExcerptCandidates: [makeRawCandidate()],
  });

  assert.equal(result.plan.executionMode, "synchronous");
  assert.equal(result.passResults.find((pass) => pass.pass.name === "artifact_reuse")?.reusedArtifactIds.length, 1);
  assert.equal(result.passResults.find((pass) => pass.pass.name === "raw_source_excerpt_expansion")?.pass.status, "skipped");
});

runTest("expanded-context request expands raw source excerpts within policy", () => {
  const decision = standardDecision({
    request: "Inspect this document deeply and use all relevant source sections.",
    sourceSignals: [makeSourceSignal({ hasWeakArtifact: true })],
  });
  const result = assembleProgressiveContext({
    request: "Inspect this document deeply and use all relevant source sections.",
    agentControl: decision,
    artifactCandidates: [makeArtifactCandidate()],
    rawExcerptCandidates: [makeRawCandidate(), makeRawCandidate({ id: "doc-t5:16", content: "Additional source context." })],
  });

  assert.equal(result.passResults.find((pass) => pass.pass.name === "raw_source_excerpt_expansion")?.pass.status, "completed");
  assert.equal(result.sourceExpansionDecisions.some((decision) => decision.selected), true);
});

runTest("deep-inspection request calls only approved synchronous built-in broker tools", () => {
  const decision = standardDecision({
    request: "Inspect the missing table body deeply.",
    sourceSignals: [
      makeSourceSignal({
        hasWeakArtifact: true,
        artifactKinds: ["table_candidate", "extraction_warning"],
        recommendedNextCapabilities: ["pdf_table_detection"],
      }),
    ],
    patch: {
      executionMode: "staged_synchronous",
      approvalRequired: false,
      approvalRequiredReasons: [],
      inspectionDepth: "broker_supported",
      externalEscalation: {
        level: "none",
        capabilities: [],
        unavailableOrUnapproved: false,
        dataEgressRisk: false,
        externalMutationRisk: false,
        detail: "Approved built-in broker tools only.",
      },
    },
  });
  const result = assembleProgressiveContext({
    request: "Inspect the missing table body deeply.",
    agentControl: decision,
    artifactCandidates: [makeArtifactCandidate(), makeWarningArtifact()],
    rawExcerptCandidates: [makeRawCandidate()],
    inspectionInvocations: [makeInspectionInvocation()],
    toolBroker: buildDefaultInspectionToolBroker(),
  });
  const inspection = result.passResults
    .find((pass) => pass.pass.name === "approved_synchronous_inspection")
    ?.inspectionsRun[0];

  assert.equal(inspection?.selectedToolId, "pdf_table_candidate_detection");
  assert.equal(inspection?.executedUnapprovedTool, false);
});

runTest("tool budget limits are respected", () => {
  const decision = standardDecision({
    request: "Inspect this document deeply.",
    patch: {
      inspectionDepth: "broker_supported",
      toolBudgetRequest: { grantedToolCalls: 1 },
    },
  });
  const result = assembleProgressiveContext({
    request: "Inspect this document deeply.",
    agentControl: decision,
    inspectionInvocations: [
      makeInspectionInvocation({ invocationId: "inspect:one" }),
      makeInspectionInvocation({ invocationId: "inspect:two" }),
    ],
    toolBroker: buildDefaultInspectionToolBroker(),
  });

  assert.equal(result.metrics.toolCallsUsed, 1);
  assert.equal(result.passResults.find((pass) => pass.pass.name === "approved_synchronous_inspection")?.inspectionsRun.length, 1);
});

runTest("context budget limits are respected and excluded candidates carry omissions", () => {
  const decision = standardDecision({
    patch: {
      contextBudgetRequest: { grantedTokens: 20 },
    },
  });
  const result = assembleProgressiveContext({
    request: "Summarize the learned artifacts.",
    agentControl: decision,
    artifactCandidates: [
      makeArtifactCandidate({ id: "artifact-a", approxTokenCount: 15, artifactStatus: "active" }),
      makeArtifactCandidate({ id: "artifact-b", approxTokenCount: 15, artifactStatus: "active" }),
    ],
  });

  assert.equal(result.expandedContextBundle.excludedCandidates.length > 0, true);
  assert.equal(result.gaps.some((gap) => gap.kind === "excluded_candidate_budget"), true);
});

runTest("approval-required control decision does not perform restricted expansion", () => {
  const decision = standardDecision({
    request: "Create the best possible investor report from this document.",
  });
  const result = assembleProgressiveContext({
    request: "Create the best possible investor report from this document.",
    agentControl: decision,
    artifactCandidates: [makeArtifactCandidate()],
    rawExcerptCandidates: [makeRawCandidate()],
  });

  assert.equal(decision.approvalRequired, true);
  assert.equal(result.passResults.find((pass) => pass.pass.name === "raw_source_excerpt_expansion")?.pass.status, "skipped");
  assert.equal(result.sufficiency.status, "insufficient_needs_approval");
});

runTest("async-recommended control decision records staged recommendation without a queue", () => {
  const decision = standardDecision({
    request: "Ingest this document at the highest level across all pages and all tables.",
    sourceSignals: [makeSourceSignal({ sourceCoverageHints: ["all_tables"] })],
  });
  const result = assembleProgressiveContext({
    request: "Ingest this document at the highest level across all pages and all tables.",
    agentControl: decision,
    artifactCandidates: [makeArtifactCandidate()],
    rawExcerptCandidates: [makeRawCandidate(), makeRawCandidate({ id: "doc-t5:16" })],
  });

  assert.equal(decision.asyncRecommended, true);
  assert.equal(result.recommendedNextAction, "recommend_async_job");
  assert.equal(result.contextDebtCandidates.length > 0, true);
  assert.equal("queueId" in result, false);
});

runTest("blocked-by-policy decision prevents further assembly", () => {
  const decision = standardDecision({
    request: "Recover the missing table body with OCR.",
    sourceSignals: [
      makeSourceSignal({
        dataClass: "restricted",
        hasWeakArtifact: true,
        recommendedNextCapabilities: ["ocr", "vision_page_understanding"],
      }),
    ],
  });
  const result = assembleProgressiveContext({
    request: "Recover the missing table body with OCR.",
    agentControl: decision,
    artifactCandidates: [makeArtifactCandidate()],
    rawExcerptCandidates: [makeRawCandidate()],
  });

  assert.equal(decision.blockedByPolicy, true);
  assert.equal(result.packingRequests.length, 0);
  assert.equal(result.plan.passes.every((pass) => pass.status === "blocked"), true);
  assert.equal(result.sufficiency.status, "blocked_by_policy");
});

runTest("T5 page 15 reuses table_candidate and extraction_warning artifacts first", () => {
  const decision = standardDecision({
    request: "What is in the water chemistry table body on page 15?",
    sourceSignals: [
      makeSourceSignal({
        hasWeakArtifact: true,
        artifactKinds: ["table_candidate", "extraction_warning"],
        recommendedNextCapabilities: ["rendered_page_inspection", "ocr", "vision_page_understanding", "document_ai_table_recovery"],
      }),
    ],
  });
  const result = assembleProgressiveContext({
    request: "What is in the water chemistry table body on page 15?",
    agentControl: decision,
    artifactCandidates: [makeArtifactCandidate(), makeWarningArtifact()],
    rawExcerptCandidates: [makeRawCandidate()],
  });

  assert.deepEqual(
    result.passResults.find((pass) => pass.pass.name === "artifact_reuse")?.reusedArtifactIds,
    ["doc-t5:artifact:extraction_warning:15:table_body_missing", "doc-t5:artifact:table_candidate:15"]
  );
  assert.equal(result.packingResults[0].selectedMix.artifactCount, 2);
});

runTest("T5 page 15 detects missing table body as context gap", () => {
  const decision = standardDecision({
    request: "What is in the water chemistry table body on page 15?",
    sourceSignals: [makeSourceSignal({ hasWeakArtifact: true, artifactKinds: ["table_candidate", "extraction_warning"] })],
  });
  const result = assembleProgressiveContext({
    request: "What is in the water chemistry table body on page 15?",
    agentControl: decision,
    artifactCandidates: [makeArtifactCandidate(), makeWarningArtifact()],
  });

  assert.equal(result.gaps.some((gap) => gap.kind === "missing_table_body"), true);
});

runTest("T5 page 15 recommends rendered/OCR/vision/document-AI without claiming those ran", () => {
  const decision = standardDecision({
    request: "Recover the page 15 table body.",
    sourceSignals: [
      makeSourceSignal({
        hasWeakArtifact: true,
        artifactKinds: ["table_candidate", "extraction_warning"],
        recommendedNextCapabilities: ["rendered_page_inspection", "ocr", "vision_page_understanding", "document_ai_table_recovery"],
      }),
    ],
  });
  const result = assembleProgressiveContext({
    request: "Recover the page 15 table body.",
    agentControl: decision,
    artifactCandidates: [makeArtifactCandidate(), makeWarningArtifact()],
  });
  const missingBodyGap = result.gaps.find((gap) => gap.kind === "missing_table_body");

  assert.ok(missingBodyGap);
  assert.deepEqual(
    ["rendered_page_inspection", "ocr", "vision_page_understanding", "document_ai_table_recovery"].every((capability) =>
      missingBodyGap.recommendedCapabilities.includes(capability)
    ),
    true
  );
  assert.equal(result.passResults.find((pass) => pass.pass.name === "approved_synchronous_inspection")?.inspectionsRun.length, 0);
});

runTest("highest-fidelity ingestion identifies full-source coverage and context debt", () => {
  const decision = standardDecision({
    request: "Ingest this document at the highest level across all pages and all tables.",
    sourceSignals: [makeSourceSignal({ sourceCoverageHints: ["all_tables"] })],
    patch: {
      contextBudgetRequest: { grantedTokens: 50 },
    },
  });
  const result = assembleProgressiveContext({
    request: "Ingest this document at the highest level across all pages and all tables.",
    agentControl: decision,
    artifactCandidates: [makeArtifactCandidate({ approxTokenCount: 40 })],
    rawExcerptCandidates: [
      makeRawCandidate({ id: "doc-t5:1", approxTokenCount: 40 }),
      makeRawCandidate({ id: "doc-t5:2", approxTokenCount: 40 }),
      makeRawCandidate({ id: "doc-t5:3", approxTokenCount: 40 }),
    ],
  });

  assert.equal(result.plan.sourceCoverageTarget, "all_tables");
  assert.equal(result.gaps.some((gap) => gap.kind === "insufficient_source_coverage"), true);
  assert.equal(result.contextDebtCandidates.length > 0, true);
});

runTest("highest-fidelity ingestion does not let A-03 reduce work to most-relevant chat chunks", () => {
  const decision = standardDecision({
    request: "Ingest this document at the highest level across all pages and all tables.",
    sourceSignals: [makeSourceSignal({ sourceCoverageHints: ["all_tables"] })],
  });
  const result = assembleProgressiveContext({
    request: "Ingest this document at the highest level across all pages and all tables.",
    agentControl: decision,
    rawExcerptCandidates: [makeRawCandidate()],
  });
  const rawRequest = result.packingRequests.find((request) => request.passName === "raw_source_excerpt_expansion");

  assert.equal(rawRequest?.sourceCoverageTarget, "all_tables");
  assert.equal(result.plan.sourceCoverageTarget, "all_tables");
  assert.equal(result.plan.detail.includes("A-04e owns assembly strategy"), true);
});

runTest("highest-fidelity creation preserves deliverable-grade context and validation needs", () => {
  const decision = standardDecision({
    request: "Create the best possible report from this document.",
  });
  const result = assembleProgressiveContext({
    request: "Create the best possible report from this document.",
    agentControl: decision,
    artifactCandidates: [makeArtifactCandidate({ artifactKind: "source_memory", artifactStatus: "active" })],
  });

  assert.equal(result.plan.creationDepth, "deliverable_grade");
  assert.equal(result.plan.validationDepth, "claim_check");
  assert.equal(result.gaps.some((gap) => gap.kind === "output_budget_insufficient"), true);
});

runTest("highest-fidelity creation passes output, creation, and validation hints into packing", () => {
  const decision = standardDecision({
    request: "Create the best possible workbook from this document.",
  });
  const result = assembleProgressiveContext({
    request: "Create the best possible workbook from this document.",
    agentControl: decision,
    artifactCandidates: [makeArtifactCandidate({ artifactKind: "source_memory", artifactStatus: "active" })],
  });
  const request = result.packingRequests[0];

  assert.equal(request.outputBudgetHints.deliverableType, "deliverable");
  assert.equal(request.creationDepth, "deliverable_grade");
  assert.equal(request.validationDepth, "claim_check");
});

runTest("context sufficiency statuses are produced", () => {
  const standard = assembleProgressiveContext({
    request: "Summarize the artifact.",
    agentControl: standardDecision(),
    artifactCandidates: [makeArtifactCandidate({ artifactKind: "source_memory", artifactStatus: "active" })],
  });
  const limited = assembleProgressiveContext({
    request: "What is in the page 15 table body?",
    agentControl: standardDecision({
      request: "What is in the page 15 table body?",
      sourceSignals: [makeSourceSignal({ hasWeakArtifact: true })],
    }),
    artifactCandidates: [makeArtifactCandidate(), makeWarningArtifact()],
  });

  assert.equal(standard.sufficiency.status, "sufficient");
  assert.equal(limited.sufficiency.status, "sufficient_with_limitations");
});

runTest("debug trace data includes plan, passes, packing, exclusions, gaps, sufficiency, and stop reason", () => {
  const decision = standardDecision({
    patch: {
      contextBudgetRequest: { grantedTokens: 20 },
    },
  });
  const result = assembleProgressiveContext({
    request: "What is in the page 15 table body?",
    agentControl: decision,
    artifactCandidates: [
      makeArtifactCandidate({ approxTokenCount: 15 }),
      makeWarningArtifact({ approxTokenCount: 15 }),
    ],
  });

  assert.ok(result.plan);
  assert.equal(result.passResults.length >= 6, true);
  assert.equal(result.packingRequests.length > 0, true);
  assert.equal(result.packingResults[0].excludedCandidates.length > 0, true);
  assert.equal(result.gaps.length > 0, true);
  assert.ok(result.sufficiency.status);
  assert.ok(result.stopReason);
  assert.equal(result.traceEvents.some((event) => event.type === "sufficiency_assessed"), true);
});

runTest("artifacts outrank raw chunks by default under tight budget", () => {
  const kernel = new ContextPackingKernel();
  const result = kernel.pack({
    selectedBudgetProfile: "default_chat",
    allowedContextBudgetTokens: 25,
    taskFidelityLevel: "standard_grounded_answer",
    sourceCoverageTarget: "relevant_artifacts_only",
    creationDepth: "none",
    validationDepth: "basic_grounding",
    artifactCandidateSet: [makeArtifactCandidate({ artifactKind: "source_memory", artifactStatus: "active", approxTokenCount: 20 })],
    rawExcerptCandidateSet: [makeRawCandidate({ approxTokenCount: 20, priority: 999 })],
    passName: "artifact_reuse",
    assemblyStage: "test",
  });

  assert.equal(result.selectedCandidates[0].kind, "artifact");
  assert.equal(result.excludedCandidates[0].candidate.kind, "excerpt");
});

runTest("parser output is treated as a signal, not the ceiling of context", () => {
  const decision = standardDecision({
    request: "What is in the page 15 table body?",
    sourceSignals: [makeSourceSignal({ hasWeakArtifact: true })],
  });
  const result = assembleProgressiveContext({
    request: "What is in the page 15 table body?",
    agentControl: decision,
    artifactCandidates: [makeWarningArtifact()],
    rawExcerptCandidates: [makeRawCandidate({ metadata: { parserSignal: true } })],
  });

  assert.equal(result.gaps.some((gap) => gap.kind === "raw_parser_output_insufficient"), true);
  assert.equal(
    result.gaps.some((gap) =>
      gap.recommendedCapabilities.includes("ocr") &&
      gap.recommendedCapabilities.includes("vision_page_understanding")
    ),
    true
  );
});

runTest("progressive assembly can include A-04j visual inspection payloads and debug truth", async () => {
  const decision = standardDecision({
    request: "What does page 15 Smackover Water Chemistry table say?",
    patch: {
      approvalRequired: false,
      asyncRecommended: false,
      toolBudgetRequest: {
        requestedToolCalls: 4,
        grantedToolCalls: 4,
        exceedsPolicy: false,
        reason: "test visual budget",
      },
    },
  });
  const visualInspection = await executeVisualInspection({
    request: "What does page 15 Smackover Water Chemistry table say?",
    sourceTargets: [visualTarget()],
    agentControl: decision,
    renderer: createDeterministicRenderedPageRenderer(),
    visionAdapter: createDeterministicVisionInspectionAdapter(),
    policy: {
      approvalGranted: true,
      maxPages: 1,
      maxModelCalls: 1,
    },
    now: () => new Date("2026-04-27T12:00:00.000Z"),
  });
  const result = assembleProgressiveContext({
    request: "What does page 15 Smackover Water Chemistry table say?",
    agentControl: decision,
    artifactCandidates: [makeWarningArtifact()],
    visualInspection,
  });

  assert.equal(result.visualInspection.payloadsProduced.some((payload) => payload.type === "rendered_page_image"), true);
  assert.equal(result.visualInspection.payloadsProduced.some((payload) => payload.type === "vision_observation"), true);
  assert.equal(result.contextTransport.debugSnapshot.visualInspectionDebugSnapshot.plan.id, visualInspection.plan.id);
  assert.equal(result.contextTransport.debugSnapshot.availablePayloads.some((payload) => payload.type === "vision_observation"), true);
  assert.equal(result.contextTransport.debugSnapshot.requestedPayloads.some((payload) => payload.payloadType === "vision_observation"), true);
});

let passed = 0;
for (const test of tests) {
  await test.fn();
  passed += 1;
}

console.log(`${passed} progressive-context-assembly test(s) passed.`);
