import path from "node:path";
import { fileURLToPath } from "node:url";
import createJiti from "jiti";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.join(__dirname, "..");

const jiti = createJiti(import.meta.url, {
  moduleCache: false,
  alias: {
    "@/": `${path.join(repoRoot, "src").replace(/\\/g, "/")}/`,
  },
});

const {
  evaluateTeamChatRouteParity,
  getTeamChatConversationAccessSnapshot,
  listConversationsForUser,
} = jiti(path.join(repoRoot, "src", "lib", "chat.ts"));
const { prisma } = jiti(path.join(repoRoot, "src", "lib", "prisma.ts"));
const { getSanitizedDatabaseTarget } = jiti(path.join(repoRoot, "src", "lib", "runtime-diagnostics.ts"));

function readArg(name) {
  const prefix = `--${name}=`;
  const inline = process.argv.find((arg) => arg.startsWith(prefix));
  if (inline) {
    return inline.slice(prefix.length);
  }

  const index = process.argv.indexOf(`--${name}`);
  return index >= 0 ? process.argv[index + 1] : null;
}

const userIdArg = readArg("userId");
const userEmailArg = readArg("email");
const conversationId = readArg("conversationId");

if (!userIdArg && !userEmailArg) {
  console.error("Usage: node scripts/check-team-chat-route-parity.mjs --userId <id> [--conversationId <id>]");
  console.error("   or: node scripts/check-team-chat-route-parity.mjs --email <email> [--conversationId <id>]");
  process.exit(1);
}

try {
  const user = userIdArg
    ? { id: userIdArg, email: userEmailArg ?? null }
    : await prisma.user.findUnique({
        where: { email: userEmailArg },
        select: { id: true, email: true },
      });

  if (!user?.id) {
    throw new Error(`No user found for ${userEmailArg ?? userIdArg}`);
  }

  const listVisibleConversations = await listConversationsForUser(user.id);
  const listConversationIds = conversationId
    ? listVisibleConversations
        .filter((conversation) => conversation.id === conversationId)
        .map((conversation) => conversation.id)
    : listVisibleConversations.map((conversation) => conversation.id);
  const targetConversationIds = conversationId
    ? [conversationId]
    : listConversationIds;
  const messageAccessSnapshots = await Promise.all(
    targetConversationIds.map((id) => (
      getTeamChatConversationAccessSnapshot({
        conversationId: id,
        sessionUserId: user.id,
      })
    ))
  );
  const parity = evaluateTeamChatRouteParity({
    listConversationIds,
    messageAccessSnapshots,
  });

  console.log(JSON.stringify({
    dbTarget: getSanitizedDatabaseTarget(),
    userId: user.id,
    userEmail: user.email ?? userEmailArg ?? null,
    requestedConversationId: conversationId ?? null,
    listReturnedConversationCount: listVisibleConversations.length,
    listIncludesRequestedConversation: conversationId
      ? listVisibleConversations.some((conversation) => conversation.id === conversationId)
      : null,
    messageAccessSnapshots,
    parity,
  }, null, 2));
} finally {
  await prisma.$disconnect();
}
