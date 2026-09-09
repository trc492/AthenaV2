/**
 * Shared helper that returns the active DatabaseService from the singleton
 * DatabaseManager. Import this in API routes instead of re-declaring the
 * module-level lazy-init pattern in every file.
 *
 * Usage:
 *   import { getDbService } from "@/lib/server/db-service";
 *   const service = getDbService();
 */
import { databaseManager } from "@/db/database-manager";
import type { DatabaseService } from "@/lib/types";

export function getDbService(): DatabaseService {
  return databaseManager.getService();
}
