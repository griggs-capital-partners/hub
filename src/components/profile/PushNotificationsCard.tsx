"use client";

import { useCallback, useEffect, useState } from "react";
import { Bell, Check, Laptop, Loader2, Send, Trash2, Workflow } from "lucide-react";
import { Card, CardBody, CardHeader } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import type { NotificationPreferences } from "@/lib/notifications";

type StoredSubscription = {
  id: string;
  endpoint: string;
  deviceLabel: string | null;
  userAgent: string | null;
  lastSeenAt: string | null;
  createdAt: string;
  updatedAt: string;
};

type NotificationState = {
  configured: boolean;
  publicKey: string | null;
  settings: NotificationPreferences;
  subscriptions: StoredSubscription[];
};

const DEFAULT_STATE: NotificationState = {
  configured: false,
  publicKey: null,
  settings: {
    taskAssignedPush: true,
    agentExecutionPush: false,
  },
  subscriptions: [],
};

function urlBase64ToUint8Array(base64String: string) {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const rawData = window.atob(base64);
  return Uint8Array.from(rawData, (char) => char.charCodeAt(0));
}

function formatSubscriptionLabel(subscription: StoredSubscription) {
  if (subscription.deviceLabel) return subscription.deviceLabel;

  if (subscription.userAgent?.includes("Chrome")) return "Chrome browser";
  if (subscription.userAgent?.includes("Firefox")) return "Firefox browser";
  if (subscription.userAgent?.includes("Safari")) return "Safari browser";

  return `Browser ending ${subscription.endpoint.slice(-12)}`;
}

function formatTimestamp(value: string | null) {
  if (!value) return "Never";
  return new Date(value).toLocaleString();
}

