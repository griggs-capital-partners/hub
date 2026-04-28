import type {
  AgentLlmConnectionProtocol,
  AgentLlmProvider,
} from "./agent-llm-config";
import {
  CONTEXT_BUDGET_MODES,
  DEFAULT_CONTEXT_PROMPT_CACHE_STRATEGY,
  type ContextBudgetMode,
  type ContextCompactionStrategy,
  type ContextPromptCacheStrategy,
} from "./context-token-budget";
import { CHAT_REPLY_MAX_OUTPUT_TOKENS } from "./chat-runtime-budgets";

type BudgetProfileProvider = AgentLlmProvider | "unknown";

export type ModelBudgetProfileLookup = {
  provider?: string | null;
  protocol?: string | null;
  model?: string | null;
};

export type ModelBudgetProfile = {
  id: string;
  label: string;
  matchDescription: string;
  providers?: BudgetProfileProvider[];
  protocols?: AgentLlmConnectionProtocol[];
  modelPattern?: RegExp;
  maxContextTokens: number;
  maxOutputTokens: number;
  reservedSystemPromptTokens: number;
  reservedResponseTokens: number;
  standardContextBudgetTokens: number;
  deepContextBudgetTokens: number;
  auditContextBudgetTokens: number;
  asyncDeepWorkContextBudgetTokens: number;
  budgetModeDefaults: Record<ContextBudgetMode, ModelBudgetModeDefault>;
  notes: string;
};

export type ModelBudgetModeDefault = {
  mode: ContextBudgetMode;
  contextBudgetTokens: number;
  maxOutputTokens: number;
  compactionStrategies: ContextCompactionStrategy[];
  promptCache: ContextPromptCacheStrategy;
};

function normalizeProvider(value: string | null | undefined): BudgetProfileProvider {
  if (value === "local" || value === "openai" || value === "anthropic" || value === "bedrock") {
    return value;
  }

  return "unknown";
}

function normalizeProtocol(value: string | null | undefined) {
  if (value === "auto" || value === "ollama" || value === "openai-compatible") {
    return value;
  }

  return null;
}

function normalizeModel(value: string | null | undefined) {
  return value?.trim().toLowerCase() ?? "";
}

function buildProfile(
  profile: Omit<
    ModelBudgetProfile,
    | "maxOutputTokens"
    | "reservedResponseTokens"
    | "auditContextBudgetTokens"
    | "asyncDeepWorkContextBudgetTokens"
    | "budgetModeDefaults"
  > & {
    maxOutputTokens?: number;
    reservedResponseTokens?: number;
    auditContextBudgetTokens?: number;
    asyncDeepWorkContextBudgetTokens?: number;
  }
) {
  const completedProfile = {
    ...profile,
    maxOutputTokens: profile.maxOutputTokens ?? CHAT_REPLY_MAX_OUTPUT_TOKENS,
    reservedResponseTokens:
      profile.reservedResponseTokens ?? profile.maxOutputTokens ?? CHAT_REPLY_MAX_OUTPUT_TOKENS,
    auditContextBudgetTokens: profile.auditContextBudgetTokens ?? profile.deepContextBudgetTokens,
    asyncDeepWorkContextBudgetTokens:
      profile.asyncDeepWorkContextBudgetTokens ?? profile.deepContextBudgetTokens,
  };

  return {
    ...completedProfile,
    budgetModeDefaults: buildBudgetModeDefaults(completedProfile),
  } satisfies ModelBudgetProfile;
}

function compactionStrategiesForMode(mode: ContextBudgetMode): ContextCompactionStrategy[] {
  if (mode === "standard") {
    return ["artifact_first", "deterministic_pack", "cache_reuse_candidate"];
  }
  if (mode === "async_deep_work") {
    return ["artifact_first", "summary_then_excerpt", "deterministic_pack", "defer_to_async"];
  }
  return ["artifact_first", "summary_then_excerpt", "deterministic_pack", "cache_reuse_candidate"];
}

function buildBudgetModeDefaults(profile: {
  maxOutputTokens: number;
  standardContextBudgetTokens: number;
  deepContextBudgetTokens: number;
  auditContextBudgetTokens: number;
  asyncDeepWorkContextBudgetTokens: number;
}) {
  return CONTEXT_BUDGET_MODES.reduce<Record<ContextBudgetMode, ModelBudgetModeDefault>>(
    (defaults, mode) => {
      defaults[mode] = {
        mode,
        contextBudgetTokens: contextBudgetForMode(profile, mode),
        maxOutputTokens: profile.maxOutputTokens,
        compactionStrategies: compactionStrategiesForMode(mode),
        promptCache: DEFAULT_CONTEXT_PROMPT_CACHE_STRATEGY,
      };
      return defaults;
    },
    {} as Record<ContextBudgetMode, ModelBudgetModeDefault>
  );
}

function contextBudgetForMode(
  profile: Pick<
    ModelBudgetProfile,
    | "standardContextBudgetTokens"
    | "deepContextBudgetTokens"
    | "auditContextBudgetTokens"
    | "asyncDeepWorkContextBudgetTokens"
  >,
  mode: ContextBudgetMode
) {
  if (mode === "deep") return profile.deepContextBudgetTokens;
  if (mode === "audit") return profile.auditContextBudgetTokens;
  if (mode === "async_deep_work") return profile.asyncDeepWorkContextBudgetTokens;
  return profile.standardContextBudgetTokens;
}

