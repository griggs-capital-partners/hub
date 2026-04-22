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
  resolveConversationRuntimeState,
  serializeConversation,
  serializeConversationActiveMembership,
} = jiti(path.join(__dirname, "..", "src", "lib", "chat.ts"));

function makeUserConversationMember(overrides = {}) {
  const userId = overrides.userId ?? "user-1";
  return {
    id: overrides.id ?? `member-${userId}`,
    conversationId: overrides.conversationId ?? "thread-1",
    userId,
    agentId: null,
    joinedAt: overrides.joinedAt ?? new Date("2026-01-01T00:00:00.000Z"),
    removedAt: overrides.removedAt ?? null,
    user: {
      id: userId,
      name: overrides.name ?? `User ${userId}`,
      displayName: overrides.displayName ?? null,
      email: overrides.email ?? `${userId}@example.com`,
      image: overrides.image ?? null,
      role: overrides.role ?? "member",
      lastSeen: overrides.lastSeen ?? null,
    },
    agent: null,
  };
}

function makeAgentConversationMember(overrides = {}) {
  const agentId = overrides.agentId ?? "agent-1";
  return {
    id: overrides.id ?? `member-${agentId}`,
    conversationId: overrides.conversationId ?? "thread-1",
    userId: null,
    agentId,
    joinedAt: overrides.joinedAt ?? new Date("2026-01-02T00:00:00.000Z"),
    removedAt: overrides.removedAt ?? null,
    user: null,
    agent: {
      id: agentId,
      name: overrides.name ?? `Agent ${agentId}`,
      description: overrides.description ?? null,
      role: overrides.role ?? "assistant",
      persona: overrides.persona ?? "",
      duties: overrides.duties ?? "",
      avatar: overrides.avatar ?? null,
      status: overrides.status ?? "online",
      llmConfig: overrides.llmConfig ?? null,
      llmEndpointUrl: overrides.llmEndpointUrl ?? `http://localhost/${agentId}`,
      llmUsername: overrides.llmUsername ?? null,
      llmPassword: overrides.llmPassword ?? null,
      llmModel: overrides.llmModel ?? `${agentId}-model`,
      llmThinkingMode: overrides.llmThinkingMode ?? "auto",
      disabledTools: overrides.disabledTools ?? "[]",
      abilities: overrides.abilities ?? [],
      llmStatus: overrides.llmStatus ?? "online",
      llmLastCheckedAt: overrides.llmLastCheckedAt ?? null,
      llmLastError: overrides.llmLastError ?? null,
    },
  };
}

function makeConversation(overrides = {}) {
  return {
    id: overrides.id ?? "thread-1",
    type: overrides.type ?? "group",
    name: overrides.name ?? "Runtime Test Thread",
    chatProject: overrides.chatProject ?? null,
    llmThreadState: overrides.llmThreadState ?? null,
    createdAt: overrides.createdAt ?? new Date("2026-01-01T00:00:00.000Z"),
    updatedAt: overrides.updatedAt ?? new Date("2026-01-03T00:00:00.000Z"),
    messages: overrides.messages ?? [],
    documents: overrides.documents ?? [],
    members: overrides.members ?? [],
  };
}

const failures = [];
let completed = 0;

async function runTest(name, fn) {
  try {
    await fn();
    completed += 1;
    console.log(`ok - ${name}`);
  } catch (error) {
    failures.push({ name, error });
    console.error(`not ok - ${name}`);
    console.error(error instanceof Error ? error.stack ?? error.message : error);
  }
}

await runTest("removed human members are excluded from runtime-active participants", async () => {
  const conversation = makeConversation({
    members: [
      makeUserConversationMember({ userId: "user-1" }),
      makeUserConversationMember({
        userId: "user-2",
        removedAt: new Date("2026-01-04T00:00:00.000Z"),
      }),
      makeAgentConversationMember({ agentId: "agent-1" }),
    ],
  });

  const runtimeState = resolveConversationRuntimeState(conversation);
  const serialized = serializeConversation(conversation);

  assert.deepEqual(runtimeState.activeUserIds, ["user-1"]);
  assert.deepEqual(
    serialized.members.map((member) => member.id),
    ["user-1", "agent-1"]
  );
});

