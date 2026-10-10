// IndexedDB service for offline data caching
// Manages storage and retrieval of pit and match scouting data when offline

import type {
  CachedAnalysisData,
  CachedEventList,
  CachedEventTeams,
  CachedMatchEntries,
  CachedPitEntries,
  CachedScoutList,
  CachedTeamInfo,
  EventCacheStatus,
  EventScope,
  QueuedEntry,
  SyncConfig,
  SyncResult,
  SyncStatus,
} from "@/lib/offline-types";
import { DB_NAME, DB_VERSION, STORES, eventScopeKey } from "@/lib/offline-types";
import type { Event, MatchEntry, PitEntry } from "@/lib/types";

class IndexedDBService {
  private db: IDBDatabase | null = null;

  // Initialize IndexedDB connection
  async init(): Promise<void> {
    if (typeof indexedDB === "undefined") {
      throw new Error("IndexedDB is only available in browser environment");
    }

    return new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, DB_VERSION);

      request.onerror = () => {
        reject(new Error("Failed to open IndexedDB"));
      };

      request.onsuccess = () => {
        this.db = request.result;
        resolve();
      };

      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;

        // Version 5 caches used eventCode alone and cannot be safely scoped.
        // Recreate only downloaded caches; queued submissions and sync logs survive.
        if (event.oldVersion > 0 && event.oldVersion < 6) {
          for (const name of [STORES.EVENT_TEAMS, STORES.CACHED_PIT_ENTRIES,
            STORES.CACHED_MATCH_ENTRIES, STORES.CACHED_ANALYSIS_DATA,
            STORES.EVENT_CACHE_STATUS]) {
            if (db.objectStoreNames.contains(name)) db.deleteObjectStore(name);
          }
        }

        // Create queue store for pending entries
        if (!db.objectStoreNames.contains(STORES.QUEUE)) {
          const queueStore = db.createObjectStore(STORES.QUEUE, {
            keyPath: "id",
          });
          queueStore.createIndex("type", "type");
          queueStore.createIndex("status", "status");
          queueStore.createIndex("createdAt", "createdAt");
        }

        // Create sync log store for tracking sync operations
        if (!db.objectStoreNames.contains(STORES.SYNC_LOG)) {
          const syncStore = db.createObjectStore(STORES.SYNC_LOG, {
            keyPath: "id",
            autoIncrement: true,
          });
          syncStore.createIndex("timestamp", "timestamp");
        }

        // Create config store for sync settings
        if (!db.objectStoreNames.contains(STORES.CONFIG)) {
          db.createObjectStore(STORES.CONFIG, { keyPath: "key" });
        }

        // Create event teams cache store for offline scouting
        if (!db.objectStoreNames.contains(STORES.EVENT_TEAMS)) {
          const eventTeamsStore = db.createObjectStore(STORES.EVENT_TEAMS, {
            keyPath: ["eventCode", "year", "competitionType"],
          });
          eventTeamsStore.createIndex("cachedAt", "cachedAt");
        }

        // Create event list cache store for offline scouting
        if (!db.objectStoreNames.contains(STORES.EVENT_LIST)) {
          const eventListStore = db.createObjectStore(STORES.EVENT_LIST, {
            keyPath: ["teamNumber", "competitionType", "year"],
          });
          eventListStore.createIndex("cachedAt", "cachedAt");
        }

        // Create scout list cache store for tablet offline support
        if (!db.objectStoreNames.contains(STORES.SCOUT_LIST)) {
          const scoutListStore = db.createObjectStore(STORES.SCOUT_LIST, {
            keyPath: "id",
          });
          scoutListStore.createIndex("cachedAt", "cachedAt");
        }

        // Create cached pit entries store for full event cache
        if (!db.objectStoreNames.contains(STORES.CACHED_PIT_ENTRIES)) {
          const pitStore = db.createObjectStore(STORES.CACHED_PIT_ENTRIES, {
            keyPath: ["eventCode", "year", "competitionType"],
          });
          pitStore.createIndex("cachedAt", "cachedAt");
        }

        // Create cached match entries store for full event cache
        if (!db.objectStoreNames.contains(STORES.CACHED_MATCH_ENTRIES)) {
          const matchStore = db.createObjectStore(STORES.CACHED_MATCH_ENTRIES, {
            keyPath: ["eventCode", "year", "competitionType"],
          });
          matchStore.createIndex("cachedAt", "cachedAt");
        }

