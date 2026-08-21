"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Settings, Database, Users, Info, KeyRound } from "lucide-react";
import { DatabaseSyncComponent } from "@/components/sync/database-sync";
import { DatabaseConfigurationComponent } from "@/components/settings/database-configuration";
import { OfflinePrecache } from "@/components/sync/offline-precache";
import { DataExportImportComponent } from "@/components/settings/data-export-import";
import { DatabaseResetComponent } from "@/components/settings/database-reset";
import { CacheRevalidationComponent } from "@/components/cache-revalidation";
import { NotificationSender } from "@/components/notification-sender";
import { TeamManagement } from "@/components/settings/team-management";
import { ApiKeysConfiguration } from "@/components/settings/api-keys-configuration";
import { PermissionGuard } from "@/components/auth/PermissionGuard";
import { PERMISSIONS } from "@/lib/auth/roles";

export default function SettingsPage() {
  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4">
        <div className="flex items-center gap-3">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Settings</h1>
            <p className="text-muted-foreground">
              Configure your scouting system and manage data synchronization.
            </p>
          </div>
        </div>
      </div>

      <Tabs defaultValue="database" className="w-full">
        <TabsList className="grid w-full grid-cols-3 sm:grid-cols-5 h-auto p-1">
          <TabsTrigger
            value="database"
            className="flex items-center gap-2 text-xs sm:text-sm"
          >
            <Database className="h-3 w-3 sm:h-4 sm:w-4" />
            <span className="hidden sm:inline">Database</span>
            <span className="sm:hidden">DB</span>
          </TabsTrigger>
          <TabsTrigger
            value="team"
            className="flex items-center gap-2 text-xs sm:text-sm"
          >
            <Users className="h-3 w-3 sm:h-4 sm:w-4" />
            <span>Team</span>
          </TabsTrigger>
          <TabsTrigger
            value="api-keys"
            className="flex items-center gap-2 text-xs sm:text-sm"
          >
            <KeyRound className="h-3 w-3 sm:h-4 sm:w-4" />
            <span className="hidden sm:inline">API Keys</span>
            <span className="sm:hidden">Keys</span>
          </TabsTrigger>
          <TabsTrigger
            value="about"
            className="flex items-center gap-2 text-xs sm:text-sm"
          >
            <Info className="h-3 w-3 sm:h-4 sm:w-4" />
            <span>About</span>
          </TabsTrigger>
          <TabsTrigger
            value="notification-examples"
            className="flex items-center gap-2 text-xs sm:text-sm"
          >
            <Settings className="h-3 w-3 sm:h-4 sm:w-4" />
            <span className="hidden sm:inline">Notification</span>
            <span className="sm:hidden">Notif</span>
          </TabsTrigger>
        </TabsList>

        <TabsContent value="database" className="space-y-4">
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
        </TabsContent>

        <TabsContent value="team" className="space-y-4">
          <TeamManagement />
        </TabsContent>

        <TabsContent value="api-keys" className="space-y-4">
          <PermissionGuard permission={PERMISSIONS.MANAGE_SYSTEM_CONFIG}>
            <ApiKeysConfiguration />
          </PermissionGuard>
        </TabsContent>

        <TabsContent value="about" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>About Athena V2</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <h4 className="font-medium">Version</h4>
                <p className="text-sm text-muted-foreground">2.0.0</p>
              </div>
              <div>
                <h4 className="font-medium">Features</h4>
                <ul className="text-sm text-muted-foreground space-y-1">
                  <li>• Year-configurable scouting forms</li>
                  <li>• Cloud database support</li>
                  <li>• Mobile-responsive design</li>
                  <li>• Advanced statistics and EPA calculations</li>
                  <li>• Data export/import functionality</li>
                </ul>
              </div>
              <div>
                <h4 className="font-medium">Supported Games</h4>
                <p className="text-sm text-muted-foreground">
                  FRC 2026 (REBUILT)
                </p>
                <p className="text-sm text-muted-foreground">
                  FRC 2025 (REEFSCAPE)
                </p>
                <p className="text-sm text-muted-foreground">
                  FTC 2026 (DECODE)
                </p>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
        <TabsContent value="notification-examples" className="space-y-4">
          <NotificationSender />
        </TabsContent>
      </Tabs>
    </div>
  );
}
