import { createNeonAuth } from "@neondatabase/auth/next/server";
import { connection } from "next/server";

// Ensure environment variables are set to prevent top-level crashes in production (Next.js 16).
if (process.env.NODE_ENV === "production") {
  if (!process.env.NEON_AUTH_BASE_URL) {
    console.warn("NEON_AUTH_BASE_URL is missing. Please set this in your environment.");
  }
  if (!process.env.NEON_AUTH_COOKIE_SECRET) {
    console.warn("NEON_AUTH_COOKIE_SECRET is missing. Please set this in your environment.");
  }
}

export const serverAuth = createNeonAuth({
  baseUrl: process.env.NEON_AUTH_BASE_URL || "",
  cookies: {
    secret: process.env.NEON_AUTH_COOKIE_SECRET || "dummy-secret-for-initialization",
    // Note: session persistence is typically managed in the Neon Console
    // or through the service's own cookie settings.
  },
});

// Backward-compatible auth() — returns the same shape all existing server
// components and API routes expect: { user: { id, name, email, image } } | null
export async function auth(): Promise<{
  user: {
    id: string;
    name: string | null;
    email: string | null;
    image: string | null;
    displayName?: string | null;
  };
} | null> {
  // Ensure we are connected/have runtime access in Next.js 16/15
  await connection();

  const { data: session } = await serverAuth.getSession();
  if (!session?.user) return null;
  const u = session.user as {
    id: string;
    name?: string | null;
    email?: string | null;
    image?: string | null;
  };
  return {
    user: {
      id: u.id,
      name: u.name ?? null,
      email: u.email ?? null,
      image: u.image ?? null,
    },
  };
}
