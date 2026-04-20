export type AgentLlmProvider = "local" | "openai" | "anthropic" | "bedrock";
export type AgentLlmConnectionProtocol = "auto" | "ollama" | "openai-compatible";
export type AgentLlmConnectionAuthType = "none" | "basic" | "bearer" | "api-key" | "aws-signature-v4";
export type AgentLlmConnectionStatus = "disconnected" | "online" | "offline";
export type AgentLlmThinkingMode = "off" | "auto" | "always";

export type AgentLlmRoutingPolicy = {
  complexity: "balanced" | "prefer-strong";
  cost: "balanced" | "prefer-lower-cost";
  latency: "balanced" | "prefer-faster";
  contextLength: "balanced" | "prefer-long-context-when-needed";
  toolCallingReliability: "balanced" | "prefer-reliable";
  multimodalNeeds: "balanced" | "prefer-multimodal-when-needed";
  codingStrength: "balanced" | "prefer-strong-coding";
  escalationConditions: string[];
};

export type AgentLlmConnectionAuth = {
  username: string;
  password: string;
  hasPassword: boolean;
  apiKey: string;
  hasApiKey: boolean;
  accessKeyId: string;
  secretAccessKey: string;
  hasSecretAccessKey: boolean;
};

export type AgentLlmConnectionSettings = {
  protocol: AgentLlmConnectionProtocol;
  endpointUrl: string;
  region: string;
};

export type AgentLlmConnection = {
  id: string;
  label: string;
  provider: AgentLlmProvider;
  model: string;
  thinkingMode: AgentLlmThinkingMode;
  enabled: boolean;
  status: AgentLlmConnectionStatus;
  lastValidatedAt: string | null;
  validationError: string | null;
  auth: AgentLlmConnectionAuth;
  connection: AgentLlmConnectionSettings;
};

export type AgentLlmRoutingSettings = {
  autoRoute: boolean;
  defaultModelKey: string | null;
  allowUserOverride: boolean;
  allowEscalation: boolean;
};

export type AgentLlmConfigDocument = {
  version: 1;
  connections: AgentLlmConnection[];
  routing: AgentLlmRoutingSettings;
};

export type AgentLlmCatalogEntry = {
  key: string;
  label: string;
  model: string | null;
  thinkingMode: AgentLlmThinkingMode;
  connectionId: string;
  connectionLabel: string;
  provider: AgentLlmProvider;
  protocol: AgentLlmConnectionProtocol;
  endpointUrl: string | null;
  region: string | null;
  authType: AgentLlmConnectionAuthType;
  username: string;
  password: string;
  apiKey: string;
  accessKeyId: string;
  secretAccessKey: string;
  strengthScore: number;
  codingScore: number;
  multimodal: boolean;
  longContext: boolean;
};

export type AgentLlmExecutionTarget = {
  connectionId: string;
  connectionLabel: string;
  provider: AgentLlmProvider;
  protocol: AgentLlmConnectionProtocol;
  endpointUrl: string | null;
  region: string | null;
  authType: AgentLlmConnectionAuthType;
  username: string | null;
  password: string | null;
  apiKey: string | null;
  accessKeyId: string | null;
  secretAccessKey: string | null;
  model: string | null;
  modelKey: string | null;
  thinkingMode: AgentLlmThinkingMode;
  label: string;
};

export type ConversationLlmAuditEventType = "selection" | "override" | "escalation";

export type ConversationLlmAuditEvent = {
  type: ConversationLlmAuditEventType;
  at: string;
  summary: string;
  selectedBy: "auto" | "default" | "user" | "legacy";
  provider: string | null;
  model: string | null;
  modelKey: string | null;
};

export type ConversationLlmThreadState = {
  activeAgentId: string | null;
  selectedConnectionId: string | null;
  selectedConnectionLabel: string | null;
  selectedProvider: string | null;
  selectedModel: string | null;
  selectedModelKey: string | null;
  selectedLabel: string | null;
  selectedBy: "auto" | "default" | "user" | "legacy" | null;
  reasonSummary: string | null;
  escalationSummary: string | null;
  auditEvents: ConversationLlmAuditEvent[];
};

type LegacyLlmFields = {
  llmEndpointUrl?: string | null;
  llmUsername?: string | null;
  llmPassword?: string | null;
  llmModel?: string | null;
  llmThinkingMode?: string | null;
};

type MessageNeeds = {
  complexity: number;
  coding: number;
  multimodal: number;
  longContext: number;
  deepReasoning: boolean;
  summary: string[];
};

type PlannedThreadSelection = {
  target: AgentLlmExecutionTarget | null;
  state: ConversationLlmThreadState;
  eventType: ConversationLlmAuditEventType | null;
};

export const AGENT_LLM_PROVIDER_OPTIONS: Array<{
  id: AgentLlmProvider;
  label: string;
  description: string;
}> = [
  { id: "local", label: "Local / Custom Endpoint", description: "Self-hosted or custom endpoint-based model server." },
  { id: "bedrock", label: "Amazon Bedrock", description: "AWS-managed Bedrock model connection." },
  { id: "openai", label: "OpenAI", description: "Direct OpenAI API connection." },
  { id: "anthropic", label: "Anthropic", description: "Direct Anthropic API connection." },
];

export const DEFAULT_AGENT_LLM_ROUTING_POLICY: AgentLlmRoutingPolicy = {
  complexity: "balanced",
  cost: "balanced",
  latency: "balanced",
  contextLength: "prefer-long-context-when-needed",
  toolCallingReliability: "prefer-reliable",
  multimodalNeeds: "prefer-multimodal-when-needed",
  codingStrength: "prefer-strong-coding",
  escalationConditions: [
    "Escalate when the request becomes code-heavy, multi-step, or unusually analytical.",
    "Escalate when the task needs more context headroom, stronger tool-calling reliability, or multimodal support.",
    "Escalate when the teammate explicitly asks for deeper reasoning or a stronger model.",
  ],
};

