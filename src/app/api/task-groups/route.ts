import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

// GET /api/task-groups — list all task groups
export async function GET() {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const groups = await prisma.taskGroup.findMany({
    orderBy: { createdAt: "asc" },
    select: {
      id: true,
      name: true,
      description: true,
      status: true,
      color: true,
      createdAt: true,
      updatedAt: true,
      cards: {
        select: { id: true },
      },
    },
  });

  return NextResponse.json({ groups });
}

// POST /api/task-groups — create a task group
export async function POST(request: Request) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await request.json();
  const { name, description, status, color } = body;

  if (!name?.trim()) {
    return NextResponse.json({ error: "name required" }, { status: 400 });
  }

  const group = await prisma.taskGroup.create({
    data: {
      name: name.trim(),
      description: description ?? null,
      status: status ?? "backlog",
      color: color ?? null,
    },
    select: {
      id: true,
      name: true,
      description: true,
      status: true,
      color: true,
      createdAt: true,
      updatedAt: true,
      cards: { select: { id: true } },
    },
  });

  return NextResponse.json({ group });
}

// PATCH /api/task-groups — update a task group
export async function PATCH(request: Request) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await request.json();
  const { groupId, name, description, status, color } = body;

  if (!groupId) return NextResponse.json({ error: "groupId required" }, { status: 400 });

  const group = await prisma.taskGroup.update({
    where: { id: groupId },
    data: {
      ...(name !== undefined && { name: name.trim() }),
      ...(description !== undefined && { description }),
      ...(status !== undefined && { status }),
      ...(color !== undefined && { color }),
    },
    select: {
      id: true,
      name: true,
      description: true,
      status: true,
      color: true,
      createdAt: true,
      updatedAt: true,
      cards: { select: { id: true } },
    },
  });

  return NextResponse.json({ group });
}

// DELETE /api/task-groups?groupId=xxx — delete a task group
export async function DELETE(request: Request) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const groupId = searchParams.get("groupId");
  if (!groupId) return NextResponse.json({ error: "groupId required" }, { status: 400 });

  await prisma.taskGroup.delete({ where: { id: groupId } });

  return NextResponse.json({ success: true });
}
