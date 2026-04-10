"use client";

import { motion } from "framer-motion";
import {
  Flame, AlertTriangle, Users, FolderGit2,
  GitBranch, ExternalLink, Clock, TrendingDown
} from "lucide-react";
import Link from "next/link";
import { Card, CardBody, CardHeader } from "@/components/ui/Card";
import { PriorityBadge } from "@/components/ui/Badge";
import { Avatar } from "@/components/ui/Avatar";
import { STATUS_CONFIG, timeAgo } from "@/lib/utils";

interface Repo {
  id: string;
  name: string;
  openIssues: number;
  url: string;
}

interface Card_ {
  id: string;
  title: string;
  priority: string;
  updatedAt: Date;
  column: {
    name: string;
    board: {
      repo: {
        id: string;
        name: string;
      } | null;
    };
  };
}

interface Customer {
  id: string;
  name: string;
  industry: string | null;
  status: string;
  healthScore: number;
}

interface ActivityEvent {
  id: string;
  type: string;
  payload: string;
  actorName: string | null;
  actorImage: string | null;
  createdAt: Date;
}

interface Props {
  repos: Repo[];
  criticalCards: Card_[];
  atRiskCustomers: Customer[];
  activity: ActivityEvent[];
}

const container = {
  hidden: { opacity: 0 },
  show: { opacity: 1, transition: { staggerChildren: 0.07 } },
};
const item = { hidden: { opacity: 0, y: 12 }, show: { opacity: 1, y: 0 } };

function getActivityMessage(event: ActivityEvent) {
  try {
    const payload = JSON.parse(event.payload);
    return payload.message ?? event.type.replace(/_/g, " ");
  } catch {
    return event.type.replace(/_/g, " ");
  }
}

function getActivityIcon(type: string) {
  const icons: Record<string, string> = {
    issue_created: "🐛",
    issue_moved: "📋",
    issue_closed: "✅",
    doc_uploaded: "📄",
    repo_synced: "🔄",
    customer_added: "👤",
    card_created: "🃏",
  };
  return icons[type] ?? "⚡";
}

