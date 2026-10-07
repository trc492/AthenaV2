import { auth } from "@/lib/auth/config";
import { hasPermission, PERMISSIONS } from "@/lib/auth/roles";
import { AdminAccessDenied } from "@/components/auth/admin-access-denied";
import { GuestLinksManager } from "@/components/events/guest-links-manager";

export default async function GuestLinksPage() {
  const session = await auth();
  if (!hasPermission(session?.user?.role ?? null, PERMISSIONS.MANAGE_EVENT_SETTINGS)) {
    return <AdminAccessDenied description="Only event managers can manage guest links." />;
  }
  return <GuestLinksManager />;
}
