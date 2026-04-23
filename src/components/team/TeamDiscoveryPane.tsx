"use client";

import { useState } from "react";
import { Archive, ArrowLeft, FolderOpen, Hash, MessageSquare, Plus, RotateCcw, Search, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { cn } from "@/lib/utils";
import {
  type ChatProjectOption,
  type ConversationSearchResult,
  type ConversationSummary,
  type ThreadSection,
  ThreadTypeBadge,
  formatPreviewTime,
  getConversationLabel,
  getConversationParticipantSummary,
  getConversationTimestamp,
  getConversationWorkspaceLabel,
  getPreviewText,
} from "@/components/team/team-chat-shared";

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function renderHighlightedText(text: string, query: string) {
  const trimmedQuery = query.trim();
  if (!trimmedQuery) {
    return text;
  }

  const parts = text.split(new RegExp(`(${escapeRegExp(trimmedQuery)})`, "ig"));
  if (parts.length === 1) {
    return text;
  }

  const normalizedQuery = trimmedQuery.toLocaleLowerCase();

  return parts.map((part, index) => (
    part.toLocaleLowerCase() === normalizedQuery
      ? (
          <mark
            key={`highlight-${part}-${index}`}
            className="rounded-md bg-[rgba(247,148,29,0.16)] px-1 py-[1px] text-inherit"
          >
            {part}
          </mark>
        )
      : <span key={`text-${part}-${index}`}>{part}</span>
  ));
}

function ThreadDiscoveryCard({
  conversation,
  currentUserId,
  showProjectContext,
  searchMatch,
  highlightQuery,
  onOpenConversation,
}: {
  conversation: ConversationSummary;
  currentUserId: string;
  showProjectContext: boolean;
  searchMatch?: ConversationSearchResult["match"] | null;
  highlightQuery?: string;
  onOpenConversation: (conversationId: string) => void;
}) {
  const projectLabel = conversation.project?.name?.trim() || "General";
  const conversationLabel = getConversationLabel(conversation, currentUserId);
  const participantSummary = getConversationParticipantSummary(conversation);
  const workspaceLabel = getConversationWorkspaceLabel(conversation);
  const previewText = searchMatch?.snippet || getPreviewText(conversation);
  const timestamp = formatPreviewTime(getConversationTimestamp(conversation));
  const matchLabel = searchMatch
    ? searchMatch.kind === "message"
      ? searchMatch.senderName
        ? `Matched in message from ${searchMatch.senderName}`
        : "Matched in message content"
      : searchMatch.kind === "thread"
        ? "Matched in thread name"
        : searchMatch.kind === "project"
          ? "Matched in project"
          : "Matched in participant"
    : null;

  return (
    <button
      type="button"
      onClick={() => onOpenConversation(conversation.id)}
      className="w-full rounded-3xl border border-[rgba(255,255,255,0.06)] bg-[rgba(255,255,255,0.03)] px-4 py-4 text-left transition-all hover:border-[rgba(247,148,29,0.16)] hover:bg-[rgba(255,255,255,0.045)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[rgba(247,148,29,0.35)] focus-visible:ring-offset-2 focus-visible:ring-offset-[#121212]"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <p className="text-sm font-semibold text-[#F6F3EE]">
              {renderHighlightedText(conversationLabel, highlightQuery ?? "")}
            </p>
            <ThreadTypeBadge conversation={conversation} />
            {showProjectContext ? (
              <span className="rounded-full border border-[rgba(255,255,255,0.08)] bg-[rgba(255,255,255,0.04)] px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.16em] text-[#B7B0A8]">
                {renderHighlightedText(projectLabel, highlightQuery ?? "")}
              </span>
            ) : null}
          </div>
          <p className="mt-1 text-xs text-[#8D877F]">
            {workspaceLabel} / {participantSummary}
          </p>
        </div>
        <span className="shrink-0 text-[11px] text-[#6F6A64]">{timestamp}</span>
      </div>

      {matchLabel ? (
        <p className="mt-3 text-[11px] font-semibold uppercase tracking-[0.16em] text-[#F0C889]">
          {matchLabel}
        </p>
      ) : null}

      <p className="mt-2 text-sm leading-6 text-[#B7B0A8]">
        {renderHighlightedText(previewText, highlightQuery ?? "")}
      </p>
    </button>
  );
}

function ArchivedThreadCard({
  conversation,
  currentUserId,
  highlightQuery,
  restoring,
  deleting,
  actionError,
  onRestoreConversation,
  onDeleteConversation,
}: {
  conversation: ConversationSummary;
  currentUserId: string;
  highlightQuery?: string;
  restoring: boolean;
  deleting: boolean;
  actionError?: string | null;
  onRestoreConversation: (conversationId: string) => Promise<unknown>;
  onDeleteConversation: (conversationId: string) => Promise<unknown>;
}) {
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const projectLabel = conversation.project?.name?.trim() || "General";
  const conversationLabel = getConversationLabel(conversation, currentUserId);
  const participantSummary = getConversationParticipantSummary(conversation);
  const workspaceLabel = getConversationWorkspaceLabel(conversation);
  const previewText = getPreviewText(conversation);
  const timestamp = formatPreviewTime(getConversationTimestamp(conversation));

  return (
    <div className="rounded-3xl border border-[rgba(255,255,255,0.06)] bg-[rgba(255,255,255,0.03)] px-4 py-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <p className="text-sm font-semibold text-[#F6F3EE]">
              {renderHighlightedText(conversationLabel, highlightQuery ?? "")}
            </p>
            <ThreadTypeBadge conversation={conversation} />
            <span className="rounded-full border border-[rgba(255,255,255,0.08)] bg-[rgba(255,255,255,0.04)] px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.16em] text-[#B7B0A8]">
              {renderHighlightedText(projectLabel, highlightQuery ?? "")}
            </span>
          </div>
          <p className="mt-1 text-xs text-[#8D877F]">
            {workspaceLabel} / {participantSummary}
          </p>
        </div>
        <span className="shrink-0 text-[11px] text-[#6F6A64]">{timestamp}</span>
      </div>

      <p className="mt-3 text-sm leading-6 text-[#B7B0A8]">
        {renderHighlightedText(previewText, highlightQuery ?? "")}
      </p>

      <div className="mt-4 flex items-center justify-between gap-3">
        <p className="text-xs text-[#6F6A64]">
          Archived threads stay out of the normal chat flow until you restore them.
        </p>
        <div className="flex items-center gap-2">
          <button
            type="button"
            className="inline-flex items-center gap-1 rounded-full px-2 py-1 text-xs font-medium text-[#AFA79F] transition-colors hover:text-[#F2C0C0] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[rgba(239,68,68,0.24)] focus-visible:ring-offset-2 focus-visible:ring-offset-[#121212]"
            onClick={() => setConfirmingDelete(true)}
            disabled={restoring || deleting}
          >
            <Trash2 size={12} />
            Delete
          </button>
          <Button
            variant="secondary"
            size="sm"
            className="rounded-2xl"
            icon={<RotateCcw size={14} />}
            loading={restoring}
            disabled={deleting}
            onClick={() => void onRestoreConversation(conversation.id)}
          >
            Restore & Open
          </Button>
        </div>
      </div>

      {confirmingDelete ? (
        <div className="mt-3 rounded-2xl border border-[rgba(239,68,68,0.14)] bg-[rgba(239,68,68,0.06)] px-3 py-3">
          <p className="text-xs font-semibold text-[#F8D4D4]">Delete thread permanently?</p>
          <p className="mt-1 text-xs leading-5 text-[#D7A8A8]">
            This final step removes the thread, its messages, attachments, and saved context history.
          </p>

          <div className="mt-3 flex justify-end gap-2">
            <Button
              variant="ghost"
              size="sm"
              disabled={deleting}
              onClick={() => setConfirmingDelete(false)}
            >
              Cancel
            </Button>
            <Button
              variant="secondary"
              size="sm"
              className="rounded-xl border-[rgba(239,68,68,0.18)] bg-[rgba(239,68,68,0.08)] text-[#F3C1C1] hover:bg-[rgba(239,68,68,0.14)] hover:text-[#F8D4D4]"
              loading={deleting}
              disabled={restoring}
              onClick={() => void onDeleteConversation(conversation.id)}
            >
              Delete Thread
            </Button>
          </div>
        </div>
      ) : null}

      {actionError ? (
        <p className="mt-3 text-xs leading-5 text-[#E7BBBB]">{actionError}</p>
      ) : null}
    </div>
  );
}

export function TeamDiscoveryPane({
  currentUserId,
  projects,
  conversations,
  archivedMode,
  archivedConversations,
  archivedLoading,
  archivedError,
  archivedActionError,
  archivedActionConversationId,
  restoringConversationId,
  deletingConversationId,
  threadSections,
  searchResults,
  searchLoading,
  searchError,
  selectedProjectId,
  searchQuery,
  isDesktop,
  onChangeSearchQuery,
  onOpenConversation,
  onRestoreConversation,
  onDeleteConversation,
  onOpenProject,
  onOpenNewThread,
  onBack,
}: {
  currentUserId: string;
  projects: ChatProjectOption[];
  conversations: ConversationSummary[];
  archivedMode: boolean;
  archivedConversations: ConversationSummary[];
  archivedLoading: boolean;
  archivedError: string | null;
  archivedActionError: string | null;
  archivedActionConversationId: string | null;
  restoringConversationId: string | null;
  deletingConversationId: string | null;
  threadSections: ThreadSection[];
  searchResults: ConversationSearchResult[];
  searchLoading: boolean;
  searchError: string | null;
  selectedProjectId: string | null;
  searchQuery: string;
  isDesktop: boolean;
  onChangeSearchQuery: (value: string) => void;
  onOpenConversation: (conversationId: string) => void;
  onRestoreConversation: (conversationId: string) => Promise<unknown>;
  onDeleteConversation: (conversationId: string) => Promise<unknown>;
  onOpenProject: (projectId: string) => void;
  onOpenNewThread: (projectId: string | null) => void;
  onBack: () => void;
}) {
  const trimmedQuery = searchQuery.trim();
  const selectedSection = selectedProjectId
    ? threadSections.find((section) => section.id === selectedProjectId) ?? null
    : null;
  const orderedConversations = [...conversations].sort(
    (a, b) => new Date(getConversationTimestamp(b)).getTime() - new Date(getConversationTimestamp(a)).getTime()
  );
  const orderedArchivedConversations = [...archivedConversations].sort(
    (a, b) => new Date(getConversationTimestamp(b)).getTime() - new Date(getConversationTimestamp(a)).getTime()
  );
  const archivedResults = orderedArchivedConversations.filter((conversation) => {
    if (!trimmedQuery) {
      return true;
    }

    const haystack = [
      getConversationLabel(conversation, currentUserId),
      conversation.project?.name ?? "General",
      getConversationParticipantSummary(conversation),
      getConversationWorkspaceLabel(conversation),
      getPreviewText(conversation),
    ].join(" ").toLocaleLowerCase();

    return haystack.includes(trimmedQuery.toLocaleLowerCase());
  });
  const recentThreads = orderedConversations.slice(0, 8);
  const projectCards = threadSections.map((section) => ({
    id: section.id,
    label: section.label,
    count: section.items.length,
    latestTimestamp: section.items[0] ? formatPreviewTime(getConversationTimestamp(section.items[0])) : null,
  }));
  const panelTitle = archivedMode
    ? "Archived Threads"
    : trimmedQuery
    ? "Search Team Chat"
    : selectedSection
      ? selectedSection.label
      : "Browse Team Chat";
  const panelSubtitle = archivedMode
    ? trimmedQuery
      ? `${archivedResults.length} archived thread${archivedResults.length === 1 ? "" : "s"} matched your search.`
      : `${orderedArchivedConversations.length} archived thread${orderedArchivedConversations.length === 1 ? "" : "s"} kept out of the main chat flow.`
    : trimmedQuery
    ? searchLoading
      ? "Searching thread names, projects, participants, and message content."
      : `${searchResults.length} result${searchResults.length === 1 ? "" : "s"} across thread names, projects, participants, and message content.`
    : selectedSection
      ? `${selectedSection.items.length} thread${selectedSection.items.length === 1 ? "" : "s"} in this project.`
      : "Search threads and projects, then open the right conversation in the main pane.";
  const selectedProjectForNewChat =
    selectedSection?.id && selectedSection.id !== "general" && projects.some((project) => project.id === selectedSection.id)
      ? selectedSection.id
      : null;

  return (
    <section className="flex min-h-0 flex-col overflow-hidden">
      <div className="shrink-0 border-b border-[rgba(255,255,255,0.06)] px-3 py-3 md:px-5 md:py-4">
        <div className="flex items-start justify-between gap-3">
          <div className="flex min-w-0 items-start gap-3">
            {!isDesktop ? (
              <button
                onClick={onBack}
                className="flex h-10 w-10 items-center justify-center rounded-2xl border border-[rgba(255,255,255,0.07)] bg-[#181818] text-[#8D877F]"
                type="button"
                aria-label="Back to rail"
              >
                <ArrowLeft size={18} />
              </button>
            ) : null}

            <div
              className={cn(
                "flex h-12 w-12 items-center justify-center rounded-2xl",
                archivedMode
                  ? "bg-[rgba(255,255,255,0.05)] text-[#B7B0A8]"
                  : trimmedQuery
                  ? "bg-[rgba(247,148,29,0.12)] text-[#F7941D]"
                  : selectedSection
                    ? "bg-[rgba(247,148,29,0.12)] text-[#F7941D]"
                    : "bg-[rgba(255,255,255,0.05)] text-[#B7B0A8]"
              )}
            >
              {archivedMode ? <Archive size={19} /> : trimmedQuery ? <Search size={19} /> : selectedSection ? <FolderOpen size={19} /> : <MessageSquare size={19} />}
            </div>

            <div className="min-w-0">
              <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[#8D877F]">
                {archivedMode ? "Archived" : trimmedQuery ? "Search Results" : selectedSection ? "Project Summary" : "Discovery"}
              </p>
              <h2 className="mt-1 truncate text-lg font-semibold text-[#F6F3EE] md:text-xl">{panelTitle}</h2>
              <p className="mt-1 text-sm text-[#8D877F]">{panelSubtitle}</p>
            </div>
          </div>

          {!archivedMode ? (
            <Button
              variant="secondary"
              size="sm"
              className="rounded-2xl px-3"
              icon={<Plus size={14} />}
              onClick={() => onOpenNewThread(selectedProjectForNewChat)}
            >
              <span className="hidden md:inline">
                {selectedSection ? `New Chat${selectedSection.id === "general" ? " in General" : ""}` : "New Chat"}
              </span>
            </Button>
          ) : null}
        </div>

        <div className="mt-4">
          <Input
            value={searchQuery}
            onChange={(event) => onChangeSearchQuery(event.target.value)}
            placeholder={archivedMode ? "Search archived thread names, projects, and participants" : "Search thread names, projects, participants, and message content"}
            icon={<Search size={14} />}
          />
        </div>

        {archivedMode ? (
          <div className="mt-2 flex items-center justify-between gap-3">
            <p className="text-xs text-[#6F6A64]">Archived threads stay hidden from the main rail until you restore them.</p>
            {trimmedQuery ? (
              <button
                type="button"
                onClick={() => onChangeSearchQuery("")}
                className="text-xs font-medium text-[#F7941D] transition-colors hover:text-[#FDBA4D]"
              >
                Clear
              </button>
            ) : null}
          </div>
        ) : trimmedQuery ? (
          <div className="mt-2 flex items-center justify-between gap-3">
            <p className="text-xs text-[#6F6A64]">Search results always render here in the main pane for easier scanning and scrolling.</p>
            <button
              type="button"
              onClick={() => onChangeSearchQuery("")}
              className="text-xs font-medium text-[#F7941D] transition-colors hover:text-[#FDBA4D]"
            >
              Clear
            </button>
          </div>
        ) : selectedSection ? (
          <p className="mt-2 text-xs text-[#6F6A64]">
            Open a thread below or start a new one directly inside {selectedSection.id === "general" ? "General" : selectedSection.label}.
          </p>
        ) : null}
      </div>

      <div className="flex-1 overflow-y-auto bg-[radial-gradient(circle_at_top,rgba(255,255,255,0.03),transparent_55%)] px-4 py-5 md:px-6 md:py-6">
        <div className="mx-auto flex w-full max-w-4xl flex-col gap-6">
          {archivedMode ? (
            archivedError ? (
              <div className="flex min-h-[18rem] flex-col items-center justify-center rounded-[28px] border border-[rgba(239,68,68,0.15)] bg-[rgba(239,68,68,0.06)] px-6 text-center">
                <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-3xl bg-[rgba(239,68,68,0.12)] text-[#F2A6A6]">
                  <Archive size={24} />
                </div>
                <p className="text-lg font-semibold text-[#F6F3EE]">Archived threads are unavailable right now</p>
                <p className="mt-2 max-w-md text-sm leading-6 text-[#E7BBBB]">{archivedError}</p>
              </div>
            ) : archivedLoading ? (
              <div className="flex min-h-[18rem] flex-col items-center justify-center rounded-[28px] border border-[rgba(255,255,255,0.06)] bg-[rgba(255,255,255,0.02)] px-6 text-center">
                <div className="mb-4 h-10 w-10 rounded-full border-2 border-[rgba(255,255,255,0.08)] border-t-[#F7941D] animate-spin" />
                <p className="text-lg font-semibold text-[#F6F3EE]">Loading archived threads</p>
                <p className="mt-2 max-w-md text-sm leading-6 text-[#8D877F]">
                  Pulling hidden conversations into this lightweight recovery view.
                </p>
              </div>
            ) : archivedResults.length > 0 ? (
              <div className="space-y-3">
                {archivedResults.map((conversation) => (
                  <ArchivedThreadCard
                    key={conversation.id}
                    conversation={conversation}
                    currentUserId={currentUserId}
                    highlightQuery={trimmedQuery}
                    restoring={restoringConversationId === conversation.id}
                    deleting={deletingConversationId === conversation.id}
                    actionError={archivedActionConversationId === conversation.id ? archivedActionError : null}
                    onRestoreConversation={onRestoreConversation}
                    onDeleteConversation={onDeleteConversation}
                  />
                ))}
              </div>
            ) : (
              <div className="flex min-h-[18rem] flex-col items-center justify-center rounded-[28px] border border-[rgba(255,255,255,0.06)] bg-[rgba(255,255,255,0.02)] px-6 text-center">
                <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-3xl bg-[rgba(255,255,255,0.05)] text-[#B7B0A8]">
                  <Archive size={24} />
                </div>
                <p className="text-lg font-semibold text-[#F6F3EE]">
                  {trimmedQuery ? `No archived threads matched ${trimmedQuery}` : "No archived threads yet"}
                </p>
                <p className="mt-2 max-w-md text-sm leading-6 text-[#8D877F]">
                  {trimmedQuery
                    ? "Try a different name, participant, or project phrase from the archived conversation."
                    : "When you archive a thread, it will stay out of the main rail and appear here for easy recovery."}
                </p>
              </div>
            )
          ) : trimmedQuery ? (
            searchError ? (
              <div className="flex min-h-[18rem] flex-col items-center justify-center rounded-[28px] border border-[rgba(239,68,68,0.15)] bg-[rgba(239,68,68,0.06)] px-6 text-center">
                <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-3xl bg-[rgba(239,68,68,0.12)] text-[#F2A6A6]">
                  <Search size={24} />
                </div>
                <p className="text-lg font-semibold text-[#F6F3EE]">Search is unavailable right now</p>
                <p className="mt-2 max-w-md text-sm leading-6 text-[#E7BBBB]">{searchError}</p>
              </div>
            ) : searchLoading ? (
              <div className="flex min-h-[18rem] flex-col items-center justify-center rounded-[28px] border border-[rgba(255,255,255,0.06)] bg-[rgba(255,255,255,0.02)] px-6 text-center">
                <div className="mb-4 h-10 w-10 rounded-full border-2 border-[rgba(255,255,255,0.08)] border-t-[#F7941D] animate-spin" />
                <p className="text-lg font-semibold text-[#F6F3EE]">Searching Team Chat</p>
                <p className="mt-2 max-w-md text-sm leading-6 text-[#8D877F]">
                  Looking through thread names, projects, participants, and message content.
                </p>
              </div>
            ) : searchResults.length > 0 ? (
              <div className="space-y-3">
                {searchResults.map((result) => (
                  <ThreadDiscoveryCard
                    key={result.conversation.id}
                    conversation={result.conversation}
                    currentUserId={currentUserId}
                    showProjectContext
                    searchMatch={result.match}
                    highlightQuery={trimmedQuery}
                    onOpenConversation={onOpenConversation}
                  />
                ))}
              </div>
            ) : (
              <div className="flex min-h-[18rem] flex-col items-center justify-center rounded-[28px] border border-[rgba(255,255,255,0.06)] bg-[rgba(255,255,255,0.02)] px-6 text-center">
                <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-3xl bg-[rgba(247,148,29,0.1)] text-[#F7941D]">
                  <Search size={24} />
                </div>
                <p className="text-lg font-semibold text-[#F6F3EE]">No threads matched {trimmedQuery}</p>
                <p className="mt-2 max-w-md text-sm leading-6 text-[#8D877F]">
                  This pass searches thread names, project names, participants, and real message content. Try a different phrase from the conversation itself, a thread title, or a project name.
                </p>
              </div>
            )
          ) : selectedSection ? (
            selectedSection.items.length > 0 ? (
              <div className="space-y-3">
                {selectedSection.items.map((conversation) => (
                  <ThreadDiscoveryCard
                    key={conversation.id}
                    conversation={conversation}
                    currentUserId={currentUserId}
                    showProjectContext={false}
                    onOpenConversation={onOpenConversation}
                  />
                ))}
              </div>
            ) : (
              <div className="flex min-h-[18rem] flex-col items-center justify-center rounded-[28px] border border-[rgba(255,255,255,0.06)] bg-[rgba(255,255,255,0.02)] px-6 text-center">
                <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-3xl bg-[rgba(247,148,29,0.1)] text-[#F7941D]">
                  <Hash size={24} />
                </div>
                <p className="text-lg font-semibold text-[#F6F3EE]">
                  No threads in {selectedSection.id === "general" ? "General" : selectedSection.label} yet
                </p>
                <p className="mt-2 max-w-md text-sm leading-6 text-[#8D877F]">
                  Start a fresh chat here so this project becomes more than a narrow rail grouping.
                </p>
                <Button
                  variant="primary"
                  size="md"
                  className="mt-5 rounded-2xl"
                  icon={<Plus size={15} />}
                  onClick={() => onOpenNewThread(selectedProjectForNewChat)}
                >
                  Start New Chat
                </Button>
              </div>
            )
          ) : (
            <>
              <div className="grid gap-3 md:grid-cols-2">
                {projectCards.map((project) => (
                  <button
                    key={project.id}
                    type="button"
                    onClick={() => onOpenProject(project.id)}
                    className="rounded-[26px] border border-[rgba(255,255,255,0.06)] bg-[rgba(255,255,255,0.025)] px-4 py-4 text-left transition-all hover:border-[rgba(247,148,29,0.16)] hover:bg-[rgba(255,255,255,0.04)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[rgba(247,148,29,0.35)] focus-visible:ring-offset-2 focus-visible:ring-offset-[#121212]"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[#8D877F]">Project</p>
                        <p className="mt-1 text-base font-semibold text-[#F6F3EE]">{project.label}</p>
                      </div>
                      <span className="rounded-full border border-[rgba(255,255,255,0.08)] bg-[rgba(255,255,255,0.04)] px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.16em] text-[#B7B0A8]">
                        {project.count}
                      </span>
                    </div>
                    <p className="mt-2 text-sm text-[#8D877F]">
                      {project.latestTimestamp ? `Latest activity ${project.latestTimestamp}` : "No threads yet"}
                    </p>
                  </button>
                ))}
              </div>

              <div className="space-y-3">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[#8D877F]">Recent Threads</p>
                    <p className="mt-1 text-sm text-[#8D877F]">Open a thread directly or jump into a project for a fuller summary view.</p>
                  </div>
                </div>

                {recentThreads.length > 0 ? (
                  recentThreads.map((conversation) => (
                    <ThreadDiscoveryCard
                      key={conversation.id}
                      conversation={conversation}
                      currentUserId={currentUserId}
                      showProjectContext
                      onOpenConversation={onOpenConversation}
                    />
                  ))
                ) : (
                  <div className="rounded-[26px] border border-[rgba(255,255,255,0.06)] bg-[rgba(255,255,255,0.02)] px-5 py-6 text-sm text-[#8D877F]">
                    No threads yet. Start a new chat to populate Team Chat discovery.
                  </div>
                )}
              </div>
            </>
          )}
        </div>
      </div>
    </section>
  );
}
