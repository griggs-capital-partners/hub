"use client";

import { useMemo, useState } from "react";
import { motion } from "framer-motion";
import {
  ChevronRight,
  FileText,
  Folder,
  FolderOpen,
  Plus,
  RefreshCw,
  Search,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface GitTreeItem {
  path: string;
  type: "blob" | "tree";
  sha: string;
}

export type DraftState = "saved" | "new" | "deleted";

interface FileNode {
  name: string;
  path: string;
  type: "file" | "dir";
  sha: string;
  children: FileNode[];
  draftState?: DraftState;
}

function buildTree(items: GitTreeItem[], drafts: Record<string, DraftState>): FileNode[] {
  const root: FileNode[] = [];
  const map = new Map<string, FileNode>();
  const paths = new Map<string, GitTreeItem>();

  for (const item of items) {
    paths.set(item.path, item);
  }

  for (const path of Object.keys(drafts)) {
    if (paths.has(path)) continue;
    const parts = path.split("/");

    for (let i = 1; i < parts.length; i += 1) {
      const dirPath = parts.slice(0, i).join("/");
      if (!paths.has(dirPath)) {
        paths.set(dirPath, { path: dirPath, type: "tree", sha: `draft-dir:${dirPath}` });
      }
    }

    paths.set(path, {
      path,
      type: "blob",
      sha: `draft-file:${path}`,
    });
  }

  for (const item of paths.values()) {
    const parts = item.path.split("/");
    const name = parts[parts.length - 1];
    map.set(item.path, {
      name,
      path: item.path,
      type: item.type === "tree" ? "dir" : "file",
      sha: item.sha,
      children: [],
      draftState: drafts[item.path],
    });
  }

  for (const item of paths.values()) {
    const node = map.get(item.path);
    if (!node) continue;

    const parts = item.path.split("/");
    if (parts.length === 1) {
      root.push(node);
      continue;
    }

    const parent = map.get(parts.slice(0, -1).join("/"));
    if (parent) parent.children.push(node);
  }

  function sortNodes(nodes: FileNode[]) {
    nodes.sort((a, b) => {
      if (a.type !== b.type) return a.type === "dir" ? -1 : 1;
      return a.name.localeCompare(b.name);
    });

    for (const node of nodes) sortNodes(node.children);
  }

  sortNodes(root);
  return root;
}

function collectAncestorPaths(paths: string[]) {
  const ancestors = new Set<string>();

  for (const path of paths) {
    const parts = path.split("/");
    for (let i = 1; i < parts.length; i += 1) {
      ancestors.add(parts.slice(0, i).join("/"));
    }
  }

  return ancestors;
}

function filterTree(nodes: FileNode[], query: string): FileNode[] {
  if (!query.trim()) return nodes;

  const needle = query.toLowerCase();

  return nodes.flatMap((node) => {
    const nameMatch = node.name.toLowerCase().includes(needle);
    if (node.type === "file") return nameMatch ? [node] : [];

    const filteredChildren = filterTree(node.children, query);
    if (nameMatch || filteredChildren.length > 0) {
      return [{ ...node, children: filteredChildren }];
    }

    return [];
  });
}

function DraftBadge({ state }: { state?: DraftState }) {
  if (!state) return null;

  const styles =
    state === "deleted"
      ? "text-red-300 bg-red-500/10 border-red-500/20"
      : state === "new"
        ? "text-emerald-300 bg-emerald-500/10 border-emerald-500/20"
        : "text-amber-300 bg-amber-500/10 border-amber-500/20";

  const label = state === "deleted" ? "Deleted" : state === "new" ? "New" : "Saved";

  return (
    <span className={cn("rounded-full border px-1.5 py-0.5 text-[9px] uppercase tracking-[0.18em]", styles)}>
      {label}
    </span>
  );
}

interface TreeNodeProps {
  node: FileNode;
  depth: number;
  forceOpen: boolean;
  openDirs: Set<string>;
  selectedPath: string | null;
  selectedType: "file" | "dir" | null;
  onSelect: (node: FileNode) => void;
  onToggle: (path: string) => void;
}

function TreeNode({ node, depth, forceOpen, openDirs, selectedPath, selectedType, onSelect, onToggle }: TreeNodeProps) {
  const isSelected = selectedPath === node.path && selectedType === node.type;
  const displayName = node.type === "file" ? node.name.replace(/\.md$/, "") : node.name;
  const isOpen = forceOpen || openDirs.has(node.path);

  if (node.type === "dir") {
    return (
      <div className="relative">
        <button
          onClick={() => {
            onSelect(node);
            onToggle(node.path);
          }}
          className={cn(
            "group flex w-full items-center gap-2 rounded-xl px-2.5 py-2 text-left text-sm transition-all",
            isSelected
              ? "bg-[rgba(255,255,255,0.06)] text-[#F5F5F5] shadow-[inset_0_0_0_1px_rgba(255,255,255,0.06)]"
              : "text-[#A7A7A7] hover:bg-[rgba(255,255,255,0.05)] hover:text-[#F5F5F5]"
          )}
          style={{ marginLeft: depth === 0 ? 0 : 4 }}
        >
          <motion.div animate={{ rotate: isOpen ? 90 : 0 }} transition={{ duration: 0.15 }}>
            <ChevronRight size={13} className="flex-shrink-0 text-[#5B5B5B]" />
          </motion.div>
          {isOpen ? (
            <FolderOpen size={15} className="flex-shrink-0 text-[#F6A63A]" />
          ) : (
            <Folder size={15} className="flex-shrink-0 text-[#C88728]" />
          )}
          <span className="truncate font-medium">{displayName}</span>
        </button>

        {isOpen && (
          <div className="ml-4 border-l border-[rgba(255,255,255,0.08)] pl-2">
            {node.children.map((child) => (
              <TreeNode
                key={child.path}
                node={child}
                depth={depth + 1}
                forceOpen={forceOpen}
                openDirs={openDirs}
                selectedPath={selectedPath}
                selectedType={selectedType}
                onSelect={onSelect}
                onToggle={onToggle}
              />
            ))}
            {node.children.length === 0 && (
              <div className="px-3 py-1.5 text-xs text-[#4B4B4B]">empty</div>
            )}
          </div>
        )}
      </div>
    );
  }

  return (
    <button
      onClick={() => onSelect(node)}
      className={cn(
        "relative flex w-full items-center gap-2 rounded-xl px-3 py-2 text-left text-sm transition-all",
        isSelected
          ? "bg-[linear-gradient(90deg,rgba(247,148,29,0.18),rgba(247,148,29,0.08))] text-[#FFD39A] shadow-[inset_0_0_0_1px_rgba(247,148,29,0.18)]"
          : "text-[#B5B5B5] hover:bg-[rgba(255,255,255,0.05)] hover:text-[#F5F5F5]"
      )}
      style={{ marginLeft: depth === 0 ? 0 : 4 }}
    >
      {isSelected && <div className="absolute left-0 top-2 bottom-2 w-0.5 rounded-r bg-[#F7941D]" />}
      <FileText
        size={14}
        className={cn(
          "flex-shrink-0",
          node.draftState === "deleted" ? "text-red-300" : node.draftState ? "text-[#F6A63A]" : "text-[#7A7A7A]"
        )}
      />
      <span className={cn("min-w-0 flex-1 truncate", node.draftState === "deleted" && "line-through opacity-70")}>
        {displayName}
      </span>
      <DraftBadge state={node.draftState} />
    </button>
  );
}

interface FileTreeProps {
  items: GitTreeItem[];
  drafts: Record<string, DraftState>;
  selectedPath: string | null;
  selectedType: "file" | "dir" | null;
  loading: boolean;
  onSelect: (node: { path: string; sha: string; type: "file" | "dir" }) => void;
  onNewFile: () => void;
  onNewFolder: () => void;
  onRefresh: () => void;
}

export function FileTree({
  items,
  drafts,
  selectedPath,
  selectedType,
  loading,
  onSelect,
  onNewFile,
  onNewFolder,
  onRefresh,
}: FileTreeProps) {
  const [query, setQuery] = useState("");
  const tree = useMemo(() => buildTree(items, drafts), [items, drafts]);

  const autoOpen = useMemo(
    () => collectAncestorPaths([selectedPath ?? "", ...Object.keys(drafts)]),
    [drafts, selectedPath]
  );

  const [manualOpenDirs, setManualOpenDirs] = useState<Set<string>>(() => {
    const initial = new Set<string>();
    for (const node of tree) {
      if (node.type === "dir") initial.add(node.path);
    }
    return initial;
  });

  const openDirs = useMemo(() => {
    const next = new Set(manualOpenDirs);
    for (const path of autoOpen) next.add(path);
    for (const node of tree) {
      if (node.type === "dir" && node.path.split("/").length === 1) next.add(node.path);
    }
    return next;
  }, [autoOpen, manualOpenDirs, tree]);

  const filteredTree = useMemo(() => filterTree(tree, query), [tree, query]);
  const documentCount = items.filter((item) => item.type === "blob").length + Object.values(drafts).filter((state) => state === "new").length;
  const changeCount = Object.keys(drafts).length;

  function handleSelect(node: FileNode) {
    onSelect({ path: node.path, sha: node.sha, type: node.type });
  }

  function toggleDir(path: string) {
    setManualOpenDirs((current) => {
      const next = new Set(current);
      if (next.has(path)) next.delete(path);
      else next.add(path);
      return next;
    });
  }

  return (
    <div className="flex h-full flex-col bg-[radial-gradient(circle_at_top,rgba(247,148,29,0.07),transparent_32%),#0B0B0B]">
      <div className="border-b border-[rgba(255,255,255,0.06)] px-4 py-3">
        <div className="mb-3 flex items-start justify-between gap-3">
          <div>
            <div className="text-[10px] font-semibold uppercase tracking-[0.22em] text-[#6A6A6A]">Knowledge Map</div>
            <div className="mt-1 text-xs text-[#8A8A8A]">
              {documentCount} docs
              {changeCount > 0 ? ` · ${changeCount} saved change${changeCount === 1 ? "" : "s"}` : ""}
            </div>
          </div>
          <div className="flex items-center gap-1">
            <button
              onClick={onRefresh}
              disabled={loading}
              className="rounded-lg p-1.5 text-[#6A6A6A] transition-colors hover:text-[#F0F0F0]"
              title="Refresh"
            >
              <RefreshCw size={13} className={cn(loading && "animate-spin")} />
            </button>
            <button
              onClick={onNewFolder}
              className="rounded-lg p-1.5 text-[#6A6A6A] transition-colors hover:text-[#F7941D]"
              title="New folder"
            >
              <Folder size={15} />
            </button>
            <button
              onClick={onNewFile}
              className="rounded-lg p-1.5 text-[#6A6A6A] transition-colors hover:text-[#F7941D]"
              title="New document"
            >
              <Plus size={15} />
            </button>
          </div>
        </div>

        <label className="flex items-center gap-2 rounded-xl border border-[rgba(255,255,255,0.07)] bg-[rgba(255,255,255,0.03)] px-3 py-2">
          <Search size={13} className="text-[#5F5F5F]" />
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search files and folders"
            className="w-full bg-transparent text-sm text-[#E8E8E8] placeholder:text-[#5F5F5F] focus:outline-none"
          />
        </label>
      </div>

      <div className="flex-1 overflow-y-auto px-2 py-3">
        {loading ? (
          <div className="space-y-2 px-2">
            {[72, 84, 66, 78, 70, 88, 63].map((width, index) => (
              <div
                key={index}
                className="h-8 animate-pulse rounded-xl bg-[rgba(255,255,255,0.04)]"
                style={{ width: `${width}%` }}
              />
            ))}
          </div>
        ) : filteredTree.length === 0 ? (
          <div className="px-3 py-10 text-center">
            <div className="text-sm text-[#727272]">Nothing matches</div>
            <div className="mt-1 text-xs text-[#4B4B4B]">Try a different term or create a new document.</div>
          </div>
        ) : (
          <div className="space-y-1">
            {filteredTree.map((node) => (
              <TreeNode
                key={node.path}
                node={node}
                depth={0}
                forceOpen={Boolean(query.trim())}
                openDirs={openDirs}
                selectedPath={selectedPath}
                selectedType={selectedType}
                onSelect={handleSelect}
                onToggle={toggleDir}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
