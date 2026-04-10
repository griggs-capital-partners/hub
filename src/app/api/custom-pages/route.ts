import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";

export async function GET() {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const pages = await prisma.customPage.findMany({
    where: { isEnabled: true },
    orderBy: { order: "asc" },
    include: { repo: { select: { id: true, name: true } } },
  });

  return NextResponse.json(pages);
}

export async function POST(request: Request) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await request.json() as {
    name: string;
    slug: string;
    description?: string;
    icon?: string;
    repoId?: string;
    order?: number;
  };

  const page = await prisma.customPage.create({ data: body });
  return NextResponse.json(page, { status: 201 });
}
