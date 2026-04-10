import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { RoadmapClient } from "@/components/roadmap/RoadmapClient";

export default async function RoadmapPage() {
  const session = await auth();
  if (!session) redirect("/login");

  const [repos, hiddenRepos, cards] = await Promise.all([
    prisma.repo.findMany({
      where: { connected: true, showInRoadmap: true },
      select: { id: true, name: true, fullName: true, description: true, roadmapOrder: true },
      orderBy: { roadmapOrder: "asc" },
    }),
    prisma.repo.findMany({
      where: { connected: true, showInRoadmap: false },
      select: { id: true, name: true, fullName: true, description: true, roadmapOrder: true },
      orderBy: { name: "asc" },
    }),
    prisma.roadmapCard.findMany({
      orderBy: [{ year: "asc" }, { quarter: "asc" }],
    }),
  ]);

  const serializedCards = cards.map((c) => ({
    ...c,
    createdAt: c.createdAt.toISOString(),
    updatedAt: c.updatedAt.toISOString(),
  }));

  return (
    <RoadmapClient
      initialRepos={repos}
      hiddenRepos={hiddenRepos}
      initialCards={serializedCards}
    />
  );
}
