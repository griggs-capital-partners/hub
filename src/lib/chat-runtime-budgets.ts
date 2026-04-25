// Keep chat runtime growth deliberate: larger than the previous defaults,
// but still bounded so context and output sizes do not expand unchecked.
export const CHAT_HISTORY_MESSAGE_WINDOW = 24;
export const CHAT_REPLY_MAX_OUTPUT_TOKENS = 4_096;
export const CHAT_REPLY_REQUEST_TIMEOUT_MS = 120_000;
export const CHAT_REPLY_STREAM_TIMEOUT_MS = 300_000;
export const CHAT_THREAD_DOCUMENT_CONTEXT_CHARS = 4_000;
export const CHAT_THREAD_DOCUMENT_CONTEXT_BUNDLE_CHARS = 12_000;
