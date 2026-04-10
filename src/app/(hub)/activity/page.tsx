import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { WildfiresClient } from "@/components/activity/WildfiresClient";

export default async function ActivityPage() {
  await auth();

  const repos = await prisma.repo.findMany({
    where: {
      openIssues: { gt: 0 },
      connected: true,
    },
    orderBy: { openIssues: "desc" },
  });

  const criticalCards = await prisma.kanbanCard.findMany({
    where: {
      priority: { in: ["critical", "high"] },
      column: {
        board: {
          repo: {
            connected: true,
          },
        },
      },
    },
    include: {
      column: {
        include: {
          board: {
            include: { repo: true },
          },
        },
      },
    },
    orderBy: { updatedAt: "desc" },
    take: 20,
  });

  const atRiskCustomers = await prisma.customer.findMany({
    where: { status: { in: ["at-risk", "inactive"] } },
    orderBy: { healthScore: "asc" }, // lowest health first
    select: { id: true, name: true, industry: true, status: true, healthScore: true },
  });

  const activity = await prisma.activityEvent.findMany({
    where: { type: { not: "jam.vibe" } },
    orderBy: { createdAt: "desc" },
    take: 20,
  });

  return (
    <WildfiresClient
      repos={repos}
      criticalCards={criticalCards}
      atRiskCustomers={atRiskCustomers}
      activity={activity}
    />
  );
}
