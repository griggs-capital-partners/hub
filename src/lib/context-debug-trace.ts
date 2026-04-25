import { estimateTextTokens } from "./context-token-budget";
import type {
  ContextBudgetProfile,
  ContextChunkSelection,
  ContextCrossReference,
  ContextDebugChunk,
  ContextDebugDocument,
  ContextDebugTrace,
  ContextLocation,
  ContextSelectionReason,
  ContextSourceEligibility,
  ContextSourceType,
} from "./context-seams";
import type {
  ConversationContextBundle,
  ConversationContextDocumentChunkingDocument,
  ConversationContextSourceAuthority,
  ConversationContextSourceDecision,
} from "./conversation-context";

type BuildConversationContextDebugTraceParams = {
  conversationId: string;
  authority: ConversationContextSourceAuthority;
  currentUserPrompt?: string | null;
  bundle: Pick<
    ConversationContextBundle,
    "text" | "sourceSelection" | "sourceDecisions" | "documentChunking"
  >;
};

function normalizeContextSourceType(value: string | null | undefined): ContextSourceType | string {
  switch (value) {
    case "thread_documents":
    case "thread-document":
      return "thread_document";
    case "company_documents":
      return "company_document";
    case "text":
    case "markdown":
    case "pdf":
    case "docx":
    case "pptx":
    case "spreadsheet":
    case "email":
    case "web":
    case "browser":
    case "memory":
    case "live_data":
    case "time_series":
    case "document":
    case "presentation":
      return value;
    case "browsing":
      return "browser";
    default:
      return value?.trim() ? value : "generic";
  }
}

function buildDocumentId(document: ConversationContextDocumentChunkingDocument) {
  return document.attachmentId || document.fileId || document.sourceId;
}

function buildChunkId(document: ConversationContextDocumentChunkingDocument, chunkIndex: number) {
  return `${document.sourceId}:${chunkIndex}`;
}

function hasLegalStructure(sectionPath: string[]) {
  return sectionPath.some((entry) => /^(article|section|subsection|clause|exhibit|schedule)\b/i.test(entry));
}

function buildArticlePath(sectionPath: string[]) {
  const articlePath = sectionPath.filter((entry) => /^(article|section|subsection|clause)\b/i.test(entry));
  return articlePath.length > 0 ? articlePath : undefined;
}

function buildSourceBodyLocation(params: {
  document: ConversationContextDocumentChunkingDocument;
  chunk: ConversationContextDocumentChunkingDocument["chunkCharRanges"][number];
}): ContextLocation {
  const normalizedSourceType = normalizeContextSourceType(params.document.sourceType);
  const sectionPath = params.chunk.sectionPath.filter(Boolean);
  const shared = {
    sourceId: params.document.sourceId,
    sourceType: normalizedSourceType,
    filename: params.document.filename,
    title: params.document.filename,
    sectionPath,
    articlePath: buildArticlePath(sectionPath),
    slideNumber: params.chunk.slideNumber,
    slideTitle: params.chunk.sectionLabel,
    sheetName: params.chunk.sheetName,
    label: params.chunk.sourceBodyLocationLabel,
  };

  if (params.chunk.sheetName || normalizedSourceType === "spreadsheet") {
    return {
      kind: "spreadsheet_range_location",
      ...shared,
    };
  }

  if (params.chunk.slideNumber !== null || normalizedSourceType === "pptx" || normalizedSourceType === "presentation") {
    return {
      kind: "slide_location",
      ...shared,
    };
  }

  if (hasLegalStructure(sectionPath)) {
    return {
      kind: "legal_section_location",
      ...shared,
    };
  }

  if (normalizedSourceType === "web" || normalizedSourceType === "browser") {
    return {
      kind: "web_location",
      ...shared,
    };
  }

  if (normalizedSourceType === "email") {
    return {
      kind: "email_message_location",
      ...shared,
    };
  }

  if (normalizedSourceType === "time_series" || normalizedSourceType === "live_data") {
    return {
      kind: "time_series_location",
      ...shared,
    };
  }

  if (
    normalizedSourceType === "thread_document" ||
    normalizedSourceType === "company_document" ||
    normalizedSourceType === "document" ||
    normalizedSourceType === "text" ||
    normalizedSourceType === "markdown" ||
    normalizedSourceType === "pdf" ||
    normalizedSourceType === "docx"
  ) {
    return {
      kind: "document_location",
      ...shared,
    };
  }

  return {
    kind: "generic_location",
    ...shared,
  };
}

