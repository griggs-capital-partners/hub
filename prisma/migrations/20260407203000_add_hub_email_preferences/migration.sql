ALTER TABLE "hub_settings"
ADD COLUMN IF NOT EXISTS "agentExecutionEmailEnabled" BOOLEAN NOT NULL DEFAULT true;
