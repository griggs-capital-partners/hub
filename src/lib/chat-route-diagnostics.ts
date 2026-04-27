import type {
  ConversationArchiveScope,
  TeamChatConversationAccessSnapshot,
} from "@/lib/chat";
import {
  getTeamChatConversationAccessSnapshot,
  resolveTeamChatConversationAccessSnapshot,
} from "@/lib/chat";

export const TEAM_CHAT_ROUTE_DIAGNOSTIC_VERSION = "messages-route-parity-v1";
export const TEAM_CHAT_MESSAGES_ROUTE = "api/chat/conversations/[id]/messages.GET";

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
  accessSnapshot?: TeamChatConversationAccessSnapshot;
  archived?: ConversationArchiveScope;
  readableHelperPassed?: boolean;
  postHelperLookupFailed?: boolean;
  routeTopMarkerReached?: boolean;
  routeHandlerTopMarkerReached?: boolean;
  serializationFailed?: boolean;
  sourceRouteFile?: string;
  routeHandlerMarker?: string;
  notFoundReason?: string | null;
};

export type ConversationDiagnosticSnapshot = {
  conversationId: string;
  conversationExists: boolean;
  archivedAt: string | null;
  projectId: string | null;
  activeMembershipCountForUser: number;
  userMembershipRemovedAt: Array<string | null>;
  messageCount: number | null;
};

export function buildTeamChatMessagesRouteTopMarker(params: {
  conversationId: string;
  sessionUserId: string | null;
  sessionUserEmail: string | null;
  timestamp?: string;
}) {
  return {
    route: TEAM_CHAT_MESSAGES_ROUTE,
    diagnosticVersion: TEAM_CHAT_ROUTE_DIAGNOSTIC_VERSION,
    conversationId: params.conversationId,
    sessionUserId: params.sessionUserId,
    sessionUserEmail: params.sessionUserEmail,
    timestamp: params.timestamp ?? new Date().toISOString(),
    routeTopMarkerReached: true,
    routeHandlerTopMarkerReached: true,
  };
}

type TeamChatDetailRouteDiagnostic = ConversationDiagnosticSnapshot & {
  diagnosticVersion: string;
  route: string;
  sessionUserId: string | null;
  sessionUserEmail: string | null;
  requestedConversationId: string;
  accessFound: boolean;
  accessStatus: 200 | 404;
  readable: boolean;
  readableHelperPassed: boolean;
  postHelperLookupFailed: boolean;
  routeTopMarkerReached: boolean;
  routeHandlerTopMarkerReached: boolean;
  serializationFailed: boolean;
  sourceRouteFile: string | null;
  routeHandlerMarker: string | null;
  notFoundReason: string | null;
};

function shouldLogTeamChatRouteDiagnostics() {
  return process.env.NODE_ENV !== "production";
}

function accessSnapshotToConversationDiagnosticSnapshot(
  snapshot: TeamChatConversationAccessSnapshot
): ConversationDiagnosticSnapshot {
  return {
    conversationId: snapshot.conversationId,
    conversationExists: snapshot.conversationExists,
    archivedAt: snapshot.archivedAt,
    projectId: snapshot.projectId,
    activeMembershipCountForUser: snapshot.activeMembershipCountForUser,
    userMembershipRemovedAt: snapshot.userMembershipRemovedAt,
    messageCount: snapshot.messageCount,
  };
}

function emptyAccessSnapshot(
  conversationId: string,
  sessionUserId: string | null
): TeamChatConversationAccessSnapshot {
  return resolveTeamChatConversationAccessSnapshot({
    conversationId,
    sessionUserId: sessionUserId ?? "",
    conversation: null,
  });
}

async function loadAccessSnapshots(
  userId: string | null,
  conversationIds: string[],
  archived?: ConversationArchiveScope
) {
  if (!userId || conversationIds.length === 0) {
    return new Map<string, TeamChatConversationAccessSnapshot>();
  }

  const snapshots = await Promise.all(
    conversationIds.map((conversationId) => (
      getTeamChatConversationAccessSnapshot({
        conversationId,
        sessionUserId: userId,
        archived,
      })
    ))
  );

  return new Map(snapshots.map((snapshot) => [snapshot.conversationId, snapshot]));
}

export async function logTeamChatListRouteDiagnostics(
  params: TeamChatListRouteDiagnosticParams
) {
  if (!shouldLogTeamChatRouteDiagnostics()) {
    return;
  }

  const snapshots = await loadAccessSnapshots(
    params.session.userId,
    params.conversationIds
  );
  const diagnostics = params.conversationIds.map((conversationId) => {
    const snapshot = snapshots.get(conversationId) ?? emptyAccessSnapshot(conversationId, params.session.userId);

    return {
      ...accessSnapshotToConversationDiagnosticSnapshot(snapshot),
      accessStatus: snapshot.status,
      readable: snapshot.readable,
      notFoundReason: snapshot.notFoundReason,
      readableHelperPassed: snapshot.readableHelperPassed,
      postHelperLookupFailed: snapshot.postHelperLookupFailed,
    };
  });

  console.info(
    "[team-chat-route-diagnostic]",
    JSON.stringify({
      diagnosticVersion: TEAM_CHAT_ROUTE_DIAGNOSTIC_VERSION,
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
  const fallbackSnapshot = params.accessSnapshot
    ?? (params.session.userId
      ? await getTeamChatConversationAccessSnapshot({
          conversationId: params.conversationId,
          sessionUserId: params.session.userId,
          archived: params.archived,
        })
      : emptyAccessSnapshot(params.conversationId, params.session.userId));
  const snapshot = accessSnapshotToConversationDiagnosticSnapshot(fallbackSnapshot);
  const routeTopMarkerReached =
    params.routeTopMarkerReached ?? params.routeHandlerTopMarkerReached ?? false;
  const notFoundReason = params.notFoundReason !== undefined
    ? params.notFoundReason
    : !params.accessFound && fallbackSnapshot.readable
      ? "readable_helper_lookup_failed"
      : fallbackSnapshot.notFoundReason;
  const diagnostic: TeamChatDetailRouteDiagnostic = {
    diagnosticVersion: TEAM_CHAT_ROUTE_DIAGNOSTIC_VERSION,
    route: params.route,
    sessionUserId: params.session.userId,
    sessionUserEmail: params.session.email,
    requestedConversationId: params.conversationId,
    accessFound: params.accessFound,
    accessStatus: fallbackSnapshot.status,
    readable: fallbackSnapshot.readable,
    readableHelperPassed: params.readableHelperPassed ?? fallbackSnapshot.readableHelperPassed,
    postHelperLookupFailed: params.postHelperLookupFailed ?? fallbackSnapshot.postHelperLookupFailed,
    routeTopMarkerReached,
    routeHandlerTopMarkerReached: routeTopMarkerReached,
    serializationFailed: params.serializationFailed ?? false,
    sourceRouteFile: params.sourceRouteFile ?? null,
    routeHandlerMarker: params.routeHandlerMarker ?? null,
    ...snapshot,
    notFoundReason,
  };

  if (!shouldLogTeamChatRouteDiagnostics() && params.accessFound) {
    return diagnostic;
  }

  if (shouldLogTeamChatRouteDiagnostics() || !params.accessFound) {
    console.info("[team-chat-route-diagnostic]", JSON.stringify(diagnostic));
  }

  return diagnostic;
}
