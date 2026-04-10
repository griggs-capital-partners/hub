import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { GitHubIntegrationClient } from "@/components/integrations/GitHubIntegrationClient";

export default async function GitHubIntegrationPage() {
  const session = await auth();
  if (!session) return null;

  const [repos, allUsers, myAccount] = await Promise.all([
    prisma.repo.findMany({
      orderBy: [{ connected: "desc" }, { name: "asc" }],
    }),
    prisma.user.findMany({
      orderBy: { name: "asc" },
      include: {
        connectedAccounts: {
          where: { provider: "github" },
        },
      },
    }),
    prisma.connectedAccount.findFirst({
      where: { userId: session.user.id, provider: "github" },
    }),
  ]);

  return (
    <GitHubIntegrationClient
      initialRepos={repos}
      allUsers={allUsers.map((u) => ({
        id: u.id,
        name: u.name,
        displayName: u.displayName,
        email: u.email,
        image: u.image,
        githubAccount: u.connectedAccounts[0]
          ? {
              providerAccountId: u.connectedAccounts[0].providerAccountId,
              scope: u.connectedAccounts[0].scope,
            }
          : null,
      }))}
      currentUserId={session.user.id}
      myGitHubConnected={!!myAccount}
      myGitHubLogin={myAccount?.providerAccountId ?? null}
    />
  );
}
