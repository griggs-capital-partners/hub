import type { ContextDocumentStructuredRangeInput } from "./context-document-chunks";

export type PdfTextPage = {
  num: number;
  text: string;
};

export type PdfInfoPage = {
  pageNumber: number;
  pageLabel?: string | null;
};

export type PdfTablePage = {
  num: number;
  tables: string[][][];
};

export type PdfVisualClassification =
  | "true_table"
  | "table_like_schedule_or_timeline"
  | "map_or_location_figure"
  | "chart_or_plot"
  | "technical_log_or_well_log"
  | "schematic_or_diagram"
  | "photo_or_core_image"
  | "caption_or_callout"
  | "low_text_or_scanned_visual"
  | "unknown_visual";

export type PdfVisualClassificationConfidence = "high" | "medium" | "low";

export type PdfPageStructureSummary = {
  pageNumber: number;
  pageLabel: string | null;
  title: string | null;
  primaryClassification: PdfVisualClassification;
  confidence: PdfVisualClassificationConfidence;
  reasonCodes: string[];
  lowText: boolean;
  textLineCount: number;
  extractedTableCandidateCount: number;
  retainedTableSummaryCount: number;
  rejectedTableCandidateCount: number;
  detectedCaptionCount: number;
};

export type PdfContextExtractionMetadata = {
  extractor: string;
  extractorVersion: string;
  totalPages: number;
  extractedPageCount: number;
  lowTextPageNumbers: number[];
  lowTextPageLabels: string[];
  suppressedHeaderLines: string[];
  suppressedFooterLines: string[];
  detectedTableCount: number;
  retainedTableSummaryCount: number;
  rejectedTableCandidateCount: number;
  detectedTableCaptionCount: number;
  detectedFigureCaptionCount: number;
  pageLabelsAvailable: boolean;
  partialExtraction: boolean;
  ocrStatus: "not_implemented";
  tableExtractionStatus: "used" | "not_available" | "failed";
  tableExtractionDetail: string | null;
  pageStructures: PdfPageStructureSummary[];
  classificationCounts: Record<PdfVisualClassification, number>;
  detail: string;
};

export type PdfContextExtractionResult = {
  text: string;
  structuredRanges: ContextDocumentStructuredRangeInput[];
  metadata: PdfContextExtractionMetadata;
};

type PdfCaptionRange = {
  text: string;
  label: string;
  pageNumber: number;
  pageLabel: string | null;
  tableId: string | null;
  figureId: string | null;
};

type PdfTableCandidateAnalysis = {
  rows: string[][];
  populatedRowCount: number;
  populatedCellCount: number;
  numericCellCount: number;
  maxColumns: number;
  isReliableStructuredTable: boolean;
  isRejectedNoise: boolean;
};

type PdfPageClassification = {
  primaryClassification: PdfVisualClassification;
  confidence: PdfVisualClassificationConfidence;
  reasonCodes: string[];
};

type PdfPageAnalysis = {
  pageNumber: number;
  pageLabel: string | null;
  title: string | null;
  cleanedText: string;
  lowText: boolean;
  captions: PdfCaptionRange[];
  tableCount: number;
  retainedTableSummaryCount: number;
  rejectedTableCandidateCount: number;
  tableSummaries: ContextDocumentStructuredRangeInput[];
  primaryClassification: PdfVisualClassification;
  classificationConfidence: PdfVisualClassificationConfidence;
  classificationReasonCodes: string[];
  visualAnchorTitle: string | null;
  textLineCount: number;
  suppressedHeaderLines: string[];
  suppressedFooterLines: string[];
};

