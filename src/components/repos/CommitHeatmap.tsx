"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { GitCommit, X, ExternalLink } from "lucide-react";

interface CommitInfo {
  sha: string;
  message: string;
  author: string;
  url: string;
}

interface RepoCommits {
  name: string;
  commits: CommitInfo[];
}

interface HeatmapDay {
  date: string;
  count: number;
  repos: RepoCommits[];
}

interface SelectedDay extends HeatmapDay {
  clientX: number;
  clientY: number;
}

function getLevel(count: number): 0 | 1 | 2 | 3 | 4 {
  if (count === 0) return 0;
  if (count <= 2) return 1;
  if (count <= 5) return 2;
  if (count <= 9) return 3;
  return 4;
}

const LEVEL_BG = [
  "rgba(255,255,255,0.04)",
  "rgba(247,148,29,0.22)",
  "rgba(247,148,29,0.44)",
  "rgba(247,148,29,0.68)",
  "rgba(247,148,29,1)",
];

const LEVEL_BORDER = [
  "rgba(255,255,255,0.07)",
  "transparent",
  "transparent",
  "transparent",
  "transparent",
];

function formatDate(dateStr: string) {
  const [y, m, d] = dateStr.split("-").map(Number);
  return new Date(y, m - 1, d).toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
  });
}

const GAP = 2;        // gap between week columns (px)
const YEAR_GAP = 14;  // gap at year boundary (px) — replaces one normal GAP
const WEEKS = 52;
const MIN_CELL = 7;
const MAX_CELL = 12;  // smaller cap so it stays compact

interface GridData {
  weeks: (string | null)[][];
  monthLabels: { weekIdx: number; label: string; isYearBoundary: boolean }[];
  yearBoundaries: { weekIdx: number; year: number }[];
}

function buildGrid(): GridData {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const startDate = new Date(today);
  startDate.setDate(startDate.getDate() - WEEKS * 7 - today.getDay());

  const weeks: (string | null)[][] = [];
  const current = new Date(startDate);

  for (let w = 0; w <= WEEKS; w++) {
    const week: (string | null)[] = [];
    for (let d = 0; d < 7; d++) {
      week.push(current <= today ? current.toISOString().slice(0, 10) : null);
      current.setDate(current.getDate() + 1);
    }
    weeks.push(week);
  }

  // Year boundaries: week index of first week in each new year (skip the very first year)
  const yearBoundaries: { weekIdx: number; year: number }[] = [];
  const seenYears = new Set<number>();
  for (let w = 0; w < weeks.length; w++) {
    const firstDay = weeks[w].find(Boolean);
    if (!firstDay) continue;
    const year = parseInt(firstDay.slice(0, 4));
    if (!seenYears.has(year)) {
      seenYears.add(year);
      if (w > 0) yearBoundaries.push({ weekIdx: w, year });
    }
  }

  const yearBoundaryWeeks = new Map(yearBoundaries.map((b) => [b.weekIdx, b.year]));

  // Month labels — at year boundaries replace "Jan" with the year number
  const monthLabels: { weekIdx: number; label: string; isYearBoundary: boolean }[] = [];
  for (let w = 0; w < weeks.length; w++) {
    const firstDay = weeks[w].find(Boolean);
    if (!firstDay) continue;
    const [, m, d] = firstDay.split("-").map(Number);
    if (d <= 7) {
      const isYearBoundary = yearBoundaryWeeks.has(w);
      const label = isYearBoundary
        ? String(yearBoundaryWeeks.get(w))
        : new Date(2000, m - 1, 1).toLocaleDateString("en-US", { month: "short" });
      if (!monthLabels.length || monthLabels[monthLabels.length - 1].label !== label) {
        monthLabels.push({ weekIdx: w, label, isYearBoundary });
      }
    }
  }

  return { weeks, monthLabels, yearBoundaries };
}

