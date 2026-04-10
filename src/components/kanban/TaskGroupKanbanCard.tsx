"use client";

import { useState, useEffect } from "react";
import { Layers } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { Avatar } from "@/components/ui/Avatar";
import { CustomerPills, type KanbanCustomer } from "./KanbanCustomerField";
import { getGroupStatusMeta, type TaskGroupData } from "./TaskGroupRow";
import { ACTIVE_COLUMN, BACKLOG_COLUMN, DONE_COLUMN, QA_COLUMN, normalizeKanbanColumnName } from "@/lib/kanban-columns";

// ─── Types ────────────────────────────────────────────────────────────────────

interface User {
  id: string;
  name: string | null;
  displayName: string | null;
  image: string | null;
}

interface SubTask {
  id: string;
  title: string;
  assignees: string; // JSON string of assignee IDs
  customers: KanbanCustomer[];
  columnName: string;
}

interface Props {
  group: TaskGroupData;
  cards: SubTask[];
  users: User[];
  onClick: () => void;
  draggable?: boolean;
  onDragStart?: () => void;
  onDragEnd?: () => void;
}

// ─── Column accent colours (mirrors GlobalKanbanClient COLUMN_STYLE) ─────────

const COLUMN_ACCENT: Record<string, string> = {
  [BACKLOG_COLUMN]: "#555555",
  [ACTIVE_COLUMN]: "#F7941D",
  [QA_COLUMN]: "#3B82F6",
  [DONE_COLUMN]: "#22C55E",
};

function getColumnAccent(columnName: string) {
  return COLUMN_ACCENT[normalizeKanbanColumnName(columnName)] ?? "#666666";
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function parseIds(json: string): string[] {
  try {
    return JSON.parse(json) as string[];
  } catch {
    return [];
  }
}

// ─── Sub-task ticker ──────────────────────────────────────────────────────────

function SubTaskTicker({ cards }: { cards: SubTask[] }) {
  const [index, setIndex] = useState(0);

  useEffect(() => {
    if (cards.length <= 1) return;
    const id = setInterval(() => setIndex((prev) => (prev + 1) % cards.length), 2800);
    return () => clearInterval(id);
  }, [cards.length]);

  if (cards.length === 0) {
    return (
      <div className="flex h-7 items-center">
        <span className="text-[10px] text-[#444444] italic">No tasks yet</span>
      </div>
    );
  }

  const card = cards[index % cards.length];
  const accent = getColumnAccent(card.columnName);

  return (
    <div className="relative h-7 overflow-hidden">
      <AnimatePresence mode="popLayout" initial={false}>
        <motion.div
          key={card.id}
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -8 }}
          transition={{ duration: 0.25 }}
          className="absolute inset-0 flex items-center gap-1.5"
        >
          {/* Status dot */}
          <span
            className="h-1.5 w-1.5 flex-shrink-0 rounded-full"
            style={{ backgroundColor: accent }}
          />
          {/* Task title */}
          <span className="min-w-0 flex-1 truncate text-[10px] text-[#A0A0A0]">
            {card.title}
          </span>
          {/* Column short label */}
          <span
            className="flex-shrink-0 rounded-full px-1.5 py-px text-[9px] font-semibold tabular-nums"
            style={{ color: accent, backgroundColor: `${accent}18` }}
          >
            {normalizeKanbanColumnName(card.columnName)}
          </span>
        </motion.div>
      </AnimatePresence>
    </div>
  );
}

// ─── Component ───────────────────────────────────────────────────────────────