const LOW_TEXT_CHAR_THRESHOLD = 24;
const LOW_TEXT_ALNUM_THRESHOLD = 8;
const MAX_TABLE_ROWS = 12;
const MAX_TABLE_COLUMNS = 8;
const MAX_CAPTIONS_PER_PAGE = 4;
const MAX_HEADER_FOOTER_SCAN_LINES = 2;
const MONTH_OR_QUARTER_MARKERS = [
  "jan",
  "feb",
  "mar",
  "apr",
  "may",
  "jun",
  "jul",
  "aug",
  "sep",
  "sept",
  "oct",
  "nov",
  "dec",
  "qtr 1",
  "qtr 2",
  "qtr 3",
  "qtr 4",
] as const;
const TRUE_TABLE_TITLE_MARKERS = [
  "water chemistry",
  "chemistry",
  "mineral concentration",
  "mineral concentrations",
  "concentration",
  "concentrations",
  "assay",
  "composition",
  "compositions",
  "analysis",
] as const;
const TIMELINE_MARKERS = [
  "timeline",
  "gantt",
  "schedule",
  "scope of work",
] as const;
const MAP_OR_LOCATION_MARKERS = [
  "regional",
  "project area",
  "project",
  "location",
  "proposed location",
  "trend",
  "structure",
  "fault system",
  "tds",
  "seismic review",
  "survey",
] as const;
const CHART_OR_PLOT_MARKERS = [
  "temperature",
  "temps",
  "production rates",
  "rate",
  "rates",
  "trend",
  "curve",
  "barrels/day",
] as const;
const TECHNICAL_LOG_MARKERS = [
  "well log",
  "wireline",
  "quad combo",
  "gamma",
  "resistivity",
  "neutron",
  "density",
  "mud log",
  "production log",
  "drillstem",
] as const;
const SCHEMATIC_MARKERS = [
  "schematic",
  "diagram",
  "casing",
  "cemented",
  "open hole",
  "production ready",
] as const;
const PHOTO_OR_CORE_MARKERS = [
  "photo credit",
  "photo",
  "photograph",
  "core",
  "oolite",
  "oolites",
] as const;

function normalizePdfText(value: string | null | undefined) {
  return (value ?? "")
    .replace(/\r\n/g, "\n")
    .replace(/\u0000/g, "")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function normalizePdfLine(value: string | null | undefined) {
  return (value ?? "")
    .replace(/\s+/g, " ")
    .trim();
}

function normalizePdfKeywordText(value: string | null | undefined) {
  return normalizePdfLine(value).toLowerCase();
}

function splitNonEmptyLines(value: string) {
  return value
    .split("\n")
    .map((line) => normalizePdfLine(line))
    .filter((line) => line.length > 0);
}

function countReadableAlphaNumeric(value: string) {
  return (value.match(/[A-Za-z0-9]/g) ?? []).length;
}

function countKeywordMatches(value: string, keywords: readonly string[]) {
  return keywords.reduce(
    (count, keyword) => count + (value.includes(keyword) ? 1 : 0),
    0
  );
}

function isLikelyPageNumberLine(value: string) {
  const normalized = normalizePdfLine(value)
    .replace(/^[\-\u2013\u2014\s]+/, "")
    .replace(/[\-\u2013\u2014\s]+$/, "");

  if (!normalized) {
    return false;
  }

  return /^(?:page\s+)?(?:[ivxlcdm]+|\d+)(?:\s+of\s+(?:[ivxlcdm]+|\d+))?$/i.test(normalized);
}

function isLikelyBoilerplateFurniture(value: string) {
  const normalized = normalizePdfLine(value).toLowerCase();
  if (!normalized) {
    return false;
  }

  if (isLikelyPageNumberLine(normalized)) {
    return true;
  }

  if (
    normalized.includes("confidential") ||
    normalized.includes("privileged") ||
    normalized.includes("proprietary") ||
    normalized.includes("internal use") ||
    normalized.includes("draft")
  ) {
    return true;
  }

  return normalized.length <= 80 && /^[a-z0-9][a-z0-9 .,&()/:-]+$/i.test(normalized);
}

function isLikelyMeaningfulHeading(value: string) {
  const normalized = normalizePdfLine(value);
  if (!normalized) {
    return false;
  }

  return /^(article|section|exhibit|schedule|appendix|attachment|figure|fig\.?|table|chapter|part)\b/i.test(normalized) ||
    /^\d+(?:\.\d+)*[.)]?\s+[A-Z]/.test(normalized);
}

