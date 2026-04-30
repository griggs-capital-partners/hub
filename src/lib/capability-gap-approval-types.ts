export type CapabilityApprovalScope =
  | "one_time"
  | "conversation"
  | "document"
  | "project"
  | "workspace"
  | "provider"
  | "capability";

export type CapabilityGapApprovalCategory =
  | "ocr"
  | "rendered_page"
  | "vision"
  | "document_ai"
  | "external_parser"
  | "spreadsheet_analysis"
  | "python_analysis"
  | "table_extraction"
  | "local_tool"
  | "external_provider"
  | "native_payload_lane"
  | "connector"
  | "approval_path"
  | "other";

export type CapabilityGapApprovalStatus =
  | "open"
  | "approved"
  | "approval_required"
  | "config_required"
  | "policy_blocked"
  | "adapter_missing"
  | "missing_input"
  | "local_unavailable"
  | "external_unavailable"
  | "deferred"
  | "resolved";

export type CapabilityGapApprovalPriority = "low" | "medium" | "high" | "critical";

export type CapabilityProviderReadinessStatus =
  | "runtime_callable_when_configured"
  | "mock_tested_callable"
  | "config_required"
  | "unconfigured"
  | "approval_required"
  | "policy_blocked"
  | "missing_input"
  | "adapter_missing"
  | "deferred"
  | "completed_with_evidence";

export type CapabilityApprovalDecisionRecord = {
  id: string;
  approvalKey: string;
  capabilityId: string;
  providerId: string | null;
  scope: CapabilityApprovalScope;
  scopeId: string | null;
  approved: boolean;
  reason: string | null;
  approvedById: string | null;
  conversationId: string | null;
  conversationDocumentId: string | null;
  relatedGapRecordId: string | null;
  traceId: string | null;
  createdAt: string;
  updatedAt: string;
};

export type CapabilityApprovalStateSummary = {
  approved: boolean;
  decisionId: string | null;
  scope: CapabilityApprovalScope | null;
  scopeId: string | null;
  providerId: string | null;
  approvedById: string | null;
  reason: string | null;
  updatedAt: string | null;
};

export type CapabilityGapCandidateProviderSummary = {
  providerId: string;
  providerLabel: string;
  status: CapabilityProviderReadinessStatus;
  blockers: string[];
  canApproveNow: boolean;
  requiresConfig: boolean;
  requiresAdapter: boolean;
  requiresInput: boolean;
  requiresPolicyChange: boolean;
  externalDataEgress: boolean;
};

export type CapabilityGapLocalCandidateSummary = {
  candidateId: string;
  label: string;
  status: "available" | "unavailable" | "catalog_only" | "deferred";
  blockers: string[];
};

export type CapabilityGapApprovalSummaryRow = {
  summaryId: string;
  capabilityId: string;
  capabilityLabel: string;
  providerId: string | null;
  providerLabel: string | null;
  category: CapabilityGapApprovalCategory;
  status: CapabilityGapApprovalStatus;
  priority: CapabilityGapApprovalPriority;
  occurrenceCount: number;
  affectedConversationIds: string[];
  affectedDocumentIds: string[];
  sourceLocators: Array<Record<string, unknown>>;
  firstSeenAt: string | null;
  lastSeenAt: string | null;
  evidenceSummary: string;
  recommendedAction: string;
  remainingBlockers: string[];
  approvalState: CapabilityApprovalStateSummary;
  approvalScopesAvailable: CapabilityApprovalScope[];
  canApproveNow: boolean;
  approvalWillEnableExecution: false;
  approvalWillOnlyClearApprovalGate: boolean;
  candidateProviders: CapabilityGapCandidateProviderSummary[];
  localCandidates: CapabilityGapLocalCandidateSummary[];
  traceIds: string[];
  relatedGapRecordIds: string[];
  relatedDebtRecordIds: string[];
  relatedCoverageRecordIds: string[];
};

export type CapabilityGapApprovalCenterDebugSummary = {
  groupedGapCount: number;
  approvalRequiredCount: number;
  approvedCount: number;
  configRequiredCount: number;
  adapterMissingCount: number;
  missingInputCount: number;
  policyBlockedCount: number;
  topCapabilityCategories: Array<{
    category: CapabilityGapApprovalCategory;
    count: number;
  }>;
  approvalsConsumedThisTurn: Array<{
    capabilityId: string;
    providerId: string | null;
    scope: CapabilityApprovalScope;
    scopeId: string | null;
    clearedBlocker: "approval_required";
    remainingBlockers: string[];
  }>;
  blockersRemainingAfterApproval: Array<{
    capabilityId: string;
    providerId: string | null;
    remainingBlockers: string[];
  }>;
  noExecutionWarning: string;
};

export type CapabilityGapApprovalCenterSummary = {
  generatedAt: string;
  rows: CapabilityGapApprovalSummaryRow[];
  counts: {
    total: number;
    approvalRequired: number;
    approved: number;
    configRequired: number;
    adapterMissing: number;
    missingInput: number;
    policyBlocked: number;
    resolved: number;
  };
  debug: CapabilityGapApprovalCenterDebugSummary;
  noRawOutputExposed: true;
  noExecutionClaimed: true;
};
