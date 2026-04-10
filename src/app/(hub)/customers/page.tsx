import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { CustomersClient } from "@/components/customers/CustomersClient";

export default async function CustomersPage() {
  await auth();

  const customers = await prisma.customer.findMany({
    orderBy: { updatedAt: "desc" },
    include: {
      contacts: { orderBy: [{ isPrimary: "desc" }, { name: "asc" }], take: 5 },
      documents: { orderBy: { createdAt: "desc" }, take: 3, select: { id: true } },
      noteItems: { orderBy: { createdAt: "desc" }, take: 3, select: { id: true } },
    },
  });

  return <CustomersClient customers={customers} />;
}
