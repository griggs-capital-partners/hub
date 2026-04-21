import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";
import { AmplifyClient, ListJobsCommand } from "@aws-sdk/client-amplify";

// POST /api/aws/amplify/jobs
// Body: { appId, branchName, region, maxResults? }
export async function POST(req: Request) {
  try {
    const session = await auth();
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const awsAccount = await prisma.connectedAccount.findFirst({
      where: { userId: session.user.id, provider: "aws" },
    });
    if (!awsAccount) return NextResponse.json({ error: "AWS not connected" }, { status: 400 });

    const { appId, branchName, region, maxResults = 25 } = (await req.json()) as {
      appId: string;
      branchName: string;
      region: string;
      maxResults?: number;
    };

    if (!appId || !branchName) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    const client = new AmplifyClient({
      region: region ?? awsAccount.scope ?? "us-east-1",
      credentials: {
        accessKeyId: awsAccount.access_token!,
        secretAccessKey: awsAccount.refresh_token!,
      },
    });

    const resp = await client.send(
      new ListJobsCommand({ appId, branchName, maxResults })
    );

    const jobs = (resp.jobSummaries ?? []).map((j) => ({
      jobId: j.jobId ?? null,
      jobType: j.jobType ?? null,
      commitId: j.commitId ?? null,
      commitMessage: j.commitMessage ?? null,
      commitTime: j.commitTime?.toISOString() ?? null,
      startTime: j.startTime?.toISOString() ?? null,
      endTime: j.endTime?.toISOString() ?? null,
      status: j.status ?? null,
    }));

    return NextResponse.json({ jobs });
  } catch (e) {
    const err = e as Error & { name?: string; $metadata?: unknown };
    console.error("[amplify/jobs] error:", err.name, err.message, err.$metadata ?? "");
    return NextResponse.json({ error: `${err.name ?? "Error"}: ${err.message ?? "Unknown error"}` }, { status: 500 });
  }
}
