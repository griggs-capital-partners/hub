"use client";

import type { FormEvent } from "react";
import { useMemo, useState } from "react";
import { motion } from "framer-motion";
import { Bot, Check, Plus, UsersRound, X } from "lucide-react";
import { Avatar } from "@/components/ui/Avatar";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import {
  type AIAgent,
  type ChatProjectOption,
  type NewThreadSelection,
  type TeamMember,
  getAgentSidebarStatus,
  getMemberDisplayName,
  getOnlineStatus,
  OnlineDot,
} from "@/components/team/team-chat-shared";
import { cn } from "@/lib/utils";

function ParticipantChip({
  label,
  accent = "default",
  image,
  isAgent = false,
}: {
  label: string;
  accent?: "default" | "human" | "agent";
  image?: string | null;
  isAgent?: boolean;
}) {
  const accentClassName =
    accent === "agent"
      ? "border-[rgba(75,156,211,0.2)] bg-[rgba(75,156,211,0.08)] text-[#A9DCF3]"
      : accent === "human"
        ? "border-[rgba(247,148,29,0.18)] bg-[rgba(247,148,29,0.08)] text-[#F6F3EE]"
        : "border-[rgba(255,255,255,0.08)] bg-[rgba(255,255,255,0.04)] text-[#B7B0A8]";

  return (
    <span className={cn("inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-medium", accentClassName)}>
      {isAgent ? (
        <span className="flex h-5 w-5 items-center justify-center overflow-hidden rounded-full border border-[rgba(75,156,211,0.22)] bg-[rgba(75,156,211,0.14)] text-[#7EC8E3]">
          {image
            ? image.startsWith("data:") || image.startsWith("https://")
              ? <img src={image} alt={label} className="h-full w-full object-cover" />
              : <span className="text-[10px]">{image}</span>
            : <Bot size={11} />}
        </span>
      ) : (
        <Avatar src={image ?? null} name={label} size="xs" />
      )}
      <span className="max-w-[12rem] truncate">{label}</span>
    </span>
  );
}

type NewThreadModalMode = "create" | "add";

