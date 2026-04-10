"use client";

import { createAuthClient } from "@neondatabase/auth/next";

// Client-side auth instance.
// Uses /api/auth as the base URL (the route handler proxies to Neon Auth).
export const authClient = createAuthClient();
