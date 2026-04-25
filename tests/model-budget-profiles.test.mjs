import assert from "node:assert/strict";
import path from "node:path";
import { fileURLToPath } from "node:url";
import createJiti from "jiti";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const jiti = createJiti(import.meta.url, { moduleCache: false });
const { CHAT_REPLY_MAX_OUTPUT_TOKENS } = jiti(
  path.join(__dirname, "..", "src", "lib", "chat-runtime-budgets.ts")
);
const {
  DEFAULT_MODEL_BUDGET_PROFILE,
  resolveContextBudgetTokens,
  resolveModelBudgetProfile,
  resolveModelContextBudget,
} = jiti(path.join(__dirname, "..", "src", "lib", "model-budget-profiles.ts"));

const bedrockProfile = resolveModelBudgetProfile({
  provider: "bedrock",
  model: "anthropic.claude-3-7-sonnet-20250219-v1:0",
});
assert.equal(bedrockProfile.id, "bedrock-anthropic-style-conservative");
assert.equal(bedrockProfile.maxOutputTokens, CHAT_REPLY_MAX_OUTPUT_TOKENS);

const anthropicProfile = resolveModelBudgetProfile({
  provider: "anthropic",
  model: "claude-3-5-sonnet",
});
assert.equal(anthropicProfile.id, "anthropic-direct-conservative");

const openAiProfile = resolveModelBudgetProfile({
  provider: "openai",
  model: "gpt-4.1",
});
assert.equal(openAiProfile.id, "openai-direct-chat-conservative");

const openAiCompatibleProfile = resolveModelBudgetProfile({
  provider: "local",
  protocol: "openai-compatible",
  model: "llama-3.3-70b-instruct",
});
assert.equal(openAiCompatibleProfile.id, "openai-compatible-chat-conservative");

const fallbackProfile = resolveModelBudgetProfile({
  provider: "local",
  protocol: "ollama",
  model: "llama3.2",
});
assert.equal(fallbackProfile.id, DEFAULT_MODEL_BUDGET_PROFILE.id);

const standardBudget = resolveContextBudgetTokens(bedrockProfile, "standard");
const deepBudget = resolveContextBudgetTokens(bedrockProfile, "deep");
assert.ok(deepBudget > standardBudget);
assert.ok(
  deepBudget <=
    bedrockProfile.maxContextTokens -
      bedrockProfile.reservedSystemPromptTokens -
      bedrockProfile.reservedResponseTokens
);

const fallbackBudget = resolveModelContextBudget({
  lookup: { provider: "mystery-provider", model: "unknown" },
});
assert.equal(fallbackBudget.profile.id, DEFAULT_MODEL_BUDGET_PROFILE.id);
assert.equal(fallbackBudget.mode, "standard");
assert.equal(
  fallbackBudget.contextBudgetTokens,
  resolveContextBudgetTokens(DEFAULT_MODEL_BUDGET_PROFILE, "standard")
);

const deepOpenAiBudget = resolveModelContextBudget({
  lookup: { provider: "openai", model: "gpt-4.1" },
  mode: "deep",
});
assert.equal(deepOpenAiBudget.profile.id, "openai-direct-chat-conservative");
assert.equal(deepOpenAiBudget.mode, "deep");
assert.equal(
  deepOpenAiBudget.contextBudgetTokens,
  resolveContextBudgetTokens(openAiProfile, "deep")
);

console.log("ok - model budget profiles resolve conservative provider-aware defaults");
