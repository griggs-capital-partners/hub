import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { createHmac, randomBytes } from "crypto";

// Scope: read:user to get the GitHub username/identity.
// This is enough to link a Neon user to their GitHub profile.
const GITHUB_SCOPE = "read:user";

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
    return NextResponse.redirect(
      new URL("/login", process.env.AUTH_URL ?? "http://localhost:3000")
    );
  }

  const clientId = process.env.GITHUB_CLIENT_ID;
  if (!clientId) {
    return NextResponse.json(
      { error: "GitHub OAuth not configured. Set GITHUB_CLIENT_ID and GITHUB_CLIENT_SECRET." },
      { status: 503 }
    );
  }

  const state = signState(session.user.id);
  const redirectUri = `${process.env.AUTH_URL ?? "http://localhost:3000"}/api/github/callback`;

  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    scope: GITHUB_SCOPE,
    state,
  });

  return NextResponse.redirect(
    `https://github.com/login/oauth/authorize?${params}`
  );
}
