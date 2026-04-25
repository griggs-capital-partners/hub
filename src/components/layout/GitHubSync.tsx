"use client";

import { useEffect, useRef } from "react";

const SYNC_INTERVAL_MS = 5 * 60 * 1000; // 5 minutes
const STORAGE_KEY = "last-github-sync";
const UNAVAILABLE_MESSAGE = "GitHub sync is unavailable right now.";

function normalizeSyncErrorMessage(value: string) {
  const normalized = value.replace(/\s+/g, " ").trim();

  if (!normalized) {
    return null;
  }

  if (normalized.startsWith("<")) {
    return UNAVAILABLE_MESSAGE;
  }

  return normalized.length > 180 ? `${normalized.slice(0, 177)}...` : normalized;
}

async function parseSyncResponse(response: Response) {
  const bodyText = await response.text().catch(() => "");
  const contentType = response.headers.get("content-type") ?? "";

  if (contentType.toLowerCase().includes("application/json")) {
    try {
      const data = JSON.parse(bodyText);
      if (data && typeof data === "object") {
        return data as Record<string, unknown>;
      }
    } catch {
      return { error: UNAVAILABLE_MESSAGE } as Record<string, unknown>;
    }
  }

  const fallbackMessage = normalizeSyncErrorMessage(bodyText);
  return fallbackMessage ? { error: fallbackMessage } as Record<string, unknown> : ({} as Record<string, unknown>);
}

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
          const res = await fetch("/api/github/repos", {
            headers: { Accept: "application/json" },
            cache: "no-store",
          });
          const data = await parseSyncResponse(res);
          const disabled =
            data.disabled === true ||
            (typeof data.reason === "string" && data.reason.trim().length > 0);

          if (res.ok && !disabled) {
            localStorage.setItem(STORAGE_KEY, now.toString());
            console.log("[GitHubSync] Repositories refreshed successfully");

            // After repos are refreshed, sync GitHub activity into the feed
            console.log("[GitHubSync] Syncing activity events...");
            fetch("/api/github/activity-sync", { method: "POST" })
              .then((r) => {
                if (r.ok) console.log("[GitHubSync] Activity sync complete");
                else {
                  r.text().then((text) =>
                    console.warn(
                      "[GitHubSync] Activity sync failed",
                      normalizeSyncErrorMessage(text) ?? `Request failed with status ${r.status}`
                    )
                  );
                }
              })
              .catch((err) => console.error("[GitHubSync] Activity sync error", err));
          } else if (disabled) {
            localStorage.setItem(STORAGE_KEY, now.toString());
            console.info(
              "[GitHubSync] Refresh skipped",
              typeof data.reason === "string" && data.reason.trim().length > 0
                ? data.reason
                : "GitHub sync is disabled for this workspace."
            );
          } else {
            console.warn(
              "[GitHubSync] Refresh failed",
              typeof data.error === "string" && data.error.trim().length > 0
                ? data.error
                : `Request failed with status ${res.status}`
            );
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
