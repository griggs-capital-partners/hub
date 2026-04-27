import assert from "node:assert/strict";
import path from "node:path";
import { fileURLToPath } from "node:url";
import createJiti from "jiti";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const jiti = createJiti(import.meta.url, { moduleCache: false });
const {
  buildCapabilityAvailabilityAudit,
  buildGuardedTruthfulExecutionStreamResult,
  isExecutionSensitivePrompt,
  shouldUseBufferedTruthfulExecutionResponse,
} = jiti(path.join(__dirname, "..", "src", "lib", "truthful-execution-claim-guard.ts"));

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

function visibleText(result) {
  return result.clientEvents
    .filter((event) => event.type === "content_delta")
    .map((event) => event.delta)
    .join("");
}

const tests = [];

function runTest(name, fn) {
  tests.push({ name, fn });
}

runTest("execution-sensitive prompt is detected for OCR vision extraction request", () => {
  assert.equal(isExecutionSensitivePrompt("Run OCR/vision-enhanced extraction on every table."), true);
  assert.equal(isExecutionSensitivePrompt("Can you say hello to the team?"), false);
});

runTest("execution-sensitive responses are buffered before validation", () => {
  const result = buildGuardedTruthfulExecutionStreamResult({
    userPrompt: "Run OCR/vision-enhanced extraction on every table.",
    snapshot: makeEmptySnapshot({ deferredCapabilities: ["ocr", "vision_page_understanding"] }),
    events: [
      { type: "content_delta", delta: "[Calling Tool: table_extraction_enhanced]\n" },
      { type: "content_delta", delta: "engine=ocr+vision\nExtraction Complete" },
      { type: "done", model: "test-model" },
    ],
  });

  assert.equal(result.mode, "buffer_then_guard");
  assert.equal(result.validation.ok, false);
  assert.doesNotMatch(visibleText(result), /\[Calling Tool: table_extraction_enhanced\]/);
});

runTest("fake OCR vision engine text never reaches the client stream", () => {
  const result = buildGuardedTruthfulExecutionStreamResult({
    userPrompt: "Run OCR/vision-enhanced extraction on every table.",
    snapshot: makeEmptySnapshot({ deferredCapabilities: ["ocr", "vision_page_understanding"] }),
    events: [
      { type: "content_delta", delta: "Processing...\nengine=ocr+vision\nExtraction Complete" },
      { type: "done", model: "test-model" },
    ],
  });

  assert.doesNotMatch(visibleText(result), /engine=ocr\+vision/i);
  assert.match(visibleText(result), /No OCR, vision/);
});

runTest("final visible message and saved message match after guard", () => {
  const result = buildGuardedTruthfulExecutionStreamResult({
    userPrompt: "Run OCR/vision-enhanced extraction on every table.",
    snapshot: makeEmptySnapshot({ deferredCapabilities: ["ocr"] }),
    events: [
      { type: "content_delta", delta: "[Calling Tool: table_extraction_enhanced]\nExtraction Complete" },
      { type: "done", model: "test-model" },
    ],
  });

  assert.equal(result.visibleAnswer, result.savedAnswer);
  assert.equal(visibleText(result), result.savedAnswer);
});

runTest("guarded stream does not rely on delete replace correction behavior", () => {
  const result = buildGuardedTruthfulExecutionStreamResult({
    userPrompt: "Run OCR/vision-enhanced extraction on every table.",
    snapshot: makeEmptySnapshot({ deferredCapabilities: ["ocr"] }),
    events: [
      { type: "content_delta", delta: "[Calling Tool: table_extraction_enhanced]\nExtraction Complete" },
      { type: "done", model: "test-model" },
    ],
  });

  assert.equal(result.clientEvents.some((event) => event.type === "content_delta"), true);
  assert.equal(result.clientEvents.some((event) => event.type === "delete_message" || event.type === "replace_message"), false);
});

