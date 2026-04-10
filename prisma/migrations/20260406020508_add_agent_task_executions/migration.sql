-- CreateTable
CREATE TABLE "agent_task_executions" (
    "id" TEXT NOT NULL,
    "kanbanCardId" TEXT NOT NULL,
    "agentId" TEXT NOT NULL,
    "actionType" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'in-process',
    "contextJson" TEXT,
    "prompt" TEXT,
    "response" TEXT,
    "errorMessage" TEXT,
    "modelUsed" TEXT,
    "notes" TEXT,
    "triggeredById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "agent_task_executions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "agent_task_executions_kanbanCardId_idx" ON "agent_task_executions"("kanbanCardId");

-- CreateIndex
CREATE INDEX "agent_task_executions_agentId_idx" ON "agent_task_executions"("agentId");

-- CreateIndex
CREATE INDEX "agent_task_executions_status_createdAt_idx" ON "agent_task_executions"("status", "createdAt");

-- AddForeignKey
ALTER TABLE "agent_task_executions" ADD CONSTRAINT "agent_task_executions_kanbanCardId_fkey" FOREIGN KEY ("kanbanCardId") REFERENCES "kanban_cards"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "agent_task_executions" ADD CONSTRAINT "agent_task_executions_agentId_fkey" FOREIGN KEY ("agentId") REFERENCES "ai_agents"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "agent_task_executions" ADD CONSTRAINT "agent_task_executions_triggeredById_fkey" FOREIGN KEY ("triggeredById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
