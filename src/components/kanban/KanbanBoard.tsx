"use client";

// Per-repo Kanban board — standardized to match GlobalKanbanClient layout.
// Columns: [Backlog] [Research] [In Progress] | [QA] [PO Review] [Done] (drop zones)
// Task groups shown as cards within each column; clicking opens a card-level drawer.

import { useState, useEffect, useMemo } from "react";
import { createPortal } from "react-dom";
import { motion, AnimatePresence } from "framer-motion";
import {
  Plus, Loader2, RefreshCw, AlertTriangle, Layers, X,
  CheckCircle2, Clock, FlaskConical, Circle, RotateCcw, UserCheck,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/Button";
import { KanbanCard } from "./KanbanCard";
import type { KanbanCardData } from "./KanbanCard";
import type { KanbanCustomer } from "./KanbanCustomerField";
import { KanbanCardDrawer } from "./KanbanCardDrawer";
import type { KanbanDrawerRepoOption } from "./KanbanCardDrawer";
import { TaskGroupKanbanCard } from "./TaskGroupKanbanCard";
import { type TaskGroupData } from "./TaskGroupRow";
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

interface SprintTask {
  id: string;
  sprintId: string;
  sprint: { id: string; name: string; status: string };
}

interface Note {
  id: string;
  body: string;
  image?: string | null;
  createdAt: string | Date;
  author: { id: string; name: string | null; displayName?: string | null; image: string | null; email: string };
}

interface Card {
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
  notes: Note[];
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
  sprintTask: SprintTask | null;
  taskGroupId: string | null;
  taskGroup: { id: string; name: string; status: string; color: string | null } | null;
}

// Card enriched with column context (needed for drawer and group map)
type EnrichedCard = Card & { columnId: string; columnName: string; columnPosition: number };

interface User {
  id: string;
  name: string | null;
  displayName: string | null;
  email: string;
  image: string | null;
}

interface Column {
  id: string;
  name: string;
  color: string;
  position: number;
  cards: Card[];
}

interface Board {
  id: string;
  name: string;
  columns: Column[];
}

// ─── Constants ────────────────────────────────────────────────────────────────

const COLUMN_ORDER = [...PRIMARY_KANBAN_COLUMNS];
const COMPLETED_COLUMN = DONE_COLUMN;

const GROUP_STATUS_TO_COLUMN: Record<string, string> = {
  backlog: BACKLOG_COLUMN,
  research: ACTIVE_COLUMN,
  "in-progress": ACTIVE_COLUMN,
  "in-qa": QA_COLUMN,
  "po-review": PO_REVIEW_COLUMN,
  done: DONE_COLUMN,
  blocked: BACKLOG_COLUMN,
};

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

const PRIORITY_ORDER: Record<string, number> = { critical: 0, high: 1, medium: 2, low: 3 };
function getPriorityRank(p: string) { return PRIORITY_ORDER[p] ?? 99; }

// ─── Board Column ─────────────────────────────────────────────────────────────

function BoardColumn({
  name,
  cards,
  users,
  isDragOver,
  onDragOver,
  onDrop,
  onDelete,
  onDragStart,
  onDragEnd,
  availableCustomers,
  onUpdate,
  onSprintChange,
  repoOption,
  currentUserId,
  taskGroups,
  onTaskGroupChange,
  taskGroupEntries,
  onOpenGroup,
  onGroupDragStart,
  onGroupDragEnd,
}: {
  name: string;
  cards: EnrichedCard[];
  users: User[];
  isDragOver: boolean;
  onDragOver: (event: React.DragEvent<HTMLDivElement>) => void;
  onDrop: (event: React.DragEvent<HTMLDivElement>) => void;
  onDelete: (card: Card) => Promise<boolean | void>;
  onDragStart: (card: EnrichedCard) => void;
  onDragEnd: () => void;
  availableCustomers: KanbanCustomer[];
  onUpdate: (cardId: string, updates: Partial<Card>) => void;
  onSprintChange: (cardId: string, sprintTask: SprintTask | null) => void;
  repoOption: KanbanDrawerRepoOption;
  currentUserId: string | null;
  taskGroups: TaskGroupData[];
  onTaskGroupChange: (cardId: string, taskGroupId: string | null) => void;
  taskGroupEntries: Array<{ group: TaskGroupData; cards: EnrichedCard[] }>;
  onOpenGroup: (groupId: string) => void;
  onGroupDragStart: (groupId: string) => void;
  onGroupDragEnd: () => void;
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
        className="flex max-h-[calc(100vh-340px)] flex-col overflow-hidden rounded-2xl border transition-colors"
        style={{ borderColor: isDragOver ? style.accent : "rgba(255,255,255,0.06)" }}
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

        {/* Cards */}
        <div className="flex-1 overflow-y-auto p-2 space-y-2 bg-[#111111]">
          {/* Task group cards */}
          <AnimatePresence initial={false}>
            {taskGroupEntries.map(({ group, cards: groupCards }) => (
              <TaskGroupKanbanCard
                key={`group-${group.id}`}
                group={group}
                cards={groupCards}
                users={users}
                onClick={() => onOpenGroup(group.id)}
                onDragStart={() => onGroupDragStart(group.id)}
                onDragEnd={onGroupDragEnd}
              />
            ))}
          </AnimatePresence>

          {/* Individual cards */}
          <AnimatePresence initial={false}>
            {cards.map((card) => (
              <KanbanCard
                key={card.id}
                card={card as KanbanCardData}
                sprints={[]}
                users={users}
                onDragStart={() => onDragStart(card)}
                onDragEnd={onDragEnd}
                onSprintChange={onSprintChange}
                onDelete={(c) => onDelete(c as Card)}
                onUpdate={(id, updates) => onUpdate(id, updates as Partial<Card>)}
                columnAccent={style.accent}
                availableCustomers={availableCustomers}
                repoOptions={[repoOption]}
                currentUserId={currentUserId}
                variant={name === ACTIVE_COLUMN ? "active" : "default"}
                taskGroups={taskGroups}
                onTaskGroupChange={onTaskGroupChange}
              />
            ))}
          </AnimatePresence>

          {totalCount === 0 && !isDragOver && (
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

// ─── QA Drop Zone ─────────────────────────────────────────────────────────────

function QaDropZone({
  cardCount, isDragOver, isDraggingActive, onDragOver, onDrop, onDragLeave, onClick,
}: {
  cardCount: number; isDragOver: boolean; isDraggingActive: boolean;
  onDragOver: (e: React.DragEvent<HTMLDivElement>) => void;
  onDrop: (e: React.DragEvent<HTMLDivElement>) => void;
  onDragLeave: () => void; onClick: () => void;
}) {
  const accent = "#3B82F6";
  return (
    <div
      role="button" tabIndex={0}
      onClick={onClick}
      onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") onClick(); }}
      onDragOver={onDragOver} onDrop={onDrop} onDragLeave={onDragLeave}
      className={cn(
        "group relative overflow-hidden flex flex-col items-center justify-between rounded-2xl transition-all duration-300 cursor-pointer select-none py-3",
        "w-[84vw] max-w-[340px] min-h-[110px] sm:w-full sm:max-w-none",
        isDragOver || isDraggingActive ? "border-2 border-dashed" : "border border-solid"
      )}
      style={{
        borderColor: isDragOver ? accent : isDraggingActive ? `${accent}66` : `${accent}22`,
        background: isDragOver
          ? `linear-gradient(160deg, ${accent}18 0%, rgba(14,18,28,0.98) 100%)`
          : isDraggingActive
            ? `linear-gradient(160deg, ${accent}0e 0%, rgba(12,14,22,0.98) 100%)`
            : "linear-gradient(160deg, rgba(59,130,246,0.07) 0%, rgba(10,12,20,0.98) 100%)",
        boxShadow: isDragOver ? `0 0 40px ${accent}28, inset 0 1px 0 ${accent}30` : isDraggingActive ? `0 0 20px ${accent}14` : `inset 0 1px 0 ${accent}14`,
      }}
    >
      <div className="pointer-events-none absolute top-0 left-1/2 -translate-x-1/2 h-36 w-36 rounded-full blur-3xl transition-opacity duration-300"
        style={{ backgroundColor: accent, opacity: isDragOver ? 0.16 : isDraggingActive ? 0.09 : 0.05 }} />
      <div className="absolute inset-x-0 top-0 h-px"
        style={{ background: `linear-gradient(90deg, transparent, ${accent}${isDragOver ? "cc" : isDraggingActive ? "77" : "44"}, transparent)` }} />
      <div className="relative flex flex-col items-center gap-2">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl border transition-all duration-300"
          style={{ borderColor: isDragOver ? `${accent}99` : `${accent}33`, backgroundColor: isDragOver ? `${accent}28` : `${accent}12`, boxShadow: isDragOver ? `0 0 24px ${accent}44, inset 0 1px 0 ${accent}33` : `inset 0 1px 0 ${accent}18` }}>
          <FlaskConical size={17} style={{ color: isDragOver ? accent : isDraggingActive ? `${accent}dd` : `${accent}99` }} />
        </div>
        <div className="flex flex-col items-center gap-1.5">
          <span className="text-sm font-bold tracking-tight text-[#E8E8E8]">QA Testing</span>
          <span className="px-3 py-0.5 rounded-full text-xs font-bold tabular-nums transition-all duration-300"
            style={{ color: accent, backgroundColor: isDragOver ? `${accent}30` : `${accent}18`, boxShadow: isDragOver ? `0 0 10px ${accent}44` : undefined }}>
            {cardCount}
          </span>
        </div>
      </div>
      <AnimatePresence mode="wait">
        {isDragOver ? (
          <motion.div key="release" initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
            className="relative flex items-center gap-1.5 rounded-lg px-3 py-1" style={{ backgroundColor: `${accent}18` }}>
            <span className="text-xs font-semibold" style={{ color: accent }}>Release for QA</span>
          </motion.div>
        ) : isDraggingActive ? (
          <motion.p key="drop" initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
            className="relative text-xs font-medium" style={{ color: `${accent}77` }}>Drop for QA</motion.p>
        ) : (
          <motion.p key="click" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="relative text-xs text-[#404040] transition-colors duration-200 group-hover:text-[#606060]">Click to view</motion.p>
        )}
      </AnimatePresence>
    </div>
  );
}

// ─── PO Review Drop Zone ──────────────────────────────────────────────────────

function PoReviewDropZone({
  cardCount, isDragOver, isDraggingActive, onDragOver, onDrop, onDragLeave, onClick,
}: {
  cardCount: number; isDragOver: boolean; isDraggingActive: boolean;
  onDragOver: (e: React.DragEvent<HTMLDivElement>) => void;
  onDrop: (e: React.DragEvent<HTMLDivElement>) => void;
  onDragLeave: () => void; onClick: () => void;
}) {
  const accent = "#EAB308";
  return (
    <div
      role="button" tabIndex={0}
      onClick={onClick}
      onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") onClick(); }}
      onDragOver={onDragOver} onDrop={onDrop} onDragLeave={onDragLeave}
      className={cn(
        "group relative overflow-hidden flex flex-col items-center justify-between rounded-2xl transition-all duration-300 cursor-pointer select-none py-3",
        "w-[84vw] max-w-[340px] min-h-[110px] sm:w-full sm:max-w-none",
        isDragOver || isDraggingActive ? "border-2 border-dashed" : "border border-solid"
      )}
      style={{
        borderColor: isDragOver ? accent : isDraggingActive ? `${accent}66` : `${accent}22`,
        background: isDragOver
          ? `linear-gradient(160deg, ${accent}18 0%, rgba(20,18,10,0.98) 100%)`
          : isDraggingActive
            ? `linear-gradient(160deg, ${accent}0e 0%, rgba(16,14,8,0.98) 100%)`
            : "linear-gradient(160deg, rgba(234,179,8,0.07) 0%, rgba(12,12,10,0.98) 100%)",
        boxShadow: isDragOver ? `0 0 40px ${accent}28, inset 0 1px 0 ${accent}30` : isDraggingActive ? `0 0 20px ${accent}14` : `inset 0 1px 0 ${accent}14`,
      }}
    >
      <div className="pointer-events-none absolute top-0 left-1/2 -translate-x-1/2 h-36 w-36 rounded-full blur-3xl transition-opacity duration-300"
        style={{ backgroundColor: accent, opacity: isDragOver ? 0.16 : isDraggingActive ? 0.09 : 0.05 }} />
      <div className="absolute inset-x-0 top-0 h-px"
        style={{ background: `linear-gradient(90deg, transparent, ${accent}${isDragOver ? "cc" : isDraggingActive ? "77" : "44"}, transparent)` }} />
      <div className="relative flex flex-col items-center gap-2">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl border transition-all duration-300"
          style={{ borderColor: isDragOver ? `${accent}99` : `${accent}33`, backgroundColor: isDragOver ? `${accent}28` : `${accent}12`, boxShadow: isDragOver ? `0 0 24px ${accent}44, inset 0 1px 0 ${accent}33` : `inset 0 1px 0 ${accent}18` }}>
          <UserCheck size={17} style={{ color: isDragOver ? accent : isDraggingActive ? `${accent}dd` : `${accent}99` }} />
        </div>
        <div className="flex flex-col items-center gap-1.5">
          <span className="text-sm font-bold tracking-tight text-[#E8E8E8]">PO Review</span>
          <span className="px-3 py-0.5 rounded-full text-xs font-bold tabular-nums transition-all duration-300"
            style={{ color: accent, backgroundColor: isDragOver ? `${accent}30` : `${accent}18`, boxShadow: isDragOver ? `0 0 10px ${accent}44` : undefined }}>
            {cardCount}
          </span>
        </div>
      </div>
      <AnimatePresence mode="wait">
        {isDragOver ? (
          <motion.div key="release" initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
            className="relative flex items-center gap-1.5 rounded-lg px-3 py-1" style={{ backgroundColor: `${accent}18` }}>
            <span className="text-xs font-semibold" style={{ color: accent }}>Send to PO Review</span>
          </motion.div>
        ) : isDraggingActive ? (
          <motion.p key="drop" initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
            className="relative text-xs font-medium" style={{ color: `${accent}77` }}>Drop for PO Review</motion.p>
        ) : (
          <motion.p key="click" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="relative text-xs text-[#404040] transition-colors duration-200 group-hover:text-[#606060]">Click to view</motion.p>
        )}
      </AnimatePresence>
    </div>
  );
}

// ─── Done Drop Zone ───────────────────────────────────────────────────────────

function DoneDropZone({
  cardCount, isDragOver, isDraggingActive, onDragOver, onDrop, onDragLeave, onClick,
}: {
  cardCount: number; isDragOver: boolean; isDraggingActive: boolean;
  onDragOver: (e: React.DragEvent<HTMLDivElement>) => void;
  onDrop: (e: React.DragEvent<HTMLDivElement>) => void;
  onDragLeave: () => void; onClick: () => void;
}) {
  const accent = "#22C55E";
  return (
    <div
      role="button" tabIndex={0}
      onClick={onClick}
      onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") onClick(); }}
      onDragOver={onDragOver} onDrop={onDrop} onDragLeave={onDragLeave}
      className={cn(
        "group relative overflow-hidden flex flex-col items-center justify-between rounded-2xl transition-all duration-300 cursor-pointer select-none py-3",
        "w-[84vw] max-w-[340px] min-h-[110px] sm:w-full sm:max-w-none",
        isDragOver || isDraggingActive ? "border-2 border-dashed" : "border border-solid"
      )}
      style={{
        borderColor: isDragOver ? accent : isDraggingActive ? `${accent}66` : `${accent}22`,
        background: isDragOver
          ? `linear-gradient(160deg, ${accent}18 0%, rgba(10,20,14,0.98) 100%)`
          : isDraggingActive
            ? `linear-gradient(160deg, ${accent}0e 0%, rgba(10,16,12,0.98) 100%)`
            : "linear-gradient(160deg, rgba(34,197,94,0.07) 0%, rgba(10,14,11,0.98) 100%)",
        boxShadow: isDragOver ? `0 0 40px ${accent}28, inset 0 1px 0 ${accent}30` : isDraggingActive ? `0 0 20px ${accent}14` : `inset 0 1px 0 ${accent}14`,
      }}
    >
      <div className="pointer-events-none absolute top-0 left-1/2 -translate-x-1/2 h-36 w-36 rounded-full blur-3xl transition-opacity duration-300"
        style={{ backgroundColor: accent, opacity: isDragOver ? 0.18 : isDraggingActive ? 0.11 : 0.06 }} />
      <div className="absolute inset-x-0 top-0 h-px"
        style={{ background: `linear-gradient(90deg, transparent, ${accent}${isDragOver ? "cc" : isDraggingActive ? "77" : "44"}, transparent)` }} />
      <div className="relative flex flex-col items-center gap-2">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl border transition-all duration-300"
          style={{ borderColor: isDragOver ? `${accent}99` : `${accent}33`, backgroundColor: isDragOver ? `${accent}28` : `${accent}12`, boxShadow: isDragOver ? `0 0 24px ${accent}44, inset 0 1px 0 ${accent}33` : `inset 0 1px 0 ${accent}18` }}>
          <CheckCircle2 size={17} style={{ color: isDragOver ? accent : isDraggingActive ? `${accent}dd` : `${accent}99` }} />
        </div>
        <div className="flex flex-col items-center gap-2">
          <span className="text-base font-bold tracking-tight text-[#E8E8E8]">Done</span>
          <span className="px-3 py-0.5 rounded-full text-xs font-bold tabular-nums transition-all duration-300"
            style={{ color: accent, backgroundColor: isDragOver ? `${accent}30` : `${accent}18`, boxShadow: isDragOver ? `0 0 10px ${accent}44` : undefined }}>
            {cardCount}
          </span>
        </div>
      </div>
      <AnimatePresence mode="wait">
        {isDragOver ? (
          <motion.div key="release" initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
            className="relative flex items-center gap-1.5 rounded-lg px-3 py-1" style={{ backgroundColor: `${accent}18` }}>
            <span className="text-xs font-semibold" style={{ color: accent }}>Release to complete</span>
          </motion.div>
        ) : isDraggingActive ? (
          <motion.p key="drop" initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
            className="relative text-xs font-medium" style={{ color: `${accent}77` }}>Drop to complete</motion.p>
        ) : (
          <motion.p key="click" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="relative text-xs text-[#404040] transition-colors duration-200 group-hover:text-[#606060]">Click to view</motion.p>
        )}
      </AnimatePresence>
    </div>
  );
}

// ─── QA Tasks Drawer ──────────────────────────────────────────────────────────

function QaTasksDrawer({
  open, onClose, cards, users, onDelete, onDragStart, onDragEnd,
  availableCustomers, onUpdate, onSprintChange, repoOption, currentUserId,
  onReject, onMoveToPo, onComplete, actioningCardId, actioningCardAction,
  taskGroupEntries, onOpenGroup, taskGroups, onTaskGroupChange,
}: {
  open: boolean; onClose: () => void;
  cards: EnrichedCard[]; users: User[];
  onDelete: (card: Card) => Promise<boolean | void>;
  onDragStart: (card: EnrichedCard) => void; onDragEnd: () => void;
  availableCustomers: KanbanCustomer[];
  onUpdate: (cardId: string, updates: Partial<Card>) => void;
  onSprintChange: (cardId: string, sprintTask: SprintTask | null) => void;
  repoOption: KanbanDrawerRepoOption; currentUserId: string | null;
  onReject: (card: Card) => Promise<void>;
  onMoveToPo: (card: Card) => Promise<void>;
  onComplete: (card: Card) => Promise<void>;
  actioningCardId: string | null;
  actioningCardAction: "reject" | "po-review" | "complete" | null;
  taskGroupEntries: Array<{ group: TaskGroupData; cards: EnrichedCard[] }>;
  onOpenGroup: (groupId: string) => void;
  taskGroups: TaskGroupData[];
  onTaskGroupChange: (cardId: string, taskGroupId: string | null) => void;
}) {
  if (typeof window === "undefined") return null;
  const totalCount = cards.length + taskGroupEntries.length;
  const accent = "#3B82F6";

  return createPortal(
    <AnimatePresence>
      {open && (
        <>
          <motion.div key="qa-backdrop" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            transition={{ duration: 0.22 }}
            className="fixed inset-0 z-40 bg-black/40 backdrop-blur-[2px]" onClick={onClose} />
          <motion.div key="qa-drawer" initial={{ x: "100%" }} animate={{ x: 0 }} exit={{ x: "100%" }}
            transition={{ type: "spring", damping: 30, stiffness: 300 }}
            className="fixed right-0 top-0 z-50 flex h-full w-full max-w-sm flex-col border-l border-[rgba(255,255,255,0.07)] bg-[#111111] shadow-2xl sm:max-w-md">
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
              <button onClick={onClose} className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-[#555555] transition-colors hover:bg-[rgba(255,255,255,0.05)] hover:text-[#F0F0F0]" aria-label="Close">
                <X size={16} />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto p-3 space-y-2">
              {taskGroupEntries.map(({ group, cards: groupCards }) => (
                <TaskGroupKanbanCard key={`group-${group.id}`} group={group} cards={groupCards} users={users} draggable={false} onClick={() => onOpenGroup(group.id)} />
              ))}
              {taskGroupEntries.length > 0 && cards.length > 0 && (
                <div className="flex items-center gap-2 py-1">
                  <div className="h-px flex-1 bg-[rgba(255,255,255,0.05)]" />
                  <span className="text-[10px] text-[#404040]">Tasks</span>
                  <div className="h-px flex-1 bg-[rgba(255,255,255,0.05)]" />
                </div>
              )}
              {totalCount === 0 ? (
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
                      <KanbanCard
                        key={card.id}
                        card={card as KanbanCardData}
                        sprints={[]}
                        users={users}
                        onDragStart={() => onDragStart(card)}
                        onDragEnd={onDragEnd}
                        onSprintChange={onSprintChange}
                        onDelete={(c) => onDelete(c as Card)}
                        onUpdate={(id, updates) => onUpdate(id, updates as Partial<Card>)}
                        columnAccent={accent}
                        availableCustomers={availableCustomers}
                        repoOptions={[repoOption]}
                        currentUserId={currentUserId}
                        compact
                        taskGroups={taskGroups}
                        onTaskGroupChange={onTaskGroupChange}
                        footerAction={
                          <div className="flex items-center gap-1.5">
                            <button onClick={() => void onReject(card)} disabled={isActioning}
                              className="flex flex-1 items-center justify-center gap-1.5 rounded-md py-0.5 text-[10px] font-medium text-[#F87171] transition-colors hover:bg-[rgba(248,113,113,0.1)] disabled:opacity-40 disabled:cursor-not-allowed">
                              <X size={9} className={isRejecting ? "animate-spin" : ""} />
                              {isRejecting ? "Moving…" : "Reject"}
                            </button>
                            <div className="h-3 w-px bg-[rgba(255,255,255,0.08)]" />
                            <button onClick={() => void onMoveToPo(card)} disabled={isActioning}
                              className="flex flex-1 items-center justify-center gap-1.5 rounded-md py-0.5 text-[10px] font-medium text-[#FDE047] transition-colors hover:bg-[rgba(234,179,8,0.1)] disabled:opacity-40 disabled:cursor-not-allowed">
                              <UserCheck size={9} className={isMovingToPo ? "animate-spin" : ""} />
                              {isMovingToPo ? "Moving…" : "PO Review"}
                            </button>
                            <div className="h-3 w-px bg-[rgba(255,255,255,0.08)]" />
                            <button onClick={() => void onComplete(card)} disabled={isActioning}
                              className="flex flex-1 items-center justify-center gap-1.5 rounded-md py-0.5 text-[10px] font-medium text-[#4ADE80] transition-colors hover:bg-[rgba(74,222,128,0.1)] disabled:opacity-40 disabled:cursor-not-allowed">
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
  open, onClose, cards, users, onDelete, onDragStart, onDragEnd,
  availableCustomers, onUpdate, onSprintChange, repoOption, currentUserId,
  onReject, onComplete, actioningCardId, actioningCardAction,
  taskGroupEntries, onOpenGroup, taskGroups, onTaskGroupChange,
}: {
  open: boolean; onClose: () => void;
  cards: EnrichedCard[]; users: User[];
  onDelete: (card: Card) => Promise<boolean | void>;
  onDragStart: (card: EnrichedCard) => void; onDragEnd: () => void;
  availableCustomers: KanbanCustomer[];
  onUpdate: (cardId: string, updates: Partial<Card>) => void;
  onSprintChange: (cardId: string, sprintTask: SprintTask | null) => void;
  repoOption: KanbanDrawerRepoOption; currentUserId: string | null;
  onReject: (card: Card) => Promise<void>;
  onComplete: (card: Card) => Promise<void>;
  actioningCardId: string | null;
  actioningCardAction: "reject" | "complete" | null;
  taskGroupEntries: Array<{ group: TaskGroupData; cards: EnrichedCard[] }>;
  onOpenGroup: (groupId: string) => void;
  taskGroups: TaskGroupData[];
  onTaskGroupChange: (cardId: string, taskGroupId: string | null) => void;
}) {
  if (typeof window === "undefined") return null;
  const totalCount = cards.length + taskGroupEntries.length;
  const accent = "#EAB308";

  return createPortal(
    <AnimatePresence>
      {open && (
        <>
          <motion.div key="po-backdrop" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            transition={{ duration: 0.22 }}
            className="fixed inset-0 z-40 bg-black/40 backdrop-blur-[2px]" onClick={onClose} />
          <motion.div key="po-drawer" initial={{ x: "100%" }} animate={{ x: 0 }} exit={{ x: "100%" }}
            transition={{ type: "spring", damping: 30, stiffness: 300 }}
            className="fixed right-0 top-0 z-50 flex h-full w-full max-w-sm flex-col border-l border-[rgba(255,255,255,0.07)] bg-[#111111] shadow-2xl sm:max-w-md">
            <div className="flex flex-shrink-0 items-center justify-between border-b border-[rgba(255,255,255,0.06)] px-5 py-4">
              <div className="flex items-center gap-2.5">
                <div className="flex h-8 w-8 items-center justify-center rounded-xl border"
                  style={{ borderColor: "rgba(234,179,8,0.22)", backgroundColor: "rgba(234,179,8,0.12)" }}>
                  <UserCheck size={15} style={{ color: accent }} />
                </div>
                <div>
                  <h2 className="text-sm font-bold text-[#F0F0F0]">PO Review</h2>
                  <p className="text-[11px] text-[#555555]">{totalCount} item{totalCount !== 1 ? "s" : ""}</p>
                </div>
              </div>
              <button onClick={onClose} className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-[#555555] transition-colors hover:bg-[rgba(255,255,255,0.05)] hover:text-[#F0F0F0]" aria-label="Close">
                <X size={16} />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto p-3 space-y-2">
              {taskGroupEntries.map(({ group, cards: groupCards }) => (
                <TaskGroupKanbanCard key={`group-${group.id}`} group={group} cards={groupCards} users={users} draggable={false} onClick={() => onOpenGroup(group.id)} />
              ))}
              {taskGroupEntries.length > 0 && cards.length > 0 && (
                <div className="flex items-center gap-2 py-1">
                  <div className="h-px flex-1 bg-[rgba(255,255,255,0.05)]" />
                  <span className="text-[10px] text-[#404040]">Tasks</span>
                  <div className="h-px flex-1 bg-[rgba(255,255,255,0.05)]" />
                </div>
              )}
              {totalCount === 0 ? (
                <div className="flex h-40 flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-[rgba(255,255,255,0.06)] text-[#333333]">
                  <UserCheck size={24} style={{ color: "rgba(234,179,8,0.55)" }} />
                  <p className="text-xs">No PO Review items</p>
                </div>
              ) : (
                <AnimatePresence initial={false}>
                  {cards.map((card) => {
                    const isActioning = actioningCardId === card.id;
                    const isRejecting = isActioning && actioningCardAction === "reject";
                    const isCompleting = isActioning && actioningCardAction === "complete";
                    return (
                      <KanbanCard
                        key={card.id}
                        card={card as KanbanCardData}
                        sprints={[]}
                        users={users}
                        onDragStart={() => onDragStart(card)}
                        onDragEnd={onDragEnd}
                        onSprintChange={onSprintChange}
                        onDelete={(c) => onDelete(c as Card)}
                        onUpdate={(id, updates) => onUpdate(id, updates as Partial<Card>)}
                        columnAccent={accent}
                        availableCustomers={availableCustomers}
                        repoOptions={[repoOption]}
                        currentUserId={currentUserId}
                        compact
                        taskGroups={taskGroups}
                        onTaskGroupChange={onTaskGroupChange}
                        footerAction={
                          <div className="flex items-center gap-1.5">
                            <button onClick={() => void onReject(card)} disabled={isActioning}
                              className="flex flex-1 items-center justify-center gap-1.5 rounded-md py-0.5 text-[10px] font-medium text-[#F87171] transition-colors hover:bg-[rgba(248,113,113,0.1)] disabled:opacity-40 disabled:cursor-not-allowed">
                              <X size={9} className={isRejecting ? "animate-spin" : ""} />
                              {isRejecting ? "Moving…" : "Reject"}
                            </button>
                            <div className="h-3 w-px bg-[rgba(255,255,255,0.08)]" />
                            <button onClick={() => void onComplete(card)} disabled={isActioning}
                              className="flex flex-1 items-center justify-center gap-1.5 rounded-md py-0.5 text-[10px] font-medium text-[#4ADE80] transition-colors hover:bg-[rgba(74,222,128,0.1)] disabled:opacity-40 disabled:cursor-not-allowed">
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

// ─── Completed Tasks Drawer ───────────────────────────────────────────────────

const REOPEN_COLUMNS = [
  { name: ACTIVE_COLUMN, accent: "#F7941D", icon: <Clock size={11} /> },
  { name: PO_REVIEW_COLUMN, accent: "#EAB308", icon: <UserCheck size={11} /> },
  { name: QA_COLUMN, accent: "#3B82F6", icon: <FlaskConical size={11} /> },
  { name: BACKLOG_COLUMN, accent: "#555555", icon: <Circle size={11} /> },
];

function CompletedTasksDrawer({
  open, onClose, cards, users, onDelete, onDragStart, onDragEnd,
  availableCustomers, onUpdate, onSprintChange, repoOption, currentUserId,
  onReopen, reopeningCardId, taskGroupEntries, onOpenGroup, taskGroups, onTaskGroupChange,
}: {
  open: boolean; onClose: () => void;
  cards: EnrichedCard[]; users: User[];
  onDelete: (card: Card) => Promise<boolean | void>;
  onDragStart: (card: EnrichedCard) => void; onDragEnd: () => void;
  availableCustomers: KanbanCustomer[];
  onUpdate: (cardId: string, updates: Partial<Card>) => void;
  onSprintChange: (cardId: string, sprintTask: SprintTask | null) => void;
  repoOption: KanbanDrawerRepoOption; currentUserId: string | null;
  onReopen: (card: Card, targetColumn: string) => Promise<void>;
  reopeningCardId: string | null;
  taskGroupEntries: Array<{ group: TaskGroupData; cards: EnrichedCard[] }>;
  onOpenGroup: (groupId: string) => void;
  taskGroups: TaskGroupData[];
  onTaskGroupChange: (cardId: string, taskGroupId: string | null) => void;
}) {
  if (typeof window === "undefined") return null;
  const [pickerCardId, setPickerCardId] = useState<string | null>(null);
  const totalCount = cards.length + taskGroupEntries.length;
  const accent = "#22C55E";

  return createPortal(
    <AnimatePresence>
      {open && (
        <>
          <motion.div key="done-backdrop" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            transition={{ duration: 0.22 }}
            className="fixed inset-0 z-40 bg-black/40 backdrop-blur-[2px]" onClick={onClose} />
          <motion.div key="done-drawer" initial={{ x: "100%" }} animate={{ x: 0 }} exit={{ x: "100%" }}
            transition={{ type: "spring", damping: 30, stiffness: 300 }}
            className="fixed right-0 top-0 z-50 flex h-full w-full max-w-sm flex-col border-l border-[rgba(255,255,255,0.07)] bg-[#111111] shadow-2xl sm:max-w-md">
            <div className="flex flex-shrink-0 items-center justify-between border-b border-[rgba(255,255,255,0.06)] px-5 py-4">
              <div className="flex items-center gap-2.5">
                <div className="flex h-8 w-8 items-center justify-center rounded-xl border border-[rgba(34,197,94,0.22)] bg-[rgba(34,197,94,0.12)]">
                  <CheckCircle2 size={15} className="text-[#22C55E]" />
                </div>
                <div>
                  <h2 className="text-sm font-bold text-[#F0F0F0]">Done</h2>
                  <p className="text-[11px] text-[#555555]">{totalCount} item{totalCount !== 1 ? "s" : ""}</p>
                </div>
              </div>
              <button onClick={onClose} className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-[#555555] transition-colors hover:bg-[rgba(255,255,255,0.05)] hover:text-[#F0F0F0]" aria-label="Close">
                <X size={16} />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto p-3 space-y-2">
              {taskGroupEntries.map(({ group, cards: groupCards }) => (
                <TaskGroupKanbanCard key={`group-${group.id}`} group={group} cards={groupCards} users={users} draggable={false} onClick={() => onOpenGroup(group.id)} />
              ))}
              {taskGroupEntries.length > 0 && cards.length > 0 && (
                <div className="flex items-center gap-2 py-1">
                  <div className="h-px flex-1 bg-[rgba(255,255,255,0.05)]" />
                  <span className="text-[10px] text-[#404040]">Tasks</span>
                  <div className="h-px flex-1 bg-[rgba(255,255,255,0.05)]" />
                </div>
              )}
              {totalCount === 0 ? (
                <div className="flex h-40 flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-[rgba(255,255,255,0.06)] text-[#333333]">
                  <CheckCircle2 size={24} className="text-[rgba(34,197,94,0.55)]" />
                  <p className="text-xs">Nothing completed yet</p>
                </div>
              ) : (
                <AnimatePresence initial={false}>
                  {cards.map((card) => {
                    const isReopening = reopeningCardId === card.id;
                    const pickerOpen = pickerCardId === card.id;
                    return (
                      <KanbanCard
                        key={card.id}
                        card={card as KanbanCardData}
                        sprints={[]}
                        users={users}
                        onDragStart={() => onDragStart(card)}
                        onDragEnd={onDragEnd}
                        onSprintChange={onSprintChange}
                        onDelete={(c) => onDelete(c as Card)}
                        onUpdate={(id, updates) => onUpdate(id, updates as Partial<Card>)}
                        columnAccent={accent}
                        availableCustomers={availableCustomers}
                        repoOptions={[repoOption]}
                        currentUserId={currentUserId}
                        compact
                        taskGroups={taskGroups}
                        onTaskGroupChange={onTaskGroupChange}
                        footerAction={
                          <div>
                            {!pickerOpen ? (
                              <button onClick={() => setPickerCardId(card.id)} disabled={isReopening}
                                className="flex w-full items-center gap-1.5 text-[10px] font-medium text-[#707070] transition-colors hover:text-[#F7941D] disabled:opacity-40 disabled:cursor-not-allowed">
                                <RotateCcw size={9} className={isReopening ? "animate-spin" : ""} />
                                {isReopening ? "Moving…" : "Reopen Task"}
                              </button>
                            ) : (
                              <AnimatePresence>
                                <motion.div initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
                                  className="flex flex-wrap gap-1">
                                  {REOPEN_COLUMNS.map((col) => (
                                    <button key={col.name}
                                      onClick={() => { setPickerCardId(null); void onReopen(card, col.name); }}
                                      className="flex items-center gap-1.5 rounded-md px-2 py-1.5 text-[10px] font-medium transition-colors"
                                      style={{ color: col.accent, backgroundColor: `${col.accent}14` }}>
                                      {col.icon}{col.name}
                                    </button>
                                  ))}
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

// ─── Group Task Drawer ────────────────────────────────────────────────────────

function GroupTaskDrawer({
  open, onClose, group, cards, users, availableCustomers, repoOption,
  currentUserId, taskGroups, onCardUpdate, onCardDelete, onSprintChange, onTaskGroupChange,
}: {
  open: boolean; onClose: () => void;
  group: TaskGroupData | null;
  cards: EnrichedCard[]; users: User[];
  availableCustomers: KanbanCustomer[];
  repoOption: KanbanDrawerRepoOption; currentUserId: string | null;
  taskGroups: TaskGroupData[];
  onCardUpdate: (cardId: string, updates: Partial<Card>) => void;
  onCardDelete: (card: Card) => Promise<boolean | void>;
  onSprintChange: (cardId: string, sprintTask: SprintTask | null) => void;
  onTaskGroupChange: (cardId: string, taskGroupId: string | null) => void;
}) {
  const [selectedCardId, setSelectedCardId] = useState<string | null>(null);

  useEffect(() => {
    if (open && cards.length > 0) {
      setSelectedCardId((prev) => {
        if (prev && cards.find((c) => c.id === prev)) return prev;
        return cards[0].id;
      });
    }
  }, [open, group?.id, cards]);

  const selectedCard = cards.find((c) => c.id === selectedCardId) ?? cards[0] ?? null;
  const groupTasksForPicker = cards.map((c) => ({ id: c.id, title: c.title, columnName: c.columnName }));

  return (
    <KanbanCardDrawer
      key={selectedCard?.id}
      open={open && selectedCard !== null}
      card={selectedCard}
      users={users}
      sprints={[]}
      customers={availableCustomers}
      repoOptions={[repoOption]}
      currentUserId={currentUserId}
      taskGroups={taskGroups}
      groupTasks={groupTasksForPicker}
      groupName={group?.name}
      onSwitchGroupTask={setSelectedCardId}
      onClose={onClose}
      onSaved={(cardId, updates) => onCardUpdate(cardId, updates as Partial<Card>)}
      onDelete={(card) => onCardDelete(card as Card)}
      onSprintChange={onSprintChange}
      onTaskGroupChange={onTaskGroupChange}
    />
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

interface Props {
  repoId: string;
  owner: string;
  repo: string;
  users: User[];
  customers: KanbanCustomer[];
  currentUserId: string | null;
}

export function KanbanBoard({ repoId, owner, repo, users, customers, currentUserId }: Props) {
  const [board, setBoard] = useState<Board | null>(null);
  const [loading, setLoading] = useState(true);
  const [draggingCardId, setDraggingCardId] = useState<string | null>(null);
  const [draggingGroupId, setDraggingGroupId] = useState<string | null>(null);
  const [dragOverColumn, setDragOverColumn] = useState<string | null>(null);
  const [newCardColumn, setNewCardColumn] = useState<string | null>(null);
  const [syncingIssues, setSyncingIssues] = useState(false);
  const [taskGroups, setTaskGroups] = useState<TaskGroupData[]>([]);
  const [creatingGroup, setCreatingGroup] = useState(false);
  const [newGroupName, setNewGroupName] = useState("");
  const [savingGroup, setSavingGroup] = useState(false);
  const [qaDrawerOpen, setQaDrawerOpen] = useState(false);
  const [poReviewDrawerOpen, setPoReviewDrawerOpen] = useState(false);
  const [completedDrawerOpen, setCompletedDrawerOpen] = useState(false);
  const [reopeningCardId, setReopeningCardId] = useState<string | null>(null);
  const [qaActioningCardId, setQaActioningCardId] = useState<string | null>(null);
  const [qaActioningCardAction, setQaActioningCardAction] = useState<"reject" | "po-review" | "complete" | null>(null);
  const [poActioningCardId, setPoActioningCardId] = useState<string | null>(null);
  const [poActioningCardAction, setPoActioningCardAction] = useState<"reject" | "complete" | null>(null);
  const [openGroupId, setOpenGroupId] = useState<string | null>(null);

  // ── Data loading ───────────────────────────────────────────────────────────

  async function loadBoard() {
    setLoading(true);
    const res = await fetch(`/api/kanban?repoId=${repoId}`);
    const data = await res.json();
    setBoard(data.board);
    setLoading(false);
  }

  async function loadTaskGroups(currentBoard: Board) {
    const res = await fetch("/api/task-groups");
    const data = await res.json();
    const allCards = currentBoard.columns.flatMap((c) => c.cards);
    const groups: TaskGroupData[] = (data.groups ?? []).map((g: { id: string; name: string; description: string | null; status: string; color: string | null }) => ({
      ...g,
      cardIds: allCards.filter((c) => c.taskGroupId === g.id).map((c) => c.id),
    }));
    setTaskGroups(groups);
  }

  useEffect(() => { loadBoard(); }, [repoId]);

  useEffect(() => {
    if (board) loadTaskGroups(board);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [board?.id]);

  // ── Derived data ───────────────────────────────────────────────────────────

  const allCards = useMemo<EnrichedCard[]>(() => {
    if (!board) return [];
    return board.columns.flatMap((col) =>
      col.cards.map((card) => ({
        ...card,
        columnId: col.id,
        columnName: col.name,
        columnPosition: col.position,
      }))
    );
  }, [board]);

  const allCols = [...COLUMN_ORDER, QA_COLUMN, PO_REVIEW_COLUMN, COMPLETED_COLUMN];

  const columnMap = useMemo<Record<string, EnrichedCard[]>>(() => {
    const map: Record<string, EnrichedCard[]> = {};
    for (const col of allCols) map[col] = [];
    for (const card of allCards) {
      if (card.taskGroupId) continue;
      const normalizedColumnName = normalizeKanbanColumnName(card.columnName);
      const col = allCols.includes(normalizedColumnName) ? normalizedColumnName : BACKLOG_COLUMN;
      map[col].push(card);
    }
    for (const col of allCols) {
      map[col].sort((a, b) => getPriorityRank(a.priority) - getPriorityRank(b.priority) || a.position - b.position);
    }
    return map;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [allCards]);

  const groupColumnMap = useMemo<Record<string, Array<{ group: TaskGroupData; cards: EnrichedCard[] }>>>(() => {
    const map: Record<string, Array<{ group: TaskGroupData; cards: EnrichedCard[] }>> = {};
    for (const col of allCols) map[col] = [];
    for (const group of taskGroups) {
      const col = GROUP_STATUS_TO_COLUMN[group.status];
      if (!col || !map[col]) continue;
      const groupCards = allCards.filter((c) => c.taskGroupId === group.id);
      map[col].push({ group, cards: groupCards });
    }
    return map;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [taskGroups, allCards]);

  const repoOption: KanbanDrawerRepoOption = useMemo(() => ({
    id: repoId,
    name: repo,
    fullName: `${owner}/${repo}`,
    columns: board?.columns.map((col) => ({ id: col.id, name: col.name, position: col.position })) ?? [],
  }), [repoId, repo, owner, board]);

  // ── Card operations ────────────────────────────────────────────────────────

  async function moveCard(card: EnrichedCard, targetColumnName: string) {
    if (!board || normalizeKanbanColumnName(card.columnName) === targetColumnName) return;
    const targetColumn = board.columns.find((c) => normalizeKanbanColumnName(c.name) === targetColumnName);
    if (!targetColumn) return;

    setBoard((prev) => {
      if (!prev) return prev;
      return {
        ...prev,
        columns: prev.columns.map((col) => ({
          ...col,
          cards: col.id === targetColumn.id
            ? [...col.cards.filter((c) => c.id !== card.id), card]
            : col.cards.filter((c) => c.id !== card.id),
        })),
      };
    });

    await fetch("/api/kanban", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ cardId: card.id, columnId: targetColumn.id }),
    });
  }

  async function handleCardDelete(card: Card) {
    const previousBoard = board;
    setBoard((prev) => {
      if (!prev) return prev;
      return {
        ...prev,
        columns: prev.columns.map((col) => ({
          ...col,
          cards: col.cards.filter((c) => c.id !== card.id),
        })),
      };
    });
    const res = await fetch(`/api/kanban?cardId=${card.id}`, { method: "DELETE" });
    if (res.ok) return true;
    setBoard(previousBoard);
    return false;
  }

  function handleCardUpdate(cardId: string, updates: Partial<Card> & { taskGroupId?: string | null }) {
    setBoard((prev) => {
      if (!prev) return prev;
      return {
        ...prev,
        columns: prev.columns.map((col) => ({
          ...col,
          cards: col.cards.map((c) => c.id === cardId ? { ...c, ...updates } : c),
        })),
      };
    });
    if (updates.taskGroupId !== undefined) {
      setTaskGroups((prev) => prev.map((g) => ({
        ...g,
        cardIds: updates.taskGroupId === g.id
          ? [...g.cardIds.filter((id) => id !== cardId), cardId]
          : g.cardIds.filter((id) => id !== cardId),
      })));
    }
  }

  function handleSprintChange(cardId: string, sprintTask: SprintTask | null) {
    setBoard((prev) => {
      if (!prev) return prev;
      return {
        ...prev,
        columns: prev.columns.map((col) => ({
          ...col,
          cards: col.cards.map((c) => c.id === cardId ? { ...c, sprintTask } : c),
        })),
      };
    });
  }

  // ── Drag handlers ──────────────────────────────────────────────────────────

  function handleDragStart(card: EnrichedCard) { setDraggingCardId(card.id); }
  function handleDragEnd() { setDraggingCardId(null); setDragOverColumn(null); }
  function handleGroupDragStart(groupId: string) { setDraggingGroupId(groupId); }
  function handleGroupDragEnd() { setDraggingGroupId(null); setDragOverColumn(null); }

  function handleColumnDragOver(event: React.DragEvent, columnName: string) {
    if (!draggingCardId && !draggingGroupId) return;
    event.preventDefault();
    setDragOverColumn(columnName);
  }

  async function handleColumnDrop(event: React.DragEvent, columnName: string) {
    event.preventDefault();
    setDragOverColumn(null);
    if (draggingGroupId) {
      const newStatus = COLUMN_TO_GROUP_STATUS[columnName];
      const id = draggingGroupId;
      setDraggingGroupId(null);
      if (newStatus) await handleGroupStatusChange(id, newStatus);
      return;
    }
    const draggingCard = allCards.find((c) => c.id === draggingCardId);
    setDraggingCardId(null);
    if (draggingCard) await moveCard(draggingCard, columnName);
  }

  function handleDropZoneDragLeave() {
    if ([QA_COLUMN, PO_REVIEW_COLUMN, COMPLETED_COLUMN].includes(dragOverColumn ?? "")) {
      setDragOverColumn(null);
    }
  }

  // ── QA/PO Review/Done action handlers ─────────────────────────────────────

  async function handleQaReject(card: Card) {
    const enriched = allCards.find((c) => c.id === card.id);
    if (!enriched) return;
    setQaActioningCardId(card.id); setQaActioningCardAction("reject");
    try { await moveCard(enriched, ACTIVE_COLUMN); }
    finally { setQaActioningCardId(null); setQaActioningCardAction(null); }
  }

  async function handleQaMoveToPoReview(card: Card) {
    const enriched = allCards.find((c) => c.id === card.id);
    if (!enriched) return;
    setQaActioningCardId(card.id); setQaActioningCardAction("po-review");
    try { await moveCard(enriched, PO_REVIEW_COLUMN); }
    finally { setQaActioningCardId(null); setQaActioningCardAction(null); }
  }

  async function handleQaComplete(card: Card) {
    const enriched = allCards.find((c) => c.id === card.id);
    if (!enriched) return;
    setQaActioningCardId(card.id); setQaActioningCardAction("complete");
    try { await moveCard(enriched, COMPLETED_COLUMN); }
    finally { setQaActioningCardId(null); setQaActioningCardAction(null); }
  }

  async function handlePoReviewReject(card: Card) {
    const enriched = allCards.find((c) => c.id === card.id);
    if (!enriched) return;
    setPoActioningCardId(card.id); setPoActioningCardAction("reject");
    try { await moveCard(enriched, ACTIVE_COLUMN); }
    finally { setPoActioningCardId(null); setPoActioningCardAction(null); }
  }

  async function handlePoReviewComplete(card: Card) {
    const enriched = allCards.find((c) => c.id === card.id);
    if (!enriched) return;
    setPoActioningCardId(card.id); setPoActioningCardAction("complete");
    try { await moveCard(enriched, COMPLETED_COLUMN); }
    finally { setPoActioningCardId(null); setPoActioningCardAction(null); }
  }

  async function handleReopen(card: Card, targetColumn: string) {
    const enriched = allCards.find((c) => c.id === card.id);
    if (!enriched) return;
    setReopeningCardId(card.id);
    try { await moveCard(enriched, targetColumn); }
    finally { setReopeningCardId(null); }
  }

  // ── Group operations ───────────────────────────────────────────────────────

  async function handleGroupStatusChange(groupId: string, status: string) {
    setTaskGroups((prev) => prev.map((g) => g.id === groupId ? { ...g, status } : g));
    await fetch("/api/task-groups", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ groupId, status }),
    });
  }

  async function handleGroupRename(groupId: string, name: string) {
    setTaskGroups((prev) => prev.map((g) => g.id === groupId ? { ...g, name } : g));
    await fetch("/api/task-groups", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ groupId, name }),
    });
  }

  async function handleGroupDelete(groupId: string) {
    setTaskGroups((prev) => prev.filter((g) => g.id !== groupId));
    setBoard((prev) => {
      if (!prev) return prev;
      return {
        ...prev,
        columns: prev.columns.map((col) => ({
          ...col,
          cards: col.cards.map((c) => c.taskGroupId === groupId ? { ...c, taskGroupId: null, taskGroup: null } : c),
        })),
      };
    });
    await fetch(`/api/task-groups?groupId=${groupId}`, { method: "DELETE" });
  }

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
      setTaskGroups((prev) => [...prev, { ...data.group, cardIds: [] }]);
    }
    setNewGroupName("");
    setCreatingGroup(false);
    setSavingGroup(false);
  }

  async function syncGithubIssues() {
    setSyncingIssues(true);
    try {
      const res = await fetch(`/api/github/issues?owner=${owner}&repo=${repo}&state=open`);
      const { issues } = await res.json();
      const backlog = board?.columns.find((c) => normalizeKanbanColumnName(c.name) === BACKLOG_COLUMN);
      if (!backlog) return;
      const existingGithubIds = allCards.map((c) => c.githubIssueId).filter(Boolean);
      for (const issue of issues) {
        if (!existingGithubIds.includes(issue.number)) {
          await fetch("/api/kanban", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ columnId: backlog.id, title: issue.title, body: issue.body ?? "", priority: "medium", labels: issue.labels.map((l: { name: string }) => l.name), githubIssueId: issue.number, githubIssueUrl: issue.html_url }),
          });
        }
      }
      await loadBoard();
    } catch (error) {
      console.error("Failed to sync issues:", error);
    } finally {
      setSyncingIssues(false);
    }
  }

  // ── Render ─────────────────────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 size={24} className="animate-spin text-[#F7941D]" />
      </div>
    );
  }

  if (!board) {
    return (
      <div className="text-center py-20">
        <AlertTriangle size={32} className="text-[#F97316] mx-auto mb-3" />
        <p className="text-[#606060]">Failed to load board</p>
        <Button onClick={loadBoard} variant="secondary" size="sm" className="mt-3">Retry</Button>
      </div>
    );
  }

  const defaultColumnId = board.columns.find((c) => normalizeKanbanColumnName(c.name) === BACKLOG_COLUMN)?.id ?? board.columns[0]?.id ?? null;
  const isDraggingActive = draggingCardId !== null || draggingGroupId !== null;
  const openGroup = taskGroups.find((g) => g.id === openGroupId) ?? null;
  const openGroupCards = openGroupId ? allCards.filter((c) => c.taskGroupId === openGroupId) : [];

  return (
    <div className="space-y-4">
      {/* Board header */}
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <span className="text-sm text-[#9A9A9A]">
          {allCards.filter((c) => !c.taskGroupId).length} ungrouped · {allCards.filter((c) => c.taskGroupId).length} grouped
        </span>
        <div className="flex items-center gap-2">
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
                className="h-8 rounded-lg border border-[rgba(255,255,255,0.1)] bg-[rgba(255,255,255,0.04)] px-3 text-sm text-[#F0F0F0] outline-none placeholder:text-[#555555] focus:border-[rgba(247,148,29,0.3)] w-48"
              />
              <Button variant="primary" size="sm" loading={savingGroup} onClick={() => void handleCreateGroup()}>Create</Button>
              <Button variant="secondary" size="sm" onClick={() => { setCreatingGroup(false); setNewGroupName(""); }}>Cancel</Button>
            </div>
          ) : (
            <Button variant="secondary" size="sm" icon={<Layers size={13} />} onClick={() => setCreatingGroup(true)}>
              New Group
            </Button>
          )}
          <Button variant="secondary" size="sm" loading={syncingIssues}
            icon={<RefreshCw size={13} className={syncingIssues ? "animate-spin" : ""} />}
            onClick={syncGithubIssues}>
            Sync Issues
          </Button>
          <Button variant="primary" size="sm" icon={<Plus size={13} />}
            onClick={() => setNewCardColumn(defaultColumnId)}>
            New Task
          </Button>
        </div>
      </div>

      {/* Kanban board */}
      <div className="flex gap-3 sm:gap-4 overflow-x-auto pb-4">
        {/* Regular columns */}
        {COLUMN_ORDER.map((colName) => (
          <div
            key={colName}
            className={cn(
              "flex-shrink-0 sm:min-w-0",
              colName === ACTIVE_COLUMN ? "sm:flex-[2.8]" : "sm:flex-[1.15]"
            )}
          >
            <BoardColumn
              name={colName}
              cards={columnMap[colName] ?? []}
              users={users}
              isDragOver={dragOverColumn === colName}
              onDragOver={(e) => handleColumnDragOver(e, colName)}
              onDrop={(e) => void handleColumnDrop(e, colName)}
              onDelete={handleCardDelete}
              onDragStart={handleDragStart}
              onDragEnd={handleDragEnd}
              availableCustomers={customers}
              onUpdate={handleCardUpdate}
              onSprintChange={handleSprintChange}
              repoOption={repoOption}
              currentUserId={currentUserId}
              taskGroups={taskGroups}
              onTaskGroupChange={(cardId, taskGroupId) => handleCardUpdate(cardId, { taskGroupId })}
              taskGroupEntries={groupColumnMap[colName] ?? []}
              onOpenGroup={setOpenGroupId}
              onGroupDragStart={handleGroupDragStart}
              onGroupDragEnd={handleGroupDragEnd}
            />
          </div>
        ))}

        {/* QA / PO Review / Done drop zone stack */}
        <div className="flex flex-shrink-0 items-stretch gap-3 sm:gap-4 sm:flex-none sm:w-52">
          <div className="hidden self-stretch py-1 sm:block">
            <div className="h-full w-px rounded-full bg-[linear-gradient(180deg,rgba(255,255,255,0.04),rgba(255,255,255,0.14),rgba(34,197,94,0.18),rgba(255,255,255,0.08))]" />
          </div>
          <div className="flex flex-1 min-w-0 flex-col gap-3 sm:gap-4">
            <QaDropZone
              cardCount={(columnMap[QA_COLUMN] ?? []).length + (groupColumnMap[QA_COLUMN] ?? []).length}
              isDragOver={dragOverColumn === QA_COLUMN}
              isDraggingActive={isDraggingActive}
              onDragOver={(e) => handleColumnDragOver(e, QA_COLUMN)}
              onDrop={(e) => void handleColumnDrop(e, QA_COLUMN)}
              onDragLeave={handleDropZoneDragLeave}
              onClick={() => setQaDrawerOpen(true)}
            />
            <PoReviewDropZone
              cardCount={(columnMap[PO_REVIEW_COLUMN] ?? []).length + (groupColumnMap[PO_REVIEW_COLUMN] ?? []).length}
              isDragOver={dragOverColumn === PO_REVIEW_COLUMN}
              isDraggingActive={isDraggingActive}
              onDragOver={(e) => handleColumnDragOver(e, PO_REVIEW_COLUMN)}
              onDrop={(e) => void handleColumnDrop(e, PO_REVIEW_COLUMN)}
              onDragLeave={handleDropZoneDragLeave}
              onClick={() => setPoReviewDrawerOpen(true)}
            />
            <DoneDropZone
              cardCount={(columnMap[COMPLETED_COLUMN] ?? []).length + (groupColumnMap[COMPLETED_COLUMN] ?? []).length}
              isDragOver={dragOverColumn === COMPLETED_COLUMN}
              isDraggingActive={isDraggingActive}
              onDragOver={(e) => handleColumnDragOver(e, COMPLETED_COLUMN)}
              onDrop={(e) => void handleColumnDrop(e, COMPLETED_COLUMN)}
              onDragLeave={handleDropZoneDragLeave}
              onClick={() => setCompletedDrawerOpen(true)}
            />
          </div>
        </div>
      </div>

      {/* Drawers */}
      <QaTasksDrawer
        open={qaDrawerOpen}
        onClose={() => setQaDrawerOpen(false)}
        cards={columnMap[QA_COLUMN] ?? []}
        users={users}
        onDelete={handleCardDelete}
        onDragStart={handleDragStart}
        onDragEnd={handleDragEnd}
        availableCustomers={customers}
        onUpdate={handleCardUpdate}
        onSprintChange={handleSprintChange}
        repoOption={repoOption}
        currentUserId={currentUserId}
        onReject={handleQaReject}
        onMoveToPo={handleQaMoveToPoReview}
        onComplete={handleQaComplete}
        actioningCardId={qaActioningCardId}
        actioningCardAction={qaActioningCardAction}
        taskGroupEntries={groupColumnMap[QA_COLUMN] ?? []}
        onOpenGroup={setOpenGroupId}
        taskGroups={taskGroups}
        onTaskGroupChange={(cardId, taskGroupId) => handleCardUpdate(cardId, { taskGroupId })}
      />

      <PoReviewTasksDrawer
        open={poReviewDrawerOpen}
        onClose={() => setPoReviewDrawerOpen(false)}
        cards={columnMap[PO_REVIEW_COLUMN] ?? []}
        users={users}
        onDelete={handleCardDelete}
        onDragStart={handleDragStart}
        onDragEnd={handleDragEnd}
        availableCustomers={customers}
        onUpdate={handleCardUpdate}
        onSprintChange={handleSprintChange}
        repoOption={repoOption}
        currentUserId={currentUserId}
        onReject={handlePoReviewReject}
        onComplete={handlePoReviewComplete}
        actioningCardId={poActioningCardId}
        actioningCardAction={poActioningCardAction}
        taskGroupEntries={groupColumnMap[PO_REVIEW_COLUMN] ?? []}
        onOpenGroup={setOpenGroupId}
        taskGroups={taskGroups}
        onTaskGroupChange={(cardId, taskGroupId) => handleCardUpdate(cardId, { taskGroupId })}
      />

      <CompletedTasksDrawer
        open={completedDrawerOpen}
        onClose={() => setCompletedDrawerOpen(false)}
        cards={columnMap[COMPLETED_COLUMN] ?? []}
        users={users}
        onDelete={handleCardDelete}
        onDragStart={handleDragStart}
        onDragEnd={handleDragEnd}
        availableCustomers={customers}
        onUpdate={handleCardUpdate}
        onSprintChange={handleSprintChange}
        repoOption={repoOption}
        currentUserId={currentUserId}
        onReopen={handleReopen}
        reopeningCardId={reopeningCardId}
        taskGroupEntries={groupColumnMap[COMPLETED_COLUMN] ?? []}
        onOpenGroup={setOpenGroupId}
        taskGroups={taskGroups}
        onTaskGroupChange={(cardId, taskGroupId) => handleCardUpdate(cardId, { taskGroupId })}
      />

      <GroupTaskDrawer
        open={openGroupId !== null}
        onClose={() => setOpenGroupId(null)}
        group={openGroup}
        cards={openGroupCards}
        users={users}
        availableCustomers={customers}
        repoOption={repoOption}
        currentUserId={currentUserId}
        taskGroups={taskGroups}
        onCardUpdate={handleCardUpdate}
        onCardDelete={handleCardDelete}
        onSprintChange={handleSprintChange}
        onTaskGroupChange={(cardId, taskGroupId) => handleCardUpdate(cardId, { taskGroupId })}
      />

      {/* New task drawer */}
      <AnimatePresence>
        {newCardColumn && (
          <KanbanCardDrawer
            key={`create-${newCardColumn}`}
            open
            mode="create"
            card={null}
            users={users}
            sprints={[]}
            customers={customers}
            repoOptions={[repoOption]}
            initialRepoId={repoId}
            initialColumnId={newCardColumn}
            currentUserId={currentUserId}
            taskGroups={taskGroups}
            onClose={() => setNewCardColumn(null)}
            onSaved={() => undefined}
            onCreated={() => void loadBoard()}
            onDelete={() => undefined}
            onSprintChange={() => undefined}
            onTaskGroupChange={(cardId, taskGroupId) => handleCardUpdate(cardId, { taskGroupId })}
          />
        )}
      </AnimatePresence>
    </div>
  );
}
