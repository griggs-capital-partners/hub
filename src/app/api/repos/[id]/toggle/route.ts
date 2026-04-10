import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const body = await req.json();
  const connected: boolean = body.connected;

  if (typeof connected !== "boolean") {
    return NextResponse.json({ error: "connected must be a boolean" }, { status: 400 });
  }

  const repo = await prisma.repo.update({
    where: { id },
    data: { connected },
  });

  return NextResponse.json({ repo });
}
