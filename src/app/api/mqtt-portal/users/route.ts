import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { getUsersByCustomer, getCustomerDbConfigs } from "@/lib/mqtt-portal/db";

export async function GET() {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  if (!getCustomerDbConfigs()) {
    return NextResponse.json({ error: "Customer databases not configured" }, { status: 503 });
  }

  try {
    const grouped = await getUsersByCustomer();
    return NextResponse.json(grouped);
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}
