"use client";

import Image from "next/image";
import { cn, getInitials } from "@/lib/utils";

interface AvatarProps {
  src?: string | null;
  name?: string | null;
  size?: "xs" | "sm" | "md" | "lg";
  className?: string;
}

const sizes = {
  xs: { px: 24, text: "text-xs" },
  sm: { px: 32, text: "text-sm" },
  md: { px: 40, text: "text-base" },
  lg: { px: 56, text: "text-lg" },
};

export function Avatar({ src, name, size = "md", className }: AvatarProps) {
  const { px, text } = sizes[size];
  const initials = name ? getInitials(name) : "?";

  return (
    <div
      className={cn(
        "relative rounded-full overflow-hidden flex items-center justify-center flex-shrink-0",
        "bg-gradient-to-br from-[#F7941D] to-[#7B1C24]",
        text,
        className
      )}
      style={{ width: px, height: px }}
    >
      {src ? (
        <Image src={src} alt={name ?? "User"} fill className="object-cover" />
      ) : (
        <span className="font-bold text-white">{initials}</span>
      )}
    </div>
  );
}
