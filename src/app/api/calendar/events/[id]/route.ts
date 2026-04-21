import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  await auth();
  const { id } = await params;
  const body = await req.json();

  const { title, type, startDate, endDate, allDay, location, description, isRecurring, recurrence } = body;

  const event = await prisma.calendarEvent.update({
    where: { id },
    data: {
      ...(title !== undefined && { title: String(title).trim() }),
      ...(type !== undefined && { type }),
      ...(startDate !== undefined && { startDate: new Date(startDate) }),
      ...(endDate !== undefined && { endDate: endDate ? new Date(endDate) : null }),
      ...(allDay !== undefined && { allDay }),
      ...(location !== undefined && { location: location || null }),
      ...(description !== undefined && { description: description || null }),
      ...(isRecurring !== undefined && { isRecurring }),
      ...(recurrence !== undefined && { recurrence: recurrence || null }),
    },
  });

  return NextResponse.json(event);
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  await auth();
  const { id } = await params;
  await prisma.calendarEvent.delete({ where: { id } });
  return NextResponse.json({ success: true });
}
