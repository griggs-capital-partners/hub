import { DEFAULT_APPROX_CHARS_PER_TOKEN, estimateTextTokens } from "./context-token-budget";
import { joinMarkdownSections } from "./context-formatting";

export type ContextDocumentChunkSourceType =
  | "text"
  | "markdown"
  | "pdf"
  | "docx"
  | "pptx"
  | "spreadsheet";

export type ContextDocumentChunkExtractionStatus = "extracted";

export type ContextDocumentChunkParentStatus = "used" | "unsupported" | "failed" | "unavailable";

export type ContextDocumentChunk = {
  sourceId: string;
  attachmentId: string;
  fileId: string;
  sourceOrderIndex: number;
  filename: string;
  sourceType: ContextDocumentChunkSourceType;
  chunkIndex: number;
  text: string;
  approxTokenCount: number;
  charStart: number;
  charEnd: number;
  extractionStatus: ContextDocumentChunkExtractionStatus;
  parentSourceStatus: ContextDocumentChunkParentStatus;
  safeProvenanceLabel: string;
  sectionLabel: string | null;
  sectionPath: string[];
  referencedLocationLabels: string[];
  sheetName: string | null;
  slideNumber: number | null;
  wasBudgetClamped?: boolean;
  originalCharEnd?: number;
  originalApproxTokenCount?: number;
};

export type ContextDocumentChunkCandidateParams = {
  sourceId: string;
  attachmentId?: string | null;
  fileId?: string | null;
  sourceOrderIndex?: number;
  filename: string;
  sourceType: ContextDocumentChunkSourceType;
  text: string;
  maxChunkTokens?: number;
  charsPerToken?: number;
};

export type ContextDocumentChunkSelectionMode = "document-order" | "ranked-order";

export type ContextDocumentChunkSelectionResult = {
  selectedChunks: ContextDocumentChunk[];
  skippedChunks: ContextDocumentChunk[];
  selectedApproxTokenCount: number;
  totalApproxTokenCount: number;
  selectedCharCount: number;
  totalCharCount: number;
  selectionMode: ContextDocumentChunkSelectionMode;
  usedBudgetClamp: boolean;
  coverageSelectionApplied: boolean;
  selectedDueToCoverageChunkKeys: string[];
};

export type ContextDocumentChunkRankingStrategy = "deterministic-query-overlap-v1";

export type ContextDocumentChunkRankingFallbackReason =
  | "empty_query"
  | "low_signal_query"
  | null;

export type ContextDocumentChunkRankingDetail = {
  sourceId: string;
  sourceOrderIndex: number;
  chunkIndex: number;
  score: number;
  signalLabels: string[];
  rankingOrder: number;
  exactPhraseMatchCount: number;
  definitionBoostApplied: boolean;
  coverageGroupKey: string | null;
};

export type ContextDocumentChunkRankingResult = {
  rankedChunks: ContextDocumentChunk[];
  rankingEnabled: boolean;
  rankingStrategy: ContextDocumentChunkRankingStrategy;
  queryTokenCount: number;
  fallbackReason: ContextDocumentChunkRankingFallbackReason;
  occurrenceIntentDetected: boolean;
  occurrenceTargetPhrase: string | null;
  details: ContextDocumentChunkRankingDetail[];
};

type NormalizedTextRange = {
  text: string;
  charStart: number;
  charEnd: number;
  sectionLabel: string | null;
  sectionPath: string[];
  referencedLocationLabels: string[];
  sheetName: string | null;
  slideNumber: number | null;
};

type LegalHeadingKind = "Article" | "Section" | "Exhibit" | "Schedule";

type LegalHeadingContext = {
  kind: LegalHeadingKind;
  rootId: string;
  rootLabel: string;
  deepestId: string;
  deepestLabel: string;
  basePath: string[];
};

export const DEFAULT_DOCUMENT_CHUNK_STRATEGY = "thread-document-paragraphs-v1";
export const DEFAULT_DOCUMENT_CHUNK_MAX_TOKENS = 200;
export const DEFAULT_DOCUMENT_CHUNK_RANKING_STRATEGY = "deterministic-query-overlap-v1";
const MINIMUM_FALLBACK_CHUNK_CHARS = 128;
const MINIMUM_PARTIAL_CHUNK_CHARS = 160;
const MAX_OCCURRENCE_TARGET_TOKENS = 8;
const DOCUMENT_CHUNK_RANKING_STOPWORDS = new Set([
  "a",
  "an",
  "and",
  "appear",
  "appears",
  "are",
  "article",
  "articles",
  "as",
  "at",
  "be",
  "by",
  "clause",
  "clauses",
  "discuss",
  "discusses",
  "do",
  "for",
  "from",
  "give",
  "help",
  "how",
  "i",
  "if",
  "in",
  "into",
  "is",
  "it",
  "me",
  "mention",
  "mentions",
  "my",
  "of",
  "on",
  "or",
  "our",
  "part",
  "parts",
  "please",
  "provision",
  "provisions",
  "reference",
  "references",
  "section",
  "sections",
  "show",
  "summarize",
  "tell",
  "that",
  "the",
  "this",
  "to",
  "us",
  "what",
  "when",
  "where",
  "which",
  "who",
  "why",
  "with",
]);
const OCCURRENCE_LOCATION_TERMS = [
  "article",
  "articles",
  "section",
  "sections",
  "clause",
  "clauses",
  "provision",
  "provisions",
  "part",
  "parts",
] as const;
const OCCURRENCE_REFERENCE_VERBS = [
  "appear",
  "appears",
  "mention",
  "mentions",
  "reference",
  "references",
  "discuss",
  "discusses",
] as const;
const OCCURRENCE_DEFINITION_MARKERS = [
  "shall mean",
  "means",
  "defined",
  "definition",
  "term",
] as const;

type PreparedChunkRankingQuery = {
  normalizedText: string;
  keywordTokens: string[];
  keywordTokenSet: Set<string>;
  phraseCandidates: string[];
  referencedSlideNumbers: Set<number>;
  occurrenceIntentDetected: boolean;
  targetPhrase: string | null;
};

type PreparedChunkRankingCorpus = {
  text: string;
  textTokens: Set<string>;
  filenameTokens: Set<string>;
  sectionTokens: Set<string>;
  sheetTokens: Set<string>;
  slideLabelTokens: Set<string>;
  sectionText: string;
};

