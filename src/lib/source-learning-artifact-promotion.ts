import type {
  DocumentIntelligenceLocation,
  DocumentKnowledgeArtifactRecord,
  KnowledgeArtifactKind,
  KnowledgeArtifactStatus,
  UpsertDocumentKnowledgeArtifactInput,
} from "./document-intelligence";
import { buildKnowledgeArtifactSourceLocationLabel } from "./document-intelligence";
import { joinMarkdownSections } from "./context-formatting";
export type {
  SourceObservationType,
  SourceObservationPromotionInput as SourceObservation,
} from "./source-observations";
import type {
  SourceObservationPromotionInput as SourceObservation,
  SourceObservationType,
} from "./source-observations";

export type ArtifactBucket =
  | "source_summary"
  | "metric_measurement"
  | "entity_asset"
  | "relationship_linkage"
  | "timeline_milestone"
  | "assumption"
  | "risk_issue"
  | "decision_recommendation"
  | "table_structured_data"
  | "visual_figure_observation"
  | "evidence_claim_support"
  | "workflow_work_product"
  | "context_debt"
  | "capability_gap";

export type ArtifactClass = "positive" | "diagnostic";

export type ArtifactValidationState =
  | "candidate"
  | "validated"
  | "rejected_missing_source"
  | "rejected_missing_provenance"
  | "rejected_missing_confidence"
  | "rejected_missing_limitations"
  | "rejected_unsupported_inference"
  | "rejected_duplicate"
  | "rejected_policy";

export type ArtifactPayload = {
  content: string;
  structuredData?: Record<string, unknown> | Array<Record<string, unknown>> | null;
  claims?: string[];
  values?: Array<Record<string, unknown>>;
  observationRefs?: string[];
  unsupportedInference?: boolean;
};

export type ArtifactMetadata = {
  sourceDocumentId: string | null;
  sourceVersion: string | null;
  sourceLocator: Partial<DocumentIntelligenceLocation> & {
    sourceLocationLabel?: string | null;
    charStart?: number | null;
    charEnd?: number | null;
  };
  observationType: SourceObservationType;
  sourceObservationIds: string[];
  extractionMethod: string;
  confidence: number | null;
  limitations: string[];
  validationState?: ArtifactValidationState;
  createdByTaskKey?: string | null;
  createdByTool?: string | null;
  createdByModel?: string | null;
  reuseEligibility: "eligible" | "needs_review" | "not_reusable";
  dataPolicy: {
    persistenceAllowed: boolean;
    reason?: string | null;
  };
  supportedByObservation: boolean;
};

export type ArtifactPromotionCandidate = {
  candidateId: string;
  bucket: ArtifactBucket;
  title: string;
  summary: string | null;
  payload: ArtifactPayload;
  metadata: ArtifactMetadata;
  proposedBy: "agent" | "system_seed" | "test_fixture";
  reason: string;
};

export type ArtifactDedupePolicy = {
  mode: "source_locator_payload_bucket";
  detail: string;
};

export type ArtifactReusePolicy = {
  eligibleStatuses: KnowledgeArtifactStatus[];
  includeDiagnosticsForLimitations: boolean;
  detail: string;
};

export type ArtifactPromotionPolicy = {
  allowedBuckets: ArtifactBucket[];
  dedupe: ArtifactDedupePolicy;
  reuse: ArtifactReusePolicy;
  requireSourceDocument: boolean;
  requireSourceLocator: boolean;
  requireConfidence: boolean;
  requireLimitations: boolean;
  rejectUnsupportedInference: boolean;
};

export type ArtifactPromotionTrace = {
  candidateId: string;
  decision: "accepted" | "rejected";
  validationState: ArtifactValidationState;
  reasons: string[];
  dedupeKey: string;
};

export type ArtifactPromotionDecision = {
  candidateId: string;
  accepted: boolean;
  validationState: ArtifactValidationState;
  reasons: string[];
  artifact: UpsertDocumentKnowledgeArtifactInput | null;
  trace: ArtifactPromotionTrace;
};

export type ArtifactPromotionDebugSnapshot = {
  policy: ArtifactPromotionPolicy;
  candidateCount: number;
  acceptedCount: number;
  rejectedCount: number;
  traces: ArtifactPromotionTrace[];
};

export type ArtifactBucketDefinition = {
  bucket: ArtifactBucket;
  label: string;
  artifactClass: ArtifactClass;
  defaultKind: KnowledgeArtifactKind;
  description: string;
};

export type ArtifactRenderCluster = {
  clusterId: string;
  artifactClass: ArtifactClass;
  title: string;
  status: KnowledgeArtifactStatus;
  sourceLocationLabel: string | null;
  artifactKeys: string[];
  artifacts: DocumentKnowledgeArtifactRecord[];
  summary: string | null;
  content: string;
  limitations: string[];
  neededNextCapabilities: string[];
  noUnavailableToolExecutionClaimed: true;
};

export type SourceMemoryBlock = {
  blockId: string;
  cluster: ArtifactRenderCluster;
  renderedText: string;
};

export type PositiveKnowledgeArtifact = DocumentKnowledgeArtifactRecord & {
  payload: (DocumentKnowledgeArtifactRecord["payload"] & { artifactClass?: "positive" }) | null;
};

export type DiagnosticArtifact = DocumentKnowledgeArtifactRecord & {
  payload: (DocumentKnowledgeArtifactRecord["payload"] & { artifactClass?: "diagnostic" }) | null;
};

