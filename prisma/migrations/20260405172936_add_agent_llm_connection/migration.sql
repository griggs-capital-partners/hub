ALTER TABLE "ai_agents"
ADD COLUMN "llmEndpointUrl" TEXT,
ADD COLUMN "llmUsername" TEXT,
ADD COLUMN "llmPassword" TEXT,
ADD COLUMN "llmModel" TEXT,
ADD COLUMN "llmStatus" TEXT NOT NULL DEFAULT 'disconnected',
ADD COLUMN "llmLastCheckedAt" TIMESTAMP(3),
ADD COLUMN "llmLastError" TEXT;
