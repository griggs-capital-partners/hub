import assert from "node:assert/strict";
import path from "node:path";
import { fileURLToPath } from "node:url";
import createJiti from "jiti";
import {
  getPageAwarePdfExpectations,
  getPageAwarePdfExtractionFixture,
  getT5DeckExpectations,
  getT5DeckPdfExtractionFixture,
} from "./fixtures/context-pdf-fixtures.mjs";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const jiti = createJiti(import.meta.url, { moduleCache: false });
const { buildPdfContextExtractionResult } = jiti(
  path.join(__dirname, "..", "src", "lib", "context-pdf.ts")
);
const {
  buildDefaultInspectionToolBroker,
  buildDefaultInspectionToolRegistry,
  synthesizePdfDocumentIntelligence,
} = jiti(path.join(__dirname, "..", "src", "lib", "document-intelligence.ts"));
const {
  InspectionToolBroker,
  InspectionToolRegistry,
  buildCompletedToolResult,
} = jiti(path.join(__dirname, "..", "src", "lib", "inspection-tool-broker.ts"));

const tests = [];

function runTest(name, fn) {
  tests.push({ name, fn });
}

function makeInvocation(overrides = {}) {
  return {
    invocationId: overrides.invocationId ?? "doc-1:pdf_table_detection:15",
    sourceDocumentId: overrides.sourceDocumentId ?? "doc-1",
    sourceType: overrides.sourceType ?? "pdf",
    requestedCapability: overrides.requestedCapability ?? "pdf_table_detection",
    purpose: overrides.purpose ?? "Detect a likely table page.",
    input: overrides.input ?? {
      pageNumber: 15,
      title: "Smackover Water Chemistry",
      confidence: "low",
      hasExtractedText: true,
    },
    location: overrides.location ?? { pageNumber: 15 },
    recommendedNextCapabilities: overrides.recommendedNextCapabilities,
    proposedToolPaths: overrides.proposedToolPaths,
  };
}

function makePermissionRequirement() {
  return {
    requiresNetwork: false,
    requiresUserApproval: false,
    requiresAdminApproval: true,
    readsSourceDocument: true,
    writesArtifacts: true,
    tenantScoped: true,
  };
}

function makeCostEstimate() {
  return {
    costClass: "variable",
    metered: true,
    unitLabel: "page",
    estimatedUnitCostUsd: null,
  };
}

runTest("registry registers and returns executable tools by capability", () => {
  const registry = buildDefaultInspectionToolRegistry();
  const tableDetectionTools = registry.getToolsByCapability("pdf_table_detection");
  const allTableDetectionTools = registry.getToolsByCapability("pdf_table_detection", {
    includeUnapproved: true,
  });

  assert.deepEqual(tableDetectionTools.map((tool) => tool.id), ["pdf_table_candidate_detection"]);
  assert.deepEqual(allTableDetectionTools.map((tool) => tool.id), ["pdf_table_candidate_detection"]);
  assert.equal(tableDetectionTools[0]?.approvalStatus, "built_in");
  assert.ok(registry.getToolsByCapability("artifact_validation").some((tool) => tool.id === "pdf_sparse_table_warning"));
});

runTest("broker selects the deterministic approved built-in for PDF table detection", () => {
  const broker = buildDefaultInspectionToolBroker();
  const result = broker.invoke(makeInvocation());

  assert.equal(result.status, "completed");
  assert.equal(result.requestedCapability, "pdf_table_detection");
  assert.equal(result.selectedTool?.id, "pdf_table_candidate_detection");
  assert.match(result.selectionReason, /highest-ranked eligible approved tool/);
  assert.equal(result.governanceTrace.eligibleTools.includes("pdf_table_candidate_detection"), true);
  assert.equal(result.traceEvents.some((event) => event.type === "tool_selected"), true);
});

runTest("tool result can become a durable knowledge artifact payload", () => {
  const expectations = getPageAwarePdfExpectations();
  const extraction = buildPdfContextExtractionResult(getPageAwarePdfExtractionFixture());
  const intelligence = synthesizePdfDocumentIntelligence({
    sourceDocumentId: expectations.sourceId,
    filename: expectations.filename,
    extractionMetadata: extraction.metadata,
    structuredRanges: extraction.structuredRanges,
  });
  const tableArtifact = intelligence.artifacts.find((artifact) => artifact.kind === "table_extraction");

  assert.ok(tableArtifact);
  assert.equal(tableArtifact.tool, "existing_parser_text_extraction");
  assert.equal(tableArtifact.payload?.toolTrace?.requestedCapability, "pdf_table_body_recovery");
  assert.equal(tableArtifact.payload?.toolTrace?.selectedTool, "existing_parser_text_extraction");
  assert.deepEqual(tableArtifact.payload?.toolTrace?.createdArtifactKeys, [tableArtifact.artifactKey]);
});

