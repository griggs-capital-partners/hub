import "server-only";

import webpush, { type PushSubscription as WebPushSubscription } from "web-push";
import { prisma } from "@/lib/prisma";
import { DEFAULT_NOTIFICATION_PREFERENCES } from "@/lib/notifications";

type NotificationKind = "taskAssignedPush" | "agentExecutionPush";

type BrowserNotificationPayload = {
  title: string;
  body: string;
  url: string;
  tag: string;
  icon?: string;
  badge?: string;
  image?: string;
  color?: string;
  requireInteraction?: boolean;
  vibrate?: number[];
  actions?: Array<{
    action: string;
    title: string;
  }>;
};

let vapidConfigured = false;

function getVapidConfig() {
  const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY?.trim() ?? "";
  const privateKey = process.env.VAPID_PRIVATE_KEY?.trim() ?? "";
  const subject = process.env.VAPID_SUBJECT?.trim() ?? "mailto:notifications@example.com";

  return {
    configured: Boolean(publicKey && privateKey),
    publicKey,
    privateKey,
    subject,
  };
}

function ensureWebPushConfigured() {
  const config = getVapidConfig();
  if (!config.configured) {
    throw new Error("Web push is not configured. Set NEXT_PUBLIC_VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY, and VAPID_SUBJECT.");
  }

  if (!vapidConfigured) {
    webpush.setVapidDetails(config.subject, config.publicKey, config.privateKey);
    vapidConfigured = true;
  }

  return config;
}

export function getWebPushPublicKey() {
  return getVapidConfig().publicKey || null;
}

export function isWebPushConfigured() {
  return getVapidConfig().configured;
}

export async function getOrCreateNotificationSettings(userId: string) {
  return prisma.userNotificationSettings.upsert({
    where: { userId },
    update: {},
    create: {
      userId,
      ...DEFAULT_NOTIFICATION_PREFERENCES,
    },
  });
}

function toWebPushSubscription(subscription: {
  endpoint: string;
  p256dh: string;
  auth: string;
}): WebPushSubscription {
  return {
    endpoint: subscription.endpoint,
    keys: {
      p256dh: subscription.p256dh,
      auth: subscription.auth,
    },
  };
}

async function sendNotificationToUser(userId: string, kind: NotificationKind, payload: BrowserNotificationPayload) {
  if (!isWebPushConfigured()) return;

  const [settings, subscriptions] = await Promise.all([
    getOrCreateNotificationSettings(userId),
    prisma.pushSubscription.findMany({
      where: { userId },
      orderBy: { updatedAt: "desc" },
    }),
  ]);

  if (!settings[kind] || subscriptions.length === 0) return;

  ensureWebPushConfigured();

  await Promise.all(
    subscriptions.map(async (subscription) => {
      try {
        await webpush.sendNotification(
          toWebPushSubscription(subscription),
          JSON.stringify(payload)
        );

        await prisma.pushSubscription.update({
          where: { id: subscription.id },
          data: { lastSeenAt: new Date() },
        });
      } catch (error) {
        const statusCode = typeof error === "object" && error && "statusCode" in error
          ? Number((error as { statusCode?: number }).statusCode)
          : null;

        if (statusCode === 403 || statusCode === 404 || statusCode === 410) {
          await prisma.pushSubscription.delete({ where: { id: subscription.id } });
          return;
        }

        console.error("Failed to send web push notification", {
          userId,
          subscriptionId: subscription.id,
          error,
        });
      }
    })
  );
}

export async function notifyTaskAssigned(args: {
  userId: string;
  taskId: string;
  taskTitle: string;
  contextLabel: string;
  url?: string;
  assignedByName: string;
}) {
  await sendNotificationToUser(args.userId, "taskAssignedPush", {
    title: "Smart Hub",
    body: `${args.assignedByName} assigned you "${args.taskTitle}" in ${args.contextLabel}.`,
    url: args.url ?? `/sprints`,
    tag: `task-assigned:${args.taskId}`,
    icon: "/logo.png",
    badge: "/logo.png",
    image: "/AgentBackground.png",
    color: "#F7941D",
    requireInteraction: true,
    vibrate: [120, 40, 120],
    actions: [
      { action: "open", title: "Open Sprint Board" },
    ],
  });
}

export async function notifyAgentExecutionStatus(args: {
  userId: string;
  executionId: string;
  agentName: string;
  actionLabel: string;
  cardTitle: string;
  status: "completed" | "failed";
}) {
  const statusLabel = args.status === "completed" ? "completed" : "failed";
  await sendNotificationToUser(args.userId, "agentExecutionPush", {
    title: "Smart Hub",
    body: `${args.agentName} ${statusLabel} ${args.actionLabel} for "${args.cardTitle}".`,
    url: `/agents/executions`,
    tag: `agent-execution:${args.executionId}`,
    icon: "/logo.png",
    badge: "/logo.png",
    image: "/AgentBackground.png",
    color: args.status === "completed" ? "#22C55E" : "#EF4444",
    requireInteraction: args.status === "failed",
    vibrate: args.status === "completed" ? [100, 30, 100] : [180, 50, 180, 50, 180],
    actions: [
      { action: "open", title: args.status === "completed" ? "View Result" : "Review Failure" },
    ],
  });
}
