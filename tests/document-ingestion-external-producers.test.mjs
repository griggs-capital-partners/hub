import assert from "node:assert/strict";
import path from "node:path";
import { fileURLToPath } from "node:url";
import createJiti from "jiti";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const jiti = createJiti(import.meta.url, { moduleCache: false });
const {
  APPROVED_UPLOADED_DOCUMENT_EXTERNAL_PRODUCER_MANIFESTS,
  evaluateUploadedDocumentExternalEscalationPolicy,
  resolveUploadedDocumentExternalProducerStatuses,
  runUploadedDocumentExternalEscalationProducers,
} = jiti(path.join(__dirname, "..", "src", "lib", "document-ingestion-external-producers.ts"));
const {
  canProducerResultCreateObservation,
} = jiti(path.join(__dirname, "..", "src", "lib", "source-observation-producers.ts"));
const {
  buildRegistryUpsertsFromSourceObservationProducerResults,
} = jiti(path.join(__dirname, "..", "src", "lib", "capability-gap-context-debt-registry.ts"));
const {
  buildContextPayloadsFromSourceObservations,
} = jiti(path.join(__dirname, "..", "src", "lib", "adaptive-context-transport.ts"));
const {
  buildTruthfulExecutionClaimSnapshot,
  validateAnswerExecutionClaims,
} = jiti(path.join(__dirname, "..", "src", "lib", "truthful-execution-claim-guard.ts"));

const tests = [];

function runTest(name, fn) {
  tests.push({ name, fn });
}

function makeDocument(overrides = {}) {
  return {
    id: overrides.id ?? "doc-wp4a2",
    conversationId: "conv-wp4a2",
    filename: overrides.filename ?? "source.pdf",
    mimeType: overrides.mimeType ?? "application/pdf",
    fileType: overrides.fileType ?? "pdf",
  };
}

function makeLocalObservation(overrides = {}) {
  return {
    id: overrides.id ?? "local-obs-1",
    type: overrides.type ?? "table_signal",
    traceId: "trace-wp4a2",
    planId: "plan-wp4a2",
    conversationId: "conv-wp4a2",
    messageId: null,
    conversationDocumentId: "doc-wp4a2",
    sourceId: "doc-wp4a2",
    sourceDocumentId: "doc-wp4a2",
    sourceKind: "pdf_page",
    sourceVersion: null,
    sourceLocator: {
      pageNumberStart: 4,
      pageNumberEnd: 4,
      pageLabelStart: "4",
      pageLabelEnd: "4",
      tableId: overrides.tableId ?? "table-4",
      sourceLocationLabel: "source.pdf page 4",
    },
    content: overrides.content ?? "Local parser detected a likely table but did not recover body cells.",
    payloadKind: overrides.payloadKind ?? "warning",
    payload: overrides.payload ?? null,
    producer: overrides.producer ?? {
      producerId: "pdf_context_extraction",
      producerKind: "document_intelligence",
      capabilityId: "pdf_table_detection",
      executionState: "executed",
      executionEvidence: { fixture: true },
      noUnavailableToolExecutionClaimed: true,
    },
    extractionMethod: "fixture",
    confidence: overrides.confidence ?? 0.58,
    limitations: overrides.limitations ?? ["Parser warning fixture."],
    relatedGapHints: overrides.relatedGapHints ?? [
      {
        id: "gap-table-body",
        kind: "missing_table_body",
        capability: "document_ai_table_recovery",
        payloadType: "structured_table",
        reason: "Need richer table body recovery.",
        sourceId: "doc-wp4a2",
        conversationDocumentId: "doc-wp4a2",
        locator: { pageNumberStart: 4, tableId: "table-4" },
      },
    ],
  };
}

function makePdfMetadata() {
  return {
    extractor: "pdf-parse",
    extractorVersion: "fixture",
    totalPages: 6,
    extractedPageCount: 5,
    lowTextPageNumbers: [2],
    lowTextPageLabels: ["2"],
    suppressedHeaderLines: [],
    suppressedFooterLines: [],
    detectedTableCount: 1,
    retainedTableSummaryCount: 0,
    rejectedTableCandidateCount: 1,
    detectedTableCaptionCount: 0,
    detectedFigureCaptionCount: 1,
    pageLabelsAvailable: true,
    partialExtraction: true,
    ocrStatus: "not_implemented",
    tableExtractionStatus: "used",
    tableExtractionDetail: null,
    pageStructures: [],
    classificationCounts: {},
    detail: "Fixture PDF has one low-text page.",
  };
}

