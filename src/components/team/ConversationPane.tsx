"use client";

import { memo, useRef, useState, type ChangeEvent, type DragEvent, type FormEvent, type KeyboardEvent, type RefObject } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { TOOL_LABELS } from "@/lib/agent-tools";
import { Button } from "@/components/ui/Button";
import {
  TeamChatPerfBoundary,
  useTeamChatPerfCommit,
} from "@/components/team/team-chat-performance";
import { type ThreadDocumentUploadState } from "@/components/team/ThreadDocumentsPanel";
import { Textarea } from "@/components/ui/Input";
import {
  AlertTriangle,
  ArrowLeft,
  Bot,
  ChevronDown,
  Check,
  Copy,
  Loader2,
  MessageSquare,
  Paperclip,
  Pencil,
  Send,
  Trash2,
  UsersRound,
  Wrench,
  X,
} from "lucide-react";
import { CONVERSATION_DOCUMENT_ACCEPT } from "@/lib/conversation-documents";
import { cn } from "@/lib/utils";
import {
  type AgentInspectorData,
  type ChatMessage,
  type ConversationMemberSummary,
  type ConversationSummary,
  MemberAvatar,
  chatMarkdownComponents,
  formatMessageTime,
  formatRelativeTime,
  getConversationLabel,
} from "@/components/team/team-chat-shared";
import { shouldShowThreadStillHereState } from "@/components/team/team-chat-client-state";

const CONVERSATION_COLUMN_CLASS = "mx-auto w-full max-w-[60rem]";
const HUMAN_MESSAGE_WIDTH_CLASS = "w-full max-w-[85%] md:max-w-[48rem]";

function eventHasFiles(event: DragEvent<HTMLElement>) {
  return Array.from(event.dataTransfer.items ?? []).some((item) => item.kind === "file")
    || Array.from(event.dataTransfer.types ?? []).includes("Files");
}

function getStreamingStatusLabel(message: ChatMessage) {
  if (!message.isStreaming) {
    return null;
  }

  if (message.streamState === "preparing") {
    return "Preparing response...";
  }

  if (message.streamState === "reading_context") {
    return "Reading thread context...";
  }

  if (message.streamState === "using_tools") {
    return "Working with tools...";
  }

  if (message.streamState === "responding") {
    return message.body ? "Generating response..." : "Drafting response...";
  }

  if (message.thinkingEnabled === false) {
    return "Gathering context...";
  }

  if (message.thinking) {
    return "Thinking through it...";
  }

  return "Thinking...";
}

function getSpeakerLabel(
  message: ChatMessage,
  currentUserId: string,
  mixedAgentThread: boolean
) {
  if (message.sender?.kind === "user") {
    return message.sender.id === currentUserId ? "You" : message.sender.name || "User";
  }

  if (message.sender?.kind === "agent") {
    return mixedAgentThread && message.sender.name ? `Agent · ${message.sender.name}` : (message.sender.name || "Assistant");
  }

  return message.sender?.name || "Unknown";
}

function getMessageRenderKey(message: ChatMessage) {
  const senderKind = message.sender?.kind ?? "message";
  return message.clientRequestId ? `${senderKind}:${message.clientRequestId}` : message.id;
}

