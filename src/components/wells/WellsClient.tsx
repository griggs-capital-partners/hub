"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import {
  Drill, Plus, Search, X, Loader2, CheckCircle, ChevronRight,
  BookOpen, Check, Calendar, MapPin, Users,
} from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Input, Textarea } from "@/components/ui/Input";
import { Card, CardBody } from "@/components/ui/Card";
import { timeAgo } from "@/lib/utils";

interface Contact {
  id: string;
  name: string;
  title: string | null;
  isPrimary: boolean;
}

interface WellSummary {
  id: string;
  name: string;
  address: string | null;
  status: string;
  priority: string;
  notes: string | null;
  updatedAt: Date;
  contacts: Contact[];
  documents: { id: string }[];
  noteItems: { id: string }[];
}

interface Props {
  wells: WellSummary[];
}

const WELL_STATUS_CONFIG = {
  active:   { label: "Active",   color: "#22C55E", bg: "rgba(34,197,94,0.15)" },
  inactive: { label: "Inactive", color: "#9A9A9A", bg: "rgba(154,154,154,0.15)" },
  plugged:  { label: "Plugged",  color: "#606060", bg: "rgba(96,96,96,0.15)" },
} as const;

// ─── Weekly Notes History Modal ───────────────────────────────────────────────

type ItemType = "header" | "todo" | "note";

interface NoteItem {
  id: string;
  type: ItemType;
  content: string;
  isChecked: boolean;
  indent: number;
}

interface WeeklyEntry {
  id: string;
  customerName: string;
  items: string;
  weeklyNote: { id: string; weekStart: string };
}

function formatWeekRange(weekStart: string): string {
  const start = new Date(weekStart);
  const end = new Date(start);
  end.setUTCDate(end.getUTCDate() + 6);
  const startStr = start.toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" });
  const endStr = end.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric", timeZone: "UTC" });
  return `${startStr} – ${endStr}`;
}

function parseItems(raw: string): NoteItem[] {
  try {
    return (JSON.parse(raw) as NoteItem[]).map((i) => ({ ...i, type: (i.type ?? "note") as ItemType }));
  } catch { return []; }
}

function ReadOnlyNoteItem({ item }: { item: NoteItem }) {
  const indentLeft = item.type === "header" ? 0 : item.indent === 0 ? 0 : item.indent === 1 ? 16 : 32;

  if (item.type === "header") {
    return (
      <div className="flex items-center gap-2 mt-3 mb-0.5 first:mt-0">
        <span className="text-[10px] font-black text-[#F7941D] opacity-60 w-3 text-center">H</span>
        <span className="text-xs font-bold text-[#F0F0F0] tracking-wide">{item.content}</span>
      </div>
    );
  }

  if (item.type === "todo") {
    return (
      <div className="flex items-start gap-2 py-0.5" style={{ paddingLeft: indentLeft }}>
        <div className={`w-3.5 h-3.5 mt-0.5 rounded flex items-center justify-center border flex-shrink-0 ${item.isChecked ? "bg-[#F7941D] border-[#F7941D]" : "border-[rgba(255,255,255,0.2)]"}`}>
          {item.isChecked && <Check size={9} className="text-white" strokeWidth={3} />}
        </div>
        <span className={`text-xs leading-relaxed ${item.isChecked ? "line-through text-[#505050]" : "text-[#C0C0C0]"}`}>
          {item.content}
        </span>
      </div>
    );
  }

  return (
    <div className="flex items-start gap-2 py-0.5" style={{ paddingLeft: indentLeft }}>
      <span className="w-3.5 text-center text-[#505050] mt-0.5 flex-shrink-0 text-[8px]">•</span>
      <span className="text-xs text-[#C0C0C0] leading-relaxed">{item.content}</span>
    </div>
  );
}