export function NewThreadModal({
  currentUserId,
  currentUserName,
  users,
  agents,
  projects = [],
  projectsLoading = false,
  projectsError = null,
  initialProjectId = null,
  onClose,
  onSubmit,
  mode = "create",
  threadLabel,
  existingUserIds = [],
  existingAgentIds = [],
}: {
  currentUserId: string;
  currentUserName: string;
  users: TeamMember[];
  agents: AIAgent[];
  projects?: ChatProjectOption[];
  projectsLoading?: boolean;
  projectsError?: string | null;
  initialProjectId?: string | null;
  onClose: () => void;
  onSubmit: (selection: NewThreadSelection) => Promise<void>;
  mode?: NewThreadModalMode;
  threadLabel?: string | null;
  existingUserIds?: string[];
  existingAgentIds?: string[];
}) {
  const selectableUsers = useMemo(
    () => users.filter((user) => user.id !== currentUserId),
    [currentUserId, users]
  );
  const existingUserIdSet = useMemo(() => new Set(existingUserIds), [existingUserIds]);
  const existingAgentIdSet = useMemo(() => new Set(existingAgentIds), [existingAgentIds]);
  const existingUsers = useMemo(
    () => selectableUsers.filter((user) => existingUserIdSet.has(user.id)),
    [existingUserIdSet, selectableUsers]
  );
  const existingAgents = useMemo(
    () => agents.filter((agent) => existingAgentIdSet.has(agent.id)),
    [agents, existingAgentIdSet]
  );
  const [name, setName] = useState("");
  const [projectId, setProjectId] = useState(initialProjectId ?? "");
  const [projectMode, setProjectMode] = useState<"existing" | "new">("existing");
  const [projectName, setProjectName] = useState("");
  const [selectedUserIds, setSelectedUserIds] = useState<string[]>([]);
  const [selectedAgentIds, setSelectedAgentIds] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const selectedUsers = useMemo(
    () => selectableUsers.filter((user) => selectedUserIds.includes(user.id)),
    [selectableUsers, selectedUserIds]
  );
  const selectedAgents = useMemo(
    () => agents.filter((agent) => selectedAgentIds.includes(agent.id)),
    [agents, selectedAgentIds]
  );
  const totalSelected = selectedUserIds.length + selectedAgentIds.length;
  const modalTitle = mode === "create" ? "Start a fresh thread" : "Add participants";
  const modalDescription = mode === "create"
    ? "You're included automatically. Add humans, agents, or both without reopening an older thread."
    : `Add humans, agents, or both to ${threadLabel?.trim() || "this thread"} without breaking the current workflow.`;
  const submitLabel = mode === "create"
    ? totalSelected <= 1
      ? "Start Chat"
      : "Start Thread"
    : totalSelected === 1
      ? "Add Participant"
      : "Add Participants";
  const selectedProjectLabel = mode === "create"
    ? projectMode === "new"
      ? projectName.trim() || "New project"
      : projects.find((project) => project.id === projectId)?.name ?? "General"
    : null;
  const showsAgentRuntimeNote =
    selectedAgentIds.length > 1
    || existingAgents.length > 1
    || ((selectedAgentIds.length > 0 || existingAgents.length > 0) && (selectedUserIds.length > 0 || existingUsers.length > 0));

  function toggleUser(userId: string) {
    if (existingUserIdSet.has(userId)) return;

    setSelectedUserIds((current) =>
      current.includes(userId) ? current.filter((id) => id !== userId) : [...current, userId]
    );
  }

  function toggleAgent(agentId: string) {
    if (existingAgentIdSet.has(agentId)) return;

    setSelectedAgentIds((current) =>
      current.includes(agentId) ? current.filter((id) => id !== agentId) : [...current, agentId]
    );
  }

  async function handleCreate(event: FormEvent) {
    event.preventDefault();
    if (totalSelected === 0) {
      setError(mode === "create" ? "Choose at least one teammate or agent." : "Choose at least one new participant.");
      return;
    }

    const trimmedProjectName = mode === "create" && projectMode === "new" ? projectName.trim() : "";
    if (mode === "create" && projectMode === "new" && !trimmedProjectName) {
      setError("Add a name for the new project, or send the thread to General.");
      return;
    }

    setLoading(true);
    setError("");

    try {
      await onSubmit({
        name: mode === "create" ? name : "",
        userIds: selectedUserIds,
        agentIds: selectedAgentIds,
        projectId: mode === "create" && projectMode === "existing" ? projectId || null : null,
        projectName: mode === "create" ? trimmedProjectName : "",
      });
      onClose();
    } catch (createError) {
      setError(createError instanceof Error ? createError.message : "Unable to update the thread right now.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" />
      <motion.div
        initial={{ opacity: 0, y: 12, scale: 0.98 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        onClick={(event) => event.stopPropagation()}
        className="relative flex max-h-[90vh] w-full max-w-3xl flex-col overflow-hidden rounded-3xl border border-[rgba(255,255,255,0.08)] bg-[#161616] shadow-2xl"
      >
        <div className="flex items-start justify-between gap-4 border-b border-[rgba(255,255,255,0.06)] px-6 py-5">
          <div className="flex items-start gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[rgba(247,148,29,0.14)] text-[#F7941D]">
              {mode === "create" ? <UsersRound size={18} /> : <Plus size={18} />}
            </div>
            <div>
              <h2 className="text-lg font-semibold text-[#F6F3EE]">{modalTitle}</h2>
              <p className="mt-1 text-sm text-[#8D877F]">{modalDescription}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="flex h-10 w-10 items-center justify-center rounded-2xl border border-[rgba(255,255,255,0.08)] bg-[#181818] text-[#8D877F] transition-colors hover:text-[#F6F3EE]"
            type="button"
            title={mode === "create" ? "Close new thread modal" : "Close add participants modal"}
          >
            <X size={16} />
          </button>
        </div>

        <form onSubmit={handleCreate} className="flex min-h-0 flex-1 flex-col">
          <div className="chat-scroll flex-1 space-y-5 overflow-y-auto px-6 py-5">
            <div className="space-y-3">
              {mode === "create" ? (
                <div className="grid gap-3 md:grid-cols-[minmax(0,1fr)_220px]">
                  <Input
                    label="Thread title (optional)"
                    value={name}
                    onChange={(event) => setName(event.target.value)}
                    placeholder="Launch planning, Incident follow-up, Customer handoff"
                    disabled={loading}
                  />
                  <div className="rounded-2xl border border-[rgba(255,255,255,0.06)] bg-[#111111] px-4 py-3">
                    <div className="flex items-center justify-between gap-3">
                      <label className="text-xs font-medium uppercase tracking-wider text-[#9A9A9A]">
                        Project
                      </label>
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
                    </div>

                    <div className="mt-3">
                      {projectMode === "existing" ? (
                        <>
                          <select
                            value={projectId}
                            onChange={(event) => setProjectId(event.target.value)}
                            disabled={loading}
                            className="w-full rounded-lg border border-[rgba(255,255,255,0.08)] bg-[#222222] px-3 py-2 text-sm text-[#F0F0F0] transition-all duration-200 focus:border-[#F7941D] focus:outline-none focus:ring-1 focus:ring-[rgba(247,148,29,0.2)]"
                          >
                            <option value="">General</option>
                            {projects.map((project) => (
                              <option key={project.id} value={project.id}>
                                {project.name}
                              </option>
                            ))}
                          </select>
                          <p className="mt-2 text-xs text-[#6F6A64]">
                            {projectsError
                              ? projectsError
                              : projectsLoading
                                ? "Loading chat projects..."
                                : projects.length > 0
                                  ? "Pick an existing chat project or leave the thread in General."
                                  : "No chat projects yet. Leave the thread in General or create one here."}
                          </p>
                        </>
                      ) : (
                        <>
                          <Input
                            value={projectName}
                            onChange={(event) => setProjectName(event.target.value)}
                            placeholder="Customer handoffs, Q2 launch, Incident room"
                            disabled={loading}
                          />
                          <p className="mt-2 text-xs text-[#6F6A64]">
                            The project is created when you start this thread. Leave it blank to switch back to General.
                          </p>
                        </>
                      )}
                    </div>
                  </div>
                </div>
              ) : null}
              <div className="rounded-2xl border border-[rgba(255,255,255,0.06)] bg-[#111111] px-4 py-3">
                {mode === "create" ? (
                  <>
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-[#8D877F]">Selected Participants</p>
                      <span className="rounded-full border border-[rgba(255,255,255,0.08)] bg-[rgba(255,255,255,0.04)] px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.18em] text-[#B7B0A8]">
                        {selectedProjectLabel}
                      </span>
                    </div>
                    <div className="mt-3 flex flex-wrap gap-2">
                      <ParticipantChip label={`${currentUserName} (You)`} accent="human" />
                      {selectedUsers.map((user) => (
                        <ParticipantChip
                          key={`user-chip-${user.id}`}
                          label={getMemberDisplayName(user)}
                          image={user.image}
                          accent="human"
                        />
                      ))}
                      {selectedAgents.map((agent) => (
                        <ParticipantChip
                          key={`agent-chip-${agent.id}`}
                          label={agent.name}
                          image={agent.avatar}
                          accent="agent"
                          isAgent
                        />
                      ))}
                      {totalSelected === 0 ? (
                        <span className="rounded-full border border-dashed border-[rgba(255,255,255,0.1)] px-3 py-1.5 text-xs text-[#6F6A64]">
                          No one selected yet
                        </span>
                      ) : null}
                    </div>
                    <p className="mt-3 text-xs text-[#6F6A64]">
                      Fresh 1:1 chats still open as direct threads, and each new start stays visible as its own thread in the workspace list. Any broader selection creates a new shared workspace thread.
                    </p>
                  </>
                ) : (
                  <div className="space-y-4">
                    <div>
                      <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-[#8D877F]">Already On This Thread</p>
                      <div className="mt-3 flex flex-wrap gap-2">
                        <ParticipantChip label={`${currentUserName} (You)`} accent="human" />
                        {existingUsers.map((user) => (
                          <ParticipantChip
                            key={`existing-user-${user.id}`}
                            label={getMemberDisplayName(user)}
                            image={user.image}
                            accent="human"
                          />
                        ))}
                        {existingAgents.map((agent) => (
                          <ParticipantChip
                            key={`existing-agent-${agent.id}`}
                            label={agent.name}
                            image={agent.avatar}
                            accent="agent"
                            isAgent
                          />
                        ))}
                      </div>
                    </div>

                    <div>
                      <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-[#8D877F]">Adding Now</p>
                      <div className="mt-3 flex flex-wrap gap-2">
                        {selectedUsers.map((user) => (
                          <ParticipantChip
                            key={`selected-user-${user.id}`}
                            label={getMemberDisplayName(user)}
                            image={user.image}
                            accent="human"
                          />
                        ))}
                        {selectedAgents.map((agent) => (
                          <ParticipantChip
                            key={`selected-agent-${agent.id}`}
                            label={agent.name}
                            image={agent.avatar}
                            accent="agent"
                            isAgent
                          />
                        ))}
                        {totalSelected === 0 ? (
                          <span className="rounded-full border border-dashed border-[rgba(255,255,255,0.1)] px-3 py-1.5 text-xs text-[#6F6A64]">
                            No new participants selected yet
                          </span>
                        ) : null}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>

            <div className="grid gap-5 lg:grid-cols-2">
              <section>
                <div className="mb-2 flex items-center justify-between">
                  <p className="text-xs font-semibold uppercase tracking-[0.22em] text-[#8D877F]">Humans</p>
                  <span className="text-xs text-[#6F6A64]">{selectedUserIds.length} selected</span>
                </div>
                <div className="max-h-80 space-y-2 overflow-y-auto rounded-2xl border border-[rgba(255,255,255,0.06)] bg-[#111111] p-3">
                  {selectableUsers.map((user) => {
                    const checked = selectedUserIds.includes(user.id);
                    const unavailable = existingUserIdSet.has(user.id);
                    const status = getOnlineStatus(user.lastSeen);
                    const label = getMemberDisplayName(user);

                    return (
                      <button
                        key={user.id}
                        type="button"
                        onClick={() => toggleUser(user.id)}
                        disabled={unavailable}
                        className={cn(
                          "flex w-full items-center gap-3 rounded-2xl border px-3 py-2.5 text-left transition-all disabled:cursor-default disabled:opacity-70",
                          unavailable
                            ? "border-[rgba(255,255,255,0.06)] bg-[rgba(255,255,255,0.03)]"
                            : checked
                              ? "border-[rgba(247,148,29,0.3)] bg-[rgba(247,148,29,0.08)]"
                              : "border-transparent bg-[#181818] hover:border-[rgba(255,255,255,0.08)]"
                        )}
                      >
                        <div className="relative">
                          <Avatar src={user.image} name={label} size="sm" />
                          <span className="absolute -bottom-0.5 -right-0.5">
                            <OnlineDot status={status} />
                          </span>
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2">
                            <p className="truncate text-sm font-medium text-[#F6F3EE]">{label}</p>
                            {unavailable ? (
                              <span className="rounded-full border border-[rgba(255,255,255,0.08)] bg-[rgba(255,255,255,0.04)] px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-[0.18em] text-[#B7B0A8]">
                                Added
                              </span>
                            ) : null}
                          </div>
                          <p className="truncate text-xs text-[#8D877F]">{user.role}</p>
                        </div>
                        <span
                          className={cn(
                            "flex h-5 w-5 items-center justify-center rounded-full border text-[10px] font-semibold",
                            unavailable
                              ? "border-[rgba(255,255,255,0.08)] bg-[rgba(255,255,255,0.04)] text-[#8D877F]"
                              : checked
                                ? "border-[rgba(247,148,29,0.4)] bg-[#F7941D] text-[#111111]"
                                : "border-[rgba(255,255,255,0.12)] text-[#8D877F]"
                          )}
                        >
                          {checked || unavailable ? <Check size={11} /> : null}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </section>

              <section>
                <div className="mb-2 flex items-center justify-between">
                  <p className="text-xs font-semibold uppercase tracking-[0.22em] text-[#8D877F]">Agents</p>
                  <span className="text-xs text-[#6F6A64]">{selectedAgentIds.length} selected</span>
                </div>
                <div className="max-h-80 space-y-2 overflow-y-auto rounded-2xl border border-[rgba(255,255,255,0.06)] bg-[#111111] p-3">
                  {agents.map((agent) => {
                    const checked = selectedAgentIds.includes(agent.id);
                    const unavailable = existingAgentIdSet.has(agent.id);
                    const agentStatus = getAgentSidebarStatus(agent.llmStatus);

                    return (
                      <button
                        key={agent.id}
                        type="button"
                        onClick={() => toggleAgent(agent.id)}
                        disabled={unavailable}
                        className={cn(
                          "flex w-full items-center gap-3 rounded-2xl border px-3 py-2.5 text-left transition-all disabled:cursor-default disabled:opacity-70",
                          unavailable
                            ? "border-[rgba(255,255,255,0.06)] bg-[rgba(255,255,255,0.03)]"
                            : checked
                              ? "border-[rgba(75,156,211,0.32)] bg-[rgba(75,156,211,0.1)]"
                              : "border-transparent bg-[#181818] hover:border-[rgba(75,156,211,0.16)]"
                        )}
                      >
                        <div className="relative">
                          <div className="flex h-10 w-10 items-center justify-center overflow-hidden rounded-[18px] border border-[rgba(75,156,211,0.34)] bg-[linear-gradient(180deg,rgba(75,156,211,0.18),rgba(75,156,211,0.08))] text-[#A9DCF3]">
                            {agent.avatar
                              ? agent.avatar.startsWith("data:") || agent.avatar.startsWith("https://")
                                ? <img src={agent.avatar} alt={agent.name} className="h-full w-full object-cover" />
                                : <span className="text-sm">{agent.avatar}</span>
                              : <Bot size={16} />}
                          </div>
                          <span
                            className="absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full border-2 border-[#111111]"
                            style={{ backgroundColor: agentStatus.dot }}
                          />
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2">
                            <p className="truncate text-sm font-medium text-[#F6F3EE]">{agent.name}</p>
                            <span className="rounded-full border border-[rgba(75,156,211,0.18)] bg-[rgba(75,156,211,0.1)] px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-[0.2em] text-[#7EC8E3]">
                              AI
                            </span>
                            {unavailable ? (
                              <span className="rounded-full border border-[rgba(255,255,255,0.08)] bg-[rgba(255,255,255,0.04)] px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-[0.18em] text-[#B7B0A8]">
                                Added
                              </span>
                            ) : null}
                          </div>
                          <p className="truncate text-xs text-[#8D877F]">{agentStatus.description}</p>
                        </div>
                        <span
                          className={cn(
                            "flex h-5 w-5 items-center justify-center rounded-full border text-[10px] font-semibold",
                            unavailable
                              ? "border-[rgba(255,255,255,0.08)] bg-[rgba(255,255,255,0.04)] text-[#8D877F]"
                              : checked
                                ? "border-[rgba(75,156,211,0.42)] bg-[#4B9CD3] text-[#07131B]"
                                : "border-[rgba(255,255,255,0.12)] text-[#8D877F]"
                          )}
                        >
                          {checked || unavailable ? <Check size={11} /> : null}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </section>
            </div>

            {showsAgentRuntimeNote ? (
              <div className="rounded-2xl border border-[rgba(75,156,211,0.14)] bg-[rgba(75,156,211,0.06)] px-4 py-3">
                <p className="text-sm leading-6 text-[#B7D8E8]">
                  Agent-enabled threads stay live in Team Chat. If more than one agent is present, the first joined agent remains the active runtime and inspector target for now.
                </p>
              </div>
            ) : null}
          </div>

          <div className="border-t border-[rgba(255,255,255,0.06)] bg-[rgba(255,255,255,0.01)] px-6 py-4">
            {error ? <p className="mb-3 text-sm text-[#EF4444]">{error}</p> : null}
            <div className="flex gap-2">
              <Button type="button" variant="secondary" className="flex-1" onClick={onClose} disabled={loading}>
                Cancel
              </Button>
              <Button type="submit" variant="primary" className="flex-1" loading={loading}>
                {submitLabel}
              </Button>
            </div>
          </div>
        </form>
      </motion.div>
    </div>
  );
}
