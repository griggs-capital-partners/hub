import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { getReadableConversationForUser } from "@/lib/chat";
import {
  APPROVED_UPLOADED_DOCUMENT_EXTERNAL_PRODUCER_MANIFESTS,
} from "@/lib/document-ingestion-external-producers";
import {
  buildCapabilityGapApprovalCenterSummary,
  isCapabilityApprovalScope,
  listCapabilityApprovalDecisionsForScopes,
  upsertCapabilityApprovalDecision,
} from "@/lib/capability-gap-approval-summary";
import { selectOpenContextRegistryRecords } from "@/lib/capability-gap-context-debt-registry";
import { prisma } from "@/lib/prisma";
import { describeUnknownRuntimeError } from "@/lib/runtime-diagnostics";
import type { CapabilityApprovalScope } from "@/lib/capability-gap-approval-types";

export const dynamic = "force-dynamic";

const NO_STORE_HEADERS = {
  "Cache-Control": "no-store",
  Vary: "Cookie",
};

type ApprovalPayload = {
  capabilityId?: unknown;
  providerId?: unknown;
  approved?: unknown;
  scope?: unknown;
  scopeId?: unknown;
  conversationId?: unknown;
  documentId?: unknown;
  reason?: unknown;
  relatedGapRecordId?: unknown;
};

