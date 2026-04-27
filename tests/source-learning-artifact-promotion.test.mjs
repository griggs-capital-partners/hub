import assert from "node:assert/strict";
import path from "node:path";
import { fileURLToPath } from "node:url";
import createJiti from "jiti";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const jiti = createJiti(import.meta.url, { moduleCache: false });
const {
  ArtifactBucketRegistry,
  buildArtifactPromotionDedupeKey,
  buildArtifactRenderClusters,
  classifyKnowledgeArtifact,
  evaluateArtifactPromotionCandidate,
  evaluateArtifactPromotionCandidates,
  isDiagnosticArtifact,
  proposeDeterministicSourceLearningCandidates,
  renderSourceMemoryBlocks,
} = jiti(path.join(__dirname, "..", "src", "lib", "source-learning-artifact-promotion.ts"));
const { materializeDocumentKnowledgeArtifactRecord } = jiti(
  path.join(__dirname, "..", "src", "lib", "document-intelligence.ts")
);

const tests = [];

function runTest(name, fn) {
  tests.push({ name, fn });
}

function makeCandidate(overrides = {}) {
  const has = (key) => Object.prototype.hasOwnProperty.call(overrides, key);
  return {
    candidateId: overrides.candidateId ?? "candidate-1",
    bucket: overrides.bucket ?? "metric_measurement",
    title: overrides.title ?? "Lundell Creek #1 lithium measurements",
    summary: overrides.summary ?? "Lithium values reported from Lundell Creek #1 brine samples.",
    payload: overrides.payload ?? {
      content: "Lundell Creek #1 reported lithium concentrations of 613-663 ppm; this is source-observed deck text, not page 15 table-cell extraction.",
      values: [
        { metric: "lithium", valueRange: "613-663", unit: "ppm", sourceText: "613-663 ppm" },
      ],
      unsupportedInference: false,
    },
    metadata: {
      sourceDocumentId: has("sourceDocumentId") ? overrides.sourceDocumentId : "doc-t5",
      sourceVersion: has("sourceVersion") ? overrides.sourceVersion : "fixture-v1",
      sourceLocator: has("sourceLocator") ? overrides.sourceLocator : {
        pageNumberStart: 8,
        pageNumberEnd: 8,
        sourceLocationLabel: "T5 Summary Deck V1.7ext.pdf - page 8",
      },
      observationType: overrides.observationType ?? "parser_text_excerpt",
      sourceObservationIds: overrides.sourceObservationIds ?? ["doc-t5:chunk:8"],
      extractionMethod: overrides.extractionMethod ?? "parser_pdf_text_extraction",
      confidence: has("confidence") ? overrides.confidence : 0.82,
      limitations: has("limitations") ? overrides.limitations : [
        "Value is promoted from extracted deck text and not from the unresolved page 15 chemistry table.",
      ],
      createdByTaskKey: overrides.createdByTaskKey ?? null,
      createdByTool: overrides.createdByTool ?? null,
      createdByModel: overrides.createdByModel ?? null,
      reuseEligibility: overrides.reuseEligibility ?? "eligible",
      dataPolicy: has("dataPolicy") ? overrides.dataPolicy : { persistenceAllowed: true },
      supportedByObservation: has("supportedByObservation") ? overrides.supportedByObservation : true,
    },
    proposedBy: overrides.proposedBy ?? "test_fixture",
    reason: overrides.reason ?? "Metric is durable source learning for future lithium/geothermal questions.",
  };
}

