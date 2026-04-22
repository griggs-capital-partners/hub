import { createHash, createHmac } from "crypto";
import type { AgentLlmProvider } from "@/lib/agent-llm-config";

type LlmEndpointKind = "ollama" | "openai";

type AgentLlmConfig = {
  llmProvider?: AgentLlmProvider | null;
  llmProtocol?: string | null;
  llmAuthType?: string | null;
  llmApiKey?: string | null;
  llmEndpointUrl?: string | null;
  llmUsername?: string | null;
  llmPassword?: string | null;
  llmRegion?: string | null;
  llmAccessKeyId?: string | null;
  llmSecretAccessKey?: string | null;
  llmModel?: string | null;
  llmThinkingMode?: string | null;
  description?: string | null;
  persona?: string | null;
  duties?: string | null;
  name?: string;
  role?: string;
  orgContext?: string | null;
  currentUserName?: string | null;
  contextSources?: Array<{
    id: string;
    label: string;
    description: string;
  }>;
  resolvedSources?: Array<{
    label: string;
    target: string;
    detail: string;
    status?: "used" | "unsupported" | "failed" | "unavailable";
  }>;
};

type ChatMessageInput = {
  role: "user" | "assistant";
  content: string;
};

// Flexible message type used internally when building LLM request bodies.
// Supports tool-call and tool-result entries beyond the basic chat roles.
// Exported so the route layer can persist and re-inject tool context messages.
export type LlmMessage = {
  role: "system" | "user" | "assistant" | "tool";
  content: string | null;
  tool_calls?: unknown;
  tool_call_id?: string;
};

export type AgentToolDefinition = {
  type: "function";
  function: {
    name: string;
    description: string;
    parameters: Record<string, unknown>;
  };
};

export type AgentReplyStreamEvent =
  | { type: "thinking_delta"; delta: string }
  | { type: "content_delta"; delta: string }
  | { type: "done"; model: string }
  | { type: "tool_call"; id: string; name: string; args: Record<string, unknown> }
  | { type: "tool_result"; id: string; name: string; result: string }
  | { type: "tool_context"; messages: LlmMessage[] };

export type AgentLlmStatus = {
  llmStatus: "disconnected" | "online" | "offline";
  llmModel: string | null;
  llmLastCheckedAt: Date | null;
  llmLastError: string | null;
};

export type AgentRuntimePreview = {
  systemPrompt: string;
  history: ChatMessageInput[];
  estimatedTokens: number;
  estimatedSystemPromptTokens: number;
  estimatedHistoryTokens: number;
  recentHistoryCount: number;
  knowledgeSources: Array<{
    id: string;
    label: string;
    description: string;
  }>;
};

type ResolvedEndpoint = {
  kind: LlmEndpointKind;
  model: string;
  chatUrl: string;
};

type AnthropicMessage = {
  role: "user" | "assistant";
  content: string;
};

function trimTrailingSlash(value: string) {
  return value.replace(/\/+$/, "");
}

function buildAuthHeader(config: Pick<AgentLlmConfig, "llmAuthType" | "llmApiKey" | "llmUsername" | "llmPassword">): Record<string, string> {
  const authType = config.llmAuthType ?? (
    config.llmApiKey?.trim() ? "bearer" : config.llmUsername?.trim() || config.llmPassword?.trim() ? "basic" : "none"
  );

  if (authType === "bearer") {
    const apiKey = config.llmApiKey?.trim();
    return apiKey ? { Authorization: `Bearer ${apiKey}` } : {};
  }

  if (authType !== "basic") {
    return {};
  }

  const username = config.llmUsername?.trim();
  const password = config.llmPassword?.trim();
  if (!username || !password) return {};

  const token = Buffer.from(`${username}:${password}`, "utf8").toString("base64");
  return { Authorization: `Basic ${token}` };
}

function buildJsonHeaders(config: Pick<AgentLlmConfig, "llmAuthType" | "llmApiKey" | "llmUsername" | "llmPassword">) {
  return {
    "Content-Type": "application/json",
    ...buildAuthHeader(config),
  } satisfies Record<string, string>;
}

function buildOllamaUrls(rawUrl: string) {
  const url = trimTrailingSlash(rawUrl.trim());

  if (url.endsWith("/api/chat")) {
    return {
      tagsUrl: url.replace(/\/api\/chat$/, "/api/tags"),
      chatUrl: url,
    };
  }

  if (url.endsWith("/api")) {
    return {
      tagsUrl: `${url}/tags`,
      chatUrl: `${url}/chat`,
    };
  }

  return {
    tagsUrl: `${url}/api/tags`,
    chatUrl: `${url}/api/chat`,
  };
}

function buildOpenAiUrls(rawUrl: string) {
  const url = trimTrailingSlash(rawUrl.trim());

  if (url.endsWith("/v1/chat/completions")) {
    return {
      modelsUrl: url.replace(/\/v1\/chat\/completions$/, "/v1/models"),
      chatUrl: url,
    };
  }

  if (url.endsWith("/v1")) {
    return {
      modelsUrl: `${url}/models`,
      chatUrl: `${url}/chat/completions`,
    };
  }

  return {
    modelsUrl: `${url}/v1/models`,
    chatUrl: `${url}/v1/chat/completions`,
  };
}

function resolveProvider(config: AgentLlmConfig): AgentLlmProvider {
  if (config.llmProvider === "openai" || config.llmProvider === "anthropic" || config.llmProvider === "bedrock") {
    return config.llmProvider;
  }

  if (config.llmRegion?.trim() || config.llmAccessKeyId?.trim() || config.llmSecretAccessKey?.trim()) {
    return "bedrock";
  }

  return "local";
}

