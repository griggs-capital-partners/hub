"use client";

import { useState } from "react";
import { BellRing, LocateFixed, Mail, MapPin, Send, Server, Settings, Workflow } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";

interface Props {
  initialWeatherLocationMode: "hub" | "user";
  initialLocationName: string | null;
  initialSmtpHost: string;
  initialSmtpPort: string;
  initialSmtpUser: string;
  initialSmtpPass: string;
  initialSmtpFrom: string;
  initialAgentExecutionEmailEnabled: boolean;
}



export function GeneralSettingsClient({
  initialWeatherLocationMode,
  initialLocationName,
  initialSmtpHost,
  initialSmtpPort,
  initialSmtpUser,
  initialSmtpPass,
  initialSmtpFrom,
  initialAgentExecutionEmailEnabled,
}: Props) {
  const [weatherLocationMode, setWeatherLocationMode] = useState<"hub" | "user">(initialWeatherLocationMode);
  const [savedWeatherLocationMode, setSavedWeatherLocationMode] = useState<"hub" | "user">(initialWeatherLocationMode);
  const [locationName, setLocationName] = useState(initialLocationName ?? "");
  const [savedLocationName, setSavedLocationName] = useState(initialLocationName ?? "");
  const [saving, setSaving] = useState(false);
  const [locating, setLocating] = useState(false);
  const [smtpHost, setSmtpHost] = useState(initialSmtpHost);
  const [smtpPort, setSmtpPort] = useState(initialSmtpPort);
  const [smtpUser, setSmtpUser] = useState(initialSmtpUser);
  const [smtpPass, setSmtpPass] = useState(initialSmtpPass);
  const [smtpFrom, setSmtpFrom] = useState(initialSmtpFrom);
  const [savedSmtpHost, setSavedSmtpHost] = useState(initialSmtpHost);
  const [savedSmtpPort, setSavedSmtpPort] = useState(initialSmtpPort);
  const [savedSmtpUser, setSavedSmtpUser] = useState(initialSmtpUser);
  const [savedSmtpPass, setSavedSmtpPass] = useState(initialSmtpPass);
  const [savedSmtpFrom, setSavedSmtpFrom] = useState(initialSmtpFrom);
  const [agentExecutionEmailEnabled, setAgentExecutionEmailEnabled] = useState(initialAgentExecutionEmailEnabled);
  const [savedAgentExecutionEmailEnabled, setSavedAgentExecutionEmailEnabled] = useState(initialAgentExecutionEmailEnabled);
  const [testEmailTo, setTestEmailTo] = useState(initialSmtpUser);
  const [sendingTestEmail, setSendingTestEmail] = useState(false);
  const [message, setMessage] = useState<{ text: string; ok: boolean } | null>(null);
  const [smtpMessage, setSmtpMessage] = useState<{ text: string; ok: boolean } | null>(null);

  async function saveSettings(payload?: {
    weatherLocationMode?: "hub" | "user";
    locationName?: string;
    latitude?: number;
    longitude?: number;
    smtpHost?: string;
    smtpPort?: string;
    smtpUser?: string;
    smtpPass?: string;
    smtpFrom?: string;
    agentExecutionEmailEnabled?: boolean;
  }) {
    const weatherLocationModeToSave = payload?.weatherLocationMode ?? weatherLocationMode;
    const locationToSave = (payload?.locationName ?? locationName).trim();
    const smtpHostToSave = (payload?.smtpHost ?? smtpHost).trim();
    const smtpPortToSave = (payload?.smtpPort ?? smtpPort).trim();
    const smtpUserToSave = (payload?.smtpUser ?? smtpUser).trim();
    const smtpPassToSave = payload?.smtpPass ?? smtpPass;
    const smtpFromToSave = (payload?.smtpFrom ?? smtpFrom).trim();
    const agentExecutionEmailEnabledToSave = payload?.agentExecutionEmailEnabled ?? agentExecutionEmailEnabled;
    const locationChanged =
      payload?.weatherLocationMode !== undefined
      || payload?.locationName !== undefined
      || payload?.latitude !== undefined
      || payload?.longitude !== undefined;
    const smtpChanged = ["smtpHost", "smtpPort", "smtpUser", "smtpPass", "smtpFrom", "agentExecutionEmailEnabled"].some((key) =>
      payload ? Object.prototype.hasOwnProperty.call(payload, key) : false
    ) || smtpDirty;
    setSaving(true);
    setMessage(null);
    setSmtpMessage(null);

    try {
      const res = await fetch("/api/hub-settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          weatherLocationMode: weatherLocationModeToSave,
          locationName: locationToSave,
          latitude: payload?.latitude,
          longitude: payload?.longitude,
          smtpHost: smtpHostToSave,
          smtpPort: smtpPortToSave,
          smtpUser: smtpUserToSave,
          smtpPass: smtpPassToSave,
          smtpFrom: smtpFromToSave,
          agentExecutionEmailEnabled: agentExecutionEmailEnabledToSave,
        }),
      });

      const data = (await res.json()) as {
        error?: string;
        settings?: {
          weatherLocationMode: "hub" | "user";
          locationName: string | null;
          smtpHost: string | null;
          smtpPort: number | null;
          smtpUser: string | null;
          smtpPass: string | null;
          smtpFrom: string | null;
          agentExecutionEmailEnabled: boolean;
        };
      };

      if (!res.ok) {
        const nextError = data.error ?? "Could not save hub settings";
        setMessage({ text: nextError, ok: false });
        setSmtpMessage({ text: nextError, ok: false });
        return;
      }

      const nextName = data.settings?.locationName ?? "";
      const nextWeatherLocationMode = data.settings?.weatherLocationMode ?? "hub";
      const nextSmtpHost = data.settings?.smtpHost ?? "";
      const nextSmtpPort = data.settings?.smtpPort ? String(data.settings.smtpPort) : "";
      const nextSmtpUser = data.settings?.smtpUser ?? "";
      const nextSmtpPass = data.settings?.smtpPass ?? "";
      const nextSmtpFrom = data.settings?.smtpFrom ?? "";
      const nextAgentExecutionEmailEnabled = data.settings?.agentExecutionEmailEnabled ?? true;
      setWeatherLocationMode(nextWeatherLocationMode);
      setSavedWeatherLocationMode(nextWeatherLocationMode);
      setLocationName(nextName);
      setSavedLocationName(nextName);
      setSmtpHost(nextSmtpHost);
      setSmtpPort(nextSmtpPort);
      setSmtpUser(nextSmtpUser);
      setSmtpPass(nextSmtpPass);
      setSmtpFrom(nextSmtpFrom);
      setAgentExecutionEmailEnabled(nextAgentExecutionEmailEnabled);
      setSavedSmtpHost(nextSmtpHost);
      setSavedSmtpPort(nextSmtpPort);
      setSavedSmtpUser(nextSmtpUser);
      setSavedSmtpPass(nextSmtpPass);
      setSavedSmtpFrom(nextSmtpFrom);
      setSavedAgentExecutionEmailEnabled(nextAgentExecutionEmailEnabled);
      if (locationChanged) {
        setMessage({
          text:
            nextWeatherLocationMode === "user"
              ? "Weather will use each signed-in user's current location."
              : nextName
                ? `Weather location set to ${nextName}`
                : "Hub location cleared",
          ok: true,
        });
      }
      if (smtpChanged) {
        setSmtpMessage({ text: "SMTP settings saved. Griggs Hub email is ready to send.", ok: true });
      }
    } catch {
      if (locationChanged) {
        setMessage({ text: "Could not save hub settings", ok: false });
      }
      if (smtpChanged) {
        setSmtpMessage({ text: "Could not save hub settings", ok: false });
      }
    } finally {
      setSaving(false);
    }
  }

  async function handleCurrentLocation() {
    if (!navigator.geolocation) {
      setMessage({ text: "Your browser does not support location access.", ok: false });
      return;
    }

    setLocating(true);
    setMessage(null);

    navigator.geolocation.getCurrentPosition(
      async (position) => {
        try {
          await saveSettings({
            locationName: locationName.trim(),
            latitude: position.coords.latitude,
            longitude: position.coords.longitude,
          });
        } finally {
          setLocating(false);
        }
      },
      () => {
        setLocating(false);
        setMessage({ text: "We couldn't access your location. Check browser permissions and try again.", ok: false });
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 300000 }
    );
  }

  async function handleSendTestEmail() {
    const recipient = testEmailTo.trim();
    if (!recipient) {
      setSmtpMessage({ text: "Enter a recipient email address for the test send.", ok: false });
      return;
    }

    setSendingTestEmail(true);
    setSmtpMessage(null);

    try {
      const res = await fetch("/api/hub-settings/test-email", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ to: recipient }),
      });
      const data = (await res.json()) as { error?: string; message?: string };

      if (!res.ok) {
        setSmtpMessage({ text: data.error ?? "Could not send test email", ok: false });
        return;
      }

      setSmtpMessage({ text: data.message ?? "Test email sent", ok: true });
    } catch {
      setSmtpMessage({ text: "Could not send test email", ok: false });
    } finally {
      setSendingTestEmail(false);
    }
  }

  const smtpDirty = [
    smtpHost !== savedSmtpHost,
    smtpPort !== savedSmtpPort,
    smtpUser !== savedSmtpUser,
    smtpPass !== savedSmtpPass,
    smtpFrom !== savedSmtpFrom,
    agentExecutionEmailEnabled !== savedAgentExecutionEmailEnabled,
  ].some(Boolean);

  const smtpConfigured = [savedSmtpHost, savedSmtpPort, savedSmtpUser, savedSmtpPass, savedSmtpFrom].every(
    (value) => value.trim().length > 0
  );
  const locationDirty = weatherLocationMode !== savedWeatherLocationMode || locationName.trim() !== savedLocationName.trim();

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-bold text-[#F0F0F0] flex items-center gap-2.5">
          <Settings size={17} className="text-[#F7941D]" />
          General
        </h2>
        <p className="text-sm text-[#505050] mt-1">
          Basic workspace settings and dashboard preferences.
        </p>
      </div>

      <div className="rounded-2xl border border-[rgba(247,148,29,0.14)] bg-gradient-to-br from-[#181818] via-[#141414] to-[#111111] p-5 sm:p-6">
        <div className="flex items-start gap-3">
          <div className="mt-0.5 flex h-10 w-10 items-center justify-center rounded-2xl bg-[rgba(247,148,29,0.12)] border border-[rgba(247,148,29,0.18)]">
            <MapPin size={18} className="text-[#F7941D]" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-[#F0F0F0]">Hub Location</p>
            <p className="text-sm text-[#707070] mt-1 max-w-2xl">
              This drives the weather forecast shown in the dashboard hero. Use a city and state for the cleanest result.
            </p>
          </div>
        </div>

        <div className="mt-5 grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_auto] gap-3 items-end">
          <div className="lg:col-span-2 grid gap-2 sm:grid-cols-2">
            <button
              type="button"
              onClick={() => setWeatherLocationMode("hub")}
              disabled={saving || locating}
              className={`rounded-2xl border px-4 py-3 text-left transition-colors ${weatherLocationMode === "hub"
                  ? "border-[rgba(247,148,29,0.35)] bg-[rgba(247,148,29,0.08)]"
                  : "border-[rgba(255,255,255,0.06)] bg-[rgba(255,255,255,0.03)] hover:border-[rgba(247,148,29,0.22)]"
                }`}
            >
              <div className="text-sm font-semibold text-[#F0F0F0]">Set a location</div>
              <div className="mt-1 text-xs leading-5 text-[#808080]">
                Everyone sees the same saved hub weather location.
              </div>
            </button>
            <button
              type="button"
              onClick={() => setWeatherLocationMode("user")}
              disabled={saving || locating}
              className={`rounded-2xl border px-4 py-3 text-left transition-colors ${weatherLocationMode === "user"
                  ? "border-[rgba(247,148,29,0.35)] bg-[rgba(247,148,29,0.08)]"
                  : "border-[rgba(255,255,255,0.06)] bg-[rgba(255,255,255,0.03)] hover:border-[rgba(247,148,29,0.22)]"
                }`}
            >
              <div className="text-sm font-semibold text-[#F0F0F0]">Use each user&apos;s location</div>
              <div className="mt-1 text-xs leading-5 text-[#808080]">
                The dashboard weather follows the signed-in user wherever they are.
              </div>
            </button>
          </div>
          <Input
            label="Location"
            placeholder="Indianapolis, Indiana"
            value={locationName}
            onChange={(event) => setLocationName(event.target.value)}
            icon={<MapPin size={14} />}
            disabled={weatherLocationMode === "user"}
          />
          <div className="flex gap-2">
            <Button
              variant="outline"
              type="button"
              disabled={saving || locating || weatherLocationMode === "user"}
              loading={locating}
              icon={!locating ? <LocateFixed size={14} /> : undefined}
              onClick={() => void handleCurrentLocation()}
            >
              Use my location
            </Button>
            <Button
              variant="secondary"
              type="button"
              disabled={saving || locating || weatherLocationMode === "user" || (!locationName.trim() && !savedLocationName)}
              onClick={() => {
                setLocationName("");
                void saveSettings({ locationName: "" });
              }}
            >
              Clear
            </Button>
            <Button
              type="button"
              loading={saving}
              disabled={saving || locating || !locationDirty}
              onClick={() => void saveSettings(
                weatherLocationMode === "user"
                  ? { weatherLocationMode }
                  : { weatherLocationMode, locationName }
              )}
            >
              Save weather settings
            </Button>
          </div>
        </div>

        <div className="mt-3 flex flex-wrap items-center gap-3 text-xs">
          <span className="rounded-full border border-[rgba(255,255,255,0.06)] bg-[rgba(255,255,255,0.03)] px-2.5 py-1 text-[#909090]">
            Mode: {savedWeatherLocationMode === "user" ? "User location" : "Saved hub location"}
          </span>
          <span className="rounded-full border border-[rgba(255,255,255,0.06)] bg-[rgba(255,255,255,0.03)] px-2.5 py-1 text-[#909090]">
            Current: {savedWeatherLocationMode === "user" ? "Each signed-in user" : savedLocationName || "Not set"}
          </span>
          {message && (
            <span className={message.ok ? "text-emerald-400" : "text-red-400"}>
              {message.text}
            </span>
          )}
        </div>
      </div>

      <div className="rounded-2xl border border-[rgba(247,148,29,0.14)] bg-gradient-to-br from-[#17130D] via-[#14110C] to-[#0F0D09] p-4 sm:p-5">
        <div className="flex items-start gap-3">
          <div className="mt-0.5 flex h-9 w-9 items-center justify-center rounded-xl border border-[rgba(247,148,29,0.18)] bg-[rgba(247,148,29,0.12)]">
            <Mail size={16} className="text-[#F7941D]" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-[#F0F0F0]">Hub Email (SMTP)</p>
            <p className="mt-1 max-w-2xl text-xs leading-5 text-[#8B8172]">
              Connect Griggs Hub to your outbound mail server for branded team emails and agent run notifications.
            </p>
          </div>
          <div className="rounded-full border border-[rgba(255,255,255,0.08)] bg-[rgba(255,255,255,0.04)] px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.18em] text-[#D7B58C]">
            Brand email
          </div>
        </div>

        <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-3">
          <Input
            label="SMTP Host"
            placeholder="smtp.office365.com"
            value={smtpHost}
            onChange={(event) => setSmtpHost(event.target.value)}
            icon={<Server size={14} />}
          />
          <Input
            label="SMTP Port"
            placeholder="587"
            inputMode="numeric"
            value={smtpPort}
            onChange={(event) => setSmtpPort(event.target.value)}
            icon={<Send size={14} />}
          />
          <Input
            label="SMTP User"
            placeholder="information@summitsmartfarms.com"
            value={smtpUser}
            onChange={(event) => setSmtpUser(event.target.value)}
            icon={<Mail size={14} />}
          />
          <Input
            label="From"
            placeholder={'"Griggs Capital Partners" <information@summitsmartfarms.com>'}
            value={smtpFrom}
            onChange={(event) => setSmtpFrom(event.target.value)}
            icon={<Mail size={14} />}
            className="md:col-span-2"
          />
          <div>
            <Input
              label="SMTP Password"
              type="password"
              placeholder="App password or mailbox password"
              value={smtpPass}
              onChange={(event) => setSmtpPass(event.target.value)}
              icon={<Mail size={14} />}
            />
          </div>
          <div className="md:col-span-2">
            <Input
              label="Send Test To"
              type="email"
              placeholder="you@company.com"
              value={testEmailTo}
              onChange={(event) => setTestEmailTo(event.target.value)}
              icon={<Mail size={14} />}
            />
          </div>
        </div>

        <div className="mt-4 flex flex-wrap items-center gap-2">
          <Button
            type="button"
            loading={saving}
            disabled={saving || locating || !smtpDirty}
            onClick={() => void saveSettings()}
          >
            Save email settings
          </Button>
          <Button
            type="button"
            variant="outline"
            loading={sendingTestEmail}
            disabled={sendingTestEmail || saving || !smtpConfigured || smtpDirty || !testEmailTo.trim()}
            onClick={() => void handleSendTestEmail()}
          >
            Send test email
          </Button>
        </div>

        <div className="mt-3 flex flex-wrap items-center gap-2 text-xs">
          <span className="rounded-full border border-[rgba(255,255,255,0.06)] bg-[rgba(255,255,255,0.03)] px-2.5 py-1 text-[#B4A28D]">
            Status: {smtpConfigured ? "Configured" : "Not configured"}
          </span>
          {smtpMessage && (
            <span className={smtpMessage.ok ? "text-emerald-400" : "text-red-400"}>
              {smtpMessage.text}
            </span>
          )}
        </div>

        <div className="mt-4 border-t border-[rgba(255,255,255,0.06)] pt-4">
          <div className="mb-3 flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.18em] text-[#B4A28D]">
            <BellRing size={12} />
            Email Notifications
          </div>

          <div className="grid gap-2">
            <button
              type="button"
              onClick={() => void saveSettings({ agentExecutionEmailEnabled: !agentExecutionEmailEnabled })}
              disabled={saving || !smtpConfigured}
              className="flex items-center justify-between gap-3 rounded-xl border border-[rgba(255,255,255,0.06)] bg-[#151515] px-3 py-2.5 text-left transition-colors hover:border-[rgba(247,148,29,0.28)] disabled:opacity-60"
            >
              <div className="flex min-w-0 items-start gap-3">
                <div className="mt-0.5 rounded-lg bg-[rgba(247,148,29,0.1)] p-1.5 text-[#F7941D]">
                  <Workflow size={13} />
                </div>
                <div className="min-w-0">
                  <div className="text-sm font-semibold text-[#F0F0F0]">Agent Execution Completion</div>
                  <div className="mt-0.5 text-xs leading-5 text-[#606060]">
                    Send an email when an AI agent run completes or fails, with execution details and output.
                  </div>
                </div>
              </div>
              <div className={`rounded-full px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.18em] ${agentExecutionEmailEnabled ? "bg-[rgba(34,197,94,0.12)] text-[#86EFAC]" : "bg-[rgba(255,255,255,0.05)] text-[#707070]"}`}>
                {agentExecutionEmailEnabled ? "On" : "Off"}
              </div>
            </button>
          </div>
        </div>
      </div>


      <div className="rounded-xl border border-[rgba(255,255,255,0.06)] bg-[#111111] px-5 py-4">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-xs font-semibold text-[#404040] uppercase tracking-wider mb-2">About</p>
            <p className="text-sm text-[#D0D0D0] font-medium">SmartHub</p>
            <p className="text-xs text-[#505050] mt-0.5">Internal team workspace</p>
          </div>
          <div className="text-right">
            <p className="text-xs text-[#404040]">Version</p>
            <p className="text-xs text-[#606060] font-mono mt-0.5">0.1.0-dev</p>
          </div>
        </div>
      </div>
    </div>
  );
}