        // Create cached analysis data store for offline analysis page
        if (!db.objectStoreNames.contains(STORES.CACHED_ANALYSIS_DATA)) {
          const analysisStore = db.createObjectStore(
            STORES.CACHED_ANALYSIS_DATA,
            { keyPath: ["eventCode", "year", "competitionType"] },
          );
          analysisStore.createIndex("cachedAt", "cachedAt");
        }

        // Create event cache status store for tracking what's cached
        if (!db.objectStoreNames.contains(STORES.EVENT_CACHE_STATUS)) {
          const statusStore = db.createObjectStore(STORES.EVENT_CACHE_STATUS, {
            keyPath: ["eventCode", "year", "competitionType"],
          });
          statusStore.createIndex("cachedAt", "cachedAt");
        }
      };
    });
  }

  // Ensure database is initialized
  private async ensureDb(): Promise<IDBDatabase> {
    if (!this.db) {
      await this.init();
    }
    return this.db!;
  }

  // Generate unique ID for queue entries
  private generateId(): string {
    return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  // Build a stable key for queue entry deduplication.
  private getQueueDedupeKey(
    type: QueuedEntry["type"],
    data: QueuedEntry["data"],
  ): string {
    const base = [
      type,
      String(data.year),
      String(data.competitionType),
      String(data.eventCode ?? ""),
      String(data.teamNumber),
    ];

    if (type === "match") {
      base.push(String((data as Omit<MatchEntry, "id">).matchNumber));
    }

    return base.join("|");
  }

  // Queue a scouting entry, replacing an existing unsynced duplicate instead of appending.
  private async queueEntry(
    type: QueuedEntry["type"],
    data: QueuedEntry["data"],
  ): Promise<string> {
    const db = await this.ensureDb();
    const dedupeKey = this.getQueueDedupeKey(type, data);

    return new Promise((resolve, reject) => {
      const transaction = db.transaction([STORES.QUEUE], "readwrite");
      const store = transaction.objectStore(STORES.QUEUE);
      const getAllRequest = store.getAll();

      getAllRequest.onsuccess = () => {
        const entries = getAllRequest.result as QueuedEntry[];
        const existingUnsynced = entries.find((entry) => {
          if (entry.status === "synced") {
            return false;
          }

          return this.getQueueDedupeKey(entry.type, entry.data) === dedupeKey;
        });

        if (existingUnsynced) {
          const updatedEntry: QueuedEntry = {
            ...existingUnsynced,
            status: "pending",
            data,
            attempts: 0,
            error: undefined,
            lastAttempt: undefined,
          };

          const updateRequest = store.put(updatedEntry);
          updateRequest.onsuccess = () => resolve(existingUnsynced.id);
          updateRequest.onerror = () =>
            reject(new Error("Failed to update queued entry"));
          return;
        }

        const id = this.generateId();
        const queuedEntry: QueuedEntry = {
          id,
          type,
          status: "pending",
          data,
          createdAt: new Date(),
          attempts: 0,
        };

        const addRequest = store.add(queuedEntry);
        addRequest.onsuccess = () => resolve(id);
        addRequest.onerror = () =>
          reject(new Error(`Failed to queue ${type} entry`));
      };

      getAllRequest.onerror = () =>
        reject(new Error("Failed to inspect existing queue entries"));
    });
  }

  // Add pit entry to offline queue
  async queuePitEntry(data: Omit<PitEntry, "id">): Promise<string> {
    return this.queueEntry("pit", data);
  }

  // Add match entry to offline queue
  async queueMatchEntry(data: Omit<MatchEntry, "id">): Promise<string> {
    return this.queueEntry("match", data);
  }

  // Get all pending entries
  async getPendingEntries(): Promise<QueuedEntry[]> {
    const db = await this.ensureDb();

    return new Promise((resolve, reject) => {
      const transaction = db.transaction([STORES.QUEUE], "readonly");
      const store = transaction.objectStore(STORES.QUEUE);
      const index = store.index("status");
      const request = index.getAll("pending");

      request.onsuccess = () => resolve(request.result);
      request.onerror = () =>
        reject(new Error("Failed to get pending entries"));
    });
  }

  // Get all queued entries (any status)
  async getAllQueuedEntries(): Promise<QueuedEntry[]> {
    const db = await this.ensureDb();

    return new Promise((resolve, reject) => {
      const transaction = db.transaction([STORES.QUEUE], "readonly");
      const store = transaction.objectStore(STORES.QUEUE);
      const request = store.getAll();

      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(new Error("Failed to get queued entries"));
    });
  }

  // Update entry status
  async updateEntryStatus(
    id: string,
    status: SyncStatus,
    remoteId?: number,
    error?: string,
  ): Promise<void> {
    const db = await this.ensureDb();

    return new Promise((resolve, reject) => {
      const transaction = db.transaction([STORES.QUEUE], "readwrite");
      const store = transaction.objectStore(STORES.QUEUE);
      const getRequest = store.get(id);

      getRequest.onsuccess = () => {
        const entry = getRequest.result;
        if (!entry) {
          reject(new Error("Entry not found"));
          return;
        }

        entry.status = status;
        entry.lastAttempt = new Date();
        entry.attempts += 1;

        if (remoteId) {
          entry.remoteId = remoteId;
        }

        if (error) {
          entry.error = error;
        }

        const putRequest = store.put(entry);
        putRequest.onsuccess = () => resolve();
        putRequest.onerror = () =>
          reject(new Error("Failed to update entry status"));
      };

      getRequest.onerror = () =>
        reject(new Error("Failed to get entry for update"));
    });
  }

  // Remove entry from queue
  async removeEntry(id: string): Promise<void> {
    const db = await this.ensureDb();

    return new Promise((resolve, reject) => {
      const transaction = db.transaction([STORES.QUEUE], "readwrite");
      const store = transaction.objectStore(STORES.QUEUE);
      const request = store.delete(id);

      request.onsuccess = () => resolve();
      request.onerror = () => reject(new Error("Failed to remove entry"));
    });
  }

  // Remove multiple entries from queue
  async removeEntries(ids: string[]): Promise<number> {
    if (ids.length === 0) {
      return 0;
    }

    const db = await this.ensureDb();

    return new Promise((resolve, reject) => {
      let deletedCount = 0;
      const transaction = db.transaction([STORES.QUEUE], "readwrite");
      const store = transaction.objectStore(STORES.QUEUE);

      transaction.oncomplete = () => resolve(deletedCount);
      transaction.onerror = () => reject(new Error("Failed to remove entries"));

      ids.forEach((id) => {
        const request = store.delete(id);
        request.onsuccess = () => {
          deletedCount += 1;
        };
      });
    });
  }

  // Clear all synced entries
  async clearSyncedEntries(): Promise<number> {
    const db = await this.ensureDb();
    let deletedCount = 0;

    return new Promise((resolve, reject) => {
      const transaction = db.transaction([STORES.QUEUE], "readwrite");
      const store = transaction.objectStore(STORES.QUEUE);
      const index = store.index("status");
      const request = index.openCursor("synced");

      request.onsuccess = () => {
        const cursor = request.result;
        if (cursor) {
          cursor.delete();
          deletedCount++;
          cursor.continue();
        } else {
          resolve(deletedCount);
        }
      };

      request.onerror = () =>
        reject(new Error("Failed to clear synced entries"));
    });
  }

  // Get count of entries by status
  async getEntryCount(status?: SyncStatus): Promise<number> {
    const db = await this.ensureDb();

    return new Promise((resolve, reject) => {
      const transaction = db.transaction([STORES.QUEUE], "readonly");
      const store = transaction.objectStore(STORES.QUEUE);

      let request: IDBRequest;
      if (status) {
        const index = store.index("status");
        request = index.count(status);
      } else {
        request = store.count();
      }

      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(new Error("Failed to get entry count"));
    });
  }

  // Log sync operation result
  async logSyncResult(result: SyncResult): Promise<void> {
    const db = await this.ensureDb();

    return new Promise((resolve, reject) => {
      const transaction = db.transaction([STORES.SYNC_LOG], "readwrite");
      const store = transaction.objectStore(STORES.SYNC_LOG);
      const request = store.add(result);

      request.onsuccess = () => resolve();
      request.onerror = () => reject(new Error("Failed to log sync result"));
    });
  }

  // Get recent sync logs
  async getRecentSyncLogs(limit = 10): Promise<SyncResult[]> {
    const db = await this.ensureDb();

    return new Promise((resolve, reject) => {
      const transaction = db.transaction([STORES.SYNC_LOG], "readonly");
      const store = transaction.objectStore(STORES.SYNC_LOG);
      const index = store.index("timestamp");
      const request = index.openCursor(null, "prev");

      const results: SyncResult[] = [];

      request.onsuccess = () => {
        const cursor = request.result;
        if (cursor && results.length < limit) {
          results.push(cursor.value);
          cursor.continue();
        } else {
          resolve(results);
        }
      };

      request.onerror = () => reject(new Error("Failed to get sync logs"));
    });
  }

  // Save sync configuration
  async setSyncConfig(config: SyncConfig): Promise<void> {
    const db = await this.ensureDb();

    return new Promise((resolve, reject) => {
      const transaction = db.transaction([STORES.CONFIG], "readwrite");
      const store = transaction.objectStore(STORES.CONFIG);
      const request = store.put({ key: "syncConfig", value: config });

      request.onsuccess = () => resolve();
      request.onerror = () => reject(new Error("Failed to save sync config"));
    });
  }

  // Get sync configuration
  async getSyncConfig(): Promise<SyncConfig | null> {
    const db = await this.ensureDb();

    return new Promise((resolve, reject) => {
      const transaction = db.transaction([STORES.CONFIG], "readonly");
      const store = transaction.objectStore(STORES.CONFIG);
      const request = store.get("syncConfig");

      request.onsuccess = () => {
        const result = request.result;
        resolve(result ? result.value : null);
      };
      request.onerror = () => reject(new Error("Failed to get sync config"));
    });
  }

  // Clear all data (useful for testing/reset)
  async clearAllData(): Promise<void> {
    const db = await this.ensureDb();

    return new Promise((resolve, reject) => {
      const storeNames = [
        STORES.QUEUE,
        STORES.SYNC_LOG,
        STORES.CONFIG,
        STORES.EVENT_TEAMS,
        STORES.EVENT_LIST,
        STORES.SCOUT_LIST,
        STORES.CACHED_ANALYSIS_DATA,
        STORES.CACHED_PIT_ENTRIES,
        STORES.CACHED_MATCH_ENTRIES,
        STORES.EVENT_CACHE_STATUS,
      ];
      const transaction = db.transaction(storeNames, "readwrite");

      let completed = 0;

      storeNames.forEach((storeName) => {
        const store = transaction.objectStore(storeName);
        const request = store.clear();

        request.onsuccess = () => {
          completed++;
          if (completed === storeNames.length) {
            resolve();
          }
        };

        request.onerror = () =>
          reject(new Error(`Failed to clear ${storeName}`));
      });
    });
  }

  // ============================================
  // Event Teams Cache (for offline scouting)
  // ============================================

  private async readCache<T>(storeName: string, scope: EventScope): Promise<T | null> {
    const db = await this.ensureDb();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(storeName, "readonly");
      const request = transaction.objectStore(storeName).get(eventScopeKey(scope));
      transaction.oncomplete = () => resolve(request.result ?? null);
      transaction.onerror = transaction.onabort = () => reject(
        transaction.error ?? new Error(`Failed to read ${storeName}`),
      );
    });
  }

  private async writeCache(storeName: string, data: EventScope): Promise<void> {
    const db = await this.ensureDb();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(storeName, "readwrite");
      transaction.objectStore(storeName).put(data);
      transaction.oncomplete = () => resolve();
      transaction.onerror = transaction.onabort = () => reject(
        transaction.error ?? new Error(`Failed to write ${storeName}`),
      );
    });
  }

  cacheEventTeams(scope: EventScope, teams: CachedTeamInfo[]): Promise<void> {
    return this.writeCache(STORES.EVENT_TEAMS, {
      ...scope, teams, cachedAt: new Date(),
    } as CachedEventTeams);
  }

  getCachedEventTeams(scope: EventScope): Promise<CachedEventTeams | null> {
    return this.readCache(STORES.EVENT_TEAMS, scope);
  }

  // ============================================
  // Event List Cache (for offline scouting)
  // ============================================

  // Cache event list for offline access
  async cacheEventList(
    teamNumber: number,
    competitionType: string,
    year: number,
    events: Array<Event>,
  ): Promise<void> {
    const db = await this.ensureDb();

    const cachedData: CachedEventList = {
      teamNumber,
      competitionType,
      year,
      events,
      cachedAt: new Date(),
    };

    return new Promise((resolve, reject) => {
      const transaction = db.transaction([STORES.EVENT_LIST], "readwrite");
      const store = transaction.objectStore(STORES.EVENT_LIST);
      const request = store.put(cachedData);

      request.onsuccess = () => resolve();
      request.onerror = () => reject(new Error("Failed to cache event list"));
    });
  }

  // Get cached event list
  async getCachedEventList(
    teamNumber: number,
    competitionType: string,
    year: number,
  ): Promise<CachedEventList | null> {
    const db = await this.ensureDb();

    return new Promise((resolve, reject) => {
      const transaction = db.transaction([STORES.EVENT_LIST], "readonly");
      const store = transaction.objectStore(STORES.EVENT_LIST);
      const request = store.get([teamNumber, competitionType, year]);

      request.onsuccess = () => {
        const result = request.result;
        resolve(result || null);
      };
      request.onerror = () =>
        reject(new Error("Failed to get cached event list"));
    });
  }

  // ============================================
  // Scout List Cache (for tablet offline support)
  // ============================================

  // Cache scout list for offline access
  async cacheScoutList(
    scouts: Array<{
      id: string;
      name: string;
      username: string;
      role: string;
    }>,
  ): Promise<void> {
    const db = await this.ensureDb();

    const cachedData: CachedScoutList = {
      scouts,
      cachedAt: new Date(),
    };

    return new Promise((resolve, reject) => {
      const transaction = db.transaction([STORES.SCOUT_LIST], "readwrite");
      const store = transaction.objectStore(STORES.SCOUT_LIST);
      const request = store.put({ ...cachedData, id: "scout_list" });

      request.onsuccess = () => resolve();
      request.onerror = () => reject(new Error("Failed to cache scout list"));
    });
  }

  // Get cached scout list
  async getCachedScoutList(): Promise<CachedScoutList | null> {
    const db = await this.ensureDb();

    return new Promise((resolve, reject) => {
      const transaction = db.transaction([STORES.SCOUT_LIST], "readonly");
      const store = transaction.objectStore(STORES.SCOUT_LIST);
      const request = store.get("scout_list");

      request.onsuccess = () => {
        const result = request.result;
        resolve(result || null);
      };
      request.onerror = () =>
        reject(new Error("Failed to get cached scout list"));
    });
  }

  // ============================================
  // Full Event Data Cache
  // ============================================

  cachePitEntries(scope: EventScope, entries: PitEntry[]): Promise<void> {
    return this.writeCache(STORES.CACHED_PIT_ENTRIES, {
      ...scope, entries, cachedAt: new Date(),
    } as CachedPitEntries);
  }

  getCachedPitEntries(scope: EventScope): Promise<CachedPitEntries | null> {
    return this.readCache(STORES.CACHED_PIT_ENTRIES, scope);
  }

  cacheMatchEntries(scope: EventScope, entries: MatchEntry[]): Promise<void> {
    return this.writeCache(STORES.CACHED_MATCH_ENTRIES, {
      ...scope, entries, cachedAt: new Date(),
    } as CachedMatchEntries);
  }

  getCachedMatchEntries(scope: EventScope): Promise<CachedMatchEntries | null> {
    return this.readCache(STORES.CACHED_MATCH_ENTRIES, scope);
  }

  setEventCacheStatus(status: EventCacheStatus): Promise<void> {
    return this.writeCache(STORES.EVENT_CACHE_STATUS, status);
  }

  cacheAnalysisData(scope: EventScope, data: import("@/lib/types").AnalysisData): Promise<void> {
    return this.writeCache(STORES.CACHED_ANALYSIS_DATA, {
      ...scope, data, cachedAt: new Date(),
    } as CachedAnalysisData);
  }

  getCachedAnalysisData(scope: EventScope): Promise<CachedAnalysisData | null> {
    return this.readCache(STORES.CACHED_ANALYSIS_DATA, scope);
  }

  getEventCacheStatus(scope: EventScope): Promise<EventCacheStatus | null> {
    return this.readCache(STORES.EVENT_CACHE_STATUS, scope);
  }

  // Get all event cache statuses
  async getAllEventCacheStatuses(): Promise<EventCacheStatus[]> {
    const db = await this.ensureDb();

    return new Promise((resolve, reject) => {
      const transaction = db.transaction(
        [STORES.EVENT_CACHE_STATUS],
        "readonly",
      );
      const store = transaction.objectStore(STORES.EVENT_CACHE_STATUS);
      const request = store.getAll();

      request.onsuccess = () => resolve(request.result || []);
      request.onerror = () =>
        reject(new Error("Failed to get event cache statuses"));
    });
  }

  // Delete only the requested season/competition, leaving other caches intact.
  async clearEventCache(scope: EventScope): Promise<void> {
    const db = await this.ensureDb();
    const storeNames = [STORES.EVENT_TEAMS, STORES.CACHED_PIT_ENTRIES,
      STORES.CACHED_MATCH_ENTRIES, STORES.CACHED_ANALYSIS_DATA,
      STORES.EVENT_CACHE_STATUS];
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(storeNames, "readwrite");
      for (const name of storeNames) {
        transaction.objectStore(name).delete(eventScopeKey(scope));
      }
      transaction.oncomplete = () => resolve();
      transaction.onerror = transaction.onabort = () => reject(
        transaction.error ?? new Error("Failed to clear event cache"),
      );
    });
  }

  // Close database connection
  close(): void {
    if (this.db) {
      this.db.close();
      this.db = null;
    }
  }
}

// Singleton instance
export const indexedDBService = new IndexedDBService();