export const DEFAULT_AGENT_LLM_ROUTING_SETTINGS: AgentLlmRoutingSettings = {
  autoRoute: true,
  defaultModelKey: null,
  allowUserOverride: false,
  allowEscalation: true,
};

function createLocalId(prefix: string) {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return `${prefix}_${crypto.randomUUID().replace(/-/g, "").slice(0, 12)}`;
  }

  return `${prefix}_${Math.random().toString(36).slice(2, 12)}`;
}

function uniqueStrings(values: string[]) {
  return Array.from(new Set(values.map((value) => value.trim()).filter(Boolean)));
}

function sanitizeProtocol(value: unknown): AgentLlmConnectionProtocol {
  return value === "ollama" || value === "openai-compatible" ? value : "auto";
}

function sanitizeThinkingMode(value: unknown): AgentLlmThinkingMode {
  return value === "off" || value === "always" ? value : "auto";
}

function sanitizeConnectionStatus(value: unknown): AgentLlmConnectionStatus {
  return value === "online" || value === "offline" ? value : "disconnected";
}

function sanitizeProvider(value: unknown): AgentLlmProvider {
  return value === "openai" || value === "anthropic" || value === "bedrock" ? value : "local";
}

function parseBoolean(value: unknown, fallback = false) {
  return typeof value === "boolean" ? value : fallback;
}

function sanitizeDateString(value: unknown) {
  if (typeof value !== "string" || !value.trim()) return null;
  return Number.isNaN(Date.parse(value)) ? null : value.trim();
}

function parseConnectionModel(value: unknown, fallback?: unknown) {
  if (typeof value === "string" && value.trim()) {
    return value.trim();
  }

  if (Array.isArray(fallback)) {
    return uniqueStrings(fallback.filter((entry): entry is string => typeof entry === "string"))[0] ?? "";
  }

  if (typeof fallback === "string") {
    return uniqueStrings(
      fallback
        .split(/[\n,]/)
        .map((entry) => entry.trim())
        .filter(Boolean)
    )[0] ?? "";
  }

  return "";
}

function defaultProviderLabel(provider: AgentLlmProvider) {
  if (provider === "openai") return "OpenAI";
  if (provider === "anthropic") return "Anthropic";
  if (provider === "bedrock") return "Amazon Bedrock";
  return "Local / Custom Endpoint";
}

function inferProvider(raw: Record<string, unknown>) {
  if (raw.provider !== undefined) {
    return sanitizeProvider(raw.provider);
  }

  const connection = raw.connection && typeof raw.connection === "object"
    ? raw.connection as Record<string, unknown>
    : {};
  const auth = raw.auth && typeof raw.auth === "object"
    ? raw.auth as Record<string, unknown>
    : {};

  if (typeof connection.region === "string" && connection.region.trim()) return "bedrock";
  if (typeof raw.region === "string" && raw.region.trim()) return "bedrock";
  if (typeof auth.accessKeyId === "string" && auth.accessKeyId.trim()) return "bedrock";
  if (typeof raw.accessKeyId === "string" && raw.accessKeyId.trim()) return "bedrock";

  const endpointUrl = typeof connection.endpointUrl === "string" ? connection.endpointUrl.trim() : typeof raw.endpointUrl === "string" ? raw.endpointUrl.trim() : "";
  if (endpointUrl) return "local";
  if (raw.protocol !== undefined) return "local";
  if (raw.authType !== undefined) return "local";
  if (typeof raw.username === "string" || typeof raw.password === "string") return "local";

  const apiKey = typeof auth.apiKey === "string" ? auth.apiKey.trim() : typeof raw.apiKey === "string" ? raw.apiKey.trim() : "";
  if (apiKey) return "openai";

  return "local";
}

function normalizeConnection(value: unknown, index: number): AgentLlmConnection | null {
  if (!value || typeof value !== "object") return null;

  const raw = value as Record<string, unknown>;
  const provider = inferProvider(raw);
  const auth = raw.auth && typeof raw.auth === "object" ? raw.auth as Record<string, unknown> : {};
  const connection = raw.connection && typeof raw.connection === "object" ? raw.connection as Record<string, unknown> : {};
  const endpointUrl = typeof connection.endpointUrl === "string"
    ? connection.endpointUrl.trim()
    : typeof raw.endpointUrl === "string"
      ? raw.endpointUrl.trim()
      : "";
  const region = typeof connection.region === "string"
    ? connection.region.trim()
    : typeof raw.region === "string"
      ? raw.region.trim()
      : provider === "bedrock"
        ? "us-east-1"
        : "";
  const protocol = provider === "local"
    ? sanitizeProtocol(connection.protocol ?? raw.protocol)
    : provider === "openai"
      ? "openai-compatible"
      : "auto";
  const password = typeof auth.password === "string"
    ? auth.password.trim()
    : typeof raw.password === "string"
      ? raw.password.trim()
      : "";
  const apiKey = typeof auth.apiKey === "string"
    ? auth.apiKey.trim()
    : typeof raw.apiKey === "string"
      ? raw.apiKey.trim()
      : "";
  const secretAccessKey = typeof auth.secretAccessKey === "string"
    ? auth.secretAccessKey.trim()
    : typeof raw.secretAccessKey === "string"
      ? raw.secretAccessKey.trim()
      : "";

  return {
    id: typeof raw.id === "string" && raw.id.trim() ? raw.id.trim() : createLocalId(`llm_${index + 1}`),
    label: typeof raw.label === "string" && raw.label.trim() ? raw.label.trim() : defaultProviderLabel(provider),
    provider,
    model: parseConnectionModel(raw.model, raw.models),
    thinkingMode: sanitizeThinkingMode(raw.thinkingMode),
    enabled: parseBoolean(raw.enabled, true),
    status: sanitizeConnectionStatus(raw.status),
    lastValidatedAt: sanitizeDateString(raw.lastValidatedAt),
    validationError: typeof raw.validationError === "string" && raw.validationError.trim() ? raw.validationError.trim() : null,
    auth: {
      username: typeof auth.username === "string"
        ? auth.username.trim()
        : typeof raw.username === "string"
          ? raw.username.trim()
          : "",
      password,
      hasPassword: parseBoolean(auth.hasPassword, password.length > 0),
      apiKey,
      hasApiKey: parseBoolean(auth.hasApiKey, apiKey.length > 0),
      accessKeyId: typeof auth.accessKeyId === "string"
        ? auth.accessKeyId.trim()
        : typeof raw.accessKeyId === "string"
          ? raw.accessKeyId.trim()
          : "",
      secretAccessKey,
      hasSecretAccessKey: parseBoolean(auth.hasSecretAccessKey, secretAccessKey.length > 0),
    },
    connection: {
      protocol,
      endpointUrl,
      region,
    },
  };
}

