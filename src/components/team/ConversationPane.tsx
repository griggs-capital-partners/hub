"use client";

import type { FormEvent, KeyboardEvent, RefObject } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { TOOL_LABELS } from "@/lib/agent-tools";
import { Avatar } from "@/components/ui/Avatar";
import { Button } from "@/components/ui/Button";
import { ThreadDocumentsPanel, type ThreadDocumentUploadState } from "@/components/team/ThreadDocumentsPanel";
import { Textarea } from "@/components/ui/Input";
import {
  ArrowLeft,
  Bot,
  Check,
  Copy,
  Hash,
  MessageSquare,
  Pencil,
  Send,
  Trash2,
  UsersRound,
  Wrench,
  X,
} from "lucide-react";
import { cn } from "@/lib/utils";
import {
  type AgentInspectorData,
  type ChatMessage,
  type ConversationDocumentSummary,
  type ConversationAvatarInfo,
  type ConversationMemberSummary,
  type ConversationSummary,
  chatMarkdownComponents,
  formatMessageTime,
  formatRelativeTime,
  formatThinkingMode,
  formatTokensK,
  getConversationLabel,
  getOnlineStatus,
  MemberAvatar,
  PresenceBadge,
  RadialContextBar,
} from "@/components/team/team-chat-shared";

