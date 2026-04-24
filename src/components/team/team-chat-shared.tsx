"use client";

import type { ReactNode } from "react";
import { Bot } from "lucide-react";
import { Avatar } from "@/components/ui/Avatar";
import { cn } from "@/lib/utils";

export interface TeamMember {
  id: string;
  name: string | null;
  displayName: string | null;
  email: string;
  image: string | null;
  role: string;
  lastSeen: string | null;
  sprintTasks: unknown[];
}

export interface PendingInvite {
  id: string;
  userId: string;
  name: string | null;
  image: string | null;
  email: string;
  createdAt: string;
}

export interface AIAgent {
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

export interface ConversationMemberSummary {
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
  membership?: {
    id: string;
    joinedAt: string;
    removedAt: string | null;
    isActive: boolean;
  };
}

export interface ChatProjectOption {
  id: string;
  name: string;
}

export interface ConversationDocumentSummary {
  id: string;
  filename: string;
  mimeType: string | null;
  fileType: string;
  fileSize: number;
  createdAt: string;
  uploader: {
    id: string;
    name: string;
    email: string;
    image: string | null;
  };
}

export interface ConversationSummary {
  id: string;
  type: "direct" | "group" | string;
  name: string | null;
  project: ChatProjectOption | null;
  llmThread?: {
    activeAgentId: string | null;
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
  };
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
  documents: ConversationDocumentSummary[];
}

export interface ConversationSearchMatch {
  kind: "message" | "thread" | "project" | "participant";
  snippet: string;
  senderName: string | null;
  matchedAt: string | null;
}

export interface ConversationSearchResult {
  conversation: ConversationSummary;
  match: ConversationSearchMatch;
}

export interface ToolActivity {
  id: string;
  name: string;
  args: Record<string, unknown>;
  status: "running" | "done";
  result?: string;
}

export type ChatMessageClientState = "optimistic_user" | "pending_assistant" | "failed_user";

export interface ChatMessage {
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
    status?: "used" | "unsupported" | "failed" | "unavailable";
    domain?: string;
    scope?: string;
  }>;
  createdAt: string;
  clientRequestId?: string;
  clientState?: ChatMessageClientState;
  sender: {
    kind: "user" | "agent";
    id: string;
    name: string;
    image: string | null;
  } | null;
}

