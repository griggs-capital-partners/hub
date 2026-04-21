import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET() {
  await auth();
  const events = await prisma.calendarEvent.findMany({
    orderBy: { startDate: "asc" },
  });
  return NextResponse.json(events);
}

export async function POST(req: NextRequest) {
  const session = await auth();
  const body = await req.json();

  const { title, type, startDate, endDate, allDay, location, description, isRecurring, recurrence } = body;
  if (!title || !startDate) {
    return NextResponse.json({ error: "title and startDate required" }, { status: 400 });
  }

  const event = await prisma.calendarEvent.create({
    data: {
      title: String(title).trim(),
      type: type ?? "event",
      startDate: new Date(startDate),
      endDate: endDate ? new Date(endDate) : null,
      allDay: allDay ?? false,
      location: location || null,
      description: description || null,
      isRecurring: isRecurring ?? false,
      recurrence: recurrence || null,
      createdById: session?.user?.id ?? null,
    },
  });

  return NextResponse.json(event, { status: 201 });
}