function buildReferencedLocation(params: {
  document: ConversationContextDocumentChunkingDocument;
  label: string;
}): ContextLocation {
  const normalizedSourceType = normalizeContextSourceType(params.document.sourceType);
  const shared = {
    sourceId: params.document.sourceId,
    sourceType: normalizedSourceType,
    filename: params.document.filename,
    title: params.document.filename,
    label: params.label,
  };

  if (/^(article|section|subsection|clause|exhibit|schedule)\b/i.test(params.label)) {
    return {
      kind: "legal_section_location",
      ...shared,
      sectionPath: [params.label],
      articlePath: buildArticlePath([params.label]),
    };
  }

  if (normalizedSourceType === "spreadsheet") {
    return {
      kind: "spreadsheet_range_location",
      ...shared,
    };
  }

  if (normalizedSourceType === "pptx" || normalizedSourceType === "presentation") {
    return {
      kind: "slide_location",
      ...shared,
    };
  }

  if (normalizedSourceType === "web" || normalizedSourceType === "browser") {
    return {
      kind: "web_location",
      ...shared,
    };
  }

  if (normalizedSourceType === "email") {
    return {
      kind: "email_message_location",
      ...shared,
    };
  }

  if (normalizedSourceType === "time_series" || normalizedSourceType === "live_data") {
    return {
      kind: "time_series_location",
      ...shared,
    };
  }

  return {
    kind: "generic_location",
    ...shared,
  };
}

function buildCrossReferences(params: {
  document: ConversationContextDocumentChunkingDocument;
  chunk: ConversationContextDocumentChunkingDocument["chunkCharRanges"][number];
  sourceBodyLocation: ContextLocation;
}): ContextCrossReference[] {
  return params.chunk.referencedLocationLabels
    .filter((label): label is string => typeof label === "string" && label.trim().length > 0)
    .map((label, index) => ({
      id: `${buildChunkId(params.document, params.chunk.chunkIndex)}:xref:${index}`,
      relation: "references",
      label,
      sourceBodyLocation: params.sourceBodyLocation,
      targetLocation: buildReferencedLocation({
        document: params.document,
        label,
      }),
      resolved: false,
      detail: "Current A-03 debug output preserves the referenced label separately from the chunk body location.",
    }));
}

function buildSelectedChunkSelection(params: {
  document: ConversationContextDocumentChunkingDocument;
  chunk: ConversationContextDocumentChunkingDocument["chunkCharRanges"][number];
}): ContextChunkSelection {
  if (params.chunk.selectedDueToCoverage) {
    return {
      disposition: "selected",
      reason: "coverage",
      detail: params.chunk.coverageGroupKey
        ? `Selected to preserve coverage for ${params.chunk.coverageGroupKey}.`
        : "Selected to preserve coverage across the source-native structure.",
      selectedDueToCoverage: true,
    };
  }

  if (params.document.selectionMode === "document-order") {
    return {
      disposition: "selected",
      reason: "document_order",
      detail: params.document.usedBudgetClamp
        ? "Selected in document order before the current thread-document budget was exhausted."
        : "Selected in document order.",
      selectedDueToCoverage: false,
    };
  }

  return {
    disposition: "selected",
    reason: "high_rank",
    detail: params.document.rankingEnabled
      ? "Selected from the current ranked chunk list."
      : "Selected by the current resolver output.",
    selectedDueToCoverage: false,
  };
}

function buildSkippedChunkSelection(params: {
  document: ConversationContextDocumentChunkingDocument;
  chunkIndex: number;
}): ContextChunkSelection {
  let reason: ContextSelectionReason = "low_relevance";
  let detail =
    "Current A-03 debug output does not emit a per-chunk skip reason, so this entry reflects the best matching resolver-level explanation.";

  if (params.document.occurrence.skippedDueToBudgetChunkIndexes.includes(params.chunkIndex)) {
    reason = "budget_exhausted";
    detail = "Skipped after the current thread-document chunk budget was exhausted.";
  } else
  if (params.document.parentSourceStatus === "unsupported") {
    reason = "not_supported";
    detail = "This source was unsupported in the current resolver path.";
  } else if (
    params.document.parentSourceStatus === "unavailable" &&
    params.document.extractionStatus === "extracted"
  ) {
    reason = "budget_exhausted";
    detail = "The document was extracted, but the current thread-document budget prevented it from being included.";
  } else if (params.document.parentSourceStatus === "unavailable") {
    reason = "not_available";
    detail = "This source was unavailable to the current resolver path.";
  } else if (params.document.usedBudgetClamp) {
    reason = "budget_exhausted";
    detail = "Skipped after the current thread-document budget clamp was applied.";
  } else if (params.document.rankingEnabled) {
    reason = "low_relevance";
    detail = "Skipped after the current deterministic ranking pass.";
  }

  return {
    disposition: "skipped",
    reason,
    detail,
    selectedDueToCoverage: false,
  };
}

