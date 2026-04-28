import assert from "node:assert/strict";
import path from "node:path";
import { fileURLToPath } from "node:url";
import createJiti from "jiti";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const jiti = createJiti(import.meta.url, { moduleCache: false });
const {
  DEFAULT_MODEL_CAPABILITY_MANIFEST,
  DEFAULT_TOOL_OUTPUT_MANIFESTS,
  buildContextPayloadsFromArtifactPromotionCandidates,
  buildContextPayloadsFromArtifactPromotionDecisions,
  buildContextPayloadsFromAsyncAgentWork,
  buildContextPayloadsFromCapabilityGapRecords,
  buildContextPayloadsFromContextDebtRecords,
  buildContextPayloadsFromKnowledgeArtifacts,
  buildContextPayloadsFromSourceCoverageRecords,
  buildContextPayloadsFromSourceObservations,
  buildDefaultContextPayloadRegistry,
  planAdaptiveContextTransport,
} = jiti(path.join(__dirname, "..", "src", "lib", "adaptive-context-transport.ts"));
const { buildAgentWorkPlanFromControlDecision, evaluateAgentControlSurface } = jiti(
  path.join(__dirname, "..", "src", "lib", "agent-control-surface.ts")
);
const { assembleProgressiveContext } = jiti(
  path.join(__dirname, "..", "src", "lib", "progressive-context-assembly.ts")
);
const { buildConversationContextDebugTrace } = jiti(
  path.join(__dirname, "..", "src", "lib", "context-debug-trace.ts")
);
const { materializeDocumentKnowledgeArtifactRecord } = jiti(
  path.join(__dirname, "..", "src", "lib", "document-intelligence.ts")
);
const { resolveCatalogForAdaptiveContextTransport } = jiti(
  path.join(__dirname, "..", "src", "lib", "context-catalog-bootstrap.ts")
);

const tests = [];

function runTest(name, fn) {
  tests.push({ name, fn });
}

function makeDecision(overrides = {}) {
  const decision = evaluateAgentControlSurface({
    conversationId: overrides.conversationId ?? "conv-a04h",
    request: overrides.request ?? "What does the page 15 Smackover Water Chemistry table say?",
    sourceSignals: overrides.sourceSignals ?? [],
    policy: overrides.policy,
  });

  return {
    ...decision,
    ...(overrides.patch ?? {}),
    contextBudgetRequest: {
      ...decision.contextBudgetRequest,
      ...(overrides.patch?.contextBudgetRequest ?? {}),
    },
    outputBudgetRequest: {
      ...decision.outputBudgetRequest,
      ...(overrides.patch?.outputBudgetRequest ?? {}),
    },
    toolBudgetRequest: {
      ...decision.toolBudgetRequest,
      ...(overrides.patch?.toolBudgetRequest ?? {}),
    },
  };
}

function makeArtifact(overrides = {}) {
  return materializeDocumentKnowledgeArtifactRecord({
    id: overrides.id ?? "artifact-page-15",
    sourceDocumentId: overrides.sourceDocumentId ?? "doc-t5",
    artifactKey: overrides.artifactKey ?? "table_candidate:15",
    kind: overrides.kind ?? "table_candidate",
    status: overrides.status ?? "warning",
    title: overrides.title ?? "Page 15 unresolved table memory",
    summary: overrides.summary ?? "Page 15 appears to contain a table titled Smackover Water Chemistry.",
    content:
      overrides.content ??
      "Likely true data table detected on page 15. The current parser did not recover a structured table body. Do not infer missing columns, cell values, or headers.",
    tool: overrides.tool ?? "pdf_table_candidate_detection",
    confidence: overrides.confidence ?? 0.7,
    location: overrides.location ?? {
      pageNumberStart: 15,
      pageNumberEnd: 15,
      pageLabelStart: "15",
      pageLabelEnd: "15",
      tableId: "page-15-table",
      figureId: null,
      sectionPath: ["Smackover Water Chemistry"],
      headingPath: ["Smackover Water Chemistry"],
    },
    sourceLocationLabel: overrides.sourceLocationLabel ?? "T5 Summary Deck V1.7ext.pdf - page 15",
    payload: overrides.payload ?? {
      unresolved: true,
      noUnavailableToolExecutionClaimed: true,
    },
    relevanceHints: overrides.relevanceHints ?? ["page 15", "table", "Smackover Water Chemistry"],
    createdAt: "2026-04-27T00:00:00.000Z",
    updatedAt: "2026-04-27T00:00:00.000Z",
  });
}

