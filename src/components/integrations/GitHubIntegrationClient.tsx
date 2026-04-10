"use client";

import { useState } from "react";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import {
  ArrowLeft,
  ToggleLeft,
  ToggleRight,
  LinkIcon,
  Unlink,
  Lock,
  Globe,
  Star,
  AlertCircle,
  Loader2,
  Check,
  Search,
  ChevronDown,
  ChevronUp,
  Plus,
  FolderGit2,
  X,
} from "lucide-react";
import { Avatar } from "@/components/ui/Avatar";
import { Button } from "@/components/ui/Button";

// ─── Types ────────────────────────────────────────────────────────────────────

interface Repo {
  id: string;
  name: string;
  fullName: string;
  description: string | null;
  url: string;
  language: string | null;
  isPrivate: boolean;
  starCount: number;
  openIssues: number;
  connected: boolean;
}

interface DiscoveredRepo {
  id: number;
  name: string;
  fullName: string;
  description: string | null;
  url: string;
  language: string | null;
  isPrivate: boolean;
  starCount: number;
  openIssues: number;
  owner: string | null;
  alreadyAdded: boolean;
  wasAddedBefore: boolean;
}

interface TeamUser {
  id: string;
  name: string | null;
  displayName: string | null;
  email: string;
  image: string | null;
  githubAccount: {
    providerAccountId: string;
    scope: string | null;
  } | null;
}

interface Props {
  initialRepos: Repo[];
  allUsers: TeamUser[];
  currentUserId: string;
  myGitHubConnected: boolean;
  myGitHubLogin: string | null;
}

// ─── Language colors ──────────────────────────────────────────────────────────

const LANG_COLORS: Record<string, string> = {
  TypeScript: "#3178C6",
  JavaScript: "#F7DF1E",
  Python: "#3776AB",
  Go: "#00ADD8",
  Rust: "#CE422B",
  Java: "#B07219",
  "C#": "#178600",
  Ruby: "#CC342D",
  PHP: "#4F5D95",
  Swift: "#FA7343",
};

function LangDot({ lang }: { lang: string | null }) {
  if (!lang) return null;
  return (
    <span className="flex items-center gap-1 text-xs text-[#606060]">
      <span
        className="w-2 h-2 rounded-full flex-shrink-0"
        style={{ backgroundColor: LANG_COLORS[lang] ?? "#606060" }}
      />
      {lang}
    </span>
  );
}

// ─── Workspace repo row (already in DB) ───────────────────────────────────────

function WorkspaceRepoRow({
  repo,
  onToggle,
  toggling,
}: {
  repo: Repo;
  onToggle: (id: string, connected: boolean) => void;
  toggling: boolean;
}) {
  return (
    <div
      className={`flex items-center gap-3 px-4 py-3 rounded-xl border transition-all duration-200 ${repo.connected
          ? "bg-[#161616] border-[rgba(255,255,255,0.06)]"
          : "bg-[#111111] border-[rgba(255,255,255,0.03)] opacity-50"
        }`}
    >
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <a
            href={repo.url}
            target="_blank"
            rel="noopener noreferrer"
            className="text-sm font-medium text-[#F0F0F0] hover:text-[#F7941D] transition-colors truncate"
          >
            {repo.name}
          </a>
          {repo.isPrivate ? (
            <Lock size={11} className="text-[#606060] flex-shrink-0" />
          ) : (
            <Globe size={11} className="text-[#404040] flex-shrink-0" />
          )}
        </div>
        <div className="flex items-center gap-3 mt-0.5 flex-wrap">
          <LangDot lang={repo.language} />
          {repo.starCount > 0 && (
            <span className="flex items-center gap-1 text-xs text-[#606060]">
              <Star size={10} />{repo.starCount}
            </span>
          )}
          {repo.openIssues > 0 && (
            <span className="flex items-center gap-1 text-xs text-[#606060]">
              <AlertCircle size={10} />{repo.openIssues} open
            </span>
          )}
        </div>
      </div>

      <button
        onClick={() => onToggle(repo.id, !repo.connected)}
        disabled={toggling}
        title={repo.connected ? "Remove from workspace" : "Re-enable in workspace"}
        className="flex items-center gap-1.5 text-xs px-2.5 py-1.5 rounded-lg border transition-all duration-200 flex-shrink-0 cursor-pointer disabled:opacity-50"
        style={
          repo.connected
            ? { color: "#22C55E", borderColor: "rgba(34,197,94,0.2)", background: "rgba(34,197,94,0.08)" }
            : { color: "#606060", borderColor: "rgba(255,255,255,0.06)", background: "transparent" }
        }
      >
        {toggling ? (
          <Loader2 size={12} className="animate-spin" />
        ) : repo.connected ? (
          <ToggleRight size={14} />
        ) : (
          <ToggleLeft size={14} />
        )}
        <span>{repo.connected ? "Active" : "Disabled"}</span>
      </button>
    </div>
  );
}

