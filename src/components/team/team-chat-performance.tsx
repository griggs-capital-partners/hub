"use client";

import { Profiler, useEffect, useRef, type ReactNode } from "react";

const TEAM_CHAT_PERF_STORAGE_KEY = "team-chat-perf-debug";
const TEAM_CHAT_PERF_GLOBAL_KEY = "__TEAM_CHAT_PERF__";
const TEAM_CHAT_PERF_MAX_EVENTS = 300;

type TeamChatPerfDetail = Record<string, unknown>;

type TeamChatPerfEvent = {
  kind: "event" | "measure" | "render" | "commit";
  name: string;
  at: number;
  detail: TeamChatPerfDetail | null;
  durationMs?: number;
  phase?: string;
  actualDuration?: number;
  baseDuration?: number;
  startTime?: number;
  commitTime?: number;
};

type TeamChatPerfCounter = {
  count: number;
  lastDetail: TeamChatPerfDetail | null;
  updatedAt: number;
};

type TeamChatPerfSpan = {
  name: string;
  startedAt: number;
  detail: TeamChatPerfDetail | null;
};

type TeamChatPerfStore = {
  enabled: boolean;
  counters: Record<string, TeamChatPerfCounter>;
  events: TeamChatPerfEvent[];
  spans: Record<string, TeamChatPerfSpan>;
  clear: () => void;
  setEnabled: (enabled: boolean) => void;
  summary: () => {
    enabled: boolean;
    counters: Record<string, TeamChatPerfCounter>;
    renderStats: Record<
      string,
      {
        commits: number;
        totalActualDuration: number;
        maxActualDuration: number;
        lastActualDuration: number;
        lastBaseDuration: number;
        lastDetail: TeamChatPerfDetail | null;
      }
    >;
    recentEvents: TeamChatPerfEvent[];
  };
};

type TeamChatPerfSummary = ReturnType<TeamChatPerfStore["summary"]>;

type TeamChatPerfWindow = Window & {
  __TEAM_CHAT_PERF__?: TeamChatPerfStore;
};

function isTeamChatPerfSupported() {
  return process.env.NODE_ENV !== "production" && typeof window !== "undefined";
}

function readPersistedPerfEnabled() {
  if (!isTeamChatPerfSupported()) {
    return false;
  }

  try {
    return window.localStorage.getItem(TEAM_CHAT_PERF_STORAGE_KEY) === "1";
  } catch {
    return false;
  }
}

function writePersistedPerfEnabled(enabled: boolean) {
  if (!isTeamChatPerfSupported()) {
    return;
  }

  try {
    if (enabled) {
      window.localStorage.setItem(TEAM_CHAT_PERF_STORAGE_KEY, "1");
    } else {
      window.localStorage.removeItem(TEAM_CHAT_PERF_STORAGE_KEY);
    }
  } catch {
    // Ignore optional local dev persistence failures.
  }
}

function createPerfStore(): TeamChatPerfStore {
  return {
    enabled: readPersistedPerfEnabled(),
    counters: {},
    events: [],
    spans: {},
    clear() {
      this.counters = {};
      this.events = [];
      this.spans = {};
    },
    setEnabled(enabled: boolean) {
      writePersistedPerfEnabled(enabled);
      this.enabled = enabled;
      if (!enabled) {
        this.clear();
      }
    },
    summary() {
      const renderStats = this.events.reduce<TeamChatPerfSummary["renderStats"]>(
        (stats, event) => {
          if (event.kind !== "render") {
            return stats;
          }

          const existing = stats[event.name] ?? {
            commits: 0,
            totalActualDuration: 0,
            maxActualDuration: 0,
            lastActualDuration: 0,
            lastBaseDuration: 0,
            lastDetail: null,
          };
          const actualDuration = event.actualDuration ?? 0;

          stats[event.name] = {
            commits: existing.commits + 1,
            totalActualDuration: existing.totalActualDuration + actualDuration,
            maxActualDuration: Math.max(existing.maxActualDuration, actualDuration),
            lastActualDuration: actualDuration,
            lastBaseDuration: event.baseDuration ?? 0,
            lastDetail: event.detail,
          };

          return stats;
        },
        {}
      );

      return {
        enabled: this.enabled,
        counters: this.counters,
        renderStats,
        recentEvents: this.events.slice(-25),
      };
    },
  };
}

