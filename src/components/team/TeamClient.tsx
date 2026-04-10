"use client";

import type { FormEvent, KeyboardEvent } from "react";
import { useEffect, useMemo, useRef, useState } from "react";
import { motion } from "framer-motion";
import { useSearchParams } from "next/navigation";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { TOOL_LABELS } from "@/lib/agent-tools";
import {
  ArrowLeft,
  Bot,
  Check,
  Copy,
  Eye,
  Hash,
  Mail,
  MessageSquare,
  PanelLeftClose,
  PanelLeftOpen,
  Pencil,
  Send,
  Trash2,
  UserPlus,
  UsersRound,
  Wrench,
  X,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { Avatar } from "@/components/ui/Avatar";
import { Button } from "@/components/ui/Button";
import { Input, Textarea } from "@/components/ui/Input";
import { cn } from "@/lib/utils";
import { deriveInviteName } from "@/lib/team-invites";

interface TeamMember {
  id: string;
  name: string | null;
  displayName: string | null;
  email: string;
  image: string | null;
  role: string;
  lastSeen: string | null;
  sprintTasks: unknown[];
}

interface PendingInvite {
  id: string;
  userId: string;
  name: string | null;
  image: string | null;
  email: string;
  createdAt: string;
}

interface AIAgent {
  id: string;
  name: string;
  role: string;
  description: string | null;
  persona: string;
  duties: string;
  avatar: string | null;
  status: string;
  llmStatus: string;
  llmModel: string | null;
  llmThinkingMode: string;
  llmLastCheckedAt: string | null;
  llmLastError: string | null;
  createdById: string;
  createdAt: string;
  _count: { sprintTasks: number };
}

interface ConversationMemberSummary {
  kind: "user" | "agent";
  id: string;
  name: string;
  image: string | null;
  role?: string;
  email?: string;
  lastSeen?: string | null;
  status?: string;
  llmModel?: string | null;
  llmThinkingMode?: string;
  llmStatus?: string;
  llmLastCheckedAt?: string | null;
  llmLastError?: string | null;
}

interface ConversationSummary {
  id: string;
  type: "direct" | "group" | string;
  name: string | null;
  createdAt: string;
  updatedAt: string;
  members: ConversationMemberSummary[];
  latestMessage: {
    id: string;
    body: string;
    createdAt: string;
    sender: {
      kind: "user" | "agent";
      id: string;
      name: string;
      image: string | null;
    } | null;
  } | null;
}

interface ToolActivity {
  id: string;
  name: string;
  args: Record<string, unknown>;
  status: "running" | "done";
  result?: string;
}

interface ChatMessage {
  id: string;
  body: string;
  thinking?: string | null;
  thinkingEnabled?: boolean;
  isStreaming?: boolean;
  streamState?: "thinking" | "responding" | "using_tools";
  toolActivity?: ToolActivity[];
  retrievalSources?: Array<{
    kind: string;
    label: string;
    target: string;
    detail: string;
  }>;
  createdAt: string;
  sender: {
    kind: "user" | "agent";
    id: string;
    name: string;
    image: string | null;
  } | null;
}

interface AgentInspectorData {
  conversationId: string;
  readiness: {
    phase: "ready" | "offline" | "disconnected";
    canSend: boolean;
    label: string;
    detail: string;
  };
  agent: {
    id: string;
    name: string;
    role: string;
    status: string;
    llmStatus: string;
    llmModel: string | null;
    llmThinkingMode: string;
    llmLastCheckedAt: string | null;
    llmLastError: string | null;
    endpointConfigured: boolean;
  };
  context: {
    estimatedTokens: number;
    estimatedSystemPromptTokens: number;
    estimatedHistoryTokens: number;
    recentHistoryCount: number;
    historyWindowSize: number;
    knowledgeSources: Array<{
      id: string;
      label: string;
      description: string;
    }>;
  };
  payload: {
    currentUserName: string | null;
    systemPrompt: string;
    history: Array<{
      role: "user" | "assistant";
      content: string;
    }>;
    orgContext: string;
  };
}

interface ActiveSprint {
  id: string;
  name: string;
  status: string;
  startDate: string;
  endDate: string;
}

interface Props {
  currentUserId: string;
  users: TeamMember[];
  invites: PendingInvite[];
  agents: AIAgent[];
  initialConversations: ConversationSummary[];
  activeSprint: ActiveSprint | null;
}

const STATUS_COLORS = { online: "#22C55E", away: "#FBBA00", offline: "#505050" };
const STATUS_LABELS = { online: "Online", away: "Away", offline: "Offline" };

const chatMarkdownComponents = {
  p: ({ children }: { children?: React.ReactNode }) => (
    <p className="mb-2 last:mb-0 leading-5">{children}</p>
  ),
  strong: ({ children }: { children?: React.ReactNode }) => (
    <strong className="font-semibold text-[#F6F3EE]">{children}</strong>
  ),
  em: ({ children }: { children?: React.ReactNode }) => (
    <em className="italic text-[#DEDEDE]">{children}</em>
  ),
  h1: ({ children }: { children?: React.ReactNode }) => (
    <p className="mb-2 text-base font-bold text-[#F6F3EE]">{children}</p>
  ),
  h2: ({ children }: { children?: React.ReactNode }) => (
    <p className="mb-1.5 text-sm font-bold text-[#F6F3EE]">{children}</p>
  ),
  h3: ({ children }: { children?: React.ReactNode }) => (
    <p className="mb-1 text-sm font-semibold text-[#DEDEDE]">{children}</p>
  ),
  ul: ({ children }: { children?: React.ReactNode }) => (
    <ul className="mb-2 space-y-0.5 pl-4">{children}</ul>
  ),
  ol: ({ children }: { children?: React.ReactNode }) => (
    <ol className="mb-2 space-y-0.5 pl-4 list-decimal marker:text-[#8D877F]">{children}</ol>
  ),
  li: ({ children }: { children?: React.ReactNode }) => (
    <li className="leading-5 flex gap-2">
      <span className="mt-2 w-1 h-1 rounded-full bg-[#7EC8E3]/60 flex-shrink-0" />
      <span className="flex-1">{children}</span>
    </li>
  ),
  code: ({ className, children }: { className?: string; children?: React.ReactNode }) => {
    const isBlock = /language-/.test(className ?? "");
    if (isBlock) {
      return (
        <pre className="my-2 overflow-x-auto rounded-xl bg-[#0D0D0D] px-3 py-2 text-xs font-mono text-[#C8C8C8] leading-relaxed whitespace-pre border border-[rgba(255,255,255,0.08)]">
          <code>{children}</code>
        </pre>
      );
    }
    return (
      <code className="px-1.5 py-0.5 rounded bg-[rgba(126,200,227,0.12)] text-[#9FCBE0] text-xs font-mono border border-[rgba(126,200,227,0.18)]">
        {children}
      </code>
    );
  },
  blockquote: ({ children }: { children?: React.ReactNode }) => (
    <blockquote className="my-2 pl-3 border-l-2 border-[#7EC8E3]/40 text-[#CFC9C2] italic">{children}</blockquote>
  ),
  hr: () => <hr className="my-3 border-[rgba(255,255,255,0.08)]" />,
  a: ({ href, children }: { href?: string; children?: React.ReactNode }) => (
    <a href={href} target="_blank" rel="noopener noreferrer" className="text-[#9FCBE0] underline underline-offset-2 hover:text-[#7EC8E3]">
      {children}
    </a>
  ),
};

function getOnlineStatus(lastSeen: string | null): "online" | "away" | "offline" {
  if (!lastSeen) return "offline";
  const diff = Date.now() - new Date(lastSeen).getTime();
  if (diff < 5 * 60 * 1000) return "online";
  if (diff < 20 * 60 * 1000) return "away";
  return "offline";
}

function formatPreviewTime(iso: string) {
  const date = new Date(iso);
  const now = new Date();
  const sameDay = date.toDateString() === now.toDateString();
  return sameDay
    ? date.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })
    : date.toLocaleDateString([], { month: "short", day: "numeric" });
}

function formatMessageTime(iso: string) {
  return new Date(iso).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
}

function formatRelativeTime(iso: string | null) {
  if (!iso) return "Not checked yet";

  const diffMs = Date.now() - new Date(iso).getTime();
  const diffMinutes = Math.max(0, Math.round(diffMs / 60000));
  if (diffMinutes < 1) return "Just now";
  if (diffMinutes < 60) return `${diffMinutes}m ago`;
  const diffHours = Math.round(diffMinutes / 60);
  if (diffHours < 24) return `${diffHours}h ago`;
  const diffDays = Math.round(diffHours / 24);
  return `${diffDays}d ago`;
}

function formatThinkingMode(mode?: string) {
  if (mode === "always") return "Always";
  if (mode === "off") return "Off";
  return "Auto";
}

function formatContextMeter(estimatedTokens: number) {
  if (estimatedTokens < 1000) return "Light";
  if (estimatedTokens < 3000) return "Moderate";
  if (estimatedTokens < 6000) return "Heavy";
  return "Very heavy";
}

const MAX_CONTEXT_TOKENS = 128_000;

function formatTokensK(tokens: number): string {
  return `${(tokens / 1000).toFixed(1)}K`;
}

function RadialContextBar({ tokens, maxTokens = MAX_CONTEXT_TOKENS }: { tokens: number; maxTokens?: number }) {
  const pct = Math.min(1, tokens / maxTokens);
  const r = 7;
  const circumference = 2 * Math.PI * r;
  const offset = circumference * (1 - pct);
  const color =
    pct < 0.5 ? "#4ade80" : pct < 0.75 ? "#facc15" : pct < 0.9 ? "#f97316" : "#ef4444";
  return (
    <svg width="18" height="18" viewBox="0 0 20 20" style={{ transform: "rotate(-90deg)", flexShrink: 0 }}>
      <circle cx="10" cy="10" r={r} fill="none" stroke="rgba(255,255,255,0.1)" strokeWidth="2.5" />
      <circle
        cx="10"
        cy="10"
        r={r}
        fill="none"
        stroke={color}
        strokeWidth="2.5"
        strokeDasharray={circumference}
        strokeDashoffset={offset}
        strokeLinecap="round"
      />
    </svg>
  );
}

