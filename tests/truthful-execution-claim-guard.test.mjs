import assert from "node:assert/strict";
import path from "node:path";
import { fileURLToPath } from "node:url";
import createJiti from "jiti";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const jiti = createJiti(import.meta.url, { moduleCache: false });
const {
  buildCapabilityAvailabilityAudit,
  buildTruthfulExecutionClaimSnapshot,
  buildTruthfulExecutionClaimContext,
  enforceTruthfulExecutionClaims,
  renderTruthfulExecutionAnswerGuidance,
  renderTruthfulExecutionClaimContext,
  shouldUseBufferedTruthfulExecutionResponse,
  TRUTHFUL_EXECUTION_CLAIM_SYSTEM_INSTRUCTIONS,
  validateAnswerExecutionClaims,
} = jiti(path.join(__dirname, "..", "src", "lib", "truthful-execution-claim-guard.ts"));

const tests = [];

function runTest(name, fn) {
  tests.push({ name, fn });
}

function getAudit(id) {
  const entry = buildCapabilityAvailabilityAudit().find((item) => item.id === id);
  assert.ok(entry, `missing audit entry ${id}`);
  return entry;
}

function makeEmptySnapshot(overrides = {}) {
  return {
    executedTools: [],
    deferredCapabilities: [],
    recommendedCapabilities: [],
    unavailableCapabilities: [
      "document_processor",
      "table_extraction_enhanced",
      "ocr",
      "vision_page_understanding",
      "rendered_page_inspection",
      "document_ai_table_recovery",
    ],
    asyncWorkCreated: false,
    asyncWorkStatus: null,
    asyncWorkType: null,
    asyncWorkExecutedSteps: [],
    asyncWorkDeferredSteps: [],
    createdArtifactKeys: [],
    reusedArtifactKeys: [],
    persistedMemoryUpdates: [],
    inspectionTaskResults: [],
    contextGapKinds: [],
    limitations: [],
    nativeRuntimePayloads: {
      traces: [],
      summary: {
        candidateCount: 0,
        selectedCount: 0,
        includedCount: 0,
        excludedCount: 0,
        selectedThenIncludedCount: 0,
        selectedThenExcludedCount: 0,
        diagnosticState: "no_candidate",
        diagnosticReasons: ["no_candidate: no native runtime payload candidate reached adaptive transport"],
        includedByKind: {},
        excludedByReason: {},
        excludedBySubreason: {},
        runtimeMissingCount: 0,
        modelSupportedRuntimeMissingCount: 0,
        missingInputCount: 0,
        overBudgetCount: 0,
        approvalOrPolicyBlockedCount: 0,
        approvalConsumedAsGovernanceInputCount: 0,
        providerTargets: [],
        modelTargets: [],
        sourceAttributions: [],
        noExecutionWarnings: ["no_candidate: no native runtime payload candidate reached adaptive transport"],
        noRawPayloadIncludedInTrace: true,
      },
      traceCheck: {
        status: "unavailable",
        matchedTraceCount: 0,
        unrelatedExcludedCount: 0,
        unrelatedExcludedPayloads: [],
        noRawPayloadIncludedInTrace: true,
      },
    },
    capabilityAudit: buildCapabilityAvailabilityAudit(),
    ...overrides,
  };
}

function assertViolation(answer, snapshot, pattern) {
  const result = validateAnswerExecutionClaims(answer, snapshot);
  assert.equal(result.ok, false, `expected violation for: ${answer}`);
  assert.equal(result.violations.some((violation) => pattern.test(violation)), true, result.violations.join("\n"));
}

runTest("capability audit marks OCR vision rendered and document-AI as unavailable or deferred", () => {
  for (const id of ["ocr", "vision_page_understanding", "rendered_page_inspection", "document_ai_table_recovery"]) {
    const entry = getAudit(id);
    assert.equal(entry.registeredCapability, true);
    assert.equal(entry.executionEnabled, false);
    assert.equal(entry.approvedExecutableToolIds.length, 0);
    assert.equal(entry.onlyRecommendedOrDeferred, true);
  }
});

runTest("system instructions treat capability approvals as non-execution evidence", () => {
  assert.match(TRUTHFUL_EXECUTION_CLAIM_SYSTEM_INSTRUCTIONS, /Capability Gap & Approval Center approvals are governance state only/);
  const snapshot = makeEmptySnapshot({
    recommendedCapabilities: ["ocr"],
    limitations: ["OCR was approved for this conversation, but no OCR tool ran."],
  });
  assertViolation("OCR ran after approval and extracted the scanned page.", snapshot, /OCR/);
});

