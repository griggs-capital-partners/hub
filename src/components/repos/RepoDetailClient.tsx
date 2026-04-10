"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import Link from "next/link";
import {
  ArrowLeft, GitBranch, Star, Globe, Lock, ExternalLink,
  KanbanSquare, GitPullRequest, Info, Clock, GitCommit,
  BookOpen, ChevronDown, AlertCircle, CheckCircle2, Circle,
  GitMerge, User, Shield, RefreshCw, FileText,
  Cloud, Server, Eye, Database, Zap, Box, Plug2, X, History, Layers, ChevronRight, Activity,
} from "lucide-react";
import { KanbanBoard } from "@/components/kanban/KanbanBoard";
import { KANBAN_TASK_STATE_META, isKanbanTaskState } from "@/components/kanban/taskState";
import { LANGUAGE_COLORS, timeAgo } from "@/lib/utils";

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
  pushedAt?: Date | string | null;
  updatedAt: Date | string;
  lastSyncedAt: Date | string;
}

interface UserModel {
  id: string;
  name: string | null;
  displayName: string | null;
  email: string;
  image: string | null;
  githubLogin: string | null;
}

interface AwsLink {
  id: string;
  service: string;
  resourceId: string;
  label: string;
  region: string | null;
}

interface CustomerRef {
  id: string;
  name: string;
  logoUrl: string | null;
  status: string;
}

const TABS = ["kanban", "issues", "pulls", "commits", "readme", "deployments", "info"] as const;
type Tab = typeof TABS[number];

const TAB_CONFIG: Record<Tab, { icon: React.ElementType; label: string }> = {
  kanban: { icon: KanbanSquare, label: "Kanban" },
  issues: { icon: AlertCircle, label: "Issues" },
  pulls: { icon: GitPullRequest, label: "PRs" },
  commits: { icon: GitCommit, label: "Commits" },
  readme: { icon: BookOpen, label: "README" },
  deployments: { icon: Cloud, label: "AWS Resources" },
  info: { icon: Info, label: "Info" },
};

// Map from github login → team user, built once from the users prop.
function buildGitHubMap(users: UserModel[]): Map<string, UserModel> {
  const map = new Map<string, UserModel>();
  for (const u of users) {
    if (u.githubLogin) map.set(u.githubLogin.toLowerCase(), u);
  }
  return map;
}

