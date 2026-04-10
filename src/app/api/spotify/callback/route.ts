import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getHubSettings } from "@/lib/hub-settings";
import { createHmac } from "crypto";

function verifyState(state: string): { userId: string; returnTo: string } | null {
  try {
    const decoded = Buffer.from(state, "base64url").toString("utf8");
    const parts = decoded.split(":");
    if (parts.length !== 4) return null;
    const [userId, nonce, encodedReturnTo, sig] = parts;
    const payload = `${userId}:${nonce}:${encodedReturnTo}`;
    const expected = createHmac("sha256", process.env.NEON_AUTH_COOKIE_SECRET!)
      .update(payload)
      .digest("hex");
    if (sig !== expected) return null;
    const returnTo = decodeURIComponent(encodedReturnTo);
    return { userId, returnTo: returnTo.startsWith("/") ? returnTo : "/settings/integrations" };
  } catch {
    return null;
  }
}

function baseUrl(req: NextRequest): string {
  const host = req.headers.get("x-forwarded-host") ?? req.headers.get("host") ?? "localhost:3000";
  const proto = req.headers.get("x-forwarded-proto") ?? (host.startsWith("localhost") ? "http" : "https");
  return `${proto}://${host}`;
}

export async function GET(req: NextRequest) {
  const base = baseUrl(req);
  const { searchParams } = req.nextUrl;
  const code = searchParams.get("code");
  const state = searchParams.get("state");
  const error = searchParams.get("error");

  const fallbackReturnTo = "/settings/integrations";
  const errorUrl = new URL(fallbackReturnTo, base);

  if (error) {
    errorUrl.searchParams.set("spotify_error", error);
    return NextResponse.redirect(errorUrl);
  }

  if (!code || !state) {
    errorUrl.searchParams.set("spotify_error", "missing_params");
    return NextResponse.redirect(errorUrl);
  }

  const verifiedState = verifyState(state);
  if (!verifiedState) {
    errorUrl.searchParams.set("spotify_error", "invalid_state");
    return NextResponse.redirect(errorUrl);
  }
  const { userId, returnTo } = verifiedState;
  errorUrl.pathname = returnTo;

  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) {
    errorUrl.searchParams.set("spotify_error", "user_not_found");
    return NextResponse.redirect(errorUrl);
  }

  const settings = await getHubSettings();
  const clientId = settings?.spotifyClientId;
  const clientSecret = settings?.spotifyClientSecret;
  if (!clientId || !clientSecret) {
    errorUrl.searchParams.set("spotify_error", "spotify_not_configured");
    return NextResponse.redirect(errorUrl);
  }
  const redirectUri = `${base}/api/spotify/callback`;

  // Exchange code for tokens
  const tokenRes = await fetch("https://accounts.spotify.com/api/token", {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      Authorization: `Basic ${Buffer.from(`${clientId}:${clientSecret}`).toString("base64")}`,
    },
    body: new URLSearchParams({
      grant_type: "authorization_code",
      code,
      redirect_uri: redirectUri,
    }),
  });

  if (!tokenRes.ok) {
    errorUrl.searchParams.set("spotify_error", "token_exchange_failed");
    return NextResponse.redirect(errorUrl);
  }

  const tokens = await tokenRes.json();

  // Fetch Spotify user profile to get the providerAccountId
  const profileRes = await fetch("https://api.spotify.com/v1/me", {
    headers: { Authorization: `Bearer ${tokens.access_token}` },
  });

  if (!profileRes.ok) {
    errorUrl.searchParams.set("spotify_error", "profile_fetch_failed");
    return NextResponse.redirect(errorUrl);
  }

  const spotifyUser = await profileRes.json();
  const expiresAt = Math.floor(Date.now() / 1000) + tokens.expires_in;

  await prisma.connectedAccount.upsert({
    where: {
      provider_providerAccountId: {
        provider: "spotify",
        providerAccountId: spotifyUser.id,
      },
    },
    update: {
      userId,
      access_token: tokens.access_token,
      refresh_token: tokens.refresh_token,
      expires_at: expiresAt,
      scope: tokens.scope,
    },
    create: {
      userId,
      provider: "spotify",
      providerAccountId: spotifyUser.id,
      access_token: tokens.access_token,
      refresh_token: tokens.refresh_token,
      expires_at: expiresAt,
      scope: tokens.scope,
    },
  });

  const successUrl = new URL(returnTo, base);
  successUrl.searchParams.set("spotify_connected", "1");
  return NextResponse.redirect(successUrl);
}
