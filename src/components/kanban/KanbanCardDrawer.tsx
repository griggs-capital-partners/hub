"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { AnimatePresence, motion } from "framer-motion";
import {
  BookOpenText,
  Bot,
  Check,
  ChevronDown,
  Copy,
  ExternalLink,
  FolderGit2,
  GitBranch,
  GitCommit,
  Globe2,
  Layers,
  Loader2,
  Paperclip,
  Play,
  Send,
  Settings2,
  Trash2,
  X,
  Zap,
  RotateCcw,
} from "lucide-react";
import { Input, Textarea } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { Avatar } from "@/components/ui/Avatar";
import { type KanbanCustomer } from "./KanbanCustomerField";
import { KANBAN_TASK_STATE_META, KANBAN_TASK_STATES, type KanbanTaskState, isKanbanTaskState } from "./taskState";
import { getGroupStatusMeta } from "./TaskGroupRow";
import { normalizeAgentAbilities, resolveAgentActionLabel, type AgentAbility } from "@/lib/agent-task-context";
import { kickoffExecutionProcessing } from "@/lib/agent-execution-client";
import { ACTIVE_COLUMN, BACKLOG_COLUMN, DONE_COLUMN, PO_REVIEW_COLUMN, QA_COLUMN } from "@/lib/kanban-columns";
import { createKanbanSubtask, parseKanbanSubtasks, serializeKanbanSubtasks, type KanbanSubtask, type KanbanSubtaskState } from "@/lib/kanban-subtasks";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

const executionMarkdownComponents = {
  p: ({ children }: { children?: React.ReactNode }) => <p className="mb-2.5 last:mb-0 text-[13px] leading-[1.65] text-[#C8C8C8]">{children}</p>,
  strong: ({ children }: { children?: React.ReactNode }) => <strong className="font-semibold text-[#F0F0F0]">{children}</strong>,
  em: ({ children }: { children?: React.ReactNode }) => <em className="italic text-[#DEDEDE]">{children}</em>,
  h1: ({ children }: { children?: React.ReactNode }) => <p className="mb-2 mt-4 first:mt-0 text-sm font-bold text-[#F0F0F0]">{children}</p>,
  h2: ({ children }: { children?: React.ReactNode }) => <p className="mb-2 mt-3 first:mt-0 text-sm font-bold text-[#EBEBEB]">{children}</p>,
  h3: ({ children }: { children?: React.ReactNode }) => <p className="mb-1.5 mt-2.5 first:mt-0 text-[13px] font-semibold text-[#DEDEDE]">{children}</p>,
  h4: ({ children }: { children?: React.ReactNode }) => <p className="mb-1 mt-2 first:mt-0 text-[13px] font-semibold text-[#D0D0D0]">{children}</p>,
  ul: ({ children }: { children?: React.ReactNode }) => <ul className="mb-2.5 space-y-1 pl-4">{children}</ul>,
  ol: ({ children }: { children?: React.ReactNode }) => <ol className="mb-2.5 space-y-1 pl-4 list-decimal marker:text-[#606060]">{children}</ol>,
  li: ({ children }: { children?: React.ReactNode }) => (
    <li className="text-[13px] leading-[1.6] flex gap-2.5">
      <span className="mt-[7px] w-1 h-1 rounded-full bg-[#F7941D]/50 flex-shrink-0" />
      <span className="flex-1 text-[#C4C4C4]">{children}</span>
    </li>
  ),
  code: ({ className, children }: { className?: string; children?: React.ReactNode }) => {
    const isBlock = /language-/.test(className ?? "");
    return isBlock ? (
      <pre className="my-2.5 overflow-x-auto rounded-xl bg-[#0A0A0B] px-3.5 py-3 text-[11px] font-mono text-[#A8E6CF] leading-relaxed whitespace-pre border border-[rgba(255,255,255,0.07)]">
        <code>{children}</code>
      </pre>
    ) : (
      <code className="px-1.5 py-0.5 rounded-md bg-[rgba(255,255,255,0.07)] text-[#FBCB3A] text-[11px] font-mono border border-[rgba(255,255,255,0.1)]">{children}</code>
    );
  },
  pre: ({ children }: { children?: React.ReactNode }) => <>{children}</>,
  blockquote: ({ children }: { children?: React.ReactNode }) => (
    <blockquote className="my-2.5 pl-3.5 border-l-2 border-[#F7941D]/40 text-[#AAAAAA] italic text-[13px] leading-[1.6]">{children}</blockquote>
  ),
  hr: () => <hr className="my-4 border-[rgba(255,255,255,0.08)]" />,
  a: ({ href, children }: { href?: string; children?: React.ReactNode }) => (
    <a href={href} target="_blank" rel="noopener noreferrer" className="text-[#F7941D] underline underline-offset-2 hover:text-[#FBCB3A]">{children}</a>
  ),
  table: ({ children }: { children?: React.ReactNode }) => (
    <div className="my-2.5 overflow-x-auto rounded-xl border border-[rgba(255,255,255,0.07)]">
      <table className="w-full text-[12px] text-[#C4C4C4]">{children}</table>
    </div>
  ),
  thead: ({ children }: { children?: React.ReactNode }) => <thead className="bg-[rgba(255,255,255,0.04)] text-[#E0E0E0]">{children}</thead>,
  th: ({ children }: { children?: React.ReactNode }) => <th className="px-3 py-2 text-left font-semibold border-b border-[rgba(255,255,255,0.08)]">{children}</th>,
  td: ({ children }: { children?: React.ReactNode }) => <td className="px-3 py-1.5 border-b border-[rgba(255,255,255,0.05)] last:border-0">{children}</td>,
};

type DrawerSprint = {
  id: string;
  name: string;
  status: string;
  startDate: string;
  endDate: string;
};

type DrawerSprintTask = {
  id: string;
  sprintId: string;
  sprint: { id: string; name: string; status: string };
} | null;

type DrawerUser = {
  id: string;
  name: string | null;
  displayName: string | null;
  email: string;
  image: string | null;
};

type EditableCard = {
  id: string;
  title: string;
  body: string | null;
  subtasks: string;
  priority: string;
  state: string;
  labels: string;
  githubIssueId: number | null;
  githubIssueUrl: string | null;
  assignees: string;
  wells?: KanbanCustomer[];
  customers?: KanbanCustomer[];
  notes: {
    id: string;
    body: string;
    image?: string | null;
    createdAt: string | Date;
    author: { id: string; name: string | null; displayName?: string | null; image: string | null; email: string };
  }[];
  agentExecutions: {
    id: string;
    actionType: string;
    status: string;
    createdAt: string | Date;
    agent: { id: string; name: string; avatar: string | null; abilities: string | null };
  }[];
  sprintTask: DrawerSprintTask;
  repoId?: string;
  repoName?: string;
  repoFullName?: string;
  repoIndex?: number;
  columnId?: string;
  columnName?: string;
  columnPosition?: number;
  isSprintOnly?: boolean;
  linkedRepoIds?: string[];
  taskGroupId?: string | null;
};

type TaskGroupRef = {
  id: string;
  name: string;
  status: string;
  color: string | null;
  cardIds?: string[];
};

export type KanbanDrawerRepoOption = {
  id: string;
  name: string;
  fullName?: string;
  index?: number;
  columns: { id: string; name: string; position: number }[];
};

export type CreatedTaskPayload = EditableCard & {
  columnId: string;
  columnName: string;
  columnPosition: number;
  position: number;
  repoId: string;
  repoName: string;
  repoFullName: string;
  isSprintOnly: false;
  linkedRepoIds: string[];
};

type LinkedCommit = {
  sha: string;
  html_url: string;
  commit: {
    message: string;
    author: { name: string; date: string } | null;
  };
  author: { login: string; avatar_url: string } | null;
  linkedTasks: { id: string; title: string; state: string; columnName?: string | null }[];
};

interface Props {
  open: boolean;
  card: EditableCard | null;
  users: DrawerUser[];
  sprints: DrawerSprint[];
  customers: KanbanCustomer[];
  mode?: "edit" | "create";
  repoOptions?: KanbanDrawerRepoOption[];
  initialRepoId?: string | null;
  initialColumnId?: string | null;
  currentUserId?: string | null;
  taskGroups?: TaskGroupRef[];
  groupTasks?: { id: string; title: string; columnName?: string }[];
  groupName?: string;
  onSwitchGroupTask?: (cardId: string) => void;
  onClose: () => void;
  onSaved: (cardId: string, updates: Partial<EditableCard>) => void;
  onCreated?: (task: CreatedTaskPayload) => void;
  onDelete?: (card: EditableCard) => Promise<boolean | void> | boolean | void;
  onSprintChange: (cardId: string, sprintTask: DrawerSprintTask) => void;
  onTaskGroupChange?: (cardId: string, taskGroupId: string | null) => void;
}

const PRIORITIES = ["low", "medium", "high", "critical"] as const;

const PRIORITY_COLORS: Record<(typeof PRIORITIES)[number], string> = {
  low: "#22C55E",
  medium: "#FBBA00",
  high: "#F97316",
  critical: "#EF4444",
};

const PRIORITY_LABELS: Record<(typeof PRIORITIES)[number], string> = {
  low: "Low",
  medium: "Medium",
  high: "High",
  critical: "Critical",
};

const AGENT_COLOR = "#4B9CD3";
const AGENT_COLOR_DIM = "rgba(75,156,211,0.15)";

const COLUMN_ACCENT_MAP: Record<string, string> = {
  [BACKLOG_COLUMN]: "#555555",
  [ACTIVE_COLUMN]: "#F7941D",
  [QA_COLUMN]: "#3B82F6",
  [PO_REVIEW_COLUMN]: "#EAB308",
  [DONE_COLUMN]: "#22C55E",
};

const TAB_META = {
  overview: { label: "Overview", icon: Settings2, tint: "#F7941D", bg: "rgba(247,148,29,0.14)" },
  notes: { label: "Notes", icon: BookOpenText, tint: "#F6B04D", bg: "rgba(247,148,29,0.12)" },
  commits: { label: "Code Commits", icon: GitCommit, tint: "#FBCB3A", bg: "rgba(251,186,0,0.14)" },
  agents: { label: "Agents", icon: Bot, tint: "#7DC4F0", bg: "rgba(75,156,211,0.14)" },
} satisfies Record<"overview" | "notes" | "commits" | "agents", { label: string; icon: React.ComponentType<{ size?: number; className?: string }>; tint: string; bg: string }>;

function CustomerToggle({
  customer,
  selected,
  onClick,
}: {
  customer: KanbanCustomer;
  selected: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="inline-flex min-w-0 items-center gap-2 rounded-xl border px-2 py-1.5 text-xs transition-all"
      style={{
        color: selected ? "#7DD3FC" : "#D0D0D0",
        borderColor: selected ? "rgba(125,211,252,0.34)" : "rgba(255,255,255,0.08)",
        backgroundColor: selected ? "rgba(14,165,233,0.14)" : "rgba(255,255,255,0.03)",
        boxShadow: selected ? "inset 0 0 0 1px rgba(125,211,252,0.2)" : "none",
      }}
    >
      {customer.logoUrl ? (
        <img src={customer.logoUrl} alt={customer.name} className="h-4 w-4 rounded-full object-cover" />
      ) : (
        <Avatar name={customer.name} size="xs" className="!h-4 !w-4 text-[7px]" />
      )}
      <span className="max-w-[92px] truncate">{customer.name}</span>
      <span
        className="flex h-4.5 w-4.5 items-center justify-center rounded-full border"
        style={{
          borderColor: selected ? "rgba(125,211,252,0.45)" : "rgba(255,255,255,0.1)",
          backgroundColor: selected ? "rgba(125,211,252,0.18)" : "transparent",
          color: selected ? "#7DD3FC" : "transparent",
        }}
      >
        <Check size={11} />
      </span>
    </button>
  );
}

function AssigneeToggle({
  user,
  selected,
  onClick,
  compact = false,
}: {
  user: DrawerUser;
  selected: boolean;
  onClick: () => void;
  compact?: boolean;
}) {
  const displayName = user.displayName ?? user.name ?? user.email;
  const compactLabel = displayName.trim().split(/\s+/)[0] ?? displayName;

  return (
    <button
      type="button"
      onClick={onClick}
      className={`inline-flex min-w-0 items-center gap-2 rounded-xl border text-xs transition-all ${
        compact ? "px-2 py-1" : "flex-[1_1_calc(33.333%-0.5rem)] px-2 py-1.5"
      }`}
      style={{
        color: selected ? "#F6B04D" : "#D0D0D0",
        borderColor: selected ? "rgba(247,148,29,0.34)" : "rgba(255,255,255,0.08)",
        backgroundColor: selected ? "rgba(247,148,29,0.14)" : "rgba(255,255,255,0.03)",
        boxShadow: selected ? "inset 0 0 0 1px rgba(247,148,29,0.18)" : "none",
      }}
    >
      <Avatar
        src={user.image}
        name={user.displayName ?? user.name}
        size="xs"
        className={`${compact ? "!h-3.5 !w-3.5" : "!h-4 !w-4"} flex-shrink-0 text-[7px]`}
      />
      <span className={`min-w-0 truncate ${compact ? "max-w-[68px]" : "flex-1"}`}>
        {compact ? compactLabel : displayName}
      </span>
      <span
        className={`${compact ? "h-4 w-4" : "h-4.5 w-4.5"} flex flex-shrink-0 items-center justify-center rounded-full border`}
        style={{
          borderColor: selected ? "rgba(247,148,29,0.45)" : "rgba(255,255,255,0.1)",
          backgroundColor: selected ? "rgba(247,148,29,0.18)" : "transparent",
          color: selected ? "#F6B04D" : "transparent",
        }}
      >
        <Check size={11} />
      </span>
    </button>
  );
}

function formatNoteTime(value: string | Date) {
  const date = value instanceof Date ? value : new Date(value);
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(date);
}

