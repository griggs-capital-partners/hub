"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { motion } from "framer-motion";
import {
  AlertTriangle,
  BookOpen,
  CheckCircle2,
  Edit3,
  Eye,
  FolderPlus,
  FilePlus,
  GitBranch,
  Library,
  Link2,
  Loader2,
  Save,
  Share2,
  Upload,
  X,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { ConnectRepoDialog } from "./ConnectRepoDialog";
import { type DraftState, FileTree } from "./FileTree";
import { MarkdownViewer } from "./MarkdownViewer";

interface KnowledgeRepo {
  id: string;
  repoOwner: string;
  repoName: string;
  branch: string;
  description: string | null;
}

interface GitTreeItem {
  path: string;
  type: "blob" | "tree";
  sha: string;
}

interface DraftFile {
  path: string;
  content: string | null;
  sha: string | null;
  kind: DraftState;
  savedAt: number;
}

type KnowledgeSelection =
  | { type: "file"; path: string; sha: string | null }
  | { type: "dir"; path: string };

interface StatusMessage {
  tone: "success" | "error" | "info";
  text: string;
}

interface Props {
  initialRepo: KnowledgeRepo | null;
}

function draftStorageKey(repo: KnowledgeRepo) {
  return `knowledge-drafts:${repo.repoOwner}/${repo.repoName}:${repo.branch}`;
}

function defaultCommitMessage(count: number) {
  return count === 1 ? "docs: update knowledge file" : `docs: update ${count} knowledge files`;
}

function CommitDialog({
  defaultMessage,
  files,
  onCommit,
  onCancel,
  saving,
}: {
  defaultMessage: string;
  files: DraftFile[];
  onCommit: (message: string) => void;
  onCancel: () => void;
  saving: boolean;
}) {
  const [message, setMessage] = useState(defaultMessage);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
      <motion.div
        initial={{ opacity: 0, scale: 0.96 }}
        animate={{ opacity: 1, scale: 1 }}
        className="w-full max-w-lg overflow-hidden rounded-2xl border border-[rgba(255,255,255,0.08)] bg-[#101010] shadow-2xl"
      >
        <div className="border-b border-[rgba(255,255,255,0.06)] px-5 py-4">
          <h3 className="text-sm font-semibold text-[#F0F0F0]">Commit Changes</h3>
          <p className="mt-0.5 text-xs text-[#717171]">This will publish every saved draft to your knowledge repo.</p>
        </div>

        <div className="space-y-4 p-5">
          <textarea
            value={message}
            onChange={(event) => setMessage(event.target.value)}
            rows={3}
            className="w-full resize-none rounded-xl border border-[rgba(255,255,255,0.08)] bg-[rgba(255,255,255,0.04)] px-3 py-2.5 text-sm text-[#F0F0F0] focus:border-[rgba(247,148,29,0.4)] focus:outline-none"
            placeholder="docs: update knowledge base"
          />

          <div className="rounded-xl border border-[rgba(255,255,255,0.06)] bg-[rgba(255,255,255,0.02)] p-3">
            <div className="mb-2 text-[10px] font-semibold uppercase tracking-[0.22em] text-[#676767]">
              {files.length} file{files.length === 1 ? "" : "s"} ready
            </div>
            <div className="max-h-52 space-y-2 overflow-y-auto pr-1">
              {files.map((file) => (
                <div key={file.path} className="flex items-center justify-between gap-3 rounded-lg px-2 py-1.5 text-xs">
                  <span className="truncate font-mono text-[#CFCFCF]">{file.path}</span>
                  <span
                    className={cn(
                      "rounded-full border px-2 py-0.5 uppercase tracking-[0.16em]",
                      file.kind === "deleted"
                        ? "border-red-500/20 bg-red-500/10 text-red-300"
                        : file.kind === "new"
                          ? "border-emerald-500/20 bg-emerald-500/10 text-emerald-300"
                          : "border-amber-500/20 bg-amber-500/10 text-amber-300"
                    )}
                  >
                    {file.kind}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="flex items-center justify-end gap-3 border-t border-[rgba(255,255,255,0.06)] px-5 py-4">
          <button
            onClick={onCancel}
            className="px-4 py-2 text-sm text-[#A0A0A0] transition-colors hover:text-[#F0F0F0]"
          >
            Cancel
          </button>
          <button
            onClick={() => onCommit(message)}
            disabled={!message.trim() || saving}
            className={cn(
              "flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-medium transition-all",
              message.trim() && !saving
                ? "bg-[#F7941D] text-white hover:bg-[#e8851a]"
                : "cursor-not-allowed bg-[rgba(255,255,255,0.06)] text-[#606060]"
            )}
          >
            {saving ? <Loader2 size={14} className="animate-spin" /> : <Upload size={14} />}
            Commit Changes
          </button>
        </div>
      </motion.div>
    </div>
  );
}

function NewFileDialog({
  title,
  description,
  placeholder,
  confirmLabel,
  appendMarkdownExtension = true,
  onCreate,
  onCancel,
}: {
  title: string;
  description: string;
  placeholder: string;
  confirmLabel: string;
  appendMarkdownExtension?: boolean;
  onCreate: (path: string) => void;
  onCancel: () => void;
}) {
  const [path, setPath] = useState("");

  const normalized = appendMarkdownExtension
    ? path.trim().replace(/\.md$/, "") + ".md"
    : path.trim().replace(/^\/+|\/+$/g, "");

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
      <motion.div
        initial={{ opacity: 0, scale: 0.96 }}
        animate={{ opacity: 1, scale: 1 }}
        className="w-full max-w-md overflow-hidden rounded-2xl border border-[rgba(255,255,255,0.08)] bg-[#111111] shadow-2xl"
      >
        <div className="border-b border-[rgba(255,255,255,0.06)] px-5 py-4">
          <h3 className="text-sm font-semibold text-[#F0F0F0]">{title}</h3>
          <p className="mt-0.5 text-xs text-[#6B6B6B]">{description}</p>
        </div>

        <div className="p-5">
          <input
            autoFocus
            type="text"
            value={path}
            onChange={(event) => setPath(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter" && path.trim()) onCreate(normalized);
              if (event.key === "Escape") onCancel();
            }}
            className="w-full rounded-xl border border-[rgba(255,255,255,0.08)] bg-[rgba(255,255,255,0.04)] px-3 py-2.5 text-sm text-[#F0F0F0] focus:border-[rgba(247,148,29,0.4)] focus:outline-none"
            placeholder={placeholder}
          />
          {path.trim() && (
            <p className="mt-2 text-xs text-[#686868]">
              Will create: <span className="font-mono text-[#AFAFAF]">{normalized}</span>
            </p>
          )}
        </div>

        <div className="flex items-center justify-end gap-3 border-t border-[rgba(255,255,255,0.06)] px-5 py-4">
          <button
            onClick={onCancel}
            className="px-4 py-2 text-sm text-[#A0A0A0] transition-colors hover:text-[#F0F0F0]"
          >
            Cancel
          </button>
          <button
            onClick={() => onCreate(normalized)}
            disabled={!path.trim()}
            className={cn(
              "flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-medium transition-all",
              path.trim()
                ? "bg-[#F7941D] text-white hover:bg-[#e8851a]"
                : "cursor-not-allowed bg-[rgba(255,255,255,0.06)] text-[#606060]"
            )}
          >
            <FilePlus size={14} />
            {confirmLabel}
          </button>
        </div>
      </motion.div>
    </div>
  );
}

export function KnowledgeClient({ initialRepo }: Props) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [repo, setRepo] = useState<KnowledgeRepo | null>(initialRepo);
  const [connectOpen, setConnectOpen] = useState(false);

  const [tree, setTree] = useState<GitTreeItem[]>([]);
  const [treeLoading, setTreeLoading] = useState(false);

  const [selection, setSelection] = useState<KnowledgeSelection | null>(null);
  const [selectedPath, setSelectedPath] = useState<string | null>(null);
  const [selectedSha, setSelectedSha] = useState<string | null>(null);
  const [content, setContent] = useState<string | null>(null);
  const [contentLoading, setContentLoading] = useState(false);

  const [isEditing, setIsEditing] = useState(false);
  const [editContent, setEditContent] = useState("");
  const [drafts, setDrafts] = useState<Record<string, DraftFile>>({});

  const [commitOpen, setCommitOpen] = useState(false);
  const [newFileOpen, setNewFileOpen] = useState(false);
  const [newFolderOpen, setNewFolderOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState<StatusMessage | null>(null);
  const sharedPath = searchParams.get("path");

  const syncUrlSelection = useCallback((path: string | null) => {
    const params = new URLSearchParams(searchParams.toString());
    if (path) params.set("path", path);
    else params.delete("path");

    const nextUrl = params.toString() ? `${pathname}?${params.toString()}` : pathname;
    router.replace(nextUrl, { scroll: false });
  }, [pathname, router, searchParams]);

  const fetchTree = useCallback(async (targetRepo: KnowledgeRepo) => {
    setTreeLoading(true);
    try {
      const response = await fetch(
        `/api/knowledge/tree?owner=${targetRepo.repoOwner}&repo=${targetRepo.repoName}&branch=${targetRepo.branch}&t=${Date.now()}`,
        { cache: "no-store" }
      );

      if (!response.ok) throw new Error("Failed to fetch tree");

      const data = await response.json();
      setTree(data.tree ?? []);
    } catch {
      setTree([]);
      setStatus({ tone: "error", text: "I couldn't load the knowledge tree right now." });
    } finally {
      setTreeLoading(false);
    }
  }, []);

  const fetchFile = useCallback(
    async (path: string, overrideRepo?: KnowledgeRepo | null) => {
      const activeRepo = overrideRepo ?? repo;
      if (!activeRepo) return;

      setContentLoading(true);
      try {
        const response = await fetch(
          `/api/knowledge/file?owner=${activeRepo.repoOwner}&repo=${activeRepo.repoName}&path=${encodeURIComponent(path)}&branch=${activeRepo.branch}&t=${Date.now()}`,
          { cache: "no-store" }
        );

        if (!response.ok) throw new Error("Not found");

        const data = await response.json();
        setContent(data.content);
        setSelectedSha(data.sha);
      } catch {
        setContent(null);
        setSelectedSha(null);
      } finally {
        setContentLoading(false);
      }
    },
    [repo]
  );

  useEffect(() => {
    if (repo) fetchTree(repo);
  }, [fetchTree, repo]);

  useEffect(() => {
    if (!repo) {
      setDrafts({});
      return;
    }

    const raw = window.localStorage.getItem(draftStorageKey(repo));
    if (!raw) {
      setDrafts({});
      return;
    }

    try {
      const parsed = JSON.parse(raw) as Record<string, DraftFile>;
      setDrafts(parsed);
    } catch {
      setDrafts({});
    }
  }, [repo]);

  useEffect(() => {
    if (!repo) return;
    window.localStorage.setItem(draftStorageKey(repo), JSON.stringify(drafts));
  }, [drafts, repo]);

  const draftStatusMap = useMemo<Record<string, DraftState>>(() => {
    return Object.fromEntries(Object.values(drafts).map((draft) => [draft.path, draft.kind]));
  }, [drafts]);

  const draftEntries = useMemo(
    () => Object.values(drafts).sort((a, b) => a.path.localeCompare(b.path)),
    [drafts]
  );

  const activeDraft = selectedPath ? drafts[selectedPath] : null;
  const displayContent = activeDraft && activeDraft.kind !== "deleted" ? activeDraft.content ?? "" : content;
  const draftBaseline = activeDraft && activeDraft.kind !== "deleted" ? activeDraft.content ?? "" : content ?? "";
  const pendingCount = draftEntries.length;
  const breadcrumbs = selectedPath ? selectedPath.split("/") : [];
  const selectedType = selection?.type ?? null;
  const selectedDirPath = selection?.type === "dir" ? selection.path : null;

  function clearStatusSoon(nextStatus: StatusMessage) {
    setStatus(nextStatus);
    window.setTimeout(() => {
      setStatus((current) => (current === nextStatus ? null : current));
    }, 3500);
  }

  const handleSelectNode = useCallback(async (node: { path: string; sha: string; type: "file" | "dir" }) => {
    if (node.type === "dir") {
      setSelection({ type: "dir", path: node.path });
      setSelectedPath(node.path);
      setSelectedSha(null);
      setContent(null);
      setContentLoading(false);
      setIsEditing(false);
      syncUrlSelection(null);
      return;
    }

    const { path, sha } = node;
    setSelection({ type: "file", path, sha: sha.startsWith("draft-") ? null : sha });
    setSelectedPath(path);
    setSelectedSha(sha.startsWith("draft-") ? null : sha);
    setIsEditing(false);
    syncUrlSelection(path);

    const draft = drafts[path];
    if (draft?.kind === "new") {
      setContent(null);
      setSelectedSha(null);
      return;
    }

    await fetchFile(path);
  }, [drafts, fetchFile, syncUrlSelection]);

  useEffect(() => {
    if (!repo || !sharedPath || treeLoading || tree.length === 0) return;
    if (selectedPath === sharedPath) return;

    const match = tree.find((item) => item.type === "blob" && item.path === sharedPath);
    if (!match) return;

    void handleSelectNode({ path: match.path, sha: match.sha, type: "file" });
  }, [handleSelectNode, repo, selectedPath, sharedPath, tree, treeLoading]);

  function handleStartEdit() {
    setEditContent(displayContent ?? "");
    setIsEditing(true);
  }

  function handleCancelEdit() {
    setIsEditing(false);
    setEditContent("");
  }

  function handleSaveDraft() {
    if (!selectedPath || selection?.type !== "file") return;

    const nextKind: DraftState = activeDraft?.kind === "new" || !selectedSha ? "new" : "saved";
    const nextDraft: DraftFile = {
      path: selectedPath,
      content: editContent,
      sha: selectedSha,
      kind: nextKind,
      savedAt: Date.now(),
    };

    setDrafts((current) => ({ ...current, [selectedPath]: nextDraft }));
    setIsEditing(false);
    clearStatusSoon({
      tone: "success",
      text: pendingCount === 0
        ? "Draft saved locally. You can keep editing other files before committing."
        : "Draft updated locally. Your changes are still waiting to be committed.",
    });
  }

  function handleStageDelete() {
    if (!selectedPath || selection?.type !== "file") return;

    if (!selectedSha && activeDraft?.kind === "new") {
      setDrafts((current) => {
        const next = { ...current };
        delete next[selectedPath];
        return next;
      });
      setSelection(null);
      setSelectedPath(null);
      setSelectedSha(null);
      setContent(null);
      syncUrlSelection(null);
      clearStatusSoon({ tone: "info", text: "Removed the uncommitted draft file." });
      return;
    }

    setDrafts((current) => ({
      ...current,
      [selectedPath]: {
        path: selectedPath,
        content: null,
        sha: selectedSha,
        kind: "deleted",
        savedAt: Date.now(),
      },
    }));
    setIsEditing(false);
    clearStatusSoon({ tone: "info", text: "Deletion saved locally. It will happen when you commit changes." });
  }

  function handleRestoreDraft() {
    if (!selectedPath || !activeDraft || selection?.type !== "file") return;

    if (activeDraft.kind === "new") {
      setIsEditing(true);
      setEditContent(activeDraft.content ?? "");
      return;
    }

    setDrafts((current) => {
      const next = { ...current };
      delete next[selectedPath];
      return next;
    });
    clearStatusSoon({ tone: "success", text: "Restored the committed version of this file." });
  }

  async function handleCommit(message: string) {
    if (!repo || draftEntries.length === 0) return;

    setSaving(true);
    try {
      const response = await fetch("/api/knowledge/commit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          owner: repo.repoOwner,
          repo: repo.repoName,
          branch: repo.branch,
          message,
          files: draftEntries.map((draft) => ({
            path: draft.path,
            content: draft.content ?? undefined,
            sha: draft.sha,
            delete: draft.kind === "deleted",
          })),
        }),
      });

      if (!response.ok) {
        const data = await response.json().catch(() => null);
        throw new Error(data?.error ?? "Commit failed");
      }

      const data = await response.json();

      setCommitOpen(false);
      setDrafts({});
      await fetchTree(repo);

      if (selection?.type === "file" && selectedPath && drafts[selectedPath]?.kind !== "deleted") {
        await fetchFile(selectedPath, repo);
      } else if (selection?.type === "file" && selectedPath && drafts[selectedPath]?.kind === "deleted") {
        setSelection(null);
        setSelectedPath(null);
        setSelectedSha(null);
        setContent(null);
      }

      clearStatusSoon({
        tone: "success",
        text:
          data?.mode === "per_file_commits"
            ? `Published ${draftEntries.length} knowledge change${draftEntries.length === 1 ? "" : "s"} to ${repo.repoName} using your token's compatibility mode.`
            : `Committed ${draftEntries.length} knowledge change${draftEntries.length === 1 ? "" : "s"} to ${repo.repoName}.`,
      });
    } catch (error) {
      clearStatusSoon({
        tone: "error",
        text:
          error instanceof Error
            ? `${error.message}. Your saved drafts are still here locally.`
            : "The commit did not go through. Your saved drafts are still here locally.",
      });
    } finally {
      setSaving(false);
    }
  }

  function handleNewFile(path: string) {
    const title = path.split("/").pop()?.replace(/\.md$/, "") ?? "New Document";
    const template = `# ${title}\n\n`;

    setNewFileOpen(false);
    setSelection({ type: "file", path, sha: null });
    setSelectedPath(path);
    setSelectedSha(null);
    setContent(null);
    setEditContent(template);
    setIsEditing(true);
    setDrafts((current) => ({
      ...current,
      [path]: {
        path,
        content: template,
        sha: null,
        kind: "new",
        savedAt: Date.now(),
      },
    }));
    clearStatusSoon({ tone: "info", text: "New document created as a local draft. Save when you're ready." });
  }

  function handleNewFolder(path: string) {
    const normalizedFolder = path.trim().replace(/^\/+|\/+$/g, "");
    if (!normalizedFolder) return;

    const folderDocPath = `${normalizedFolder}/README.md`;
    const title = normalizedFolder.split("/").pop() ?? "New Folder";
    const template = `# ${title}\n\n`;

    setNewFolderOpen(false);
    setDrafts((current) => ({
      ...current,
      [folderDocPath]: {
        path: folderDocPath,
        content: template,
        sha: null,
        kind: "new",
        savedAt: Date.now(),
      },
    }));
    setSelection({ type: "file", path: folderDocPath, sha: null });
    setSelectedPath(folderDocPath);
    setSelectedSha(null);
    setContent(null);
    setEditContent(template);
    setIsEditing(true);
    clearStatusSoon({ tone: "info", text: `Folder draft created at ${normalizedFolder}. Commit to make it live.` });
  }

  function handleDeleteFolder(path: string) {
    const prefix = `${path}/`;
    const repoFiles = tree.filter((item) => item.type === "blob" && item.path.startsWith(prefix));
    const draftFiles = Object.values(drafts).filter((draft) => draft.path.startsWith(prefix));

    const nextDrafts = { ...drafts };

    for (const draft of draftFiles) {
      if (draft.kind === "new" && !draft.sha) delete nextDrafts[draft.path];
      else {
        nextDrafts[draft.path] = {
          ...draft,
          content: null,
          kind: "deleted",
          savedAt: Date.now(),
        };
      }
    }

    for (const file of repoFiles) {
      if (!nextDrafts[file.path]) {
        nextDrafts[file.path] = {
          path: file.path,
          content: null,
          sha: file.sha,
          kind: "deleted",
          savedAt: Date.now(),
        };
      }
    }

    setDrafts(nextDrafts);
    setSelection(null);
    setSelectedPath(null);
    setSelectedSha(null);
    setContent(null);
    syncUrlSelection(null);
    setIsEditing(false);
    clearStatusSoon({ tone: "info", text: `Folder deletion saved locally for ${path}. Commit to make it live.` });
  }

  async function handleShareDocument() {
    if (!selectedPath || selection?.type !== "file") return;

    try {
      const shareUrl = new URL(window.location.href);
      shareUrl.searchParams.set("path", selectedPath);
      await navigator.clipboard.writeText(shareUrl.toString());
      clearStatusSoon({ tone: "success", text: "Share link copied to your clipboard." });
    } catch {
      clearStatusSoon({ tone: "error", text: "I couldn't copy the share link right now." });
    }
  }

  async function handleConnect(owner: string, name: string, branch: string, description?: string) {
    const response = await fetch("/api/knowledge/repo", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ repoOwner: owner, repoName: name, branch, description }),
    });

    if (!response.ok) {
      clearStatusSoon({ tone: "error", text: "I couldn't connect that repository." });
      return;
    }

    const data = await response.json();
    setRepo(data.repo);
    setStatus(null);
  }

  async function handleDisconnect() {
    await fetch("/api/knowledge/repo", { method: "DELETE" });
    setRepo(null);
    setTree([]);
    setSelection(null);
    setSelectedPath(null);
    setSelectedSha(null);
    setContent(null);
    setDrafts({});
    setIsEditing(false);
    syncUrlSelection(null);
  }

  if (!repo) {
    return (
      <div className="flex min-h-[70vh] flex-col items-center justify-center gap-6">
        <div className="flex h-20 w-20 items-center justify-center rounded-2xl border border-[rgba(247,148,29,0.15)] bg-[rgba(247,148,29,0.08)]">
          <BookOpen size={36} className="text-[#F7941D]/60" />
        </div>
        <div className="text-center">
          <h2 className="mb-2 text-xl font-semibold text-[#F0F0F0]">Knowledge Base</h2>
          <p className="max-w-sm text-sm leading-relaxed text-[#606060]">
            Connect an Obsidian or documentation repository to browse, edit, save drafts, and commit changes without leaving the hub.
          </p>
        </div>
        <button
          onClick={() => setConnectOpen(true)}
          className="flex items-center gap-2 rounded-xl bg-[#F7941D] px-5 py-2.5 text-sm font-medium text-white transition-colors hover:bg-[#e8851a]"
        >
          <Link2 size={16} />
          Connect Repository
        </button>
        <ConnectRepoDialog
          open={connectOpen}
          currentRepo={null}
          onClose={() => setConnectOpen(false)}
          onConnect={handleConnect}
          onDisconnect={handleDisconnect}
        />
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col">
      <div className="mb-4 flex items-start justify-between gap-4">
        <div>
          <h1 className="flex items-center gap-3 text-2xl font-black text-[#F0F0F0]">
            <Library size={22} className="text-[#F7941D]" />
            Knowledge Docs
          </h1>
          <div className="mt-0.5 flex items-center gap-1.5">
            <GitBranch size={12} className="text-[#606060]" />
            <span className="text-xs text-[#606060]">
              {repo.repoOwner}/{repo.repoName}
            </span>
            <span className="text-xs text-[#404040]">·</span>
            <span className="text-xs text-[#606060]">{repo.branch}</span>
          </div>
          <p className="mt-2 text-sm text-[#737373]">
            Save drafts locally across multiple files, then commit the whole batch when it looks right.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setCommitOpen(true)}
            disabled={pendingCount === 0 || saving}
            className={cn(
              "flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-medium transition-all",
              pendingCount > 0 && !saving
                ? "bg-[#F7941D] text-white hover:bg-[#e8851a]"
                : "cursor-not-allowed border border-[rgba(255,255,255,0.08)] text-[#606060]"
            )}
          >
            {saving ? <Loader2 size={14} className="animate-spin" /> : <Upload size={14} />}
            Commit Changes
            {pendingCount > 0 && (
              <span className="rounded-full bg-black/20 px-2 py-0.5 text-[11px]">{pendingCount}</span>
            )}
          </button>
          <button
            onClick={() => setConnectOpen(true)}
            className="flex items-center gap-1.5 rounded-xl border border-[rgba(255,255,255,0.08)] px-3 py-2 text-xs text-[#9A9A9A] transition-all hover:border-[rgba(255,255,255,0.15)] hover:text-[#F0F0F0]"
          >
            <Link2 size={12} />
            Change Repo
          </button>
        </div>
      </div>

      {status && (
        <div
          className={cn(
            "mb-4 flex items-center gap-2 rounded-xl border px-4 py-3 text-sm",
            status.tone === "success" && "border-emerald-500/20 bg-emerald-500/10 text-emerald-200",
            status.tone === "error" && "border-red-500/20 bg-red-500/10 text-red-200",
            status.tone === "info" && "border-[rgba(247,148,29,0.18)] bg-[rgba(247,148,29,0.08)] text-[#FFD6A6]"
          )}
        >
          {status.tone === "success" ? (
            <CheckCircle2 size={16} />
          ) : status.tone === "error" ? (
            <AlertTriangle size={16} />
          ) : (
            <Save size={16} />
          )}
          <span>{status.text}</span>
        </div>
      )}

      <div className="flex min-h-0 flex-1 gap-4 overflow-hidden">
        <div className="w-72 flex-shrink-0 overflow-hidden rounded-2xl border border-[rgba(255,255,255,0.06)]">
          <FileTree
            items={tree}
            drafts={draftStatusMap}
            selectedPath={selectedPath}
            selectedType={selectedType}
            loading={treeLoading}
            onSelect={handleSelectNode}
            onNewFile={() => setNewFileOpen(true)}
            onNewFolder={() => setNewFolderOpen(true)}
            onRefresh={() => fetchTree(repo)}
          />
        </div>

        <div className="flex min-w-0 flex-1 flex-col overflow-hidden rounded-2xl border border-[rgba(255,255,255,0.06)] bg-[radial-gradient(circle_at_top,rgba(255,255,255,0.03),transparent_38%),#0D0D0D]">
          {selectedPath && selection?.type === "file" ? (
            <>
              <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[rgba(255,255,255,0.06)] px-5 py-3">
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-1 text-xs text-[#666666]">
                    {breadcrumbs.map((crumb, index) => (
                      <span key={`${crumb}-${index}`} className="min-w-0 truncate">
                        {index > 0 && <span className="mx-1 text-[#444444]">/</span>}
                        <span className={index === breadcrumbs.length - 1 ? "font-medium text-[#F0F0F0]" : ""}>
                          {index === breadcrumbs.length - 1 ? crumb.replace(/\.md$/, "") : crumb}
                        </span>
                      </span>
                    ))}
                  </div>
                  {activeDraft && (
                    <div className="mt-1 text-xs text-[#8A8A8A]">
                      {activeDraft.kind === "deleted"
                        ? "This file is staged for deletion."
                        : activeDraft.kind === "new"
                          ? "This file exists as a local draft until you commit it."
                          : "This file has saved local changes waiting to be committed."}
                    </div>
                  )}
                </div>

                <div className="flex items-center gap-2">
                  {isEditing ? (
                    <>
                      <button
                        onClick={handleCancelEdit}
                        className="flex items-center gap-1.5 rounded-xl border border-[rgba(255,255,255,0.08)] px-3 py-2 text-xs text-[#9A9A9A] transition-all hover:text-[#F0F0F0]"
                      >
                        <X size={12} />
                        Cancel
                      </button>
                      <button
                        onClick={handleSaveDraft}
                        disabled={editContent === draftBaseline}
                        className={cn(
                          "flex items-center gap-1.5 rounded-xl px-3 py-2 text-xs font-medium transition-colors",
                          editContent !== draftBaseline
                            ? "bg-[#F7941D] text-white hover:bg-[#e8851a]"
                            : "cursor-not-allowed bg-[rgba(255,255,255,0.06)] text-[#606060]"
                        )}
                      >
                        <Save size={12} />
                        Save Draft
                      </button>
                    </>
                  ) : (
                    <>
                      <button
                        onClick={handleShareDocument}
                        disabled={contentLoading}
                        className="flex items-center gap-1.5 rounded-xl border border-[rgba(255,255,255,0.08)] px-3 py-2 text-xs text-[#9A9A9A] transition-all hover:border-[rgba(255,255,255,0.15)] hover:text-[#F0F0F0] disabled:cursor-not-allowed disabled:opacity-40"
                      >
                        <Share2 size={12} />
                        Share
                      </button>
                      {activeDraft?.kind === "deleted" ? (
                        <button
                          onClick={handleRestoreDraft}
                          className="rounded-xl border border-[rgba(255,255,255,0.08)] px-3 py-2 text-xs text-[#9A9A9A] transition-all hover:text-[#F0F0F0]"
                        >
                          Restore
                        </button>
                      ) : (
                        <button
                          onClick={handleStageDelete}
                          className="rounded-xl border border-red-500/20 bg-red-500/5 px-3 py-2 text-xs text-red-300 transition-all hover:bg-red-500/10"
                        >
                          Delete
                        </button>
                      )}
                      <button
                        onClick={handleStartEdit}
                        disabled={activeDraft?.kind === "deleted" || contentLoading}
                        className="flex items-center gap-1.5 rounded-xl border border-[rgba(255,255,255,0.08)] px-3 py-2 text-xs text-[#9A9A9A] transition-all hover:border-[rgba(255,255,255,0.15)] hover:text-[#F0F0F0] disabled:cursor-not-allowed disabled:opacity-40"
                      >
                        <Edit3 size={12} />
                        Edit
                      </button>
                    </>
                  )}
                </div>
              </div>

              <div className="flex-1 overflow-y-auto">
                {contentLoading && !activeDraft ? (
                  <div className="flex h-40 items-center justify-center">
                    <Loader2 size={20} className="animate-spin text-[#606060]" />
                  </div>
                ) : activeDraft?.kind === "deleted" ? (
                  <div className="mx-auto flex max-w-xl flex-col items-center justify-center gap-4 px-8 py-20 text-center">
                    <div className="flex h-14 w-14 items-center justify-center rounded-2xl border border-red-500/15 bg-red-500/5">
                      <AlertTriangle size={22} className="text-red-300" />
                    </div>
                    <div>
                      <p className="text-base font-medium text-[#F3D4D4]">Deletion is staged</p>
                      <p className="mt-2 text-sm leading-relaxed text-[#8D8D8D]">
                        This file will be removed from the repository the next time you commit changes. You can restore it before then.
                      </p>
                    </div>
                  </div>
                ) : isEditing ? (
                  <div className="flex h-full flex-col">
                    <textarea
                      value={editContent}
                      onChange={(event) => setEditContent(event.target.value)}
                      className="flex-1 w-full resize-none bg-transparent p-6 font-mono text-sm leading-relaxed text-[#D0D0D0] focus:outline-none"
                      spellCheck={false}
                      placeholder="Start writing in Markdown..."
                    />
                  </div>
                ) : displayContent !== null ? (
                  <div className="mx-auto w-full max-w-4xl p-6">
                    <MarkdownViewer content={displayContent} />
                  </div>
                ) : (
                  <div className="flex h-40 items-center justify-center">
                    <p className="text-sm text-[#606060]">Failed to load document</p>
                  </div>
                )}
              </div>

              <div className="flex items-center justify-between border-t border-[rgba(255,255,255,0.06)] px-5 py-2 text-[11px] text-[#4E4E4E]">
                <span>{isEditing ? "Editing markdown" : activeDraft ? "Showing saved local draft" : "Showing committed version"}</span>
                <span>
                  {(isEditing ? editContent : displayContent ?? "").split("\n").length} lines · {(isEditing ? editContent : displayContent ?? "").length} chars
                </span>
              </div>
            </>
          ) : selectedDirPath ? (
            <div className="flex h-full flex-col justify-center gap-5 p-8">
              <div className="flex h-16 w-16 items-center justify-center rounded-2xl border border-[rgba(255,255,255,0.06)] bg-[rgba(255,255,255,0.03)]">
                <FolderPlus size={26} className="text-[#C88728]" />
              </div>
              <div>
                <p className="text-lg font-medium text-[#EDEDED]">{selectedDirPath}</p>
                <p className="mt-2 max-w-xl text-sm leading-relaxed text-[#7B7B7B]">
                  Create a document inside this folder, create a nested folder, or stage the whole folder for deletion.
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-3">
                <button
                  onClick={() => {
                    setNewFileOpen(true);
                  }}
                  className="flex items-center gap-1.5 rounded-xl border border-[rgba(247,148,29,0.2)] px-4 py-2 text-sm text-[#F7941D] transition-all hover:bg-[rgba(247,148,29,0.05)]"
                >
                  <FilePlus size={14} />
                  New Document
                </button>
                <button
                  onClick={() => {
                    setNewFolderOpen(true);
                  }}
                  className="flex items-center gap-1.5 rounded-xl border border-[rgba(255,255,255,0.08)] px-4 py-2 text-sm text-[#CFCFCF] transition-all hover:bg-[rgba(255,255,255,0.05)]"
                >
                  <FolderPlus size={14} />
                  New Folder
                </button>
                <button
                  onClick={() => handleDeleteFolder(selectedDirPath)}
                  className="rounded-xl border border-red-500/20 bg-red-500/5 px-4 py-2 text-sm text-red-300 transition-all hover:bg-red-500/10"
                >
                  Delete Folder
                </button>
              </div>
            </div>
          ) : (
            <div className="flex h-full flex-col items-center justify-center gap-4 p-8 text-center">
              <div className="flex h-16 w-16 items-center justify-center rounded-2xl border border-[rgba(255,255,255,0.06)] bg-[rgba(255,255,255,0.03)]">
                <Eye size={26} className="text-[#4C4C4C]" />
              </div>
              <div>
                <p className="text-sm text-[#7A7A7A]">Select a document from the knowledge map</p>
                <p className="mt-1 text-xs text-[#4A4A4A]">or create a draft and start editing here</p>
              </div>
              <button
                onClick={() => setNewFileOpen(true)}
                className="flex items-center gap-1.5 rounded-xl border border-[rgba(247,148,29,0.2)] px-3 py-2 text-xs text-[#F7941D] transition-all hover:bg-[rgba(247,148,29,0.05)]"
              >
                <FilePlus size={14} />
                New Document
              </button>
            </div>
          )}
        </div>
      </div>

      <ConnectRepoDialog
        open={connectOpen}
        currentRepo={repo}
        onClose={() => setConnectOpen(false)}
        onConnect={handleConnect}
        onDisconnect={handleDisconnect}
      />

      {commitOpen && (
        <CommitDialog
          defaultMessage={defaultCommitMessage(pendingCount)}
          files={draftEntries}
          onCommit={handleCommit}
          onCancel={() => setCommitOpen(false)}
          saving={saving}
        />
      )}

      {newFolderOpen && (
        <NewFileDialog
          title="New Folder"
          description="Create a folder by seeding it with a README.md document."
          placeholder={selectedDirPath ? `${selectedDirPath}/New Folder` : "Folder Name"}
          confirmLabel="Create Folder"
          appendMarkdownExtension={false}
          onCreate={(path) => {
            const finalPath =
              selectedDirPath && !path.startsWith(`${selectedDirPath}/`) && !path.includes("/")
                ? `${selectedDirPath}/${path}`
                : path;
            handleNewFolder(finalPath);
          }}
          onCancel={() => setNewFolderOpen(false)}
        />
      )}
      {newFileOpen && (
        <NewFileDialog
          title="New Document"
          description="Use slashes for nested paths, like `Projects/Portal/README`."
          placeholder={selectedDirPath ? `${selectedDirPath}/Document Name` : "Folder/Document Name"}
          confirmLabel="Create"
          onCreate={(path) => {
            const finalPath =
              selectedDirPath && !path.startsWith(`${selectedDirPath}/`) && !path.includes("/")
                ? `${selectedDirPath}/${path}`
                : path;
            handleNewFile(finalPath);
          }}
          onCancel={() => setNewFileOpen(false)}
        />
      )}
    </div>
  );
}
