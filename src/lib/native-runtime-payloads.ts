export type NativeRuntimePayloadKind =
  | "image"
  | "file_reference"
  | "rendered_page_image"
  | "uploaded_image"
  | "source_observation_image"
  | "native_file_reference";

export type NativeRuntimePayloadInclusionState =
  | "candidate"
  | "selected"
  | "included"
  | "excluded"
  | "unsupported"
  | "runtime_missing"
  | "model_supported_runtime_missing"
  | "failed";

export type NativeRuntimePayloadExclusionReason =
  | "unsupported_by_model"
  | "runtime_missing"
  | "model_supported_runtime_missing"
  | "missing_input"
  | "over_budget"
  | "policy_blocked"
  | "approval_required"
  | "no_provider_support"
  | "missing_provenance"
  | "provider_request_unsupported"
  | "failed_to_include"
  | "runtime_trace_missing_after_request"
  | "request_failed_after_image_inclusion"
  | "stream_failed_after_image_inclusion";

export type NativeRuntimePayloadRuntimeSubreason =
  | "provider_branch_not_direct_openai"
  | "streaming_path_missing_image_support"
  | "non_streaming_path_missing_image_support"
  | "runtime_request_builder_missing_image_support"
  | "model_family_not_marked_image_runtime_supported"
  | "payload_missing_safe_image_data"
  | "unsupported_endpoint_for_native_images"
  | "approval_required"
  | "policy_blocked"
  | "over_budget"
  | "failed_to_include"
  | "runtime_trace_missing_after_request"
  | "request_failed_after_image_inclusion"
  | "stream_failed_after_image_inclusion"
  | "missing_input"
  | "missing_provenance"
  | "no_user_message_anchor"
  | "transport_selection_excluded"
  | "unknown";

export type NativeRuntimePayloadLocator = {
  pageNumberStart?: number | null;
  pageNumberEnd?: number | null;
  pageLabelStart?: string | null;
  pageLabelEnd?: string | null;
  tableId?: string | null;
  figureId?: string | null;
  sourceLocationLabel?: string | null;
  cropId?: string | null;
};

export type NativeRuntimePayloadBudgetImpact = {
  tokenEstimate?: number | null;
  byteSize?: number | null;
  imageCount?: number | null;
};

export type NativeRuntimePayloadApprovalState =
  | "not_required"
  | "required"
  | "satisfied"
  | "policy_blocked"
  | "unknown";

export type NativeRuntimePayload = {
  id: string;
  payloadType: string;
  kind: NativeRuntimePayloadKind;
  sourceObservationId?: string | null;
  conversationDocumentId?: string | null;
  sourceId?: string | null;
  sourceType?: string | null;
  locator?: NativeRuntimePayloadLocator | Record<string, unknown> | null;
  mimeType?: string | null;
  byteSize?: number | null;
  width?: number | null;
  height?: number | null;
  providerTarget?: string | null;
  modelTarget?: string | null;
  traceId?: string | null;
  planId?: string | null;
  budgetImpact?: NativeRuntimePayloadBudgetImpact | null;
  approvalState?: NativeRuntimePayloadApprovalState | null;
  transportPayloadId?: string | null;
  dataUrl?: string | null;
  dataBase64?: string | null;
  uri?: string | null;
  metadata?: Record<string, unknown>;
};

export type NativeRuntimePayloadTrace = {
  payloadId: string;
  payloadType: string;
  kind: NativeRuntimePayloadKind;
  sourceObservationId: string | null;
  conversationDocumentId: string | null;
  sourceId: string | null;
  sourceType: string | null;
  locator: NativeRuntimePayloadLocator | Record<string, unknown> | null;
  mimeType: string | null;
  byteSize: number | null;
  width: number | null;
  height: number | null;
  providerTarget: string | null;
  modelTarget: string | null;
  state: NativeRuntimePayloadInclusionState;
  exclusionReason: NativeRuntimePayloadExclusionReason | null;
  runtimeSubreason: NativeRuntimePayloadRuntimeSubreason | null;
  detail: string;
  requestFormat: string | null;
  budgetImpact: NativeRuntimePayloadBudgetImpact | null;
  approvalState: NativeRuntimePayloadApprovalState | null;
  traceId: string | null;
  planId: string | null;
  transportPayloadId: string | null;
  noRawPayloadIncludedInTrace: true;
};