export function RepoDetailClient({
  repo: repoData,
  users,
  customers,
  awsLinks = [],
  currentUserId = null,
  isAwsConnected = false,
  awsAccountRegion,
}: {
  repo: Repo;
  users: UserModel[];
  customers: CustomerRef[];
  awsLinks?: AwsLink[];
  currentUserId?: string | null;
  isAwsConnected?: boolean;
  awsAccountRegion?: string | null;
}) {
  const [tab, setTab] = useState<Tab>("kanban");
  const [defaultBranch, setDefaultBranch] = useState<string | null>(null);

  const githubToUser = buildGitHubMap(users);

  const [owner, repo] = repoData.fullName.split("/");

  // Fetch default branch once on mount so we can show it in the header
  useEffect(() => {
    fetch(`/api/github/branches?owner=${encodeURIComponent(owner)}&repo=${encodeURIComponent(repo)}`)
      .then((r) => r.json())
      .then((d) => setDefaultBranch(d.defaultBranch ?? "main"))
      .catch(() => setDefaultBranch("main"));
  }, [owner, repo]);

  return (
    <div className="max-w-full">
      {/* Compact header strip */}
      <div className="flex items-center gap-3 px-4 py-3 mb-3 rounded-2xl border border-[rgba(255,255,255,0.07)] bg-[#161616]">
        <Link
          href="/repos"
          className="flex items-center justify-center w-7 h-7 rounded-lg text-[#F7941D] bg-[rgba(247,148,29,0.1)] hover:bg-[rgba(247,148,29,0.18)] border border-[rgba(247,148,29,0.25)] hover:border-[rgba(247,148,29,0.4)] transition-all flex-shrink-0"
          title="Back to repos"
        >
          <ArrowLeft size={13} />
        </Link>
        <div className="flex items-center gap-1.5 min-w-0">
          <span className="text-xs text-[#505050] font-medium">{owner}</span>
          <span className="text-[#383838]">/</span>
          <span className="text-sm font-bold text-[#E0E0E0] truncate">{repoData.name}</span>
        </div>
        {repoData.isPrivate ? (
          <span className="flex items-center gap-1 px-2 py-0.5 rounded-md bg-[rgba(255,255,255,0.04)] border border-[rgba(255,255,255,0.06)] text-[10px] text-[#707070] font-medium flex-shrink-0">
            <Lock size={9} />Private
          </span>
        ) : (
          <span className="flex items-center gap-1 px-2 py-0.5 rounded-md bg-[rgba(34,197,94,0.06)] border border-[rgba(34,197,94,0.1)] text-[10px] text-[#22C55E] font-medium flex-shrink-0">
            <Globe size={9} />Public
          </span>
        )}
        <div className="ml-auto flex items-center gap-2 flex-shrink-0">
          {repoData.pushedAt && (
            <span className="flex items-center gap-1 text-[11px] px-2.5 py-1 rounded-lg bg-[rgba(255,255,255,0.04)] border border-[rgba(255,255,255,0.07)] text-[#707070]">
              <Clock size={11} />
              {`Pushed ${timeAgo(repoData.pushedAt)}`}
            </span>
          )}
          <a
            href={repoData.url}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1 text-[11px] font-medium px-2.5 py-1 rounded-lg bg-[rgba(255,255,255,0.04)] border border-[rgba(255,255,255,0.07)] text-[#707070] hover:text-[#F0F0F0] hover:border-[rgba(247,148,29,0.2)] transition-all"
          >
            <ExternalLink size={11} /> GitHub
          </a>
        </div>
      </div>

      {/* Tabs container */}
      <div className="rounded-2xl border border-[rgba(255,255,255,0.07)] bg-[#161616] overflow-hidden">
        {/* Tabs */}
        <div className="flex items-center gap-1 border-b border-[rgba(255,255,255,0.06)] overflow-x-auto">
          {TABS.map((t) => {
            const { icon: Icon, label } = TAB_CONFIG[t];
            const issuesBadge = t === "issues" && repoData.openIssues > 0 ? repoData.openIssues : null;
            const deployBadge = t === "deployments" && awsLinks.length > 0 ? awsLinks.length : null;
            return (
              <button
                key={t}
                onClick={() => setTab(t)}
                className={`relative flex items-center gap-2 px-4 py-2.5 text-sm font-medium transition-all whitespace-nowrap ${tab === t
                  ? "text-[#F7941D]"
                  : "text-[#9A9A9A] hover:text-[#F0F0F0]"
                  }`}
              >
                <Icon size={14} />
                {label}
                {issuesBadge && (
                  <span className="absolute top-1 right-1 flex items-center justify-center min-w-[16px] h-4 px-1 rounded-full bg-[rgba(239,68,68,0.2)] text-[#EF4444] text-[9px] font-bold leading-none">
                    {issuesBadge}
                  </span>
                )}
                {deployBadge && (
                  <span className="absolute top-1 right-1 flex items-center justify-center min-w-[16px] h-4 px-1 rounded-full bg-[rgba(255,153,0,0.2)] text-[#FF9900] text-[9px] font-bold leading-none">
                    {deployBadge}
                  </span>
                )}
                {tab === t && (
                  <motion.div
                    layoutId="project-tab-indicator"
                    className="absolute bottom-0 left-0 right-0 h-0.5 bg-[#F7941D] rounded-t"
                  />
                )}
              </button>
            );
          })}
        </div>

        {/* Tab content */}
        <div className="p-4">
          {tab === "kanban" && (
            <KanbanBoard repoId={repoData.id} owner={owner} repo={repo} users={users} customers={customers} currentUserId={currentUserId} />
          )}
          {tab === "issues" && (
            <IssuesTab owner={owner} repo={repo} projectUrl={repoData.url} githubToUser={githubToUser} />
          )}
          {tab === "pulls" && (
            <PullsTab owner={owner} repo={repo} githubToUser={githubToUser} />
          )}
          {tab === "commits" && (
            <CommitsTab owner={owner} repo={repo} defaultBranch={defaultBranch ?? "main"} githubToUser={githubToUser} />
          )}
          {tab === "readme" && (
            <ReadmeTab owner={owner} repo={repo} />
          )}
          {tab === "deployments" && (
            <DeploymentsTab
              repoId={repoData.id}
              awsLinks={awsLinks}
              isAwsConnected={isAwsConnected}
              accountRegion={awsAccountRegion ?? "us-east-1"}
            />
          )}
          {tab === "info" && (
            <RepoInfo repo={repoData} defaultBranch={defaultBranch} />
          )}
        </div>
      </div>{/* end tabs container */}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Issues Tab
// ---------------------------------------------------------------------------

interface GHIssue {
  number: number;
  title: string;
  html_url: string;
  state: string;
  created_at: string;
  updated_at: string;
  labels: { name: string; color: string }[];
  assignees: { login: string; avatar_url: string }[];
  user: { login: string; avatar_url: string } | null;
  pull_request?: unknown;
}

function IssuesTab({ owner, repo, projectUrl, githubToUser }: { owner: string; repo: string; projectUrl: string; githubToUser: Map<string, UserModel> }) {
  const [state, setState] = useState<"open" | "closed">("open");
  const [issues, setIssues] = useState<GHIssue[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async (s: "open" | "closed") => {
    setLoading(true);
    try {
      const res = await fetch(`/api/github/issues?owner=${encodeURIComponent(owner)}&repo=${encodeURIComponent(repo)}&state=${s}`);
      const data = await res.json();
      // Filter out PRs (GitHub issues API returns PRs too)
      setIssues((data.issues ?? []).filter((i: GHIssue) => !i.pull_request));
    } catch {
      setIssues([]);
    } finally {
      setLoading(false);
    }
  }, [owner, repo]);

  useEffect(() => { load(state); }, [load, state]);

  return (
    <div className="space-y-4">
      {/* Toolbar */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1 p-1 bg-[#1A1A1A] rounded-lg border border-[rgba(255,255,255,0.07)]">
          {(["open", "closed"] as const).map((s) => (
            <button
              key={s}
              onClick={() => { setState(s); load(s); }}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium transition-all capitalize ${state === s
                ? "bg-[rgba(247,148,29,0.15)] text-[#F7941D]"
                : "text-[#9A9A9A] hover:text-[#F0F0F0]"
                }`}
            >
              {s === "open" ? <Circle size={12} /> : <CheckCircle2 size={12} />}
              {s}
            </button>
          ))}
        </div>
        <a
          href={`${projectUrl}/issues`}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-1.5 text-xs text-[#9A9A9A] hover:text-[#F7941D] transition-colors"
        >
          <ExternalLink size={12} /> Open in GitHub
        </a>
      </div>

      {loading ? (
        <LoadingRows count={5} />
      ) : issues.length === 0 ? (
        <EmptyState icon={AlertCircle} message={`No ${state} issues`} />
      ) : (
        <div className="space-y-2">
          {issues.map((issue) => (
            <a
              key={issue.number}
              href={issue.html_url}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-start gap-3 p-3.5 bg-[#1A1A1A] border border-[rgba(255,255,255,0.07)] rounded-xl hover:border-[rgba(247,148,29,0.3)] hover:bg-[rgba(247,148,29,0.04)] transition-all group"
            >
              <span className="text-xs text-[#606060] font-mono mt-0.5 min-w-[40px]">#{issue.number}</span>
              <div className="flex-1 min-w-0">
                <p className="text-sm text-[#E0E0E0] font-medium group-hover:text-[#F7941D] transition-colors leading-snug">
                  {issue.title}
                </p>
                <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                  {issue.labels.map((l) => (
                    <span
                      key={l.name}
                      className="text-[10px] px-1.5 py-0.5 rounded-full font-medium"
                      style={{ color: `#${l.color}`, backgroundColor: `#${l.color}22` }}
                    >
                      {l.name}
                    </span>
                  ))}
                  {issue.assignees.length > 0 && (
                    <div className="flex items-center gap-1 ml-auto">
                      {issue.assignees.slice(0, 3).map((a) => (
                        <LinkedGitHubUser key={a.login} login={a.login} avatarUrl={a.avatar_url} githubToUser={githubToUser} size="sm" />
                      ))}
                    </div>
                  )}
                </div>
              </div>
              <span className="text-[11px] text-[#505050] whitespace-nowrap mt-0.5">
                {timeAgo(issue.updated_at)}
              </span>
            </a>
          ))}
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Pull Requests Tab
// ---------------------------------------------------------------------------

interface GHPR {
  number: number;
  title: string;
  html_url: string;
  state: string;
  draft: boolean;
  created_at: string;
  updated_at: string;
  merged_at: string | null;
  head: { ref: string };
  base: { ref: string };
  labels: { name: string; color: string }[];
  user: { login: string; avatar_url: string } | null;
  assignees: { login: string; avatar_url: string }[];
}

function PullsTab({ owner, repo, githubToUser }: { owner: string; repo: string; githubToUser: Map<string, UserModel> }) {
  const [state, setState] = useState<"open" | "closed">("open");
  const [pulls, setPulls] = useState<GHPR[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async (s: "open" | "closed") => {
    setLoading(true);
    try {
      const res = await fetch(`/api/github/pulls?owner=${encodeURIComponent(owner)}&repo=${encodeURIComponent(repo)}&state=${s}`);
      const data = await res.json();
      setPulls(data.pulls ?? []);
    } catch {
      setPulls([]);
    } finally {
      setLoading(false);
    }
  }, [owner, repo]);

  useEffect(() => { load(state); }, [load, state]);

  return (
    <div className="space-y-4">
      {/* Toolbar */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1 p-1 bg-[#1A1A1A] rounded-lg border border-[rgba(255,255,255,0.07)]">
          {(["open", "closed"] as const).map((s) => (
            <button
              key={s}
              onClick={() => { setState(s); load(s); }}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium transition-all capitalize ${state === s
                ? "bg-[rgba(247,148,29,0.15)] text-[#F7941D]"
                : "text-[#9A9A9A] hover:text-[#F0F0F0]"
                }`}
            >
              {s === "open" ? <GitPullRequest size={12} /> : <GitMerge size={12} />}
              {s}
            </button>
          ))}
        </div>
        <a
          href={`https://github.com/${owner}/${repo}/pulls`}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-1.5 text-xs text-[#9A9A9A] hover:text-[#F7941D] transition-colors"
        >
          <ExternalLink size={12} /> Open in GitHub
        </a>
      </div>

      {loading ? (
        <LoadingRows count={4} />
      ) : pulls.length === 0 ? (
        <EmptyState icon={GitPullRequest} message={`No ${state} pull requests`} />
      ) : (
        <div className="space-y-2">
          {pulls.map((pr) => (
            <a
              key={pr.number}
              href={pr.html_url}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-start gap-3 p-3.5 bg-[#1A1A1A] border border-[rgba(255,255,255,0.07)] rounded-xl hover:border-[rgba(247,148,29,0.3)] hover:bg-[rgba(247,148,29,0.04)] transition-all group"
            >
              <span className="text-xs text-[#606060] font-mono mt-0.5 min-w-[40px]">#{pr.number}</span>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <p className="text-sm text-[#E0E0E0] font-medium group-hover:text-[#F7941D] transition-colors leading-snug">
                    {pr.title}
                  </p>
                  {pr.draft && (
                    <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-[rgba(255,255,255,0.07)] text-[#9A9A9A] font-medium">
                      Draft
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                  {/* branch info */}
                  <span className="flex items-center gap-1 text-[11px] text-[#606060]">
                    <GitBranch size={10} />
                    <span className="text-[#808080]">{pr.head.ref}</span>
                    <span className="text-[#404040]">→</span>
                    <span className="text-[#606060]">{pr.base.ref}</span>
                  </span>
                  {pr.labels.map((l) => (
                    <span
                      key={l.name}
                      className="text-[10px] px-1.5 py-0.5 rounded-full font-medium"
                      style={{ color: `#${l.color}`, backgroundColor: `#${l.color}22` }}
                    >
                      {l.name}
                    </span>
                  ))}
                  {pr.user && (
                    <div className="ml-auto">
                      <LinkedGitHubUser login={pr.user.login} avatarUrl={pr.user.avatar_url} githubToUser={githubToUser} showName />
                    </div>
                  )}
                </div>
              </div>
              <span className="text-[11px] text-[#505050] whitespace-nowrap mt-0.5">
                {timeAgo(pr.updated_at)}
              </span>
            </a>
          ))}
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Commits Tab
// ---------------------------------------------------------------------------

interface GHCommit {
  sha: string;
  html_url: string;
  commit: {
    message: string;
    author: { name: string; date: string } | null;
  };
  author: { login: string; avatar_url: string } | null;
  linkedTasks: { id: string; title: string; state: string; columnName?: string | null }[];
}

interface Branch {
  name: string;
  protected: boolean;
}

function CommitsTab({ owner, repo, defaultBranch, githubToUser }: { owner: string; repo: string; defaultBranch: string; githubToUser: Map<string, UserModel> }) {
  const [branches, setBranches] = useState<Branch[]>([]);
  const [branch, setBranch] = useState(defaultBranch);
  const [commits, setCommits] = useState<GHCommit[]>([]);
  const [loading, setLoading] = useState(true);
  const [branchOpen, setBranchOpen] = useState(false);

  // Fetch branches once
  useEffect(() => {
    fetch(`/api/github/branches?owner=${encodeURIComponent(owner)}&repo=${encodeURIComponent(repo)}`)
      .then((r) => r.json())
      .then((d) => {
        setBranches(d.branches ?? []);
        const def = d.defaultBranch ?? defaultBranch;
        setBranch(def);
      })
      .catch(() => { });
  }, [owner, repo, defaultBranch]);

  const loadCommits = useCallback(async (b: string) => {
    setLoading(true);
    try {
      const res = await fetch(
        `/api/github/commits?owner=${encodeURIComponent(owner)}&repo=${encodeURIComponent(repo)}&branch=${encodeURIComponent(b)}&per_page=40`
      );
      const data = await res.json();
      setCommits(data.commits ?? []);
    } catch {
      setCommits([]);
    } finally {
      setLoading(false);
    }
  }, [owner, repo]);

  useEffect(() => {
    if (branch) loadCommits(branch);
  }, [branch, loadCommits]);

  return (
    <div className="space-y-4">
      {/* Branch selector */}
      <div className="flex items-center justify-between">
        <div className="relative">
          <button
            onClick={() => setBranchOpen((o) => !o)}
            className="flex items-center gap-2 px-3 py-2 bg-[#1A1A1A] border border-[rgba(255,255,255,0.1)] rounded-lg text-sm text-[#E0E0E0] hover:border-[rgba(247,148,29,0.4)] transition-all"
          >
            <GitBranch size={13} className="text-[#F7941D]" />
            <span className="font-medium">{branch}</span>
            <ChevronDown size={13} className={`text-[#606060] transition-transform ${branchOpen ? "rotate-180" : ""}`} />
          </button>
          <AnimatePresence>
            {branchOpen && branches.length > 0 && (
              <motion.div
                initial={{ opacity: 0, y: -4 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -4 }}
                className="absolute top-full left-0 mt-1 z-50 min-w-[200px] max-h-64 overflow-y-auto bg-[#1E1E1E] border border-[rgba(255,255,255,0.1)] rounded-xl shadow-2xl"
              >
                {branches.map((b) => (
                  <button
                    key={b.name}
                    onClick={() => { setBranch(b.name); setBranchOpen(false); }}
                    className={`w-full flex items-center gap-2 px-3 py-2 text-sm text-left hover:bg-[rgba(247,148,29,0.08)] transition-colors ${b.name === branch ? "text-[#F7941D]" : "text-[#C0C0C0]"
                      }`}
                  >
                    <GitBranch size={11} className="shrink-0 opacity-60" />
                    <span className="truncate">{b.name}</span>
                    {b.protected && <Shield size={10} className="shrink-0 text-[#606060] ml-auto" />}
                    {b.name === branch && <span className="text-[10px] text-[#F7941D] ml-auto">current</span>}
                  </button>
                ))}
              </motion.div>
            )}
          </AnimatePresence>
        </div>
        <a
          href={`https://github.com/${owner}/${repo}/commits/${branch}`}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-1.5 text-xs text-[#9A9A9A] hover:text-[#F7941D] transition-colors"
        >
          <ExternalLink size={12} /> Open in GitHub
        </a>
      </div>

      {loading ? (
        <LoadingRows count={8} />
      ) : commits.length === 0 ? (
        <EmptyState icon={GitCommit} message="No commits found" />
      ) : (
        <div className="space-y-1.5">
          {commits.map((c) => {
            const [headline, ...rest] = c.commit.message.split("\n");
            const hasBody = rest.some((l) => l.trim());
            const short = c.sha.slice(0, 7);
            const date = c.commit.author?.date;

            return (
              <a
                key={c.sha}
                href={c.html_url}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-start gap-3 p-3.5 bg-[#1A1A1A] border border-[rgba(255,255,255,0.07)] rounded-xl hover:border-[rgba(247,148,29,0.3)] hover:bg-[rgba(247,148,29,0.04)] transition-all group"
              >
                {/* Avatar */}
                {c.author ? (
                  <LinkedGitHubUser
                    login={c.author.login}
                    avatarUrl={c.author.avatar_url}
                    githubToUser={githubToUser}
                    size="md"
                    className="shrink-0 mt-0.5"
                  />
                ) : (
                  <div className="w-7 h-7 rounded-full bg-[#2A2A2A] flex items-center justify-center shrink-0 mt-0.5">
                    <User size={13} className="text-[#606060]" />
                  </div>
                )}

                <div className="flex-1 min-w-0">
                  <p className="text-sm text-[#E0E0E0] font-medium group-hover:text-[#F7941D] transition-colors leading-snug truncate">
                    {headline}
                  </p>
                  {c.linkedTasks.length > 0 && (
                    <div className="mt-2 flex flex-wrap gap-1.5">
                      {c.linkedTasks.map((task) => {
                        const taskStateMeta = KANBAN_TASK_STATE_META[
                          task.state && isKanbanTaskState(task.state) ? task.state : "normal"
                        ];

                        return (
                          <span
                            key={`${c.sha}-${task.id}`}
                            className="inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-medium"
                            style={{
                              color: taskStateMeta.color,
                              backgroundColor: taskStateMeta.background,
                              borderColor: taskStateMeta.border,
                            }}
                            title={`${task.title}${task.columnName ? ` · ${task.columnName}` : ""}`}
                          >
                            <GitCommit size={10} />
                            {task.title}
                          </span>
                        );
                      })}
                    </div>
                  )}
                  <div className="flex items-center gap-2 mt-1">
                    {c.author ? (
                      <LinkedGitHubUser
                        login={c.author.login}
                        avatarUrl={c.author.avatar_url}
                        githubToUser={githubToUser}
                        showName
                        avatarless
                      />
                    ) : (
                      <span className="text-[11px] text-[#606060]">
                        {c.commit.author?.name ?? "unknown"}
                      </span>
                    )}
                    {hasBody && (
                      <span className="text-[10px] text-[#404040]">+ description</span>
                    )}
                  </div>
                </div>

                <div className="flex flex-col items-end gap-1 shrink-0">
                  <code className="text-[11px] text-[#F7941D] font-mono bg-[rgba(247,148,29,0.1)] px-1.5 py-0.5 rounded">
                    {short}
                  </code>
                  {date && (
                    <span className="text-[11px] text-[#505050]">{timeAgo(date)}</span>
                  )}
                </div>
              </a>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// README Tab
// ---------------------------------------------------------------------------

function ReadmeTab({ owner, repo }: { owner: string; repo: string }) {
  const [html, setHtml] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    fetch(`/api/github/readme?owner=${encodeURIComponent(owner)}&repo=${encodeURIComponent(repo)}`)
      .then((r) => r.json())
      .then((d) => {
        if (d.html) {
          setHtml(d.html);
        } else {
          setNotFound(true);
        }
      })
      .catch(() => setNotFound(true))
      .finally(() => setLoading(false));
  }, [owner, repo]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20 gap-2 text-[#606060]">
        <RefreshCw size={16} className="animate-spin" />
        <span className="text-sm">Loading README…</span>
      </div>
    );
  }

  if (notFound || !html) {
    return (
      <EmptyState icon={FileText} message="No README found in this repository" />
    );
  }

  return (
    <div className="bg-[#1A1A1A] border border-[rgba(255,255,255,0.07)] rounded-xl overflow-hidden">
      {/* Header bar */}
      <div className="flex items-center gap-2 px-4 py-3 border-b border-[rgba(255,255,255,0.06)]">
        <FileText size={14} className="text-[#F7941D]" />
        <span className="text-sm font-medium text-[#9A9A9A]">README</span>
        <a
          href={`https://github.com/${owner}/${repo}#readme`}
          target="_blank"
          rel="noopener noreferrer"
          className="ml-auto flex items-center gap-1 text-xs text-[#606060] hover:text-[#F7941D] transition-colors"
        >
          <ExternalLink size={11} /> View on GitHub
        </a>
      </div>

      {/* Rendered markdown */}
      {/* Content from authenticated GitHub API for our own repos — trusted source */}
      <div
        className="readme-content p-6 md:p-8"
        // eslint-disable-next-line react/no-danger
        dangerouslySetInnerHTML={{ __html: html }}
      />

      <style>{`
        .readme-content {
          color: #C9D1D9;
          font-size: 14px;
          line-height: 1.75;
          word-break: break-word;
        }
        .readme-content h1, .readme-content h2, .readme-content h3,
        .readme-content h4, .readme-content h5, .readme-content h6 {
          color: #F0F0F0;
          font-weight: 700;
          margin: 1.5em 0 0.5em;
          line-height: 1.3;
        }
        .readme-content h1 { font-size: 1.75em; border-bottom: 1px solid rgba(255,255,255,0.1); padding-bottom: 0.3em; }
        .readme-content h2 { font-size: 1.35em; border-bottom: 1px solid rgba(255,255,255,0.06); padding-bottom: 0.2em; }
        .readme-content h3 { font-size: 1.1em; }
        .readme-content p { margin: 0.75em 0; }
        .readme-content a { color: #F7941D; text-decoration: none; }
        .readme-content a:hover { text-decoration: underline; color: #FBBA00; }
        .readme-content code {
          background: rgba(255,255,255,0.08);
          color: #E06C75;
          padding: 0.1em 0.4em;
          border-radius: 4px;
          font-size: 0.875em;
          font-family: ui-monospace, monospace;
        }
        .readme-content pre {
          background: #111111;
          border: 1px solid rgba(255,255,255,0.08);
          border-radius: 8px;
          padding: 1em;
          overflow-x: auto;
          margin: 1em 0;
        }
        .readme-content pre code {
          background: none;
          color: #ABB2BF;
          padding: 0;
          font-size: 0.85em;
        }
        .readme-content ul, .readme-content ol {
          padding-left: 1.5em;
          margin: 0.5em 0;
        }
        .readme-content li { margin: 0.25em 0; }
        .readme-content blockquote {
          border-left: 3px solid rgba(247,148,29,0.5);
          padding-left: 1em;
          color: #8B8B8B;
          margin: 1em 0;
        }
        .readme-content table {
          border-collapse: collapse;
          width: 100%;
          margin: 1em 0;
          font-size: 0.875em;
        }
        .readme-content th, .readme-content td {
          border: 1px solid rgba(255,255,255,0.1);
          padding: 0.5em 0.75em;
          text-align: left;
        }
        .readme-content th {
          background: rgba(255,255,255,0.05);
          color: #F0F0F0;
          font-weight: 600;
        }
        .readme-content img { max-width: 100%; border-radius: 6px; }
        .readme-content hr { border: none; border-top: 1px solid rgba(255,255,255,0.08); margin: 1.5em 0; }
      `}</style>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Info Tab
// ---------------------------------------------------------------------------

function RepoInfo({ repo, defaultBranch }: { repo: Repo; defaultBranch: string | null }) {
  const rows = [
    { label: "Full Name", value: repo.fullName },
    { label: "Language", value: repo.language ?? "Not specified" },
    { label: "Visibility", value: repo.isPrivate ? "Private" : "Public" },
    { label: "Default Branch", value: defaultBranch ?? "—" },
    { label: "Stars", value: String(repo.starCount) },
    { label: "Open Issues", value: String(repo.openIssues) },
    { label: "Last GitHub Push", value: repo.pushedAt ? timeAgo(repo.pushedAt) : "Never synced" },
    { label: "Last Workspace Sync", value: timeAgo(repo.updatedAt) },
    { label: "GitHub URL", value: repo.url, link: true },
  ];

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 max-w-2xl">
      {rows.map(({ label, value, link }) => (
        <div key={label} className="bg-[#1A1A1A] border border-[rgba(255,255,255,0.07)] rounded-xl p-4">
          <div className="text-xs text-[#606060] uppercase tracking-wider mb-1">{label}</div>
          {link ? (
            <a
              href={value}
              target="_blank"
              rel="noopener noreferrer"
              className="text-sm text-[#F7941D] hover:text-[#FBBA00] flex items-center gap-1 transition-colors"
            >
              {value} <ExternalLink size={11} />
            </a>
          ) : (
            <div className="text-sm text-[#F0F0F0] font-medium">{value}</div>
          )}
        </div>
      ))}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Shared helpers
// ---------------------------------------------------------------------------

/**
 * Renders a GitHub user, preferring the linked hub Team user when available.
 *
 * - If the github login is linked to a team user: shows their hub avatar + hub display name.
 *   A subtle ring on the avatar signals the linked identity.
 * - If unlinked: shows the GitHub avatar + github login, unstyled.
 *
 * Props:
 *   login       — GitHub login (used as the lookup key)
 *   avatarUrl   — GitHub avatar (fallback when no hub image)
 *   githubToUser — Map built from team users with connected accounts
 *   size         — "sm" (16px) | "md" (28px, default for commits)
 *   showName     — also render the display name next to the avatar
 *   avatarless   — skip the avatar (name-only mode, used in commit subline)
 *   className    — forwarded to the outermost element
 */
function LinkedGitHubUser({
  login,
  avatarUrl,
  githubToUser,
  size = "sm",
  showName = false,
  avatarless = false,
  className = "",
}: {
  login: string;
  avatarUrl: string;
  githubToUser: Map<string, UserModel>;
  size?: "sm" | "md";
  showName?: boolean;
  avatarless?: boolean;
  className?: string;
}) {
  const teamUser = githubToUser.get(login.toLowerCase());
  const px = size === "md" ? "w-7 h-7" : "w-4 h-4";

  if (teamUser) {
    const displayName = teamUser.displayName ?? teamUser.name ?? login;
    const initials = displayName
      .split(" ")
      .filter(Boolean)
      .map((w) => w[0].toUpperCase())
      .slice(0, 2)
      .join("");
    return (
      <div className={`flex items-center gap-1.5 ${className}`}>
        {!avatarless && (
          teamUser.image ? (
            <img
              src={teamUser.image}
              alt={displayName}
              title={displayName}
              className={`${px} rounded-full ring-1 ring-[rgba(247,148,29,0.5)]`}
            />
          ) : (
            <div
              title={displayName}
              className={`${px} rounded-full ring-1 ring-[rgba(247,148,29,0.5)] bg-gradient-to-br from-[#F7941D] to-[#7B1C24] flex items-center justify-center flex-shrink-0`}
            >
              <span className="text-white font-bold leading-none"
                style={{ fontSize: size === "md" ? "9px" : "6px" }}>
                {initials}
              </span>
            </div>
          )
        )}
        {showName && (
          <span className="text-[11px] text-[#C0C0C0]">{displayName}</span>
        )}
      </div>
    );
  }

  return (
    <div className={`flex items-center gap-1.5 ${className}`}>
      {!avatarless && (
        <img
          src={avatarUrl}
          alt={login}
          title={login}
          className={`${px} rounded-full`}
        />
      )}
      {showName && (
        <span className="text-[11px] text-[#606060]">{login}</span>
      )}
    </div>
  );
}

function LoadingRows({ count }: { count: number }) {
  return (
    <div className="space-y-2">
      {Array.from({ length: count }).map((_, i) => (
        <div
          key={i}
          className="h-[60px] bg-[#1A1A1A] border border-[rgba(255,255,255,0.06)] rounded-xl animate-pulse"
          style={{ opacity: 1 - i * 0.12 }}
        />
      ))}
    </div>
  );
}

function EmptyState({ icon: Icon, message }: { icon: React.ElementType; message: string }) {
  return (
    <div className="text-center py-16">
      <Icon size={36} className="text-[#2A2A2A] mx-auto mb-3" />
      <p className="text-[#505050] text-sm">{message}</p>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Deployments Tab
// ---------------------------------------------------------------------------

const AWS_SERVICE_META: Record<string, { icon: React.ElementType; color: string; bg: string; label: string }> = {
  ec2: { icon: Server, color: "text-[#60A5FA]", bg: "bg-[rgba(96,165,250,0.1)]", label: "EC2 Instance" },
  amplify: { icon: Zap, color: "text-[#FF9900]", bg: "bg-[rgba(255,153,0,0.1)]", label: "Amplify App" },
  ecs: { icon: Layers, color: "text-[#38BDF8]", bg: "bg-[rgba(56,189,248,0.1)]", label: "ECS Cluster" },
  ecs_instance: { icon: Server, color: "text-[#7DD3FC]", bg: "bg-[rgba(125,211,252,0.1)]", label: "ECS Instance" },
  cloudwatch: { icon: Eye, color: "text-[#A78BFA]", bg: "bg-[rgba(167,139,250,0.1)]", label: "CloudWatch" },
  route53: { icon: Globe, color: "text-[#34D399]", bg: "bg-[rgba(52,211,153,0.1)]", label: "Route 53" },
  s3: { icon: Box, color: "text-[#4ADE80]", bg: "bg-[rgba(74,222,128,0.1)]", label: "S3 Bucket" },
  rds: { icon: Database, color: "text-[#818CF8]", bg: "bg-[rgba(129,140,248,0.1)]", label: "RDS Database" },
  lambda: { icon: Zap, color: "text-[#FBBF24]", bg: "bg-[rgba(251,191,36,0.1)]", label: "Lambda Function" },
  other: { icon: Cloud, color: "text-[#9CA3AF]", bg: "bg-[rgba(156,163,175,0.1)]", label: "Other" },
};

// ---------------------------------------------------------------------------
// Amplify app status shape returned by /api/aws/amplify/status
// ---------------------------------------------------------------------------
interface AmplifyAppStatus {
  arn: string;
  appId: string | null;
  region: string;
  name: string | null;
  description: string | null;
  defaultDomain: string | null;
  customDomain: string | null;
  repository: string | null;
  platform: string | null;
  createTime: string | null;
  updateTime: string | null;
  productionBranch: {
    branchName: string | null;
    status: string | null;
    lastDeployTime: string | null;
    lastJobId: string | null;
  };
  framework: string | null;
  totalJobs: string | null;
  enableAutoBuild: boolean | null;
  error?: string;
}

interface AmplifyLogStep {
  name: string;
  status?: string;
  log: string;
}

function amplifyStatusMeta(status: string | null | undefined): {
  label: string;
  color: string;
  bg: string;
  dot: string;
  spinning: boolean;
} {
  switch (status?.toUpperCase()) {
    case "SUCCEED":
      return { label: "Deployed", color: "text-[#22C55E]", bg: "bg-[rgba(34,197,94,0.1)]", dot: "bg-[#22C55E]", spinning: false };
    case "FAILED":
      return { label: "Failed", color: "text-[#EF4444]", bg: "bg-[rgba(239,68,68,0.1)]", dot: "bg-[#EF4444]", spinning: false };
    case "DEPLOYING":
    case "PROVISIONING":
    case "RUNNING":
      return { label: "Deploying", color: "text-[#FBBF24]", bg: "bg-[rgba(251,191,36,0.1)]", dot: "bg-[#FBBF24]", spinning: true };
    case "CREATED":
      return { label: "Queued", color: "text-[#60A5FA]", bg: "bg-[rgba(96,165,250,0.1)]", dot: "bg-[#60A5FA]", spinning: false };
    default:
      return { label: "Unknown", color: "text-[#606060]", bg: "bg-[rgba(255,255,255,0.05)]", dot: "bg-[#505050]", spinning: false };
  }
}

function AmplifyCard({
  link,
  status,
  loading,
  onDelete,
  deleting,
  accountRegion,
  onViewLogs,
  onViewHistory,
}: {
  link: AwsLink;
  status: AmplifyAppStatus | null;
  loading: boolean;
  onDelete: (id: string) => void;
  deleting: boolean;
  accountRegion: string;
  onViewLogs: () => void;
  onViewHistory: () => void;
}) {
  const region = link.region ?? accountRegion;
  const appId = status?.appId ?? link.resourceId.split("/").pop() ?? "";
  const consoleUrl = `https://${region}.console.aws.amazon.com/amplify/apps/${appId}`;

  // Prefer custom domain (real DNS URL), fall back to built-in Amplify subdomain
  const liveUrl = status?.customDomain
    ?? (status?.productionBranch?.branchName && status?.defaultDomain
      ? `https://${status.productionBranch.branchName}.${status.defaultDomain}`
      : null);

  const sm = amplifyStatusMeta(status?.productionBranch?.status);

  const hasLogs = !!status?.productionBranch?.lastJobId;

  return (
    <div className="group relative bg-[#0E0E0E] border border-[rgba(255,255,255,0.07)] rounded-2xl overflow-hidden hover:border-[rgba(255,153,0,0.2)] transition-all">
      {/* Top accent line */}
      <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-[rgba(255,153,0,0.3)] to-transparent" />

      <div className="p-5">
        {/* Header row */}
        <div className="flex items-start justify-between gap-3 mb-4">
          <div className="flex items-start gap-3 min-w-0">
            <div className="w-10 h-10 rounded-xl bg-[rgba(255,153,0,0.08)] border border-[rgba(255,153,0,0.15)] flex items-center justify-center flex-shrink-0">
              <AmplifyLogo />
            </div>
            <div className="min-w-0">
              <div className="font-bold text-[#F0F0F0] text-base leading-tight truncate">
                {loading ? (
                  <span className="inline-block w-32 h-4 rounded bg-[rgba(255,255,255,0.06)] animate-pulse" />
                ) : (
                  status?.name ?? link.label
                )}
              </div>
              {!loading && liveUrl && (
                <p className="text-[11px] text-[#505050] mt-0.5 truncate">{liveUrl.replace("https://", "")}</p>
              )}
            </div>
          </div>

          {/* Status badge */}
          <div className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full flex-shrink-0 ${sm.bg}`}>
            {sm.spinning ? (
              <span className={`inline-block w-2 h-2 rounded-full border border-current border-t-transparent animate-spin ${sm.color}`} />
            ) : (
              <span className={`w-2 h-2 rounded-full ${sm.dot}`} />
            )}
            <span className={`text-xs font-semibold ${sm.color}`}>{loading ? "—" : sm.label}</span>
          </div>
        </div>

        {/* Stats grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-2 mb-4">
          <div className="bg-[rgba(255,255,255,0.03)] border border-[rgba(255,255,255,0.05)] rounded-xl px-3 py-2.5">
            <div className="text-[10px] text-[#505050] font-medium uppercase tracking-wide mb-1">Prod Branch</div>
            <div className="flex items-center gap-1.5">
              <GitBranch size={11} className="text-[#FF9900]" />
              {loading ? (
                <span className="inline-block w-20 h-3 rounded bg-[rgba(255,255,255,0.06)] animate-pulse" />
              ) : (
                <span className="text-sm font-semibold text-[#E0E0E0]">{status?.productionBranch?.branchName ?? "—"}</span>
              )}
            </div>
          </div>

          <div className="bg-[rgba(255,255,255,0.03)] border border-[rgba(255,255,255,0.05)] rounded-xl px-3 py-2.5">
            <div className="text-[10px] text-[#505050] font-medium uppercase tracking-wide mb-1">Last Deploy</div>
            <div className="flex items-center gap-1.5">
              <Clock size={11} className="text-[#606060]" />
              {loading ? (
                <span className="inline-block w-20 h-3 rounded bg-[rgba(255,255,255,0.06)] animate-pulse" />
              ) : (
                <span className="text-sm text-[#909090]">
                  {status?.productionBranch?.lastDeployTime
                    ? timeAgo(status.productionBranch.lastDeployTime)
                    : status?.updateTime
                      ? timeAgo(status.updateTime)
                      : "—"}
                </span>
              )}
            </div>
          </div>

          <div className="bg-[rgba(255,255,255,0.03)] border border-[rgba(255,255,255,0.05)] rounded-xl px-3 py-2.5">
            <div className="text-[10px] text-[#505050] font-medium uppercase tracking-wide mb-1">Region</div>
            <div className="flex items-center gap-1.5">
              <Globe size={11} className="text-[#606060]" />
              <span className="text-sm text-[#909090]">{region}</span>
            </div>
          </div>

          <div className="bg-[rgba(255,255,255,0.03)] border border-[rgba(255,255,255,0.05)] rounded-xl px-3 py-2.5">
            <div className="text-[10px] text-[#505050] font-medium uppercase tracking-wide mb-1">Framework</div>
            <div className="flex items-center gap-1.5">
              <Box size={11} className="text-[#606060]" />
              {loading ? (
                <span className="inline-block w-16 h-3 rounded bg-[rgba(255,255,255,0.06)] animate-pulse" />
              ) : (
                <span className="text-sm text-[#909090]">{status?.framework || status?.platform || "—"}</span>
              )}
            </div>
          </div>
        </div>

        {/* Footer: links + actions */}
        <div className="flex flex-wrap items-center gap-2 pt-3 border-t border-[rgba(255,255,255,0.05)]">
          {liveUrl && (
            <a
              href={liveUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-lg bg-[rgba(255,255,255,0.04)] border border-[rgba(255,255,255,0.07)] text-[#909090] hover:text-[#F0F0F0] hover:border-[rgba(255,255,255,0.15)] transition-all"
            >
              <Globe size={11} />
              Live App
            </a>
          )}
          {hasLogs && (
            <button
              onClick={onViewLogs}
              className="flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-lg border transition-all bg-[rgba(255,255,255,0.04)] border-[rgba(255,255,255,0.07)] text-[#909090] hover:text-[#60A5FA] hover:border-[rgba(96,165,250,0.2)] hover:bg-[rgba(96,165,250,0.06)]"
            >
              <FileText size={11} />
              Logs
            </button>
          )}
          <button
            onClick={onViewHistory}
            className="flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-lg border transition-all bg-[rgba(255,255,255,0.04)] border-[rgba(255,255,255,0.07)] text-[#909090] hover:text-[#A78BFA] hover:border-[rgba(167,139,250,0.2)] hover:bg-[rgba(167,139,250,0.06)]"
          >
            <History size={11} />
            History
          </button>

        </div>
      </div>
    </div>
  );
}

function AmplifyLogo() {
  return (
    <svg viewBox="0 0 24 24" className="w-5 h-5" fill="none">
      <path d="M12 2L2 19.5h20L12 2z" fill="rgba(255,153,0,0.9)" />
      <path d="M12 2L7 19.5h10L12 2z" fill="rgba(255,200,80,0.7)" />
    </svg>
  );
}

// ---------------------------------------------------------------------------
// Amplify History Side Drawer
// ---------------------------------------------------------------------------

interface AmplifyJobSummary {
  jobId: string | null;
  jobType: string | null;
  commitId: string | null;
  commitMessage: string | null;
  commitTime: string | null;
  startTime: string | null;
  endTime: string | null;
  status: string | null;
}

function jobDuration(startTime: string | null, endTime: string | null): string {
  if (!startTime) return "—";
  const start = new Date(startTime).getTime();
  const end = endTime ? new Date(endTime).getTime() : Date.now();
  const secs = Math.floor((end - start) / 1000);
  if (secs < 60) return `${secs}s`;
  const mins = Math.floor(secs / 60);
  const rem = secs % 60;
  return rem > 0 ? `${mins}m ${rem}s` : `${mins}m`;
}

function AmplifyHistoryDrawer({
  open,
  onClose,
  appName,
  branchName,
  appId,
  region,
}: {
  open: boolean;
  onClose: () => void;
  appName: string;
  branchName: string;
  appId: string;
  region: string;
}) {
  const [jobs, setJobs] = useState<AmplifyJobSummary[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const latestJobs = useRef<AmplifyJobSummary[]>([]);
  latestJobs.current = jobs;

  // Fetch jobs whenever the drawer opens
  useEffect(() => {
    if (!open || !appId || !branchName) return;
    let cancelled = false;

    async function fetchJobs() {
      setLoading(true);
      setError(null);
      try {
        const res = await fetch("/api/aws/amplify/jobs", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ appId, branchName, region, maxResults: 25 }),
        });
        const data = await res.json();
        if (cancelled) return;
        if (!res.ok) {
          setError(data?.error ?? `HTTP ${res.status}`);
        } else {
          setJobs(data.jobs ?? []);
        }
      } catch (e) {
        if (!cancelled) setError((e as Error).message);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    fetchJobs();

    // Poll every 10s while any job is in-progress
    const interval = setInterval(async () => {
      const hasLive = latestJobs.current.some((j) =>
        ["RUNNING", "PROVISIONING", "DEPLOYING", "CREATED"].includes(j.status ?? "")
      );
      if (!hasLive) return;
      try {
        const res = await fetch("/api/aws/amplify/jobs", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ appId, branchName, region, maxResults: 25 }),
        });
        const data = await res.json();
        if (!cancelled && res.ok) setJobs(data.jobs ?? []);
      } catch {
        // silent
      }
    }, 10000);

    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, appId, branchName, region]);

  const statusMeta = (status: string | null) => amplifyStatusMeta(status);

  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div
            key="history-backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            onClick={onClose}
            className="fixed inset-0 z-40 bg-black/50 backdrop-blur-sm"
          />
          <motion.div
            key="history-panel"
            initial={{ x: "100%" }}
            animate={{ x: 0 }}
            exit={{ x: "100%" }}
            transition={{ type: "spring", stiffness: 300, damping: 30 }}
            className="fixed top-0 right-0 h-full z-50 w-full max-w-xl flex flex-col bg-[#0A0A0A] border-l border-[rgba(255,255,255,0.08)] shadow-2xl"
          >
            {/* Header */}
            <div className="flex items-center justify-between gap-4 px-5 py-4 border-b border-[rgba(255,255,255,0.07)]">
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-8 h-8 rounded-lg bg-[rgba(167,139,250,0.08)] border border-[rgba(167,139,250,0.15)] flex items-center justify-center flex-shrink-0">
                  <History size={14} className="text-[#A78BFA]" />
                </div>
                <div className="min-w-0">
                  <div className="font-semibold text-[#F0F0F0] text-sm truncate">{appName}</div>
                  <div className="flex items-center gap-1 text-[11px] text-[#505050]">
                    <GitBranch size={10} className="text-[#FF9900]" />
                    <span>{branchName}</span>
                    <span className="ml-1 text-[#404040]">· Deployment History</span>
                  </div>
                </div>
              </div>
              <button
                onClick={onClose}
                className="flex-shrink-0 w-8 h-8 flex items-center justify-center rounded-lg text-[#505050] hover:text-[#F0F0F0] hover:bg-[rgba(255,255,255,0.06)] transition-all"
              >
                <X size={16} />
              </button>
            </div>

            {/* Job list */}
            <div className="flex-1 overflow-y-auto min-h-0">
              {loading ? (
                <div className="flex flex-col items-center justify-center py-20 gap-3 text-xs text-[#505050]">
                  <span className="inline-block w-5 h-5 border border-[#505050] border-t-[#A78BFA] rounded-full animate-spin" />
                  Loading deployment history…
                </div>
              ) : error ? (
                <div className="flex flex-col items-center justify-center py-20 gap-3 px-6 text-center">
                  <AlertCircle size={20} className="text-[#EF4444]" />
                  <p className="text-xs font-semibold text-[#EF4444]">Failed to load history</p>
                  <p className="text-[11px] text-[#606060] font-mono break-all">{error}</p>
                </div>
              ) : jobs.length === 0 ? (
                <div className="flex items-center justify-center py-20 text-xs text-[#404040]">
                  No deployments found
                </div>
              ) : (
                <div className="divide-y divide-[rgba(255,255,255,0.04)]">
                  {jobs.map((job, i) => {
                    const sm = statusMeta(job.status);
                    const isLive = ["RUNNING", "PROVISIONING", "DEPLOYING", "CREATED"].includes(job.status ?? "");
                    return (
                      <div key={job.jobId ?? i} className={`px-5 py-4 flex items-start gap-4 ${i === 0 ? "bg-[rgba(255,255,255,0.02)]" : ""}`}>
                        {/* Status indicator */}
                        <div className="flex-shrink-0 mt-0.5">
                          {sm.spinning ? (
                            <span className={`inline-block w-3 h-3 rounded-full border border-current border-t-transparent animate-spin ${sm.color}`} />
                          ) : (
                            <span className={`inline-block w-3 h-3 rounded-full ${sm.dot}`} />
                          )}
                        </div>

                        {/* Main content */}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between gap-2">
                            <div className="flex items-center gap-2">
                              <span className={`text-xs font-semibold ${sm.color}`}>{sm.label}</span>
                              {i === 0 && (
                                <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-[rgba(255,255,255,0.06)] text-[#606060] font-medium">Latest</span>
                              )}
                              {isLive && (
                                <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-[rgba(251,191,36,0.12)] text-[#FBBF24] font-semibold animate-pulse">Live</span>
                              )}
                            </div>
                            <span className="text-[11px] text-[#404040] flex-shrink-0">
                              {job.startTime ? timeAgo(job.startTime) : "—"}
                            </span>
                          </div>

                          {job.commitMessage && (
                            <p className="text-xs text-[#C0C0C0] mt-1 truncate">{job.commitMessage}</p>
                          )}

                          <div className="flex items-center gap-3 mt-1.5">
                            {job.commitId && (
                              <span className="flex items-center gap-1 text-[10px] text-[#505050] font-mono">
                                <GitCommit size={9} />
                                {job.commitId.slice(0, 7)}
                              </span>
                            )}
                            <span className="flex items-center gap-1 text-[10px] text-[#505050]">
                              <Clock size={9} />
                              {jobDuration(job.startTime, job.endTime)}
                            </span>
                            {job.jobId && (
                              <span className="text-[10px] text-[#404040]">#{job.jobId}</span>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}

// ---------------------------------------------------------------------------
// Amplify Logs Side Drawer
// ---------------------------------------------------------------------------

interface AmplifyLogsDrawerProps {
  open: boolean;
  onClose: () => void;
  appName: string;
  branchName: string;
  loading: boolean;
  data: { jobId: string; commitMessage: string | null; startTime: string | null; endTime: string | null; steps: AmplifyLogStep[] } | null;
  activeStep: string | null;
  onStepChange: (step: string) => void;
  error: string | null;
}

function AmplifyLogsDrawer({ open, onClose, appName, branchName, loading, data, activeStep, onStepChange, error }: AmplifyLogsDrawerProps) {
  const currentStep = data?.steps?.find((s) => s.name === activeStep) ?? null;

  return (
    <AnimatePresence>
      {open && (
        <>
          {/* Backdrop */}
          <motion.div
            key="drawer-backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            onClick={onClose}
            className="fixed inset-0 z-40 bg-black/50 backdrop-blur-sm"
          />

          {/* Drawer panel */}
          <motion.div
            key="drawer-panel"
            initial={{ x: "100%" }}
            animate={{ x: 0 }}
            exit={{ x: "100%" }}
            transition={{ type: "spring", stiffness: 300, damping: 30 }}
            className="fixed top-0 right-0 h-full z-50 w-full max-w-2xl flex flex-col bg-[#0A0A0A] border-l border-[rgba(255,255,255,0.08)] shadow-2xl"
          >
            {/* Header */}
            <div className="flex items-center justify-between gap-4 px-5 py-4 border-b border-[rgba(255,255,255,0.07)]">
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-8 h-8 rounded-lg bg-[rgba(255,153,0,0.08)] border border-[rgba(255,153,0,0.15)] flex items-center justify-center flex-shrink-0">
                  <AmplifyLogo />
                </div>
                <div className="min-w-0">
                  <div className="font-semibold text-[#F0F0F0] text-sm truncate">{appName}</div>
                  <div className="flex items-center gap-1 text-[11px] text-[#505050]">
                    <GitBranch size={10} className="text-[#FF9900]" />
                    <span>{branchName}</span>
                    {data?.startTime && (
                      <span className="ml-2 text-[#404040]">{timeAgo(data.startTime)}</span>
                    )}
                  </div>
                </div>
              </div>
              <button
                onClick={onClose}
                className="flex-shrink-0 w-8 h-8 flex items-center justify-center rounded-lg text-[#505050] hover:text-[#F0F0F0] hover:bg-[rgba(255,255,255,0.06)] transition-all"
              >
                <X size={16} />
              </button>
            </div>

            {/* Commit message */}
            {data?.commitMessage && (
              <div className="px-5 py-2.5 border-b border-[rgba(255,255,255,0.05)] bg-[rgba(255,255,255,0.02)]">
                <p className="text-[11px] text-[#505050] font-mono truncate">{data.commitMessage}</p>
              </div>
            )}

            {/* Step tabs */}
            {!loading && data && data.steps?.length > 0 && (
              <div className="flex items-center gap-px overflow-x-auto border-b border-[rgba(255,255,255,0.06)] px-5 pt-3 flex-shrink-0">
                {(data.steps ?? []).map((step) => {
                  const stepSm = amplifyStatusMeta(step.status);
                  return (
                    <button
                      key={step.name}
                      onClick={() => onStepChange(step.name)}
                      className={`flex items-center gap-1.5 px-3 py-1.5 rounded-t-lg text-[11px] font-medium whitespace-nowrap transition-all ${activeStep === step.name
                        ? "bg-[rgba(255,255,255,0.06)] text-[#E0E0E0] border border-b-0 border-[rgba(255,255,255,0.08)]"
                        : "text-[#606060] hover:text-[#909090]"
                        }`}
                    >
                      <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${stepSm.dot}`} />
                      {step.name}
                    </button>
                  );
                })}
              </div>
            )}

            {/* Log content */}
            <div className="flex-1 overflow-y-auto overflow-x-auto min-h-0">
              {loading ? (
                <div className="flex flex-col items-center justify-center py-20 gap-3 text-xs text-[#505050]">
                  <span className="inline-block w-5 h-5 border border-[#505050] border-t-[#FF9900] rounded-full animate-spin" />
                  Loading deployment logs…
                </div>
              ) : error ? (
                <div className="flex flex-col items-center justify-center py-20 gap-3 px-6 text-center">
                  <AlertCircle size={20} className="text-[#EF4444]" />
                  <p className="text-xs font-semibold text-[#EF4444]">Failed to load logs</p>
                  <p className="text-[11px] text-[#606060] font-mono break-all">{error}</p>
                </div>
              ) : !data ? (
                <div className="flex items-center justify-center py-20 text-xs text-[#404040]">
                  No log data available
                </div>
              ) : currentStep ? (
                <pre className="p-5 text-[11px] font-mono text-[#6A9A6A] leading-relaxed whitespace-pre-wrap break-words">
                  {currentStep.log}
                </pre>
              ) : null}
            </div>

            {/* Footer timing */}
            {data?.startTime && (
              <div className="px-5 py-3 border-t border-[rgba(255,255,255,0.06)] flex items-center gap-4 text-[11px] text-[#404040]">
                <span>Started: {new Date(data.startTime).toLocaleString()}</span>
                {data.endTime && <span>Ended: {new Date(data.endTime).toLocaleString()}</span>}
              </div>
            )}
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}

// ---------------------------------------------------------------------------
// EC2 Instance card
// ---------------------------------------------------------------------------

interface Ec2InstanceStatus {
  resourceId: string;
  region: string;
  instanceId: string | null;
  instanceType: string | null;
  state: string | null;
  publicIp: string | null;
  privateIp: string | null;
  availabilityZone: string | null;
  launchTime: string | null;
  error?: string;
}

function ec2StateMeta(state: string | null | undefined): { label: string; color: string; bg: string; dot: string } {
  switch (state?.toLowerCase()) {
    case "running":
      return { label: "Running", color: "text-[#22C55E]", bg: "bg-[rgba(34,197,94,0.1)]", dot: "bg-[#22C55E]" };
    case "stopped":
      return { label: "Stopped", color: "text-[#EF4444]", bg: "bg-[rgba(239,68,68,0.1)]", dot: "bg-[#EF4444]" };
    case "stopping":
      return { label: "Stopping", color: "text-[#FBBF24]", bg: "bg-[rgba(251,191,36,0.1)]", dot: "bg-[#FBBF24]" };
    case "pending":
      return { label: "Pending", color: "text-[#FBBF24]", bg: "bg-[rgba(251,191,36,0.1)]", dot: "bg-[#FBBF24]" };
    case "terminated":
      return { label: "Terminated", color: "text-[#6B7280]", bg: "bg-[rgba(107,114,128,0.1)]", dot: "bg-[#6B7280]" };
    default:
      return { label: state ?? "Unknown", color: "text-[#606060]", bg: "bg-[rgba(255,255,255,0.05)]", dot: "bg-[#505050]" };
  }
}

function Ec2InstanceCard({
  link,
  status,
  loading,
  onDelete,
  deleting,
  accountRegion,
}: {
  link: AwsLink;
  status: Ec2InstanceStatus | null;
  loading: boolean;
  onDelete: (id: string) => void;
  deleting: boolean;
  accountRegion: string;
}) {
  const region = status?.region ?? link.region ?? accountRegion;
  const instanceId = status?.instanceId ?? link.resourceId.split("/").pop() ?? link.resourceId;
  const consoleUrl = `https://${region}.console.aws.amazon.com/ec2/v2/home?region=${region}#Instances:instanceId=${instanceId}`;
  const sm = ec2StateMeta(status?.state);

  return (
    <div className="group relative bg-[#0E0E0E] border border-[rgba(255,255,255,0.07)] rounded-2xl overflow-hidden hover:border-[rgba(96,165,250,0.25)] transition-all">
      <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-[rgba(96,165,250,0.35)] to-transparent" />

      <div className="p-5">
        {/* Header */}
        <div className="flex items-start justify-between gap-3 mb-4">
          <div className="flex items-start gap-3 min-w-0">
            <div className="w-10 h-10 rounded-xl bg-[rgba(96,165,250,0.08)] border border-[rgba(96,165,250,0.15)] flex items-center justify-center flex-shrink-0">
              <Server size={18} className="text-[#60A5FA]" />
            </div>
            <div className="min-w-0">
              <div className="font-bold text-[#F0F0F0] text-base leading-tight truncate">
                {loading ? (
                  <span className="inline-block w-32 h-4 rounded bg-[rgba(255,255,255,0.06)] animate-pulse" />
                ) : (
                  status?.instanceId ?? link.label
                )}
              </div>
              <p className="text-[11px] text-[#505050] mt-0.5">{link.label}</p>
            </div>
          </div>
          <div className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full flex-shrink-0 ${sm.bg}`}>
            <span className={`w-2 h-2 rounded-full ${sm.dot}`} />
            <span className={`text-xs font-semibold ${sm.color}`}>{loading ? "—" : sm.label}</span>
          </div>
        </div>

        {/* Stats grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-2 mb-4">
          <div className="bg-[rgba(255,255,255,0.03)] border border-[rgba(255,255,255,0.05)] rounded-xl px-3 py-2.5">
            <div className="text-[10px] text-[#505050] font-medium uppercase tracking-wide mb-1">Instance Type</div>
            <div className="flex items-center gap-1.5">
              <Activity size={11} className="text-[#60A5FA]" />
              {loading ? (
                <span className="inline-block w-16 h-3 rounded bg-[rgba(255,255,255,0.06)] animate-pulse" />
              ) : (
                <span className="text-sm font-semibold text-[#E0E0E0] font-mono">{status?.instanceType ?? "—"}</span>
              )}
            </div>
          </div>

          <div className="bg-[rgba(255,255,255,0.03)] border border-[rgba(255,255,255,0.05)] rounded-xl px-3 py-2.5">
            <div className="text-[10px] text-[#505050] font-medium uppercase tracking-wide mb-1">Public IP</div>
            <div className="flex items-center gap-1.5">
              <Globe size={11} className="text-[#60A5FA]" />
              {loading ? (
                <span className="inline-block w-16 h-3 rounded bg-[rgba(255,255,255,0.06)] animate-pulse" />
              ) : (
                <span className="text-sm text-[#E0E0E0] font-mono">{status?.publicIp ?? "—"}</span>
              )}
            </div>
          </div>

          <div className="bg-[rgba(255,255,255,0.03)] border border-[rgba(255,255,255,0.05)] rounded-xl px-3 py-2.5">
            <div className="text-[10px] text-[#505050] font-medium uppercase tracking-wide mb-1">Private IP</div>
            <div className="flex items-center gap-1.5">
              <Server size={11} className="text-[#606060]" />
              {loading ? (
                <span className="inline-block w-16 h-3 rounded bg-[rgba(255,255,255,0.06)] animate-pulse" />
              ) : (
                <span className="text-sm text-[#909090] font-mono">{status?.privateIp ?? "—"}</span>
              )}
            </div>
          </div>

          <div className="bg-[rgba(255,255,255,0.03)] border border-[rgba(255,255,255,0.05)] rounded-xl px-3 py-2.5">
            <div className="text-[10px] text-[#505050] font-medium uppercase tracking-wide mb-1">Region / AZ</div>
            <div className="flex items-center gap-1.5">
              <Globe size={11} className="text-[#606060]" />
              {loading ? (
                <span className="inline-block w-16 h-3 rounded bg-[rgba(255,255,255,0.06)] animate-pulse" />
              ) : (
                <span className="text-sm text-[#909090]">{status?.availabilityZone ?? region}</span>
              )}
            </div>
          </div>
        </div>

        {/* Footer actions */}
        <div className="flex flex-wrap items-center gap-2 pt-3 border-t border-[rgba(255,255,255,0.05)]">
          <a
            href={consoleUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-lg bg-[rgba(255,255,255,0.04)] border border-[rgba(255,255,255,0.07)] text-[#909090] hover:text-[#F0F0F0] hover:border-[rgba(255,255,255,0.15)] transition-all"
          >
            <ExternalLink size={11} />
            Console
          </a>
          <button
            onClick={() => onDelete(link.id)}
            disabled={deleting}
            title="Remove link"
            className="ml-auto flex-shrink-0 p-1.5 rounded-lg text-[#404040] hover:text-[#EF4444] hover:bg-[rgba(239,68,68,0.08)] disabled:opacity-50 opacity-0 group-hover:opacity-100 transition-all"
          >
            {deleting ? (
              <span className="inline-block w-3 h-3 border border-[#606060] border-t-transparent rounded-full animate-spin" />
            ) : (
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="3 6 5 6 21 6" /><path d="M19 6l-1 14H6L5 6" /><path d="M10 11v6M14 11v6" /><path d="M9 6V4h6v2" />
              </svg>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// RDS database card
// ---------------------------------------------------------------------------

interface RdsInstanceStatus {
  resourceId: string;
  region: string;
  dbInstanceId: string;
  dbInstanceClass: string | null;
  engine: string | null;
  engineVersion: string | null;
  status: string | null;
  endpoint: string | null;
  port: number | null;
  multiAZ: boolean | null;
  availabilityZone: string | null;
  allocatedStorage: number | null;
  storageType: string | null;
  storageEncrypted: boolean | null;
  instanceCreateTime: string | null;
  error?: string;
}

function rdsStatusMeta(status: string | null | undefined): {
  label: string;
  color: string;
  bg: string;
  dot: string;
} {
  switch (status?.toLowerCase()) {
    case "available":
      return { label: "Available", color: "text-[#22C55E]", bg: "bg-[rgba(34,197,94,0.1)]", dot: "bg-[#22C55E]" };
    case "stopped":
      return { label: "Stopped", color: "text-[#EF4444]", bg: "bg-[rgba(239,68,68,0.1)]", dot: "bg-[#EF4444]" };
    case "starting":
    case "stopping":
    case "rebooting":
    case "modifying":
    case "upgrading":
    case "backing-up":
    case "creating":
    case "maintenance":
      return { label: status, color: "text-[#FBBF24]", bg: "bg-[rgba(251,191,36,0.1)]", dot: "bg-[#FBBF24]" };
    case "failed":
    case "incompatible-parameters":
    case "incompatible-restore":
    case "restore-error":
    case "storage-full":
      return { label: status, color: "text-[#EF4444]", bg: "bg-[rgba(239,68,68,0.1)]", dot: "bg-[#EF4444]" };
    default:
      return { label: status ?? "Unknown", color: "text-[#606060]", bg: "bg-[rgba(255,255,255,0.05)]", dot: "bg-[#505050]" };
  }
}

function RdsCard({
  link,
  status,
  loading,
  onDelete,
  deleting,
  accountRegion,
}: {
  link: AwsLink;
  status: RdsInstanceStatus | null;
  loading: boolean;
  onDelete: (id: string) => void;
  deleting: boolean;
  accountRegion: string;
}) {
  const region = status?.region ?? link.region ?? accountRegion;
  const dbId = status?.dbInstanceId ?? link.resourceId.split(":").pop() ?? link.resourceId;
  const consoleUrl = `https://${region}.console.aws.amazon.com/rds/home?region=${region}#database:id=${dbId};is-cluster=false`;
  const sm = rdsStatusMeta(status?.status);

  const engineLabel = status?.engine
    ? status.engineVersion
      ? `${status.engine} ${status.engineVersion}`
      : status.engine
    : null;

  const endpointLabel = status?.endpoint
    ? status.port
      ? `${status.endpoint}:${status.port}`
      : status.endpoint
    : null;

  return (
    <div className="group relative bg-[#0E0E0E] border border-[rgba(255,255,255,0.07)] rounded-2xl overflow-hidden hover:border-[rgba(129,140,248,0.25)] transition-all">
      <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-[rgba(129,140,248,0.35)] to-transparent" />

      <div className="p-5">
        {/* Header */}
        <div className="flex items-start justify-between gap-3 mb-4">
          <div className="flex items-start gap-3 min-w-0">
            <div className="w-10 h-10 rounded-xl bg-[rgba(129,140,248,0.08)] border border-[rgba(129,140,248,0.15)] flex items-center justify-center flex-shrink-0">
              <Database size={18} className="text-[#818CF8]" />
            </div>
            <div className="min-w-0">
              <div className="font-bold text-[#F0F0F0] text-base leading-tight truncate">
                {loading ? (
                  <span className="inline-block w-32 h-4 rounded bg-[rgba(255,255,255,0.06)] animate-pulse" />
                ) : (
                  status?.dbInstanceId ?? link.label
                )}
              </div>
              <p className="text-[11px] text-[#505050] mt-0.5">{link.label}</p>
            </div>
          </div>
          <div className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full flex-shrink-0 ${sm.bg}`}>
            <span className={`w-2 h-2 rounded-full ${sm.dot}`} />
            <span className={`text-xs font-semibold ${sm.color}`}>{loading ? "—" : sm.label}</span>
          </div>
        </div>

        {/* Stats grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-2 mb-4">
          <div className="bg-[rgba(255,255,255,0.03)] border border-[rgba(255,255,255,0.05)] rounded-xl px-3 py-2.5">
            <div className="text-[10px] text-[#505050] font-medium uppercase tracking-wide mb-1">Engine</div>
            <div className="flex items-center gap-1.5">
              <Database size={11} className="text-[#818CF8]" />
              {loading ? (
                <span className="inline-block w-20 h-3 rounded bg-[rgba(255,255,255,0.06)] animate-pulse" />
              ) : (
                <span className="text-sm font-semibold text-[#E0E0E0] font-mono">{engineLabel ?? "—"}</span>
              )}
            </div>
          </div>

          <div className="bg-[rgba(255,255,255,0.03)] border border-[rgba(255,255,255,0.05)] rounded-xl px-3 py-2.5">
            <div className="text-[10px] text-[#505050] font-medium uppercase tracking-wide mb-1">Instance Class</div>
            <div className="flex items-center gap-1.5">
              <Activity size={11} className="text-[#818CF8]" />
              {loading ? (
                <span className="inline-block w-16 h-3 rounded bg-[rgba(255,255,255,0.06)] animate-pulse" />
              ) : (
                <span className="text-sm font-semibold text-[#E0E0E0] font-mono">{status?.dbInstanceClass ?? "—"}</span>
              )}
            </div>
          </div>

          <div className="bg-[rgba(255,255,255,0.03)] border border-[rgba(255,255,255,0.05)] rounded-xl px-3 py-2.5 sm:col-span-2 xl:col-span-2">
            <div className="text-[10px] text-[#505050] font-medium uppercase tracking-wide mb-1">Endpoint</div>
            <div className="flex items-center gap-1.5">
              <Globe size={11} className="text-[#606060]" />
              {loading ? (
                <span className="inline-block w-40 h-3 rounded bg-[rgba(255,255,255,0.06)] animate-pulse" />
              ) : (
                <span className="text-sm text-[#909090] font-mono truncate">{endpointLabel ?? "—"}</span>
              )}
            </div>
          </div>
        </div>

        {/* Second row */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 mb-4">
          <div className="bg-[rgba(255,255,255,0.03)] border border-[rgba(255,255,255,0.05)] rounded-xl px-3 py-2.5">
            <div className="text-[10px] text-[#505050] font-medium uppercase tracking-wide mb-1">Storage</div>
            <div className="flex items-center gap-1.5">
              <Box size={11} className="text-[#606060]" />
              {loading ? (
                <span className="inline-block w-16 h-3 rounded bg-[rgba(255,255,255,0.06)] animate-pulse" />
              ) : (
                <span className="text-sm text-[#909090]">
                  {status?.allocatedStorage != null ? `${status.allocatedStorage} GiB` : "—"}
                  {status?.storageType ? ` · ${status.storageType}` : ""}
                  {status?.storageEncrypted ? " · encrypted" : ""}
                </span>
              )}
            </div>
          </div>

          <div className="bg-[rgba(255,255,255,0.03)] border border-[rgba(255,255,255,0.05)] rounded-xl px-3 py-2.5">
            <div className="text-[10px] text-[#505050] font-medium uppercase tracking-wide mb-1">Multi-AZ</div>
            <div className="flex items-center gap-1.5">
              <Layers size={11} className="text-[#606060]" />
              {loading ? (
                <span className="inline-block w-10 h-3 rounded bg-[rgba(255,255,255,0.06)] animate-pulse" />
              ) : (
                <span className="text-sm text-[#909090]">
                  {status?.multiAZ == null ? "—" : status.multiAZ ? "Yes" : "No"}
                </span>
              )}
            </div>
          </div>

          <div className="bg-[rgba(255,255,255,0.03)] border border-[rgba(255,255,255,0.05)] rounded-xl px-3 py-2.5">
            <div className="text-[10px] text-[#505050] font-medium uppercase tracking-wide mb-1">Region / AZ</div>
            <div className="flex items-center gap-1.5">
              <Globe size={11} className="text-[#606060]" />
              {loading ? (
                <span className="inline-block w-16 h-3 rounded bg-[rgba(255,255,255,0.06)] animate-pulse" />
              ) : (
                <span className="text-sm text-[#909090]">{status?.availabilityZone ?? region}</span>
              )}
            </div>
          </div>
        </div>

        {/* Footer actions */}
        <div className="flex flex-wrap items-center gap-2 pt-3 border-t border-[rgba(255,255,255,0.05)]">
          <a
            href={consoleUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-lg bg-[rgba(255,255,255,0.04)] border border-[rgba(255,255,255,0.07)] text-[#909090] hover:text-[#F0F0F0] hover:border-[rgba(255,255,255,0.15)] transition-all"
          >
            <ExternalLink size={11} />
            Console
          </a>
          {endpointLabel && (
            <button
              onClick={() => navigator.clipboard.writeText(endpointLabel)}
              className="flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-lg bg-[rgba(255,255,255,0.04)] border border-[rgba(255,255,255,0.07)] text-[#909090] hover:text-[#F0F0F0] hover:border-[rgba(255,255,255,0.15)] transition-all"
            >
              <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <rect x="9" y="9" width="13" height="13" rx="2" /><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
              </svg>
              Copy Endpoint
            </button>
          )}
          <button
            onClick={() => onDelete(link.id)}
            disabled={deleting}
            title="Remove link"
            className="ml-auto flex-shrink-0 p-1.5 rounded-lg text-[#404040] hover:text-[#EF4444] hover:bg-[rgba(239,68,68,0.08)] disabled:opacity-50 opacity-0 group-hover:opacity-100 transition-all"
          >
            {deleting ? (
              <span className="inline-block w-3 h-3 border border-[#606060] border-t-transparent rounded-full animate-spin" />
            ) : (
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="3 6 5 6 21 6" /><path d="M19 6l-1 14H6L5 6" /><path d="M10 11v6M14 11v6" /><path d="M9 6V4h6v2" />
              </svg>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// ECS Cluster card + side drawer
// ---------------------------------------------------------------------------

interface EcsService {
  serviceName: string | null;
  status: string | null;
  runningCount: number;
  pendingCount: number;
  desiredCount: number;
  taskDefinition: string | null;
  launchType: string | null;
}

interface EcsClusterStatus {
  arn: string;
  clusterName: string | null;
  region: string;
  status: string | null;
  registeredContainerInstancesCount: number;
  runningTasksCount: number;
  pendingTasksCount: number;
  activeServicesCount: number;
  services: EcsService[];
  error?: string;
}

function ecsStatusMeta(status: string | null | undefined): { label: string; color: string; bg: string; dot: string } {
  switch (status?.toUpperCase()) {
    case "ACTIVE":
      return { label: "Active", color: "text-[#22C55E]", bg: "bg-[rgba(34,197,94,0.1)]", dot: "bg-[#22C55E]" };
    case "INACTIVE":
      return { label: "Inactive", color: "text-[#EF4444]", bg: "bg-[rgba(239,68,68,0.1)]", dot: "bg-[#EF4444]" };
    case "PROVISIONING":
      return { label: "Provisioning", color: "text-[#FBBF24]", bg: "bg-[rgba(251,191,36,0.1)]", dot: "bg-[#FBBF24]" };
    default:
      return { label: status ?? "Unknown", color: "text-[#606060]", bg: "bg-[rgba(255,255,255,0.05)]", dot: "bg-[#505050]" };
  }
}

function EcsCard({
  link,
  status,
  loading,
  onDelete,
  deleting,
  accountRegion,
  onViewDetails,
}: {
  link: AwsLink;
  status: EcsClusterStatus | null;
  loading: boolean;
  onDelete: (id: string) => void;
  deleting: boolean;
  accountRegion: string;
  onViewDetails: () => void;
}) {
  const region = status?.region ?? link.region ?? accountRegion;
  const clusterName = status?.clusterName ?? link.resourceId.split("/").pop() ?? link.resourceId;
  const consoleUrl = `https://${region}.console.aws.amazon.com/ecs/v2/clusters/${clusterName}/services`;
  const sm = ecsStatusMeta(status?.status);

  return (
    <div className="group relative bg-[#0E0E0E] border border-[rgba(255,255,255,0.07)] rounded-2xl overflow-hidden hover:border-[rgba(56,189,248,0.25)] transition-all">
      {/* Top accent */}
      <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-[rgba(56,189,248,0.35)] to-transparent" />

      <div className="p-5">
        {/* Header */}
        <div className="flex items-start justify-between gap-3 mb-4">
          <div className="flex items-start gap-3 min-w-0">
            <div className="w-10 h-10 rounded-xl bg-[rgba(56,189,248,0.08)] border border-[rgba(56,189,248,0.15)] flex items-center justify-center flex-shrink-0">
              <Layers size={18} className="text-[#38BDF8]" />
            </div>
            <div className="min-w-0">
              <div className="font-bold text-[#F0F0F0] text-base leading-tight truncate">
                {loading ? (
                  <span className="inline-block w-32 h-4 rounded bg-[rgba(255,255,255,0.06)] animate-pulse" />
                ) : (
                  status?.clusterName ?? link.label
                )}
              </div>
              <p className="text-[11px] text-[#505050] mt-0.5">{link.label}</p>
            </div>
          </div>

          {/* Status badge */}
          <div className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full flex-shrink-0 ${sm.bg}`}>
            <span className={`w-2 h-2 rounded-full ${sm.dot}`} />
            <span className={`text-xs font-semibold ${sm.color}`}>{loading ? "—" : sm.label}</span>
          </div>
        </div>

        {/* Stats grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-2 mb-4">
          <div className="bg-[rgba(255,255,255,0.03)] border border-[rgba(255,255,255,0.05)] rounded-xl px-3 py-2.5">
            <div className="text-[10px] text-[#505050] font-medium uppercase tracking-wide mb-1">Services</div>
            <div className="flex items-center gap-1.5">
              <Activity size={11} className="text-[#38BDF8]" />
              {loading ? (
                <span className="inline-block w-10 h-3 rounded bg-[rgba(255,255,255,0.06)] animate-pulse" />
              ) : (
                <span className="text-sm font-semibold text-[#E0E0E0]">{status?.activeServicesCount ?? "—"}</span>
              )}
            </div>
          </div>

          <div className="bg-[rgba(255,255,255,0.03)] border border-[rgba(255,255,255,0.05)] rounded-xl px-3 py-2.5">
            <div className="text-[10px] text-[#505050] font-medium uppercase tracking-wide mb-1">Running Tasks</div>
            <div className="flex items-center gap-1.5">
              <CheckCircle2 size={11} className="text-[#22C55E]" />
              {loading ? (
                <span className="inline-block w-10 h-3 rounded bg-[rgba(255,255,255,0.06)] animate-pulse" />
              ) : (
                <span className="text-sm font-semibold text-[#E0E0E0]">{status?.runningTasksCount ?? "—"}</span>
              )}
            </div>
          </div>

          <div className="bg-[rgba(255,255,255,0.03)] border border-[rgba(255,255,255,0.05)] rounded-xl px-3 py-2.5">
            <div className="text-[10px] text-[#505050] font-medium uppercase tracking-wide mb-1">Instances</div>
            <div className="flex items-center gap-1.5">
              <Server size={11} className="text-[#606060]" />
              {loading ? (
                <span className="inline-block w-10 h-3 rounded bg-[rgba(255,255,255,0.06)] animate-pulse" />
              ) : (
                <span className="text-sm text-[#909090]">{status?.registeredContainerInstancesCount ?? "—"}</span>
              )}
            </div>
          </div>

          <div className="bg-[rgba(255,255,255,0.03)] border border-[rgba(255,255,255,0.05)] rounded-xl px-3 py-2.5">
            <div className="text-[10px] text-[#505050] font-medium uppercase tracking-wide mb-1">Region</div>
            <div className="flex items-center gap-1.5">
              <Globe size={11} className="text-[#606060]" />
              <span className="text-sm text-[#909090]">{region}</span>
            </div>
          </div>
        </div>

        {/* Footer actions */}
        <div className="flex flex-wrap items-center gap-2 pt-3 border-t border-[rgba(255,255,255,0.05)]">
          <button
            onClick={onViewDetails}
            className="flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-lg border transition-all bg-[rgba(56,189,248,0.06)] border-[rgba(56,189,248,0.2)] text-[#38BDF8] hover:bg-[rgba(56,189,248,0.12)]"
          >
            <ChevronRight size={11} />
            Details
          </button>
          <a
            href={consoleUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-lg bg-[rgba(255,255,255,0.04)] border border-[rgba(255,255,255,0.07)] text-[#909090] hover:text-[#F0F0F0] hover:border-[rgba(255,255,255,0.15)] transition-all"
          >
            <ExternalLink size={11} />
            Console
          </a>
          <button
            onClick={() => onDelete(link.id)}
            disabled={deleting}
            title="Remove link"
            className="ml-auto flex-shrink-0 p-1.5 rounded-lg text-[#404040] hover:text-[#EF4444] hover:bg-[rgba(239,68,68,0.08)] disabled:opacity-50 opacity-0 group-hover:opacity-100 transition-all"
          >
            {deleting ? (
              <span className="inline-block w-3 h-3 border border-[#606060] border-t-transparent rounded-full animate-spin" />
            ) : (
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="3 6 5 6 21 6" /><path d="M19 6l-1 14H6L5 6" /><path d="M10 11v6M14 11v6" /><path d="M9 6V4h6v2" />
              </svg>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}

function EcsDrawer({
  open,
  onClose,
  status,
  link,
  accountRegion,
}: {
  open: boolean;
  onClose: () => void;
  status: EcsClusterStatus | null;
  link: AwsLink | null;
  accountRegion: string;
}) {
  if (!link) return null;
  const region = status?.region ?? link.region ?? accountRegion;
  const clusterName = status?.clusterName ?? link.resourceId.split("/").pop() ?? link.resourceId;
  const consoleUrl = `https://${region}.console.aws.amazon.com/ecs/v2/clusters/${clusterName}/services`;
  const sm = ecsStatusMeta(status?.status);

  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div
            key="ecs-drawer-backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            onClick={onClose}
            className="fixed inset-0 z-40 bg-black/50 backdrop-blur-sm"
          />

          <motion.div
            key="ecs-drawer-panel"
            initial={{ x: "100%" }}
            animate={{ x: 0 }}
            exit={{ x: "100%" }}
            transition={{ type: "spring", stiffness: 300, damping: 30 }}
            className="fixed top-0 right-0 h-full z-50 w-full max-w-xl flex flex-col bg-[#0A0A0A] border-l border-[rgba(255,255,255,0.08)] shadow-2xl"
          >
            {/* Header */}
            <div className="flex items-center justify-between gap-4 px-5 py-4 border-b border-[rgba(255,255,255,0.07)]">
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-9 h-9 rounded-xl bg-[rgba(56,189,248,0.08)] border border-[rgba(56,189,248,0.15)] flex items-center justify-center flex-shrink-0">
                  <Layers size={16} className="text-[#38BDF8]" />
                </div>
                <div className="min-w-0">
                  <div className="font-semibold text-[#F0F0F0] text-sm truncate">{status?.clusterName ?? link.label}</div>
                  <div className="text-[11px] text-[#505050]">ECS Cluster · {region}</div>
                </div>
              </div>
              <button
                onClick={onClose}
                className="flex-shrink-0 w-8 h-8 flex items-center justify-center rounded-lg text-[#505050] hover:text-[#F0F0F0] hover:bg-[rgba(255,255,255,0.06)] transition-all"
              >
                <X size={16} />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto min-h-0 p-5 space-y-5">
              {/* Status overview */}
              <div className="bg-[#111111] border border-[rgba(255,255,255,0.07)] rounded-2xl p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold uppercase tracking-wide text-[#505050]">Cluster Status</span>
                  <div className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full ${sm.bg}`}>
                    <span className={`w-2 h-2 rounded-full ${sm.dot}`} />
                    <span className={`text-xs font-semibold ${sm.color}`}>{sm.label}</span>
                  </div>
                </div>
                <div className="grid grid-cols-3 gap-3">
                  <div className="text-center">
                    <div className="text-2xl font-bold text-[#38BDF8]">{status?.activeServicesCount ?? "—"}</div>
                    <div className="text-[10px] text-[#505050] uppercase tracking-wide mt-0.5">Services</div>
                  </div>
                  <div className="text-center">
                    <div className="text-2xl font-bold text-[#22C55E]">{status?.runningTasksCount ?? "—"}</div>
                    <div className="text-[10px] text-[#505050] uppercase tracking-wide mt-0.5">Running</div>
                  </div>
                  <div className="text-center">
                    <div className="text-2xl font-bold text-[#FBBF24]">{status?.pendingTasksCount ?? "—"}</div>
                    <div className="text-[10px] text-[#505050] uppercase tracking-wide mt-0.5">Pending</div>
                  </div>
                </div>
              </div>

              {/* Cluster info */}
              <div className="bg-[#111111] border border-[rgba(255,255,255,0.07)] rounded-2xl p-4 space-y-3">
                <span className="text-xs font-semibold uppercase tracking-wide text-[#505050]">Cluster Info</span>
                <div className="space-y-2">
                  <div className="flex items-start justify-between gap-3">
                    <span className="text-xs text-[#606060] flex-shrink-0">Name</span>
                    <span className="text-xs text-[#E0E0E0] font-mono text-right break-all">{status?.clusterName ?? "—"}</span>
                  </div>
                  <div className="flex items-start justify-between gap-3">
                    <span className="text-xs text-[#606060] flex-shrink-0">Region</span>
                    <span className="text-xs text-[#E0E0E0]">{region}</span>
                  </div>
                  <div className="flex items-start justify-between gap-3">
                    <span className="text-xs text-[#606060] flex-shrink-0">Container Instances</span>
                    <span className="text-xs text-[#E0E0E0]">{status?.registeredContainerInstancesCount ?? "—"}</span>
                  </div>
                  <div className="flex items-start justify-between gap-3">
                    <span className="text-xs text-[#606060] flex-shrink-0 mt-0.5">ARN</span>
                    <code className="text-[10px] text-[#505050] font-mono text-right break-all">{link.resourceId}</code>
                  </div>
                </div>
              </div>

              {/* Services list */}
              {status?.services && status.services.length > 0 && (
                <div className="space-y-2">
                  <span className="text-xs font-semibold uppercase tracking-wide text-[#505050]">Services</span>
                  <div className="bg-[#111111] border border-[rgba(255,255,255,0.07)] rounded-2xl divide-y divide-[rgba(255,255,255,0.04)]">
                    {status.services.map((svc, i) => {
                      const svcSm = ecsStatusMeta(svc.status);
                      const healthyRatio = svc.desiredCount > 0 ? svc.runningCount / svc.desiredCount : 0;
                      return (
                        <div key={i} className="px-4 py-3">
                          <div className="flex items-center justify-between gap-2 mb-2">
                            <span className="text-sm font-medium text-[#E0E0E0] truncate">{svc.serviceName ?? "Unknown"}</span>
                            <div className={`flex items-center gap-1 px-2 py-0.5 rounded-full flex-shrink-0 ${svcSm.bg}`}>
                              <span className={`w-1.5 h-1.5 rounded-full ${svcSm.dot}`} />
                              <span className={`text-[10px] font-semibold ${svcSm.color}`}>{svcSm.label}</span>
                            </div>
                          </div>
                          <div className="flex items-center gap-4 text-[11px] text-[#505050]">
                            <span>{svc.runningCount}/{svc.desiredCount} tasks</span>
                            {svc.launchType && <span className="uppercase">{svc.launchType}</span>}
                          </div>
                          {/* Task health bar */}
                          <div className="mt-2 h-1 bg-[rgba(255,255,255,0.05)] rounded-full overflow-hidden">
                            <div
                              className="h-full rounded-full bg-[#22C55E] transition-all"
                              style={{ width: `${Math.round(healthyRatio * 100)}%` }}
                            />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="px-5 py-3 border-t border-[rgba(255,255,255,0.06)] flex items-center justify-between">
              <span className="text-[11px] text-[#404040]">ECS · {region}</span>
              <a
                href={consoleUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-lg bg-[rgba(56,189,248,0.06)] border border-[rgba(56,189,248,0.2)] text-[#38BDF8] hover:bg-[rgba(56,189,248,0.12)] transition-all"
              >
                <ExternalLink size={11} />
                Open in Console
              </a>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}

// ---------------------------------------------------------------------------
// ECS Instance card
// ---------------------------------------------------------------------------

interface EcsInstanceStatus {
  arn: string;
  region: string;
  clusterName: string | null;
  ec2InstanceId: string | null;
  status: string | null;
  runningTasksCount: number;
  pendingTasksCount: number;
  agentConnected: boolean;
  remainingCpu: number | null;
  remainingMemory: number | null;
  registeredCpu: number | null;
  registeredMemory: number | null;
  error?: string;
}

function ecsInstanceStatusMeta(status: string | null | undefined): { label: string; color: string; bg: string; dot: string } {
  switch (status?.toUpperCase()) {
    case "ACTIVE":
      return { label: "Active", color: "text-[#22C55E]", bg: "bg-[rgba(34,197,94,0.1)]", dot: "bg-[#22C55E]" };
    case "DRAINING":
      return { label: "Draining", color: "text-[#FBBF24]", bg: "bg-[rgba(251,191,36,0.1)]", dot: "bg-[#FBBF24]" };
    case "INACTIVE":
      return { label: "Inactive", color: "text-[#EF4444]", bg: "bg-[rgba(239,68,68,0.1)]", dot: "bg-[#EF4444]" };
    default:
      return { label: status ?? "Unknown", color: "text-[#606060]", bg: "bg-[rgba(255,255,255,0.05)]", dot: "bg-[#505050]" };
  }
}

function EcsInstanceCard({
  link,
  status,
  loading,
  onDelete,
  deleting,
  accountRegion,
}: {
  link: AwsLink;
  status: EcsInstanceStatus | null;
  loading: boolean;
  onDelete: (id: string) => void;
  deleting: boolean;
  accountRegion: string;
}) {
  const region = status?.region ?? link.region ?? accountRegion;
  const clusterName = status?.clusterName ?? null;
  const instanceId = status?.ec2InstanceId ?? link.resourceId.split("/").pop() ?? link.resourceId;
  const consoleUrl = clusterName
    ? `https://${region}.console.aws.amazon.com/ecs/v2/clusters/${clusterName}/infrastructure`
    : `https://${region}.console.aws.amazon.com/ecs/v2`;
  const sm = ecsInstanceStatusMeta(status?.status);

  const cpuPct = status?.registeredCpu && status.registeredCpu > 0
    ? Math.round(((status.registeredCpu - (status.remainingCpu ?? 0)) / status.registeredCpu) * 100)
    : null;
  const memPct = status?.registeredMemory && status.registeredMemory > 0
    ? Math.round(((status.registeredMemory - (status.remainingMemory ?? 0)) / status.registeredMemory) * 100)
    : null;

  return (
    <div className="group relative bg-[#0E0E0E] border border-[rgba(255,255,255,0.07)] rounded-2xl overflow-hidden hover:border-[rgba(125,211,252,0.25)] transition-all">
      <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-[rgba(125,211,252,0.35)] to-transparent" />

      <div className="p-5">
        {/* Header */}
        <div className="flex items-start justify-between gap-3 mb-4">
          <div className="flex items-start gap-3 min-w-0">
            <div className="w-10 h-10 rounded-xl bg-[rgba(125,211,252,0.08)] border border-[rgba(125,211,252,0.15)] flex items-center justify-center flex-shrink-0">
              <Server size={18} className="text-[#7DD3FC]" />
            </div>
            <div className="min-w-0">
              <div className="font-bold text-[#F0F0F0] text-base leading-tight truncate">
                {loading ? (
                  <span className="inline-block w-32 h-4 rounded bg-[rgba(255,255,255,0.06)] animate-pulse" />
                ) : (
                  status?.ec2InstanceId ?? link.label
                )}
              </div>
              <p className="text-[11px] text-[#505050] mt-0.5">{link.label}</p>
            </div>
          </div>
          <div className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full flex-shrink-0 ${sm.bg}`}>
            <span className={`w-2 h-2 rounded-full ${sm.dot}`} />
            <span className={`text-xs font-semibold ${sm.color}`}>{loading ? "—" : sm.label}</span>
          </div>
        </div>

        {/* Stats grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-2 mb-4">
          <div className="bg-[rgba(255,255,255,0.03)] border border-[rgba(255,255,255,0.05)] rounded-xl px-3 py-2.5">
            <div className="text-[10px] text-[#505050] font-medium uppercase tracking-wide mb-1">Running Tasks</div>
            <div className="flex items-center gap-1.5">
              <CheckCircle2 size={11} className="text-[#22C55E]" />
              {loading ? (
                <span className="inline-block w-10 h-3 rounded bg-[rgba(255,255,255,0.06)] animate-pulse" />
              ) : (
                <span className="text-sm font-semibold text-[#E0E0E0]">{status?.runningTasksCount ?? "—"}</span>
              )}
            </div>
          </div>

          <div className="bg-[rgba(255,255,255,0.03)] border border-[rgba(255,255,255,0.05)] rounded-xl px-3 py-2.5">
            <div className="text-[10px] text-[#505050] font-medium uppercase tracking-wide mb-1">CPU Used</div>
            <div className="flex items-center gap-1.5">
              <Activity size={11} className="text-[#7DD3FC]" />
              {loading ? (
                <span className="inline-block w-10 h-3 rounded bg-[rgba(255,255,255,0.06)] animate-pulse" />
              ) : (
                <span className="text-sm font-semibold text-[#E0E0E0]">{cpuPct !== null ? `${cpuPct}%` : "—"}</span>
              )}
            </div>
          </div>

          <div className="bg-[rgba(255,255,255,0.03)] border border-[rgba(255,255,255,0.05)] rounded-xl px-3 py-2.5">
            <div className="text-[10px] text-[#505050] font-medium uppercase tracking-wide mb-1">Memory Used</div>
            <div className="flex items-center gap-1.5">
              <Database size={11} className="text-[#7DD3FC]" />
              {loading ? (
                <span className="inline-block w-10 h-3 rounded bg-[rgba(255,255,255,0.06)] animate-pulse" />
              ) : (
                <span className="text-sm font-semibold text-[#E0E0E0]">{memPct !== null ? `${memPct}%` : "—"}</span>
              )}
            </div>
          </div>

          <div className="bg-[rgba(255,255,255,0.03)] border border-[rgba(255,255,255,0.05)] rounded-xl px-3 py-2.5">
            <div className="text-[10px] text-[#505050] font-medium uppercase tracking-wide mb-1">Agent</div>
            <div className="flex items-center gap-1.5">
              {loading ? (
                <span className="inline-block w-10 h-3 rounded bg-[rgba(255,255,255,0.06)] animate-pulse" />
              ) : status?.agentConnected ? (
                <>
                  <span className="w-1.5 h-1.5 rounded-full bg-[#22C55E]" />
                  <span className="text-sm text-[#22C55E]">Connected</span>
                </>
              ) : (
                <>
                  <span className="w-1.5 h-1.5 rounded-full bg-[#606060]" />
                  <span className="text-sm text-[#909090]">—</span>
                </>
              )}
            </div>
          </div>
        </div>

        {/* Footer actions */}
        <div className="flex flex-wrap items-center gap-2 pt-3 border-t border-[rgba(255,255,255,0.05)]">
          <a
            href={consoleUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-lg bg-[rgba(255,255,255,0.04)] border border-[rgba(255,255,255,0.07)] text-[#909090] hover:text-[#F0F0F0] hover:border-[rgba(255,255,255,0.15)] transition-all"
          >
            <ExternalLink size={11} />
            Console
          </a>
          {clusterName && (
            <span className="text-[11px] text-[#404040] font-mono truncate ml-1">{clusterName}</span>
          )}
          <button
            onClick={() => onDelete(link.id)}
            disabled={deleting}
            title="Remove link"
            className="ml-auto flex-shrink-0 p-1.5 rounded-lg text-[#404040] hover:text-[#EF4444] hover:bg-[rgba(239,68,68,0.08)] disabled:opacity-50 opacity-0 group-hover:opacity-100 transition-all"
          >
            {deleting ? (
              <span className="inline-block w-3 h-3 border border-[#606060] border-t-transparent rounded-full animate-spin" />
            ) : (
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="3 6 5 6 21 6" /><path d="M19 6l-1 14H6L5 6" /><path d="M10 11v6M14 11v6" /><path d="M9 6V4h6v2" />
              </svg>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}

function DeploymentsTab({
  repoId,
  awsLinks: initialLinks,
  isAwsConnected,
  accountRegion,
}: {
  repoId: string;
  awsLinks: AwsLink[];
  isAwsConnected: boolean;
  accountRegion: string;
}) {
  const [links, setLinks] = useState<AwsLink[]>(initialLinks);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [amplifyStatus, setAmplifyStatus] = useState<Record<string, AmplifyAppStatus>>({});
  const [amplifyLoading, setAmplifyLoading] = useState(false);
  const [ecsStatus, setEcsStatus] = useState<Record<string, EcsClusterStatus>>({});
  const [ecsLoading, setEcsLoading] = useState(false);
  const [ecsDrawerOpen, setEcsDrawerOpen] = useState(false);
  const [ecsDrawerLink, setEcsDrawerLink] = useState<AwsLink | null>(null);
  const [ecsInstanceStatus, setEcsInstanceStatus] = useState<Record<string, EcsInstanceStatus>>({});
  const [ecsInstanceLoading, setEcsInstanceLoading] = useState(false);
  const [ec2Status, setEc2Status] = useState<Record<string, Ec2InstanceStatus>>({});
  const [ec2Loading, setEc2Loading] = useState(false);
  const [rdsStatus, setRdsStatus] = useState<Record<string, RdsInstanceStatus>>({});
  const [rdsLoading, setRdsLoading] = useState(false);

  // Logs drawer state
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [drawerApp, setDrawerApp] = useState<{ appId: string; branchName: string; jobId: string; region: string; name: string } | null>(null);
  const [drawerLoading, setDrawerLoading] = useState(false);
  const [drawerData, setDrawerData] = useState<{ jobId: string; commitMessage: string | null; startTime: string | null; endTime: string | null; steps: AmplifyLogStep[] } | null>(null);
  const [drawerActiveStep, setDrawerActiveStep] = useState<string | null>(null);
  const [drawerError, setDrawerError] = useState<string | null>(null);

  // History drawer state
  const [historyOpen, setHistoryOpen] = useState(false);
  const [historyApp, setHistoryApp] = useState<{ appId: string; branchName: string; region: string; name: string } | null>(null);

  // Fetch live Amplify status when there are Amplify links
  useEffect(() => {
    const amplifyLinks = links.filter((l) => l.service === "amplify");
    if (!amplifyLinks.length) return;
    setAmplifyLoading(true);
    fetch("/api/aws/amplify/status", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ arns: amplifyLinks.map((l) => l.resourceId) }),
    })
      .then((r) => r.json())
      .then((d: { apps: AmplifyAppStatus[] }) => {
        const map: Record<string, AmplifyAppStatus> = {};
        for (const app of d.apps ?? []) map[app.arn] = app;
        setAmplifyStatus(map);
      })
      .catch(() => { })
      .finally(() => setAmplifyLoading(false));
  }, [links]);

  // Fetch live ECS cluster status (passes region override per link)
  useEffect(() => {
    const ecsLinks = links.filter((l) => l.service === "ecs");
    if (!ecsLinks.length) return;
    setEcsLoading(true);
    fetch("/api/aws/ecs/status", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        clusters: ecsLinks.map((l) => ({ resourceId: l.resourceId, region: l.region })),
      }),
    })
      .then((r) => r.json())
      .then((d: { clusters: EcsClusterStatus[] }) => {
        const map: Record<string, EcsClusterStatus> = {};
        for (const c of d.clusters ?? []) map[c.arn] = c;
        setEcsStatus(map);
      })
      .catch(() => { })
      .finally(() => setEcsLoading(false));
  }, [links]);

  // Fetch live ECS container instance status (passes region override per link)
  useEffect(() => {
    const instanceLinks = links.filter((l) => l.service === "ecs_instance");
    if (!instanceLinks.length) return;
    setEcsInstanceLoading(true);
    fetch("/api/aws/ecs/instance-status", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        instances: instanceLinks.map((l) => ({ resourceId: l.resourceId, region: l.region })),
      }),
    })
      .then((r) => r.json())
      .then((d: { instances: EcsInstanceStatus[] }) => {
        const map: Record<string, EcsInstanceStatus> = {};
        for (const inst of d.instances ?? []) map[inst.arn] = inst;
        setEcsInstanceStatus(map);
      })
      .catch(() => { })
      .finally(() => setEcsInstanceLoading(false));
  }, [links]);

  // Fetch live EC2 instance status (passes region override per link)
  useEffect(() => {
    const ec2Links = links.filter((l) => l.service === "ec2");
    if (!ec2Links.length) return;
    setEc2Loading(true);
    fetch("/api/aws/ec2/status", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        instances: ec2Links.map((l) => ({ resourceId: l.resourceId, region: l.region })),
      }),
    })
      .then((r) => r.json())
      .then((d: { instances: Ec2InstanceStatus[] }) => {
        const map: Record<string, Ec2InstanceStatus> = {};
        for (const inst of d.instances ?? []) map[inst.resourceId] = inst;
        setEc2Status(map);
      })
      .catch(() => { })
      .finally(() => setEc2Loading(false));
  }, [links]);

  // Fetch live RDS instance status
  useEffect(() => {
    const rdsLinks = links.filter((l) => l.service === "rds");
    if (!rdsLinks.length) return;
    setRdsLoading(true);
    fetch("/api/aws/rds/status", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        instances: rdsLinks.map((l) => ({ resourceId: l.resourceId, region: l.region })),
      }),
    })
      .then((r) => r.json())
      .then((d: { instances: RdsInstanceStatus[] }) => {
        const map: Record<string, RdsInstanceStatus> = {};
        for (const inst of d.instances ?? []) map[inst.resourceId] = inst;
        setRdsStatus(map);
      })
      .catch(() => { })
      .finally(() => setRdsLoading(false));
  }, [links]);

  async function handleDelete(id: string) {
    setDeletingId(id);
    await fetch(`/api/aws/links/${id}`, { method: "DELETE" });
    setLinks((prev) => prev.filter((l) => l.id !== id));
    setDeletingId(null);
  }

  async function handleViewLogs(link: AwsLink, status: AmplifyAppStatus | null) {
    // Use region from the parsed status (extracted from ARN) — link.region may be wrong
    const region = status?.region ?? link.region ?? accountRegion;
    const appId = status?.appId ?? link.resourceId.split("/").pop() ?? "";
    const branchName = status?.productionBranch?.branchName;
    const jobId = status?.productionBranch?.lastJobId;
    const name = status?.name ?? link.label;
    if (!jobId || !branchName) return;
    setDrawerApp({ appId, branchName, jobId, region, name });
    setDrawerData(null);
    setDrawerActiveStep(null);
    setDrawerError(null);
    setDrawerOpen(true);
    setDrawerLoading(true);
    try {
      const res = await fetch("/api/aws/amplify/logs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ appId, branchName, jobId, region }),
      });
      const data = await res.json();
      if (!res.ok) {
        setDrawerError(data?.error ?? `HTTP ${res.status}`);
      } else {
        setDrawerData(data);
        setDrawerActiveStep(data.steps?.[0]?.name ?? null);
      }
    } catch (e) {
      setDrawerError((e as Error).message ?? "Unknown error");
    } finally {
      setDrawerLoading(false);
    }
  }

  function handleViewHistory(link: AwsLink, status: AmplifyAppStatus | null) {
    const region = status?.region ?? link.region ?? accountRegion;
    const appId = status?.appId ?? link.resourceId.split("/").pop() ?? "";
    const branchName = status?.productionBranch?.branchName ?? "";
    const name = status?.name ?? link.label;
    setHistoryApp({ appId, branchName, region, name });
    setHistoryOpen(true);
  }

  // Split into amplify / ec2 / ecs / ecs_instance / rds / other
  const amplifyLinks = links.filter((l) => l.service === "amplify");
  const ec2Links = links.filter((l) => l.service === "ec2");
  const ecsLinks = links.filter((l) => l.service === "ecs");
  const ecsInstanceLinks = links.filter((l) => l.service === "ecs_instance");
  const rdsLinks = links.filter((l) => l.service === "rds");
  const otherLinks = links.filter(
    (l) => l.service !== "amplify" && l.service !== "ec2" && l.service !== "ecs" && l.service !== "ecs_instance" && l.service !== "rds"
  );
  const otherGrouped = otherLinks.reduce<Record<string, AwsLink[]>>((acc, link) => {
    (acc[link.service] ??= []).push(link);
    return acc;
  }, {});

  if (!isAwsConnected) {
    return (
      <div className="flex flex-col items-center justify-center py-20 gap-4">
        <div className="w-14 h-14 rounded-2xl bg-[#1A1208] border border-[rgba(255,153,0,0.12)] flex items-center justify-center">
          <AwsLogoMini />
        </div>
        <div className="text-center">
          <p className="text-sm font-semibold text-[#F0F0F0]">AWS not connected</p>
          <p className="text-xs text-[#606060] mt-1">Connect your AWS account to link deployment resources to this repo.</p>
        </div>
        <a
          href="/integrations/aws"
          className="flex items-center gap-1.5 text-xs px-4 py-2 rounded-lg font-semibold bg-[#FF9900] text-black hover:bg-[#FFB347] transition-all"
        >
          <Plug2 size={13} />
          Go to AWS Integration
        </a>
      </div>
    );
  }

  if (links.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-20 gap-4">
        <div className="w-14 h-14 rounded-2xl bg-[#1A1A1A] border border-[rgba(255,255,255,0.06)] flex items-center justify-center">
          <Cloud size={24} className="text-[#404040]" />
        </div>
        <div className="text-center">
          <p className="text-sm font-semibold text-[#F0F0F0]">No resources linked</p>
          <p className="text-xs text-[#606060] mt-1">
            Link EC2 instances, Amplify apps, ECS clusters, and more from the AWS integration.
          </p>
        </div>
        <a
          href="/integrations/aws"
          className="flex items-center gap-1.5 text-xs px-4 py-2 rounded-lg font-medium text-[#FF9900] border border-[rgba(255,153,0,0.2)] hover:bg-[rgba(255,153,0,0.06)] transition-all"
        >
          <Plug2 size={13} />
          Manage in AWS Integration
        </a>
      </div>
    );
  }

  return (
    <>
      <AmplifyHistoryDrawer
        open={historyOpen}
        onClose={() => setHistoryOpen(false)}
        appName={historyApp?.name ?? ""}
        branchName={historyApp?.branchName ?? ""}
        appId={historyApp?.appId ?? ""}
        region={historyApp?.region ?? ""}
      />
      <AmplifyLogsDrawer
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        appName={drawerApp?.name ?? ""}
        branchName={drawerApp?.branchName ?? ""}
        loading={drawerLoading}
        data={drawerData}
        activeStep={drawerActiveStep}
        onStepChange={setDrawerActiveStep}
        error={drawerError}
      />
      <EcsDrawer
        open={ecsDrawerOpen}
        onClose={() => setEcsDrawerOpen(false)}
        status={ecsDrawerLink ? (ecsStatus[ecsDrawerLink.resourceId] ?? null) : null}
        link={ecsDrawerLink}
        accountRegion={accountRegion}
      />
    <div className="space-y-6">
      {/* Header strip */}
      <div className="flex items-center justify-between">
        <p className="text-xs text-[#606060]">
          {links.length} linked resource{links.length !== 1 ? "s" : ""}
        </p>
        <a
          href="/integrations/aws"
          className="flex items-center gap-1 text-xs text-[#606060] hover:text-[#FF9900] transition-colors"
        >
          <Plug2 size={11} />
          Manage
        </a>
      </div>

      {/* Amplify apps */}
      {amplifyLinks.length > 0 && (
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold uppercase tracking-wide text-[#FF9900]">Amplify App</span>
            <span className="text-xs text-[#FF9900] bg-[rgba(255,153,0,0.1)] px-1.5 py-0.5 rounded-full font-bold">{amplifyLinks.length}</span>
          </div>
          <div className="space-y-3">
            {amplifyLinks.map((link) => (
              <AmplifyCard
                key={link.id}
                link={link}
                status={amplifyStatus[link.resourceId] ?? null}
                loading={amplifyLoading && !amplifyStatus[link.resourceId]}
                onDelete={handleDelete}
                deleting={deletingId === link.id}
                accountRegion={accountRegion}
                onViewLogs={() => handleViewLogs(link, amplifyStatus[link.resourceId] ?? null)}
                onViewHistory={() => handleViewHistory(link, amplifyStatus[link.resourceId] ?? null)}
              />
            ))}
          </div>
        </div>
      )}

      {/* EC2 instances */}
      {ec2Links.length > 0 && (
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <Server size={13} className="text-[#60A5FA]" />
            <span className="text-xs font-semibold uppercase tracking-wide text-[#60A5FA]">EC2 Instance</span>
            <span className="text-xs text-[#60A5FA] bg-[rgba(96,165,250,0.1)] px-1.5 py-0.5 rounded-full font-bold">{ec2Links.length}</span>
          </div>
          <div className="space-y-3">
            {ec2Links.map((link) => (
              <Ec2InstanceCard
                key={link.id}
                link={link}
                status={ec2Status[link.resourceId] ?? null}
                loading={ec2Loading && !ec2Status[link.resourceId]}
                onDelete={handleDelete}
                deleting={deletingId === link.id}
                accountRegion={accountRegion}
              />
            ))}
          </div>
        </div>
      )}

      {/* ECS clusters */}
      {ecsLinks.length > 0 && (
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <Layers size={13} className="text-[#38BDF8]" />
            <span className="text-xs font-semibold uppercase tracking-wide text-[#38BDF8]">ECS Cluster</span>
            <span className="text-xs text-[#38BDF8] bg-[rgba(56,189,248,0.1)] px-1.5 py-0.5 rounded-full font-bold">{ecsLinks.length}</span>
          </div>
          <div className="space-y-3">
            {ecsLinks.map((link) => (
              <EcsCard
                key={link.id}
                link={link}
                status={ecsStatus[link.resourceId] ?? null}
                loading={ecsLoading && !ecsStatus[link.resourceId]}
                onDelete={handleDelete}
                deleting={deletingId === link.id}
                accountRegion={accountRegion}
                onViewDetails={() => { setEcsDrawerLink(link); setEcsDrawerOpen(true); }}
              />
            ))}
          </div>
        </div>
      )}

      {/* ECS instances */}
      {ecsInstanceLinks.length > 0 && (
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <Server size={13} className="text-[#7DD3FC]" />
            <span className="text-xs font-semibold uppercase tracking-wide text-[#7DD3FC]">ECS Instance</span>
            <span className="text-xs text-[#7DD3FC] bg-[rgba(125,211,252,0.1)] px-1.5 py-0.5 rounded-full font-bold">{ecsInstanceLinks.length}</span>
          </div>
          <div className="space-y-3">
            {ecsInstanceLinks.map((link) => (
              <EcsInstanceCard
                key={link.id}
                link={link}
                status={ecsInstanceStatus[link.resourceId] ?? null}
                loading={ecsInstanceLoading && !ecsInstanceStatus[link.resourceId]}
                onDelete={handleDelete}
                deleting={deletingId === link.id}
                accountRegion={accountRegion}
              />
            ))}
          </div>
        </div>
      )}

      {/* RDS databases */}
      {rdsLinks.length > 0 && (
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <Database size={13} className="text-[#818CF8]" />
            <span className="text-xs font-semibold uppercase tracking-wide text-[#818CF8]">RDS Database</span>
            <span className="text-xs text-[#818CF8] bg-[rgba(129,140,248,0.1)] px-1.5 py-0.5 rounded-full font-bold">{rdsLinks.length}</span>
          </div>
          <div className="space-y-3">
            {rdsLinks.map((link) => (
              <RdsCard
                key={link.id}
                link={link}
                status={rdsStatus[link.resourceId] ?? null}
                loading={rdsLoading && !rdsStatus[link.resourceId]}
                onDelete={handleDelete}
                deleting={deletingId === link.id}
                accountRegion={accountRegion}
              />
            ))}
          </div>
        </div>
      )}

      {/* Other AWS resources */}
      {Object.entries(otherGrouped).map(([service, serviceLinks]) => {
        const meta = AWS_SERVICE_META[service] ?? AWS_SERVICE_META.other;
        const Icon = meta.icon;
        return (
          <div key={service} className="space-y-2">
            <div className="flex items-center gap-2">
              <Icon size={13} className={meta.color} />
              <span className={`text-xs font-semibold uppercase tracking-wide ${meta.color}`}>{meta.label}</span>
              <span className={`text-xs font-bold px-1.5 py-0.5 rounded-full ${meta.color} ${meta.bg}`}>{serviceLinks.length}</span>
            </div>
            <div className="bg-[#111111] border border-[rgba(255,255,255,0.06)] rounded-2xl divide-y divide-[rgba(255,255,255,0.04)]">
              {serviceLinks.map((link) => (
                <div key={link.id} className="flex items-center justify-between gap-3 px-4 py-3 group">
                  <div className="min-w-0">
                    <div className="text-sm font-medium text-[#F0F0F0]">{link.label}</div>
                    <div className="flex items-center gap-2 mt-0.5">
                      <code className="text-xs text-[#606060] font-mono truncate">{link.resourceId}</code>
                      {(link.region ?? accountRegion) && (
                        <span className="text-[10px] text-[#404040] flex-shrink-0">{link.region ?? accountRegion}</span>
                      )}
                    </div>
                  </div>
                  <button
                    onClick={() => handleDelete(link.id)}
                    disabled={deletingId === link.id}
                    title="Remove link"
                    className="flex-shrink-0 p-1.5 rounded-lg text-[#404040] hover:text-[#EF4444] hover:bg-[rgba(239,68,68,0.08)] opacity-0 group-hover:opacity-100 disabled:opacity-50 transition-all"
                  >
                    {deletingId === link.id ? (
                      <span className="inline-block w-3 h-3 border border-[#606060] border-t-transparent rounded-full animate-spin" />
                    ) : (
                      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <polyline points="3 6 5 6 21 6" /><path d="M19 6l-1 14H6L5 6" /><path d="M10 11v6M14 11v6" /><path d="M9 6V4h6v2" />
                      </svg>
                    )}
                  </button>
                </div>
              ))}
            </div>
          </div>
        );
      })}
    </div>
    </>
  );
}

function AwsLogoMini() {
  return (
    <svg viewBox="0 0 80 48" fill="none" className="w-8 h-5" aria-label="AWS">
      <path
        d="M22.4 19.2c0 .8.1 1.4.2 1.9.2.4.4.9.7 1.4.1.2.2.4.2.5 0 .2-.1.4-.4.7l-1.3.9c-.2.1-.4.2-.5.2-.2 0-.4-.1-.6-.3-.3-.3-.5-.6-.7-1-.2-.4-.4-.8-.6-1.4-1.4 1.7-3.2 2.5-5.3 2.5-1.5 0-2.7-.4-3.6-1.3-.9-.9-1.3-2-1.3-3.4 0-1.5.5-2.7 1.6-3.7 1.1-.9 2.5-1.4 4.3-1.4.6 0 1.2.1 1.8.2.7.1 1.3.3 2 .5v-1.3c0-1.3-.3-2.3-.8-2.8-.6-.5-1.5-.8-2.9-.8-.6 0-1.3.1-1.9.3-.7.2-1.3.4-1.9.7-.3.1-.5.2-.6.2-.2 0-.3-.2-.3-.5V11c0-.3 0-.5.1-.6.1-.1.3-.3.6-.4.6-.3 1.3-.6 2.2-.8.9-.2 1.8-.3 2.8-.3 2.1 0 3.7.5 4.6 1.5.9 1 1.4 2.5 1.4 4.5v5.8zm-7.3 2.7c.6 0 1.2-.1 1.8-.4.6-.3 1.1-.7 1.5-1.4.3-.4.4-.9.5-1.4.1-.5.1-1 .1-1.7v-.8c-.5-.1-1-.2-1.6-.3-.5-.1-1-.1-1.5-.1-1.1 0-1.9.2-2.4.7-.5.4-.8 1.1-.8 1.9 0 .8.2 1.4.6 1.8.4.4 1 .7 1.8.7zm12.8 1.7c-.3 0-.5-.1-.7-.2-.1-.1-.3-.4-.4-.8l-4-13.2c-.1-.4-.2-.7-.2-.8 0-.3.2-.5.5-.5h2c.3 0 .6.1.7.2.2.1.3.4.4.8l2.9 11.3 2.7-11.3c.1-.4.2-.7.4-.8.2-.1.4-.2.8-.2h1.6c.3 0 .6.1.8.2.2.1.3.4.4.8l2.7 11.4 3-11.4c.1-.4.3-.7.4-.8.2-.1.4-.2.7-.2h1.9c.3 0 .5.2.5.5 0 .1 0 .2-.1.4 0 .2-.1.3-.2.5l-4.1 13.2c-.1.4-.3.7-.4.8-.2.1-.4.2-.7.2h-1.7c-.3 0-.6-.1-.8-.2-.2-.1-.3-.4-.4-.8L34 12.9l-2.6 10.7c-.1.4-.2.7-.4.8-.2.1-.4.2-.8.2h-2.3zM53 24c-.7 0-1.4-.1-2.1-.3-.7-.2-1.2-.4-1.6-.6-.2-.1-.4-.3-.4-.5V21c0-.3.1-.5.4-.5.1 0 .2 0 .3.1l.5.2c.6.3 1.2.5 1.9.6.7.1 1.3.2 1.9.2 1 0 1.8-.2 2.3-.5.5-.4.8-.9.8-1.5 0-.4-.1-.8-.4-1.1-.3-.3-.9-.6-1.7-.9l-2.4-.8c-1.2-.4-2.1-.9-2.7-1.7-.6-.7-.9-1.6-.9-2.5 0-.7.2-1.4.5-1.9.3-.6.8-1.1 1.4-1.5.6-.4 1.2-.7 2-.9.7-.2 1.5-.3 2.3-.3.4 0 .8 0 1.3.1.4.1.8.2 1.2.3.4.1.7.2.9.4.3.1.5.3.6.4.1.2.2.4.2.6v1.5c0 .3-.1.5-.4.5-.1 0-.3-.1-.6-.2-1-.5-2.1-.7-3.3-.7-.9 0-1.7.2-2.1.5-.5.3-.7.8-.7 1.4 0 .4.2.8.5 1.1.3.3.9.6 1.9.9l2.3.8c1.2.4 2 .9 2.6 1.6.6.7.8 1.5.8 2.4 0 .7-.1 1.4-.4 2-.3.6-.7 1.1-1.3 1.5-.6.4-1.2.7-2 .9-.8.2-1.7.3-2.6.3z"
        fill="#FF9900"
      />
      <path d="M52.5 32.1c-7.5 5.5-18.3 8.5-27.6 8.5-13.1 0-24.8-4.8-33.7-12.8-.7-.6-.1-1.5.8-1 9.6 5.6 21.4 8.9 33.6 8.9 8.2 0 17.3-1.7 25.6-5.2 1.3-.5 2.3.8 1.3 1.6z" fill="#FF9900" />
      <path d="M55.7 28.5c-.9-1.2-6.2-.6-8.6-.3-.7.1-.8-.5-.2-.9 4.2-2.9 11.1-2.1 11.9-1.1.8 1-.2 7.9-4.1 11.2-.6.5-1.2.2-.9-.4.9-2.1 2.9-7.3 1.9-8.5z" fill="#FF9900" />
    </svg>
  );
}
