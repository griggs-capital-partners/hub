import { PrismaClient, Prisma } from "@prisma/client";

type TeamInviteRecord = {
  id: string;
  email: string;
};

type UserWriter = PrismaClient | Prisma.TransactionClient;

export function deriveInviteName(email: string) {
  const localPart = email.split("@")[0] ?? email;
  return localPart
    .split(/[._-]+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ") || email;
}

export function inviteUserId(inviteId: string) {
  return `invite:${inviteId}`;
}

export async function ensurePlaceholderUsersForInvites(db: UserWriter, invites: TeamInviteRecord[]) {
  await Promise.all(
    invites.map((invite) =>
      db.user.upsert({
        where: { email: invite.email.toLowerCase() },
        update: {
          name: deriveInviteName(invite.email),
          image: null,
        },
        create: {
          id: inviteUserId(invite.id),
          name: deriveInviteName(invite.email),
          email: invite.email.toLowerCase(),
          image: null,
          role: "member",
        },
      })
    )
  );
}
