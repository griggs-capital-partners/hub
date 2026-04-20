"use client";

import { useEffect, useState, useRef } from "react";
import { useParams, useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import {
  Cpu, ArrowLeft, Pencil, Check, X,
  Loader2, Bot, ChevronDown, MessageSquare,
  CalendarDays, User, Sparkles, ListTodo, Sliders,
  AlertTriangle, PlugZap, ShieldCheck, ShieldAlert, Link as LinkIcon, RefreshCw, KeyRound, Camera,
  Wrench, WandSparkles, Plus, Trash2,
} from "lucide-react";
import { agentChatTools, TOOL_LABELS } from "@/lib/agent-tools";
import { getDefaultAgentAbilities, normalizeAgentAbilities, slugifyAbilityId, type AgentAbility } from "@/lib/agent-task-context";
import { AgentConstitutionEditor } from "@/components/agents/AgentConstitutionEditor";
import { hasStoredAgentConstitution } from "@/lib/agent-constitution";
import {
  AGENT_LLM_PROVIDER_OPTIONS,
  createEmptyAgentLlmConnection,
  getAgentLlmCatalog,
  isAgentLlmConnectionConfigured,
  normalizeAgentLlmConfig,
  switchAgentLlmConnectionProvider,
  type AgentLlmConfigDocument,
  type AgentLlmConnection,
  type AgentLlmProvider,
} from "@/lib/agent-llm-config";
import { Card, CardBody, CardHeader } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { cn } from "@/lib/utils";

// ─── Types ────────────────────────────────────────────────────────────────────

interface Agent {
  id: string;
  name: string;
  role: string;
  description: string | null;
  constitution: string;
  persona: string;
  duties: string;
  avatar: string | null;
  status: string;
  llmConfig: string;
  llmEndpointUrl: string | null;
  llmUsername: string | null;
  llmPassword: string | null;
  llmModel: string | null;
  llmThinkingMode: string;
  disabledTools: string;
  abilities: string;
  llmStatus: string;
  llmLastCheckedAt: string | null;
  llmLastError: string | null;
  createdAt: string;
  updatedAt: string;
  createdBy: { id: string; name: string | null; displayName: string | null };
  _count: { sprintTasks: number; messages: number; taskExecutions: number };
}

// ─── Constants ────────────────────────────────────────────────────────────────

const AGENT_COLOR = "#4B9CD3";
const AGENT_COLOR_DIM = "rgba(75,156,211,0.15)";

const ROLE_SUGGESTIONS = [
  "Executive Assistant", "Admin Assistant", "Technical SME", "Diligence Analyst",
  "Investor Relations", "File Librarian",
  "Backend Engineer", "Frontend Engineer", "Full Stack Engineer", "DevOps Engineer",
  "QA Engineer", "Data Engineer", "Security Engineer", "Mobile Engineer",
  "Product Manager", "Technical Writer", "Code Reviewer", "Deployment Manager",
];

const AVATAR_OPTIONS = ["🤖", "🧠", "⚡", "🔮", "🛸", "💡", "🦾", "🎯", "🔬", "🛡️", "🚀", "⚙️"];

// ─── Inline editable field ────────────────────────────────────────────────────

function EditableField({
  label,
  value,
  onSave,
  placeholder,
  multiline = false,
  hint,
}: {
  label: string;
  value: string;
  onSave: (val: string) => Promise<void>;
  placeholder?: string;
  multiline?: boolean;
  hint?: string;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => { setDraft(value); }, [value]);

  async function handleSave() {
    if (draft === value) { setEditing(false); return; }
    setSaving(true);
    try {
      await onSave(draft);
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } finally {
      setSaving(false);
      setEditing(false);
    }
  }

  function handleCancel() {
    setDraft(value);
    setEditing(false);
  }

  return (
    <div className="flex flex-col gap-1.5">
      <label className="text-sm font-medium text-[#9A9A9A]">{label}</label>
      <AnimatePresence mode="wait">
        {editing ? (
          <motion.div key="editing" initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="flex flex-col gap-2">
            {multiline ? (
              <textarea
                autoFocus
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                rows={5}
                placeholder={placeholder}
                className="w-full bg-[#141414] border border-[rgba(75,156,211,0.4)] rounded-lg px-4 py-3 text-sm text-[#F0F0F0] placeholder-[#404040] focus:outline-none resize-none"
              />
            ) : (
              <input
                autoFocus
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                placeholder={placeholder}
                onKeyDown={(e) => { if (e.key === "Enter") handleSave(); if (e.key === "Escape") handleCancel(); }}
                className="w-full bg-[#141414] border border-[rgba(75,156,211,0.4)] rounded-lg px-4 py-2 text-sm text-[#F0F0F0] focus:outline-none"
              />
            )}
            <div className="flex gap-2">
              <Button size="sm" variant="primary" loading={saving} onClick={handleSave}
                style={{ background: `linear-gradient(135deg, ${AGENT_COLOR}, #2980C4)` } as React.CSSProperties}>
                Save
              </Button>
              <Button size="sm" variant="secondary" onClick={handleCancel}>Cancel</Button>
            </div>
          </motion.div>
        ) : (
          <motion.div
            key="display"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="flex items-start justify-between bg-[#1A1A1A] border border-[rgba(255,255,255,0.06)] rounded-lg px-4 py-3 group cursor-pointer hover:border-[rgba(75,156,211,0.2)] transition-colors"
            onClick={() => setEditing(true)}
          >
            <span className={cn("text-sm flex-1 whitespace-pre-wrap", value ? "text-[#F0F0F0]" : "text-[#404040] italic")}>
              {value || placeholder || "—"}
            </span>
            <div className="flex items-center gap-2 ml-3 flex-shrink-0">
              {saved && <Check size={13} className="text-[#22C55E]" />}
              <Pencil size={13} className="text-[#404040] group-hover:text-[#4B9CD3] transition-colors" />
            </div>
          </motion.div>
        )}
      </AnimatePresence>
      {hint && <p className="text-[10px] text-[#606060]">{hint}</p>}
    </div>
  );
}

// ─── Role field with suggestions ──────────────────────────────────────────────

function RoleField({ value, onSave }: { value: string; onSave: (val: string) => Promise<void> }) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value);
  const [showSugg, setShowSugg] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => { setDraft(value); }, [value]);

  async function handleSave() {
    if (draft === value) { setEditing(false); return; }
    setSaving(true);
    try {
      await onSave(draft);
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } finally {
      setSaving(false);
      setEditing(false);
    }
  }

  const filtered = ROLE_SUGGESTIONS.filter((r) => r.toLowerCase().includes(draft.toLowerCase()));

  return (
    <div className="flex flex-col gap-1.5">
      <label className="text-sm font-medium text-[#9A9A9A]">Role</label>
      <AnimatePresence mode="wait">
        {editing ? (
          <motion.div key="editing" initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="flex flex-col gap-2">
            <div className="relative">
              <input
                autoFocus
                value={draft}
                onChange={(e) => { setDraft(e.target.value); setShowSugg(true); }}
                onFocus={() => setShowSugg(true)}
                onBlur={() => setTimeout(() => setShowSugg(false), 150)}
                onKeyDown={(e) => { if (e.key === "Enter") handleSave(); if (e.key === "Escape") { setDraft(value); setEditing(false); } }}
                className="w-full bg-[#141414] border border-[rgba(75,156,211,0.4)] rounded-lg px-4 py-2 text-sm text-[#F0F0F0] focus:outline-none"
              />
              <ChevronDown size={13} className="absolute right-3 top-1/2 -translate-y-1/2 text-[#606060] pointer-events-none" />
              {showSugg && filtered.length > 0 && (
                <div className="absolute z-10 top-full mt-1 w-full bg-[#1A1A1A] border border-[rgba(255,255,255,0.1)] rounded-xl overflow-hidden shadow-xl max-h-48 overflow-y-auto">
                  {filtered.map((r) => (
                    <button key={r} onMouseDown={() => { setDraft(r); setShowSugg(false); }}
                      className="w-full text-left px-3 py-2 text-sm text-[#F0F0F0] hover:bg-[rgba(75,156,211,0.12)] transition-colors">
                      {r}
                    </button>
                  ))}
                </div>
              )}
            </div>
            <div className="flex gap-2">
              <Button size="sm" variant="primary" loading={saving} onClick={handleSave}
                style={{ background: `linear-gradient(135deg, ${AGENT_COLOR}, #2980C4)` } as React.CSSProperties}>
                Save
              </Button>
              <Button size="sm" variant="secondary" onClick={() => { setDraft(value); setEditing(false); }}>Cancel</Button>
            </div>
          </motion.div>
        ) : (
          <motion.div key="display" initial={{ opacity: 0 }} animate={{ opacity: 1 }}
            className="flex items-center justify-between bg-[#1A1A1A] border border-[rgba(255,255,255,0.06)] rounded-lg px-4 py-3 group cursor-pointer hover:border-[rgba(75,156,211,0.2)] transition-colors"
            onClick={() => setEditing(true)}>
            <span className="text-sm text-[#F0F0F0]">{value}</span>
            <div className="flex items-center gap-2">
              {saved && <Check size={13} className="text-[#22C55E]" />}
              <Pencil size={13} className="text-[#404040] group-hover:text-[#4B9CD3] transition-colors" />
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ─── Avatar picker ────────────────────────────────────────────────────────────

function AvatarPicker({ value, onSave }: { value: string | null; onSave: (val: string | null) => Promise<void> }) {
  const [saving, setSaving] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const isImage = value && (value.startsWith("data:") || value.startsWith("https://"));

  async function pick(emoji: string) {
    if (emoji === value) return;
    setSaving(emoji);
    try { await onSave(emoji); }
    finally { setSaving(null); }
  }

  async function handleFile(file: File) {
    setUploadError(null);
    if (!file.type.startsWith("image/")) { setUploadError("Please select an image file."); return; }
    if (file.size > 300_000) { setUploadError("Image must be under 300 KB."); return; }
    setUploading(true);
    try {
      const base64 = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result as string);
        reader.onerror = reject;
        reader.readAsDataURL(file);
      });
      await onSave(base64);
    } catch {
      setUploadError("Upload failed.");
    } finally {
      setUploading(false);
    }
  }

  return (
    <div className="space-y-3">
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFile(f); e.target.value = ""; }}
      />
      <button
        onClick={() => fileInputRef.current?.click()}
        disabled={uploading}
        className="w-full flex items-center justify-center gap-2 px-3 py-2.5 rounded-lg text-sm font-medium border border-[rgba(75,156,211,0.3)] text-[#4B9CD3] bg-[rgba(75,156,211,0.08)] hover:bg-[rgba(75,156,211,0.15)] transition-all disabled:opacity-50"
      >
        {uploading ? <Loader2 size={14} className="animate-spin" /> : <Camera size={14} />}
        {uploading ? "Uploading..." : "Upload Photo"}
      </button>
      {isImage && (
        <button
          onClick={() => onSave(null)}
          className="w-full flex items-center justify-center gap-2 px-3 py-2 rounded-lg text-xs font-medium border border-[rgba(255,255,255,0.06)] text-[#606060] hover:text-[#EF4444] hover:border-[rgba(239,68,68,0.3)] transition-all"
        >
          <X size={12} /> Remove photo, use emoji
        </button>
      )}
      {uploadError && <p className="text-xs text-[#EF4444]">{uploadError}</p>}
      <div className="flex items-center gap-2">
        <div className="flex-1 h-px bg-[rgba(255,255,255,0.06)]" />
        <span className="text-[10px] text-[#404040] uppercase tracking-widest">or emoji</span>
        <div className="flex-1 h-px bg-[rgba(255,255,255,0.06)]" />
      </div>
      <div className="flex flex-wrap gap-2 justify-center">
        {AVATAR_OPTIONS.map((emoji) => (
          <button
            key={emoji}
            onClick={() => pick(emoji)}
            disabled={saving !== null || uploading}
            className={cn(
              "w-10 h-10 rounded-xl text-xl transition-all border relative",
              value === emoji
                ? "border-[rgba(75,156,211,0.6)] bg-[rgba(75,156,211,0.2)]"
                : "border-[rgba(255,255,255,0.06)] bg-[#1A1A1A] hover:border-[rgba(75,156,211,0.3)]"
            )}
          >
            {saving === emoji ? <Loader2 size={14} className="animate-spin mx-auto" style={{ color: AGENT_COLOR }} /> : emoji}
          </button>
        ))}
      </div>
    </div>
  );
}