function MessageOperationalDetails({
  message,
  hideStreamingLabel = false,
}: {
  message: ChatMessage;
  hideStreamingLabel?: boolean;
}) {
  const hasThinking = Boolean(message.thinking?.trim());
  const toolCount = message.toolActivity?.length ?? 0;
  const retrievalCount = message.retrievalSources?.length ?? 0;
  const retrievalIssueCount =
    message.retrievalSources?.filter((source) => source.status && source.status !== "used").length ?? 0;
  const hasRunningTool = message.toolActivity?.some((tool) => tool.status === "running") ?? false;
  const streamingLabel = getStreamingStatusLabel(message);
  const hasInspectableDetails = hasThinking || toolCount > 0 || retrievalCount > 0;

  if ((!streamingLabel || hideStreamingLabel) && !hasInspectableDetails) {
    return null;
  }

  return (
    <div className="mt-2 space-y-2">
      {streamingLabel && !hideStreamingLabel ? (
        <div className="flex items-center gap-2 px-1 text-[11px] text-[#8D877F]">
          <div className="h-3 w-3 shrink-0 rounded-full border-2 border-[rgba(126,200,227,0.18)] border-t-[#7EC8E3] animate-spin" />
          <span>{streamingLabel}</span>
        </div>
      ) : null}

      {hasInspectableDetails ? (
        <details className="rounded-2xl border border-[rgba(255,255,255,0.06)] bg-[rgba(255,255,255,0.025)]">
          <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-3 py-2 text-[11px] text-[#8D877F] [&::-webkit-details-marker]:hidden">
            <span className="flex min-w-0 flex-wrap items-center gap-2">
              <span className="font-medium text-[#CFC9C2]">Details</span>
              {hasThinking ? (
                <span className="rounded-full border border-[rgba(255,255,255,0.06)] bg-[rgba(255,255,255,0.04)] px-2 py-0.5 text-[10px] text-[#A8A29C]">
                  Thinking
                </span>
              ) : null}
              {toolCount > 0 ? (
                <span className="rounded-full border border-[rgba(75,156,211,0.16)] bg-[rgba(75,156,211,0.08)] px-2 py-0.5 text-[10px] text-[#A9DCF3]">
                  {hasRunningTool ? "Working" : "Actions"} {toolCount}
                </span>
              ) : null}
              {retrievalCount > 0 ? (
                <span
                  className={cn(
                    "rounded-full border px-2 py-0.5 text-[10px]",
                    retrievalIssueCount > 0
                      ? "border-[rgba(247,148,29,0.18)] bg-[rgba(247,148,29,0.08)] text-[#F6C177]"
                      : "border-[rgba(255,255,255,0.06)] bg-[rgba(255,255,255,0.04)] text-[#A8A29C]"
                  )}
                >
                  {retrievalIssueCount > 0
                    ? `${retrievalIssueCount} issue${retrievalIssueCount === 1 ? "" : "s"}`
                    : `${retrievalCount} source${retrievalCount === 1 ? "" : "s"}`}
                </span>
              ) : null}
            </span>
            <ChevronDown size={12} className="shrink-0 text-[#6F6A64]" />
          </summary>

          <div className="space-y-3 border-t border-[rgba(255,255,255,0.05)] px-3 py-3">
            {hasThinking ? (
              <div>
                <p className="mb-1 text-[10px] font-semibold uppercase tracking-[0.18em] text-[#8D877F]">
                  Thinking
                </p>
                <p className="whitespace-pre-wrap text-xs leading-5 text-[#CFC9C2] [overflow-wrap:anywhere]">{message.thinking}</p>
              </div>
            ) : null}

            {toolCount > 0 ? (
              <div>
                <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-[0.18em] text-[#7EC8E3]">
                  Actions Taken
                </p>
                <div className="flex flex-col gap-1">
                  {message.toolActivity?.map((tool) => (
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

            {retrievalCount > 0 ? (
              <div>
                <p className="mb-2 text-[10px] font-semibold uppercase tracking-[0.18em] text-[#8D877F]">
                  Resolved Context Sources
                </p>
                <div className="flex flex-wrap gap-1.5">
                  {message.retrievalSources?.map((source, index) => (
                    <span
                      key={`${source.kind}-${source.target}-${index}`}
                      className={cn(
                        "rounded-full border px-2 py-1 text-[10px]",
                        source.status === "failed" || source.status === "unsupported" || source.status === "unavailable"
                          ? "border-[rgba(247,148,29,0.18)] bg-[rgba(247,148,29,0.08)] text-[#F6C177]"
                          : "border-[rgba(75,156,211,0.18)] bg-[rgba(75,156,211,0.08)] text-[#A9DCF3]"
                      )}
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
        </details>
      ) : null}
    </div>
  );
}

function AgentStatusCard({ message }: { message: ChatMessage }) {
  const failed = message.clientState === "failed_assistant";
  const streamingLabel = failed ? "Response failed" : (getStreamingStatusLabel(message) ?? "Thinking...");
  const thinkingPreview = message.thinking?.trim();

  return (
    <div
      className={cn(
        "min-h-[88px] rounded-[24px] border px-4 py-3",
        failed
          ? "border-[rgba(239,68,68,0.16)] bg-[linear-gradient(180deg,rgba(239,68,68,0.08),rgba(255,255,255,0.015))]"
          : "border-[rgba(126,200,227,0.16)] bg-[linear-gradient(180deg,rgba(126,200,227,0.08),rgba(255,255,255,0.015))]"
      )}
    >
      <div className={cn("flex items-center gap-2 text-sm", failed ? "text-[#F3C1C1]" : "text-[#DCEFF8]")}>
        {failed ? (
          <AlertTriangle size={15} className="shrink-0 text-[#EF4444]" />
        ) : (
          <div className="h-4 w-4 shrink-0 rounded-full border-2 border-[rgba(126,200,227,0.2)] border-t-[#7EC8E3] animate-spin" />
        )}
        <span>{streamingLabel}</span>
      </div>
      {failed ? (
        <p className="mt-3 text-xs leading-5 text-[#F2C0C0]">
          The assistant could not finish this response. The thread stayed intact, and you can retry.
        </p>
      ) : (
        <>
          <div className="mt-3 space-y-2">
            <div className="h-2 w-24 rounded-full bg-[rgba(255,255,255,0.08)]" />
            <div className="h-2 max-w-[28rem] rounded-full bg-[rgba(255,255,255,0.06)]" />
            <div className="h-2 w-[72%] rounded-full bg-[rgba(255,255,255,0.05)]" />
          </div>
          {thinkingPreview ? (
            <p className="mt-3 max-h-10 overflow-hidden text-xs leading-5 text-[#A9DCF3] [overflow-wrap:anywhere]">
              {thinkingPreview}
            </p>
          ) : null}
        </>
      )}
    </div>
  );
}

function MessageLifecycleState({ message }: { message: ChatMessage }) {
  if (message.clientState !== "failed_user") {
    return null;
  }

  return (
    <div className="mt-2 flex items-center gap-2 px-1 text-[11px] text-[#F2C0C0]">
      <AlertTriangle size={12} className="shrink-0 text-[#EF4444]" />
      <span>Failed to send. Your message is still here.</span>
    </div>
  );
}

function ThreadHeader({
  currentUserId,
  activeConversation,
  activeConversationParticipantSummary,
  activeConversationWorkspaceLabel,
  activeConversationTimestamp,
  activePartner,
  attachmentCount,
  threadDrawerOpen,
  threadOriginLabel,
  onBack,
  onOpenThreadTarget,
  onToggleDrawer,
}: {
  currentUserId: string;
  activeConversation: ConversationSummary;
  activeConversationParticipantSummary: string | null;
  activeConversationWorkspaceLabel: string | null;
  activeConversationTimestamp: string | null;
  activePartner: ConversationMemberSummary | null;
  attachmentCount: number;
  threadDrawerOpen: boolean;
  threadOriginLabel: string | null;
  onBack: () => void;
  onOpenThreadTarget: () => void;
  onToggleDrawer: () => void;
}) {
  const metaItems = [
    activeConversationParticipantSummary,
    activeConversationWorkspaceLabel,
    activeConversationTimestamp ? formatRelativeTime(activeConversationTimestamp) : null,
  ].filter((value): value is string => Boolean(value));
  const visibleMembers = activeConversation.members.slice(0, 4);
  const overflowMemberCount = Math.max(activeConversation.members.length - visibleMembers.length, 0);

  return (
    <div className="shrink-0 border-b border-[rgba(255,255,255,0.05)] px-3 py-3 md:px-6 md:py-4">
      <div className={cn(CONVERSATION_COLUMN_CLASS, "flex items-start justify-between gap-3")}>
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <button
              onClick={onBack}
              className="flex h-9 w-9 items-center justify-center rounded-full border border-[rgba(255,255,255,0.07)] bg-[rgba(255,255,255,0.03)] text-[#8D877F] md:hidden"
              type="button"
            >
              <ArrowLeft size={16} />
            </button>
            {threadOriginLabel ? (
              <button
                type="button"
                onClick={onBack}
                className="hidden max-w-full items-center gap-1 text-xs font-medium text-[#7D7770] transition-colors hover:text-[#F6F3EE] md:inline-flex"
              >
                <ArrowLeft size={12} />
                <span className="truncate">{threadOriginLabel}</span>
              </button>
            ) : null}
          </div>

          <button
            className={cn(
              "mt-1 truncate text-left text-[1.05rem] font-semibold text-[#F6F3EE] md:text-[1.1rem]",
              activePartner ? "hover:text-[#FDBA4D]" : "cursor-default"
            )}
            onClick={onOpenThreadTarget}
            type="button"
          >
            {getConversationLabel(activeConversation, currentUserId)}
          </button>

          <div className="mt-2 flex items-center gap-2">
            <div className="flex -space-x-2">
              {visibleMembers.map((member) => (
                <div key={`${member.kind}-${member.id}`} className="rounded-full ring-2 ring-[#121212]">
                  <MemberAvatar member={member} size="xs" />
                </div>
              ))}
              {overflowMemberCount > 0 ? (
                <span className="flex h-6 w-6 items-center justify-center rounded-full border border-[rgba(255,255,255,0.08)] bg-[rgba(255,255,255,0.04)] text-[9px] font-medium text-[#A8A29C] ring-2 ring-[#121212]">
                  +{overflowMemberCount}
                </span>
              ) : null}
            </div>
            {metaItems.length > 0 ? (
              <p className="min-w-0 truncate text-xs text-[#7D7770]">
                {metaItems.join(" · ")}
              </p>
            ) : null}
          </div>
        </div>

        <Button
          variant="secondary"
          size="sm"
          className="rounded-full border-[rgba(255,255,255,0.07)] bg-[rgba(255,255,255,0.03)] px-3.5 text-[#CFC9C2] hover:bg-[rgba(255,255,255,0.05)]"
          icon={<UsersRound size={14} />}
          onClick={onToggleDrawer}
        >
          <span>{threadDrawerOpen ? "Hide details" : "Details"}</span>
          {attachmentCount > 0 ? (
            <span className="inline-flex items-center gap-1 text-[11px] text-[#8D877F]">
              <Paperclip size={11} />
              {attachmentCount}
            </span>
          ) : null}
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
  activeAgentOfflineDetail,
  activeAgentSendBlocked,
  activeAgentBootstrapPending,
  threadDocumentUploads,
  threadDocumentError,
  messageInput,
  sending,
  onEngageConversationArea,
  onChangeMessageInput,
  onUploadThreadDocuments,
  onDismissThreadUpload,
  onSubmitMessage,
  onSendMessage,
}: {
  currentUserId: string;
  activeConversation: ConversationSummary;
  activeAgentParticipant: ConversationMemberSummary | null;
  activeAgentReady: boolean;
  activeAgentOfflineDetail: string | null;
  activeAgentSendBlocked: boolean;
  activeAgentBootstrapPending: boolean;
  threadDocumentUploads: ThreadDocumentUploadState[];
  threadDocumentError: string | null;
  messageInput: string;
  sending: boolean;
  onEngageConversationArea: () => void;
  onChangeMessageInput: (value: string) => void;
  onUploadThreadDocuments: (files: File[]) => void;
  onDismissThreadUpload: (uploadId: string) => void;
  onSubmitMessage: (event: FormEvent<HTMLFormElement>) => void | Promise<void>;
  onSendMessage: () => Promise<void>;
}) {
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [dragDepth, setDragDepth] = useState(0);
  const dragActive = dragDepth > 0;
  useTeamChatPerfCommit("ThreadComposer", {
    conversationId: activeConversation.id,
    inputLength: messageInput.length,
    uploadCount: threadDocumentUploads.length,
    sending,
    dragActive,
    activeAgentSendBlocked,
    activeAgentBootstrapPending,
  });

  function queueUploads(files: FileList | null) {
    const nextFiles = Array.from(files ?? []);
    if (nextFiles.length > 0) {
      onEngageConversationArea();
      onUploadThreadDocuments(nextFiles);
    }
  }

  function handleFileInputChange(event: ChangeEvent<HTMLInputElement>) {
    queueUploads(event.target.files);
    event.currentTarget.value = "";
  }

  function handleDragEnter(event: DragEvent<HTMLFormElement>) {
    if (!eventHasFiles(event)) {
      return;
    }

    event.preventDefault();
    setDragDepth((current) => current + 1);
  }

  function handleDragOver(event: DragEvent<HTMLFormElement>) {
    if (!eventHasFiles(event)) {
      return;
    }

    event.preventDefault();
    event.dataTransfer.dropEffect = "copy";
  }

  function handleDragLeave(event: DragEvent<HTMLFormElement>) {
    event.preventDefault();
    setDragDepth((current) => Math.max(0, current - 1));
  }

  function handleDrop(event: DragEvent<HTMLFormElement>) {
    if (!eventHasFiles(event)) {
      return;
    }

    event.preventDefault();
    setDragDepth(0);
    queueUploads(event.dataTransfer.files);
  }

  return activeAgentParticipant && !activeAgentReady && !activeAgentBootstrapPending ? (
    <div className="shrink-0 border-t border-[rgba(255,255,255,0.06)] bg-[#121212] px-3 py-3 md:px-5 md:py-4">
      <div className="flex items-center justify-center gap-2.5 rounded-2xl border border-[rgba(239,68,68,0.15)] bg-[rgba(239,68,68,0.06)] px-4 py-3 text-sm text-[#9A9A9A]">
        <span className="h-2 w-2 shrink-0 rounded-full bg-[#EF4444]" />
        {activeAgentOfflineDetail || "Agent not online. Configure the LLM connection in the agent profile to start chatting."}
      </div>
    </div>
  ) : (
    <form
      onSubmit={onSubmitMessage}
      onFocusCapture={onEngageConversationArea}
      onPointerDown={onEngageConversationArea}
      onDragEnter={handleDragEnter}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      className="shrink-0 border-t border-[rgba(255,255,255,0.04)] bg-[#121212] px-3 py-3 md:px-5 md:py-4"
    >
      <div className={cn(CONVERSATION_COLUMN_CLASS, "space-y-2")}>
        <input
          ref={fileInputRef}
          type="file"
          multiple
          accept={CONVERSATION_DOCUMENT_ACCEPT}
          className="hidden"
          onChange={handleFileInputChange}
        />

        <div
          className={cn(
            "rounded-[24px] border px-3 py-3 transition-colors",
            dragActive
              ? "border-[rgba(247,148,29,0.28)] bg-[rgba(247,148,29,0.06)]"
              : "border-[rgba(255,255,255,0.06)] bg-[rgba(255,255,255,0.025)]"
          )}
        >
          {threadDocumentUploads.length > 0 ? (
            <div className="mb-2.5 flex flex-wrap gap-2">
              {threadDocumentUploads.map((upload) => (
                <div
                  key={upload.id}
                  className={cn(
                    "flex min-w-0 max-w-full items-center gap-2 rounded-full border px-3 py-1.5 text-[11px]",
                    upload.status === "failed"
                      ? "border-[rgba(239,68,68,0.18)] bg-[rgba(239,68,68,0.07)] text-[#F2C0C0]"
                      : upload.status === "uploaded"
                        ? "border-[rgba(74,222,128,0.18)] bg-[rgba(74,222,128,0.08)] text-[#D4F7DF]"
                        : "border-[rgba(255,255,255,0.06)] bg-[rgba(255,255,255,0.04)] text-[#CFC9C2]"
                  )}
                >
                  {upload.status === "failed" ? (
                    <AlertTriangle size={12} className="shrink-0 text-[#EF4444]" />
                  ) : upload.status === "uploaded" ? (
                    <Check size={12} className="shrink-0 text-[#4ADE80]" />
                  ) : (
                    <Loader2 size={12} className="shrink-0 animate-spin text-[#F7941D]" />
                  )}
                  <p className="min-w-0 truncate text-[#F6F3EE]">
                    <span className="font-medium">{upload.filename}</span>
                    <span className="text-[#8D877F]">
                      {" · "}
                      {upload.status === "failed"
                        ? upload.error ?? "Upload failed"
                        : upload.status === "uploaded"
                          ? "Attached"
                          : "Uploading"}
                    </span>
                  </p>
                  {upload.status === "failed" ? (
                    <button
                      type="button"
                      onClick={() => onDismissThreadUpload(upload.id)}
                      className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full border border-[rgba(255,255,255,0.08)] bg-[rgba(255,255,255,0.03)] text-[#8D877F] transition-colors hover:text-[#F6F3EE]"
                      aria-label={`Dismiss failed upload ${upload.filename}`}
                    >
                      <X size={11} />
                    </button>
                  ) : null}
                </div>
              ))}
            </div>
          ) : null}

          {threadDocumentError ? (
            <div className="mb-2.5 flex items-center gap-2 text-xs leading-5 text-[#F2C0C0]">
              <AlertTriangle size={12} className="shrink-0 text-[#EF4444]" />
              {threadDocumentError}
            </div>
          ) : null}

          <div className="flex items-end gap-2">
            <Button
              type="button"
              variant="secondary"
              size="md"
              className="h-10 w-10 shrink-0 rounded-full border-[rgba(255,255,255,0.08)] bg-[rgba(255,255,255,0.03)] px-0 md:h-11 md:w-11"
              onClick={() => fileInputRef.current?.click()}
              title="Attach files to this thread"
            >
              <Paperclip size={15} />
            </Button>
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
                className="min-h-[46px] w-full resize-none rounded-[20px] border-transparent bg-transparent px-3 py-2.5 shadow-none focus:border-transparent focus:ring-0 md:min-h-[50px]"
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
              className="h-10 w-10 shrink-0 rounded-full px-0 md:h-11 md:w-11"
              title="Send message"
            >
              {!sending ? <Send size={15} /> : null}
            </Button>
          </div>
        </div>

        <div className="min-h-[16px] px-1 text-[11px] text-[#7D7770]">
          {dragActive
            ? "Drop files to attach them to this thread."
            : activeAgentParticipant && activeAgentBootstrapPending
              ? `Preparing ${activeAgentParticipant.name} before input is enabled.`
              : null}
        </div>
      </div>
    </form>
  );
}

const MemoizedThreadComposer = memo(
  ThreadComposer,
  (previousProps, nextProps) =>
    previousProps.currentUserId === nextProps.currentUserId
    && previousProps.activeConversation.id === nextProps.activeConversation.id
    && previousProps.activeAgentParticipant?.id === nextProps.activeAgentParticipant?.id
    && previousProps.activeAgentReady === nextProps.activeAgentReady
    && previousProps.activeAgentOfflineDetail === nextProps.activeAgentOfflineDetail
    && previousProps.activeAgentSendBlocked === nextProps.activeAgentSendBlocked
    && previousProps.activeAgentBootstrapPending === nextProps.activeAgentBootstrapPending
    && previousProps.threadDocumentUploads === nextProps.threadDocumentUploads
    && previousProps.threadDocumentError === nextProps.threadDocumentError
    && previousProps.messageInput === nextProps.messageInput
    && previousProps.sending === nextProps.sending
);

type ConversationMessageRowProps = {
  message: ChatMessage;
  currentUserId: string;
  mixedAgentThread: boolean;
  isEditing: boolean;
  editingDraft: string;
  isSaving: boolean;
  isDeleting: boolean;
  isCopied: boolean;
  onChangeEditingDraft: (value: string) => void;
  onCancelEditingMessage: () => void;
  onSaveEditedMessage: (messageId: string) => Promise<void>;
  onCopyMessage: (body: string, messageId: string) => void;
  onStartEditingMessage: (message: ChatMessage) => void;
  onDeleteMessage: (messageId: string) => Promise<void>;
};

const ConversationMessageRow = memo(
  function ConversationMessageRow({
    message,
    currentUserId,
    mixedAgentThread,
    isEditing,
    editingDraft,
    isSaving,
    isDeleting,
    isCopied,
    onChangeEditingDraft,
    onCancelEditingMessage,
    onSaveEditedMessage,
    onCopyMessage,
    onStartEditingMessage,
    onDeleteMessage,
  }: ConversationMessageRowProps) {
    const isCurrentUser = message.sender?.id === currentUserId && message.sender?.kind === "user";
    const speakerLabel = getSpeakerLabel(message, currentUserId, mixedAgentThread);
    const showAgentStatusCard =
      message.sender?.kind === "agent"
      && !message.body
      && (message.isStreaming || message.clientState === "failed_assistant");

    return (
      <div className={cn("group flex w-full", isCurrentUser ? "justify-end" : "justify-start")}>
        <div
          className={cn("flex min-w-0 w-full flex-col", isCurrentUser ? "items-end" : "items-start")}
        >
          <p
            className={cn(
              "mb-0.5 px-1 text-[11px] font-medium",
              isCurrentUser ? "text-right text-[#A89C8C]" : "text-[#8D877F]"
            )}
          >
            {speakerLabel}
          </p>

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
                  disabled={!editingDraft.trim() || isSaving}
                  title="Save"
                >
                  {isSaving ? (
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
                "min-w-0 text-sm leading-6 [overflow-wrap:anywhere]",
                isCurrentUser
                  ? cn(HUMAN_MESSAGE_WIDTH_CLASS, "rounded-[24px] px-4 py-3 shadow-sm")
                  : message.sender?.kind === "agent"
                    ? "w-full px-1 py-1.5"
                    : cn(HUMAN_MESSAGE_WIDTH_CLASS, "rounded-[22px] px-4 py-3")
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
              ) : showAgentStatusCard ? (
                <AgentStatusCard message={message} />
              ) : message.isStreaming && message.sender?.kind !== "agent" ? (
                <div className="flex items-center gap-2 text-[#CFC9C2]">
                  <div className="h-3.5 w-3.5 rounded-full border-2 border-[rgba(126,200,227,0.2)] border-t-[#7EC8E3] animate-spin" />
                  <span>{getStreamingStatusLabel(message)}</span>
                </div>
              ) : null}

              {message.sender?.kind === "agent" ? (
                <MessageOperationalDetails
                  message={message}
                  hideStreamingLabel={showAgentStatusCard}
                />
              ) : null}
              <MessageLifecycleState message={message} />
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
                {isCopied ? "Copied" : "Copy"}
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
                    disabled={isDeleting}
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
  },
  (previousProps, nextProps) =>
    previousProps.message === nextProps.message
    && previousProps.currentUserId === nextProps.currentUserId
    && previousProps.mixedAgentThread === nextProps.mixedAgentThread
    && previousProps.isEditing === nextProps.isEditing
    && (
      (!previousProps.isEditing && !nextProps.isEditing)
      || previousProps.editingDraft === nextProps.editingDraft
    )
    && previousProps.isSaving === nextProps.isSaving
    && previousProps.isDeleting === nextProps.isDeleting
    && previousProps.isCopied === nextProps.isCopied
);

type ConversationTranscriptProps = {
  conversationId: string;
  currentUserId: string;
  conversationType: ConversationSummary["type"];
  emptyConversationLabel: string;
  loadingMessages: boolean;
  rawMessageCount: number;
  renderedMessages: ChatMessage[];
  messagesError: string | null;
  mixedAgentThread: boolean;
  activeAgentParticipantName: string | null;
  activeAgentReady: boolean;
  activeAgentBootstrapPending: boolean;
  agentUnavailableDetail: string | null;
  chatScrollRef: RefObject<HTMLDivElement | null>;
  bottomRef: RefObject<HTMLDivElement | null>;
  editingMessageId: string | null;
  editingDraft: string;
  savingMessageId: string | null;
  deletingMessageId: string | null;
  copiedMessageId: string | null;
  onOpenActiveAgentProfile: () => void;
  onEngageConversationArea: () => void;
  onHandleChatScroll: () => void;
  onChangeEditingDraft: (value: string) => void;
  onCancelEditingMessage: () => void;
  onSaveEditedMessage: (messageId: string) => Promise<void>;
  onCopyMessage: (body: string, messageId: string) => void;
  onStartEditingMessage: (message: ChatMessage) => void;
  onDeleteMessage: (messageId: string) => Promise<void>;
};

const ConversationTranscript = memo(
  function ConversationTranscript({
    conversationId,
    currentUserId,
    conversationType,
    emptyConversationLabel,
    loadingMessages,
    rawMessageCount,
    renderedMessages,
    messagesError,
    mixedAgentThread,
    activeAgentParticipantName,
    activeAgentReady,
    activeAgentBootstrapPending,
    agentUnavailableDetail,
    chatScrollRef,
    bottomRef,
    editingMessageId,
    editingDraft,
    savingMessageId,
    deletingMessageId,
    copiedMessageId,
    onOpenActiveAgentProfile,
    onEngageConversationArea,
    onHandleChatScroll,
    onChangeEditingDraft,
    onCancelEditingMessage,
    onSaveEditedMessage,
    onCopyMessage,
    onStartEditingMessage,
    onDeleteMessage,
  }: ConversationTranscriptProps) {
    useTeamChatPerfCommit("ConversationTranscript", {
      conversationId,
      loadingMessages,
      rawMessageCount,
      renderedMessageCount: renderedMessages.length,
      activeAgentBootstrapPending,
      activeAgentReady,
    });

    return (
      <div
        ref={chatScrollRef}
        onScroll={onHandleChatScroll}
        onPointerDown={onEngageConversationArea}
        className="chat-scroll flex-1 overflow-y-auto overflow-x-hidden bg-[radial-gradient(circle_at_top,rgba(255,255,255,0.035),transparent_58%)] px-4 py-5 md:min-h-0 md:px-8 md:py-8"
      >
        {shouldShowThreadStillHereState({
          messagesError,
          renderedMessageCount: renderedMessages.length,
        }) ? (
          <div className="flex h-full flex-col items-center justify-center px-8 text-center">
            <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-3xl bg-[rgba(239,68,68,0.12)] text-[#F2C0C0]">
              <AlertTriangle size={28} />
            </div>
            <p className="text-lg font-semibold text-[#F6F3EE]">Thread is still here</p>
            <p className="mt-2 max-w-md text-sm leading-6 text-[#A8A29C]">{messagesError}</p>
          </div>
        ) : loadingMessages && rawMessageCount === 0 ? (
          <div className="flex h-full items-center justify-center">
            <div className="h-6 w-6 rounded-full border-2 border-[rgba(247,148,29,0.2)] border-t-[#F7941D] animate-spin" />
          </div>
        ) : activeAgentParticipantName && activeAgentBootstrapPending && renderedMessages.length === 0 ? (
          <div className="flex h-full flex-col items-center justify-center px-8 text-center">
            <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-3xl bg-[rgba(75,156,211,0.12)] text-[#7EC8E3]">
              <Bot size={28} />
            </div>
            <p className="text-lg font-semibold text-[#F6F3EE]">Initializing {activeAgentParticipantName}</p>
            <p className="mt-1 max-w-md text-sm leading-6 text-[#8D877F]">
              Checking the model connection, loading recent conversation history, and preparing the context bundle.
            </p>
            <div className="mt-4 flex items-center gap-2 rounded-2xl border border-[rgba(75,156,211,0.16)] bg-[rgba(75,156,211,0.08)] px-4 py-3 text-sm text-[#9FCBE0]">
              <div className="h-4 w-4 rounded-full border-2 border-[rgba(126,200,227,0.2)] border-t-[#7EC8E3] animate-spin" />
              <span>Preparing a clean start before you type</span>
            </div>
          </div>
        ) : activeAgentParticipantName && !activeAgentReady && renderedMessages.length === 0 ? (
          <div className="flex h-full flex-col items-center justify-center px-8 text-center">
            <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-3xl bg-[rgba(75,156,211,0.12)] text-[#7EC8E3]">
              <Bot size={28} />
            </div>
            <p className="text-lg font-semibold text-[#F6F3EE]">{activeAgentParticipantName} isn&apos;t ready to chat yet</p>
            <p className="mt-1 max-w-md text-sm leading-6 text-[#8D877F]">
              {agentUnavailableDetail || "Connect this agent's LLM brain on the profile page before starting a conversation."}
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
              {conversationType === "group"
                ? "Drop the first update, question, or decision into this channel."
                : `Send a quick message to ${emptyConversationLabel}.`}
            </p>
          </div>
        ) : (
          <div className={cn(CONVERSATION_COLUMN_CLASS, "flex flex-col gap-6 pb-6")}>
            {renderedMessages.map((message) => (
              <ConversationMessageRow
                key={getMessageRenderKey(message)}
                message={message}
                currentUserId={currentUserId}
                mixedAgentThread={mixedAgentThread}
                isEditing={editingMessageId === message.id}
                editingDraft={editingDraft}
                isSaving={savingMessageId === message.id}
                isDeleting={deletingMessageId === message.id}
                isCopied={copiedMessageId === message.id}
                onChangeEditingDraft={onChangeEditingDraft}
                onCancelEditingMessage={onCancelEditingMessage}
                onSaveEditedMessage={onSaveEditedMessage}
                onCopyMessage={onCopyMessage}
                onStartEditingMessage={onStartEditingMessage}
                onDeleteMessage={onDeleteMessage}
              />
            ))}
            <div ref={bottomRef} />
          </div>
        )}
      </div>
    );
  },
  (previousProps, nextProps) => {
    const previousShowsEmptyState = previousProps.renderedMessages.length === 0;
    const nextShowsEmptyState = nextProps.renderedMessages.length === 0;
    const compareEmptyStateProps = previousShowsEmptyState || nextShowsEmptyState;

    return previousProps.conversationId === nextProps.conversationId
      && previousProps.currentUserId === nextProps.currentUserId
      && previousProps.renderedMessages === nextProps.renderedMessages
      && previousProps.rawMessageCount === nextProps.rawMessageCount
      && previousProps.messagesError === nextProps.messagesError
      && previousProps.loadingMessages === nextProps.loadingMessages
      && previousProps.mixedAgentThread === nextProps.mixedAgentThread
      && previousProps.editingMessageId === nextProps.editingMessageId
      && (
        (!previousProps.editingMessageId && !nextProps.editingMessageId)
        || previousProps.editingDraft === nextProps.editingDraft
      )
      && previousProps.savingMessageId === nextProps.savingMessageId
      && previousProps.deletingMessageId === nextProps.deletingMessageId
      && previousProps.copiedMessageId === nextProps.copiedMessageId
      && (
        !compareEmptyStateProps
        || (
          previousProps.conversationType === nextProps.conversationType
          && previousProps.emptyConversationLabel === nextProps.emptyConversationLabel
          && previousProps.activeAgentParticipantName === nextProps.activeAgentParticipantName
          && previousProps.activeAgentReady === nextProps.activeAgentReady
          && previousProps.activeAgentBootstrapPending === nextProps.activeAgentBootstrapPending
          && previousProps.agentUnavailableDetail === nextProps.agentUnavailableDetail
        )
      );
  }
);

export function ConversationPane({
  currentUserId,
  activeConversation,
  activeConversationParticipantSummary,
  activeConversationWorkspaceLabel,
  activeConversationTimestamp,
  activePartner,
  activeAgentParticipant,
  threadDrawerOpen,
  threadOriginLabel,
  loadingMessages,
  rawMessageCount,
  renderedMessages,
  messagesError,
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
  activeAgentReady,
  activeAgentSendBlocked,
  activeAgentBootstrapPending,
  agentInspector,
  agentInspectorError,
  onBack,
  onOpenThreadTarget,
  onOpenActiveAgentProfile,
  onToggleDrawer,
  onEngageConversationArea,
  onHandleChatScroll,
  onChangeMessageInput,
  onUploadThreadDocuments,
  onSubmitMessage,
  onSendMessage,
  onChangeEditingDraft,
  onCancelEditingMessage,
  onSaveEditedMessage,
  onDismissThreadUpload,
  onCopyMessage,
  onStartEditingMessage,
  onDeleteMessage,
}: {
  currentUserId: string;
  activeConversation: ConversationSummary | null;
  activeConversationParticipantSummary: string | null;
  activeConversationWorkspaceLabel: string | null;
  activeConversationTimestamp: string | null;
  activePartner: ConversationMemberSummary | null;
  activeAgentParticipant: ConversationMemberSummary | null;
  threadDrawerOpen: boolean;
  threadOriginLabel: string | null;
  loadingMessages: boolean;
  rawMessageCount: number;
  renderedMessages: ChatMessage[];
  messagesError: string | null;
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
  activeAgentReady: boolean;
  activeAgentSendBlocked: boolean;
  activeAgentBootstrapPending: boolean;
  agentInspector: AgentInspectorData | null;
  agentInspectorError: string | null;
  onBack: () => void;
  onOpenThreadTarget: () => void;
  onOpenActiveAgentProfile: () => void;
  onToggleDrawer: () => void;
  onEngageConversationArea: () => void;
  onHandleChatScroll: () => void;
  onChangeMessageInput: (value: string) => void;
  onUploadThreadDocuments: (files: File[]) => void;
  onSubmitMessage: (event: FormEvent<HTMLFormElement>) => void | Promise<void>;
  onSendMessage: () => Promise<void>;
  onChangeEditingDraft: (value: string) => void;
  onCancelEditingMessage: () => void;
  onSaveEditedMessage: (messageId: string) => Promise<void>;
  onDismissThreadUpload: (uploadId: string) => void;
  onCopyMessage: (body: string, messageId: string) => void;
  onStartEditingMessage: (message: ChatMessage) => void;
  onDeleteMessage: (messageId: string) => Promise<void>;
}) {
  const mixedAgentThread = (activeConversation?.members.filter((member) => member.kind === "agent").length ?? 0) > 1;
  useTeamChatPerfCommit("ConversationPane", {
    conversationId: activeConversation?.id ?? null,
    loadingMessages,
    rawMessageCount,
    renderedMessageCount: renderedMessages.length,
    messageInputLength: messageInput.length,
    threadDrawerOpen,
    sending,
    uploadCount: threadDocumentUploads.length,
    agentMarkdownMessageCount: renderedMessages.filter((message) => message.sender?.kind === "agent" && Boolean(message.body)).length,
  });

  return (
    <section className={cn("flex min-h-0 flex-col overflow-hidden", !activeConversation ? "hidden md:flex" : "flex")}>
      {activeConversation ? (
        <>
          <ThreadHeader
            currentUserId={currentUserId}
            activeConversation={activeConversation}
            activeConversationParticipantSummary={activeConversationParticipantSummary}
            activeConversationWorkspaceLabel={activeConversationWorkspaceLabel}
            activeConversationTimestamp={activeConversationTimestamp}
            activePartner={activePartner}
            attachmentCount={activeConversation.documents.length}
            threadDrawerOpen={threadDrawerOpen}
            threadOriginLabel={threadOriginLabel}
            onBack={onBack}
            onOpenThreadTarget={onOpenThreadTarget}
            onToggleDrawer={onToggleDrawer}
          />

          <TeamChatPerfBoundary
            id="ConversationMessageList"
            detail={{
              conversationId: activeConversation.id,
              loadingMessages,
              rawMessageCount,
              renderedMessageCount: renderedMessages.length,
              agentMarkdownMessageCount: renderedMessages.filter((message) => message.sender?.kind === "agent" && Boolean(message.body)).length,
              threadDrawerOpen,
            }}
          >
            <ConversationTranscript
              conversationId={activeConversation.id}
              currentUserId={currentUserId}
              conversationType={activeConversation.type}
              emptyConversationLabel={getConversationLabel(activeConversation, currentUserId)}
              loadingMessages={loadingMessages}
              rawMessageCount={rawMessageCount}
              renderedMessages={renderedMessages}
              messagesError={messagesError}
              mixedAgentThread={mixedAgentThread}
              activeAgentParticipantName={activeAgentParticipant?.name ?? null}
              activeAgentReady={activeAgentReady}
              activeAgentBootstrapPending={activeAgentBootstrapPending}
              agentUnavailableDetail={agentInspectorError || agentInspector?.readiness.detail || null}
              chatScrollRef={chatScrollRef}
              bottomRef={bottomRef}
              editingMessageId={editingMessageId}
              editingDraft={editingDraft}
              savingMessageId={savingMessageId}
              deletingMessageId={deletingMessageId}
              copiedMessageId={copiedMessageId}
              onOpenActiveAgentProfile={onOpenActiveAgentProfile}
              onEngageConversationArea={onEngageConversationArea}
              onHandleChatScroll={onHandleChatScroll}
              onChangeEditingDraft={onChangeEditingDraft}
              onCancelEditingMessage={onCancelEditingMessage}
              onSaveEditedMessage={onSaveEditedMessage}
              onCopyMessage={onCopyMessage}
              onStartEditingMessage={onStartEditingMessage}
              onDeleteMessage={onDeleteMessage}
            />
          </TeamChatPerfBoundary>
          <TeamChatPerfBoundary
            id="ConversationComposer"
            detail={{
              conversationId: activeConversation.id,
              messageInputLength: messageInput.length,
              sending,
              uploadCount: threadDocumentUploads.length,
              activeAgentSendBlocked,
              activeAgentBootstrapPending,
            }}
          >
            <MemoizedThreadComposer
              currentUserId={currentUserId}
              activeConversation={activeConversation}
              activeAgentParticipant={activeAgentParticipant}
              activeAgentReady={activeAgentReady}
              activeAgentOfflineDetail={agentInspectorError || agentInspector?.readiness.detail || null}
              activeAgentSendBlocked={activeAgentSendBlocked}
              activeAgentBootstrapPending={activeAgentBootstrapPending}
              threadDocumentUploads={threadDocumentUploads}
              threadDocumentError={threadDocumentError}
              messageInput={messageInput}
              sending={sending}
              onEngageConversationArea={onEngageConversationArea}
              onChangeMessageInput={onChangeMessageInput}
              onUploadThreadDocuments={onUploadThreadDocuments}
              onDismissThreadUpload={onDismissThreadUpload}
              onSubmitMessage={onSubmitMessage}
              onSendMessage={onSendMessage}
            />
          </TeamChatPerfBoundary>
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
