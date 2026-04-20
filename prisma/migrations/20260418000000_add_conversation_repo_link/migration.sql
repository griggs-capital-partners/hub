ALTER TABLE "conversations"
ADD COLUMN IF NOT EXISTS "repoId" TEXT;

DO $$
BEGIN
  ALTER TABLE "conversations"
  ADD CONSTRAINT "conversations_repoId_fkey"
  FOREIGN KEY ("repoId") REFERENCES "repos"("id")
  ON DELETE SET NULL
  ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

CREATE INDEX IF NOT EXISTS "conversations_repoId_updatedAt_idx"
ON "conversations"("repoId", "updatedAt");
