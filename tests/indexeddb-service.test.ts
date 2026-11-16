import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { DB_NAME, STORES } from "@/lib/offline-types";
import type { EventScope } from "@/lib/offline-types";
import type { MatchEntry, PitEntry } from "@/lib/types";
import { installFreshIndexedDB } from "./helpers/fake-indexeddb";

type Service = (typeof import("@/lib/indexeddb-service"))["indexedDBService"];
let service: Service;

const scope: EventScope = { eventCode: "CASJ", competitionType: "FRC", year: 2025 };

function pit(overrides: Partial<PitEntry> = {}): Omit<PitEntry, "id"> {
  return {
    teamNumber: 254,
    year: 2025,
    competitionType: "FRC",
    eventCode: "CASJ",
    driveTrain: "Swerve",
    gameSpecificData: {},
    ...overrides,
  } as Omit<PitEntry, "id">;
}

function match(overrides: Partial<MatchEntry> = {}): Omit<MatchEntry, "id"> {
  return {
    matchNumber: 12,
    teamNumber: 254,
    year: 2025,
    competitionType: "FRC",
    eventCode: "CASJ",
    alliance: "red",
    notes: "",
    timestamp: new Date("2025-03-01T10:00:00Z"),
    gameSpecificData: {},
    ...overrides,
  } as Omit<MatchEntry, "id">;
}

beforeEach(async () => {
  installFreshIndexedDB();
  ({ indexedDBService: service } = await import("@/lib/indexeddb-service"));
});

afterEach(() => {
  service.close();
  vi.unstubAllGlobals();
});

describe("indexedDBService queue", () => {
  it("refuses to run without IndexedDB", async () => {
    vi.stubGlobal("indexedDB", undefined);
    await expect(service.init()).rejects.toThrow(/browser environment/);
  });

  it("queues entries as pending with zero attempts", async () => {
    const pitId = await service.queuePitEntry(pit());
    const matchId = await service.queueMatchEntry(match());

    const pending = await service.getPendingEntries();
    expect(pending.map((e) => e.id).sort()).toEqual([pitId, matchId].sort());
    expect(pending.every((e) => e.status === "pending" && e.attempts === 0)).toBe(true);
    expect(await service.getEntryCount()).toBe(2);
    expect(await service.getEntryCount("pending")).toBe(2);
  });

  it("replaces an unsynced duplicate instead of appending a second copy", async () => {
    const firstId = await service.queueMatchEntry(match({ notes: "first" }));
    await service.updateEntryStatus(firstId, "error", undefined, "boom");

    const secondId = await service.queueMatchEntry(match({ notes: "second" }));

    expect(secondId).toBe(firstId);
    const [entry] = await service.getAllQueuedEntries();
    expect(entry).toMatchObject({ status: "pending", attempts: 0, error: undefined });
    expect((entry.data as MatchEntry).notes).toBe("second");
  });

  it("treats different matches, teams and events as distinct entries", async () => {
    await service.queueMatchEntry(match());
    await service.queueMatchEntry(match({ matchNumber: 13 }));
    await service.queueMatchEntry(match({ teamNumber: 1678 }));
    await service.queueMatchEntry(match({ eventCode: "CADA" }));
    // Pit and match entries for the same team never collide.
    await service.queuePitEntry(pit());

    expect(await service.getEntryCount()).toBe(5);
  });

  it("appends a new entry once the previous one has synced", async () => {
    const firstId = await service.queuePitEntry(pit());
    await service.updateEntryStatus(firstId, "synced", 99);

    const secondId = await service.queuePitEntry(pit({ notes: "re-scouted" }));

    expect(secondId).not.toBe(firstId);
    expect(await service.getEntryCount()).toBe(2);
  });

  it("counts an attempt once, when syncing starts", async () => {
    const id = await service.queuePitEntry(pit());

    await service.updateEntryStatus(id, "syncing");
    await service.updateEntryStatus(id, "pending", undefined, "HTTP 500");
    let [entry] = await service.getAllQueuedEntries();
    expect(entry).toMatchObject({ status: "pending", attempts: 1, error: "HTTP 500" });
    expect(entry.lastAttempt).toBeInstanceOf(Date);

    await service.updateEntryStatus(id, "syncing");
    await service.updateEntryStatus(id, "synced", 42);
    [entry] = await service.getAllQueuedEntries();
    expect(entry).toMatchObject({ status: "synced", attempts: 2, remoteId: 42 });
    expect(entry.error).toBeUndefined();
  });

  it("resets an errored entry for a manual retry", async () => {
    const id = await service.queuePitEntry(pit());
    await service.updateEntryStatus(id, "syncing");
    await service.updateEntryStatus(id, "error", undefined, "HTTP 500");

    await service.resetEntryForRetry(id);

    const [entry] = await service.getAllQueuedEntries();
    expect(entry).toMatchObject({ status: "pending", attempts: 0, error: "HTTP 500" });
    await expect(service.resetEntryForRetry("missing")).rejects.toThrow("Entry not found");
  });

  it("rejects updates for unknown entries", async () => {
    await expect(service.updateEntryStatus("missing", "synced")).rejects.toThrow("Entry not found");
  });

  it("clears only synced entries", async () => {
    const synced = await service.queuePitEntry(pit());
    await service.queuePitEntry(pit({ teamNumber: 1 }));
    await service.updateEntryStatus(synced, "synced", 1);

    expect(await service.clearSyncedEntries()).toBe(1);
    const remaining = await service.getAllQueuedEntries();
    expect(remaining).toHaveLength(1);
    expect(remaining[0].status).toBe("pending");
  });

  it("removes entries by id in bulk", async () => {
    const a = await service.queuePitEntry(pit({ teamNumber: 1 }));
    const b = await service.queuePitEntry(pit({ teamNumber: 2 }));
    await service.queuePitEntry(pit({ teamNumber: 3 }));

    expect(await service.removeEntries([])).toBe(0);
    expect(await service.removeEntries([a, b])).toBe(2);
    expect(await service.getEntryCount()).toBe(1);
  });
});

