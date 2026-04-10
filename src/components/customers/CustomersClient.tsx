"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import {
  Building2, Plus, Search, AlertTriangle, Users,
  Globe, X, Loader2, CheckCircle, ChevronRight, Sparkles,
  BookOpen, Check, AlignLeft, Type, Square, Calendar,
} from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Input, Textarea } from "@/components/ui/Input";
import { Card, CardBody } from "@/components/ui/Card";
import { STATUS_CONFIG, TIER_CONFIG, HEALTH_CONFIG, timeAgo } from "@/lib/utils";

interface Contact {
  id: string;
  name: string;
  title: string | null;
  isPrimary: boolean;
}

interface CustomerSummary {
  id: string;
  name: string;
  logoUrl: string | null;
  website: string | null;
  status: string;
  healthScore: number;
  tier: string;
  industry: string | null;
  notes: string | null;
  updatedAt: Date;
  contacts: Contact[];
  documents: { id: string }[];
  noteItems: { id: string }[];
}

interface Props {
  customers: CustomerSummary[];
}

const HEALTH_DOTS = [1, 2, 3, 4, 5];

function HealthDots({ score }: { score: number }) {
  return (
    <div className="flex items-center gap-0.5">
      {HEALTH_DOTS.map((n) => {
        const h = HEALTH_CONFIG[n];
        return (
          <div
            key={n}
            className="w-2 h-2 rounded-full transition-all"
            style={{ backgroundColor: n <= score ? h.color : "rgba(255,255,255,0.08)" }}
          />
        );
      })}
    </div>
  );
}

function CompanyLogo({ name, logoUrl, size = 40 }: { name: string; logoUrl: string | null; size?: number }) {
  const initials = name.slice(0, 2).toUpperCase();

  if (logoUrl) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={logoUrl}
        alt={name}
        className="rounded-lg object-contain bg-[#222222]"
        style={{ width: size, height: size }}
      />
    );
  }

  return (
    <div
      className="rounded-lg flex items-center justify-center font-black text-white flex-shrink-0"
      style={{
        width: size,
        height: size,
        background: "linear-gradient(135deg, #F7941D 0%, #7B1C24 100%)",
        fontSize: size * 0.35,
      }}
    >
      {initials}
    </div>
  );
}

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
        <div
          className={`w-3.5 h-3.5 mt-0.5 rounded flex items-center justify-center border flex-shrink-0 ${item.isChecked ? "bg-[#F7941D] border-[#F7941D]" : "border-[rgba(255,255,255,0.2)]"
            }`}
        >
          {item.isChecked && <Check size={9} className="text-white" strokeWidth={3} />}
        </div>
        <span className={`text-xs leading-relaxed ${item.isChecked ? "line-through text-[#505050]" : "text-[#C0C0C0]"}`}>
          {item.content}
        </span>
      </div>
    );
  }

  // note
  return (
    <div className="flex items-start gap-2 py-0.5" style={{ paddingLeft: indentLeft }}>
      <span className="w-3.5 text-center text-[#505050] mt-0.5 flex-shrink-0 text-[8px]">•</span>
      <span className="text-xs text-[#C0C0C0] leading-relaxed">{item.content}</span>
    </div>
  );
}

