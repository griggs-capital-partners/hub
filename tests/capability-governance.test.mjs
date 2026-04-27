import assert from "node:assert/strict";
import path from "node:path";
import { fileURLToPath } from "node:url";
import createJiti from "jiti";
import {
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
const {
  CapabilityEvaluationHarness,
  getDefaultCapabilityCards,
  getDefaultToolBenchmarkFixtures,
} = jiti(path.join(__dirname, "..", "src", "lib", "capability-evaluation.ts"));

const tests = [];

function runTest(name, fn) {
  tests.push({ name, fn });
}

function makeInvocation(overrides = {}) {
  return {
    invocationId: overrides.invocationId ?? "doc-1:ocr:15",
    sourceDocumentId: overrides.sourceDocumentId ?? "doc-1",
    sourceType: overrides.sourceType ?? "pdf",
    requestedCapability: overrides.requestedCapability ?? "ocr",
    purpose: overrides.purpose ?? "Recover text from a sparse page.",
    input: overrides.input ?? { pageNumber: 15, hasExtractedText: false },
    location: overrides.location ?? { pageNumber: 15 },
    dataClass: overrides.dataClass,
    recommendedNextCapabilities: overrides.recommendedNextCapabilities,
    proposedToolPaths: overrides.proposedToolPaths,
  };
}

function makePermissionRequirement(overrides = {}) {
  return {
    requiresNetwork: overrides.requiresNetwork ?? false,
    requiresUserApproval: overrides.requiresUserApproval ?? false,
    requiresAdminApproval: overrides.requiresAdminApproval ?? false,
    readsSourceDocument: overrides.readsSourceDocument ?? true,
    writesArtifacts: overrides.writesArtifacts ?? true,
    tenantScoped: overrides.tenantScoped ?? true,
  };
}

function makeDataPolicy(overrides = {}) {
  return {
    allowedDataClasses: overrides.allowedDataClasses ?? ["public", "internal", "confidential"],
    tenantScoped: overrides.tenantScoped ?? true,
    leavesTenantBoundary: overrides.leavesTenantBoundary ?? false,
    storesExternalCopy: overrides.storesExternalCopy ?? false,
  };
}

function makeCostEstimate(overrides = {}) {
  return {
    costClass: overrides.costClass ?? "free_local",
    metered: overrides.metered ?? false,
    unitLabel: overrides.unitLabel ?? null,
    estimatedUnitCostUsd: overrides.estimatedUnitCostUsd ?? null,
  };
}

function makeFallbackPolicy(overrides = {}) {
  return {
    fallbackCapabilities: overrides.fallbackCapabilities ?? ["vision_page_understanding"],
    recommendWhenConfidenceBelow: overrides.recommendWhenConfidenceBelow ?? 0.8,
    fallbackRecommendation: overrides.fallbackRecommendation ?? "Request an approved fallback capability.",
  };
}

function makeGovernedTool(overrides = {}) {
  const id = overrides.id ?? "approved_local_ocr";
  const label = overrides.label ?? "Approved local OCR";
  const description = overrides.description ?? "Test-only governed tool.";
  const capabilities = overrides.capabilities ?? ["ocr"];
  const sourceTypes = overrides.sourceTypes ?? ["pdf"];
  const approvalStatus = overrides.approvalStatus ?? "approved";
  const runtimeClass = overrides.runtimeClass ?? "local";
  const executionBoundary = overrides.executionBoundary ?? "in_process";
  const dataPolicy = overrides.dataPolicy ?? makeDataPolicy();
  const sideEffectLevel = overrides.sideEffectLevel ?? "read_only";
  const permissionRequirement = overrides.permissionRequirement ?? makePermissionRequirement();
  const costEstimate = overrides.costEstimate ?? makeCostEstimate();
  const latencyClass = overrides.latencyClass ?? "sync_safe";
  const fallbackPolicy = overrides.fallbackPolicy ?? makeFallbackPolicy();
  const reliability = overrides.reliability ?? 0.8;
  const reusableResult = overrides.reusableResult ?? true;
  const artifactContract = overrides.artifactContract ?? "source_memory";
  const artifactContracts = overrides.artifactContracts ?? [artifactContract];
  const benchmarkFixtureIds = overrides.benchmarkFixtureIds ?? ["unapproved_tool_recommendation"];
  const limitations = overrides.limitations ?? ["Test-only tool."];
  const selectionPriority = overrides.selectionPriority ?? 10;

  const tool = {
    id,
    label,
    description,
    capabilities,
    sourceTypes,
    approvalStatus,
    runtimeClass,
    executionBoundary,
    dataPolicy,
    sideEffectLevel,
    permissionRequirement,
    costEstimate,
    latencyClass,
    fallbackPolicy,
    reliability,
    reusableResult,
    artifactContract,
    artifactContracts,
    benchmarkFixtureIds,
    toolCard: {
      id,
      label,
      description,
      capabilities,
      sourceTypes,
      approvalStatus,
      runtimeClass,
      executionBoundary,
      dataPolicy,
      sideEffectLevel,
      permissionRequirement,
      costEstimate,
      latencyClass,
      artifactContracts,
      benchmarkFixtureIds,
      fallbackPolicy,
      reliability,
      reusableResult,
      limitations,
      selectionPriority,
    },
    limitations,
    selectionPriority,
  };

  return {
    ...tool,
    execute: overrides.execute,
  };
}

runTest("tool cards expose governance metadata", () => {
  const registry = buildDefaultInspectionToolRegistry();
  const tool = registry.getTool("pdf_table_candidate_detection");

  assert.ok(tool);
  assert.equal(tool.toolCard.approvalStatus, "built_in");
  assert.equal(tool.toolCard.runtimeClass, "local");
  assert.deepEqual(tool.toolCard.dataPolicy.allowedDataClasses, ["public", "internal", "confidential"]);
  assert.equal(tool.toolCard.sideEffectLevel, "creates_internal_artifact");
  assert.equal(tool.toolCard.costEstimate.costClass, "free_local");
  assert.equal(tool.toolCard.latencyClass, "sync_safe");
});

runTest("existing built-in tools have governance metadata", () => {
  const registry = buildDefaultInspectionToolRegistry();
  const builtInIds = [
    "existing_parser_text_extraction",
    "pdf_page_classification",
    "pdf_table_candidate_detection",
    "pdf_sparse_table_warning",
    "artifact_reuse_selector",
  ];

  for (const toolId of builtInIds) {
    const tool = registry.getTool(toolId);
    assert.ok(tool, toolId);
    assert.equal(tool.approvalStatus, "built_in");
    assert.equal(tool.runtimeClass, "local");
    assert.equal(tool.costEstimate.costClass, "free_local");
    assert.equal(tool.latencyClass, "sync_safe");
    assert.ok(tool.toolCard);
  }
});

runTest("broker selects only eligible approved tools", () => {
  let proposedExecuted = false;
  let approvedExecuted = false;
  const proposedTool = makeGovernedTool({
    id: "proposed_high_priority_ocr",
    approvalStatus: "proposed",
    selectionPriority: 1,
    execute: ({ invocation, tool }) => {
      proposedExecuted = true;
      return buildCompletedToolResult({ invocation, tool, confidence: 0.9, summary: "Should not run." });
    },
  });
  const approvedTool = makeGovernedTool({
    id: "approved_local_ocr",
    approvalStatus: "approved",
    selectionPriority: 20,
    execute: ({ invocation, tool }) => {
      approvedExecuted = true;
      return buildCompletedToolResult({ invocation, tool, confidence: 0.8, summary: "Approved tool ran." });
    },
  });
  const broker = new InspectionToolBroker(new InspectionToolRegistry().registerMany([proposedTool, approvedTool]));
  const result = broker.invoke(makeInvocation());

  assert.equal(result.status, "completed");
  assert.equal(result.selectedTool?.id, "approved_local_ocr");
  assert.equal(proposedExecuted, false);
  assert.equal(approvedExecuted, true);
  assert.equal(result.ineligibleTools.some((decision) => decision.toolId === "proposed_high_priority_ocr"), true);
});

runTest("broker does not execute proposed, blocked, deprecated, or otherwise unapproved tools", () => {
  for (const approvalStatus of ["proposed", "blocked", "deprecated"]) {
    let executed = false;
    const tool = makeGovernedTool({
      id: `${approvalStatus}_ocr`,
      approvalStatus,
      execute: ({ invocation, tool }) => {
        executed = true;
        return buildCompletedToolResult({ invocation, tool, confidence: 0.9, summary: "Should not run." });
      },
    });
    const broker = new InspectionToolBroker(new InspectionToolRegistry().register(tool));
    const result = broker.invoke(makeInvocation({ invocationId: `doc-1:${approvalStatus}:ocr` }));

    assert.equal(result.status, "unmet");
    assert.equal(executed, false);
    assert.equal(result.unmetCapability?.executedUnapprovedTool, false);
    assert.equal(result.unmetCapabilityReviewItem?.executedUnapprovedTool, false);
  }
});

runTest("registered tools can be ineligible because of data, side effects, cost, latency, or permission", () => {
  const registry = new InspectionToolRegistry().registerMany([
    makeGovernedTool({
      id: "data_policy_blocked",
      dataPolicy: makeDataPolicy({ allowedDataClasses: ["public"] }),
    }),
    makeGovernedTool({
      id: "side_effect_blocked",
      sideEffectLevel: "mutates_external_source",
    }),
    makeGovernedTool({
      id: "cost_blocked",
      costEstimate: makeCostEstimate({ costClass: "high" }),
    }),
    makeGovernedTool({
      id: "latency_blocked",
      latencyClass: "async_preferred",
    }),
    makeGovernedTool({
      id: "permission_blocked",
      permissionRequirement: makePermissionRequirement({ requiresAdminApproval: true }),
    }),
  ]);
  const broker = new InspectionToolBroker(registry, {
    allowedRuntimeClasses: ["local"],
    availableRuntimeClasses: ["local"],
    allowedBoundaries: ["in_process"],
    allowedDataClasses: ["internal"],
    allowedSideEffectLevels: ["read_only"],
    maxCostClass: "low",
    maxLatencyClass: "sync_safe",
    grantedPermissions: ["read_source_document", "write_artifacts", "tenant_scope"],
  });
  const result = broker.invoke(makeInvocation({ dataClass: "internal" }));

  assert.equal(result.status, "unmet");
  assert.equal(result.ineligibleTools.length, 5);
  assert.match(result.ineligibleTools.find((decision) => decision.toolId === "data_policy_blocked").reasons.join(" "), /data policy/i);
  assert.match(result.ineligibleTools.find((decision) => decision.toolId === "side_effect_blocked").reasons.join(" "), /Side effect/i);
  assert.match(result.ineligibleTools.find((decision) => decision.toolId === "cost_blocked").reasons.join(" "), /cost class/i);
  assert.match(result.ineligibleTools.find((decision) => decision.toolId === "latency_blocked").reasons.join(" "), /latency class/i);
  assert.match(result.ineligibleTools.find((decision) => decision.toolId === "permission_blocked").reasons.join(" "), /admin_approval/i);
});

runTest("trace records eligibility reasons and unmet capability review items", () => {
  const broker = buildDefaultInspectionToolBroker();
  const result = broker.invoke(makeInvocation({
    requestedCapability: "document_ai_table_recovery",
    purpose: "Recover table body with a document AI service.",
    recommendedNextCapabilities: ["ocr", "vision_page_understanding"],
  }));

  assert.equal(result.status, "unmet");
  assert.equal(result.governanceTrace.requestedCapability, "document_ai_table_recovery");
  assert.deepEqual(result.governanceTrace.eligibleTools, []);
  assert.equal(result.unmetCapabilityReviewItem?.requestedCapability, "document_ai_table_recovery");
  assert.equal(result.unmetCapabilityReviewItem?.executedUnapprovedTool, false);
  assert.equal(result.unmetCapabilityReviewItem?.benchmarkFixtureNeeded.includes("t5_pdf_page_15_visible_table"), true);
});

runTest("T5 page 15 records governed built-in selection and no OCR or vision execution", () => {
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
  assert.equal(trace?.selectedTool, "pdf_table_candidate_detection");
  assert.equal(trace?.approvalStatus, "built_in");
  assert.equal(trace?.governanceTrace?.selectedTool, "pdf_table_candidate_detection");
  assert.equal(trace?.recommendedNextCapabilities.includes("ocr"), true);
  assert.equal(trace?.recommendedNextCapabilities.includes("vision_page_understanding"), true);
  assert.equal(
    trace?.traceEvents.some(
      (event) =>
        event.type === "tool_executed" &&
        ["ocr", "vision_page_understanding", "document_ai_table_recovery"].includes(event.toolId)
    ),
    false
  );
  assert.equal(trace?.executedUnapprovedTool, false);
});

runTest("evaluation fixture registry includes required fixture ids", () => {
  const fixtureIds = getDefaultToolBenchmarkFixtures().map((fixture) => fixture.id);

  assert.deepEqual(
    [
      "t5_pdf_page_15_visible_table",
      "scanned_pdf_text_recovery",
      "chart_heavy_deck",
      "spreadsheet_hidden_sheets_and_formulas",
      "docx_comments_redlines",
      "js_rendered_web_page",
      "code_repo_architecture_question",
      "external_tool_unavailable",
      "unapproved_tool_recommendation",
      "artifact_supersession",
    ].every((fixtureId) => fixtureIds.includes(fixtureId)),
    true
  );
});

runTest("T5 fixture is linked to PDF table candidate and warning behavior", () => {
  const registry = buildDefaultInspectionToolRegistry();
  const fixture = getDefaultToolBenchmarkFixtures().find(
    (entry) => entry.id === "t5_pdf_page_15_visible_table"
  );
  const candidateTool = registry.getTool("pdf_table_candidate_detection");
  const warningTool = registry.getTool("pdf_sparse_table_warning");
  const harness = new CapabilityEvaluationHarness();

  assert.ok(fixture);
  assert.equal(fixture.status, "active");
  assert.equal(fixture.linkedToolIds.includes("pdf_table_candidate_detection"), true);
  assert.equal(fixture.linkedToolIds.includes("pdf_sparse_table_warning"), true);
  assert.equal(candidateTool.benchmarkFixtureIds.includes("t5_pdf_page_15_visible_table"), true);
  assert.equal(warningTool.benchmarkFixtureIds.includes("t5_pdf_page_15_visible_table"), true);
  assert.equal(
    harness.evaluateToolCard(candidateTool).some((result) => result.fixtureId === fixture.id && result.status === "pass"),
    true
  );
});

runTest("capability cards describe approval fixtures and artifact contracts", () => {
  const cards = getDefaultCapabilityCards();
  const tableDetection = cards.find((card) => card.id === "pdf_table_detection");
  const ocr = cards.find((card) => card.id === "ocr");

  assert.ok(tableDetection);
  assert.equal(tableDetection.benchmarkFixtureIds.includes("t5_pdf_page_15_visible_table"), true);
  assert.equal(tableDetection.artifactKinds.includes("table_candidate"), true);
  assert.ok(ocr);
  assert.equal(ocr.requiresApprovalForExternalExecution, true);
});

runTest("artifact reuse selector remains governed and selectable without parser-specific coupling", () => {
  const broker = buildDefaultInspectionToolBroker();
  const result = broker.invoke(makeInvocation({
    invocationId: "doc-1:artifact_validation:reuse",
    sourceType: "memory",
    requestedCapability: "artifact_validation",
    purpose: "Select reusable learned artifacts for context.",
  }));

  assert.equal(result.status, "completed");
  assert.equal(result.selectedTool?.id, "artifact_reuse_selector");
  assert.equal(result.selectedTool?.toolCard.approvalStatus, "built_in");
  assert.equal(result.governanceTrace.eligibleTools.includes("artifact_reuse_selector"), true);
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
  console.log(`${passed} capability-governance test(s) passed.`);
}
