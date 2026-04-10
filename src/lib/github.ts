import { Octokit } from "@octokit/rest";

function getOctokit(): Octokit {
  const token = process.env.GITHUB_TOKEN;
  if (!token) throw new Error("GITHUB_TOKEN is not set in environment variables.");
  return new Octokit({ auth: token });
}

/**
 * Discovers all repos available to this token.
 * Tries both the authenticated user's repos AND the configured org's repos,
 * then deduplicates by repo ID. This handles fine-grained PATs that may only
 * cover one source, as well as classic PATs that cover both.
 *
 * If GITHUB_ORG is set, only repos owned by that org/user are returned.
 * If not set, all accessible repos across both sources are returned.
 *
 * Throws on token misconfiguration; swallows individual source failures gracefully.
 */
export async function discoverRepos() {
  const octokit = getOctokit();
  const ownerFilter = process.env.GITHUB_ORG?.toLowerCase() ?? null;

  const seen = new Set<number>();
  const combined: Awaited<ReturnType<typeof octokit.rest.repos.listForAuthenticatedUser>>["data"] = [];

  // Source 1: repos the authenticated user can access (personal + orgs they belong to)
  try {
    const userRepos = await octokit.paginate(octokit.rest.repos.listForAuthenticatedUser, {
      type: "all",
      per_page: 100,
      sort: "updated",
    });
    for (const r of userRepos) {
      if (!seen.has(r.id)) { seen.add(r.id); combined.push(r); }
    }
  } catch {
    // Token may not cover this — continue to try org source
  }

  // Source 2: org repos directly (needed when PAT is scoped to the org, not the user)
  if (ownerFilter) {
    try {
      const orgRepos = await octokit.paginate(octokit.rest.repos.listForOrg, {
        org: ownerFilter,
        type: "all",
        per_page: 100,
        sort: "updated",
      });
      for (const r of orgRepos) {
        if (!seen.has(r.id)) { seen.add(r.id); combined.push(r as typeof combined[number]); }
      }
    } catch {
      // Token may not have org access — that's OK
    }
  }

  if (ownerFilter) {
    return combined.filter((r) => r.owner?.login?.toLowerCase() === ownerFilter);
  }
  return combined;
}

/** Used by existing code paths (issue sync, stats). Alias of discoverRepos. */
export async function getOrgRepos() {
  return discoverRepos();
}

export function getConfiguredOrg(): string | null {
  return process.env.GITHUB_ORG ?? null;
}

export async function getRepoIssues(
  owner: string,
  repo: string,
  state: "open" | "closed" | "all" = "open"
) {
  const octokit = getOctokit();
  try {
    const issues = await octokit.paginate(octokit.issues.listForRepo, {
      owner,
      repo,
      state,
      per_page: 100,
    });
    return issues;
  } catch (error) {
    console.error("GitHub API error fetching issues:", error);
    return [];
  }
}

export async function createGithubIssue(
  owner: string,
  repo: string,
  title: string,
  body: string,
  labels?: string[]
) {
  const octokit = getOctokit();
  const response = await octokit.issues.create({
    owner,
    repo,
    title,
    body,
    labels,
  });
  return response.data;
}

export async function getRepoReadme(owner: string, repo: string): Promise<string | null> {
  const octokit = getOctokit();
  try {
    const response = await octokit.request("GET /repos/{owner}/{repo}/readme", {
      owner,
      repo,
      headers: { accept: "application/vnd.github.html+json" },
    });
    return response.data as unknown as string;
  } catch {
    return null;
  }
}

export async function getRepoCommits(
  owner: string,
  repo: string,
  branch?: string,
  perPage = 30
) {
  const octokit = getOctokit();
  try {
    const { data } = await octokit.repos.listCommits({
      owner,
      repo,
      ...(branch ? { sha: branch } : {}),
      per_page: perPage,
    });
    return data;
  } catch {
    return [];
  }
}

