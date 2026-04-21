import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { isMissingChatTablesError } from "@/lib/chat";
import { prisma } from "@/lib/prisma";

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { id } = await params;
    const body = (await request.json()) as Record<string, unknown>;
    const name = typeof body?.name === "string" ? body.name.trim() : "";

    if (!name) {
      return NextResponse.json({ error: "Project name is required" }, { status: 400 });
    }

    const project = await prisma.chatProject.findUnique({
      where: { id },
      select: { id: true, name: true },
    });

    if (!project) {
      return NextResponse.json({ error: "Project not found" }, { status: 404 });
    }

    const duplicateProject = await prisma.chatProject.findFirst({
      where: {
        id: { not: id },
        name: {
          equals: name,
          mode: "insensitive",
        },
      },
      select: { id: true },
    });

    if (duplicateProject) {
      return NextResponse.json({ error: "A chat project with that name already exists" }, { status: 409 });
    }

    const updatedProject = await prisma.chatProject.update({
      where: { id },
      data: { name },
      select: { id: true, name: true },
    });

    return NextResponse.json({ project: updatedProject });
  } catch (error) {
    if (isMissingChatTablesError(error)) {
      return NextResponse.json(
        { error: "Team chat is not ready yet. The new chat tables still need to be migrated." },
        { status: 503 }
      );
    }

    console.error("[chat/projects/:id][PATCH]", error);
    return NextResponse.json({ error: "Failed to rename chat project" }, { status: 500 });
  }
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { id } = await params;
    const project = await prisma.chatProject.findUnique({
      where: { id },
      select: {
        id: true,
        name: true,
        _count: {
          select: {
            conversations: true,
          },
        },
      },
    });

    if (!project) {
      return NextResponse.json({ error: "Project not found" }, { status: 404 });
    }

    await prisma.$transaction(async (tx) => {
      await tx.conversation.updateMany({
        where: { chatProjectId: id },
        data: { chatProjectId: null },
      });

      await tx.chatProject.delete({
        where: { id },
      });
    });

    return NextResponse.json({
      deletedProjectId: id,
      movedThreadCount: project._count.conversations,
    });
  } catch (error) {
    if (isMissingChatTablesError(error)) {
      return NextResponse.json(
        { error: "Team chat is not ready yet. The new chat tables still need to be migrated." },
        { status: 503 }
      );
    }

    console.error("[chat/projects/:id][DELETE]", error);
    return NextResponse.json({ error: "Failed to delete chat project" }, { status: 500 });
  }
}