function buildLegacyConnection(legacy?: LegacyLlmFields | null): AgentLlmConnection | null {
  const endpointUrl = legacy?.llmEndpointUrl?.trim();
  if (!endpointUrl) return null;

  const password = legacy?.llmPassword?.trim() ?? "";

  return {
    id: "legacy_primary",
    label: "Local / Custom Endpoint",
    provider: "local",
    model: legacy?.llmModel?.trim() ?? "",
    thinkingMode: sanitizeThinkingMode(legacy?.llmThinkingMode),
    enabled: true,
    status: "disconnected",
    lastValidatedAt: null,
    validationError: null,
    auth: {
      username: legacy?.llmUsername?.trim() ?? "",
      password,
      hasPassword: password.length > 0,
      apiKey: "",
      hasApiKey: false,
      accessKeyId: "",
      secretAccessKey: "",
      hasSecretAccessKey: false,
    },
    connection: {
      protocol: "auto",
      endpointUrl,
      region: "",
    },
  };
}

function parseConfigDocument(raw: unknown): Partial<AgentLlmConfigDocument> | null {
  if (!raw) return null;

  if (typeof raw === "string") {
    try {
      return parseConfigDocument(JSON.parse(raw));
    } catch {
      return null;
    }
  }

  if (typeof raw !== "object") {
    return null;
  }

  return raw as Partial<AgentLlmConfigDocument>;
}

function inferModelStrength(model: string | null | undefined, provider?: AgentLlmProvider) {
  const normalized = (model || provider || "").toLowerCase();
  let score = 1;

  if (/\b(gpt-5|o3|o1|opus|sonnet|claude-3\.7|claude-4|r1|70b|72b|405b)\b/.test(normalized)) score += 4;
  else if (/\b(gpt-4|4\.1|qwen3|32b|34b|27b|22b|deepseek|gemini-1\.5-pro|gemini-2\.5-pro)\b/.test(normalized)) score += 3;
  else if (/\b(14b|13b|12b|11b|10b|large|bedrock|anthropic|openai)\b/.test(normalized)) score += 2;
  else if (/\b(7b|8b|mini|small|flash|haiku)\b/.test(normalized)) score += 1;

  if (/\b(code|coder|coding)\b/.test(normalized)) score += 1;
  return score;
}

function inferCodingStrength(model: string | null | undefined, provider?: AgentLlmProvider) {
  const normalized = (model || provider || "").toLowerCase();
  let score = 1;
  if (/\b(code|coder|coding|gpt-5|gpt-4|sonnet|opus|r1|deepseek|qwen|claude)\b/.test(normalized)) score += 2;
  if (/\b(mini|flash|haiku)\b/.test(normalized)) score -= 1;
  return Math.max(1, score);
}

function inferLongContext(model: string | null | undefined) {
  return /\b(128k|200k|1m|long|extended)\b/i.test(model ?? "");
}

function inferMultimodal(model: string | null | undefined) {
  return /\b(vision|omni|vl|gpt-4o|gemini|llava|multimodal|nova)\b/i.test(model ?? "");
}

function clampAuditEvents(events: ConversationLlmAuditEvent[]) {
  return events.slice(-12);
}

function buildAuditEvent(params: {
  type: ConversationLlmAuditEventType;
  summary: string;
  selectedBy: "auto" | "default" | "user" | "legacy";
  target: AgentLlmExecutionTarget | null;
}) {
  return {
    type: params.type,
    at: new Date().toISOString(),
    summary: params.summary,
    selectedBy: params.selectedBy,
    provider: params.target?.provider ?? null,
    model: params.target?.model ?? null,
    modelKey: params.target?.modelKey ?? null,
  } satisfies ConversationLlmAuditEvent;
}

function buildSelectionState(
  target: AgentLlmExecutionTarget | null,
  selectedBy: ConversationLlmThreadState["selectedBy"],
  reasonSummary: string | null,
  escalationSummary: string | null,
  auditEvents: ConversationLlmAuditEvent[],
  activeAgentId: string | null = null
): ConversationLlmThreadState {
  return {
    activeAgentId,
    selectedConnectionId: target?.connectionId ?? null,
    selectedConnectionLabel: target?.connectionLabel ?? null,
    selectedProvider: target?.provider ?? null,
    selectedModel: target?.model ?? null,
    selectedModelKey: target?.modelKey ?? null,
    selectedLabel: target?.label ?? null,
    selectedBy,
    reasonSummary,
    escalationSummary,
    auditEvents: clampAuditEvents(auditEvents),
  };
}

