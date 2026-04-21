import { readFile } from "fs/promises";
import { normalize, resolve, sep } from "path";
import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { getConversationForUser, isMissingChatTablesError } from "@/lib/chat";
import { prisma } from "@/lib/prisma";

function isUploadPath(storagePath: string) {
  const uploadsRoot = normalize(resolve(process.cwd(), "uploads")).toLowerCase();
  const resolvedStoragePath = normalize(resolve(storagePath)).toLowerCase();
  const uploadsPrefix = `${uploadsRoot}${sep}`.toLowerCase();

  return resolvedStoragePath === uploadsRoot || resolvedStoragePath.startsWith(uploadsPrefix);
}

function buildContentDisposition(filename: string) {
  const fallbackName = filename.replace(/["\\]/g, "_");
  const encodedName = encodeURIComponent(filename);
  return `attachment; filename="${fallbackName}"; filename*=UTF-8''${encodedName}`;
}

export async function GET(
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
        filename: true,
        mimeType: true,
        storagePath: true,
      },
    });

    if (!document) {
      return NextResponse.json({ error: "Document not found" }, { status: 404 });
    }

    if (!isUploadPath(document.storagePath)) {
      return NextResponse.json({ error: "Document path is invalid" }, { status: 400 });
    }

    let buffer: Buffer;
    try {
      buffer = await readFile(document.storagePath);
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") {
        return NextResponse.json(
          { error: "Document file was not found on disk" },
          { status: 404 }
        );
      }

      throw error;
    }

    const body = new Uint8Array(buffer);

    return new NextResponse(body, {
      headers: {
        "Content-Type": document.mimeType || "application/octet-stream",
        "Content-Disposition": buildContentDisposition(document.filename),
        "Content-Length": String(buffer.byteLength),
        "Cache-Control": "private, max-age=60",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch (error) {
    if (isMissingChatTablesError(error)) {
      return NextResponse.json(
        { error: "Team chat is not ready yet. The new chat tables still need to be migrated." },
        { status: 503 }
      );
    }

    console.error("[chat/conversations/:id/documents/:documentId/file][GET]", error);
    return NextResponse.json({ error: "Failed to load document" }, { status: 500 });
  }
}
