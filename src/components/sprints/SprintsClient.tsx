"use client";

import { useState, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Zap,
  Plus,
  CheckCircle2,
  Circle,
  Clock,
  AlertTriangle,
  X,
  MessageSquare,
  Shield,
  Trash2,
  CalendarDays,
  Target,
  TrendingUp,
  BarChart3,
  Flame,
  ExternalLink,
  Edit3,
  GitBranch,
  FolderGit2,
  User as UserIcon,
} from "lucide-react";
import { AddKanbanTaskModal } from "./AddKanbanTaskModal";
import { cn } from "@/lib/utils";
import { Avatar } from "@/components/ui/Avatar";
import { Badge } from "@/components/ui/Badge";

// ─── Types ────────────────────────────────────────────────────────────────────

type User = {
  id: string;
  name: string | null;
  displayName: string | null;
  email: string;
  image: string | null;
};

type KanbanCardRef = {
  id: string;
  title: string;
  priority: string;
  column: { name: string; board: { repo: { id: string; name: string } | null } };
};

type SprintTask = {
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
  kanbanCard: KanbanCardRef | null;
};

type SprintComment = {
  id: string;
  sprintId: string;
  authorId: string;
  body: string;
  type: string;
  createdAt: string;
  author: User;
};

type Sprint = {
  id: string;
  name: string;
  goal: string | null;
  status: string;
  startDate: string;
  endDate: string;
  velocity: number | null;
  createdAt: string;
  updatedAt: string;
  tasks: SprintTask[];
  comments: SprintComment[];
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

const PRIORITY_CONFIG = {
  critical: { label: "Critical", color: "#EF4444", bg: "rgba(239,68,68,0.15)" },
  high:     { label: "High",     color: "#F97316", bg: "rgba(249,115,22,0.15)" },
  medium:   { label: "Medium",   color: "#FBBA00", bg: "rgba(251,186,0,0.15)" },
  low:      { label: "Low",      color: "#22C55E", bg: "rgba(34,197,94,0.15)" },
};

const STATUS_CONFIG = {
  "todo":        { label: "To Do",       icon: Circle,        color: "#606060" },
  "in-progress": { label: "In Progress", icon: Clock,         color: "#F7941D" },
  "done":        { label: "Done",        icon: CheckCircle2,  color: "#22C55E" },
  "blocked":     { label: "Blocked",     icon: AlertTriangle, color: "#EF4444" },
};

const COMMENT_TYPE_CONFIG = {
  comment:  { icon: MessageSquare, color: "#9A9A9A", label: "Comment" },
  blocker:  { icon: Flame,         color: "#EF4444", label: "Blocker" },
  decision: { icon: Shield,        color: "#6366F1", label: "Decision" },
};

function daysRemaining(endDate: string) {
  const end = new Date(endDate);
  const now = new Date();
  const diff = Math.ceil((end.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
  return diff;
}

function sprintProgress(startDate: string, endDate: string) {
  const start = new Date(startDate).getTime();
  const end = new Date(endDate).getTime();
  const now = Date.now();
  if (now <= start) return 0;
  if (now >= end) return 100;
  return Math.round(((now - start) / (end - start)) * 100);
}

function formatDate(d: string) {
  return new Date(d).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

function formatRelative(d: string) {
  const diff = Date.now() - new Date(d).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

function sprintHealth(sprint: Sprint) {
  const done = sprint.tasks.filter((t) => t.status === "done").length;
  const total = sprint.tasks.length;
  if (total === 0) return "neutral";
  const taskPct = done / total;
  const timePct = sprintProgress(sprint.startDate, sprint.endDate) / 100;
  if (timePct === 0) return "neutral";
  const ratio = taskPct / timePct;
  if (ratio >= 0.85) return "on-track";
  if (ratio >= 0.6) return "at-risk";
  return "behind";
}

const HEALTH_CONFIG = {
  "on-track": { label: "On Track",  color: "#22C55E", bg: "rgba(34,197,94,0.12)"  },
  "at-risk":  { label: "At Risk",   color: "#FBBA00", bg: "rgba(251,186,0,0.12)"  },
  "behind":   { label: "Behind",    color: "#EF4444", bg: "rgba(239,68,68,0.12)"  },
  "neutral":  { label: "Planning",  color: "#9A9A9A", bg: "rgba(154,154,154,0.12)" },
};

// ─── Sub-components ───────────────────────────────────────────────────────────

function ProgressBar({ value, color = "#F7941D", className }: { value: number; color?: string; className?: string }) {
  return (
    <div className={cn("h-1.5 bg-[rgba(255,255,255,0.06)] rounded-full overflow-hidden", className)}>
      <motion.div
        className="h-full rounded-full"
        style={{ backgroundColor: color }}
        initial={{ width: 0 }}
        animate={{ width: `${Math.min(100, Math.max(0, value))}%` }}
        transition={{ duration: 0.8, ease: "easeOut" }}
      />
    </div>
  );
}

function TaskRow({
  task,
  users,
  onStatusChange,
  onAssigneeChange,
  onDelete,
}: {
  task: SprintTask;
  users: User[];
  onStatusChange: (taskId: string, status: string) => void;
  onAssigneeChange: (taskId: string, assigneeId: string | null) => void;
  onDelete: (taskId: string) => void;
}) {
  const [showAssigneeMenu, setShowAssigneeMenu] = useState(false);
  const statusCfg = STATUS_CONFIG[task.status as keyof typeof STATUS_CONFIG] ?? STATUS_CONFIG.todo;
  const priorityCfg = PRIORITY_CONFIG[task.priority as keyof typeof PRIORITY_CONFIG] ?? PRIORITY_CONFIG.medium;
  const StatusIcon = statusCfg.icon;

  const nextStatus: Record<string, string> = {
    todo: "in-progress",
    "in-progress": "done",
    done: "todo",
    blocked: "in-progress",
  };

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 4 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, x: -10 }}
      className={cn(
        "group flex items-center gap-3 px-3 py-2.5 rounded-lg border transition-all",
        task.status === "done"
          ? "border-[rgba(34,197,94,0.12)] bg-[rgba(34,197,94,0.04)]"
          : task.status === "blocked"
          ? "border-[rgba(239,68,68,0.15)] bg-[rgba(239,68,68,0.04)]"
          : "border-[rgba(255,255,255,0.05)] hover:border-[rgba(247,148,29,0.2)] bg-[rgba(255,255,255,0.02)]"
      )}
    >
      <div className="relative group/assignee">
        <button
          onClick={() => setShowAssigneeMenu(!showAssigneeMenu)}
          className={cn(
            "flex-shrink-0 transition-transform hover:scale-110",
            !task.assigneeId && "opacity-40 grayscale"
          )}
        >
          <Avatar
            src={task.assignee?.image}
            name={task.assignee?.displayName ?? task.assignee?.name ?? "U"}
            size="xs"
            className="ring-1 ring-[rgba(255,255,255,0.1)]"
          />
        </button>

        <AnimatePresence>
          {showAssigneeMenu && (
            <>
              <div
                className="fixed inset-0 z-[60]"
                onClick={() => setShowAssigneeMenu(false)}
              />
              <motion.div
                initial={{ opacity: 0, scale: 0.95, y: 8 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95, y: 8 }}
                className="absolute left-0 bottom-full mb-2 z-[70] w-48 bg-[#1A1A1A] border border-[rgba(255,255,255,0.1)] rounded-xl shadow-2xl overflow-hidden py-1"
              >
                <p className="px-3 py-1.5 text-[10px] font-bold text-[#606060] uppercase tracking-wider">Assign to</p>
                <div className="max-h-48 overflow-y-auto">
                  <button
                    onClick={() => {
                      onAssigneeChange(task.id, null);
                      setShowAssigneeMenu(false);
                    }}
                    className={cn(
                      "w-full flex items-center gap-2 px-3 py-2 text-xs text-left transition-colors",
                      !task.assigneeId ? "text-[#F7941D] bg-[rgba(247,148,29,0.1)]" : "text-[#9A9A9A] hover:bg-[rgba(255,255,255,0.04)] hover:text-[#F0F0F0]"
                    )}
                  >
                    <div className="w-5 h-5 rounded-full bg-[rgba(255,255,255,0.06)] flex items-center justify-center">
                      <UserIcon size={10} />
                    </div>
                    Unassigned
                  </button>
                  {users.map((u) => (
                    <button
                      key={u.id}
                      onClick={() => {
                        onAssigneeChange(task.id, u.id);
                        setShowAssigneeMenu(false);
                      }}
                      className={cn(
                        "w-full flex items-center gap-2 px-3 py-2 text-xs text-left transition-colors",
                        task.assigneeId === u.id ? "text-[#F7941D] bg-[rgba(247,148,29,0.1)]" : "text-[#9A9A9A] hover:bg-[rgba(255,255,255,0.04)] hover:text-[#F0F0F0]"
                      )}
                    >
                      <Avatar src={u.image} name={u.displayName ?? u.name} size="xs" />
                      <span className="truncate">{u.displayName ?? u.name}</span>
                    </button>
                  ))}
                </div>
              </motion.div>
            </>
          )}
        </AnimatePresence>
      </div>

      <button
        onClick={() => onStatusChange(task.id, nextStatus[task.status] ?? "todo")}
        className="flex-shrink-0 transition-transform hover:scale-110"
      >
        <StatusIcon size={15} style={{ color: statusCfg.color }} />
      </button>

      <div className="flex-1 min-w-0">
        <span
          className={cn(
            "text-sm leading-snug",
            task.status === "done" ? "line-through text-[#606060]" : "text-[#E0E0E0]"
          )}
        >
          {task.title}
        </span>
        {task.kanbanCard && (
          <div className="flex items-center gap-1 mt-0.5">
            <GitBranch size={10} className="text-[#F7941D] flex-shrink-0" />
            <span className="text-xs text-[#606060] truncate">
              {task.kanbanCard.column.board.repo?.name ?? "General"} · {task.kanbanCard.column.name}
            </span>
          </div>
        )}
      </div>

      <div className="flex items-center gap-2 opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity">
        {task.storyPoints && (
          <span className="text-xs font-mono text-[#606060] bg-[rgba(255,255,255,0.04)] px-1.5 py-0.5 rounded">
            {task.storyPoints}pt
          </span>
        )}
        <Badge
          size="sm"
          color={priorityCfg.color}
          bg={priorityCfg.bg}
        >
          {priorityCfg.label}
        </Badge>
        {task.githubIssueUrl && (
          <a
            href={task.githubIssueUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="text-[#606060] hover:text-[#F7941D] transition-colors"
          >
            <ExternalLink size={12} />
          </a>
        )}
        <button
          onClick={() => onDelete(task.id)}
          className="text-[#606060] hover:text-[#EF4444] transition-colors"
        >
          <Trash2 size={12} />
        </button>
      </div>

      {task.storyPoints && (
        <span className="hidden sm:inline text-xs font-mono text-[#606060] bg-[rgba(255,255,255,0.04)] px-1.5 py-0.5 rounded group-hover:opacity-0 transition-opacity">
          {task.storyPoints}pt
        </span>
      )}
    </motion.div>
  );
}


function CommentFeed({
  comments,
  onAddComment,
  onDeleteComment,
}: {
  comments: SprintComment[];
  onAddComment: (body: string, type: string) => void;
  onDeleteComment: (id: string) => void;
}) {
  const [body, setBody] = useState("");
  const [type, setType] = useState("comment");

  function handleSubmit() {
    if (!body.trim()) return;
    onAddComment(body.trim(), type);
    setBody("");
    setType("comment");
  }

  return (
    <div className="flex flex-col gap-3 min-w-0 overflow-hidden">
      {/* Type selector + input */}
      <div className="bg-[#111111] border border-[rgba(255,255,255,0.06)] rounded-2xl p-4">
        <div className="flex gap-1.5 mb-3 flex-wrap">
          {(["comment", "blocker", "decision"] as const).map((t) => {
            const cfg = COMMENT_TYPE_CONFIG[t];
            const Icon = cfg.icon;
            return (
              <button
                key={t}
                onClick={() => setType(t)}
                className={cn(
                  "flex items-center gap-1.5 text-xs px-2.5 py-1.5 rounded-lg border transition-all",
                  type === t
                    ? "border-[rgba(255,255,255,0.15)] text-[#F0F0F0] bg-[rgba(255,255,255,0.06)]"
                    : "border-transparent text-[#606060] hover:text-[#9A9A9A]"
                )}
                style={type === t ? { color: cfg.color } : {}}
              >
                <Icon size={12} />
                {cfg.label}
              </button>
            );
          })}
        </div>

        <textarea
          value={body}
          onChange={(e) => setBody(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) handleSubmit();
          }}
          placeholder={
            type === "blocker"
              ? "Describe the blocker…"
              : type === "decision"
              ? "Log a decision…"
              : "Add a comment…"
          }
          rows={3}
          className="w-full bg-[rgba(255,255,255,0.03)] border border-[rgba(255,255,255,0.06)] rounded-lg px-3 py-2.5 text-sm text-[#F0F0F0] placeholder-[#606060] focus:outline-none focus:border-[rgba(247,148,29,0.4)] resize-none transition-colors"
        />

        <div className="flex justify-between items-center mt-2">
          <span className="text-xs text-[#606060]">⌘↵ to post</span>
          <button
            onClick={handleSubmit}
            disabled={!body.trim()}
            className="px-4 py-1.5 text-xs font-semibold bg-[#F7941D] text-black rounded-lg hover:bg-[#FBBA00] disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          >
            Post
          </button>
        </div>
      </div>

      {/* Comment list */}
      <div className="space-y-2">
        <AnimatePresence>
          {comments.map((c) => {
            const cfg = COMMENT_TYPE_CONFIG[c.type as keyof typeof COMMENT_TYPE_CONFIG] ?? COMMENT_TYPE_CONFIG.comment;
            const Icon = cfg.icon;
            return (
              <motion.div
                key={c.id}
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.97 }}
                className="group bg-[#111111] border border-[rgba(255,255,255,0.05)] rounded-xl p-3"
                style={
                  c.type === "blocker"
                    ? { borderColor: "rgba(239,68,68,0.2)", backgroundColor: "rgba(239,68,68,0.04)" }
                    : c.type === "decision"
                    ? { borderColor: "rgba(99,102,241,0.2)", backgroundColor: "rgba(99,102,241,0.04)" }
                    : {}
                }
              >
                <div className="flex items-start gap-2.5">
                  <Avatar src={c.author.image} name={c.author.displayName ?? c.author.name} size="xs" className="mt-0.5 flex-shrink-0" />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-xs font-semibold text-[#F0F0F0]">
                        {c.author.displayName ?? c.author.name}
                      </span>
                      <Icon size={11} style={{ color: cfg.color }} />
                      <span className="text-xs text-[#606060]">{formatRelative(c.createdAt)}</span>
                    </div>
                    <p className="text-sm text-[#C0C0C0] leading-relaxed">{c.body}</p>
                  </div>
                  <button
                    onClick={() => onDeleteComment(c.id)}
                    className="opacity-0 group-hover:opacity-100 text-[#606060] hover:text-[#EF4444] transition-all flex-shrink-0"
                  >
                    <Trash2 size={12} />
                  </button>
                </div>
              </motion.div>
            );
          })}
        </AnimatePresence>
        {comments.length === 0 && (
          <p className="text-xs text-[#606060] text-center py-4">No comments yet</p>
        )}
      </div>
    </div>
  );
}

// ─── Activity Drawer ──────────────────────────────────────────────────────────

function ActivityDrawer({
  comments,
  onAddComment,
  onDeleteComment,
  onClose,
}: {
  comments: SprintComment[];
  onAddComment: (body: string, type: string) => void;
  onDeleteComment: (id: string) => void;
  onClose: () => void;
}) {
  return (
    <>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-40 bg-black/50 backdrop-blur-sm"
        onClick={onClose}
      />
      <motion.div
        initial={{ x: "100%" }}
        animate={{ x: 0 }}
        exit={{ x: "100%" }}
        transition={{ type: "spring", stiffness: 320, damping: 32 }}
        className="fixed right-0 top-0 bottom-0 z-50 w-full sm:w-[400px] bg-[#0D0D0D] border-l border-[rgba(255,255,255,0.08)] flex flex-col shadow-2xl"
      >
        <div className="flex items-center justify-between px-5 py-4 border-b border-[rgba(255,255,255,0.06)] flex-shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-7 h-7 rounded-lg bg-[rgba(99,102,241,0.15)] border border-[rgba(99,102,241,0.2)] flex items-center justify-center">
              <MessageSquare size={13} className="text-[#6366F1]" />
            </div>
            <h2 className="text-sm font-bold text-[#F0F0F0]">Notes & Activity</h2>
            {comments.length > 0 && (
              <span className="text-xs text-[#606060] bg-[rgba(255,255,255,0.06)] px-2 py-0.5 rounded-full">
                {comments.length}
              </span>
            )}
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-[#606060] hover:text-[#F0F0F0] hover:bg-[rgba(255,255,255,0.06)] transition-all"
          >
            <X size={16} />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto overflow-x-hidden p-4 min-w-0">
          <CommentFeed
            comments={comments}
            onAddComment={onAddComment}
            onDeleteComment={onDeleteComment}
          />
        </div>
      </motion.div>
    </>
  );
}

// ─── New Sprint Modal ─────────────────────────────────────────────────────────

function NewSprintModal({
  onClose,
  onSave,
}: {
  onClose: () => void;
  onSave: (data: { name: string; goal: string; startDate: string; endDate: string; velocity: string }) => void;
}) {
  const [name, setName] = useState("");
  const [goal, setGoal] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [velocity, setVelocity] = useState("");

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm"
      onClick={onClose}
    >
      <motion.div
        initial={{ scale: 0.95, opacity: 0, y: 20 }}
        animate={{ scale: 1, opacity: 1, y: 0 }}
        exit={{ scale: 0.95, opacity: 0 }}
        transition={{ type: "spring", stiffness: 300, damping: 30 }}
        className="w-full max-w-md bg-[#111111] border border-[rgba(255,255,255,0.08)] rounded-2xl shadow-2xl p-6"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-[#F7941D] to-[#7B1C24] flex items-center justify-center">
              <Zap size={16} className="text-white" />
            </div>
            <h2 className="text-lg font-bold text-[#F0F0F0]">New Sprint</h2>
          </div>
          <button onClick={onClose} className="text-[#606060] hover:text-[#F0F0F0] transition-colors">
            <X size={18} />
          </button>
        </div>

        <div className="space-y-4">
          <div>
            <label className="text-xs font-semibold text-[#9A9A9A] uppercase tracking-wider">Sprint Name</label>
            <input
              autoFocus
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Sprint 14 – API & Auth"
              className="mt-1.5 w-full bg-[rgba(255,255,255,0.04)] border border-[rgba(255,255,255,0.08)] rounded-xl px-3 py-2.5 text-sm text-[#F0F0F0] placeholder-[#606060] focus:outline-none focus:border-[rgba(247,148,29,0.4)] transition-colors"
            />
          </div>

          <div>
            <label className="text-xs font-semibold text-[#9A9A9A] uppercase tracking-wider">Sprint Goal</label>
            <textarea
              value={goal}
              onChange={(e) => setGoal(e.target.value)}
              placeholder="What does this sprint aim to achieve?"
              rows={2}
              className="mt-1.5 w-full bg-[rgba(255,255,255,0.04)] border border-[rgba(255,255,255,0.08)] rounded-xl px-3 py-2.5 text-sm text-[#F0F0F0] placeholder-[#606060] focus:outline-none focus:border-[rgba(247,148,29,0.4)] transition-colors resize-none"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-semibold text-[#9A9A9A] uppercase tracking-wider">Start Date</label>
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="mt-1.5 w-full bg-[rgba(255,255,255,0.04)] border border-[rgba(255,255,255,0.08)] rounded-xl px-3 py-2.5 text-sm text-[#F0F0F0] focus:outline-none focus:border-[rgba(247,148,29,0.4)] transition-colors [color-scheme:dark]"
              />
            </div>
            <div>
              <label className="text-xs font-semibold text-[#9A9A9A] uppercase tracking-wider">End Date</label>
              <input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="mt-1.5 w-full bg-[rgba(255,255,255,0.04)] border border-[rgba(255,255,255,0.08)] rounded-xl px-3 py-2.5 text-sm text-[#F0F0F0] focus:outline-none focus:border-[rgba(247,148,29,0.4)] transition-colors [color-scheme:dark]"
              />
            </div>
          </div>

          <div>
            <label className="text-xs font-semibold text-[#9A9A9A] uppercase tracking-wider">
              Velocity Target <span className="text-[#606060] normal-case font-normal">(story points)</span>
            </label>
            <input
              type="number"
              value={velocity}
              onChange={(e) => setVelocity(e.target.value)}
              placeholder="e.g. 40"
              className="mt-1.5 w-full bg-[rgba(255,255,255,0.04)] border border-[rgba(255,255,255,0.08)] rounded-xl px-3 py-2.5 text-sm text-[#F0F0F0] placeholder-[#606060] focus:outline-none focus:border-[rgba(247,148,29,0.4)] transition-colors"
            />
          </div>
        </div>

        <div className="flex gap-3 mt-6">
          <button
            onClick={onClose}
            className="flex-1 px-4 py-2.5 text-sm font-semibold text-[#9A9A9A] bg-[rgba(255,255,255,0.04)] hover:bg-[rgba(255,255,255,0.07)] rounded-xl transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={() => {
              if (!name.trim() || !startDate || !endDate) return;
              onSave({ name: name.trim(), goal, startDate, endDate, velocity });
            }}
            disabled={!name.trim() || !startDate || !endDate}
            className="flex-1 px-4 py-2.5 text-sm font-semibold bg-[#F7941D] text-black hover:bg-[#FBBA00] disabled:opacity-40 disabled:cursor-not-allowed rounded-xl transition-colors"
          >
            Create Sprint
          </button>
        </div>
      </motion.div>
    </motion.div>
  );
}

// ─── Edit Sprint Modal ────────────────────────────────────────────────────────

function EditSprintModal({
  sprint,
  onClose,
  onSave,
}: {
  sprint: Sprint;
  onClose: () => void;
  onSave: (data: { name: string; goal: string; startDate: string; endDate: string; velocity: string }) => void;
}) {
  const [name, setName] = useState(sprint.name);
  const [goal, setGoal] = useState(sprint.goal ?? "");
  const toDateInput = (iso: string) => iso.slice(0, 10);
  const [startDate, setStartDate] = useState(toDateInput(sprint.startDate));
  const [endDate, setEndDate] = useState(toDateInput(sprint.endDate));
  const [velocity, setVelocity] = useState(sprint.velocity?.toString() ?? "");

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm"
      onClick={onClose}
    >
      <motion.div
        initial={{ scale: 0.95, opacity: 0, y: 20 }}
        animate={{ scale: 1, opacity: 1, y: 0 }}
        exit={{ scale: 0.95, opacity: 0 }}
        transition={{ type: "spring", stiffness: 300, damping: 30 }}
        className="w-full max-w-md bg-[#111111] border border-[rgba(255,255,255,0.08)] rounded-2xl shadow-2xl p-6"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-[#6366F1] to-[#4338CA] flex items-center justify-center">
              <Edit3 size={16} className="text-white" />
            </div>
            <h2 className="text-lg font-bold text-[#F0F0F0]">Edit Sprint</h2>
          </div>
          <button onClick={onClose} className="text-[#606060] hover:text-[#F0F0F0] transition-colors">
            <X size={18} />
          </button>
        </div>

        <div className="space-y-4">
          <div>
            <label className="text-xs font-semibold text-[#9A9A9A] uppercase tracking-wider">Sprint Name</label>
            <input
              autoFocus
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="mt-1.5 w-full bg-[rgba(255,255,255,0.04)] border border-[rgba(255,255,255,0.08)] rounded-xl px-3 py-2.5 text-sm text-[#F0F0F0] placeholder-[#606060] focus:outline-none focus:border-[rgba(99,102,241,0.5)] transition-colors"
            />
          </div>

          <div>
            <label className="text-xs font-semibold text-[#9A9A9A] uppercase tracking-wider">Sprint Goal</label>
            <textarea
              value={goal}
              onChange={(e) => setGoal(e.target.value)}
              placeholder="What does this sprint aim to achieve?"
              rows={2}
              className="mt-1.5 w-full bg-[rgba(255,255,255,0.04)] border border-[rgba(255,255,255,0.08)] rounded-xl px-3 py-2.5 text-sm text-[#F0F0F0] placeholder-[#606060] focus:outline-none focus:border-[rgba(99,102,241,0.5)] transition-colors resize-none"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-semibold text-[#9A9A9A] uppercase tracking-wider">Start Date</label>
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="mt-1.5 w-full bg-[rgba(255,255,255,0.04)] border border-[rgba(255,255,255,0.08)] rounded-xl px-3 py-2.5 text-sm text-[#F0F0F0] focus:outline-none focus:border-[rgba(99,102,241,0.5)] transition-colors [color-scheme:dark]"
              />
            </div>
            <div>
              <label className="text-xs font-semibold text-[#9A9A9A] uppercase tracking-wider">End Date</label>
              <input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="mt-1.5 w-full bg-[rgba(255,255,255,0.04)] border border-[rgba(255,255,255,0.08)] rounded-xl px-3 py-2.5 text-sm text-[#F0F0F0] focus:outline-none focus:border-[rgba(99,102,241,0.5)] transition-colors [color-scheme:dark]"
              />
            </div>
          </div>

          <div>
            <label className="text-xs font-semibold text-[#9A9A9A] uppercase tracking-wider">
              Velocity Target <span className="text-[#606060] normal-case font-normal">(story points)</span>
            </label>
            <input
              type="number"
              value={velocity}
              onChange={(e) => setVelocity(e.target.value)}
              placeholder="e.g. 40"
              className="mt-1.5 w-full bg-[rgba(255,255,255,0.04)] border border-[rgba(255,255,255,0.08)] rounded-xl px-3 py-2.5 text-sm text-[#F0F0F0] placeholder-[#606060] focus:outline-none focus:border-[rgba(99,102,241,0.5)] transition-colors"
            />
          </div>
        </div>

        <div className="flex gap-3 mt-6">
          <button
            onClick={onClose}
            className="flex-1 px-4 py-2.5 text-sm font-semibold text-[#9A9A9A] bg-[rgba(255,255,255,0.04)] hover:bg-[rgba(255,255,255,0.07)] rounded-xl transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={() => {
              if (!name.trim() || !startDate || !endDate) return;
              onSave({ name: name.trim(), goal, startDate, endDate, velocity });
            }}
            disabled={!name.trim() || !startDate || !endDate}
            className="flex-1 px-4 py-2.5 text-sm font-semibold bg-[#6366F1] text-white hover:bg-[#4F46E5] disabled:opacity-40 disabled:cursor-not-allowed rounded-xl transition-colors"
          >
            Save Changes
          </button>
        </div>
      </motion.div>
    </motion.div>
  );
}