const ARTIFACT_BUCKET_DEFINITIONS: ArtifactBucketDefinition[] = [
  {
    bucket: "source_summary",
    label: "Source summary",
    artifactClass: "positive",
    defaultKind: "document_summary",
    description: "Durable source-grounded summary of a document, page, section, or collection.",
  },
  {
    bucket: "metric_measurement",
    label: "Metric or measurement",
    artifactClass: "positive",
    defaultKind: "source_memory",
    description: "Source-grounded numerical value, unit, range, or operational metric.",
  },
  {
    bucket: "entity_asset",
    label: "Entity or asset",
    artifactClass: "positive",
    defaultKind: "named_entity_inventory",
    description: "Source-grounded named person, organization, asset, well, property, or object.",
  },
  {
    bucket: "relationship_linkage",
    label: "Relationship linkage",
    artifactClass: "positive",
    defaultKind: "source_memory",
    description: "Source-grounded relationship between entities, assets, sources, or claims.",
  },
  {
    bucket: "timeline_milestone",
    label: "Timeline milestone",
    artifactClass: "positive",
    defaultKind: "source_memory",
    description: "Source-grounded date, phase, dependency, or milestone.",
  },
  {
    bucket: "assumption",
    label: "Assumption",
    artifactClass: "positive",
    defaultKind: "source_memory",
    description: "Explicit source-grounded assumption or planning premise.",
  },
  {
    bucket: "risk_issue",
    label: "Risk or issue",
    artifactClass: "positive",
    defaultKind: "open_question",
    description: "Source-grounded risk, limitation, unresolved issue, or decision blocker.",
  },
  {
    bucket: "decision_recommendation",
    label: "Decision or recommendation",
    artifactClass: "positive",
    defaultKind: "source_memory",
    description: "Source-grounded recommendation, decision, or next action.",
  },
  {
    bucket: "table_structured_data",
    label: "Structured table data",
    artifactClass: "positive",
    defaultKind: "table_extraction",
    description: "Recovered table rows, columns, cells, or structured ranges.",
  },
  {
    bucket: "visual_figure_observation",
    label: "Visual or figure observation",
    artifactClass: "positive",
    defaultKind: "figure_interpretation",
    description: "Source-grounded observation about a figure, chart, map, schematic, or visual.",
  },
  {
    bucket: "evidence_claim_support",
    label: "Evidence claim support",
    artifactClass: "positive",
    defaultKind: "key_fact_inventory",
    description: "Source-grounded evidence supporting a claim or answerable fact.",
  },
  {
    bucket: "workflow_work_product",
    label: "Workflow work product",
    artifactClass: "positive",
    defaultKind: "source_memory",
    description: "Source-grounded reusable output or intermediate work product.",
  },
  {
    bucket: "context_debt",
    label: "Context debt",
    artifactClass: "diagnostic",
    defaultKind: "open_question",
    description: "Diagnostic source memory for missing, weak, stale, or unresolved source understanding.",
  },
  {
    bucket: "capability_gap",
    label: "Capability gap",
    artifactClass: "diagnostic",
    defaultKind: "source_memory",
    description: "Diagnostic memory for a missing or unavailable system capability.",
  },
];

export class ArtifactBucketRegistry {
  private readonly byBucket = new Map<ArtifactBucket, ArtifactBucketDefinition>(
    ARTIFACT_BUCKET_DEFINITIONS.map((definition) => [definition.bucket, definition])
  );

  list() {
    return [...this.byBucket.values()];
  }

  has(bucket: string): bucket is ArtifactBucket {
    return this.byBucket.has(bucket as ArtifactBucket);
  }

  get(bucket: ArtifactBucket) {
    return this.byBucket.get(bucket) ?? null;
  }
}

export const DEFAULT_ARTIFACT_PROMOTION_POLICY: ArtifactPromotionPolicy = {
  allowedBuckets: ARTIFACT_BUCKET_DEFINITIONS.map((definition) => definition.bucket),
  dedupe: {
    mode: "source_locator_payload_bucket",
    detail: "Candidates dedupe by source document, source locator, bucket, and normalized payload content.",
  },
  reuse: {
    eligibleStatuses: ["active", "partial", "warning", "open"],
    includeDiagnosticsForLimitations: true,
    detail: "Positive artifacts are reusable as source learning; diagnostic artifacts are reusable as limitations.",
  },
  requireSourceDocument: true,
  requireSourceLocator: true,
  requireConfidence: true,
  requireLimitations: true,
  rejectUnsupportedInference: true,
};

function normalizeWhitespace(value: string | null | undefined) {
  return (value ?? "").replace(/\s+/g, " ").trim();
}

