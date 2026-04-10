-- CreateTable
CREATE TABLE "roadmap_cards" (
    "id" TEXT NOT NULL,
    "repoId" TEXT NOT NULL,
    "quarter" INTEGER NOT NULL,
    "year" INTEGER NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "status" TEXT NOT NULL DEFAULT 'planning',
    "uid" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "roadmap_cards_pkey" PRIMARY KEY ("id")
);

-- AlterTable
ALTER TABLE "repos" ADD COLUMN "roadmapOrder" INTEGER NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "issue_notes" ADD COLUMN "image" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "roadmap_cards_repoId_quarter_year_key" ON "roadmap_cards"("repoId", "quarter", "year");

-- AddForeignKey
ALTER TABLE "roadmap_cards" ADD CONSTRAINT "roadmap_cards_repoId_fkey"
    FOREIGN KEY ("repoId") REFERENCES "repos"("id") ON DELETE CASCADE ON UPDATE CASCADE;
