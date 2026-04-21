import { notFound, redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { ProfileClient } from "@/components/profile/ProfileClient";
import { ensurePlaceholderUsersForInvites, inviteUserId } from "@/lib/team-invites";

export default async function TeamMemberProfilePage({ params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  const { id: rawId } = await params;
  const id = decodeURIComponent(rawId);

  async function loadProfile(userId: string) {
    return prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        name: true,
        displayName: true,
        email: true,
        image: true,
        role: true,
      },
    });
  }

  let profile = await loadProfile(id);

  if (!profile && id.startsWith("invite:")) {
    const inviteId = id.replace(/^invite:/, "");
    const invite = await prisma.teamInvite.findUnique({
      where: { id: inviteId },
      select: { id: true, email: true, usedAt: true },
    });

    if (invite && !invite.usedAt) {
      await ensurePlaceholderUsersForInvites(prisma, [{ id: invite.id, email: invite.email }]);
      profile = await loadProfile(inviteUserId(invite.id));
    }
  }

  if (!profile) notFound();

  const pendingInvite = profile.id.startsWith("invite:")
    ? await prisma.teamInvite.findUnique({
        where: { id: profile.id.replace(/^invite:/, "") },
        select: { createdAt: true, usedAt: true },
      })
    : null;

  const isInviteProfile = !!pendingInvite && !pendingInvite.usedAt;

  return (
    <ProfileClient
      initialProfile={profile}
      isOwnProfile={profile.id === session.user.id}
      canEdit={profile.id === session.user.id || isInviteProfile}
      mode={isInviteProfile ? "invite" : "member"}
      inviteCreatedAt={isInviteProfile ? pendingInvite.createdAt.toISOString() : null}
    />
  );
}