function buildProviderBaseUrl(override: string | null | undefined, fallback: string) {
  return trimTrailingSlash(override?.trim() || fallback);
}

function buildAnthropicMessagesUrl(rawUrl?: string | null) {
  const baseUrl = buildProviderBaseUrl(rawUrl, "https://api.anthropic.com");
  return `${baseUrl}/v1/messages`;
}

function buildBedrockRuntimeUrl(config: Pick<AgentLlmConfig, "llmEndpointUrl" | "llmRegion" | "llmModel">) {
  const region = config.llmRegion?.trim() || "us-east-1";
  const baseUrl = buildProviderBaseUrl(config.llmEndpointUrl, `https://bedrock-runtime.${region}.amazonaws.com`);
  const model = config.llmModel?.trim();

  if (!model) {
    throw new Error("A Bedrock model is required");
  }

  return `${baseUrl}/model/${encodeURIComponent(model)}/converse`;
}

function buildAnthropicHeaders(config: Pick<AgentLlmConfig, "llmApiKey">) {
  const apiKey = config.llmApiKey?.trim();
  if (!apiKey) {
    throw new Error("An API key is required");
  }

  return {
    "Content-Type": "application/json",
    "x-api-key": apiKey,
    "anthropic-version": "2023-06-01",
  };
}

function toAnthropicMessages(messages: LlmMessage[]) {
  const normalized = messages
    .filter((message) => message.role !== "system")
    .map((message) => ({
      role: message.role === "assistant" ? "assistant" : "user",
      content: message.role === "tool"
        ? `Tool result:\n${message.content ?? ""}`.trim()
        : message.content ?? "",
    }))
    .filter((message): message is AnthropicMessage => Boolean(message.content.trim()));

  const alternating: AnthropicMessage[] = [];

  for (const message of normalized) {
    const previous = alternating[alternating.length - 1];

    if (!previous) {
      if (message.role === "assistant") {
        alternating.push({
          role: "user",
          content: `Prior assistant context:\n${message.content}`.trim(),
        });
        continue;
      }

      alternating.push({ ...message });
      continue;
    }

    if (previous.role === message.role) {
      previous.content = `${previous.content}\n\n${message.content}`.trim();
      continue;
    }

    alternating.push({ ...message });
  }

  return alternating;
}

function sha256Hex(value: string) {
  return createHash("sha256").update(value, "utf8").digest("hex");
}

function hmac(key: Buffer | string, value: string, encoding?: "hex") {
  const digest = createHmac("sha256", key).update(value, "utf8").digest();
  return encoding === "hex" ? digest.toString("hex") : digest;
}

function buildAmzDate(date: Date) {
  return date.toISOString().replace(/[:-]|\.\d{3}/g, "");
}

function signAwsRequest(params: {
  method: "POST";
  url: string;
  region: string;
  accessKeyId: string;
  secretAccessKey: string;
  body: string;
}) {
  const requestDate = new Date();
  const amzDate = buildAmzDate(requestDate);
  const dateStamp = amzDate.slice(0, 8);
  const url = new URL(params.url);
  const canonicalHeaders = [
    ["content-type", "application/json"],
    ["host", url.host],
    ["x-amz-content-sha256", sha256Hex(params.body)],
    ["x-amz-date", amzDate],
  ];
  const signedHeaders = canonicalHeaders.map(([key]) => key).join(";");
  const canonicalRequest = [
    params.method,
    url.pathname,
    "",
    canonicalHeaders.map(([key, value]) => `${key}:${value}`).join("\n"),
    "",
    signedHeaders,
    sha256Hex(params.body),
  ].join("\n");
  const credentialScope = `${dateStamp}/${params.region}/bedrock/aws4_request`;
  const stringToSign = [
    "AWS4-HMAC-SHA256",
    amzDate,
    credentialScope,
    sha256Hex(canonicalRequest),
  ].join("\n");
  const kDate = hmac(`AWS4${params.secretAccessKey}`, dateStamp);
  const kRegion = hmac(kDate, params.region);
  const kService = hmac(kRegion, "bedrock");
  const kSigning = hmac(kService, "aws4_request");
  const signature = hmac(kSigning, stringToSign, "hex");

  return {
    "Content-Type": "application/json",
    "X-Amz-Date": amzDate,
    "X-Amz-Content-Sha256": sha256Hex(params.body),
    Authorization: `AWS4-HMAC-SHA256 Credential=${params.accessKeyId}/${credentialScope}, SignedHeaders=${signedHeaders}, Signature=${signature}`,
  };
}

async function fetchBedrockJson(
  config: Pick<AgentLlmConfig, "llmEndpointUrl" | "llmRegion" | "llmModel" | "llmAccessKeyId" | "llmSecretAccessKey">,
  body: Record<string, unknown>,
  timeoutMs = 60000
) {
  const accessKeyId = config.llmAccessKeyId?.trim();
  const secretAccessKey = config.llmSecretAccessKey?.trim();
  const region = config.llmRegion?.trim() || "us-east-1";

  if (!accessKeyId || !secretAccessKey) {
    throw new Error("Bedrock access key ID and secret access key are required");
  }

  const url = buildBedrockRuntimeUrl(config);
  const serializedBody = JSON.stringify(body);
  const response = await fetch(url, {
    method: "POST",
    headers: signAwsRequest({
      method: "POST",
      url,
      region,
      accessKeyId,
      secretAccessKey,
      body: serializedBody,
    }),
    body: serializedBody,
    signal: AbortSignal.timeout(timeoutMs),
  });

  if (!response.ok) {
    const details = await response.text().catch(() => "");
    throw new Error(details || `Bedrock request failed (${response.status})`);
  }

  return response.json();
}

