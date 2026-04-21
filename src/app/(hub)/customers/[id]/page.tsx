import { notFound } from "next/navigation";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { CustomerDetailClient } from "@/components/customers/CustomerDetailClient";
import { mapWellToCustomerDetail } from "@/lib/well-compat";

export default async function CustomerDetailPage({ params }: { params: Promise<{ id: string }> }) {
  await auth();
  const { id } = await params;

  const well = await prisma.oilWell.findUnique({
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

  if (!well) notFound();

  return <CustomerDetailClient customer={mapWellToCustomerDetail(well)} />;
}
