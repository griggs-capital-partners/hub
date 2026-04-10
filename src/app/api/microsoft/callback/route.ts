import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { createHmac } from "crypto";

function verifyState(state: string): string | null {
  try {
    const decoded = Buffer.from(state, "base64url").toString("utf8");
    const parts = decoded.split(":");
    if (parts.length !== 3) return null;
    const [userId, nonce, sig] = parts;
    const payload = `${userId}:${nonce}`;
    const expected = createHmac("sha256", process.env.NEON_AUTH_COOKIE_SECRET!)
      .update(payload)
      .digest("hex");
    if (sig !== expected) return null;
    return userId;
  } catch {
    return null;
  }
}

export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl;
  const code = searchParams.get("code");
  const state = searchParams.get("state");
  const error = searchParams.get("error");

  const settingsUrl = new URL("/settings", process.env.AUTH_URL ?? "http://localhost:3000"!);

  if (error) {
    settingsUrl.searchParams.set("teams_error", error);
    return NextResponse.redirect(settingsUrl);
  }

  if (!code || !state) {
    settingsUrl.searchParams.set("teams_error", "missing_params");
    return NextResponse.redirect(settingsUrl);
  }

  const userId = verifyState(state);
  if (!userId) {
    settingsUrl.searchParams.set("teams_error", "invalid_state");
    return NextResponse.redirect(settingsUrl);
  }

  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) {
    settingsUrl.searchParams.set("teams_error", "user_not_found");
    return NextResponse.redirect(settingsUrl);
  }

  // Exchange code for tokens
  const tenantId = process.env.MICROSOFT_TENANT_ID ?? "common";
  const redirectUri = `${process.env.AUTH_URL ?? "http://localhost:3000"}/api/microsoft/callback`;

  const tokenRes = await fetch(
    `https://login.microsoftonline.com/${tenantId}/oauth2/v2.0/token`,
    {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_id: process.env.MICROSOFT_CLIENT_ID!,
        client_secret: process.env.MICROSOFT_CLIENT_SECRET!,
        code,
        redirect_uri: redirectUri,
        grant_type: "authorization_code",
      }),
    }
  );

  if (!tokenRes.ok) {
    settingsUrl.searchParams.set("teams_error", "token_exchange_failed");
    return NextResponse.redirect(settingsUrl);
  }

  const tokens = await tokenRes.json();

  // Fetch Microsoft user profile
  const profileRes = await fetch("https://graph.microsoft.com/v1.0/me", {
    headers: { Authorization: `Bearer ${tokens.access_token}` },
  });

  if (!profileRes.ok) {
    settingsUrl.searchParams.set("teams_error", "profile_fetch_failed");
    return NextResponse.redirect(settingsUrl);
  }

  const profile = await profileRes.json();
  const msUserId: string = profile.id;

  // Upsert the connected account record
  await prisma.connectedAccount.upsert({
    where: {
      provider_providerAccountId: {
        provider: "microsoft-teams",
        providerAccountId: msUserId,
      },
    },
    update: {
      access_token: tokens.access_token,
      refresh_token: tokens.refresh_token ?? null,
      expires_at: tokens.expires_in
        ? Math.floor(Date.now() / 1000) + tokens.expires_in
        : null,
      scope: tokens.scope,
    },
    create: {
      userId,
      provider: "microsoft-teams",
      providerAccountId: msUserId,
      access_token: tokens.access_token,
      refresh_token: tokens.refresh_token ?? null,
      expires_at: tokens.expires_in
        ? Math.floor(Date.now() / 1000) + tokens.expires_in
        : null,
      scope: tokens.scope,
    },
  });

  settingsUrl.searchParams.set("teams_connected", "1");
  return NextResponse.redirect(settingsUrl);
}
