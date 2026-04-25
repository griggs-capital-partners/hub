import { NextResponse } from "next/server";
import { connection } from "next/server";
import { serverAuth } from "@/lib/auth";

export async function GET() {
  await connection();

  try {
    const { data: session } = await serverAuth.getSession();
    return NextResponse.json(session ?? null);
  } catch (error) {
    const message =
      error instanceof Error && error.message.trim().length > 0
        ? error.message
        : "Failed to resolve the current session.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