function fakeFetchReturningVision(counter) {
  return async (url, init) => {
    counter.count += 1;
    assert.equal(url, "https://api.openai.com/v1/chat/completions");
    const body = JSON.parse(init.body);
    assert.equal(body.model, "vision-fixture-model");
    assert.equal(body.messages[0].content.some((part) => part.type === "image_url"), true);
    return {
      ok: true,
      status: 200,
      async json() {
        return {
          id: "openai-request-1",
          model: "vision-fixture-model",
          choices: [
            {
              message: {
                content: "The uploaded image shows a bar chart with two series and a visible legend.",
              },
            },
          ],
        };
      },
    };
  };
}

runTest("registers approved uploaded-document external producer candidates", () => {
  const providerIds = APPROVED_UPLOADED_DOCUMENT_EXTERNAL_PRODUCER_MANIFESTS.map((manifest) => manifest.providerId);
  assert.deepEqual(providerIds, [
    "mistral_ocr",
    "llamaparse_agentic_parse",
    "google_document_ai",
    "azure_document_intelligence",
    "aws_textract",
    "adobe_pdf_extract",
    "openai_vision",
    "anthropic_vision",
    "gemini_vision",
    "e2b_sandbox",
    "daytona_sandbox",
    "unstructured_external",
  ]);
  assert.equal(new Set(providerIds).size, providerIds.length);
  assert.equal(APPROVED_UPLOADED_DOCUMENT_EXTERNAL_PRODUCER_MANIFESTS.filter((manifest) => manifest.realExecutionPath).length, 1);
  assert.equal(
    APPROVED_UPLOADED_DOCUMENT_EXTERNAL_PRODUCER_MANIFESTS.find((manifest) => manifest.realExecutionPath)?.providerId,
    "openai_vision"
  );
});

runTest("availability checks do not call network for unconfigured providers", () => {
  const counter = { count: 0 };
  const policy = evaluateUploadedDocumentExternalEscalationPolicy({
    taskPrompt: "Run OCR on the scanned page.",
    contextKind: "pdf",
    localObservations: [],
    localProducerResults: [],
    pdfExtractionMetadata: makePdfMetadata(),
  });
  const statuses = resolveUploadedDocumentExternalProducerStatuses({
    policy,
    env: {},
    approvalGranted: true,
    policyAllowsExternalProcessing: true,
    dataClassAllowsExternalProcessing: true,
    imageInputs: [],
    fetchImpl: fakeFetchReturningVision(counter),
  });
  const mistral = statuses.find((status) => status.providerId === "mistral_ocr");
  assert.equal(mistral.availabilityState, "config_required");
  assert.equal(mistral.unconfigured, true);
  assert.equal(counter.count, 0);
});

runTest("policy-blocked and approval-required gates do not call network", async () => {
  const counter = { count: 0 };
  const base = {
    document: makeDocument({ filename: "chart.png", mimeType: "image/png", fileType: "image" }),
    contextKind: "image",
    taskPrompt: "What does the chart show visually?",
    localObservations: [],
    localProducerResults: [],
    imageInputs: [
      {
        id: "image-1",
        mimeType: "image/png",
        dataBase64: "iVBORw0KGgo=",
      },
    ],
    env: { OPENAI_API_KEY: "test-key", OPENAI_VISION_MODEL: "vision-fixture-model" },
    fetchImpl: fakeFetchReturningVision(counter),
  };

  const policyBlocked = await runUploadedDocumentExternalEscalationProducers({
    ...base,
    policy: { allowExternalProcessing: false, dataClassAllowsExternalProcessing: false, approvalGranted: true },
  });
  assert.equal(policyBlocked.producerResults[0].state, "blocked_by_policy");
  assert.equal(policyBlocked.observations.length, 0);

  const approvalRequired = await runUploadedDocumentExternalEscalationProducers({
    ...base,
    policy: { allowExternalProcessing: true, dataClassAllowsExternalProcessing: true, approvalGranted: false },
  });
  assert.equal(approvalRequired.producerResults[0].state, "approval_required");
  assert.equal(approvalRequired.observations.length, 0);
  assert.equal(counter.count, 0);
});

