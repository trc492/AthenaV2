// Offline Queue Manager
// Handles synchronization of cached data when connectivity is restored

import { indexedDBService } from "@/lib/indexeddb-service";
import type { PitEntry, MatchEntry } from "@/lib/types";
import type {
  QueuedEntry,
  QueuedPitEntry,
  QueuedMatchEntry,
  SyncResult,
  SyncConfig,
  SyncStatus,
  DedupeQueueResult,
} from "@/lib/offline-types";

// Default sync configuration
const DEFAULT_SYNC_CONFIG: SyncConfig = {
  maxRetries: 3,
  retryDelayMs: 1000,
  batchSize: 10,
  autoSyncEnabled: false,
};

class OfflineQueueManager {
  private syncInProgress = false;
  private syncListeners: Array<(result: SyncResult) => void> = [];
  private retryTimeouts = new Map<string, NodeJS.Timeout>();
  private initialized = false;

  constructor() {
    // Only initialize in browser environment
    if (typeof indexedDB !== "undefined") {
      this.init();
    }
  }

  // Initialize the queue manager
  private async init(): Promise<void> {
    if (this.initialized || typeof indexedDB === "undefined") {
      return;
    }

    try {
      await indexedDBService.init();

      // Set default config if none exists
      const config = await indexedDBService.getSyncConfig();
      if (!config) {
        await indexedDBService.setSyncConfig(DEFAULT_SYNC_CONFIG);
      }

      this.initialized = true;
    } catch (error) {
      console.error("Failed to initialize offline queue manager:", error);
    }
  }

  // Add a pit entry to the offline queue
  async queuePitEntry(
    data: Omit<PitEntry, "id">,
  ): Promise<string> {
    if (typeof indexedDB === "undefined") {
      throw new Error(
        "Queue operations are only available in browser environment",
      );
    }

    try {
      await this.ensureInitialized();
      return await indexedDBService.queuePitEntry(data);
    } catch (error) {
      console.error("Failed to queue pit entry:", error);
      throw error;
    }
  }

  // Add a match entry to the offline queue
  async queueMatchEntry(
    data: Omit<MatchEntry, "id">,
  ): Promise<string> {
    if (typeof indexedDB === "undefined") {
      throw new Error(
        "Queue operations are only available in browser environment",
      );
    }

    try {
      await this.ensureInitialized();
      return await indexedDBService.queueMatchEntry(data);
    } catch (error) {
      console.error("Failed to queue match entry:", error);
      throw error;
    }
  }

  // Ensure the manager is initialized before operations
  private async ensureInitialized(): Promise<void> {
    if (!this.initialized && typeof indexedDB !== "undefined") {
      await this.init();
    }
  }

  // Sync all pending entries
  async syncPendingEntries(): Promise<SyncResult> {
    if (typeof indexedDB === "undefined") {
      throw new Error(
        "Sync operations are only available in browser environment",
      );
    }

    if (this.syncInProgress) {
      throw new Error("Sync already in progress");
    }

    this.syncInProgress = true;
    const startTime = new Date();
    let syncedCount = 0;
    let failedCount = 0;
    const errors: string[] = [];

    try {
      await this.ensureInitialized();
      const config = await this.getSyncConfig();
      const pendingEntries = await indexedDBService.getPendingEntries();

      // Process entries in batches
      const batches = this.createBatches(pendingEntries, config.batchSize);

      for (const batch of batches) {
        const batchResult = await this.syncBatch(batch, config);
        syncedCount += batchResult.syncedCount;
        failedCount += batchResult.failedCount;
        errors.push(...batchResult.errors);
      }

      const result: SyncResult = {
        success: failedCount === 0,
        syncedCount,
        failedCount,
        errors,
        timestamp: startTime,
      };

      // Log the sync result
      await indexedDBService.logSyncResult(result);

      // Notify listeners
      this.notifySyncListeners(result);

      return result;
    } catch (error) {
      const result: SyncResult = {
        success: false,
        syncedCount,
        failedCount: failedCount + 1,
        errors: [
          ...errors,
          error instanceof Error ? error.message : "Unknown sync error",
        ],
        timestamp: startTime,
      };

      await indexedDBService.logSyncResult(result);
      this.notifySyncListeners(result);

      throw error;
    } finally {
      this.syncInProgress = false;
    }
  }