export function CommitHeatmap() {
  const [days, setDays] = useState<HeatmapDay[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedDay, setSelectedDay] = useState<SelectedDay | null>(null);
  const [cellSize, setCellSize] = useState(10);
  const [weeksToShow, setWeeksToShow] = useState(WEEKS);
  const gridRef = useRef<HTMLDivElement>(null);
  const popupRef = useRef<HTMLDivElement>(null);
  const { weeks, monthLabels, yearBoundaries } = buildGrid();

  // Derived slice — only the most-recent weeksToShow weeks
  const startIdx = Math.max(0, weeks.length - weeksToShow);
  const visibleWeeks = weeks.slice(startIdx);
  const visibleYearBoundaries = yearBoundaries
    .filter((b) => b.weekIdx >= startIdx)
    .map((b) => ({ ...b, weekIdx: b.weekIdx - startIdx }));
  const visibleMonthLabels = monthLabels
    .filter((m) => m.weekIdx >= startIdx)
    .map((m) => ({ ...m, weekIdx: m.weekIdx - startIdx }));

  function getVisibleWeekX(wi: number, cs: number): number {
    const numExtraGaps = visibleYearBoundaries.filter((b) => b.weekIdx <= wi).length;
    return wi * (cs + GAP) + numExtraGaps * (YEAR_GAP - GAP);
  }

  // x(wi) = wi*(cellSize+GAP) + numYearGaps(wi)*(YEAR_GAP - GAP)
  // where numYearGaps(wi) = count of yearBoundaries with weekIdx <= wi
  function getWeekX(wi: number, cs: number): number {
    const numExtraGaps = yearBoundaries.filter((b) => b.weekIdx <= wi).length;
    return wi * (cs + GAP) + numExtraGaps * (YEAR_GAP - GAP);
  }

  const updateCellSize = useCallback(() => {
    if (!gridRef.current) return;
    const w = gridRef.current.getBoundingClientRect().width;
    const numWeeks = weeks.length;
    const extraGapTotal = yearBoundaries.length * (YEAR_GAP - GAP);
    const computed = Math.floor((w - (numWeeks - 1) * GAP - extraGapTotal) / numWeeks);

    if (computed < MIN_CELL) {
      // Container too narrow for full year — show only the weeks that fit at MIN_CELL
      const fittable = Math.floor((w + GAP) / (MIN_CELL + GAP));
      setWeeksToShow(Math.max(4, Math.min(WEEKS, fittable)));
      setCellSize(MIN_CELL);
    } else {
      setCellSize(Math.min(MAX_CELL, computed));
      setWeeksToShow(WEEKS);
    }
    setSelectedDay(null);
  }, [weeks.length, yearBoundaries.length]);

  useEffect(() => {
    updateCellSize();
    const ro = new ResizeObserver(updateCellSize);
    if (gridRef.current) ro.observe(gridRef.current);
    return () => ro.disconnect();
  }, [updateCellSize]);

  useEffect(() => {
    fetch("/api/github/heatmap")
      .then((r) => r.json())
      .then((data) => {
        setDays(data.days ?? []);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (!selectedDay) return;
    const onMouse = (e: MouseEvent) => {
      if (popupRef.current && !popupRef.current.contains(e.target as Node))
        setSelectedDay(null);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setSelectedDay(null);
    };
    document.addEventListener("mousedown", onMouse);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onMouse);
      document.removeEventListener("keydown", onKey);
    };
  }, [selectedDay]);

  const dayMap = new Map<string, HeatmapDay>();
  for (const d of days) dayMap.set(d.date, d);

  const totalCommits = days.reduce((s, d) => s + d.count, 0);
  const activeDays = days.filter((d) => d.count > 0).length;

  const gridRows = 7;
  const gridHeight = gridRows * cellSize + (gridRows - 1) * GAP;
  const gridWidth =
    visibleWeeks.length * cellSize +
    (visibleWeeks.length - 1) * GAP +
    visibleYearBoundaries.length * (YEAR_GAP - GAP);

  function handleCellClick(dateStr: string, e: React.MouseEvent) {
    const day = dayMap.get(dateStr);
    if (!day || day.count === 0) { setSelectedDay(null); return; }
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    setSelectedDay({ ...day, clientX: rect.left + rect.width / 2, clientY: rect.top });
  }

  return (
    <>
      <div className="bg-[#151515] border border-[rgba(255,255,255,0.07)] rounded-xl px-4 pt-3 pb-3">
        {/* Header */}
        <div className="flex items-center justify-between mb-2 flex-wrap gap-2">
          <div className="flex items-center gap-2">
            <div className="w-5 h-5 rounded-md bg-[rgba(247,148,29,0.12)] flex items-center justify-center">
              <GitCommit size={11} className="text-[#F7941D]" />
            </div>
            <span className="text-xs font-bold text-[#D0D0D0]">Commit Activity</span>
            {!loading && totalCommits > 0 && (
              <span className="text-[11px] text-[#454545]">
                {totalCommits.toLocaleString()} commits · {activeDays} active days
              </span>
            )}
          </div>
          <div className="flex items-center gap-1.5 text-[10px] text-[#383838]">
            <span>Less</span>
            {LEVEL_BG.map((bg, i) => (
              <div
                key={i}
                className="rounded-[2px] flex-shrink-0"
                style={{
                  width: 9,
                  height: 9,
                  backgroundColor: bg,
                  border: `1px solid ${LEVEL_BORDER[i]}`,
                }}
              />
            ))}
            <span>More</span>
          </div>
        </div>

        {/* Grid */}
        <div ref={gridRef} className="w-full">
          {loading ? (
            <div style={{ height: gridHeight + 16 }}>
              <div className="h-4 mb-1" />
              <div className="flex w-full" style={{ gap: GAP }}>
                {Array.from({ length: 53 }).map((_, i) => (
                  <div key={i} className="flex-1 flex flex-col" style={{ gap: GAP }}>
                    {Array.from({ length: 7 }).map((_, j) => (
                      <div
                        key={j}
                        className="rounded-[2px] animate-pulse w-full"
                        style={{
                          height: cellSize,
                          backgroundColor: "rgba(255,255,255,0.04)",
                          animationDelay: `${(i * 7 + j) * 5}ms`,
                        }}
                      />
                    ))}
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div style={{ width: gridWidth, margin: "0 auto" }}>
              {/* Month / year labels */}
              <div className="relative mb-1" style={{ height: 14 }}>
                {visibleMonthLabels.map(({ weekIdx, label, isYearBoundary }) => (
                  <span
                    key={`${weekIdx}-${label}`}
                    className="absolute text-[10px] select-none"
                    style={{
                      left: getVisibleWeekX(weekIdx, cellSize),
                      color: isYearBoundary
                        ? "rgba(247,148,29,0.75)"
                        : "rgba(255,255,255,0.25)",
                      fontWeight: isYearBoundary ? 700 : 400,
                    }}
                  >
                    {label}
                  </span>
                ))}
              </div>

              {/* Week columns rendered with absolute positioning */}
              <div className="relative" style={{ height: gridHeight }}>
                {visibleWeeks.map((week, wi) => (
                  <div
                    key={wi}
                    className="absolute top-0 flex flex-col"
                    style={{ left: getVisibleWeekX(wi, cellSize), width: cellSize, gap: GAP }}
                  >
                    {week.map((dateStr, di) => {
                      if (!dateStr) {
                        return <div key={di} style={{ height: cellSize }} />;
                      }
                      const day = dayMap.get(dateStr);
                      const count = day?.count ?? 0;
                      const level = getLevel(count);
                      const isSelected = selectedDay?.date === dateStr;

                      return (
                        <div
                          key={di}
                          onClick={count > 0 ? (e) => handleCellClick(dateStr, e) : undefined}
                          style={{
                            height: cellSize,
                            backgroundColor: LEVEL_BG[level],
                            border: isSelected
                              ? "1px solid rgba(247,148,29,0.9)"
                              : `1px solid ${LEVEL_BORDER[level]}`,
                            boxShadow: isSelected
                              ? "0 0 5px rgba(247,148,29,0.4)"
                              : level === 4
                              ? "0 0 3px rgba(247,148,29,0.25)"
                              : "none",
                          }}
                          className={`rounded-[2px] transition-all duration-75 ${
                            count > 0
                              ? "cursor-pointer hover:brightness-125 hover:scale-110"
                              : ""
                          }`}
                          title={
                            count > 0
                              ? `${formatDate(dateStr)} — ${count} commit${count !== 1 ? "s" : ""}`
                              : formatDate(dateStr)
                          }
                        />
                      );
                    })}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Popup */}
      <AnimatePresence>
        {selectedDay && (
          <motion.div
            ref={popupRef}
            initial={{ opacity: 0, scale: 0.94, y: 6 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.94, y: 6 }}
            transition={{ duration: 0.13, ease: "easeOut" }}
            style={{
              position: "fixed",
              left: Math.max(
                8,
                Math.min(
                  selectedDay.clientX - 144,
                  (typeof window !== "undefined" ? window.innerWidth : 1200) - 304
                )
              ),
              top: selectedDay.clientY - 12,
              transform: "translateY(-100%)",
              zIndex: 9999,
            }}
            className="w-72 bg-[#0C0C0C] border border-[rgba(247,148,29,0.2)] rounded-xl shadow-2xl shadow-black/70 overflow-hidden"
          >
            <div className="flex items-start justify-between px-3 pt-3 pb-2 border-b border-[rgba(255,255,255,0.06)]">
              <div>
                <div className="text-[11px] font-semibold text-[#F7941D]">
                  {formatDate(selectedDay.date)}
                </div>
                <div className="text-xs text-[#707070] mt-0.5">
                  {selectedDay.count} commit{selectedDay.count !== 1 ? "s" : ""} across{" "}
                  {selectedDay.repos.length} repo{selectedDay.repos.length !== 1 ? "s" : ""}
                </div>
              </div>
              <button
                onClick={() => setSelectedDay(null)}
                className="text-[#404040] hover:text-[#A0A0A0] transition-colors mt-0.5 flex-shrink-0"
              >
                <X size={12} />
              </button>
            </div>

            <div className="max-h-56 overflow-y-auto px-3 py-2 space-y-3">
              {selectedDay.repos.map((repo) => (
                <div key={repo.name}>
                  <div className="text-[9px] font-bold text-[#505050] uppercase tracking-widest mb-1.5">
                    {repo.name}
                  </div>
                  <div className="space-y-1.5">
                    {repo.commits.slice(0, 6).map((commit) => (
                      <a
                        key={commit.sha}
                        href={commit.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-start gap-2 group/c"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <code className="text-[10px] text-[#3A3A3A] font-mono mt-0.5 flex-shrink-0 group-hover/c:text-[#F7941D] transition-colors">
                          {commit.sha}
                        </code>
                        <div className="min-w-0 flex-1">
                          <span className="text-[11px] text-[#B0B0B0] leading-snug group-hover/c:text-[#F0F0F0] transition-colors line-clamp-2">
                            {commit.message}
                          </span>
                          <div className="text-[9px] text-[#404040] mt-0.5">{commit.author}</div>
                        </div>
                        <ExternalLink
                          size={9}
                          className="text-[#2A2A2A] group-hover/c:text-[#F7941D] transition-colors flex-shrink-0 mt-1"
                        />
                      </a>
                    ))}
                    {repo.commits.length > 6 && (
                      <div className="text-[10px] text-[#383838] pl-8">
                        +{repo.commits.length - 6} more
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
