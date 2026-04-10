import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { MqttPortalClient } from "@/components/mqtt-portal/MqttPortalClient";

export default async function MqttPortalPage() {
  const session = await auth();
  if (!session) redirect("/login");

  return (
    <div className="h-full flex flex-col">
      <MqttPortalClient />
    </div>
  );
}
