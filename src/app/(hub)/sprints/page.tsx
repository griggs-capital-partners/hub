import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { SprintsClient } from "@/components/sprints/SprintsClient";

export default async function SprintsPage() {
  await auth();

  const [sprints, users] = await Promise.all([
    prisma.sprint.findMany({
      orderBy: { startDate: "desc" },
      include: {
        tasks: {
          include: {
            assignee: true,
            kanbanCard: {
              select: {
                id: true,
                title: true,
                priority: true,
                column: { select: { name: true, board: { select: { repo: { select: { id: true, name: true } } } } } },
              },
            },
          },
          orderBy: { position: "asc" },
        },
        comments: {
          include: { author: true },
          orderBy: { createdAt: "desc" },
        },
      },
    }),
    prisma.user.findMany({
      orderBy: { name: "asc" },
      select: { id: true, name: true, displayName: true, email: true, image: true },
    }),
  ]);

  const serialized = sprints.map((s) => ({
    ...s,
    startDate: s.startDate.toISOString(),
    endDate: s.endDate.toISOString(),
    createdAt: s.createdAt.toISOString(),
    updatedAt: s.updatedAt.toISOString(),
    tasks: s.tasks.map((t) => ({
      ...t,
      createdAt: t.createdAt.toISOString(),
      updatedAt: t.updatedAt.toISOString(),
    })),
    comments: s.comments.map((c) => ({
      ...c,
      createdAt: c.createdAt.toISOString(),
      author: {
        ...c.author,
        createdAt: c.author.createdAt.toISOString(),
        updatedAt: c.author.updatedAt.toISOString(),
      },
    })),
  }));

  return <SprintsClient initialSprints={serialized} users={users} />;
}
