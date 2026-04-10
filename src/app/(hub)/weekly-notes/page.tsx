import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { WeeklyNotesClient } from "@/components/weekly-notes/WeeklyNotesClient";

export default async function WeeklyNotesPage() {
  await auth();

  const [weeklyNotes, customers] = await Promise.all([
    prisma.weeklyNote.findMany({
      orderBy: { weekStart: "desc" },
      include: {
        entries: {
          orderBy: { order: "asc" },
          include: {
            customer: {
              select: { id: true, name: true, logoUrl: true, healthScore: true, tier: true, status: true },
            },
          },
        },
      },
    }),
    prisma.customer.findMany({
      where: { status: { not: "inactive" } },
      orderBy: { name: "asc" },
      select: { id: true, name: true, logoUrl: true, healthScore: true, tier: true, status: true },
    }),
  ]);

  const serialized = weeklyNotes.map((note) => ({
    ...note,
    weekStart: note.weekStart.toISOString(),
    createdAt: note.createdAt.toISOString(),
    updatedAt: note.updatedAt.toISOString(),
    entries: note.entries.map((entry) => ({
      ...entry,
      createdAt: entry.createdAt.toISOString(),
      updatedAt: entry.updatedAt.toISOString(),
    })),
  }));

  return <WeeklyNotesClient initialNotes={serialized} customers={customers} />;
}
