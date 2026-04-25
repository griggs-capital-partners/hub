export type ContextBudgetMode = "standard" | "deep";

export const DEFAULT_APPROX_CHARS_PER_TOKEN = 4;
const DEFAULT_MINIMUM_NON_EMPTY_TOKENS = 1;
const DEFAULT_SECTION_OVERHEAD_TOKENS = 2;
const DEFAULT_LINE_OVERHEAD_TOKENS = 1;
const DEFAULT_METADATA_ENTRY_OVERHEAD_TOKENS = 1;

export type TextTokenEstimateOptions = {
  charsPerToken?: number;
  minimumTokens?: number;
  fixedOverheadTokens?: number;
};

export type FormattingOverheadEstimateOptions = {
  fixedTokens?: number;
  lineCount?: number;
  perLineTokens?: number;
  sectionCount?: number;
  perSectionTokens?: number;
  metadataEntryCount?: number;
  metadataEntryTokens?: number;
};

export type ThreadMessageTokenEstimateInput = {
  role?: string | null;
  content?: string | null;
};

export type SourceTextTokenEstimateInput = {
  label?: string | null;
  text?: string | null;
  metadataLines?: Array<string | null | undefined>;
  provenanceLines?: Array<string | null | undefined>;
};

export type ContextSectionTokenEstimateInput = {
  heading?: string | null;
  body?: string | null;
  metadataLines?: Array<string | null | undefined>;
  provenanceLines?: Array<string | null | undefined>;
};

function normalizeTokenizableText(value: string | null | undefined) {
  return value?.replace(/\r\n/g, "\n").trim() ?? "";
}

function compactLines(values: Array<string | null | undefined> | null | undefined) {
  return (values ?? []).map((value) => normalizeTokenizableText(value)).filter(Boolean);
}

export function estimateTextTokens(
  value: string | null | undefined,
  options: TextTokenEstimateOptions = {}
) {
  const normalized = normalizeTokenizableText(value);
  if (!normalized) {
    return 0;
  }

  const charsPerToken = Math.max(1, options.charsPerToken ?? DEFAULT_APPROX_CHARS_PER_TOKEN);
  const minimumTokens = Math.max(0, options.minimumTokens ?? DEFAULT_MINIMUM_NON_EMPTY_TOKENS);
  const fixedOverheadTokens = Math.max(0, options.fixedOverheadTokens ?? 0);

  return Math.max(minimumTokens, Math.ceil(normalized.length / charsPerToken)) + fixedOverheadTokens;
}

export function estimateFormattingOverheadTokens(
  options: FormattingOverheadEstimateOptions = {}
) {
  const fixedTokens = Math.max(0, options.fixedTokens ?? 0);
  const lineCount = Math.max(0, options.lineCount ?? 0);
  const perLineTokens = Math.max(0, options.perLineTokens ?? DEFAULT_LINE_OVERHEAD_TOKENS);
  const sectionCount = Math.max(0, options.sectionCount ?? 0);
  const perSectionTokens = Math.max(0, options.perSectionTokens ?? DEFAULT_SECTION_OVERHEAD_TOKENS);
  const metadataEntryCount = Math.max(0, options.metadataEntryCount ?? 0);
  const metadataEntryTokens = Math.max(
    0,
    options.metadataEntryTokens ?? DEFAULT_METADATA_ENTRY_OVERHEAD_TOKENS
  );

  return (
    fixedTokens +
    lineCount * perLineTokens +
    sectionCount * perSectionTokens +
    metadataEntryCount * metadataEntryTokens
  );
}

export function estimateThreadMessageTokens(
  message: ThreadMessageTokenEstimateInput,
  options: TextTokenEstimateOptions = {}
) {
  const role = normalizeTokenizableText(message.role);
  const content = normalizeTokenizableText(message.content);
  if (!content) {
    return 0;
  }

  const serialized = role ? `${role}: ${content}` : content;
  return estimateTextTokens(serialized, options);
}

export function estimateThreadMessagesTokens(
  messages: ThreadMessageTokenEstimateInput[],
  options: TextTokenEstimateOptions = {}
) {
  const serialized = messages
    .map((message) => {
      const role = normalizeTokenizableText(message.role);
      const content = normalizeTokenizableText(message.content);
      if (!content) {
        return "";
      }

      return role ? `${role}: ${content}` : content;
    })
    .filter(Boolean)
    .join("\n");

  return estimateTextTokens(serialized, options);
}

export function estimateProvenanceLineTokens(
  value: string | null | undefined,
  options: TextTokenEstimateOptions = {}
) {
  return estimateTextTokens(value, {
    ...options,
    fixedOverheadTokens: (options.fixedOverheadTokens ?? 0) + 1,
  });
}

export function estimateContextSectionTokens(
  section: ContextSectionTokenEstimateInput,
  options: TextTokenEstimateOptions = {}
) {
  const heading = normalizeTokenizableText(section.heading);
  const body = normalizeTokenizableText(section.body);
  const metadataLines = compactLines(section.metadataLines);
  const provenanceLines = compactLines(section.provenanceLines);
  const blocks = [
    heading ? 1 : 0,
    body ? 1 : 0,
    metadataLines.length > 0 ? 1 : 0,
    provenanceLines.length > 0 ? 1 : 0,
  ].filter(Boolean).length;

  return (
    estimateTextTokens(heading, options) +
    estimateTextTokens(body, options) +
    metadataLines.reduce((sum, line) => sum + estimateTextTokens(line, options), 0) +
    provenanceLines.reduce((sum, line) => sum + estimateProvenanceLineTokens(line, options), 0) +
    estimateFormattingOverheadTokens({
      sectionCount: blocks > 0 ? 1 : 0,
      lineCount: Math.max(0, blocks - 1),
      metadataEntryCount: metadataLines.length + provenanceLines.length,
    })
  );
}

export function estimateContextSectionsTokens(
  sections: ContextSectionTokenEstimateInput[],
  options: TextTokenEstimateOptions = {}
) {
  const nonEmptySections = sections.filter((section) =>
    Boolean(
      normalizeTokenizableText(section.heading) ||
      normalizeTokenizableText(section.body) ||
      compactLines(section.metadataLines).length > 0 ||
      compactLines(section.provenanceLines).length > 0
    )
  );

  return (
    nonEmptySections.reduce(
      (sum, section) => sum + estimateContextSectionTokens(section, options),
      0
    ) +
    estimateFormattingOverheadTokens({
      lineCount: Math.max(0, nonEmptySections.length - 1),
    })
  );
}

export function estimateSourceTextTokens(
  source: SourceTextTokenEstimateInput,
  options: TextTokenEstimateOptions = {}
) {
  return estimateContextSectionTokens(
    {
      heading: source.label ? `## ${source.label}` : null,
      body: source.text,
      metadataLines: source.metadataLines,
      provenanceLines: source.provenanceLines,
    },
    options
  );
}
