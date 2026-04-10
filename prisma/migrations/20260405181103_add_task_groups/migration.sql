-- AlterTable
ALTER TABLE "kanban_cards" ADD COLUMN     "taskGroupId" TEXT;

-- CreateTable
CREATE TABLE "task_groups" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "status" TEXT NOT NULL DEFAULT 'backlog',
    "color" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "task_groups_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "kanban_cards" ADD CONSTRAINT "kanban_cards_taskGroupId_fkey" FOREIGN KEY ("taskGroupId") REFERENCES "task_groups"("id") ON DELETE SET NULL ON UPDATE CASCADE;
