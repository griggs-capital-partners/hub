import assert from "node:assert/strict";
import path from "node:path";
import { fileURLToPath } from "node:url";
import createJiti from "jiti";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const jiti = createJiti(import.meta.url, { moduleCache: false });
const { generateAgentReply, streamAgentReply } = jiti(path.join(__dirname, "..", "src", "lib", "agent-llm.ts"));
const {
  buildNativeRuntimeTraceVerdict,
  finalizeNativeRuntimePayloadTracesAfterRequest,
  summarizeNativeRuntimePayloadTraces,
  traceNativeRuntimePayload,
} = jiti(path.join(__dirname, "..", "src", "lib", "native-runtime-payloads.ts"));

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

function makeCropPayload(overrides = {}) {
  return {
    id: overrides.id ?? "missing:page_crop_image:need:page_crop_image:15",
    payloadType: "page_crop_image",
    kind: "source_observation_image",
    sourceObservationId: null,
    conversationDocumentId: null,
    sourceId: null,
    sourceType: null,
    locator: null,
    mimeType: null,
    byteSize: null,
    width: null,
    height: null,
    ...overrides,
  };
}

runTest("direct OpenAI chat completions includes selected native image payload with trace", async () => {
  const calls = [];
  const traces = [];
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (url, init = {}) => {
    calls.push({ url: String(url), body: init.body ? JSON.parse(String(init.body)) : null });
    if (String(url).endsWith("/models")) {
      return responseJson({ data: [{ id: "gpt-4o" }] });
    }
    assert.equal(traces.length, 0, "included trace should not be emitted before request handling succeeds");
    return responseJson({ choices: [{ message: { content: "The image was included." } }] });
  };

  try {
    const response = await generateAgentReply({
      llmProvider: "openai",
      llmApiKey: "test-key",
      llmModel: "gpt-4o",
      history: [{ role: "user", content: "What is visible here?" }],
      nativeRuntimePayloads: [makeImagePayload()],
      onNativeRuntimePayloadTrace: (next) => traces.push(...next),
    });

    assert.equal(response.content, "The image was included.");
    const chatCall = calls.find((call) => String(call.url).endsWith("/chat/completions"));
    assert.ok(chatCall, "expected chat completion call");
    const userMessage = chatCall.body.messages.find((message) => message.role === "user");
    assert.equal(Array.isArray(userMessage.content), true);
    assert.equal(userMessage.content.some((part) => part.type === "image_url"), true);
    assert.equal(traces.some((trace) => trace.state === "included"), true);
    assert.equal(traces.some((trace) => trace.requestFormat === "openai_chat_completions_non_stream"), true);
    assert.equal(JSON.stringify(traces).includes("data:image/png"), false);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

runTest("direct OpenAI streaming chat completions includes selected native image payload with trace", async () => {
  const calls = [];
  const traces = [];
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (url, init = {}) => {
    calls.push({ url: String(url), body: init.body ? JSON.parse(String(init.body)) : null });
    if (String(url).endsWith("/models")) {
      return responseJson({ data: [{ id: "gpt-4o" }] });
    }
    assert.equal(traces.length, 0, "included trace should not be emitted before stream handling succeeds");
    return responseStream([
      'data: {"choices":[{"delta":{"content":"Image"},"finish_reason":null}]}\n\n',
      'data: {"choices":[{"delta":{},"finish_reason":"stop"}]}\n\n',
      "data: [DONE]\n\n",
    ]);
  };

  try {
    const events = [];
    for await (const event of streamAgentReply({
      llmProvider: "openai",
      llmApiKey: "test-key",
      llmModel: "gpt-4o",
      history: [{ role: "user", content: "What is visible here?" }],
      nativeRuntimePayloads: [makeImagePayload()],
      onNativeRuntimePayloadTrace: (next) => traces.push(...next),
    })) {
      events.push(event);
    }

    assert.equal(events.some((event) => event.type === "content_delta" && event.delta === "Image"), true);
    const chatCall = calls.find((call) => String(call.url).endsWith("/chat/completions"));
    assert.ok(chatCall, "expected streaming chat completion call");
    assert.equal(chatCall.body.stream, true);
    const userMessage = chatCall.body.messages.find((message) => message.role === "user");
    assert.equal(Array.isArray(userMessage.content), true);
    assert.equal(userMessage.content.some((part) => part.type === "image_url"), true);
    assert.equal(traces.some((trace) => trace.state === "included"), true);
    assert.equal(traces.some((trace) => trace.requestFormat === "openai_chat_completions_stream"), true);
    assert.equal(JSON.stringify(traces).includes("data:image/png"), false);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

runTest("direct OpenAI non-streaming request failure after image_url emits final failure trace", async () => {
  const calls = [];
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (url, init = {}) => {
    calls.push({ url: String(url), body: init.body ? JSON.parse(String(init.body)) : null });
    if (String(url).endsWith("/models")) {
      return responseJson({ data: [{ id: "gpt-4o" }] });
    }
    return {
      ok: false,
      status: 500,
      json: async () => ({}),
      text: async () => "failed",
    };
  };

  try {
    const traces = [];
    await assert.rejects(() => generateAgentReply({
      llmProvider: "openai",
      llmApiKey: "test-key",
      llmModel: "gpt-4o",
      history: [{ role: "user", content: "What is visible here?" }],
      nativeRuntimePayloads: [makeImagePayload()],
      onNativeRuntimePayloadTrace: (next) => traces.push(...next),
    }));

    const chatCall = calls.find((call) => String(call.url).endsWith("/chat/completions"));
    assert.ok(chatCall, "expected chat completion call");
    const userMessage = chatCall.body.messages.find((message) => message.role === "user");
    assert.equal(userMessage.content.some((part) => part.type === "image_url"), true);
    assert.equal(traces.some((trace) => trace.state === "included"), false);
    assert.equal(traces.some((trace) => trace.exclusionReason === "request_failed_after_image_inclusion"), true);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

runTest("direct OpenAI streaming failure after image_url emits final failure trace", async () => {
  const calls = [];
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (url, init = {}) => {
    calls.push({ url: String(url), body: init.body ? JSON.parse(String(init.body)) : null });
    if (String(url).endsWith("/models")) {
      return responseJson({ data: [{ id: "gpt-4o" }] });
    }
    return {
      ok: true,
      status: 200,
      body: {
        getReader() {
          return {
            async read() {
              throw new Error("stream failed");
            },
          };
        },
      },
      text: async () => "",
    };
  };

  try {
    const traces = [];
    await assert.rejects(async () => {
      for await (const event of streamAgentReply({
        llmProvider: "openai",
        llmApiKey: "test-key",
        llmModel: "gpt-4o",
        history: [{ role: "user", content: "What is visible here?" }],
        nativeRuntimePayloads: [makeImagePayload()],
        onNativeRuntimePayloadTrace: (next) => traces.push(...next),
      })) {
        assert.ok(event.type);
      }
    });

    const chatCall = calls.find((call) => String(call.url).endsWith("/chat/completions"));
    assert.ok(chatCall, "expected streaming chat completion call");
    const userMessage = chatCall.body.messages.find((message) => message.role === "user");
    assert.equal(userMessage.content.some((part) => part.type === "image_url"), true);
    assert.equal(traces.some((trace) => trace.state === "included"), false);
    assert.equal(traces.some((trace) => trace.exclusionReason === "stream_failed_after_image_inclusion"), true);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

runTest("selected pending native trace finalizes after completed runtime handoff", () => {
  const payload = makeImagePayload({ id: "rendered_page_image:doc-1:rendered-page:15" });
  const traces = [
    traceNativeRuntimePayload(payload, {
      state: "candidate",
      detail: "candidate",
      providerTarget: "openai",
      modelTarget: "gpt-5.4-mini-2026-03-17",
    }),
    traceNativeRuntimePayload(payload, {
      state: "selected",
      detail: "selected",
      providerTarget: "openai",
      modelTarget: "gpt-5.4-mini-2026-03-17",
    }),
  ];
  const preSummary = summarizeNativeRuntimePayloadTraces(traces);
  assert.equal(preSummary.diagnosticState, "selected_pending_runtime_trace");

  const finalTrace = finalizeNativeRuntimePayloadTracesAfterRequest(traces, {
    runtimeReceivedPayloadIds: [payload.id],
    providerTarget: "openai",
    modelTarget: "gpt-5.4-mini-2026-03-17",
    requestFormat: "openai_chat_completions_stream",
  });
  const finalSummary = summarizeNativeRuntimePayloadTraces(finalTrace);
  assert.equal(finalSummary.diagnosticState, "selected_but_excluded");
  assert.equal(finalSummary.selectedThenExcludedCount, 1);
  assert.equal(finalTrace.some((trace) => trace.exclusionReason === "runtime_trace_missing_after_request"), true);
  assert.equal(JSON.stringify(finalTrace).includes("data:image/png"), false);
});

runTest("requested rendered page verdict is included despite unrelated crop-image gap", () => {
  const page15Payload = makeImagePayload({
    id: "rendered_page_image:doc-1:rendered-page:15",
    sourceObservationId: "doc-1:rendered-page:15",
    conversationDocumentId: "doc-1",
    sourceId: "doc-1",
    locator: { pageNumberStart: 15, pageNumberEnd: 15, sourceLocationLabel: "demo.pdf page 15" },
  });
  const cropPayload = makeCropPayload();
  const traces = [
    traceNativeRuntimePayload(page15Payload, {
      state: "candidate",
      detail: "candidate",
      providerTarget: "openai",
      modelTarget: "gpt-5.4-mini-2026-03-17",
    }),
    traceNativeRuntimePayload(page15Payload, {
      state: "selected",
      detail: "selected",
      providerTarget: "openai",
      modelTarget: "gpt-5.4-mini-2026-03-17",
    }),
    traceNativeRuntimePayload(cropPayload, {
      state: "model_supported_runtime_missing",
      exclusionReason: "model_supported_runtime_missing",
      runtimeSubreason: "runtime_request_builder_missing_image_support",
      detail: "Payload type page_crop_image is declared but not executable in A-04h.",
      providerTarget: "openai",
      modelTarget: "gpt-5.4-mini-2026-03-17",
    }),
    traceNativeRuntimePayload(page15Payload, {
      state: "included",
      detail: "Native image payload included in the actual OpenAI Chat Completions message body as an image_url content part.",
      providerTarget: "openai",
      modelTarget: "gpt-5.4-mini-2026-03-17",
      requestFormat: "openai_chat_completions_stream",
      traceId: "agent-work-trace:demo",
    }),
  ];

  const verdict = buildNativeRuntimeTraceVerdict({
    traces,
    selector: {
      payloadType: "rendered_page_image",
      conversationDocumentId: "doc-1",
      pageNumber: 15,
      providerTarget: "openai",
      modelTarget: "gpt-5.4-mini-2026-03-17",
    },
  });
  const summary = summarizeNativeRuntimePayloadTraces(traces);

  assert.equal(verdict.status, "included");
  assert.equal(verdict.payloadId, "rendered_page_image:doc-1:rendered-page:15");
  assert.equal(verdict.payloadType, "rendered_page_image");
  assert.equal(verdict.pageNumber, 15);
  assert.equal(verdict.requestFormat, "openai_chat_completions_stream");
  assert.equal(verdict.unrelatedExcludedCount, 1);
  assert.equal(verdict.unrelatedExcludedPayloads[0].payloadType, "page_crop_image");
  assert.equal(verdict.unrelatedExcludedPayloads[0].reason, "model_supported_runtime_missing");
  assert.equal(summary.includedCount, 1);
  assert.equal(summary.excludedByReason.model_supported_runtime_missing, 1);
  assert.equal(summary.diagnosticState, "included");
  assert.equal(JSON.stringify(verdict).includes("data:image/png"), false);
});

runTest("requested native verdict reports no candidate when selector matches nothing", () => {
  const traces = [
    traceNativeRuntimePayload(makeImagePayload({
      id: "rendered_page_image:doc-1:rendered-page:15",
      conversationDocumentId: "doc-1",
      locator: { pageNumberStart: 15, pageNumberEnd: 15 },
    }), {
      state: "included",
      detail: "included",
      providerTarget: "openai",
      modelTarget: "gpt-4o",
      requestFormat: "openai_chat_completions_stream",
    }),
  ];

  const verdict = buildNativeRuntimeTraceVerdict({
    traces,
    selector: {
      payloadType: "rendered_page_image",
      conversationDocumentId: "doc-1",
      pageNumber: 99,
    },
  });

  assert.equal(verdict.status, "no_candidate");
  assert.equal(verdict.matchedTraceCount, 0);
});

runTest("requested native verdict reports selected exclusion only for matching payload", () => {
  const payload = makeImagePayload({
    id: "rendered_page_image:doc-1:rendered-page:15",
    conversationDocumentId: "doc-1",
    locator: { pageNumberStart: 15, pageNumberEnd: 15 },
  });
  const traces = [
    traceNativeRuntimePayload(payload, {
      state: "candidate",
      detail: "candidate",
      providerTarget: "local",
      modelTarget: "text-model",
    }),
    traceNativeRuntimePayload(payload, {
      state: "selected",
      detail: "selected",
      providerTarget: "local",
      modelTarget: "text-model",
    }),
    traceNativeRuntimePayload(payload, {
      state: "runtime_missing",
      exclusionReason: "runtime_missing",
      runtimeSubreason: "provider_branch_not_direct_openai",
      detail: "selected payload could not be included by this runtime",
      providerTarget: "local",
      modelTarget: "text-model",
    }),
  ];

  const verdict = buildNativeRuntimeTraceVerdict({
    traces,
    selector: {
      payloadType: "rendered_page_image",
      conversationDocumentId: "doc-1",
      pageNumber: 15,
    },
  });

  assert.equal(verdict.status, "selected_but_excluded");
  assert.equal(verdict.exclusionReason, "runtime_missing");
  assert.equal(verdict.runtimeSubreason, "provider_branch_not_direct_openai");
});

runTest("OpenAI-compatible custom runtime excludes native image payloads as runtime missing", async () => {
  const calls = [];
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (url, init = {}) => {
    calls.push({ url: String(url), body: init.body ? JSON.parse(String(init.body)) : null });
    if (String(url).endsWith("/models")) {
      return responseJson({ data: [{ id: "custom-model" }] });
    }
    return responseJson({ choices: [{ message: { content: "Text-only answer." } }] });
  };

  try {
    const traces = [];
    await generateAgentReply({
      llmProvider: "local",
      llmProtocol: "openai-compatible",
      llmEndpointUrl: "http://localhost:11434/v1",
      llmModel: "custom-model",
      history: [{ role: "user", content: "What is visible here?" }],
      nativeRuntimePayloads: [makeImagePayload()],
      onNativeRuntimePayloadTrace: (next) => traces.push(...next),
    });

    const chatCall = calls.find((call) => String(call.url).endsWith("/chat/completions"));
    assert.ok(chatCall, "expected chat completion call");
    const userMessage = chatCall.body.messages.find((message) => message.role === "user");
    assert.equal(typeof userMessage.content, "string");
    assert.equal(traces.some((trace) => trace.state === "runtime_missing"), true);
    assert.equal(traces.some((trace) => trace.runtimeSubreason === "provider_branch_not_direct_openai"), true);
    assert.equal(traces.some((trace) => trace.state === "included"), false);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

runTest("direct OpenAI chat completions excludes selected image for models not marked image-capable", async () => {
  const calls = [];
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (url, init = {}) => {
    calls.push({ url: String(url), body: init.body ? JSON.parse(String(init.body)) : null });
    if (String(url).endsWith("/models")) {
      return responseJson({ data: [{ id: "gpt-3.5-turbo-0125" }] });
    }
    return responseJson({ choices: [{ message: { content: "Text-only answer." } }] });
  };

  try {
    const traces = [];
    await generateAgentReply({
      llmProvider: "openai",
      llmApiKey: "test-key",
      llmModel: "gpt-3.5-turbo-0125",
      history: [{ role: "user", content: "What is visible here?" }],
      nativeRuntimePayloads: [makeImagePayload()],
      onNativeRuntimePayloadTrace: (next) => traces.push(...next),
    });

    const chatCall = calls.find((call) => String(call.url).endsWith("/chat/completions"));
    assert.ok(chatCall, "expected chat completion call");
    const userMessage = chatCall.body.messages.find((message) => message.role === "user");
    assert.equal(typeof userMessage.content, "string");
    assert.equal(traces.some((trace) => trace.exclusionReason === "unsupported_by_model"), true);
    assert.equal(traces.some((trace) => trace.runtimeSubreason === "model_family_not_marked_image_runtime_supported"), true);
    assert.equal(traces.some((trace) => trace.state === "included"), false);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

runTest("direct OpenAI chat completions omits image_url unless included trace is emitted", async () => {
  const calls = [];
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (url, init = {}) => {
    calls.push({ url: String(url), body: init.body ? JSON.parse(String(init.body)) : null });
    if (String(url).endsWith("/models")) {
      return responseJson({ data: [{ id: "gpt-4o" }] });
    }
    return responseJson({ choices: [{ message: { content: "No image attached." } }] });
  };

  try {
    const traces = [];
    await generateAgentReply({
      llmProvider: "openai",
      llmApiKey: "test-key",
      llmModel: "gpt-4o",
      history: [{ role: "user", content: "What is visible here?" }],
      nativeRuntimePayloads: [makeImagePayload({ dataUrl: null, dataBase64: null })],
      onNativeRuntimePayloadTrace: (next) => traces.push(...next),
    });

    const chatCall = calls.find((call) => String(call.url).endsWith("/chat/completions"));
    assert.ok(chatCall, "expected chat completion call");
    const userMessage = chatCall.body.messages.find((message) => message.role === "user");
    assert.equal(typeof userMessage.content, "string");
    assert.equal(traces.some((trace) => trace.exclusionReason === "missing_input"), true);
    assert.equal(traces.some((trace) => trace.runtimeSubreason === "payload_missing_safe_image_data"), true);
    assert.equal(traces.some((trace) => trace.state === "included"), false);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

for (const test of tests) {
  await test.fn();
}

console.log(`All ${tests.length} agent LLM native runtime tests passed.`);
