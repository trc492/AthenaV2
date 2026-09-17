"use client";

import { PermissionGuard } from "@/components/auth/PermissionGuard";
import { AdminAccessDenied } from "@/components/auth/admin-access-denied";
import { TeamManagement } from "@/components/settings/team-management";
import { SignupSettings } from "@/components/settings/signup-settings";
import { PERMISSIONS, ROLES } from "@/lib/auth/roles";

export default function TeamManagementPage() {
  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-1">
        <h1 className="text-3xl font-bold tracking-tight">Team Management</h1>
        <p className="text-muted-foreground">
          Manage scout accounts, assign user roles, and configure registration settings.
        </p>
      </div>

      <PermissionGuard
        roles={[ROLES.ADMIN, ROLES.LEAD_SCOUT]}
        fallback={
          <AdminAccessDenied
            title="Team Management Access Restricted"
            description="You must be an administrator or lead scout to view and manage team members."
          />
        }
      >
        <div className="space-y-6">
          <TeamManagement />
          <PermissionGuard permission={PERMISSIONS.MANAGE_SYSTEM_CONFIG}>
            <SignupSettings />
          </PermissionGuard>
        </div>
      </PermissionGuard>
    </div>
  );
}
