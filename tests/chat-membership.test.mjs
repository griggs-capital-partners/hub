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
  filterActiveConversationMemberships,
  planConversationMembershipMutation,
  serializeConversation,
} = jiti(path.join(__dirname, "..", "src", "lib", "chat.ts"));

function makeMembershipRecord(overrides = {}) {
  return {
    id: overrides.id ?? "member-1",
    conversationId: overrides.conversationId ?? "thread-1",
    userId: overrides.userId ?? null,
    agentId: overrides.agentId ?? null,
    joinedAt: overrides.joinedAt ?? new Date("2026-01-01T00:00:00.000Z"),
    removedAt: overrides.removedAt ?? null,
  };
}

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

await runTest("plans brand new participant additions as creates", async () => {
  const plan = planConversationMembershipMutation({
    members: [
      makeMembershipRecord({
        id: "member-self",
        userId: "user-1",
      }),
    ],
    currentUserId: "user-1",
    addUserIds: ["user-2", "user-2"],
    addAgentIds: ["agent-1"],
    removeUserIds: [],
    removeAgentIds: [],
    currentPinnedActiveAgentId: null,
  });

  assert.deepEqual(plan.createUserIds, ["user-2"]);
  assert.deepEqual(plan.reactivateUserMemberIds, []);
  assert.deepEqual(plan.createAgentIds, ["agent-1"]);
  assert.deepEqual(plan.reactivateAgentMemberIds, []);
  assert.deepEqual(plan.nextActiveUserIds, ["user-1", "user-2"]);
  assert.deepEqual(plan.nextActiveAgentIds, ["agent-1"]);
  assert.equal(plan.nextParticipantCount, 3);
  assert.equal(plan.hasParticipantChanges, true);
});

await runTest("plans active participant removals without deleting historical rows", async () => {
  const plan = planConversationMembershipMutation({
    members: [
      makeMembershipRecord({
        id: "member-self",
        userId: "user-1",
        joinedAt: new Date("2026-01-01T00:00:00.000Z"),
      }),
      makeMembershipRecord({
        id: "member-user-2",
        userId: "user-2",
        joinedAt: new Date("2026-01-02T00:00:00.000Z"),
      }),
      makeMembershipRecord({
        id: "member-agent-1",
        agentId: "agent-1",
        joinedAt: new Date("2026-01-03T00:00:00.000Z"),
      }),
      makeMembershipRecord({
        id: "member-agent-2",
        agentId: "agent-2",
        joinedAt: new Date("2026-01-04T00:00:00.000Z"),
      }),
    ],
    currentUserId: "user-1",
    addUserIds: [],
    addAgentIds: [],
    removeUserIds: ["user-2"],
    removeAgentIds: ["agent-2"],
    currentPinnedActiveAgentId: "agent-1",
  });

  assert.deepEqual(plan.removeUserMemberIds, ["member-user-2"]);
  assert.deepEqual(plan.removeAgentMemberIds, ["member-agent-2"]);
  assert.deepEqual(plan.nextActiveUserIds, ["user-1"]);
  assert.deepEqual(plan.nextActiveAgentIds, ["agent-1"]);
  assert.equal(plan.nextParticipantCount, 2);
});

