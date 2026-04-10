import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { WeeklyNotesClient } from "@/components/weekly-notes/WeeklyNotesClient";
import { mapWellToWeeklyCustomerSnap } from "@/lib/well-compat";

export default async function WeeklyNotesPage() {
  await auth();

  const [weeklyNotes, wells] = await Promise.all([
    prisma.weeklyNote.findMany({
      orderBy: { weekStart: "desc" },
      include: {
        entries: {
          orderBy: { order: "asc" },
          include: {
            customer: {
              select: { id: true, name: true, status: true, priority: true },
            },
          },
        },
      },
    }),
    prisma.oilWell.findMany({
      where: { status: { not: "inactive" } },
      orderBy: { name: "asc" },
      select: { id: true, name: true, status: true, priority: true },
    }),
  ]);

  const serialized = weeklyNotes.map((note) => ({
    ...note,
    weekStart: note.weekStart.toISOString(),
    createdAt: note.createdAt.toISOString(),
    updatedAt: note.updatedAt.toISOString(),
    entries: note.entries.map((entry) => ({
      ...entry,
      customer: mapWellToWeeklyCustomerSnap(entry.customer),
      createdAt: entry.createdAt.toISOString(),
      updatedAt: entry.updatedAt.toISOString(),
    })),
  }));

  return <WeeklyNotesClient initialNotes={serialized} customers={wells.map((well) => mapWellToWeeklyCustomerSnap(well)!)} />;
}
