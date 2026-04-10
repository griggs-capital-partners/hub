"use client";

import { useState, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { useDropzone } from "react-dropzone";
import {
  ArrowLeft, Building2, Globe, Users, FileText, MessageSquare,
  Plus, X, Loader2, CheckCircle, AlertTriangle, Pencil, Trash2,
  Star, Upload, CloudUpload, File, Mic, Image as ImageIcon,
  ExternalLink, Phone, Mail, Crown, ChevronDown,
} from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Input, Textarea } from "@/components/ui/Input";
import { Card, CardBody } from "@/components/ui/Card";
import { Avatar } from "@/components/ui/Avatar";
import {
  STATUS_CONFIG, TIER_CONFIG, HEALTH_CONFIG, NOTE_TYPE_CONFIG,
  timeAgo, formatDate,
} from "@/lib/utils";

interface Contact {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  title: string | null;
  isPrimary: boolean;
  notes: string | null;
  createdAt: Date;
  updatedAt: Date;
}

interface NoteAuthor {
  id: string;
  name: string | null;
  displayName: string | null;
  image: string | null;
}

interface Note {
  id: string;
  type: string;
  body: string;
  createdAt: Date;
  author: NoteAuthor;
}

interface Document {
  id: string;
  filename: string;
  fileType: string;
  fileSize: number;
  createdAt: Date;
  uploader: { name: string | null; email: string; image: string | null };
}

interface ProductionUrl {
  label: string;
  url: string;
}

interface Customer {
  id: string;
  name: string;
  logoUrl: string | null;
  website: string | null;
  productionUrls: string;
  status: string;
  healthScore: number;
  tier: string;
  industry: string | null;
  notes: string | null;
  createdAt: Date;
  updatedAt: Date;
  contacts: Contact[];
  documents: Document[];
  noteItems: Note[];
}

interface Props {
  customer: Customer;
}

type Tab = "overview" | "contacts" | "notes" | "docs";

const HEALTH_DOTS = [1, 2, 3, 4, 5];
const FILE_ICONS: Record<string, React.ElementType> = {
  pdf: FileText, text: FileText, audio: Mic, image: ImageIcon, document: FileText,
};

function formatBytes(bytes: number) {
  if (bytes < 1024) return `${bytes}B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)}KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)}MB`;
}

function CompanyLogo({ name, logoUrl, size = 56 }: { name: string; logoUrl: string | null; size?: number }) {
  if (logoUrl) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img src={logoUrl} alt={name} className="rounded-xl object-contain bg-[#222222]" style={{ width: size, height: size }} />
    );
  }
  return (
    <div
      className="rounded-xl flex items-center justify-center font-black text-white flex-shrink-0"
      style={{ width: size, height: size, background: "linear-gradient(135deg, #F7941D 0%, #7B1C24 100%)", fontSize: size * 0.35 }}
    >
      {name.slice(0, 2).toUpperCase()}
    </div>
  );
}

function HealthDots({ score, interactive, onChange }: { score: number; interactive?: boolean; onChange?: (n: number) => void }) {
  return (
    <div className="flex items-center gap-1">
      {HEALTH_DOTS.map((n) => {
        const h = HEALTH_CONFIG[n];
        return (
          <button
            key={n}
            disabled={!interactive}
            onClick={() => onChange?.(n)}
            title={h.label}
            className={interactive ? "cursor-pointer hover:scale-125 transition-transform" : "cursor-default"}
          >
            <div
              className="w-3 h-3 rounded-full transition-all"
              style={{ backgroundColor: n <= score ? h.color : "rgba(255,255,255,0.08)" }}
            />
          </button>
        );
      })}
      <span className="text-xs text-[#9A9A9A] ml-1">{HEALTH_CONFIG[score]?.label}</span>
    </div>
  );
}

