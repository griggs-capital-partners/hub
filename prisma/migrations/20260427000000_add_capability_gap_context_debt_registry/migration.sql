CREATE TABLE IF NOT EXISTS "context_debt_records" (
    "id" TEXT NOT NULL,
    "debtKey" TEXT NOT NULL,
    "workspaceId" TEXT,
    "conversationId" TEXT,
    "conversationDocumentId" TEXT,
    "asyncAgentWorkItemId" TEXT,
    "artifactKey" TEXT,
    "sourceId" TEXT,
    "kind" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'open',
    "severity" TEXT NOT NULL DEFAULT 'medium',
    "sourceScope" TEXT NOT NULL,
    "sourceLocatorJson" TEXT NOT NULL DEFAULT '{}',
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "whyItMatters" TEXT,
    "resolutionPath" TEXT NOT NULL,
    "resolutionPathsJson" TEXT NOT NULL DEFAULT '[]',
    "deferredCapabilitiesJson" TEXT NOT NULL DEFAULT '[]',
    "requiredApprovalReasonsJson" TEXT NOT NULL DEFAULT '[]',
    "policyBlockersJson" TEXT NOT NULL DEFAULT '[]',
    "sourceCoverageTargetJson" TEXT NOT NULL DEFAULT '{}',
    "evidenceJson" TEXT NOT NULL DEFAULT '{}',
    "traceJson" TEXT NOT NULL DEFAULT '[]',
    "linkedArtifactKeysJson" TEXT NOT NULL DEFAULT '[]',
    "firstSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "resolvedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "context_debt_records_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "capability_gap_records" (
    "id" TEXT NOT NULL,
    "gapKey" TEXT NOT NULL,
    "workspaceId" TEXT,
    "conversationId" TEXT,
    "conversationDocumentId" TEXT,
    "asyncAgentWorkItemId" TEXT,
    "relatedContextDebtId" TEXT,
    "sourceId" TEXT,
    "kind" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'detected',
    "severity" TEXT NOT NULL DEFAULT 'medium',
    "reviewState" TEXT NOT NULL DEFAULT 'needs_review',
    "neededCapability" TEXT NOT NULL,
    "missingPayloadType" TEXT,
    "missingToolId" TEXT,
    "missingModelCapability" TEXT,
    "missingArtifactType" TEXT,
    "missingConnector" TEXT,
    "missingApprovalPath" TEXT,
    "missingBudgetProfile" TEXT,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "whyNeeded" TEXT,
    "currentLimitation" TEXT,
    "recommendedResolution" TEXT,
    "resolutionPath" TEXT NOT NULL,
    "resolutionPathsJson" TEXT NOT NULL DEFAULT '[]',
    "candidateToolCategoriesJson" TEXT NOT NULL DEFAULT '[]',
    "candidateModelCapabilitiesJson" TEXT NOT NULL DEFAULT '[]',
    "candidateContextLanesJson" TEXT NOT NULL DEFAULT '[]',
    "requiredArtifactTypesJson" TEXT NOT NULL DEFAULT '[]',
    "requiredApprovalPolicyJson" TEXT NOT NULL DEFAULT '{}',
    "requiredBudgetProfileJson" TEXT NOT NULL DEFAULT '{}',
    "securityConsiderationsJson" TEXT NOT NULL DEFAULT '[]',
    "dataEgressConsiderationsJson" TEXT NOT NULL DEFAULT '[]',
    "benchmarkFixtureIdsJson" TEXT NOT NULL DEFAULT '[]',
    "evidenceJson" TEXT NOT NULL DEFAULT '{}',
    "traceJson" TEXT NOT NULL DEFAULT '[]',
    "firstSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "resolvedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "capability_gap_records_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "source_coverage_records" (
    "id" TEXT NOT NULL,
    "coverageKey" TEXT NOT NULL,
    "workspaceId" TEXT,
    "conversationId" TEXT,
    "conversationDocumentId" TEXT,
    "asyncAgentWorkItemId" TEXT,
    "sourceId" TEXT NOT NULL,
    "sourceScope" TEXT NOT NULL,
    "sourceLocatorJson" TEXT NOT NULL DEFAULT '{}',
    "coverageStatus" TEXT NOT NULL DEFAULT 'unknown',
    "coverageTargetJson" TEXT NOT NULL DEFAULT '{}',
    "inspectedByJson" TEXT NOT NULL DEFAULT '[]',
    "limitationsJson" TEXT NOT NULL DEFAULT '[]',
    "relatedDebtIdsJson" TEXT NOT NULL DEFAULT '[]',
    "selectedCandidateCount" INTEGER NOT NULL DEFAULT 0,
    "totalCandidateCount" INTEGER NOT NULL DEFAULT 0,
    "evidenceJson" TEXT NOT NULL DEFAULT '{}',
    "traceJson" TEXT NOT NULL DEFAULT '[]',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "source_coverage_records_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "context_debt_records_debtKey_key"
ON "context_debt_records"("debtKey");

CREATE INDEX IF NOT EXISTS "context_debt_conversation_status_idx"
ON "context_debt_records"("conversationId", "status", "severity", "lastSeenAt");

CREATE INDEX IF NOT EXISTS "context_debt_document_status_idx"
ON "context_debt_records"("conversationDocumentId", "status", "severity", "lastSeenAt");

CREATE INDEX IF NOT EXISTS "context_debt_source_status_idx"
ON "context_debt_records"("sourceId", "status", "lastSeenAt");

CREATE INDEX IF NOT EXISTS "context_debt_async_work_status_idx"
ON "context_debt_records"("asyncAgentWorkItemId", "status");

CREATE UNIQUE INDEX IF NOT EXISTS "capability_gap_records_gapKey_key"
ON "capability_gap_records"("gapKey");

CREATE INDEX IF NOT EXISTS "capability_gap_needed_status_idx"
ON "capability_gap_records"("neededCapability", "status", "lastSeenAt");

CREATE INDEX IF NOT EXISTS "capability_gap_conversation_status_idx"
ON "capability_gap_records"("conversationId", "status", "severity", "lastSeenAt");

CREATE INDEX IF NOT EXISTS "capability_gap_document_status_idx"
ON "capability_gap_records"("conversationDocumentId", "status", "severity", "lastSeenAt");

CREATE INDEX IF NOT EXISTS "capability_gap_debt_status_idx"
ON "capability_gap_records"("relatedContextDebtId", "status");

CREATE INDEX IF NOT EXISTS "capability_gap_async_work_status_idx"
ON "capability_gap_records"("asyncAgentWorkItemId", "status");

CREATE UNIQUE INDEX IF NOT EXISTS "source_coverage_records_coverageKey_key"
ON "source_coverage_records"("coverageKey");

CREATE INDEX IF NOT EXISTS "source_coverage_conversation_status_idx"
ON "source_coverage_records"("conversationId", "coverageStatus", "updatedAt");

CREATE INDEX IF NOT EXISTS "source_coverage_document_status_idx"
ON "source_coverage_records"("conversationDocumentId", "coverageStatus", "updatedAt");

CREATE INDEX IF NOT EXISTS "source_coverage_source_status_idx"
ON "source_coverage_records"("sourceId", "coverageStatus", "updatedAt");

CREATE INDEX IF NOT EXISTS "source_coverage_async_work_status_idx"
ON "source_coverage_records"("asyncAgentWorkItemId", "coverageStatus");

DO $$
BEGIN
  ALTER TABLE "context_debt_records"
  ADD CONSTRAINT "context_debt_records_conversationId_fkey"
  FOREIGN KEY ("conversationId") REFERENCES "conversations"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  ALTER TABLE "context_debt_records"
  ADD CONSTRAINT "context_debt_records_conversationDocumentId_fkey"
  FOREIGN KEY ("conversationDocumentId") REFERENCES "conversation_documents"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  ALTER TABLE "context_debt_records"
  ADD CONSTRAINT "context_debt_records_asyncAgentWorkItemId_fkey"
  FOREIGN KEY ("asyncAgentWorkItemId") REFERENCES "async_agent_work_items"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  ALTER TABLE "capability_gap_records"
  ADD CONSTRAINT "capability_gap_records_conversationId_fkey"
  FOREIGN KEY ("conversationId") REFERENCES "conversations"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  ALTER TABLE "capability_gap_records"
  ADD CONSTRAINT "capability_gap_records_conversationDocumentId_fkey"
  FOREIGN KEY ("conversationDocumentId") REFERENCES "conversation_documents"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  ALTER TABLE "capability_gap_records"
  ADD CONSTRAINT "capability_gap_records_asyncAgentWorkItemId_fkey"
  FOREIGN KEY ("asyncAgentWorkItemId") REFERENCES "async_agent_work_items"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  ALTER TABLE "capability_gap_records"
  ADD CONSTRAINT "capability_gap_records_relatedContextDebtId_fkey"
  FOREIGN KEY ("relatedContextDebtId") REFERENCES "context_debt_records"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  ALTER TABLE "source_coverage_records"
  ADD CONSTRAINT "source_coverage_records_conversationId_fkey"
  FOREIGN KEY ("conversationId") REFERENCES "conversations"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  ALTER TABLE "source_coverage_records"
  ADD CONSTRAINT "source_coverage_records_conversationDocumentId_fkey"
  FOREIGN KEY ("conversationDocumentId") REFERENCES "conversation_documents"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  ALTER TABLE "source_coverage_records"
  ADD CONSTRAINT "source_coverage_records_asyncAgentWorkItemId_fkey"
  FOREIGN KEY ("asyncAgentWorkItemId") REFERENCES "async_agent_work_items"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;
