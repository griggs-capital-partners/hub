"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Pencil,
  Eye,
  ChevronUp,
  ChevronDown,
  Plus,
  Trash2,
  X,
  Save,
  ChevronLeft,
  ChevronRight,
  Map,
  Sparkles,
  EyeOff,
} from "lucide-react";
import { cn } from "@/lib/utils";

// ─── Types ────────────────────────────────────────────────────────────────────

interface Repo {
  id: string;
  name: string;
  fullName: string;
  description: string | null;
  roadmapOrder: number;
}

interface RoadmapCard {
  id: string;
  repoId: string;
  quarter: number;
  year: number;
  title: string;
  description: string | null;
  status: string;
  uid: string | null;
  createdAt: string;
  updatedAt: string;
}

interface Quarter {
  q: number;
  year: number;
  label: string;
  isCurrent: boolean;
}

// ─── Status config ────────────────────────────────────────────────────────────

const STATUS_CONFIG = {
  por: {
    label: "POR",
    bg: "from-[#0e2a40] to-[#1a3f5c]",
    border: "border-[#1e5a80]",
    badge: "bg-[#1e5a80] text-[#7ecfff]",
    glow: "shadow-[0_0_20px_rgba(30,90,128,0.4)]",
    dot: "bg-[#4da8d8]",
  },
  planning: {
    label: "Planning",
    bg: "from-[#0d2d4a] to-[#1a4570]",
    border: "border-[#2563a8]",
    badge: "bg-[#1d4ed8]/30 text-[#93c5fd]",
    glow: "shadow-[0_0_20px_rgba(37,99,168,0.4)]",
    dot: "bg-[#60a5fa]",
  },
  concept: {
    label: "Concept",
    bg: "from-[#2d1a08] to-[#4a2c0d]",
    border: "border-[#c2580a]",
    badge: "bg-[#c2580a]/30 text-[#fed7aa]",
    glow: "shadow-[0_0_20px_rgba(194,88,10,0.4)]",
    dot: "bg-[#F7941D]",
  },
} as const;

type StatusKey = keyof typeof STATUS_CONFIG;

// ─── Quarter helpers ──────────────────────────────────────────────────────────

function getCurrentQuarter(): { q: number; year: number } {
  const now = new Date();
  const month = now.getMonth(); // 0-indexed
  return { q: Math.floor(month / 3) + 1, year: now.getFullYear() };
}

function generateQuarters(): Quarter[] {
  const quarters: Quarter[] = [];
  const current = getCurrentQuarter();

  // Start 1 quarter before current, end 4 quarters after current
  let startQ = current.q - 1;
  let startY = current.year;
  if (startQ < 1) { startQ = 4; startY--; }

  let endQ = current.q + 4;
  let endY = current.year;
  while (endQ > 4) { endQ -= 4; endY++; }

  let q = startQ;
  let y = startY;
  while (y < endY || (y === endY && q <= endQ)) {
    quarters.push({
      q,
      year: y,
      label: `Q${q} ${y}`,
      isCurrent: q === current.q && y === current.year,
    });
    q++;
    if (q > 4) { q = 1; y++; }
  }

  return quarters;
}

// ─── Card Modal ───────────────────────────────────────────────────────────────

interface CardModalProps {
  card: RoadmapCard | null;
  repoName: string;
  quarter: Quarter;
  onSave: (data: { title: string; description: string; status: string; uid: string }) => void;
  onDelete: () => void;
  onClose: () => void;
  isNew: boolean;
}

