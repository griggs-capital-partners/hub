"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, Zap, CalendarDays, CheckCircle2, Loader2, Trash2 } from "lucide-react";
import { cn } from "@/lib/utils";

interface Sprint {
  id: string;
  name: string;
  status: string;
  startDate: string;
  endDate: string;
}

interface CurrentSprint {
  id: string;       // SprintTask id
  sprintId: string;
  sprint: { id: string; name: string; status: string };
}

interface Props {
  cardTitle: string;
  cardId: string;
  currentSprint: CurrentSprint | null;
  sprints: Sprint[];
  onClose: () => void;
  onAdded: (sprintTask: { id: string; sprintId: string; sprint: { id: string; name: string; status: string } }) => void;
  onRemoved: () => void;
}

function formatDate(d: string) {
  return new Date(d).toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

const STATUS_STYLE: Record<string, { color: string; bg: string; label: string }> = {
  active:    { color: "#22C55E", bg: "rgba(34,197,94,0.12)",    label: "Active" },
  planning:  { color: "#F7941D", bg: "rgba(247,148,29,0.12)",   label: "Planning" },
  completed: { color: "#606060", bg: "rgba(96,96,96,0.12)",     label: "Completed" },
};

export function AddToSprintModal({ cardTitle, cardId, currentSprint, sprints, onClose, onAdded, onRemoved }: Props) {
  const [loading, setLoading] = useState<string | null>(null);
  const [removing, setRemoving] = useState(false);

  const availableSprints = sprints.filter((s) => s.status === "active" || s.status === "planning");

  async function handleAdd(sprintId: string) {
    setLoading(sprintId);
    try {
      const res = await fetch(`/api/sprints/${sprintId}/tasks`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ kanbanCardId: cardId }),
      });
      if (!res.ok) {
        const err = await res.json();
        alert(err.error ?? "Failed to add to sprint");
        return;
      }
      const task = await res.json();
      onAdded({ id: task.id, sprintId: task.sprintId, sprint: { id: task.sprintId, name: sprints.find((s) => s.id === sprintId)!.name, status: sprints.find((s) => s.id === sprintId)!.status } });
      onClose();
    } finally {
      setLoading(null);
    }
  }

  async function handleRemove() {
    if (!currentSprint) return;
    setRemoving(true);
    try {
      // We need the sprint and task id — currentSprint.id is the SprintTask id
      const sprintId = currentSprint.sprintId;
      const taskId = currentSprint.id;
      await fetch(`/api/sprints/${sprintId}/tasks/${taskId}`, { method: "DELETE" });
      onRemoved();
      onClose();
    } finally {
      setRemoving(false);
    }
  }

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm"
      onClick={onClose}
    >
      <motion.div
        initial={{ scale: 0.95, opacity: 0, y: 16 }}
        animate={{ scale: 1, opacity: 1, y: 0 }}
        exit={{ scale: 0.95, opacity: 0 }}
        transition={{ type: "spring", stiffness: 300, damping: 28 }}
        className="w-full max-w-sm bg-[#111111] border border-[rgba(255,255,255,0.08)] rounded-2xl shadow-2xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-[rgba(255,255,255,0.06)]">
          <div className="flex items-center gap-2.5">
            <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-[#F7941D] to-[#7B1C24] flex items-center justify-center flex-shrink-0">
              <Zap size={13} className="text-white" />
            </div>
            <div className="min-w-0">
              <p className="text-xs font-bold text-[#F0F0F0]">Add to Sprint</p>
              <p className="text-xs text-[#606060] truncate max-w-[180px]">{cardTitle}</p>
            </div>
          </div>
          <button onClick={onClose} className="text-[#606060] hover:text-[#F0F0F0] transition-colors">
            <X size={16} />
          </button>
        </div>

        <div className="p-4 space-y-3">
          {/* Current sprint indicator */}
          {currentSprint && (
            <div className="p-3 rounded-xl bg-[rgba(247,148,29,0.08)] border border-[rgba(247,148,29,0.2)]">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <CheckCircle2 size={14} className="text-[#F7941D]" />
                  <div>
                    <p className="text-xs font-semibold text-[#F0F0F0]">Currently in sprint</p>
                    <p className="text-xs text-[#9A9A9A]">{currentSprint.sprint.name}</p>
                  </div>
                </div>
                <button
                  onClick={handleRemove}
                  disabled={removing}
                  className="flex items-center gap-1 text-xs text-[#EF4444] hover:text-[#FF6B6B] disabled:opacity-50 transition-colors px-2 py-1 rounded-lg hover:bg-[rgba(239,68,68,0.08)]"
                >
                  {removing ? <Loader2 size={12} className="animate-spin" /> : <Trash2 size={12} />}
                  Remove
                </button>
              </div>
            </div>
          )}

          {/* Sprint list */}
          {availableSprints.length === 0 ? (
            <div className="py-8 text-center">
              <Zap size={24} className="text-[#333333] mx-auto mb-2" />
              <p className="text-sm text-[#606060]">No active or planning sprints</p>
              <p className="text-xs text-[#404040] mt-1">Create a sprint first</p>
            </div>
          ) : (
            <div className="space-y-1.5">
              <p className="text-xs font-semibold text-[#9A9A9A] uppercase tracking-wider px-1">
                {currentSprint ? "Move to another sprint" : "Select a sprint"}
              </p>
              {availableSprints.map((sprint) => {
                const isCurrentSprint = currentSprint?.sprintId === sprint.id;
                const style = STATUS_STYLE[sprint.status] ?? STATUS_STYLE.planning;
                const isLoading = loading === sprint.id;

                return (
                  <button
                    key={sprint.id}
                    onClick={() => !isCurrentSprint && handleAdd(sprint.id)}
                    disabled={isLoading || isCurrentSprint}
                    className={cn(
                      "w-full flex items-center justify-between px-3 py-2.5 rounded-xl border text-left transition-all",
                      isCurrentSprint
                        ? "border-[rgba(247,148,29,0.3)] bg-[rgba(247,148,29,0.06)] cursor-default"
                        : "border-[rgba(255,255,255,0.06)] hover:border-[rgba(247,148,29,0.3)] hover:bg-[rgba(247,148,29,0.05)] bg-[rgba(255,255,255,0.02)]"
                    )}
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <div
                        className="w-2 h-2 rounded-full flex-shrink-0"
                        style={{ backgroundColor: style.color }}
                      />
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-[#F0F0F0] truncate">{sprint.name}</p>
                        <div className="flex items-center gap-1 text-xs text-[#606060]">
                          <CalendarDays size={10} />
                          {formatDate(sprint.startDate)} – {formatDate(sprint.endDate)}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0 ml-2">
                      <span
                        className="text-xs px-2 py-0.5 rounded-full font-medium"
                        style={{ color: style.color, backgroundColor: style.bg }}
                      >
                        {style.label}
                      </span>
                      {isLoading && <Loader2 size={13} className="animate-spin text-[#F7941D]" />}
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </motion.div>
    </motion.div>
  );
}