runTest("capability audit marks fake document_processor and table_extraction_enhanced as non-executable", () => {
  const documentProcessor = getAudit("document_processor");
  const enhanced = getAudit("table_extraction_enhanced");

  assert.equal(documentProcessor.executionEnabled, false);
  assert.equal(documentProcessor.approvedExecutableToolIds.length, 0);
  assert.equal(documentProcessor.relatedApprovedBuiltinToolIds.includes("existing_parser_text_extraction"), true);
  assert.equal(enhanced.executionEnabled, false);
  assert.equal(enhanced.approvedExecutableToolIds.length, 0);
});

runTest("capability audit distinguishes related parser tools from execution-enabled enhanced tools", () => {
  const ingestion = getAudit("high_fidelity_document_ingestion");

  assert.equal(ingestion.executionEnabled, false);
  assert.equal(ingestion.availability, "control_or_async_intent_only");
  assert.equal(ingestion.relatedApprovedBuiltinToolIds.includes("pdf_table_candidate_detection"), true);
  assert.equal(ingestion.approvedExecutableToolIds.length, 0);
});

runTest("snapshot distinguishes executed inspection tools from deferred capabilities", () => {
  const snapshot = buildTruthfulExecutionClaimSnapshot({
    documentIntelligence: {
      documents: [
        {
          inspectionTasks: [
            {
              id: "task-1",
              tool: "pdf_table_candidate_detection",
              createdArtifactKeys: ["table_candidate:15"],
              recommendedNextCapabilities: ["ocr", "vision_page_understanding"],
              result: {
                toolTrace: {
                  traceEvents: [
                    {
                      type: "tool_executed",
                      toolId: "pdf_table_candidate_detection",
                      capability: "pdf_table_detection",
                    },
                  ],
                  createdArtifactKeys: ["table_candidate:15"],
                  recommendedNextCapabilities: ["ocr", "vision_page_understanding"],
                },
              },
            },
          ],
        },
      ],
    },
    asyncAgentWork: {
      workItemId: "work-1",
      status: "completed_with_limitations",
      type: "context_gap_resolution",
      deferredCapabilities: [{ capability: "ocr", executed: false }],
      skippedOrDeferredSteps: ["run_approved_builtin_inspection"],
      completionState: {
        status: "completed_with_limitations",
        executedToolIds: [],
        createdArtifactKeys: [],
        reusedArtifactKeys: ["table_candidate:15"],
        deferredCapabilities: [{ capability: "ocr", executed: false }],
      },
    },
  });

  assert.equal(snapshot.executedTools.some((entry) => entry.toolId === "pdf_table_candidate_detection"), true);
  assert.equal(snapshot.deferredCapabilities.includes("ocr"), true);
  assert.equal(snapshot.asyncWorkStatus, "completed_with_limitations");
  assert.equal(snapshot.reusedArtifactKeys.includes("table_candidate:15"), true);
});

runTest("T5 page 15 table question does not allow fake OCR vision rendered or document-AI execution claims", () => {
  const snapshot = makeEmptySnapshot({
    contextGapKinds: ["missing_table_body"],
    deferredCapabilities: ["rendered_page_inspection", "ocr", "vision_page_understanding", "document_ai_table_recovery"],
  });

  assertViolation(
    "OCR/Vision pipeline recovered the page 15 table and document-AI completed extraction.",
    snapshot,
    /OCR|Vision|Document-AI/
  );
  assert.equal(
    validateAnswerExecutionClaims(
      "The table appears to exist, but the structured table body was not recovered. OCR, vision, rendered-page inspection, and document-AI are deferred.",
      snapshot
    ).ok,
    true
  );
});

runTest("T5 page 15 answer cannot turn surrounding facts into extracted table cells", () => {
  const snapshot = makeEmptySnapshot({ contextGapKinds: ["missing_table_body"] });

  assertViolation(
    "The page 15 table says 650 ppm Li, 235 F, and 250,000 ppm TDS.",
    snapshot,
    /Surrounding T5 values/
  );
  assert.equal(
    validateAnswerExecutionClaims(
      "Values such as 650 ppm Li, 235 F, and 250,000 ppm TDS appear in other context and should not be treated as extracted page 15 cells.",
      snapshot
    ).ok,
    true
  );
});

