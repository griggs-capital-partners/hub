import assert from "node:assert/strict";
import path from "node:path";
import { fileURLToPath } from "node:url";
import createJiti from "jiti";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

process.env.NEON_AUTH_COOKIE_SECRET ||= "0123456789abcdef0123456789abcdef";
process.env.NEON_AUTH_BASE_URL ||= "http://localhost:3000";

const jiti = createJiti(import.meta.url, {
  moduleCache: false,
  alias: {
    "@/": `${path.join(__dirname, "..", "src").replace(/\\/g, "/")}/`,
  },
});
const {
  buildCapabilityGapRouteDetails,
  filterCapabilityGapRows,
  paginateCapabilityGapRows,
  parseCapabilityGapListQuery,
} = jiti(path.join(__dirname, "..", "src", "app", "api", "capabilities", "gaps", "route.ts"));

const tests = [];

function runTest(name, fn) {
  tests.push({ name, fn });
}

function makeRow(overrides = {}) {
  return {
    summaryId: overrides.summaryId ?? "capability:native_image_runtime:provider:openai",
    capabilityId: overrides.capabilityId ?? "native_image_runtime",
    capabilityLabel: overrides.capabilityLabel ?? "Native image runtime lane",
    providerId: overrides.providerId ?? "openai",
    providerLabel: overrides.providerLabel ?? "OpenAI",
    category: overrides.category ?? "native_payload_lane",
    status: overrides.status ?? "open",
    priority: overrides.priority ?? "high",
    occurrenceCount: overrides.occurrenceCount ?? 1,
    affectedConversationIds: overrides.affectedConversationIds ?? ["thread-1"],
    affectedDocumentIds: overrides.affectedDocumentIds ?? ["doc-1"],
    sourceLocators: [],
    firstSeenAt: "2026-04-30T00:00:00.000Z",
    lastSeenAt: "2026-04-30T01:00:00.000Z",
    evidenceSummary: overrides.evidenceSummary ?? "model_supported_runtime_missing on rendered page image.",
    recommendedAction: "Inspect runtime trace.",
    remainingBlockers: overrides.remainingBlockers ?? ["model_supported_runtime_missing"],
    approvalState: {
      approved: false,
      decisionId: null,
      scope: null,
      scopeId: null,
      providerId: null,
      approvedById: null,
      reason: null,
      updatedAt: null,
    },
    approvalScopesAvailable: ["conversation", "capability"],
    canApproveNow: false,
    approvalWillEnableExecution: false,
    approvalWillOnlyClearApprovalGate: overrides.remainingBlockers?.includes("approval_required") ?? false,
    candidateProviders: [],
    localCandidates: [],
    traceIds: overrides.traceIds ?? ["trace-native-1"],
    relatedGapRecordIds: overrides.relatedGapRecordIds ?? ["gap-native-1"],
    relatedDebtRecordIds: overrides.relatedDebtRecordIds ?? [],
    relatedCoverageRecordIds: overrides.relatedCoverageRecordIds ?? [],
  };
}

runTest("capability gaps query supports limit offset detail and OpenAI filtering", () => {
  const query = parseCapabilityGapListQuery(new URL(
    "http://localhost/api/capabilities/gaps?providerId=openai&blocker=model_supported_runtime_missing&limit=2&offset=1&detail=true&q=runtime"
  ));
  assert.equal(query.providerId, "openai");
  assert.equal(query.blocker, "model_supported_runtime_missing");
  assert.equal(query.limit, 2);
  assert.equal(query.offset, 1);
  assert.equal(query.detail, true);

  const rows = [
    makeRow({ summaryId: "openai-main", remainingBlockers: ["config_required"] }),
    makeRow({ summaryId: "openai-native-a" }),
    makeRow({ summaryId: "openai-native-b", traceIds: ["trace-native-2"] }),
    makeRow({ summaryId: "mistral-ocr", providerId: "mistral_ocr", providerLabel: "Mistral OCR" }),
  ];
  const filtered = filterCapabilityGapRows(rows, query);
  assert.deepEqual(filtered.map((row) => row.summaryId), ["openai-native-a", "openai-native-b"]);

  const page = paginateCapabilityGapRows(filtered, query);
  assert.deepEqual(page.rows.map((row) => row.summaryId), ["openai-native-b"]);
  assert.equal(page.pagination.totalRows, 2);
  assert.equal(page.pagination.returnedRows, 1);
  assert.equal(page.pagination.hasMore, false);
});