export type NativeRuntimeLaneSummary = {
  candidateCount: number;
  selectedCount: number;
  includedCount: number;
  excludedCount: number;
  selectedThenIncludedCount: number;
  selectedThenExcludedCount: number;
  diagnosticState:
    | "no_candidate"
    | "candidate_not_selected"
    | "selected_pending_runtime_trace"
    | "selected_but_excluded"
    | "included";
  diagnosticReasons: string[];
  includedByKind: Record<string, number>;
  excludedByReason: Record<string, number>;
  excludedBySubreason: Record<string, number>;
  runtimeMissingCount: number;
  modelSupportedRuntimeMissingCount: number;
  missingInputCount: number;
  overBudgetCount: number;
  approvalOrPolicyBlockedCount: number;
  approvalConsumedAsGovernanceInputCount: number;
  providerTargets: string[];
  modelTargets: string[];
  sourceAttributions: Array<{
    payloadId: string;
    sourceObservationId: string | null;
    conversationDocumentId: string | null;
    sourceId: string | null;
    pageNumberStart?: number | null;
    pageNumberEnd?: number | null;
    sourceLocationLabel?: string | null;
  }>;
  noExecutionWarnings: string[];
  noRawPayloadIncludedInTrace: true;
};

export type NativeRuntimeTraceVerdictStatus =
  | "included"
  | "selected_but_excluded"
  | "selected_pending_runtime_trace"
  | "no_candidate"
  | "unavailable";

export type NativeRuntimeTraceVerdictSelector = {
  payloadId?: string | null;
  payloadType?: string | null;
  providerTarget?: string | null;
  modelTarget?: string | null;
  conversationDocumentId?: string | null;
  sourceObservationId?: string | null;
  pageNumber?: number | null;
};

export type NativeRuntimeTraceUnrelatedExcludedPayload = {
  payloadId: string;
  payloadType: string;
  providerTarget: string | null;
  modelTarget: string | null;
  conversationDocumentId: string | null;
  sourceObservationId: string | null;
  pageNumber: number | null;
  reason: NativeRuntimePayloadExclusionReason | null;
  subreason: NativeRuntimePayloadRuntimeSubreason | null;
  detail: string;
};

export type NativeRuntimeTraceVerdict = {
  status: NativeRuntimeTraceVerdictStatus;
  payloadId?: string;
  payloadType?: string;
  providerTarget?: string | null;
  modelTarget?: string | null;
  requestFormat?: string | null;
  conversationDocumentId?: string | null;
  sourceObservationId?: string | null;
  pageNumber?: number | null;
  exclusionReason?: NativeRuntimePayloadExclusionReason | null;
  runtimeSubreason?: NativeRuntimePayloadRuntimeSubreason | null;
  detail?: string;
  matchedTraceCount: number;
  unrelatedExcludedCount: number;
  unrelatedExcludedPayloads: NativeRuntimeTraceUnrelatedExcludedPayload[];
  noRawPayloadIncludedInTrace: true;
};

export function isNativeImagePayloadType(payloadType: string | null | undefined) {
  return payloadType === "rendered_page_image" || payloadType === "page_crop_image";
}

export function isNativeFilePayloadType(payloadType: string | null | undefined) {
  return payloadType === "native_file_reference";
}

export function nativeRuntimeKindForPayloadType(payloadType: string): NativeRuntimePayloadKind {
  if (payloadType === "rendered_page_image") return "rendered_page_image";
  if (payloadType === "page_crop_image") return "source_observation_image";
  if (payloadType === "native_file_reference") return "native_file_reference";
  return "image";
}