function summarizeNeeds(needs: MessageNeeds) {
  if (needs.summary.length === 0) return "Using the default thread model.";
  return `Selected for ${needs.summary.join(", ")}.`;
}

function inferMessageNeeds(message: string, historyCount: number): MessageNeeds {
  const normalized = message.toLowerCase();
  const complexity = (
    (/\b(analyze|analysis|compare|tradeoff|design|architecture|debug|investigate|root cause|plan)\b/.test(normalized) ? 2 : 0) +
    (message.length > 500 ? 1 : 0)
  );
  const coding = /\b(code|typescript|javascript|react|next\.js|bug|stack trace|function|component|schema|sql|patch|pr|repo|build|lint|test)\b/.test(normalized) ? 2 : 0;
  const multimodal = /\b(image|screenshot|diagram|pdf|vision)\b/.test(normalized) ? 1 : 0;
  const longContext = historyCount >= 8 || /\b(read|review|study|summarize|entire|whole file|multiple files|long context)\b/.test(normalized) ? 1 : 0;
  const deepReasoning = /\b(deep|step by step|think hard|stronger model|best model)\b/.test(normalized);

  const summary: string[] = [];
  if (coding > 0) summary.push("coding depth");
  if (complexity > 0) summary.push("higher complexity");
  if (longContext > 0) summary.push("context load");
  if (multimodal > 0) summary.push("multimodal needs");
  if (deepReasoning) summary.push("deeper reasoning");

  return { complexity, coding, multimodal, longContext, deepReasoning, summary };
}

function resolveConnectionAuthType(connection: AgentLlmConnection): AgentLlmConnectionAuthType {
  if (connection.provider === "bedrock") return "aws-signature-v4";
  if (connection.provider === "anthropic") return "api-key";
  if (connection.provider === "openai") return "bearer";

  return connection.auth.username.trim() || connection.auth.password.trim() || connection.auth.hasPassword
    ? "basic"
    : "none";
}

export function isAgentLlmConnectionConfigured(connection: AgentLlmConnection) {
  const endpointUrl = connection.connection.endpointUrl.trim();
  const model = connection.model.trim();
  const hasApiKey = connection.auth.apiKey.trim().length > 0 || connection.auth.hasApiKey;
  const hasSecretAccessKey = connection.auth.secretAccessKey.trim().length > 0 || connection.auth.hasSecretAccessKey;

  if (!connection.enabled) return false;

  if (connection.provider === "local") {
    return endpointUrl.length > 0;
  }

  if (connection.provider === "openai" || connection.provider === "anthropic") {
    return hasApiKey && model.length > 0;
  }

  return Boolean(connection.auth.accessKeyId.trim() && hasSecretAccessKey && connection.connection.region.trim() && model.length > 0);
}

function toCatalogEntry(connection: AgentLlmConnection): AgentLlmCatalogEntry {
  const model = connection.model.trim() || null;

  return {
    key: connection.id,
    label: model ? `${model} (${connection.label})` : connection.label,
    model,
    thinkingMode: connection.thinkingMode,
    connectionId: connection.id,
    connectionLabel: connection.label,
    provider: connection.provider,
    protocol: connection.connection.protocol,
    endpointUrl: connection.connection.endpointUrl.trim() || null,
    region: connection.connection.region.trim() || null,
    authType: resolveConnectionAuthType(connection),
    username: connection.auth.username.trim(),
    password: connection.auth.password.trim(),
    apiKey: connection.auth.apiKey.trim(),
    accessKeyId: connection.auth.accessKeyId.trim(),
    secretAccessKey: connection.auth.secretAccessKey.trim(),
    strengthScore: inferModelStrength(model, connection.provider),
    codingScore: inferCodingStrength(model, connection.provider),
    multimodal: inferMultimodal(model),
    longContext: inferLongContext(model),
  };
}

function normalizeDefaultModelKey(config: AgentLlmConfigDocument, rawKey: string | null) {
  if (!rawKey) return null;

  const catalog = getAgentLlmCatalog(config);
  if (catalog.some((entry) => entry.key === rawKey)) {
    return rawKey;
  }

  const legacyConnectionId = rawKey.split("::")[0];
  return catalog.some((entry) => entry.key === legacyConnectionId) ? legacyConnectionId : null;
}

function findCatalogEntry(config: AgentLlmConfigDocument, modelKey: string | null | undefined) {
  if (!modelKey) return null;

  const catalog = getAgentLlmCatalog(config);
  const directMatch = catalog.find((entry) => entry.key === modelKey) ?? null;
  if (directMatch) return directMatch;

  const legacyConnectionId = modelKey.split("::")[0];
  return catalog.find((entry) => entry.key === legacyConnectionId) ?? null;
}

function findCatalogEntryFromState(config: AgentLlmConfigDocument, state: ConversationLlmThreadState) {
  if (state.selectedModelKey) {
    const byKey = findCatalogEntry(config, state.selectedModelKey);
    if (byKey) return byKey;
  }

  if (!state.selectedConnectionId) return null;
  return getAgentLlmCatalog(config).find((entry) => entry.connectionId === state.selectedConnectionId) ?? null;
}

function buildTargetFromCatalogEntry(entry: AgentLlmCatalogEntry): AgentLlmExecutionTarget {
  return {
    connectionId: entry.connectionId,
    connectionLabel: entry.connectionLabel,
    provider: entry.provider,
    protocol: entry.protocol,
    endpointUrl: entry.endpointUrl,
    region: entry.region,
    authType: entry.authType,
    username: entry.username || null,
    password: entry.password || null,
    apiKey: entry.apiKey || null,
    accessKeyId: entry.accessKeyId || null,
    secretAccessKey: entry.secretAccessKey || null,
    model: entry.model,
    modelKey: entry.key,
    thinkingMode: entry.thinkingMode,
    label: entry.label,
  };
}

