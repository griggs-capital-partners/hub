"use client";

import { useState, useRef, useEffect } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { ChevronDown, ChevronRight, Layers, Pencil, Trash2, X, Check } from "lucide-react";
import { KanbanCard, type KanbanCardData, type KanbanCardUser, type KanbanCardSprintTask, type KanbanCardSprint } from "./KanbanCard";
import { type KanbanCustomer } from "./KanbanCustomerField";
import { type KanbanDrawerRepoOption } from "./KanbanCardDrawer";

// ─── Types ────────────────────────────────────────────────────────────────────

export type TaskGroupData = {
  id: string;
  name: string;
  description: string | null;
  status: string;
  color: string | null;
  cardIds: string[];
};

export const GROUP_STATUSES = [
  { value: "backlog",     label: "Backlog",     color: "#666666", bg: "rgba(102,102,102,0.14)", border: "rgba(102,102,102,0.3)" },
  { value: "research",   label: "Research",    color: "#FBBA00", bg: "rgba(251,186,0,0.14)",   border: "rgba(251,186,0,0.3)" },
  { value: "in-progress", label: "In Progress", color: "#F7941D", bg: "rgba(247,148,29,0.14)",  border: "rgba(247,148,29,0.3)" },
  { value: "done",        label: "Done",        color: "#22C55E", bg: "rgba(34,197,94,0.14)",   border: "rgba(34,197,94,0.3)" },
  { value: "blocked",     label: "Blocked",     color: "#EF4444", bg: "rgba(239,68,68,0.14)",   border: "rgba(239,68,68,0.3)" },
] as const;

export function getGroupStatusMeta(status: string) {
  return GROUP_STATUSES.find((s) => s.value === status) ?? GROUP_STATUSES[0];
}

// ─── Component ───────────────────────────────────────────────────────────────

interface Props {
  group: TaskGroupData;
  cards: KanbanCardData[];
  users: KanbanCardUser[];
  sprints: KanbanCardSprint[];
  availableCustomers: KanbanCustomer[];
  repoOptions: KanbanDrawerRepoOption[];
  currentUserId: string | null;
  onStatusChange: (groupId: string, status: string) => void;
  onRename: (groupId: string, name: string) => void;
  onDelete: (groupId: string) => void;
  onCardUpdate: (cardId: string, updates: Partial<KanbanCardData> & { taskGroupId?: string | null }) => void;
  onCardDelete: (card: KanbanCardData) => Promise<boolean | void>;
  onCardSprintChange: (cardId: string, sprintTask: KanbanCardSprintTask | null) => void;
}

