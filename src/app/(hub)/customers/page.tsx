import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { CustomersClient } from "@/components/customers/CustomersClient";
import { mapWellToCustomerSummary } from "@/lib/well-compat";

export default async function CustomersPage() {
  await auth();

  const wells = await prisma.oilWell.findMany({
    orderBy: { updatedAt: "desc" },
    include: {
      contacts: { orderBy: [{ isPrimary: "desc" }, { name: "asc" }], take: 5 },
      documents: { orderBy: { createdAt: "desc" }, take: 3, select: { id: true } },
      noteItems: { orderBy: { createdAt: "desc" }, take: 3, select: { id: true } },
    },
  });

  return <CustomersClient customers={wells.map(mapWellToCustomerSummary)} />;
}
