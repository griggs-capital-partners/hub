import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { WellsClient } from "@/components/wells/WellsClient";

export default async function WellsPage() {
  await auth();

  const wells = await prisma.oilWell.findMany({
    orderBy: { updatedAt: "desc" },
    include: {
      contacts: { orderBy: [{ isPrimary: "desc" }, { name: "asc" }], take: 5 },
      documents: { orderBy: { createdAt: "desc" }, take: 3, select: { id: true } },
      noteItems: { orderBy: { createdAt: "desc" }, take: 3, select: { id: true } },
    },
  });

  return <WellsClient wells={wells} />;
}
