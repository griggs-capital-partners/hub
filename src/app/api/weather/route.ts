import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { getTodayWeather, reverseGeocodeLocation } from "@/lib/weather";

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const latitude = Number(req.nextUrl.searchParams.get("latitude"));
  const longitude = Number(req.nextUrl.searchParams.get("longitude"));

  if (
    Number.isNaN(latitude)
    || Number.isNaN(longitude)
    || latitude < -90
    || latitude > 90
    || longitude < -180
    || longitude > 180
  ) {
    return NextResponse.json({ error: "Invalid coordinates" }, { status: 400 });
  }

  const location = await reverseGeocodeLocation(latitude, longitude);
  const weather = await getTodayWeather({
    locationName: location?.locationName ?? "Current location",
    latitude,
    longitude,
    timezone: location?.timezone ?? null,
  });

  if (!weather) {
    return NextResponse.json({ error: "Could not load weather right now" }, { status: 502 });
  }

  return NextResponse.json({ weather });
}