runTest("configured mock Mistral OCR returns completed_with_evidence OCR observations", async () => {
  const result = await runUploadedDocumentExternalEscalationProducers({
    document: makeDocument(),
    contextKind: "pdf",
    taskPrompt: "Run OCR on the scanned page.",
    localObservations: [],
    localProducerResults: [],
    pdfExtractionMetadata: makePdfMetadata(),
    env: { MISTRAL_API_KEY: "test-key" },
    policy: { allowExternalProcessing: true, dataClassAllowsExternalProcessing: true, approvalGranted: true },
    allowMockExecution: true,
    mockResultsByProviderId: {
      mistral_ocr: {
        status: "completed",
        providerRequestId: "mistral-request-1",
        modelOrVersion: "mistral-ocr-fixture",
        observations: [
          {
            type: "ocr_text",
            content: "OCR text fixture for page 2.",
            payloadKind: "text",
            locator: { pageNumberStart: 2, pageNumberEnd: 2, sourceLocationLabel: "source.pdf page 2" },
            confidence: 0.81,
          },
        ],
      },
    },
    traceId: "trace-wp4a2",
    planId: "plan-wp4a2",
  });

  assert.equal(result.producerResults[0].state, "completed_with_evidence");
  assert.equal(result.observations[0].type, "ocr_text");
  assert.equal(result.observations[0].producer.executionEvidence.providerId, "mistral_ocr");
  assert.equal(canProducerResultCreateObservation(result.producerResults[0]), true);
});

runTest("configured mock parser/document-AI returns structured observations", async () => {
  const result = await runUploadedDocumentExternalEscalationProducers({
    document: makeDocument(),
    contextKind: "pdf",
    taskPrompt: "Extract the table body and form fields.",
    localObservations: [makeLocalObservation()],
    localProducerResults: [],
    env: { LLAMAPARSE_API_KEY: "test-key" },
    policy: { allowExternalProcessing: true, dataClassAllowsExternalProcessing: true, approvalGranted: true },
    allowMockExecution: true,
    mockResultsByProviderId: {
      llamaparse_agentic_parse: {
        status: "completed",
        providerRequestId: "llama-request-1",
        observations: [
          {
            type: "document_ai_result",
            content: "Recovered one table and two key-value fields.",
            payloadKind: "structured",
            payload: { tables: 1, keyValueFields: 2 },
            locator: { pageNumberStart: 4, tableId: "table-4" },
            confidence: 0.77,
          },
          {
            type: "table_extraction",
            content: "Recovered table body with two rows.",
            payloadKind: "table",
            payload: { rows: [["Name", "Value"], ["A", "10"]] },
            locator: { pageNumberStart: 4, tableId: "table-4" },
            confidence: 0.79,
          },
        ],
      },
    },
  });

  assert.equal(result.producerResults[0].state, "completed_with_evidence");
  assert.equal(result.observations.some((observation) => observation.type === "document_ai_result"), true);
  assert.equal(result.observations.some((observation) => observation.type === "table_extraction"), true);
});

runTest("vision task without rendered/image input emits missing_image_input without fetch", async () => {
  const counter = { count: 0 };
  const result = await runUploadedDocumentExternalEscalationProducers({
    document: makeDocument(),
    contextKind: "pdf",
    taskPrompt: "What does the diagram on page 2 show?",
    localObservations: [],
    localProducerResults: [],
    env: { OPENAI_API_KEY: "test-key", OPENAI_VISION_MODEL: "vision-fixture-model" },
    policy: { allowExternalProcessing: true, dataClassAllowsExternalProcessing: true, approvalGranted: true },
    fetchImpl: fakeFetchReturningVision(counter),
  });

  assert.equal(result.producerResults[0].state, "unavailable");
  assert.equal(result.producerResults[0].resolution.availabilityDetails[0].missingRequirements.includes("input:rendered_or_uploaded_image"), true);
  assert.equal(result.debugSummary.providerStatuses.find((status) => status.providerId === "openai_vision").availabilityState, "missing_image_input");
  assert.equal(result.observations.length, 0);
  assert.equal(counter.count, 0);
});