function buildSourceEligibility(sourceDecision: ConversationContextSourceDecision): ContextSourceEligibility {
  return {
    sourceId: sourceDecision.sourceId,
    sourceType: normalizeContextSourceType(sourceDecision.sourceId),
    label: sourceDecision.label,
    domain: sourceDecision.domain,
    scope: sourceDecision.scope,
    policyMode: sourceDecision.policyMode,
    requestStatus: sourceDecision.request.status,
    executionStatus: sourceDecision.execution.status,
    isRegistered: sourceDecision.eligibility.isRegistered,
    isInScope: sourceDecision.eligibility.isInScope,
    isAvailable: sourceDecision.eligibility.isAvailable,
    isRequestingUserAllowed: sourceDecision.eligibility.isRequestingUserAllowed,
    isActiveAgentAllowed: sourceDecision.eligibility.isActiveAgentAllowed,
    isImplemented: sourceDecision.eligibility.isImplemented,
    decision: sourceDecision.admission.status,
    reason: sourceDecision.reason,
    detail: sourceDecision.detail,
  };
}

function buildDebugDocument(document: ConversationContextDocumentChunkingDocument): ContextDebugDocument {
  return {
    documentId: buildDocumentId(document),
    sourceId: document.sourceId,
    sourceType: normalizeContextSourceType(document.sourceType),
    title: document.filename,
    sourceStatus: document.parentSourceStatus,
    extractionStatus: document.extractionStatus,
    totalChunks: document.totalChunks,
    selectedChunkIds: document.selectedChunkIndexes.map((chunkIndex) => buildChunkId(document, chunkIndex)),
    skippedChunkIds: document.skippedChunkIndexes.map((chunkIndex) => buildChunkId(document, chunkIndex)),
    selectedTokenEstimate: document.selectedApproxTokenCount,
    totalTokenEstimate: document.totalApproxTokenCount,
    selectedCharCount: document.selectedCharCount,
    totalCharCount: document.totalCharCount,
    documentBudgetTokens: document.documentBudgetTokens,
    skippedDueToBudgetCount: document.skippedDueToBudgetCount,
    selectionMode: document.selectionMode,
    selectionBudgetKind: document.selectionBudgetKind,
    usedBudgetClamp: document.usedBudgetClamp,
    coverageSelectionApplied: document.coverageSelectionApplied,
    ranking: {
      enabled: document.rankingEnabled,
      strategy: document.rankingStrategy,
      queryTokenCount: document.rankingQueryTokenCount,
      fallbackReason: document.rankingFallbackReason,
      occurrenceIntentDetected: document.occurrenceIntentDetected,
      occurrenceTargetPhrase: document.occurrenceTargetPhrase,
    },
    occurrence: {
      searchStatus: document.occurrence.searchStatus,
      targetPhrase: document.occurrence.targetPhrase,
      scannedChunkCount: document.occurrence.scannedChunkCount,
      exactMatchChunkCount: document.occurrence.exactMatchChunkCount,
      exactMatchLocationCount: document.occurrence.exactMatchLocationCount,
      locations: document.occurrence.locations.map((location) => ({
        chunkId: buildChunkId(document, location.chunkIndex),
        chunkIndex: location.chunkIndex,
        label: location.sourceBodyLocationLabel,
        exactPhraseMatchCount: location.exactPhraseMatchCount,
        coverageGroupKey: location.coverageGroupKey,
        referencedLocationLabels: [...location.referencedLocationLabels],
      })),
      selectedRepresentativeChunkIds: document.occurrence.selectedRepresentativeChunkIndexes.map(
        (chunkIndex) => buildChunkId(document, chunkIndex)
      ),
      skippedDueToBudgetChunkIds: document.occurrence.skippedDueToBudgetChunkIndexes.map(
        (chunkIndex) => buildChunkId(document, chunkIndex)
      ),
      detail: document.occurrence.detail,
    },
  };
}

