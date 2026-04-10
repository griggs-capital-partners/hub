"use client";

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  ArrowRight,
  FolderGit2,
  GitPullRequest,
  Flame,
  TrendingUp,
  Zap,
  Bot,
  GitCommitHorizontal,
  GitMerge,
  AlertTriangle,
  Users,
  TriangleAlert,
  CheckCircle2,
  Circle,
  Clock,
  Cloud,
  CloudFog,
  CloudLightning,
  CloudRain,
  CloudSnow,
  CloudSun,
  MapPin,
  SunMedium,
} from "lucide-react";
import Link from "next/link";
import Image from "next/image";
import { ParticleBackground } from "./ParticleBackground";
import { Avatar } from "@/components/ui/Avatar";
import { getInitials, timeAgo } from "@/lib/utils";
import { ExecutionDetailDrawer, type ExecutionRecord } from "@/components/agents/AgentExecutionBoard";
import { kickoffExecutionProcessing } from "@/lib/agent-execution-client";

// ─── Tech Quotes ──────────────────────────────────────────────────────────────

const TECH_QUOTES: { text: string; author: string }[] = [
  { text: "Move fast and build things.", author: "Engineering culture" },
  { text: "The best code is no code at all.", author: "Jeff Atwood" },
  { text: "Simplicity is the ultimate sophistication.", author: "Leonardo da Vinci" },
  { text: "Make it work, make it right, make it fast.", author: "Kent Beck" },
  { text: "Code is read more often than it is written.", author: "Guido van Rossum" },
  { text: "First, solve the problem. Then, write the code.", author: "John Johnson" },
  { text: "Talk is cheap. Show me the code.", author: "Linus Torvalds" },
  { text: "Any sufficiently advanced technology is indistinguishable from magic.", author: "Arthur C. Clarke" },
  { text: "The future is already here — it's just not evenly distributed.", author: "William Gibson" },
  { text: "Software is eating the world.", author: "Marc Andreessen" },
  { text: "Stay hungry. Stay foolish.", author: "Steve Jobs" },
  { text: "The only way to do great work is to love what you do.", author: "Steve Jobs" },
  { text: "Ship early. Ship often.", author: "Software wisdom" },
  { text: "Done is better than perfect.", author: "Sheryl Sandberg" },
  { text: "Build something 100 people love, not something 1M people like.", author: "Paul Graham" },
  { text: "Innovation distinguishes between a leader and a follower.", author: "Steve Jobs" },
  { text: "The internet is the world's largest library — in total disarray.", author: "Roger Ebert" },
  { text: "Data is the new oil.", author: "Clive Humby" },
  { text: "Every great developer you know got there by solving problems they were unqualified to solve.", author: "Patrick McKenzie" },
  { text: "If you think good architecture is expensive, try bad architecture.", author: "Brian Foote" },
  { text: "The best way to predict the future is to invent it.", author: "Alan Kay" },
  { text: "Weeks of coding can save hours of planning.", author: "Software wisdom" },
  { text: "There are only two hard things in CS: cache invalidation and naming things.", author: "Phil Karlton" },
  { text: "An idiot admires complexity; a genius admires simplicity.", author: "Terry Davis" },
  { text: "The measure of intelligence is the ability to change.", author: "Albert Einstein" },
  { text: "Debugging is twice as hard as writing the code in the first place.", author: "Brian Kernighan" },
  { text: "Architecture is the decisions you wish you could get right early on.", author: "Ralph Johnson" },
  { text: "One machine can do the work of fifty ordinary men.", author: "Elbert Hubbard" },
  { text: "The science of today is the technology of tomorrow.", author: "Edward Teller" },
  { text: "Move fast, break things — then fix them.", author: "Engineering culture" },
  { text: "Automate the boring stuff.", author: "Al Sweigart" },
  { text: "Build products users love, not products users tolerate.", author: "Product wisdom" },
  { text: "Technology is best when it brings people together.", author: "Matt Mullenweg" },
  { text: "Fail fast. Learn faster.", author: "Startup culture" },
  { text: "The most dangerous phrase is: we've always done it this way.", author: "Grace Hopper" },
  { text: "Make it as simple as possible, but not simpler.", author: "Albert Einstein" },
  { text: "A small team of A+ players can run circles around a giant team of B+ players.", author: "Steve Jobs" },
  { text: "You don't need a big team. You need the right team.", author: "Engineering culture" },
  { text: "The most powerful tool we have as developers is automation.", author: "Scott Hanselman" },
  { text: "Great software, like wine, takes time.", author: "Joel Spolsky" },
  { text: "Your most unhappy customers are your greatest source of learning.", author: "Bill Gates" },
  { text: "Software is never finished, only abandoned.", author: "Engineering culture" },
  { text: "Design is not just what it looks like — design is how it works.", author: "Steve Jobs" },
  { text: "Every line of code is a liability until proven otherwise.", author: "Engineering wisdom" },
  { text: "The art of programming is the art of organizing complexity.", author: "Edsger Dijkstra" },
  { text: "Clean code reads like well-written prose.", author: "Robert C. Martin" },
  { text: "Machines should work; people should think.", author: "IBM motto" },
  { text: "The best error message is the one that never shows up.", author: "Thomas Fuchs" },
  { text: "Strive to build things that are a joy to use.", author: "Engineering culture" },
  { text: "Vision without execution is just hallucination.", author: "Thomas Edison" },
];

// Fisher-Yates shuffle for random quote order
function shuffleQuotes(arr: typeof TECH_QUOTES) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

// ─── Types ────────────────────────────────────────────────────────────────────

interface ActivityEvent {
  id: string;
  type: string;
  payload: string;
  actorName: string | null;
  actorImage: string | null;
  createdAt: Date;
}

// AgentExecution is now just ExecutionRecord (imported above)

interface CardData {
  topRepos: { name: string; language: string | null; pushedAt: Date | null }[];
  inProgressTitles: string[];
  inReviewTitles: string[];
  customers: { total: number; atRisk: number };
}

interface Props {
  user: { name?: string | null; email?: string | null; image?: string | null };
  activity: ActivityEvent[];
  stats: {
    repos: number;
    backlog: number;
    inProgress: number;
    inReview: number;
    done: number;
    customerCount: number;
    atRisk: number;
    openIssues: number;
  };
  cardData: CardData;
  recentExecutions: ExecutionRecord[];
  weatherLocationMode: "hub" | "user";
  weather: {
    locationName: string;
    temperatureMax: number | null;
    temperatureMin: number | null;
    apparentTemperatureMax: number | null;
    precipitationProbabilityMax: number | null;
    conditionLabel: string;
    icon: "sun" | "cloud-sun" | "cloud" | "rain" | "storm" | "snow" | "fog";
  } | null;
}

// ─── Animation variants ───────────────────────────────────────────────────────

const container = {
  hidden: { opacity: 0 },
  show: { opacity: 1, transition: { staggerChildren: 0.08 } },
};
const item = { hidden: { opacity: 0, y: 16 }, show: { opacity: 1, y: 0 } };

// ─── Language color dots ──────────────────────────────────────────────────────