function normalizeRankingText(value: string | null | undefined) {
  return (value ?? "")
    .toLowerCase()
    .replace(/[`'’]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function normalizeOccurrenceQueryText(value: string | null | undefined) {
  return (value ?? "")
    .toLowerCase()
    .replace(/[`'â€™"]/g, "")
    .replace(/[^a-z0-9./-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function buildChunkKey(chunk: Pick<ContextDocumentChunk, "sourceId" | "chunkIndex">) {
  return `${chunk.sourceId}:${chunk.chunkIndex}`;
}

function dedupeTokens(values: string[]) {
  const tokens: string[] = [];
  const seen = new Set<string>();

  for (const value of values) {
    const normalized = value.trim();
    if (!normalized || seen.has(normalized)) {
      continue;
    }

    seen.add(normalized);
    tokens.push(normalized);
  }

  return tokens;
}

function escapeRegex(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function tokenizeNormalizedWords(value: string | null | undefined) {
  return normalizeRankingText(value).match(/[a-z0-9]+/g) ?? [];
}

function tokenizeRankingText(
  value: string | null | undefined,
  options: { includeStopwords?: boolean } = {}
) {
  const lowerCased = (value ?? "").toLowerCase().replace(/[`'’]/g, "");
  if (!lowerCased.trim()) {
    return [];
  }

  const tokens = dedupeTokens([
    ...(lowerCased.match(/[a-z0-9]+(?:[._/#-][a-z0-9]+)+/g) ?? []).map((token) => token.trim()),
    ...(normalizeRankingText(lowerCased).match(/[a-z0-9]+/g) ?? []).map((token) => token.trim()),
  ]);

  if (options.includeStopwords) {
    return tokens;
  }

  return tokens.filter((token) => {
    if (!token) {
      return false;
    }

    if (DOCUMENT_CHUNK_RANKING_STOPWORDS.has(token)) {
      return false;
    }

    return token.length > 1 || /\d/.test(token);
  });
}

function buildRankingPhraseCandidates(tokens: string[]) {
  const phrases: string[] = [];

  for (let size = Math.min(3, tokens.length); size >= 2; size -= 1) {
    for (let index = 0; index <= tokens.length - size; index += 1) {
      const phrase = tokens.slice(index, index + size).join(" ");
      if (phrase.trim().length === 0) {
        continue;
      }

      phrases.push(phrase);
    }
  }

  return dedupeTokens(phrases);
}

function cleanupOccurrenceTargetPhrase(value: string) {
  const normalized = normalizeOccurrenceQueryText(value)
    .replace(/^(?:the|a|an)\s+/, "")
    .replace(
      /\b(?:in|within|from|of)\s+(?:this|the)\s+(?:document|agreement|contract|file|pdf)\b.*$/,
      ""
    )
    .trim();
  const tokens = tokenizeNormalizedWords(normalized);

  if (
    tokens.length === 0 ||
    tokens.length > MAX_OCCURRENCE_TARGET_TOKENS ||
    tokens.every((token) => DOCUMENT_CHUNK_RANKING_STOPWORDS.has(token))
  ) {
    return null;
  }

  return tokens.join(" ");
}

function extractOccurrenceTargetPhrase(value: string | null | undefined) {
  const normalized = normalizeOccurrenceQueryText(value);
  if (!normalized) {
    return null;
  }

  const phrasePatterns = [
    /(?:summarize|list|show|tell|what|which)\s+(?:what\s+)?(?:articles?|sections?|clauses?|provisions?|parts?)\s+(?:does\s+)?(.+?)\s+(?:appear|appears)\s+in\b/,
    /where\s+does\s+(.+?)\s+(?:appear|appears)\b/,
    /(?:summarize|list|show|tell|what|which)\s+(?:articles?|sections?|clauses?|provisions?|parts?)\s+(?:that\s+)?(?:mention|mentions|reference|references|discuss|discusses)\s+(.+?)\b/,
    /list\s+the\s+(?:articles?|sections?|clauses?|provisions?|parts?)\s+that\s+(?:mention|mentions|reference|references|discuss|discusses)\s+(.+?)\b/,
    /(?:what|which)\s+(?:articles?|sections?|clauses?|provisions?|parts?)\s+(?:are\s+)?(?:about|regarding)\s+(.+?)\b/,
  ] as const;

  for (const pattern of phrasePatterns) {
    const match = pattern.exec(normalized);
    const extractedPhrase = cleanupOccurrenceTargetPhrase(match?.[1] ?? "");
    if (extractedPhrase) {
      return extractedPhrase;
    }
  }

  return null;
}

function detectOccurrenceListingIntent(value: string | null | undefined) {
  const normalized = normalizeOccurrenceQueryText(value);
  if (!normalized) {
    return false;
  }

  if (extractOccurrenceTargetPhrase(normalized)) {
    return true;
  }

  const hasLocationTerm = OCCURRENCE_LOCATION_TERMS.some((term) => normalized.includes(term));
  const hasReferenceVerb = OCCURRENCE_REFERENCE_VERBS.some((verb) => normalized.includes(verb));

  return hasLocationTerm && hasReferenceVerb;
}

function resolveReferencedSlideNumbers(value: string | null | undefined) {
  const slideNumbers = new Set<number>();
  const lowerCased = (value ?? "").toLowerCase();

  for (const match of lowerCased.matchAll(/\bslide\s+(\d+)\b/g)) {
    const slideNumber = Number(match[1]);
    if (Number.isFinite(slideNumber)) {
      slideNumbers.add(slideNumber);
    }
  }

  return slideNumbers;
}

function prepareChunkRankingQuery(value: string | null | undefined): PreparedChunkRankingQuery {
  const normalizedText = normalizeRankingText(value);
  const keywordTokens = tokenizeRankingText(value);
  const targetPhrase = extractOccurrenceTargetPhrase(value);
  const occurrenceIntentDetected = detectOccurrenceListingIntent(value);

  return {
    normalizedText,
    keywordTokens,
    keywordTokenSet: new Set(keywordTokens),
    phraseCandidates: dedupeTokens([
      ...buildRankingPhraseCandidates(keywordTokens),
      ...(targetPhrase ? [targetPhrase] : []),
    ]),
    referencedSlideNumbers: resolveReferencedSlideNumbers(value),
    occurrenceIntentDetected,
    targetPhrase,
  };
}

function prepareChunkRankingCorpus(chunk: ContextDocumentChunk): PreparedChunkRankingCorpus {
  const sectionText = normalizeRankingText(chunk.sectionPath.join(" "));

  return {
    text: normalizeRankingText(chunk.text),
    textTokens: new Set(tokenizeRankingText(chunk.text, { includeStopwords: true })),
    filenameTokens: new Set(tokenizeRankingText(chunk.filename, { includeStopwords: true })),
    sectionTokens: new Set(tokenizeRankingText(chunk.sectionPath.join(" "), { includeStopwords: true })),
    sheetTokens: new Set(tokenizeRankingText(chunk.sheetName, { includeStopwords: true })),
    slideLabelTokens: new Set(
      tokenizeRankingText(
        chunk.slideNumber != null ? `slide ${chunk.slideNumber}` : null,
        { includeStopwords: true }
      )
    ),
    sectionText,
  };
}

function countTokenMatches(queryTokens: Set<string>, candidateTokens: Set<string>) {
  let matches = 0;

  for (const token of queryTokens) {
    if (candidateTokens.has(token)) {
      matches += 1;
    }
  }

  return matches;
}

function countPhraseOccurrences(value: string, phrase: string) {
  if (!value || !phrase) {
    return 0;
  }

  const matcher = new RegExp(`(?:^|\\s)${escapeRegex(phrase)}(?=\\s|$)`, "g");
  return [...value.matchAll(matcher)].length;
}

function resolveChunkCoverageGroupKey(
  chunk: ContextDocumentChunk,
  corpus: PreparedChunkRankingCorpus
) {
  const candidateLabels = [...chunk.sectionPath];

  for (const label of [...candidateLabels].reverse()) {
    const normalized = normalizeOccurrenceQueryText(label);
    if (!normalized) {
      continue;
    }

    const clauseMatch =
      /^article\s+((?:[ivxlcdm]+|\d+[a-z]?)(?:\.(?:\d+[a-z]?|[a-z]))+)\b/.exec(normalized) ??
      /^section\s+((?:\d+[a-z]?)(?:\.(?:\d+[a-z]?|[a-z]))+)\b/.exec(normalized);
    if (clauseMatch) {
      return `section:${clauseMatch[1]}`;
    }

    const sectionMatch = /^section\s+([a-z0-9.-]+)\b/.exec(normalized);
    if (sectionMatch) {
      return `section:${sectionMatch[1]}`;
    }

    const exhibitMatch = /^(exhibit|schedule)\s+([a-z0-9.-]+)\b/.exec(normalized);
    if (exhibitMatch) {
      return `${exhibitMatch[1]}:${exhibitMatch[2]}`;
    }
  }

  for (const label of [...candidateLabels].reverse()) {
    const normalized = normalizeOccurrenceQueryText(label);
    if (!normalized) {
      continue;
    }

    const articleMatch = /^article\s+([ivxlcdm]+|\d+[a-z]?)\b/.exec(normalized);
    if (articleMatch) {
      return `article:${articleMatch[1]}`;
    }
  }

  if (chunk.sheetName) {
    return `sheet:${normalizeRankingText(chunk.sheetName)}`;
  }

  if (chunk.slideNumber != null) {
    return `slide:${chunk.slideNumber}`;
  }

  if (corpus.sectionText) {
    return `section:${corpus.sectionText}`;
  }

  return null;
}

function resolveChunkLocationFamilyKeys(params: {
  chunk: ContextDocumentChunk;
  coverageGroupKey: string | null;
}) {
  const coverageGroupKey = params.coverageGroupKey;
  if (coverageGroupKey?.startsWith("section:")) {
    const sectionId = coverageGroupKey.slice("section:".length);
    const segments = sectionId.split(".").filter(Boolean);
    if (segments.length > 0) {
      return {
        rootFamilyKey: `article:${segments[0]}`,
        parentFamilyKey:
          segments.length > 1
            ? `section:${segments.slice(0, -1).join(".")}`
            : `article:${segments[0]}`,
      };
    }
  }

  if (coverageGroupKey?.startsWith("article:")) {
    return {
      rootFamilyKey: coverageGroupKey,
      parentFamilyKey: coverageGroupKey,
    };
  }

  for (const label of [...params.chunk.sectionPath].reverse()) {
    const normalized = normalizeOccurrenceQueryText(label);
    if (!normalized) {
      continue;
    }

    const clauseMatch =
      /^article\s+((?:[ivxlcdm]+|\d+[a-z]?)(?:\.(?:\d+[a-z]?|[a-z]))+)\b/.exec(normalized) ??
      /^section\s+((?:\d+[a-z]?)(?:\.(?:\d+[a-z]?|[a-z]))+)\b/.exec(normalized);
    if (clauseMatch) {
      const segments = clauseMatch[1].split(".").filter(Boolean);
      if (segments.length > 0) {
        return {
          rootFamilyKey: `article:${segments[0]}`,
          parentFamilyKey:
            segments.length > 1
              ? `section:${segments.slice(0, -1).join(".")}`
              : `article:${segments[0]}`,
        };
      }
    }

    const articleMatch = /^article\s+([ivxlcdm]+|\d+[a-z]?)\b/.exec(normalized);
    if (articleMatch) {
      return {
        rootFamilyKey: `article:${articleMatch[1]}`,
        parentFamilyKey: `article:${articleMatch[1]}`,
      };
    }
  }

  return {
    rootFamilyKey: null,
    parentFamilyKey: null,
  };
}

function hasDefinitionLanguageNearPhrase(value: string, phrase: string) {
  if (!value || !phrase) {
    return false;
  }

  const escapedPhrase = escapeRegex(phrase);
  const directPatterns = [
    new RegExp(`\\bthe\\s+term\\s+${escapedPhrase}\\s+(?:shall\\s+)?mean\\b`),
    new RegExp(`\\b${escapedPhrase}\\s+(?:shall\\s+)?mean\\b`),
    new RegExp(`\\b${escapedPhrase}\\s+is\\s+defined\\b`),
    new RegExp(`\\bdefinition\\s+of\\s+${escapedPhrase}\\b`),
  ];

  if (directPatterns.some((pattern) => pattern.test(value))) {
    return true;
  }

  let phraseIndex = value.indexOf(phrase);
  while (phraseIndex >= 0) {
    const windowStart = Math.max(0, phraseIndex - 120);
    const windowEnd = Math.min(value.length, phraseIndex + phrase.length + 120);
    const contextWindow = value.slice(windowStart, windowEnd);

    if (OCCURRENCE_DEFINITION_MARKERS.some((marker) => contextWindow.includes(marker))) {
      return true;
    }

    phraseIndex = value.indexOf(phrase, phraseIndex + phrase.length);
  }

  return false;
}

function buildCoverageAwareChunkOrder(params: {
  chunks: ContextDocumentChunk[];
  ranking: ContextDocumentChunkRankingResult;
}) {
  if (!params.ranking.occurrenceIntentDetected || !params.ranking.occurrenceTargetPhrase) {
    return {
      orderedChunks: params.chunks,
      coverageSelectionApplied: false,
      prioritizedChunkKeys: new Set<string>(),
    };
  }

  const rankingDetails = new Map(
    params.ranking.details.map((detail) => [`${detail.sourceId}:${detail.chunkIndex}`, detail])
  );
  const exactMatchChunks = params.chunks.filter((chunk) => {
    const detail = rankingDetails.get(buildChunkKey(chunk));
    return (detail?.exactPhraseMatchCount ?? 0) > 0;
  });

  if (exactMatchChunks.length < 2) {
    return {
      orderedChunks: params.chunks,
      coverageSelectionApplied: false,
      prioritizedChunkKeys: new Set<string>(),
    };
  }

  const selectedCoverageKeys = new Set<string>();
  const distinctCoverageChunks: ContextDocumentChunk[] = [];

  for (const chunk of exactMatchChunks) {
    const detail = rankingDetails.get(buildChunkKey(chunk));
    const coverageKey = detail?.coverageGroupKey ?? buildChunkKey(chunk);
    if (selectedCoverageKeys.has(coverageKey)) {
      continue;
    }

    selectedCoverageKeys.add(coverageKey);
    distinctCoverageChunks.push(chunk);
  }

  if (distinctCoverageChunks.length < 2) {
    return {
      orderedChunks: params.chunks,
      coverageSelectionApplied: false,
      prioritizedChunkKeys: new Set<string>(),
    };
  }

  const rootFamilySummaries = new Map<string, {
    distinctCoverageCount: number;
    maxScore: number;
    hasDefinitionBoost: boolean;
    maxExactPhraseMatchCount: number;
    firstRankingOrder: number;
  }>();
  const chunkRootFamilyKeys = new Map<string, string | null>();

  for (const chunk of distinctCoverageChunks) {
    const detail = rankingDetails.get(buildChunkKey(chunk));
    const { rootFamilyKey } = resolveChunkLocationFamilyKeys({
      chunk,
      coverageGroupKey: detail?.coverageGroupKey ?? null,
    });
    const chunkKey = buildChunkKey(chunk);
    chunkRootFamilyKeys.set(chunkKey, rootFamilyKey);

    if (!rootFamilyKey) {
      continue;
    }

    const summary = rootFamilySummaries.get(rootFamilyKey) ?? {
      distinctCoverageCount: 0,
      maxScore: Number.NEGATIVE_INFINITY,
      hasDefinitionBoost: false,
      maxExactPhraseMatchCount: 0,
      firstRankingOrder: detail?.rankingOrder ?? Number.MAX_SAFE_INTEGER,
    };

    summary.distinctCoverageCount += 1;
    summary.maxScore = Math.max(summary.maxScore, detail?.score ?? 0);
    summary.hasDefinitionBoost = summary.hasDefinitionBoost || Boolean(detail?.definitionBoostApplied);
    summary.maxExactPhraseMatchCount = Math.max(
      summary.maxExactPhraseMatchCount,
      detail?.exactPhraseMatchCount ?? 0
    );
    summary.firstRankingOrder = Math.min(summary.firstRankingOrder, detail?.rankingOrder ?? Number.MAX_SAFE_INTEGER);
    rootFamilySummaries.set(rootFamilyKey, summary);
  }

  const primaryRootFamilyKeys = [...rootFamilySummaries.entries()]
    .filter(([, summary]) =>
      summary.distinctCoverageCount >= 2 &&
      (
        summary.distinctCoverageCount >= 3 ||
        summary.maxScore >= 90 ||
        summary.hasDefinitionBoost ||
        summary.maxExactPhraseMatchCount > 1
      )
    )
    .sort((left, right) =>
      right[1].distinctCoverageCount - left[1].distinctCoverageCount ||
      right[1].maxScore - left[1].maxScore ||
      left[1].firstRankingOrder - right[1].firstRankingOrder
    )
    .map(([rootFamilyKey]) => rootFamilyKey);

  const prioritizedChunks: ContextDocumentChunk[] = [];
  if (primaryRootFamilyKeys.length > 0) {
    const rootFamilyBuckets = new Map<string, ContextDocumentChunk[]>();

    for (const chunk of distinctCoverageChunks) {
      const rootFamilyKey = chunkRootFamilyKeys.get(buildChunkKey(chunk));
      if (!rootFamilyKey || !primaryRootFamilyKeys.includes(rootFamilyKey)) {
        continue;
      }

      const bucket = rootFamilyBuckets.get(rootFamilyKey) ?? [];
      bucket.push(chunk);
      rootFamilyBuckets.set(rootFamilyKey, bucket);
    }

    let addedChunk = true;
    while (addedChunk) {
      addedChunk = false;

      for (const rootFamilyKey of primaryRootFamilyKeys) {
        const bucket = rootFamilyBuckets.get(rootFamilyKey);
        const nextChunk = bucket?.shift();
        if (!nextChunk) {
          continue;
        }

        prioritizedChunks.push(nextChunk);
        addedChunk = true;
      }
    }

    prioritizedChunks.push(
      ...distinctCoverageChunks.filter((chunk) => !prioritizedChunks.includes(chunk))
    );
  } else {
    prioritizedChunks.push(...distinctCoverageChunks);
  }

  const prioritizedChunkKeys = new Set(prioritizedChunks.map((chunk) => buildChunkKey(chunk)));
  const exactMatchKeys = new Set(exactMatchChunks.map((chunk) => buildChunkKey(chunk)));

  return {
    orderedChunks: [
      ...prioritizedChunks,
      ...params.chunks.filter((chunk) => {
        const chunkKey = buildChunkKey(chunk);
        return exactMatchKeys.has(chunkKey) && !prioritizedChunkKeys.has(chunkKey);
      }),
    ],
    coverageSelectionApplied: true,
    prioritizedChunkKeys,
  };
}

function buildRankingOrderChunkList(chunks: ContextDocumentChunk[]) {
  return [...chunks].sort((left, right) =>
    left.sourceOrderIndex - right.sourceOrderIndex ||
    left.chunkIndex - right.chunkIndex
  );
}

function scoreDocumentChunk(params: {
  chunk: ContextDocumentChunk;
  query: PreparedChunkRankingQuery;
}) {
  const corpus = prepareChunkRankingCorpus(params.chunk);
  let score = 0;
  const signalLabels: string[] = [];
  const exactPhraseMatchCount = params.query.targetPhrase
    ? countPhraseOccurrences(corpus.text, params.query.targetPhrase)
    : 0;
  const coverageGroupKey = resolveChunkCoverageGroupKey(params.chunk, corpus);
  const definitionBoostApplied =
    params.query.targetPhrase != null &&
    exactPhraseMatchCount > 0 &&
    hasDefinitionLanguageNearPhrase(corpus.text, params.query.targetPhrase);

  if (params.query.normalizedText.length > 0 && params.query.keywordTokens.length >= 2) {
    if (corpus.text.includes(params.query.normalizedText)) {
      score += 18;
      signalLabels.push("exact_query_match");
    }
  }

  let phraseMatches = 0;
  for (const phrase of params.query.phraseCandidates) {
    if (corpus.text.includes(phrase)) {
      phraseMatches += 1;
    }
  }
  if (phraseMatches > 0) {
    score += phraseMatches * 7;
    signalLabels.push("phrase_overlap");
  }

  const keywordOverlap = countTokenMatches(params.query.keywordTokenSet, corpus.textTokens);
  if (keywordOverlap > 0) {
    score += keywordOverlap * (params.query.targetPhrase ? 2 : 3);
    signalLabels.push("keyword_overlap");
  }

  const filenameOverlap = countTokenMatches(params.query.keywordTokenSet, corpus.filenameTokens);
  if (filenameOverlap > 0) {
    score += filenameOverlap * 4;
    signalLabels.push("filename_match");
  }

  const sectionOverlap = countTokenMatches(params.query.keywordTokenSet, corpus.sectionTokens);
  if (sectionOverlap > 0) {
    score += sectionOverlap * 5;
    signalLabels.push("section_match");
  }

  const sheetOverlap = countTokenMatches(params.query.keywordTokenSet, corpus.sheetTokens);
  if (sheetOverlap > 0) {
    score += sheetOverlap * 6;
    signalLabels.push("sheet_match");
  }

  const slideLabelOverlap = countTokenMatches(params.query.keywordTokenSet, corpus.slideLabelTokens);
  if (slideLabelOverlap > 0) {
    score += slideLabelOverlap * 4;
    signalLabels.push("slide_label_match");
  }

  if (
    params.chunk.slideNumber != null &&
    params.query.referencedSlideNumbers.has(params.chunk.slideNumber)
  ) {
    score += 8;
    signalLabels.push("slide_number_match");
  }

  if (params.query.occurrenceIntentDetected && params.query.targetPhrase) {
    if (exactPhraseMatchCount > 0) {
      score += 28 + exactPhraseMatchCount * 18;
      signalLabels.push("exact_target_phrase_match");

      if (exactPhraseMatchCount > 1) {
        score += (exactPhraseMatchCount - 1) * 10;
        signalLabels.push("repeated_target_phrase_match");
      }
    }

    if (corpus.sectionText.includes(params.query.targetPhrase)) {
      score += 12;
      signalLabels.push("target_phrase_section_label_match");
    }

    if (definitionBoostApplied) {
      score += 24;
      signalLabels.push("definition_context");
    }

    if (coverageGroupKey && exactPhraseMatchCount > 0) {
      score += 10;
      signalLabels.push("coverage_heading_match");
    }
  }

  if (
    params.chunk.extractionStatus === "extracted" &&
    params.chunk.parentSourceStatus === "used"
  ) {
    score += 0.25;
    signalLabels.push("usable_extracted_chunk");
  }

  if (params.chunk.approxTokenCount < 12) {
    score -= 1.5;
    signalLabels.push("low_information_penalty");
  } else if (params.chunk.approxTokenCount < 20) {
    score -= 0.5;
    signalLabels.push("short_chunk_penalty");
  }

  return {
    score,
    signalLabels: dedupeTokens(signalLabels),
    exactPhraseMatchCount,
    definitionBoostApplied,
    coverageGroupKey,
  };
}

function trimTextRange(value: string, start: number, end: number) {
  let nextStart = Math.max(0, start);
  let nextEnd = Math.min(value.length, end);

  while (nextStart < nextEnd && /\s/.test(value.charAt(nextStart))) {
    nextStart += 1;
  }

  while (nextEnd > nextStart && /\s/.test(value.charAt(nextEnd - 1))) {
    nextEnd -= 1;
  }

  if (nextEnd <= nextStart) {
    return null;
  }

  return {
    text: value.slice(nextStart, nextEnd),
    charStart: nextStart,
    charEnd: nextEnd,
  };
}

function advancePastWhitespace(value: string, start: number, end: number) {
  let nextStart = start;

  while (nextStart < end && /\s/.test(value.charAt(nextStart))) {
    nextStart += 1;
  }

  return nextStart;
}

function normalizeHeadingLabelText(value: string) {
  return value
    .replace(/\s+/g, " ")
    .replace(/[–—]+/g, " — ")
    .replace(/\s*—\s*/g, " — ")
    .trim()
    .replace(/[.:;,-]+$/, "")
    .trim();
}

function normalizeHeadingId(value: string) {
  return value
    .split(".")
    .map((segment) => {
      const normalizedSegment = segment.trim();
      if (/^[ivxlcdm]+$/i.test(normalizedSegment) || /^[a-z]$/i.test(normalizedSegment)) {
        return normalizedSegment.toUpperCase();
      }

      return normalizedSegment;
    })
    .join(".");
}

function isLikelyTableOfContentsLine(value: string) {
  const trimmed = value.trim();
  if (!trimmed) {
    return false;
  }

  if (/^table of contents$/i.test(trimmed)) {
    return true;
  }

  if (/(?:\.{2,}|…{2,}|_{2,}|-{3,})\s*\d+\s*$/u.test(trimmed)) {
    return true;
  }

  return /^(?:article|section|exhibit|schedule|[ivxlcdm]+\.|\d+(?:\.\d+)*\.?)\b.*(?:\s{2,}|\t+)\d+\s*$/i.test(
    value
  );
}

function isLikelyHeadingTitleLine(value: string) {
  const normalized = normalizeHeadingLabelText(value);
  if (!normalized || isLikelyTableOfContentsLine(value) || normalized.length > 120) {
    return false;
  }

  const tokens = normalized.split(/\s+/);
  if (tokens.length > 10) {
    return false;
  }

  const lowercaseWords = tokens.filter((token) => /^[a-z]+$/.test(token));
  if (lowercaseWords.length > 2) {
    return false;
  }

  if (/[!?;]$/.test(normalized)) {
    return false;
  }

  return true;
}

function resolveStructuredHeadingTitle(inlineTitle: string, trailingLines: string[]) {
  const normalizedInlineTitle = normalizeHeadingLabelText(inlineTitle).replace(
    /^(?:[-–—:]\s*)+/,
    ""
  );
  const trailingTitleLine = trailingLines.find((line) => isLikelyHeadingTitleLine(line));

  if (!normalizedInlineTitle) {
    return {
      title: trailingTitleLine ? normalizeHeadingLabelText(trailingTitleLine) : null,
      isValid: true,
    };
  }

  if (isLikelyHeadingTitleLine(normalizedInlineTitle)) {
    return {
      title: normalizedInlineTitle,
      isValid: true,
    };
  }

  if (trailingTitleLine) {
    return {
      title: normalizeHeadingLabelText(trailingTitleLine),
      isValid: true,
    };
  }

  return {
    title: null,
    isValid: false,
  };
}

function buildHeadingLabel(prefix: "Article" | "Section" | "Exhibit" | "Schedule", id: string, title?: string | null) {
  const normalizedId = normalizeHeadingId(id);
  return title
    ? `${prefix} ${normalizedId} — ${title}`
    : `${prefix} ${normalizedId}`;
}

function extractHeadingRootId(value: string | null | undefined) {
  const normalized = normalizeOccurrenceQueryText(value);
  const subsectionMatch = /^(?:article|section)\s+([ivxlcdm]+|\d+[a-z]?)(?:\b|[.\s-])/i.exec(
    normalized
  );
  if (subsectionMatch) {
    return subsectionMatch[1];
  }

  const exhibitMatch = /^(?:exhibit|schedule)\s+([a-z0-9.-]+)\b/i.exec(normalized);
  return exhibitMatch?.[1] ?? null;
}

function extractHeadingFullId(value: string | null | undefined) {
  const normalized = normalizeOccurrenceQueryText(value);
  if (!normalized) {
    return null;
  }

  const sectionMatch = /^(?:article|section)\s+((?:[ivxlcdm]+|\d+[a-z]?)(?:\.(?:\d+[a-z]?|[a-z]))*)\b/i.exec(
    normalized
  );
  if (sectionMatch) {
    return sectionMatch[1];
  }

  const exhibitMatch = /^(?:exhibit|schedule)\s+([a-z0-9.-]+)\b/i.exec(normalized);
  return exhibitMatch?.[1] ?? null;
}

function parseHeadingKind(value: string | null | undefined): LegalHeadingKind | null {
  const normalized = normalizeOccurrenceQueryText(value);
  if (!normalized) {
    return null;
  }

  if (normalized.startsWith("article ")) {
    return "Article";
  }

  if (normalized.startsWith("section ")) {
    return "Section";
  }

  if (normalized.startsWith("exhibit ")) {
    return "Exhibit";
  }

  if (normalized.startsWith("schedule ")) {
    return "Schedule";
  }

  return null;
}

function resolveInheritedHeadingContext(inheritedPath: string[]) {
  const parsedLabels = inheritedPath
    .map((label, index) => {
      const kind = parseHeadingKind(label);
      const fullId = extractHeadingFullId(label);
      if (!kind || !fullId) {
        return null;
      }

      return {
        label,
        index,
        kind,
        fullId,
      };
    })
    .filter((value): value is { label: string; index: number; kind: LegalHeadingKind; fullId: string } => Boolean(value));

  if (parsedLabels.length === 0) {
    return null;
  }

  const deepestEntry = parsedLabels[parsedLabels.length - 1];
  const rootEntry = parsedLabels.find((entry) => entry.kind === deepestEntry.kind) ?? deepestEntry;
  const rootId = rootEntry.fullId.split(".")[0] ?? rootEntry.fullId;

  return {
    kind: deepestEntry.kind,
    rootId,
    rootLabel: rootEntry.label,
    deepestId: deepestEntry.fullId,
    deepestLabel: deepestEntry.label,
    basePath: inheritedPath.slice(0, deepestEntry.index + 1),
  } satisfies LegalHeadingContext;
}

function normalizeInheritedSubsectionId(value: string) {
  const normalized = value.trim();
  return /^[a-z]$/i.test(normalized) ? normalized.toUpperCase() : normalizeHeadingId(normalized);
}

function findNearestAncestorIdByClass(fullId: string, segmentClass: ReturnType<typeof classifyHeadingSegment>) {
  const segments = fullId.split(".");
  for (let index = segments.length - 1; index >= 1; index -= 1) {
    if (classifyHeadingSegment(segments[index]) === segmentClass) {
      return segments.slice(0, index + 1).join(".");
    }
  }

  return null;
}

function resolveInheritedBasePathForId(
  inheritedPath: string[],
  kind: LegalHeadingKind,
  targetId: string
) {
  for (let index = inheritedPath.length - 1; index >= 0; index -= 1) {
    const label = inheritedPath[index];
    if (!label || parseHeadingKind(label) !== kind) {
      continue;
    }

    const fullId = extractHeadingFullId(label);
    if (fullId?.toUpperCase() === targetId.toUpperCase()) {
      return inheritedPath.slice(0, index + 1);
    }
  }

  return null;
}

function classifyHeadingSegment(value: string | null | undefined) {
  const normalized = value?.trim() ?? "";
  if (!normalized) {
    return "other" as const;
  }

  if (/^[a-z]$/i.test(normalized)) {
    return "alpha" as const;
  }

  if (/^\d+[a-z]?$/i.test(normalized)) {
    return "numeric" as const;
  }

  return "other" as const;
}

function resolveSubsectionTitle(inlineTitle: string, trailingLines: string[]) {
  const normalizedInlineTitle = normalizeHeadingLabelText(inlineTitle).replace(
    /^(?:[-–—:]\s*)+/,
    ""
  );

  if (normalizedInlineTitle) {
    return isLikelyHeadingTitleLine(normalizedInlineTitle) ? normalizedInlineTitle : null;
  }

  const trailingTitleLine = trailingLines.find((line) => isLikelyHeadingTitleLine(line));
  if (!trailingTitleLine) {
    return null;
  }

  return normalizeHeadingLabelText(trailingTitleLine);
}

function buildInheritedSubsectionPath(
  inheritedPath: string[],
  subsectionId: string,
  title: string | null
) {
  const inheritedContext = resolveInheritedHeadingContext(inheritedPath);
  if (!inheritedContext || (inheritedContext.kind !== "Article" && inheritedContext.kind !== "Section")) {
    return null;
  }

  const normalizedSubsectionId = normalizeInheritedSubsectionId(subsectionId);
  const deepestIdSegments = inheritedContext.deepestId.split(".");
  const deepestLastSegment = deepestIdSegments.at(-1) ?? null;
  const subsectionClass = classifyHeadingSegment(normalizedSubsectionId);
  const deepestSegmentClass = classifyHeadingSegment(deepestLastSegment);
  if (subsectionClass === "alpha") {
    const basePath =
      resolveInheritedBasePathForId(inheritedPath, inheritedContext.kind, inheritedContext.rootId) ??
      [inheritedContext.rootLabel];

    return [
      ...basePath,
      buildHeadingLabel(
        inheritedContext.kind,
        `${inheritedContext.rootId}.${normalizedSubsectionId}`,
        title
      ),
    ];
  }

  const treatAsSibling =
    deepestIdSegments.length > 1 &&
    subsectionClass !== "other" &&
    subsectionClass === deepestSegmentClass;
  let baseId = treatAsSibling
    ? deepestIdSegments.slice(0, -1).join(".")
    : inheritedContext.deepestId;
  let basePath = treatAsSibling
    ? inheritedContext.basePath.slice(0, -1)
    : inheritedContext.basePath;

  if (!treatAsSibling && subsectionClass === "numeric" && deepestSegmentClass !== "alpha") {
    const alphaAncestorId = findNearestAncestorIdByClass(inheritedContext.deepestId, "alpha");
    if (alphaAncestorId) {
      baseId = alphaAncestorId;
      basePath =
        resolveInheritedBasePathForId(inheritedPath, inheritedContext.kind, alphaAncestorId) ??
        inheritedContext.basePath;
    }
  }

  return [
    ...basePath,
    buildHeadingLabel(
      inheritedContext.kind,
      `${baseId}.${normalizedSubsectionId}`,
      title
    ),
  ];
}

function buildInheritedCompoundSubsectionPath(
  inheritedPath: string[],
  relativeId: string,
  title: string | null
) {
  const inheritedContext = resolveInheritedHeadingContext(inheritedPath);
  if (!inheritedContext || (inheritedContext.kind !== "Article" && inheritedContext.kind !== "Section")) {
    return null;
  }

  const normalizedRelativeId = relativeId
    .split(".")
    .map((segment) => normalizeInheritedSubsectionId(segment))
    .join(".");
  const lastDeepestSegment = inheritedContext.deepestId.split(".").at(-1)?.toUpperCase() ?? null;
  const relativeFirstSegment = normalizedRelativeId.split(".")[0]?.toUpperCase() ?? null;
  const relativeFirstSegmentClass = classifyHeadingSegment(relativeFirstSegment);
  const fullId =
    relativeFirstSegmentClass === "alpha"
      ? `${inheritedContext.rootId}.${normalizedRelativeId}`
      : lastDeepestSegment && relativeFirstSegment === lastDeepestSegment
      ? `${inheritedContext.rootId}.${normalizedRelativeId}`
      : `${inheritedContext.deepestId}.${normalizedRelativeId}`;

  return [
    ...(
      relativeFirstSegmentClass === "alpha"
        ? resolveInheritedBasePathForId(inheritedPath, inheritedContext.kind, inheritedContext.rootId) ??
          [inheritedContext.rootLabel]
        : inheritedContext.basePath
    ),
    buildHeadingLabel(inheritedContext.kind, fullId, title),
  ];
}

function shouldTreatBareExhibitOrScheduleAsHeading(
  inheritedPath: string[],
  kind: LegalHeadingKind,
  title: string | null
) {
  if (title) {
    return true;
  }

  const inheritedContext = resolveInheritedHeadingContext(inheritedPath);
  if (!inheritedContext) {
    return true;
  }

  return inheritedContext.kind === kind;
}

function extractReferencedLocationLabels(value: string) {
  const labels: string[] = [];

  for (const match of value.matchAll(
    /\b(article\s+(?:[ivxlcdm]+|\d+[a-z]?)(?:\.(?:\d+[a-z]?|[a-z]))*|section\s+(?:\d+[a-z]?)(?:\.(?:\d+[a-z]?|[a-z]))*|exhibit\s+[a-z0-9.-]+|schedule\s+[a-z0-9.-]+)\b/gi
  )) {
    const normalized = normalizeHeadingLabelText(match[1] ?? "");
    if (normalized) {
      labels.push(normalized);
    }
  }

  return dedupeTokens(labels);
}

function filterReferencedLocationLabels(
  referencedLocationLabels: string[],
  sectionPath: string[]
) {
  const normalizedSectionLabels = sectionPath
    .map((label) => normalizeOccurrenceQueryText(label))
    .filter((label) => label.length > 0);

  return referencedLocationLabels.filter((label) => {
    const normalizedLabel = normalizeOccurrenceQueryText(label);
    if (!normalizedLabel) {
      return false;
    }

    return !normalizedSectionLabels.some(
      (sectionLabel) =>
        sectionLabel === normalizedLabel ||
        sectionLabel.startsWith(`${normalizedLabel}.`) ||
        sectionLabel.startsWith(`${normalizedLabel} `)
    );
  });
}

function resolveInheritedHeadingLabel(
  inheritedPath: string[],
  kind: "Article" | "Section" | "Exhibit" | "Schedule",
  rootId: string
) {
  const rootLabel = inheritedPath[0];
  if (!rootLabel) {
    return null;
  }

  const labelRootId = extractHeadingRootId(rootLabel);
  if (labelRootId?.toLowerCase() !== rootId.toLowerCase()) {
    return null;
  }

  if (!new RegExp(`^${kind}\\b`, "i").test(rootLabel)) {
    return null;
  }

  return rootLabel;
}

function buildLegalHeadingPath(lines: string[], inheritedPath: string[]) {
  const nonEmptyLines = lines
    .map((line) => line.trim())
    .filter((line) => line.length > 0);

  if (nonEmptyLines.length === 0 || nonEmptyLines.every((line) => isLikelyTableOfContentsLine(line))) {
    return null;
  }

  const firstLine = normalizeHeadingLabelText(nonEmptyLines[0] ?? "");
  const trailingLines = nonEmptyLines.slice(1);

  const inheritedCompoundSubsectionMatch = /^([a-z](?:\.(?:\d+[a-z]?|[a-z]))+)(?:[.)]|(?=\s)|$)(?:\s+)?(.*)$/i.exec(firstLine);
  if (inheritedCompoundSubsectionMatch && !isLikelyTableOfContentsLine(firstLine)) {
    const inheritedCompoundPath = buildInheritedCompoundSubsectionPath(
      inheritedPath,
      inheritedCompoundSubsectionMatch[1],
      resolveSubsectionTitle(inheritedCompoundSubsectionMatch[2] ?? "", trailingLines)
    );
    if (inheritedCompoundPath) {
      return inheritedCompoundPath;
    }
  }

  const articleSectionMatch = /^(?:article\s+)?((?:[ivxlcdm]+|\d+[a-z]?)(?:\.(?:\d+[a-z]?|[a-z]))+)(?:\s*[-—:]\s*|\s+)?(.*)$/i.exec(
    firstLine
  );
  if (articleSectionMatch && !isLikelyTableOfContentsLine(firstLine)) {
    const sectionId = articleSectionMatch[1];
    const articleId = sectionId.split(".")[0] ?? sectionId;
    const { title: sectionTitle, isValid } = resolveStructuredHeadingTitle(
      articleSectionMatch[2] ?? "",
      trailingLines
    );
    if (!isValid) {
      return null;
    }
    const articleLabel =
      resolveInheritedHeadingLabel(inheritedPath, "Article", articleId) ??
      buildHeadingLabel("Article", articleId);

    return [
      articleLabel,
      buildHeadingLabel("Article", sectionId, sectionTitle),
    ];
  }

  const sectionMatch = /^section\s+((?:\d+[a-z]?)(?:\.(?:\d+[a-z]?|[a-z]))*)(?:\s*[-—:]\s*|\s+)?(.*)$/i.exec(
    firstLine
  ) ?? /^((?:\d+[a-z]?)(?:\.(?:\d+[a-z]?|[a-z]))+)(?:\s*[-—:]\s*|\s+)?(.*)$/i.exec(firstLine);
  if (sectionMatch && !isLikelyTableOfContentsLine(firstLine)) {
    const sectionId = sectionMatch[1];
    const rootId = sectionId.split(".")[0] ?? sectionId;
    const { title: sectionTitle, isValid } = resolveStructuredHeadingTitle(
      sectionMatch[2] ?? "",
      trailingLines
    );
    if (!isValid) {
      return null;
    }
    const rootLabel =
      resolveInheritedHeadingLabel(inheritedPath, "Section", rootId) ??
      buildHeadingLabel("Section", rootId);

    if (sectionId === rootId) {
      return [buildHeadingLabel("Section", sectionId, sectionTitle)];
    }

    return [
      rootLabel,
      buildHeadingLabel("Section", sectionId, sectionTitle),
    ];
  }

  const exhibitOrScheduleMatch = /^(exhibit|schedule)\s+([a-z0-9.-]+)(?:\s*[-—:]\s*|\s+)?(.*)$/i.exec(
    firstLine
  );
  if (exhibitOrScheduleMatch && !isLikelyTableOfContentsLine(firstLine)) {
    const headingKind = exhibitOrScheduleMatch[1].toLowerCase() === "schedule"
      ? "Schedule"
      : "Exhibit";
    const headingId = exhibitOrScheduleMatch[2];
    const { title: headingTitle, isValid } = resolveStructuredHeadingTitle(
      exhibitOrScheduleMatch[3] ?? "",
      trailingLines
    );
    if (!isValid) {
      return null;
    }
    if (!shouldTreatBareExhibitOrScheduleAsHeading(inheritedPath, headingKind, headingTitle)) {
      return null;
    }
    return [buildHeadingLabel(headingKind, headingId, headingTitle)];
  }

  const articleMatch = /^article\s+([ivxlcdm]+|\d+[a-z]?)(?:\s*[-—:]\s*|\s+)?(.*)$/i.exec(firstLine);
  if (articleMatch && !isLikelyTableOfContentsLine(firstLine)) {
    const articleId = articleMatch[1];
    const { title: articleTitle, isValid } = resolveStructuredHeadingTitle(
      articleMatch[2] ?? "",
      trailingLines
    );
    if (!isValid) {
      return null;
    }
    return [buildHeadingLabel("Article", articleId, articleTitle)];
  }

  const inheritedSubsectionMatch = /^([a-z]|\d+[a-z]?)(?:[.)]|(?=\s)|$)(?:\s+)?(.*)$/i.exec(firstLine);
  if (inheritedSubsectionMatch && !isLikelyTableOfContentsLine(firstLine)) {
    const inheritedSubsectionPath = buildInheritedSubsectionPath(
      inheritedPath,
      inheritedSubsectionMatch[1],
      resolveSubsectionTitle(inheritedSubsectionMatch[2] ?? "", trailingLines)
    );
    if (inheritedSubsectionPath) {
      return inheritedSubsectionPath;
    }
  }

  const romanArticleMatch = /^([ivxlcdm]+)\.?$/i.exec(firstLine);
  if (romanArticleMatch && trailingLines[0] && isLikelyHeadingTitleLine(trailingLines[0])) {
    return [buildHeadingLabel("Article", romanArticleMatch[1], normalizeHeadingLabelText(trailingLines[0]))];
  }

  const numericArticleMatch = /^(\d+[a-z]?)\.?$/.exec(firstLine);
  if (numericArticleMatch && trailingLines[0] && isLikelyHeadingTitleLine(trailingLines[0])) {
    return [buildHeadingLabel("Section", numericArticleMatch[1], normalizeHeadingLabelText(trailingLines[0]))];
  }

  const inheritedLabel = inheritedPath.at(-1) ?? null;
  if (
    inheritedLabel &&
    !inheritedLabel.includes("—") &&
    nonEmptyLines.length === 1 &&
    isLikelyHeadingTitleLine(firstLine)
  ) {
    const updatedPath = [...inheritedPath];
    updatedPath[updatedPath.length - 1] = `${inheritedLabel} — ${normalizeHeadingLabelText(firstLine)}`;
    return updatedPath;
  }

  return null;
}

function resolveHeadingContext(text: string, inheritedPath: string[]) {
  const nextPath = [...inheritedPath];
  let blockPath = [...inheritedPath];
  const nonEmptyLines = text.split("\n").map((line) => line.trim()).filter(Boolean);

  for (const rawLine of nonEmptyLines) {
    const line = rawLine.trim();
    const match = /^(#{1,6})\s+(.+)$/.exec(line);
    if (!match) {
      continue;
    }

    const level = match[1].length;
    const label = match[2].trim();
    const scopedPath = nextPath.slice(0, Math.max(0, level - 1));
    scopedPath[level - 1] = label;
    nextPath.splice(0, nextPath.length, ...scopedPath);
    blockPath = [...scopedPath];
  }

  if (blockPath.length === inheritedPath.length) {
    const legalHeadingPath = buildLegalHeadingPath(nonEmptyLines, inheritedPath);
    if (legalHeadingPath) {
      nextPath.splice(0, nextPath.length, ...legalHeadingPath);
      blockPath = [...legalHeadingPath];
    }
  }

  return {
    nextPath,
    blockPath,
  };
}

type RangeLineInfo = {
  text: string;
  charStart: number;
};

function buildHeadingPathAtLine(
  lineInfos: RangeLineInfo[],
  startIndex: number,
  inheritedPath: string[]
) {
  const currentLine = lineInfos[startIndex]?.text.trim() ?? "";
  if (!currentLine) {
    return null;
  }

  const markdownMatch = /^(#{1,6})\s+(.+)$/.exec(currentLine);
  if (markdownMatch) {
    const level = markdownMatch[1].length;
    const label = markdownMatch[2].trim();
    const scopedPath = inheritedPath.slice(0, Math.max(0, level - 1));
    scopedPath[level - 1] = label;
    return scopedPath;
  }

  const candidateLines = lineInfos
    .slice(startIndex, startIndex + 3)
    .map((lineInfo) => lineInfo.text.trim())
    .filter(Boolean);
  if (candidateLines.length === 0) {
    return null;
  }

  return buildLegalHeadingPath(candidateLines, inheritedPath);
}

function splitRangeAtEmbeddedHeadings(
  value: string,
  range: ReturnType<typeof trimTextRange>,
  inheritedPath: string[]
) {
  if (!range) {
    return [];
  }

  const lineInfos: RangeLineInfo[] = [];
  let relativeOffset = 0;

  for (const line of range.text.split("\n")) {
    lineInfos.push({
      text: line,
      charStart: range.charStart + relativeOffset,
    });
    relativeOffset += line.length + 1;
  }

  const splitStarts = new Set<number>();
  let activePath = [...inheritedPath];

  for (let index = 0; index < lineInfos.length; index += 1) {
    const headingPath = buildHeadingPathAtLine(lineInfos, index, activePath);
    if (!headingPath) {
      continue;
    }

    const splitStart = lineInfos[index]?.charStart ?? range.charStart;
    if (splitStart > range.charStart) {
      splitStarts.add(splitStart);
    }
    activePath = headingPath;
  }

  if (splitStarts.size === 0) {
    return [range];
  }

  const splitRanges: Array<NonNullable<ReturnType<typeof trimTextRange>>> = [];
  let segmentStart = range.charStart;

  for (const splitStart of [...splitStarts].sort((left, right) => left - right)) {
    if (splitStart <= segmentStart) {
      continue;
    }

    const segment = trimTextRange(value, segmentStart, splitStart);
    if (segment) {
      splitRanges.push(segment);
    }
    segmentStart = splitStart;
  }

  const finalSegment = trimTextRange(value, segmentStart, range.charEnd);
  if (finalSegment) {
    splitRanges.push(finalSegment);
  }

  return splitRanges.length > 0 ? splitRanges : [range];
}

function resolveRangeSectionMetadata(sectionPath: string[]) {
  let sheetName: string | null = null;
  let slideNumber: number | null = null;

  for (let index = sectionPath.length - 1; index >= 0; index -= 1) {
    const entry = sectionPath[index]?.trim();
    if (!entry) {
      continue;
    }

    if (!sheetName) {
      const sheetMatch = /^Sheet:\s+(.+)$/i.exec(entry);
      if (sheetMatch) {
        sheetName = sheetMatch[1].trim();
      }
    }

    if (slideNumber == null) {
      const slideMatch = /^Slide\s+(\d+)\b/i.exec(entry);
      if (slideMatch) {
        slideNumber = Number(slideMatch[1]);
      }
    }
  }

  return {
    sectionLabel: sectionPath.at(-1) ?? null,
    sheetName,
    slideNumber,
  };
}

function findPreferredBreak(
  value: string,
  start: number,
  preferredEnd: number,
  minimumEnd: number
) {
  const newlineSearchStart = Math.max(start, minimumEnd);
  const newlineIndex = value.lastIndexOf("\n", preferredEnd - 1);
  if (newlineIndex >= newlineSearchStart) {
    return newlineIndex;
  }

  for (let index = preferredEnd - 1; index >= minimumEnd; index -= 1) {
    if (/\s/.test(value.charAt(index)) && /[.!?]/.test(value.charAt(index - 1))) {
      return index;
    }
  }

  const spaceIndex = value.lastIndexOf(" ", preferredEnd - 1);
  if (spaceIndex >= minimumEnd) {
    return spaceIndex;
  }

  return preferredEnd;
}

function splitOversizedRange(
  value: string,
  range: NormalizedTextRange,
  maxChunkChars: number
) {
  const segments: NormalizedTextRange[] = [];
  let cursor = range.charStart;

  while (cursor < range.charEnd) {
    const preferredEnd = Math.min(range.charEnd, cursor + maxChunkChars);
    const minimumEnd = Math.min(
      range.charEnd,
      cursor + Math.max(MINIMUM_FALLBACK_CHUNK_CHARS, Math.floor(maxChunkChars / 2))
    );
    const boundary =
      preferredEnd >= range.charEnd
        ? range.charEnd
        : findPreferredBreak(value, cursor, preferredEnd, minimumEnd);

    const trimmedRange = trimTextRange(value, cursor, boundary);
    if (trimmedRange) {
      segments.push({
        ...range,
        ...trimmedRange,
      });
    }

    const nextCursor = advancePastWhitespace(value, Math.max(boundary, cursor + 1), range.charEnd);
    if (nextCursor <= cursor) {
      break;
    }

    cursor = nextCursor;
  }

  return segments;
}

function collectNormalizedRanges(
  value: string,
  maxChunkChars: number,
  maxChunkTokens: number
) {
  const ranges: NormalizedTextRange[] = [];
  const blockMatcher = /\S[\s\S]*?(?=\n\s*\n|$)/g;
  let inheritedPath: string[] = [];

  for (const match of value.matchAll(blockMatcher)) {
    const matchStart = match.index ?? 0;
    const rawText = match[0] ?? "";
    const trimmedRange = trimTextRange(value, matchStart, matchStart + rawText.length);

    if (!trimmedRange) {
      continue;
    }

    for (const structuralRange of splitRangeAtEmbeddedHeadings(value, trimmedRange, inheritedPath)) {
      const { nextPath, blockPath } = resolveHeadingContext(structuralRange.text, inheritedPath);
      inheritedPath = nextPath;
      const sectionMetadata = resolveRangeSectionMetadata(blockPath);
      const range: NormalizedTextRange = {
        ...structuralRange,
        ...sectionMetadata,
        sectionPath: [...blockPath],
        referencedLocationLabels: filterReferencedLocationLabels(
          extractReferencedLocationLabels(structuralRange.text),
          blockPath
        ),
      };

      if (estimateTextTokens(range.text) <= maxChunkTokens) {
        ranges.push(range);
        continue;
      }

      ranges.push(...splitOversizedRange(value, range, maxChunkChars));
    }
  }

  return ranges;
}

function buildChunkProvenanceLabel(range: NormalizedTextRange, chunkIndex: number) {
  const locationParts = [];

  if (range.sheetName) {
    locationParts.push(`Sheet: ${range.sheetName}`);
  } else if (range.slideNumber != null) {
    locationParts.push(`Slide ${range.slideNumber}`);
  } else if (range.sectionLabel) {
    locationParts.push(range.sectionLabel);
  }

  locationParts.push(`chars ${range.charStart + 1}-${range.charEnd}`);
  return `Excerpt ${chunkIndex + 1} (${locationParts.join("; ")})`;
}

function isHeadingLikeText(value: string) {
  const trimmed = value.trim();
  if (!trimmed) {
    return false;
  }

  if (/^#{1,6}\s+.+/m.test(trimmed)) {
    return true;
  }

  return buildLegalHeadingPath(
    trimmed.split("\n").map((line) => line.trim()).filter(Boolean),
    []
  ) != null;
}

function isHeadingLikeRange(range: NormalizedTextRange) {
  return isHeadingLikeText(range.text);
}

function isLegalSectionLabel(value: string | null | undefined) {
  return /^(article|section|exhibit|schedule)\b/i.test(value?.trim() ?? "");
}

function shouldSplitPendingRangesAtLegalBoundary(
  pendingRanges: NormalizedTextRange[],
  nextRange: NormalizedTextRange
) {
  const pendingLabel =
    [...pendingRanges].reverse().find((range) => range.sectionLabel)?.sectionLabel ?? null;
  const nextLabel = nextRange.sectionLabel;
  if (!pendingLabel || !nextLabel) {
    return false;
  }

  if (!isLegalSectionLabel(pendingLabel) || !isLegalSectionLabel(nextLabel)) {
    return false;
  }

  return normalizeOccurrenceQueryText(pendingLabel) !== normalizeOccurrenceQueryText(nextLabel);
}

function mergeChunkRanges(
  params: Omit<ContextDocumentChunkCandidateParams, "text"> & {
    ranges: NormalizedTextRange[];
    chunkIndex: number;
  }
): ContextDocumentChunk {
  const firstRange = params.ranges[0];
  const lastRange = params.ranges[params.ranges.length - 1];
  const mostSpecificRange =
    [...params.ranges].reverse().find((range) => range.sectionPath.length > 0) ??
    firstRange;
  const text = joinMarkdownSections(params.ranges.map((range) => range.text));

  return {
    sourceId: params.sourceId,
    attachmentId: params.attachmentId ?? params.sourceId,
    fileId: params.fileId ?? params.sourceId,
    sourceOrderIndex: params.sourceOrderIndex ?? 0,
    filename: params.filename,
    sourceType: params.sourceType,
    chunkIndex: params.chunkIndex,
    text,
    approxTokenCount: estimateTextTokens(text),
    charStart: firstRange.charStart,
    charEnd: lastRange.charEnd,
    extractionStatus: "extracted",
    parentSourceStatus: "used",
    safeProvenanceLabel: buildChunkProvenanceLabel(
      {
        ...mostSpecificRange,
        charStart: firstRange.charStart,
        charEnd: lastRange.charEnd,
      },
      params.chunkIndex
    ),
    sectionLabel: mostSpecificRange.sectionLabel,
    sectionPath: [...mostSpecificRange.sectionPath],
    referencedLocationLabels: filterReferencedLocationLabels(
      dedupeTokens(params.ranges.flatMap((range) => range.referencedLocationLabels)),
      mostSpecificRange.sectionPath
    ),
    sheetName: mostSpecificRange.sheetName,
    slideNumber: mostSpecificRange.slideNumber,
  };
}

function truncateChunkTextToFitBudget(value: string, maxChars: number) {
  if (value.length <= maxChars) {
    return {
      text: value,
      visibleSourceChars: value.length,
    };
  }

  const suffix = `\n... [truncated ${value.length - Math.max(0, maxChars - 32)} chars]`;
  if (suffix.length >= maxChars) {
    return {
      text: value.slice(0, maxChars),
      visibleSourceChars: maxChars,
    };
  }

  const visibleSourceChars = maxChars - suffix.length;
  return {
    text: `${value.slice(0, visibleSourceChars)}\n... [truncated ${value.length - visibleSourceChars} chars]`,
    visibleSourceChars,
  };
}

function clampDocumentChunkToBudget(chunk: ContextDocumentChunk, maxChars: number) {
  if (maxChars <= 0) {
    return null;
  }

  let { text, visibleSourceChars } = truncateChunkTextToFitBudget(chunk.text, maxChars);
  if (visibleSourceChars < MINIMUM_PARTIAL_CHUNK_CHARS && maxChars >= MINIMUM_PARTIAL_CHUNK_CHARS) {
    text = chunk.text.slice(0, maxChars);
    visibleSourceChars = maxChars;
  }

  if (!text.trim() || visibleSourceChars < Math.min(MINIMUM_PARTIAL_CHUNK_CHARS, chunk.text.length)) {
    return null;
  }

  return {
    ...chunk,
    text,
    approxTokenCount: estimateTextTokens(text),
    charEnd: chunk.charStart + visibleSourceChars,
    wasBudgetClamped: true,
    originalCharEnd: chunk.charEnd,
    originalApproxTokenCount: chunk.approxTokenCount,
  } satisfies ContextDocumentChunk;
}

export function buildDocumentChunkCandidates(params: ContextDocumentChunkCandidateParams) {
  const normalizedText = params.text?.trim() ?? "";
  if (!normalizedText) {
    return [];
  }

  const charsPerToken = Math.max(1, params.charsPerToken ?? DEFAULT_APPROX_CHARS_PER_TOKEN);
  const maxChunkTokens = Math.max(1, params.maxChunkTokens ?? DEFAULT_DOCUMENT_CHUNK_MAX_TOKENS);
  const maxChunkChars = maxChunkTokens * charsPerToken;
  const ranges = collectNormalizedRanges(normalizedText, maxChunkChars, maxChunkTokens);
  if (ranges.length === 0) {
    return [];
  }

  const chunks: ContextDocumentChunk[] = [];
  let pendingRanges: NormalizedTextRange[] = [];
  let pendingTokens = 0;

  for (const [rangeIndex, range] of ranges.entries()) {
    const rangeTokens = estimateTextTokens(range.text);
    const nextRange = ranges[rangeIndex + 1] ?? null;
    const carryHeadingForward = isHeadingLikeRange(range) && nextRange != null;
    const pendingHeadingOnly =
      pendingRanges.length > 0 && pendingRanges.every((pendingRange) => isHeadingLikeRange(pendingRange));

    if (
      pendingRanges.length > 0 &&
      !pendingHeadingOnly &&
      shouldSplitPendingRangesAtLegalBoundary(pendingRanges, range)
    ) {
      chunks.push(
        mergeChunkRanges({
          ...params,
          ranges: pendingRanges,
          chunkIndex: chunks.length,
        })
      );
      pendingRanges = [];
      pendingTokens = 0;
    }

    if (carryHeadingForward && pendingRanges.length > 0 && !pendingHeadingOnly) {
      chunks.push(
        mergeChunkRanges({
          ...params,
          ranges: pendingRanges,
          chunkIndex: chunks.length,
        })
      );
      pendingRanges = [];
      pendingTokens = 0;
    }

    if (
      pendingRanges.length > 0 &&
      pendingTokens + rangeTokens > maxChunkTokens &&
      !(pendingHeadingOnly && !isHeadingLikeRange(range))
    ) {
      chunks.push(
        mergeChunkRanges({
          ...params,
          ranges: pendingRanges,
          chunkIndex: chunks.length,
        })
      );
      pendingRanges = [];
      pendingTokens = 0;
    }

    pendingRanges.push(range);
    pendingTokens += rangeTokens;
  }

  if (pendingRanges.length > 0) {
    chunks.push(
      mergeChunkRanges({
        ...params,
        ranges: pendingRanges,
        chunkIndex: chunks.length,
      })
    );
  }

  return chunks;
}

export function rankDocumentChunks(params: {
  chunks: ContextDocumentChunk[];
  query: string | null | undefined;
}): ContextDocumentChunkRankingResult {
  const orderedChunks = buildRankingOrderChunkList(params.chunks);
  const query = prepareChunkRankingQuery(params.query);
  const rankingDisabledReason: ContextDocumentChunkRankingFallbackReason =
    query.normalizedText.length === 0
      ? "empty_query"
      : query.keywordTokens.length === 0 && query.referencedSlideNumbers.size === 0
        ? "low_signal_query"
        : null;

  if (rankingDisabledReason) {
    return {
      rankedChunks: orderedChunks,
      rankingEnabled: false,
      rankingStrategy: DEFAULT_DOCUMENT_CHUNK_RANKING_STRATEGY,
      queryTokenCount: query.keywordTokens.length,
      fallbackReason: rankingDisabledReason,
      occurrenceIntentDetected: query.occurrenceIntentDetected,
      occurrenceTargetPhrase: query.targetPhrase,
      details: orderedChunks.map((chunk, rankingOrder) => ({
        sourceId: chunk.sourceId,
        sourceOrderIndex: chunk.sourceOrderIndex,
        chunkIndex: chunk.chunkIndex,
        score: 0,
        signalLabels: [],
        rankingOrder,
        exactPhraseMatchCount: 0,
        definitionBoostApplied: false,
        coverageGroupKey: null,
      })),
    };
  }

  const scoredChunks = orderedChunks.map((chunk) => ({
    chunk,
    ...scoreDocumentChunk({
      chunk,
      query,
    }),
  }));

  for (let index = 1; index < scoredChunks.length; index += 1) {
    const currentEntry = scoredChunks[index];
    const previousEntry = scoredChunks[index - 1];

    if (
      currentEntry.coverageGroupKey == null &&
      currentEntry.exactPhraseMatchCount > 0 &&
      currentEntry.chunk.sourceId === previousEntry.chunk.sourceId &&
      currentEntry.chunk.chunkIndex === previousEntry.chunk.chunkIndex + 1 &&
      previousEntry.coverageGroupKey != null &&
      isHeadingLikeText(previousEntry.chunk.text)
    ) {
      currentEntry.coverageGroupKey = previousEntry.coverageGroupKey;
      currentEntry.score += 8;
      currentEntry.signalLabels = dedupeTokens([
        ...currentEntry.signalLabels,
        "coverage_heading_context_inherited",
      ]);
      continue;
    }

    if (
      currentEntry.coverageGroupKey == null &&
      currentEntry.exactPhraseMatchCount > 0 &&
      currentEntry.chunk.sourceId === previousEntry.chunk.sourceId &&
      currentEntry.chunk.chunkIndex === previousEntry.chunk.chunkIndex + 1 &&
      previousEntry.coverageGroupKey != null &&
      previousEntry.exactPhraseMatchCount > 0
    ) {
      currentEntry.coverageGroupKey = previousEntry.coverageGroupKey;
      currentEntry.score += 4;
      currentEntry.signalLabels = dedupeTokens([
        ...currentEntry.signalLabels,
        "coverage_group_continuation",
      ]);
    }
  }

  if (query.occurrenceIntentDetected && query.targetPhrase) {
    const rootFamilyCoverage = new Map<string, Set<string>>();
    const parentFamilyCoverage = new Map<string, Set<string>>();

    for (const entry of scoredChunks) {
      if (entry.exactPhraseMatchCount <= 0) {
        continue;
      }

      const coverageKey = entry.coverageGroupKey ?? buildChunkKey(entry.chunk);
      const { rootFamilyKey, parentFamilyKey } = resolveChunkLocationFamilyKeys({
        chunk: entry.chunk,
        coverageGroupKey: entry.coverageGroupKey,
      });

      if (rootFamilyKey) {
        const rootCoverage = rootFamilyCoverage.get(rootFamilyKey) ?? new Set<string>();
        rootCoverage.add(coverageKey);
        rootFamilyCoverage.set(rootFamilyKey, rootCoverage);
      }

      if (parentFamilyKey) {
        const parentCoverage = parentFamilyCoverage.get(parentFamilyKey) ?? new Set<string>();
        parentCoverage.add(coverageKey);
        parentFamilyCoverage.set(parentFamilyKey, parentCoverage);
      }
    }

    for (const entry of scoredChunks) {
      if (entry.exactPhraseMatchCount <= 0) {
        continue;
      }

      const { rootFamilyKey, parentFamilyKey } = resolveChunkLocationFamilyKeys({
        chunk: entry.chunk,
        coverageGroupKey: entry.coverageGroupKey,
      });
      const rootFamilySize = rootFamilyKey ? (rootFamilyCoverage.get(rootFamilyKey)?.size ?? 0) : 0;
      const parentFamilySize = parentFamilyKey ? (parentFamilyCoverage.get(parentFamilyKey)?.size ?? 0) : 0;

      if (rootFamilySize > 1) {
        entry.score += Math.min(rootFamilySize - 1, 4) * 4;
        entry.signalLabels = dedupeTokens([
          ...entry.signalLabels,
          "root_location_density",
        ]);
      }

      if (parentFamilySize > 1) {
        entry.score += Math.min(parentFamilySize - 1, 4) * 8;
        entry.signalLabels = dedupeTokens([
          ...entry.signalLabels,
          "parent_location_density",
        ]);
      }

      if (rootFamilySize >= 3 && parentFamilySize <= 1) {
        entry.score -= 16;
        entry.signalLabels = dedupeTokens([
          ...entry.signalLabels,
          "isolated_parent_penalty",
        ]);
      }
    }
  }

  const rankedChunks = [...scoredChunks]
    .sort((left, right) =>
      right.score - left.score ||
      left.chunk.sourceOrderIndex - right.chunk.sourceOrderIndex ||
      left.chunk.chunkIndex - right.chunk.chunkIndex
    )
    .map((entry) => entry.chunk);

  const detailsByKey = new Map<string, Omit<ContextDocumentChunkRankingDetail, "rankingOrder">>();
  for (const entry of scoredChunks) {
    detailsByKey.set(`${entry.chunk.sourceId}:${entry.chunk.chunkIndex}`, {
      sourceId: entry.chunk.sourceId,
      sourceOrderIndex: entry.chunk.sourceOrderIndex,
      chunkIndex: entry.chunk.chunkIndex,
      score: entry.score,
      signalLabels: entry.signalLabels,
      exactPhraseMatchCount: entry.exactPhraseMatchCount,
      definitionBoostApplied: entry.definitionBoostApplied,
      coverageGroupKey: entry.coverageGroupKey,
    });
  }

  return {
    rankedChunks,
    rankingEnabled: true,
    rankingStrategy: DEFAULT_DOCUMENT_CHUNK_RANKING_STRATEGY,
    queryTokenCount: query.keywordTokens.length,
    fallbackReason: null,
    occurrenceIntentDetected: query.occurrenceIntentDetected,
    occurrenceTargetPhrase: query.targetPhrase,
    details: rankedChunks.map((chunk, rankingOrder) => ({
      ...(detailsByKey.get(`${chunk.sourceId}:${chunk.chunkIndex}`) ?? {
        sourceId: chunk.sourceId,
        sourceOrderIndex: chunk.sourceOrderIndex,
        chunkIndex: chunk.chunkIndex,
        score: 0,
        signalLabels: [],
        exactPhraseMatchCount: 0,
        definitionBoostApplied: false,
        coverageGroupKey: null,
      }),
      rankingOrder,
    })),
  };
}

export function selectDocumentChunksInOrder(params: {
  chunks: ContextDocumentChunk[];
  maxChars: number;
  selectionMode?: ContextDocumentChunkSelectionMode;
  ranking?: ContextDocumentChunkRankingResult | null;
}) {
  const coverageOrder = params.ranking
    ? buildCoverageAwareChunkOrder({
        chunks: params.chunks,
        ranking: params.ranking,
      })
    : {
        orderedChunks: params.chunks,
        coverageSelectionApplied: false,
        prioritizedChunkKeys: new Set<string>(),
      };
  const selectedChunks: ContextDocumentChunk[] = [];
  let selectedCharCount = 0;
  let usedBudgetClamp = false;

  for (const chunk of coverageOrder.orderedChunks) {
    const nextSelectedCharCount = selectedCharCount + chunk.text.length;
    if (nextSelectedCharCount > params.maxChars) {
      break;
    }

    selectedChunks.push(chunk);
    selectedCharCount = nextSelectedCharCount;
  }

  const remainingChars = Math.max(0, params.maxChars - selectedCharCount);
  if (selectedChunks.length < coverageOrder.orderedChunks.length && remainingChars > 0) {
    const partiallySelectedChunk = clampDocumentChunkToBudget(
      coverageOrder.orderedChunks[selectedChunks.length],
      remainingChars
    );

    if (partiallySelectedChunk) {
      selectedChunks.push(partiallySelectedChunk);
      selectedCharCount += partiallySelectedChunk.text.length;
      usedBudgetClamp = true;
    }
  }

  const selectedChunkKeys = new Set(selectedChunks.map((chunk) => buildChunkKey(chunk)));
  const skippedChunks = params.chunks.filter(
    (chunk) => !selectedChunkKeys.has(buildChunkKey(chunk))
  );
  return {
    selectedChunks,
    skippedChunks,
    selectedApproxTokenCount: selectedChunks.reduce(
      (sum, chunk) => sum + chunk.approxTokenCount,
      0
    ),
    totalApproxTokenCount: params.chunks.reduce((sum, chunk) => sum + chunk.approxTokenCount, 0),
    selectedCharCount,
    totalCharCount: params.chunks.reduce((sum, chunk) => sum + chunk.text.length, 0),
    selectionMode: params.selectionMode ?? "document-order",
    usedBudgetClamp,
    coverageSelectionApplied: coverageOrder.coverageSelectionApplied,
    selectedDueToCoverageChunkKeys: selectedChunks
      .map((chunk) => buildChunkKey(chunk))
      .filter((chunkKey) => coverageOrder.prioritizedChunkKeys.has(chunkKey)),
  } satisfies ContextDocumentChunkSelectionResult;
}
