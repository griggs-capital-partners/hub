import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  await auth();
  const { id } = await params;

  const sprint = await prisma.sprint.findUnique({
    where: { id },
    include: {
      tasks: {
        include: { assignee: true },
        orderBy: { position: "asc" },
      },
      comments: {
        include: { author: true },
        orderBy: { createdAt: "desc" },
      },
    },
  });

  if (!sprint) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json(sprint);
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  await auth();
  const { id } = await params;
  const body = await req.json();

  // When activating a sprint, deactivate any other currently active sprints first
  if (body.status === "active") {
    await prisma.sprint.updateMany({
      where: { status: "active", id: { not: id } },
      data: { status: "planning" },
    });
  }

  const sprint = await prisma.sprint.update({
    where: { id },
    data: {
      ...(body.name !== undefined && { name: body.name }),
      ...(body.goal !== undefined && { goal: body.goal }),
      ...(body.status !== undefined && { status: body.status }),
      ...(body.startDate !== undefined && { startDate: new Date(body.startDate) }),
      ...(body.endDate !== undefined && { endDate: new Date(body.endDate) }),
      ...(body.velocity !== undefined && { velocity: body.velocity ? Number(body.velocity) : null }),
    },
    include: {
      tasks: { include: { assignee: true }, orderBy: { position: "asc" } },
      comments: { include: { author: true }, orderBy: { createdAt: "desc" } },
    },
  });

  return NextResponse.json(sprint);
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  await auth();
  const { id } = await params;
  await prisma.sprint.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
