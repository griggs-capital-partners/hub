import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { DashboardClient } from "@/components/dashboard/DashboardClient";
import { redirect } from "next/navigation";
import { getTodayWeather } from "@/lib/weather";
import { getHubSettings } from "@/lib/hub-settings";
import type { ExecutionRecord } from "@/components/agents/AgentExecutionBoard";
import { ACTIVE_COLUMN, BACKLOG_COLUMN, normalizeKanbanColumnName } from "@/lib/kanban-columns";

function parseAssigneeIds(raw: string) {
  try {
    const value = JSON.parse(raw);
    return Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : [];
  } catch {
    return [];
  }
}

export default async function DashboardPage() {
  const session = await auth();

  if (!session?.user) {
    redirect("/login");
  }

  const sevenDaysAgo = new Date();
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

  // Repos with names, languages, and push time — sorted by most recently pushed
  const reposRaw = await prisma.repo.findMany({
    where: { connected: true },
    select: { name: true, language: true, openIssues: true, pushedAt: true },
  });
  // Sort by pushedAt desc (nulls last)
  const repos = reposRaw.sort(
    (a, b) => (b.pushedAt?.valueOf() ?? 0) - (a.pushedAt?.valueOf() ?? 0)
  );

  // Activity feed
  const activity = await prisma.activityEvent.findMany({
    where: { createdAt: { gte: sevenDaysAgo } },
    orderBy: { createdAt: "desc" },
    take: 50,
  });

  // Kanban cards with titles for the card previews
  const allCards = await prisma.kanbanCard.findMany({
    where: {
      column: { board: { repo: { connected: true } } },
    },
    select: {
      id: true,
      title: true,
      assignees: true,
      updatedAt: true,
      column: { select: { name: true } },
    },
  });

  const myCards = allCards.filter((card) => parseAssigneeIds(card.assignees).includes(session.user.id));
  const inProgressCards = myCards.filter((c) => normalizeKanbanColumnName(c.column.name) === ACTIVE_COLUMN);
  const backlogCards = myCards.filter((c) => c.column.name === BACKLOG_COLUMN);
  const inReviewCards: typeof myCards = [];
  const doneThisWeekCards = myCards.filter(
    (c) => ["Done", "Closed"].includes(c.column.name) && c.updatedAt >= sevenDaysAgo
  );

  // Customer counts
  const customerCount = await prisma.oilWell.count();
  const atRisk = await prisma.oilWell.count({
    where: {
      OR: [
        { status: { in: ["inactive", "plugged"] } },
        { priority: { in: ["critical", "high"] } },
      ],
    },
  });

  // Recent agent executions (full data for drawer)
  const rawExecutions = await prisma.agentTaskExecution.findMany({
    take: 10,
    orderBy: { createdAt: "desc" },
    include: {
      agent: { select: { id: true, name: true, role: true, avatar: true, abilities: true } },
      kanbanCard: {
        select: {
          id: true, title: true, priority: true, body: true, state: true, labels: true, githubIssueUrl: true,
          column: { select: { name: true } },
        },
      },
      triggeredBy: { select: { displayName: true, name: true, image: true } },
    },
  });
  const recentExecutions: ExecutionRecord[] = rawExecutions.map((e) => ({
    id: e.id,
    kanbanCardId: e.kanbanCardId,
    agentId: e.agentId,
    actionType: e.actionType,
    status: e.status,
    response: e.response,
    errorMessage: e.errorMessage,
    modelUsed: e.modelUsed,
    notes: e.notes,
    createdAt: e.createdAt.toISOString(),
    updatedAt: e.updatedAt.toISOString(),
    agent: e.agent,
    kanbanCard: e.kanbanCard,
    triggeredBy: e.triggeredBy
      ? { displayName: e.triggeredBy.displayName, name: e.triggeredBy.name, image: e.triggeredBy.image }
      : null,
  }));

  const stats = {
    repos: repos.length,
    backlog: backlogCards.length,
    inProgress: inProgressCards.length,
    inReview: inReviewCards.length,
    done: doneThisWeekCards.length,
    customerCount,
    atRisk,
    openIssues: repos.reduce((s, r) => s + r.openIssues, 0),
  };

  const cardData = {
    topRepos: repos.slice(0, 5).map((r) => ({ name: r.name, language: r.language, pushedAt: r.pushedAt })),
    inProgressTitles: inProgressCards.slice(0, 4).map((c) => c.title),
    inReviewTitles: inReviewCards.slice(0, 4).map((c) => c.title),
    customers: { total: customerCount, atRisk },
  };

  const hubSettings = await getHubSettings();
  const weather = await getTodayWeather({
    weatherLocationMode: hubSettings?.weatherLocationMode ?? "hub",
    locationName: hubSettings?.locationName ?? null,
    latitude: hubSettings?.latitude ?? null,
    longitude: hubSettings?.longitude ?? null,
    timezone: hubSettings?.timezone ?? null,
  });

  return (
    <DashboardClient
      user={session.user}
      activity={activity}
      stats={stats}
      cardData={cardData}
      recentExecutions={recentExecutions}
      weatherLocationMode={hubSettings?.weatherLocationMode ?? "hub"}
      weather={weather}
    />
  );
}
