"use client";

import { ArrowLeft, FolderOpen, Hash, MessageSquare, Plus, Search } from "lucide-react";
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

export function TeamDiscoveryPane({
  currentUserId,
  projects,
  conversations,
  threadSections,
  searchResults,
  searchLoading,
  searchError,
  selectedProjectId,
  searchQuery,
  isDesktop,
  onChangeSearchQuery,
  onOpenConversation,
  onOpenProject,
  onOpenNewThread,
  onBack,
}: {
  currentUserId: string;
  projects: ChatProjectOption[];
  conversations: ConversationSummary[];
  threadSections: ThreadSection[];
  searchResults: ConversationSearchResult[];
  searchLoading: boolean;
  searchError: string | null;
  selectedProjectId: string | null;
  searchQuery: string;
  isDesktop: boolean;
  onChangeSearchQuery: (value: string) => void;
  onOpenConversation: (conversationId: string) => void;
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
  const recentThreads = orderedConversations.slice(0, 8);
  const projectCards = threadSections.map((section) => ({
    id: section.id,
    label: section.label,
    count: section.items.length,
    latestTimestamp: section.items[0] ? formatPreviewTime(getConversationTimestamp(section.items[0])) : null,
  }));
  const panelTitle = trimmedQuery
    ? "Search Team Chat"
    : selectedSection
      ? selectedSection.label
      : "Browse Team Chat";
  const panelSubtitle = trimmedQuery
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
                trimmedQuery
                  ? "bg-[rgba(247,148,29,0.12)] text-[#F7941D]"
                  : selectedSection
                    ? "bg-[rgba(247,148,29,0.12)] text-[#F7941D]"
                    : "bg-[rgba(255,255,255,0.05)] text-[#B7B0A8]"
              )}
            >
              {trimmedQuery ? <Search size={19} /> : selectedSection ? <FolderOpen size={19} /> : <MessageSquare size={19} />}
            </div>

            <div className="min-w-0">
              <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[#8D877F]">
                {trimmedQuery ? "Search Results" : selectedSection ? "Project Summary" : "Discovery"}
              </p>
              <h2 className="mt-1 truncate text-lg font-semibold text-[#F6F3EE] md:text-xl">{panelTitle}</h2>
              <p className="mt-1 text-sm text-[#8D877F]">{panelSubtitle}</p>
            </div>
          </div>

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
        </div>

        <div className="mt-4">
          <Input
            value={searchQuery}
            onChange={(event) => onChangeSearchQuery(event.target.value)}
            placeholder="Search thread names, projects, participants, and message content"
            icon={<Search size={14} />}
          />
        </div>

        {trimmedQuery ? (
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
          {trimmedQuery ? (
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
