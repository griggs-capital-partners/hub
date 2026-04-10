import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";
import { formatDistanceToNow, format } from "date-fns";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function timeAgo(date: Date | string) {
  return formatDistanceToNow(new Date(date), { addSuffix: true });
}

export function formatDate(date: Date | string) {
  return format(new Date(date), "MMM d, yyyy");
}

export function formatDateTime(date: Date | string) {
  return format(new Date(date), "MMM d, yyyy 'at' h:mm a");
}

export function getInitials(name: string) {
  return name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);
}

export const PRIORITY_CONFIG = {
  critical: { label: "Critical", color: "#EF4444", bg: "rgba(239,68,68,0.15)" },
  high: { label: "High", color: "#F97316", bg: "rgba(249,115,22,0.15)" },
  medium: { label: "Medium", color: "#FBBA00", bg: "rgba(251,186,0,0.15)" },
  low: { label: "Low", color: "#22C55E", bg: "rgba(34,197,94,0.15)" },
} as const;

export const STATUS_CONFIG = {
  active: { label: "Active", color: "#22C55E", bg: "rgba(34,197,94,0.15)" },
  "at-risk": { label: "At Risk", color: "#F97316", bg: "rgba(249,115,22,0.15)" },
  churned: { label: "Churned", color: "#EF4444", bg: "rgba(239,68,68,0.15)" },
  prospect: { label: "Prospect", color: "#3B82F6", bg: "rgba(59,130,246,0.15)" },
  inactive: { label: "Inactive", color: "#606060", bg: "rgba(96,96,96,0.15)" },
} as const;

export const TIER_CONFIG = {
  enterprise: { label: "Enterprise", color: "#F7941D", bg: "rgba(247,148,29,0.15)" },
  standard: { label: "Standard", color: "#3B82F6", bg: "rgba(59,130,246,0.15)" },
  startup: { label: "Startup", color: "#A855F7", bg: "rgba(168,85,247,0.15)" },
} as const;

// Health score 1–5: displayed as colored dots / emoji
export const HEALTH_CONFIG: Record<number, { label: string; color: string; emoji: string }> = {
  1: { label: "Critical", color: "#EF4444", emoji: "🔴" },
  2: { label: "Struggling", color: "#F97316", emoji: "🟠" },
  3: { label: "Neutral", color: "#FBBA00", emoji: "🟡" },
  4: { label: "Healthy", color: "#22C55E", emoji: "🟢" },
  5: { label: "Thriving", color: "#3B82F6", emoji: "🔵" },
};

export const NOTE_TYPE_CONFIG = {
  general: { label: "Note", color: "#9A9A9A", bg: "rgba(154,154,154,0.1)" },
  "feature-request": { label: "Feature Request", color: "#F7941D", bg: "rgba(247,148,29,0.1)" },
  issue: { label: "Issue", color: "#EF4444", bg: "rgba(239,68,68,0.1)" },
  meeting: { label: "Meeting", color: "#3B82F6", bg: "rgba(59,130,246,0.1)" },
} as const;

export const LANGUAGE_COLORS: Record<string, string> = {
  TypeScript: "#3178C6",
  JavaScript: "#F7DF1E",
  Python: "#3776AB",
  Rust: "#DEA584",
  Go: "#00ADD8",
  Java: "#B07219",
  "C#": "#178600",
  "C++": "#F34B7D",
  Swift: "#F05138",
  Kotlin: "#A97BFF",
  Ruby: "#CC342D",
  PHP: "#4F5D95",
};
