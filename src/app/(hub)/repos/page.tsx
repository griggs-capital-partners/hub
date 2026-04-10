import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { ReposClient } from "@/components/repos/ReposClient";

export default async function ReposPage() {
  await auth();

  const [repos, users] = await Promise.all([
    prisma.repo.findMany({
      where: { connected: true },
      orderBy: [{ pushedAt: "desc" }, { updatedAt: "desc" }],
      include: {
        boards: {
          include: {
            columns: {
              include: { cards: { select: { assignees: true } } },
            },
          },
        },
        _count: { select: { awsLinks: true } },
      },
    }),
    prisma.user.findMany({
      select: {
        id: true,
        name: true,
        displayName: true,
        image: true,
        connectedAccounts: {
          where: { provider: "github" },
          select: { providerAccountId: true },
        },
      },
    }),
  ]);

  const teamUsers = users.map((u) => ({
    id: u.id,
    name: u.name,
    displayName: u.displayName,
    image: u.image,
    githubLogin: u.connectedAccounts[0]?.providerAccountId?.toLowerCase() ?? null,
  }));

  return <ReposClient initialRepos={repos} teamUsers={teamUsers} />;
}
