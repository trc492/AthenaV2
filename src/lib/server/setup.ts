import { databaseManager } from "@/db/database-manager";
import { hasAnyAdmin } from "./user-service";

export interface SetupStatus {
  isComplete: boolean;
  needsDatabase: boolean;
  needsAdmin: boolean;
  currentProvider?: string;
}

export async function checkSetupStatus(): Promise<SetupStatus> {
  console.log('checkSetupStatus called from:', new Error().stack);
  console.log('runtime:', process.env.NEXT_RUNTIME);
  console.log('cwd:', process.cwd());
  console.log('fs available:', typeof require === 'function' ? typeof require('fs').readFileSync : 'no');
  try {
    if (!databaseManager.isConfigured()) {
      console.warn("[setup] databaseManager.isConfigured() returned false — no service configured");
      return { isComplete: false, needsDatabase: true, needsAdmin: true };
    }

    const service = databaseManager.getService();
    if (!service) {
      console.warn("[setup] databaseManager.getService() returned null/undefined");
      return { isComplete: false, needsDatabase: true, needsAdmin: true };
    }

    if (service.query) {
      console.log("[setup] service.query exists, checking for admin user...");
      const adminExists = await hasAnyAdmin();
      console.log("[setup] hasAnyAdmin() returned:", adminExists);
      if (!adminExists) {
        return {
          isComplete: false,
          needsDatabase: false,
          needsAdmin: true,
          currentProvider: databaseManager.getConfig()?.provider,
        };
      }

      return {
        isComplete: true,
        needsDatabase: false,
        needsAdmin: false,
        currentProvider: databaseManager.getConfig()?.provider,
      };
    }

    console.log("[setup] service.query not present, assuming complete (provider:", databaseManager.getConfig()?.provider, ")");
    return {
      isComplete: true,
      needsDatabase: false,
      needsAdmin: false,
      currentProvider: databaseManager.getConfig()?.provider,
    };
  } catch (error) {
    // If the DB is configured but the query failed (e.g. transient connection
    // error during container startup), do NOT redirect to /setup — that would
    // lock users out of the app even when everything is properly configured.
    // Auth guards on protected routes still apply, so failing open here is safe.
    if (databaseManager.isConfigured()) {
      console.warn("[setup] checkSetupStatus query failed but DB is configured; assuming setup is complete:", error);
      return {
        isComplete: true,
        needsDatabase: false,
        needsAdmin: false,
        currentProvider: databaseManager.getConfig()?.provider,
      };
    }
    console.error("[setup] checkSetupStatus failed AND DB is not configured:", error);
    return {
      isComplete: false,
      needsDatabase: true,
      needsAdmin: true,
    };
  }
}
