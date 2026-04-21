import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";
import {
  ECSClient,
  DescribeClustersCommand,
  ListServicesCommand,
  DescribeServicesCommand,
} from "@aws-sdk/client-ecs";

// POST /api/aws/ecs/status
// Body: { clusters: Array<{ resourceId: string; region?: string | null }> }
// resourceId is a cluster ARN (arn:aws:ecs:REGION:ACCOUNT:cluster/NAME) or cluster name.
// region override takes precedence over ARN-parsed region; both fall back to account default.
export async function POST(req: Request) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const awsAccount = await prisma.connectedAccount.findFirst({
    where: { userId: session.user.id, provider: "aws" },
  });

  if (!awsAccount) {
    return NextResponse.json({ error: "AWS not connected" }, { status: 400 });
  }

  const body = await req.json() as {
    clusters?: Array<{ resourceId: string; region?: string | null }>;
    // legacy: plain arns array
    arns?: string[];
  };

  // Support both the new { clusters: [...] } shape and the legacy { arns: [...] } shape
  const inputs: Array<{ resourceId: string; region?: string | null }> =
    body.clusters ??
    (body.arns ?? []).map((arn) => ({ resourceId: arn }));

  if (inputs.length === 0) {
    return NextResponse.json({ clusters: [] });
  }

  const accessKeyId = awsAccount.access_token!;
  const secretAccessKey = awsAccount.refresh_token!;
  const defaultRegion = awsAccount.scope ?? "us-east-1";

  const results = await Promise.allSettled(
    inputs.map(async ({ resourceId, region: linkRegion }) => {
      // Region priority: link override > ARN > account default
      const arnParts = resourceId.split(":");
      const arnRegion = arnParts.length >= 4 ? arnParts[3] : null;
      const region = linkRegion || arnRegion || defaultRegion;
      const clusterName = arnParts[5]?.replace("cluster/", "") ?? resourceId;

      const client = new ECSClient({
        region,
        credentials: { accessKeyId, secretAccessKey },
      });

      // Describe the cluster
      const clusterResp = await client.send(
        new DescribeClustersCommand({ clusters: [resourceId] })
      );
      const cluster = clusterResp.clusters?.[0] ?? null;

      // List and describe services (up to 10)
      let services: {
        serviceName: string | null;
        status: string | null;
        runningCount: number;
        pendingCount: number;
        desiredCount: number;
        taskDefinition: string | null;
        launchType: string | null;
      }[] = [];

      try {
        const listResp = await client.send(
          new ListServicesCommand({ cluster: resourceId, maxResults: 10 })
        );
        const serviceArns = listResp.serviceArns ?? [];

        if (serviceArns.length > 0) {
          const descResp = await client.send(
            new DescribeServicesCommand({ cluster: resourceId, services: serviceArns })
          );
          services = (descResp.services ?? []).map((svc) => ({
            serviceName: svc.serviceName ?? null,
            status: svc.status ?? null,
            runningCount: svc.runningCount ?? 0,
            pendingCount: svc.pendingCount ?? 0,
            desiredCount: svc.desiredCount ?? 0,
            taskDefinition: svc.taskDefinition?.split("/").pop() ?? null,
            launchType: svc.launchType ?? null,
          }));
        }
      } catch {
        // Services are best-effort — don't fail the whole request
      }

      return {
        arn: resourceId,
        clusterName: cluster?.clusterName ?? clusterName,
        region,
        status: cluster?.status ?? null,
        registeredContainerInstancesCount: cluster?.registeredContainerInstancesCount ?? 0,
        runningTasksCount: cluster?.runningTasksCount ?? 0,
        pendingTasksCount: cluster?.pendingTasksCount ?? 0,
        activeServicesCount: cluster?.activeServicesCount ?? 0,
        services,
      };
    })
  );

  const clusters = results.map((r, i) =>
    r.status === "fulfilled"
      ? r.value
      : {
          arn: inputs[i].resourceId,
          clusterName: null,
          region: inputs[i].region ?? defaultRegion,
          status: null,
          registeredContainerInstancesCount: 0,
          runningTasksCount: 0,
          pendingTasksCount: 0,
          activeServicesCount: 0,
          services: [],
          error: (r.reason as Error).message,
        }
  );

  return NextResponse.json({ clusters });
}
