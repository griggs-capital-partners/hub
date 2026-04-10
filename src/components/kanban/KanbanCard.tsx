"use client";

import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { AlertTriangle, ArrowUpRight, CheckCircle2, ExternalLink, FolderGit2, Loader2, MessageSquare, Settings2, Trash2, Zap } from "lucide-react";
import { PriorityBadge } from "@/components/ui/Badge";
import { Avatar } from "@/components/ui/Avatar";
import { Button } from "@/components/ui/Button";
import { CustomerPills, type KanbanCustomer } from "./KanbanCustomerField";
import { KanbanCardDrawer, type KanbanDrawerRepoOption } from "./KanbanCardDrawer";
import { KANBAN_TASK_STATE_META, isKanbanTaskState } from "./taskState";
import { ACTIVE_COLUMN, normalizeKanbanColumnName } from "@/lib/kanban-columns";
import { resolveAgentActionLabel } from "@/lib/agent-task-context";
import { ExecutionDetailDrawer, type ExecutionRecord } from "@/components/agents/AgentExecutionBoard";
import { parseKanbanSubtasks } from "@/lib/kanban-subtasks";

export interface KanbanCardNote {
  id: string;
  body: string;
  image?: string | null;
  createdAt: string | Date;
  author: { id: string; name: string | null; displayName?: string | null; image: string | null; email: string };
}

export interface KanbanCardSprintTask {
  id: string;
  sprintId: string;
  sprint: { id: string; name: string; status: string };
}

export interface KanbanCardSprint {
  id: string;
  name: string;
  status: string;
  startDate: string;
  endDate: string;
}

export interface KanbanCardData {
  id: string;
  title: string;
  body: string | null;
  subtasks: string;
  priority: string;
  state: string;
  labels: string;
  githubIssueId: number | null;
  githubIssueUrl: string | null;
  position: number;
  assignees: string;
  customers: KanbanCustomer[];
  notes: KanbanCardNote[];
  agentExecutions: {
    id: string;
    actionType: string;
    status: string;
    createdAt: string | Date;
    agent: {
      id: string;
      name: string;
      avatar: string | null;
      abilities: string | null;
    };
  }[];
  sprintTask: KanbanCardSprintTask | null;
  repoId?: string;
  repoName?: string;
  repoFullName?: string;
  repoIndex?: number;
  columnId?: string;
  columnName?: string;
  columnPosition?: number;
}

export interface KanbanCardUser {
  id: string;
  name: string | null;
  displayName: string | null;
  email: string;
  image: string | null;
}

interface TaskGroupRef {
  id: string;
  name: string;
  status: string;
  color: string | null;
  cardIds?: string[];
}

interface Props {
  card: KanbanCardData;
  sprints: KanbanCardSprint[];
  users: KanbanCardUser[];
  onDragStart: () => void;
  onDragEnd: () => void;
  onSprintChange: (cardId: string, sprintTask: KanbanCardSprintTask | null) => void;
  onDelete: (card: KanbanCardData) => Promise<boolean | void> | boolean | void;
  onUpdate: (cardId: string, updates: Partial<KanbanCardData>) => void;
  columnAccent: string;
  availableCustomers: KanbanCustomer[];
  repoName?: string;
  repoOptions?: KanbanDrawerRepoOption[];
  isSprintOnly?: boolean;
  draggable?: boolean;
  currentUserId?: string | null;
  compact?: boolean;
  footerAction?: React.ReactNode;
  linkedRepos?: { id: string; name: string; color: string }[];
  taskGroups?: TaskGroupRef[];
  onTaskGroupChange?: (cardId: string, taskGroupId: string | null) => void;
  variant?: "default" | "active";
}

function shouldShowPriority(priority: string) {
  return priority === "high" || priority === "critical";
}

