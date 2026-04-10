"use client";

import { useState } from "react";
import { Music4, Radio, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";

interface Props {
  initialSpotifyClientId: string;
  initialSpotifyClientSecret: string;
  isSpotifyConnected: boolean;
}

export function SpotifyIntegrationSettingsClient({
  initialSpotifyClientId,
  initialSpotifyClientSecret,
  isSpotifyConnected,
}: Props) {
  const [spotifyClientId, setSpotifyClientId] = useState(initialSpotifyClientId);
  const [spotifyClientSecret, setSpotifyClientSecret] = useState(initialSpotifyClientSecret);
  const [savedSpotifyClientId, setSavedSpotifyClientId] = useState(initialSpotifyClientId);
  const [savedSpotifyClientSecret, setSavedSpotifyClientSecret] = useState(initialSpotifyClientSecret);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ text: string; ok: boolean } | null>(null);

  const spotifyConfigured = savedSpotifyClientId.trim().length > 0 && savedSpotifyClientSecret.trim().length > 0;
  const spotifyDirty =
    spotifyClientId.trim() !== savedSpotifyClientId.trim()
    || spotifyClientSecret.trim() !== savedSpotifyClientSecret.trim();

  async function saveSpotifySettings(clear = false) {
    setSaving(true);
    setMessage(null);

    try {
      const res = await fetch("/api/hub-settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          spotifyClientId: clear ? "" : spotifyClientId.trim(),
          spotifyClientSecret: clear ? "" : spotifyClientSecret.trim(),
        }),
      });

      const data = (await res.json()) as {
        error?: string;
        settings?: {
          spotifyClientId: string | null;
          spotifyClientSecret: string | null;
        };
      };

      if (!res.ok) {
        setMessage({ text: data.error ?? "Could not save Spotify settings", ok: false });
        return;
      }

      const nextClientId = data.settings?.spotifyClientId ?? "";
      const nextClientSecret = data.settings?.spotifyClientSecret ?? "";
      setSpotifyClientId(nextClientId);
      setSpotifyClientSecret(nextClientSecret);
      setSavedSpotifyClientId(nextClientId);
      setSavedSpotifyClientSecret(nextClientSecret);
      setMessage({
        text: nextClientId && nextClientSecret ? "Spotify app credentials saved." : "Spotify app credentials cleared.",
        ok: true,
      });
    } catch {
      setMessage({ text: "Could not save Spotify settings", ok: false });
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="rounded-2xl border border-[rgba(29,185,84,0.18)] bg-gradient-to-br from-[#0F1712] via-[#101410] to-[#0B0D0B] p-5 sm:p-6">
      <div className="flex items-start gap-3">
        <div className="mt-0.5 flex h-10 w-10 items-center justify-center rounded-2xl border border-[rgba(29,185,84,0.22)] bg-[rgba(29,185,84,0.12)]">
          <Music4 size={18} className="text-[#1DB954]" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <p className="text-sm font-semibold text-[#F0F0F0]">Spotify</p>
            <span className={`rounded-full px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.18em] ${
              isSpotifyConnected
                ? "bg-[rgba(34,197,94,0.12)] text-[#86EFAC]"
                : "bg-[rgba(255,255,255,0.05)] text-[#707070]"
            }`}>
              {isSpotifyConnected ? "Connected" : "Not connected"}
            </span>
            <span className={`rounded-full px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.18em] ${
              spotifyConfigured
                ? "bg-[rgba(29,185,84,0.12)] text-[#7EE2A8]"
                : "bg-[rgba(255,255,255,0.05)] text-[#707070]"
            }`}>
              {spotifyConfigured ? "App configured" : "App credentials needed"}
            </span>
          </div>
          <p className="mt-1 max-w-2xl text-sm text-[#7F8A7F]">
            Save your Spotify app client ID and secret here so OAuth and Team Jam now-playing work without deployment env vars.
          </p>
        </div>
      </div>

      <div className="mt-5 grid grid-cols-1 gap-3 md:grid-cols-2">
        <Input
          label="Spotify Client ID"
          placeholder="Spotify app client ID"
          value={spotifyClientId}
          onChange={(event) => setSpotifyClientId(event.target.value)}
          icon={<Radio size={14} />}
        />
        <Input
          label="Spotify Client Secret"
          type="password"
          placeholder="Spotify app client secret"
          value={spotifyClientSecret}
          onChange={(event) => setSpotifyClientSecret(event.target.value)}
          icon={<ShieldCheck size={14} />}
        />
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-2">
        <Button
          type="button"
          loading={saving}
          disabled={saving || !spotifyDirty}
          onClick={() => void saveSpotifySettings(false)}
        >
          Save Spotify credentials
        </Button>
        <Button
          type="button"
          variant="secondary"
          disabled={saving || (!spotifyClientId.trim() && !spotifyClientSecret.trim() && !spotifyConfigured)}
          onClick={() => void saveSpotifySettings(true)}
        >
          Clear credentials
        </Button>
        <a
          href={spotifyConfigured ? "/api/spotify/connect?returnTo=/settings/integrations/spotify" : undefined}
          className={`inline-flex items-center rounded-xl px-4 py-2 text-sm font-semibold transition-colors ${
            spotifyConfigured
              ? "bg-[#1DB954] text-[#041109] hover:bg-[#2AD164]"
              : "cursor-not-allowed bg-[rgba(255,255,255,0.05)] text-[#606060]"
          }`}
          aria-disabled={!spotifyConfigured}
          onClick={(event) => {
            if (!spotifyConfigured) event.preventDefault();
          }}
        >
          {isSpotifyConnected ? "Reconnect Spotify" : "Connect Spotify"}
        </a>
        {isSpotifyConnected && (
          <a
            href="/api/spotify/disconnect?returnTo=/settings/integrations/spotify"
            className="inline-flex items-center rounded-xl border border-[rgba(239,68,68,0.2)] px-4 py-2 text-sm font-semibold text-[#EF4444] transition-colors hover:bg-[rgba(239,68,68,0.08)]"
          >
            Disconnect
          </a>
        )}
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-3 text-xs">
        <span className="rounded-full border border-[rgba(255,255,255,0.06)] bg-[rgba(255,255,255,0.03)] px-2.5 py-1 text-[#909090]">
          Redirect URI: `/api/spotify/callback`
        </span>
        {message && (
          <span className={message.ok ? "text-emerald-400" : "text-red-400"}>
            {message.text}
          </span>
        )}
      </div>
    </div>
  );
}