async function readFileAsDataUrl(file: File) {
  return await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === "string") {
        resolve(reader.result);
      } else {
        reject(new Error("Failed to read image"));
      }
    };
    reader.onerror = () => reject(new Error("Failed to read image"));
    reader.readAsDataURL(file);
  });
}

async function optimizeNoteImage(file: File) {
  if (!file.type.startsWith("image/")) {
    throw new Error("Only images are supported right now.");
  }

  if (file.type === "image/gif") {
    const dataUrl = await readFileAsDataUrl(file);
    if (dataUrl.length > 1_500_000) {
      throw new Error("Image is too large. Try a smaller GIF.");
    }
    return dataUrl;
  }

  const sourceUrl = await readFileAsDataUrl(file);
  const image = await new Promise<HTMLImageElement>((resolve, reject) => {
    const nextImage = new Image();
    nextImage.onload = () => resolve(nextImage);
    nextImage.onerror = () => reject(new Error("Failed to load image"));
    nextImage.src = sourceUrl;
  });

  const maxEdge = 1600;
  const scale = Math.min(1, maxEdge / Math.max(image.width, image.height));
  const width = Math.max(1, Math.round(image.width * scale));
  const height = Math.max(1, Math.round(image.height * scale));

  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext("2d");
  if (!context) {
    return sourceUrl;
  }

  context.drawImage(image, 0, 0, width, height);

  let optimized = canvas.toDataURL("image/webp", 0.82);
  if (!optimized.startsWith("data:image/webp")) {
    optimized = canvas.toDataURL(file.type || "image/png", 0.85);
  }

  if (optimized.length > 1_500_000) {
    optimized = canvas.toDataURL("image/jpeg", 0.72);
  }

  if (optimized.length > 1_500_000) {
    throw new Error("Image is too large after compression. Try a smaller screenshot.");
  }

  return optimized;
}

