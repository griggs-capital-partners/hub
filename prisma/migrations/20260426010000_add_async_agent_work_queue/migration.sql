CREATE TABLE IF NOT EXISTS "async_agent_work_items" (
    "id" TEXT NOT NULL,
    "workKey" TEXT NOT NULL,
    "conversationId" TEXT,
    "conversationDocumentId" TEXT,
    "createdById" TEXT,
    "status" TEXT NOT NULL DEFAULT 'queued',
    "type" TEXT NOT NULL,
    "trigger" TEXT NOT NULL,
    "priority" TEXT NOT NULL DEFAULT 'normal',
    "planJson" TEXT NOT NULL DEFAULT '{}',
    "resumePolicyJson" TEXT NOT NULL DEFAULT '{}',
    "retryPolicyJson" TEXT NOT NULL DEFAULT '{}',
    "budgetSnapshotJson" TEXT NOT NULL DEFAULT '{}',
    "controlSnapshotJson" TEXT NOT NULL DEFAULT '{}',
    "assemblySnapshotJson" TEXT,
    "contextGapsJson" TEXT NOT NULL DEFAULT '[]',
    "deferredCapabilitiesJson" TEXT NOT NULL DEFAULT '[]',
    "artifactLinksJson" TEXT NOT NULL DEFAULT '[]',
    "sourceLinksJson" TEXT NOT NULL DEFAULT '[]',
    "resultJson" TEXT,
    "traceJson" TEXT NOT NULL DEFAULT '[]',
    "errorJson" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMP(3),

    CONSTRAINT "async_agent_work_items_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "async_agent_work_items_workKey_key"
ON "async_agent_work_items"("workKey");

CREATE INDEX IF NOT EXISTS "async_agent_work_conversation_status_type_idx"
ON "async_agent_work_items"("conversationId", "status", "type");

CREATE INDEX IF NOT EXISTS "async_agent_work_document_status_type_idx"
ON "async_agent_work_items"("conversationDocumentId", "status", "type");

CREATE INDEX IF NOT EXISTS "async_agent_work_status_priority_created_idx"
ON "async_agent_work_items"("status", "priority", "createdAt");

CREATE INDEX IF NOT EXISTS "async_agent_work_trigger_created_idx"
ON "async_agent_work_items"("trigger", "createdAt");

CREATE INDEX IF NOT EXISTS "async_agent_work_created_by_idx"
ON "async_agent_work_items"("createdById", "createdAt");

DO $$
BEGIN
  ALTER TABLE "async_agent_work_items"
  ADD CONSTRAINT "async_agent_work_items_conversationId_fkey"
  FOREIGN KEY ("conversationId") REFERENCES "conversations"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  ALTER TABLE "async_agent_work_items"
  ADD CONSTRAINT "async_agent_work_items_conversationDocumentId_fkey"
  FOREIGN KEY ("conversationDocumentId") REFERENCES "conversation_documents"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  ALTER TABLE "async_agent_work_items"
  ADD CONSTRAINT "async_agent_work_items_createdById_fkey"
  FOREIGN KEY ("createdById") REFERENCES "users"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;
