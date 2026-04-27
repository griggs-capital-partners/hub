import assert from "node:assert/strict";
import path from "node:path";
import { fileURLToPath } from "node:url";
import createJiti from "jiti";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const jiti = createJiti(import.meta.url, { moduleCache: false });
const {
  buildDefaultCatalogSnapshot,
  catalogModelEntriesToModelCapabilityManifests,
  catalogPayloadEntriesToContextPayloadTypeDefinitions,
  catalogToolEntriesToToolOutputManifests,
  resolveCatalogForAdaptiveContextTransport,
  validateCatalogSnapshot,
} = jiti(path.join(__dirname, "..", "src", "lib", "context-catalog-bootstrap.ts"));
const {
  ContextPayloadRegistry,
  DEFAULT_MODEL_CAPABILITY_MANIFEST,
  DEFAULT_TOOL_OUTPUT_MANIFESTS,
  planAdaptiveContextTransport,
} = jiti(path.join(__dirname, "..", "src", "lib", "adaptive-context-transport.ts"));
const { evaluateAgentControlSurface } = jiti(
  path.join(__dirname, "..", "src", "lib", "agent-control-surface.ts")
);

const tests = [];

function runTest(name, fn) {
  tests.push({ name, fn });
}

function makeDecision(request, patch = {}) {
  const decision = evaluateAgentControlSurface({
    conversationId: "conv-a04i",
    request,
    sourceSignals: [],
  });
  return {
    ...decision,
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
  };
}

function payloadForType(type, representation = "text") {
  return {
    id: `payload:${type}`,
    type,
    payloadClass: "source",
    label: `Payload ${type}`,
    sourceId: "source-a04i",
    sourceType: "test",
    representation,
    text: "Catalog-derived payload text.",
    data: null,
    approxTokenCount: 5,
    priority: 100,
    confidence: 1,
    available: true,
    executable: true,
    requiresApproval: false,
    provenance: {
      sourceId: "source-a04i",
      sourceType: "test",
      extractionMethod: "test_fixture",
      confidence: 1,
    },
    ownership: {
      scope: "system",
    },
    persistence: {
      artifactEligible: false,
      sourceObservationEligible: false,
      contextDebtEligible: false,
      capabilityGapEligible: false,
      alreadyPersisted: false,
      policy: "test",
    },
    metadata: {},
  };
}

function issueCodes(validation) {
  return new Set(validation.issues.map((issue) => issue.code));
}

runTest("Catalog bootstrap registers default payload representation lane model and tool entries", () => {
  const snapshot = buildDefaultCatalogSnapshot();
  const payloadTypes = new Set(snapshot.payloadEntries.map((entry) => entry.payloadType));
  const representationIds = new Set(snapshot.representationEntries.map((entry) => entry.representationId));
  const laneIds = new Set(snapshot.transportLaneEntries.map((entry) => entry.laneId));
  const modelIds = new Set(snapshot.modelEntries.map((entry) => entry.modelProfileId));
  const toolIds = new Set(snapshot.toolEntries.map((entry) => entry.toolId));

  for (const payloadType of [
    "text_excerpt",
    "knowledge_artifact",
    "source_observation",
    "context_debt",
    "capability_gap",
    "source_coverage",
    "inspection_trace",
    "async_work_summary",
    "artifact_promotion_candidate",
    "artifact_promotion_result",
    "structured_table",
    "rendered_page_image",
    "page_crop_image",
    "native_file_reference",
    "ocr_text",
    "vision_observation",
    "document_ai_result",
    "spreadsheet_range",
    "spreadsheet_formula_map",
    "tool_observation",
    "creation_plan",
    "validation_result",
  ]) {
    assert.equal(payloadTypes.has(payloadType), true, `${payloadType} should be registered`);
  }

  for (const representationId of ["text", "json", "structured", "image_ref", "file_ref", "binary_ref"]) {
    assert.equal(representationIds.has(representationId), true, `${representationId} should be registered`);
  }

  assert.equal(laneIds.has("a03_text_packing_lane"), true);
  assert.equal(laneIds.has("rendered_page_image_lane"), true);
  assert.equal(modelIds.has("text_only_context_model_profile"), true);
  assert.equal(modelIds.has("future_vision_model_profile"), true);
  assert.equal(modelIds.has("future_native_file_model_profile"), true);
  assert.equal(toolIds.has("parser_text_extraction"), true);
  assert.equal(toolIds.has("rendered_page_renderer"), true);
  assert.equal(toolIds.has("creation_pipeline"), true);
});

