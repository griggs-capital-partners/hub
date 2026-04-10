import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";

export async function GET() {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const links = await prisma.repoAwsLink.findMany({
    orderBy: { createdAt: "asc" },
    include: { repo: { select: { id: true, name: true, fullName: true } } },
  });

  return NextResponse.json(links);
}

export async function POST(req: Request) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const { repoId, service, resourceId, label, region } = body as {
    repoId: string;
    service: string;
    resourceId: string;
    label: string;
    region?: string;
  };

  if (!repoId || !service || !resourceId?.trim() || !label?.trim()) {
    return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
  }

  const repo = await prisma.repo.findUnique({ where: { id: repoId } });
  if (!repo) return NextResponse.json({ error: "Repo not found" }, { status: 404 });

  const link = await prisma.repoAwsLink.create({
    data: {
      repoId,
      service,
      resourceId: resourceId.trim(),
      label: label.trim(),
      region: region?.trim() || null,
    },
  });

  return NextResponse.json(link, { status: 201 });
}
