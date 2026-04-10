import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { CustomerDbConfig } from "@/lib/mqtt-portal/db";

// ─── GET: load current config ─────────────────────────────────────────────────

export async function GET() {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  let config = await prisma.mqttPortalConfig.findFirst();
  if (!config) {
    config = await prisma.mqttPortalConfig.create({
      data: { mqttUrl: "", mqttUser: "", mqttPass: "", databases: "[]" },
    });
  }

  // Mask passwords before sending to client
  const databases: CustomerDbConfig[] = JSON.parse(config.databases || "[]");
  const maskedDbs = databases.map((db) => ({
    ...db,
    pass: db.pass ? "••••••••" : "",
  }));

  return NextResponse.json({
    id: config.id,
    mqttUrl: config.mqttUrl,
    mqttUser: config.mqttUser,
    mqttPass: config.mqttPass ? "••••••••" : "",
    databases: maskedDbs,
  });
}

// ─── PUT: save config ─────────────────────────────────────────────────────────

export async function PUT(request: Request) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await request.json();
  const { mqttUrl, mqttUser, mqttPass, databases } = body as {
    mqttUrl: string;
    mqttUser: string;
    mqttPass: string;
    databases: CustomerDbConfig[];
  };

  // Load existing config to preserve masked passwords
  const existing = await prisma.mqttPortalConfig.findFirst();
  const existingDbs: CustomerDbConfig[] = JSON.parse(existing?.databases || "[]");

  // Un-mask: if password is the mask, keep the original
  const resolvedMqttPass =
    mqttPass === "••••••••" ? (existing?.mqttPass ?? "") : mqttPass;

  const resolvedDbs = databases.map((db, i) => ({
    ...db,
    pass: db.pass === "••••••••" ? (existingDbs[i]?.pass ?? "") : db.pass,
  }));

  if (existing) {
    await prisma.mqttPortalConfig.update({
      where: { id: existing.id },
      data: {
        mqttUrl,
        mqttUser,
        mqttPass: resolvedMqttPass,
        databases: JSON.stringify(resolvedDbs),
      },
    });
  } else {
    await prisma.mqttPortalConfig.create({
      data: {
        mqttUrl,
        mqttUser,
        mqttPass: resolvedMqttPass,
        databases: JSON.stringify(resolvedDbs),
      },
    });
  }

  return NextResponse.json({ ok: true });
}
