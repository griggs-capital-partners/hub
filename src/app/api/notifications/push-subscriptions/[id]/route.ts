import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;

  const subscription = await prisma.pushSubscription.findUnique({
    where: { id },
    select: { id: true, userId: true },
  });

  if (!subscription || subscription.userId !== session.user.id) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  await prisma.pushSubscription.delete({ where: { id } });
  return new NextResponse(null, { status: 204 });
}

