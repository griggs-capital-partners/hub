import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { sendDynSecCommand, getMqttConnectionStatus } from "@/lib/mqtt-portal/mqtt-client";

export async function POST(request: Request) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  if (!getMqttConnectionStatus()) {
    return NextResponse.json({ error: "MQTT broker not connected" }, { status: 503 });
  }

  const { userId } = await request.json() as { userId: string };
  if (!userId) return NextResponse.json({ error: "userId is required" }, { status: 400 });

  try {
    const response = await sendDynSecCommand({ command: "getRole", rolename: `${userId}_role` });
    return NextResponse.json(response);
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}
