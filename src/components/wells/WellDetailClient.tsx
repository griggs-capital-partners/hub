"use client";

import { useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { useDropzone } from "react-dropzone";
import {
  ArrowLeft, Drill, Users, FileText, MessageSquare,
  Plus, X, Loader2, CheckCircle, Pencil, Trash2,
  Upload, File, Mic, Image as ImageIcon,
  Phone, Mail, Crown, MapPin,
} from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Input, Textarea } from "@/components/ui/Input";
import { Card, CardBody } from "@/components/ui/Card";
import { Avatar } from "@/components/ui/Avatar";
import { NOTE_TYPE_CONFIG, formatDate } from "@/lib/utils";

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

interface Well {
  id: string;
  name: string;
  address: string | null;
  status: string;
  priority: string;
  notes: string | null;
  createdAt: Date;
  updatedAt: Date;
  contacts: Contact[];
  documents: Document[];
  noteItems: Note[];
}

interface Props {
  well: Well;
}

type Tab = "overview" | "contacts" | "notes" | "docs";

const WELL_STATUS_CONFIG = {
  active:   { label: "Active",   color: "#22C55E", bg: "rgba(34,197,94,0.15)" },
  inactive: { label: "Inactive", color: "#9A9A9A", bg: "rgba(154,154,154,0.15)" },
  plugged:  { label: "Plugged",  color: "#606060", bg: "rgba(96,96,96,0.15)" },
} as const;

const PRIORITY_CONFIG = {
  critical: { label: "Critical", color: "#EF4444" },
  high:     { label: "High",     color: "#F97316" },
  medium:   { label: "Medium",   color: "#FBBA00" },
  low:      { label: "Low",      color: "#9A9A9A" },
} as const;

const WELL_NOTE_TYPE_CONFIG = {
  ...NOTE_TYPE_CONFIG,
  inspection: { label: "Inspection", color: "#22C55E", bg: "rgba(34,197,94,0.1)" },
} as const;

const FILE_ICONS: Record<string, React.ElementType> = {
  pdf: FileText, text: FileText, audio: Mic, image: ImageIcon, document: FileText,
};

function formatBytes(bytes: number) {
  if (bytes < 1024) return `${bytes}B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)}KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)}MB`;
}