export function TaskGroupKanbanCard({ group, cards, users, onClick, draggable: isDraggable = true, onDragStart, onDragEnd }: Props) {
  const [isDragging, setIsDragging] = useState(false);
  const statusMeta = getGroupStatusMeta(group.status);

  // Aggregate unique assignees across all sub-tasks
  const seenAssigneeIds = new Set<string>();
  const aggregatedAssignees: User[] = [];
  for (const card of cards) {
    for (const id of parseIds(card.assignees)) {
      if (!seenAssigneeIds.has(id)) {
        seenAssigneeIds.add(id);
        const user = users.find((u) => u.id === id);
        if (user) aggregatedAssignees.push(user);
      }
    }
  }

  // Aggregate unique customers across all sub-tasks
  const customerMap = new Map<string, KanbanCustomer>();
  for (const card of cards) {
    for (const c of card.customers) customerMap.set(c.id, c);
  }
  const aggregatedCustomers = [...customerMap.values()];

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: isDragging ? 0.45 : 1, y: 0, scale: isDragging ? 0.97 : 1 }}
      exit={{ opacity: 0, scale: 0.95 }}
      draggable={isDraggable}
      onDragStart={(e) => {
        if (!isDraggable) return;
        (e as unknown as React.DragEvent).dataTransfer.effectAllowed = "move";
        setIsDragging(true);
        onDragStart?.();
      }}
      onDragEnd={() => {
        if (!isDraggable) return;
        setIsDragging(false);
        onDragEnd?.();
      }}
      onClick={onClick}
      className={`w-full overflow-hidden rounded-xl text-left transition-all duration-200 hover:shadow-[0_8px_24px_rgba(0,0,0,0.28)] ${isDraggable ? "cursor-grab active:cursor-grabbing" : "cursor-pointer"}`}
      style={{
        border: `1px dashed ${statusMeta.color}38`,
        borderLeftWidth: "3px",
        borderLeftStyle: "solid",
        borderLeftColor: statusMeta.color,
        background: `linear-gradient(180deg, ${statusMeta.color}0d, ${statusMeta.color}05)`,
      }}
    >
      {/* Top accent line */}
      <div
        className="h-px w-full"
        style={{ background: `linear-gradient(90deg, ${statusMeta.color}55, transparent 70%)` }}
      />

      <div className="p-2">
        {/* Title row */}
        <div className="mb-1.5 flex items-center gap-1.5">
          <div
            className="flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-md border"
            style={{ borderColor: statusMeta.border, backgroundColor: statusMeta.bg }}
          >
            <Layers size={10} style={{ color: statusMeta.color }} />
          </div>
          <span className="min-w-0 flex-1 truncate text-xs font-semibold text-[#F0F0F0]">
            {group.name}
          </span>
          <span
            className="flex-shrink-0 rounded-full px-1.5 py-0.5 text-[10px] font-semibold tabular-nums"
            style={{ color: statusMeta.color, backgroundColor: `${statusMeta.color}20` }}
          >
            {cards.length}
          </span>
        </div>

        {/* Animated sub-task ticker */}
        <SubTaskTicker cards={cards} />

        {/* Aggregated customers */}
        {aggregatedCustomers.length > 0 && (
          <div className="mt-1.5 overflow-hidden">
            <CustomerPills customers={aggregatedCustomers} compact />
          </div>
        )}

        {/* Aggregated assignees */}
        <div className="mt-1.5 flex items-center justify-end">
          {aggregatedAssignees.length > 0 ? (
            <div className="flex items-center">
              {aggregatedAssignees.slice(0, 4).map((user, i) => (
                <div key={user.id} className={i === 0 ? "" : "-ml-1.5"}>
                  <Avatar
                    src={user.image}
                    name={user.displayName ?? user.name}
                    size="xs"
                    className="!h-5 !w-5 text-[8px] ring-1 ring-[rgba(17,17,17,0.9)]"
                  />
                </div>
              ))}
              {aggregatedAssignees.length > 4 && (
                <span className="-ml-1 inline-flex h-5 min-w-[20px] items-center justify-center rounded-full border border-[rgba(255,255,255,0.08)] bg-[rgba(255,255,255,0.05)] px-1 text-[9px] text-[#A0A0A0]">
                  +{aggregatedAssignees.length - 4}
                </span>
              )}
            </div>
          ) : (
            <div className="h-5 w-5 rounded-full border border-dashed border-[rgba(255,255,255,0.12)]" />
          )}
        </div>
      </div>
    </motion.div>
  );
}