runTest("rendered page image input unblocks existing OpenAI vision path", async () => {
  const counter = { count: 0 };
  const result = await runUploadedDocumentExternalEscalationProducers({
    document: makeDocument(),
    contextKind: "pdf",
    taskPrompt: "What does the diagram on page 2 show visually?",
    localObservations: [],
    localProducerResults: [],
    imageInputs: [
      {
        id: "rendered-page:doc-wp4a2:2",
        mimeType: "image/png",
        dataUrl: "data:image/png;base64,iVBORw0KGgo=",
        pageNumber: 2,
        sourceLocator: { pageNumberStart: 2, pageNumberEnd: 2, sourceLocationLabel: "source.pdf page 2" },
        sourceObservationId: "doc-wp4a2:rendered-page:2",
        producerId: "rendered_page_renderer",
        renderedPageImage: true,
      },
    ],
    env: { OPENAI_API_KEY: "test-key", OPENAI_VISION_MODEL: "vision-fixture-model" },
    policy: { allowExternalProcessing: true, dataClassAllowsExternalProcessing: true, approvalGranted: true },
    fetchImpl: fakeFetchReturningVision(counter),
  });

  assert.equal(counter.count, 1);
  assert.equal(result.producerResults[0].state, "completed_with_evidence");
  assert.equal(result.observations[0].type, "model_vision_result");
  assert.equal(result.observations[0].sourceLocator.pageNumberStart, 2);
  assert.equal(result.debugSummary.providerStatuses.find((status) => status.providerId === "openai_vision").availabilityState, "completed_with_evidence");
});

runTest("OpenAI vision with real image input and fake fetch returns completed semantic observation", async () => {
  const counter = { count: 0 };
  const result = await runUploadedDocumentExternalEscalationProducers({
    document: makeDocument({ filename: "chart.png", mimeType: "image/png", fileType: "image" }),
    contextKind: "image",
    taskPrompt: "What does the chart show visually?",
    localObservations: [],
    localProducerResults: [],
    imageInputs: [
      {
        id: "image-1",
        mimeType: "image/png",
        dataBase64: "iVBORw0KGgo=",
        sourceLocator: { sourceLocationLabel: "chart.png" },
      },
    ],
    env: { OPENAI_API_KEY: "test-key", OPENAI_VISION_MODEL: "vision-fixture-model" },
    policy: { allowExternalProcessing: true, dataClassAllowsExternalProcessing: true, approvalGranted: true },
    fetchImpl: fakeFetchReturningVision(counter),
  });

  assert.equal(counter.count, 1);
  assert.equal(result.producerResults[0].state, "completed_with_evidence");
  assert.equal(result.observations[0].type, "model_vision_result");
  assert.equal(result.observations[0].producer.executionEvidence.providerId, "openai_vision");
  assert.equal(result.debugSummary.externalCompletedWithEvidenceCount, 1);
});

runTest("only completed_with_evidence producer results create observations", async () => {
  const failed = await runUploadedDocumentExternalEscalationProducers({
    document: makeDocument(),
    contextKind: "pdf",
    taskPrompt: "Run OCR on the scanned page.",
    localObservations: [],
    localProducerResults: [],
    pdfExtractionMetadata: makePdfMetadata(),
    env: { MISTRAL_API_KEY: "test-key" },
    policy: { allowExternalProcessing: true, dataClassAllowsExternalProcessing: true, approvalGranted: true },
    allowMockExecution: true,
    mockResultsByProviderId: {
      mistral_ocr: { status: "failed", failureReason: "fixture provider failure" },
    },
  });

  assert.equal(failed.producerResults[0].state, "failed");
  assert.equal(failed.producerResults[0].observations.length, 0);
  assert.equal(canProducerResultCreateObservation(failed.producerResults[0]), false);
});

runTest("unresolved external producer needs feed existing durable registry path", async () => {
  const result = await runUploadedDocumentExternalEscalationProducers({
    document: makeDocument(),
    contextKind: "pdf",
    taskPrompt: "What does the diagram on page 2 show?",
    localObservations: [],
    localProducerResults: [],
    env: { OPENAI_API_KEY: "test-key", OPENAI_VISION_MODEL: "vision-fixture-model" },
    policy: { allowExternalProcessing: true, dataClassAllowsExternalProcessing: true, approvalGranted: true },
  });
  const registry = buildRegistryUpsertsFromSourceObservationProducerResults({
    conversationId: "conv-wp4a2",
    conversationDocumentId: "doc-wp4a2",
    results: result.producerResults,
  });

  assert.ok(registry.contextDebtRecords.length + registry.capabilityGapRecords.length > 0);
  assert.match(JSON.stringify(registry), /missing_image_input|rendered_or_uploaded_image|vision_page_understanding/);
});

