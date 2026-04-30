import assert from "node:assert/strict";
import path from "node:path";
import { fileURLToPath } from "node:url";
import createJiti from "jiti";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const jiti = createJiti(import.meta.url, { moduleCache: false });
const {
  buildApprovalAvailabilitySignalsFromDecisions,
  buildCapabilityApprovalKey,
  buildCapabilityGapApprovalCenterSummary,
  resolveUploadedDocumentExternalApprovalGrants,
  upsertCapabilityApprovalDecision,
} = jiti(path.join(__dirname, "..", "src", "lib", "capability-gap-approval-summary.ts"));

const tests = [];

function runTest(name, fn) {
  tests.push({ name, fn });
}

function makeGap(overrides = {}) {
  return {
    id: overrides.id ?? "gap-1",
    gapKey: overrides.gapKey ?? `gap-key-${overrides.id ?? "1"}`,
    workspaceId: null,
    conversationId: overrides.conversationId ?? "conv-1",
    conversationDocumentId: overrides.conversationDocumentId ?? "doc-1",
    asyncAgentWorkItemId: null,
    relatedContextDebtId: overrides.relatedContextDebtId ?? null,
    relatedContextDebtKey: null,
    sourceId: overrides.sourceId ?? "doc-1",
    kind: overrides.kind ?? "missing_tool",
    status: overrides.status ?? "review_needed",
    severity: overrides.severity ?? "medium",
    reviewState: "needs_review",
    neededCapability: overrides.neededCapability ?? "ocr",
    missingPayloadType: overrides.missingPayloadType ?? "ocr_text",
    missingToolId: overrides.missingToolId ?? "mistral_ocr_extractor",
    missingModelCapability: overrides.missingModelCapability ?? null,
    missingArtifactType: null,
    missingConnector: overrides.missingConnector ?? null,
    missingApprovalPath: overrides.missingApprovalPath ?? "uploaded_document_external_escalation",
    missingBudgetProfile: null,
    title: overrides.title ?? "OCR needed",
    description: overrides.description ?? "OCR is needed but not executable in this package.",
    whyNeeded: null,
    currentLimitation: overrides.currentLimitation ?? "Approval is required before this provider can be considered.",
    recommendedResolution: overrides.recommendedResolution ?? null,
    resolutionPath: overrides.resolutionPath ?? "register_tool",
    resolutionPaths: overrides.resolutionPaths ?? ["register_tool"],
    candidateToolCategories: [],
    candidateModelCapabilities: [],
    candidateContextLanes: [],
    requiredArtifactTypes: [],
    requiredApprovalPolicy: overrides.requiredApprovalPolicy ?? { path: "uploaded_document_external_escalation" },
    requiredBudgetProfile: {},
    securityConsiderations: [],
    dataEgressConsiderations: [],
    benchmarkFixtureIds: [],
    evidence: overrides.evidence ?? {
      providerId: "mistral_ocr",
      producerResultState: "approval_required",
      evidenceSummary: "OCR provider is approval-gated.",
      sourceLocator: { pageNumberStart: 1, sourceLocationLabel: "source.pdf page 1" },
      missingRequirements: [],
      executed: false,
    },
    traceEvents: overrides.traceEvents ?? [{ id: "trace-gap-1" }],
    firstSeenAt: overrides.firstSeenAt ?? "2026-04-01T00:00:00.000Z",
    lastSeenAt: overrides.lastSeenAt ?? "2026-04-02T00:00:00.000Z",
    resolvedAt: null,
    createdAt: "2026-04-01T00:00:00.000Z",
    updatedAt: "2026-04-02T00:00:00.000Z",
  };
}

function makeApproval(overrides = {}) {
  return {
    id: overrides.id ?? "approval-1",
    approvalKey: overrides.approvalKey ?? "approval-key-1",
    capabilityId: overrides.capabilityId ?? "ocr",
    providerId: overrides.providerId ?? "mistral_ocr",
    scope: overrides.scope ?? "conversation",
    scopeId: overrides.scopeId ?? "conv-1",
    approved: overrides.approved ?? true,
    reason: overrides.reason ?? "Approved for this conversation.",
    approvedById: "user-1",
    conversationId: overrides.conversationId ?? "conv-1",
    conversationDocumentId: overrides.conversationDocumentId ?? null,
    relatedGapRecordId: overrides.relatedGapRecordId ?? null,
    traceId: overrides.traceId ?? null,
    createdAt: "2026-04-03T00:00:00.000Z",
    updatedAt: "2026-04-03T00:00:00.000Z",
  };
}

runTest("groups repeated OCR gaps into one provider row with occurrence count", () => {
  const summary = buildCapabilityGapApprovalCenterSummary({
    registry: {
      contextDebtRecords: [],
      capabilityGapRecords: [
        makeGap({ id: "gap-1", gapKey: "gap-ocr-1" }),
        makeGap({ id: "gap-2", gapKey: "gap-ocr-2", lastSeenAt: "2026-04-04T00:00:00.000Z" }),
      ],
      sourceCoverageRecords: [],
      traceEvents: [],
    },
    approvals: [],
    conversationId: "conv-1",
    nowIso: "2026-04-05T00:00:00.000Z",
  });

  assert.equal(summary.rows.length, 1);
  assert.equal(summary.rows[0].capabilityId, "ocr");
  assert.equal(summary.rows[0].providerId, "mistral_ocr");
  assert.equal(summary.rows[0].occurrenceCount, 2);
  assert.equal(summary.rows[0].canApproveNow, true);
  assert.equal(summary.rows[0].approvalWillEnableExecution, false);
  assert.equal(summary.noRawOutputExposed, true);
});

