import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { AwsIntegrationClient } from "@/components/integrations/AwsIntegrationClient";

export default async function AwsIntegrationPage() {
  const session = await auth();
  if (!session) return null;

  const [awsAccount, repos] = await Promise.all([
    prisma.connectedAccount.findFirst({
      where: { userId: session.user.id, provider: "aws" },
    }),
    prisma.repo.findMany({
      where: { connected: true },
      orderBy: { name: "asc" },
      include: {
        awsLinks: { orderBy: { createdAt: "asc" } },
      },
    }),
  ]);

  // Mask the secret key ID for the client — show first 4 + last 4 chars
  const maskedAccount = awsAccount
    ? {
        accessKeyId:
          awsAccount.providerAccountId.length > 8
            ? `${awsAccount.providerAccountId.slice(0, 4)}...${awsAccount.providerAccountId.slice(-4)}`
            : `${awsAccount.providerAccountId.slice(0, 2)}...`,
        region: awsAccount.scope ?? "us-east-1",
      }
    : null;

  return (
    <AwsIntegrationClient
      awsAccount={maskedAccount}
      repos={repos.map((r) => ({
        id: r.id,
        name: r.name,
        fullName: r.fullName,
        description: r.description,
        language: r.language,
        awsLinks: r.awsLinks.map((l) => ({
          id: l.id,
          repoId: l.repoId,
          service: l.service,
          resourceId: l.resourceId,
          label: l.label,
          region: l.region,
        })),
      }))}
    />
  );
}
