import { prisma } from "@/lib/prisma";
import { KnowledgeClient } from "@/components/knowledge/KnowledgeClient";

export default async function KnowledgePage() {
  const repo = await prisma.knowledgeRepo.findFirst();

  return (
    <KnowledgeClient
      initialRepo={
        repo
          ? {
              id: repo.id,
              repoOwner: repo.repoOwner,
              repoName: repo.repoName,
              branch: repo.branch,
              description: repo.description,
            }
          : null
      }
    />
  );
}
