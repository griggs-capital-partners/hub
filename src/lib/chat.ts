import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import {
  getPublicConversationLlmState,
  normalizeAgentLlmConfig,
  normalizeConversationLlmThreadState,
  reconcileConversationLlmThreadState,
} from "@/lib/agent-llm-config";

const activeConversationMemberWhere = Prisma.validator<Prisma.ConversationMemberWhereInput>()({
  removedAt: null,
});

const conversationMemberInclude = {
  user: {
    select: {
      id: true,
      name: true,
      displayName: true,
      email: true,
      image: true,
      role: true,
      lastSeen: true,
    },
  },
  agent: {
    select: {
      id: true,
      name: true,
      description: true,
      role: true,
      persona: true,
      duties: true,
      avatar: true,
      status: true,
      llmConfig: true,
      llmEndpointUrl: true,
      llmUsername: true,
      llmPassword: true,
      llmModel: true,
      llmThinkingMode: true,
      disabledTools: true,
      abilities: true,
      llmStatus: true,
      llmLastCheckedAt: true,
      llmLastError: true,
    },
  },
} as const;

const conversationBaseInclude = {
  chatProject: {
    select: {
      id: true,
      name: true,
    },
  },
  messages: {
    take: 1,
    orderBy: { createdAt: "desc" as const },
    include: {
      senderUser: {
        select: {
          id: true,
          name: true,
          displayName: true,
          image: true,
        },
      },
      senderAgent: {
        select: {
          id: true,
          name: true,
          avatar: true,
        },
      },
    },
  },
  documents: {
    orderBy: { createdAt: "desc" as const },
    include: {
      uploader: {
        select: {
          id: true,
          name: true,
          displayName: true,
          email: true,
          image: true,
        },
      },
    },
  },
} as const;

const activeConversationInclude = Prisma.validator<Prisma.ConversationInclude>()({
  ...conversationBaseInclude,
  members: {
    where: activeConversationMemberWhere,
    include: conversationMemberInclude,
    orderBy: { joinedAt: "asc" },
  },
});

const allConversationInclude = Prisma.validator<Prisma.ConversationInclude>()({
  ...conversationBaseInclude,
  members: {
    include: conversationMemberInclude,
    orderBy: { joinedAt: "asc" },
  },
});

const messageInclude = {
  senderUser: {
    select: {
      id: true,
      name: true,
      displayName: true,
      image: true,
    },
  },
  senderAgent: {
    select: {
      id: true,
      name: true,
      avatar: true,
    },
  },
} as const;

const SEARCH_RESULT_LIMIT = 50;

type ConversationWithRelations = Prisma.ConversationGetPayload<{
  include: typeof allConversationInclude;
}>;

type ConversationMemberWithRelations = ConversationWithRelations["members"][number];

export type ConversationMemberScope = "active" | "all";
export type ConversationArchiveScope = "exclude" | "only" | "include";

export type ConversationMembershipRecord = {
  id: string;
  conversationId: string;
  userId: string | null;
  agentId: string | null;
  joinedAt: Date;
  removedAt: Date | null;
};

export type ConversationMembershipMutationPlan = {
  createUserIds: string[];
  reactivateUserMemberIds: string[];
  removeUserMemberIds: string[];
  createAgentIds: string[];
  reactivateAgentMemberIds: string[];
  removeAgentMemberIds: string[];
  nextActiveUserIds: string[];
  nextActiveAgentIds: string[];
  nextParticipantCount: number;
  nextPinnedActiveAgentId: string | null;
  invalidRequestedActiveAgentId: boolean;
  hasParticipantChanges: boolean;
};

type ChatProjectSummary = {
  id: string;
  name: string;
};

export type ReadableConversationAccessReason =
  | "readable"
  | "conversation_missing"
  | "conversation_archived"
  | "conversation_not_archived"
  | "user_has_no_active_membership";

export type ReadableConversationAccessSnapshot = {
  id?: string;
  archivedAt: Date | null;
  chatProjectId?: string | null;
  projectId?: string | null;
  members: ReadonlyArray<{
    userId: string | null;
    removedAt: Date | null;
  }>;
};

export type ConversationMessagesAccessResult = {
  readable: boolean;
  status: 200 | 404;
  notFoundReason: ReadableConversationAccessReason | null;
  conversationExists: boolean;
  archivedAt: string | null;
  projectId: string | null;
  activeMembershipCountForUser: number;
  userMembershipRemovedAt: Array<string | null>;
  readableHelperPassed: boolean;
  postHelperLookupFailed: boolean;
  messageCount: number;
};

export type TeamChatConversationAccessStatus = 200 | 404;

export type TeamChatConversationSummary = {
  id: string;
  type: string | null;
  name: string | null;
  projectId: string | null;
  archivedAt: string | null;
  createdAt: string | null;
  updatedAt: string | null;
};

export type TeamChatConversationMembershipSummary = {
  userId: string | null;
  agentId: string | null;
  joinedAt: string | null;
  removedAt: string | null;
  active: boolean;
};

export type TeamChatConversationAccessSnapshot = {
  conversationId: string;
  status: TeamChatConversationAccessStatus;
  accessStatus: TeamChatConversationAccessStatus;
  readable: boolean;
  notFoundReason: ReadableConversationAccessReason | null;
  conversationExists: boolean;
  archivedAt: string | null;
  projectId: string | null;
  activeMembershipCountForUser: number;
  userMembershipRemovedAt: Array<string | null>;
  messageCount: number | null;
  readableHelperPassed: boolean;
  postHelperLookupFailed: boolean;
  conversationSummary: TeamChatConversationSummary | null;
  membershipSummary: TeamChatConversationMembershipSummary[];
};

