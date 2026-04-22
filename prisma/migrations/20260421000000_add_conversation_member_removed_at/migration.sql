ALTER TABLE "conversation_members"
ADD COLUMN IF NOT EXISTS "removedAt" TIMESTAMP(3);

DROP INDEX IF EXISTS "conversation_members_conversationId_joinedAt_idx";
DROP INDEX IF EXISTS "conversation_members_userId_idx";
DROP INDEX IF EXISTS "conversation_members_agentId_idx";

CREATE INDEX IF NOT EXISTS "conversation_members_conversationId_removedAt_joinedAt_idx"
ON "conversation_members"("conversationId", "removedAt", "joinedAt");

CREATE INDEX IF NOT EXISTS "conversation_members_userId_removedAt_idx"
ON "conversation_members"("userId", "removedAt");

CREATE INDEX IF NOT EXISTS "conversation_members_agentId_removedAt_idx"
ON "conversation_members"("agentId", "removedAt");
