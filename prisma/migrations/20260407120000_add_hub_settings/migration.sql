CREATE TABLE IF NOT EXISTS "hub_settings" (
    "id" TEXT NOT NULL DEFAULT 'default',
    "locationName" TEXT,
    "latitude" DOUBLE PRECISION,
    "longitude" DOUBLE PRECISION,
    "timezone" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "hub_settings_pkey" PRIMARY KEY ("id")
);
