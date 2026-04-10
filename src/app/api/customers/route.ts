import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { mapWellToCustomerSummary } from "@/lib/well-compat";

export async function GET() {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const wells = await prisma.oilWell.findMany({
    orderBy: { updatedAt: "desc" },
    include: {
      contacts: { orderBy: { isPrimary: "desc" }, take: 5 },
      documents: { orderBy: { createdAt: "desc" }, take: 3 },
      noteItems: { orderBy: { createdAt: "desc" }, take: 3 },
    },
  });

  return NextResponse.json({ customers: wells.map(mapWellToCustomerSummary) });
}

export async function POST(request: Request) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await request.json();
  const { name, industry, status, healthScore, notes } = body;

  if (!name) return NextResponse.json({ error: "name required" }, { status: 400 });

  const well = await prisma.oilWell.create({
    data: {
      name,
      address: industry || null,
      status: status === "inactive" ? "inactive" : "active",
      priority:
        healthScore !== undefined && healthScore <= 1
          ? "critical"
          : healthScore !== undefined && healthScore <= 2
            ? "high"
            : healthScore !== undefined && healthScore >= 4
              ? "low"
              : "medium",
      notes: notes || null,
    },
    include: {
      contacts: true,
      documents: true,
      noteItems: true,
    },
  });

  return NextResponse.json({ customer: mapWellToCustomerSummary(well) });
}