function extractAnthropicText(payload: Record<string, unknown>) {
  const content = Array.isArray(payload.content) ? payload.content : [];
  return content
    .map((item) => {
      if (!item || typeof item !== "object") return "";
      const block = item as Record<string, unknown>;
      return block.type === "text" && typeof block.text === "string" ? block.text : "";
    })
    .join("")
    .trim();
}

function extractBedrockText(payload: Record<string, unknown>) {
  const output = payload.output && typeof payload.output === "object"
    ? payload.output as Record<string, unknown>
    : null;
  const message = output?.message && typeof output.message === "object"
    ? output.message as Record<string, unknown>
    : null;
  const content = Array.isArray(message?.content) ? message.content : [];

  return content
    .map((item) => {
      if (!item || typeof item !== "object") return "";
      const block = item as Record<string, unknown>;
      return typeof block.text === "string" ? block.text : "";
    })
    .join("")
    .trim();
}

function parseDuties(raw: string | null | undefined) {
  try {
    const parsed = JSON.parse(raw ?? "[]");
    return Array.isArray(parsed) ? parsed.filter((item): item is string => typeof item === "string" && item.trim().length > 0) : [];
  } catch {
    return [];
  }
}

export function buildSystemPrompt(config: AgentLlmConfig) {
  const sections = [
    `You are ${config.name || "an AI agent"} serving as ${config.role || "a specialist"} inside Summit Griggs Hub.`,
    "Stay in character as this specific agent. Do not describe yourself as a generic AI assistant unless the persona explicitly says to.",
  ];
  const contextSources = config.contextSources?.filter(
    (source): source is NonNullable<AgentLlmConfig["contextSources"]>[number] =>
      Boolean(source.label?.trim() && source.description?.trim())
  ) ?? [];
  const resolvedSources = config.resolvedSources?.filter(
    (source): source is NonNullable<AgentLlmConfig["resolvedSources"]>[number] =>
      Boolean(source.label?.trim() && source.detail?.trim())
  ) ?? [];

  if (config.description?.trim()) {
    sections.push(`Agent summary: ${config.description.trim()}`);
  }

  if (config.persona?.trim()) {
    sections.push(`Persona and system instructions:\n${config.persona.trim()}`);
  }

  const duties = parseDuties(config.duties);
  if (duties.length > 0) {
    sections.push(`Core duties:\n- ${duties.join("\n- ")}`);
  }

  if (config.orgContext?.trim()) {
    sections.push(config.orgContext.trim());
  }

  if (config.currentUserName?.trim()) {
    sections.push(`You are currently speaking with: ${config.currentUserName.trim()}`);
  }

  if (contextSources.length > 0) {
    sections.push(
      "Runtime context status:\n" +
      contextSources
        .map((source) => `- ${source.label.trim()}: ${source.description.trim()}`)
        .join("\n")
    );
  }

  if (resolvedSources.length > 0) {
    sections.push(
      "Thread attachment resolution:\n" +
      resolvedSources
        .map((source) => {
          const statusLabel =
            source.status === "unsupported"
              ? "Unsupported"
              : source.status === "failed"
                ? "Failed"
                : source.status === "unavailable"
                  ? "Unavailable"
                  : "Used";
          return `- ${statusLabel} - ${source.label.trim()}: ${source.detail.trim()}`;
        })
        .join("\n")
    );
  }

  sections.push("You are replying inside a direct team chat in the hub.");
  sections.push("Use the persona, role, and duties above as the highest-priority behavioral guidance for your reply.");
  sections.push(
    "Context grounding rules:\n" +
    "- If this prompt includes a `## Thread Document:` section, that attachment was successfully read into the active runtime context and is available to use.\n" +
    "- Treat the `Thread attachment resolution` lines as authoritative status for each attached file.\n" +
    "- Only say a thread attachment could not be read, did not load, or was unavailable when the prompt explicitly says so in a status or availability note.\n" +
    "- When a thread attachment was read and is relevant, use its contents directly instead of claiming you do not have access to it."
  );
  sections.push(
    "Task and tool routing rules:\n" +
    "- When the user asks about tasks, planner items, kanban cards, board status, backlog, priorities, assignees, or recent work, treat that as a request about the internal planner/kanban system.\n" +
    "- For those task/planner questions, prefer calling `get_active_tasks` before answering, especially for counts, latest/newest/most recent questions, board summaries, or follow-up questions like 'which one', 'that one', or 'the most recent one'.\n" +
    "- Do not switch to repository context unless the user explicitly mentions repos, code, PRs, commits, branches, files, or GitHub."
  );
  sections.push(
    "Communication style:\n" +
    "- Be concise. Lead with the answer, add detail only if it helps.\n" +
    "- Use bullet points for any list of items, steps, options, or recommendations — never write them as long prose.\n" +
    "- Keep each bullet tight — one idea per line.\n" +
    "- Short paragraphs for context or explanation, bullets for structure.\n" +
    "- Avoid filler phrases like 'Certainly!', 'Great question!', or 'Of course!'.\n" +
    "- When referencing tasks, teammates, customers, or repos, use their actual names from the org context."
  );
  return sections.join("\n\n");
}

function hasTaskSignal(value: string) {
  return /\btask|tasks|planner|kanban|board|boards|card|cards|backlog|sprint|todo|to-do|in progress|assigned|assignee|priority|priorities|work item|work items|column\b/i.test(value);
}

function hasCustomerSignal(value: string) {
  return /\bcustomer|client|contact|health score|weekly note|weekly notes\b/i.test(value);
}

function hasRepoSignal(value: string) {
  return /\brepo|repository|repositories|github|pull request|pr\b|commit|branch|readme|code|file|function|class|component|implementation|diff\b/i.test(value);
}

