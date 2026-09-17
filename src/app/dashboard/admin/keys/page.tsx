"use client";

import { PermissionGuard } from "@/components/auth/PermissionGuard";
import { AdminAccessDenied } from "@/components/auth/admin-access-denied";
import { ApiKeysConfiguration } from "@/components/settings/api-keys-configuration";
import { PERMISSIONS } from "@/lib/auth/roles";

export default function ApiKeysAdminPage() {
  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-1">
        <h1 className="text-3xl font-bold tracking-tight">API Keys & Integrations</h1>
        <p className="text-muted-foreground">
          Manage external service credentials for The Blue Alliance, FTC Events, and Nexus integrations.
        </p>
      </div>

      <PermissionGuard
        permission={PERMISSIONS.MANAGE_SYSTEM_CONFIG}
        fallback={
          <AdminAccessDenied
            title="API Keys Access Restricted"
            description="You must be a system administrator to manage external API keys and secrets."
          />
        }
      >
        <ApiKeysConfiguration />
      </PermissionGuard>
    </div>
  );
}