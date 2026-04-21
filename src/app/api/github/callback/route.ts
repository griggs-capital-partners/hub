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

const BASE_URL = process.env.AUTH_URL ?? "http://localhost:3000";
const returnUrl = `${BASE_URL}/integrations/github`;

export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl;
  const code = searchParams.get("code");
  const state = searchParams.get("state");
  const error = searchParams.get("error");

  const errorUrl = new URL(returnUrl);

  if (error) {
    errorUrl.searchParams.set("github_error", error);
    return NextResponse.redirect(errorUrl);
  }

  if (!code || !state) {
    errorUrl.searchParams.set("github_error", "missing_params");
    return NextResponse.redirect(errorUrl);
  }

  const userId = verifyState(state);
  if (!userId) {
    errorUrl.searchParams.set("github_error", "invalid_state");
    return NextResponse.redirect(errorUrl);
  }

  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) {
    errorUrl.searchParams.set("github_error", "user_not_found");
    return NextResponse.redirect(errorUrl);
  }

  // Exchange code for access token
  const tokenRes = await fetch("https://github.com/login/oauth/access_token", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: JSON.stringify({
      client_id: process.env.GITHUB_CLIENT_ID,
      client_secret: process.env.GITHUB_CLIENT_SECRET,
      code,
      redirect_uri: `${BASE_URL}/api/github/callback`,
    }),
  });

  if (!tokenRes.ok) {
    errorUrl.searchParams.set("github_error", "token_exchange_failed");
    return NextResponse.redirect(errorUrl);
  }

  const tokens = await tokenRes.json();
  if (tokens.error) {
    errorUrl.searchParams.set("github_error", tokens.error);
    return NextResponse.redirect(errorUrl);
  }

  // Fetch GitHub user profile
  const profileRes = await fetch("https://api.github.com/user", {
    headers: {
      Authorization: `Bearer ${tokens.access_token}`,
      Accept: "application/vnd.github+json",
    },
  });

  if (!profileRes.ok) {
    errorUrl.searchParams.set("github_error", "profile_fetch_failed");
    return NextResponse.redirect(errorUrl);
  }

  const ghUser = await profileRes.json();
  const githubLogin: string = ghUser.login;

  // Upsert connected account — store the login as the providerAccountId
  await prisma.connectedAccount.upsert({
    where: {
      provider_providerAccountId: {
        provider: "github",
        providerAccountId: githubLogin,
      },
    },
    update: {
      userId,
      access_token: tokens.access_token,
      scope: tokens.scope,
    },
    create: {
      userId,
      provider: "github",
      providerAccountId: githubLogin,
      access_token: tokens.access_token,
      scope: tokens.scope,
    },
  });

  const successUrl = new URL(returnUrl);
  successUrl.searchParams.set("github_connected", "1");
  return NextResponse.redirect(successUrl);
}