function getNormalizedAgentLlmConfig(agent: Agent) {
  const config = normalizeAgentLlmConfig(agent.llmConfig, {
    llmEndpointUrl: agent.llmEndpointUrl,
    llmUsername: agent.llmUsername,
    llmPassword: agent.llmPassword,
    llmModel: agent.llmModel,
    llmThinkingMode: agent.llmThinkingMode,
  });
  return config.connections.length > 0
    ? config
    : {
        ...config,
        connections: [createEmptyAgentLlmConnection(0)],
      };
}

/*
  const [config, setConfig] = useState<AgentLlmConfigDocument>(() => getNormalizedAgentLlmConfig(agent));
  const [thinkingMode, setThinkingMode] = useState(agent.llmThinkingMode ?? "auto");
  const [saving, setSaving] = useState(false);
  const [checking, setChecking] = useState(false);

  useEffect(() => {
    setConfig(getNormalizedAgentLlmConfig(agent));
    setThinkingMode(agent.llmThinkingMode ?? "auto");
  }, [agent]);

  const statusLabel = agent.llmStatus === "online"
    ? "LLM Brain Online"
    : agent.llmStatus === "offline"
      ? "LLM Brain Offline"
      : "LLM Brain Not Connected";

  const statusColor = agent.llmStatus === "online"
    ? "#22C55E"
    : agent.llmStatus === "offline"
      ? "#EF4444"
      : "#8D877F";
  const catalog = getAgentLlmCatalog(config);
  const hasIncompleteConnections = config.connections.some((connection) => !connection.endpointUrl.trim());
  const endpointUrl = config.connections[0]?.endpointUrl ?? agent.llmEndpointUrl ?? "";
  const username = config.connections[0]?.username ?? agent.llmUsername ?? "";
  const password = config.connections[0]?.password ?? agent.llmPassword ?? "";
  const modelName = config.connections[0]?.model ?? agent.llmModel ?? "";
  const legacyConnectionId = config.connections[0]?.id ?? null;

  function updateConnection(connectionId: string, patch: Partial<AgentLlmConnection>) {
    setConfig((current) => ({
      ...current,
      connections: current.connections.map((connection) =>
        connection.id === connectionId ? { ...connection, ...patch } : connection
      ),
    }));
  }

  function setEndpointUrl(value: string) {
    if (!legacyConnectionId) return;
    updateConnection(legacyConnectionId, { endpointUrl: value });
  }

  function setUsername(value: string) {
    if (!legacyConnectionId) return;
    updateConnection(legacyConnectionId, { username: value });
  }

  function setPassword(value: string) {
    if (!legacyConnectionId) return;
    updateConnection(legacyConnectionId, { password: value });
  }

  function setModelName(value: string) {
    if (!legacyConnectionId) return;
    updateConnection(legacyConnectionId, { model: value.trim() });
  }

  function addConnection() {
    setConfig((current) => ({
      ...current,
      connections: [...current.connections, createEmptyAgentLlmConnection(current.connections.length)],
    }));
  }

  function removeConnection(connectionId: string) {
    setConfig((current) => {
      const nextConnections = current.connections.filter((connection) => connection.id !== connectionId);
      const availableKeys = nextConnections.flatMap((connection) => connection.model ? [`${connection.id}::${connection.model}`] : []);

      return {
        ...current,
        connections: nextConnections,
        routing: {
          ...current.routing,
          defaultModelKey: availableKeys.includes(current.routing.defaultModelKey ?? "")
            ? current.routing.defaultModelKey
            : null,
        },
      };
    });
  }

  void catalog;
  void hasIncompleteConnections;
  void addConnection;
  void removeConnection;

  async function saveConnection() {
    setSaving(true);
    try {
      await onSave({
        llmConfig: config,
        llmThinkingMode: thinkingMode,
      });
    } finally {
      setSaving(false);
    }
  }

  async function refreshStatus() {
    setChecking(true);
    try {
      await onRefresh();
    } finally {
      setChecking(false);
    }
  }

  return (
    <Card>
      <CardHeader className="border-b border-[rgba(255,255,255,0.06)] px-6 py-4">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <PlugZap size={15} style={{ color: AGENT_COLOR }} />
            <span className="text-sm font-bold text-[#F0F0F0]">LLM Connections</span>
          </div>
          <div
            className="inline-flex items-center gap-2 rounded-full border px-3 py-1 text-[11px] font-bold uppercase tracking-[0.16em]"
            style={{ color: statusColor, borderColor: `${statusColor}44`, backgroundColor: `${statusColor}16` }}
          >
            <span className="h-2 w-2 rounded-full" style={{ backgroundColor: statusColor }} />
            {statusLabel}
          </div>
        </div>
      </CardHeader>
      <CardBody className="p-6 space-y-4">
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <div className="md:col-span-2">
            <label className="mb-1.5 block text-sm font-medium text-[#9A9A9A]">API Endpoint URL</label>
            <div className="relative">
              <LinkIcon size={14} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[#606060]" />
              <input
                value={endpointUrl}
                onChange={(e) => setEndpointUrl(e.target.value)}
                placeholder="https://your-ngrok-url.ngrok-free.app"
                className="w-full rounded-lg border border-[rgba(255,255,255,0.06)] bg-[#1A1A1A] py-2.5 pl-9 pr-4 text-sm text-[#F0F0F0] placeholder-[#404040] focus:outline-none focus:border-[rgba(75,156,211,0.4)] transition-colors"
              />
            </div>
          </div>

          <div>
            <label className="mb-1.5 block text-sm font-medium text-[#9A9A9A]">Username</label>
            <div className="relative">
              <ShieldCheck size={14} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[#606060]" />
              <input
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="bmac"
                className="w-full rounded-lg border border-[rgba(255,255,255,0.06)] bg-[#1A1A1A] py-2.5 pl-9 pr-4 text-sm text-[#F0F0F0] placeholder-[#404040] focus:outline-none focus:border-[rgba(75,156,211,0.4)] transition-colors"
              />
            </div>
          </div>

          <div>
            <label className="mb-1.5 block text-sm font-medium text-[#9A9A9A]">Password</label>
            <div className="relative">
              <KeyRound size={14} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[#606060]" />
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Basic auth password"
                className="w-full rounded-lg border border-[rgba(255,255,255,0.06)] bg-[#1A1A1A] py-2.5 pl-9 pr-4 text-sm text-[#F0F0F0] placeholder-[#404040] focus:outline-none focus:border-[rgba(75,156,211,0.4)] transition-colors"
              />
            </div>
          </div>

          <div className="md:col-span-2">
            <label className="mb-1.5 block text-sm font-medium text-[#9A9A9A]">Model Name</label>
            <div className="relative">
              <Cpu size={14} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[#606060]" />
              <input
                value={modelName}
                onChange={(e) => setModelName(e.target.value)}
                placeholder="e.g. gemma4 — leave blank to auto-detect"
                className="w-full rounded-lg border border-[rgba(255,255,255,0.06)] bg-[#1A1A1A] py-2.5 pl-9 pr-4 text-sm text-[#F0F0F0] placeholder-[#404040] focus:outline-none focus:border-[rgba(75,156,211,0.4)] transition-colors"
              />
            </div>
            <p className="mt-1.5 text-xs text-[#606060]">Pin a specific model name. Blank = use the first model the endpoint reports.</p>
          </div>

          <div className="md:col-span-2">
            <label className="mb-1.5 block text-sm font-medium text-[#9A9A9A]">Thinking Mode</label>
            <div className="grid grid-cols-1 gap-2 md:grid-cols-3">
              {[
                { value: "off", label: "Off", description: "Reply directly without visible reasoning." },
                { value: "auto", label: "Auto", description: "Default. Think only when the prompt looks analytical." },
                { value: "always", label: "Always Think", description: "Always stream reasoning before the answer." },
              ].map((option) => (
                <button
                  key={option.value}
                  type="button"
                  onClick={() => setThinkingMode(option.value)}
                  className={cn(
                    "rounded-xl border px-4 py-3 text-left transition-all",
                    thinkingMode === option.value
                      ? "border-[rgba(75,156,211,0.45)] bg-[rgba(75,156,211,0.14)]"
                      : "border-[rgba(255,255,255,0.06)] bg-[#1A1A1A] hover:border-[rgba(75,156,211,0.22)]"
                  )}
                >
                  <p className="text-sm font-semibold text-[#F0F0F0]">{option.label}</p>
                  <p className="mt-1 text-xs leading-5 text-[#8D877F]">{option.description}</p>
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="space-y-2 rounded-xl border border-[rgba(255,255,255,0.06)] bg-[#151515] p-4">
          <div className="flex items-center gap-2 text-sm text-[#F0F0F0]">
            {agent.llmStatus === "online" ? (
              <ShieldCheck size={14} className="text-[#22C55E]" />
            ) : (
              <ShieldAlert size={14} className={agent.llmStatus === "offline" ? "text-[#EF4444]" : "text-[#8D877F]"} />
            )}
            <span>{statusLabel}</span>
          </div>
          {agent.llmModel ? (
            <p className="text-xs text-[#9A9A9A]">{modelName.trim() ? "Pinned model" : "Detected model"}: <span className="text-[#F0F0F0]">{agent.llmModel}</span></p>
          ) : null}
          <p className="text-xs text-[#9A9A9A]">
            Thinking mode: <span className="text-[#F0F0F0] capitalize">{agent.llmThinkingMode ?? "auto"}</span>
          </p>
          {agent.llmLastCheckedAt ? (
            <p className="text-xs text-[#606060]">Last checked {new Date(agent.llmLastCheckedAt).toLocaleString()}</p>
          ) : null}
          {agent.llmLastError ? (
            <p className="text-xs text-[#EF4444]">{agent.llmLastError}</p>
          ) : null}
        </div>

        <div className="flex flex-wrap gap-2">
          <Button
            size="sm"
            variant="primary"
            loading={saving}
            onClick={saveConnection}
            style={{ background: `linear-gradient(135deg, ${AGENT_COLOR}, #2980C4)` } as React.CSSProperties}
          >
            Save Connection
          </Button>
          <Button size="sm" variant="secondary" onClick={refreshStatus} loading={checking} icon={<RefreshCw size={13} />}>
            Check Connection
          </Button>
        </div>
      </CardBody>
    </Card>
  );
}

// ─── Tools & Capabilities card ───────────────────────────────────────────────

*/