export interface AgentInspectorData {
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
  threadLlm: {
    activeAgentId: string | null;
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
  membership?: {
    activeCount: number;
    activeUserCount: number;
    activeAgentCount: number;
    activeAgentId: string | null;
    hadInactivePinnedActiveAgent: boolean;
    participants: ConversationMemberSummary[];
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
    sourceSelection: {
      requestMode: "default" | "plan";
      consideredSourceIds: string[];
      defaultCandidateSourceIds: string[];
      explicitUserRequestedSourceIds: string[];
      requestedSourceIds: string[];
      plannerProposedSourceIds: string[];
      policyRequiredSourceIds: string[];
      fallbackCandidateSourceIds: string[];
      allowedSourceIds: string[];
      executedSourceIds: string[];
      excludedSourceIds: string[];
    };
    sourceDecisions: Array<{
      sourceId: string;
      label: string;
      request: {
        status: "candidate" | "requested" | "proposed" | "required";
        mode: "default" | "plan";
        origins: Array<
          | "default_system_candidate"
          | "explicit_user_request"
          | "planner_proposed"
          | "policy_required"
          | "fallback_candidate"
        >;
        detail: string;
      };
      admission: {
        status: "allowed" | "excluded";
      };
      execution: {
        status: "executed" | "not_executed";
        detail: string;
        summary: {
          totalCount: number;
          usedCount: number;
          unsupportedCount: number;
          failedCount: number;
          unavailableCount: number;
          excludedCategories: Array<"registration" | "scope" | "authorization" | "availability" | "implementation" | "budget">;
        } | null;
      };
      exclusion: {
        category: "registration" | "scope" | "authorization" | "availability" | "implementation" | "budget";
        reason:
          | "not_registered"
          | "not_in_scope"
          | "not_available"
          | "requesting_user_not_allowed"
          | "active_agent_not_allowed"
          | "not_implemented"
          | "budget_exhausted";
        detail: string;
      } | null;
      status: "allowed" | "excluded";
      reason:
        | "allowed"
        | "not_registered"
        | "not_in_scope"
        | "not_available"
        | "requesting_user_not_allowed"
        | "active_agent_not_allowed"
        | "not_implemented"
        | "budget_exhausted";
      detail: string;
      domain: string;
      scope: string;
      policyMode: string;
      eligibility: {
        isRegistered: boolean;
        isInScope: boolean;
        isAvailable: boolean;
        isRequestingUserAllowed: boolean;
        isActiveAgentAllowed: boolean;
        isImplemented: boolean;
      };
    }>;
    resolvedSources: Array<{
      kind: string;
      label: string;
      target: string;
      detail: string;
      status?: "used" | "unsupported" | "failed" | "unavailable";
      domain?: string;
      scope?: string;
    }>;
  };
  payload: {
    currentUserName: string | null;
    systemPrompt: string;
    history: Array<{
      role: "system" | "user" | "assistant" | "tool";
      content: string | null;
    }>;
    orgContext: string;
    resolvedContextText: string;
  };
}

export interface ThreadSection {
  id: string;
  label: string;
  items: ConversationSummary[];
}

export interface ConversationAvatarInfo {
  name: string;
  image: string | null;
  kind: "group" | "user" | "agent";
}

export interface NewThreadSelection {
  name: string;
  userIds: string[];
  agentIds: string[];
  projectId: string | null;
  projectName: string;
}

const STATUS_COLORS = { online: "#22C55E", away: "#FBBA00", offline: "#505050" };
const STATUS_LABELS = { online: "Online", away: "Away", offline: "Offline" };

export const chatMarkdownComponents = {
  p: ({ children }: { children?: ReactNode }) => (
    <p className="mb-2 last:mb-0 leading-5">{children}</p>
  ),
  strong: ({ children }: { children?: ReactNode }) => (
    <strong className="font-semibold text-[#F6F3EE]">{children}</strong>
  ),
  em: ({ children }: { children?: ReactNode }) => (
    <em className="italic text-[#DEDEDE]">{children}</em>
  ),
  h1: ({ children }: { children?: ReactNode }) => (
    <p className="mb-2 text-base font-bold text-[#F6F3EE]">{children}</p>
  ),
  h2: ({ children }: { children?: ReactNode }) => (
    <p className="mb-1.5 text-sm font-bold text-[#F6F3EE]">{children}</p>
  ),
  h3: ({ children }: { children?: ReactNode }) => (
    <p className="mb-1 text-sm font-semibold text-[#DEDEDE]">{children}</p>
  ),
  ul: ({ children }: { children?: ReactNode }) => (
    <ul className="mb-2 space-y-0.5 pl-4">{children}</ul>
  ),
  ol: ({ children }: { children?: ReactNode }) => (
    <ol className="mb-2 list-decimal space-y-0.5 pl-4 marker:text-[#8D877F]">{children}</ol>
  ),
  li: ({ children }: { children?: ReactNode }) => (
    <li className="flex gap-2 leading-5">
      <span className="mt-2 h-1 w-1 flex-shrink-0 rounded-full bg-[#7EC8E3]/60" />
      <span className="flex-1">{children}</span>
    </li>
  ),
  code: ({ className, children }: { className?: string; children?: ReactNode }) => {
    const isBlock = /language-/.test(className ?? "");
    if (isBlock) {
      return (
        <pre className="my-2 overflow-x-auto whitespace-pre rounded-xl border border-[rgba(255,255,255,0.08)] bg-[#0D0D0D] px-3 py-2 font-mono text-xs leading-relaxed text-[#C8C8C8]">
          <code>{children}</code>
        </pre>
      );
    }

    return (
      <code className="rounded border border-[rgba(126,200,227,0.18)] bg-[rgba(126,200,227,0.12)] px-1.5 py-0.5 font-mono text-xs text-[#9FCBE0]">
        {children}
      </code>
    );
  },
  blockquote: ({ children }: { children?: ReactNode }) => (
    <blockquote className="my-2 border-l-2 border-[#7EC8E3]/40 pl-3 italic text-[#CFC9C2]">{children}</blockquote>
  ),
  hr: () => <hr className="my-3 border-[rgba(255,255,255,0.08)]" />,
  a: ({ href, children }: { href?: string; children?: ReactNode }) => (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="text-[#9FCBE0] underline underline-offset-2 hover:text-[#7EC8E3]"
    >
      {children}
    </a>
  ),
};

export function dedupeChatMessages(messages: ChatMessage[]) {
  const seen = new Set<string>();
  const unique: ChatMessage[] = [];

  for (let index = messages.length - 1; index >= 0; index -= 1) {
    const message = messages[index];
    if (seen.has(message.id)) continue;
    seen.add(message.id);
    unique.unshift(message);
  }

  return unique;
}

export function isLocalPendingChatMessage(message: ChatMessage) {
  return message.clientState === "optimistic_user" || message.clientState === "pending_assistant";
}

export function getOnlineStatus(lastSeen: string | null): "online" | "away" | "offline" {
  if (!lastSeen) return "offline";
  const diff = Date.now() - new Date(lastSeen).getTime();
  if (diff < 5 * 60 * 1000) return "online";
  if (diff < 20 * 60 * 1000) return "away";
  return "offline";
}

export function formatPreviewTime(iso: string) {
  const date = new Date(iso);
  const now = new Date();
  const sameDay = date.toDateString() === now.toDateString();
  return sameDay
    ? date.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })
    : date.toLocaleDateString([], { month: "short", day: "numeric" });
}