export async function getRepoBranches(owner: string, repo: string) {
  const octokit = getOctokit();
  try {
    const [branchesRes, repoRes] = await Promise.all([
      octokit.repos.listBranches({ owner, repo, per_page: 100 }),
      octokit.repos.get({ owner, repo }),
    ]);
    return {
      branches: branchesRes.data,
      defaultBranch: repoRes.data.default_branch,
    };
  } catch {
    return { branches: [] as { name: string; protected: boolean }[], defaultBranch: "main" };
  }
}

export async function getRepoPullRequests(
  owner: string,
  repo: string,
  state: "open" | "closed" | "all" = "open"
) {
  const octokit = getOctokit();
  try {
    const { data } = await octokit.pulls.list({
      owner,
      repo,
      state,
      per_page: 50,
      sort: "updated",
      direction: "desc",
    });
    return data;
  } catch {
    return [];
  }
}

// ─── Knowledge / File Tree Operations ────────────────────────────────────────

export interface GitTreeItem {
  path: string;
  type: "blob" | "tree";
  sha: string;
  size?: number;
}

export async function getRawRepoTree(
  owner: string,
  repo: string,
  branch = "main"
): Promise<GitTreeItem[]> {
  const octokit = getOctokit();
  try {
    const { data: ref } = await octokit.git.getRef({
      owner,
      repo,
      ref: `heads/${branch}`,
    });
    const commitSha = ref.object.sha;

    const { data } = await octokit.git.getTree({
      owner,
      repo,
      tree_sha: commitSha,
      recursive: "1",
    });

    return data.tree as GitTreeItem[];
  } catch {
    return [];
  }
}

/**
 * Fetch the full recursive git tree for a repo branch.
 * Returns only .md files and their ancestor directories.
 */
export async function getRepoTree(
  owner: string,
  repo: string,
  branch = "main"
): Promise<GitTreeItem[]> {
  try {
    const items = await getRawRepoTree(owner, repo, branch);

    // Collect all .md file paths and their ancestor directories
    const mdPaths = items.filter((i) => i.type === "blob" && i.path.endsWith(".md")).map((i) => i.path);
    const neededDirs = new Set<string>();
    for (const p of mdPaths) {
      const parts = p.split("/");
      for (let i = 1; i < parts.length; i++) {
        neededDirs.add(parts.slice(0, i).join("/"));
      }
    }

    return items.filter(
      (i) => (i.type === "blob" && i.path.endsWith(".md")) || (i.type === "tree" && neededDirs.has(i.path))
    );
  } catch {
    return [];
  }
}

/**
 * Fetch the raw content of a file and its blob SHA (needed for updates).
 */
export async function getFileContent(
  owner: string,
  repo: string,
  path: string,
  branch = "main"
): Promise<{ content: string; sha: string } | null> {
  const octokit = getOctokit();
  try {
    const { data } = await octokit.repos.getContent({ owner, repo, path, ref: branch });
    if (Array.isArray(data) || data.type !== "file") return null;
    const decoded = Buffer.from(data.content, "base64").toString("utf-8");
    return { content: decoded, sha: data.sha };
  } catch {
    return null;
  }
}

/**
 * Create or update a file in the repo with a commit.
 * Pass `sha` when updating an existing file; omit for new files.
 */
export async function upsertFile(
  owner: string,
  repo: string,
  path: string,
  content: string,
  message: string,
  branch = "main",
  sha?: string
) {
  const octokit = getOctokit();
  const encoded = Buffer.from(content, "utf-8").toString("base64");
  const { data } = await octokit.repos.createOrUpdateFileContents({
    owner,
    repo,
    path,
    message,
    content: encoded,
    branch,
    ...(sha ? { sha } : {}),
  });
  return data;
}

/**
 * Delete a file from the repo with a commit.
 */
export async function deleteRepoFile(
  owner: string,
  repo: string,
  path: string,
  message: string,
  sha: string,
  branch = "main"
) {
  const octokit = getOctokit();
  const { data } = await octokit.repos.deleteFile({
    owner,
    repo,
    path,
    message,
    sha,
    branch,
  });
  return data;
}