function isFollowUpReference(value: string) {
  return /\b(it|that|those|them|one|ones|latest|newest|most recent|recent|created|updated|oldest|first|last)\b/i.test(value);
}

function shouldEnterToolLoop(history: LlmMessage[]) {
  const recentMessages = history
    .filter((message) => message.role !== "system" && typeof message.content === "string" && message.content.trim())
    .slice(-6);

  const lastUserMessage = [...history].reverse().find((message) => message.role === "user")?.content ?? "";
  const recentText = recentMessages.map((message) => message.content ?? "").join("\n");

  if (hasTaskSignal(lastUserMessage) || hasCustomerSignal(lastUserMessage)) {
    return true;
  }

  if (hasRepoSignal(lastUserMessage) && !hasTaskSignal(lastUserMessage) && !hasCustomerSignal(lastUserMessage)) {
    return false;
  }

  if (isFollowUpReference(lastUserMessage) && (hasTaskSignal(recentText) || hasCustomerSignal(recentText))) {
    return true;
  }

  return hasTaskSignal(recentText) || hasCustomerSignal(recentText);
}

function estimateTokenCount(value: string) {
  return Math.max(1, Math.ceil(value.trim().length / 4));
}

export function buildAgentRuntimePreview(
  config: AgentLlmConfig & { history: ChatMessageInput[] }
): AgentRuntimePreview {
  const systemPrompt = buildSystemPrompt(config);
  const history = config.history;
  const historyText = history.map((entry) => `${entry.role}: ${entry.content}`).join("\n");
  const contextSources = config.contextSources ?? [];

  return {
    systemPrompt,
    history,
    estimatedSystemPromptTokens: estimateTokenCount(systemPrompt),
    estimatedHistoryTokens: historyText ? estimateTokenCount(historyText) : 0,
    estimatedTokens: estimateTokenCount(systemPrompt) + (historyText ? estimateTokenCount(historyText) : 0),
    recentHistoryCount: history.length,
    knowledgeSources: [
      {
        id: "persona",
        label: "Agent persona",
        description: "Agent name, role, description, persona, and duties are included in the system prompt.",
      },
      {
        id: "org-context",
        label: "Hub org context",
        description: "Live team, agents, repos, and customer name list are injected. Active tasks, full customer details, and weekly notes are fetched on demand via agent tools.",
      },
      {
        id: "chat-history",
        label: "Recent chat history",
        description: "The latest conversation turns are included so the agent keeps continuity.",
      },
      ...contextSources,
      {
        id: "current-user",
        label: "Current user",
        description: "The active teammate's display name is provided for personalization.",
      },
    ],
  };
}

export function shouldUseThinking(message: string) {
  const normalized = message.toLowerCase();
  return [
    "think step by step",
    "show your thinking",
    "show your work",
    "reason step by step",
    "debug",
    "analyze",
    "deep dive",
    "compare",
    "tradeoff",
    "root cause",
    "investigate",
    "plan this",
  ].some((pattern) => normalized.includes(pattern));
}

export function resolveThinkingMode(config: AgentLlmConfig, message: string) {
  const mode = config.llmThinkingMode ?? "auto";
  if (mode === "always") return true;
  if (mode === "off") return false;
  return shouldUseThinking(message);
}

async function fetchJson(url: string, init: RequestInit) {
  const response = await fetch(url, { ...init, signal: AbortSignal.timeout(10000) });
  if (!response.ok) {
    throw new Error(`Request failed (${response.status})`);
  }

  return response.json();
}

