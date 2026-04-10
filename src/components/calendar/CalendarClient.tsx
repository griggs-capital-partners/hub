"use client";

import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  ChevronLeft,
  ChevronRight,
  Plus,
  X,
  Calendar,
  CalendarDays,
  Users,
  UserCheck,
  Flag,
  CheckSquare,
  Repeat,
  MapPin,
  Clock,
  Trash2,
  GripVertical,
  Zap,
  ExternalLink,
} from "lucide-react";
import {
  format,
  startOfMonth,
  endOfMonth,
  startOfWeek,
  endOfWeek,
  addDays,
  addMonths,
  subMonths,
  addWeeks,
  subWeeks,
  addHours,
  isSameMonth,
  isSameDay,
  isToday,
  parseISO,
  getHours,
  getMinutes,
  differenceInMinutes,
  differenceInDays,
  setHours,
  setMinutes,
  startOfDay,
  endOfDay,
  isBefore,
  isAfter,
  max,
  min,
} from "date-fns";
import { cn } from "@/lib/utils";

// ─── Types ─────────────────────────────────────────────────────────────────

export interface CalSprint {
  id: string;
  name: string;
  goal: string | null;
  status: string; // "planning" | "active" | "completed"
  startDate: string;
  endDate: string;
  velocity: number | null;
  _count: { tasks: number };
}

export interface CalEvent {
  id: string;
  title: string;
  description: string | null;
  type: string;
  startDate: string;
  endDate: string | null;
  allDay: boolean;
  location: string | null;
  isRecurring: boolean;
  recurrence: string | null;
  createdById: string | null;
  createdAt: string;
  updatedAt: string;
}

interface CalendarOccurrence extends CalEvent {
  sourceEventId: string;
  occurrenceStartDate: string;
  occurrenceEndDate: string | null;
}

type ViewMode = "month" | "week" | "day";

// ─── Event type config ─────────────────────────────────────────────────────

const EVENT_TYPES = [
  {
    id: "customer-meeting",
    label: "Customer Meeting",
    icon: UserCheck,
    color: "#3B82F6",
    bg: "rgba(59,130,246,0.18)",
    border: "rgba(59,130,246,0.5)",
  },
  {
    id: "team-meeting",
    label: "Team Meeting",
    icon: Users,
    color: "#A855F7",
    bg: "rgba(168,85,247,0.18)",
    border: "rgba(168,85,247,0.5)",
  },
  {
    id: "milestone",
    label: "Milestone",
    icon: Flag,
    color: "#F7941D",
    bg: "rgba(247,148,29,0.18)",
    border: "rgba(247,148,29,0.5)",
  },
  {
    id: "task",
    label: "Task",
    icon: CheckSquare,
    color: "#22C55E",
    bg: "rgba(34,197,94,0.18)",
    border: "rgba(34,197,94,0.5)",
  },
  {
    id: "event",
    label: "Event",
    icon: Calendar,
    color: "#FBBA00",
    bg: "rgba(251,186,0,0.18)",
    border: "rgba(251,186,0,0.5)",
  },
] as const;

type EventTypeId = (typeof EVENT_TYPES)[number]["id"];

function getEventType(typeId: string) {
  return EVENT_TYPES.find((t) => t.id === typeId) ?? EVENT_TYPES[4];
}

// ─── Sprint status config ──────────────────────────────────────────────────

const SPRINT_STATUS_CONFIG = {
  active: {
    color: "#22C55E",
    bg: "rgba(34,197,94,0.15)",
    border: "rgba(34,197,94,0.4)",
    glow: "rgba(34,197,94,0.12)",
    label: "Active",
    dot: "bg-emerald-400",
    pulse: true,
  },
  planning: {
    color: "#FBBA00",
    bg: "rgba(251,186,0,0.15)",
    border: "rgba(251,186,0,0.4)",
    glow: "rgba(251,186,0,0.08)",
    label: "Planning",
    dot: "bg-amber-400",
    pulse: false,
  },
  completed: {
    color: "#606060",
    bg: "rgba(96,96,96,0.12)",
    border: "rgba(96,96,96,0.3)",
    glow: "transparent",
    label: "Completed",
    dot: "bg-gray-500",
    pulse: false,
  },
} as const;

function getSprintCfg(status: string) {
  return SPRINT_STATUS_CONFIG[status as keyof typeof SPRINT_STATUS_CONFIG] ?? SPRINT_STATUS_CONFIG.completed;
}

/**
 * Parse a sprint ISO date string as a local calendar date, ignoring timezone.
 * Sprint dates are stored as UTC midnight (e.g. "2025-04-14T00:00:00.000Z").
 * Parsing with parseISO gives the UTC instant, which in US timezones becomes
 * the previous evening — shifting every sprint one day early. We extract only
 * the YYYY-MM-DD portion and construct a local Date to avoid this.
 */
function parseSprintDate(isoString: string): Date {
  const [year, month, day] = isoString.slice(0, 10).split("-").map(Number);
  return new Date(year, month - 1, day);
}

/** True if the sprint spans (or touches) a given day */
function sprintOnDay(sprint: CalSprint, day: Date): boolean {
  const start = startOfDay(parseSprintDate(sprint.startDate));
  const end = endOfDay(parseSprintDate(sprint.endDate));
  const d = startOfDay(day);
  return !isBefore(d, start) && !isAfter(d, end);
}

function sprintStartsOnDay(sprint: CalSprint, day: Date): boolean {
  return isSameDay(parseSprintDate(sprint.startDate), day);
}

function sprintEndsOnDay(sprint: CalSprint, day: Date): boolean {
  return isSameDay(parseSprintDate(sprint.endDate), day);
}

// ─── Recurrence options ────────────────────────────────────────────────────

const RECURRENCE_OPTIONS = [
  { value: "none", label: "Does not repeat" },
  { value: "daily", label: "Daily" },
  { value: "weekly", label: "Weekly" },
  { value: "biweekly", label: "Every 2 weeks" },
  { value: "monthly", label: "Monthly" },
  { value: "yearly", label: "Yearly" },
];

// ─── Helpers ────────────────────────────────────────────────────────────────

function getMonthGrid(date: Date): Date[] {
  const start = startOfWeek(startOfMonth(date), { weekStartsOn: 0 });
  const end = endOfWeek(endOfMonth(date), { weekStartsOn: 0 });
  const days: Date[] = [];
  let cur = start;
  while (cur <= end) {
    days.push(cur);
    cur = addDays(cur, 1);
  }
  return days;
}

function getWeekDays(date: Date): Date[] {
  const start = startOfWeek(date, { weekStartsOn: 0 });
  return Array.from({ length: 7 }, (_, i) => addDays(start, i));
}

function eventsForDay<T extends CalEvent>(events: T[], day: Date): T[] {
  return events.filter((e) => {
    const start = parseISO(e.startDate);
    return isSameDay(start, day);
  });
}

function recurrenceStepDays(freq: string) {
  switch (freq) {
    case "daily":
      return 1;
    case "weekly":
      return 7;
    case "biweekly":
      return 14;
    case "monthly":
      return 30;
    case "yearly":
      return 365;
    default:
      return null;
  }
}

