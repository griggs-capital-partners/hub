import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";

export async function DELETE() {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  await prisma.connectedAccount.deleteMany({
    where: { userId: session.user.id, provider: "aws" },
  });

  return NextResponse.json({ ok: true });
}
