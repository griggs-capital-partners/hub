import assert from "node:assert/strict";
import path from "node:path";
import { fileURLToPath } from "node:url";
import createJiti from "jiti";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const jiti = createJiti(import.meta.url, { moduleCache: false });
const {
  createDeterministicRenderedPageRenderer,
  createDeterministicVisionInspectionAdapter,
  executeVisualInspection,
  mapVisualInspectionCapabilityGaps,
  mapVisualInspectionContextDebt,
  planVisualInspection,
  visionObservationToSourceObservation,
} = jiti(path.join(__dirname, "..", "src", "lib", "visual-inspection-pack.ts"));
const { evaluateAgentControlSurface } = jiti(
  path.join(__dirname, "..", "src", "lib", "agent-control-surface.ts")
);

const tests = [];

function runTest(name, fn) {
  tests.push({ name, fn });
}

function makeDecision(request = "Inspect page 15 visually.", patch = {}) {
  const decision = evaluateAgentControlSurface({
    conversationId: "conv-a04j",
    request,
    sourceSignals: [],
  });
  return {
    ...decision,
    approvalRequired: false,
    approvalRequiredReasons: [],
    asyncRecommended: false,
    asyncRecommendedReason: null,
    blockedByPolicy: false,
    blockedByPolicyReasons: [],
    ...patch,
    contextBudgetRequest: {
      ...decision.contextBudgetRequest,
      ...(patch.contextBudgetRequest ?? {}),
    },
    outputBudgetRequest: {
      ...decision.outputBudgetRequest,
      ...(patch.outputBudgetRequest ?? {}),
    },
    toolBudgetRequest: {
      ...decision.toolBudgetRequest,
      ...(patch.toolBudgetRequest ?? {}),
    },
    runtimeBudgetRequest: {
      ...decision.runtimeBudgetRequest,
      ...(patch.runtimeBudgetRequest ?? {}),
    },
  };
}

function target(pageNumber = 15) {
  return {
    sourceDocumentId: "doc-t5",
    sourceId: "doc-t5",
    sourceType: "thread_document",
    sourceVersion: "v1",
    documentLabel: "T5 Summary Deck V1.7ext.pdf",
    pageNumber,
    pageLabel: String(pageNumber),
    sourceLocationLabel: `T5 Summary Deck V1.7ext.pdf - page ${pageNumber}`,
  };
}

function cropRequest(pageNumber = 15, coordinates = { x: 10, y: 20, width: 320, height: 180, unit: "px" }) {
  return {
    id: `crop-${pageNumber}`,
    target: target(pageNumber),
    coordinates,
    reason: "Explicit table-region crop supplied by caller.",
    label: "table region",
    plannedBy: "explicit_user_request",
  };
}

const fixedNow = () => new Date("2026-04-27T12:00:00.000Z");

runTest("default visual inspection plans gaps and debt without faking renderer or vision execution", async () => {
  const decision = makeDecision("What does page 15 Smackover Water Chemistry table say?");
  const result = await executeVisualInspection({
    request: "What does page 15 Smackover Water Chemistry table say?",
    sourceTargets: [target()],
    agentControl: decision,
    now: fixedNow,
  });

  assert.equal(result.renderedPagePayloads.length, 0);
  assert.equal(result.pageCropPayloads.length, 0);
  assert.equal(result.visionObservations.length, 0);
  assert.equal(result.contextPayloads.length, 0);
  assert.equal(result.capabilityGapRecords.some((record) => record.missingPayloadType === "rendered_page_image"), true);
  assert.equal(result.capabilityGapRecords.some((record) => record.missingPayloadType === "vision_observation"), true);
  assert.equal(result.contextDebtRecords.some((record) => record.resolutionPath === "rendered_page_inspection_needed"), true);
  assert.equal(result.transportResult.missingPayloadCapabilities.some((missing) => missing.payloadType === "rendered_page_image"), true);
  assert.equal(result.debugSnapshot.nonExecutionConfirmations.ocrExecuted, false);
  assert.equal(result.debugSnapshot.nonExecutionConfirmations.documentAiExecuted, false);
});

runTest("visual inspection plan respects blocked-by-policy", async () => {
  const decision = makeDecision("Inspect page 15 visually.", {
    blockedByPolicy: true,
    blockedByPolicyReasons: ["test policy block"],
  });
  const result = await executeVisualInspection({
    request: "Inspect page 15 visually.",
    sourceTargets: [target()],
    agentControl: decision,
    renderer: createDeterministicRenderedPageRenderer(),
    visionAdapter: createDeterministicVisionInspectionAdapter(),
    now: fixedNow,
  });

  assert.equal(result.plan.blockedByPolicy, true);
  assert.equal(result.plan.eligibility.find((decision) => decision.gate === "render_page").allowed, false);
  assert.equal(result.renderedPagePayloads.length, 0);
  assert.equal(result.visionObservations.length, 0);
  assert.equal(result.contextDebtRecords.some((record) => record.status === "blocked_by_policy"), true);
});

