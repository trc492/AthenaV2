import { IDBFactory, IDBKeyRange } from "fake-indexeddb";
import { vi } from "vitest";

/**
 * Give each test a brand-new, empty in-memory IndexedDB and fresh module
 * singletons (indexedDBService / offlineQueueManager cache their connection).
 */
export function installFreshIndexedDB(): void {
  vi.resetModules();
  vi.stubGlobal("indexedDB", new IDBFactory());
  vi.stubGlobal("IDBKeyRange", IDBKeyRange);
}
