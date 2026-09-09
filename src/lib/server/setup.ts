import { databaseManager } from "@/db/database-manager";
import { loadAppConfig } from "@/lib/server/env-file";
import { hasAnyAdmin } from "./user-service";

export interface SetupStatus {
  isComplete: boolean;
  needsAppUrl: boolean;
  needsDatabase: boolean;
  needsAdmin: boolean;
  currentProvider?: string;
}

export async function checkSetupStatus(): Promise<SetupStatus> {
  // Step 0: app URL must be configured before anything else.
  const appConfig = loadAppConfig();
  if (!appConfig?.appUrl) {
    return { isComplete: false, needsAppUrl: true, needsDatabase: true, needsAdmin: true };
  }

  try {
    if (!databaseManager.isConfigured()) {
      console.warn("[setup] No database provider configured");
      return { isComplete: false, needsAppUrl: false, needsDatabase: true, needsAdmin: true };
    }

    const service = databaseManager.getService();
    if (!service) {
      console.warn("[setup] databaseManager.getService() returned null");
      return { isComplete: false, needsAppUrl: false, needsDatabase: true, needsAdmin: true };
    }

    if (service.query) {
      const adminExists = await hasAnyAdmin();
      if (!adminExists) {
        return {
          isComplete: false,
          needsAppUrl: false,
          needsDatabase: false,
          needsAdmin: true,
          currentProvider: databaseManager.getConfig()?.provider,
        };
      }

      return {
        isComplete: true,
        needsAppUrl: false,
        needsDatabase: false,
        needsAdmin: false,
        currentProvider: databaseManager.getConfig()?.provider,
      };
    }

    // Provider doesn't support raw SQL (Firebase/Cosmos) — assume setup complete
    return {
      isComplete: true,
      needsAppUrl: false,
      needsDatabase: false,
      needsAdmin: false,
      currentProvider: databaseManager.getConfig()?.provider,
    };
  } catch (error) {
    // If the DB is configured but the query failed (e.g. transient connection
    // error during container startup), do NOT redirect to /setup — that would
    // lock users out even when everything is properly configured.
    // Auth guards on protected routes still apply, so failing open here is safe.
    if (databaseManager.isConfigured()) {
      console.warn(
        "[setup] checkSetupStatus query failed but DB is configured; assuming setup is complete:",
        error,
      );
      return {
        isComplete: true,
        needsAppUrl: false,
        needsDatabase: false,
        needsAdmin: false,
        currentProvider: databaseManager.getConfig()?.provider,
      };
    }
    console.error(
      "[setup] checkSetupStatus failed and DB is not configured:",
      error,
    );
    return { isComplete: false, needsAppUrl: false, needsDatabase: true, needsAdmin: true };
  }
}
