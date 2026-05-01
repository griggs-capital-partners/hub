import assert from "node:assert/strict";
import path from "node:path";
import { fileURLToPath } from "node:url";
import createJiti from "jiti";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const jiti = createJiti(import.meta.url, { moduleCache: false });
const {
  buildOpenAiOutputTokenParams,
  generateAgentReply,
  probeAgentLlm,
  requiresOpenAiChatCompletionsMaxCompletionTokens,
  streamAgentReply,
} = jiti(path.join(__dirname, "..", "src", "lib", "agent-llm.ts"));

const tests = [];

function runTest(name, fn) {
  tests.push({ name, fn });
}

function responseJson(payload) {
  return {
    ok: true,
    status: 200,
    json: async () => payload,
    text: async () => JSON.stringify(payload),
  };
}

function responseStream(payloadLines) {
  const encoder = new TextEncoder();
  const chunks = payloadLines.map((line) => encoder.encode(line));
  return {
    ok: true,
    status: 200,
    body: {
      getReader() {
        return {
          async read() {
            const value = chunks.shift();
            return value ? { value, done: false } : { value: undefined, done: true };
          },
        };
      },
    },
    text: async () => payloadLines.join(""),
  };
}

function makeImagePayload(overrides = {}) {
  return {
    id: overrides.id ?? "rendered_page_image:obs-1",
    payloadType: "rendered_page_image",
    kind: "rendered_page_image",
    sourceObservationId: "obs-1",
    conversationDocumentId: "doc-1",
    sourceId: "doc-1",
    sourceType: "pdf_page",
    locator: { pageNumberStart: 1, pageNumberEnd: 1, sourceLocationLabel: "demo.pdf page 1" },
    mimeType: "image/png",
    byteSize: 4,
    width: 10,
    height: 10,
    dataUrl: "data:image/png;base64,AAAA",
    ...overrides,
  };
}

