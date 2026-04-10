import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

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

  return NextResponse.json({ wells });
}

export async function POST(request: Request) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await request.json();
  const { name, address, status, priority, notes } = body;

  if (!name) return NextResponse.json({ error: "name required" }, { status: 400 });

  const well = await prisma.oilWell.create({
    data: {
      name,
      address: address || null,
      status: status || "active",
      priority: priority || "medium",
      notes: notes || null,
    },
    include: {
      contacts: true,
      documents: true,
      noteItems: true,
    },
  });

  return NextResponse.json({ well });
}