runTest("highest-fidelity ingestion cannot claim document_processor or high-fidelity completion without trace", () => {
  const snapshot = makeEmptySnapshot({
    asyncWorkCreated: true,
    asyncWorkStatus: "completed_with_limitations",
    asyncWorkType: "highest_fidelity_ingestion",
    deferredCapabilities: ["rendered_page_inspection", "ocr", "vision_page_understanding"],
    limitations: ["Full fidelity cannot be achieved with current approved tools."],
  });

  assertViolation("[Call Tool: document_processor]\nProcessing complete.", snapshot, /document_processor/);
  assertViolation("The high-fidelity pass recovered structured tables and completed ingestion.", snapshot, /High-fidelity/);
});

runTest("highest-fidelity ingestion may report async work and deferred capabilities truthfully", () => {
  const snapshot = makeEmptySnapshot({
    asyncWorkCreated: true,
    asyncWorkStatus: "completed_with_limitations",
    asyncWorkType: "highest_fidelity_ingestion",
    deferredCapabilities: ["ocr", "vision_page_understanding"],
    asyncWorkExecutedSteps: ["reuse_existing_artifacts", "record_deferred_capability"],
    asyncWorkDeferredSteps: ["run_approved_builtin_inspection"],
  });

  const answer =
    "I created an async work item for highest-fidelity ingestion. Current status: completed_with_limitations. OCR and vision are deferred; no OCR or vision extraction has been executed.";
  assert.equal(validateAnswerExecutionClaims(answer, snapshot).ok, true);
});

runTest("OCR vision extraction request cannot fabricate enhanced table extraction", () => {
  const snapshot = makeEmptySnapshot({
    deferredCapabilities: ["ocr", "vision_page_understanding"],
  });

  assertViolation(
    "[Calling Tool: table_extraction_enhanced]\nengine=ocr+vision\nExtraction Complete",
    snapshot,
    /table_extraction_enhanced|OCR\/vision|Extraction/
  );
});

runTest("memory update claims require persisted artifact evidence", () => {
  const snapshot = makeEmptySnapshot();

  assertViolation("Persistent document memory was updated with the recovered table.", snapshot, /Memory update/);

  const withArtifact = makeEmptySnapshot({
    createdArtifactKeys: ["table_candidate:15"],
    persistedMemoryUpdates: ["table_candidate:15"],
  });
  assert.equal(validateAnswerExecutionClaims("Document memory was updated with artifact table_candidate:15.", withArtifact).ok, true);
});

runTest("bracketed tool-call format is allowed only for actual executed trace tool ids", () => {
  const snapshot = makeEmptySnapshot({
    executedTools: [{ toolId: "existing_parser_text_extraction", capability: "pdf_table_body_recovery", source: "inspection_task" }],
  });

  assert.equal(validateAnswerExecutionClaims("[Call Tool: existing_parser_text_extraction]", snapshot).ok, true);
  assertViolation("[Call Tool: document_processor]", snapshot, /document_processor/);
});

runTest("visual inspection debug permits only actually produced rendered and vision claims", () => {
  const snapshot = buildTruthfulExecutionClaimSnapshot({
    progressiveAssembly: {
      visualInspection: {
        payloadsProduced: [
          { id: "visual-payload:rendered-page-15", type: "rendered_page_image", available: true },
          { id: "visual-payload:vision-15", type: "vision_observation", available: true },
        ],
        visionObservations: [{ id: "vision:15" }],
      },
    },
  });

  assert.equal(snapshot.executedTools.some((entry) => entry.toolId === "rendered_page_renderer"), true);
  assert.equal(snapshot.executedTools.some((entry) => entry.toolId === "model_vision_inspector"), true);
  assert.equal(validateAnswerExecutionClaims("Rendered-page inspection ran and vision inspected page 15.", snapshot).ok, true);
  assertViolation("OCR extracted the page 15 cells.", snapshot, /OCR/);
});

