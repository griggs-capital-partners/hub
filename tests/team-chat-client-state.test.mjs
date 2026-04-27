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

const { resolveConversationDetail404State } = jiti(
  path.join(__dirname, "..", "src", "components", "team", "team-chat-client-state.ts")
);

function makeConversation(overrides = {}) {
  return {
    id: overrides.id ?? "thread-1",
    type: overrides.type ?? "group",
    name: overrides.name ?? "Thread",
    project: overrides.project ?? null,
    llmThread: overrides.llmThread ?? null,
    createdAt: overrides.createdAt ?? "2026-04-26T00:00:00.000Z",
    updatedAt: overrides.updatedAt ?? "2026-04-26T00:00:00.000Z",
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

await runTest("messages 404 keeps visible conversation when refreshed list still includes it", async () => {
  const thread = makeConversation({ id: "cmodp896a000575bkq7sbx6v5", project: null });
  const resolution = resolveConversationDetail404State({
    conversationId: thread.id,
    currentConversations: [thread],
    refreshedConversations: [thread],
    route: "messages",
  });

  assert.equal(resolution.action, "keep");
  assert.equal(resolution.conversations.some((conversation) => conversation.id === thread.id), true);
  assert.match(resolution.errorMessage, /messages could not be loaded/);
});

await runTest("inspect 404 keeps visible conversation when refreshed list still includes it", async () => {
  const thread = makeConversation({ id: "thread-with-agent" });
  const resolution = resolveConversationDetail404State({
    conversationId: thread.id,
    currentConversations: [thread],
    refreshedConversations: [thread],
    route: "inspect",
  });

  assert.equal(resolution.action, "keep");
  assert.equal(resolution.conversations[0].id, thread.id);
  assert.match(resolution.errorMessage, /inspector could not be loaded/);
});

await runTest("detail 404 removes conversation only when refreshed list no longer includes it", async () => {
  const thread = makeConversation({ id: "removed-thread" });
  const resolution = resolveConversationDetail404State({
    conversationId: thread.id,
    currentConversations: [thread],
    refreshedConversations: [],
    route: "messages",
  });

  assert.equal(resolution.action, "remove");
  assert.deepEqual(resolution.conversations, []);
});

await runTest("detail 404 with failed list verification keeps current rail state", async () => {
  const thread = makeConversation({ id: "thread-unknown" });
  const resolution = resolveConversationDetail404State({
    conversationId: thread.id,
    currentConversations: [thread],
    refreshedConversations: null,
    route: "refresh",
  });

  assert.equal(resolution.action, "unknown");
  assert.equal(resolution.conversations[0].id, thread.id);
});

if (failures.length > 0) {
  console.error(`\n${failures.length} test(s) failed.`);
  process.exitCode = 1;
} else {
  console.log(`\n${completed} test(s) passed.`);
}
