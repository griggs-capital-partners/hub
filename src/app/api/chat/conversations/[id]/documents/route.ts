import { mkdir, unlink, writeFile } from "fs/promises";
import { randomUUID } from "crypto";
import { join } from "path";
import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import {
  getConversationForUser,
  isMissingChatTablesError,
  serializeConversation,
} from "@/lib/chat";
import {
  CONVERSATION_DOCUMENT_UNSUPPORTED_ERROR,
  validateConversationDocument,
  resolveConversationDocumentMetadata,
  sanitizeConversationDocumentFilename,
} from "@/lib/conversation-documents";
import { prisma } from "@/lib/prisma";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { id } = await params;
    const conversation = await getConversationForUser(id, session.user.id);

    if (!conversation) {
      return NextResponse.json({ error: "Conversation not found" }, { status: 404 });
    }

    const formData = await request.formData();
    const file = formData.get("file");

    if (!(file instanceof File)) {
      return NextResponse.json({ error: "No file provided" }, { status: 400 });
    }

    const validationError = validateConversationDocument(file);
    if (validationError) {
      return NextResponse.json({ error: validationError }, { status: 400 });
    }

    const metadata = resolveConversationDocumentMetadata(file);
    if (!metadata) {
      return NextResponse.json({ error: CONVERSATION_DOCUMENT_UNSUPPORTED_ERROR }, { status: 400 });
    }

    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);
    const uploadsDir = join(process.cwd(), "uploads", session.user.id, "conversations", conversation.id);
    const storedFilename = `${Date.now()}-${randomUUID()}-${sanitizeConversationDocumentFilename(file.name)}`;
    const storagePath = join(uploadsDir, storedFilename);

    await mkdir(uploadsDir, { recursive: true });
    await writeFile(storagePath, buffer);

    let document: { id: string; filename: string } | null = null;
    try {
      [document] = await prisma.$transaction([
        prisma.conversationDocument.create({
          data: {
            conversationId: conversation.id,
            uploadedBy: session.user.id,
            filename: file.name,
            mimeType: metadata.mimeType,
            fileType: metadata.fileType,
            fileSize: file.size,
            storagePath,
          },
        }),
        prisma.conversation.update({
          where: { id: conversation.id },
          data: { updatedAt: new Date() },
        }),
      ]);
    } catch (error) {
      await unlink(storagePath).catch(() => {});
      throw error;
    }

    if (!document) {
      await unlink(storagePath).catch(() => {});
      throw new Error("Document record was not created");
    }

    const updatedConversation = await getConversationForUser(conversation.id, session.user.id);

    if (!updatedConversation) {
      return NextResponse.json({ error: "Conversation not found" }, { status: 404 });
    }

    return NextResponse.json({
      conversation: serializeConversation(updatedConversation),
      document: {
        id: document.id,
        filename: document.filename,
      },
    });
  } catch (error) {
    if (isMissingChatTablesError(error)) {
      return NextResponse.json(
        { error: "Team chat is not ready yet. The new chat tables still need to be migrated." },
        { status: 503 }
      );
    }

    console.error("[chat/conversations/:id/documents][POST]", error);
    return NextResponse.json({ error: "Failed to upload document" }, { status: 500 });
  }
}
