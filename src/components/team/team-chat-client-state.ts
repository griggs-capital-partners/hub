import type { ConversationSummary } from "@/components/team/team-chat-shared";

export type ConversationDetail404Resolution =
  | {
      action: "keep";
      conversations: ConversationSummary[];
      errorMessage: string;
    }
  | {
      action: "remove";
      conversations: ConversationSummary[];
    }
  | {
      action: "unknown";
      conversations: ConversationSummary[];
      errorMessage: string;
    };

export function resolveConversationDetail404State(params: {
  conversationId: string;
  currentConversations: ConversationSummary[];
  refreshedConversations: ConversationSummary[] | null;
  route: "messages" | "inspect" | "refresh";
}): ConversationDetail404Resolution {
  const fallbackMessage =
    params.route === "inspect"
      ? "The thread is still visible, but the inspector could not be loaded yet."
      : "The thread is still visible, but messages could not be loaded yet.";

  if (!params.refreshedConversations) {
    return {
      action: "unknown",
      conversations: params.currentConversations,
      errorMessage: fallbackMessage,
    };
  }

  if (params.refreshedConversations.some((conversation) => conversation.id === params.conversationId)) {
    return {
      action: "keep",
      conversations: params.refreshedConversations,
      errorMessage: fallbackMessage,
    };
  }

  return {
    action: "remove",
    conversations: params.refreshedConversations,
  };
}

export function shouldShowThreadStillHereState(params: {
  messagesError: string | null;
  renderedMessageCount: number;
}) {
  return Boolean(params.messagesError && params.renderedMessageCount === 0);
}