function buildTargetFromConnection(connection: AgentLlmConnection): AgentLlmExecutionTarget {
  const model = connection.model.trim() || null;

  return {
    connectionId: connection.id,
    connectionLabel: connection.label,
    provider: connection.provider,
    protocol: connection.connection.protocol,
    endpointUrl: connection.connection.endpointUrl.trim() || null,
    region: connection.connection.region.trim() || null,
    authType: resolveConnectionAuthType(connection),
    username: connection.auth.username.trim() || null,
    password: connection.auth.password.trim() || null,
    apiKey: connection.auth.apiKey.trim() || null,
    accessKeyId: connection.auth.accessKeyId.trim() || null,
    secretAccessKey: connection.auth.secretAccessKey.trim() || null,
    model,
    modelKey: connection.id,
    thinkingMode: connection.thinkingMode,
    label: model ? `${model} (${connection.label})` : connection.label,
  };
}

function getFallbackTarget(config: AgentLlmConfigDocument) {
  const defaultEntry = findCatalogEntry(config, config.routing.defaultModelKey);
  if (defaultEntry) return buildTargetFromCatalogEntry(defaultEntry);

  const firstCatalogEntry = getAgentLlmCatalog(config)[0];
  if (firstCatalogEntry) return buildTargetFromCatalogEntry(firstCatalogEntry);

  const firstEnabledConnection = config.connections.find((connection) => connection.enabled) ?? config.connections[0];
  return firstEnabledConnection ? buildTargetFromConnection(firstEnabledConnection) : null;
}

function preserveSecret(
  nextValue: string,
  nextHasValue: boolean,
  existingValue: string,
  existingHasValue: boolean,
  shouldPreserve: boolean
) {
  if (nextValue.trim()) return nextValue.trim();
  if (shouldPreserve && nextHasValue && existingHasValue && existingValue.trim()) {
    return existingValue.trim();
  }

  return "";
}

export function createEmptyAgentLlmConnection(index = 0, provider: AgentLlmProvider = "local"): AgentLlmConnection {
  return {
    id: createLocalId(`llm_${index + 1}`),
    label: defaultProviderLabel(provider),
    provider,
    model: "",
    thinkingMode: "auto",
    enabled: true,
    status: "disconnected",
    lastValidatedAt: null,
    validationError: null,
    auth: {
      username: "",
      password: "",
      hasPassword: false,
      apiKey: "",
      hasApiKey: false,
      accessKeyId: "",
      secretAccessKey: "",
      hasSecretAccessKey: false,
    },
    connection: {
      protocol: provider === "openai" ? "openai-compatible" : "auto",
      endpointUrl: "",
      region: provider === "bedrock" ? "us-east-1" : "",
    },
  };
}

export function switchAgentLlmConnectionProvider(
  connection: AgentLlmConnection,
  provider: AgentLlmProvider
): AgentLlmConnection {
  if (connection.provider === provider) {
    return connection;
  }

  const hasDefaultLabel = !connection.label.trim() || connection.label === defaultProviderLabel(connection.provider);

  return {
    ...createEmptyAgentLlmConnection(0, provider),
    id: connection.id,
    label: hasDefaultLabel ? defaultProviderLabel(provider) : connection.label,
    model: provider === "local" ? connection.model : connection.model.trim(),
    thinkingMode: connection.thinkingMode,
    enabled: connection.enabled,
  };
}

export function createDefaultAgentLlmConfig(): AgentLlmConfigDocument {
  return {
    version: 1,
    connections: [],
    routing: { ...DEFAULT_AGENT_LLM_ROUTING_SETTINGS },
  };
}

export function getAgentLlmCatalog(config: AgentLlmConfigDocument) {
  return config.connections
    .filter(isAgentLlmConnectionConfigured)
    .map((connection) => toCatalogEntry(connection));
}

export function hasAgentLlmConnection(config: AgentLlmConfigDocument) {
  return config.connections.some((connection) => isAgentLlmConnectionConfigured(connection));
}

export function normalizeAgentLlmConfig(raw: unknown, legacy?: LegacyLlmFields | null): AgentLlmConfigDocument {
  const parsed = parseConfigDocument(raw);
  const parsedConnections = Array.isArray(parsed?.connections)
    ? parsed.connections
        .map((connection, index) => normalizeConnection(connection, index))
        .filter((connection): connection is AgentLlmConnection => Boolean(connection))
    : [];

  const fallbackConnection = parsedConnections.length === 0 ? buildLegacyConnection(legacy) : null;
  const connections = fallbackConnection ? [fallbackConnection] : parsedConnections;
  const routing = {
    autoRoute: parsed?.routing?.autoRoute !== false,
    defaultModelKey: typeof parsed?.routing?.defaultModelKey === "string" ? parsed.routing.defaultModelKey : null,
    allowUserOverride: false,
    allowEscalation: parsed?.routing?.allowEscalation !== false,
  } satisfies AgentLlmRoutingSettings;

  const normalized = {
    version: 1 as const,
    connections,
    routing,
  };

  return {
    ...normalized,
    routing: {
      ...routing,
      defaultModelKey: normalizeDefaultModelKey(normalized, routing.defaultModelKey),
    },
  };
}

