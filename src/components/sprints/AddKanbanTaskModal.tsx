"use client";

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  X, Zap, Loader2, ChevronLeft, Search, Tag, UserRound,
  LayoutGrid, List, ExternalLink,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Avatar } from "@/components/ui/Avatar";
import { ACTIVE_COLUMN, BACKLOG_COLUMN, PO_REVIEW_COLUMN, QA_COLUMN, normalizeKanbanColumnName } from "@/lib/kanban-columns";

// ─── Types ────────────────────────────────────────────────────────────────────

interface Repo {
  id: string;
  name: string;
}

interface User {
  id: string;
  name: string | null;
  displayName: string | null;
  email: string;
  image: string | null;
}

interface FlatCard {
  id: string;
  title: string;
  body: string | null;
  priority: string;
  labels: string;
  githubIssueUrl: string | null;
  sprintTask: { id: string } | null;
  columnName: string;
  columnColor: string;
  repoName: string;
}

interface MergedColumn {
  name: string;
  color: string;
  cards: FlatCard[];
}

interface SprintTask {
  id: string;
  sprintId: string;
  assigneeId: string | null;
  kanbanCardId: string | null;
  title: string;
  description: string | null;
  status: string;
  priority: string;
  storyPoints: number | null;
  githubIssueUrl: string | null;
  position: number;
  createdAt: string;
  updatedAt: string;
  assignee: User | null;
  kanbanCard: {
    id: string;
    title: string;
    priority: string;
    column: { name: string; board: { repo: { id: string; name: string } } };
  } | null;
}

