import { readFile } from "fs/promises";
import { normalize, resolve, sep } from "path";
import mammoth from "mammoth";
import { parseOffice, type OfficeContentNode, type SlideMetadata } from "officeparser";
import * as XLSX from "xlsx";
import { prisma } from "./prisma";

export type ConversationContextSourceStatus = "used" | "unsupported" | "failed" | "unavailable";

export type ConversationContextSourceId =
  | "thread_documents"
  | "company_documents"
  | "browsing"
  | "memory"
  | "live_data";

export type ConversationContextSourceScope = "thread" | "workspace" | "user" | "external" | "unknown";

export type ConversationContextSourcePolicyMode =
  | "thread_active_membership"
  | "future_authorized_retrieval"
  | "unknown";

export type ConversationContextSourceRequestMode = "default" | "plan";

export type ConversationContextSourceRequestOrigin =
  | "default_system_candidate"
  | "explicit_user_request"
  | "planner_proposed"
  | "policy_required"
  | "fallback_candidate";

export type ConversationContextSourceRequestStatus =
  | "candidate"
  | "requested"
  | "proposed"
  | "required";

export type ConversationContextSourceExclusionCategory =
  | "registration"
  | "scope"
  | "authorization"
  | "availability"
  | "implementation"
  | "budget";

export type ConversationContextSourceExclusionReason =
  | "not_registered"
  | "not_in_scope"
  | "not_available"
  | "requesting_user_not_allowed"
  | "active_agent_not_allowed"
  | "not_implemented"
  | "budget_exhausted";

export type ConversationContextSourceDecisionReason =
  | "allowed"
  | ConversationContextSourceExclusionReason;

export type ConversationContextSourceEligibility = {
  isRegistered: boolean;
  isInScope: boolean;
  isAvailable: boolean;
  isRequestingUserAllowed: boolean;
  isActiveAgentAllowed: boolean;
  isImplemented: boolean;
};

export type ConversationContextSourceExclusion = {
  category: ConversationContextSourceExclusionCategory;
  reason: ConversationContextSourceExclusionReason;
  detail: string;
};

export type ConversationContextSourceDecision = {
  sourceId: string;
  label: string;
  request: {
    status: ConversationContextSourceRequestStatus;
    mode: ConversationContextSourceRequestMode;
    origins: ConversationContextSourceRequestOrigin[];
    detail: string;
  };
  admission: {
    status: "allowed" | "excluded";
  };
  execution: {
    status: "executed" | "not_executed";
    detail: string;
    summary: {
      totalCount: number;
      usedCount: number;
      unsupportedCount: number;
      failedCount: number;
      unavailableCount: number;
      excludedCategories: ConversationContextSourceExclusionCategory[];
    } | null;
  };
  exclusion: ConversationContextSourceExclusion | null;
  status: "allowed" | "excluded";
  reason: ConversationContextSourceDecisionReason;
  detail: string;
  domain: string;
  scope: ConversationContextSourceScope;
  policyMode: ConversationContextSourcePolicyMode;
  eligibility: ConversationContextSourceEligibility;
};

export type ConversationContextSource = {
  kind: "thread-document";
  label: string;
  target: string;
  detail: string;
  status: ConversationContextSourceStatus;
  domain: "thread_documents";
  scope: "thread";
};

export type ConversationContextSummarySource = {
  id: string;
  label: string;
  description: string;
};

export type ConversationContextSourceAuthority = {
  requestingUserId: string | null;
  activeUserIds: string[];
  activeAgentId: string | null;
  activeAgentIds: string[];
};

export type ConversationContextAcquisitionPlan = {
  // Future LLM planning can propose a ranked/source-specific acquisition plan here.
  // The app-side resolver will still evaluate registry + eligibility before execution.
  requestedSourceIds?: string[];
  sourceRequests?: Array<{
    sourceId: string;
    origin: Exclude<ConversationContextSourceRequestOrigin, "default_system_candidate">;
  }>;
};

export type ConversationContextSourceSelection = {
  requestMode: ConversationContextSourceRequestMode;
  consideredSourceIds: string[];
  defaultCandidateSourceIds: string[];
  explicitUserRequestedSourceIds: string[];
  requestedSourceIds: string[];
  plannerProposedSourceIds: string[];
  policyRequiredSourceIds: string[];
  fallbackCandidateSourceIds: string[];
  allowedSourceIds: string[];
  executedSourceIds: string[];
  excludedSourceIds: string[];
};

export type ConversationContextBundle = {
  text: string;
  sources: ConversationContextSource[];
  summarySources: ConversationContextSummarySource[];
  sourceSelection: ConversationContextSourceSelection;
  sourceDecisions: ConversationContextSourceDecision[];
};

type ConversationContextDocumentRecord = {
  id: string;
  conversationId: string;
  filename: string;
  mimeType: string | null;
  fileType: string;
  storagePath: string;
};

type ConversationContextResolverDependencies = {
  listDocuments?: (conversationId: string) => Promise<ConversationContextDocumentRecord[]>;
  readTextFile?: (storagePath: string) => Promise<string>;
  readBinaryFile?: (storagePath: string) => Promise<Buffer>;
  extractPdfText?: (fileBuffer: Buffer) => Promise<string>;
  extractDocxText?: (fileBuffer: Buffer) => Promise<string>;
  extractPptxText?: (fileBuffer: Buffer) => Promise<string>;
  extractSpreadsheetText?: (
    fileBuffer: Buffer,
    document: Pick<ConversationContextDocumentRecord, "filename" | "mimeType">
  ) => Promise<string>;
};

export const MAX_THREAD_DOCUMENT_CONTEXT_CHARS = 2_000;
export const MAX_THREAD_DOCUMENT_CONTEXT_BUNDLE_CHARS = 6_000;
const SUPPORTED_THREAD_TEXT_EXTENSIONS = new Set(["txt", "md"]);
const SUPPORTED_THREAD_PDF_EXTENSIONS = new Set(["pdf"]);
const SUPPORTED_THREAD_DOCX_EXTENSIONS = new Set(["docx"]);
const SUPPORTED_THREAD_PPTX_EXTENSIONS = new Set(["pptx"]);
const SUPPORTED_THREAD_SPREADSHEET_EXTENSIONS = new Set(["xlsx", "csv", "tsv"]);
const SUPPORTED_THREAD_IMAGE_EXTENSIONS = new Set(["png", "jpg", "jpeg", "webp"]);
const THREAD_DOCUMENT_SUPPORT_DETAIL =
  "plain text, markdown, PDF, DOCX, PPTX, XLSX, CSV, TSV, and baseline PNG/JPG/JPEG/WEBP image attachment handling";
const CONVERSATION_CONTEXT_SOURCE_REGISTRY = [
  {
    id: "thread_documents",
    label: "Thread-attached documents",
    domain: "thread_documents",
    scope: "thread",
    policyMode: "thread_active_membership",
    isAvailable: true,
    isImplemented: true,
  },
  {
    id: "company_documents",
    label: "Company documents",
    domain: "company_documents",
    scope: "workspace",
    policyMode: "future_authorized_retrieval",
    isAvailable: true,
    isImplemented: false,
  },
  {
    id: "browsing",
    label: "Browsing",
    domain: "browsing",
    scope: "external",
    policyMode: "future_authorized_retrieval",
    isAvailable: true,
    isImplemented: false,
  },
  {
    id: "memory",
    label: "Memory",
    domain: "memory",
    scope: "user",
    policyMode: "future_authorized_retrieval",
    isAvailable: true,
    isImplemented: false,
  },
  {
    id: "live_data",
    label: "Live data",
    domain: "live_data",
    scope: "workspace",
    policyMode: "future_authorized_retrieval",
    isAvailable: true,
    isImplemented: false,
  },
] as const satisfies ReadonlyArray<{
  id: ConversationContextSourceId;
  label: string;
  domain: ConversationContextSourceId;
  scope: Exclude<ConversationContextSourceScope, "unknown">;
  policyMode: Exclude<ConversationContextSourcePolicyMode, "unknown">;
  isAvailable: boolean;
  isImplemented: boolean;
}>;
const CONVERSATION_CONTEXT_SOURCE_REGISTRY_BY_ID = new Map(
  CONVERSATION_CONTEXT_SOURCE_REGISTRY.map((source) => [source.id, source])
);
const CONVERSATION_CONTEXT_SOURCE_REQUEST_ORIGIN_PRECEDENCE = [
  "policy_required",
  "explicit_user_request",
  "planner_proposed",
  "fallback_candidate",
  "default_system_candidate",
] as const satisfies ReadonlyArray<ConversationContextSourceRequestOrigin>;
const CONVERSATION_CONTEXT_SOURCE_REQUEST_STATUS_BY_ORIGIN = {
  default_system_candidate: "candidate",
  explicit_user_request: "requested",
  planner_proposed: "proposed",
  policy_required: "required",
  fallback_candidate: "candidate",
} as const satisfies Record<
  ConversationContextSourceRequestOrigin,
  ConversationContextSourceRequestStatus
