"use client";

import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { Eye, Pencil, Plus, Trash2, UserPlus, X } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { ThreadDocumentsPanel, type ThreadDocumentUploadState } from "@/components/team/ThreadDocumentsPanel";
import {
  type AgentInspectorData,
  type ChatProjectOption,
  type ConversationDocumentSummary,
  type ConversationMemberSummary,
  type ConversationSummary,
  MemberAvatar,
  PresenceBadge,
  RadialContextBar,
  ThreadTypeBadge,
  formatRelativeTime,
  formatThinkingMode,
  formatTokensK,
  getAgentSidebarStatus,
  getConversationLabel,
  getConversationParticipantSummary,
  getConversationTimestamp,
  getConversationWorkspaceLabel,
  getOnlineStatus,
  getPreviewText,
} from "@/components/team/team-chat-shared";
import { cn } from "@/lib/utils";

function ThreadDetailsPanel({
  conversation,
  currentUserId,
  messageCount,
  threadModelLabel,
  agentInspector,
  agentInspectorLoading,
  agentInspectorError,
  activeAgentParticipant,
  activeAgentStatusLabel,
  activeAgentReady,
  activeAgentBootstrapPending,
  clearThreadAvailable,
  clearingConversation,
  participantActionError,
  switchingActiveAgentId,
  clearingActiveAgentPin,
  removingParticipantId,
  projects,
  projectsLoading,
  projectsError,
  projectActionError,
  movingProject,
  threadDocumentUploads,
  threadDocumentError,
  removingDocumentId,
  onOpenAddParticipants,
  onOpenInspector,
  onOpenClearThread,
  onSwitchActiveAgent,
  onClearActiveAgentPin,
  onRemoveParticipant,
  onMoveProject,
  onCreateProject,
  onRenameThread,
  onRemoveThreadDocument,
  onDismissThreadUpload,
  onClose,
}: {
  conversation: ConversationSummary;
  currentUserId: string;
  messageCount: number;
  threadModelLabel: string | null;
  agentInspector: AgentInspectorData | null;
  agentInspectorLoading: boolean;
  agentInspectorError: string | null;
  activeAgentParticipant: ConversationMemberSummary | null;
  activeAgentStatusLabel: string | null;
  activeAgentReady: boolean;
  activeAgentBootstrapPending: boolean;
  clearThreadAvailable: boolean;
  clearingConversation: boolean;
  participantActionError: string | null;
  switchingActiveAgentId: string | null;
  clearingActiveAgentPin: boolean;
  removingParticipantId: string | null;
  projects: ChatProjectOption[];
  projectsLoading: boolean;
  projectsError: string | null;
  projectActionError: string | null;
  movingProject: boolean;
  threadDocumentUploads: ThreadDocumentUploadState[];
  threadDocumentError: string | null;
  removingDocumentId: string | null;
  onOpenAddParticipants: () => void;
  onOpenInspector: () => void;
  onOpenClearThread: () => void;
  onSwitchActiveAgent: (agentId: string) => void;
  onClearActiveAgentPin: () => void;
  onRemoveParticipant: (participant: ConversationMemberSummary) => void;
  onMoveProject: (projectId: string | null) => Promise<void>;
  onCreateProject: (name: string) => Promise<ChatProjectOption>;
  onRenameThread: (name: string | null) => Promise<void>;
  onRemoveThreadDocument: (document: ConversationDocumentSummary) => Promise<void>;
  onDismissThreadUpload: (uploadId: string) => void;
  onClose: () => void;
}) {
  const humanParticipants = conversation.members.filter(
    (member): member is ConversationMemberSummary & { kind: "user" } => member.kind === "user"
  );
  const agentParticipants = conversation.members.filter(
    (member): member is ConversationMemberSummary & { kind: "agent" } => member.kind === "agent"
  );
  const hasAgentParticipants = agentParticipants.length > 0;
  const inspectAvailable = hasAgentParticipants;
  const latestActivityAt = getConversationTimestamp(conversation);
  const canRemoveParticipants = conversation.members.length > 2;
  const activeAgentIsExplicit = Boolean(
    activeAgentParticipant
    && conversation.llmThread?.activeAgentId
    && conversation.llmThread.activeAgentId === activeAgentParticipant.id
  );
  const currentProjectId = conversation.project?.id ?? "";
  const currentThreadName = conversation.name?.trim() ?? "";
  const [selectedProjectId, setSelectedProjectId] = useState(currentProjectId);
  const [projectMode, setProjectMode] = useState<"existing" | "new">("existing");
  const [projectName, setProjectName] = useState("");
  const [creatingProject, setCreatingProject] = useState(false);
  const [projectCreateError, setProjectCreateError] = useState<string | null>(null);
  const [threadName, setThreadName] = useState(currentThreadName);
  const [threadRenameError, setThreadRenameError] = useState<string | null>(null);
  const [renamingThread, setRenamingThread] = useState(false);
  const projectChanged = selectedProjectId !== currentProjectId;
  const threadNameChanged = threadName.trim() !== currentThreadName;

  useEffect(() => {
    setSelectedProjectId(currentProjectId);
    setProjectMode("existing");
    setProjectName("");
    setProjectCreateError(null);
    setThreadName(currentThreadName);
    setThreadRenameError(null);
  }, [conversation.id, currentProjectId, currentThreadName]);

  async function handleCreateProjectAndMove() {
    const nextProjectName = projectName.trim();

    if (!nextProjectName) {
      setProjectCreateError("Add a name for the new project first.");
      return;
    }

    setProjectCreateError(null);
    setCreatingProject(true);

    try {
      const project = await onCreateProject(nextProjectName);
      setSelectedProjectId(project.id);
      setProjectName("");
      setProjectMode("existing");
      await onMoveProject(project.id);
    } catch (error) {
      setProjectCreateError(
        error instanceof Error ? error.message : "Unable to create and move this thread right now."
      );
    } finally {
      setCreatingProject(false);
    }
  }

  async function handleRenameThread() {
    setThreadRenameError(null);
    setRenamingThread(true);

    try {
      await onRenameThread(threadName.trim() || null);
    } catch (error) {
      setThreadRenameError(
        error instanceof Error ? error.message : "Unable to rename this thread right now."
      );
    } finally {
      setRenamingThread(false);
    }
  }

  return (
    <div className="flex h-full min-h-0 flex-col bg-[#101010]">
      <div className="flex items-start justify-between gap-3 border-b border-[rgba(255,255,255,0.06)] px-4 py-4">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-[#8D877F]">Thread Details</p>
          <p className="mt-1 text-sm text-[#B7B0A8]">{getConversationWorkspaceLabel(conversation)}</p>
        </div>
        <button
          onClick={onClose}
          className="flex h-9 w-9 items-center justify-center rounded-2xl border border-[rgba(255,255,255,0.06)] bg-[rgba(255,255,255,0.03)] text-[#8D877F] transition-colors hover:text-[#F6F3EE]"
          type="button"
          title="Close thread details"
        >
          <X size={16} />
        </button>
      </div>

      <div className="chat-scroll flex-1 space-y-4 overflow-y-auto px-4 py-4">
        <section className="rounded-[26px] border border-[rgba(255,255,255,0.06)] bg-[rgba(255,255,255,0.02)] p-4">
          <div className="flex flex-wrap items-center gap-2">
            <ThreadTypeBadge conversation={conversation} />
            <span className="rounded-full border border-[rgba(255,255,255,0.08)] bg-[rgba(255,255,255,0.04)] px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.18em] text-[#B7B0A8]">
              Workspace-visible
            </span>
          </div>
          <p className="mt-3 text-lg font-semibold text-[#F6F3EE]">
            {getConversationLabel(conversation, currentUserId)}
          </p>
          <p className="mt-1 text-sm text-[#8D877F]">{getConversationParticipantSummary(conversation)}</p>
          <div className="mt-4 rounded-2xl border border-[rgba(255,255,255,0.05)] bg-[#111111] px-3 py-3">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-[#6F6A64]">Thread Title</p>
                <p className="mt-1 text-xs leading-5 text-[#8D877F]">
                  Give this thread a custom name, or clear it to fall back to the participant-based title.
                </p>
              </div>
              <span className="rounded-full border border-[rgba(255,255,255,0.08)] bg-[rgba(255,255,255,0.04)] px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.18em] text-[#B7B0A8]">
                {currentThreadName ? "Custom" : "Automatic"}
              </span>
            </div>

            <div className="mt-3 space-y-3">
              <Input
                value={threadName}
                onChange={(event) => setThreadName(event.target.value)}
                placeholder={getConversationLabel(conversation, currentUserId)}
                disabled={renamingThread}
              />
              {threadRenameError ? (
                <p className="rounded-2xl border border-[rgba(239,68,68,0.15)] bg-[rgba(239,68,68,0.06)] px-3 py-2 text-xs leading-5 text-[#E7BBBB]">
                  {threadRenameError}
                </p>
              ) : null}
              <div className="flex items-center justify-between gap-3">
                <p className="text-xs leading-5 text-[#6F6A64]">
                  Showing now: {getConversationLabel(conversation, currentUserId)}
                </p>
                <Button
                  variant="secondary"
                  size="sm"
                  className="rounded-2xl px-3"
                  icon={<Pencil size={13} />}
                  loading={renamingThread}
                  disabled={!threadNameChanged}
                  onClick={() => void handleRenameThread()}
                >
                  {threadName.trim() ? "Save Title" : "Use Automatic"}
                </Button>
              </div>
            </div>
          </div>
          <div className="mt-4 grid grid-cols-2 gap-2 text-xs text-[#A39B92]">
            <div className="rounded-2xl border border-[rgba(255,255,255,0.05)] bg-[#111111] px-3 py-2.5">
              <p className="text-[10px] uppercase tracking-[0.18em] text-[#6F6A64]">Messages</p>
              <p className="mt-1 text-sm font-semibold text-[#F6F3EE]">{messageCount}</p>
            </div>
            <div className="rounded-2xl border border-[rgba(255,255,255,0.05)] bg-[#111111] px-3 py-2.5">
              <p className="text-[10px] uppercase tracking-[0.18em] text-[#6F6A64]">Last Active</p>
              <p className="mt-1 text-sm font-semibold text-[#F6F3EE]">{formatRelativeTime(latestActivityAt)}</p>
            </div>
          </div>
          <div className="mt-4 rounded-2xl border border-[rgba(255,255,255,0.05)] bg-[#111111] px-3 py-3">
            <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-[#6F6A64]">Thread Summary</p>
            <p className="mt-2 text-sm leading-6 text-[#B7B0A8] [overflow-wrap:anywhere]">
              {conversation.latestMessage
                ? getPreviewText(conversation)
                : "No messages yet. Start with a teammate, an agent, or a shared workspace thread from the left rail."}
            </p>
          </div>
        </section>

        <ThreadDocumentsPanel
          conversationId={conversation.id}
          documents={conversation.documents}
          uploads={threadDocumentUploads}
          error={threadDocumentError}
          compact
          canRemove
          removingDocumentId={removingDocumentId}
          description="Files attached to this thread stay available here for download and cleanup."
          onRemoveDocument={(document) => void onRemoveThreadDocument(document)}
          onDismissUpload={onDismissThreadUpload}
        />

        <section className="rounded-[26px] border border-[rgba(255,255,255,0.06)] bg-[rgba(255,255,255,0.02)] p-4">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-sm font-semibold text-[#F6F3EE]">Project</p>
              <p className="text-xs text-[#8D877F]">Move this thread between chat projects or back to General.</p>
            </div>
            <span className="rounded-full border border-[rgba(255,255,255,0.06)] bg-[#111111] px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.18em] text-[#B7B0A8]">
              {conversation.project?.name ?? "General"}
            </span>
          </div>

          <div className="mt-4 space-y-3">
            <div className="inline-flex rounded-full border border-[rgba(255,255,255,0.08)] bg-[rgba(255,255,255,0.03)] p-1">
              <button
                type="button"
                onClick={() => setProjectMode("existing")}
                className={cn(
                  "rounded-full px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.18em] transition-colors",
                  projectMode === "existing"
                    ? "bg-[rgba(247,148,29,0.16)] text-[#F6F3EE]"
                    : "text-[#8D877F] hover:text-[#F6F3EE]"
                )}
              >
                Choose
              </button>
              <button
                type="button"
                onClick={() => setProjectMode("new")}
                className={cn(
                  "rounded-full px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.18em] transition-colors",
                  projectMode === "new"
                    ? "bg-[rgba(247,148,29,0.16)] text-[#F6F3EE]"
                    : "text-[#8D877F] hover:text-[#F6F3EE]"
                )}
              >
                New
              </button>
            </div>

            {projectActionError || projectCreateError ? (
              <p className="rounded-2xl border border-[rgba(239,68,68,0.15)] bg-[rgba(239,68,68,0.06)] px-3 py-2 text-xs leading-5 text-[#E7BBBB]">
                {projectActionError ?? projectCreateError}
              </p>
            ) : null}

            {projectMode === "existing" ? (
              <>
                <select
                  value={selectedProjectId}
                  onChange={(event) => setSelectedProjectId(event.target.value)}
                  disabled={movingProject || creatingProject || projectsLoading}
                  className="w-full rounded-2xl border border-[rgba(255,255,255,0.08)] bg-[#111111] px-3 py-2.5 text-sm text-[#F0F0F0] transition-all duration-200 focus:border-[#F7941D] focus:outline-none focus:ring-1 focus:ring-[rgba(247,148,29,0.2)] disabled:cursor-not-allowed disabled:opacity-60"
                >
                  <option value="">General</option>
                  {projects.map((project) => (
                    <option key={project.id} value={project.id}>
                      {project.name}
                    </option>
                  ))}
                </select>

                <div className="flex items-center justify-between gap-3">
                  <p className="text-xs leading-5 text-[#6F6A64]">
                    {projectsError
                      ? projectsError
                      : projectsLoading
                      ? "Refreshing chat projects..."
                      : "Reassigning keeps the same participants, runtime state, and inspector context on this thread."}
                  </p>
                  <Button
                    variant="secondary"
                    size="sm"
                    className="rounded-2xl px-3"
                    loading={movingProject}
                    disabled={!projectChanged || projectsLoading || creatingProject}
                    onClick={() => void onMoveProject(selectedProjectId || null)}
                  >
                    {movingProject
                      ? "Moving..."
                      : selectedProjectId
                        ? "Move Thread"
                        : "Send to General"}
                  </Button>
                </div>
              </>
            ) : (
              <>
                <Input
                  value={projectName}
                  onChange={(event) => setProjectName(event.target.value)}
                  placeholder="Customer handoffs, Q2 launch, Incident room"
                  disabled={creatingProject || movingProject}
                />
                <div className="flex items-center justify-between gap-3">
                  <p className="text-xs leading-5 text-[#6F6A64]">
                    Create the project here and move this thread into it in one step.
                  </p>
                  <Button
                    variant="secondary"
                    size="sm"
                    className="rounded-2xl px-3"
                    icon={<Plus size={13} />}
                    loading={creatingProject}
                    disabled={movingProject}
                    onClick={() => void handleCreateProjectAndMove()}
                  >
                    {creatingProject ? "Creating..." : "Create & Move"}
                  </Button>
                </div>
              </>
            )}
          </div>
        </section>

        <section className="rounded-[26px] border border-[rgba(255,255,255,0.06)] bg-[rgba(255,255,255,0.02)] p-4">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-sm font-semibold text-[#F6F3EE]">Participants</p>
              <p className="text-xs text-[#8D877F]">Humans and agents already on this thread.</p>
            </div>
            <div className="flex items-center gap-2">
              <span className="rounded-full border border-[rgba(255,255,255,0.06)] bg-[#111111] px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.18em] text-[#B7B0A8]">
                {conversation.members.length} total
              </span>
              <Button
                variant="secondary"
                size="sm"
                icon={<UserPlus size={14} />}
                onClick={onOpenAddParticipants}
              >
                Add
              </Button>
            </div>
          </div>

          <div className="mt-4 space-y-3">
            {participantActionError ? (
              <p className="rounded-2xl border border-[rgba(239,68,68,0.15)] bg-[rgba(239,68,68,0.06)] px-3 py-2 text-xs leading-5 text-[#E7BBBB]">
                {participantActionError}
              </p>
            ) : null}

            {humanParticipants.length > 0 ? (
              <div>
                <p className="mb-2 text-[10px] font-semibold uppercase tracking-[0.18em] text-[#6F6A64]">Humans</p>
                <div className="space-y-2">
                  {humanParticipants.map((member) => (
                    <div
                      key={`human-${member.id}`}
                      className="flex items-center gap-3 rounded-2xl border border-[rgba(255,255,255,0.05)] bg-[#111111] px-3 py-2.5"
                    >
                      <MemberAvatar member={member} size="sm" />
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <p className="truncate text-sm font-medium text-[#F6F3EE]">{member.name}</p>
                          {member.id === currentUserId ? (
                            <span className="rounded-full border border-[rgba(247,148,29,0.18)] bg-[rgba(247,148,29,0.1)] px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-[0.18em] text-[#FDBA4D]">
                              You
                            </span>
                          ) : null}
                        </div>
                        <p className="truncate text-xs text-[#8D877F]">
                          {member.role ?? "Teammate"}
                          {member.email ? ` - ${member.email}` : ""}
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        <PresenceBadge status={getOnlineStatus(member.lastSeen ?? null)} />
                        {member.id !== currentUserId ? (
                          <button
                            type="button"
                            onClick={() => onRemoveParticipant(member)}
                            disabled={!canRemoveParticipants || removingParticipantId === `user-${member.id}`}
                            className="flex h-8 w-8 items-center justify-center rounded-xl border border-[rgba(255,255,255,0.08)] bg-[#181818] text-[#8D877F] transition-colors hover:text-[#F6F3EE] disabled:cursor-not-allowed disabled:opacity-40"
                            title={
                              canRemoveParticipants
                                ? `Remove ${member.name}`
                                : "Threads need at least one other participant"
                            }
                          >
                            {removingParticipantId === `user-${member.id}` ? (
                              <div className="h-3.5 w-3.5 rounded-full border-2 border-[rgba(255,255,255,0.18)] border-t-[#F6F3EE] animate-spin" />
                            ) : (
                              <Trash2 size={14} />
                            )}
                          </button>
                        ) : null}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ) : null}

            {agentParticipants.length > 0 ? (
              <div>
                <p className="mb-2 text-[10px] font-semibold uppercase tracking-[0.18em] text-[#6F6A64]">Agents</p>
                <div className="space-y-2">
                  {agentParticipants.map((member) => {
                    const status = getAgentSidebarStatus(member.llmStatus);

                    return (
                      <div
                        key={`agent-${member.id}`}
                        className="flex items-center gap-3 rounded-2xl border border-[rgba(75,156,211,0.16)] bg-[rgba(75,156,211,0.06)] px-3 py-2.5"
                      >
                        <MemberAvatar member={member} size="sm" />
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2">
                            <p className="truncate text-sm font-medium text-[#F6F3EE]">{member.name}</p>
                            {member.id === activeAgentParticipant?.id ? (
                              <span className="rounded-full border border-[rgba(75,156,211,0.22)] bg-[rgba(75,156,211,0.12)] px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-[0.18em] text-[#9FCBE0]">
                                Active
                              </span>
                            ) : null}
                          </div>
                          <p className="truncate text-xs text-[#8D877F]">
                            {member.role ?? "AI Agent"}
                            {member.llmModel ? ` - ${member.llmModel}` : ""}
                          </p>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className={cn("rounded-full border px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.18em]", status.chipClassName)}>
                            {status.label}
                          </span>
                          <button
                            type="button"
                            onClick={() => onRemoveParticipant(member)}
                            disabled={!canRemoveParticipants || removingParticipantId === `agent-${member.id}`}
                            className="flex h-8 w-8 items-center justify-center rounded-xl border border-[rgba(255,255,255,0.08)] bg-[#181818] text-[#8D877F] transition-colors hover:text-[#F6F3EE] disabled:cursor-not-allowed disabled:opacity-40"
                            title={
                              canRemoveParticipants
                                ? `Remove ${member.name}`
                                : "Threads need at least one other participant"
                            }
                          >
                            {removingParticipantId === `agent-${member.id}` ? (
                              <div className="h-3.5 w-3.5 rounded-full border-2 border-[rgba(255,255,255,0.18)] border-t-[#F6F3EE] animate-spin" />
                            ) : (
                              <Trash2 size={14} />
                            )}
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            ) : null}
          </div>

          {!canRemoveParticipants ? (
            <p className="mt-4 text-xs leading-5 text-[#6F6A64]">
              Direct 1:1 threads stay intact until there is at least one additional participant to remove safely.
            </p>
          ) : null}
        </section>

        <section className="rounded-[26px] border border-[rgba(255,255,255,0.06)] bg-[rgba(255,255,255,0.02)] p-4">
          <p className="text-sm font-semibold text-[#F6F3EE]">Thread Context</p>
          <p className="mt-1 text-xs text-[#8D877F]">
            Secondary thread state stays here so the conversation stays front and center.
          </p>

          {hasAgentParticipants ? (
            <div className="mt-4 space-y-3">
              <div className="rounded-2xl border border-[rgba(75,156,211,0.16)] bg-[rgba(75,156,211,0.06)] px-3 py-3">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-[#6FAFD2]">Agent State</p>
                    <p className="mt-1 text-sm font-medium text-[#F6F3EE]">
                      {activeAgentBootstrapPending ? "Initializing agent" : activeAgentStatusLabel ?? "Agent participant"}
                    </p>
                    {activeAgentParticipant ? (
                      <p className="mt-1 text-xs text-[#8DC1DB]">
                        Active runtime target: {activeAgentParticipant.name}.
                        {" "}
                        {activeAgentIsExplicit
                          ? "This thread is following your explicit selection."
                          : "No explicit agent is pinned yet, so the first joined agent is handling the thread."}
                      </p>
                    ) : null}
                  </div>
                  {threadModelLabel ? (
                    <span className="rounded-full border border-[rgba(75,156,211,0.18)] bg-[rgba(75,156,211,0.1)] px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.18em] text-[#9FCBE0]">
                      {threadModelLabel}
                    </span>
                  ) : null}
                </div>

                {agentInspectorLoading ? (
                  <div className="mt-3 flex items-center gap-2 text-xs text-[#9FCBE0]">
                    <div className="h-3.5 w-3.5 rounded-full border-2 border-[rgba(126,200,227,0.2)] border-t-[#7EC8E3] animate-spin" />
                    <span>Refreshing thread readiness and context.</span>
                  </div>
                ) : agentInspector ? (
                  <div className="mt-3 flex flex-wrap items-center gap-3 text-xs text-[#B7D8E8]">
                    <span className="inline-flex items-center gap-1">
                      <RadialContextBar tokens={agentInspector.context.estimatedTokens} />
                      <span>{formatTokensK(agentInspector.context.estimatedTokens)} / 128K</span>
                    </span>
                    <span>{agentInspector.context.recentHistoryCount}/{agentInspector.context.historyWindowSize} msgs</span>
                    <span>{formatThinkingMode(agentInspector.agent.llmThinkingMode)} thinking</span>
                  </div>
                ) : agentInspectorError ? (
                  <p className="mt-3 text-xs leading-5 text-[#D8B2B2]">{agentInspectorError}</p>
                ) : null}

                {agentParticipants.length > 1 ? (
                  <div className="mt-4 border-t border-[rgba(255,255,255,0.06)] pt-3">
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-[#6FAFD2]">Active Agent</p>
                        <p className="mt-1 text-xs text-[#9FCBE0]">
                          Switch which agent replies and loads in the inspector for this thread.
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="rounded-full border border-[rgba(255,255,255,0.06)] bg-[#111111] px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.18em] text-[#B7B0A8]">
                          {activeAgentIsExplicit ? "Pinned" : "Fallback"}
                        </span>
                        {activeAgentIsExplicit ? (
                          <Button
                            variant="secondary"
                            size="sm"
                            className="rounded-2xl px-3"
                            loading={clearingActiveAgentPin}
                            disabled={switchingActiveAgentId !== null}
                            onClick={onClearActiveAgentPin}
                          >
                            {clearingActiveAgentPin ? "Returning..." : "Use Fallback"}
                          </Button>
                        ) : null}
                      </div>
                    </div>

                    <div className="mt-3 flex flex-wrap gap-2">
                      {agentParticipants.map((member) => {
                        const isActive = member.id === activeAgentParticipant?.id;
                        const switchingThisAgent = switchingActiveAgentId === member.id;

                        return (
                          <button
                            key={`switch-agent-${member.id}`}
                            type="button"
                            onClick={() => onSwitchActiveAgent(member.id)}
                            disabled={switchingActiveAgentId !== null || clearingActiveAgentPin}
                            className={cn(
                              "flex min-w-[10rem] items-center gap-2 rounded-2xl border px-3 py-2 text-left transition-colors disabled:cursor-not-allowed disabled:opacity-50",
                              isActive
                                ? "border-[rgba(75,156,211,0.22)] bg-[rgba(75,156,211,0.14)] text-[#F6F3EE]"
                                : "border-[rgba(255,255,255,0.08)] bg-[#111111] text-[#CFC9C2] hover:border-[rgba(75,156,211,0.18)] hover:text-[#F6F3EE]"
                            )}
                          >
                            <MemberAvatar member={member} size="xs" />
                            <span className="min-w-0 flex-1">
                              <span className="block truncate text-xs font-semibold">{member.name}</span>
                              <span className="block truncate text-[11px] text-[#8D877F]">
                                {switchingThisAgent
                                  ? "Switching now..."
                                  : isActive
                                    ? activeAgentIsExplicit
                                      ? "Pinned to this thread"
                                      : "Active by first-joined fallback"
                                    : "Set as active"}
                              </span>
                            </span>
                          </button>
                        );
                      })}
                    </div>
                    {!activeAgentIsExplicit ? (
                      <p className="mt-3 text-[11px] leading-5 text-[#8D877F]">
                        Fallback mode keeps the thread on the first joined remaining agent until you pin a different one.
                      </p>
                    ) : null}
                  </div>
                ) : null}
              </div>

              <div className="rounded-2xl border border-[rgba(255,255,255,0.05)] bg-[#111111] px-3 py-3">
                <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-[#6F6A64]">Inspector Access</p>
                <p className="mt-2 text-sm leading-6 text-[#B7B0A8]">
                  {inspectAvailable
                    ? "Open the existing thread inspector to review payload, prompt, routing, and context details for the active runtime agent."
                    : "Inspector access appears here as soon as an agent becomes part of the thread."}
                </p>
                <div className="mt-3 flex flex-wrap gap-2">
                  <Button
                    variant="secondary"
                    size="sm"
                    icon={<Eye size={14} />}
                    onClick={onOpenInspector}
                    disabled={!inspectAvailable || agentInspectorLoading || !!agentInspectorError || !agentInspector}
                  >
                    Inspect Context
                  </Button>
                  {clearThreadAvailable && activeAgentReady ? (
                    <Button
                      variant="secondary"
                      size="sm"
                      loading={clearingConversation}
                      icon={<Trash2 size={14} />}
                      className="border-[rgba(255,255,255,0.08)] bg-[#181818] text-[#B7B0A8] hover:bg-[rgba(255,255,255,0.06)] hover:text-[#F6F3EE]"
                      onClick={onOpenClearThread}
                    >
                      Clear Thread
                    </Button>
                  ) : null}
                </div>
              </div>
            </div>
          ) : (
            <div className="mt-4 rounded-2xl border border-[rgba(255,255,255,0.05)] bg-[#111111] px-3 py-3">
              <p className="text-sm leading-6 text-[#B7B0A8]">
                This thread is presented as a shared workspace conversation in the UI. Agent routing, model state, and inspect controls appear here once an agent is an active participant.
              </p>
            </div>
          )}
        </section>
      </div>
    </div>
  );
}

export function ThreadDrawer({
  open,
  conversation,
  currentUserId,
  messageCount,
  threadModelLabel,
  agentInspector,
  agentInspectorLoading,
  agentInspectorError,
  activeAgentParticipant,
  activeAgentStatusLabel,
  activeAgentReady,
  activeAgentBootstrapPending,
  clearThreadAvailable,
  clearingConversation,
  participantActionError,
  switchingActiveAgentId,
  clearingActiveAgentPin,
  removingParticipantId,
  projects,
  projectsLoading,
  projectsError,
  projectActionError,
  movingProject,
  threadDocumentUploads,
  threadDocumentError,
  removingDocumentId,
  onOpenAddParticipants,
  onOpenInspector,
  onOpenClearThread,
  onSwitchActiveAgent,
  onClearActiveAgentPin,
  onRemoveParticipant,
  onMoveProject,
  onCreateProject,
  onRenameThread,
  onRemoveThreadDocument,
  onDismissThreadUpload,
  onClose,
}: {
  open: boolean;
  conversation: ConversationSummary | null;
  currentUserId: string;
  messageCount: number;
  threadModelLabel: string | null;
  agentInspector: AgentInspectorData | null;
  agentInspectorLoading: boolean;
  agentInspectorError: string | null;
  activeAgentParticipant: ConversationMemberSummary | null;
  activeAgentStatusLabel: string | null;
  activeAgentReady: boolean;
  activeAgentBootstrapPending: boolean;
  clearThreadAvailable: boolean;
  clearingConversation: boolean;
  participantActionError: string | null;
  switchingActiveAgentId: string | null;
  clearingActiveAgentPin: boolean;
  removingParticipantId: string | null;
  projects: ChatProjectOption[];
  projectsLoading: boolean;
  projectsError: string | null;
  projectActionError: string | null;
  movingProject: boolean;
  threadDocumentUploads: ThreadDocumentUploadState[];
  threadDocumentError: string | null;
  removingDocumentId: string | null;
  onOpenAddParticipants: () => void;
  onOpenInspector: () => void;
  onOpenClearThread: () => void;
  onSwitchActiveAgent: (agentId: string) => void;
  onClearActiveAgentPin: () => void;
  onRemoveParticipant: (participant: ConversationMemberSummary) => void;
  onMoveProject: (projectId: string | null) => Promise<void>;
  onCreateProject: (name: string) => Promise<ChatProjectOption>;
  onRenameThread: (name: string | null) => Promise<void>;
  onRemoveThreadDocument: (document: ConversationDocumentSummary) => Promise<void>;
  onDismissThreadUpload: (uploadId: string) => void;
  onClose: () => void;
}) {
  if (!open || !conversation) return null;

  return (
    <div className="fixed inset-0 z-40 bg-black/55 backdrop-blur-sm" onClick={onClose}>
      <motion.div
        initial={{ x: 24, opacity: 0 }}
        animate={{ x: 0, opacity: 1 }}
        transition={{ duration: 0.18, ease: "easeOut" }}
        onClick={(event) => event.stopPropagation()}
        className="absolute inset-y-0 right-0 w-full max-w-[24rem] border-l border-[rgba(255,255,255,0.06)] shadow-[0_24px_80px_rgba(0,0,0,0.45)]"
      >
        <ThreadDetailsPanel
          conversation={conversation}
          currentUserId={currentUserId}
          messageCount={messageCount}
          threadModelLabel={threadModelLabel}
          agentInspector={agentInspector}
          agentInspectorLoading={agentInspectorLoading}
          agentInspectorError={agentInspectorError}
          activeAgentParticipant={activeAgentParticipant}
          activeAgentStatusLabel={activeAgentStatusLabel}
          activeAgentReady={activeAgentReady}
          activeAgentBootstrapPending={activeAgentBootstrapPending}
          clearThreadAvailable={clearThreadAvailable}
          clearingConversation={clearingConversation}
          participantActionError={participantActionError}
          switchingActiveAgentId={switchingActiveAgentId}
          clearingActiveAgentPin={clearingActiveAgentPin}
          removingParticipantId={removingParticipantId}
          projects={projects}
          projectsLoading={projectsLoading}
          projectsError={projectsError}
          projectActionError={projectActionError}
          movingProject={movingProject}
          threadDocumentUploads={threadDocumentUploads}
          threadDocumentError={threadDocumentError}
          removingDocumentId={removingDocumentId}
          onOpenAddParticipants={onOpenAddParticipants}
          onOpenInspector={onOpenInspector}
          onOpenClearThread={onOpenClearThread}
          onSwitchActiveAgent={onSwitchActiveAgent}
          onClearActiveAgentPin={onClearActiveAgentPin}
          onRemoveParticipant={onRemoveParticipant}
          onMoveProject={onMoveProject}
          onCreateProject={onCreateProject}
          onRenameThread={onRenameThread}
          onRemoveThreadDocument={onRemoveThreadDocument}
          onDismissThreadUpload={onDismissThreadUpload}
          onClose={onClose}
        />
      </motion.div>
    </div>
  );
}
