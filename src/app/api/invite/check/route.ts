import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

// POST /api/invite/check — public endpoint, returns whether an email is invited.
// Used by the sign-up flow to validate before showing the full form.
export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  const email = (body?.email as string | undefined)?.toLowerCase().trim();

  if (!email) {
    return NextResponse.json({ allowed: false, error: "Email is required." }, { status: 400 });
  }

  const invite = await prisma.teamInvite.findUnique({ where: { email } });

  if (!invite) {
    return NextResponse.json({ allowed: false, error: "This email isn't on the invite list. Ask an admin to invite you first." });
  }

  return NextResponse.json({ allowed: true });
}
