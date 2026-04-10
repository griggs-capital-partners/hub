import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { sendHubEmail } from "@/lib/email";

function isValidEmail(value: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json().catch(() => null) as { to?: string } | null;
  const to = typeof body?.to === "string" ? body.to.trim() : "";

  if (!to) {
    return NextResponse.json({ error: "Recipient email is required" }, { status: 400 });
  }

  if (!isValidEmail(to)) {
    return NextResponse.json({ error: "Recipient email is invalid" }, { status: 400 });
  }

  try {
    await sendHubEmail({
      to,
      subject: "Smart Hub | SMTP Test",
      text: [
        "Smart Hub SMTP test",
        "",
        "Your hub email connection is working.",
        "Agent execution emails will be sent here when runs complete.",
      ].join("\n"),
      html: `
        <div style="margin:0; padding:32px 18px; background:#090909; font-family:Inter,Segoe UI,Helvetica,Arial,sans-serif; color:#F3F3F3;">
          <div style="max-width:640px; margin:0 auto; overflow:hidden; border-radius:28px; border:1px solid rgba(255,255,255,0.08); background:linear-gradient(180deg, #171717 0%, #0E0E0E 100%);">
            <div style="padding:36px 34px; background:
              radial-gradient(circle at top right, rgba(247,148,29,0.22), transparent 34%),
              linear-gradient(135deg, #1C1C1C 0%, #101010 100%);">
              <div style="display:inline-block; margin-bottom:14px; border-radius:999px; border:1px solid rgba(255,255,255,0.12); background:rgba(255,255,255,0.04); padding:8px 12px; font-size:11px; letter-spacing:0.16em; text-transform:uppercase; color:#F6C27B;">
                Griggs Capital Partners
              </div>
              <h1 style="margin:0; font-size:30px; line-height:1.15; letter-spacing:-0.03em;">Smart Hub email is connected</h1>
              <p style="margin:14px 0 0; font-size:15px; line-height:1.7; color:#C9C9C9;">
                Your SMTP settings are working. Agent execution completion emails will now come from your hub mailbox.
              </p>
            </div>
          </div>
        </div>
      `,
    });

    return NextResponse.json({ message: `Test email sent to ${to}` });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Could not send test email";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
