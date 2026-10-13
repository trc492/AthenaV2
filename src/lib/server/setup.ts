import { databaseManager } from "@/db/database-manager";
import { loadAppConfig } from "@/lib/server/env-file";
import { hasAnyAdmin } from "./user-service";
import { hasSavedSetupCompletion, saveSetupCompletion } from "./setup-completion";

export interface SetupStatus {
  isComplete: boolean;
  needsAppUrl: boolean;
  needsDatabase: boolean;
  needsAdmin: boolean;
  currentProvider?: string;
}

export async function checkSetupStatus(
  options: { useCachedCompletion?: boolean } = {},
): Promise<SetupStatus> {
  const appConfig = loadAppConfig();
  const needsAppUrl = !appConfig?.appUrl;

  try {
    if (!databaseManager.isConfigured()) {
      console.warn("[setup] No database provider configured");
      return {
        isComplete: false,
        needsAppUrl,
        needsDatabase: true,
        needsAdmin: true,
      };
    }

    const config = databaseManager.getConfig();
    // Public visits need setup routing, not a live account check. Setup pages
    // and mutation endpoints still verify the database directly.
    if (options.useCachedCompletion && config && hasSavedSetupCompletion(config)) {
      return {
        isComplete: !needsAppUrl,
        needsAppUrl,
        needsDatabase: false,
        needsAdmin: false,
        currentProvider: config.provider,
      };
    }

    const service = databaseManager.getService();
    if (!service) {
      console.warn("[setup] databaseManager.getService() returned null");
      return {
        isComplete: false,
        needsAppUrl,
        needsDatabase: true,
        needsAdmin: true,
      };
    }

    if (service.users) {
      const adminExists = await hasAnyAdmin();
      if (config) await saveSetupCompletion(config, adminExists);
      if (!adminExists) {
        return {
          isComplete: false,
          needsAppUrl,
          needsDatabase: false,
          needsAdmin: true,
          currentProvider: databaseManager.getConfig()?.provider,
        };
      }

      return {
        isComplete: !needsAppUrl,
        needsAppUrl,
        needsDatabase: false,
        needsAdmin: false,
        currentProvider: databaseManager.getConfig()?.provider,
      };
    }

    // A provider without account storage cannot complete credentials setup.
    return {
      isComplete: false,
      needsAppUrl,
      needsDatabase: false,
      needsAdmin: true,
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
        isComplete: !needsAppUrl,
        needsAppUrl,
        needsDatabase: false,
        needsAdmin: false,
        currentProvider: databaseManager.getConfig()?.provider,
      };
    }
    console.error(
      "[setup] checkSetupStatus failed and DB is not configured:",
      error,
    );
    return {
      isComplete: false,
      needsAppUrl,
      needsDatabase: true,
      needsAdmin: true,
    };
  }
}