export type TeamChatConversationAccessSnapshotRecord = {
  id: string;
  type?: string | null;
  name?: string | null;
  archivedAt: Date | null;
  chatProjectId?: string | null;
  projectId?: string | null;
  createdAt?: Date | null;
  updatedAt?: Date | null;
  members: ReadonlyArray<{
    userId: string | null;
    agentId?: string | null;
    joinedAt?: Date | null;
    removedAt: Date | null;
  }>;
  _count?: {
    messages?: number | null;
  };
  messageCount?: number | null;
};

export type TeamChatRouteParityResult = {
  conversationId: string;
  readable: boolean;
  status: TeamChatConversationAccessStatus | null;
  mismatchReason: string | null;
};

export type MessagesRouteConversationLookupSource =
  | "shared_readable_helper"
  | "readable_snapshot_fallback"
  | "readable_snapshot_fallback_missing"
  | "readable_snapshot_fallback_not_readable"
  | "unreadable_access_snapshot";

export type MessagesRouteReadableConversationSelection<
  TConversation extends ReadableConversationAccessSnapshot,
> = {
  conversation: TConversation | null;
  lookupSource: MessagesRouteConversationLookupSource;
  fallbackReadable: boolean;
  notFoundReason: string | null;
};

function isArchivedInScope(archivedAt: Date | null, scope: ConversationArchiveScope = "exclude") {
  if (scope === "include") {
    return true;
  }

  if (scope === "only") {
    return archivedAt !== null;
  }

  return archivedAt === null;
}

export function getReadableConversationAccessReason(
  conversation: ReadableConversationAccessSnapshot | null | undefined,
  userId: string,
  options: { archived?: ConversationArchiveScope } = {}
): ReadableConversationAccessReason {
  if (!conversation) {
    return "conversation_missing";
  }

  if (!isArchivedInScope(conversation.archivedAt, options.archived)) {
    return options.archived === "only" ? "conversation_not_archived" : "conversation_archived";
  }

  const hasActiveUserMembership = conversation.members.some(
    (member) => member.userId === userId && member.removedAt === null
  );

  return hasActiveUserMembership ? "readable" : "user_has_no_active_membership";
}

export function isConversationReadableByUser(
  conversation: ReadableConversationAccessSnapshot | null | undefined,
  userId: string,
  options: { archived?: ConversationArchiveScope } = {}
) {
  return getReadableConversationAccessReason(conversation, userId, options) === "readable";
}

export function resolveConversationMessagesAccessResult(params: {
  conversation: ReadableConversationAccessSnapshot | null | undefined;
  userId: string;
  messageCount?: number | null;
  archived?: ConversationArchiveScope;
  conversationExists?: boolean;
  archivedAt?: string | Date | null;
  projectId?: string | null;
  activeMembershipCountForUser?: number;
  userMembershipRemovedAt?: Array<string | Date | null>;
  readableHelperPassed?: boolean;
  postHelperLookupFailed?: boolean;
}): ConversationMessagesAccessResult {
  const notFoundReason = getReadableConversationAccessReason(
    params.conversation,
    params.userId,
    { archived: params.archived }
  );
  const isReadable = notFoundReason === "readable";
  const conversationExists = params.conversationExists ?? Boolean(params.conversation);
  const archivedAt =
    params.archivedAt instanceof Date
      ? params.archivedAt.toISOString()
      : params.archivedAt ?? params.conversation?.archivedAt?.toISOString() ?? null;
  const projectId =
    params.projectId
      ?? params.conversation?.projectId
      ?? params.conversation?.chatProjectId
      ?? null;
  const userMembershipRemovedAt =
    params.userMembershipRemovedAt?.map((value) => (
      value instanceof Date ? value.toISOString() : value
    ))
    ?? params.conversation?.members
      .filter((member) => member.userId === params.userId)
      .map((member) => member.removedAt?.toISOString() ?? null)
    ?? [];
  const activeMembershipCountForUser =
    params.activeMembershipCountForUser
    ?? userMembershipRemovedAt.filter((removedAt) => removedAt === null).length;

  return {
    readable: isReadable,
    status: isReadable ? 200 : 404,
    notFoundReason: isReadable ? null : notFoundReason,
    conversationExists,
    archivedAt,
    projectId,
    activeMembershipCountForUser,
    userMembershipRemovedAt,
    readableHelperPassed: params.readableHelperPassed ?? isReadable,
    postHelperLookupFailed: params.postHelperLookupFailed ?? false,
    messageCount: params.messageCount ?? 0,
  };
}

function serializeDateForAccessSnapshot(value: Date | string | null | undefined) {
  if (value instanceof Date) {
    return value.toISOString();
  }

  return value ?? null;
}

