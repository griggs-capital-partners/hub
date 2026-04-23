ALTER TABLE "conversations"
ADD COLUMN "archivedAt" TIMESTAMP(3);

CREATE INDEX "conversations_archivedAt_updatedAt_idx"
ON "conversations"("archivedAt", "updatedAt");
