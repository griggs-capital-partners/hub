import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { Octokit } from "@octokit/rest";

function getOctokit(): Octokit {
  const token = process.env.GITHUB_TOKEN;
  if (!token) throw new Error("GITHUB_TOKEN is not set");
  return new Octokit({ auth: token });
}

export async function GET() {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const repos = await prisma.repo.findMany({
    where: { connected: true },
    select: { fullName: true, name: true },
  });

  const since = new Date();
  since.setFullYear(since.getFullYear() - 1);
  const sinceISO = since.toISOString();

  const octokit = getOctokit();

  type DayEntry = {
    count: number;
    repos: Map<string, { name: string; commits: { sha: string; message: string; author: string; url: string }[] }>;
  };
  const dayMap = new Map<string, DayEntry>();

  await Promise.allSettled(
    repos.map(async (repo) => {
      const [owner, repoName] = repo.fullName.split("/");
      if (!owner || !repoName) return;

      try {
        // Fetch up to 300 commits per repo (3 pages × 100)
        const allCommits: Awaited<ReturnType<typeof octokit.repos.listCommits>>["data"] = [];
        for (let page = 1; page <= 3; page++) {
          const { data } = await octokit.repos.listCommits({
            owner,
            repo: repoName,
            since: sinceISO,
            per_page: 100,
            page,
          });
          allCommits.push(...data);
          if (data.length < 100) break;
        }

        for (const commit of allCommits) {
          const dateStr = commit.commit.author?.date?.slice(0, 10);
          if (!dateStr) continue;

          if (!dayMap.has(dateStr)) {
            dayMap.set(dateStr, { count: 0, repos: new Map() });
          }
          const day = dayMap.get(dateStr)!;
          day.count++;

          if (!day.repos.has(repo.fullName)) {
            day.repos.set(repo.fullName, { name: repo.name, commits: [] });
          }
          day.repos.get(repo.fullName)!.commits.push({
            sha: commit.sha.slice(0, 7),
            message: commit.commit.message.split("\n")[0],
            author: commit.commit.author?.name ?? commit.author?.login ?? "unknown",
            url: commit.html_url,
          });
        }
      } catch {
        // Skip repos we can't access
      }
    })
  );

  const days = Array.from(dayMap.entries()).map(([date, { count, repos }]) => ({
    date,
    count,
    repos: Array.from(repos.values()),
  }));

  return NextResponse.json(
    { days },
    { headers: { "Cache-Control": "private, max-age=300" } }
  );
}