runTest("approval clears only approval_required and keeps config blockers visible", () => {
  const summary = buildCapabilityGapApprovalCenterSummary({
    registry: {
      contextDebtRecords: [],
      capabilityGapRecords: [
        makeGap({
          evidence: {
            providerId: "mistral_ocr",
            producerResultState: "approval_required",
            missingRequirements: ["env:MISTRAL_API_KEY"],
            evidenceSummary: "Approval and configuration are both missing.",
            executed: false,
          },
        }),
      ],
      sourceCoverageRecords: [],
      traceEvents: [],
    },
    approvals: [makeApproval()],
    conversationId: "conv-1",
  });

  const [row] = summary.rows;
  assert.equal(row.approvalState.approved, true);
  assert.equal(row.remainingBlockers.includes("approval_required"), false);
  assert.equal(row.remainingBlockers.includes("config_required"), true);
  assert.equal(row.status, "config_required");
  assert.equal(summary.debug.approvalsConsumedThisTurn[0].clearedBlocker, "approval_required");
  assert.equal(summary.debug.blockersRemainingAfterApproval[0].remainingBlockers.includes("config_required"), true);
});

runTest("missing image input remains blocked after approval", () => {
  const summary = buildCapabilityGapApprovalCenterSummary({
    registry: {
      contextDebtRecords: [],
      capabilityGapRecords: [
        makeGap({
          neededCapability: "vision_page_understanding",
          missingPayloadType: "vision_observation",
          missingToolId: "openai_vision_page_understanding",
          evidence: {
            providerId: "openai_vision",
            producerResultState: "approval_required",
            missingRequirements: ["input:rendered_or_uploaded_image"],
            evidenceSummary: "Vision provider has no rendered/image input.",
            executed: false,
          },
        }),
      ],
      sourceCoverageRecords: [],
      traceEvents: [],
    },
    approvals: [makeApproval({ capabilityId: "vision_page_understanding", providerId: "openai_vision" })],
    conversationId: "conv-1",
  });

  const [row] = summary.rows;
  assert.equal(row.status, "missing_input");
  assert.equal(row.remainingBlockers.includes("missing_input"), true);
  assert.equal(row.approvalWillEnableExecution, false);
});

runTest("policy blocked rows cannot be approved from summary eligibility", () => {
  const summary = buildCapabilityGapApprovalCenterSummary({
    registry: {
      contextDebtRecords: [],
      capabilityGapRecords: [
        makeGap({
          status: "blocked",
          evidence: {
            providerId: "openai_vision",
            policyBlockers: ["external data egress disabled"],
            evidenceSummary: "Policy blocked.",
            executed: false,
          },
        }),
      ],
      sourceCoverageRecords: [],
      traceEvents: [],
    },
    approvals: [],
    conversationId: "conv-1",
  });

  assert.equal(summary.rows[0].status, "policy_blocked");
  assert.equal(summary.rows[0].canApproveNow, false);
});

runTest("approval decisions produce availability signals for matching producer requests", () => {
  const request = {
    id: "request-1",
    traceId: "trace-1",
    planId: "plan-1",
    conversationId: "conv-1",
    messageId: null,
    conversationDocumentId: "doc-1",
    sourceId: "doc-1",
    sourceKind: "uploaded_document",
    sourceLocator: null,
    requestedObservationType: "ocr_text",
    requestedCapabilityId: "ocr",
    requestedPayloadType: "ocr_text",
    reason: "Need OCR.",
    priority: "high",
    severity: "medium",
    approvalPath: "uploaded_document_external_escalation",
    producerId: "mistral_ocr_extractor",
    input: { metadata: { providerId: "mistral_ocr" } },
    noExecutionClaimed: true,
  };

  const signals = buildApprovalAvailabilitySignalsFromDecisions({
    requests: [request],
    approvals: [makeApproval()],
  });

  assert.equal(signals.length, 1);
  assert.equal(signals[0].source, "approval");
  assert.equal(signals[0].approvalSatisfied, true);
  assert.equal(signals[0].noExecutionClaimed, true);
});

runTest("approval decision upsert persists through a durable client delegate", async () => {
  const writes = [];
  const client = {
    capabilityApprovalDecision: {
      async upsert(params) {
        writes.push(params);
        return {
          id: "approval-db-1",
          ...params.create,
          createdAt: new Date("2026-04-03T00:00:00.000Z"),
          updatedAt: new Date("2026-04-03T00:00:00.000Z"),
        };
      },
    },
  };

  const approval = await upsertCapabilityApprovalDecision({
    capabilityId: "ocr",
    providerId: "mistral_ocr",
    approved: true,
    scope: "conversation",
    scopeId: "conv-1",
    approvedById: "user-1",
    client,
  });

  assert.equal(approval.approved, true);
  assert.equal(approval.approvalKey, buildCapabilityApprovalKey({
    capabilityId: "ocr",
    providerId: "mistral_ocr",
    scope: "conversation",
    scopeId: "conv-1",
  }));
  assert.equal(writes.length, 1);
});

runTest("external approval grants preserve provider and capability scope", () => {
  const grants = resolveUploadedDocumentExternalApprovalGrants({
    conversationId: "conv-1",
    conversationDocumentId: "doc-1",
    approvals: [makeApproval({ capabilityId: "vision_page_understanding", providerId: "openai_vision" })],
  });

  assert.deepEqual(grants.approvedProviderIds, ["openai_vision"]);
  assert.equal(grants.approvedCapabilityIds.includes("vision_page_understanding"), true);
  assert.equal(grants.approvalGranted, true);
});

for (const test of tests) {
  try {
    await test.fn();
    console.log(`ok - ${test.name}`);
  } catch (error) {
    console.error(`not ok - ${test.name}`);
    console.error(error);
    process.exitCode = 1;
  }
}
