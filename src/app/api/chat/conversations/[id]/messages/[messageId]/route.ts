import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getConversationForUser, isMissingChatTablesError } from "@/lib/chat";

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string; messageId: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { id, messageId } = await params;
    const conversation = await getConversationForUser(id, session.user.id);
    if (!conversation) {
      return NextResponse.json({ error: "Conversation not found" }, { status: 404 });
    }

    const body = await request.json();
    const message = typeof body?.message === "string" ? body.message.trim() : "";
    if (!message) {
      return NextResponse.json({ error: "message is required" }, { status: 400 });
    }

    const existingMessage = await prisma.chatMessage.findFirst({
      where: {
        id: messageId,
        conversationId: id,
        senderUserId: session.user.id,
      },
    });

    if (!existingMessage) {
      return NextResponse.json({ error: "Message not found" }, { status: 404 });
    }

    const updatedMessage = await prisma.chatMessage.update({
      where: { id: messageId },
      data: { body: message },
      include: {
        senderUser: {
          select: {
            id: true,
            name: true,
            displayName: true,
            image: true,
          },
        },
        senderAgent: {
          select: {
            id: true,
            name: true,
            avatar: true,
          },
        },
      },
    });

    await prisma.conversation.update({
      where: { id: conversation.id },
      data: { updatedAt: new Date() },
    });

    return NextResponse.json({
      message: {
        id: updatedMessage.id,
        body: updatedMessage.body,
        createdAt: updatedMessage.createdAt.toISOString(),
        sender: updatedMessage.senderUser
          ? {
              kind: "user" as const,
              id: updatedMessage.senderUser.id,
              name: updatedMessage.senderUser.displayName || updatedMessage.senderUser.name || "Unknown user",
              image: updatedMessage.senderUser.image,
            }
          : updatedMessage.senderAgent
            ? {
                kind: "agent" as const,
                id: updatedMessage.senderAgent.id,
                name: updatedMessage.senderAgent.name,
                image: updatedMessage.senderAgent.avatar,
              }
            : null,
      },
    });
  } catch (error) {
    if (isMissingChatTablesError(error)) {
      return NextResponse.json(
        { error: "Team chat is not ready yet. The new chat tables still need to be migrated." },
        { status: 503 }
      );
    }

    console.error("[chat/message][PATCH]", error);
    return NextResponse.json({ error: "Failed to update message" }, { status: 500 });
  }
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string; messageId: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { id, messageId } = await params;
    const conversation = await getConversationForUser(id, session.user.id);
    if (!conversation) {
      return NextResponse.json({ error: "Conversation not found" }, { status: 404 });
    }

    const existingMessage = await prisma.chatMessage.findFirst({
      where: {
        id: messageId,
        conversationId: id,
        senderUserId: session.user.id,
      },
      select: { id: true },
    });

    if (!existingMessage) {
      return NextResponse.json({ error: "Message not found" }, { status: 404 });
    }

    await prisma.chatMessage.delete({
      where: { id: messageId },
    });

    await prisma.conversation.update({
      where: { id: conversation.id },
      data: { updatedAt: new Date() },
    });

    return NextResponse.json({ ok: true });
  } catch (error) {
    if (isMissingChatTablesError(error)) {
      return NextResponse.json(
        { error: "Team chat is not ready yet. The new chat tables still need to be migrated." },
        { status: 503 }
      );
    }

    console.error("[chat/message][DELETE]", error);
    return NextResponse.json({ error: "Failed to delete message" }, { status: 500 });
  }
}
