import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";

export interface HubSettingsRecord {
  id: string;
  weatherLocationMode: "hub" | "user";
  locationName: string | null;
  latitude: number | null;
  longitude: number | null;
  timezone: string | null;
  smtpHost: string | null;
  smtpPort: number | null;
  smtpUser: string | null;
  smtpPass: string | null;
  smtpFrom: string | null;
  agentExecutionEmailEnabled: boolean;
}

export function getDefaultHubEmailSettings() {
  const smtpPort = Number(process.env.EMAIL_PORT?.trim() ?? "");

  return {
    smtpHost: process.env.EMAIL_HOST?.trim() || null,
    smtpPort: Number.isFinite(smtpPort) ? smtpPort : null,
    smtpUser: process.env.EMAIL_USER?.trim() || null,
    smtpPass: process.env.EMAIL_PASS?.trim() || null,
    smtpFrom: process.env.EMAIL_FROM?.trim() || null,
    agentExecutionEmailEnabled: true,
  };
}

function normalizeRow(row: Record<string, unknown>): HubSettingsRecord {
  const defaults = getDefaultHubEmailSettings();

  return {
    id: typeof row.id === "string" ? row.id : "default",
    weatherLocationMode: row.weatherLocationMode === "user" ? "user" : "hub",
    locationName: typeof row.locationName === "string" ? row.locationName : null,
    latitude: typeof row.latitude === "number" ? row.latitude : null,
    longitude: typeof row.longitude === "number" ? row.longitude : null,
    timezone: typeof row.timezone === "string" ? row.timezone : null,
    smtpHost: typeof row.smtpHost === "string" ? row.smtpHost : defaults.smtpHost,
    smtpPort: typeof row.smtpPort === "number" ? row.smtpPort : defaults.smtpPort,
    smtpUser: typeof row.smtpUser === "string" ? row.smtpUser : defaults.smtpUser,
    smtpPass: typeof row.smtpPass === "string" ? row.smtpPass : defaults.smtpPass,
    smtpFrom: typeof row.smtpFrom === "string" ? row.smtpFrom : defaults.smtpFrom,
    agentExecutionEmailEnabled:
      typeof row.agentExecutionEmailEnabled === "boolean"
        ? row.agentExecutionEmailEnabled
        : defaults.agentExecutionEmailEnabled,
  };
}

function isMissingTableError(error: unknown) {
  return error instanceof Error
    && (
      error.message.includes('relation "hub_settings" does not exist')
      || error.message.includes("The table `public.hub_settings` does not exist")
    );
}

export async function getHubSettings() {
  try {
    const rows = await prisma.$queryRaw<Array<Record<string, unknown>>>(Prisma.sql`
      SELECT id, "weatherLocationMode", "locationName", latitude, longitude, timezone, "smtpHost", "smtpPort", "smtpUser", "smtpPass", "smtpFrom", "agentExecutionEmailEnabled"
      FROM hub_settings
      WHERE id = 'default'
      LIMIT 1
    `);

    if (rows[0]) return normalizeRow(rows[0]);

    return normalizeRow({ id: "default" });
  } catch (error) {
    if (isMissingTableError(error)) return normalizeRow({ id: "default" });
    throw error;
  }
}

export async function saveHubSettings(input: Omit<HubSettingsRecord, "id">) {
  try {
    const rows = await prisma.$queryRaw<Array<Record<string, unknown>>>(Prisma.sql`
      INSERT INTO hub_settings (
        id,
        "weatherLocationMode",
        "locationName",
        latitude,
        longitude,
        timezone,
        "smtpHost",
        "smtpPort",
        "smtpUser",
        "smtpPass",
        "smtpFrom",
        "agentExecutionEmailEnabled",
        "createdAt",
        "updatedAt"
      )
      VALUES (
        'default',
        ${input.weatherLocationMode},
        ${input.locationName},
        ${input.latitude},
        ${input.longitude},
        ${input.timezone},
        ${input.smtpHost},
        ${input.smtpPort},
        ${input.smtpUser},
        ${input.smtpPass},
        ${input.smtpFrom},
        ${input.agentExecutionEmailEnabled},
        NOW(),
        NOW()
      )
      ON CONFLICT (id) DO UPDATE
      SET
        "weatherLocationMode" = EXCLUDED."weatherLocationMode",
        "locationName" = EXCLUDED."locationName",
        latitude = EXCLUDED.latitude,
        longitude = EXCLUDED.longitude,
        timezone = EXCLUDED.timezone,
        "smtpHost" = EXCLUDED."smtpHost",
        "smtpPort" = EXCLUDED."smtpPort",
        "smtpUser" = EXCLUDED."smtpUser",
        "smtpPass" = EXCLUDED."smtpPass",
        "smtpFrom" = EXCLUDED."smtpFrom",
        "agentExecutionEmailEnabled" = EXCLUDED."agentExecutionEmailEnabled",
        "updatedAt" = NOW()
      RETURNING id, "weatherLocationMode", "locationName", latitude, longitude, timezone, "smtpHost", "smtpPort", "smtpUser", "smtpPass", "smtpFrom", "agentExecutionEmailEnabled"
    `);

    return rows[0] ? normalizeRow(rows[0]) : null;
  } catch (error) {
    if (isMissingTableError(error)) return null;
    throw error;
  }
}
