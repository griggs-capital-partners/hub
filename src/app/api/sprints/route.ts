import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET() {
  await auth();

  const sprints = await prisma.sprint.findMany({
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
  });

  return NextResponse.json(sprints);
}

export async function POST(req: NextRequest) {
  const session = await auth();
  const body = await req.json();

  const { name, goal, startDate, endDate, velocity } = body;
  if (!name || !startDate || !endDate) {
    return NextResponse.json({ error: "name, startDate, endDate required" }, { status: 400 });
  }

  const sprint = await prisma.sprint.create({
    data: {
      name,
      goal: goal ?? null,
      startDate: new Date(startDate),
      endDate: new Date(endDate),
      velocity: velocity ? Number(velocity) : null,
      status: "planning",
    },
    include: {
      tasks: {
        include: {
          assignee: true,
          kanbanCard: { select: { id: true, title: true, priority: true, column: { select: { name: true, board: { select: { repo: { select: { id: true, name: true } } } } } } } },
        },
      },
      comments: { include: { author: true } },
    },
  });

  return NextResponse.json(sprint, { status: 201 });
}
