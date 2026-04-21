import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { isMissingChatTablesError, searchConversationsForUser } from "@/lib/chat";

export async function GET(request: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const query = searchParams.get("q")?.trim() ?? "";

  if (!query) {
    return NextResponse.json({ results: [] });
  }

  try {
    const results = await searchConversationsForUser(session.user.id, query);
    return NextResponse.json({ results });
  } catch (error) {
    if (isMissingChatTablesError(error)) {
      return NextResponse.json(
        { error: "Team chat is not ready yet. The new chat tables still need to be migrated." },
        { status: 503 }
      );
    }

    console.error("[chat/conversations/search][GET]", error);
    return NextResponse.json({ error: "Failed to search conversations" }, { status: 500 });
  }
}
