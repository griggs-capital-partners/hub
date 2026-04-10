"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  BookOpen,
  Plus,
  Trash2,
  Check,
  Calendar,
  Users,
  FileText,
  X,
  ChevronDown,
  Type,
  CheckSquare,
  Minus,
  ArrowUp,
  ArrowDown,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { HEALTH_CONFIG, TIER_CONFIG } from "@/lib/utils";

// ─── Types ────────────────────────────────────────────────────────────────────

type ItemType = "header" | "todo" | "note";

interface NoteItem {
  id: string;
  type: ItemType;
  content: string;
  isChecked: boolean;
  indent: number; // 0 | 1 | 2  (headers always 0)
}

interface CustomerSnap {
  id: string;
  name: string;
  logoUrl: string | null;
  healthScore: number;
  tier: string;
  status: string;
}

interface WeeklyNoteEntry {
  id: string;
  weeklyNoteId: string;
  customerId: string | null;
  customerName: string;
  customer: CustomerSnap | null;
  order: number;
  items: string; // JSON
  createdAt: string;
  updatedAt: string;
}

interface WeeklyNote {
  id: string;
  weekStart: string;
  createdAt: string;
  updatedAt: string;
  entries: WeeklyNoteEntry[];
}

interface Props {
  initialNotes: WeeklyNote[];
  customers: CustomerSnap[];
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function genId() {
  return Math.random().toString(36).slice(2, 10);
}

function getMondayOf(date: Date): Date {
  const d = new Date(date);
  const day = d.getUTCDay();
  const diff = day === 0 ? -6 : 1 - day;
  d.setUTCDate(d.getUTCDate() + diff);
  d.setUTCHours(0, 0, 0, 0);
  return d;
}

function formatWeekRange(weekStart: string): { short: string; year: string; full: string } {
  const start = new Date(weekStart);
  const end = new Date(start);
  end.setUTCDate(end.getUTCDate() + 6);

  const startMonth = start.toLocaleDateString("en-US", { month: "short", timeZone: "UTC" });
  const startDay = start.toLocaleDateString("en-US", { day: "numeric", timeZone: "UTC" });
  const endMonth = end.toLocaleDateString("en-US", { month: "short", timeZone: "UTC" });
  const endDay = end.toLocaleDateString("en-US", { day: "numeric", timeZone: "UTC" });
  const year = end.toLocaleDateString("en-US", { year: "numeric", timeZone: "UTC" });

  const isSameMonth = startMonth === endMonth;
  const short = isSameMonth
    ? `${startMonth} ${startDay}–${endDay}`
    : `${startMonth} ${startDay} – ${endMonth} ${endDay}`;
  return { short, year, full: `${short}, ${year}` };
}

function isCurrentWeek(weekStart: string): boolean {
  const monday = getMondayOf(new Date());
  return new Date(weekStart).toISOString().slice(0, 10) === monday.toISOString().slice(0, 10);
}

function parseItems(raw: string): NoteItem[] {
  try {
    const parsed = JSON.parse(raw);
    // Backfill `type` for items saved before type support
    return parsed.map((item: NoteItem) => {
      const { type, ...rest } = item;
      return {
        type: type || ("note" as ItemType),
        ...rest,
      } as NoteItem;
    });
  } catch {
    return [];
  }
}

function countItems(entries: WeeklyNoteEntry[]): number {
  return entries.reduce(
    (sum, e) => sum + parseItems(e.items).filter((i) => i.content.trim() && i.type !== "header").length,
    0
  );
}

// ─── Health dot ──────────────────────────────────────────────────────────────

function HealthDot({ score }: { score: number }) {
  const cfg = HEALTH_CONFIG[score as keyof typeof HEALTH_CONFIG] ?? HEALTH_CONFIG[3];
  return (
    <span
      className="w-2 h-2 rounded-full flex-shrink-0"
      style={{ backgroundColor: cfg.color }}
      title={cfg.label}
    />
  );
}

// ─── Customer logo / avatar ───────────────────────────────────────────────────

function CustomerAvatar({
  customer,
  name,
  size = 28,
}: {
  customer: CustomerSnap | null;
  name: string;
  size?: number;
}) {
  const initials = name
    .split(" ")
    .map((w) => w[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  if (customer?.logoUrl) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={customer.logoUrl}
        alt={name}
        style={{ width: size, height: size }}
        className="rounded-md object-contain bg-[#222] flex-shrink-0"
      />
    );
  }

  return (
    <div
      style={{ width: size, height: size, fontSize: size * 0.35 }}
      className="rounded-md bg-gradient-to-br from-[#F7941D] to-[#7B1C24] flex items-center justify-center text-white font-bold flex-shrink-0"
    >
      {initials}
    </div>
  );
}


// ─── NoteRow ──────────────────────────────────────────────────────────────────

interface NoteRowProps {
  item: NoteItem;
  index: number;
  total: number;
  onUpdate: (id: string, patch: Partial<NoteItem>) => void;
  onDelete: (id: string) => void;
  onEnter: (id: string, type: ItemType, indent: number) => void;
  onTab: (id: string, shift: boolean) => void;
  onArrow: (id: string, dir: "up" | "down") => void;
  inputRef: (el: HTMLTextAreaElement | null, id: string) => void;
}

function NoteRow({ item, onUpdate, onDelete, onEnter, onTab, onArrow, inputRef }: NoteRowProps) {
  const isHeader = item.type === "header";
  const isTodo = item.type === "todo";
  const indentLeft = isHeader ? 0 : item.indent === 0 ? 0 : item.indent === 1 ? 20 : 40;

  // Enter creates same type (header → note, todo → todo, note → note)
  const nextType: ItemType = isHeader ? "note" : item.type;

  function handleChange(e: React.ChangeEvent<HTMLTextAreaElement>) {
    const val = e.target.value;
    // Markdown-style shortcuts for type conversion
    if (!isHeader && val.startsWith("# ")) {
      onUpdate(item.id, { type: "header", content: val.slice(2), indent: 0 });
      return;
    }
    if (item.type === "note" && (val.startsWith("[] ") || val.startsWith("[ ] "))) {
      const prefix = val.startsWith("[ ] ") ? 4 : 3;
      onUpdate(item.id, { type: "todo", content: val.slice(prefix) });
      return;
    }
    onUpdate(item.id, { content: val });
  }

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: -4 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, height: 0 }}
      transition={{ duration: 0.15 }}
      className={cn(
        "group relative flex items-start gap-2 py-0.5",
        isHeader && "mt-3 mb-0.5"
      )}
      style={{ paddingLeft: indentLeft }}
    >
      {/* ── Header stripe ── */}
      {isHeader && (
        <div className="absolute left-0 right-0 -inset-y-0.5 bg-[rgba(247,148,29,0.04)] rounded-lg pointer-events-none" />
      )}

      {/* ── Bullet / Checkbox ── */}
      <div className="flex-shrink-0 mt-[3px] w-4 h-4 flex items-center justify-center">
        {isTodo ? (
          <button
            onClick={() => onUpdate(item.id, { isChecked: !item.isChecked })}
            className={cn(
              "w-4 h-4 rounded flex items-center justify-center border transition-all",
              item.isChecked
                ? "bg-[#F7941D] border-[#F7941D]"
                : "border-[rgba(255,255,255,0.2)] hover:border-[#F7941D]"
            )}
          >
            {item.isChecked && <Check size={10} className="text-white" strokeWidth={3} />}
          </button>
        ) : isHeader ? null : (
          <span className="w-1.5 h-1.5 rounded-full bg-[#404040] flex-shrink-0" />
        )}
      </div>

      {/* ── Content textarea (auto-resizes) ── */}
      <textarea
        ref={(el) => inputRef(el, item.id)}
        value={item.content}
        rows={1}
        onChange={(e) => {
          e.target.style.height = "auto";
          e.target.style.height = e.target.scrollHeight + "px";
          handleChange(e);
        }}
        onKeyDown={(e) => {
          if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); onEnter(item.id, nextType, isHeader ? 0 : item.indent); }
          if (e.key === "Tab" && !isHeader) { e.preventDefault(); onTab(item.id, e.shiftKey); }
          if (e.key === "Backspace" && item.content === "") { e.preventDefault(); onDelete(item.id); }
          if (e.key === "ArrowUp") { e.preventDefault(); onArrow(item.id, "up"); }
          if (e.key === "ArrowDown") { e.preventDefault(); onArrow(item.id, "down"); }
        }}
        placeholder={isHeader ? "Section heading…" : isTodo ? "Action item…" : "Note…"}
        style={{ resize: "none", overflow: "hidden" }}
        className={cn(
          "flex-1 bg-transparent border-none outline-none leading-relaxed placeholder-[#383838] min-w-0 transition-all",
          isHeader
            ? "text-sm font-bold text-[#F0F0F0] tracking-wide"
            : isTodo && item.isChecked
              ? "text-sm line-through text-[#505050]"
              : "text-sm text-[#D8D8D8]"
        )}
      />

      {/* ── Type switcher + Delete ── */}
      <div className="opacity-0 group-hover:opacity-100 flex items-center gap-0.5 flex-shrink-0 mt-0.5 transition-opacity">
        <button
          onClick={() => onUpdate(item.id, { type: "header", indent: 0 })}
          title="Header"
          className={cn(
            "p-0.5 rounded transition-colors",
            isHeader ? "text-[#F7941D]" : "text-[#505050] hover:text-[#C0C0C0]"
          )}
        >
          <Type size={11} />
        </button>
        <button
          onClick={() => onUpdate(item.id, { type: "todo", isChecked: false })}
          title="To-do"
          className={cn(
            "p-0.5 rounded transition-colors",
            isTodo ? "text-[#F7941D]" : "text-[#505050] hover:text-[#C0C0C0]"
          )}
        >
          <CheckSquare size={11} />
        </button>
        <button
          onClick={() => onUpdate(item.id, { type: "note" })}
          title="Note"
          className={cn(
            "p-0.5 rounded transition-colors",
            !isHeader && !isTodo ? "text-[#F7941D]" : "text-[#505050] hover:text-[#C0C0C0]"
          )}
        >
          <Minus size={11} />
        </button>
        <span className="w-px h-3 bg-[#333] mx-0.5" />
        <button
          onClick={() => onDelete(item.id)}
          className="p-0.5 text-[#505050] hover:text-[#EF4444] transition-colors"
        >
          <X size={11} />
        </button>
      </div>
    </motion.div>
  );
}


