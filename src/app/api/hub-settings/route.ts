import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { getDefaultHubEmailSettings, getHubSettings, saveHubSettings } from "@/lib/hub-settings";

type GeocodeResponse = {
  results?: Array<{
    name?: string;
    admin1?: string;
    country?: string;
    latitude?: number;
    longitude?: number;
    timezone?: string;
  }>;
};

type GeocodeMatch = NonNullable<GeocodeResponse["results"]>[number];

function formatLocation(parts: Array<string | undefined>) {
  return parts.filter(Boolean).join(", ");
}

async function fetchGeocodeMatch(query: string) {
  const url = new URL("https://geocoding-api.open-meteo.com/v1/search");
  url.searchParams.set("name", query);
  url.searchParams.set("count", "1");
  url.searchParams.set("language", "en");
  url.searchParams.set("format", "json");

  const res = await fetch(url.toString(), { cache: "no-store" });
  if (!res.ok) throw new Error("geocode_failed");

  const geocode = (await res.json()) as GeocodeResponse;
  const match = geocode.results?.[0];
  if (
    !match
    || typeof match.latitude !== "number"
    || typeof match.longitude !== "number"
  ) {
    return null;
  }

  return match;
}

async function reverseGeocodeMatch(latitude: number, longitude: number) {
  const url = new URL("https://geocoding-api.open-meteo.com/v1/reverse");
  url.searchParams.set("latitude", String(latitude));
  url.searchParams.set("longitude", String(longitude));
  url.searchParams.set("count", "1");
  url.searchParams.set("language", "en");
  url.searchParams.set("format", "json");

  const res = await fetch(url.toString(), { cache: "no-store" });
  if (!res.ok) throw new Error("reverse_geocode_failed");

  const geocode = (await res.json()) as GeocodeResponse;
  return geocode.results?.[0] ?? null;
}

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const settings = await getHubSettings();

  return NextResponse.json({
    settings: settings ?? {
      id: "default",
      weatherLocationMode: "hub",
      locationName: null,
      latitude: null,
      longitude: null,
      timezone: null,
      spotifyClientId: null,
      spotifyClientSecret: null,
      ...getDefaultHubEmailSettings(),
    },
  });
}

