import assert from "node:assert/strict";
import path from "node:path";
import { fileURLToPath } from "node:url";
import createJiti from "jiti";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const jiti = createJiti(import.meta.url, { moduleCache: false });
const {
  CHAT_HISTORY_MESSAGE_WINDOW,
  CHAT_REPLY_MAX_OUTPUT_TOKENS,
  CHAT_REPLY_REQUEST_TIMEOUT_MS,
  CHAT_REPLY_STREAM_TIMEOUT_MS,
  CHAT_THREAD_DOCUMENT_CONTEXT_CHARS,
  CHAT_THREAD_DOCUMENT_CONTEXT_BUNDLE_CHARS,
} = jiti(path.join(__dirname, "..", "src", "lib", "chat-runtime-budgets.ts"));
const {
  MAX_THREAD_DOCUMENT_CONTEXT_CHARS,
  MAX_THREAD_DOCUMENT_CONTEXT_BUNDLE_CHARS,
} = jiti(path.join(__dirname, "..", "src", "lib", "conversation-context.ts"));

assert.equal(CHAT_HISTORY_MESSAGE_WINDOW, 24);
assert.equal(CHAT_REPLY_MAX_OUTPUT_TOKENS, 4096);
assert.equal(CHAT_REPLY_REQUEST_TIMEOUT_MS, 120000);
assert.equal(CHAT_REPLY_STREAM_TIMEOUT_MS, 300000);
assert.equal(CHAT_THREAD_DOCUMENT_CONTEXT_CHARS, 4000);
assert.equal(CHAT_THREAD_DOCUMENT_CONTEXT_BUNDLE_CHARS, 12000);
assert.equal(MAX_THREAD_DOCUMENT_CONTEXT_CHARS, CHAT_THREAD_DOCUMENT_CONTEXT_CHARS);
assert.equal(MAX_THREAD_DOCUMENT_CONTEXT_BUNDLE_CHARS, CHAT_THREAD_DOCUMENT_CONTEXT_BUNDLE_CHARS);

console.log("ok - chat runtime budgets are centralized and wired into conversation context");