function makeSourceObservation(overrides = {}) {
  return {
    id: overrides.id ?? "obs-page-15-title",
    type: overrides.type ?? "parser_text_excerpt",
    sourceDocumentId: overrides.sourceDocumentId ?? "doc-t5",
    sourceVersion: overrides.sourceVersion ?? null,
    sourceLocator: overrides.sourceLocator ?? {
      pageNumberStart: 15,
      pageNumberEnd: 15,
      pageLabelStart: "15",
      pageLabelEnd: "15",
      tableId: null,
      figureId: null,
      sectionPath: ["Smackover Water Chemistry"],
      headingPath: ["Smackover Water Chemistry"],
      sourceLocationLabel: "T5 Summary Deck V1.7ext.pdf - page 15",
      charStart: 0,
      charEnd: 28,
    },
    content: overrides.content ?? "Smackover Water Chemistry",
    payload: overrides.payload ?? { chunkIndex: 15, parserSignal: true },
    extractionMethod: overrides.extractionMethod ?? "parser_pdf_text_extraction",
    confidence: overrides.confidence ?? 0.68,
    limitations:
      overrides.limitations ??
      ["Parser text observation may not contain structured table rows, columns, or cells."],
  };
}

function makeDebtRecord(overrides = {}) {
  return {
    id: overrides.id ?? "debt-page-15",
    debtKey: overrides.debtKey ?? "debt:doc-t5:page-15:missing-table-body",
    workspaceId: null,
    conversationId: overrides.conversationId ?? "conv-a04h",
    conversationDocumentId: overrides.conversationDocumentId ?? "doc-t5",
    asyncAgentWorkItemId: null,
    artifactKey: overrides.artifactKey ?? "table_candidate:15",
    sourceId: overrides.sourceId ?? "doc-t5",
    kind: overrides.kind ?? "missing_table_body",
    status: overrides.status ?? "open",
    severity: overrides.severity ?? "high",
    sourceScope: overrides.sourceScope ?? "table",
    sourceLocator: overrides.sourceLocator ?? { pageNumber: 15, tableId: "page-15-table" },
    title: overrides.title ?? "Missing page 15 table body",
    description:
      overrides.description ??
      "The durable memory knows page 15 has a likely table, but the table body is not recovered.",
    whyItMatters: overrides.whyItMatters ?? "A faithful answer cannot invent the missing chemistry table cells.",
    resolutionPath: overrides.resolutionPath ?? "document_ai_needed",
    resolutionPaths: overrides.resolutionPaths ?? [
      "rendered_page_inspection_needed",
      "ocr_needed",
      "vision_needed",
      "document_ai_needed",
    ],
    deferredCapabilities: overrides.deferredCapabilities ?? [
      "rendered_page_inspection",
      "ocr",
      "vision_page_understanding",
      "document_ai_table_recovery",
    ],
    requiredApprovalReasons: [],
    policyBlockers: [],
    sourceCoverageTarget: { target: "all_tables", detail: "Page 15 table body needed." },
    evidence: { noUnavailableToolExecutionClaimed: true },
    traceEvents: [],
    linkedArtifactKeys: ["table_candidate:15"],
    firstSeenAt: "2026-04-27T00:00:00.000Z",
    lastSeenAt: "2026-04-27T00:00:00.000Z",
    resolvedAt: null,
    createdAt: "2026-04-27T00:00:00.000Z",
    updatedAt: "2026-04-27T00:00:00.000Z",
  };
}

function makeGapRecord(overrides = {}) {
  return {
    id: overrides.id ?? "gap-page-15",
    gapKey: overrides.gapKey ?? "gap:doc-t5:rendered-page-image",
    workspaceId: null,
    conversationId: overrides.conversationId ?? "conv-a04h",
    conversationDocumentId: overrides.conversationDocumentId ?? "doc-t5",
    asyncAgentWorkItemId: null,
    relatedContextDebtId: null,
    relatedContextDebtKey: overrides.relatedContextDebtKey ?? "debt:doc-t5:page-15:missing-table-body",
    sourceId: overrides.sourceId ?? "doc-t5",
    kind: overrides.kind ?? "missing_context_lane",
    status: overrides.status ?? "detected",
    severity: overrides.severity ?? "high",
    reviewState: overrides.reviewState ?? "needs_review",
    neededCapability: overrides.neededCapability ?? "rendered_page_inspection",
    missingPayloadType: overrides.missingPayloadType ?? "rendered_page_image",
    missingToolId: null,
    missingModelCapability: null,
    missingArtifactType: null,
    missingConnector: null,
    missingApprovalPath: null,
    missingBudgetProfile: null,
    title: overrides.title ?? "Rendered page image lane missing",
    description: overrides.description ?? "No rendered page image payload can be produced in this pass.",
    whyNeeded: "The page 15 table is visual/table content.",
    currentLimitation: "A-04h represents the need but does not execute rendering.",
    recommendedResolution: "Add rendered page + vision inspection pack in a later pass.",
    resolutionPath: overrides.resolutionPath ?? "register_context_lane",
    resolutionPaths: overrides.resolutionPaths ?? ["register_context_lane", "register_tool"],
    candidateToolCategories: overrides.candidateToolCategories ?? ["local_process", "model_provider"],
    candidateModelCapabilities: overrides.candidateModelCapabilities ?? ["vision_input"],
    candidateContextLanes: overrides.candidateContextLanes ?? ["rendered_page_image", "page_crop_image"],
    requiredArtifactTypes: [],
    requiredApprovalPolicy: {},
    requiredBudgetProfile: {},
    securityConsiderations: [],
    dataEgressConsiderations: [],
    benchmarkFixtureIds: ["t5_pdf_page_15_visible_table"],
    evidence: { noUnavailableToolExecutionClaimed: true },
    traceEvents: [],
    firstSeenAt: "2026-04-27T00:00:00.000Z",
    lastSeenAt: "2026-04-27T00:00:00.000Z",
    resolvedAt: null,
    createdAt: "2026-04-27T00:00:00.000Z",
    updatedAt: "2026-04-27T00:00:00.000Z",
  };
}

