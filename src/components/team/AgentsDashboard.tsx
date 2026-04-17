"use client";

import type { CSSProperties } from "react";
import { useState, useCallback, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { TOOL_LABELS } from "@/lib/agent-tools";
import {
  AlertCircle,
  AlertTriangle,
  Archive,
  ArrowLeft,
  Bot,
  CheckCircle2,
  Clock,
  Copy,
  Eye,
  Loader2,
  MessageSquare,
  MessageSquareWarning,
  PanelLeftClose,
  PanelLeftOpen,
  Plus,
  RefreshCw,
  RotateCcw,
  Send,
  User,
  Wrench,
  X,
  XCircle,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/Button";
import { kickoffExecutionProcessing, shouldRecoverExecution } from "@/lib/agent-execution-client";
import {
  ExecutionDetailDrawer,
  ArchivePanel,
  type ExecutionRecord,
} from "@/components/agents/AgentExecutionBoard";

// ── Types ─────────────────────────────────────────────────────────────────────

interface Agent {
  id: string;
  name: string;
  role: string;
  description: string | null;
  avatar: string | null;
  status: string;
  llmStatus: string;
  llmModel: string | null;
  llmLastCheckedAt: string | null;
  createdAt: string;
  createdBy: string;
  sprintTasks: {
    id: string; title: string; status: string; priority: string;
    description: string | null; createdAt: string; updatedAt: string;
  }[];
}

interface ChatMessage {
  id: string;
  body: string;
  thinking?: string | null;
  isStreaming?: boolean;
  streamState?: "thinking" | "responding" | "using_tools";
  toolActivity?: { id: string; name: string; args: Record<string, unknown>; status: "running" | "done"; result?: string }[];
  retrievalSources?: Array<{ kind: string; label: string; target: string; detail: string }>;
  createdAt: string;
  sender: { kind: "user" | "agent"; id: string; name: string; image: string | null } | null;
}

interface AgentInspectorData {
  conversationId: string;
  readiness: { phase: "ready" | "offline" | "disconnected"; canSend: boolean; label: string; detail: string };
  agent: {
    id: string; name: string; role: string; status: string;
    llmStatus: string; llmModel: string | null; llmThinkingMode: string;
    llmLastCheckedAt: string | null; llmLastError: string | null; endpointConfigured: boolean;
  };
  threadLlm: {
    selectedModel: string | null;
    selectedModelKey: string | null;
    selectedLabel: string | null;
    selectedProvider: string | null;
    selectedBy: "auto" | "default" | "user" | "legacy" | null;
    reasonSummary: string | null;
    escalationSummary: string | null;
    auditEvents: Array<{
      type: "selection" | "override" | "escalation";
      at: string;
      summary: string;
      selectedBy: "auto" | "default" | "user" | "legacy";
      provider: string | null;
      model: string | null;
      modelKey: string | null;
    }>;
    availableModels: Array<{
      key: string;
      label: string;
      model: string;
      provider: string;
      connectionId: string;
      connectionLabel: string;
      isDefault: boolean;
    }>;
    autoRoute: boolean;
    allowUserOverride: boolean;
    allowEscalation: boolean;
  };
  context: {
    estimatedTokens: number; estimatedSystemPromptTokens: number; estimatedHistoryTokens: number;
    recentHistoryCount: number; historyWindowSize: number;
    knowledgeSources: Array<{ id: string; label: string; description: string }>;
  };
  payload: {
    currentUserName: string | null; systemPrompt: string;
    history: Array<{ role: "user" | "assistant"; content: string }>;
    orgContext: string;
  };
}

interface Props {
  agents: Agent[];
  initialExecutions: ExecutionRecord[];
}

// ── Constants ─────────────────────────────────────────────────────────────────

const EXECUTION_COLUMNS = [
  { id: "in-process",  label: "In Process",    icon: Loader2,              color: "#4B9CD3", bg: "rgba(75,156,211,0.12)",  border: "rgba(75,156,211,0.25)" },
  { id: "needs-input", label: "Needs Input",    icon: MessageSquareWarning, color: "#FBBA00", bg: "rgba(251,186,0,0.12)",   border: "rgba(251,186,0,0.25)"  },
  { id: "completed",   label: "Completed",      icon: CheckCircle2,         color: "#22C55E", bg: "rgba(34,197,94,0.12)",   border: "rgba(34,197,94,0.25)"  },
  { id: "failed",      label: "Failed",         icon: XCircle,              color: "#EF4444", bg: "rgba(239,68,68,0.12)",   border: "rgba(239,68,68,0.25)"  },
];

const PRIORITY_COLORS: Record<string, string> = {
  critical: "#EF4444", high: "#F97316", medium: "#FBBA00", low: "#6F6A64",
};

const MAX_CONTEXT_TOKENS = 128_000;

// ── Utilities ─────────────────────────────────────────────────────────────────

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

function formatRelative(value: string) {
  const diff = Date.now() - new Date(value).getTime();
  const mins = Math.floor(diff / 60_000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return new Date(value).toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

function formatRelativeTime(iso: string | null) {
  if (!iso) return "Not checked yet";
  const diffMinutes = Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 60000));
  if (diffMinutes < 2) return "Just now";
  if (diffMinutes < 60) return `${diffMinutes}m ago`;
  const diffHours = Math.round(diffMinutes / 60);
  if (diffHours < 24) return `${diffHours}h ago`;
  return `${Math.round(diffHours / 24)}d ago`;
}

function formatMessageTime(iso: string) {
  return new Date(iso).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
}

function formatTokensK(tokens: number): string {
  return `${(tokens / 1000).toFixed(1)}K`;
}

function formatThinkingMode(mode?: string) {
  if (mode === "always") return "Always";
  if (mode === "off") return "Off";
  return "Auto";
}

function formatContextMeter(tokens: number) {
  if (tokens < 1000) return "Light";
  if (tokens < 3000) return "Moderate";
  if (tokens < 6000) return "Heavy";
  return "Very heavy";
}

// ── Markdown components for chat ──────────────────────────────────────────────

const chatMarkdownComponents = {
  p: ({ children }: { children?: React.ReactNode }) => <p className="mb-2 last:mb-0 leading-5">{children}</p>,
  strong: ({ children }: { children?: React.ReactNode }) => <strong className="font-semibold text-[#F6F3EE]">{children}</strong>,
  em: ({ children }: { children?: React.ReactNode }) => <em className="italic text-[#DEDEDE]">{children}</em>,
  h1: ({ children }: { children?: React.ReactNode }) => <p className="mb-2 text-base font-bold text-[#F6F3EE]">{children}</p>,
  h2: ({ children }: { children?: React.ReactNode }) => <p className="mb-1.5 text-sm font-bold text-[#F6F3EE]">{children}</p>,
  h3: ({ children }: { children?: React.ReactNode }) => <p className="mb-1 text-sm font-semibold text-[#DEDEDE]">{children}</p>,
  ul: ({ children }: { children?: React.ReactNode }) => <ul className="mb-2 space-y-0.5 pl-4">{children}</ul>,
  ol: ({ children }: { children?: React.ReactNode }) => <ol className="mb-2 space-y-0.5 pl-4 list-decimal marker:text-[#8D877F]">{children}</ol>,
  li: ({ children }: { children?: React.ReactNode }) => (
    <li className="leading-5 flex gap-2">
      <span className="mt-2 w-1 h-1 rounded-full bg-[#7EC8E3]/60 flex-shrink-0" />
      <span className="flex-1">{children}</span>
    </li>
  ),
  code: ({ className, children }: { className?: string; children?: React.ReactNode }) => {
    const isBlock = /language-/.test(className ?? "");
    return isBlock ? (
      <pre className="my-2 overflow-x-auto rounded-xl bg-[#0D0D0D] px-3 py-2 text-xs font-mono text-[#C8C8C8] leading-relaxed whitespace-pre border border-[rgba(255,255,255,0.08)]">
        <code>{children}</code>
      </pre>
    ) : (
      <code className="px-1.5 py-0.5 rounded bg-[rgba(126,200,227,0.12)] text-[#9FCBE0] text-xs font-mono border border-[rgba(126,200,227,0.18)]">{children}</code>
    );
  },
  blockquote: ({ children }: { children?: React.ReactNode }) => (
    <blockquote className="my-2 pl-3 border-l-2 border-[#7EC8E3]/40 text-[#CFC9C2] italic">{children}</blockquote>
  ),
  hr: () => <hr className="my-3 border-[rgba(255,255,255,0.08)]" />,
  a: ({ href, children }: { href?: string; children?: React.ReactNode }) => (
    <a href={href} target="_blank" rel="noopener noreferrer" className="text-[#9FCBE0] underline underline-offset-2 hover:text-[#7EC8E3]">{children}</a>
  ),
};

// ── RadialContextBar ──────────────────────────────────────────────────────────

function RadialContextBar({ tokens }: { tokens: number }) {
  const pct = Math.min(1, tokens / MAX_CONTEXT_TOKENS);
  const r = 7;
  const circumference = 2 * Math.PI * r;
  const offset = circumference * (1 - pct);
  const color = pct < 0.5 ? "#4ade80" : pct < 0.75 ? "#facc15" : pct < 0.9 ? "#f97316" : "#ef4444";
  return (
    <svg width="18" height="18" viewBox="0 0 20 20" style={{ transform: "rotate(-90deg)", flexShrink: 0 }}>
      <circle cx="10" cy="10" r={r} fill="none" stroke="rgba(255,255,255,0.1)" strokeWidth="2.5" />
      <circle cx="10" cy="10" r={r} fill="none" stroke={color} strokeWidth="2.5"
        strokeDasharray={circumference} strokeDashoffset={offset} strokeLinecap="round" />
    </svg>
  );
}

// ── AgentAvatar ───────────────────────────────────────────────────────────────

function AgentAvatar({ agent, size = "md" }: { agent: Agent; size?: "xs" | "sm" | "md" | "lg" | "xl" }) {
  const sizeClass =
    size === "xs" ? "h-7 w-7 text-sm" :
    size === "sm" ? "h-9 w-9 text-base" :
    size === "lg" ? "h-14 w-14 text-2xl" :
    size === "xl" ? "h-16 w-16 text-3xl" :
    "h-11 w-11 text-xl";
  return (
    <div className={cn("flex shrink-0 items-center justify-center rounded-full border-[3px] border-[#111] bg-[rgba(75,156,211,0.15)] text-[#7EC8E3] overflow-hidden shadow-xl", sizeClass)}>
      {agent.avatar
        ? (agent.avatar.startsWith("data:") || agent.avatar.startsWith("https://"))
          ? <img src={agent.avatar} alt={agent.name} className="w-full h-full object-cover" />
          : <span>{agent.avatar}</span>
        : <Bot size={size === "xs" ? 12 : size === "sm" ? 15 : size === "lg" ? 24 : size === "xl" ? 30 : 18} />}
    </div>
  );
}

// ── ContextInspectorDialog ────────────────────────────────────────────────────

function ContextInspectorDialog({
  data, copiedView, onClose, onCopyPretty, onCopyJson,
}: {
  data: AgentInspectorData; copiedView: "pretty" | "json" | null;
  onClose: () => void; onCopyPretty: () => void; onCopyJson: () => void;
}) {
  const rawJson = JSON.stringify(data, null, 2);
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" />
      <motion.div
        initial={{ opacity: 0, y: 12, scale: 0.98 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        onClick={(e) => e.stopPropagation()}
        className="relative flex max-h-[90vh] w-full max-w-5xl flex-col overflow-hidden rounded-3xl border border-[rgba(75,156,211,0.18)] bg-[#161616] shadow-2xl"
      >
        <div className="flex items-center justify-between gap-3 border-b border-[rgba(255,255,255,0.06)] px-5 py-4">
          <div>
            <h2 className="text-lg font-semibold text-[#F6F3EE]">Agent Context Inspector</h2>
            <p className="text-sm text-[#8D877F]">Review readiness, context size, and the exact payload sent to the agent.</p>
          </div>
          <button onClick={onClose} className="flex h-10 w-10 items-center justify-center rounded-2xl border border-[rgba(255,255,255,0.08)] bg-[#181818] text-[#8D877F] transition-colors hover:text-[#F6F3EE]">
            <X size={16} />
          </button>
        </div>
        <div className="grid min-h-0 flex-1 gap-0 md:grid-cols-[320px_minmax(0,1fr)]">
          <div className="border-b border-[rgba(255,255,255,0.06)] bg-[#131313] p-5 md:border-b-0 md:border-r space-y-3">
            <div className="rounded-2xl border border-[rgba(75,156,211,0.16)] bg-[rgba(75,156,211,0.08)] p-4">
              <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[#7EC8E3]">Readiness</p>
              <p className="mt-2 text-lg font-semibold text-[#F6F3EE]">{data.readiness.label}</p>
              <p className="mt-1 text-sm leading-6 text-[#9FCBE0]">{data.readiness.detail}</p>
            </div>
            <div className="rounded-2xl border border-[rgba(255,255,255,0.06)] bg-[#101010] p-4">
              <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[#8D877F]">Context Window</p>
              <div className="mt-2 flex items-center gap-3">
                <p className="text-2xl font-semibold text-[#F6F3EE]">{formatTokensK(data.context.estimatedTokens)}</p>
                <p className="text-sm text-[#8D877F]">/ 128K</p>
              </div>
              <div className="mt-3 h-2 overflow-hidden rounded-full bg-[rgba(255,255,255,0.06)]">
                <div className="h-full rounded-full bg-[linear-gradient(90deg,#4B9CD3,#7EC8E3)]"
                  style={{ width: `${Math.min(100, Math.max(8, (data.context.estimatedTokens / MAX_CONTEXT_TOKENS) * 100))}%` }} />
              </div>
              <div className="mt-3 grid grid-cols-2 gap-2 text-xs text-[#CFC9C2]">
                <div className="rounded-xl bg-[rgba(255,255,255,0.03)] px-3 py-2">
                  <div>System</div>
                  <div className="mt-1 text-sm font-semibold text-[#F6F3EE]">{formatTokensK(data.context.estimatedSystemPromptTokens)}</div>
                </div>
                <div className="rounded-xl bg-[rgba(255,255,255,0.03)] px-3 py-2">
                  <div>History</div>
                  <div className="mt-1 text-sm font-semibold text-[#F6F3EE]">{formatTokensK(data.context.estimatedHistoryTokens)}</div>
                </div>
              </div>
              <p className="mt-3 text-xs text-[#6F6A64]">History: {data.context.recentHistoryCount}/{data.context.historyWindowSize} turns</p>
            </div>
            <div className="rounded-2xl border border-[rgba(255,255,255,0.06)] bg-[#101010] p-4">
              <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[#8D877F]">Model</p>
              <p className="mt-2 text-sm font-semibold text-[#F6F3EE]">{data.threadLlm.selectedLabel ?? data.agent.llmModel ?? "Unknown model"}</p>
              <p className="mt-1 text-sm text-[#8D877F]">Thinking: {formatThinkingMode(data.agent.llmThinkingMode)}</p>
              <p className="mt-1 text-sm text-[#8D877F]">Last checked: {formatRelativeTime(data.agent.llmLastCheckedAt)}</p>
            </div>
          </div>
          <div className="min-h-0 overflow-y-auto p-5">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[#8D877F]">Knowledge Sources</p>
                <p className="mt-1 text-sm text-[#8D877F]">RAG and prompt info bundled into the chat.</p>
              </div>
              <div className="flex gap-2">
                <Button variant="secondary" size="sm" icon={<Copy size={14} />} onClick={onCopyPretty}>
                  {copiedView === "pretty" ? "Copied" : "Copy Summary"}
                </Button>
                <Button variant="secondary" size="sm" icon={<Copy size={14} />} onClick={onCopyJson}>
                  {copiedView === "json" ? "Copied" : "Copy JSON"}
                </Button>
              </div>
            </div>
            <div className="mt-4 grid gap-3">
              {data.context.knowledgeSources.map((src) => (
                <div key={src.id} className="rounded-2xl border border-[rgba(255,255,255,0.06)] bg-[rgba(255,255,255,0.03)] p-4">
                  <p className="text-sm font-semibold text-[#F6F3EE]">{src.label}</p>
                  <p className="mt-1 text-sm leading-6 text-[#8D877F]">{src.description}</p>
                </div>
              ))}
            </div>
            <div className="mt-5 grid gap-4">
              <div className="rounded-2xl border border-[rgba(255,255,255,0.06)] bg-[#101010] p-4">
                <div className="flex items-center justify-between gap-3">
                  <p className="text-sm font-semibold text-[#F6F3EE]">System Prompt</p>
                  <span className="text-xs text-[#6F6A64]">{formatTokensK(data.context.estimatedSystemPromptTokens)} est. tokens</span>
                </div>
                <pre className="mt-3 max-h-[18rem] overflow-auto whitespace-pre-wrap rounded-2xl bg-[#0B0B0B] p-4 text-xs leading-6 text-[#D7D2CC]">{data.payload.systemPrompt}</pre>
              </div>
              <div className="rounded-2xl border border-[rgba(255,255,255,0.06)] bg-[#101010] p-4">
                <div className="flex items-center justify-between gap-3">
                  <p className="text-sm font-semibold text-[#F6F3EE]">Live Org Context</p>
                  <span className="text-xs text-[#6F6A64]">{formatContextMeter(data.context.estimatedTokens)}</span>
                </div>
                <pre className="mt-3 max-h-[18rem] overflow-auto whitespace-pre-wrap rounded-2xl bg-[#0B0B0B] p-4 text-xs leading-6 text-[#D7D2CC]">{data.payload.orgContext}</pre>
              </div>
              <div className="rounded-2xl border border-[rgba(255,255,255,0.06)] bg-[#101010] p-4">
                <div className="flex items-center justify-between gap-3">
                  <p className="text-sm font-semibold text-[#F6F3EE]">Raw Payload JSON</p>
                  <span className="text-xs text-[#6F6A64]">{data.payload.history.length} history turns</span>
                </div>
                <pre className="mt-3 max-h-[18rem] overflow-auto whitespace-pre-wrap rounded-2xl bg-[#0B0B0B] p-4 text-xs leading-6 text-[#D7D2CC]">{rawJson}</pre>
              </div>
            </div>
          </div>
        </div>
      </motion.div>
    </div>
  );
}

// ── ClearAgentContextDialog ───────────────────────────────────────────────────

function ClearAgentContextDialog({
  agentName, loading, onClose, onConfirm,
}: { agentName: string; loading: boolean; onClose: () => void; onConfirm: () => Promise<void> }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" />
      <motion.div
        initial={{ opacity: 0, y: 12, scale: 0.98 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        onClick={(e) => e.stopPropagation()}
        className="relative w-full max-w-md rounded-3xl border border-[rgba(75,156,211,0.18)] bg-[#161616] p-6 shadow-2xl"
      >
        <div className="mb-5 flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[rgba(75,156,211,0.14)] text-[#7EC8E3]">
            <RotateCcw size={18} />
          </div>
          <div>
            <h2 className="text-lg font-semibold text-[#F6F3EE]">Clear Agent Context</h2>
            <p className="text-sm text-[#8D877F]">Start a fresh chat state with {agentName}.</p>
          </div>
        </div>
        <div className="rounded-2xl border border-[rgba(255,255,255,0.06)] bg-[#111111] p-4">
          <div className="flex items-start gap-3">
            <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-[rgba(247,148,29,0.14)] text-[#F7941D]">
              <AlertTriangle size={15} />
            </div>
            <div>
              <p className="text-sm font-medium text-[#F6F3EE]">This removes the chat history for this AI conversation.</p>
              <p className="mt-1 text-sm leading-6 text-[#8D877F]">The agent profile stays intact, but prior messages won&apos;t be used as context for future replies.</p>
            </div>
          </div>
        </div>
        <div className="mt-5 flex gap-2">
          <Button type="button" variant="secondary" className="flex-1" onClick={onClose}>Cancel</Button>
          <Button type="button" variant="primary" className="flex-1" loading={loading}
            onClick={() => void onConfirm()}
            style={{ background: "linear-gradient(135deg, #4B9CD3, #2980C4)" } as CSSProperties}>
            Clear Context
          </Button>
        </div>
      </motion.div>
    </div>
  );
}

// ── FullAgentCard (left panel) ────────────────────────────────────────────────

function FullAgentCard({ agent, isSelected, onSelect }: { agent: Agent; isSelected: boolean; onSelect: () => void }) {
  const router = useRouter();
  const isOnline = agent.llmStatus === "online";

  return (
    <div
      onClick={onSelect}
      className={cn(
        "flex flex-col rounded-[18px] border overflow-hidden shadow-md transition-all cursor-pointer",
        isSelected
          ? "border-[rgba(75,156,211,0.55)] bg-[#141414] shadow-[0_0_0_2px_rgba(75,156,211,0.18),0_4px_20px_rgba(75,156,211,0.12)]"
          : "border-[rgba(255,255,255,0.07)] bg-[#141414] hover:border-[rgba(255,255,255,0.14)]"
      )}
    >
      {/* Banner */}
      <div className="relative h-10 shrink-0"
        style={{ backgroundImage: "url('/AgentBackground.png')", backgroundSize: "cover", backgroundPosition: "center" }}>
        <div className="absolute top-1.5 right-1.5 flex items-center gap-1">
          {/* Profile button — stop propagation so click doesn't also select */}
          <button
            onClick={(e) => { e.stopPropagation(); router.push(`/agents/${agent.id}/profile`); }}
            title="Profile"
            className="flex h-[26px] w-[26px] items-center justify-center rounded-lg bg-[rgba(20,20,20,0.8)] text-[#909090] shadow-[0_2px_8px_rgba(0,0,0,0.5)] transition-all hover:bg-[#1a1a1a] hover:text-[#D0D0D0]"
          >
            <User size={11} />
          </button>
        </div>
      </div>

      {/* Identity */}
      <div className="px-3 pb-4 pt-2">
        <div className="flex items-end gap-2.5">
          {/* Avatar overlapping banner */}
          <div className="relative z-10 -mt-8 shrink-0">
            <AgentAvatar agent={agent} size="xl" />
            <span
              className="absolute bottom-0.5 right-0.5 h-3.5 w-3.5 rounded-full border-2 border-[#141414]"
              style={{ backgroundColor: isOnline ? "#22C55E" : "#444444" }}
            />
          </div>
          <div className="min-w-0 pb-0.5">
            <h3 className={cn(
              "text-[12px] font-black uppercase tracking-wide leading-tight truncate",
              isSelected ? "text-[#7EC8E3]" : "text-[#F6F3EE]"
            )}>
              {agent.name}
            </h3>
            <p className="mt-0.5 text-[9px] font-semibold text-[#4B9CD3] uppercase tracking-[0.15em] leading-tight break-words">{agent.role}</p>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── ExecutionRow (right panel list) ──────────────────────────────────────────

function ExecutionRow({ execution, onClick }: { execution: ExecutionRecord; onClick: () => void }) {
  const col = EXECUTION_COLUMNS.find((c) => c.id === execution.status);
  const ColIcon = col?.icon ?? AlertCircle;
  const priorityColor = PRIORITY_COLORS[execution.kanbanCard.priority] ?? PRIORITY_COLORS.medium;

  return (
    <button type="button" onClick={onClick}
      className="group w-full flex items-center gap-3 rounded-2xl border border-[rgba(255,255,255,0.06)] bg-[rgba(255,255,255,0.02)] px-4 py-3 text-left transition-all hover:border-[rgba(255,255,255,0.12)] hover:bg-[rgba(255,255,255,0.04)]"
    >
      {/* Status badge */}
      <div className="flex shrink-0 items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-semibold whitespace-nowrap"
        style={{ color: col?.color ?? "#909090", backgroundColor: col?.bg ?? "transparent", borderColor: col?.border ?? "rgba(255,255,255,0.1)" }}>
        <ColIcon size={11} className={execution.status === "in-process" ? "animate-spin" : ""} />
        <span className="hidden sm:inline">{col?.label ?? execution.status}</span>
      </div>

      {/* Agent */}
      <div className="flex shrink-0 items-center gap-2">
        <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-[rgba(75,156,211,0.2)] bg-[rgba(75,156,211,0.1)] text-[#7EC8E3] overflow-hidden">
          {execution.agent.avatar
            ? (execution.agent.avatar.startsWith("data:") || execution.agent.avatar.startsWith("https://"))
              ? <img src={execution.agent.avatar} alt={execution.agent.name} className="h-full w-full object-cover" />
              : <span className="text-xs">{execution.agent.avatar}</span>
            : <Bot size={11} />}
        </div>
        <span className="text-[12px] font-medium text-[#90C9EE] whitespace-nowrap hidden md:inline">{execution.agent.name}</span>
      </div>

      <div className="hidden md:block h-4 w-px bg-[rgba(255,255,255,0.07)] shrink-0" />

      {/* Task title */}
      <div className="min-w-0 flex-1 flex items-center gap-2">
        <span className="h-2 w-2 shrink-0 rounded-full" style={{ backgroundColor: priorityColor }} />
        <span className="truncate text-[13px] font-medium text-[#D8D8D8]">{execution.kanbanCard.title}</span>
      </div>

      {/* Action type */}
      <span className="hidden lg:inline-flex shrink-0 rounded-full border border-[rgba(255,255,255,0.08)] bg-[rgba(255,255,255,0.03)] px-2 py-0.5 text-[11px] text-[#808080]">
        {execution.actionType}
      </span>

      {/* Meta */}
      <div className="shrink-0 flex items-center gap-1.5 text-[11px] text-[#555555]">
        <Clock size={10} />
        <span>{formatRelative(execution.createdAt)}</span>
        {formatDuration(execution.createdAt, execution.updatedAt, execution.status) && (
          <>
            <span>·</span>
            <span>{formatDuration(execution.createdAt, execution.updatedAt, execution.status)}</span>
          </>
        )}
        {execution.triggeredBy && (
          <>
            <span className="hidden sm:inline">·</span>
            <span className="hidden sm:inline truncate max-w-[100px]">{execution.triggeredBy.displayName ?? execution.triggeredBy.name ?? ""}</span>
          </>
        )}
      </div>
    </button>
  );
}

// ── ExecutionListPanel ────────────────────────────────────────────────────────

function ExecutionListPanel({ executions, onRefresh, refreshing }: {
  executions: ExecutionRecord[]; onRefresh: () => Promise<void>; refreshing: boolean;
}) {
  const [selectedExecution, setSelectedExecution] = useState<ExecutionRecord | null>(null);
  const [showArchive, setShowArchive] = useState(false);
  const [localExecutions, setLocalExecutions] = useState<ExecutionRecord[]>(executions);

  useEffect(() => { setLocalExecutions(executions); }, [executions]);

  function handleStatusChange(id: string, status: string) {
    setLocalExecutions((prev) => prev.map((e) => (e.id === id ? { ...e, status } : e)));
    setSelectedExecution((prev) => (prev?.id === id ? { ...prev, status } : prev));
  }
  function handleDelete(id: string) {
    setLocalExecutions((prev) => prev.filter((e) => e.id !== id));
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
      await fetch(`/api/agent-executions/${exec.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "archived" }),
      });
      setLocalExecutions((prev) =>
        prev.map((e) => (e.id === exec.id ? { ...e, status: "archived" } : e))
      );
    }
    setSelectedExecution(null);
    void onRefresh();
  }

  const boardExecutions = localExecutions.filter((e) => e.status !== "archived");
  const archivedExecutions = localExecutions.filter((e) => e.status === "archived");
  const activeCount = boardExecutions.filter((e) => e.status === "in-process" || e.status === "needs-input").length;

  const statusOrder: Record<string, number> = { "in-process": 0, "needs-input": 1, "completed": 2, "failed": 3 };
  const sorted = [...boardExecutions].sort((a, b) => {
    const so = (statusOrder[a.status] ?? 9) - (statusOrder[b.status] ?? 9);
    return so !== 0 ? so : new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
  });

  return (
    <div className="flex flex-col h-full min-h-0">
      <div className="flex shrink-0 items-center justify-between gap-3 border-b border-[rgba(255,255,255,0.06)] px-5 py-4">
        <div>
          <h2 className="text-base font-bold text-[#F0F0F0]">Executions</h2>
          <p className="mt-0.5 text-xs text-[#606060]">
            {boardExecutions.length === 0 ? "No executions yet" : `${boardExecutions.length} total${activeCount > 0 ? ` · ${activeCount} active` : ""}`}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {archivedExecutions.length > 0 && (
            <button type="button" onClick={() => setShowArchive(true)}
              className="flex items-center gap-1.5 rounded-xl border border-[rgba(255,255,255,0.08)] bg-[rgba(255,255,255,0.03)] px-3 py-1.5 text-xs text-[#808080] transition-all hover:bg-[rgba(255,255,255,0.06)] hover:text-[#C0C0C0]">
              <Archive size={12} />
              Archive
              <span className="flex h-4 min-w-4 items-center justify-center rounded-full bg-[rgba(255,255,255,0.08)] px-1 text-[10px] font-bold text-[#909090]">
                {archivedExecutions.length}
              </span>
            </button>
          )}
          <button type="button" onClick={() => void onRefresh()} disabled={refreshing}
            className={cn("flex items-center gap-1.5 rounded-xl border border-[rgba(255,255,255,0.08)] bg-[rgba(255,255,255,0.03)] px-3 py-1.5 text-xs text-[#A0A0A0] transition-all hover:bg-[rgba(255,255,255,0.06)] hover:text-[#F0F0F0]", refreshing && "opacity-50")}>
            <RefreshCw size={12} className={refreshing ? "animate-spin" : ""} />
            Refresh
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-4 py-4">
        {boardExecutions.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-[20px] bg-[rgba(255,255,255,0.03)] border border-[rgba(255,255,255,0.07)]">
              <CheckCircle2 size={26} className="text-[#333333]" />
            </div>
            <p className="text-sm font-medium text-[#505050]">No executions yet</p>
            <p className="mt-1 text-xs text-[#383838]">Assign a task to an agent from any Kanban card to see executions here.</p>
          </div>
        ) : (
          <div className="space-y-2">
            <AnimatePresence mode="popLayout">
              {sorted.map((exec) => (
                <motion.div key={exec.id} layout initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, scale: 0.97 }}>
                  <ExecutionRow execution={exec} onClick={() => setSelectedExecution(exec)} />
                </motion.div>
              ))}
            </AnimatePresence>
          </div>
        )}
      </div>

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
        {showArchive && (
          <ArchivePanel
            archived={archivedExecutions}
            onDelete={handleDelete}
            onRestore={(id) => handleStatusChange(id, "completed")}
            onClose={() => setShowArchive(false)}
            onSelect={(exec) => { setShowArchive(false); setSelectedExecution(exec); }}
          />
        )}
      </AnimatePresence>
    </div>
  );
}

// ── AgentChatInline ───────────────────────────────────────────────────────────

function AgentChatInline({ agent, onClose }: { agent: Agent; onClose: () => void }) {
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [loading, setLoading] = useState(true);
  const [inspector, setInspector] = useState<AgentInspectorData | null>(null);
  const [inspectorLoading, setInspectorLoading] = useState(false);
  const [showContextInspector, setShowContextInspector] = useState(false);
  const [showClearModal, setShowClearModal] = useState(false);
  const [clearingContext, setClearingContext] = useState(false);
  const [copiedMsgId, setCopiedMsgId] = useState<string | null>(null);
  const [copiedInspectorView, setCopiedInspectorView] = useState<"pretty" | "json" | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const chatScrollRef = useRef<HTMLDivElement>(null);

  const canSend = inspector?.readiness.canSend ?? false;
  const isReady = inspector?.readiness.phase === "ready";
  const activeThreadModelLabel = inspector?.threadLlm.selectedLabel ?? inspector?.agent.llmModel ?? null;

  // Init: create/get conversation, load messages + inspector
  useEffect(() => {
    let cancelled = false;
    async function init() {
      setLoading(true);
      setInspectorLoading(true);
      try {
        const convRes = await fetch("/api/chat/conversations", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ type: "direct", agentId: agent.id }),
        });
        const convData = await convRes.json() as { conversation?: { id: string } };
        if (cancelled || !convData.conversation) return;
        const cid = convData.conversation.id;
        setConversationId(cid);

        const [msgRes, inspRes] = await Promise.all([
          fetch(`/api/chat/conversations/${cid}/messages`),
          fetch(`/api/chat/conversations/${cid}/inspect`),
        ]);
        if (cancelled) return;

        const msgData = await msgRes.json() as { messages?: ChatMessage[] };
        if (msgData.messages) setMessages(msgData.messages);

        const inspData = await inspRes.json() as AgentInspectorData;
        if (inspData.readiness) {
          setInspector(inspData);
        }
      } catch {
        setInspector(null);
      } finally {
        if (!cancelled) { setLoading(false); setInspectorLoading(false); }
      }
    }
    void init();
    return () => { cancelled = true; };
  }, [agent.id]);

  // Scroll to bottom on new messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  async function copyText(text: string, kind: "message" | "pretty" | "json", id?: string) {
    try {
      await navigator.clipboard.writeText(text);
      if (kind === "message" && id) {
        setCopiedMsgId(id);
        window.setTimeout(() => setCopiedMsgId((cur) => (cur === id ? null : cur)), 1600);
      } else if (kind !== "message") {
        setCopiedInspectorView(kind);
        window.setTimeout(() => setCopiedInspectorView((cur) => (cur === kind ? null : cur)), 1600);
      }
    } catch { /* ignore */ }
  }

  async function clearContext() {
    if (!conversationId || clearingContext) return;
    setClearingContext(true);
    try {
      const res = await fetch(`/api/chat/conversations/${conversationId}/messages`, { method: "DELETE" });
      if (res.ok) {
        setMessages([]);
        setShowClearModal(false);
        // Refresh inspector after clear
        const inspRes = await fetch(`/api/chat/conversations/${conversationId}/inspect`);
        const inspData = await inspRes.json() as AgentInspectorData;
        if (inspData.readiness) {
          setInspector(inspData);
        }
      }
    } finally {
      setClearingContext(false);
    }
  }

  async function sendMessage() {
    if (!input.trim() || !conversationId || sending || !canSend) return;
    const text = input.trim();
    setInput("");
    setSending(true);

    const tempUserId = `temp-user-${Date.now()}`;
    const tempAgentId = `temp-agent-${Date.now()}`;

    setMessages((prev) => [
      ...prev,
      { id: tempUserId, body: text, createdAt: new Date().toISOString(), sender: { kind: "user", id: "me", name: "You", image: null } },
      { id: tempAgentId, body: "", isStreaming: true, streamState: "responding", createdAt: new Date().toISOString(), sender: { kind: "agent", id: agent.id, name: agent.name, image: agent.avatar } },
    ]);

    try {
      const res = await fetch(`/api/chat/conversations/${conversationId}/messages`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: text, stream: true }),
      });

      const contentType = res.headers.get("content-type") ?? "";
      if (contentType.includes("application/x-ndjson") && res.body) {
        const reader = res.body.getReader();
        const decoder = new TextDecoder();
        let buffer = "";
        while (true) {
          const { value, done } = await reader.read();
          if (done) break;
          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split("\n");
          buffer = lines.pop() ?? "";
          for (const line of lines) {
            const trimmed = line.trim();
            if (!trimmed) continue;
            try {
              const event = JSON.parse(trimmed) as
                | { type: "thinking_delta"; delta: string }
                | { type: "content_delta"; delta: string }
                | { type: "meta"; thinking: boolean }
                | { type: "tool_call"; id: string; name: string; args: Record<string, unknown> }
                | { type: "tool_result"; id: string; name: string; result: string }
                | { type: "done"; model: string }
                | { type: "retrieval"; sources: NonNullable<ChatMessage["retrievalSources"]> }
                | { type: "final_messages"; messages: ChatMessage[]; retrievalSources?: NonNullable<ChatMessage["retrievalSources"]> };

              if (event.type === "thinking_delta") {
                setMessages((prev) => prev.map((m) => m.id === tempAgentId
                  ? { ...m, thinking: `${m.thinking ?? ""}${event.delta}`, streamState: "thinking" } : m));
              }
              if (event.type === "content_delta") {
                setMessages((prev) => prev.map((m) => m.id === tempAgentId
                  ? { ...m, body: `${m.body}${event.delta}`, streamState: "responding" } : m));
              }
              if (event.type === "tool_call") {
                setMessages((prev) => prev.map((m) => m.id === tempAgentId
                  ? { ...m, streamState: "using_tools", toolActivity: [...(m.toolActivity ?? []), { id: event.id, name: event.name, args: event.args, status: "running" }] } : m));
              }
              if (event.type === "tool_result") {
                setMessages((prev) => prev.map((m) => m.id === tempAgentId
                  ? { ...m, toolActivity: (m.toolActivity ?? []).map((t) => t.id === event.id ? { ...t, status: "done", result: event.result } : t) } : m));
              }
              if (event.type === "retrieval") {
                setMessages((prev) => prev.map((m) => m.id === tempAgentId ? { ...m, retrievalSources: event.sources } : m));
              }
              if (event.type === "final_messages" && event.messages) {
                const sources = event.retrievalSources;
                setMessages((prev) => {
                  const stable = prev.filter((m) => !m.id.startsWith("temp-"));
                  return [...stable, ...event.messages.map((m) => m.sender?.kind === "agent" ? { ...m, retrievalSources: sources ?? m.retrievalSources } : m)];
                });
              }
            } catch { /* skip */ }
          }
        }
      } else {
        const data = await res.json() as { messages?: ChatMessage[] };
        if (data.messages) {
          setMessages((prev) => {
            const stable = prev.filter((m) => !m.id.startsWith("temp-"));
            return [...stable, ...data.messages!];
          });
        }
      }

      // Refresh inspector after send
      if (conversationId) {
        fetch(`/api/chat/conversations/${conversationId}/inspect`)
          .then((r) => r.json())
          .then((d: AgentInspectorData) => {
            if (d.readiness) {
              setInspector(d);
            }
          })
          .catch(() => { });
      }
    } catch {
      setMessages((prev) => prev.map((m) => m.id === tempAgentId
        ? { ...m, body: "Something went wrong. Please try again.", isStreaming: false } : m));
    } finally {
      setSending(false);
      inputRef.current?.focus();
    }
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); void sendMessage(); }
  }

  const inspectorPrettyText = inspector
    ? [
        `Agent: ${inspector.agent.name} (${inspector.agent.role})`,
        `Status: ${inspector.readiness.label}`,
        `Model: ${inspector.threadLlm.selectedLabel ?? inspector.agent.llmModel ?? "Unknown"}`,
        `Selected for this thread: ${inspector.threadLlm.selectedBy ?? "unknown"}`,
        inspector.threadLlm.reasonSummary ? `Routing reason: ${inspector.threadLlm.reasonSummary}` : null,
        inspector.threadLlm.escalationSummary ? `Escalation: ${inspector.threadLlm.escalationSummary}` : null,
        `Context: ${formatTokensK(inspector.context.estimatedTokens)} / 128K`,
        `History: ${inspector.context.recentHistoryCount}/${inspector.context.historyWindowSize} turns`,
      ].filter(Boolean).join("\n")
    : "";

  return (
    <div className="flex flex-col h-full min-h-0">
      {/* Chat header */}
      <div className="flex shrink-0 items-center gap-3 border-b border-[rgba(255,255,255,0.06)] px-4 py-3">
        <button onClick={onClose}
          className="flex h-7 w-7 shrink-0 items-center justify-center rounded-xl border border-[rgba(255,255,255,0.08)] text-[#606060] transition-colors hover:bg-[rgba(255,255,255,0.06)] hover:text-[#F0F0F0]">
          <ArrowLeft size={13} />
        </button>

        {/* Avatar */}
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[14px] border border-[rgba(75,156,211,0.3)] bg-[rgba(75,156,211,0.16)] text-[#7EC8E3] overflow-hidden">
          {agent.avatar
            ? (agent.avatar.startsWith("data:") || agent.avatar.startsWith("https://"))
              ? <img src={agent.avatar} alt={agent.name} className="w-full h-full object-cover" />
              : <span className="text-lg">{agent.avatar}</span>
            : <Bot size={18} />}
        </div>

        <div className="min-w-0 flex-1">
          <p className="text-sm font-bold text-[#F0F0F0] truncate">{agent.name}</p>
          <div className="flex items-center gap-1.5 text-xs text-[#6F6A64] truncate">
            <span className="truncate">{agent.role}</span>
            {activeThreadModelLabel && (
              <>
                <span className="hidden sm:inline text-[#3A3632]">·</span>
                <span className="hidden sm:inline truncate">{activeThreadModelLabel}</span>
              </>
            )}
            {inspector && (
              <>
                <span className="text-[#3A3632]">·</span>
                <span className={cn("shrink-0", isReady ? "text-[#4ade80]" : "text-[#9FCBE0]")}>{inspector.readiness.label}</span>
              </>
            )}
          </div>
        </div>

        <div className="flex shrink-0 items-center gap-1.5">
          <Button variant="secondary" size="sm" className="hidden md:inline-flex" icon={<Eye size={13} />}
            onClick={() => setShowContextInspector(true)}
            disabled={inspectorLoading || !inspector}>
            Inspect
          </Button>
          <button
            className="md:hidden flex h-8 w-8 items-center justify-center rounded-xl border border-[rgba(255,255,255,0.08)] text-[#606060] transition-colors hover:bg-[rgba(255,255,255,0.06)] hover:text-[#F0F0F0] disabled:opacity-40"
            onClick={() => setShowContextInspector(true)}
            disabled={inspectorLoading || !inspector}
            title="Inspect context"
          >
            <Eye size={14} />
          </button>
          {isReady && (
            <button
              className="flex h-8 w-8 items-center justify-center rounded-xl border border-[rgba(255,255,255,0.08)] text-[#606060] transition-colors hover:bg-[rgba(255,255,255,0.06)] hover:text-[#F0F0F0]"
              onClick={() => setShowClearModal(true)}
              title="Clear context"
            >
              {clearingContext ? <Loader2 size={14} className="animate-spin" /> : <RotateCcw size={14} />}
            </button>
          )}
        </div>
      </div>

      {/* Messages */}
      <div ref={chatScrollRef} className="flex-1 overflow-y-auto px-4 py-4 space-y-4">
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 size={20} className="animate-spin text-[#404040]" />
          </div>
        ) : messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <div className="mb-3 flex h-16 w-16 items-center justify-center rounded-[20px] border border-[rgba(75,156,211,0.15)] bg-[rgba(75,156,211,0.08)]">
              <AgentAvatar agent={agent} size="sm" />
            </div>
            <p className="text-sm font-medium text-[#606060]">Start chatting with {agent.name}</p>
            <p className="mt-1 text-xs text-[#404040]">{agent.description ?? `${agent.role} — ask anything.`}</p>
          </div>
        ) : (
          messages.map((msg) => {
            const isUser = msg.sender?.kind === "user";
            return (
              <div key={msg.id} className={cn("group flex gap-2.5", isUser ? "flex-row-reverse" : "flex-row")}>
                {/* Avatar */}
                {!isUser && (
                  <div className="mt-1 flex h-8 w-8 shrink-0 items-center justify-center rounded-[12px] border border-[rgba(75,156,211,0.25)] bg-[rgba(75,156,211,0.12)] text-[#7EC8E3] overflow-hidden">
                    {agent.avatar
                      ? (agent.avatar.startsWith("data:") || agent.avatar.startsWith("https://"))
                        ? <img src={agent.avatar} alt={agent.name} className="h-full w-full object-cover" />
                        : <span className="text-sm">{agent.avatar}</span>
                      : <Bot size={13} />}
                  </div>
                )}

                <div className={cn("flex min-w-0 max-w-[82%] flex-col gap-1", isUser ? "items-end" : "items-start")}>
                  {/* Bubble */}
                  <div
                    className="rounded-[18px] px-3.5 py-2.5 text-sm leading-5 [overflow-wrap:anywhere]"
                    style={isUser
                      ? { background: "linear-gradient(135deg, rgba(75,156,211,0.28), rgba(75,156,211,0.14))", color: "#F6F3EE", border: "1px solid rgba(75,156,211,0.25)", borderBottomRightRadius: 6 }
                      : { background: "rgba(75,156,211,0.1)", color: "#F6F3EE", border: "1px solid rgba(75,156,211,0.15)", borderBottomLeftRadius: 6 }}
                  >
                    {/* Thinking block */}
                    {msg.thinking ? (
                      <div className="mb-2 rounded-xl border border-[rgba(255,255,255,0.08)] bg-[rgba(0,0,0,0.18)] px-3 py-2">
                        <p className="mb-1 text-[10px] font-semibold uppercase tracking-[0.18em] text-[#8D877F]">Thinking</p>
                        <p className="whitespace-pre-wrap text-xs leading-5 text-[#CFC9C2]">{msg.thinking}</p>
                        {msg.isStreaming && !msg.body && (
                          <div className="mt-2 flex items-center gap-2 text-[11px] text-[#9FCBE0]">
                            <div className="h-3 w-3 rounded-full border-2 border-[rgba(126,200,227,0.2)] border-t-[#7EC8E3] animate-spin" />
                            <span>{msg.streamState === "responding" ? "Turning thoughts into a reply..." : "Thinking through it..."}</span>
                          </div>
                        )}
                      </div>
                    ) : null}

                    {/* Body */}
                    {msg.body ? (
                      !isUser ? (
                        <div className="[overflow-wrap:anywhere] prose-chat">
                          <ReactMarkdown remarkPlugins={[remarkGfm]} components={chatMarkdownComponents}>{msg.body}</ReactMarkdown>
                        </div>
                      ) : (
                        <div className="whitespace-pre-wrap">{msg.body}</div>
                      )
                    ) : msg.isStreaming ? (
                      <div className="flex items-center gap-2 text-[#CFC9C2]">
                        <div className="h-3.5 w-3.5 rounded-full border-2 border-[rgba(126,200,227,0.2)] border-t-[#7EC8E3] animate-spin" />
                        <span className="text-sm">
                          {msg.streamState === "using_tools" ? "Working on it..." :
                           msg.streamState === "responding" ? "Drafting reply..." :
                           msg.thinking ? "Thinking through it..." : "Thinking..."}
                        </span>
                      </div>
                    ) : null}

                    {/* Streaming cursor */}
                    {msg.isStreaming && msg.body && (
                      <div className="mt-2 flex items-center gap-2 text-[11px] text-[#9FCBE0]">
                        <div className="h-3 w-3 rounded-full border-2 border-[rgba(126,200,227,0.2)] border-t-[#7EC8E3] animate-spin" />
                        <span>Streaming reply...</span>
                      </div>
                    )}

                    {/* Tool activity */}
                    {msg.toolActivity && msg.toolActivity.length > 0 && (
                      <div className="mt-2 rounded-xl border border-[rgba(126,200,227,0.15)] bg-[rgba(75,156,211,0.07)] px-3 py-2">
                        <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-[0.18em] text-[#7EC8E3]">Actions Taken</p>
                        <div className="flex flex-col gap-1">
                          {msg.toolActivity.map((tool) => (
                            <div key={tool.id} className="flex items-center gap-2 text-[11px]">
                              {tool.status === "running"
                                ? <div className="h-3 w-3 shrink-0 rounded-full border-2 border-[rgba(126,200,227,0.2)] border-t-[#7EC8E3] animate-spin" />
                                : <Wrench size={11} className="shrink-0 text-[#7EC8E3]" />}
                              <span className="text-[#A9DCF3]">{TOOL_LABELS[tool.name] ?? tool.name}</span>
                              {tool.status === "running" && <span className="text-[#5A8FA8]">…</span>}
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Retrieval sources */}
                    {msg.retrievalSources && msg.retrievalSources.length > 0 && (
                      <div className="mt-3 rounded-xl border border-[rgba(255,255,255,0.08)] bg-[rgba(0,0,0,0.18)] px-3 py-2">
                        <p className="mb-2 text-[10px] font-semibold uppercase tracking-[0.18em] text-[#8D877F]">Read-Only Context Retrieved</p>
                        <div className="flex flex-wrap gap-1.5">
                          {msg.retrievalSources.map((src, i) => (
                            <span key={`${src.kind}-${src.target}-${i}`}
                              className="rounded-full border border-[rgba(75,156,211,0.18)] bg-[rgba(75,156,211,0.08)] px-2 py-1 text-[10px] text-[#A9DCF3]"
                              title={`${src.target} — ${src.detail}`}>{src.label}</span>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Actions row */}
                  {msg.body && (
                    <div className={cn("flex items-center gap-2 px-1 transition-opacity opacity-0 group-hover:opacity-100", isUser && "flex-row-reverse")}>
                      <button onClick={() => void copyText(msg.body, "message", msg.id)}
                        className="flex items-center gap-1 text-[11px] text-[#8D877F] transition-colors hover:text-[#F6F3EE]">
                        <Copy size={11} />
                        {copiedMsgId === msg.id ? "Copied" : "Copy"}
                      </button>
                      <span className="text-[10px] text-[#6F6A64]">{formatMessageTime(msg.createdAt)}</span>
                    </div>
                  )}
                </div>
              </div>
            );
          })
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input area */}
      <div className="shrink-0 border-t border-[rgba(255,255,255,0.06)] px-4 py-3">
        {/* LLM status bar */}
        {inspector && (
          <div className="mb-2 flex flex-wrap items-center gap-x-2 gap-y-1 text-[11px] text-[#4E4A45]">
            <span className={isReady ? "text-[#4ade80]" : "text-[#9FCBE0]"}>{inspector.readiness.label}</span>
            <span>·</span>
            <span className="inline-flex items-center gap-1">
              <RadialContextBar tokens={inspector.context.estimatedTokens} />
              <span>{formatTokensK(inspector.context.estimatedTokens)} / 128K</span>
            </span>
            <span className="hidden sm:inline">·</span>
            <span className="hidden sm:inline">{inspector.context.recentHistoryCount}/{inspector.context.historyWindowSize} msgs</span>
            <span className="hidden sm:inline">·</span>
            <span className="hidden sm:inline">{formatThinkingMode(inspector.agent.llmThinkingMode)} thinking</span>
          </div>
        )}

        {!canSend && !loading ? (
          <div className="flex items-center gap-2 rounded-2xl border border-[rgba(239,68,68,0.15)] bg-[rgba(239,68,68,0.06)] px-4 py-3 text-sm text-[#9A9A9A]">
            <span className="h-2 w-2 shrink-0 rounded-full bg-[#EF4444]" />
            {inspector?.readiness.detail || "Agent not online. Configure the LLM connection in the agent profile to start chatting."}
          </div>
        ) : (
          <div className="flex items-end gap-2">
            <textarea ref={inputRef} value={input} onChange={(e) => setInput(e.target.value)} onKeyDown={handleKeyDown}
              placeholder={loading ? `Preparing ${agent.name}...` : `Message ${agent.name}…`}
              rows={1} disabled={sending || loading || !canSend}
              className="flex-1 resize-none rounded-2xl border border-[rgba(255,255,255,0.08)] bg-[rgba(255,255,255,0.04)] px-3.5 py-2.5 text-sm text-[#F0F0F0] placeholder-[#404040] outline-none focus:border-[rgba(75,156,211,0.35)] transition-colors min-h-[44px] max-h-[140px]"
              style={{ height: "auto" }}
              onInput={(e) => {
                const el = e.currentTarget;
                el.style.height = "auto";
                el.style.height = `${Math.min(el.scrollHeight, 140)}px`;
              }}
            />
            <button onClick={() => void sendMessage()} disabled={!input.trim() || sending || loading || !canSend}
              className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl transition-all disabled:opacity-40"
              style={{ background: input.trim() && !sending ? "linear-gradient(135deg, #4B9CD3, #2980C4)" : "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.08)" }}>
              {sending ? <Loader2 size={15} className="animate-spin text-white" /> : <Send size={15} className="text-white" />}
            </button>
          </div>
        )}

        <p className="mt-2 hidden md:block text-xs text-[#6F6A64]">
          {loading ? "Initializing agent context and loading the knowledge bundle before input is enabled." :
           isReady ? "Connected agent streams live replies here. Open Inspect to verify the knowledge bundle being sent." :
           "Configure the LLM connection in the agent profile to start chatting."}
        </p>
      </div>

      {/* Dialogs */}
      <AnimatePresence>
        {showContextInspector && inspector && (
          <ContextInspectorDialog
            data={inspector}
            copiedView={copiedInspectorView}
            onClose={() => setShowContextInspector(false)}
            onCopyPretty={() => void copyText(inspectorPrettyText, "pretty")}
            onCopyJson={() => void copyText(JSON.stringify(inspector, null, 2), "json")}
          />
        )}
        {showClearModal && (
          <ClearAgentContextDialog
            agentName={agent.name}
            loading={clearingContext}
            onClose={() => { if (!clearingContext) setShowClearModal(false); }}
            onConfirm={clearContext}
          />
        )}
      </AnimatePresence>
    </div>
  );
}

// ── AgentsDashboard ───────────────────────────────────────────────────────────

export function AgentsDashboard({ agents, initialExecutions }: Props) {
  const router = useRouter();
  const [selectedAgent, setSelectedAgent] = useState<Agent | null>(() => {
    if (agents.length === 0) return null;
    return agents.find((agent) => agent.llmStatus === "online") ?? agents[0];
  });
  const [desktopTab, setDesktopTab] = useState<"chat" | "activity">("chat");
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [executions, setExecutions] = useState<ExecutionRecord[]>(initialExecutions);
  const [refreshing, setRefreshing] = useState(false);
  const [mobileTab, setMobileTab] = useState<"agents" | "activity" | "chat">("agents");
  const recoveryAttemptedRef = useRef(new Set<string>());

  const onlineCount = agents.filter((a) => a.llmStatus === "online").length;

  const refresh = useCallback(async () => {
    setRefreshing(true);
    try {
      const res = await fetch("/api/agent-executions");
      if (res.ok) setExecutions(await res.json() as ExecutionRecord[]);
    } finally {
      setRefreshing(false);
    }
  }, []);

  // Auto-refresh while executions are in-process
  useEffect(() => {
    if (!executions.some((e) => e.status === "in-process")) return;
    const timer = setInterval(() => void refresh(), 4_000);
    return () => clearInterval(timer);
  }, [executions, refresh]);

  useEffect(() => {
    for (const execution of executions) {
      if (!shouldRecoverExecution(execution)) continue;
      if (recoveryAttemptedRef.current.has(execution.id)) continue;
      recoveryAttemptedRef.current.add(execution.id);
      kickoffExecutionProcessing(execution.id);
    }
  }, [executions]);

  const desktopPanelWidth = sidebarCollapsed ? "md:w-[64px]" : "md:w-[260px]";

  function selectAgent(agent: Agent) {
    if (selectedAgent?.id === agent.id) {
      // Deselect: go back
      setSelectedAgent(null);
      setMobileTab("agents");
    } else {
      setSelectedAgent(agent);
      setDesktopTab("chat");
      setMobileTab("chat");
    }
  }

  function deselectAgent() {
    setSelectedAgent(null);
    setMobileTab("agents");
  }

  const agentExecutions = selectedAgent
    ? executions.filter((e) => e.agentId === selectedAgent.id)
    : [];

  return (
    <div className="flex flex-col gap-3 md:flex-row md:gap-4 md:items-start">

      {/* ── Mobile Tab Bar (3 tabs, hidden on desktop) ── */}
      <div className="flex md:hidden shrink-0 rounded-2xl border border-[rgba(255,255,255,0.07)] bg-[#111] overflow-hidden">
        <button
          onClick={() => setMobileTab("agents")}
          className={cn(
            "flex flex-1 items-center justify-center gap-2 py-3 text-sm font-semibold transition-colors",
            mobileTab === "agents" ? "text-[#4B9CD3] bg-[rgba(75,156,211,0.08)]" : "text-[#606060]"
          )}
        >
          <Bot size={14} />
          Agents
          {onlineCount > 0 && (
            <span className="flex h-4 min-w-4 items-center justify-center rounded-full bg-[#22C55E]/20 px-1 text-[10px] font-bold text-[#22C55E]">
              {onlineCount}
            </span>
          )}
        </button>
        <button
          onClick={() => setMobileTab("activity")}
          className={cn(
            "flex flex-1 items-center justify-center gap-2 py-3 text-sm font-semibold transition-colors",
            mobileTab === "activity" ? "text-[#4B9CD3] bg-[rgba(75,156,211,0.08)]" : "text-[#606060]"
          )}
        >
          <CheckCircle2 size={14} />
          Activity
        </button>
        <button
          onClick={() => setMobileTab("chat")}
          className={cn(
            "flex flex-1 items-center justify-center gap-2 py-3 text-sm font-semibold transition-colors",
            mobileTab === "chat" ? "text-[#4B9CD3] bg-[rgba(75,156,211,0.08)]" : "text-[#606060]"
          )}
        >
          <MessageSquare size={14} />
          Chat
          {selectedAgent && (
            <span className="flex h-4 min-w-4 items-center justify-center rounded-full bg-[rgba(75,156,211,0.2)] px-1 text-[10px] font-bold text-[#4B9CD3]">
              1
            </span>
          )}
        </button>
      </div>

      {/* ── Left Panel (agent nav) ── */}
      <div className={cn(
        // Mobile: full width, shown only on agents tab
        mobileTab === "agents" ? "flex flex-col w-full" : "hidden",
        // Desktop: always show as sticky side panel
        `md:flex md:flex-col md:shrink-0 md:sticky md:top-6 md:max-h-[calc(100vh-5rem)] md:overflow-hidden md:transition-all md:duration-200`,
        desktopPanelWidth,
      )}>
        {sidebarCollapsed ? (
          /* ── Icon rail (collapsed) — desktop only ── */
          <div className="flex flex-col items-center gap-2 py-3">
            <button
              onClick={() => setSidebarCollapsed(false)}
              className="flex h-9 w-9 items-center justify-center rounded-xl bg-[rgba(255,255,255,0.06)] text-[#9A9A9A] hover:text-[#F0F0F0] hover:bg-[rgba(255,255,255,0.1)] transition-all"
              title="Expand panel"
            >
              <PanelLeftOpen size={17} />
            </button>
            <div className="w-8 h-px bg-[rgba(255,255,255,0.07)]" />
            {agents.map((agent) => {
              const isOnline = agent.llmStatus === "online";
              return (
                <button
                  key={agent.id}
                  onClick={() => { setSidebarCollapsed(false); selectAgent(agent); }}
                  title={agent.name}
                  className={cn(
                    "relative flex h-10 w-10 shrink-0 items-center justify-center rounded-[18px] border transition-all overflow-hidden",
                    selectedAgent?.id === agent.id
                      ? "border-[rgba(75,156,211,0.7)] bg-[rgba(75,156,211,0.28)]"
                      : "border-[rgba(75,156,211,0.28)] bg-[rgba(75,156,211,0.1)] hover:bg-[rgba(75,156,211,0.2)]"
                  )}
                >
                  {agent.avatar
                    ? (agent.avatar.startsWith("data:") || agent.avatar.startsWith("https://"))
                      ? <img src={agent.avatar} alt={agent.name} className="w-full h-full object-cover" />
                      : <span className="text-sm">{agent.avatar}</span>
                    : <Bot size={15} className="text-[#7EC8E3]" />}
                  <span
                    className="absolute bottom-0.5 right-0.5 h-2.5 w-2.5 rounded-full border-2 border-[#0D0D0D]"
                    style={{ backgroundColor: isOnline ? "#22C55E" : "#444" }}
                  />
                </button>
              );
            })}
            <div className="w-8 h-px bg-[rgba(255,255,255,0.07)]" />
            <button
              onClick={() => router.push("/agents/new")}
              title="Hire an agent"
              className="flex h-9 w-9 items-center justify-center rounded-xl border border-[rgba(75,156,211,0.25)] bg-[rgba(75,156,211,0.08)] text-[#4B9CD3] hover:bg-[rgba(75,156,211,0.15)] transition-all"
            >
              <Plus size={16} />
            </button>
          </div>
        ) : (
          /* ── Expanded panel ── */
          <div className="flex flex-col h-full overflow-hidden">
            {/* Panel header */}
            <div className="flex items-center justify-between gap-2 pb-3">
              <div>
                <h1 className="flex items-center gap-2 text-lg font-black text-[#F0F0F0]">
                  <Bot size={17} className="text-[#4B9CD3]" />
                  AI Agents
                </h1>
                <p className="mt-0.5 text-xs text-[#505050]">
                  {agents.length} agent{agents.length !== 1 ? "s" : ""}
                  {onlineCount > 0 && <span className="ml-1.5 text-[#22C55E]">{onlineCount} online</span>}
                </p>
              </div>
              <div className="flex items-center gap-1.5">
                <Button
                  variant="primary"
                  size="sm"
                  icon={<Plus size={12} />}
                  onClick={() => router.push("/agents/new")}
                  style={{ background: "linear-gradient(135deg, #4B9CD3, #2980C4)", fontSize: "11px", padding: "5px 10px" }}
                >
                  Hire
                </Button>
                <button
                  onClick={() => setSidebarCollapsed(true)}
                  className="hidden md:flex h-7 w-7 items-center justify-center rounded-xl text-[#606060] hover:text-[#F0F0F0] hover:bg-[rgba(255,255,255,0.07)] transition-all"
                  title="Collapse panel"
                >
                  <PanelLeftClose size={15} />
                </button>
              </div>
            </div>

            {/* Agent nav list */}
            <div className="flex-1 overflow-y-auto space-y-1.5 pr-0.5">
              {agents.length === 0 ? (
                <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-[rgba(255,255,255,0.07)] py-10 text-center">
                  <Bot size={22} className="mb-2 text-[#333333]" />
                  <p className="text-xs text-[#444444]">No agents yet</p>
                  <button onClick={() => router.push("/agents/new")} className="mt-3 text-[11px] text-[#4B9CD3] hover:underline">
                    Hire your first agent →
                  </button>
                </div>
              ) : (
                <>
                  {/* "All Activity" deselect nav item */}
                  <button
                    type="button"
                    onClick={deselectAgent}
                    className={cn(
                      "w-full flex items-center gap-2.5 rounded-2xl border px-3 py-2 text-left text-xs font-semibold transition-all mb-2",
                      !selectedAgent
                        ? "border-[rgba(255,255,255,0.12)] bg-[rgba(255,255,255,0.05)] text-[#C0C0C0]"
                        : "border-transparent text-[#505050] hover:border-[rgba(255,255,255,0.07)] hover:text-[#909090]"
                    )}
                  >
                    <CheckCircle2 size={13} className={!selectedAgent ? "text-[#4B9CD3]" : "text-[#404040]"} />
                    All Activity
                    <span className="ml-auto text-[10px] font-bold text-[#505050]">
                      {executions.filter(e => e.status !== "archived").length}
                    </span>
                  </button>
                  {agents.map((agent) => (
                    <FullAgentCard
                      key={agent.id}
                      agent={agent}
                      isSelected={selectedAgent?.id === agent.id}
                      onSelect={() => selectAgent(agent)}
                    />
                  ))}
                </>
              )}
            </div>
          </div>
        )}
      </div>

      {/* ── Right Panel ── */}
      <div
        className={cn(
          // Mobile: show when NOT on agents tab
          mobileTab !== "agents" ? "flex flex-col" : "hidden",
          // Desktop: always show as main content area
          "md:flex md:flex-col md:flex-1 md:min-w-0",
          "w-full rounded-2xl border border-[rgba(255,255,255,0.07)] bg-[#111111] overflow-hidden",
          selectedAgent
            ? "h-[calc(100dvh-6rem)] md:h-[calc(100vh-5rem)]"
            : "h-[calc(100dvh-10rem)] md:h-[calc(100vh-5rem)]",
        )}
      >
        {/* ── Desktop tab strip (shown when agent selected) ── */}
        {selectedAgent && (
          <div className="hidden md:flex shrink-0 items-center gap-2 border-b border-[rgba(255,255,255,0.06)] px-3 py-2">
            <button
              onClick={deselectAgent}
              className="flex items-center gap-1.5 rounded-xl px-2 py-1.5 text-[11px] font-semibold text-[#505050] hover:text-[#C0C0C0] hover:bg-[rgba(255,255,255,0.06)] transition-all"
            >
              <ArrowLeft size={12} />
              All executions
            </button>
            <div className="flex-1" />
            {/* Tab buttons */}
            <div className="flex items-center gap-0.5 rounded-xl border border-[rgba(255,255,255,0.08)] bg-[rgba(255,255,255,0.03)] p-0.5">
              <button
                onClick={() => setDesktopTab("chat")}
                className={cn(
                  "flex items-center gap-1.5 rounded-[10px] px-3 py-1.5 text-[11px] font-semibold transition-all",
                  desktopTab === "chat"
                    ? "bg-[rgba(75,156,211,0.22)] text-[#4B9CD3] shadow-sm"
                    : "text-[#606060] hover:text-[#C0C0C0]"
                )}
              >
                <MessageSquare size={11} />
                Chat
              </button>
              <button
                onClick={() => setDesktopTab("activity")}
                className={cn(
                  "flex items-center gap-1.5 rounded-[10px] px-3 py-1.5 text-[11px] font-semibold transition-all",
                  desktopTab === "activity"
                    ? "bg-[rgba(75,156,211,0.22)] text-[#4B9CD3] shadow-sm"
                    : "text-[#606060] hover:text-[#C0C0C0]"
                )}
              >
                <CheckCircle2 size={11} />
                Activity
              </button>
            </div>
            <button
              onClick={() => router.push(`/agents/${selectedAgent.id}/profile`)}
              title="Agent profile"
              className="flex h-7 w-7 items-center justify-center rounded-xl text-[#505050] hover:text-[#F0F0F0] hover:bg-[rgba(255,255,255,0.07)] transition-all"
            >
              <User size={13} />
            </button>
          </div>
        )}

        {/* ── Content area ── */}
        <div className="flex-1 min-h-0 overflow-hidden">

          {/* Chat view — mobile: mobileTab=chat + selectedAgent; desktop: desktopTab=chat + selectedAgent */}
          <div className={cn(
            selectedAgent && mobileTab === "chat" ? "flex" : "hidden",
            selectedAgent && desktopTab === "chat" ? "md:flex" : "md:hidden",
            "flex-col h-full"
          )}>
            {selectedAgent && (
              <AgentChatInline agent={selectedAgent} onClose={deselectAgent} />
            )}
          </div>

          {/* Agent activity view — mobile: mobileTab=activity + selectedAgent; desktop: desktopTab=activity + selectedAgent */}
          <div className={cn(
            selectedAgent && mobileTab === "activity" ? "flex" : "hidden",
            selectedAgent && desktopTab === "activity" ? "md:flex" : "md:hidden",
            "flex-col h-full"
          )}>
            {selectedAgent && (
              <ExecutionListPanel executions={agentExecutions} onRefresh={refresh} refreshing={refreshing} />
            )}
          </div>

          {/* All activity view — mobile: mobileTab=activity + no agent; desktop: no agent selected */}
          <div className={cn(
            !selectedAgent && mobileTab === "activity" ? "flex" : "hidden",
            !selectedAgent ? "md:flex" : "md:hidden",
            "flex-col h-full"
          )}>
            <ExecutionListPanel executions={executions} onRefresh={refresh} refreshing={refreshing} />
          </div>

          {/* No-agent chat prompt — mobile only */}
          <div className={cn(
            !selectedAgent && mobileTab === "chat" ? "flex" : "hidden",
            "md:hidden flex-col items-center justify-center h-full gap-4 px-6 py-12 text-center"
          )}>
            <div className="flex h-16 w-16 items-center justify-center rounded-[22px] border border-[rgba(75,156,211,0.15)] bg-[rgba(75,156,211,0.08)]">
              <MessageSquare size={26} className="text-[#4B9CD3]" />
            </div>
            <div>
              <p className="text-sm font-semibold text-[#606060]">No agent selected</p>
              <p className="mt-1 text-xs leading-5 text-[#404040]">
                Select an agent from the Agents tab to start chatting
              </p>
            </div>
            <button
              onClick={() => setMobileTab("agents")}
              className="text-xs font-semibold text-[#4B9CD3] hover:underline"
            >
              View agents →
            </button>
          </div>

        </div>
      </div>
    </div>
  );
}