function makeArtifact(overrides = {}) {
  return materializeDocumentKnowledgeArtifactRecord({
    id: overrides.id ?? "artifact-1",
    sourceDocumentId: overrides.sourceDocumentId ?? "doc-t5",
    artifactKey: overrides.artifactKey ?? "table_candidate:15",
    kind: overrides.kind ?? "table_candidate",
    status: overrides.status ?? "partial",
    title: overrides.title ?? "Likely table detected on page 15",
    summary: overrides.summary ?? "Sparse water chemistry table extraction.",
    content: overrides.content ?? "Probable true data table detected on page 15. Do not infer missing columns or values.",
    tool: overrides.tool ?? "pdf_page_structure_classification",
    confidence: overrides.confidence ?? 0.45,
    location: overrides.location ?? {
      pageNumberStart: 15,
      pageNumberEnd: 15,
      pageLabelStart: null,
      pageLabelEnd: null,
      tableId: null,
      figureId: null,
      sectionPath: [],
      headingPath: [],
    },
    sourceLocationLabel:
      overrides.sourceLocationLabel ?? "T5 Summary Deck V1.7ext.pdf - page 15 - Smackover Water Chemistry",
    payload: overrides.payload ?? { reasonCodes: ["table_title_keyword"] },
    relevanceHints: overrides.relevanceHints ?? ["table", "Smackover Water Chemistry"],
    createdAt: overrides.createdAt ?? "2026-04-27T12:00:00.000Z",
    updatedAt: overrides.updatedAt ?? "2026-04-27T12:00:00.000Z",
  });
}

function makeObservation(overrides = {}) {
  const pageNumber = overrides.pageNumber ?? 12;
  return {
    id: overrides.id ?? `doc-t5:chunk:${pageNumber}`,
    type: overrides.type ?? "parser_text_excerpt",
    sourceDocumentId: overrides.sourceDocumentId ?? "doc-t5",
    sourceVersion: overrides.sourceVersion ?? "fixture-v1",
    sourceLocator: overrides.sourceLocator ?? {
      pageNumberStart: pageNumber,
      pageNumberEnd: pageNumber,
      sourceLocationLabel: overrides.sourceLocationLabel ?? `T5 Summary Deck V1.7ext.pdf - page ${pageNumber}`,
    },
    content: overrides.content ?? "Phase 1 Test Well\nLundell Creek #1 Well\nTested 613 - 663 ppm of Lithium from Smackover",
    payload: overrides.payload ?? null,
    extractionMethod: overrides.extractionMethod ?? "parser_pdf_text_extraction",
    confidence: overrides.confidence ?? 0.86,
    limitations: overrides.limitations ?? [
      "Observation is extracted text substrate and is not automatically durable source learning.",
    ],
  };
}

runTest("artifact bucket registry exposes broad positive and diagnostic buckets", () => {
  const registry = new ArtifactBucketRegistry();
  const buckets = registry.list().map((entry) => entry.bucket);
  for (const bucket of [
    "source_summary",
    "metric_measurement",
    "entity_asset",
    "relationship_linkage",
    "timeline_milestone",
    "assumption",
    "risk_issue",
    "decision_recommendation",
    "table_structured_data",
    "visual_figure_observation",
    "evidence_claim_support",
    "workflow_work_product",
    "context_debt",
    "capability_gap",
  ]) {
    assert.ok(buckets.includes(bucket), `expected bucket ${bucket}`);
  }
  assert.equal(registry.get("metric_measurement")?.artifactClass, "positive");
  assert.equal(registry.get("context_debt")?.artifactClass, "diagnostic");
});

runTest("artifact promotion candidate validation rejects missing metadata and unsupported inference", () => {
  assert.equal(
    evaluateArtifactPromotionCandidate({
      candidate: makeCandidate({ sourceDocumentId: null }),
    }).validationState,
    "rejected_missing_source"
  );
  assert.equal(
    evaluateArtifactPromotionCandidate({
      candidate: makeCandidate({ sourceLocator: {} }),
    }).validationState,
    "rejected_missing_provenance"
  );
  assert.equal(
    evaluateArtifactPromotionCandidate({
      candidate: makeCandidate({ confidence: null }),
    }).validationState,
    "rejected_missing_confidence"
  );
  assert.equal(
    evaluateArtifactPromotionCandidate({
      candidate: makeCandidate({ limitations: [] }),
    }).validationState,
    "rejected_missing_limitations"
  );
  assert.equal(
    evaluateArtifactPromotionCandidate({
      candidate: makeCandidate({
        payload: {
          content: "Page 15 table cells contain sodium and chloride values.",
          unsupportedInference: true,
        },
        supportedByObservation: false,
      }),
    }).validationState,
    "rejected_unsupported_inference"
  );
});

