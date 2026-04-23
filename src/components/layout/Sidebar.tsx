"use client";

import { useState, useEffect } from "react";
import { usePathname } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import { motion, AnimatePresence } from "framer-motion";
import { authClient } from "@/lib/auth-client";
import {
  LayoutDashboard,
  MessageSquare,
  FolderGit2,
  Users,
  Settings,
  ChevronLeft,
  LogOut,
  Bell,
  Plug2,
  X,
  BookOpen,
  Library,
  Columns3,
  Zap,
  Wrench,
  Radio,
  Globe,
  ChevronDown,
  User,
  Menu,
  Bot,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Avatar } from "@/components/ui/Avatar";
import { useMobileNav } from "@/components/layout/MobileNav";
import { useDesktopSidebar } from "@/components/layout/DesktopSidebarContext";

// ─── Nav items ────────────────────────────────────────────────────────────────

const NAV_ITEMS = [
  {
    href: "/dashboard",
    icon: LayoutDashboard,
    label: "Home",
    description: "Today's focus & overview",
  },
  {
    href: "/chat",
    icon: MessageSquare,
    label: "Chat",
    description: "Threads & team context",
  },
  {
    href: "/knowledge",
    icon: Library,
    label: "Knowledge",
    description: "Docs & knowledge base",
  },
  {
    href: "/agents",
    icon: Bot,
    label: "Agents",
    description: "AI execution layer",
    accent: "#4B9CD3",
    activeBg: "rgba(75,156,211,0.14)",
  },
  {
    href: "/planner",
    icon: Columns3,
    label: "Planner",
    description: "Global task board",
  },
  //  {
  //   href: "/sprints",
  //   icon: Zap,
  //   label: "Sprints",
  //   description: "Active sprints & tasks",
  // },
  // {
  //   href: "/calendar",
  //   icon: CalendarDays,
  //   label: "Calendar",
  //   description: "Events, meetings & milestones",
  // },
  {
    href: "/repos",
    icon: FolderGit2,
    label: "Codebase",
    description: "Repos & systems",
  },

  // {
  //   href: "/chat",
  //   icon: UsersRound,
  //   label: "Team Chat",
  //   description: "Messages & team",
  // },

  {
    href: "/wells",
    icon: Users,
    label: "Oil Wells",
    description: "Well tracking & docs",
  },



  {
    href: "/weekly-notes",
    icon: BookOpen,
    label: "Weekly Notes",
    description: "Team status",
  },

];

// ─── Custom page icon resolver ────────────────────────────────────────────────

const ICON_MAP: Record<string, React.ElementType> = {
  Radio,
  Globe,
  Wrench,
  Zap,
  Plug2,
};

function resolveIcon(name: string): React.ElementType {
  return ICON_MAP[name] ?? Globe;
}

// ─── Custom pages (Tools section) ─────────────────────────────────────────────

interface CustomPage {
  id: string;
  name: string;
  slug: string;
  icon: string;
  description: string | null;
}

function useCustomPages(): CustomPage[] {
  const [pages, setPages] = useState<CustomPage[]>([]);

  useEffect(() => {
    fetch("/api/custom-pages")
      .then((r) => r.json())
      .then((data) => Array.isArray(data) && setPages(data))
      .catch(() => { });
  }, []);

  return pages;
}

// ─── Shared nav link renderer ─────────────────────────────────────────────────