// ─── Delete Confirm Modal ─────────────────────────────────────────────────────

function DeleteConfirmModal({
  sprintName,
  onClose,
  onConfirm,
}: {
  sprintName: string;
  onClose: () => void;
  onConfirm: () => void;
}) {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm"
      onClick={onClose}
    >
      <motion.div
        initial={{ scale: 0.95, opacity: 0, y: 20 }}
        animate={{ scale: 1, opacity: 1, y: 0 }}
        exit={{ scale: 0.95, opacity: 0 }}
        transition={{ type: "spring", stiffness: 300, damping: 30 }}
        className="w-full max-w-sm bg-[#111111] border border-[rgba(239,68,68,0.2)] rounded-2xl shadow-2xl p-6"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-3 mb-4">
          <div className="w-9 h-9 rounded-xl bg-[rgba(239,68,68,0.12)] border border-[rgba(239,68,68,0.2)] flex items-center justify-center flex-shrink-0">
            <Trash2 size={16} className="text-[#EF4444]" />
          </div>
          <div>
            <h2 className="text-base font-bold text-[#F0F0F0]">Delete Sprint</h2>
            <p className="text-xs text-[#606060] mt-0.5">This cannot be undone</p>
          </div>
        </div>
        <p className="text-sm text-[#9A9A9A] mb-6">
          Delete <span className="text-[#F0F0F0] font-semibold">{sprintName}</span>? All tasks and comments will be permanently removed.
        </p>
        <div className="flex gap-3">
          <button
            onClick={onClose}
            className="flex-1 px-4 py-2.5 text-sm font-semibold text-[#9A9A9A] bg-[rgba(255,255,255,0.04)] hover:bg-[rgba(255,255,255,0.07)] rounded-xl transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            className="flex-1 px-4 py-2.5 text-sm font-semibold bg-[#EF4444] text-white hover:bg-[#DC2626] rounded-xl transition-colors"
          >
            Delete Sprint
          </button>
        </div>
      </motion.div>
    </motion.div>
  );
}

