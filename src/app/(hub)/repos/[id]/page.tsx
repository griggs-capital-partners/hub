import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { notFound } from "next/navigation";
import { RepoDetailClient } from "@/components/repos/RepoDetailClient";
import { mapWellToCustomerRef } from "@/lib/well-compat";

export default async function RepoDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await auth();
  const { id } = await params;

  const [repo, users, awsLinks, awsAccount, wells] = await Promise.all([
    prisma.repo.findUnique({ where: { id } }),
    prisma.user.findMany({
      orderBy: { name: "asc" },
      include: {
        connectedAccounts: {
          where: { provider: "github" },
          select: { providerAccountId: true },
        },
      },
    }),
    prisma.repoAwsLink.findMany({
      where: { repoId: id },
      orderBy: { createdAt: "asc" },
    }),
    session
      ? prisma.connectedAccount.findFirst({
          where: { userId: session.user.id, provider: "aws" },
        })
      : null,
    prisma.oilWell.findMany({
      orderBy: { name: "asc" },
      select: { id: true, name: true, status: true, priority: true },
    }),
  ]);

  if (!repo) notFound();

  const usersWithGitHub = users.map((u) => ({
    ...u,
    githubLogin: u.connectedAccounts[0]?.providerAccountId ?? null,
  }));

  return (
    <RepoDetailClient
      repo={repo}
      users={usersWithGitHub}
      customers={wells.map(mapWellToCustomerRef)}
      awsLinks={awsLinks.map((l) => ({
        id: l.id,
        service: l.service,
        resourceId: l.resourceId,
        label: l.label,
        region: l.region,
      }))}
      currentUserId={session?.user.id ?? null}
      isAwsConnected={!!awsAccount}
      awsAccountRegion={awsAccount?.scope ?? null}
    />
  );
}
