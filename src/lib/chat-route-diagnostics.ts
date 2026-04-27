import { prisma } from "@/lib/prisma";
import type { ConversationArchiveScope } from "@/lib/chat";
import { getReadableConversationAccessReason } from "@/lib/chat";

type TeamChatRouteSessionDiagnostic = {
  userId: string | null;
  email: string | null;
};

type TeamChatListRouteDiagnosticParams = {
  route: string;
  session: TeamChatRouteSessionDiagnostic;
  conversationIds: string[];
};

type TeamChatDetailRouteDiagnosticParams = {
  route: string;
  session: TeamChatRouteSessionDiagnostic;
  conversationId: string;
  accessFound: boolean;
  archived?: ConversationArchiveScope;
  readableHelperPassed?: boolean;
  postHelperLookupFailed?: boolean;
};

type ConversationDiagnosticSnapshot = {
  conversationId: string;
  conversationExists: boolean;
  archivedAt: string | null;
  projectId: string | null;
  activeMembershipCountForUser: number;
  userMembershipRemovedAt: Array<string | null>;
  messageCount: number | null;
};

type TeamChatDetailRouteDiagnostic = ConversationDiagnosticSnapshot & {
  route: string;
  sessionUserId: string | null;
  sessionUserEmail: string | null;
  requestedConversationId: string;
  accessFound: boolean;
  readableHelperPassed: boolean;
  postHelperLookupFailed: boolean;
  notFoundReason: string | null;
};

function emptyConversationSnapshot(conversationId: string): ConversationDiagnosticSnapshot {
  return {
    conversationId,
    conversationExists: false,
    archivedAt: null,
    projectId: null,
    activeMembershipCountForUser: 0,
    userMembershipRemovedAt: [],
    messageCount: null,
  };
}

function shouldLogTeamChatRouteDiagnostics() {
  return process.env.NODE_ENV !== "production";
}

function serializeRemovedAt(values: Array<Date | null>) {
  return values.map((value) => value?.toISOString() ?? null);
}

async function loadConversationSnapshots(
  userId: string | null,
  conversationIds: string[]
) {
  if (!userId || conversationIds.length === 0) {
    return new Map<string, ConversationDiagnosticSnapshot>();
  }

  const conversations = await prisma.conversation.findMany({
    where: {
      id: {
        in: conversationIds,
      },
    },
    select: {
      id: true,
      archivedAt: true,
      chatProjectId: true,
      members: {
        where: { userId },
        orderBy: { joinedAt: "asc" },
        select: {
          removedAt: true,
        },
      },
      _count: {
        select: {
          messages: true,
        },
      },
    },
  });

  return new Map(
    conversations.map((conversation) => {
      const userMembershipRemovedAt = serializeRemovedAt(
        conversation.members.map((member) => member.removedAt)
      );

      return [
        conversation.id,
        {
          conversationId: conversation.id,
          conversationExists: true,
          archivedAt: conversation.archivedAt?.toISOString() ?? null,
          projectId: conversation.chatProjectId ?? null,
          activeMembershipCountForUser: conversation.members.filter((member) => member.removedAt === null).length,
          userMembershipRemovedAt,
          messageCount: conversation._count.messages,
        } satisfies ConversationDiagnosticSnapshot,
      ] as const;
    })
  );
}

export async function logTeamChatListRouteDiagnostics(
  params: TeamChatListRouteDiagnosticParams
) {
  if (!shouldLogTeamChatRouteDiagnostics()) {
    return;
  }

  const snapshots = await loadConversationSnapshots(
    params.session.userId,
    params.conversationIds
  );
  const diagnostics = params.conversationIds.map((conversationId) => (
    snapshots.get(conversationId) ?? emptyConversationSnapshot(conversationId)
  ));

  console.info(
    "[team-chat-route-diagnostic]",
    JSON.stringify({
      route: params.route,
      sessionUserId: params.session.userId,
      sessionUserEmail: params.session.email,
      returnedConversationCount: params.conversationIds.length,
      diagnostics,
    })
  );
}

export async function logTeamChatDetailRouteDiagnostics(
  params: TeamChatDetailRouteDiagnosticParams
) {
  if (!shouldLogTeamChatRouteDiagnostics() && params.accessFound) {
    return {
      route: params.route,
      sessionUserId: params.session.userId,
      sessionUserEmail: params.session.email,
      requestedConversationId: params.conversationId,
      accessFound: true,
      conversationId: params.conversationId,
      conversationExists: true,
      archivedAt: null,
      projectId: null,
      activeMembershipCountForUser: 0,
      userMembershipRemovedAt: [],
      messageCount: null,
      readableHelperPassed: params.readableHelperPassed ?? true,
      postHelperLookupFailed: params.postHelperLookupFailed ?? false,
      notFoundReason: null,
    } satisfies TeamChatDetailRouteDiagnostic;
  }

  const snapshots = await loadConversationSnapshots(
    params.session.userId,
    [params.conversationId]
  );
  const snapshot = snapshots.get(params.conversationId) ?? emptyConversationSnapshot(params.conversationId);
  const notFoundReason = params.accessFound
    ? null
    : getReadableConversationAccessReason(
        snapshot.conversationExists
          ? {
              archivedAt: snapshot.archivedAt ? new Date(snapshot.archivedAt) : null,
              members: snapshot.userMembershipRemovedAt.map((removedAt) => ({
                userId: params.session.userId,
                removedAt: removedAt ? new Date(removedAt) : null,
              })),
            }
          : null,
        params.session.userId ?? "",
        { archived: params.archived }
      );
  const diagnostic: TeamChatDetailRouteDiagnostic = {
    route: params.route,
    sessionUserId: params.session.userId,
    sessionUserEmail: params.session.email,
    requestedConversationId: params.conversationId,
    accessFound: params.accessFound,
    readableHelperPassed: params.readableHelperPassed ?? params.accessFound,
    postHelperLookupFailed: params.postHelperLookupFailed ?? false,
    ...snapshot,
    notFoundReason,
  };

  if (shouldLogTeamChatRouteDiagnostics() || !params.accessFound) {
    console.info("[team-chat-route-diagnostic]", JSON.stringify(diagnostic));
  }

  return diagnostic;
}
