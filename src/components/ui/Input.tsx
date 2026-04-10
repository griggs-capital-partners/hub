"use client";

import { cn } from "@/lib/utils";
import { forwardRef } from "react";

interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  icon?: React.ReactNode;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ label, error, icon, className, ...props }, ref) => {
    return (
      <div className="flex flex-col gap-1.5">
        {label && (
          <label className="text-xs font-medium text-[#9A9A9A] uppercase tracking-wider">
            {label}
          </label>
        )}
        <div className="relative">
          {icon && (
            <div className="absolute left-3 top-1/2 -translate-y-1/2 text-[#606060]">
              {icon}
            </div>
          )}
          <input
            ref={ref}
            className={cn(
              "w-full bg-[#222222] border border-[rgba(255,255,255,0.08)] rounded-lg",
              "px-3 py-2 text-sm text-[#F0F0F0] placeholder:text-[#606060]",
              "focus:outline-none focus:border-[#F7941D] focus:ring-1 focus:ring-[rgba(247,148,29,0.2)]",
              "transition-all duration-200",
              icon && "pl-9",
              error && "border-[#EF4444]",
              className
            )}
            {...props}
          />
        </div>
        {error && <p className="text-xs text-[#EF4444]">{error}</p>}
      </div>
    );
  }
);
Input.displayName = "Input";

interface TextareaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: string;
  error?: string;
}

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(
  ({ label, error, className, ...props }, ref) => {
    return (
      <div className="flex flex-col gap-1.5">
        {label && (
          <label className="text-xs font-medium text-[#9A9A9A] uppercase tracking-wider">
            {label}
          </label>
        )}
        <textarea
          ref={ref}
          className={cn(
            "w-full bg-[#222222] border border-[rgba(255,255,255,0.08)] rounded-lg",
            "px-3 py-2 text-sm text-[#F0F0F0] placeholder:text-[#606060]",
            "focus:outline-none focus:border-[#F7941D] focus:ring-1 focus:ring-[rgba(247,148,29,0.2)]",
            "transition-all duration-200 resize-none",
            error && "border-[#EF4444]",
            className
          )}
          rows={4}
          {...props}
        />
        {error && <p className="text-xs text-[#EF4444]">{error}</p>}
      </div>
    );
  }
);
Textarea.displayName = "Textarea";