// ─── Discovered repo row (not yet in DB) ─────────────────────────────────────

function DiscoverRow({
  repo,
  selected,
  onToggleSelect,
}: {
  repo: DiscoveredRepo;
  selected: boolean;
  onToggleSelect: (id: number) => void;
}) {
  return (
    <button
      onClick={() => !repo.alreadyAdded && onToggleSelect(repo.id)}
      disabled={repo.alreadyAdded}
      className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl border text-left transition-all duration-150 ${repo.alreadyAdded
          ? "bg-[#111111] border-[rgba(255,255,255,0.04)] opacity-40 cursor-default"
          : selected
            ? "bg-[rgba(247,148,29,0.08)] border-[rgba(247,148,29,0.3)] cursor-pointer"
            : "bg-[#161616] border-[rgba(255,255,255,0.06)] hover:border-[rgba(255,255,255,0.12)] cursor-pointer"
        }`}
    >
      {/* Checkbox */}
      <div
        className={`w-4 h-4 rounded flex-shrink-0 flex items-center justify-center border transition-all ${repo.alreadyAdded
            ? "bg-[#222222] border-[#404040]"
            : selected
              ? "bg-[#F7941D] border-[#F7941D]"
              : "border-[#404040]"
          }`}
      >
        {repo.alreadyAdded ? (
          <Check size={10} className="text-[#606060]" />
        ) : selected ? (
          <Check size={10} className="text-black" />
        ) : null}
      </div>

      {/* Info */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium text-[#F0F0F0] truncate">{repo.name}</span>
          {repo.isPrivate ? (
            <Lock size={11} className="text-[#606060] flex-shrink-0" />
          ) : (
            <Globe size={11} className="text-[#404040] flex-shrink-0" />
          )}
          {repo.owner && (
            <span className="text-xs text-[#404040] flex-shrink-0">{repo.owner}</span>
          )}
        </div>
        <div className="flex items-center gap-3 mt-0.5 flex-wrap">
          <LangDot lang={repo.language} />
          {repo.description && (
            <span className="text-xs text-[#404040] truncate hidden sm:block">{repo.description}</span>
          )}
          {repo.alreadyAdded ? (
            <span className="text-xs text-[#606060]">Already in workspace</span>
          ) : repo.wasAddedBefore ? (
            <span className="text-xs text-[#8A8A8A]">Previously added, will be re-enabled</span>
          ) : null}
        </div>
      </div>
    </button>
  );
}

// ─── Main client component ────────────────────────────────────────────────────

export function GitHubIntegrationClient({
  initialRepos,
  allUsers,
  currentUserId,
  myGitHubConnected,
  myGitHubLogin,
}: Props) {
  // Workspace repos (in DB)
  const [repos, setRepos] = useState<Repo[]>(initialRepos);
  const [togglingIds, setTogglingIds] = useState<Set<string>>(new Set());
  const [workspaceSearch, setWorkspaceSearch] = useState("");
  const [showAllWorkspace, setShowAllWorkspace] = useState(false);

  // Discovery panel
  const [discovering, setDiscovering] = useState(false);
  const [discovered, setDiscovered] = useState<DiscoveredRepo[] | null>(null);
  const [discoverError, setDiscoverError] = useState<string | null>(null);
  const [discoverSearch, setDiscoverSearch] = useState("");
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [adding, setAdding] = useState(false);
  const [addMsg, setAddMsg] = useState<{ text: string; ok: boolean } | null>(null);

  // User account
  const [disconnecting, setDisconnecting] = useState(false);

  const connectedCount = repos.filter((p) => p.connected).length;

  // ── Workspace filtering ──
  const filteredWorkspace = repos.filter(
    (p) =>
      p.name.toLowerCase().includes(workspaceSearch.toLowerCase()) ||
      (p.description ?? "").toLowerCase().includes(workspaceSearch.toLowerCase())
  );
  const visibleWorkspace = showAllWorkspace ? filteredWorkspace : filteredWorkspace.slice(0, 10);

  // ── Discovery filtering ──
  const filteredDiscovered = (discovered ?? []).filter(
    (r) =>
      r.name.toLowerCase().includes(discoverSearch.toLowerCase()) ||
      (r.fullName ?? "").toLowerCase().includes(discoverSearch.toLowerCase()) ||
      (r.description ?? "").toLowerCase().includes(discoverSearch.toLowerCase())
  );
  const notYetAdded = filteredDiscovered.filter((r) => !r.alreadyAdded);
  const selectedCount = [...selectedIds].filter((id) =>
    notYetAdded.some((r) => r.id === id)
  ).length;

  async function handleDiscover() {
    setDiscovering(true);
    setDiscoverError(null);
    setDiscovered(null);
    setSelectedIds(new Set());
    try {
      const res = await fetch("/api/github/discover");
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Discovery failed");
      setDiscovered(data.repos ?? []);
    } catch (err) {
      setDiscoverError(err instanceof Error ? err.message : "Discovery failed");
    } finally {
      setDiscovering(false);
    }
  }

  function toggleSelect(id: number) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function selectAll() {
    setSelectedIds(new Set(notYetAdded.map((r) => r.id)));
  }

  function clearSelection() {
    setSelectedIds(new Set());
  }

  async function handleAddSelected() {
    if (selectedIds.size === 0) return;
    setAdding(true);
    setAddMsg(null);
    try {
      const res = await fetch("/api/github/repos/add", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ githubIds: [...selectedIds] }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Failed to add repos");
      setRepos(data.repos ?? []);
      setAddMsg({ text: `Added ${data.added} ${data.added === 1 ? "repo" : "repos"} to workspace`, ok: true });
      // Mark added repos in discovered list
      setDiscovered((prev) =>
        (prev ?? []).map((r) => (selectedIds.has(r.id) ? { ...r, alreadyAdded: true } : r))
      );
      setSelectedIds(new Set());
      setTimeout(() => setAddMsg(null), 4000);
    } catch (err) {
      setAddMsg({ text: err instanceof Error ? err.message : "Failed to add repos", ok: false });
    } finally {
      setAdding(false);
    }
  }

  async function handleToggle(id: string, connected: boolean) {
    setTogglingIds((prev) => new Set(prev).add(id));
    try {
      const res = await fetch(`/api/repos/${id}/toggle`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ connected }),
      });
      if (!res.ok) throw new Error("Failed to update");
      setRepos((prev) => prev.map((p) => (p.id === id ? { ...p, connected } : p)));
    } catch {
      // silently ignore
    } finally {
      setTogglingIds((prev) => { const n = new Set(prev); n.delete(id); return n; });
    }
  }

  async function handleDisconnectGitHub() {
    setDisconnecting(true);
    try {
      await fetch("/api/github/disconnect", { method: "DELETE" });
      window.location.reload();
    } finally {
      setDisconnecting(false);
    }
  }

  const myInfo = allUsers.find((u) => u.id === currentUserId);

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3 mb-2">
        <Link
          href="/integrations"
          className="p-1.5 text-[#606060] hover:text-[#F0F0F0] hover:bg-[rgba(255,255,255,0.06)] rounded-lg transition-all"
        >
          <ArrowLeft size={16} />
        </Link>
        <div className="w-8 h-8 rounded-lg bg-[#222222] flex items-center justify-center">
          <svg viewBox="0 0 16 16" fill="currentColor" className="w-4 h-4 text-[#F0F0F0]">
            <path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.013 8.013 0 0016 8c0-4.42-3.58-8-8-8z" />
          </svg>
        </div>
        <div>
          <h2 className="text-xl font-black text-[#F0F0F0]">GitHub</h2>
          <p className="text-xs text-[#606060]">
            {connectedCount} active {connectedCount === 1 ? "repo" : "repos"} · {repos.length} in workspace
          </p>
        </div>
      </div>

      {/* ── Section 1: Workspace Repositories ─────────────────────────────── */}
      <section className="space-y-3">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h3 className="text-sm font-bold text-[#F0F0F0]">Workspace Repositories</h3>
            <p className="text-xs text-[#606060] mt-0.5">
              Repos added to your workspace. Toggle to enable or disable in Codebase.
            </p>
          </div>
          <Button
            size="sm"
            variant="primary"
            icon={discovering ? <Loader2 size={13} className="animate-spin" /> : <Plus size={13} />}
            onClick={handleDiscover}
            loading={discovering}
          >
            Add Repositories
          </Button>
        </div>

        {/* ── Discovery panel ── */}
        <AnimatePresence>
          {(discovering || discovered !== null || discoverError) && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              className="overflow-hidden"
            >
              <div className="border border-[rgba(247,148,29,0.2)] rounded-2xl bg-[#111111] overflow-hidden">
                {/* Discovery header */}
                <div className="flex items-center justify-between px-4 py-3 border-b border-[rgba(255,255,255,0.05)]">
                  <span className="text-xs font-semibold text-[#F7941D] uppercase tracking-wider">
                    {discovering
                      ? "Searching GitHub..."
                      : discovered !== null
                        ? `Found ${discovered.length} ${discovered.length === 1 ? "repo" : "repos"}`
                        : "Discovery failed"}
                  </span>
                  <button
                    onClick={() => { setDiscovered(null); setDiscoverError(null); setSelectedIds(new Set()); }}
                    className="p-1 text-[#606060] hover:text-[#F0F0F0] transition-colors"
                  >
                    <X size={14} />
                  </button>
                </div>

                {discovering && (
                  <div className="flex items-center justify-center py-10 gap-2 text-xs text-[#606060]">
                    <Loader2 size={16} className="animate-spin" />
                    Searching your GitHub account and organization...
                  </div>
                )}

                {discoverError && (
                  <div className="px-4 py-4 text-xs text-[#EF4444]">{discoverError}</div>
                )}

                {discovered !== null && !discovering && (
                  <div className="p-3 space-y-2">
                    {/* Search */}
                    <div className="relative">
                      <Search size={12} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#404040]" />
                      <input
                        type="text"
                        placeholder="Filter repos..."
                        value={discoverSearch}
                        onChange={(e) => setDiscoverSearch(e.target.value)}
                        className="w-full bg-[#1A1A1A] border border-[rgba(255,255,255,0.06)] rounded-xl pl-8 pr-3 py-2 text-xs text-[#F0F0F0] placeholder:text-[#404040] focus:outline-none focus:border-[rgba(247,148,29,0.3)]"
                      />
                    </div>

                    {/* Select all / clear */}
                    {notYetAdded.length > 0 && (
                      <div className="flex items-center justify-between px-1">
                        <span className="text-xs text-[#606060]">
                          {notYetAdded.length} not yet added · {selectedCount} selected
                        </span>
                        <div className="flex gap-3">
                          <button
                            onClick={selectAll}
                            className="text-xs text-[#F7941D] hover:underline"
                          >
                            Select all
                          </button>
                          {selectedCount > 0 && (
                            <button
                              onClick={clearSelection}
                              className="text-xs text-[#606060] hover:text-[#F0F0F0]"
                            >
                              Clear
                            </button>
                          )}
                        </div>
                      </div>
                    )}

                    {/* Repo list */}
                    <div className="space-y-1.5 max-h-80 overflow-y-auto pr-1">
                      {filteredDiscovered.length === 0 ? (
                        <p className="text-center py-6 text-xs text-[#404040]">No repos found.</p>
                      ) : (
                        filteredDiscovered.map((repo) => (
                          <DiscoverRow
                            key={repo.id}
                            repo={repo}
                            selected={selectedIds.has(repo.id)}
                            onToggleSelect={toggleSelect}
                          />
                        ))
                      )}
                    </div>

                    {/* Add button */}
                    {selectedCount > 0 && (
                      <div className="flex items-center justify-between pt-2 border-t border-[rgba(255,255,255,0.05)]">
                        <span className="text-xs text-[#606060]">
                          {selectedCount} {selectedCount === 1 ? "repo" : "repos"} selected
                        </span>
                        <Button
                          size="sm"
                          variant="primary"
                          loading={adding}
                          icon={<FolderGit2 size={13} />}
                          onClick={handleAddSelected}
                        >
                          Add {selectedCount} to workspace
                        </Button>
                      </div>
                    )}

                    {addMsg && (
                      <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        className={`text-xs px-3 py-2 rounded-lg ${addMsg.ok
                            ? "bg-[rgba(34,197,94,0.1)] text-[#22C55E] border border-[rgba(34,197,94,0.2)]"
                            : "bg-[rgba(239,68,68,0.1)] text-[#EF4444] border border-[rgba(239,68,68,0.2)]"
                          }`}
                      >
                        {addMsg.text}
                      </motion.div>
                    )}

                    {discovered.length > 0 && notYetAdded.length === 0 && !discoverSearch && (
                      <p className="text-center py-3 text-xs text-[#404040]">
                        All discovered repos are already in your workspace.
                      </p>
                    )}
                  </div>
                )}

                {/* PAT access note */}
                {discovered !== null && !discovering && (
                  <div className="px-4 py-3 border-t border-[rgba(255,255,255,0.04)] bg-[#0D0D0D]">
                    <p className="text-xs text-[#404040]">
                      Missing repos from your org?{" "}
                      <span className="text-[#606060]">
                        Create a GitHub PAT with <code className="text-[#F0F0F0]">griggs-capital-partners</code> as the resource owner, or use a classic PAT with <code className="text-[#F0F0F0]">repo</code> scope authorized for SSO.
                      </span>
                    </p>
                  </div>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Workspace repo list */}
        {repos.length === 0 ? (
          <div className="text-center py-12 text-[#404040]">
            <FolderGit2 size={28} className="mx-auto mb-3 opacity-30" />
            <p className="text-sm">No repositories in workspace yet.</p>
            <p className="text-xs mt-1">Click <span className="text-[#F7941D]">Add Repositories</span> to discover and add repos.</p>
          </div>
        ) : (
          <>
            {repos.length > 1 && (
              <div className="relative">
                <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#404040]" />
                <input
                  type="text"
                  placeholder="Filter workspace repos..."
                  value={workspaceSearch}
                  onChange={(e) => setWorkspaceSearch(e.target.value)}
                  className="w-full bg-[#161616] border border-[rgba(255,255,255,0.06)] rounded-xl pl-8 pr-3 py-2 text-sm text-[#F0F0F0] placeholder:text-[#404040] focus:outline-none focus:border-[rgba(247,148,29,0.3)]"
                />
              </div>
            )}

            <div className="space-y-1.5">
              {visibleWorkspace.map((p) => (
                <WorkspaceRepoRow
                  key={p.id}
                  repo={p}
                  onToggle={handleToggle}
                  toggling={togglingIds.has(p.id)}
                />
              ))}
              {filteredWorkspace.length === 0 && (
                <p className="text-center py-6 text-xs text-[#404040]">No repos match your filter.</p>
              )}
              {filteredWorkspace.length > 10 && (
                <button
                  onClick={() => setShowAllWorkspace(!showAllWorkspace)}
                  className="w-full flex items-center justify-center gap-1.5 py-2.5 text-xs text-[#606060] hover:text-[#F0F0F0] transition-colors"
                >
                  {showAllWorkspace ? <><ChevronUp size={13} /> Show fewer</> : <><ChevronDown size={13} /> Show all {filteredWorkspace.length}</>}
                </button>
              )}
            </div>
          </>
        )}
      </section>

      {/* ── Section 2: User GitHub Account Linkage ────────────────────────── */}
      <section className="space-y-3 pt-2 border-t border-[rgba(255,255,255,0.06)]">
        <div>
          <h3 className="text-sm font-bold text-[#F0F0F0]">GitHub Account Linkage</h3>
          <p className="text-xs text-[#606060] mt-0.5">
            Link each team member&apos;s GitHub identity so SmartHub knows who is performing actions on GitHub.
          </p>
        </div>

        {/* My account */}
        <div className="p-4 rounded-xl bg-[#161616] border border-[rgba(247,148,29,0.15)] space-y-3">
          <p className="text-xs font-semibold text-[#F7941D] uppercase tracking-wider">Your Account</p>
          <div className="flex items-center gap-3">
            <Avatar src={myInfo?.image} name={myInfo?.displayName ?? myInfo?.name} size="sm" />
            <div className="flex-1 min-w-0">
              <div className="text-sm font-medium text-[#F0F0F0]">
                {myInfo?.displayName ?? myInfo?.name ?? myInfo?.email}
              </div>
              {myGitHubConnected ? (
                <div className="flex items-center gap-1.5 mt-0.5">
                  <span className="text-xs text-[#22C55E]">Linked as</span>
                  <a
                    href={`https://github.com/${myGitHubLogin}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-xs text-[#F7941D] hover:underline font-medium"
                  >
                    @{myGitHubLogin}
                  </a>
                </div>
              ) : (
                <div className="text-xs text-[#606060] mt-0.5">No GitHub account linked</div>
              )}
            </div>
            {myGitHubConnected ? (
              <Button size="sm" variant="danger" icon={<Unlink size={12} />} loading={disconnecting} onClick={handleDisconnectGitHub}>
                Unlink
              </Button>
            ) : (
              <Button size="sm" variant="primary" icon={<LinkIcon size={12} />} onClick={() => { window.location.href = "/api/github/connect"; }}>
                Link GitHub
              </Button>
            )}
          </div>
        </div>

        {/* Team members */}
        <div className="space-y-1.5">
          {allUsers
            .filter((u) => u.id !== currentUserId)
            .map((user) => {
              const name = user.displayName ?? user.name ?? user.email;
              return (
                <div key={user.id} className="flex items-center gap-3 px-4 py-3 bg-[#161616] rounded-xl border border-[rgba(255,255,255,0.05)]">
                  <Avatar src={user.image} name={name} size="sm" />
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium text-[#F0F0F0] truncate">{name}</div>
                    <div className="text-xs text-[#606060] truncate">{user.email}</div>
                  </div>
                  {user.githubAccount ? (
                    <div className="flex items-center gap-1.5 flex-shrink-0">
                      <Check size={12} className="text-[#22C55E]" />
                      <a
                        href={`https://github.com/${user.githubAccount.providerAccountId}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-xs text-[#F7941D] hover:underline"
                      >
                        @{user.githubAccount.providerAccountId}
                      </a>
                    </div>
                  ) : (
                    <span className="text-xs text-[#404040] flex-shrink-0">Not linked</span>
                  )}
                </div>
              );
            })}
        </div>
      </section>

      {/* ── Section 3: Setup / env notes ──────────────────────────────────── */}
      <section className="pt-2 border-t border-[rgba(255,255,255,0.06)]">
        <details className="group">
          <summary className="flex items-center gap-2 cursor-pointer text-xs text-[#606060] hover:text-[#F0F0F0] transition-colors list-none">
            <ChevronDown size={13} className="group-open:rotate-180 transition-transform" />
            Environment setup — GitHub tokens &amp; OAuth App
          </summary>
          <div className="mt-3 p-4 bg-[#111111] rounded-xl border border-[rgba(255,255,255,0.05)] space-y-4 text-xs text-[#606060]">
            <div className="space-y-2">
              <p className="font-semibold text-[#F0F0F0]">Repo sync token (GITHUB_TOKEN)</p>
              <p>To access private org repos, create a fine-grained PAT with <strong className="text-[#F0F0F0]">griggs-capital-partners</strong> as the resource owner — or use a classic PAT with <code className="text-[#F0F0F0]">repo</code> scope, then authorize it for SSO in the org settings.</p>
              <pre className="bg-[#0D0D0D] rounded-lg p-3 text-[#F0F0F0] overflow-x-auto">{`GITHUB_TOKEN=your_pat_here
GITHUB_ORG=griggs-capital-partners   # filter by this owner`}</pre>
            </div>
            <div className="space-y-2">
              <p className="font-semibold text-[#F0F0F0]">User account OAuth App (GITHUB_CLIENT_ID)</p>
              <p>For linking individual team member accounts. Callback URL:</p>
              <pre className="bg-[#0D0D0D] rounded-lg p-3 text-[#F0F0F0] overflow-x-auto">{`http://localhost:3000/api/github/callback`}</pre>
            </div>
          </div>
        </details>
      </section>
    </div>
  );
}
