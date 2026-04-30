import {
  APPROVED_UPLOADED_DOCUMENT_EXTERNAL_PRODUCER_MANIFESTS,
  type UploadedDocumentExternalCapabilityId,
  type UploadedDocumentExternalProviderId,
  type UploadedDocumentExternalProviderStatus,
} from "./document-ingestion-external-producers";
import type {
  CapabilityGapRecord,
  ContextDebtRecord,
  ContextRegistrySelection,
  SourceCoverageRecord,
} from "./capability-gap-context-debt-registry";
import { prisma } from "./prisma";
import type {
  SourceObservationProducerAvailabilitySignal,
  SourceObservationProducerRequest,
  SourceObservationProducerResult,
} from "./source-observation-producers";
import type {
  CapabilityApprovalDecisionRecord,
  CapabilityApprovalScope,
  CapabilityGapApprovalCategory,
  CapabilityGapApprovalCenterDebugSummary,
  CapabilityGapApprovalCenterSummary,
  CapabilityGapApprovalPriority,
  CapabilityGapApprovalStatus,
  CapabilityGapApprovalSummaryRow,
  CapabilityGapCandidateProviderSummary,
  CapabilityProviderReadinessStatus,
} from "./capability-gap-approval-types";

type EnvLike = Record<string, string | undefined>;

type ApprovalPrismaRecord = Record<string, unknown> & {
  id: string;
  approvalKey: string;
  capabilityId: string;
  approved: boolean;
  createdAt: Date | string;
  updatedAt: Date | string;
};

type CapabilityApprovalPrismaClient = {
  $queryRawUnsafe?: <T = unknown>(query: string) => Promise<T>;
  capabilityApprovalDecision?: {
    findMany: (params: Record<string, unknown>) => Promise<ApprovalPrismaRecord[]>;
    upsert: (params: Record<string, unknown>) => Promise<ApprovalPrismaRecord>;
  };
};

function isPrismaMissingApprovalTableError(error: unknown) {
  if (!error || typeof error !== "object") return false;
  const record = error as { code?: unknown; message?: unknown };
  if (record.code === "P2021") return true;
  return typeof record.message === "string" && record.message.includes("capability_approval_decisions");
}

async function approvalDecisionTableExists(client: CapabilityApprovalPrismaClient) {
  if (!client.$queryRawUnsafe) return true;
  const rows = await client.$queryRawUnsafe<Array<{ table_name: string | null }>>(
    "SELECT to_regclass('public.capability_approval_decisions')::text AS table_name",
  );
  return Array.isArray(rows) && Boolean(rows[0]?.table_name);
}

type GapSeed = {
  capabilityId: string;
  capabilityLabel: string;
  providerId: string | null;
  providerLabel: string | null;
  category: CapabilityGapApprovalCategory;
  priority: CapabilityGapApprovalPriority;
  conversationId: string | null;
  conversationDocumentId: string | null;
  sourceLocator: Record<string, unknown> | null;
  firstSeenAt: string | null;
  lastSeenAt: string | null;
  evidenceSummary: string;
  recommendedAction: string;
  blockers: string[];
  traceIds: string[];
  relatedGapRecordIds: string[];
  relatedDebtRecordIds: string[];
  relatedCoverageRecordIds: string[];
  providerStatus: UploadedDocumentExternalProviderStatus | null;
  localCandidateId: string | null;
};

const APPROVAL_NO_EXECUTION_WARNING =
  "Capability approvals are governance state only. They clear approval_required when matched, but they do not execute tools, create observations, or support execution claims.";

const SUPPORTED_APPROVAL_SCOPES: CapabilityApprovalScope[] = [
  "conversation",
  "document",
  "provider",
  "capability",
];

const PROVIDER_MANIFEST_BY_ID = new Map<string, (typeof APPROVED_UPLOADED_DOCUMENT_EXTERNAL_PRODUCER_MANIFESTS)[number]>(
  APPROVED_UPLOADED_DOCUMENT_EXTERNAL_PRODUCER_MANIFESTS.map((manifest) => [manifest.providerId, manifest])
);
const PROVIDER_MANIFEST_BY_PRODUCER_ID = new Map<string, (typeof APPROVED_UPLOADED_DOCUMENT_EXTERNAL_PRODUCER_MANIFESTS)[number]>(
  APPROVED_UPLOADED_DOCUMENT_EXTERNAL_PRODUCER_MANIFESTS.map((manifest) => [manifest.producerId, manifest])
);

export function isCapabilityApprovalScope(value: unknown): value is CapabilityApprovalScope {
  return (
    value === "one_time" ||
    value === "conversation" ||
    value === "document" ||
    value === "project" ||
    value === "workspace" ||
    value === "provider" ||
    value === "capability"
  );
}

function toIso(value: unknown) {
  if (value instanceof Date) return value.toISOString();
  return typeof value === "string" ? value : new Date().toISOString();
}

function safeRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function safeArray(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

function safeString(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function uniqueStrings(values: Array<string | null | undefined>) {
  return Array.from(new Set(values.map((value) => value?.trim()).filter((value): value is string => Boolean(value))));
}

function normalizeKeySegment(value: string | null | undefined) {
  return (value ?? "none")
    .trim()
    .replace(/[^a-zA-Z0-9:_-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 96) || "none";
}

function priorityRank(value: CapabilityGapApprovalPriority) {
  return { critical: 4, high: 3, medium: 2, low: 1 }[value] ?? 0;
}

function statusRank(value: CapabilityGapApprovalStatus) {
  return {
    policy_blocked: 10,
    missing_input: 9,
    config_required: 8,
    adapter_missing: 7,
    approval_required: 6,
    approved: 5,
    external_unavailable: 4,
    local_unavailable: 3,
    deferred: 2,
    open: 1,
    resolved: 0,
  }[value] ?? 0;
}

function capabilityLabel(capabilityId: string) {
  return capabilityId
    .split(/[_:-]+/g)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function categoryFor(params: {
  capabilityId: string;
  providerId?: string | null;
  missingPayloadType?: string | null;
  kind?: string | null;
  missingConnector?: string | null;
}) {
  const haystack = [
    params.capabilityId,
    params.providerId,
    params.missingPayloadType,
    params.kind,
    params.missingConnector,
  ].filter(Boolean).join(" ");
  if (/ocr/i.test(haystack)) return "ocr";
  if (/rendered[_ -]?page|page_image/i.test(haystack)) return "rendered_page";
  if (/vision|image_understanding|model_vision/i.test(haystack)) return "vision";
  if (/document[_ -]?ai|textract|azure_document|pdf_extract/i.test(haystack)) return "document_ai";
  if (/llamaparse|external_parser|unstructured/i.test(haystack)) return "external_parser";
  if (/spreadsheet|formula|sheet|range_reader/i.test(haystack)) return "spreadsheet_analysis";
  if (/python|duckdb|pandas|polars|sandbox/i.test(haystack)) return "python_analysis";
  if (/table|structured_table/i.test(haystack)) return "table_extraction";
  if (/connector|sharepoint|drive|onedrive/i.test(haystack)) return "connector";
  if (/approval/i.test(haystack)) return "approval_path";
  if (params.providerId) return "external_provider";
  if (/tool/i.test(haystack)) return "local_tool";
  if (/lane|payload|native/i.test(haystack)) return "native_payload_lane";
  return "other";
}

function providerLabel(providerId: string | null) {
  if (!providerId) return null;
  return PROVIDER_MANIFEST_BY_ID.get(providerId)?.providerName ?? capabilityLabel(providerId);
}

function inferProviderIdFromEvidence(evidence: Record<string, unknown>) {
  const output = safeRecord(evidence.output);
  const metadata = safeRecord(output.metadata);
  const direct = safeString(evidence.providerId) ?? safeString(metadata.providerId);
  if (direct) return direct;

  const producerId =
    safeString(evidence.producerId) ??
    safeString(safeRecord(evidence.producerRequest).producerId) ??
    safeString(safeRecord(evidence.producerRequest).id);
  if (!producerId) return null;
  return PROVIDER_MANIFEST_BY_PRODUCER_ID.get(producerId)?.providerId ?? null;
}

function missingRequirementsFromEvidence(evidence: Record<string, unknown>) {
  const direct = safeArray(evidence.missingRequirements).filter((value): value is string => typeof value === "string");
  const details = safeArray(evidence.availabilityDetails).flatMap((detail) =>
    safeArray(safeRecord(detail).missingRequirements).filter((value): value is string => typeof value === "string")
  );
  return uniqueStrings([...direct, ...details]);
}

function traceIdsFromTrace(trace: Array<Record<string, unknown>> | Array<unknown>) {
  return uniqueStrings(trace.map((event) => safeString(safeRecord(event).traceId) ?? safeString(safeRecord(event).id)));
}

function blockersFromGap(record: CapabilityGapRecord) {
  const evidence = safeRecord(record.evidence);
  const missingRequirements = missingRequirementsFromEvidence(evidence);
  const blockers: string[] = [];
  if (record.status === "blocked" || safeArray(evidence.policyBlockers).length > 0) blockers.push("policy_blocked");
  if (record.missingApprovalPath || Object.keys(record.requiredApprovalPolicy).length > 0) blockers.push("approval_required");
  if (evidence.producerResultState === "approval_required") blockers.push("approval_required");
  if (record.kind === "missing_external_configuration") blockers.push("config_required");
  if (missingRequirements.some((item) => item.startsWith("env:"))) blockers.push("config_required");
  if (missingRequirements.some((item) => item.startsWith("input:"))) blockers.push("missing_input");
  if (/adapter/i.test(record.currentLimitation ?? record.description)) blockers.push("adapter_missing");
  if (record.kind === "missing_connector") blockers.push("adapter_missing");
  if (record.kind === "missing_tool" && blockers.length === 0) blockers.push("local_unavailable");
  if (record.kind === "missing_model_capability" && blockers.length === 0) blockers.push("external_unavailable");
  return uniqueStrings(blockers.length > 0 ? blockers : ["open"]);
}

function seedFromGap(record: CapabilityGapRecord): GapSeed {
  const evidence = safeRecord(record.evidence);
  const sourceLocator = safeRecord(evidence.sourceLocator);
  const providerId = inferProviderIdFromEvidence(evidence);
  return {
    capabilityId: record.neededCapability,
    capabilityLabel: capabilityLabel(record.neededCapability),
    providerId,
    providerLabel: providerLabel(providerId),
    category: categoryFor({
      capabilityId: record.neededCapability,
      providerId,
      missingPayloadType: record.missingPayloadType,
      kind: record.kind,
      missingConnector: record.missingConnector,
    }),
    priority: record.severity,
    conversationId: record.conversationId,
    conversationDocumentId: record.conversationDocumentId,
    sourceLocator: Object.keys(sourceLocator).length > 0 ? sourceLocator : null,
    firstSeenAt: record.firstSeenAt,
    lastSeenAt: record.lastSeenAt,
    evidenceSummary:
      safeString(evidence.evidenceSummary) ??
      safeString(evidence.reason) ??
      record.currentLimitation ??
      record.description,
    recommendedAction:
      record.recommendedResolution ??
      recommendedActionForBlockers(blockersFromGap(record), providerId),
    blockers: blockersFromGap(record),
    traceIds: traceIdsFromTrace(record.traceEvents),
    relatedGapRecordIds: [record.id],
    relatedDebtRecordIds: record.relatedContextDebtId ? [record.relatedContextDebtId] : [],
    relatedCoverageRecordIds: [],
    providerStatus: null,
    localCandidateId: record.missingToolId ?? record.missingPayloadType ?? null,
  };
}

function blockersFromDebt(record: ContextDebtRecord) {
  const blockers: string[] = [];
  if (record.status === "blocked_by_policy" || record.policyBlockers.length > 0) blockers.push("policy_blocked");
  if (record.status === "waiting_for_approval" || record.requiredApprovalReasons.length > 0) blockers.push("approval_required");
  if (record.deferredCapabilities.some((capability) => /ocr|vision|document_ai/i.test(capability))) {
    blockers.push("external_unavailable");
  }
  if (/config|env/i.test(record.description)) blockers.push("config_required");
  if (/input|image/i.test(record.description)) blockers.push("missing_input");
  if (/adapter|connector/i.test(record.description)) blockers.push("adapter_missing");
  return uniqueStrings(blockers.length > 0 ? blockers : ["open"]);
}

function seedFromDebt(record: ContextDebtRecord): GapSeed {
  const capabilityId =
    record.deferredCapabilities[0] ??
    safeString(record.sourceCoverageTarget.capabilityId) ??
    record.kind;
  const providerId = inferProviderIdFromEvidence(record.evidence);
  const blockers = blockersFromDebt(record);
  return {
    capabilityId,
    capabilityLabel: capabilityLabel(capabilityId),
    providerId,
    providerLabel: providerLabel(providerId),
    category: categoryFor({ capabilityId, providerId, kind: record.kind }),
    priority: record.severity,
    conversationId: record.conversationId,
    conversationDocumentId: record.conversationDocumentId,
    sourceLocator: Object.keys(record.sourceLocator).length > 0 ? record.sourceLocator : null,
    firstSeenAt: record.firstSeenAt,
    lastSeenAt: record.lastSeenAt,
    evidenceSummary: record.whyItMatters ?? record.description,
    recommendedAction: recommendedActionForBlockers(blockers, providerId),
    blockers,
    traceIds: traceIdsFromTrace(record.traceEvents),
    relatedGapRecordIds: [],
    relatedDebtRecordIds: [record.id],
    relatedCoverageRecordIds: [],
    providerStatus: null,
    localCandidateId: capabilityId,
  };
}

function seedFromCoverage(record: SourceCoverageRecord): GapSeed | null {
  if (!["unknown", "uninspected", "partially_inspected", "inspected_with_limitations", "stale", "blocked"].includes(record.coverageStatus)) {
    return null;
  }
  const target = safeRecord(record.coverageTarget);
  const capabilityId = safeString(target.capabilityId) ?? safeString(target.target) ?? "source_coverage";
  const blockers = record.coverageStatus === "blocked" ? ["policy_blocked"] : ["local_unavailable"];
  return {
    capabilityId,
    capabilityLabel: capabilityLabel(capabilityId),
    providerId: null,
    providerLabel: null,
    category: categoryFor({ capabilityId, kind: record.sourceScope }),
    priority: record.coverageStatus === "blocked" ? "high" : "medium",
    conversationId: record.conversationId,
    conversationDocumentId: record.conversationDocumentId,
    sourceLocator: Object.keys(record.sourceLocator).length > 0 ? record.sourceLocator : null,
    firstSeenAt: record.createdAt,
    lastSeenAt: record.updatedAt,
    evidenceSummary: record.limitations[0] ?? `Source coverage remains ${record.coverageStatus}.`,
    recommendedAction: recommendedActionForBlockers(blockers, null),
    blockers,
    traceIds: traceIdsFromTrace(record.traceEvents),
    relatedGapRecordIds: [],
    relatedDebtRecordIds: record.relatedDebtIds,
    relatedCoverageRecordIds: [record.id],
    providerStatus: null,
    localCandidateId: capabilityId,
  };
}

function seedFromProducerResult(result: SourceObservationProducerResult): GapSeed | null {
  if (result.state === "completed_with_evidence" || result.state === "skipped") return null;
  const providerId =
    safeString(safeRecord(result.output?.metadata).providerId) ??
    PROVIDER_MANIFEST_BY_PRODUCER_ID.get(result.producerId ?? "")?.providerId ??
    null;
  const blockers = uniqueStrings([
    result.state === "approval_required" || result.resolution.requiresApproval ? "approval_required" : null,
    result.state === "blocked_by_policy" || result.resolution.blockedByPolicy ? "policy_blocked" : null,
    result.resolution.missingRequirements.some((item) => item.startsWith("env:")) ? "config_required" : null,
    result.resolution.missingRequirements.some((item) => item.startsWith("input:")) ? "missing_input" : null,
    result.state === "deferred" ? "deferred" : null,
    result.state === "unavailable" || result.state === "catalog_only" ? "external_unavailable" : null,
  ]);
  const normalizedBlockers = blockers.length > 0 ? blockers : ["open"];
  return {
    capabilityId: result.capabilityId,
    capabilityLabel: capabilityLabel(result.capabilityId),
    providerId,
    providerLabel: providerLabel(providerId),
    category: categoryFor({
      capabilityId: result.capabilityId,
      providerId,
      missingPayloadType: result.resolution.payloadType,
    }),
    priority: result.request.severity ?? (result.request.priority === "critical" ? "critical" : "medium"),
    conversationId: result.request.conversationId ?? null,
    conversationDocumentId: result.request.conversationDocumentId ?? null,
    sourceLocator: result.resolution.sourceLocator ?? result.request.sourceLocator ?? null,
    firstSeenAt: null,
    lastSeenAt: null,
    evidenceSummary: result.evidence?.summary || result.resolution.reason,
    recommendedAction: recommendedActionForBlockers(normalizedBlockers, providerId),
    blockers: normalizedBlockers,
    traceIds: uniqueStrings([result.request.traceId, result.resolution.traceId]),
    relatedGapRecordIds: [],
    relatedDebtRecordIds: [],
    relatedCoverageRecordIds: [],
    providerStatus: null,
    localCandidateId: result.producerId ?? result.request.producerId ?? result.capabilityId,
  };
}

function blockersFromProviderStatus(status: UploadedDocumentExternalProviderStatus) {
  return uniqueStrings([
    status.policyBlocked ? "policy_blocked" : null,
    status.approvalRequired ? "approval_required" : null,
    status.configRequired || status.unconfigured ? "config_required" : null,
    status.blockedByMissingImageInput ? "missing_input" : null,
    status.deferredBecauseSafeAdapterMissing ? "adapter_missing" : null,
    status.availabilityState === "deferred_adapter_missing" ? "adapter_missing" : null,
    status.availabilityState === "catalog_only" || status.availabilityState === "unavailable" ? "external_unavailable" : null,
    status.availabilityState === "failed" ? "deferred" : null,
  ]);
}

function seedFromProviderStatus(status: UploadedDocumentExternalProviderStatus, conversationId?: string | null, documentId?: string | null): GapSeed | null {
  if (!status.taskRelevant) return null;
  if (status.localSufficient || status.availabilityState === "completed_with_evidence" || status.availabilityState === "skipped_local_sufficient") {
    return null;
  }
  const blockers = blockersFromProviderStatus(status);
  return {
    capabilityId: status.capabilityId,
    capabilityLabel: capabilityLabel(status.capabilityId),
    providerId: status.providerId,
    providerLabel: status.providerName,
    category: categoryFor({ capabilityId: status.capabilityId, providerId: status.providerId }),
    priority: status.policyBlocked ? "high" : "medium",
    conversationId: conversationId ?? null,
    conversationDocumentId: documentId ?? null,
    sourceLocator: null,
    firstSeenAt: null,
    lastSeenAt: null,
    evidenceSummary: status.reason,
    recommendedAction: recommendedActionForBlockers(blockers, status.providerId),
    blockers: blockers.length > 0 ? blockers : ["open"],
    traceIds: [],
    relatedGapRecordIds: [],
    relatedDebtRecordIds: [],
    relatedCoverageRecordIds: [],
    providerStatus: status,
    localCandidateId: null,
  };
}

function recommendedActionForBlockers(blockers: string[], providerId: string | null) {
  if (blockers.includes("policy_blocked")) return "Review policy/data-class eligibility; approval cannot override this blocker.";
  if (blockers.includes("config_required")) return providerId
    ? `Configure ${providerLabel(providerId) ?? providerId} before execution can be considered.`
    : "Add the missing provider/runtime configuration before execution can be considered.";
  if (blockers.includes("adapter_missing")) return "Add a real governed adapter/runtime in a future work package.";
  if (blockers.includes("missing_input")) return "Provide the required source input, such as a rendered page image, before execution can be considered.";
  if (blockers.includes("approval_required")) return "Approve the eligible capability scope to clear only the approval gate.";
  if (blockers.includes("external_unavailable")) return "Track the provider capability as unavailable until configuration, adapter, input, and policy gates are satisfied.";
  if (blockers.includes("local_unavailable")) return "Track the local capability gap; do not claim execution until completed evidence exists.";
  return "Keep this capability gap visible until a trace-backed producer completes with evidence.";
}

function statusFromBlockers(blockers: string[], approved: boolean): CapabilityGapApprovalStatus {
  if (blockers.includes("policy_blocked")) return "policy_blocked";
  if (blockers.includes("missing_input")) return "missing_input";
  if (blockers.includes("config_required")) return "config_required";
  if (blockers.includes("adapter_missing")) return "adapter_missing";
  if (blockers.includes("approval_required")) return "approval_required";
  if (approved) return "approved";
  if (blockers.includes("external_unavailable")) return "external_unavailable";
  if (blockers.includes("local_unavailable")) return "local_unavailable";
  if (blockers.includes("deferred")) return "deferred";
  return "open";
}

function providerReadinessStatus(status: UploadedDocumentExternalProviderStatus | null, blockers: string[]): CapabilityProviderReadinessStatus {
  if (status?.availabilityState === "completed_with_evidence") return "completed_with_evidence";
  if (blockers.includes("policy_blocked")) return "policy_blocked";
  if (blockers.includes("missing_input")) return "missing_input";
  if (blockers.includes("config_required")) return "config_required";
  if (blockers.includes("adapter_missing")) return "adapter_missing";
  if (blockers.includes("approval_required")) return "approval_required";
  if (status?.availabilityState === "mock_tested_callable_only") return "mock_tested_callable";
  if (status?.availabilityState === "runtime_callable_when_configured") return "runtime_callable_when_configured";
  if (status?.availabilityState === "unconfigured") return "unconfigured";
  return "deferred";
}

function providerCandidateFromSeed(seed: GapSeed, blockers: string[]): CapabilityGapCandidateProviderSummary | null {
  if (!seed.providerId) return null;
  const manifest = PROVIDER_MANIFEST_BY_ID.get(seed.providerId);
  return {
    providerId: seed.providerId,
    providerLabel: seed.providerLabel ?? manifest?.providerName ?? seed.providerId,
    status: providerReadinessStatus(seed.providerStatus, blockers),
    blockers,
    canApproveNow: blockers.includes("approval_required") && !blockers.includes("policy_blocked"),
    requiresConfig: blockers.includes("config_required"),
    requiresAdapter: blockers.includes("adapter_missing"),
    requiresInput: blockers.includes("missing_input"),
    requiresPolicyChange: blockers.includes("policy_blocked"),
    externalDataEgress: seed.providerStatus?.externalDataEgress ?? manifest?.externalDataEgress ?? true,
  };
}

function manifestCandidate(capabilityId: string, approvals: CapabilityApprovalDecisionRecord[], env: EnvLike): CapabilityGapCandidateProviderSummary[] {
  return APPROVED_UPLOADED_DOCUMENT_EXTERNAL_PRODUCER_MANIFESTS
    .filter((manifest) => manifest.capabilityId === capabilityId)
    .map((manifest) => {
      const hasConfig = manifest.requiredConfigEnvKeyGroups.length === 0 ||
        manifest.requiredConfigEnvKeyGroups.some((group) => group.every((key) => Boolean(env[key]?.trim())));
      const approved = approvals.some((decision) =>
        decision.approved &&
        decision.capabilityId === manifest.capabilityId &&
        (!decision.providerId || decision.providerId === manifest.providerId)
      );
      const blockers = uniqueStrings([
        manifest.approvalRequired && !approved ? "approval_required" : null,
        !hasConfig && manifest.requiredConfigEnvKeys.length > 0 ? "config_required" : null,
        manifest.requiresImageInput ? "missing_input" : null,
        manifest.deferredBecauseSafeAdapterMissing ? "adapter_missing" : null,
        !manifest.runtimeCallableWhenConfigured && !manifest.mockTestedCallableOnly ? "external_unavailable" : null,
      ]);
      return {
        providerId: manifest.providerId,
        providerLabel: manifest.providerName,
        status: providerReadinessStatus(null, blockers),
        blockers,
        canApproveNow: blockers.includes("approval_required") && !blockers.includes("policy_blocked"),
        requiresConfig: blockers.includes("config_required"),
        requiresAdapter: blockers.includes("adapter_missing"),
        requiresInput: blockers.includes("missing_input"),
        requiresPolicyChange: blockers.includes("policy_blocked"),
        externalDataEgress: manifest.externalDataEgress,
      } satisfies CapabilityGapCandidateProviderSummary;
    });
}

function rowGroupKey(seed: GapSeed) {
  if (seed.providerId) {
    return `capability:${normalizeKeySegment(seed.capabilityId)}:provider:${normalizeKeySegment(seed.providerId)}`;
  }
  if (seed.conversationDocumentId) {
    return `capability:${normalizeKeySegment(seed.capabilityId)}:document:${normalizeKeySegment(seed.conversationDocumentId)}`;
  }
  return `capability:${normalizeKeySegment(seed.capabilityId)}`;
}

export function buildCapabilityApprovalKey(params: {
  capabilityId: string;
  providerId?: string | null;
  scope: CapabilityApprovalScope;
  scopeId?: string | null;
}) {
  return [
    "capability-approval",
    normalizeKeySegment(params.scope),
    normalizeKeySegment(params.scopeId ?? null),
    normalizeKeySegment(params.capabilityId),
    normalizeKeySegment(params.providerId ?? null),
  ].join(":");
}

export function hydrateCapabilityApprovalDecision(record: ApprovalPrismaRecord): CapabilityApprovalDecisionRecord {
  return {
    id: String(record.id),
    approvalKey: String(record.approvalKey),
    capabilityId: String(record.capabilityId),
    providerId: (record.providerId as string | null) ?? null,
    scope: isCapabilityApprovalScope(record.scope) ? record.scope : "conversation",
    scopeId: (record.scopeId as string | null) ?? null,
    approved: Boolean(record.approved),
    reason: (record.reason as string | null) ?? null,
    approvedById: (record.approvedById as string | null) ?? null,
    conversationId: (record.conversationId as string | null) ?? null,
    conversationDocumentId: (record.conversationDocumentId as string | null) ?? null,
    relatedGapRecordId: (record.relatedGapRecordId as string | null) ?? null,
    traceId: (record.traceId as string | null) ?? null,
    createdAt: toIso(record.createdAt),
    updatedAt: toIso(record.updatedAt),
  };
}

export function hasCapabilityApprovalDecisionPrismaDelegate(client: unknown = prisma) {
  return Boolean((client as CapabilityApprovalPrismaClient).capabilityApprovalDecision);
}

export async function listCapabilityApprovalDecisionsForScopes(params: {
  conversationId?: string | null;
  conversationDocumentIds?: string[] | null;
  capabilityIds?: string[] | null;
  providerIds?: string[] | null;
  client?: CapabilityApprovalPrismaClient;
}) {
  const client = params.client ?? (prisma as unknown as CapabilityApprovalPrismaClient);
  if (!client.capabilityApprovalDecision) return [];
  const conversationDocumentIds = uniqueStrings(params.conversationDocumentIds ?? []);
  const capabilityIds = uniqueStrings(params.capabilityIds ?? []);
  const providerIds = uniqueStrings(params.providerIds ?? []);
  const or = [
    params.conversationId ? { scope: "conversation", scopeId: params.conversationId } : null,
    conversationDocumentIds.length > 0 ? { scope: "document", scopeId: { in: conversationDocumentIds } } : null,
    capabilityIds.length > 0 ? { scope: "capability", capabilityId: { in: capabilityIds } } : null,
    providerIds.length > 0 ? { scope: "provider", providerId: { in: providerIds } } : null,
    params.conversationId ? { conversationId: params.conversationId } : null,
    conversationDocumentIds.length > 0 ? { conversationDocumentId: { in: conversationDocumentIds } } : null,
  ].filter(Boolean);
  if (or.length === 0) return [];
  if (!(await approvalDecisionTableExists(client))) return [];
  let records: ApprovalPrismaRecord[];
  try {
    records = await client.capabilityApprovalDecision.findMany({
      where: { OR: or },
      orderBy: [{ updatedAt: "desc" }],
      take: 200,
    });
  } catch (error) {
    if (isPrismaMissingApprovalTableError(error)) return [];
    throw error;
  }
  return records.map(hydrateCapabilityApprovalDecision);
}

export async function upsertCapabilityApprovalDecision(params: {
  capabilityId: string;
  providerId?: string | null;
  approved: boolean;
  scope: CapabilityApprovalScope;
  scopeId?: string | null;
  reason?: string | null;
  approvedById?: string | null;
  conversationId?: string | null;
  conversationDocumentId?: string | null;
  relatedGapRecordId?: string | null;
  traceId?: string | null;
  client?: CapabilityApprovalPrismaClient;
}) {
  const client = params.client ?? (prisma as unknown as CapabilityApprovalPrismaClient);
  if (!client.capabilityApprovalDecision) {
    throw new Error("Capability approval decision storage is unavailable. Run the WP4A4 migration first.");
  }
  const approvalKey = buildCapabilityApprovalKey(params);
  const create = {
    approvalKey,
    capabilityId: params.capabilityId,
    providerId: params.providerId ?? null,
    scope: params.scope,
    scopeId: params.scopeId ?? null,
    approved: params.approved,
    reason: params.reason ?? null,
    approvedById: params.approvedById ?? null,
    conversationId: params.conversationId ?? (params.scope === "conversation" ? params.scopeId ?? null : null),
    conversationDocumentId: params.conversationDocumentId ?? (params.scope === "document" ? params.scopeId ?? null : null),
    relatedGapRecordId: params.relatedGapRecordId ?? null,
    traceId: params.traceId ?? null,
  };
  const record = await client.capabilityApprovalDecision.upsert({
    where: { approvalKey },
    create,
    update: {
      approved: params.approved,
      reason: params.reason ?? null,
      approvedById: params.approvedById ?? null,
      conversationId: create.conversationId,
      conversationDocumentId: create.conversationDocumentId,
      relatedGapRecordId: params.relatedGapRecordId ?? null,
      traceId: params.traceId ?? null,
    },
  });
  return hydrateCapabilityApprovalDecision(record);
}

function decisionMatchesScope(decision: CapabilityApprovalDecisionRecord, seed: GapSeed) {
  if (!decision.approved) return false;
  if (decision.scope === "conversation") {
    return Boolean(decision.scopeId && decision.scopeId === seed.conversationId);
  }
  if (decision.scope === "document") {
    return Boolean(decision.scopeId && decision.scopeId === seed.conversationDocumentId);
  }
  if (decision.scope === "provider") {
    return Boolean(decision.providerId && decision.providerId === seed.providerId);
  }
  if (decision.scope === "capability") {
    return decision.capabilityId === seed.capabilityId;
  }
  if (decision.scope === "one_time") {
    return Boolean(decision.relatedGapRecordId && seed.relatedGapRecordIds.includes(decision.relatedGapRecordId));
  }
  return false;
}

function decisionMatchesSeed(decision: CapabilityApprovalDecisionRecord, seed: GapSeed) {
  if (decision.capabilityId !== seed.capabilityId) return false;
  if (decision.providerId && seed.providerId && decision.providerId !== seed.providerId) return false;
  if (decision.providerId && !seed.providerId) return false;
  return decisionMatchesScope(decision, seed);
}

function applyApprovalToBlockers(blockers: string[], approved: boolean) {
  if (!approved) return blockers;
  return blockers.filter((blocker) => blocker !== "approval_required");
}

function approvalScopesForSeeds(seeds: GapSeed[]) {
  const scopes: CapabilityApprovalScope[] = [];
  if (seeds.some((seed) => seed.conversationId)) scopes.push("conversation");
  if (seeds.some((seed) => seed.conversationDocumentId)) scopes.push("document");
  if (seeds.some((seed) => seed.providerId)) scopes.push("provider");
  scopes.push("capability");
  return SUPPORTED_APPROVAL_SCOPES.filter((scope) => scopes.includes(scope));
}

function providerIdsFromRows(rows: CapabilityGapApprovalSummaryRow[]) {
  return uniqueStrings(rows.flatMap((row) => [
    row.providerId,
    ...row.candidateProviders.map((candidate) => candidate.providerId),
  ]));
}

export function buildCapabilityGapApprovalCenterSummary(params: {
  registry?: ContextRegistrySelection | null;
  contextDebtRecords?: ContextDebtRecord[] | null;
  capabilityGapRecords?: CapabilityGapRecord[] | null;
  sourceCoverageRecords?: SourceCoverageRecord[] | null;
  producerResults?: SourceObservationProducerResult[] | null;
  providerStatuses?: UploadedDocumentExternalProviderStatus[] | null;
  approvals?: CapabilityApprovalDecisionRecord[] | null;
  conversationId?: string | null;
  conversationDocumentId?: string | null;
  includeResolved?: boolean | null;
  env?: EnvLike | null;
  nowIso?: string | null;
}): CapabilityGapApprovalCenterSummary {
  const registry = params.registry;
  const seeds = [
    ...(params.capabilityGapRecords ?? registry?.capabilityGapRecords ?? []).map(seedFromGap),
    ...(params.contextDebtRecords ?? registry?.contextDebtRecords ?? []).map(seedFromDebt),
    ...(params.sourceCoverageRecords ?? registry?.sourceCoverageRecords ?? []).flatMap((record) => {
      const seed = seedFromCoverage(record);
      return seed ? [seed] : [];
    }),
    ...(params.producerResults ?? []).flatMap((result) => {
      const seed = seedFromProducerResult(result);
      return seed ? [seed] : [];
    }),
    ...(params.providerStatuses ?? []).flatMap((status) => {
      const seed = seedFromProviderStatus(status, params.conversationId, params.conversationDocumentId);
      return seed ? [seed] : [];
    }),
  ];

  const byGroup = new Map<string, GapSeed[]>();
  for (const seed of seeds) {
    const group = rowGroupKey(seed);
    byGroup.set(group, [...(byGroup.get(group) ?? []), seed]);
  }

  const approvals = params.approvals ?? [];
  const env = params.env ?? {};
  const rows = [...byGroup.entries()].map(([summaryId, groupSeeds]) => {
    const sortedSeeds = [...groupSeeds].sort((left, right) => {
      const priorityDiff = priorityRank(right.priority) - priorityRank(left.priority);
      if (priorityDiff !== 0) return priorityDiff;
      return String(right.lastSeenAt ?? "").localeCompare(String(left.lastSeenAt ?? ""));
    });
    const primary = sortedSeeds[0];
    const matchingApprovals = approvals
      .filter((decision) => sortedSeeds.some((seed) => decisionMatchesSeed(decision, seed)))
      .sort((left, right) => right.updatedAt.localeCompare(left.updatedAt));
    const activeApproval = matchingApprovals.find((decision) => decision.approved) ?? null;
    const allBlockers = uniqueStrings(sortedSeeds.flatMap((seed) => seed.blockers));
    const remainingBlockers = applyApprovalToBlockers(allBlockers, Boolean(activeApproval));
    const status = statusFromBlockers(remainingBlockers, Boolean(activeApproval));
    const providerCandidates = uniqueProviderCandidates([
      ...sortedSeeds.flatMap((seed) => {
        const blockers = applyApprovalToBlockers(seed.blockers, Boolean(activeApproval));
        const candidate = providerCandidateFromSeed(seed, blockers);
        return candidate ? [candidate] : [];
      }),
      ...manifestCandidate(primary.capabilityId, approvals, env).filter((candidate) =>
        primary.providerId ? candidate.providerId === primary.providerId : true
      ),
    ]).slice(0, 5);
    const row: CapabilityGapApprovalSummaryRow = {
      summaryId,
      capabilityId: primary.capabilityId,
      capabilityLabel: primary.capabilityLabel,
      providerId: primary.providerId,
      providerLabel: primary.providerLabel,
      category: primary.category,
      status,
      priority: sortedSeeds.reduce((highest, seed) =>
        priorityRank(seed.priority) > priorityRank(highest) ? seed.priority : highest, primary.priority),
      occurrenceCount: sortedSeeds.length,
      affectedConversationIds: uniqueStrings(sortedSeeds.map((seed) => seed.conversationId)),
      affectedDocumentIds: uniqueStrings(sortedSeeds.map((seed) => seed.conversationDocumentId)),
      sourceLocators: sortedSeeds.flatMap((seed) => seed.sourceLocator ? [seed.sourceLocator] : []).slice(0, 10),
      firstSeenAt: sortedSeeds
        .map((seed) => seed.firstSeenAt)
        .filter((value): value is string => Boolean(value))
        .sort()[0] ?? null,
      lastSeenAt: sortedSeeds
        .map((seed) => seed.lastSeenAt)
        .filter((value): value is string => Boolean(value))
        .sort()
        .at(-1) ?? null,
      evidenceSummary: sortedSeeds.map((seed) => seed.evidenceSummary).filter(Boolean)[0] ?? "Capability gap is tracked without raw output.",
      recommendedAction: recommendedActionForBlockers(remainingBlockers, primary.providerId),
      remainingBlockers,
      approvalState: {
        approved: Boolean(activeApproval),
        decisionId: activeApproval?.id ?? null,
        scope: activeApproval?.scope ?? null,
        scopeId: activeApproval?.scopeId ?? null,
        providerId: activeApproval?.providerId ?? null,
        approvedById: activeApproval?.approvedById ?? null,
        reason: activeApproval?.reason ?? null,
        updatedAt: activeApproval?.updatedAt ?? null,
      },
      approvalScopesAvailable: approvalScopesForSeeds(sortedSeeds),
      canApproveNow: allBlockers.includes("approval_required") && !allBlockers.includes("policy_blocked"),
      approvalWillEnableExecution: false,
      approvalWillOnlyClearApprovalGate: allBlockers.includes("approval_required"),
      candidateProviders: providerCandidates,
      localCandidates: uniqueStrings(sortedSeeds.map((seed) => seed.localCandidateId)).map((candidateId) => ({
        candidateId,
        label: capabilityLabel(candidateId),
        status: remainingBlockers.includes("local_unavailable") ? "unavailable" : "deferred",
        blockers: remainingBlockers,
      })),
      traceIds: uniqueStrings(sortedSeeds.flatMap((seed) => seed.traceIds)),
      relatedGapRecordIds: uniqueStrings(sortedSeeds.flatMap((seed) => seed.relatedGapRecordIds)),
      relatedDebtRecordIds: uniqueStrings(sortedSeeds.flatMap((seed) => seed.relatedDebtRecordIds)),
      relatedCoverageRecordIds: uniqueStrings(sortedSeeds.flatMap((seed) => seed.relatedCoverageRecordIds)),
    };
    return row;
  }).filter((row) => params.includeResolved || row.status !== "resolved")
    .sort((left, right) => {
      const statusDiff = statusRank(right.status) - statusRank(left.status);
      if (statusDiff !== 0) return statusDiff;
      const priorityDiff = priorityRank(right.priority) - priorityRank(left.priority);
      if (priorityDiff !== 0) return priorityDiff;
      return String(right.lastSeenAt ?? "").localeCompare(String(left.lastSeenAt ?? ""));
    });

  const debug = buildCapabilityGapApprovalDebugSummary(rows);
  return {
    generatedAt: params.nowIso ?? new Date().toISOString(),
    rows,
    counts: {
      total: rows.length,
      approvalRequired: debug.approvalRequiredCount,
      approved: debug.approvedCount,
      configRequired: debug.configRequiredCount,
      adapterMissing: debug.adapterMissingCount,
      missingInput: debug.missingInputCount,
      policyBlocked: debug.policyBlockedCount,
      resolved: rows.filter((row) => row.status === "resolved").length,
    },
    debug,
    noRawOutputExposed: true,
    noExecutionClaimed: true,
  };
}

function uniqueProviderCandidates(candidates: CapabilityGapCandidateProviderSummary[]) {
  const byId = new Map<string, CapabilityGapCandidateProviderSummary>();
  for (const candidate of candidates) {
    const existing = byId.get(candidate.providerId);
    if (!existing || candidate.blockers.length > existing.blockers.length) {
      byId.set(candidate.providerId, candidate);
    }
  }
  return [...byId.values()];
}

export function buildCapabilityGapApprovalDebugSummary(
  rows: CapabilityGapApprovalSummaryRow[]
): CapabilityGapApprovalCenterDebugSummary {
  const categories = new Map<CapabilityGapApprovalCategory, number>();
  for (const row of rows) {
    categories.set(row.category, (categories.get(row.category) ?? 0) + 1);
  }
  return {
    groupedGapCount: rows.length,
    approvalRequiredCount: rows.filter((row) => row.status === "approval_required").length,
    approvedCount: rows.filter((row) => row.approvalState.approved).length,
    configRequiredCount: rows.filter((row) => row.remainingBlockers.includes("config_required")).length,
    adapterMissingCount: rows.filter((row) => row.remainingBlockers.includes("adapter_missing")).length,
    missingInputCount: rows.filter((row) => row.remainingBlockers.includes("missing_input")).length,
    policyBlockedCount: rows.filter((row) => row.remainingBlockers.includes("policy_blocked")).length,
    topCapabilityCategories: [...categories.entries()]
      .map(([category, count]) => ({ category, count }))
      .sort((left, right) => right.count - left.count)
      .slice(0, 5),
    approvalsConsumedThisTurn: rows
      .filter((row) => row.approvalState.approved && row.approvalWillOnlyClearApprovalGate)
      .map((row) => ({
        capabilityId: row.capabilityId,
        providerId: row.providerId,
        scope: row.approvalState.scope ?? "conversation",
        scopeId: row.approvalState.scopeId,
        clearedBlocker: "approval_required" as const,
        remainingBlockers: row.remainingBlockers,
      })),
    blockersRemainingAfterApproval: rows
      .filter((row) => row.approvalState.approved && row.remainingBlockers.length > 0)
      .map((row) => ({
        capabilityId: row.capabilityId,
        providerId: row.providerId,
        remainingBlockers: row.remainingBlockers,
      })),
    noExecutionWarning: APPROVAL_NO_EXECUTION_WARNING,
  };
}

export function buildApprovalAvailabilitySignalsFromDecisions(params: {
  requests: SourceObservationProducerRequest[];
  approvals: CapabilityApprovalDecisionRecord[];
}): SourceObservationProducerAvailabilitySignal[] {
  const signals: SourceObservationProducerAvailabilitySignal[] = [];
  for (const request of params.requests) {
    if (!request.approvalPath) continue;
    const seed: GapSeed = {
      capabilityId: request.requestedCapabilityId,
      capabilityLabel: capabilityLabel(request.requestedCapabilityId),
      providerId: request.input?.metadata && typeof request.input.metadata.providerId === "string"
        ? request.input.metadata.providerId
        : PROVIDER_MANIFEST_BY_PRODUCER_ID.get(request.producerId ?? "")?.providerId ?? null,
      providerLabel: null,
      category: categoryFor({ capabilityId: request.requestedCapabilityId }),
      priority: request.severity ?? "medium",
      conversationId: request.conversationId ?? null,
      conversationDocumentId: request.conversationDocumentId ?? null,
      sourceLocator: request.sourceLocator ?? null,
      firstSeenAt: null,
      lastSeenAt: null,
      evidenceSummary: request.reason,
      recommendedAction: "Approval signal built from durable governance state.",
      blockers: ["approval_required"],
      traceIds: uniqueStrings([request.traceId]),
      relatedGapRecordIds: [],
      relatedDebtRecordIds: [],
      relatedCoverageRecordIds: [],
      providerStatus: null,
      localCandidateId: request.producerId ?? null,
    };
    const approval = params.approvals.find((decision) => decisionMatchesSeed(decision, seed));
    if (!approval) continue;
    signals.push({
      id: `approval:${approval.id}:${request.id}`,
      source: "approval",
      status: "available",
      producerId: request.producerId ?? null,
      capabilityId: request.requestedCapabilityId,
      providerId: seed.providerId,
      payloadType: request.requestedPayloadType ?? null,
      sourceId: request.sourceId ?? null,
      conversationDocumentId: request.conversationDocumentId ?? null,
      reason: `Approval ${approval.id} satisfies approval path ${request.approvalPath} for this scope only.`,
      approvalPath: request.approvalPath,
      approvalSatisfied: true,
      approvalDecisionId: approval.id,
      noExecutionClaimed: true,
    });
  }
  return signals;
}

export function resolveUploadedDocumentExternalApprovalGrants(params: {
  approvals: CapabilityApprovalDecisionRecord[];
  conversationId?: string | null;
  conversationDocumentId?: string | null;
}) {
  const approvedProviderIds: UploadedDocumentExternalProviderId[] = [];
  const approvedCapabilityIds: UploadedDocumentExternalCapabilityId[] = [];
  for (const manifest of APPROVED_UPLOADED_DOCUMENT_EXTERNAL_PRODUCER_MANIFESTS) {
    const seed: GapSeed = {
      capabilityId: manifest.capabilityId,
      capabilityLabel: capabilityLabel(manifest.capabilityId),
      providerId: manifest.providerId,
      providerLabel: manifest.providerName,
      category: categoryFor({ capabilityId: manifest.capabilityId, providerId: manifest.providerId }),
      priority: "medium",
      conversationId: params.conversationId ?? null,
      conversationDocumentId: params.conversationDocumentId ?? null,
      sourceLocator: null,
      firstSeenAt: null,
      lastSeenAt: null,
      evidenceSummary: "External producer approval grant lookup.",
      recommendedAction: "Approval can clear only the approval gate.",
      blockers: ["approval_required"],
      traceIds: [],
      relatedGapRecordIds: [],
      relatedDebtRecordIds: [],
      relatedCoverageRecordIds: [],
      providerStatus: null,
      localCandidateId: null,
    };
    if (params.approvals.some((decision) => decisionMatchesSeed(decision, seed))) {
      approvedProviderIds.push(manifest.providerId);
      approvedCapabilityIds.push(manifest.capabilityId);
    }
  }
  return {
    approvedProviderIds: Array.from(new Set(approvedProviderIds)),
    approvedCapabilityIds: Array.from(new Set(approvedCapabilityIds)),
    approvalGranted: approvedProviderIds.length > 0 || approvedCapabilityIds.length > 0,
  };
}

export function providerIdsFromCapabilityApprovalSummary(summary: CapabilityGapApprovalCenterSummary) {
  return providerIdsFromRows(summary.rows);
}
