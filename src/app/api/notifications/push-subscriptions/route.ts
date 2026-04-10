import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { getOrCreateNotificationSettings, getWebPushPublicKey, isWebPushConfigured } from "@/lib/web-push";
import { prisma } from "@/lib/prisma";

type SubscriptionBody = {
  subscription?: {
    endpoint?: string;
    keys?: {
      p256dh?: string;
      auth?: string;
    };
  };
  deviceLabel?: string;
};

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const [settings, subscriptions] = await Promise.all([
    getOrCreateNotificationSettings(session.user.id),
    prisma.pushSubscription.findMany({
      where: { userId: session.user.id },
      select: {
        id: true,
        endpoint: true,
        deviceLabel: true,
        userAgent: true,
        lastSeenAt: true,
        createdAt: true,
        updatedAt: true,
      },
      orderBy: { updatedAt: "desc" },
    }),
  ]);

  return NextResponse.json({
    configured: isWebPushConfigured(),
    publicKey: getWebPushPublicKey(),
    settings: {
      taskAssignedPush: settings.taskAssignedPush,
      agentExecutionPush: settings.agentExecutionPush,
    },
    subscriptions,
  });
}

export async function POST(request: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json() as SubscriptionBody;
  const endpoint = body.subscription?.endpoint?.trim();
  const p256dh = body.subscription?.keys?.p256dh?.trim();
  const authKey = body.subscription?.keys?.auth?.trim();
  const deviceLabel = body.deviceLabel?.trim();
  const userAgent = request.headers.get("user-agent");

  if (!endpoint || !p256dh || !authKey) {
    return NextResponse.json({ error: "A valid push subscription is required" }, { status: 400 });
  }

  const subscription = await prisma.pushSubscription.upsert({
    where: { endpoint },
    update: {
      userId: session.user.id,
      p256dh,
      auth: authKey,
      deviceLabel: deviceLabel || null,
      userAgent,
      lastSeenAt: new Date(),
    },
    create: {
      userId: session.user.id,
      endpoint,
      p256dh,
      auth: authKey,
      deviceLabel: deviceLabel || null,
      userAgent,
      lastSeenAt: new Date(),
    },
    select: {
      id: true,
      endpoint: true,
      deviceLabel: true,
      userAgent: true,
      lastSeenAt: true,
      createdAt: true,
      updatedAt: true,
    },
  });

  return NextResponse.json({ subscription }, { status: 201 });
}