export function CustomerDetailClient({ customer }: Props) {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<Tab>("overview");
  const [data, setData] = useState(customer);
  const productionUrls: ProductionUrl[] = (() => {
    try { return JSON.parse(data.productionUrls); } catch { return []; }
  })();

  // ── Overview edit state ──────────────────────────────────────────────────────
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [editForm, setEditForm] = useState({
    name: data.name,
    website: data.website ?? "",
    industry: data.industry ?? "",
    tier: data.tier,
    status: data.status,
    healthScore: data.healthScore,
    notes: data.notes ?? "",
  });
  const [editUrls, setEditUrls] = useState<ProductionUrl[]>(productionUrls);
  const logoInputRef = useRef<HTMLInputElement>(null);
  const [logoUploading, setLogoUploading] = useState(false);

  async function saveOverview() {
    setSaving(true);
    try {
      const res = await fetch(`/api/customers/${data.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...editForm, productionUrls: editUrls }),
      });
      const updated = await res.json();
      setData((prev) => ({ ...prev, ...updated.customer }));
      setEditing(false);
    } catch { /* noop */ }
    finally { setSaving(false); }
  }

  async function uploadLogo(file: File) {
    setLogoUploading(true);
    const reader = new FileReader();
    reader.onload = async (e) => {
      const dataUrl = e.target?.result as string;
      if (!dataUrl.startsWith("data:image/")) { setLogoUploading(false); return; }
      if (dataUrl.length > 400_000) { alert("Logo too large. Max ~300KB."); setLogoUploading(false); return; }
      const res = await fetch(`/api/customers/${data.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ logoUrl: dataUrl }),
      });
      const updated = await res.json();
      setData((prev) => ({ ...prev, logoUrl: updated.customer.logoUrl }));
      setLogoUploading(false);
    };
    reader.readAsDataURL(file);
  }

  // ── Contacts state ──────────────────────────────────────────────────────────
  const [contacts, setContacts] = useState(data.contacts);
  const [showAddContact, setShowAddContact] = useState(false);
  const [addingContact, setAddingContact] = useState(false);
  const [newContact, setNewContact] = useState({ name: "", email: "", phone: "", title: "", isPrimary: false, notes: "" });
  const [editingContact, setEditingContact] = useState<string | null>(null);
  const [editContact, setEditContact] = useState<Partial<typeof newContact>>({});

  async function addContact() {
    if (!newContact.name.trim()) return;
    setAddingContact(true);
    try {
      const res = await fetch(`/api/customers/${data.id}/contacts`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(newContact),
      });
      const d = await res.json();
      if (newContact.isPrimary) {
        setContacts((prev) => [d.contact, ...prev.map((c) => ({ ...c, isPrimary: false }))]);
      } else {
        setContacts((prev) => [...prev, d.contact]);
      }
      setNewContact({ name: "", email: "", phone: "", title: "", isPrimary: false, notes: "" });
      setShowAddContact(false);
    } catch { /* noop */ }
    finally { setAddingContact(false); }
  }

  async function saveContact(contactId: string) {
    const res = await fetch(`/api/customers/${data.id}/contacts/${contactId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(editContact),
    });
    const d = await res.json();
    setContacts((prev) => prev.map((c) => c.id === contactId ? { ...c, ...d.contact } : c));
    setEditingContact(null);
  }

  async function deleteContact(contactId: string) {
    if (!confirm("Remove this contact?")) return;
    await fetch(`/api/customers/${data.id}/contacts/${contactId}`, { method: "DELETE" });
    setContacts((prev) => prev.filter((c) => c.id !== contactId));
  }

  // ── Notes state ─────────────────────────────────────────────────────────────
  const [notes, setNotes] = useState(data.noteItems);
  const [noteBody, setNoteBody] = useState("");
  const [noteType, setNoteType] = useState("general");
  const [addingNote, setAddingNote] = useState(false);

  async function addNote() {
    if (!noteBody.trim()) return;
    setAddingNote(true);
    try {
      const res = await fetch(`/api/customers/${data.id}/notes`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type: noteType, body: noteBody }),
      });
      const d = await res.json();
      setNotes((prev) => [d.note, ...prev]);
      setNoteBody("");
    } catch { /* noop */ }
    finally { setAddingNote(false); }
  }

  async function deleteNote(noteId: string) {
    if (!confirm("Delete this note?")) return;
    await fetch(`/api/customers/${data.id}/notes`, {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ noteId }),
    });
    setNotes((prev) => prev.filter((n) => n.id !== noteId));
  }

  // ── Docs state ───────────────────────────────────────────────────────────────
  const [docs, setDocs] = useState(data.documents);
  const [uploading, setUploading] = useState(false);
  const [uploadMsg, setUploadMsg] = useState<{ ok: boolean; text: string } | null>(null);

  const onDrop = useCallback(async (acceptedFiles: File[]) => {
    if (!acceptedFiles.length) return;
    setUploading(true);
    setUploadMsg(null);
    for (const file of acceptedFiles) {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("customerId", data.id);
      try {
        const res = await fetch("/api/customers/upload", { method: "POST", body: formData });
        if (!res.ok) throw new Error();
        const d = await res.json();
        setDocs((prev) => [{ ...d.doc, uploader: { name: null, email: "", image: null } }, ...prev]);
        setUploadMsg({ ok: true, text: `${file.name} uploaded` });
      } catch {
        setUploadMsg({ ok: false, text: `Failed to upload ${file.name}` });
      }
    }
    setUploading(false);
  }, [data.id]);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      "application/pdf": [".pdf"],
      "text/plain": [".txt", ".md"],
      "audio/*": [".mp3", ".wav", ".m4a"],
      "image/*": [".jpg", ".jpeg", ".png", ".webp"],
      "application/msword": [".doc"],
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document": [".docx"],
    },
    maxSize: 50 * 1024 * 1024,
  });

  const currentStatus = STATUS_CONFIG[data.status as keyof typeof STATUS_CONFIG] ?? STATUS_CONFIG.active;
  const currentTier = TIER_CONFIG[data.tier as keyof typeof TIER_CONFIG] ?? TIER_CONFIG.standard;

  const TABS: { id: Tab; label: string; icon: React.ElementType; count?: number }[] = [
    { id: "overview", label: "Overview", icon: Building2 },
    { id: "contacts", label: "Contacts", icon: Users, count: contacts.length },
    { id: "notes", label: "Notes", icon: MessageSquare, count: notes.length },
    { id: "docs", label: "Docs", icon: FileText, count: docs.length },
  ];

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      {/* Back */}
      <button
        onClick={() => router.push("/customers")}
        className="flex items-center gap-1.5 text-sm text-[#606060] hover:text-[#F0F0F0] transition-colors"
      >
        <ArrowLeft size={14} />
        Customers
      </button>

      {/* Header card */}
      <div className="bg-[#1A1A1A] border border-[rgba(255,255,255,0.07)] rounded-xl p-6">
        <div className="flex items-start gap-5 flex-wrap">
          {/* Logo */}
          <div className="relative group">
            <CompanyLogo name={data.name} logoUrl={data.logoUrl} size={64} />
            <button
              onClick={() => logoInputRef.current?.click()}
              disabled={logoUploading}
              className="absolute inset-0 rounded-xl bg-black/50 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
            >
              {logoUploading ? <Loader2 size={16} className="animate-spin text-white" /> : <Upload size={16} className="text-white" />}
            </button>
            <input
              ref={logoInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => { const f = e.target.files?.[0]; if (f) uploadLogo(f); }}
            />
          </div>

          {/* Info */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-3 flex-wrap">
              <h1 className="text-2xl font-black text-[#F0F0F0]">{data.name}</h1>
              <span
                className="text-xs px-2.5 py-1 rounded-full font-semibold"
                style={{ color: currentStatus.color, backgroundColor: currentStatus.bg }}
              >
                {currentStatus.label}
              </span>
              <span
                className="text-xs px-2.5 py-1 rounded-full font-semibold"
                style={{ color: currentTier.color, backgroundColor: currentTier.bg }}
              >
                {currentTier.label}
              </span>
            </div>
            <div className="flex items-center gap-4 mt-2 flex-wrap">
              <HealthDots score={data.healthScore} />
              {data.industry && <span className="text-sm text-[#9A9A9A]">{data.industry}</span>}
              {data.website && (
                <a
                  href={data.website}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-sm text-[#606060] hover:text-[#F7941D] flex items-center gap-1 transition-colors"
                >
                  <Globe size={12} />
                  {data.website.replace(/^https?:\/\//, "").replace(/\/$/, "")}
                </a>
              )}
            </div>
            {data.notes && <p className="text-sm text-[#9A9A9A] mt-2 line-clamp-2">{data.notes}</p>}
          </div>

          <Button variant="secondary" size="sm" icon={<Pencil size={13} />} onClick={() => setEditing(true)}>
            Edit
          </Button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-1 bg-[#111111] border border-[rgba(255,255,255,0.06)] rounded-xl p-1">
        {TABS.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium transition-all ${
              activeTab === tab.id
                ? "bg-[#F7941D] text-white"
                : "text-[#9A9A9A] hover:text-[#F0F0F0] hover:bg-[rgba(255,255,255,0.04)]"
            }`}
          >
            <tab.icon size={14} />
            <span className="hidden sm:inline">{tab.label}</span>
            {tab.count !== undefined && tab.count > 0 && (
              <span className={`text-xs rounded-full px-1.5 py-0.5 ${activeTab === tab.id ? "bg-white/20" : "bg-[rgba(255,255,255,0.08)]"}`}>
                {tab.count}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Tab content */}
      <AnimatePresence mode="wait">
        {/* ── Overview ─────────────────────────────────────────────────────── */}
        {activeTab === "overview" && (
          <motion.div key="overview" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="space-y-4">
            {editing ? (
              <Card>
                <CardBody className="space-y-4">
                  <h3 className="text-sm font-bold text-[#F0F0F0]">Edit Account</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <Input label="Company Name *" value={editForm.name} onChange={(e) => setEditForm({ ...editForm, name: e.target.value })} />
                    <Input label="Website" placeholder="https://" value={editForm.website} onChange={(e) => setEditForm({ ...editForm, website: e.target.value })} />
                    <Input label="Industry" value={editForm.industry} onChange={(e) => setEditForm({ ...editForm, industry: e.target.value })} />
                    <div className="grid grid-cols-2 gap-3">
                      <div className="flex flex-col gap-1.5">
                        <label className="text-xs font-medium text-[#9A9A9A] uppercase tracking-wider">Tier</label>
                        <select value={editForm.tier} onChange={(e) => setEditForm({ ...editForm, tier: e.target.value })}
                          className="w-full bg-[#222222] border border-[rgba(255,255,255,0.08)] rounded-lg px-3 py-2 text-sm text-[#F0F0F0] focus:outline-none focus:border-[#F7941D]">
                          <option value="enterprise">Enterprise</option>
                          <option value="standard">Standard</option>
                          <option value="startup">Startup</option>
                        </select>
                      </div>
                      <div className="flex flex-col gap-1.5">
                        <label className="text-xs font-medium text-[#9A9A9A] uppercase tracking-wider">Status</label>
                        <select value={editForm.status} onChange={(e) => setEditForm({ ...editForm, status: e.target.value })}
                          className="w-full bg-[#222222] border border-[rgba(255,255,255,0.08)] rounded-lg px-3 py-2 text-sm text-[#F0F0F0] focus:outline-none focus:border-[#F7941D]">
                          <option value="active">Active</option>
                          <option value="at-risk">At Risk</option>
                          <option value="inactive">Inactive</option>
                        </select>
                      </div>
                    </div>
                    <div className="md:col-span-2 flex flex-col gap-1.5">
                      <label className="text-xs font-medium text-[#9A9A9A] uppercase tracking-wider">
                        Health Score — {HEALTH_CONFIG[editForm.healthScore]?.label}
                      </label>
                      <div className="flex items-center gap-3">
                        {HEALTH_DOTS.map((n) => {
                          const h = HEALTH_CONFIG[n];
                          return (
                            <button key={n} onClick={() => setEditForm({ ...editForm, healthScore: n })} className="flex flex-col items-center gap-1">
                              <div className="w-5 h-5 rounded-full border-2 transition-all"
                                style={{ backgroundColor: n <= editForm.healthScore ? h.color : "transparent", borderColor: n <= editForm.healthScore ? h.color : "rgba(255,255,255,0.15)" }}
                              />
                              <span className="text-xs text-[#606060]">{n}</span>
                            </button>
                          );
                        })}
                      </div>
                    </div>
                    <div className="md:col-span-2">
                      <Textarea label="Notes" value={editForm.notes} onChange={(e) => setEditForm({ ...editForm, notes: e.target.value })} rows={3} />
                    </div>
                  </div>

                  {/* Production URLs */}
                  <div className="flex flex-col gap-3">
                    <div className="flex items-center justify-between">
                      <label className="text-xs font-medium text-[#9A9A9A] uppercase tracking-wider">Production URLs</label>
                      <button
                        onClick={() => setEditUrls((prev) => [...prev, { label: "", url: "" }])}
                        className="text-xs text-[#F7941D] hover:text-[#FBBA00] flex items-center gap-1 transition-colors"
                      >
                        <Plus size={12} /> Add URL
                      </button>
                    </div>
                    {editUrls.map((u, i) => (
                      <div key={i} className="flex items-center gap-2">
                        <input
                          placeholder="Label (e.g. Production)"
                          value={u.label}
                          onChange={(e) => setEditUrls((prev) => prev.map((x, j) => j === i ? { ...x, label: e.target.value } : x))}
                          className="w-36 flex-shrink-0 bg-[#222222] border border-[rgba(255,255,255,0.08)] rounded-lg px-3 py-2 text-sm text-[#F0F0F0] focus:outline-none focus:border-[#F7941D]"
                        />
                        <input
                          placeholder="https://..."
                          value={u.url}
                          onChange={(e) => setEditUrls((prev) => prev.map((x, j) => j === i ? { ...x, url: e.target.value } : x))}
                          className="flex-1 bg-[#222222] border border-[rgba(255,255,255,0.08)] rounded-lg px-3 py-2 text-sm text-[#F0F0F0] focus:outline-none focus:border-[#F7941D]"
                        />
                        <button onClick={() => setEditUrls((prev) => prev.filter((_, j) => j !== i))} className="text-[#606060] hover:text-[#EF4444] transition-colors">
                          <X size={14} />
                        </button>
                      </div>
                    ))}
                    {editUrls.length === 0 && (
                      <p className="text-xs text-[#606060]">No production URLs yet.</p>
                    )}
                  </div>

                  <div className="flex justify-end gap-3 pt-2">
                    <Button variant="secondary" onClick={() => setEditing(false)}>Cancel</Button>
                    <Button variant="primary" loading={saving} icon={<CheckCircle size={14} />} onClick={saveOverview} disabled={!editForm.name.trim()}>
                      Save Changes
                    </Button>
                  </div>
                </CardBody>
              </Card>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Account info */}
                <Card>
                  <CardBody className="space-y-3">
                    <h3 className="text-xs font-bold text-[#9A9A9A] uppercase tracking-wider">Account Info</h3>
                    <div className="space-y-2">
                      {[
                        { label: "Status", value: currentStatus.label, color: currentStatus.color },
                        { label: "Tier", value: currentTier.label, color: currentTier.color },
                        { label: "Industry", value: data.industry ?? "—" },
                        { label: "Website", value: data.website ?? "—" },
                        { label: "Since", value: formatDate(data.createdAt) },
                      ].map(({ label, value, color }) => (
                        <div key={label} className="flex items-center justify-between text-sm">
                          <span className="text-[#606060]">{label}</span>
                          <span style={color ? { color } : {}} className="text-[#F0F0F0] font-medium">{value}</span>
                        </div>
                      ))}
                    </div>
                  </CardBody>
                </Card>

                {/* Health */}
                <Card>
                  <CardBody className="space-y-3">
                    <h3 className="text-xs font-bold text-[#9A9A9A] uppercase tracking-wider">Health Score</h3>
                    <div className="flex items-center gap-3">
                      <div
                        className="w-16 h-16 rounded-2xl flex items-center justify-center text-2xl font-black"
                        style={{ backgroundColor: `${HEALTH_CONFIG[data.healthScore]?.color}22`, color: HEALTH_CONFIG[data.healthScore]?.color }}
                      >
                        {data.healthScore}
                      </div>
                      <div>
                        <p className="text-lg font-bold text-[#F0F0F0]">{HEALTH_CONFIG[data.healthScore]?.label}</p>
                        <HealthDots score={data.healthScore} />
                      </div>
                    </div>
                    {data.notes && (
                      <p className="text-sm text-[#9A9A9A] leading-relaxed border-t border-[rgba(255,255,255,0.05)] pt-3">{data.notes}</p>
                    )}
                  </CardBody>
                </Card>

                {/* Production URLs */}
                <Card className="md:col-span-2">
                  <CardBody className="space-y-3">
                    <div className="flex items-center justify-between">
                      <h3 className="text-xs font-bold text-[#9A9A9A] uppercase tracking-wider">Production URLs</h3>
                      <button onClick={() => setEditing(true)} className="text-xs text-[#F7941D] hover:text-[#FBBA00] transition-colors">
                        Manage
                      </button>
                    </div>
                    {productionUrls.length === 0 ? (
                      <p className="text-sm text-[#606060]">No production URLs configured. <button onClick={() => setEditing(true)} className="text-[#F7941D] hover:underline">Add one</button></p>
                    ) : (
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                        {productionUrls.map((u, i) => (
                          <a
                            key={i}
                            href={u.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex items-center gap-2 p-3 bg-[#222222] rounded-lg hover:bg-[rgba(247,148,29,0.06)] transition-colors group"
                          >
                            <Globe size={14} className="text-[#F7941D] flex-shrink-0" />
                            <div className="flex-1 min-w-0">
                              <p className="text-xs font-semibold text-[#F0F0F0]">{u.label || "URL"}</p>
                              <p className="text-xs text-[#606060] truncate">{u.url}</p>
                            </div>
                            <ExternalLink size={12} className="text-[#606060] group-hover:text-[#F7941D] flex-shrink-0 transition-colors" />
                          </a>
                        ))}
                      </div>
                    )}
                  </CardBody>
                </Card>
              </div>
            )}
          </motion.div>
        )}

        {/* ── Contacts ─────────────────────────────────────────────────────── */}
        {activeTab === "contacts" && (
          <motion.div key="contacts" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="space-y-4">
            <div className="flex items-center justify-between">
              <p className="text-sm text-[#9A9A9A]">{contacts.length} {contacts.length === 1 ? "contact" : "contacts"}</p>
              <Button variant="primary" size="sm" icon={<Plus size={14} />} onClick={() => setShowAddContact(true)}>
                Add Contact
              </Button>
            </div>

            {/* Add contact form */}
            <AnimatePresence>
              {showAddContact && (
                <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }} className="overflow-hidden">
                  <Card>
                    <CardBody className="space-y-4">
                      <div className="flex items-center justify-between">
                        <h3 className="text-sm font-bold text-[#F0F0F0]">New Contact</h3>
                        <button onClick={() => setShowAddContact(false)} className="text-[#606060] hover:text-[#F0F0F0]"><X size={14} /></button>
                      </div>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <Input label="Name *" placeholder="Jane Smith" value={newContact.name} onChange={(e) => setNewContact({ ...newContact, name: e.target.value })} />
                        <Input label="Title / Role" placeholder="VP of Operations" value={newContact.title} onChange={(e) => setNewContact({ ...newContact, title: e.target.value })} />
                        <Input label="Email" placeholder="jane@company.com" value={newContact.email} onChange={(e) => setNewContact({ ...newContact, email: e.target.value })} />
                        <Input label="Phone" placeholder="+1 555..." value={newContact.phone} onChange={(e) => setNewContact({ ...newContact, phone: e.target.value })} />
                        <div className="md:col-span-2">
                          <Textarea label="Notes" placeholder="Any context about this contact..." value={newContact.notes} onChange={(e) => setNewContact({ ...newContact, notes: e.target.value })} rows={2} />
                        </div>
                        <div className="flex items-center gap-2">
                          <input type="checkbox" id="isPrimary" checked={newContact.isPrimary} onChange={(e) => setNewContact({ ...newContact, isPrimary: e.target.checked })} className="w-4 h-4 accent-[#F7941D]" />
                          <label htmlFor="isPrimary" className="text-sm text-[#9A9A9A] flex items-center gap-1"><Crown size={12} className="text-[#F7941D]" /> Primary contact</label>
                        </div>
                      </div>
                      <div className="flex justify-end gap-3">
                        <Button variant="secondary" onClick={() => setShowAddContact(false)}>Cancel</Button>
                        <Button variant="primary" loading={addingContact} icon={<Plus size={14} />} onClick={addContact} disabled={!newContact.name.trim()}>
                          Add Contact
                        </Button>
                      </div>
                    </CardBody>
                  </Card>
                </motion.div>
              )}
            </AnimatePresence>

            {contacts.length === 0 ? (
              <div className="text-center py-12">
                <Users size={36} className="text-[#333333] mx-auto mb-3" />
                <p className="text-[#606060] text-sm">No contacts yet</p>
                <button onClick={() => setShowAddContact(true)} className="text-sm text-[#F7941D] mt-2 hover:text-[#FBBA00] transition-colors">
                  Add the first contact →
                </button>
              </div>
            ) : (
              <div className="space-y-3">
                {contacts.sort((a, b) => (b.isPrimary ? 1 : 0) - (a.isPrimary ? 1 : 0)).map((contact) => (
                  <Card key={contact.id}>
                    <CardBody>
                      {editingContact === contact.id ? (
                        <div className="space-y-3">
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                            <Input label="Name" value={editContact.name ?? contact.name} onChange={(e) => setEditContact({ ...editContact, name: e.target.value })} />
                            <Input label="Title" value={editContact.title ?? contact.title ?? ""} onChange={(e) => setEditContact({ ...editContact, title: e.target.value })} />
                            <Input label="Email" value={editContact.email ?? contact.email ?? ""} onChange={(e) => setEditContact({ ...editContact, email: e.target.value })} />
                            <Input label="Phone" value={editContact.phone ?? contact.phone ?? ""} onChange={(e) => setEditContact({ ...editContact, phone: e.target.value })} />
                            <div className="md:col-span-2">
                              <Textarea label="Notes" value={editContact.notes ?? contact.notes ?? ""} onChange={(e) => setEditContact({ ...editContact, notes: e.target.value })} rows={2} />
                            </div>
                          </div>
                          <div className="flex justify-end gap-2">
                            <Button variant="secondary" size="sm" onClick={() => setEditingContact(null)}>Cancel</Button>
                            <Button variant="primary" size="sm" icon={<CheckCircle size={13} />} onClick={() => saveContact(contact.id)}>Save</Button>
                          </div>
                        </div>
                      ) : (
                        <div className="flex items-start gap-3">
                          <Avatar name={contact.name} size="sm" />
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="text-sm font-bold text-[#F0F0F0]">{contact.name}</span>
                              {contact.isPrimary && (
                                <span className="text-xs px-2 py-0.5 rounded-full bg-[rgba(247,148,29,0.15)] text-[#F7941D] flex items-center gap-1">
                                  <Crown size={10} /> Primary
                                </span>
                              )}
                              {contact.title && <span className="text-xs text-[#9A9A9A]">{contact.title}</span>}
                            </div>
                            <div className="flex items-center gap-4 mt-1 text-xs text-[#606060] flex-wrap">
                              {contact.email && (
                                <a href={`mailto:${contact.email}`} className="flex items-center gap-1 hover:text-[#F7941D] transition-colors">
                                  <Mail size={10} /> {contact.email}
                                </a>
                              )}
                              {contact.phone && (
                                <a href={`tel:${contact.phone}`} className="flex items-center gap-1 hover:text-[#F7941D] transition-colors">
                                  <Phone size={10} /> {contact.phone}
                                </a>
                              )}
                            </div>
                            {contact.notes && <p className="text-xs text-[#606060] mt-1">{contact.notes}</p>}
                          </div>
                          <div className="flex items-center gap-1">
                            <button
                              onClick={() => { setEditingContact(contact.id); setEditContact({}); }}
                              className="p-1.5 text-[#606060] hover:text-[#F0F0F0] hover:bg-[rgba(255,255,255,0.06)] rounded-lg transition-all"
                            >
                              <Pencil size={13} />
                            </button>
                            <button
                              onClick={() => deleteContact(contact.id)}
                              className="p-1.5 text-[#606060] hover:text-[#EF4444] hover:bg-[rgba(239,68,68,0.08)] rounded-lg transition-all"
                            >
                              <Trash2 size={13} />
                            </button>
                          </div>
                        </div>
                      )}
                    </CardBody>
                  </Card>
                ))}
              </div>
            )}
          </motion.div>
        )}

        {/* ── Notes ─────────────────────────────────────────────────────────── */}
        {activeTab === "notes" && (
          <motion.div key="notes" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="space-y-4">
            {/* Add note */}
            <Card>
              <CardBody className="space-y-3">
                <div className="flex items-center gap-2">
                  <label className="text-xs font-medium text-[#9A9A9A] uppercase tracking-wider">Type</label>
                  <div className="flex gap-1.5 flex-wrap">
                    {(Object.entries(NOTE_TYPE_CONFIG) as [string, { label: string; color: string; bg: string }][]).map(([key, cfg]) => (
                      <button
                        key={key}
                        onClick={() => setNoteType(key)}
                        className="text-xs px-2.5 py-1 rounded-full font-medium transition-all border"
                        style={
                          noteType === key
                            ? { color: cfg.color, backgroundColor: cfg.bg, borderColor: cfg.color }
                            : { color: "#606060", backgroundColor: "transparent", borderColor: "rgba(255,255,255,0.08)" }
                        }
                      >
                        {cfg.label}
                      </button>
                    ))}
                  </div>
                </div>
                <Textarea
                  placeholder="Add a note, feature request, meeting summary..."
                  value={noteBody}
                  onChange={(e) => setNoteBody(e.target.value)}
                  rows={3}
                />
                <div className="flex justify-end">
                  <Button variant="primary" size="sm" loading={addingNote} icon={<Plus size={14} />} onClick={addNote} disabled={!noteBody.trim()}>
                    Add Note
                  </Button>
                </div>
              </CardBody>
            </Card>

            {notes.length === 0 ? (
              <div className="text-center py-12">
                <MessageSquare size={36} className="text-[#333333] mx-auto mb-3" />
                <p className="text-[#606060] text-sm">No notes yet — add your first one above</p>
              </div>
            ) : (
              <div className="space-y-3">
                {notes.map((note) => {
                  const typeConfig = NOTE_TYPE_CONFIG[note.type as keyof typeof NOTE_TYPE_CONFIG] ?? NOTE_TYPE_CONFIG.general;
                  const authorName = note.author.displayName ?? note.author.name ?? "Unknown";
                  return (
                    <motion.div
                      key={note.id}
                      initial={{ opacity: 0, y: 6 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="bg-[#1A1A1A] border border-[rgba(255,255,255,0.07)] rounded-xl p-4"
                    >
                      <div className="flex items-start gap-3">
                        <Avatar src={note.author.image} name={authorName} size="xs" />
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap mb-2">
                            <span className="text-xs font-semibold text-[#F0F0F0]">{authorName}</span>
                            <span
                              className="text-xs px-2 py-0.5 rounded-full font-medium"
                              style={{ color: typeConfig.color, backgroundColor: typeConfig.bg }}
                            >
                              {typeConfig.label}
                            </span>
                            <span className="text-xs text-[#606060] ml-auto">{timeAgo(note.createdAt)}</span>
                          </div>
                          <p className="text-sm text-[#D0D0D0] leading-relaxed whitespace-pre-wrap">{note.body}</p>
                        </div>
                        <button
                          onClick={() => deleteNote(note.id)}
                          className="p-1.5 text-[#404040] hover:text-[#EF4444] hover:bg-[rgba(239,68,68,0.08)] rounded-lg transition-all flex-shrink-0"
                        >
                          <Trash2 size={12} />
                        </button>
                      </div>
                    </motion.div>
                  );
                })}
              </div>
            )}
          </motion.div>
        )}

        {/* ── Docs ──────────────────────────────────────────────────────────── */}
        {activeTab === "docs" && (
          <motion.div key="docs" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="space-y-4">
            <Card>
              <CardBody className="space-y-3">
                <div
                  {...getRootProps()}
                  className={`relative border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-all duration-200 ${
                    isDragActive
                      ? "border-[#F7941D] bg-[rgba(247,148,29,0.08)]"
                      : "border-[rgba(255,255,255,0.1)] hover:border-[rgba(247,148,29,0.3)] hover:bg-[rgba(247,148,29,0.03)]"
                  }`}
                >
                  <input {...getInputProps()} />
                  {uploading ? (
                    <div className="flex flex-col items-center gap-2">
                      <Loader2 size={28} className="animate-spin text-[#F7941D]" />
                      <p className="text-[#9A9A9A] text-sm">Uploading...</p>
                    </div>
                  ) : (
                    <div className="flex flex-col items-center gap-2">
                      <CloudUpload size={28} className={isDragActive ? "text-[#F7941D] animate-bounce" : "text-[#F7941D]"} />
                      <p className="text-[#F0F0F0] text-sm font-semibold">{isDragActive ? "Drop here" : "Drag & drop or click to upload"}</p>
                      <p className="text-xs text-[#606060]">PDF, Audio, Text, Images, Word — max 50MB</p>
                    </div>
                  )}
                </div>

                {uploadMsg && (
                  <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    className={`flex items-center gap-2 p-3 rounded-xl text-sm ${
                      uploadMsg.ok
                        ? "bg-[rgba(34,197,94,0.1)] border border-[rgba(34,197,94,0.2)] text-[#22C55E]"
                        : "bg-[rgba(239,68,68,0.1)] border border-[rgba(239,68,68,0.2)] text-[#EF4444]"
                    }`}
                  >
                    {uploadMsg.ok ? <CheckCircle size={14} /> : <AlertTriangle size={14} />}
                    {uploadMsg.text}
                  </motion.div>
                )}
              </CardBody>
            </Card>

            {docs.length === 0 ? (
              <div className="text-center py-10">
                <FileText size={36} className="text-[#333333] mx-auto mb-3" />
                <p className="text-[#606060] text-sm">No documents uploaded yet</p>
              </div>
            ) : (
              <div className="space-y-2">
                {docs.map((doc) => {
                  const Icon = FILE_ICONS[doc.fileType] ?? File;
                  return (
                    <div key={doc.id} className="flex items-center gap-3 bg-[#1A1A1A] border border-[rgba(255,255,255,0.07)] rounded-xl p-4">
                      <div className="w-9 h-9 rounded-lg bg-[rgba(247,148,29,0.1)] flex items-center justify-center flex-shrink-0">
                        <Icon size={16} className="text-[#F7941D]" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-[#F0F0F0] truncate">{doc.filename}</p>
                        <p className="text-xs text-[#606060]">
                          {formatBytes(doc.fileSize)} · {timeAgo(doc.createdAt)}
                          {doc.uploader.name && ` · ${doc.uploader.name}`}
                        </p>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
