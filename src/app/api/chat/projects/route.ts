import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import {
  isMissingChatTablesError,
  listChatProjects,
  resolveChatProjectSelection,
} from "@/lib/chat";

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const projects = await listChatProjects();
    return NextResponse.json({ projects });
  } catch (error) {
    if (isMissingChatTablesError(error)) {
      return NextResponse.json(
        { error: "Team chat is not ready yet. The new chat tables still need to be migrated." },
        { status: 503 }
      );
    }

    console.error("[chat/projects][GET]", error);
    return NextResponse.json({ error: "Failed to load chat projects" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = (await request.json()) as Record<string, unknown>;
  const projectName = typeof body?.name === "string" ? body.name.trim() : "";

  if (!projectName) {
    return NextResponse.json({ error: "Project name is required" }, { status: 400 });
  }

  try {
    const result = await resolveChatProjectSelection({ projectName });

    if (!result.project) {
      return NextResponse.json({ error: "Unable to create chat project" }, { status: 500 });
    }

    return NextResponse.json(
      {
        project: result.project,
        created: result.created,
      },
      { status: result.created ? 201 : 200 }
    );
  } catch (error) {
    if (isMissingChatTablesError(error)) {
      return NextResponse.json(
        { error: "Team chat is not ready yet. The new chat tables still need to be migrated." },
        { status: 503 }
      );
    }

    console.error("[chat/projects][POST]", error);
    return NextResponse.json({ error: "Failed to create chat project" }, { status: 500 });
  }
}