const THINKING_MODE_OPTIONS: Array<{
  value: AgentLlmConnection["thinkingMode"];
  label: string;
  description: string;
}> = [
  { value: "off", label: "Off", description: "Reply directly without visible reasoning." },
  { value: "auto", label: "Auto", description: "Default. Think only when the prompt looks analytical." },
  { value: "always", label: "Always Think", description: "Always stream reasoning before the answer." },
];

function reconcileLlmConfig(config: AgentLlmConfigDocument) {
  const availableKeys = getAgentLlmCatalog(config).map((entry) => entry.key);
  return {
    ...config,
    routing: {
      ...config.routing,
      defaultModelKey: availableKeys.includes(config.routing.defaultModelKey ?? "")
        ? config.routing.defaultModelKey
        : null,
    },
  };
}

function getProviderLabel(provider: AgentLlmProvider) {
  return AGENT_LLM_PROVIDER_OPTIONS.find((option) => option.id === provider)?.label ?? "Local / Custom Endpoint";
}

function getConnectionStatusMeta(connection: AgentLlmConnection) {
  if (connection.status === "online") {
    return { label: "LLM Brain Online", color: "#22C55E" };
  }

  if (connection.status === "offline") {
    return { label: "LLM Brain Offline", color: "#EF4444" };
  }

  if (isAgentLlmConnectionConfigured(connection)) {
    return { label: "Connection Saved", color: AGENT_COLOR };
  }

  return { label: "LLM Brain Not Connected", color: "#8D877F" };
}

