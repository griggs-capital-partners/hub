import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";
import { MobileTopBar, Sidebar } from "@/components/layout/Sidebar";
import { MobileNavProvider } from "@/components/layout/MobileNav";
import { GitHubSync } from "@/components/layout/GitHubSync";

export default async function HubLayout({ children }: { children: React.ReactNode }) {
  const session = await auth();

  if (!session) {
    redirect("/login");
  }

  // Sync Neon Auth user into our local users table so FK relations work.
  // Neon Auth stores auth state in neon_auth schema; our app data references
  // users in the public users table by the same ID.
  const normalizedEmail = session.user.email?.toLowerCase().trim() ?? null;
  const existingById = await prisma.user.findUnique({ where: { id: session.user.id } });

  if (existingById) {
    await prisma.user.update({
      where: { id: session.user.id },
      data: {
        name: session.user.name,
        email: normalizedEmail ?? session.user.id,
        image: session.user.image,
      },
    });
  } else if (normalizedEmail) {
    const existingByEmail = await prisma.user.findUnique({ where: { email: normalizedEmail } });

    if (existingByEmail) {
      await prisma.user.update({
        where: { id: existingByEmail.id },
        data: {
          id: session.user.id,
          name: session.user.name,
          email: normalizedEmail,
          image: session.user.image,
        },
      });
    } else {
      await prisma.user.create({
        data: {
          id: session.user.id,
          name: session.user.name,
          email: normalizedEmail,
          image: session.user.image,
          role: "member",
        },
      });
    }
  } else {
    await prisma.user.upsert({
      where: { id: session.user.id },
      update: {
        name: session.user.name,
        email: session.user.id,
        image: session.user.image,
      },
      create: {
        id: session.user.id,
        name: session.user.name,
        email: session.user.id,
        image: session.user.image,
        role: "member",
      },
    });
  }

  return (
    <MobileNavProvider>
      <div className="flex h-screen overflow-hidden bg-[#0D0D0D]">
        <GitHubSync />
        <Sidebar />
        <main className="flex-1 overflow-y-auto">
          <MobileTopBar />
          <div className="p-4 md:p-6">
            {children}
          </div>
        </main>
      </div>
    </MobileNavProvider>
  );
}