function makeCoverageRecord(overrides = {}) {
  return {
    id: overrides.id ?? "coverage-page-15",
    coverageKey: overrides.coverageKey ?? "coverage:doc-t5:page-15",
    workspaceId: null,
    conversationId: overrides.conversationId ?? "conv-a04h",
    conversationDocumentId: overrides.conversationDocumentId ?? "doc-t5",
    asyncAgentWorkItemId: null,
    sourceId: overrides.sourceId ?? "doc-t5",
    sourceScope: overrides.sourceScope ?? "table",
    sourceLocator: overrides.sourceLocator ?? { pageNumber: 15, tableId: "page-15-table" },
    coverageStatus: overrides.coverageStatus ?? "inspected_with_limitations",
    coverageTarget: overrides.coverageTarget ?? {
      target: "all_tables",
      detail: "Page/table inspected with parser limitations.",
      requestedBy: "progressive_assembly",
    },
    inspectedBy: overrides.inspectedBy ?? ["existing_parser_text_extraction"],
    limitations:
      overrides.limitations ??
      ["No rendered page image, OCR, vision observation, document-AI result, or structured table was produced."],
    relatedDebtIds: ["debt-page-15"],
    selectedCandidateCount: 3,
    totalCandidateCount: 8,
    evidence: { noUnavailableToolExecutionClaimed: true },
    traceEvents: [],
    createdAt: "2026-04-27T00:00:00.000Z",
    updatedAt: "2026-04-27T00:00:00.000Z",
  };
}

function makeArtifactCandidate() {
  const observation = makeSourceObservation();
  return {
    candidateId: "source-summary:page-15-title",
    bucket: "source_summary",
    title: "Page 15 title observation",
    summary: "Parser text shows the page title.",
    payload: {
      content: "Page 15 title is Smackover Water Chemistry.",
      observationRefs: [observation.id],
      unsupportedInference: false,
    },
    metadata: {
      sourceDocumentId: observation.sourceDocumentId,
      sourceVersion: null,
      sourceLocator: observation.sourceLocator,
      observationType: observation.type,
      sourceObservationIds: [observation.id],
      extractionMethod: observation.extractionMethod,
      confidence: 0.8,
      limitations: ["Title only; table cells were not recovered."],
      reuseEligibility: "eligible",
      dataPolicy: { persistenceAllowed: true },
      supportedByObservation: true,
    },
    proposedBy: "system_seed",
    reason: "Source observation can seed durable memory.",
  };
}

function makePromotionDecision() {
  return {
    candidateId: "source-summary:page-15-title",
    accepted: true,
    validationState: "validated",
    reasons: ["Candidate accepted for durable KnowledgeArtifact persistence."],
    artifact: {
      artifactKey: "source_summary:page-15-title",
      sourceDocumentId: "doc-t5",
      kind: "source_memory",
      status: "active",
      title: "Page 15 title observation",
      summary: "Parser text shows the page title.",
      content: "Page 15 title is Smackover Water Chemistry.",
      tool: null,
      confidence: 0.8,
      location: {
        pageNumberStart: 15,
        pageNumberEnd: 15,
        pageLabelStart: "15",
        pageLabelEnd: "15",
        tableId: null,
        figureId: null,
        sectionPath: ["Smackover Water Chemistry"],
        headingPath: ["Smackover Water Chemistry"],
      },
      sourceLocationLabel: "T5 Summary Deck V1.7ext.pdf - page 15",
      payload: { artifactClass: "positive" },
      relevanceHints: ["page 15"],
    },
    trace: {
      candidateId: "source-summary:page-15-title",
      decision: "accepted",
      validationState: "validated",
      reasons: ["Candidate accepted for durable KnowledgeArtifact persistence."],
      dedupeKey: "dedupe",
    },
  };
}