runTest("Payload tool and model entries distinguish available proposed unsupported and unavailable states", () => {
  const snapshot = buildDefaultCatalogSnapshot();
  const payload = (payloadType) => snapshot.payloadEntries.find((entry) => entry.payloadType === payloadType);
  const tool = (toolId) => snapshot.toolEntries.find((entry) => entry.toolId === toolId);
  const model = (modelProfileId) => snapshot.modelEntries.find((entry) => entry.modelProfileId === modelProfileId);

  assert.equal(payload("text_excerpt").availabilityStatus, "available");
  assert.equal(payload("structured_table").availabilityStatus, "proposed");
  assert.equal(payload("rendered_page_image").availabilityStatus, "unsupported");
  assert.equal(payload("page_crop_image").availabilityStatus, "unavailable_missing_tool_implementation");
  assert.equal(payload("native_file_reference").availabilityStatus, "unavailable_missing_connector");
  assert.equal(payload("vision_observation").availabilityStatus, "unavailable_missing_model_support");

  assert.equal(tool("parser_text_extraction").availabilityStatus, "available_read_only");
  assert.equal(tool("parser_text_extraction").isExecutable, true);
  assert.equal(tool("rendered_page_renderer").availabilityStatus, "proposed");
  assert.equal(tool("rendered_page_renderer").isExecutable, false);
  assert.equal(tool("sharepoint_file_connector").availabilityStatus, "unavailable_missing_connector");
  assert.equal(tool("sharepoint_file_connector").isExecutable, false);

  assert.equal(model("text_only_context_model_profile").availabilityStatus, "available");
  assert.equal(model("text_only_context_model_profile").supportsVision, false);
  assert.equal(model("future_vision_model_profile").availabilityStatus, "unavailable_missing_model_support");
  assert.equal(model("future_vision_model_profile").supportsVision, true);
  assert.equal(model("future_native_file_model_profile").supportsNativePdf, true);

  const resolution = resolveCatalogForAdaptiveContextTransport({
    modelProfileId: "future_vision_model_profile",
  });
  assert.equal(resolution.selectedModelManifest.consumerId, "text_only_context_model_profile");
});

runTest("Catalog validation catches duplicate and unknown registration mistakes", () => {
  const snapshot = buildDefaultCatalogSnapshot();
  const badSnapshot = {
    ...snapshot,
    payloadEntries: [
      ...snapshot.payloadEntries,
      { ...snapshot.payloadEntries[0] },
    ],
    toolEntries: [
      ...snapshot.toolEntries,
      {
        ...snapshot.toolEntries[0],
        toolId: "bad_unknown_payload_tool",
        producedPayloadTypes: ["missing_payload_type"],
      },
      {
        ...snapshot.toolEntries[0],
        toolId: "bad_available_empty_tool",
        producedPayloadTypes: [],
      },
      {
        ...snapshot.toolEntries.find((entry) => entry.toolId === "rendered_page_renderer"),
        toolId: "bad_proposed_executable_tool",
        isExecutable: true,
      },
      {
        ...snapshot.toolEntries[0],
      },
    ],
    modelEntries: [
      ...snapshot.modelEntries,
      {
        ...snapshot.modelEntries[0],
        modelProfileId: "bad_unknown_payload_model",
        acceptedPayloadTypes: ["missing_payload_type"],
      },
      {
        ...snapshot.modelEntries[0],
        modelProfileId: "bad_empty_model",
        acceptedPayloadTypes: [],
      },
      {
        ...snapshot.modelEntries[0],
      },
    ],
    transportLaneEntries: [
      ...snapshot.transportLaneEntries,
      {
        ...snapshot.transportLaneEntries[0],
        laneId: "bad_unknown_payload_lane",
        acceptedPayloadTypes: ["missing_payload_type"],
      },
    ],
  };

  const codes = issueCodes(validateCatalogSnapshot(badSnapshot));
  assert.equal(codes.has("duplicate_payload_type"), true);
  assert.equal(codes.has("duplicate_tool_id"), true);
  assert.equal(codes.has("duplicate_model_profile_id"), true);
  assert.equal(codes.has("tool_produces_unknown_payload"), true);
  assert.equal(codes.has("model_accepts_unknown_payload"), true);
  assert.equal(codes.has("lane_accepts_unknown_payload"), true);
  assert.equal(codes.has("available_tool_without_outputs"), true);
  assert.equal(codes.has("available_model_without_payloads"), true);
  assert.equal(codes.has("unavailable_tool_marked_executable"), true);
});