await runTest("reactivates removed memberships instead of creating duplicates", async () => {
  const plan = planConversationMembershipMutation({
    members: [
      makeMembershipRecord({
        id: "member-self",
        userId: "user-1",
        joinedAt: new Date("2026-01-01T00:00:00.000Z"),
      }),
      makeMembershipRecord({
        id: "member-user-2",
        userId: "user-2",
        joinedAt: new Date("2026-01-02T00:00:00.000Z"),
        removedAt: new Date("2026-02-01T00:00:00.000Z"),
      }),
      makeMembershipRecord({
        id: "member-agent-1",
        agentId: "agent-1",
        joinedAt: new Date("2026-01-03T00:00:00.000Z"),
        removedAt: new Date("2026-02-02T00:00:00.000Z"),
      }),
    ],
    currentUserId: "user-1",
    addUserIds: ["user-2"],
    addAgentIds: ["agent-1"],
    removeUserIds: [],
    removeAgentIds: [],
    currentPinnedActiveAgentId: null,
  });

  assert.deepEqual(plan.createUserIds, []);
  assert.deepEqual(plan.createAgentIds, []);
  assert.deepEqual(plan.reactivateUserMemberIds, ["member-user-2"]);
  assert.deepEqual(plan.reactivateAgentMemberIds, ["member-agent-1"]);
  assert.deepEqual(plan.nextActiveUserIds, ["user-1", "user-2"]);
  assert.deepEqual(plan.nextActiveAgentIds, ["agent-1"]);
  assert.equal(plan.nextParticipantCount, 3);
});

await runTest("filters active members and keeps serialization backward compatible", async () => {
  const conversation = {
    id: "thread-1",
    type: "group",
    name: "Ops",
    chatProject: null,
    llmThreadState: null,
    createdAt: new Date("2026-01-01T00:00:00.000Z"),
    updatedAt: new Date("2026-01-03T00:00:00.000Z"),
    messages: [],
    documents: [],
    members: [
      makeUserConversationMember({
        id: "member-self",
        userId: "user-1",
        name: "Ada",
        joinedAt: new Date("2026-01-01T00:00:00.000Z"),
      }),
      makeUserConversationMember({
        id: "member-removed",
        userId: "user-2",
        name: "Grace",
        joinedAt: new Date("2026-01-02T00:00:00.000Z"),
        removedAt: new Date("2026-01-04T00:00:00.000Z"),
      }),
    ],
  };

  const activeMembers = filterActiveConversationMemberships(conversation.members);
  assert.equal(activeMembers.length, 1);
  assert.equal(activeMembers[0].id, "member-self");

  const serialized = serializeConversation(conversation);
  assert.equal(serialized.members.length, 1);
  assert.deepEqual(serialized.members[0], {
    kind: "user",
    id: "user-1",
    name: "Ada",
    email: "user-1@example.com",
    image: null,
    role: "member",
    lastSeen: null,
    membership: {
      id: "member-self",
      joinedAt: "2026-01-01T00:00:00.000Z",
      removedAt: null,
      isActive: true,
    },
  });
});

await runTest("normalizes pinned active agents when a member agent is removed", async () => {
  const members = [
    makeMembershipRecord({
      id: "member-self",
      userId: "user-1",
      joinedAt: new Date("2026-01-01T00:00:00.000Z"),
    }),
    makeMembershipRecord({
      id: "member-agent-1",
      agentId: "agent-1",
      joinedAt: new Date("2026-01-02T00:00:00.000Z"),
    }),
    makeMembershipRecord({
      id: "member-agent-2",
      agentId: "agent-2",
      joinedAt: new Date("2026-01-03T00:00:00.000Z"),
    }),
  ];

  const withoutReplacement = planConversationMembershipMutation({
    members,
    currentUserId: "user-1",
    addUserIds: [],
    addAgentIds: [],
    removeUserIds: [],
    removeAgentIds: ["agent-1"],
    currentPinnedActiveAgentId: "agent-1",
  });

  assert.equal(withoutReplacement.nextPinnedActiveAgentId, null);

  const withReplacement = planConversationMembershipMutation({
    members,
    currentUserId: "user-1",
    addUserIds: [],
    addAgentIds: [],
    removeUserIds: [],
    removeAgentIds: ["agent-1"],
    requestedActiveAgentId: "agent-2",
    currentPinnedActiveAgentId: "agent-1",
  });

  assert.equal(withReplacement.invalidRequestedActiveAgentId, false);
  assert.equal(withReplacement.nextPinnedActiveAgentId, "agent-2");
});

if (failures.length > 0) {
  console.error(`\n${failures.length} test(s) failed`);
  process.exitCode = 1;
} else {
  console.log(`\n${completed} test(s) passed`);
}
