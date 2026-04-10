import { type NextRequest } from "next/server";
import { serverAuth } from "@/lib/auth";

// Protect all hub routes. Unauthenticated users are redirected to /login.
// API routes and static assets are excluded — they handle their own auth.
export async function proxy(request: NextRequest) {
  const handler = serverAuth.middleware({ loginUrl: "/login" });
  return handler(request);
}

export const config = {
  matcher: [
    "/((?!api|_next/static|_next/image|favicon.ico|logo.png|login|reset-password|.*\\.svg|.*\\.png).*)",
  ],
};
