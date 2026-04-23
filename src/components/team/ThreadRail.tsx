"use client";

import type { DragEvent, ReactNode } from "react";
import { useEffect, useState } from "react";
import {
  Archive,
  ChevronDown,
  MessageSquare,
  PanelLeftClose,
  PanelLeftOpen,
  Search,
  UserPlus,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { Avatar } from "@/components/ui/Avatar";
import { Button } from "@/components/ui/Button";
import { ProjectRowMenu } from "@/components/team/ProjectRowMenu";
import { ThreadRowMenu } from "@/components/team/ThreadRowMenu";
import {
  type DirectConversationShortcut,
  directConversationShortcutContainsConversation,
} from "@/components/team/team-chat-thread-shortcuts";
import { deriveInviteName } from "@/lib/team-invites";
import { cn, getInitials } from "@/lib/utils";
import {
  type AIAgent,
  type ChatProjectOption,
  type ConversationSummary,
  type ConversationMemberSummary,
  type PendingInvite,
  type TeamMember,
  type ThreadSection,
  MemberAvatar,
  OnlineDot,
  SidebarRow,
  formatPreviewTime,
  getAgentSidebarStatus,
  getConversationLabel,
  getMemberDisplayName,
  getOnlineStatus,
  getPreviewText,
} from "@/components/team/team-chat-shared";

const COLLAPSED_PROJECT_STORAGE_KEY = "team-chat-collapsed-project-sections";
const COLLAPSED_UTILITY_STORAGE_KEY = "team-chat-collapsed-utility-sections";
const UTILITY_SECTION_IDS = ["workspace-threads", "humans", "ai-agents", "pending-invites"] as const;

type UtilitySectionId = (typeof UTILITY_SECTION_IDS)[number];

const DEFAULT_COLLAPSED_UTILITY_SECTION_IDS: UtilitySectionId[] = [
  "workspace-threads",
  "humans",
  "ai-agents",
  "pending-invites",
];

function isUtilitySectionId(value: string): value is UtilitySectionId {
  return UTILITY_SECTION_IDS.some((sectionId) => sectionId === value);
}

function ThreadGlyph({
  label,
  compact = false,
  active = false,
}: {
  label: string;
  compact?: boolean;
  active?: boolean;
}) {
  const initials = getInitials(label.trim() || "Thread");

  return (
    <div
      className={cn(
        "flex items-center justify-center rounded-xl border font-semibold uppercase tracking-[0.14em]",
        compact ? "h-8 w-8 text-[10px]" : "h-7 w-7 text-[9px]",
        active
          ? "border-[rgba(247,148,29,0.18)] bg-[rgba(247,148,29,0.12)] text-[#FFF4E5]"
          : "border-[rgba(255,255,255,0.06)] bg-[rgba(255,255,255,0.035)] text-[#D5CFC8]"
      )}
      aria-hidden="true"
    >
      {initials || "TH"}
    </div>
  );
}

const railSectionLabelClassName = "truncate text-[13px] font-medium text-[#8E887F]";
const railActionPillClassName =
  "inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-[11px] font-medium leading-none transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[rgba(247,148,29,0.35)] focus-visible:ring-offset-2 focus-visible:ring-offset-[#121212]";

export function ThreadRail({
  currentUserId,
  members,
  agents,
  pendingInvites,
  projects,
  threadSections,
  groupConversations,
  directConversationShortcutsByUserId,
  directConversationShortcutsByAgentId,
  selectedConversationId,
  selectedProjectId,
  sidebarCollapsed,
  onlineCount,
  showThreadStarter,
  openingDirectId,
  hasActiveConversation,
  onOpenInvite,
  onOpenSearch,
  onCollapseSidebar,
  onExpandSidebar,
  onOpenNewThreadModal,
  onSelectConversation,
  onSelectProject,
  onOpenUserShortcut,
  onOpenAgentShortcut,
  onCreateProject,
  onRenameProject,
  onDeleteProject,
  onRenameThread,
  onMoveThread,
  onArchiveThread,
  onDeleteThread,
  archivedThreadCount,
  archivedViewActive,
  onOpenArchived,
}: {
  currentUserId: string;
  members: TeamMember[];
  agents: AIAgent[];
  pendingInvites: PendingInvite[];
  projects: ChatProjectOption[];
  threadSections: ThreadSection[];
  groupConversations: ConversationSummary[];
  directConversationShortcutsByUserId: Map<string, DirectConversationShortcut>;
  directConversationShortcutsByAgentId: Map<string, DirectConversationShortcut>;
  selectedConversationId: string | null;
  selectedProjectId: string | null;
  sidebarCollapsed: boolean;
  onlineCount: number;
  showThreadStarter: boolean;
  openingDirectId: string | null;
  hasActiveConversation: boolean;
  onOpenInvite: () => void;
  onOpenSearch: () => void;
  onCollapseSidebar: () => void;
  onExpandSidebar: () => void;
  onOpenNewThreadModal: () => void;
  onSelectConversation: (conversationId: string) => void;
  onSelectProject: (projectId: string) => void;
  onOpenUserShortcut: (userId: string) => void;
  onOpenAgentShortcut: (agentId: string) => void;
  onCreateProject: (name: string) => Promise<ChatProjectOption>;
  onRenameProject: (projectId: string, name: string) => Promise<ChatProjectOption>;
  onDeleteProject: (projectId: string) => Promise<{ deletedProjectId: string; movedThreadCount: number }>;
  onRenameThread: (conversationId: string, name: string | null) => Promise<void>;
  onMoveThread: (conversationId: string, projectId: string | null) => Promise<void>;
  onArchiveThread: (conversationId: string) => Promise<void>;
  onDeleteThread: (conversationId: string) => Promise<void>;
  archivedThreadCount: number | null;
  archivedViewActive: boolean;
  onOpenArchived: () => void;
}) {
  const router = useRouter();
  const [showCreateProject, setShowCreateProject] = useState(false);
  const [newProjectName, setNewProjectName] = useState("");
  const [creatingProject, setCreatingProject] = useState(false);
  const [createProjectError, setCreateProjectError] = useState<string | null>(null);
  const [draggingConversationId, setDraggingConversationId] = useState<string | null>(null);
  const [dragOverSectionId, setDragOverSectionId] = useState<string | null>(null);
  const [collapsedSectionIds, setCollapsedSectionIds] = useState<string[]>([]);
  const [hasLoadedCollapsedState, setHasLoadedCollapsedState] = useState(false);
  const [collapsedUtilitySectionIds, setCollapsedUtilitySectionIds] = useState<UtilitySectionId[]>(
    DEFAULT_COLLAPSED_UTILITY_SECTION_IDS
  );
  const [hasLoadedUtilityCollapsedState, setHasLoadedUtilityCollapsedState] = useState(false);
  const [dragAnnouncement, setDragAnnouncement] = useState("");
  const [threadDragError, setThreadDragError] = useState<string | null>(null);
  const otherMembers = members.filter((member) => member.id !== currentUserId);
  const totalThreadCount = threadSections.reduce((count, section) => count + section.items.length, 0);
  const hasAnyThreads = totalThreadCount > 0;

  useEffect(() => {
    try {
      const storedValue = window.localStorage.getItem(COLLAPSED_PROJECT_STORAGE_KEY);
      if (!storedValue) return;

      const parsedValue = JSON.parse(storedValue);
      if (Array.isArray(parsedValue)) {
        setCollapsedSectionIds(parsedValue.filter((value): value is string => typeof value === "string"));
      }
    } catch {
      // Ignore stale local UI state and continue with the default expanded rail.
    } finally {
      setHasLoadedCollapsedState(true);
    }
  }, []);

  useEffect(() => {
    setCollapsedSectionIds((current) =>
      current.filter((sectionId) => threadSections.some((section) => section.id === sectionId))
    );
  }, [threadSections]);

  useEffect(() => {
    if (!hasLoadedCollapsedState) return;

    try {
      window.localStorage.setItem(COLLAPSED_PROJECT_STORAGE_KEY, JSON.stringify(collapsedSectionIds));
    } catch {
      // Ignore local persistence failures for this optional UI polish.
    }
  }, [collapsedSectionIds, hasLoadedCollapsedState]);

  useEffect(() => {
    try {
      const storedValue = window.localStorage.getItem(COLLAPSED_UTILITY_STORAGE_KEY);
      if (!storedValue) return;

      const parsedValue = JSON.parse(storedValue);
      if (Array.isArray(parsedValue)) {
        setCollapsedUtilitySectionIds(
          parsedValue.filter((value): value is UtilitySectionId => (
            typeof value === "string" && isUtilitySectionId(value)
          ))
        );
      }
    } catch {
      // Ignore stale local UI state and continue with the default collapsed utilities.
    } finally {
      setHasLoadedUtilityCollapsedState(true);
    }
  }, []);

  useEffect(() => {
    if (!hasLoadedUtilityCollapsedState) return;

    try {
      window.localStorage.setItem(
        COLLAPSED_UTILITY_STORAGE_KEY,
        JSON.stringify(collapsedUtilitySectionIds)
      );
    } catch {
      // Ignore local persistence failures for this optional UI polish.
    }
  }, [collapsedUtilitySectionIds, hasLoadedUtilityCollapsedState]);

  async function handleCreateProject() {
    const projectName = newProjectName.trim();
    if (!projectName) {
      setCreateProjectError("Project name is required.");
      return;
    }

    setCreateProjectError(null);
    setCreatingProject(true);

    try {
      await onCreateProject(projectName);
      setNewProjectName("");
      setShowCreateProject(false);
    } catch (error) {
      setCreateProjectError(
        error instanceof Error ? error.message : "Unable to create that chat project right now."
      );
    } finally {
      setCreatingProject(false);
    }
  }

  function findConversationById(conversationId: string) {
    for (const section of threadSections) {
      const conversation = section.items.find((item) => item.id === conversationId);
      if (conversation) {
        return conversation;
      }
    }

    return null;
  }

  function getSectionLabel(sectionId: string) {
    if (sectionId === "general") {
      return "General";
    }

    return threadSections.find((section) => section.id === sectionId)?.label ?? "this project";
  }

  function toggleSectionCollapsed(sectionId: string) {
    setCollapsedSectionIds((current) =>
      current.includes(sectionId)
        ? current.filter((value) => value !== sectionId)
        : [...current, sectionId]
    );
  }

  function toggleUtilitySectionCollapsed(sectionId: UtilitySectionId) {
    setCollapsedUtilitySectionIds((current) =>
      current.includes(sectionId)
        ? current.filter((value) => value !== sectionId)
        : [...current, sectionId]
    );
  }

  function renderUtilitySection({
    id,
    label,
    count,
    containsSelectedThread,
    children,
  }: {
    id: UtilitySectionId;
    label: string;
    count: number;
    containsSelectedThread: boolean;
    children: ReactNode;
  }) {
    const isCollapsed = collapsedUtilitySectionIds.includes(id) && !containsSelectedThread;
    const sectionBodyId = `thread-utility-group-${id}`;

    return (
      <section className="space-y-1">
        <button
          type="button"
          onClick={() => toggleUtilitySectionCollapsed(id)}
          aria-expanded={!isCollapsed}
          aria-controls={sectionBodyId}
          aria-label={`${isCollapsed ? "Expand" : "Collapse"} ${label}`}
          className="flex w-full items-center gap-2 rounded-xl px-1.5 py-1 text-left transition-colors hover:bg-[rgba(255,255,255,0.02)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[rgba(247,148,29,0.35)] focus-visible:ring-offset-2 focus-visible:ring-offset-[#121212]"
        >
          <ChevronDown
            size={12}
            className={cn(
              "shrink-0 text-[#6F6A64] transition-transform",
              isCollapsed ? "-rotate-90" : "rotate-0"
            )}
          />
          <p className={railSectionLabelClassName}>
            {label}
          </p>
          <span className="rounded-full bg-[rgba(255,255,255,0.03)] px-1.5 py-0.5 text-[9px] font-medium text-[#7B756E]">
            {count}
          </span>
          {containsSelectedThread ? (
            <span className="h-1.5 w-1.5 rounded-full bg-[#F7941D]" aria-hidden="true" />
          ) : null}
          {containsSelectedThread ? (
            <span className="sr-only">Contains the active thread.</span>
          ) : null}
        </button>

        <div
          id={sectionBodyId}
          className="ml-4 mt-1 space-y-1 border-l border-[rgba(255,255,255,0.05)] pl-2"
          hidden={isCollapsed}
        >
          {children}
        </div>
      </section>
    );
  }

  function handleThreadDragStart(event: DragEvent<HTMLDivElement>, conversationId: string) {
    event.dataTransfer.effectAllowed = "move";
    event.dataTransfer.setData("text/plain", conversationId);
    setDraggingConversationId(conversationId);
    setDragOverSectionId(null);
    setThreadDragError(null);

    const conversation = findConversationById(conversationId);
    if (conversation) {
      setDragAnnouncement(
        `Picked up ${getConversationLabel(conversation, currentUserId)}. Move it to another project group or use the thread menu to reassign it with the keyboard.`
      );
    }
  }

  function handleThreadDragEnd() {
    setDraggingConversationId(null);
    setDragOverSectionId(null);
  }

  function handleSectionDragOver(event: DragEvent<HTMLDivElement>, sectionId: string) {
    if (!draggingConversationId) return;

    const conversation = findConversationById(draggingConversationId);
    const currentProjectId = conversation?.project?.id ?? null;
    const targetProjectId = sectionId === "general" ? null : sectionId;

    if (!conversation || currentProjectId === targetProjectId) {
      return;
    }

    event.preventDefault();
    event.dataTransfer.dropEffect = "move";

    if (dragOverSectionId !== sectionId) {
      setDragOverSectionId(sectionId);
      setDragAnnouncement(
        `Move ${getConversationLabel(conversation, currentUserId)} to ${getSectionLabel(sectionId)}.`
      );
    }
  }

  function handleSectionDragLeave(event: DragEvent<HTMLDivElement>, sectionId: string) {
    const relatedTarget = event.relatedTarget as Node | null;
    if (relatedTarget && event.currentTarget.contains(relatedTarget)) {
      return;
    }

    setDragOverSectionId((current) => (current === sectionId ? null : current));
  }

  async function handleSectionDrop(event: DragEvent<HTMLDivElement>, sectionId: string) {
    event.preventDefault();

    const draggedConversationId = draggingConversationId || event.dataTransfer.getData("text/plain");
    setDragOverSectionId(null);

    if (!draggedConversationId) {
      setDraggingConversationId(null);
      setDragAnnouncement("Unable to identify the thread you tried to move.");
      return;
    }

    const conversation = findConversationById(draggedConversationId);
    const targetProjectId = sectionId === "general" ? null : sectionId;
    const currentProjectId = conversation?.project?.id ?? null;

    if (!conversation || currentProjectId === targetProjectId) {
      setDraggingConversationId(null);
      setDragAnnouncement("That thread is already in this project.");
      return;
    }

    setThreadDragError(null);

    try {
      await onMoveThread(draggedConversationId, targetProjectId);
      setCollapsedSectionIds((current) => current.filter((value) => value !== sectionId));
      setDragAnnouncement(
        `Moved ${getConversationLabel(conversation, currentUserId)} to ${getSectionLabel(sectionId)}.`
      );
    } catch (error) {
      setThreadDragError(
        error instanceof Error ? error.message : "Unable to move this thread right now."
      );
      setDragAnnouncement(
        error instanceof Error ? error.message : "Unable to move this thread right now."
      );
    } finally {
      setDraggingConversationId(null);
    }
  }

  function renderProjectThreadRow(conversation: ConversationSummary) {
    const label = getConversationLabel(conversation, currentUserId);
    const isActive = conversation.id === selectedConversationId;
    const isDragging = draggingConversationId === conversation.id;

    return (
      <div
        key={conversation.id}
        draggable
        onDragStart={(event) => handleThreadDragStart(event, conversation.id)}
        onDragEnd={handleThreadDragEnd}
        aria-grabbed={isDragging}
        className={cn(
          "group flex items-center gap-1 rounded-xl px-0.5 transition-all",
          isDragging ? "opacity-50" : "opacity-100"
        )}
      >
        <button
          type="button"
          onClick={() => onSelectConversation(conversation.id)}
          aria-current={isActive ? "page" : undefined}
          aria-label={`Open thread ${label}`}
          title={label}
          className={cn(
            "min-w-0 flex-1 rounded-xl px-2.5 py-1.5 text-left transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[rgba(247,148,29,0.35)] focus-visible:ring-offset-2 focus-visible:ring-offset-[#121212]",
            isActive
              ? "bg-[rgba(247,148,29,0.12)] text-[#FFF4E5]"
              : "text-[#D5CFC8] hover:bg-[rgba(255,255,255,0.04)] hover:text-[#F6F3EE]"
          )}
        >
          <span className="block truncate text-[13px] font-medium">{label}</span>
        </button>

        <ThreadRowMenu
          conversation={conversation}
          currentUserId={currentUserId}
          projects={projects}
          active={isActive}
          onRenameThread={onRenameThread}
          onMoveThread={onMoveThread}
          onArchiveThread={onArchiveThread}
          onDeleteThread={onDeleteThread}
        />
      </div>
    );
  }

  return (
    <aside
      className={cn(
        "flex min-h-0 flex-col bg-[#121212] md:border-r md:border-[rgba(255,255,255,0.06)]",
        hasActiveConversation ? "hidden md:flex" : "flex"
      )}
    >
      {sidebarCollapsed ? (
        <div className="hidden h-full md:flex md:flex-col">
          <div className="flex items-center justify-center border-b border-[rgba(255,255,255,0.06)] py-4 md:py-[18px]">
            <button
              onClick={onExpandSidebar}
              className="flex h-9 w-9 items-center justify-center rounded-xl bg-[rgba(255,255,255,0.06)] text-[#9A9A9A] transition-all hover:bg-[rgba(255,255,255,0.1)] hover:text-[#F0F0F0]"
              title="Expand sidebar"
              type="button"
            >
              <PanelLeftOpen size={17} />
            </button>
          </div>
          <div className="flex min-h-0 flex-1 flex-col overflow-y-auto px-2 py-3">
            <div className="flex flex-col items-center gap-3">
              <div className="flex w-full flex-col items-center gap-3">
                {threadSections
                  .filter((section) => section.items.length > 0)
                  .map((section) => (
                    <div key={section.id} className="flex w-full flex-col items-center gap-1.5">
                      {section.items.map((conversation) => {
                        const label = getConversationLabel(conversation, currentUserId);
                        const title = section.label === "General" ? label : `${section.label}: ${label}`;
                        const isActive = conversation.id === selectedConversationId;

                        return (
                          <button
                            key={conversation.id}
                            onClick={() => onSelectConversation(conversation.id)}
                            title={title}
                            aria-label={`Open thread ${title}`}
                            className={cn(
                              "flex h-10 w-10 items-center justify-center rounded-2xl border transition-all",
                              isActive
                                ? "border-[rgba(255,255,255,0.14)] bg-[rgba(255,255,255,0.06)] shadow-[inset_0_0_0_1px_rgba(247,148,29,0.05)]"
                                : "border-transparent bg-transparent hover:bg-[rgba(255,255,255,0.04)]"
                            )}
                            type="button"
                          >
                            <ThreadGlyph label={label} compact active={isActive} />
                          </button>
                        );
                      })}
                    </div>
                  ))}
              </div>

              {groupConversations.length > 0 && (otherMembers.length > 0 || agents.length > 0) ? (
                <div className="h-px w-10 bg-[rgba(255,255,255,0.07)]" />
              ) : null}

              {otherMembers.length > 0 || agents.length > 0 ? (
                <div className="flex w-full flex-col items-center gap-1.5">
                  {otherMembers.map((member) => {
                    const shortcut = directConversationShortcutsByUserId.get(member.id);
                    const conversation = shortcut?.recentConversation;
                    const status = getOnlineStatus(member.lastSeen);
                    const label = getMemberDisplayName(member);
                    const isActive = directConversationShortcutContainsConversation(shortcut, selectedConversationId);

                    return (
                      <button
                        key={member.id}
                        onClick={() => onOpenUserShortcut(member.id)}
                        title={label}
                        aria-label={conversation ? `Open recent direct thread with ${label}` : `Start direct thread with ${label}`}
                        className={cn(
                          "relative flex h-8 w-8 items-center justify-center rounded-full outline-none transition-all",
                          isActive
                            ? "bg-[rgba(255,255,255,0.04)] ring-2 ring-[rgba(247,148,29,0.45)] ring-offset-1 ring-offset-[#121212]"
                            : "opacity-75 hover:bg-[rgba(255,255,255,0.03)] hover:opacity-100"
                        )}
                        type="button"
                      >
                        <Avatar src={member.image} name={label} size="xs" />
                        <span className="absolute -bottom-0.5 -right-0.5">
                          <OnlineDot status={status} />
                        </span>
                      </button>
                    );
                  })}

                  {otherMembers.length > 0 && agents.length > 0 ? (
                    <div className="my-1 h-px w-6 bg-[rgba(255,255,255,0.05)]" />
                  ) : null}

                  {agents.map((agent) => {
                    const shortcut = directConversationShortcutsByAgentId.get(agent.id);
                    const conversation = shortcut?.recentConversation;
                    const agentStatus = getAgentSidebarStatus(agent.llmStatus);
                    const isActive = directConversationShortcutContainsConversation(shortcut, selectedConversationId);

                    return (
                      <button
                        key={agent.id}
                        onClick={() => onOpenAgentShortcut(agent.id)}
                        title={agent.name}
                        aria-label={conversation ? `Open recent agent thread ${agent.name}` : `Start agent thread ${agent.name}`}
                        className={cn(
                          "relative flex h-8 w-8 shrink-0 items-center justify-center rounded-[14px] transition-all",
                          isActive
                            ? "bg-[rgba(75,156,211,0.18)] ring-1 ring-[rgba(75,156,211,0.45)] ring-offset-1 ring-offset-[#121212]"
                            : "opacity-75 hover:bg-[rgba(75,156,211,0.08)] hover:opacity-100"
                        )}
                        type="button"
                      >
                        <MemberAvatar
                          member={{
                            kind: "agent",
                            id: agent.id,
                            name: agent.name,
                            image: agent.avatar,
                            role: agent.role,
                          } satisfies ConversationMemberSummary}
                          size="xs"
                          className="h-7 w-7 rounded-[12px] border-[rgba(75,156,211,0.22)] bg-[rgba(75,156,211,0.06)] text-[#9FCBE0]"
                        />
                        <span
                          className="absolute bottom-0 right-0 h-2 w-2 rounded-full border border-[#121212]"
                          style={{ backgroundColor: agentStatus.dot }}
                        />
                      </button>
                    );
                  })}
                </div>
              ) : null}
            </div>
          </div>
        </div>
      ) : null}

      <div className={cn("flex h-full flex-col", sidebarCollapsed ? "md:hidden" : "")}>
        <div className="border-b border-[rgba(255,255,255,0.06)] px-4 py-4 md:py-[18px]">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-[#8D877F]">Team Chat</p>
              <h2 className="mt-1 text-xl font-bold text-[#F6F3EE]">Threads</h2>
              <p className="mt-1 text-xs text-[#6F6A64]">
                {members.length + agents.length} teammates and agents
                {onlineCount > 0 ? ` | ${onlineCount} online` : ""}
              </p>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={onOpenSearch}
                className="flex h-9 w-9 items-center justify-center rounded-xl bg-[rgba(255,255,255,0.06)] text-[#9A9A9A] transition-all hover:bg-[rgba(255,255,255,0.1)] hover:text-[#F0F0F0]"
                title="Search threads"
                type="button"
              >
                <Search size={17} />
              </button>
              <button
                onClick={onOpenInvite}
                className="flex h-9 w-9 items-center justify-center rounded-xl bg-[rgba(255,255,255,0.06)] text-[#9A9A9A] transition-all hover:bg-[rgba(255,255,255,0.1)] hover:text-[#F0F0F0]"
                title="Invite member"
                type="button"
              >
                <UserPlus size={17} />
              </button>
              <button
                onClick={onCollapseSidebar}
                className="flex h-9 w-9 items-center justify-center rounded-xl bg-[rgba(255,255,255,0.06)] text-[#9A9A9A] transition-all hover:bg-[rgba(255,255,255,0.1)] hover:text-[#F0F0F0]"
                title="Collapse sidebar"
                type="button"
              >
                <PanelLeftClose size={17} />
              </button>
            </div>
          </div>
          <Button
            variant="primary"
            size="md"
            className="mt-4 w-full justify-start rounded-2xl"
            icon={<MessageSquare size={15} />}
            onClick={onOpenNewThreadModal}
          >
            New Chat
          </Button>
        </div>

        <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-3 py-3">
          <section>
            <div className="mb-2 flex items-center justify-between px-2">
              <p className="text-[11px] font-medium text-[#8D877F]">Projects</p>
              <div className="flex items-center gap-2">
                <span className="text-xs text-[#6F6A64]">{totalThreadCount}</span>
                <button
                  onClick={onOpenArchived}
                  className={cn(
                    railActionPillClassName,
                    archivedViewActive
                      ? "border-[rgba(247,148,29,0.18)] bg-[rgba(247,148,29,0.12)] text-[#FFF4E5]"
                      : "border-[rgba(255,255,255,0.08)] bg-[rgba(255,255,255,0.03)] text-[#B7B0A8] hover:text-[#F6F3EE]"
                  )}
                  type="button"
                >
                  <Archive size={12} />
                  Archived
                  {archivedThreadCount !== null ? <span>{archivedThreadCount}</span> : null}
                </button>
                <button
                  onClick={() => {
                    setShowCreateProject((current) => !current);
                    setCreateProjectError(null);
                  }}
                  className={cn(
                    railActionPillClassName,
                    "border-[rgba(255,255,255,0.08)] bg-[rgba(255,255,255,0.03)] text-[#B7B0A8] hover:text-[#F6F3EE]"
                  )}
                  type="button"
                >
                  + Project
                </button>
              </div>
            </div>
            {threadDragError ? (
              <div className="mb-3 rounded-2xl border border-[rgba(239,68,68,0.15)] bg-[rgba(239,68,68,0.06)] px-3 py-2">
                <p className="text-xs leading-5 text-[#E7BBBB]">{threadDragError}</p>
              </div>
            ) : null}
            {showCreateProject ? (
              <div className="mb-3 rounded-2xl border border-[rgba(255,255,255,0.06)] bg-[rgba(255,255,255,0.02)] px-3 py-3">
                <div className="space-y-2">
                  <input
                    value={newProjectName}
                    onChange={(event) => setNewProjectName(event.target.value)}
                    placeholder="Customer handoffs, Q2 launch, Incident room"
                    disabled={creatingProject}
                    className="w-full rounded-xl border border-[rgba(255,255,255,0.08)] bg-[#111111] px-3 py-2 text-sm text-[#F0F0F0] placeholder:text-[#606060] transition-all duration-200 focus:border-[#F7941D] focus:outline-none focus:ring-1 focus:ring-[rgba(247,148,29,0.2)]"
                  />
                  {createProjectError ? (
                    <p className="text-xs leading-5 text-[#E7BBBB]">{createProjectError}</p>
                  ) : (
                    <p className="text-xs leading-5 text-[#6F6A64]">
                      Create a chat project now and use it later from New Chat or Move to project.
                    </p>
                  )}
                  <div className="flex justify-end gap-2">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        setShowCreateProject(false);
                        setNewProjectName("");
                        setCreateProjectError(null);
                      }}
                    >
                      Cancel
                    </Button>
                    <Button
                      variant="secondary"
                      size="sm"
                      loading={creatingProject}
                      onClick={() => void handleCreateProject()}
                    >
                      {creatingProject ? "Creating..." : "Create Project"}
                    </Button>
                  </div>
                </div>
              </div>
            ) : null}

            <p className="sr-only" aria-live="polite" aria-atomic="true">
              {dragAnnouncement}
            </p>

            {threadSections.length > 0 ? (
              <div className="space-y-3">
                {threadSections.map((section) => {
                  const isCollapsed = collapsedSectionIds.includes(section.id);
                  const containsSelectedThread = section.items.some(
                    (conversation) => conversation.id === selectedConversationId
                  );
                  const isProjectActive = selectedProjectId === section.id && selectedConversationId === null;
                  const isDropTarget = draggingConversationId !== null && dragOverSectionId === section.id;
                  const sectionBodyId = `thread-project-group-${section.id}`;

                  return (
                    <div
                      key={section.id}
                      className={cn(
                        "rounded-[20px] border border-transparent px-1 py-1 transition-all",
                        isDropTarget
                          ? "border-[rgba(247,148,29,0.22)] bg-[rgba(247,148,29,0.08)] shadow-[inset_0_0_0_1px_rgba(247,148,29,0.08)]"
                          : "bg-transparent"
                      )}
                      onDragOver={(event) => handleSectionDragOver(event, section.id)}
                      onDragLeave={(event) => handleSectionDragLeave(event, section.id)}
                      onDrop={(event) => void handleSectionDrop(event, section.id)}
                    >
                      <div className="group flex items-start justify-between gap-2 px-1">
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-1">
                            <button
                              type="button"
                              onClick={() => toggleSectionCollapsed(section.id)}
                              aria-expanded={!isCollapsed}
                              aria-controls={sectionBodyId}
                              aria-label={`${isCollapsed ? "Expand" : "Collapse"} ${section.label}`}
                              className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-[#8D877F] transition-colors hover:bg-[rgba(255,255,255,0.03)] hover:text-[#F6F3EE] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[rgba(247,148,29,0.35)] focus-visible:ring-offset-2 focus-visible:ring-offset-[#121212]"
                            >
                              <ChevronDown
                                size={13}
                                className={cn("transition-transform", isCollapsed ? "-rotate-90" : "rotate-0")}
                              />
                            </button>
                            <button
                              type="button"
                              onClick={() => onSelectProject(section.id)}
                              aria-current={isProjectActive ? "page" : undefined}
                              aria-label={`Open ${section.label} project summary`}
                              className={cn(
                                "flex min-w-0 flex-1 items-center gap-2 rounded-xl px-1.5 py-1 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[rgba(247,148,29,0.35)] focus-visible:ring-offset-2 focus-visible:ring-offset-[#121212]",
                                isProjectActive
                                  ? "bg-[rgba(255,255,255,0.04)] text-[#F6F3EE]"
                                  : "hover:bg-[rgba(255,255,255,0.03)]"
                              )}
                            >
                              <p className={cn(
                                railSectionLabelClassName,
                                isProjectActive ? "text-[#F6F3EE]" : "text-[#8E887F]"
                              )}>
                                {section.label}
                              </p>
                              <span className="rounded-full bg-[rgba(255,255,255,0.04)] px-1.5 py-0.5 text-[9px] font-medium text-[#8D877F]">
                                {section.items.length}
                              </span>
                              {containsSelectedThread || isProjectActive ? (
                                <span
                                  className={cn(
                                    "h-1.5 w-1.5 rounded-full",
                                    containsSelectedThread ? "bg-[#F7941D]" : "bg-[#FDBA4D]"
                                  )}
                                  aria-hidden="true"
                                />
                              ) : null}
                              {containsSelectedThread ? (
                                <span className="sr-only">Contains the active thread.</span>
                              ) : null}
                              {isProjectActive ? (
                                <span className="sr-only">Project summary is open.</span>
                              ) : null}
                            </button>
                          </div>
                        </div>

                        {section.id !== "general" ? (
                          <ProjectRowMenu
                            active={containsSelectedThread || isProjectActive}
                            projectId={section.id}
                            projectLabel={section.label}
                            threadCount={section.items.length}
                            onRenameProject={onRenameProject}
                            onDeleteProject={onDeleteProject}
                          />
                        ) : null}
                      </div>

                      {isDropTarget ? (
                        <div className="mx-2 mb-2 mt-1 rounded-xl border border-[rgba(247,148,29,0.2)] bg-[rgba(247,148,29,0.12)] px-3 py-2 text-[11px] font-medium text-[#FDBA4D]">
                          Drop thread in {section.label}
                        </div>
                      ) : null}

                      <div
                        id={sectionBodyId}
                        className="ml-4 mt-1 space-y-0.5 border-l border-[rgba(255,255,255,0.05)] pl-2"
                        hidden={isCollapsed}
                      >
                        {section.items.length > 0 ? (
                          section.items.map((conversation) => renderProjectThreadRow(conversation))
                        ) : (
                          <div className="px-2.5 py-2">
                            <p className="text-xs text-[#6F6A64]">
                              {section.id === "general" && !hasAnyThreads && projects.length === 0
                                ? "No threads yet. Start a new chat from above."
                                : section.id === "general"
                                  ? "No threads in General yet."
                                  : "No threads in this project yet."}
                            </p>
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="rounded-2xl border border-[rgba(255,255,255,0.05)] bg-[rgba(255,255,255,0.02)] px-4 py-4">
                <p className="text-sm text-[#8D877F]">No threads yet. Start a new chat from above.</p>
              </div>
            )}
          </section>

          {showThreadStarter ? (
            <div className="space-y-1.5 border-t border-[rgba(255,255,255,0.04)] pt-3">
              {renderUtilitySection({
                id: "workspace-threads",
                label: "Workspace Threads",
                count: groupConversations.length,
                containsSelectedThread: groupConversations.some(
                  (conversation) => conversation.id === selectedConversationId
                ),
                children: groupConversations.length > 0 ? (
                  <>
                    {groupConversations.map((conversation) => {
                      const label = getConversationLabel(conversation, currentUserId);
                      const isActive = conversation.id === selectedConversationId;

                      return (
                        <SidebarRow
                          key={conversation.id}
                          variant="secondary"
                          active={isActive}
                          icon={<ThreadGlyph label={label} active={isActive} />}
                          title={label}
                          preview={getPreviewText(conversation)}
                          meta={conversation.latestMessage ? formatPreviewTime(conversation.latestMessage.createdAt) : null}
                          onClick={() => onSelectConversation(conversation.id)}
                        />
                      );
                    })}
                  </>
                ) : (
                  <div className="px-2 py-2">
                    <p className="text-xs text-[#6F6A64]">No shared workspace threads yet.</p>
                  </div>
                ),
              })}

              {renderUtilitySection({
                id: "humans",
                label: "Humans",
                count: otherMembers.length,
                containsSelectedThread: otherMembers.some(
                  (member) => directConversationShortcutContainsConversation(
                    directConversationShortcutsByUserId.get(member.id),
                    selectedConversationId
                  )
                ),
                children: otherMembers.length > 0 ? (
                  <>
                    {otherMembers.map((member) => {
                      const shortcut = directConversationShortcutsByUserId.get(member.id);
                      const conversation = shortcut?.recentConversation;
                      const status = getOnlineStatus(member.lastSeen);
                      const label = getMemberDisplayName(member);
                      const threadCount = shortcut?.conversationIds.length ?? 0;
                      const isActive = directConversationShortcutContainsConversation(shortcut, selectedConversationId);
                      const threadLabel = threadCount > 1 ? `${threadCount} threads` : threadCount === 1 ? "1 thread" : null;
                      const previewText =
                        conversation?.latestMessage
                          ? [threadLabel, getPreviewText(conversation)].filter(Boolean).join(" · ")
                          : status === "online"
                            ? "Online now"
                            : status === "away"
                              ? "Away"
                              : "Offline";

                      return (
                        <SidebarRow
                          key={member.id}
                          variant="secondary"
                          active={isActive}
                          icon={
                            <div className="relative">
                              <Avatar src={member.image} name={label} size="xs" />
                              <span className="absolute -bottom-0.5 -right-0.5">
                                <OnlineDot status={status} />
                              </span>
                            </div>
                          }
                          title={label}
                          preview={previewText}
                          meta={conversation?.latestMessage ? formatPreviewTime(conversation.latestMessage.createdAt) : null}
                          onClick={() => onOpenUserShortcut(member.id)}
                          trailing={
                            openingDirectId === member.id ? (
                              <div className="h-3.5 w-3.5 rounded-full border-2 border-[rgba(247,148,29,0.2)] border-t-[#F7941D] animate-spin" />
                            ) : null
                          }
                        />
                      );
                    })}
                  </>
                ) : (
                  <div className="px-2 py-2">
                    <p className="text-xs text-[#6F6A64]">No teammates available yet.</p>
                  </div>
                ),
              })}

              {renderUtilitySection({
                id: "ai-agents",
                label: "AI Agents",
                count: agents.length,
                containsSelectedThread: agents.some(
                  (agent) => directConversationShortcutContainsConversation(
                    directConversationShortcutsByAgentId.get(agent.id),
                    selectedConversationId
                  )
                ),
                children: agents.length > 0 ? (
                  <>
                    {agents.map((agent) => {
                      const shortcut = directConversationShortcutsByAgentId.get(agent.id);
                      const conversation = shortcut?.recentConversation;
                      const agentStatus = getAgentSidebarStatus(agent.llmStatus);
                      const threadCount = shortcut?.conversationIds.length ?? 0;
                      const isActive = directConversationShortcutContainsConversation(shortcut, selectedConversationId);
                      const threadLabel = threadCount > 1 ? `${threadCount} threads` : threadCount === 1 ? "1 thread" : null;

                      return (
                        <SidebarRow
                          key={agent.id}
                          variant="secondary"
                          active={isActive}
                          icon={
                            <div className="relative">
                              <MemberAvatar
                                member={{
                                  kind: "agent",
                                  id: agent.id,
                                  name: agent.name,
                                  image: agent.avatar,
                                  role: agent.role,
                                } satisfies ConversationMemberSummary}
                                size="xs"
                                className="h-8 w-8 rounded-[14px] border-[rgba(75,156,211,0.24)] bg-[rgba(75,156,211,0.08)] text-[#9FCBE0]"
                              />
                              <span
                                className="absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 rounded-full border border-[#121212]"
                                style={{ backgroundColor: agentStatus.dot }}
                              />
                            </div>
                          }
                          title={agent.name}
                          preview={
                            conversation?.latestMessage
                              ? [threadLabel, getPreviewText(conversation)].filter(Boolean).join(" · ")
                              : [threadLabel, agent.role || agentStatus.description].filter(Boolean).join(" | ")
                          }
                          meta={conversation?.latestMessage ? formatPreviewTime(conversation.latestMessage.createdAt) : null}
                          onClick={() => onOpenAgentShortcut(agent.id)}
                          trailing={
                            openingDirectId === agent.id ? (
                              <div className="h-3.5 w-3.5 rounded-full border-2 border-[rgba(75,156,211,0.2)] border-t-[#4B9CD3] animate-spin" />
                            ) : null
                          }
                        />
                      );
                    })}
                  </>
                ) : (
                  <div className="px-2 py-2">
                    <p className="text-xs text-[#6F6A64]">No AI agents available yet.</p>
                  </div>
                ),
              })}

              {pendingInvites.length > 0 ? (
                renderUtilitySection({
                  id: "pending-invites",
                  label: "Pending Invites",
                  count: pendingInvites.length,
                  containsSelectedThread: false,
                  children: (
                    <>
                      {pendingInvites.map((invite) => (
                        <SidebarRow
                          key={invite.id}
                          variant="secondary"
                          active={false}
                          icon={
                            <Avatar
                              src={invite.image}
                              name={invite.name ?? invite.email}
                              size="xs"
                              className="opacity-70"
                            />
                          }
                          title={invite.name ?? deriveInviteName(invite.email)}
                          preview={invite.email}
                          onClick={() => router.push(`/profile/${encodeURIComponent(invite.userId)}`)}
                          trailing={
                            <span className="rounded-full bg-[rgba(255,255,255,0.04)] px-2 py-0.5 text-[10px] text-[#7B756E]">
                              Invited
                            </span>
                          }
                        />
                      ))}
                    </>
                  ),
                })
              ) : null}
            </div>
          ) : null}
        </div>
      </div>
    </aside>
  );
}