await runTest("removed agents cannot remain the active replying agent", async () => {
  const conversation = makeConversation({
    llmThreadState: {
      activeAgentId: "agent-removed",
      selectedConnectionId: "removed-connection",
      selectedConnectionLabel: "Removed Connection",
      selectedProvider: "local",
      selectedModel: "removed-model",
      selectedModelKey: "removed-key",
      selectedLabel: "removed-model (Removed Connection)",
      selectedBy: "user",
      reasonSummary: "Pinned earlier.",
      escalationSummary: null,
      auditEvents: [],
    },
    members: [
      makeUserConversationMember({ userId: "user-1" }),
      makeAgentConversationMember({
        agentId: "agent-removed",
        llmModel: "removed-model",
        removedAt: new Date("2026-01-05T00:00:00.000Z"),
      }),
      makeAgentConversationMember({
        agentId: "agent-live",
        llmModel: "live-model",
        llmEndpointUrl: "http://localhost/agent-live",
      }),
    ],
  });

  const runtimeState = resolveConversationRuntimeState(conversation);
  const membership = serializeConversationActiveMembership(conversation);
  const serialized = serializeConversation(conversation);

  assert.equal(runtimeState.activeAgentMember?.agent.id, "agent-live");
  assert.equal(runtimeState.threadLlmState.activeAgentId, null);
  assert.equal(runtimeState.hadInactivePinnedActiveAgent, true);
  assert.equal(membership.activeAgentId, "agent-live");
  assert.equal(membership.hadInactivePinnedActiveAgent, true);
  assert.equal(serialized.llmThread.activeAgentId, null);
});

await runTest("fallback runtime agent selection only uses active agent memberships", async () => {
  const conversation = makeConversation({
    members: [
      makeUserConversationMember({ userId: "user-1" }),
      makeAgentConversationMember({
        agentId: "agent-removed",
        joinedAt: new Date("2026-01-02T00:00:00.000Z"),
        removedAt: new Date("2026-01-06T00:00:00.000Z"),
      }),
      makeAgentConversationMember({
        agentId: "agent-active-1",
        joinedAt: new Date("2026-01-03T00:00:00.000Z"),
      }),
      makeAgentConversationMember({
        agentId: "agent-active-2",
        joinedAt: new Date("2026-01-04T00:00:00.000Z"),
      }),
    ],
  });

  const runtimeState = resolveConversationRuntimeState(conversation);

  assert.deepEqual(runtimeState.activeAgentIds, ["agent-active-1", "agent-active-2"]);
  assert.equal(runtimeState.activeAgentMember?.agent.id, "agent-active-1");
});

await runTest("inspect membership snapshots reflect authoritative active membership", async () => {
  const conversation = makeConversation({
    llmThreadState: {
      activeAgentId: "agent-removed",
      selectedConnectionId: "removed-connection",
      selectedConnectionLabel: "Removed Connection",
      selectedProvider: "local",
      selectedModel: "removed-model",
      selectedModelKey: "removed-key",
      selectedLabel: "removed-model (Removed Connection)",
      selectedBy: "user",
      reasonSummary: "Pinned earlier.",
      escalationSummary: null,
      auditEvents: [],
    },
    members: [
      makeUserConversationMember({ userId: "user-1" }),
      makeUserConversationMember({
        userId: "user-2",
        removedAt: new Date("2026-01-04T00:00:00.000Z"),
      }),
      makeAgentConversationMember({
        agentId: "agent-removed",
        removedAt: new Date("2026-01-05T00:00:00.000Z"),
      }),
      makeAgentConversationMember({ agentId: "agent-live" }),
    ],
  });

  const membership = serializeConversationActiveMembership(conversation);

  assert.equal(membership.activeCount, 2);
  assert.equal(membership.activeUserCount, 1);
  assert.equal(membership.activeAgentCount, 1);
  assert.equal(membership.activeAgentId, "agent-live");
  assert.equal(membership.hadInactivePinnedActiveAgent, true);
  assert.deepEqual(
    membership.participants.map((member) => member.id),
    ["user-1", "agent-live"]
  );
  assert.ok(membership.participants.every((member) => member.membership?.isActive === true));
});

if (failures.length > 0) {
  console.error(`\n${failures.length} test(s) failed.`);
  process.exitCode = 1;
} else {
  console.log(`\n${completed} test(s) passed.`);
}
