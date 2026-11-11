"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useSession } from "next-auth/react";
import { ArrowLeft, Bell, Database, FileJson, KeyRound, Users } from "lucide-react";
import { hasAnyPermission, PERMISSIONS, ROLES } from "@/lib/auth/roles";
import { cn } from "@/lib/utils";

export const administrationSettings = [
  { title: "Guest Links", description: "Share event access with guests and manage invitation links.", href: "/dashboard/guest-links", icon: KeyRound, permissions: [PERMISSIONS.MANAGE_EVENT_SETTINGS] },
  { title: "Team Management", description: "Scout accounts, roles, registration, and preferred partners.", href: "/dashboard/admin/team", icon: Users, roles: [ROLES.ADMIN, ROLES.LEAD_SCOUT] },
  { title: "Database & Sync", description: "Connections, synchronization, backups, imports, and exports.", href: "/dashboard/admin/database", icon: Database, roles: [ROLES.ADMIN, ROLES.LEAD_SCOUT] },
  { title: "Game Configuration", description: "Seasons, scouting forms, metrics, field layouts, and analytics.", href: "/dashboard/admin/game-config", icon: FileJson, permissions: [PERMISSIONS.MANAGE_GAME_CONFIG, PERMISSIONS.MANAGE_SYSTEM_CONFIG] },
  { title: "API Keys & Integrations", description: "Credentials for The Blue Alliance, FTC Events, and Nexus.", href: "/dashboard/admin/keys", icon: KeyRound, permissions: [PERMISSIONS.MANAGE_SYSTEM_CONFIG] },
  { title: "Push Notifications", description: "Send alerts and shift announcements to scouts and tablets.", href: "/dashboard/admin/notifications", icon: Bell, permissions: [PERMISSIONS.SEND_NOTIFICATIONS] },
];

export function useAdministrationSettings() {
  const { data: session } = useSession();
  const role = session?.user?.role ?? null;
  return administrationSettings.filter((item) =>
    item.roles ? item.roles.some((allowed) => allowed === role) : hasAnyPermission(role, item.permissions ?? []),
  );
}

export function SettingsNavigation() {
  const pathname = usePathname();
  const items = useAdministrationSettings();

  return (
    <nav aria-label="Settings navigation" className="space-y-3 border-b pb-4">
      <Link href="/dashboard/settings" className="inline-flex items-center gap-2 rounded-sm text-sm font-medium text-muted-foreground hover:text-foreground focus-visible:outline-2 focus-visible:outline-ring">
        <ArrowLeft className="size-4" aria-hidden="true" /> All settings
      </Link>
      <div className="flex flex-wrap gap-2">
        {items.map(({ title, href, icon: Icon }) => (
          <Link key={href} href={href} aria-current={pathname === href ? "page" : undefined}
            className={cn("inline-flex min-h-10 items-center gap-2 rounded-lg border px-3 py-2 text-sm font-medium transition-colors focus-visible:outline-2 focus-visible:outline-ring", pathname === href ? "border-primary/30 bg-primary/10 text-primary" : "hover:bg-muted")}>
            <Icon className="size-4" aria-hidden="true" />{title}
          </Link>
        ))}
      </div>
    </nav>
  );
}