function buildRepeatedLineCounts(
  pages: PdfTextPage[],
  position: "header" | "footer"
) {
  const counts = new Map<string, number>();

  for (const page of pages) {
    const lines = splitNonEmptyLines(normalizePdfText(page.text));
    const candidates = position === "header"
      ? lines.slice(0, MAX_HEADER_FOOTER_SCAN_LINES)
      : lines.slice(Math.max(0, lines.length - MAX_HEADER_FOOTER_SCAN_LINES));
    const seenOnPage = new Set<string>();

    for (const candidate of candidates) {
      if (!candidate || seenOnPage.has(candidate.toLowerCase())) {
        continue;
      }

      seenOnPage.add(candidate.toLowerCase());
      counts.set(candidate.toLowerCase(), (counts.get(candidate.toLowerCase()) ?? 0) + 1);
    }
  }

  return counts;
}

function shouldSuppressRepeatedFurnitureLine(
  line: string,
  repeatedCounts: Map<string, number>
) {
  const normalized = normalizePdfLine(line);
  if (!normalized || isLikelyMeaningfulHeading(normalized)) {
    return false;
  }

  const repeatedCount = repeatedCounts.get(normalized.toLowerCase()) ?? 0;
  if (repeatedCount < 2) {
    return false;
  }

  if (isLikelyPageNumberLine(normalized)) {
    return true;
  }

  if (isLikelyBoilerplateFurniture(normalized)) {
    return true;
  }

  return repeatedCount >= 3 && normalized.length <= 80;
}

function cleanPdfPageText(
  pageText: string,
  repeatedHeaders: Map<string, number>,
  repeatedFooters: Map<string, number>
) {
  const lines = normalizePdfText(pageText).split("\n");
  const nonEmptyIndexes = lines
    .map((line, index) => ({ line: normalizePdfLine(line), index }))
    .filter((entry) => entry.line.length > 0);
  const headerIndexes = new Set(
    nonEmptyIndexes.slice(0, MAX_HEADER_FOOTER_SCAN_LINES).map((entry) => entry.index)
  );
  const footerIndexes = new Set(
    nonEmptyIndexes.slice(Math.max(0, nonEmptyIndexes.length - MAX_HEADER_FOOTER_SCAN_LINES)).map((entry) => entry.index)
  );
  const suppressedHeaderLines = new Set<string>();
  const suppressedFooterLines = new Set<string>();

  const cleanedLines = lines.filter((line, index) => {
    const normalized = normalizePdfLine(line);
    if (!normalized) {
      return true;
    }

    if (
      headerIndexes.has(index) &&
      (isLikelyPageNumberLine(normalized) || shouldSuppressRepeatedFurnitureLine(normalized, repeatedHeaders))
    ) {
      suppressedHeaderLines.add(normalized);
      return false;
    }

    if (
      footerIndexes.has(index) &&
      (isLikelyPageNumberLine(normalized) || shouldSuppressRepeatedFurnitureLine(normalized, repeatedFooters))
    ) {
      suppressedFooterLines.add(normalized);
      return false;
    }

    return true;
  });

  return {
    text: normalizePdfText(cleanedLines.join("\n")),
    suppressedHeaderLines: [...suppressedHeaderLines],
    suppressedFooterLines: [...suppressedFooterLines],
  };
}

function buildPageLabel(pageNumber: number, pageLabel: string | null) {
  return pageLabel ? `page ${pageLabel}` : `page ${pageNumber}`;
}

function looksTableLikeText(value: string) {
  const lines = normalizePdfText(value).split("\n");
  return lines.filter((line) => line.includes("\t")).length >= 2;
}

function cleanTableCell(value: string | null | undefined) {
  return normalizePdfLine(value ?? "");
}