// ─── Sprint Header ────────────────────────────────────────────────────────────

function SprintHeader({
  sprint,
  onStatusChange,
  onEdit,
  onDelete,
}: {
  sprint: Sprint;
  onStatusChange: (status: string) => void;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const done = sprint.tasks.filter((t) => t.status === "done").length;
  const total = sprint.tasks.length;
  const pct = total > 0 ? Math.round((done / total) * 100) : 0;
  const timePct = sprintProgress(sprint.startDate, sprint.endDate);
  const days = daysRemaining(sprint.endDate);
  const health = sprintHealth(sprint);
  const healthCfg = HEALTH_CONFIG[health];
  const totalPoints = sprint.tasks.reduce((a, t) => a + (t.storyPoints ?? 0), 0);
  const donePoints = sprint.tasks.filter((t) => t.status === "done").reduce((a, t) => a + (t.storyPoints ?? 0), 0);
  const blocked = sprint.tasks.filter((t) => t.status === "blocked").length;
  const inProgress = sprint.tasks.filter((t) => t.status === "in-progress").length;

  return (
    <div className="bg-[#111111] border border-[rgba(255,255,255,0.06)] rounded-2xl p-4">
      {/* Row 1: Name + status badge + action buttons */}
      <div className="flex flex-wrap items-center gap-2 mb-2">
        <div className="flex-1 min-w-0 flex items-center gap-1.5 flex-wrap" style={{ minWidth: "160px" }}>
          <h2 className="text-base font-bold text-[#F0F0F0] truncate">{sprint.name}</h2>
          <span
            className="flex-shrink-0 text-[10px] font-bold px-2 py-0.5 rounded-full"
            style={{ color: healthCfg.color, backgroundColor: healthCfg.bg }}
          >
            {healthCfg.label}
          </span>
          <span className={cn(
            "flex-shrink-0 text-[10px] font-bold px-2 py-0.5 rounded-full border",
            sprint.status === "active" && "text-[#F7941D] bg-[rgba(247,148,29,0.12)] border-[rgba(247,148,29,0.25)]",
            sprint.status === "planning" && "text-[#6366F1] bg-[rgba(99,102,241,0.12)] border-[rgba(99,102,241,0.25)]",
            sprint.status === "completed" && "text-[#22C55E] bg-[rgba(34,197,94,0.12)] border-[rgba(34,197,94,0.25)]",
          )}>
            {sprint.status === "active" ? "● Active" : sprint.status === "planning" ? "◐ Planning" : "✓ Completed"}
          </span>
        </div>

        {/* Edit + Delete */}
        <div className="flex items-center gap-1 flex-shrink-0">
          <button
            onClick={onEdit}
            className="p-1.5 rounded-lg text-[#606060] hover:text-[#6366F1] hover:bg-[rgba(99,102,241,0.1)] transition-colors"
            title="Edit sprint"
          >
            <Edit3 size={13} />
          </button>
          <button
            onClick={onDelete}
            className="p-1.5 rounded-lg text-[#606060] hover:text-[#EF4444] hover:bg-[rgba(239,68,68,0.1)] transition-colors"
            title="Delete sprint"
          >
            <Trash2 size={13} />
          </button>
        </div>

        {/* Status transitions */}
        <div className="flex items-center gap-1.5 flex-shrink-0">
          {sprint.status === "planning" && (
            <button
              onClick={() => onStatusChange("active")}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold bg-[#F7941D] text-black rounded-lg hover:bg-[#FBBA00] transition-colors shadow-[0_0_12px_rgba(247,148,29,0.25)]"
            >
              <Zap size={11} />
              Start Sprint
            </button>
          )}
          {sprint.status === "active" && (
            <>
              <button
                onClick={() => onStatusChange("planning")}
                className="px-2.5 py-1.5 text-xs font-semibold bg-[rgba(255,255,255,0.05)] text-[#9A9A9A] border border-[rgba(255,255,255,0.08)] rounded-lg hover:text-[#F0F0F0] transition-colors"
              >
                Revert
              </button>
              <button
                onClick={() => onStatusChange("completed")}
                className="flex items-center gap-1 px-2.5 py-1.5 text-xs font-semibold bg-[rgba(34,197,94,0.12)] text-[#22C55E] border border-[rgba(34,197,94,0.25)] rounded-lg hover:bg-[rgba(34,197,94,0.2)] transition-colors"
              >
                <CheckCircle2 size={11} />
                Complete
              </button>
            </>
          )}
          {sprint.status === "completed" && (
            <button
              onClick={() => onStatusChange("active")}
              className="flex items-center gap-1 px-2.5 py-1.5 text-xs font-semibold bg-[rgba(247,148,29,0.1)] text-[#F7941D] border border-[rgba(247,148,29,0.2)] rounded-lg hover:bg-[rgba(247,148,29,0.18)] transition-colors"
            >
              <Zap size={11} />
              Re-activate
            </button>
          )}
        </div>
      </div>

      {/* Goal (if set) */}
      {sprint.goal && (
        <p className="text-xs text-[#9A9A9A] flex items-start gap-1.5 mb-3">
          <Target size={11} className="mt-0.5 flex-shrink-0 text-[#F7941D]" />
          {sprint.goal}
        </p>
      )}

      {/* Inline stats + progress */}
      <div className="flex items-center gap-3 sm:gap-4 flex-wrap">
        {/* Stats pills */}
        <div className="flex items-center gap-2 sm:gap-3 text-xs flex-wrap">
          <span className="flex items-center gap-1 text-[#606060]">
            <CheckCircle2 size={11} className="text-[#22C55E]" />
            <span className="font-semibold text-[#F0F0F0]">{done}/{total}</span> tasks
          </span>
          {totalPoints > 0 && (
            <span className="flex items-center gap-1 text-[#606060]">
              <TrendingUp size={11} className="text-[#F7941D]" />
              <span className="font-semibold text-[#F0F0F0]">{donePoints}/{totalPoints}pt</span>
              {sprint.velocity && <span className="text-[#404040]">/ {sprint.velocity} target</span>}
            </span>
          )}
          {inProgress > 0 && (
            <span className="flex items-center gap-1 text-[#606060]">
              <Clock size={11} className="text-[#F7941D]" />
              <span className="font-semibold text-[#F7941D]">{inProgress}</span> active
            </span>
          )}
          {blocked > 0 && (
            <span className="flex items-center gap-1 text-[#606060]">
              <AlertTriangle size={11} className="text-[#EF4444]" />
              <span className="font-semibold text-[#EF4444]">{blocked}</span> blocked
            </span>
          )}
          <span className="flex items-center gap-1 text-[#606060]">
            <CalendarDays size={11} />
            {days > 0 ? `${days}d left` : days === 0 ? "Ends today" : `${Math.abs(days)}d over`}
          </span>
          <span className="hidden sm:inline text-[#404040]">
            {formatDate(sprint.startDate)} → {formatDate(sprint.endDate)}
          </span>
        </div>

        {/* Progress bars */}
        <div className="flex-1 min-w-32 space-y-1">
          <div className="flex items-center gap-2">
            <span className="text-[10px] text-[#404040] w-12 flex-shrink-0">Tasks</span>
            <ProgressBar value={pct} color={pct >= 80 ? "#22C55E" : "#F7941D"} className="flex-1" />
            <span className="text-[10px] text-[#606060] w-6 text-right flex-shrink-0">{pct}%</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-[10px] text-[#404040] w-12 flex-shrink-0">Time</span>
            <ProgressBar
              value={timePct}
              color={days < 0 ? "#EF4444" : days <= 2 ? "#FBBA00" : "#6366F1"}
              className="flex-1"
            />
            <span className="text-[10px] text-[#606060] w-6 text-right flex-shrink-0">{timePct}%</span>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

export function SprintsClient({
  initialSprints,
  users,
}: {
  initialSprints: Sprint[];
  users: User[];
}) {
  const [sprints, setSprints] = useState<Sprint[]>(initialSprints);
  const [selectedId, setSelectedId] = useState<string | null>(() => {
    const active = initialSprints.find((s) => s.status === "active");
    const planning = initialSprints.find((s) => s.status === "planning");
    return active?.id ?? planning?.id ?? initialSprints[0]?.id ?? null;
  });
  const [showNewSprint, setShowNewSprint] = useState(false);
  const [showEditSprint, setShowEditSprint] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [showAddFromProject, setShowAddFromProject] = useState(false);
  const [showActivityPanel, setShowActivityPanel] = useState(false);
  const [mobileShowMain, setMobileShowMain] = useState(false);

  const selectedSprint = sprints.find((s) => s.id === selectedId) ?? null;

  // All sprints sorted: active first, then planning, then completed (desc by date)
  const sortedSprints = useMemo(() => {
    const order = { active: 0, planning: 1, completed: 2 };
    return [...sprints].sort((a, b) => {
      const so = (order[a.status as keyof typeof order] ?? 3) - (order[b.status as keyof typeof order] ?? 3);
      if (so !== 0) return so;
      return b.startDate.localeCompare(a.startDate);
    });
  }, [sprints]);

  // Flat task list grouped by status
  const taskGroups = useMemo(() => {
    if (!selectedSprint) return [];
    const groups: { status: string; label: string; tasks: SprintTask[] }[] = [
      { status: "in-progress", label: "In Progress", tasks: [] },
      { status: "todo",        label: "To Do",       tasks: [] },
      { status: "blocked",     label: "Blocked",     tasks: [] },
      { status: "done",        label: "Done",        tasks: [] },
    ];
    for (const task of selectedSprint.tasks) {
      const g = groups.find((g) => g.status === task.status);
      if (g) g.tasks.push(task);
    }
    return groups.filter((g) => g.tasks.length > 0);
  }, [selectedSprint]);

  function selectSprint(sprint: Sprint) {
    setSelectedId(sprint.id);
    setMobileShowMain(true);
  }

  // ── CRUD helpers ──

  async function handleCreateSprint(data: {
    name: string; goal: string; startDate: string; endDate: string; velocity: string;
  }) {
    const res = await fetch("/api/sprints", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
    const sprint = await res.json();
    setSprints((prev) => [sprint, ...prev]);
    setSelectedId(sprint.id);
    setShowNewSprint(false);
  }

  async function handleEditSprint(data: {
    name: string; goal: string; startDate: string; endDate: string; velocity: string;
  }) {
    if (!selectedSprint) return;
    const res = await fetch(`/api/sprints/${selectedSprint.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
    const updated = await res.json();
    setSprints((prev) => prev.map((s) => (s.id === updated.id ? updated : s)));
    setShowEditSprint(false);
  }

  async function handleDeleteSprint() {
    if (!selectedSprint) return;
    await fetch(`/api/sprints/${selectedSprint.id}`, { method: "DELETE" });
    const remaining = sprints.filter((s) => s.id !== selectedSprint.id);
    setSprints(remaining);
    const next = remaining.find((s) => s.status === selectedSprint.status) ?? remaining[0] ?? null;
    setSelectedId(next?.id ?? null);
    setShowDeleteConfirm(false);
  }

  async function handleSprintStatusChange(status: string) {
    if (!selectedSprint) return;
    const res = await fetch(`/api/sprints/${selectedSprint.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status }),
    });
    const updated = await res.json();
    setSprints((prev) =>
      prev.map((s) => {
        if (s.id === updated.id) return updated;
        if (status === "active" && s.status === "active") return { ...s, status: "planning" };
        return s;
      })
    );
  }


  async function handleTaskStatusChange(taskId: string, status: string) {
    if (!selectedSprint) return;
    const res = await fetch(`/api/sprints/${selectedSprint.id}/tasks/${taskId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status }),
    });
    const updated = await res.json();
    setSprints((prev) =>
      prev.map((s) =>
        s.id === selectedSprint.id
          ? { ...s, tasks: s.tasks.map((t) => (t.id === taskId ? updated : t)) }
          : s
      )
    );
  }

  async function handleTaskAssigneeChange(taskId: string, assigneeId: string | null) {
    if (!selectedSprint) return;
    const res = await fetch(`/api/sprints/${selectedSprint.id}/tasks/${taskId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ assigneeId }),
    });
    const updated = await res.json();
    setSprints((prev) =>
      prev.map((s) =>
        s.id === selectedSprint.id
          ? { ...s, tasks: s.tasks.map((t) => (t.id === taskId ? updated : t)) }
          : s
      )
    );
  }

  async function handleDeleteTask(taskId: string) {
    if (!selectedSprint) return;
    await fetch(`/api/sprints/${selectedSprint.id}/tasks/${taskId}`, { method: "DELETE" });
    setSprints((prev) =>
      prev.map((s) =>
        s.id === selectedSprint.id ? { ...s, tasks: s.tasks.filter((t) => t.id !== taskId) } : s
      )
    );
  }

  async function handleAddComment(body: string, type: string) {
    if (!selectedSprint) return;
    const res = await fetch(`/api/sprints/${selectedSprint.id}/comments`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ body, type }),
    });
    const comment = await res.json();
    setSprints((prev) =>
      prev.map((s) =>
        s.id === selectedSprint.id ? { ...s, comments: [comment, ...s.comments] } : s
      )
    );
  }

  async function handleDeleteComment(commentId: string) {
    if (!selectedSprint) return;
    await fetch(`/api/sprints/${selectedSprint.id}/comments/${commentId}`, { method: "DELETE" });
    setSprints((prev) =>
      prev.map((s) =>
        s.id === selectedSprint.id
          ? { ...s, comments: s.comments.filter((c) => c.id !== commentId) }
          : s
      )
    );
  }

  function handleAddKanbanTask(task: SprintTask) {
    if (!selectedSprint) return;
    setSprints((prev) =>
      prev.map((s) => s.id === selectedSprint.id ? { ...s, tasks: [...s.tasks, task] } : s)
    );
  }

  return (
    <div className="flex flex-col h-full bg-[#0D0D0D] overflow-hidden">
      {/* ── Page Header ─────────────────────────────────────────────────────── */}
      <div className="flex-shrink-0 px-4 pt-4 pb-3 border-b border-[rgba(255,255,255,0.06)]">
        <h1 className="text-2xl font-black text-[#F0F0F0] flex items-center gap-3">
          <Zap size={22} className="text-[#F7941D]" />
          Dev Sprints
        </h1>
      </div>

      {/* ── Two-column layout ───────────────────────────────────────────────── */}
      <div className="flex flex-1 overflow-hidden">
        {/* ── Left: Sprint List ───────────────────────────────────────────── */}
        <div className={cn(
          "flex-shrink-0 flex flex-col border-r border-[rgba(255,255,255,0.06)] bg-[#0A0A0A]",
          "w-full md:w-48",
          mobileShowMain ? "hidden md:flex" : "flex"
        )}>
          {/* New Sprint button */}
          <div className="px-2.5 pt-2.5 pb-2 border-b border-[rgba(255,255,255,0.06)]">
            <button
              onClick={() => setShowNewSprint(true)}
              className="w-full flex items-center justify-center gap-1.5 py-1.5 rounded-lg bg-[rgba(247,148,29,0.1)] border border-[rgba(247,148,29,0.2)] text-[#F7941D] text-xs font-medium hover:bg-[rgba(247,148,29,0.18)] transition-all"
            >
              <Plus size={12} />
              New Sprint
            </button>
          </div>

          {/* Sprint list */}
          <div className="flex-1 overflow-y-auto py-1.5 space-y-0.5 px-1.5">
            <AnimatePresence>
              {sprints.length === 0 && (
                <p className="text-xs text-[#404040] text-center py-6 px-3">
                  No sprints yet. Create your first sprint above.
                </p>
              )}
              {sortedSprints.map((s) => {
                const done = s.tasks.filter((t) => t.status === "done").length;
                const total = s.tasks.length;
                const pct = total > 0 ? Math.round((done / total) * 100) : 0;
                const isSelected = s.id === selectedId;
                const health = sprintHealth(s);
                const healthCfg = HEALTH_CONFIG[health];

                return (
                  <motion.div
                    key={s.id}
                    initial={{ opacity: 0, x: -8 }}
                    animate={{ opacity: 1, x: 0 }}
                    className={cn(
                      "group relative rounded-lg px-3 py-2.5 cursor-pointer transition-all",
                      isSelected
                        ? "bg-[rgba(247,148,29,0.1)] border border-[rgba(247,148,29,0.2)]"
                        : "hover:bg-[rgba(255,255,255,0.03)] border border-transparent"
                    )}
                    onClick={() => selectSprint(s)}
                  >
                    {isSelected && (
                      <div className="absolute left-0 top-1/2 -translate-y-1/2 w-0.5 h-5 bg-[#F7941D] rounded-r" />
                    )}
                    <div className="flex items-center gap-1.5 mb-1.5">
                      <span className={cn(
                        "text-xs font-semibold truncate flex-1",
                        isSelected ? "text-[#F7941D]" : "text-[#C0C0C0]"
                      )}>
                        {s.name}
                      </span>
                      {s.status === "active" && (
                        <span className="w-1.5 h-1.5 rounded-full bg-[#F7941D] flex-shrink-0 animate-pulse" />
                      )}
                    </div>
                    <div className="flex items-center gap-1.5 mb-1">
                      <ProgressBar value={pct} color={isSelected ? healthCfg.color : "#333"} className="flex-1" />
                      <span className="text-[10px] text-[#505050] flex-shrink-0">{pct}%</span>
                    </div>
                    <span
                      className="text-[9px] px-1.5 py-0.5 rounded-full font-medium"
                      style={{
                        color: s.status === "active" ? "#F7941D" : s.status === "planning" ? "#6366F1" : "#22C55E",
                        background: s.status === "active" ? "rgba(247,148,29,0.1)" : s.status === "planning" ? "rgba(99,102,241,0.1)" : "rgba(34,197,94,0.1)",
                      }}
                    >
                      {s.status === "active" ? "Active" : s.status === "planning" ? "Planning" : "Completed"}
                    </span>
                  </motion.div>
                );
              })}
            </AnimatePresence>
          </div>
        </div>

        {/* ── Right: Sprint Detail ─────────────────────────────────────────── */}
        <div className={cn(
          "flex-1 flex-col min-w-0 overflow-hidden",
          mobileShowMain ? "flex" : "hidden md:flex"
        )}>
          {selectedSprint ? (
            <div className="flex-1 overflow-y-auto">
              <div className="p-4 space-y-4">
                {/* Mobile back button */}
                <button
                  onClick={() => setMobileShowMain(false)}
                  className="flex md:hidden items-center gap-1.5 text-xs text-[#606060] hover:text-[#F7941D] transition-colors"
                >
                  <span className="text-base leading-none">‹</span>
                  All Sprints
                </button>

                <SprintHeader
                  sprint={selectedSprint}
                  onStatusChange={handleSprintStatusChange}
                  onEdit={() => setShowEditSprint(true)}
                  onDelete={() => setShowDeleteConfirm(true)}
                />

                {/* Tasks header + activity button */}
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <h3 className="text-xs font-bold text-[#9A9A9A] uppercase tracking-wider">Tasks</h3>
                    <span className="text-xs text-[#606060]">({selectedSprint.tasks.length})</span>
                  </div>
                  <button
                    onClick={() => setShowActivityPanel(!showActivityPanel)}
                    className={cn(
                      "flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-xl border transition-all",
                      showActivityPanel
                        ? "bg-[rgba(99,102,241,0.15)] text-[#6366F1] border-[rgba(99,102,241,0.3)]"
                        : "text-[#9A9A9A] bg-[rgba(255,255,255,0.04)] border-[rgba(255,255,255,0.08)] hover:text-[#F0F0F0] hover:border-[rgba(255,255,255,0.15)]"
                    )}
                  >
                    <MessageSquare size={12} />
                    Notes & Activity
                    {selectedSprint.comments.length > 0 && (
                      <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-[rgba(255,255,255,0.08)] text-[#9A9A9A]">
                        {selectedSprint.comments.length}
                      </span>
                    )}
                  </button>
                </div>

                {/* Flat task list */}
                {selectedSprint.tasks.length === 0 ? (
                  <div className="bg-[#111111] border border-dashed border-[rgba(255,255,255,0.1)] rounded-2xl p-8 text-center">
                    <BarChart3 size={32} className="text-[#333333] mx-auto mb-3" />
                    <p className="text-sm text-[#606060]">No tasks yet — add tasks to get started</p>
                  </div>
                ) : (
                  <div className="space-y-5">
                    {taskGroups.map(({ status, label, tasks }) => {
                      const cfg = STATUS_CONFIG[status as keyof typeof STATUS_CONFIG];
                      return (
                        <div key={status}>
                          <div className="flex items-center gap-2 mb-2">
                            <span className="text-[10px] font-bold uppercase tracking-wider" style={{ color: cfg.color }}>
                              {label}
                            </span>
                            <span className="text-[10px] text-[#404040]">{tasks.length}</span>
                          </div>
                          <div className="space-y-1.5">
                            <AnimatePresence>
                              {tasks.map((task) => (
                                <TaskRow
                                  key={task.id}
                                  task={task}
                                  users={users}
                                  onStatusChange={handleTaskStatusChange}
                                  onAssigneeChange={handleTaskAssigneeChange}
                                  onDelete={handleDeleteTask}
                                />
                              ))}
                            </AnimatePresence>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}

                {/* Add from Kanban */}
                <div className="pb-4">
                  <button
                    onClick={() => setShowAddFromProject(true)}
                    className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-[#9A9A9A] hover:text-[#F7941D] transition-all px-3 py-2 rounded-xl bg-[rgba(255,255,255,0.04)] border border-[rgba(255,255,255,0.06)] hover:bg-[rgba(247,148,29,0.1)] hover:border-[rgba(247,148,29,0.2)]"
                  >
                    <FolderGit2 size={13} className="text-[#F7941D]" />
                    Add From Kanban
                  </button>
                </div>
              </div>
            </div>
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center gap-4 text-center px-8">
              <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-[#F7941D]/20 to-[#7B1C24]/20 flex items-center justify-center border border-[rgba(247,148,29,0.2)]">
                <Zap size={36} className="text-[#F7941D]" />
              </div>
              <div>
                <h3 className="text-xl font-bold text-[#F0F0F0] mb-2">No sprint selected</h3>
                <p className="text-sm text-[#606060] max-w-xs mx-auto">
                  Select a sprint from the list or create a new one to get started.
                </p>
              </div>
              <button
                onClick={() => setShowNewSprint(true)}
                className="flex items-center gap-2 px-5 py-2.5 text-sm font-semibold bg-[#F7941D] text-black rounded-xl hover:bg-[#FBBA00] transition-colors"
              >
                <Plus size={16} />
                Create Sprint
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Notes & Activity drawer */}
      <AnimatePresence>
        {showActivityPanel && selectedSprint && (
          <ActivityDrawer
            comments={selectedSprint.comments}
            onAddComment={handleAddComment}
            onDeleteComment={handleDeleteComment}
            onClose={() => setShowActivityPanel(false)}
          />
        )}
      </AnimatePresence>

      {/* Modals */}
      <AnimatePresence>
        {showNewSprint && (
          <NewSprintModal
            onClose={() => setShowNewSprint(false)}
            onSave={handleCreateSprint}
          />
        )}
        {showEditSprint && selectedSprint && (
          <EditSprintModal
            sprint={selectedSprint}
            onClose={() => setShowEditSprint(false)}
            onSave={handleEditSprint}
          />
        )}
        {showDeleteConfirm && selectedSprint && (
          <DeleteConfirmModal
            sprintName={selectedSprint.name}
            onClose={() => setShowDeleteConfirm(false)}
            onConfirm={handleDeleteSprint}
          />
        )}
        {showAddFromProject && selectedSprint && (
          <AddKanbanTaskModal
            sprintId={selectedSprint.id}
            onClose={() => setShowAddFromProject(false)}
            onAdded={handleAddKanbanTask}
          />
        )}
      </AnimatePresence>
    </div>
  );
}