function buildDebugChunk(params: {
  document: ConversationContextDocumentChunkingDocument;
  chunk: ConversationContextDocumentChunkingDocument["chunkCharRanges"][number];
}): ContextDebugChunk {
  const selectedIndexes = new Set(params.document.selectedChunkIndexes);
  const sourceBodyLocation = buildSourceBodyLocation(params);
  const referencedLocations = buildCrossReferences({
    document: params.document,
    chunk: params.chunk,
    sourceBodyLocation,
  });

  return {
    id: buildChunkId(params.document, params.chunk.chunkIndex),
    sourceId: params.document.sourceId,
    documentId: buildDocumentId(params.document),
    sourceType: normalizeContextSourceType(params.document.sourceType),
    sourceStatus: params.document.parentSourceStatus,
    title: params.document.filename,
    chunkIndex: params.chunk.chunkIndex,
    tokenEstimate: params.chunk.approxTokenCount,
    charRange: {
      start: params.chunk.charStart,
      end: params.chunk.charEnd,
    },
    textPreview: params.chunk.textPreview,
    metadata: {
      filename: params.document.filename,
      sectionLabel: params.chunk.sectionLabel,
      sectionPath: params.chunk.sectionPath,
      sourceBodyLocationLabel: params.chunk.sourceBodyLocationLabel,
      referencedLocationLabels: params.chunk.referencedLocationLabels,
      sheetName: params.chunk.sheetName,
      slideNumber: params.chunk.slideNumber,
      selectionMode: params.document.selectionMode,
      selectedDueToCoverage: params.chunk.selectedDueToCoverage,
      coverageGroupKey: params.chunk.coverageGroupKey,
    },
    provenance: {
      sourceId: params.document.sourceId,
      sourceType: normalizeContextSourceType(params.document.sourceType),
      displayLabel: params.document.filename,
      sourceBodyLocation,
      referencedLocations,
      safeCitationLabel: params.chunk.safeProvenanceLabel,
    },
    selection: selectedIndexes.has(params.chunk.chunkIndex)
      ? buildSelectedChunkSelection(params)
      : buildSkippedChunkSelection({ document: params.document, chunkIndex: params.chunk.chunkIndex }),
    ranking: {
      strategy: params.document.rankingStrategy,
      score: params.chunk.rankingScore,
      order: params.chunk.rankingOrder,
      signals: params.chunk.rankingSignals,
      fallbackReason: params.document.rankingFallbackReason,
      exactPhraseMatchCount: params.chunk.exactPhraseMatchCount,
      definitionBoostApplied: params.chunk.definitionBoostApplied,
      coverageGroupKey: params.chunk.coverageGroupKey,
    },
  };
}

function buildBudgetProfile(
  documentChunking: ConversationContextBundle["documentChunking"]
): ContextBudgetProfile | null {
  if (!documentChunking.budget.budgetInputProvided) {
    return null;
  }

  return {
    id: documentChunking.budget.modelProfileId,
    label: documentChunking.budget.modelProfileId,
    mode: documentChunking.budget.mode,
    modelProfileId: documentChunking.budget.modelProfileId,
    model: documentChunking.budget.model,
    provider: documentChunking.budget.provider,
    protocol: documentChunking.budget.protocol,
    documentContextBudgetTokens: documentChunking.budget.documentContextBudgetTokens,
    fallbackProfileUsed: documentChunking.budget.fallbackProfileUsed,
  };
}

function buildOccurrenceTrace(
  documentChunking: ConversationContextBundle["documentChunking"]
): ContextDebugTrace["occurrence"] {
  if (!documentChunking.occurrence) {
    return null;
  }

  return {
    intentDetected: documentChunking.occurrence.intentDetected,
    targetPhrase: documentChunking.occurrence.targetPhrase,
    scannedChunkCount: documentChunking.occurrence.scannedChunkCount,
    exactMatchChunkCount: documentChunking.occurrence.exactMatchChunkCount,
    exactMatchLocationCount: documentChunking.occurrence.exactMatchLocationCount,
    searchableDocumentIds: [...documentChunking.occurrence.searchableDocumentIds],
    unsearchableDocuments: documentChunking.occurrence.unsearchableDocuments.map((document) => ({
      documentId: document.sourceId,
      sourceId: document.sourceId,
      title: document.filename,
      sourceStatus: document.sourceStatus,
      detail: document.detail,
    })),
    detail: documentChunking.occurrence.detail,
  };
}

function buildInspectorParityKey(params: {
  conversationId: string;
  requestMode: string;
  requestedSourceIds: string[];
  selectedChunkIds: string[];
  skippedChunkIds: string[];
  estimatedTokens: number;
  documentStrategy: string;
}) {
  return [
    params.conversationId,
    params.requestMode,
    params.documentStrategy,
    `requested=${params.requestedSourceIds.join(",")}`,
    `selected=${params.selectedChunkIds.join(",")}`,
    `skipped=${params.skippedChunkIds.join(",")}`,
    `tokens=${params.estimatedTokens}`,
  ].join("|");
}