export function traceNativeRuntimePayload(
  payload: NativeRuntimePayload,
  overrides: {
    state: NativeRuntimePayloadInclusionState;
    exclusionReason?: NativeRuntimePayloadExclusionReason | null;
    detail: string;
    providerTarget?: string | null;
    modelTarget?: string | null;
    requestFormat?: string | null;
    runtimeSubreason?: NativeRuntimePayloadRuntimeSubreason | null;
    traceId?: string | null;
    planId?: string | null;
  }
): NativeRuntimePayloadTrace {
  return {
    payloadId: payload.id,
    payloadType: payload.payloadType,
    kind: payload.kind,
    sourceObservationId: payload.sourceObservationId ?? null,
    conversationDocumentId: payload.conversationDocumentId ?? null,
    sourceId: payload.sourceId ?? null,
    sourceType: payload.sourceType ?? null,
    locator: payload.locator ?? null,
    mimeType: payload.mimeType ?? null,
    byteSize: payload.byteSize ?? null,
    width: payload.width ?? null,
    height: payload.height ?? null,
    providerTarget: overrides.providerTarget ?? payload.providerTarget ?? null,
    modelTarget: overrides.modelTarget ?? payload.modelTarget ?? null,
    state: overrides.state,
    exclusionReason: overrides.exclusionReason ?? null,
    runtimeSubreason: overrides.runtimeSubreason ?? null,
    detail: overrides.detail,
    requestFormat: overrides.requestFormat ?? null,
    budgetImpact: payload.budgetImpact ?? null,
    approvalState: payload.approvalState ?? null,
    traceId: overrides.traceId ?? payload.traceId ?? null,
    planId: overrides.planId ?? payload.planId ?? null,
    transportPayloadId: payload.transportPayloadId ?? null,
    noRawPayloadIncludedInTrace: true,
  };
}

function increment(target: Record<string, number>, key: string | null | undefined) {
  const normalized = key?.trim() || "unknown";
  target[normalized] = (target[normalized] ?? 0) + 1;
}

function unique(values: Array<string | null | undefined>) {
  return Array.from(new Set(values.map((value) => value?.trim()).filter((value): value is string => Boolean(value))));
}

function stringSelectorValue(value: string | null | undefined) {
  const normalized = value?.trim();
  return normalized ? normalized : null;
}

function traceLocatorRecord(trace: NativeRuntimePayloadTrace) {
  return trace.locator && typeof trace.locator === "object"
    ? trace.locator as Record<string, unknown>
    : null;
}

