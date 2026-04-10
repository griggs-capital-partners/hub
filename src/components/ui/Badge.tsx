"use client";

import { cn } from "@/lib/utils";

interface BadgeProps {
  children: React.ReactNode;
  color?: string;
  bg?: string;
  className?: string;
  size?: "sm" | "md";
}

export function Badge({ children, color, bg, className, size = "md" }: BadgeProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center font-medium rounded-full",
        size === "sm" ? "px-2 py-0.5 text-xs" : "px-2.5 py-1 text-xs",
        className
      )}
      style={{
        color: color ?? "#F0F0F0",
        backgroundColor: bg ?? "rgba(255,255,255,0.1)",
      }}
    >
      {children}
    </span>
  );
}

export function PriorityBadge({
  priority,
  compact = false,
}: {
  priority: string;
  compact?: boolean;
}) {
  const configs = {
    critical: { label: "Critical", color: "#EF4444", bg: "rgba(239,68,68,0.15)" },
    high: { label: "High", color: "#F97316", bg: "rgba(249,115,22,0.15)" },
    medium: { label: "Medium", color: "#FBBA00", bg: "rgba(251,186,0,0.15)" },
    low: { label: "Low", color: "#22C55E", bg: "rgba(34,197,94,0.15)" },
  };
  const config = configs[priority as keyof typeof configs] ?? configs.medium;
  if (compact) {
    return (
      <span
        className="inline-flex items-center gap-1 rounded-full border px-1.5 py-0.5 text-[10px] font-medium leading-none"
        style={{
          color: "#C8C8C8",
          borderColor: "rgba(255,255,255,0.08)",
          backgroundColor: "rgba(255,255,255,0.03)",
        }}
      >
        <span
          className="h-1.5 w-1.5 rounded-full"
          style={{ backgroundColor: config.color, boxShadow: `0 0 10px ${config.color}55` }}
        />
        {config.label}
      </span>
    );
  }

  return <Badge color={config.color} bg={config.bg}>{config.label}</Badge>;
}
