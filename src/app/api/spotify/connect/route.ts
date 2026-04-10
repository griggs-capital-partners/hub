import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { getHubSettings } from "@/lib/hub-settings";
import { createHmac, randomBytes } from "crypto";

// Scopes needed to read what the host is currently playing
const SPOTIFY_SCOPE = "user-read-currently-playing user-read-playback-state";

function signState(userId: string, returnTo: string): string {
  const nonce = randomBytes(16).toString("hex");
  const encodedReturnTo = encodeURIComponent(returnTo);
  const payload = `${userId}:${nonce}:${encodedReturnTo}`;
  const sig = createHmac("sha256", process.env.NEON_AUTH_COOKIE_SECRET!)
    .update(payload)
    .digest("hex");
  return Buffer.from(`${payload}:${sig}`).toString("base64url");
}

/** Derive the app's base URL from the incoming request — no env var needed. */
function baseUrl(req: NextRequest): string {
  const host = req.headers.get("x-forwarded-host") ?? req.headers.get("host") ?? "localhost:3000";
  const proto = req.headers.get("x-forwarded-proto") ?? (host.startsWith("localhost") ? "http" : "https");
  return `${proto}://${host}`;
}

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.redirect(new URL("/login", baseUrl(req)));
  }

  const settings = await getHubSettings();
  const clientId = settings?.spotifyClientId;
  const clientSecret = settings?.spotifyClientSecret;
  if (!clientId || !clientSecret) {
    return NextResponse.json(
      { error: "Spotify OAuth is not configured yet. Save the Spotify client ID and secret in Settings > Integrations first." },
      { status: 503 }
    );
  }

  const requestedReturnTo = req.nextUrl.searchParams.get("returnTo");
  const returnTo = requestedReturnTo?.startsWith("/") ? requestedReturnTo : "/settings/integrations";
  const state = signState(session.user.id, returnTo);
  const redirectUri = `${baseUrl(req)}/api/spotify/callback`;

  const params = new URLSearchParams({
    client_id: clientId,
    response_type: "code",
    redirect_uri: redirectUri,
    scope: SPOTIFY_SCOPE,
    state,
  });

  return NextResponse.redirect(
    `https://accounts.spotify.com/authorize?${params}`
  );
}