function formatPdfVisualClassificationLabel(classification: PdfVisualClassification) {
  switch (classification) {
    case "true_table":
      return "true data table";
    case "table_like_schedule_or_timeline":
      return "table-like schedule/timeline visual";
    case "map_or_location_figure":
      return "map/location figure";
    case "chart_or_plot":
      return "chart/plot visual";
    case "technical_log_or_well_log":
      return "technical or well-log visual";
    case "schematic_or_diagram":
      return "schematic/diagram";
    case "photo_or_core_image":
      return "photo/core image";
    case "caption_or_callout":
      return "caption/callout text";
    case "low_text_or_scanned_visual":
      return "low-text/scanned visual";
    case "unknown_visual":
    default:
      return "visual page of unclear type";
  }
}

export { formatPdfVisualClassificationLabel };

function resolvePdfPageTitle(lines: string[]) {
  const candidates = lines.filter((line) => !isLikelyPageNumberLine(line));
  if (candidates.length === 0) {
    return null;
  }

  if (
    candidates.length >= 2 &&
    candidates[0].length <= 48 &&
    candidates[1].length <= 56 &&
    !/^[\u2022*-]/.test(candidates[0]) &&
    !/^[\u2022*-]/.test(candidates[1])
  ) {
    return normalizePdfLine(`${candidates[0]} ${candidates[1]}`);
  }

  return candidates[0];
}

function shouldPreserveStructuredHeadingContext(pageText: string) {
  return splitNonEmptyLines(pageText).some((line) =>
    /^(article|section|appendix|attachment|exhibit|schedule)\b/i.test(line) ||
    /^\d+(?:\.\d+)*[.)]?\s+[A-Z]/.test(line)
  );
}

function analyzePdfTableCandidate(table: string[][]): PdfTableCandidateAnalysis {
  const rows = table.map((row) => row.map((cell) => cleanTableCell(cell)));
  const populatedRows = rows.filter((row) => row.some((cell) => cell.length > 0));
  const populatedRowCount = populatedRows.length;
  const populatedCellCount = populatedRows.reduce(
    (sum, row) => sum + row.filter((cell) => cell.length > 0).length,
    0
  );
  const numericCellCount = populatedRows.reduce(
    (sum, row) =>
      sum +
      row.filter((cell) => /(?:\d|ppm|%|barrels\/day|ft|f\b|c\b)/i.test(cell)).length,
    0
  );
  const maxColumns = populatedRows.reduce(
    (max, row) => Math.max(max, row.filter((cell) => cell.length > 0).length),
    0
  );
  const isReliableStructuredTable =
    populatedRowCount >= 2 &&
    maxColumns >= 2 &&
    populatedCellCount >= 4;

  return {
    rows,
    populatedRowCount,
    populatedCellCount,
    numericCellCount,
    maxColumns,
    isReliableStructuredTable,
    isRejectedNoise: !isReliableStructuredTable,
  };
}

function renderPdfTable(label: string, tableAnalysis: PdfTableCandidateAnalysis) {
  const rows = tableAnalysis.rows
    .map((row) => row.slice(0, MAX_TABLE_COLUMNS))
    .filter((row) => row.some((cell) => cell.length > 0));
  if (rows.length === 0) {
    return null;
  }

  const visibleRows = rows.slice(0, MAX_TABLE_ROWS);
  const lines = [label, ...visibleRows.map((row) => row.join("\t"))];
  if (rows.length > visibleRows.length) {
    lines.push(`... [${rows.length - visibleRows.length} additional table rows omitted]`);
  }

  return lines.join("\n");
}

function extractCaptionRanges(
  pageText: string,
  pageNumber: number,
  pageLabel: string | null
) {
  const captions: PdfCaptionRange[] = [];

  for (const line of splitNonEmptyLines(pageText)) {
    if (captions.length >= MAX_CAPTIONS_PER_PAGE) {
      break;
    }

    const match = /^(figure|fig\.?|chart|diagram|image|table)\s+([a-z0-9.-]+)(?:\s*[:.\-]\s*|\s+)(.+)$/i.exec(line);
    if (!match) {
      continue;
    }

    const kind = match[1].toLowerCase().startsWith("table") ? "table" : "figure";
    const label = `${kind === "table" ? "Table" : "Figure"} ${match[2]} - ${normalizePdfLine(match[3])}`;
    captions.push({
      text: normalizePdfLine(line),
      label,
      pageNumber,
      pageLabel,
      tableId: kind === "table" ? `Table ${match[2]}` : null,
      figureId: kind === "figure" ? `Figure ${match[2]}` : null,
    });
  }

  return captions;
}