export function WellDetailClient({ well }: Props) {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<Tab>("overview");
  const [data, setData] = useState(well);

  // ── Overview edit state ──────────────────────────────────────────────────────
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [editForm, setEditForm] = useState({
    name: data.name,
    address: data.address ?? "",
    status: data.status,
    priority: data.priority,
    notes: data.notes ?? "",
  });

  async function saveOverview() {
    setSaving(true);
    try {
      const res = await fetch(`/api/wells/${data.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(editForm),
      });
      const updated = await res.json();
      setData((prev) => ({ ...prev, ...updated.well }));
      setEditing(false);
    } catch { /* noop */ }
    finally { setSaving(false); }
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
      const res = await fetch(`/api/wells/${data.id}/contacts`, {
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
    const res = await fetch(`/api/wells/${data.id}/contacts/${contactId}`, {
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
    await fetch(`/api/wells/${data.id}/contacts/${contactId}`, { method: "DELETE" });
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
      const res = await fetch(`/api/wells/${data.id}/notes`, {
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
    await fetch(`/api/wells/${data.id}/notes`, {
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
      formData.append("wellId", data.id);
      try {
        const res = await fetch("/api/wells/upload", { method: "POST", body: formData });
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

  const currentStatus = WELL_STATUS_CONFIG[data.status as keyof typeof WELL_STATUS_CONFIG] ?? WELL_STATUS_CONFIG.active;
  const currentPriority = PRIORITY_CONFIG[data.priority as keyof typeof PRIORITY_CONFIG] ?? PRIORITY_CONFIG.medium;

  const TABS: { id: Tab; label: string; icon: React.ElementType; count?: number }[] = [
    { id: "overview", label: "Overview", icon: Drill },
    { id: "contacts", label: "Contacts", icon: Users, count: contacts.length },
    { id: "notes", label: "Notes", icon: MessageSquare, count: notes.length },
    { id: "docs", label: "Docs", icon: FileText, count: docs.length },
  ];

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      {/* Back */}
      <button
        onClick={() => router.push("/wells")}
        className="flex items-center gap-1.5 text-sm text-[#606060] hover:text-[#F0F0F0] transition-colors"
      >
        <ArrowLeft size={14} />
        Oil Wells
      </button>

      {/* Header card */}
      <div className="bg-[#1A1A1A] border border-[rgba(255,255,255,0.07)] rounded-xl p-6">
        <div className="flex items-start gap-5 flex-wrap">
          <div className="w-16 h-16 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: "linear-gradient(135deg, #F7941D 0%, #7B1C24 100%)" }}>
            <Drill size={28} className="text-white" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-3 flex-wrap">
              <h1 className="text-2xl font-black text-[#F0F0F0]">{data.name}</h1>
              <span className="text-xs px-2.5 py-1 rounded-full font-semibold" style={{ color: currentStatus.color, backgroundColor: currentStatus.bg }}>
                {currentStatus.label}
              </span>
              <span className="text-xs px-2.5 py-1 rounded-full font-semibold bg-[rgba(255,255,255,0.06)]" style={{ color: currentPriority.color }}>
                {currentPriority.label} priority
              </span>
            </div>
            {data.address && (
              <div className="flex items-start gap-1.5 mt-2 text-sm text-[#9A9A9A]">
                <MapPin size={13} className="mt-0.5 flex-shrink-0" />
                <span>{data.address}</span>
              </div>
            )}
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
                  <h3 className="text-sm font-bold text-[#F0F0F0]">Edit Well</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <Input label="Well Name *" value={editForm.name} onChange={(e) => setEditForm({ ...editForm, name: e.target.value })} />
                    <Input label="Address / Legal Description" placeholder="Sec. 14, T2N, R3W..." value={editForm.address} onChange={(e) => setEditForm({ ...editForm, address: e.target.value })} />
                    <div className="grid grid-cols-2 gap-3">
                      <div className="flex flex-col gap-1.5">
                        <label className="text-xs font-medium text-[#9A9A9A] uppercase tracking-wider">Status</label>
                        <select value={editForm.status} onChange={(e) => setEditForm({ ...editForm, status: e.target.value })}
                          className="w-full bg-[#222222] border border-[rgba(255,255,255,0.08)] rounded-lg px-3 py-2 text-sm text-[#F0F0F0] focus:outline-none focus:border-[#F7941D]">
                          <option value="active">Active</option>
                          <option value="inactive">Inactive</option>
                          <option value="plugged">Plugged</option>
                        </select>
                      </div>
                      <div className="flex flex-col gap-1.5">
                        <label className="text-xs font-medium text-[#9A9A9A] uppercase tracking-wider">Priority</label>
                        <select value={editForm.priority} onChange={(e) => setEditForm({ ...editForm, priority: e.target.value })}
                          className="w-full bg-[#222222] border border-[rgba(255,255,255,0.08)] rounded-lg px-3 py-2 text-sm text-[#F0F0F0] focus:outline-none focus:border-[#F7941D]">
                          <option value="critical">Critical</option>
                          <option value="high">High</option>
                          <option value="medium">Medium</option>
                          <option value="low">Low</option>
                        </select>
                      </div>
                    </div>
                    <div className="md:col-span-2">
                      <Textarea label="Notes" value={editForm.notes} onChange={(e) => setEditForm({ ...editForm, notes: e.target.value })} rows={3} />
                    </div>
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
                <Card>
                  <CardBody className="space-y-3">
                    <h3 className="text-xs font-bold text-[#9A9A9A] uppercase tracking-wider">Well Info</h3>
                    <div className="space-y-2">
                      {[
                        { label: "Status", value: currentStatus.label, color: currentStatus.color },
                        { label: "Priority", value: currentPriority.label, color: currentPriority.color },
                        { label: "Address", value: data.address ?? "—" },
                        { label: "Added", value: formatDate(data.createdAt) },
                      ].map(({ label, value, color }) => (
                        <div key={label} className="flex items-start justify-between text-sm gap-2">
                          <span className="text-[#606060] flex-shrink-0">{label}</span>
                          <span style={color ? { color } : {}} className="text-[#F0F0F0] font-medium text-right">{value}</span>
                        </div>
                      ))}
                    </div>
                  </CardBody>
                </Card>
                {data.notes && (
                  <Card>
                    <CardBody className="space-y-3">
                      <h3 className="text-xs font-bold text-[#9A9A9A] uppercase tracking-wider">Notes</h3>
                      <p className="text-sm text-[#C0C0C0] leading-relaxed">{data.notes}</p>
                    </CardBody>
                  </Card>
                )}
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
                        <Input label="Title / Role" placeholder="Field Engineer, Owner..." value={newContact.title} onChange={(e) => setNewContact({ ...newContact, title: e.target.value })} />
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
                            <button onClick={() => { setEditingContact(contact.id); setEditContact({}); }} className="p-1.5 text-[#606060] hover:text-[#F0F0F0] hover:bg-[rgba(255,255,255,0.06)] rounded-lg transition-all">
                              <Pencil size={13} />
                            </button>
                            <button onClick={() => deleteContact(contact.id)} className="p-1.5 text-[#606060] hover:text-[#EF4444] hover:bg-[rgba(239,68,68,0.08)] rounded-lg transition-all">
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

        {/* ── Notes ────────────────────────────────────────────────────────── */}
        {activeTab === "notes" && (
          <motion.div key="notes" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="space-y-4">
            <Card>
              <CardBody className="space-y-3">
                <div className="flex items-center gap-3 flex-wrap">
                  <div className="flex flex-col gap-1.5">
                    <label className="text-xs font-medium text-[#9A9A9A] uppercase tracking-wider">Type</label>
                    <select value={noteType} onChange={(e) => setNoteType(e.target.value)}
                      className="bg-[#222222] border border-[rgba(255,255,255,0.08)] rounded-lg px-3 py-2 text-sm text-[#F0F0F0] focus:outline-none focus:border-[#F7941D]">
                      <option value="general">Note</option>
                      <option value="inspection">Inspection</option>
                      <option value="issue">Issue</option>
                      <option value="meeting">Meeting</option>
                    </select>
                  </div>
                  <div className="flex-1 min-w-[200px]">
                    <Textarea
                      label="Note"
                      placeholder="Add a field note, inspection result, or meeting summary..."
                      value={noteBody}
                      onChange={(e) => setNoteBody(e.target.value)}
                      rows={2}
                    />
                  </div>
                </div>
                <div className="flex justify-end">
                  <Button variant="primary" size="sm" loading={addingNote} icon={<Plus size={13} />} onClick={addNote} disabled={!noteBody.trim()}>
                    Add Note
                  </Button>
                </div>
              </CardBody>
            </Card>

            {notes.length === 0 ? (
              <div className="text-center py-12">
                <MessageSquare size={36} className="text-[#333333] mx-auto mb-3" />
                <p className="text-[#606060] text-sm">No notes yet</p>
              </div>
            ) : (
              <div className="space-y-3">
                {notes.map((note) => {
                  const cfg = (WELL_NOTE_TYPE_CONFIG as Record<string, { label: string; color: string; bg: string }>)[note.type] ?? WELL_NOTE_TYPE_CONFIG.general;
                  return (
                    <Card key={note.id}>
                      <CardBody>
                        <div className="flex items-start gap-3">
                          <Avatar name={note.author.displayName ?? note.author.name ?? "?"} src={note.author.image ?? undefined} size="xs" />
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 flex-wrap mb-1">
                              <span className="text-xs font-semibold text-[#F0F0F0]">{note.author.displayName ?? note.author.name}</span>
                              <span className="text-xs px-2 py-0.5 rounded-full font-medium" style={{ color: cfg.color, backgroundColor: cfg.bg }}>{cfg.label}</span>
                              <span className="text-xs text-[#606060] ml-auto">{new Date(note.createdAt).toLocaleDateString()}</span>
                            </div>
                            <p className="text-sm text-[#C0C0C0] leading-relaxed whitespace-pre-wrap">{note.body}</p>
                          </div>
                          <button onClick={() => deleteNote(note.id)} className="p-1.5 text-[#606060] hover:text-[#EF4444] hover:bg-[rgba(239,68,68,0.08)] rounded-lg transition-all flex-shrink-0">
                            <Trash2 size={13} />
                          </button>
                        </div>
                      </CardBody>
                    </Card>
                  );
                })}
              </div>
            )}
          </motion.div>
        )}

        {/* ── Docs ─────────────────────────────────────────────────────────── */}
        {activeTab === "docs" && (
          <motion.div key="docs" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="space-y-4">
            <div
              {...getRootProps()}
              className={`border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-all ${isDragActive ? "border-[#F7941D] bg-[rgba(247,148,29,0.05)]" : "border-[rgba(255,255,255,0.08)] hover:border-[rgba(247,148,29,0.3)]"}`}
            >
              <input {...getInputProps()} />
              {uploading ? (
                <Loader2 size={24} className="text-[#F7941D] animate-spin mx-auto mb-2" />
              ) : (
                <Upload size={24} className="text-[#606060] mx-auto mb-2" />
              )}
              <p className="text-sm text-[#9A9A9A]">{isDragActive ? "Drop files here" : "Drag files or click to upload"}</p>
              <p className="text-xs text-[#606060] mt-1">PDF, Word, images, audio — max 50MB</p>
              {uploadMsg && (
                <p className={`text-xs mt-2 font-medium ${uploadMsg.ok ? "text-[#22C55E]" : "text-[#EF4444]"}`}>{uploadMsg.text}</p>
              )}
            </div>

            {docs.length === 0 ? (
              <div className="text-center py-8">
                <FileText size={32} className="text-[#333333] mx-auto mb-3" />
                <p className="text-[#606060] text-sm">No documents yet</p>
              </div>
            ) : (
              <div className="space-y-2">
                {docs.map((doc) => {
                  const Icon = FILE_ICONS[doc.fileType] ?? File;
                  return (
                    <Card key={doc.id}>
                      <CardBody>
                        <div className="flex items-center gap-3">
                          <div className="w-9 h-9 rounded-lg bg-[rgba(247,148,29,0.1)] flex items-center justify-center flex-shrink-0">
                            <Icon size={16} className="text-[#F7941D]" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium text-[#F0F0F0] truncate">{doc.filename}</p>
                            <p className="text-xs text-[#606060]">
                              {formatBytes(doc.fileSize)} · {doc.uploader.name ?? doc.uploader.email} · {new Date(doc.createdAt).toLocaleDateString()}
                            </p>
                          </div>
                        </div>
                      </CardBody>
                    </Card>
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