function t5AvailablePayloads() {
  return [
    ...buildContextPayloadsFromKnowledgeArtifacts([makeArtifact()]),
    ...buildContextPayloadsFromSourceObservations([makeSourceObservation()]),
    ...buildContextPayloadsFromContextDebtRecords([makeDebtRecord()]),
    ...buildContextPayloadsFromCapabilityGapRecords([makeGapRecord()]),
    ...buildContextPayloadsFromSourceCoverageRecords([makeCoverageRecord()]),
  ];
}

function makeRenderedPagePayload() {
  return {
    id: "visual-payload:rendered-page-15",
    type: "rendered_page_image",
    payloadClass: "runtime",
    label: "Rendered page image: page 15",
    sourceId: "doc-t5",
    sourceType: "thread_document",
    representation: "image",
    text: null,
    data: {
      pageNumber: 15,
      artifactRef: {
        refId: "artifact:rendered-page-15",
        refType: "data_uri",
        uri: "data:image/svg+xml;utf8,%3Csvg%3E%3C%2Fsvg%3E",
        mimeType: "image/svg+xml",
      },
    },
    uri: "data:image/svg+xml;utf8,%3Csvg%3E%3C%2Fsvg%3E",
    mimeType: "image/svg+xml",
    approxTokenCount: 0,
    priority: 95,
    confidence: 1,
    available: true,
    executable: true,
    requiresApproval: false,
    provenance: {
      sourceId: "doc-t5",
      sourceType: "thread_document",
      sourceDocumentId: "doc-t5",
      location: { pageNumberStart: 15, pageNumberEnd: 15 },
      producedByToolId: "rendered_page_renderer",
      extractionMethod: "deterministic_test_renderer",
      confidence: 1,
    },
    ownership: { scope: "thread" },
    persistence: {
      artifactEligible: true,
      sourceObservationEligible: true,
      contextDebtEligible: false,
      capabilityGapEligible: false,
      alreadyPersisted: false,
      policy: "runtime_reference_only",
    },
    metadata: { noOcrExecuted: true, noDocumentAiExecuted: true },
  };
}

function makeArtifactPackingCandidate() {
  return {
    id: "doc-t5:artifact:table_candidate:15",
    kind: "artifact",
    sourceId: "doc-t5",
    sourceType: "pdf",
    label: "Page 15 unresolved table memory",
    content:
      "Likely true data table detected on page 15. The current parser did not recover a structured table body. Do not infer missing columns, cell values, or headers.",
    approxTokenCount: 42,
    priority: 90,
    confidence: 0.7,
    artifactKind: "table_candidate",
    artifactStatus: "warning",
    locationLabel: "T5 Summary Deck V1.7ext.pdf - page 15",
    provenance: { artifactKey: "table_candidate:15" },
    rankingHints: ["page 15", "Smackover Water Chemistry"],
    required: true,
    metadata: { artifactKey: "table_candidate:15" },
  };
}

function makeRawPackingCandidate() {
  return {
    id: "doc-t5:15",
    kind: "excerpt",
    sourceId: "doc-t5",
    sourceType: "pdf",
    label: "T5 Summary Deck V1.7ext.pdf - page 15",
    content: "Smackover Water Chemistry",
    approxTokenCount: 6,
    priority: 25,
    confidence: null,
    locationLabel: "T5 Summary Deck V1.7ext.pdf - page 15",
    provenance: { pageNumberStart: 15 },
    rankingHints: ["page 15"],
    required: false,
    metadata: { parserSignal: true },
  };
}

function makeDebugBundle({ decision, assembly }) {
  return {
    text: "Rendered context is intentionally separate from debug payload transport.",
    sources: [],
    summarySources: [],
    sourceSelection: {
      requestMode: "default",
      consideredSourceIds: ["thread_documents"],
      defaultCandidateSourceIds: ["thread_documents"],
      explicitUserRequestedSourceIds: [],
      requestedSourceIds: ["thread_documents"],
      plannerProposedSourceIds: [],
      policyRequiredSourceIds: [],
      fallbackCandidateSourceIds: [],
      allowedSourceIds: ["thread_documents"],
      executedSourceIds: ["thread_documents"],
      excludedSourceIds: [],
    },
    sourceDecisions: [
      {
        sourceId: "thread_documents",
        label: "Thread Documents",
        request: {
          status: "requested",
          mode: "default",
          origins: ["explicit_user_request"],
          detail: "Thread document requested.",
        },
        admission: { status: "allowed" },
        execution: {
          status: "executed",
          detail: "Thread documents were evaluated.",
          summary: {
            totalCount: 1,
            usedCount: 1,
            unsupportedCount: 0,
            failedCount: 0,
            unavailableCount: 0,
            excludedCategories: [],
          },
        },
        exclusion: null,
        status: "allowed",
        reason: "allowed",
        detail: "Allowed by current policy.",
        domain: "thread_documents",
        scope: "thread",
        policyMode: "thread_active_membership",
        eligibility: {
          isRegistered: true,
          isInScope: true,
          isAvailable: true,
          isRequestingUserAllowed: true,
          isActiveAgentAllowed: true,
          isImplemented: true,
        },
      },
    ],
    documentChunking: {
      strategy: "thread-document-paragraphs-v1",
      budget: {
        budgetInputProvided: false,
        mode: null,
        modelProfileId: null,
        provider: null,
        protocol: null,
        model: null,
        documentContextBudgetTokens: null,
        fallbackProfileUsed: null,
        selectedChunkTokenTotal: 0,
        skippedDueToBudgetCount: 0,
        detail: "Legacy-equivalent fallback budget.",
      },
      occurrence: null,
      documents: [],
    },
    documentIntelligence: {
      selectedArtifactKeys: [],
      selectedApproxTokenCount: 0,
      documents: [],
    },
    agentControl: decision,
    progressiveAssembly: assembly,
  };
}