runTest("T5 page 15 records broker selection and recommended next capabilities without claiming OCR ran", () => {
  const expectations = getT5DeckExpectations();
  const extraction = buildPdfContextExtractionResult(getT5DeckPdfExtractionFixture());
  const intelligence = synthesizePdfDocumentIntelligence({
    sourceDocumentId: expectations.sourceId,
    filename: expectations.filename,
    extractionMetadata: extraction.metadata,
    structuredRanges: extraction.structuredRanges,
  });
  const task = intelligence.inspectionTasks.find((entry) => entry.taskKey === "inspect_table_candidate:15");
  const trace = task?.result?.toolTrace;

  assert.ok(task);
  assert.equal(task.tool, "pdf_table_candidate_detection");
  assert.equal(trace?.requestedCapability, "pdf_table_detection");
  assert.equal(trace?.selectedTool, "pdf_table_candidate_detection");
  assert.equal(trace?.approvalStatus, "built_in");
  assert.equal(trace?.runtimeClass, "local");
  assert.equal(trace?.sideEffectLevel, "creates_internal_artifact");
  assert.equal(trace?.benchmarkFixtureIds.includes("t5_pdf_page_15_visible_table"), true);
  assert.equal(trace?.governanceTrace?.eligibleTools.includes("pdf_table_candidate_detection"), true);
  assert.equal(trace?.recommendedNextCapabilities.includes("ocr"), true);
  assert.equal(trace?.recommendedNextCapabilities.includes("vision_page_understanding"), true);
  assert.equal(trace?.recommendedNextCapabilities.includes("document_ai_table_recovery"), true);
  assert.equal(
    trace?.traceEvents.some(
      (event) =>
        event.type === "tool_executed" &&
        (event.toolId === "ocr" ||
          event.toolId === "vision_page_understanding" ||
          event.toolId === "document_ai_table_recovery")
    ),
    false
  );
  assert.equal(trace?.executedUnapprovedTool, false);
});

runTest("unmet capability is recorded when no approved tool exists", () => {
  const broker = buildDefaultInspectionToolBroker();
  const result = broker.invoke(makeInvocation({
    invocationId: "doc-1:document_ai_table_recovery:15",
    requestedCapability: "document_ai_table_recovery",
    purpose: "Recover table body using document AI.",
    recommendedNextCapabilities: ["ocr", "vision_page_understanding"],
  }));

  assert.equal(result.status, "unmet");
  assert.equal(result.selectedTool, null);
  assert.equal(result.unmetCapability?.capability, "document_ai_table_recovery");
  assert.equal(result.unmetCapability?.recordedForAdminReview, true);
  assert.equal(result.unmetCapability?.executedUnapprovedTool, false);
  assert.equal(result.traceEvents.some((event) => event.type === "unmet_capability_recorded"), true);
});

runTest("recommended unapproved tools are visible but never executed under default policy", () => {
  let executed = false;
  const registry = new InspectionToolRegistry().register({
    id: "recommended_ocr_service",
    label: "Recommended OCR service",
    description: "A future OCR service proposal that is not approved for runtime execution.",
    capabilities: ["ocr"],
    sourceTypes: ["pdf"],
    approvalStatus: "proposed",
    runtimeClass: "external_api",
    executionBoundary: "external_api",
    dataPolicy: {
      allowedDataClasses: ["public", "internal"],
      tenantScoped: true,
      leavesTenantBoundary: true,
      storesExternalCopy: false,
    },
    sideEffectLevel: "read_only",
    permissionRequirement: makePermissionRequirement(),
    costEstimate: makeCostEstimate(),
    latencyClass: "async_preferred",
    fallbackPolicy: {
      fallbackCapabilities: ["vision_page_understanding"],
      recommendWhenConfidenceBelow: 0.8,
      fallbackRecommendation: "Request admin approval before using this OCR service.",
    },
    reliability: 0.9,
    reusableResult: true,
    artifactContract: "table_extraction",
    artifactContracts: ["table_extraction"],
    benchmarkFixtureIds: ["unapproved_tool_recommendation"],
    toolCard: {
      id: "recommended_ocr_service",
      label: "Recommended OCR service",
      description: "A future OCR service proposal that is not approved for runtime execution.",
      capabilities: ["ocr"],
      sourceTypes: ["pdf"],
      approvalStatus: "proposed",
      runtimeClass: "external_api",
      executionBoundary: "external_api",
      dataPolicy: {
        allowedDataClasses: ["public", "internal"],
        tenantScoped: true,
        leavesTenantBoundary: true,
        storesExternalCopy: false,
      },
      sideEffectLevel: "read_only",
      permissionRequirement: makePermissionRequirement(),
      costEstimate: makeCostEstimate(),
      latencyClass: "async_preferred",
      artifactContracts: ["table_extraction"],
      benchmarkFixtureIds: ["unapproved_tool_recommendation"],
      fallbackPolicy: {
        fallbackCapabilities: ["vision_page_understanding"],
        recommendWhenConfidenceBelow: 0.8,
        fallbackRecommendation: "Request admin approval before using this OCR service.",
      },
      reliability: 0.9,
      reusableResult: true,
      limitations: ["Unapproved recommendation only."],
      selectionPriority: 1,
    },
    limitations: ["Unapproved recommendation only."],
    selectionPriority: 1,
    execute: ({ invocation, tool }) => {
      executed = true;
      return buildCompletedToolResult({
        invocation,
        tool,
        confidence: 0.9,
        summary: "This should not execute under the default policy.",
      });
    },
  });
  const broker = new InspectionToolBroker(registry);
  const result = broker.invoke(makeInvocation({
    invocationId: "doc-1:ocr:15",
    requestedCapability: "ocr",
    purpose: "Try OCR for a sparse page.",
  }));

  assert.equal(executed, false);
  assert.equal(result.status, "unmet");
  assert.equal(result.rejectedToolIds.includes("recommended_ocr_service"), true);
  assert.equal(result.unmetCapability?.executedUnapprovedTool, false);
  assert.equal(result.unmetCapabilityReviewItem?.executedUnapprovedTool, false);
});

let passed = 0;

for (const test of tests) {
  try {
    await test.fn();
    passed += 1;
    console.log(`ok - ${test.name}`);
  } catch (error) {
    console.error(`not ok - ${test.name}`);
    console.error(error);
    process.exitCode = 1;
    break;
  }
}

if (!process.exitCode) {
  console.log(`${passed} inspection-tool-broker test(s) passed.`);
}
