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
  buildDirectConversationShortcutMaps,
  directConversationShortcutContainsConversation,
} = jiti(path.join(__dirname, "..", "src", "components", "team", "team-chat-thread-shortcuts.ts"));

function makeConversationMember(overrides = {}) {
  return {
    kind: overrides.kind ?? "user",
    id: overrides.id ?? "user-2",
    name: overrides.name ?? "Teammate",
    image: overrides.image ?? null,
    role: overrides.role,
    email: overrides.email,
    lastSeen: overrides.lastSeen,
    status: overrides.status,
    llmModel: overrides.llmModel,
    llmThinkingMode: overrides.llmThinkingMode,
    llmStatus: overrides.llmStatus,
    llmLastCheckedAt: overrides.llmLastCheckedAt,
    llmLastError: overrides.llmLastError,
    membership: {
      id: overrides.membershipId ?? `member-${overrides.id ?? "user-2"}`,
      joinedAt: overrides.joinedAt ?? "2026-01-01T00:00:00.000Z",
      removedAt: null,
      isActive: true,
    },
  };
}

function makeConversation(overrides = {}) {
  return {
    id: overrides.id ?? "thread-1",
    type: overrides.type ?? "direct",
    name: overrides.name ?? null,
    project: overrides.project ?? null,
    llmThread: overrides.llmThread ?? null,
    createdAt: overrides.createdAt ?? "2026-01-01T00:00:00.000Z",
    updatedAt: overrides.updatedAt ?? "2026-01-02T00:00:00.000Z",
    members: overrides.members ?? [],
    latestMessage: overrides.latestMessage ?? null,
    documents: overrides.documents ?? [],
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

await runTest("shortcut maps keep duplicate human direct threads visible by conversation id", async () => {
  const currentUserId = "user-1";
  const self = makeConversationMember({ id: currentUserId, name: "You" });
  const teammate = makeConversationMember({ id: "user-2", name: "Grace" });

  const olderConversation = makeConversation({
    id: "thread-older",
    updatedAt: "2026-01-02T00:00:00.000Z",
    latestMessage: {
      id: "msg-1",
      body: "Older thread",
      createdAt: "2026-01-02T00:00:00.000Z",
      sender: { kind: "user", id: "user-2", name: "Grace", image: null },
    },
    members: [self, teammate],
  });

  const newerConversation = makeConversation({
    id: "thread-newer",
    updatedAt: "2026-01-03T00:00:00.000Z",
    latestMessage: {
      id: "msg-2",
      body: "Newer thread",
      createdAt: "2026-01-03T00:00:00.000Z",
      sender: { kind: "user", id: "user-2", name: "Grace", image: null },
    },
    members: [self, teammate],
  });

  const { userShortcuts } = buildDirectConversationShortcutMaps(
    [olderConversation, newerConversation],
    currentUserId
  );

  const shortcut = userShortcuts.get("user-2");
  assert.ok(shortcut);
  assert.equal(shortcut.recentConversation.id, "thread-newer");
  assert.deepEqual(shortcut.conversationIds, ["thread-newer", "thread-older"]);
  assert.equal(directConversationShortcutContainsConversation(shortcut, "thread-older"), true);
  assert.equal(directConversationShortcutContainsConversation(shortcut, "thread-newer"), true);
});

await runTest("shortcut maps keep agent direct threads separate from human shortcuts", async () => {
  const currentUserId = "user-1";
  const self = makeConversationMember({ id: currentUserId, name: "You" });
  const teammate = makeConversationMember({ id: "user-2", name: "Grace" });
  const agent = makeConversationMember({
    kind: "agent",
    id: "agent-1",
    name: "Atlas",
    role: "assistant",
    status: "online",
    llmStatus: "online",
  });

  const humanConversation = makeConversation({
    id: "thread-human",
    updatedAt: "2026-01-03T00:00:00.000Z",
    members: [self, teammate],
  });

  const agentConversation = makeConversation({
    id: "thread-agent",
    updatedAt: "2026-01-04T00:00:00.000Z",
    members: [self, agent],
  });

  const { userShortcuts, agentShortcuts } = buildDirectConversationShortcutMaps(
    [humanConversation, agentConversation],
    currentUserId
  );

  assert.equal(userShortcuts.get("user-2")?.recentConversation.id, "thread-human");
  assert.equal(agentShortcuts.get("agent-1")?.recentConversation.id, "thread-agent");
  assert.equal(userShortcuts.has("agent-1"), false);
  assert.equal(agentShortcuts.has("user-2"), false);
});

await runTest("non-direct threads do not become counterpart shortcuts", async () => {
  const currentUserId = "user-1";
  const self = makeConversationMember({ id: currentUserId, name: "You" });
  const teammate = makeConversationMember({ id: "user-2", name: "Grace" });
  const groupConversation = makeConversation({
    id: "thread-group",
    type: "group",
    members: [self, teammate],
  });

  const { userShortcuts, agentShortcuts } = buildDirectConversationShortcutMaps(
    [groupConversation],
    currentUserId
  );

  assert.equal(userShortcuts.size, 0);
  assert.equal(agentShortcuts.size, 0);
});

if (failures.length > 0) {
  console.error(`\n${failures.length} test(s) failed.`);
  process.exitCode = 1;
} else {
  console.log(`\n${completed} test(s) passed.`);
}
