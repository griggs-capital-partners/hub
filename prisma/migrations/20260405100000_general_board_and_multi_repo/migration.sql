-- Make KanbanBoard.repoId nullable (for General board not tied to any repo)
ALTER TABLE "kanban_boards" ALTER COLUMN "repoId" DROP NOT NULL;

-- Create KanbanCardRepo join table (cards linked to multiple repos)
CREATE TABLE "kanban_card_repos" (
    "cardId" TEXT NOT NULL,
    "repoId" TEXT NOT NULL,
    CONSTRAINT "kanban_card_repos_pkey" PRIMARY KEY ("cardId","repoId")
);

-- Add foreign keys
ALTER TABLE "kanban_card_repos" ADD CONSTRAINT "kanban_card_repos_cardId_fkey"
    FOREIGN KEY ("cardId") REFERENCES "kanban_cards"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "kanban_card_repos" ADD CONSTRAINT "kanban_card_repos_repoId_fkey"
    FOREIGN KEY ("repoId") REFERENCES "repos"("id") ON DELETE CASCADE ON UPDATE CASCADE;