function asString(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function supportedScope(scope: CapabilityApprovalScope) {
  return scope === "conversation" || scope === "document" || scope === "provider" || scope === "capability";
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

async function buildScopedSummary(params: {
  conversationId: string;
  documentIds: string[];
}) {
  const registry = await selectOpenContextRegistryRecords({
    conversationId: params.conversationId,
    conversationDocumentIds: params.documentIds,
  });
  const approvals = await listCapabilityApprovalDecisionsForScopes({
    conversationId: params.conversationId,
    conversationDocumentIds: params.documentIds,
  });
  return buildCapabilityGapApprovalCenterSummary({
    registry,
    approvals,
    conversationId: params.conversationId,
    env: process.env,
  });
}

export async function PATCH(request: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401, headers: NO_STORE_HEADERS });
  }

  try {
    const payload = (await request.json()) as ApprovalPayload;
    const capabilityId = asString(payload.capabilityId);
    const providerId = asString(payload.providerId);
    const scopeValue = asString(payload.scope);
    const conversationId = asString(payload.conversationId);
    const documentId = asString(payload.documentId);
    const relatedGapRecordId = asString(payload.relatedGapRecordId);
    const reason = asString(payload.reason);

    if (!capabilityId || !scopeValue || !isCapabilityApprovalScope(scopeValue) || typeof payload.approved !== "boolean") {
      return NextResponse.json(
        { error: "capabilityId, approved, and a valid approval scope are required." },
        { status: 400, headers: NO_STORE_HEADERS }
      );
    }
    if (!supportedScope(scopeValue)) {
      return NextResponse.json(
        { error: `Approval scope ${scopeValue} is not enabled in WP4A4.` },
        { status: 400, headers: NO_STORE_HEADERS }
      );
    }

    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { role: true },
    });
    const admin = user?.role === "admin";
    if ((scopeValue === "provider" || scopeValue === "capability") && !admin) {
      return NextResponse.json(
        { error: "Provider and capability-wide approvals require an admin role." },
        { status: 403, headers: NO_STORE_HEADERS }
      );
    }

    let resolvedConversationId = conversationId;
    let resolvedDocumentIds: string[] = [];
    let resolvedScopeId = asString(payload.scopeId);

    if (scopeValue === "document") {
      if (!documentId && !resolvedScopeId) {
        return NextResponse.json({ error: "Document approval requires documentId or scopeId." }, { status: 400, headers: NO_STORE_HEADERS });
      }
      const document = await getAccessibleDocumentScope(documentId ?? resolvedScopeId ?? "", session.user.id);
      if (!document) {
        return NextResponse.json({ error: "Document not found" }, { status: 404, headers: NO_STORE_HEADERS });
      }
      resolvedConversationId = document.conversationId;
      resolvedScopeId = document.id;
      resolvedDocumentIds = [document.id];
    } else if (scopeValue === "conversation") {
      if (!resolvedConversationId && !resolvedScopeId) {
        return NextResponse.json({ error: "Conversation approval requires conversationId or scopeId." }, { status: 400, headers: NO_STORE_HEADERS });
      }
      const conversation = await getReadableConversationForUser(resolvedConversationId ?? resolvedScopeId ?? "", session.user.id);
      if (!conversation) {
        return NextResponse.json({ error: "Conversation not found" }, { status: 404, headers: NO_STORE_HEADERS });
      }
      resolvedConversationId = conversation.id;
      resolvedScopeId = conversation.id;
      resolvedDocumentIds = conversation.documents?.map((document) => document.id) ?? [];
    } else {
      resolvedScopeId = scopeValue === "provider" ? providerId : capabilityId;
      if (conversationId) {
        const conversation = await getReadableConversationForUser(conversationId, session.user.id);
        if (!conversation) {
          return NextResponse.json({ error: "Conversation not found" }, { status: 404, headers: NO_STORE_HEADERS });
        }
        resolvedConversationId = conversation.id;
        resolvedDocumentIds = conversation.documents?.map((document) => document.id) ?? [];
      }
    }

    const catalogKnown = APPROVED_UPLOADED_DOCUMENT_EXTERNAL_PRODUCER_MANIFESTS.some((manifest) =>
      manifest.capabilityId === capabilityId && (!providerId || manifest.providerId === providerId)
    );
    const summary = resolvedConversationId
      ? await buildScopedSummary({ conversationId: resolvedConversationId, documentIds: resolvedDocumentIds })
      : buildCapabilityGapApprovalCenterSummary({
          approvals: [],
          providerStatuses: [],
          capabilityGapRecords: [],
          contextDebtRecords: [],
          sourceCoverageRecords: [],
          env: process.env,
        });
    const summaryRow = summary.rows.find((row) =>
      row.capabilityId === capabilityId && (!providerId || row.providerId === providerId)
    );
    if (!summaryRow && !catalogKnown) {
      return NextResponse.json(
        { error: "Capability/provider is not present in the current backlog or governed catalogue." },
        { status: 400, headers: NO_STORE_HEADERS }
      );
    }
    if (summaryRow?.remainingBlockers.includes("policy_blocked")) {
      return NextResponse.json(
        { error: "Policy-blocked capabilities cannot be approved by this WP4A4 route." },
        { status: 403, headers: NO_STORE_HEADERS }
      );
    }
    if (summaryRow && !summaryRow.canApproveNow && payload.approved) {
      return NextResponse.json(
        { error: `Approval cannot clear current blocker state: ${summaryRow.remainingBlockers.join(", ") || summaryRow.status}.` },
        { status: 400, headers: NO_STORE_HEADERS }
      );
    }

    const approval = await upsertCapabilityApprovalDecision({
      capabilityId,
      providerId,
      approved: payload.approved,
      scope: scopeValue,
      scopeId: resolvedScopeId,
      reason,
      approvedById: session.user.id,
      conversationId: resolvedConversationId,
      conversationDocumentId: scopeValue === "document" ? resolvedScopeId : null,
      relatedGapRecordId,
      traceId: summaryRow?.traceIds[0] ?? null,
    });
    const updatedApprovals = resolvedConversationId
      ? await listCapabilityApprovalDecisionsForScopes({
          conversationId: resolvedConversationId,
          conversationDocumentIds: resolvedDocumentIds,
        })
      : [approval];
    const updatedSummary = resolvedConversationId
      ? buildCapabilityGapApprovalCenterSummary({
          registry: await selectOpenContextRegistryRecords({
            conversationId: resolvedConversationId,
            conversationDocumentIds: resolvedDocumentIds,
          }),
          approvals: updatedApprovals,
          conversationId: resolvedConversationId,
          env: process.env,
        })
      : buildCapabilityGapApprovalCenterSummary({ approvals: updatedApprovals, env: process.env });

    return NextResponse.json(
      {
        approval,
        summaryRow: updatedSummary.rows.find((row) =>
          row.capabilityId === capabilityId && (!providerId || row.providerId === providerId)
        ) ?? null,
        noExecutionClaimed: true,
        noObservationCreated: true,
      },
      { headers: NO_STORE_HEADERS }
    );
  } catch (error) {
    const runtimeError = describeUnknownRuntimeError(error);
    console.error("[capabilities/approvals][PATCH]", JSON.stringify({
      userId: session.user.id,
      errorName: runtimeError.name,
      errorMessage: runtimeError.message,
    }));
    return NextResponse.json({ error: "Failed to update capability approval" }, { status: 500, headers: NO_STORE_HEADERS });
  }
}