export async function probeAgentLlm(config: AgentLlmConfig): Promise<AgentLlmStatus> {
  const checkedAt = new Date();
  const provider = resolveProvider(config);

  if (provider === "local") {
    const endpointUrl = config.llmEndpointUrl?.trim();
    if (!endpointUrl) {
      return {
        llmStatus: "disconnected",
        llmModel: null,
        llmLastCheckedAt: null,
        llmLastError: null,
      };
    }

    const headers = buildAuthHeader(config);
    const protocol = config.llmProtocol ?? "auto";

    if (protocol === "ollama") {
      try {
        const { tagsUrl } = buildOllamaUrls(endpointUrl);
        const payload = await fetchJson(tagsUrl, { headers });
        const models = Array.isArray(payload?.models) ? payload.models : [];
        const firstModel = typeof models[0]?.name === "string" ? models[0].name : null;
        const model = config.llmModel?.trim() || firstModel;

        if (!model) {
          throw new Error("No Ollama models were returned by the endpoint");
        }

        return {
          llmStatus: "online",
          llmModel: model,
          llmLastCheckedAt: checkedAt,
          llmLastError: null,
        };
      } catch (error) {
        return {
          llmStatus: "offline",
          llmModel: config.llmModel?.trim() || null,
          llmLastCheckedAt: checkedAt,
          llmLastError: error instanceof Error ? error.message : "Unable to reach the Ollama endpoint",
        };
      }
    }

    if (protocol === "openai-compatible") {
      try {
        const { modelsUrl } = buildOpenAiUrls(endpointUrl);
        const payload = await fetchJson(modelsUrl, { headers });
        const models = Array.isArray(payload?.data) ? payload.data : [];
        const firstModel = typeof models[0]?.id === "string" ? models[0].id : null;
        const model = config.llmModel?.trim() || firstModel;

        if (!model) {
          throw new Error("No OpenAI-compatible models were returned by the endpoint");
        }

        return {
          llmStatus: "online",
          llmModel: model,
          llmLastCheckedAt: checkedAt,
          llmLastError: null,
        };
      } catch (error) {
        return {
          llmStatus: "offline",
          llmModel: config.llmModel?.trim() || null,
          llmLastCheckedAt: checkedAt,
          llmLastError: error instanceof Error ? error.message : "Unable to reach the OpenAI-compatible endpoint",
        };
      }
    }

    try {
      const { tagsUrl } = buildOllamaUrls(endpointUrl);
      const payload = await fetchJson(tagsUrl, { headers });
      const models = Array.isArray(payload?.models) ? payload.models : [];
      const firstModel = typeof models[0]?.name === "string" ? models[0].name : null;
      const model = config.llmModel?.trim() || firstModel;

      if (!model) {
        throw new Error("No Ollama models were returned by the endpoint");
      }

      return {
        llmStatus: "online",
        llmModel: model,
        llmLastCheckedAt: checkedAt,
        llmLastError: null,
      };
    } catch (ollamaError) {
      try {
        const { modelsUrl } = buildOpenAiUrls(endpointUrl);
        const payload = await fetchJson(modelsUrl, { headers });
        const models = Array.isArray(payload?.data) ? payload.data : [];
        const firstModel = typeof models[0]?.id === "string" ? models[0].id : null;
        const model = config.llmModel?.trim() || firstModel;

        if (!model) {
          throw new Error("No OpenAI-compatible models were returned by the endpoint");
        }

        return {
          llmStatus: "online",
          llmModel: model,
          llmLastCheckedAt: checkedAt,
          llmLastError: null,
        };
      } catch (openAiError) {
        const message = openAiError instanceof Error
          ? openAiError.message
          : ollamaError instanceof Error
            ? ollamaError.message
            : "Unable to reach the LLM endpoint";

        return {
          llmStatus: "offline",
          llmModel: config.llmModel?.trim() || null,
          llmLastCheckedAt: checkedAt,
          llmLastError: message,
        };
      }
    }
  }

  if (provider === "openai") {
    const apiKey = config.llmApiKey?.trim();
    if (!apiKey) {
      return {
        llmStatus: "disconnected",
        llmModel: config.llmModel?.trim() || null,
        llmLastCheckedAt: null,
        llmLastError: null,
      };
    }

    try {
      const { modelsUrl } = buildOpenAiUrls(buildProviderBaseUrl(config.llmEndpointUrl, "https://api.openai.com"));
      const payload = await fetchJson(modelsUrl, { headers: buildJsonHeaders({ ...config, llmAuthType: "bearer" }) });
      const models = Array.isArray(payload?.data) ? payload.data : [];
      const firstModel = typeof models[0]?.id === "string" ? models[0].id : null;
      const model = config.llmModel?.trim() || firstModel;

      if (!model) {
        throw new Error("No OpenAI models were returned by the endpoint");
      }

      return {
        llmStatus: "online",
        llmModel: model,
        llmLastCheckedAt: checkedAt,
        llmLastError: null,
      };
    } catch (error) {
      return {
        llmStatus: "offline",
        llmModel: config.llmModel?.trim() || null,
        llmLastCheckedAt: checkedAt,
        llmLastError: error instanceof Error ? error.message : "Unable to reach the OpenAI endpoint",
      };
    }
  }

  if (provider === "anthropic") {
    if (!config.llmApiKey?.trim() || !config.llmModel?.trim()) {
      return {
        llmStatus: "disconnected",
        llmModel: config.llmModel?.trim() || null,
        llmLastCheckedAt: null,
        llmLastError: null,
      };
    }

    try {
      await fetch(buildAnthropicMessagesUrl(config.llmEndpointUrl), {
        method: "POST",
        headers: buildAnthropicHeaders(config),
        body: JSON.stringify({
          model: config.llmModel.trim(),
          max_tokens: 8,
          messages: [{ role: "user", content: "Ping" }],
        }),
        signal: AbortSignal.timeout(30000),
      }).then(async (response) => {
        if (!response.ok) {
          const details = await response.text().catch(() => "");
          throw new Error(details || `Anthropic request failed (${response.status})`);
        }
      });

      return {
        llmStatus: "online",
        llmModel: config.llmModel.trim(),
        llmLastCheckedAt: checkedAt,
        llmLastError: null,
      };
    } catch (error) {
      return {
        llmStatus: "offline",
        llmModel: config.llmModel?.trim() || null,
        llmLastCheckedAt: checkedAt,
        llmLastError: error instanceof Error ? error.message : "Unable to reach the Anthropic endpoint",
      };
    }
  }

  if (!config.llmAccessKeyId?.trim() || !config.llmSecretAccessKey?.trim() || !config.llmModel?.trim()) {
    return {
      llmStatus: "disconnected",
      llmModel: config.llmModel?.trim() || null,
      llmLastCheckedAt: null,
      llmLastError: null,
    };
  }

  try {
    await fetchBedrockJson(
      config,
      {
        messages: [{ role: "user", content: [{ text: "Ping" }] }],
        inferenceConfig: { maxTokens: 8 },
      },
      30000
    );

    return {
      llmStatus: "online",
      llmModel: config.llmModel.trim(),
      llmLastCheckedAt: checkedAt,
      llmLastError: null,
    };
  } catch (error) {
    return {
      llmStatus: "offline",
      llmModel: config.llmModel?.trim() || null,
      llmLastCheckedAt: checkedAt,
      llmLastError: error instanceof Error ? error.message : "Unable to reach the Bedrock endpoint",
    };
  }
}