export function TaskGroupRow({
  group,
  cards,
  users,
  sprints,
  availableCustomers,
  repoOptions,
  currentUserId,
  onStatusChange,
  onRename,
  onDelete,
  onCardUpdate,
  onCardDelete,
  onCardSprintChange,
}: Props) {
  const [collapsed, setCollapsed] = useState(false);
  const [statusMenuOpen, setStatusMenuOpen] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [editing, setEditing] = useState(false);
  const [nameValue, setNameValue] = useState(group.name);
  const statusMenuRef = useRef<HTMLDivElement>(null);
  const nameInputRef = useRef<HTMLInputElement>(null);

  const statusMeta = getGroupStatusMeta(group.status);

  useEffect(() => {
    function handlePointerDown(event: MouseEvent) {
      if (statusMenuOpen && statusMenuRef.current && !statusMenuRef.current.contains(event.target as Node)) {
        setStatusMenuOpen(false);
      }
    }
    if (!statusMenuOpen) return;
    document.addEventListener("mousedown", handlePointerDown);
    return () => document.removeEventListener("mousedown", handlePointerDown);
  }, [statusMenuOpen]);

  useEffect(() => {
    if (editing && nameInputRef.current) {
      nameInputRef.current.focus();
      nameInputRef.current.select();
    }
  }, [editing]);

  function handleNameSubmit() {
    const trimmed = nameValue.trim();
    if (trimmed && trimmed !== group.name) {
      onRename(group.id, trimmed);
    } else {
      setNameValue(group.name);
    }
    setEditing(false);
  }

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -8 }}
      className="rounded-2xl border border-[rgba(255,255,255,0.07)] bg-[#111111] overflow-hidden"
    >
      {/* Group header */}
      <div
        className="flex items-center gap-3 px-4 py-3"
        style={{ backgroundColor: `${statusMeta.color}0a` }}
      >
        {/* Collapse toggle */}
        <button
          type="button"
          onClick={() => setCollapsed((prev) => !prev)}
          className="flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-lg text-[#606060] transition-colors hover:text-[#F0F0F0]"
        >
          {collapsed ? <ChevronRight size={14} /> : <ChevronDown size={14} />}
        </button>

        {/* Group icon */}
        <div
          className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-lg border"
          style={{ borderColor: statusMeta.border, backgroundColor: statusMeta.bg }}
        >
          <Layers size={13} style={{ color: statusMeta.color }} />
        </div>

        {/* Name */}
        {editing ? (
          <input
            ref={nameInputRef}
            value={nameValue}
            onChange={(e) => setNameValue(e.target.value)}
            onBlur={handleNameSubmit}
            onKeyDown={(e) => {
              if (e.key === "Enter") handleNameSubmit();
              if (e.key === "Escape") { setNameValue(group.name); setEditing(false); }
            }}
            className="min-w-0 flex-1 rounded-lg border border-[rgba(247,148,29,0.3)] bg-[rgba(247,148,29,0.06)] px-2 py-0.5 text-sm font-semibold text-[#F0F0F0] outline-none"
          />
        ) : (
          <button
            type="button"
            onClick={() => setEditing(true)}
            className="group/name flex min-w-0 flex-1 items-center gap-2 text-left"
          >
            <span className="truncate text-sm font-semibold text-[#F0F0F0]">{group.name}</span>
            <Pencil size={11} className="flex-shrink-0 text-[#404040] opacity-0 transition-opacity group-hover/name:opacity-100" />
          </button>
        )}

        {/* Card count */}
        <span
          className="flex-shrink-0 rounded-full px-2 py-0.5 text-xs font-semibold tabular-nums"
          style={{ color: statusMeta.color, backgroundColor: `${statusMeta.color}20` }}
        >
          {cards.length}
        </span>

        {/* Status badge (clickable) */}
        <div ref={statusMenuRef} className="relative flex-shrink-0">
          <button
            type="button"
            onClick={() => setStatusMenuOpen((prev) => !prev)}
            className="inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-semibold transition-all hover:brightness-110"
            style={{ color: statusMeta.color, backgroundColor: statusMeta.bg, borderColor: statusMeta.border }}
          >
            {statusMeta.label}
            <ChevronDown size={10} />
          </button>

          <AnimatePresence>
            {statusMenuOpen && (
              <motion.div
                initial={{ opacity: 0, y: 6, scale: 0.97 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: 6, scale: 0.97 }}
                className="absolute right-0 top-full z-30 mt-1.5 w-40 overflow-hidden rounded-xl border border-[rgba(255,255,255,0.08)] bg-[#151515] p-1 shadow-2xl"
              >
                {GROUP_STATUSES.map((s) => (
                  <button
                    key={s.value}
                    type="button"
                    onClick={() => {
                      onStatusChange(group.id, s.value);
                      setStatusMenuOpen(false);
                    }}
                    className="flex w-full items-center justify-between rounded-lg px-3 py-2 text-left text-xs transition-colors hover:bg-[rgba(255,255,255,0.04)]"
                    style={{ color: group.status === s.value ? s.color : "#C5C5C5" }}
                  >
                    <span>{s.label}</span>
                    {group.status === s.value && <Check size={11} />}
                  </button>
                ))}
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Delete button */}
        <AnimatePresence mode="wait">
          {confirmDelete ? (
            <motion.div
              key="confirm"
              initial={{ opacity: 0, scale: 0.94 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.94 }}
              className="flex flex-shrink-0 items-center gap-1.5"
            >
              <span className="text-xs text-[#F87171]">Delete group?</span>
              <button
                type="button"
                onClick={() => onDelete(group.id)}
                className="rounded-lg bg-[rgba(239,68,68,0.14)] px-2 py-0.5 text-xs font-medium text-[#F87171] hover:bg-[rgba(239,68,68,0.22)] transition-colors"
              >
                Yes
              </button>
              <button
                type="button"
                onClick={() => setConfirmDelete(false)}
                className="rounded-lg px-2 py-0.5 text-xs text-[#777777] hover:text-[#F0F0F0] transition-colors"
              >
                No
              </button>
            </motion.div>
          ) : (
            <motion.button
              key="delete"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              type="button"
              onClick={() => setConfirmDelete(true)}
              className="flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-lg text-[#505050] transition-colors hover:bg-[rgba(239,68,68,0.1)] hover:text-[#F87171]"
            >
              <Trash2 size={13} />
            </motion.button>
          )}
        </AnimatePresence>
      </div>

      {/* Cards area */}
      <AnimatePresence initial={false}>
        {!collapsed && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            className="overflow-hidden"
          >
            <div className="overflow-x-auto p-3">
              {cards.length === 0 ? (
                <div className="flex h-20 items-center justify-center rounded-xl border border-dashed border-[rgba(255,255,255,0.05)] text-xs text-[#404040]">
                  No tasks in this group
                </div>
              ) : (
                <div className="flex gap-3" style={{ minWidth: "max-content" }}>
                  <AnimatePresence initial={false}>
                    {cards.map((card) => (
                      <motion.div
                        key={card.id}
                        layout
                        initial={{ opacity: 0, scale: 0.96 }}
                        animate={{ opacity: 1, scale: 1 }}
                        exit={{ opacity: 0, scale: 0.96 }}
                        className="w-64 flex-shrink-0"
                      >
                        <KanbanCard
                          card={card}
                          sprints={sprints}
                          users={users}
                          onDragStart={() => {}}
                          onDragEnd={() => {}}
                          onSprintChange={onCardSprintChange}
                          onDelete={onCardDelete}
                          onUpdate={onCardUpdate}
                          columnAccent={statusMeta.color}
                          availableCustomers={availableCustomers}
                          repoOptions={repoOptions}
                          currentUserId={currentUserId}
                          compact={false}
                          footerAction={
                            <button
                              type="button"
                              onClick={async () => {
                                await fetch("/api/kanban", {
                                  method: "PATCH",
                                  headers: { "Content-Type": "application/json" },
                                  body: JSON.stringify({ cardId: card.id, taskGroupId: null }),
                                });
                                onCardUpdate(card.id, { taskGroupId: null });
                              }}
                              className="flex w-full items-center gap-1.5 text-[10px] font-medium text-[#606060] transition-colors hover:text-[#F87171]"
                            >
                              <X size={9} />
                              Remove from group
                            </button>
                          }
                        />
                      </motion.div>
                    ))}
                  </AnimatePresence>
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