runTest("valid source-linked promotion candidates become positive KnowledgeArtifact inputs", () => {
  const candidates = [
    makeCandidate({ bucket: "source_summary", candidateId: "summary-1", title: "T5 Smackover development deck", payload: { content: "The T5 deck summarizes Smackover geothermal and lithium development context." } }),
    makeCandidate({ bucket: "metric_measurement", candidateId: "metric-1" }),
    makeCandidate({ bucket: "timeline_milestone", candidateId: "timeline-1", title: "Commercial production target", payload: { content: "Commercial production is shown as Q4 2026/Q1 2027 in extracted deck timeline text." } }),
    makeCandidate({ bucket: "risk_issue", candidateId: "risk-1", title: "Full brine chemistry table is missing", payload: { content: "The page 15 ionic chemistry table body is unresolved; DLE/geothermal design needs full brine chemistry." } }),
    makeCandidate({ bucket: "decision_recommendation", candidateId: "recommendation-1", title: "Obtain raw brine assay", payload: { content: "Obtain raw brine assay/lab report and DLE partner data before treating chemistry-table values as complete." } }),
  ];
  const result = evaluateArtifactPromotionCandidates({ candidates });

  assert.equal(result.acceptedArtifacts.length, candidates.length);
  assert.equal(result.debugSnapshot.acceptedCount, candidates.length);
  assert.ok(result.acceptedArtifacts.every((artifact) => artifact.payload?.artifactClass === "positive"));
  assert.ok(result.acceptedArtifacts.some((artifact) => artifact.payload?.artifactBucket === "metric_measurement"));
  assert.ok(
    result.acceptedArtifacts.every((artifact) =>
      artifact.content.includes("page 15 table-cell extraction") ? artifact.content.includes("not") : true
    )
  );
});

runTest("artifact dedupe avoids duplicate promotion from same source locator payload and bucket", () => {
  const candidate = makeCandidate();
  const accepted = evaluateArtifactPromotionCandidate({ candidate });
  assert.ok(accepted.artifact);
  const existing = makeArtifact({
    artifactKey: accepted.artifact.artifactKey,
    kind: accepted.artifact.kind,
    payload: {
      promotion: {
        dedupeKey: buildArtifactPromotionDedupeKey(candidate),
      },
    },
  });
  const duplicate = evaluateArtifactPromotionCandidate({
    candidate,
    existingArtifacts: [existing],
  });

  assert.equal(duplicate.accepted, false);
  assert.equal(duplicate.validationState, "rejected_duplicate");
});

runTest("positive and diagnostic artifacts are distinguished in metadata and rendering", () => {
  const diagnosticCandidate = makeArtifact();
  const diagnosticWarning = makeArtifact({
    id: "artifact-2",
    artifactKey: "extraction_warning:15:table_body_missing",
    kind: "extraction_warning",
    status: "warning",
    title: "Sparse extraction warning for page 15",
    content: "No structured row or column body was recovered from the parser output.",
    payload: {
      unresolved: ["No structured row or column body was recovered from the current parser output."],
    },
  });
  const positive = makeArtifact({
    id: "artifact-3",
    artifactKey: "metric_measurement:page-8:lithium",
    kind: "source_memory",
    status: "active",
    title: "Lithium measurements",
    content: "Lithium 613-663 ppm from Lundell Creek #1.",
    payload: { artifactClass: "positive", artifactBucket: "metric_measurement" },
    location: {
      pageNumberStart: 8,
      pageNumberEnd: 8,
      pageLabelStart: null,
      pageLabelEnd: null,
      tableId: null,
      figureId: null,
      sectionPath: [],
      headingPath: [],
    },
  });
  const clusters = buildArtifactRenderClusters({
    filename: "T5 Summary Deck V1.7ext.pdf",
    artifacts: [diagnosticCandidate, diagnosticWarning, positive],
  });
  const blocks = renderSourceMemoryBlocks({
    filename: "T5 Summary Deck V1.7ext.pdf",
    artifacts: [diagnosticCandidate, diagnosticWarning, positive],
  });

  assert.equal(isDiagnosticArtifact(diagnosticCandidate), true);
  assert.equal(classifyKnowledgeArtifact(positive), "positive");
  assert.ok(clusters.some((cluster) => cluster.artifactKeys.includes("table_candidate:15") && cluster.artifactKeys.includes("extraction_warning:15:table_body_missing")));
  assert.ok(blocks.some((block) => block.renderedText.includes("Page 15 unresolved table memory")));
  assert.ok(blocks.some((block) => block.renderedText.includes("These capabilities have not executed")));
});

