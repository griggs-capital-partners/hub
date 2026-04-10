"use client";

import { useEffect, useRef } from "react";

const SYNC_INTERVAL_MS = 5 * 60 * 1000; // 5 minutes
const STORAGE_KEY = "last-github-sync";

export function GitHubSync() {
  const syncInProgress = useRef(false);

  useEffect(() => {
    async function checkSync() {
      if (syncInProgress.current) return;

      const lastSyncStr = localStorage.getItem(STORAGE_KEY);
      const lastSync = lastSyncStr ? parseInt(lastSyncStr, 10) : 0;
      const now = Date.now();

      if (now - lastSync > SYNC_INTERVAL_MS) {
        try {
          syncInProgress.current = true;
          console.log("[GitHubSync] Refreshing repositories...");
          const res = await fetch("/api/github/repos");
          if (res.ok) {
            localStorage.setItem(STORAGE_KEY, now.toString());
            console.log("[GitHubSync] Repositories refreshed successfully");

            // After repos are refreshed, sync GitHub activity into the feed
            console.log("[GitHubSync] Syncing activity events...");
            fetch("/api/github/activity-sync", { method: "POST" })
              .then((r) => {
                if (r.ok) console.log("[GitHubSync] Activity sync complete");
                else r.text().then((t) => console.error("[GitHubSync] Activity sync failed", t));
              })
              .catch((err) => console.error("[GitHubSync] Activity sync error", err));
          } else {
            console.error("[GitHubSync] Refresh failed", await res.text());
          }
        } catch (err) {
          console.error("[GitHubSync] Error during sync", err);
        } finally {
          syncInProgress.current = false;
        }
      }
    }

    // Run on mount
    checkSync();
  }, []);

  return null; // This component doesn't render anything
}