function expandRecurringEvent(event: CalEvent, rangeStart: Date, rangeEnd: Date): CalendarOccurrence[] {
  const baseStart = parseISO(event.startDate);
  const baseEnd = event.endDate ? parseISO(event.endDate) : null;

  if (!event.isRecurring || !event.recurrence) {
    if (baseStart < rangeStart || baseStart > rangeEnd) return [];
    return [
      {
        ...event,
        sourceEventId: event.id,
        occurrenceStartDate: event.startDate,
        occurrenceEndDate: event.endDate,
      },
    ];
  }

  let freq = "none";
  let until: Date | null = null;

  try {
    const parsed = JSON.parse(event.recurrence) as { freq?: string; until?: string };
    freq = parsed.freq ?? "none";
    until = parsed.until ? parseISO(parsed.until) : null;
  } catch {
    freq = "none";
  }

  const stepDays = recurrenceStepDays(freq);
  if (!stepDays) {
    if (baseStart < rangeStart || baseStart > rangeEnd) return [];
    return [
      {
        ...event,
        sourceEventId: event.id,
        occurrenceStartDate: event.startDate,
        occurrenceEndDate: event.endDate,
      },
    ];
  }

  const effectiveEnd = until ? min([until, rangeEnd]) : rangeEnd;
  const durationMinutes = baseEnd ? differenceInMinutes(baseEnd, baseStart) : null;
  const occurrences: CalendarOccurrence[] = [];
  let occurrenceStart = baseStart;
  let index = 0;

  while (occurrenceStart <= effectiveEnd) {
    if (occurrenceStart >= rangeStart) {
      const occurrenceEnd =
        durationMinutes !== null ? new Date(occurrenceStart.getTime() + durationMinutes * 60_000) : null;
      occurrences.push({
        ...event,
        id: `${event.id}::${index}`,
        startDate: occurrenceStart.toISOString(),
        endDate: occurrenceEnd ? occurrenceEnd.toISOString() : null,
        sourceEventId: event.id,
        occurrenceStartDate: occurrenceStart.toISOString(),
        occurrenceEndDate: occurrenceEnd ? occurrenceEnd.toISOString() : null,
      });
    }

    if (freq === "monthly") {
      occurrenceStart = addMonths(occurrenceStart, 1);
    } else if (freq === "yearly") {
      occurrenceStart = new Date(
        occurrenceStart.getFullYear() + 1,
        occurrenceStart.getMonth(),
        occurrenceStart.getDate(),
        occurrenceStart.getHours(),
        occurrenceStart.getMinutes(),
        occurrenceStart.getSeconds(),
        occurrenceStart.getMilliseconds()
      );
    } else {
      occurrenceStart = addDays(occurrenceStart, stepDays);
    }

    index += 1;
  }

  return occurrences;
}

function expandEventsForRange(events: CalEvent[], rangeStart: Date, rangeEnd: Date): CalendarOccurrence[] {
  return events
    .flatMap((event) => expandRecurringEvent(event, rangeStart, rangeEnd))
    .sort((a, b) => parseISO(a.startDate).getTime() - parseISO(b.startDate).getTime());
}

// ─── Sprint Banner (month row) ─────────────────────────────────────────────

function SprintBanner({
  sprint,
  isStart,
  isEnd,
  onClick,
}: {
  sprint: CalSprint;
  isStart: boolean;
  isEnd: boolean;
  onClick: (s: CalSprint) => void;
}) {
  const cfg = getSprintCfg(sprint.status);
  const shortName = sprint.name.replace(/^sprint\s*/i, "Sprint ");

  return (
    <motion.button
      whileHover={{ opacity: 0.8 }}
      onClick={(e) => {
        e.stopPropagation();
        onClick(sprint);
      }}
      className={cn(
        "w-full h-5 flex items-center gap-1 px-1.5 text-[10px] font-semibold overflow-hidden transition-all",
        isStart ? "rounded-l-full" : "",
        isEnd ? "rounded-r-full" : "",
        !isStart && !isEnd ? "" : "",
      )}
      style={{
        background: cfg.bg,
        borderTop: `1px solid ${cfg.border}`,
        borderBottom: `1px solid ${cfg.border}`,
        borderLeft: isStart ? `2px solid ${cfg.color}` : "none",
        borderRight: isEnd ? `1px solid ${cfg.border}` : "none",
        color: cfg.color,
      }}
    >
      {isStart && (
        <>
          <span className={cn("w-1.5 h-1.5 rounded-full flex-shrink-0", cfg.dot, cfg.pulse && "animate-pulse")} />
          <span className="truncate">{shortName}</span>
        </>
      )}
    </motion.button>
  );
}

// ─── Sprint Detail Popover ─────────────────────────────────────────────────

function SprintPopover({
  sprint,
  onClose,
}: {
  sprint: CalSprint;
  onClose: () => void;
}) {
  const cfg = getSprintCfg(sprint.status);
  const start = parseSprintDate(sprint.startDate);
  const end = parseSprintDate(sprint.endDate);
  const totalDays = differenceInDays(end, start) + 1;
  const elapsed = Math.max(0, Math.min(differenceInDays(new Date(), start) + 1, totalDays));
  const pct = Math.round((elapsed / totalDays) * 100);

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95, y: 6 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.95, y: 6 }}
      transition={{ duration: 0.16 }}
      className="absolute z-50 w-72 bg-[#161616] border rounded-xl shadow-2xl overflow-hidden"
      style={{ borderColor: cfg.border, boxShadow: `0 0 0 1px ${cfg.border}, 0 20px 60px rgba(0,0,0,0.6)` }}
    >
      {/* Top accent */}
      <div className="h-1 w-full" style={{ background: cfg.color }} />

      <div className="p-4 space-y-3">
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-center gap-2 min-w-0">
            <span
              className={cn("w-2 h-2 rounded-full flex-shrink-0", cfg.dot, cfg.pulse && "animate-pulse")}
            />
            <h3 className="font-semibold text-[#F0F0F0] text-sm leading-tight">{sprint.name}</h3>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded text-[#606060] hover:text-[#F0F0F0] transition-colors flex-shrink-0"
          >
            <X size={13} />
          </button>
        </div>

        <div
          className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium"
          style={{ background: cfg.bg, color: cfg.color, border: `1px solid ${cfg.border}` }}
        >
          {cfg.label}
        </div>

        {sprint.goal && (
          <p className="text-xs text-[#9A9A9A] italic leading-relaxed">&quot;{sprint.goal}&quot;</p>
        )}

        <div className="space-y-1 text-xs text-[#9A9A9A]">
          <div className="flex items-center gap-2">
            <Clock size={11} className="flex-shrink-0" />
            <span>
              {format(start, "MMM d")} – {format(end, "MMM d, yyyy")}
              <span className="ml-1 text-[#606060]">({totalDays} days)</span>
            </span>
          </div>
          <div className="flex items-center gap-2">
            <CheckSquare size={11} className="flex-shrink-0" />
            <span>{sprint._count.tasks} task{sprint._count.tasks !== 1 ? "s" : ""}</span>
            {sprint.velocity && (
              <span className="text-[#606060]">· {sprint.velocity} pts planned</span>
            )}
          </div>
        </div>

        {/* Progress bar */}
        <div>
          <div className="flex items-center justify-between text-[10px] text-[#606060] mb-1">
            <span>Progress</span>
            <span>{pct}%</span>
          </div>
          <div className="h-1.5 bg-[#2A2A2A] rounded-full overflow-hidden">
            <motion.div
              initial={{ width: 0 }}
              animate={{ width: `${pct}%` }}
              transition={{ duration: 0.6, ease: "easeOut" }}
              className="h-full rounded-full"
              style={{ background: cfg.color }}
            />
          </div>
        </div>

        <a
          href="/sprints"
          className="flex items-center justify-center gap-1.5 w-full text-xs py-1.5 rounded-lg transition-all"
          style={{ background: cfg.bg, color: cfg.color, border: `1px solid ${cfg.border}` }}
        >
          <ExternalLink size={11} />
          Open in Dev Sprints
        </a>
      </div>
    </motion.div>
  );
}

// ─── Event Pill (used in month + week view) ────────────────────────────────

function EventPill({
  event,
  compact = false,
  onClick,
}: {
  event: CalendarOccurrence;
  compact?: boolean;
  onClick: (e: CalendarOccurrence, rect: DOMRect) => void;
}) {
  const cfg = getEventType(event.type);
  const Icon = cfg.icon;
  return (
    <motion.button
      whileHover={{ scale: 1.02 }}
      whileTap={{ scale: 0.98 }}
      onClick={(ev) => {
        ev.stopPropagation();
        onClick(event, ev.currentTarget.getBoundingClientRect());
      }}
      id={`ev-${event.id}`}
      className={cn(
        "w-full text-left rounded-md px-1.5 py-0.5 text-xs font-medium truncate flex items-center gap-1 transition-all",
        compact ? "py-px" : "py-1"
      )}
      style={{
        background: cfg.bg,
        border: `1px solid ${cfg.border}`,
        color: cfg.color,
      }}
    >
      <Icon size={10} className="flex-shrink-0" />
      <span className="truncate">{event.title}</span>
      {event.isRecurring && <Repeat size={8} className="flex-shrink-0 opacity-70" />}
    </motion.button>
  );
}

