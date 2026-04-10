import { GeneralSettingsClient } from "@/components/settings/GeneralSettingsClient";
import { getHubSettings } from "@/lib/hub-settings";

export default async function GeneralSettingsPage() {
  const settings = await getHubSettings();

  return (
    <GeneralSettingsClient
      initialWeatherLocationMode={settings?.weatherLocationMode ?? "hub"}
      initialLocationName={settings?.locationName ?? null}
      initialSmtpHost={settings?.smtpHost ?? ""}
      initialSmtpPort={settings?.smtpPort ? String(settings.smtpPort) : ""}
      initialSmtpUser={settings?.smtpUser ?? ""}
      initialSmtpPass={settings?.smtpPass ?? ""}
      initialSmtpFrom={settings?.smtpFrom ?? ""}
      initialAgentExecutionEmailEnabled={settings?.agentExecutionEmailEnabled ?? true}
    />
  );
}
