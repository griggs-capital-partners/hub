import {
  summarizeNativeRuntimePayloadTraces,
  type NativeRuntimePayloadTrace,
} from "./native-runtime-payloads";

const TOOL_CONTEXT_RUNTIME_TRACE_VERSION = "agent-message-runtime-v1";

type TraceRecord = Record<string, unknown>;

export type ChatMessageRuntimeTraceEnvelope = {
  version: typeof TOOL_CONTEXT_RUNTIME_TRACE_VERSION;
  messages: unknown[];
  nativeRuntimePayloadTrace: NativeRuntimePayloadTrace[];
  nativeRuntimeLaneSummary: ReturnType<typeof summarizeNativeRuntimePayloadTraces>;
};

function asRecord(value: unknown): TraceRecord | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  return value as TraceRecord;
}

function stringValue(value: unknown) {
  return typeof value === "string" ? value : null;
}

function numberValue(value: unknown) {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function booleanTrue(value: unknown): true {
  return value === true ? true : true;
}

function sanitizeBudgetImpact(value: unknown): NativeRuntimePayloadTrace["budgetImpact"] {
  const record = asRecord(value);
  if (!record) return null;
  return {
    tokenEstimate: numberValue(record.tokenEstimate),
    byteSize: numberValue(record.byteSize),
    imageCount: numberValue(record.imageCount),
  };
}

export function sanitizeNativeRuntimePayloadTrace(value: unknown): NativeRuntimePayloadTrace | null {
  const record = asRecord(value);
  if (!record) return null;
  const payloadId = stringValue(record.payloadId);
  const payloadType = stringValue(record.payloadType);
  const kind = stringValue(record.kind);
  const state = stringValue(record.state);
  const detail = stringValue(record.detail);
  if (!payloadId || !payloadType || !kind || !state || !detail) return null;
  const locator = asRecord(record.locator);
  return {
    payloadId,
    payloadType,
    kind: kind as NativeRuntimePayloadTrace["kind"],
    sourceObservationId: stringValue(record.sourceObservationId),
    conversationDocumentId: stringValue(record.conversationDocumentId),
    sourceId: stringValue(record.sourceId),
    sourceType: stringValue(record.sourceType),
    locator: locator
      ? {
          pageNumberStart: numberValue(locator.pageNumberStart),
          pageNumberEnd: numberValue(locator.pageNumberEnd),
          pageLabelStart: stringValue(locator.pageLabelStart),
          pageLabelEnd: stringValue(locator.pageLabelEnd),
          tableId: stringValue(locator.tableId),
          figureId: stringValue(locator.figureId),
          sourceLocationLabel: stringValue(locator.sourceLocationLabel),
          cropId: stringValue(locator.cropId),
        }
      : null,
    mimeType: stringValue(record.mimeType),
    byteSize: numberValue(record.byteSize),
    width: numberValue(record.width),
    height: numberValue(record.height),
    providerTarget: stringValue(record.providerTarget),
    modelTarget: stringValue(record.modelTarget),
    state: state as NativeRuntimePayloadTrace["state"],
    exclusionReason: stringValue(record.exclusionReason) as NativeRuntimePayloadTrace["exclusionReason"],
    runtimeSubreason: stringValue(record.runtimeSubreason) as NativeRuntimePayloadTrace["runtimeSubreason"],
    detail,
    requestFormat: stringValue(record.requestFormat),
    budgetImpact: sanitizeBudgetImpact(record.budgetImpact),
    approvalState: stringValue(record.approvalState) as NativeRuntimePayloadTrace["approvalState"],
    traceId: stringValue(record.traceId),
    planId: stringValue(record.planId),
    transportPayloadId: stringValue(record.transportPayloadId),
    noRawPayloadIncludedInTrace: booleanTrue(record.noRawPayloadIncludedInTrace),
  };
}

export function parseChatMessageRuntimeTraceEnvelope(raw: string | null | undefined): {
  messages: unknown[];
  nativeRuntimePayloadTrace: NativeRuntimePayloadTrace[];
} {
  if (!raw) return { messages: [], nativeRuntimePayloadTrace: [] };
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (Array.isArray(parsed)) {
      return { messages: parsed, nativeRuntimePayloadTrace: [] };
    }
    const record = asRecord(parsed);
    if (!record || record.version !== TOOL_CONTEXT_RUNTIME_TRACE_VERSION) {
      return { messages: [], nativeRuntimePayloadTrace: [] };
    }
    const messages = Array.isArray(record.messages) ? record.messages : [];
    const traces = Array.isArray(record.nativeRuntimePayloadTrace)
      ? record.nativeRuntimePayloadTrace
          .map(sanitizeNativeRuntimePayloadTrace)
          .filter((trace): trace is NativeRuntimePayloadTrace => Boolean(trace))
      : [];
    return { messages, nativeRuntimePayloadTrace: traces };
  } catch {
    return { messages: [], nativeRuntimePayloadTrace: [] };
  }
}

export function buildChatMessageRuntimeTraceEnvelope(params: {
  messages?: unknown[] | null;
  nativeRuntimePayloadTrace?: NativeRuntimePayloadTrace[] | null;
}) {
  const traces = (params.nativeRuntimePayloadTrace ?? [])
    .map(sanitizeNativeRuntimePayloadTrace)
    .filter((trace): trace is NativeRuntimePayloadTrace => Boolean(trace));
  const messages = params.messages ?? [];
  if (messages.length === 0 && traces.length === 0) return undefined;
  if (traces.length === 0) return JSON.stringify(messages);
  const envelope: ChatMessageRuntimeTraceEnvelope = {
    version: TOOL_CONTEXT_RUNTIME_TRACE_VERSION,
    messages,
    nativeRuntimePayloadTrace: traces,
    nativeRuntimeLaneSummary: summarizeNativeRuntimePayloadTraces(traces),
  };
  return JSON.stringify(envelope);
}