function CardModal({ card, repoName, quarter, onSave, onDelete, onClose, isNew }: CardModalProps) {
  const [title, setTitle] = useState(card?.title ?? "");
  const [description, setDescription] = useState(card?.description ?? "");
  const [status, setStatus] = useState<StatusKey>((card?.status as StatusKey) ?? "planning");
  const [uid, setUid] = useState(card?.uid ?? "");

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm"
      onClick={onClose}
    >
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 10 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 10 }}
        transition={{ type: "spring", stiffness: 400, damping: 30 }}
        className="relative w-full max-w-lg bg-[#111827] border border-white/10 rounded-2xl shadow-2xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header accent strip */}
        <div className={cn(
          "h-1 w-full bg-gradient-to-r",
          status === "por" ? "from-[#1e5a80] to-[#4da8d8]" :
          status === "planning" ? "from-[#1d4ed8] to-[#60a5fa]" :
          "from-[#c2580a] to-[#F7941D]"
        )} />

        <div className="p-6">
          {/* Title row */}
          <div className="flex items-start justify-between mb-5">
            <div>
              <p className="text-xs font-semibold text-[#9A9A9A] uppercase tracking-widest mb-1">
                {repoName} · {quarter.label}
              </p>
              <h3 className="text-lg font-bold text-white">
                {isNew ? "Add Milestone" : "Edit Milestone"}
              </h3>
            </div>
            <button
              onClick={onClose}
              className="p-1.5 rounded-lg text-[#9A9A9A] hover:text-white hover:bg-white/10 transition-colors"
            >
              <X size={18} />
            </button>
          </div>

          {/* Status picker */}
          <div className="mb-4">
            <label className="block text-xs font-semibold text-[#9A9A9A] uppercase tracking-wide mb-2">
              Status
            </label>
            <div className="flex gap-2">
              {(Object.keys(STATUS_CONFIG) as StatusKey[]).map((s) => (
                <button
                  key={s}
                  onClick={() => setStatus(s)}
                  className={cn(
                    "flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all",
                    status === s
                      ? cn("border-opacity-100", STATUS_CONFIG[s].badge, STATUS_CONFIG[s].border)
                      : "border-white/10 text-[#9A9A9A] hover:border-white/20 hover:text-white"
                  )}
                >
                  <span className={cn("w-2 h-2 rounded-full", STATUS_CONFIG[s].dot)} />
                  {STATUS_CONFIG[s].label}
                </button>
              ))}
            </div>
          </div>

          {/* Title input */}
          <div className="mb-4">
            <label className="block text-xs font-semibold text-[#9A9A9A] uppercase tracking-wide mb-2">
              Title / Version
            </label>
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. v2.0 Major Release"
              className="w-full px-3 py-2.5 bg-white/5 border border-white/10 rounded-lg text-white placeholder-[#555] text-sm focus:outline-none focus:border-[#F7941D]/60 focus:ring-1 focus:ring-[#F7941D]/30 transition-colors"
            />
          </div>

          {/* Description */}
          <div className="mb-4">
            <label className="block text-xs font-semibold text-[#9A9A9A] uppercase tracking-wide mb-2">
              Description
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="What's included in this milestone?"
              rows={3}
              className="w-full px-3 py-2.5 bg-white/5 border border-white/10 rounded-lg text-white placeholder-[#555] text-sm focus:outline-none focus:border-[#F7941D]/60 focus:ring-1 focus:ring-[#F7941D]/30 transition-colors resize-none"
            />
          </div>

          {/* UID */}
          <div className="mb-6">
            <label className="block text-xs font-semibold text-[#9A9A9A] uppercase tracking-wide mb-2">
              UID / Label <span className="normal-case text-[#555]">(optional)</span>
            </label>
            <input
              value={uid}
              onChange={(e) => setUid(e.target.value)}
              placeholder="e.g. SSF-2024, TICKET-42"
              className="w-full px-3 py-2.5 bg-white/5 border border-white/10 rounded-lg text-white placeholder-[#555] text-sm focus:outline-none focus:border-[#F7941D]/60 focus:ring-1 focus:ring-[#F7941D]/30 transition-colors"
            />
          </div>

          {/* Actions */}
          <div className="flex items-center justify-between">
            {!isNew ? (
              <button
                onClick={onDelete}
                className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm text-red-400 hover:text-red-300 hover:bg-red-500/10 transition-colors"
              >
                <Trash2 size={14} />
                Delete
              </button>
            ) : <div />}
            <div className="flex gap-2">
              <button
                onClick={onClose}
                className="px-4 py-2 rounded-lg text-sm text-[#9A9A9A] hover:text-white hover:bg-white/10 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={() => onSave({ title, description, status, uid })}
                disabled={!title.trim()}
                className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-semibold bg-[#F7941D] hover:bg-[#e8850e] text-black transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
              >
                <Save size={14} />
                Save
              </button>
            </div>
          </div>
        </div>
      </motion.div>
    </motion.div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

interface RoadmapClientProps {
  initialRepos: Repo[];
  hiddenRepos: Repo[];
  initialCards: RoadmapCard[];
}

export function RoadmapClient({ initialRepos, hiddenRepos: initialHiddenRepos, initialCards }: RoadmapClientProps) {
  const [mode, setMode] = useState<"view" | "edit">("view");
  const [repos, setRepos] = useState<Repo[]>(initialRepos);
  const [hiddenRepos, setHiddenRepos] = useState<Repo[]>(initialHiddenRepos);
  const [cards, setCards] = useState<RoadmapCard[]>(initialCards);
  const [saving, setSaving] = useState(false);

  // Modal state
  const [modalOpen, setModalOpen] = useState(false);
  const [modalCard, setModalCard] = useState<RoadmapCard | null>(null);
  const [modalRepoId, setModalRepoId] = useState<string>("");
  const [modalQuarter, setModalQuarter] = useState<Quarter | null>(null);

  // Scroll state for horizontal navigation
  const scrollRef = useRef<HTMLDivElement>(null);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(false);

  const current = getCurrentQuarter();
  const quarters = generateQuarters();
  const [selectedMobileQuarter, setSelectedMobileQuarter] = useState<Quarter>(() => {
    const qs = generateQuarters();
    return qs.find((q) => q.isCurrent) ?? qs[0];
  });

  // Scroll is not needed — the array starts at the previous quarter (index 0)
  // so the default scrollLeft = 0 already shows prev quarter first, current second.

  const updateScrollButtons = useCallback(() => {
    const el = scrollRef.current;
    if (!el) return;
    setCanScrollLeft(el.scrollLeft > 0);
    setCanScrollRight(el.scrollLeft < el.scrollWidth - el.clientWidth - 4);
  }, []);

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    el.addEventListener("scroll", updateScrollButtons, { passive: true });
    updateScrollButtons();
    return () => el.removeEventListener("scroll", updateScrollButtons);
  }, [updateScrollButtons]);

  function scroll(dir: "left" | "right") {
    const el = scrollRef.current;
    if (!el) return;
    el.scrollBy({ left: dir === "left" ? -440 : 440, behavior: "smooth" });
  }

  function scrollToCurrentQuarter() {
    const el = scrollRef.current;
    if (!el) return;
    // Scroll to start — previous quarter is index 0, current is index 1
    el.scrollTo({ left: 0, behavior: "smooth" });
  }

  // ── Card lookup ──────────────────────────────────────────────────────────────

  function getCard(repoId: string, q: number, year: number): RoadmapCard | undefined {
    return cards.find((c) => c.repoId === repoId && c.quarter === q && c.year === year);
  }

  // ── Cell click ───────────────────────────────────────────────────────────────

  function openModal(repoId: string, quarter: Quarter, existing?: RoadmapCard) {
    if (mode !== "edit") return;
    setModalRepoId(repoId);
    setModalQuarter(quarter);
    setModalCard(existing ?? null);
    setModalOpen(true);
  }

  // ── Save card ────────────────────────────────────────────────────────────────

  async function handleSaveCard(data: { title: string; description: string; status: string; uid: string }) {
    if (!modalQuarter) return;
    setSaving(true);
    try {
      const res = await fetch("/api/roadmap", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          repoId: modalRepoId,
          quarter: modalQuarter.q,
          year: modalQuarter.year,
          title: data.title,
          description: data.description || null,
          status: data.status,
          uid: data.uid || null,
        }),
      });
      const saved: RoadmapCard = await res.json();
      setCards((prev) => {
        const filtered = prev.filter(
          (c) => !(c.repoId === modalRepoId && c.quarter === modalQuarter.q && c.year === modalQuarter.year)
        );
        return [...filtered, saved];
      });
      setModalOpen(false);
    } finally {
      setSaving(false);
    }
  }

  // ── Delete card ──────────────────────────────────────────────────────────────

  async function handleDeleteCard() {
    if (!modalCard) return;
    setSaving(true);
    try {
      await fetch(`/api/roadmap/${modalCard.id}`, { method: "DELETE" });
      setCards((prev) => prev.filter((c) => c.id !== modalCard.id));
      setModalOpen(false);
    } finally {
      setSaving(false);
    }
  }

  // ── Repo ordering ────────────────────────────────────────────────────────────

  async function moveRepo(index: number, dir: "up" | "down") {
    const newRepos = [...repos];
    const swapIdx = dir === "up" ? index - 1 : index + 1;
    if (swapIdx < 0 || swapIdx >= newRepos.length) return;
    [newRepos[index], newRepos[swapIdx]] = [newRepos[swapIdx], newRepos[index]];
    const reordered = newRepos.map((r, i) => ({ ...r, roadmapOrder: i }));
    setRepos(reordered);

    await fetch("/api/roadmap/repos", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ order: reordered.map((r) => ({ id: r.id, roadmapOrder: r.roadmapOrder })) }),
    });
  }

  // ── Add / Remove repos from roadmap ─────────────────────────────────────────

  async function removeRepo(repo: Repo) {
    setRepos((prev) => prev.filter((r) => r.id !== repo.id));
    setHiddenRepos((prev) => [...prev].concat(repo).sort((a, b) => a.name.localeCompare(b.name)));
    await fetch("/api/roadmap/repos", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: repo.id, showInRoadmap: false }),
    });
  }

  async function addRepo(repo: Repo) {
    setHiddenRepos((prev) => prev.filter((r) => r.id !== repo.id));
    setRepos((prev) => [...prev, { ...repo, roadmapOrder: prev.length }]);
    await fetch("/api/roadmap/repos", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: repo.id, showInRoadmap: true }),
    });
  }

  // ─────────────────────────────────────────────────────────────────────────────

  const REPO_COL_WIDTH = 220;
  const QUARTER_COL_WIDTH = 220;

  return (
    <div className="bg-[#0D0D0D]">

      {/* ═══════════════════════════════════ MOBILE VIEW ═══════════════════════════════════ */}
      <div className="md:hidden">

        {/* Mobile Header */}
        <div className="flex items-start justify-between px-4 pt-2 pb-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[#F7941D]/20 to-[#FBBA00]/10 border border-[#F7941D]/20 flex items-center justify-center flex-shrink-0">
              <Map size={20} className="text-[#F7941D]" />
            </div>
            <div>
              <h1 className="text-2xl font-black text-[#F0F0F0]">Product Roadmap</h1>
              <p className="text-xs text-[#9A9A9A]">
                {repos.length} repo{repos.length !== 1 ? "s" : ""} · {cards.length} milestone{cards.length !== 1 ? "s" : ""}
              </p>
            </div>
          </div>
          <div className="flex items-center bg-white/5 border border-white/10 rounded-lg p-1 gap-1 mt-1 flex-shrink-0">
            <button
              onClick={() => setMode("view")}
              className={cn(
                "flex items-center gap-1 px-2.5 py-1.5 rounded-md text-xs font-semibold transition-all",
                mode === "view" ? "bg-white/10 text-white" : "text-[#9A9A9A]"
              )}
            >
              <Eye size={12} />
              View
            </button>
            <button
              onClick={() => setMode("edit")}
              className={cn(
                "flex items-center gap-1 px-2.5 py-1.5 rounded-md text-xs font-semibold transition-all",
                mode === "edit" ? "bg-[#F7941D]/20 text-[#F7941D]" : "text-[#9A9A9A]"
              )}
            >
              <Pencil size={12} />
              Edit
            </button>
          </div>
        </div>

        {/* Edit mode banner */}
        <AnimatePresence>
          {mode === "edit" && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              className="overflow-hidden mx-4 mb-2"
            >
              <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-[#F7941D]/10 border border-[#F7941D]/20">
                <Pencil size={12} className="text-[#F7941D] flex-none" />
                <p className="text-xs text-[#F7941D]">Tap a card to edit. Tap + to add a milestone.</p>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Quarter selector tabs */}
        <div className="px-4 mb-3">
          <div className="flex gap-2 overflow-x-auto scrollbar-hide pb-1">
            {quarters.map((quarter) => (
              <button
                key={`${quarter.year}-${quarter.q}`}
                onClick={() => setSelectedMobileQuarter(quarter)}
                className={cn(
                  "flex-none px-3 py-2 rounded-xl text-xs font-semibold border transition-all text-left",
                  selectedMobileQuarter.q === quarter.q && selectedMobileQuarter.year === quarter.year
                    ? quarter.isCurrent
                      ? "bg-[#F7941D]/20 border-[#F7941D]/50 text-[#F7941D]"
                      : "bg-white/10 border-white/20 text-white"
                    : "border-white/10 text-[#9A9A9A]"
                )}
              >
                <div className="font-bold">{quarter.label}</div>
                <div className="text-[10px] opacity-70 font-normal">
                  {quarter.q === 1 ? "Jan–Mar" : quarter.q === 2 ? "Apr–Jun" : quarter.q === 3 ? "Jul–Sep" : "Oct–Dec"}
                </div>
                {quarter.isCurrent && (
                  <div className="mt-0.5">
                    <span className="text-[9px] font-bold bg-[#F7941D] text-black px-1 py-0.5 rounded leading-none">NOW</span>
                  </div>
                )}
              </button>
            ))}
          </div>
        </div>

        {/* Legend */}
        <div className="flex items-center gap-4 px-4 mb-4 flex-wrap">
          {(Object.entries(STATUS_CONFIG) as [StatusKey, typeof STATUS_CONFIG[StatusKey]][]).map(([key, cfg]) => (
            <div key={key} className="flex items-center gap-1.5">
              <span className={cn("w-2 h-2 rounded-full", cfg.dot)} />
              <span className="text-xs text-[#9A9A9A]">{cfg.label}</span>
            </div>
          ))}
          <div className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-sm border border-[#F7941D]/60 bg-[#F7941D]/10" />
            <span className="text-xs text-[#9A9A9A]">Current Quarter</span>
          </div>
        </div>

        {/* Repos list for selected quarter */}
        {repos.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-center px-6">
            <div className="w-14 h-14 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center mb-3">
              <Map size={24} className="text-[#555]" />
            </div>
            <p className="text-[#9A9A9A] font-medium">No repositories connected</p>
            <p className="text-[#555] text-sm mt-1">Connect repos in the Codebase section first</p>
          </div>
        ) : (
          <div className="px-4 space-y-3 pb-8">
            {repos.map((repo, repoIdx) => {
              const card = getCard(repo.id, selectedMobileQuarter.q, selectedMobileQuarter.year);
              const cfg = card ? STATUS_CONFIG[card.status as StatusKey] ?? STATUS_CONFIG.planning : null;
              return (
                <div key={repo.id} className="rounded-2xl border border-white/[0.06] bg-white/[0.02] p-3">
                  {/* Repo header */}
                  <div className="flex items-center justify-between mb-2.5">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-white truncate">{repo.name}</p>
                      {repo.description && (
                        <p className="text-[11px] text-[#555] mt-0.5 truncate">{repo.description}</p>
                      )}
                    </div>
                    {mode === "edit" && (
                      <div className="flex items-center gap-0.5 ml-2 flex-shrink-0">
                        <button
                          onClick={() => moveRepo(repoIdx, "up")}
                          disabled={repoIdx === 0}
                          className="p-1.5 rounded-lg text-[#555] hover:text-[#F7941D] disabled:opacity-20 transition-colors"
                        >
                          <ChevronUp size={14} />
                        </button>
                        <button
                          onClick={() => moveRepo(repoIdx, "down")}
                          disabled={repoIdx === repos.length - 1}
                          className="p-1.5 rounded-lg text-[#555] hover:text-[#F7941D] disabled:opacity-20 transition-colors"
                        >
                          <ChevronDown size={14} />
                        </button>
                        <button
                          onClick={() => removeRepo(repo)}
                          className="p-1.5 rounded-lg text-[#555] hover:text-red-400 transition-colors"
                        >
                          <EyeOff size={14} />
                        </button>
                      </div>
                    )}
                  </div>

                  {/* Milestone card or empty state */}
                  {card && cfg ? (
                    <motion.div
                      layout
                      onClick={mode === "edit" ? () => openModal(repo.id, selectedMobileQuarter, card) : undefined}
                      className={cn(
                        "relative rounded-xl border bg-gradient-to-br p-4 overflow-hidden",
                        cfg.bg,
                        cfg.border,
                        mode === "edit" && "cursor-pointer",
                        mode === "edit" && cfg.glow,
                      )}
                      whileTap={mode === "edit" ? { scale: 0.98 } : undefined}
                    >
                      <div className="absolute inset-0 bg-gradient-to-br from-white/[0.03] to-transparent pointer-events-none rounded-xl" />
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex-1 min-w-0">
                          <div className={cn("inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-bold uppercase tracking-wide mb-2", cfg.badge)}>
                            <span className={cn("w-1.5 h-1.5 rounded-full", cfg.dot)} />
                            {cfg.label}
                          </div>
                          <p className="text-sm font-bold text-white leading-tight mb-1">{card.title}</p>
                          {card.description && (
                            <p className="text-xs text-white/50 leading-relaxed">{card.description}</p>
                          )}
                          {card.uid && (
                            <div className="mt-2">
                              <span className="text-[10px] font-mono font-bold text-white/30 bg-white/5 px-1.5 py-0.5 rounded">{card.uid}</span>
                            </div>
                          )}
                        </div>
                        {mode === "edit" && <Pencil size={14} className="text-white/30 flex-shrink-0 mt-1" />}
                      </div>
                    </motion.div>
                  ) : mode === "edit" ? (
                    <motion.button
                      onClick={() => openModal(repo.id, selectedMobileQuarter)}
                      className="w-full py-4 rounded-xl border border-dashed border-white/10 hover:border-[#F7941D]/40 hover:bg-[#F7941D]/5 flex items-center justify-center gap-2 transition-all"
                      whileTap={{ scale: 0.98 }}
                    >
                      <Plus size={15} className="text-white/25" />
                      <span className="text-sm text-white/25">Add milestone</span>
                    </motion.button>
                  ) : (
                    <div className="w-full py-3 rounded-xl border border-white/[0.04] flex items-center justify-center">
                      <span className="text-xs text-[#555]">No milestone</span>
                    </div>
                  )}
                </div>
              );
            })}

            {/* Hidden repos (edit mode) */}
            {mode === "edit" && hiddenRepos.length > 0 && (
              <div>
                <p className="text-[10px] font-semibold text-[#555] uppercase tracking-widest mb-2 px-1">Hidden repos</p>
                <div className="flex flex-col gap-2">
                  {hiddenRepos.map((repo) => (
                    <button
                      key={repo.id}
                      onClick={() => addRepo(repo)}
                      className="flex items-center gap-2 w-full text-left px-3 py-2.5 rounded-xl border border-dashed border-white/10 text-[#9A9A9A] hover:border-[#F7941D]/40 hover:bg-[#F7941D]/5 transition-all"
                    >
                      <Plus size={14} className="flex-none text-[#555]" />
                      <span className="text-sm font-medium">{repo.name}</span>
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* ═══════════════════════════════════ DESKTOP VIEW ══════════════════════════════════ */}
      <div className="hidden md:flex flex-col h-full bg-[#0D0D0D] overflow-hidden">

        {/* ── Page Header ── */}
        <div className="flex-none px-6 pt-6 pb-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[#F7941D]/20 to-[#FBBA00]/10 border border-[#F7941D]/20 flex items-center justify-center">
                <Map size={20} className="text-[#F7941D]" />
              </div>
              <div>
                <h1 className="text-2xl font-black text-[#F0F0F0]">Product Roadmap</h1>
                <p className="text-sm text-[#9A9A9A]">
                  {repos.length} repo{repos.length !== 1 ? "s" : ""} · {cards.length} milestone{cards.length !== 1 ? "s" : ""}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={scrollToCurrentQuarter}
                className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold text-[#F7941D] border border-[#F7941D]/30 hover:bg-[#F7941D]/10 transition-colors"
              >
                <Sparkles size={13} />
                Today
              </button>

              <div className="flex gap-1">
                <button
                  onClick={() => scroll("left")}
                  disabled={!canScrollLeft}
                  className="p-2 rounded-lg text-[#9A9A9A] hover:text-white hover:bg-white/10 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                >
                  <ChevronLeft size={16} />
                </button>
                <button
                  onClick={() => scroll("right")}
                  disabled={!canScrollRight}
                  className="p-2 rounded-lg text-[#9A9A9A] hover:text-white hover:bg-white/10 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                >
                  <ChevronRight size={16} />
                </button>
              </div>

              <div className="flex items-center bg-white/5 border border-white/10 rounded-lg p-1 gap-1">
                <button
                  onClick={() => setMode("view")}
                  className={cn(
                    "flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-semibold transition-all",
                    mode === "view" ? "bg-white/10 text-white shadow-sm" : "text-[#9A9A9A] hover:text-white"
                  )}
                >
                  <Eye size={13} />
                  View
                </button>
                <button
                  onClick={() => setMode("edit")}
                  className={cn(
                    "flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-semibold transition-all",
                    mode === "edit" ? "bg-[#F7941D]/20 text-[#F7941D] shadow-sm" : "text-[#9A9A9A] hover:text-white"
                  )}
                >
                  <Pencil size={13} />
                  Edit
                </button>
              </div>
            </div>
          </div>

          <AnimatePresence>
            {mode === "edit" && (
              <motion.div
                initial={{ opacity: 0, height: 0, marginTop: 0 }}
                animate={{ opacity: 1, height: "auto", marginTop: 12 }}
                exit={{ opacity: 0, height: 0, marginTop: 0 }}
                className="overflow-hidden"
              >
                <div className="flex items-center gap-2 px-3 py-2.5 rounded-lg bg-[#F7941D]/10 border border-[#F7941D]/20">
                  <Pencil size={13} className="text-[#F7941D] flex-none" />
                  <p className="text-xs text-[#F7941D]">
                    <span className="font-semibold">Edit mode:</span> Click any cell to add or edit a milestone. Use the arrows to reorder repos.
                  </p>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* ── Legend ── */}
        <div className="flex-none px-6 pb-3 flex items-center gap-4">
          {(Object.entries(STATUS_CONFIG) as [StatusKey, typeof STATUS_CONFIG[StatusKey]][]).map(([key, cfg]) => (
            <div key={key} className="flex items-center gap-1.5">
              <span className={cn("w-2.5 h-2.5 rounded-full", cfg.dot)} />
              <span className="text-xs text-[#9A9A9A]">{cfg.label}</span>
            </div>
          ))}
          <div className="flex items-center gap-1.5 ml-2">
            <span className="w-2.5 h-2.5 rounded-sm border border-[#F7941D]/60 bg-[#F7941D]/10" />
            <span className="text-xs text-[#9A9A9A]">Current Quarter</span>
          </div>
        </div>

        {/* ── Grid ── */}
        <div className="flex-1 overflow-hidden relative">
          <div
            className={cn(
              "absolute left-0 top-0 bottom-0 w-12 z-20 pointer-events-none transition-opacity duration-300",
              "bg-gradient-to-r from-[#0D0D0D] to-transparent",
              canScrollLeft ? "opacity-100" : "opacity-0"
            )}
            style={{ left: REPO_COL_WIDTH }}
          />
          <div
            className={cn(
              "absolute right-0 top-0 bottom-0 w-16 z-20 pointer-events-none transition-opacity duration-300",
              "bg-gradient-to-l from-[#0D0D0D] to-transparent",
              canScrollRight ? "opacity-100" : "opacity-0"
            )}
          />

          <div className="h-full overflow-y-auto">
            <div className="relative" style={{ minWidth: REPO_COL_WIDTH + quarters.length * QUARTER_COL_WIDTH }}>

              {/* ── Sticky header row ── */}
              <div className="sticky top-0 z-30 flex bg-[#0D0D0D] border-b border-white/5">
                <div
                  className="flex-none sticky left-0 z-40 bg-[#0D0D0D] flex items-end pb-3 px-4 pt-3"
                  style={{ width: REPO_COL_WIDTH }}
                >
                  <span className="text-xs font-semibold text-[#9A9A9A] uppercase tracking-widest">Repository</span>
                </div>

                <div
                  ref={scrollRef}
                  className="flex overflow-x-auto scrollbar-hide"
                  onScroll={updateScrollButtons}
                >
                  {quarters.map((quarter) => (
                    <div
                      key={`${quarter.year}-${quarter.q}`}
                      className="flex-none relative"
                      style={{ width: QUARTER_COL_WIDTH }}
                    >
                      <div
                        className={cn(
                          "relative mx-1 mt-2 mb-1 rounded-lg px-3 py-2 transition-all",
                          quarter.isCurrent
                            ? "bg-[#F7941D]/15 border border-[#F7941D]/40"
                            : "border border-transparent"
                        )}
                      >
                        {quarter.isCurrent && (
                          <motion.div
                            className="absolute inset-0 rounded-lg"
                            animate={{ boxShadow: ["0 0 0px rgba(247,148,29,0)", "0 0 16px rgba(247,148,29,0.3)", "0 0 0px rgba(247,148,29,0)"] }}
                            transition={{ duration: 2.5, repeat: Infinity }}
                          />
                        )}
                        <div className="flex items-center gap-2">
                          <span className={cn("text-sm font-bold", quarter.isCurrent ? "text-[#F7941D]" : "text-[#F0F0F0]")}>
                            {quarter.label}
                          </span>
                          {quarter.isCurrent && (
                            <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-[#F7941D] text-black leading-none">
                              NOW
                            </span>
                          )}
                        </div>
                        <p className="text-[10px] text-[#555] mt-0.5">
                          {quarter.q === 1 ? "Jan–Mar" : quarter.q === 2 ? "Apr–Jun" : quarter.q === 3 ? "Jul–Sep" : "Oct–Dec"}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* ── Repo rows ── */}
              {repos.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-24 text-center">
                  <div className="w-16 h-16 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center mb-4">
                    <Map size={28} className="text-[#555]" />
                  </div>
                  <p className="text-[#9A9A9A] font-medium">No repositories connected</p>
                  <p className="text-[#555] text-sm mt-1">Connect repos in the Codebase section first</p>
                </div>
              ) : (
                <>
                  {repos.map((repo, repoIdx) => (
                    <RepoRow
                      key={repo.id}
                      repo={repo}
                      repoIdx={repoIdx}
                      totalRepos={repos.length}
                      quarters={quarters}
                      mode={mode}
                      repoColWidth={REPO_COL_WIDTH}
                      quarterColWidth={QUARTER_COL_WIDTH}
                      scrollRef={scrollRef}
                      onCellClick={(q, existing) => openModal(repo.id, q, existing)}
                      onMoveUp={() => moveRepo(repoIdx, "up")}
                      onMoveDown={() => moveRepo(repoIdx, "down")}
                      onRemove={() => removeRepo(repo)}
                      getCard={getCard}
                    />
                  ))}
                  {mode === "edit" && hiddenRepos.length > 0 && (
                    <div className="flex border-b border-white/[0.04]">
                      <div
                        className="flex-none sticky left-0 z-20 bg-[#0D0D0D] px-4 py-3"
                        style={{ width: REPO_COL_WIDTH }}
                      >
                        <p className="text-[10px] font-semibold text-[#555] uppercase tracking-widest mb-2">
                          Hidden repos
                        </p>
                        <div className="flex flex-col gap-1.5">
                          {hiddenRepos.map((repo) => (
                            <button
                              key={repo.id}
                              onClick={() => addRepo(repo)}
                              className="flex items-center gap-2 w-full text-left px-2.5 py-1.5 rounded-lg border border-dashed border-white/10 text-[#9A9A9A] hover:text-white hover:border-[#F7941D]/40 hover:bg-[#F7941D]/5 transition-all group"
                            >
                              <Plus size={12} className="flex-none text-[#555] group-hover:text-[#F7941D]" />
                              <span className="text-xs font-medium truncate">{repo.name}</span>
                            </button>
                          ))}
                        </div>
                      </div>
                    </div>
                  )}
                </>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* ── Card Modal (shared) ── */}
      <AnimatePresence>
        {modalOpen && modalQuarter && (
          <CardModal
            card={modalCard}
            repoName={repos.find((r) => r.id === modalRepoId)?.name ?? ""}
            quarter={modalQuarter}
            onSave={handleSaveCard}
            onDelete={handleDeleteCard}
            onClose={() => setModalOpen(false)}
            isNew={!modalCard}
          />
        )}
      </AnimatePresence>

      {saving && (
        <div className="fixed bottom-4 right-4 z-50 flex items-center gap-2 px-3 py-2 rounded-lg bg-[#1a1a1a] border border-white/10 text-xs text-[#9A9A9A] shadow-xl">
          <motion.div
            animate={{ rotate: 360 }}
            transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
            className="w-3 h-3 border border-[#F7941D] border-t-transparent rounded-full"
          />
          Saving…
        </div>
      )}
    </div>
  );
}

// ─── Repo Row (separated to avoid re-renders) ─────────────────────────────────

interface RepoRowProps {
  repo: Repo;
  repoIdx: number;
  totalRepos: number;
  quarters: Quarter[];
  mode: "view" | "edit";
  repoColWidth: number;
  quarterColWidth: number;
  scrollRef: React.RefObject<HTMLDivElement | null>;
  onCellClick: (quarter: Quarter, existing?: RoadmapCard) => void;
  onMoveUp: () => void;
  onMoveDown: () => void;
  onRemove: () => void;
  getCard: (repoId: string, q: number, year: number) => RoadmapCard | undefined;
}

function RepoRow({
  repo,
  repoIdx,
  totalRepos,
  quarters,
  mode,
  repoColWidth,
  quarterColWidth,
  scrollRef,
  onCellClick,
  onMoveUp,
  onMoveDown,
  onRemove,
  getCard,
}: RepoRowProps) {
  return (
    <motion.div
      layout
      className="flex border-b border-white/[0.04] group/row hover:bg-white/[0.01] transition-colors"
    >
      {/* ── Repo name cell (sticky left) ── */}
      <div
        className="flex-none sticky left-0 z-20 bg-[#0D0D0D] group/row-hover:bg-[#111] transition-colors flex items-center justify-between px-4 py-4"
        style={{ width: repoColWidth, minHeight: 120 }}
      >
        <div className="flex-1 min-w-0 pr-2">
          <p className="text-sm font-semibold text-white truncate">{repo.name}</p>
          {repo.description && (
            <p className="text-[11px] text-[#555] mt-0.5 line-clamp-2 leading-relaxed">{repo.description}</p>
          )}
        </div>

        {/* Order + remove buttons (edit mode only) */}
        <AnimatePresence>
          {mode === "edit" && (
            <motion.div
              initial={{ opacity: 0, x: 6 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 6 }}
              className="flex flex-col gap-0.5"
            >
              <button
                onClick={onMoveUp}
                disabled={repoIdx === 0}
                className="p-1 rounded text-[#555] hover:text-[#F7941D] hover:bg-[#F7941D]/10 disabled:opacity-20 disabled:cursor-not-allowed transition-colors"
              >
                <ChevronUp size={14} />
              </button>
              <button
                onClick={onMoveDown}
                disabled={repoIdx === totalRepos - 1}
                className="p-1 rounded text-[#555] hover:text-[#F7941D] hover:bg-[#F7941D]/10 disabled:opacity-20 disabled:cursor-not-allowed transition-colors"
              >
                <ChevronDown size={14} />
              </button>
              <button
                onClick={onRemove}
                title="Hide from roadmap"
                className="p-1 rounded text-[#555] hover:text-red-400 hover:bg-red-500/10 transition-colors mt-0.5"
              >
                <EyeOff size={14} />
              </button>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* ── Quarter cells (scroll-synced with header) ── */}
      <div className="flex overflow-x-auto scrollbar-hide pointer-events-none">
        {/* This inner container mirrors the header scroll state via JS sync */}
        <SyncedScrollRow scrollRef={scrollRef} totalWidth={quarters.length * quarterColWidth}>
          {quarters.map((quarter) => {
            const card = getCard(repo.id, quarter.q, quarter.year);
            return (
              <RoadmapCell
                key={`${quarter.year}-${quarter.q}`}
                quarter={quarter}
                card={card}
                mode={mode}
                quarterColWidth={quarterColWidth}
                onClick={() => onCellClick(quarter, card)}
              />
            );
          })}
        </SyncedScrollRow>
      </div>
    </motion.div>
  );
}

// ─── Synced scroll row ────────────────────────────────────────────────────────

function SyncedScrollRow({
  scrollRef,
  totalWidth,
  children,
}: {
  scrollRef: React.RefObject<HTMLDivElement | null>;
  totalWidth: number;
  children: React.ReactNode;
}) {
  const rowRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const header = scrollRef.current;
    const row = rowRef.current;
    if (!header || !row) return;

    function syncScroll() {
      if (row) row.scrollLeft = header!.scrollLeft;
    }

    header.addEventListener("scroll", syncScroll, { passive: true });
    syncScroll();
    return () => header.removeEventListener("scroll", syncScroll);
  }, [scrollRef]);

  return (
    <div
      ref={rowRef}
      className="flex overflow-x-hidden pointer-events-auto"
      style={{ width: totalWidth }}
    >
      {children}
    </div>
  );
}

// ─── Roadmap Cell ─────────────────────────────────────────────────────────────

interface RoadmapCellProps {
  quarter: Quarter;
  card: RoadmapCard | undefined;
  mode: "view" | "edit";
  quarterColWidth: number;
  onClick: () => void;
}

function RoadmapCell({ quarter, card, mode, quarterColWidth, onClick }: RoadmapCellProps) {
  const cfg = card ? STATUS_CONFIG[card.status as StatusKey] ?? STATUS_CONFIG.planning : null;
  const isClickable = mode === "edit";

  return (
    <div
      className={cn(
        "flex-none p-2 relative",
        quarter.isCurrent && "bg-[#F7941D]/[0.03]"
      )}
      style={{ width: quarterColWidth, minHeight: 120 }}
    >
      {/* Current quarter column highlight */}
      {quarter.isCurrent && (
        <div className="absolute inset-x-0 top-0 h-full border-x border-[#F7941D]/10 pointer-events-none" />
      )}

      {card && cfg ? (
        // ── Filled card ──
        <motion.div
          layout
          onClick={isClickable ? onClick : undefined}
          className={cn(
            "relative h-full min-h-[96px] rounded-xl border bg-gradient-to-br p-3 overflow-hidden transition-all duration-200",
            cfg.bg,
            cfg.border,
            isClickable && "cursor-pointer hover:scale-[1.02] hover:z-10",
            isClickable && cfg.glow,
          )}
          whileHover={isClickable ? { scale: 1.02 } : undefined}
          whileTap={isClickable ? { scale: 0.98 } : undefined}
        >
          {/* Shimmer overlay */}
          <div className="absolute inset-0 bg-gradient-to-br from-white/[0.03] to-transparent pointer-events-none rounded-xl" />

          {/* Status badge */}
          <div className={cn("inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-bold uppercase tracking-wide mb-2", cfg.badge)}>
            <span className={cn("w-1.5 h-1.5 rounded-full", cfg.dot)} />
            {cfg.label}
          </div>

          {/* Title */}
          <p className="text-xs font-bold text-white leading-tight mb-1 line-clamp-2">{card.title}</p>

          {/* Description */}
          {card.description && (
            <p className="text-[10px] text-white/50 leading-relaxed line-clamp-3">{card.description}</p>
          )}

          {/* UID */}
          {card.uid && (
            <div className="absolute bottom-2 right-2">
              <span className="text-[9px] font-mono font-bold text-white/30 bg-white/5 px-1.5 py-0.5 rounded">
                {card.uid}
              </span>
            </div>
          )}

          {/* Edit indicator */}
          {isClickable && (
            <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity">
              <Pencil size={10} className="text-white/40" />
            </div>
          )}
        </motion.div>
      ) : isClickable ? (
        // ── Empty cell (edit mode) ──
        <motion.button
          onClick={onClick}
          className="w-full h-full min-h-[96px] rounded-xl border border-dashed border-white/10 hover:border-[#F7941D]/40 hover:bg-[#F7941D]/5 flex flex-col items-center justify-center gap-1.5 transition-all group/cell"
          whileHover={{ scale: 1.01 }}
          whileTap={{ scale: 0.99 }}
        >
          <Plus size={14} className="text-white/20 group-hover/cell:text-[#F7941D]/60 transition-colors" />
          <span className="text-[10px] text-white/15 group-hover/cell:text-[#F7941D]/50 font-medium transition-colors">Add</span>
        </motion.button>
      ) : (
        // ── Empty cell (view mode) ──
        <div className="w-full h-full min-h-[96px] rounded-xl" />
      )}
    </div>
  );
}
