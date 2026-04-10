"use client";

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, Search, GitFork, Loader2, Link2, BookOpen } from "lucide-react";
import { cn } from "@/lib/utils";

interface AvailableRepo {
  id: number;
  owner: string;
  name: string;
  fullName: string;
  description: string | null;
  isPrivate: boolean;
  defaultBranch: string;
}

interface Props {
  open: boolean;
  currentRepo: { repoOwner: string; repoName: string; branch: string } | null;
  onClose: () => void;
  onConnect: (owner: string, name: string, branch: string, description?: string) => Promise<void>;
  onDisconnect: () => Promise<void>;
}

export function ConnectRepoDialog({ open, currentRepo, onClose, onConnect, onDisconnect }: Props) {
  const [repos, setRepos] = useState<AvailableRepo[]>([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<AvailableRepo | null>(null);
  const [branch, setBranch] = useState("main");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    setLoading(true);
    fetch("/api/knowledge/available-repos")
      .then((r) => r.json())
      .then((d) => setRepos(d.repos ?? []))
      .catch(() => setRepos([]))
      .finally(() => setLoading(false));
  }, [open]);

  useEffect(() => {
    if (selected) setBranch(selected.defaultBranch);
  }, [selected]);

  const filtered = repos.filter((r) =>
    r.fullName.toLowerCase().includes(search.toLowerCase()) ||
    (r.description ?? "").toLowerCase().includes(search.toLowerCase())
  );

  async function handleConnect() {
    if (!selected) return;
    setSaving(true);
    try {
      await onConnect(selected.owner, selected.name, branch, selected.description ?? undefined);
      onClose();
    } finally {
      setSaving(false);
    }
  }

  async function handleDisconnect() {
    setSaving(true);
    try {
      await onDisconnect();
      onClose();
    } finally {
      setSaving(false);
    }
  }

  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm"
            onClick={onClose}
          />
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            transition={{ duration: 0.2, ease: [0.32, 0.72, 0, 1] }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4 pointer-events-none"
          >
            <div
              className="w-full max-w-xl bg-[#111111] border border-[rgba(255,255,255,0.08)] rounded-2xl overflow-hidden shadow-2xl pointer-events-auto"
              onClick={(e) => e.stopPropagation()}
            >
              {/* Header */}
              <div className="flex items-center justify-between px-6 py-5 border-b border-[rgba(255,255,255,0.06)]">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-lg bg-[rgba(247,148,29,0.15)] flex items-center justify-center">
                    <Link2 size={16} className="text-[#F7941D]" />
                  </div>
                  <div>
                    <h2 className="text-[#F0F0F0] font-semibold text-sm">Connect Knowledge Repo</h2>
                    <p className="text-[#606060] text-xs">Select an Obsidian or docs repository</p>
                  </div>
                </div>
                <button
                  onClick={onClose}
                  className="p-1.5 text-[#606060] hover:text-[#F0F0F0] hover:bg-[rgba(255,255,255,0.06)] rounded-lg transition-all"
                >
                  <X size={16} />
                </button>
              </div>

              {/* Current connection */}
              {currentRepo && (
                <div className="px-6 py-4 border-b border-[rgba(255,255,255,0.06)] bg-[rgba(247,148,29,0.05)]">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-2 h-2 rounded-full bg-emerald-400" />
                      <div>
                        <p className="text-[#F0F0F0] text-sm font-medium">
                          {currentRepo.repoOwner}/{currentRepo.repoName}
                        </p>
                        <p className="text-[#606060] text-xs">Branch: {currentRepo.branch}</p>
                      </div>
                    </div>
                    <button
                      onClick={handleDisconnect}
                      disabled={saving}
                      className="text-xs text-[#9A4A4A] hover:text-red-400 transition-colors"
                    >
                      Disconnect
                    </button>
                  </div>
                </div>
              )}

              {/* Search */}
              <div className="px-6 pt-4">
                <div className="relative">
                  <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#606060]" />
                  <input
                    type="text"
                    placeholder="Search repositories..."
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    className="w-full bg-[rgba(255,255,255,0.04)] border border-[rgba(255,255,255,0.08)] rounded-lg pl-8 pr-3 py-2 text-sm text-[#F0F0F0] placeholder:text-[#606060] focus:outline-none focus:border-[rgba(247,148,29,0.4)] transition-colors"
                  />
                </div>
              </div>

              {/* Repo list */}
              <div className="px-6 py-3 max-h-64 overflow-y-auto space-y-1">
                {loading ? (
                  <div className="flex items-center justify-center py-8">
                    <Loader2 size={20} className="text-[#606060] animate-spin" />
                  </div>
                ) : filtered.length === 0 ? (
                  <div className="text-center py-8 text-[#606060] text-sm">No repositories found</div>
                ) : (
                  filtered.map((repo) => (
                    <button
                      key={repo.id}
                      onClick={() => setSelected(repo)}
                      className={cn(
                        "w-full flex items-start gap-3 px-3 py-2.5 rounded-lg text-left transition-all",
                        selected?.id === repo.id
                          ? "bg-[rgba(247,148,29,0.1)] border border-[rgba(247,148,29,0.3)]"
                          : "hover:bg-[rgba(255,255,255,0.04)] border border-transparent"
                      )}
                    >
                      <GitFork size={16} className={cn("mt-0.5 flex-shrink-0", selected?.id === repo.id ? "text-[#F7941D]" : "text-[#606060]")} />
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <span className={cn("text-sm font-medium truncate", selected?.id === repo.id ? "text-[#F7941D]" : "text-[#F0F0F0]")}>
                            {repo.fullName}
                          </span>
                          {repo.isPrivate && (
                            <span className="text-[10px] px-1.5 py-0.5 rounded bg-[rgba(255,255,255,0.06)] text-[#606060] flex-shrink-0">
                              private
                            </span>
                          )}
                        </div>
                        {repo.description && (
                          <p className="text-xs text-[#606060] truncate mt-0.5">{repo.description}</p>
                        )}
                      </div>
                    </button>
                  ))
                )}
              </div>

              {/* Branch input */}
              {selected && (
                <div className="px-6 py-3 border-t border-[rgba(255,255,255,0.06)]">
                  <label className="block text-xs text-[#9A9A9A] mb-1.5">Branch</label>
                  <input
                    type="text"
                    value={branch}
                    onChange={(e) => setBranch(e.target.value)}
                    className="w-full bg-[rgba(255,255,255,0.04)] border border-[rgba(255,255,255,0.08)] rounded-lg px-3 py-2 text-sm text-[#F0F0F0] focus:outline-none focus:border-[rgba(247,148,29,0.4)] transition-colors"
                  />
                </div>
              )}

              {/* Footer */}
              <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-[rgba(255,255,255,0.06)]">
                <button
                  onClick={onClose}
                  className="px-4 py-2 text-sm text-[#9A9A9A] hover:text-[#F0F0F0] transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleConnect}
                  disabled={!selected || saving}
                  className={cn(
                    "flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-lg transition-all",
                    selected && !saving
                      ? "bg-[#F7941D] text-white hover:bg-[#e8851a]"
                      : "bg-[rgba(255,255,255,0.06)] text-[#606060] cursor-not-allowed"
                  )}
                >
                  {saving ? (
                    <Loader2 size={14} className="animate-spin" />
                  ) : (
                    <BookOpen size={14} />
                  )}
                  Connect Repository
                </button>
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