function classifyPdfPage(params: {
  cleanedText: string;
  title: string | null;
  lowText: boolean;
  captions: PdfCaptionRange[];
  tableCandidates: PdfTableCandidateAnalysis[];
}) : PdfPageClassification {
  const normalizedText = normalizePdfKeywordText(params.cleanedText);
  const normalizedTitle = normalizePdfKeywordText(params.title);
  const textLines = splitNonEmptyLines(params.cleanedText);
  const reliableTableCount = params.tableCandidates.filter((candidate) => candidate.isReliableStructuredTable).length;
  const rejectedTableCount = params.tableCandidates.filter((candidate) => candidate.isRejectedNoise).length;
  const monthQuarterMatches = countKeywordMatches(normalizedText, MONTH_OR_QUARTER_MARKERS);
  const hasTimelineSignal =
    countKeywordMatches(normalizedTitle, TIMELINE_MARKERS) > 0 ||
    monthQuarterMatches >= 3;
  const hasSchematicSignal = countKeywordMatches(normalizedText, SCHEMATIC_MARKERS) > 0;
  const hasPhotoSignal = countKeywordMatches(normalizedText, PHOTO_OR_CORE_MARKERS) > 0;
  const hasTechnicalLogSignal = countKeywordMatches(normalizedText, TECHNICAL_LOG_MARKERS) > 0;
  const hasChartSignal =
    countKeywordMatches(normalizedText, CHART_OR_PLOT_MARKERS) > 0 ||
    normalizedTitle.includes("bottom hole temps");
  const hasMapSignal = countKeywordMatches(normalizedText, MAP_OR_LOCATION_MARKERS) > 0;
  const hasTableTitleSignal =
    countKeywordMatches(normalizedTitle, TRUE_TABLE_TITLE_MARKERS) > 0 ||
    countKeywordMatches(normalizedText, TRUE_TABLE_TITLE_MARKERS) > 0;

  if (reliableTableCount > 0) {
    return {
      primaryClassification: "true_table",
      confidence: "high",
      reasonCodes: ["structured_table_cells"],
    };
  }

  if (hasTimelineSignal) {
    return {
      primaryClassification: "table_like_schedule_or_timeline",
      confidence: "high",
      reasonCodes: [
        ...(countKeywordMatches(normalizedTitle, TIMELINE_MARKERS) > 0 ? ["timeline_title"] : []),
        ...(monthQuarterMatches >= 3 ? ["month_quarter_grid"] : []),
      ],
    };
  }

  if (hasSchematicSignal) {
    return {
      primaryClassification: "schematic_or_diagram",
      confidence: "high",
      reasonCodes: ["schematic_keyword"],
    };
  }

  if (hasPhotoSignal) {
    return {
      primaryClassification: "photo_or_core_image",
      confidence: "high",
      reasonCodes: ["photo_core_keyword"],
    };
  }

  if (hasTechnicalLogSignal) {
    return {
      primaryClassification: "technical_log_or_well_log",
      confidence: "high",
      reasonCodes: ["technical_log_keyword"],
    };
  }

  if (hasChartSignal) {
    return {
      primaryClassification: "chart_or_plot",
      confidence: "high",
      reasonCodes: ["chart_or_rate_keyword"],
    };
  }

  if (hasMapSignal) {
    return {
      primaryClassification: "map_or_location_figure",
      confidence: "high",
      reasonCodes: ["map_or_location_keyword"],
    };
  }

  if (hasTableTitleSignal) {
    const titleOnlyTableInference = params.lowText || textLines.length <= 2;
    return {
      primaryClassification: "true_table",
      confidence: titleOnlyTableInference ? "low" : "medium",
      reasonCodes: [
        "table_title_keyword",
        ...(params.lowText ? ["low_text_page"] : []),
        ...(titleOnlyTableInference ? ["title_only_table_inference"] : []),
        ...(rejectedTableCount > 0 ? ["table_candidates_rejected"] : []),
      ],
    };
  }

  if (params.captions.length > 0 && textLines.length <= 3) {
    return {
      primaryClassification: "caption_or_callout",
      confidence: "medium",
      reasonCodes: ["caption_pattern"],
    };
  }

  if (params.lowText) {
    return {
      primaryClassification: "low_text_or_scanned_visual",
      confidence: "medium",
      reasonCodes: [
        "low_text_page",
        ...(rejectedTableCount > 0 ? ["table_candidates_rejected"] : []),
      ],
    };
  }

  return {
    primaryClassification: "unknown_visual",
    confidence: "low",
    reasonCodes: [
      ...(rejectedTableCount > 0 ? ["table_candidates_rejected"] : []),
      "unknown_visual_fallback",
    ],
  };
}

