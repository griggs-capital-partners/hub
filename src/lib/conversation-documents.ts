const SUPPORTED_CONVERSATION_DOCUMENT_EXTENSIONS = [
  "pdf",
  "txt",
  "md",
  "doc",
  "docx",
  "pptx",
  "xlsx",
  "csv",
  "tsv",
  "jpg",
  "jpeg",
  "png",
  "webp",
  "mp3",
  "wav",
  "m4a",
] as const;

export const MAX_CONVERSATION_DOCUMENT_SIZE = 50 * 1024 * 1024;
export const CONVERSATION_DOCUMENT_UNSUPPORTED_ERROR =
  "Unsupported file type. Use PDF, text, Word, PowerPoint, spreadsheet, image, or audio files.";

export const CONVERSATION_DOCUMENT_ACCEPT = SUPPORTED_CONVERSATION_DOCUMENT_EXTENSIONS
  .map((extension) => `.${extension}`)
  .join(",");

const FILE_TYPE_BY_EXTENSION: Record<string, string> = {
  pdf: "pdf",
  txt: "text",
  md: "text",
  mp3: "audio",
  wav: "audio",
  m4a: "audio",
  jpg: "image",
  jpeg: "image",
  png: "image",
  webp: "image",
  doc: "document",
  docx: "document",
  pptx: "document",
  xlsx: "spreadsheet",
  csv: "spreadsheet",
  tsv: "spreadsheet",
};

const MIME_TYPE_BY_EXTENSION: Record<string, string> = {
  pdf: "application/pdf",
  txt: "text/plain",
  md: "text/markdown",
  mp3: "audio/mpeg",
  wav: "audio/wav",
  m4a: "audio/mp4",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  png: "image/png",
  webp: "image/webp",
  doc: "application/msword",
  docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  pptx: "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  csv: "text/csv",
  tsv: "text/tab-separated-values",
};

function normalizeExtension(filename: string) {
  return filename.trim().split(".").pop()?.toLowerCase() ?? "";
}

export function isSupportedConversationDocumentFilename(filename: string) {
  return SUPPORTED_CONVERSATION_DOCUMENT_EXTENSIONS.includes(
    normalizeExtension(filename) as (typeof SUPPORTED_CONVERSATION_DOCUMENT_EXTENSIONS)[number]
  );
}

export function sanitizeConversationDocumentFilename(filename: string) {
  const sanitized = filename.trim().replace(/[^a-zA-Z0-9._-]/g, "_");
  return sanitized.length > 0 ? sanitized : "file";
}

export function validateConversationDocument(file: {
  name: string;
  size: number;
  type?: string | null;
}) {
  if (!file.name.trim()) {
    return "File name is required";
  }

  if (file.size <= 0) {
    return "File is empty";
  }

  if (file.size > MAX_CONVERSATION_DOCUMENT_SIZE) {
    return "File must be 50 MB or smaller";
  }

  if (!isSupportedConversationDocumentFilename(file.name)) {
    return CONVERSATION_DOCUMENT_UNSUPPORTED_ERROR;
  }

  return null;
}

export function resolveConversationDocumentMetadata(file: { name: string; type?: string | null }) {
  const extension = normalizeExtension(file.name);
  if (!isSupportedConversationDocumentFilename(file.name)) {
    return null;
  }

  return {
    extension,
    fileType: FILE_TYPE_BY_EXTENSION[extension] ?? "other",
    mimeType: file.type?.trim() || MIME_TYPE_BY_EXTENSION[extension] || "application/octet-stream",
  };
}