interface Props {
  sprintId: string;
  onClose: () => void;
  onAdded: (task: SprintTask) => void;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

const PRIORITY_COLOR: Record<string, string> = {
  critical: "#EF4444",
  high:     "#F97316",
  medium:   "#FBBA00",
  low:      "#22C55E",
};

const PRIORITY_BG: Record<string, string> = {
  critical: "rgba(239,68,68,0.12)",
  high:     "rgba(249,115,22,0.12)",
  medium:   "rgba(251,186,0,0.12)",
  low:      "rgba(34,197,94,0.12)",
};

const COLUMN_ORDER = [
  BACKLOG_COLUMN,
  ACTIVE_COLUMN,
  QA_COLUMN,
  PO_REVIEW_COLUMN,
];

// ─── Main Component ───────────────────────────────────────────────────────────

export function AddKanbanTaskModal({ sprintId, onClose, onAdded }: Props) {
  const [mergedColumns, setMergedColumns] = useState<MergedColumn[]>([]);
  const [loading, setLoading] = useState(true);
  const [viewMode, setViewMode] = useState<"kanban" | "list">("kanban");
  const [search, setSearch] = useState("");
  const [adding, setAdding] = useState(false);

  // Load all repos + boards, merge columns, strip Done
  useEffect(() => {
    async function loadAll() {
      setLoading(true);
      try {
        const reposRes = await fetch("/api/repos");
        const reposData = await reposRes.json();
        const repos: Repo[] = reposData.repos ?? [];

        // Fetch all boards in parallel (repo boards + general board)
        const boardPromises = [
          ...repos.map((r) =>
            fetch(`/api/kanban?repoId=${r.id}`)
              .then((res) => res.json())
              .then((data) => ({ repoName: r.name, columns: data.board?.columns ?? [] }))
          ),
          fetch("/api/kanban?general=true")
            .then((res) => res.json())
            .then((data) => ({ repoName: "General", columns: data.board?.columns ?? [] })),
        ];

        const boards = await Promise.all(boardPromises);

        // Merge all columns by name, skipping Done
        const columnMap = new Map<string, MergedColumn>();
        for (const board of boards) {
          for (const col of board.columns) {
            if (col.name === "Done") continue;
            const normalizedColumnName = normalizeKanbanColumnName(col.name);
            if (!columnMap.has(normalizedColumnName)) {
              columnMap.set(normalizedColumnName, { name: normalizedColumnName, color: col.color, cards: [] });
            }
            const merged = columnMap.get(normalizedColumnName)!;
            for (const card of col.cards) {
              merged.cards.push({
                id: card.id,
                title: card.title,
                body: card.body ?? null,
                priority: card.priority,
                labels: card.labels ?? "[]",
                githubIssueUrl: card.githubIssueUrl ?? null,
                sprintTask: card.sprintTask ?? null,
                columnName: normalizedColumnName,
                columnColor: col.color,
                repoName: board.repoName,
              });
            }
          }
        }

        // Sort columns by defined order, then any extras
        const ordered: MergedColumn[] = [
          ...COLUMN_ORDER.map((name) => columnMap.get(name)).filter((c): c is MergedColumn => !!c),
          ...[...columnMap.values()].filter((c) => !COLUMN_ORDER.includes(c.name)),
        ];

        setMergedColumns(ordered);
      } finally {
        setLoading(false);
      }
    }
    loadAll();
  }, []);

  async function selectCard(card: FlatCard) {
    setAdding(true);
    try {
      const res = await fetch(`/api/sprints/${sprintId}/tasks`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ kanbanCardId: card.id }),
      });
      if (!res.ok) {
        const err = await res.json();
        alert(err.error ?? "Failed to add task");
        return;
      }
      const task = await res.json();
      onAdded(task);
      onClose();
    } finally {
      setAdding(false);
    }
  }

  // All available cards (not yet in a sprint) across all columns
  const allCards = mergedColumns.flatMap((col) => col.cards.filter((c) => !c.sprintTask));

  // Filtered columns for both views
  const filteredColumns = mergedColumns.map((col) => ({
    ...col,
    cards: col.cards.filter(
      (c) =>
        !c.sprintTask &&
        (!search.trim() || c.title.toLowerCase().includes(search.toLowerCase()))
    ),
  }));

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm"
      onClick={onClose}
    >
      <motion.div
        initial={{ scale: 0.96, opacity: 0, y: 16 }}
        animate={{ scale: 1, opacity: 1, y: 0 }}
        exit={{ scale: 0.96, opacity: 0 }}
        transition={{ type: "spring", stiffness: 300, damping: 28 }}
        className="relative w-full bg-[#111111] border border-[rgba(255,255,255,0.08)] rounded-2xl shadow-2xl overflow-hidden flex flex-col"
        style={{ maxWidth: "min(1100px, calc(100vw - 2rem))", maxHeight: "88vh" }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* ── Header ── */}
        <div className="flex items-center gap-3 px-5 py-3.5 border-b border-[rgba(255,255,255,0.06)] flex-shrink-0">
          <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-[#F7941D] to-[#7B1C24] flex items-center justify-center flex-shrink-0">
            <Zap size={13} className="text-white" />
          </div>

          <span className="text-sm font-bold text-[#F0F0F0]">Add From Kanban</span>

          <div className="flex-1" />

          {/* View toggle */}
          <div className="flex items-center bg-[rgba(255,255,255,0.04)] border border-[rgba(255,255,255,0.08)] rounded-lg p-0.5">
              <button
                onClick={() => setViewMode("kanban")}
                className={cn(
                  "p-1.5 rounded-md transition-all",
                  viewMode === "kanban" ? "bg-[rgba(247,148,29,0.15)] text-[#F7941D]" : "text-[#606060] hover:text-[#9A9A9A]"
                )}
                title="Board view"
              >
                <LayoutGrid size={14} />
              </button>
              <button
                onClick={() => setViewMode("list")}
                className={cn(
                  "p-1.5 rounded-md transition-all",
                  viewMode === "list" ? "bg-[rgba(247,148,29,0.15)] text-[#F7941D]" : "text-[#606060] hover:text-[#9A9A9A]"
                )}
                title="List view"
              >
                <List size={14} />
              </button>
            </div>

          <button onClick={onClose} className="text-[#606060] hover:text-[#F0F0F0] transition-colors ml-1">
            <X size={16} />
          </button>
        </div>

        {/* ── Search bar ── */}
        <div className="px-4 pt-3 pb-2 flex-shrink-0 border-b border-[rgba(255,255,255,0.05)]">
            <div className="relative">
              <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#606060]" />
              <input
                autoFocus
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search cards…"
                className="w-full pl-8 pr-3 py-2 bg-[rgba(255,255,255,0.04)] border border-[rgba(255,255,255,0.08)] rounded-xl text-sm text-[#F0F0F0] placeholder-[#606060] focus:outline-none focus:border-[rgba(247,148,29,0.4)] transition-colors"
              />
            </div>
          </div>

        {/* ── Body ── */}
        <div className="flex-1 overflow-hidden">
          {/* Loading */}
          {loading && (
            <div className="flex items-center justify-center h-full">
              <Loader2 size={22} className="animate-spin text-[#F7941D]" />
            </div>
          )}

          {/* Board */}
          {!loading && (
            <AnimatePresence mode="wait">
              {viewMode === "kanban" ? (
                /* ── Kanban board ── */
                <motion.div
                  key="kanban"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.12 }}
                  className="h-full overflow-x-auto overflow-y-hidden"
                >
                  <div className="flex gap-3 p-4 h-full" style={{ minWidth: "max-content" }}>
                    {filteredColumns.map((col) => (
                      <div key={col.name} className="flex flex-col flex-shrink-0 w-48">
                        {/* Column header */}
                        <div className="flex items-center gap-2 mb-1.5 px-1">
                          <div
                            className="w-2 h-2 rounded-full flex-shrink-0"
                            style={{ backgroundColor: col.color }}
                          />
                          <span className="text-xs font-bold text-[#C0C0C0] truncate flex-1">
                            {col.name}
                          </span>
                          <span className="text-[10px] text-[#505050] flex-shrink-0">
                            {col.cards.length}
                          </span>
                        </div>
                        <div
                          className="h-0.5 rounded-full mb-2 mx-1"
                          style={{ backgroundColor: col.color, opacity: 0.5 }}
                        />

                        {/* Cards */}
                        <div className="flex-1 overflow-y-auto space-y-1.5 pr-0.5">
                          {col.cards.length === 0 ? (
                            <p className="text-[11px] text-[#404040] text-center py-6">Empty</p>
                          ) : (
                            col.cards.map((card) => {
                              const labels = JSON.parse(card.labels ?? "[]") as string[];
                              const priColor = PRIORITY_COLOR[card.priority] ?? "#FBBA00";
                              const priBg = PRIORITY_BG[card.priority] ?? "rgba(251,186,0,0.12)";
                              return (
                                <button
                                  key={card.id}
                                  onClick={() => selectCard(card)}
                                  className="group w-full text-left rounded-xl border border-[rgba(255,255,255,0.06)] hover:border-[rgba(247,148,29,0.4)] bg-[rgba(255,255,255,0.02)] hover:bg-[rgba(247,148,29,0.05)] transition-all overflow-hidden"
                                >
                                  <div className="h-0.5 w-full" style={{ backgroundColor: priColor }} />
                                  <div className="p-2.5">
                                    <p className="text-xs font-medium text-[#E0E0E0] leading-snug line-clamp-3 group-hover:text-white transition-colors mb-2">
                                      {card.title}
                                    </p>
                                    <div className="flex items-center gap-1 flex-wrap">
                                      <span
                                        className="text-[9px] px-1.5 py-0.5 rounded-full font-medium capitalize"
                                        style={{ color: priColor, background: priBg }}
                                      >
                                        {card.priority}
                                      </span>
                                      {card.repoName !== "General" && (
                                        <span className="text-[9px] text-[#505050] truncate max-w-[64px]">
                                          {card.repoName}
                                        </span>
                                      )}
                                      {labels.length > 0 && (
                                        <span className="flex items-center gap-0.5 text-[9px] text-[#606060]">
                                          <Tag size={8} />
                                          <span className="truncate max-w-[64px]">
                                            {labels[0]}{labels.length > 1 && ` +${labels.length - 1}`}
                                          </span>
                                        </span>
                                      )}
                                      {card.githubIssueUrl && (
                                        <ExternalLink size={9} className="text-[#404040] ml-auto group-hover:text-[#606060]" />
                                      )}
                                    </div>
                                  </div>
                                </button>
                              );
                            })
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </motion.div>
              ) : (
                /* ── List view ── */
                <motion.div
                  key="list"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.12 }}
                  className="h-full overflow-y-auto"
                >
                  {allCards.length === 0 ? (
                    <div className="flex items-center justify-center h-full">
                      <p className="text-sm text-[#606060]">All cards are already in sprints</p>
                    </div>
                  ) : (
                    <div className="p-4 space-y-5">
                      {filteredColumns.filter((col) => col.cards.length > 0).map((col) => (
                        <div key={col.name}>
                          <div className="flex items-center gap-2 mb-2 px-1">
                            <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: col.color }} />
                            <span className="text-xs font-bold text-[#C0C0C0] uppercase tracking-wider">{col.name}</span>
                            <span className="text-xs text-[#404040]">({col.cards.length})</span>
                          </div>
                          <div className="space-y-1">
                            {col.cards.map((card) => {
                              const labels = JSON.parse(card.labels ?? "[]") as string[];
                              const priColor = PRIORITY_COLOR[card.priority] ?? "#FBBA00";
                              const priBg = PRIORITY_BG[card.priority] ?? "rgba(251,186,0,0.12)";
                              return (
                                <button
                                  key={card.id}
                                  onClick={() => selectCard(card)}
                                  className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl border border-[rgba(255,255,255,0.05)] hover:border-[rgba(247,148,29,0.3)] hover:bg-[rgba(247,148,29,0.04)] bg-[rgba(255,255,255,0.02)] text-left transition-all group"
                                >
                                  <div
                                    className="w-2 h-2 rounded-full flex-shrink-0"
                                    style={{ backgroundColor: priColor }}
                                  />
                                  <div className="flex-1 min-w-0">
                                    <p className="text-sm text-[#F0F0F0] truncate font-medium">{card.title}</p>
                                    <div className="flex items-center gap-2 mt-0.5">
                                      {card.repoName !== "General" && (
                                        <span className="text-[10px] text-[#505050]">{card.repoName}</span>
                                      )}
                                      {labels.length > 0 && (
                                        <span className="flex items-center gap-1 text-[10px] text-[#606060]">
                                          <Tag size={9} />
                                          {labels.slice(0, 2).join(", ")}{labels.length > 2 && ` +${labels.length - 2}`}
                                        </span>
                                      )}
                                    </div>
                                  </div>
                                  <span
                                    className="text-[10px] px-1.5 py-0.5 rounded-full font-medium capitalize flex-shrink-0"
                                    style={{ color: priColor, background: priBg }}
                                  >
                                    {card.priority}
                                  </span>
                                </button>
                              );
                            })}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </motion.div>
              )}
            </AnimatePresence>
          )}

          {/* Adding spinner overlay */}
          {adding && (
            <div className="absolute inset-0 flex items-center justify-center bg-black/40 rounded-2xl z-10">
              <Loader2 size={24} className="animate-spin text-[#F7941D]" />
            </div>
          )}
        </div>
      </motion.div>
    </motion.div>
  );
}