function buildEmptyClassificationCounts(): Record<PdfVisualClassification, number> {
  return {
    true_table: 0,
    table_like_schedule_or_timeline: 0,
    map_or_location_figure: 0,
    chart_or_plot: 0,
    technical_log_or_well_log: 0,
    schematic_or_diagram: 0,
    photo_or_core_image: 0,
    caption_or_callout: 0,
    low_text_or_scanned_visual: 0,
    unknown_visual: 0,
  };
}

function buildPdfPageAnalysis(
  page: PdfTextPage,
  pageLabel: string | null,
  tablePage: PdfTablePage | null,
  repeatedHeaders: Map<string, number>,
  repeatedFooters: Map<string, number>,
  tableExtractionAvailable: boolean
): PdfPageAnalysis {
  const cleanedPage = cleanPdfPageText(page.text, repeatedHeaders, repeatedFooters);
  const lowText =
    cleanedPage.text.length < LOW_TEXT_CHAR_THRESHOLD ||
    countReadableAlphaNumeric(cleanedPage.text) < LOW_TEXT_ALNUM_THRESHOLD;
  const captions = extractCaptionRanges(cleanedPage.text, page.num, pageLabel);
  const title = resolvePdfPageTitle(splitNonEmptyLines(cleanedPage.text));
  const tableCandidates = (tablePage?.tables ?? []).map((table) => analyzePdfTableCandidate(table));
  const classification = classifyPdfPage({
    cleanedText: cleanedPage.text,
    title,
    lowText,
    captions,
    tableCandidates,
  });
  const retainedTableCandidates = tableCandidates.filter((candidate) => candidate.isReliableStructuredTable);
  const tableSummaries: ContextDocumentStructuredRangeInput[] = [];

  if (
    tableExtractionAvailable &&
    retainedTableCandidates.length > 0 &&
    !looksTableLikeText(cleanedPage.text)
  ) {
    for (const [tableIndex, tableCandidate] of retainedTableCandidates.entries()) {
      const label = `Table ${tableIndex + 1}`;
      const renderedTable = renderPdfTable(label, tableCandidate);
      if (!renderedTable) {
        continue;
      }

      tableSummaries.push({
        text: renderedTable,
        sectionPath: [label],
        headingPath: [label],
        pageNumber: page.num,
        pageLabel,
        tableId: label,
        visualClassification: classification.primaryClassification,
        visualClassificationConfidence: classification.confidence,
        visualClassificationReasonCodes: [...classification.reasonCodes],
        visualAnchorTitle: title,
        updatesHeadingContext: false,
      });
    }
  }

  return {
    pageNumber: page.num,
    pageLabel,
    title,
    cleanedText: cleanedPage.text,
    lowText,
    captions,
    tableCount: tableCandidates.length,
    retainedTableSummaryCount: tableSummaries.length,
    rejectedTableCandidateCount: tableCandidates.filter((candidate) => candidate.isRejectedNoise).length,
    tableSummaries,
    primaryClassification: classification.primaryClassification,
    classificationConfidence: classification.confidence,
    classificationReasonCodes: classification.reasonCodes,
    visualAnchorTitle: title,
    textLineCount: splitNonEmptyLines(cleanedPage.text).length,
    suppressedHeaderLines: cleanedPage.suppressedHeaderLines,
    suppressedFooterLines: cleanedPage.suppressedFooterLines,
  };
}

