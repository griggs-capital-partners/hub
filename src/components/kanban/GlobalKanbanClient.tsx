"use client";

import { useDeferredValue, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { motion, AnimatePresence } from "framer-motion";
import {
  LayoutGrid, LayoutList, ArrowUpDown, Plus, X, CheckCircle2, Circle, Clock, AlertTriangle, ChevronDown, ChevronUp, SlidersHorizontal, Search, RotateCcw, FlaskConical, Layers, FolderGit2, GitBranch, Globe2, Users, Building2, Trash2, Check, UserCheck,
} from "lucide-react";
import { Avatar } from "@/components/ui/Avatar";
import { cn } from "@/lib/utils";
import { KanbanCustomer } from "./KanbanCustomerField";
import { KanbanCard } from "./KanbanCard";
import { Button } from "@/components/ui/Button";
import { KanbanCardDrawer } from "./KanbanCardDrawer";
import { type TaskGroupData } from "./TaskGroupRow";
import { TaskGroupKanbanCard } from "./TaskGroupKanbanCard";
import {
  ACTIVE_COLUMN,
  BACKLOG_COLUMN,
  DONE_COLUMN,
  PO_REVIEW_COLUMN,
  PRIMARY_KANBAN_COLUMNS,
  QA_COLUMN,
  normalizeKanbanColumnName,
} from "@/lib/kanban-columns";

// ─── Types ────────────────────────────────────────────────────────────────────

type Note = {
  id: string;
  body: string;
  image?: string | null;
  createdAt: string;
  author: { id: string; name: string | null; displayName?: string | null; image: string | null; email: string };
};

type SprintRef = {
  id: string;
  sprintId: string;
  sprint: { id: string; name: string; status: string };
};

export type GlobalCard = {
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
  updatedAt: string;
  customers: KanbanCustomer[];
  notes: Note[];
  agentExecutions: {
    id: string;
    actionType: string;
    status: string;
    createdAt: string;
    agent: {
      id: string;
      name: string;
      avatar: string | null;
      abilities: string | null;
    };
  }[];
  sprintTask: SprintRef | null;
  columnId: string;
  columnName: string;
  columnPosition: number;
  repoId: string;
  repoName: string;
  repoFullName: string;
  repoIndex: number;
  isSprintOnly: boolean;
  linkedRepoIds: string[];
  taskGroupId: string | null;
};

type RepoColumn = { id: string; name: string; position: number };
type Repo = { id: string; name: string; fullName: string; updatedAt: string; index: number; columns: RepoColumn[] };
type Sprint = { id: string; name: string; status: string; startDate: string; endDate: string };
type User = { id: string; name: string | null; displayName: string | null; email: string; image: string | null };

interface Props {
  cards: GlobalCard[];
  repos: Repo[];
  sprints: Sprint[];
  users: User[];
  customers: KanbanCustomer[];
  currentUserId: string | null;
  taskGroups?: TaskGroupData[];
}

// ─── Constants ────────────────────────────────────────────────────────────────

const COLUMN_ORDER = [...PRIMARY_KANBAN_COLUMNS];
const COMPLETED_COLUMN = DONE_COLUMN;

// True 1-to-1 mapping: group status → kanban column
const GROUP_STATUS_TO_COLUMN: Record<string, string> = {
  backlog: BACKLOG_COLUMN,
  research: ACTIVE_COLUMN,
  "in-progress": ACTIVE_COLUMN,
  "in-qa": QA_COLUMN,
  "po-review": PO_REVIEW_COLUMN,
  done: DONE_COLUMN,
  blocked: BACKLOG_COLUMN,
};

// Inverse: kanban column → group status (used on drop)
const COLUMN_TO_GROUP_STATUS: Record<string, string> = {
  [BACKLOG_COLUMN]: "backlog",
  [ACTIVE_COLUMN]: "in-progress",
  [QA_COLUMN]: "in-qa",
  [PO_REVIEW_COLUMN]: "po-review",
  [DONE_COLUMN]: "done",
};

const COLUMN_STYLE: Record<string, { accent: string; bg: string; icon: React.ReactNode }> = {
  [BACKLOG_COLUMN]: {
    accent: "#555555",
    bg: "rgba(85,85,85,0.08)",
    icon: <Circle size={13} className="text-[#555555]" />,
  },
  [ACTIVE_COLUMN]: {
    accent: "#F7941D",
    bg: "rgba(247,148,29,0.08)",
    icon: <Clock size={13} className="text-[#F7941D]" />,
  },
  [QA_COLUMN]: {
    accent: "#3B82F6",
    bg: "rgba(59,130,246,0.08)",
    icon: <FlaskConical size={13} className="text-[#3B82F6]" />,
  },
  [PO_REVIEW_COLUMN]: {
    accent: "#EAB308",
    bg: "rgba(234,179,8,0.08)",
    icon: <UserCheck size={13} className="text-[#EAB308]" />,
  },
  [DONE_COLUMN]: {
    accent: "#22C55E",
    bg: "rgba(34,197,94,0.08)",
    icon: <CheckCircle2 size={13} className="text-[#22C55E]" />,
  },
};

// Distinct palette for repo color-coding
const REPO_COLORS = [
  "#6366F1", // indigo
  "#EC4899", // pink
  "#14B8A6", // teal
  "#8B5CF6", // violet
  "#3B82F6", // blue
  "#F59E0B", // amber
  "#10B981", // emerald
  "#EF4444", // red
  "#06B6D4", // cyan
  "#A855F7", // purple
];

const GENERAL_REPO_COLOR = "#9CA3AF"; // neutral gray for General board

function getRepoColor(index: number): string {
  if (index === -2) return GENERAL_REPO_COLOR; // General board
  if (index < 0) return "#F7941D"; // sprint-only tasks use brand orange
  return REPO_COLORS[index % REPO_COLORS.length];
}

const PRIORITY_ORDER: Record<string, number> = {
  critical: 0,
  high: 1,
  medium: 2,
  low: 3,
};

const PRIORITY_COLORS: Record<string, string> = {
  critical: "#EF4444",
  high: "#F7941D",
  medium: "#FBBA00",
  low: "#6A6A6A",
};

const LIST_COLUMN_POSITION: Record<string, number> = {
  [BACKLOG_COLUMN]: 0,
  [ACTIVE_COLUMN]: 1,
  [QA_COLUMN]: 2,
  [PO_REVIEW_COLUMN]: 3,
  [DONE_COLUMN]: 4,
};

function getPriorityRank(priority: string) {
  return PRIORITY_ORDER[priority] ?? 99;
}

function parseAssigneeIds(assignees: string): string[] {
  return JSON.parse(assignees || "[]") as string[];
}

const pageIntro = {
  initial: { opacity: 0, y: 14 },
  animate: { opacity: 1, y: 0 },
};

// ─── Mini Card ────────────────────────────────────────────────────────────────

type TaskGroupRef = { id: string; name: string; status: string; color: string | null; cardIds?: string[] };

function GlobalKanbanCard({
  card,
  repos,
  users,
  onDelete,
  onDragStart,
  onDragEnd,
  availableCustomers,
  onUpdate,
  sprints,
  onSprintChange,
  currentUserId,
  compact = false,
  onReopen,
  reopening = false,
  footerAction,
  taskGroups,
  onTaskGroupChange,
  variant = "default",
}: {
  card: GlobalCard;
  repos: Repo[];
  users: User[];
  onDelete: (card: GlobalCard) => Promise<boolean | void> | boolean | void;
  onDragStart: (card: GlobalCard) => void;
  onDragEnd: () => void;
  availableCustomers: KanbanCustomer[];
  onUpdate: (cardId: string, updates: Partial<GlobalCard>) => void;
  sprints: Sprint[];
  onSprintChange: (cardId: string, sprintTask: SprintRef | null) => void;
  currentUserId: string | null;
  compact?: boolean;
  onReopen?: () => void;
  reopening?: boolean;
  footerAction?: React.ReactNode;
  taskGroups?: TaskGroupRef[];
  onTaskGroupChange?: (cardId: string, taskGroupId: string | null) => void;
  variant?: "default" | "active";
}) {
  const repoColor = getRepoColor(card.repoIndex);

  const linkedRepos = card.linkedRepoIds
    .map((repoId) => repos.find((r) => r.id === repoId))
    .filter((r): r is Repo => Boolean(r))
    .map((r) => ({ id: r.id, name: r.name, color: getRepoColor(r.index) }));

  const resolvedFooterAction = footerAction ?? (onReopen ? (
    <button
      onClick={onReopen}
      disabled={reopening || card.isSprintOnly}
      className="flex w-full items-center gap-1.5 text-[10px] font-medium text-[#707070] transition-colors hover:text-[#F7941D] disabled:opacity-40 disabled:cursor-not-allowed"
    >
      <RotateCcw size={9} className={reopening ? "animate-spin" : ""} />
      {reopening ? "Reopening…" : "Reopen Task"}
    </button>
  ) : undefined);

  return (
    <KanbanCard
      card={card}
      sprints={sprints}
      users={users}
      onDragStart={() => onDragStart(card)}
      onDragEnd={onDragEnd}
      onSprintChange={onSprintChange}
      onDelete={async () => await onDelete(card)}
      onUpdate={(cardId, updates) => onUpdate(cardId, updates as Partial<GlobalCard>)}
      columnAccent={repoColor}
      availableCustomers={availableCustomers}
      repoOptions={repos.map((repo) => ({
        id: repo.id,
        name: repo.name,
        fullName: repo.fullName,
        index: repo.index,
        columns: repo.columns,
      }))}
      repoName={card.isSprintOnly ? undefined : card.repoName}
      isSprintOnly={card.isSprintOnly}
      draggable={!card.isSprintOnly}
      currentUserId={currentUserId}
      compact={compact}
      footerAction={resolvedFooterAction}
      linkedRepos={linkedRepos}
      taskGroups={taskGroups}
      onTaskGroupChange={onTaskGroupChange}
      variant={variant}
    />
  );
}

// ─── Group Task Drawer ────────────────────────────────────────────────────────

function GroupTaskDrawer({
  open,
  onClose,
  group,
  cards,
  users,
  repos,
  sprints,
  customers,
  currentUserId,
  taskGroups,
  onCardUpdate,
  onCardDelete,
  onSprintChange,
  onTaskGroupChange,
}: {
  open: boolean;
  onClose: () => void;
  group: TaskGroupData | null;
  cards: GlobalCard[];
  users: User[];
  repos: Repo[];
  sprints: Sprint[];
  customers: KanbanCustomer[];
  currentUserId: string | null;
  taskGroups: TaskGroupRef[];
  onCardUpdate: (cardId: string, updates: Partial<GlobalCard>) => void;
  onCardDelete: (card: GlobalCard) => Promise<boolean | void>;
  onSprintChange: (cardId: string, sprintTask: SprintRef | null) => void;
  onTaskGroupChange: (cardId: string, taskGroupId: string | null) => void;
}) {
  const [selectedCardId, setSelectedCardId] = useState<string | null>(null);

  // When the drawer opens or the group changes, select the first card
  useEffect(() => {
    if (open && cards.length > 0) {
      setSelectedCardId((prev) => {
        // Keep current selection if it's still in the group
        if (prev && cards.find((c) => c.id === prev)) return prev;
        return cards[0].id;
      });
    }
  }, [open, group?.id, cards]);

  const selectedCard = cards.find((c) => c.id === selectedCardId) ?? cards[0] ?? null;

  const repoOptions = repos.map((repo) => ({
    id: repo.id,
    name: repo.name,
    fullName: repo.fullName,
    index: repo.index,
    columns: repo.columns,
  }));

  const groupTasksForPicker = cards.map((c) => ({
    id: c.id,
    title: c.title,
    columnName: c.columnName,
  }));

  return (
    <KanbanCardDrawer
      key={selectedCard?.id}
      open={open && selectedCard !== null}
      card={selectedCard}
      users={users}
      sprints={sprints}
      customers={customers}
      mode="edit"
      repoOptions={repoOptions}
      currentUserId={currentUserId}
      taskGroups={taskGroups}
      groupTasks={groupTasksForPicker}
      groupName={group?.name}
      onSwitchGroupTask={(cardId) => setSelectedCardId(cardId)}
      onClose={onClose}
      onSaved={(cardId, updates) => onCardUpdate(cardId, updates as Partial<GlobalCard>)}
      onDelete={async (card) => {
        const globalCard = cards.find((c) => c.id === card.id);
        if (!globalCard) return;
        const result = await onCardDelete(globalCard);
        if (result !== false) {
          const remaining = cards.filter((c) => c.id !== card.id);
          if (remaining.length === 0) {
            onClose();
          } else {
            setSelectedCardId(remaining[0].id);
          }
        }
      }}
      onSprintChange={onSprintChange}
      onTaskGroupChange={onTaskGroupChange}
    />
  );
}

// ─── Column ───────────────────────────────────────────────────────────────────

function KanbanColumn({
  name,
  cards,
  repos,
  users,
  isDragOver,
  onDragOver,
  onDrop,
  onDelete,
  onDragStart,
  onDragEnd,
  availableCustomers,
  onUpdate,
  sprints,
  onSprintChange,
  currentUserId,
  taskGroups,
  onTaskGroupChange,
  taskGroupEntries = [],
  onOpenGroup,
  onGroupDragStart,
  onGroupDragEnd,
}: {
  name: string;
  cards: GlobalCard[];
  repos: Repo[];
  users: User[];
  isDragOver: boolean;
  onDragOver: (event: React.DragEvent<HTMLDivElement>) => void;
  onDrop: (event: React.DragEvent<HTMLDivElement>) => void;
  onDelete: (card: GlobalCard) => Promise<boolean | void> | boolean | void;
  onDragStart: (card: GlobalCard) => void;
  onDragEnd: () => void;
  availableCustomers: KanbanCustomer[];
  onUpdate: (cardId: string, updates: Partial<GlobalCard>) => void;
  sprints: Sprint[];
  onSprintChange: (cardId: string, sprintTask: SprintRef | null) => void;
  currentUserId: string | null;
  taskGroups?: TaskGroupRef[];
  onTaskGroupChange?: (cardId: string, taskGroupId: string | null) => void;
  taskGroupEntries?: Array<{ group: TaskGroupData; cards: GlobalCard[] }>;
  onOpenGroup?: (groupId: string) => void;
  onGroupDragStart?: (groupId: string) => void;
  onGroupDragEnd?: () => void;
}) {
  const style = COLUMN_STYLE[name] ?? { accent: "#555555", bg: "rgba(85,85,85,0.08)", icon: null };
  const totalCount = cards.length + taskGroupEntries.length;

  return (
    <div
      className={cn(
        "w-[84vw] flex-shrink-0 snap-center sm:w-full sm:min-w-0",
        name === ACTIVE_COLUMN ? "max-w-[860px] sm:max-w-none sm:flex-[2.8]" : "max-w-[340px] sm:flex-[1.15]"
      )}
      onDragOver={onDragOver}
      onDrop={onDrop}
    >
      <div
        className="flex max-h-[calc(100vh-330px)] flex-col overflow-hidden rounded-2xl border transition-colors sm:max-h-[calc(100vh-240px)]"
        style={{
          borderColor: isDragOver ? style.accent : "rgba(255,255,255,0.06)",
        }}
      >
        {/* Column header */}
        <div
          className="px-4 py-3 flex items-center justify-between flex-shrink-0 sticky top-0 z-10"
          style={{ backgroundColor: style.bg }}
        >
          <div className="flex items-center gap-2">
            {style.icon}
            <span className="text-sm font-bold text-[#F0F0F0]">{name}</span>
            <span
              className="text-xs px-2 py-0.5 rounded-full font-semibold tabular-nums"
              style={{ color: style.accent, backgroundColor: `${style.accent}20` }}
            >
              {totalCount}
            </span>
          </div>
        </div>

        {/* Cards list */}
        <div className="flex-1 overflow-y-auto p-2 space-y-2 bg-[#111111]">
          {/* Task group cards — rendered first so they stand out */}
          <AnimatePresence initial={false}>
            {taskGroupEntries.map(({ group, cards: groupCards }) => (
              <TaskGroupKanbanCard
                key={`group-${group.id}`}
                group={group}
                cards={groupCards}
                users={users}
                onClick={() => onOpenGroup?.(group.id)}
                onDragStart={() => onGroupDragStart?.(group.id)}
                onDragEnd={onGroupDragEnd}
              />
            ))}
          </AnimatePresence>

          {/* Regular task cards */}
          <AnimatePresence initial={false}>
            {cards.map((card) => (
              <GlobalKanbanCard
                key={card.id}
                card={card}
                repos={repos}
                users={users}
                onDelete={onDelete}
                onDragStart={onDragStart}
                onDragEnd={onDragEnd}
                availableCustomers={availableCustomers}
                onUpdate={onUpdate}
                sprints={sprints}
                onSprintChange={onSprintChange}
                currentUserId={currentUserId}
                compact={name === COMPLETED_COLUMN}
                variant={name === ACTIVE_COLUMN ? "active" : "default"}
                taskGroups={taskGroups}
                onTaskGroupChange={onTaskGroupChange}
              />
            ))}
          </AnimatePresence>

          {cards.length === 0 && taskGroupEntries.length === 0 && !isDragOver && (
            <div className="h-20 flex items-center justify-center rounded-xl border border-dashed border-[rgba(255,255,255,0.04)] text-xs text-[#303030]">
              No tasks
            </div>
          )}

          {isDragOver && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="h-20 flex items-center justify-center rounded-xl border-2 border-dashed text-xs font-medium"
              style={{ borderColor: style.accent, color: style.accent, backgroundColor: style.bg }}
            >
              Drop to move here
            </motion.div>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Done Drop Zone ────────────────────────────────────────────────────────────

function QaDropZone({
  cardCount,
  isDragOver,
  isDraggingActive,
  onDragOver,
  onDrop,
  onDragLeave,
  onClick,
}: {
  cardCount: number;
  isDragOver: boolean;
  isDraggingActive: boolean;
  onDragOver: (event: React.DragEvent<HTMLDivElement>) => void;
  onDrop: (event: React.DragEvent<HTMLDivElement>) => void;
  onDragLeave: () => void;
  onClick: () => void;
}) {
  const accent = "#3B82F6";

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={onClick}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") onClick();
      }}
      onDragOver={onDragOver}
      onDrop={onDrop}
      onDragLeave={onDragLeave}
      className={cn(
        "group relative overflow-hidden flex flex-col items-center justify-between rounded-2xl transition-all duration-300 cursor-pointer select-none py-3",
        "w-[84vw] max-w-[340px] min-h-[110px] sm:w-full sm:max-w-none",
        "max-h-[calc(100vh-330px)] sm:max-h-[calc(100vh-240px)]",
        isDragOver || isDraggingActive ? "border-2 border-dashed" : "border border-solid"
      )}
      style={{
        borderColor: isDragOver ? accent : isDraggingActive ? `${accent}66` : `${accent}22`,
        background: isDragOver
          ? `linear-gradient(160deg, ${accent}18 0%, rgba(14,18,28,0.98) 100%)`
          : isDraggingActive
            ? `linear-gradient(160deg, ${accent}0e 0%, rgba(12,14,22,0.98) 100%)`
            : "linear-gradient(160deg, rgba(59,130,246,0.07) 0%, rgba(10,12,20,0.98) 100%)",
        boxShadow: isDragOver
          ? `0 0 40px ${accent}28, inset 0 1px 0 ${accent}30`
          : isDraggingActive
            ? `0 0 20px ${accent}14`
            : `inset 0 1px 0 ${accent}14`,
      }}
    >
      {/* Ambient glow orb — sits behind icon */}
      <div
        className="pointer-events-none absolute top-0 left-1/2 -translate-x-1/2 h-36 w-36 rounded-full blur-3xl transition-opacity duration-300"
        style={{ backgroundColor: accent, opacity: isDragOver ? 0.16 : isDraggingActive ? 0.09 : 0.05 }}
      />

      {/* Top accent line */}
      <div
        className="absolute inset-x-0 top-0 h-px transition-opacity duration-300"
        style={{
          background: `linear-gradient(90deg, transparent, ${accent}${isDragOver ? "cc" : isDraggingActive ? "77" : "44"}, transparent)`,
        }}
      />

      {/* Icon + label + badge */}
      <div className="relative flex flex-col items-center gap-2">
        <div
          className="flex h-10 w-10 items-center justify-center rounded-xl border transition-all duration-300"
          style={{
            borderColor: isDragOver ? `${accent}99` : `${accent}33`,
            backgroundColor: isDragOver ? `${accent}28` : `${accent}12`,
            boxShadow: isDragOver ? `0 0 24px ${accent}44, inset 0 1px 0 ${accent}33` : `inset 0 1px 0 ${accent}18`,
          }}
        >
          <FlaskConical size={17} style={{ color: isDragOver ? accent : isDraggingActive ? `${accent}dd` : `${accent}99` }} />
        </div>

        <div className="flex flex-col items-center gap-1.5">
          <span className="text-sm font-bold tracking-tight text-[#E8E8E8]">QA Testing</span>
          <span
            className="px-3 py-0.5 rounded-full text-xs font-bold tabular-nums transition-all duration-300"
            style={{
              color: accent,
              backgroundColor: isDragOver ? `${accent}30` : `${accent}18`,
              boxShadow: isDragOver ? `0 0 10px ${accent}44` : undefined,
            }}
          >
            {cardCount}
          </span>
        </div>
      </div>

      {/* Footer hint */}
      <AnimatePresence mode="wait">
        {isDragOver ? (
          <motion.div
            key="release"
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className="relative flex items-center gap-1.5 rounded-lg px-3 py-1"
            style={{ backgroundColor: `${accent}18` }}
          >
            <span className="text-xs font-semibold" style={{ color: accent }}>Release for QA</span>
          </motion.div>
        ) : isDraggingActive ? (
          <motion.p
            key="drop"
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className="relative text-xs font-medium"
            style={{ color: `${accent}77` }}
          >
            Drop for QA
          </motion.p>
        ) : (
          <motion.p
            key="click"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="relative text-xs text-[#404040] transition-colors duration-200 group-hover:text-[#606060]"
          >
            Click to view
          </motion.p>
        )}
      </AnimatePresence>
    </div>
  );
}

function DoneDropZone({
  cardCount,
  isDragOver,
  isDraggingActive,
  onDragOver,
  onDrop,
  onDragLeave,
  onClick,
}: {
  cardCount: number;
  isDragOver: boolean;
  isDraggingActive: boolean;
  onDragOver: (event: React.DragEvent<HTMLDivElement>) => void;
  onDrop: (event: React.DragEvent<HTMLDivElement>) => void;
  onDragLeave: () => void;
  onClick: () => void;
}) {
  const accent = "#22C55E";

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={onClick}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") onClick();
      }}
      onDragOver={onDragOver}
      onDrop={onDrop}
      onDragLeave={onDragLeave}
      className={cn(
        "group relative overflow-hidden flex flex-col items-center justify-between rounded-2xl transition-all duration-300 cursor-pointer select-none py-3",
        "w-[84vw] max-w-[340px] min-h-[110px] sm:w-full sm:max-w-none",
        "max-h-[calc(100vh-330px)] sm:max-h-[calc(100vh-240px)]",
        isDragOver || isDraggingActive ? "border-2 border-dashed" : "border border-solid"
      )}
      style={{
        borderColor: isDragOver ? accent : isDraggingActive ? `${accent}66` : `${accent}22`,
        background: isDragOver
          ? `linear-gradient(160deg, ${accent}18 0%, rgba(10,20,14,0.98) 100%)`
          : isDraggingActive
            ? `linear-gradient(160deg, ${accent}0e 0%, rgba(10,16,12,0.98) 100%)`
            : "linear-gradient(160deg, rgba(34,197,94,0.07) 0%, rgba(10,14,11,0.98) 100%)",
        boxShadow: isDragOver
          ? `0 0 40px ${accent}28, inset 0 1px 0 ${accent}30`
          : isDraggingActive
            ? `0 0 20px ${accent}14`
            : `inset 0 1px 0 ${accent}14`,
      }}
    >
      {/* Ambient glow orb — sits behind icon */}
      <div
        className="pointer-events-none absolute top-0 left-1/2 -translate-x-1/2 h-36 w-36 rounded-full blur-3xl transition-opacity duration-300"
        style={{ backgroundColor: accent, opacity: isDragOver ? 0.18 : isDraggingActive ? 0.11 : 0.06 }}
      />

      {/* Top accent line */}
      <div
        className="absolute inset-x-0 top-0 h-px transition-opacity duration-300"
        style={{
          background: `linear-gradient(90deg, transparent, ${accent}${isDragOver ? "cc" : isDraggingActive ? "77" : "44"}, transparent)`,
        }}
      />

      {/* Icon + label + badge */}
      <div className="relative flex flex-col items-center gap-2">
        <div
          className="flex h-10 w-10 items-center justify-center rounded-xl border transition-all duration-300"
          style={{
            borderColor: isDragOver ? `${accent}99` : `${accent}33`,
            backgroundColor: isDragOver ? `${accent}28` : `${accent}12`,
            boxShadow: isDragOver ? `0 0 24px ${accent}44, inset 0 1px 0 ${accent}33` : `inset 0 1px 0 ${accent}18`,
          }}
        >
          <CheckCircle2 size={17} style={{ color: isDragOver ? accent : isDraggingActive ? `${accent}dd` : `${accent}99` }} />
        </div>

        <div className="flex flex-col items-center gap-2">
          <span className="text-base font-bold tracking-tight text-[#E8E8E8]">Done</span>
          <span
            className="px-3 py-0.5 rounded-full text-xs font-bold tabular-nums transition-all duration-300"
            style={{
              color: accent,
              backgroundColor: isDragOver ? `${accent}30` : `${accent}18`,
              boxShadow: isDragOver ? `0 0 10px ${accent}44` : undefined,
            }}
          >
            {cardCount}
          </span>
        </div>
      </div>

      {/* Footer hint */}
      <AnimatePresence mode="wait">
        {isDragOver ? (
          <motion.div
            key="release"
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className="relative flex items-center gap-1.5 rounded-lg px-3 py-1"
            style={{ backgroundColor: `${accent}18` }}
          >
            <span className="text-xs font-semibold" style={{ color: accent }}>Release to complete</span>
          </motion.div>
        ) : isDraggingActive ? (
          <motion.p
            key="drop"
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className="relative text-xs font-medium"
            style={{ color: `${accent}77` }}
          >
            Drop to complete
          </motion.p>
        ) : (
          <motion.p
            key="click"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="relative text-xs text-[#404040] transition-colors duration-200 group-hover:text-[#606060]"
          >
            Click to view
          </motion.p>
        )}
      </AnimatePresence>
    </div>
  );
}

