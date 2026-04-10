import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET() {
  await auth();

  const [active, planning] = await Promise.all([
    prisma.sprint.findFirst({ where: { status: "active" }, select: { id: true } }),
    prisma.sprint.findFirst({ where: { status: "planning" }, select: { id: true } }),
  ]);

  const status = active ? "active" : planning ? "planning" : "none";
  return NextResponse.json({ status });
}