>;
const NON_DEFAULT_CONVERSATION_CONTEXT_SOURCE_REQUEST_ORIGINS = new Set<
  Exclude<ConversationContextSourceRequestOrigin, "default_system_candidate">
>([
  "explicit_user_request",
  "planner_proposed",
  "policy_required",
  "fallback_candidate",
]);
type PdfParseModule = typeof import("pdf-parse");
type ExtractionRuntimeError = Error & {
  code?: string;
  detail?: string | null;
};

let pdfJsWorkerBootstrapPromise: Promise<void> | null = null;
let pdfParseModulePromise: Promise<PdfParseModule> | null = null;
const MAX_SPREADSHEET_SHEETS = 3;
const MAX_SPREADSHEET_ROWS_PER_SHEET = 20;
const MAX_SPREADSHEET_COLUMNS_PER_ROW = 8;
const MAX_SPREADSHEET_EXTRACTED_CHARS = 4_000;
const MAX_SPREADSHEET_HEAD_ROWS = 4;
const MAX_SPREADSHEET_SUMMARY_ROWS = 3;
const MAX_SPREADSHEET_DISTINCT_VALUE_ROWS = 6;
const MAX_SPREADSHEET_KEY_COLUMNS = 2;
const MAX_PPTX_SLIDES = 12;
const MAX_PPTX_SLIDE_TEXT_LINES = 8;
const MAX_PPTX_NOTE_LINES = 4;
const MAX_PPTX_EXTRACTED_CHARS = 4_000;

type SpreadsheetRow = {
  rowNumber: number;
  cells: string[];
};

type SpreadsheetSheetAnalysis = {
  sheetName: string;
  rows: SpreadsheetRow[];
  score: number;
  isMeaningful: boolean;
  headerRowIndex: number;
  startRowNumber: number;
  regionCount: number;
};

function summarizeExtractionError(error: unknown) {
  if (!(error instanceof Error)) {
    return null;
  }

  const normalized = error.message.replace(/\s+/g, " ").trim();
  if (!normalized) {
    return null;
  }

  return normalized.length > 180 ? `${normalized.slice(0, 177)}...` : normalized;
}

function buildPdfNoReadableTextDetail() {
  return "Attached to this thread, but the PDF parser returned no readable text. This usually means the PDF is image-based/scanned or uses an unsupported text layer.";
}

function buildPptxNoReadableTextDetail() {
  return "Attached to this thread, but the PPTX parser returned no readable slide text. This usually means the deck contains little extractable text beyond visuals, charts, or embedded media.";
}

function buildImageRuntimeUnavailableDetail() {
  return "Attached to this thread, but the current Team Chat runtime does not yet load image attachments into the active model context.";
}

function buildSpreadsheetNoReadableTextDetail() {
  return "Attached to this thread, but the spreadsheet parser returned no readable workbook content.";
}

function createPdfRuntimeUnavailableError(error: unknown) {
  const runtimeError = new Error(
    "PDF extraction is unavailable in the current server runtime."
  ) as ExtractionRuntimeError;
  runtimeError.code = "PDF_RUNTIME_UNAVAILABLE";
  runtimeError.detail = summarizeExtractionError(error);
  return runtimeError;
}

function isPdfRuntimeUnavailableError(error: unknown): error is ExtractionRuntimeError {
  return typeof error === "object"
    && error !== null
    && "code" in error
    && (error as { code?: unknown }).code === "PDF_RUNTIME_UNAVAILABLE";
}

function buildExtractionFailureDetail(contextKind: "pdf" | "docx" | "pptx" | "spreadsheet", error: unknown) {
  if (contextKind === "pdf") {
    if (isPdfRuntimeUnavailableError(error)) {
      const detail = typeof error.detail === "string" && error.detail.trim().length > 0
        ? ` (${error.detail.trim()})`
        : "";
      return `Attached to this thread, but PDF extraction is unavailable in the current server runtime${detail}.`;
    }

    const message = summarizeExtractionError(error);
    return message
      ? `Attached to this thread, but the PDF parser failed before usable text could be extracted (${message}).`
      : "Attached to this thread, but the PDF parser failed before usable text could be extracted.";
  }

  const message = summarizeExtractionError(error);

  if (contextKind === "pptx") {
    return message
      ? `Attached to this thread, but the PPTX parser failed before usable slide text could be extracted (${message}).`
      : "Attached to this thread, but the PPTX parser failed before usable slide text could be extracted.";
  }

  if (contextKind === "spreadsheet") {
    return message
      ? `Attached to this thread, but the spreadsheet parser failed before usable workbook content could be extracted (${message}).`
      : "Attached to this thread, but the spreadsheet parser failed before usable workbook content could be extracted.";
  }

  return message
    ? `Attached to this thread, but the DOCX parser failed before usable text could be extracted (${message}).`
    : "Attached to this thread, but the DOCX parser failed before usable text could be extracted.";
}

function buildUsedThreadDocumentDetail(charCount: number, truncated: boolean) {
  const readableChars = charCount.toLocaleString("en-US");

  return truncated
    ? `Read ${readableChars} readable characters from this thread attachment and truncated it to fit the active runtime context budget.`
    : `Read ${readableChars} readable characters from this thread attachment and included it in the active runtime context.`;
}

