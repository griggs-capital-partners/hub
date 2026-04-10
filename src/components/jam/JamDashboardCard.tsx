"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { Music2, ExternalLink, Crown, X } from "lucide-react";
import { authClient } from "@/lib/auth-client";
import { Avatar } from "@/components/ui/Avatar";
import { StartJamModal } from "./StartJamModal";

interface JamUser {
  id: string;
  name: string | null;
  displayName: string | null;
  image: string | null;
}

interface JamSession {
  id: string;
  hostId: string;
  jamLink: string;
  note: string | null;
  host: JamUser;
  listeners: { id: string; userId: string; user: JamUser }[];
}

function displayName(u: JamUser) {
  return u.displayName || u.name || "Someone";
}

export function JamDashboardCard() {
  const queryClient = useQueryClient();
  const session = authClient.useSession();
  const currentUserId = session.data?.user?.id;
  const [showModal, setShowModal] = useState(false);

  const { data } = useQuery<{ jam: JamSession | null }>({
    queryKey: ["jam"],
    queryFn: () => fetch("/api/jam").then((r) => r.json()),
    refetchInterval: (query) => (query.state.data?.jam ? 5000 : false),
  });

  const jam = data?.jam ?? null;
  const isHost = jam?.hostId === currentUserId;
  const hasJoined = jam?.listeners.some((l) => l.userId === currentUserId) ?? false;

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

  // ── No active jam ──────────────────────────────────────────────────────────
  if (!jam) {
    return (
      <>
        <motion.button
          onClick={() => setShowModal(true)}
          className="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-left transition-all"
          style={{
            background: "rgba(29,185,84,0.04)",
            border: "1px dashed rgba(29,185,84,0.2)",
          }}
          whileHover={{ background: "rgba(29,185,84,0.08)", borderColor: "rgba(29,185,84,0.35)" }}
        >
          <div
            className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0"
            style={{ background: "rgba(29,185,84,0.1)" }}
          >
            <Music2 size={15} style={{ color: "#1DB954" }} />
          </div>
          <div>
            <div className="text-sm font-semibold" style={{ color: "#1DB954" }}>
              Start a Team Jam
            </div>
            <div className="text-xs" style={{ color: "#404040" }}>
              Share a Spotify Jam with the team
            </div>
          </div>
        </motion.button>

        <StartJamModal
          open={showModal}
          onClose={() => setShowModal(false)}
          onStarted={() => {
            setShowModal(false);
            queryClient.invalidateQueries({ queryKey: ["jam"] });
          }}
        />
      </>
    );
  }

  // ── Active jam ─────────────────────────────────────────────────────────────
  return (
    <div
      className="rounded-xl overflow-hidden"
      style={{
        background: "rgba(29,185,84,0.06)",
        border: "1px solid rgba(29,185,84,0.2)",
      }}
    >
      {/* Header */}
      <div className="flex items-center gap-3 px-4 py-3">
        <div
          className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 animate-pulse"
          style={{ background: "rgba(29,185,84,0.15)" }}
        >
          <Music2 size={15} style={{ color: "#1DB954" }} />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full animate-pulse" style={{ background: "#1DB954" }} />
            <span className="text-sm font-bold" style={{ color: "#1DB954" }}>
              {jam.note || "Team Jam"}
            </span>
          </div>
          <div className="text-xs flex items-center gap-1" style={{ color: "#505050" }}>
            <Crown size={9} style={{ color: "#FBBA00" }} />
            {displayName(jam.host)} is hosting · {jam.listeners.length} listening
          </div>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-1.5 flex-shrink-0">
          {!hasJoined ? (
            <button
              onClick={() => {
                window.open(jam.jamLink, "_blank", "noopener,noreferrer");
                joinJam.mutate();
              }}
              className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-semibold transition-all"
              style={{ background: "#1DB954", color: "#000" }}
            >
              <ExternalLink size={11} />
              Join
            </button>
          ) : (
            <button
              onClick={() => window.open(jam.jamLink, "_blank", "noopener,noreferrer")}
              className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-semibold transition-all"
              style={{ background: "rgba(29,185,84,0.15)", color: "#1DB954", border: "1px solid rgba(29,185,84,0.25)" }}
            >
              <ExternalLink size={11} />
              Open
            </button>
          )}

          {!isHost && hasJoined && (
            <button
              onClick={() => leaveJam.mutate()}
              className="p-1.5 rounded-lg transition-all"
              style={{ color: "#505050", border: "1px solid rgba(255,255,255,0.06)" }}
              title="Leave jam"
            >
              <X size={12} />
            </button>
          )}

          {isHost && (
            <button
              onClick={() => endJam.mutate()}
              className="px-2.5 py-1.5 rounded-lg text-xs transition-all"
              style={{ color: "#EF4444", border: "1px solid rgba(239,68,68,0.15)", background: "rgba(239,68,68,0.06)" }}
            >
              End
            </button>
          )}
        </div>
      </div>

      {/* Listener avatars */}
      {jam.listeners.length > 0 && (
        <div
          className="flex items-center gap-2 px-4 py-2"
          style={{ borderTop: "1px solid rgba(29,185,84,0.1)" }}
        >
          <div className="flex -space-x-2">
            {jam.listeners.slice(0, 6).map((l) => (
              <div key={l.id} className="relative" title={displayName(l.user)}>
                <Avatar
                  src={l.user.image}
                  name={l.user.name}
                  size="xs"
                  className="ring-1 ring-[#0D0D0D]"
                />
                {l.userId === jam.hostId && (
                  <span className="absolute -top-1 -right-0.5 text-[8px] leading-none">👑</span>
                )}
              </div>
            ))}
          </div>
          {jam.listeners.length > 6 && (
            <span className="text-xs" style={{ color: "#404040" }}>
              +{jam.listeners.length - 6} more
            </span>
          )}
        </div>
      )}
    </div>
  );
}