export function mergeAgentLlmConfigWithStoredSecrets(
  incoming: unknown,
  stored: unknown,
  legacy?: LegacyLlmFields | null
) {
  const nextConfig = normalizeAgentLlmConfig(incoming, legacy);
  const storedConfig = normalizeAgentLlmConfig(stored, legacy);
  const storedById = new Map(storedConfig.connections.map((connection) => [connection.id, connection]));

  return normalizeAgentLlmConfig({
    ...nextConfig,
    connections: nextConfig.connections.map((connection) => {
      const storedConnection = storedById.get(connection.id);
      const sameProvider = storedConnection?.provider === connection.provider;

      return {
        ...connection,
        auth: {
          ...connection.auth,
          password: preserveSecret(
            connection.auth.password,
            connection.auth.hasPassword,
            storedConnection?.auth.password ?? "",
            storedConnection?.auth.hasPassword ?? false,
            Boolean(sameProvider)
          ),
          hasPassword: Boolean(
            connection.auth.password.trim()
            || (sameProvider && connection.auth.hasPassword && (storedConnection?.auth.hasPassword || storedConnection?.auth.password.trim()))
          ),
          apiKey: preserveSecret(
            connection.auth.apiKey,
            connection.auth.hasApiKey,
            storedConnection?.auth.apiKey ?? "",
            storedConnection?.auth.hasApiKey ?? false,
            Boolean(sameProvider)
          ),
          hasApiKey: Boolean(
            connection.auth.apiKey.trim()
            || (sameProvider && connection.auth.hasApiKey && (storedConnection?.auth.hasApiKey || storedConnection?.auth.apiKey.trim()))
          ),
          secretAccessKey: preserveSecret(
            connection.auth.secretAccessKey,
            connection.auth.hasSecretAccessKey,
            storedConnection?.auth.secretAccessKey ?? "",
            storedConnection?.auth.hasSecretAccessKey ?? false,
            Boolean(sameProvider)
          ),
          hasSecretAccessKey: Boolean(
            connection.auth.secretAccessKey.trim()
            || (
              sameProvider
              && connection.auth.hasSecretAccessKey
              && (storedConnection?.auth.hasSecretAccessKey || storedConnection?.auth.secretAccessKey.trim())
            )
          ),
        },
      } satisfies AgentLlmConnection;
    }),
  });
}

export function sanitizeAgentLlmConfigForClient(raw: unknown, legacy?: LegacyLlmFields | null): AgentLlmConfigDocument {
  const normalized = normalizeAgentLlmConfig(raw, legacy);

  return {
    ...normalized,
    connections: normalized.connections.map((connection) => ({
      ...connection,
      auth: {
        ...connection.auth,
        password: "",
        hasPassword: Boolean(connection.auth.hasPassword || connection.auth.password.trim()),
        apiKey: "",
        hasApiKey: Boolean(connection.auth.hasApiKey || connection.auth.apiKey.trim()),
        secretAccessKey: "",
        hasSecretAccessKey: Boolean(connection.auth.hasSecretAccessKey || connection.auth.secretAccessKey.trim()),
      },
    })),
  };
}

export function serializeAgentLlmConfig(config: AgentLlmConfigDocument) {
  const normalized = normalizeAgentLlmConfig(config);
  return JSON.stringify(normalized);
}

export function serializePublicAgentLlmConfig(raw: unknown, legacy?: LegacyLlmFields | null) {
  return JSON.stringify(sanitizeAgentLlmConfigForClient(raw, legacy));
}

export function applyAgentLlmConnectionProbeResult(
  config: AgentLlmConfigDocument,
  connectionId: string | null | undefined,
  result: {
    llmStatus: AgentLlmConnectionStatus;
    llmLastCheckedAt: Date | null;
    llmLastError: string | null;
  }
) {
  if (!connectionId) return normalizeAgentLlmConfig(config);

  return normalizeAgentLlmConfig({
    ...config,
    connections: config.connections.map((connection) =>
      connection.id === connectionId
        ? {
            ...connection,
            status: result.llmStatus,
            lastValidatedAt: result.llmLastCheckedAt?.toISOString() ?? null,
            validationError: result.llmLastError,
          }
        : connection
    ),
  });
}

export function getPrimaryLegacyLlmFields(config: AgentLlmConfigDocument) {
  const primaryTarget = getFallbackTarget(config);
  if (!primaryTarget) {
    return {
      llmEndpointUrl: null,
      llmUsername: null,
      llmPassword: null,
      llmModel: null,
      llmThinkingMode: "auto" as AgentLlmThinkingMode,
    };
  }

  return {
    llmEndpointUrl:
      primaryTarget.provider === "local"
        ? primaryTarget.endpointUrl || null
        : primaryTarget.provider === "openai" && primaryTarget.endpointUrl
          ? primaryTarget.endpointUrl
          : null,
    llmUsername: primaryTarget.authType === "basic" ? primaryTarget.username : null,
    llmPassword: primaryTarget.authType === "basic" ? primaryTarget.password : null,
    llmModel: primaryTarget.model,
    llmThinkingMode: primaryTarget.thinkingMode,
  };
}

export function getPublicAgentLlmCatalog(config: AgentLlmConfigDocument) {
  const defaultModelKey = normalizeDefaultModelKey(config, config.routing.defaultModelKey);
  return getAgentLlmCatalog(config).map((entry) => ({
    key: entry.key,
    label: entry.label,
    model: entry.model,
    provider: entry.provider,
    connectionId: entry.connectionId,
    connectionLabel: entry.connectionLabel,
    isDefault: entry.key === defaultModelKey,
  }));
}