// ─── CustomerSection ──────────────────────────────────────────────────────────

interface CustomerSectionProps {
  entry: WeeklyNoteEntry & { localItems: NoteItem[] };
  customers: CustomerSnap[];
  onItemsChange: (entryId: string, items: NoteItem[]) => void;
  onRemoveEntry: (entryId: string) => void;
  saving: boolean;
  canMoveUp: boolean;
  canMoveDown: boolean;
  onMoveUp: () => void;
  onMoveDown: () => void;
}

function CustomerSection({ entry, customers, onItemsChange, onRemoveEntry, saving, canMoveUp, canMoveDown, onMoveUp, onMoveDown }: CustomerSectionProps) {
  const [collapsed, setCollapsed] = useState(false);
  const inputRefs = useRef<Map<string, HTMLTextAreaElement>>(new Map());

  const refCallback = useCallback((el: HTMLTextAreaElement | null, id: string) => {
    if (el) inputRefs.current.set(id, el);
    else inputRefs.current.delete(id);
  }, []);

  const focusItem = useCallback((id: string) => {
    setTimeout(() => inputRefs.current.get(id)?.focus(), 30);
  }, []);

  const items = entry.localItems;
  const customer = entry.customer ?? customers.find((c) => c.id === entry.customerId) ?? null;
  const tierCfg = TIER_CONFIG[(customer?.tier ?? "standard") as keyof typeof TIER_CONFIG];
  const todoItems = items.filter((i) => i.type === "todo" && i.content.trim());
  const checkedCount = todoItems.filter((i) => i.isChecked).length;
  const healthScore = customer?.healthScore ?? 3;

  function updateItem(id: string, patch: Partial<NoteItem>) {
    onItemsChange(entry.id, items.map((i) => (i.id === id ? { ...i, ...patch } : i)));
  }

  function deleteItem(id: string) {
    const idx = items.findIndex((i) => i.id === id);
    const updated = items.filter((i) => i.id !== id);
    onItemsChange(entry.id, updated);
    const targetIdx = Math.max(0, idx - 1);
    if (updated[targetIdx]) focusItem(updated[targetIdx].id);
  }

  function addItemAfter(afterId: string, type: ItemType, indent: number) {
    const idx = items.findIndex((i) => i.id === afterId);
    const newItem: NoteItem = { id: genId(), type, content: "", isChecked: false, indent };
    const updated = [...items.slice(0, idx + 1), newItem, ...items.slice(idx + 1)];
    onItemsChange(entry.id, updated);
    focusItem(newItem.id);
  }

  function addItemAtEnd(type: ItemType) {
    const newItem: NoteItem = { id: genId(), type, content: "", isChecked: false, indent: 0 };
    onItemsChange(entry.id, [...items, newItem]);
    focusItem(newItem.id);
  }

  function handleTab(id: string, shift: boolean) {
    const idx = items.findIndex((i) => i.id === id);
    if (idx < 0) return;
    const current = items[idx];
    if (current.type === "header") return;
    let newIndent = current.indent;
    if (shift) {
      newIndent = Math.max(0, newIndent - 1);
    } else {
      const prev = items[idx - 1];
      if (!prev) return;
      const prevMaxIndent = prev.type === "header" ? 0 : prev.indent;
      newIndent = Math.min(2, Math.min(newIndent + 1, prevMaxIndent + 1));
    }
    updateItem(id, { indent: newIndent });
  }

  function handleArrow(id: string, dir: "up" | "down") {
    const idx = items.findIndex((i) => i.id === id);
    const target = dir === "up" ? items[idx - 1] : items[idx + 1];
    if (target) focusItem(target.id);
  }

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, height: 0 }}
      className="rounded-xl border border-[rgba(255,255,255,0.07)] bg-[#141414]"
    >
      {/* Header */}
      <div className="flex items-center gap-2 px-3 py-2.5 border-b border-[rgba(255,255,255,0.05)]">
        <div className="flex gap-0.5 flex-shrink-0">
          <button
            onClick={onMoveUp}
            disabled={!canMoveUp}
            className="w-5 h-5 rounded flex items-center justify-center text-[#505050] hover:text-[#F0F0F0] hover:bg-[rgba(255,255,255,0.08)] disabled:opacity-20 disabled:cursor-default transition-all"
          >
            <ArrowUp size={11} strokeWidth={2} />
          </button>
          <button
            onClick={onMoveDown}
            disabled={!canMoveDown}
            className="w-5 h-5 rounded flex items-center justify-center text-[#505050] hover:text-[#F0F0F0] hover:bg-[rgba(255,255,255,0.08)] disabled:opacity-20 disabled:cursor-default transition-all"
          >
            <ArrowDown size={11} strokeWidth={2} />
          </button>
        </div>

        <button
          onClick={() => setCollapsed((c) => !c)}
          className="text-[#505050] hover:text-[#F7941D] transition-colors flex-shrink-0"
        >
          <motion.div animate={{ rotate: collapsed ? -90 : 0 }} transition={{ duration: 0.2 }}>
            <ChevronDown size={14} />
          </motion.div>
        </button>

        <CustomerAvatar customer={customer} name={entry.customerName} size={22} />

        <span className="text-sm font-semibold text-[#F0F0F0]">{entry.customerName}</span>

        {customer && <HealthDot score={healthScore} />}

        {customer && tierCfg && (
          <span
            className="text-[10px] px-1.5 py-0.5 rounded-full font-medium"
            style={{ color: tierCfg.color, background: tierCfg.bg }}
          >
            {tierCfg.label}
          </span>
        )}

        {todoItems.length > 0 && (
          <span className="text-[11px] text-[#505050]">
            {checkedCount}/{todoItems.length} done
          </span>
        )}

        <div className="flex-1" />

        {saving && <span className="text-[10px] text-[#505050]">saving…</span>}

        <button
          onClick={() => onRemoveEntry(entry.id)}
          className="p-1 text-[#404040] hover:text-[#EF4444] transition-colors flex-shrink-0"
          title="Remove customer section"
        >
          <Trash2 size={12} />
        </button>
      </div>

      {/* Items */}
      <AnimatePresence>
        {!collapsed && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            style={{ overflow: "hidden" }}
          >
            <div className="px-4 py-3 space-y-1 relative">
              <AnimatePresence>
                {items.map((item, idx) => (
                  <NoteRow
                    key={item.id}
                    item={item}
                    index={idx}
                    total={items.length}
                    onUpdate={updateItem}
                    onDelete={deleteItem}
                    onEnter={addItemAfter}
                    onTab={handleTab}
                    onArrow={handleArrow}
                    inputRef={refCallback}
                  />
                ))}
              </AnimatePresence>

              {items.length === 0 && (
                <p className="text-xs text-[#404040] italic py-1">No notes yet — add one below</p>
              )}
            </div>

            <div className="px-4 pb-3">
              <button
                onClick={() => addItemAtEnd("note")}
                className="flex items-center gap-1.5 text-xs text-[#505050] hover:text-[#F7941D] transition-colors group"
              >
                <Plus size={12} className="group-hover:scale-110 transition-transform" />
                Add note
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

// ─── Add Customer Modal ───────────────────────────────────────────────────────

interface AddCustomerModalProps {
  customers: CustomerSnap[];
  existingIds: (string | null)[];
  onAdd: (customer: CustomerSnap | null, name: string) => void;
  onClose: () => void;
}

function AddCustomerModal({ customers, existingIds, onAdd, onClose }: AddCustomerModalProps) {
  const [search, setSearch] = useState("");
  const [customName, setCustomName] = useState("");

  const available = customers.filter(
    (c) => !existingIds.includes(c.id) && c.name.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4"
      onClick={onClose}
    >
      <motion.div
        initial={{ scale: 0.95, y: 10 }}
        animate={{ scale: 1, y: 0 }}
        exit={{ scale: 0.95, y: 10 }}
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-sm bg-[#1A1A1A] border border-[rgba(255,255,255,0.1)] rounded-2xl shadow-2xl overflow-hidden"
      >
        <div className="p-4 border-b border-[rgba(255,255,255,0.06)]">
          <h3 className="text-sm font-semibold text-[#F0F0F0] mb-3">Add Customer Section</h3>
          <input
            autoFocus
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search customers…"
            className="w-full bg-[#0D0D0D] border border-[rgba(255,255,255,0.08)] rounded-lg px-3 py-2 text-sm text-[#F0F0F0] placeholder-[#404040] outline-none focus:border-[#F7941D] transition-colors"
          />
        </div>

        <div className="max-h-60 overflow-y-auto">
          {available.length > 0 ? (
            available.map((c) => (
              <button
                key={c.id}
                onClick={() => onAdd(c, c.name)}
                className="w-full flex items-center gap-3 px-4 py-2.5 hover:bg-[rgba(255,255,255,0.04)] transition-colors text-left"
              >
                <CustomerAvatar customer={c} name={c.name} size={24} />
                <div className="flex-1 min-w-0">
                  <div className="text-sm text-[#F0F0F0] truncate">{c.name}</div>
                </div>
                <HealthDot score={c.healthScore} />
              </button>
            ))
          ) : (
            <div className="px-4 py-6 text-center text-xs text-[#505050]">
              {search ? "No matching customers" : "All customers already added"}
            </div>
          )}
        </div>

        <div className="p-4 border-t border-[rgba(255,255,255,0.06)]">
          <p className="text-xs text-[#606060] mb-2">Or add a custom section:</p>
          <div className="flex gap-2">
            <input
              value={customName}
              onChange={(e) => setCustomName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && customName.trim()) onAdd(null, customName.trim());
              }}
              placeholder="Section name…"
              className="flex-1 bg-[#0D0D0D] border border-[rgba(255,255,255,0.08)] rounded-lg px-3 py-2 text-sm text-[#F0F0F0] placeholder-[#404040] outline-none focus:border-[#F7941D] transition-colors"
            />
            <button
              onClick={() => { if (customName.trim()) onAdd(null, customName.trim()); }}
              disabled={!customName.trim()}
              className="px-3 py-2 bg-[#F7941D] text-white rounded-lg text-sm font-medium disabled:opacity-40 hover:bg-[#e8851a] transition-colors"
            >
              Add
            </button>
          </div>
        </div>
      </motion.div>
    </motion.div>
  );
}