runTest("ContextPayloadRegistry registers payload types without freezing the lane list", () => {
  const registry = buildDefaultContextPayloadRegistry();
  assert.equal(registry.has("text_excerpt"), true);
  assert.equal(registry.has("rendered_page_image"), true);
  assert.equal(registry.get("rendered_page_image").executableNow, false);

  registry.register({
    type: "custom_future_payload",
    label: "Custom future payload",
    description: "A dynamically registered payload type.",
    status: "proposed",
    textLike: false,
    executableNow: false,
    defaultRepresentation: "json",
    supportedRepresentations: ["json"],
    defaultBoundary: "future_tool_boundary",
    artifactPolicy: {
      mode: "not_artifact",
      artifactKinds: [],
      persistenceContract: "debug_only",
    },
    observationPolicy: {
      mode: "not_observation",
      observationTypes: [],
      persistenceContract: "debug_only",
    },
    compactionPolicy: {
      strategy: "metadata_only",
      detail: "Custom payload is metadata-only for now.",
    },
  });

  assert.equal(registry.has("custom_future_payload"), true);
  assert.equal(registry.list().some((definition) => definition.type === "custom_future_payload"), true);
});

runTest("Existing source memory structures adapt into context payloads", () => {
  const sourceObservationPayloads = buildContextPayloadsFromSourceObservations([makeSourceObservation()]);
  assert.deepEqual(
    sourceObservationPayloads.map((payload) => payload.type).sort(),
    ["source_observation", "text_excerpt"]
  );
  const sourceObservationTransport = planAdaptiveContextTransport({
    request: "Use a source observation.",
    availablePayloads: sourceObservationPayloads,
    requestedPayloads: [
      {
        id: "need:source-observation",
        payloadType: "source_observation",
        required: false,
        reason: "Source observation should be summarized in transport debug.",
      },
    ],
  });
  assert.equal(
    sourceObservationTransport.debugSnapshot.sourceObservationSummary?.availablePayloadCount,
    1
  );
  assert.equal(
    sourceObservationTransport.debugSnapshot.sourceObservationSummary?.selectedObservationIds.includes("obs-page-15-title"),
    true
  );

  assert.equal(buildContextPayloadsFromKnowledgeArtifacts([makeArtifact()])[0].type, "knowledge_artifact");
  assert.equal(buildContextPayloadsFromContextDebtRecords([makeDebtRecord()])[0].type, "context_debt");
  assert.equal(buildContextPayloadsFromCapabilityGapRecords([makeGapRecord()])[0].type, "capability_gap");
  assert.equal(buildContextPayloadsFromSourceCoverageRecords([makeCoverageRecord()])[0].type, "source_coverage");

  const asyncPayload = planAdaptiveContextTransport({
    request: "Summarize async work.",
    availablePayloads: [
      ...buildContextPayloadsFromAsyncAgentWork([
        {
          workItemId: "work-a04h",
          status: "planned",
          type: "highest_fidelity_ingestion",
          limitations: ["Deferred unavailable visual tooling."],
        },
      ]),
    ],
    requestedPayloads: [
      {
        id: "need:async",
        payloadType: "async_work_summary",
        required: false,
        reason: "Async work can produce summary payloads.",
      },
    ],
  });
  assert.equal(asyncPayload.selectedPayloads[0].type, "async_work_summary");

  const promotionPayloads = [
    ...buildContextPayloadsFromArtifactPromotionCandidates([makeArtifactCandidate()]),
    ...buildContextPayloadsFromArtifactPromotionDecisions([makePromotionDecision()]),
  ];
  assert.deepEqual(
    promotionPayloads.map((payload) => payload.type).sort(),
    ["artifact_promotion_candidate", "artifact_promotion_result"]
  );
});