export function PushNotificationsCard() {
  const [state, setState] = useState<NotificationState>(DEFAULT_STATE);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [permission, setPermission] = useState<string>("default");
  const [currentEndpoint, setCurrentEndpoint] = useState<string | null>(null);
  const [requiresHomeScreenInstall, setRequiresHomeScreenInstall] = useState(false);
  const [isSupported, setIsSupported] = useState(false);

  const fetchState = useCallback(async () => {
    const res = await fetch("/api/notifications/push-subscriptions");
    const data = await res.json();
    if (!res.ok) throw new Error(data.error ?? "Failed to load notifications");
    setState(data);
    return data as NotificationState;
  }, []);

  const syncCurrentBrowser = useCallback(async (publicKey?: string | null) => {
    if (!isSupported || !publicKey) return;

    const registration = await navigator.serviceWorker.register("/push-sw.js");
    const subscription = await registration.pushManager.getSubscription();
    setCurrentEndpoint(subscription?.endpoint ?? null);
  }, [isSupported]);

  useEffect(() => {
    if (typeof window === "undefined") return;

    const hasBrowserPushApis =
      "serviceWorker" in navigator
      && "PushManager" in window
      && "Notification" in window;

    const isAppleMobile =
      /iPad|iPhone|iPod/.test(window.navigator.userAgent)
      || (window.navigator.platform === "MacIntel" && window.navigator.maxTouchPoints > 1);

    const standaloneFlag = "standalone" in window.navigator
      ? (window.navigator as Navigator & { standalone?: boolean }).standalone === true
      : false;

    const standaloneMedia = typeof window.matchMedia === "function"
      ? window.matchMedia("(display-mode: standalone)").matches
      : false;

    const needsHomeScreenInstall = isAppleMobile && !(standaloneFlag || standaloneMedia);
    const pushSupported = hasBrowserPushApis && !needsHomeScreenInstall;

    setRequiresHomeScreenInstall(needsHomeScreenInstall);
    setIsSupported(pushSupported);
    setPermission("Notification" in window ? Notification.permission : "default");

    if (!pushSupported) {
      setLoading(false);
      return;
    }

    let active = true;

    (async () => {
      try {
        const data = await fetchState();
        if (!active) return;
        await syncCurrentBrowser(data.publicKey);
      } catch (err) {
        if (!active) return;
        setError(err instanceof Error ? err.message : "Failed to load notification settings");
      } finally {
        if (active) setLoading(false);
      }
    })();

    return () => {
      active = false;
    };
  }, [fetchState, isSupported, syncCurrentBrowser]);

  async function refresh(message?: string) {
    const data = await fetchState();
    await syncCurrentBrowser(data.publicKey);
    setPermission(Notification.permission);
    if (message) {
      setSuccess(message);
      window.setTimeout(() => setSuccess(null), 3000);
    }
  }

  async function enableForThisBrowser() {
    if (!isSupported || !state.publicKey) return;

    setBusy(true);
    setError(null);

    try {
      const permissionResult = await Notification.requestPermission();
      setPermission(permissionResult);
      if (permissionResult !== "granted") {
        throw new Error("Browser notification permission was not granted.");
      }

      const registration = await navigator.serviceWorker.register("/push-sw.js");
      let subscription = await registration.pushManager.getSubscription();

      if (!subscription) {
        subscription = await registration.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: urlBase64ToUint8Array(state.publicKey),
        });
      }

      const saveRes = await fetch("/api/notifications/push-subscriptions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          subscription: subscription.toJSON(),
          deviceLabel: window.navigator.platform ? `${window.navigator.platform} browser` : null,
        }),
      });

      const data = await saveRes.json();
      if (!saveRes.ok) throw new Error(data.error ?? "Failed to save subscription");

      await refresh("Push notifications are enabled for this browser.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to enable notifications");
    } finally {
      setBusy(false);
    }
  }

  async function removeSubscription(subscriptionId: string) {
    setBusy(true);
    setError(null);

    try {
      const target = state.subscriptions.find((subscription) => subscription.id === subscriptionId);

      if (target?.endpoint && target.endpoint === currentEndpoint && isSupported) {
        const registration = await navigator.serviceWorker.register("/push-sw.js");
        const browserSubscription = await registration.pushManager.getSubscription();
        await browserSubscription?.unsubscribe();
      }

      const res = await fetch(`/api/notifications/push-subscriptions/${subscriptionId}`, {
        method: "DELETE",
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error ?? "Failed to remove subscription");
      }

      await refresh("Subscription removed.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to remove subscription");
    } finally {
      setBusy(false);
    }
  }

  async function togglePreference(key: keyof NotificationPreferences, value: boolean) {
    setBusy(true);
    setError(null);

    try {
      const res = await fetch("/api/notifications/preferences", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ [key]: value }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Failed to update preferences");

      setState((current) => ({
        ...current,
        settings: data.settings,
      }));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to update preferences");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card>
      <CardHeader className="border-b border-[rgba(255,255,255,0.06)] px-6 py-4">
        <div className="flex items-center gap-2">
          <Bell size={15} className="text-[#F7941D]" />
          <span className="text-sm font-bold text-[#F0F0F0]">Web Push Notifications</span>
        </div>
      </CardHeader>
      <CardBody className="p-6 space-y-6">
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div>
            <p className="text-sm text-[#F0F0F0]">Manage browser subscriptions for task assignments and agent execution results.</p>
            <p className="text-xs text-[#606060] mt-1">
              Service worker delivery is browser-based, so each device or browser keeps its own subscription.
            </p>
          </div>
          <Button
            variant="primary"
            onClick={enableForThisBrowser}
            disabled={busy || loading || !isSupported || !state.configured}
          >
            {busy ? <Loader2 size={16} className="animate-spin" /> : currentEndpoint ? <Check size={16} /> : <Send size={16} />}
            {currentEndpoint ? "Refresh This Browser" : "Enable On This Browser"}
          </Button>
        </div>

        {!isSupported && (
          <div className="rounded-xl border border-[rgba(239,68,68,0.25)] bg-[rgba(239,68,68,0.08)] px-4 py-3 text-sm text-[#FCA5A5]">
            {requiresHomeScreenInstall
              ? "On iPhone and iPad, web push only works after Griggs Hub is added to the Home Screen and opened as an installed web app."
              : "This browser does not support service workers or the Push API."}
          </div>
        )}

        {requiresHomeScreenInstall && (
          <div className="rounded-xl border border-[rgba(251,186,0,0.25)] bg-[rgba(251,186,0,0.08)] px-4 py-3 text-sm text-[#FCD34D]">
            Open this site in Safari, tap Share, choose Add to Home Screen, then launch Griggs Hub from the Home Screen before enabling push notifications.
          </div>
        )}

        {isSupported && !state.configured && !loading && (
          <div className="rounded-xl border border-[rgba(251,186,0,0.25)] bg-[rgba(251,186,0,0.08)] px-4 py-3 text-sm text-[#FCD34D]">
            VAPID keys are not configured yet. Add the push env vars in Amplify before enabling browser subscriptions.
          </div>
        )}

        {permission === "denied" && (
          <div className="rounded-xl border border-[rgba(239,68,68,0.25)] bg-[rgba(239,68,68,0.08)] px-4 py-3 text-sm text-[#FCA5A5]">
            Browser permission is blocked for this site. Re-enable notifications in your browser settings, then try again.
          </div>
        )}

        {error && (
          <div className="rounded-xl border border-[rgba(239,68,68,0.25)] bg-[rgba(239,68,68,0.08)] px-4 py-3 text-sm text-[#FCA5A5]">
            {error}
          </div>
        )}

        {success && (
          <div className="rounded-xl border border-[rgba(34,197,94,0.25)] bg-[rgba(34,197,94,0.08)] px-4 py-3 text-sm text-[#86EFAC]">
            {success}
          </div>
        )}

        <div className="grid gap-3">
          <button
            type="button"
            onClick={() => togglePreference("taskAssignedPush", !state.settings.taskAssignedPush)}
            disabled={busy || loading}
            className="flex items-center justify-between rounded-xl border border-[rgba(255,255,255,0.06)] bg-[#151515] px-4 py-3 text-left transition-colors hover:border-[rgba(247,148,29,0.28)]"
          >
            <div className="flex items-start gap-3">
              <div className="mt-0.5 rounded-lg bg-[rgba(247,148,29,0.1)] p-2 text-[#F7941D]">
                <Bell size={14} />
              </div>
              <div>
                <div className="text-sm font-semibold text-[#F0F0F0]">When I&apos;m assigned a task</div>
                <div className="text-xs text-[#606060] mt-1">Send a push when a sprint task is created for you or reassigned to you.</div>
              </div>
            </div>
            <div className={`rounded-full px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.18em] ${state.settings.taskAssignedPush ? "bg-[rgba(34,197,94,0.12)] text-[#86EFAC]" : "bg-[rgba(255,255,255,0.05)] text-[#707070]"}`}>
              {state.settings.taskAssignedPush ? "On" : "Off"}
            </div>
          </button>

          <button
            type="button"
            onClick={() => togglePreference("agentExecutionPush", !state.settings.agentExecutionPush)}
            disabled={busy || loading}
            className="flex items-center justify-between rounded-xl border border-[rgba(255,255,255,0.06)] bg-[#151515] px-4 py-3 text-left transition-colors hover:border-[rgba(247,148,29,0.28)]"
          >
            <div className="flex items-start gap-3">
              <div className="mt-0.5 rounded-lg bg-[rgba(247,148,29,0.1)] p-2 text-[#F7941D]">
                <Workflow size={14} />
              </div>
              <div>
                <div className="text-sm font-semibold text-[#F0F0F0]">When an AI agent run completes or fails</div>
                <div className="text-xs text-[#606060] mt-1">Notify the person who launched the execution when it reaches a terminal status.</div>
              </div>
            </div>
            <div className={`rounded-full px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.18em] ${state.settings.agentExecutionPush ? "bg-[rgba(34,197,94,0.12)] text-[#86EFAC]" : "bg-[rgba(255,255,255,0.05)] text-[#707070]"}`}>
              {state.settings.agentExecutionPush ? "On" : "Off"}
            </div>
          </button>
        </div>

        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-semibold text-[#F0F0F0]">Registered Browsers</p>
              <p className="text-xs text-[#606060] mt-1">Remove stale subscriptions if a browser stops receiving pushes.</p>
            </div>
            <div className="rounded-full bg-[rgba(255,255,255,0.05)] px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.18em] text-[#909090]">
              {state.subscriptions.length} active
            </div>
          </div>

          <div className="space-y-2">
            {loading ? (
              <div className="rounded-xl border border-[rgba(255,255,255,0.06)] bg-[#151515] px-4 py-5 text-sm text-[#707070]">
                Loading subscriptions...
              </div>
            ) : state.subscriptions.length === 0 ? (
              <div className="rounded-xl border border-dashed border-[rgba(255,255,255,0.08)] bg-[#151515] px-4 py-5 text-sm text-[#707070]">
                No browser subscriptions yet. Enable notifications on this browser to create the first one.
              </div>
            ) : (
              state.subscriptions.map((subscription) => {
                const isCurrentBrowser = subscription.endpoint === currentEndpoint;

                return (
                  <div
                    key={subscription.id}
                    className="flex flex-col gap-3 rounded-xl border border-[rgba(255,255,255,0.06)] bg-[#151515] px-4 py-3 md:flex-row md:items-center md:justify-between"
                  >
                    <div className="flex items-start gap-3">
                      <div className="rounded-lg bg-[rgba(255,255,255,0.05)] p-2 text-[#A3A3A3]">
                        <Laptop size={14} />
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <p className="text-sm font-medium text-[#F0F0F0]">{formatSubscriptionLabel(subscription)}</p>
                          {isCurrentBrowser && (
                            <span className="rounded-full bg-[rgba(247,148,29,0.12)] px-2 py-0.5 text-[10px] font-bold uppercase tracking-[0.18em] text-[#F7941D]">
                              This browser
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-[#606060] mt-1">Last confirmed delivery: {formatTimestamp(subscription.lastSeenAt)}</p>
                        <p className="text-[11px] text-[#505050] mt-1">Added {formatTimestamp(subscription.createdAt)}</p>
                      </div>
                    </div>

                    <Button
                      variant="secondary"
                      size="sm"
                      onClick={() => removeSubscription(subscription.id)}
                      disabled={busy}
                    >
                      {busy ? <Loader2 size={14} className="animate-spin" /> : <Trash2 size={14} />}
                      Remove
                    </Button>
                  </div>
                );
              })
            )}
          </div>
        </div>
      </CardBody>
    </Card>
  );
}
