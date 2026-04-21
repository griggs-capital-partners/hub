import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { DEFAULT_NOTIFICATION_PREFERENCES } from "@/lib/notifications";
import { getOrCreateNotificationSettings } from "@/lib/web-push";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const settings = await getOrCreateNotificationSettings(session.user.id);
  return NextResponse.json({
    settings: {
      taskAssignedPush: settings.taskAssignedPush,
      agentExecutionPush: settings.agentExecutionPush,
    },
  });
}

export async function PATCH(request: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json() as Partial<{
    taskAssignedPush: boolean;
    agentExecutionPush: boolean;
  }>;
  const data: {
    taskAssignedPush?: boolean;
    agentExecutionPush?: boolean;
  } = {};

  if (body.taskAssignedPush !== undefined) {
    if (typeof body.taskAssignedPush !== "boolean") {
      return NextResponse.json({ error: "taskAssignedPush must be a boolean" }, { status: 400 });
    }
    data.taskAssignedPush = body.taskAssignedPush;
  }

  if (body.agentExecutionPush !== undefined) {
    if (typeof body.agentExecutionPush !== "boolean") {
      return NextResponse.json({ error: "agentExecutionPush must be a boolean" }, { status: 400 });
    }
    data.agentExecutionPush = body.agentExecutionPush;
  }

  const settings = await prisma.userNotificationSettings.upsert({
    where: { userId: session.user.id },
    update: data,
    create: {
      userId: session.user.id,
      ...DEFAULT_NOTIFICATION_PREFERENCES,
      ...data,
    },
  });

  return NextResponse.json({
    settings: {
      taskAssignedPush: settings.taskAssignedPush,
      agentExecutionPush: settings.agentExecutionPush,
    },
  });
}