runTest("Catalog validation catches available payloads without producer or provenance", () => {
  const snapshot = buildDefaultCatalogSnapshot();
  const orphanPayload = {
    ...snapshot.payloadEntries[0],
    payloadType: "available_orphan_payload",
    producerToolIds: [],
    fallbackPayloadTypes: [],
    limitations: [],
    notes: [],
  };
  const missingProvenancePayload = {
    ...snapshot.payloadEntries[1],
    payloadType: "missing_provenance_payload",
    provenance: {
      ...snapshot.payloadEntries[1].provenance,
      source: {
        ...snapshot.payloadEntries[1].provenance.source,
        sourceId: "",
      },
    },
  };
  const validation = validateCatalogSnapshot({
    ...snapshot,
    payloadEntries: [...snapshot.payloadEntries, orphanPayload, missingProvenancePayload],
  });
  const codes = issueCodes(validation);
  assert.equal(codes.has("available_payload_without_producer"), true);
  assert.equal(codes.has("missing_catalog_provenance"), true);
});

runTest("Catalog generates A-04h payload registry model manifests and tool manifests", () => {
  const snapshot = buildDefaultCatalogSnapshot();
  const definitions = catalogPayloadEntriesToContextPayloadTypeDefinitions(snapshot.payloadEntries);
  const registry = new ContextPayloadRegistry(definitions);
  const modelManifests = catalogModelEntriesToModelCapabilityManifests(snapshot.modelEntries);
  const toolManifests = catalogToolEntriesToToolOutputManifests(snapshot.toolEntries);

  assert.equal(registry.has("text_excerpt"), true);
  assert.equal(registry.get("rendered_page_image").executableNow, false);
  assert.equal(modelManifests.some((manifest) => manifest.consumerId === "text_only_context_model_profile"), true);
  assert.equal(modelManifests.some((manifest) => manifest.consumerId === "future_vision_model_profile" && manifest.supportsVision), true);
  assert.equal(toolManifests.some((manifest) => manifest.toolId === "parser_text_extraction" && manifest.executable), true);
  assert.equal(toolManifests.some((manifest) => manifest.toolId === "ocr_extractor" && !manifest.executable), true);
  assert.equal(DEFAULT_MODEL_CAPABILITY_MANIFEST.consumerId, "text_only_context_model_profile");
  assert.equal(DEFAULT_TOOL_OUTPUT_MANIFESTS.some((manifest) => manifest.toolId === "document_ai_table_extractor"), true);
});

runTest("A-04h transport planner uses catalog-derived manifests and preserves default behavior", () => {
  const snapshot = buildDefaultCatalogSnapshot();
  const textPayload = snapshot.payloadEntries.find((entry) => entry.payloadType === "text_excerpt");
  const parserTool = snapshot.toolEntries.find((entry) => entry.toolId === "parser_text_extraction");
  const textModel = snapshot.modelEntries.find((entry) => entry.modelProfileId === "text_only_context_model_profile");
  const a03Lane = snapshot.transportLaneEntries.find((entry) => entry.laneId === "a03_text_packing_lane");
  const customPayload = {
    ...textPayload,
    payloadType: "custom_catalog_payload",
    displayName: "Custom catalog payload",
    producerToolIds: ["custom_catalog_tool"],
  };
  const customTool = {
    ...parserTool,
    toolId: "custom_catalog_tool",
    producedPayloadTypes: ["custom_catalog_payload"],
  };
  const customModel = {
    ...textModel,
    acceptedPayloadTypes: [...textModel.acceptedPayloadTypes, "custom_catalog_payload"],
  };
  const customLane = {
    ...a03Lane,
    acceptedPayloadTypes: [...a03Lane.acceptedPayloadTypes, "custom_catalog_payload"],
  };
  const resolution = resolveCatalogForAdaptiveContextTransport({
    snapshot: {
      ...snapshot,
      payloadEntries: [...snapshot.payloadEntries, customPayload],
      toolEntries: [...snapshot.toolEntries, customTool],
      modelEntries: snapshot.modelEntries.map((entry) =>
        entry.modelProfileId === "text_only_context_model_profile" ? customModel : entry
      ),
      transportLaneEntries: snapshot.transportLaneEntries.map((entry) =>
        entry.laneId === "a03_text_packing_lane" ? customLane : entry
      ),
    },
  });
  const result = planAdaptiveContextTransport({
    request: "Use custom catalog payload.",
    catalogResolution: resolution,
    availablePayloads: [payloadForType("custom_catalog_payload")],
    requestedPayloads: [
      {
        id: "need:custom",
        payloadType: "custom_catalog_payload",
        required: false,
        reason: "Custom catalog payload should be selected through catalog-derived registry and model manifest.",
      },
    ],
  });

  assert.equal(result.selectedPayloads.some((payload) => payload.type === "custom_catalog_payload"), true);
  assert.equal(result.debugSnapshot.catalogDebugSnapshot.mappingToAdaptiveTransport.payloadDefinitionIds.includes("custom_catalog_payload"), true);
  assert.equal(result.debugSnapshot.noUnavailableToolExecutionClaimed, true);
});

