CREATE TABLE IF NOT EXISTS "capability_approval_decisions" (
    "id" TEXT NOT NULL,
    "approvalKey" TEXT NOT NULL,
    "capabilityId" TEXT NOT NULL,
    "providerId" TEXT,
    "scope" TEXT NOT NULL,
    "scopeId" TEXT,
    "approved" BOOLEAN NOT NULL DEFAULT true,
    "reason" TEXT,
    "approvedById" TEXT,
    "conversationId" TEXT,
    "conversationDocumentId" TEXT,
    "relatedGapRecordId" TEXT,
    "traceId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "capability_approval_decisions_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "capability_approval_decisions_approvalKey_key"
ON "capability_approval_decisions"("approvalKey");

CREATE INDEX IF NOT EXISTS "capability_approval_scope_idx"
ON "capability_approval_decisions"("capabilityId", "providerId", "scope", "scopeId");

CREATE INDEX IF NOT EXISTS "capability_approval_conversation_idx"
ON "capability_approval_decisions"("conversationId", "approved", "updatedAt");

CREATE INDEX IF NOT EXISTS "capability_approval_document_idx"
ON "capability_approval_decisions"("conversationDocumentId", "approved", "updatedAt");

CREATE INDEX IF NOT EXISTS "capability_approval_actor_updated_idx"
ON "capability_approval_decisions"("approvedById", "updatedAt");

CREATE INDEX IF NOT EXISTS "capability_approval_gap_idx"
ON "capability_approval_decisions"("relatedGapRecordId");

DO $$
BEGIN
  ALTER TABLE "capability_approval_decisions"
  ADD CONSTRAINT "capability_approval_decisions_approvedById_fkey"
  FOREIGN KEY ("approvedById") REFERENCES "users"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  ALTER TABLE "capability_approval_decisions"
  ADD CONSTRAINT "capability_approval_decisions_conversationId_fkey"
  FOREIGN KEY ("conversationId") REFERENCES "conversations"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  ALTER TABLE "capability_approval_decisions"
  ADD CONSTRAINT "capability_approval_decisions_conversationDocumentId_fkey"
  FOREIGN KEY ("conversationDocumentId") REFERENCES "conversation_documents"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  ALTER TABLE "capability_approval_decisions"
  ADD CONSTRAINT "capability_approval_decisions_relatedGapRecordId_fkey"
  FOREIGN KEY ("relatedGapRecordId") REFERENCES "capability_gap_records"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;