function LlmSecretField({
  label,
  value,
  hasStoredValue,
  placeholder,
  helperText,
  editing,
  onToggleEditing,
  onChange,
}: {
  label: string;
  value: string;
  hasStoredValue: boolean;
  placeholder: string;
  helperText?: string;
  editing: boolean;
  onToggleEditing: (next: boolean) => void;
  onChange: (value: string) => void;
}) {
  return (
    <div>
      <div className="mb-1.5 flex items-center justify-between gap-2">
        <label className="block text-sm font-medium text-[#9A9A9A]">{label}</label>
        {hasStoredValue ? (
          <button
            type="button"
            onClick={() => onToggleEditing(!editing)}
            className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[#9FCBE0]"
          >
            {editing ? "Keep Saved" : "Replace"}
          </button>
        ) : null}
      </div>
      {hasStoredValue && !editing && !value.trim() ? (
        <div className="rounded-lg border border-[rgba(255,255,255,0.06)] bg-[#151515] px-4 py-3 text-sm text-[#8D877F]">
          Saved on the server and hidden after save.
        </div>
      ) : (
        <div className="relative">
          <KeyRound size={14} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[#606060]" />
          <input
            type="password"
            value={value}
            onChange={(e) => onChange(e.target.value)}
            placeholder={placeholder}
            className="w-full rounded-lg border border-[rgba(255,255,255,0.06)] bg-[#1A1A1A] py-2.5 pl-9 pr-4 text-sm text-[#F0F0F0] placeholder-[#404040] focus:outline-none focus:border-[rgba(75,156,211,0.4)] transition-colors"
          />
        </div>
      )}
      {helperText ? <p className="mt-1.5 text-xs text-[#606060]">{helperText}</p> : null}
    </div>
  );
}

function LlmConnectionCard({
  agent,
  onSave,
  onRefresh,
}: {
  agent: Agent;
  onSave: (fields: Record<string, unknown>) => Promise<void>;
  onRefresh: (connectionId?: string) => Promise<void>;
}) {
  const [config, setConfig] = useState<AgentLlmConfigDocument>(() => getNormalizedAgentLlmConfig(agent));
  const [savingConnectionId, setSavingConnectionId] = useState<string | null>(null);
  const [checkingConnectionId, setCheckingConnectionId] = useState<string | null>(null);
  const [savingRouting, setSavingRouting] = useState(false);
  const [showProviderPicker, setShowProviderPicker] = useState(false);
  const [editingSecrets, setEditingSecrets] = useState<Record<string, boolean>>({});

  useEffect(() => {
    setConfig(getNormalizedAgentLlmConfig(agent));
    setShowProviderPicker(false);
    setEditingSecrets({});
  }, [agent]);

  const catalog = getAgentLlmCatalog(config);

  function updateConnectionFields(connectionId: string, patch: Partial<AgentLlmConnection>) {
    updateConnection(connectionId, (connection) => ({ ...connection, ...patch }));
  }

  function updateConnectionAuth(connectionId: string, patch: Partial<AgentLlmConnection["auth"]>) {
    updateConnection(connectionId, (connection) => ({
      ...connection,
      auth: { ...connection.auth, ...patch },
    }));
  }

  function updateConnectionSettings(connectionId: string, patch: Partial<AgentLlmConnection["connection"]>) {
    updateConnection(connectionId, (connection) => ({
      ...connection,
      connection: { ...connection.connection, ...patch },
    }));
  }

  function updateConnection(connectionId: string, updater: (connection: AgentLlmConnection) => AgentLlmConnection) {
    setConfig((current) => reconcileLlmConfig({
      ...current,
      connections: current.connections.map((connection) =>
        connection.id === connectionId ? updater(connection) : connection
      ),
    }));
  }

  function setSecretEditing(connectionId: string, field: "password" | "apiKey" | "secretAccessKey", next: boolean) {
    setEditingSecrets((current) => {
      const key = `${connectionId}:${field}`;
      if (!next) {
        const nextState = { ...current };
        delete nextState[key];
        return nextState;
      }

      return { ...current, [key]: true };
    });
  }

  function isSecretEditing(connectionId: string, field: "password" | "apiKey" | "secretAccessKey") {
    return Boolean(editingSecrets[`${connectionId}:${field}`]);
  }

  function addConnection(provider: AgentLlmProvider) {
    setConfig((current) => ({
      ...current,
      connections: [...current.connections, createEmptyAgentLlmConnection(current.connections.length, provider)],
    }));
    setShowProviderPicker(false);
  }

  function removeConnection(connectionId: string) {
    setConfig((current) => {
      if (current.connections.length <= 1) {
        return current;
      }

      const nextConfig = reconcileLlmConfig({
        ...current,
        connections: current.connections.filter((connection) => connection.id !== connectionId),
      });
      return nextConfig;
    });
  }

  async function saveConnection(connectionId: string) {
    setSavingConnectionId(connectionId);
    try {
      await onSave({
        llmConfig: config,
        probeConnectionId: connectionId,
      });
    } finally {
      setSavingConnectionId(null);
    }
  }

  async function refreshConnection(connectionId: string) {
    setCheckingConnectionId(connectionId);
    try {
      await onRefresh(connectionId);
    } finally {
      setCheckingConnectionId(null);
    }
  }

  async function saveRoutingSettings() {
    setSavingRouting(true);
    try {
      await onSave({ llmConfig: config });
    } finally {
      setSavingRouting(false);
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-sm font-semibold text-[#F0F0F0]">LLM Connections</p>
          <p className="mt-1 text-xs leading-5 text-[#606060]">
            Add one or more LLM cards for this agent. Routing only uses enabled, configured cards saved here.
          </p>
        </div>
        <Button size="sm" variant="secondary" onClick={() => setShowProviderPicker((current) => !current)} icon={<Plus size={13} />}>
          Add LLM
        </Button>
      </div>

      {showProviderPicker ? (
        <Card>
          <CardHeader className="border-b border-[rgba(255,255,255,0.06)] px-6 py-4">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-sm font-bold text-[#F0F0F0]">Choose a Provider</p>
                <p className="mt-1 text-xs text-[#606060]">Pick the source first, then configure the new card.</p>
              </div>
              <Button size="sm" variant="secondary" onClick={() => setShowProviderPicker(false)}>
                Cancel
              </Button>
            </div>
          </CardHeader>
          <CardBody className="grid gap-3 p-6 md:grid-cols-2">
            {AGENT_LLM_PROVIDER_OPTIONS.map((option) => (
              <button
                key={option.id}
                type="button"
                onClick={() => addConnection(option.id)}
                className="rounded-2xl border border-[rgba(255,255,255,0.06)] bg-[#171717] px-4 py-4 text-left transition-all hover:border-[rgba(75,156,211,0.32)] hover:bg-[rgba(75,156,211,0.08)]"
              >
                <p className="text-sm font-semibold text-[#F0F0F0]">{option.label}</p>
                <p className="mt-1 text-xs leading-5 text-[#8D877F]">{option.description}</p>
              </button>
            ))}
          </CardBody>
        </Card>
      ) : null}

      {config.connections.map((connection, index) => {
        const statusMeta = getConnectionStatusMeta(connection);
        const canRoute = isAgentLlmConnectionConfigured(connection);
        const isLocal = connection.provider === "local";
        const isOpenAi = connection.provider === "openai";
        const isAnthropic = connection.provider === "anthropic";
        const isBedrock = connection.provider === "bedrock";

        return (
          <Card key={connection.id}>
            <CardHeader className="border-b border-[rgba(255,255,255,0.06)] px-6 py-4">
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  <PlugZap size={15} style={{ color: AGENT_COLOR }} />
                  <span className="text-sm font-bold text-[#F0F0F0]">LLM Connection</span>
                  {config.connections.length > 1 ? (
                    <span className="rounded-full border border-[rgba(255,255,255,0.08)] px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.16em] text-[#606060]">
                      {index + 1}
                    </span>
                  ) : null}
                </div>
                <div
                  className="inline-flex items-center gap-2 rounded-full border px-3 py-1 text-[11px] font-bold uppercase tracking-[0.16em]"
                  style={{ color: statusMeta.color, borderColor: `${statusMeta.color}44`, backgroundColor: `${statusMeta.color}16` }}
                >
                  <span className="h-2 w-2 rounded-full" style={{ backgroundColor: statusMeta.color }} />
                  {statusMeta.label}
                </div>
              </div>
            </CardHeader>
            <CardBody className="space-y-4 p-6">
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <div>
                  <label className="mb-1.5 block text-sm font-medium text-[#9A9A9A]">Label</label>
                  <input
                    value={connection.label}
                    onChange={(e) => updateConnectionFields(connection.id, { label: e.target.value })}
                    placeholder={getProviderLabel(connection.provider)}
                    className="w-full rounded-lg border border-[rgba(255,255,255,0.06)] bg-[#1A1A1A] px-4 py-2.5 text-sm text-[#F0F0F0] placeholder-[#404040] focus:outline-none focus:border-[rgba(75,156,211,0.4)]"
                  />
                </div>

                <div>
                  <label className="mb-1.5 block text-sm font-medium text-[#9A9A9A]">Provider</label>
                  <select
                    value={connection.provider}
                    onChange={(e) => updateConnection(connection.id, (current) => switchAgentLlmConnectionProvider(current, e.target.value as AgentLlmProvider))}
                    className="w-full rounded-lg border border-[rgba(255,255,255,0.06)] bg-[#1A1A1A] px-4 py-2.5 text-sm text-[#F0F0F0] focus:outline-none focus:border-[rgba(75,156,211,0.4)]"
                  >
                    {AGENT_LLM_PROVIDER_OPTIONS.map((option) => (
                      <option key={option.id} value={option.id}>{option.label}</option>
                    ))}
                  </select>
                </div>

                <div className="md:col-span-2">
                  <label className="flex items-center justify-between rounded-xl border border-[rgba(255,255,255,0.06)] bg-[#171717] px-4 py-3 text-sm text-[#F0F0F0]">
                    <span className="font-medium">Enabled for routing</span>
                    <input
                      type="checkbox"
                      checked={connection.enabled}
                      onChange={(e) => updateConnectionFields(connection.id, { enabled: e.target.checked })}
                      className="h-4 w-4 accent-[#4B9CD3]"
                    />
                  </label>
                </div>

                {isLocal ? (
                  <>
                    <div className="md:col-span-2">
                      <label className="mb-1.5 block text-sm font-medium text-[#9A9A9A]">API Endpoint URL</label>
                      <div className="relative">
                        <LinkIcon size={14} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[#606060]" />
                        <input
                          value={connection.connection.endpointUrl}
                          onChange={(e) => updateConnectionSettings(connection.id, { endpointUrl: e.target.value })}
                          placeholder="https://your-ngrok-url.ngrok-free.app"
                          className="w-full rounded-lg border border-[rgba(255,255,255,0.06)] bg-[#1A1A1A] py-2.5 pl-9 pr-4 text-sm text-[#F0F0F0] placeholder-[#404040] focus:outline-none focus:border-[rgba(75,156,211,0.4)] transition-colors"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="mb-1.5 block text-sm font-medium text-[#9A9A9A]">Username</label>
                      <div className="relative">
                        <ShieldCheck size={14} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[#606060]" />
                        <input
                          value={connection.auth.username}
                          onChange={(e) => updateConnectionAuth(connection.id, { username: e.target.value })}
                          placeholder="bmac"
                          className="w-full rounded-lg border border-[rgba(255,255,255,0.06)] bg-[#1A1A1A] py-2.5 pl-9 pr-4 text-sm text-[#F0F0F0] placeholder-[#404040] focus:outline-none focus:border-[rgba(75,156,211,0.4)] transition-colors"
                        />
                      </div>
                    </div>

                    <LlmSecretField
                      label="Password"
                      value={connection.auth.password}
                      hasStoredValue={Boolean(connection.auth.hasPassword)}
                      placeholder="Basic auth password"
                      helperText="Stored server-side. Replace it only when the endpoint credentials change."
                      editing={isSecretEditing(connection.id, "password")}
                      onToggleEditing={(next) => setSecretEditing(connection.id, "password", next)}
                      onChange={(value) => updateConnectionAuth(connection.id, {
                        password: value,
                        hasPassword: Boolean(value.trim() || connection.auth.hasPassword),
                      })}
                    />

                    <div className="md:col-span-2">
                      <label className="mb-1.5 block text-sm font-medium text-[#9A9A9A]">Model</label>
                      <div className="relative">
                        <Cpu size={14} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[#606060]" />
                        <input
                          value={connection.model}
                          onChange={(e) => updateConnectionFields(connection.id, { model: e.target.value })}
                          placeholder="e.g. gemma4 - leave blank to auto-detect"
                          className="w-full rounded-lg border border-[rgba(255,255,255,0.06)] bg-[#1A1A1A] py-2.5 pl-9 pr-4 text-sm text-[#F0F0F0] placeholder-[#404040] focus:outline-none focus:border-[rgba(75,156,211,0.4)] transition-colors"
                        />
                      </div>
                      <p className="mt-1.5 text-xs text-[#606060]">Pin a specific model name. Blank = use the first model the endpoint reports.</p>
                    </div>
                  </>
                ) : null}

                {isOpenAi ? (
                  <>
                    <LlmSecretField
                      label="API Key"
                      value={connection.auth.apiKey}
                      hasStoredValue={Boolean(connection.auth.hasApiKey)}
                      placeholder="sk-..."
                      helperText="Stored server-side. This key is used only for this agent card."
                      editing={isSecretEditing(connection.id, "apiKey")}
                      onToggleEditing={(next) => setSecretEditing(connection.id, "apiKey", next)}
                      onChange={(value) => updateConnectionAuth(connection.id, {
                        apiKey: value,
                        hasApiKey: Boolean(value.trim() || connection.auth.hasApiKey),
                      })}
                    />

                    <div>
                      <label className="mb-1.5 block text-sm font-medium text-[#9A9A9A]">Model</label>
                      <div className="relative">
                        <Cpu size={14} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[#606060]" />
                        <input
                          value={connection.model}
                          onChange={(e) => updateConnectionFields(connection.id, { model: e.target.value })}
                          placeholder="gpt-4.1"
                          className="w-full rounded-lg border border-[rgba(255,255,255,0.06)] bg-[#1A1A1A] py-2.5 pl-9 pr-4 text-sm text-[#F0F0F0] placeholder-[#404040] focus:outline-none focus:border-[rgba(75,156,211,0.4)] transition-colors"
                        />
                      </div>
                    </div>

                    <div className="md:col-span-2">
                      <label className="mb-1.5 block text-sm font-medium text-[#9A9A9A]">Base URL Override</label>
                      <div className="relative">
                        <LinkIcon size={14} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[#606060]" />
                        <input
                          value={connection.connection.endpointUrl}
                          onChange={(e) => updateConnectionSettings(connection.id, { endpointUrl: e.target.value })}
                          placeholder="Optional - defaults to api.openai.com"
                          className="w-full rounded-lg border border-[rgba(255,255,255,0.06)] bg-[#1A1A1A] py-2.5 pl-9 pr-4 text-sm text-[#F0F0F0] placeholder-[#404040] focus:outline-none focus:border-[rgba(75,156,211,0.4)] transition-colors"
                        />
                      </div>
                    </div>
                  </>
                ) : null}

                {isAnthropic ? (
                  <>
                    <LlmSecretField
                      label="API Key"
                      value={connection.auth.apiKey}
                      hasStoredValue={Boolean(connection.auth.hasApiKey)}
                      placeholder="sk-ant-..."
                      helperText="Stored server-side. This key is used only for this agent card."
                      editing={isSecretEditing(connection.id, "apiKey")}
                      onToggleEditing={(next) => setSecretEditing(connection.id, "apiKey", next)}
                      onChange={(value) => updateConnectionAuth(connection.id, {
                        apiKey: value,
                        hasApiKey: Boolean(value.trim() || connection.auth.hasApiKey),
                      })}
                    />

                    <div>
                      <label className="mb-1.5 block text-sm font-medium text-[#9A9A9A]">Model</label>
                      <div className="relative">
                        <Cpu size={14} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[#606060]" />
                        <input
                          value={connection.model}
                          onChange={(e) => updateConnectionFields(connection.id, { model: e.target.value })}
                          placeholder="claude-3-7-sonnet-latest"
                          className="w-full rounded-lg border border-[rgba(255,255,255,0.06)] bg-[#1A1A1A] py-2.5 pl-9 pr-4 text-sm text-[#F0F0F0] placeholder-[#404040] focus:outline-none focus:border-[rgba(75,156,211,0.4)] transition-colors"
                        />
                      </div>
                    </div>

                    <div className="md:col-span-2">
                      <label className="mb-1.5 block text-sm font-medium text-[#9A9A9A]">Base URL Override</label>
                      <div className="relative">
                        <LinkIcon size={14} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[#606060]" />
                        <input
                          value={connection.connection.endpointUrl}
                          onChange={(e) => updateConnectionSettings(connection.id, { endpointUrl: e.target.value })}
                          placeholder="Optional - defaults to api.anthropic.com"
                          className="w-full rounded-lg border border-[rgba(255,255,255,0.06)] bg-[#1A1A1A] py-2.5 pl-9 pr-4 text-sm text-[#F0F0F0] placeholder-[#404040] focus:outline-none focus:border-[rgba(75,156,211,0.4)] transition-colors"
                        />
                      </div>
                    </div>
                  </>
                ) : null}

                {isBedrock ? (
                  <>
                    <div>
                      <label className="mb-1.5 block text-sm font-medium text-[#9A9A9A]">Region</label>
                      <input
                        value={connection.connection.region}
                        onChange={(e) => updateConnectionSettings(connection.id, { region: e.target.value })}
                        placeholder="us-east-1"
                        className="w-full rounded-lg border border-[rgba(255,255,255,0.06)] bg-[#1A1A1A] px-4 py-2.5 text-sm text-[#F0F0F0] placeholder-[#404040] focus:outline-none focus:border-[rgba(75,156,211,0.4)]"
                      />
                    </div>

                    <div>
                      <label className="mb-1.5 block text-sm font-medium text-[#9A9A9A]">Access Key ID</label>
                      <div className="relative">
                        <ShieldCheck size={14} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[#606060]" />
                        <input
                          value={connection.auth.accessKeyId}
                          onChange={(e) => updateConnectionAuth(connection.id, { accessKeyId: e.target.value })}
                          placeholder="AKIA..."
                          className="w-full rounded-lg border border-[rgba(255,255,255,0.06)] bg-[#1A1A1A] py-2.5 pl-9 pr-4 text-sm text-[#F0F0F0] placeholder-[#404040] focus:outline-none focus:border-[rgba(75,156,211,0.4)] transition-colors"
                        />
                      </div>
                    </div>

                    <LlmSecretField
                      label="Secret Access Key"
                      value={connection.auth.secretAccessKey}
                      hasStoredValue={Boolean(connection.auth.hasSecretAccessKey)}
                      placeholder="AWS secret access key"
                      helperText="Stored server-side. Replace it only when the AWS credentials change."
                      editing={isSecretEditing(connection.id, "secretAccessKey")}
                      onToggleEditing={(next) => setSecretEditing(connection.id, "secretAccessKey", next)}
                      onChange={(value) => updateConnectionAuth(connection.id, {
                        secretAccessKey: value,
                        hasSecretAccessKey: Boolean(value.trim() || connection.auth.hasSecretAccessKey),
                      })}
                    />

                    <div>
                      <label className="mb-1.5 block text-sm font-medium text-[#9A9A9A]">Model</label>
                      <div className="relative">
                        <Cpu size={14} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[#606060]" />
                        <input
                          value={connection.model}
                          onChange={(e) => updateConnectionFields(connection.id, { model: e.target.value })}
                          placeholder="anthropic.claude-3-5-sonnet-20240620-v1:0"
                          className="w-full rounded-lg border border-[rgba(255,255,255,0.06)] bg-[#1A1A1A] py-2.5 pl-9 pr-4 text-sm text-[#F0F0F0] placeholder-[#404040] focus:outline-none focus:border-[rgba(75,156,211,0.4)] transition-colors"
                        />
                      </div>
                    </div>

                    <div className="md:col-span-2">
                      <label className="mb-1.5 block text-sm font-medium text-[#9A9A9A]">Endpoint Override</label>
                      <div className="relative">
                        <LinkIcon size={14} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[#606060]" />
                        <input
                          value={connection.connection.endpointUrl}
                          onChange={(e) => updateConnectionSettings(connection.id, { endpointUrl: e.target.value })}
                          placeholder="Optional - defaults to the Bedrock runtime endpoint for the selected region"
                          className="w-full rounded-lg border border-[rgba(255,255,255,0.06)] bg-[#1A1A1A] py-2.5 pl-9 pr-4 text-sm text-[#F0F0F0] placeholder-[#404040] focus:outline-none focus:border-[rgba(75,156,211,0.4)] transition-colors"
                        />
                      </div>
                    </div>
                  </>
                ) : null}

                <div className="md:col-span-2">
                  <label className="mb-1.5 block text-sm font-medium text-[#9A9A9A]">Thinking Mode</label>
                  <div className="grid grid-cols-1 gap-2 md:grid-cols-3">
                    {THINKING_MODE_OPTIONS.map((option) => (
                      <button
                        key={option.value}
                        type="button"
                        onClick={() => updateConnectionFields(connection.id, { thinkingMode: option.value })}
                        className={cn(
                          "rounded-xl border px-4 py-3 text-left transition-all",
                          connection.thinkingMode === option.value
                            ? "border-[rgba(75,156,211,0.45)] bg-[rgba(75,156,211,0.14)]"
                            : "border-[rgba(255,255,255,0.06)] bg-[#1A1A1A] hover:border-[rgba(75,156,211,0.22)]"
                        )}
                      >
                        <p className="text-sm font-semibold text-[#F0F0F0]">{option.label}</p>
                        <p className="mt-1 text-xs leading-5 text-[#8D877F]">{option.description}</p>
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              <div className="space-y-2 rounded-xl border border-[rgba(255,255,255,0.06)] bg-[#151515] p-4">
                <div className="flex items-center gap-2 text-sm text-[#F0F0F0]">
                  {connection.status === "online" ? (
                    <ShieldCheck size={14} className="text-[#22C55E]" />
                  ) : (
                    <ShieldAlert size={14} className={connection.status === "offline" ? "text-[#EF4444]" : "text-[#8D877F]"} />
                  )}
                  <span>{statusMeta.label}</span>
                </div>
                <p className="text-xs text-[#9A9A9A]">
                  Provider: <span className="text-[#F0F0F0]">{getProviderLabel(connection.provider)}</span>
                </p>
                <p className="text-xs text-[#9A9A9A]">
                  Thinking mode: <span className="text-[#F0F0F0] capitalize">{connection.thinkingMode}</span>
                </p>
                {connection.model.trim() ? (
                  <p className="text-xs text-[#9A9A9A]">Model: <span className="text-[#F0F0F0]">{connection.model.trim()}</span></p>
                ) : isLocal ? (
                  <p className="text-xs text-[#606060]">Leave the model blank to let the endpoint auto-detect its first available model.</p>
                ) : (
                  <p className="text-xs text-[#606060]">Add a model before routing or testing this hosted provider card.</p>
                )}
                {!connection.enabled ? (
                  <p className="text-xs text-[#606060]">This card is disabled and excluded from routing.</p>
                ) : canRoute ? (
                  <p className="text-xs text-[#606060]">This card is available to routing after you save it.</p>
                ) : null}
                {connection.lastValidatedAt ? (
                  <p className="text-xs text-[#606060]">Last checked {new Date(connection.lastValidatedAt).toLocaleString()}</p>
                ) : null}
                {connection.validationError ? (
                  <p className="text-xs text-[#EF4444]">{connection.validationError}</p>
                ) : null}
              </div>

              <div className="flex flex-wrap gap-2">
                <Button
                  size="sm"
                  variant="primary"
                  loading={savingConnectionId === connection.id}
                  onClick={() => saveConnection(connection.id)}
                  style={{ background: `linear-gradient(135deg, ${AGENT_COLOR}, #2980C4)` } as React.CSSProperties}
                >
                  Save Connection
                </Button>
                <Button
                  size="sm"
                  variant="secondary"
                  onClick={() => refreshConnection(connection.id)}
                  loading={checkingConnectionId === connection.id}
                  icon={<RefreshCw size={13} />}
                >
                  Test Connection
                </Button>
                {config.connections.length > 1 ? (
                  <Button size="sm" variant="secondary" onClick={() => removeConnection(connection.id)} icon={<Trash2 size={13} />}>
                    Remove
                  </Button>
                ) : null}
              </div>
            </CardBody>
          </Card>
        );
      })}

        {/* Legacy Available Models block removed.
          <div className="rounded-2xl border border-[rgba(255,255,255,0.06)] bg-[#121212] p-4">
            <p className="text-sm font-semibold text-[#F0F0F0]">Available Models</p>
          <p className="mt-1 text-xs leading-5 text-[#606060]">
            This is the allowed model catalog for the agent. Routing can only select from these entries.
          </p>
          <div className="mt-4 grid gap-3">
            {catalog.length === 0 ? (
              <div className="rounded-xl border border-dashed border-[rgba(255,255,255,0.08)] bg-[#161616] px-4 py-5 text-sm text-[#606060]">
                Add one or more model names to a connection to make them available here.
              </div>
            ) : (
              catalog.map((entry) => (
                <div
                  key={entry.key}
                  className={cn(
                    "flex flex-wrap items-center justify-between gap-3 rounded-xl border px-4 py-3",
                    config.routing.defaultModelKey === entry.key
                      ? "border-[rgba(75,156,211,0.4)] bg-[rgba(75,156,211,0.1)]"
                      : "border-[rgba(255,255,255,0.06)] bg-[#171717]"
                  )}
                >
                  <div>
                    <p className="text-sm font-semibold text-[#F0F0F0]">{entry.model}</p>
                    <p className="mt-1 text-xs text-[#8D877F]">{entry.connectionLabel} · {entry.provider}</p>
                  </div>
                  {config.routing.defaultModelKey === entry.key ? (
                    <span className="rounded-full border border-[rgba(75,156,211,0.35)] bg-[rgba(75,156,211,0.14)] px-2.5 py-1 text-[11px] font-semibold text-[#9FCBE0]">
                      Default Model
                    </span>
                  ) : null}
                </div>
              ))
            )}
          </div>
          </div>
        */}

        <Card>
          <CardHeader className="border-b border-[rgba(255,255,255,0.06)] px-6 py-4">
            <div className="flex items-center gap-2">
              <Sliders size={15} style={{ color: AGENT_COLOR }} />
              <span className="text-sm font-bold text-[#F0F0F0]">Routing Settings</span>
            </div>
          </CardHeader>
          <CardBody className="p-6 space-y-4">
            <p className="mt-1 text-xs leading-5 text-[#606060]">
              Auto route by task once the thread is scoped. The default model list comes from the saved LLM cards above.
            </p>

            <div className="mt-4 space-y-3">
              {[
                {
                  key: "autoRoute",
                  label: "Auto Route by Task",
                  value: config.routing.autoRoute,
                  toggle: () => setConfig((current) => ({
                    ...current,
                    routing: { ...current.routing, autoRoute: !current.routing.autoRoute },
                  })),
                },
                {
                  key: "allowEscalation",
                  label: "Allow Escalation",
                  value: config.routing.allowEscalation,
                  toggle: () => setConfig((current) => ({
                    ...current,
                    routing: { ...current.routing, allowEscalation: !current.routing.allowEscalation },
                  })),
                },
              ].map((option) => (
                <button
                  key={option.key}
                  type="button"
                  onClick={option.toggle}
                  className={cn(
                    "flex w-full items-center justify-between rounded-xl border px-4 py-3 text-left transition-all",
                    option.value
                      ? "border-[rgba(75,156,211,0.4)] bg-[rgba(75,156,211,0.12)]"
                      : "border-[rgba(255,255,255,0.06)] bg-[#171717]"
                  )}
                >
                  <span className="text-sm font-medium text-[#F0F0F0]">{option.label}</span>
                  <span className={cn("text-xs font-semibold", option.value ? "text-[#9FCBE0]" : "text-[#606060]")}>
                    {option.value ? "Enabled" : "Off"}
                  </span>
                </button>
              ))}
            </div>

            <div className="mt-4">
              <label className="mb-1.5 block text-sm font-medium text-[#9A9A9A]">Default Model</label>
              <select
                value={config.routing.defaultModelKey ?? ""}
                onChange={(e) => setConfig((current) => reconcileLlmConfig({
                  ...current,
                  routing: {
                    ...current.routing,
                    defaultModelKey: e.target.value || null,
                  },
                }))}
                className="w-full rounded-lg border border-[rgba(255,255,255,0.06)] bg-[#1A1A1A] px-4 py-2.5 text-sm text-[#F0F0F0] focus:outline-none focus:border-[rgba(75,156,211,0.4)]"
                disabled={catalog.length === 0}
              >
                <option value="">No pinned default model</option>
                {catalog.map((entry) => (
                  <option key={entry.key} value={entry.key}>{entry.label}</option>
                ))}
              </select>
              <p className="mt-1.5 text-xs text-[#606060]">If routing does not need to promote or escalate, the thread starts on this saved card.</p>
            </div>

            <div className="flex flex-wrap gap-2">
              <Button
                size="sm"
                variant="primary"
                loading={savingRouting}
                onClick={saveRoutingSettings}
                style={{ background: `linear-gradient(135deg, ${AGENT_COLOR}, #2980C4)` } as React.CSSProperties}
              >
                Save Routing Settings
              </Button>
            </div>
          </CardBody>
      </Card>
    </div>
  );
}

const TOOL_DESCRIPTIONS: Record<string, string> = {
  get_active_tasks: "Read planner and kanban tasks, including newest cards, board summaries, assignees, and priorities.",
  list_kanban_boards: "Read all boards, columns, and cards so the agent can reference them.",
  create_kanban_card: "Create new cards in any kanban column.",
  update_kanban_card: "Edit the title, description, priority, labels, or state of a card.",
  move_kanban_card: "Move a card from one column to another.",
  delete_kanban_card: "Permanently delete a kanban card.",
  get_customer_details: "Look up customer health, contacts, and recent notes.",
  get_weekly_notes: "Read the latest weekly notes across customers.",
  list_repos: "List all connected code repositories with metadata.",
  get_repo_details: "Fetch details about a repo including its board and AWS resources.",
};

const TOOL_CATEGORIES: Record<string, string> = {
  get_active_tasks: "Kanban",
  list_kanban_boards: "Kanban",
  create_kanban_card: "Kanban",
  update_kanban_card: "Kanban",
  move_kanban_card: "Kanban",
  delete_kanban_card: "Kanban",
  get_customer_details: "Customers",
  get_weekly_notes: "Customers",
  list_repos: "Codebase",
  get_repo_details: "Codebase",
};

function parseDisabledTools(raw: string): string[] {
  try { return JSON.parse(raw) ?? []; } catch { return []; }
}

function ToolsCard({
  disabledTools: disabledToolsRaw,
  onSave,
}: {
  disabledTools: string;
  onSave: (fields: Record<string, unknown>) => Promise<void>;
}) {
  const [disabled, setDisabled] = useState<string[]>(() => parseDisabledTools(disabledToolsRaw));
  const [saving, setSaving] = useState<string | null>(null);

  useEffect(() => { setDisabled(parseDisabledTools(disabledToolsRaw)); }, [disabledToolsRaw]);

  async function toggleTool(toolName: string) {
    const isDisabled = disabled.includes(toolName);
    const next = isDisabled
      ? disabled.filter((t) => t !== toolName)
      : [...disabled, toolName];

    setSaving(toolName);
    setDisabled(next);
    try {
      await onSave({ disabledTools: next });
    } finally {
      setSaving(null);
    }
  }

  const totalTools = agentChatTools.length;
  const enabledCount = totalTools - disabled.length;

  // Group tools by category
  const categories = Array.from(new Set(agentChatTools.map((t) => TOOL_CATEGORIES[t.function.name] ?? "Other")));

  return (
    <Card>
      <CardHeader className="border-b border-[rgba(255,255,255,0.06)] px-6 py-4">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <Wrench size={15} style={{ color: AGENT_COLOR }} />
            <span className="text-sm font-bold text-[#F0F0F0]">Tools & Capabilities</span>
          </div>
          <span
            className="text-[11px] font-semibold rounded-full px-2.5 py-1 border"
            style={{ color: AGENT_COLOR, borderColor: `${AGENT_COLOR}40`, backgroundColor: AGENT_COLOR_DIM }}
          >
            {enabledCount} / {totalTools} enabled
          </span>
        </div>
      </CardHeader>
      <CardBody className="p-6 space-y-6">
        <p className="text-xs text-[#606060] leading-5">
          Control which actions this agent is allowed to take during chat. Disabled tools are never sent to the model.
        </p>

        {categories.map((category) => {
          const categoryTools = agentChatTools.filter((t) => (TOOL_CATEGORIES[t.function.name] ?? "Other") === category);
          return (
            <div key={category}>
              <p className="mb-3 text-[10px] font-bold uppercase tracking-[0.18em] text-[#606060]">{category}</p>
              <div className="space-y-2">
                {categoryTools.map((tool) => {
                  const name = tool.function.name;
                  const isEnabled = !disabled.includes(name);
                  const isSaving = saving === name;

                  return (
                    <div
                      key={name}
                      className="flex items-start gap-3 rounded-xl border px-4 py-3 transition-all"
                      style={{
                        borderColor: isEnabled ? `${AGENT_COLOR}30` : "rgba(255,255,255,0.06)",
                        backgroundColor: isEnabled ? AGENT_COLOR_DIM : "rgba(255,255,255,0.02)",
                      }}
                    >
                      {/* Toggle */}
                      <button
                        type="button"
                        onClick={() => toggleTool(name)}
                        disabled={isSaving}
                        className="mt-0.5 relative flex-shrink-0 w-9 h-5 rounded-full border transition-all focus:outline-none disabled:opacity-60"
                        style={{
                          backgroundColor: isEnabled ? AGENT_COLOR : "rgba(255,255,255,0.08)",
                          borderColor: isEnabled ? AGENT_COLOR : "rgba(255,255,255,0.12)",
                        }}
                        aria-label={isEnabled ? `Disable ${TOOL_LABELS[name]}` : `Enable ${TOOL_LABELS[name]}`}
                      >
                        {isSaving ? (
                          <Loader2 size={10} className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 animate-spin text-white" />
                        ) : (
                          <span
                            className="absolute top-0.5 w-4 h-4 rounded-full bg-white shadow-sm transition-all"
                            style={{ left: isEnabled ? "calc(100% - 18px)" : "2px" }}
                          />
                        )}
                      </button>

                      {/* Info */}
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold text-[#F0F0F0]">{TOOL_LABELS[name] ?? name}</p>
                        <p className="text-xs text-[#606060] mt-0.5 leading-5">
                          {TOOL_DESCRIPTIONS[name] ?? tool.function.description}
                        </p>
                      </div>
                    </div>
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

function AbilitiesCard({
  abilities: abilitiesRaw,
  onSave,
}: {
  abilities: string;
  onSave: (fields: Record<string, unknown>) => Promise<void>;
}) {
  const [abilities, setAbilities] = useState<AgentAbility[]>(() => normalizeAgentAbilities(abilitiesRaw));
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    setAbilities(normalizeAgentAbilities(abilitiesRaw));
  }, [abilitiesRaw]);

  async function saveAbilities(next: AgentAbility[]) {
    setSaving(true);
    try {
      await onSave({ abilities: next });
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } finally {
      setSaving(false);
    }
  }

  function updateAbility(index: number, patch: Partial<AgentAbility>) {
    setAbilities((current) =>
      current.map((ability, currentIndex) => currentIndex === index ? { ...ability, ...patch } : ability)
    );
  }

  function addAbility() {
    const baseLabel = `New Ability ${abilities.length + 1}`;
    let nextId = slugifyAbilityId(baseLabel);
    let suffix = 2;
    while (abilities.some((ability) => ability.id === nextId)) {
      nextId = slugifyAbilityId(`${baseLabel} ${suffix}`);
      suffix += 1;
    }

    setAbilities((current) => [
      ...current,
      {
        id: nextId,
        label: baseLabel,
        description: "Describe when this ability should be used.",
        prompt: "Describe exactly what the agent should produce when using this ability.",
      },
    ]);
  }

  function deleteAbility(index: number) {
    setAbilities((current) => current.filter((_, currentIndex) => currentIndex !== index));
  }

  function resetDefaults() {
    setAbilities(getDefaultAgentAbilities());
  }

  const canSave = abilities.every((ability) => ability.id.trim() && ability.label.trim() && ability.prompt.trim());
  const hasDuplicateIds = new Set(abilities.map((ability) => ability.id.trim())).size !== abilities.length;

  async function persist() {
    if (!canSave || hasDuplicateIds) return;
    await saveAbilities(abilities.map((ability) => ({
      ...ability,
      id: slugifyAbilityId(ability.id),
      label: ability.label.trim(),
      description: ability.description.trim(),
      prompt: ability.prompt.trim(),
    })));
  }

  return (
    <Card>
      <CardHeader className="border-b border-[rgba(255,255,255,0.06)] px-6 py-4">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <WandSparkles size={15} style={{ color: AGENT_COLOR }} />
            <span className="text-sm font-bold text-[#F0F0F0]">Execution Abilities</span>
          </div>
          <span
            className="text-[11px] font-semibold rounded-full px-2.5 py-1 border"
            style={{ color: AGENT_COLOR, borderColor: `${AGENT_COLOR}40`, backgroundColor: AGENT_COLOR_DIM }}
          >
            {abilities.length} custom
          </span>
        </div>
      </CardHeader>
      <CardBody className="p-6 space-y-5">
        <p className="text-xs leading-5 text-[#606060]">
          Create, edit, and delete the exact execution abilities this agent should offer. Each ability has its own title, description, and execution prompt.
        </p>

        <div className="flex flex-wrap gap-2">
          <Button size="sm" variant="secondary" onClick={addAbility}>
            Add Ability
          </Button>
          <Button size="sm" variant="secondary" onClick={resetDefaults}>
            Reset Defaults
          </Button>
          <Button size="sm" variant="primary" onClick={persist} loading={saving} disabled={!canSave || hasDuplicateIds}>
            Save Abilities
          </Button>
          {saved && <span className="self-center text-xs text-[#22C55E]">Saved</span>}
        </div>

        {hasDuplicateIds && (
          <p className="text-xs text-[#EF4444]">Ability ids must be unique.</p>
        )}

        <div className="space-y-4">
          {abilities.map((ability, index) => {
            const duplicateIdCount = abilities.filter((entry) => entry.id.trim() === ability.id.trim()).length;
            return (
              <div
                key={`${ability.id}-${index}`}
                className="rounded-xl border p-4 transition-all"
                style={{
                  borderColor: `${AGENT_COLOR}20`,
                  backgroundColor: "rgba(255,255,255,0.02)",
                }}
              >
                <div className="mb-3 flex items-center justify-between gap-3">
                  <div>
                    <p className="text-sm font-semibold text-[#F0F0F0]">{ability.label || `Ability ${index + 1}`}</p>
                    <p className="mt-1 font-mono text-[10px] uppercase tracking-[0.14em] text-[#4E6B7E]">{ability.id || "missing_id"}</p>
                  </div>
                  <Button size="sm" variant="secondary" onClick={() => deleteAbility(index)} disabled={abilities.length === 1}>
                    Delete
                  </Button>
                </div>

                <div className="grid grid-cols-1 gap-4">
                  <div>
                    <label className="mb-1.5 block text-xs font-semibold uppercase tracking-[0.14em] text-[#707070]">Ability Id</label>
                    <input
                      value={ability.id}
                      onChange={(e) => updateAbility(index, { id: e.target.value })}
                      className="w-full rounded-lg border border-[rgba(255,255,255,0.06)] bg-[#1A1A1A] px-4 py-2.5 text-sm text-[#F0F0F0] focus:outline-none focus:border-[rgba(75,156,211,0.4)]"
                    />
                    <p className="mt-1 text-[11px] text-[#5E6A73]">
                      Saved as: <span className="font-mono">{slugifyAbilityId(ability.id)}</span>
                    </p>
                    {duplicateIdCount > 1 && <p className="mt-1 text-[11px] text-[#EF4444]">This id is already in use.</p>}
                  </div>

                  <div>
                    <label className="mb-1.5 block text-xs font-semibold uppercase tracking-[0.14em] text-[#707070]">Label</label>
                    <input
                      value={ability.label}
                      onChange={(e) => updateAbility(index, { label: e.target.value })}
                      className="w-full rounded-lg border border-[rgba(255,255,255,0.06)] bg-[#1A1A1A] px-4 py-2.5 text-sm text-[#F0F0F0] focus:outline-none focus:border-[rgba(75,156,211,0.4)]"
                    />
                  </div>

                  <div>
                    <label className="mb-1.5 block text-xs font-semibold uppercase tracking-[0.14em] text-[#707070]">Description</label>
                    <textarea
                      rows={2}
                      value={ability.description}
                      onChange={(e) => updateAbility(index, { description: e.target.value })}
                      className="w-full rounded-lg border border-[rgba(255,255,255,0.06)] bg-[#1A1A1A] px-4 py-3 text-sm text-[#F0F0F0] focus:outline-none focus:border-[rgba(75,156,211,0.4)] resize-none"
                    />
                  </div>

                  <div>
                    <label className="mb-1.5 block text-xs font-semibold uppercase tracking-[0.14em] text-[#707070]">Execution Prompt</label>
                    <textarea
                      rows={5}
                      value={ability.prompt}
                      onChange={(e) => updateAbility(index, { prompt: e.target.value })}
                      className="w-full rounded-lg border border-[rgba(255,255,255,0.06)] bg-[#1A1A1A] px-4 py-3 text-sm leading-6 text-[#F0F0F0] focus:outline-none focus:border-[rgba(75,156,211,0.4)] resize-y"
                    />
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </CardBody>
    </Card>
  );
}

// ─── Status toggle ────────────────────────────────────────────────────────────

function StatusToggle({ status, onSave }: { status: string; onSave: (s: string) => Promise<void> }) {
  const [saving, setSaving] = useState(false);
  const isActive = status === "active";

  async function toggle() {
    setSaving(true);
    try { await onSave(isActive ? "inactive" : "active"); }
    finally { setSaving(false); }
  }

  return (
    <button
      onClick={toggle}
      disabled={saving}
      className={cn(
        "flex items-center gap-2 px-4 py-1.5 rounded-full text-xs font-bold uppercase tracking-wider border transition-all",
        isActive
          ? "border-[rgba(75,156,211,0.4)] text-[#4B9CD3]"
          : "border-[rgba(255,255,255,0.1)] text-[#606060]"
      )}
      style={{ backgroundColor: isActive ? AGENT_COLOR_DIM : "rgba(255,255,255,0.03)" }}
    >
      {saving ? (
        <Loader2 size={11} className="animate-spin" />
      ) : (
        <span className="w-2 h-2 rounded-full" style={{ backgroundColor: isActive ? AGENT_COLOR : "#404040" }} />
      )}
      {isActive ? "Active" : "Inactive"}
    </button>
  );
}

// ─── Fire Agent confirmation modal ───────────────────────────────────────────

function FireAgentModal({
  agentName,
  onClose,
  onConfirm,
}: {
  agentName: string;
  onClose: () => void;
  onConfirm: () => Promise<void>;
}) {
  const [confirmText, setConfirmText] = useState("");
  const [firing, setFiring] = useState(false);
  const match = confirmText.trim().toLowerCase() === agentName.toLowerCase();

  async function handleFire() {
    if (!match) return;
    setFiring(true);
    try { await onConfirm(); } finally { setFiring(false); }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" />
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 8 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95 }}
        onClick={(e) => e.stopPropagation()}
        className="relative w-full max-w-md bg-[#1A1A1A] border border-[rgba(239,68,68,0.25)] rounded-2xl p-6 shadow-2xl"
      >
        {/* Icon */}
        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 rounded-full bg-[rgba(239,68,68,0.12)] flex items-center justify-center flex-shrink-0">
            <AlertTriangle size={18} className="text-[#EF4444]" />
          </div>
          <div>
            <h2 className="text-base font-bold text-[#F0F0F0]">Fire {agentName}?</h2>
            <p className="text-xs text-[#606060] mt-0.5">This action cannot be undone.</p>
          </div>
        </div>

        <p className="text-sm text-[#9A9A9A] mb-5 leading-relaxed">
          Firing this agent will permanently delete their profile, constitution, persona, duties, and all chat history. Any sprint tasks assigned to them will become unassigned.
        </p>

        <div className="mb-5">
          <label className="text-xs font-semibold text-[#9A9A9A] uppercase tracking-wider mb-2 block">
            Type <span className="text-[#F0F0F0] font-bold">{agentName}</span> to confirm
          </label>
          <input
            autoFocus
            value={confirmText}
            onChange={(e) => setConfirmText(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter" && match) handleFire(); }}
            placeholder={agentName}
            className="w-full bg-[#111111] border border-[rgba(239,68,68,0.2)] rounded-lg px-4 py-2.5 text-sm text-[#F0F0F0] placeholder-[#404040] focus:outline-none focus:border-[rgba(239,68,68,0.5)] transition-colors"
          />
        </div>

        <div className="flex gap-2">
          <Button variant="secondary" size="sm" onClick={onClose} className="flex-1">Keep Agent</Button>
          <button
            onClick={handleFire}
            disabled={!match || firing}
            className={cn(
              "flex-1 flex items-center justify-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold transition-all border",
              match
                ? "bg-[rgba(239,68,68,0.15)] text-[#EF4444] border-[rgba(239,68,68,0.3)] hover:bg-[rgba(239,68,68,0.25)]"
                : "bg-transparent text-[#404040] border-[rgba(255,255,255,0.06)] cursor-not-allowed"
            )}
          >
            {firing ? <Loader2 size={14} className="animate-spin" /> : <AlertTriangle size={14} />}
            Fire Agent
          </button>
        </div>
      </motion.div>
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function AgentProfilePage() {
  const params = useParams<{ id?: string | string[] }>();
  const id = Array.isArray(params.id) ? params.id[0] : params.id ?? "";
  const router = useRouter();
  const [agent, setAgent] = useState<Agent | null>(null);
  const [loading, setLoading] = useState(Boolean(id));
  const [notFound, setNotFound] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(id ? null : "Agent id is missing.");
  const [showFireModal, setShowFireModal] = useState(false);
  const [activeTab, setActiveTab] = useState<"profile" | "abilities" | "brain" | "tools" | "manage">("profile");

  useEffect(() => {
    if (!id) return;

    let cancelled = false;
    async function loadAgent() {
      setLoading(true);
      setNotFound(false);
      setLoadError(null);

      try {
        const response = await fetch(`/api/agents/${id}`);
        if (cancelled) return;

        if (response.status === 404) {
          setAgent(null);
          setNotFound(true);
          return;
        }

        const data = await response.json().catch(() => null);

        if (!response.ok) {
          setAgent(null);
          setLoadError(data?.error ?? "Unable to load this agent right now.");
          return;
        }

        if (data?.agent) {
          setAgent(data.agent);
          return;
        }

        setAgent(null);
        setLoadError("Unable to load this agent right now.");
      } catch {
        if (cancelled) return;
        setAgent(null);
        setLoadError("Unable to load this agent right now.");
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    void loadAgent();

    return () => {
      cancelled = true;
    };
  }, [id]);

  async function fireAgent() {
    await fetch(`/api/agents/${id}`, { method: "DELETE" });
    router.push("/agents");
  }

  async function patch(fields: Record<string, unknown>) {
    const res = await fetch(`/api/agents/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(fields),
    });
    const data = await res.json();
    if (data.agent) setAgent(data.agent);
  }

  async function refreshLlmStatus(connectionId?: string) {
    await patch({
      refreshLlmStatus: true,
      ...(connectionId ? { probeConnectionId: connectionId } : {}),
    });
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 size={24} className="animate-spin" style={{ color: AGENT_COLOR }} />
      </div>
    );
  }

  if (notFound) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px] gap-4">
        <Bot size={48} className="text-[#333333]" />
        <p className="text-[#606060]">Agent not found.</p>
        <Button variant="secondary" size="sm" onClick={() => router.push("/agents")} icon={<ArrowLeft size={14} />}>
          Back to Agents
        </Button>
      </div>
    );
  }

  if (loadError || !agent) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px] gap-4">
        <Bot size={48} className="text-[#333333]" />
        <p className="text-center text-[#606060]">{loadError ?? "Unable to load this agent right now."}</p>
        <Button variant="secondary" size="sm" onClick={() => router.push("/agents")} icon={<ArrowLeft size={14} />}>
          Back to Agents
        </Button>
      </div>
    );
  }

  const createdByName = agent.createdBy.displayName || agent.createdBy.name || "Unknown";
  const createdDate = new Date(agent.createdAt).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" });
  const hasStructuredConstitution = hasStoredAgentConstitution(agent.constitution);

  const tabs = [
    { id: "profile" as const, label: "Profile", icon: Pencil },
    { id: "abilities" as const, label: "Abilities", icon: WandSparkles },
    { id: "brain" as const, label: "Brain", icon: PlugZap },
    { id: "tools" as const, label: "Tools", icon: Wrench },
    { id: "manage" as const, label: "Manage", icon: Sliders },
  ];

  return (
    <div className="max-w-4xl mx-auto space-y-6 pb-12">
      {/* Back nav */}
      <button
        onClick={() => router.push("/agents")}
        className="flex items-center gap-2 text-sm text-[#606060] hover:text-[#F0F0F0] transition-colors group"
      >
        <ArrowLeft size={15} className="group-hover:-translate-x-0.5 transition-transform" />
        Back to Agents
      </button>

      {/* Page header */}
      <div className="flex items-center gap-3">
        <div className="p-2 rounded-lg" style={{ backgroundColor: AGENT_COLOR_DIM }}>
          <Cpu size={20} style={{ color: AGENT_COLOR }} />
        </div>
        <div>
          <h1 className="text-2xl font-black text-[#F0F0F0]">Agent Profile</h1>
          <p className="text-sm text-[#606060]">Configure {agent.name}&apos;s identity and capabilities</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* ── Left column ── */}
        <div className="md:col-span-1 space-y-5">
          {/* Identity card */}
          <Card className="overflow-hidden">
            <div
              className="h-24 relative overflow-hidden"
              style={{ backgroundImage: "url('/AgentBackground.png')", backgroundSize: "cover", backgroundPosition: "center" }}
            />
            <CardBody className="relative pt-0 flex flex-col items-center pb-5">
              <div className="relative -mt-10 mb-3">
                <div
                  className="w-20 h-20 rounded-full flex items-center justify-center text-4xl border-4 border-[#111111] shadow-xl overflow-hidden"
                  style={{ backgroundColor: AGENT_COLOR_DIM, borderColor: "#111111" }}
                >
                  {agent.avatar && (agent.avatar.startsWith("data:") || agent.avatar.startsWith("https://"))
                    ? <img src={agent.avatar} alt={agent.name} className="w-full h-full object-cover" />
                    : (agent.avatar ?? <Bot size={32} style={{ color: AGENT_COLOR }} />)}
                </div>
              </div>
              <h2 className="text-xl font-bold text-[#F0F0F0]">{agent.name}</h2>
              <p className="text-sm mt-1" style={{ color: AGENT_COLOR }}>{agent.role}</p>
              <div className="flex items-center gap-1.5 mt-3 px-3 py-1 rounded-full border text-xs font-bold"
                style={{ backgroundColor: AGENT_COLOR_DIM, borderColor: `${AGENT_COLOR}40`, color: AGENT_COLOR }}>
                <Cpu size={11} />
                AI Agent
              </div>
              {agent.description && (
                <p className="text-xs text-[#9A9A9A] text-center mt-3 leading-relaxed px-2">{agent.description}</p>
              )}
              <div className="mt-4">
                <StatusToggle status={agent.status} onSave={(s) => patch({ status: s })} />
              </div>
            </CardBody>
          </Card>

          {/* Stats / metadata */}
          <Card>
            <CardHeader>
              <span className="text-xs font-bold text-[#606060] uppercase tracking-widest">Stats</span>
            </CardHeader>
            <CardBody className="space-y-3">
              <div className="flex items-center gap-3 text-sm">
                <MessageSquare size={15} className="text-[#404040]" />
                <span className="text-[#9A9A9A]">Total messages</span>
                <span className="ml-auto font-bold text-[#F0F0F0]">{agent._count.messages}</span>
              </div>
              <div className="flex items-center gap-3 text-sm">
                <User size={15} className="text-[#404040]" />
                <span className="text-[#9A9A9A]">Created by</span>
                <span className="ml-auto text-[#F0F0F0] text-xs">{createdByName}</span>
              </div>
              <div className="flex items-center gap-3 text-sm">
                <CalendarDays size={15} className="text-[#404040]" />
                <span className="text-[#9A9A9A]">Created</span>
                <span className="ml-auto text-[#F0F0F0] text-xs">{createdDate}</span>
              </div>
              <div className="flex items-center gap-3 text-sm">
                <PlugZap size={15} className="text-[#404040]" />
                <span className="text-[#9A9A9A]">Brain status</span>
                <span className={cn(
                  "ml-auto text-xs font-semibold",
                  agent.llmStatus === "online" ? "text-[#22C55E]" : agent.llmStatus === "offline" ? "text-[#EF4444]" : "text-[#8D877F]"
                )}>
                  {agent.llmStatus === "online" ? "Online" : agent.llmStatus === "offline" ? "Offline" : "Not connected"}
                </span>
              </div>
            </CardBody>
          </Card>
        </div>

        {/* ── Right column — tabbed ── */}
        <div className="md:col-span-2 space-y-5">
          {/* Tab bar */}
          <div className="flex gap-1 p-1 bg-[#1A1A1A] rounded-xl border border-[rgba(255,255,255,0.06)]">
            {tabs.map((tab) => {
              const Icon = tab.icon;
              const isActive = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={cn(
                    "flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg text-sm font-semibold transition-all",
                    isActive
                      ? "bg-[rgba(75,156,211,0.15)] text-[#4B9CD3]"
                      : "text-[#606060] hover:text-[#9A9A9A]"
                  )}
                >
                  <Icon size={14} />
                  <span className="hidden sm:inline">{tab.label}</span>
                </button>
              );
            })}
          </div>

          {/* Profile tab */}
          {activeTab === "profile" && (
            <>
              <Card>
                <CardHeader className="border-b border-[rgba(255,255,255,0.06)] px-6 py-4">
                  <div className="flex items-center gap-2">
                    <Pencil size={15} style={{ color: AGENT_COLOR }} />
                    <span className="text-sm font-bold text-[#F0F0F0]">Identity</span>
                  </div>
                </CardHeader>
                <CardBody className="p-6 space-y-5">
                  <EditableField
                    label="Name"
                    value={agent.name}
                    onSave={(v) => patch({ name: v })}
                    placeholder="Agent name..."
                  />
                  <RoleField value={agent.role} onSave={(v) => patch({ role: v })} />
                  <EditableField
                    label="Tagline / Description"
                    value={agent.description ?? ""}
                    onSave={(v) => patch({ description: v })}
                    placeholder="Short description shown on the team card..."
                  />
                </CardBody>
              </Card>

              <Card>
                <CardHeader className="border-b border-[rgba(255,255,255,0.06)] px-6 py-4">
                  <div className="flex items-center gap-2">
                    <Sparkles size={15} style={{ color: AGENT_COLOR }} />
                    <span className="text-sm font-bold text-[#F0F0F0]">Brain / Constitution</span>
                  </div>
                </CardHeader>
                <CardBody className="p-6 space-y-4">
                  <div className="rounded-xl border border-[rgba(75,156,211,0.18)] bg-[rgba(75,156,211,0.08)] p-4">
                    <p className="text-sm font-semibold text-[#F0F0F0]">Structured Constitution lives in the Brain tab.</p>
                    <p className="mt-1 text-xs leading-5 text-[#9A9A9A]">
                      Profile now shows the runtime prompt only. Open Brain to edit the structured Constitution that generates it.
                    </p>
                    {!hasStructuredConstitution && agent.persona.trim().length > 0 && (
                      <p className="mt-3 text-xs leading-5" style={{ color: AGENT_COLOR }}>
                        Legacy persona fallback is still active for this agent. Save the Brain once to persist the structured Constitution and keep this prompt derived from it.
                      </p>
                    )}
                  </div>

                  <div className="space-y-2">
                    <div className="flex items-center justify-between gap-3">
                      <span className="text-sm font-medium text-[#9A9A9A]">Runtime Prompt Preview</span>
                      <Button size="sm" variant="secondary" onClick={() => setActiveTab("brain")}>
                        Open Brain
                      </Button>
                    </div>
                    <pre className="max-h-72 overflow-auto rounded-xl border border-[rgba(255,255,255,0.06)] bg-[#141414] px-4 py-3 text-xs leading-6 text-[#D4D4D4] whitespace-pre-wrap">
                      {agent.persona || "No runtime prompt yet. Configure the Brain to generate one."}
                    </pre>
                  </div>
                </CardBody>
              </Card>

              <Card>
                <CardHeader className="border-b border-[rgba(255,255,255,0.06)] px-6 py-4">
                  <div className="flex items-center gap-2">
                    <Camera size={15} style={{ color: AGENT_COLOR }} />
                    <span className="text-sm font-bold text-[#F0F0F0]">Avatar</span>
                  </div>
                </CardHeader>
                <CardBody className="p-6">
                  <AvatarPicker value={agent.avatar} onSave={(val) => patch({ avatar: val })} />
                </CardBody>
              </Card>
            </>
          )}

          {activeTab === "abilities" && (
            <AbilitiesCard
              abilities={agent.abilities}
              onSave={patch}
            />
          )}

          {/* Brain tab */}
          {activeTab === "brain" && (
            <div className="space-y-6">
              <AgentConstitutionEditor
                agent={agent}
                onSave={patch}
              />
              <LlmConnectionCard
                agent={agent}
                onSave={patch}
                onRefresh={refreshLlmStatus}
              />
            </div>
          )}

          {/* Tools tab */}
          {activeTab === "tools" && (
            <ToolsCard
              disabledTools={agent.disabledTools}
              onSave={patch}
            />
          )}

          {/* Manage tab */}
          {activeTab === "manage" && (
            <>
              <Card>
                <CardHeader className="border-b border-[rgba(255,255,255,0.06)] px-6 py-4">
                  <div className="flex items-center gap-2">
                    <ListTodo size={15} style={{ color: AGENT_COLOR }} />
                    <span className="text-sm font-bold text-[#F0F0F0]">Activity</span>
                  </div>
                </CardHeader>
                <CardBody className="p-6">
                  <div className="grid grid-cols-2 gap-4">
                    <div
                      className="rounded-xl p-4 border text-center"
                      style={{ backgroundColor: AGENT_COLOR_DIM, borderColor: `${AGENT_COLOR}30` }}
                    >
                      <div className="text-3xl font-black text-[#F0F0F0]">{agent._count.taskExecutions}</div>
                      <div className="text-xs mt-1" style={{ color: AGENT_COLOR }}>Executions</div>
                      <div className="text-[10px] text-[#606060] mt-0.5">total task executions</div>
                    </div>
                  </div>
                  {agent._count.taskExecutions === 0 && (
                    <p className="text-xs text-[#404040] text-center mt-4">No executions yet. Assign a task to this agent to get things moving.</p>
                  )}
                </CardBody>
              </Card>

              <Card className="border-[rgba(239,68,68,0.15)]">
                <CardHeader className="border-b border-[rgba(239,68,68,0.1)] px-6 py-4">
                  <div className="flex items-center gap-2">
                    <AlertTriangle size={15} className="text-[#EF4444]" />
                    <span className="text-sm font-bold text-[#F0F0F0]">Danger Zone</span>
                  </div>
                </CardHeader>
                <CardBody className="p-6">
                  <div className="flex items-center justify-between gap-4">
                    <div>
                      <p className="text-sm font-semibold text-[#F0F0F0]">Fire this Agent</p>
                      <p className="text-xs text-[#606060] mt-0.5">
                        Permanently deletes {agent.name}, their chat history, and removes all task assignments.
                      </p>
                    </div>
                    <button
                      onClick={() => setShowFireModal(true)}
                      className="flex-shrink-0 flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold border transition-all bg-[rgba(239,68,68,0.08)] text-[#EF4444] border-[rgba(239,68,68,0.2)] hover:bg-[rgba(239,68,68,0.15)]"
                    >
                      <AlertTriangle size={14} />
                      Fire Agent
                    </button>
                  </div>
                </CardBody>
              </Card>
            </>
          )}
        </div>
      </div>

      {/* Fire confirmation modal */}
      <AnimatePresence>
        {showFireModal && (
          <FireAgentModal
            agentName={agent.name}
            onClose={() => setShowFireModal(false)}
            onConfirm={fireAgent}
          />
        )}
      </AnimatePresence>
    </div>
  );
}
