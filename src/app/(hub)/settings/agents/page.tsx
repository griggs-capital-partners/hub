"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Bot, Loader2, Wrench, PlugZap, ArrowRight } from "lucide-react";
import Link from "next/link";
import { Card, CardBody, CardHeader } from "@/components/ui/Card";
import { cn } from "@/lib/utils";
import { agentChatTools, TOOL_LABELS } from "@/lib/agent-tools";

// ─── Types ────────────────────────────────────────────────────────────────────

interface Agent {
  id: string;
  name: string;
  role: string;
  avatar: string | null;
  status: string;
  disabledTools: string;
  llmStatus: string;
  llmModel: string | null;
}

// ─── Constants ────────────────────────────────────────────────────────────────

const AGENT_COLOR = "#4B9CD3";
const AGENT_COLOR_DIM = "rgba(75,156,211,0.15)";

const TOOL_CATEGORIES: Record<string, string> = {
  list_kanban_boards: "Kanban",
  create_kanban_card: "Kanban",
  update_kanban_card: "Kanban",
  move_kanban_card: "Kanban",
  delete_kanban_card: "Kanban",
  list_repos: "Codebase",
  get_repo_details: "Codebase",
};

function parseDisabledTools(raw: string): string[] {
  try { return JSON.parse(raw) ?? []; } catch { return []; }
}

// ─── Agent row ────────────────────────────────────────────────────────────────

function AgentRow({ agent, onUpdate }: { agent: Agent; onUpdate: (updated: Agent) => void }) {
  const disabled = parseDisabledTools(agent.disabledTools);
  const enabledCount = agentChatTools.length - disabled.length;
  const [saving, setSaving] = useState<string | null>(null);

  const statusColor = agent.llmStatus === "online"
    ? "#22C55E"
    : agent.llmStatus === "offline"
      ? "#EF4444"
      : "#8D877F";

  const categories = Array.from(new Set(agentChatTools.map((t) => TOOL_CATEGORIES[t.function.name] ?? "Other")));

  async function toggleTool(toolName: string) {
    const isDisabled = disabled.includes(toolName);
    const next = isDisabled
      ? disabled.filter((t) => t !== toolName)
      : [...disabled, toolName];

    setSaving(toolName);
    try {
      const res = await fetch(`/api/agents/${agent.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ disabledTools: next }),
      });
      const data = await res.json();
      if (data.agent) onUpdate(data.agent);
    } finally {
      setSaving(null);
    }
  }

  return (
    <Card>
      <CardHeader className="border-b border-[rgba(255,255,255,0.06)] px-5 py-4">
        <div className="flex items-center gap-3">
          {/* Avatar */}
          <div
            className="w-9 h-9 rounded-full flex items-center justify-center text-lg flex-shrink-0 overflow-hidden"
            style={{ backgroundColor: AGENT_COLOR_DIM }}
          >
            {agent.avatar && (agent.avatar.startsWith("data:") || agent.avatar.startsWith("https://"))
              ? <img src={agent.avatar} alt={agent.name} className="w-full h-full object-cover" />
              : (agent.avatar ?? <Bot size={18} style={{ color: AGENT_COLOR }} />)}
          </div>

          {/* Name / role */}
          <div className="flex-1 min-w-0">
            <p className="text-sm font-bold text-[#F0F0F0] truncate">{agent.name}</p>
            <p className="text-xs text-[#606060] truncate">{agent.role}</p>
          </div>

          {/* Brain status */}
          <div className="hidden sm:flex items-center gap-1.5 flex-shrink-0">
            <PlugZap size={12} style={{ color: statusColor }} />
            <span className="text-xs font-medium" style={{ color: statusColor }}>
              {agent.llmStatus === "online" ? (agent.llmModel ?? "Online") : agent.llmStatus === "offline" ? "Offline" : "Not connected"}
            </span>
          </div>

          {/* Tools count */}
          <span
            className="text-[11px] font-semibold rounded-full px-2.5 py-1 border flex-shrink-0"
            style={{ color: AGENT_COLOR, borderColor: `${AGENT_COLOR}40`, backgroundColor: AGENT_COLOR_DIM }}
          >
            {enabledCount} / {agentChatTools.length} tools
          </span>

          {/* Profile link */}
          <Link
            href={`/agents/${agent.id}/profile`}
            className="flex-shrink-0 flex items-center gap-1 text-xs text-[#606060] hover:text-[#4B9CD3] transition-colors"
          >
            <ArrowRight size={13} />
          </Link>
        </div>
      </CardHeader>

      <CardBody className="p-5 space-y-4">
        {categories.map((category) => {
          const categoryTools = agentChatTools.filter((t) => (TOOL_CATEGORIES[t.function.name] ?? "Other") === category);
          return (
            <div key={category}>
              <p className="mb-2 text-[10px] font-bold uppercase tracking-[0.18em] text-[#606060]">{category}</p>
              <div className="flex flex-wrap gap-2">
                {categoryTools.map((tool) => {
                  const name = tool.function.name;
                  const isEnabled = !disabled.includes(name);
                  const isSaving = saving === name;

                  return (
                    <button
                      key={name}
                      type="button"
                      onClick={() => toggleTool(name)}
                      disabled={isSaving}
                      className={cn(
                        "flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border transition-all disabled:opacity-60",
                        isEnabled
                          ? "border-[rgba(75,156,211,0.3)] text-[#4B9CD3] bg-[rgba(75,156,211,0.1)]"
                          : "border-[rgba(255,255,255,0.06)] text-[#606060] bg-[rgba(255,255,255,0.02)] hover:border-[rgba(255,255,255,0.12)]"
                      )}
                    >
                      {isSaving
                        ? <Loader2 size={10} className="animate-spin" />
                        : <Wrench size={10} />}
                      {TOOL_LABELS[name] ?? name}
                    </button>
                  );
                })}
              </div>
            </div>
          );
        })}
      </CardBody>
    </Card>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function SettingsAgentsPage() {
  const router = useRouter();
  const [agents, setAgents] = useState<Agent[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/agents")
      .then((r) => r.json())
      .then((d) => { if (Array.isArray(d.agents)) setAgents(d.agents); })
      .finally(() => setLoading(false));
  }, []);

  function handleUpdate(updated: Agent) {
    setAgents((prev) => prev.map((a) => a.id === updated.id ? updated : a));
  }

  return (
    <div className="space-y-6 max-w-3xl">
      {/* Header */}
      <div>
        <div className="flex items-center gap-2 mb-1">
          <Bot size={17} style={{ color: AGENT_COLOR }} />
          <h1 className="text-xl font-black text-[#F0F0F0]">Agents</h1>
        </div>
        <p className="text-sm text-[#606060]">
          Manage which tools each AI agent is allowed to use. Click a tool chip to toggle it on or off. Changes save instantly.
        </p>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-16">
          <Loader2 size={22} className="animate-spin" style={{ color: AGENT_COLOR }} />
        </div>
      ) : agents.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 gap-3 text-center">
          <Bot size={40} className="text-[#333333]" />
          <p className="text-sm text-[#606060]">No agents yet.</p>
          <button
            onClick={() => router.push("/agents")}
            className="text-xs text-[#4B9CD3] hover:underline"
          >
            Go to Agents to create one
          </button>
        </div>
      ) : (
        <div className="space-y-4">
          {agents.map((agent) => (
            <AgentRow key={agent.id} agent={agent} onUpdate={handleUpdate} />
          ))}
        </div>
      )}
    </div>
  );
}