runTest("visual inspection plan respects approval-required gates", async () => {
  const decision = makeDecision("Inspect page 15 visually.", {
    approvalRequired: true,
    approvalRequiredReasons: ["exceeds_tool_budget"],
  });
  const withoutApproval = await executeVisualInspection({
    request: "Inspect page 15 visually.",
    sourceTargets: [target()],
    agentControl: decision,
    renderer: createDeterministicRenderedPageRenderer(),
    visionAdapter: createDeterministicVisionInspectionAdapter({ requiresApproval: true }),
    now: fixedNow,
  });
  const withApproval = await executeVisualInspection({
    request: "Inspect page 15 visually.",
    sourceTargets: [target()],
    agentControl: decision,
    renderer: createDeterministicRenderedPageRenderer(),
    visionAdapter: createDeterministicVisionInspectionAdapter({ requiresApproval: true }),
    policy: { approvalGranted: true },
    now: fixedNow,
  });

  assert.equal(withoutApproval.renderedPagePayloads.length, 0);
  assert.equal(withoutApproval.visionObservations.length, 0);
  assert.equal(withApproval.renderedPagePayloads.length, 1);
  assert.equal(withApproval.visionObservations.length, 1);
});

runTest("visual inspection plan limits page crop and model work by tool budget", () => {
  const decision = makeDecision("Ingest this document at the highest level.", {
    taskFidelityLevel: "highest_fidelity_ingestion",
    runtimeBudgetProfile: "high_fidelity_ingestion",
    toolBudgetRequest: {
      requestedToolCalls: 10,
      grantedToolCalls: 2,
      exceedsPolicy: true,
      reason: "test cap",
    },
  });
  const plan = planVisualInspection({
    request: "Ingest this document at the highest level.",
    sourceTargets: [target(1), target(2), target(3), target(4)],
    cropRequests: [cropRequest(1), cropRequest(2), cropRequest(3)],
    agentControl: decision,
    renderer: createDeterministicRenderedPageRenderer(),
    visionAdapter: createDeterministicVisionInspectionAdapter(),
    policy: { maxPages: 10, maxCrops: 10, maxModelCalls: 10 },
    now: fixedNow,
  });

  assert.equal(plan.policy.maxPages + plan.policy.maxCrops + plan.policy.maxModelCalls <= 2, true);
  assert.equal(plan.selectedPageTargets.length <= 2, true);
  assert.equal(plan.selectedCropRequests.length <= plan.policy.maxCrops, true);
});

runTest("deterministic renderer produces real rendered page image payloads and source observations", async () => {
  const result = await executeVisualInspection({
    request: "Inspect page 15 visually.",
    sourceTargets: [target()],
    agentControl: makeDecision(),
    renderer: createDeterministicRenderedPageRenderer(),
    policy: { approvalGranted: true },
    now: fixedNow,
  });

  assert.equal(result.renderedPagePayloads.length, 1);
  assert.equal(result.renderedPagePayloads[0].artifactRef.uri.startsWith("data:image/svg+xml"), true);
  assert.equal(result.contextPayloads.some((payload) => payload.type === "rendered_page_image"), true);
  assert.equal(result.sourceObservations.some((observation) => observation.type === "rendered_page_image"), true);
  assert.equal(result.sourceCoverageRecords.some((record) => record.inspectedBy.includes("rendered_page_renderer")), true);
});

runTest("cropper produces page crops only from explicit coordinates and never invents crop geometry", async () => {
  const renderer = createDeterministicRenderedPageRenderer();
  const withCrop = await executeVisualInspection({
    request: "Inspect the page 15 table crop visually.",
    sourceTargets: [target()],
    cropRequests: [cropRequest()],
    agentControl: makeDecision(),
    renderer,
    policy: { approvalGranted: true, maxPages: 1, maxCrops: 1 },
    now: fixedNow,
  });
  const withoutCoordinates = await executeVisualInspection({
    request: "Inspect the page 15 table crop visually.",
    sourceTargets: [target()],
    cropRequests: [cropRequest(15, null)],
    agentControl: makeDecision(),
    renderer,
    policy: { approvalGranted: true, maxPages: 1, maxCrops: 1 },
    now: fixedNow,
  });

  assert.equal(withCrop.pageCropPayloads.length, 1);
  assert.equal(withCrop.pageCropPayloads[0].metadata.noInventedCropCoordinates, true);
  assert.equal(withoutCoordinates.pageCropPayloads.length, 0);
  assert.equal(withoutCoordinates.trace.events.some((event) => event.type === "crop_skipped"), true);
});

