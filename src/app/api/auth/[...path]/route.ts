import { serverAuth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { connection } from "next/server";

const neonHandler = serverAuth.handler();

// Intercept sign-up/email before proxying to Neon Auth.
// Returns an error Response if the email is not in team_invites, null otherwise.
async function checkSignUpAllowed(request: Request): Promise<Response | null> {
  // Clone so the original stream is still readable by neonHandler
  const body = await request.clone().json().catch(() => null);
  const email = (body?.email as string | undefined)?.toLowerCase().trim();

  if (!email) {
    return Response.json({ error: "Email is required." }, { status: 400 });
  }

  const invite = await prisma.teamInvite.findUnique({ where: { email } });

  if (!invite) {
    return Response.json(
      { error: "Your email is not on the invite list. Ask an admin to invite you first." },
      { status: 403 }
    );
  }

  // Mark invite as accepted on first use (allow re-use for password resets etc.)
  if (!invite.usedAt) {
    await prisma.teamInvite.update({ where: { email }, data: { usedAt: new Date() } });
  }

  return null; // Allow through
}

export async function POST(
  request: Request,
  ctx: { params: Promise<{ path: string[] }> }
) {
  // Ensure runtime/connection access in Next.js 16
  await connection();

  const { path } = await ctx.params;

  if (path.join("/") === "sign-up/email") {
    const blocked = await checkSignUpAllowed(request);
    if (blocked) return blocked;
  }

  return neonHandler.POST(request, ctx as any);
}

export async function GET(request: Request, ctx: { params: Promise<{ path: string[] }> }) {
  await connection();
  return neonHandler.GET(request, ctx as any);
}

export async function PUT(request: Request, ctx: { params: Promise<{ path: string[] }> }) {
  await connection();
  return neonHandler.PUT(request, ctx as any);
}

export async function DELETE(request: Request, ctx: { params: Promise<{ path: string[] }> }) {
  await connection();
  return neonHandler.DELETE(request, ctx as any);
}

export async function PATCH(request: Request, ctx: { params: Promise<{ path: string[] }> }) {
  await connection();
  return neonHandler.PATCH(request, ctx as any);
}
