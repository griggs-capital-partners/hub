import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";
import {
  ECSClient,
  DescribeContainerInstancesCommand,
} from "@aws-sdk/client-ecs";

// POST /api/aws/ecs/instance-status
// Body: { instances: Array<{ resourceId: string; region?: string | null }> }
// resourceId: ECS container instance ARN
// Supports both new format: arn:aws:ecs:REGION:ACCOUNT:container-instance/CLUSTER/INSTANCE_ID
// and old format:           arn:aws:ecs:REGION:ACCOUNT:container-instance/INSTANCE_ID
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
    instances?: Array<{ resourceId: string; region?: string | null }>;
    arns?: string[]; // legacy
  };

  const inputs: Array<{ resourceId: string; region?: string | null }> =
    body.instances ?? (body.arns ?? []).map((arn) => ({ resourceId: arn }));

  if (inputs.length === 0) {
    return NextResponse.json({ instances: [] });
  }

  const accessKeyId = awsAccount.access_token!;
  const secretAccessKey = awsAccount.refresh_token!;
  const defaultRegion = awsAccount.scope ?? "us-east-1";

  const results = await Promise.allSettled(
    inputs.map(async ({ resourceId: arn, region: linkRegion }) => {
      // Parse: arn:aws:ecs:REGION:ACCOUNT:container-instance/CLUSTER/ID  (new)
      //    or: arn:aws:ecs:REGION:ACCOUNT:container-instance/ID          (old)
      const parts = arn.split(":");
      const arnRegion = parts[3] || null;
      const region = linkRegion || arnRegion || defaultRegion;
      const resourceParts = (parts[5] ?? "").split("/");
      // resourceParts[0] = "container-instance"
      // new format: [container-instance, CLUSTER, ID]
      // old format: [container-instance, ID]
      const clusterName = resourceParts.length >= 3 ? resourceParts[1] : "default";

      const client = new ECSClient({
        region,
        credentials: { accessKeyId, secretAccessKey },
      });

      const resp = await client.send(
        new DescribeContainerInstancesCommand({
          cluster: clusterName,
          containerInstances: [arn],
        })
      );

      const inst = resp.containerInstances?.[0] ?? null;
      if (!inst) {
        return {
          arn,
          region,
          clusterName,
          ec2InstanceId: null,
          status: null,
          runningTasksCount: 0,
          pendingTasksCount: 0,
          agentConnected: false,
          remainingCpu: null,
          remainingMemory: null,
          registeredCpu: null,
          registeredMemory: null,
          error: "Instance not found",
        };
      }

      const remainingCpu = inst.remainingResources?.find((r) => r.name === "CPU")?.integerValue ?? null;
      const remainingMemory = inst.remainingResources?.find((r) => r.name === "MEMORY")?.integerValue ?? null;
      const registeredCpu = inst.registeredResources?.find((r) => r.name === "CPU")?.integerValue ?? null;
      const registeredMemory = inst.registeredResources?.find((r) => r.name === "MEMORY")?.integerValue ?? null;

      return {
        arn,
        region,
        clusterName,
        ec2InstanceId: inst.ec2InstanceId ?? null,
        status: inst.status ?? null,
        runningTasksCount: inst.runningTasksCount ?? 0,
        pendingTasksCount: inst.pendingTasksCount ?? 0,
        agentConnected: inst.agentConnected ?? false,
        remainingCpu,
        remainingMemory,
        registeredCpu,
        registeredMemory,
      };
    })
  );

  const instances = results.map((r, i) =>
    r.status === "fulfilled"
      ? r.value
      : {
          arn: inputs[i].resourceId,
          region: inputs[i].region ?? defaultRegion,
          clusterName: null,
          ec2InstanceId: null,
          status: null,
          runningTasksCount: 0,
          pendingTasksCount: 0,
          agentConnected: false,
          remainingCpu: null,
          remainingMemory: null,
          registeredCpu: null,
          registeredMemory: null,
          error: (r.reason as Error).message,
        }
  );

  return NextResponse.json({ instances });
}
