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
    return {
      isComplete: false,
      needsDatabase: true,
      needsAdmin: true,
    };
  }
}
