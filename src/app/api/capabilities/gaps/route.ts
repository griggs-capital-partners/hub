import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { getReadableConversationForUser } from "@/lib/chat";
import {
  buildCapabilityGapApprovalCenterSummary,
  listCapabilityApprovalDecisionsForScopes,
} from "@/lib/capability-gap-approval-summary";
import { selectOpenContextRegistryRecords } from "@/lib/capability-gap-context-debt-registry";
import { prisma } from "@/lib/prisma";
import { describeUnknownRuntimeError } from "@/lib/runtime-diagnostics";

export const dynamic = "force-dynamic";

const NO_STORE_HEADERS = {
  "Cache-Control": "no-store",
  Vary: "Cookie",
};

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
    const status = url.searchParams.get("status")?.trim() || null;
    const capabilityId = url.searchParams.get("capabilityId")?.trim() || null;
    const providerId = url.searchParams.get("providerId")?.trim() || null;
    const includeResolved = url.searchParams.get("includeResolved") === "true";

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
        })
      )
    );
    const approvals = await listCapabilityApprovalDecisionsForScopes({
      conversationId: conversationIds.length === 1 ? conversationIds[0] : null,
      conversationDocumentIds: documentIds,
    });
    const summary = buildCapabilityGapApprovalCenterSummary({
      registry: {
        contextDebtRecords: registrySelections.flatMap((selection) => selection.contextDebtRecords),
        capabilityGapRecords: registrySelections.flatMap((selection) => selection.capabilityGapRecords),
        sourceCoverageRecords: registrySelections.flatMap((selection) => selection.sourceCoverageRecords),
        traceEvents: registrySelections.flatMap((selection) => selection.traceEvents),
      },
      approvals,
      includeResolved,
      conversationId: conversationIds.length === 1 ? conversationIds[0] : null,
      env: process.env,
    });
    const rows = summary.rows.filter((row) =>
      (!status || row.status === status) &&
      (!capabilityId || row.capabilityId === capabilityId) &&
      (!providerId || row.providerId === providerId)
    );

    return NextResponse.json(
      {
        summary: {
          ...summary,
          rows,
          counts: {
            ...summary.counts,
            total: rows.length,
          },
        },
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
