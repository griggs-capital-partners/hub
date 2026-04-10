import { notFound } from "next/navigation";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { CustomerDetailClient } from "@/components/customers/CustomerDetailClient";

export default async function CustomerDetailPage({ params }: { params: Promise<{ id: string }> }) {
  await auth();
  const { id } = await params;

  const customer = await prisma.customer.findUnique({
    where: { id },
    include: {
      contacts: { orderBy: [{ isPrimary: "desc" }, { name: "asc" }] },
      documents: {
        orderBy: { createdAt: "desc" },
        include: { uploader: { select: { name: true, email: true, image: true } } },
      },
      noteItems: {
        orderBy: { createdAt: "desc" },
        include: { author: { select: { id: true, name: true, displayName: true, image: true } } },
      },
    },
  });

  if (!customer) notFound();

  return <CustomerDetailClient customer={customer} />;
}