runTest("OCR vision request returns unavailable deferred response when capability is not executable", () => {
  const result = buildGuardedTruthfulExecutionStreamResult({
    userPrompt: "Run OCR/vision-enhanced extraction on every table.",
    snapshot: makeEmptySnapshot({
      deferredCapabilities: [
        "rendered_page_inspection",
        "ocr",
        "vision_page_understanding",
        "document_ai_table_recovery",
      ],
    }),
    events: [
      { type: "content_delta", delta: "[Calling Tool: table_extraction_enhanced]\nExtraction Complete" },
      { type: "done", model: "test-model" },
    ],
  });

  assert.match(result.savedAnswer, /I cannot run OCR\/vision-enhanced extraction yet/);
  assert.match(result.savedAnswer, /Deferred or recommended capabilities: rendered_page_inspection, ocr, vision_page_understanding, document_ai_table_recovery/);
  assert.match(result.savedAnswer, /No OCR, vision/);
});

runTest("highest-fidelity ingestion does not stream fake document processor claims", () => {
  const result = buildGuardedTruthfulExecutionStreamResult({
    userPrompt: "Ingest this document at the highest level.",
    snapshot: makeEmptySnapshot({
      asyncWorkCreated: true,
      asyncWorkStatus: "completed_with_limitations",
      asyncWorkType: "highest_fidelity_ingestion",
      deferredCapabilities: ["ocr", "vision_page_understanding"],
      limitations: ["Full fidelity cannot be achieved with current approved tools."],
    }),
    events: [
      { type: "content_delta", delta: "[Call Tool: document_processor]\nProcessing complete." },
      { type: "done", model: "test-model" },
    ],
  });

  assert.doesNotMatch(visibleText(result), /\[Call Tool: document_processor\]/);
  assert.match(result.savedAnswer, /I cannot complete highest-fidelity ingestion/);
});

runTest("page 15 table question does not stream fake extracted cells", () => {
  const result = buildGuardedTruthfulExecutionStreamResult({
    userPrompt: "What does the page 15 table say?",
    snapshot: makeEmptySnapshot({ contextGapKinds: ["missing_table_body"] }),
    events: [
      { type: "content_delta", delta: "The page 15 table says 650 ppm Li, 235 F, and 250,000 ppm TDS." },
      { type: "done", model: "test-model" },
    ],
  });

  assert.doesNotMatch(visibleText(result), /650\s*ppm\s*Li/i);
  assert.match(result.savedAnswer, /structured table body was not recovered/);
});

runTest("guarded claim details stay debug-only in normal answer text", () => {
  const result = buildGuardedTruthfulExecutionStreamResult({
    userPrompt: "Run OCR/vision-enhanced extraction on every table.",
    snapshot: makeEmptySnapshot({ deferredCapabilities: ["ocr"] }),
    events: [
      { type: "content_delta", delta: "[Calling Tool: table_extraction_enhanced]\nengine=ocr+vision\nExtraction Complete" },
      { type: "done", model: "test-model" },
    ],
  });

  assert.equal(result.debug.guardedClaimCount > 0, true);
  assert.doesNotMatch(result.savedAnswer, /Guarded claims removed/);
});

runTest("non-sensitive clean responses may stream raw", () => {
  const result = buildGuardedTruthfulExecutionStreamResult({
    userPrompt: "Say hello to the team.",
    snapshot: makeEmptySnapshot(),
    events: [
      { type: "content_delta", delta: "Hello team." },
      { type: "done", model: "test-model" },
    ],
  });

  assert.equal(
    shouldUseBufferedTruthfulExecutionResponse({
      userPrompt: "Say hello to the team.",
      snapshot: makeEmptySnapshot(),
    }),
    false
  );
  assert.equal(result.mode, "stream_raw");
  assert.equal(visibleText(result), "Hello team.");
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
  console.log(`All ${tests.length} truthful execution stream guard tests passed.`);
}