function getPerfStore() {
  if (!isTeamChatPerfSupported()) {
    return null;
  }

  const perfWindow = window as TeamChatPerfWindow;
  const existingStore = perfWindow[TEAM_CHAT_PERF_GLOBAL_KEY];
  if (existingStore) {
    existingStore.enabled = readPersistedPerfEnabled();
    return existingStore;
  }

  const store = createPerfStore();
  perfWindow[TEAM_CHAT_PERF_GLOBAL_KEY] = store;
  return store;
}

function pushPerfEvent(event: TeamChatPerfEvent) {
  const store = getPerfStore();
  if (!store?.enabled) {
    return;
  }

  store.events.push(event);
  if (store.events.length > TEAM_CHAT_PERF_MAX_EVENTS) {
    store.events.splice(0, store.events.length - TEAM_CHAT_PERF_MAX_EVENTS);
  }
}

export function incrementTeamChatPerfCounter(name: string, detail?: TeamChatPerfDetail) {
  const store = getPerfStore();
  if (!store?.enabled) {
    return;
  }

  const current = store.counters[name];
  store.counters[name] = {
    count: (current?.count ?? 0) + 1,
    lastDetail: detail ?? null,
    updatedAt: performance.now(),
  };
}

export function recordTeamChatPerfEvent(name: string, detail?: TeamChatPerfDetail) {
  pushPerfEvent({
    kind: "event",
    name,
    at: performance.now(),
    detail: detail ?? null,
  });
}

export function startTeamChatPerfSpan(name: string, detail?: TeamChatPerfDetail) {
  const store = getPerfStore();
  if (!store?.enabled) {
    return null;
  }

  const spanId = `${name}:${Date.now()}:${Math.random().toString(36).slice(2, 8)}`;
  store.spans[spanId] = {
    name,
    startedAt: performance.now(),
    detail: detail ?? null,
  };

  pushPerfEvent({
    kind: "event",
    name: `${name}:start`,
    at: performance.now(),
    detail: detail ?? null,
  });

  return spanId;
}

export function finishTeamChatPerfSpan(spanId: string | null, detail?: TeamChatPerfDetail) {
  if (!spanId) {
    return;
  }

  const store = getPerfStore();
  const span = store?.spans[spanId];
  if (!store?.enabled || !span) {
    return;
  }

  const finishedAt = performance.now();
  const durationMs = finishedAt - span.startedAt;
  delete store.spans[spanId];

  pushPerfEvent({
    kind: "measure",
    name: span.name,
    at: finishedAt,
    durationMs,
    detail: {
      ...(span.detail ?? {}),
      ...(detail ?? {}),
    },
  });
}

export function useTeamChatPerfCommit(name: string, detail?: TeamChatPerfDetail) {
  const commitCountRef = useRef(0);

  useEffect(() => {
    const store = getPerfStore();
    if (!store?.enabled) {
      return;
    }

    commitCountRef.current += 1;
    incrementTeamChatPerfCounter(`commit:${name}`, {
      ...(detail ?? {}),
      commitCount: commitCountRef.current,
    });
    pushPerfEvent({
      kind: "commit",
      name,
      at: performance.now(),
      detail: {
        ...(detail ?? {}),
        commitCount: commitCountRef.current,
      },
    });
  });
}

export function TeamChatPerfBoundary({
  id,
  detail,
  children,
}: {
  id: string;
  detail?: TeamChatPerfDetail;
  children: ReactNode;
}) {
  if (process.env.NODE_ENV === "production") {
    return <>{children}</>;
  }

  return (
    <Profiler
      id={id}
      onRender={(_id, phase, actualDuration, baseDuration, startTime, commitTime) => {
        const store = getPerfStore();
        if (!store?.enabled) {
          return;
        }

        incrementTeamChatPerfCounter(`render:${id}`, {
          ...(detail ?? {}),
          phase,
          actualDuration,
          baseDuration,
        });
        pushPerfEvent({
          kind: "render",
          name: id,
          at: performance.now(),
          detail: detail ?? null,
          phase,
          actualDuration,
          baseDuration,
          startTime,
          commitTime,
        });
      }}
    >
      {children}
    </Profiler>
  );
}