  // Sync a batch of entries
  private async syncBatch(
    entries: QueuedEntry[],
    config: SyncConfig,
  ): Promise<SyncResult> {
    let syncedCount = 0;
    let failedCount = 0;
    const errors: string[] = [];

    for (const entry of entries) {
      try {
        await this.syncSingleEntry(entry, config);
        syncedCount++;
      } catch (error) {
        failedCount++;
        const errorMessage =
          error instanceof Error ? error.message : "Unknown error";
        errors.push(`Entry ${entry.id}: ${errorMessage}`);

        // Update entry status to error if max retries exceeded
        if (entry.attempts >= config.maxRetries) {
          await indexedDBService.updateEntryStatus(
            entry.id,
            "error",
            undefined,
            errorMessage,
          );
        }
      }
    }

    return {
      success: failedCount === 0,
      syncedCount,
      failedCount,
      errors,
      timestamp: new Date(),
    };
  }

  // Sync a single entry
  private async syncSingleEntry(
    entry: QueuedEntry,
    config: SyncConfig,
  ): Promise<void> {
    // Mark as syncing
    await indexedDBService.updateEntryStatus(entry.id, "syncing");

    try {
      let remoteId: number;

      if (entry.type === "pit") {
        const pitEntry = entry as QueuedPitEntry;
        const result = await this.submitEntry("pit", pitEntry.data);
        if (!result.id) {
          throw new Error("Sync response did not include an entry ID");
        }
        remoteId = result.id;
      } else if (entry.type === "match") {
        const matchEntry = entry as QueuedMatchEntry;
        const result = await this.submitEntry("match", matchEntry.data);
        if (!result.id) {
          throw new Error("Sync response did not include an entry ID");
        }
        remoteId = result.id;
      } else {
        throw new Error(`Unknown entry type: ${entry.type}`);
      }

      // Mark as synced and store remote ID
      await indexedDBService.updateEntryStatus(entry.id, "synced", remoteId);

      // Clear any existing retry timeout
      const timeoutId = this.retryTimeouts.get(entry.id);
      if (timeoutId) {
        clearTimeout(timeoutId);
        this.retryTimeouts.delete(entry.id);
      }
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : "Unknown error";

      // If we haven't exceeded max retries, schedule a retry
      if (entry.attempts < config.maxRetries) {
        await indexedDBService.updateEntryStatus(
          entry.id,
          "pending",
          undefined,
          errorMessage,
        );
        // Workers rely on the rejected Background Sync event for retries.
        // Timers cannot keep a service worker alive after the event settles.
        if (typeof window !== "undefined") this.scheduleRetry(entry.id, config);
      } else {
        await indexedDBService.updateEntryStatus(
          entry.id,
          "error",
          undefined,
          errorMessage,
        );
      }

      throw error;
    }
  }

