import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { sendDynSecCommand, getMqttConnectionStatus } from "@/lib/mqtt-portal/mqtt-client";
import { findUserAcrossDatabases } from "@/lib/mqtt-portal/db";

export async function GET() {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  if (!getMqttConnectionStatus()) {
    return NextResponse.json({ error: "MQTT broker not connected" }, { status: 503 });
  }

  try {
    const listResp = await sendDynSecCommand({
      command: "listClients",
      verbose: false,
      count: -1,
      offset: 0,
    });

    if (listResp.error) {
      return NextResponse.json({ error: listResp.error }, { status: 500 });
    }

    const clientNames = (listResp.data?.clients as string[]) || [];

    const clients = await Promise.all(
      clientNames.map(async (name) => {
        const username = typeof name === "string" ? name : (name as { username: string }).username;
        try {
          const detail = await sendDynSecCommand({ command: "getClient", username });
          const dbMatch = await findUserAcrossDatabases(username);
          const client = detail.data?.client as Record<string, unknown> | undefined;

          return {
            username,
            clientid: (client?.clientid as string) ?? null,
            textname: (client?.textname as string) ?? null,
            roles: (client?.roles as unknown[]) ?? [],
            groups: (client?.groups as unknown[]) ?? [],
            disabled: (client?.disabled as boolean) ?? false,
            matchedDatabase: dbMatch.database,
            matchedUser: dbMatch.user,
          };
        } catch (err) {
          return {
            username,
            error: (err as Error).message,
            clientid: null,
            roles: [],
            groups: [],
            disabled: false,
            matchedDatabase: null,
            matchedUser: null,
          };
        }
      })
    );

    return NextResponse.json({ clients, total: clients.length });
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}
