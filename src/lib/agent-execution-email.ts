import "server-only";

import { unified } from "unified";
import remarkParse from "remark-parse";
import remarkGfm from "remark-gfm";
import remarkRehype from "remark-rehype";
import rehypeStringify from "rehype-stringify";

import { getHubSettings } from "@/lib/hub-settings";
import { prisma } from "@/lib/prisma";
import { sendHubEmail } from "@/lib/email";
import { resolveAgentActionLabel } from "@/lib/agent-task-context";

function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function toPlainText(value: string) {
  return value.replace(/\r\n/g, "\n").trim();
}

function formatDate(value: Date) {
  return new Intl.DateTimeFormat("en-US", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(value);
}

async function markdownToEmailHtml(markdown: string): Promise<string> {
  const file = await unified()
    .use(remarkParse)
    .use(remarkGfm)
    .use(remarkRehype)
    .use(rehypeStringify)
    .process(markdown);

  // Inline CSS styles for email-safe HTML
  let html = String(file);

  // Style headings
  html = html.replace(/<h1>/g, '<h1 style="margin:22px 0 10px;font-size:20px;font-weight:700;letter-spacing:-0.02em;color:#F3F3F3;line-height:1.3;">');
  html = html.replace(/<h2>/g, '<h2 style="margin:20px 0 8px;font-size:17px;font-weight:700;letter-spacing:-0.01em;color:#F3F3F3;line-height:1.3;">');
  html = html.replace(/<h3>/g, '<h3 style="margin:16px 0 6px;font-size:15px;font-weight:600;color:#E8E8E8;line-height:1.3;">');
  html = html.replace(/<h4>/g, '<h4 style="margin:14px 0 6px;font-size:14px;font-weight:600;color:#DEDEDE;">');
  html = html.replace(/<h5>/g, '<h5 style="margin:12px 0 4px;font-size:13px;font-weight:600;color:#CECECE;">');
  html = html.replace(/<h6>/g, '<h6 style="margin:10px 0 4px;font-size:12px;font-weight:600;color:#BEBEBE;">');

  // Style paragraphs
  html = html.replace(/<p>/g, '<p style="margin:0 0 14px;font-size:14px;line-height:1.7;color:#D4D4D4;">');

  // Style links
  html = html.replace(/<a /g, '<a style="color:#F7941D;text-decoration:underline;" ');

  // Style code blocks
  html = html.replace(/<pre><code([^>]*)>/g, '<pre style="margin:12px 0;overflow:auto;white-space:pre-wrap;word-break:break-word;border-radius:12px;border:1px solid rgba(255,255,255,0.08);background:#0A0A0B;padding:16px;font:12px/1.6 SFMono-Regular,Menlo,Monaco,Consolas,monospace;color:#A8E6CF;"><code$1 style="background:transparent;padding:0;border-radius:0;font-size:12px;color:#A8E6CF;">');
  html = html.replace(/<\/code><\/pre>/g, '</code></pre>');

  // Style inline code
  html = html.replace(/<code>/g, '<code style="display:inline;background:rgba(255,255,255,0.07);border-radius:5px;padding:2px 6px;font-size:12px;font-family:SFMono-Regular,Menlo,Monaco,Consolas,monospace;color:#FBCB3A;white-space:pre-wrap;word-break:break-word;">');

  // Style blockquotes
  html = html.replace(/<blockquote>/g, '<blockquote style="margin:12px 0;border-left:3px solid rgba(247,148,29,0.5);padding:8px 16px;background:rgba(247,148,29,0.06);border-radius:0 8px 8px 0;">');

  // Style unordered lists
  html = html.replace(/<ul>/g, '<ul style="margin:8px 0 14px;padding-left:20px;color:#D4D4D4;">');
  html = html.replace(/<ol>/g, '<ol style="margin:8px 0 14px;padding-left:20px;color:#D4D4D4;">');
  html = html.replace(/<li>/g, '<li style="margin:0 0 6px;font-size:14px;line-height:1.6;color:#D4D4D4;">');

  // Style strong / em
  html = html.replace(/<strong>/g, '<strong style="font-weight:700;color:#F3F3F3;">');
  html = html.replace(/<em>/g, '<em style="color:#C9C9C9;font-style:italic;">');

  // Style horizontal rules
  html = html.replace(/<hr>/g, '<hr style="border:none;border-top:1px solid rgba(255,255,255,0.1);margin:20px 0;">');

  // Style tables
  html = html.replace(/<table>/g, '<table style="width:100%;border-collapse:collapse;font-size:13px;color:#D4D4D4;margin:12px 0 18px;">');
  html = html.replace(/<thead>/g, '<thead style="background:rgba(255,255,255,0.05);">');
  html = html.replace(/<th>/g, '<th style="padding:8px 12px;text-align:left;font-weight:600;color:#F3F3F3;border-bottom:1px solid rgba(255,255,255,0.12);">');
  html = html.replace(/<td>/g, '<td style="padding:7px 12px;border-bottom:1px solid rgba(255,255,255,0.06);">');

  return html;
}

function buildInfoPill(label: string, value: string, accent = "rgba(247,148,29,0.92)") {
  // Stacked label above pill — works on any screen width
  return `
    <tr>
      <td style="padding:0 0 3px; font-size:10px; letter-spacing:0.12em; text-transform:uppercase; color:#6B6B6B;">${escapeHtml(label)}</td>
    </tr>
    <tr>
      <td style="padding:0 0 16px;">
        <span style="display:inline-block; max-width:100%; border-radius:999px; border:1px solid rgba(255,255,255,0.06); background:${accent}; padding:6px 14px; font-size:13px; font-weight:600; color:#111111; word-break:break-word; white-space:normal;">${escapeHtml(value)}</span>
      </td>
    </tr>
  `;
}

async function buildEmail(args: {
  agentName: string;
  actionLabel: string;
  cardTitle: string;
  status: "completed" | "failed";
  executionId: string;
  requestedBy: string;
  createdAt: Date;
  updatedAt: Date;
  modelUsed: string | null;
  notes: string | null;
  response: string | null;
  errorMessage: string | null;
}) {
  const statusLabel = args.status === "completed" ? "Completed" : "Failed";
  const statusGradient = args.status === "completed"
    ? "linear-gradient(135deg, #F7941D 0%, #FBCB3A 100%)"
    : "linear-gradient(135deg, #DC2626 0%, #F97316 100%)";
  const statusDot = args.status === "completed" ? "#4ADE80" : "#F87171";
  const responseLabel = args.status === "completed" ? "Agent Response" : "Failure Details";
  const rawResponse = args.status === "completed"
    ? args.response ?? "No response stored."
    : args.errorMessage ?? "No failure details stored.";
  const notesValue = args.notes ? toPlainText(args.notes) : "";
  const preview = `${args.agentName} ${args.status} ${args.actionLabel} for "${args.cardTitle}".`;

  const responseHtml = await markdownToEmailHtml(rawResponse);
  const notesHtml = notesValue ? await markdownToEmailHtml(notesValue) : "";

  return {
    subject: `Griggs Hub | ${args.agentName} ${statusLabel} ${args.actionLabel}`,
    text: [
      "Griggs Hub Agent Execution",
      "",
      preview,
      "",
      `Status: ${statusLabel}`,
      `Agent: ${args.agentName}`,
      `Action: ${args.actionLabel}`,
      `Card: ${args.cardTitle}`,
      `Requested By: ${args.requestedBy}`,
      `Started: ${formatDate(args.createdAt)}`,
      `Finished: ${formatDate(args.updatedAt)}`,
      `Execution ID: ${args.executionId}`,
      args.modelUsed ? `Model: ${args.modelUsed}` : null,
      args.notes ? "" : null,
      args.notes ? `Notes:\n${notesValue}` : null,
      "",
      `${responseLabel}:\n${toPlainText(rawResponse)}`,
      "",
      "Open Griggs Hub: /agents/executions",
    ].filter(Boolean).join("\n"),
    html: `
<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>${escapeHtml(args.agentName)} ${escapeHtml(statusLabel)}</title>
<!--[if mso]><noscript><xml><o:OfficeDocumentSettings><o:PixelsPerInch>96</o:PixelsPerInch></o:OfficeDocumentSettings></xml></noscript><![endif]-->
</head>
<body style="margin:0;padding:0;background:#090909;font-family:Inter,Segoe UI,Helvetica Neue,Arial,sans-serif;color:#F3F3F3;-webkit-font-smoothing:antialiased;">

  <!-- Preview text -->
  <div style="display:none;overflow:hidden;max-height:0;max-width:0;opacity:0;">${escapeHtml(preview)}</div>

  <!-- Outer wrapper -->
  <table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="background:#090909;padding:32px 0;">
    <tr>
      <td align="center" style="padding:0 16px;">

        <!-- Card -->
        <table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="max-width:640px;border-radius:24px;border:1px solid rgba(255,255,255,0.08);background:linear-gradient(180deg,#181818 0%,#0F0F0F 100%);overflow:hidden;">

          <!-- Header -->
          <tr>
            <td style="padding:36px 32px 28px;background:radial-gradient(circle at top right,rgba(247,148,29,0.18),transparent 40%),linear-gradient(135deg,#1C1C1C 0%,#111111 100%);">
              <!-- Brand pill -->
              <table role="presentation" cellpadding="0" cellspacing="0">
                <tr>
                  <td style="border-radius:999px;border:1px solid rgba(255,255,255,0.10);background:rgba(255,255,255,0.04);padding:6px 12px;font-size:10px;letter-spacing:0.18em;text-transform:uppercase;color:#F6C27B;">
                    Griggs Capital Partners
                  </td>
                </tr>
              </table>
              <h1 style="margin:16px 0 0;font-size:26px;line-height:1.2;letter-spacing:-0.03em;color:#FFFFFF;font-weight:700;">${escapeHtml(args.agentName)} <span style="color:#F7941D;">${escapeHtml(statusLabel.toLowerCase())}</span> ${escapeHtml(args.actionLabel)}</h1>
              <p style="margin:12px 0 0;font-size:14px;line-height:1.7;color:#AAAAAA;">
                Griggs Hub recorded a ${escapeHtml(statusLabel.toLowerCase())} execution for <strong style="color:#FFFFFF;">${escapeHtml(args.cardTitle)}</strong>.
              </p>
            </td>
          </tr>

          <!-- Body -->
          <tr>
            <td style="padding:24px 32px 36px;">

              <!-- Status banner -->
              <table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="margin-bottom:28px;border-radius:16px;background:${statusGradient};padding:1px;">
                <tr>
                  <td style="border-radius:15px;background:#111111;padding:18px 20px;">
                    <table role="presentation" cellpadding="0" cellspacing="0" width="100%">
                      <tr>
                        <td>
                          <div style="font-size:10px;letter-spacing:0.14em;text-transform:uppercase;color:#888888;">Execution Status</div>
                          <div style="margin-top:6px;display:inline-flex;align-items:center;gap:8px;">
                            <span style="display:inline-block;width:8px;height:8px;border-radius:50%;background:${statusDot};"></span>
                            <span style="font-size:22px;font-weight:700;letter-spacing:-0.03em;color:#FFFFFF;">${escapeHtml(statusLabel)}</span>
                          </div>
                        </td>
                        <td align="right" valign="top">
                          <div style="font-size:10px;letter-spacing:0.14em;text-transform:uppercase;color:#888888;margin-bottom:6px;">Execution ID</div>
                          <div style="font-size:11px;font-family:SFMono-Regular,Menlo,Monaco,Consolas,monospace;color:#C0C0C0;word-break:break-all;max-width:180px;">${escapeHtml(args.executionId)}</div>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
              </table>

              <!-- Info grid — stacked label+pill, 2 columns -->
              <table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="margin-bottom:8px;">
                <tr>
                  <td width="50%" valign="top" style="padding-right:12px;">
                    <table role="presentation" cellpadding="0" cellspacing="0" width="100%">
                      ${buildInfoPill("Agent", args.agentName, "rgba(247,148,29,0.88)")}
                      ${buildInfoPill("Action", args.actionLabel, "rgba(251,186,0,0.88)")}
                      ${buildInfoPill("Started", formatDate(args.createdAt), "rgba(255,255,255,0.82)")}
                    </table>
                  </td>
                  <td width="50%" valign="top" style="padding-left:12px;">
                    <table role="presentation" cellpadding="0" cellspacing="0" width="100%">
                      ${buildInfoPill("Requested By", args.requestedBy, "rgba(255,255,255,0.82)")}
                      ${buildInfoPill("Finished", formatDate(args.updatedAt), "rgba(255,255,255,0.82)")}
                      ${args.modelUsed ? buildInfoPill("Model", args.modelUsed, "rgba(247,148,29,0.88)") : ""}
                    </table>
                  </td>
                </tr>
              </table>

              <!-- Task Card — full width -->
              <table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="margin-bottom:24px;">
                ${buildInfoPill("Task Card", args.cardTitle, "rgba(255,255,255,0.82)")}
              </table>

              ${notesHtml ? `
              <!-- Notes -->
              <div style="margin-bottom:24px;">
                <div style="margin-bottom:10px;font-size:10px;letter-spacing:0.14em;text-transform:uppercase;color:#6B6B6B;">Team Context</div>
                <div style="border-radius:16px;border:1px solid rgba(255,255,255,0.07);background:#0D0D0E;padding:18px 20px;">
                  ${notesHtml}
                </div>
              </div>
              ` : ""}

              <!-- Response -->
              <div style="margin-bottom:24px;">
                <div style="margin-bottom:10px;display:flex;align-items:center;gap:10px;">
                  <span style="font-size:10px;letter-spacing:0.14em;text-transform:uppercase;color:#6B6B6B;">${escapeHtml(responseLabel)}</span>
                  ${args.status === "completed"
        ? `<span style="display:inline-block;border-radius:999px;background:rgba(74,222,128,0.12);border:1px solid rgba(74,222,128,0.25);padding:2px 10px;font-size:10px;letter-spacing:0.06em;text-transform:uppercase;color:#4ADE80;">Success</span>`
        : `<span style="display:inline-block;border-radius:999px;background:rgba(248,113,113,0.12);border:1px solid rgba(248,113,113,0.25);padding:2px 10px;font-size:10px;letter-spacing:0.06em;text-transform:uppercase;color:#F87171;">Error</span>`
      }
                </div>
                <div style="border-radius:16px;border:1px solid rgba(255,255,255,0.07);background:#0D0D0E;padding:20px 22px;word-break:break-word;">
                  ${responseHtml}
                </div>
              </div>

              <!-- Footer -->
              <div style="border-top:1px solid rgba(255,255,255,0.07);padding-top:16px;font-size:12px;line-height:1.6;color:#555555;">
                Sent by Griggs Hub &bull; Griggs Capital Partners
              </div>

            </td>
          </tr>
        </table>

      </td>
    </tr>
  </table>

</body>
</html>
    `,
  };
}

export async function notifyAgentExecutionEmail(executionId: string) {
  const settings = await getHubSettings();
  if (!settings?.agentExecutionEmailEnabled) return;

  const execution = await prisma.agentTaskExecution.findUnique({
    where: { id: executionId },
    include: {
      agent: { select: { name: true, abilities: true } },
      kanbanCard: { select: { title: true } },
      triggeredBy: { select: { email: true, displayName: true, name: true } },
    },
  });

  if (
    !execution
    || !execution.triggeredBy?.email
    || (execution.status !== "completed" && execution.status !== "failed")
  ) {
    return;
  }

  const email = await buildEmail({
    agentName: execution.agent.name,
    actionLabel: resolveAgentActionLabel(execution.actionType, execution.agent.abilities),
    cardTitle: execution.kanbanCard.title,
    status: execution.status,
    executionId: execution.id,
    requestedBy: execution.triggeredBy.displayName || execution.triggeredBy.name || execution.triggeredBy.email,
    createdAt: execution.createdAt,
    updatedAt: execution.updatedAt,
    modelUsed: execution.modelUsed,
    notes: execution.notes,
    response: execution.response,
    errorMessage: execution.errorMessage,
  });

  await sendHubEmail({
    to: execution.triggeredBy.email,
    subject: email.subject,
    html: email.html,
    text: email.text,
  });
}