runTest("uploaded-document local debug permits rendered claims only with completed local evidence", () => {
  const snapshot = buildTruthfulExecutionClaimSnapshot({
    debugTrace: {
      uploadedDocumentDigestionLocal: [
        {
          executedLocalProducers: [
            {
              producerId: "rendered_page_renderer",
              capabilityId: "rendered_page_inspection",
              evidenceObservationIds: ["doc-wp4a3:rendered-page:1"],
            },
          ],
          localToolEnablement: {
            renderedPageImageInputStatus: "completed_with_evidence",
            ocrStatus: "not_needed",
          },
        },
      ],
    },
  });

  assert.equal(snapshot.executedTools.some((entry) => entry.toolId === "rendered_page_renderer"), true);
  assert.equal(validateAnswerExecutionClaims("Rendered-page inspection ran for the selected page.", snapshot).ok, true);
  assertViolation("OCR extracted the selected page text.", snapshot, /OCR/);
});

runTest("planned visual payload support is not treated as rendered or vision execution", () => {
  const snapshot = buildTruthfulExecutionClaimSnapshot({
    progressiveAssembly: {
      visualInspection: {
        payloadsProduced: [
          { id: "visual-payload:rendered-page-15", type: "rendered_page_image", available: false },
          { id: "visual-payload:vision-15", type: "vision_observation", available: false },
        ],
        visionObservations: [],
      },
    },
  });

  assert.equal(snapshot.executedTools.some((entry) => entry.toolId === "rendered_page_renderer"), false);
  assert.equal(snapshot.executedTools.some((entry) => entry.toolId === "model_vision_inspector"), false);
  assertViolation("Rendered-page inspection ran and vision inspected page 15.", snapshot, /Rendered-page|Vision/);
});

runTest("native main-model image inclusion is separate from OpenAI external vision producer execution", () => {
  const snapshot = buildTruthfulExecutionClaimSnapshot({
    nativeRuntimePayloadTrace: [
      {
        payloadId: "rendered_page_image:obs-1",
        payloadType: "rendered_page_image",
        kind: "rendered_page_image",
        sourceObservationId: "obs-1",
        conversationDocumentId: "doc-1",
        sourceId: "doc-1",
        sourceType: "pdf_page",
        locator: { pageNumberStart: 1, pageNumberEnd: 1, sourceLocationLabel: "demo.pdf page 1" },
        mimeType: "image/png",
        byteSize: 128,
        width: 800,
        height: 1100,
        providerTarget: "openai",
        modelTarget: "gpt-4o",
        state: "included",
        exclusionReason: null,
        detail: "Native image payload included in the actual OpenAI Chat Completions message body.",
        requestFormat: "openai_chat_completions_stream",
        budgetImpact: { tokenEstimate: 0, byteSize: 128, imageCount: 1 },
        approvalState: "not_required",
        traceId: "trace-1",
        planId: "plan-1",
        transportPayloadId: "rendered_page_image:obs-1",
        noRawPayloadIncludedInTrace: true,
      },
    ],
  });

  assert.equal(snapshot.nativeRuntimePayloads.summary.includedCount, 1);
  assert.equal(validateAnswerExecutionClaims("The main model request included the rendered page image.", snapshot).ok, true);
  assertViolation("OpenAI vision ran on the rendered page image.", snapshot, /OpenAI vision/);
});