runTest("vision remains unavailable without adapter and executes only through configured adapter", async () => {
  const noAdapter = await executeVisualInspection({
    request: "Inspect page 15 with vision.",
    sourceTargets: [target()],
    agentControl: makeDecision(),
    renderer: createDeterministicRenderedPageRenderer(),
    policy: { approvalGranted: true, maxPages: 1, maxModelCalls: 1 },
    now: fixedNow,
  });
  const withAdapter = await executeVisualInspection({
    request: "Inspect page 15 with vision.",
    sourceTargets: [target()],
    agentControl: makeDecision(),
    renderer: createDeterministicRenderedPageRenderer(),
    visionAdapter: createDeterministicVisionInspectionAdapter(),
    policy: { approvalGranted: true, maxPages: 1, maxModelCalls: 1 },
    now: fixedNow,
  });

  assert.equal(noAdapter.visionObservations.length, 0);
  assert.equal(noAdapter.debugSnapshot.visionAvailability.adapterAvailable, false);
  assert.equal(withAdapter.visionObservations.length, 1);
  assert.equal(withAdapter.visionResults[0].adapterId, "deterministic_test_vision_adapter");
  assert.equal(withAdapter.contextPayloads.some((payload) => payload.type === "vision_observation"), true);
  assert.equal(withAdapter.transportResult.selectedPayloads.some((payload) => payload.type === "vision_observation"), true);
});

runTest("vision result converts to SourceObservation-compatible output with provenance confidence and limitations", async () => {
  const result = await executeVisualInspection({
    request: "Inspect page 15 with vision.",
    sourceTargets: [target()],
    agentControl: makeDecision(),
    renderer: createDeterministicRenderedPageRenderer(),
    visionAdapter: createDeterministicVisionInspectionAdapter({
      observationText: "Vision observation: page 15 contains a visible table area, but exact cells are not extracted.",
    }),
    policy: { approvalGranted: true, maxPages: 1, maxModelCalls: 1 },
    now: fixedNow,
  });
  const sourceObservation = visionObservationToSourceObservation(result.visionObservations[0], result.visionResults[0]);

  assert.equal(sourceObservation.type, "vision_observation");
  assert.equal(sourceObservation.sourceDocumentId, "doc-t5");
  assert.equal(sourceObservation.sourceLocator.pageNumberStart, 15);
  assert.equal(sourceObservation.confidence > 0, true);
  assert.equal(sourceObservation.limitations.some((limitation) => /not OCR/i.test(limitation)), true);
});

runTest("T5 page 15 records rendered and vision payloads only when each actually executes", async () => {
  const renderedOnly = await executeVisualInspection({
    request: "What does page 15 Smackover Water Chemistry table say?",
    sourceTargets: [target()],
    agentControl: makeDecision("What does page 15 Smackover Water Chemistry table say?"),
    renderer: createDeterministicRenderedPageRenderer(),
    policy: { approvalGranted: true, maxPages: 1, maxModelCalls: 1 },
    now: fixedNow,
  });
  const renderedAndVision = await executeVisualInspection({
    request: "What does page 15 Smackover Water Chemistry table say?",
    sourceTargets: [target()],
    agentControl: makeDecision("What does page 15 Smackover Water Chemistry table say?"),
    renderer: createDeterministicRenderedPageRenderer(),
    visionAdapter: createDeterministicVisionInspectionAdapter(),
    policy: { approvalGranted: true, maxPages: 1, maxModelCalls: 1 },
    now: fixedNow,
  });

  assert.equal(renderedOnly.renderedPagePayloads.length, 1);
  assert.equal(renderedOnly.visionObservations.length, 0);
  assert.equal(renderedOnly.capabilityGapRecords.some((record) => record.missingPayloadType === "vision_observation"), true);
  assert.equal(renderedOnly.contextPayloads.some((payload) => payload.type === "ocr_text"), false);
  assert.equal(renderedOnly.contextPayloads.some((payload) => payload.type === "document_ai_result"), false);
  assert.equal(renderedOnly.contextPayloads.some((payload) => payload.type === "structured_table"), false);
  assert.equal(renderedAndVision.renderedPagePayloads.length, 1);
  assert.equal(renderedAndVision.visionObservations.length, 1);
});