export function resolveTeamChatConversationAccessSnapshot(params: {
  conversationId: string;
  sessionUserId: string;
  conversation: TeamChatConversationAccessSnapshotRecord | null | undefined;
  archived?: ConversationArchiveScope;
  postHelperLookupFailed?: boolean;
}): TeamChatConversationAccessSnapshot {
  const conversation = params.conversation ?? null;
  const notFoundReason = getReadableConversationAccessReason(
    conversation,
    params.sessionUserId,
    { archived: params.archived }
  );
  const readable = notFoundReason === "readable";
  const status: TeamChatConversationAccessStatus = readable ? 200 : 404;
  const membershipSummary = conversation?.members.map((member) => ({
    userId: member.userId,
    agentId: member.agentId ?? null,
    joinedAt: serializeDateForAccessSnapshot(member.joinedAt),
    removedAt: serializeDateForAccessSnapshot(member.removedAt),
    active: member.userId === params.sessionUserId && member.removedAt === null,
  })) ?? [];
  const userMembershipRemovedAt = membershipSummary
    .filter((member) => member.userId === params.sessionUserId)
    .map((member) => member.removedAt);
  const messageCount =
    conversation?.messageCount
    ?? conversation?._count?.messages
    ?? (conversation ? 0 : null);
  const projectId = conversation?.projectId ?? conversation?.chatProjectId ?? null;

  return {
    conversationId: params.conversationId,
    status,
    accessStatus: status,
    readable,
    notFoundReason: readable ? null : notFoundReason,
    conversationExists: Boolean(conversation),
    archivedAt: serializeDateForAccessSnapshot(conversation?.archivedAt),
    projectId,
    activeMembershipCountForUser: membershipSummary.filter((member) => member.active).length,
    userMembershipRemovedAt,
    messageCount,
    readableHelperPassed: readable,
    postHelperLookupFailed: params.postHelperLookupFailed ?? false,
    conversationSummary: conversation
      ? {
          id: conversation.id,
          type: conversation.type ?? null,
          name: conversation.name ?? null,
          projectId,
          archivedAt: serializeDateForAccessSnapshot(conversation.archivedAt),
          createdAt: serializeDateForAccessSnapshot(conversation.createdAt),
          updatedAt: serializeDateForAccessSnapshot(conversation.updatedAt),
        }
      : null,
    membershipSummary,
  };
}

export function reconcileMessagesRouteAccessWithReadableConversation(params: {
  accessSnapshot: TeamChatConversationAccessSnapshot;
  readableConversation: ReadableConversationAccessSnapshot | null | undefined;
  sessionUserId: string;
  messageCount?: number | null;
}): TeamChatConversationAccessSnapshot {
  const conversation = params.readableConversation;
  if (!conversation || !isConversationReadableByUser(conversation, params.sessionUserId)) {
    return params.accessSnapshot;
  }

  const userMembershipRemovedAt = conversation.members
    .filter((member) => member.userId === params.sessionUserId)
    .map((member) => serializeDateForAccessSnapshot(member.removedAt));

  return {
    ...params.accessSnapshot,
    status: 200,
    accessStatus: 200,
    readable: true,
    notFoundReason: null,
    conversationExists: true,
    archivedAt: serializeDateForAccessSnapshot(conversation.archivedAt),
    projectId:
      conversation.projectId ??
      conversation.chatProjectId ??
      params.accessSnapshot.projectId,
    activeMembershipCountForUser:
      userMembershipRemovedAt.filter((removedAt) => removedAt === null).length ||
      params.accessSnapshot.activeMembershipCountForUser,
    userMembershipRemovedAt:
      userMembershipRemovedAt.length > 0
        ? userMembershipRemovedAt
        : params.accessSnapshot.userMembershipRemovedAt,
    messageCount:
      params.messageCount ??
      params.accessSnapshot.messageCount,
    readableHelperPassed: true,
    postHelperLookupFailed: false,
  };
}

export function selectMessagesRouteReadableConversation<
  TConversation extends ReadableConversationAccessSnapshot,
>(params: {
  accessSnapshot: TeamChatConversationAccessSnapshot;
  primaryConversation: TConversation | null | undefined;
  fallbackConversation?: TConversation | null | undefined;
  sessionUserId: string;
}): MessagesRouteReadableConversationSelection<TConversation> {
  if (isConversationReadableByUser(params.primaryConversation, params.sessionUserId)) {
    return {
      conversation: params.primaryConversation ?? null,
      lookupSource: "shared_readable_helper",
      fallbackReadable: false,
      notFoundReason: null,
    };
  }

  if (!params.accessSnapshot.readable || params.accessSnapshot.status !== 200) {
    return {
      conversation: null,
      lookupSource: "unreadable_access_snapshot",
      fallbackReadable: false,
      notFoundReason: params.accessSnapshot.notFoundReason ?? "messages_access_not_readable",
    };
  }

  if (!params.fallbackConversation) {
    return {
      conversation: null,
      lookupSource: "readable_snapshot_fallback_missing",
      fallbackReadable: false,
      notFoundReason: "readable_snapshot_fallback_missing",
    };
  }

  if (!isConversationReadableByUser(params.fallbackConversation, params.sessionUserId)) {
    return {
      conversation: null,
      lookupSource: "readable_snapshot_fallback_not_readable",
      fallbackReadable: false,
      notFoundReason: "readable_snapshot_fallback_not_readable",
    };
  }

  return {
    conversation: params.fallbackConversation,
    lookupSource: "readable_snapshot_fallback",
    fallbackReadable: true,
    notFoundReason: null,
  };
}

export function evaluateTeamChatRouteParity(params: {
  listConversationIds: string[];
  messageAccessSnapshots: TeamChatConversationAccessSnapshot[];
}): TeamChatRouteParityResult[] {
  const snapshotById = new Map(
    params.messageAccessSnapshots.map((snapshot) => [snapshot.conversationId, snapshot])
  );

  return params.listConversationIds.map((conversationId) => {
    const snapshot = snapshotById.get(conversationId);

    if (!snapshot) {
      return {
        conversationId,
        readable: false,
        status: null,
        mismatchReason: "missing_messages_access_snapshot",
      };
    }

    return {
      conversationId,
      readable: snapshot.readable,
      status: snapshot.status,
      mismatchReason: snapshot.readable && snapshot.status === 200
        ? null
        : snapshot.notFoundReason ?? "messages_access_not_readable",
    };
  });
}