runTest("Model and tool manifests govern payload negotiation", () => {
  assert.equal(
    DEFAULT_TOOL_OUTPUT_MANIFESTS.some((manifest) =>
      manifest.toolId === "parser_text_extraction" &&
      manifest.producedPayloadTypes.includes("text_excerpt") &&
      manifest.producedPayloadTypes.includes("source_observation")
    ),
    true
  );

  const modelManifest = {
    ...DEFAULT_MODEL_CAPABILITY_MANIFEST,
    manifestId: "model:artifact-only",
    modelId: "artifact-only",
    acceptedPayloadTypes: ["knowledge_artifact"],
    preferredRepresentations: ["text"],
  };
  const result = planAdaptiveContextTransport({
    request: "Use artifacts only.",
    modelManifest,
    availablePayloads: [
      ...buildContextPayloadsFromKnowledgeArtifacts([makeArtifact()]),
      ...buildContextPayloadsFromSourceObservations([makeSourceObservation()]),
    ],
    requestedPayloads: [
      {
        id: "need:artifact",
        payloadType: "knowledge_artifact",
        required: false,
        reason: "Artifact reuse requested.",
      },
      {
        id: "need:source-observation",
        payloadType: "source_observation",
        required: false,
        reason: "Source observation requested.",
      },
    ],
  });

  assert.equal(result.selectedPayloads.some((payload) => payload.type === "knowledge_artifact"), true);
  assert.equal(result.excludedPayloads.some((excluded) => excluded.reason === "model_payload_unsupported"), true);
});

runTest("AgentWorkPlan capability needs drive scoped transport without execution claims", () => {
  const request = "Recover the page 15 table with OCR and vision.";
  const sourceSignals = [
    {
      sourceId: "doc-t5",
      sourceType: "pdf",
      filename: "t5.pdf",
      hasWeakArtifact: true,
      hasStaleArtifact: false,
      artifactKinds: ["table_candidate"],
      warningArtifactKinds: ["extraction_warning"],
      recommendedNextCapabilities: ["ocr", "vision_page_understanding"],
      unmetCapabilities: [],
      sourceCoverageHints: ["all_tables"],
      dataClass: "internal",
      containsUntrustedInstructions: false,
      detail: null,
    },
  ];
  const decision = makeDecision({
    request,
    sourceSignals,
  });
  const agentWorkPlan = buildAgentWorkPlanFromControlDecision({
    conversationId: "conv-a04h",
    request,
    decision,
    sourceSignals,
  });
  const result = planAdaptiveContextTransport({
    request,
    agentControl: decision,
    agentWorkPlan,
    availablePayloads: t5AvailablePayloads(),
  });

  assert.equal(result.plan.agentWorkPlanId, agentWorkPlan.planId);
  assert.equal(result.plan.agentWorkPlanTraceId, agentWorkPlan.traceId);
  assert.equal(result.debugSnapshot.agentWorkPlanId, agentWorkPlan.planId);
  assert.equal(result.plan.budget.budgetMode, agentWorkPlan.budget.mode);
  assert.equal(result.plan.requestedPayloads.some((payload) => payload.payloadType === "ocr_text"), true);
  assert.equal(result.plan.requestedPayloads.some((payload) => payload.payloadType === "vision_observation"), true);
  assert.equal(result.missingPayloadCapabilities.some((missing) => missing.payloadType === "ocr_text"), true);
  assert.equal(result.selectedPayloads.some((payload) => payload.type === "ocr_text"), false);
  assert.equal(result.noUnavailableToolExecutionClaimed, true);
});

runTest("T5 page 15 transport selects current memory and records missing rich payloads", () => {
  const result = planAdaptiveContextTransport({
    request: "What does page 15 Smackover Water Chemistry table say?",
    agentControl: makeDecision(),
    availablePayloads: t5AvailablePayloads(),
  });
  const selectedTypes = new Set(result.selectedPayloads.map((payload) => payload.type));
  for (const payloadType of [
    "knowledge_artifact",
    "text_excerpt",
    "source_observation",
    "context_debt",
    "capability_gap",
    "source_coverage",
  ]) {
    assert.equal(selectedTypes.has(payloadType), true, `${payloadType} should be selected`);
  }

  const missingTypes = new Set(result.missingPayloadCapabilities.map((missing) => missing.payloadType));
  for (const payloadType of [
    "rendered_page_image",
    "page_crop_image",
    "vision_observation",
    "ocr_text",
    "document_ai_result",
    "structured_table",
  ]) {
    assert.equal(missingTypes.has(payloadType), true, `${payloadType} should be missing`);
  }

  assert.equal(result.noUnavailableToolExecutionClaimed, true);
  assert.equal(result.selectedPayloads.some((payload) => /rendered|ocr|vision|document_ai/.test(payload.type)), false);
  assert.equal(
    result.missingContextLaneProposals.some((proposal) => proposal.missingPayloadType === "rendered_page_image"),
    true
  );
  assert.equal(
    result.debugSnapshot.excludedPayloads.some((excluded) => excluded.reason === "execution_not_available"),
    true
  );
});

