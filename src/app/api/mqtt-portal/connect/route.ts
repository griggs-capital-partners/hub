import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { connectMqtt, disconnectMqtt, getMqttConnectionStatus } from "@/lib/mqtt-portal/mqtt-client";
import { initCustomerDatabases, testDatabaseConnections, CustomerDbConfig } from "@/lib/mqtt-portal/db";

// ─── POST: connect using saved config ─────────────────────────────────────────

export async function POST() {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const config = await prisma.mqttPortalConfig.findFirst();
  if (!config || !config.mqttUrl) {
    return NextResponse.json({ error: "No configuration saved. Please configure first." }, { status: 400 });
  }

  const databases: CustomerDbConfig[] = JSON.parse(config.databases || "[]");

  // Init customer DB connections
  if (databases.length > 0) {
    initCustomerDatabases(databases);
  }

  // Connect MQTT broker
  connectMqtt({
    mqttUrl: config.mqttUrl,
    mqttUser: config.mqttUser,
    mqttPass: config.mqttPass,
  });

  // Give it a moment to establish connection
  await new Promise((r) => setTimeout(r, 1500));

  const mqttConnected = getMqttConnectionStatus();
  const dbStatus = databases.length > 0 ? await testDatabaseConnections() : {};

  return NextResponse.json({ mqttConnected, databases: dbStatus });
}

// ─── DELETE: disconnect ───────────────────────────────────────────────────────

export async function DELETE() {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  disconnectMqtt();
  return NextResponse.json({ ok: true });
}