export function WildfiresClient({ repos, criticalCards, atRiskCustomers, activity }: Props) {
  const totalFires = repos.reduce((s, p) => s + p.openIssues, 0)
    + criticalCards.length
    + atRiskCustomers.length;

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-black text-[#F0F0F0] flex items-center gap-3">
          <Flame size={22} className="text-[#EF4444]" />
          Wildfires
          {totalFires > 0 && (
            <span className="px-2 py-0.5 text-xs font-bold bg-[rgba(239,68,68,0.15)] text-[#EF4444] rounded-full animate-pulse">
              {totalFires} active
            </span>
          )}
        </h1>
        <p className="text-sm text-[#606060] mt-0.5">Everything that needs your attention right now</p>
      </div>

      {totalFires === 0 ? (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex flex-col items-center justify-center py-24 text-center"
        >
          <div className="text-6xl mb-4">🌱</div>
          <h3 className="text-xl font-bold text-[#F0F0F0] mb-2">No active fires</h3>
          <p className="text-[#9A9A9A]">Everything looks good. Keep shipping!</p>
        </motion.div>
      ) : (
        <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
          {/* Left: Issues & Cards */}
          <div className="xl:col-span-2 space-y-6">
            {/* Repos with open issues */}
            {repos.length > 0 && (
              <div>
                <h3 className="text-sm font-bold text-[#F0F0F0] flex items-center gap-2 mb-3">
                  <FolderGit2 size={14} className="text-[#F7941D]" />
                  Open GitHub Issues
                </h3>
                <motion.div
                  variants={container}
                  initial="hidden"
                  animate="show"
                  className="space-y-2"
                >
                  {repos.map((repo) => (
                    <motion.div key={repo.id} variants={item}>
                      <Link href={`/repos/${repo.id}`}>
                        <motion.div
                          whileHover={{ borderColor: "rgba(247,148,29,0.25)" }}
                          className="flex items-center gap-4 bg-[#1A1A1A] border border-[rgba(255,255,255,0.07)] rounded-xl px-4 py-3 cursor-pointer group transition-all"
                        >
                          <div className="w-8 h-8 rounded-lg bg-[rgba(239,68,68,0.1)] flex items-center justify-center flex-shrink-0">
                            <AlertTriangle size={15} className="text-[#EF4444]" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <span className="text-sm font-semibold text-[#F0F0F0] group-hover:text-[#F7941D] transition-colors">
                              {repo.name}
                            </span>
                          </div>
                          <div className="flex items-center gap-3">
                            <span className="text-sm font-bold text-[#EF4444]">
                              {repo.openIssues}
                            </span>
                            <span className="text-xs text-[#606060]">open issues</span>
                            <a
                              href={`${repo.url}/issues`}
                              target="_blank"
                              rel="noopener noreferrer"
                              onClick={(e) => e.stopPropagation()}
                              className="text-[#606060] hover:text-[#F7941D] transition-colors"
                            >
                              <ExternalLink size={13} />
                            </a>
                          </div>
                        </motion.div>
                      </Link>
                    </motion.div>
                  ))}
                </motion.div>
              </div>
            )}

            {/* Critical Kanban Cards */}
            {criticalCards.length > 0 && (
              <div>
                <h3 className="text-sm font-bold text-[#F0F0F0] flex items-center gap-2 mb-3">
                  <GitBranch size={14} className="text-[#F97316]" />
                  High Priority Cards
                </h3>
                <motion.div
                  variants={container}
                  initial="hidden"
                  animate="show"
                  className="space-y-2"
                >
                  {criticalCards.map((card) => (
                    <motion.div key={card.id} variants={item}>
                      <Link href={card.column.board.repo ? `/repos/${card.column.board.repo.id}` : "/planner"}>
                        <motion.div
                          whileHover={{ borderColor: "rgba(247,148,29,0.2)" }}
                          className="bg-[#1A1A1A] border border-[rgba(255,255,255,0.07)] rounded-xl px-4 py-3 cursor-pointer group transition-all"
                          style={{
                            borderLeftWidth: "3px",
                            borderLeftColor: card.priority === "critical" ? "#EF4444" : "#F97316",
                          }}
                        >
                          <div className="flex items-center justify-between gap-3">
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-semibold text-[#F0F0F0] group-hover:text-[#F7941D] transition-colors truncate">
                                {card.title}
                              </p>
                              <p className="text-xs text-[#606060] mt-0.5">
                                {card.column.board.repo?.name ?? "General"} · {card.column.name}
                              </p>
                            </div>
                            <div className="flex items-center gap-2 flex-shrink-0">
                              <PriorityBadge priority={card.priority} />
                              <span className="flex items-center gap-1 text-xs text-[#606060]">
                                <Clock size={10} />
                                {timeAgo(card.updatedAt)}
                              </span>
                            </div>
                          </div>
                        </motion.div>
                      </Link>
                    </motion.div>
                  ))}
                </motion.div>
              </div>
            )}

            {/* At-risk customers */}
            {atRiskCustomers.length > 0 && (
              <div>
                <h3 className="text-sm font-bold text-[#F0F0F0] flex items-center gap-2 mb-3">
                  <Users size={14} className="text-[#EF4444]" />
                  At-Risk Customers
                </h3>
                <motion.div
                  variants={container}
                  initial="hidden"
                  animate="show"
                  className="space-y-2"
                >
                  {atRiskCustomers.map((customer) => {
                    const status = STATUS_CONFIG[customer.status as keyof typeof STATUS_CONFIG];
                    return (
                      <motion.div key={customer.id} variants={item}>
                        <Link href="/customers">
                          <motion.div
                            whileHover={{ borderColor: "rgba(239,68,68,0.3)" }}
                            className="flex items-center gap-3 bg-[#1A1A1A] border border-[rgba(239,68,68,0.15)] rounded-xl px-4 py-3 cursor-pointer group transition-all"
                          >
                            <Avatar name={customer.name} size="sm" />
                            <div className="flex-1 min-w-0">
                              <span className="text-sm font-semibold text-[#F0F0F0] group-hover:text-[#F7941D] transition-colors">
                                {customer.name}
                              </span>
                              {customer.industry && (
                                <span className="text-xs text-[#9A9A9A] ml-1">· {customer.industry}</span>
                              )}
                            </div>
                            <div className="flex items-center gap-2">
                              <span
                                className="text-xs px-2 py-0.5 rounded-full font-medium"
                                style={{ color: status.color, backgroundColor: status.bg }}
                              >
                                {status.label}
                              </span>
                              {customer.status === "churned" && (
                                <TrendingDown size={14} className="text-[#EF4444]" />
                              )}
                            </div>
                          </motion.div>
                        </Link>
                      </motion.div>
                    );
                  })}
                </motion.div>
              </div>
            )}
          </div>

          {/* Right: Activity stream */}
          <div>
            <h3 className="text-sm font-bold text-[#F0F0F0] flex items-center gap-2 mb-3">
              <Flame size={14} className="text-[#F7941D]" />
              Live Activity
            </h3>
            <Card>
              <CardBody className="p-0">
                {activity.length === 0 ? (
                  <div className="py-12 text-center">
                    <p className="text-[#606060] text-sm">No recent activity</p>
                  </div>
                ) : (
                  <div className="divide-y divide-[rgba(255,255,255,0.04)]">
                    {activity.map((event, i) => (
                      <motion.div
                        key={event.id}
                        initial={{ opacity: 0, x: 10 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: i * 0.04 }}
                        className="flex items-start gap-3 p-4"
                      >
                        <div className="w-8 h-8 bg-[#222222] rounded-xl flex items-center justify-center text-sm flex-shrink-0">
                          {getActivityIcon(event.type)}
                        </div>
                        <div className="flex-1 min-w-0">
                          {event.actorName && (
                            <div className="flex items-center gap-1.5 mb-1">
                              <Avatar
                                src={event.actorImage}
                                name={event.actorName}
                                size="xs"
                              />
                              <span className="text-xs font-medium text-[#9A9A9A]">
                                {event.actorName}
                              </span>
                            </div>
                          )}
                          <p className="text-xs text-[#F0F0F0] leading-snug">
                            {getActivityMessage(event)}
                          </p>
                          <p className="text-xs text-[#404040] mt-1 flex items-center gap-1">
                            <Clock size={10} />
                            {timeAgo(event.createdAt)}
                          </p>
                        </div>
                      </motion.div>
                    ))}
                  </div>
                )}
              </CardBody>
            </Card>
          </div>
        </div>
      )}
    </div>
  );
}