runTest("Text-like payloads route through A-03 while A-03 remains one lane", () => {
  const result = planAdaptiveContextTransport({
    request: "Summarize source observations.",
    agentControl: makeDecision({
      patch: {
        contextBudgetRequest: { grantedTokens: 80 },
      },
    }),
    availablePayloads: t5AvailablePayloads(),
    requestedPayloads: [
      {
        id: "need:text",
        payloadType: "text_excerpt",
        required: false,
        reason: "Text lane should pack excerpts.",
      },
      {
        id: "need:image",
        payloadType: "rendered_page_image",
        required: false,
        reason: "Image lane should remain unavailable.",
      },
    ],
  });

  assert.equal(result.plan.relationshipToA03.a03IsTextPackingLane, true);
  assert.equal(result.plan.steps.some((step) => step.kind === "route_text_payloads_to_a03"), true);
  assert.equal(result.a03PackingResults.length > 0, true);
  assert.equal(result.missingContextLaneProposals.some((proposal) => proposal.missingPayloadType === "rendered_page_image"), true);
});

runTest("Highest-fidelity ingestion identifies unavailable rich payload needs", () => {
  const decision = makeDecision({
    request: "Ingest this document at the highest level.",
    patch: {
      taskFidelityLevel: "highest_fidelity_ingestion",
      runtimeBudgetProfile: "high_fidelity_ingestion",
      sourceCoverageTarget: "full_document",
      asyncRecommended: true,
    },
  });
  const result = planAdaptiveContextTransport({
    request: "Ingest this document at the highest level.",
    agentControl: decision,
    availablePayloads: [
      ...buildContextPayloadsFromSourceObservations([makeSourceObservation()]),
      ...buildContextPayloadsFromKnowledgeArtifacts([makeArtifact()]),
    ],
  });

  assert.equal(result.selectedPayloads.some((payload) => payload.type === "source_observation"), true);
  assert.equal(result.selectedPayloads.some((payload) => payload.type === "knowledge_artifact"), true);
  assert.equal(result.missingPayloadCapabilities.some((missing) => missing.payloadType === "rendered_page_image"), true);
  assert.equal(result.missingPayloadCapabilities.some((missing) => missing.payloadType === "document_ai_result"), true);
  assert.equal(result.selectedPayloads.some((payload) => payload.type === "document_ai_result"), false);
});

runTest("Highest-fidelity creation represents planning and validation needs without implementing creation", () => {
  const decision = makeDecision({
    request: "Create the best possible report from this source.",
    patch: {
      taskFidelityLevel: "highest_fidelity_creation",
      runtimeBudgetProfile: "high_fidelity_creation",
      creationDepth: "deliverable_grade",
      validationDepth: "claim_check",
      asyncRecommended: true,
    },
  });
  const result = planAdaptiveContextTransport({
    request: "Create the best possible report from this source.",
    agentControl: decision,
    availablePayloads: [
      ...buildContextPayloadsFromKnowledgeArtifacts([makeArtifact({ kind: "source_memory", status: "active" })]),
      ...buildContextPayloadsFromContextDebtRecords([makeDebtRecord()]),
      ...buildContextPayloadsFromCapabilityGapRecords([makeGapRecord()]),
    ],
  });

  assert.equal(result.selectedPayloads.some((payload) => payload.type === "knowledge_artifact"), true);
  assert.equal(result.selectedPayloads.some((payload) => payload.type === "context_debt"), true);
  assert.equal(result.missingPayloadCapabilities.some((missing) => missing.payloadType === "creation_plan"), true);
  assert.equal(result.missingPayloadCapabilities.some((missing) => missing.payloadType === "validation_result"), true);
  assert.equal(result.selectedPayloads.some((payload) => payload.type === "creation_plan"), false);
});

runTest("Progressive assembly exposes adaptive transport debug without changing A-03 results", () => {
  const decision = makeDecision();
  const assembly = assembleProgressiveContext({
    request: "What does page 15 Smackover Water Chemistry table say?",
    agentControl: decision,
    artifactCandidates: [makeArtifactPackingCandidate()],
    rawExcerptCandidates: [makeRawPackingCandidate()],
    transportPayloads: [
      ...buildContextPayloadsFromSourceObservations([makeSourceObservation()]),
      ...buildContextPayloadsFromContextDebtRecords([makeDebtRecord()]),
      ...buildContextPayloadsFromCapabilityGapRecords([makeGapRecord()]),
      ...buildContextPayloadsFromSourceCoverageRecords([makeCoverageRecord()]),
    ],
  });

  assert.equal(assembly.packingResults.length > 0, true);
  assert.equal(assembly.expandedContextBundle.selectedCandidates.length > 0, true);
  assert.equal(assembly.contextTransport.plan.relationshipToA03.a03IsTextPackingLane, true);
  assert.equal(assembly.contextTransport.debugSnapshot.noUnavailableToolExecutionClaimed, true);
  assert.equal(
    assembly.contextTransport.missingPayloadCapabilities.some((missing) => missing.payloadType === "ocr_text"),
    true
  );
});

