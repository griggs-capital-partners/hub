import Link from "next/link";
import { Shield, KeyRound, LogOut, Eye, ArrowRight } from "lucide-react";

const SECURITY_ROWS = [
  {
    icon: KeyRound,
    label: "Password",
    description: "Change your password from your profile page.",
    badge: "Available",
    href: "/profile",
  },
  {
    icon: Eye,
    label: "Active Sessions",
    description: "View and revoke devices signed into your account.",
    badge: "Coming soon",
  },
  {
    icon: LogOut,
    label: "Sign Out Everywhere",
    description: "Invalidate all sessions across every device.",
    badge: "Coming soon",
  },
];

export default function SecuritySettingsPage() {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-bold text-[#F0F0F0] flex items-center gap-2.5">
          <Shield size={17} className="text-[#F7941D]" />
          Security
        </h2>
        <p className="text-sm text-[#505050] mt-1">
          Manage your account security and active sessions.
        </p>
      </div>

      <div className="rounded-xl border border-[rgba(255,255,255,0.06)] overflow-hidden divide-y divide-[rgba(255,255,255,0.04)]">
        {SECURITY_ROWS.map((row) => (
          <div
            key={row.label}
            className="flex items-center gap-4 px-5 py-4 bg-[#111111]"
          >
            <div className="w-8 h-8 rounded-lg bg-[#1A1A1A] flex items-center justify-center flex-shrink-0">
              <row.icon size={14} className="text-[#505050]" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-sm font-medium text-[#D0D0D0]">{row.label}</div>
              <div className="text-xs text-[#505050] mt-0.5">{row.description}</div>
            </div>
            {row.href ? (
              <Link
                href={row.href}
                className="inline-flex items-center gap-1 text-xs font-semibold text-[#F7941D] transition-colors hover:text-[#FBBA00] flex-shrink-0"
              >
                Open
                <ArrowRight size={12} />
              </Link>
            ) : (
              <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-[rgba(255,255,255,0.05)] text-[#404040] uppercase tracking-wider flex-shrink-0">
                {row.badge}
              </span>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