// ─── PO Review Drop Zone ──────────────────────────────────────────────────────

function PoReviewDropZone({
  cardCount,
  isDragOver,
  isDraggingActive,
  onDragOver,
  onDrop,
  onDragLeave,
  onClick,
}: {
  cardCount: number;
  isDragOver: boolean;
  isDraggingActive: boolean;
  onDragOver: (event: React.DragEvent<HTMLDivElement>) => void;
  onDrop: (event: React.DragEvent<HTMLDivElement>) => void;
  onDragLeave: () => void;
  onClick: () => void;
}) {
  const accent = "#EAB308";

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={onClick}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") onClick();
      }}
      onDragOver={onDragOver}
      onDrop={onDrop}
      onDragLeave={onDragLeave}
      className={cn(
        "group relative overflow-hidden flex flex-col items-center justify-between rounded-2xl transition-all duration-300 cursor-pointer select-none py-3",
        "w-[84vw] max-w-[340px] min-h-[110px] sm:w-full sm:max-w-none",
        "max-h-[calc(100vh-330px)] sm:max-h-[calc(100vh-240px)]",
        isDragOver || isDraggingActive ? "border-2 border-dashed" : "border border-solid"
      )}
      style={{
        borderColor: isDragOver ? accent : isDraggingActive ? `${accent}66` : `${accent}22`,
        background: isDragOver
          ? `linear-gradient(160deg, ${accent}18 0%, rgba(20,18,10,0.98) 100%)`
          : isDraggingActive
            ? `linear-gradient(160deg, ${accent}0e 0%, rgba(16,14,8,0.98) 100%)`
            : "linear-gradient(160deg, rgba(234,179,8,0.07) 0%, rgba(12,12,10,0.98) 100%)",
        boxShadow: isDragOver
          ? `0 0 40px ${accent}28, inset 0 1px 0 ${accent}30`
          : isDraggingActive
            ? `0 0 20px ${accent}14`
            : `inset 0 1px 0 ${accent}14`,
      }}
    >
      {/* Ambient glow orb */}
      <div
        className="pointer-events-none absolute top-0 left-1/2 -translate-x-1/2 h-36 w-36 rounded-full blur-3xl transition-opacity duration-300"
        style={{ backgroundColor: accent, opacity: isDragOver ? 0.16 : isDraggingActive ? 0.09 : 0.05 }}
      />

      {/* Top accent line */}
      <div
        className="absolute inset-x-0 top-0 h-px transition-opacity duration-300"
        style={{
          background: `linear-gradient(90deg, transparent, ${accent}${isDragOver ? "cc" : isDraggingActive ? "77" : "44"}, transparent)`,
        }}
      />

      {/* Icon + label + badge */}
      <div className="relative flex flex-col items-center gap-2">
        <div
          className="flex h-10 w-10 items-center justify-center rounded-xl border transition-all duration-300"
          style={{
            borderColor: isDragOver ? `${accent}99` : `${accent}33`,
            backgroundColor: isDragOver ? `${accent}28` : `${accent}12`,
            boxShadow: isDragOver ? `0 0 24px ${accent}44, inset 0 1px 0 ${accent}33` : `inset 0 1px 0 ${accent}18`,
          }}
        >
          <UserCheck size={17} style={{ color: isDragOver ? accent : isDraggingActive ? `${accent}dd` : `${accent}99` }} />
        </div>

        <div className="flex flex-col items-center gap-1.5">
          <span className="text-sm font-bold tracking-tight text-[#E8E8E8]">PO Review</span>
          <span
            className="px-3 py-0.5 rounded-full text-xs font-bold tabular-nums transition-all duration-300"
            style={{
              color: accent,
              backgroundColor: isDragOver ? `${accent}30` : `${accent}18`,
              boxShadow: isDragOver ? `0 0 10px ${accent}44` : undefined,
            }}
          >
            {cardCount}
          </span>
        </div>
      </div>

      {/* Footer hint */}
      <AnimatePresence mode="wait">
        {isDragOver ? (
          <motion.div
            key="release"
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className="relative flex items-center gap-1.5 rounded-lg px-3 py-1"
            style={{ backgroundColor: `${accent}18` }}
          >
            <span className="text-xs font-semibold" style={{ color: accent }}>Send to PO Review</span>
          </motion.div>
        ) : isDraggingActive ? (
          <motion.p
            key="drop"
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className="relative text-xs font-medium"
            style={{ color: `${accent}77` }}
          >
            Drop for PO Review
          </motion.p>
        ) : (
          <motion.p
            key="click"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="relative text-xs text-[#404040] transition-colors duration-200 group-hover:text-[#606060]"
          >
            Click to view
          </motion.p>
        )}
      </AnimatePresence>
    </div>
  );
}

