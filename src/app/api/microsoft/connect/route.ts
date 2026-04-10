import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { createHmac, randomBytes } from "crypto";

// Microsoft OAuth scopes needed for Teams messaging
const TEAMS_SCOPES = [
  "User.Read",
  "Team.ReadBasic.All",
  "Channel.ReadBasic.All",
  "ChannelMessage.Read.All",
  "Chat.Read",
  "offline_access",
].join(" ");

function signState(userId: string): string {
  const nonce = randomBytes(16).toString("hex");
  const payload = `${userId}:${nonce}`;
  const sig = createHmac("sha256", process.env.NEON_AUTH_COOKIE_SECRET!)
    .update(payload)
    .digest("hex");
  return Buffer.from(`${payload}:${sig}`).toString("base64url");
}

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.redirect(new URL("/login", process.env.AUTH_URL ?? "http://localhost:3000"!));
  }

  const tenantId = process.env.MICROSOFT_TENANT_ID ?? "common";
  const clientId = process.env.MICROSOFT_CLIENT_ID;

  if (!clientId) {
    return NextResponse.json(
      { error: "Microsoft integration not configured. Set MICROSOFT_CLIENT_ID." },
      { status: 503 }
    );
  }

  const state = signState(session.user.id);
  const redirectUri = `${process.env.AUTH_URL ?? "http://localhost:3000"}/api/microsoft/callback`;

  const params = new URLSearchParams({
    client_id: clientId,
    response_type: "code",
    redirect_uri: redirectUri,
    scope: TEAMS_SCOPES,
    state,
    response_mode: "query",
    prompt: "select_account",
  });

  const authUrl = `https://login.microsoftonline.com/${tenantId}/oauth2/v2.0/authorize?${params}`;
  return NextResponse.redirect(authUrl);
}
