"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { X, Plus, GitBranch } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Input, Textarea } from "@/components/ui/Input";
import { KanbanCustomer, KanbanCustomerField } from "./KanbanCustomerField";

interface User {
  id: string;
  name: string | null;
  displayName: string | null;
  email: string;
  image: string | null;
}

interface Props {
  columnId: string;
  owner: string;
  repo: string;
  users: User[];
  customers: KanbanCustomer[];
  onClose: () => void;
  onCreated: () => void;
}

export function NewCardModal({ columnId, owner, repo, users, customers, onClose, onCreated }: Props) {
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [priority, setPriority] = useState("medium");
  const [assigneeId, setAssigneeId] = useState<string | null>(null);
  const [customerIds, setCustomerIds] = useState<string[]>([]);
  const [createGithubIssue, setCreateGithubIssue] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleCreate() {
    if (!title.trim()) {
      setError("Title is required");
      return;
    }
    setLoading(true);
    setError(null);

    try {
      let githubIssueId: number | undefined;
      let githubIssueUrl: string | undefined;

      if (createGithubIssue) {
        const ghRes = await fetch("/api/github/issues", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ owner, repo, title, body }),
        });
        const ghData = await ghRes.json();
        githubIssueId = ghData.issue?.number;
        githubIssueUrl = ghData.issue?.html_url;
      }

      await fetch("/api/kanban", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          columnId,
          title,
          body,
          priority,
          assignees: JSON.stringify(assigneeId ? [assigneeId] : []),
          customerIds,
          githubIssueId,
          githubIssueUrl,
        }),
      });

      onCreated();
      onClose();
    } catch {
      setError("Failed to create card. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <motion.div
        initial={{ opacity: 0, y: 20, scale: 0.97 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: 10, scale: 0.97 }}
        className="bg-[#1A1A1A] border border-[rgba(255,255,255,0.1)] rounded-2xl p-6 w-full max-w-md shadow-2xl"
      >
        <div className="flex items-center justify-between mb-5">
          <h3 className="text-base font-bold text-[#F0F0F0]">Create Card</h3>
          <button
            onClick={onClose}
            className="w-7 h-7 flex items-center justify-center rounded-lg text-[#606060] hover:text-[#F0F0F0] hover:bg-[rgba(255,255,255,0.06)] transition-all"
          >
            <X size={14} />
          </button>
        </div>

        <div className="space-y-4">
          <Input
            label="Title"
            placeholder="What needs to be done?"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleCreate()}
            autoFocus
            error={error ?? undefined}
          />

          <Textarea
            label="Description (optional)"
            placeholder="Add more context..."
            value={body}
            onChange={(e) => setBody(e.target.value)}
            rows={3}
          />

          {/* Priority */}
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-medium text-[#9A9A9A] uppercase tracking-wider">Priority</label>
            <div className="flex gap-2">
              {["low", "medium", "high", "critical"].map((p) => {
                const colors = {
                  low: "#22C55E",
                  medium: "#FBBA00",
                  high: "#F97316",
                  critical: "#EF4444",
                };
                const color = colors[p as keyof typeof colors];
                return (
                  <button
                    key={p}
                    type="button"
                    onClick={() => setPriority(p)}
                    className={`flex-1 py-1.5 text-xs font-medium rounded-lg border transition-all capitalize ${
                      priority === p
                        ? "text-white"
                        : "border-[rgba(255,255,255,0.08)] text-[#606060] hover:text-[#F0F0F0]"
                    }`}
                    style={
                      priority === p
                        ? { backgroundColor: `${color}25`, borderColor: `${color}60`, color }
                        : {}
                    }
                  >
                    {p}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Assignee */}
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-medium text-[#9A9A9A] uppercase tracking-wider">Assign To</label>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => setAssigneeId(null)}
                className={`flex items-center gap-2 px-3 py-1.5 rounded-xl border text-xs transition-all ${
                  assigneeId === null
                    ? "bg-[rgba(247,148,29,0.1)] border-[rgba(247,148,29,0.3)] text-[#F7941D]"
                    : "bg-[rgba(255,255,255,0.03)] border-[rgba(255,255,255,0.06)] text-[#606060]"
                }`}
              >
                Unassigned
              </button>
              {users.map((u) => (
                <button
                  key={u.id}
                  type="button"
                  onClick={() => setAssigneeId(u.id)}
                  className={`flex items-center gap-2 px-2.5 py-1.5 rounded-xl border text-xs transition-all ${
                    assigneeId === u.id
                      ? "bg-[rgba(247,148,29,0.1)] border-[rgba(247,148,29,0.3)] text-[#F7941D]"
                      : "bg-[rgba(255,255,255,0.03)] border-[rgba(255,255,255,0.06)] text-[#606060]"
                  }`}
                >
                  <div className="w-5 h-5 rounded-full overflow-hidden bg-[rgba(255,255,255,0.1)]">
                    {u.image ? (
                      <img src={u.image} alt={u.name ?? ""} className="w-full h-full object-cover" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-[8px]">
                        {u.name?.charAt(0) ?? "U"}
                      </div>
                    )}
                  </div>
                  <span className="truncate max-w-[80px]">{u.displayName ?? u.name}</span>
                </button>
              ))}
            </div>
          </div>

          <KanbanCustomerField
            customers={customers}
            selectedCustomerIds={customerIds}
            onToggleCustomer={(customerId) =>
              setCustomerIds((prev) =>
                prev.includes(customerId)
                  ? prev.filter((id) => id !== customerId)
                  : [...prev, customerId]
              )
            }
          />

          {/* GitHub Issue toggle */}
          <div className="flex items-center justify-between p-3 bg-[#222222] rounded-xl border border-[rgba(255,255,255,0.06)]">
            <div className="flex items-center gap-2">
              <GitBranch size={14} className="text-[#9A9A9A]" />
              <div>
                <div className="text-xs font-medium text-[#F0F0F0]">Also create GitHub Issue</div>
                <div className="text-xs text-[#606060]">Opens issue in {owner}/{repo}</div>
              </div>
            </div>
            <button
              onClick={() => setCreateGithubIssue(!createGithubIssue)}
              className={`w-10 h-5 rounded-full transition-all relative ${
                createGithubIssue ? "bg-[#F7941D]" : "bg-[#333333]"
              }`}
            >
              <span
                className={`absolute top-0.5 w-4 h-4 bg-white rounded-full transition-all shadow ${
                  createGithubIssue ? "left-5" : "left-0.5"
                }`}
              />
            </button>
          </div>
        </div>

        <div className="flex gap-3 mt-6">
          <Button variant="secondary" onClick={onClose} className="flex-1">
            Cancel
          </Button>
          <Button
            variant="primary"
            loading={loading}
            icon={<Plus size={14} />}
            onClick={handleCreate}
            className="flex-1"
          >
            Create Card
          </Button>
        </div>
      </motion.div>
    </motion.div>
  );
}