runTest("capability gaps query keeps blocker states distinct", () => {
  const rows = [
    makeRow({ summaryId: "config", remainingBlockers: ["config_required"], status: "config_required" }),
    makeRow({ summaryId: "approval", remainingBlockers: ["approval_required"], status: "approval_required" }),
    makeRow({ summaryId: "missing-input", remainingBlockers: ["missing_input"], status: "missing_input" }),
    makeRow({ summaryId: "adapter", remainingBlockers: ["adapter_missing"], status: "adapter_missing" }),
    makeRow({ summaryId: "policy", remainingBlockers: ["policy_blocked"], status: "policy_blocked" }),
    makeRow({ summaryId: "runtime", remainingBlockers: ["runtime_missing"], status: "open" }),
    makeRow({
      summaryId: "model-runtime",
      remainingBlockers: ["model_supported_runtime_missing"],
      status: "open",
    }),
  ];

  for (const blocker of [
    "config_required",
    "approval_required",
    "missing_input",
    "adapter_missing",
    "policy_blocked",
    "runtime_missing",
    "model_supported_runtime_missing",
  ]) {
    const query = parseCapabilityGapListQuery(new URL(`http://localhost/api/capabilities/gaps?blocker=${blocker}`));
    const matches = filterCapabilityGapRows(rows, query);
    assert.equal(matches.length, 1, blocker);
    assert.equal(matches[0].remainingBlockers[0], blocker);
  }
});

runTest("capability gap details expose native runtime subreason without raw image data", () => {
  const row = makeRow({ relatedGapRecordIds: ["gap-native-1"] });
  const details = buildCapabilityGapRouteDetails([row], {
    contextDebtRecords: [],
    capabilityGapRecords: [
      {
        id: "gap-native-1",
        gapKey: "gap:native",
        kind: "missing_context_transport",
        status: "detected",
        severity: "high",
        conversationId: "thread-1",
        conversationDocumentId: "doc-1",
        neededCapability: "native_runtime_payload:rendered_page_image",
        missingPayloadType: "rendered_page_image",
        missingToolId: null,
        missingModelCapability: null,
        title: "Native image runtime missing",
        resolutionPath: "runtime_lane",
        candidateModelCapabilities: ["image_input"],
        candidateContextLanes: ["rendered_page_image"],
        evidence: {
          runtimeTraceState: "model_supported_runtime_missing",
          runtimeExclusionReason: "model_supported_runtime_missing",
          runtimeSubreason: "provider_branch_not_direct_openai",
          nativeRuntimePayloadTrace: {
            payloadId: "rendered_page_image:doc-1:rendered-page:15",
            payloadType: "rendered_page_image",
            kind: "rendered_page_image",
            state: "model_supported_runtime_missing",
            exclusionReason: "model_supported_runtime_missing",
            runtimeSubreason: "provider_branch_not_direct_openai",
            providerTarget: "openai-compatible",
            modelTarget: "gpt-5.4-mini-2026-03-17",
            requestFormat: "chat.completions",
            sourceObservationId: "rendered-page:15",
            conversationDocumentId: "doc-1",
            sourceId: "source-1",
            locator: { pageNumberStart: 15, pageNumberEnd: 15 },
            mimeType: "image/png",
            byteSize: 199503,
            width: 1024,
            height: 576,
            dataUrl: "data:image/png;base64,SHOULD_NOT_LEAK",
            dataBase64: "SHOULD_NOT_LEAK",
            noRawPayloadIncludedInTrace: true,
          },
        },
        traceEvents: [],
        lastSeenAt: "2026-04-30T01:00:00.000Z",
      },
    ],
    sourceCoverageRecords: [],
    traceEvents: [],
  });

  assert.equal(details.capabilityGapRecords.length, 1);
  assert.deepEqual(details.capabilityGapRecords[0].nativeRuntimeEvidence, {
    runtimeTraceState: "model_supported_runtime_missing",
    runtimeExclusionReason: "model_supported_runtime_missing",
    runtimeSubreason: "provider_branch_not_direct_openai",
    providerTarget: "openai-compatible",
    modelTarget: "gpt-5.4-mini-2026-03-17",
    transportPlanId: null,
    requestFormat: "chat.completions",
    payloadId: "rendered_page_image:doc-1:rendered-page:15",
    payloadType: "rendered_page_image",
    payloadKind: "rendered_page_image",
    sourceObservationId: "rendered-page:15",
    sourceId: "source-1",
    conversationDocumentId: "doc-1",
    pageNumberStart: 15,
    pageNumberEnd: 15,
    mimeType: "image/png",
    byteSize: 199503,
    width: 1024,
    height: 576,
    noRawPayloadIncludedInTrace: true,
  });
  const serialized = JSON.stringify(details);
  assert.equal(serialized.includes("data:image/png"), false);
  assert.equal(serialized.includes("SHOULD_NOT_LEAK"), false);
});

for (const test of tests) {
  await test.fn();
}

console.log(`All ${tests.length} capability gaps route tests passed.`);
