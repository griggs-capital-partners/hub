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
import { ConversationPane } from "@/components/team/ConversationPane";
import { NewThreadModal } from "@/components/team/NewThreadModal";
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
  getConversationAvatar,
  getConversationLabel,
  getConversationProjectSections,
  getConversationParticipantSummary,
  getConversationTimestamp,
  getConversationWorkspaceLabel,
  getDirectConversationPartner,
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

type TeamChatRouteState =
  | { kind: "rail" }
  | { kind: "discovery" }
  | { kind: "project"; projectId: string }
  | { kind: "search"; query: string; projectId?: string | null }
  | {
      kind: "thread";
      conversationId: string;
      context?: "discover" | "project" | "search";
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
  const selectedConversationIdRef = useRef<string | null>(selectedConversationId);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [showThreadStarter, setShowThreadStarter] = useState(initialConversations.length === 0);
  const [threadDrawerOpen, setThreadDrawerOpen] = useState(false);
  const hasStreamingAgentMessage = messages.some((message) => message.isStreaming);
  const hasHandledAgentParamRef = useRef(false);
  const routeView = searchParams.get("view");
  const routeContext = searchParams.get("context");
  const routeConversationId = searchParams.get("conversationId");
  const routeProjectId = searchParams.get("projectId");
  const routeQuery = searchParams.get("q") ?? "";
  const routeAgentId = searchParams.get("agent");

  conversationsRef.current = conversations;
  selectedConversationIdRef.current = selectedConversationId;

  const isConversationStillSelected = useCallback((conversationId: string | null) => {
    return selectedConversationIdRef.current === conversationId;
  }, []);

  const replaceMessagesForConversation = useCallback((
    conversationId: string | null,
    nextMessages: ChatMessage[]
  ) => {
    if (!isConversationStillSelected(conversationId)) {
      return;
    }

    setMessages((current) => (
      isConversationStillSelected(conversationId)
        ? nextMessages
        : current
    ));
  }, [isConversationStillSelected]);

  const updateMessagesForConversation = useCallback((
    conversationId: string | null,
    updater: (current: ChatMessage[]) => ChatMessage[] 
  ) => {
    if (!isConversationStillSelected(conversationId)) {
      return;
    }

    setMessages((current) => (
      isConversationStillSelected(conversationId)
        ? updater(current)
        : current
    ));
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
  }, [discoveryQuery, selectedProjectId, showDiscoveryView]);

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

    return {
      kind: "thread",
      conversationId,
      context: "discover",
    };
  }, [getThreadOriginState]);

  const getFallbackRouteState = useCallback((): TeamChatRouteState => {
    return getThreadOriginState() ?? { kind: "rail" };
  }, [getThreadOriginState]);

  function openSearchDiscovery() {
    setSelectedConversationId(null);
    setSelectedProjectId(null);
    setDiscoveryQuery("");
    setShowDiscoveryView(true);
    syncTeamChatRoute({ kind: "discovery" });
  }

  function openProjectSummary(projectId: string) {
    setSelectedConversationId(null);
    setSelectedProjectId(projectId);
    setDiscoveryQuery("");
    setShowDiscoveryView(true);
    syncTeamChatRoute({ kind: "project", projectId });
  }

  function openConversationFromRail(conversationId: string) {
    const nextRouteState = getThreadRouteState(conversationId);
    setSelectedConversationId(conversationId);
    if (!nextRouteState.context) {
      setSelectedProjectId(null);
      setDiscoveryQuery("");
      setShowDiscoveryView(false);
    }
    syncTeamChatRoute(nextRouteState);
  }

  function openConversationFromDiscovery(conversationId: string) {
    setSelectedConversationId(conversationId);
    syncTeamChatRoute(getThreadRouteState(conversationId));
  }

  function handleDiscoveryQueryChange(value: string) {
    const trimmedValue = value.trim();
    const nextRouteState = trimmedValue
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
    syncTeamChatRoute(nextRouteState, searchParams.get("view") === "search" ? "replace" : "push");
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
    syncTeamChatRoute({ kind: "rail" }, "replace");
  }

  function closeActiveConversation() {
    setSelectedConversationId(null);
    syncTeamChatRoute(getFallbackRouteState(), "replace");
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
        }
      } catch {
      }
    }

    const interval = setInterval(refreshConversations, 30_000);
    return () => clearInterval(interval);
  }, [isDesktop]);

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

  const activeConversation = useMemo(
    () => conversations.find((conversation) => conversation.id === selectedConversationId) ?? null,
    [conversations, selectedConversationId]
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

  useEffect(() => {
    const conversationId = selectedConversationId;

    async function loadMessages() {
      if (!conversationId) {
        return;
      }

      setLoadingMessages(true);
      try {
        const response = await fetch(`/api/chat/conversations/${conversationId}/messages`);
        const data = await response.json();
        if (data.messages) {
          replaceMessagesForConversation(conversationId, data.messages);
        }
        if (data.conversation && isConversationStillSelected(conversationId)) {
          setConversations((current) => {
            const others = current.filter((conversation) => conversation.id !== data.conversation.id);
            return [data.conversation, ...others].sort(
              (a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
            );
          });
        }
      } catch {
      } finally {
        if (isConversationStillSelected(conversationId)) {
          setLoadingMessages(false);
        }
      }
    }

    if (!conversationId) {
      setLoadingMessages(false);
      return;
    }

    loadMessages();
  }, [isConversationStillSelected, replaceMessagesForConversation, selectedConversationId]);

  useEffect(() => {
    const conversationId = selectedConversationId;
    if (!conversationId || hasStreamingAgentMessage) return;

    async function pollMessages() {
      try {
        const response = await fetch(`/api/chat/conversations/${conversationId}/messages`);
        const data = await response.json();
        if (data.messages) {
          replaceMessagesForConversation(conversationId, data.messages);
        }
      } catch {
      }
    }

    const interval = setInterval(pollMessages, 3_000);
    return () => clearInterval(interval);
  }, [hasStreamingAgentMessage, replaceMessagesForConversation, selectedConversationId]);

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
    setMessages([]);
  }, [selectedConversationId]);

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

  const refreshConversationInspector = useCallback(async (conversationId: string) => {
    if (!isConversationStillSelected(conversationId)) {
      return;
    }

    const convo = conversationsRef.current.find((conversation) => conversation.id === conversationId);
    const isAgentConversation = convo?.members.some((member) => member.kind === "agent");

    if (!isAgentConversation) {
      if (isConversationStillSelected(conversationId)) {
        clearConversationInspectorState();
      }
      return;
    }

    if (!startInspectorRequestForConversation(conversationId)) {
      return;
    }

    try {
      const response = await fetch(`/api/chat/conversations/${conversationId}/inspect`, {
        headers: { Accept: "application/json" },
      });
      const data = await parseApiResponse(response);

      if (!response.ok) {
        setInspectorErrorForConversation(
          conversationId,
          getApiErrorMessage(data.error) ?? "Failed to initialize the agent"
        );
        return;
      }

      if (!("readiness" in data) || !("agent" in data) || !("threadLlm" in data)) {
        setInspectorErrorForConversation(conversationId, "Failed to initialize the agent");
        return;
      }

      const inspectorData = data as unknown as AgentInspectorData;
      const appliedInspector = applyInspectorForConversation(conversationId, inspectorData);
      if (!appliedInspector) {
        return;
      }

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
    if (!selectedConversationId) {
      clearConversationInspectorState();
      return;
    }

    void refreshConversationInspector(selectedConversationId);
  }, [clearConversationInspectorState, refreshConversationInspector, selectedConversationId, activeConversationPrimaryAgent?.id]);

  useEffect(() => {
    if (!selectedConversationId) {
      return;
    }

    const conversationId = selectedConversationId;

    function handleRefresh() {
      void refreshConversationInspector(conversationId);
    }

    function handleVisibilityChange() {
      if (document.visibilityState === "visible") {
        handleRefresh();
      }
    }

    window.addEventListener("focus", handleRefresh);
    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      window.removeEventListener("focus", handleRefresh);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [refreshConversationInspector, selectedConversationId]);

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
          (current) => current.filter((upload) => upload.id !== uploadId)
        );
      } catch (error) {
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
    options?: { forceNew?: boolean; projectId?: string | null; history?: "push" | "replace" }
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
      setSelectedConversationId(routeConversationId);
      if (routeContext === "search") {
        const trimmedRouteQuery = routeQuery.trim();
        if (trimmedRouteQuery) {
          setSelectedProjectId(routeProjectId || null);
          setDiscoveryQuery(routeQuery);
          setShowDiscoveryView(true);
          return;
        }
      }

      if (routeContext === "project" && routeProjectId) {
        setSelectedProjectId(routeProjectId);
        setDiscoveryQuery("");
        setShowDiscoveryView(true);
        return;
      }

      if (routeContext === "discover") {
        setSelectedProjectId(null);
        setDiscoveryQuery("");
        setShowDiscoveryView(true);
        return;
      }

      setSelectedProjectId(null);
      setDiscoveryQuery("");
      setShowDiscoveryView(false);
      return;
    }

    if (routeView === "project" && routeProjectId) {
      setSelectedConversationId(null);
      setSelectedProjectId(routeProjectId);
      setDiscoveryQuery("");
      setShowDiscoveryView(true);
      return;
    }

    if (routeView === "search") {
      const trimmedRouteQuery = routeQuery.trim();

      if (!trimmedRouteQuery) {
        setSelectedConversationId(null);
        setSelectedProjectId(routeProjectId || null);
        setDiscoveryQuery("");
        setShowDiscoveryView(true);
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
      return;
    }

    if (routeView === "discover") {
      setSelectedConversationId(null);
      setSelectedProjectId(null);
      setDiscoveryQuery("");
      setShowDiscoveryView(true);
      return;
    }

    setSelectedConversationId(null);
    setSelectedProjectId(null);
    setDiscoveryQuery("");
    setShowDiscoveryView(initialConversations.length === 0);
  }, [
    initialConversations.length,
    routeAgentId,
    routeContext,
    routeConversationId,
    routeProjectId,
    routeQuery,
    syncTeamChatRoute,
    routeView,
  ]);

  useEffect(() => {
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
  }, [discoveryQuery]);

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

    if (totalSelected === 1) {
      const conversation = await openDirectConversation(
        userIds.length === 1 ? { userId: userIds[0] } : { agentId: agentIds[0] },
        { forceNew: true, projectId }
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
    if (!selectedConversationId || !messageInput.trim() || sending) return;
    if (activeAgentSendBlocked) return;

    const conversationId = selectedConversationId;
    const text = messageInput.trim();
    const isAgentConversation = Boolean(activeConversationPrimaryAgent);
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
          id: activeConversationPrimaryAgent?.id ?? "agent",
          name: activeConversationPrimaryAgent?.name ?? "Agent",
          image: activeConversationPrimaryAgent?.image ?? null,
        },
      }
      : null;
    let receivedRuntimeSnapshot = false;
    let appliedRuntimeSnapshot = false;

    setMessageInput("");
    setSending(true);
    updateMessagesForConversation(conversationId, (current) => [
      ...current,
      optimisticMessage,
      ...(optimisticAgentMessage ? [optimisticAgentMessage] : []),
    ]);

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
              updateMessagesForConversation(conversationId, (current) =>
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
              updateMessagesForConversation(conversationId, (current) =>
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
              updateMessagesForConversation(conversationId, (current) =>
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
              updateMessagesForConversation(conversationId, (current) =>
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
              updateMessagesForConversation(conversationId, (current) =>
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
              updateMessagesForConversation(conversationId, (current) =>
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
              updateMessagesForConversation(conversationId, (current) => {
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
          updateMessagesForConversation(conversationId, (current) => [
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

      if (isAgentConversation && (!receivedRuntimeSnapshot || !appliedRuntimeSnapshot)) {
        fetch(`/api/chat/conversations/${conversationId}/inspect`, {
          headers: { Accept: "application/json" },
        })
          .then(async (res) => ({
            ok: res.ok,
            data: await parseApiResponse(res),
          }))
          .then((data) => {
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
      updateMessagesForConversation(conversationId, (current) =>
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
    const conversationId = selectedConversationId;
    if (!conversationId) return;

    try {
      const [messagesResponse, conversationsResponse] = await Promise.all([
        fetch(`/api/chat/conversations/${conversationId}/messages`),
        fetch("/api/chat/conversations"),
      ]);
      const [messagesData, conversationsData] = await Promise.all([
        messagesResponse.json(),
        conversationsResponse.json(),
      ]);

      if (messagesData.messages) {
        replaceMessagesForConversation(conversationId, messagesData.messages);
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

  const activeConversationAvatar = activeConversation
    ? getConversationAvatar(activeConversation, currentUserId)
    : null;
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
      && (agentInspectorLoading || bootstrappingConversationId === selectedConversationId);
  const activeThreadModelLabel = activeAgentInspector?.threadLlm.selectedLabel
    ?? activeConversation?.llmThread?.selectedLabel
    ?? activeAgentInspector?.threadLlm.selectedModel
    ?? activeConversation?.llmThread?.selectedModel
    ?? activeAgentInspector?.agent.llmModel
    ?? null;
  const activeAgentReady =
    activeAgentParticipant
      ? activeAgentInspector
        ? Boolean(activeAgentInspector.readiness.canSend)
        : activeAgentParticipant.llmStatus === "online"
      : true;
  const activeAgentSendBlocked =
    Boolean(activeAgentParticipant) && (!activeAgentReady || activeAgentBootstrapPending);
  const activeAgentStatusLabel =
    activeAgentParticipant
      ? activeAgentBootstrapPending
        ? "Initializing agent"
        : activeAgentInspector?.readiness.label || getAgentSidebarStatus(activeAgentParticipant.llmStatus).label
      : null;
  const clearThreadAvailable = Boolean(activeConversation?.type === "direct" && activeAgentParticipant);
  const activeConversationMembers = activeConversation?.members ?? [];
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
            />

            {activeConversation ? (
              <ConversationPane
                currentUserId={currentUserId}
                activeConversation={activeConversation}
                activeConversationAvatar={activeConversationAvatar}
                activeConversationMembers={activeConversationMembers}
                activeConversationParticipantSummary={activeConversationParticipantSummary}
                activeConversationWorkspaceLabel={activeConversationWorkspaceLabel}
                activeConversationTimestamp={activeConversationTimestamp}
                activePartner={activePartner}
                activeAgentParticipant={activeAgentParticipant}
                activeThreadModelLabel={activeThreadModelLabel}
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
                removingDocumentId={removingDocumentId}
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
                onToggleDrawer={() => setThreadDrawerOpen((current) => !current)}
                onHandleChatScroll={handleChatScroll}
                onChangeMessageInput={setMessageInput}
                onUploadThreadDocuments={uploadThreadDocuments}
                onSubmitMessage={handleSendMessage}
                onSendMessage={sendCurrentMessage}
                onChangeEditingDraft={setEditingDraft}
                onCancelEditingMessage={cancelEditingMessage}
                onSaveEditedMessage={saveEditedMessage}
                onRemoveThreadDocument={removeThreadDocument}
                onDismissThreadUpload={dismissThreadUpload}
                onCopyMessage={(body, messageId) => void copyToClipboard(body, "message", messageId)}
                onStartEditingMessage={startEditingMessage}
                onDeleteMessage={deleteMessage}
              />
            ) : showDiscoveryPane ? (
              <TeamDiscoveryPane
                currentUserId={currentUserId}
                projects={chatProjects}
                conversations={conversations}
                threadSections={threadSections}
                searchResults={searchResults}
                searchLoading={searchLoading}
                searchError={searchError}
                selectedProjectId={selectedProjectId}
                searchQuery={discoveryQuery}
                isDesktop={isDesktop}
                onChangeSearchQuery={handleDiscoveryQueryChange}
                onOpenConversation={openConversationFromDiscovery}
                onOpenProject={openProjectSummary}
                onOpenNewThread={openNewThreadComposer}
                onBack={closeDiscoveryPane}
              />
            ) : null}
        </div>
      </div>

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
        onOpenInspector={() => setShowContextInspector(true)}
        onOpenClearThread={() => setShowClearContextModal(true)}
        onSwitchActiveAgent={(agentId) => void setActiveAgentForThread(agentId)}
        onClearActiveAgentPin={() => void clearActiveAgentPinForThread()}
        onRemoveParticipant={(participant) => void removeParticipantFromThread(participant)}
        onMoveProject={moveThreadToProject}
        onCreateProject={createChatProject}
        onRenameThread={renameThread}
        onRemoveThreadDocument={removeThreadDocument}
        onDismissThreadUpload={dismissThreadUpload}
        onClose={() => setThreadDrawerOpen(false)}
      />

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
        <ContextInspectorDialog
          data={activeAgentInspector}
          copiedView={copiedInspectorView}
          onClose={() => setShowContextInspector(false)}
          onCopyPretty={() => void copyToClipboard(inspectorPrettyText, "pretty")}
          onCopyJson={() => void copyToClipboard(JSON.stringify(activeAgentInspector, null, 2), "json")}
        />
      ) : null}
    </div>
  );
}
