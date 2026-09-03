import { databaseManager } from "@/db/database-manager";
import { hasAnyAdmin } from "./user-service";

export interface SetupStatus {
  isComplete: boolean;
  needsDatabase: boolean;
  needsAdmin: boolean;
  currentProvider?: string;
}

export async function checkSetupStatus(): Promise<SetupStatus> {
  try {
    if (!databaseManager.isConfigured()) {
      return { isComplete: false, needsDatabase: true, needsAdmin: true };
    }

    const service = databaseManager.getService();
    if (!service) {
      return { isComplete: false, needsDatabase: true, needsAdmin: true };
    }

    if (service.query) {
      const adminExists = await hasAnyAdmin();
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
    return {
      isComplete: false,
      needsDatabase: true,
      needsAdmin: true,
    };
  }
}