describe("indexedDBService sync log and config", () => {
  it("returns the newest sync logs first, up to the limit", async () => {
    for (let i = 0; i < 4; i++) {
      await service.logSyncResult({
        success: true,
        syncedCount: i,
        failedCount: 0,
        errors: [],
        timestamp: new Date(2025, 0, 1, 0, i),
      });
    }

    const logs = await service.getRecentSyncLogs(2);
    expect(logs.map((log) => log.syncedCount)).toEqual([3, 2]);
  });

  it("round-trips the sync config", async () => {
    expect(await service.getSyncConfig()).toBeNull();
    const config = { maxRetries: 5, retryDelayMs: 10, batchSize: 2, autoSyncEnabled: true };
    await service.setSyncConfig(config);
    expect(await service.getSyncConfig()).toEqual(config);
  });

  it("clearAllData empties every store", async () => {
    await service.queuePitEntry(pit());
    await service.setSyncConfig({ maxRetries: 1, retryDelayMs: 1, batchSize: 1, autoSyncEnabled: false });
    await service.cacheEventTeams(scope, [{ teamNumber: 254, nickname: "Poofs", key: "frc254" }]);

    await service.clearAllData();

    expect(await service.getEntryCount()).toBe(0);
    expect(await service.getSyncConfig()).toBeNull();
    expect(await service.getCachedEventTeams(scope)).toBeNull();
  });
});

describe("indexedDBService event caches", () => {
  const otherYear: EventScope = { ...scope, year: 2024 };
  const otherProgram: EventScope = { ...scope, competitionType: "FTC" };

  it("keeps caches separate per event, year and competition type", async () => {
    await service.cachePitEntries(scope, [pit() as PitEntry]);
    await service.cachePitEntries(otherYear, []);

    expect((await service.getCachedPitEntries(scope))?.entries).toHaveLength(1);
    expect((await service.getCachedPitEntries(otherYear))?.entries).toHaveLength(0);
    expect(await service.getCachedPitEntries(otherProgram)).toBeNull();
  });

  it("clearEventCache removes one scope across every event store and keeps the queue", async () => {
    const queuedId = await service.queueMatchEntry(match());
    for (const s of [scope, otherYear]) {
      await service.cacheEventTeams(s, []);
      await service.cachePitEntries(s, []);
      await service.cacheMatchEntries(s, [match() as MatchEntry]);
      await service.setEventCacheStatus({
        ...s,
        eventName: "Silicon Valley",
        cachedAt: new Date(),
        pitEntryCount: 0,
        matchEntryCount: 1,
        teamCount: 0,
        schedulesCached: true,
        pagesCached: true,
        sessionCached: true,
      });
    }

    await service.clearEventCache(scope);

    expect(await service.getCachedEventTeams(scope)).toBeNull();
    expect(await service.getCachedPitEntries(scope)).toBeNull();
    expect(await service.getCachedMatchEntries(scope)).toBeNull();
    expect(await service.getEventCacheStatus(scope)).toBeNull();
    expect(await service.getCachedMatchEntries(otherYear)).not.toBeNull();
    expect(await service.getAllEventCacheStatuses()).toHaveLength(1);
    expect((await service.getAllQueuedEntries()).map((e) => e.id)).toEqual([queuedId]);
  });

  it("caches the event list and scout list", async () => {
    await service.cacheEventList(254, "FRC", 2025, []);
    await service.cacheScoutList([{ id: "u1", name: "Ada", username: "ada", role: "scout" }]);

    expect(await service.getCachedEventList(254, "FRC", 2025)).toMatchObject({ events: [] });
    expect(await service.getCachedEventList(254, "FTC", 2025)).toBeNull();
    expect((await service.getCachedScoutList())?.scouts).toHaveLength(1);
  });
});

describe("indexedDBService schema upgrade", () => {
  it("drops pre-v6 event caches but keeps queued submissions", async () => {
    // Build a version-5 database the way older app builds did.
    await new Promise<void>((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, 5);
      request.onupgradeneeded = () => {
        const db = request.result;
        db.createObjectStore(STORES.QUEUE, { keyPath: "id" }).createIndex("status", "status");
        db.createObjectStore(STORES.CACHED_PIT_ENTRIES, { keyPath: "eventCode" });
        request.transaction!.objectStore(STORES.QUEUE).put({
          id: "legacy-1",
          type: "pit",
          status: "pending",
          data: pit(),
          createdAt: new Date(),
          attempts: 0,
        });
        request.transaction!.objectStore(STORES.CACHED_PIT_ENTRIES).put({
          eventCode: "CASJ",
          entries: [],
        });
      };
      request.onsuccess = () => {
        request.result.close();
        resolve();
      };
      request.onerror = () => reject(request.error);
    });

    // The v6 cache key is [eventCode, year, competitionType]; a stale
    // eventCode-keyed store would make this read throw.
    expect(await service.getCachedPitEntries(scope)).toBeNull();
    expect((await service.getPendingEntries()).map((e) => e.id)).toEqual(["legacy-1"]);
  });
});
