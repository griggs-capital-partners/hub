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
  evaluateTeamChatRouteParity,
  resolveTeamChatConversationAccessSnapshot,
} = jiti(path.join(__dirname, "..", "src", "lib", "chat.ts"));
const {
  TEAM_CHAT_ROUTE_DIAGNOSTIC_VERSION,
  logTeamChatDetailRouteDiagnostics,
} = jiti(path.join(__dirname, "..", "src", "lib", "chat-route-diagnostics.ts"));

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

function makeMembership(overrides = {}) {
  return {
    userId: overrides.userId ?? "user-1",
    agentId: overrides.agentId ?? null,
    joinedAt: overrides.joinedAt ?? new Date("2026-04-27T12:00:00.000Z"),
    removedAt: overrides.removedAt ?? null,
  };
}

function makeAccessSnapshot(overrides = {}) {
  const conversationId = overrides.conversationId ?? "thread-readable";
  return resolveTeamChatConversationAccessSnapshot({
    conversationId,
    sessionUserId: overrides.sessionUserId ?? "user-1",
    conversation: {
      id: conversationId,
      type: overrides.type ?? "group",
      name: overrides.name ?? "Readable Thread",
      archivedAt: overrides.archivedAt ?? null,
      chatProjectId: overrides.chatProjectId ?? null,
      members: overrides.members ?? [makeMembership({ userId: overrides.sessionUserId ?? "user-1" })],
      _count: { messages: overrides.messageCount ?? 20 },
    },
  });
}

await runTest("exact live fixture equivalent is list-visible and messages-readable", async () => {
  const snapshot = makeAccessSnapshot({
    conversationId: "cmoeojun9000175q05ay279fj",
    sessionUserId: "312235d0-7600-4800-a52c-11d7544e7377",
    name: "z-03 test",
    chatProjectId: null,
    messageCount: 20,
    members: [
      makeMembership({
        userId: "312235d0-7600-4800-a52c-11d7544e7377",
        removedAt: null,
      }),
    ],
  });

  assert.equal(snapshot.conversationExists, true);
  assert.equal(snapshot.archivedAt, null);
  assert.equal(snapshot.projectId, null);
  assert.equal(snapshot.activeMembershipCountForUser, 1);
  assert.deepEqual(snapshot.userMembershipRemovedAt, [null]);
  assert.equal(snapshot.messageCount, 20);
  assert.equal(snapshot.status, 200);
  assert.equal(snapshot.readable, true);
  assert.deepEqual(
    evaluateTeamChatRouteParity({
      listConversationIds: ["cmoeojun9000175q05ay279fj"],
      messageAccessSnapshots: [snapshot],
    })[0].mismatchReason,
    null
  );
});

await runTest("projectless active-member thread with zero messages remains message-readable", async () => {
  const snapshot = makeAccessSnapshot({
    conversationId: "thread-empty",
    chatProjectId: null,
    messageCount: 0,
  });

  assert.equal(snapshot.status, 200);
  assert.equal(snapshot.messageCount, 0);
  assert.equal(snapshot.notFoundReason, null);
});

await runTest("mixed shared and direct-agent threads are message-readable for active user", async () => {
  const mixed = makeAccessSnapshot({
    conversationId: "thread-mixed",
    members: [
      makeMembership({ userId: "user-1" }),
      makeMembership({ userId: "user-2" }),
      makeMembership({ userId: null, agentId: "agent-1" }),
    ],
  });
  const direct = makeAccessSnapshot({
    conversationId: "thread-direct",
    type: "direct_agent",
    members: [
      makeMembership({ userId: "user-1" }),
      makeMembership({ userId: null, agentId: "agent-1" }),
    ],
  });

  assert.equal(mixed.status, 200);
  assert.equal(direct.status, 200);
});

await runTest("removed and archived threads are denied by default", async () => {
  const removed = makeAccessSnapshot({
    conversationId: "thread-removed",
    members: [
      makeMembership({
        userId: "user-1",
        removedAt: new Date("2026-04-27T12:10:00.000Z"),
      }),
    ],
  });
  const archived = makeAccessSnapshot({
    conversationId: "thread-archived",
    archivedAt: new Date("2026-04-27T12:20:00.000Z"),
  });

  assert.equal(removed.status, 404);
  assert.equal(removed.notFoundReason, "user_has_no_active_membership");
  assert.equal(archived.status, 404);
  assert.equal(archived.notFoundReason, "conversation_archived");
});

await runTest("route parity identifies any list-visible id without a readable messages snapshot", async () => {
  const denied = makeAccessSnapshot({
    conversationId: "thread-denied",
    members: [
      makeMembership({
        userId: "user-1",
        removedAt: new Date("2026-04-27T12:10:00.000Z"),
      }),
    ],
  });

  assert.deepEqual(evaluateTeamChatRouteParity({
    listConversationIds: ["thread-denied", "thread-missing-snapshot"],
    messageAccessSnapshots: [denied],
  }), [
    {
      conversationId: "thread-denied",
      readable: false,
      status: 404,
      mismatchReason: "user_has_no_active_membership",
    },
    {
      conversationId: "thread-missing-snapshot",
      readable: false,
      status: null,
      mismatchReason: "missing_messages_access_snapshot",
    },
  ]);
});

await runTest("messages 404 diagnostics include parity fields", async () => {
  const snapshot = makeAccessSnapshot({
    conversationId: "thread-denied",
    members: [
      makeMembership({
        userId: "user-1",
        removedAt: new Date("2026-04-27T12:10:00.000Z"),
      }),
    ],
  });
  const diagnostic = await logTeamChatDetailRouteDiagnostics({
    route: "api/chat/conversations/[id]/messages.GET",
    session: {
      userId: "user-1",
      email: "user-1@example.com",
    },
    conversationId: "thread-denied",
    accessFound: false,
    accessSnapshot: snapshot,
    readableHelperPassed: false,
    postHelperLookupFailed: false,
    routeTopMarkerReached: true,
  });

  assert.equal(diagnostic.diagnosticVersion, TEAM_CHAT_ROUTE_DIAGNOSTIC_VERSION);
  assert.equal(diagnostic.notFoundReason, "user_has_no_active_membership");
  assert.equal(diagnostic.messageCount, 20);
  assert.equal(diagnostic.readableHelperPassed, false);
  assert.equal(diagnostic.postHelperLookupFailed, false);
  assert.equal(diagnostic.routeTopMarkerReached, true);
});

if (failures.length > 0) {
  console.error(`\n${failures.length} test(s) failed.`);
  process.exitCode = 1;
} else {
  console.log(`\n${completed} test(s) passed.`);
}
