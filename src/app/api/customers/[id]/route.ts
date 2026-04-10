import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;

  const customer = await prisma.customer.findUnique({
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

  if (!customer) return NextResponse.json({ error: "Not found" }, { status: 404 });

  return NextResponse.json({ customer });
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const body = await req.json();
  const { name, website, industry, tier, status, healthScore, notes, productionUrls, logoUrl } = body;

  const customer = await prisma.customer.update({
    where: { id },
    data: {
      ...(name !== undefined && { name }),
      ...(website !== undefined && { website: website || null }),
      ...(industry !== undefined && { industry: industry || null }),
      ...(tier !== undefined && { tier }),
      ...(status !== undefined && { status }),
      ...(healthScore !== undefined && { healthScore }),
      ...(notes !== undefined && { notes: notes || null }),
      ...(productionUrls !== undefined && { productionUrls: JSON.stringify(productionUrls) }),
      ...(logoUrl !== undefined && { logoUrl: logoUrl || null }),
    },
  });

  return NextResponse.json({ customer });
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  await prisma.customer.delete({ where: { id } });

  return NextResponse.json({ ok: true });
}
