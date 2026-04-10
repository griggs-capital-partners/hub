import { Bell } from "lucide-react";
import { PushNotificationsCard } from "@/components/profile/PushNotificationsCard";

export default function NotificationsSettingsPage() {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-bold text-[#F0F0F0] flex items-center gap-2.5">
          <Bell size={17} className="text-[#F7941D]" />
          Notifications
        </h2>
        <p className="text-sm text-[#505050] mt-1">
          Control how and when SmartHub notifies you.
        </p>
      </div>

      <PushNotificationsCard />
    </div>
  );
}
