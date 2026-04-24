import { prisma } from "@/lib/prisma";

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
};

type ConversationDiagnosticSnapshot = {
  conversationId: string;
  conversationExists: boolean;
  archivedAt: string | null;
  projectId: string | null;
  activeMembershipCountForUser: number;
  userMembershipRemovedAt: Array<string | null>;
};

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
    snapshots.get(conversationId) ?? {
      conversationId,
      conversationExists: false,
      archivedAt: null,
      projectId: null,
      activeMembershipCountForUser: 0,
      userMembershipRemovedAt: [],
    }
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
  if (!shouldLogTeamChatRouteDiagnostics()) {
    return;
  }

  const snapshots = await loadConversationSnapshots(
    params.session.userId,
    [params.conversationId]
  );
  const snapshot = snapshots.get(params.conversationId) ?? {
    conversationId: params.conversationId,
    conversationExists: false,
    archivedAt: null,
    projectId: null,
    activeMembershipCountForUser: 0,
    userMembershipRemovedAt: [],
  };

  console.info(
    "[team-chat-route-diagnostic]",
    JSON.stringify({
      route: params.route,
      sessionUserId: params.session.userId,
      sessionUserEmail: params.session.email,
      requestedConversationId: params.conversationId,
      accessFound: params.accessFound,
      ...snapshot,
    })
  );
}