function getMemberDisplayName(member: TeamMember) {
  return member.displayName || member.name || member.email;
}

function getDirectConversationPartner(conversation: ConversationSummary, currentUserId: string) {
  return conversation.members.find((member) => member.id !== currentUserId) ?? null;
}

function getConversationLabel(conversation: ConversationSummary, currentUserId: string) {
  if (conversation.type === "group") {
    return conversation.name || "Untitled group";
  }

  return getDirectConversationPartner(conversation, currentUserId)?.name || "New conversation";
}

function getConversationSubtext(conversation: ConversationSummary, currentUserId: string) {
  if (conversation.type === "group") {
    return `${conversation.members.length} members`;
  }

  const partner = getDirectConversationPartner(conversation, currentUserId);
  if (partner?.kind === "agent") {
    return partner.llmStatus === "online"
      ? "LLM Brain Online"
      : partner.llmStatus === "offline"
        ? "LLM Brain Offline"
        : "LLM Brain Not Connected";
  }
  return "Direct message";
}

function getConversationAvatar(conversation: ConversationSummary, currentUserId: string) {
  if (conversation.type === "group") {
    return { name: conversation.name || "Group", image: null, kind: "group" as const };
  }

  const partner = getDirectConversationPartner(conversation, currentUserId);
  return {
    name: partner?.name || "Conversation",
    image: partner?.image || null,
    kind: partner?.kind || "user",
  };
}

function getPreviewText(conversation: ConversationSummary | undefined) {
  if (!conversation?.latestMessage) return "No messages yet";
  const senderName = conversation.latestMessage.sender?.name;
  return senderName
    ? `${senderName}: ${conversation.latestMessage.body}`
    : conversation.latestMessage.body;
}

function getAgentSidebarStatus(status?: string) {
  if (status === "online") {
    return {
      label: "Ready",
      description: "Configured and ready to chat",
      dot: "#22C55E",
      chipClassName: "border-[rgba(75,156,211,0.28)] bg-[rgba(75,156,211,0.16)] text-[#B9E4F6]",
      metaClassName: "text-[#7EC8E3]",
    };
  }

  if (status === "offline") {
    return {
      label: "Offline",
      description: "Connection needs attention",
      dot: "#EF4444",
      chipClassName: "border-[rgba(239,68,68,0.22)] bg-[rgba(239,68,68,0.12)] text-[#F5B4B4]",
      metaClassName: "text-[#F08B8B]",
    };
  }

  return {
    label: "Not Ready",
    description: "No LLM connection configured",
    dot: "#8D877F",
    chipClassName: "border-[rgba(255,255,255,0.08)] bg-[rgba(255,255,255,0.04)] text-[#B7B0A8]",
    metaClassName: "text-[#A39B92]",
  };
}

function OnlineDot({ status }: { status: "online" | "away" | "offline" }) {
  return (
    <span
      className={cn("block h-2.5 w-2.5 rounded-full border border-[#111111]", status === "online" && "animate-pulse")}
      style={{ backgroundColor: STATUS_COLORS[status] }}
    />
  );
}

function PresenceBadge({ status }: { status: "online" | "away" | "offline" }) {
  return (
    <span
      className="inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.14em]"
      style={{
        color: status === "online" ? "#B7F7C8" : status === "away" ? "#FFE08A" : "#B0AAA4",
        backgroundColor:
          status === "online"
            ? "rgba(34,197,94,0.14)"
            : status === "away"
              ? "rgba(251,186,0,0.14)"
              : "rgba(255,255,255,0.06)",
      }}
    >
      <OnlineDot status={status} />
      {STATUS_LABELS[status]}
    </span>
  );
}

function InviteMemberDialog({
  onClose,
  onInvited,
}: {
  onClose: () => void;
  onInvited: (invite: PendingInvite) => void;
}) {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    if (!email.trim()) return;

    setLoading(true);
    setError("");

    try {
      const response = await fetch("/api/invite", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim() }),
      });
      const data = await response.json();

      if (!response.ok) {
        setError(data.error ?? "Failed to send invite");
        return;
      }

      onInvited({
        id: data.invite.id,
        userId: `invite:${data.invite.id}`,
        name: deriveInviteName(data.invite.email),
        image: null,
        email: data.invite.email,
        createdAt: data.invite.createdAt,
      });
      onClose();
    } catch {
      setError("Something went wrong");
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
        className="relative w-full max-w-md rounded-3xl border border-[rgba(255,255,255,0.08)] bg-[#161616] p-6 shadow-2xl"
      >
        <div className="mb-5 flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[rgba(247,148,29,0.14)] text-[#F7941D]">
            <UserPlus size={18} />
          </div>
          <div>
            <h2 className="text-lg font-semibold text-[#F6F3EE]">Invite teammate</h2>
            <p className="text-sm text-[#8D877F]">They&apos;ll show up here as soon as they join.</p>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <Input
            type="email"
            label="Email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            icon={<Mail size={14} />}
            placeholder="teammate@company.com"
            autoFocus
          />
          {error ? <p className="text-sm text-[#EF4444]">{error}</p> : null}
          <div className="flex gap-2">
            <Button type="button" variant="secondary" className="flex-1" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" variant="primary" className="flex-1" loading={loading}>
              Send Invite
            </Button>
          </div>
        </form>
      </motion.div>
    </div>
  );
}