function normalizeDocumentText(value: string) {
  return value
    .replace(/\r\n/g, "\n")
    .replace(/\u0000/g, "")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function normalizeSpreadsheetCell(value: unknown) {
  if (value == null) return "";
  if (typeof value === "string") {
    return value.replace(/\s+/g, " ").trim();
  }
  if (typeof value === "number" || typeof value === "boolean" || typeof value === "bigint") {
    return String(value);
  }
  if (value instanceof Date) {
    return value.toISOString();
  }

  return String(value).replace(/\s+/g, " ").trim();
}

function normalizeDelimitedText(value: string) {
  return value.replace(/^\uFEFF/, "").replace(/\r\n/g, "\n").replace(/\r/g, "\n");
}

function trimSpreadsheetCells(cells: string[]) {
  let end = cells.length;
  while (end > 0 && cells[end - 1] === "") {
    end -= 1;
  }
  return cells.slice(0, end);
}

function countSpreadsheetCells(row: SpreadsheetRow) {
  return row.cells.length;
}

function isSpreadsheetRowEmpty(row: SpreadsheetRow) {
  return countSpreadsheetCells(row) === 0;
}

function parseSpreadsheetNumericCell(value: string) {
  const normalized = value.replace(/[$,%\s]/g, "").replace(/,/g, "");
  if (!/^[-+]?\d+(\.\d+)?$/.test(normalized)) {
    return null;
  }

  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : null;
}

function isLikelySpreadsheetLabel(value: string) {
  return /[A-Za-z]/.test(value);
}

function isLikelySpreadsheetSummaryRow(row: SpreadsheetRow) {
  return row.cells.some((cell) =>
    /\b(total|subtotal|average|avg|sum|grand total|overall|variance|balance|net)\b/i.test(cell)
  );
}

function formatSpreadsheetHeaderLabels(cells: string[]) {
  const seen = new Map<string, number>();

  return cells.map((value, index) => {
    const base = value || `Column ${index + 1}`;
    const key = base.toLowerCase();
    const count = (seen.get(key) ?? 0) + 1;
    seen.set(key, count);
    return count === 1 ? base : `${base} (${count})`;
  });
}

function scoreSpreadsheetHeaderCandidate(rows: SpreadsheetRow[], index: number) {
  const row = rows[index];
  const nonEmptyCount = countSpreadsheetCells(row);

  if (nonEmptyCount < 2) {
    return Number.NEGATIVE_INFINITY;
  }

  const uniqueCount = new Set(row.cells.map((cell) => cell.toLowerCase())).size;
  const labelLikeCount = row.cells.filter(isLikelySpreadsheetLabel).length;
  const lookahead = rows.slice(index + 1, index + 4);
  const structuredFollowerCount = lookahead.filter(
    (candidate) => countSpreadsheetCells(candidate) >= Math.min(2, nonEmptyCount)
  ).length;

  if (structuredFollowerCount === 0 || labelLikeCount < Math.ceil(nonEmptyCount / 2)) {
    return Number.NEGATIVE_INFINITY;
  }

  return (
    labelLikeCount * 4 +
    uniqueCount * 2 +
    structuredFollowerCount * 6 -
    (nonEmptyCount - uniqueCount) * 3 -
    index * 2
  );
}

function findLikelySpreadsheetHeaderRow(rows: SpreadsheetRow[]) {
  let bestIndex = -1;
  let bestScore = Number.NEGATIVE_INFINITY;

  for (let index = 0; index < Math.min(rows.length, 5); index += 1) {
    const score = scoreSpreadsheetHeaderCandidate(rows, index);
    if (score > bestScore) {
      bestScore = score;
      bestIndex = index;
    }
  }

  return bestScore >= 12 ? bestIndex : -1;
}

function segmentSpreadsheetRegions(rows: SpreadsheetRow[]) {
  const regions: SpreadsheetRow[][] = [];
  let currentRegion: SpreadsheetRow[] = [];

  for (const row of rows) {
    if (isSpreadsheetRowEmpty(row)) {
      if (currentRegion.length > 0) {
        regions.push(currentRegion);
        currentRegion = [];
      }
      continue;
    }

    currentRegion.push(row);
  }

  if (currentRegion.length > 0) {
    regions.push(currentRegion);
  }

  return regions;
}

function analyzeSpreadsheetRegion(
  sheetName: string,
  rows: SpreadsheetRow[],
  regionCount: number
): SpreadsheetSheetAnalysis | null {
  if (rows.length === 0) {
    return null;
  }

  const populatedCellCount = rows.reduce((total, row) => total + countSpreadsheetCells(row), 0);
  const maxColumns = rows.reduce((max, row) => Math.max(max, countSpreadsheetCells(row)), 0);
  const denseRows = rows.filter((row) => countSpreadsheetCells(row) >= 2);
  const singleCellRows = rows.filter((row) => countSpreadsheetCells(row) === 1);
  const summaryRows = rows.filter(isLikelySpreadsheetSummaryRow);
  const headerRowIndex = findLikelySpreadsheetHeaderRow(rows);
  const structuredRows = headerRowIndex >= 0
    ? rows.slice(headerRowIndex + 1).filter((row) => countSpreadsheetCells(row) >= 2)
    : denseRows;
  const isMeaningful =
    headerRowIndex >= 0 ||
    structuredRows.length >= 2 ||
    (denseRows.length >= 1 && maxColumns >= 3) ||
    populatedCellCount >= 6;

  return {
    sheetName,
    rows,
    headerRowIndex,
    isMeaningful,
    startRowNumber: rows[0]?.rowNumber ?? 1,
    regionCount,
    score:
      populatedCellCount +
      denseRows.length * 12 +
      maxColumns * 8 +
      structuredRows.length * 6 +
      summaryRows.length * 4 +
      (headerRowIndex >= 0 ? 35 : 0) -
      singleCellRows.length * 4 -
      Math.max(0, (rows[0]?.rowNumber ?? 1) - 1),
  };
}

function analyzeSpreadsheetSheet(sheetName: string, rows: SpreadsheetRow[]): SpreadsheetSheetAnalysis | null {
  const regions = segmentSpreadsheetRegions(rows);

  if (regions.length === 0) {
    return null;
  }

  const analyses = regions
    .map((region) => analyzeSpreadsheetRegion(sheetName, region, regions.length))
    .filter((analysis): analysis is SpreadsheetSheetAnalysis => Boolean(analysis));

  if (analyses.length === 0) {
    return null;
  }

  return [...analyses].sort(
    (left, right) => right.score - left.score || left.startRowNumber - right.startRowNumber
  )[0] ?? null;
}

function selectSpreadsheetVisibleColumns(rows: SpreadsheetRow[], headerRowIndex: number) {
  const maxColumns = rows.reduce((max, row) => Math.max(max, row.cells.length), 0);
  const scoredColumns = Array.from({ length: maxColumns }, (_, columnIndex) => {
    const values = rows
      .map((row) => row.cells[columnIndex] ?? "")
      .filter((value) => value.length > 0);

    if (values.length === 0) {
      return null;
    }

    const uniqueCount = new Set(values.map((value) => value.toLowerCase())).size;
    const numericCount = values.filter((value) => parseSpreadsheetNumericCell(value) != null).length;
    const label = headerRowIndex >= 0 ? rows[headerRowIndex]?.cells[columnIndex] ?? "" : "";

    return {
      columnIndex,
      score:
        values.length * 3 +
        Math.min(uniqueCount, 8) * 2 +
        (numericCount >= 2 ? 4 : 0) +
        (label.length > 0 ? 8 : 0) -
        (headerRowIndex >= 0 && label.length === 0 ? 3 : 0),
    };
  }).filter((column): column is { columnIndex: number; score: number } => Boolean(column));

  if (scoredColumns.length === 0) {
    return [];
  }

  return scoredColumns
    .sort((left, right) => right.score - left.score || left.columnIndex - right.columnIndex)
    .slice(0, MAX_SPREADSHEET_COLUMNS_PER_ROW)
    .map((column) => column.columnIndex)
    .sort((left, right) => left - right);
}

function rankSpreadsheetKeyColumns(rows: SpreadsheetRow[], visibleColumnIndexes: number[]) {
  return [...visibleColumnIndexes]
    .map((columnIndex) => {
      const values = rows
        .map((row) => row.cells[columnIndex] ?? "")
        .filter((value) => value.length > 0);

      if (values.length === 0) {
        return null;
      }

      const uniqueCount = new Set(values.map((value) => value.toLowerCase())).size;
      const numericCount = values.filter((value) => parseSpreadsheetNumericCell(value) != null).length;
      const labelLikeCount = values.filter(isLikelySpreadsheetLabel).length;

      return {
        columnIndex,
        score: values.length * 2 + uniqueCount * 3 + labelLikeCount * 2 - numericCount * 2,
      };
    })
    .filter((column): column is { columnIndex: number; score: number } => Boolean(column))
    .sort((left, right) => right.score - left.score || left.columnIndex - right.columnIndex)
    .slice(0, MAX_SPREADSHEET_KEY_COLUMNS)
    .map((column) => column.columnIndex);
}

function rankSpreadsheetMetricColumns(rows: SpreadsheetRow[], visibleColumnIndexes: number[]) {
  return [...visibleColumnIndexes]
    .map((columnIndex) => {
      const values = rows
        .map((row) => parseSpreadsheetNumericCell(row.cells[columnIndex] ?? ""))
        .filter((value): value is number => value != null);

      if (values.length < 2) {
        return null;
      }

      return {
        columnIndex,
        score: values.length * 3,
      };
    })
    .filter((column): column is { columnIndex: number; score: number } => Boolean(column))
    .sort((left, right) => right.score - left.score || left.columnIndex - right.columnIndex)
    .map((column) => column.columnIndex);
}

function buildRepresentativeRowIndexes(rows: SpreadsheetRow[], visibleColumnIndexes: number[]) {
  const limit = Math.min(MAX_SPREADSHEET_ROWS_PER_SHEET, rows.length);

  if (rows.length <= limit) {
    return rows.map((_, index) => index);
  }

  const orderedCandidates: number[] = [];

  for (let index = 0; index < Math.min(rows.length, MAX_SPREADSHEET_HEAD_ROWS); index += 1) {
    orderedCandidates.push(index);
  }

  const summaryIndexes = rows
    .map((row, index) => ({ row, index }))
    .filter(({ row }) => isLikelySpreadsheetSummaryRow(row))
    .slice(0, MAX_SPREADSHEET_SUMMARY_ROWS)
    .map(({ index }) => index);
  orderedCandidates.push(...summaryIndexes);

  let distinctValueRowsAdded = 0;
  for (const columnIndex of rankSpreadsheetKeyColumns(rows, visibleColumnIndexes)) {
    const seenValues = new Set<string>();
    for (let index = 0; index < rows.length; index += 1) {
      const value = (rows[index]?.cells[columnIndex] ?? "").toLowerCase();
      if (!value || seenValues.has(value)) {
        continue;
      }

      seenValues.add(value);
      orderedCandidates.push(index);
      distinctValueRowsAdded += 1;

      if (distinctValueRowsAdded >= MAX_SPREADSHEET_DISTINCT_VALUE_ROWS) {
        break;
      }
    }

    if (distinctValueRowsAdded >= MAX_SPREADSHEET_DISTINCT_VALUE_ROWS) {
      break;
    }
  }

  const primaryMetricColumn = rankSpreadsheetMetricColumns(rows, visibleColumnIndexes)[0];
  if (primaryMetricColumn != null) {
    const numericRows = rows
      .map((row, index) => ({
        index,
        value: parseSpreadsheetNumericCell(row.cells[primaryMetricColumn] ?? ""),
      }))
      .filter((candidate): candidate is { index: number; value: number } => candidate.value != null)
      .sort((left, right) => left.value - right.value);

    if (numericRows.length > 0) {
      orderedCandidates.push(numericRows[0].index);
      orderedCandidates.push(numericRows[numericRows.length - 1].index);
    }
  }

  orderedCandidates.push(rows.length - 1);

  const spacingSlots = Math.max(limit, 2);
  for (let slot = 0; slot < spacingSlots; slot += 1) {
    orderedCandidates.push(Math.round((slot * (rows.length - 1)) / (spacingSlots - 1)));
  }

  const uniqueCandidates: number[] = [];
  const seenIndexes = new Set<number>();

  for (const index of orderedCandidates) {
    if (seenIndexes.has(index)) {
      continue;
    }

    seenIndexes.add(index);
    uniqueCandidates.push(index);

    if (uniqueCandidates.length >= limit) {
      break;
    }
  }

  return uniqueCandidates.sort((left, right) => left - right);
}

function renderSpreadsheetSheet(analysis: SpreadsheetSheetAnalysis) {
  const lines = [`### Sheet: ${analysis.sheetName}`];

  if (analysis.headerRowIndex >= 0) {
    const headerRow = analysis.rows[analysis.headerRowIndex];
    const dataRows = analysis.rows
      .slice(analysis.headerRowIndex + 1)
      .filter((row) => countSpreadsheetCells(row) > 0);
    const visibleColumnIndexes = selectSpreadsheetVisibleColumns(analysis.rows, analysis.headerRowIndex);
    const headerLabels = formatSpreadsheetHeaderLabels(
      visibleColumnIndexes.map((index) => headerRow.cells[index] ?? "")
    );
    const visibleRows = buildRepresentativeRowIndexes(dataRows, visibleColumnIndexes).map(
      (index) => dataRows[index]
    );

    lines.push(`Columns: ${headerLabels.join(" | ")}`);
    if (headerRow.rowNumber > 1) {
      lines.push(`Focused on the strongest structured table starting at row ${headerRow.rowNumber}.`);
    }
    if (analysis.regionCount > 1 || dataRows.length > visibleRows.length) {
      lines.push("Representative rows are shown to keep the table compact and decision-useful.");
    }
    lines.push("Rows:");

    if (visibleRows.length === 0) {
      lines.push("- No data rows were found after the detected header.");
    } else {
      for (const row of visibleRows) {
        const alignedCells = visibleColumnIndexes.map((index) => row.cells[index] ?? "");
        lines.push(`- ${alignedCells.join(" | ")}`);
      }
    }

    const omittedRows = dataRows.length - visibleRows.length;
    if (omittedRows > 0) {
      lines.push(`... [${omittedRows} additional data rows omitted after representative sampling]`);
    }
    if (analysis.regionCount > 1) {
      lines.push("... [other low-signal or secondary table regions in this sheet were omitted]");
    }

    return lines.join("\n");
  }

  const visibleColumnIndexes = selectSpreadsheetVisibleColumns(analysis.rows, -1);
  const visibleRows = buildRepresentativeRowIndexes(analysis.rows, visibleColumnIndexes).map(
    (index) => analysis.rows[index]
  );

  lines.push("No clear header row detected; showing representative populated rows in sheet order.");
  if (analysis.startRowNumber > 1) {
    lines.push(`Focused on the strongest populated table region starting at row ${analysis.startRowNumber}.`);
  }
  if (analysis.regionCount > 1 || analysis.rows.length > visibleRows.length) {
    lines.push("Representative rows are shown to keep the table compact and decision-useful.");
  }

  for (const row of visibleRows) {
    const visibleCells = visibleColumnIndexes.map((index) => row.cells[index] ?? "");
    lines.push(`- Row ${row.rowNumber}: ${visibleCells.join(" | ")}`);
  }

  const omittedRows = analysis.rows.length - visibleRows.length;
  if (omittedRows > 0) {
    lines.push(`... [${omittedRows} additional populated rows omitted after representative sampling]`);
  }
  if (analysis.regionCount > 1) {
    lines.push("... [other low-signal or secondary table regions in this sheet were omitted]");
  }

  return lines.join("\n");
}

function resolveSpreadsheetExtension(filename: string) {
  return resolveExtension(filename);
}

function resolveDelimitedSeparator(filename: string, mimeType: string | null) {
  const extension = resolveSpreadsheetExtension(filename);
  if (extension === "tsv" || mimeType === "text/tab-separated-values") {
    return "\t";
  }

  return ",";
}

function resolveDelimitedSheetName(filename: string) {
  const trimmed = filename.trim();
  const withoutExtension = trimmed.replace(/\.[^.]+$/, "").trim();
  return withoutExtension.length > 0 ? withoutExtension : "Sheet1";
}

function parseSpreadsheetWorkbook(
  fileBuffer: Buffer,
  document: Pick<ConversationContextDocumentRecord, "filename" | "mimeType">
) {
  const extension = resolveSpreadsheetExtension(document.filename);

  if (extension === "csv" || extension === "tsv") {
    const workbook = XLSX.read(normalizeDelimitedText(fileBuffer.toString("utf8")), {
      type: "string",
      raw: false,
      FS: resolveDelimitedSeparator(document.filename, document.mimeType),
    });
    const originalSheetName = workbook.SheetNames[0];
    if (originalSheetName && workbook.Sheets[originalSheetName]) {
      const preferredSheetName = resolveDelimitedSheetName(document.filename);
      if (preferredSheetName !== originalSheetName) {
        workbook.Sheets[preferredSheetName] = workbook.Sheets[originalSheetName];
        delete workbook.Sheets[originalSheetName];
        workbook.SheetNames = [preferredSheetName];
      }
    }
    return workbook;
  }

  return XLSX.read(fileBuffer, {
    type: "buffer",
    dense: true,
    cellFormula: false,
    cellHTML: false,
    cellStyles: false,
    cellText: true,
  });
}

function truncateDocumentText(value: string, max = MAX_THREAD_DOCUMENT_CONTEXT_CHARS) {
  if (value.length <= max) return value;

  const suffix = `\n... [truncated ${value.length - Math.max(0, max - 32)} chars]`;
  if (suffix.length >= max) {
    return value.slice(0, max);
  }

  const sliceLength = max - suffix.length;
  return `${value.slice(0, sliceLength)}\n... [truncated ${value.length - sliceLength} chars]`;
}

function resolveExtension(filename: string) {
  return filename.trim().split(".").pop()?.toLowerCase() ?? "";
}

function isUploadPath(storagePath: string) {
  const uploadsRoot = normalize(resolve(process.cwd(), "uploads")).toLowerCase();
  const resolvedStoragePath = normalize(resolve(storagePath)).toLowerCase();
  const uploadsPrefix = `${uploadsRoot}${sep}`.toLowerCase();

  return resolvedStoragePath === uploadsRoot || resolvedStoragePath.startsWith(uploadsPrefix);
}

function resolveThreadDocumentContextKind(document: {
  filename: string;
  fileType: string;
}) {
  const extension = resolveExtension(document.filename);

  if (document.fileType === "text" && SUPPORTED_THREAD_TEXT_EXTENSIONS.has(extension)) {
    return "text" as const;
  }

  if (document.fileType === "pdf" && SUPPORTED_THREAD_PDF_EXTENSIONS.has(extension)) {
    return "pdf" as const;
  }

  if (document.fileType === "document" && SUPPORTED_THREAD_DOCX_EXTENSIONS.has(extension)) {
    return "docx" as const;
  }

  if (document.fileType === "document" && SUPPORTED_THREAD_PPTX_EXTENSIONS.has(extension)) {
    return "pptx" as const;
  }

  if (document.fileType === "spreadsheet" && SUPPORTED_THREAD_SPREADSHEET_EXTENSIONS.has(extension)) {
    return "spreadsheet" as const;
  }

  if (document.fileType === "image" && SUPPORTED_THREAD_IMAGE_EXTENSIONS.has(extension)) {
    return "image" as const;
  }

  return null;
}

function resolveStorageReadFailureReason(error: unknown) {
  return (error as NodeJS.ErrnoException).code === "ENOENT"
    ? "the file is missing from disk"
    : "the file could not be read";
}

async function ensureServerPdfJsWorker() {
  const runtimeGlobal = globalThis as typeof globalThis & {
    pdfjsWorker?: { WorkerMessageHandler?: unknown };
  };

  if (runtimeGlobal.pdfjsWorker?.WorkerMessageHandler) {
    return;
  }

  if (!pdfJsWorkerBootstrapPromise) {
    // In the Next server runtime, pdf.js may fall back to a fake worker and try to
    // import "./pdf.worker.mjs" from the bundled chunk directory. Preloading the
    // main-thread worker handler keeps extraction server-safe and avoids that path.
    pdfJsWorkerBootstrapPromise = import("pdfjs-dist/legacy/build/pdf.worker.mjs")
      .then(({ WorkerMessageHandler }) => {
        runtimeGlobal.pdfjsWorker = {
          ...(runtimeGlobal.pdfjsWorker ?? {}),
          WorkerMessageHandler,
        };
      })
      .catch((error) => {
        pdfJsWorkerBootstrapPromise = null;
        throw error;
      });
  }

  await pdfJsWorkerBootstrapPromise;
}

async function loadServerPdfParseModule() {
  if (!pdfParseModulePromise) {
    pdfParseModulePromise = import("pdf-parse")
      .catch((error) => {
        pdfParseModulePromise = null;
        throw createPdfRuntimeUnavailableError(error);
      });
  }

  return pdfParseModulePromise;
}

async function extractThreadPdfText(fileBuffer: Buffer) {
  let PDFParse: PdfParseModule["PDFParse"];
  try {
    ({ PDFParse } = await loadServerPdfParseModule());
    await ensureServerPdfJsWorker();
  } catch (error) {
    throw isPdfRuntimeUnavailableError(error) ? error : createPdfRuntimeUnavailableError(error);
  }

  let parser: {
    getText: () => Promise<{ text: string }>;
    destroy: () => Promise<unknown>;
  } | null = null;

  try {
    parser = new PDFParse({ data: fileBuffer });
    const result = await parser.getText();
    return result.text;
  } finally {
    if (parser) {
      try {
        await parser.destroy();
      } catch {
        // Swallow cleanup failures so the original extraction result/error remains authoritative.
      }
    }
  }
}

async function extractThreadDocxText(fileBuffer: Buffer) {
  const result = await mammoth.extractRawText({ buffer: fileBuffer });
  const extractionErrors = result.messages.filter((message) => message.type === "error");

  if (extractionErrors.length > 0) {
    throw new Error(extractionErrors.map((message) => message.message).join("; "));
  }

  return result.value;
}

function collectOfficeNodeText(node: OfficeContentNode): string[] {
  const childLines = (node.children ?? []).flatMap((child) => collectOfficeNodeText(child));
  if (childLines.length > 0) {
    return childLines;
  }

  const text = typeof node.text === "string" ? node.text.trim() : "";
  return text ? [text] : [];
}

function preparePptxLines(lines: string[], maxLines: number) {
  const uniqueLines: string[] = [];
  const seen = new Set<string>();

  for (const line of lines) {
    const normalized = normalizeDocumentText(line).replace(/\n+/g, " ").trim();
    if (!normalized) {
      continue;
    }

    const key = normalized.toLowerCase();
    if (seen.has(key)) {
      continue;
    }

    seen.add(key);
    uniqueLines.push(normalized);
  }

  return {
    visibleLines: uniqueLines.slice(0, maxLines),
    omittedCount: Math.max(0, uniqueLines.length - maxLines),
  };
}

async function extractThreadPptxText(fileBuffer: Buffer) {
  const ast = await parseOffice(fileBuffer, {
    ignoreNotes: false,
    putNotesAtLast: false,
    extractAttachments: false,
    ocr: false,
    outputErrorToConsole: false,
  });

  const slideMap = new Map<number, { slideLines: string[]; noteLines: string[] }>();

  for (const node of ast.content) {
    if (node.type !== "slide" && node.type !== "note") {
      continue;
    }

    const slideNumber = (node.metadata as SlideMetadata | undefined)?.slideNumber;
    if (typeof slideNumber !== "number" || !Number.isFinite(slideNumber)) {
      continue;
    }

    const entry = slideMap.get(slideNumber) ?? { slideLines: [], noteLines: [] };
    const lines = collectOfficeNodeText(node);

    if (node.type === "slide") {
      entry.slideLines.push(...lines);
    } else {
      entry.noteLines.push(...lines);
    }

    slideMap.set(slideNumber, entry);
  }

  const slideNumbers = [...slideMap.keys()].sort((left, right) => left - right);
  const sections: string[] = [];
  let remainingChars = MAX_PPTX_EXTRACTED_CHARS;

  for (const slideNumber of slideNumbers.slice(0, MAX_PPTX_SLIDES)) {
    const slide = slideMap.get(slideNumber);
    if (!slide || remainingChars <= 0) {
      break;
    }

    const { visibleLines: visibleSlideLines, omittedCount: omittedSlideLineCount } = preparePptxLines(
      slide.slideLines,
      MAX_PPTX_SLIDE_TEXT_LINES
    );
    const { visibleLines: visibleNoteLines, omittedCount: omittedNoteLineCount } = preparePptxLines(
      slide.noteLines,
      MAX_PPTX_NOTE_LINES
    );

    if (visibleSlideLines.length === 0 && visibleNoteLines.length === 0) {
      continue;
    }

    const lines = [`### Slide ${slideNumber}`];

    if (visibleSlideLines.length > 0) {
      lines.push("Content:");
      lines.push(...visibleSlideLines.map((line) => `- ${line}`));
      if (omittedSlideLineCount > 0) {
        lines.push(`... [${omittedSlideLineCount} additional slide text lines omitted]`);
      }
    } else {
      lines.push("Content: No readable slide body text was found.");
    }

    if (visibleNoteLines.length > 0) {
      lines.push("Speaker notes:");
      lines.push(...visibleNoteLines.map((line) => `- ${line}`));
      if (omittedNoteLineCount > 0) {
        lines.push(`... [${omittedNoteLineCount} additional speaker note lines omitted]`);
      }
    }

    const section = lines.join("\n");
    const nextLength = section.length + (sections.length > 0 ? 2 : 0);

    if (nextLength > remainingChars && sections.length > 0) {
      sections.push("... [additional slide content truncated to fit presentation extraction limits]");
      remainingChars = 0;
      break;
    }

    sections.push(section.slice(0, remainingChars));
    remainingChars -= Math.min(nextLength, remainingChars);
  }

  const omittedSlideCount = Math.max(0, slideNumbers.length - Math.min(slideNumbers.length, MAX_PPTX_SLIDES));
  if (omittedSlideCount > 0 && remainingChars > 0) {
    sections.push(`... [${omittedSlideCount} additional slides omitted to keep the deck context focused]`);
  }

  return sections.join("\n\n");
}

async function extractThreadSpreadsheetText(
  fileBuffer: Buffer,
  document: Pick<ConversationContextDocumentRecord, "filename" | "mimeType">
) {
  const workbook = parseSpreadsheetWorkbook(fileBuffer, document);

  const analyses = workbook.SheetNames
    .map((sheetName) => {
      const sheet = workbook.Sheets[sheetName];
      if (!sheet) {
        return null;
      }

      const rows = XLSX.utils.sheet_to_json<unknown[]>(sheet, {
        header: 1,
        raw: false,
        defval: "",
        blankrows: true,
      })
        .map((row, rowIndex) => ({
          rowNumber: rowIndex + 1,
          cells: trimSpreadsheetCells(row.map(normalizeSpreadsheetCell)),
        }));

      return analyzeSpreadsheetSheet(sheetName, rows);
    })
    .filter((analysis): analysis is SpreadsheetSheetAnalysis => Boolean(analysis));

  const meaningfulAnalyses = analyses.filter((analysis) => analysis.isMeaningful);
  const candidateAnalyses = meaningfulAnalyses.length > 0 ? meaningfulAnalyses : analyses;
  const selectedAnalyses = [...candidateAnalyses]
    .sort((left, right) => right.score - left.score || left.sheetName.localeCompare(right.sheetName))
    .slice(0, MAX_SPREADSHEET_SHEETS);

  const sections: string[] = [];
  let remainingChars = MAX_SPREADSHEET_EXTRACTED_CHARS;

  for (const analysis of selectedAnalyses) {
    if (remainingChars <= 0) break;

    const section = renderSpreadsheetSheet(analysis);
    const nextLength = section.length + (sections.length > 0 ? 2 : 0);

    if (nextLength > remainingChars && sections.length > 0) {
      sections.push("... [additional sheet content truncated to fit spreadsheet extraction limits]");
      remainingChars = 0;
      break;
    }

    sections.push(section.slice(0, remainingChars));
    remainingChars -= Math.min(nextLength, remainingChars);
  }

  const omittedMeaningfulSheetCount = candidateAnalyses.length - selectedAnalyses.length;
  const omittedLowSignalSheetCount = analyses.length - candidateAnalyses.length;

  if (omittedMeaningfulSheetCount > 0 && remainingChars > 0) {
    sections.push(`... [${omittedMeaningfulSheetCount} additional populated sheets omitted to keep the workbook context focused]`);
  }

  if (omittedLowSignalSheetCount > 0 && meaningfulAnalyses.length > 0 && remainingChars > 0) {
    sections.push(`... [${omittedLowSignalSheetCount} low-signal sheets omitted in favor of the most populated workbook tabs]`);
  }

  return sections.join("\n\n");
}

function buildContextSource(
  status: ConversationContextSourceStatus,
  filename: string,
  detail: string
): ConversationContextSource {
  return {
    kind: "thread-document",
    label: filename,
    target: filename,
    detail,
    status,
    domain: "thread_documents",
    scope: "thread",
  };
}

type ConversationContextRequestedSource = {
  sourceId: string;
  status: ConversationContextSourceRequestStatus;
  origins: ConversationContextSourceRequestOrigin[];
  detail: string;
};

type ConversationContextRequestedSourcePlan = {
  requestMode: ConversationContextSourceRequestMode;
  requests: ConversationContextRequestedSource[];
  consideredSourceIds: string[];
  defaultCandidateSourceIds: string[];
  explicitUserRequestedSourceIds: string[];
  requestedSourceIds: string[];
  plannerProposedSourceIds: string[];
  policyRequiredSourceIds: string[];
  fallbackCandidateSourceIds: string[];
};

function normalizeConversationContextSourceIds(sourceIds: unknown[] | null | undefined) {
  if (!Array.isArray(sourceIds)) {
    return [];
  }

  return Array.from(new Set(
    sourceIds
      .filter((sourceId): sourceId is string => typeof sourceId === "string" && sourceId.trim().length > 0)
      .map((sourceId) => sourceId.trim())
  ));
}

function isConversationContextSourceRequestOrigin(
  value: unknown
): value is Exclude<ConversationContextSourceRequestOrigin, "default_system_candidate"> {
  return typeof value === "string" && NON_DEFAULT_CONVERSATION_CONTEXT_SOURCE_REQUEST_ORIGINS.has(
    value as Exclude<ConversationContextSourceRequestOrigin, "default_system_candidate">
  );
}

function resolveConversationContextSourceRequestStatus(
  origins: ConversationContextSourceRequestOrigin[]
): ConversationContextSourceRequestStatus {
  for (const origin of CONVERSATION_CONTEXT_SOURCE_REQUEST_ORIGIN_PRECEDENCE) {
    if (origins.includes(origin)) {
      return CONVERSATION_CONTEXT_SOURCE_REQUEST_STATUS_BY_ORIGIN[origin];
    }
  }

  return "candidate";
}

function formatConversationContextSourceRequestOriginLabel(origin: ConversationContextSourceRequestOrigin) {
  switch (origin) {
    case "default_system_candidate":
      return "a default system candidate";
    case "explicit_user_request":
      return "an explicit user request";
    case "planner_proposed":
      return "a planner proposal";
    case "policy_required":
      return "a policy-required source";
    default:
      return "a fallback candidate";
  }
}

function buildConversationContextSourceRequestDetail(origins: ConversationContextSourceRequestOrigin[]) {
  const primaryOrigin = CONVERSATION_CONTEXT_SOURCE_REQUEST_ORIGIN_PRECEDENCE.find(
    (origin) => origins.includes(origin)
  ) ?? "default_system_candidate";
  const additionalOrigins = origins.filter((origin) => origin !== primaryOrigin);
  let detail = "";

  if (primaryOrigin === "default_system_candidate") {
    detail = "Considered as a default system candidate for this conversation runtime.";
  } else if (primaryOrigin === "explicit_user_request") {
    detail = "Included because the user explicitly requested this source for the conversation.";
  } else if (primaryOrigin === "planner_proposed") {
    detail = "Included as a planner-compatible proposal for app-side verification before any execution.";
  } else if (primaryOrigin === "policy_required") {
    detail = "Included because app-side policy marked this source as required before execution could proceed.";
  } else {
    detail = "Considered as a fallback candidate if stronger or preferred sources are unavailable.";
  }

  if (additionalOrigins.length === 0) {
    return detail;
  }

  const additionalLabels = additionalOrigins.map((origin) => formatConversationContextSourceRequestOriginLabel(origin));
  return `${detail} Also marked as ${additionalLabels.join(" and ")}.`;
}

function resolveRequestedConversationContextSourcePlan(
  sourcePlan: ConversationContextAcquisitionPlan | null | undefined
) : ConversationContextRequestedSourcePlan {
  if (!sourcePlan) {
    const defaultCandidateSourceIds = CONVERSATION_CONTEXT_SOURCE_REGISTRY.map((source) => source.id);
    const requests = defaultCandidateSourceIds.map((sourceId) => ({
      sourceId,
      status: "candidate" as const,
      origins: ["default_system_candidate"] as ConversationContextSourceRequestOrigin[],
      detail: buildConversationContextSourceRequestDetail(["default_system_candidate"]),
    }));
    return {
      requestMode: "default",
      requests,
      consideredSourceIds: defaultCandidateSourceIds,
      defaultCandidateSourceIds,
      explicitUserRequestedSourceIds: [],
      requestedSourceIds: [],
      plannerProposedSourceIds: [],
      policyRequiredSourceIds: [],
      fallbackCandidateSourceIds: [],
    };
  }

  const requestOriginsBySourceId = new Map<string, Set<ConversationContextSourceRequestOrigin>>();
  for (const sourceId of normalizeConversationContextSourceIds(sourcePlan.requestedSourceIds)) {
    const origins = requestOriginsBySourceId.get(sourceId) ?? new Set<ConversationContextSourceRequestOrigin>();
    origins.add("planner_proposed");
    requestOriginsBySourceId.set(sourceId, origins);
  }

  if (Array.isArray(sourcePlan.sourceRequests)) {
    for (const sourceRequest of sourcePlan.sourceRequests) {
      if (!sourceRequest || typeof sourceRequest !== "object") {
        continue;
      }

      const sourceId = typeof sourceRequest.sourceId === "string" ? sourceRequest.sourceId.trim() : "";
      if (!sourceId) {
        continue;
      }

      if (!isConversationContextSourceRequestOrigin(sourceRequest.origin)) {
        continue;
      }

      const origins = requestOriginsBySourceId.get(sourceId) ?? new Set<ConversationContextSourceRequestOrigin>();
      origins.add(sourceRequest.origin);
      requestOriginsBySourceId.set(sourceId, origins);
    }
  }

  const requests = Array.from(requestOriginsBySourceId.entries()).map(([sourceId, originsSet]) => {
    const origins = CONVERSATION_CONTEXT_SOURCE_REQUEST_ORIGIN_PRECEDENCE.filter((origin) => originsSet.has(origin));
    const status = resolveConversationContextSourceRequestStatus(origins);
    return {
      sourceId,
      status,
      origins,
      detail: buildConversationContextSourceRequestDetail(origins),
    } satisfies ConversationContextRequestedSource;
  });

  const explicitUserRequestedSourceIds = requests
    .filter((request) => request.origins.includes("explicit_user_request"))
    .map((request) => request.sourceId);
  const plannerProposedSourceIds = requests
    .filter((request) => request.origins.includes("planner_proposed"))
    .map((request) => request.sourceId);
  const policyRequiredSourceIds = requests
    .filter((request) => request.origins.includes("policy_required"))
    .map((request) => request.sourceId);
  const fallbackCandidateSourceIds = requests
    .filter((request) => request.origins.includes("fallback_candidate"))
    .map((request) => request.sourceId);

  return {
    requestMode: "plan",
    requests,
    consideredSourceIds: requests.map((request) => request.sourceId),
    defaultCandidateSourceIds: [],
    explicitUserRequestedSourceIds,
    requestedSourceIds: requests
      .filter((request) => request.status !== "candidate")
      .map((request) => request.sourceId),
    plannerProposedSourceIds,
    policyRequiredSourceIds,
    fallbackCandidateSourceIds,
  };
}

function buildConversationContextSourceDecisionDetail(params: {
  sourceId: string;
  reason: ConversationContextSourceDecisionReason;
}) {
  if (params.reason === "allowed") {
    if (params.sourceId === "thread_documents") {
      return "Allowed because the requesting user is an authoritative active thread member and the active agent is the authoritative active agent for this thread runtime.";
    }

    return "Allowed for execution in the current conversation runtime.";
  }

  if (params.reason === "not_registered") {
    return "Excluded because this source is not registered in the current conversation-context source registry.";
  }

  if (params.reason === "not_in_scope") {
    if (params.sourceId === "thread_documents") {
      return "Excluded because thread-attached documents only apply to a concrete thread conversation scope.";
    }

    return "Excluded because this source is outside the current conversation scope.";
  }

  if (params.reason === "not_available") {
    return "Excluded because this source is not enabled or available in the current workspace runtime.";
  }

  if (params.reason === "requesting_user_not_allowed") {
    return "Excluded because the requesting user is not an authoritative active member of this thread.";
  }

  if (params.reason === "active_agent_not_allowed") {
    return "Excluded because no authoritative active agent is available for this thread runtime.";
  }

  return "Excluded because this source is registered as a future capability, but retrieval for it is not implemented in the current runtime.";
}

function resolveConversationContextSourceExclusionCategory(
  reason: ConversationContextSourceExclusionReason
): ConversationContextSourceExclusionCategory {
  if (reason === "not_registered") {
    return "registration";
  }

  if (reason === "not_in_scope") {
    return "scope";
  }

  if (reason === "requesting_user_not_allowed" || reason === "active_agent_not_allowed") {
    return "authorization";
  }

  if (reason === "not_available" || reason === "budget_exhausted") {
    return reason === "budget_exhausted" ? "budget" : "availability";
  }

  return "implementation";
}

function resolveConversationContextSourceExclusion(params: {
  sourceId: string;
  reason: ConversationContextSourceDecisionReason;
}) {
  if (params.reason === "allowed") {
    return null;
  }

  const detail = buildConversationContextSourceDecisionDetail(params);
  return {
    category: resolveConversationContextSourceExclusionCategory(params.reason),
    reason: params.reason,
    detail,
  } satisfies ConversationContextSourceExclusion;
}

function buildConversationContextSourceExecutionDetail(params: {
  sourceId: string;
  admissionStatus: ConversationContextSourceDecision["admission"]["status"];
  exclusion: ConversationContextSourceExclusion | null;
  executed: boolean;
  threadDocumentCount?: number;
}) {
  if (!params.executed) {
    if (params.admissionStatus === "excluded") {
      return params.exclusion
        ? `Did not execute because this source was excluded before runtime execution (${params.exclusion.category}: ${params.exclusion.reason}).`
        : "Did not execute because this source was excluded before runtime execution.";
    }

    return "Did not execute a runtime adapter for this source in this pass.";
  }

  if (params.sourceId === "thread_documents") {
    const attachmentCount = params.threadDocumentCount ?? 0;
    return attachmentCount === 0
      ? "Executed thread-attached document retrieval for this conversation, but no in-scope thread attachments were available."
      : attachmentCount === 1
        ? "Executed thread-attached document retrieval for this conversation and evaluated 1 in-scope attachment."
        : `Executed thread-attached document retrieval for this conversation and evaluated ${attachmentCount.toLocaleString("en-US")} in-scope attachments.`;
  }

  return "Executed this source adapter in the current runtime.";
}

function resolveConversationContextSourceDecision(params: {
  request: ConversationContextRequestedSource;
  conversationId: string;
  authority: ConversationContextSourceAuthority;
  requestMode: ConversationContextSourceRequestMode;
}): ConversationContextSourceDecision {
  const source = CONVERSATION_CONTEXT_SOURCE_REGISTRY_BY_ID.get(
    params.request.sourceId as ConversationContextSourceId
  );

  if (!source) {
    const exclusion = resolveConversationContextSourceExclusion({
      sourceId: params.request.sourceId,
      reason: "not_registered",
    });
    if (!exclusion) {
      throw new Error("Source exclusion resolution must exist for unregistered sources.");
    }
    return {
      sourceId: params.request.sourceId,
      label: params.request.sourceId,
      request: {
        status: params.request.status,
        mode: params.requestMode,
        origins: params.request.origins,
        detail: params.request.detail,
      },
      admission: {
        status: "excluded",
      },
      execution: {
        status: "not_executed",
        detail: buildConversationContextSourceExecutionDetail({
          sourceId: params.request.sourceId,
          admissionStatus: "excluded",
          exclusion,
          executed: false,
        }),
        summary: null,
      },
      exclusion,
      status: "excluded",
      reason: "not_registered",
      detail: exclusion.detail,
      domain: "unknown",
      scope: "unknown",
      policyMode: "unknown",
      eligibility: {
        isRegistered: false,
        isInScope: false,
        isAvailable: false,
        isRequestingUserAllowed: false,
        isActiveAgentAllowed: false,
        isImplemented: false,
      },
    };
  }

  const isInScope = source.scope === "thread" ? Boolean(params.conversationId.trim()) : true;
  const isRequestingUserAllowed = source.policyMode === "thread_active_membership"
    ? Boolean(
        params.authority.requestingUserId
        && params.authority.activeUserIds.includes(params.authority.requestingUserId)
      )
    : true;
  const isActiveAgentAllowed = source.policyMode === "thread_active_membership"
    ? Boolean(
        params.authority.activeAgentId
        && params.authority.activeAgentIds.includes(params.authority.activeAgentId)
      )
    : true;
  const eligibility = {
    isRegistered: true,
    isInScope,
    isAvailable: source.isAvailable,
    isRequestingUserAllowed,
    isActiveAgentAllowed,
    isImplemented: source.isImplemented,
  };
  let reason: ConversationContextSourceDecisionReason = "allowed";

  if (!eligibility.isInScope) {
    reason = "not_in_scope";
  } else if (!eligibility.isAvailable) {
    reason = "not_available";
  } else if (!eligibility.isRequestingUserAllowed) {
    reason = "requesting_user_not_allowed";
  } else if (!eligibility.isActiveAgentAllowed) {
    reason = "active_agent_not_allowed";
  } else if (!eligibility.isImplemented) {
    reason = "not_implemented";
  }
  const exclusion = resolveConversationContextSourceExclusion({
    sourceId: source.id,
    reason,
  });
  const admissionStatus = reason === "allowed" ? "allowed" : "excluded";
  const detail = exclusion?.detail ?? buildConversationContextSourceDecisionDetail({
    sourceId: source.id,
    reason,
  });

  return {
    sourceId: source.id,
    label: source.label,
    request: {
      status: params.request.status,
      mode: params.requestMode,
      origins: params.request.origins,
      detail: params.request.detail,
    },
    admission: {
      status: admissionStatus,
    },
    execution: {
      status: "not_executed",
      detail: buildConversationContextSourceExecutionDetail({
        sourceId: source.id,
        admissionStatus,
        exclusion,
        executed: false,
      }),
      summary: null,
    },
    exclusion,
    status: admissionStatus,
    reason,
    detail,
    domain: source.domain,
    scope: source.scope,
    policyMode: source.policyMode,
    eligibility,
  };
}

function resolveConversationContextSourceDecisions(params: {
  conversationId: string;
  authority: ConversationContextSourceAuthority;
  requestedSources: ConversationContextRequestedSourcePlan;
}) {
  return params.requestedSources.requests.map((request) =>
    resolveConversationContextSourceDecision({
      request,
      conversationId: params.conversationId,
      authority: params.authority,
      requestMode: params.requestedSources.requestMode,
    })
  );
}

function finalizeConversationContextSourceDecision(params: {
  sourceDecision: ConversationContextSourceDecision;
  threadDocumentSummary: {
    totalCount: number;
    usedCount: number;
    unsupportedCount: number;
    failedCount: number;
    unavailableCount: number;
    excludedCategories: ConversationContextSourceExclusionCategory[];
  };
}) {
  if (params.sourceDecision.sourceId !== "thread_documents") {
    return params.sourceDecision;
  }

  const executed = params.sourceDecision.admission.status === "allowed";
  const executionStatus: ConversationContextSourceDecision["execution"]["status"] =
    executed ? "executed" : "not_executed";
  return {
    ...params.sourceDecision,
    execution: {
      status: executionStatus,
      detail: buildConversationContextSourceExecutionDetail({
        sourceId: params.sourceDecision.sourceId,
        admissionStatus: params.sourceDecision.admission.status,
        exclusion: params.sourceDecision.exclusion,
        executed,
        threadDocumentCount: params.threadDocumentSummary.totalCount,
      }),
      summary: executed ? params.threadDocumentSummary : null,
    },
  };
}

function buildConversationContextSourceSelection(params: {
  requestedSources: ConversationContextRequestedSourcePlan;
  sourceDecisions: ConversationContextSourceDecision[];
}): ConversationContextSourceSelection {
  return {
    requestMode: params.requestedSources.requestMode,
    consideredSourceIds: params.requestedSources.consideredSourceIds,
    defaultCandidateSourceIds: params.requestedSources.defaultCandidateSourceIds,
    explicitUserRequestedSourceIds: params.requestedSources.explicitUserRequestedSourceIds,
    requestedSourceIds: params.requestedSources.requestedSourceIds,
    plannerProposedSourceIds: params.requestedSources.plannerProposedSourceIds,
    policyRequiredSourceIds: params.requestedSources.policyRequiredSourceIds,
    fallbackCandidateSourceIds: params.requestedSources.fallbackCandidateSourceIds,
    allowedSourceIds: params.sourceDecisions
      .filter((sourceDecision) => sourceDecision.admission.status === "allowed")
      .map((sourceDecision) => sourceDecision.sourceId),
    executedSourceIds: params.sourceDecisions
      .filter((sourceDecision) => sourceDecision.execution.status === "executed")
      .map((sourceDecision) => sourceDecision.sourceId),
    excludedSourceIds: params.sourceDecisions
      .filter((sourceDecision) => sourceDecision.admission.status === "excluded")
      .map((sourceDecision) => sourceDecision.sourceId),
  };
}

export async function resolveConversationContextBundle(params: {
  conversationId: string;
  authority: ConversationContextSourceAuthority;
  sourcePlan?: ConversationContextAcquisitionPlan | null;
}, dependencies: ConversationContextResolverDependencies = {}): Promise<ConversationContextBundle> {
  const listDocuments = dependencies.listDocuments ?? (async (conversationId: string) => prisma.conversationDocument.findMany({
    where: { conversationId },
    orderBy: { createdAt: "asc" },
    select: {
      id: true,
      conversationId: true,
      filename: true,
      mimeType: true,
      fileType: true,
      storagePath: true,
    },
  }));
  const readTextFile = dependencies.readTextFile ?? ((storagePath: string) => readFile(storagePath, "utf8"));
  const readBinaryFile = dependencies.readBinaryFile ?? ((storagePath: string) => readFile(storagePath));
  const extractPdfText = dependencies.extractPdfText ?? extractThreadPdfText;
  const extractDocxText = dependencies.extractDocxText ?? extractThreadDocxText;
  const extractPptxText = dependencies.extractPptxText ?? extractThreadPptxText;
  const extractSpreadsheetText = dependencies.extractSpreadsheetText ?? extractThreadSpreadsheetText;
  const requestedSources = resolveRequestedConversationContextSourcePlan(params.sourcePlan);
  const sourceDecisions = resolveConversationContextSourceDecisions({
    conversationId: params.conversationId,
    authority: params.authority,
    requestedSources,
  });
  const threadDocumentsSourceDecision = sourceDecisions.find(
    (sourceDecision) => sourceDecision.sourceId === "thread_documents"
  );
  const documents = threadDocumentsSourceDecision?.status === "allowed"
    ? (await listDocuments(params.conversationId)).filter(
        (document) => document.conversationId === params.conversationId
      )
    : [];

  const sources: ConversationContextSource[] = [];
  const sections: string[] = [];
  const availabilityNotes: string[] = [];
  let remainingDocumentChars = MAX_THREAD_DOCUMENT_CONTEXT_BUNDLE_CHARS;
  let usedCount = 0;
  let unsupportedCount = 0;
  let failedCount = 0;
  let unavailableCount = 0;
  const threadDocumentExcludedCategories = new Set<ConversationContextSourceExclusionCategory>();

  for (const document of documents) {
    const contextKind = resolveThreadDocumentContextKind(document);

    if (!contextKind) {
      unsupportedCount += 1;
      threadDocumentExcludedCategories.add("implementation");
      const detail = `Attached to this thread, but thread-document context currently supports only ${THREAD_DOCUMENT_SUPPORT_DETAIL}.`;
      availabilityNotes.push(`- ${document.filename}: ${detail}`);
      sources.push(buildContextSource("unsupported", document.filename, detail));
      continue;
    }

    if (!isUploadPath(document.storagePath)) {
      failedCount += 1;
      const detail = "Attached to this thread, but the stored file path is invalid and could not be loaded safely.";
      availabilityNotes.push(`- ${document.filename}: ${detail}`);
      sources.push(buildContextSource("failed", document.filename, detail));
      continue;
    }

    if (contextKind === "image") {
      unavailableCount += 1;
      threadDocumentExcludedCategories.add("availability");
      const detail = buildImageRuntimeUnavailableDetail();
      availabilityNotes.push(`- ${document.filename}: ${detail}`);
      sources.push(buildContextSource("unavailable", document.filename, detail));
      continue;
    }

    if (remainingDocumentChars <= 0) {
      unavailableCount += 1;
      threadDocumentExcludedCategories.add("budget");
      const detail =
        "Attached to this thread, but not included in this runtime because the thread-document context budget was already used by earlier attachments.";
      availabilityNotes.push(`- ${document.filename}: ${detail}`);
      sources.push(buildContextSource("unavailable", document.filename, detail));
      continue;
    }

    let rawText: string;

    if (contextKind === "pdf" || contextKind === "docx" || contextKind === "pptx" || contextKind === "spreadsheet") {
      let fileBuffer: Buffer;
      try {
        fileBuffer = await readBinaryFile(document.storagePath);
      } catch (error) {
        failedCount += 1;
        const detail = `Attached to this thread, but ${resolveStorageReadFailureReason(error)}.`;
        availabilityNotes.push(`- ${document.filename}: ${detail}`);
        sources.push(buildContextSource("failed", document.filename, detail));
        continue;
      }

      try {
        rawText = contextKind === "pdf"
          ? await extractPdfText(fileBuffer)
          : contextKind === "docx"
            ? await extractDocxText(fileBuffer)
            : contextKind === "pptx"
              ? await extractPptxText(fileBuffer)
            : await extractSpreadsheetText(fileBuffer, {
              filename: document.filename,
              mimeType: document.mimeType,
            });
      } catch (error) {
        failedCount += 1;
        const detail = buildExtractionFailureDetail(contextKind, error);
        availabilityNotes.push(`- ${document.filename}: ${detail}`);
        sources.push(buildContextSource("failed", document.filename, detail));
        continue;
      }
    } else {
      try {
        rawText = await readTextFile(document.storagePath);
      } catch (error) {
        failedCount += 1;
        const detail = `Attached to this thread, but ${resolveStorageReadFailureReason(error)}.`;
        availabilityNotes.push(`- ${document.filename}: ${detail}`);
        sources.push(buildContextSource("failed", document.filename, detail));
        continue;
      }
    }

    const normalizedText = normalizeDocumentText(rawText);
    if (!normalizedText) {
      failedCount += 1;
      const detail = contextKind === "pdf"
        ? buildPdfNoReadableTextDetail()
        : contextKind === "docx"
          ? "Attached to this thread, but the DOCX parser returned no readable text."
          : contextKind === "pptx"
            ? buildPptxNoReadableTextDetail()
          : contextKind === "spreadsheet"
            ? buildSpreadsheetNoReadableTextDetail()
        : "Attached to this thread, but no readable text could be extracted from the stored file.";
      availabilityNotes.push(`- ${document.filename}: ${detail}`);
      sources.push(buildContextSource("failed", document.filename, detail));
      continue;
    }

    const excerpt = truncateDocumentText(
      normalizedText,
      Math.min(MAX_THREAD_DOCUMENT_CONTEXT_CHARS, remainingDocumentChars)
    );
    const truncated = excerpt.length < normalizedText.length;
    usedCount += 1;
    remainingDocumentChars -= excerpt.length;
    sections.push(`## Thread Document: ${document.filename}\n${excerpt}`);
    sources.push(buildContextSource(
      "used",
      document.filename,
      buildUsedThreadDocumentDetail(normalizedText.length, truncated)
    ));
  }

  const summarySources: ConversationContextSummarySource[] = [];
  if (documents.length > 0) {
    const parts = [
      usedCount > 0 ? `${usedCount} used` : null,
      unsupportedCount > 0 ? `${unsupportedCount} unsupported` : null,
      failedCount > 0 ? `${failedCount} failed` : null,
      unavailableCount > 0 ? `${unavailableCount} unavailable` : null,
    ].filter((part): part is string => Boolean(part));

    summarySources.push({
      id: "thread-documents",
      label: "Thread-attached documents",
      description:
        parts.length > 0
          ? `Current thread only. ${parts.join(", ")}. Thread-document context currently supports ${THREAD_DOCUMENT_SUPPORT_DETAIL}.`
          : "Documents are attached to this thread, but none produced context for this runtime.",
    });
  }
  const finalizedSourceDecisions = sourceDecisions.map((sourceDecision) =>
    finalizeConversationContextSourceDecision({
      sourceDecision,
      threadDocumentSummary: {
        totalCount: documents.length,
        usedCount,
        unsupportedCount,
        failedCount,
        unavailableCount,
        excludedCategories: [...threadDocumentExcludedCategories],
      },
    })
  );

  return {
    text: [
      sections.length > 0
        ? [
          "## Thread-Attached Documents (Current Conversation Only)",
          "Use these files as supporting thread context. Recent thread messages and the user's current request remain higher authority.",
          sections.join("\n\n"),
        ].join("\n\n")
        : null,
      availabilityNotes.length > 0
        ? [
            "## Thread Document Availability",
            "These attachments are present on the current thread but were not loaded into this runtime context:",
            availabilityNotes.join("\n"),
          ].join("\n\n")
        : null,
    ].filter((section): section is string => Boolean(section)).join("\n\n"),
    sources,
    summarySources,
    sourceSelection: buildConversationContextSourceSelection({
      requestedSources,
      sourceDecisions: finalizedSourceDecisions,
    }),
    sourceDecisions: finalizedSourceDecisions,
  };
}