export interface KnowledgeCommitFile {
  path: string;
  content?: string;
  sha?: string | null;
  delete?: boolean;
}

export interface KnowledgeCommitResult {
  mode: "single_commit" | "per_file_commits";
  commits: string[];
}

/**
 * Create a single commit that can add, update, and delete multiple files at once.
 */
export async function commitKnowledgeFiles(
  owner: string,
  repo: string,
  branch: string,
  message: string,
  files: KnowledgeCommitFile[]
): Promise<KnowledgeCommitResult> {
  const octokit = getOctokit();

  const { data: ref } = await octokit.git.getRef({
    owner,
    repo,
    ref: `heads/${branch}`,
  });

  const parentCommitSha = ref.object.sha;
  const { data: parentCommit } = await octokit.git.getCommit({
    owner,
    repo,
    commit_sha: parentCommitSha,
  });

  const tree = await Promise.all(
    files.map(async (file) => {
      if (file.delete) {
        return {
          path: file.path,
          mode: "100644" as const,
          type: "blob" as const,
          sha: null,
        };
      }

      const { data: blob } = await octokit.git.createBlob({
        owner,
        repo,
        content: file.content ?? "",
        encoding: "utf-8",
      });

      return {
        path: file.path,
        mode: "100644" as const,
        type: "blob" as const,
        sha: blob.sha,
      };
    })
  );

  const { data: nextTree } = await octokit.git.createTree({
    owner,
    repo,
    base_tree: parentCommit.tree.sha,
    tree,
  });

  const { data: commit } = await octokit.git.createCommit({
    owner,
    repo,
    message,
    tree: nextTree.sha,
    parents: [parentCommitSha],
  });

  await octokit.git.updateRef({
    owner,
    repo,
    ref: `heads/${branch}`,
    sha: commit.sha,
  });

  return {
    mode: "single_commit",
    commits: [commit.sha],
  };
}

/**
 * Compatibility fallback for tokens that can write repo contents but cannot use
 * the lower-level git blob/tree APIs required for a single batched commit.
 */
export async function commitKnowledgeFilesViaContents(
  owner: string,
  repo: string,
  branch: string,
  message: string,
  files: KnowledgeCommitFile[]
): Promise<KnowledgeCommitResult> {
  const commits: string[] = [];

  for (const [index, file] of files.entries()) {
    const itemMessage =
      files.length === 1
        ? message
        : `${message} (${index + 1}/${files.length}: ${file.delete ? "delete" : "update"} ${file.path})`;

    if (file.delete) {
      if (!file.sha) {
        throw new Error(`Cannot delete ${file.path} because its current SHA is missing`);
      }

      const result = await deleteRepoFile(owner, repo, file.path, itemMessage, file.sha, branch);
      if (result.commit?.sha) commits.push(result.commit.sha);
      continue;
    }

    const result = await upsertFile(owner, repo, file.path, file.content ?? "", itemMessage, branch, file.sha ?? undefined);
    if (result.commit?.sha) commits.push(result.commit.sha);
  }

  return {
    mode: "per_file_commits",
    commits,
  };
}

export async function getOrgStats() {
  try {
    const repos = await getOrgRepos();
    const totalStars = repos.reduce((sum, r) => sum + (r.stargazers_count ?? 0), 0);
    const totalIssues = repos.reduce((sum, r) => sum + (r.open_issues_count ?? 0), 0);
    const languages = repos
      .map((r) => r.language)
      .filter(Boolean)
      .reduce((acc: Record<string, number>, lang) => {
        acc[lang!] = (acc[lang!] ?? 0) + 1;
        return acc;
      }, {});

    return {
      repoCount: repos.length,
      totalStars,
      totalIssues,
      topLanguage: Object.entries(languages).sort((a, b) => b[1] - a[1])[0]?.[0],
    };
  } catch {
    return { repoCount: 0, totalStars: 0, totalIssues: 0, topLanguage: null };
  }
}