function NewGroupDialog({
  currentUserId,
  users,
  onClose,
  onCreated,
}: {
  currentUserId: string;
  users: TeamMember[];
  onClose: () => void;
  onCreated: (conversation: ConversationSummary) => void;
}) {
  const selectableUsers = users.filter((user) => user.id !== currentUserId);
  const [name, setName] = useState("");
  const [selectedUserIds, setSelectedUserIds] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  function toggleUser(userId: string) {
    setSelectedUserIds((current) =>
      current.includes(userId) ? current.filter((id) => id !== userId) : [...current, userId]
    );
  }

  async function handleCreate(event: FormEvent) {
    event.preventDefault();
    if (!name.trim()) {
      setError("Group name is required");
      return;
    }

    if (selectedUserIds.length === 0) {
      setError("Choose at least one teammate");
      return;
    }

    setLoading(true);
    setError("");

    try {
      const response = await fetch("/api/chat/conversations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: "group",
          name: name.trim(),
          memberUserIds: selectedUserIds,
        }),
      });
      const data = await response.json();

      if (!response.ok) {
        setError(data.error ?? "Failed to create group");
        return;
      }

      onCreated(data.conversation);
      onClose();
    } catch {
      setError("Unable to create the group right now");
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
        className="relative w-full max-w-lg rounded-3xl border border-[rgba(255,255,255,0.08)] bg-[#161616] p-6 shadow-2xl"
      >
        <div className="mb-5 flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[rgba(247,148,29,0.14)] text-[#F7941D]">
            <UsersRound size={18} />
          </div>
          <div>
            <h2 className="text-lg font-semibold text-[#F6F3EE]">Create named group</h2>
            <p className="text-sm text-[#8D877F]">Spin up a shared room for a project, topic, or team.</p>
          </div>
        </div>

        <form onSubmit={handleCreate} className="space-y-4">
          <Input
            label="Channel Name"
            value={name}
            onChange={(event) => setName(event.target.value)}
            placeholder="Product launch"
            autoFocus
          />

          <div>
            <p className="mb-2 text-xs font-semibold uppercase tracking-[0.22em] text-[#8D877F]">
              Add teammates
            </p>
            <div className="max-h-72 space-y-2 overflow-y-auto rounded-2xl border border-[rgba(255,255,255,0.06)] bg-[#111111] p-3">
              {selectableUsers.map((user) => {
                const checked = selectedUserIds.includes(user.id);
                const status = getOnlineStatus(user.lastSeen);
                const label = getMemberDisplayName(user);
                return (
                  <button
                    key={user.id}
                    type="button"
                    onClick={() => toggleUser(user.id)}
                    className={cn(
                      "flex w-full items-center gap-3 rounded-2xl border px-3 py-2.5 text-left transition-all",
                      checked
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
                      <p className="truncate text-sm font-medium text-[#F6F3EE]">{label}</p>
                      <p className="truncate text-xs text-[#8D877F]">{user.role}</p>
                    </div>
                    <span
                      className={cn(
                        "flex h-5 w-5 items-center justify-center rounded-full border text-[10px] font-semibold",
                        checked
                          ? "border-[rgba(247,148,29,0.4)] bg-[#F7941D] text-[#111111]"
                          : "border-[rgba(255,255,255,0.12)] text-[#8D877F]"
                      )}
                    >
                      {checked ? "✓" : ""}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          {error ? <p className="text-sm text-[#EF4444]">{error}</p> : null}
          <div className="flex gap-2">
            <Button type="button" variant="secondary" className="flex-1" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" variant="primary" className="flex-1" loading={loading}>
              Create Group
            </Button>
          </div>
        </form>
      </motion.div>
    </div>
  );
}

function ClearAgentContextDialog({
  agentName,
  loading,
  onClose,
  onConfirm,
}: {
  agentName: string;
  loading: boolean;
  onClose: () => void;
  onConfirm: () => Promise<void>;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />
      <motion.div
        initial={{ opacity: 0, y: 10, scale: 0.985 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        onClick={(event) => event.stopPropagation()}
        className="relative w-full max-w-md overflow-hidden rounded-3xl border border-[rgba(255,255,255,0.08)] bg-[#161616] shadow-2xl"
      >
        <div className="flex items-start justify-between gap-4 border-b border-[rgba(255,255,255,0.06)] px-6 py-5">
          <div className="min-w-0">
            <h2 className="text-lg font-semibold text-[#F6F3EE]">Clear chat history?</h2>
            <p className="mt-1 text-sm leading-6 text-[#8D877F]">
              This removes your current conversation with {agentName} so the next reply starts from a clean context.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-2xl border border-[rgba(255,255,255,0.08)] bg-[#181818] text-[#8D877F] transition-colors hover:text-[#F6F3EE]"
            aria-label="Close clear chat dialog"
          >
            <X size={15} />
          </button>
        </div>

        <div className="px-6 py-5">
          <div className="rounded-2xl border border-[rgba(255,255,255,0.06)] bg-[#111111] px-4 py-3">
            <p className="text-sm font-medium text-[#F6F3EE]">Only this chat is cleared</p>
            <p className="mt-1 text-sm leading-6 text-[#8D877F]">
              {agentName}&apos;s profile, tools, and setup stay the same. Previous messages just won&apos;t be included in future context.
            </p>
          </div>
        </div>

        <div className="flex justify-end gap-2 border-t border-[rgba(255,255,255,0.06)] bg-[rgba(255,255,255,0.01)] px-6 py-4">
          <Button type="button" variant="secondary" onClick={onClose}>
            Keep Chat
          </Button>
          <Button
            type="button"
            variant="secondary"
            loading={loading}
            onClick={() => void onConfirm()}
            className="border-[rgba(239,68,68,0.18)] bg-[rgba(239,68,68,0.08)] text-[#F3C1C1] hover:bg-[rgba(239,68,68,0.14)] hover:text-[#F8D4D4]"
          >
            Clear Chat
          </Button>
        </div>
      </motion.div>
    </div>
  );
}

function ContextInspectorDialog({
  data,
  copiedView,
  onClose,
  onCopyPretty,
  onCopyJson,
}: {
  data: AgentInspectorData;
  copiedView: "pretty" | "json" | null;
  onClose: () => void;
  onCopyPretty: () => void;
  onCopyJson: () => void;
}) {
  const rawJson = JSON.stringify(data, null, 2);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" />
      <motion.div
        initial={{ opacity: 0, y: 12, scale: 0.98 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        onClick={(event) => event.stopPropagation()}
        className="relative flex max-h-[90vh] w-full max-w-5xl flex-col overflow-hidden rounded-3xl border border-[rgba(75,156,211,0.18)] bg-[#161616] shadow-2xl"
      >
        <div className="flex items-center justify-between gap-3 border-b border-[rgba(255,255,255,0.06)] px-5 py-4">
          <div>
            <h2 className="text-lg font-semibold text-[#F6F3EE]">Agent Context Inspector</h2>
            <p className="text-sm text-[#8D877F]">Review readiness, context size, and the exact payload sent to the agent.</p>
          </div>
          <button
            onClick={onClose}
            className="flex h-10 w-10 items-center justify-center rounded-2xl border border-[rgba(255,255,255,0.08)] bg-[#181818] text-[#8D877F] transition-colors hover:text-[#F6F3EE]"
          >
            <X size={16} />
          </button>
        </div>

        <div className="grid min-h-0 flex-1 gap-0 md:grid-cols-[320px_minmax(0,1fr)]">
          <div className="border-b border-[rgba(255,255,255,0.06)] bg-[#131313] p-5 md:border-b-0 md:border-r">
            <div className="space-y-3">
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
                <p className="text-sm text-[#8D877F]">Estimated tokens currently loaded</p>
                <div className="mt-3 h-2 overflow-hidden rounded-full bg-[rgba(255,255,255,0.06)]">
                  <div
                    className="h-full rounded-full bg-[linear-gradient(90deg,#4B9CD3,#7EC8E3)]"
                    style={{ width: `${Math.min(100, Math.max(8, (data.context.estimatedTokens / MAX_CONTEXT_TOKENS) * 100))}%` }}
                  />
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
                <p className="mt-3 text-xs text-[#6F6A64]">
                  History loaded: {data.context.recentHistoryCount}/{data.context.historyWindowSize} turns
                </p>
              </div>

              <div className="rounded-2xl border border-[rgba(255,255,255,0.06)] bg-[#101010] p-4">
                <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[#8D877F]">Model</p>
                <p className="mt-2 text-sm font-semibold text-[#F6F3EE]">{data.agent.llmModel ?? "Unknown model"}</p>
                <p className="mt-1 text-sm text-[#8D877F]">Thinking mode: {formatThinkingMode(data.agent.llmThinkingMode)}</p>
                <p className="mt-1 text-sm text-[#8D877F]">Last checked: {formatRelativeTime(data.agent.llmLastCheckedAt)}</p>
              </div>
            </div>
          </div>

          <div className="min-h-0 overflow-y-auto p-5">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[#8D877F]">Knowledge Sources</p>
                <p className="mt-1 text-sm text-[#8D877F]">This is the RAG and prompt information currently bundled into the chat.</p>
              </div>
              <div className="flex gap-2">
                <Button variant="secondary" size="sm" icon={<Copy size={14} />} onClick={onCopyPretty}>
                  {copiedView === "pretty" ? "Copied Summary" : "Copy Summary"}
                </Button>
                <Button variant="secondary" size="sm" icon={<Copy size={14} />} onClick={onCopyJson}>
                  {copiedView === "json" ? "Copied JSON" : "Copy JSON"}
                </Button>
              </div>
            </div>

            <div className="mt-4 grid gap-3">
              {data.context.knowledgeSources.map((source) => (
                <div key={source.id} className="rounded-2xl border border-[rgba(255,255,255,0.06)] bg-[rgba(255,255,255,0.03)] p-4">
                  <p className="text-sm font-semibold text-[#F6F3EE]">{source.label}</p>
                  <p className="mt-1 text-sm leading-6 text-[#8D877F]">{source.description}</p>
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

function SidebarRow({
  active,
  icon,
  title,
  preview,
  meta,
  onClick,
  trailing,
}: {
  active: boolean;
  icon: React.ReactNode;
  title: string;
  preview: string;
  meta?: string | null;
  onClick: () => void;
  trailing?: React.ReactNode;
}) {
  return (
    <div
      onClick={onClick}
      className={cn(
        "flex items-center gap-2.5 rounded-2xl border px-2.5 py-1.5 transition-all cursor-pointer active:scale-[0.99]",
        active
          ? "border-[rgba(247,148,29,0.25)] bg-[linear-gradient(135deg,rgba(247,148,29,0.14),rgba(247,148,29,0.02))]"
          : "border-transparent bg-transparent hover:border-[rgba(255,255,255,0.06)] hover:bg-[rgba(255,255,255,0.03)]"
      )}
    >
      {icon}
      <div className="min-w-0 flex-1 text-left">
        <div className="flex items-center justify-between gap-2">
          <p className="truncate text-sm font-semibold text-[#F6F3EE]">{title}</p>
          {meta ? <span className="shrink-0 text-[11px] text-[#8D877F]">{meta}</span> : null}
        </div>
        <p className="mt-0.5 truncate text-[12px] text-[#8D877F]">{preview}</p>
      </div>
      {trailing}
    </div>
  );
}

export function TeamClient({
  currentUserId,
  users,
  invites,
  agents,
  initialConversations,
}: Props) {
  const router = useRouter();
  const [isDesktop, setIsDesktop] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia("(min-width: 768px)");
    setIsDesktop(mq.matches);
    const handler = (e: MediaQueryListEvent) => setIsDesktop(e.matches);
    mq.addEventListener("change", handler);
    return () => mq.removeEventListener("change", handler);
  }, []);
  const [members, setMembers] = useState(users);
  const [pendingInvites, setPendingInvites] = useState(invites);
  const [conversations, setConversations] = useState(initialConversations);
  const [selectedConversationId, setSelectedConversationId] = useState<string | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [messageInput, setMessageInput] = useState("");
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [sending, setSending] = useState(false);
  const [editingMessageId, setEditingMessageId] = useState<string | null>(null);
  const [editingDraft, setEditingDraft] = useState("");
  const [savingMessageId, setSavingMessageId] = useState<string | null>(null);
  const [deletingMessageId, setDeletingMessageId] = useState<string | null>(null);
  const [clearingConversation, setClearingConversation] = useState(false);
  const [showClearContextModal, setShowClearContextModal] = useState(false);
  const [showContextInspector, setShowContextInspector] = useState(false);
  const [openingDirectId, setOpeningDirectId] = useState<string | null>(null);
  const [bootstrappingConversationId, setBootstrappingConversationId] = useState<string | null>(null);
  const [agentInspector, setAgentInspector] = useState<AgentInspectorData | null>(null);
  const [agentInspectorLoading, setAgentInspectorLoading] = useState(false);
  const [agentInspectorError, setAgentInspectorError] = useState<string | null>(null);
  const [copiedMessageId, setCopiedMessageId] = useState<string | null>(null);
  const [copiedInspectorView, setCopiedInspectorView] = useState<"pretty" | "json" | null>(null);
  const [showInvite, setShowInvite] = useState(false);
  const [showNewGroup, setShowNewGroup] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const chatScrollRef = useRef<HTMLDivElement>(null);
  const isAtBottomRef = useRef(true);
  const userScrolledUpRef = useRef(false);
  const conversationsRef = useRef(conversations);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const hasStreamingAgentMessage = messages.some((message) => message.isStreaming);
  const searchParams = useSearchParams();

  // Auto-open agent chat from ?agent= query param (e.g. coming from /agents dashboard)
  useEffect(() => {
    const agentId = searchParams.get("agent");
    if (!agentId) return;
    setSidebarCollapsed(true);
    void openDirectConversation({ agentId });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  conversationsRef.current = conversations;

  function handleChatScroll() {
    const el = chatScrollRef.current;
    if (!el) return;
    const distanceFromBottom = el.scrollHeight - el.scrollTop - el.clientHeight;
    const atBottom = distanceFromBottom < 10;
    isAtBottomRef.current = distanceFromBottom < 120;
    if (atBottom) {
      userScrolledUpRef.current = false;
    } else {
      userScrolledUpRef.current = true;
    }
  }

  const currentUser = members.find((member) => member.id === currentUserId);
  const currentUserName = currentUser ? getMemberDisplayName(currentUser) : "You";

  useEffect(() => {
    function pingPresence() {
      fetch("/api/presence", { method: "PATCH" }).catch(() => { });
    }

    pingPresence();
    const interval = setInterval(pingPresence, 30_000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    async function refreshTeam() {
      try {
        const response = await fetch("/api/team");
        const data = await response.json();
        if (data.users) {
          setMembers(data.users);
        }
      } catch {
      }
    }

    const interval = setInterval(refreshTeam, 30_000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    async function refreshConversations() {
      try {
        const response = await fetch("/api/chat/conversations");
        const data = await response.json();
        if (data.conversations) {
          setConversations(data.conversations);
          setSelectedConversationId((current) => {
            if (current && data.conversations.some((conversation: ConversationSummary) => conversation.id === current)) {
              return current;
            }
            return null;
          });
        }
      } catch {
      }
    }

    const interval = setInterval(refreshConversations, 30_000);
    return () => clearInterval(interval);
  }, [isDesktop]);

  const activeConversation = useMemo(
    () => conversations.find((conversation) => conversation.id === selectedConversationId) ?? null,
    [conversations, selectedConversationId]
  );

  useEffect(() => {
    async function loadMessages() {
      if (!selectedConversationId) {
        setMessages([]);
        return;
      }

      setLoadingMessages(true);
      try {
        const response = await fetch(`/api/chat/conversations/${selectedConversationId}/messages`);
        const data = await response.json();
        if (data.messages) {
          setMessages(data.messages);
        }
        if (data.conversation) {
          setConversations((current) => {
            const others = current.filter((conversation) => conversation.id !== data.conversation.id);
            return [data.conversation, ...others].sort(
              (a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
            );
          });
        }
      } catch {
      } finally {
        setLoadingMessages(false);
      }
    }

    loadMessages();
  }, [selectedConversationId]);

  useEffect(() => {
    if (!selectedConversationId || hasStreamingAgentMessage) return;

    async function pollMessages() {
      try {
        const response = await fetch(`/api/chat/conversations/${selectedConversationId}/messages`);
        const data = await response.json();
        if (data.messages) {
          setMessages(data.messages);
        }
      } catch {
      }
    }

    const interval = setInterval(pollMessages, 3_000);
    return () => clearInterval(interval);
  }, [selectedConversationId, hasStreamingAgentMessage]);

  useEffect(() => {
    if (!userScrolledUpRef.current && isAtBottomRef.current) {
      bottomRef.current?.scrollIntoView({ behavior: "instant" });
    }
  }, [messages]);

  useEffect(() => {
    isAtBottomRef.current = true;
    userScrolledUpRef.current = false;
    bottomRef.current?.scrollIntoView({ behavior: "instant" });
    setEditingMessageId(null);
    setEditingDraft("");
    setShowContextInspector(false);
  }, [selectedConversationId]);

  useEffect(() => {
    async function inspectActiveAgentConversation() {
      if (!selectedConversationId) {
        setAgentInspector(null);
        setAgentInspectorError(null);
        setAgentInspectorLoading(false);
        return;
      }

      const convo = conversationsRef.current.find((conversation) => conversation.id === selectedConversationId);
      const isAgentConversation = convo?.type === "direct" && convo.members.some((member) => member.kind === "agent");

      if (!isAgentConversation) {
        setAgentInspector(null);
        setAgentInspectorError(null);
        setAgentInspectorLoading(false);
        return;
      }

      setAgentInspectorLoading(true);
      setAgentInspectorError(null);

      try {
        const response = await fetch(`/api/chat/conversations/${selectedConversationId}/inspect`);
        const data = await response.json();

        if (!response.ok) {
          setAgentInspector(null);
          setAgentInspectorError(data.error ?? "Failed to initialize the agent");
          return;
        }

        setAgentInspector(data);
        setConversations((current) =>
          current.map((conversation) => {
            if (conversation.id !== selectedConversationId) return conversation;

            return {
              ...conversation,
              members: conversation.members.map((member) =>
                member.kind === "agent"
                  ? {
                      ...member,
                      llmStatus: data.agent.llmStatus,
                      llmModel: data.agent.llmModel,
                      llmThinkingMode: data.agent.llmThinkingMode,
                      llmLastCheckedAt: data.agent.llmLastCheckedAt,
                      llmLastError: data.agent.llmLastError,
                    }
                  : member
              ),
            };
          })
        );
      } catch {
        setAgentInspector(null);
        setAgentInspectorError("Unable to initialize the agent right now");
      } finally {
        setAgentInspectorLoading(false);
        setBootstrappingConversationId((current) => (current === selectedConversationId ? null : current));
      }
    }

    void inspectActiveAgentConversation();
  }, [selectedConversationId]);

  const groupConversations = useMemo(
    () =>
      conversations
        .filter((conversation) => conversation.type === "group")
        .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()),
    [conversations]
  );

  const directConversationByUserId = useMemo(() => {
    const map = new Map<string, ConversationSummary>();
    for (const conversation of conversations) {
      if (conversation.type !== "direct") continue;
      const partner = getDirectConversationPartner(conversation, currentUserId);
      if (partner?.kind === "user") {
        map.set(partner.id, conversation);
      }
    }
    return map;
  }, [conversations, currentUserId]);

  const directConversationByAgentId = useMemo(() => {
    const map = new Map<string, ConversationSummary>();
    for (const conversation of conversations) {
      if (conversation.type !== "direct") continue;
      const partner = getDirectConversationPartner(conversation, currentUserId);
      if (partner?.kind === "agent") {
        map.set(partner.id, conversation);
      }
    }
    return map;
  }, [conversations, currentUserId]);

  const onlineCount = members.filter((member) => member.id === currentUserId || getOnlineStatus(member.lastSeen) === "online").length;

  async function openDirectConversation(target: { userId?: string; agentId?: string }) {
    const targetId = target.userId ?? target.agentId ?? "";

    const existingConversation = target.userId
      ? directConversationByUserId.get(target.userId)
      : target.agentId
        ? directConversationByAgentId.get(target.agentId)
        : undefined;

    if (existingConversation) {
      if (target.agentId) {
        setBootstrappingConversationId(existingConversation.id);
      }
      setSelectedConversationId(existingConversation.id);
      return;
    }

    setOpeningDirectId(targetId);
    try {
      const response = await fetch("/api/chat/conversations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: "direct",
          ...(target.userId ? { userId: target.userId } : {}),
          ...(target.agentId ? { agentId: target.agentId } : {}),
        }),
      });
      const data = await response.json();
      if (data.conversation) {
        if (target.agentId) {
          setBootstrappingConversationId(data.conversation.id);
        }
        setConversations((current) => {
          const others = current.filter((conversation) => conversation.id !== data.conversation.id);
          return [data.conversation, ...others].sort(
            (a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
          );
        });
        setSelectedConversationId(data.conversation.id);
      }
    } finally {
      setOpeningDirectId(null);
    }
  }

  async function sendCurrentMessage() {
    if (!selectedConversationId || !messageInput.trim() || sending) return;
    if (activeAgentSendBlocked) return;

    const text = messageInput.trim();
    const isAgentConversation = activePartner?.kind === "agent";
    const optimisticMessage: ChatMessage = {
      id: `temp-${Date.now()}`,
      body: text,
      createdAt: new Date().toISOString(),
      sender: {
        kind: "user",
        id: currentUserId,
        name: currentUserName,
        image: currentUser?.image ?? null,
      },
    };

    const optimisticAgentMessage: ChatMessage | null = isAgentConversation
      ? {
        id: `temp-agent-${Date.now()}`,
        body: "",
        thinking: "",
        isStreaming: true,
        streamState: "thinking",
        createdAt: new Date().toISOString(),
        sender: {
          kind: "agent",
          id: activePartner.id,
          name: activePartner.name,
          image: activePartner.image ?? null,
        },
      }
      : null;

    setMessageInput("");
    setSending(true);
    setMessages((current) => [...current, optimisticMessage, ...(optimisticAgentMessage ? [optimisticAgentMessage] : [])]);

    try {
      const response = await fetch(`/api/chat/conversations/${selectedConversationId}/messages`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: text, stream: isAgentConversation }),
      });

      const contentType = response.headers.get("content-type") ?? "";
      if (isAgentConversation && contentType.includes("application/x-ndjson") && response.body && optimisticAgentMessage) {
        const reader = response.body.getReader();
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

            const event = JSON.parse(trimmed) as
              | { type: "thinking_delta"; delta: string }
              | { type: "content_delta"; delta: string }
              | { type: "done"; model: string }
              | { type: "meta"; thinking: boolean }
              | { type: "retrieval"; sources: NonNullable<ChatMessage["retrievalSources"]> }
              | { type: "tool_call"; id: string; name: string; args: Record<string, unknown> }
              | { type: "tool_result"; id: string; name: string; result: string }
              | { type: "final_messages"; messages: ChatMessage[]; retrievalSources?: NonNullable<ChatMessage["retrievalSources"]> };

            if (event.type === "thinking_delta") {
              setMessages((current) =>
                current.map((message) =>
                  message.id === optimisticAgentMessage.id
                    ? {
                      ...message,
                      thinking: `${message.thinking ?? ""}${event.delta}`,
                      isStreaming: true,
                      streamState: "thinking",
                    }
                    : message
                )
              );
            }

            if (event.type === "meta") {
              setMessages((current) =>
                current.map((message) =>
                  message.id === optimisticAgentMessage.id
                    ? {
                        ...message,
                        thinkingEnabled: event.thinking,
                      }
                    : message
                )
              );
            }

            if (event.type === "content_delta") {
              setMessages((current) =>
                current.map((message) =>
                  message.id === optimisticAgentMessage.id
                    ? {
                      ...message,
                      body: `${message.body}${event.delta}`,
                      isStreaming: true,
                      streamState: "responding",
                    }
                    : message
                )
              );
            }

            if (event.type === "retrieval") {
              setMessages((current) =>
                current.map((message) =>
                  message.id === optimisticAgentMessage.id
                    ? {
                        ...message,
                        retrievalSources: event.sources,
                      }
                    : message
                )
              );
            }

            if (event.type === "tool_call") {
              setMessages((current) =>
                current.map((message) =>
                  message.id === optimisticAgentMessage.id
                    ? {
                        ...message,
                        streamState: "using_tools",
                        toolActivity: [
                          ...(message.toolActivity ?? []),
                          { id: event.id, name: event.name, args: event.args, status: "running" as const },
                        ],
                      }
                    : message
                )
              );
            }

            if (event.type === "tool_result") {
              setMessages((current) =>
                current.map((message) =>
                  message.id === optimisticAgentMessage.id
                    ? {
                        ...message,
                        toolActivity: (message.toolActivity ?? []).map((t) =>
                          t.id === event.id
                            ? { ...t, status: "done" as const, result: event.result }
                            : t
                        ),
                      }
                    : message
                )
              );
            }

            if (event.type === "final_messages") {
              setMessages((current) => {
                const optimisticAgent = current.find((message) => message.id === optimisticAgentMessage.id);
                return [
                  ...current.filter((message) => message.id !== optimisticMessage.id && message.id !== optimisticAgentMessage.id),
                  ...event.messages.map((message) =>
                    message.sender?.kind === "agent"
                      ? {
                          ...message,
                          retrievalSources: event.retrievalSources ?? optimisticAgent?.retrievalSources,
                          toolActivity: optimisticAgent?.toolActivity,
                        }
                      : message
                  ),
                ];
              });
            }
          }
        }
      } else {
        const data = await response.json();

        if (data.messages) {
          setMessages((current) => [
            ...current.filter((message) => message.id !== optimisticMessage.id && message.id !== optimisticAgentMessage?.id),
            ...data.messages.map((message: ChatMessage) =>
              message.sender?.kind === "agent"
                ? {
                    ...message,
                    retrievalSources: data.retrievalSources ?? [],
                  }
                : message
            ),
          ]);
        }
      }

      const conversationResponse = await fetch("/api/chat/conversations");
      const conversationData = await conversationResponse.json();
      if (conversationData.conversations) {
        setConversations(conversationData.conversations);
      }

      if (isAgentConversation) {
        fetch(`/api/chat/conversations/${selectedConversationId}/inspect`)
          .then((res) => res.json())
          .then((data) => {
            if (data?.conversationId) {
              setAgentInspector(data);
            }
          })
          .catch(() => { });
      }
    } catch {
      setMessages((current) =>
        current.map((message) =>
          message.id === optimisticMessage.id
            ? { ...message, body: `${message.body}\n\n(Delivery pending)` }
            : message
        )
      );
    } finally {
      setSending(false);
    }
  }

  async function handleSendMessage(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    await sendCurrentMessage();
  }

  async function refreshConversationData() {
    if (!selectedConversationId) return;

    try {
      const [messagesResponse, conversationsResponse] = await Promise.all([
        fetch(`/api/chat/conversations/${selectedConversationId}/messages`),
        fetch("/api/chat/conversations"),
      ]);
      const [messagesData, conversationsData] = await Promise.all([
        messagesResponse.json(),
        conversationsResponse.json(),
      ]);

      if (messagesData.messages) {
        setMessages(messagesData.messages);
      }
      if (conversationsData.conversations) {
        setConversations(conversationsData.conversations);
      }
    } catch {
    }
  }

  function startEditingMessage(message: ChatMessage) {
    setEditingMessageId(message.id);
    setEditingDraft(message.body);
  }

  function cancelEditingMessage() {
    setEditingMessageId(null);
    setEditingDraft("");
  }

  async function saveEditedMessage(messageId: string) {
    if (!selectedConversationId || !editingDraft.trim() || savingMessageId) return;

    const nextBody = editingDraft.trim();
    const previousMessages = messages;
    setSavingMessageId(messageId);
    setMessages((current) =>
      current.map((message) =>
        message.id === messageId ? { ...message, body: nextBody } : message
      )
    );

    try {
      const response = await fetch(`/api/chat/conversations/${selectedConversationId}/messages/${messageId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: nextBody }),
      });
      const data = await response.json();

      if (!response.ok) {
        setMessages(previousMessages);
        return;
      }

      if (data.message) {
        setMessages((current) =>
          current.map((message) => (message.id === messageId ? data.message : message))
        );
      }
      cancelEditingMessage();
      await refreshConversationData();
    } catch {
      setMessages(previousMessages);
    } finally {
      setSavingMessageId(null);
    }
  }

  async function deleteMessage(messageId: string) {
    if (!selectedConversationId || deletingMessageId) return;

    const previousMessages = messages;
    setDeletingMessageId(messageId);
    setMessages((current) => current.filter((message) => message.id !== messageId));

    try {
      const response = await fetch(`/api/chat/conversations/${selectedConversationId}/messages/${messageId}`, {
        method: "DELETE",
      });

      if (!response.ok) {
        setMessages(previousMessages);
        return;
      }

      if (editingMessageId === messageId) {
        cancelEditingMessage();
      }
      await refreshConversationData();
    } catch {
      setMessages(previousMessages);
    } finally {
      setDeletingMessageId(null);
    }
  }

  async function clearAgentConversation() {
    if (!selectedConversationId || !activePartner || activePartner.kind !== "agent" || clearingConversation) {
      return;
    }

    setClearingConversation(true);
    try {
      const response = await fetch(`/api/chat/conversations/${selectedConversationId}/messages`, {
        method: "DELETE",
      });

      if (!response.ok) {
        return;
      }

      setMessages([]);
      setShowClearContextModal(false);
      await refreshConversationData();
    } finally {
      setClearingConversation(false);
    }
  }

  async function copyToClipboard(value: string, kind: "message" | "pretty" | "json", id?: string) {
    try {
      await navigator.clipboard.writeText(value);
      if (kind === "message" && id) {
        setCopiedMessageId(id);
        window.setTimeout(() => setCopiedMessageId((current) => (current === id ? null : current)), 1600);
        return;
      }

      if (kind !== "message") {
        setCopiedInspectorView(kind);
        window.setTimeout(() => setCopiedInspectorView((current) => (current === kind ? null : current)), 1600);
      }
    } catch {
    }
  }

  const inspectorPrettyText = agentInspector
    ? [
        `Agent: ${agentInspector.agent.name} (${agentInspector.agent.role})`,
        `Status: ${agentInspector.readiness.label}`,
        `Model: ${agentInspector.agent.llmModel ?? "Unknown"}`,
        `Thinking mode: ${formatThinkingMode(agentInspector.agent.llmThinkingMode)}`,
        `Context: ${formatTokensK(agentInspector.context.estimatedTokens)} / 128K (${formatContextMeter(agentInspector.context.estimatedTokens)})`,
        `History: ${agentInspector.context.recentHistoryCount}/${agentInspector.context.historyWindowSize} turns loaded`,
        "",
        "Knowledge sources:",
        ...agentInspector.context.knowledgeSources.map((source) => `- ${source.label}: ${source.description}`),
        "",
        "Org context:",
        agentInspector.payload.orgContext,
        "",
        "System prompt:",
        agentInspector.payload.systemPrompt,
      ].join("\n")
    : "";

  const activeConversationAvatar = activeConversation
    ? getConversationAvatar(activeConversation, currentUserId)
    : null;
  const activePartner =
    activeConversation?.type === "direct"
      ? getDirectConversationPartner(activeConversation, currentUserId)
      : null;
  const activeAgentBootstrapPending =
    activePartner?.kind === "agent"
      && (agentInspectorLoading || bootstrappingConversationId === selectedConversationId);
  const activeAgentReady =
    activePartner?.kind === "agent"
      ? Boolean(agentInspector?.readiness.canSend)
      : true;
  const activeAgentSendBlocked =
    activePartner?.kind === "agent" && (!activeAgentReady || activeAgentBootstrapPending);
  const activeAgentStatusLabel =
    activePartner?.kind === "agent"
      ? activeAgentBootstrapPending
        ? "Initializing agent"
        : agentInspector?.readiness.label || getConversationSubtext(activeConversation!, currentUserId)
      : null;

  return (
    <div className="-mx-4 -mt-4 flex flex-col overflow-hidden h-[calc(100dvh-5rem)] md:mx-auto md:mt-0 md:max-w-7xl md:gap-4 md:h-[calc(100dvh-4.75rem)]">
      <div className="hidden md:flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-black text-[#F0F0F0] flex items-center gap-3">
            <UsersRound size={22} className="text-[#F7941D]" />
            Team Chat
          </h1>
          <p className="mt-0.5 text-sm text-[#606060]">
            {members.length + agents.length} active teammates and agents
            {onlineCount > 0 ? (
              <span className="ml-2 text-[#22C55E]">{onlineCount} online now</span>
            ) : null}
          </p>
        </div>
      </div>

      <div className="flex-1 min-h-0 overflow-hidden md:rounded-[28px] border-t md:border border-[rgba(255,255,255,0.06)] bg-[radial-gradient(circle_at_top_left,rgba(247,148,29,0.08),transparent_28%),linear-gradient(180deg,#171717,#111111)] md:shadow-[0_24px_80px_rgba(0,0,0,0.35)]">
        <div className={cn("grid h-full", sidebarCollapsed ? "md:grid-cols-[64px_minmax(0,1fr)]" : "md:grid-cols-[280px_minmax(0,1fr)]")}>
          <aside className={cn("bg-[#121212] flex flex-col min-h-0 md:border-r md:border-[rgba(255,255,255,0.06)]", activeConversation ? "hidden md:flex" : "flex")}>
            {/* ── Collapsed icon rail — desktop only ── */}
            {sidebarCollapsed && (
              <div className="hidden md:flex md:flex-col md:h-full">
                <div className="border-b border-[rgba(255,255,255,0.06)] flex items-center justify-center py-4 md:py-[18px]">
                  <button
                    onClick={() => setSidebarCollapsed(false)}
                    className="flex h-9 w-9 items-center justify-center rounded-xl bg-[rgba(255,255,255,0.06)] text-[#9A9A9A] hover:text-[#F0F0F0] hover:bg-[rgba(255,255,255,0.1)] transition-all"
                    title="Expand sidebar"
                  >
                    <PanelLeftOpen size={17} />
                  </button>
                </div>
                <div className="flex-1 overflow-y-auto py-3 min-h-0 flex flex-col items-center gap-2 px-2">
                  {groupConversations.map((conversation) => (
                    <button
                      key={conversation.id}
                      onClick={() => setSelectedConversationId(conversation.id)}
                      title={getConversationLabel(conversation, currentUserId)}
                      className={cn(
                        "flex h-10 w-10 items-center justify-center rounded-2xl border transition-all",
                        conversation.id === selectedConversationId
                          ? "border-[rgba(247,148,29,0.5)] bg-[rgba(247,148,29,0.22)]"
                          : "border-transparent bg-[rgba(247,148,29,0.1)] hover:bg-[rgba(247,148,29,0.18)]"
                      )}
                    >
                      <Hash size={17} className="text-[#F7941D]" />
                    </button>
                  ))}

                  {groupConversations.length > 0 && (
                    <div className="w-8 h-px bg-[rgba(255,255,255,0.07)]" />
                  )}

                  {members
                    .filter((member) => member.id !== currentUserId)
                    .map((member) => {
                      const conversation = directConversationByUserId.get(member.id);
                      const status = getOnlineStatus(member.lastSeen);
                      const label = getMemberDisplayName(member);
                      return (
                        <button
                          key={member.id}
                          onClick={() => void openDirectConversation({ userId: member.id })}
                          title={label}
                          className={cn(
                            "relative rounded-full transition-all outline-none",
                            conversation?.id === selectedConversationId
                              ? "ring-2 ring-[rgba(247,148,29,0.6)] ring-offset-1 ring-offset-[#121212]"
                              : "hover:ring-2 hover:ring-[rgba(255,255,255,0.15)] hover:ring-offset-1 hover:ring-offset-[#121212]"
                          )}
                        >
                          <Avatar src={member.image} name={label} size="sm" />
                          <span className="absolute -bottom-0.5 -right-0.5">
                            <OnlineDot status={status} />
                          </span>
                        </button>
                      );
                    })}

                  {members.filter((m) => m.id !== currentUserId).length > 0 && agents.length > 0 && (
                    <div className="w-8 h-px bg-[rgba(255,255,255,0.07)]" />
                  )}

                  {agents.map((agent) => {
                    const conversation = directConversationByAgentId.get(agent.id);
                    const agentStatus = getAgentSidebarStatus(agent.llmStatus);
                    return (
                      <button
                        key={agent.id}
                        onClick={() => void openDirectConversation({ agentId: agent.id })}
                        title={agent.name}
                        className={cn(
                          "relative flex h-10 w-10 shrink-0 items-center justify-center rounded-[18px] border transition-all overflow-hidden",
                          conversation?.id === selectedConversationId
                            ? "border-[rgba(75,156,211,0.7)] bg-[rgba(75,156,211,0.28)]"
                            : "border-[rgba(75,156,211,0.28)] bg-[rgba(75,156,211,0.1)] hover:bg-[rgba(75,156,211,0.2)]"
                        )}
                      >
                        {agent.avatar
                          ? (agent.avatar.startsWith("data:") || agent.avatar.startsWith("https://"))
                            ? <img src={agent.avatar} alt={agent.name} className="w-full h-full object-cover" />
                            : <span className="text-sm">{agent.avatar}</span>
                          : <Bot size={16} className="text-[#7EC8E3]" />}
                        <span
                          className="absolute bottom-0.5 right-0.5 h-2.5 w-2.5 rounded-full border-2 border-[#121212]"
                          style={{ backgroundColor: agentStatus.dot }}
                        />
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {/* ── Expanded full sidebar — always on mobile, desktop when not collapsed ── */}
            <div className={cn("flex flex-col h-full", sidebarCollapsed ? "md:hidden" : "")}>
                <div className="border-b border-[rgba(255,255,255,0.06)] px-4 py-4 md:py-[18px] flex items-center justify-between">
                  <h2 className="text-xl font-bold text-[#F6F3EE]">Chat</h2>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => setShowNewGroup(true)}
                      className="flex h-9 w-9 items-center justify-center rounded-xl bg-[rgba(255,255,255,0.06)] text-[#9A9A9A] hover:text-[#F0F0F0] hover:bg-[rgba(255,255,255,0.1)] transition-all"
                      title="New Group"
                    >
                      <UsersRound size={17} />
                    </button>
                    <button
                      onClick={() => setShowInvite(true)}
                      className="flex h-9 w-9 items-center justify-center rounded-xl bg-[rgba(255,255,255,0.06)] text-[#9A9A9A] hover:text-[#F0F0F0] hover:bg-[rgba(255,255,255,0.1)] transition-all"
                      title="Invite Member"
                    >
                      <UserPlus size={17} />
                    </button>
                    <button
                      onClick={() => setSidebarCollapsed(true)}
                      className="flex h-9 w-9 items-center justify-center rounded-xl bg-[rgba(255,255,255,0.06)] text-[#9A9A9A] hover:text-[#F0F0F0] hover:bg-[rgba(255,255,255,0.1)] transition-all"
                      title="Collapse sidebar"
                    >
                      <PanelLeftClose size={17} />
                    </button>
                  </div>
                </div>

                <div className="flex-1 space-y-4 overflow-y-auto px-3 py-3 min-h-0">
                  <section>
                    <div className="mb-2 flex items-center justify-between px-2">
                      <p className="text-xs font-semibold uppercase tracking-[0.22em] text-[#8D877F]">Channels</p>
                      <button
                        onClick={() => setShowNewGroup(true)}
                        className="text-xs font-medium text-[#F7941D] transition-colors hover:text-[#FDBA4D]"
                      >
                        New Group
                      </button>
                    </div>
                    <div className="space-y-1.5">
                      {groupConversations.length > 0 ? (
                        groupConversations.map((conversation) => (
                          <SidebarRow
                            key={conversation.id}
                            active={conversation.id === selectedConversationId}
                            icon={
                              <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-[rgba(247,148,29,0.14)] text-[#F7941D]">
                                <Hash size={18} />
                              </div>
                            }
                            title={getConversationLabel(conversation, currentUserId)}
                            preview={getPreviewText(conversation)}
                            meta={conversation.latestMessage ? formatPreviewTime(conversation.latestMessage.createdAt) : null}
                            onClick={() => setSelectedConversationId(conversation.id)}
                          />
                        ))
                      ) : (
                        <div className="px-2 py-2">
                          <p className="text-sm text-[#6F6A64]">No group channels yet.</p>
                        </div>
                      )}
                    </div>
                  </section>

                  <section>
                    <p className="mb-2 px-2 text-xs font-semibold uppercase tracking-[0.22em] text-[#8D877F]">Humans</p>
                    <div className="space-y-1.5">
                      {members
                        .filter((member) => member.id !== currentUserId)
                        .map((member) => {
                          const conversation = directConversationByUserId.get(member.id);
                          const status = getOnlineStatus(member.lastSeen);
                          const label = getMemberDisplayName(member);
                          return (
                            <SidebarRow
                              key={member.id}
                              active={conversation?.id === selectedConversationId}
                              icon={
                                <div className="relative">
                                  <Avatar src={member.image} name={label} size="sm" />
                                  <span className="absolute -bottom-0.5 -right-0.5">
                                    <OnlineDot status={status} />
                                  </span>
                                </div>
                              }
                              title={label}
                              preview={getPreviewText(conversation)}
                              meta={conversation?.latestMessage ? formatPreviewTime(conversation.latestMessage.createdAt) : null}
                              onClick={() => openDirectConversation({ userId: member.id })}
                              trailing={
                                openingDirectId === member.id ? (
                                  <div className="h-4 w-4 rounded-full border-2 border-[rgba(247,148,29,0.25)] border-t-[#F7941D] animate-spin" />
                                ) : null
                              }
                            />
                          );
                        })}
                    </div>
                  </section>

                  <section>
                    <p className="mb-2 px-2 text-xs font-semibold uppercase tracking-[0.22em] text-[#8D877F]">AI Agents</p>
                    <div className="space-y-1.5">
                      {agents.map((agent) => {
                        const conversation = directConversationByAgentId.get(agent.id);
                        const agentStatus = getAgentSidebarStatus(agent.llmStatus);
                        return (
                          <div
                            key={agent.id}
                            onClick={() => void openDirectConversation({ agentId: agent.id })}
                            className={cn(
                              "rounded-2xl border px-2.5 py-2 transition-all cursor-pointer active:scale-[0.99]",
                              conversation?.id === selectedConversationId
                                ? "border-[rgba(75,156,211,0.38)] bg-[linear-gradient(135deg,rgba(75,156,211,0.22),rgba(75,156,211,0.06))] shadow-[0_0_0_1px_rgba(75,156,211,0.08)_inset]"
                                : "border-transparent bg-transparent hover:border-[rgba(75,156,211,0.16)] hover:bg-[rgba(75,156,211,0.06)]"
                            )}
                          >
                            <div className="flex items-center gap-2.5">
                              <div className="relative">
                                <div className="flex h-10 w-10 items-center justify-center rounded-[18px] border border-[rgba(75,156,211,0.34)] bg-[linear-gradient(180deg,rgba(75,156,211,0.18),rgba(75,156,211,0.08))] text-[#A9DCF3] shadow-[0_8px_24px_rgba(75,156,211,0.12)] overflow-hidden">
                                  {agent.avatar
                                    ? (agent.avatar.startsWith("data:") || agent.avatar.startsWith("https://"))
                                      ? <img src={agent.avatar} alt={agent.name} className="w-full h-full object-cover" />
                                      : <span className="text-sm">{agent.avatar}</span>
                                    : <Bot size={16} />}
                                </div>
                                <span
                                  className="absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full border-2 border-[#121212]"
                                  style={{ backgroundColor: agentStatus.dot }}
                                />
                              </div>

                              <div className="min-w-0 flex-1">
                                <div className="flex items-start justify-between gap-2">
                                  <div className="min-w-0">
                                    <div className="flex items-center gap-2">
                                      <p className="truncate text-[13px] font-semibold text-[#F6F3EE]">{agent.name}</p>
                                      <span className="rounded-full border border-[rgba(75,156,211,0.18)] bg-[rgba(75,156,211,0.1)] px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-[0.2em] text-[#7EC8E3]">
                                        AI
                                      </span>
                                    </div>
                                    <p className="mt-0.5 truncate text-[10px] uppercase tracking-[0.18em] text-[#6FAFD2]">
                                      {agent.role}
                                    </p>
                                  </div>
                                  <div className="flex items-center gap-2">
                                    {conversation?.latestMessage ? (
                                      <span className="shrink-0 text-[11px] text-[#8D877F]">
                                        {formatPreviewTime(conversation.latestMessage.createdAt)}
                                      </span>
                                    ) : null}
                                    {openingDirectId === agent.id ? (
                                      <div className="h-4 w-4 rounded-full border-2 border-[rgba(75,156,211,0.25)] border-t-[#4B9CD3] animate-spin" />
                                    ) : null}
                                  </div>
                                </div>

                                <div className="mt-1.5">
                                  <p className="min-w-0 truncate text-[12px] text-[#8D877F]">
                                    {getPreviewText(conversation) || agentStatus.description}
                                  </p>
                                </div>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </section>

                  {pendingInvites.length > 0 ? (
                    <section>
                      <p className="mb-2 px-2 text-xs font-semibold uppercase tracking-[0.22em] text-[#8D877F]">Pending Invites</p>
                      <div className="space-y-1.5">
                        {pendingInvites.map((invite) => (
                          <div
                            key={invite.id}
                            className="flex items-center gap-3 rounded-2xl border border-[rgba(255,255,255,0.04)] bg-[rgba(255,255,255,0.02)] px-3 py-2.5 transition-all hover:border-[rgba(255,255,255,0.08)]"
                          >
                            <Avatar src={invite.image} name={invite.name ?? invite.email} size="md" className="opacity-70" />
                            <button
                              onClick={() => router.push(`/profile/${encodeURIComponent(invite.userId)}`)}
                              className="min-w-0 flex-1 text-left"
                            >
                              <p className="truncate text-sm font-medium text-[#D9D4CC]">
                                {invite.name ?? deriveInviteName(invite.email)}
                              </p>
                              <p className="truncate text-xs text-[#8D877F]">{invite.email}</p>
                            </button>
                            <span className="rounded-full bg-[rgba(255,255,255,0.04)] px-2 py-0.5 text-[11px] text-[#8D877F]">
                              Invited
                            </span>
                          </div>
                        ))}
                      </div>
                    </section>
                  ) : null}
                </div>
            </div>
          </aside>

          <section className={cn("flex min-h-0 flex-col overflow-hidden", !activeConversation ? "hidden md:flex" : "flex")}>
            {activeConversation ? (
              <>
                <div className="shrink-0 flex items-center justify-between gap-3 border-b border-[rgba(255,255,255,0.06)] px-3 py-2.5 md:px-5 md:py-3">
                  <div className="flex min-w-0 items-center gap-3">
                    <button
                      onClick={() => setSelectedConversationId(null)}
                      className="flex h-10 w-10 items-center justify-center rounded-2xl border border-[rgba(255,255,255,0.07)] bg-[#181818] text-[#8D877F] md:hidden"
                    >
                      <ArrowLeft size={18} />
                    </button>

                    {activeConversationAvatar?.kind === "group" ? (
                      <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[rgba(247,148,29,0.14)] text-[#F7941D]">
                        <Hash size={20} />
                      </div>
                    ) : activeConversationAvatar?.kind === "agent" ? (
                      <div className="flex h-12 w-12 items-center justify-center rounded-2xl border border-[rgba(75,156,211,0.3)] bg-[rgba(75,156,211,0.16)] text-[#7EC8E3] overflow-hidden">
                        {activeConversationAvatar.image
                          ? (activeConversationAvatar.image.startsWith("data:") || activeConversationAvatar.image.startsWith("https://"))
                            ? <img src={activeConversationAvatar.image} alt={activeConversationAvatar.name} className="w-full h-full object-cover" />
                            : <span className="text-lg">{activeConversationAvatar.image}</span>
                          : <Bot size={20} />}
                      </div>
                    ) : (
                      <Avatar src={activeConversationAvatar?.image} name={activeConversationAvatar?.name} size="lg" />
                    )}

                    <div className="min-w-0">
                      <button
                        className={cn(
                          "truncate text-left text-base font-semibold text-[#F6F3EE] md:text-lg",
                          activePartner ? "hover:text-[#FDBA4D]" : "cursor-default"
                        )}
                        onClick={() => {
                          if (!activePartner) return;
                          router.push(
                            activePartner.kind === "agent"
                              ? `/agents/${activePartner.id}/profile`
                              : `/profile/${activePartner.id}`
                          );
                        }}
                      >
                        {getConversationLabel(activeConversation, currentUserId)}
                      </button>
                      <div className="flex items-center gap-1.5 text-xs text-[#6F6A64]">
                        <span>{activePartner?.kind === "agent" ? activeAgentStatusLabel : getConversationSubtext(activeConversation, currentUserId)}</span>
                        {activePartner?.kind === "user" ? (
                          <>
                            <span className="text-[#3A3632]">·</span>
                            <PresenceBadge status={getOnlineStatus(activePartner.lastSeen ?? null)} />
                          </>
                        ) : null}
                        {activePartner?.kind === "agent" && agentInspector?.agent.llmModel ? (
                          <>
                            <span className="text-[#3A3632]">·</span>
                            <span>{agentInspector.agent.llmModel}</span>
                          </>
                        ) : null}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    {activePartner?.kind === "agent" ? (
                      <Button
                        variant="secondary"
                        size="sm"
                        className="hidden md:inline-flex"
                        icon={<Eye size={14} />}
                        onClick={() => setShowContextInspector(true)}
                        disabled={agentInspectorLoading || !!agentInspectorError}
                      >
                        Inspect Context
                      </Button>
                    ) : null}
                    {activePartner?.kind === "agent" && activeAgentReady ? (
                      <Button
                        variant="secondary"
                        size="sm"
                        loading={clearingConversation}
                        icon={<Trash2 size={14} />}
                        className="border-[rgba(255,255,255,0.08)] bg-[#181818] text-[#B7B0A8] hover:bg-[rgba(255,255,255,0.06)] hover:text-[#F6F3EE]"
                        onClick={() => setShowClearContextModal(true)}
                      >
                        <span className="hidden md:inline">Clear Chat</span>
                      </Button>
                    ) : null}

                  </div>
                </div>

                <div ref={chatScrollRef} onScroll={handleChatScroll} className="chat-scroll flex-1 overflow-y-auto overflow-x-hidden bg-[linear-gradient(180deg,rgba(255,255,255,0.01),transparent)] px-3 py-3 md:min-h-0 md:px-5 md:py-4">
                  {loadingMessages && messages.length === 0 ? (
                    <div className="flex h-full items-center justify-center">
                      <div className="h-6 w-6 rounded-full border-2 border-[rgba(247,148,29,0.2)] border-t-[#F7941D] animate-spin" />
                    </div>
                  ) : activePartner?.kind === "agent" && activeAgentBootstrapPending ? (
                    <div className="flex h-full flex-col items-center justify-center px-8 text-center">
                      <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-3xl bg-[rgba(75,156,211,0.12)] text-[#7EC8E3]">
                        <Bot size={28} />
                      </div>
                      <p className="text-lg font-semibold text-[#F6F3EE]">Initializing {activePartner.name}</p>
                      <p className="mt-1 max-w-md text-sm leading-6 text-[#8D877F]">
                        Checking the model connection, loading recent conversation history, and preparing the context bundle.
                      </p>
                      <div className="mt-4 flex items-center gap-2 rounded-2xl border border-[rgba(75,156,211,0.16)] bg-[rgba(75,156,211,0.08)] px-4 py-3 text-sm text-[#9FCBE0]">
                        <div className="h-4 w-4 rounded-full border-2 border-[rgba(126,200,227,0.2)] border-t-[#7EC8E3] animate-spin" />
                        <span>Preparing a clean start before you type</span>
                      </div>
                    </div>
                  ) : activePartner?.kind === "agent" && !activeAgentReady ? (
                    <div className="flex h-full flex-col items-center justify-center px-8 text-center">
                      <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-3xl bg-[rgba(75,156,211,0.12)] text-[#7EC8E3]">
                        <Bot size={28} />
                      </div>
                      <p className="text-lg font-semibold text-[#F6F3EE]">{activePartner.name} isn&apos;t ready to chat yet</p>
                      <p className="mt-1 max-w-md text-sm leading-6 text-[#8D877F]">
                        {agentInspectorError || agentInspector?.readiness.detail || "Connect this agent's LLM brain on the profile page before starting a conversation."}
                      </p>
                      <Button
                        variant="secondary"
                        size="sm"
                        className="mt-4"
                        onClick={() => router.push(`/agents/${activePartner.id}/profile`)}
                      >
                        Open Agent Profile
                      </Button>
                    </div>
                  ) : messages.length === 0 ? (
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
                    <div className="space-y-1.5">
                      {messages.map((message) => {
                        const isCurrentUser = message.sender?.id === currentUserId && message.sender?.kind === "user";
                        const isEditing = editingMessageId === message.id;
                        return (
                          <div
                            key={message.id}
                            className={cn("group flex gap-3", isCurrentUser ? "justify-end" : "justify-start")}
                          >
                            {!isCurrentUser ? (
                              message.sender?.kind === "agent" ? (
                                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-2xl border border-[rgba(75,156,211,0.3)] bg-[rgba(75,156,211,0.16)] text-[#7EC8E3] overflow-hidden">
                                  {message.sender.image
                                    ? (message.sender.image.startsWith("data:") || message.sender.image.startsWith("https://"))
                                      ? <img src={message.sender.image} alt={message.sender.name ?? ""} className="w-full h-full object-cover" />
                                      : <span>{message.sender.image}</span>
                                    : <Bot size={16} />}
                                </div>
                              ) : (
                                <Avatar src={message.sender?.image} name={message.sender?.name} size="sm" />
                              )
                            ) : null}

                            <div className={cn("min-w-0 max-w-[82%] md:max-w-[68%]", isCurrentUser ? "items-end" : "items-start")} style={{ display: "flex", flexDirection: "column" }}>
                              {!isCurrentUser && message.sender?.name ? (
                                <p className="mb-0.5 px-1 text-[11px] font-medium text-[#8D877F]">{message.sender.name}</p>
                              ) : null}
                              {isEditing ? (
                                <div
                                  className="w-full rounded-[22px] border border-[rgba(247,148,29,0.2)] bg-[rgba(255,255,255,0.04)] p-3"
                                  style={{ minWidth: "280px" }}
                                >
                                  <Textarea
                                    value={editingDraft}
                                    onChange={(event) => setEditingDraft(event.target.value)}
                                    rows={3}
                                    className="min-h-[88px] border-[rgba(255,255,255,0.08)] bg-[#191919]"
                                  />
                                  <div className="mt-2 flex justify-end gap-2">
                                    <button
                                      onClick={cancelEditingMessage}
                                      className="flex h-8 w-8 items-center justify-center rounded-xl border border-[rgba(255,255,255,0.08)] bg-[#181818] text-[#8D877F] transition-colors hover:text-[#F6F3EE]"
                                      type="button"
                                      title="Cancel"
                                    >
                                      <X size={14} />
                                    </button>
                                    <button
                                      onClick={() => void saveEditedMessage(message.id)}
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
                                  className="chat-scroll max-h-[min(60vh,36rem)] overflow-y-auto overflow-x-hidden rounded-[20px] px-3.5 py-2 text-sm leading-5 shadow-sm [overflow-wrap:anywhere]"
                                  style={
                                    isCurrentUser
                                      ? {
                                        background: "linear-gradient(135deg, rgba(247,148,29,0.22), rgba(247,148,29,0.1))",
                                        color: "#F6F3EE",
                                        borderBottomRightRadius: "6px",
                                      }
                                      : message.sender?.kind === "agent"
                                        ? {
                                          background: "rgba(75,156,211,0.15)",
                                          color: "#F6F3EE",
                                          border: "1px solid rgba(75,156,211,0.2)",
                                          borderBottomLeftRadius: "6px",
                                        }
                                        : {
                                          background: "rgba(255,255,255,0.05)",
                                          color: "#F6F3EE",
                                          border: "1px solid rgba(255,255,255,0.06)",
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
                                            {tool.status === "running" && (
                                              <span className="text-[#5A8FA8]">…</span>
                                            )}
                                          </div>
                                        ))}
                                      </div>
                                    </div>
                                  ) : null}
                                  {message.retrievalSources && message.retrievalSources.length > 0 ? (
                                    <div className="mt-3 rounded-xl border border-[rgba(255,255,255,0.08)] bg-[rgba(0,0,0,0.18)] px-3 py-2">
                                      <p className="mb-2 text-[10px] font-semibold uppercase tracking-[0.18em] text-[#8D877F]">
                                        Read-Only Context Retrieved
                                      </p>
                                      <div className="flex flex-wrap gap-1.5">
                                        {message.retrievalSources.map((source, index) => (
                                          <span
                                            key={`${source.kind}-${source.target}-${index}`}
                                            className="rounded-full border border-[rgba(75,156,211,0.18)] bg-[rgba(75,156,211,0.08)] px-2 py-1 text-[10px] text-[#A9DCF3]"
                                            title={`${source.target} — ${source.detail}`}
                                          >
                                            {source.label}
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
                                  {!isCurrentUser ? (
                                    <button
                                      onClick={() => void copyToClipboard(message.body, "message", message.id)}
                                      type="button"
                                      className="flex items-center gap-1 text-[11px] text-[#8D877F] transition-colors hover:text-[#F6F3EE]"
                                    >
                                      <Copy size={12} />
                                      {copiedMessageId === message.id ? "Copied" : "Copy"}
                                    </button>
                                  ) : null}
                                  {isCurrentUser ? (
                                    <button
                                      onClick={() => void copyToClipboard(message.body, "message", message.id)}
                                      type="button"
                                      className="flex items-center gap-1 text-[11px] text-[#8D877F] transition-colors hover:text-[#F6F3EE]"
                                    >
                                      <Copy size={12} />
                                      {copiedMessageId === message.id ? "Copied" : "Copy"}
                                    </button>
                                  ) : null}
                                  {isCurrentUser ? (
                                    <>
                                  <button
                                    onClick={() => startEditingMessage(message)}
                                    type="button"
                                    className="flex items-center gap-1 text-[11px] text-[#8D877F] transition-colors hover:text-[#F6F3EE]"
                                  >
                                    <Pencil size={12} />
                                    Edit
                                  </button>
                                  <button
                                    onClick={() => void deleteMessage(message.id)}
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

                {activePartner?.kind === "agent" && !activeAgentReady ? (
                  <div className="shrink-0 border-t border-[rgba(255,255,255,0.06)] bg-[#121212] px-3 py-3 md:px-5 md:py-4">
                    <div className="flex items-center justify-center gap-2.5 rounded-2xl border border-[rgba(239,68,68,0.15)] bg-[rgba(239,68,68,0.06)] px-4 py-3 text-sm text-[#9A9A9A]">
                      <span className="h-2 w-2 rounded-full bg-[#EF4444] shrink-0" />
                      {agentInspector?.readiness.detail || "Agent not online. Configure the LLM connection in the agent profile to start chatting."}
                    </div>
                  </div>
                ) : (
                  <form onSubmit={handleSendMessage} className="shrink-0 border-t border-[rgba(255,255,255,0.06)] bg-[#121212] px-3 py-2.5 md:px-5 md:py-3">
                    {activePartner?.kind === "agent" && agentInspector ? (
                      <div className="mb-2 flex items-center gap-2 text-[11px] text-[#4E4A45]">
                        <span className={agentInspector.readiness.label === "Ready" ? "text-[#4ade80]" : "text-[#9FCBE0]"}>
                          {agentInspector.readiness.label}
                        </span>
                        <span>·</span>
                        <span className="inline-flex items-center gap-1">
                          <RadialContextBar tokens={agentInspector.context.estimatedTokens} />
                          <span>{formatTokensK(agentInspector.context.estimatedTokens)} / 128K</span>
                        </span>
                        <span>·</span>
                        <span>{agentInspector.context.recentHistoryCount}/{agentInspector.context.historyWindowSize} msgs</span>
                        <span>·</span>
                        <span>{formatThinkingMode(agentInspector.agent.llmThinkingMode)} thinking</span>
                      </div>
                    ) : null}
                    <div className="flex items-center gap-2">
                      <div className="min-w-0 flex-1">
                        <Textarea
                          value={messageInput}
                          onChange={(event) => setMessageInput(event.target.value)}
                          placeholder={
                            activePartner?.kind === "agent" && activeAgentBootstrapPending
                              ? `Preparing ${activePartner.name}...`
                              : `Message ${getConversationLabel(activeConversation, currentUserId)}...`
                          }
                          rows={1}
                          className="min-h-[44px] md:min-h-[56px] w-full rounded-2xl border-[rgba(255,255,255,0.08)] bg-[#191919] px-4 py-2.5 md:py-3 resize-none"
                          disabled={sending || activeAgentSendBlocked}
                          onKeyDown={(event: KeyboardEvent<HTMLTextAreaElement>) => {
                            if (event.key === "Enter" && !event.shiftKey) {
                              event.preventDefault();
                              void sendCurrentMessage();
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
                        className="h-11 md:h-14 w-11 md:w-auto shrink-0 rounded-2xl px-0 md:px-5"
                      >
                        {!sending ? <Send size={15} /> : null}
                      </Button>
                    </div>
                    <p className="hidden md:block mt-2 text-xs text-[#6F6A64]">
                      {activePartner?.kind === "agent"
                        ? activeAgentBootstrapPending
                          ? "We are initializing the model, refreshing readiness, and loading the context bundle before input is enabled."
                          : "Connected agents stream live replies here. Open Inspect Context to verify the exact knowledge bundle being sent."
                        : "Direct messages and channels send immediately. Press Enter to send and Shift+Enter for a new line."}
                    </p>
                  </form>
                )}
              </>
            ) : (
              <div className="hidden h-full flex-col items-center justify-center bg-[radial-gradient(circle_at_center,rgba(247,148,29,0.08),transparent_34%)] px-8 text-center md:flex">
                <div className="mb-4 flex h-20 w-20 items-center justify-center rounded-[28px] bg-[rgba(247,148,29,0.12)] text-[#F7941D]">
                  <MessageSquare size={34} />
                </div>
                <h2 className="text-2xl font-semibold text-[#F6F3EE]">Choose a teammate to start chatting</h2>
                <p className="mt-2 max-w-lg text-sm leading-6 text-[#8D877F]">
                  Direct messages, named group channels, and 1:1 AI chats now live here. Pick someone from the left or create a new group.
                </p>
              </div>
            )}
          </section>
        </div>
      </div>

      {showInvite ? (
        <InviteMemberDialog
          onClose={() => setShowInvite(false)}
          onInvited={(invite) => setPendingInvites((current) => [invite, ...current])}
        />
      ) : null}

      {showNewGroup ? (
        <NewGroupDialog
          currentUserId={currentUserId}
          users={members}
          onClose={() => setShowNewGroup(false)}
          onCreated={(conversation) => {
            setConversations((current) => [conversation, ...current.filter((item) => item.id !== conversation.id)]);
            setSelectedConversationId(conversation.id);
          }}
        />
      ) : null}

      {showClearContextModal && activePartner?.kind === "agent" ? (
        <ClearAgentContextDialog
          agentName={activePartner.name}
          loading={clearingConversation}
          onClose={() => {
            if (!clearingConversation) setShowClearContextModal(false);
          }}
          onConfirm={clearAgentConversation}
        />
      ) : null}

      {showContextInspector && agentInspector ? (
        <ContextInspectorDialog
          data={agentInspector}
          copiedView={copiedInspectorView}
          onClose={() => setShowContextInspector(false)}
          onCopyPretty={() => void copyToClipboard(inspectorPrettyText, "pretty")}
          onCopyJson={() => void copyToClipboard(JSON.stringify(agentInspector, null, 2), "json")}
        />
      ) : null}
    </div>
  );
}