function sortConversationMemberships<T extends Pick<ConversationMembershipRecord, "joinedAt">>(members: readonly T[]) {
  return [...members].sort((left, right) => left.joinedAt.getTime() - right.joinedAt.getTime());
}

export function isConversationMembershipActive(
  member: Pick<ConversationMembershipRecord, "removedAt">
) {
  return member.removedAt === null;
}

export function filterActiveConversationMemberships<T extends { removedAt: Date | null }>(
  members: readonly T[]
) {
  return members.filter((member): member is T & { removedAt: null } => member.removedAt === null);
}

export function toConversationMembershipRecord(
  member: Pick<ConversationMemberWithRelations, "id" | "conversationId" | "userId" | "agentId" | "joinedAt" | "removedAt">
): ConversationMembershipRecord {
  return {
    id: member.id,
    conversationId: member.conversationId,
    userId: member.userId,
    agentId: member.agentId,
    joinedAt: member.joinedAt,
    removedAt: member.removedAt,
  };
}

export function planConversationMembershipMutation(params: {
  members: ConversationMembershipRecord[];
  currentUserId: string;
  addUserIds: string[];
  addAgentIds: string[];
  removeUserIds: string[];
  removeAgentIds: string[];
  requestedActiveAgentId?: string | null;
  currentPinnedActiveAgentId: string | null;
}): ConversationMembershipMutationPlan {
  const members = sortConversationMemberships(params.members);
  const activeUserMembershipById = new Map<string, ConversationMembershipRecord>();
  const removedUserMembershipById = new Map<string, ConversationMembershipRecord>();
  const activeAgentMembershipById = new Map<string, ConversationMembershipRecord>();
  const removedAgentMembershipById = new Map<string, ConversationMembershipRecord>();

  for (const member of members) {
    if (member.userId) {
      if (isConversationMembershipActive(member)) {
        activeUserMembershipById.set(member.userId, member);
      } else {
        removedUserMembershipById.set(member.userId, member);
      }
    }

    if (member.agentId) {
      if (isConversationMembershipActive(member)) {
        activeAgentMembershipById.set(member.agentId, member);
      } else {
        removedAgentMembershipById.set(member.agentId, member);
      }
    }
  }

  const createUserIds: string[] = [];
  const reactivateUserMemberIds: string[] = [];
  const reactivateUserIds = new Set<string>();
  const removeUserMemberIds: string[] = [];
  const removeUserIds = new Set<string>();
  const createAgentIds: string[] = [];
  const reactivateAgentMemberIds: string[] = [];
  const reactivateAgentIds = new Set<string>();
  const removeAgentMemberIds: string[] = [];
  const removeAgentIds = new Set<string>();

  for (const userId of Array.from(new Set(params.addUserIds))) {
    if (!userId || userId === params.currentUserId || activeUserMembershipById.has(userId)) {
      continue;
    }

    const removedMembership = removedUserMembershipById.get(userId);
    if (removedMembership) {
      reactivateUserMemberIds.push(removedMembership.id);
      reactivateUserIds.add(userId);
      continue;
    }

    createUserIds.push(userId);
  }

  for (const agentId of Array.from(new Set(params.addAgentIds))) {
    if (!agentId || activeAgentMembershipById.has(agentId)) {
      continue;
    }

    const removedMembership = removedAgentMembershipById.get(agentId);
    if (removedMembership) {
      reactivateAgentMemberIds.push(removedMembership.id);
      reactivateAgentIds.add(agentId);
      continue;
    }

    createAgentIds.push(agentId);
  }

  for (const userId of Array.from(new Set(params.removeUserIds))) {
    if (!userId || userId === params.currentUserId) {
      continue;
    }

    const activeMembership = activeUserMembershipById.get(userId);
    if (!activeMembership) {
      continue;
    }

    removeUserMemberIds.push(activeMembership.id);
    removeUserIds.add(userId);
  }

  for (const agentId of Array.from(new Set(params.removeAgentIds))) {
    if (!agentId) {
      continue;
    }

    const activeMembership = activeAgentMembershipById.get(agentId);
    if (!activeMembership) {
      continue;
    }

    removeAgentMemberIds.push(activeMembership.id);
    removeAgentIds.add(agentId);
  }

  const nextActiveUserIds = [
    ...members.flatMap((member) => {
      if (!member.userId) return [];

      const willBeActive = isConversationMembershipActive(member)
        ? !removeUserIds.has(member.userId)
        : reactivateUserIds.has(member.userId);

      return willBeActive ? [member.userId] : [];
    }),
    ...createUserIds,
  ];

  const nextActiveAgentIds = [
    ...members.flatMap((member) => {
      if (!member.agentId) return [];

      const willBeActive = isConversationMembershipActive(member)
        ? !removeAgentIds.has(member.agentId)
        : reactivateAgentIds.has(member.agentId);

      return willBeActive ? [member.agentId] : [];
    }),
    ...createAgentIds,
  ];

  const invalidRequestedActiveAgentId = params.requestedActiveAgentId !== undefined
    && params.requestedActiveAgentId !== null
    && !nextActiveAgentIds.includes(params.requestedActiveAgentId);

  let nextPinnedActiveAgentId = params.currentPinnedActiveAgentId;
  if (nextActiveAgentIds.length === 0) {
    nextPinnedActiveAgentId = null;
  }

  if (!invalidRequestedActiveAgentId && params.requestedActiveAgentId !== undefined) {
    nextPinnedActiveAgentId = params.requestedActiveAgentId;
  } else if (nextPinnedActiveAgentId && !nextActiveAgentIds.includes(nextPinnedActiveAgentId)) {
    nextPinnedActiveAgentId = null;
  }

  return {
    createUserIds,
    reactivateUserMemberIds,
    removeUserMemberIds,
    createAgentIds,
    reactivateAgentMemberIds,
    removeAgentMemberIds,
    nextActiveUserIds,
    nextActiveAgentIds,
    nextParticipantCount: nextActiveUserIds.length + nextActiveAgentIds.length,
    nextPinnedActiveAgentId,
    invalidRequestedActiveAgentId,
    hasParticipantChanges:
      createUserIds.length
      + reactivateUserMemberIds.length
      + removeUserMemberIds.length
      + createAgentIds.length
      + reactivateAgentMemberIds.length
      + removeAgentMemberIds.length
      > 0,
  };
}

