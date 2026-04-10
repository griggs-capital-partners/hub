import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const customers = await prisma.customer.findMany({
    orderBy: { updatedAt: "desc" },
    include: {
      contacts: { orderBy: { isPrimary: "desc" }, take: 5 },
      documents: { orderBy: { createdAt: "desc" }, take: 3 },
      noteItems: { orderBy: { createdAt: "desc" }, take: 3 },
    },
  });

  return NextResponse.json({ customers });
}

export async function POST(request: Request) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await request.json();
  const { name, website, industry, tier, status, healthScore, notes, productionUrls, logoUrl } = body;

  if (!name) return NextResponse.json({ error: "name required" }, { status: 400 });

  const customer = await prisma.customer.create({
    data: {
      name,
      website: website || null,
      industry: industry || null,
      tier: tier || "standard",
      status: status || "active",
      healthScore: healthScore ?? 3,
      notes: notes || null,
      productionUrls: productionUrls ? JSON.stringify(productionUrls) : "[]",
      logoUrl: logoUrl || null,
    },
    include: {
      contacts: true,
      documents: true,
      noteItems: true,
    },
  });

  return NextResponse.json({ customer });
}
