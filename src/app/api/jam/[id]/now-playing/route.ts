import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { getHubSettings } from "@/lib/hub-settings";
import { prisma } from "@/lib/prisma";

async function refreshSpotifyToken(accountId: string, refreshToken: string) {
  const settings = await getHubSettings();
  const clientId = settings?.spotifyClientId;
  const clientSecret = settings?.spotifyClientSecret;
  if (!clientId || !clientSecret) return null;

  const res = await fetch("https://accounts.spotify.com/api/token", {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      Authorization: `Basic ${Buffer.from(`${clientId}:${clientSecret}`).toString("base64")}`,
    },
    body: new URLSearchParams({
      grant_type: "refresh_token",
      refresh_token: refreshToken,
    }),
  });

  if (!res.ok) return null;

  const tokens = await res.json();
  const expiresAt = Math.floor(Date.now() / 1000) + tokens.expires_in;

  await prisma.connectedAccount.update({
    where: { id: accountId },
    data: {
      access_token: tokens.access_token,
      expires_at: expiresAt,
      // Spotify only returns a new refresh_token occasionally
      ...(tokens.refresh_token ? { refresh_token: tokens.refresh_token } : {}),
    },
  });

  return tokens.access_token as string;
}

// GET /api/jam/[id]/now-playing
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;

  const jam = await prisma.jamSession.findUnique({
    where: { id },
    select: { hostId: true, isActive: true, lastPlayingAt: true },
  });

  if (!jam || !jam.isActive) {
    return NextResponse.json({ error: "No active session" }, { status: 404 });
  }

  // Prefer the host's own Spotify token if they have one connected.
  // If not, fall back to any team member's token — so only one person
  // on the team ever needs to link Spotify for now-playing to work.
  const account =
    (await prisma.connectedAccount.findFirst({
      where: { userId: jam.hostId, provider: "spotify" },
    })) ??
    (await prisma.connectedAccount.findFirst({
      where: { provider: "spotify" },
    }));

  if (!account) {
    return NextResponse.json({ connected: false });
  }

  const spotifySettings = await getHubSettings();
  if (!spotifySettings?.spotifyClientId || !spotifySettings?.spotifyClientSecret) {
    return NextResponse.json({ connected: false, error: "spotify_not_configured" });
  }

  // Refresh token if expired (with 60s buffer)
  let accessToken = account.access_token;
  if (account.expires_at && account.expires_at < Math.floor(Date.now() / 1000) + 60) {
    if (account.refresh_token) {
      accessToken = await refreshSpotifyToken(account.id, account.refresh_token);
    }
    if (!accessToken) {
      return NextResponse.json({ connected: true, playing: false });
    }
  }

  // How long with no playback before we treat the Spotify Jam as ended
  const AUTO_END_SILENCE_MS = 60 * 1000; // 60 seconds

  async function autoEndIfSilent() {
    if (!jam!.lastPlayingAt) return false; // never played — don't auto-end
    const silentMs = Date.now() - new Date(jam!.lastPlayingAt).getTime();
    if (silentMs < AUTO_END_SILENCE_MS) return false;
    await prisma.jamSession.update({
      where: { id },
      data: { isActive: false, endedAt: new Date() },
    });
    return true;
  }

  // Fetch currently playing from Spotify
  try {
    const spotifyRes = await fetch("https://api.spotify.com/v1/me/player/currently-playing", {
      headers: { Authorization: `Bearer ${accessToken}` },
      cache: "no-store",
    });

    // 204 = nothing playing, 401 = expired token
    if (spotifyRes.status === 204 || spotifyRes.status === 401) {
      const ended = await autoEndIfSilent();
      return NextResponse.json({ connected: true, playing: false, autoEnded: ended });
    }

    if (!spotifyRes.ok) {
      return NextResponse.json({ connected: true, playing: false });
    }

    const data = await spotifyRes.json();

    if (!data?.item || !data.is_playing) {
      const ended = await autoEndIfSilent();
      return NextResponse.json({ connected: true, playing: false, autoEnded: ended });
    }

    // Music is playing — keep lastPlayingAt fresh
    await prisma.jamSession.update({
      where: { id },
      data: { lastPlayingAt: new Date() },
    });

    const track = {
      name: data.item.name as string,
      artist: (data.item.artists as { name: string }[]).map((a) => a.name).join(", "),
      albumName: data.item.album.name as string,
      albumArt: (data.item.album.images as { url: string }[])[0]?.url ?? null,
      progressMs: data.progress_ms as number,
      durationMs: data.item.duration_ms as number,
      isPlaying: data.is_playing as boolean,
    };

    return NextResponse.json({ connected: true, playing: true, track });
  } catch {
    // Network or parse error — account is connected, just can't reach Spotify right now
    return NextResponse.json({ connected: true, playing: false });
  }
}