function formatExecutionAge(value: string | Date) {
  const date = typeof value === "string" ? new Date(value) : value;
  const diff = Date.now() - date.getTime();
  const mins = Math.floor(diff / 60_000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days < 7) return `${days}d ago`;
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

const AGENT_PANEL_ACCENT = "#4B9CD3";

function isVisibleExecutionStatus(status: string) {
  return status !== "archived";
}

function isPollingExecutionStatus(status: string) {
  return status === "in-process";
}

export function KanbanCard({
  card,
  sprints,
  users,
  onDragStart,
  onDragEnd,
  onSprintChange,
  onDelete,
  onUpdate,
  columnAccent,
  availableCustomers,
  repoName,
  repoOptions = [],
  isSprintOnly = false,
  draggable = true,
  currentUserId = null,
  compact = false,
  footerAction,
  linkedRepos = [],
  taskGroups,
  onTaskGroupChange,
  variant = "default",
}: Props) {
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [selectedExecution, setSelectedExecution] = useState<ExecutionRecord | null>(null);
  const [executionLoadingId, setExecutionLoadingId] = useState<string | null>(null);
  const [liveExecutions, setLiveExecutions] = useState(() =>
    card.agentExecutions.filter((execution) => isVisibleExecutionStatus(execution.status))
  );
  const [shouldPollExecutions, setShouldPollExecutions] = useState(() =>
    card.agentExecutions.some((execution) => isPollingExecutionStatus(execution.status))
  );
  const cardRef = useRef<HTMLDivElement>(null);
  const labels = JSON.parse(card.labels) as string[];
  const assigneeIds = JSON.parse(card.assignees || "[]") as string[];
  const assignees = assigneeIds
    .map((assigneeId) => users.find((user) => user.id === assigneeId))
    .filter((user): user is KanbanCardUser => Boolean(user));
  const topChipColor = repoName || isSprintOnly ? columnAccent : null;
  const taskState = card.state && isKanbanTaskState(card.state) ? card.state : "normal";
  const taskStateMeta = KANBAN_TASK_STATE_META[taskState];
  const isActiveVariant = !compact && (
    variant === "active" ||
    normalizeKanbanColumnName(card.columnName ?? "") === ACTIVE_COLUMN
  );
  const executionCount = liveExecutions.length;
  const subtaskCount = parseKanbanSubtasks(card.subtasks).length;

  useEffect(() => {
    setLiveExecutions(card.agentExecutions.filter((execution) => isVisibleExecutionStatus(execution.status)));
    setShouldPollExecutions(card.agentExecutions.some((execution) => isPollingExecutionStatus(execution.status)));
  }, [card.agentExecutions]);

  useEffect(() => {
    function handleExecutionStarted(event: Event) {
      const customEvent = event as CustomEvent<{ cardId?: string }>;
      if (customEvent.detail?.cardId === card.id) {
        setShouldPollExecutions(true);
      }
    }

    window.addEventListener("kanban-agent-execution-started", handleExecutionStarted as EventListener);
    return () => window.removeEventListener("kanban-agent-execution-started", handleExecutionStarted as EventListener);
  }, [card.id]);

  useEffect(() => {
    if (!isActiveVariant || !currentUserId || !shouldPollExecutions) return;

    let cancelled = false;

    async function refreshExecutions() {
      const res = await fetch(`/api/agent-executions?kanbanCardId=${card.id}`, { cache: "no-store" });
      if (!res.ok || cancelled) {
        if (!cancelled) {
          setShouldPollExecutions(false);
        }
        return;
      }

      const executions = await res.json() as ExecutionRecord[];
      if (cancelled) return;

      const visibleExecutions = executions
        .filter((execution) => isVisibleExecutionStatus(execution.status))
        .slice(0, 4)
        .map((execution) => ({
          id: execution.id,
          actionType: execution.actionType,
          status: execution.status,
          createdAt: execution.createdAt,
          agent: {
            id: execution.agent.id,
            name: execution.agent.name,
            avatar: execution.agent.avatar,
            abilities: execution.agent.abilities ?? null,
          },
        }));

      setLiveExecutions(visibleExecutions);
      setShouldPollExecutions(executions.some((execution) => isPollingExecutionStatus(execution.status)));
      setSelectedExecution((current) => current ? (executions.find((execution) => execution.id === current.id) ?? current) : current);
    }

    void refreshExecutions();
    const timer = window.setInterval(() => {
      void refreshExecutions();
    }, 4_000);

    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, [card.id, currentUserId, isActiveVariant, shouldPollExecutions]);

  function handleDragStart(event: React.DragEvent<HTMLDivElement>) {
    event.dataTransfer.effectAllowed = "move";

    if (isActiveVariant) {
      const dragPreview = document.createElement("div");
      dragPreview.style.width = "320px";
      dragPreview.style.maxWidth = "320px";
      dragPreview.style.padding = "12px 14px";
      dragPreview.style.borderRadius = "16px";
      dragPreview.style.border = "1px solid rgba(255,255,255,0.08)";
      dragPreview.style.borderLeft = `3px solid ${columnAccent}`;
      dragPreview.style.background = "linear-gradient(180deg, rgba(31,31,31,0.98), rgba(19,19,19,0.99))";
      dragPreview.style.boxShadow = "0 14px 28px rgba(0,0,0,0.38)";
      dragPreview.style.color = "#F6F6F6";
      dragPreview.style.fontFamily = "inherit";
      dragPreview.style.pointerEvents = "none";
      dragPreview.style.position = "fixed";
      dragPreview.style.top = "-9999px";
      dragPreview.style.left = "-9999px";
      dragPreview.style.zIndex = "9999";
      dragPreview.innerHTML = `
        <div style="display:flex;align-items:center;justify-content:space-between;gap:10px;margin-bottom:10px;">
          <div style="display:flex;align-items:center;gap:8px;min-width:0;">
            <span style="display:inline-flex;max-width:120px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;border-radius:9999px;padding:4px 10px;font-size:10px;font-weight:600;color:${columnAccent};background:${columnAccent}18;">${repoName ?? card.repoName ?? "Task"}</span>
          </div>
          <span style="display:inline-flex;align-items:center;justify-content:center;border-radius:9999px;padding:4px 10px;font-size:10px;font-weight:700;color:${taskStateMeta.color};background:${taskStateMeta.background};border:1px solid ${taskStateMeta.border};">${taskStateMeta.shortLabel}</span>
        </div>
        <div style="font-size:15px;font-weight:700;line-height:1.3;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden;">${card.title.replace(/</g, "&lt;").replace(/>/g, "&gt;")}</div>
      `;
      document.body.appendChild(dragPreview);
      event.dataTransfer.setDragImage(dragPreview, 26, 20);
      requestAnimationFrame(() => {
        dragPreview.remove();
      });
    }

    onDragStart();
  }

  async function handleDeleteConfirm() {
    if (deleting) return;

    setDeleting(true);
    setDeleteError(null);

    try {
      const result = await onDelete(card);
      if (result === false) {
        setDeleteError("Could not delete this task. Please try again.");
        return;
      }

      setDeleteDialogOpen(false);
      setDrawerOpen(false);
    } catch {
      setDeleteError("Could not delete this task. Please try again.");
    } finally {
      setDeleting(false);
    }
  }

  async function handleOpenExecution(executionId: string) {
    if (executionLoadingId || !currentUserId) return;
    setExecutionLoadingId(executionId);

    try {
      const res = await fetch(`/api/agent-executions/${executionId}`, { cache: "no-store" });
      if (!res.ok) return;
      const execution = await res.json() as ExecutionRecord;
      setSelectedExecution(execution);
    } finally {
      setExecutionLoadingId(null);
    }
  }

  return (
    <>
      <motion.div
        ref={cardRef}
        layout
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95 }}
        draggable={draggable}
        onDragStartCapture={handleDragStart}
        onDragEnd={onDragEnd}
        onDoubleClick={() => setDrawerOpen(true)}
        className="group overflow-hidden rounded-xl border border-[rgba(255,255,255,0.06)] bg-[linear-gradient(180deg,rgba(31,31,31,0.94),rgba(19,19,19,0.98))] transition-all duration-200 hover:border-[rgba(255,255,255,0.12)] hover:shadow-[0_18px_32px_rgba(0,0,0,0.32)]"
        style={{
          borderLeftWidth: "3px",
          borderLeftColor: columnAccent,
          boxShadow: isActiveVariant
            ? `inset 0 1px 0 rgba(255,255,255,0.04), 0 18px 36px rgba(0,0,0,0.24), 0 0 0 1px ${columnAccent}12`
            : `inset 0 1px 0 rgba(255,255,255,0.03), 0 0 0 1px ${columnAccent}10`,
          zIndex: drawerOpen ? 50 : 1,
        }}
      >
        <div className="h-px w-full" style={{ background: `linear-gradient(90deg, ${columnAccent}60, transparent 70%)` }} />
        <div className={compact ? "px-2 py-1.5" : isActiveVariant ? "p-2.5" : "p-2"}>
          {isActiveVariant ? (
            <div className="space-y-2.5">
              <div className="grid items-start gap-2.5 xl:grid-cols-[minmax(0,1.45fr)_minmax(250px,0.95fr)]">
                <div className="min-w-0 space-y-2">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex min-w-0 flex-wrap items-center gap-1.5">
                      {topChipColor ? (
                        <span
                          className="inline-flex max-w-[170px] items-center gap-1 truncate rounded-full px-2 py-1 text-[10px] font-semibold"
                          style={{ color: topChipColor, backgroundColor: `${topChipColor}18` }}
                        >
                          {isSprintOnly ? <Zap size={10} /> : <FolderGit2 size={10} />}
                          {isSprintOnly ? "Sprint Task" : repoName}
                          {!isSprintOnly && linkedRepos.length > 0 && <span className="opacity-60">+{linkedRepos.length}</span>}
                        </span>
                      ) : null}
                      {shouldShowPriority(card.priority) ? <PriorityBadge priority={card.priority} compact /> : null}
                    </div>
                  </div>

                  <div className="space-y-1">
                    <h4 className="line-clamp-2 text-[15px] font-semibold leading-[1.3] text-[#F6F6F6]">{card.title}</h4>
                    {card.body ? (
                      <p className="line-clamp-2 text-[12px] leading-[1.45] text-[#A2A2A2]">
                        {card.body}
                      </p>
                    ) : null}
                  </div>

                  {card.customers.length > 0 ? (
                    <div className="overflow-hidden">
                      <CustomerPills customers={card.customers} compact />
                    </div>
                  ) : null}

                  {labels.length > 0 ? (
                    <div className="flex flex-wrap gap-1">
                      {labels.slice(0, 4).map((label) => (
                        <span
                          key={label}
                          className="rounded-md bg-[rgba(255,255,255,0.05)] px-2 py-1 text-[10px] text-[#A7A7A7]"
                        >
                          {label}
                        </span>
                      ))}
                      {labels.length > 4 ? <span className="px-1 text-[10px] text-[#606060]">+{labels.length - 4}</span> : null}
                    </div>
                  ) : null}

                </div>

                <div className="flex min-w-0 flex-col gap-2 rounded-2xl border border-[rgba(255,255,255,0.07)] bg-[linear-gradient(180deg,rgba(255,255,255,0.04),rgba(255,255,255,0.02))] p-2.5">
                  <div className="flex items-center justify-between gap-2">
                    <div className="min-w-0 space-y-1">
                      <div className="text-[10px] font-semibold uppercase tracking-[0.18em] text-[#7C7C7C]">
                        Task State
                      </div>
                      <div
                        className="inline-flex items-center gap-2 rounded-full border px-2.5 py-1 text-[11px] font-semibold shadow-[inset_0_1px_0_rgba(255,255,255,0.06)]"
                        style={{
                          color: taskStateMeta.color,
                          backgroundColor: taskStateMeta.background,
                          borderColor: taskStateMeta.border,
                        }}
                        title={taskStateMeta.label}
                      >
                        <span
                          className="h-1.5 w-1.5 rounded-full shadow-[0_0_10px_currentColor]"
                          style={{ backgroundColor: taskStateMeta.color }}
                        />
                        {taskStateMeta.label}
                      </div>
                    </div>

                    <button
                      onClick={() => setDrawerOpen(true)}
                      className="inline-flex items-center gap-1.5 rounded-full border border-[rgba(247,148,29,0.18)] bg-[linear-gradient(180deg,rgba(247,148,29,0.16),rgba(247,148,29,0.08))] px-3 py-1.5 text-[10px] font-semibold uppercase tracking-[0.16em] text-[#F6B15A] transition-all hover:border-[rgba(247,148,29,0.3)] hover:bg-[linear-gradient(180deg,rgba(247,148,29,0.22),rgba(247,148,29,0.12))] hover:text-[#FFD093]"
                    >
                      Details
                      <ArrowUpRight size={12} />
                    </button>
                  </div>

                  <div className="grid items-start gap-2 lg:grid-cols-[auto_minmax(0,1fr)]">
                    <div className="min-w-0">
                      {assignees.length > 0 ? (
                        <div className="flex items-center">
                          <div className="flex items-center">
                            {assignees.slice(0, 4).map((assignee, index) => (
                              <div key={assignee.id} className={index === 0 ? "" : "-ml-2"}>
                                <Avatar
                                  src={assignee.image}
                                  name={assignee.displayName ?? assignee.name}
                                  size="xs"
                                  className="!h-7 !w-7 text-[9px] ring-2 ring-[rgba(17,17,17,0.92)]"
                                />
                              </div>
                            ))}
                            {assignees.length > 4 ? (
                              <span className="-ml-1 inline-flex h-7 min-w-[28px] items-center justify-center rounded-full border border-[rgba(255,255,255,0.08)] bg-[rgba(255,255,255,0.05)] px-1 text-[10px] text-[#A0A0A0]">
                                +{assignees.length - 4}
                              </span>
                            ) : null}
                          </div>
                        </div>
                      ) : (
                        <div className="inline-flex h-7 items-center rounded-full border border-dashed border-[rgba(255,255,255,0.12)] px-3 text-[11px] text-[#666666]">
                          No assignee
                        </div>
                      )}
                    </div>

                    <div className="grid gap-1 text-[10px] text-[#909090]">
                      {linkedRepos.length > 0 ? (
                        <div className="px-0.5 py-0.5">
                          <div className="mb-1 text-[9px] font-semibold uppercase tracking-[0.16em] text-[#6F6F6F]">Repos</div>
                          <div className="flex items-center gap-1" title={linkedRepos.map((r) => r.name).join(", ")}>
                            <div className="flex items-center gap-0.5">
                              {linkedRepos.slice(0, 4).map((repo) => (
                                <div key={repo.id} className="h-2 w-2 rounded-full" style={{ backgroundColor: repo.color }} />
                              ))}
                            </div>
                            <span>{linkedRepos.length} linked</span>
                          </div>
                        </div>
                      ) : null}

                      <div className="flex flex-wrap items-center gap-3">
                        <div className="inline-flex items-center gap-1.5 rounded-full bg-[rgba(255,255,255,0.04)] px-2.5 py-1 text-[10px] text-[#C8C8C8] shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]">
                          <MessageSquare size={10} className="text-[#8A8A8A]" />
                          <span className="font-medium">{card.notes.length}</span>
                          <span className="text-[#7A7A7A]">notes</span>
                        </div>
                        <div className="inline-flex items-center gap-1.5 rounded-full bg-[rgba(255,255,255,0.04)] px-2.5 py-1 text-[10px] text-[#C8C8C8] shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]">
                          <span className="font-medium">{subtaskCount}</span>
                          <span className="text-[#7A7A7A]">subtasks</span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              <div
                className="relative -mx-2.5 -mb-2.5 overflow-hidden rounded-b-[18px] border-t px-0 pt-1 pb-0 shadow-[inset_0_1px_0_rgba(255,255,255,0.02)]"
                style={{
                  borderTopColor: "rgba(75,156,211,0.18)",
                  background: "linear-gradient(180deg, rgba(75,156,211,0.10) 0%, rgba(75,156,211,0.05) 22%, rgba(255,255,255,0.012) 72%, rgba(255,255,255,0.008) 100%)",
                }}
              >
                <div
                  className="pointer-events-none absolute inset-x-0 top-0 h-px"
                  style={{ background: `linear-gradient(90deg, transparent, ${AGENT_PANEL_ACCENT}88, transparent)` }}
                />
                <div
                  className="pointer-events-none absolute left-6 top-0 h-8 w-32 blur-2xl"
                  style={{ background: `${AGENT_PANEL_ACCENT}22` }}
                />
                {executionCount > 0 ? (
                  <div className="flex flex-wrap items-center gap-1.5 px-2.5 pb-1.5">
                    <span
                      className="rounded-full border px-1.5 py-0.5 text-[9px] font-semibold shadow-[inset_0_1px_0_rgba(255,255,255,0.05)]"
                      style={{
                        color: "#9DD6F5",
                        backgroundColor: "rgba(75,156,211,0.14)",
                        borderColor: "rgba(75,156,211,0.18)",
                      }}
                    >
                      {executionCount}
                    </span>
                    {liveExecutions.slice(0, 4).map((execution) => {
                      const isInProcess = execution.status === "in-process";
                      const isCompleted = execution.status === "completed";
                      const statusColor = execution.status === "completed"
                        ? "#22C55E"
                        : execution.status === "failed"
                          ? "#EF4444"
                          : execution.status === "needs-input"
                            ? "#FBBA00"
                            : "#4B9CD3";
                      const isLoading = executionLoadingId === execution.id;
                        return (
                          <button
                            key={execution.id}
                            type="button"
                            onClick={() => void handleOpenExecution(execution.id)}
                            disabled={isLoading}
                            className="inline-flex min-w-0 max-w-[180px] items-center gap-2 rounded-full border px-1.5 py-[3px] text-left transition-all disabled:opacity-60"
                            style={{
                              borderColor: "rgba(75,156,211,0.12)",
                              background: "linear-gradient(180deg, rgba(75,156,211,0.075), rgba(255,255,255,0.025))",
                            boxShadow: "inset 0 1px 0 rgba(255,255,255,0.04)",
                          }}
                        >
                          <div className="relative flex-shrink-0">
                            <div
                              className="overflow-hidden rounded-full ring-2"
                              style={{ boxShadow: "0 0 0 2px rgba(10,14,18,0.92), 0 0 0 4px rgba(75,156,211,0.10)" }}
                            >
                              <Avatar
                                src={execution.agent.avatar}
                                name={execution.agent.name}
                                size="xs"
                                className="!h-6 !w-6 text-[8px]"
                              />
                            </div>
                            {isInProcess ? (
                              <span
                                className="absolute -bottom-1 -right-1 flex h-3.5 w-3.5 items-center justify-center rounded-full border border-[rgba(17,17,17,0.95)] bg-[rgba(75,156,211,0.18)]"
                              >
                                <Loader2 size={8} className="animate-spin" style={{ color: statusColor }} />
                              </span>
                            ) : isCompleted ? (
                              <span
                                className="absolute -bottom-1 -right-1 flex h-3.5 w-3.5 items-center justify-center rounded-full border border-[rgba(17,17,17,0.95)] bg-[rgba(34,197,94,0.18)]"
                              >
                                <CheckCircle2 size={8} style={{ color: statusColor }} />
                              </span>
                            ) : (
                              <span
                                className="absolute -bottom-0.5 -right-0.5 h-2 w-2 rounded-full border border-[rgba(17,17,17,0.95)]"
                                style={{ backgroundColor: statusColor }}
                              />
                            )}
                          </div>
                          <div className="min-w-0">
                            <div className="truncate text-[9px] font-medium text-[#D9EAF4]">
                              {resolveAgentActionLabel(execution.actionType, execution.agent.abilities)}
                            </div>
                            <div
                              className="truncate text-[9px]"
                              style={{ color: isInProcess ? "#9DD6F5" : isCompleted ? "#8BD9A3" : "#7EA9C3" }}
                            >
                              {isInProcess ? "Running now" : isCompleted ? `Done ${formatExecutionAge(execution.createdAt)}` : formatExecutionAge(execution.createdAt)}
                            </div>
                          </div>
                          {isLoading ? <Loader2 size={10} className="animate-spin" style={{ color: "#8CC9EB" }} /> : null}
                        </button>
                      );
                    })}
                  </div>
                ) : (
                  <div
                    className="mx-2.5 mb-1.5 rounded-xl border border-dashed px-2.5 py-1 text-[10px]"
                    style={{
                      color: "#6F8FA3",
                      borderColor: "rgba(75,156,211,0.16)",
                      backgroundColor: "rgba(75,156,211,0.06)",
                    }}
                  >
                    No agent runs yet.
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div className={compact ? "grid h-[42px] grid-rows-[18px_minmax(0,1fr)] gap-0.5" : "grid h-[140px] grid-rows-[22px_minmax(0,1fr)_26px_18px_20px] gap-1"}>
              <div className="flex items-start justify-between gap-2">
                <div className="flex min-w-0 flex-wrap items-center gap-1.5">
                  {topChipColor ? (
                    <span
                      className={`${compact ? "max-w-[110px] px-1.5 py-0 text-[9px]" : "max-w-[120px] px-1.5 py-0.5 text-[10px]"} inline-flex items-center gap-1 truncate rounded-full font-semibold`}
                      style={{ color: topChipColor, backgroundColor: `${topChipColor}18` }}
                    >
                      {isSprintOnly ? <Zap size={8} /> : <FolderGit2 size={8} />}
                      {isSprintOnly ? "Sprint Task" : repoName}
                      {!isSprintOnly && linkedRepos.length > 0 && (
                        <span className="opacity-60">+{linkedRepos.length}</span>
                      )}
                    </span>
                  ) : null}
                  {taskState !== "normal" ? (
                    <span
                      className={`${compact ? "max-w-[120px] px-1.5 py-0 text-[9px]" : "max-w-[150px] px-1.5 py-0.5 text-[10px]"} inline-flex items-center truncate rounded-full border font-semibold`}
                      style={{
                        color: taskStateMeta.color,
                        backgroundColor: taskStateMeta.background,
                        borderColor: taskStateMeta.border,
                      }}
                      title={taskStateMeta.label}
                    >
                      {compact ? taskStateMeta.shortLabel : taskStateMeta.label}
                    </span>
                  ) : null}
                </div>

                <button
                  onClick={() => setDrawerOpen(true)}
                  className={`${compact ? "h-4.5 w-4.5 rounded" : "h-5 w-5 rounded-md"} flex items-center justify-center border border-[rgba(255,255,255,0.08)] bg-[rgba(255,255,255,0.03)] text-[#707070] transition-all hover:border-[rgba(247,148,29,0.18)] hover:text-[#F7941D]`}
                >
                  <Settings2 size={compact ? 10 : 11} />
                </button>
              </div>

              <div className="min-h-0 overflow-hidden">
                <h4 className={`${compact ? "line-clamp-1 text-[11px] leading-tight" : "line-clamp-2 text-xs leading-snug"} font-semibold text-[#F0F0F0]`}>{card.title}</h4>
                {!compact && card.body ? (
                  <p className={`mt-0.5 ${compact ? "line-clamp-1" : "line-clamp-1"} text-[11px] leading-snug text-[#9F9F9F]`}>
                    {card.body}
                  </p>
                ) : null}
              </div>

              {!compact ? (
                <div className="overflow-hidden">
                  {card.customers.length > 0 ? <CustomerPills customers={card.customers} compact /> : null}
                </div>
              ) : null}

              {!compact ? (
                <div className="overflow-hidden">
                  {labels.length > 0 ? (
                    <div className="flex flex-wrap gap-1">
                      {labels.slice(0, 2).map((label) => (
                        <span
                          key={label}
                          className="rounded bg-[rgba(255,255,255,0.05)] px-1.5 py-0.5 text-[10px] text-[#9A9A9A]"
                        >
                          {label}
                        </span>
                      ))}
                      {labels.length > 2 ? (
                        <span className="text-[10px] text-[#606060]">
                          +{labels.length - 2}
                        </span>
                      ) : null}
                    </div>
                  ) : null}
                </div>
              ) : null}

              <div className={`${compact ? "hidden" : "flex h-5 items-center justify-between"}`}>
                {shouldShowPriority(card.priority) ? <PriorityBadge priority={card.priority} compact /> : <span />}

                <div className="flex items-center gap-2">
                  {linkedRepos.length > 0 && (
                    <div className="flex items-center gap-0.5" title={linkedRepos.map((r) => r.name).join(", ")}>
                      {linkedRepos.slice(0, 4).map((repo) => (
                        <div
                          key={repo.id}
                          className="h-2 w-2 rounded-full flex-shrink-0"
                          style={{ backgroundColor: repo.color }}
                        />
                      ))}
                      {linkedRepos.length > 4 && (
                        <span className="text-[9px] text-[#606060]">+{linkedRepos.length - 4}</span>
                      )}
                    </div>
                  )}
                  {card.notes.length > 0 && (
                    <span className="flex items-center gap-0.5 text-[10px] text-[#606060]">
                      <MessageSquare size={10} />
                      {card.notes.length}
                    </span>
                  )}
                  {card.githubIssueUrl && (
                    <a
                      href={card.githubIssueUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      onClick={(event) => event.stopPropagation()}
                      className="text-[#606060] transition-colors hover:text-[#F7941D]"
                      title={`GitHub #${card.githubIssueId}`}
                    >
                      <ExternalLink size={10} />
                    </a>
                  )}
                  {!compact ? (
                    assignees.length > 0 ? (
                      <div className="flex items-center">
                        {assignees.slice(0, 3).map((assignee, index) => (
                          <div
                            key={assignee.id}
                            className={index === 0 ? "" : "-ml-1.5"}
                          >
                            <Avatar
                              src={assignee.image}
                              name={assignee.displayName ?? assignee.name}
                              size="xs"
                              className="!h-5 !w-5 text-[8px] ring-1 ring-[rgba(17,17,17,0.9)]"
                            />
                          </div>
                        ))}
                        {assignees.length > 3 ? (
                          <span className="-ml-1 inline-flex h-5 min-w-[20px] items-center justify-center rounded-full border border-[rgba(255,255,255,0.08)] bg-[rgba(255,255,255,0.05)] px-1 text-[9px] text-[#A0A0A0]">
                            +{assignees.length - 3}
                          </span>
                        ) : null}
                      </div>
                    ) : (
                      <div className="h-5 w-5 rounded-full border border-dashed border-[rgba(255,255,255,0.12)]" />
                    )
                  ) : null}
                </div>
              </div>
            </div>
          )}
        </div>
        {footerAction ? (
          <>
            <div className="mx-2 h-px" style={{ background: `linear-gradient(90deg, ${columnAccent}30, transparent 80%)` }} />
            <div className="px-2 py-1.5">
              {footerAction}
            </div>
          </>
        ) : null}
      </motion.div>

      <KanbanCardDrawer
        key={`${card.id}-${drawerOpen ? "open" : "closed"}`}
        open={drawerOpen}
        card={card}
        users={users}
        sprints={sprints}
        customers={availableCustomers}
        initialRepoId={card.repoId ?? null}
        initialColumnId={card.columnId ?? null}
        repoOptions={repoOptions}
        currentUserId={currentUserId}
        taskGroups={taskGroups}
        onClose={() => setDrawerOpen(false)}
        onSaved={onUpdate}
        onDelete={() => {
          setDeleteError(null);
          setDeleteDialogOpen(true);
        }}
        onSprintChange={onSprintChange}
        onTaskGroupChange={onTaskGroupChange}
      />

      {selectedExecution ? (
        <ExecutionDetailDrawer
          execution={selectedExecution}
          onClose={() => setSelectedExecution(null)}
          onStatusChange={(executionId, status) => {
            setSelectedExecution((current) => current ? { ...current, status } : current);
            setLiveExecutions((current) =>
              current
                .map((execution) => execution.id === executionId ? { ...execution, status } : execution)
                .filter((execution) => isVisibleExecutionStatus(execution.status))
            );
          }}
          onDelete={(executionId) => {
            setSelectedExecution(null);
            setLiveExecutions((current) => current.filter((execution) => execution.id !== executionId));
          }}
        />
      ) : null}

      <AnimatePresence>
        {deleteDialogOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[80] flex items-center justify-center bg-[rgba(6,6,6,0.72)] px-4 backdrop-blur-md"
            onClick={() => !deleting && setDeleteDialogOpen(false)}
          >
            <motion.div
              initial={{ opacity: 0, y: 18, scale: 0.97 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 10, scale: 0.97 }}
              onClick={(event) => event.stopPropagation()}
              className="relative w-full max-w-md overflow-hidden rounded-[28px] border border-[rgba(248,113,113,0.22)] bg-[linear-gradient(180deg,rgba(32,16,16,0.98),rgba(15,11,11,0.99))] shadow-[0_28px_80px_rgba(0,0,0,0.52)]"
            >
              <div className="pointer-events-none absolute inset-0">
                <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-[rgba(248,113,113,0.7)] to-transparent" />
                <div className="absolute -right-10 top-0 h-36 w-36 rounded-full bg-[rgba(239,68,68,0.16)] blur-3xl" />
                <div className="absolute -left-8 bottom-0 h-28 w-28 rounded-full bg-[rgba(247,148,29,0.12)] blur-3xl" />
              </div>

              <div className="relative p-6">
                <div className="flex items-start gap-4">
                  <div className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-2xl border border-[rgba(248,113,113,0.24)] bg-[rgba(239,68,68,0.12)] text-[#F87171]">
                    <AlertTriangle size={22} />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="text-[11px] font-semibold uppercase tracking-[0.24em] text-[#F3A6A6]">
                      Delete Task
                    </div>
                    <h3 className="mt-2 text-lg font-semibold leading-tight text-[#FFF2F2]">
                      Remove &ldquo;{card.title}&rdquo;?
                    </h3>
                    <p className="mt-2 text-sm leading-6 text-[#D0B7B7]">
                      This will permanently delete the card and its notes. The task will disappear from the board right away.
                    </p>
                  </div>
                </div>

                <div className="mt-5 rounded-2xl border border-[rgba(255,255,255,0.06)] bg-[rgba(255,255,255,0.03)] p-4">
                  <div className="flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <div className="truncate text-sm font-medium text-[#F4EDED]">{card.title}</div>
                      <div className="mt-1 text-xs text-[#9F8D8D]">
                        {isSprintOnly ? "Sprint task" : repoName ?? card.repoName ?? "Kanban card"}
                      </div>
                    </div>
                    <span
                      className="rounded-full px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.16em]"
                      style={{ color: columnAccent, backgroundColor: `${columnAccent}22` }}
                    >
                      {card.priority}
                    </span>
                  </div>
                </div>

                {deleteError ? (
                  <div className="mt-4 rounded-2xl border border-[rgba(248,113,113,0.24)] bg-[rgba(239,68,68,0.08)] px-3 py-2 text-sm text-[#F6B2B2]">
                    {deleteError}
                  </div>
                ) : null}

                <div className="mt-6 flex items-center justify-end gap-3">
                  <Button variant="secondary" size="sm" disabled={deleting} onClick={() => setDeleteDialogOpen(false)}>
                    Keep Task
                  </Button>
                  <Button
                    variant="danger"
                    size="sm"
                    loading={deleting}
                    icon={<Trash2 size={13} />}
                    onClick={() => void handleDeleteConfirm()}
                    className="min-w-[122px]"
                  >
                    Delete Task
                  </Button>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
