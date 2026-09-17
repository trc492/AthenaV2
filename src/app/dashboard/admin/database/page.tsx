"use client";

import { PermissionGuard } from "@/components/auth/PermissionGuard";
import { AdminAccessDenied } from "@/components/auth/admin-access-denied";
import { CacheRevalidationComponent } from "@/components/cache-revalidation";
import { DataExportImportComponent } from "@/components/settings/data-export-import";
import { DatabaseConfigurationComponent } from "@/components/settings/database-configuration";
import { DatabaseResetComponent } from "@/components/settings/database-reset";
import { DatabaseSyncComponent } from "@/components/sync/database-sync";
import { OfflinePrecache } from "@/components/sync/offline-precache";
import { PERMISSIONS, ROLES } from "@/lib/auth/roles";

export default function DatabaseAdminPage() {
  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-1">
        <h1 className="text-3xl font-bold tracking-tight">Database & Sync</h1>
        <p className="text-muted-foreground">
          Manage database connections, data synchronization, offline caching, and data backups.
        </p>
      </div>

      <PermissionGuard
        roles={[ROLES.ADMIN, ROLES.LEAD_SCOUT]}
        fallback={
          <AdminAccessDenied
            title="Database Management Restricted"
            description="You must be an administrator or lead scout to access database operations."
          />
        }
      >
        <div className="space-y-6">
          <DatabaseSyncComponent />
          <PermissionGuard permission={PERMISSIONS.MANAGE_SYSTEM_CONFIG}>
            <DatabaseConfigurationComponent />
          </PermissionGuard>
          <OfflinePrecache />
          <PermissionGuard
            permissions={[PERMISSIONS.IMPORT_DATA, PERMISSIONS.EXPORT_DATA]}
          >
            <DataExportImportComponent />
          </PermissionGuard>
          <PermissionGuard permission={PERMISSIONS.REVALIDATE_CACHE}>
            <CacheRevalidationComponent />
          </PermissionGuard>
          <PermissionGuard permission={PERMISSIONS.RESET_DATABASE}>
            <DatabaseResetComponent />
          </PermissionGuard>
        </div>
      </PermissionGuard>
    </div>
  );
}