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
  shouldUseBufferedTruthfulExecutionResponse,
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
