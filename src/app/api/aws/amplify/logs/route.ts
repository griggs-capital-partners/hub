import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";
import { AmplifyClient, GetJobCommand } from "@aws-sdk/client-amplify";

// POST /api/aws/amplify/logs
// Body: { appId, branchName, jobId, region }
export async function POST(req: Request) {
  try {
    const session = await auth();
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const awsAccount = await prisma.connectedAccount.findFirst({
      where: { userId: session.user.id, provider: "aws" },
    });
    if (!awsAccount) return NextResponse.json({ error: "AWS not connected" }, { status: 400 });

    const { appId, branchName, jobId, region } = (await req.json()) as {
      appId: string;
      branchName: string;
      jobId: string;
      region: string;
    };

    if (!appId || !branchName || !jobId) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    const client = new AmplifyClient({
      region: region ?? awsAccount.scope ?? "us-east-1",
      credentials: {
        accessKeyId: awsAccount.access_token!,
        secretAccessKey: awsAccount.refresh_token!,
      },
    });

    const jobResp = await client.send(new GetJobCommand({ appId, branchName, jobId }));
    const steps = jobResp.job?.steps ?? [];

    // Fetch each step's log from the presigned S3 URL server-side (avoids CORS)
    const stepLogs = await Promise.allSettled(
      steps.map(async (step) => {
        const name = step.stepName ?? "unknown";
        if (!step.logUrl) return { name, status: step.status, log: "(no log available)" };
        try {
          const res = await fetch(step.logUrl);
          if (!res.ok) return { name, status: step.status, log: `(failed to fetch log: HTTP ${res.status})` };
          const text = await res.text();
          // Trim to last 500 lines to avoid huge payloads
          const lines = text.split("\n");
          const trimmed = lines.length > 500 ? lines.slice(-500).join("\n") : text;
          return { name, status: step.status, log: trimmed };
        } catch (e) {
          return { name, status: step.status, log: `(fetch error: ${(e as Error).message})` };
        }
      })
    );

    const result = stepLogs.map((r, i) =>
      r.status === "fulfilled"
        ? r.value
        : {
            name: steps[i]?.stepName ?? "unknown",
            status: steps[i]?.status,
            log: `(error: ${(r.reason as Error).message})`,
          }
    );

    return NextResponse.json({
      jobId,
      jobStatus: jobResp.job?.summary?.status ?? null,
      commitMessage: jobResp.job?.summary?.commitMessage ?? null,
      startTime: jobResp.job?.summary?.startTime?.toISOString() ?? null,
      endTime: jobResp.job?.summary?.endTime?.toISOString() ?? null,
      steps: result,
    });
  } catch (e) {
    const err = e as Error & { name?: string; $metadata?: unknown };
    console.error("[amplify/logs] error:", err.name, err.message, err.$metadata ?? "");
    return NextResponse.json({ error: `${err.name ?? "Error"}: ${err.message ?? "Unknown error"}` }, { status: 500 });
  }
}
