import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

function baseUrl(req: NextRequest): string {
  const host = req.headers.get("x-forwarded-host") ?? req.headers.get("host") ?? "localhost:3000";
  const proto = req.headers.get("x-forwarded-proto") ?? (host.startsWith("localhost") ? "http" : "https");
  return `${proto}://${host}`;
}

export async function GET(req: NextRequest) {
  const session = await auth();
  const requestedReturnTo = req.nextUrl.searchParams.get("returnTo");
  const returnTo = requestedReturnTo?.startsWith("/") ? requestedReturnTo : "/settings/integrations";

  if (!session?.user?.id) {
    return NextResponse.redirect(
      new URL("/login", baseUrl(req))
    );
  }

  await prisma.connectedAccount.deleteMany({
    where: { userId: session.user.id, provider: "spotify" },
  });

  return NextResponse.redirect(
    new URL(`${returnTo}?spotify_disconnected=1`, baseUrl(req))
  );
}