async function resolveEndpoint(config: AgentLlmConfig): Promise<ResolvedEndpoint> {
  const provider = resolveProvider(config);

  if (provider === "openai") {
    const baseUrl = buildProviderBaseUrl(config.llmEndpointUrl, "https://api.openai.com");
    const { modelsUrl, chatUrl } = buildOpenAiUrls(baseUrl);
    const payload = await fetchJson(modelsUrl, {
      headers: buildJsonHeaders({ ...config, llmAuthType: "bearer" }),
    });
    const models = Array.isArray(payload?.data) ? payload.data : [];
    const model = config.llmModel?.trim() || models[0]?.id;

    if (typeof model !== "string" || !model.trim()) {
      throw new Error("No OpenAI model is available");
    }

    return { kind: "openai", model: model.trim(), chatUrl };
  }

  const endpointUrl = config.llmEndpointUrl?.trim();
  if (!endpointUrl) {
    throw new Error("No LLM endpoint is configured for this agent");
  }

  const headers = buildAuthHeader(config);
  const protocol = config.llmProtocol ?? "auto";

  if (protocol === "ollama") {
    const { tagsUrl, chatUrl } = buildOllamaUrls(endpointUrl);
    const payload = await fetchJson(tagsUrl, { headers });
    const models = Array.isArray(payload?.models) ? payload.models : [];
    const model = config.llmModel?.trim() || models[0]?.name;
    if (typeof model !== "string" || !model.trim()) {
      throw new Error("No Ollama model is available");
    }

    return { kind: "ollama", model: model.trim(), chatUrl };
  }

  if (protocol === "openai-compatible") {
    const { modelsUrl, chatUrl } = buildOpenAiUrls(endpointUrl);
    const payload = await fetchJson(modelsUrl, { headers });
    const models = Array.isArray(payload?.data) ? payload.data : [];
    const model = config.llmModel?.trim() || models[0]?.id;
    if (typeof model !== "string" || !model.trim()) {
      throw new Error("No OpenAI-compatible model is available");
    }

    return { kind: "openai", model: model.trim(), chatUrl };
  }

  try {
    const { tagsUrl, chatUrl } = buildOllamaUrls(endpointUrl);
    const payload = await fetchJson(tagsUrl, { headers });
    const models = Array.isArray(payload?.models) ? payload.models : [];
    const model = config.llmModel?.trim() || models[0]?.name;
    if (typeof model !== "string" || !model.trim()) {
      throw new Error("No Ollama model is available");
    }

    return { kind: "ollama", model: model.trim(), chatUrl };
  } catch {
    const { modelsUrl, chatUrl } = buildOpenAiUrls(endpointUrl);
    const payload = await fetchJson(modelsUrl, { headers });
    const models = Array.isArray(payload?.data) ? payload.data : [];
    const model = config.llmModel?.trim() || models[0]?.id;
    if (typeof model !== "string" || !model.trim()) {
      throw new Error("No OpenAI-compatible model is available");
    }

    return { kind: "openai", model: model.trim(), chatUrl };
  }
}

async function generateAnthropicReply(
  config: AgentLlmConfig,
  messages: LlmMessage[],
  systemPrompt: string
) {
  const response = await fetch(buildAnthropicMessagesUrl(config.llmEndpointUrl), {
    method: "POST",
    headers: buildAnthropicHeaders(config),
    body: JSON.stringify({
      model: config.llmModel?.trim(),
      max_tokens: 2048,
      system: systemPrompt,
      messages: toAnthropicMessages(messages),
    }),
    signal: AbortSignal.timeout(60000),
  });

  if (!response.ok) {
    const details = await response.text().catch(() => "");
    throw new Error(details || `Anthropic request failed (${response.status})`);
  }

  const payload = await response.json() as Record<string, unknown>;
  const content = extractAnthropicText(payload);
  if (!content) {
    throw new Error("Anthropic returned an empty response");
  }

  return {
    content,
    model: config.llmModel?.trim() || "",
  };
}

async function generateBedrockReply(
  config: AgentLlmConfig,
  messages: LlmMessage[],
  systemPrompt: string
) {
  const payload = await fetchBedrockJson(config, {
    system: [{ text: systemPrompt }],
    messages: toAnthropicMessages(messages).map((message) => ({
      role: message.role,
      content: [{ text: message.content }],
    })),
    inferenceConfig: { maxTokens: 2048 },
  });
  const content = extractBedrockText(payload as Record<string, unknown>);

  if (!content) {
    throw new Error("Bedrock returned an empty response");
  }

  return {
    content,
    model: config.llmModel?.trim() || "",
  };
}

export async function generateAgentReply(
  config: AgentLlmConfig & { history: ChatMessageInput[]; enableThinking?: boolean }
) {
  const systemPrompt = buildSystemPrompt(config);
  const messages: LlmMessage[] = [
    { role: "system" as const, content: systemPrompt },
    ...config.history,
  ];
  const provider = resolveProvider(config);

  if (provider === "anthropic") {
    return generateAnthropicReply(config, messages, systemPrompt);
  }

  if (provider === "bedrock") {
    return generateBedrockReply(config, messages, systemPrompt);
  }

  const resolved = await resolveEndpoint(config);

  if (resolved.kind === "ollama") {
    const response = await fetch(resolved.chatUrl, {
      method: "POST",
      headers: buildJsonHeaders(config),
      body: JSON.stringify({
        model: resolved.model,
        stream: false,
        think: config.enableThinking ?? false,
        messages,
      }),
      signal: AbortSignal.timeout(60000),
    });

    if (!response.ok) {
      throw new Error(`Ollama chat request failed (${response.status})`);
    }

    const payload = await response.json();
    const content = typeof payload?.message?.content === "string" ? payload.message.content.trim() : "";
    if (!content) {
      throw new Error("Ollama returned an empty response");
    }

    return { content, model: resolved.model };
  }

  const response = await fetch(resolved.chatUrl, {
    method: "POST",
    headers: buildJsonHeaders(config),
    body: JSON.stringify({
      model: resolved.model,
      messages,
    }),
    signal: AbortSignal.timeout(60000),
  });

  if (!response.ok) {
    throw new Error(`Chat completion request failed (${response.status})`);
  }

  const payload = await response.json();
  const content = typeof payload?.choices?.[0]?.message?.content === "string"
    ? payload.choices[0].message.content.trim()
    : "";

  if (!content) {
    throw new Error("The LLM returned an empty response");
  }

  return { content, model: resolved.model };
}