// ─── QA Tasks Drawer ──────────────────────────────────────────────────────────

function QaTasksDrawer({
  open,
  onClose,
  cards,
  repos,
  users,
  onDelete,
  onDragStart,
  onDragEnd,
  availableCustomers,
  onUpdate,
  sprints,
  onSprintChange,
  currentUserId,
  onReject,
  onMoveToPo,
  onComplete,
  actioningCardId,
  actioningCardAction,
  taskGroupEntries = [],
  onOpenGroup,
}: {
  open: boolean;
  onClose: () => void;
  cards: GlobalCard[];
  repos: Repo[];
  users: User[];
  onDelete: (card: GlobalCard) => Promise<boolean | void> | boolean | void;
  onDragStart: (card: GlobalCard) => void;
  onDragEnd: () => void;
  availableCustomers: KanbanCustomer[];
  onUpdate: (cardId: string, updates: Partial<GlobalCard>) => void;
  sprints: Sprint[];
  onSprintChange: (cardId: string, sprintTask: SprintRef | null) => void;
  currentUserId: string | null;
  onReject: (card: GlobalCard) => Promise<void>;
  onMoveToPo: (card: GlobalCard) => Promise<void>;
  onComplete: (card: GlobalCard) => Promise<void>;
  actioningCardId: string | null;
  actioningCardAction: "reject" | "po-review" | "complete" | null;
  taskGroupEntries?: Array<{ group: TaskGroupData; cards: GlobalCard[] }>;
  onOpenGroup?: (groupId: string) => void;
}) {
  if (typeof window === "undefined") return null;

  const totalCount = cards.length + taskGroupEntries.length;

  return createPortal(
    <AnimatePresence>
      {open && (
        <>
          <motion.div
            key="qa-backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.22 }}
            className="fixed inset-0 z-40 bg-black/40 backdrop-blur-[2px]"
            onClick={onClose}
          />

          <motion.div
            key="qa-drawer"
            initial={{ x: "100%" }}
            animate={{ x: 0 }}
            exit={{ x: "100%" }}
            transition={{ type: "spring", damping: 30, stiffness: 300 }}
            className="fixed right-0 top-0 z-50 flex h-full w-full max-w-sm flex-col border-l border-[rgba(255,255,255,0.07)] bg-[#111111] shadow-2xl sm:max-w-md"
          >
            <div className="flex flex-shrink-0 items-center justify-between border-b border-[rgba(255,255,255,0.06)] px-5 py-4">
              <div className="flex items-center gap-2.5">
                <div className="flex h-8 w-8 items-center justify-center rounded-xl border border-[rgba(59,130,246,0.22)] bg-[rgba(59,130,246,0.12)]">
                  <FlaskConical size={15} className="text-[#3B82F6]" />
                </div>
                <div>
                  <h2 className="text-sm font-bold text-[#F0F0F0]">QA Testing</h2>
                  <p className="text-[11px] text-[#555555]">{totalCount} item{totalCount !== 1 ? "s" : ""}</p>
                </div>
              </div>
              <button
                onClick={onClose}
                className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-[#555555] transition-colors hover:bg-[rgba(255,255,255,0.05)] hover:text-[#F0F0F0]"
                aria-label="Close"
              >
                <X size={16} />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-3 space-y-2">
              {/* Task groups in QA */}
              {taskGroupEntries.map(({ group, cards: groupCards }) => (
                <TaskGroupKanbanCard
                  key={`group-${group.id}`}
                  group={group}
                  cards={groupCards}
                  users={users}
                  draggable={false}
                  onClick={() => onOpenGroup?.(group.id)}
                />
              ))}

              {/* Divider if both groups and tasks */}
              {taskGroupEntries.length > 0 && cards.length > 0 && (
                <div className="flex items-center gap-2 py-1">
                  <div className="h-px flex-1 bg-[rgba(255,255,255,0.05)]" />
                  <span className="text-[10px] text-[#404040]">Tasks</span>
                  <div className="h-px flex-1 bg-[rgba(255,255,255,0.05)]" />
                </div>
              )}

              {cards.length === 0 && taskGroupEntries.length === 0 ? (
                <div className="flex h-40 flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-[rgba(255,255,255,0.06)] text-[#333333]">
                  <FlaskConical size={24} className="text-[rgba(59,130,246,0.55)]" />
                  <p className="text-xs">No QA items</p>
                </div>
              ) : (
                <AnimatePresence initial={false}>
                  {cards.map((card) => {
                    const isActioning = actioningCardId === card.id;
                    const isRejecting = isActioning && actioningCardAction === "reject";
                    const isMovingToPo = isActioning && actioningCardAction === "po-review";
                    const isCompleting = isActioning && actioningCardAction === "complete";
                    return (
                      <GlobalKanbanCard
                        key={card.id}
                        card={card}
                        repos={repos}
                        users={users}
                        onDelete={onDelete}
                        onDragStart={onDragStart}
                        onDragEnd={onDragEnd}
                        availableCustomers={availableCustomers}
                        onUpdate={onUpdate}
                        sprints={sprints}
                        onSprintChange={onSprintChange}
                        currentUserId={currentUserId}
                        compact
                        footerAction={
                          <div className="flex items-center gap-1.5">
                            <button
                              onClick={() => void onReject(card)}
                              disabled={isActioning || card.isSprintOnly}
                              className="flex flex-1 items-center justify-center gap-1.5 rounded-md py-0.5 text-[10px] font-medium text-[#F87171] transition-colors hover:bg-[rgba(248,113,113,0.1)] disabled:opacity-40 disabled:cursor-not-allowed"
                            >
                              <X size={9} className={isRejecting ? "animate-spin" : ""} />
                              {isRejecting ? "Moving…" : "Reject"}
                            </button>
                            <div className="h-3 w-px bg-[rgba(255,255,255,0.08)]" />
                            <button
                              onClick={() => void onMoveToPo(card)}
                              disabled={isActioning || card.isSprintOnly}
                              className="flex flex-1 items-center justify-center gap-1.5 rounded-md py-0.5 text-[10px] font-medium text-[#FDE047] transition-colors hover:bg-[rgba(234,179,8,0.1)] disabled:opacity-40 disabled:cursor-not-allowed"
                            >
                              <UserCheck size={9} className={isMovingToPo ? "animate-spin" : ""} />
                              {isMovingToPo ? "Moving…" : "PO Review"}
                            </button>
                            <div className="h-3 w-px bg-[rgba(255,255,255,0.08)]" />
                            <button
                              onClick={() => void onComplete(card)}
                              disabled={isActioning || card.isSprintOnly}
                              className="flex flex-1 items-center justify-center gap-1.5 rounded-md py-0.5 text-[10px] font-medium text-[#4ADE80] transition-colors hover:bg-[rgba(74,222,128,0.1)] disabled:opacity-40 disabled:cursor-not-allowed"
                            >
                              <CheckCircle2 size={9} className={isCompleting ? "animate-spin" : ""} />
                              {isCompleting ? "Moving…" : "Complete"}
                            </button>
                          </div>
                        }
                      />
                    );
                  })}
                </AnimatePresence>
              )}
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>,
    document.body
  );
}

// ─── PO Review Tasks Drawer ───────────────────────────────────────────────────

function PoReviewTasksDrawer({
  open,
  onClose,
  cards,
  repos,
  users,
  onDelete,
  onDragStart,
  onDragEnd,
  availableCustomers,
  onUpdate,
  sprints,
  onSprintChange,
  currentUserId,
  onReject,
  onComplete,
  actioningCardId,
  actioningCardAction,
  taskGroupEntries = [],
  onOpenGroup,
}: {
  open: boolean;
  onClose: () => void;
  cards: GlobalCard[];
  repos: Repo[];
  users: User[];
  onDelete: (card: GlobalCard) => Promise<boolean | void> | boolean | void;
  onDragStart: (card: GlobalCard) => void;
  onDragEnd: () => void;
  availableCustomers: KanbanCustomer[];
  onUpdate: (cardId: string, updates: Partial<GlobalCard>) => void;
  sprints: Sprint[];
  onSprintChange: (cardId: string, sprintTask: SprintRef | null) => void;
  currentUserId: string | null;
  onReject: (card: GlobalCard) => Promise<void>;
  onComplete: (card: GlobalCard) => Promise<void>;
  actioningCardId: string | null;
  actioningCardAction: "reject" | "complete" | null;
  taskGroupEntries?: Array<{ group: TaskGroupData; cards: GlobalCard[] }>;
  onOpenGroup?: (groupId: string) => void;
}) {
  if (typeof window === "undefined") return null;

  const accent = "#EAB308";
  const totalCount = cards.length + taskGroupEntries.length;

  return createPortal(
    <AnimatePresence>
      {open && (
        <>
          <motion.div
            key="po-backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.22 }}
            className="fixed inset-0 z-40 bg-black/40 backdrop-blur-[2px]"
            onClick={onClose}
          />

          <motion.div
            key="po-drawer"
            initial={{ x: "100%" }}
            animate={{ x: 0 }}
            exit={{ x: "100%" }}
            transition={{ type: "spring", damping: 30, stiffness: 300 }}
            className="fixed right-0 top-0 z-50 flex h-full w-full max-w-sm flex-col border-l border-[rgba(255,255,255,0.07)] bg-[#111111] shadow-2xl sm:max-w-md"
          >
            <div className="flex flex-shrink-0 items-center justify-between border-b border-[rgba(255,255,255,0.06)] px-5 py-4">
              <div className="flex items-center gap-2.5">
                <div
                  className="flex h-8 w-8 items-center justify-center rounded-xl border"
                  style={{ borderColor: `rgba(234,179,8,0.22)`, backgroundColor: `rgba(234,179,8,0.12)` }}
                >
                  <UserCheck size={15} style={{ color: accent }} />
                </div>
                <div>
                  <h2 className="text-sm font-bold text-[#F0F0F0]">PO Review</h2>
                  <p className="text-[11px] text-[#555555]">{totalCount} item{totalCount !== 1 ? "s" : ""}</p>
                </div>
              </div>
              <button
                onClick={onClose}
                className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-[#555555] transition-colors hover:bg-[rgba(255,255,255,0.05)] hover:text-[#F0F0F0]"
                aria-label="Close"
              >
                <X size={16} />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-3 space-y-2">
              {/* Task groups in PO Review */}
              {taskGroupEntries.map(({ group, cards: groupCards }) => (
                <TaskGroupKanbanCard
                  key={`group-${group.id}`}
                  group={group}
                  cards={groupCards}
                  users={users}
                  draggable={false}
                  onClick={() => onOpenGroup?.(group.id)}
                />
              ))}

              {taskGroupEntries.length > 0 && cards.length > 0 && (
                <div className="flex items-center gap-2 py-1">
                  <div className="h-px flex-1 bg-[rgba(255,255,255,0.05)]" />
                  <span className="text-[10px] text-[#404040]">Tasks</span>
                  <div className="h-px flex-1 bg-[rgba(255,255,255,0.05)]" />
                </div>
              )}

              {cards.length === 0 && taskGroupEntries.length === 0 ? (
                <div className="flex h-40 flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-[rgba(255,255,255,0.06)] text-[#333333]">
                  <UserCheck size={24} style={{ color: `rgba(234,179,8,0.55)` }} />
                  <p className="text-xs">No PO Review items</p>
                </div>
              ) : (
                <AnimatePresence initial={false}>
                  {cards.map((card) => {
                    const isActioning = actioningCardId === card.id;
                    const isRejecting = isActioning && actioningCardAction === "reject";
                    const isCompleting = isActioning && actioningCardAction === "complete";
                    return (
                      <GlobalKanbanCard
                        key={card.id}
                        card={card}
                        repos={repos}
                        users={users}
                        onDelete={onDelete}
                        onDragStart={onDragStart}
                        onDragEnd={onDragEnd}
                        availableCustomers={availableCustomers}
                        onUpdate={onUpdate}
                        sprints={sprints}
                        onSprintChange={onSprintChange}
                        currentUserId={currentUserId}
                        compact
                        footerAction={
                          <div className="flex items-center gap-1.5">
                            <button
                              onClick={() => void onReject(card)}
                              disabled={isActioning || card.isSprintOnly}
                              className="flex flex-1 items-center justify-center gap-1.5 rounded-md py-0.5 text-[10px] font-medium text-[#F87171] transition-colors hover:bg-[rgba(248,113,113,0.1)] disabled:opacity-40 disabled:cursor-not-allowed"
                            >
                              <X size={9} className={isRejecting ? "animate-spin" : ""} />
                              {isRejecting ? "Moving…" : "Reject"}
                            </button>
                            <div className="h-3 w-px bg-[rgba(255,255,255,0.08)]" />
                            <button
                              onClick={() => void onComplete(card)}
                              disabled={isActioning || card.isSprintOnly}
                              className="flex flex-1 items-center justify-center gap-1.5 rounded-md py-0.5 text-[10px] font-medium text-[#4ADE80] transition-colors hover:bg-[rgba(74,222,128,0.1)] disabled:opacity-40 disabled:cursor-not-allowed"
                            >
                              <CheckCircle2 size={9} className={isCompleting ? "animate-spin" : ""} />
                              {isCompleting ? "Moving…" : "Complete"}
                            </button>
                          </div>
                        }
                      />
                    );
                  })}
                </AnimatePresence>
              )}
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>,
    document.body
  );
}

// ─── Completed Tasks Drawer ────────────────────────────────────────────────────

const REOPEN_COLUMNS: { name: string; accent: string; icon: React.ReactNode }[] = [
  { name: ACTIVE_COLUMN, accent: "#F7941D", icon: <Clock size={11} /> },
  { name: PO_REVIEW_COLUMN, accent: "#EAB308", icon: <UserCheck size={11} /> },
  { name: QA_COLUMN, accent: "#3B82F6", icon: <FlaskConical size={11} /> },
  { name: BACKLOG_COLUMN, accent: "#555555", icon: <Circle size={11} /> },
];

function CompletedTasksDrawer({
  open,
  onClose,
  cards,
  repos,
  users,
  onDelete,
  onDragStart,
  onDragEnd,
  availableCustomers,
  onUpdate,
  onReopen,
  reopeningCardId,
  sprints,
  onSprintChange,
  currentUserId,
  taskGroupEntries = [],
  onOpenGroup,
}: {
  open: boolean;
  onClose: () => void;
  cards: GlobalCard[];
  repos: Repo[];
  users: User[];
  onDelete: (card: GlobalCard) => Promise<boolean | void> | boolean | void;
  onDragStart: (card: GlobalCard) => void;
  onDragEnd: () => void;
  availableCustomers: KanbanCustomer[];
  onUpdate: (cardId: string, updates: Partial<GlobalCard>) => void;
  onReopen: (card: GlobalCard, targetColumn: string) => Promise<void>;
  reopeningCardId: string | null;
  sprints: Sprint[];
  onSprintChange: (cardId: string, sprintTask: SprintRef | null) => void;
  currentUserId: string | null;
  taskGroupEntries?: Array<{ group: TaskGroupData; cards: GlobalCard[] }>;
  onOpenGroup?: (groupId: string) => void;
}) {
  const [search, setSearch] = useState("");
  const [pickerCardId, setPickerCardId] = useState<string | null>(null);

  const sortedCards = useMemo(
    () => [...cards].sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()),
    [cards]
  );

  const filteredCards = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return sortedCards;
    return sortedCards.filter((card) =>
      [card.title, card.body, card.repoName].filter(Boolean).join(" ").toLowerCase().includes(q)
    );
  }, [sortedCards, search]);

  if (typeof window === "undefined") return null;

  return createPortal(
    <AnimatePresence>
      {open && (
        <>
          {/* Backdrop */}
          <motion.div
            key="completed-backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.22 }}
            className="fixed inset-0 z-40 bg-black/40 backdrop-blur-[2px]"
            onClick={onClose}
          />

          {/* Drawer panel */}
          <motion.div
            key="completed-drawer"
            initial={{ x: "100%" }}
            animate={{ x: 0 }}
            exit={{ x: "100%" }}
            transition={{ type: "spring", damping: 30, stiffness: 300 }}
            className="fixed right-0 top-0 z-50 flex h-full w-full max-w-sm flex-col border-l border-[rgba(255,255,255,0.07)] bg-[#111111] shadow-2xl sm:max-w-md"
          >
            {/* Header */}
            <div className="flex flex-shrink-0 items-center justify-between border-b border-[rgba(255,255,255,0.06)] px-5 py-4">
              <div className="flex items-center gap-2.5">
                <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-[rgba(34,197,94,0.12)] border border-[rgba(34,197,94,0.2)]">
                  <CheckCircle2 size={15} className="text-[#22C55E]" />
                </div>
                <div>
                  <h2 className="text-sm font-bold text-[#F0F0F0]">Completed Tasks</h2>
                  <p className="text-[11px] text-[#555555]">
                    {filteredCards.length !== cards.length
                      ? `${filteredCards.length} of ${cards.length}`
                      : `${cards.length} task${cards.length !== 1 ? "s" : ""}`}
                  </p>
                </div>
              </div>
              <button
                onClick={onClose}
                className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-[#555555] transition-colors hover:bg-[rgba(255,255,255,0.05)] hover:text-[#F0F0F0]"
                aria-label="Close"
              >
                <X size={16} />
              </button>
            </div>

            {/* Search bar */}
            <div className="flex-shrink-0 px-3 pt-3 pb-1">
              <div className="flex items-center gap-2 rounded-lg border border-[rgba(255,255,255,0.07)] bg-[rgba(255,255,255,0.03)] px-3 py-2 focus-within:border-[rgba(34,197,94,0.3)] transition-colors">
                <Search size={13} className="shrink-0 text-[#444444]" />
                <input
                  type="text"
                  placeholder="Search completed tasks…"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="w-full bg-transparent text-xs text-[#D0D0D0] placeholder:text-[#444444] outline-none"
                />
                {search && (
                  <button onClick={() => setSearch("")} className="shrink-0 text-[#555555] hover:text-[#888888]">
                    <X size={11} />
                  </button>
                )}
              </div>
            </div>

            {/* Cards list */}
            <div className="flex-1 overflow-y-auto p-3 space-y-2">
              {/* Done task groups */}
              {taskGroupEntries.map(({ group, cards: groupCards }) => (
                <TaskGroupKanbanCard
                  key={`group-${group.id}`}
                  group={group}
                  cards={groupCards}
                  users={users}
                  draggable={false}
                  onClick={() => onOpenGroup?.(group.id)}
                />
              ))}

              {taskGroupEntries.length > 0 && (filteredCards.length > 0 || cards.length > 0) && (
                <div className="flex items-center gap-2 py-1">
                  <div className="h-px flex-1 bg-[rgba(255,255,255,0.05)]" />
                  <span className="text-[10px] text-[#404040]">Tasks</span>
                  <div className="h-px flex-1 bg-[rgba(255,255,255,0.05)]" />
                </div>
              )}

              {filteredCards.length === 0 && taskGroupEntries.length === 0 ? (
                <div className="flex h-40 flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-[rgba(255,255,255,0.06)] text-[#333333]">
                  <CheckCircle2 size={24} />
                  <p className="text-xs">{search ? "No matching tasks" : "No completed items"}</p>
                </div>
              ) : filteredCards.length === 0 && taskGroupEntries.length > 0 ? null : (
                <AnimatePresence initial={false}>
                  {filteredCards.map((card) => {
                    const isReopening = reopeningCardId === card.id;
                    const pickerOpen = pickerCardId === card.id;

                    return (
                      <GlobalKanbanCard
                        key={card.id}
                        card={card}
                        repos={repos}
                        users={users}
                        onDelete={onDelete}
                        onDragStart={onDragStart}
                        onDragEnd={onDragEnd}
                        availableCustomers={availableCustomers}
                        onUpdate={onUpdate}
                        sprints={sprints}
                        onSprintChange={onSprintChange}
                        currentUserId={currentUserId}
                        compact
                        footerAction={
                          <div>
                            {!pickerOpen ? (
                              <button
                                onClick={() => setPickerCardId(card.id)}
                                disabled={isReopening || card.isSprintOnly}
                                className="flex w-full items-center gap-1.5 text-[10px] font-medium text-[#707070] transition-colors hover:text-[#F7941D] disabled:opacity-40 disabled:cursor-not-allowed"
                              >
                                <RotateCcw size={9} className={isReopening ? "animate-spin" : ""} />
                                {isReopening ? "Moving…" : "Reopen Task"}
                              </button>
                            ) : (
                              <AnimatePresence>
                                <motion.div
                                  initial={{ opacity: 0, height: 0 }}
                                  animate={{ opacity: 1, height: "auto" }}
                                  exit={{ opacity: 0, height: 0 }}
                                  className="overflow-hidden"
                                >
                                  <p className="mb-1.5 text-[9px] font-semibold uppercase tracking-widest text-[#555555]">Move to</p>
                                  <div className="grid grid-cols-2 gap-1">
                                    {REOPEN_COLUMNS.map((col) => (
                                      <button
                                        key={col.name}
                                        onClick={() => {
                                          setPickerCardId(null);
                                          void onReopen(card, col.name);
                                        }}
                                        className="flex items-center gap-1.5 rounded-md px-2 py-1.5 text-[10px] font-medium transition-colors"
                                        style={{
                                          color: col.accent,
                                          backgroundColor: `${col.accent}12`,
                                        }}
                                        onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.backgroundColor = `${col.accent}22`; }}
                                        onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.backgroundColor = `${col.accent}12`; }}
                                      >
                                        {col.icon}
                                        {col.name}
                                      </button>
                                    ))}
                                  </div>
                                  <button
                                    onClick={() => setPickerCardId(null)}
                                    className="mt-1.5 w-full text-center text-[9px] text-[#444444] hover:text-[#666666] transition-colors"
                                  >
                                    Cancel
                                  </button>
                                </motion.div>
                              </AnimatePresence>
                            )}
                          </div>
                        }
                      />
                    );
                  })}
                </AnimatePresence>
              )}
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>,
    document.body
  );
}

// ─── List View ────────────────────────────────────────────────────────────────

type ListSortKey = "title" | "column" | "priority" | "repo" | "assignees" | "sprint";

function KanbanListView({
  cards,
  users,
  onUpdate,
}: {
  cards: GlobalCard[];
  users: User[];
  onUpdate: (cardId: string, updates: Partial<GlobalCard>) => void;
}) {
  const [sortKey, setSortKey] = useState<ListSortKey>("column");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");

  function toggleSort(key: ListSortKey) {
    if (sortKey === key) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      setSortDir("asc");
    }
  }

  const sortedCards = useMemo(() => {
    return [...cards].sort((a, b) => {
      const aColumnName = normalizeKanbanColumnName(a.columnName);
      const bColumnName = normalizeKanbanColumnName(b.columnName);
      let cmp = 0;
      switch (sortKey) {
        case "column":
          cmp = (LIST_COLUMN_POSITION[aColumnName] ?? 99) - (LIST_COLUMN_POSITION[bColumnName] ?? 99);
          break;
        case "title":
          cmp = a.title.localeCompare(b.title);
          break;
        case "priority":
          cmp = getPriorityRank(a.priority) - getPriorityRank(b.priority);
          break;
        case "repo":
          cmp = a.repoName.localeCompare(b.repoName);
          break;
        case "sprint":
          cmp = (a.sprintTask?.sprint.name ?? "").localeCompare(b.sprintTask?.sprint.name ?? "");
          break;
        case "assignees": {
          const aLen = parseAssigneeIds(a.assignees).length;
          const bLen = parseAssigneeIds(b.assignees).length;
          cmp = bLen - aLen;
          break;
        }
      }
      if (cmp === 0) {
        cmp =
          (LIST_COLUMN_POSITION[aColumnName] ?? 99) - (LIST_COLUMN_POSITION[bColumnName] ?? 99) ||
          getPriorityRank(a.priority) - getPriorityRank(b.priority);
      }
      return sortDir === "asc" ? cmp : -cmp;
    });
  }, [cards, sortKey, sortDir]);

  function SortHeader({ label, col }: { label: string; col: ListSortKey }) {
    const active = sortKey === col;
    return (
      <button
        onClick={() => toggleSort(col)}
        className={cn(
          "flex items-center gap-1 text-[10px] font-semibold uppercase tracking-[0.14em] transition-colors whitespace-nowrap",
          active ? "text-[#F7941D]" : "text-[#575757] hover:text-[#999999]"
        )}
      >
        {label}
        {active ? (
          sortDir === "asc" ? <ChevronUp size={10} /> : <ChevronDown size={10} />
        ) : (
          <ArrowUpDown size={10} className="opacity-30" />
        )}
      </button>
    );
  }

  return (
    <motion.div
      className="px-3 py-4 pb-8 sm:px-6"
      initial={{ opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, ease: "easeOut" }}
    >
      <div className="rounded-2xl border border-[rgba(255,255,255,0.06)] overflow-hidden bg-[#0F0F0F]">
        {/* Table header — mobile: 2-col (title + meta), desktop: full grid */}
        <div className="border-b border-[rgba(255,255,255,0.06)] bg-[rgba(255,255,255,0.025)] px-4 py-2.5">
          {/* Mobile header */}
          <div className="flex items-center justify-between sm:hidden">
            <SortHeader label="Title" col="title" />
            <div className="flex items-center gap-3">
              <SortHeader label="Status" col="column" />
              <SortHeader label="Priority" col="priority" />
              <SortHeader label="People" col="assignees" />
            </div>
          </div>
          {/* Desktop header */}
          <div
            className="max-sm:hidden grid items-center gap-3"
            style={{ gridTemplateColumns: "minmax(0,3fr) 1fr 80px 1fr 80px 1fr" }}
          >
            <SortHeader label="Title" col="title" />
            <SortHeader label="Status" col="column" />
            <SortHeader label="Priority" col="priority" />
            <SortHeader label="Repo" col="repo" />
            <SortHeader label="People" col="assignees" />
            <SortHeader label="Sprint" col="sprint" />
          </div>
        </div>

        {/* Rows */}
        <div className="divide-y divide-[rgba(255,255,255,0.03)]">
          {sortedCards.length === 0 && (
            <div className="flex h-32 items-center justify-center text-sm text-[#404040]">
              No tasks match the current filters
            </div>
          )}
          {sortedCards.map((card) => {
            const assigneeIds = parseAssigneeIds(card.assignees);
            const assigneeUsers = assigneeIds
              .map((id) => users.find((u) => u.id === id))
              .filter(Boolean) as User[];
            const colStyle = COLUMN_STYLE[card.columnName] ?? { accent: "#555555", icon: null };
            const priorityColor = PRIORITY_COLORS[card.priority] ?? "#6A6A6A";
            const repoColor = getRepoColor(card.repoIndex);

            const AssigneeAvatars = (
              <div className="flex items-center">
                {assigneeUsers.length === 0 ? (
                  <span className="text-xs text-[#333333]">—</span>
                ) : (
                  <div className="flex -space-x-1.5">
                    {assigneeUsers.slice(0, 3).map((user) => {
                      const displayName = user.displayName ?? user.name ?? user.email;
                      return (
                        <Avatar
                          key={user.id}
                          name={displayName}
                          src={user.image}
                          size="xs"
                          className="!h-5 !w-5 text-[7px] ring-1 ring-[#0F0F0F]"
                        />
                      );
                    })}
                    {assigneeUsers.length > 3 && (
                      <span className="flex h-5 w-5 items-center justify-center rounded-full bg-[#1E1E1E] text-[8px] font-bold text-[#777777] ring-1 ring-[#0F0F0F]">
                        +{assigneeUsers.length - 3}
                      </span>
                    )}
                  </div>
                )}
              </div>
            );

            return (
              <div
                key={card.id}
                className="px-4 transition-colors hover:bg-[rgba(255,255,255,0.02)]"
              >
                {/* ── Mobile: 2-row card ── */}
                <div className="sm:hidden py-3">
                  {/* Row 1: Title */}
                  <p className="truncate text-sm font-medium text-[#E0E0E0] leading-snug">{card.title}</p>
                  {card.customers.length > 0 && (
                    <p className="truncate text-xs text-[#505050] mt-0.5">
                      {card.customers.map((c) => c.name).join(", ")}
                    </p>
                  )}
                  {/* Row 2: Status + Priority + Assignees */}
                  <div className="mt-2 flex items-center gap-2 flex-wrap">
                    <span
                      className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold whitespace-nowrap"
                      style={{ color: colStyle.accent, backgroundColor: `${colStyle.accent}18` }}
                    >
                      <span className="flex-shrink-0">{colStyle.icon}</span>
                      <span>{card.columnName}</span>
                    </span>
                    <span
                      className="inline-block rounded-full px-2 py-0.5 text-[10px] font-semibold capitalize whitespace-nowrap"
                      style={{ color: priorityColor, backgroundColor: `${priorityColor}18` }}
                    >
                      {card.priority}
                    </span>
                    <div className="ml-auto">{AssigneeAvatars}</div>
                  </div>
                </div>

                {/* ── Desktop: full grid ── */}
                <div
                  className="max-sm:hidden grid items-center gap-3 py-3"
                  style={{ gridTemplateColumns: "minmax(0,3fr) 1fr 80px 1fr 80px 1fr" }}
                >
                  {/* Title + customers */}
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-[#E0E0E0] leading-snug">{card.title}</p>
                    {card.customers.length > 0 && (
                      <p className="truncate text-xs text-[#505050] mt-0.5">
                        {card.customers.map((c) => c.name).join(", ")}
                      </p>
                    )}
                  </div>

                  {/* Status */}
                  <div>
                    <span
                      className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold whitespace-nowrap max-w-full"
                      style={{ color: colStyle.accent, backgroundColor: `${colStyle.accent}18` }}
                    >
                      <span className="flex-shrink-0">{colStyle.icon}</span>
                      <span className="truncate">{card.columnName}</span>
                    </span>
                  </div>

                  {/* Priority */}
                  <div>
                    <span
                      className="inline-block rounded-full px-2 py-0.5 text-[10px] font-semibold capitalize whitespace-nowrap"
                      style={{ color: priorityColor, backgroundColor: `${priorityColor}18` }}
                    >
                      {card.priority}
                    </span>
                  </div>

                  {/* Repo */}
                  <div className="min-w-0 flex items-center gap-1.5">
                    <div className="h-2 w-2 flex-shrink-0 rounded-full" style={{ backgroundColor: repoColor }} />
                    <span className="truncate text-xs text-[#777777]">{card.repoName}</span>
                  </div>

                  {/* Assignees */}
                  {AssigneeAvatars}

                  {/* Sprint */}
                  <div className="min-w-0">
                    {card.sprintTask ? (
                      <span className="inline-block max-w-full truncate rounded-md px-1.5 py-0.5 text-[10px] font-medium text-[#7C9FD0] bg-[rgba(124,159,208,0.1)]">
                        {card.sprintTask.sprint.name}
                      </span>
                    ) : (
                      <span className="text-xs text-[#333333]">—</span>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* Footer */}
        {sortedCards.length > 0 && (
          <div className="border-t border-[rgba(255,255,255,0.04)] px-4 py-2 bg-[rgba(255,255,255,0.01)]">
            <span className="text-xs text-[#3A3A3A]">
              {sortedCards.length} task{sortedCards.length !== 1 ? "s" : ""}
            </span>
          </div>
        )}
      </div>
    </motion.div>
  );
}

// ─── Sprint Filter Pill ───────────────────────────────────────────────────────

export function GlobalKanbanClient({ cards, repos, sprints, users, customers, currentUserId, taskGroups: initialTaskGroups = [] }: Props) {
  const [localCards, setLocalCards] = useState(cards);
  const [localTaskGroups, setLocalTaskGroups] = useState<TaskGroupData[]>(() =>
    initialTaskGroups.map((g) => ({
      ...g,
      cardIds: cards.filter((c) => c.taskGroupId === g.id).map((c) => c.id),
    }))
  );
  const [creatingGroup, setCreatingGroup] = useState(false);
  const [newGroupName, setNewGroupName] = useState("");
  const [savingGroup, setSavingGroup] = useState(false);
  const [selectedRepos, setSelectedRepos] = useState<Set<string>>(new Set());
  const [selectedAssigneeIds, setSelectedAssigneeIds] = useState<Set<string>>(new Set());
  const [selectedCustomerId, setSelectedCustomerId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [repoMenuOpen, setRepoMenuOpen] = useState(false);
  const [assigneeMenuOpen, setAssigneeMenuOpen] = useState(false);
  const [customerMenuOpen, setCustomerMenuOpen] = useState(false);
  const [draggingCardId, setDraggingCardId] = useState<string | null>(null);
  const [draggingGroupId, setDraggingGroupId] = useState<string | null>(null);
  const [dragOverColumn, setDragOverColumn] = useState<string | null>(null);
  const [createDrawerOpen, setCreateDrawerOpen] = useState(false);
  const [qaDrawerOpen, setQaDrawerOpen] = useState(false);
  const [poReviewDrawerOpen, setPoReviewDrawerOpen] = useState(false);
  const [completedDrawerOpen, setCompletedDrawerOpen] = useState(false);
  const [reopeningCardId, setReopeningCardId] = useState<string | null>(null);
  const [qaActioningCardId, setQaActioningCardId] = useState<string | null>(null);
  const [qaActioningCardAction, setQaActioningCardAction] = useState<"reject" | "po-review" | "complete" | null>(null);
  const [poActioningCardId, setPoActioningCardId] = useState<string | null>(null);
  const [poActioningCardAction, setPoActioningCardAction] = useState<"reject" | "complete" | null>(null);
  const [viewMode, setViewMode] = useState<"board" | "list">("board");
  const [openGroupId, setOpenGroupId] = useState<string | null>(null);
  const repoMenuRef = useRef<HTMLDivElement>(null);
  const assigneeMenuRef = useRef<HTMLDivElement>(null);
  const customerMenuRef = useRef<HTMLDivElement>(null);
  const deferredSearchQuery = useDeferredValue(searchQuery);
  const normalizedSearchQuery = deferredSearchQuery.trim().toLowerCase();

  useEffect(() => {
    setLocalCards(cards);
  }, [cards]);

  useEffect(() => {
    function handlePointerDown(event: MouseEvent) {
      const target = event.target as Node;

      if (repoMenuOpen && repoMenuRef.current && !repoMenuRef.current.contains(target)) {
        setRepoMenuOpen(false);
      }
      if (assigneeMenuOpen && assigneeMenuRef.current && !assigneeMenuRef.current.contains(target)) {
        setAssigneeMenuOpen(false);
      }
      if (customerMenuOpen && customerMenuRef.current && !customerMenuRef.current.contains(target)) {
        setCustomerMenuOpen(false);
      }
    }

    if (!repoMenuOpen && !assigneeMenuOpen && !customerMenuOpen) return;

    document.addEventListener("mousedown", handlePointerDown);
    return () => document.removeEventListener("mousedown", handlePointerDown);
  }, [assigneeMenuOpen, customerMenuOpen, repoMenuOpen]);

  useEffect(() => {
    const repoIdsWithTasks = new Set(
      localCards
        .map((card) => card.repoId)
        .filter(Boolean)
    );

    setSelectedRepos((prev) => {
      const next = new Set([...prev].filter((repoId) => repoIdsWithTasks.has(repoId)));
      return next.size === prev.size ? prev : next;
    });
  }, [localCards]);

  // Toggle repo filter — empty set = show all
  function toggleRepo(repoId: string) {
    setSelectedRepos((prev) => {
      const next = new Set(prev);
      if (next.has(repoId)) {
        next.delete(repoId);
      } else {
        next.add(repoId);
      }
      return next;
    });
  }

  function clearRepoFilter() {
    setSelectedRepos(new Set());
  }

  function selectCustomerFilter(customerId: string | null) {
    setSelectedCustomerId(customerId);
  }

  function toggleAssigneeFilter(userId: string) {
    setSelectedAssigneeIds((prev) => {
      const next = new Set(prev);
      if (next.has(userId)) {
        next.delete(userId);
      } else {
        next.add(userId);
      }
      return next;
    });
  }

  function clearAssigneeFilter() {
    setSelectedAssigneeIds(new Set());
  }

  // ── Filtered cards ──────────────────────────────────────────────────────────
  const filteredCards = useMemo(() => {
    return localCards.filter((card) => {
      // Repo filter (empty = show all)
      if (selectedRepos.size > 0) {
        if (!selectedRepos.has(card.repoId)) return false;
      }

      if (selectedCustomerId) {
        const cardCustomerIds = card.customers.map((customer) => customer.id);
        if (!cardCustomerIds.includes(selectedCustomerId)) return false;
      }

      if (selectedAssigneeIds.size > 0) {
        const cardAssigneeIds = parseAssigneeIds(card.assignees);
        if (!cardAssigneeIds.some((assigneeId) => selectedAssigneeIds.has(assigneeId))) return false;
      }

      if (normalizedSearchQuery.length > 0) {
        const searchableText = [
          card.title,
          card.body,
          card.labels,
          card.repoName,
          card.repoFullName,
          card.columnName,
          card.priority,
          card.sprintTask?.sprint.name,
          ...card.customers.map((customer) => customer.name),
        ]
          .filter(Boolean)
          .join(" ")
          .toLowerCase();

        if (!searchableText.includes(normalizedSearchQuery)) return false;
      }

      return true;
    });
  }, [localCards, normalizedSearchQuery, selectedAssigneeIds, selectedCustomerId, selectedRepos]);

  // ── Group into columns (exclude grouped cards) ─────────────────────────────
  const columnMap = useMemo(() => {
    const allCols = [...COLUMN_ORDER, QA_COLUMN, PO_REVIEW_COLUMN, COMPLETED_COLUMN];
    const map: Record<string, GlobalCard[]> = {};
    for (const col of allCols) map[col] = [];
    for (const card of filteredCards) {
      if (card.taskGroupId) continue; // grouped cards are shown in task group rows
      const normalizedColumnName = normalizeKanbanColumnName(card.columnName);
      const col = allCols.includes(normalizedColumnName) ? normalizedColumnName : BACKLOG_COLUMN;
      map[col].push(card);
    }
    // Sort each column by priority then repo then position
    for (const col of allCols) {
      map[col].sort(
        (a, b) =>
          getPriorityRank(a.priority) - getPriorityRank(b.priority) ||
          a.repoIndex - b.repoIndex ||
          a.position - b.position
      );
    }
    return map;
  }, [filteredCards]);

  // ── Map task groups into columns (all 5, including QA + Done) ─────────────
  const groupColumnMap = useMemo(() => {
    const allCols = [...COLUMN_ORDER, QA_COLUMN, PO_REVIEW_COLUMN, COMPLETED_COLUMN];
    const map: Record<string, Array<{ group: TaskGroupData; cards: GlobalCard[] }>> = {};
    for (const col of allCols) map[col] = [];
    for (const group of localTaskGroups) {
      const col = GROUP_STATUS_TO_COLUMN[group.status];
      if (!col || !map[col]) continue;
      const groupCards = localCards.filter((c) => c.taskGroupId === group.id);
      map[col].push({ group, cards: groupCards });
    }
    return map;
  }, [localTaskGroups, localCards]);

  const nonDoneCards = useMemo(
    () => localCards.filter((card) => normalizeKanbanColumnName(card.columnName) !== COMPLETED_COLUMN),
    [localCards]
  );

  const sortedRepos = useMemo(() => {
    const withCounts = repos
      .map((repo) => ({
        ...repo,
        visibleCount: nonDoneCards.filter((card) => card.repoId === repo.id).length,
      }))
      .filter((repo) => repo.visibleCount > 0);

    const general = withCounts.find((r) => r.id === "general");
    const rest = withCounts
      .filter((r) => r.id !== "general")
      .sort((a, b) => b.visibleCount - a.visibleCount || a.name.localeCompare(b.name));

    return general ? [general, ...rest] : rest;
  }, [nonDoneCards, repos]);

  const createDrawerRepos = useMemo(() => {
    const generalRepo = repos.find((r) => r.id === "general");
    const repoList = repos
      .filter((r) => r.id !== "general")
      .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime() || a.name.localeCompare(b.name));
    return generalRepo ? [generalRepo, ...repoList] : repoList;
  }, [repos]);

  const sortedAssignees = useMemo(() => {
    return [...users]
      .map((user) => ({
        ...user,
        visibleCount: nonDoneCards.filter((card) => parseAssigneeIds(card.assignees).includes(user.id)).length,
      }))
      .sort((a, b) => {
        const aName = a.displayName ?? a.name ?? a.email;
        const bName = b.displayName ?? b.name ?? b.email;
        return aName.localeCompare(bName);
      });
  }, [nonDoneCards, users]);

  const sortedCustomers = useMemo(() => {
    return [...customers]
      .map((customer) => ({
        ...customer,
        visibleCount: nonDoneCards.filter((card) => card.customers.some((linkedCustomer) => linkedCustomer.id === customer.id)).length,
      }))
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [customers, nonDoneCards]);

  const selectedRepoLabel = useMemo(() => {
    if (selectedRepos.size === 0) return "All Repos";
    const selected = sortedRepos.filter((repo) => selectedRepos.has(repo.id));
    if (selected.length === 0) return "All Repos";
    return selected.length === 1 ? selected[0].name : `${selected[0].name} +${selected.length - 1}`;
  }, [selectedRepos, sortedRepos]);

  const selectedAssigneeLabel = useMemo(() => {
    if (selectedAssigneeIds.size === 0) return "All Assignees";
    const selected = sortedAssignees.filter((user) => selectedAssigneeIds.has(user.id));
    if (selected.length === 0) return "All Assignees";
    const first = selected[0].displayName ?? selected[0].name ?? selected[0].email;
    const firstName = first.trim().split(/\s+/)[0] ?? first;
    return selected.length === 1 ? firstName : `${firstName} +${selected.length - 1}`;
  }, [selectedAssigneeIds, sortedAssignees]);

  const selectedCustomerLabel = useMemo(() => {
    if (!selectedCustomerId) return "All Customers";
    return sortedCustomers.find((customer) => customer.id === selectedCustomerId)?.name ?? "All Customers";
  }, [selectedCustomerId, sortedCustomers]);

  // ── Stats ───────────────────────────────────────────────────────────────────
  const filteredNonDoneCards = useMemo(() => filteredCards.filter((c) => c.columnName !== COMPLETED_COLUMN), [filteredCards]);
  const totalCards = filteredNonDoneCards.length;
  const unassignedCount = filteredNonDoneCards.filter(
    (c) => parseAssigneeIds(c.assignees).length === 0
  ).length;

  async function handleCreateGroup() {
    const name = newGroupName.trim();
    if (!name) return;
    setSavingGroup(true);
    const res = await fetch("/api/task-groups", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name }),
    });
    if (res.ok) {
      const data = await res.json();
      setLocalTaskGroups((prev) => [...prev, { ...data.group, cardIds: [] }]);
    }
    setNewGroupName("");
    setCreatingGroup(false);
    setSavingGroup(false);
  }

  async function handleGroupStatusChange(groupId: string, status: string) {
    setLocalTaskGroups((prev) => prev.map((g) => g.id === groupId ? { ...g, status } : g));
    await fetch("/api/task-groups", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ groupId, status }),
    });
  }

  async function handleGroupRename(groupId: string, name: string) {
    setLocalTaskGroups((prev) => prev.map((g) => g.id === groupId ? { ...g, name } : g));
    await fetch("/api/task-groups", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ groupId, name }),
    });
  }

  async function handleGroupDelete(groupId: string) {
    setLocalTaskGroups((prev) => prev.filter((g) => g.id !== groupId));
    setLocalCards((prev) => prev.map((c) => c.taskGroupId === groupId ? { ...c, taskGroupId: null } : c));
    await fetch(`/api/task-groups?groupId=${groupId}`, { method: "DELETE" });
  }

  function handleTaskGroupChange(cardId: string, taskGroupId: string | null) {
    setLocalCards((prev) => prev.map((c) => c.id === cardId ? { ...c, taskGroupId } : c));
    setLocalTaskGroups((prev) => prev.map((g) => ({
      ...g,
      cardIds: taskGroupId === g.id
        ? [...g.cardIds.filter((id) => id !== cardId), cardId]
        : g.cardIds.filter((id) => id !== cardId),
    })));
  }

  async function handleDelete(card: GlobalCard) {
    const previousCards = localCards;
    setLocalCards((prev) => prev.filter((existing) => existing.id !== card.id));

    const res = card.isSprintOnly
      ? await fetch(`/api/sprints/${card.sprintTask?.sprintId}/tasks/${card.id}`, { method: "DELETE" })
      : await fetch(`/api/kanban?cardId=${card.id}`, { method: "DELETE" });

    if (!res.ok) {
      setLocalCards(previousCards);
      return false;
    }

    return true;
  }

  function handleCardUpdate(cardId: string, updates: Partial<GlobalCard> & { linkedRepoIds?: string[] }) {
    setLocalCards((prev) =>
      prev.map((card) => (card.id === cardId ? { ...card, ...updates } : card))
    );
  }

  function handleTaskCreated(task: import("./KanbanCardDrawer").CreatedTaskPayload) {
    const repoIndex = repos.find((repo) => repo.id === task.repoId)?.index ?? 0;
    setLocalCards((prev) => [
      {
        ...task,
        updatedAt: new Date().toISOString(),
        notes: task.notes.map((note) => ({
          ...note,
          createdAt: typeof note.createdAt === "string" ? note.createdAt : note.createdAt.toISOString(),
        })),
        agentExecutions: (task.agentExecutions ?? []).map((execution) => ({
          ...execution,
          createdAt: typeof execution.createdAt === "string" ? execution.createdAt : execution.createdAt.toISOString(),
          agent: {
            ...execution.agent,
            avatar: execution.agent.avatar ?? null,
          },
        })),
        repoIndex,
        linkedRepoIds: task.linkedRepoIds ?? [],
        taskGroupId: task.taskGroupId ?? null,
      },
      ...prev,
    ]);
  }

  function handleSprintChange(cardId: string, sprintTask: SprintRef | null) {
    setLocalCards((prev) =>
      prev.map((card) => (card.id === cardId ? { ...card, sprintTask } : card))
    );
  }

  async function moveCard(card: GlobalCard, targetColumnName: string) {
    if (card.isSprintOnly || normalizeKanbanColumnName(card.columnName) === targetColumnName) return;

    const targetColumn = repos
      .find((repo) => repo.id === card.repoId)
      ?.columns.find((column) => normalizeKanbanColumnName(column.name) === targetColumnName);

    if (!targetColumn) {
      alert(`Could not find ${targetColumnName} for ${card.repoName}`);
      return;
    }

    const previousCards = localCards;
    setLocalCards((prev) =>
      prev.map((existing) =>
        existing.id === card.id
          ? {
            ...existing,
            columnId: targetColumn.id,
            columnName: targetColumn.name,
            columnPosition: targetColumn.position,
          }
          : existing
      )
    );

    const res = await fetch("/api/kanban", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ cardId: card.id, columnId: targetColumn.id }),
    });

    if (!res.ok) {
      setLocalCards(previousCards);
      alert("Failed to move task");
    }
  }

  async function handleReopen(card: GlobalCard, targetColumn: string) {
    if (card.isSprintOnly) return;

    setReopeningCardId(card.id);
    try {
      await moveCard(card, targetColumn);
    } finally {
      setReopeningCardId((current) => (current === card.id ? null : current));
    }
  }

  async function handleQaReject(card: GlobalCard) {
    if (card.isSprintOnly) return;
    setQaActioningCardId(card.id);
    setQaActioningCardAction("reject");
    try {
      await moveCard(card, ACTIVE_COLUMN);
    } finally {
      setQaActioningCardId((current) => (current === card.id ? null : current));
      setQaActioningCardAction(null);
    }
  }

  async function handleQaComplete(card: GlobalCard) {
    if (card.isSprintOnly) return;
    setQaActioningCardId(card.id);
    setQaActioningCardAction("complete");
    try {
      await moveCard(card, COMPLETED_COLUMN);
    } finally {
      setQaActioningCardId((current) => (current === card.id ? null : current));
      setQaActioningCardAction(null);
    }
  }

  async function handleQaMoveToPoReview(card: GlobalCard) {
    if (card.isSprintOnly) return;
    setQaActioningCardId(card.id);
    setQaActioningCardAction("po-review");
    try {
      await moveCard(card, PO_REVIEW_COLUMN);
    } finally {
      setQaActioningCardId((current) => (current === card.id ? null : current));
      setQaActioningCardAction(null);
    }
  }

  async function handlePoReviewReject(card: GlobalCard) {
    if (card.isSprintOnly) return;
    setPoActioningCardId(card.id);
    setPoActioningCardAction("reject");
    try {
      await moveCard(card, ACTIVE_COLUMN);
    } finally {
      setPoActioningCardId((current) => (current === card.id ? null : current));
      setPoActioningCardAction(null);
    }
  }

  async function handlePoReviewComplete(card: GlobalCard) {
    if (card.isSprintOnly) return;
    setPoActioningCardId(card.id);
    setPoActioningCardAction("complete");
    try {
      await moveCard(card, COMPLETED_COLUMN);
    } finally {
      setPoActioningCardId((current) => (current === card.id ? null : current));
      setPoActioningCardAction(null);
    }
  }

  function handleDragStart(card: GlobalCard) {
    if (card.isSprintOnly) return;
    setDraggingCardId(card.id);
  }

  function handleDragEnd() {
    setDraggingCardId(null);
    setDragOverColumn(null);
  }

  function handleGroupDragStart(groupId: string) {
    setDraggingGroupId(groupId);
  }

  function handleGroupDragEnd() {
    setDraggingGroupId(null);
    setDragOverColumn(null);
  }

  function handleColumnDragOver(event: React.DragEvent<HTMLDivElement>, columnName: string) {
    if (!draggingCardId && !draggingGroupId) return;
    event.preventDefault();
    setDragOverColumn(columnName);
  }

  async function handleColumnDrop(event: React.DragEvent<HTMLDivElement>, columnName: string) {
    event.preventDefault();
    setDragOverColumn(null);

    // ── Group drop ────────────────────────────────────────────────────────────
    if (draggingGroupId) {
      const newStatus = COLUMN_TO_GROUP_STATUS[columnName];
      setDraggingGroupId(null);
      if (newStatus) await handleGroupStatusChange(draggingGroupId, newStatus);
      return;
    }

    // ── Card drop ─────────────────────────────────────────────────────────────
    const draggingCard = localCards.find((card) => card.id === draggingCardId);
    setDraggingCardId(null);
    if (!draggingCard) return;
    await moveCard(draggingCard, columnName);
  }

  function handleDoneDropZoneDragLeave() {
    if (dragOverColumn === QA_COLUMN || dragOverColumn === PO_REVIEW_COLUMN || dragOverColumn === COMPLETED_COLUMN) {
      setDragOverColumn(null);
    }
  }

  return (
    <div className="min-h-full overflow-x-hidden bg-[#0D0D0D]">

      {/* ── Page header ─────────────────────────────────────────────────────── */}
      <motion.div
        className="flex-shrink-0 px-3 pb-0 pt-3 sm:px-6 sm:pt-6"
        initial="initial"
        animate="animate"
        variants={pageIntro}
        transition={{ duration: 0.42, ease: "easeOut" }}
      >
        {/* ── Title + search (desktop) + actions ───────────────────────────── */}
        <div className="mb-3 flex items-center gap-3 lg:mb-4">
          <motion.div
            className="hidden rounded-xl border border-[rgba(247,148,29,0.15)] bg-[rgba(247,148,29,0.12)] p-2 sm:flex flex-shrink-0"
            initial={{ opacity: 0, scale: 0.92, rotate: -6 }}
            animate={{ opacity: 1, scale: 1, rotate: 0 }}
            transition={{ duration: 0.45, delay: 0.08, ease: "easeOut" }}
          >
            <LayoutGrid size={17} className="text-[#F7941D]" />
          </motion.div>
          <motion.div
            className="min-w-0 flex-shrink-0"
            initial={{ opacity: 0, x: -10 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.38, delay: 0.12, ease: "easeOut" }}
          >
            <h1 className="truncate text-2xl font-black text-[#F0F0F0]">Team Planner</h1>
            <p className="hidden sm:block text-xs text-[#676767] mt-0.5">All tasks across every repo</p>
          </motion.div>

          {/* Search bar — in header on desktop */}
          <motion.label
            className="hidden sm:flex flex-1 min-w-0 items-center gap-2 rounded-xl border border-[rgba(255,255,255,0.06)] bg-[rgba(255,255,255,0.03)] px-3 py-2 text-[#8D8D8D] transition-colors focus-within:border-[rgba(247,148,29,0.3)] focus-within:bg-[rgba(247,148,29,0.06)] focus-within:text-[#F7941D] mx-2"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.38, delay: 0.14, ease: "easeOut" }}
          >
            <Search size={13} className="flex-shrink-0" />
            <input
              value={searchQuery}
              onChange={(event) => setSearchQuery(event.target.value)}
              placeholder="Search tasks..."
              aria-label="Search tasks"
              className="min-w-0 flex-1 bg-transparent text-sm text-[#F0F0F0] outline-none placeholder:text-[#606060]"
            />
            {searchQuery.length > 0 ? (
              <button
                type="button"
                onClick={() => setSearchQuery("")}
                className="inline-flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-full text-[#6A6A6A] transition-colors hover:bg-[rgba(255,255,255,0.05)] hover:text-[#F0F0F0]"
                aria-label="Clear search"
              >
                <X size={11} />
              </button>
            ) : null}
          </motion.label>

          {/* Action buttons */}
          <motion.div
            className="ml-auto flex flex-shrink-0 items-center gap-2 sm:gap-3"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.38, delay: 0.16, ease: "easeOut" }}
          >
            <motion.div whileHover={{ y: -1 }} transition={{ duration: 0.15 }}>
              {creatingGroup ? (
                <div className="flex items-center gap-2">
                  <input
                    autoFocus
                    value={newGroupName}
                    onChange={(e) => setNewGroupName(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") void handleCreateGroup();
                      if (e.key === "Escape") { setCreatingGroup(false); setNewGroupName(""); }
                    }}
                    placeholder="Group name..."
                    className="h-8 rounded-lg border border-[rgba(255,255,255,0.1)] bg-[rgba(255,255,255,0.04)] px-3 text-sm text-[#F0F0F0] outline-none placeholder:text-[#555555] focus:border-[rgba(247,148,29,0.3)] w-40"
                  />
                  <Button variant="primary" size="sm" loading={savingGroup} onClick={() => void handleCreateGroup()}>
                    Create
                  </Button>
                  <Button variant="secondary" size="sm" onClick={() => { setCreatingGroup(false); setNewGroupName(""); }}>
                    Cancel
                  </Button>
                </div>
              ) : (
                <Button
                  variant="secondary"
                  size="sm"
                  icon={<Layers size={13} />}
                  onClick={() => setCreatingGroup(true)}
                >
                  New Group
                </Button>
              )}
            </motion.div>
            <motion.div whileHover={{ y: -1 }} transition={{ duration: 0.15 }}>
              <Button
                variant="primary"
                size="sm"
                icon={<Plus size={13} />}
                onClick={() => setCreateDrawerOpen(true)}
              >
                New Task
              </Button>
            </motion.div>
            <motion.div
              className="flex items-center gap-0.5 rounded-xl border border-[rgba(255,255,255,0.08)] bg-[rgba(255,255,255,0.04)] p-1"
              initial={{ opacity: 0, scale: 0.96 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.3, delay: 0.22, ease: "easeOut" }}
            >
              <button
                onClick={() => setViewMode("board")}
                className={cn(
                  "flex h-7 w-7 items-center justify-center rounded-lg transition-all duration-150",
                  viewMode === "board"
                    ? "bg-[rgba(247,148,29,0.2)] text-[#F7941D] shadow-[0_0_0_1px_rgba(247,148,29,0.2)]"
                    : "text-[#505050] hover:text-[#999999]"
                )}
                title="Board view"
              >
                <LayoutGrid size={15} />
              </button>
              <button
                onClick={() => setViewMode("list")}
                className={cn(
                  "flex h-7 w-7 items-center justify-center rounded-lg transition-all duration-150",
                  viewMode === "list"
                    ? "bg-[rgba(247,148,29,0.2)] text-[#F7941D] shadow-[0_0_0_1px_rgba(247,148,29,0.2)]"
                    : "text-[#505050] hover:text-[#999999]"
                )}
                title="List view"
              >
                <LayoutList size={15} />
              </button>
            </motion.div>
          </motion.div>
        </div>

        {/* ── Filter pills bar ─────────────────────────────────────────────── */}
        <div className="border-b border-[rgba(255,255,255,0.05)] pb-3 sm:pb-4">
          <motion.div
            className="flex flex-col gap-2 sm:flex-row sm:items-center"
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.42, delay: 0.12, ease: "easeOut" }}
          >
            {/* Mobile-only search */}
            <label className="sm:hidden flex items-center gap-2 rounded-xl border border-[rgba(255,255,255,0.06)] bg-[rgba(255,255,255,0.03)] px-3 py-2 text-[#8D8D8D] transition-colors focus-within:border-[rgba(247,148,29,0.3)] focus-within:bg-[rgba(247,148,29,0.06)] focus-within:text-[#F7941D]">
              <Search size={13} className="flex-shrink-0" />
              <input
                value={searchQuery}
                onChange={(event) => setSearchQuery(event.target.value)}
                placeholder="Search tasks..."
                aria-label="Search tasks"
                className="min-w-0 flex-1 bg-transparent text-sm text-[#F0F0F0] outline-none placeholder:text-[#606060]"
              />
              {searchQuery.length > 0 ? (
                <button
                  type="button"
                  onClick={() => setSearchQuery("")}
                  className="inline-flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-full text-[#6A6A6A] transition-colors hover:bg-[rgba(255,255,255,0.05)] hover:text-[#F0F0F0]"
                  aria-label="Clear search"
                >
                  <X size={11} />
                </button>
              ) : null}
            </label>

            {/* Filter pills */}
            <div className="flex items-center gap-2">
              <div ref={repoMenuRef} className="relative flex-shrink-0">
                  <button
                    type="button"
                    onClick={() => {
                      setRepoMenuOpen((prev) => !prev);
                      setAssigneeMenuOpen(false);
                      setCustomerMenuOpen(false);
                    }}
                    className={cn(
                      "inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs transition-colors",
                      selectedRepos.size > 0
                        ? "border-[rgba(247,148,29,0.28)] bg-[rgba(247,148,29,0.12)] text-[#F6B04D]"
                        : "border-[rgba(255,255,255,0.06)] bg-[rgba(255,255,255,0.04)] text-[#D0D0D0] hover:bg-[rgba(255,255,255,0.08)]"
                    )}
                  >
                    {selectedRepos.size === 0 ? <FolderGit2 size={12} /> : <GitBranch size={12} />}
                    <span className="max-sm:hidden max-w-[132px] truncate">{selectedRepoLabel}</span>
                    {selectedRepos.size > 0 ? (
                      <span className="rounded-full bg-[rgba(247,148,29,0.14)] px-1.5 py-0.5 text-[10px] font-semibold text-[#F6B04D]">
                        {selectedRepos.size}
                      </span>
                    ) : null}
                    <ChevronDown size={12} />
                  </button>

                  <AnimatePresence>
                    {repoMenuOpen && (
                      <motion.div
                        initial={{ opacity: 0, y: 8, scale: 0.98 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        exit={{ opacity: 0, y: 8, scale: 0.98 }}
                        className="absolute left-0 top-full z-30 mt-2 w-72 max-w-[calc(100vw-2rem)] overflow-hidden rounded-2xl border border-[rgba(255,255,255,0.08)] bg-[#151515] p-1.5 shadow-2xl"
                      >
                        <button
                          type="button"
                          onClick={() => {
                            clearRepoFilter();
                            setRepoMenuOpen(false);
                          }}
                          className="flex w-full items-center gap-2.5 rounded-xl px-3 py-2 text-left text-sm transition-colors hover:bg-[rgba(255,255,255,0.04)]"
                          style={{ color: selectedRepos.size === 0 ? "#F7941D" : "#D0D0D0" }}
                        >
                          <Globe2 size={13} className="flex-shrink-0" />
                          <span className="flex-1 truncate">All Repos</span>
                          {selectedRepos.size === 0 ? <CheckCircle2 size={13} /> : null}
                        </button>

                        {sortedRepos.length > 0 ? (
                          <>
                            <div className="my-1.5 border-t border-[rgba(255,255,255,0.06)]" />
                            <div className="px-3 pb-1 pt-0.5">
                              <span className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[#555555]">Repos</span>
                            </div>
                            {sortedRepos.map((repo) => {
                              const selected = selectedRepos.has(repo.id);
                              const color = getRepoColor(repo.index);
                              return (
                                <button
                                  key={repo.id}
                                  type="button"
                                  onClick={() => toggleRepo(repo.id)}
                                  className="flex w-full items-center gap-2.5 rounded-xl px-3 py-2 text-left text-sm transition-colors hover:bg-[rgba(255,255,255,0.04)]"
                                  style={{ color: selected ? color : "#D0D0D0" }}
                                >
                                  <span className="h-2 w-2 flex-shrink-0 rounded-full" style={{ backgroundColor: color }} />
                                  <span className="flex-1 truncate">{repo.name}</span>
                                  <span className="rounded px-1 py-0.5 text-[10px] font-semibold text-[#777777]">
                                    {repo.visibleCount}
                                  </span>
                                  <span
                                    className="flex h-4 w-4 flex-shrink-0 items-center justify-center rounded-md border"
                                    style={{
                                      borderColor: selected ? `${color}80` : "rgba(255,255,255,0.12)",
                                      backgroundColor: selected ? `${color}20` : "transparent",
                                      color: selected ? color : "transparent",
                                    }}
                                  >
                                    <CheckCircle2 size={10} />
                                  </span>
                                </button>
                              );
                            })}
                          </>
                        ) : null}
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>

                <div ref={assigneeMenuRef} className="relative flex-shrink-0">
                  <button
                    type="button"
                    onClick={() => {
                      setAssigneeMenuOpen((prev) => !prev);
                      setRepoMenuOpen(false);
                      setCustomerMenuOpen(false);
                    }}
                    className={cn(
                      "inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs transition-colors",
                      selectedAssigneeIds.size > 0
                        ? "border-[rgba(246,176,77,0.32)] bg-[rgba(246,176,77,0.14)] text-[#FFC775]"
                        : "border-[rgba(255,255,255,0.06)] bg-[rgba(255,255,255,0.04)] text-[#D0D0D0] hover:bg-[rgba(255,255,255,0.08)]"
                    )}
                  >
                    <Users size={12} />
                    <span className="max-sm:hidden max-w-[132px] truncate">{selectedAssigneeLabel}</span>
                    {selectedAssigneeIds.size > 0 ? (
                      <span className="rounded-full bg-[rgba(246,176,77,0.18)] px-1.5 py-0.5 text-[10px] font-semibold text-[#FFC775]">
                        {selectedAssigneeIds.size}
                      </span>
                    ) : null}
                    <ChevronDown size={12} />
                  </button>

                  <AnimatePresence>
                    {assigneeMenuOpen && (
                      <motion.div
                        initial={{ opacity: 0, y: 8, scale: 0.98 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        exit={{ opacity: 0, y: 8, scale: 0.98 }}
                        className="absolute left-0 top-full z-30 mt-2 w-80 max-w-[calc(100vw-2rem)] overflow-hidden rounded-2xl border border-[rgba(255,255,255,0.08)] bg-[#151515] p-2 shadow-2xl"
                      >
                        <button
                          type="button"
                          onClick={() => {
                            clearAssigneeFilter();
                            setAssigneeMenuOpen(false);
                          }}
                          className={cn(
                            "mb-2 flex w-full items-center justify-between rounded-xl px-3 py-2 text-left text-sm transition-colors hover:bg-[rgba(255,255,255,0.04)]",
                            selectedAssigneeIds.size === 0 ? "text-[#FFC775]" : "text-[#D0D0D0]"
                          )}
                        >
                          <span>All Assignees</span>
                          {selectedAssigneeIds.size === 0 ? <CheckCircle2 size={13} /> : null}
                        </button>

                        <div className="max-h-72 space-y-1 overflow-y-auto">
                          {sortedAssignees.map((user) => {
                            const active = selectedAssigneeIds.has(user.id);
                            const displayName = user.displayName ?? user.name ?? user.email;
                            return (
                              <button
                                key={user.id}
                                type="button"
                                onClick={() => toggleAssigneeFilter(user.id)}
                                className="flex w-full items-center gap-2.5 rounded-xl px-3 py-2 text-left text-sm transition-colors hover:bg-[rgba(255,255,255,0.04)]"
                                style={{ color: active ? "#FFC775" : "#D0D0D0" }}
                              >
                                <Avatar name={displayName} src={user.image} size="xs" className="!h-5 !w-5 text-[8px]" />
                                <span className="flex-1 truncate">{displayName}</span>
                                <span className="rounded px-1 py-0.5 text-[10px] font-semibold text-[#777777]">
                                  {user.visibleCount}
                                </span>
                                <span
                                  className="flex h-4 w-4 flex-shrink-0 items-center justify-center rounded-md border"
                                  style={{
                                    borderColor: active ? "rgba(246,176,77,0.5)" : "rgba(255,255,255,0.12)",
                                    backgroundColor: active ? "rgba(246,176,77,0.15)" : "transparent",
                                    color: active ? "#FFC775" : "transparent",
                                  }}
                                >
                                  <CheckCircle2 size={10} />
                                </span>
                              </button>
                            );
                          })}
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>

                <div ref={customerMenuRef} className="relative flex-shrink-0">
                  <button
                    type="button"
                    onClick={() => {
                      setCustomerMenuOpen((prev) => !prev);
                      setRepoMenuOpen(false);
                      setAssigneeMenuOpen(false);
                    }}
                    className={cn(
                      "inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs transition-colors",
                      selectedCustomerId
                        ? "border-[rgba(125,211,252,0.32)] bg-[rgba(125,211,252,0.14)] text-[#B8E7FF]"
                        : "border-[rgba(255,255,255,0.06)] bg-[rgba(255,255,255,0.04)] text-[#D0D0D0] hover:bg-[rgba(255,255,255,0.08)]"
                    )}
                  >
                    <Building2 size={12} />
                    <span className="max-sm:hidden max-w-[132px] truncate">{selectedCustomerLabel}</span>
                    <ChevronDown size={12} />
                  </button>

                  <AnimatePresence>
                    {customerMenuOpen && (
                      <motion.div
                        initial={{ opacity: 0, y: 8, scale: 0.98 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        exit={{ opacity: 0, y: 8, scale: 0.98 }}
                        className="absolute left-0 top-full z-30 mt-2 w-80 max-w-[calc(100vw-2rem)] overflow-hidden rounded-2xl border border-[rgba(255,255,255,0.08)] bg-[#151515] p-2 shadow-2xl"
                      >
                        <button
                          type="button"
                          onClick={() => {
                            selectCustomerFilter(null);
                            setCustomerMenuOpen(false);
                          }}
                          className={cn(
                            "mb-2 flex w-full items-center justify-between rounded-xl px-3 py-2 text-left text-sm transition-colors hover:bg-[rgba(255,255,255,0.04)]",
                            selectedCustomerId === null ? "text-[#B8E7FF]" : "text-[#D0D0D0]"
                          )}
                        >
                          <span>All Customers</span>
                          {selectedCustomerId === null ? <CheckCircle2 size={13} /> : null}
                        </button>

                        <div className="max-h-72 space-y-1 overflow-y-auto">
                          {sortedCustomers.map((customer) => {
                            const active = selectedCustomerId === customer.id;
                            return (
                              <button
                                key={customer.id}
                                type="button"
                                onClick={() => {
                                  selectCustomerFilter(customer.id);
                                  setCustomerMenuOpen(false);
                                }}
                                className="flex w-full items-center gap-2.5 rounded-xl px-3 py-2 text-left text-sm transition-colors hover:bg-[rgba(255,255,255,0.04)]"
                                style={{ color: active ? "#B8E7FF" : "#D0D0D0" }}
                              >
                                {customer.logoUrl ? (
                                  <img src={customer.logoUrl} alt={customer.name} className="h-5 w-5 rounded-full object-cover" />
                                ) : (
                                  <Avatar name={customer.name} size="xs" className="!h-5 !w-5 text-[8px]" />
                                )}
                                <span className="flex-1 truncate">{customer.name}</span>
                                <span className="rounded px-1 py-0.5 text-[10px] font-semibold text-[#777777]">
                                  {customer.visibleCount}
                                </span>
                                <span
                                  className="flex h-4 w-4 flex-shrink-0 items-center justify-center rounded-md border"
                                  style={{
                                    borderColor: active ? "rgba(125,211,252,0.5)" : "rgba(255,255,255,0.12)",
                                    backgroundColor: active ? "rgba(125,211,252,0.15)" : "transparent",
                                    color: active ? "#B8E7FF" : "transparent",
                                  }}
                                >
                                  <CheckCircle2 size={10} />
                                </span>
                              </button>
                            );
                          })}
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>

                <div className="ml-auto flex-shrink-0">
                  <button
                    type="button"
                    onClick={() => {
                      clearRepoFilter();
                      clearAssigneeFilter();
                      setSelectedCustomerId(null);
                      setSearchQuery("");
                    }}
                    disabled={selectedRepos.size === 0 && selectedCustomerId === null && selectedAssigneeIds.size === 0 && searchQuery.trim().length === 0}
                    className={cn(
                      "inline-flex items-center gap-1 rounded-lg px-2 py-1 text-xs transition-colors",
                      selectedRepos.size > 0 || selectedCustomerId !== null || selectedAssigneeIds.size > 0 || searchQuery.trim().length > 0
                        ? "text-[#606060] hover:bg-[rgba(255,255,255,0.04)] hover:text-[#F0F0F0]"
                        : "pointer-events-none invisible"
                    )}
                  >
                    <X size={11} />
                    Clear
                  </button>
                </div>

            </div>{/* end pills row */}
          </motion.div>
        </div>
      </motion.div>

      {/* ── List view ───────────────────────────────────────────────────────── */}
      {viewMode === "list" && (
        <KanbanListView
          cards={filteredCards}
          users={users}
          onUpdate={handleCardUpdate}
        />
      )}

      {/* ── Board ───────────────────────────────────────────────────────────── */}
      {viewMode === "board" && <motion.div
        className="max-sm:overflow-x-auto overflow-y-visible px-3 py-4 pb-6 sm:px-6"
        initial={{ opacity: 0, y: 18 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.48, delay: 0.2, ease: "easeOut" }}
      >
        <div className="flex w-max snap-x snap-mandatory gap-3 pb-1 sm:w-full sm:gap-4">
          {COLUMN_ORDER.map((colName, i) => (
            <div
              key={colName}
              className={cn(
                "snap-start flex-shrink-0 sm:min-w-0",
                colName === ACTIVE_COLUMN ? "sm:flex-[2.8]" : "sm:flex-[1.15]"
              )}
            >
              <motion.div
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.06, duration: 0.3, ease: "easeOut" }}
                className="h-full"
              >
                <KanbanColumn
                  name={colName}
                  cards={columnMap[colName] ?? []}
                  repos={repos}
                  users={users}
                  isDragOver={dragOverColumn === colName}
                  onDragOver={(event) => handleColumnDragOver(event, colName)}
                  onDrop={(event) => void handleColumnDrop(event, colName)}
                  onDelete={handleDelete}
                  onDragStart={handleDragStart}
                  onDragEnd={handleDragEnd}
                  availableCustomers={customers}
                  onUpdate={handleCardUpdate}
                  sprints={sprints}
                  onSprintChange={handleSprintChange}
                  currentUserId={currentUserId}
                  taskGroups={localTaskGroups}
                  onTaskGroupChange={handleTaskGroupChange}
                  taskGroupEntries={groupColumnMap[colName] ?? []}
                  onOpenGroup={setOpenGroupId}
                  onGroupDragStart={handleGroupDragStart}
                  onGroupDragEnd={handleGroupDragEnd}
                />
              </motion.div>
            </div>
          ))}

          {/* ── QA / Done drop zones ─────────────────────────────────────── */}
          <div className="flex snap-start items-stretch gap-3 sm:gap-4 sm:flex-none sm:w-52">
            <div className="hidden self-stretch py-1 sm:block">
              <div className="h-full w-px rounded-full bg-[linear-gradient(180deg,rgba(255,255,255,0.04),rgba(255,255,255,0.14),rgba(34,197,94,0.18),rgba(255,255,255,0.08))]" />
            </div>
            <div className="flex flex-1 min-w-0 flex-col gap-3 sm:gap-4">
              <motion.div
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: COLUMN_ORDER.length * 0.06, duration: 0.3, ease: "easeOut" }}
              >
                <QaDropZone
                  cardCount={(columnMap[QA_COLUMN] ?? []).length}
                  isDragOver={dragOverColumn === QA_COLUMN}
                  isDraggingActive={draggingCardId !== null || draggingGroupId !== null}
                  onDragOver={(event) => handleColumnDragOver(event, QA_COLUMN)}
                  onDrop={(event) => void handleColumnDrop(event, QA_COLUMN)}
                  onDragLeave={handleDoneDropZoneDragLeave}
                  onClick={() => setQaDrawerOpen(true)}
                />
              </motion.div>
              <motion.div
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: (COLUMN_ORDER.length + 1) * 0.06, duration: 0.3, ease: "easeOut" }}
              >
                <PoReviewDropZone
                  cardCount={(columnMap[PO_REVIEW_COLUMN] ?? []).length}
                  isDragOver={dragOverColumn === PO_REVIEW_COLUMN}
                  isDraggingActive={draggingCardId !== null || draggingGroupId !== null}
                  onDragOver={(event) => handleColumnDragOver(event, PO_REVIEW_COLUMN)}
                  onDrop={(event) => void handleColumnDrop(event, PO_REVIEW_COLUMN)}
                  onDragLeave={handleDoneDropZoneDragLeave}
                  onClick={() => setPoReviewDrawerOpen(true)}
                />
              </motion.div>
              <motion.div
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: (COLUMN_ORDER.length + 2) * 0.06, duration: 0.3, ease: "easeOut" }}
              >
                <DoneDropZone
                  cardCount={(columnMap[COMPLETED_COLUMN] ?? []).length}
                  isDragOver={dragOverColumn === COMPLETED_COLUMN}
                  isDraggingActive={draggingCardId !== null || draggingGroupId !== null}
                  onDragOver={(event) => handleColumnDragOver(event, COMPLETED_COLUMN)}
                  onDrop={(event) => void handleColumnDrop(event, COMPLETED_COLUMN)}
                  onDragLeave={handleDoneDropZoneDragLeave}
                  onClick={() => setCompletedDrawerOpen(true)}
                />
              </motion.div>
            </div>
          </div>
        </div>
      </motion.div>}

      <AnimatePresence>
        {createDrawerOpen && (
          <KanbanCardDrawer
            key="global-create-task"
            open
            mode="create"
            card={null}
            users={users}
            sprints={sprints}
            customers={customers}
            repoOptions={createDrawerRepos.map((repo) => ({
              id: repo.id,
              name: repo.name,
              fullName: repo.fullName,
              columns: repo.columns,
            }))}
            currentUserId={currentUserId}
            taskGroups={localTaskGroups}
            onClose={() => setCreateDrawerOpen(false)}
            onSaved={() => undefined}
            onCreated={(task) => {
              handleTaskCreated(task);
              setCreateDrawerOpen(false);
            }}
            onDelete={() => undefined}
            onSprintChange={() => undefined}
            onTaskGroupChange={handleTaskGroupChange}
          />
        )}
      </AnimatePresence>

      <QaTasksDrawer
        open={qaDrawerOpen}
        onClose={() => setQaDrawerOpen(false)}
        cards={columnMap[QA_COLUMN] ?? []}
        repos={repos}
        users={users}
        onDelete={handleDelete}
        onDragStart={handleDragStart}
        onDragEnd={handleDragEnd}
        availableCustomers={customers}
        onUpdate={handleCardUpdate}
        sprints={sprints}
        onSprintChange={handleSprintChange}
        currentUserId={currentUserId}
        onReject={handleQaReject}
        onMoveToPo={handleQaMoveToPoReview}
        onComplete={handleQaComplete}
        actioningCardId={qaActioningCardId}
        actioningCardAction={qaActioningCardAction}
        taskGroupEntries={groupColumnMap[QA_COLUMN] ?? []}
        onOpenGroup={setOpenGroupId}
      />

      <PoReviewTasksDrawer
        open={poReviewDrawerOpen}
        onClose={() => setPoReviewDrawerOpen(false)}
        cards={columnMap[PO_REVIEW_COLUMN] ?? []}
        repos={repos}
        users={users}
        onDelete={handleDelete}
        onDragStart={handleDragStart}
        onDragEnd={handleDragEnd}
        availableCustomers={customers}
        onUpdate={handleCardUpdate}
        sprints={sprints}
        onSprintChange={handleSprintChange}
        currentUserId={currentUserId}
        onReject={handlePoReviewReject}
        onComplete={handlePoReviewComplete}
        actioningCardId={poActioningCardId}
        actioningCardAction={poActioningCardAction}
        taskGroupEntries={groupColumnMap[PO_REVIEW_COLUMN] ?? []}
        onOpenGroup={setOpenGroupId}
      />

      <CompletedTasksDrawer
        open={completedDrawerOpen}
        onClose={() => setCompletedDrawerOpen(false)}
        cards={columnMap[COMPLETED_COLUMN] ?? []}
        repos={repos}
        users={users}
        onDelete={handleDelete}
        onDragStart={handleDragStart}
        onDragEnd={handleDragEnd}
        availableCustomers={customers}
        onUpdate={handleCardUpdate}
        onReopen={handleReopen}
        reopeningCardId={reopeningCardId}
        sprints={sprints}
        onSprintChange={handleSprintChange}
        currentUserId={currentUserId}
        taskGroupEntries={groupColumnMap[COMPLETED_COLUMN] ?? []}
        onOpenGroup={setOpenGroupId}
      />

      <GroupTaskDrawer
        open={openGroupId !== null}
        onClose={() => setOpenGroupId(null)}
        group={localTaskGroups.find((g) => g.id === openGroupId) ?? null}
        cards={openGroupId ? localCards.filter((c) => c.taskGroupId === openGroupId) : []}
        users={users}
        repos={repos}
        sprints={sprints}
        customers={customers}
        currentUserId={currentUserId}
        taskGroups={localTaskGroups}
        onCardUpdate={handleCardUpdate}
        onCardDelete={handleDelete}
        onSprintChange={handleSprintChange}
        onTaskGroupChange={handleTaskGroupChange}
      />
    </div>
  );
}
