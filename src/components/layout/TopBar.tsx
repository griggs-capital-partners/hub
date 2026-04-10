"use client";

import { useState } from "react";
import { Bell, Menu, LogOut, User } from "lucide-react";
import { useMobileNav } from "@/components/layout/MobileNav";
import { Avatar } from "@/components/ui/Avatar";
import { authClient } from "@/lib/auth-client";
import { motion, AnimatePresence } from "framer-motion";
import Link from "next/link";

export function TopBar() {
  const [hasNotifications] = useState(true);
  const [isProfileOpen, setIsProfileOpen] = useState(false);
  const { toggle } = useMobileNav();
  const session = authClient.useSession();
  const user = session.data?.user;

  async function handleSignOut() {
    await authClient.signOut();
    window.location.href = "/login";
  }

  return (
    <header className="relative h-16 flex items-center justify-between px-4 md:px-6 border-b border-[rgba(255,255,255,0.06)] flex-shrink-0 bg-[#0D0D0D] z-20">
      <div className="flex items-center gap-3">
        {/* Hamburger — mobile only */}
        <button
          onClick={toggle}
          className="md:hidden p-2 text-[#9A9A9A] hover:text-[#F0F0F0] hover:bg-[rgba(255,255,255,0.06)] rounded-lg transition-all"
          aria-label="Open menu"
        >
          <Menu size={20} />
        </button>

        <div>

        </div>
      </div>

      <div className="flex items-center gap-3">
        {/* Notifications */}
        <button className="relative p-2 text-[#9A9A9A] hover:text-[#F0F0F0] hover:bg-[rgba(255,255,255,0.05)] rounded-lg transition-all">
          <Bell size={18} />
          {hasNotifications && (
            <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-[#F7941D] rounded-full animate-pulse" />
          )}
        </button>

        {/* User Profile Dropdown */}
        {user && (
          <div className="relative">
            <button
              onClick={() => setIsProfileOpen(!isProfileOpen)}
              className="flex flex-col items-center gap-1 py-1 px-3 hover:bg-[rgba(255,255,255,0.05)] rounded-lg transition-all group"
            >
              <div className="flex items-center gap-1.5">
                <Avatar src={user.image} name={user.name} size="sm" className="border border-[rgba(255,255,255,0.08)] group-hover:border-[#F7941D]/40 transition-colors" />
                {/* <ChevronDown 
                  size={12} 
                  className={cn(
                    "text-[#606060] transition-transform duration-200",
                    isProfileOpen && "rotate-180"
                  )} 
                /> */}
              </div>
              <div className="text-[10px] font-black text-[#606060] group-hover:text-[#F0F0F0] leading-none uppercase tracking-widest hidden sm:block">
                {user.name?.split(' ')[0]}
              </div>
            </button>

            <AnimatePresence>
              {isProfileOpen && (
                <>
                  {/* Backdrop for closing */}
                  <div
                    className="fixed inset-0 z-40"
                    onClick={() => setIsProfileOpen(false)}
                  />
                  <motion.div
                    initial={{ opacity: 0, y: 10, scale: 0.95 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: 10, scale: 0.95 }}
                    transition={{ duration: 0.2, ease: "easeOut" }}
                    className="absolute right-0 mt-2 w-48 bg-[#1A1A1A] border border-[rgba(255,255,255,0.08)] rounded-xl shadow-2xl z-50 overflow-hidden py-1.5 backdrop-blur-md"
                  >
                    <div className="px-3 py-2 border-b border-[rgba(255,255,255,0.06)] mb-1 sm:hidden">
                      <div className="text-sm font-semibold text-[#F0F0F0] truncate">{user.name}</div>
                      <div className="text-xs text-[#606060] truncate">{user.email}</div>
                    </div>

                    <Link
                      href="/profile"
                      onClick={() => setIsProfileOpen(false)}
                      className="flex items-center gap-2.5 px-3 py-2 text-sm text-[#9A9A9A] hover:text-[#F0F0F0] hover:bg-[rgba(255,255,255,0.04)] transition-all mx-1.5 rounded-lg"
                    >
                      <User size={16} />
                      <span>Profile</span>
                    </Link>

                    <button
                      onClick={() => {
                        setIsProfileOpen(false);
                        handleSignOut();
                      }}
                      className="flex items-center gap-2.5 w-full px-3 py-2 text-sm text-[#9A9A9A] hover:text-[#EF4444] hover:bg-[rgba(239,68,68,0.08)] transition-all mt-0.5 border-t border-[rgba(255,255,255,0.04)]"
                    >
                      <LogOut size={16} />
                      <span>Logout</span>
                    </button>
                  </motion.div>
                </>
              )}
            </AnimatePresence>
          </div>
        )}
      </div>
    </header>
  );
}
