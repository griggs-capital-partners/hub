import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";
import {
  AmplifyClient,
  GetAppCommand,
  ListBranchesCommand,
  ListJobsCommand,
  ListDomainAssociationsCommand,
} from "@aws-sdk/client-amplify";

// POST /api/aws/amplify/status
// Body: { arns: string[] }   (Amplify app ARNs like arn:aws:amplify:us-east-1:xxx:apps/yyy)
export async function POST(req: Request) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const awsAccount = await prisma.connectedAccount.findFirst({
    where: { userId: session.user.id, provider: "aws" },
  });

  if (!awsAccount) {
    return NextResponse.json({ error: "AWS not connected" }, { status: 400 });
  }

  const { arns } = (await req.json()) as { arns: string[] };
  if (!Array.isArray(arns) || arns.length === 0) {
    return NextResponse.json({ apps: [] });
  }

  const accessKeyId = awsAccount.access_token!;
  const secretAccessKey = awsAccount.refresh_token!;
  const defaultRegion = awsAccount.scope ?? "us-east-1";

  const results = await Promise.allSettled(
    arns.map(async (arn) => {
      // Parse region and appId from ARN: arn:aws:amplify:REGION:ACCOUNT:apps/APP_ID
      const parts = arn.split(":");
      const region = parts[3] || defaultRegion;
      const appId = parts[5]?.replace("apps/", "") ?? "";

      if (!appId) throw new Error(`Invalid ARN: ${arn}`);

      const client = new AmplifyClient({
        region,
        credentials: { accessKeyId, secretAccessKey },
      });

      const [appResp, branchResp, domainResp] = await Promise.allSettled([
        client.send(new GetAppCommand({ appId })),
        client.send(new ListBranchesCommand({ appId })),
        client.send(new ListDomainAssociationsCommand({ appId })),
      ]);

      const app = appResp.status === "fulfilled" ? appResp.value.app : null;
      const branches = branchResp.status === "fulfilled" ? branchResp.value.branches ?? [] : [];
      const domains = domainResp.status === "fulfilled" ? domainResp.value.domainAssociations ?? [] : [];

      // Find prod branch details (if any)
      const prodBranchName = app?.productionBranch?.branchName ?? branches[0]?.branchName ?? null;
      const prodBranch = branches.find((b) => b.branchName === prodBranchName) ?? branches[0] ?? null;

      // Get latest job status + jobId for the prod branch
      let jobStatus: string | null = app?.productionBranch?.status ?? null;
      let lastJobId: string | null = null;
      if (prodBranchName) {
        const jobsResp = await client.send(
          new ListJobsCommand({ appId, branchName: prodBranchName, maxResults: 1 })
        ).catch(() => null);
        const latestJob = jobsResp?.jobSummaries?.[0];
        if (latestJob?.status) jobStatus = latestJob.status;
        if (latestJob?.jobId) lastJobId = latestJob.jobId;
      }

      // Resolve custom domain URL — prefer an AVAILABLE domain whose subdomain
      // Resolve custom domain — prefer verified subdomain matching the prod branch
      // or root/www, but fall back to any verified subdomain on an AVAILABLE domain.
      let customDomain: string | null = null;
      let fallbackDomain: string | null = null;
      const activeDomains = domains.filter((d) => d.domainStatus === "AVAILABLE");
      outer: for (const d of activeDomains) {
        for (const sub of d.subDomains ?? []) {
          const prefix = sub.subDomainSetting?.prefix ?? "";
          if (!sub.verified) {
            // Keep as fallback even if not verified, just in case
            if (!fallbackDomain) {
              const host = prefix ? `${prefix}.${d.domainName}` : d.domainName!;
              fallbackDomain = `https://${host}`;
            }
            continue;
          }
          const host = prefix ? `${prefix}.${d.domainName}` : d.domainName!;
          const isPrimary =
            prefix === prodBranchName || prefix === "" || prefix === "www";
          if (isPrimary) {
            customDomain = `https://${host}`;
            break outer;
          }
          // Any other verified subdomain — save as fallback and keep looking
          if (!fallbackDomain) fallbackDomain = `https://${host}`;
        }
      }
      if (!customDomain) customDomain = fallbackDomain;

      return {
        arn,
        appId,
        region,
        name: app?.name ?? null,
        description: app?.description ?? null,
        defaultDomain: app?.defaultDomain ?? null,
        customDomain,
        repository: app?.repository ?? null,
        platform: app?.platform ?? null,
        createTime: app?.createTime?.toISOString() ?? null,
        updateTime: app?.updateTime?.toISOString() ?? null,
        productionBranch: {
          branchName: prodBranchName,
          status: jobStatus,
          lastDeployTime: app?.productionBranch?.lastDeployTime?.toISOString() ?? null,
          lastJobId,
        },
        framework: prodBranch?.framework ?? null,
        totalJobs: prodBranch?.totalNumberOfJobs ?? null,
        enableAutoBuild: prodBranch?.enableAutoBuild ?? null,
      };
    })
  );

  const apps = results.map((r, i) =>
    r.status === "fulfilled"
      ? r.value
      : { arn: arns[i], appId: null, error: (r.reason as Error).message }
  );

  return NextResponse.json({ apps });
}