// ─── Add / Edit Event Modal ────────────────────────────────────────────────

interface EventModalProps {
  open: boolean;
  onClose: () => void;
  onSave: (data: Partial<CalEvent>) => Promise<void>;
  onDelete?: () => Promise<void>;
  initial?: Partial<CalEvent>;
  prefillDate?: Date;
  prefillType?: EventTypeId;
}

function EventModal({ open, onClose, onSave, onDelete, initial, prefillDate, prefillType }: EventModalProps) {
  const isEdit = !!initial?.id;

  const [title, setTitle] = useState("");
  const [type, setType] = useState<EventTypeId>(prefillType ?? "event");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [allDay, setAllDay] = useState(false);
  const [location, setLocation] = useState("");
  const [description, setDescription] = useState("");
  const [recurrence, setRecurrence] = useState("none");
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const cfg = getEventType(type);

  useEffect(() => {
    if (!open) return;

    const defaultDate = prefillDate ?? new Date();
    const defaultStart = format(defaultDate, "yyyy-MM-dd'T'HH:mm");
    const defaultEnd = format(addHours(defaultDate, 1), "yyyy-MM-dd'T'HH:mm");

    setTitle(initial?.title ?? "");
    setType((initial?.type as EventTypeId) ?? prefillType ?? "event");
    setStartDate(
      initial?.startDate ? format(parseISO(initial.startDate), "yyyy-MM-dd'T'HH:mm") : defaultStart
    );
    setEndDate(
      initial?.endDate
        ? format(parseISO(initial.endDate), "yyyy-MM-dd'T'HH:mm")
        : initial?.startDate
        ? format(addHours(parseISO(initial.startDate), 1), "yyyy-MM-dd'T'HH:mm")
        : defaultEnd
    );
    setAllDay(initial?.allDay ?? false);
    setLocation(initial?.location ?? "");
    setDescription(initial?.description ?? "");
    setRecurrence(() => {
      if (!initial?.isRecurring) return "none";
      try {
        const r = JSON.parse(initial.recurrence ?? "{}");
        return r.freq ?? "none";
      } catch {
        return "none";
      }
    });
  }, [open, initial, prefillDate, prefillType]);

  async function handleSave() {
    if (!title.trim()) return;
    setSaving(true);
    try {
      await onSave({
        title: title.trim(),
        type,
        startDate: new Date(startDate).toISOString(),
        endDate: allDay ? null : new Date(endDate).toISOString(),
        allDay,
        location: location || null,
        description: description || null,
        isRecurring: recurrence !== "none",
        recurrence: recurrence !== "none" ? JSON.stringify({ freq: recurrence }) : null,
      });
      onClose();
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    if (!onDelete) return;
    setDeleting(true);
    try {
      await onDelete();
      onClose();
    } finally {
      setDeleting(false);
    }
  }

  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div
            key="backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm"
          />
          <motion.div
            key="modal"
            initial={{ opacity: 0, scale: 0.94, y: 12 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.94, y: 12 }}
            transition={{ duration: 0.22, ease: [0.4, 0, 0.2, 1] }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4 pointer-events-none"
          >
            <div
              className="pointer-events-auto w-full max-w-lg bg-[#111111] border border-[rgba(255,255,255,0.08)] rounded-2xl shadow-2xl overflow-hidden"
              onClick={(e) => e.stopPropagation()}
            >
              {/* Header accent bar */}
              <div className="h-1 w-full" style={{ background: cfg.color }} />

              {/* Header */}
              <div className="flex items-center justify-between px-5 py-4 border-b border-[rgba(255,255,255,0.06)]">
                <h2 className="text-base font-semibold text-[#F0F0F0]">
                  {isEdit ? "Edit Event" : "New Event"}
                </h2>
                <button
                  onClick={onClose}
                  className="p-1.5 rounded-lg text-[#606060] hover:text-[#F0F0F0] hover:bg-[rgba(255,255,255,0.06)] transition-all"
                >
                  <X size={16} />
                </button>
              </div>

              <div className="px-5 py-4 space-y-4 max-h-[70vh] overflow-y-auto">
                {/* Title */}
                <div>
                  <input
                    autoFocus
                    placeholder="Event title..."
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && handleSave()}
                    className="w-full bg-transparent text-[#F0F0F0] text-lg font-medium placeholder-[#404040] border-b border-[rgba(255,255,255,0.08)] pb-2 focus:outline-none focus:border-[rgba(255,255,255,0.2)] transition-colors"
                  />
                </div>

                {/* Event type picker */}
                <div>
                  <p className="text-xs text-[#606060] mb-2 uppercase tracking-wider">Type</p>
                  <div className="flex flex-wrap gap-2">
                    {EVENT_TYPES.map((t) => {
                      const TIcon = t.icon;
                      const active = type === t.id;
                      return (
                        <button
                          key={t.id}
                          onClick={() => setType(t.id)}
                          className={cn(
                            "flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition-all border",
                            active ? "opacity-100" : "opacity-50 hover:opacity-80"
                          )}
                          style={
                            active
                              ? { background: t.bg, borderColor: t.border, color: t.color }
                              : { background: "transparent", borderColor: "rgba(255,255,255,0.12)", color: "#9A9A9A" }
                          }
                        >
                          <TIcon size={12} />
                          {t.label}
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* All day toggle */}
                <div className="flex items-center gap-3">
                  <button
                    onClick={() => setAllDay((v) => !v)}
                    className={cn(
                      "relative w-9 h-5 rounded-full transition-all duration-200 flex-shrink-0",
                      allDay ? "bg-[#F7941D]" : "bg-[#2A2A2A]"
                    )}
                  >
                    <span
                      className={cn(
                        "absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white transition-transform duration-200",
                        allDay && "translate-x-4"
                      )}
                    />
                  </button>
                  <span className="text-sm text-[#9A9A9A]">All day</span>
                </div>

                {/* Date/time */}
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs text-[#606060] mb-1 block">
                      {allDay ? "Date" : "Start"}
                    </label>
                    <input
                      type={allDay ? "date" : "datetime-local"}
                      value={allDay ? startDate.split("T")[0] : startDate}
                      onChange={(e) =>
                        setStartDate(allDay ? e.target.value + "T00:00" : e.target.value)
                      }
                      className="w-full bg-[#1A1A1A] border border-[rgba(255,255,255,0.08)] rounded-lg px-3 py-2 text-sm text-[#F0F0F0] focus:outline-none focus:border-[rgba(255,255,255,0.2)] transition-colors"
                    />
                  </div>
                  {!allDay && (
                    <div>
                      <label className="text-xs text-[#606060] mb-1 block">End</label>
                      <input
                        type="datetime-local"
                        value={endDate}
                        onChange={(e) => setEndDate(e.target.value)}
                        className="w-full bg-[#1A1A1A] border border-[rgba(255,255,255,0.08)] rounded-lg px-3 py-2 text-sm text-[#F0F0F0] focus:outline-none focus:border-[rgba(255,255,255,0.2)] transition-colors"
                      />
                    </div>
                  )}
                </div>

                {/* Location */}
                <div className="flex items-center gap-2 bg-[#1A1A1A] border border-[rgba(255,255,255,0.08)] rounded-lg px-3 py-2">
                  <MapPin size={14} className="text-[#606060] flex-shrink-0" />
                  <input
                    placeholder="Add location..."
                    value={location}
                    onChange={(e) => setLocation(e.target.value)}
                    className="flex-1 bg-transparent text-sm text-[#F0F0F0] placeholder-[#404040] focus:outline-none"
                  />
                </div>

                {/* Description */}
                <div>
                  <textarea
                    placeholder="Add description..."
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    rows={2}
                    className="w-full bg-[#1A1A1A] border border-[rgba(255,255,255,0.08)] rounded-lg px-3 py-2 text-sm text-[#F0F0F0] placeholder-[#404040] focus:outline-none focus:border-[rgba(255,255,255,0.2)] transition-colors resize-none"
                  />
                </div>

                {/* Recurrence */}
                <div className="flex items-center gap-2">
                  <Repeat size={14} className="text-[#606060] flex-shrink-0" />
                  <select
                    value={recurrence}
                    onChange={(e) => setRecurrence(e.target.value)}
                    className="flex-1 bg-[#1A1A1A] border border-[rgba(255,255,255,0.08)] rounded-lg px-3 py-2 text-sm text-[#F0F0F0] focus:outline-none focus:border-[rgba(255,255,255,0.2)] transition-colors appearance-none cursor-pointer"
                  >
                    {RECURRENCE_OPTIONS.map((o) => (
                      <option key={o.value} value={o.value} className="bg-[#1A1A1A]">
                        {o.label}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Footer */}
              <div className="flex items-center justify-between px-5 py-4 border-t border-[rgba(255,255,255,0.06)]">
                {isEdit && onDelete ? (
                  <button
                    onClick={handleDelete}
                    disabled={deleting}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm text-red-400 hover:bg-red-500/10 transition-all disabled:opacity-50"
                  >
                    <Trash2 size={14} />
                    {deleting ? "Deleting..." : "Delete"}
                  </button>
                ) : (
                  <div />
                )}
                <div className="flex items-center gap-2">
                  <button
                    onClick={onClose}
                    className="px-4 py-2 rounded-lg text-sm text-[#9A9A9A] hover:text-[#F0F0F0] hover:bg-[rgba(255,255,255,0.06)] transition-all"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleSave}
                    disabled={!title.trim() || saving}
                    className="px-4 py-2 rounded-lg text-sm font-medium text-white transition-all disabled:opacity-40"
                    style={{ background: cfg.color }}
                  >
                    {saving ? "Saving..." : isEdit ? "Save changes" : "Create event"}
                  </button>
                </div>
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}

// ─── Event Detail Popover ──────────────────────────────────────────────────

function EventDetailPopover({
  event,
  onEdit,
  onDelete,
  onClose,
}: {
  event: CalendarOccurrence;
  onEdit: () => void;
  onDelete: () => void;
  onClose: () => void;
}) {
  const cfg = getEventType(event.type);
  const Icon = cfg.icon;
  const start = parseISO(event.startDate);
  const end = event.endDate ? parseISO(event.endDate) : null;

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95, y: 6 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.95, y: 6 }}
      transition={{ duration: 0.16 }}
      className="absolute z-50 w-72 bg-[#161616] border border-[rgba(255,255,255,0.1)] rounded-xl shadow-2xl p-4 space-y-3"
      style={{ boxShadow: `0 0 0 1px ${cfg.border}, 0 20px 60px rgba(0,0,0,0.6)` }}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <span
            className="w-6 h-6 rounded-md flex items-center justify-center flex-shrink-0"
            style={{ background: cfg.bg }}
          >
            <Icon size={13} style={{ color: cfg.color }} />
          </span>
          <h3 className="font-semibold text-[#F0F0F0] text-sm leading-tight truncate">{event.title}</h3>
        </div>
        <button
          onClick={onClose}
          className="p-1 rounded text-[#606060] hover:text-[#F0F0F0] transition-colors flex-shrink-0"
        >
          <X size={13} />
        </button>
      </div>

      <div className="space-y-1.5 text-xs text-[#9A9A9A]">
        <div className="flex items-center gap-2">
          <Clock size={11} className="flex-shrink-0" />
          <span>
            {event.allDay
              ? format(start, "EEEE, MMM d, yyyy")
              : end
              ? `${format(start, "MMM d · h:mm a")} – ${format(end, "h:mm a")}`
              : format(start, "MMM d · h:mm a")}
          </span>
        </div>
        {event.location && (
          <div className="flex items-center gap-2">
            <MapPin size={11} className="flex-shrink-0" />
            <span>{event.location}</span>
          </div>
        )}
        {event.isRecurring && (
          <div className="flex items-center gap-2">
            <Repeat size={11} className="flex-shrink-0" />
            <span>
              {(() => {
                try {
                  const r = JSON.parse(event.recurrence ?? "{}");
                  return RECURRENCE_OPTIONS.find((o) => o.value === r.freq)?.label ?? "Recurring";
                } catch {
                  return "Recurring";
                }
              })()}
            </span>
          </div>
        )}
        {event.description && (
          <p className="text-[#707070] mt-1 line-clamp-3">{event.description}</p>
        )}
      </div>

      <div className="flex items-center gap-2">
        <button
          onClick={onEdit}
          className="flex-1 text-center text-xs py-1.5 rounded-lg transition-all"
          style={{ background: cfg.bg, color: cfg.color, border: `1px solid ${cfg.border}` }}
        >
          Edit event
        </button>
        <button
          onClick={onDelete}
          className="px-3 text-center text-xs py-1.5 rounded-lg transition-all border border-red-500/30 text-red-400 hover:bg-red-500/10"
        >
          Delete
        </button>
      </div>
    </motion.div>
  );
}

// ─── Drag-from-palette type button ────────────────────────────────────────

function DraggableTypeCard({
  type,
  onDragStart,
}: {
  type: (typeof EVENT_TYPES)[number];
  onDragStart: (typeId: EventTypeId) => void;
}) {
  const Icon = type.icon;
  return (
    <motion.div
      draggable
      onDragStart={() => onDragStart(type.id)}
      whileHover={{ scale: 1.03, x: 2 }}
      whileTap={{ scale: 0.97 }}
      className="flex items-center gap-2 px-3 py-2.5 rounded-xl border cursor-grab active:cursor-grabbing transition-all select-none"
      style={{
        background: type.bg,
        borderColor: type.border,
      }}
    >
      <GripVertical size={12} className="text-[#404040]" />
      <Icon size={14} style={{ color: type.color }} />
      <span className="text-xs font-medium" style={{ color: type.color }}>
        {type.label}
      </span>
    </motion.div>
  );
}

// ─── Month View ────────────────────────────────────────────────────────────

function MonthView({
  currentDate,
  events,
  sprints,
  onDayClick,
  onEventClick,
  onSprintClick,
  onDayDrop,
  draggingType,
}: {
  currentDate: Date;
  events: CalendarOccurrence[];
  sprints: CalSprint[];
  onDayClick: (day: Date) => void;
  onEventClick: (event: CalendarOccurrence, rect: DOMRect) => void;
  onSprintClick: (sprint: CalSprint, rect: DOMRect) => void;
  onDayDrop: (day: Date) => void;
  draggingType: EventTypeId | null;
}) {
  const days = getMonthGrid(currentDate);
  const [dragOver, setDragOver] = useState<string | null>(null);

  // Only show non-completed sprints (or recently completed)
  const visibleSprints = sprints.filter((s) => s.status !== "completed");

  return (
    <div className="flex-1 flex flex-col min-h-0">
      {/* Weekday headers */}
      <div className="grid grid-cols-7 border-b border-[rgba(255,255,255,0.06)]">
        {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((d) => (
          <div key={d} className="py-2 text-center text-xs font-medium text-[#505050]">
            {d}
          </div>
        ))}
      </div>

      {/* Day grid */}
      <div className="flex-1 grid grid-cols-7 auto-rows-fr min-h-0">
        {days.map((day) => {
          const dayKey = format(day, "yyyy-MM-dd");
          const dayEvents = eventsForDay(events, day);
          const isCurrentMonth = isSameMonth(day, currentDate);
          const isDragOver = dragOver === dayKey && !!draggingType;
          const daySprints = visibleSprints.filter((s) => sprintOnDay(s, day));

          return (
            <div
              key={dayKey}
              onClick={() => onDayClick(day)}
              onDragOver={(e) => { e.preventDefault(); setDragOver(dayKey); }}
              onDragLeave={() => setDragOver(null)}
              onDrop={() => { setDragOver(null); onDayDrop(day); }}
              className={cn(
                "border-b border-r border-[rgba(255,255,255,0.04)] p-1 min-h-[90px] cursor-pointer transition-all group flex flex-col",
                !isCurrentMonth && "opacity-40",
                isDragOver && "bg-[rgba(247,148,29,0.06)]"
              )}
            >
              {/* Day number */}
              <div className="flex items-center justify-between mb-1 flex-shrink-0">
                <span
                  className={cn(
                    "w-6 h-6 rounded-full flex items-center justify-center text-xs font-medium transition-all",
                    isToday(day)
                      ? "bg-[#F7941D] text-white"
                      : "text-[#9A9A9A] group-hover:text-[#F0F0F0]"
                  )}
                >
                  {format(day, "d")}
                </span>
              </div>

              {/* Sprint banners — one per active sprint on this day */}
              {daySprints.length > 0 && (
                <div className="space-y-0.5 mb-1 flex-shrink-0">
                  {daySprints.map((sprint) => {
                    const isStart = sprintStartsOnDay(sprint, day);
                    const isEnd = sprintEndsOnDay(sprint, day);
                    return (
                      <SprintBanner
                        key={sprint.id}
                        sprint={sprint}
                        isStart={isStart}
                        isEnd={isEnd}
                        onClick={(s) => {
                          const el = document.getElementById(`sprint-banner-${s.id}-${dayKey}`);
                          if (el) onSprintClick(s, el.getBoundingClientRect());
                        }}
                      />
                    );
                  })}
                </div>
              )}

              {/* Invisible anchor for popover positioning */}
              {daySprints.map((sprint) => (
                <span
                  key={sprint.id}
                  id={`sprint-banner-${sprint.id}-${dayKey}`}
                  className="sr-only"
                />
              ))}

              {/* Regular events */}
              <div className="space-y-0.5 flex-1 min-h-0">
                {dayEvents.slice(0, 2).map((ev) => (
                  <EventPill
                    key={ev.id}
                    event={ev}
                    compact
                    onClick={onEventClick}
                  />
                ))}
                {dayEvents.length > 2 && (
                  <div className="text-[10px] text-[#606060] px-1">
                    +{dayEvents.length - 2} more
                  </div>
                )}
              </div>

              {isDragOver && (
                <div className="mt-1 text-[10px] text-[#F7941D] text-center animate-pulse flex-shrink-0">
                  Drop here
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─── Week View ─────────────────────────────────────────────────────────────

const HOUR_HEIGHT = 48; // px per hour
const WORKDAY_START_HOUR = 8;
const WORKDAY_END_HOUR = 18;
const WORKDAY_HOURS = Array.from(
  { length: WORKDAY_END_HOUR - WORKDAY_START_HOUR },
  (_, i) => WORKDAY_START_HOUR + i
);

function WeekView({
  currentDate,
  events,
  sprints,
  onSlotClick,
  onEventClick,
  onSprintClick,
  onSlotDrop,
  draggingType,
}: {
  currentDate: Date;
  events: CalendarOccurrence[];
  sprints: CalSprint[];
  onSlotClick: (date: Date) => void;
  onEventClick: (event: CalendarOccurrence, rect: DOMRect) => void;
  onSprintClick: (sprint: CalSprint, rect: DOMRect) => void;
  onSlotDrop: (date: Date) => void;
  draggingType: EventTypeId | null;
}) {
  const days = getWeekDays(currentDate);
  const hours = WORKDAY_HOURS;
  const [dragOver, setDragOver] = useState<string | null>(null);
  const visibleSprints = sprints.filter((s) => s.status !== "completed");

  function slotKey(day: Date, hour: number) {
    return `${format(day, "yyyy-MM-dd")}-${hour}`;
  }

  function timeEventsForDay(day: Date) {
    return events.filter((e) => {
      const s = parseISO(e.startDate);
      return isSameDay(s, day) && !e.allDay && getHours(s) < WORKDAY_END_HOUR && getHours(s) >= WORKDAY_START_HOUR;
    });
  }

  function positionEvent(e: CalendarOccurrence) {
    const start = parseISO(e.startDate);
    const end = e.endDate ? parseISO(e.endDate) : addHours(start, 1);
    const clampedStart = max([start, setMinutes(setHours(new Date(dayStartRef(start)), WORKDAY_START_HOUR), 0)]);
    const clampedEnd = min([end, setMinutes(setHours(new Date(dayStartRef(start)), WORKDAY_END_HOUR), 0)]);
    const top = ((getHours(clampedStart) - WORKDAY_START_HOUR) + getMinutes(clampedStart) / 60) * HOUR_HEIGHT;
    const height = Math.max((differenceInMinutes(clampedEnd, clampedStart) / 60) * HOUR_HEIGHT, 20);
    return { top, height };
  }

  function dayStartRef(date: Date) {
    return startOfDay(date).getTime();
  }

  return (
    <div className="flex-1 flex flex-col min-h-0">
      {/* Sprint all-day banner row */}
      {visibleSprints.length > 0 && (
        <div className="flex border-b border-[rgba(255,255,255,0.06)] bg-[#0D0D0D]">
          <div className="w-14 flex-shrink-0 flex items-center justify-end pr-2 py-1">
            <span className="text-[9px] text-[#404040] uppercase tracking-wider">Sprint</span>
          </div>
          {days.map((day) => {
            const daySprints = visibleSprints.filter((s) => sprintOnDay(s, day));
            return (
              <div key={format(day, "yyyy-MM-dd")} className="flex-1 border-l border-[rgba(255,255,255,0.04)] py-1 px-0.5 space-y-0.5">
                {daySprints.map((sprint) => {
                  const isStart = sprintStartsOnDay(sprint, day);
                  const isEnd = sprintEndsOnDay(sprint, day);
                  const cfg = getSprintCfg(sprint.status);
                  return (
                    <motion.button
                      key={sprint.id}
                      id={`week-sprint-${sprint.id}-${format(day, "yyyy-MM-dd")}`}
                      whileHover={{ opacity: 0.85 }}
                      onClick={(e) => {
                        e.stopPropagation();
                        onSprintClick(sprint, e.currentTarget.getBoundingClientRect());
                      }}
                      className="w-full h-5 flex items-center gap-1 px-1 text-[10px] font-semibold overflow-hidden"
                      style={{
                        background: cfg.bg,
                        borderTop: `1px solid ${cfg.border}`,
                        borderBottom: `1px solid ${cfg.border}`,
                        borderLeft: isStart ? `2px solid ${cfg.color}` : "none",
                        borderRight: isEnd ? `1px solid ${cfg.border}` : "none",
                        borderRadius: isStart && isEnd ? "4px" : isStart ? "4px 0 0 4px" : isEnd ? "0 4px 4px 0" : "0",
                        color: cfg.color,
                      }}
                    >
                      {isStart && (
                        <>
                          <Zap size={9} className="flex-shrink-0" />
                          <span className="truncate">{sprint.name}</span>
                        </>
                      )}
                    </motion.button>
                  );
                })}
              </div>
            );
          })}
        </div>
      )}

      {/* Header row */}
      <div className="flex border-b border-[rgba(255,255,255,0.06)]">
        <div className="w-14 flex-shrink-0" />
        {days.map((day) => {
          const hasSprint = visibleSprints.some((s) => sprintOnDay(s, day));
          return (
            <div key={format(day, "yyyy-MM-dd")} className="flex-1 text-center py-2 border-l border-[rgba(255,255,255,0.04)]">
              <div className="text-xs text-[#505050]">{format(day, "EEE")}</div>
              <div
                className={cn(
                  "text-sm font-semibold mx-auto w-7 h-7 rounded-full flex items-center justify-center",
                  isToday(day) ? "bg-[#F7941D] text-white" : "text-[#F0F0F0]"
                )}
              >
                {format(day, "d")}
              </div>
              {hasSprint && (
                <div className="flex justify-center mt-0.5">
                  <span className="w-1 h-1 rounded-full bg-emerald-400" />
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Scrollable time grid */}
      <div className="flex-1 overflow-y-auto">
        <div className="flex" style={{ minHeight: hours.length * HOUR_HEIGHT }}>
          {/* Hour labels */}
          <div className="w-14 flex-shrink-0">
            {hours.map((h) => (
              <div
                key={h}
                className="flex items-start justify-end pr-2 text-[10px] text-[#404040]"
                style={{ height: HOUR_HEIGHT }}
              >
                {format(setHours(setMinutes(new Date(), 0), h), "h a")}
              </div>
            ))}
          </div>

          {/* Day columns */}
          {days.map((day) => {
            const dayEvents = timeEventsForDay(day);
            const inSprint = visibleSprints.some((s) => sprintOnDay(s, day));
            return (
              <div
                key={format(day, "yyyy-MM-dd")}
                className="flex-1 border-l border-[rgba(255,255,255,0.04)] relative"
                style={{
                  minHeight: hours.length * HOUR_HEIGHT,
                  background: inSprint ? "rgba(34,197,94,0.015)" : undefined,
                }}
              >
                {/* Hour cells */}
                {hours.map((h) => {
                  const key = slotKey(day, h);
                  const isDragOver = dragOver === key && !!draggingType;
                  return (
                    <div
                      key={h}
                      style={{ height: HOUR_HEIGHT }}
                      className={cn(
                        "border-b border-[rgba(255,255,255,0.03)] cursor-pointer transition-colors",
                        isDragOver ? "bg-[rgba(247,148,29,0.08)]" : "hover:bg-[rgba(255,255,255,0.02)]"
                      )}
                      onClick={() => onSlotClick(setMinutes(setHours(day, h), 0))}
                      onDragOver={(e) => { e.preventDefault(); setDragOver(key); }}
                      onDragLeave={() => setDragOver(null)}
                      onDrop={() => { setDragOver(null); onSlotDrop(setMinutes(setHours(day, h), 0)); }}
                    />
                  );
                })}

                {/* Event blocks */}
                {dayEvents.map((ev) => {
                  const { top, height } = positionEvent(ev);
                  const cfg = getEventType(ev.type);
                  const Icon = cfg.icon;
                  return (
                    <motion.button
                      key={ev.id}
                      id={`ev-${ev.id}`}
                      initial={{ opacity: 0, scale: 0.95 }}
                      animate={{ opacity: 1, scale: 1 }}
                      onClick={(e) => {
                        e.stopPropagation();
                        onEventClick(ev, e.currentTarget.getBoundingClientRect());
                      }}
                      className="absolute left-0.5 right-0.5 rounded-md px-1.5 text-left overflow-hidden border"
                      style={{
                        top,
                        height: Math.max(height, 20),
                        background: cfg.bg,
                        borderColor: cfg.border,
                        zIndex: 10,
                      }}
                    >
                      <div className="flex items-center gap-1">
                        <Icon size={9} style={{ color: cfg.color }} className="flex-shrink-0" />
                        <span className="text-[10px] font-medium truncate" style={{ color: cfg.color }}>
                          {ev.title}
                        </span>
                      </div>
                      {height > 32 && (
                        <div className="text-[9px] opacity-70" style={{ color: cfg.color }}>
                          {format(parseISO(ev.startDate), "h:mm a")}
                        </div>
                      )}
                    </motion.button>
                  );
                })}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

// ─── Day View ──────────────────────────────────────────────────────────────

function DayView({
  currentDate,
  events,
  sprints,
  onSlotClick,
  onEventClick,
  onSprintClick,
  onSlotDrop,
  draggingType,
}: {
  currentDate: Date;
  events: CalendarOccurrence[];
  sprints: CalSprint[];
  onSlotClick: (date: Date) => void;
  onEventClick: (event: CalendarOccurrence, rect: DOMRect) => void;
  onSprintClick: (sprint: CalSprint, rect: DOMRect) => void;
  onSlotDrop: (date: Date) => void;
  draggingType: EventTypeId | null;
}) {
  const hours = WORKDAY_HOURS;
  const [dragOver, setDragOver] = useState<number | null>(null);

  const dayEvents = events.filter((e) => {
    const s = parseISO(e.startDate);
    return isSameDay(s, currentDate) && !e.allDay && getHours(s) < WORKDAY_END_HOUR && getHours(s) >= WORKDAY_START_HOUR;
  });

  const activeSprints = sprints.filter((s) => s.status !== "completed" && sprintOnDay(s, currentDate));

  function positionEvent(e: CalendarOccurrence) {
    const start = parseISO(e.startDate);
    const end = e.endDate ? parseISO(e.endDate) : addHours(start, 1);
    const workdayStart = setMinutes(setHours(startOfDay(currentDate), WORKDAY_START_HOUR), 0);
    const workdayEnd = setMinutes(setHours(startOfDay(currentDate), WORKDAY_END_HOUR), 0);
    const clampedStart = max([start, workdayStart]);
    const clampedEnd = min([end, workdayEnd]);
    const top = ((getHours(clampedStart) - WORKDAY_START_HOUR) + getMinutes(clampedStart) / 60) * HOUR_HEIGHT;
    const height = Math.max((differenceInMinutes(clampedEnd, clampedStart) / 60) * HOUR_HEIGHT, 24);
    return { top, height };
  }

  return (
    <div className="flex-1 flex flex-col min-h-0">
      {/* Day header */}
      <div className="border-b border-[rgba(255,255,255,0.06)] px-6 py-3">
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-center gap-3">
            <div
              className={cn(
                "w-10 h-10 rounded-xl flex items-center justify-center text-lg font-bold",
                isToday(currentDate) ? "bg-[#F7941D] text-white" : "bg-[#1A1A1A] text-[#F0F0F0]"
              )}
            >
              {format(currentDate, "d")}
            </div>
            <div>
              <div className="text-base font-semibold text-[#F0F0F0]">
                {format(currentDate, "EEEE")}
              </div>
              <div className="text-xs text-[#606060]">{format(currentDate, "MMMM yyyy")}</div>
            </div>
          </div>

          {/* Sprint pills in day header */}
          {activeSprints.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {activeSprints.map((sprint) => {
                const cfg = getSprintCfg(sprint.status);
                const start = parseSprintDate(sprint.startDate);
                const end = parseSprintDate(sprint.endDate);
                const totalDays = differenceInDays(end, start) + 1;
                const dayNum = differenceInDays(currentDate, start) + 1;
                return (
                  <motion.button
                    key={sprint.id}
                    id={`day-sprint-${sprint.id}`}
                    whileHover={{ scale: 1.03 }}
                    onClick={(e) => onSprintClick(sprint, e.currentTarget.getBoundingClientRect())}
                    className="flex items-center gap-2 px-3 py-1.5 rounded-xl border text-xs font-medium"
                    style={{ background: cfg.bg, borderColor: cfg.border, color: cfg.color }}
                  >
                    <span className={cn("w-2 h-2 rounded-full flex-shrink-0", cfg.dot, cfg.pulse && "animate-pulse")} />
                    <Zap size={11} className="flex-shrink-0" />
                    <span>{sprint.name}</span>
                    <span className="opacity-60 text-[10px]">Day {dayNum}/{totalDays}</span>
                  </motion.button>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Time grid */}
      <div className="flex-1 overflow-y-auto">
        <div className="flex" style={{ minHeight: hours.length * HOUR_HEIGHT }}>
          {/* Hour labels */}
          <div className="w-16 flex-shrink-0">
            {hours.map((h) => (
              <div
                key={h}
                className="flex items-start justify-end pr-3 text-xs text-[#404040]"
                style={{ height: HOUR_HEIGHT }}
              >
                {format(setHours(setMinutes(new Date(), 0), h), "h a")}
              </div>
            ))}
          </div>

          {/* Event column */}
          <div className="flex-1 relative border-l border-[rgba(255,255,255,0.04)]" style={{ minHeight: hours.length * HOUR_HEIGHT }}>
            {hours.map((h) => {
              const isDragOver = dragOver === h && !!draggingType;
              return (
                <div
                  key={h}
                  style={{ height: HOUR_HEIGHT }}
                  className={cn(
                    "border-b border-[rgba(255,255,255,0.04)] cursor-pointer transition-colors",
                    isDragOver ? "bg-[rgba(247,148,29,0.08)]" : "hover:bg-[rgba(255,255,255,0.02)]"
                  )}
                  onClick={() => onSlotClick(setMinutes(setHours(currentDate, h), 0))}
                  onDragOver={(e) => {
                    e.preventDefault();
                    setDragOver(h);
                  }}
                  onDragLeave={() => setDragOver(null)}
                  onDrop={() => {
                    setDragOver(null);
                    onSlotDrop(setMinutes(setHours(currentDate, h), 0));
                  }}
                />
              );
            })}

            {dayEvents.map((ev) => {
              const { top, height } = positionEvent(ev);
              const cfg = getEventType(ev.type);
              const Icon = cfg.icon;
              return (
                <motion.button
                  key={ev.id}
                  id={`ev-${ev.id}`}
                  initial={{ opacity: 0, x: -8 }}
                  animate={{ opacity: 1, x: 0 }}
                  onClick={(e) => {
                    e.stopPropagation();
                    onEventClick(ev, e.currentTarget.getBoundingClientRect());
                  }}
                  className="absolute left-2 right-2 rounded-xl px-3 text-left border"
                  style={{
                    top,
                    height: Math.max(height, 32),
                    background: cfg.bg,
                    borderColor: cfg.border,
                    zIndex: 10,
                  }}
                >
                  <div className="flex items-center gap-2 pt-1">
                    <Icon size={12} style={{ color: cfg.color }} />
                    <span className="text-sm font-medium" style={{ color: cfg.color }}>
                      {ev.title}
                    </span>
                  </div>
                  {height > 40 && (
                    <div className="text-xs mt-0.5 opacity-70" style={{ color: cfg.color }}>
                      {format(parseISO(ev.startDate), "h:mm a")}
                      {ev.endDate && ` – ${format(parseISO(ev.endDate), "h:mm a")}`}
                    </div>
                  )}
                  {height > 60 && ev.location && (
                    <div className="flex items-center gap-1 text-xs mt-0.5 opacity-60" style={{ color: cfg.color }}>
                      <MapPin size={9} />
                      {ev.location}
                    </div>
                  )}
                </motion.button>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Main CalendarClient ───────────────────────────────────────────────────

interface Props {
  initialEvents: CalEvent[];
  initialSprints: CalSprint[];
}

export function CalendarClient({ initialEvents, initialSprints }: Props) {
  const [events, setEvents] = useState<CalEvent[]>(initialEvents);
  const sprints = initialSprints; // read-only — managed in Dev Sprints
  const [currentDate, setCurrentDate] = useState(new Date());
  const [view, setView] = useState<ViewMode>("month");

  // Modal state
  const [modalOpen, setModalOpen] = useState(false);
  const [editingEvent, setEditingEvent] = useState<CalEvent | null>(null);
  const [prefillDate, setPrefillDate] = useState<Date | undefined>();
  const [prefillType, setPrefillType] = useState<EventTypeId | undefined>();

  // Event popover state
  const [popoverEvent, setPopoverEvent] = useState<CalendarOccurrence | null>(null);
  const [popoverPos, setPopoverPos] = useState<{ x: number; y: number } | null>(null);

  // Sprint popover state
  const [popoverSprint, setPopoverSprint] = useState<CalSprint | null>(null);
  const [sprintPopoverPos, setSprintPopoverPos] = useState<{ x: number; y: number } | null>(null);

  // Drag-from-palette
  const [draggingType, setDraggingType] = useState<EventTypeId | null>(null);

  // ── Navigation ─────────────────────────────────────────────────────────

  function navigate(dir: 1 | -1) {
    if (view === "month") setCurrentDate((d) => (dir === 1 ? addMonths(d, 1) : subMonths(d, 1)));
    else if (view === "week") setCurrentDate((d) => (dir === 1 ? addWeeks(d, 1) : subWeeks(d, 1)));
    else setCurrentDate((d) => addDays(d, dir));
  }

  function goToday() { setCurrentDate(new Date()); }

  function headerTitle() {
    if (view === "month") return format(currentDate, "MMMM yyyy");
    if (view === "week") {
      const start = startOfWeek(currentDate, { weekStartsOn: 0 });
      const end = endOfWeek(currentDate, { weekStartsOn: 0 });
      return `${format(start, "MMM d")} – ${format(end, "MMM d, yyyy")}`;
    }
    return format(currentDate, "EEEE, MMMM d, yyyy");
  }

  // ── Open modal helpers ─────────────────────────────────────────────────

  function openCreate(date?: Date, type?: EventTypeId) {
    setEditingEvent(null);
    setPrefillDate(date);
    setPrefillType(type);
    setModalOpen(true);
  }

  function openEdit(event: CalEvent) {
    setEditingEvent(event);
    setPrefillDate(undefined);
    setPrefillType(undefined);
    setPopoverEvent(null);
    setModalOpen(true);
  }

  // ── Event CRUD ─────────────────────────────────────────────────────────

  async function handleSave(data: Partial<CalEvent>) {
    if (editingEvent) {
      const res = await fetch(`/api/calendar/events/${editingEvent.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      const updated = await res.json();
      setEvents((prev) => prev.map((e) => e.id === updated.id ? { ...e, ...updated, startDate: updated.startDate, endDate: updated.endDate ?? null, createdAt: updated.createdAt, updatedAt: updated.updatedAt } : e));
    } else {
      const res = await fetch("/api/calendar/events", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      const created = await res.json();
      setEvents((prev) => [...prev, { ...created, startDate: created.startDate, endDate: created.endDate ?? null, createdAt: created.createdAt, updatedAt: created.updatedAt }]);
    }
  }

  async function handleDelete() {
    if (!editingEvent) return;
    await fetch(`/api/calendar/events/${editingEvent.id}`, { method: "DELETE" });
    setEvents((prev) => prev.filter((e) => e.id !== editingEvent.id));
  }

  // ── Popovers ───────────────────────────────────────────────────────────

  function handleEventClick(event: CalendarOccurrence, rect: DOMRect) {
    setPopoverSprint(null);
    setPopoverEvent(event);
    setPopoverPos({ x: rect.left, y: rect.bottom + 8 });
  }

  async function handleDeleteFromPopover() {
    const sourceEventId = popoverEvent?.sourceEventId;
    if (!sourceEventId) return;
    await fetch(`/api/calendar/events/${sourceEventId}`, { method: "DELETE" });
    setEvents((prev) => prev.filter((e) => e.id !== sourceEventId));
    setPopoverEvent(null);
  }

  function handleSprintClick(sprint: CalSprint, rect: DOMRect) {
    setPopoverEvent(null);
    setPopoverSprint(sprint);
    setSprintPopoverPos({ x: rect.left, y: rect.bottom + 8 });
  }

  // ── Drag drop from palette ─────────────────────────────────────────────

  function handleDrop(date: Date) {
    if (!draggingType) return;
    openCreate(date, draggingType);
    setDraggingType(null);
  }

  // Sprint count this month
  const sprintsThisMonth = sprints.filter((s) => {
    const start = parseISO(s.startDate);
    const end = parseISO(s.endDate);
    return (
      isSameMonth(start, currentDate) ||
      isSameMonth(end, currentDate) ||
      (isBefore(start, startOfMonth(currentDate)) && isAfter(end, endOfMonth(currentDate)))
    );
  });

  const visibleEvents = (() => {
    if (view === "month") {
      return expandEventsForRange(events, startOfWeek(startOfMonth(currentDate), { weekStartsOn: 0 }), endOfWeek(endOfMonth(currentDate), { weekStartsOn: 0 }));
    }
    if (view === "week") {
      return expandEventsForRange(
        events,
        setMinutes(setHours(startOfWeek(currentDate, { weekStartsOn: 0 }), WORKDAY_START_HOUR), 0),
        setMinutes(setHours(endOfWeek(currentDate, { weekStartsOn: 0 }), WORKDAY_END_HOUR), 0)
      );
    }
    return expandEventsForRange(
      events,
      setMinutes(setHours(startOfDay(currentDate), WORKDAY_START_HOUR), 0),
      setMinutes(setHours(endOfDay(currentDate), WORKDAY_END_HOUR), 0)
    );
  })();

  return (
    <div className="flex h-screen bg-[#0D0D0D] text-[#F0F0F0] overflow-hidden">
      {/* ── Left panel ─────────────────────────────────────────────────── */}
      <div className="w-52 flex-shrink-0 border-r border-[rgba(255,255,255,0.06)] flex flex-col bg-[#0D0D0D] hidden lg:flex">
        <div className="px-4 pt-5 pb-3 border-b border-[rgba(255,255,255,0.06)]">
          <h1 className="text-2xl font-black text-[#F0F0F0] flex items-center gap-3">
            <CalendarDays size={22} className="text-[#F7941D]" />
            Calendar
          </h1>
        </div>
        <div className="px-4 pt-4 pb-2">
          <h2 className="text-xs font-semibold uppercase tracking-wider text-[#505050]">Event Types</h2>
          <p className="text-[10px] text-[#404040] mt-1">Drag onto the calendar</p>
        </div>

        <div className="px-3 space-y-1.5">
          {EVENT_TYPES.map((t) => (
            <DraggableTypeCard key={t.id} type={t} onDragStart={(typeId) => setDraggingType(typeId)} />
          ))}
        </div>

        {/* Sprint legend */}
        {sprintsThisMonth.length > 0 && (
          <div className="px-4 pt-4 pb-2">
            <p className="text-[10px] uppercase tracking-wider text-[#404040] mb-2">Sprints</p>
            <div className="space-y-1.5">
              {sprintsThisMonth.map((s) => {
                const cfg = getSprintCfg(s.status);
                return (
                  <button
                    key={s.id}
                    onClick={() => {
                      // Navigate to the sprint start month
                      setCurrentDate(parseISO(s.startDate));
                    }}
                    className="w-full flex items-center gap-2 px-2 py-1.5 rounded-lg text-left transition-all hover:bg-[rgba(255,255,255,0.04)]"
                  >
                    <span className={cn("w-2 h-2 rounded-full flex-shrink-0", cfg.dot, cfg.pulse && "animate-pulse")} />
                    <span className="text-xs truncate" style={{ color: cfg.color }}>{s.name}</span>
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* Mini event stats */}
        <div className="px-4 py-4 border-t border-[rgba(255,255,255,0.06)] space-y-2 mt-auto">
          <p className="text-[10px] uppercase tracking-wider text-[#404040]">This month</p>
          {EVENT_TYPES.map((t) => {
            const count = events.filter((e) => {
              const s = parseISO(e.startDate);
              return e.type === t.id && isSameMonth(s, currentDate);
            }).length;
            if (count === 0) return null;
            return (
              <div key={t.id} className="flex items-center justify-between">
                <span className="text-xs" style={{ color: t.color }}>{t.label}</span>
                <span className="text-xs font-bold px-1.5 py-0.5 rounded" style={{ background: t.bg, color: t.color }}>
                  {count}
                </span>
              </div>
            );
          })}
          {events.filter((e) => isSameMonth(parseISO(e.startDate), currentDate)).length === 0 && (
            <p className="text-[10px] text-[#404040]">No events yet</p>
          )}
        </div>
      </div>

      {/* ── Main calendar area ──────────────────────────────────────────── */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Toolbar */}
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-[rgba(255,255,255,0.06)] flex-shrink-0">
          <div className="flex items-center gap-3">
            <button
              onClick={goToday}
              className="px-3 py-1.5 rounded-lg text-xs font-medium bg-[#1A1A1A] text-[#F0F0F0] hover:bg-[#222222] border border-[rgba(255,255,255,0.08)] transition-all"
            >
              Today
            </button>
            <div className="flex items-center gap-0.5">
              <button onClick={() => navigate(-1)} className="p-1.5 rounded-lg text-[#606060] hover:text-[#F0F0F0] hover:bg-[rgba(255,255,255,0.06)] transition-all">
                <ChevronLeft size={16} />
              </button>
              <button onClick={() => navigate(1)} className="p-1.5 rounded-lg text-[#606060] hover:text-[#F0F0F0] hover:bg-[rgba(255,255,255,0.06)] transition-all">
                <ChevronRight size={16} />
              </button>
            </div>
            <h1 className="text-base font-semibold text-[#F0F0F0]">{headerTitle()}</h1>
          </div>

          <div className="flex items-center gap-2">
            <div className="flex items-center bg-[#1A1A1A] rounded-lg border border-[rgba(255,255,255,0.06)] overflow-hidden">
              {(["month", "week", "day"] as ViewMode[]).map((v) => (
                <button
                  key={v}
                  onClick={() => setView(v)}
                  className={cn(
                    "px-3 py-1.5 text-xs font-medium transition-all capitalize",
                    view === v ? "bg-[#F7941D] text-white" : "text-[#606060] hover:text-[#F0F0F0] hover:bg-[rgba(255,255,255,0.04)]"
                  )}
                >
                  {v}
                </button>
              ))}
            </div>
            <motion.button
              whileHover={{ scale: 1.03 }}
              whileTap={{ scale: 0.97 }}
              onClick={() => openCreate()}
              className="flex items-center gap-1.5 px-4 py-1.5 rounded-lg text-sm font-medium bg-[#F7941D] text-white hover:bg-[#e8851a] transition-colors shadow-lg shadow-orange-500/20"
            >
              <Plus size={15} />
              Add Event
            </motion.button>
          </div>
        </div>

        {/* Calendar views */}
        <div className="flex-1 flex flex-col min-h-0 relative">
          <AnimatePresence mode="wait">
            <motion.div
              key={view}
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -6 }}
              transition={{ duration: 0.18 }}
              className="flex-1 flex flex-col min-h-0"
            >
              {view === "month" && (
                <MonthView
                  currentDate={currentDate}
                  events={visibleEvents}
                  sprints={sprints}
                  onDayClick={(day) => openCreate(day)}
                  onEventClick={handleEventClick}
                  onSprintClick={handleSprintClick}
                  onDayDrop={handleDrop}
                  draggingType={draggingType}
                />
              )}
              {view === "week" && (
                <WeekView
                  currentDate={currentDate}
                  events={visibleEvents}
                  sprints={sprints}
                  onSlotClick={(date) => openCreate(date)}
                  onEventClick={handleEventClick}
                  onSprintClick={handleSprintClick}
                  onSlotDrop={handleDrop}
                  draggingType={draggingType}
                />
              )}
              {view === "day" && (
                <DayView
                  currentDate={currentDate}
                  events={visibleEvents}
                  sprints={sprints}
                  onSlotClick={(date) => openCreate(date)}
                  onEventClick={handleEventClick}
                  onSprintClick={handleSprintClick}
                  onSlotDrop={handleDrop}
                  draggingType={draggingType}
                />
              )}
            </motion.div>
          </AnimatePresence>

          {/* Event detail popover */}
          <AnimatePresence>
            {popoverEvent && popoverPos && (
              <>
                <div className="fixed inset-0 z-40" onClick={() => setPopoverEvent(null)} />
                <div
                  className="fixed z-50"
                  style={{ left: Math.min(popoverPos.x, window.innerWidth - 300), top: Math.min(popoverPos.y, window.innerHeight - 320) }}
                >
                  <EventDetailPopover
                    event={popoverEvent}
                    onEdit={() => {
                      const source = events.find((event) => event.id === popoverEvent.sourceEventId);
                      if (source) openEdit(source);
                    }}
                    onDelete={handleDeleteFromPopover}
                    onClose={() => setPopoverEvent(null)}
                  />
                </div>
              </>
            )}
          </AnimatePresence>

          {/* Sprint detail popover */}
          <AnimatePresence>
            {popoverSprint && sprintPopoverPos && (
              <>
                <div className="fixed inset-0 z-40" onClick={() => setPopoverSprint(null)} />
                <div
                  className="fixed z-50"
                  style={{ left: Math.min(sprintPopoverPos.x, window.innerWidth - 300), top: Math.min(sprintPopoverPos.y, window.innerHeight - 340) }}
                >
                  <SprintPopover sprint={popoverSprint} onClose={() => setPopoverSprint(null)} />
                </div>
              </>
            )}
          </AnimatePresence>
        </div>
      </div>

      {/* ── Add/Edit Modal ──────────────────────────────────────────────── */}
      <EventModal
        open={modalOpen}
        onClose={() => { setModalOpen(false); setEditingEvent(null); }}
        onSave={handleSave}
        onDelete={editingEvent ? handleDelete : undefined}
        initial={editingEvent ?? undefined}
        prefillDate={prefillDate}
        prefillType={prefillType}
      />
    </div>
  );
}