function WeeklyNotesHistoryModal({
  customer,
  onClose,
}: {
  customer: CustomerSummary;
  onClose: () => void;
}) {
  const [entries, setEntries] = useState<WeeklyEntry[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(`/api/customers/${customer.id}/weekly-notes`)
      .then((r) => r.json())
      .then((data: WeeklyEntry[]) => { setEntries(data); setLoading(false); })
      .catch(() => setLoading(false));
  }, [customer.id]);

  const hasNotes = entries.some((e) => parseItems(e.items).some((i) => i.content.trim()));

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4"
      onClick={onClose}
    >
      <motion.div
        initial={{ scale: 0.95, y: 12 }}
        animate={{ scale: 1, y: 0 }}
        exit={{ scale: 0.95, y: 12 }}
        transition={{ duration: 0.2 }}
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-lg bg-[#141414] border border-[rgba(255,255,255,0.09)] rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[80vh]"
      >
        {/* Header */}
        <div className="flex items-center gap-3 px-5 py-4 border-b border-[rgba(255,255,255,0.06)] flex-shrink-0">
          <div className="w-8 h-8 rounded-lg bg-[rgba(247,148,29,0.1)] border border-[rgba(247,148,29,0.2)] flex items-center justify-center flex-shrink-0">
            <BookOpen size={14} className="text-[#F7941D]" />
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="text-sm font-bold text-[#F0F0F0] truncate">{customer.name}</h3>
            <p className="text-xs text-[#606060]">Weekly notes history</p>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-[#606060] hover:text-[#F0F0F0] hover:bg-[rgba(255,255,255,0.06)] rounded-lg transition-all flex-shrink-0"
          >
            <X size={14} />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto">
          {loading ? (
            <div className="flex items-center justify-center py-16">
              <Loader2 size={20} className="text-[#F7941D] animate-spin" />
            </div>
          ) : !hasNotes ? (
            <div className="flex flex-col items-center justify-center py-16 px-6 text-center">
              <BookOpen size={28} className="text-[#333] mb-3" />
              <p className="text-sm text-[#606060]">No weekly notes for this customer yet.</p>
              <p className="text-xs text-[#404040] mt-1">Notes added in Weekly Notes will appear here.</p>
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
                    {/* Week header */}
                    <div className="flex items-center justify-between px-4 py-2.5 border-b border-[rgba(255,255,255,0.05)]">
                      <div className="flex items-center gap-2">
                        <Calendar size={11} className="text-[#F7941D]" />
                        <span className="text-xs font-semibold text-[#C0C0C0]">
                          {formatWeekRange(entry.weeklyNote.weekStart)}
                        </span>
                      </div>
                      {todoItems.length > 0 && (
                        <span className="text-[10px] text-[#606060] bg-[rgba(255,255,255,0.05)] px-2 py-0.5 rounded-full">
                          {doneCount}/{todoItems.length} done
                        </span>
                      )}
                    </div>

                    {/* Items */}
                    <div className="px-4 py-3 space-y-0.5">
                      {items.map((item) => (
                        <ReadOnlyNoteItem key={item.id} item={item} />
                      ))}
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

export function CustomersClient({ customers }: Props) {
  const router = useRouter();
  const [search, setSearch] = useState("");
  const [showAdd, setShowAdd] = useState(false);
  const [adding, setAdding] = useState(false);
  const [addSuccess, setAddSuccess] = useState(false);
  const [localCustomers, setLocalCustomers] = useState(customers);
  const [weeklyNotesCustomer, setWeeklyNotesCustomer] = useState<CustomerSummary | null>(null);
  const [newCustomer, setNewCustomer] = useState({
    name: "", website: "", industry: "", tier: "standard", status: "active", healthScore: 3, notes: "",
  });

  const filtered = localCustomers.filter(
    (c) =>
      c.name.toLowerCase().includes(search.toLowerCase()) ||
      c.industry?.toLowerCase().includes(search.toLowerCase()) ||
      c.website?.toLowerCase().includes(search.toLowerCase())
  );

  const atRisk = localCustomers.filter((c) => c.status === "at-risk").length;

  async function addCustomer() {
    if (!newCustomer.name.trim()) return;
    setAdding(true);
    try {
      const res = await fetch("/api/customers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(newCustomer),
      });
      const data = await res.json();
      setLocalCustomers((prev) => [{ ...data.customer, contacts: [], documents: [], noteItems: [] }, ...prev]);
      setNewCustomer({ name: "", website: "", industry: "", tier: "standard", status: "active", healthScore: 3, notes: "" });
      setAddSuccess(true);
      setTimeout(() => { setAddSuccess(false); setShowAdd(false); }, 1200);
    } catch {
      console.error("Failed to add customer");
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
            <Building2 size={22} className="text-[#F7941D]" />
            Customers
          </h1>
          <p className="text-sm text-[#606060] mt-0.5">
            {localCustomers.length} {localCustomers.length === 1 ? "account" : "accounts"}
          </p>
        </div>
        <Button
          variant={showAdd ? "secondary" : "primary"}
          size="sm"
          icon={showAdd ? <X size={14} /> : <Plus size={14} />}
          onClick={() => setShowAdd((v) => !v)}
        >
          {showAdd ? "Cancel" : "Add Customer"}
        </Button>
      </div>

      {/* At-risk alert */}
      {atRisk > 0 && (
        <motion.div
          initial={{ opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex items-center gap-3 p-4 bg-[rgba(249,115,22,0.08)] border border-[rgba(249,115,22,0.2)] rounded-xl"
        >
          <AlertTriangle size={16} className="text-[#F97316] flex-shrink-0" />
          <p className="text-sm text-[#F0F0F0]">
            <span className="text-[#F97316] font-semibold">{atRisk} {atRisk === 1 ? "account" : "accounts"} at risk</span>
            {" "}— review and update their health scores
          </p>
        </motion.div>
      )}

      {/* Add customer form */}
      <AnimatePresence>
        {showAdd && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            className="overflow-hidden"
          >
            <Card>
              <CardBody className="space-y-4">
                <h3 className="text-sm font-bold text-[#F0F0F0]">New Customer Account</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <Input
                    label="Company Name *"
                    placeholder="Hanor, Oracle, Martin..."
                    value={newCustomer.name}
                    onChange={(e) => setNewCustomer({ ...newCustomer, name: e.target.value })}
                  />
                  <Input
                    label="Website"
                    placeholder="https://example.com"
                    value={newCustomer.website}
                    onChange={(e) => setNewCustomer({ ...newCustomer, website: e.target.value })}
                  />
                  <Input
                    label="Industry"
                    placeholder="Agriculture, Technology..."
                    value={newCustomer.industry}
                    onChange={(e) => setNewCustomer({ ...newCustomer, industry: e.target.value })}
                  />
                  <div className="grid grid-cols-2 gap-3">
                    <div className="flex flex-col gap-1.5">
                      <label className="text-xs font-medium text-[#9A9A9A] uppercase tracking-wider">Tier</label>
                      <select
                        value={newCustomer.tier}
                        onChange={(e) => setNewCustomer({ ...newCustomer, tier: e.target.value })}
                        className="w-full bg-[#222222] border border-[rgba(255,255,255,0.08)] rounded-lg px-3 py-2 text-sm text-[#F0F0F0] focus:outline-none focus:border-[#F7941D]"
                      >
                        <option value="enterprise">Enterprise</option>
                        <option value="standard">Standard</option>
                        <option value="startup">Startup</option>
                      </select>
                    </div>
                    <div className="flex flex-col gap-1.5">
                      <label className="text-xs font-medium text-[#9A9A9A] uppercase tracking-wider">Status</label>
                      <select
                        value={newCustomer.status}
                        onChange={(e) => setNewCustomer({ ...newCustomer, status: e.target.value })}
                        className="w-full bg-[#222222] border border-[rgba(255,255,255,0.08)] rounded-lg px-3 py-2 text-sm text-[#F0F0F0] focus:outline-none focus:border-[#F7941D]"
                      >
                        <option value="active">Active</option>
                        <option value="at-risk">At Risk</option>
                        <option value="inactive">Inactive</option>
                      </select>
                    </div>
                  </div>
                  <div className="md:col-span-2 flex flex-col gap-1.5">
                    <label className="text-xs font-medium text-[#9A9A9A] uppercase tracking-wider">
                      Health Score — {HEALTH_CONFIG[newCustomer.healthScore]?.label}
                    </label>
                    <div className="flex items-center gap-2">
                      {HEALTH_DOTS.map((n) => {
                        const h = HEALTH_CONFIG[n];
                        return (
                          <button
                            key={n}
                            onClick={() => setNewCustomer({ ...newCustomer, healthScore: n })}
                            className="flex flex-col items-center gap-1 group"
                          >
                            <div
                              className="w-5 h-5 rounded-full border-2 transition-all"
                              style={{
                                backgroundColor: n <= newCustomer.healthScore ? h.color : "transparent",
                                borderColor: n <= newCustomer.healthScore ? h.color : "rgba(255,255,255,0.15)",
                              }}
                            />
                            <span className="text-xs text-[#606060] group-hover:text-[#9A9A9A]">{n}</span>
                          </button>
                        );
                      })}
                      <span className="text-sm text-[#9A9A9A] ml-2">{HEALTH_CONFIG[newCustomer.healthScore]?.label}</span>
                    </div>
                  </div>
                  <div className="md:col-span-2">
                    <Textarea
                      label="Notes"
                      placeholder="Any context about this account..."
                      value={newCustomer.notes}
                      onChange={(e) => setNewCustomer({ ...newCustomer, notes: e.target.value })}
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
                  <Button
                    variant="primary"
                    loading={adding}
                    icon={<Plus size={14} />}
                    onClick={addCustomer}
                    disabled={!newCustomer.name.trim()}
                  >
                    Add Customer
                  </Button>
                </div>
              </CardBody>
            </Card>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Stats row
      <div className="grid grid-cols-3 gap-4">
        {[
          { label: "Active", value: localCustomers.filter((c) => c.status === "active").length, color: "#22C55E", bg: "rgba(34,197,94,0.1)" },
          { label: "At Risk", value: atRisk, color: "#F97316", bg: "rgba(249,115,22,0.1)" },
          { label: "Inactive", value: localCustomers.filter((c) => c.status === "inactive").length, color: "#606060", bg: "rgba(96,96,96,0.1)" },
        ].map((stat) => (
          <div key={stat.label} className="bg-[#1A1A1A] border border-[rgba(255,255,255,0.07)] rounded-xl p-4">
            <div className="text-2xl font-black text-[#F0F0F0]">{stat.value}</div>
            <div className="flex items-center gap-2 mt-1">
              <div className="w-2 h-2 rounded-full" style={{ backgroundColor: stat.color }} />
              <span className="text-xs text-[#9A9A9A]">{stat.label}</span>
            </div>
          </div>
        ))}
      </div> */}



      {/* Customer grid */}
      {filtered.length === 0 ? (
        <div className="text-center py-16">
          <Building2 size={40} className="text-[#333333] mx-auto mb-3" />
          <p className="text-[#606060]">{search ? "No customers match your search" : "No customers yet"}</p>
          {!search && (
            <Button variant="primary" size="sm" icon={<Plus size={14} />} onClick={() => setShowAdd(true)} className="mt-4">
              Add First Customer
            </Button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {filtered.map((customer, i) => {
            const status = STATUS_CONFIG[customer.status as keyof typeof STATUS_CONFIG] ?? STATUS_CONFIG.active;
            const tier = TIER_CONFIG[customer.tier as keyof typeof TIER_CONFIG] ?? TIER_CONFIG.standard;
            const primaryContact = customer.contacts.find((c) => c.isPrimary) ?? customer.contacts[0];

            return (
              <motion.div
                key={customer.id}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.05 }}
                onClick={() => router.push(`/customers/${customer.id}`)}
                whileHover={{ borderColor: "rgba(247,148,29,0.3)", y: -2 }}
                className="bg-[#1A1A1A] border border-[rgba(255,255,255,0.07)] rounded-xl p-5 cursor-pointer transition-all duration-200 group flex flex-col gap-4"
              >
                {/* Top row: logo + name + status */}
                <div className="flex items-start gap-3">
                  <CompanyLogo name={customer.name} logoUrl={customer.logoUrl} size={44} />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-sm font-bold text-[#F0F0F0] group-hover:text-[#F7941D] transition-colors truncate">
                        {customer.name}
                      </span>
                      <span
                        className="text-xs px-2 py-0.5 rounded-full font-medium ml-auto flex-shrink-0"
                        style={{ color: status.color, backgroundColor: status.bg }}
                      >
                        {status.label}
                      </span>
                    </div>
                    <div className="flex items-center gap-2 mt-1 flex-wrap">
                      <span
                        className="text-xs px-2 py-0.5 rounded-full font-medium"
                        style={{ color: tier.color, backgroundColor: tier.bg }}
                      >
                        {tier.label}
                      </span>
                      {customer.industry && (
                        <span className="text-xs text-[#606060]">{customer.industry}</span>
                      )}
                    </div>
                  </div>
                </div>

                {/* Health score */}
                <div className="flex items-center justify-between">
                  <div className="flex flex-col gap-1">
                    <span className="text-xs text-[#606060]">Health</span>
                    <HealthDots score={customer.healthScore} />
                  </div>
                  {customer.website && (
                    <a
                      href={customer.website}
                      target="_blank"
                      rel="noopener noreferrer"
                      onClick={(e) => e.stopPropagation()}
                      className="text-xs text-[#606060] hover:text-[#F7941D] flex items-center gap-1 transition-colors"
                    >
                      <Globe size={11} />
                      {customer.website.replace(/^https?:\/\//, "").replace(/\/$/, "")}
                    </a>
                  )}
                </div>

                {/* Footer */}
                <div className="flex items-center justify-between text-xs text-[#606060] pt-2 border-t border-[rgba(255,255,255,0.05)]">
                  <div className="flex items-center gap-3">
                    <span className="flex items-center gap-1">
                      <Users size={10} />
                      {customer.contacts.length} {customer.contacts.length === 1 ? "contact" : "contacts"}
                      {primaryContact && ` · ${primaryContact.name}`}
                    </span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <button
                      onClick={(e) => { e.stopPropagation(); setWeeklyNotesCustomer(customer); }}
                      className="flex items-center gap-1 px-2 py-0.5 rounded-md text-[#606060] hover:text-[#F7941D] hover:bg-[rgba(247,148,29,0.08)] transition-all"
                      title="View weekly notes history"
                    >
                      <BookOpen size={10} />
                      <span>Weekly Notes</span>
                    </button>
                    <ChevronRight size={12} className="opacity-0 group-hover:opacity-100 text-[#F7941D] transition-opacity" />
                  </div>
                </div>

                {/* Notes preview */}
                {customer.notes && (
                  <p className="text-xs text-[#606060] line-clamp-2 -mt-2">{customer.notes}</p>
                )}
              </motion.div>
            );
          })}
        </div>
      )}

      {/* Weekly Notes History Modal */}
      <AnimatePresence>
        {weeklyNotesCustomer && (
          <WeeklyNotesHistoryModal
            customer={weeklyNotesCustomer}
            onClose={() => setWeeklyNotesCustomer(null)}
          />
        )}
      </AnimatePresence>


    </div>
  );
}
