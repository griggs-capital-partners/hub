import assert from "node:assert/strict";
import path from "node:path";
import { fileURLToPath } from "node:url";
import createJiti from "jiti";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const jiti = createJiti(import.meta.url, { moduleCache: false });
const {
  DEFAULT_SOURCE_OBSERVATION_PRODUCER_MANIFESTS,
  SOURCE_OBSERVATION_PRODUCER_RESULT_STATES,
  buildProducerRequestsFromAgentWorkPlan,
  buildProducerRequestsFromSourceObservationNeeds,
  buildProducerRequestsFromTableSignals,
  buildSourceObservationProducerDebugSummary,
  runDeterministicSourceObservationProducer,
  runDeterministicSourceObservationProducers,
} = jiti(path.join(__dirname, "..", "src", "lib", "source-observation-producers.ts"));

const tests = [];

function runTest(name, fn) {
  tests.push({ name, fn });
}

function makeObservation(overrides = {}) {
  return {
    id: overrides.id ?? "obs-1",
    type: overrides.type ?? "table_signal",
    traceId: overrides.traceId ?? "trace-1",
    planId: overrides.planId ?? "plan-1",
    conversationId: "conv-1",
    messageId: null,
    conversationDocumentId: overrides.conversationDocumentId ?? "doc-1",
    sourceId: overrides.sourceId ?? "doc-1",
    sourceDocumentId: overrides.sourceDocumentId ?? "doc-1",
    sourceKind: overrides.sourceKind ?? "pdf_page",
    sourceVersion: null,
    sourceLocator: {
      pageNumberStart: 15,
      pageNumberEnd: 15,
      pageLabelStart: "15",
      pageLabelEnd: "15",
      tableId: "table-1",
      sourceLocationLabel: "source.pdf page 15 table-1",
      ...(overrides.sourceLocator ?? {}),
    },
    content: overrides.content ?? "Likely true data table detected on page 15.",
    payloadKind: overrides.payloadKind ?? "warning",
    payload: overrides.payload ?? null,
    producer: overrides.producer ?? {
      producerId: "source_observation_reuse",
      producerKind: "system",
      capabilityId: "source_observation_reuse",
      executionState: "deterministically_derived",
      executionEvidence: { fixture: true },
      noUnavailableToolExecutionClaimed: true,
    },
    extractionMethod: overrides.extractionMethod ?? "fixture",
    confidence: overrides.confidence ?? 0.76,
    limitations: overrides.limitations ?? [],
    relatedGapHints: overrides.relatedGapHints ?? [
      {
        id: "gap-table-body",
        kind: "missing_table_body",
        capability: "document_ai_table_recovery",
        payloadType: "structured_table",
        reason: "Parser detected a table but did not recover the body.",
        sourceId: "doc-1",
        conversationDocumentId: "doc-1",
        locator: {
          pageNumberStart: 15,
          tableId: "table-1",
        },
      },
    ],
  };
}

runTest("builds producer requests from AgentWorkPlan needs and SourceObservationNeeds", () => {
  const requests = buildProducerRequestsFromAgentWorkPlan({
    agentWorkPlan: {
      planId: "plan-1",
      traceId: "trace-1",
      conversationId: "conv-1",
      messageId: "msg-1",
      sourceNeeds: [
        {
          sourceId: "doc-1",
          state: "unavailable",
          coverageTarget: "table_body",
          reason: "Need table body coverage.",
          detail: "Table body is missing.",
        },
      ],
      capabilityNeeds: [
        {
          capability: "ocr",
          state: "deferred",
          payloadTypes: ["ocr_text"],
          reason: "OCR would be needed for sparse text pages.",
        },
      ],
      modelCapabilityNeeds: [
        {
          capability: "native_file_input",
          state: "unavailable",
          unavailablePayloadTypes: ["native_file_reference"],
          reason: "Native file runtime support is unavailable.",
        },
      ],
    },
    sourceObservationNeeds: [
      {
        id: "need-structured-table",
        observationType: "structured_table_observation",
        sourceId: "doc-1",
        conversationDocumentId: "doc-1",
        capability: "pdf_table_body_recovery",
        payloadType: "structured_table",
        state: "needed",
        reason: "Need deterministic table-body recovery if current evidence has it.",
        noExecutionClaimed: true,
      },
    ],
  });

  assert.ok(requests.some((request) => request.requestedPayloadType === "structured_table"));
  assert.ok(requests.some((request) => request.requestedPayloadType === "ocr_text"));
  assert.ok(requests.some((request) => request.requestedPayloadType === "native_file_reference"));
  assert.ok(requests.every((request) => request.noExecutionClaimed));
});

