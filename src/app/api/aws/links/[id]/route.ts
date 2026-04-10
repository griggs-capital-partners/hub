import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const body = await req.json();
  const { label, resourceId, region } = body as {
    label?: string;
    resourceId?: string;
    region?: string;
  };

  const link = await prisma.repoAwsLink.findUnique({ where: { id } });
  if (!link) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const updated = await prisma.repoAwsLink.update({
    where: { id },
    data: {
      ...(label !== undefined && { label: label.trim() }),
      ...(resourceId !== undefined && { resourceId: resourceId.trim() }),
      ...(region !== undefined && { region: region.trim() || null }),
    },
  });

  return NextResponse.json(updated);
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;

  const link = await prisma.repoAwsLink.findUnique({ where: { id } });
  if (!link) return NextResponse.json({ error: "Not found" }, { status: 404 });

  await prisma.repoAwsLink.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
