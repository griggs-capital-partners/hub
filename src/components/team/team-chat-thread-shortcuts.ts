import type { ConversationSummary } from "@/components/team/team-chat-shared";

export type DirectConversationShortcut = {
  recentConversation: ConversationSummary;
  conversationIds: string[];
};

export type DirectConversationShortcutMaps = {
  userShortcuts: Map<string, DirectConversationShortcut>;
  agentShortcuts: Map<string, DirectConversationShortcut>;
};

function getDirectConversationCounterpart(
  conversation: ConversationSummary,
  currentUserId: string
) {
  return conversation.members.find((member) => member.id !== currentUserId) ?? null;
}

function getConversationSortTimestamp(conversation: ConversationSummary) {
  const timestamp = conversation.latestMessage?.createdAt ?? conversation.updatedAt;
  return new Date(timestamp).getTime();
}

export function buildDirectConversationShortcutMaps(
  conversations: ConversationSummary[],
  currentUserId: string
): DirectConversationShortcutMaps {
  const userShortcuts = new Map<string, DirectConversationShortcut>();
  const agentShortcuts = new Map<string, DirectConversationShortcut>();

  for (const conversation of [...conversations]
    .filter((entry) => entry.type === "direct")
    .sort((left, right) => getConversationSortTimestamp(right) - getConversationSortTimestamp(left))) {
    const counterpart = getDirectConversationCounterpart(conversation, currentUserId);
    if (!counterpart) {
      continue;
    }

    const targetMap = counterpart.kind === "agent" ? agentShortcuts : userShortcuts;
    const existingShortcut = targetMap.get(counterpart.id);

    if (existingShortcut) {
      existingShortcut.conversationIds.push(conversation.id);
      continue;
    }

    targetMap.set(counterpart.id, {
      recentConversation: conversation,
      conversationIds: [conversation.id],
    });
  }

  return {
    userShortcuts,
    agentShortcuts,
  };
}

export function directConversationShortcutContainsConversation(
  shortcut: DirectConversationShortcut | undefined,
  conversationId: string | null
) {
  if (!shortcut || !conversationId) {
    return false;
  }

  return shortcut.conversationIds.includes(conversationId);
}