runTest("supports explicit producer result states and gates observations to completed_with_evidence", () => {
  assert.deepEqual(SOURCE_OBSERVATION_PRODUCER_RESULT_STATES, [
    "completed_with_evidence",
    "skipped",
    "unavailable",
    "missing",
    "catalog_only",
    "approval_required",
    "blocked_by_policy",
    "deferred",
    "failed",
  ]);

  const signal = makeObservation();
  const structured = makeObservation({
    id: "obs-structured-table",
    type: "structured_table_observation",
    content: "Recovered table body\n| ion | value |\n| Na | 10 |",
    payloadKind: "table",
    payload: { rows: [["ion", "value"], ["Na", "10"]] },
    producer: {
      producerId: "existing_parser_text_extraction",
      producerKind: "document_intelligence",
      capabilityId: "pdf_table_body_recovery",
      executionState: "deterministically_derived",
      executionEvidence: { parserStructuredRange: true },
      noUnavailableToolExecutionClaimed: true,
    },
    relatedGapHints: [],
  });
  const [request] = buildProducerRequestsFromTableSignals({ observations: [signal] });
  const completed = runDeterministicSourceObservationProducer({
    request,
    observations: [signal, structured],
  });
  assert.equal(completed.state, "completed_with_evidence");
  assert.deepEqual(completed.observationIds, ["obs-structured-table"]);
  assert.equal(completed.unresolvedNeeds.length, 0);

  const unresolved = runDeterministicSourceObservationProducer({
    request,
    observations: [signal],
  });
  assert.equal(unresolved.state, "missing");
  assert.equal(unresolved.observations.length, 0);
  assert.ok(unresolved.unresolvedNeeds.some((need) => need.payloadType === "structured_table"));
  assert.ok(unresolved.unresolvedNeeds.some((need) => need.payloadType === "ocr_text"));
  assert.ok(unresolved.unresolvedNeeds.some((need) => need.payloadType === "vision_observation"));
});

runTest("keeps unavailable native/OCR/vision/rendered/Python/connector needs unresolved", () => {
  const needs = [
    ["native_file_reference", "source_connector_read"],
    ["ocr_text", "ocr"],
    ["vision_observation", "vision_page_understanding"],
    ["rendered_page_image", "rendered_page_inspection"],
    ["document_ai_result", "document_ai_table_recovery"],
    ["code_analysis_result", "code_repository_inspection"],
  ].map(([payloadType, capability]) => ({
    id: `need-${payloadType}`,
    observationType: payloadType,
    sourceId: null,
    capability,
    payloadType,
    state: "unavailable",
    reason: `${payloadType} is not executable in WP3B.`,
    noExecutionClaimed: true,
  }));
  const requests = buildProducerRequestsFromSourceObservationNeeds({ needs });
  const results = runDeterministicSourceObservationProducers({ requests, observations: [] });

  assert.ok(results.every((result) => result.state !== "completed_with_evidence"));
  assert.equal(results.find((result) => result.request.requestedPayloadType === "native_file_reference")?.state, "catalog_only");
  assert.equal(results.find((result) => result.request.requestedPayloadType === "ocr_text")?.state, "unavailable");
  assert.equal(results.find((result) => result.request.requestedPayloadType === "vision_observation")?.state, "unavailable");
  assert.equal(results.find((result) => result.request.requestedPayloadType === "rendered_page_image")?.state, "unavailable");
  assert.equal(results.find((result) => result.request.requestedPayloadType === "document_ai_result")?.state, "unavailable");
  assert.equal(results.find((result) => result.request.requestedPayloadType === "code_analysis_result")?.state, "unavailable");
  assert.ok(results.every((result) => result.observations.length === 0));
});

runTest("reuses canonical catalog identifiers in manifests and debug summary", () => {
  const manifestIds = DEFAULT_SOURCE_OBSERVATION_PRODUCER_MANIFESTS.flatMap((manifest) => [
    ...manifest.canonicalCatalogIds.payloadTypes,
    ...manifest.canonicalCatalogIds.laneIds,
    ...manifest.canonicalCatalogIds.toolIds,
    ...manifest.canonicalCatalogIds.capabilityIds,
  ]);
  assert.ok(manifestIds.includes("structured_table"));
  assert.ok(manifestIds.includes("document_ai_table_lane"));
  assert.ok(manifestIds.includes("source_observation"));
  assert.ok(!manifestIds.includes("table_body_payload"));

  const requests = buildProducerRequestsFromSourceObservationNeeds({
    needs: [
      {
        id: "need-native",
        observationType: "native_file_reference",
        sourceId: null,
        capability: "source_connector_read",
        payloadType: "native_file_reference",
        state: "unavailable",
        reason: "Native file lane is cataloged only.",
        noExecutionClaimed: true,
      },
      {
        id: "need-structured",
        observationType: "structured_table_observation",
        sourceId: "doc-1",
        capability: "document_ai_table_recovery",
        payloadType: "structured_table",
        state: "needed",
        reason: "Structured table payload is needed.",
        noExecutionClaimed: true,
      },
    ],
  });
  const results = runDeterministicSourceObservationProducers({ requests, observations: [] });
  const summary = buildSourceObservationProducerDebugSummary({ requests, results });

  assert.equal(summary.nativeFileLane.plannedCount, 1);
  assert.equal(summary.nativeFileLane.catalogOnlyCount, 1);
  assert.equal(summary.tableBodyRecovery.requestedCount, 1);
  assert.ok(summary.reusedCatalogIdentifiers.includes("native_file_reference"));
  assert.ok(summary.reusedCatalogIdentifiers.includes("structured_table"));
  assert.equal(summary.newlyIntroducedIdentifierCount, 0);
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
