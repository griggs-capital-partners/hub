import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { getUserLocations } from "@/lib/mqtt-portal/db";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ userId: string }> }
) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { userId } = await params;

  try {
    const result = await getUserLocations(decodeURIComponent(userId));
    return NextResponse.json(result);
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}
