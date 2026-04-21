import { unlink } from "fs/promises";
import { normalize, resolve, sep } from "path";
import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import {
  getConversationForUser,
  isMissingChatTablesError,
  serializeConversation,
} from "@/lib/chat";
import { prisma } from "@/lib/prisma";

function isUploadPath(storagePath: string) {
  const uploadsRoot = normalize(resolve(process.cwd(), "uploads")).toLowerCase();
  const resolvedStoragePath = normalize(resolve(storagePath)).toLowerCase();
  const uploadsPrefix = `${uploadsRoot}${sep}`.toLowerCase();

  return resolvedStoragePath === uploadsRoot || resolvedStoragePath.startsWith(uploadsPrefix);
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string; documentId: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { id, documentId } = await params;
    const conversation = await getConversationForUser(id, session.user.id);

    if (!conversation) {
      return NextResponse.json({ error: "Conversation not found" }, { status: 404 });
    }

    const document = await prisma.conversationDocument.findFirst({
      where: {
        id: documentId,
        conversationId: conversation.id,
      },
      select: {
        id: true,
        filename: true,
        storagePath: true,
      },
    });

    if (!document) {
      return NextResponse.json({ error: "Document not found" }, { status: 404 });
    }

    await prisma.$transaction([
      prisma.conversationDocument.delete({
        where: { id: document.id },
      }),
      prisma.conversation.update({
        where: { id: conversation.id },
        data: { updatedAt: new Date() },
      }),
    ]);

    // Keep thread state consistent even if the backing file has already gone missing.
    if (isUploadPath(document.storagePath)) {
      await unlink(document.storagePath).catch((error: NodeJS.ErrnoException) => {
        if (error.code !== "ENOENT") {
          console.error("[chat/conversations/:id/documents/:documentId][DELETE][file]", {
            documentId: document.id,
            filename: document.filename,
            error,
          });
        }
      });
    }

    const updatedConversation = await getConversationForUser(conversation.id, session.user.id);

    if (!updatedConversation) {
      return NextResponse.json({ error: "Conversation not found" }, { status: 404 });
    }

    return NextResponse.json({ conversation: serializeConversation(updatedConversation) });
  } catch (error) {
    if (isMissingChatTablesError(error)) {
      return NextResponse.json(
        { error: "Team chat is not ready yet. The new chat tables still need to be migrated." },
        { status: 503 }
      );
    }

    console.error("[chat/conversations/:id/documents/:documentId][DELETE]", error);
    return NextResponse.json({ error: "Failed to remove document" }, { status: 500 });
  }
}