  // Replay directly: the normal create client queues on network failure,
  // which would reset the entry and its retry count during a sync attempt.
  private async submitEntry(
    type: "pit" | "match",
    data: QueuedEntry["data"],
  ): Promise<{ id: number }> {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 8000);
    try {
      const response = await fetch(`/api/scouting/entries/${type}`, {
        method: "POST",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
        signal: controller.signal,
      });
      if (!response.ok) {
        throw new Error(`Failed to sync ${type} entry (${response.status})`);
      }
      return await response.json();
    } finally {
      clearTimeout(timeout);
    }
  }

  // Schedule a retry for failed entry
  private scheduleRetry(entryId: string, config: SyncConfig): void {
    // Clear existing timeout if any
    const existingTimeout = this.retryTimeouts.get(entryId);
    if (existingTimeout) {
      clearTimeout(existingTimeout);
    }

    // Calculate exponential backoff delay
    const baseDelay = config.retryDelayMs;
    const randomFactor = 0.1 * Math.random(); // Add jitter
    const delay = baseDelay * (1 + randomFactor);

    const timeoutId = setTimeout(async () => {
      try {
        const entry = await this.getQueuedEntry(entryId);
        if (entry && entry.status === "pending") {
          await this.syncSingleEntry(entry, config);
        }
      } catch (error) {
        console.error(`Retry failed for entry ${entryId}:`, error);
      } finally {
        this.retryTimeouts.delete(entryId);
      }
    }, delay);

    this.retryTimeouts.set(entryId, timeoutId);
  }

  // Get a specific queued entry
  private async getQueuedEntry(id: string): Promise<QueuedEntry | null> {
    const allEntries = await indexedDBService.getAllQueuedEntries();
    return allEntries.find((entry) => entry.id === id) || null;
  }

  // Create batches from entries
  private createBatches<T>(items: T[], batchSize: number): T[][] {
    const batches: T[][] = [];
    for (let i = 0; i < items.length; i += batchSize) {
      batches.push(items.slice(i, i + batchSize));
    }
    return batches;
  }

  // Get sync configuration
  async getSyncConfig(): Promise<SyncConfig> {
    if (typeof indexedDB === "undefined") {
      return DEFAULT_SYNC_CONFIG;
    }

    await this.ensureInitialized();
    const config = await indexedDBService.getSyncConfig();
    return config || DEFAULT_SYNC_CONFIG;
  }

  // Update sync configuration
  async setSyncConfig(config: Partial<SyncConfig>): Promise<void> {
    if (typeof indexedDB === "undefined") {
      return;
    }

    await this.ensureInitialized();
    const currentConfig = await this.getSyncConfig();
    const newConfig = { ...currentConfig, ...config };

    await indexedDBService.setSyncConfig(newConfig);
  }

  // Get count of pending entries
  async getPendingCount(): Promise<number> {
    if (typeof indexedDB === "undefined") {
      return 0;
    }

    await this.ensureInitialized();
    return indexedDBService.getEntryCount("pending");
  }

  // Get count of all queued entries
  async getTotalQueuedCount(): Promise<number> {
    if (typeof indexedDB === "undefined") {
      return 0;
    }

    await this.ensureInitialized();
    return indexedDBService.getEntryCount();
  }

  // Get count by status
  async getCountByStatus(status: SyncStatus): Promise<number> {
    if (typeof indexedDB === "undefined") {
      return 0;
    }

    await this.ensureInitialized();
    return indexedDBService.getEntryCount(status);
  }

  // Get all queued entries (for UI display)
  async getAllQueuedEntries(): Promise<QueuedEntry[]> {
    if (typeof indexedDB === "undefined") {
      return [];
    }

    await this.ensureInitialized();
    return indexedDBService.getAllQueuedEntries();
  }

  // Clear all synced entries
  async clearSyncedEntries(): Promise<number> {
    if (typeof indexedDB === "undefined") {
      return 0;
    }

    await this.ensureInitialized();
    return indexedDBService.clearSyncedEntries();
  }

  // Get recent sync logs
  async getRecentSyncLogs(limit = 10): Promise<SyncResult[]> {
    if (typeof indexedDB === "undefined") {
      return [];
    }

    await this.ensureInitialized();
    return indexedDBService.getRecentSyncLogs(limit);
  }

  // Check if sync is in progress
  isSyncInProgress(): boolean {
    return this.syncInProgress;
  }

  // Add sync listener
  addSyncListener(listener: (result: SyncResult) => void): void {
    this.syncListeners.push(listener);
  }

  // Remove sync listener
  removeSyncListener(listener: (result: SyncResult) => void): void {
    const index = this.syncListeners.indexOf(listener);
    if (index > -1) {
      this.syncListeners.splice(index, 1);
    }
  }

  // Notify all sync listeners
  private notifySyncListeners(result: SyncResult): void {
    this.syncListeners.forEach((listener) => {
      try {
        listener(result);
      } catch (error) {
        console.error("Error in sync listener:", error);
      }
    });
  }

  // Force retry all failed entries
  async retryFailedEntries(): Promise<SyncResult> {
    if (typeof indexedDB === "undefined") {
      throw new Error(
        "Retry operations are only available in browser environment",
      );
    }

    await this.ensureInitialized();
    const failedEntries = await this.getEntriesByStatus("error");

    // Reset failed entries to pending
    for (const entry of failedEntries) {
      await indexedDBService.updateEntryStatus(entry.id, "pending");
    }

    return this.syncPendingEntries();
  }

  // Get entries by status
  private async getEntriesByStatus(status: SyncStatus): Promise<QueuedEntry[]> {
    const allEntries = await indexedDBService.getAllQueuedEntries();
    return allEntries.filter((entry) => entry.status === status);
  }

  // Build the key used to detect duplicate queue entries.
  // This matches the same uniqueness rules enforced by the backend.
  private getDedupeKey(entry: QueuedEntry): string {
    const base = [
      entry.type,
      String(entry.data.year),
      String(entry.data.competitionType),
      String(entry.data.eventCode ?? ""),
      String(entry.data.teamNumber),
    ];

    if (entry.type === "match") {
      base.push(String((entry.data as QueuedMatchEntry["data"]).matchNumber));
    }

    return base.join("|");
  }

  // Remove duplicate unsynced entries, keeping the best candidate for each key.
  async dedupePendingEntries(): Promise<DedupeQueueResult> {
    if (typeof indexedDB === "undefined") {
      return {
        removedCount: 0,
        removedEntryIds: [],
        remainingUnsyncedCount: 0,
        remainingPendingCount: 0,
      };
    }

    await this.ensureInitialized();
    const allEntries = await indexedDBService.getAllQueuedEntries();
    const unsyncedEntries = allEntries.filter(
      (entry) => entry.status !== "synced",
    );
    const sortedEntries = [...unsyncedEntries].sort((a, b) => {
      return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
    });

    const getStatusPriority = (status: SyncStatus): number => {
      if (status === "pending") return 0;
      if (status === "syncing") return 1;
      return 2;
    };

    const keptByKey = new Map<string, QueuedEntry>();
    const duplicateIds: string[] = [];

    for (const entry of sortedEntries) {
      const key = this.getDedupeKey(entry);
      const existing = keptByKey.get(key);

      if (!existing) {
        keptByKey.set(key, entry);
        continue;
      }

      const existingPriority = getStatusPriority(existing.status);
      const currentPriority = getStatusPriority(entry.status);

      if (currentPriority < existingPriority) {
        duplicateIds.push(existing.id);
        keptByKey.set(key, entry);
        continue;
      }

      if (currentPriority > existingPriority) {
        duplicateIds.push(entry.id);
        continue;
      }

      const existingCreatedAt = new Date(existing.createdAt).getTime();
      const entryCreatedAt = new Date(entry.createdAt).getTime();
      if (entryCreatedAt < existingCreatedAt) {
        duplicateIds.push(existing.id);
        keptByKey.set(key, entry);
      } else {
        duplicateIds.push(entry.id);
      }
    }

    const removedCount = await indexedDBService.removeEntries(duplicateIds);
    const remainingUnsyncedCount = unsyncedEntries.length - removedCount;
    const remainingPendingCount = keptByKey.size
      ? Array.from(keptByKey.values()).filter(
          (entry) => entry.status === "pending",
        ).length
      : 0;

    return {
      removedCount,
      removedEntryIds: duplicateIds,
      remainingUnsyncedCount,
      remainingPendingCount,
    };
  }

  // Clear all retry timeouts
  clearRetryTimeouts(): void {
    this.retryTimeouts.forEach((timeout) => clearTimeout(timeout));
    this.retryTimeouts.clear();
  }

  // Cleanup when manager is destroyed
  destroy(): void {
    this.clearRetryTimeouts();
    this.syncListeners.length = 0;
    indexedDBService.close();
  }
}

// Singleton instance
export const offlineQueueManager = new OfflineQueueManager();