export function normalizeConversationLlmThreadState(raw: unknown): ConversationLlmThreadState {
  if (typeof raw === "string" && raw.trim()) {
    try {
      return normalizeConversationLlmThreadState(JSON.parse(raw));
    } catch {
      return buildSelectionState(null, null, null, null, []);
    }
  }

  if (!raw || typeof raw !== "object") {
    return buildSelectionState(null, null, null, null, []);
  }

  const state = raw as Partial<ConversationLlmThreadState>;
  const selectedBy = state.selectedBy === "auto" || state.selectedBy === "default" || state.selectedBy === "user" || state.selectedBy === "legacy"
    ? state.selectedBy
    : null;

  return {
    activeAgentId: typeof state.activeAgentId === "string" ? state.activeAgentId : null,
    selectedConnectionId: typeof state.selectedConnectionId === "string" ? state.selectedConnectionId : null,
    selectedConnectionLabel: typeof state.selectedConnectionLabel === "string" ? state.selectedConnectionLabel : null,
    selectedProvider: typeof state.selectedProvider === "string" ? state.selectedProvider : null,
    selectedModel: typeof state.selectedModel === "string" ? state.selectedModel : null,
    selectedModelKey: typeof state.selectedModelKey === "string" ? state.selectedModelKey : null,
    selectedLabel: typeof state.selectedLabel === "string" ? state.selectedLabel : null,
    selectedBy,
    reasonSummary: typeof state.reasonSummary === "string" ? state.reasonSummary : null,
    escalationSummary: typeof state.escalationSummary === "string" ? state.escalationSummary : null,
    auditEvents: Array.isArray(state.auditEvents)
      ? clampAuditEvents(
          state.auditEvents.filter((event): event is ConversationLlmAuditEvent => {
            if (!event || typeof event !== "object") return false;
            const audit = event as Partial<ConversationLlmAuditEvent>;
            return (
              (audit.type === "selection" || audit.type === "override" || audit.type === "escalation")
              && typeof audit.at === "string"
              && typeof audit.summary === "string"
              && (audit.selectedBy === "auto" || audit.selectedBy === "default" || audit.selectedBy === "user" || audit.selectedBy === "legacy")
            );
          })
        )
      : [],
  };
}

export function serializeConversationLlmThreadState(state: ConversationLlmThreadState) {
  return JSON.stringify(normalizeConversationLlmThreadState(state));
}

export function getPublicConversationLlmState(state: ConversationLlmThreadState) {
  return {
    activeAgentId: state.activeAgentId,
    selectedModel: state.selectedModel,
    selectedModelKey: state.selectedModelKey,
    selectedLabel: state.selectedLabel,
    selectedProvider: state.selectedProvider,
    selectedBy: state.selectedBy,
    reasonSummary: state.reasonSummary,
    escalationSummary: state.escalationSummary,
    auditEvents: state.auditEvents,
  };
}

function inferSelectionSource(
  config: AgentLlmConfigDocument,
  target: AgentLlmExecutionTarget | null,
  currentSelectedBy: ConversationLlmThreadState["selectedBy"]
): ConversationLlmThreadState["selectedBy"] {
  if (!target) return null;
  if (currentSelectedBy === "auto" || currentSelectedBy === "default" || currentSelectedBy === "legacy") {
    return currentSelectedBy;
  }

  const defaultModelKey = normalizeDefaultModelKey(config, config.routing.defaultModelKey);
  if (defaultModelKey && target.modelKey === defaultModelKey) {
    return "default";
  }

  if (getAgentLlmCatalog(config).some((entry) => entry.key === target.modelKey)) {
    return "auto";
  }

  return "legacy";
}

export function reconcileConversationLlmThreadState(
  config: AgentLlmConfigDocument,
  rawState: unknown
): ConversationLlmThreadState {
  const normalizedState = normalizeConversationLlmThreadState(rawState);
  const currentEntry = findCatalogEntryFromState(config, normalizedState);

  if (currentEntry) {
    const target = buildTargetFromCatalogEntry(currentEntry);
    return buildSelectionState(
      target,
      inferSelectionSource(config, target, normalizedState.selectedBy),
      normalizedState.reasonSummary,
      normalizedState.escalationSummary,
      normalizedState.auditEvents,
      normalizedState.activeAgentId
    );
  }

  const fallbackTarget = getFallbackTarget(config);
  if (!fallbackTarget) {
    return buildSelectionState(null, null, null, null, normalizedState.auditEvents, normalizedState.activeAgentId);
  }

  const selectedBy = inferSelectionSource(config, fallbackTarget, normalizedState.selectedBy);
  const reasonSummary = selectedBy === "default"
    ? `Default model ${fallbackTarget.label} selected for this thread.`
    : selectedBy === "auto"
      ? `${fallbackTarget.label} is the active routed model for this thread.`
      : "Using the configured primary LLM connection for this thread.";

  return buildSelectionState(
    fallbackTarget,
    selectedBy,
    reasonSummary,
    null,
    normalizedState.auditEvents,
    normalizedState.activeAgentId
  );
}

export function applyResolvedThreadModel(
  state: ConversationLlmThreadState,
  resolvedModel: string | null | undefined
): ConversationLlmThreadState {
  const model = resolvedModel?.trim() || state.selectedModel;
  if (!model) return state;

  return {
    ...state,
    selectedModel: model,
    selectedLabel: state.selectedConnectionLabel ? `${model} (${state.selectedConnectionLabel})` : model,
  };
}

export function resolvePrimaryExecutionTarget(config: AgentLlmConfigDocument) {
  return getFallbackTarget(config);
}

export function resolveThreadExecutionTarget(
  config: AgentLlmConfigDocument,
  state: ConversationLlmThreadState
) {
  const currentEntry = findCatalogEntryFromState(config, state);
  return currentEntry ? buildTargetFromCatalogEntry(currentEntry) : getFallbackTarget(config);
}

export function resolveExecutionTargetForConnection(
  config: AgentLlmConfigDocument,
  connectionId: string | null | undefined
) {
  if (!connectionId) return null;

  const connection = config.connections.find((entry) => entry.id === connectionId);
  return connection ? buildTargetFromConnection(connection) : null;
}

