import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function DELETE() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  await prisma.connectedAccount.deleteMany({
    where: {
      userId: session.user.id,
      provider: "microsoft-teams",
    },
  });

  return NextResponse.json({ ok: true });
}
