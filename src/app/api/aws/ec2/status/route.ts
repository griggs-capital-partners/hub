import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";
import { EC2Client, DescribeInstancesCommand } from "@aws-sdk/client-ec2";

// POST /api/aws/ec2/status
// Body: { instances: Array<{ resourceId: string; region?: string }> }
// resourceId may be an instance ID (i-0abc123) or a full ARN (arn:aws:ec2:REGION:ACCOUNT:instance/i-0abc123)
export async function POST(req: Request) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const awsAccount = await prisma.connectedAccount.findFirst({
    where: { userId: session.user.id, provider: "aws" },
  });

  if (!awsAccount) {
    return NextResponse.json({ error: "AWS not connected" }, { status: 400 });
  }

  const { instances } = (await req.json()) as {
    instances: Array<{ resourceId: string; region?: string | null }>;
  };

  if (!Array.isArray(instances) || instances.length === 0) {
    return NextResponse.json({ instances: [] });
  }

  const accessKeyId = awsAccount.access_token!;
  const secretAccessKey = awsAccount.refresh_token!;
  const defaultRegion = awsAccount.scope ?? "us-east-1";

  const results = await Promise.allSettled(
    instances.map(async ({ resourceId, region: linkRegion }) => {
      // Resolve region: ARN > link override > account default
      let region = linkRegion ?? defaultRegion;
      let instanceId = resourceId;

      if (resourceId.startsWith("arn:")) {
        // arn:aws:ec2:REGION:ACCOUNT:instance/INSTANCE_ID
        const parts = resourceId.split(":");
        if (parts[3]) region = parts[3];
        instanceId = parts[5]?.replace("instance/", "") ?? resourceId;
      }

      const client = new EC2Client({
        region,
        credentials: { accessKeyId, secretAccessKey },
      });

      const resp = await client.send(
        new DescribeInstancesCommand({ InstanceIds: [instanceId] })
      );

      const inst = resp.Reservations?.[0]?.Instances?.[0] ?? null;

      if (!inst) {
        return {
          resourceId,
          region,
          instanceId,
          instanceType: null,
          state: null,
          publicIp: null,
          privateIp: null,
          availabilityZone: null,
          launchTime: null,
          error: "Instance not found",
        };
      }

      return {
        resourceId,
        region,
        instanceId: inst.InstanceId ?? instanceId,
        instanceType: inst.InstanceType ?? null,
        state: inst.State?.Name ?? null,
        publicIp: inst.PublicIpAddress ?? null,
        privateIp: inst.PrivateIpAddress ?? null,
        availabilityZone: inst.Placement?.AvailabilityZone ?? null,
        launchTime: inst.LaunchTime?.toISOString() ?? null,
      };
    })
  );

  const data = results.map((r, i) =>
    r.status === "fulfilled"
      ? r.value
      : {
          resourceId: instances[i].resourceId,
          region: instances[i].region ?? defaultRegion,
          instanceId: instances[i].resourceId,
          instanceType: null,
          state: null,
          publicIp: null,
          privateIp: null,
          availabilityZone: null,
          launchTime: null,
          error: (r.reason as Error).message,
        }
  );

  return NextResponse.json({ instances: data });
}