// ─── WeeklyNotesClient (main) ────────────────────────────────────────────────

export function WeeklyNotesClient({ initialNotes, customers }: Props) {
  const [notes, setNotes] = useState<WeeklyNote[]>(initialNotes);
  const [selectedId, setSelectedId] = useState<string | null>(() => {
    if (initialNotes.length === 0) return null;
    const thisWeek = getMondayOf(new Date()).toISOString().slice(0, 10);
    const match = initialNotes.find((n) => n.weekStart.slice(0, 10) === thisWeek);
    return match?.id ?? initialNotes[0]?.id ?? null;
  });

  const [localItems, setLocalItems] = useState<Record<string, NoteItem[]>>({});
  const [savingIds, setSavingIds] = useState<Set<string>>(new Set());
  const [showAddCustomer, setShowAddCustomer] = useState(false);
  const [creatingWeek, setCreatingWeek] = useState(false);
  const saveTimers = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());


  const selectedNote = notes.find((n) => n.id === selectedId) ?? null;

  const effectiveEntries = (selectedNote?.entries ?? []).map((e) => ({
    ...e,
    localItems: localItems[e.id] ?? parseItems(e.items),
  }));

  // ── Debounced save ────────────────────────────────────────────────────────

  const scheduleSave = useCallback((entryId: string, noteId: string, items: NoteItem[]) => {
    const existing = saveTimers.current.get(entryId);
    if (existing) clearTimeout(existing);
    const timer = setTimeout(async () => {
      setSavingIds((s) => new Set(s).add(entryId));
      try {
        await fetch(`/api/weekly-notes/${noteId}/entries/${entryId}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ items }),
        });
      } finally {
        setSavingIds((s) => { const next = new Set(s); next.delete(entryId); return next; });
      }
    }, 800);
    saveTimers.current.set(entryId, timer);
  }, []);

  // ── Item changes ──────────────────────────────────────────────────────────

  function handleItemsChange(entryId: string, items: NoteItem[]) {
    setLocalItems((prev) => ({ ...prev, [entryId]: items }));
    if (selectedNote) scheduleSave(entryId, selectedNote.id, items);
  }

  // ── Add customer entry ────────────────────────────────────────────────────

  async function handleAddCustomer(customer: CustomerSnap | null, name: string) {
    setShowAddCustomer(false);
    if (!selectedNote) return;
    const maxOrder = Math.max(0, ...selectedNote.entries.map((e) => e.order));
    const res = await fetch(`/api/weekly-notes/${selectedNote.id}/entries`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ customerId: customer?.id ?? null, customerName: name, order: maxOrder + 1 }),
    });
    if (!res.ok) return;
    const entry: WeeklyNoteEntry = await res.json();
    setNotes((prev) =>
      prev.map((n) => (n.id === selectedNote.id ? { ...n, entries: [...n.entries, entry] } : n))
    );
  }

  // ── Remove entry ──────────────────────────────────────────────────────────

  async function handleRemoveEntry(entryId: string) {
    if (!selectedNote) return;
    await fetch(`/api/weekly-notes/${selectedNote.id}/entries/${entryId}`, { method: "DELETE" });
    setNotes((prev) =>
      prev.map((n) =>
        n.id === selectedNote.id ? { ...n, entries: n.entries.filter((e) => e.id !== entryId) } : n
      )
    );
    setLocalItems((prev) => { const next = { ...prev }; delete next[entryId]; return next; });
  }

  // ── Move entry up or down ─────────────────────────────────────────────────

  function handleMoveEntry(entryId: string, dir: "up" | "down") {
    if (!selectedNote) return;
    const idx = effectiveEntries.findIndex((e) => e.id === entryId);
    const swapIdx = dir === "up" ? idx - 1 : idx + 1;
    if (swapIdx < 0 || swapIdx >= effectiveEntries.length) return;

    const reordered = [...effectiveEntries];
    [reordered[idx], reordered[swapIdx]] = [reordered[swapIdx], reordered[idx]];

    setNotes((prev) =>
      prev.map((n) =>
        n.id === selectedNote.id
          ? { ...n, entries: reordered.map((e, i) => ({ ...e, order: i })) }
          : n
      )
    );

    reordered.forEach((entry, i) => {
      fetch(`/api/weekly-notes/${selectedNote.id}/entries/${entry.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ order: i }),
      });
    });
  }

  // ── Create new week (with carry-forward) ──────────────────────────────────

  async function handleCreateWeek() {
    setCreatingWeek(true);
    try {
      // Find the most recent existing week to carry forward from
      const sorted = [...notes].sort((a, b) => (a.weekStart > b.weekStart ? -1 : 1));
      const sourceNote = sorted[0] ?? null;

      // Find the next Monday not yet in the list (prefer current week, then go forward)
      const existingStarts = new Set(notes.map((n) => n.weekStart.slice(0, 10)));
      let candidate = getMondayOf(new Date());
      // If current week already exists, advance forward week by week
      while (existingStarts.has(candidate.toISOString().slice(0, 10))) {
        candidate = new Date(candidate);
        candidate.setUTCDate(candidate.getUTCDate() + 7);
      }

      // Create the week
      const res = await fetch("/api/weekly-notes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ weekStart: candidate.toISOString() }),
      });
      if (!res.ok) return;
      const newNote: WeeklyNote = await res.json();

      // Carry forward entries from the most recent week
      if (sourceNote && sourceNote.entries.length > 0) {
        // Create entries in parallel
        const createdEntries = await Promise.all(
          sourceNote.entries.map((entry) =>
            fetch(`/api/weekly-notes/${newNote.id}/entries`, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                customerId: entry.customerId,
                customerName: entry.customerName,
                order: entry.order,
              }),
            }).then((r) => r.json() as Promise<WeeklyNoteEntry>)
          )
        );

        // Copy items, resetting all todo checkboxes
        const updatedEntries = await Promise.all(
          sourceNote.entries.map((prevEntry, i) => {
            const prevItems = parseItems(prevEntry.items);
            const newItems = prevItems.map((item) => ({
              ...item,
              id: genId(), // fresh IDs
              isChecked: item.isChecked,
            }));
            return fetch(`/api/weekly-notes/${newNote.id}/entries/${createdEntries[i].id}`, {
              method: "PUT",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ items: newItems }),
            }).then((r) => r.json() as Promise<WeeklyNoteEntry>);
          })
        );

        const fullNote = { ...newNote, entries: updatedEntries };
        setNotes((prev) => [fullNote, ...prev].sort((a, b) => (a.weekStart > b.weekStart ? -1 : 1)));
        setSelectedId(fullNote.id);
      } else {
        setNotes((prev) => [newNote, ...prev].sort((a, b) => (a.weekStart > b.weekStart ? -1 : 1)));
        setSelectedId(newNote.id);
      }
    } finally {
      setCreatingWeek(false);
    }
  }

  // ── Delete week ───────────────────────────────────────────────────────────

  async function handleDeleteWeek(id: string) {
    if (!confirm("Delete this week's notes? This cannot be undone.")) return;
    await fetch(`/api/weekly-notes/${id}`, { method: "DELETE" });
    const updated = notes.filter((n) => n.id !== id);
    setNotes(updated);
    if (selectedId === id) setSelectedId(updated[0]?.id ?? null);
  }

  const existingCustomerIds = effectiveEntries.map((e) => e.customerId);
  const [mobileShowEditor, setMobileShowEditor] = useState(false);

  return (
    <div className="flex flex-col h-full bg-[#0D0D0D] overflow-hidden">
      {/* ── Page Header ─────────────────────────────────────────────────────── */}
      <div className="flex-shrink-0 px-4 pt-4 pb-3 border-b border-[rgba(255,255,255,0.06)]">
        <h1 className="text-2xl font-black text-[#F0F0F0] flex items-center gap-3">
          <BookOpen size={22} className="text-[#F7941D]" />
          Weekly Notes
        </h1>
      </div>

      {/* ── Two-column layout ───────────────────────────────────────────────── */}
      <div className="flex flex-1 overflow-hidden">
      {/* ── Left: Week List ─────────────────────────────────────────────────── */}
      <div className={cn(
        "flex-shrink-0 flex flex-col border-r border-[rgba(255,255,255,0.06)] bg-[#0A0A0A]",
        "w-full md:w-44",
        mobileShowEditor ? "hidden md:flex" : "flex"
      )}>
        <div className="px-2.5 pt-2.5 pb-2 border-b border-[rgba(255,255,255,0.06)]">
          <button
            onClick={handleCreateWeek}
            disabled={creatingWeek}
            className="w-full flex items-center justify-center gap-1.5 py-1.5 rounded-lg bg-[rgba(247,148,29,0.1)] border border-[rgba(247,148,29,0.2)] text-[#F7941D] text-xs font-medium hover:bg-[rgba(247,148,29,0.18)] transition-all disabled:opacity-50"
          >
            <Plus size={12} />
            {creatingWeek ? "Creating…" : "New Week"}
          </button>
        </div>

        <div className="flex-1 overflow-y-auto py-1.5 space-y-0.5 px-1.5">
          <AnimatePresence>
            {notes.length === 0 && (
              <p className="text-xs text-[#404040] text-center py-6 px-3">
                No weekly notes yet. Create your first week above.
              </p>
            )}
            {notes.map((note) => {
              const range = formatWeekRange(note.weekStart);
              const isSelected = note.id === selectedId;
              const isCurrent = isCurrentWeek(note.weekStart);
              const itemCount = countItems(note.entries);

              return (
                <motion.div
                  key={note.id}
                  initial={{ opacity: 0, x: -8 }}
                  animate={{ opacity: 1, x: 0 }}
                  className={cn(
                    "group relative rounded-lg px-3 py-2.5 cursor-pointer transition-all",
                    isSelected
                      ? "bg-[rgba(247,148,29,0.1)] border border-[rgba(247,148,29,0.2)]"
                      : "hover:bg-[rgba(255,255,255,0.03)] border border-transparent"
                  )}
                  onClick={() => { setSelectedId(note.id); setMobileShowEditor(true); }}
                >
                  {isSelected && (
                    <div className="absolute left-0 top-1/2 -translate-y-1/2 w-0.5 h-5 bg-[#F7941D] rounded-r" />
                  )}
                  <div className="flex items-center justify-between gap-1 mb-0.5">
                    <span
                      className={cn(
                        "text-xs font-semibold truncate",
                        isSelected ? "text-[#F7941D]" : "text-[#C0C0C0]"
                      )}
                    >
                      {range.short}
                    </span>
                    {isCurrent && (
                      <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-[rgba(34,197,94,0.15)] text-[#22C55E] font-medium flex-shrink-0">
                        NOW
                      </span>
                    )}
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] text-[#505050]">{range.year}</span>
                    <div className="flex items-center gap-1.5">
                      {itemCount > 0 && (
                        <span className="text-[10px] text-[#505050]">{itemCount}</span>
                      )}
                      <button
                        onClick={(e) => { e.stopPropagation(); handleDeleteWeek(note.id); }}
                        className="opacity-0 group-hover:opacity-100 p-0.5 text-[#404040] hover:text-[#EF4444] transition-all"
                      >
                        <Trash2 size={10} />
                      </button>
                    </div>
                  </div>
                </motion.div>
              );
            })}
          </AnimatePresence>
        </div>
      </div>

      {/* ── Right: Notes Editor ──────────────────────────────────────────────── */}
      <div className={cn(
        "flex-1 flex-col min-w-0 overflow-hidden",
        mobileShowEditor ? "flex" : "hidden md:flex"
      )}>
        {selectedNote ? (
          <>
            {/* Week header */}
            <div className="flex flex-col gap-2 px-4 pt-3 pb-3 border-b border-[rgba(255,255,255,0.05)] flex-shrink-0 md:px-5 md:pt-4">
              {/* Mobile back button */}
              <button
                onClick={() => setMobileShowEditor(false)}
                className="flex md:hidden items-center gap-1.5 text-xs text-[#606060] hover:text-[#F7941D] transition-colors self-start"
              >
                <span className="text-base leading-none">‹</span>
                All Weeks
              </button>
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2 mb-1">
                    <h1 className="text-xl font-bold text-[#F0F0F0] md:text-2xl leading-tight">
                      {formatWeekRange(selectedNote.weekStart).full}
                    </h1>
                    {isCurrentWeek(selectedNote.weekStart) && (
                      <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-[rgba(34,197,94,0.15)] text-[#22C55E] border border-[rgba(34,197,94,0.2)] flex-shrink-0">
                        This Week
                      </span>
                    )}
                  </div>
                  <div className="flex flex-wrap items-center gap-3 text-xs text-[#606060]">
                    <span className="flex items-center gap-1.5">
                      <Users size={11} />
                      {selectedNote.entries.length} customer{selectedNote.entries.length !== 1 ? "s" : ""}
                    </span>
                    <span className="flex items-center gap-1.5">
                      <FileText size={11} />
                      {countItems(selectedNote.entries)} notes
                    </span>
                    <span className="hidden sm:flex items-center gap-1.5">
                      <Calendar size={11} />
                      {new Date(selectedNote.weekStart).toLocaleDateString("en-US", {
                        month: "long",
                        day: "numeric",
                        year: "numeric",
                        timeZone: "UTC",
                      })}
                    </span>
                  </div>
                </div>

                <button
                  onClick={() => setShowAddCustomer(true)}
                  className="flex-shrink-0 flex items-center gap-1.5 px-3 py-2 rounded-xl bg-gradient-to-r from-[#F7941D] to-[#FBBA00] text-[#0D0D0D] text-xs font-semibold shadow-lg shadow-[rgba(247,148,29,0.25)] hover:shadow-[rgba(247,148,29,0.4)] hover:scale-[1.02] active:scale-[0.98] transition-all md:gap-2 md:px-4 md:text-sm"
                >
                  <Plus size={13} />
                  <span className="hidden sm:inline">Add Customer</span>
                  <span className="sm:hidden">Add</span>
                </button>
              </div>
            </div>

            {/* Entries */}
            <div className="flex-1 overflow-y-auto px-5 py-4">
              {effectiveEntries.length === 0 ? (
                <motion.div
                  initial={{ opacity: 0, y: 16 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="flex flex-col items-center justify-center h-full text-center pb-20"
                >
                  <div className="w-16 h-16 rounded-2xl bg-[rgba(247,148,29,0.08)] border border-[rgba(247,148,29,0.15)] flex items-center justify-center mb-4">
                    <BookOpen size={24} className="text-[#F7941D]" />
                  </div>
                  <h3 className="text-base font-semibold text-[#C0C0C0] mb-2">No notes yet for this week</h3>
                  <p className="text-sm text-[#505050] mb-6 max-w-xs">
                    Add customer sections to start capturing this week&apos;s updates and notes.
                  </p>
                  <button
                    onClick={() => setShowAddCustomer(true)}
                    className="flex items-center gap-2 px-4 py-2 rounded-xl bg-gradient-to-r from-[#F7941D] to-[#FBBA00] text-[#0D0D0D] text-sm font-semibold"
                  >
                    <Plus size={15} />
                    Add First Customer
                  </button>
                </motion.div>
              ) : (
                <div className="space-y-4">
                  <div className="flex flex-col gap-4">
                    {effectiveEntries.map((entry, idx) => (
                      <CustomerSection
                        key={entry.id}
                        entry={entry}
                        customers={customers}
                        onItemsChange={handleItemsChange}
                        onRemoveEntry={handleRemoveEntry}
                        saving={savingIds.has(entry.id)}
                        canMoveUp={idx > 0}
                        canMoveDown={idx < effectiveEntries.length - 1}
                        onMoveUp={() => handleMoveEntry(entry.id, "up")}
                        onMoveDown={() => handleMoveEntry(entry.id, "down")}
                      />
                    ))}
                  </div>


                </div>
              )}
            </div>
          </>
        ) : (
          <div className="flex-1 flex items-center justify-center">
            <motion.div
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              className="text-center pb-20"
            >
              <div className="w-20 h-20 rounded-3xl bg-[rgba(247,148,29,0.07)] border border-[rgba(247,148,29,0.12)] flex items-center justify-center mx-auto mb-5">
                <BookOpen size={32} className="text-[#F7941D]" />
              </div>
              <h2 className="text-xl font-bold text-[#C0C0C0] mb-2">Weekly Team Notes</h2>
              <p className="text-sm text-[#505050] mb-8 max-w-sm mx-auto">
                Track weekly status updates, meeting notes, and action items for each customer — week by week.
              </p>
              <button
                onClick={handleCreateWeek}
                disabled={creatingWeek}
                className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-gradient-to-r from-[#F7941D] to-[#FBBA00] text-[#0D0D0D] text-sm font-semibold mx-auto hover:scale-[1.02] active:scale-[0.98] transition-all"
              >
                <Plus size={15} />
                Create This Week
              </button>
            </motion.div>
          </div>
        )}
      </div>
      </div>{/* ── end two-column layout ── */}

      {/* Add Customer Modal */}
      <AnimatePresence>
        {showAddCustomer && (
          <AddCustomerModal
            customers={customers}
            existingIds={existingCustomerIds}
            onAdd={handleAddCustomer}
            onClose={() => setShowAddCustomer(false)}
          />
        )}
      </AnimatePresence>
    </div>
  );
}
