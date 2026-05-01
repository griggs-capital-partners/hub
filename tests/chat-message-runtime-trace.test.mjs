import assert from "node:assert/strict";
import path from "node:path";
import { fileURLToPath } from "node:url";
import createJiti from "jiti";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const jiti = createJiti(import.meta.url, {
  moduleCache: false,
  alias: {
    "@/": `${path.join(__dirname, "..", "src").replace(/\\/g, "/")}/`,
  },
});
const {
  buildChatMessageRuntimeTraceEnvelope,
  parseChatMessageRuntimeTraceEnvelope,
} = jiti(path.join(__dirname, "..", "src", "lib", "chat-message-runtime-trace.ts"));

const trace = {
  payloadId: "rendered_page_image:doc-1:rendered-page:15",
  payloadType: "rendered_page_image",
  kind: "rendered_page_image",
  sourceObservationId: "rendered-page:15",
  conversationDocumentId: "doc-1",
  sourceId: "source-1",
  sourceType: "pdf_page",
  locator: { pageNumberStart: 15, pageNumberEnd: 15 },
  mimeType: "image/png",
  byteSize: 199503,
  width: 1024,
  height: 576,
  providerTarget: "openai",
  modelTarget: "gpt-5.4-mini-2026-03-17",
  state: "included",
  exclusionReason: null,
  runtimeSubreason: null,
  detail: "included after request handling",
  requestFormat: "openai_chat_completions_stream",
  budgetImpact: null,
  approvalState: "not_required",
  traceId: null,
  planId: null,
  transportPayloadId: null,
  dataUrl: "data:image/png;base64,SHOULD_NOT_LEAK",
  dataBase64: "SHOULD_NOT_LEAK",
  noRawPayloadIncludedInTrace: true,
};

const envelope = buildChatMessageRuntimeTraceEnvelope({
  messages: [{ role: "tool", content: "tool result" }],
  nativeRuntimePayloadTrace: [trace],
});

assert.ok(envelope);
assert.equal(envelope.includes("data:image/png"), false);
assert.equal(envelope.includes("SHOULD_NOT_LEAK"), false);

const parsed = parseChatMessageRuntimeTraceEnvelope(envelope);
assert.equal(parsed.messages.length, 1);
assert.equal(parsed.nativeRuntimePayloadTrace.length, 1);
assert.equal(parsed.nativeRuntimePayloadTrace[0].state, "included");
assert.equal(parsed.nativeRuntimePayloadTrace[0].providerTarget, "openai");
assert.equal(parsed.nativeRuntimePayloadTrace[0].locator?.pageNumberStart, 15);

const legacy = parseChatMessageRuntimeTraceEnvelope(JSON.stringify([{ role: "tool", content: "legacy" }]));
assert.equal(legacy.messages.length, 1);
assert.equal(legacy.nativeRuntimePayloadTrace.length, 0);

console.log("All 1 chat message runtime trace tests passed.");
