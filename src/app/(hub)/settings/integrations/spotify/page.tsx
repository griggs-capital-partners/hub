import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { Music4 } from "lucide-react";
import { getHubSettings } from "@/lib/hub-settings";
import { SpotifyIntegrationSettingsClient } from "@/components/settings/SpotifyIntegrationSettingsClient";

export default async function SpotifySettingsPage() {
  const session = await auth();
  if (!session) return null;

  const [hubSettings, spotifyAccount] = await Promise.all([
    getHubSettings(),
    prisma.connectedAccount.findFirst({
      where: { userId: session.user.id, provider: "spotify" },
    }),
  ]);

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-bold text-[#F0F0F0] flex items-center gap-2.5">
          <Music4 size={17} className="text-[#1DB954]" />
          Spotify
        </h2>
        <p className="text-sm text-[#505050] mt-1">
          Manage Spotify app credentials and your Team Jam now-playing connection.
        </p>
      </div>

      <SpotifyIntegrationSettingsClient
        initialSpotifyClientId={hubSettings?.spotifyClientId ?? ""}
        initialSpotifyClientSecret={hubSettings?.spotifyClientSecret ?? ""}
        isSpotifyConnected={Boolean(spotifyAccount)}
      />
    </div>
  );
}
