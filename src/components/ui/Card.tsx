"use client";

import { cn } from "@/lib/utils";
import { motion } from "framer-motion";

interface CardProps {
  children: React.ReactNode;
  className?: string;
  hover?: boolean;
  glow?: boolean;
  onClick?: () => void;
}

export function Card({ children, className, hover = false, glow = false, onClick }: CardProps) {
  const baseClass = cn(
    "bg-[#1A1A1A] border border-[rgba(255,255,255,0.07)] rounded-xl",
    glow && "shadow-[0_0_20px_rgba(247,148,29,0.1)]",
    onClick && "cursor-pointer",
    className
  );

  if (hover || onClick) {
    return (
      <motion.div
        className={baseClass}
        onClick={onClick}
        whileHover={{ y: -2, boxShadow: "0 8px 30px rgba(0,0,0,0.6), 0 0 0 1px rgba(247,148,29,0.15)" }}
        transition={{ duration: 0.2 }}
      >
        {children}
      </motion.div>
    );
  }

  return <div className={baseClass}>{children}</div>;
}

export function CardHeader({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={cn("px-5 py-4 border-b border-[rgba(255,255,255,0.06)]", className)}>
      {children}
    </div>
  );
}

export function CardBody({ children, className }: { children: React.ReactNode; className?: string }) {
  return <div className={cn("p-5", className)}>{children}</div>;
}