function resolveConversationAgentMemberInternal(
  conversation: ConversationWithRelations
) {
  return resolveConversationRuntimeState(conversation).activeAgentMember;
}

function normalizeConversationRuntimeThreadLlmState(params: {
  activeAgentMember: (ConversationMemberWithRelations & {
    removedAt: null;
    agent: NonNullable<ConversationMemberWithRelations["agent"]>;
  }) | null;
  storedThreadLlmState: ReturnType<typeof normalizeConversationLlmThreadState>;
}) {
  const threadLlmState = params.activeAgentMember
    ? reconcileConversationLlmThreadState(
        normalizeAgentLlmConfig(params.activeAgentMember.agent.llmConfig, {
          llmEndpointUrl: params.activeAgentMember.agent.llmEndpointUrl,
          llmUsername: params.activeAgentMember.agent.llmUsername,
          llmPassword: params.activeAgentMember.agent.llmPassword,
          llmModel: params.activeAgentMember.agent.llmModel,
          llmThinkingMode: params.activeAgentMember.agent.llmThinkingMode,
        }),
        params.storedThreadLlmState
      )
    : params.storedThreadLlmState;

  return {
    ...threadLlmState,
    activeAgentId:
      threadLlmState.activeAgentId && params.activeAgentMember?.agent.id === threadLlmState.activeAgentId
        ? threadLlmState.activeAgentId
        : null,
  };
}

export function resolveConversationRuntimeState(
  conversation: ConversationWithRelations
) {
  const activeMembers = filterActiveConversationMemberships(conversation.members);
  const activeUserIds = activeMembers.flatMap((member) => (member.userId ? [member.userId] : []));
  const activeAgentMembers = activeMembers.filter(
    (
      member
    ): member is ConversationMemberWithRelations & {
      removedAt: null;
      agent: NonNullable<ConversationMemberWithRelations["agent"]>;
    } => member.agent !== null
  );
  const activeAgentIds = activeAgentMembers.map((member) => member.agent.id);
  const storedThreadLlmState = normalizeConversationLlmThreadState(conversation.llmThreadState);
  const pinnedActiveAgentId = storedThreadLlmState.activeAgentId;
  const activeAgentMember = pinnedActiveAgentId
    ? activeAgentMembers.find((member) => member.agent.id === pinnedActiveAgentId) ?? activeAgentMembers[0] ?? null
    : activeAgentMembers[0] ?? null;
  const threadLlmState = normalizeConversationRuntimeThreadLlmState({
    activeAgentMember,
    storedThreadLlmState,
  });

  return {
    activeMembers,
    activeUserIds,
    activeAgentIds,
    activeAgentMember,
    storedThreadLlmState,
    threadLlmState,
    hadInactivePinnedActiveAgent: Boolean(
      pinnedActiveAgentId && !activeAgentIds.includes(pinnedActiveAgentId)
    ),
  };
}

function displayUserName(user: {
  displayName: string | null;
  name: string | null;
  email: string;
}) {
  return user.displayName || user.name || user.email;
}

function serializeConversationMember(
  member: ConversationMemberWithRelations
) {
  const membership = {
    id: member.id,
    joinedAt: member.joinedAt.toISOString(),
    removedAt: member.removedAt?.toISOString() ?? null,
    isActive: isConversationMembershipActive(member),
  };

  if (member.user) {
    return {
      kind: "user" as const,
      id: member.user.id,
      name: displayUserName(member.user),
      email: member.user.email,
      image: member.user.image,
      role: member.user.role,
      lastSeen: member.user.lastSeen?.toISOString() ?? null,
      membership,
    };
  }

  if (!member.agent) {
    return null;
  }

  return {
    kind: "agent" as const,
    id: member.agent.id,
    name: member.agent.name,
    image: member.agent.avatar,
    role: member.agent.role,
    status: member.agent.status,
    llmModel: member.agent.llmModel,
    llmThinkingMode: member.agent.llmThinkingMode,
    llmStatus: member.agent.llmStatus,
    llmLastCheckedAt: member.agent.llmLastCheckedAt?.toISOString() ?? null,
    llmLastError: member.agent.llmLastError,
    membership,
  };
}

