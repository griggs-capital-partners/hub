CREATE TABLE IF NOT EXISTS "conversation_document_knowledge_artifacts" (
    "id" TEXT NOT NULL,
    "conversationDocumentId" TEXT NOT NULL,
    "artifactKey" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'active',
    "title" TEXT,
    "summary" TEXT,
    "content" TEXT NOT NULL,
    "tool" TEXT,
    "sourcePageNumber" INTEGER,
    "sourcePageLabel" TEXT,
    "tableId" TEXT,
    "figureId" TEXT,
    "sectionPath" TEXT NOT NULL DEFAULT '[]',
    "headingPath" TEXT NOT NULL DEFAULT '[]',
    "sourceLocationLabel" TEXT,
    "payloadJson" TEXT,
    "relevanceHints" TEXT NOT NULL DEFAULT '[]',
    "confidence" DOUBLE PRECISION,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "conversation_document_knowledge_artifacts_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "conversation_document_inspection_tasks" (
    "id" TEXT NOT NULL,
    "conversationDocumentId" TEXT NOT NULL,
    "taskKey" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'completed',
    "tool" TEXT NOT NULL,
    "rationale" TEXT,
    "sourcePageNumber" INTEGER,
    "sourcePageLabel" TEXT,
    "tableId" TEXT,
    "figureId" TEXT,
    "sectionPath" TEXT NOT NULL DEFAULT '[]',
    "headingPath" TEXT NOT NULL DEFAULT '[]',
    "sourceLocationLabel" TEXT,
    "resultSummary" TEXT,
    "resultJson" TEXT,
    "unresolvedJson" TEXT,
    "createdArtifactKeys" TEXT NOT NULL DEFAULT '[]',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMP(3),

    CONSTRAINT "conversation_document_inspection_tasks_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "conversation_document_artifact_key_unique"
ON "conversation_document_knowledge_artifacts"("conversationDocumentId", "artifactKey");

CREATE INDEX IF NOT EXISTS "conversation_document_artifact_kind_updated_idx"
ON "conversation_document_knowledge_artifacts"("conversationDocumentId", "kind", "updatedAt");

CREATE INDEX IF NOT EXISTS "conversation_document_artifact_created_idx"
ON "conversation_document_knowledge_artifacts"("conversationDocumentId", "createdAt");

CREATE UNIQUE INDEX IF NOT EXISTS "conversation_document_inspection_task_key_unique"
ON "conversation_document_inspection_tasks"("conversationDocumentId", "taskKey");

CREATE INDEX IF NOT EXISTS "conversation_document_inspection_task_kind_updated_idx"
ON "conversation_document_inspection_tasks"("conversationDocumentId", "kind", "updatedAt");

CREATE INDEX IF NOT EXISTS "conversation_document_inspection_task_created_idx"
ON "conversation_document_inspection_tasks"("conversationDocumentId", "createdAt");

DO $$
BEGIN
  ALTER TABLE "conversation_document_knowledge_artifacts"
  ADD CONSTRAINT "conversation_document_knowledge_artifacts_conversationDocumentId_fkey"
  FOREIGN KEY ("conversationDocumentId") REFERENCES "conversation_documents"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  ALTER TABLE "conversation_document_inspection_tasks"
  ADD CONSTRAINT "conversation_document_inspection_tasks_conversationDocumentId_fkey"
  FOREIGN KEY ("conversationDocumentId") REFERENCES "conversation_documents"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;