export async function* streamAgentReply(
  config: AgentLlmConfig & {
    history: LlmMessage[];
    enableThinking?: boolean;
    tools?: AgentToolDefinition[];
    executeTool?: (name: string, args: Record<string, unknown>) => Promise<string>;
  }
): AsyncGenerator<AgentReplyStreamEvent> {
  const systemPrompt = buildSystemPrompt(config);
  const provider = resolveProvider(config);

  // Build a mutable messages array (supports tool-call/result entries).
  const messages: LlmMessage[] = [
    { role: "system", content: systemPrompt },
    ...config.history,
  ];

  if (provider === "anthropic") {
    const response = await generateAnthropicReply(config, messages, systemPrompt);
    yield { type: "content_delta", delta: response.content };
    yield { type: "done", model: response.model };
    return;
  }

  if (provider === "bedrock") {
    const response = await generateBedrockReply(config, messages, systemPrompt);
    yield { type: "content_delta", delta: response.content };
    yield { type: "done", model: response.model };
    return;
  }

  const resolved = await resolveEndpoint(config);

  // ── Tool use loop ────────────────────────────────────────────────────────
  // Run non-streaming rounds until the model produces no more tool calls
  // (max 5 rounds to prevent runaway loops). Each round yields tool_call and
  // tool_result events so the UI can show real-time progress.
  //
  // When the model stops calling tools it produces its final answer in that
  // same non-streaming response. We capture it here and emit it directly so
  // we skip the redundant second streaming LLM call.
  //
  // We skip the tool loop entirely when the message has no signal that tools
  // are needed — routing those straight to streaming so the user gets fast
  // first-token response instead of waiting for a full non-streaming round.
  const messageNeedsTools = shouldEnterToolLoop(config.history);

  let finalAnswerFromToolLoop: string | null = null;
  let usedToolsInLoop = false;
  // Track tool interaction messages so they can be persisted and re-injected
  // as history in subsequent turns, giving the model continuity across turns.
  const toolStartIdx = messages.length;

  if (config.tools?.length && config.executeTool && messageNeedsTools) {
    const MAX_ROUNDS = 5;
    for (let round = 0; round < MAX_ROUNDS; round++) {
      let toolResponse: Response;
      try {
        toolResponse = await fetch(resolved.chatUrl, {
          method: "POST",
          headers: buildJsonHeaders(config),
          body: JSON.stringify({
            model: resolved.model,
            messages,
            tools: config.tools,
            stream: false,
            ...(resolved.kind === "ollama" ? { think: false } : {}),
          }),
          signal: AbortSignal.timeout(60000),
        });
      } catch {
        // Network error, timeout, or endpoint doesn't support non-streaming tool calls.
        break;
      }

      if (!toolResponse.ok) {
        // If the endpoint doesn't support tools, fall through to plain streaming.
        break;
      }

      let payload: Record<string, unknown>;
      try {
        payload = (await toolResponse.json()) as Record<string, unknown>;
      } catch {
        // Response body is not valid JSON — endpoint may not support tools.
        break;
      }

      // Normalise tool calls from both Ollama and OpenAI response shapes.
      type RawToolCall = {
        id?: string;
        function?: { name?: unknown; arguments?: unknown };
      };

      let rawToolCalls: RawToolCall[] = [];
      let assistantContent = "";

      if (resolved.kind === "ollama") {
        const msg = payload.message as Record<string, unknown> | undefined;
        assistantContent = typeof msg?.content === "string" ? msg.content : "";
        rawToolCalls = Array.isArray(msg?.tool_calls)
          ? (msg.tool_calls as RawToolCall[])
          : [];
      } else {
        const choices = payload.choices as Array<Record<string, unknown>> | undefined;
        const msg = choices?.[0]?.message as Record<string, unknown> | undefined;
        assistantContent = typeof msg?.content === "string" ? msg.content : "";
        rawToolCalls = Array.isArray(msg?.tool_calls)
          ? (msg.tool_calls as RawToolCall[])
          : [];
      }

      if (!rawToolCalls.length) {
        // Only reuse the non-streaming answer when we've actually executed
        // tools in a previous round. If the model decides to answer directly,
        // fall through to the normal streaming path so the UI can render a
        // typed-out reply instead of receiving the whole message at once.
        if (usedToolsInLoop && assistantContent.trim()) {
          finalAnswerFromToolLoop = assistantContent;
        }
        break;
      }

      // Add the assistant message (with tool_calls) to history.
      messages.push({
        role: "assistant",
        content: assistantContent,
        tool_calls: rawToolCalls,
      });

      // Execute each tool call sequentially and yield progress events.
      for (let i = 0; i < rawToolCalls.length; i++) {
        usedToolsInLoop = true;
        const tc = rawToolCalls[i];
        const callId = String(tc.id ?? `call_${round}_${i}`);
        const toolName = String(tc.function?.name ?? "");

        // Parse args: Ollama passes a plain object; OpenAI passes a JSON string.
        let toolArgs: Record<string, unknown> = {};
        const rawArgs = tc.function?.arguments;
        if (rawArgs && typeof rawArgs === "object") {
          toolArgs = rawArgs as Record<string, unknown>;
        } else if (typeof rawArgs === "string") {
          try { toolArgs = JSON.parse(rawArgs); } catch { /* keep empty */ }
        }

        yield { type: "tool_call", id: callId, name: toolName, args: toolArgs };

        let result: string;
        try {
          result = await config.executeTool(toolName, toolArgs);
        } catch (err) {
          result = `Tool error: ${err instanceof Error ? err.message : "Unknown error"}`;
        }

        yield { type: "tool_result", id: callId, name: toolName, result };

        // Append tool result so the model sees it in the next round.
        if (resolved.kind === "ollama") {
          messages.push({ role: "tool", content: result });
        } else {
          messages.push({ role: "tool", tool_call_id: callId, content: result });
        }
      }
    }
  }
  // ── End tool use loop ────────────────────────────────────────────────────

  // Emit the tool interaction messages so the route can persist them on the
  // agent ChatMessage and re-inject them as history on the next turn.
  const toolContextMessages = messages.slice(toolStartIdx);
  if (toolContextMessages.length > 0) {
    yield { type: "tool_context", messages: toolContextMessages };
  }

  // If the tool loop already produced the final answer, emit it and stop.
  // This avoids a redundant third LLM call to regenerate the same response.
  if (finalAnswerFromToolLoop !== null) {
    yield { type: "content_delta", delta: finalAnswerFromToolLoop };
    yield { type: "done", model: resolved.model };
    return;
  }

  if (resolved.kind === "openai") {
    const response = await fetch(resolved.chatUrl, {
      method: "POST",
      headers: buildJsonHeaders(config),
      body: JSON.stringify({
        model: resolved.model,
        messages,
        stream: true,
      }),
      signal: AbortSignal.timeout(300000),
    });

    if (!response.ok) {
      throw new Error(`Chat completion request failed (${response.status})`);
    }

    if (!response.body) {
      throw new Error("OpenAI-compatible stream body was empty");
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";

    while (true) {
      const { value, done } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const events = buffer.split("\n\n");
      buffer = events.pop() ?? "";

      for (const rawEvent of events) {
        const lines = rawEvent
          .split("\n")
          .map((line) => line.trim())
          .filter((line) => line.startsWith("data:"))
          .map((line) => line.replace(/^data:\s*/, ""));

        for (const line of lines) {
          if (!line || line === "[DONE]") {
            if (line === "[DONE]") {
              yield { type: "done", model: resolved.model };
            }
            continue;
          }

          const payload = JSON.parse(line) as {
            choices?: Array<{
              delta?: {
                content?: unknown;
                reasoning_content?: unknown;
              };
              finish_reason?: unknown;
            }>;
          };

          const delta = payload.choices?.[0]?.delta;
          const finishReason = payload.choices?.[0]?.finish_reason;

          if (typeof delta?.reasoning_content === "string" && delta.reasoning_content.length > 0) {
            yield { type: "thinking_delta", delta: delta.reasoning_content };
          }

          if (typeof delta?.content === "string" && delta.content.length > 0) {
            yield { type: "content_delta", delta: delta.content };
          }

          if (finishReason) {
            yield { type: "done", model: resolved.model };
          }
        }
      }
    }

    if (buffer.trim()) {
      const trailingLines = buffer
        .split("\n")
        .map((line) => line.trim())
        .filter((line) => line.startsWith("data:"))
        .map((line) => line.replace(/^data:\s*/, ""));

      for (const line of trailingLines) {
        if (!line || line === "[DONE]") {
          if (line === "[DONE]") {
            yield { type: "done", model: resolved.model };
          }
          continue;
        }

        const payload = JSON.parse(line) as {
          choices?: Array<{
            delta?: {
              content?: unknown;
              reasoning_content?: unknown;
            };
            finish_reason?: unknown;
          }>;
        };

        const delta = payload.choices?.[0]?.delta;
        const finishReason = payload.choices?.[0]?.finish_reason;

        if (typeof delta?.reasoning_content === "string" && delta.reasoning_content.length > 0) {
          yield { type: "thinking_delta", delta: delta.reasoning_content };
        }

        if (typeof delta?.content === "string" && delta.content.length > 0) {
          yield { type: "content_delta", delta: delta.content };
        }

        if (finishReason) {
          yield { type: "done", model: resolved.model };
        }
      }
    }

    return;
  }

  const response = await fetch(resolved.chatUrl, {
    method: "POST",
    headers: buildJsonHeaders(config),
    body: JSON.stringify({
      model: resolved.model,
      stream: true,
      think: config.enableThinking ?? false,
      messages,
    }),
    signal: AbortSignal.timeout(300000),
  });

  if (!response.ok) {
    throw new Error(`Ollama chat request failed (${response.status})`);
  }

  if (!response.body) {
    throw new Error("Ollama stream body was empty");
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  while (true) {
    const { value, done } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split("\n");
    buffer = lines.pop() ?? "";

    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed) continue;

      const payload = JSON.parse(trimmed) as {
        done?: boolean;
        message?: {
          content?: unknown;
          thinking?: unknown;
        };
      };

      if (typeof payload.message?.thinking === "string" && payload.message.thinking.length > 0) {
        yield { type: "thinking_delta", delta: payload.message.thinking };
      }

      if (typeof payload.message?.content === "string" && payload.message.content.length > 0) {
        yield { type: "content_delta", delta: payload.message.content };
      }

      if (payload.done) {
        yield { type: "done", model: resolved.model };
      }
    }
  }

  if (buffer.trim()) {
    const payload = JSON.parse(buffer.trim()) as {
      done?: boolean;
      message?: {
        content?: unknown;
        thinking?: unknown;
      };
    };

    if (typeof payload.message?.thinking === "string" && payload.message.thinking.length > 0) {
      yield { type: "thinking_delta", delta: payload.message.thinking };
    }

    if (typeof payload.message?.content === "string" && payload.message.content.length > 0) {
      yield { type: "content_delta", delta: payload.message.content };
    }

    if (payload.done) {
      yield { type: "done", model: resolved.model };
    }
  }
}
