import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;

  const well = await prisma.oilWell.findUnique({
    where: { id },
    include: {
      contacts: { orderBy: [{ isPrimary: "desc" }, { name: "asc" }] },
      documents: {
        orderBy: { createdAt: "desc" },
        include: { uploader: { select: { name: true, email: true, image: true } } },
      },
      noteItems: {
        orderBy: { createdAt: "desc" },
        include: { author: { select: { id: true, name: true, displayName: true, image: true } } },
      },
    },
  });

  if (!well) return NextResponse.json({ error: "Not found" }, { status: 404 });

  return NextResponse.json({ well });
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const body = await req.json();
  const { name, address, status, priority, notes } = body;

  const well = await prisma.oilWell.update({
    where: { id },
    data: {
      ...(name !== undefined && { name }),
      ...(address !== undefined && { address: address || null }),
      ...(status !== undefined && { status }),
      ...(priority !== undefined && { priority }),
      ...(notes !== undefined && { notes: notes || null }),
    },
  });

  return NextResponse.json({ well });
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  await prisma.oilWell.delete({ where: { id } });

  return NextResponse.json({ ok: true });
}
