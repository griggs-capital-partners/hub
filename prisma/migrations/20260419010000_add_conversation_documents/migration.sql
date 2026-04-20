CREATE TABLE IF NOT EXISTS "conversation_documents" (
    "id" TEXT NOT NULL,
    "conversationId" TEXT NOT NULL,
    "uploadedBy" TEXT NOT NULL,
    "filename" TEXT NOT NULL,
    "mimeType" TEXT,
    "fileType" TEXT NOT NULL,
    "fileSize" INTEGER NOT NULL,
    "storagePath" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "conversation_documents_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "conversation_documents_conversationId_createdAt_idx" ON "conversation_documents"("conversationId", "createdAt");
CREATE INDEX IF NOT EXISTS "conversation_documents_uploadedBy_createdAt_idx" ON "conversation_documents"("uploadedBy", "createdAt");

DO $$
BEGIN
  ALTER TABLE "conversation_documents"
  ADD CONSTRAINT "conversation_documents_conversationId_fkey"
  FOREIGN KEY ("conversationId") REFERENCES "conversations"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  ALTER TABLE "conversation_documents"
  ADD CONSTRAINT "conversation_documents_uploadedBy_fkey"
  FOREIGN KEY ("uploadedBy") REFERENCES "users"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;
