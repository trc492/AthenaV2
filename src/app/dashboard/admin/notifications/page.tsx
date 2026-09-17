"use client";

import { PermissionGuard } from "@/components/auth/PermissionGuard";
import { AdminAccessDenied } from "@/components/auth/admin-access-denied";
import { NotificationSender } from "@/components/notification-sender";
import { PERMISSIONS } from "@/lib/auth/roles";

export default function NotificationsAdminPage() {
  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-1">
        <h1 className="text-3xl font-bold tracking-tight">Push Notifications</h1>
        <p className="text-muted-foreground">
          Broadcast instant alerts and scouting shift assignments to registered users and field tablets.
        </p>
      </div>

      <PermissionGuard
        permission={PERMISSIONS.SEND_NOTIFICATIONS}
        fallback={
          <AdminAccessDenied
            title="Notification Broadcasting Restricted"
            description="You need administrator privileges with push notification permissions to broadcast notifications."
          />
        }
      >
        <NotificationSender />
      </PermissionGuard>
    </div>
  );
}
