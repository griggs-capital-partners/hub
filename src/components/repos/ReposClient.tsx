"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  FolderGit2, Star, AlertCircle, Lock,
  ExternalLink, Search, LayoutGrid, List,
  ChevronRight, Clock, Code, Cloud,
} from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/Button";
import { Avatar } from "@/components/ui/Avatar";
import { timeAgo } from "@/lib/utils";
import { CommitHeatmap } from "@/components/repos/CommitHeatmap";
import { ACTIVE_COLUMN, normalizeKanbanColumnName } from "@/lib/kanban-columns";

interface Repo {
  id: string;
  name: string;
  fullName: string;
  description: string | null;
  language: string | null;
  isPrivate: boolean;
  starCount: number;
  openIssues: number;
  url: string;
  pushedAt: Date | string | null;
  updatedAt: Date;
  boards: Array<{
    columns: Array<{
      name: string;
      cards: Array<{ assignees: string }>;
    }>;
  }>;
  _count?: { awsLinks: number };
}

interface TeamUser {
  id: string;
  name: string | null;
  displayName: string | null;
  image: string | null;
  githubLogin: string | null;
}

interface Props {
  initialRepos: Repo[];
  teamUsers: TeamUser[];
}

const container = {
  hidden: { opacity: 0 },
  show: { opacity: 1, transition: { staggerChildren: 0.06 } },
};
const item = { hidden: { opacity: 0, y: 12 }, show: { opacity: 1, y: 0 } };

function getCardCount(repo: Repo) {
  return repo.boards.flatMap((b) => b.columns.flatMap((c) => c.cards)).length;
}

function getInProgress(repo: Repo) {
  return repo.boards
    .flatMap((b) => b.columns)
    .filter((c) => normalizeKanbanColumnName(c.name) === ACTIVE_COLUMN)
    .reduce((s, c) => s + c.cards.length, 0);
}

function getActiveUsers(repo: Repo, byId: Map<string, TeamUser>): TeamUser[] {
  const seen = new Set<string>();
  const result: TeamUser[] = [];
  for (const board of repo.boards) {
    for (const col of board.columns) {
      for (const card of col.cards) {
        let ids: string[] = [];
        try { ids = JSON.parse(card.assignees); } catch { /* skip */ }
        for (const id of ids) {
          if (!seen.has(id)) {
            const user = byId.get(id);
            if (user) { seen.add(id); result.push(user); }
          }
        }
      }
    }
  }
  return result;
}

function AvatarStack({ users }: { users: TeamUser[] }) {
  const MAX = 4;
  const visible = users.slice(0, MAX);
  const overflow = users.length - MAX;
  return (
    <div className="flex items-center">
      {visible.map((u, i) => (
        <div
          key={u.id}
          className="ring-2 ring-[#1A1A1A] rounded-full"
          style={{ marginLeft: i === 0 ? 0 : -6, zIndex: MAX - i, position: "relative" }}
          title={u.displayName ?? u.name ?? u.id}
        >
          <Avatar src={u.image} name={u.displayName ?? u.name} size="xs" />
        </div>
      ))}
      {overflow > 0 && (
        <div
          className="relative ring-2 ring-[#1A1A1A] rounded-full flex items-center justify-center bg-[#2A2A2A] text-[#9A9A9A] text-[10px] font-bold"
          style={{ width: 24, height: 24, marginLeft: -6 }}
        >
          +{overflow}
        </div>
      )}
    </div>
  );
}

