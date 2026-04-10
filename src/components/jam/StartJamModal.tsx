"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Music2, X, ExternalLink } from "lucide-react";

interface Props {
  open: boolean;
  onClose: () => void;
  onStarted: () => void;
}

export function StartJamModal({ open, onClose, onStarted }: Props) {
  const [link, setLink] = useState("");
  const [note, setNote] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleStart() {
    setError("");
    if (!link.trim()) {
      setError("Paste your Spotify Jam link first.");
      return;
    }

    setLoading(true);
    try {
      const res = await fetch("/api/jam", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ jamLink: link.trim(), note: note.trim() }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Failed to start jam.");
        return;
      }
      setLink("");
      setNote("");
      onStarted();
    } catch {
      setError("Something went wrong. Try again.");
    } finally {
      setLoading(false);
    }
  }

  function handleClose() {
    setLink("");
    setNote("");
    setError("");
    onClose();
  }

  return (
    <AnimatePresence>
      {open && (
        <>
          <div
            className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm"
            onClick={handleClose}
          />
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 12 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 12 }}
            transition={{ duration: 0.2, ease: "easeOut" }}
            className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-50 w-full max-w-md rounded-2xl overflow-hidden"
            style={{
              background: "#111111",
              border: "1px solid rgba(29,185,84,0.25)",
              boxShadow: "0 16px 48px rgba(0,0,0,0.6), 0 0 24px rgba(29,185,84,0.06)",
            }}
          >
            {/* Header */}
            <div
              className="flex items-center justify-between px-5 py-4"
              style={{ borderBottom: "1px solid rgba(255,255,255,0.06)" }}
            >
              <div className="flex items-center gap-2.5">
                <div
                  className="w-8 h-8 rounded-lg flex items-center justify-center"
                  style={{ background: "rgba(29,185,84,0.15)" }}
                >
                  <Music2 size={15} style={{ color: "#1DB954" }} />
                </div>
                <div>
                  <div className="text-sm font-bold text-white">Start a Team Jam</div>
                  <div className="text-[11px]" style={{ color: "#606060" }}>
                    Let your teammates join your Spotify session
                  </div>
                </div>
              </div>
              <button
                onClick={handleClose}
                className="p-1.5 rounded-lg transition-colors"
                style={{ color: "#606060" }}
              >
                <X size={15} />
              </button>
            </div>

            {/* Instructions */}
            <div className="px-5 py-4" style={{ borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
              <ol className="space-y-2 text-xs" style={{ color: "#606060" }}>
                <li className="flex items-start gap-2">
                  <span
                    className="w-4 h-4 rounded-full flex items-center justify-center text-[10px] font-bold flex-shrink-0 mt-0.5"
                    style={{ background: "rgba(29,185,84,0.15)", color: "#1DB954" }}
                  >
                    1
                  </span>
                  Open Spotify and start a Jam session from the "Connect to a device" menu.
                </li>
                <li className="flex items-start gap-2">
                  <span
                    className="w-4 h-4 rounded-full flex items-center justify-center text-[10px] font-bold flex-shrink-0 mt-0.5"
                    style={{ background: "rgba(29,185,84,0.15)", color: "#1DB954" }}
                  >
                    2
                  </span>
                  Tap <strong className="text-white">Invite</strong> inside the Jam and copy the join link.
                </li>
                <li className="flex items-start gap-2">
                  <span
                    className="w-4 h-4 rounded-full flex items-center justify-center text-[10px] font-bold flex-shrink-0 mt-0.5"
                    style={{ background: "rgba(29,185,84,0.15)", color: "#1DB954" }}
                  >
                    3
                  </span>
                  Paste it below and hit <strong className="text-white">Start Jam</strong>.
                </li>
              </ol>
            </div>

            {/* Form */}
            <div className="px-5 py-4 space-y-3">
              <div>
                <label className="block text-xs font-medium mb-1.5" style={{ color: "#9A9A9A" }}>
                  Spotify Jam Link <span style={{ color: "#EF4444" }}>*</span>
                </label>
                <input
                  type="url"
                  value={link}
                  onChange={(e) => setLink(e.target.value)}
                  placeholder="https://open.spotify.com/jam/..."
                  className="w-full px-3 py-2 rounded-lg text-sm text-white outline-none transition-all"
                  style={{
                    background: "rgba(255,255,255,0.04)",
                    border: "1px solid rgba(255,255,255,0.1)",
                  }}
                  onFocus={(e) => (e.target.style.borderColor = "rgba(29,185,84,0.5)")}
                  onBlur={(e) => (e.target.style.borderColor = "rgba(255,255,255,0.1)")}
                />
              </div>

              <div>
                <label className="block text-xs font-medium mb-1.5" style={{ color: "#9A9A9A" }}>
                  What are you playing? <span style={{ color: "#404040" }}>(optional)</span>
                </label>
                <input
                  type="text"
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  placeholder="e.g. Lo-fi beats, Focus playlist..."
                  maxLength={60}
                  className="w-full px-3 py-2 rounded-lg text-sm text-white outline-none transition-all"
                  style={{
                    background: "rgba(255,255,255,0.04)",
                    border: "1px solid rgba(255,255,255,0.1)",
                  }}
                  onFocus={(e) => (e.target.style.borderColor = "rgba(29,185,84,0.5)")}
                  onBlur={(e) => (e.target.style.borderColor = "rgba(255,255,255,0.1)")}
                />
              </div>

              {error && (
                <p className="text-xs" style={{ color: "#EF4444" }}>
                  {error}
                </p>
              )}
            </div>

            {/* Footer */}
            <div
              className="px-5 py-4 flex items-center gap-3"
              style={{ borderTop: "1px solid rgba(255,255,255,0.06)" }}
            >
              <button
                onClick={handleStart}
                disabled={loading}
                className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-bold transition-all disabled:opacity-60"
                style={{
                  background: "#1DB954",
                  color: "#000",
                }}
              >
                {loading ? (
                  <span className="w-4 h-4 rounded-full border-2 border-black/30 border-t-black animate-spin" />
                ) : (
                  <Music2 size={14} />
                )}
                {loading ? "Starting…" : "Start Jam"}
              </button>
              <button
                onClick={handleClose}
                className="px-4 py-2.5 rounded-xl text-sm transition-all"
                style={{
                  color: "#606060",
                  border: "1px solid rgba(255,255,255,0.08)",
                }}
              >
                Cancel
              </button>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