function serializeLatestMessage(
  message: ConversationWithRelations["messages"][number] | undefined
) {
  if (!message) return null;

  const sender =
    message.senderUser
      ? {
          kind: "user" as const,
          id: message.senderUser.id,
          name: message.senderUser.displayName || message.senderUser.name || "Unknown user",
          image: message.senderUser.image,
        }
      : message.senderAgent
        ? {
            kind: "agent" as const,
            id: message.senderAgent.id,
            name: message.senderAgent.name,
            image: message.senderAgent.avatar,
          }
        : null;

  return {
    id: message.id,
    body: message.body,
    createdAt: message.createdAt.toISOString(),
    sender,
  };
}

function serializeConversationDocument(
  document: ConversationWithRelations["documents"][number]
) {
  return {
    id: document.id,
    filename: document.filename,
    mimeType: document.mimeType,
    fileType: document.fileType,
    fileSize: document.fileSize,
    createdAt: document.createdAt.toISOString(),
    uploader: {
      id: document.uploader.id,
      name: document.uploader.displayName || document.uploader.name || document.uploader.email,
      email: document.uploader.email,
      image: document.uploader.image,
    },
  };
}

export function serializeConversation(
  conversation: ConversationWithRelations
) {
  const runtimeState = resolveConversationRuntimeState(conversation);

  return {
    id: conversation.id,
    type: conversation.type,
    name: conversation.name,
    project: conversation.chatProject
      ? {
          id: conversation.chatProject.id,
          name: conversation.chatProject.name,
        }
      : null,
    llmThread: getPublicConversationLlmState(runtimeState.threadLlmState),
    createdAt: conversation.createdAt.toISOString(),
    updatedAt: conversation.updatedAt.toISOString(),
    members: runtimeState.activeMembers
      .map(serializeConversationMember)
      .filter((member): member is NonNullable<typeof member> => member !== null),
    latestMessage: serializeLatestMessage(conversation.messages[0]),
    documents: conversation.documents.map(serializeConversationDocument),
  };
}

export function serializeConversationActiveMembership(
  conversation: ConversationWithRelations
) {
  const runtimeState = resolveConversationRuntimeState(conversation);

  return {
    activeCount: runtimeState.activeMembers.length,
    activeUserCount: runtimeState.activeUserIds.length,
    activeAgentCount: runtimeState.activeAgentIds.length,
    activeAgentId: runtimeState.activeAgentMember?.agent.id ?? null,
    hadInactivePinnedActiveAgent: runtimeState.hadInactivePinnedActiveAgent,
    participants: runtimeState.activeMembers
      .map(serializeConversationMember)
      .filter((member): member is NonNullable<typeof member> => member !== null),
  };
}

function includesNormalizedQuery(value: string | null | undefined, normalizedQuery: string) {
  return value?.toLocaleLowerCase().includes(normalizedQuery) ?? false;
}

function buildMessageMatchSnippet(body: string, query: string) {
  const collapsedBody = body.replace(/\s+/g, " ").trim();
  if (!collapsedBody) {
    return "Matched in message content.";
  }

  const normalizedBody = collapsedBody.toLocaleLowerCase();
  const normalizedQuery = query.trim().toLocaleLowerCase();
  const matchIndex = normalizedBody.indexOf(normalizedQuery);

  if (matchIndex < 0) {
    return collapsedBody.length > 160
      ? `${collapsedBody.slice(0, 157).trimEnd()}...`
      : collapsedBody;
  }

  const radius = 72;
  const start = Math.max(0, matchIndex - radius);
  const end = Math.min(collapsedBody.length, matchIndex + query.trim().length + radius);
  const prefix = start > 0 ? "..." : "";
  const suffix = end < collapsedBody.length ? "..." : "";

  return `${prefix}${collapsedBody.slice(start, end).trim()}${suffix}`;
}

function getSerializedSearchSenderName(message: {
  senderUser: {
    name: string | null;
    displayName: string | null;
  } | null;
  senderAgent: {
    name: string;
  } | null;
}) {
  if (message.senderUser) {
    return message.senderUser.displayName || message.senderUser.name || "Unknown user";
  }

  if (message.senderAgent) {
    return message.senderAgent.name;
  }

  return null;
}

export function resolveConversationAgentMember(
  conversation: ConversationWithRelations
) {
  return resolveConversationAgentMemberInternal(conversation);
}

export async function listChatProjects() {
  try {
    return await prisma.chatProject.findMany({
      orderBy: { name: "asc" },
      select: {
        id: true,
        name: true,
      },
    });
  } catch (error) {
    if (isMissingChatTablesError(error)) {
      return [];
    }

    throw error;
  }
}

export async function resolveChatProjectSelection(params: {
  projectId?: string | null;
  projectName?: string | null;
}): Promise<{ project: ChatProjectSummary | null; created: boolean }> {
  const requestedProjectId = params.projectId?.trim() ?? "";
  const requestedProjectName = params.projectName?.trim() ?? "";

  if (requestedProjectId) {
    const project = await prisma.chatProject.findUnique({
      where: { id: requestedProjectId },
      select: { id: true, name: true },
    });

    if (!project) {
      throw new Error("Project not found");
    }

    return { project, created: false };
  }

  if (!requestedProjectName) {
    return { project: null, created: false };
  }

  const existingProject = await prisma.chatProject.findFirst({
    where: {
      name: {
        equals: requestedProjectName,
        mode: "insensitive",
      },
    },
    select: { id: true, name: true },
  });

  if (existingProject) {
    return { project: existingProject, created: false };
  }

  const createdProject = await prisma.chatProject.create({
    data: { name: requestedProjectName },
    select: { id: true, name: true },
  });

  return { project: createdProject, created: true };
}