function NavLinks({
  collapsed,
  pathname,
  customPages,
  onNavigate,
}: {
  collapsed: boolean;
  pathname: string;
  customPages: CustomPage[];
  onNavigate?: () => void;
}) {
  const isToolsRoute = customPages.some((p) => pathname.startsWith("/mqtt-portal") || pathname.startsWith(`/pages/${p.slug}`));
  const [toolsOpen, setToolsOpen] = useState(isToolsRoute);
  const toolsSectionOpen = toolsOpen || isToolsRoute;

  return (
    <>
      {NAV_ITEMS.map((item) => {
        const isActive = pathname.startsWith(item.href);
        const Icon = item.icon;
        const accent = item.accent ?? "#F7941D";

        return (
          <Link key={item.href} href={item.href} onClick={onNavigate}>
            <motion.div
              whileHover={!isActive ? { backgroundColor: "rgba(255,255,255,0.05)" } : undefined}
              className={cn(
                "relative flex items-center gap-3 px-3 py-2 rounded-xl transition-colors duration-200 group cursor-pointer",
                isActive ? "text-[#F0F0F0]" : "text-[#7A7A7A] hover:text-[#C8C8C8]"
              )}
              style={isActive ? {
                background: `linear-gradient(108deg, ${accent}26 0%, ${accent}0d 45%, transparent 100%)`,
                color: accent,
              } : undefined}
            >
              {/* Glowing left bar */}
              {isActive && (
                <motion.div
                  layoutId="nav-active"
                  className="absolute left-0 top-1/2 -translate-y-1/2 rounded-r-full"
                  style={{
                    width: 3,
                    height: 24,
                    backgroundColor: accent,
                    boxShadow: `0 0 10px 1px ${accent}cc, 0 0 24px 2px ${accent}55`,
                  }}
                />
              )}

              {/* Icon container */}
              <div
                className={cn(
                  "relative flex-shrink-0 w-7 h-7 flex items-center justify-center rounded-lg transition-all duration-200",
                  isActive
                    ? "shadow-[inset_0_1px_0_rgba(255,255,255,0.1)]"
                    : ""
                )}
                style={isActive ? {
                  background: `rgba(255,255,255,0.08)`,
                  boxShadow: `inset 0 1px 0 rgba(255,255,255,0.1), 0 0 12px ${accent}30`,
                } : undefined}
              >
                <Icon size={15} />
              </div>

              <AnimatePresence>
                {!collapsed && (
                  <motion.div
                    initial={{ opacity: 0, width: 0 }}
                    animate={{ opacity: 1, width: "auto" }}
                    exit={{ opacity: 0, width: 0 }}
                    className="overflow-hidden flex-1 min-w-0"
                  >
                    <span className={cn(
                      "text-[13.5px] truncate block leading-none",
                      isActive ? "font-semibold" : "font-medium"
                    )}>
                      {item.label}
                    </span>
                    {!isActive && (
                      <span className="text-[10.5px] truncate block leading-none mt-1 text-[#4A4A4A] group-hover:text-[#666666] transition-colors">
                        {item.description}
                      </span>
                    )}
                  </motion.div>
                )}
              </AnimatePresence>

              {collapsed && (
                <div className="absolute left-full ml-3 px-2.5 py-1.5 bg-[#1C1C1C] text-[#E0E0E0] text-xs rounded-lg whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-50 border border-[rgba(255,255,255,0.08)] shadow-xl">
                  {item.label}
                </div>
              )}
            </motion.div>
          </Link>
        );
      })}

      {/* ── Tools section ───────────────────────────────────────────────── */}
      {customPages.length > 0 && (
        <div className="pt-1">
          {!collapsed && (
            <button
              onClick={() => setToolsOpen((o) => !o)}
              className="w-full flex items-center gap-3 px-3 py-2 rounded-lg text-[#606060] hover:text-[#9A9A9A] hover:bg-[rgba(255,255,255,0.03)] transition-all duration-200"
            >
              <Wrench size={15} className="flex-shrink-0" />
              <span className="text-xs font-semibold uppercase tracking-wider flex-1 text-left">Tools</span>
              <motion.div animate={{ rotate: toolsSectionOpen ? 180 : 0 }} transition={{ duration: 0.2 }}>
                <ChevronDown size={13} />
              </motion.div>
            </button>
          )}

          <AnimatePresence initial={false}>
            {(toolsSectionOpen || collapsed) && (
              <motion.div
                key="tools"
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: "auto", opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                transition={{ duration: 0.2 }}
                className="overflow-hidden"
              >
                <div className={cn("space-y-0.5", !collapsed && "pl-2 mt-0.5")}>
                  {customPages.map((page) => {
                    const href = page.slug === "mqtt-portal" ? "/mqtt-portal" : `/pages/${page.slug}`;
                    const isActive = pathname.startsWith(href);
                    const Icon = resolveIcon(page.icon);

                    return (
                      <Link key={page.id} href={href} onClick={onNavigate}>
                        <motion.div
                          whileHover={!isActive ? { backgroundColor: "rgba(255,255,255,0.04)" } : undefined}
                          className={cn(
                            "relative flex items-center gap-3 px-3 py-1.5 rounded-xl transition-colors duration-200 group cursor-pointer",
                            isActive
                              ? "text-[#F7941D]"
                              : "text-[#4A4A4A] hover:text-[#B0B0B0]"
                          )}
                          style={isActive ? {
                            background: "linear-gradient(108deg, rgba(247,148,29,0.18) 0%, rgba(247,148,29,0.06) 50%, transparent 100%)",
                          } : undefined}
                        >
                          {isActive && (
                            <div
                              className="absolute left-0 top-1/2 -translate-y-1/2 rounded-r-full"
                              style={{
                                width: 3,
                                height: 18,
                                backgroundColor: "#F7941D",
                                boxShadow: "0 0 10px 1px #F7941Dcc, 0 0 24px 2px #F7941D55",
                              }}
                            />
                          )}
                          <div
                            className={cn(
                              "relative flex-shrink-0 w-6 h-6 flex items-center justify-center rounded-md transition-all duration-200",
                              isActive ? "" : "group-hover:bg-[rgba(255,255,255,0.05)]"
                            )}
                            style={isActive ? { background: "rgba(255,255,255,0.07)" } : undefined}
                          >
                            <Icon size={14} />
                          </div>
                          <AnimatePresence>
                            {!collapsed && (
                              <motion.span
                                initial={{ opacity: 0, width: 0 }}
                                animate={{ opacity: 1, width: "auto" }}
                                exit={{ opacity: 0, width: 0 }}
                                className="text-sm font-medium truncate overflow-hidden"
                              >
                                {page.name}
                              </motion.span>
                            )}
                          </AnimatePresence>
                          {collapsed && (
                            <div className="absolute left-full ml-2 px-2 py-1 bg-[#222222] text-[#F0F0F0] text-xs rounded-lg whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-50 border border-[rgba(255,255,255,0.08)]">
                              {page.name}
                            </div>
                          )}
                        </motion.div>
                      </Link>
                    );
                  })}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      )}
    </>
  );
}

// ─── Desktop Sidebar ──────────────────────────────────────────────────────────

function DesktopSidebar() {
  const { collapsed, collapseManually, expandManually } = useDesktopSidebar();
  const [isProfileOpen, setIsProfileOpen] = useState(false);
  const [hasNotifications] = useState(true);
  const pathname = usePathname();
  const session = authClient.useSession();
  const user = session.data?.user;
  const customPages = useCustomPages();

  async function handleSignOut() {
    await authClient.signOut();
    window.location.href = "/login";
  }

  return (
    <motion.aside
      initial={false}
      animate={{ width: collapsed ? 64 : 224 }}
      transition={{ duration: 0.3, ease: [0.4, 0, 0.2, 1] }}
      className="relative flex-shrink-0 flex flex-col h-screen bg-[#0D0D0D] border-r border-[rgba(255,255,255,0.06)] overflow-hidden hidden md:flex z-30 shadow-[6px_0_32px_rgba(0,0,0,0.55),2px_0_8px_rgba(0,0,0,0.35)]"
    >
      {/* Logo Area */}
      <div className="flex items-center justify-between h-16 px-3 border-b border-[rgba(255,255,255,0.06)] flex-shrink-0">
        <AnimatePresence mode="wait">
          {collapsed ? (
            <motion.button
              key="icon"
              initial={{ opacity: 0, scale: 0.85 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.85 }}
              onClick={expandManually}
              className="w-full flex items-center justify-center"
              title="Expand menu"
            >
              <Image src="/logo.png" alt="Griggs Hub" width={36} height={28} style={{ width: 36, height: 28 }} className="rounded-lg" />
            </motion.button>
          ) : (
            <motion.div
              key="logo"
              initial={{ opacity: 0, x: -6 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -6 }}
              className="flex items-center gap-3 min-w-0"
            >
              <Image src="/logo.png" alt="Griggs Hub" width={38} height={28} style={{ width: 38, height: 28 }} className="rounded-lg flex-shrink-0" />
              <div className="leading-tight min-w-0">
                <div className="text-sm font-black text-[#F7941D] tracking-widest uppercase leading-none">Griggs</div>
                <div className="text-sm font-black text-[#F0F0F0] tracking-widest uppercase leading-none mt-0.5">Hub</div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {!collapsed && (
          <button
            onClick={collapseManually}
            className="p-1.5 text-[#606060] hover:text-[#F7941D] hover:bg-[rgba(247,148,29,0.05)] rounded-lg transition-all flex-shrink-0 ml-1"
            title="Collapse menu"
          >
            <ChevronLeft size={16} />
          </button>
        )}
      </div>

      {/* Nav */}
      <nav className="flex-1 px-2 py-3 space-y-0.5 overflow-y-auto scrollbar-none">
        <NavLinks
          collapsed={collapsed}
          pathname={pathname}
          customPages={customPages}
        />
      </nav>

      {/* Bottom section */}

      {/* Settings */}
      <div className="px-2 py-2">
        <Link href="/settings">
          <div
            className={cn(
              "flex items-center gap-3 px-3 py-2.5 rounded-lg text-[#9A9A9A] hover:text-[#F0F0F0] hover:bg-[rgba(255,255,255,0.04)] transition-all duration-200 cursor-pointer",
              pathname.startsWith("/settings") && "text-[#F7941D] bg-[rgba(247,148,29,0.08)]"
            )}
          >
            <Settings size={18} className="flex-shrink-0" />
            {!collapsed && <span className="text-sm font-medium">Settings</span>}
          </div>
        </Link>
      </div>


      <div className="flex-shrink-0 border-t border-[rgba(255,255,255,0.06)]">
        {!collapsed && (
          <div className="px-3 py-2.5 flex justify-end border-b border-[rgba(255,255,255,0.04)]">
            <button className="relative p-1.5 text-[#9A9A9A] hover:text-[#F0F0F0] hover:bg-[rgba(255,255,255,0.05)] rounded-lg transition-all flex-shrink-0">
              <Bell size={16} />
              {hasNotifications && (
                <span className="absolute top-1 right-1 w-1.5 h-1.5 bg-[#F7941D] rounded-full animate-pulse" />
              )}
            </button>
          </div>
        )}

        {/* User profile */}
        {user && (
          <div className="px-2 pb-3 pt-1 border-t border-[rgba(255,255,255,0.04)] relative">
            <button
              onClick={() => setIsProfileOpen(!isProfileOpen)}
              className={cn(
                "w-full flex items-center gap-3 px-3 py-2.5 rounded-lg hover:bg-[rgba(255,255,255,0.04)] transition-all group",
                collapsed && "justify-center"
              )}
            >
              <Avatar
                src={user.image}
                name={user.name}
                size="sm"
                className="flex-shrink-0 border border-[rgba(255,255,255,0.08)] group-hover:border-[#F7941D]/40 transition-colors"
              />
              {!collapsed && (
                <div className="flex-1 min-w-0 text-left">
                  <div className="text-sm font-medium text-[#F0F0F0] truncate leading-tight">{user.name}</div>
                  <div className="text-xs text-[#606060] truncate leading-tight mt-0.5">{user.email}</div>
                </div>
              )}
            </button>

            <AnimatePresence>
              {isProfileOpen && (
                <>
                  <div className="fixed inset-0 z-40" onClick={() => setIsProfileOpen(false)} />
                  <motion.div
                    initial={{ opacity: 0, y: -8, scale: 0.95 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: -8, scale: 0.95 }}
                    transition={{ duration: 0.2, ease: "easeOut" }}
                    className="absolute bottom-full mb-2 left-2 right-2 bg-[#1A1A1A] border border-[rgba(255,255,255,0.08)] rounded-xl shadow-2xl z-50 overflow-hidden py-1.5"
                  >
                    <div className="px-3 py-2 border-b border-[rgba(255,255,255,0.06)] mb-1">
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
                      onClick={() => { setIsProfileOpen(false); handleSignOut(); }}
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
    </motion.aside>
  );
}

// ─── Mobile Menu Button ───────────────────────────────────────────────────────

export function MobileTopBar() {
  const { toggle } = useMobileNav();

  return (
    <div className="sticky top-0 z-30 border-b border-[rgba(255,255,255,0.06)] bg-[rgba(13,13,13,0.92)] backdrop-blur-xl md:hidden">
      <div className="flex items-center justify-between gap-3 px-4 py-3">
        <button
          onClick={toggle}
          className="flex h-10 w-10 items-center justify-center rounded-xl border border-[rgba(255,255,255,0.08)] bg-[rgba(255,255,255,0.03)] text-[#D0D0D0] transition-all hover:bg-[rgba(255,255,255,0.06)] hover:text-[#F0F0F0]"
          aria-label="Open menu"
        >
          <Menu size={18} />
        </button>

        <div className="flex min-w-0 items-center gap-2.5">
          <Image
            src="/logo.png"
            alt="Griggs Hub"
            width={28}
            height={28}
            className="rounded-md opacity-90"
          />
          <div className="leading-tight">
            <div className="text-[12px] font-black uppercase tracking-[0.24em] text-[#F7941D]">Griggs</div>
            <div className="text-[12px] font-black uppercase tracking-[0.24em] text-[#F0F0F0]">Hub</div>
          </div>
        </div>

        <div className="h-10 w-10 flex-shrink-0" aria-hidden="true" />
      </div>
    </div>
  );
}

// ─── Mobile Drawer ────────────────────────────────────────────────────────────

function MobileDrawer() {
  const { isOpen, close } = useMobileNav();
  const pathname = usePathname();
  const session = authClient.useSession();
  const user = session.data?.user;
  const customPages = useCustomPages();
  const [isProfileOpen, setIsProfileOpen] = useState(false);
  const [hasNotifications] = useState(true);

  async function handleSignOut() {
    await authClient.signOut();
    close();
    window.location.href = "/login";
  }

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          <motion.div
            key="backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            onClick={close}
            className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm md:hidden"
          />

          <motion.aside
            key="drawer"
            initial={{ x: "-100%" }}
            animate={{ x: 0 }}
            exit={{ x: "-100%" }}
            transition={{ duration: 0.28, ease: [0.32, 0.72, 0, 1] }}
            className="fixed inset-y-0 left-0 z-50 w-72 flex flex-col bg-[#111111] border-r border-[rgba(255,255,255,0.06)] md:hidden"
          >
            <div className="flex items-center justify-between h-16 px-4 border-b border-[rgba(255,255,255,0.06)] flex-shrink-0">
              <div className="flex items-center gap-2.5">
                <Image src="/logo.png" alt="Griggs Capital Partners" width={32} height={24} style={{ width: 32, height: 24 }} className="rounded" />
                <div className="leading-tight">
                  <div className="text-xs font-bold text-[#F7941D] tracking-widest uppercase">Griggs</div>
                  <div className="text-xs font-bold text-[#F0F0F0] tracking-widest uppercase">Hub</div>
                </div>
              </div>
              <button
                onClick={close}
                className="p-2 text-[#9A9A9A] hover:text-[#F0F0F0] hover:bg-[rgba(255,255,255,0.06)] rounded-lg transition-all"
                aria-label="Close menu"
              >
                <X size={18} />
              </button>
            </div>

            <nav className="flex-1 px-2 py-3 space-y-0.5 overflow-y-auto">
              <NavLinks
                collapsed={false}
                pathname={pathname}
                customPages={customPages}
                onNavigate={close}
              />
            </nav>

            <div className="flex-shrink-0 border-t border-[rgba(255,255,255,0.06)]">
              <div className="px-3 py-2.5 flex justify-end border-b border-[rgba(255,255,255,0.04)]">
                <button className="relative p-1.5 text-[#9A9A9A] hover:text-[#F0F0F0] hover:bg-[rgba(255,255,255,0.05)] rounded-lg transition-all flex-shrink-0">
                  <Bell size={16} />
                  {hasNotifications && (
                    <span className="absolute top-1 right-1 w-1.5 h-1.5 bg-[#F7941D] rounded-full animate-pulse" />
                  )}
                </button>
              </div>

              {/* Settings */}
              <div className="px-2 py-2">
                <Link href="/settings" onClick={close}>
                  <div
                    className={cn(
                      "flex items-center gap-3 px-3 py-2.5 rounded-lg text-[#9A9A9A] hover:text-[#F0F0F0] hover:bg-[rgba(255,255,255,0.04)] transition-all duration-200 cursor-pointer",
                      pathname.startsWith("/settings") && "text-[#F7941D] bg-[rgba(247,148,29,0.08)]"
                    )}
                  >
                    <Settings size={18} className="flex-shrink-0" />
                    <span className="text-sm font-medium">Settings</span>
                  </div>
                </Link>
              </div>

              {/* User profile */}
              {user && (
                <div className="px-2 pb-3 pt-1 border-t border-[rgba(255,255,255,0.04)] relative">
                  <button
                    onClick={() => setIsProfileOpen(!isProfileOpen)}
                    className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg hover:bg-[rgba(255,255,255,0.04)] transition-all group"
                  >
                    <Avatar
                      src={user.image}
                      name={user.name}
                      size="sm"
                      className="flex-shrink-0 border border-[rgba(255,255,255,0.08)] group-hover:border-[#F7941D]/40 transition-colors"
                    />
                    <div className="flex-1 min-w-0 text-left">
                      <div className="text-sm font-medium text-[#F0F0F0] truncate leading-tight">{user.name}</div>
                      <div className="text-xs text-[#606060] truncate leading-tight mt-0.5">{user.email}</div>
                    </div>
                  </button>

                  <AnimatePresence>
                    {isProfileOpen && (
                      <>
                        <div className="fixed inset-0 z-40" onClick={() => setIsProfileOpen(false)} />
                        <motion.div
                          initial={{ opacity: 0, y: -8, scale: 0.95 }}
                          animate={{ opacity: 1, y: 0, scale: 1 }}
                          exit={{ opacity: 0, y: -8, scale: 0.95 }}
                          transition={{ duration: 0.2, ease: "easeOut" }}
                          className="absolute bottom-full mb-2 left-2 right-2 bg-[#1A1A1A] border border-[rgba(255,255,255,0.08)] rounded-xl shadow-2xl z-50 overflow-hidden py-1.5"
                        >
                          <Link
                            href="/profile"
                            onClick={() => { setIsProfileOpen(false); close(); }}
                            className="flex items-center gap-2.5 px-3 py-2 text-sm text-[#9A9A9A] hover:text-[#F0F0F0] hover:bg-[rgba(255,255,255,0.04)] transition-all mx-1.5 rounded-lg"
                          >
                            <User size={16} />
                            <span>Profile</span>
                          </Link>

                          <button
                            onClick={() => { setIsProfileOpen(false); handleSignOut(); }}
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
          </motion.aside>
        </>
      )}
    </AnimatePresence>
  );
}

// ─── Exported composite ───────────────────────────────────────────────────────

export function Sidebar() {
  return (
    <>
      <DesktopSidebar />
      <MobileDrawer />
    </>
  );
}
