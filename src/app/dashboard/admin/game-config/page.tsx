"use client";

import { PermissionGuard } from "@/components/auth/PermissionGuard";
import { AdminAccessDenied } from "@/components/auth/admin-access-denied";
import { GameConfigStudio } from "@/components/settings/game-config-studio";
import { PERMISSIONS } from "@/lib/auth/roles";

export default function GameConfigAdminPage() {
  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-1">
        <h1 className="text-3xl font-bold tracking-tight">Game Configuration</h1>
        <p className="text-muted-foreground">
          Visual game configuration builder for scouting metrics, field layouts, and analytics.
        </p>
      </div>

      <PermissionGuard
        permissions={[
          PERMISSIONS.MANAGE_GAME_CONFIG,
          PERMISSIONS.MANAGE_SYSTEM_CONFIG,
        ]}
        fallback={
          <AdminAccessDenied
            title="Game Configuration Restricted"
            description="You must have administrator permissions to create or modify game configurations."
          />
        }
      >
        <GameConfigStudio />
      </PermissionGuard>
    </div>
  );
}