function ThreadHeader({
  currentUserId,
  activeConversation,
  activeConversationAvatar,
  activeConversationMembers,
  activeConversationParticipantSummary,
  activeConversationWorkspaceLabel,
  activeConversationTimestamp,
  activePartner,
  activeAgentParticipant,
  activeThreadModelLabel,
  threadDrawerOpen,
  threadOriginLabel,
  onBack,
  onOpenThreadTarget,
  onToggleDrawer,
}: {
  currentUserId: string;
  activeConversation: ConversationSummary;
  activeConversationAvatar: ConversationAvatarInfo | null;
  activeConversationMembers: ConversationMemberSummary[];
  activeConversationParticipantSummary: string | null;
  activeConversationWorkspaceLabel: string | null;
  activeConversationTimestamp: string | null;
  activePartner: ConversationMemberSummary | null;
  activeAgentParticipant: ConversationMemberSummary | null;
  activeThreadModelLabel: string | null;
  threadDrawerOpen: boolean;
  threadOriginLabel: string | null;
  onBack: () => void;
  onOpenThreadTarget: () => void;
  onToggleDrawer: () => void;
}) {
  const agentParticipantCount = activeConversation.members.filter((member) => member.kind === "agent").length;

  return (
    <div className="shrink-0 flex items-start justify-between gap-3 border-b border-[rgba(255,255,255,0.06)] px-3 py-3 md:px-5 md:py-4">
      <div className="flex min-w-0 items-start gap-3">
        <button
          onClick={onBack}
          className="flex h-10 w-10 items-center justify-center rounded-2xl border border-[rgba(255,255,255,0.07)] bg-[#181818] text-[#8D877F] md:hidden"
          type="button"
        >
          <ArrowLeft size={18} />
        </button>

        {activeConversationAvatar?.kind === "group" ? (
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[rgba(247,148,29,0.14)] text-[#F7941D]">
            <Hash size={20} />
          </div>
        ) : activeConversationAvatar?.kind === "agent" ? (
          <div className="flex h-12 w-12 items-center justify-center overflow-hidden rounded-2xl border border-[rgba(75,156,211,0.3)] bg-[rgba(75,156,211,0.16)] text-[#7EC8E3]">
            {activeConversationAvatar.image
              ? activeConversationAvatar.image.startsWith("data:") || activeConversationAvatar.image.startsWith("https://")
                ? <img src={activeConversationAvatar.image} alt={activeConversationAvatar.name} className="h-full w-full object-cover" />
                : <span className="text-lg">{activeConversationAvatar.image}</span>
              : <Bot size={20} />}
          </div>
        ) : (
          <Avatar src={activeConversationAvatar?.image} name={activeConversationAvatar?.name} size="lg" />
        )}

        <div className="min-w-0">
          {threadOriginLabel ? (
            <button
              type="button"
              onClick={onBack}
              className="mb-2 inline-flex max-w-full items-center gap-1 rounded-full border border-[rgba(255,255,255,0.06)] bg-[rgba(255,255,255,0.03)] px-2.5 py-1 text-[11px] font-medium text-[#8D877F] transition-colors hover:border-[rgba(247,148,29,0.12)] hover:bg-[rgba(255,255,255,0.05)] hover:text-[#F6F3EE]"
            >
              <ArrowLeft size={12} />
              <span className="truncate">{threadOriginLabel}</span>
            </button>
          ) : null}

          <button
            className={cn(
              "truncate text-left text-base font-semibold text-[#F6F3EE] md:text-lg",
              activePartner ? "hover:text-[#FDBA4D]" : "cursor-default"
            )}
            onClick={onOpenThreadTarget}
            type="button"
          >
            {getConversationLabel(activeConversation, currentUserId)}
          </button>
          <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-[#6F6A64]">
            <div className="flex -space-x-2">
              {activeConversationMembers.slice(0, 4).map((member) => (
                <div key={`${member.kind}-${member.id}`} className="rounded-full ring-2 ring-[#111111]">
                  <MemberAvatar member={member} size="xs" />
                </div>
              ))}
            </div>
            {activeConversationParticipantSummary ? <span>{activeConversationParticipantSummary}</span> : null}
            {activeConversationWorkspaceLabel ? <span>{activeConversationWorkspaceLabel}</span> : null}
            {activeConversationTimestamp ? <span>{formatRelativeTime(activeConversationTimestamp)}</span> : null}
            {activePartner?.kind === "user" ? (
              <PresenceBadge status={getOnlineStatus(activePartner.lastSeen ?? null)} />
            ) : null}
            {activeAgentParticipant && (activeConversation.type === "group" || agentParticipantCount > 1) ? (
              <span>Active agent: {activeAgentParticipant.name}</span>
            ) : null}
            {activeAgentParticipant && activeThreadModelLabel ? <span>{activeThreadModelLabel}</span> : null}
          </div>
        </div>
      </div>

      <div className="flex items-center gap-2">
        <Button
          variant="secondary"
          size="sm"
          className="rounded-2xl px-3"
          icon={<UsersRound size={14} />}
          onClick={onToggleDrawer}
        >
          <span className="hidden md:inline">{threadDrawerOpen ? "Hide Details" : "Thread Details"}</span>
        </Button>
      </div>
    </div>
  );
}

function ThreadComposer({
  currentUserId,
  activeConversation,
  activeAgentParticipant,
  activeAgentReady,
  activeAgentSendBlocked,
  activeAgentBootstrapPending,
  agentInspector,
  messageInput,
  sending,
  onChangeMessageInput,
  onSubmitMessage,
  onSendMessage,
}: {
  currentUserId: string;
  activeConversation: ConversationSummary;
  activeAgentParticipant: ConversationMemberSummary | null;
  activeAgentReady: boolean;
  activeAgentSendBlocked: boolean;
  activeAgentBootstrapPending: boolean;
  agentInspector: AgentInspectorData | null;
  messageInput: string;
  sending: boolean;
  onChangeMessageInput: (value: string) => void;
  onSubmitMessage: (event: FormEvent<HTMLFormElement>) => void | Promise<void>;
  onSendMessage: () => Promise<void>;
}) {
  return activeAgentParticipant && !activeAgentReady && !activeAgentBootstrapPending ? (
    <div className="shrink-0 border-t border-[rgba(255,255,255,0.06)] bg-[#121212] px-3 py-3 md:px-5 md:py-4">
      <div className="flex items-center justify-center gap-2.5 rounded-2xl border border-[rgba(239,68,68,0.15)] bg-[rgba(239,68,68,0.06)] px-4 py-3 text-sm text-[#9A9A9A]">
        <span className="h-2 w-2 shrink-0 rounded-full bg-[#EF4444]" />
        {agentInspector?.readiness.detail || "Agent not online. Configure the LLM connection in the agent profile to start chatting."}
      </div>
    </div>
  ) : (
    <form
      onSubmit={onSubmitMessage}
      className="shrink-0 border-t border-[rgba(255,255,255,0.04)] bg-[linear-gradient(180deg,rgba(18,18,18,0),rgba(18,18,18,0.9)_18%,#121212)] px-3 py-3 md:px-5 md:py-4"
    >
      {activeAgentParticipant && agentInspector ? (
        <div className="mb-2 flex items-center gap-2 text-[11px] text-[#4E4A45]">
          <span className={agentInspector.readiness.label === "Ready" ? "text-[#4ade80]" : "text-[#9FCBE0]"}>
            {agentInspector.readiness.label}
          </span>
          <span className="inline-flex items-center gap-1">
            <RadialContextBar tokens={agentInspector.context.estimatedTokens} />
            <span>{formatTokensK(agentInspector.context.estimatedTokens)} / 128K</span>
          </span>
          <span>{agentInspector.context.recentHistoryCount}/{agentInspector.context.historyWindowSize} msgs</span>
          <span>{formatThinkingMode(agentInspector.agent.llmThinkingMode)} thinking</span>
        </div>
      ) : null}

      <div className="flex items-center gap-2">
        <div className="min-w-0 flex-1">
          <Textarea
            value={messageInput}
            onChange={(event) => onChangeMessageInput(event.target.value)}
            placeholder={
              activeAgentParticipant && activeAgentBootstrapPending
                ? `Preparing ${activeAgentParticipant.name}...`
                : `Message ${getConversationLabel(activeConversation, currentUserId)}...`
            }
            rows={1}
            className="min-h-[52px] w-full resize-none rounded-[24px] border-[rgba(255,255,255,0.05)] bg-[rgba(255,255,255,0.03)] px-4 py-3 shadow-[0_12px_32px_rgba(0,0,0,0.18)] md:min-h-[56px]"
            disabled={sending || activeAgentSendBlocked}
            onKeyDown={(event: KeyboardEvent<HTMLTextAreaElement>) => {
              if (event.key === "Enter" && !event.shiftKey) {
                event.preventDefault();
                void onSendMessage();
              }
            }}
          />
        </div>
        <Button
          type="submit"
          variant="primary"
          size="md"
          disabled={!messageInput.trim() || sending || activeAgentSendBlocked}
          loading={sending}
          className="h-12 w-12 shrink-0 rounded-2xl px-0 md:h-14 md:w-auto md:px-5"
        >
          {!sending ? <Send size={15} /> : null}
        </Button>
      </div>

      <p className="mt-2 hidden text-xs text-[#6F6A64] md:block">
        {activeAgentParticipant
          ? activeAgentBootstrapPending
            ? "We are initializing the model, refreshing readiness, and loading the thread context bundle before input is enabled."
            : "Use Thread Details for participants, readiness, and inspector access."
          : "Workspace-visible thread. Press Enter to send and Shift+Enter for a new line."}
      </p>
    </form>
  );
}

export function ConversationPane({
  currentUserId,
  activeConversation,
  activeConversationAvatar,
  activeConversationMembers,
  activeConversationParticipantSummary,
  activeConversationWorkspaceLabel,
  activeConversationTimestamp,
  activePartner,
  activeAgentParticipant,
  activeThreadModelLabel,
  threadDrawerOpen,
  threadOriginLabel,
  loadingMessages,
  rawMessageCount,
  renderedMessages,
  messageInput,
  sending,
  editingMessageId,
  editingDraft,
  savingMessageId,
  deletingMessageId,
  copiedMessageId,
  chatScrollRef,
  bottomRef,
  threadDocumentUploads,
  threadDocumentError,
  removingDocumentId,
  activeAgentReady,
  activeAgentSendBlocked,
  activeAgentBootstrapPending,
  agentInspector,
  agentInspectorError,
  onBack,
  onOpenThreadTarget,
  onOpenActiveAgentProfile,
  onToggleDrawer,
  onHandleChatScroll,
  onChangeMessageInput,
  onUploadThreadDocuments,
  onSubmitMessage,
  onSendMessage,
  onChangeEditingDraft,
  onCancelEditingMessage,
  onSaveEditedMessage,
  onRemoveThreadDocument,
  onDismissThreadUpload,
  onCopyMessage,
  onStartEditingMessage,
  onDeleteMessage,
}: {
  currentUserId: string;
  activeConversation: ConversationSummary | null;
  activeConversationAvatar: ConversationAvatarInfo | null;
  activeConversationMembers: ConversationMemberSummary[];
  activeConversationParticipantSummary: string | null;
  activeConversationWorkspaceLabel: string | null;
  activeConversationTimestamp: string | null;
  activePartner: ConversationMemberSummary | null;
  activeAgentParticipant: ConversationMemberSummary | null;
  activeThreadModelLabel: string | null;
  threadDrawerOpen: boolean;
  threadOriginLabel: string | null;
  loadingMessages: boolean;
  rawMessageCount: number;
  renderedMessages: ChatMessage[];
  messageInput: string;
  sending: boolean;
  editingMessageId: string | null;
  editingDraft: string;
  savingMessageId: string | null;
  deletingMessageId: string | null;
  copiedMessageId: string | null;
  chatScrollRef: RefObject<HTMLDivElement | null>;
  bottomRef: RefObject<HTMLDivElement | null>;
  threadDocumentUploads: ThreadDocumentUploadState[];
  threadDocumentError: string | null;
  removingDocumentId: string | null;
  activeAgentReady: boolean;
  activeAgentSendBlocked: boolean;
  activeAgentBootstrapPending: boolean;
  agentInspector: AgentInspectorData | null;
  agentInspectorError: string | null;
  onBack: () => void;
  onOpenThreadTarget: () => void;
  onOpenActiveAgentProfile: () => void;
  onToggleDrawer: () => void;
  onHandleChatScroll: () => void;
  onChangeMessageInput: (value: string) => void;
  onUploadThreadDocuments: (files: File[]) => void;
  onSubmitMessage: (event: FormEvent<HTMLFormElement>) => void | Promise<void>;
  onSendMessage: () => Promise<void>;
  onChangeEditingDraft: (value: string) => void;
  onCancelEditingMessage: () => void;
  onSaveEditedMessage: (messageId: string) => Promise<void>;
  onRemoveThreadDocument: (document: ConversationDocumentSummary) => Promise<void>;
  onDismissThreadUpload: (uploadId: string) => void;
  onCopyMessage: (body: string, messageId: string) => void;
  onStartEditingMessage: (message: ChatMessage) => void;
  onDeleteMessage: (messageId: string) => Promise<void>;
}) {
  const mixedAgentThread = (activeConversation?.members.filter((member) => member.kind === "agent").length ?? 0) > 1;

  return (
    <section className={cn("flex min-h-0 flex-col overflow-hidden", !activeConversation ? "hidden md:flex" : "flex")}>
      {activeConversation ? (
        <>
          <ThreadHeader
            currentUserId={currentUserId}
            activeConversation={activeConversation}
            activeConversationAvatar={activeConversationAvatar}
            activeConversationMembers={activeConversationMembers}
            activeConversationParticipantSummary={activeConversationParticipantSummary}
            activeConversationWorkspaceLabel={activeConversationWorkspaceLabel}
            activeConversationTimestamp={activeConversationTimestamp}
            activePartner={activePartner}
            activeAgentParticipant={activeAgentParticipant}
            activeThreadModelLabel={activeThreadModelLabel}
            threadDrawerOpen={threadDrawerOpen}
            threadOriginLabel={threadOriginLabel}
            onBack={onBack}
            onOpenThreadTarget={onOpenThreadTarget}
            onToggleDrawer={onToggleDrawer}
          />

          <div
            ref={chatScrollRef}
            onScroll={onHandleChatScroll}
            className="chat-scroll flex-1 overflow-y-auto overflow-x-hidden bg-[radial-gradient(circle_at_top,rgba(255,255,255,0.035),transparent_58%)] px-4 py-5 md:min-h-0 md:px-8 md:py-8"
          >
            {loadingMessages && rawMessageCount === 0 ? (
              <div className="flex h-full items-center justify-center">
                <div className="h-6 w-6 rounded-full border-2 border-[rgba(247,148,29,0.2)] border-t-[#F7941D] animate-spin" />
              </div>
            ) : activeAgentParticipant && activeAgentBootstrapPending ? (
              <div className="flex h-full flex-col items-center justify-center px-8 text-center">
                <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-3xl bg-[rgba(75,156,211,0.12)] text-[#7EC8E3]">
                  <Bot size={28} />
                </div>
                <p className="text-lg font-semibold text-[#F6F3EE]">Initializing {activeAgentParticipant.name}</p>
                <p className="mt-1 max-w-md text-sm leading-6 text-[#8D877F]">
                  Checking the model connection, loading recent conversation history, and preparing the context bundle.
                </p>
                <div className="mt-4 flex items-center gap-2 rounded-2xl border border-[rgba(75,156,211,0.16)] bg-[rgba(75,156,211,0.08)] px-4 py-3 text-sm text-[#9FCBE0]">
                  <div className="h-4 w-4 rounded-full border-2 border-[rgba(126,200,227,0.2)] border-t-[#7EC8E3] animate-spin" />
                  <span>Preparing a clean start before you type</span>
                </div>
              </div>
            ) : activeAgentParticipant && !activeAgentReady ? (
              <div className="flex h-full flex-col items-center justify-center px-8 text-center">
                <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-3xl bg-[rgba(75,156,211,0.12)] text-[#7EC8E3]">
                  <Bot size={28} />
                </div>
                <p className="text-lg font-semibold text-[#F6F3EE]">{activeAgentParticipant.name} isn&apos;t ready to chat yet</p>
                <p className="mt-1 max-w-md text-sm leading-6 text-[#8D877F]">
                  {agentInspectorError || agentInspector?.readiness.detail || "Connect this agent's LLM brain on the profile page before starting a conversation."}
                </p>
                <Button variant="secondary" size="sm" className="mt-4" onClick={onOpenActiveAgentProfile}>
                  Open Agent Profile
                </Button>
              </div>
            ) : renderedMessages.length === 0 ? (
              <div className="flex h-full flex-col items-center justify-center text-center">
                <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-3xl bg-[rgba(247,148,29,0.12)] text-[#F7941D]">
                  <MessageSquare size={28} />
                </div>
                <p className="text-lg font-semibold text-[#F6F3EE]">Start the conversation</p>
                <p className="mt-1 max-w-md text-sm text-[#8D877F]">
                  {activeConversation.type === "group"
                    ? "Drop the first update, question, or decision into this channel."
                    : `Send a quick message to ${getConversationLabel(activeConversation, currentUserId)}.`}
                </p>
              </div>
            ) : (
              <div className="mx-auto flex w-full max-w-[52rem] flex-col gap-6 pb-6">
                {renderedMessages.map((message) => {
                  const isCurrentUser = message.sender?.id === currentUserId && message.sender?.kind === "user";
                  const isEditing = editingMessageId === message.id;
                  const showMixedAgentAttribution = mixedAgentThread && message.sender?.kind === "agent";

                  return (
                    <div
                      key={message.id}
                      className={cn("group flex items-start gap-4", isCurrentUser ? "justify-end" : "justify-start")}
                    >
                      {!isCurrentUser ? (
                        message.sender?.kind === "agent" ? (
                          <div className="flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-2xl border border-[rgba(75,156,211,0.18)] bg-[rgba(75,156,211,0.1)] text-[#7EC8E3]">
                            {message.sender.image
                              ? message.sender.image.startsWith("data:") || message.sender.image.startsWith("https://")
                                ? <img src={message.sender.image} alt={message.sender.name ?? ""} className="h-full w-full object-cover" />
                                : <span>{message.sender.image}</span>
                              : <Bot size={16} />}
                          </div>
                        ) : (
                          <Avatar src={message.sender?.image} name={message.sender?.name} size="sm" />
                        )
                      ) : null}

                      <div
                        className={cn("min-w-0 max-w-[88%] md:max-w-[44rem]", isCurrentUser ? "items-end" : "items-start")}
                        style={{ display: "flex", flexDirection: "column" }}
                      >
                        {!isCurrentUser && message.sender?.name ? (
                          showMixedAgentAttribution ? (
                            <div className="mb-1 flex items-center gap-2 px-1">
                              <span className="rounded-full border border-[rgba(75,156,211,0.18)] bg-[rgba(75,156,211,0.08)] px-2 py-0.5 text-[9px] font-semibold uppercase tracking-[0.18em] text-[#9FCBE0]">
                                Agent
                              </span>
                              <p className="text-[11px] font-semibold text-[#A9DCF3]">
                                {message.sender.name}
                              </p>
                            </div>
                          ) : (
                            <p className="mb-0.5 px-1 text-[11px] font-medium text-[#8D877F]">{message.sender.name}</p>
                          )
                        ) : null}

                        {isEditing ? (
                          <div
                            className="w-full rounded-[22px] border border-[rgba(247,148,29,0.2)] bg-[rgba(255,255,255,0.04)] p-3"
                            style={{ minWidth: "280px" }}
                          >
                            <Textarea
                              value={editingDraft}
                              onChange={(event) => onChangeEditingDraft(event.target.value)}
                              rows={3}
                              className="min-h-[88px] border-[rgba(255,255,255,0.08)] bg-[#191919]"
                            />
                            <div className="mt-2 flex justify-end gap-2">
                              <button
                                onClick={onCancelEditingMessage}
                                className="flex h-8 w-8 items-center justify-center rounded-xl border border-[rgba(255,255,255,0.08)] bg-[#181818] text-[#8D877F] transition-colors hover:text-[#F6F3EE]"
                                type="button"
                                title="Cancel"
                              >
                                <X size={14} />
                              </button>
                              <button
                                onClick={() => void onSaveEditedMessage(message.id)}
                                className="flex h-8 w-8 items-center justify-center rounded-xl bg-[#F7941D] text-[#111111] transition-opacity hover:opacity-90 disabled:opacity-50"
                                type="button"
                                disabled={!editingDraft.trim() || savingMessageId === message.id}
                                title="Save"
                              >
                                {savingMessageId === message.id ? (
                                  <div className="h-3.5 w-3.5 rounded-full border-2 border-[#111111]/20 border-t-[#111111] animate-spin" />
                                ) : (
                                  <Check size={14} />
                                )}
                              </button>
                            </div>
                          </div>
                        ) : (
                          <div
                            className={cn(
                              "chat-scroll max-h-[min(60vh,36rem)] overflow-y-auto overflow-x-hidden text-sm leading-6 [overflow-wrap:anywhere]",
                              isCurrentUser
                                ? "rounded-[24px] px-4 py-3 shadow-sm"
                                : message.sender?.kind === "agent"
                                  ? "px-1 py-1.5"
                                  : "rounded-[22px] px-4 py-3"
                            )}
                            style={
                              isCurrentUser
                                ? {
                                  background: "linear-gradient(135deg, rgba(247,148,29,0.22), rgba(247,148,29,0.1))",
                                  color: "#F6F3EE",
                                  border: "1px solid rgba(247,148,29,0.08)",
                                  borderBottomRightRadius: "6px",
                                }
                                : message.sender?.kind === "agent"
                                  ? {
                                    background: "transparent",
                                    color: "#F6F3EE",
                                    border: "none",
                                    boxShadow: "none",
                                  }
                                  : {
                                    background: "rgba(255,255,255,0.03)",
                                    color: "#F6F3EE",
                                    border: "1px solid rgba(255,255,255,0.05)",
                                    borderBottomLeftRadius: "6px",
                                  }
                            }
                          >
                            {message.thinking ? (
                              <div className="mb-2 rounded-xl border border-[rgba(255,255,255,0.08)] bg-[rgba(0,0,0,0.18)] px-3 py-2">
                                <p className="mb-1 text-[10px] font-semibold uppercase tracking-[0.18em] text-[#8D877F]">
                                  Thinking
                                </p>
                                <p className="whitespace-pre-wrap text-xs leading-5 text-[#CFC9C2] [overflow-wrap:anywhere]">{message.thinking}</p>
                                {message.isStreaming && !message.body ? (
                                  <div className="mt-2 flex items-center gap-2 text-[11px] text-[#9FCBE0]">
                                    <div className="h-3 w-3 rounded-full border-2 border-[rgba(126,200,227,0.2)] border-t-[#7EC8E3] animate-spin" />
                                    <span>
                                      {message.streamState === "responding"
                                        ? "Turning thoughts into a reply..."
                                        : "Thinking through it..."}
                                    </span>
                                  </div>
                                ) : null}
                              </div>
                            ) : null}

                            {message.body ? (
                              message.sender?.kind === "agent" ? (
                                <div className="[overflow-wrap:anywhere] prose-chat">
                                  <ReactMarkdown remarkPlugins={[remarkGfm]} components={chatMarkdownComponents}>
                                    {message.body}
                                  </ReactMarkdown>
                                </div>
                              ) : (
                                <div className="whitespace-pre-wrap [overflow-wrap:anywhere]">{message.body}</div>
                              )
                            ) : message.isStreaming ? (
                              <div className="flex items-center gap-2 text-[#CFC9C2]">
                                <div className="h-3.5 w-3.5 rounded-full border-2 border-[rgba(126,200,227,0.2)] border-t-[#7EC8E3] animate-spin" />
                                <span>
                                  {message.streamState === "using_tools"
                                    ? "Working on it..."
                                    : message.streamState === "responding"
                                      ? "Drafting reply..."
                                      : message.thinkingEnabled === false
                                        ? "Gathering context..."
                                        : message.thinking
                                          ? "Thinking through it..."
                                          : "Thinking..."}
                                </span>
                              </div>
                            ) : null}

                            {message.isStreaming && message.body ? (
                              <div className="mt-2 flex items-center gap-2 text-[11px] text-[#9FCBE0]">
                                <div className="h-3 w-3 rounded-full border-2 border-[rgba(126,200,227,0.2)] border-t-[#7EC8E3] animate-spin" />
                                <span>Streaming reply...</span>
                              </div>
                            ) : null}

                            {message.toolActivity && message.toolActivity.length > 0 ? (
                              <div className="mt-2 rounded-xl border border-[rgba(126,200,227,0.15)] bg-[rgba(75,156,211,0.07)] px-3 py-2">
                                <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-[0.18em] text-[#7EC8E3]">
                                  Actions Taken
                                </p>
                                <div className="flex flex-col gap-1">
                                  {message.toolActivity.map((tool) => (
                                    <div key={tool.id} className="flex items-center gap-2 text-[11px]">
                                      {tool.status === "running" ? (
                                        <div className="h-3 w-3 shrink-0 rounded-full border-2 border-[rgba(126,200,227,0.2)] border-t-[#7EC8E3] animate-spin" />
                                      ) : (
                                        <Wrench size={11} className="shrink-0 text-[#7EC8E3]" />
                                      )}
                                      <span className="text-[#A9DCF3]">
                                        {TOOL_LABELS[tool.name] ?? tool.name}
                                      </span>
                                      {tool.status === "running" ? (
                                        <span className="text-[#5A8FA8]">...</span>
                                      ) : null}
                                    </div>
                                  ))}
                                </div>
                              </div>
                            ) : null}

                            {message.retrievalSources && message.retrievalSources.length > 0 ? (
                              <div className="mt-3 rounded-xl border border-[rgba(255,255,255,0.08)] bg-[rgba(0,0,0,0.18)] px-3 py-2">
                                <p className="mb-2 text-[10px] font-semibold uppercase tracking-[0.18em] text-[#8D877F]">
                                  Resolved Context Sources
                                </p>
                                <div className="flex flex-wrap gap-1.5">
                                  {message.retrievalSources.map((source, index) => (
                                    <span
                                      key={`${source.kind}-${source.target}-${index}`}
                                      className="rounded-full border border-[rgba(75,156,211,0.18)] bg-[rgba(75,156,211,0.08)] px-2 py-1 text-[10px] text-[#A9DCF3]"
                                      title={`${source.target} - ${source.detail}`}
                                    >
                                      {source.status === "unsupported"
                                        ? `Unsupported - ${source.label}`
                                        : source.status === "failed"
                                          ? `Failed - ${source.label}`
                                          : source.status === "unavailable"
                                            ? `Unavailable - ${source.label}`
                                            : `Used - ${source.label}`}
                                    </span>
                                  ))}
                                </div>
                              </div>
                            ) : null}
                          </div>
                        )}

                        {!isEditing && message.body ? (
                          <div
                            className={cn(
                              "mt-1 flex items-center gap-2 px-1 transition-opacity",
                              isCurrentUser ? "opacity-0 group-hover:opacity-100" : "opacity-100 md:opacity-0 md:group-hover:opacity-100"
                            )}
                          >
                            <button
                              onClick={() => onCopyMessage(message.body, message.id)}
                              type="button"
                              className="flex items-center gap-1 text-[11px] text-[#8D877F] transition-colors hover:text-[#F6F3EE]"
                            >
                              <Copy size={12} />
                              {copiedMessageId === message.id ? "Copied" : "Copy"}
                            </button>
                            {isCurrentUser ? (
                              <>
                                <button
                                  onClick={() => onStartEditingMessage(message)}
                                  type="button"
                                  className="flex items-center gap-1 text-[11px] text-[#8D877F] transition-colors hover:text-[#F6F3EE]"
                                >
                                  <Pencil size={12} />
                                  Edit
                                </button>
                                <button
                                  onClick={() => void onDeleteMessage(message.id)}
                                  type="button"
                                  disabled={deletingMessageId === message.id}
                                  className="flex items-center gap-1 text-[11px] text-[#8D877F] transition-colors hover:text-[#EF4444] disabled:opacity-50"
                                >
                                  <Trash2 size={12} />
                                  Delete
                                </button>
                              </>
                            ) : null}
                          </div>
                        ) : null}

                        <p className="mt-0.5 px-1 text-[10px] text-[#6F6A64]">{formatMessageTime(message.createdAt)}</p>
                      </div>
                    </div>
                  );
                })}
                <div ref={bottomRef} />
              </div>
            )}
          </div>

          <div className="shrink-0 border-t border-[rgba(255,255,255,0.04)] bg-[#121212] px-3 pb-3 md:px-5 md:pb-4">
            <div className="mx-auto w-full max-w-[52rem]">
              <ThreadDocumentsPanel
                conversationId={activeConversation.id}
                documents={activeConversation.documents}
                uploads={threadDocumentUploads}
                error={threadDocumentError}
                canUpload
                canRemove
                removingDocumentId={removingDocumentId}
                uploadButtonLabel="Attach Files"
                description="Upload supporting files directly into this thread and keep them attached to the conversation."
                onUpload={onUploadThreadDocuments}
                onRemoveDocument={(document) => void onRemoveThreadDocument(document)}
                onDismissUpload={onDismissThreadUpload}
              />
            </div>
          </div>
          <ThreadComposer
            currentUserId={currentUserId}
            activeConversation={activeConversation}
            activeAgentParticipant={activeAgentParticipant}
            activeAgentReady={activeAgentReady}
            activeAgentSendBlocked={activeAgentSendBlocked}
            activeAgentBootstrapPending={activeAgentBootstrapPending}
            agentInspector={agentInspector}
            messageInput={messageInput}
            sending={sending}
            onChangeMessageInput={onChangeMessageInput}
            onSubmitMessage={onSubmitMessage}
            onSendMessage={onSendMessage}
          />
        </>
      ) : (
        <div className="hidden h-full flex-col items-center justify-center bg-[radial-gradient(circle_at_center,rgba(247,148,29,0.08),transparent_34%)] px-8 text-center md:flex">
          <div className="mb-4 flex h-20 w-20 items-center justify-center rounded-[28px] bg-[rgba(247,148,29,0.12)] text-[#F7941D]">
            <MessageSquare size={34} />
          </div>
          <h2 className="text-2xl font-semibold text-[#F6F3EE]">Choose a thread to jump in</h2>
          <p className="mt-2 max-w-lg text-sm leading-6 text-[#8D877F]">
            Recent workspace-visible threads live in the left rail. Start a new chat above or open a teammate, agent, or workspace thread from the list.
          </p>
        </div>
      )}
    </section>
  );
}
