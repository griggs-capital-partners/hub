export type MarkdownFragmentJoinOptions = {
  trimOuterWhitespace?: boolean;
};

const MARKDOWN_HEADING_OR_FENCE = /^(?:#{1,6}\s|```)/;
const MARKDOWN_LIST_OR_QUOTE = /^(?:[-*+]\s|\d+\.\s|>\s)/;
const MARKDOWN_BOLD_MARKER = /^(?:\*\*|__)/;

function normalizeLineEndings(value: string) {
  return value.replace(/\r\n/g, "\n");
}

function collapseExcessBlankLines(value: string) {
  return value.replace(/\n{3,}/g, "\n\n");
}

function resolveMarkdownFragmentBoundary(previous: string, next: string) {
  const previousTrimmed = previous.replace(/\s+$/, "");
  const nextTrimmed = next.trimStart();

  if (!previousTrimmed || !nextTrimmed) {
    return "";
  }

  if (/\s$/.test(previous) || /^\s/.test(next)) {
    return "";
  }

  if (MARKDOWN_HEADING_OR_FENCE.test(nextTrimmed)) {
    return "\n\n";
  }

  if (MARKDOWN_LIST_OR_QUOTE.test(nextTrimmed)) {
    return /[:：]$/.test(previousTrimmed) ? "\n" : "\n\n";
  }

  if (MARKDOWN_BOLD_MARKER.test(nextTrimmed)) {
    return " ";
  }

  const previousLastCharacter = previousTrimmed.slice(-1);
  const nextFirstCharacter = nextTrimmed.charAt(0);

  if (/[A-Za-z0-9)]/.test(previousLastCharacter) && /[A-Za-z0-9]/.test(nextFirstCharacter)) {
    return " ";
  }

  return "";
}

export function joinMarkdownSections(sections: Array<string | null | undefined>) {
  return collapseExcessBlankLines(
    sections
      .map((section) => normalizeLineEndings(section ?? "").trim())
      .filter(Boolean)
      .join("\n\n")
  );
}

export function joinMarkdownFragments(
  fragments: Array<string | null | undefined>,
  options: MarkdownFragmentJoinOptions = {}
) {
  let result = "";

  for (const fragment of fragments) {
    if (!fragment || !fragment.trim()) {
      continue;
    }

    const normalized = normalizeLineEndings(fragment);

    if (!result) {
      result = normalized;
      continue;
    }

    result = `${result}${resolveMarkdownFragmentBoundary(result, normalized)}${normalized}`;
  }

  const normalizedResult = collapseExcessBlankLines(result);
  return options.trimOuterWhitespace === false ? normalizedResult : normalizedResult.trim();
}