export async function listConversationsForUser(userId: string) {
  return listConversationsForUserWithOptions(userId);
}

export async function listConversationsForUserWithOptions(
  userId: string,
  options: { archived?: ConversationArchiveScope } = {}
) {
  try {
    const conversations = await prisma.conversation.findMany({
      where: {
        ...(options.archived === "only"
          ? { archivedAt: { not: null } }
          : options.archived === "include"
            ? {}
            : { archivedAt: null }),
        members: {
          some: { userId, removedAt: null },
        },
      },
      include: activeConversationInclude,
      orderBy: [{ updatedAt: "desc" }],
    });

    return conversations
      .filter((conversation) => isConversationReadableByUser(conversation, userId, options))
      .map(serializeConversation);
  } catch (error) {
    if (isMissingChatTablesError(error)) {
      return [];
    }

    throw error;
  }
}

export async function getTeamChatConversationAccessSnapshot(params: {
  conversationId: string;
  sessionUserId: string;
  includeArchived?: boolean;
  archived?: ConversationArchiveScope;
}) {
  const archived =
    params.archived ?? (params.includeArchived ? "include" : "exclude");
  const conversation = await prisma.conversation.findUnique({
    where: { id: params.conversationId },
    select: {
      id: true,
      type: true,
      name: true,
      archivedAt: true,
      chatProjectId: true,
      createdAt: true,
      updatedAt: true,
      members: {
        where: { userId: params.sessionUserId },
        orderBy: { joinedAt: "asc" },
        select: {
          userId: true,
          agentId: true,
          joinedAt: true,
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

  return resolveTeamChatConversationAccessSnapshot({
    conversationId: params.conversationId,
    sessionUserId: params.sessionUserId,
    conversation,
    archived,
  });
}

export async function getConversationForMessagesRoute(conversationId: string) {
  return prisma.conversation.findUnique({
    where: { id: conversationId },
    include: activeConversationInclude,
  });
}

export async function getConversationForUser(
  conversationId: string,
  userId: string,
  options: { memberScope?: ConversationMemberScope; archived?: ConversationArchiveScope } = {}
) {
  return getReadableConversationForUser(conversationId, userId, options);
}

export async function getReadableConversationForUser(
  conversationId: string,
  userId: string,
  options: { memberScope?: ConversationMemberScope; archived?: ConversationArchiveScope } = {}
) {
  try {
    const conversation = await prisma.conversation.findFirst({
      where: {
        id: conversationId,
        ...(options.archived === "only"
          ? { archivedAt: { not: null } }
          : options.archived === "include"
            ? {}
            : { archivedAt: null }),
        members: {
          some: { userId, removedAt: null },
        },
      },
      include: options.memberScope === "all" ? allConversationInclude : activeConversationInclude,
    });

    return isConversationReadableByUser(conversation, userId, options) ? conversation : null;
  } catch (error) {
    if (isMissingChatTablesError(error)) {
      return null;
    }

    throw error;
  }
}

export async function listMessagesForConversation(conversationId: string) {
  try {
    const messages = await prisma.chatMessage.findMany({
      where: { conversationId },
      include: messageInclude,
      orderBy: { createdAt: "asc" },
    });

    return messages.map((message) => ({
      id: message.id,
      body: message.body,
      createdAt: message.createdAt.toISOString(),
      sender: message.senderUser
        ? {
            kind: "user" as const,
            id: message.senderUser.id,
            name: message.senderUser.displayName || message.senderUser.name || "Unknown user",
            image: message.senderUser.image,
          }
        : message.senderAgent
          ? {
              kind: "agent" as const,
              id: message.senderAgent.id,
              name: message.senderAgent.name,
              image: message.senderAgent.avatar,
            }
          : null,
    }));
  } catch (error) {
    if (isMissingChatTablesError(error)) {
      return [];
    }

    throw error;
  }
}

export async function findDirectConversation(params: {
  currentUserId: string;
  otherUserId?: string;
  agentId?: string;
}) {
  try {
    const conversations = await prisma.conversation.findMany({
      where: {
        type: "direct",
        archivedAt: null,
        members: {
          some: { userId: params.currentUserId, removedAt: null },
        },
      },
      include: activeConversationInclude,
    });

    return conversations.find((conversation) => {
      const userIds = conversation.members.flatMap((member) => (member.userId ? [member.userId] : []));
      const agentIds = conversation.members.flatMap((member) => (member.agentId ? [member.agentId] : []));

      if (params.otherUserId) {
        return userIds.length === 2
          && agentIds.length === 0
          && userIds.includes(params.currentUserId)
          && userIds.includes(params.otherUserId);
      }

      if (params.agentId) {
        return userIds.length === 1
          && agentIds.length === 1
          && userIds[0] === params.currentUserId
          && agentIds[0] === params.agentId;
      }

      return false;
    });
  } catch (error) {
    if (isMissingChatTablesError(error)) {
      return null;
    }

    throw error;
  }
}

export function isMissingChatTablesError(error: unknown) {
  if (!error || typeof error !== "object") {
    return false;
  }

  const prismaError = error as {
    code?: unknown;
    meta?: {
      table?: unknown;
      column?: unknown;
    };
  };

  const missingChatTable = prismaError.code === "P2021"
    && typeof prismaError.meta?.table === "string"
    && [
      "public.conversations",
      "public.conversation_members",
      "public.chat_messages",
      "public.chat_projects",
      "public.conversation_documents",
    ].includes(prismaError.meta.table);

  const missingColumnName =
    typeof prismaError.meta?.column === "string"
      ? prismaError.meta.column
      : null;
  const normalizedMissingColumn =
    missingColumnName && missingColumnName.includes(".")
      ? missingColumnName.slice(missingColumnName.lastIndexOf(".") + 1)
      : missingColumnName;
  const missingChatColumn = prismaError.code === "P2022"
    && (
      [
        "conversations.chatProjectId",
        "public.conversations.chatProjectId",
        "conversations.repoId",
        "public.conversations.repoId",
        "conversations.archivedAt",
        "public.conversations.archivedAt",
        "conversation_members.removedAt",
        "public.conversation_members.removedAt",
        "ConversationMember.removedAt",
      ].includes(missingColumnName ?? "")
      || [
        "chatProjectId",
        "repoId",
        "archivedAt",
        "removedAt",
      ].includes(normalizedMissingColumn ?? "")
    );

  return missingChatTable || missingChatColumn;
}

export async function searchConversationsForUser(userId: string, rawQuery: string) {
  const query = rawQuery.trim();

  if (!query) {
    return [];
  }

  try {
    const conversations = await prisma.conversation.findMany({
      where: {
        archivedAt: null,
        members: {
          some: { userId, removedAt: null },
        },
        OR: [
          {
            name: {
              contains: query,
              mode: "insensitive",
            },
          },
          {
            chatProject: {
              is: {
                name: {
                  contains: query,
                  mode: "insensitive",
                },
              },
            },
          },
          {
            members: {
              some: {
                removedAt: null,
                OR: [
                  {
                    user: {
                      is: {
                        displayName: {
                          contains: query,
                          mode: "insensitive",
                        },
                      },
                    },
                  },
                  {
                    user: {
                      is: {
                        name: {
                          contains: query,
                          mode: "insensitive",
                        },
                      },
                    },
                  },
                  {
                    user: {
                      is: {
                        email: {
                          contains: query,
                          mode: "insensitive",
                        },
                      },
                    },
                  },
                  {
                    agent: {
                      is: {
                        name: {
                          contains: query,
                          mode: "insensitive",
                        },
                      },
                    },
                  },
                  {
                    agent: {
                      is: {
                        role: {
                          contains: query,
                          mode: "insensitive",
                        },
                      },
                    },
                  },
                ],
              },
            },
          },
          {
            messages: {
              some: {
                body: {
                  contains: query,
                  mode: "insensitive",
                },
              },
            },
          },
        ],
      },
      include: activeConversationInclude,
      orderBy: [{ updatedAt: "desc" }],
      take: SEARCH_RESULT_LIMIT,
    });

    const serializedConversations = conversations.map(serializeConversation);
    const normalizedQuery = query.toLocaleLowerCase();
    const conversationIds = conversations.map((conversation) => conversation.id);
    const matchingMessageByConversationId = new Map<string, Prisma.ChatMessageGetPayload<{ include: typeof messageInclude }>>();

    if (conversationIds.length > 0) {
      const matchingMessages = await prisma.chatMessage.findMany({
        where: {
          conversationId: { in: conversationIds },
          body: {
            contains: query,
            mode: "insensitive",
          },
        },
        include: messageInclude,
        orderBy: [{ createdAt: "desc" }],
      });

      for (const message of matchingMessages) {
        if (!matchingMessageByConversationId.has(message.conversationId)) {
          matchingMessageByConversationId.set(message.conversationId, message);
        }
      }
    }

    return serializedConversations.map((conversation) => {
      const matchingMessage = matchingMessageByConversationId.get(conversation.id);
      if (matchingMessage) {
        return {
          conversation,
          match: {
            kind: "message" as const,
            snippet: buildMessageMatchSnippet(matchingMessage.body, query),
            senderName: getSerializedSearchSenderName(matchingMessage),
            matchedAt: matchingMessage.createdAt.toISOString(),
          },
        };
      }

      const customName = conversation.name?.trim() ?? "";
      if (includesNormalizedQuery(customName, normalizedQuery)) {
        return {
          conversation,
          match: {
            kind: "thread" as const,
            snippet: customName,
            senderName: null,
            matchedAt: conversation.updatedAt,
          },
        };
      }

      const projectName = conversation.project?.name?.trim() || "General";
      if (includesNormalizedQuery(projectName, normalizedQuery)) {
        return {
          conversation,
          match: {
            kind: "project" as const,
            snippet: projectName,
            senderName: null,
            matchedAt: conversation.updatedAt,
          },
        };
      }

      const matchingMember = conversation.members.find((member) =>
        includesNormalizedQuery(member.name, normalizedQuery)
        || includesNormalizedQuery(member.role, normalizedQuery)
        || includesNormalizedQuery(member.email, normalizedQuery)
      );

      if (matchingMember) {
        return {
          conversation,
          match: {
            kind: "participant" as const,
            snippet: matchingMember.role
              ? `${matchingMember.name} / ${matchingMember.role}`
              : matchingMember.name,
            senderName: null,
            matchedAt: conversation.updatedAt,
          },
        };
      }

      return {
        conversation,
        match: {
          kind: "thread" as const,
          snippet: conversation.latestMessage?.body || customName || "Conversation match",
          senderName: null,
          matchedAt: conversation.updatedAt,
        },
      };
    });
  } catch (error) {
    if (isMissingChatTablesError(error)) {
      return [];
    }

    throw error;
  }
}
