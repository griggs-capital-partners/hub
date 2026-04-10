"use client";

import { usePathname } from "next/navigation";
import Link from "next/link";
import { Settings, Users, Plug2, Bell, Shield, Bot } from "lucide-react";
import { cn } from "@/lib/utils";

const NAV_ITEMS = [
  { href: "/settings", label: "General", icon: Settings, exact: true },
  { href: "/settings/team", label: "Team", icon: Users },
  { href: "/settings/agents", label: "Agents", icon: Bot },
  { href: "/settings/integrations", label: "Integrations", icon: Plug2 },
  { href: "/settings/notifications", label: "Notifications", icon: Bell },
  { href: "/settings/security", label: "Security", icon: Shield },
];

export default function SettingsLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  return (
    <div className="-m-4 md:-m-6 flex min-h-screen">
      {/* ── Left sidebar (desktop) ─────────────────────────────────── */}
      <aside className="hidden md:flex w-[220px] flex-shrink-0 flex-col border-r border-[rgba(255,255,255,0.06)]">
        <div className="px-5 pt-7 pb-5">
          <div className="flex items-center gap-2.5">
            <Settings size={17} className="text-[#F7941D]" />
            <span className="text-[15px] font-bold text-[#F0F0F0] tracking-tight">Settings</span>
          </div>
          <p className="text-xs text-[#4A4A4A] mt-1 leading-tight">Hub configuration &amp; preferences</p>
        </div>

        <div className="px-3 mb-3">
          <div className="h-px bg-[rgba(255,255,255,0.05)]" />
        </div>

        <nav className="flex-1 px-2 space-y-0.5">
          {NAV_ITEMS.map((item) => {
            const isActive = item.exact
              ? pathname === item.href
              : pathname.startsWith(item.href);
            return (
              <Link key={item.href} href={item.href}>
                <div
                  className={cn(
                    "flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-all duration-150 select-none",
                    isActive
                      ? "bg-[rgba(247,148,29,0.1)] text-[#F7941D] font-semibold"
                      : "text-[#707070] hover:text-[#D0D0D0] hover:bg-[rgba(255,255,255,0.04)] font-medium"
                  )}
                >
                  <item.icon
                    size={14}
                    className={isActive ? "text-[#F7941D]" : "text-[#505050]"}
                  />
                  {item.label}
                </div>
              </Link>
            );
          })}
        </nav>

        <div className="px-5 py-5">
          <p className="text-[10px] text-[#303030] uppercase tracking-widest font-semibold">SmartHub</p>
        </div>
      </aside>

      {/* ── Mobile top nav ──────────────────────────────────────────── */}
      <div className="md:hidden w-full">
        <div className="flex flex-col">
          {/* Mobile tab row */}
          <div className="flex gap-1 px-3 py-3 border-b border-[rgba(255,255,255,0.06)] overflow-x-auto no-scrollbar">
            {NAV_ITEMS.map((item) => {
              const isActive = item.exact
                ? pathname === item.href
                : pathname.startsWith(item.href);
              return (
                <Link key={item.href} href={item.href} className="flex-shrink-0">
                  <div
                    className={cn(
                      "flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all whitespace-nowrap",
                      isActive
                        ? "bg-[rgba(247,148,29,0.12)] text-[#F7941D]"
                        : "text-[#707070] hover:text-[#D0D0D0]"
                    )}
                  >
                    <item.icon size={12} />
                    {item.label}
                  </div>
                </Link>
              );
            })}
          </div>

          {/* Mobile content */}
          <div className="p-4">{children}</div>
        </div>
      </div>

      {/* ── Content (desktop) ──────────────────────────────────────── */}
      <div className="hidden md:block flex-1 overflow-y-auto">
        <div className="px-8 py-8">{children}</div>
      </div>
    </div>
  );
}
