import { prisma } from "./prisma";
import {
  getFileContent,
  getRawRepoTree,
  getRepoBranches,
  getRepoCommits,
  getRepoPullRequests,
  getRepoReadme,
  getRepoTree,
} from "./github";

type ConnectedRepo = {
  name: string;
  fullName: string;
  description: string | null;
  language: string | null;
};

export type AgentRetrievedSource = {
  kind: "knowledge-map" | "knowledge-doc" | "repo-readme" | "repo-branches" | "repo-commits" | "repo-pulls" | "repo-tree" | "repo-file";
  label: string;
  target: string;
  detail: string;
};

export type AgentRetrievedContext = {
  text: string;
  sources: AgentRetrievedSource[];
};

const FILE_PATH_REGEX = /(?:^|[\s`'"])([A-Za-z0-9._/-]+\.(?:ts|tsx|js|jsx|py|md|json|prisma|sql|yml|yaml|sh|css|scss|html))(?:$|[\s`'"])/g;

function normalize(value: string) {
  return value.toLowerCase();
}

// Limits are sized for an 8K token context window.
// Base context (~1,050) + history (~1,200) + retrieval budget (~3,500) + response headroom (~1,000) ≈ 6,750 tokens.
function truncate(value: string, max = 2000) {
  if (value.length <= max) return value;
  return `${value.slice(0, max)}\n... [truncated ${value.length - max} chars]`;
}

function extractFileCandidates(message: string) {
  const matches = Array.from(message.matchAll(FILE_PATH_REGEX))
    .map((match) => match[1]?.trim())
    .filter((value): value is string => Boolean(value));
  return Array.from(new Set(matches));
}

function selectMentionedRepos(message: string, repos: ConnectedRepo[]) {
  const normalizedMessage = normalize(message);
  return repos.filter((repo) => {
    const fullName = normalize(repo.fullName);
    const repoName = normalize(repo.name);
    return normalizedMessage.includes(fullName) || normalizedMessage.includes(repoName);
  }).slice(0, 2);
}

function buildRepoSummaryTree(items: Array<{ path: string; type: "blob" | "tree" }>) {
  const dirs = items
    .filter((item) => item.type === "tree" && !item.path.includes("/"))
    .map((item) => item.path)
    .sort((a, b) => a.localeCompare(b));
  const notableFiles = items
    .filter((item) => item.type === "blob" && (item.path.split("/").length <= 2))
    .map((item) => item.path)
    .sort((a, b) => a.localeCompare(b))
    .slice(0, 20);

  return [
    dirs.length > 0 ? `Top-level directories: ${dirs.join(", ")}` : null,
    notableFiles.length > 0 ? `Notable files: ${notableFiles.join(", ")}` : null,
  ].filter((line): line is string => Boolean(line));
}

export async function buildMessageRetrievalContext(message: string): Promise<AgentRetrievedContext> {
  const fileCandidates = extractFileCandidates(message);

  const [repos, knowledgeRepo] = await Promise.all([
    prisma.repo.findMany({
      where: { connected: true },
      select: {
        name: true,
        fullName: true,
        description: true,
        language: true,
      },
      orderBy: { name: "asc" },
    }),
    prisma.knowledgeRepo.findFirst({
      select: {
        repoOwner: true,
        repoName: true,
        branch: true,
      },
    }),
  ]);

  const sources: AgentRetrievedSource[] = [];
  const sections: string[] = [];
  const mentionedRepos = selectMentionedRepos(message, repos);
  const wantsReadme = /readme|overview|what is this repo|repo summary|architecture/i.test(message);
  const wantsCommits = /commit|recent changes|what changed|history/i.test(message);
  const wantsPulls = /\bpr\b|pull request|merge/i.test(message);
  const wantsBranches = /\bbranch\b|default branch/i.test(message);
  const wantsCode = fileCandidates.length > 0 || /source code|implementation|code path|file|component|function|class/i.test(message);
  const wantsKnowledge = /knowledge|runbook|adr|docs|documentation|spec/i.test(message) || fileCandidates.some((path) => path.endsWith(".md"));

  if (knowledgeRepo && wantsKnowledge) {
    const knowledgeTree = await getRepoTree(knowledgeRepo.repoOwner, knowledgeRepo.repoName, knowledgeRepo.branch);
    const matchingDocs = knowledgeTree
      .filter((item) => item.type === "blob")
      .map((item) => item.path)
      .filter((path) => fileCandidates.length === 0 || fileCandidates.some((candidate) => path.toLowerCase().includes(candidate.toLowerCase())))
      .slice(0, 2);

    if (knowledgeTree.length > 0) {
      sections.push(
        "## Retrieved Knowledge Map\n" +
        knowledgeTree
          .filter((item) => item.type === "blob")
          .map((item) => `- ${item.path}`)
          .slice(0, 80)
          .join("\n")
      );
      sources.push({
        kind: "knowledge-map",
        label: "Knowledge document map",
        target: `${knowledgeRepo.repoOwner}/${knowledgeRepo.repoName}`,
        detail: `${knowledgeTree.filter((item) => item.type === "blob").length} markdown docs available`,
      });
    }

    for (const path of matchingDocs) {
      const file = await getFileContent(knowledgeRepo.repoOwner, knowledgeRepo.repoName, path, knowledgeRepo.branch);
      if (!file?.content) continue;
      sections.push(`## Retrieved Knowledge Doc: ${path}\n${truncate(file.content, 2000)}`);
      sources.push({
        kind: "knowledge-doc",
        label: path,
        target: `${knowledgeRepo.repoOwner}/${knowledgeRepo.repoName}`,
        detail: "Knowledge file content loaded read-only",
      });
    }
  }

  for (const repo of mentionedRepos) {
    const [owner, repoName] = repo.fullName.split("/");
    if (!owner || !repoName) continue;

    if (wantsReadme) {
      const readme = await getRepoReadme(owner, repoName);
      if (readme) {
        sections.push(`## Retrieved README: ${repo.fullName}\n${truncate(readme, 1500)}`);
        sources.push({
          kind: "repo-readme",
          label: `${repo.fullName} README`,
          target: repo.fullName,
          detail: "Repository README fetched read-only",
        });
      }
    }

    if (wantsBranches) {
      const branchData = await getRepoBranches(owner, repoName);
      if (branchData.branches.length > 0) {
        sections.push(
          `## Retrieved Branches: ${repo.fullName}\nDefault branch: ${branchData.defaultBranch}\n` +
          branchData.branches.slice(0, 12).map((branch) => `- ${branch.name}${branch.protected ? " [protected]" : ""}`).join("\n")
        );
        sources.push({
          kind: "repo-branches",
          label: `${repo.fullName} branches`,
          target: repo.fullName,
          detail: `${branchData.branches.length} branches visible`,
        });
      }
    }

    if (wantsCommits) {
      const commits = await getRepoCommits(owner, repoName, undefined, 8);
      if (commits.length > 0) {
        sections.push(
          `## Retrieved Recent Commits: ${repo.fullName}\n` +
          commits
            .slice(0, 8)
            .map((commit) => {
              const sha = commit.sha.slice(0, 7);
              const author = commit.commit.author?.name || commit.author?.login || "Unknown";
              return `- ${sha} — ${commit.commit.message.split("\n")[0]} (${author})`;
            })
            .join("\n")
        );
        sources.push({
          kind: "repo-commits",
          label: `${repo.fullName} commits`,
          target: repo.fullName,
          detail: "Recent commit history fetched read-only",
        });
      }
    }

    if (wantsPulls) {
      const pulls = await getRepoPullRequests(owner, repoName, "all");
      if (pulls.length > 0) {
        sections.push(
          `## Retrieved Pull Requests: ${repo.fullName}\n` +
          pulls
            .slice(0, 6)
            .map((pull) => `- #${pull.number} [${pull.state}] ${pull.title}`)
            .join("\n")
        );
        sources.push({
          kind: "repo-pulls",
          label: `${repo.fullName} pull requests`,
          target: repo.fullName,
          detail: "Recent PRs fetched read-only",
        });
      }
    }

    if (wantsCode) {
      const rawTree = await getRawRepoTree(owner, repoName);
      if (rawTree.length > 0) {
        sections.push(`## Retrieved Repo Structure: ${repo.fullName}\n${buildRepoSummaryTree(rawTree).join("\n")}`);
        sources.push({
          kind: "repo-tree",
          label: `${repo.fullName} structure`,
          target: repo.fullName,
          detail: "Repository tree summarized read-only",
        });
      }

      const matchingFiles = rawTree
        .filter((item) => item.type === "blob")
        .map((item) => item.path)
        .filter((path) =>
          fileCandidates.some((candidate) => path.toLowerCase() === candidate.toLowerCase() || path.toLowerCase().endsWith(candidate.toLowerCase()))
        )
        .slice(0, 2);

      for (const path of matchingFiles) {
        const file = await getFileContent(owner, repoName, path);
        if (!file?.content) continue;
        sections.push(`## Retrieved Repo File: ${repo.fullName}/${path}\n${truncate(file.content, 2000)}`);
        sources.push({
          kind: "repo-file",
          label: path,
          target: repo.fullName,
          detail: "Source file fetched read-only",
        });
      }
    }
  }

  if (sources.length === 0 && (wantsKnowledge || wantsReadme || wantsBranches || wantsCommits || wantsPulls || wantsCode)) {
    sections.push(
      "## Retrieved Repo Context\nNo additional repo or knowledge artifacts could be matched safely from the current prompt. " +
      "Ask for a connected repo by name and, when possible, specify a file path or artifact type such as README, commits, PRs, or branches."
    );
  }

  if (sources.length > 0) {
    sections.unshift(
      "## Safe Retrieval Policy\n" +
      "- All retrieved GitHub and knowledge data below was fetched server-side in read-only mode.\n" +
      "- The agent cannot write files, push commits, open PRs, or mutate repos through this chat.\n" +
      "- Retrieval is limited to connected repos in this workspace and the configured knowledge repo."
    );
  }

  return {
    text: sections.join("\n\n").trim(),
    sources,
  };
}
