import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { getRepoCommits } from "@/lib/github";
import { prisma } from "@/lib/prisma";
import { findLinkedKanbanTasksInText } from "@/lib/kanbanTaskLinks";

export async function GET(request: Request) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const owner = searchParams.get("owner");
  const repo = searchParams.get("repo");
  const branch = searchParams.get("branch") ?? undefined;
  const taskId = searchParams.get("taskId");
  const perPage = Math.min(parseInt(searchParams.get("per_page") ?? "30"), 100);

  if (!owner || !repo) {
    return NextResponse.json({ error: "owner and repo required" }, { status: 400 });
  }

  const commits = await getRepoCommits(owner, repo, branch, perPage);
  const repoRecord = await prisma.repo.findFirst({
    where: { fullName: `${owner}/${repo}` },
    select: {
      boards: {
        select: {
          columns: {
            select: {
              name: true,
              cards: {
                select: {
                  id: true,
                  title: true,
                  state: true,
                },
              },
            },
          },
        },
      },
    },
  });

  const repoTasks =
    repoRecord?.boards.flatMap((board) =>
      board.columns.flatMap((column) =>
        column.cards.map((card) => ({
          id: card.id,
          title: card.title,
          state: card.state,
          columnName: column.name,
        }))
      )
    ) ?? [];

  const enrichedCommits = commits
    .map((commit) => {
      const linkedTasks = findLinkedKanbanTasksInText(commit.commit.message, repoTasks);

      return {
        ...commit,
        linkedTasks: taskId ? linkedTasks.filter((task) => task.id === taskId) : linkedTasks,
      };
    })
    .filter((commit) => (taskId ? commit.linkedTasks.length > 0 : true));

  return NextResponse.json({ commits: enrichedCommits });
}
