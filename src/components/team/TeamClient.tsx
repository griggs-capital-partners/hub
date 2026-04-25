"use client";

import type { FormEvent } from "react";
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { motion } from "framer-motion";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import {
  Copy,
  Mail,
  UserPlus,
  UsersRound,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { cn } from "@/lib/utils";
import { deriveInviteName } from "@/lib/team-invites";
import { useDesktopSidebar } from "@/components/layout/DesktopSidebarContext";
import { ConversationPane } from "@/components/team/ConversationPane";
import { NewThreadModal } from "@/components/team/NewThreadModal";
import {
  TeamChatPerfBoundary,
  finishTeamChatPerfSpan,
  incrementTeamChatPerfCounter,
  recordTeamChatPerfEvent,
  startTeamChatPerfSpan,
  useTeamChatPerfCommit,
} from "@/components/team/team-chat-performance";
import { TeamDiscoveryPane } from "@/components/team/TeamDiscoveryPane";
import { type ThreadDocumentUploadState } from "@/components/team/ThreadDocumentsPanel";
import { ThreadDrawer } from "@/components/team/ThreadDrawer";
import { ThreadRail } from "@/components/team/ThreadRail";
import {
  type AIAgent,
  type AgentInspectorData,
  type ChatMessage,
  type ChatProjectOption,
  type ConversationDocumentSummary,
  type ConversationMemberSummary,
  type ConversationSearchResult,
  type ConversationSummary,
  type NewThreadSelection,
  type PendingInvite,
  type TeamMember,
  MAX_CONTEXT_TOKENS,
  dedupeChatMessages,
  formatContextMeter,
  formatRelativeTime,
  formatThinkingMode,
  formatTokensK,
  getAgentSidebarStatus,
  getConversationLabel,
  getConversationProjectSections,
  getConversationParticipantSummary,
  getConversationTimestamp,
  getConversationWorkspaceLabel,
  getDirectConversationPartner,
  isLocalPendingChatMessage,
  getPrimaryAgentParticipant,
  getMemberDisplayName,
  getOnlineStatus,
} from "@/components/team/team-chat-shared";
import { buildDirectConversationShortcutMaps } from "@/components/team/team-chat-thread-shortcuts";
import { validateConversationDocument } from "@/lib/conversation-documents";

type Props = {
  currentUserId: string;
  users: TeamMember[];
  invites: PendingInvite[];
  agents: AIAgent[];
  projects: ChatProjectOption[];
  initialConversations: ConversationSummary[];
  activeSprint?: {
    id: string;
    name: string;
    status: string;
    startDate: string;
    endDate: string;
  } | null;
};

type ThreadDocumentUploadMap = Record<string, ThreadDocumentUploadState[]>;
type AgentRuntimeSnapshot = Pick<AgentInspectorData, "context" | "payload">;
type AgentContextSourceDecision = AgentInspectorData["context"]["sourceDecisions"][number];
type AgentResolvedSource = AgentInspectorData["context"]["resolvedSources"][number];

function getApiErrorMessage(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function normalizeApiFallbackMessage(text: string) {
  const normalized = text.replace(/\s+/g, " ").trim();

  if (!normalized || normalized.startsWith("<")) {
    return null;
  }

  return normalized.length > 180 ? `${normalized.slice(0, 177)}...` : normalized;
}

async function parseApiResponse(response: Response) {
  const bodyText = await response.text().catch(() => "");

  if (!bodyText) {
    return {} as Record<string, unknown>;
  }

  const contentType = response.headers.get("content-type") ?? "";
  if (contentType.toLowerCase().includes("application/json")) {
    try {
      const data = JSON.parse(bodyText);
      if (data && typeof data === "object") {
        return data as Record<string, unknown>;
      }
    } catch {
      return {} as Record<string, unknown>;
    }
  }

  const fallbackMessage = normalizeApiFallbackMessage(bodyText);
  return fallbackMessage ? { error: fallbackMessage } : ({} as Record<string, unknown>);
}

function formatContextSourceDecisionStatusLabel(status: AgentContextSourceDecision["status"]) {
  return status === "allowed" ? "Allowed" : "Excluded";
}

function formatContextSourceRequestStatusLabel(status: AgentContextSourceDecision["request"]["status"]) {
  switch (status) {
    case "candidate":
      return "Candidate";
    case "proposed":
      return "Proposed";
    case "required":
      return "Required";
    default:
      return "Requested";
  }
}

function formatContextSourceRequestOriginLabel(origin: AgentContextSourceDecision["request"]["origins"][number]) {
  switch (origin) {
    case "default_system_candidate":
      return "Default candidate";
    case "explicit_user_request":
      return "User requested";
    case "planner_proposed":
      return "Planner proposed";
    case "policy_required":
      return "Policy required";
    default:
      return "Fallback candidate";
  }
}

function formatContextSourceAdmissionStatusLabel(status: AgentContextSourceDecision["admission"]["status"]) {
  return status === "allowed" ? "Allowed" : "Excluded";
}

function formatContextSourceExecutionStatusLabel(status: AgentContextSourceDecision["execution"]["status"]) {
  return status === "executed" ? "Executed" : "Not executed";
}

function formatContextSourceDecisionReasonLabel(reason: AgentContextSourceDecision["reason"]) {
  switch (reason) {
    case "allowed":
      return "Allowed";
    case "not_registered":
      return "Not registered";
    case "not_in_scope":
      return "Out of scope";
    case "not_available":
      return "Unavailable";
    case "requesting_user_not_allowed":
      return "User not allowed";
    case "active_agent_not_allowed":
      return "Active agent required";
    case "budget_exhausted":
      return "Budget exhausted";
    default:
      return "Not implemented";
  }
}

function formatContextSourceExclusionCategoryLabel(
  category: NonNullable<AgentContextSourceDecision["exclusion"]>["category"]
) {
  switch (category) {
    case "registration":
      return "Registration";
    case "scope":
      return "Scope";
    case "authorization":
      return "Authorization";
    case "availability":
      return "Availability";
    case "budget":
      return "Budget";
    default:
      return "Implementation";
  }
}

function formatContextSourceExecutionSummary(summary: NonNullable<AgentContextSourceDecision["execution"]["summary"]>) {
  const parts = [
    summary.usedCount > 0 ? `${summary.usedCount} used` : null,
    summary.unsupportedCount > 0 ? `${summary.unsupportedCount} unsupported` : null,
    summary.failedCount > 0 ? `${summary.failedCount} failed` : null,
    summary.unavailableCount > 0 ? `${summary.unavailableCount} unavailable` : null,
  ].filter((part): part is string => Boolean(part));

  if (parts.length === 0) {
    return summary.totalCount === 0 ? "0 attachments evaluated" : `${summary.totalCount} attachments evaluated`;
  }

  return parts.join(", ");
}

function buildContextSourceOriginSummary(selection: AgentInspectorData["context"]["sourceSelection"]) {
  const parts = [
    selection.defaultCandidateSourceIds.length > 0
      ? `${selection.defaultCandidateSourceIds.length} default candidate${selection.defaultCandidateSourceIds.length === 1 ? "" : "s"}`
      : null,
    selection.explicitUserRequestedSourceIds.length > 0
      ? `${selection.explicitUserRequestedSourceIds.length} user requested`
      : null,
    selection.plannerProposedSourceIds.length > 0
      ? `${selection.plannerProposedSourceIds.length} planner proposed`
      : null,
    selection.policyRequiredSourceIds.length > 0
      ? `${selection.policyRequiredSourceIds.length} policy required`
      : null,
    selection.fallbackCandidateSourceIds.length > 0
      ? `${selection.fallbackCandidateSourceIds.length} fallback candidate${selection.fallbackCandidateSourceIds.length === 1 ? "" : "s"}`
      : null,
  ].filter((part): part is string => Boolean(part));

  return parts.length > 0 ? parts.join(", ") : "No source candidates or requests were considered.";
}

function formatResolvedSourceStatusLabel(status: AgentResolvedSource["status"]) {
  if (status === "unsupported") {
    return "Unsupported";
  }

  if (status === "failed") {
    return "Failed";
  }

  if (status === "unavailable") {
    return "Unavailable";
  }

  return "Used";
}

function mergeChatProjects(
  current: ChatProjectOption[],
  incoming: ChatProjectOption[]
) {
  const mergedProjects = new Map(current.map((project) => [project.id, project]));
  for (const project of incoming) {
    mergedProjects.set(project.id, project);
  }

  return Array.from(mergedProjects.values()).sort((a, b) => a.name.localeCompare(b.name));
}

function sortConversationsByUpdatedAt(conversations: ConversationSummary[]) {
  return [...conversations].sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
}

function sortChatMessagesChronologically(messages: ChatMessage[]) {
  return dedupeChatMessages(messages)
    .map((message, index) => ({ message, index }))
    .sort((a, b) => {
      const timeDifference =
        new Date(a.message.createdAt).getTime() - new Date(b.message.createdAt).getTime();
      return timeDifference !== 0 ? timeDifference : a.index - b.index;
    })
    .map(({ message }) => message);
}

type TeamChatRouteState =
  | { kind: "rail" }
  | { kind: "discovery" }
  | { kind: "archived"; query?: string }
  | { kind: "project"; projectId: string }
  | { kind: "search"; query: string; projectId?: string | null }
  | {
      kind: "thread";
      conversationId: string;
      context?: "discover" | "project" | "search" | "archived";
      projectId?: string | null;
      query?: string;
    };

function buildTeamChatHref(pathname: string, routeState: TeamChatRouteState) {
  const params = new URLSearchParams();

  switch (routeState.kind) {
    case "thread":
      params.set("view", "thread");
      params.set("conversationId", routeState.conversationId);
      if (routeState.context) {
        params.set("context", routeState.context);
      }
      if (routeState.projectId) {
        params.set("projectId", routeState.projectId);
      }
      if (routeState.context === "search" && routeState.query?.trim()) {
        params.set("q", routeState.query.trim());
      }
      break;
    case "project":
      params.set("view", "project");
      params.set("projectId", routeState.projectId);
      break;
    case "archived": {
      params.set("view", "archived");
      const query = routeState.query?.trim();
      if (query) {
        params.set("q", query);
      }
      break;
    }
    case "search": {
      const query = routeState.query.trim();
      if (!query) {
        return buildTeamChatHref(
          pathname,
          routeState.projectId
            ? { kind: "project", projectId: routeState.projectId }
            : { kind: "discovery" }
        );
      }

      params.set("view", "search");
      params.set("q", query);
      if (routeState.projectId) {
        params.set("projectId", routeState.projectId);
      }
      break;
    }
    case "discovery":
      params.set("view", "discover");
      break;
    case "rail":
      break;
  }

  const queryString = params.toString();
  return queryString ? `${pathname}?${queryString}` : pathname;
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
  const consideredSourceCount = data.context.sourceSelection.consideredSourceIds.length;
  const defaultCandidateSourceCount = data.context.sourceSelection.defaultCandidateSourceIds.length;
  const explicitUserRequestedSourceCount = data.context.sourceSelection.explicitUserRequestedSourceIds.length;
  const plannerProposedSourceCount = data.context.sourceSelection.plannerProposedSourceIds.length;
  const policyRequiredSourceCount = data.context.sourceSelection.policyRequiredSourceIds.length;
  const fallbackCandidateSourceCount = data.context.sourceSelection.fallbackCandidateSourceIds.length;
  const requestedSourceCount = data.context.sourceSelection.requestedSourceIds.length;
  const allowedSourceCount = data.context.sourceSelection.allowedSourceIds.length;
  const executedSourceCount = data.context.sourceSelection.executedSourceIds.length;
  const excludedSourceCount = data.context.sourceSelection.excludedSourceIds.length;

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
                <p className="mt-2 text-sm font-semibold text-[#F6F3EE]">{data.threadLlm.selectedLabel ?? data.agent.llmModel ?? "Unknown model"}</p>
                <p className="mt-1 text-sm text-[#8D877F]">
                  Selected for this thread: {data.threadLlm.selectedBy === "user"
                    ? "User override"
                    : data.threadLlm.selectedBy === "auto"
                      ? "Auto-routed"
                      : data.threadLlm.selectedBy === "default"
                        ? "Default model"
                        : "Legacy/default connection"}
                </p>
                {data.threadLlm.reasonSummary ? (
                  <p className="mt-1 text-sm text-[#8D877F]">{data.threadLlm.reasonSummary}</p>
                ) : null}
                {data.threadLlm.escalationSummary ? (
                  <p className="mt-1 text-sm text-[#F0C889]">{data.threadLlm.escalationSummary}</p>
                ) : null}
                <p className="mt-1 text-sm text-[#8D877F]">Thinking mode: {formatThinkingMode(data.agent.llmThinkingMode)}</p>
                <p className="mt-1 text-sm text-[#8D877F]">Last checked: {formatRelativeTime(data.agent.llmLastCheckedAt)}</p>
                {data.threadLlm.auditEvents.length > 0 ? (
                  <div className="mt-3 space-y-2 border-t border-[rgba(255,255,255,0.06)] pt-3">
                    {data.threadLlm.auditEvents.slice(-3).reverse().map((event) => (
                      <div key={`${event.type}-${event.at}`} className="rounded-xl bg-[rgba(255,255,255,0.03)] px-3 py-2">
                        <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[#7EC8E3]">{event.type}</p>
                        <p className="mt-1 text-xs leading-5 text-[#CFC9C2]">{event.summary}</p>
                      </div>
                    ))}
                  </div>
                ) : null}
              </div>
            </div>
          </div>

          <div className="min-h-0 overflow-y-auto p-5">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[#8D877F]">Context Sources</p>
                <p className="mt-1 text-sm text-[#8D877F]">This is the prompt and thread-context information currently bundled into the chat.</p>
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

            {data.context.sourceSelection ? (
              <div className="mt-5 rounded-2xl border border-[rgba(255,255,255,0.06)] bg-[#101010] p-4">
                <div className="flex items-center justify-between gap-3">
                  <p className="text-sm font-semibold text-[#F6F3EE]">Source Decisions</p>
                  <span className="text-xs text-[#6F6A64]">
                    {consideredSourceCount} considered, {allowedSourceCount} allowed, {executedSourceCount} executed, {excludedSourceCount} excluded
                  </span>
                </div>
                <div className="mt-3 grid grid-cols-2 gap-2 md:grid-cols-4">
                  <div className="rounded-xl bg-[rgba(255,255,255,0.03)] px-3 py-2">
                    <div className="text-[11px] uppercase tracking-[0.14em] text-[#8D877F]">Considered</div>
                    <div className="mt-1 text-sm font-semibold text-[#F6F3EE]">{consideredSourceCount}</div>
                  </div>
                  <div className="rounded-xl bg-[rgba(75,156,211,0.08)] px-3 py-2">
                    <div className="text-[11px] uppercase tracking-[0.14em] text-[#7EC8E3]">Allowed</div>
                    <div className="mt-1 text-sm font-semibold text-[#F6F3EE]">{allowedSourceCount}</div>
                  </div>
                  <div className="rounded-xl bg-[rgba(126,200,227,0.08)] px-3 py-2">
                    <div className="text-[11px] uppercase tracking-[0.14em] text-[#9FCBE0]">Executed</div>
                    <div className="mt-1 text-sm font-semibold text-[#F6F3EE]">{executedSourceCount}</div>
                  </div>
                  <div className="rounded-xl bg-[rgba(240,200,137,0.08)] px-3 py-2">
                    <div className="text-[11px] uppercase tracking-[0.14em] text-[#F0C889]">Excluded</div>
                    <div className="mt-1 text-sm font-semibold text-[#F6F3EE]">{excludedSourceCount}</div>
                  </div>
                </div>
                <div className="mt-3 flex flex-wrap gap-2">
                  <span className="rounded-full border border-[rgba(255,255,255,0.08)] bg-[#0B0B0B] px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.18em] text-[#B7B0A8]">
                    Default Candidates {defaultCandidateSourceCount}
                  </span>
                  <span className="rounded-full border border-[rgba(255,255,255,0.08)] bg-[#0B0B0B] px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.18em] text-[#B7B0A8]">
                    User Requested {explicitUserRequestedSourceCount}
                  </span>
                  <span className="rounded-full border border-[rgba(255,255,255,0.08)] bg-[#0B0B0B] px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.18em] text-[#B7B0A8]">
                    Planner Proposed {plannerProposedSourceCount}
                  </span>
                  {policyRequiredSourceCount > 0 ? (
                    <span className="rounded-full border border-[rgba(255,255,255,0.08)] bg-[#0B0B0B] px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.18em] text-[#B7B0A8]">
                      Policy Required {policyRequiredSourceCount}
                    </span>
                  ) : null}
                  {fallbackCandidateSourceCount > 0 ? (
                    <span className="rounded-full border border-[rgba(255,255,255,0.08)] bg-[#0B0B0B] px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.18em] text-[#B7B0A8]">
                      Fallback Candidates {fallbackCandidateSourceCount}
                    </span>
                  ) : null}
                  {requestedSourceCount > 0 ? (
                    <span className="rounded-full border border-[rgba(126,200,227,0.18)] bg-[rgba(126,200,227,0.08)] px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.18em] text-[#9FCBE0]">
                      Active Requests {requestedSourceCount}
                    </span>
                  ) : null}
                </div>
                <p className="mt-2 text-xs leading-5 text-[#6F6A64]">
                  Request origins: {buildContextSourceOriginSummary(data.context.sourceSelection)}
                </p>
                <div className="mt-4 grid gap-2">
                  {data.context.sourceDecisions.map((source) => (
                    <div
                      key={`source-decision-${source.sourceId}`}
                      className={cn(
                        "rounded-2xl border px-3 py-3",
                        source.admission.status === "allowed"
                          ? "border-[rgba(75,156,211,0.16)] bg-[rgba(75,156,211,0.08)]"
                          : "border-[rgba(255,255,255,0.06)] bg-[rgba(255,255,255,0.03)]"
                      )}
                    >
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="text-sm font-semibold text-[#F6F3EE]">{source.label}</p>
                        <span className="rounded-full border border-[rgba(255,255,255,0.08)] bg-[#0B0B0B] px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.18em] text-[#B7B0A8]">
                          {formatContextSourceRequestStatusLabel(source.request.status)}
                        </span>
                        {source.request.origins.map((origin) => (
                          <span
                            key={`${source.sourceId}-${origin}`}
                            className="rounded-full border border-[rgba(255,255,255,0.08)] bg-[#0B0B0B] px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.18em] text-[#B7B0A8]"
                          >
                            {formatContextSourceRequestOriginLabel(origin)}
                          </span>
                        ))}
                        <span className="rounded-full border border-[rgba(255,255,255,0.08)] bg-[#0B0B0B] px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.18em] text-[#B7B0A8]">
                          {formatContextSourceAdmissionStatusLabel(source.admission.status)}
                        </span>
                        <span className="rounded-full border border-[rgba(255,255,255,0.08)] bg-[#0B0B0B] px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.18em] text-[#B7B0A8]">
                          {formatContextSourceExecutionStatusLabel(source.execution.status)}
                        </span>
                        {source.exclusion ? (
                          <span className="rounded-full border border-[rgba(240,200,137,0.18)] bg-[rgba(240,200,137,0.08)] px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.18em] text-[#F0C889]">
                            {formatContextSourceExclusionCategoryLabel(source.exclusion.category)}
                          </span>
                        ) : null}
                      </div>
                      <p className="mt-1 text-xs leading-5 text-[#B7B0A8]">{source.request.detail}</p>
                      <p className={cn(
                        "mt-1 text-sm leading-6",
                        source.admission.status === "allowed" ? "text-[#9FCBE0]" : "text-[#8D877F]"
                      )}>
                        {source.detail}
                      </p>
                      <p className="mt-1 text-xs leading-5 text-[#B7B0A8]">{source.execution.detail}</p>
                      {source.execution.summary ? (
                        <div className="mt-2 flex flex-wrap gap-2">
                          <span className="rounded-full border border-[rgba(255,255,255,0.08)] bg-[#0B0B0B] px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.18em] text-[#B7B0A8]">
                            {formatContextSourceExecutionSummary(source.execution.summary)}
                          </span>
                          {source.execution.summary.excludedCategories.map((category) => (
                            <span
                              key={`${source.sourceId}-${category}`}
                              className="rounded-full border border-[rgba(255,255,255,0.08)] bg-[#0B0B0B] px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.18em] text-[#B7B0A8]"
                            >
                              {formatContextSourceExclusionCategoryLabel(category)}
                            </span>
                          ))}
                        </div>
                      ) : null}
                    </div>
                  ))}
                </div>
              </div>
            ) : null}

            {data.context.resolvedSources.length > 0 ? (
              <div className="mt-5 rounded-2xl border border-[rgba(255,255,255,0.06)] bg-[#101010] p-4">
                <div className="flex items-center justify-between gap-3">
                  <p className="text-sm font-semibold text-[#F6F3EE]">Runtime Outcomes</p>
                  <span className="text-xs text-[#6F6A64]">{data.context.resolvedSources.length} files checked</span>
                </div>
                <div className="mt-3 grid gap-2">
                  {data.context.resolvedSources.map((source, index) => {
                    return (
                      <div
                        key={`${source.kind}-${source.target}-${index}`}
                        className="rounded-2xl border border-[rgba(255,255,255,0.06)] bg-[rgba(255,255,255,0.03)] px-3 py-3"
                      >
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="text-sm font-semibold text-[#F6F3EE]">{source.label}</p>
                          <span className="rounded-full border border-[rgba(255,255,255,0.08)] bg-[#0B0B0B] px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.18em] text-[#B7B0A8]">
                            {formatResolvedSourceStatusLabel(source.status)}
                          </span>
                        </div>
                        <p className="mt-1 text-sm leading-6 text-[#8D877F]">{source.detail}</p>
                      </div>
                    );
                  })}
                </div>
              </div>
            ) : null}

            <div className="mt-5 grid gap-4">
              {data.payload.resolvedContextText ? (
                <div className="rounded-2xl border border-[rgba(255,255,255,0.06)] bg-[#101010] p-4">
                  <div className="flex items-center justify-between gap-3">
                    <p className="text-sm font-semibold text-[#F6F3EE]">Resolved Thread Context</p>
                    <span className="text-xs text-[#6F6A64]">Current conversation only</span>
                  </div>
                  <pre className="mt-3 max-h-[18rem] overflow-auto whitespace-pre-wrap rounded-2xl bg-[#0B0B0B] p-4 text-xs leading-6 text-[#D7D2CC]">{data.payload.resolvedContextText}</pre>
                </div>
              ) : null}

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

export function TeamClient({
  currentUserId,
  users,
  invites,
  agents,
  projects,
  initialConversations,
}: Props) {
  const { collapseForChatFocus: collapseDesktopSidebarForChatFocus, releaseChatFocus: releaseDesktopSidebarChatFocus } = useDesktopSidebar();
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
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
  const [chatProjects, setChatProjects] = useState(projects);
  const [chatProjectsLoading, setChatProjectsLoading] = useState(false);
  const [chatProjectsError, setChatProjectsError] = useState<string | null>(null);
  const [selectedConversationId, setSelectedConversationId] = useState<string | null>(null);
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(null);
  const [discoveryQuery, setDiscoveryQuery] = useState("");
  const [searchResults, setSearchResults] = useState<ConversationSearchResult[]>([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);
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
  const [agentInspectorErrorConversationId, setAgentInspectorErrorConversationId] = useState<string | null>(null);
  const [copiedMessageId, setCopiedMessageId] = useState<string | null>(null);
  const [copiedInspectorView, setCopiedInspectorView] = useState<"pretty" | "json" | null>(null);
  const [showInvite, setShowInvite] = useState(false);
  const [showNewThreadModal, setShowNewThreadModal] = useState(false);
  const [showDiscoveryView, setShowDiscoveryView] = useState(initialConversations.length === 0);
  const [showArchivedView, setShowArchivedView] = useState(false);
  const [archivedConversations, setArchivedConversations] = useState<ConversationSummary[]>([]);
  const [archivedConversationsLoaded, setArchivedConversationsLoaded] = useState(false);
  const [archivedConversationsLoading, setArchivedConversationsLoading] = useState(false);
  const [archivedConversationsError, setArchivedConversationsError] = useState<string | null>(null);
  const [archivedActionError, setArchivedActionError] = useState<string | null>(null);
  const [archivedActionConversationId, setArchivedActionConversationId] = useState<string | null>(null);
  const [restoringConversationId, setRestoringConversationId] = useState<string | null>(null);
  const [deletingArchivedConversationId, setDeletingArchivedConversationId] = useState<string | null>(null);
  const [newThreadInitialProjectId, setNewThreadInitialProjectId] = useState<string | null>(null);
  const [showAddParticipantsModal, setShowAddParticipantsModal] = useState(false);
  const [participantActionError, setParticipantActionError] = useState<string | null>(null);
  const [projectActionError, setProjectActionError] = useState<string | null>(null);
  const [threadDocumentError, setThreadDocumentError] = useState<string | null>(null);
  const [threadDocumentUploads, setThreadDocumentUploads] = useState<ThreadDocumentUploadMap>({});
  const [switchingActiveAgentId, setSwitchingActiveAgentId] = useState<string | null>(null);
  const [clearingActiveAgentPin, setClearingActiveAgentPin] = useState(false);
  const [removingParticipantId, setRemovingParticipantId] = useState<string | null>(null);
  const [removingDocumentId, setRemovingDocumentId] = useState<string | null>(null);
  const [movingProject, setMovingProject] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const chatScrollRef = useRef<HTMLDivElement>(null);
  const isAtBottomRef = useRef(true);
  const userScrolledUpRef = useRef(false);
  const conversationsRef = useRef(conversations);
  const messagesByConversationRef = useRef<Record<string, ChatMessage[]>>({});
  const selectedConversationIdRef = useRef<string | null>(selectedConversationId);
  const threadUploadDismissTimersRef = useRef<Record<string, number>>({});
  const threadSwitchMeasurementRef = useRef<{
    conversationId: string;
    source: string;
    startedAt: number;
    spanId: string | null;
    shellPaintMeasured: boolean;
    readyMeasured: boolean;
  } | null>(null);
  const threadDrawerToggleSpanRef = useRef<string | null>(null);
  const contextInspectorToggleSpanRef = useRef<string | null>(null);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [showThreadStarter, setShowThreadStarter] = useState(initialConversations.length === 0);
  const [threadDrawerOpen, setThreadDrawerOpen] = useState(false);
  const hasStreamingAgentMessage = messages.some((message) => message.isStreaming);
  const hasPendingLocalMessage = messages.some(isLocalPendingChatMessage);
  const hasHandledAgentParamRef = useRef(false);
  const routeView = searchParams.get("view");
  const routeContext = searchParams.get("context");
  const routeConversationId = searchParams.get("conversationId");
  const routeProjectId = searchParams.get("projectId");
  const routeQuery = searchParams.get("q") ?? "";
  const routeAgentId = searchParams.get("agent");

  const isConversationStillSelected = useCallback((conversationId: string | null) => {
    return selectedConversationIdRef.current === conversationId;
  }, []);

  useEffect(() => {
    return () => {
      Object.values(threadUploadDismissTimersRef.current).forEach((timerId) => {
        window.clearTimeout(timerId);
      });
      threadUploadDismissTimersRef.current = {};
    };
  }, []);

  function clearThreadUploadDismiss(uploadId: string) {
    const timeoutId = threadUploadDismissTimersRef.current[uploadId];
    if (timeoutId) {
      window.clearTimeout(timeoutId);
      delete threadUploadDismissTimersRef.current[uploadId];
    }
  }

  function scheduleThreadUploadDismiss(conversationId: string, uploadId: string, delayMs = 2400) {
    clearThreadUploadDismiss(uploadId);
    threadUploadDismissTimersRef.current[uploadId] = window.setTimeout(() => {
      updateThreadDocumentUploads(
        conversationId,
        (current) => current.filter((upload) => upload.id !== uploadId)
      );
      delete threadUploadDismissTimersRef.current[uploadId];
    }, delayMs);
  }

  const reconcileMessagesForConversation = useCallback((
    currentMessages: ChatMessage[],
    incomingMessages: ChatMessage[]
  ) => {
    const currentMessagesById = new Map(currentMessages.map((message) => [message.id, message]));
    const serverMessages = sortChatMessagesChronologically(
      incomingMessages.map((message) => {
        const currentMessage = currentMessagesById.get(message.id);
        if (!currentMessage) {
          return message;
        }

        return {
          ...message,
          clientRequestId: currentMessage.clientRequestId ?? message.clientRequestId,
          retrievalSources: message.retrievalSources ?? currentMessage.retrievalSources,
          toolActivity: message.toolActivity ?? currentMessage.toolActivity,
        };
      })
    );
    const pendingMessages = currentMessages.filter((message) => message.clientState);

    if (pendingMessages.length === 0) {
      return serverMessages;
    }

    const matchedServerUserByRequestId = new Map<string, ChatMessage>();

    const findServerUserForLocalMessage = (localMessage: ChatMessage) => {
      const requestId = localMessage.clientRequestId?.trim();
      if (requestId && matchedServerUserByRequestId.has(requestId)) {
        return matchedServerUserByRequestId.get(requestId) ?? null;
      }

      const localCreatedAt = new Date(localMessage.createdAt).getTime();
      const match = serverMessages.find((message) => {
        if (message.sender?.kind !== "user" || message.sender.id !== currentUserId) {
          return false;
        }

        if (message.body !== localMessage.body) {
          return false;
        }

        const createdAtDelta = Math.abs(new Date(message.createdAt).getTime() - localCreatedAt);
        return createdAtDelta <= 60_000;
      }) ?? null;

      if (requestId && match) {
        matchedServerUserByRequestId.set(requestId, match);
      }

      return match;
    };

    const mergedMessages = [...serverMessages];

    for (const pendingMessage of pendingMessages) {
      if (pendingMessage.clientState === "failed_user" || pendingMessage.clientState === "failed_assistant") {
        mergedMessages.push(pendingMessage);
        continue;
      }

      if (pendingMessage.clientState === "optimistic_user") {
        if (!findServerUserForLocalMessage(pendingMessage)) {
          mergedMessages.push(pendingMessage);
        }
        continue;
      }

      const relatedUserMessage = pendingMessages.find(
        (message) =>
          message.clientState === "optimistic_user"
          && message.clientRequestId
          && message.clientRequestId === pendingMessage.clientRequestId
      ) ?? null;
      const relatedServerUserMessage = relatedUserMessage
        ? findServerUserForLocalMessage(relatedUserMessage)
        : null;
      const assistantCreatedAfter =
        new Date(relatedServerUserMessage?.createdAt ?? relatedUserMessage?.createdAt ?? pendingMessage.createdAt).getTime()
        - 1_000;
      const hasServerAssistantMatch = serverMessages.some((message) =>
        message.sender?.kind === "agent"
        && new Date(message.createdAt).getTime() >= assistantCreatedAfter
      );

      if (!hasServerAssistantMatch) {
        mergedMessages.push(pendingMessage);
      }
    }

    return sortChatMessagesChronologically(mergedMessages);
  }, [currentUserId]);

  const replaceMessagesForConversation = useCallback((
    conversationId: string | null,
    nextMessages: ChatMessage[],
    reason = "replace"
  ) => {
    if (!isConversationStillSelected(conversationId)) {
      return;
    }

    setMessages((current) => {
      if (!isConversationStillSelected(conversationId)) {
        return current;
      }

      const reconciledMessages = reconcileMessagesForConversation(current, nextMessages);
      incrementTeamChatPerfCounter(`message_list:replace:${reason}`, {
        conversationId,
        previousCount: current.length,
        nextCount: reconciledMessages.length,
        delta: reconciledMessages.length - current.length,
      });

      return reconciledMessages;
    });
  }, [isConversationStillSelected, reconcileMessagesForConversation]);

  const updateMessagesForConversation = useCallback((
    conversationId: string | null,
    updater: (current: ChatMessage[]) => ChatMessage[],
    reason = "update"
  ) => {
    if (!isConversationStillSelected(conversationId)) {
      return;
    }

    setMessages((current) => {
      if (!isConversationStillSelected(conversationId)) {
        return current;
      }

      const nextMessages = sortChatMessagesChronologically(updater(current));
      incrementTeamChatPerfCounter(`message_list:update:${reason}`, {
        conversationId,
        previousCount: current.length,
        nextCount: nextMessages.length,
        delta: nextMessages.length - current.length,
      });

      return nextMessages;
    });
  }, [isConversationStillSelected]);

  const clearConversationInspectorState = useCallback(() => {
    setAgentInspector(null);
    setAgentInspectorError(null);
    setAgentInspectorErrorConversationId(null);
    setAgentInspectorLoading(false);
  }, []);

  const startInspectorRequestForConversation = useCallback((conversationId: string) => {
    if (!isConversationStillSelected(conversationId)) {
      return false;
    }

    setAgentInspectorLoading((current) => (
      isConversationStillSelected(conversationId)
        ? true
        : current
    ));
    setAgentInspectorError((current) => (
      isConversationStillSelected(conversationId)
        ? null
        : current
    ));
    setAgentInspectorErrorConversationId((current) => (
      isConversationStillSelected(conversationId)
        ? null
        : current
    ));

    return true;
  }, [isConversationStillSelected]);

  const applyInspectorForConversation = useCallback((
    conversationId: string,
    inspectorData: AgentInspectorData
  ) => {
    if (!isConversationStillSelected(conversationId) || inspectorData.conversationId !== conversationId) {
      return false;
    }

    setAgentInspector((current) => (
      isConversationStillSelected(conversationId)
        ? inspectorData
        : current
    ));
    setAgentInspectorError((current) => (
      isConversationStillSelected(conversationId)
        ? null
        : current
    ));
    setAgentInspectorErrorConversationId((current) => (
      isConversationStillSelected(conversationId)
        ? null
        : current
    ));

    return true;
  }, [isConversationStillSelected]);

  const setInspectorErrorForConversation = useCallback((
    conversationId: string,
    errorMessage: string
  ) => {
    if (!isConversationStillSelected(conversationId)) {
      return;
    }

    setAgentInspector((current) => (
      isConversationStillSelected(conversationId)
        ? null
        : current
    ));
    setAgentInspectorError((current) => (
      isConversationStillSelected(conversationId)
        ? errorMessage
        : current
    ));
    setAgentInspectorErrorConversationId((current) => (
      isConversationStillSelected(conversationId)
        ? conversationId
        : current
    ));
  }, [isConversationStillSelected]);

  const finishInspectorRequestForConversation = useCallback((conversationId: string) => {
    if (!isConversationStillSelected(conversationId)) {
      return;
    }

    setAgentInspectorLoading((current) => (
      isConversationStillSelected(conversationId)
        ? false
        : current
    ));
  }, [isConversationStillSelected]);

  function handleChatScroll() {
    const el = chatScrollRef.current;
    if (!el) return;
    const distanceFromBottom = el.scrollHeight - el.scrollTop - el.clientHeight;
    const nearBottom = distanceFromBottom < 120;
    isAtBottomRef.current = nearBottom;
    userScrolledUpRef.current = !nearBottom;
  }

  const currentUser = members.find((member) => member.id === currentUserId);
  const currentUserName = currentUser ? getMemberDisplayName(currentUser) : "You";

  const syncTeamChatRoute = useCallback((routeState: TeamChatRouteState, history: "push" | "replace" = "push") => {
    const nextHref = buildTeamChatHref(pathname, routeState);
    const currentQuery = searchParams.toString();
    const currentHref = currentQuery ? `${pathname}?${currentQuery}` : pathname;

    if (nextHref === currentHref) {
      return;
    }

    if (history === "replace") {
      router.replace(nextHref, { scroll: false });
      return;
    }

    router.push(nextHref, { scroll: false });
  }, [pathname, router, searchParams]);

  const getThreadOriginState = useCallback((): Exclude<TeamChatRouteState, { kind: "rail" } | { kind: "thread" }> | null => {
    const trimmedQuery = discoveryQuery.trim();

    if (showArchivedView) {
      return trimmedQuery ? { kind: "archived", query: trimmedQuery } : { kind: "archived" };
    }

    if (trimmedQuery) {
      return {
        kind: "search",
        query: trimmedQuery,
        projectId: selectedProjectId,
      };
    }

    if (selectedProjectId) {
      return {
        kind: "project",
        projectId: selectedProjectId,
      };
    }

    if (showDiscoveryView) {
      return { kind: "discovery" };
    }

    return null;
  }, [discoveryQuery, selectedProjectId, showArchivedView, showDiscoveryView]);

  const getThreadRouteState = useCallback((conversationId: string): Extract<TeamChatRouteState, { kind: "thread" }> => {
    const origin = getThreadOriginState();

    if (!origin) {
      return { kind: "thread", conversationId };
    }

    if (origin.kind === "search") {
      return {
        kind: "thread",
        conversationId,
        context: "search",
        projectId: origin.projectId,
        query: origin.query,
      };
    }

    if (origin.kind === "project") {
      return {
        kind: "thread",
        conversationId,
        context: "project",
        projectId: origin.projectId,
      };
    }

    if (origin.kind === "archived") {
      return {
        kind: "thread",
        conversationId,
        context: "archived",
        query: origin.query,
      };
    }

    return {
      kind: "thread",
      conversationId,
      context: "discover",
    };
  }, [getThreadOriginState]);

  const getFallbackRouteState = useCallback((): TeamChatRouteState => {
    return getThreadOriginState() ?? { kind: "rail" };
  }, [getThreadOriginState]);

  const beginThreadSwitchMeasurement = useCallback((conversationId: string, source: string) => {
    const startedAt = performance.now();
    recordTeamChatPerfEvent("thread_switch:start", {
      conversationId,
      source,
      previousConversationId: selectedConversationIdRef.current,
    });
    threadSwitchMeasurementRef.current = {
      conversationId,
      source,
      startedAt,
      spanId: startTeamChatPerfSpan("thread_switch", {
        conversationId,
        source,
        previousConversationId: selectedConversationIdRef.current,
      }),
      shellPaintMeasured: false,
      readyMeasured: false,
    };
  }, []);

  const finishThreadSwitchMeasurement = useCallback((
    conversationId: string,
    status: "ready" | "error" | "not_found",
    detail?: Record<string, unknown>
  ) => {
    const pendingMeasurement = threadSwitchMeasurementRef.current;
    if (!pendingMeasurement || pendingMeasurement.conversationId !== conversationId || pendingMeasurement.readyMeasured) {
      return;
    }

    pendingMeasurement.readyMeasured = true;
    const durationMs = performance.now() - pendingMeasurement.startedAt;
    recordTeamChatPerfEvent("thread_switch:ready", {
      conversationId,
      source: pendingMeasurement.source,
      status,
      durationMs,
      ...(detail ?? {}),
    });
    finishTeamChatPerfSpan(pendingMeasurement.spanId, {
      status,
      durationMs,
      ...(detail ?? {}),
    });
    if (threadSwitchMeasurementRef.current === pendingMeasurement) {
      threadSwitchMeasurementRef.current = null;
    }
  }, []);

  const setThreadDrawerVisibility = useCallback((nextOpen: boolean, source: string) => {
    const conversationId = selectedConversationIdRef.current;
    if (conversationId) {
      recordTeamChatPerfEvent("thread_drawer_toggle:start", {
        conversationId,
        nextOpen,
        source,
      });
      threadDrawerToggleSpanRef.current = startTeamChatPerfSpan("thread_drawer_toggle", {
        conversationId,
        nextOpen,
        source,
      });
    }

    setThreadDrawerOpen(nextOpen);
  }, []);

  const toggleThreadDrawer = useCallback(() => {
    setThreadDrawerVisibility(!threadDrawerOpen, "header_toggle");
  }, [setThreadDrawerVisibility, threadDrawerOpen]);

  const closeThreadDrawer = useCallback(() => {
    setThreadDrawerVisibility(false, "drawer_close");
  }, [setThreadDrawerVisibility]);

  const openContextInspector = useCallback(() => {
    const conversationId = selectedConversationIdRef.current;
    if (conversationId) {
      recordTeamChatPerfEvent("context_inspector_toggle:start", {
        conversationId,
        nextOpen: true,
      });
      contextInspectorToggleSpanRef.current = startTeamChatPerfSpan("context_inspector_toggle", {
        conversationId,
        nextOpen: true,
      });
    }

    setShowContextInspector(true);
  }, []);

  const closeContextInspector = useCallback(() => {
    setShowContextInspector(false);
  }, []);

  function openSearchDiscovery() {
    setSelectedConversationId(null);
    setSelectedProjectId(null);
    setDiscoveryQuery("");
    setShowDiscoveryView(true);
    setShowArchivedView(false);
    syncTeamChatRoute({ kind: "discovery" });
  }

  function openProjectSummary(projectId: string) {
    setSelectedConversationId(null);
    setSelectedProjectId(projectId);
    setDiscoveryQuery("");
    setShowDiscoveryView(true);
    setShowArchivedView(false);
    syncTeamChatRoute({ kind: "project", projectId });
  }

  function openArchivedThreads() {
    setSelectedConversationId(null);
    setSelectedProjectId(null);
    setDiscoveryQuery("");
    setShowDiscoveryView(true);
    setShowArchivedView(true);
    setArchivedActionError(null);
    setArchivedActionConversationId(null);
    syncTeamChatRoute({ kind: "archived" });
  }

  function openConversationFromRail(conversationId: string) {
    const nextRouteState = getThreadRouteState(conversationId);
    beginThreadSwitchMeasurement(conversationId, "rail");
    setSelectedConversationId(conversationId);
    if (!nextRouteState.context) {
      setSelectedProjectId(null);
      setDiscoveryQuery("");
      setShowDiscoveryView(false);
      setShowArchivedView(false);
    }
    syncTeamChatRoute(nextRouteState);
  }

  function openConversationFromDiscovery(conversationId: string) {
    beginThreadSwitchMeasurement(conversationId, "discovery");
    setSelectedConversationId(conversationId);
    syncTeamChatRoute(getThreadRouteState(conversationId));
  }

  function handleDiscoveryQueryChange(value: string) {
    const trimmedValue = value.trim();
    const nextRouteState = showArchivedView
      ? (
          trimmedValue
            ? {
                kind: "archived" as const,
                query: value,
              }
            : {
                kind: "archived" as const,
              }
        )
      : trimmedValue
        ? {
            kind: "search" as const,
            query: value,
            projectId: selectedProjectId,
          }
        : selectedProjectId
          ? {
              kind: "project" as const,
              projectId: selectedProjectId,
            }
          : {
              kind: "discovery" as const,
            };

    setSelectedConversationId(null);
    setDiscoveryQuery(value);
    setShowDiscoveryView(true);
    syncTeamChatRoute(
      nextRouteState,
      searchParams.get("view") === "search" || searchParams.get("view") === "archived" ? "replace" : "push"
    );
  }

  function openNewThreadComposer(projectId?: string | null) {
    setShowThreadStarter(false);
    setNewThreadInitialProjectId(projectId ?? null);
    setShowNewThreadModal(true);
  }

  function closeNewThreadModal() {
    setShowNewThreadModal(false);
    setNewThreadInitialProjectId(null);
  }

  function closeDiscoveryPane() {
    setSelectedProjectId(null);
    setDiscoveryQuery("");
    setShowDiscoveryView(false);
    setShowArchivedView(false);
    setArchivedActionError(null);
    setArchivedActionConversationId(null);
    syncTeamChatRoute({ kind: "rail" }, "replace");
  }

  function closeActiveConversation() {
    setSelectedConversationId(null);
    syncTeamChatRoute(getFallbackRouteState(), "replace");
  }

  async function loadArchivedConversations(options?: { silent?: boolean }) {
    const silent = options?.silent === true;

    if (!silent) {
      setArchivedConversationsLoading(true);
    }
    setArchivedConversationsError(null);

    try {
      const response = await fetch("/api/chat/conversations?archived=only", {
        headers: { Accept: "application/json" },
        cache: "no-store",
      });
      const data = await parseApiResponse(response);

      if (!response.ok || !Array.isArray(data.conversations)) {
        throw new Error(getApiErrorMessage(data.error) ?? "Unable to load archived threads right now.");
      }

      setArchivedConversations(sortConversationsByUpdatedAt(data.conversations as ConversationSummary[]));
      setArchivedConversationsLoaded(true);
    } catch (error) {
      setArchivedConversations((current) => (archivedConversationsLoaded ? current : []));
      setArchivedConversationsError(
        error instanceof Error ? error.message : "Unable to load archived threads right now."
      );
    } finally {
      if (!silent) {
        setArchivedConversationsLoading(false);
      }
    }
  }

  async function loadChatProjects(options?: { silent?: boolean }) {
    const silent = options?.silent === true;

    if (!silent) {
      setChatProjectsLoading(true);
    }
    setChatProjectsError(null);

    try {
      const response = await fetch("/api/chat/projects");
      const data = await response.json();

      if (!response.ok || !Array.isArray(data.projects)) {
        throw new Error(data.error ?? "Unable to load chat projects right now.");
      }

      setChatProjects((current) => mergeChatProjects(current, data.projects as ChatProjectOption[]));
    } catch (error) {
      if (!silent) {
        setChatProjectsError(error instanceof Error ? error.message : "Unable to load chat projects right now.");
      }
    } finally {
      if (!silent) {
        setChatProjectsLoading(false);
      }
    }
  }

  async function createChatProject(name: string) {
    const projectName = name.trim();
    if (!projectName) {
      throw new Error("Project name is required.");
    }

    const response = await fetch("/api/chat/projects", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: projectName }),
    });
    const data = await response.json();

    if (!response.ok || !data.project || typeof data.project.id !== "string") {
      throw new Error(data.error ?? "Unable to create that chat project right now.");
    }

    const project = data.project as ChatProjectOption;
    setChatProjects((current) => mergeChatProjects(current, [project]));
    return project;
  }

  async function renameChatProject(projectId: string, name: string) {
    const projectName = name.trim();
    if (!projectName) {
      throw new Error("Project name is required.");
    }

    const response = await fetch(`/api/chat/projects/${projectId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: projectName }),
    });
    const data = await response.json();

    if (!response.ok || !data.project || typeof data.project.id !== "string") {
      throw new Error(data.error ?? "Unable to rename that chat project right now.");
    }

    const project = data.project as ChatProjectOption;
    setChatProjects((current) => mergeChatProjects(current.filter((entry) => entry.id !== project.id), [project]));
    setConversations((current) =>
      current.map((conversation) =>
        conversation.project?.id === project.id
          ? {
              ...conversation,
              project,
            }
          : conversation
      )
    );

    return project;
  }

  async function deleteChatProject(projectId: string) {
    const response = await fetch(`/api/chat/projects/${projectId}`, {
      method: "DELETE",
    });
    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error ?? "Unable to delete that chat project right now.");
    }

    setChatProjects((current) => current.filter((project) => project.id !== projectId));
    if (selectedProjectId === projectId) {
      const nextProjectId = "general";
      setSelectedProjectId(nextProjectId);
      setShowDiscoveryView(true);
      syncTeamChatRoute(
        discoveryQuery.trim()
          ? {
              kind: "search",
              query: discoveryQuery,
              projectId: nextProjectId,
            }
          : {
              kind: "project",
              projectId: nextProjectId,
            },
        "replace"
      );
    }
    setConversations((current) =>
      current.map((conversation) =>
        conversation.project?.id === projectId
          ? {
              ...conversation,
              project: null,
            }
          : conversation
      )
    );

    return data as { deletedProjectId: string; movedThreadCount: number };
  }

  async function ensureChatProjectForSelection(selection: NewThreadSelection) {
    const selectedProjectId = chatProjects.some((project) => project.id === selection.projectId)
      ? selection.projectId
      : null;

    if (selectedProjectId) {
      return selectedProjectId;
    }

    const projectName = selection.projectName.trim();
    if (!projectName) {
      return null;
    }

    const project = await createChatProject(projectName);
    return project.id;
  }

  useEffect(() => {
    function pingPresence() {
      incrementTeamChatPerfCounter("presence:ping");
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
          incrementTeamChatPerfCounter("team_refresh:interval", {
            memberCount: Array.isArray(data.users) ? data.users.length : null,
          });
          setMembers(data.users);
        }
      } catch {
      }
    }

    const interval = setInterval(refreshTeam, 30_000);
    return () => clearInterval(interval);
  }, []);

  const refreshConversations = useCallback(async (trigger: "mount" | "interval") => {
    try {
      const response = await fetch("/api/chat/conversations", {
        headers: { Accept: "application/json" },
        cache: "no-store",
      });
      const data = await parseApiResponse(response);

      if (!response.ok || !Array.isArray(data.conversations)) {
        return;
      }

      incrementTeamChatPerfCounter(`conversations_refresh:${trigger}`, {
        conversationCount: data.conversations.length,
      });
      setConversations(data.conversations as ConversationSummary[]);
    } catch {
    }
  }, []);

  useEffect(() => {
    // Reconcile server-rendered thread state with the live access-trimmed list
    // before the user opens a thread that detail routes would reject.
    void refreshConversations("mount");

    const interval = setInterval(() => {
      void refreshConversations("interval");
    }, 30_000);

    return () => clearInterval(interval);
  }, [refreshConversations]);

  useEffect(() => {
    void loadChatProjects({ silent: projects.length > 0 });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const conversationProjects = conversations
      .map((conversation) => conversation.project)
      .filter((project): project is ChatProjectOption => project !== null);

    if (conversationProjects.length === 0) {
      return;
    }

    setChatProjects((current) => {
      return mergeChatProjects(current, conversationProjects);
    });
  }, [conversations]);

  useEffect(() => {
    if (!showNewThreadModal) return;
    void loadChatProjects();
  }, [showNewThreadModal]);

  useEffect(() => {
    if (!threadDrawerOpen) return;
    void loadChatProjects({ silent: chatProjects.length > 0 });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [threadDrawerOpen]);

  useEffect(() => {
    if (!showArchivedView) return;
    void loadArchivedConversations({ silent: archivedConversationsLoaded });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [showArchivedView]);

  const activeConversation = useMemo(
    () => conversations.find((conversation) => conversation.id === selectedConversationId) ?? null,
    [conversations, selectedConversationId]
  );
  const activeConversationId = activeConversation?.id ?? null;
  const routeConversationVisible = useMemo(
    () => (routeConversationId ? conversations.some((conversation) => conversation.id === routeConversationId) : false),
    [conversations, routeConversationId]
  );
  const activeConversationDirectPartner = useMemo(
    () => (activeConversation?.type === "direct" ? getDirectConversationPartner(activeConversation, currentUserId) : null),
    [activeConversation, currentUserId]
  );
  const activeConversationPrimaryAgent = useMemo(
    () => getPrimaryAgentParticipant(activeConversation),
    [activeConversation]
  );
  const renderedMessages = useMemo(() => dedupeChatMessages(messages), [messages]);
  const invalidateConversationAccessRef = useRef<(conversationId: string) => void>(() => {});

  conversationsRef.current = conversations;
  selectedConversationIdRef.current = activeConversationId;
  invalidateConversationAccessRef.current = (conversationId: string) => {
    clearConversationInspectorState();
    removeConversationFromVisibleState(conversationId);
  };

  useEffect(() => {
    if (!selectedConversationId) {
      return;
    }

    messagesByConversationRef.current[selectedConversationId] = messages;
  }, [messages, selectedConversationId]);

  useEffect(() => {
    const conversationId = activeConversationId;

    if (!conversationId) {
      setLoadingMessages(false);
      return;
    }

    const resolvedConversationId = conversationId;

    async function loadMessages() {
      incrementTeamChatPerfCounter("messages_fetch:load", {
        conversationId: resolvedConversationId,
      });
      setLoadingMessages(true);
      try {
        const response = await fetch(`/api/chat/conversations/${resolvedConversationId}/messages`, {
          headers: { Accept: "application/json" },
          cache: "no-store",
        });
        const data = await parseApiResponse(response);

        if (response.status === 404) {
          finishThreadSwitchMeasurement(resolvedConversationId, "not_found", {
            trigger: "thread_open",
          });
          invalidateConversationAccessRef.current(resolvedConversationId);
          return;
        }

        if (!response.ok) {
          finishThreadSwitchMeasurement(resolvedConversationId, "error", {
            trigger: "thread_open",
            statusCode: response.status,
          });
          return;
        }

        if (Array.isArray(data.messages)) {
          replaceMessagesForConversation(
            resolvedConversationId,
            data.messages as ChatMessage[],
            "thread_open"
          );
          finishThreadSwitchMeasurement(resolvedConversationId, "ready", {
            trigger: "thread_open",
            messageCount: (data.messages as ChatMessage[]).length,
          });
        }
        if (
          data.conversation
          && typeof data.conversation === "object"
          && isConversationStillSelected(resolvedConversationId)
        ) {
          const nextConversation = data.conversation as ConversationSummary;
          setConversations((current) => {
            const others = current.filter((conversation) => conversation.id !== nextConversation.id);
            return [nextConversation, ...others].sort(
              (a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
            );
          });
        }
      } catch {
      } finally {
        if (isConversationStillSelected(resolvedConversationId)) {
          setLoadingMessages(false);
        }
      }
    }

    loadMessages();
  }, [activeConversationId, finishThreadSwitchMeasurement, isConversationStillSelected, replaceMessagesForConversation]);

  useEffect(() => {
    const conversationId = activeConversationId;
    if (!conversationId || hasStreamingAgentMessage || hasPendingLocalMessage || sending) return;

    const resolvedConversationId = conversationId;

    async function pollMessages() {
      try {
        incrementTeamChatPerfCounter("messages_fetch:poll", {
          conversationId: resolvedConversationId,
        });
        const response = await fetch(`/api/chat/conversations/${resolvedConversationId}/messages`, {
          headers: { Accept: "application/json" },
          cache: "no-store",
        });
        const data = await parseApiResponse(response);

        if (response.status === 404) {
          invalidateConversationAccessRef.current(resolvedConversationId);
          return;
        }

        if (!response.ok) {
          return;
        }

        if (Array.isArray(data.messages)) {
          replaceMessagesForConversation(
            resolvedConversationId,
            data.messages as ChatMessage[],
            "thread_poll"
          );
        }
      } catch {
      }
    }

    const interval = setInterval(pollMessages, 3_000);
    return () => clearInterval(interval);
  }, [activeConversationId, hasPendingLocalMessage, hasStreamingAgentMessage, replaceMessagesForConversation, sending]);

  useEffect(() => {
    if (!userScrolledUpRef.current && isAtBottomRef.current) {
      bottomRef.current?.scrollIntoView({ behavior: "instant" });
    }
  }, [messages]);

  useEffect(() => {
    if (selectedConversationId) {
      setShowThreadStarter(false);
    }
  }, [selectedConversationId]);

  useLayoutEffect(() => {
    if (!selectedConversationId) {
      setMessages([]);
      return;
    }

    setMessages(messagesByConversationRef.current[selectedConversationId] ?? []);
  }, [selectedConversationId]);

  useEffect(() => {
    if (!selectedConversationId) {
      return;
    }

    const pendingMeasurement = threadSwitchMeasurementRef.current;
    if (!pendingMeasurement || pendingMeasurement.conversationId !== selectedConversationId || pendingMeasurement.shellPaintMeasured) {
      return;
    }

    let firstFrame = 0;
    let secondFrame = 0;

    firstFrame = window.requestAnimationFrame(() => {
      secondFrame = window.requestAnimationFrame(() => {
        const activeMeasurement = threadSwitchMeasurementRef.current;
        if (!activeMeasurement || activeMeasurement.conversationId !== selectedConversationId || activeMeasurement.shellPaintMeasured) {
          return;
        }

        activeMeasurement.shellPaintMeasured = true;
        recordTeamChatPerfEvent("thread_switch:shell_paint", {
          conversationId: selectedConversationId,
          source: activeMeasurement.source,
          durationMs: performance.now() - activeMeasurement.startedAt,
          loadingMessages,
          rawMessageCount: messages.length,
        });
      });
    });

    return () => {
      window.cancelAnimationFrame(firstFrame);
      window.cancelAnimationFrame(secondFrame);
    };
  }, [loadingMessages, messages.length, selectedConversationId]);

  useLayoutEffect(() => {
    clearConversationInspectorState();
    isAtBottomRef.current = true;
    userScrolledUpRef.current = false;
    bottomRef.current?.scrollIntoView({ behavior: "instant" });
    setEditingMessageId(null);
    setEditingDraft("");
    setShowContextInspector(false);
    setShowAddParticipantsModal(false);
    setParticipantActionError(null);
    setProjectActionError(null);
    setThreadDocumentError(null);
    setClearingActiveAgentPin(false);
    setRemovingDocumentId(null);
    setMovingProject(false);
  }, [clearConversationInspectorState, selectedConversationId]);

  const refreshConversationInspector = useCallback(async (
    conversationId: string,
    trigger: "selection" | "focus" | "visibility" | "post_send" = "selection"
  ) => {
    incrementTeamChatPerfCounter(`inspector_refresh:${trigger}`, {
      conversationId,
    });
    const inspectorSpanId = startTeamChatPerfSpan("inspector_refresh", {
      conversationId,
      trigger,
    });

    if (!isConversationStillSelected(conversationId)) {
      finishTeamChatPerfSpan(inspectorSpanId, { status: "stale_selection" });
      return;
    }

    const convo = conversationsRef.current.find((conversation) => conversation.id === conversationId);
    const isAgentConversation = convo?.members.some((member) => member.kind === "agent");

    if (!isAgentConversation) {
      finishTeamChatPerfSpan(inspectorSpanId, { status: "skipped_no_agent" });
      if (isConversationStillSelected(conversationId)) {
        clearConversationInspectorState();
      }
      return;
    }

    if (!startInspectorRequestForConversation(conversationId)) {
      finishTeamChatPerfSpan(inspectorSpanId, { status: "request_not_started" });
      return;
    }

    try {
      const response = await fetch(`/api/chat/conversations/${conversationId}/inspect`, {
        headers: { Accept: "application/json" },
        cache: "no-store",
      });
      const data = await parseApiResponse(response);

      if (response.status === 404) {
        finishTeamChatPerfSpan(inspectorSpanId, { status: "not_found" });
        invalidateConversationAccessRef.current(conversationId);
        return;
      }

      if (!response.ok) {
        finishTeamChatPerfSpan(inspectorSpanId, {
          status: "error",
          statusCode: response.status,
        });
        setInspectorErrorForConversation(
          conversationId,
          getApiErrorMessage(data.error) ?? "Failed to initialize the agent"
        );
        return;
      }

      if (!("readiness" in data) || !("agent" in data) || !("threadLlm" in data)) {
        finishTeamChatPerfSpan(inspectorSpanId, { status: "invalid_payload" });
        setInspectorErrorForConversation(conversationId, "Failed to initialize the agent");
        return;
      }

      const inspectorData = data as unknown as AgentInspectorData;
      const appliedInspector = applyInspectorForConversation(conversationId, inspectorData);
      if (!appliedInspector) {
        finishTeamChatPerfSpan(inspectorSpanId, { status: "stale_apply" });
        return;
      }

      finishTeamChatPerfSpan(inspectorSpanId, {
        status: "ready",
        estimatedTokens: inspectorData.context.estimatedTokens,
        recentHistoryCount: inspectorData.context.recentHistoryCount,
        resolvedSourceCount: inspectorData.context.resolvedSources.length,
        consideredSourceCount: inspectorData.context.sourceSelection.consideredSourceIds.length,
      });

      setConversations((current) =>
        current.map((conversation) => {
          if (conversation.id !== conversationId) return conversation;

          return {
            ...conversation,
            llmThread: inspectorData.threadLlm,
            members: conversation.members.map((member) =>
              member.kind === "agent" && member.id === inspectorData.agent.id
                ? {
                    ...member,
                    llmStatus: inspectorData.agent.llmStatus,
                    llmModel: inspectorData.agent.llmModel,
                    llmThinkingMode: inspectorData.agent.llmThinkingMode,
                    llmLastCheckedAt: inspectorData.agent.llmLastCheckedAt,
                    llmLastError: inspectorData.agent.llmLastError,
                  }
                : member
            ),
          };
        })
      );
    } catch {
      finishTeamChatPerfSpan(inspectorSpanId, { status: "exception" });
      setInspectorErrorForConversation(conversationId, "Unable to initialize the agent right now");
    } finally {
      finishInspectorRequestForConversation(conversationId);
      setBootstrappingConversationId((current) => (current === conversationId ? null : current));
    }
  }, [
    applyInspectorForConversation,
    clearConversationInspectorState,
    finishInspectorRequestForConversation,
    isConversationStillSelected,
    setInspectorErrorForConversation,
    startInspectorRequestForConversation,
  ]);

  useEffect(() => {
    if (!activeConversationId) {
      clearConversationInspectorState();
      return;
    }

    void refreshConversationInspector(activeConversationId, "selection");
  }, [activeConversationId, activeConversationPrimaryAgent?.id, clearConversationInspectorState, refreshConversationInspector]);

  useEffect(() => {
    if (!activeConversationId) {
      return;
    }

    const conversationId = activeConversationId;

    function handleRefresh() {
      void refreshConversationInspector(conversationId, "focus");
    }

    function handleVisibilityChange() {
      if (document.visibilityState === "visible") {
        void refreshConversationInspector(conversationId, "visibility");
      }
    }

    window.addEventListener("focus", handleRefresh);
    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      window.removeEventListener("focus", handleRefresh);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [activeConversationId, refreshConversationInspector]);

  const threadSections = useMemo(
    () => getConversationProjectSections(conversations, chatProjects),
    [chatProjects, conversations]
  );

  useEffect(() => {
    if (!selectedProjectId) return;
    if (threadSections.some((section) => section.id === selectedProjectId)) return;
    setSelectedProjectId(null);
    syncTeamChatRoute(
      selectedConversationId ? { kind: "thread", conversationId: selectedConversationId } : getFallbackRouteState(),
      "replace"
    );
  }, [getFallbackRouteState, selectedConversationId, selectedProjectId, syncTeamChatRoute, threadSections]);

  useEffect(() => {
    if (!selectedConversationId) return;
    if (conversations.some((conversation) => conversation.id === selectedConversationId)) return;

    setSelectedConversationId(null);
    syncTeamChatRoute(getFallbackRouteState(), "replace");
  }, [conversations, getFallbackRouteState, selectedConversationId, syncTeamChatRoute]);

  const groupConversations = useMemo(
    () =>
      conversations
        .filter((conversation) => conversation.type === "group")
        .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()),
    [conversations]
  );

  const directConversationShortcuts = useMemo(
    () => buildDirectConversationShortcutMaps(conversations, currentUserId),
    [conversations, currentUserId]
  );
  const directConversationShortcutsByUserId = directConversationShortcuts.userShortcuts;
  const directConversationShortcutsByAgentId = directConversationShortcuts.agentShortcuts;

  const onlineCount = members.filter((member) => member.id === currentUserId || getOnlineStatus(member.lastSeen) === "online").length;

  function upsertConversation(nextConversation: ConversationSummary) {
    const nextProject = nextConversation.project;
    if (nextProject) {
      setChatProjects((current) => mergeChatProjects(current, [nextProject]));
    }

    setConversations((current) =>
      [nextConversation, ...current.filter((conversation) => conversation.id !== nextConversation.id)].sort(
        (a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
      )
    );
  }

  async function patchConversationById(
    conversationId: string,
    body: Record<string, unknown>,
    fallbackError: string
  ) {
    const response = await fetch(`/api/chat/conversations/${conversationId}`, {
      method: "PATCH",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    });
    const data = await parseApiResponse(response);

    if (!response.ok || !data.conversation || typeof data.conversation !== "object") {
      throw new Error(getApiErrorMessage(data.error) ?? fallbackError);
    }

    const conversation = data.conversation as ConversationSummary;

    upsertConversation(conversation);
    if (selectedConversationId === conversationId) {
      setSelectedConversationId(conversation.id);
    }
    if (conversation.members.some((member: ConversationMemberSummary) => member.kind === "agent")) {
      setBootstrappingConversationId(conversation.id);
    } else {
      setBootstrappingConversationId((current) => (current === conversation.id ? null : current));
    }

    return conversation;
  }

  async function patchConversationThread(
    body: Record<string, unknown>,
    fallbackError: string
  ) {
    if (!selectedConversationId) {
      throw new Error("Choose a thread first.");
    }

    return patchConversationById(selectedConversationId, body, fallbackError);
  }

  function updateThreadDocumentUploads(
    conversationId: string,
    updater: (current: ThreadDocumentUploadState[]) => ThreadDocumentUploadState[]
  ) {
    setThreadDocumentUploads((current) => {
      const nextUploads = updater(current[conversationId] ?? []);
      if (nextUploads.length === 0) {
        if (!(conversationId in current)) {
          return current;
        }

        const rest = { ...current };
        delete rest[conversationId];
        return rest;
      }

      return {
        ...current,
        [conversationId]: nextUploads,
      };
    });
  }

  function dismissThreadUpload(uploadId: string) {
    if (!selectedConversationId) {
      return;
    }

    clearThreadUploadDismiss(uploadId);
    updateThreadDocumentUploads(
      selectedConversationId,
      (current) => current.filter((upload) => upload.id !== uploadId)
    );
  }

  async function uploadThreadDocuments(files: File[]) {
    if (!selectedConversationId || files.length === 0) {
      return;
    }

    const conversationId = selectedConversationId;
    setThreadDocumentError(null);

    for (const file of files) {
      const uploadId = `upload-${conversationId}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

      const validationError = validateConversationDocument(file);
      if (validationError) {
        updateThreadDocumentUploads(conversationId, (current) => [
          {
            id: uploadId,
            conversationId,
            filename: file.name,
            fileSize: file.size,
            status: "failed",
            error: validationError,
          },
          ...current,
        ]);
        continue;
      }

      updateThreadDocumentUploads(conversationId, (current) => [
        {
          id: uploadId,
          conversationId,
          filename: file.name,
          fileSize: file.size,
          status: "uploading",
          error: null,
        },
        ...current,
      ]);

      try {
        const formData = new FormData();
        formData.append("file", file);

        const response = await fetch(`/api/chat/conversations/${conversationId}/documents`, {
          method: "POST",
          headers: { Accept: "application/json" },
          body: formData,
        });
        const data = await parseApiResponse(response);

        if (!response.ok || !data.conversation) {
          throw new Error(
            getApiErrorMessage(data.error) ?? `Unable to upload ${file.name} right now.`
          );
        }

        upsertConversation(data.conversation as ConversationSummary);
        updateThreadDocumentUploads(
          conversationId,
          (current) =>
            current.map((upload) =>
              upload.id === uploadId
                ? {
                    ...upload,
                    status: "uploaded",
                    error: null,
                  }
                : upload
            )
        );
        scheduleThreadUploadDismiss(conversationId, uploadId);
      } catch (error) {
        clearThreadUploadDismiss(uploadId);
        updateThreadDocumentUploads(conversationId, (current) =>
          current.map((upload) =>
            upload.id === uploadId
              ? {
                  ...upload,
                  status: "failed",
                  error: error instanceof Error ? error.message : `Unable to upload ${file.name} right now.`,
                }
              : upload
          )
        );
      }
    }
  }

  async function removeThreadDocument(document: ConversationDocumentSummary) {
    if (!selectedConversationId) {
      return;
    }

    if (typeof window !== "undefined" && !window.confirm(`Remove ${document.filename} from this thread?`)) {
      return;
    }

    setThreadDocumentError(null);
    setRemovingDocumentId(document.id);

    try {
      const response = await fetch(
        `/api/chat/conversations/${selectedConversationId}/documents/${document.id}`,
        {
          method: "DELETE",
          headers: { Accept: "application/json" },
        }
      );
      const data = await parseApiResponse(response);

      if (!response.ok || !data.conversation) {
        if (response.status === 404) {
          await refreshConversationData();
          throw new Error("That document is no longer attached to this thread.");
        }

        throw new Error(
          getApiErrorMessage(data.error) ?? "Unable to remove that document right now."
        );
      }

      upsertConversation(data.conversation as ConversationSummary);
    } catch (error) {
      setThreadDocumentError(
        error instanceof Error ? error.message : "Unable to remove that document right now."
      );
    } finally {
      setRemovingDocumentId(null);
    }
  }

  async function openDirectConversation(
    target: { userId?: string; agentId?: string },
    options?: {
      forceNew?: boolean;
      projectId?: string | null;
      name?: string | null;
      history?: "push" | "replace";
    }
  ): Promise<ConversationSummary | null> {
    const targetId = target.userId ?? target.agentId ?? "";
    const shouldForceNew = options?.forceNew === true;

    const existingConversation = shouldForceNew
      ? undefined
      : target.userId
        ? directConversationShortcutsByUserId.get(target.userId)?.recentConversation
        : target.agentId
          ? directConversationShortcutsByAgentId.get(target.agentId)?.recentConversation
          : undefined;

    if (existingConversation) {
      if (target.agentId) {
        setBootstrappingConversationId(existingConversation.id);
      }
      beginThreadSwitchMeasurement(existingConversation.id, "direct_shortcut_existing");
      setSelectedConversationId(existingConversation.id);
      syncTeamChatRoute({ kind: "thread", conversationId: existingConversation.id }, options?.history ?? "push");
      return existingConversation;
    }

    setOpeningDirectId(targetId);
    try {
      const response = await fetch("/api/chat/conversations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: "direct",
          ...(shouldForceNew ? { forceNew: true } : {}),
          ...(shouldForceNew && options?.projectId ? { projectId: options.projectId } : {}),
          ...(shouldForceNew && options?.name?.trim() ? { name: options.name.trim() } : {}),
          ...(target.userId ? { userId: target.userId } : {}),
          ...(target.agentId ? { agentId: target.agentId } : {}),
        }),
      });
      const data = await response.json();
      if (data.conversation) {
        if (target.agentId) {
          setBootstrappingConversationId(data.conversation.id);
        }
        upsertConversation(data.conversation);
        beginThreadSwitchMeasurement(data.conversation.id, "direct_shortcut_created");
        setSelectedConversationId(data.conversation.id);
        syncTeamChatRoute({ kind: "thread", conversationId: data.conversation.id }, options?.history ?? "push");
        return data.conversation as ConversationSummary;
      }
    } finally {
      setOpeningDirectId(null);
    }

    return null;
  }

  function openDirectShortcut(target: { userId?: string; agentId?: string }) {
    setSelectedProjectId(null);
    setDiscoveryQuery("");
    setShowDiscoveryView(false);
    setShowArchivedView(false);
    void openDirectConversation(target);
  }

  useEffect(() => {
    if (!routeAgentId) {
      hasHandledAgentParamRef.current = false;
      return;
    }

    if (hasHandledAgentParamRef.current) {
      return;
    }

    hasHandledAgentParamRef.current = true;
    setSidebarCollapsed(true);
    void openDirectConversation({ agentId: routeAgentId }, { history: "replace" });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [routeAgentId]);

  useEffect(() => {
    if (routeAgentId) {
      return;
    }

    if (routeView === "thread" && routeConversationId) {
      if (!routeConversationVisible) {
        setSelectedConversationId(null);

        if (routeContext === "search") {
          const trimmedRouteQuery = routeQuery.trim();
          if (trimmedRouteQuery) {
            setSelectedProjectId(routeProjectId || null);
            setDiscoveryQuery(routeQuery);
            setShowDiscoveryView(true);
            setShowArchivedView(false);
            syncTeamChatRoute(
              {
                kind: "search",
                query: routeQuery,
                projectId: routeProjectId || null,
              },
              "replace"
            );
            return;
          }
        }

        if (routeContext === "project" && routeProjectId) {
          setSelectedProjectId(routeProjectId);
          setDiscoveryQuery("");
          setShowDiscoveryView(true);
          setShowArchivedView(false);
          syncTeamChatRoute({ kind: "project", projectId: routeProjectId }, "replace");
          return;
        }

        if (routeContext === "archived") {
          const trimmedRouteQuery = routeQuery.trim();
          setSelectedProjectId(null);
          setDiscoveryQuery(trimmedRouteQuery ? routeQuery : "");
          setShowDiscoveryView(true);
          setShowArchivedView(true);
          syncTeamChatRoute(trimmedRouteQuery ? { kind: "archived", query: routeQuery } : { kind: "archived" }, "replace");
          return;
        }

        if (routeContext === "discover") {
          setSelectedProjectId(null);
          setDiscoveryQuery("");
          setShowDiscoveryView(true);
          setShowArchivedView(false);
          syncTeamChatRoute({ kind: "discovery" }, "replace");
          return;
        }

        setSelectedProjectId(null);
        setDiscoveryQuery("");
        setShowDiscoveryView(initialConversations.length === 0);
        setShowArchivedView(false);
        syncTeamChatRoute(initialConversations.length === 0 ? { kind: "discovery" } : { kind: "rail" }, "replace");
        return;
      }

      if (selectedConversationIdRef.current !== routeConversationId) {
        beginThreadSwitchMeasurement(routeConversationId, "route_sync");
      }
      setSelectedConversationId(routeConversationId);
      if (routeContext === "search") {
        const trimmedRouteQuery = routeQuery.trim();
        if (trimmedRouteQuery) {
          setSelectedProjectId(routeProjectId || null);
          setDiscoveryQuery(routeQuery);
          setShowDiscoveryView(true);
          setShowArchivedView(false);
          return;
        }
      }

      if (routeContext === "project" && routeProjectId) {
        setSelectedProjectId(routeProjectId);
        setDiscoveryQuery("");
        setShowDiscoveryView(true);
        setShowArchivedView(false);
        return;
      }

      if (routeContext === "archived") {
        setSelectedProjectId(null);
        setDiscoveryQuery(routeQuery.trim() ? routeQuery : "");
        setShowDiscoveryView(true);
        setShowArchivedView(true);
        return;
      }

      if (routeContext === "discover") {
        setSelectedProjectId(null);
        setDiscoveryQuery("");
        setShowDiscoveryView(true);
        setShowArchivedView(false);
        return;
      }

      setSelectedProjectId(null);
      setDiscoveryQuery("");
      setShowDiscoveryView(false);
      setShowArchivedView(false);
      return;
    }

    if (routeView === "archived") {
      setSelectedConversationId(null);
      setSelectedProjectId(null);
      setDiscoveryQuery(routeQuery.trim() ? routeQuery : "");
      setShowDiscoveryView(true);
      setShowArchivedView(true);
      return;
    }

    if (routeView === "project" && routeProjectId) {
      setSelectedConversationId(null);
      setSelectedProjectId(routeProjectId);
      setDiscoveryQuery("");
      setShowDiscoveryView(true);
      setShowArchivedView(false);
      return;
    }

    if (routeView === "search") {
      const trimmedRouteQuery = routeQuery.trim();

      if (!trimmedRouteQuery) {
        setSelectedConversationId(null);
        setSelectedProjectId(routeProjectId || null);
        setDiscoveryQuery("");
        setShowDiscoveryView(true);
        setShowArchivedView(false);
        syncTeamChatRoute(
          routeProjectId
            ? { kind: "project", projectId: routeProjectId }
            : { kind: "discovery" },
          "replace"
        );
        return;
      }

      setSelectedConversationId(null);
      setSelectedProjectId(routeProjectId || null);
      setDiscoveryQuery(routeQuery);
      setShowDiscoveryView(true);
      setShowArchivedView(false);
      return;
    }

    if (routeView === "discover") {
      setSelectedConversationId(null);
      setSelectedProjectId(null);
      setDiscoveryQuery("");
      setShowDiscoveryView(true);
      setShowArchivedView(false);
      return;
    }

    setSelectedConversationId(null);
    setSelectedProjectId(null);
    setDiscoveryQuery("");
    setShowDiscoveryView(initialConversations.length === 0);
    setShowArchivedView(false);
  }, [
    beginThreadSwitchMeasurement,
    initialConversations.length,
    routeAgentId,
    routeContext,
    routeConversationId,
    routeConversationVisible,
    routeProjectId,
    routeQuery,
    syncTeamChatRoute,
    routeView,
  ]);

  useEffect(() => {
    if (showArchivedView) {
      setSearchResults([]);
      setSearchLoading(false);
      setSearchError(null);
      return;
    }

    const trimmedQuery = discoveryQuery.trim();

    if (!trimmedQuery) {
      setSearchResults([]);
      setSearchLoading(false);
      setSearchError(null);
      return;
    }

    const controller = new AbortController();
    const timeoutId = window.setTimeout(async () => {
      setSearchLoading(true);
      setSearchError(null);

      try {
        const response = await fetch(`/api/chat/conversations/search?q=${encodeURIComponent(trimmedQuery)}`, {
          signal: controller.signal,
        });
        const data = await response.json();

        if (!response.ok || !Array.isArray(data.results)) {
          throw new Error(data.error ?? "Unable to search Team Chat right now.");
        }

        setSearchResults(data.results as ConversationSearchResult[]);
      } catch (error) {
        if (controller.signal.aborted) {
          return;
        }

        setSearchResults([]);
        setSearchError(
          error instanceof Error ? error.message : "Unable to search Team Chat right now."
        );
      } finally {
        if (!controller.signal.aborted) {
          setSearchLoading(false);
        }
      }
    }, 180);

    return () => {
      controller.abort();
      window.clearTimeout(timeoutId);
    };
  }, [discoveryQuery, showArchivedView]);

  async function createFreshThread(selection: NewThreadSelection) {
    const userIds = Array.from(
      new Set(
        selection.userIds.filter((id) => typeof id === "string" && id.trim().length > 0 && id !== currentUserId)
      )
    );
    const agentIds = Array.from(
      new Set(selection.agentIds.filter((id) => typeof id === "string" && id.trim().length > 0))
    );
    const projectId = await ensureChatProjectForSelection(selection);
    const totalSelected = userIds.length + agentIds.length;

    if (totalSelected === 0) {
      throw new Error("Choose at least one teammate or agent.");
    }

    setThreadDrawerOpen(false);
    const explicitThreadName = selection.name.trim();

    if (totalSelected === 1) {
      const conversation = await openDirectConversation(
        userIds.length === 1 ? { userId: userIds[0] } : { agentId: agentIds[0] },
        {
          forceNew: true,
          projectId,
          ...(explicitThreadName ? { name: explicitThreadName } : {}),
        }
      );

      if (!conversation) {
        throw new Error("Unable to create a fresh thread right now.");
      }

      return;
    }

    const response = await fetch("/api/chat/conversations", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        type: "group",
        ...(selection.name.trim() ? { name: selection.name.trim() } : {}),
        ...(projectId ? { projectId } : {}),
        memberUserIds: userIds,
        memberAgentIds: agentIds,
      }),
    });
    const data = await response.json();

    if (!response.ok || !data.conversation) {
      throw new Error(data.error ?? "Unable to create the thread right now.");
    }

    upsertConversation(data.conversation);
    beginThreadSwitchMeasurement(data.conversation.id, "new_group_thread");
    setSelectedConversationId(data.conversation.id);
    syncTeamChatRoute({ kind: "thread", conversationId: data.conversation.id });
  }

  async function addParticipantsToThread(selection: NewThreadSelection) {
    if (!selectedConversationId || !activeConversation) {
      throw new Error("Choose a thread before adding participants.");
    }

    const existingUserIds = new Set(
      activeConversation.members
        .filter((member): member is typeof activeConversation.members[number] & { kind: "user" } => member.kind === "user")
        .map((member) => member.id)
    );
    const existingAgentIds = new Set(
      activeConversation.members
        .filter((member): member is typeof activeConversation.members[number] & { kind: "agent" } => member.kind === "agent")
        .map((member) => member.id)
    );
    const userIds = Array.from(
      new Set(
        selection.userIds.filter(
          (id) => typeof id === "string" && id.trim().length > 0 && id !== currentUserId && !existingUserIds.has(id)
        )
      )
    );
    const agentIds = Array.from(
      new Set(selection.agentIds.filter((id) => typeof id === "string" && id.trim().length > 0 && !existingAgentIds.has(id)))
    );

    if (userIds.length + agentIds.length === 0) {
      throw new Error("Choose at least one new participant.");
    }

    await patchConversationThread(
      {
        addUserIds: userIds,
        addAgentIds: agentIds,
      },
      "Unable to add participants right now."
    );
  }

  async function moveThreadToProject(projectId: string | null) {
    if (!selectedConversationId || !activeConversation) {
      return;
    }

    const currentProjectId = activeConversation.project?.id ?? null;
    if (currentProjectId === projectId) {
      return;
    }

    setProjectActionError(null);
    setMovingProject(true);

    try {
      await patchConversationById(
        selectedConversationId,
        { projectId },
        projectId
          ? "Unable to move this thread to that project right now."
          : "Unable to move this thread back to General right now."
      );
    } catch (error) {
      setProjectActionError(
        error instanceof Error
          ? error.message
          : projectId
            ? "Unable to move this thread to that project right now."
            : "Unable to move this thread back to General right now."
      );
    } finally {
      setMovingProject(false);
    }
  }

  async function moveConversationToProjectById(conversationId: string, projectId: string | null) {
    const conversation = conversationsRef.current.find((entry) => entry.id === conversationId);
    if (!conversation) {
      throw new Error("Thread not found.");
    }

    const currentProjectId = conversation.project?.id ?? null;
    if (currentProjectId === projectId) {
      return conversation;
    }

    return patchConversationById(
      conversationId,
      { projectId },
      projectId
        ? "Unable to move this thread to that project right now."
        : "Unable to move this thread back to General right now."
    );
  }

  async function renameThread(name: string | null) {
    if (!selectedConversationId || !activeConversation) {
      return;
    }

    await patchConversationById(
      selectedConversationId,
      { name },
      name
        ? "Unable to rename this thread right now."
        : "Unable to return this thread to its automatic title right now."
    );
  }

  async function renameConversationById(conversationId: string, name: string | null) {
    const conversation = conversationsRef.current.find((entry) => entry.id === conversationId);
    if (!conversation) {
      throw new Error("Thread not found.");
    }

    const nextName = name?.trim() || null;
    const currentName = conversation.name?.trim() || null;
    if (currentName === nextName) {
      return conversation;
    }

    return patchConversationById(
      conversationId,
      { name: nextName },
      nextName
        ? "Unable to rename this thread right now."
        : "Unable to return this thread to its automatic title right now."
    );
  }

  function removeConversationFromVisibleState(conversationId: string) {
    setConversations((current) => current.filter((conversation) => conversation.id !== conversationId));
    delete messagesByConversationRef.current[conversationId];
    setThreadDocumentUploads((current) => {
      if (!(conversationId in current)) {
        return current;
      }

      const next = { ...current };
      const removedUploads = next[conversationId] ?? [];
      removedUploads.forEach((upload) => clearThreadUploadDismiss(upload.id));
      delete next[conversationId];
      return next;
    });
    setBootstrappingConversationId((current) => (current === conversationId ? null : current));

    if (selectedConversationIdRef.current === conversationId || routeConversationId === conversationId) {
      setSelectedConversationId(null);
      syncTeamChatRoute(getFallbackRouteState(), "replace");
    }
  }

  function removeArchivedConversationById(conversationId: string) {
    setArchivedConversations((current) => current.filter((conversation) => conversation.id !== conversationId));
  }

  async function archiveConversationById(conversationId: string) {
    const conversation = conversationsRef.current.find((entry) => entry.id === conversationId);
    if (!conversation) {
      throw new Error("Thread not found.");
    }

    const response = await fetch(`/api/chat/conversations/${conversationId}`, {
      method: "PATCH",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ lifecycleAction: "archive" }),
    });
    const data = await parseApiResponse(response);

    if (!response.ok || data.archivedConversationId !== conversationId) {
      throw new Error(getApiErrorMessage(data.error) ?? "Unable to archive this thread right now.");
    }

    setArchivedConversations((current) => sortConversationsByUpdatedAt([
      {
        ...conversation,
        updatedAt: new Date().toISOString(),
      },
      ...current.filter((entry) => entry.id !== conversationId),
    ]));
    removeConversationFromVisibleState(conversationId);
    return conversationId;
  }

  async function restoreConversationById(conversationId: string) {
    const archivedConversation = archivedConversations.find((entry) => entry.id === conversationId);

    setArchivedActionError(null);
    setArchivedActionConversationId(null);
    setRestoringConversationId(conversationId);

    try {
      const conversation = await patchConversationById(
        conversationId,
        { lifecycleAction: "restore" },
        "Unable to restore this thread right now."
      );

      removeArchivedConversationById(conversationId);

      if (archivedConversation || showArchivedView) {
        openConversationFromDiscovery(conversation.id);
      }

      return conversation;
    } catch (error) {
      setArchivedActionConversationId(conversationId);
      setArchivedActionError(error instanceof Error ? error.message : "Unable to restore this thread right now.");
      throw error;
    } finally {
      setRestoringConversationId((current) => (current === conversationId ? null : current));
    }
  }

  async function deleteArchivedConversationById(conversationId: string) {
    setArchivedActionError(null);
    setArchivedActionConversationId(null);
    setDeletingArchivedConversationId(conversationId);

    try {
      await deleteConversationById(conversationId);
      return conversationId;
    } catch (error) {
      setArchivedActionConversationId(conversationId);
      setArchivedActionError(error instanceof Error ? error.message : "Unable to delete this thread right now.");
      throw error;
    } finally {
      setDeletingArchivedConversationId((current) => (current === conversationId ? null : current));
    }
  }

  async function deleteConversationById(conversationId: string) {
    const conversation =
      conversationsRef.current.find((entry) => entry.id === conversationId)
      ?? archivedConversations.find((entry) => entry.id === conversationId);
    if (!conversation) {
      throw new Error("Thread not found.");
    }

    const response = await fetch(`/api/chat/conversations/${conversationId}`, {
      method: "DELETE",
      headers: { Accept: "application/json" },
    });
    const data = await parseApiResponse(response);

    if (!response.ok || data.deletedConversationId !== conversationId) {
      throw new Error(getApiErrorMessage(data.error) ?? "Unable to delete this thread right now.");
    }

    removeArchivedConversationById(conversationId);
    removeConversationFromVisibleState(conversationId);
    return conversationId;
  }

  async function setActiveAgentForThread(agentId: string) {
    if (!selectedConversationId || !activeConversation) {
      return;
    }

    if (activeConversationPrimaryAgent?.id === agentId && activeConversation.llmThread?.activeAgentId === agentId) {
      return;
    }

    setParticipantActionError(null);
    setSwitchingActiveAgentId(agentId);

    try {
      await patchConversationThread(
        { activeAgentId: agentId },
        "Unable to switch the active agent right now."
      );
    } catch (error) {
      setParticipantActionError(
        error instanceof Error ? error.message : "Unable to switch the active agent right now."
      );
    } finally {
      setSwitchingActiveAgentId(null);
    }
  }

  async function clearActiveAgentPinForThread() {
    if (!selectedConversationId || !activeConversation?.llmThread?.activeAgentId) {
      return;
    }

    setParticipantActionError(null);
    setClearingActiveAgentPin(true);

    try {
      await patchConversationThread(
        { activeAgentId: null },
        "Unable to return this thread to fallback agent routing right now."
      );
    } catch (error) {
      setParticipantActionError(
        error instanceof Error ? error.message : "Unable to return this thread to fallback agent routing right now."
      );
    } finally {
      setClearingActiveAgentPin(false);
    }
  }

  async function removeParticipantFromThread(participant: ConversationMemberSummary) {
    if (!selectedConversationId || !activeConversation) {
      return;
    }

    if (participant.kind === "user" && participant.id === currentUserId) {
      setParticipantActionError("You cannot remove yourself from a thread yet.");
      return;
    }

    const participantLabel = participant.name || "this participant";
    const removingActiveAgent =
      participant.kind === "agent" && participant.id === activeConversationPrimaryAgent?.id;
    const confirmMessage = removingActiveAgent
      ? `Remove ${participantLabel} from this thread? Another remaining agent will take over automatically, or the thread will become human-only if none remain.`
      : `Remove ${participantLabel} from this thread?`;

    if (typeof window !== "undefined" && !window.confirm(confirmMessage)) {
      return;
    }

    setParticipantActionError(null);
    setRemovingParticipantId(`${participant.kind}-${participant.id}`);

    try {
      await patchConversationThread(
        participant.kind === "user"
          ? { removeUserIds: [participant.id] }
          : { removeAgentIds: [participant.id] },
        "Unable to remove that participant right now."
      );
    } catch (error) {
      setParticipantActionError(
        error instanceof Error ? error.message : "Unable to remove that participant right now."
      );
    } finally {
      setRemovingParticipantId(null);
    }
  }

  async function sendCurrentMessage() {
    if (!activeConversationId || !messageInput.trim() || sending) return;
    if (activeAgentSendBlocked) return;

    const conversationId = activeConversationId;
    const text = messageInput.trim();
    const isAgentConversation = Boolean(activeConversationPrimaryAgent);
    const clientRequestId = `client-request-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const optimisticMessage: ChatMessage = {
      id: `temp-${Date.now()}`,
      body: text,
      createdAt: new Date().toISOString(),
      clientRequestId,
      clientState: "optimistic_user",
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
          streamState: "preparing",
          createdAt: new Date().toISOString(),
          clientRequestId,
          clientState: "pending_assistant",
          sender: {
            kind: "agent",
            id: activeConversationPrimaryAgent?.id ?? "agent",
            name: activeConversationPrimaryAgent?.name ?? "Agent",
            image: activeConversationPrimaryAgent?.image ?? null,
        },
      }
      : null;
    let receivedRuntimeSnapshot = false;
    let appliedRuntimeSnapshot = false;

    incrementTeamChatPerfCounter("composer:send", {
      conversationId,
      messageLength: text.length,
      isAgentConversation,
    });
    setMessageInput("");
    setSending(true);
    updateMessagesForConversation(
      conversationId,
      (current) => [
        ...current,
        optimisticMessage,
        ...(optimisticAgentMessage ? [optimisticAgentMessage] : []),
      ],
      "optimistic_send"
    );

    try {
      const response = await fetch(`/api/chat/conversations/${conversationId}/messages`, {
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
              | {
                  type: "final_messages";
                  messages: ChatMessage[];
                  retrievalSources?: NonNullable<ChatMessage["retrievalSources"]>;
                  runtimeSnapshot?: AgentRuntimeSnapshot | null;
                };

            if (event.type === "thinking_delta") {
              incrementTeamChatPerfCounter("stream_event:thinking_delta", {
                conversationId,
                deltaLength: event.delta.length,
              });
              updateMessagesForConversation(
                conversationId,
                (current) =>
                  current.map((message) =>
                    message.id === optimisticAgentMessage.id
                      ? {
                        ...message,
                        thinking: `${message.thinking ?? ""}${event.delta}`,
                        isStreaming: true,
                        streamState: "thinking",
                      }
                      : message
                  ),
                "stream_thinking_delta"
              );
            }

            if (event.type === "meta") {
              incrementTeamChatPerfCounter("stream_event:meta", {
                conversationId,
                thinkingEnabled: event.thinking,
              });
              updateMessagesForConversation(
                conversationId,
                (current) =>
                  current.map((message) =>
                    message.id === optimisticAgentMessage.id
                      ? {
                          ...message,
                          thinkingEnabled: event.thinking,
                        }
                      : message
                  ),
                "stream_meta"
              );
            }

            if (event.type === "content_delta") {
              incrementTeamChatPerfCounter("stream_event:content_delta", {
                conversationId,
                deltaLength: event.delta.length,
              });
              updateMessagesForConversation(
                conversationId,
                (current) =>
                  current.map((message) =>
                    message.id === optimisticAgentMessage.id
                      ? {
                        ...message,
                        body: `${message.body}${event.delta}`,
                        isStreaming: true,
                        streamState: "responding",
                      }
                      : message
                  ),
                "stream_content_delta"
              );
            }

            if (event.type === "retrieval") {
              incrementTeamChatPerfCounter("stream_event:retrieval", {
                conversationId,
                sourceCount: event.sources.length,
              });
              updateMessagesForConversation(
                conversationId,
                (current) =>
                  current.map((message) =>
                    message.id === optimisticAgentMessage.id
                      ? {
                          ...message,
                          retrievalSources: event.sources,
                          streamState: message.body ? message.streamState : "reading_context",
                        }
                      : message
                  ),
                "stream_retrieval"
              );
            }

            if (event.type === "tool_call") {
              incrementTeamChatPerfCounter("stream_event:tool_call", {
                conversationId,
                toolName: event.name,
              });
              updateMessagesForConversation(
                conversationId,
                (current) =>
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
                  ),
                "stream_tool_call"
              );
            }

            if (event.type === "tool_result") {
              incrementTeamChatPerfCounter("stream_event:tool_result", {
                conversationId,
                toolName: event.name,
              });
              updateMessagesForConversation(
                conversationId,
                (current) =>
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
                  ),
                "stream_tool_result"
              );
            }

            if (event.type === "final_messages") {
              incrementTeamChatPerfCounter("stream_event:final_messages", {
                conversationId,
                messageCount: event.messages.length,
              });
              const runtimeSnapshot = event.runtimeSnapshot;
              if (runtimeSnapshot) {
                receivedRuntimeSnapshot = true;
                const canApplyRuntimeSnapshot =
                  Boolean(agentInspector?.conversationId === conversationId);
                appliedRuntimeSnapshot = canApplyRuntimeSnapshot;
                if (canApplyRuntimeSnapshot) {
                  setAgentInspector((current) =>
                    current && current.conversationId === conversationId
                      ? {
                          ...current,
                          context: runtimeSnapshot.context,
                          payload: runtimeSnapshot.payload,
                        }
                      : current
                  );
                }
              }
              updateMessagesForConversation(
                conversationId,
                (current) => {
                  const optimisticAgent = current.find((message) => message.id === optimisticAgentMessage.id);
                  return [
                    ...current.filter((message) => message.id !== optimisticMessage.id && message.id !== optimisticAgentMessage.id),
                    ...event.messages.map((message) =>
                      message.sender?.kind === "agent"
                        ? {
                            ...message,
                            clientRequestId,
                            retrievalSources: event.retrievalSources ?? optimisticAgent?.retrievalSources,
                            toolActivity: optimisticAgent?.toolActivity,
                          }
                        : {
                            ...message,
                            clientRequestId,
                          }
                    ),
                  ];
                },
                "stream_final_messages"
              );
            }
          }
        }
      } else {
        const data = await response.json();

        if (data.runtimeSnapshot) {
          receivedRuntimeSnapshot = true;
          const canApplyRuntimeSnapshot =
            Boolean(agentInspector?.conversationId === conversationId);
          appliedRuntimeSnapshot = canApplyRuntimeSnapshot;
          if (canApplyRuntimeSnapshot) {
            setAgentInspector((current) =>
              current && current.conversationId === conversationId
                ? {
                    ...current,
                    context: data.runtimeSnapshot.context,
                    payload: data.runtimeSnapshot.payload,
                  }
                : current
            );
          }
        }

        if (data.messages) {
          updateMessagesForConversation(
            conversationId,
            (current) => [
              ...current.filter((message) => message.id !== optimisticMessage.id && message.id !== optimisticAgentMessage?.id),
              ...data.messages.map((message: ChatMessage) =>
                message.sender?.kind === "agent"
                  ? {
                      ...message,
                      clientRequestId,
                      retrievalSources: data.retrievalSources ?? [],
                    }
                  : {
                      ...message,
                      clientRequestId,
                    }
              ),
            ],
            "non_stream_send"
          );
        }
      }

      const conversationResponse = await fetch("/api/chat/conversations", {
        headers: { Accept: "application/json" },
        cache: "no-store",
      });
      const conversationData = await parseApiResponse(conversationResponse);
      if (Array.isArray(conversationData.conversations)) {
        incrementTeamChatPerfCounter("conversations_refresh:post_send", {
          conversationId,
          conversationCount: conversationData.conversations.length,
        });
        setConversations(conversationData.conversations as ConversationSummary[]);
      }

      if (isAgentConversation && (!receivedRuntimeSnapshot || !appliedRuntimeSnapshot)) {
        incrementTeamChatPerfCounter("inspector_refresh:post_send", {
          conversationId,
        });
        fetch(`/api/chat/conversations/${conversationId}/inspect`, {
          headers: { Accept: "application/json" },
          cache: "no-store",
        })
          .then(async (res) => ({
            status: res.status,
            ok: res.ok,
            data: await parseApiResponse(res),
          }))
          .then((data) => {
            if (data.status === 404) {
              invalidateConversationAccessRef.current(conversationId);
              return;
            }

            if (!data.ok || !("conversationId" in data.data)) {
              return;
            }

            void applyInspectorForConversation(
              conversationId,
              data.data as unknown as AgentInspectorData
            );
          })
          .catch(() => { });
      }
    } catch {
      updateMessagesForConversation(
        conversationId,
        (current) =>
          current.map((message) => {
            if (message.id === optimisticMessage.id) {
              return { ...message, clientState: "failed_user" as const };
            }

            if (message.id === optimisticAgentMessage?.id) {
              return {
                ...message,
                body: "",
                isStreaming: false,
                streamState: undefined,
                clientState: "failed_assistant" as const,
              };
            }

            return message;
          }
            ),
        "delivery_failed"
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
    const conversationId = activeConversationId;
    if (!conversationId) return;

    try {
      incrementTeamChatPerfCounter("messages_fetch:refresh", {
        conversationId,
      });
      const [messagesResponse, conversationsResponse] = await Promise.all([
        fetch(`/api/chat/conversations/${conversationId}/messages`, {
          headers: { Accept: "application/json" },
          cache: "no-store",
        }),
        fetch("/api/chat/conversations", {
          headers: { Accept: "application/json" },
          cache: "no-store",
        }),
      ]);
      const [messagesData, conversationsData] = await Promise.all([
        parseApiResponse(messagesResponse),
        parseApiResponse(conversationsResponse),
      ]);

      if (conversationsResponse.ok && Array.isArray(conversationsData.conversations)) {
        incrementTeamChatPerfCounter("conversations_refresh:refresh", {
          conversationId,
          conversationCount: conversationsData.conversations.length,
        });
        setConversations(conversationsData.conversations as ConversationSummary[]);
      }

      if (messagesResponse.status === 404) {
        invalidateConversationAccessRef.current(conversationId);
        return;
      }

      if (!messagesResponse.ok) {
        return;
      }

      if (Array.isArray(messagesData.messages)) {
        replaceMessagesForConversation(
          conversationId,
          messagesData.messages as ChatMessage[],
          "refresh"
        );
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
    if (
      !selectedConversationId
      || !activeConversationPrimaryAgent
      || activeConversation?.type !== "direct"
      || clearingConversation
    ) {
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

  const activePartner = activeConversationDirectPartner;
  const activeAgentParticipant = activeConversationPrimaryAgent;
  const activeAgentInspector =
    activeConversation
      && activeAgentParticipant
      && agentInspector?.conversationId === activeConversation.id
      && agentInspector.agent.id === activeAgentParticipant.id
      ? agentInspector
      : null;
  const activeAgentInspectorError =
    activeConversation
      && activeAgentParticipant
      && agentInspectorErrorConversationId === activeConversation.id
      ? agentInspectorError
      : null;
  const activeAgentBootstrapPending =
    Boolean(activeAgentParticipant)
      && (
        bootstrappingConversationId === selectedConversationId
        || (!activeAgentInspector && agentInspectorLoading && messages.length === 0)
      );
  const activeThreadModelLabel = activeAgentInspector?.threadLlm.selectedLabel
    ?? activeConversation?.llmThread?.selectedLabel
    ?? activeAgentInspector?.threadLlm.selectedModel
    ?? activeConversation?.llmThread?.selectedModel
    ?? activeAgentInspector?.agent.llmModel
    ?? null;
  const activeAgentConfigured =
    activeAgentParticipant
      ? activeAgentInspector
        ? activeAgentInspector.agent.endpointConfigured
        : Boolean(activeThreadModelLabel || activeAgentParticipant.llmModel)
          || activeAgentParticipant.llmStatus !== "disconnected"
      : true;
  const activeAgentReady = activeAgentParticipant ? activeAgentConfigured : true;
  const activeAgentSendBlocked =
    Boolean(activeAgentParticipant) && (activeAgentBootstrapPending || !activeAgentConfigured);
  const activeAgentStatusLabel =
    activeAgentParticipant
      ? activeAgentBootstrapPending
        ? "Initializing agent"
        : activeAgentInspector?.readiness.label || getAgentSidebarStatus(activeAgentParticipant.llmStatus).label
      : null;
  useEffect(() => {
    if (!activeConversationId) {
      return;
    }

    incrementTeamChatPerfCounter("composer:input_change", {
      conversationId: activeConversationId,
      length: messageInput.length,
      sending,
      activeAgentSendBlocked,
    });
  }, [activeAgentSendBlocked, activeConversationId, messageInput, sending]);

  useEffect(() => {
    if (!threadDrawerToggleSpanRef.current) {
      return;
    }

    let firstFrame = 0;
    let secondFrame = 0;

    firstFrame = window.requestAnimationFrame(() => {
      secondFrame = window.requestAnimationFrame(() => {
        finishTeamChatPerfSpan(threadDrawerToggleSpanRef.current, {
          open: threadDrawerOpen,
          conversationId: activeConversationId,
          messageCount: renderedMessages.length,
          documentCount: activeConversation?.documents.length ?? 0,
        });
        threadDrawerToggleSpanRef.current = null;
      });
    });

    return () => {
      window.cancelAnimationFrame(firstFrame);
      window.cancelAnimationFrame(secondFrame);
    };
  }, [activeConversation?.documents.length, activeConversationId, renderedMessages.length, threadDrawerOpen]);

  useEffect(() => {
    if (!showContextInspector || !contextInspectorToggleSpanRef.current) {
      return;
    }

    let firstFrame = 0;
    let secondFrame = 0;

    firstFrame = window.requestAnimationFrame(() => {
      secondFrame = window.requestAnimationFrame(() => {
        finishTeamChatPerfSpan(contextInspectorToggleSpanRef.current, {
          conversationId: activeConversationId,
          resolvedSourceCount: activeAgentInspector?.context.resolvedSources.length ?? 0,
          estimatedTokens: activeAgentInspector?.context.estimatedTokens ?? null,
        });
        contextInspectorToggleSpanRef.current = null;
      });
    });

    return () => {
      window.cancelAnimationFrame(firstFrame);
      window.cancelAnimationFrame(secondFrame);
    };
  }, [activeAgentInspector, activeConversationId, showContextInspector]);
  const clearThreadAvailable = Boolean(activeConversation?.type === "direct" && activeAgentParticipant);
  const activeConversationParticipantSummary = activeConversation
    ? getConversationParticipantSummary(activeConversation)
    : null;
  const activeConversationWorkspaceLabel = activeConversation
    ? getConversationWorkspaceLabel(activeConversation)
    : null;
  const activeConversationTimestamp = activeConversation
    ? getConversationTimestamp(activeConversation)
    : null;
  const activeThreadDocumentUploads = activeConversation
    ? threadDocumentUploads[activeConversation.id] ?? []
    : [];
  const activeThreadOriginLabel = useMemo(() => {
    if (routeView !== "thread" || !selectedConversationId) {
      return null;
    }

    if (routeContext === "search") {
      return routeQuery.trim() ? "Back to Search" : null;
    }

    if (routeContext === "discover") {
      return "Back to Discover";
    }

    if (routeContext === "archived") {
      return "Back to Archived";
    }

    if (routeContext === "project") {
      if (!routeProjectId) {
        return null;
      }

      if (routeProjectId === "general") {
        return "Back to General";
      }

      const projectName =
        chatProjects.find((project) => project.id === routeProjectId)?.name
        ?? (activeConversation?.project?.id === routeProjectId ? activeConversation.project.name : null);

      return projectName ? `Back to ${projectName}` : "Back to Project";
    }

    return null;
  }, [
    activeConversation?.project,
    chatProjects,
    routeContext,
    routeProjectId,
    routeQuery,
    routeView,
    selectedConversationId,
  ]);
  useTeamChatPerfCommit("TeamClient", {
    activeConversationId,
    selectedConversationId,
    selectedProjectId,
    routeView: routeView ?? null,
    loadingMessages,
    rawMessageCount: messages.length,
    renderedMessageCount: renderedMessages.length,
    messageInputLength: messageInput.length,
    sending,
    threadDrawerOpen,
    contextInspectorOpen: showContextInspector,
    agentInspectorLoading,
    discoveryQueryLength: discoveryQuery.length,
    activeDocumentCount: activeConversation?.documents.length ?? 0,
  });
  const inspectorPrettyText = activeAgentInspector
    ? [
        `Agent: ${activeAgentInspector.agent.name} (${activeAgentInspector.agent.role})`,
        `Status: ${activeAgentInspector.readiness.label}`,
        `Model: ${activeAgentInspector.threadLlm.selectedLabel ?? activeAgentInspector.agent.llmModel ?? "Unknown"}`,
        `Selected for this thread: ${activeAgentInspector.threadLlm.selectedBy ?? "unknown"}`,
        activeAgentInspector.threadLlm.reasonSummary ? `Routing reason: ${activeAgentInspector.threadLlm.reasonSummary}` : null,
        activeAgentInspector.threadLlm.escalationSummary ? `Escalation: ${activeAgentInspector.threadLlm.escalationSummary}` : null,
        `Thinking mode: ${formatThinkingMode(activeAgentInspector.agent.llmThinkingMode)}`,
        `Context: ${formatTokensK(activeAgentInspector.context.estimatedTokens)} / 128K (${formatContextMeter(activeAgentInspector.context.estimatedTokens)})`,
        `History: ${activeAgentInspector.context.recentHistoryCount}/${activeAgentInspector.context.historyWindowSize} turns loaded`,
        "",
        "Context sources:",
        ...activeAgentInspector.context.knowledgeSources.map((source) => `- ${source.label}: ${source.description}`),
        "",
        `Considered sources: ${activeAgentInspector.context.sourceSelection.consideredSourceIds.length}`,
        `Default candidates: ${activeAgentInspector.context.sourceSelection.defaultCandidateSourceIds.length}`,
        `Explicit user requests: ${activeAgentInspector.context.sourceSelection.explicitUserRequestedSourceIds.length}`,
        `Planner proposals: ${activeAgentInspector.context.sourceSelection.plannerProposedSourceIds.length}`,
        `Policy-required sources: ${activeAgentInspector.context.sourceSelection.policyRequiredSourceIds.length}`,
        `Fallback candidates: ${activeAgentInspector.context.sourceSelection.fallbackCandidateSourceIds.length}`,
        `Requested sources: ${activeAgentInspector.context.sourceSelection.requestedSourceIds.length}`,
        `Allowed sources: ${activeAgentInspector.context.sourceSelection.allowedSourceIds.length}`,
        `Executed sources: ${activeAgentInspector.context.sourceSelection.executedSourceIds.length}`,
        `Excluded sources: ${activeAgentInspector.context.sourceSelection.excludedSourceIds.length}`,
        ...activeAgentInspector.context.sourceDecisions.map((source) => {
          const exclusionLabel = source.exclusion
            ? `; exclusion=${formatContextSourceExclusionCategoryLabel(source.exclusion.category)}`
            : "";
          const executionSummary = source.execution.summary
            ? `; runtime=${formatContextSourceExecutionSummary(source.execution.summary)}`
            : "";
          const requestOrigins = source.request.origins.map((origin) => formatContextSourceRequestOriginLabel(origin)).join(", ");
          return `- ${source.label} [request=${formatContextSourceRequestStatusLabel(source.request.status)} via ${requestOrigins}, admission=${formatContextSourceAdmissionStatusLabel(source.admission.status)}, execution=${formatContextSourceExecutionStatusLabel(source.execution.status)}${exclusionLabel}]: ${source.request.detail} ${source.detail}${executionSummary ? ` ${executionSummary}` : ""}`;
        }),
        ...(activeAgentInspector.context.resolvedSources.length > 0
          ? [
              "",
              "Runtime outcomes:",
              ...activeAgentInspector.context.resolvedSources.map((source) => {
                const statusLabel = formatResolvedSourceStatusLabel(source.status).toLowerCase();
                return `- ${source.label} [${statusLabel}]: ${source.detail}`;
              }),
            ]
          : []),
        "",
        "Org context:",
        activeAgentInspector.payload.orgContext,
        ...(activeAgentInspector.payload.resolvedContextText
          ? [
              "",
              "Resolved thread context:",
              activeAgentInspector.payload.resolvedContextText,
            ]
          : []),
        "",
        "System prompt:",
        activeAgentInspector.payload.systemPrompt,
      ].filter(Boolean).join("\n")
    : "";
  const showDiscoveryPane = !activeConversation && (isDesktop || showDiscoveryView || selectedProjectId !== null);
  const hasMainPaneSelection = Boolean(activeConversation || showDiscoveryView || selectedProjectId !== null);
  const handleEngageConversationArea = useCallback(() => {
    if (!isDesktop || !activeConversation) {
      return;
    }

    collapseDesktopSidebarForChatFocus();

    if (!sidebarCollapsed) {
      setSidebarCollapsed(true);
    }
  }, [activeConversation, collapseDesktopSidebarForChatFocus, isDesktop, sidebarCollapsed]);

  useEffect(() => {
    if (!isDesktop) {
      return;
    }

    const inActiveThreadWorkflow = routeView === "thread" && Boolean(selectedConversationId);
    if (!inActiveThreadWorkflow) {
      releaseDesktopSidebarChatFocus();
    }
  }, [isDesktop, releaseDesktopSidebarChatFocus, routeView, selectedConversationId]);

  useEffect(() => {
    return () => {
      releaseDesktopSidebarChatFocus();
    };
  }, [releaseDesktopSidebarChatFocus]);

  return (
    <div className="-mx-4 -mt-4 flex h-[calc(100dvh-5rem)] flex-col overflow-hidden md:mt-0 md:w-full md:gap-4 md:h-[calc(100dvh-4.75rem)]">
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
            <TeamChatPerfBoundary
              id="ThreadRail"
              detail={{
                selectedConversationId,
                selectedProjectId,
                sidebarCollapsed,
                activeConversationId,
                messageInputLength: messageInput.length,
                threadSectionCount: threadSections.length,
              }}
            >
              <ThreadRail
                currentUserId={currentUserId}
                members={members}
                agents={agents}
                pendingInvites={pendingInvites}
                projects={chatProjects}
                threadSections={threadSections}
                groupConversations={groupConversations}
                directConversationShortcutsByUserId={directConversationShortcutsByUserId}
                directConversationShortcutsByAgentId={directConversationShortcutsByAgentId}
                selectedConversationId={selectedConversationId}
                selectedProjectId={selectedProjectId}
                sidebarCollapsed={sidebarCollapsed}
                onlineCount={onlineCount}
                showThreadStarter={showThreadStarter}
                openingDirectId={openingDirectId}
                hasActiveConversation={hasMainPaneSelection}
                onOpenInvite={() => setShowInvite(true)}
                onOpenSearch={openSearchDiscovery}
                onCollapseSidebar={() => setSidebarCollapsed(true)}
                onExpandSidebar={() => setSidebarCollapsed(false)}
                onOpenNewThreadModal={() => openNewThreadComposer(null)}
                onSelectConversation={openConversationFromRail}
                onSelectProject={openProjectSummary}
                onOpenUserShortcut={(userId) => openDirectShortcut({ userId })}
                onOpenAgentShortcut={(agentId) => openDirectShortcut({ agentId })}
                onCreateProject={(name) => createChatProject(name)}
                onRenameProject={(projectId, name) => renameChatProject(projectId, name)}
                onDeleteProject={(projectId) => deleteChatProject(projectId)}
                onRenameThread={async (conversationId, name) => {
                  await renameConversationById(conversationId, name);
                }}
                onMoveThread={async (conversationId, projectId) => {
                  await moveConversationToProjectById(conversationId, projectId);
                }}
                onArchiveThread={async (conversationId) => {
                  await archiveConversationById(conversationId);
                }}
                onDeleteThread={async (conversationId) => {
                  await deleteConversationById(conversationId);
                }}
                archivedThreadCount={archivedConversationsLoaded ? archivedConversations.length : null}
                archivedViewActive={showArchivedView}
                onOpenArchived={openArchivedThreads}
              />
            </TeamChatPerfBoundary>

            {activeConversation ? (
              <TeamChatPerfBoundary
                id="ConversationPane"
                detail={{
                  activeConversationId,
                  rawMessageCount: messages.length,
                  renderedMessageCount: renderedMessages.length,
                  messageInputLength: messageInput.length,
                  threadDrawerOpen,
                  loadingMessages,
                }}
              >
                <ConversationPane
                  currentUserId={currentUserId}
                  activeConversation={activeConversation}
                  activeConversationParticipantSummary={activeConversationParticipantSummary}
                  activeConversationWorkspaceLabel={activeConversationWorkspaceLabel}
                  activeConversationTimestamp={activeConversationTimestamp}
                  activePartner={activePartner}
                  activeAgentParticipant={activeAgentParticipant}
                  threadDrawerOpen={threadDrawerOpen}
                  threadOriginLabel={activeThreadOriginLabel}
                  loadingMessages={loadingMessages}
                  rawMessageCount={messages.length}
                  renderedMessages={renderedMessages}
                  messageInput={messageInput}
                  sending={sending}
                  editingMessageId={editingMessageId}
                  editingDraft={editingDraft}
                  savingMessageId={savingMessageId}
                  deletingMessageId={deletingMessageId}
                  copiedMessageId={copiedMessageId}
                  chatScrollRef={chatScrollRef}
                  bottomRef={bottomRef}
                  threadDocumentUploads={activeThreadDocumentUploads}
                  threadDocumentError={threadDocumentError}
                  activeAgentReady={activeAgentReady}
                  activeAgentSendBlocked={activeAgentSendBlocked}
                  activeAgentBootstrapPending={activeAgentBootstrapPending}
                  agentInspector={activeAgentInspector}
                  agentInspectorError={activeAgentInspectorError}
                  onBack={closeActiveConversation}
                  onOpenThreadTarget={() => {
                    if (!activePartner) return;
                    router.push(
                      activePartner.kind === "agent"
                        ? `/agents/${activePartner.id}/profile`
                        : `/profile/${activePartner.id}`
                    );
                  }}
                  onOpenActiveAgentProfile={() => {
                    if (!activeAgentParticipant) return;
                    router.push(`/agents/${activeAgentParticipant.id}/profile`);
                  }}
                  onToggleDrawer={toggleThreadDrawer}
                  onEngageConversationArea={handleEngageConversationArea}
                  onHandleChatScroll={handleChatScroll}
                  onChangeMessageInput={setMessageInput}
                  onUploadThreadDocuments={uploadThreadDocuments}
                  onSubmitMessage={handleSendMessage}
                  onSendMessage={sendCurrentMessage}
                  onChangeEditingDraft={setEditingDraft}
                  onCancelEditingMessage={cancelEditingMessage}
                  onSaveEditedMessage={saveEditedMessage}
                  onDismissThreadUpload={dismissThreadUpload}
                  onCopyMessage={(body, messageId) => void copyToClipboard(body, "message", messageId)}
                  onStartEditingMessage={startEditingMessage}
                  onDeleteMessage={deleteMessage}
                />
              </TeamChatPerfBoundary>
            ) : showDiscoveryPane ? (
              <TeamDiscoveryPane
                currentUserId={currentUserId}
                projects={chatProjects}
                conversations={conversations}
                archivedMode={showArchivedView}
                archivedConversations={archivedConversations}
                archivedLoading={archivedConversationsLoading}
                archivedError={archivedConversationsError}
                archivedActionError={archivedActionError}
                archivedActionConversationId={archivedActionConversationId}
                restoringConversationId={restoringConversationId}
                deletingConversationId={deletingArchivedConversationId}
                threadSections={threadSections}
                searchResults={searchResults}
                searchLoading={searchLoading}
                searchError={searchError}
                selectedProjectId={selectedProjectId}
                searchQuery={discoveryQuery}
                isDesktop={isDesktop}
                onChangeSearchQuery={handleDiscoveryQueryChange}
                onOpenConversation={openConversationFromDiscovery}
                onRestoreConversation={restoreConversationById}
                onDeleteConversation={deleteArchivedConversationById}
                onOpenProject={openProjectSummary}
                onOpenNewThread={openNewThreadComposer}
                onBack={closeDiscoveryPane}
              />
            ) : null}
        </div>
      </div>

      <TeamChatPerfBoundary
        id="ThreadDrawer"
        detail={{
          open: Boolean(activeConversation && threadDrawerOpen),
          activeConversationId,
          renderedMessageCount: renderedMessages.length,
          documentCount: activeConversation?.documents.length ?? 0,
          uploadCount: activeThreadDocumentUploads.length,
        }}
      >
        <ThreadDrawer
          open={Boolean(activeConversation && threadDrawerOpen)}
          conversation={activeConversation}
          currentUserId={currentUserId}
          messageCount={renderedMessages.length}
          threadModelLabel={activeThreadModelLabel}
          agentInspector={activeAgentInspector}
          agentInspectorLoading={agentInspectorLoading}
          agentInspectorError={activeAgentInspectorError}
          activeAgentParticipant={activeAgentParticipant}
          activeAgentStatusLabel={activeAgentStatusLabel}
          activeAgentReady={activeAgentReady}
          activeAgentBootstrapPending={activeAgentBootstrapPending}
          clearThreadAvailable={clearThreadAvailable}
          clearingConversation={clearingConversation}
          participantActionError={participantActionError}
          projectActionError={projectActionError}
          switchingActiveAgentId={switchingActiveAgentId}
          clearingActiveAgentPin={clearingActiveAgentPin}
          removingParticipantId={removingParticipantId}
          projects={chatProjects}
          projectsLoading={chatProjectsLoading}
          projectsError={chatProjectsError}
          movingProject={movingProject}
          threadDocumentUploads={activeThreadDocumentUploads}
          threadDocumentError={threadDocumentError}
          removingDocumentId={removingDocumentId}
          onOpenAddParticipants={() => setShowAddParticipantsModal(true)}
          onOpenInspector={openContextInspector}
          onOpenClearThread={() => setShowClearContextModal(true)}
          onSwitchActiveAgent={(agentId) => void setActiveAgentForThread(agentId)}
          onClearActiveAgentPin={() => void clearActiveAgentPinForThread()}
          onRemoveParticipant={(participant) => void removeParticipantFromThread(participant)}
          onMoveProject={moveThreadToProject}
          onCreateProject={createChatProject}
          onRenameThread={renameThread}
          onRemoveThreadDocument={removeThreadDocument}
          onDismissThreadUpload={dismissThreadUpload}
          onClose={closeThreadDrawer}
        />
      </TeamChatPerfBoundary>

      {showInvite ? (
        <InviteMemberDialog
          onClose={() => setShowInvite(false)}
          onInvited={(invite) => setPendingInvites((current) => [invite, ...current])}
        />
      ) : null}

      {showNewThreadModal ? (
        <NewThreadModal
          currentUserId={currentUserId}
          currentUserName={currentUserName}
          users={members}
          agents={agents}
          projects={chatProjects}
          projectsLoading={chatProjectsLoading}
          projectsError={chatProjectsError}
          initialProjectId={newThreadInitialProjectId}
          onClose={closeNewThreadModal}
          onSubmit={createFreshThread}
        />
      ) : null}

      {showAddParticipantsModal && activeConversation ? (
        <NewThreadModal
          currentUserId={currentUserId}
          currentUserName={currentUserName}
          users={members}
          agents={agents}
          mode="add"
          threadLabel={activeConversation.name ?? getConversationLabel(activeConversation, currentUserId)}
          existingUserIds={activeConversation.members.filter((member) => member.kind === "user").map((member) => member.id)}
          existingAgentIds={activeConversation.members.filter((member) => member.kind === "agent").map((member) => member.id)}
          onClose={() => setShowAddParticipantsModal(false)}
          onSubmit={addParticipantsToThread}
        />
      ) : null}

      {showClearContextModal && clearThreadAvailable && activeAgentParticipant ? (
        <ClearAgentContextDialog
          agentName={activeAgentParticipant.name}
          loading={clearingConversation}
          onClose={() => {
            if (!clearingConversation) setShowClearContextModal(false);
          }}
          onConfirm={clearAgentConversation}
        />
      ) : null}

      {showContextInspector && activeAgentInspector ? (
        <TeamChatPerfBoundary
          id="ContextInspectorDialog"
          detail={{
            activeConversationId,
            estimatedTokens: activeAgentInspector.context.estimatedTokens,
            resolvedSourceCount: activeAgentInspector.context.resolvedSources.length,
          }}
        >
          <ContextInspectorDialog
            data={activeAgentInspector}
            copiedView={copiedInspectorView}
            onClose={closeContextInspector}
            onCopyPretty={() => void copyToClipboard(inspectorPrettyText, "pretty")}
            onCopyJson={() => void copyToClipboard(JSON.stringify(activeAgentInspector, null, 2), "json")}
          />
        </TeamChatPerfBoundary>
      ) : null}
    </div>
  );
}