runTest("local-sufficient evidence prevents external escalation", async () => {
  const result = await runUploadedDocumentExternalEscalationProducers({
    document: makeDocument(),
    contextKind: "pdf",
    taskPrompt: "Run OCR on the scanned page.",
    localObservations: [
      makeLocalObservation({
        type: "ocr_text",
        content: "Existing completed OCR text.",
        payloadKind: "text",
        relatedGapHints: [],
        producer: {
          producerId: "mistral_ocr_extractor",
          producerKind: "document_intelligence",
          capabilityId: "ocr",
          executionState: "executed",
          executionEvidence: { providerId: "mistral_ocr", producerResultState: "completed_with_evidence" },
          noUnavailableToolExecutionClaimed: true,
        },
      }),
    ],
    localProducerResults: [],
    env: { MISTRAL_API_KEY: "test-key" },
    policy: { allowExternalProcessing: true, dataClassAllowsExternalProcessing: true, approvalGranted: true },
    allowMockExecution: true,
    mockResultsByProviderId: {
      mistral_ocr: {
        status: "completed",
        observations: [{ type: "ocr_text", content: "Should not run." }],
      },
    },
  });

  assert.equal(result.producerRequests.length, 0);
  assert.equal(result.producerResults.length, 0);
  assert.equal(result.debugSummary.providerStatuses.find((status) => status.providerId === "mistral_ocr").availabilityState, "skipped_local_sufficient");
});

runTest("completed external observations become capped transport payloads", async () => {
  const result = await runUploadedDocumentExternalEscalationProducers({
    document: makeDocument(),
    contextKind: "pdf",
    taskPrompt: "Extract the table body.",
    localObservations: [makeLocalObservation()],
    localProducerResults: [],
    env: { LLAMAPARSE_API_KEY: "test-key" },
    policy: {
      allowExternalProcessing: true,
      dataClassAllowsExternalProcessing: true,
      approvalGranted: true,
      maxExternalObservations: 1,
    },
    allowMockExecution: true,
    mockResultsByProviderId: {
      llamaparse_agentic_parse: {
        status: "completed",
        observations: [
          { type: "document_ai_result", content: "Observation one.", payloadKind: "structured", payload: { order: 1 } },
          { type: "table_extraction", content: "Observation two.", payloadKind: "table", payload: { order: 2 } },
        ],
      },
    },
  });
  const payloads = buildContextPayloadsFromSourceObservations(result.transportSelection.selectedObservations);

  assert.equal(result.transportSelection.selectedObservations.length, 1);
  assert.equal(result.transportSelection.cappedObservationCount, 1);
  assert.equal(payloads.length > 0, true);
});

runTest("truthfulness guard blocks provider claims without completed evidence and permits completed external trace", () => {
  const emptySnapshot = buildTruthfulExecutionClaimSnapshot({
    debugTrace: {
      uploadedDocumentDigestionExternal: [
        {
          providerStatuses: [
            {
              providerId: "openai_vision",
              producerId: "openai_vision_inspector",
              capabilityId: "vision_page_understanding",
              availabilityState: "approval_required",
            },
          ],
        },
      ],
    },
  });
  assert.equal(validateAnswerExecutionClaims("OpenAI vision ran and completed.", emptySnapshot).ok, false);

  const completedSnapshot = buildTruthfulExecutionClaimSnapshot({
    debugTrace: {
      uploadedDocumentDigestionExternal: [
        {
          providerStatuses: [
            {
              providerId: "openai_vision",
              producerId: "openai_vision_inspector",
              capabilityId: "vision_page_understanding",
              availabilityState: "completed_with_evidence",
            },
          ],
        },
      ],
    },
  });
  assert.equal(validateAnswerExecutionClaims("OpenAI vision ran and completed.", completedSnapshot).ok, true);
});

runTest("external sandbox candidates remain deferred and do not execute", async () => {
  const result = await runUploadedDocumentExternalEscalationProducers({
    document: makeDocument({ filename: "workbook.xlsx", mimeType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", fileType: "spreadsheet" }),
    contextKind: "spreadsheet",
    taskPrompt: "Use Python to calculate this workbook.",
    localObservations: [],
    localProducerResults: [],
    env: { E2B_API_KEY: "test-key" },
    policy: { allowExternalProcessing: true, dataClassAllowsExternalProcessing: true, approvalGranted: true },
  });

  assert.equal(result.producerResults[0].producerId, "e2b_uploaded_document_sandbox");
  assert.equal(result.producerResults[0].state, "deferred");
  assert.equal(result.observations.length, 0);
  assert.match(result.producerResults[0].recommendedResolution, /WP4C/);
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