runTest("GPT-5.4 mini Chat Completions request uses max_completion_tokens", async () => {
  const calls = [];
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (url, init = {}) => {
    calls.push({ url: String(url), body: init.body ? JSON.parse(String(init.body)) : null });
    if (String(url).endsWith("/models")) {
      return responseJson({ data: [{ id: "gpt-5.4-mini-2026-03-17" }] });
    }
    return responseJson({ choices: [{ message: { content: "Ready." } }] });
  };

  try {
    await generateAgentReply({
      llmProvider: "openai",
      llmApiKey: "test-key",
      llmModel: "gpt-5.4-mini-2026-03-17",
      history: [{ role: "user", content: "Ping" }],
    });

    const chatCall = calls.find((call) => call.url.endsWith("/chat/completions"));
    assert.ok(chatCall, "expected chat completion call");
    assert.equal(chatCall.body.max_completion_tokens, 4096);
    assert.equal("max_tokens" in chatCall.body, false);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

runTest("legacy OpenAI Chat Completions request keeps max_tokens", async () => {
  const calls = [];
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (url, init = {}) => {
    calls.push({ url: String(url), body: init.body ? JSON.parse(String(init.body)) : null });
    if (String(url).endsWith("/models")) {
      return responseJson({ data: [{ id: "gpt-3.5-turbo-0125" }] });
    }
    return responseJson({ choices: [{ message: { content: "Legacy ready." } }] });
  };

  try {
    await generateAgentReply({
      llmProvider: "openai",
      llmApiKey: "test-key",
      llmModel: "gpt-3.5-turbo-0125",
      history: [{ role: "user", content: "Ping" }],
    });

    const chatCall = calls.find((call) => call.url.endsWith("/chat/completions"));
    assert.ok(chatCall, "expected chat completion call");
    assert.equal(chatCall.body.max_tokens, 4096);
    assert.equal("max_completion_tokens" in chatCall.body, false);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

runTest("connection probe uses GPT-5 max_completion_tokens mapping", async () => {
  const calls = [];
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (url, init = {}) => {
    calls.push({ url: String(url), body: init.body ? JSON.parse(String(init.body)) : null });
    if (String(url).endsWith("/models")) {
      return responseJson({ data: [{ id: "gpt-5.4-mini-2026-03-17" }] });
    }
    return responseJson({ choices: [{ message: { content: "Pong." } }] });
  };

  try {
    const result = await probeAgentLlm({
      llmProvider: "openai",
      llmApiKey: "test-key",
      llmModel: "gpt-5.4-mini-2026-03-17",
    });

    assert.equal(result.llmStatus, "online");
    const chatCall = calls.find((call) => call.url.endsWith("/chat/completions"));
    assert.ok(chatCall, "expected probe chat completion call");
    assert.equal(chatCall.body.max_completion_tokens, 8);
    assert.equal("max_tokens" in chatCall.body, false);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

runTest("streaming OpenAI runtime uses the same GPT-5 mapping", async () => {
  const calls = [];
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (url, init = {}) => {
    calls.push({ url: String(url), body: init.body ? JSON.parse(String(init.body)) : null });
    if (String(url).endsWith("/models")) {
      return responseJson({ data: [{ id: "gpt-5.4-mini-2026-03-17" }] });
    }
    return responseStream([
      'data: {"choices":[{"delta":{"content":"Hello"},"finish_reason":null}]}\n\n',
      'data: {"choices":[{"delta":{},"finish_reason":"stop"}]}\n\n',
      "data: [DONE]\n\n",
    ]);
  };

  try {
    const events = [];
    for await (const event of streamAgentReply({
      llmProvider: "openai",
      llmApiKey: "test-key",
      llmModel: "gpt-5.4-mini-2026-03-17",
      history: [{ role: "user", content: "Ping" }],
    })) {
      events.push(event);
    }

    assert.equal(events.some((event) => event.type === "content_delta" && event.delta === "Hello"), true);
    const chatCall = calls.find((call) => call.url.endsWith("/chat/completions"));
    assert.ok(chatCall, "expected streaming chat completion call");
    assert.equal(chatCall.body.stream, true);
    assert.equal(chatCall.body.max_completion_tokens, 4096);
    assert.equal("max_tokens" in chatCall.body, false);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

runTest("Responses API token helper uses max_output_tokens", () => {
  assert.deepEqual(
    buildOpenAiOutputTokenParams({
      api: "responses",
      model: "gpt-5.4-mini-2026-03-17",
      maxOutputTokens: 123,
    }),
    { max_output_tokens: 123 }
  );
});

runTest("o-series Chat Completions models require max_completion_tokens", () => {
  assert.equal(requiresOpenAiChatCompletionsMaxCompletionTokens("o3-mini"), true);
  assert.deepEqual(
    buildOpenAiOutputTokenParams({
      api: "chat_completions",
      model: "o3-mini",
      maxOutputTokens: 64,
    }),
    { max_completion_tokens: 64 }
  );
});

runTest("native image payload remains included with GPT-5 token mapping", async () => {
  const calls = [];
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (url, init = {}) => {
    calls.push({ url: String(url), body: init.body ? JSON.parse(String(init.body)) : null });
    if (String(url).endsWith("/models")) {
      return responseJson({ data: [{ id: "gpt-5.4-mini-2026-03-17" }] });
    }
    return responseJson({ choices: [{ message: { content: "The image was included." } }] });
  };

  try {
    const traces = [];
    await generateAgentReply({
      llmProvider: "openai",
      llmApiKey: "test-key",
      llmModel: "gpt-5.4-mini-2026-03-17",
      history: [{ role: "user", content: "What is visible here?" }],
      nativeRuntimePayloads: [makeImagePayload()],
      onNativeRuntimePayloadTrace: (next) => traces.push(...next),
    });

    const chatCall = calls.find((call) => call.url.endsWith("/chat/completions"));
    assert.ok(chatCall, "expected chat completion call");
    assert.equal(chatCall.body.max_completion_tokens, 4096);
    assert.equal("max_tokens" in chatCall.body, false);
    const userMessage = chatCall.body.messages.find((message) => message.role === "user");
    assert.equal(Array.isArray(userMessage.content), true);
    assert.equal(userMessage.content.some((part) => part.type === "image_url"), true);
    assert.equal(traces.some((trace) => trace.state === "included"), true);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

for (const test of tests) {
  await test.fn();
}

console.log(`All ${tests.length} OpenAI output token mapping tests passed.`);
