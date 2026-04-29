import assert from "node:assert/strict";
import path from "node:path";
import { fileURLToPath } from "node:url";
import createJiti from "jiti";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const jiti = createJiti(import.meta.url, { moduleCache: false });

const {
  buildExecutionTargetRuntimeConfig,
  normalizeAgentLlmConfig,
  planConversationLlmSelection,
} = jiti(path.join(__dirname, "..", "src", "lib", "agent-llm-config.ts"));

const emptyThreadState = {
  activeAgentId: "agent_1",
  selectedConnectionId: null,
  selectedProvider: null,
  selectedModel: null,
  selectedModelKey: null,
  selectedLabel: null,
  selectedBy: null,
  reasonSummary: null,
  escalationSummary: null,
  auditEvents: [],
};

const config = normalizeAgentLlmConfig({
  version: 1,
  routing: {
    autoRoute: true,
    defaultModelKey: "bedrock_default",
    allowUserOverride: true,
    allowEscalation: true,
  },
  connections: [
    {
      id: "bedrock_default",
      label: "Amazon Bedrock",
      provider: "bedrock",
      enabled: true,
      model: "deepseek.v3.2",
      thinkingMode: "auto",
      connection: {
        protocol: "auto",
        endpointUrl: "",
        region: "us-east-2",
      },
      auth: {
        accessKeyId: "AKIA1234567890123456",
        secretAccessKey: "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMN",
        hasSecretAccessKey: true,
      },
    },
  ],
});

const plan = planConversationLlmSelection({
  config,
  currentState: emptyThreadState,
  message: "hello",
  historyCount: 0,
});

assert.ok(plan.target, "expected a Bedrock execution target");
assert.equal(plan.target.provider, "bedrock");
assert.equal(plan.target.connectionId, "bedrock_default");
assert.equal(plan.target.model, "deepseek.v3.2");
assert.equal(plan.target.region, "us-east-2");

const runtimeConfig = buildExecutionTargetRuntimeConfig(plan.target);
assert.equal(runtimeConfig.llmProvider, "bedrock");
assert.equal(runtimeConfig.llmModel, "deepseek.v3.2");
assert.equal(runtimeConfig.llmRegion, "us-east-2");
assert.equal(runtimeConfig.llmAccessKeyId, "AKIA1234567890123456");
assert.equal(runtimeConfig.llmSecretAccessKey, "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMN");

console.log("ok - Bedrock LLM config resolves to a concrete runtime target");