function numberValue(value: unknown) {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function tracePageNumber(trace: NativeRuntimePayloadTrace) {
  const locator = traceLocatorRecord(trace);
  if (!locator) return null;
  return (
    numberValue(locator.pageNumberStart) ??
    numberValue(locator.page) ??
    numberValue(locator.pageNumberEnd)
  );
}

function traceMatchesNativeRuntimeVerdictSelector(
  trace: NativeRuntimePayloadTrace,
  selector: NativeRuntimeTraceVerdictSelector | null | undefined
) {
  if (!selector) return true;

  const payloadId = stringSelectorValue(selector.payloadId);
  if (payloadId && trace.payloadId !== payloadId) return false;

  const payloadType = stringSelectorValue(selector.payloadType);
  if (payloadType && trace.payloadType !== payloadType) return false;

  const providerTarget = stringSelectorValue(selector.providerTarget);
  if (providerTarget && trace.providerTarget !== providerTarget) return false;

  const modelTarget = stringSelectorValue(selector.modelTarget);
  if (modelTarget && trace.modelTarget !== modelTarget) return false;

  const conversationDocumentId = stringSelectorValue(selector.conversationDocumentId);
  if (conversationDocumentId && trace.conversationDocumentId !== conversationDocumentId) return false;

  const sourceObservationId = stringSelectorValue(selector.sourceObservationId);
  if (sourceObservationId && trace.sourceObservationId !== sourceObservationId) return false;

  if (typeof selector.pageNumber === "number") {
    const locator = traceLocatorRecord(trace);
    const pageStart = numberValue(locator?.pageNumberStart);
    const pageEnd = numberValue(locator?.pageNumberEnd);
    const page = numberValue(locator?.page);
    const pageMatches =
      page === selector.pageNumber ||
      pageStart === selector.pageNumber ||
      pageEnd === selector.pageNumber ||
      (pageStart !== null && pageEnd !== null && pageStart <= selector.pageNumber && selector.pageNumber <= pageEnd);
    if (!pageMatches) return false;
  }

  return true;
}

function isTerminalExcludedNativeRuntimeTrace(trace: NativeRuntimePayloadTrace) {
  return (
    trace.state === "excluded" ||
    trace.state === "unsupported" ||
    trace.state === "runtime_missing" ||
    trace.state === "model_supported_runtime_missing" ||
    trace.state === "failed"
  );
}

function nativeRuntimeTraceVerdictFromTrace(
  status: NativeRuntimeTraceVerdictStatus,
  trace: NativeRuntimePayloadTrace | null,
  matchedTraceCount: number,
  unrelatedExcludedPayloads: NativeRuntimeTraceUnrelatedExcludedPayload[],
  detail?: string
): NativeRuntimeTraceVerdict {
  return {
    status,
    ...(trace
      ? {
          payloadId: trace.payloadId,
          payloadType: trace.payloadType,
          providerTarget: trace.providerTarget,
          modelTarget: trace.modelTarget,
          requestFormat: trace.requestFormat,
          conversationDocumentId: trace.conversationDocumentId,
          sourceObservationId: trace.sourceObservationId,
          pageNumber: tracePageNumber(trace),
          exclusionReason: trace.exclusionReason,
          runtimeSubreason: trace.runtimeSubreason,
          detail: detail ?? trace.detail,
        }
      : detail
        ? { detail }
        : {}),
    matchedTraceCount,
    unrelatedExcludedCount: unrelatedExcludedPayloads.length,
    unrelatedExcludedPayloads,
    noRawPayloadIncludedInTrace: true,
  };
}

export function buildNativeRuntimeTraceVerdict(params: {
  traces: NativeRuntimePayloadTrace[] | null | undefined;
  selector?: NativeRuntimeTraceVerdictSelector | null;
  maxUnrelatedExcludedPayloads?: number;
}): NativeRuntimeTraceVerdict {
  const traces = params.traces ?? [];
  const selector = params.selector ?? null;
  const matchingTraces = traces.filter((trace) =>
    traceMatchesNativeRuntimeVerdictSelector(trace, selector)
  );
  const unrelatedExcludedPayloads = traces
    .filter((trace) =>
      isTerminalExcludedNativeRuntimeTrace(trace) &&
      !traceMatchesNativeRuntimeVerdictSelector(trace, selector)
    )
    .slice(0, params.maxUnrelatedExcludedPayloads ?? 20)
    .map((trace) => ({
      payloadId: trace.payloadId,
      payloadType: trace.payloadType,
      providerTarget: trace.providerTarget,
      modelTarget: trace.modelTarget,
      conversationDocumentId: trace.conversationDocumentId,
      sourceObservationId: trace.sourceObservationId,
      pageNumber: tracePageNumber(trace),
      reason: trace.exclusionReason,
      subreason: trace.runtimeSubreason,
      detail: trace.detail,
    }));

  const included = matchingTraces.find((trace) => trace.state === "included");
  if (included) {
    return nativeRuntimeTraceVerdictFromTrace(
      "included",
      included,
      matchingTraces.length,
      unrelatedExcludedPayloads
    );
  }

  const terminalExcluded = matchingTraces.find(isTerminalExcludedNativeRuntimeTrace);
  if (terminalExcluded) {
    return nativeRuntimeTraceVerdictFromTrace(
      "selected_but_excluded",
      terminalExcluded,
      matchingTraces.length,
      unrelatedExcludedPayloads
    );
  }

  const selected = matchingTraces.find((trace) => trace.state === "selected");
  if (selected) {
    return nativeRuntimeTraceVerdictFromTrace(
      "selected_pending_runtime_trace",
      selected,
      matchingTraces.length,
      unrelatedExcludedPayloads
    );
  }

  const candidate = matchingTraces.find((trace) => trace.state === "candidate");
  if (candidate) {
    return nativeRuntimeTraceVerdictFromTrace(
      "unavailable",
      candidate,
      matchingTraces.length,
      unrelatedExcludedPayloads,
      "A matching native runtime payload candidate exists, but it was not selected for runtime handoff."
    );
  }

  return nativeRuntimeTraceVerdictFromTrace(
    traces.length === 0 ? "unavailable" : "no_candidate",
    null,
    0,
    unrelatedExcludedPayloads,
    traces.length === 0
      ? "No native runtime payload trace is available for this turn."
      : "No native runtime payload trace matched the requested payload/page selector."
  );
}

function extractRequestedPageNumber(prompt: string | null | undefined) {
  if (!prompt) return null;
  const match = prompt.match(/\bpage\s*(?:number\s*)?#?\s*(\d{1,4})\b/i);
  return match ? Number.parseInt(match[1], 10) : null;
}

function uniqueNonNull<T>(values: Array<T | null | undefined>) {
  return Array.from(new Set(values.filter((value): value is T => value !== null && value !== undefined)));
}

export function inferNativeRuntimeTraceVerdictSelector(params: {
  prompt?: string | null;
  traces?: NativeRuntimePayloadTrace[] | null;
  providerTarget?: string | null;
  modelTarget?: string | null;
}): NativeRuntimeTraceVerdictSelector | null {
  const pageNumber = extractRequestedPageNumber(params.prompt);
  const prompt = params.prompt?.toLowerCase() ?? "";
  const asksForRenderedPageImage =
    /\brendered\s+page\s+image\b/.test(prompt) ||
    /\bnative\s+image\s+payload\b/.test(prompt) ||
    /\bpage\s+image\b/.test(prompt);
  const payloadType = pageNumber !== null && asksForRenderedPageImage ? "rendered_page_image" : null;

  const selector: NativeRuntimeTraceVerdictSelector = {
    providerTarget: stringSelectorValue(params.providerTarget),
    modelTarget: stringSelectorValue(params.modelTarget),
    pageNumber,
    payloadType,
  };

  if (pageNumber !== null && payloadType) {
    const matchingTraces = (params.traces ?? []).filter((trace) =>
      traceMatchesNativeRuntimeVerdictSelector(trace, selector)
    );
    const documentIds = uniqueNonNull(matchingTraces.map((trace) => trace.conversationDocumentId));
    if (documentIds.length === 1) selector.conversationDocumentId = documentIds[0];
    const sourceObservationIds = uniqueNonNull(matchingTraces.map((trace) => trace.sourceObservationId));
    if (sourceObservationIds.length === 1) selector.sourceObservationId = sourceObservationIds[0];
  }

  const hasSelector = Object.values(selector).some((value) => value !== null && value !== undefined);
  return hasSelector ? selector : null;
}

export function summarizeNativeRuntimePayloadTraces(
  traces: NativeRuntimePayloadTrace[]
): NativeRuntimeLaneSummary {
  const includedByKind: Record<string, number> = {};
  const excludedByReason: Record<string, number> = {};
  const excludedBySubreason: Record<string, number> = {};
  const included = traces.filter((trace) => trace.state === "included");
  const candidates = traces.filter((trace) => trace.state === "candidate");
  const selected = traces.filter((trace) => trace.state === "selected");
  const selectedPayloadIds = new Set(selected.map((trace) => trace.payloadId));
  const selectedThenIncluded = included.filter((trace) => selectedPayloadIds.has(trace.payloadId));
  const excluded = traces.filter((trace) =>
    trace.state === "excluded" ||
    trace.state === "unsupported" ||
    trace.state === "runtime_missing" ||
    trace.state === "model_supported_runtime_missing" ||
    trace.state === "failed"
  );
  const selectedThenExcluded = excluded.filter((trace) => selectedPayloadIds.has(trace.payloadId));

  for (const trace of included) increment(includedByKind, trace.kind);
  for (const trace of excluded) increment(excludedByReason, trace.exclusionReason ?? trace.state);
  for (const trace of excluded) increment(excludedBySubreason, trace.runtimeSubreason);
  const excludedReasonLabels = Object.entries(excludedByReason).map(([reason, count]) => `${reason}:${count}`);
  const excludedSubreasonLabels = Object.entries(excludedBySubreason).map(([reason, count]) => `${reason}:${count}`);
  const selectedExcludedByReason: Record<string, number> = {};
  const selectedExcludedBySubreason: Record<string, number> = {};
  for (const trace of selectedThenExcluded) increment(selectedExcludedByReason, trace.exclusionReason ?? trace.state);
  for (const trace of selectedThenExcluded) increment(selectedExcludedBySubreason, trace.runtimeSubreason);
  const selectedExcludedReasonLabels = Object.entries(selectedExcludedByReason).map(([reason, count]) => `${reason}:${count}`);
  const selectedExcludedSubreasonLabels = Object.entries(selectedExcludedBySubreason).map(([reason, count]) => `${reason}:${count}`);
  const diagnosticState: NativeRuntimeLaneSummary["diagnosticState"] =
    included.length > 0
      ? "included"
      : candidates.length === 0
        ? "no_candidate"
        : selected.length === 0
          ? "candidate_not_selected"
          : selectedThenExcluded.length > 0
            ? "selected_but_excluded"
            : "selected_pending_runtime_trace";
  const diagnosticReasons =
    diagnosticState === "included"
      ? included.map((trace) =>
          `included:${trace.payloadId}:${trace.providerTarget ?? "unknown_provider"}:${trace.requestFormat ?? "unknown_request"}`
        )
      : diagnosticState === "no_candidate"
        ? ["no_candidate: no native runtime payload candidate reached adaptive transport"]
        : diagnosticState === "candidate_not_selected"
          ? [
              excludedReasonLabels.length > 0
                ? `candidate_not_selected: ${excludedReasonLabels.join(", ")}${excludedSubreasonLabels.length > 0 ? `; subreason ${excludedSubreasonLabels.join(", ")}` : ""}`
                : "candidate_not_selected: candidate did not survive adaptive transport selection",
            ]
          : diagnosticState === "selected_but_excluded"
            ? [
                selectedExcludedReasonLabels.length > 0
                  ? `selected_but_excluded: ${selectedExcludedReasonLabels.join(", ")}${selectedExcludedSubreasonLabels.length > 0 ? `; subreason ${selectedExcludedSubreasonLabels.join(", ")}` : ""}`
                  : "selected_but_excluded: selected payload did not reach included runtime evidence",
              ]
            : [
                "selected_pending_runtime_trace: selected native payload is being handed to the main-model runtime; inclusion must be proven by request-construction trace",
              ];

  return {
    candidateCount: candidates.length,
    selectedCount: selected.length,
    includedCount: included.length,
    excludedCount: excluded.length,
    selectedThenIncludedCount: selectedThenIncluded.length,
    selectedThenExcludedCount: selectedThenExcluded.length,
    diagnosticState,
    diagnosticReasons,
    includedByKind,
    excludedByReason,
    excludedBySubreason,
    runtimeMissingCount: traces.filter((trace) => trace.state === "runtime_missing").length,
    modelSupportedRuntimeMissingCount: traces.filter((trace) => trace.state === "model_supported_runtime_missing").length,
    missingInputCount: traces.filter((trace) => trace.exclusionReason === "missing_input").length,
    overBudgetCount: traces.filter((trace) => trace.exclusionReason === "over_budget").length,
    approvalOrPolicyBlockedCount: traces.filter((trace) =>
      trace.exclusionReason === "approval_required" || trace.exclusionReason === "policy_blocked"
    ).length,
    approvalConsumedAsGovernanceInputCount: traces.filter((trace) =>
      trace.approvalState === "satisfied" || trace.approvalState === "not_required"
    ).length,
    providerTargets: unique(traces.map((trace) => trace.providerTarget)),
    modelTargets: unique(traces.map((trace) => trace.modelTarget)),
    sourceAttributions: traces.map((trace) => ({
      payloadId: trace.payloadId,
      sourceObservationId: trace.sourceObservationId,
      conversationDocumentId: trace.conversationDocumentId,
      sourceId: trace.sourceId,
      pageNumberStart:
        typeof trace.locator?.pageNumberStart === "number" ? trace.locator.pageNumberStart : null,
      pageNumberEnd:
        typeof trace.locator?.pageNumberEnd === "number" ? trace.locator.pageNumberEnd : null,
      sourceLocationLabel:
        typeof trace.locator?.sourceLocationLabel === "string" ? trace.locator.sourceLocationLabel : null,
    })),
    noExecutionWarnings:
      included.length > 0
        ? []
        : diagnosticReasons,
    noRawPayloadIncludedInTrace: true,
  };
}

const TERMINAL_NATIVE_RUNTIME_STATES = new Set<NativeRuntimePayloadInclusionState>([
  "included",
  "excluded",
  "unsupported",
  "runtime_missing",
  "model_supported_runtime_missing",
  "failed",
]);

export function finalizeNativeRuntimePayloadTracesAfterRequest(
  traces: NativeRuntimePayloadTrace[],
  options: {
    runtimeReceivedPayloadIds?: string[] | null;
    providerTarget?: string | null;
    modelTarget?: string | null;
    requestFormat?: string | null;
    exclusionReason?: NativeRuntimePayloadExclusionReason;
    runtimeSubreason?: NativeRuntimePayloadRuntimeSubreason;
    detail?: string;
  } = {}
) {
  const terminalPayloadIds = new Set(
    traces
      .filter((trace) => TERMINAL_NATIVE_RUNTIME_STATES.has(trace.state))
      .map((trace) => trace.payloadId)
  );
  const receivedPayloadIds = new Set(
    (options.runtimeReceivedPayloadIds ?? [])
      .map((payloadId) => payloadId?.trim())
      .filter((payloadId): payloadId is string => Boolean(payloadId))
  );
  const finalized: NativeRuntimePayloadTrace[] = [...traces];
  const selected = traces.filter((trace) => trace.state === "selected");

  for (const trace of selected) {
    if (terminalPayloadIds.has(trace.payloadId)) continue;
    if (receivedPayloadIds.size > 0 && !receivedPayloadIds.has(trace.payloadId)) continue;
    finalized.push({
      ...trace,
      providerTarget: options.providerTarget ?? trace.providerTarget,
      modelTarget: options.modelTarget ?? trace.modelTarget,
      state: "failed",
      exclusionReason: options.exclusionReason ?? "runtime_trace_missing_after_request",
      runtimeSubreason: options.runtimeSubreason ?? "runtime_trace_missing_after_request",
      detail:
        options.detail ??
        "Selected native payload reached the main-model runtime handoff, but no included or final exclusion trace was returned after request handling.",
      requestFormat: options.requestFormat ?? trace.requestFormat,
      noRawPayloadIncludedInTrace: true,
    });
  }

  return finalized;
}
