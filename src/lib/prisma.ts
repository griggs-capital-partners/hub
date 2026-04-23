import { Prisma, PrismaClient } from "@prisma/client";
import { PrismaNeon } from "@prisma/adapter-neon";

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

function shouldUseNeonAdapter(connectionString: string | undefined) {
  if (!connectionString) {
    return false;
  }

  try {
    return new URL(connectionString).hostname.includes(".neon.tech");
  } catch {
    return false;
  }
}

function createPrismaClient() {
  const log: Prisma.LogLevel[] = process.env.NODE_ENV === "development" ? ["error", "warn"] : ["error"];
  const connectionString = process.env.DATABASE_URL;

  // Neon adapter avoids the TLS/runtime failures we hit with the default
  // Prisma engine on the local Windows Team Chat debugging path.
  if (shouldUseNeonAdapter(connectionString)) {
    return new PrismaClient({
      adapter: new PrismaNeon({ connectionString: connectionString! }),
      log,
    });
  }

  return new PrismaClient({ log });
}

export const prisma = globalForPrisma.prisma ?? createPrismaClient();

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;