export function buildExecutionTargetRuntimeConfig(target: AgentLlmExecutionTarget) {
  return {
    llmProvider: target.provider,
    llmProtocol: target.protocol,
    llmAuthType: target.authType,
    llmApiKey: target.apiKey,
    llmEndpointUrl: target.endpointUrl,
    llmUsername: target.username,
    llmPassword: target.password,
    llmRegion: target.region,
    llmAccessKeyId: target.accessKeyId,
    llmSecretAccessKey: target.secretAccessKey,
    llmModel: target.model,
    llmThinkingMode: target.thinkingMode,
  };
}

export function planConversationLlmSelection(params: {
  config: AgentLlmConfigDocument;
  currentState: ConversationLlmThreadState;
  message: string;
  historyCount: number;
  routingPolicy?: AgentLlmRoutingPolicy;
}): PlannedThreadSelection {
  const config = params.config;
  const currentState = params.currentState;
  const routingPolicy = params.routingPolicy ?? DEFAULT_AGENT_LLM_ROUTING_POLICY;
  const catalog = getAgentLlmCatalog(config);
  const defaultEntry = findCatalogEntry(config, config.routing.defaultModelKey) ?? catalog[0] ?? null;
  const strongestEntry = [...catalog].sort((a, b) => {
    const left = a.strengthScore + a.codingScore;
    const right = b.strengthScore + b.codingScore;
    return right - left;
  })[0] ?? null;
  const currentEntry = findCatalogEntryFromState(config, currentState);

  if (currentEntry) {
    const needs = inferMessageNeeds(params.message, params.historyCount);
    const shouldEscalate =
      config.routing.allowEscalation
      && strongestEntry
      && strongestEntry.key !== currentEntry.key
      && (
        (routingPolicy.codingStrength === "prefer-strong-coding" && needs.coding > 0)
        || (routingPolicy.contextLength === "prefer-long-context-when-needed" && needs.longContext > 0 && strongestEntry.longContext)
        || (routingPolicy.multimodalNeeds === "prefer-multimodal-when-needed" && needs.multimodal > 0 && strongestEntry.multimodal)
        || (routingPolicy.complexity === "prefer-strong" && needs.complexity > 0)
        || needs.deepReasoning
      )
      && (strongestEntry.strengthScore + strongestEntry.codingScore) > (currentEntry.strengthScore + currentEntry.codingScore);

    if (shouldEscalate) {
      const target = buildTargetFromCatalogEntry(strongestEntry);
      const summary = `Escalated from ${currentEntry.label} to ${target.label} for ${needs.summary.join(", ")}.`;
      const auditEvents = [
        ...currentState.auditEvents,
        buildAuditEvent({ type: "escalation", summary, selectedBy: "auto", target }),
      ];
      return {
        target,
        eventType: "escalation",
        state: buildSelectionState(target, "auto", currentState.reasonSummary, summary, auditEvents, currentState.activeAgentId),
      };
    }

    return {
      target: buildTargetFromCatalogEntry(currentEntry),
      eventType: null,
      state: currentState,
    };
  }

  if (catalog.length > 0) {
    const needs = inferMessageNeeds(params.message, params.historyCount);
    let selectedEntry = defaultEntry;
    let selectedBy: ConversationLlmThreadState["selectedBy"] = defaultEntry ? "default" : "auto";

    const preferStrongForComplexity =
      config.routing.autoRoute
      && strongestEntry
      && (
        (routingPolicy.codingStrength === "prefer-strong-coding" && needs.coding > 0)
        || (routingPolicy.contextLength === "prefer-long-context-when-needed" && needs.longContext > 0 && strongestEntry.longContext)
        || (routingPolicy.multimodalNeeds === "prefer-multimodal-when-needed" && needs.multimodal > 0 && strongestEntry.multimodal)
        || (routingPolicy.complexity === "prefer-strong" && (needs.complexity > 0 || needs.deepReasoning))
      )
      && strongestEntry.key !== defaultEntry?.key;

    if (preferStrongForComplexity) {
      selectedEntry = strongestEntry;
      selectedBy = "auto";
    }

    if (routingPolicy.cost === "prefer-lower-cost" || routingPolicy.latency === "prefer-faster") {
      selectedEntry = defaultEntry ?? selectedEntry;
      selectedBy = defaultEntry ? "default" : selectedBy;
    }

    if (!selectedEntry) {
      selectedEntry = strongestEntry;
      selectedBy = "auto";
    }

    const target = selectedEntry ? buildTargetFromCatalogEntry(selectedEntry) : null;
    const summary = target
      ? selectedBy === "default"
        ? `Default model ${target.label} selected for this thread.`
        : `${target.label} auto-routed for ${summarizeNeeds(needs).replace(/^Selected for /, "").replace(/\.$/, "")}.`
      : "No allowed model is configured for this thread.";
    const auditEvents = [
      ...currentState.auditEvents,
      buildAuditEvent({ type: "selection", summary, selectedBy: selectedBy ?? "auto", target }),
    ];

    return {
      target,
      eventType: "selection",
      state: buildSelectionState(target, selectedBy, summary, null, auditEvents, currentState.activeAgentId),
    };
  }

  const fallbackTarget = getFallbackTarget(config);
  const summary = fallbackTarget
    ? "Using the configured primary LLM connection for this thread."
    : "No LLM connection is configured for this agent.";
  const auditEvents = fallbackTarget
    ? [
        ...currentState.auditEvents,
        buildAuditEvent({ type: "selection", summary, selectedBy: "legacy", target: fallbackTarget }),
      ]
    : currentState.auditEvents;

  return {
    target: fallbackTarget,
    eventType: fallbackTarget ? "selection" : null,
    state: buildSelectionState(fallbackTarget, fallbackTarget ? "legacy" : null, summary, null, auditEvents, currentState.activeAgentId),
  };
}