const LANG_COLOR: Record<string, string> = {
  TypeScript: "#3178C6",
  JavaScript: "#F7DF1E",
  Python: "#3572A5",
  Go: "#00ADD8",
  Rust: "#DEA584",
  Ruby: "#CC342D",
  Java: "#B07219",
  "C#": "#178600",
  "C++": "#F34B7D",
  Shell: "#89E051",
  Dockerfile: "#384D54",
};

function LangDot({ lang }: { lang: string | null }) {
  if (!lang) return null;
  const color = LANG_COLOR[lang] ?? "#606060";
  return (
    <span
      className="inline-block w-1.5 h-1.5 rounded-full flex-shrink-0"
      style={{ backgroundColor: color }}
      title={lang}
    />
  );
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function getGreeting(name?: string | null) {
  const hour = new Date().getHours();
  const firstName = name?.split(" ")[0] ?? "there";
  if (hour < 12) return `Good morning, ${firstName}`;
  if (hour < 17) return `Good afternoon, ${firstName}`;
  return `Good evening, ${firstName}`;
}

function getActivityMessage(event: ActivityEvent) {
  try {
    const payload = JSON.parse(event.payload);
    return payload.message ?? event.type.replace(/_/g, " ");
  } catch {
    return event.type.replace(/_/g, " ");
  }
}

function getActivityRepo(event: ActivityEvent): string {
  try {
    const payload = JSON.parse(event.payload);
    const repo = payload.repo ?? "";
    return repo.split("/")[1] ?? repo;
  } catch {
    return "";
  }
}

/** Condense multiple commits from the same actor+repo into a single summary entry. */
function condenseActivity(events: ActivityEvent[]): ActivityEvent[] {
  const commitGroups = new Map<
    string,
    { events: ActivityEvent[]; repoName: string }
  >();
  const other: ActivityEvent[] = [];

  for (const ev of events) {
    if (ev.type !== "github.commit") {
      other.push(ev);
      continue;
    }
    let repo = "";
    try {
      repo = JSON.parse(ev.payload).repo ?? "";
    } catch { /* ignore */ }
    const key = `${ev.actorName ?? ""}::${repo}`;
    const existing = commitGroups.get(key);
    if (existing) {
      existing.events.push(ev);
    } else {
      commitGroups.set(key, { events: [ev], repoName: repo.split("/")[1] ?? repo });
    }
  }

  const summaries: ActivityEvent[] = [];
  for (const { events: grp, repoName } of commitGroups.values()) {
    const newest = grp[0];
    const oldest = grp[grp.length - 1];
    const count = grp.length;
    const actor = newest.actorName ?? "Someone";

    let timeLabel: string;
    const spanMs = newest.createdAt.valueOf() - oldest.createdAt.valueOf();
    if (spanMs < 60 * 60 * 1000) timeLabel = "in the last hour";
    else if (spanMs < 2 * 60 * 60 * 1000) timeLabel = "in the last 2 hours";
    else if (spanMs < 4 * 60 * 60 * 1000) timeLabel = "in the last 4 hours";
    else if (spanMs < 24 * 60 * 60 * 1000) timeLabel = "today";
    else timeLabel = "recently";

    const message =
      count === 1
        ? getActivityMessage(newest)
        : `${actor} pushed ${count} commits to ${repoName} ${timeLabel}`;

    summaries.push({
      ...newest,
      payload: JSON.stringify({ message }),
    });
  }

  return [...summaries, ...other]
    .sort((a, b) => b.createdAt.valueOf() - a.createdAt.valueOf())
    .slice(0, 8);
}

// ─── Sub-components ───────────────────────────────────────────────────────────

const HERO_IMAGES = ["/AgentsHome.png", "/AgentsHome2.png"];
const IMAGE_STYLE = {
  filter: "drop-shadow(0 18px 40px rgba(0,0,0,0.42))",
  WebkitMaskImage: "radial-gradient(circle at 50% 50%, black 50%, transparent 82%)",
  maskImage: "radial-gradient(circle at 50% 50%, black 50%, transparent 82%)",
};

function AgentsHeroImage() {
  const [idx, setIdx] = useState(0);
  const [visible, setVisible] = useState(true);

  useEffect(() => {
    const interval = setInterval(() => {
      setVisible(false);
      setTimeout(() => {
        setIdx((i) => (i + 1) % HERO_IMAGES.length);
        setVisible(true);
      }, 800);
    }, 7000);
    return () => clearInterval(interval);
  }, []);

  return (
    <Image
      src={HERO_IMAGES[idx]}
      alt="Agents dashboard artwork"
      fill
      priority
      sizes="(max-width: 640px) 160px, (max-width: 1024px) 220px, 260px"
      className="object-contain object-center"
      style={{
        ...IMAGE_STYLE,
        opacity: visible ? 0.95 : 0,
        transition: "opacity 600ms ease-in-out",
      }}
    />
  );
}

function ExecutionStatusBadge({ status }: { status: string }) {
  const styles: Record<string, { cls: string; label: string; dot?: boolean }> = {
    completed: { cls: "text-emerald-400", label: "Done" },
    "in-process": { cls: "text-blue-400", label: "Running", dot: true },
    "needs-input": { cls: "text-yellow-400", label: "Needs Input" },
    failed: { cls: "text-red-400", label: "Failed" },
  };
  const s = styles[status] ?? { cls: "text-[#606060]", label: status };
  return (
    <span className={`flex items-center gap-1 text-[10px] font-semibold ${s.cls}`}>
      {s.dot && <span className="w-1.5 h-1.5 rounded-full bg-blue-400 animate-pulse inline-block" />}
      {s.label}
    </span>
  );
}

function friendlyAction(actionType: string) {
  const map: Record<string, string> = {
    generate_docs: "Generate Docs",
    write_tests: "Write Tests",
    code_review: "Code Review",
    break_down: "Break Down",
    estimate_points: "Estimate Points",
    draft_pr: "Draft PR",
    identify_risks: "Identify Risks",
    customer_update: "Customer Update",
    suggest_implementation: "Suggest Impl.",
    qa_checklist: "QA Checklist",
  };
  return map[actionType] ?? actionType.replace(/_/g, " ");
}

function CommitIcon({ type }: { type: string }) {
  if (type === "github.commit") return <GitCommitHorizontal size={13} className="text-[#F7941D]" />;
  if (type === "github.pr_merged") return <GitMerge size={13} className="text-purple-400" />;
  if (type === "github.pr_opened") return <GitPullRequest size={13} className="text-blue-400" />;
  if (type === "issue_created") return <AlertTriangle size={13} className="text-yellow-400" />;
  return <Zap size={13} className="text-[#606060]" />;
}

function WeatherIcon({ icon }: NonNullable<Props["weather"]>) {
  if (icon === "sun") return <SunMedium size={16} className="text-[#FBBA00]" />;
  if (icon === "cloud-sun") return <CloudSun size={16} className="text-[#F7941D]" />;
  if (icon === "rain") return <CloudRain size={16} className="text-blue-400" />;
  if (icon === "storm") return <CloudLightning size={16} className="text-purple-400" />;
  if (icon === "snow") return <CloudSnow size={16} className="text-cyan-300" />;
  if (icon === "fog") return <CloudFog size={16} className="text-[#A0A0A0]" />;
  return <Cloud size={16} className="text-[#9A9A9A]" />;
}

function formatWholeNumber(value: number | null) {
  return value === null ? "--" : Math.round(value).toString();
}

// ─── Main component ───────────────────────────────────────────────────────────

export function DashboardClient({ user, activity, stats, cardData, recentExecutions, weatherLocationMode, weather }: Props) {
  const condensedActivity = condenseActivity(activity);
  const activeExecutions = recentExecutions.filter((exec) => exec.status === "in-process" || exec.status === "needs-input").length;
  const completedExecutions = recentExecutions.filter((exec) => exec.status === "completed").length;
  const [selectedExecution, setSelectedExecution] = useState<ExecutionRecord | null>(null);
  const [localWeather, setLocalWeather] = useState<Props["weather"]>(null);
  const [weatherError, setWeatherError] = useState<string | null>(null);
  const [shuffledQuotes] = useState(() => shuffleQuotes(TECH_QUOTES));
  const [quoteIndex, setQuoteIndex] = useState(0);
  const displayedWeather = weatherLocationMode === "user" ? localWeather : weather;
  const displayedWeatherError = weatherLocationMode === "user" ? weatherError : null;

  useEffect(() => {
    if (weatherLocationMode !== "user") return;

    if (!navigator.geolocation) {
      const timer = window.setTimeout(() => {
        setLocalWeather(null);
        setWeatherError("This browser does not support location-based weather.");
      }, 0);
      return () => window.clearTimeout(timer);
    }

    let cancelled = false;

    navigator.geolocation.getCurrentPosition(
      async (position) => {
        try {
          const params = new URLSearchParams({
            latitude: String(position.coords.latitude),
            longitude: String(position.coords.longitude),
          });
          const res = await fetch(`/api/weather?${params.toString()}`, { cache: "no-store" });
          const data = (await res.json()) as { error?: string; weather?: Props["weather"] };

          if (cancelled) return;

          if (!res.ok || !data.weather) {
            setLocalWeather(null);
            setWeatherError(data.error ?? "Could not load weather for your location.");
            return;
          }

          setLocalWeather(data.weather);
        } catch {
          if (!cancelled) {
            setLocalWeather(null);
            setWeatherError("Could not load weather for your location.");
          }
        }
      },
      () => {
        if (!cancelled) {
          setLocalWeather(null);
          setWeatherError("Allow location access to see weather for your current location.");
        }
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 300000 }
    );

    return () => {
      cancelled = true;
    };
  }, [weather, weatherLocationMode]);

  useEffect(() => {
    const id = setInterval(() => setQuoteIndex((i) => (i + 1) % shuffledQuotes.length), 12000);
    return () => clearInterval(id);
  }, [shuffledQuotes.length]);

  const currentQuote = shuffledQuotes[quoteIndex];

  return (
    <>
      <ParticleBackground />
      <div className="max-w-7xl mx-auto space-y-6 relative z-10">

        {/* ── Hero greeting card ───────────────────────────────────────────── */}
        <motion.div
          initial={{ opacity: 0, y: -12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="relative overflow-hidden rounded-3xl border border-[rgba(255,255,255,0.07)] bg-[#111111]"
          style={{ boxShadow: "0 8px 48px rgba(0,0,0,0.65), inset 0 1px 0 rgba(255,255,255,0.05), 0 0 0 1px rgba(0,0,0,0.5)" }}
        >
          {/* Ambient glows */}
          <div className="absolute inset-0 pointer-events-none overflow-hidden">
            <div className="absolute -top-32 -left-16 w-96 h-96 rounded-full bg-[#F7941D] opacity-[0.08] blur-3xl" />
            <div className="absolute -bottom-20 right-16 w-72 h-72 rounded-full bg-blue-600 opacity-[0.09] blur-3xl" />
            <div className="absolute top-1/2 right-1/4 w-48 h-48 rounded-full bg-[#FBBA00] opacity-[0.05] blur-2xl" />
          </div>

          <div className="relative p-6 sm:p-7 pb-4 sm:pb-4">
            <div className="grid grid-cols-1 xl:grid-cols-[minmax(0,1.12fr)_360px] gap-5 xl:gap-7 items-start">
              <div className="space-y-5">
                <div className="flex items-center gap-4 px-1">
                  <div className="relative flex-shrink-0">
                    <Avatar
                      src={user.image}
                      name={user.name}
                      size="lg"
                      className="h-16 w-16 ring-2 ring-[rgba(247,148,29,0.35)] ring-offset-[3px] ring-offset-[#111111]"
                    />
                    <span className="absolute -bottom-0.5 -right-0.5 w-4 h-4 bg-emerald-500 rounded-full border-2 border-[#111111]" title="Online" />
                  </div>
                  <div className="min-w-0">
                    <div className="inline-flex items-center gap-2 rounded-full border border-[rgba(247,148,29,0.14)] bg-[rgba(247,148,29,0.06)] px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.2em] text-[#F0B35E]">
                      <Zap size={11} className="text-[#FBBA00]" />
                      Daily Briefing
                    </div>
                    <h2 className="mt-3 text-2xl sm:text-[3.2rem] font-black text-[#F0F0F0] tracking-tight leading-[0.96]">
                      {getGreeting(user.name)}
                    </h2>
                    <p className="text-[#8A8A8A] text-sm flex items-center gap-1.5 mt-2">
                      <span className="h-1.5 w-1.5 rounded-full bg-[#FBBA00]/70" />
                      Here&apos;s your daily briefing at Griggs Capital Partners
                    </p>
                  </div>
                </div>

                {/* Date — mobile only, shown above task snapshot */}
                <div className="xl:hidden px-1">
                  <div className="text-[10px] text-[#6B6B6B] uppercase tracking-[0.3em] font-medium">Today</div>
                  <div className="mt-1 text-2xl font-black tracking-[-0.03em] leading-tight text-[#F6F3EE]">
                    {new Date().toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" })}
                  </div>
                </div>

                <div className="relative overflow-hidden rounded-[28px] p-4 sm:p-5">
                  <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-[rgba(255,255,255,0.12)] to-transparent" />
                  <div className="flex items-center justify-between gap-4 mb-4">
                    <div className="flex items-center gap-2">
                      <span className="text-[11px] text-[#6E6E6E] font-semibold uppercase tracking-[0.2em]">My Task Snapshot</span>
                    </div>
                    <span className="text-[11px] text-[#505050] hidden sm:block">Cards assigned to you</span>
                  </div>
                  <div className="grid grid-cols-3 gap-3">
                    {/* Backlog */}
                    <div className="group relative rounded-[20px] border border-[rgba(120,120,140,0.18)] bg-[linear-gradient(160deg,rgba(255,255,255,0.04),rgba(16,16,20,0.6))] px-4 py-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.05),0_8px_24px_rgba(0,0,0,0.22)] overflow-hidden transition-all duration-200 hover:border-[rgba(120,120,140,0.32)]">
                      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_left,rgba(120,120,140,0.07),transparent_65%)]" />
                      <div className="relative">
                        <div className="flex items-center gap-1.5 mb-3">
                          <div className="h-1.5 w-1.5 rounded-full bg-[#606068]" />
                          <span className="text-[10px] font-semibold uppercase tracking-[0.18em] text-[#70707A]">Backlog</span>
                        </div>
                        <div className="text-[2.4rem] font-black text-[#E8E8EC] leading-none tabular-nums">{stats.backlog}</div>
                        <div className="mt-2 text-[11px] text-[#505058] font-medium">Waiting to be picked up</div>
                      </div>
                    </div>
                    {/* Active */}
                    <div className="group relative rounded-[20px] border border-[rgba(247,148,29,0.2)] bg-[linear-gradient(160deg,rgba(247,148,29,0.09),rgba(20,16,10,0.65))] px-4 py-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.05),0_8px_24px_rgba(0,0,0,0.22)] overflow-hidden transition-all duration-200 hover:border-[rgba(247,148,29,0.38)]">
                      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_left,rgba(247,148,29,0.1),transparent_65%)]" />
                      <div className="relative">
                        <div className="flex items-center gap-1.5 mb-3">
                          <div className="h-1.5 w-1.5 rounded-full bg-[#F7941D] shadow-[0_0_6px_rgba(247,148,29,0.7)]" />
                          <span className="text-[10px] font-semibold uppercase tracking-[0.18em] text-[#C8813A]">Active</span>
                        </div>
                        <div className="text-[2.4rem] font-black text-[#F5F0E8] leading-none tabular-nums">{stats.inProgress}</div>
                        <div className="mt-2 text-[11px] text-[#8A6840] font-medium">Currently in progress</div>
                      </div>
                    </div>
                    {/* Done */}
                    <div className="group relative rounded-[20px] border border-[rgba(16,185,129,0.18)] bg-[linear-gradient(160deg,rgba(16,185,129,0.08),rgba(10,20,16,0.65))] px-4 py-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.05),0_8px_24px_rgba(0,0,0,0.22)] overflow-hidden transition-all duration-200 hover:border-[rgba(16,185,129,0.32)]">
                      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_left,rgba(16,185,129,0.08),transparent_65%)]" />
                      <div className="relative">
                        <div className="flex items-center gap-1.5 mb-3">
                          <div className="h-1.5 w-1.5 rounded-full bg-emerald-400 shadow-[0_0_6px_rgba(52,211,153,0.6)]" />
                          <span className="text-[10px] font-semibold uppercase tracking-[0.18em] text-emerald-500/80">Done</span>
                        </div>
                        <div className="text-[2.4rem] font-black text-[#E8F5EF] leading-none tabular-nums">{stats.done}</div>
                        <div className="mt-2 text-[11px] text-emerald-700/70 font-medium">Completed this week</div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              <div className="flex flex-col items-start xl:items-end gap-4 xl:pt-1 space-y-6">
                <div className="hidden xl:block xl:text-right">
                  <div className="text-[10px] text-[#6B6B6B] uppercase tracking-[0.3em] font-medium">Today</div>
                  <div className="mt-2 text-[2.6rem] font-black tracking-[-0.04em] leading-[1.08] text-[#F6F3EE] text-balance max-w-[8ch]">
                    {new Date().toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" })}
                  </div>
                </div>
                <div className="w-full xl:w-[340px] rounded-[28px] border border-[rgba(255,255,255,0.05)] bg-[linear-gradient(135deg,rgba(255,255,255,0.025),rgba(24,24,24,0.9)_55%,rgba(37,99,235,0.05))] p-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.04),0_18px_40px_rgba(0,0,0,0.22)]">
                  {displayedWeather ? (
                    <div className="space-y-6">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <div className="flex items-center gap-2 text-[#D8D8D8]">
                            <WeatherIcon {...displayedWeather} />
                            <span className="text-xs font-semibold uppercase tracking-[0.2em] text-[#B8B8B8]">{displayedWeather.conditionLabel}</span>
                          </div>
                          <div className="mt-1 flex items-center gap-1.5 text-[11px] text-[#7F7F7F]">
                            <MapPin size={11} />
                            <span className="truncate">{displayedWeather.locationName}</span>
                          </div>
                        </div>
                        <div className="text-right">
                          <div className="text-xl font-bold text-[#E7E7E7]">{formatWholeNumber(displayedWeather.temperatureMax)}&deg;</div>
                          <div className="text-[10px] uppercase tracking-wide text-[#7D7D7D]">High</div>
                        </div>
                      </div>
                      <div className="grid grid-cols-3 gap-2">
                        <div className="rounded-2xl bg-[rgba(255,255,255,0.03)] px-3 py-2.5">
                          <div className="text-[10px] uppercase tracking-wider text-[#666666]">Low</div>
                          <div className="mt-1 text-sm font-medium text-[#CCCCCC]">{formatWholeNumber(displayedWeather.temperatureMin)}&deg;</div>
                        </div>
                        <div className="rounded-2xl bg-[rgba(255,255,255,0.03)] px-3 py-2.5">
                          <div className="text-[10px] uppercase tracking-wider text-[#666666]">Feels like</div>
                          <div className="mt-1 text-sm font-medium text-[#CCCCCC]">{formatWholeNumber(displayedWeather.apparentTemperatureMax)}&deg;</div>
                        </div>
                        <div className="rounded-2xl bg-[rgba(255,255,255,0.03)] px-3 py-2.5">
                          <div className="text-[10px] uppercase tracking-wider text-[#666666]">Rain</div>
                          <div className="mt-1 text-sm font-medium text-[#CCCCCC]">
                            {displayedWeather.precipitationProbabilityMax === null ? "--" : `${Math.round(displayedWeather.precipitationProbabilityMax)}%`}
                          </div>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      <div className="flex items-center gap-2 text-[#F0F0F0]">
                        <CloudSun size={16} className="text-[#F7941D]" />
                        <span className="text-sm font-semibold">
                          {weatherLocationMode === "user" ? "Enable your location" : "Add your hub location"}
                        </span>
                      </div>
                      <p className="text-xs text-[#7A7A7A] leading-relaxed">
                        {weatherLocationMode === "user"
                          ? (displayedWeatherError ?? "Allow location access and we'll show weather for where you are right now.")
                          : "Set a city in Settings to show today's forecast here."}
                      </p>
                      <Link href="/settings" className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#F7941D] hover:text-[#FBBA00] transition-colors">
                        Open settings <ArrowRight size={12} />
                      </Link>
                    </div>
                  )}
                </div>

              </div>
            </div>

            {/* Inspirational quotes carousel — desktop only */}
            <div className="hidden xl:block mt-4 pt-4 border-t border-[rgba(255,255,255,0.05)]">
              <div className="relative h-10 overflow-hidden">
                <AnimatePresence mode="wait" initial={false}>
                  <motion.div
                    key={quoteIndex}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.9, ease: "easeInOut" }}
                    className="absolute inset-0 flex flex-col items-center justify-center gap-0.5 text-center"
                  >
                    <p className="text-[0.95rem] font-black tracking-tight text-[#C8C4BE] leading-none">
                      &ldquo;{currentQuote.text}&rdquo;
                    </p>
                    <p className="text-[10px] font-medium tracking-[0.18em] uppercase text-[#484848]">
                      — {currentQuote.author}
                    </p>
                  </motion.div>
                </AnimatePresence>
              </div>
            </div>
          </div>
        </motion.div>




        {/* ── Live Snapshot ─────────────────────────────────────────────────── */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

          {/* ── Agent Executions ──────────────────────────────────────────── */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.35 }}
          >
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-bold text-[#F0F0F0] flex items-center gap-2">
                <Bot size={14} className="text-purple-400" />
                Agent Activity
              </h3>
              <Link href="/agents" className="text-[10px] text-[#606060] hover:text-[#F7941D] transition-colors">
                All agents →
              </Link>
            </div>

            <div
              className="relative overflow-hidden rounded-[26px] border border-[rgba(255,255,255,0.08)] bg-[radial-gradient(circle_at_top_left,rgba(168,85,247,0.18),transparent_34%),radial-gradient(circle_at_75%_20%,rgba(59,130,246,0.16),transparent_30%),linear-gradient(145deg,#161319,#0f1014_58%,#12151b)]"
              style={{ boxShadow: "0 4px 28px rgba(0,0,0,0.55), 0 1px 6px rgba(0,0,0,0.35), 0 20px 56px rgba(168,85,247,0.1)" }}
            >
              <div className="absolute inset-0 pointer-events-none">
                <div className="absolute -top-10 left-8 h-32 w-32 rounded-full bg-purple-500/12 blur-3xl" />
                <div className="absolute top-16 right-8 h-36 w-36 rounded-full bg-sky-500/10 blur-3xl" />
                <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-[rgba(255,255,255,0.22)] to-transparent" />
              </div>

              {recentExecutions.length === 0 ? (
                <div className="relative py-14 text-center">
                  <div className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-[18px] border border-[rgba(255,255,255,0.08)] bg-[rgba(255,255,255,0.04)]">
                    <Bot size={24} className="text-purple-300" />
                  </div>
                  <p className="text-[#C9C6D3] text-sm font-medium">No agent runs yet.</p>
                  <p className="mt-1 text-xs text-[#777286]">Kick off work from a Kanban card and it will show up here.</p>
                </div>
              ) : (
                <div className="relative p-4 sm:p-5">
                  <div className="grid gap-4 sm:gap-5">
                    <div className="relative overflow-hidden rounded-[24px] border border-[rgba(255,255,255,0.08)] bg-[linear-gradient(135deg,rgba(255,255,255,0.06),rgba(255,255,255,0.02)_45%,rgba(17,24,39,0.12))] px-4 py-4 sm:px-5">
                      <div className="absolute inset-y-0 right-0 w-[44%] sm:w-[54%] min-w-[140px] pointer-events-none">
                        <div className="absolute inset-y-0 right-0 w-full rounded-full bg-[radial-gradient(circle_at_center,rgba(255,255,255,0.16),transparent_64%)] blur-2xl" />
                        <div className="absolute top-1/2 right-0 h-[160px] w-[160px] sm:h-[220px] sm:w-[220px] lg:h-[260px] lg:w-[260px] -translate-y-1/2">
                          <AgentsHeroImage />
                        </div>
                      </div>

                      <div className="relative z-10 max-w-[58%] min-w-0 sm:max-w-[56%]">
                        <div className="inline-flex items-center gap-2 rounded-full border border-purple-400/20 bg-purple-400/10 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.18em] text-purple-200">
                          <span className="h-1.5 w-1.5 rounded-full bg-purple-300" />
                          Execution Feed
                        </div>
                        <h4 className="mt-3 text-lg font-black tracking-tight text-[#F4F1FF] sm:text-[1.45rem]">
                          Agents are moving work across the board.
                        </h4>
                        <p className="mt-2 max-w-[28ch] text-xs leading-relaxed text-[#B4AEC4] sm:text-[13px]">
                          Live runs, recent completions, and the next tasks needing human input all in one place.
                        </p>

                        <div className="mt-4 flex flex-wrap gap-2.5">
                          <div className="min-w-[88px] rounded-2xl border border-blue-400/12 bg-blue-500/10 px-3 py-2 backdrop-blur-sm">
                            <div className="text-[10px] uppercase tracking-[0.18em] text-blue-200/70">Active</div>
                            <div className="mt-1 text-xl font-black leading-none text-[#F5F7FF]">{activeExecutions}</div>
                          </div>
                          <div className="min-w-[88px] rounded-2xl border border-emerald-400/12 bg-emerald-500/10 px-3 py-2 backdrop-blur-sm">
                            <div className="text-[10px] uppercase tracking-[0.18em] text-emerald-200/70">Done</div>
                            <div className="mt-1 text-xl font-black leading-none text-[#F5F7FF]">{completedExecutions}</div>
                          </div>
                        </div>
                      </div>
                    </div>

                    <div className="overflow-y-auto max-h-[330px] space-y-2 pr-0.5 scrollbar-thin">
                      {recentExecutions.map((exec, i) => (
                        <motion.button
                          key={exec.id}
                          initial={{ opacity: 0 }}
                          animate={{ opacity: 1 }}
                          transition={{ delay: 0.4 + i * 0.05 }}
                          onClick={() => setSelectedExecution(exec)}
                          className="w-full text-left rounded-[20px] border border-[rgba(255,255,255,0.06)] bg-[rgba(8,10,15,0.5)] px-4 py-3.5 backdrop-blur-sm transition-all hover:bg-[rgba(255,255,255,0.06)] hover:border-[rgba(255,255,255,0.12)] active:scale-[0.99]"
                        >
                          <div className="flex items-center gap-3">
                            {exec.agent.avatar && exec.agent.avatar.length > 4 ? (
                              <Avatar
                                src={exec.agent.avatar}
                                name={exec.agent.name}
                                size="sm"
                                className="rounded-2xl ring-1 ring-white/10 shadow-[0_10px_26px_rgba(76,29,149,0.32)] shrink-0"
                              />
                            ) : (
                              <div className="w-9 h-9 rounded-2xl bg-gradient-to-br from-purple-500/80 via-purple-700/80 to-sky-700/80 flex items-center justify-center shrink-0 text-sm ring-1 ring-white/10 overflow-hidden shadow-[0_10px_26px_rgba(76,29,149,0.32)]">
                                <span>{exec.agent.avatar ?? "🤖"}</span>
                              </div>
                            )}

                            <div className="flex-1 min-w-0">
                              <p className="text-sm text-[#ECE9F7] font-semibold truncate">{exec.kanbanCard.title}</p>
                              <div className="flex items-center gap-x-2 mt-0.5 min-w-0">
                                <span className="text-[10px] text-purple-300 font-semibold uppercase tracking-[0.14em] shrink-0">{exec.agent.name}</span>
                                <span className="text-[10px] text-[#5E5A68] shrink-0">•</span>
                                <span className="text-[10px] text-[#9791A8] truncate">{friendlyAction(exec.actionType)}</span>
                              </div>
                            </div>

                            <div className="flex flex-col items-end gap-1 shrink-0 ml-2">
                              <ExecutionStatusBadge status={exec.status} />
                              <span className="text-[10px] text-[#6C687A] whitespace-nowrap">{timeAgo(exec.createdAt)}</span>
                            </div>
                          </div>
                        </motion.button>
                      ))}
                    </div>
                  </div>
                </div>
              )}
            </div>
          </motion.div>

          {/* ── Recent Activity ────────────────────────────────────────────── */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.45 }}
          >
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-bold text-[#F0F0F0] flex items-center gap-2">
                <GitCommitHorizontal size={14} className="text-[#F7941D]" />
                Recent Activity
              </h3>
              <Link href="/activity" className="text-[10px] text-[#606060] hover:text-[#F7941D] transition-colors">
                Full feed →
              </Link>
            </div>

            <div className="bg-[#111111] border border-[rgba(255,255,255,0.06)] rounded-2xl overflow-hidden" style={{ boxShadow: "0 4px 28px rgba(0,0,0,0.55), 0 1px 6px rgba(0,0,0,0.35), 0 20px 56px rgba(247,148,29,0.06)" }}>
              {condensedActivity.length === 0 ? (
                <div className="py-12 text-center">
                  <div className="text-3xl mb-2">🌱</div>
                  <p className="text-[#606060] text-sm">No activity yet.</p>
                </div>
              ) : (
                <div className="divide-y divide-[rgba(255,255,255,0.04)]">
                  {condensedActivity.map((event, i) => (
                    <motion.div
                      key={event.id}
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      transition={{ delay: 0.5 + i * 0.04 }}
                      className="flex items-start gap-2.5 px-4 py-3.5 hover:bg-[rgba(255,255,255,0.02)] transition-colors"
                    >
                      <div className="flex-shrink-0 mt-0.5">
                        {event.actorImage ? (
                          <img
                            src={event.actorImage}
                            alt={event.actorName ?? ""}
                            className="w-5 h-5 rounded-full ring-1 ring-[rgba(247,148,29,0.3)]"
                          />
                        ) : event.actorName ? (
                          <div className="w-5 h-5 rounded-full bg-gradient-to-br from-[#F7941D] to-[#7B1C24] flex items-center justify-center flex-shrink-0">
                            <span className="text-white font-bold text-[7px] leading-none">
                              {getInitials(event.actorName)}
                            </span>
                          </div>
                        ) : (
                          <div className="w-5 h-5 rounded-full bg-[#1E1E1E] flex items-center justify-center">
                            <CommitIcon type={event.type} />
                          </div>
                        )}
                      </div>

                      <div className="flex-1 min-w-0">
                        <p className="text-xs text-[#C0C0C0] line-clamp-2 leading-snug">
                          {getActivityMessage(event)}
                        </p>
                        <div className="flex items-center gap-2 mt-0.5">
                          {getActivityRepo(event) && (
                            <span className="text-[10px] text-[#505050] font-mono truncate max-w-[100px]">
                              {getActivityRepo(event)}
                            </span>
                          )}
                          <span className="text-[10px] text-[#404040]">{timeAgo(event.createdAt)}</span>
                        </div>
                      </div>

                      <CommitIcon type={event.type} />
                    </motion.div>
                  ))}
                </div>
              )}
            </div>
          </motion.div>

        </div>{/* end live snapshot grid */}

        {/* ── Today's Focus ────────────────────────────────────────────────── */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
        >
          <div
            className="relative overflow-hidden rounded-2xl border border-[rgba(247,148,29,0.14)] bg-gradient-to-br from-[#181818] via-[#151515] to-[#131313]"
            style={{ boxShadow: "0 8px 40px rgba(0,0,0,0.55), 0 2px 10px rgba(0,0,0,0.35), 0 24px 64px rgba(247,148,29,0.08)" }}
          >
            {/* Accent glow */}
            <div className="absolute top-0 right-0 w-72 h-72 rounded-full bg-[#F7941D] opacity-[0.04] -translate-y-36 translate-x-36 pointer-events-none blur-2xl" />
            <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-[rgba(247,148,29,0.3)] to-transparent" />

            <div className="relative p-6">
              {/* Header row */}
              <div className="flex items-center justify-between mb-5">
                <div className="flex items-center gap-2">
                  <div className="w-6 h-6 rounded-lg bg-[rgba(247,148,29,0.15)] flex items-center justify-center">
                    <Zap size={13} className="text-[#F7941D]" />
                  </div>
                  <span className="text-xs font-bold text-[#F7941D] uppercase tracking-wider">Today&apos;s Focus</span>
                </div>
                <Link
                  href="/repos"
                  className="flex items-center gap-1.5 px-3.5 py-1.5 bg-[rgba(247,148,29,0.12)] border border-[rgba(247,148,29,0.22)] text-[#F7941D] text-xs font-semibold rounded-xl hover:bg-[rgba(247,148,29,0.2)] transition-all"
                >
                  View boards <ArrowRight size={12} />
                </Link>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Left: active tasks */}
                <div>
                  <div className="flex items-center gap-2 mb-3">
                    <Circle size={12} className="text-blue-400" />
                    <h3 className="text-xs font-bold text-[#B0B0B0] uppercase tracking-wider">Active Tasks</h3>
                    {stats.inProgress > 0 && (
                      <span className="ml-auto text-[10px] font-bold text-blue-400/70 bg-blue-500/10 px-2 py-0.5 rounded-full border border-blue-500/15">
                        {stats.inProgress} open
                      </span>
                    )}
                  </div>
                  <div className="space-y-2">
                    {cardData.inProgressTitles.length === 0 ? (
                      <p className="text-sm text-[#505050] italic pl-1">No active tasks — pick something from the backlog!</p>
                    ) : (
                      cardData.inProgressTitles.map((title, i) => (
                        <motion.div
                          key={i}
                          initial={{ opacity: 0, x: -8 }}
                          animate={{ opacity: 1, x: 0 }}
                          transition={{ delay: 0.3 + i * 0.07 }}
                          className="group flex items-start gap-2.5 p-2.5 rounded-xl hover:bg-[rgba(59,130,246,0.05)] transition-colors cursor-default"
                        >
                          <div className="w-4 h-4 rounded border border-blue-500/30 bg-blue-500/10 flex items-center justify-center mt-0.5 flex-shrink-0">
                            <div className="w-1.5 h-1.5 rounded-sm bg-blue-400/50" />
                          </div>
                          <span className="text-sm text-[#C8C8C8] leading-snug line-clamp-2 group-hover:text-[#E0E0E0] transition-colors">{title}</span>
                        </motion.div>
                      ))
                    )}
                    {stats.inProgress > cardData.inProgressTitles.length && (
                      <p className="text-xs text-[#505050] pl-3">+{stats.inProgress - cardData.inProgressTitles.length} more tasks</p>
                    )}
                  </div>
                </div>

                {/* Right: attention items */}
                <div>
                  <div className="flex items-center gap-2 mb-3">
                    <Clock size={12} className="text-[#9A9A9A]" />
                    <h3 className="text-xs font-bold text-[#B0B0B0] uppercase tracking-wider">Needs Attention</h3>
                  </div>
                  <div className="space-y-2">
                    {stats.atRisk > 0 && (
                      <Link href="/customers" className="flex items-center gap-3 p-2.5 rounded-xl bg-red-500/5 border border-red-500/15 hover:bg-red-500/10 transition-colors group">
                        <div className="w-7 h-7 rounded-lg bg-red-500/15 flex items-center justify-center flex-shrink-0">
                          <TriangleAlert size={13} className="text-red-400" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm text-[#D0D0D0] font-medium group-hover:text-[#F0F0F0] transition-colors">
                            {stats.atRisk} customer{stats.atRisk > 1 ? "s" : ""} at risk
                          </p>
                          <p className="text-[10px] text-[#606060]">Review in Customer Intelligence</p>
                        </div>
                        <ArrowRight size={12} className="text-red-400/50 group-hover:text-red-400 transition-colors flex-shrink-0" />
                      </Link>
                    )}
                    {stats.openIssues > 0 && (
                      <Link href="/repos" className="flex items-center gap-3 p-2.5 rounded-xl bg-yellow-500/5 border border-yellow-500/15 hover:bg-yellow-500/10 transition-colors group">
                        <div className="w-7 h-7 rounded-lg bg-yellow-500/15 flex items-center justify-center flex-shrink-0">
                          <AlertTriangle size={13} className="text-yellow-400" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm text-[#D0D0D0] font-medium group-hover:text-[#F0F0F0] transition-colors">
                            {stats.openIssues} open GitHub issue{stats.openIssues > 1 ? "s" : ""}
                          </p>
                          <p className="text-[10px] text-[#606060]">Across {stats.repos} connected repos</p>
                        </div>
                        <ArrowRight size={12} className="text-yellow-400/50 group-hover:text-yellow-400 transition-colors flex-shrink-0" />
                      </Link>
                    )}
                    {stats.inReview > 0 && (
                      <Link href="/repos" className="flex items-center gap-3 p-2.5 rounded-xl bg-[rgba(251,186,0,0.05)] border border-[rgba(251,186,0,0.12)] hover:bg-[rgba(251,186,0,0.09)] transition-colors group">
                        <div className="w-7 h-7 rounded-lg bg-[rgba(251,186,0,0.12)] flex items-center justify-center flex-shrink-0">
                          <GitPullRequest size={13} className="text-[#FBBA00]" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm text-[#D0D0D0] font-medium group-hover:text-[#F0F0F0] transition-colors">
                            {stats.inReview} under investigation
                          </p>
                          <p className="text-[10px] text-[#606060]">Research &amp; investigation queue</p>
                        </div>
                        <ArrowRight size={12} className="text-[#FBBA00]/40 group-hover:text-[#FBBA00] transition-colors flex-shrink-0" />
                      </Link>
                    )}
                    {stats.atRisk === 0 && stats.openIssues === 0 && stats.inReview === 0 && (
                      <div className="flex items-center gap-3 p-2.5 rounded-xl bg-emerald-500/5 border border-emerald-500/15">
                        <div className="w-7 h-7 rounded-lg bg-emerald-500/15 flex items-center justify-center flex-shrink-0">
                          <CheckCircle2 size={13} className="text-emerald-400" />
                        </div>
                        <p className="text-sm text-emerald-400/80">Everything looks clear — keep shipping!</p>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </motion.div>


        {/* ── Stats grid ───────────────────────────────────────────────────── */}
        <motion.div
          variants={container}
          initial="hidden"
          animate="show"
          className="grid grid-cols-2 xl:grid-cols-4 gap-4"
        >
          {/* Repos card */}
          <motion.div variants={item}>
            <Link href="/repos">
              <motion.div
                style={{ boxShadow: "0 4px 24px rgba(0,0,0,0.5), 0 1px 6px rgba(0,0,0,0.35), 0 16px 48px rgba(247,148,29,0.05)" }}
                whileHover={{ y: -3, boxShadow: "0 12px 48px rgba(0,0,0,0.6), 0 2px 10px rgba(0,0,0,0.4), 0 24px 72px rgba(247,148,29,0.14)" }}
                className="relative bg-[#141414] border border-[rgba(255,255,255,0.07)] rounded-2xl p-5 cursor-pointer transition-all duration-200 hover:border-[rgba(247,148,29,0.2)] h-full flex flex-col"
              >
                <div className="flex items-start justify-between mb-4">
                  <div className="w-9 h-9 rounded-xl flex items-center justify-center bg-[rgba(247,148,29,0.1)]">
                    <FolderGit2 size={18} className="text-[#F7941D]" />
                  </div>
                  <span className="text-[10px] font-semibold text-[#505050] bg-[rgba(255,255,255,0.04)] px-2 py-0.5 rounded-full">
                    Connected
                  </span>
                </div>

                <div className="text-3xl font-black text-[#F0F0F0] leading-none mb-1">{stats.repos}</div>
                <div className="text-xs font-semibold text-[#9A9A9A] mb-4">Active Repos</div>

                <div className="border-t border-[rgba(255,255,255,0.05)] pt-3 mt-auto space-y-2">
                  {cardData.topRepos.slice(0, 4).map((repo) => (
                    <div key={repo.name} className="flex items-center gap-2">
                      <LangDot lang={repo.language} />
                      <span className="text-[11px] text-[#707070] truncate font-mono flex-1">{repo.name}</span>
                      {repo.pushedAt && (
                        <span className="text-[10px] text-[#484848] flex-shrink-0">{timeAgo(repo.pushedAt)}</span>
                      )}
                    </div>
                  ))}
                  {cardData.topRepos.length === 0 && (
                    <p className="text-[11px] text-[#505050]">No repos yet</p>
                  )}
                </div>
              </motion.div>
            </Link>
          </motion.div>

          {/* In Progress card */}
          <motion.div variants={item}>
            <Link href="/repos">
              <motion.div
                style={{ boxShadow: "0 4px 24px rgba(0,0,0,0.5), 0 1px 6px rgba(0,0,0,0.35), 0 16px 48px rgba(59,130,246,0.05)" }}
                whileHover={{ y: -3, boxShadow: "0 12px 48px rgba(0,0,0,0.6), 0 2px 10px rgba(0,0,0,0.4), 0 24px 72px rgba(59,130,246,0.16)" }}
                className="relative bg-[#141414] border border-[rgba(255,255,255,0.07)] rounded-2xl p-5 cursor-pointer transition-all duration-200 hover:border-[rgba(59,130,246,0.2)] h-full flex flex-col"
              >
                <div className="flex items-start justify-between mb-4">
                  <div className="w-9 h-9 rounded-xl flex items-center justify-center bg-[rgba(59,130,246,0.1)]">
                    <TrendingUp size={18} className="text-blue-400" />
                  </div>
                  <span className="text-[10px] font-semibold text-blue-400/60 bg-blue-500/10 px-2 py-0.5 rounded-full">
                    Active
                  </span>
                </div>

                <div className="text-3xl font-black text-[#F0F0F0] leading-none mb-1">{stats.inProgress}</div>
                <div className="text-xs font-semibold text-[#9A9A9A] mb-4">In Progress</div>

                <div className="border-t border-[rgba(255,255,255,0.05)] pt-3 mt-auto space-y-2">
                  {cardData.inProgressTitles.slice(0, 3).map((title) => (
                    <div key={title} className="flex items-start gap-2">
                      <span className="w-1 h-1 rounded-full bg-blue-400/60 mt-1.5 flex-shrink-0" />
                      <span className="text-[11px] text-[#707070] line-clamp-1">{title}</span>
                    </div>
                  ))}
                  {cardData.inProgressTitles.length === 0 && (
                    <p className="text-[11px] text-[#505050]">Nothing in progress</p>
                  )}
                  {stats.inProgress > 3 && (
                    <p className="text-[10px] text-[#505050]">+{stats.inProgress - 3} more</p>
                  )}
                </div>
              </motion.div>
            </Link>
          </motion.div>

          {/* Research & Investigation card */}
          <motion.div variants={item}>
            <Link href="/repos">
              <motion.div
                style={{ boxShadow: "0 4px 24px rgba(0,0,0,0.5), 0 1px 6px rgba(0,0,0,0.35), 0 16px 48px rgba(251,186,0,0.04)" }}
                whileHover={{ y: -3, boxShadow: "0 12px 48px rgba(0,0,0,0.6), 0 2px 10px rgba(0,0,0,0.4), 0 24px 72px rgba(251,186,0,0.14)" }}
                className="relative bg-[#141414] border border-[rgba(255,255,255,0.07)] rounded-2xl p-5 cursor-pointer transition-all duration-200 hover:border-[rgba(251,186,0,0.2)] h-full flex flex-col"
              >
                <div className="flex items-start justify-between mb-4">
                  <div className="w-9 h-9 rounded-xl flex items-center justify-center bg-[rgba(251,186,0,0.1)]">
                    <GitPullRequest size={18} className="text-[#FBBA00]" />
                  </div>
                  <span className="text-[10px] font-semibold text-[#FBBA00]/60 bg-[rgba(251,186,0,0.08)] px-2 py-0.5 rounded-full">
                    R&amp;I
                  </span>
                </div>

                <div className="text-3xl font-black text-[#F0F0F0] leading-none mb-1">{stats.inReview}</div>
                <div className="text-xs font-semibold text-[#9A9A9A] mb-4">Research &amp; Investigation</div>

                <div className="border-t border-[rgba(255,255,255,0.05)] pt-3 mt-auto space-y-2">
                  {cardData.inReviewTitles.slice(0, 3).map((title) => (
                    <div key={title} className="flex items-start gap-2">
                      <span className="w-1 h-1 rounded-full bg-[#FBBA00]/60 mt-1.5 flex-shrink-0" />
                      <span className="text-[11px] text-[#707070] line-clamp-1">{title}</span>
                    </div>
                  ))}
                  {cardData.inReviewTitles.length === 0 && (
                    <p className="text-[11px] text-[#505050]">Nothing under investigation</p>
                  )}
                  {stats.inReview > 3 && (
                    <p className="text-[10px] text-[#505050]">+{stats.inReview - 3} more</p>
                  )}
                </div>
              </motion.div>
            </Link>
          </motion.div>

          {/* Open Issues / Customers card */}
          <motion.div variants={item}>
            <Link href="/customers">
              <motion.div
                style={{ boxShadow: "0 4px 24px rgba(0,0,0,0.5), 0 1px 6px rgba(0,0,0,0.35), 0 16px 48px rgba(239,68,68,0.05)" }}
                whileHover={{ y: -3, boxShadow: "0 12px 48px rgba(0,0,0,0.6), 0 2px 10px rgba(0,0,0,0.4), 0 24px 72px rgba(239,68,68,0.16)" }}
                className={`relative bg-[#141414] border rounded-2xl p-5 cursor-pointer transition-all duration-200 h-full flex flex-col ${stats.openIssues > 10 || stats.atRisk > 0
                  ? "border-red-500/20 hover:border-red-500/35"
                  : "border-[rgba(255,255,255,0.07)] hover:border-[rgba(239,68,68,0.2)]"
                  }`}
              >
                {(stats.openIssues > 10 || stats.atRisk > 0) && (
                  <span className="absolute top-3 right-3 w-2 h-2 bg-red-500 rounded-full animate-pulse" />
                )}
                <div className="flex items-start justify-between mb-4">
                  <div className="w-9 h-9 rounded-xl flex items-center justify-center bg-[rgba(239,68,68,0.1)]">
                    <Flame size={18} className="text-red-400" />
                  </div>
                  <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${stats.atRisk > 0
                    ? "text-red-400/80 bg-red-500/10"
                    : "text-[#505050] bg-[rgba(255,255,255,0.04)]"
                    }`}>
                    {stats.atRisk > 0 ? "Action needed" : "Healthy"}
                  </span>
                </div>

                <div className="text-3xl font-black text-[#F0F0F0] leading-none mb-1">{stats.openIssues}</div>
                <div className="text-xs font-semibold text-[#9A9A9A] mb-4">Open GitHub Issues</div>

                <div className="border-t border-[rgba(255,255,255,0.05)] pt-3 mt-auto space-y-2.5">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Users size={12} className="text-[#606060]" />
                      <span className="text-[11px] text-[#707070]">Customers</span>
                    </div>
                    <span className="text-[11px] font-semibold text-[#C0C0C0]">{stats.customerCount}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <TriangleAlert size={12} className={stats.atRisk > 0 ? "text-red-400" : "text-[#606060]"} />
                      <span className="text-[11px] text-[#707070]">At-risk</span>
                    </div>
                    <span className={`text-[11px] font-semibold ${stats.atRisk > 0 ? "text-red-400" : "text-[#505050]"}`}>
                      {stats.atRisk > 0 ? stats.atRisk : "None"}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="w-2 h-2 rounded-full bg-emerald-400/60" />
                      <span className="text-[11px] text-[#707070]">Done this week</span>
                    </div>
                    <span className="text-[11px] font-semibold text-[#505050]">{stats.done}</span>
                  </div>
                </div>
              </motion.div>
            </Link>
          </motion.div>
        </motion.div>
      </div>

      {/* Execution detail drawer — rendered from dashboard */}
      <AnimatePresence>
        {selectedExecution && (
          <ExecutionDetailDrawer
            execution={selectedExecution}
            onClose={() => setSelectedExecution(null)}
            onStatusChange={(id, status) => {
              // optimistic update in case user changes status
              setSelectedExecution((prev) => prev?.id === id ? { ...prev, status } : prev);
            }}
            onDelete={() => setSelectedExecution(null)}
            onRetry={async (exec) => {
              const res = await fetch("/api/agent-executions", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                  kanbanCardId: exec.kanbanCardId,
                  agentId: exec.agentId,
                  actionType: exec.actionType,
                  notes: exec.notes ?? undefined,
                }),
              });
              if (res.ok) {
                const execution = await res.json() as { id: string };
                kickoffExecutionProcessing(execution.id);
                await fetch(`/api/agent-executions/${exec.id}`, {
                  method: "PATCH",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({ status: "archived" }),
                });
              }
              setSelectedExecution(null);
            }}
          />
        )}
      </AnimatePresence>
    </>
  );
}