export function buildConversationContextDebugTrace(
  params: BuildConversationContextDebugTraceParams
): ContextDebugTrace {
  const documents = params.bundle.documentChunking.documents.map(buildDebugDocument);
  const chunks = params.bundle.documentChunking.documents.flatMap((document) =>
    document.chunkCharRanges.map((chunk) =>
      buildDebugChunk({
        document,
        chunk,
      })
    )
  );
  const selectedChunkIds = params.bundle.documentChunking.documents.flatMap((document) =>
    document.selectedChunkIndexes.map((chunkIndex) => buildChunkId(document, chunkIndex))
  );
  const skippedChunkIds = params.bundle.documentChunking.documents.flatMap((document) =>
    document.skippedChunkIndexes.map((chunkIndex) => buildChunkId(document, chunkIndex))
  );
  const renderedContextEstimatedTokens = estimateTextTokens(params.bundle.text);
  const inspectorParityKey = buildInspectorParityKey({
    conversationId: params.conversationId,
    requestMode: params.bundle.sourceSelection.requestMode,
    requestedSourceIds: params.bundle.sourceSelection.requestedSourceIds,
    selectedChunkIds,
    skippedChunkIds,
    estimatedTokens: renderedContextEstimatedTokens,
    documentStrategy: params.bundle.documentChunking.strategy,
  });

  return {
    traceId: `${params.conversationId}:context-debug-trace`,
    conversationId: params.conversationId,
    requestMode: params.bundle.sourceSelection.requestMode,
    requestedSourceIds: params.bundle.sourceSelection.requestedSourceIds,
    authority: {
      requestingUserId: params.authority.requestingUserId,
      activeUserIds: [...params.authority.activeUserIds],
      activeAgentId: params.authority.activeAgentId,
      activeAgentIds: [...params.authority.activeAgentIds],
    },
    budgetProfile: buildBudgetProfile(params.bundle.documentChunking),
    sourceEligibility: params.bundle.sourceDecisions.map(buildSourceEligibility),
    documents,
    chunks,
    occurrence: buildOccurrenceTrace(params.bundle.documentChunking),
    retrieval: params.bundle.sourceDecisions
      .filter((sourceDecision) => sourceDecision.execution.status === "executed")
      .map((sourceDecision) => ({
      adapterId: `${sourceDecision.sourceId}-debug-bridge`,
      sourceId: sourceDecision.sourceId,
      sourceType: normalizeContextSourceType(sourceDecision.sourceId),
      sourceStatus: sourceDecision.status,
      query: params.currentUserPrompt ?? null,
      selectedChunkIds:
        sourceDecision.sourceId === "thread_documents" ? selectedChunkIds : [],
      skippedChunkIds:
        sourceDecision.sourceId === "thread_documents" ? skippedChunkIds : [],
      reranker:
        sourceDecision.sourceId === "thread_documents" &&
        params.bundle.documentChunking.documents.some((document) => document.rankingEnabled)
          ? "deterministic-query-overlap-v1"
          : null,
      detail: sourceDecision.execution.detail,
    })),
    assembly: {
      selectedChunkIds,
      skippedChunkIds,
      estimatedTokens: renderedContextEstimatedTokens,
      estimatedSelectedTokens: documents.reduce(
        (sum, document) => sum + (document.selectedTokenEstimate ?? 0),
        0
      ),
      documentChunkBudgetTokens: params.bundle.documentChunking.budget.budgetInputProvided
        ? params.bundle.documentChunking.budget.documentContextBudgetTokens
        : null,
      skippedDueToBudgetCount: params.bundle.documentChunking.budget.skippedDueToBudgetCount,
      budgetMode: params.bundle.documentChunking.budget.budgetInputProvided
        ? params.bundle.documentChunking.budget.mode
        : null,
      modelProfileId: params.bundle.documentChunking.budget.budgetInputProvided
        ? params.bundle.documentChunking.budget.modelProfileId
        : null,
      fallbackProfileUsed: params.bundle.documentChunking.budget.budgetInputProvided
        ? params.bundle.documentChunking.budget.fallbackProfileUsed
        : null,
      detail: params.bundle.documentChunking.budget.detail,
    },
    renderedContext: {
      text: null,
      safeTextPreview: null,
      estimatedTokens: renderedContextEstimatedTokens,
      inspectorParityKey,
    },
    inspectorParity: {
      payloadMatchesRenderedContext: true,
      detail:
        "This trace is derived from the same resolver-owned bundle used for Inspector/runtime preview, without a parallel retrieval path.",
    },
  };
}
