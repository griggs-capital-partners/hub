"use client";

import { useState, useCallback, useEffect, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { motion, AnimatePresence } from "framer-motion";
import { Music2, ExternalLink, X, Crown, ChevronDown, ChevronUp, Music } from "lucide-react";
import { StartJamModal } from "./StartJamModal";
import { authClient } from "@/lib/auth-client";
import { Avatar } from "@/components/ui/Avatar";


interface JamUser {
  id: string;
  name: string | null;
  displayName: string | null;
  image: string | null;
}

interface JamListener {
  id: string;
  userId: string;
  joinedAt: string;
  user: JamUser;
}

interface JamSession {
  id: string;
  hostId: string;
  jamLink: string;
  note: string | null;
  isActive: boolean;
  startedAt: string;
  host: JamUser;
  listeners: JamListener[];
}

interface NowPlayingTrack {
  name: string;
  artist: string;
  albumName: string;
  albumArt: string | null;
  progressMs: number;
  durationMs: number;
  isPlaying: boolean;
}

interface NowPlayingData {
  connected: boolean;
  playing: boolean;
  track?: NowPlayingTrack;
  autoEnded?: boolean;
}

function displayName(u: JamUser) {
  return u.displayName || u.name || "Someone";
}

function formatMs(ms: number) {
  const s = Math.floor(ms / 1000);
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}

// Animates progress bar smoothly between API polls
function useProgressMs(initial: number, durationMs: number, isPlaying: boolean) {
  const [progress, setProgress] = useState(initial);
  const rafRef = useRef<number | null>(null);
  const lastTickRef = useRef<number>(Date.now());

  useEffect(() => {
    setProgress(initial);
    lastTickRef.current = Date.now();
  }, [initial]);

  useEffect(() => {
    if (!isPlaying) {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      return;
    }
    const tick = () => {
      const now = Date.now();
      const delta = now - lastTickRef.current;
      lastTickRef.current = now;
      setProgress((p) => Math.min(p + delta, durationMs));
      rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
    return () => { if (rafRef.current) cancelAnimationFrame(rafRef.current); };
  }, [isPlaying, durationMs]);

  return progress;
}

export function TeamJamWidget() {
  const queryClient = useQueryClient();
  const session = authClient.useSession();
  const currentUserId = session.data?.user?.id;

  const [expanded, setExpanded] = useState(false);
  const [showStartModal, setShowStartModal] = useState(false);
  const [vibeUsers, setVibeUsers] = useState<Set<string>>(new Set());

  const { data: jamData } = useQuery<{ jam: JamSession | null }>({
    queryKey: ["jam"],
    queryFn: () => fetch("/api/jam").then((r) => r.json()),
    refetchInterval: (query) => (query.state.data?.jam ? 5000 : false),
  });

  const jam = jamData?.jam ?? null;

  const { data: nowPlayingData, isPending: nowPlayingPending } = useQuery<NowPlayingData>({
    queryKey: ["jam-now-playing", jam?.id],
    queryFn: () => fetch(`/api/jam/${jam!.id}/now-playing`).then((r) => r.json()),
    enabled: !!jam?.id,
    refetchInterval: 10000,
  });

  // Auto-end detected by the server — refresh the jam query so the UI clears immediately
  useEffect(() => {
    if (nowPlayingData?.autoEnded) {
      setExpanded(false);
      queryClient.invalidateQueries({ queryKey: ["jam"] });
    }
  }, [nowPlayingData?.autoEnded, queryClient]);

  const track = nowPlayingData?.playing ? nowPlayingData.track : null;
  // Only treat as "not connected" once the query has settled — avoids the
  // prompt flashing during the initial load while nowPlayingData is undefined.
  const isSpotifyConnected = nowPlayingPending ? true : (nowPlayingData?.connected ?? false);

  const isHost = jam?.hostId === currentUserId;
  const hasJoined = jam?.listeners.some((l) => l.userId === currentUserId) ?? false;

  const progress = useProgressMs(
    track?.progressMs ?? 0,
    track?.durationMs ?? 1,
    track?.isPlaying ?? false
  );

  const endJam = useMutation({
    mutationFn: () => fetch(`/api/jam/${jam!.id}`, { method: "DELETE" }).then((r) => r.json()),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["jam"] }),
  });

  const joinJam = useMutation({
    mutationFn: () => fetch(`/api/jam/${jam!.id}/join`, { method: "POST" }).then((r) => r.json()),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["jam"] }),
  });

  const leaveJam = useMutation({
    mutationFn: () => fetch(`/api/jam/${jam!.id}/leave`, { method: "POST" }).then((r) => r.json()),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["jam"] }),
  });

  const vibe = useMutation({
    mutationFn: () => fetch(`/api/jam/${jam!.id}/vibe`, { method: "POST" }).then((r) => r.json()),
    onSuccess: () => {
      if (!currentUserId) return;
      setVibeUsers((prev) => new Set(prev).add(currentUserId));
      setTimeout(() => {
        setVibeUsers((prev) => { const n = new Set(prev); n.delete(currentUserId); return n; });
      }, 3000);
    },
  });

  const handleJoinInSpotify = useCallback(() => {
    if (!jam) return;
    window.open(jam.jamLink, "_blank", "noopener,noreferrer");
    if (!hasJoined) joinJam.mutate();
  }, [jam, hasJoined, joinJam]);

  if (!jam) {
    return (
      <>
        <motion.button
          onClick={() => setShowStartModal(true)}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all"
          style={{ color: "#606060", border: "1px solid rgba(255,255,255,0.06)", background: "rgba(255,255,255,0.03)" }}
          whileHover={{ color: "#1DB954", borderColor: "rgba(29,185,84,0.3)", background: "rgba(29,185,84,0.06)" }}
        >
          <Music size={12} />
          <span className="hidden sm:inline">Start a Jam</span>
        </motion.button>
        <StartJamModal
          open={showStartModal}
          onClose={() => setShowStartModal(false)}
          onStarted={() => { setShowStartModal(false); queryClient.invalidateQueries({ queryKey: ["jam"] }); }}
        />
      </>
    );
  }

  const listenerCount = jam.listeners.length;
  const isVibingNow = vibeUsers.has(currentUserId ?? "");
  const progressPct = track ? (progress / track.durationMs) * 100 : 0;

  return (
    <>
      {/* Compact pill */}
      <div className="relative flex items-center gap-1.5">
        <motion.div
          className="flex items-center gap-2 pl-2.5 pr-1.5 py-1.5 rounded-xl cursor-pointer select-none"
          style={{ background: "rgba(29,185,84,0.1)", border: "1px solid rgba(29,185,84,0.4)", boxShadow: "0 0 12px rgba(29,185,84,0.15), inset 0 1px 0 rgba(29,185,84,0.1)" }}
          whileHover={{ background: "rgba(29,185,84,0.15)", borderColor: "rgba(29,185,84,0.55)" }}
          onClick={() => setExpanded((v) => !v)}
        >
          {track?.albumArt ? (
            <img src={track.albumArt} alt="" className="w-4 h-4 rounded-sm flex-shrink-0 object-cover" />
          ) : (
            <span className="w-2 h-2 rounded-full flex-shrink-0 animate-pulse" style={{ background: "#1DB954" }} />
          )}
          <span className="text-xs font-semibold hidden sm:inline max-w-[120px] truncate" style={{ color: "#1DB954" }}>
            {track ? track.name : (jam.note || "Team Jam")}
          </span>
          {track && (
            <span className="text-[10px] hidden md:inline truncate max-w-[80px]" style={{ color: "rgba(29,185,84,0.6)" }}>
              {track.artist.split(",")[0]}
            </span>
          )}
          {!track && listenerCount > 0 && (
            <span className="text-[10px] hidden sm:inline" style={{ color: "rgba(29,185,84,0.6)" }}>
              {listenerCount} listening
            </span>
          )}
          {expanded ? <ChevronUp size={12} style={{ color: "#1DB954" }} /> : <ChevronDown size={12} style={{ color: "#1DB954" }} />}
        </motion.div>

        {/* Expanded panel */}
        <AnimatePresence>
          {expanded && (
            <>
              <div className="fixed inset-0 z-40" onClick={() => setExpanded(false)} />
              <motion.div
                initial={{ opacity: 0, y: 8, scale: 0.96 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: 8, scale: 0.96 }}
                transition={{ duration: 0.18, ease: "easeOut" }}
                className="fixed right-4 top-[68px] z-50 w-80 rounded-2xl overflow-hidden"
                style={{ background: "#1A1A1A", border: "1px solid rgba(29,185,84,0.35)", boxShadow: "0 8px 32px rgba(0,0,0,0.7), 0 0 0 1px rgba(29,185,84,0.08), 0 0 40px rgba(29,185,84,0.08)" }}
              >
                {/* Now Playing section */}
                {track ? (
                  <div className="relative overflow-hidden">
                    {/* Blurred album art background */}
                    {track.albumArt && (
                      <div
                        className="absolute inset-0 opacity-20 scale-110"
                        style={{ backgroundImage: `url(${track.albumArt})`, backgroundSize: "cover", backgroundPosition: "center", filter: "blur(24px)" }}
                      />
                    )}
                    <div className="relative px-4 pt-4 pb-3">
                      <div className="flex items-center gap-3">
                        {/* Album art */}
                        <div className="relative flex-shrink-0">
                          {track.albumArt ? (
                            <img
                              src={track.albumArt}
                              alt={track.albumName}
                              className="w-16 h-16 rounded-lg object-cover"
                              style={{ boxShadow: "0 4px 16px rgba(0,0,0,0.5)" }}
                            />
                          ) : (
                            <div className="w-16 h-16 rounded-lg flex items-center justify-center animate-pulse" style={{ background: "rgba(29,185,84,0.15)" }}>
                              <Music2 size={24} style={{ color: "#1DB954" }} />
                            </div>
                          )}
                          {track.isPlaying && (
                            <div className="absolute -bottom-1 -right-1 flex items-end gap-px h-3 px-1 rounded-sm" style={{ background: "#1DB954" }}>
                              {[1, 2, 3].map((i) => (
                                <span
                                  key={i}
                                  className="w-0.5 rounded-full"
                                  style={{
                                    background: "#000",
                                    height: "40%",
                                    animation: `barBounce${i} 0.8s ease-in-out infinite`,
                                    animationDelay: `${i * 0.15}s`,
                                  }}
                                />
                              ))}
                            </div>
                          )}
                        </div>

                        <div className="min-w-0 flex-1">
                          <div className="text-[10px] font-bold uppercase tracking-widest mb-0.5" style={{ color: "#1DB954" }}>
                            Now Playing
                          </div>
                          <div className="text-white font-bold text-sm leading-tight truncate" title={track.name}>
                            {track.name}
                          </div>
                          <div className="text-xs mt-0.5 truncate" style={{ color: "#9A9A9A" }}>
                            {track.artist}
                          </div>
                          <div className="text-[10px] mt-0.5 truncate" style={{ color: "#505050" }}>
                            {track.albumName}
                          </div>
                        </div>

                        <button onClick={() => setExpanded(false)} className="self-start p-1 rounded-md flex-shrink-0" style={{ color: "#404040" }}>
                          <X size={13} />
                        </button>
                      </div>

                      {/* Progress bar */}
                      <div className="mt-3 space-y-1">
                        <div className="h-1 w-full rounded-full overflow-hidden" style={{ background: "rgba(255,255,255,0.08)" }}>
                          <motion.div
                            className="h-full rounded-full"
                            style={{ background: "#1DB954", width: `${progressPct}%` }}
                          />
                        </div>
                        <div className="flex justify-between text-[10px]" style={{ color: "#505050" }}>
                          <span>{formatMs(progress)}</span>
                          <span>{formatMs(track.durationMs)}</span>
                        </div>
                      </div>
                    </div>
                  </div>
                ) : (
                  /* No track data — header only */
                  <div className="flex items-center justify-between px-4 pt-4 pb-3" style={{ borderBottom: "1px solid rgba(255,255,255,0.08)", background: "rgba(29,185,84,0.04)" }}>
                    <div className="flex items-center gap-2.5">
                      <div className="w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0 animate-pulse" style={{ background: "rgba(29,185,84,0.15)" }}>
                        <Music2 size={15} style={{ color: "#1DB954" }} />
                      </div>
                      <div>
                        <div className="text-sm font-bold text-white leading-tight">{jam.note || "Team Jam"}</div>
                        <div className="text-[11px] flex items-center gap-1 mt-0.5" style={{ color: "#606060" }}>
                          <Crown size={10} style={{ color: "#FBBA00" }} />
                          <span>{displayName(jam.host)} is hosting</span>
                        </div>
                      </div>
                    </div>
                    <button onClick={() => setExpanded(false)} className="p-1 rounded-md" style={{ color: "#404040" }}>
                      <X size={13} />
                    </button>
                  </div>
                )}

                {/* Connect Spotify prompt for host */}
                {isHost && !isSpotifyConnected && (
                  <div className="px-4 py-2.5 flex items-center gap-2.5" style={{ borderTop: "1px solid rgba(255,255,255,0.04)", background: "rgba(29,185,84,0.04)" }}>
                    <div className="w-1.5 h-1.5 rounded-full" style={{ background: "#1DB954" }} />
                    <p className="text-xs flex-1" style={{ color: "#888888" }}>
                      Connect Spotify to show teammates what&apos;s playing
                    </p>
                    <a
                      href="/api/spotify/connect"
                      className="text-xs font-semibold px-2 py-1 rounded-md flex-shrink-0 transition-colors"
                      style={{ color: "#1DB954", border: "1px solid rgba(29,185,84,0.3)" }}
                    >
                      Connect
                    </a>
                  </div>
                )}

                {/* Listeners */}
                <div className="px-4 py-3" style={{ borderTop: "1px solid rgba(255,255,255,0.08)" }}>
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-[10px] font-semibold uppercase tracking-wider" style={{ color: "#666666" }}>
                      Listening now
                    </span>
                    {track && (
                      <div className="text-[11px] flex items-center gap-1" style={{ color: "#505050" }}>
                        <Crown size={9} style={{ color: "#FBBA00" }} />
                        <span>{displayName(jam.host)}</span>
                      </div>
                    )}
                  </div>

                  {jam.listeners.length === 0 ? (
                    <p className="text-xs" style={{ color: "#404040" }}>No one has joined yet</p>
                  ) : (
                    <div className="flex flex-wrap gap-3">
                      {jam.listeners.map((l) => (
                        <div key={l.id} className="flex flex-col items-center gap-1 relative">
                          <div className="relative">
                            <Avatar src={l.user.image} name={l.user.name} size="sm" />
                            {l.userId === jam.hostId && (
                              <span className="absolute -top-1 -right-1 text-[10px]">👑</span>
                            )}
                          </div>
                          <span className="text-[10px] max-w-[48px] truncate" style={{ color: "#505050" }}>
                            {displayName(l.user).split(" ")[0]}
                          </span>
                          <AnimatePresence>
                            {vibeUsers.has(l.userId) && (
                              <motion.span
                                key="vibe"
                                className="absolute -top-6 text-base pointer-events-none"
                                initial={{ opacity: 1, y: 0 }}
                                animate={{ opacity: 0, y: -32 }}
                                exit={{ opacity: 0 }}
                                transition={{ duration: 2 }}
                              >
                                🔥
                              </motion.span>
                            )}
                          </AnimatePresence>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Actions */}
                <div className="px-4 py-3 flex items-center gap-2" style={{ borderTop: "1px solid rgba(255,255,255,0.08)" }}>
                  <button
                    onClick={handleJoinInSpotify}
                    className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-xs font-semibold transition-all"
                    style={{ background: "rgba(29,185,84,0.12)", color: "#1DB954", border: "1px solid rgba(29,185,84,0.25)" }}
                  >
                    <ExternalLink size={12} />
                    {hasJoined ? "Open in Spotify" : "Join in Spotify"}
                  </button>

                  <motion.button
                    onClick={() => vibe.mutate()}
                    disabled={vibe.isPending}
                    className="px-3 py-2 rounded-lg text-sm transition-all"
                    style={{ background: isVibingNow ? "rgba(251,186,0,0.12)" : "rgba(255,255,255,0.04)", border: `1px solid ${isVibingNow ? "rgba(251,186,0,0.3)" : "rgba(255,255,255,0.06)"}` }}
                    whileTap={{ scale: 0.9 }}
                    title="Send a vibe!"
                  >
                    🔥
                  </motion.button>

                  {!isHost && hasJoined && (
                    <button onClick={() => leaveJam.mutate()} className="px-3 py-2 rounded-lg text-xs transition-all" style={{ color: "#606060", border: "1px solid rgba(255,255,255,0.06)" }} title="Leave jam">
                      <X size={12} />
                    </button>
                  )}

                  {isHost && (
                    <button onClick={() => { endJam.mutate(); setExpanded(false); }} className="px-3 py-2 rounded-lg text-xs transition-all" style={{ color: "#EF4444", border: "1px solid rgba(239,68,68,0.2)", background: "rgba(239,68,68,0.06)" }}>
                      End
                    </button>
                  )}
                </div>

                {/* Animated bars keyframes */}
                <style>{`
                  @keyframes barBounce1 { 0%,100%{height:30%} 50%{height:90%} }
                  @keyframes barBounce2 { 0%,100%{height:70%} 50%{height:20%} }
                  @keyframes barBounce3 { 0%,100%{height:50%} 50%{height:95%} }
                `}</style>
              </motion.div>
            </>
          )}
        </AnimatePresence>
      </div>

      {/* Join notification banner */}
      <AnimatePresence>
        {!isHost && !hasJoined && (
          <motion.div
            initial={{ opacity: 0, y: -40 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -40 }}
            transition={{ duration: 0.3 }}
            className="fixed top-4 left-1/2 -translate-x-1/2 z-50 flex items-center gap-3 px-4 py-2.5 rounded-xl shadow-2xl"
            style={{ background: "#111111", border: "1px solid rgba(29,185,84,0.4)", boxShadow: "0 4px 24px rgba(0,0,0,0.5), 0 0 16px rgba(29,185,84,0.1)" }}
          >
            {track?.albumArt ? (
              <img src={track.albumArt} alt="" className="w-8 h-8 rounded-md object-cover flex-shrink-0" />
            ) : (
              <span className="animate-pulse text-base">🎵</span>
            )}
            <div>
              <span className="text-sm text-white">
                <span className="font-bold" style={{ color: "#1DB954" }}>{displayName(jam.host)}</span> started a Team Jam
              </span>
              {track && (
                <div className="text-[11px] truncate max-w-[180px]" style={{ color: "#606060" }}>
                  {track.name} · {track.artist.split(",")[0]}
                </div>
              )}
            </div>
            <button onClick={handleJoinInSpotify} className="px-3 py-1.5 rounded-lg text-xs font-bold flex-shrink-0" style={{ background: "#1DB954", color: "#000" }}>
              Join Now
            </button>
            <button onClick={() => joinJam.mutate()} className="p-1 rounded flex-shrink-0" style={{ color: "#606060" }} title="Dismiss">
              <X size={12} />
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