runTest("A-03 is represented as one text-like lane and not the full bridge", () => {
  const snapshot = buildDefaultCatalogSnapshot();
  const a03Lanes = snapshot.transportLaneEntries.filter((entry) => entry.usesA03PackingKernel);
  assert.equal(a03Lanes.length, 1);
  assert.equal(a03Lanes[0].laneId, "a03_text_packing_lane");
  assert.equal(a03Lanes[0].acceptedPayloadTypes.includes("text_excerpt"), true);
  assert.equal(a03Lanes[0].acceptedPayloadTypes.includes("rendered_page_image"), false);
  assert.equal(a03Lanes[0].executionBoundary, "a03_text_packing_kernel");
});

runTest("T5 page 15 catalog debug maps missing rendered OCR vision and document-AI payloads", () => {
  const result = planAdaptiveContextTransport({
    request: "What does page 15 Smackover Water Chemistry table say?",
  });
  const debug = result.debugSnapshot.catalogDebugSnapshot;
  const missingByType = new Map(result.missingPayloadCapabilities.map((missing) => [missing.payloadType, missing]));

  assert.equal(debug.selectedAvailableProducerToolIds.includes("parser_text_extraction"), true);
  assert.equal(debug.selectedAvailableProducerToolIds.includes("artifact_reuse"), true);
  assert.equal(debug.selectedAvailableProducerToolIds.includes("source_observation_reuse"), true);
  assert.equal(debug.selectedAvailableProducerToolIds.includes("context_debt_registry"), true);
  assert.equal(debug.selectedAvailableProducerToolIds.includes("capability_gap_registry"), true);
  assert.equal(debug.selectedAvailableProducerToolIds.includes("source_coverage_registry"), true);
  assert.equal(debug.unavailableProducerToolsByPayloadType.rendered_page_image.includes("rendered_page_renderer"), true);
  assert.equal(debug.unavailableProducerToolsByPayloadType.page_crop_image.includes("rendered_page_renderer"), true);
  assert.equal(debug.unavailableProducerToolsByPayloadType.vision_observation.includes("model_vision_inspector"), true);
  assert.equal(debug.unavailableProducerToolsByPayloadType.ocr_text.includes("ocr_extractor"), true);
  assert.equal(debug.unavailableProducerToolsByPayloadType.document_ai_result.includes("document_ai_table_extractor"), true);
  assert.equal(debug.unavailableProducerToolsByPayloadType.structured_table.includes("document_ai_table_extractor"), true);

  for (const [payloadType, toolId] of [
    ["rendered_page_image", "rendered_page_renderer"],
    ["page_crop_image", "rendered_page_renderer"],
    ["vision_observation", "model_vision_inspector"],
    ["ocr_text", "ocr_extractor"],
    ["document_ai_result", "document_ai_table_extractor"],
    ["structured_table", "document_ai_table_extractor"],
  ]) {
    assert.equal(missingByType.get(payloadType).candidateToolIds.includes(toolId), true);
  }
});