runTest("requested native trace check stays included despite unrelated crop-image gap", () => {
  const renderedTraceBase = {
    payloadId: "rendered_page_image:doc-1:rendered-page:15",
    payloadType: "rendered_page_image",
    kind: "rendered_page_image",
    sourceObservationId: "doc-1:rendered-page:15",
    conversationDocumentId: "doc-1",
    sourceId: "doc-1",
    sourceType: "pdf_page",
    locator: { pageNumberStart: 15, pageNumberEnd: 15, sourceLocationLabel: "demo.pdf page 15" },
    mimeType: "image/png",
    byteSize: 128,
    width: 800,
    height: 1100,
    providerTarget: "openai",
    modelTarget: "gpt-5.4-mini-2026-03-17",
    exclusionReason: null,
    runtimeSubreason: null,
    budgetImpact: { tokenEstimate: 0, byteSize: 128, imageCount: 1 },
    approvalState: "not_required",
    traceId: "trace-1",
    planId: "plan-1",
    transportPayloadId: "rendered_page_image:doc-1:rendered-page:15",
    noRawPayloadIncludedInTrace: true,
  };
  const snapshot = buildTruthfulExecutionClaimSnapshot({
    nativeRuntimePayloadTrace: [
      { ...renderedTraceBase, state: "candidate", detail: "candidate", requestFormat: null },
      { ...renderedTraceBase, state: "selected", detail: "selected", requestFormat: null },
      {
        payloadId: "missing:page_crop_image:need:page_crop_image:15",
        payloadType: "page_crop_image",
        kind: "source_observation_image",
        sourceObservationId: null,
        conversationDocumentId: null,
        sourceId: null,
        sourceType: null,
        locator: null,
        mimeType: null,
        byteSize: null,
        width: null,
        height: null,
        providerTarget: "openai",
        modelTarget: "gpt-5.4-mini-2026-03-17",
        state: "model_supported_runtime_missing",
        exclusionReason: "model_supported_runtime_missing",
        runtimeSubreason: "runtime_request_builder_missing_image_support",
        detail: "Payload type page_crop_image is declared but not executable in A-04h.",
        requestFormat: null,
        budgetImpact: null,
        approvalState: "unknown",
        traceId: null,
        planId: "plan-1",
        transportPayloadId: null,
        noRawPayloadIncludedInTrace: true,
      },
      {
        ...renderedTraceBase,
        state: "included",
        detail: "Native image payload included in the actual OpenAI Chat Completions message body as an image_url content part.",
        requestFormat: "openai_chat_completions_stream",
      },
    ],
    nativeRuntimeTraceVerdictSelector: {
      payloadType: "rendered_page_image",
      conversationDocumentId: "doc-1",
      pageNumber: 15,
      providerTarget: "openai",
      modelTarget: "gpt-5.4-mini-2026-03-17",
    },
  });
  const context = buildTruthfulExecutionClaimContext({
    nativeRuntimePayloadTrace: snapshot.nativeRuntimePayloads.traces,
    nativeRuntimeTraceVerdictSelector: {
      payloadType: "rendered_page_image",
      conversationDocumentId: "doc-1",
      pageNumber: 15,
      providerTarget: "openai",
      modelTarget: "gpt-5.4-mini-2026-03-17",
    },
  });

  assert.equal(snapshot.nativeRuntimePayloads.traceCheck.status, "included");
  assert.equal(snapshot.nativeRuntimePayloads.traceCheck.unrelatedExcludedCount, 1);
  assert.equal(snapshot.nativeRuntimePayloads.summary.excludedByReason.model_supported_runtime_missing, 1);
  assert.match(context, /nativeRuntimeTraceCheck\.status: included/);
  assert.match(context, /You may answer visual questions about that included image/);
  assert.match(context, /nativeRuntimeTraceCheck\.unrelatedExcludedPayloads: page_crop_image:model_supported_runtime_missing/);
  assert.equal(validateAnswerExecutionClaims("The main model request included the rendered page image.", snapshot).ok, true);
  assert.equal(
    validateAnswerExecutionClaims(
      "The main model received the rendered page image. The visual summary is based on the included rendered image.",
      snapshot
    ).ok,
    true
  );
  assert.equal(
    validateAnswerExecutionClaims(
      "The main model used the included rendered page image to answer visually.",
      snapshot
    ).ok,
    true
  );
  assert.equal(
    validateAnswerExecutionClaims(
      "Runtime trace check: selected_but_excluded, final exclusion reason: model_supported_runtime_missing",
      snapshot
    ).ok,
    false
  );
  assert.match(
    enforceTruthfulExecutionClaims(
      "Runtime trace check: selected_but_excluded, final exclusion reason: model_supported_runtime_missing",
      snapshot
    ).answer,
    /Requested native main-model payload verdict: included/
  );
  assert.doesNotMatch(
    enforceTruthfulExecutionClaims(
      "Runtime trace check: selected_but_excluded, final exclusion reason: model_supported_runtime_missing",
      snapshot
    ).answer,
    /^I cannot run OCR\/vision-enhanced extraction yet/
  );
  assertViolation("I ran OCR on page 15.", snapshot, /OCR/);
  assertViolation("OpenAI vision ran on the rendered page image.", snapshot, /OpenAI vision/);
  assertViolation("External vision producer ran on page 15.", snapshot, /External vision producer/);
  assertViolation("I used external OpenAI vision producer on page 15.", snapshot, /OpenAI vision/);
  assertViolation("I ran document-AI on page 15.", snapshot, /Document-AI/);
  assertViolation("I used table_extraction_enhanced on page 15.", snapshot, /table_extraction_enhanced/);
  assertViolation("A table extraction tool recovered the structured table body.", snapshot, /Table-tool structural/);

  const answerGuidance = renderTruthfulExecutionAnswerGuidance({
    ...snapshot,
    deferredCapabilities: ["ocr", "vision_page_understanding", "document_ai_table_recovery"],
    recommendedCapabilities: ["table_extraction_enhanced"],
    asyncWorkCreated: true,
    asyncWorkStatus: "completed_with_limitations",
    asyncWorkType: "context_gap_resolution",
    createdArtifactKeys: ["table_candidate:15"],
    reusedArtifactKeys: ["table_candidate:15"],
    persistedMemoryUpdates: ["table_candidate:15"],
    limitations: ["OCR and document-AI remain unavailable for this turn."],
  });
  assert.match(answerGuidance, /Requested native image payload verdict: included/);
  assert.match(answerGuidance, /Answer the user's visual\/document question from that included image first/);
  assert.match(answerGuidance, /separator line `---`/);
  assert.match(answerGuidance, /Runtime trace \/ diagnostics/);
  assert.match(answerGuidance, /Do not lead with `I can only report execution that appears in the runtime trace\.`/);
  assert.match(answerGuidance, /Inspect Context/);
  assert.match(answerGuidance, /page_crop_image must not override/);
  assert.doesNotMatch(answerGuidance, /Executed tools:/);
  assert.doesNotMatch(answerGuidance, /Deferred capabilities \(not executed\):/);
  assert.doesNotMatch(answerGuidance, /document_ai_table_recovery/);
  assert.doesNotMatch(answerGuidance, /table_candidate:15/);
  assert.doesNotMatch(answerGuidance, /data:image\//);

  const contextWithDeferredGaps = renderTruthfulExecutionClaimContext({
    ...snapshot,
    deferredCapabilities: ["ocr", "vision_page_understanding", "document_ai_table_recovery"],
    recommendedCapabilities: ["table_extraction_enhanced"],
    limitations: ["OCR and document-AI remain unavailable for this turn."],
  });
  assert.match(contextWithDeferredGaps, /Requested native main-model payload verdict: included/);
  assert.match(contextWithDeferredGaps, /answer visual questions from the included native image payload/);
  assert.match(
    contextWithDeferredGaps,
    /Do not let deferred OCR, external vision, document-AI, enhanced table extraction, or unrelated native lane gaps override/
  );
});

runTest("selected native image without included runtime trace cannot support main model saw image claim", () => {
  const snapshot = buildTruthfulExecutionClaimSnapshot({
    nativeRuntimePayloadTrace: [
      {
        payloadId: "rendered_page_image:obs-1",
        payloadType: "rendered_page_image",
        kind: "rendered_page_image",
        sourceObservationId: "obs-1",
        conversationDocumentId: "doc-1",
        sourceId: "doc-1",
        sourceType: "pdf_page",
        locator: { pageNumberStart: 1 },
        mimeType: "image/png",
        byteSize: 128,
        width: 800,
        height: 1100,
        providerTarget: "local",
        modelTarget: "text-model",
        state: "runtime_missing",
        exclusionReason: "runtime_missing",
        detail: "Selected image could not be included by the active runtime.",
        requestFormat: null,
        budgetImpact: { tokenEstimate: 0, byteSize: 128, imageCount: 1 },
        approvalState: "not_required",
        traceId: "trace-1",
        planId: "plan-1",
        transportPayloadId: "rendered_page_image:obs-1",
        noRawPayloadIncludedInTrace: true,
      },
    ],
  });

  assertViolation("The main model saw the rendered page image.", snapshot, /Main-model native/);

  const answerGuidance = renderTruthfulExecutionAnswerGuidance(snapshot);
  assert.match(answerGuidance, /Requested native image payload verdict: selected_but_excluded/);
  assert.match(answerGuidance, /reason: runtime_missing/);
  assert.match(answerGuidance, /Do not answer as if the main model saw the image/);
  assert.doesNotMatch(answerGuidance, /Answer the user's visual\/document question from that included image first/);
});

runTest("AgentWorkPlan capability needs become deferred recommendations not execution evidence", () => {
  const snapshot = buildTruthfulExecutionClaimSnapshot({
    debugTrace: {
      agentWorkPlan: {
        capabilityNeeds: [
          {
            capability: "ocr",
            state: "deferred",
          },
          {
            capability: "vision_page_understanding",
            state: "unavailable",
          },
        ],
        truthfulLimitations: [
          { summary: "OCR and vision are needed but no approved adapter ran." },
        ],
      },
    },
  });

  assert.equal(snapshot.deferredCapabilities.includes("ocr"), true);
  assert.equal(snapshot.recommendedCapabilities.includes("vision_page_understanding"), true);
  assert.equal(snapshot.executedTools.some((entry) => /ocr|vision/i.test(entry.toolId)), false);
  assert.equal(snapshot.limitations.includes("OCR and vision are needed but no approved adapter ran."), true);
});

runTest("async work creation is not completed extraction", () => {
  const snapshot = makeEmptySnapshot({
    asyncWorkCreated: true,
    asyncWorkStatus: "completed_with_limitations",
    asyncWorkType: "context_gap_resolution",
  });

  assertViolation("The async work item completed extraction for the missing table.", snapshot, /Extraction completion/);
});

runTest("report creation cannot claim deliverable-grade validation without validation trace", () => {
  const snapshot = makeEmptySnapshot({
    contextGapKinds: ["missing_table_body"],
  });

  assertViolation("The best possible report is ready and deliverable-grade validation completed.", snapshot, /Deliverable-grade validation/);
});

runTest("runtime prompt context labels executed deferred unavailable and memory evidence clearly", () => {
  const context = buildTruthfulExecutionClaimContext({
    asyncAgentWork: {
      workItemId: "work-1",
      status: "completed_with_limitations",
      type: "highest_fidelity_ingestion",
      deferredCapabilities: [{ capability: "ocr", executed: false }],
      completionState: {
        deferredCapabilities: [{ capability: "ocr", executed: false }],
        createdArtifactKeys: [],
        reusedArtifactKeys: ["table_candidate:15"],
      },
    },
  });

  assert.match(context, /Executed tools:/);
  assert.match(context, /Deferred capabilities \(not executed\):/);
  assert.match(context, /Unavailable or not execution-enabled capabilities:/);
  assert.match(context, /asyncWorkStatus: completed_with_limitations/);
  assert.match(context, /reused artifact keys: table_candidate:15/);
});

runTest("producer states are explicitly framed as not execution", () => {
  assert.match(TRUTHFUL_EXECUTION_CLAIM_SYSTEM_INSTRUCTIONS, /catalog_only, unavailable, missing, approval_required/);
  assert.match(TRUTHFUL_EXECUTION_CLAIM_SYSTEM_INSTRUCTIONS, /native file lane being planned or cataloged is not evidence/);
  assert.match(TRUTHFUL_EXECUTION_CLAIM_SYSTEM_INSTRUCTIONS, /table_body_recovery producer request, need, or unresolved result is not a recovered table body/);
});

runTest("enforcer replaces fake execution claims with a truthful correction", () => {
  const snapshot = makeEmptySnapshot({
    deferredCapabilities: ["ocr", "vision_page_understanding"],
    contextGapKinds: ["missing_table_body"],
  });
  const guarded = enforceTruthfulExecutionClaims(
    "[Calling Tool: table_extraction_enhanced]\nengine=ocr+vision\nExtraction Complete",
    snapshot
  );

  assert.equal(guarded.validation.ok, false);
  assert.match(guarded.answer, /I cannot run OCR\/vision-enhanced extraction yet/);
  assert.match(guarded.answer, /No OCR, vision, rendered-page inspection, document-AI, document_processor, or table_extraction_enhanced tool has run/);
  assert.doesNotMatch(guarded.answer, /Guarded claims removed/);
});

runTest("execution-sensitive prompt requests buffered guarded response mode", () => {
  const snapshot = makeEmptySnapshot();

  assert.equal(
    shouldUseBufferedTruthfulExecutionResponse({
      userPrompt: "Run OCR/vision-enhanced extraction on every table.",
      snapshot,
    }),
    true
  );
  assert.equal(
    shouldUseBufferedTruthfulExecutionResponse({
      userPrompt: "Say hello to the team.",
      snapshot,
    }),
    false
  );
});

let failures = 0;
for (const test of tests) {
  try {
    test.fn();
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
  console.log(`All ${tests.length} truthful execution claim guard tests passed.`);
}
