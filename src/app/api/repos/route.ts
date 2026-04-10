import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const repos = await prisma.repo.findMany({
    where: { connected: true },
    orderBy: [
      { pushedAt: "desc" },
      { updatedAt: "desc" }
    ],
    include: {
      boards: {
        include: {
          columns: {
            include: { cards: true },
          },
        },
      },
    },
  });

  return NextResponse.json({ repos });
}
