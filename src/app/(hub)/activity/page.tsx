import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { WildfiresClient } from "@/components/activity/WildfiresClient";
import { mapWellPriorityToHealthScore, mapWellStatusToCustomerStatus } from "@/lib/well-compat";

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

  const atRiskWells = await prisma.oilWell.findMany({
    where: {
      OR: [
        { status: { in: ["inactive", "plugged"] } },
        { priority: { in: ["critical", "high"] } },
      ],
    },
    orderBy: [{ priority: "asc" }, { updatedAt: "desc" }],
    select: { id: true, name: true, address: true, status: true, priority: true },
  });

  const activity = await prisma.activityEvent.findMany({
    orderBy: { createdAt: "desc" },
    take: 20,
  });

  return (
    <WildfiresClient
      repos={repos}
      criticalCards={criticalCards}
      atRiskCustomers={atRiskWells.map((well) => ({
        id: well.id,
        name: well.name,
        industry: well.address,
        status: mapWellStatusToCustomerStatus(well.status, well.priority),
        healthScore: mapWellPriorityToHealthScore(well.priority),
      }))}
      activity={activity}
    />
  );
}
