import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";

export async function POST(req: Request) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const { accessKeyId, secretAccessKey, region } = body as {
    accessKeyId: string;
    secretAccessKey: string;
    region: string;
  };

  if (!accessKeyId?.trim() || !secretAccessKey?.trim() || !region?.trim()) {
    return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
  }

  // Replace any existing AWS connection for this user
  await prisma.connectedAccount.deleteMany({
    where: { userId: session.user.id, provider: "aws" },
  });

  await prisma.connectedAccount.create({
    data: {
      userId: session.user.id,
      provider: "aws",
      providerAccountId: accessKeyId.trim(),
      access_token: accessKeyId.trim(),
      refresh_token: secretAccessKey.trim(),
      scope: region.trim(),
    },
  });

  return NextResponse.json({ ok: true });
}