export const MODEL_BUDGET_PROFILES = [
  buildProfile({
    id: "bedrock-anthropic-style-conservative",
    label: "Bedrock Anthropic-style conservative profile",
    matchDescription: "provider=bedrock",
    providers: ["bedrock"],
    maxContextTokens: 32_768,
    reservedSystemPromptTokens: 4_096,
    standardContextBudgetTokens: 12_000,
    deepContextBudgetTokens: 20_000,
    notes:
      "Current Bedrock runtime uses the Converse API with Anthropic-style message shaping. Budgets stay conservative until exact per-model tokenizer support is wired.",
  }),
  buildProfile({
    id: "anthropic-direct-conservative",
    label: "Anthropic direct conservative profile",
    matchDescription: "provider=anthropic",
    providers: ["anthropic"],
    maxContextTokens: 32_768,
    reservedSystemPromptTokens: 4_096,
    standardContextBudgetTokens: 12_000,
    deepContextBudgetTokens: 20_000,
    notes:
      "Direct Anthropic calls can support larger windows, but this profile intentionally stays below the largest documented limits so A-03a remains safe and reversible.",
  }),
  buildProfile({
    id: "openai-direct-chat-conservative",
    label: "OpenAI chat completions conservative profile",
    matchDescription: "provider=openai",
    providers: ["openai"],
    maxContextTokens: 16_384,
    reservedSystemPromptTokens: 2_048,
    standardContextBudgetTokens: 6_000,
    deepContextBudgetTokens: 8_000,
    notes:
      "Used for the direct OpenAI chat-completions path. Limits are conservative because exact per-model context windows vary by selected model.",
  }),
  buildProfile({
    id: "openai-compatible-chat-conservative",
    label: "OpenAI-compatible chat conservative profile",
    matchDescription: "protocol=openai-compatible",
    protocols: ["openai-compatible"],
    maxContextTokens: 16_384,
    reservedSystemPromptTokens: 2_048,
    standardContextBudgetTokens: 6_000,
    deepContextBudgetTokens: 8_000,
    notes:
      "Used for custom endpoints speaking the chat-completions protocol. Budgets stay below common 16K-class windows because exact backend limits are not discoverable yet.",
  }),
  buildProfile({
    id: "fallback-default-conservative",
    label: "Fallback default conservative profile",
    matchDescription: "provider=local|unknown fallback",
    providers: ["local", "unknown"],
    maxContextTokens: 8_192,
    reservedSystemPromptTokens: 1_024,
    standardContextBudgetTokens: 1_500,
    deepContextBudgetTokens: 2_500,
    notes:
      "Fallback for unresolved or local custom runtimes where the real context window is unknown. This is intentionally small to prevent uncontrolled prompt growth.",
  }),
] as const satisfies ReadonlyArray<ModelBudgetProfile>;

export const DEFAULT_MODEL_BUDGET_PROFILE =
  MODEL_BUDGET_PROFILES[MODEL_BUDGET_PROFILES.length - 1];

function matchesProfile(
  profile: ModelBudgetProfile,
  lookup: Required<Pick<ModelBudgetProfileLookup, "provider" | "protocol" | "model">>
) {
  const provider = normalizeProvider(lookup.provider);
  const protocol = normalizeProtocol(lookup.protocol);
  const model = normalizeModel(lookup.model);

  if (profile.providers && !profile.providers.includes(provider)) {
    return false;
  }

  if (profile.protocols && (!protocol || !profile.protocols.includes(protocol))) {
    return false;
  }

  if (profile.modelPattern && !profile.modelPattern.test(model)) {
    return false;
  }

  return true;
}

export function resolveModelBudgetProfile(
  lookup: ModelBudgetProfileLookup
): ModelBudgetProfile {
  const normalizedLookup = {
    provider: lookup.provider ?? null,
    protocol: lookup.protocol ?? null,
    model: lookup.model ?? null,
  };

  return (
    MODEL_BUDGET_PROFILES.find((profile) => matchesProfile(profile, normalizedLookup)) ??
    DEFAULT_MODEL_BUDGET_PROFILE
  );
}

export function resolveContextBudgetTokens(
  profile: ModelBudgetProfile,
  mode: ContextBudgetMode = "standard"
) {
  const requestedBudget = contextBudgetForMode(profile, mode);
  const safeCeiling = Math.max(
    0,
    profile.maxContextTokens -
      profile.reservedSystemPromptTokens -
      profile.reservedResponseTokens
  );

  return Math.min(requestedBudget, safeCeiling);
}

export function resolveModelBudgetModeDefault(
  profile: ModelBudgetProfile,
  mode: ContextBudgetMode = "standard"
) {
  return {
    ...profile.budgetModeDefaults[mode],
    contextBudgetTokens: resolveContextBudgetTokens(profile, mode),
  } satisfies ModelBudgetModeDefault;
}

export function resolveModelBudgetModeDefaults(profile: ModelBudgetProfile) {
  return CONTEXT_BUDGET_MODES.reduce<Record<ContextBudgetMode, ModelBudgetModeDefault>>(
    (defaults, mode) => {
      defaults[mode] = resolveModelBudgetModeDefault(profile, mode);
      return defaults;
    },
    {} as Record<ContextBudgetMode, ModelBudgetModeDefault>
  );
}

export function resolveModelContextBudget(params: {
  lookup: ModelBudgetProfileLookup;
  mode?: ContextBudgetMode;
}) {
  const profile = resolveModelBudgetProfile(params.lookup);

  return {
    profile,
    mode: params.mode ?? "standard",
    contextBudgetTokens: resolveContextBudgetTokens(profile, params.mode),
    budgetModeDefault: resolveModelBudgetModeDefault(profile, params.mode ?? "standard"),
  };
}
