CREATE TABLE IF NOT EXISTS "chat_projects" (
  "id" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "chat_projects_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "conversations"
ADD COLUMN IF NOT EXISTS "chatProjectId" TEXT;

DO $$
BEGIN
  ALTER TABLE "conversations"
  ADD CONSTRAINT "conversations_chatProjectId_fkey"
  FOREIGN KEY ("chatProjectId") REFERENCES "chat_projects"("id")
  ON DELETE SET NULL
  ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

CREATE INDEX IF NOT EXISTS "conversations_chatProjectId_updatedAt_idx"
ON "conversations"("chatProjectId", "updatedAt");

WITH repo_backfill AS (
  SELECT
    r.id AS repo_id,
    CONCAT('chat-project-repo-', r.id) AS chat_project_id,
    CASE
      WHEN COUNT(*) OVER (PARTITION BY LOWER(COALESCE(NULLIF(TRIM(r.name), ''), r."fullName"))) > 1
        THEN r."fullName"
      ELSE COALESCE(NULLIF(TRIM(r.name), ''), r."fullName")
    END AS chat_project_name
  FROM "repos" r
  WHERE EXISTS (
    SELECT 1
    FROM "conversations" c
    WHERE c."repoId" = r.id
  )
)
INSERT INTO "chat_projects" ("id", "name", "createdAt", "updatedAt")
SELECT
  repo_backfill.chat_project_id,
  repo_backfill.chat_project_name,
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
FROM repo_backfill
ON CONFLICT ("id") DO UPDATE
SET
  "name" = EXCLUDED."name",
  "updatedAt" = CURRENT_TIMESTAMP;

UPDATE "conversations" c
SET "chatProjectId" = CONCAT('chat-project-repo-', c."repoId")
WHERE c."repoId" IS NOT NULL
  AND c."chatProjectId" IS NULL;
