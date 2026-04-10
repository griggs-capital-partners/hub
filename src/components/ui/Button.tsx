"use client";

import { cn } from "@/lib/utils";
import { motion } from "framer-motion";
import { Loader2 } from "lucide-react";

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "primary" | "secondary" | "ghost" | "danger" | "outline";
  size?: "sm" | "md" | "lg";
  loading?: boolean;
  icon?: React.ReactNode;
}

export function Button({
  children,
  variant = "primary",
  size = "md",
  loading,
  icon,
  className,
  disabled,
  ...props
}: ButtonProps) {
  const variants = {
    primary:
      "bg-gradient-to-r from-[#F7941D] to-[#FBBA00] text-[#0D0D0D] font-semibold hover:opacity-90 shadow-[0_0_20px_rgba(247,148,29,0.3)]",
    secondary:
      "bg-[#222222] text-[#F0F0F0] hover:bg-[#2A2A2A] border border-[rgba(255,255,255,0.08)] hover:border-[rgba(247,148,29,0.3)]",
    ghost:
      "text-[#9A9A9A] hover:text-[#F0F0F0] hover:bg-[rgba(255,255,255,0.05)]",
    danger:
      "bg-[rgba(239,68,68,0.15)] text-[#EF4444] hover:bg-[rgba(239,68,68,0.25)] border border-[rgba(239,68,68,0.2)]",
    outline:
      "bg-transparent border border-[rgba(247,148,29,0.3)] text-[#F7941D] hover:bg-[rgba(247,148,29,0.08)]",
  };

  const sizes = {
    sm: "px-3 py-1.5 text-xs gap-1.5",
    md: "px-4 py-2 text-sm gap-2",
    lg: "px-6 py-3 text-base gap-2.5",
  };

  return (
    <motion.button
      whileTap={{ scale: 0.97 }}
      className={cn(
        "inline-flex items-center justify-center rounded-lg transition-all duration-200 cursor-pointer select-none",
        variants[variant],
        sizes[size],
        (disabled || loading) && "opacity-50 pointer-events-none",
        className
      )}
      disabled={disabled || loading}
      {...(props as React.ComponentProps<typeof motion.button>)}
    >
      {loading ? <Loader2 className="animate-spin" size={size === "sm" ? 12 : 14} /> : icon}
      {children}
    </motion.button>
  );
}
