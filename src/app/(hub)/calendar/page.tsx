import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { CalendarClient } from "@/components/calendar/CalendarClient";

export default async function CalendarPage() {
  await auth();

  const events = await prisma.calendarEvent.findMany({ orderBy: { startDate: "asc" } });

  const serializedEvents = events.map((e) => ({
    ...e,
    startDate: e.startDate.toISOString(),
    endDate: e.endDate ? e.endDate.toISOString() : null,
    createdAt: e.createdAt.toISOString(),
    updatedAt: e.updatedAt.toISOString(),
  }));

  return <CalendarClient initialEvents={serializedEvents} initialSprints={[]} />;
}
