import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { getReadableConversationForUser } from "@/lib/chat";
import {
  buildCapabilityGapApprovalCenterSummary,
  listCapabilityApprovalDecisionsForScopes,
} from "@/lib/capability-gap-approval-summary";
import type {
  CapabilityGapApprovalCategory,
  CapabilityGapApprovalSummaryRow,
} from "@/lib/capability-gap-approval-types";
import {
  type CapabilityGapRecord,
  type ContextDebtRecord,
  type ContextRegistrySelection,
  type SourceCoverageRecord,
  selectOpenContextRegistryRecords,
} from "@/lib/capability-gap-context-debt-registry";
import { prisma } from "@/lib/prisma";
import { describeUnknownRuntimeError } from "@/lib/runtime-diagnostics";

export const dynamic = "force-dynamic";

const NO_STORE_HEADERS = {
  "Cache-Control": "no-store",
  Vary: "Cookie",
};

type CapabilityGapListQuery = {
  status: string | null;
  capabilityId: string | null;
  providerId: string | null;
  category: CapabilityGapApprovalCategory | null;
  blocker: string | null;
  q: string | null;
  limit: number;
  offset: number;
  detail: boolean;
};

const DEFAULT_CAPABILITY_GAP_LIMIT = 25;
const MAX_CAPABILITY_GAP_LIMIT = 100;

function boundedPositiveInt(value: string | null, fallback: number, max: number) {
  const parsed = Number.parseInt(value ?? "", 10);
  if (!Number.isFinite(parsed) || parsed <= 0) return fallback;
  return Math.min(parsed, max);
}

function boundedOffset(value: string | null) {
  const parsed = Number.parseInt(value ?? "", 10);
  if (!Number.isFinite(parsed) || parsed < 0) return 0;
  return Math.min(parsed, 1000);
}

export function parseCapabilityGapListQuery(url: URL): CapabilityGapListQuery {
  return {
    status: url.searchParams.get("status")?.trim() || null,
    capabilityId: url.searchParams.get("capabilityId")?.trim() || null,
    providerId: url.searchParams.get("providerId")?.trim() || null,
    category: (url.searchParams.get("category")?.trim() || null) as CapabilityGapApprovalCategory | null,
    blocker: url.searchParams.get("blocker")?.trim() || null,
    q: url.searchParams.get("q")?.trim().toLowerCase() || null,
    limit: boundedPositiveInt(url.searchParams.get("limit"), DEFAULT_CAPABILITY_GAP_LIMIT, MAX_CAPABILITY_GAP_LIMIT),
    offset: boundedOffset(url.searchParams.get("offset")),
    detail: url.searchParams.get("detail") === "true",
  };
}

function rowMatchesSearch(row: CapabilityGapApprovalSummaryRow, q: string | null) {
  if (!q) return true;
  const haystack = [
    row.summaryId,
    row.capabilityId,
    row.capabilityLabel,
    row.providerId,
    row.providerLabel,
    row.category,
    row.status,
    row.evidenceSummary,
    row.recommendedAction,
    ...row.remainingBlockers,
    ...row.traceIds,
    ...row.relatedGapRecordIds,
    ...row.relatedDebtRecordIds,
    ...row.relatedCoverageRecordIds,
  ].filter(Boolean).join(" ").toLowerCase();
  return haystack.includes(q);
}

export function filterCapabilityGapRows(rows: CapabilityGapApprovalSummaryRow[], query: CapabilityGapListQuery) {
  return rows.filter((row) =>
    (!query.status || row.status === query.status) &&
    (!query.capabilityId || row.capabilityId === query.capabilityId) &&
    (!query.providerId || row.providerId === query.providerId) &&
    (!query.category || row.category === query.category) &&
    (!query.blocker || row.remainingBlockers.includes(query.blocker)) &&
    rowMatchesSearch(row, query.q)
  );
}

export function paginateCapabilityGapRows(rows: CapabilityGapApprovalSummaryRow[], query: CapabilityGapListQuery) {
  const pageRows = rows.slice(query.offset, query.offset + query.limit);
  return {
    rows: pageRows,
    pagination: {
      limit: query.limit,
      offset: query.offset,
      totalRows: rows.length,
      returnedRows: pageRows.length,
      hasMore: query.offset + pageRows.length < rows.length,
      hiddenByPage: Math.max(0, rows.length - (query.offset + pageRows.length)),
    },
  };
}

function summarizeDebtRecord(record: ContextDebtRecord) {
  return {
    id: record.id,
    key: record.debtKey,
    kind: record.kind,
    status: record.status,
    severity: record.severity,
    conversationId: record.conversationId,
    conversationDocumentId: record.conversationDocumentId,
    title: record.title,
    sourceScope: record.sourceScope,
    resolutionPath: record.resolutionPath,
    requiredApprovalReasons: record.requiredApprovalReasons,
    policyBlockers: record.policyBlockers,
    traceEventCount: record.traceEvents.length,
    lastSeenAt: record.lastSeenAt,
  };
}

function asRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  return value as Record<string, unknown>;
}

function stringValue(value: unknown) {
  return typeof value === "string" && value.trim().length > 0 ? value : null;
}

function numberValue(value: unknown) {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function summarizeNativeRuntimeGapEvidence(evidence: Record<string, unknown>) {
  const trace = asRecord(evidence.nativeRuntimePayloadTrace);
  const locator = asRecord(trace?.locator);
  return {
    runtimeTraceState: stringValue(evidence.runtimeTraceState) ?? stringValue(trace?.state),
    runtimeExclusionReason: stringValue(evidence.runtimeExclusionReason) ?? stringValue(trace?.exclusionReason),
    runtimeSubreason: stringValue(evidence.runtimeSubreason) ?? stringValue(trace?.runtimeSubreason),
    providerTarget: stringValue(evidence.providerTarget) ?? stringValue(trace?.providerTarget),
    modelTarget: stringValue(evidence.modelTarget) ?? stringValue(trace?.modelTarget),
    transportPlanId: stringValue(evidence.transportPlanId) ?? stringValue(trace?.planId),
    requestFormat: stringValue(trace?.requestFormat),
    payloadId: stringValue(trace?.payloadId),
    payloadType: stringValue(trace?.payloadType),
    payloadKind: stringValue(trace?.kind),
    sourceObservationId: stringValue(trace?.sourceObservationId),
    sourceId: stringValue(trace?.sourceId),
    conversationDocumentId: stringValue(trace?.conversationDocumentId),
    pageNumberStart: numberValue(locator?.pageNumberStart),
    pageNumberEnd: numberValue(locator?.pageNumberEnd),
    mimeType: stringValue(trace?.mimeType),
    byteSize: numberValue(trace?.byteSize),
    width: numberValue(trace?.width),
    height: numberValue(trace?.height),
    noRawPayloadIncludedInTrace: trace?.noRawPayloadIncludedInTrace === true || evidence.noRawPayloadIncludedInTrace === true,
  };
}

function summarizeGapRecord(record: CapabilityGapRecord) {
  const nativeRuntimeEvidence = summarizeNativeRuntimeGapEvidence(record.evidence);
  return {
    id: record.id,
    key: record.gapKey,
    kind: record.kind,
    status: record.status,
    severity: record.severity,
    conversationId: record.conversationId,
    conversationDocumentId: record.conversationDocumentId,
    neededCapability: record.neededCapability,
    missingPayloadType: record.missingPayloadType,
    missingToolId: record.missingToolId,
    missingModelCapability: record.missingModelCapability,
    title: record.title,
    resolutionPath: record.resolutionPath,
    candidateModelCapabilities: record.candidateModelCapabilities,
    candidateContextLanes: record.candidateContextLanes,
    nativeRuntimeEvidence,
    traceEventCount: record.traceEvents.length,
    lastSeenAt: record.lastSeenAt,
  };
}

function summarizeCoverageRecord(record: SourceCoverageRecord) {
  return {
    id: record.id,
    key: record.coverageKey,
    coverageStatus: record.coverageStatus,
    conversationId: record.conversationId,
    conversationDocumentId: record.conversationDocumentId,
    sourceId: record.sourceId,
    sourceScope: record.sourceScope,
    coverageTarget: record.coverageTarget,
    inspectedBy: record.inspectedBy,
    limitations: record.limitations,
    traceEventCount: record.traceEvents.length,
    updatedAt: record.updatedAt,
  };
}

export function buildCapabilityGapRouteDetails(
  rows: CapabilityGapApprovalSummaryRow[],
  registry: ContextRegistrySelection
) {
  const debtIds = new Set(rows.flatMap((row) => row.relatedDebtRecordIds));
  const gapIds = new Set(rows.flatMap((row) => row.relatedGapRecordIds));
  const coverageIds = new Set(rows.flatMap((row) => row.relatedCoverageRecordIds));

  return {
    contextDebtRecords: registry.contextDebtRecords
      .filter((record) => debtIds.has(record.id))
      .map(summarizeDebtRecord),
    capabilityGapRecords: registry.capabilityGapRecords
      .filter((record) => gapIds.has(record.id))
      .map(summarizeGapRecord),
    sourceCoverageRecords: registry.sourceCoverageRecords
      .filter((record) => coverageIds.has(record.id))
      .map(summarizeCoverageRecord),
    noRawOutputExposed: true,
  };
}

async function getAccessibleDocumentScope(documentId: string, userId: string) {
  return prisma.conversationDocument.findFirst({
    where: {
      id: documentId,
      conversation: {
        archivedAt: null,
        members: {
          some: {
            userId,
            removedAt: null,
          },
        },
      },
    },
    select: {
      id: true,
      conversationId: true,
    },
  });
}

async function getAccessibleConversationIdsForProject(projectId: string, userId: string) {
  const conversations = await prisma.conversation.findMany({
    where: {
      chatProjectId: projectId,
      archivedAt: null,
      members: {
        some: {
          userId,
          removedAt: null,
        },
      },
    },
    select: { id: true },
    orderBy: { updatedAt: "desc" },
    take: 25,
  });
  return conversations.map((conversation) => conversation.id);
}

async function getRecentAccessibleConversationIds(userId: string) {
  const conversations = await prisma.conversation.findMany({
    where: {
      archivedAt: null,
      members: {
        some: {
          userId,
          removedAt: null,
        },
      },
    },
    select: { id: true },
    orderBy: { updatedAt: "desc" },
    take: 25,
  });
  return conversations.map((conversation) => conversation.id);
}

export async function GET(request: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401, headers: NO_STORE_HEADERS });
  }

  try {
    const url = new URL(request.url);
    const conversationId = url.searchParams.get("conversationId")?.trim() || null;
    const documentId = url.searchParams.get("documentId")?.trim() || null;
    const projectId = url.searchParams.get("projectId")?.trim() || null;
    const includeResolved = url.searchParams.get("includeResolved") === "true";
    const listQuery = parseCapabilityGapListQuery(url);

    let conversationIds: string[] = [];
    let documentIds: string[] = [];

    if (documentId) {
      const document = await getAccessibleDocumentScope(documentId, session.user.id);
      if (!document) {
        return NextResponse.json({ error: "Document not found" }, { status: 404, headers: NO_STORE_HEADERS });
      }
      conversationIds = [document.conversationId];
      documentIds = [document.id];
    } else if (conversationId) {
      const conversation = await getReadableConversationForUser(conversationId, session.user.id);
      if (!conversation) {
        return NextResponse.json({ error: "Conversation not found" }, { status: 404, headers: NO_STORE_HEADERS });
      }
      conversationIds = [conversation.id];
      documentIds = conversation.documents?.map((document) => document.id) ?? [];
    } else if (projectId) {
      conversationIds = await getAccessibleConversationIdsForProject(projectId, session.user.id);
    } else {
      conversationIds = await getRecentAccessibleConversationIds(session.user.id);
    }

    const registrySelections = await Promise.all(
      conversationIds.map((id) =>
        selectOpenContextRegistryRecords({
          conversationId: id,
          conversationDocumentIds: documentIds,
          maxRecords: Math.min(250, Math.max(25, listQuery.offset + listQuery.limit, listQuery.detail ? 100 : 25)),
        })
      )
    );
    const registry = {
      contextDebtRecords: registrySelections.flatMap((selection) => selection.contextDebtRecords),
      capabilityGapRecords: registrySelections.flatMap((selection) => selection.capabilityGapRecords),
      sourceCoverageRecords: registrySelections.flatMap((selection) => selection.sourceCoverageRecords),
      traceEvents: registrySelections.flatMap((selection) => selection.traceEvents),
    };
    const approvals = await listCapabilityApprovalDecisionsForScopes({
      conversationId: conversationIds.length === 1 ? conversationIds[0] : null,
      conversationDocumentIds: documentIds,
    });
    const summary = buildCapabilityGapApprovalCenterSummary({
      registry,
      approvals,
      includeResolved,
      conversationId: conversationIds.length === 1 ? conversationIds[0] : null,
      env: process.env,
    });
    const filteredRows = filterCapabilityGapRows(summary.rows, listQuery);
    const paginated = paginateCapabilityGapRows(filteredRows, listQuery);
    const details = listQuery.detail ? buildCapabilityGapRouteDetails(paginated.rows, registry) : null;

    return NextResponse.json(
      {
        summary: {
          ...summary,
          rows: paginated.rows,
          counts: {
            ...summary.counts,
            total: filteredRows.length,
          },
        },
        pagination: paginated.pagination,
        filters: {
          status: listQuery.status,
          capabilityId: listQuery.capabilityId,
          providerId: listQuery.providerId,
          category: listQuery.category,
          blocker: listQuery.blocker,
          q: listQuery.q,
          detail: listQuery.detail,
        },
        details,
        noRawOutputExposed: true,
        noExecutionClaimed: true,
      },
      { headers: NO_STORE_HEADERS }
    );
  } catch (error) {
    const runtimeError = describeUnknownRuntimeError(error);
    console.error("[capabilities/gaps][GET]", JSON.stringify({
      userId: session.user.id,
      errorName: runtimeError.name,
      errorMessage: runtimeError.message,
    }));
    return NextResponse.json({ error: "Failed to load capability gaps" }, { status: 500, headers: NO_STORE_HEADERS });
  }
}