export function buildPdfContextExtractionResult(params: {
  textPages: PdfTextPage[];
  infoPages?: PdfInfoPage[];
  tablePages?: PdfTablePage[];
  extractorVersion?: string | null;
  tableExtractionErrorDetail?: string | null;
}) : PdfContextExtractionResult {
  const pageInfoByNumber = new Map((params.infoPages ?? []).map((page) => [page.pageNumber, page]));
  const tablePagesByNumber = new Map((params.tablePages ?? []).map((page) => [page.num, page]));
  const repeatedHeaders = buildRepeatedLineCounts(params.textPages, "header");
  const repeatedFooters = buildRepeatedLineCounts(params.textPages, "footer");
  const tableExtractionStatus = params.tableExtractionErrorDetail
    ? "failed"
    : params.tablePages
      ? "used"
      : "not_available";
  const analyses = params.textPages.map((page) =>
    buildPdfPageAnalysis(
      page,
      pageInfoByNumber.get(page.num)?.pageLabel?.trim() || null,
      tablePagesByNumber.get(page.num) ?? null,
      repeatedHeaders,
      repeatedFooters,
      tableExtractionStatus === "used"
    )
  );
  const structuredRanges: ContextDocumentStructuredRangeInput[] = [];
  const suppressedHeaderLines = new Set<string>();
  const suppressedFooterLines = new Set<string>();
  const classificationCounts = buildEmptyClassificationCounts();
  let detectedTableCount = 0;
  let retainedTableSummaryCount = 0;
  let rejectedTableCandidateCount = 0;
  let detectedTableCaptionCount = 0;
  let detectedFigureCaptionCount = 0;

  for (const page of analyses) {
    page.suppressedHeaderLines.forEach((line) => suppressedHeaderLines.add(line));
    page.suppressedFooterLines.forEach((line) => suppressedFooterLines.add(line));
    classificationCounts[page.primaryClassification] += 1;
    detectedTableCount += page.tableCount;
    retainedTableSummaryCount += page.retainedTableSummaryCount;
    rejectedTableCandidateCount += page.rejectedTableCandidateCount;
    detectedTableCaptionCount += page.captions.filter((caption) => caption.tableId).length;
    detectedFigureCaptionCount += page.captions.filter((caption) => caption.figureId).length;

    if (page.cleanedText) {
      structuredRanges.push({
        text: page.cleanedText,
        pageNumber: page.pageNumber,
        pageLabel: page.pageLabel,
        visualClassification: page.primaryClassification,
        visualClassificationConfidence: page.classificationConfidence,
        visualClassificationReasonCodes: [...page.classificationReasonCodes],
        visualAnchorTitle: page.visualAnchorTitle,
        updatesHeadingContext:
          page.primaryClassification === "unknown_visual" ||
          shouldPreserveStructuredHeadingContext(page.cleanedText),
      });
    }

    for (const caption of page.captions) {
      structuredRanges.push({
        text: caption.text,
        sectionPath: [caption.label],
        headingPath: [caption.label],
        pageNumber: caption.pageNumber,
        pageLabel: caption.pageLabel,
        tableId: caption.tableId,
        figureId: caption.figureId,
        visualClassification: "caption_or_callout",
        visualClassificationConfidence: "high",
        visualClassificationReasonCodes: ["caption_pattern"],
        visualAnchorTitle: caption.label,
        updatesHeadingContext: false,
      });
    }

    structuredRanges.push(...page.tableSummaries);
  }

  const text = structuredRanges
    .map((range) => normalizePdfText(range.text))
    .filter((rangeText) => rangeText.length > 0)
    .join("\n\n");
  const totalPages = Math.max(
    analyses.length,
    params.infoPages?.length ?? 0,
    params.tablePages?.length ?? 0
  );
  const extractedPageNumbers = new Set(
    structuredRanges
      .map((range) => range.pageNumber)
      .filter((pageNumber): pageNumber is number => typeof pageNumber === "number" && Number.isFinite(pageNumber))
  );
  const lowTextPages = analyses.filter((page) => page.lowText);
  const lowTextPageNumbers = lowTextPages.map((page) => page.pageNumber);
  const lowTextPageLabels = lowTextPages.map((page) => buildPageLabel(page.pageNumber, page.pageLabel));
  const extractedPageCount = extractedPageNumbers.size;
  const partialExtraction = extractedPageCount > 0 && lowTextPageNumbers.length > 0;
  const pageStructures: PdfPageStructureSummary[] = analyses.map((page) => ({
    pageNumber: page.pageNumber,
    pageLabel: page.pageLabel,
    title: page.title,
    primaryClassification: page.primaryClassification,
    confidence: page.classificationConfidence,
    reasonCodes: [...page.classificationReasonCodes],
    lowText: page.lowText,
    textLineCount: page.textLineCount,
    extractedTableCandidateCount: page.tableCount,
    retainedTableSummaryCount: page.retainedTableSummaryCount,
    rejectedTableCandidateCount: page.rejectedTableCandidateCount,
    detectedCaptionCount: page.captions.length,
  }));
  const detailParts = [
    extractedPageCount === totalPages
      ? `Extracted readable text from ${extractedPageCount} of ${totalPages} PDF pages.`
      : `Extracted readable text from ${extractedPageCount} of ${totalPages} PDF pages and preserved partial page-aware provenance.`,
    lowTextPageNumbers.length > 0
      ? `${lowTextPageNumbers.length} page${lowTextPageNumbers.length === 1 ? "" : "s"} had little or no extractable text; OCR is not implemented in this pass.`
      : null,
    suppressedHeaderLines.size > 0 || suppressedFooterLines.size > 0
      ? `Removed conservative repeated page furniture from ${suppressedHeaderLines.size + suppressedFooterLines.size} distinct line${suppressedHeaderLines.size + suppressedFooterLines.size === 1 ? "" : "s"}.`
      : null,
    detectedTableCount > 0
      ? `Detected ${detectedTableCount} PDF table candidate${detectedTableCount === 1 ? "" : "s"} and retained ${retainedTableSummaryCount} structured table ${retainedTableSummaryCount === 1 ? "summary" : "summaries"}.`
      : null,
    classificationCounts.true_table > 0
      ? `Classified ${classificationCounts.true_table} page${classificationCounts.true_table === 1 ? "" : "s"} as true data table${classificationCounts.true_table === 1 ? "" : "s"}.`
      : null,
    classificationCounts.table_like_schedule_or_timeline > 0
      ? `Classified ${classificationCounts.table_like_schedule_or_timeline} page${classificationCounts.table_like_schedule_or_timeline === 1 ? "" : "s"} as schedule/timeline visuals.`
      : null,
    params.tableExtractionErrorDetail
      ? `Table extraction fallback was unavailable (${params.tableExtractionErrorDetail}).`
      : null,
  ].filter((part): part is string => Boolean(part));

  return {
    text,
    structuredRanges,
    metadata: {
      extractor: "pdf-parse",
      extractorVersion: params.extractorVersion?.trim() || "pdf-parse",
      totalPages,
      extractedPageCount,
      lowTextPageNumbers,
      lowTextPageLabels,
      suppressedHeaderLines: [...suppressedHeaderLines],
      suppressedFooterLines: [...suppressedFooterLines],
      detectedTableCount,
      retainedTableSummaryCount,
      rejectedTableCandidateCount,
      detectedTableCaptionCount,
      detectedFigureCaptionCount,
      pageLabelsAvailable: analyses.some((page) => Boolean(page.pageLabel)),
      partialExtraction,
      ocrStatus: "not_implemented",
      tableExtractionStatus,
      tableExtractionDetail: params.tableExtractionErrorDetail ?? null,
      pageStructures,
      classificationCounts,
      detail: detailParts.join(" "),
    },
  };
}