function WeeklyNotesHistoryModal({ well, onClose }: { well: WellSummary; onClose: () => void }) {
  const [entries, setEntries] = useState<WeeklyEntry[]>([]);
  const [loading, setLoading] = useState(true);

  useState(() => {
    fetch(`/api/wells/${well.id}/weekly-notes`)
      .then((r) => r.json())
      .then((data: WeeklyEntry[]) => { setEntries(data); setLoading(false); })
      .catch(() => setLoading(false));
  });

  const hasNotes = entries.some((e) => parseItems(e.items).some((i) => i.content.trim()));

  return (
    <motion.div
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4"
      onClick={onClose}
    >
      <motion.div
        initial={{ scale: 0.95, y: 12 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.95, y: 12 }}
        transition={{ duration: 0.2 }}
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-lg bg-[#141414] border border-[rgba(255,255,255,0.09)] rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[80vh]"
      >
        <div className="flex items-center gap-3 px-5 py-4 border-b border-[rgba(255,255,255,0.06)] flex-shrink-0">
          <div className="w-8 h-8 rounded-lg bg-[rgba(247,148,29,0.1)] border border-[rgba(247,148,29,0.2)] flex items-center justify-center flex-shrink-0">
            <BookOpen size={14} className="text-[#F7941D]" />
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="text-sm font-bold text-[#F0F0F0] truncate">{well.name}</h3>
            <p className="text-xs text-[#606060]">Weekly notes history</p>
          </div>
          <button onClick={onClose} className="p-1.5 text-[#606060] hover:text-[#F0F0F0] hover:bg-[rgba(255,255,255,0.06)] rounded-lg transition-all flex-shrink-0">
            <X size={14} />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto">
          {loading ? (
            <div className="flex items-center justify-center py-16">
              <Loader2 size={20} className="text-[#F7941D] animate-spin" />
            </div>
          ) : !hasNotes ? (
            <div className="flex flex-col items-center justify-center py-16 px-6 text-center">
              <BookOpen size={28} className="text-[#333] mb-3" />
              <p className="text-sm text-[#606060]">No weekly notes for this well yet.</p>
            </div>
          ) : (
            <div className="p-5 space-y-5">
              {entries.map((entry) => {
                const items = parseItems(entry.items).filter((i) => i.content.trim());
                if (items.length === 0) return null;
                const todoItems = items.filter((i) => i.type === "todo");
                const doneCount = todoItems.filter((i) => i.isChecked).length;
                return (
                  <div key={entry.id} className="rounded-xl border border-[rgba(255,255,255,0.06)] bg-[#1A1A1A] overflow-hidden">
                    <div className="flex items-center justify-between px-4 py-2.5 border-b border-[rgba(255,255,255,0.05)]">
                      <div className="flex items-center gap-2">
                        <Calendar size={11} className="text-[#F7941D]" />
                        <span className="text-xs font-semibold text-[#C0C0C0]">{formatWeekRange(entry.weeklyNote.weekStart)}</span>
                      </div>
                      {todoItems.length > 0 && (
                        <span className="text-[10px] text-[#606060] bg-[rgba(255,255,255,0.05)] px-2 py-0.5 rounded-full">
                          {doneCount}/{todoItems.length} done
                        </span>
                      )}
                    </div>
                    <div className="px-4 py-3 space-y-0.5">
                      {items.map((item) => <ReadOnlyNoteItem key={item.id} item={item} />)}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </motion.div>
    </motion.div>
  );
}

export function WellsClient({ wells }: Props) {
  const router = useRouter();
  const [search, setSearch] = useState("");
  const [showAdd, setShowAdd] = useState(false);
  const [adding, setAdding] = useState(false);
  const [addSuccess, setAddSuccess] = useState(false);
  const [localWells, setLocalWells] = useState(wells);
  const [weeklyNotesWell, setWeeklyNotesWell] = useState<WellSummary | null>(null);
  const [newWell, setNewWell] = useState({ name: "", address: "", status: "active", priority: "medium", notes: "" });

  const filtered = localWells.filter(
    (w) =>
      w.name.toLowerCase().includes(search.toLowerCase()) ||
      w.address?.toLowerCase().includes(search.toLowerCase())
  );

  async function addWell() {
    if (!newWell.name.trim()) return;
    setAdding(true);
    try {
      const res = await fetch("/api/wells", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(newWell),
      });
      const data = await res.json();
      setLocalWells((prev) => [{ ...data.well, contacts: [], documents: [], noteItems: [] }, ...prev]);
      setNewWell({ name: "", address: "", status: "active", priority: "medium", notes: "" });
      setAddSuccess(true);
      setTimeout(() => { setAddSuccess(false); setShowAdd(false); }, 1200);
    } catch {
      console.error("Failed to add well");
    } finally {
      setAdding(false);
    }
  }

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-black text-[#F0F0F0] flex items-center gap-3">
            <Drill size={22} className="text-[#F7941D]" />
            Oil Wells
          </h1>
          <p className="text-sm text-[#606060] mt-0.5">
            {localWells.length} {localWells.length === 1 ? "well" : "wells"}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <div className="relative">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#606060]" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search wells..."
              className="pl-8 pr-3 py-2 bg-[#1A1A1A] border border-[rgba(255,255,255,0.08)] rounded-lg text-sm text-[#F0F0F0] placeholder:text-[#606060] focus:outline-none focus:border-[#F7941D] w-48"
            />
          </div>
          <Button
            variant={showAdd ? "secondary" : "primary"}
            size="sm"
            icon={showAdd ? <X size={14} /> : <Plus size={14} />}
            onClick={() => setShowAdd((v) => !v)}
          >
            {showAdd ? "Cancel" : "Add Well"}
          </Button>
        </div>
      </div>

      {/* Add well form */}
      <AnimatePresence>
        {showAdd && (
          <motion.div
            initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }}
            className="overflow-hidden"
          >
            <Card>
              <CardBody className="space-y-4">
                <h3 className="text-sm font-bold text-[#F0F0F0]">New Oil Well</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <Input
                    label="Well Name *"
                    placeholder="Griggs #1, Section 14 Well..."
                    value={newWell.name}
                    onChange={(e) => setNewWell({ ...newWell, name: e.target.value })}
                  />
                  <Input
                    label="Address / Legal Description"
                    placeholder="Sec. 14, T2N, R3W..."
                    value={newWell.address}
                    onChange={(e) => setNewWell({ ...newWell, address: e.target.value })}
                  />
                  <div className="grid grid-cols-2 gap-3">
                    <div className="flex flex-col gap-1.5">
                      <label className="text-xs font-medium text-[#9A9A9A] uppercase tracking-wider">Status</label>
                      <select
                        value={newWell.status}
                        onChange={(e) => setNewWell({ ...newWell, status: e.target.value })}
                        className="w-full bg-[#222222] border border-[rgba(255,255,255,0.08)] rounded-lg px-3 py-2 text-sm text-[#F0F0F0] focus:outline-none focus:border-[#F7941D]"
                      >
                        <option value="active">Active</option>
                        <option value="inactive">Inactive</option>
                        <option value="plugged">Plugged</option>
                      </select>
                    </div>
                    <div className="flex flex-col gap-1.5">
                      <label className="text-xs font-medium text-[#9A9A9A] uppercase tracking-wider">Priority</label>
                      <select
                        value={newWell.priority}
                        onChange={(e) => setNewWell({ ...newWell, priority: e.target.value })}
                        className="w-full bg-[#222222] border border-[rgba(255,255,255,0.08)] rounded-lg px-3 py-2 text-sm text-[#F0F0F0] focus:outline-none focus:border-[#F7941D]"
                      >
                        <option value="critical">Critical</option>
                        <option value="high">High</option>
                        <option value="medium">Medium</option>
                        <option value="low">Low</option>
                      </select>
                    </div>
                  </div>
                  <div className="md:col-span-2">
                    <Textarea
                      label="Notes"
                      placeholder="Any context about this well..."
                      value={newWell.notes}
                      onChange={(e) => setNewWell({ ...newWell, notes: e.target.value })}
                      rows={2}
                    />
                  </div>
                </div>
                <div className="flex items-center justify-end gap-3">
                  {addSuccess && (
                    <span className="text-sm text-[#22C55E] flex items-center gap-1">
                      <CheckCircle size={14} /> Added!
                    </span>
                  )}
                  <Button variant="secondary" onClick={() => setShowAdd(false)}>Cancel</Button>
                  <Button variant="primary" loading={adding} icon={<Plus size={14} />} onClick={addWell} disabled={!newWell.name.trim()}>
                    Add Well
                  </Button>
                </div>
              </CardBody>
            </Card>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Wells grid */}
      {filtered.length === 0 ? (
        <div className="text-center py-16">
          <Drill size={40} className="text-[#333333] mx-auto mb-3" />
          <p className="text-[#606060]">{search ? "No wells match your search" : "No wells yet"}</p>
          {!search && (
            <Button variant="primary" size="sm" icon={<Plus size={14} />} onClick={() => setShowAdd(true)} className="mt-4">
              Add First Well
            </Button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {filtered.map((well, i) => {
            const status = WELL_STATUS_CONFIG[well.status as keyof typeof WELL_STATUS_CONFIG] ?? WELL_STATUS_CONFIG.active;
            const primaryContact = well.contacts.find((c) => c.isPrimary) ?? well.contacts[0];

            return (
              <motion.div
                key={well.id}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.05 }}
                onClick={() => router.push(`/wells/${well.id}`)}
                whileHover={{ borderColor: "rgba(247,148,29,0.3)", y: -2 }}
                className="bg-[#1A1A1A] border border-[rgba(255,255,255,0.07)] rounded-xl p-5 cursor-pointer transition-all duration-200 group flex flex-col gap-3"
              >
                {/* Top row */}
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-2 min-w-0">
                    <div className="w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0" style={{ background: "linear-gradient(135deg, #F7941D 0%, #7B1C24 100%)" }}>
                      <Drill size={16} className="text-white" />
                    </div>
                    <span className="text-sm font-bold text-[#F0F0F0] group-hover:text-[#F7941D] transition-colors truncate">
                      {well.name}
                    </span>
                  </div>
                  <span
                    className="text-xs px-2 py-0.5 rounded-full font-medium flex-shrink-0"
                    style={{ color: status.color, backgroundColor: status.bg }}
                  >
                    {status.label}
                  </span>
                </div>

                {/* Address */}
                {well.address && (
                  <div className="flex items-start gap-1.5 text-xs text-[#606060]">
                    <MapPin size={11} className="mt-0.5 flex-shrink-0" />
                    <span className="line-clamp-2">{well.address}</span>
                  </div>
                )}

                {/* Notes preview */}
                {well.notes && (
                  <p className="text-xs text-[#606060] line-clamp-2">{well.notes}</p>
                )}

                {/* Footer */}
                <div className="flex items-center justify-between text-xs text-[#606060] pt-2 border-t border-[rgba(255,255,255,0.05)]">
                  <span className="flex items-center gap-1">
                    <Users size={10} />
                    {well.contacts.length} {well.contacts.length === 1 ? "contact" : "contacts"}
                    {primaryContact && ` · ${primaryContact.name}`}
                  </span>
                  <div className="flex items-center gap-1.5">
                    <button
                      onClick={(e) => { e.stopPropagation(); setWeeklyNotesWell(well); }}
                      className="flex items-center gap-1 px-2 py-0.5 rounded-md text-[#606060] hover:text-[#F7941D] hover:bg-[rgba(247,148,29,0.08)] transition-all"
                      title="View weekly notes history"
                    >
                      <BookOpen size={10} />
                      <span>Notes</span>
                    </button>
                    <ChevronRight size={12} className="opacity-0 group-hover:opacity-100 text-[#F7941D] transition-opacity" />
                  </div>
                </div>
              </motion.div>
            );
          })}
        </div>
      )}

      {/* Weekly Notes Modal */}
      <AnimatePresence>
        {weeklyNotesWell && (
          <WeeklyNotesHistoryModal well={weeklyNotesWell} onClose={() => setWeeklyNotesWell(null)} />
        )}
      </AnimatePresence>
    </div>
  );
}
