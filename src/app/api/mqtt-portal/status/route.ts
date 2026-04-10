import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { getMqttConnectionStatus } from "@/lib/mqtt-portal/mqtt-client";
import { testDatabaseConnections, getCustomerDbConfigs } from "@/lib/mqtt-portal/db";

export async function GET() {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const configs = getCustomerDbConfigs();
  const dbStatus = configs && configs.length > 0 ? await testDatabaseConnections() : {};

  return NextResponse.json({
    mqtt: { connected: getMqttConnectionStatus() },
    databases: dbStatus,
  });
}
