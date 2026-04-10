import "server-only";

import nodemailer from "nodemailer";
import { getHubSettings } from "@/lib/hub-settings";

export type HubEmailConfig = {
  smtpHost: string | null;
  smtpPort: number | null;
  smtpUser: string | null;
  smtpPass: string | null;
  smtpFrom: string | null;
};

export function isHubEmailConfigured(config: HubEmailConfig) {
  return Boolean(
    config.smtpHost
    && config.smtpPort
    && config.smtpUser
    && config.smtpPass
    && config.smtpFrom
  );
}

export async function getHubEmailConfig() {
  const settings = await getHubSettings();

  return {
    smtpHost: settings?.smtpHost ?? null,
    smtpPort: settings?.smtpPort ?? null,
    smtpUser: settings?.smtpUser ?? null,
    smtpPass: settings?.smtpPass ?? null,
    smtpFrom: settings?.smtpFrom ?? null,
  };
}

function sanitizeMailboxValue(value: string) {
  return value.trim().replaceAll('\\"', '"');
}

function parseAddress(value: string) {
  const sanitized = sanitizeMailboxValue(value);
  const namedMatch = sanitized.match(/^\s*"?(.*?)"?\s*<\s*([^<>@\s]+@[^<>@\s]+)\s*>\s*$/);

  if (namedMatch) {
    const [, name, address] = namedMatch;
    return {
      name: name.trim(),
      address: address.trim(),
    };
  }

  return {
    name: "",
    address: sanitized,
  };
}

export async function sendHubEmail(args: {
  to: string;
  subject: string;
  html: string;
  text: string;
}) {
  const config = await getHubEmailConfig();

  if (!isHubEmailConfigured(config)) {
    throw new Error("Hub email is not configured yet.");
  }

  const fromAddress = parseAddress(config.smtpFrom!);
  const replyToAddress = parseAddress(config.smtpUser!);
  const recipientAddress = parseAddress(args.to);

  const transporter = nodemailer.createTransport({
    host: config.smtpHost!,
    port: config.smtpPort!,
    secure: config.smtpPort === 465,
    auth: {
      user: config.smtpUser!,
      pass: config.smtpPass!,
    },
  });

  await transporter.sendMail({
    from: fromAddress,
    replyTo: replyToAddress,
    to: recipientAddress,
    envelope: {
      from: replyToAddress.address,
      to: [recipientAddress.address],
    },
    subject: args.subject,
    html: args.html,
    text: args.text,
  });
}
