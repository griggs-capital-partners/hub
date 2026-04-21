import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";
import {
  RDSClient,
  DescribeDBInstancesCommand,
} from "@aws-sdk/client-rds";

// POST /api/aws/rds/status
// Body: { instances: Array<{ resourceId: string; region?: string }> }
// resourceId may be a DB instance identifier or a full ARN (arn:aws:rds:REGION:ACCOUNT:db:DB-ID)
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
      // Resolve region + DB instance identifier
      let region = linkRegion ?? defaultRegion;
      let dbInstanceId = resourceId;

      if (resourceId.startsWith("arn:")) {
        // arn:aws:rds:REGION:ACCOUNT:db:DB-INSTANCE-ID
        const parts = resourceId.split(":");
        if (parts[3]) region = parts[3];
        // Last segment is the db instance id
        dbInstanceId = parts[parts.length - 1] ?? resourceId;
      }

      const client = new RDSClient({
        region,
        credentials: { accessKeyId, secretAccessKey },
      });

      const resp = await client.send(
        new DescribeDBInstancesCommand({ DBInstanceIdentifier: dbInstanceId })
      );

      const db = resp.DBInstances?.[0] ?? null;

      if (!db) {
        return {
          resourceId,
          region,
          dbInstanceId,
          dbInstanceClass: null,
          engine: null,
          engineVersion: null,
          status: null,
          endpoint: null,
          port: null,
          multiAZ: null,
          availabilityZone: null,
          allocatedStorage: null,
          storageType: null,
          storageEncrypted: null,
          instanceCreateTime: null,
          error: "DB instance not found",
        };
      }

      return {
        resourceId,
        region,
        dbInstanceId: db.DBInstanceIdentifier ?? dbInstanceId,
        dbInstanceClass: db.DBInstanceClass ?? null,
        engine: db.Engine ?? null,
        engineVersion: db.EngineVersion ?? null,
        status: db.DBInstanceStatus ?? null,
        endpoint: db.Endpoint?.Address ?? null,
        port: db.Endpoint?.Port ?? null,
        multiAZ: db.MultiAZ ?? null,
        availabilityZone: db.AvailabilityZone ?? null,
        allocatedStorage: db.AllocatedStorage ?? null,
        storageType: db.StorageType ?? null,
        storageEncrypted: db.StorageEncrypted ?? null,
        instanceCreateTime: db.InstanceCreateTime?.toISOString() ?? null,
      };
    })
  );

  const data = results.map((r, i) =>
    r.status === "fulfilled"
      ? r.value
      : {
          resourceId: instances[i].resourceId,
          region: instances[i].region ?? defaultRegion,
          dbInstanceId: instances[i].resourceId,
          dbInstanceClass: null,
          engine: null,
          engineVersion: null,
          status: null,
          endpoint: null,
          port: null,
          multiAZ: null,
          availabilityZone: null,
          allocatedStorage: null,
          storageType: null,
          storageEncrypted: null,
          instanceCreateTime: null,
          error: (r.reason as Error).message,
        }
  );

  return NextResponse.json({ instances: data });
}