runTest("deterministic source-learning helper promotes exact T5 source observations without LLM claims", () => {
  const observations = [
    makeObservation({
      id: "doc-t5:chunk:10",
      pageNumber: 10,
      content: "Regional Smackover TDS\nT5 Project\nTDS 250,000 ppm\nMapped using USGS water database",
    }),
    makeObservation({
      id: "doc-t5:chunk:11",
      pageNumber: 11,
      content: "Regional Smackover Bottom Hole Temps\nT5 Project\nTemp 235 F / 112 C",
    }),
    makeObservation(),
    makeObservation({
      id: "doc-t5:chunk:14",
      pageNumber: 14,
      content: "Smackover Brine Mining for Lithium & Bromide\nSustained Brine Production Rates\n20,000 barrels/day",
    }),
    makeObservation({
      id: "doc-t5:chunk:15",
      pageNumber: 15,
      content: "Smackover Water Chemistry\n17",
    }),
    makeObservation({
      id: "doc-t5:chunk:17",
      pageNumber: 17,
      content: "T5 Blondie Lady #1 Well Schematic\nProposed Total Depth 12,200'\nTop Smackover 11,250'\nReynolds Thickness 295'",
    }),
    makeObservation({
      id: "doc-t5:chunk:18",
      pageNumber: 18,
      content: "T5 Smackover Partners Project Scope & Timeline\nAug Sept Oct Nov Dec\nInjection Well\nPilot Scale DLE\nTest & Production Well\nQtr 1 Qtr 2 Qtr 3 Qtr 4\n2025 2026 2027",
    }),
  ];
  const candidates = proposeDeterministicSourceLearningCandidates({
    document: { id: "doc-t5", filename: "T5 Summary Deck V1.7ext.pdf" },
    sourceObservations: observations,
    currentUserPrompt: "What source learnings should be remembered?",
  });
  const result = evaluateArtifactPromotionCandidates({ candidates });

  assert.ok(candidates.some((candidate) => candidate.bucket === "source_summary"));
  assert.ok(candidates.some((candidate) => candidate.title.includes("TDS")));
  assert.ok(candidates.some((candidate) => candidate.payload.content.includes("613 - 663 ppm")));
  assert.ok(candidates.some((candidate) => candidate.payload.content.includes("235 F / 112 C")));
  assert.ok(candidates.some((candidate) => candidate.payload.content.includes("20,000 barrels/day")));
  assert.ok(candidates.some((candidate) => candidate.payload.content.includes("Reynolds Thickness 295")));
  assert.ok(candidates.some((candidate) => candidate.bucket === "risk_issue"));
  assert.ok(candidates.some((candidate) => candidate.bucket === "decision_recommendation"));
  assert.ok(candidates.every((candidate) => candidate.proposedBy === "system_seed"));
  assert.equal(result.acceptedArtifacts.length, candidates.length);
  assert.ok(
    result.acceptedArtifacts.every(
      (artifact) =>
        artifact.payload?.metadata?.supportedByObservation === true &&
        artifact.payload?.metadata?.extractionMethod === "deterministic_source_observation_match_v1"
    )
  );
});

runTest("deterministic helper does not promote unsupported page 15 table-cell values", () => {
  const candidates = proposeDeterministicSourceLearningCandidates({
    document: { id: "doc-t5", filename: "T5 Summary Deck V1.7ext.pdf" },
    sourceObservations: [
      makeObservation({
        id: "doc-t5:chunk:15",
        pageNumber: 15,
        content: "Smackover Water Chemistry\nSodium 250,000 ppm\nLithium 613 - 663 ppm\n17",
      }),
    ],
  });

  assert.equal(
    candidates.some(
      (candidate) =>
        candidate.bucket === "metric_measurement" &&
        candidate.metadata.sourceLocator.pageNumberStart === 15
    ),
    false
  );
  assert.equal(candidates.some((candidate) => candidate.bucket === "risk_issue"), true);
  assert.equal(
    candidates.some((candidate) => /table-cell|table cell/i.test(candidate.title)),
    false
  );
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