export function formatMessageTime(iso: string) {
  return new Date(iso).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
}

export function formatRelativeTime(iso: string | null) {
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

export function formatThinkingMode(mode?: string) {
  if (mode === "always") return "Always";
  if (mode === "off") return "Off";
  return "Auto";
}

export function formatContextMeter(estimatedTokens: number) {
  if (estimatedTokens < 1000) return "Light";
  if (estimatedTokens < 3000) return "Moderate";
  if (estimatedTokens < 6000) return "Heavy";
  return "Very heavy";
}

export const MAX_CONTEXT_TOKENS = 128_000;

export function formatTokensK(tokens: number): string {
  return `${(tokens / 1000).toFixed(1)}K`;
}

export function formatDocumentBytes(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function getConversationDocumentDownloadHref(conversationId: string, documentId: string) {
  return `/api/chat/conversations/${conversationId}/documents/${documentId}/file`;
}

export function RadialContextBar({
  tokens,
  maxTokens = MAX_CONTEXT_TOKENS,
}: {
  tokens: number;
  maxTokens?: number;
}) {
  const pct = Math.min(1, tokens / maxTokens);
  const radius = 7;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference * (1 - pct);
  const color =
    pct < 0.5 ? "#4ade80" : pct < 0.75 ? "#facc15" : pct < 0.9 ? "#f97316" : "#ef4444";

  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 20 20"
      style={{ transform: "rotate(-90deg)", flexShrink: 0 }}
    >
      <circle cx="10" cy="10" r={radius} fill="none" stroke="rgba(255,255,255,0.1)" strokeWidth="2.5" />
      <circle
        cx="10"
        cy="10"
        r={radius}
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

export function getMemberDisplayName(member: TeamMember) {
  return member.displayName || member.name || member.email;
}

export function getDirectConversationPartner(
  conversation: ConversationSummary,
  currentUserId: string
) {
  return conversation.members.find((member) => member.id !== currentUserId) ?? null;
}

export function getPrimaryAgentParticipant(conversation: ConversationSummary | null) {
  if (!conversation) return null;
  if (conversation.llmThread?.activeAgentId) {
    const explicitAgent = conversation.members.find(
      (member) => member.kind === "agent" && member.id === conversation.llmThread?.activeAgentId
    );
    if (explicitAgent) {
      return explicitAgent;
    }
  }

  return conversation.members.find((member) => member.kind === "agent") ?? null;
}

function summarizeParticipantNames(
  members: ConversationMemberSummary[],
  currentUserId?: string,
  maxVisible = 2
) {
  const prioritized = currentUserId
    ? members.filter((member) => member.id !== currentUserId)
    : members;
  const source = prioritized.length > 0 ? prioritized : members;
  const names = source.map((member) => member.name).filter(Boolean);

  if (names.length === 0) return "New thread";
  if (names.length <= maxVisible) return names.join(", ");
  return `${names.slice(0, maxVisible).join(", ")} +${names.length - maxVisible} more`;
}

export function getConversationLabel(conversation: ConversationSummary, currentUserId: string) {
  const customName = conversation.name?.trim();

  if (customName) {
    return customName;
  }

  if (conversation.type === "group") {
    return summarizeParticipantNames(conversation.members, currentUserId);
  }

  return getDirectConversationPartner(conversation, currentUserId)?.name || "New conversation";
}

export function getConversationSubtext(conversation: ConversationSummary, currentUserId: string) {
  if (conversation.type === "group") {
    return getConversationParticipantSummary(conversation);
  }

  const partner = getDirectConversationPartner(conversation, currentUserId);
  if (partner?.kind === "agent") {
    return partner.llmStatus === "online"
      ? "LLM Configured"
      : partner.llmStatus === "offline"
        ? "LLM Check Failed"
        : "LLM Not Connected";
  }

  return "Direct message";
}

export function getConversationAvatar(
  conversation: ConversationSummary,
  currentUserId: string
): ConversationAvatarInfo {
  if (conversation.type === "group") {
    return {
      name: conversation.name?.trim() || summarizeParticipantNames(conversation.members, currentUserId),
      image: null,
      kind: "group",
    };
  }

  const partner = getDirectConversationPartner(conversation, currentUserId);
  return {
    name: partner?.name || "Conversation",
    image: partner?.image || null,
    kind: partner?.kind || "user",
  };
}

export function getPreviewText(conversation: ConversationSummary | undefined) {
  if (!conversation?.latestMessage) return "No messages yet";
  const senderName = conversation.latestMessage.sender?.name;
  return senderName
    ? `${senderName}: ${conversation.latestMessage.body}`
    : conversation.latestMessage.body;
}

export function getConversationTimestamp(conversation: ConversationSummary) {
  return conversation.latestMessage?.createdAt ?? conversation.updatedAt;
}

function formatCountLabel(count: number, singular: string, plural: string) {
  return `${count} ${count === 1 ? singular : plural}`;
}

export function getConversationParticipantCounts(conversation: ConversationSummary) {
  return {
    humans: conversation.members.filter((member) => member.kind === "user").length,
    agents: conversation.members.filter((member) => member.kind === "agent").length,
  };
}

export function getConversationParticipantSummary(conversation: ConversationSummary) {
  const counts = getConversationParticipantCounts(conversation);
  const parts = [
    counts.humans > 0 ? formatCountLabel(counts.humans, "human", "humans") : null,
    counts.agents > 0 ? formatCountLabel(counts.agents, "agent", "agents") : null,
  ].filter(Boolean);

  return parts.length > 0 ? parts.join(" / ") : "No participants";
}

export function getConversationWorkspaceLabel(conversation: ConversationSummary) {
  const counts = getConversationParticipantCounts(conversation);

  if (conversation.type === "group") {
    return "Workspace thread";
  }

  if (counts.agents > 0 && counts.humans > 1) {
    return "Shared agent thread";
  }

  if (counts.agents > 0) {
    return "Agent thread";
  }

  return "Direct thread";
}

export function getConversationTypeBadgeLabel(conversation: ConversationSummary) {
  const counts = getConversationParticipantCounts(conversation);

  if (counts.agents > 0) return "Agent";
  if (conversation.type === "group") return "Group";
  return "Direct";
}

export function getConversationSections(conversations: ConversationSummary[]): ThreadSection[] {
  const sections = new Map<string, ConversationSummary[]>();
  const now = new Date();
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const yesterdayStart = new Date(todayStart);
  yesterdayStart.setDate(yesterdayStart.getDate() - 1);
  const weekStart = new Date(todayStart);
  weekStart.setDate(weekStart.getDate() - 7);

  for (const conversation of [...conversations].sort(
    (a, b) => new Date(getConversationTimestamp(b)).getTime() - new Date(getConversationTimestamp(a)).getTime()
  )) {
    const timestamp = new Date(getConversationTimestamp(conversation));
    let label = "Earlier";

    if (timestamp >= todayStart) {
      label = "Today";
    } else if (timestamp >= yesterdayStart) {
      label = "Yesterday";
    } else if (timestamp >= weekStart) {
      label = "Last 7 Days";
    }

    const existing = sections.get(label);
    if (existing) {
      existing.push(conversation);
    } else {
      sections.set(label, [conversation]);
    }
  }

  return Array.from(sections.entries()).map(([label, items]) => ({
    id: label.toLowerCase().replace(/\s+/g, "-"),
    label,
    items,
  }));
}

export function getConversationProjectSections(
  conversations: ConversationSummary[],
  projects: ChatProjectOption[] = []
): ThreadSection[] {
  const sections = new Map<string, ThreadSection>();
  sections.set("general", {
    id: "general",
    label: "General",
    items: [],
  });

  for (const project of [...projects].sort((a, b) => a.name.localeCompare(b.name))) {
    sections.set(project.id, {
      id: project.id,
      label: project.name,
      items: [],
    });
  }

  for (const conversation of [...conversations].sort(
    (a, b) => new Date(getConversationTimestamp(b)).getTime() - new Date(getConversationTimestamp(a)).getTime()
  )) {
    const sectionId = conversation.project?.id ?? "general";
    const sectionLabel = conversation.project?.name?.trim() || "General";
    const existingSection = sections.get(sectionId);

    if (existingSection) {
      existingSection.items.push(conversation);
      continue;
    }

    sections.set(sectionId, {
      id: sectionId,
      label: sectionLabel,
      items: [conversation],
    });
  }

  return Array.from(sections.values());
}

const AGENT_AVATAR_SIZES = {
  xs: "h-6 w-6 rounded-xl text-xs",
  sm: "h-8 w-8 rounded-2xl text-sm",
  md: "h-10 w-10 rounded-[18px] text-base",
  lg: "h-12 w-12 rounded-[20px] text-lg",
} as const;

export function MemberAvatar({
  member,
  size = "sm",
  className,
}: {
  member: ConversationMemberSummary;
  size?: keyof typeof AGENT_AVATAR_SIZES;
  className?: string;
}) {
  if (member.kind === "user") {
    return <Avatar src={member.image} name={member.name} size={size} className={className} />;
  }

  return (
    <div
      className={cn(
        "flex items-center justify-center overflow-hidden border border-[rgba(75,156,211,0.3)] bg-[rgba(75,156,211,0.16)] text-[#7EC8E3]",
        AGENT_AVATAR_SIZES[size],
        className
      )}
    >
      {member.image
        ? member.image.startsWith("data:") || member.image.startsWith("https://")
          ? <img src={member.image} alt={member.name} className="h-full w-full object-cover" />
          : <span>{member.image}</span>
        : <Bot size={size === "xs" ? 12 : size === "sm" ? 15 : 18} />}
    </div>
  );
}

export function getAgentSidebarStatus(status?: string) {
  if (status === "online") {
    return {
      label: "Configured",
      description: "Saved provider settings; live readiness is checked when chat opens",
      dot: "#22C55E",
      chipClassName: "border-[rgba(75,156,211,0.28)] bg-[rgba(75,156,211,0.16)] text-[#B9E4F6]",
      metaClassName: "text-[#7EC8E3]",
    };
  }

  if (status === "offline") {
    return {
      label: "Check Failed",
      description: "The last server-side provider check failed",
      dot: "#EF4444",
      chipClassName: "border-[rgba(239,68,68,0.22)] bg-[rgba(239,68,68,0.12)] text-[#F5B4B4]",
      metaClassName: "text-[#F08B8B]",
    };
  }

  return {
    label: "Not Connected",
    description: "No LLM connection configured",
    dot: "#8D877F",
    chipClassName: "border-[rgba(255,255,255,0.08)] bg-[rgba(255,255,255,0.04)] text-[#B7B0A8]",
    metaClassName: "text-[#A39B92]",
  };
}

export function OnlineDot({ status }: { status: "online" | "away" | "offline" }) {
  return (
    <span
      className={cn("block h-2.5 w-2.5 rounded-full border border-[#111111]", status === "online" && "animate-pulse")}
      style={{ backgroundColor: STATUS_COLORS[status] }}
    />
  );
}

export function PresenceBadge({ status }: { status: "online" | "away" | "offline" }) {
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

export function SidebarRow({
  active,
  icon,
  title,
  preview,
  meta,
  onClick,
  trailing,
  variant = "default",
}: {
  active: boolean;
  icon: ReactNode;
  title: string;
  preview: string;
  meta?: string | null;
  onClick: () => void;
  trailing?: ReactNode;
  variant?: "default" | "secondary";
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "group flex w-full items-center text-left transition-all active:scale-[0.99]",
        variant === "secondary"
          ? "gap-2 rounded-xl border border-transparent px-2 py-1.5"
          : "gap-2.5 rounded-2xl border px-2.5 py-1.5",
        active
          ? variant === "secondary"
            ? "border-[rgba(247,148,29,0.14)] bg-[rgba(255,255,255,0.04)] shadow-[inset_0_0_0_1px_rgba(247,148,29,0.05)]"
            : "border-[rgba(247,148,29,0.25)] bg-[linear-gradient(135deg,rgba(247,148,29,0.14),rgba(247,148,29,0.02))]"
          : variant === "secondary"
            ? "bg-transparent hover:bg-[rgba(255,255,255,0.025)]"
            : "border-transparent bg-transparent hover:border-[rgba(255,255,255,0.06)] hover:bg-[rgba(255,255,255,0.03)]"
      )}
    >
      {icon}
      <div className="min-w-0 flex-1 text-left">
        <div className="flex items-center justify-between gap-2">
          <p
            className={cn(
              "truncate text-[#F6F3EE]",
              variant === "secondary" ? "text-[13px] font-medium" : "text-sm font-semibold"
            )}
          >
            {title}
          </p>
          {meta ? (
            <span className={cn("shrink-0 text-[#8D877F]", variant === "secondary" ? "text-[10px]" : "text-[11px]")}>
              {meta}
            </span>
          ) : null}
        </div>
        <p className={cn("truncate text-[#8D877F]", variant === "secondary" ? "mt-0.5 text-[11px]" : "mt-0.5 text-[12px]")}>
          {preview}
        </p>
      </div>
      {trailing}
    </button>
  );
}

export function ThreadTypeBadge({ conversation }: { conversation: ConversationSummary }) {
  const hasAgentParticipant = conversation.members.some((member) => member.kind === "agent");

  return (
    <span
      className={cn(
        "inline-flex rounded-full border px-2 py-0.5 text-[9px] font-semibold uppercase tracking-[0.18em]",
        hasAgentParticipant
          ? "border-[rgba(75,156,211,0.22)] bg-[rgba(75,156,211,0.1)] text-[#9FCBE0]"
          : conversation.type === "group"
            ? "border-[rgba(247,148,29,0.2)] bg-[rgba(247,148,29,0.1)] text-[#FDBA4D]"
            : "border-[rgba(255,255,255,0.08)] bg-[rgba(255,255,255,0.04)] text-[#B7B0A8]"
      )}
    >
      {getConversationTypeBadgeLabel(conversation)}
    </span>
  );
}