runTest("highest-fidelity ingestion plans visual page inspection within budget", () => {
  const decision = makeDecision("Ingest this document at the highest level.", {
    taskFidelityLevel: "highest_fidelity_ingestion",
    runtimeBudgetProfile: "high_fidelity_ingestion",
    toolBudgetRequest: {
      requestedToolCalls: 8,
      grantedToolCalls: 4,
      exceedsPolicy: false,
      reason: "test budget",
    },
  });
  const plan = planVisualInspection({
    request: "Ingest this document at the highest level.",
    sourceTargets: [target(1), target(2), target(3), target(4), target(5)],
    agentControl: decision,
    renderer: createDeterministicRenderedPageRenderer(),
    visionAdapter: createDeterministicVisionInspectionAdapter(),
    now: fixedNow,
  });

  assert.equal(plan.selectedPageTargets.length <= 3, true);
  assert.equal(plan.policy.maxPages + plan.policy.maxCrops + plan.policy.maxModelCalls <= 4, true);
  assert.equal(plan.requestedPayloadTypes.includes("rendered_page_image"), true);
  assert.equal(plan.requestedPayloadTypes.includes("vision_observation"), true);
});

runTest("highest-fidelity creation does not run creation pipeline or force visual execution", async () => {
  const decision = makeDecision("Create the best possible report from this source.", {
    taskFidelityLevel: "highest_fidelity_creation",
    runtimeBudgetProfile: "high_fidelity_creation",
    creationDepth: "deliverable_grade",
  });
  const result = await executeVisualInspection({
    request: "Create the best possible report from this source.",
    sourceTargets: [target()],
    agentControl: decision,
    renderer: createDeterministicRenderedPageRenderer(),
    visionAdapter: createDeterministicVisionInspectionAdapter(),
    now: fixedNow,
  });

  assert.equal(result.plan.policy.allowRendering, false);
  assert.equal(result.contextPayloads.some((payload) => payload.type === "creation_plan"), false);
  assert.equal(result.trace.noCreationPipelineExecuted, true);
});

runTest("capability gap and context debt mappers expose visual missing-capability truth", () => {
  const plan = planVisualInspection({
    request: "Inspect page 15 visually.",
    sourceTargets: [target()],
    agentControl: makeDecision(),
    now: fixedNow,
  });
  const gaps = mapVisualInspectionCapabilityGaps(plan, fixedNow);
  const debts = mapVisualInspectionContextDebt(plan, fixedNow);

  assert.equal(gaps.some((gap) => gap.missingToolId === "rendered_page_renderer"), true);
  assert.equal(gaps.some((gap) => gap.missingModelCapability === "vision_input"), true);
  assert.equal(debts.some((debt) => debt.deferredCapabilities.includes("rendered_page_inspection")), true);
  assert.equal(debts.some((debt) => debt.deferredCapabilities.includes("vision_page_understanding")), true);
});

runTest("debug snapshot exposes visual plan produced payloads missing payloads and non-execution confirmations", async () => {
  const result = await executeVisualInspection({
    request: "Inspect page 15 with vision.",
    sourceTargets: [target()],
    agentControl: makeDecision(),
    renderer: createDeterministicRenderedPageRenderer(),
    visionAdapter: createDeterministicVisionInspectionAdapter(),
    policy: { approvalGranted: true, maxPages: 1, maxModelCalls: 1 },
    now: fixedNow,
  });

  assert.equal(result.debugSnapshot.plan.id.startsWith("visual-inspection:"), true);
  assert.equal(result.debugSnapshot.payloadsProduced.some((payload) => payload.type === "rendered_page_image"), true);
  assert.equal(result.debugSnapshot.payloadsProduced.some((payload) => payload.type === "vision_observation"), true);
  assert.equal(result.debugSnapshot.payloadsMissing.some((missing) => missing.payloadType === "ocr_text"), false);
  assert.equal(result.debugSnapshot.nonExecutionConfirmations.ocrExecuted, false);
  assert.equal(result.debugSnapshot.nonExecutionConfirmations.sharePointOrCompanyConnectorExecuted, false);
});

let failures = 0;
for (const test of tests) {
  try {
    await test.fn();
    console.log(`ok - ${test.name}`);
  } catch (error) {
    failures += 1;
    console.error(`not ok - ${test.name}`);
    console.error(error);
  }
}

if (failures > 0) {
  process.exitCode = 1;
} else {
  console.log(`All ${tests.length} visual inspection pack tests passed.`);
}