export async function PATCH(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json();
  const hasLocationField = Object.prototype.hasOwnProperty.call(body ?? {}, "locationName");
  const hasLatitudeField = Object.prototype.hasOwnProperty.call(body ?? {}, "latitude");
  const hasLongitudeField = Object.prototype.hasOwnProperty.call(body ?? {}, "longitude");
  const hasWeatherLocationModeField = Object.prototype.hasOwnProperty.call(body ?? {}, "weatherLocationMode");
  const hasSpotifyField = ["spotifyClientId", "spotifyClientSecret"].some((key) =>
    Object.prototype.hasOwnProperty.call(body ?? {}, key)
  );
  const hasSmtpField = ["smtpHost", "smtpPort", "smtpUser", "smtpPass", "smtpFrom", "agentExecutionEmailEnabled"].some((key) =>
    Object.prototype.hasOwnProperty.call(body ?? {}, key)
  );
  const weatherLocationMode = body?.weatherLocationMode === "user" ? "user" : "hub";
  const rawLocation = typeof body?.locationName === "string" ? body.locationName.trim() : "";
  const spotifyClientId = typeof body?.spotifyClientId === "string" ? body.spotifyClientId.trim() : "";
  const spotifyClientSecret = typeof body?.spotifyClientSecret === "string" ? body.spotifyClientSecret.trim() : "";
  const latitude = typeof body?.latitude === "number" ? body.latitude : null;
  const longitude = typeof body?.longitude === "number" ? body.longitude : null;
  const smtpHost = typeof body?.smtpHost === "string" ? body.smtpHost.trim() : "";
  const smtpUser = typeof body?.smtpUser === "string" ? body.smtpUser.trim() : "";
  const smtpPass = typeof body?.smtpPass === "string" ? body.smtpPass : "";
  const smtpFrom = typeof body?.smtpFrom === "string" ? body.smtpFrom.trim() : "";
  const agentExecutionEmailEnabled = typeof body?.agentExecutionEmailEnabled === "boolean"
    ? body.agentExecutionEmailEnabled
    : null;
  const smtpPort = typeof body?.smtpPort === "number"
    ? body.smtpPort
    : typeof body?.smtpPort === "string" && body.smtpPort.trim()
      ? Number(body.smtpPort)
      : null;

  if (rawLocation.length > 120) {
    return NextResponse.json({ error: "Location must be 120 characters or fewer" }, { status: 400 });
  }

  if (spotifyClientId.length > 255 || spotifyClientSecret.length > 255 || smtpHost.length > 255 || smtpUser.length > 255 || smtpFrom.length > 255) {
    return NextResponse.json({ error: "One or more settings fields are too long" }, { status: 400 });
  }

  if ((latitude === null) !== (longitude === null)) {
    return NextResponse.json({ error: "Latitude and longitude must be provided together" }, { status: 400 });
  }

  if (
    latitude !== null
    && (Number.isNaN(latitude) || latitude < -90 || latitude > 90 || longitude === null || Number.isNaN(longitude) || longitude < -180 || longitude > 180)
  ) {
    return NextResponse.json({ error: "Invalid coordinates" }, { status: 400 });
  }

  if (smtpPort !== null && (!Number.isInteger(smtpPort) || smtpPort < 1 || smtpPort > 65535)) {
    return NextResponse.json({ error: "SMTP port must be a valid port number" }, { status: 400 });
  }

  const smtpFields = [smtpHost, smtpUser, smtpPass, smtpFrom];
  const smtpHasAnyValue = smtpFields.some(Boolean) || smtpPort !== null;
  const smtpHasAllValues = smtpFields.every(Boolean) && smtpPort !== null;
  const spotifyHasAnyValue = Boolean(spotifyClientId || spotifyClientSecret);
  const spotifyHasAllValues = Boolean(spotifyClientId && spotifyClientSecret);
  const spotifyShouldClear = hasSpotifyField && !spotifyClientId && !spotifyClientSecret;

  if (smtpHasAnyValue && !smtpHasAllValues) {
    return NextResponse.json(
      { error: "SMTP host, port, user, password, and from address are all required together" },
      { status: 400 }
    );
  }

  if (spotifyHasAnyValue && !spotifyHasAllValues) {
    return NextResponse.json(
      { error: "Spotify client ID and client secret are required together" },
      { status: 400 }
    );
  }

  const existingSettings = await getHubSettings();

  async function persistSettings(locationSettings: {
    weatherLocationMode: "hub" | "user";
    locationName: string | null;
    latitude: number | null;
    longitude: number | null;
    timezone: string | null;
  }) {
    return saveHubSettings({
      ...locationSettings,
      spotifyClientId: spotifyShouldClear ? null : spotifyHasAnyValue ? spotifyClientId : existingSettings?.spotifyClientId ?? null,
      spotifyClientSecret: spotifyShouldClear ? null : spotifyHasAnyValue ? spotifyClientSecret : existingSettings?.spotifyClientSecret ?? null,
      smtpHost: smtpHasAnyValue ? smtpHost : existingSettings?.smtpHost ?? null,
      smtpPort: smtpHasAnyValue ? smtpPort : existingSettings?.smtpPort ?? null,
      smtpUser: smtpHasAnyValue ? smtpUser : existingSettings?.smtpUser ?? null,
      smtpPass: smtpHasAnyValue ? smtpPass : existingSettings?.smtpPass ?? null,
      smtpFrom: smtpHasAnyValue ? smtpFrom : existingSettings?.smtpFrom ?? null,
      agentExecutionEmailEnabled: agentExecutionEmailEnabled ?? existingSettings?.agentExecutionEmailEnabled ?? true,
    });
  }

  if ((hasSmtpField || hasSpotifyField) && !hasLocationField && !hasLatitudeField && !hasLongitudeField) {
    const settings = await persistSettings({
      weatherLocationMode: hasWeatherLocationModeField ? weatherLocationMode : existingSettings?.weatherLocationMode ?? "hub",
      locationName: existingSettings?.locationName ?? null,
      latitude: existingSettings?.latitude ?? null,
      longitude: existingSettings?.longitude ?? null,
      timezone: existingSettings?.timezone ?? null,
    });

    if (!settings) {
      return NextResponse.json(
        { error: "Hub settings table is not ready yet. Run the latest Prisma migration and refresh the app." },
        { status: 503 }
      );
    }

    return NextResponse.json({ settings });
  }

  if (hasLocationField && !rawLocation && latitude === null) {
    const settings = await persistSettings({
      weatherLocationMode: hasWeatherLocationModeField ? weatherLocationMode : existingSettings?.weatherLocationMode ?? "hub",
      locationName: null,
      latitude: null,
      longitude: null,
      timezone: null,
    });

    if (!settings) {
      return NextResponse.json(
        { error: "Hub settings table is not ready yet. Run the latest Prisma migration and refresh the app." },
        { status: 503 }
      );
    }

    return NextResponse.json({ settings });
  }

  if (!hasLocationField && !hasLatitudeField && !hasLongitudeField && !hasWeatherLocationModeField) {
    return NextResponse.json({ settings: existingSettings });
  }

  if (hasWeatherLocationModeField && !hasLocationField && !hasLatitudeField && !hasLongitudeField) {
    const settings = await persistSettings({
      weatherLocationMode,
      locationName: existingSettings?.locationName ?? null,
      latitude: existingSettings?.latitude ?? null,
      longitude: existingSettings?.longitude ?? null,
      timezone: existingSettings?.timezone ?? null,
    });

    if (!settings) {
      return NextResponse.json(
        { error: "Hub settings table is not ready yet. Run the latest Prisma migration and refresh the app." },
        { status: 503 }
      );
    }

    return NextResponse.json({ settings });
  }

  if (latitude !== null && longitude !== null) {
    let reverseMatch: GeocodeMatch | null = null;

    try {
      reverseMatch = await reverseGeocodeMatch(latitude, longitude);
    } catch {
      reverseMatch = null;
    }

    const settings = await persistSettings({
      weatherLocationMode: hasWeatherLocationModeField ? weatherLocationMode : existingSettings?.weatherLocationMode ?? "hub",
      locationName:
        formatLocation([reverseMatch?.name, reverseMatch?.admin1, reverseMatch?.country])
        || rawLocation
        || "Current location",
      latitude,
      longitude,
      timezone: reverseMatch?.timezone ?? null,
    });

    if (!settings) {
      return NextResponse.json(
        { error: "Hub settings table is not ready yet. Run the latest Prisma migration and refresh the app." },
        { status: 503 }
      );
    }

    return NextResponse.json({ settings });
  }

  const attempts = Array.from(
    new Set([
      rawLocation,
      rawLocation.replace(/,/g, " "),
      rawLocation.split(",")[0]?.trim() ?? "",
    ].filter(Boolean))
  );

  let match: GeocodeMatch | null = null;
  try {
    for (const attempt of attempts) {
      match = await fetchGeocodeMatch(attempt);
      if (match) break;
    }
  } catch {
    return NextResponse.json({ error: "Could not look up that location right now" }, { status: 502 });
  }

  if (!match || typeof match.latitude !== "number" || typeof match.longitude !== "number") {
    return NextResponse.json({ error: "Location not found. Try a city and state, or use your current location." }, { status: 404 });
  }

  const settings = await persistSettings({
    weatherLocationMode: hasWeatherLocationModeField ? weatherLocationMode : existingSettings?.weatherLocationMode ?? "hub",
    locationName: formatLocation([match.name, match.admin1, match.country]) || rawLocation,
    latitude: match.latitude,
    longitude: match.longitude,
    timezone: match.timezone ?? null,
  });

  if (!settings) {
    return NextResponse.json(
      { error: "Hub settings table is not ready yet. Run the latest Prisma migration and refresh the app." },
      { status: 503 }
    );
  }

  return NextResponse.json({ settings });
}