runTest("Highest-fidelity ingestion maps available and unavailable payload needs through catalog", () => {
  const decision = makeDecision("Ingest this document at the highest level.", {
    taskFidelityLevel: "highest_fidelity_ingestion",
    runtimeBudgetProfile: "high_fidelity_ingestion",
    sourceCoverageTarget: "full_document",
    asyncRecommended: true,
  });
  const resolution = resolveCatalogForAdaptiveContextTransport({
    request: "Ingest this document at the highest level.",
    agentControl: decision,
  });
  const requirementTypes = new Set(resolution.recommendedPayloadRequirements.map((requirement) => requirement.payloadType));

  for (const payloadType of [
    "source_observation",
    "text_excerpt",
    "knowledge_artifact",
    "context_debt",
    "capability_gap",
    "source_coverage",
    "rendered_page_image",
    "page_crop_image",
    "ocr_text",
    "vision_observation",
    "document_ai_result",
    "structured_table",
    "native_file_reference",
  ]) {
    assert.equal(requirementTypes.has(payloadType), true, `${payloadType} should be mapped for ingestion`);
  }

  const result = planAdaptiveContextTransport({
    request: "Ingest this document at the highest level.",
    agentControl: decision,
    catalogResolution: resolution,
  });
  assert.equal(result.missingPayloadCapabilities.some((missing) => missing.payloadType === "rendered_page_image"), true);
  assert.equal(result.selectedPayloads.some((payload) => payload.type === "rendered_page_image"), false);
});

runTest("Highest-fidelity creation maps proposed creation and validation without executing pipeline", () => {
  const decision = makeDecision("Create the best possible report from this source.", {
    taskFidelityLevel: "highest_fidelity_creation",
    runtimeBudgetProfile: "high_fidelity_creation",
    creationDepth: "deliverable_grade",
    validationDepth: "claim_check",
    asyncRecommended: true,
  });
  const resolution = resolveCatalogForAdaptiveContextTransport({
    request: "Create the best possible report from this source.",
    agentControl: decision,
  });
  const requirementTypes = new Set(resolution.recommendedPayloadRequirements.map((requirement) => requirement.payloadType));

  assert.equal(requirementTypes.has("knowledge_artifact"), true);
  assert.equal(requirementTypes.has("source_observation"), true);
  assert.equal(requirementTypes.has("context_debt"), true);
  assert.equal(requirementTypes.has("capability_gap"), true);
  assert.equal(requirementTypes.has("source_coverage"), true);
  assert.equal(requirementTypes.has("inspection_trace"), true);
  assert.equal(requirementTypes.has("creation_plan"), true);
  assert.equal(requirementTypes.has("validation_result"), true);

  const result = planAdaptiveContextTransport({
    request: "Create the best possible report from this source.",
    agentControl: decision,
    catalogResolution: resolution,
  });
  assert.equal(result.missingPayloadCapabilities.some((missing) => missing.payloadType === "creation_plan"), true);
  assert.equal(result.missingPayloadCapabilities.some((missing) => missing.payloadType === "validation_result"), true);
  assert.equal(result.selectedPayloads.some((payload) => payload.type === "creation_plan"), false);
});

runTest("Unavailable OCR vision rendering document-AI SharePoint and external APIs do not execute", () => {
  const snapshot = buildDefaultCatalogSnapshot();
  const unavailableToolIds = new Set([
    "rendered_page_renderer",
    "model_vision_inspector",
    "ocr_extractor",
    "document_ai_table_extractor",
    "sharepoint_file_connector",
    "creation_pipeline",
  ]);
  for (const tool of snapshot.toolEntries.filter((entry) => unavailableToolIds.has(entry.toolId))) {
    assert.equal(tool.isExecutable, false, `${tool.toolId} must not be executable`);
  }
  assert.equal(
    snapshot.toolEntries.some((tool) => tool.executionBoundary === "external_api" && tool.isExecutable),
    false
  );

  const result = planAdaptiveContextTransport({
    request: "Use OCR, vision, rendered pages, document AI, SharePoint, and creation pipeline.",
  });
  const unavailablePayloadTypes = new Set([
    "rendered_page_image",
    "page_crop_image",
    "ocr_text",
    "vision_observation",
    "document_ai_result",
    "native_file_reference",
    "creation_plan",
    "validation_result",
  ]);
  assert.equal(result.selectedPayloads.some((payload) => unavailablePayloadTypes.has(payload.type)), false);
  assert.equal(result.traceEvents.some((event) => event.type === "payload_selected" && unavailablePayloadTypes.has(event.payloadType)), false);
  assert.equal(result.noUnavailableToolExecutionClaimed, true);
  assert.equal(result.debugSnapshot.catalogDebugSnapshot.noUnavailableToolExecutionClaimed, true);
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
  console.log(`All ${tests.length} context catalog bootstrap tests passed.`);
}