export function KanbanCardDrawer({
  open,
  card,
  users,
  sprints,
  customers: wells,
  mode = "edit",
  repoOptions = [],
  initialRepoId = null,
  initialColumnId = null,
  currentUserId = null,
  taskGroups,
  groupTasks,
  groupName,
  onSwitchGroupTask,
  onClose,
  onSaved,
  onCreated,
  onDelete,
  onSprintChange,
  onTaskGroupChange,
}: Props) {
  const isCreateMode = mode === "create";
  const fallbackRepoId = initialRepoId ?? repoOptions[0]?.id ?? null;
  const defaultRepo = repoOptions.find((repo) => repo.id === fallbackRepoId) ?? repoOptions[0] ?? null;
  const defaultColumn =
    (initialColumnId
      ? defaultRepo?.columns.find((column) => column.id === initialColumnId)
      : undefined) ??
    defaultRepo?.columns.find((column) => column.name === "Backlog") ??
    defaultRepo?.columns[0] ??
    null;
  const [title, setTitle] = useState(() => card?.title ?? "");
  const [body, setBody] = useState(() => card?.body ?? "");
  const [subtasks, setSubtasks] = useState<KanbanSubtask[]>(() => parseKanbanSubtasks(card?.subtasks ?? "[]"));
  const [priority, setPriority] = useState<EditableCard["priority"]>(() => card?.priority ?? "medium");
  const [taskState, setTaskState] = useState<KanbanTaskState>(() =>
    card?.state && isKanbanTaskState(card.state) ? card.state : "normal"
  );
  const [labelInput, setLabelInput] = useState("");
  const [selectedLabels, setSelectedLabels] = useState<string[]>(() =>
    card ? (JSON.parse(card.labels || "[]") as string[]) : []
  );
  const [selectedAssigneeIds, setSelectedAssigneeIds] = useState<string[]>(() =>
    card ? (JSON.parse(card.assignees || "[]") as string[]) : []
  );
  const [selectedCustomerIds, setSelectedCustomerIds] = useState<string[]>(() =>
    (card?.wells ?? card?.customers ?? []).map((w) => w.id)
  );
  const [selectedLinkedRepoIds, setSelectedLinkedRepoIds] = useState<string[]>(() =>
    card?.linkedRepoIds ?? []
  );
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedRepoId, setSelectedRepoId] = useState<string | null>(() => card?.repoId ?? defaultRepo?.id ?? null);
  const [selectedColumnId, setSelectedColumnId] = useState<string | null>(() => card?.columnId ?? defaultColumn?.id ?? null);
  const [createGithubIssue, setCreateGithubIssue] = useState(false);
  const [repoMenuOpen, setRepoMenuOpen] = useState(false);
  const [priorityMenuOpen, setPriorityMenuOpen] = useState(false);
  const [sprintMenuOpen, setSprintMenuOpen] = useState(false);
  const [customerMenuOpen, setCustomerMenuOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<"overview" | "notes" | "commits" | "agents">("overview");
  const [notes, setNotes] = useState(() => card?.notes ?? []);
  const [linkedCommits, setLinkedCommits] = useState<LinkedCommit[]>([]);
  const [loadingCommits, setLoadingCommits] = useState(false);
  const [taskIdCopied, setTaskIdCopied] = useState(false);
  const [noteBody, setNoteBody] = useState("");
  const [noteImage, setNoteImage] = useState<string | null>(null);
  const [previewImage, setPreviewImage] = useState<string | null>(null);
  const [sendingNote, setSendingNote] = useState(false);
  const [deletingNoteId, setDeletingNoteId] = useState<string | null>(null);
  const [confirmDeleteNoteId, setConfirmDeleteNoteId] = useState<string | null>(null);
  const [currentTaskGroupId, setCurrentTaskGroupId] = useState<string | null>(() => card?.taskGroupId ?? null);
  const [groupMenuOpen, setGroupMenuOpen] = useState(false);
  const [settingGroup, setSettingGroup] = useState(false);
  const repoMenuRef = useRef<HTMLDivElement>(null);
  const priorityMenuRef = useRef<HTMLDivElement>(null);
  const sprintMenuRef = useRef<HTMLDivElement>(null);
  const customerMenuRef = useRef<HTMLDivElement>(null);
  const groupMenuRef = useRef<HTMLDivElement>(null);
  const noteImageInputRef = useRef<HTMLInputElement>(null);
  const notesScrollRef = useRef<HTMLDivElement>(null);

  // ── Agent execution state ─────────────────────────────────────────────────
  type AgentOption = { id: string; name: string; role: string; avatar: string | null; status: string; llmStatus: string; abilities?: string | null };
  type ExecutionRecord = {
    id: string; agentId: string; actionType: string; status: string; response: string | null;
    errorMessage: string | null; modelUsed: string | null; notes: string | null;
    createdAt: string; agent: { id: string; name: string; role: string; abilities?: string | null };
  };
  const [agentOptions, setAgentOptions] = useState<AgentOption[]>([]);
  const [selectedAgentId, setSelectedAgentId] = useState<string>("");
  const [selectedActionType, setSelectedActionType] = useState<string>("");
  const [agentNotes, setAgentNotes] = useState("");
  const [executing, setExecuting] = useState(false);
  const [executeError, setExecuteError] = useState<string | null>(null);
  const [retryingExecutionId, setRetryingExecutionId] = useState<string | null>(null);
  const [cardExecutions, setCardExecutions] = useState<ExecutionRecord[]>([]);
  const [loadingAgents, setLoadingAgents] = useState(false);
  const [expandedExecutionId, setExpandedExecutionId] = useState<string | null>(null);

  const linkedCustomers = useMemo(
    () => wells.filter((w) => selectedCustomerIds.includes(w.id)),
    [wells, selectedCustomerIds]
  );
  const orderedNotes = useMemo(
    () =>
      [...notes].sort(
        (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
      ),
    [notes]
  );
  const activeSprints = sprints.filter((sprint) => sprint.status === "active" || sprint.status === "planning");
  const selectedAgent = agentOptions.find((agent) => agent.id === selectedAgentId) ?? null;
  const availableActionTypes: AgentAbility[] = selectedAgent ? normalizeAgentAbilities(selectedAgent.abilities ?? null) : [];

  const sprintFeatureEnabled = false;
  const selectedRepo =
    (selectedRepoId ? repoOptions.find((repo) => repo.id === selectedRepoId) : undefined) ??
    defaultRepo;
  const availableColumns = selectedRepo?.columns ?? [];
  const selectedColumn =
    (selectedColumnId ? availableColumns.find((column) => column.id === selectedColumnId) : undefined) ??
    availableColumns.find((column) => column.name === "Backlog") ??
    availableColumns[0] ??
    null;
  const activeRepoFullName = selectedRepo?.fullName ?? card?.repoFullName ?? null;

  useEffect(() => {
    function handlePointerDown(event: MouseEvent) {
      const target = event.target as Node;

      if (repoMenuOpen && repoMenuRef.current && !repoMenuRef.current.contains(target)) {
        setRepoMenuOpen(false);
      }
      if (priorityMenuOpen && priorityMenuRef.current && !priorityMenuRef.current.contains(target)) {
        setPriorityMenuOpen(false);
      }
      if (sprintMenuOpen && sprintMenuRef.current && !sprintMenuRef.current.contains(target)) {
        setSprintMenuOpen(false);
      }
      if (customerMenuOpen && customerMenuRef.current && !customerMenuRef.current.contains(target)) {
        setCustomerMenuOpen(false);
      }
      if (groupMenuOpen && groupMenuRef.current && !groupMenuRef.current.contains(target)) {
        setGroupMenuOpen(false);
      }
    }

    if (!repoMenuOpen && !priorityMenuOpen && !sprintMenuOpen && !customerMenuOpen && !groupMenuOpen) return;

    document.addEventListener("mousedown", handlePointerDown);
    return () => document.removeEventListener("mousedown", handlePointerDown);
  }, [customerMenuOpen, groupMenuOpen, priorityMenuOpen, repoMenuOpen, sprintMenuOpen]);

  useEffect(() => {
    if (activeTab !== "notes" || !notesScrollRef.current) return;
    notesScrollRef.current.scrollTop = notesScrollRef.current.scrollHeight;
  }, [activeTab, orderedNotes.length]);

  // Load agents + card executions when Agents tab is opened
  useEffect(() => {
    if (activeTab !== "agents" || isCreateMode || !currentUserId) return;

    async function loadAgentData() {
      setLoadingAgents(true);
      try {
        const [agentsRes, execRes] = await Promise.all([
          fetch("/api/agents", { cache: "no-store" }),
          card?.id ? fetch(`/api/agent-executions?kanbanCardId=${card.id}`, { cache: "no-store" }) : Promise.resolve(null),
        ]);
        if (agentsRes.ok) {
          const json = await agentsRes.json() as { agents?: AgentOption[] } | AgentOption[];
          const data: AgentOption[] = Array.isArray(json) ? json : ((json as { agents?: AgentOption[] }).agents ?? []);
          const active = data.filter((a) => a.status === "active" || a.status !== "inactive");
          setAgentOptions(active);
          if (active.length > 0 && !selectedAgentId) {
            setSelectedAgentId(active[0].id);
            const firstAbilities = normalizeAgentAbilities(active[0].abilities ?? null);
            setSelectedActionType(firstAbilities[0]?.id ?? "");
          }
        }
        if (execRes?.ok) {
          const execs = await execRes.json() as ExecutionRecord[];
          setCardExecutions(execs);
        } else if (execRes?.status === 401 || agentsRes.status === 401) {
          setAgentOptions([]);
          setCardExecutions([]);
        }
      } finally {
        setLoadingAgents(false);
      }
    }

    void loadAgentData();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab, card?.id, currentUserId, isCreateMode]);

  useEffect(() => {
    if (!selectedAgent) return;
    const supported = normalizeAgentAbilities(selectedAgent.abilities ?? null);
    if (!supported.some((ability) => ability.id === selectedActionType)) {
      setSelectedActionType(supported[0]?.id ?? "");
    }
  }, [selectedAgent, selectedActionType]);

  async function handleExecuteAgent() {
    if (!card?.id || !selectedAgentId || executing) return;
    setExecuteError(null);
    setExecuting(true);

    try {
      const res = await fetch("/api/agent-executions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          kanbanCardId: card.id,
          agentId: selectedAgentId,
          actionType: selectedActionType,
          notes: agentNotes.trim() || undefined,
        }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => null) as { error?: string } | null;
        setExecuteError(data?.error ?? "Could not start the agent execution.");
        return;
      }

      const execution = await res.json() as { id: string };
      window.dispatchEvent(new CustomEvent("kanban-agent-execution-started", { detail: { cardId: card.id, executionId: execution.id } }));
      kickoffExecutionProcessing(execution.id);

      onClose();
    } catch {
      setExecuteError("Could not start the agent execution.");
    } finally {
      setExecuting(false);
    }
  }

  async function handleRetryExecution(exec: ExecutionRecord) {
    if (!card?.id || retryingExecutionId) return;
    setRetryingExecutionId(exec.id);
    try {
      const res = await fetch("/api/agent-executions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          kanbanCardId: card.id,
          agentId: exec.agent.id,
          actionType: exec.actionType,
          notes: exec.notes ?? undefined,
        }),
      });
      if (res.ok) {
        const execution = await res.json() as { id: string };
        window.dispatchEvent(new CustomEvent("kanban-agent-execution-started", { detail: { cardId: card.id, executionId: execution.id } }));
        kickoffExecutionProcessing(execution.id);
        // Archive the old failed execution so it doesn't clutter the list
        await fetch(`/api/agent-executions/${exec.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ status: "archived" }),
        });
        setCardExecutions((prev) => prev.filter((e) => e.id !== exec.id));
        onClose();
      }
    } finally {
      setRetryingExecutionId(null);
    }
  }

  const loadLinkedCommits = useCallback(async (owner: string, repo: string, taskId: string) => {
    if (!currentUserId) {
      setLinkedCommits([]);
      setLoadingCommits(false);
      return;
    }

    setLoadingCommits(true);

    try {
      const response = await fetch(
        `/api/github/commits?owner=${encodeURIComponent(owner)}&repo=${encodeURIComponent(repo)}&per_page=60&taskId=${encodeURIComponent(taskId)}`
      );
      if (response.status === 401) {
        setLinkedCommits([]);
        return;
      }
      const data = await response.json();
      setLinkedCommits(response.ok ? (data.commits ?? []) : []);
    } catch {
      setLinkedCommits([]);
    } finally {
      setLoadingCommits(false);
    }
  }, [currentUserId]);

  useEffect(() => {
    if (isCreateMode || card?.isSprintOnly || !card?.id || !activeRepoFullName || !currentUserId) return;

    const [owner, repo] = activeRepoFullName.split("/");
    if (!owner || !repo) return;

    void loadLinkedCommits(owner, repo, card.id);
  }, [activeRepoFullName, card?.id, card?.isSprintOnly, currentUserId, isCreateMode, loadLinkedCommits]);

  function addLabel(rawLabel: string) {
    const nextLabel = rawLabel.trim();
    if (!nextLabel) return;
    setSelectedLabels((prev) =>
      prev.some((label) => label.toLowerCase() === nextLabel.toLowerCase()) ? prev : [...prev, nextLabel]
    );
    setLabelInput("");
  }

  function removeLabel(labelToRemove: string) {
    setSelectedLabels((prev) => prev.filter((label) => label !== labelToRemove));
  }

  function updateSubtask(id: string, patch: Partial<KanbanSubtask>) {
    setSubtasks((prev) => prev.map((subtask) => (subtask.id === id ? { ...subtask, ...patch } : subtask)));
  }

  function deleteSubtask(id: string) {
    setSubtasks((prev) => prev.filter((subtask) => subtask.id !== id));
  }

  function addSubtask() {
    setSubtasks((prev) => [...prev, createKanbanSubtask()]);
  }

  function cycleSubtaskState(id: string) {
    const order: KanbanSubtaskState[] = ["off", "active", "complete"];
    setSubtasks((prev) =>
      prev.map((subtask) => {
        if (subtask.id !== id) return subtask;
        const nextIndex = (order.indexOf(subtask.state) + 1) % order.length;
        return { ...subtask, state: order[nextIndex] };
      })
    );
  }

  async function handleCopyTaskId() {
    if (!card?.id) return;

    try {
      await navigator.clipboard.writeText(card.id);
      setTaskIdCopied(true);
      window.setTimeout(() => setTaskIdCopied(false), 1500);
    } catch {
      setError("Could not copy task ID");
    }
  }

  function handleRepoSelection(nextRepoId: string) {
    const nextRepo = repoOptions.find((repo) => repo.id === nextRepoId) ?? null;
    if (!nextRepo) return;

    setSelectedRepoId(nextRepoId);

    const currentColumnName =
      selectedColumn?.name ??
      card?.columnName ??
      availableColumns.find((column) => column.id === selectedColumnId)?.name ??
      "Backlog";

    setSelectedColumnId(
      nextRepo.columns.find((column) => column.name === currentColumnName)?.id ??
        nextRepo.columns.find((column) => column.name === "Backlog")?.id ??
        nextRepo.columns[0]?.id ??
        null
    );
  }

  async function handleAddNote() {
    if (!card || card.isSprintOnly || (!noteBody.trim() && !noteImage)) return;

    setSendingNote(true);
    setError(null);

    const res = await fetch(`/api/kanban/${card.id}/notes`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ body: noteBody.trim(), image: noteImage }),
    });

    if (!res.ok) {
      const payload = await res.json().catch(() => null);
      setSendingNote(false);
      setError(payload?.error ?? "Failed to add note");
      return;
    }

    const data = await res.json();
    const nextNotes = [...notes, data.note];
    setNotes(nextNotes);
    setNoteBody("");
    setNoteImage(null);
    setSendingNote(false);
    onSaved(card.id, { notes: nextNotes });
  }

  async function handleNoteImageFile(file: File | null) {
    if (!file) return;

    try {
      setError(null);
      const optimized = await optimizeNoteImage(file);
      setNoteImage(optimized);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to attach image");
    }
  }

  async function handleDeleteNote(noteId: string) {
    if (!card || deletingNoteId === noteId) return;

    setDeletingNoteId(noteId);
    setError(null);

    const res = await fetch(`/api/kanban/${card.id}/notes?noteId=${noteId}`, {
      method: "DELETE",
    });

    if (!res.ok) {
      const payload = await res.json().catch(() => null);
      setDeletingNoteId(null);
      setError(payload?.error ?? "Failed to delete note");
      return;
    }

    const nextNotes = notes.filter((note) => note.id !== noteId);
    setNotes(nextNotes);
    setDeletingNoteId(null);
    onSaved(card.id, { notes: nextNotes });
  }

  async function handleSave(closeAfter = true) {
    if (isCreateMode) {
      if (!title.trim()) {
        setError("Title is required");
        return;
      }
      if (!selectedRepo || !selectedColumn) {
        setError("Choose a repo and column");
        return;
      }

      setSaving(true);
      setError(null);

      let githubIssueId: number | undefined;
      let githubIssueUrl: string | undefined;

      if (createGithubIssue && selectedRepo.fullName) {
        const [owner, repo] = selectedRepo.fullName.split("/");
        if (owner && repo) {
          const ghRes = await fetch("/api/github/issues", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ owner, repo, title: title.trim(), body }),
          });
          if (ghRes.ok) {
            const ghData = await ghRes.json();
            githubIssueId = ghData.issue?.number;
            githubIssueUrl = ghData.issue?.html_url;
          }
        }
      }

      const res = await fetch("/api/kanban", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          columnId: selectedColumn.id,
          title: title.trim(),
          body,
          subtasks,
          priority,
          state: taskState,
          labels: selectedLabels,
          assignees: JSON.stringify(selectedAssigneeIds),
          customerIds: selectedCustomerIds,
          linkedRepoIds: selectedLinkedRepoIds,
          githubIssueId,
          githubIssueUrl,
        }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => null) as { error?: string } | null;
        setSaving(false);
        setError(data?.error ?? "Failed to create task");
        return;
      }

      const data = await res.json();
      onCreated?.({
        ...data.card,
        notes: [],
        agentExecutions: [],
        sprintTask: null,
        subtasks: serializeKanbanSubtasks(subtasks),
        wells: data.card.wells ?? linkedCustomers,
        customers: data.card.customers ?? linkedCustomers,
        repoId: selectedRepo.id,
        repoName: selectedRepo.name,
        repoFullName: selectedRepo.fullName ?? selectedRepo.name,
        columnId: selectedColumn.id,
        columnName: selectedColumn.name,
        columnPosition: selectedColumn.position,
        position: data.card.position ?? 0,
        isSprintOnly: false,
        linkedRepoIds: selectedLinkedRepoIds,
      });

      setSaving(false);
      onClose();
      return;
    }

    if (!card || card.isSprintOnly) return;
    if (!title.trim()) {
      setError("Title is required");
      return;
    }

    setSaving(true);
    setError(null);

    const res = await fetch("/api/kanban", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        cardId: card.id,
        columnId: selectedColumn?.id,
        title: title.trim(),
        body,
        subtasks,
        priority,
        state: taskState,
        labels: selectedLabels,
        assignees: JSON.stringify(selectedAssigneeIds),
        customerIds: selectedCustomerIds,
        linkedRepoIds: selectedLinkedRepoIds,
      }),
    });

    if (!res.ok) {
      const data = await res.json().catch(() => null) as { error?: string } | null;
      setSaving(false);
      setError(data?.error ?? "Failed to save card");
      return;
    }

    onSaved(card.id, {
      title: title.trim(),
      body,
      subtasks: serializeKanbanSubtasks(subtasks),
      priority,
      state: taskState,
      labels: JSON.stringify(selectedLabels),
      assignees: JSON.stringify(selectedAssigneeIds),
      wells: linkedCustomers,
      customers: linkedCustomers,
      repoId: selectedRepo?.id,
      repoName: selectedRepo?.name,
      repoFullName: selectedRepo?.fullName ?? selectedRepo?.name,
      repoIndex: selectedRepo?.index,
      columnId: selectedColumn?.id,
      columnName: selectedColumn?.name,
      columnPosition: selectedColumn?.position,
      linkedRepoIds: selectedLinkedRepoIds,
    });

    setSaving(false);
    if (closeAfter) onClose();
  }

  async function handleAddToSprint(sprintId: string) {
    if (!card || card.isSprintOnly) return;
    const res = await fetch(`/api/sprints/${sprintId}/tasks`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ kanbanCardId: card.id }),
    });

    if (!res.ok) {
      const err = await res.json();
      setError(err.error ?? "Failed to add to sprint");
      return;
    }

    const task = await res.json();
    const sprint = sprints.find((entry) => entry.id === sprintId);
    if (!sprint) return;
    onSprintChange(card.id, {
      id: task.id,
      sprintId: task.sprintId,
      sprint: { id: sprint.id, name: sprint.name, status: sprint.status },
    });
  }

  async function handleRemoveFromSprint() {
    if (!card?.sprintTask) return;
    await fetch(`/api/sprints/${card.sprintTask.sprintId}/tasks/${card.sprintTask.id}`, { method: "DELETE" });
    onSprintChange(card.id, null);
  }

  async function handleSetTaskGroup(taskGroupId: string | null) {
    if (!card || card.isSprintOnly) return;
    setSettingGroup(true);
    const res = await fetch("/api/kanban", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ cardId: card.id, taskGroupId }),
    });
    if (res.ok) {
      setCurrentTaskGroupId(taskGroupId);
      onTaskGroupChange?.(card.id, taskGroupId);
    }
    setSettingGroup(false);
    setGroupMenuOpen(false);
  }

  const previewOverlay =
    previewImage && typeof document !== "undefined"
      ? createPortal(
          <AnimatePresence>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-[60] bg-black/82 backdrop-blur-sm"
              onClick={() => setPreviewImage(null)}
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.96, y: 16 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.96, y: 16 }}
              className="fixed inset-0 z-[61] flex items-center justify-center p-6"
              onClick={() => setPreviewImage(null)}
            >
              <div className="relative flex max-h-full max-w-5xl items-center justify-center">
                <button
                  type="button"
                  onClick={() => setPreviewImage(null)}
                  className="absolute right-3 top-3 z-10 flex h-9 w-9 items-center justify-center rounded-full bg-[rgba(0,0,0,0.55)] text-white transition-colors hover:bg-[rgba(0,0,0,0.72)]"
                >
                  <X size={16} />
                </button>
                <img
                  src={previewImage}
                  alt="Note attachment preview"
                  className="max-h-[88vh] max-w-[88vw] rounded-2xl border border-[rgba(255,255,255,0.1)] object-contain shadow-[0_30px_80px_rgba(0,0,0,0.45)]"
                />
              </div>
            </motion.div>
          </AnimatePresence>,
          document.body
        )
      : null;

  const confirmDeleteOverlay =
    confirmDeleteNoteId && typeof document !== "undefined"
      ? createPortal(
          <AnimatePresence>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-[62] bg-black/68 backdrop-blur-sm"
              onClick={() => setConfirmDeleteNoteId(null)}
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.96, y: 12 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.96, y: 12 }}
              className="fixed inset-0 z-[63] flex items-center justify-center p-6"
            >
              <div className="w-full max-w-sm rounded-3xl border border-[rgba(255,255,255,0.08)] bg-[#121212] p-5 shadow-[0_24px_80px_rgba(0,0,0,0.45)]">
                <div className="flex items-start gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-2xl border border-[rgba(239,68,68,0.22)] bg-[rgba(239,68,68,0.12)] text-[#F87171]">
                    <Trash2 size={16} />
                  </div>
                  <div>
                    <div className="text-sm font-semibold text-[#F3F3F3]">Delete note?</div>
                    <div className="mt-1 text-sm leading-relaxed text-[#9A9A9A]">
                      This will permanently remove your message from the task conversation.
                    </div>
                  </div>
                </div>
                <div className="mt-5 flex items-center justify-end gap-3">
                  <Button variant="secondary" size="sm" onClick={() => setConfirmDeleteNoteId(null)}>
                    Cancel
                  </Button>
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={() => {
                      const noteId = confirmDeleteNoteId;
                      setConfirmDeleteNoteId(null);
                      if (noteId) void handleDeleteNote(noteId);
                    }}
                    className="text-[#EF4444] hover:text-[#F87171]"
                  >
                    Delete
                  </Button>
                </div>
              </div>
            </motion.div>
          </AnimatePresence>,
          document.body
        )
      : null;

  return (
    <AnimatePresence>
      {open && (card || isCreateMode) && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 z-40 bg-black/55 backdrop-blur-sm"
          />

          {previewOverlay}
          {confirmDeleteOverlay}

          <motion.div
            initial={{ opacity: 0, y: 16, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 12, scale: 0.98 }}
            transition={{ type: "spring", stiffness: 280, damping: 30 }}
            className="fixed inset-0 z-50 flex items-stretch justify-center p-0 md:p-6"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="relative flex h-full w-full flex-col overflow-hidden border border-[rgba(255,255,255,0.08)] bg-[#0E0E0E] shadow-[0_28px_90px_rgba(0,0,0,0.5)] md:h-[92vh] md:max-w-[min(1480px,calc(100vw-3rem))] md:rounded-[30px]">
              <div className="pointer-events-none absolute inset-0">
                <div className="absolute inset-x-0 top-0 h-28 bg-[radial-gradient(circle_at_top,rgba(247,148,29,0.16),transparent_62%)]" />
                <div className="absolute -left-16 top-24 h-56 w-56 rounded-full bg-[rgba(75,156,211,0.08)] blur-3xl" />
                <div className="absolute -right-20 bottom-10 h-64 w-64 rounded-full bg-[rgba(247,148,29,0.08)] blur-3xl" />
              </div>

            <div className="relative border-b border-[rgba(255,255,255,0.06)] px-4 py-4 md:px-7">
              <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
                <div className="flex items-start justify-between gap-3 md:min-w-0 md:flex-1">
                  <div className="min-w-0 flex-1">
                    <div className="flex min-w-0 items-start gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-2xl border border-[rgba(247,148,29,0.2)] bg-[rgba(247,148,29,0.12)] text-[#F7941D]">
                      <Settings2 size={18} />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="max-w-4xl">
                        <div className="text-balance text-[1.15rem] font-semibold leading-tight text-[#F7F7F7] md:truncate md:text-[clamp(1.1rem,2vw,1.65rem)]">
                          {title.trim() || (isCreateMode ? "Untitled task" : card?.title ?? "Untitled task")}
                        </div>
                      </div>
                      <div className="mt-2 flex flex-wrap items-center gap-2">
                        <h2 className="text-sm font-bold uppercase tracking-[0.16em] text-[#B9B9B9]">{isCreateMode ? "Add Task" : "Edit Task"}</h2>
                        {!isCreateMode && card ? (
                          <button
                            type="button"
                            onClick={() => void handleCopyTaskId()}
                            className={`inline-flex items-center gap-1.5 rounded-lg border px-2 py-1 text-[11px] font-medium transition-all ${
                              taskIdCopied
                                ? "border-[rgba(247,148,29,0.28)] bg-[rgba(247,148,29,0.12)] text-[#F6B04D]"
                                : "border-[rgba(255,255,255,0.08)] bg-[rgba(255,255,255,0.03)] text-[#A8A8A8] hover:border-[rgba(247,148,29,0.18)] hover:text-[#F0F0F0]"
                            }`}
                          >
                            <Copy size={11} />
                            {taskIdCopied ? "Copied" : "Copy ID"}
                          </button>
                        ) : null}
                      </div>
                    </div>
                  </div>
                  </div>
                  {(!card?.isSprintOnly || isCreateMode) && (
                    <button
                      onClick={onClose}
                      className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl text-[#606060] transition-colors hover:bg-[rgba(255,255,255,0.06)] hover:text-[#F0F0F0] md:hidden"
                    >
                      <X size={18} />
                    </button>
                  )}
                </div>

                <div className="flex items-start gap-3 md:flex-shrink-0">
                  {(!card?.isSprintOnly || isCreateMode) && (
                    <div className="min-w-0 flex-1 md:flex-none">
                      <div className="flex flex-col gap-2 md:max-w-[56vw] md:items-end">
                        <div className="overflow-x-auto pb-1 md:overflow-visible md:pb-0">
                          <div className="flex flex-wrap items-center gap-1.5 md:justify-end md:pl-1">
                        {users.map((user) => (
                          <AssigneeToggle
                            key={user.id}
                            user={user}
                            selected={selectedAssigneeIds.includes(user.id)}
                            compact
                            onClick={() =>
                              setSelectedAssigneeIds((prev) =>
                                prev.includes(user.id)
                                  ? prev.filter((id) => id !== user.id)
                                  : [...prev, user.id]
                              )
                            }
                          />
                        ))}
                          </div>
                        </div>
                        <div className="overflow-x-auto pb-1 md:overflow-visible md:pb-0">
                          <div className="flex flex-wrap items-center gap-2 md:justify-end">
                            {/* ── Repo selector popover ──────────────────── */}
                            {(() => {
                              const isGeneral = selectedRepo?.id === "general";
                              const allRepos = repoOptions.filter((r) => r.id !== "general");
                              // a repo is "selected" if it's primary OR linked
                              const selectedRepoIds = new Set([
                                ...(isGeneral ? [] : selectedRepo ? [selectedRepo.id] : []),
                                ...selectedLinkedRepoIds,
                              ]);
                              const totalSelected = selectedRepoIds.size;

                              function handleRepoToggle(repoId: string) {
                                if (selectedRepoIds.has(repoId)) {
                                  // deselecting — if it's the primary, promote first linked or fall back to General
                                  if (selectedRepo?.id === repoId) {
                                    const remaining = selectedLinkedRepoIds.filter((id) => id !== repoId);
                                    if (remaining.length > 0) {
                                      handleRepoSelection(remaining[0]);
                                      setSelectedLinkedRepoIds(remaining.slice(1));
                                    } else {
                                      handleRepoSelection("general");
                                      setSelectedLinkedRepoIds([]);
                                    }
                                  } else {
                                    setSelectedLinkedRepoIds((prev) => prev.filter((id) => id !== repoId));
                                  }
                                } else {
                                  // selecting — if currently General or no primary, make it primary; else add to linked
                                  if (isGeneral || !selectedRepo) {
                                    handleRepoSelection(repoId);
                                    setSelectedLinkedRepoIds([]);
                                  } else {
                                    setSelectedLinkedRepoIds((prev) => [...prev, repoId]);
                                  }
                                }
                              }

                              return (
                                <div ref={repoMenuRef} className="relative">
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setRepoMenuOpen((prev) => !prev);
                                      setCustomerMenuOpen(false);
                                      setPriorityMenuOpen(false);
                                      setSprintMenuOpen(false);
                                    }}
                                    className="inline-flex h-10 items-center gap-2 rounded-full bg-[rgba(255,255,255,0.05)] px-3 py-1.5 text-xs text-[#D8D8D8] transition-colors hover:bg-[rgba(255,255,255,0.08)]"
                                  >
                                    {isGeneral ? <Globe2 size={12} className="text-[#9CA3AF]" /> : <FolderGit2 size={12} />}
                                    <span className="max-w-[110px] truncate">{selectedRepo?.name ?? card?.repoName ?? "Repo"}</span>
                                    {totalSelected > 1 && (
                                      <span className="flex h-4 min-w-[16px] items-center justify-center rounded-full bg-[rgba(99,102,241,0.3)] px-1 text-[10px] font-bold text-[#A5B4FC]">
                                        +{totalSelected - 1}
                                      </span>
                                    )}
                                    <ChevronDown size={12} />
                                  </button>

                                  <AnimatePresence>
                                    {repoMenuOpen && (
                                      <motion.div
                                        initial={{ opacity: 0, y: 8, scale: 0.98 }}
                                        animate={{ opacity: 1, y: 0, scale: 1 }}
                                        exit={{ opacity: 0, y: 8, scale: 0.98 }}
                                        className="absolute left-0 top-full z-20 mt-2 w-64 max-w-[calc(100vw-2rem)] overflow-hidden rounded-2xl border border-[rgba(255,255,255,0.08)] bg-[#151515] p-1.5 shadow-2xl md:left-auto md:right-0"
                                      >
                                        <button
                                          type="button"
                                          onClick={() => {
                                            handleRepoSelection("general");
                                            setSelectedLinkedRepoIds([]);
                                          }}
                                          className="flex w-full items-center gap-2.5 rounded-xl px-3 py-2 text-left text-sm transition-colors hover:bg-[rgba(255,255,255,0.04)]"
                                          style={{ color: isGeneral ? "#F7941D" : "#9CA3AF" }}
                                        >
                                          <Globe2 size={13} className="flex-shrink-0" />
                                          <span className="flex-1 truncate">General</span>
                                          {isGeneral && <Check size={13} />}
                                        </button>

                                        {allRepos.length > 0 && (
                                          <>
                                            <div className="my-1.5 border-t border-[rgba(255,255,255,0.06)]" />
                                            <div className="px-3 pb-1 pt-0.5">
                                              <span className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[#555555]">
                                                Repos
                                              </span>
                                            </div>
                                            {allRepos.map((repo) => {
                                              const selected = selectedRepoIds.has(repo.id);
                                              return (
                                                <button
                                                  key={repo.id}
                                                  type="button"
                                                  onClick={() => handleRepoToggle(repo.id)}
                                                  className="flex w-full items-center gap-2.5 rounded-xl px-3 py-2 text-left text-sm transition-colors hover:bg-[rgba(255,255,255,0.04)]"
                                                  style={{ color: selected ? "#F7941D" : "#D0D0D0" }}
                                                >
                                                  <GitBranch size={13} className="flex-shrink-0 opacity-50" />
                                                  <span className="flex-1 truncate">{repo.name}</span>
                                                  <span
                                                    className="flex h-4 w-4 flex-shrink-0 items-center justify-center rounded-md border"
                                                    style={{
                                                      borderColor: selected ? "rgba(247,148,29,0.5)" : "rgba(255,255,255,0.12)",
                                                      backgroundColor: selected ? "rgba(247,148,29,0.15)" : "transparent",
                                                      color: selected ? "#F7941D" : "transparent",
                                                    }}
                                                  >
                                                    <Check size={10} />
                                                  </span>
                                                </button>
                                              );
                                            })}
                                          </>
                                        )}
                                      </motion.div>
                                    )}
                                  </AnimatePresence>
                                </div>
                              );
                            })()}

                            <div ref={customerMenuRef} className="relative">
                              <button
                                type="button"
                                onClick={() => {
                                  setCustomerMenuOpen((prev) => !prev);
                                  setRepoMenuOpen(false);
                                  setPriorityMenuOpen(false);
                                  setSprintMenuOpen(false);
                                }}
                                className="inline-flex h-10 items-center gap-2 rounded-full bg-[rgba(14,165,233,0.08)] px-3 py-1.5 text-xs text-[#7DD3FC] transition-colors hover:bg-[rgba(14,165,233,0.14)]"
                              >
                                {selectedCustomerIds.length > 0 ? (
                                  <>
                                    {(() => {
                                      const firstWell = wells.find((w) => w.id === selectedCustomerIds[0]);
                                      return firstWell ? (
                                        <>
                                          <Avatar name={firstWell.name} size="xs" className="!h-4 !w-4 text-[7px]" />
                                          <span className="max-w-[96px] truncate">{firstWell.name}</span>
                                          {selectedCustomerIds.length > 1 ? (
                                            <span className="text-[#9BDCFD]">+{selectedCustomerIds.length - 1}</span>
                                          ) : null}
                                        </>
                                      ) : (
                                        <span>Oil Wells</span>
                                      );
                                    })()}
                                  </>
                                ) : (
                                  <span>No Wells</span>
                                )}
                                <ChevronDown size={12} />
                              </button>

                              <AnimatePresence>
                                {customerMenuOpen && (
                                  <motion.div
                                    initial={{ opacity: 0, y: 8, scale: 0.98 }}
                                    animate={{ opacity: 1, y: 0, scale: 1 }}
                                    exit={{ opacity: 0, y: 8, scale: 0.98 }}
                                    className="absolute left-0 top-full z-20 mt-2 w-72 max-w-[calc(100vw-2rem)] overflow-hidden rounded-2xl border border-[rgba(255,255,255,0.08)] bg-[#151515] p-2 shadow-2xl md:left-auto md:right-0"
                                  >
                                    <div className="mb-2 px-2 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-[#6A6A6A]">
                                      Oil Wells
                                    </div>
                                    <div className="flex max-h-56 flex-wrap gap-2 overflow-y-auto p-1">
                                      {wells.map((customer) => {
                                        const selected = selectedCustomerIds.includes(customer.id);
                                        return (
                                          <CustomerToggle
                                            key={customer.id}
                                            customer={customer}
                                            selected={selected}
                                            onClick={() =>
                                              setSelectedCustomerIds((prev) =>
                                                prev.includes(customer.id)
                                                  ? prev.filter((id) => id !== customer.id)
                                                  : [...prev, customer.id]
                                              )
                                            }
                                          />
                                        );
                                      })}
                                    </div>
                                  </motion.div>
                                )}
                              </AnimatePresence>
                            </div>

                            <div ref={priorityMenuRef} className="relative">
                              <button
                                type="button"
                                onClick={() => {
                                  setRepoMenuOpen(false);
                                  setPriorityMenuOpen((prev) => !prev);
                                  setSprintMenuOpen(false);
                                  setCustomerMenuOpen(false);
                                }}
                                className="inline-flex h-10 items-center gap-2 rounded-full px-3 py-1.5 text-xs transition-colors"
                                style={{
                                  color: PRIORITY_COLORS[(priority as keyof typeof PRIORITY_COLORS)] ?? PRIORITY_COLORS.medium,
                                  backgroundColor: `${PRIORITY_COLORS[(priority as keyof typeof PRIORITY_COLORS)] ?? PRIORITY_COLORS.medium}1F`,
                                }}
                              >
                                <span>{PRIORITY_LABELS[(priority as keyof typeof PRIORITY_LABELS)] ?? PRIORITY_LABELS.medium}</span>
                                <ChevronDown size={12} className="text-current" />
                              </button>

                              <AnimatePresence>
                                {priorityMenuOpen && (
                                  <motion.div
                                    initial={{ opacity: 0, y: 8, scale: 0.98 }}
                                    animate={{ opacity: 1, y: 0, scale: 1 }}
                                    exit={{ opacity: 0, y: 8, scale: 0.98 }}
                                    className="absolute left-0 top-full z-20 mt-2 w-40 max-w-[calc(100vw-2rem)] overflow-hidden rounded-2xl border border-[rgba(255,255,255,0.08)] bg-[#151515] p-1.5 shadow-2xl md:left-auto md:right-0"
                                  >
                                    {PRIORITIES.map((option) => (
                                      <button
                                        key={option}
                                        type="button"
                                        onClick={() => {
                                          setPriority(option);
                                          setPriorityMenuOpen(false);
                                        }}
                                        className="flex w-full items-center justify-between rounded-xl px-3 py-2 text-left text-sm capitalize transition-colors hover:bg-[rgba(255,255,255,0.04)]"
                                        style={{ color: priority === option ? PRIORITY_COLORS[option] : "#C5C5C5" }}
                                      >
                                        <span>{option}</span>
                                        {priority === option ? <Check size={13} /> : null}
                                      </button>
                                    ))}
                                  </motion.div>
                                )}
                              </AnimatePresence>
                            </div>

                            {!isCreateMode && sprintFeatureEnabled && (
                              <div ref={sprintMenuRef} className="relative">
                                <button
                                  type="button"
                                  onClick={() => {
                                    setSprintMenuOpen((prev) => !prev);
                                    setPriorityMenuOpen(false);
                                    setCustomerMenuOpen(false);
                                  }}
                                  className="inline-flex h-10 items-center gap-1 rounded-full bg-[rgba(247,148,29,0.08)] px-3 py-1.5 text-xs text-[#F7941D] transition-colors hover:bg-[rgba(247,148,29,0.14)]"
                                >
                                  <Zap size={11} />
                                  {card?.sprintTask ? card.sprintTask.sprint.name : "No Sprint"}
                                  <ChevronDown size={12} />
                                </button>

                                <AnimatePresence>
                                  {sprintMenuOpen && (
                                    <motion.div
                                      initial={{ opacity: 0, y: 8, scale: 0.98 }}
                                      animate={{ opacity: 1, y: 0, scale: 1 }}
                                      exit={{ opacity: 0, y: 8, scale: 0.98 }}
                                      className="absolute left-0 top-full z-20 mt-2 w-56 max-w-[calc(100vw-2rem)] overflow-hidden rounded-2xl border border-[rgba(255,255,255,0.08)] bg-[#151515] p-1.5 shadow-2xl md:left-auto md:right-0"
                                    >
                                      {card?.sprintTask ? (
                                        <button
                                          type="button"
                                          onClick={() => {
                                            void handleRemoveFromSprint();
                                            setSprintMenuOpen(false);
                                          }}
                                          className="flex w-full items-center justify-between rounded-xl px-3 py-2 text-left text-sm text-[#F3C38C] transition-colors hover:bg-[rgba(255,255,255,0.04)]"
                                        >
                                          <span>Remove from sprint</span>
                                          <X size={13} />
                                        </button>
                                      ) : activeSprints.length === 0 ? (
                                        <div className="px-3 py-2 text-sm text-[#707070]">No active or planning sprints</div>
                                      ) : (
                                        activeSprints.map((sprint) => (
                                          <button
                                            key={sprint.id}
                                            type="button"
                                            onClick={() => {
                                              void handleAddToSprint(sprint.id);
                                              setSprintMenuOpen(false);
                                            }}
                                            className="flex w-full items-center justify-between rounded-xl px-3 py-2 text-left text-sm text-[#D0D0D0] transition-colors hover:bg-[rgba(255,255,255,0.04)] hover:text-[#F7941D]"
                                          >
                                            <span className="truncate">{sprint.name}</span>
                                            <Zap size={13} />
                                          </button>
                                        ))
                                      )}
                                    </motion.div>
                                  )}
                                </AnimatePresence>
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  )}

                  <button
                    onClick={onClose}
                    className="hidden h-9 w-9 items-center justify-center rounded-xl text-[#606060] transition-colors hover:bg-[rgba(255,255,255,0.06)] hover:text-[#F0F0F0] md:flex"
                  >
                    <X size={16} />
                  </button>
                </div>
                    </div>
            </div>

            {/* ── Group task picker bar ────────────────────────────── */}
            {groupTasks && groupTasks.length > 0 && onSwitchGroupTask && (
              <div className="border-b border-[rgba(255,255,255,0.06)] px-4 py-2.5 flex-shrink-0">
                <div className="flex items-center gap-2">
                  {groupName && (
                    <>
                      <Layers size={11} className="flex-shrink-0 text-[#555555]" />
                      <span className="text-[11px] text-[#555555] flex-shrink-0 max-w-[140px] truncate">{groupName}</span>
                      <span className="text-[#383838] flex-shrink-0 select-none">·</span>
                    </>
                  )}
                  <div className="flex items-center gap-1.5 overflow-x-auto">
                    {groupTasks.map((task) => {
                      const isSelected = task.id === card?.id;
                      const accent = COLUMN_ACCENT_MAP[task.columnName ?? ""] ?? "#666666";
                      return (
                        <button
                          key={task.id}
                          type="button"
                          onClick={() => onSwitchGroupTask(task.id)}
                          className={`flex flex-shrink-0 items-center gap-1.5 rounded-lg border px-2.5 py-1 text-[11px] font-medium transition-all ${
                            isSelected
                              ? "border-[rgba(247,148,29,0.3)] bg-[rgba(247,148,29,0.1)] text-[#F6B04D]"
                              : "border-[rgba(255,255,255,0.07)] bg-[rgba(255,255,255,0.02)] text-[#888888] hover:border-[rgba(255,255,255,0.12)] hover:text-[#D0D0D0]"
                          }`}
                        >
                          <span
                            className="h-1.5 w-1.5 flex-shrink-0 rounded-full"
                            style={{ backgroundColor: accent }}
                          />
                          <span className="max-w-[110px] truncate">{task.title}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>
            )}

            <div className="border-b border-[rgba(255,255,255,0.06)] px-3 py-3 md:hidden">
              <div className="overflow-x-auto pb-1">
                <div className="flex min-w-max items-center gap-1 rounded-2xl border border-[rgba(255,255,255,0.08)] bg-[linear-gradient(180deg,rgba(28,28,28,0.98),rgba(18,18,18,0.98))] p-1 pr-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.04),0_10px_30px_rgba(0,0,0,0.18)]">
                <button
                  type="button"
                  onClick={() => setActiveTab("overview")}
                  className={`inline-flex min-w-[110px] items-center justify-center rounded-xl px-3 py-2 text-sm font-semibold transition-all ${
                    activeTab === "overview"
                      ? "bg-[linear-gradient(180deg,rgba(247,148,29,0.24),rgba(247,148,29,0.14))] text-[#FFD08A] shadow-[inset_0_1px_0_rgba(255,255,255,0.08),0_8px_20px_rgba(247,148,29,0.16)]"
                      : "text-[#8A8A8A] hover:bg-[rgba(255,255,255,0.04)] hover:text-[#F0F0F0]"
                  }`}
                >
                  Overview
                </button>
                <button
                  type="button"
                  onClick={() => setActiveTab("notes")}
                  className={`inline-flex min-w-[110px] items-center justify-center gap-2 rounded-xl px-3 py-2 text-sm font-semibold transition-all ${
                    activeTab === "notes"
                      ? "bg-[linear-gradient(180deg,rgba(247,148,29,0.24),rgba(247,148,29,0.14))] text-[#FFD08A] shadow-[inset_0_1px_0_rgba(255,255,255,0.08),0_8px_20px_rgba(247,148,29,0.16)]"
                      : "text-[#8A8A8A] hover:bg-[rgba(255,255,255,0.04)] hover:text-[#F0F0F0]"
                  }`}
                >
                  <span>Notes</span>
                  <span
                    className={`rounded-full px-2 py-0.5 text-[11px] ${
                      activeTab === "notes"
                        ? "bg-[rgba(0,0,0,0.16)] text-[#FFE3B4]"
                        : "bg-[rgba(255,255,255,0.06)] text-[#707070]"
                    }`}
                  >
                    {notes.length}
                  </span>
                </button>
                <button
                  type="button"
                  onClick={() => setActiveTab("commits")}
                  className={`inline-flex min-w-[142px] items-center justify-center gap-2 rounded-xl px-3 py-2 text-sm font-semibold transition-all ${
                    activeTab === "commits"
                      ? "bg-[linear-gradient(180deg,rgba(251,186,0,0.24),rgba(247,148,29,0.14))] text-[#FFE09B] shadow-[inset_0_1px_0_rgba(255,255,255,0.08),0_8px_20px_rgba(247,148,29,0.16)]"
                      : "text-[#8A8A8A] hover:bg-[rgba(255,255,255,0.04)] hover:text-[#F0F0F0]"
                  }`}
                >
                  <GitCommit size={14} className="shrink-0" />
                  <span className="whitespace-nowrap">Code Commits</span>
                  {!loadingCommits && linkedCommits.length > 0 && (
                    <span
                      className={`rounded-full px-2 py-0.5 text-[11px] ${
                        activeTab === "commits"
                          ? "bg-[rgba(0,0,0,0.16)] text-[#FFE3B4]"
                          : "bg-[rgba(255,255,255,0.06)] text-[#707070]"
                      }`}
                    >
                      {linkedCommits.length}
                    </span>
                  )}
                </button>
                <button
                  type="button"
                  onClick={() => setActiveTab("agents")}
                  className={`inline-flex min-w-[110px] items-center justify-center gap-2 rounded-xl px-3 py-2 text-sm font-semibold transition-all ${
                    activeTab === "agents"
                      ? "text-[#DDF1FF] shadow-[inset_0_1px_0_rgba(255,255,255,0.08),0_8px_20px_rgba(75,156,211,0.18)]"
                      : "text-[#8A8A8A] hover:bg-[rgba(255,255,255,0.04)] hover:text-[#F0F0F0]"
                  }`}
                  style={
                    activeTab === "agents"
                      ? { background: "linear-gradient(180deg,rgba(75,156,211,0.26),rgba(75,156,211,0.14))" }
                      : undefined
                  }
                >
                  <Bot size={14} />
                  <span>Agents</span>
                </button>
              </div>
              </div>
            </div>

            <div className="flex min-h-0 flex-1 flex-col overflow-hidden md:flex-row">
              <aside className="hidden w-[280px] flex-shrink-0 border-r border-[rgba(255,255,255,0.06)] bg-[linear-gradient(180deg,rgba(19,19,20,0.98),rgba(11,11,12,0.98))] md:flex md:flex-col">
               
                <div className="flex-1 px-4 py-4">
                  <div className="space-y-2">
                    {(["overview", "notes", "commits", "agents"] as const).map((tabKey) => {
                      const meta = TAB_META[tabKey];
                      const Icon = meta.icon;
                      const count =
                        tabKey === "notes"
                          ? notes.length
                          : tabKey === "commits" && !loadingCommits
                            ? linkedCommits.length
                            : null;
                      const isActive = activeTab === tabKey;

                      return (
                        <button
                          key={tabKey}
                          type="button"
                          onClick={() => setActiveTab(tabKey)}
                          className="flex w-full items-start gap-3 rounded-2xl border px-4 py-3 text-left transition-all"
                          style={{
                            borderColor: isActive ? `${meta.tint}40` : "rgba(255,255,255,0.08)",
                            background: isActive ? `linear-gradient(180deg, ${meta.bg}, rgba(255,255,255,0.03))` : "rgba(255,255,255,0.02)",
                            boxShadow: isActive ? `inset 0 0 0 1px ${meta.tint}22` : "none",
                          }}
                        >
                          <div
                            className="mt-0.5 flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-2xl border"
                            style={{
                              borderColor: isActive ? `${meta.tint}35` : "rgba(255,255,255,0.08)",
                              backgroundColor: isActive ? meta.bg : "rgba(255,255,255,0.04)",
                              color: isActive ? meta.tint : "#737373",
                            }}
                          >
                            <Icon size={16} />
                          </div>
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-2">
                              <span className="text-sm font-semibold" style={{ color: isActive ? "#F4F4F4" : "#C8C8C8" }}>
                                {meta.label}
                              </span>
                              {count !== null && count > 0 ? (
                                <span
                                  className="rounded-full px-2 py-0.5 text-[11px] font-semibold"
                                  style={{
                                    backgroundColor: isActive ? "rgba(0,0,0,0.2)" : "rgba(255,255,255,0.06)",
                                    color: isActive ? meta.tint : "#707070",
                                  }}
                                >
                                  {count}
                                </span>
                              ) : null}
                            </div>
                            <div className="mt-1 text-xs leading-5 text-[#717171]">
                              {tabKey === "overview" && "Primary task details, structure, and metadata."}
                              {tabKey === "notes" && "Conversation, screenshots, and status updates."}
                              {tabKey === "commits" && "Linked code changes for this task."}
                              {tabKey === "agents" && "Run agents and inspect previous executions."}
                            </div>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>

                <div className="border-t border-[rgba(255,255,255,0.06)] px-5 py-4">
                  <div className="grid grid-cols-2 gap-2">
                    <div className="rounded-2xl border border-[rgba(255,255,255,0.06)] bg-[rgba(255,255,255,0.03)] px-3 py-2.5">
                      <div className="text-[10px] uppercase tracking-[0.18em] text-[#666666]">Priority</div>
                      <div className="mt-1 text-sm font-semibold" style={{ color: PRIORITY_COLORS[(priority as keyof typeof PRIORITY_COLORS)] ?? PRIORITY_COLORS.medium }}>
                        {PRIORITY_LABELS[(priority as keyof typeof PRIORITY_LABELS)] ?? PRIORITY_LABELS.medium}
                      </div>
                    </div>
                    <div className="rounded-2xl border border-[rgba(255,255,255,0.06)] bg-[rgba(255,255,255,0.03)] px-3 py-2.5">
                      <div className="text-[10px] uppercase tracking-[0.18em] text-[#666666]">Assignees</div>
                      <div className="mt-1 text-sm font-semibold text-[#F4F4F4]">
                        {selectedAssigneeIds.length || "None"}
                      </div>
                    </div>
                  </div>
                </div>
              </aside>

            <div className={`min-h-0 flex-1 overflow-y-auto px-3 py-3 md:overflow-hidden md:px-4 md:py-4`}>
              {activeTab === "overview" ? (
                <div className="md:h-full">
                  <div className="rounded-[24px] border border-[rgba(255,255,255,0.06)] bg-[linear-gradient(180deg,rgba(23,23,23,0.98),rgba(12,12,12,0.98))] p-3 md:h-full md:p-4">
                    
                    <div className="grid gap-3 md:h-full md:min-h-0 xl:grid-cols-[minmax(0,1.3fr)_minmax(340px,0.9fr)]">
                      <div className="flex flex-col gap-3 md:min-h-0">
                      <Input
                        value={title}
                        onChange={(event) => setTitle(event.target.value)}
                        className="py-2 font-semibold text-[#F3F3F3]"
                      />
                      <Textarea
                        label="CONTENT"
                        value={body}
                        onChange={(event) => setBody(event.target.value)}
                        rows={6}
                        className="min-h-[220px] md:min-h-[240px] md:flex-1 xl:min-h-0"
                      />
                      <div className="flex flex-col rounded-2xl border border-[rgba(255,255,255,0.08)] bg-[linear-gradient(180deg,rgba(24,24,24,0.98),rgba(14,14,14,0.98))] p-2.5 md:min-h-0 md:flex-1 md:p-3">
                        <div className="mb-3 flex items-center justify-between gap-3">
                          <div>
                            <div className="text-xs font-semibold uppercase tracking-[0.18em] text-[#777777]">Sub Tasks</div>
                            <div className="mt-1 text-xs text-[#6E6E6E]">Checklist rows that stay with the task and are included for agents.</div>
                          </div>
                          <Button type="button" variant="secondary" size="sm" onClick={addSubtask} className="h-8 px-3">
                            Add Row
                          </Button>
                        </div>
                        <div className="overflow-visible pr-0 md:min-h-0 md:flex-1 md:overflow-y-auto md:pr-1">
                          <div className="space-y-2">
                          {subtasks.length === 0 ? (
                            <div className="rounded-xl border border-dashed border-[rgba(255,255,255,0.08)] bg-[rgba(255,255,255,0.02)] px-3 py-3 text-sm text-[#707070]">
                              No subtasks yet. Add rows for not started, active, and completed checklist items.
                            </div>
                          ) : (
                            subtasks.map((subtask) => {
                              const stateMeta: Record<KanbanSubtaskState, { label: string; color: string; bg: string; border: string }> = {
                                off: {
                                  label: "Not Started",
                                  color: "#9A9A9A",
                                  bg: "rgba(255,255,255,0.04)",
                                  border: "rgba(255,255,255,0.08)",
                                },
                                active: {
                                  label: "Active",
                                  color: "#F7941D",
                                  bg: "rgba(247,148,29,0.12)",
                                  border: "rgba(247,148,29,0.26)",
                                },
                                complete: {
                                  label: "Complete",
                                  color: "#22C55E",
                                  bg: "rgba(34,197,94,0.12)",
                                  border: "rgba(34,197,94,0.26)",
                                },
                              };
                              const meta = stateMeta[subtask.state];

                              return (
                                <div
                                  key={subtask.id}
                                  className="flex items-center gap-2 rounded-xl border border-[rgba(255,255,255,0.08)] bg-[rgba(255,255,255,0.02)] px-2.5 py-2"
                                >
                                  <button
                                    type="button"
                                    onClick={() => cycleSubtaskState(subtask.id)}
                                    className="inline-flex min-w-[88px] items-center justify-center rounded-lg border px-2.5 py-1.5 text-xs font-semibold transition-colors"
                                    style={{ color: meta.color, backgroundColor: meta.bg, borderColor: meta.border }}
                                  >
                                    {meta.label}
                                  </button>
                                  <input
                                    value={subtask.title}
                                    onChange={(event) => updateSubtask(subtask.id, { title: event.target.value })}
                                    placeholder="Sub task title..."
                                    className="h-9 min-w-0 flex-1 rounded-lg border border-[rgba(255,255,255,0.08)] bg-[#202020] px-3 text-sm text-[#F0F0F0] outline-none transition-colors placeholder:text-[#686868] focus:border-[rgba(247,148,29,0.32)]"
                                  />
                                  <button
                                    type="button"
                                    onClick={() => deleteSubtask(subtask.id)}
                                    className="flex h-9 w-9 items-center justify-center rounded-lg text-[#6F6F6F] transition-colors hover:bg-[rgba(239,68,68,0.1)] hover:text-[#F87171]"
                                  >
                                    <Trash2 size={14} />
                                  </button>
                                </div>
                              );
                            })
                          )}
                          </div>
                        </div>
                      </div>
                      </div>
                      <div className="flex flex-col gap-3 md:min-h-0">
                      <div className="rounded-2xl border border-[rgba(255,255,255,0.08)] bg-[linear-gradient(180deg,rgba(24,24,24,0.98),rgba(14,14,14,0.98))] p-2.5 md:p-3">
                       
                        <div className="mt-3 grid gap-2 sm:grid-cols-2">
                          {KANBAN_TASK_STATES.map((option) => {
                            const meta = KANBAN_TASK_STATE_META[option];
                            const selected = taskState === option;

                            return (
                              <button
                                key={option}
                                type="button"
                                onClick={() => setTaskState(option)}
                                className="rounded-2xl border px-3 py-3 text-left transition-all"
                                style={{
                                  borderColor: selected ? meta.border : "rgba(255,255,255,0.08)",
                                  background: selected ? `linear-gradient(180deg, ${meta.background}, rgba(255,255,255,0.02))` : "rgba(255,255,255,0.02)",
                                  boxShadow: selected ? `inset 0 0 0 1px ${meta.border}` : "none",
                                }}
                              >
                                <div className="flex items-center justify-between gap-3">
                                  <span className="text-sm font-semibold" style={{ color: selected ? meta.color : "#F0F0F0" }}>
                                    {meta.label}
                                  </span>
                                  <span
                                    className="flex h-5 w-5 items-center justify-center rounded-full border"
                                    style={{
                                      color: selected ? meta.color : "transparent",
                                      borderColor: selected ? meta.border : "rgba(255,255,255,0.1)",
                                      backgroundColor: selected ? meta.background : "transparent",
                                    }}
                                  >
                                    <Check size={12} />
                                  </span>
                                </div>
                              </button>
                            );
                          })}
                        </div>
                      </div>
                      {/* Task Group */}
                      {taskGroups !== undefined && !isCreateMode && (
                        <div className="rounded-2xl border border-[rgba(255,255,255,0.08)] bg-[linear-gradient(180deg,rgba(24,24,24,0.98),rgba(14,14,14,0.98))] p-2.5 md:p-3">
                          <div className="flex items-center justify-between gap-3">
                            <div className="flex items-center gap-2">
                              <Layers size={13} className="text-[#666666]" />
                              <span className="text-xs font-semibold uppercase tracking-[0.18em] text-[#777777]">Task Group</span>
                            </div>
                            {currentTaskGroupId ? (() => {
                              const currentGroup = taskGroups.find((g) => g.id === currentTaskGroupId);
                              const meta = getGroupStatusMeta(currentGroup?.status ?? "backlog");
                              return (
                                <div className="flex items-center gap-2">
                                  <span
                                    className="inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-semibold"
                                    style={{ color: meta.color, backgroundColor: meta.bg, borderColor: meta.border }}
                                  >
                                    <Layers size={10} />
                                    {currentGroup?.name ?? "Group"}
                                  </span>
                                  <button
                                    type="button"
                                    onClick={() => void handleSetTaskGroup(null)}
                                    disabled={settingGroup}
                                    className="flex h-6 w-6 items-center justify-center rounded-lg text-[#555555] transition-colors hover:bg-[rgba(239,68,68,0.1)] hover:text-[#F87171] disabled:opacity-40"
                                    title="Remove from group"
                                  >
                                    <X size={11} />
                                  </button>
                                </div>
                              );
                            })() : (
                              <div ref={groupMenuRef} className="relative">
                                <button
                                  type="button"
                                  onClick={() => setGroupMenuOpen((prev) => !prev)}
                                  disabled={settingGroup || taskGroups.length === 0}
                                  className="inline-flex items-center gap-1.5 rounded-full border border-[rgba(255,255,255,0.08)] bg-[rgba(255,255,255,0.03)] px-3 py-1.5 text-xs text-[#888888] transition-colors hover:border-[rgba(247,148,29,0.2)] hover:text-[#F0F0F0] disabled:opacity-40"
                                >
                                  <Layers size={11} />
                                  {taskGroups.length === 0 ? "No groups yet" : "Add to group"}
                                  {taskGroups.length > 0 && <ChevronDown size={11} />}
                                </button>
                                <AnimatePresence>
                                  {groupMenuOpen && (
                                    <motion.div
                                      initial={{ opacity: 0, y: 8, scale: 0.98 }}
                                      animate={{ opacity: 1, y: 0, scale: 1 }}
                                      exit={{ opacity: 0, y: 8, scale: 0.98 }}
                                      className="absolute right-0 top-full z-20 mt-2 w-52 overflow-hidden rounded-2xl border border-[rgba(255,255,255,0.08)] bg-[#151515] p-1.5 shadow-2xl"
                                    >
                                      {taskGroups.map((group) => {
                                        const meta = getGroupStatusMeta(group.status);
                                        return (
                                          <button
                                            key={group.id}
                                            type="button"
                                            onClick={() => void handleSetTaskGroup(group.id)}
                                            className="flex w-full items-center gap-2.5 rounded-xl px-3 py-2 text-left text-sm transition-colors hover:bg-[rgba(255,255,255,0.04)]"
                                          >
                                            <div
                                              className="flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-md border"
                                              style={{ borderColor: meta.border, backgroundColor: meta.bg }}
                                            >
                                              <Layers size={10} style={{ color: meta.color }} />
                                            </div>
                                            <span className="flex-1 truncate text-[#D0D0D0]">{group.name}</span>
                                            <span
                                              className="flex-shrink-0 rounded-full px-1.5 py-0.5 text-[10px] font-semibold"
                                              style={{ color: meta.color, backgroundColor: `${meta.color}18` }}
                                            >
                                              {meta.label}
                                            </span>
                                          </button>
                                        );
                                      })}
                                    </motion.div>
                                  )}
                                </AnimatePresence>
                              </div>
                            )}
                          </div>
                        </div>
                      )}

                      <div className="flex flex-col rounded-2xl border border-[rgba(255,255,255,0.08)] bg-[linear-gradient(180deg,rgba(24,24,24,0.98),rgba(14,14,14,0.98))] p-3 md:min-h-0 md:flex-1">
                        <div className="mb-3 text-xs font-semibold uppercase tracking-[0.18em] text-[#777777]">Labels</div>
                      <div className="flex flex-col rounded-xl border border-[rgba(255,255,255,0.08)] bg-[#181818] p-1.5 md:min-h-0 md:flex-1">
                        <div className="flex flex-col gap-2 md:min-h-0 md:flex-1">
                          <div className="content-start overflow-visible md:min-h-0 md:flex-1 md:overflow-y-auto">
                            <div className="flex min-h-full flex-wrap gap-1.5">
                            {selectedLabels.map((label) => (
                              <button
                                key={label}
                                type="button"
                                onClick={() => removeLabel(label)}
                                className="inline-flex h-7 items-center gap-1.5 rounded-full border border-[rgba(255,255,255,0.08)] bg-[rgba(255,255,255,0.04)] px-2.5 text-xs text-[#D0D0D0] transition-colors hover:border-[rgba(239,68,68,0.2)] hover:text-[#F0F0F0]"
                              >
                                <span>{label}</span>
                                <X size={11} className="text-[#7A7A7A]" />
                              </button>
                            ))}
                            {selectedLabels.length === 0 ? (
                              <span className="flex h-7 items-center px-1 text-xs text-[#666666]">No labels yet</span>
                            ) : null}
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            <input
                              value={labelInput}
                              onChange={(event) => setLabelInput(event.target.value)}
                              onKeyDown={(event) => {
                                if (event.key === "Enter" || event.key === ",") {
                                  event.preventDefault();
                                  addLabel(labelInput);
                                }
                              }}
                              placeholder="Add label..."
                              className="h-9 min-w-0 flex-1 rounded-lg border border-[rgba(255,255,255,0.08)] bg-[#202020] px-3 text-sm text-[#F0F0F0] outline-none transition-colors placeholder:text-[#686868] focus:border-[rgba(247,148,29,0.32)]"
                            />
                            <Button type="button" variant="secondary" size="sm" onClick={() => addLabel(labelInput)} className="h-9 px-4">
                              Add
                            </Button>
                          </div>
                        </div>
                      </div>
                      </div>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        {card?.githubIssueUrl && (
                          <a
                            href={card.githubIssueUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-2 rounded-xl border border-[rgba(255,255,255,0.08)] bg-[rgba(255,255,255,0.03)] px-3 py-2 text-xs text-[#D0D0D0] transition-all hover:text-[#F7941D]"
                          >
                            <ExternalLink size={12} />
                            GitHub #{card.githubIssueId}
                          </a>
                        )}
                        {isCreateMode && selectedRepo?.fullName && selectedRepo.id !== "general" && (
                          <button
                            type="button"
                            onClick={() => setCreateGithubIssue((prev) => !prev)}
                            className={`inline-flex items-center gap-2 rounded-xl border px-3 py-2 text-xs transition-all ${
                              createGithubIssue
                                ? "border-[rgba(247,148,29,0.26)] bg-[rgba(247,148,29,0.1)] text-[#F7941D]"
                                : "border-[rgba(255,255,255,0.08)] bg-[rgba(255,255,255,0.03)] text-[#B8B8B8]"
                            }`}
                          >
                            <GitBranch size={12} />
                            Create GitHub Issue Too
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                  {error && <div className="rounded-xl border border-[rgba(239,68,68,0.25)] bg-[rgba(239,68,68,0.08)] px-3 py-2 text-sm text-[#FCA5A5]">{error}</div>}
                </div>
              ) : activeTab === "notes" ? (
                <div className="flex h-full min-h-0 flex-col overflow-hidden rounded-2xl border border-[rgba(255,255,255,0.06)] bg-[linear-gradient(180deg,rgba(20,20,20,0.98),rgba(12,12,12,0.98))]">
                  <div ref={notesScrollRef} className="flex-1 overflow-y-auto bg-[rgba(255,255,255,0.015)] px-4 py-4">
                    <div className="mx-auto flex min-h-full max-w-3xl flex-col justify-end gap-3">
                      {orderedNotes.length === 0 ? (
                        <div className="flex min-h-[360px] items-center justify-center rounded-2xl border border-dashed border-[rgba(255,255,255,0.08)] bg-[rgba(255,255,255,0.02)] px-6 text-center">
                          <div>
                            <div className="text-base font-medium text-[#C5C5C5]">{isCreateMode ? "Notes unlock after creation" : "No notes yet"}</div>
                            <div className="mt-1 text-sm text-[#707070]">
                              {isCreateMode
                                ? "Save this task first to open its team thread."
                                : "Start the thread with context, blockers, or follow-up details."}
                            </div>
                          </div>
                        </div>
                      ) : (
                        orderedNotes.map((note) => {
                          const isOwn = currentUserId !== null && note.author.id === currentUserId;
                          const authorName = note.author.displayName ?? note.author.name ?? note.author.email;
                          return (
                            <div key={note.id} className={`group flex items-end gap-2 ${isOwn ? "justify-end" : "justify-start"}`}>
                              {!isOwn ? (
                                <Avatar
                                  src={note.author.image}
                                  name={authorName}
                                  size="xs"
                                  className="!h-8 !w-8 flex-shrink-0 text-[9px] ring-1 ring-[rgba(255,255,255,0.08)]"
                                />
                              ) : null}
                              <div className={`max-w-[80%] ${isOwn ? "items-end" : "items-start"} flex flex-col gap-0.5`}>
                                <div className={`flex items-center gap-2 px-0.5 text-[11px] ${isOwn ? "justify-end" : "justify-start"}`}>
                                  <span className={isOwn ? "text-[#F3C38C]" : "text-[#C6C6C6]"}>{authorName}</span>
                                  <span className="text-[#666666]">{formatNoteTime(note.createdAt)}</span>
                                </div>
                                <div
                                  className="rounded-2xl px-3 py-2 shadow-[0_10px_24px_rgba(0,0,0,0.18)]"
                                  style={{
                                    background: isOwn
                                      ? "linear-gradient(180deg, rgba(247,148,29,0.18), rgba(247,148,29,0.12))"
                                      : "linear-gradient(180deg, rgba(255,255,255,0.06), rgba(255,255,255,0.03))",
                                    border: isOwn
                                      ? "1px solid rgba(247,148,29,0.2)"
                                      : "1px solid rgba(255,255,255,0.06)",
                                  }}
                                >
                                  {note.image ? (
                                    <button
                                      type="button"
                                      onClick={() => setPreviewImage(note.image ?? null)}
                                      className="mb-2 block overflow-hidden rounded-xl border border-[rgba(255,255,255,0.08)] bg-black/20 transition-transform hover:scale-[1.01]"
                                    >
                                      <img
                                        src={note.image}
                                        alt="Task note attachment"
                                        className="max-h-[260px] w-auto max-w-full object-cover"
                                      />
                                    </button>
                                  ) : null}
                                  {note.body ? (
                                    <p className={`whitespace-pre-wrap text-sm leading-relaxed ${isOwn ? "text-[#FFF3E5]" : "text-[#D8D8D8]"}`}>
                                      {note.body}
                                    </p>
                                  ) : null}
                                </div>
                              </div>
                              {isOwn ? (
                                <div className="relative">
                                  <Avatar
                                    src={note.author.image}
                                    name={authorName}
                                    size="xs"
                                    className="!h-8 !w-8 flex-shrink-0 text-[9px] ring-1 ring-[rgba(255,255,255,0.08)]"
                                  />
                                  <button
                                    type="button"
                                    onClick={() => setConfirmDeleteNoteId(note.id)}
                                    disabled={deletingNoteId === note.id}
                                    className="pointer-events-none absolute -left-11 top-1/2 flex h-7 w-7 -translate-y-1/2 items-center justify-center rounded-full border border-[rgba(255,255,255,0.08)] bg-[rgba(18,18,18,0.96)] text-[#6F6F6F] opacity-0 shadow-[0_8px_18px_rgba(0,0,0,0.28)] transition-all hover:border-[rgba(239,68,68,0.2)] hover:text-[#F87171] group-hover:pointer-events-auto group-hover:opacity-100 disabled:cursor-wait disabled:opacity-100"
                                    title="Delete note"
                                  >
                                    <Trash2 size={12} />
                                  </button>
                                </div>
                              ) : null}
                            </div>
                          );
                        })
                      )}
                    </div>
                  </div>

                  {!card?.isSprintOnly && !isCreateMode ? (
                    <div className="border-t border-[rgba(255,255,255,0.05)] bg-[rgba(14,14,14,0.96)] px-4 py-3">
                      <div className="mx-auto max-w-3xl">
                        <input
                          ref={noteImageInputRef}
                          type="file"
                          accept="image/png,image/jpeg,image/webp,image/gif"
                          className="hidden"
                          onChange={(event) => {
                            void handleNoteImageFile(event.target.files?.[0] ?? null);
                            event.currentTarget.value = "";
                          }}
                        />
                        <div className="rounded-2xl border border-[rgba(255,255,255,0.08)] bg-[rgba(255,255,255,0.03)] p-2">
                          <div className="flex items-center gap-2">
                            <textarea
                              value={noteBody}
                              onChange={(event) => setNoteBody(event.target.value)}
                              onKeyDown={(event) => {
                                if (event.key === "Enter" && !event.shiftKey) {
                                  event.preventDefault();
                                  if (noteBody.trim() || noteImage) {
                                    void handleAddNote();
                                  }
                                }
                              }}
                              onPaste={(event) => {
                                const imageItem = Array.from(event.clipboardData.items).find((item) =>
                                  item.type.startsWith("image/")
                                );
                                if (!imageItem) return;
                                event.preventDefault();
                                void handleNoteImageFile(imageItem.getAsFile());
                              }}
                              placeholder="Write a note..."
                              className="h-10 min-h-[40px] flex-1 resize-none rounded-xl border border-[rgba(255,255,255,0.08)] bg-[#202020] px-3 py-2 text-sm text-[#F0F0F0] outline-none transition-colors placeholder:text-[#686868] focus:border-[rgba(247,148,29,0.32)]"
                            />
                            <div className="ml-auto flex flex-shrink-0 items-center gap-2">
                              <button
                                type="button"
                                onClick={() => noteImageInputRef.current?.click()}
                                className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-[rgba(255,255,255,0.08)] bg-[rgba(255,255,255,0.03)] text-sm text-[#8B8B8B] transition-all hover:border-[rgba(247,148,29,0.18)] hover:text-[#F7941D]"
                                title="Attach image"
                              >
                                <Paperclip size={14} />
                              </button>
                              <Button
                                variant="primary"
                                size="sm"
                                loading={sendingNote}
                                disabled={!noteBody.trim() && !noteImage}
                                icon={<Send size={13} />}
                                className="h-10 flex-shrink-0 px-4"
                                onClick={() => void handleAddNote()}
                              >
                                Send Note
                              </Button>
                            </div>
                          </div>
                          {noteImage ? (
                            <div className="mt-3 inline-flex items-start gap-3 rounded-2xl border border-[rgba(255,255,255,0.08)] bg-[rgba(255,255,255,0.03)] p-2">
                              <button
                                type="button"
                                onClick={() => setPreviewImage(noteImage)}
                                className="overflow-hidden rounded-xl border border-[rgba(255,255,255,0.08)]"
                              >
                                <img
                                  src={noteImage}
                                  alt="Attachment preview"
                                  className="h-20 w-20 object-cover"
                                />
                              </button>
                              <div className="flex min-w-0 flex-col justify-between gap-2 py-0.5">
                                <div>
                                  <div className="text-xs font-medium text-[#D8D8D8]">Image ready to send</div>
                                  <div className="mt-0.5 text-[11px] text-[#757575]">Paste another image or remove this one before sending.</div>
                                </div>
                                <button
                                  type="button"
                                  onClick={() => setNoteImage(null)}
                                  className="inline-flex w-fit items-center gap-1 text-[11px] text-[#F3C38C] transition-colors hover:text-[#F7941D]"
                                >
                                  <X size={12} />
                                  Remove image
                                </button>
                              </div>
                            </div>
                          ) : null}
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="border-t border-[rgba(255,255,255,0.05)] bg-[rgba(14,14,14,0.96)] px-4 py-4">
                      <div className="mx-auto max-w-3xl rounded-2xl border border-dashed border-[rgba(255,255,255,0.08)] bg-[rgba(255,255,255,0.02)] px-4 py-3 text-sm text-[#707070]">
                        {isCreateMode
                          ? "Create the task to start its team notes thread."
                          : "Sprint-only tasks do not have a linked kanban note thread yet."}
                      </div>
                    </div>
                  )}
                </div>
                  ) : activeTab === "commits" ? (
                    <div className="flex h-full min-h-0 flex-col overflow-hidden rounded-2xl border border-[rgba(255,255,255,0.06)] bg-[linear-gradient(180deg,rgba(18,18,18,0.98),rgba(11,11,11,0.98))]">
                      <div className="flex-1 overflow-y-auto px-4 py-4">
                        <div className="mx-auto max-w-3xl">
                          {isCreateMode ? (
                            <div className="flex min-h-[360px] items-center justify-center rounded-2xl border border-dashed border-[rgba(255,255,255,0.08)] bg-[rgba(255,255,255,0.02)] px-6 text-center">
                              <div>
                                <div className="text-base font-medium text-[#C5C5C5]">Commits unlock after creation</div>
                                <div className="mt-1 text-sm text-[#707070]">
                                  Create the task first, then use its ID in commit messages to link code back here.
                                </div>
                              </div>
                            </div>
                          ) : card?.isSprintOnly ? (
                            <div className="flex min-h-[360px] items-center justify-center rounded-2xl border border-dashed border-[rgba(255,255,255,0.08)] bg-[rgba(255,255,255,0.02)] px-6 text-center">
                              <div>
                                <div className="text-base font-medium text-[#C5C5C5]">No repo commits for sprint-only tasks</div>
                                <div className="mt-1 text-sm text-[#707070]">
                                  This task is not attached to a kanban repo card, so commit linking is unavailable.
                                </div>
                              </div>
                            </div>
                          ) : loadingCommits ? (
                            <div className="space-y-3">
                              {Array.from({ length: 4 }).map((_, index) => (
                                <div
                                  key={index}
                                  className="h-20 animate-pulse rounded-2xl border border-[rgba(255,255,255,0.06)] bg-[rgba(255,255,255,0.03)]"
                                />
                              ))}
                            </div>
                          ) : linkedCommits.length === 0 ? (
                            <div className="flex min-h-[360px] items-center justify-center rounded-2xl border border-dashed border-[rgba(255,255,255,0.08)] bg-[rgba(255,255,255,0.02)] px-6 text-center">
                              <div>
                                <div className="text-base font-medium text-[#C5C5C5]">No linked commits yet</div>
                                <div className="mt-1 text-sm text-[#707070]">
                                  Copy the task ID from Overview and include it in a commit message to have code changes appear here.
                                </div>
                              </div>
                            </div>
                          ) : (
                            <div className="space-y-3">
                              {linkedCommits.map((commit) => {
                                const [headline] = commit.commit.message.split("\n");
                                const shortSha = commit.sha.slice(0, 7);

                                return (
                                  <a
                                    key={commit.sha}
                                    href={commit.html_url}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="block rounded-2xl border border-[rgba(255,255,255,0.06)] bg-[rgba(255,255,255,0.03)] p-4 transition-all hover:border-[rgba(247,148,29,0.24)] hover:bg-[rgba(247,148,29,0.04)]"
                                  >
                                    <div className="flex items-start justify-between gap-3">
                                      <div className="min-w-0">
                                        <div className="flex items-center gap-2 text-[11px] uppercase tracking-[0.18em] text-[#6F6F6F]">
                                          <GitCommit size={12} />
                                          Code Commit
                                        </div>
                                        <div className="mt-2 truncate text-sm font-semibold text-[#F0F0F0]">
                                          {headline}
                                        </div>
                                        <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-[#7D7D7D]">
                                          <span className="rounded-full border border-[rgba(247,148,29,0.18)] bg-[rgba(247,148,29,0.08)] px-2 py-0.5 font-mono text-[#F3C38C]">
                                            {shortSha}
                                          </span>
                                          <span>{commit.author?.login ?? commit.commit.author?.name ?? "unknown"}</span>
                                          {commit.commit.author?.date ? <span>{formatNoteTime(commit.commit.author.date)}</span> : null}
                                        </div>
                                      </div>
                                      <ExternalLink size={14} className="mt-1 flex-shrink-0 text-[#707070]" />
                                    </div>
                                  </a>
                                );
                              })}
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  ) : (
                    /* ── Agents tab ───────────────────────────────────── */
                    <div className="h-full overflow-y-auto space-y-4 pb-2">
                      <div className="grid gap-4 xl:grid-cols-[minmax(0,1.45fr)_360px]">
                        <div className="rounded-2xl border border-[rgba(255,255,255,0.07)] bg-[linear-gradient(180deg,rgba(20,22,26,0.98),rgba(12,14,16,0.98))] p-4">
                          

                          {loadingAgents ? (
                            <div className="flex items-center gap-2 py-4 text-sm text-[#707070]">
                              <Loader2 size={14} className="animate-spin" />
                              Loading agents…
                            </div>
                          ) : agentOptions.length === 0 ? (
                            <div className="rounded-xl border border-[rgba(255,255,255,0.06)] bg-[rgba(255,255,255,0.02)] px-4 py-5 text-center">
                              <p className="text-sm text-[#707070]">No active agents configured.</p>
                              <a href="/agents/new" className="mt-1 block text-xs text-[#4B9CD3] hover:text-[#7DC4F0]">
                                Hire an agent →
                              </a>
                            </div>
                          ) : (
                            <div className="space-y-4">
                              <div>
                                <div className="mb-1.5 block text-[11px] font-semibold uppercase tracking-wider text-[#606060]">
                                  Agent
                                </div>
                                <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                                  {agentOptions.map((agent) => (
                                    <button
                                      key={agent.id}
                                      type="button"
                                      onClick={() => setSelectedAgentId(agent.id)}
                                      className="rounded-2xl border p-3 text-left transition-all"
                                      style={{
                                        borderColor: selectedAgentId === agent.id ? `${AGENT_COLOR}50` : "rgba(255,255,255,0.08)",
                                        backgroundColor: selectedAgentId === agent.id ? "rgba(75,156,211,0.14)" : "rgba(255,255,255,0.03)",
                                        color: selectedAgentId === agent.id ? "#DDF1FF" : "#A0A0A0",
                                        boxShadow: selectedAgentId === agent.id ? "0 0 0 1px rgba(75,156,211,0.35), 0 10px 24px rgba(0,0,0,0.22)" : "none",
                                      }}
                                    >
                                      <div className="flex items-center gap-3">
                                        <div className="flex h-11 w-11 flex-shrink-0 items-center justify-center overflow-hidden rounded-2xl border border-[rgba(255,255,255,0.08)] bg-[rgba(75,156,211,0.08)] text-[#9CD7F5]">
                                          {agent.avatar && (agent.avatar.startsWith("data:") || agent.avatar.startsWith("https://")) ? (
                                            <img src={agent.avatar} alt={agent.name} className="h-full w-full object-cover" />
                                          ) : agent.avatar && /^\p{Emoji}/u.test(agent.avatar) ? (
                                            <span className="text-xl leading-none">{agent.avatar}</span>
                                          ) : (
                                            <Bot size={16} />
                                          )}
                                        </div>

                                        <div className="min-w-0 flex-1">
                                          <div className="flex items-center gap-2">
                                            <span className="truncate text-sm font-semibold">{agent.name}</span>
                                            <span
                                              className="h-2 w-2 flex-shrink-0 rounded-full"
                                              style={{ backgroundColor: agent.llmStatus === "online" ? "#22C55E" : "#EF4444" }}
                                            />
                                          </div>
                                          <div className="mt-0.5 truncate text-[11px] text-[#6F7D88]">{agent.role}</div>
                                          <div className="mt-1 text-[10px] uppercase tracking-[0.14em] text-[#4E6B7E]">
                                            {normalizeAgentAbilities(agent.abilities ?? null).length} abilities
                                          </div>
                                        </div>
                                      </div>
                                    </button>
                                  ))}
                                </div>
                              </div>

                              <div>
                                <div className="mb-1.5 flex items-center justify-between gap-3">
                                  <label className="block text-[11px] font-semibold uppercase tracking-wider text-[#606060]">
                                    What should the agent do?
                                  </label>
                                  {selectedAgent && (
                                    <span className="text-[10px] uppercase tracking-[0.14em] text-[#4E6B7E]">
                                      Showing {availableActionTypes.length} for {selectedAgent.name}
                                    </span>
                                  )}
                                </div>
                                {availableActionTypes.length > 0 ? (
                                  <div className="grid grid-cols-1 gap-2 lg:grid-cols-2">
                                    {availableActionTypes.map((ability) => (
                                      <button
                                        key={ability.id}
                                        type="button"
                                        onClick={() => setSelectedActionType(ability.id)}
                                        className="rounded-xl border p-3 text-left transition-all"
                                        style={{
                                          borderColor: selectedActionType === ability.id ? `${AGENT_COLOR}45` : "rgba(255,255,255,0.07)",
                                          backgroundColor: selectedActionType === ability.id ? "rgba(75,156,211,0.12)" : "rgba(255,255,255,0.02)",
                                        }}
                                      >
                                        <div
                                          className="mb-1 text-xs font-semibold"
                                          style={{ color: selectedActionType === ability.id ? "#DDF1FF" : "#C0C0C0" }}
                                        >
                                          {ability.label}
                                        </div>
                                        <div className="text-[10px] leading-4" style={{ color: selectedActionType === ability.id ? "#8FC8E8" : "#606060" }}>
                                          {ability.description}
                                        </div>
                                      </button>
                                    ))}
                                  </div>
                                ) : (
                                  <div className="rounded-xl border border-[rgba(255,255,255,0.06)] bg-[rgba(255,255,255,0.02)] px-4 py-3 text-xs text-[#707070]">
                                    This agent does not have any custom abilities yet. Add them from the agent profile first.
                                  </div>
                                )}
                              </div>
                            </div>
                          )}
                        </div>

                        <div className="xl:sticky xl:top-0 xl:self-start">
                          <div className="rounded-2xl border border-[rgba(75,156,211,0.16)] bg-[linear-gradient(180deg,rgba(19,25,31,0.98),rgba(10,14,18,0.98))] p-4 shadow-[0_16px_40px_rgba(0,0,0,0.22)]">
                            <div className="flex items-center gap-2">
                              <div
                                className="flex h-9 w-9 items-center justify-center rounded-xl border"
                                style={{ borderColor: `${AGENT_COLOR}35`, backgroundColor: AGENT_COLOR_DIM }}
                              >
                                <Play size={15} style={{ color: AGENT_COLOR }} />
                              </div>
                              <div>
                                <div className="text-sm font-semibold text-[#EAF6FF]">Execution</div>
                                <div className="text-xs text-[#6E8797]">Review the selection and run without scrolling.</div>
                              </div>
                            </div>

                            <div className="mt-4 space-y-3">
                              <div className="rounded-xl border border-[rgba(255,255,255,0.06)] bg-[rgba(255,255,255,0.03)] px-3 py-2.5">
                                <div className="text-[10px] uppercase tracking-[0.16em] text-[#5F7380]">Agent</div>
                                <div className="mt-1 text-sm font-semibold text-[#EAF6FF]">
                                  {selectedAgent?.name ?? "Choose an agent"}
                                </div>
                                <div className="mt-1 text-xs text-[#6E8797]">
                                  {selectedAgent?.role ?? "Select who should own this task."}
                                </div>
                              </div>

                              <div className="rounded-xl border border-[rgba(255,255,255,0.06)] bg-[rgba(255,255,255,0.03)] px-3 py-2.5">
                                <div className="text-[10px] uppercase tracking-[0.16em] text-[#5F7380]">Action</div>
                                <div className="mt-1 text-sm font-semibold text-[#EAF6FF]">
                                  {availableActionTypes.find((ability) => ability.id === selectedActionType)?.label ?? "Choose an action"}
                                </div>
                                <div className="mt-1 text-xs text-[#6E8797]">
                                  {availableActionTypes.find((ability) => ability.id === selectedActionType)?.description ?? "Pick the kind of work this agent should perform."}
                                </div>
                              </div>

                              <div>
                                <label className="mb-1.5 block text-[11px] font-semibold uppercase tracking-wider text-[#5F7380]">
                                  Additional Context <span className="normal-case font-normal text-[#445462]">(optional)</span>
                                </label>
                                <Textarea
                                  value={agentNotes}
                                  onChange={(e) => setAgentNotes(e.target.value)}
                                  placeholder="Any extra context, specific focus areas, or constraints for the agent…"
                                  rows={4}
                                  className="resize-none text-sm"
                                />
                              </div>

                              {executeError && (
                                <div className="rounded-xl border border-[rgba(239,68,68,0.25)] bg-[rgba(239,68,68,0.08)] px-3 py-2 text-xs text-[#FCA5A5]">
                                  {executeError}
                                </div>
                              )}

                              <button
                                type="button"
                                onClick={() => void handleExecuteAgent()}
                                disabled={executing || !selectedAgentId || !selectedActionType || availableActionTypes.length === 0}
                                className="flex w-full items-center justify-center gap-2 rounded-xl border px-4 py-3 text-sm font-semibold transition-all disabled:opacity-40"
                                style={{
                                  borderColor: `${AGENT_COLOR}45`,
                                  backgroundColor: executing ? "rgba(75,156,211,0.12)" : "rgba(75,156,211,0.18)",
                                  color: "#DDF1FF",
                                  boxShadow: "0 0 20px rgba(75,156,211,0.1)",
                                }}
                              >
                                {executing ? (
                                  <>
                                    <Loader2 size={15} className="animate-spin" />
                                    Running…
                                  </>
                                ) : (
                                  <>
                                    <Play size={14} />
                                    Execute Task
                                  </>
                                )}
                              </button>
                            </div>
                          </div>
                        </div>
                      </div>

                      {/* Previous executions for this card */}
                      {cardExecutions.length > 0 && (
                        <div className="rounded-2xl border border-[rgba(255,255,255,0.07)] bg-[rgba(255,255,255,0.01)] p-4">
                          <div className="mb-3 text-[11px] font-semibold uppercase tracking-wider text-[#606060]">
                            Previous Executions ({cardExecutions.length})
                          </div>
                          <div className="space-y-2">
                            {cardExecutions.map((exec) => {
                              const statusColors: Record<string, { color: string; bg: string; border: string }> = {
                                "in-process": { color: "#4B9CD3", bg: "rgba(75,156,211,0.1)", border: "rgba(75,156,211,0.2)" },
                                "needs-input": { color: "#FBBA00", bg: "rgba(251,186,0,0.1)", border: "rgba(251,186,0,0.2)" },
                                completed: { color: "#22C55E", bg: "rgba(34,197,94,0.1)", border: "rgba(34,197,94,0.2)" },
                                failed: { color: "#EF4444", bg: "rgba(239,68,68,0.1)", border: "rgba(239,68,68,0.2)" },
                              };
                              const sc = statusColors[exec.status] ?? statusColors["in-process"];
                              const isExpanded = expandedExecutionId === exec.id;
                              const actionLabel = resolveAgentActionLabel(exec.actionType, exec.agent.abilities);
                              const date = new Date(exec.createdAt);
                              const relDate = (() => {
                                const diff = Date.now() - date.getTime();
                                const mins = Math.floor(diff / 60_000);
                                if (mins < 1) return "just now";
                                if (mins < 60) return `${mins}m ago`;
                                const hrs = Math.floor(mins / 60);
                                if (hrs < 24) return `${hrs}h ago`;
                                return date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
                              })();

                              return (
                                <div
                                  key={exec.id}
                                  className="rounded-xl border"
                                  style={{ borderColor: sc.border, backgroundColor: sc.bg }}
                                >
                                  <button
                                    type="button"
                                    className="flex w-full items-center justify-between gap-3 px-3 py-2.5 text-left"
                                    onClick={() => setExpandedExecutionId(isExpanded ? null : exec.id)}
                                  >
                                    <div className="min-w-0 flex-1">
                                      <div className="flex flex-wrap items-center gap-2">
                                        <span className="text-xs font-semibold" style={{ color: sc.color }}>
                                          {exec.agent.name}
                                        </span>
                                        <span className="text-[10px] text-[#707070]">{actionLabel}</span>
                                      </div>
                                      <div className="flex items-center gap-2 mt-0.5 text-[10px] text-[#505050]">
                                        <span className="capitalize">{exec.status.replace("-", " ")}</span>
                                        <span>·</span>
                                        <span>{relDate}</span>
                                        {exec.modelUsed && <span className="font-mono">{exec.modelUsed}</span>}
                                      </div>
                                    </div>
                                    {isExpanded ? <ChevronDown size={13} style={{ color: sc.color }} /> : <ChevronDown size={13} className="text-[#505050]" />}
                                  </button>

                                  {isExpanded && (
                                    <div className="border-t px-3 pb-3 pt-2" style={{ borderColor: sc.border }}>
                                      {exec.status === "failed" ? (
                                        <div className="space-y-2">
                                          {exec.errorMessage && (
                                            <p className="text-xs leading-5 text-[#FCA5A5]">{exec.errorMessage}</p>
                                          )}
                                          <button
                                            type="button"
                                            disabled={retryingExecutionId === exec.id}
                                            onClick={() => void handleRetryExecution(exec)}
                                            className="flex items-center gap-1.5 rounded-lg border border-[rgba(239,68,68,0.3)] bg-[rgba(239,68,68,0.08)] px-3 py-1.5 text-xs font-semibold text-[#FCA5A5] transition-colors hover:bg-[rgba(239,68,68,0.16)] disabled:opacity-50"
                                          >
                                            {retryingExecutionId === exec.id
                                              ? <Loader2 size={11} className="animate-spin" />
                                              : <RotateCcw size={11} />}
                                            Retry
                                          </button>
                                        </div>
                                      ) : exec.response ? (
                                        <div>
                                          <div className="flex items-center justify-between mb-1.5">
                                            <span className="text-[10px] text-[#505050] uppercase tracking-wider font-semibold">Response</span>
                                            <button
                                              type="button"
                                              className="text-[10px] text-[#505050] hover:text-[#A0A0A0]"
                                              onClick={() => void navigator.clipboard.writeText(exec.response ?? "")}
                                            >
                                              Copy
                                            </button>
                                          </div>
                                          <div className="max-h-64 overflow-y-auto pr-0.5">
                                            <ReactMarkdown remarkPlugins={[remarkGfm]} components={executionMarkdownComponents}>
                                              {exec.response}
                                            </ReactMarkdown>
                                          </div>
                                        </div>
                                      ) : (
                                        <div className="flex items-center gap-2 text-xs text-[#606060]">
                                          <Loader2 size={12} className="animate-spin" />
                                          Processing…
                                        </div>
                                      )}
                                    </div>
                                  )}
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      )}
                    </div>
                  )}
            </div>
            </div>
            {error && <div className="px-5 pb-2 md:px-7"><div className="rounded-xl border border-[rgba(239,68,68,0.25)] bg-[rgba(239,68,68,0.08)] px-3 py-2 text-sm text-[#FCA5A5]">{error}</div></div>}

            <div className="border-t border-[rgba(255,255,255,0.06)] px-5 py-4 md:px-7">
              <div className="flex items-center justify-between gap-3">
                {!isCreateMode && card ? (
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={() => void onDelete?.(card)}
                    icon={<Trash2 size={13} />}
                    className="text-[#EF4444] hover:text-[#F87171]"
                  >
                    Delete
                  </Button>
                ) : <div />}
                <div className="flex items-center gap-3">
                  <Button variant="secondary" size="sm" onClick={onClose}>
                    Cancel
                  </Button>
                  {(!card?.isSprintOnly || isCreateMode) && (
                    <>
                      {!isCreateMode && (
                        <Button variant="secondary" size="sm" loading={saving} onClick={() => void handleSave(false)}>
                          Save
                        </Button>
                      )}
                      <Button variant="primary" size="sm" loading={saving} onClick={() => void handleSave(true)}>
                        {isCreateMode ? "Create Task" : "Save & Close"}
                      </Button>
                    </>
                  )}
                </div>
              </div>
            </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