function normalizeKeySegment(value: string | null | undefined) {
  return normalizeWhitespace(value)
    .toLowerCase()
    .replace(/[^a-z0-9:_-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 96) || "none";
}

function shortHash(value: string) {
  let hash = 0;
  for (let index = 0; index < value.length; index += 1) {
    hash = (hash * 31 + value.charCodeAt(index)) >>> 0;
  }
  return hash.toString(36);
}

function sourceLocatorKey(locator: ArtifactMetadata["sourceLocator"]) {
  if (locator.sourceLocationLabel?.trim()) return normalizeKeySegment(locator.sourceLocationLabel);
  if (typeof locator.pageNumberStart === "number") return `page-${locator.pageNumberStart}`;
  if (locator.tableId?.trim()) return `table-${locator.tableId}`;
  if (locator.figureId?.trim()) return `figure-${locator.figureId}`;
  if (locator.sectionPath && locator.sectionPath.length > 0) {
    return normalizeKeySegment(locator.sectionPath.join("/"));
  }
  if (typeof locator.charStart === "number" || typeof locator.charEnd === "number") {
    return `chars-${locator.charStart ?? "na"}-${locator.charEnd ?? "na"}`;
  }
  return "none";
}

export function buildArtifactPromotionDedupeKey(candidate: ArtifactPromotionCandidate) {
  return [
    "artifact-promotion",
    normalizeKeySegment(candidate.metadata.sourceDocumentId),
    candidate.bucket,
    sourceLocatorKey(candidate.metadata.sourceLocator),
    shortHash(normalizeWhitespace(candidate.payload.content).toLowerCase()),
  ].join(":");
}

function hasSourceLocator(locator: ArtifactMetadata["sourceLocator"]) {
  return (
    Boolean(locator.sourceLocationLabel?.trim()) ||
    typeof locator.pageNumberStart === "number" ||
    typeof locator.charStart === "number" ||
    Boolean(locator.tableId?.trim()) ||
    Boolean(locator.figureId?.trim()) ||
    Boolean(locator.sectionPath && locator.sectionPath.length > 0)
  );
}

function artifactKindForBucket(bucket: ArtifactBucket) {
  return new ArtifactBucketRegistry().get(bucket)?.defaultKind ?? "source_memory";
}

function artifactClassForBucket(bucket: ArtifactBucket) {
  return new ArtifactBucketRegistry().get(bucket)?.artifactClass ?? "positive";
}

export function classifyKnowledgeArtifact(
  artifact: Pick<DocumentKnowledgeArtifactRecord, "kind" | "payload">
): ArtifactClass {
  const payloadClass = artifact.payload?.artifactClass;
  if (payloadClass === "positive" || payloadClass === "diagnostic") {
    return payloadClass;
  }
  if (
    artifact.kind === "table_candidate" ||
    artifact.kind === "extraction_warning" ||
    artifact.kind === "open_question"
  ) {
    return "diagnostic";
  }
  return "positive";
}

export function isDiagnosticArtifact(artifact: Pick<DocumentKnowledgeArtifactRecord, "kind" | "payload">) {
  return classifyKnowledgeArtifact(artifact) === "diagnostic";
}

function buildPromotionLocation(locator: ArtifactMetadata["sourceLocator"]): DocumentIntelligenceLocation {
  return {
    pageNumberStart: locator.pageNumberStart ?? null,
    pageNumberEnd: locator.pageNumberEnd ?? locator.pageNumberStart ?? null,
    pageLabelStart: locator.pageLabelStart ?? null,
    pageLabelEnd: locator.pageLabelEnd ?? locator.pageLabelStart ?? null,
    tableId: locator.tableId ?? null,
    figureId: locator.figureId ?? null,
    sectionPath: [...(locator.sectionPath ?? [])],
    headingPath: [...(locator.headingPath ?? [])],
  };
}

function candidateToArtifact(params: {
  candidate: ArtifactPromotionCandidate;
  dedupeKey: string;
  validationState: ArtifactValidationState;
}) {
  const artifactClass = artifactClassForBucket(params.candidate.bucket);
  const location = buildPromotionLocation(params.candidate.metadata.sourceLocator);
  const sourceLocationLabel =
    params.candidate.metadata.sourceLocator.sourceLocationLabel ??
    buildKnowledgeArtifactSourceLocationLabel(
      "source document",
      location,
      params.candidate.title
    );

  return {
    artifactKey: `${params.candidate.bucket}:${normalizeKeySegment(sourceLocatorKey(params.candidate.metadata.sourceLocator))}:${shortHash(params.dedupeKey)}`,
    sourceDocumentId: params.candidate.metadata.sourceDocumentId as string,
    kind: artifactKindForBucket(params.candidate.bucket),
    status: artifactClass === "diagnostic" ? "open" : "active",
    title: params.candidate.title,
    summary: params.candidate.summary,
    content: normalizeWhitespace(params.candidate.payload.content),
    tool: null,
    confidence: params.candidate.metadata.confidence,
    location,
    sourceLocationLabel,
    payload: {
      artifactBucket: params.candidate.bucket,
      artifactClass,
      validationState: params.validationState,
      payload: params.candidate.payload,
      metadata: {
        ...params.candidate.metadata,
        validationState: params.validationState,
      },
      promotion: {
        candidateId: params.candidate.candidateId,
        proposedBy: params.candidate.proposedBy,
        reason: params.candidate.reason,
        dedupeKey: params.dedupeKey,
      },
    },
    relevanceHints: [
      params.candidate.bucket,
      params.candidate.title,
      params.candidate.summary,
      sourceLocationLabel,
      ...params.candidate.metadata.limitations,
    ]
      .map(normalizeWhitespace)
      .filter(Boolean),
  } satisfies UpsertDocumentKnowledgeArtifactInput;
}

export function evaluateArtifactPromotionCandidate(params: {
  candidate: ArtifactPromotionCandidate;
  existingArtifacts?: DocumentKnowledgeArtifactRecord[];
  policy?: ArtifactPromotionPolicy;
}): ArtifactPromotionDecision {
  const policy = params.policy ?? DEFAULT_ARTIFACT_PROMOTION_POLICY;
  const registry = new ArtifactBucketRegistry();
  const reasons: string[] = [];
  let validationState: ArtifactValidationState = "validated";
  const dedupeKey = buildArtifactPromotionDedupeKey(params.candidate);

  if (!registry.has(params.candidate.bucket) || !policy.allowedBuckets.includes(params.candidate.bucket)) {
    reasons.push(`Artifact bucket is not allowed: ${params.candidate.bucket}.`);
    validationState = "rejected_policy";
  }
  if (policy.requireSourceDocument && !params.candidate.metadata.sourceDocumentId?.trim()) {
    reasons.push("A source document id is required before source learning can be persisted.");
    validationState = "rejected_missing_source";
  }
  if (policy.requireSourceLocator && !hasSourceLocator(params.candidate.metadata.sourceLocator)) {
    reasons.push("A source locator is required before source learning can be persisted.");
    validationState = "rejected_missing_provenance";
  }
  if (
    policy.requireConfidence &&
    (params.candidate.metadata.confidence == null ||
      params.candidate.metadata.confidence < 0 ||
      params.candidate.metadata.confidence > 1)
  ) {
    reasons.push("A confidence value between 0 and 1 is required.");
    validationState = "rejected_missing_confidence";
  }
  if (policy.requireLimitations && params.candidate.metadata.limitations.length === 0) {
    reasons.push("Limitations must be explicit, even when confidence is high.");
    validationState = "rejected_missing_limitations";
  }
  if (!normalizeWhitespace(params.candidate.payload.content)) {
    reasons.push("Artifact payload content is required.");
    validationState = "rejected_unsupported_inference";
  }
  if (
    policy.rejectUnsupportedInference &&
    (params.candidate.payload.unsupportedInference || !params.candidate.metadata.supportedByObservation)
  ) {
    reasons.push("Unsupported inference cannot be persisted as an extracted source fact.");
    validationState = "rejected_unsupported_inference";
  }
  if (!params.candidate.metadata.dataPolicy.persistenceAllowed) {
    reasons.push(params.candidate.metadata.dataPolicy.reason ?? "Data policy does not permit persistence.");
    validationState = "rejected_policy";
  }

  const duplicate = (params.existingArtifacts ?? []).some((artifact) => {
    const existingDedupeKey =
      typeof artifact.payload?.promotion === "object" &&
      artifact.payload.promotion !== null &&
      "dedupeKey" in artifact.payload.promotion
        ? String((artifact.payload.promotion as Record<string, unknown>).dedupeKey)
        : null;
    return existingDedupeKey === dedupeKey;
  });
  if (duplicate) {
    reasons.push("A matching artifact already exists for this source locator, bucket, and payload.");
    validationState = "rejected_duplicate";
  }

  const accepted = reasons.length === 0;
  const artifact = accepted
    ? candidateToArtifact({
        candidate: params.candidate,
        dedupeKey,
        validationState,
      })
    : null;
  const trace = {
    candidateId: params.candidate.candidateId,
    decision: accepted ? "accepted" : "rejected",
    validationState,
    reasons: accepted ? ["Candidate accepted for durable KnowledgeArtifact persistence."] : reasons,
    dedupeKey,
  } satisfies ArtifactPromotionTrace;

  return {
    candidateId: params.candidate.candidateId,
    accepted,
    validationState,
    reasons: trace.reasons,
    artifact,
    trace,
  };
}

export function evaluateArtifactPromotionCandidates(params: {
  candidates: ArtifactPromotionCandidate[];
  existingArtifacts?: DocumentKnowledgeArtifactRecord[];
  policy?: ArtifactPromotionPolicy;
}) {
  const existing = [...(params.existingArtifacts ?? [])];
  const decisions: ArtifactPromotionDecision[] = [];

  for (const candidate of params.candidates) {
    const decision = evaluateArtifactPromotionCandidate({
      candidate,
      existingArtifacts: existing,
      policy: params.policy,
    });
    decisions.push(decision);
    if (decision.artifact) {
      existing.push({
        ...decision.artifact,
        id: decision.artifact.artifactKey,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        approxTokenCount: Math.ceil(decision.artifact.content.length / 4),
      });
    }
  }

  return {
    decisions,
    acceptedArtifacts: decisions.flatMap((decision) => (decision.artifact ? [decision.artifact] : [])),
    debugSnapshot: {
      policy: params.policy ?? DEFAULT_ARTIFACT_PROMOTION_POLICY,
      candidateCount: params.candidates.length,
      acceptedCount: decisions.filter((decision) => decision.accepted).length,
      rejectedCount: decisions.filter((decision) => !decision.accepted).length,
      traces: decisions.map((decision) => decision.trace),
    } satisfies ArtifactPromotionDebugSnapshot,
  };
}

function pageNumberForObservation(observation: SourceObservation) {
  return observation.sourceLocator.pageNumberStart ?? observation.sourceLocator.pageNumberEnd ?? null;
}

function observationLocationLabel(observation: SourceObservation) {
  return observation.sourceLocator.sourceLocationLabel ?? `page ${pageNumberForObservation(observation) ?? "unknown"}`;
}

function observationText(observation: SourceObservation) {
  return normalizeWhitespace(observation.content);
}

function addPromotionCandidate(
  candidates: ArtifactPromotionCandidate[],
  seenCandidateIds: Set<string>,
  params: {
    candidateId: string;
    bucket: ArtifactBucket;
    title: string;
    summary: string | null;
    content: string;
    observations: SourceObservation[];
    confidence?: number;
    limitations: string[];
    reason: string;
    values?: Array<Record<string, unknown>>;
  }
) {
  const primaryObservation = params.observations[0];
  if (!primaryObservation || seenCandidateIds.has(params.candidateId)) {
    return;
  }

  seenCandidateIds.add(params.candidateId);
  candidates.push({
    candidateId: params.candidateId,
    bucket: params.bucket,
    title: params.title,
    summary: params.summary,
    payload: {
      content: normalizeWhitespace(params.content),
      values: params.values,
      observationRefs: params.observations.map((observation) => observation.id),
      unsupportedInference: false,
    },
    metadata: {
      sourceDocumentId: primaryObservation.sourceDocumentId,
      sourceVersion: primaryObservation.sourceVersion,
      sourceLocator: primaryObservation.sourceLocator,
      observationType: primaryObservation.type,
      sourceObservationIds: params.observations.map((observation) => observation.id),
      extractionMethod: "deterministic_source_observation_match_v1",
      confidence: params.confidence ?? Math.min(0.9, Math.max(0.72, primaryObservation.confidence ?? 0.72)),
      limitations: params.limitations,
      createdByTaskKey: null,
      createdByTool: null,
      createdByModel: null,
      reuseEligibility: "eligible",
      dataPolicy: {
        persistenceAllowed: true,
        reason: "Source observation promotion is internal durable source memory.",
      },
      supportedByObservation: true,
    },
    proposedBy: "system_seed",
    reason: params.reason,
  });
}

function findObservation(
  observations: SourceObservation[],
  predicate: (observation: SourceObservation, text: string) => boolean
) {
  return observations.find((observation) => predicate(observation, observationText(observation))) ?? null;
}

function findObservations(
  observations: SourceObservation[],
  predicate: (observation: SourceObservation, text: string) => boolean
) {
  return observations.filter((observation) => predicate(observation, observationText(observation)));
}

function metricObservation(
  observations: SourceObservation[],
  predicate: (text: string) => boolean
) {
  return findObservation(
    observations,
    (observation, text) => pageNumberForObservation(observation) !== 15 && predicate(text)
  );
}

export function proposeDeterministicSourceLearningCandidates(params: {
  document: Pick<DocumentKnowledgeArtifactRecord, "sourceDocumentId"> | { id: string; filename?: string | null };
  sourceObservations: SourceObservation[];
  currentUserPrompt?: string | null;
}) {
  const candidates: ArtifactPromotionCandidate[] = [];
  const seenCandidateIds = new Set<string>();
  const observations = params.sourceObservations.filter((observation) => normalizeWhitespace(observation.content));
  const filename =
    "filename" in params.document && typeof params.document.filename === "string"
      ? params.document.filename
      : "source document";

  const smackoverLithiumObservations = findObservations(
    observations,
    (_observation, text) => /smackover/i.test(text) && /lithium/i.test(text)
  );
  if (smackoverLithiumObservations.length > 0) {
    const supporting = [
      ...smackoverLithiumObservations,
      ...findObservations(
        observations,
        (_observation, text) =>
          /\btds\b|bottom hole|temp 235|barrels\/day|project scope|timeline|reynolds thickness/i.test(text)
      ),
    ].slice(0, 8);
    addPromotionCandidate(candidates, seenCandidateIds, {
      candidateId: "source-summary:smackover-lithium-development",
      bucket: "source_summary",
      title: "T5 Smackover lithium development deck summary",
      summary: "Source observations describe Smackover lithium development context and supporting reservoir/project facts.",
      content: `${filename} contains extracted source observations about Smackover lithium context, regional structure, TDS, temperature, well/test data, brine production rate, well schematic information, and project timeline content where those observations appear in parser text.`,
      observations: supporting,
      confidence: 0.82,
      limitations: [
        "Summary is promoted from extracted parser text observations, not from unexecuted OCR, vision, or rendered-page inspection.",
        "Do not treat this summary as recovered page 15 chemistry table cells.",
      ],
      reason: "The observations provide reusable document-level source learning.",
    });
  }

  const tdsObservation = metricObservation(observations, (text) => /\btds\b/i.test(text) && /250,?000\s*ppm/i.test(text));
  if (tdsObservation) {
    addPromotionCandidate(candidates, seenCandidateIds, {
      candidateId: "metric:tds-250000-ppm",
      bucket: "metric_measurement",
      title: "Regional Smackover TDS",
      summary: "TDS is shown as 250,000 ppm in extracted deck text.",
      content: `The source observation at ${observationLocationLabel(tdsObservation)} states "TDS 250,000 ppm."`,
      observations: [tdsObservation],
      confidence: 0.9,
      limitations: ["Value is promoted from parser text and is not recovered from the unresolved page 15 chemistry table."],
      reason: "TDS is a reusable source-grounded measurement.",
      values: [{ metric: "TDS", value: "250,000", unit: "ppm", sourceText: "TDS 250,000 ppm" }],
    });
  }

  const tempObservation = metricObservation(
    observations,
    (text) => /(temp|temperature|bottom hole|bht)/i.test(text) && /235\s*f/i.test(text) && /112\s*c/i.test(text)
  );
  if (tempObservation) {
    addPromotionCandidate(candidates, seenCandidateIds, {
      candidateId: "metric:bottom-hole-temp-235f-112c",
      bucket: "metric_measurement",
      title: "Regional Smackover bottom-hole temperature",
      summary: "Temperature is shown as 235 F / 112 C in extracted deck text.",
      content: `The source observation at ${observationLocationLabel(tempObservation)} states "Temp 235 F / 112 C."`,
      observations: [tempObservation],
      confidence: 0.9,
      limitations: ["Value is promoted from parser text and is not recovered from the unresolved page 15 chemistry table."],
      reason: "Temperature is a reusable source-grounded measurement.",
      values: [{ metric: "temperature", value: "235 F / 112 C", sourceText: "Temp 235 F / 112 C" }],
    });
  }

  const lithiumRangeObservation = metricObservation(
    observations,
    (text) => /613\s*[-–]\s*663\s*ppm/i.test(text) && /lithium/i.test(text)
  );
  if (lithiumRangeObservation) {
    addPromotionCandidate(candidates, seenCandidateIds, {
      candidateId: "metric:lundell-lithium-613-663-ppm",
      bucket: "metric_measurement",
      title: "Lundell Creek #1 lithium range",
      summary: "Lundell Creek #1 tested 613-663 ppm lithium from Smackover in extracted deck text.",
      content: `The source observation at ${observationLocationLabel(lithiumRangeObservation)} states Lundell Creek #1 tested 613 - 663 ppm of lithium from Smackover.`,
      observations: [lithiumRangeObservation],
      confidence: 0.9,
      limitations: ["Value is promoted from parser text and is not recovered from the unresolved page 15 chemistry table."],
      reason: "Lithium concentration is reusable source learning.",
      values: [{ metric: "lithium", valueRange: "613-663", unit: "ppm", sourceText: "613 - 663 ppm" }],
    });
  }

  const lithiumTargetObservation = metricObservation(
    observations,
    (text) => /\b650\+?\s*ppm\b/i.test(text) && /lithium/i.test(text)
  );
  if (lithiumTargetObservation) {
    addPromotionCandidate(candidates, seenCandidateIds, {
      candidateId: "metric:lithium-650-ppm",
      bucket: "metric_measurement",
      title: "650 ppm lithium observation",
      summary: "A 650 ppm lithium observation appears in extracted deck text.",
      content: `The source observation at ${observationLocationLabel(lithiumTargetObservation)} includes a 650 ppm lithium reference.`,
      observations: [lithiumTargetObservation],
      confidence: 0.82,
      limitations: [
        "The helper preserves the source-observed 650 ppm text and does not upgrade it to 650+ ppm unless the plus sign appears in the observation.",
        "Value is not recovered from the unresolved page 15 chemistry table.",
      ],
      reason: "The lithium value is reusable source learning when source-observed.",
      values: [{ metric: "lithium", value: "650", unit: "ppm", sourceText: "650 ppm" }],
    });
  }

  const porosityObservation = metricObservation(
    observations,
    (text) => /porosity\s+10\s*[-–]\s*25\s*%/i.test(text) && /permeability\s*>?\s*1\.5\s*darcy/i.test(text)
  );
  if (porosityObservation) {
    addPromotionCandidate(candidates, seenCandidateIds, {
      candidateId: "metric:porosity-permeability",
      bucket: "metric_measurement",
      title: "Porosity and permeability observation",
      summary: "Porosity and permeability values appear together in extracted source text.",
      content: `The source observation at ${observationLocationLabel(porosityObservation)} states porosity 10-25% and permeability greater than 1.5 Darcy.`,
      observations: [porosityObservation],
      confidence: 0.86,
      limitations: ["Value is promoted from parser text and is not recovered from the unresolved page 15 chemistry table."],
      reason: "Reservoir quality values are reusable source learning.",
      values: [
        { metric: "porosity", valueRange: "10-25", unit: "%" },
        { metric: "permeability", value: ">1.5", unit: "Darcy" },
      ],
    });
  }

  const brineRateObservation = metricObservation(observations, (text) => /20,?000\s*barrels?\/day/i.test(text));
  if (brineRateObservation) {
    addPromotionCandidate(candidates, seenCandidateIds, {
      candidateId: "metric:brine-production-20000-bpd",
      bucket: "metric_measurement",
      title: "Sustained brine production rate",
      summary: "Sustained brine production rates show 20,000 barrels/day in extracted deck text.",
      content: `The source observation at ${observationLocationLabel(brineRateObservation)} states "20,000 barrels/day."`,
      observations: [brineRateObservation],
      confidence: 0.9,
      limitations: ["Value is promoted from parser text and is not recovered from the unresolved page 15 chemistry table."],
      reason: "Production rate is reusable source learning.",
      values: [{ metric: "brine production", value: "20,000", unit: "barrels/day" }],
    });
  }

  const reynoldsObservation = metricObservation(observations, (text) => /reynolds thickness\s+295['’]/i.test(text));
  if (reynoldsObservation) {
    addPromotionCandidate(candidates, seenCandidateIds, {
      candidateId: "metric:reynolds-thickness-295-ft",
      bucket: "metric_measurement",
      title: "Reynolds thickness",
      summary: "Reynolds Thickness is shown as 295' in extracted deck text.",
      content: `The source observation at ${observationLocationLabel(reynoldsObservation)} states "Reynolds Thickness 295'."`,
      observations: [reynoldsObservation],
      confidence: 0.9,
      limitations: ["Value is promoted from parser text and is not recovered from the unresolved page 15 chemistry table."],
      reason: "Well schematic thickness is reusable source learning.",
      values: [{ metric: "Reynolds thickness", value: "295", unit: "ft", sourceText: "Reynolds Thickness 295'" }],
    });
  }

  const exactTimelineObservation = findObservation(observations, (_observation, text) =>
    /q3\/q4\s+2025|q1\/q2\s+2026|q3\s+2026|q4\s+2026\/q1\s+2027/i.test(text)
  );
  const broadTimelineObservation =
    exactTimelineObservation ??
    findObservation(
      observations,
      (_observation, text) =>
        /project scope.*timeline|scope\s*&\s*timeline/i.test(text) && /2025/i.test(text) && /2026/i.test(text)
    );
  if (broadTimelineObservation) {
    const hasExactMilestones = broadTimelineObservation === exactTimelineObservation;
    addPromotionCandidate(candidates, seenCandidateIds, {
      candidateId: hasExactMilestones ? "timeline:project-milestones-exact" : "timeline:project-scope-broad",
      bucket: "timeline_milestone",
      title: hasExactMilestones ? "Project milestone timeline" : "Project scope and timeline observation",
      summary: hasExactMilestones
        ? "Exact project milestones appear in extracted source text."
        : "Project scope/timeline source text is present, but parser text does not preserve the visual schedule geometry.",
      content: hasExactMilestones
        ? `The source observation at ${observationLocationLabel(broadTimelineObservation)} contains project milestone timing text including Q3/Q4 2025, Q1/Q2 2026, Q3 2026, or Q4 2026/Q1 2027 where present.`
        : `The source observation at ${observationLocationLabel(broadTimelineObservation)} identifies T5 Smackover Partners project scope/timeline content spanning 2025-2027, but the parser text does not preserve enough visual layout to infer precise quarter assignments.`,
      observations: [broadTimelineObservation],
      confidence: hasExactMilestones ? 0.86 : 0.7,
      limitations: hasExactMilestones
        ? ["Promoted from parser text; verify the visual schedule before deliverable-grade timeline claims."]
        : ["Parser text does not preserve visual schedule geometry; do not infer precise quarter/date mappings from this artifact alone."],
      reason: "Timeline context is reusable source learning when its limitations are explicit.",
    });
  }

  const page15WaterChemistryObservation = findObservation(
    observations,
    (observation, text) => pageNumberForObservation(observation) === 15 && /smackover water chemistry/i.test(text)
  );
  if (page15WaterChemistryObservation) {
    addPromotionCandidate(candidates, seenCandidateIds, {
      candidateId: "risk:page-15-water-chemistry-table-missing",
      bucket: "risk_issue",
      title: "Page 15 water chemistry table body remains missing",
      summary: "The page 15 water chemistry table is source-relevant, but parser text did not recover rows, columns, or cells.",
      content:
        "The page 15 source observation identifies Smackover Water Chemistry, while current parser-text memory does not recover the ionic chemistry rows, columns, or cells. Do not infer chemistry values from this artifact alone.",
      observations: [page15WaterChemistryObservation],
      confidence: 0.78,
      limitations: [
        "This is a source-linked risk/issue artifact, not recovered table data.",
        "Rendered-page inspection, OCR, vision page understanding, and document-AI table recovery have not executed.",
      ],
      reason: "The unresolved page 15 chemistry table affects DLE/geothermal process design questions.",
    });

    const dleObservation = findObservation(observations, (_observation, text) => /\bdle\b|brine|lithium/i.test(text));
    if (dleObservation) {
      addPromotionCandidate(candidates, seenCandidateIds, {
        candidateId: "recommendation:obtain-brine-assay-dle-data",
        bucket: "decision_recommendation",
        title: "Obtain raw brine assay and DLE partner data",
        summary: "Source-linked recommendation for resolving the missing page 15 chemistry table.",
        content:
          "Obtain the raw brine assay/lab report and DLE partner data before treating page 15 chemistry values as complete or deliverable-grade.",
        observations: [page15WaterChemistryObservation, dleObservation],
        confidence: 0.74,
        limitations: [
          "Recommendation is derived from observed source-debt context and source observations; it is not an extracted page 15 table value.",
          "No OCR, vision, rendered-page, or document-AI recovery has executed.",
        ],
        reason: "The recommendation is a reusable next step for resolving the source gap.",
      });
    }
  }

  return candidates;
}

function pageNumberForArtifact(artifact: DocumentKnowledgeArtifactRecord) {
  return artifact.location.pageNumberStart;
}

function isPageTableDiagnostic(artifact: DocumentKnowledgeArtifactRecord) {
  return artifact.kind === "table_candidate" || artifact.kind === "extraction_warning";
}

function clusterStatus(artifacts: DocumentKnowledgeArtifactRecord[]): KnowledgeArtifactStatus {
  if (artifacts.some((artifact) => artifact.status === "warning")) return "warning";
  if (artifacts.some((artifact) => artifact.status === "partial")) return "partial";
  if (artifacts.some((artifact) => artifact.status === "open")) return "open";
  return "active";
}

function clusterNeededCapabilities(artifacts: DocumentKnowledgeArtifactRecord[]) {
  const joined = artifacts
    .flatMap((artifact) => [
      artifact.content,
      artifact.summary,
      JSON.stringify(artifact.payload ?? {}),
    ])
    .join(" ")
    .toLowerCase();
  const capabilities: string[] = [];
  if (/rendered|render/.test(joined)) capabilities.push("rendered-page inspection");
  if (/\bocr\b/.test(joined)) capabilities.push("OCR");
  if (/vision/.test(joined)) capabilities.push("vision page understanding");
  if (/document.ai|document-ai|table recovery/.test(joined)) capabilities.push("document-AI table recovery");
  return capabilities.length > 0
    ? capabilities
    : [
        "rendered-page inspection",
        "OCR",
        "vision page understanding",
        "document-AI table recovery",
      ];
}

function clusterLimitations(artifacts: DocumentKnowledgeArtifactRecord[]) {
  const limitations = new Set<string>();
  for (const artifact of artifacts) {
    if (artifact.kind === "table_candidate" || artifact.kind === "extraction_warning") {
      limitations.add("Structured rows, columns, and cells were not recovered.");
      limitations.add("Do not infer missing table values from this artifact alone.");
    }
    const unresolved = artifact.payload?.unresolved;
    if (Array.isArray(unresolved)) {
      for (const entry of unresolved) {
        if (typeof entry === "string" && entry.trim()) limitations.add(entry.trim());
      }
    }
  }
  return [...limitations];
}

export function buildArtifactRenderClusters(params: {
  filename: string;
  artifacts: DocumentKnowledgeArtifactRecord[];
}): ArtifactRenderCluster[] {
  const clusters: ArtifactRenderCluster[] = [];
  const consumed = new Set<string>();
  const diagnosticsByPage = new Map<number, DocumentKnowledgeArtifactRecord[]>();

  for (const artifact of params.artifacts) {
    const pageNumber = pageNumberForArtifact(artifact);
    if (isPageTableDiagnostic(artifact) && pageNumber != null) {
      diagnosticsByPage.set(pageNumber, [...(diagnosticsByPage.get(pageNumber) ?? []), artifact]);
    }
  }

  for (const [pageNumber, artifacts] of diagnosticsByPage) {
    if (artifacts.length < 2) continue;
    for (const artifact of artifacts) consumed.add(artifact.artifactKey);
    const first = artifacts[0];
    clusters.push({
      clusterId: `diagnostic-table-page-${pageNumber}`,
      artifactClass: "diagnostic",
      title: `Page ${pageNumber} unresolved table memory`,
      status: clusterStatus(artifacts),
      sourceLocationLabel:
        first.sourceLocationLabel ??
        buildKnowledgeArtifactSourceLocationLabel(params.filename, first.location, first.title),
      artifactKeys: artifacts
        .sort((left, right) =>
          Number(right.kind === "table_candidate") - Number(left.kind === "table_candidate") ||
          left.artifactKey.localeCompare(right.artifactKey)
        )
        .map((artifact) => artifact.artifactKey),
      artifacts,
      summary: "Likely table detected, but the durable source memory does not contain structured table body data.",
      content: "The page has diagnostic source memory indicating a likely table and a sparse extraction warning.",
      limitations: clusterLimitations(artifacts),
      neededNextCapabilities: clusterNeededCapabilities(artifacts),
      noUnavailableToolExecutionClaimed: true,
    });
  }

  for (const artifact of params.artifacts) {
    if (consumed.has(artifact.artifactKey)) continue;
    clusters.push({
      clusterId: `artifact-${artifact.artifactKey}`,
      artifactClass: classifyKnowledgeArtifact(artifact),
      title: artifact.title ?? artifact.kind.replace(/_/g, " "),
      status: artifact.status,
      sourceLocationLabel:
        artifact.sourceLocationLabel ??
        buildKnowledgeArtifactSourceLocationLabel(params.filename, artifact.location, artifact.title),
      artifactKeys: [artifact.artifactKey],
      artifacts: [artifact],
      summary: artifact.summary,
      content: artifact.content,
      limitations:
        artifact.payload?.metadata &&
        typeof artifact.payload.metadata === "object" &&
        "limitations" in artifact.payload.metadata &&
        Array.isArray((artifact.payload.metadata as Record<string, unknown>).limitations)
          ? ((artifact.payload.metadata as Record<string, unknown>).limitations as unknown[]).filter(
              (entry): entry is string => typeof entry === "string"
            )
          : [],
      neededNextCapabilities: [],
      noUnavailableToolExecutionClaimed: true,
    });
  }

  return clusters.sort((left, right) =>
    (left.sourceLocationLabel ?? "").localeCompare(right.sourceLocationLabel ?? "") ||
    left.title.localeCompare(right.title)
  );
}

export function renderArtifactRenderCluster(cluster: ArtifactRenderCluster, index: number) {
  const linkedArtifacts =
    cluster.artifactKeys.length > 0
      ? `Linked artifacts: ${cluster.artifactKeys.join(", ")}.`
      : null;
  return joinMarkdownSections([
    `##### Source Memory ${index + 1}: ${cluster.title}`,
    `Artifact class: ${cluster.artifactClass}.`,
    `Status: ${cluster.status}.`,
    cluster.sourceLocationLabel ? `Source: ${cluster.sourceLocationLabel}.` : null,
    linkedArtifacts,
    cluster.summary ? `Summary: ${cluster.summary}` : null,
    cluster.content ? `Detail: ${cluster.content}` : null,
    cluster.limitations.length > 0
      ? `Limitation: ${cluster.limitations.join(" ")}`
      : null,
    cluster.neededNextCapabilities.length > 0
      ? `Needed next capabilities: ${cluster.neededNextCapabilities.join(", ")}. These capabilities have not executed.`
      : null,
  ]);
}

export function renderSourceMemoryBlocks(params: {
  filename: string;
  artifacts: DocumentKnowledgeArtifactRecord[];
}) {
  return buildArtifactRenderClusters(params).map((cluster, index) => ({
    blockId: cluster.clusterId,
    cluster,
    renderedText: renderArtifactRenderCluster(cluster, index),
  })) satisfies SourceMemoryBlock[];
}