runTest("A-04h selects rendered-page payloads only when produced and visual model support is available", () => {
  const decision = makeDecision({
    request: "Inspect page 15 visually.",
    patch: {
      taskFidelityLevel: "deep_inspection",
      runtimeBudgetProfile: "deep_inspection",
    },
  });
  const catalogResolution = resolveCatalogForAdaptiveContextTransport({
    request: "Inspect page 15 visually.",
    agentControl: decision,
    modelProfileId: "deterministic_vision_model_profile",
    runtimeSupport: {
      renderedPageRenderer: {
        implementationAvailable: true,
        implementationId: "deterministic_test_renderer",
        cropRenderingAvailable: true,
      },
      visionModelInspector: {
        adapterAvailable: true,
        adapterId: "deterministic_vision_adapter",
        modelProfileId: "deterministic_vision_model_profile",
        modelId: "deterministic-vision-model",
        provider: "test_fixture_provider",
        maxImageInputs: 2,
        supportsStructuredOutput: true,
        requiresApproval: false,
        dataEgressClass: "none",
      },
    },
  });
  const result = planAdaptiveContextTransport({
    request: "Inspect page 15 visually.",
    agentControl: decision,
    catalogResolution,
    availablePayloads: [makeRenderedPagePayload()],
    requestedPayloads: [
      {
        id: "need:rendered",
        payloadType: "rendered_page_image",
        required: false,
        reason: "Rendered page payload was actually produced by A-04j.",
        acceptedRepresentations: ["image"],
      },
      {
        id: "need:vision",
        payloadType: "vision_observation",
        required: false,
        reason: "Vision observation should not be selected unless actually produced.",
        acceptedRepresentations: ["summary_text", "json"],
      },
    ],
  });

  assert.equal(result.selectedPayloads.some((payload) => payload.type === "rendered_page_image"), true);
  assert.equal(result.selectedPayloads.some((payload) => payload.type === "vision_observation"), false);
  assert.equal(result.missingPayloadCapabilities.some((missing) => missing.payloadType === "vision_observation"), true);
});

runTest("Context debug trace exposes transport snapshot and keeps rendered text private", () => {
  const decision = makeDecision();
  const assembly = assembleProgressiveContext({
    request: "What does page 15 Smackover Water Chemistry table say?",
    agentControl: decision,
    artifactCandidates: [makeArtifactPackingCandidate()],
    rawExcerptCandidates: [makeRawPackingCandidate()],
    transportPayloads: [
      ...buildContextPayloadsFromSourceObservations([makeSourceObservation()]),
      ...buildContextPayloadsFromContextDebtRecords([makeDebtRecord()]),
      ...buildContextPayloadsFromCapabilityGapRecords([makeGapRecord()]),
      ...buildContextPayloadsFromSourceCoverageRecords([makeCoverageRecord()]),
    ],
  });
  const trace = buildConversationContextDebugTrace({
    conversationId: "conv-a04h",
    authority: {
      requestingUserId: "user-1",
      activeUserIds: ["user-1"],
      activeAgentId: "agent-1",
      activeAgentIds: ["agent-1"],
    },
    currentUserPrompt: "What does page 15 Smackover Water Chemistry table say?",
    bundle: makeDebugBundle({ decision, assembly }),
  });

  assert.equal(Boolean(trace.assembly.transport), true);
  assert.equal(trace.assembly.transport.noUnavailableToolExecutionClaimed, true);
  assert.equal(trace.assembly.transport.missingPayloadCapabilities.some((missing) => missing.payloadType === "ocr_text"), true);
  assert.equal(trace.renderedContext.text, null);
  assert.equal(trace.renderedContext.safeTextPreview, null);
});

runTest("Unavailable OCR vision rendered and document-AI payloads are never executed in A-04h", () => {
  const result = planAdaptiveContextTransport({
    request: "Recover the page 15 visible table with OCR and vision.",
    agentControl: makeDecision(),
    availablePayloads: t5AvailablePayloads(),
  });

  const unavailableTypes = new Set([
    "rendered_page_image",
    "page_crop_image",
    "ocr_text",
    "vision_observation",
    "document_ai_result",
  ]);
  assert.equal(result.selectedPayloads.some((payload) => unavailableTypes.has(payload.type)), false);
  assert.equal(
    result.missingPayloadCapabilities.filter((missing) => unavailableTypes.has(missing.payloadType)).length,
    unavailableTypes.size
  );
  assert.equal(
    result.traceEvents.some((event) => event.type === "payload_selected" && unavailableTypes.has(event.payloadType)),
    false
  );
  assert.equal(result.noUnavailableToolExecutionClaimed, true);
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
  console.log(`All ${tests.length} adaptive context transport tests passed.`);
}
