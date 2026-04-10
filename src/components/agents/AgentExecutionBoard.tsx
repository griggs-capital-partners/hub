"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { motion, AnimatePresence } from "framer-motion";
import {
  AlertCircle,
  AlertTriangle,
  Archive,
  Bot,
  Brain,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Clock,
  Copy,
  Loader2,
  MessageSquareWarning,
  RefreshCw,
  RotateCcw,
  Trash2,
  ExternalLink,
  X,
  XCircle,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { resolveAgentActionDescription, resolveAgentActionLabel } from "@/lib/agent-task-context";
import { kickoffExecutionProcessing, shouldRecoverExecution } from "@/lib/agent-execution-client";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

const executionMarkdownComponents = {
  p: ({ children }: { children?: React.ReactNode }) => <p className="mb-2.5 last:mb-0 text-sm leading-[1.7] text-[#C8C8C8]">{children}</p>,
  strong: ({ children }: { children?: React.ReactNode }) => <strong className="font-semibold text-[#F0F0F0]">{children}</strong>,
  em: ({ children }: { children?: React.ReactNode }) => <em className="italic text-[#DEDEDE]">{children}</em>,
  h1: ({ children }: { children?: React.ReactNode }) => <p className="mb-2 mt-5 first:mt-0 text-base font-bold text-[#F0F0F0]">{children}</p>,
  h2: ({ children }: { children?: React.ReactNode }) => <p className="mb-2 mt-4 first:mt-0 text-[15px] font-bold text-[#EBEBEB]">{children}</p>,
  h3: ({ children }: { children?: React.ReactNode }) => <p className="mb-1.5 mt-3 first:mt-0 text-sm font-semibold text-[#DEDEDE]">{children}</p>,
  h4: ({ children }: { children?: React.ReactNode }) => <p className="mb-1 mt-2.5 first:mt-0 text-sm font-semibold text-[#D0D0D0]">{children}</p>,
  ul: ({ children }: { children?: React.ReactNode }) => <ul className="mb-3 space-y-1.5 pl-4">{children}</ul>,
  ol: ({ children }: { children?: React.ReactNode }) => <ol className="mb-3 space-y-1.5 pl-4 list-decimal marker:text-[#606060]">{children}</ol>,
  li: ({ children }: { children?: React.ReactNode }) => (
    <li className="text-sm leading-[1.65] flex gap-2.5">
      <span className="mt-[8px] w-1.5 h-1.5 rounded-full bg-[#F7941D]/50 flex-shrink-0" />
      <span className="flex-1 text-[#C4C4C4]">{children}</span>
    </li>
  ),
  code: ({ className, children }: { className?: string; children?: React.ReactNode }) => {
    const isBlock = /language-/.test(className ?? "");
    return isBlock ? (
      <pre className="my-3 overflow-x-auto rounded-xl bg-[#0A0A0B] px-4 py-3.5 text-xs font-mono text-[#A8E6CF] leading-relaxed whitespace-pre border border-[rgba(255,255,255,0.07)]">
        <code>{children}</code>
      </pre>
    ) : (
      <code className="px-1.5 py-0.5 rounded-md bg-[rgba(255,255,255,0.07)] text-[#FBCB3A] text-xs font-mono border border-[rgba(255,255,255,0.1)]">{children}</code>
    );
  },
  pre: ({ children }: { children?: React.ReactNode }) => <>{children}</>,
  blockquote: ({ children }: { children?: React.ReactNode }) => (
    <blockquote className="my-3 pl-4 border-l-2 border-[#F7941D]/40 text-[#AAAAAA] italic text-sm leading-[1.65]">{children}</blockquote>
  ),
  hr: () => <hr className="my-5 border-[rgba(255,255,255,0.08)]" />,
  a: ({ href, children }: { href?: string; children?: React.ReactNode }) => (
    <a href={href} target="_blank" rel="noopener noreferrer" className="text-[#F7941D] underline underline-offset-2 hover:text-[#FBCB3A]">{children}</a>
  ),
  table: ({ children }: { children?: React.ReactNode }) => (
    <div className="my-3 overflow-x-auto rounded-xl border border-[rgba(255,255,255,0.07)]">
      <table className="w-full text-sm text-[#C4C4C4]">{children}</table>
    </div>
  ),
  thead: ({ children }: { children?: React.ReactNode }) => <thead className="bg-[rgba(255,255,255,0.04)] text-[#E0E0E0]">{children}</thead>,
  th: ({ children }: { children?: React.ReactNode }) => <th className="px-4 py-2.5 text-left text-xs font-semibold border-b border-[rgba(255,255,255,0.08)]">{children}</th>,
  td: ({ children }: { children?: React.ReactNode }) => <td className="px-4 py-2 text-sm border-b border-[rgba(255,255,255,0.05)] last:border-0">{children}</td>,
};

export type ExecutionRecord = {
  id: string;
  kanbanCardId: string;
  agentId: string;
  actionType: string;
  status: string;
  response: string | null;
  errorMessage: string | null;
  modelUsed: string | null;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
  agent: { id: string; name: string; role: string; avatar: string | null; abilities?: string | null };
  kanbanCard: {
    id: string;
    title: string;
    priority: string;
    body: string | null;
    state: string;
    labels: string;
    githubIssueUrl: string | null;
    column?: { name: string } | null;
  };
  triggeredBy: { displayName: string | null; name: string | null; image: string | null } | null;
};

type Column = {
  id: string;
  label: string;
  icon: React.ElementType;
  color: string;
  bg: string;
  border: string;
};

const COLUMNS: Column[] = [
  { id: "in-process",  label: "In Process",        icon: Loader2,              color: "#4B9CD3", bg: "rgba(75,156,211,0.08)",  border: "rgba(75,156,211,0.2)"  },
  { id: "needs-input", label: "Needs Team Input",   icon: MessageSquareWarning, color: "#FBBA00", bg: "rgba(251,186,0,0.08)",   border: "rgba(251,186,0,0.2)"   },
  { id: "completed",   label: "Completed",           icon: CheckCircle2,         color: "#22C55E", bg: "rgba(34,197,94,0.08)",   border: "rgba(34,197,94,0.2)"   },
  { id: "failed",      label: "Failed",              icon: XCircle,              color: "#EF4444", bg: "rgba(239,68,68,0.08)",   border: "rgba(239,68,68,0.2)"   },
];

const PRIORITY_COLORS: Record<string, string> = {
  critical: "#EF4444",
  high:     "#F97316",
  medium:   "#FBBA00",
  low:      "#6F6A64",
};

const PRIORITY_LABELS: Record<string, string> = {
  critical: "Critical",
  high:     "High",
  medium:   "Medium",
  low:      "Low",
};

function formatRelative(value: string) {
  const date = new Date(value);
  const diff = Date.now() - date.getTime();
  const mins = Math.floor(diff / 60_000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

function formatDateTime(value: string) {
  return new Date(value).toLocaleDateString("en-US", {
    month: "short", day: "numeric", year: "numeric",
    hour: "numeric", minute: "2-digit",
  });
}

function formatDuration(createdAt: string, updatedAt: string, status: string): string | null {
  if (status === "in-process" || status === "needs-input") return null;
  const ms = new Date(updatedAt).getTime() - new Date(createdAt).getTime();
  if (ms <= 0) return null;
  const secs = Math.round(ms / 1000);
  if (secs < 60) return `${secs}s`;
  const mins = Math.floor(secs / 60);
  const remSecs = secs % 60;
  if (mins < 60) return remSecs > 0 ? `${mins}m ${remSecs}s` : `${mins}m`;
  const hrs = Math.floor(mins / 60);
  const remMins = mins % 60;
  return remMins > 0 ? `${hrs}h ${remMins}m` : `${hrs}h`;
}

function parseLabels(raw: string): string[] {
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter((value): value is string => typeof value === "string" && value.trim().length > 0) : [];
  } catch {
    return [];
  }
}

function AgentAvatarSmall({ agent }: { agent: ExecutionRecord["agent"] }) {
  return (
    <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full border-2 border-[#111] bg-[rgba(75,156,211,0.15)] text-[#7EC8E3] overflow-hidden">
      {agent.avatar
        ? (agent.avatar.startsWith("data:") || agent.avatar.startsWith("https://"))
          ? <img src={agent.avatar} alt={agent.name} className="h-full w-full object-cover" />
          : <span className="text-base">{agent.avatar}</span>
        : <Bot size={16} />}
    </div>
  );
}

// ── Execution Detail Drawer ───────────────────────────────────────────────────

export function ExecutionDetailDrawer({
  execution,
  onClose,
  onStatusChange,
  onDelete,
  onRetry,
}: {
  execution: ExecutionRecord;
  onClose: () => void;
  onStatusChange: (id: string, status: string) => void;
  onDelete: (id: string) => void;
  onRetry?: (exec: ExecutionRecord) => Promise<void>;
}) {
  const [deleting, setDeleting] = useState(false);
  const [archiving, setArchiving] = useState(false);
  const [changingStatus, setChangingStatus] = useState(false);
  const [copied, setCopied] = useState(false);
  const [retrying, setRetrying] = useState(false);

  // Lazy-load full execution (response + kanbanCard.body) when stripped from initial RSC payload
  const [fullExecution, setFullExecution] = useState<ExecutionRecord>(execution);
  const [loadingFull, setLoadingFull] = useState(execution.response === null && execution.status !== "in-process");

  useEffect(() => {
    setFullExecution(execution);
    if (execution.response !== null || execution.status === "in-process") {
      setLoadingFull(false);
      return;
    }
    let cancelled = false;
    setLoadingFull(true);
    fetch(`/api/agent-executions/${execution.id}`)
      .then((r) => r.json())
      .then((data: ExecutionRecord) => { if (!cancelled) setFullExecution(data); })
      .catch(() => { /* keep showing stripped data */ })
      .finally(() => { if (!cancelled) setLoadingFull(false); });
    return () => { cancelled = true; };
  }, [execution.id, execution.response, execution.status]);

  const col = COLUMNS.find((c) => c.id === execution.status);
  const priorityColor = PRIORITY_COLORS[execution.kanbanCard.priority] ?? PRIORITY_COLORS.medium;
  const priorityLabel = PRIORITY_LABELS[execution.kanbanCard.priority] ?? execution.kanbanCard.priority;
  const actionLabel = resolveAgentActionLabel(execution.actionType, execution.agent.abilities);
  const actionDesc = resolveAgentActionDescription(execution.actionType, execution.agent.abilities);
  const labels = parseLabels(execution.kanbanCard.labels);
  const columnName = execution.kanbanCard.column?.name ?? "Task Card";
  const canArchive = execution.status === "completed" || execution.status === "failed";
  const StatusIcon = col?.icon ?? AlertCircle;

  async function handleStatusChange(newStatus: string) {
    setChangingStatus(true);
    try {
      await fetch(`/api/agent-executions/${execution.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: newStatus }),
      });
      onStatusChange(execution.id, newStatus);
    } finally {
      setChangingStatus(false);
    }
  }

  async function handleArchive() {
    setArchiving(true);
    try {
      await fetch(`/api/agent-executions/${execution.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "archived" }),
      });
      onStatusChange(execution.id, "archived");
      onClose();
    } finally {
      setArchiving(false);
    }
  }

  async function handleDelete() {
    if (!confirm("Permanently delete this execution record? This cannot be undone.")) return;
    setDeleting(true);
    try {
      await fetch(`/api/agent-executions/${execution.id}`, { method: "DELETE" });
      onDelete(execution.id);
      onClose();
    } finally {
      setDeleting(false);
    }
  }

  async function copyResponse() {
    await navigator.clipboard.writeText(fullExecution.response ?? "");
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  const panel = (
    <>
      {/* Backdrop */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.2 }}
        onClick={onClose}
        className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm"
      />

      {/* Drawer */}
      <motion.aside
        initial={{ x: "100%" }}
        animate={{ x: 0 }}
        exit={{ x: "100%" }}
        transition={{ type: "spring", stiffness: 340, damping: 34 }}
        className="fixed right-0 top-0 z-50 flex h-full w-full max-w-[46rem] flex-col border-l border-[rgba(255,255,255,0.08)] bg-[#0D0D0D] shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* ── Header ── */}
        <div className="flex flex-shrink-0 items-center justify-between border-b border-[rgba(255,255,255,0.07)] px-6 py-4">
          <div className="flex items-center gap-3">
            <span
              className="inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs font-semibold"
              style={{ color: col?.color ?? "#909090", backgroundColor: col?.bg ?? "transparent", borderColor: col?.border ?? "rgba(255,255,255,0.1)" }}
            >
              <StatusIcon
                size={12}
                className={execution.status === "in-process" ? "animate-spin" : ""}
              />
              {col?.label ?? execution.status}
            </span>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="flex h-8 w-8 items-center justify-center rounded-xl text-[#606060] transition-colors hover:bg-[rgba(255,255,255,0.07)] hover:text-[#F0F0F0]"
          >
            <X size={16} />
          </button>
        </div>

        {/* ── Scrollable body ── */}
        <div className="flex-1 overflow-y-auto">
          <div className="space-y-4 px-6 py-4">

            {/* Condensed execution summary */}
            <div className="rounded-2xl border border-[rgba(255,255,255,0.08)] bg-[linear-gradient(180deg,rgba(22,22,22,0.98),rgba(14,14,14,0.98))] p-4">
              <div className="flex items-start gap-3">
                <AgentAvatarSmall agent={execution.agent} />
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="truncate text-sm font-bold text-[#F2F2F2]">{execution.agent.name}</p>
                    <span className="rounded-full border border-[rgba(75,156,211,0.22)] bg-[rgba(75,156,211,0.08)] px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.12em] text-[#7EC8E3]">
                      {actionLabel}
                    </span>
                    <span
                      className="rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.12em]"
                      style={{ color: priorityColor, backgroundColor: `${priorityColor}18` }}
                    >
                      {priorityLabel}
                    </span>
                  </div>
                  <p className="mt-0.5 truncate text-[11px] text-[#607080]">{execution.agent.role}</p>
                  <div className="mt-2 flex items-start gap-2">
                    <span className="mt-1 h-1.5 w-1.5 flex-shrink-0 rounded-full" style={{ backgroundColor: priorityColor }} />
                    <p className="text-sm leading-snug text-[#E4E4E4]">{execution.kanbanCard.title}</p>
                  </div>
                  {actionDesc && <p className="mt-2 text-xs leading-5 text-[#6D6D6D]">{actionDesc}</p>}
                </div>
              </div>

              <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-3">
                {execution.modelUsed && (
                  <div className="rounded-xl border border-[rgba(255,255,255,0.06)] bg-[rgba(255,255,255,0.02)] px-3 py-2">
                    <p className="mb-1 flex items-center gap-1 text-[10px] font-semibold uppercase tracking-[0.12em] text-[#505050]">
                      <Brain size={9} />
                      Model
                    </p>
                    <p className="truncate font-mono text-[11px] text-[#B8B8B8]">{execution.modelUsed}</p>
                  </div>
                )}
                <div className="rounded-xl border border-[rgba(255,255,255,0.06)] bg-[rgba(255,255,255,0.02)] px-3 py-2">
                  <p className="mb-1 flex items-center gap-1 text-[10px] font-semibold uppercase tracking-[0.12em] text-[#505050]">
                    <Clock size={9} />
                    Started
                  </p>
                  <p className="text-[11px] text-[#B8B8B8]">{formatDateTime(execution.createdAt)}</p>
                </div>
                {formatDuration(execution.createdAt, execution.updatedAt, execution.status) && (
                  <div className="rounded-xl border border-[rgba(255,255,255,0.06)] bg-[rgba(255,255,255,0.02)] px-3 py-2">
                    <p className="mb-1 flex items-center gap-1 text-[10px] font-semibold uppercase tracking-[0.12em] text-[#505050]">
                      <Clock size={9} />
                      Duration
                    </p>
                    <p className="text-[11px] text-[#B8B8B8]">{formatDuration(execution.createdAt, execution.updatedAt, execution.status)}</p>
                  </div>
                )}
                {execution.triggeredBy && (
                  <div className="rounded-xl border border-[rgba(255,255,255,0.06)] bg-[rgba(255,255,255,0.02)] px-3 py-2">
                    <p className="mb-1 text-[10px] font-semibold uppercase tracking-[0.12em] text-[#505050]">Triggered By</p>
                    <p className="truncate text-[11px] text-[#B8B8B8]">
                      {execution.triggeredBy.displayName ?? execution.triggeredBy.name ?? "Unknown"}
                    </p>
                  </div>
                )}
              </div>
            </div>

            {/* Related kanban card */}
            <div className="rounded-2xl border border-[rgba(255,255,255,0.08)] bg-[linear-gradient(180deg,rgba(24,24,24,0.98),rgba(15,15,15,0.98))] overflow-hidden">
              <div className="flex items-center justify-between border-b border-[rgba(255,255,255,0.06)] px-4 py-2.5">
                <p className="text-[10px] font-semibold uppercase tracking-[0.15em] text-[#707070]">Source Kanban Card</p>
                <span className="rounded-full border border-[rgba(255,255,255,0.06)] bg-[rgba(255,255,255,0.03)] px-2 py-0.5 text-[10px] font-semibold text-[#9A9A9A]">
                  {columnName}
                </span>
              </div>

              <div
                className="p-4"
                style={{
                  borderLeftWidth: "3px",
                  borderLeftStyle: "solid",
                  borderLeftColor: priorityColor,
                  boxShadow: `inset 0 1px 0 rgba(255,255,255,0.03), 0 0 0 1px ${priorityColor}10`,
                }}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span
                        className="rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.12em]"
                        style={{ color: priorityColor, backgroundColor: `${priorityColor}18` }}
                      >
                        {priorityLabel}
                      </span>
                      {execution.kanbanCard.state && execution.kanbanCard.state !== "normal" ? (
                        <span className="rounded-full border border-[rgba(255,255,255,0.08)] bg-[rgba(255,255,255,0.03)] px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.12em] text-[#A8A8A8]">
                          {execution.kanbanCard.state.replace(/-/g, " ")}
                        </span>
                      ) : null}
                    </div>
                    <p className="mt-2 text-sm font-semibold leading-snug text-[#F0F0F0]">{execution.kanbanCard.title}</p>
                    {fullExecution.kanbanCard.body ? (
                      <p className="mt-1.5 line-clamp-3 text-xs leading-5 text-[#979797]">{fullExecution.kanbanCard.body}</p>
                    ) : null}
                  </div>

                  {execution.kanbanCard.githubIssueUrl ? (
                    <a
                      href={execution.kanbanCard.githubIssueUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg border border-[rgba(255,255,255,0.07)] bg-[rgba(255,255,255,0.03)] text-[#6E6E6E] transition-colors hover:border-[rgba(247,148,29,0.18)] hover:text-[#F7941D]"
                      title="Open linked GitHub issue"
                    >
                      <ExternalLink size={13} />
                    </a>
                  ) : null}
                </div>

                {labels.length > 0 ? (
                  <div className="mt-3 flex flex-wrap gap-1.5">
                    {labels.slice(0, 4).map((label) => (
                      <span
                        key={label}
                        className="rounded-md bg-[rgba(255,255,255,0.05)] px-2 py-0.5 text-[10px] text-[#A0A0A0]"
                      >
                        {label}
                      </span>
                    ))}
                    {labels.length > 4 ? <span className="text-[10px] text-[#5D5D5D]">+{labels.length - 4}</span> : null}
                  </div>
                ) : null}
              </div>
            </div>

            {/* Notes */}
            {execution.notes && (
              <div className="rounded-2xl border border-[rgba(251,186,0,0.16)] bg-[rgba(251,186,0,0.04)] p-3.5">
                <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-[0.15em] text-[#FBBA00]">Team Notes</p>
                <p className="text-sm leading-6 text-[#C8C0A0]">{execution.notes}</p>
              </div>
            )}

            {/* ── Response / State ── */}
            <div>
              <div className="mb-3 flex items-center justify-between">
                <p className="text-[10px] font-semibold uppercase tracking-[0.15em] text-[#606060]">Agent Response</p>
                {fullExecution.response && (
                  <button
                    type="button"
                    onClick={() => void copyResponse()}
                    className="flex items-center gap-1.5 rounded-lg border border-[rgba(255,255,255,0.07)] bg-[rgba(255,255,255,0.03)] px-2.5 py-1 text-[11px] text-[#707070] transition-colors hover:border-[rgba(255,255,255,0.12)] hover:text-[#C0C0C0]"
                  >
                    <Copy size={10} />
                    {copied ? "Copied!" : "Copy"}
                  </button>
                )}
              </div>

              {execution.status === "in-process" && !fullExecution.response ? (
                <div className="flex flex-col items-center justify-center gap-3 rounded-2xl border border-[rgba(75,156,211,0.2)] bg-[rgba(75,156,211,0.05)] py-10">
                  <div className="relative">
                    <div className="h-10 w-10 animate-spin rounded-full border-2 border-[rgba(75,156,211,0.2)] border-t-[#4B9CD3]" />
                    <Bot size={16} className="absolute inset-0 m-auto text-[#4B9CD3]" />
                  </div>
                  <div className="text-center">
                    <p className="text-sm font-semibold text-[#4B9CD3]">{execution.agent.name} is thinking…</p>
                    <p className="mt-0.5 text-xs text-[#506070]">The agent is processing your request</p>
                  </div>
                </div>
              ) : loadingFull ? (
                <div className="flex items-center justify-center gap-2 rounded-2xl border border-[rgba(255,255,255,0.07)] py-10 text-xs text-[#404040]">
                  <Loader2 size={14} className="animate-spin text-[#4B9CD3]" />
                  Loading response…
                </div>
              ) : execution.errorMessage ? (
                <div className="rounded-2xl border border-[rgba(239,68,68,0.25)] bg-[rgba(239,68,68,0.06)] p-4">
                  <div className="mb-2 flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <AlertTriangle size={14} className="text-[#EF4444]" />
                      <span className="text-xs font-semibold uppercase tracking-wider text-[#EF8888]">Execution Failed</span>
                    </div>
                    {onRetry && (
                      <button
                        type="button"
                        disabled={retrying}
                        onClick={async () => {
                          setRetrying(true);
                          try { await onRetry(execution); } finally { setRetrying(false); }
                        }}
                        className="flex items-center gap-1.5 rounded-lg border border-[rgba(239,68,68,0.3)] bg-[rgba(239,68,68,0.1)] px-3 py-1.5 text-xs font-semibold text-[#FCA5A5] transition-colors hover:bg-[rgba(239,68,68,0.18)] disabled:opacity-50"
                      >
                        {retrying ? <Loader2 size={11} className="animate-spin" /> : <RotateCcw size={11} />}
                        Retry
                      </button>
                    )}
                  </div>
                  <p className="text-sm leading-relaxed text-[#FCA5A5]">{execution.errorMessage}</p>
                </div>
              ) : fullExecution.response ? (
                <div className="rounded-2xl border border-[rgba(255,255,255,0.08)] bg-[rgba(255,255,255,0.02)]">
                  <div className="max-h-[520px] overflow-y-auto p-4">
                    <ReactMarkdown remarkPlugins={[remarkGfm]} components={executionMarkdownComponents}>
                      {fullExecution.response}
                    </ReactMarkdown>
                  </div>
                </div>
              ) : (
                <div className="rounded-2xl border border-dashed border-[rgba(255,255,255,0.07)] py-10 text-center text-xs text-[#404040]">
                  No response yet
                </div>
              )}
            </div>

          </div>
        </div>

        {/* ── Footer actions ── */}
        <div className="flex flex-shrink-0 items-center justify-between gap-3 border-t border-[rgba(255,255,255,0.07)] px-6 py-4">
          <div className="flex flex-wrap items-center gap-2">
            {execution.status === "completed" && (
              <button
                type="button"
                disabled={changingStatus}
                onClick={() => void handleStatusChange("needs-input")}
                className="rounded-xl border border-[rgba(251,186,0,0.25)] bg-[rgba(251,186,0,0.08)] px-3 py-1.5 text-xs font-medium text-[#FBBA00] transition-all hover:bg-[rgba(251,186,0,0.14)] disabled:opacity-40"
              >
                Flag: Needs Team Input
              </button>
            )}
            {execution.status === "needs-input" && (
              <button
                type="button"
                disabled={changingStatus}
                onClick={() => void handleStatusChange("completed")}
                className="rounded-xl border border-[rgba(34,197,94,0.25)] bg-[rgba(34,197,94,0.08)] px-3 py-1.5 text-xs font-medium text-[#22C55E] transition-all hover:bg-[rgba(34,197,94,0.14)] disabled:opacity-40"
              >
                Mark Resolved
              </button>
            )}
            {canArchive && (
              <button
                type="button"
                disabled={archiving}
                onClick={() => void handleArchive()}
                className="flex items-center gap-1.5 rounded-xl border border-[rgba(255,255,255,0.08)] bg-[rgba(255,255,255,0.03)] px-3 py-1.5 text-xs font-medium text-[#707070] transition-all hover:bg-[rgba(255,255,255,0.07)] hover:text-[#B0B0B0] disabled:opacity-40"
              >
                {archiving ? <Loader2 size={11} className="animate-spin" /> : <Archive size={11} />}
                Move to Archive
              </button>
            )}
          </div>

          <button
            type="button"
            disabled={deleting}
            onClick={() => void handleDelete()}
            className="flex items-center gap-1.5 rounded-xl border border-[rgba(239,68,68,0.15)] bg-[rgba(239,68,68,0.06)] px-3 py-1.5 text-xs font-medium text-[#EF4444] transition-all hover:bg-[rgba(239,68,68,0.12)] disabled:opacity-40"
          >
            {deleting ? <Loader2 size={11} className="animate-spin" /> : <Trash2 size={11} />}
            Delete
          </button>
        </div>
      </motion.aside>
    </>
  );

  if (typeof document === "undefined") return null;
  return createPortal(panel, document.body);
}

// ── Archive Panel ─────────────────────────────────────────────────────────────

export function ArchivePanel({
  archived,
  onDelete,
  onRestore,
  onClose,
  onSelect,
}: {
  archived: ExecutionRecord[];
  onDelete: (id: string) => void;
  onRestore: (id: string) => void;
  onClose: () => void;
  onSelect: (exec: ExecutionRecord) => void;
}) {
  const [deletingId, setDeletingId] = useState<string | null>(null);

  async function handleDelete(id: string) {
    if (!confirm("Permanently delete this execution record? This cannot be undone.")) return;
    setDeletingId(id);
    try {
      await fetch(`/api/agent-executions/${id}`, { method: "DELETE" });
      onDelete(id);
    } finally {
      setDeletingId(null);
    }
  }

  async function handleRestore(id: string) {
    await fetch(`/api/agent-executions/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: "completed" }),
    });
    onRestore(id);
  }

  const panel = (
    <>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={onClose}
        className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm"
      />

      <motion.aside
        initial={{ x: "100%" }}
        animate={{ x: 0 }}
        exit={{ x: "100%" }}
        transition={{ type: "spring", stiffness: 320, damping: 32 }}
        className="fixed right-0 top-0 z-50 flex h-full w-full max-w-[38rem] flex-col border-l border-[rgba(255,255,255,0.08)] bg-[#0E0E0E] shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-[rgba(255,255,255,0.06)] px-6 py-5">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-2xl border border-[rgba(255,255,255,0.1)] bg-[rgba(255,255,255,0.04)]">
              <Archive size={18} className="text-[#A0A0A0]" />
            </div>
            <div>
              <h2 className="text-base font-bold text-[#F0F0F0]">Execution Archive</h2>
              <p className="text-xs text-[#606060]">
                {archived.length === 0
                  ? "No archived records"
                  : `${archived.length} archived record${archived.length !== 1 ? "s" : ""}`}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="flex h-9 w-9 items-center justify-center rounded-xl text-[#606060] transition-colors hover:bg-[rgba(255,255,255,0.06)] hover:text-[#F0F0F0]"
          >
            <X size={16} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-5">
          {archived.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 text-center">
              <Archive size={36} className="mb-4 text-[#303030]" />
              <p className="text-sm font-medium text-[#505050]">No archived executions yet</p>
              <p className="mt-1 text-xs text-[#404040]">Archive completed tasks to keep your board clean.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {archived.map((exec) => {
                const isDeleting = deletingId === exec.id;
                const priorityColor = PRIORITY_COLORS[exec.kanbanCard.priority] ?? PRIORITY_COLORS.medium;

                return (
                  <div
                    key={exec.id}
                    className="group rounded-2xl border border-[rgba(255,255,255,0.07)] bg-[linear-gradient(180deg,rgba(20,20,20,0.98),rgba(12,12,12,0.98))] transition-colors hover:border-[rgba(255,255,255,0.12)]"
                  >
                    <button
                      type="button"
                      onClick={() => onSelect(exec)}
                      className="w-full p-4 text-left"
                    >
                      <div className="mb-1.5 flex flex-wrap items-center gap-2">
                        <span
                          className="inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-[11px] font-medium"
                          style={{ borderColor: "rgba(75,156,211,0.25)", backgroundColor: "rgba(75,156,211,0.08)", color: "#90C9EE" }}
                        >
                          <Bot size={10} />
                          {exec.agent.name}
                        </span>
                        <span
                          className="rounded-full border px-2 py-0.5 text-[11px] font-medium"
                          style={{ borderColor: "rgba(255,255,255,0.08)", backgroundColor: "rgba(255,255,255,0.03)", color: "#909090" }}
                        >
                          {resolveAgentActionLabel(exec.actionType, exec.agent.abilities)}
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="h-2 w-2 flex-shrink-0 rounded-full" style={{ backgroundColor: priorityColor }} />
                        <span className="truncate text-sm font-semibold text-[#D8D8D8]">{exec.kanbanCard.title}</span>
                      </div>
                      <div className="mt-2 flex flex-wrap items-center gap-3 text-[11px] text-[#505050]">
                        <span className="flex items-center gap-1">
                          <Clock size={10} />
                          {formatDateTime(exec.createdAt)}
                        </span>
                        {exec.modelUsed && (
                          <span className="rounded border border-[rgba(255,255,255,0.06)] bg-[rgba(255,255,255,0.02)] px-1.5 py-0.5 font-mono text-[10px]">
                            {exec.modelUsed}
                          </span>
                        )}
                      </div>
                    </button>

                    <div className="flex items-center justify-between border-t border-[rgba(255,255,255,0.05)] px-4 py-2">
                      <button
                        type="button"
                        onClick={() => void handleRestore(exec.id)}
                        className="text-[11px] text-[#22C55E] transition-colors hover:text-[#4ADE80]"
                      >
                        Restore to Completed
                      </button>
                      <button
                        type="button"
                        onClick={() => void handleDelete(exec.id)}
                        disabled={isDeleting}
                        className="flex h-7 w-7 items-center justify-center rounded-lg text-[#505050] transition-colors hover:bg-[rgba(239,68,68,0.1)] hover:text-[#EF4444]"
                      >
                        {isDeleting ? <Loader2 size={12} className="animate-spin" /> : <Trash2 size={13} />}
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {archived.length > 0 && (
          <div className="border-t border-[rgba(255,255,255,0.06)] px-6 py-4">
            <p className="text-xs text-[#404040]">
              Deleting a record removes the agent execution details permanently but does not affect the original task.
            </p>
          </div>
        )}
      </motion.aside>
    </>
  );

  if (typeof document === "undefined") return null;
  return createPortal(panel, document.body);
}

// ── Execution Card (board tile) ───────────────────────────────────────────────

function ExecutionCard({
  execution,
  onClick,
}: {
  execution: ExecutionRecord;
  onClick: () => void;
}) {
  const priorityColor = PRIORITY_COLORS[execution.kanbanCard.priority] ?? PRIORITY_COLORS.medium;
  const col = COLUMNS.find((c) => c.id === execution.status);

  return (
    <motion.button
      type="button"
      layout
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.96 }}
      onClick={onClick}
      className="w-full rounded-2xl border bg-[linear-gradient(180deg,rgba(22,22,22,0.98),rgba(14,14,14,0.98))] p-4 text-left transition-all hover:border-[rgba(255,255,255,0.16)] hover:shadow-lg hover:shadow-black/40"
      style={{ borderColor: col ? col.border : "rgba(255,255,255,0.08)" }}
    >
      {/* Badges */}
      <div className="mb-2.5 flex flex-wrap items-center gap-1.5">
        <span
          className="inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-[11px] font-medium"
          style={{ borderColor: "rgba(75,156,211,0.25)", backgroundColor: "rgba(75,156,211,0.1)", color: "#90C9EE" }}
        >
          <Bot size={10} />
          {execution.agent.name}
        </span>
        <span
          className="rounded-full border px-2 py-0.5 text-[11px] font-medium"
          style={{ borderColor: "rgba(255,255,255,0.1)", backgroundColor: "rgba(255,255,255,0.04)", color: "#B0B0B0" }}
        >
          {resolveAgentActionLabel(execution.actionType, execution.agent.abilities)}
        </span>
      </div>

      {/* Task title */}
      <div className="flex items-center gap-2">
        <span className="h-2 w-2 flex-shrink-0 rounded-full" style={{ backgroundColor: priorityColor }} />
        <span className="truncate text-sm font-semibold text-[#E8E8E8]">{execution.kanbanCard.title}</span>
      </div>

      {/* Meta */}
      <div className="mt-3 flex flex-wrap items-center gap-3 text-[11px] text-[#606060]">
        <span className="flex items-center gap-1">
          <Clock size={10} />
          {formatRelative(execution.createdAt)}
        </span>
        {formatDuration(execution.createdAt, execution.updatedAt, execution.status) && (
          <span className="flex items-center gap-1">
            {formatDuration(execution.createdAt, execution.updatedAt, execution.status)}
          </span>
        )}
        {execution.modelUsed && (
          <span className="rounded border border-[rgba(255,255,255,0.07)] bg-[rgba(255,255,255,0.03)] px-1.5 py-0.5 font-mono">
            {execution.modelUsed}
          </span>
        )}
        {execution.triggeredBy && (
          <span>by {execution.triggeredBy.displayName ?? execution.triggeredBy.name ?? "Unknown"}</span>
        )}
      </div>

      {/* Response preview for completed */}
      {execution.status === "completed" && execution.response && (
        <p className="mt-2.5 line-clamp-2 text-xs leading-relaxed text-[#606060]">
          {execution.response}
        </p>
      )}
    </motion.button>
  );
}

// ── Board ─────────────────────────────────────────────────────────────────────

interface Props {
  initialExecutions: ExecutionRecord[];
}

export function AgentExecutionBoard({ initialExecutions }: Props) {
  const [executions, setExecutions] = useState<ExecutionRecord[]>(initialExecutions);
  const [refreshing, setRefreshing] = useState(false);
  const [lastRefresh, setLastRefresh] = useState<Date>(new Date());
  const [showArchive, setShowArchive] = useState(false);
  const [selectedExecution, setSelectedExecution] = useState<ExecutionRecord | null>(null);
  const recoveryAttemptedRef = useRef(new Set<string>());

  useEffect(() => {
    void refresh();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const refresh = useCallback(async () => {
    setRefreshing(true);
    try {
      const res = await fetch("/api/agent-executions");
      if (res.ok) {
        const data = await res.json() as ExecutionRecord[];
        setExecutions(data);
        setLastRefresh(new Date());
        // Keep selected execution data fresh
        setSelectedExecution((prev) =>
          prev ? (data.find((e) => e.id === prev.id) ?? prev) : null
        );
      }
    } finally {
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    const timer = setInterval(() => void refresh(), 4_000);
    return () => clearInterval(timer);
  }, [refresh]);

  useEffect(() => {
    for (const execution of executions) {
      if (!shouldRecoverExecution(execution)) continue;
      if (recoveryAttemptedRef.current.has(execution.id)) continue;
      recoveryAttemptedRef.current.add(execution.id);
      kickoffExecutionProcessing(execution.id);
    }
  }, [executions]);

  function handleStatusChange(id: string, status: string) {
    setExecutions((prev) => prev.map((e) => (e.id === id ? { ...e, status } : e)));
    setSelectedExecution((prev) => (prev?.id === id ? { ...prev, status } : prev));
  }

  function handleDelete(id: string) {
    setExecutions((prev) => prev.filter((e) => e.id !== id));
    setSelectedExecution((prev) => (prev?.id === id ? null : prev));
  }

  async function handleRetry(exec: ExecutionRecord) {
    const res = await fetch("/api/agent-executions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        kanbanCardId: exec.kanbanCardId,
        agentId: exec.agentId,
        actionType: exec.actionType,
        notes: exec.notes ?? undefined,
      }),
    });
    if (res.ok) {
      const execution = await res.json() as { id: string };
      kickoffExecutionProcessing(execution.id);
      // Archive the old failed execution so the board stays clean
      await fetch(`/api/agent-executions/${exec.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "archived" }),
      });
      setExecutions((prev) =>
        prev.map((e) => (e.id === exec.id ? { ...e, status: "archived" } : e))
      );
    }
    setSelectedExecution(null);
    void refresh();
  }

  const boardExecutions = executions.filter((e) => e.status !== "archived");
  const archivedExecutions = executions.filter((e) => e.status === "archived");

  const grouped = Object.fromEntries(
    COLUMNS.map((col) => [col.id, boardExecutions.filter((e) => e.status === col.id)])
  );

  const totalActive = (grouped["in-process"]?.length ?? 0) + (grouped["needs-input"]?.length ?? 0);

  return (
    <div>
      {/* Board header */}
      <div className="mb-6 flex items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-[#F0F0F0]">Agent Execution Board</h2>
          <p className="mt-1 text-sm text-[#707070]">
            {boardExecutions.length === 0
              ? "No executions yet — assign a real task to an agent from any Kanban card."
              : `${boardExecutions.length} execution${boardExecutions.length !== 1 ? "s" : ""}${totalActive > 0 ? ` · ${totalActive} active` : ""}`}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {archivedExecutions.length > 0 && (
            <button
              type="button"
              onClick={() => setShowArchive(true)}
              className="flex items-center gap-2 rounded-xl border border-[rgba(255,255,255,0.08)] bg-[rgba(255,255,255,0.03)] px-3 py-2 text-xs text-[#808080] transition-all hover:bg-[rgba(255,255,255,0.06)] hover:text-[#C0C0C0]"
            >
              <Archive size={13} />
              Archive
              <span className="flex h-4 min-w-4 items-center justify-center rounded-full bg-[rgba(255,255,255,0.08)] px-1 text-[10px] font-bold text-[#909090]">
                {archivedExecutions.length}
              </span>
            </button>
          )}
          <button
            type="button"
            onClick={() => void refresh()}
            disabled={refreshing}
            className={cn(
              "flex items-center gap-2 rounded-xl border border-[rgba(255,255,255,0.08)] bg-[rgba(255,255,255,0.03)] px-3 py-2 text-xs text-[#A0A0A0] transition-all hover:bg-[rgba(255,255,255,0.06)] hover:text-[#F0F0F0]",
              refreshing && "opacity-50"
            )}
          >
            <RefreshCw size={13} className={refreshing ? "animate-spin" : ""} />
            Refresh
          </button>
        </div>
      </div>

      {/* Columns */}
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {COLUMNS.map((col) => {
          const ColIcon = col.icon;
          const cards = grouped[col.id] ?? [];

          return (
            <div key={col.id} className="flex flex-col gap-3">
              <div
                className="flex items-center justify-between rounded-2xl border px-4 py-3"
                style={{ borderColor: col.border, backgroundColor: col.bg }}
              >
                <div className="flex items-center gap-2">
                  <ColIcon
                    size={15}
                    style={{ color: col.color }}
                    className={col.id === "in-process" && cards.length > 0 ? "animate-spin" : ""}
                  />
                  <span className="text-sm font-semibold" style={{ color: col.color }}>
                    {col.label}
                  </span>
                </div>
                <span
                  className="flex h-5 min-w-5 items-center justify-center rounded-full px-1.5 text-xs font-bold"
                  style={{ backgroundColor: col.bg, border: `1px solid ${col.border}`, color: col.color }}
                >
                  {cards.length}
                </span>
              </div>

              <div className="flex flex-col gap-3">
                <AnimatePresence mode="popLayout">
                  {cards.length === 0 ? (
                    <motion.div
                      key="empty"
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      className="rounded-2xl border border-dashed border-[rgba(255,255,255,0.06)] px-4 py-6 text-center text-xs text-[#444444]"
                    >
                      Empty
                    </motion.div>
                  ) : (
                    cards.map((execution) => (
                      <ExecutionCard
                        key={execution.id}
                        execution={execution}
                        onClick={() => setSelectedExecution(execution)}
                      />
                    ))
                  )}
                </AnimatePresence>
              </div>
            </div>
          );
        })}
      </div>

      {boardExecutions.length > 0 && (
        <p className="mt-4 text-center text-[11px] text-[#404040]">
          Last updated {lastRefresh.toLocaleTimeString()}
          {executions.some((e) => e.status === "in-process") && " · Auto-refreshing every 4s"}
        </p>
      )}

      {/* Detail drawer */}
      <AnimatePresence>
        {selectedExecution && (
          <ExecutionDetailDrawer
            execution={selectedExecution}
            onClose={() => setSelectedExecution(null)}
            onStatusChange={handleStatusChange}
            onDelete={handleDelete}
            onRetry={handleRetry}
          />
        )}
      </AnimatePresence>

      {/* Archive panel */}
      <AnimatePresence>
        {showArchive && (
          <ArchivePanel
            archived={archivedExecutions}
            onDelete={handleDelete}
            onRestore={(id) => handleStatusChange(id, "completed")}
            onClose={() => setShowArchive(false)}
            onSelect={(exec) => {
              setShowArchive(false);
              setSelectedExecution(exec);
            }}
          />
        )}
      </AnimatePresence>
    </div>
  );
}
