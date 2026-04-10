"use client";

import { useState, useRef } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import {
  Cpu, ArrowLeft, Plus, X, ChevronDown, Bot, Loader2, Sparkles, Camera,
} from "lucide-react";
import { Card, CardBody, CardHeader } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { cn } from "@/lib/utils";

const AGENT_COLOR = "#4B9CD3";
const AGENT_COLOR_DIM = "rgba(75,156,211,0.15)";

const ROLE_SUGGESTIONS = [
  "Backend Engineer", "Frontend Engineer", "Full Stack Engineer", "DevOps Engineer",
  "QA Engineer", "Data Engineer", "Security Engineer", "Mobile Engineer",
  "Product Manager", "Technical Writer", "Code Reviewer", "Deployment Manager",
];

const AVATAR_OPTIONS = ["🤖", "🧠", "⚡", "🔮", "🛸", "💡", "🦾", "🎯", "🔬", "🛡️", "🚀", "⚙️"];

export default function HireAgentPage() {
  const router = useRouter();

  const [name, setName] = useState("");
  const [role, setRole] = useState("");
  const [description, setDescription] = useState("");
  const [persona, setPersona] = useState("");
  const [duties, setDuties] = useState<string[]>([]);
  const [dutyInput, setDutyInput] = useState("");
  const [avatar, setAvatar] = useState("🤖");
  const [showRoleSugg, setShowRoleSugg] = useState(false);

  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [avatarUploading, setAvatarUploading] = useState(false);
  const [avatarError, setAvatarError] = useState<string | null>(null);

  const dutyRef = useRef<HTMLInputElement>(null);
  const avatarFileRef = useRef<HTMLInputElement>(null);

  async function handleAvatarFile(file: File) {
    setAvatarError(null);
    if (!file.type.startsWith("image/")) { setAvatarError("Please select an image file."); return; }
    if (file.size > 300_000) { setAvatarError("Image must be under 300 KB."); return; }
    setAvatarUploading(true);
    try {
      const base64 = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result as string);
        reader.onerror = reject;
        reader.readAsDataURL(file);
      });
      setAvatar(base64);
    } catch {
      setAvatarError("Upload failed.");
    } finally {
      setAvatarUploading(false);
    }
  }

  function validate() {
    const e: Record<string, string> = {};
    if (!name.trim()) e.name = "Agent needs a name.";
    if (!role.trim()) e.role = "Role is required.";
    return e;
  }

  function addDuty() {
    const trimmed = dutyInput.trim();
    if (trimmed && !duties.includes(trimmed)) setDuties((d) => [...d, trimmed]);
    setDutyInput("");
  }

  function removeDuty(i: number) {
    setDuties((d) => d.filter((_, idx) => idx !== i));
  }

  async function handleHire() {
    const errs = validate();
    if (Object.keys(errs).length) { setErrors(errs); return; }
    setSaving(true);
    setErrors({});
    try {
      const res = await fetch("/api/agents", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: name.trim(), role: role.trim(), description: description.trim() || null, persona: persona.trim(), duties, avatar, status: "active" }),
      });
      const data = await res.json();
      if (!res.ok) { setErrors({ general: data.error ?? "Failed to hire agent" }); return; }
      router.push(`/agents/${data.agent.id}/profile`);
    } catch {
      setErrors({ general: "Something went wrong" });
    } finally {
      setSaving(false);
    }
  }

  const filteredRoles = ROLE_SUGGESTIONS.filter((r) => r.toLowerCase().includes(role.toLowerCase()));

  return (
    <div className="max-w-4xl mx-auto space-y-6 pb-12">
      {/* Back */}
      <button
        onClick={() => router.push("/chat")}
        className="flex items-center gap-2 text-sm text-[#606060] hover:text-[#F0F0F0] transition-colors group"
      >
        <ArrowLeft size={15} className="group-hover:-translate-x-0.5 transition-transform" />
        Back to Chat
      </button>

      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg" style={{ backgroundColor: AGENT_COLOR_DIM }}>
            <Cpu size={20} style={{ color: AGENT_COLOR }} />
          </div>
          <div>
            <h1 className="text-2xl font-black text-[#F0F0F0]">Hire a New Agent</h1>
            <p className="text-sm text-[#606060]">Define your new AI team member&apos;s identity and responsibilities</p>
          </div>
        </div>
        <Button
          variant="primary"
          size="md"
          loading={saving}
          onClick={handleHire}
          icon={<Cpu size={15} />}
          style={{ background: `linear-gradient(135deg, ${AGENT_COLOR}, #2980C4)`, flexShrink: 0 } as React.CSSProperties}
        >
          Hire Agent
        </Button>
      </div>

      {errors.general && (
        <div className="px-4 py-3 rounded-xl bg-[rgba(239,68,68,0.08)] border border-[rgba(239,68,68,0.2)] text-sm text-[#EF4444]">
          {errors.general}
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* ── Left column ── */}
        <div className="md:col-span-1 space-y-5">
          {/* Preview card */}
          <Card className="overflow-hidden">
            <div
              className="h-24 relative overflow-hidden"
              style={{ backgroundImage: "url('/AgentBackground.png')", backgroundSize: "cover", backgroundPosition: "center" }}
            />
            <CardBody className="relative pt-0 flex flex-col items-center pb-5">
              <div className="relative -mt-10 mb-3">
                <div
                  className="w-20 h-20 rounded-full flex items-center justify-center text-4xl border-4 shadow-xl overflow-hidden"
                  style={{ backgroundColor: AGENT_COLOR_DIM, borderColor: "#111111" }}
                >
                  {avatar && (avatar.startsWith("data:") || avatar.startsWith("https://"))
                    ? <img src={avatar} alt="avatar" className="w-full h-full object-cover" />
                    : avatar}
                </div>
              </div>
              <h2 className="text-xl font-bold text-[#F0F0F0]">{name || <span className="text-[#333333]">Agent Name</span>}</h2>
              <p className="text-sm mt-1" style={{ color: name && role ? AGENT_COLOR : "#333333" }}>
                {role || "Role"}
              </p>
              <div
                className="flex items-center gap-1.5 mt-3 px-3 py-1 rounded-full border text-xs font-bold"
                style={{ backgroundColor: AGENT_COLOR_DIM, borderColor: `${AGENT_COLOR}40`, color: AGENT_COLOR }}
              >
                <Cpu size={11} /> AI Agent
              </div>
              {description && (
                <p className="text-xs text-[#9A9A9A] text-center mt-3 leading-relaxed px-2">{description}</p>
              )}
            </CardBody>
          </Card>

          {/* Avatar picker */}
          <Card>
            <CardHeader>
              <span className="text-xs font-bold text-[#606060] uppercase tracking-widest">Choose Avatar</span>
            </CardHeader>
            <CardBody className="space-y-3">
              <input
                ref={avatarFileRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => { const f = e.target.files?.[0]; if (f) handleAvatarFile(f); e.target.value = ""; }}
              />
              <button
                onClick={() => avatarFileRef.current?.click()}
                disabled={avatarUploading}
                className="w-full flex items-center justify-center gap-2 px-3 py-2.5 rounded-lg text-sm font-medium border border-[rgba(75,156,211,0.3)] text-[#4B9CD3] bg-[rgba(75,156,211,0.08)] hover:bg-[rgba(75,156,211,0.15)] transition-all disabled:opacity-50"
              >
                {avatarUploading ? <Loader2 size={14} className="animate-spin" /> : <Camera size={14} />}
                {avatarUploading ? "Uploading..." : "Upload Photo"}
              </button>
              {avatar && (avatar.startsWith("data:") || avatar.startsWith("https://")) && (
                <button
                  onClick={() => setAvatar("🤖")}
                  className="w-full flex items-center justify-center gap-2 px-3 py-2 rounded-lg text-xs font-medium border border-[rgba(255,255,255,0.06)] text-[#606060] hover:text-[#EF4444] hover:border-[rgba(239,68,68,0.3)] transition-all"
                >
                  <X size={12} /> Remove photo, use emoji
                </button>
              )}
              {avatarError && <p className="text-xs text-[#EF4444]">{avatarError}</p>}
              <div className="flex items-center gap-2">
                <div className="flex-1 h-px bg-[rgba(255,255,255,0.06)]" />
                <span className="text-[10px] text-[#404040] uppercase tracking-widest">or emoji</span>
                <div className="flex-1 h-px bg-[rgba(255,255,255,0.06)]" />
              </div>
              <div className="flex flex-wrap gap-2 justify-center">
                {AVATAR_OPTIONS.map((emoji) => (
                  <button
                    key={emoji}
                    onClick={() => setAvatar(emoji)}
                    className={cn(
                      "w-10 h-10 rounded-xl text-xl transition-all border",
                      avatar === emoji
                        ? "border-[rgba(75,156,211,0.6)] bg-[rgba(75,156,211,0.2)]"
                        : "border-[rgba(255,255,255,0.06)] bg-[#1A1A1A] hover:border-[rgba(75,156,211,0.3)]"
                    )}
                  >
                    {emoji}
                  </button>
                ))}
              </div>
            </CardBody>
          </Card>
        </div>

        {/* ── Right column ── */}
        <div className="md:col-span-2 space-y-5">
          {/* Identity */}
          <Card>
            <CardHeader className="border-b border-[rgba(255,255,255,0.06)] px-6 py-4">
              <div className="flex items-center gap-2">
                <Bot size={15} style={{ color: AGENT_COLOR }} />
                <span className="text-sm font-bold text-[#F0F0F0]">Identity</span>
              </div>
            </CardHeader>
            <CardBody className="p-6 space-y-5">
              {/* Name */}
              <div className="flex flex-col gap-1.5">
                <label className="text-sm font-medium text-[#9A9A9A]">
                  Agent Name <span style={{ color: AGENT_COLOR }}>*</span>
                </label>
                <input
                  autoFocus
                  value={name}
                  onChange={(e) => { setName(e.target.value); setErrors((p) => ({ ...p, name: "" })); }}
                  placeholder="e.g. ARIA, Nexus, Sage, Wilbur..."
                  className={cn(
                    "w-full bg-[#1A1A1A] border rounded-lg px-4 py-2.5 text-sm text-[#F0F0F0] placeholder-[#404040] focus:outline-none transition-colors",
                    errors.name ? "border-[rgba(239,68,68,0.5)]" : "border-[rgba(255,255,255,0.06)] focus:border-[rgba(75,156,211,0.4)]"
                  )}
                />
                {errors.name && <p className="text-xs text-[#EF4444]">{errors.name}</p>}
              </div>

              {/* Role */}
              <div className="flex flex-col gap-1.5">
                <label className="text-sm font-medium text-[#9A9A9A]">
                  Role <span style={{ color: AGENT_COLOR }}>*</span>
                </label>
                <div className="relative">
                  <input
                    value={role}
                    onChange={(e) => { setRole(e.target.value); setShowRoleSugg(true); setErrors((p) => ({ ...p, role: "" })); }}
                    onFocus={() => setShowRoleSugg(true)}
                    onBlur={() => setTimeout(() => setShowRoleSugg(false), 150)}
                    placeholder="e.g. DevOps Engineer, QA Engineer..."
                    className={cn(
                      "w-full bg-[#1A1A1A] border rounded-lg px-4 py-2.5 pr-9 text-sm text-[#F0F0F0] placeholder-[#404040] focus:outline-none transition-colors",
                      errors.role ? "border-[rgba(239,68,68,0.5)]" : "border-[rgba(255,255,255,0.06)] focus:border-[rgba(75,156,211,0.4)]"
                    )}
                  />
                  <ChevronDown size={13} className="absolute right-3 top-1/2 -translate-y-1/2 text-[#606060] pointer-events-none" />
                  {showRoleSugg && filteredRoles.length > 0 && (
                    <div className="absolute z-10 top-full mt-1 w-full bg-[#1A1A1A] border border-[rgba(255,255,255,0.1)] rounded-xl overflow-hidden shadow-xl max-h-48 overflow-y-auto">
                      {filteredRoles.map((r) => (
                        <button key={r} onMouseDown={() => { setRole(r); setShowRoleSugg(false); }}
                          className="w-full text-left px-3 py-2 text-sm text-[#F0F0F0] hover:bg-[rgba(75,156,211,0.12)] transition-colors">
                          {r}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
                {errors.role && <p className="text-xs text-[#EF4444]">{errors.role}</p>}
              </div>

              {/* Description */}
              <div className="flex flex-col gap-1.5">
                <label className="text-sm font-medium text-[#9A9A9A]">Tagline / Description</label>
                <input
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Short description shown on their team card..."
                  className="w-full bg-[#1A1A1A] border border-[rgba(255,255,255,0.06)] rounded-lg px-4 py-2.5 text-sm text-[#F0F0F0] placeholder-[#404040] focus:outline-none focus:border-[rgba(75,156,211,0.4)] transition-colors"
                />
              </div>
            </CardBody>
          </Card>

          {/* Persona */}
          <Card>
            <CardHeader className="border-b border-[rgba(255,255,255,0.06)] px-6 py-4">
              <div className="flex items-center gap-2">
                <Sparkles size={15} style={{ color: AGENT_COLOR }} />
                <span className="text-sm font-bold text-[#F0F0F0]">Persona</span>
              </div>
            </CardHeader>
            <CardBody className="p-6 space-y-2">
              <p className="text-xs text-[#606060]">
                Describe who this agent is, their communication style, and areas of expertise. This becomes their system prompt when an LLM is connected.
              </p>
              <textarea
                value={persona}
                onChange={(e) => setPersona(e.target.value)}
                placeholder="You are a senior DevOps engineer at Griggs Capital Partners. You specialize in AWS infrastructure, CI/CD pipelines, and system reliability. You are methodical, precise, and always flag risks proactively..."
                rows={5}
                className="w-full bg-[#1A1A1A] border border-[rgba(255,255,255,0.06)] rounded-xl px-4 py-3 text-sm text-[#F0F0F0] placeholder-[#404040] resize-none focus:outline-none focus:border-[rgba(75,156,211,0.4)] transition-colors"
              />
            </CardBody>
          </Card>

          {/* Duties */}
          <Card>
            <CardHeader className="border-b border-[rgba(255,255,255,0.06)] px-6 py-4">
              <div className="flex items-center gap-2">
                <Cpu size={15} style={{ color: AGENT_COLOR }} />
                <span className="text-sm font-bold text-[#F0F0F0]">Duties & Responsibilities</span>
              </div>
            </CardHeader>
            <CardBody className="p-6 space-y-3">
              {/* Existing tags */}
              <div className="flex flex-wrap gap-2 min-h-8">
                <AnimatePresence>
                  {duties.map((duty, i) => (
                    <motion.span
                      key={duty}
                      initial={{ opacity: 0, scale: 0.9 }}
                      animate={{ opacity: 1, scale: 1 }}
                      exit={{ opacity: 0, scale: 0.85 }}
                      className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-full border"
                      style={{ color: "#7EC8E3", backgroundColor: "rgba(75,156,211,0.1)", borderColor: "rgba(75,156,211,0.25)" }}
                    >
                      {duty}
                      <button onClick={() => removeDuty(i)} className="text-[rgba(75,156,211,0.6)] hover:text-[#EF4444] transition-colors ml-0.5">
                        <X size={10} />
                      </button>
                    </motion.span>
                  ))}
                </AnimatePresence>
                {duties.length === 0 && (
                  <span className="text-sm text-[#404040] italic">Add responsibilities below...</span>
                )}
              </div>

              {/* Input */}
              <div className="flex gap-2">
                <input
                  ref={dutyRef}
                  value={dutyInput}
                  onChange={(e) => setDutyInput(e.target.value)}
                  onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addDuty(); } }}
                  placeholder="Type a duty and press Enter..."
                  className="flex-1 bg-[#1A1A1A] border border-[rgba(255,255,255,0.06)] rounded-lg px-3 py-2 text-sm text-[#F0F0F0] placeholder-[#404040] focus:outline-none focus:border-[rgba(75,156,211,0.35)] transition-colors"
                />
                <button
                  onClick={addDuty}
                  disabled={!dutyInput.trim()}
                  className="px-3 py-2 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-all disabled:opacity-40"
                  style={{ backgroundColor: AGENT_COLOR_DIM, color: AGENT_COLOR }}
                >
                  <Plus size={13} /> Add
                </button>
              </div>
            </CardBody>
          </Card>

          {/* Hire CTA */}
          <div className="flex items-center justify-between pt-2">
            <button
              onClick={() => router.push("/chat")}
              className="text-sm text-[#606060] hover:text-[#F0F0F0] transition-colors"
            >
              Cancel
            </button>
            <Button
              variant="primary"
              size="lg"
              loading={saving}
              onClick={handleHire}
              icon={<Cpu size={16} />}
              style={{ background: `linear-gradient(135deg, ${AGENT_COLOR}, #2980C4)` } as React.CSSProperties}
            >
              {saving ? "Hiring..." : "Hire Agent"}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