export function ReposClient({ initialRepos, teamUsers }: Props) {
  const [repos, setRepos] = useState(initialRepos);
  const [syncing, setSyncing] = useState(false);
  const usersById = new Map(teamUsers.map((u) => [u.id, u]));
  const [search, setSearch] = useState("");
  const [view, setView] = useState<"grid" | "list">("grid");
  const [syncMsg, setSyncMsg] = useState<string | null>(null);

  async function syncRepos() {
    setSyncing(true);
    setSyncMsg(null);
    try {
      const res = await fetch("/api/github/repos");
      const data = await res.json();
      setSyncMsg(`Synced ${data.synced ?? 0} repositories`);
      const reposRes = await fetch("/api/repos");
      const reposData = await reposRes.json();
      setRepos(reposData.repos ?? []);
    } catch {
      setSyncMsg("Sync failed — check your GitHub token");
    } finally {
      setSyncing(false);
    }
  }

  const filtered = repos.filter(
    (r) =>
      r.name.toLowerCase().includes(search.toLowerCase()) ||
      r.description?.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-black text-[#F0F0F0] flex items-center gap-3">
            <FolderGit2 size={22} className="text-[#F7941D]" />
            Codebase
          </h1>
          <p className="text-sm text-[#606060] mt-0.5">
            {repos.length} repositories
          </p>
        </div>
        <div className="flex items-center gap-3">
          <div className="relative">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#606060]" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search repositories..."
              className="w-48 bg-[#1A1A1A] border border-[rgba(255,255,255,0.07)] rounded-lg pl-8 pr-3 py-2 text-sm text-[#F0F0F0] placeholder:text-[#606060] focus:outline-none focus:w-64 focus:border-[rgba(247,148,29,0.4)] transition-all duration-200"
            />
          </div>
          <div className="flex items-center gap-1 bg-[#1A1A1A] border border-[rgba(255,255,255,0.07)] rounded-lg p-1">
            <button
              onClick={() => setView("grid")}
              className={`p-1.5 rounded transition-all ${view === "grid" ? "bg-[rgba(247,148,29,0.15)] text-[#F7941D]" : "text-[#606060] hover:text-[#F0F0F0]"}`}
            >
              <LayoutGrid size={14} />
            </button>
            <button
              onClick={() => setView("list")}
              className={`p-1.5 rounded transition-all ${view === "list" ? "bg-[rgba(247,148,29,0.15)] text-[#F7941D]" : "text-[#606060] hover:text-[#F0F0F0]"}`}
            >
              <List size={14} />
            </button>
          </div>

        </div>
      </div>

      {/* Commit Heatmap */}
      <CommitHeatmap />

      {syncMsg && (
        <motion.div
          initial={{ opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex items-center gap-2 px-4 py-2.5 bg-[rgba(34,197,94,0.1)] border border-[rgba(34,197,94,0.2)] rounded-xl text-sm text-[#22C55E]"
        >
          ✓ {syncMsg}
        </motion.div>
      )}

      {/* Repos */}
      <AnimatePresence mode="wait">
        {filtered.length === 0 ? (
          <motion.div
            key="empty"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="flex flex-col items-center justify-center py-20 text-center"
          >
            <FolderGit2 size={48} className="text-[#333333] mb-4" />
            <p className="text-[#606060] font-medium">
              {search ? "No repositories match your search" : "No repositories synced yet"}
            </p>
            {!search && (
              <p className="text-[#404040] text-sm mt-1 mb-4">
                Repositories you activate in Integrations will appear here.
              </p>
            )}
          </motion.div>
        ) : view === "grid" ? (
          <motion.div
            key="grid"
            variants={container}
            initial="hidden"
            animate="show"
            className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4"
          >
            {filtered.map((repo) => (
              <motion.div key={repo.id} variants={item}>
                <RepoCard repo={repo} usersById={usersById} />
              </motion.div>
            ))}
          </motion.div>
        ) : (
          <motion.div
            key="list"
            variants={container}
            initial="hidden"
            animate="show"
            className="space-y-2"
          >
            {filtered.map((repo) => (
              <motion.div key={repo.id} variants={item}>
                <RepoRow repo={repo} usersById={usersById} />
              </motion.div>
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function RepoCard({ repo, usersById }: { repo: Repo; usersById: Map<string, TeamUser> }) {
  const inProgress = getInProgress(repo);
  const totalCards = getCardCount(repo);
  const activeUsers = getActiveUsers(repo, usersById);
  const awsCount = repo._count?.awsLinks ?? 0;

  return (
    <Link href={`/repos/${repo.id}`}>
      <motion.div
        whileHover={{ y: -3, borderColor: "rgba(247,148,29,0.25)" }}
        className="bg-[#1A1A1A] border border-[rgba(255,255,255,0.07)] rounded-xl p-4 cursor-pointer transition-all duration-200 group h-full flex flex-col"
      >
        <div className="flex items-start justify-between mb-2">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-[rgba(247,148,29,0.2)] to-[rgba(123,28,36,0.2)] flex items-center justify-center flex-shrink-0">
              <FolderGit2 size={16} className="text-[#F7941D]" />
            </div>
            <div className="min-w-0">
              <h3 className="text-sm font-bold text-[#F0F0F0] group-hover:text-[#F7941D] transition-colors truncate">
                {repo.name}
              </h3>
              <div className="flex items-center gap-1 mt-0.5">
                {awsCount > 0 ? (
                  <><Cloud size={10} className="text-[#FF9900]" /><span className="text-xs text-[#FF9900]">{awsCount} AWS resource{awsCount !== 1 ? "s" : ""}</span></>
                ) : (
                  <Cloud size={10} className="text-[#333333]" />
                )}
              </div>
            </div>
          </div>
          <ChevronRight size={16} className="text-[#404040] group-hover:text-[#F7941D] transition-colors flex-shrink-0" />
        </div>

        {/* Stats row */}
        <div className="flex items-center gap-3 flex-wrap mt-auto mb-2">
          {repo.starCount > 0 && (
            <span className="flex items-center gap-1 text-xs text-[#9A9A9A]">
              <Star size={11} className="text-[#FBBA00]" />
              {repo.starCount}
            </span>
          )}
          {repo.openIssues > 0 && (
            <span className="flex items-center gap-1 text-xs text-[#F97316]">
              <AlertCircle size={11} />
              {repo.openIssues} issues
            </span>
          )}
          {inProgress > 0 && (
            <span className="flex items-center gap-1 text-xs text-[#3B82F6]">
              <Code size={11} />
              {inProgress} in progress
            </span>
          )}
        </div>

        <div className="flex items-center gap-1.5 mt-2 pt-2 border-t border-[rgba(255,255,255,0.05)] text-xs text-[#A0A0A0]">
          <Clock size={11} />
          {repo.pushedAt ? `Pushed ${timeAgo(new Date(repo.pushedAt))}` : `Synced ${timeAgo(repo.updatedAt)}`}
          {activeUsers.length > 0 && (
            <span className="ml-auto">
              <AvatarStack users={activeUsers} />
            </span>
          )}
          {activeUsers.length === 0 && totalCards > 0 && (
            <span className="ml-auto">{totalCards} cards</span>
          )}
        </div>
      </motion.div>
    </Link>
  );
}

function RepoRow({ repo, usersById }: { repo: Repo; usersById: Map<string, TeamUser> }) {
  const activeUsers = getActiveUsers(repo, usersById);
  const awsCount = repo._count?.awsLinks ?? 0;

  return (
    <Link href={`/repos/${repo.id}`}>
      <motion.div
        whileHover={{ borderColor: "rgba(247,148,29,0.2)" }}
        className="bg-[#1A1A1A] border border-[rgba(255,255,255,0.07)] rounded-xl px-5 py-3.5 cursor-pointer transition-all duration-200 flex items-center gap-4 group"
      >
        <FolderGit2 size={18} className="text-[#F7941D] flex-shrink-0" />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-sm font-semibold text-[#F0F0F0] group-hover:text-[#F7941D] transition-colors">
              {repo.name}
            </span>
            {repo.isPrivate && <Lock size={11} className="text-[#606060]" />}
          </div>
        </div>
        {activeUsers.length > 0 && (
          <div className="hidden md:block">
            <AvatarStack users={activeUsers} />
          </div>
        )}
        {awsCount > 0 ? (
          <span className="hidden md:flex items-center gap-1 text-xs text-[#FF9900]">
            <Cloud size={11} />
            {awsCount} deployment{awsCount !== 1 ? "s" : ""}
          </span>
        ) : (
          <Cloud size={11} className="hidden md:block text-[#333333]" />
        )}
        {repo.openIssues > 0 && (
          <span className="hidden md:flex items-center gap-1 text-xs text-[#F97316]">
            <AlertCircle size={11} />
            {repo.openIssues}
          </span>
        )}
        <span className="hidden lg:block text-xs text-[#A0A0A0]">{repo.pushedAt ? `Pushed ${timeAgo(new Date(repo.pushedAt))}` : `Synced ${timeAgo(repo.updatedAt)}`}</span>
        <ChevronRight size={14} className="text-[#404040] group-hover:text-[#F7941D] transition-colors" />
      </motion.div>
    </Link>
  );
}
