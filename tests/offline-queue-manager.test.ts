import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { MatchEntry, PitEntry } from "@/lib/types";
import { installFreshIndexedDB } from "./helpers/fake-indexeddb";

type Manager = (typeof import("@/lib/offline-queue-manager"))["offlineQueueManager"];
type Storage = (typeof import("@/lib/indexeddb-service"))["indexedDBService"];

let manager: Manager;
let storage: Storage;
let fetchMock: ReturnType<typeof vi.fn>;
let nextRemoteId: number;

function pit(teamNumber = 254): Omit<PitEntry, "id"> {
  return {
    teamNumber,
    year: 2025,
    competitionType: "FRC",
    eventCode: "CASJ",
    driveTrain: "Swerve",
    gameSpecificData: {},
  } as Omit<PitEntry, "id">;
}

function match(matchNumber = 1): Omit<MatchEntry, "id"> {
  return {
    matchNumber,
    teamNumber: 254,
    year: 2025,
    competitionType: "FRC",
    eventCode: "CASJ",
    alliance: "blue",
    notes: "",
    timestamp: new Date("2025-03-01T10:00:00Z"),
    gameSpecificData: {},
  } as Omit<MatchEntry, "id">;
}

const ok = () => new Response(JSON.stringify({ id: nextRemoteId++ }), { status: 200 });
const serverError = () => new Response("nope", { status: 500 });

async function entryById(id: string) {
  return (await storage.getAllQueuedEntries()).find((e) => e.id === id)!;
}

beforeEach(async () => {
  installFreshIndexedDB();
  nextRemoteId = 100;
  fetchMock = vi.fn(async () => ok());
  vi.stubGlobal("fetch", fetchMock);
  vi.spyOn(console, "error").mockImplementation(() => {});
  ({ offlineQueueManager: manager } = await import("@/lib/offline-queue-manager"));
  ({ indexedDBService: storage } = await import("@/lib/indexeddb-service"));
  await manager.setSyncConfig({ maxRetries: 3, retryDelayMs: 1000, batchSize: 10 });
});

afterEach(() => {
  manager.destroy();
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe("offlineQueueManager setup", () => {
  it("writes the default sync config on first use", async () => {
    installFreshIndexedDB();
    const fresh = (await import("@/lib/offline-queue-manager")).offlineQueueManager;
    expect(await fresh.getSyncConfig()).toEqual({
      maxRetries: 3,
      retryDelayMs: 1000,
      batchSize: 10,
      autoSyncEnabled: false,
    });
    fresh.destroy();
  });

  it("merges partial config updates", async () => {
    await manager.setSyncConfig({ autoSyncEnabled: true });
    expect(await manager.getSyncConfig()).toMatchObject({ autoSyncEnabled: true, maxRetries: 3 });
  });
});

describe("offlineQueueManager.syncPendingEntries", () => {
  it("posts each queued entry and marks it synced with the server id", async () => {
    const pitId = await manager.queuePitEntry(pit());
    const matchId = await manager.queueMatchEntry(match());
    const listener = vi.fn();
    manager.addSyncListener(listener);

    const result = await manager.syncPendingEntries();

    expect(result).toMatchObject({ success: true, syncedCount: 2, failedCount: 0, errors: [] });
    expect(fetchMock.mock.calls.map(([url]) => url).sort()).toEqual([
      "/api/scouting/entries/match",
      "/api/scouting/entries/pit",
    ]);
    const [, init] = fetchMock.mock.calls[0];
    expect(init).toMatchObject({ method: "POST", credentials: "same-origin" });

    expect((await entryById(pitId)).status).toBe("synced");
    expect((await entryById(matchId)).remoteId).toEqual(expect.any(Number));
    expect(await manager.getPendingCount()).toBe(0);
    expect(listener).toHaveBeenCalledWith(result);
    expect(await manager.getRecentSyncLogs()).toHaveLength(1);
  });

  it("keeps a failed entry pending with its error so it can be retried", async () => {
    fetchMock.mockImplementation(async () => serverError());
    const id = await manager.queuePitEntry(pit());

    const result = await manager.syncPendingEntries();

    expect(result).toMatchObject({ success: false, syncedCount: 0, failedCount: 1 });
    expect(result.errors[0]).toContain("(500)");
    const entry = await entryById(id);
    expect(entry.status).toBe("pending");
    expect(entry.error).toContain("(500)");
  });

  it("counts an entry the server already has as uploaded, not failed", async () => {
    fetchMock.mockImplementation(async () => new Response("{}", { status: 409 }));
    const id = await manager.queueMatchEntry(match());

    const result = await manager.syncPendingEntries();

    expect(result).toMatchObject({ success: true, syncedCount: 1, failedCount: 0 });
    const entry = await entryById(id);
    expect(entry.status).toBe("synced");
    expect(entry.remoteId).toBeUndefined();
  });

  it("re-sends an entry whose earlier attempt was interrupted", async () => {
    const id = await manager.queuePitEntry(pit());
    await storage.updateEntryStatus(id, "syncing");
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(Date.now() + 60_000);

    const result = await manager.syncPendingEntries();

    expect(result.syncedCount).toBe(1);
    expect((await entryById(id)).status).toBe("synced");
  });

  it("leaves an attempt that may still be in flight alone", async () => {
    const id = await manager.queuePitEntry(pit());
    await storage.updateEntryStatus(id, "syncing");

    const result = await manager.syncPendingEntries();

    expect(result.syncedCount).toBe(0);
    expect(fetchMock).not.toHaveBeenCalled();
    expect((await entryById(id)).status).toBe("syncing");
  });

  it("does not spend retries while the session is expired", async () => {
    fetchMock.mockImplementation(async () => new Response("{}", { status: 401 }));
    const id = await manager.queuePitEntry(pit());

    for (let attempt = 0; attempt < 5; attempt++) {
      await manager.syncPendingEntries();
      manager.clearRetryTimeouts();
    }

    const entry = await entryById(id);
    expect(entry.status).toBe("pending");
    expect(entry.attempts).toBe(0);
  });

  it("treats a response without an id as a failure", async () => {
    fetchMock.mockImplementation(async () => new Response("{}", { status: 200 }));
    const id = await manager.queueMatchEntry(match());

    const result = await manager.syncPendingEntries();

    expect(result.failedCount).toBe(1);
    expect((await entryById(id)).status).toBe("pending");
  });

  it("treats a network error as a failure without losing the entry", async () => {
    fetchMock.mockRejectedValue(new TypeError("Failed to fetch"));
    const id = await manager.queuePitEntry(pit());

    await manager.syncPendingEntries();

    expect((await entryById(id)).status).toBe("pending");
  });

  it("moves an entry to error after maxRetries failed sync attempts", async () => {
    fetchMock.mockImplementation(async () => serverError());
    const id = await manager.queuePitEntry(pit());

    for (let attempt = 1; attempt <= 3; attempt++) {
      await manager.syncPendingEntries();
      const entry = await entryById(id);
      expect(entry.attempts).toBe(attempt);
      expect(entry.status).toBe(attempt < 3 ? "pending" : "error");
    }
    expect(fetchMock).toHaveBeenCalledTimes(3);

    // An errored entry is no longer picked up automatically.
    await manager.syncPendingEntries();
    expect(fetchMock).toHaveBeenCalledTimes(3);
  });

  it("clears the stale error once an entry finally syncs", async () => {
    fetchMock.mockImplementationOnce(async () => serverError());
    const id = await manager.queuePitEntry(pit());

    await manager.syncPendingEntries();
    await manager.syncPendingEntries();

    const entry = await entryById(id);
    expect(entry.status).toBe("synced");
    expect(entry.error).toBeUndefined();
  });

  it("syncs every entry when there are more than one batch", async () => {
    await manager.setSyncConfig({ batchSize: 2 });
    for (let team = 1; team <= 5; team++) await manager.queuePitEntry(pit(team));

    const result = await manager.syncPendingEntries();

    expect(result.syncedCount).toBe(5);
    expect(fetchMock).toHaveBeenCalledTimes(5);
  });

  it("refuses to start a second sync while one is running", async () => {
    let release!: () => void;
    fetchMock.mockImplementation(
      () => new Promise<Response>((resolve) => (release = () => resolve(ok()))),
    );
    await manager.queuePitEntry(pit());

    const first = manager.syncPendingEntries();
    await vi.waitFor(() => expect(fetchMock).toHaveBeenCalled());
    expect(manager.isSyncInProgress()).toBe(true);
    await expect(manager.syncPendingEntries()).rejects.toThrow("Sync already in progress");

    release();
    await first;
    expect(manager.isSyncInProgress()).toBe(false);
  });

  it("keeps notifying other listeners when one throws", async () => {
    const good = vi.fn();
    manager.addSyncListener(() => {
      throw new Error("listener bug");
    });
    manager.addSyncListener(good);

    await manager.syncPendingEntries();

    expect(good).toHaveBeenCalledOnce();
  });
});

describe("offlineQueueManager.retryFailedEntries", () => {
  it("gives errored entries a fresh set of attempts", async () => {
    fetchMock.mockImplementation(async () => serverError());
    const id = await manager.queuePitEntry(pit());
    for (let i = 0; i < 3; i++) await manager.syncPendingEntries();
    expect((await entryById(id)).status).toBe("error");

    // Still failing: a manual retry should not immediately give up again.
    await manager.retryFailedEntries();
    expect((await entryById(id)).status).toBe("pending");

    fetchMock.mockImplementation(async () => ok());
    const result = await manager.retryFailedEntries();
    expect(result.syncedCount).toBe(1);
    expect((await entryById(id)).status).toBe("synced");
  });
});

describe("offlineQueueManager scheduled retry (browser tab)", () => {
  it("retries a failed entry on its own after the retry delay", async () => {
    vi.stubGlobal("window", globalThis);
    const id = await manager.queuePitEntry(pit());
    fetchMock.mockImplementationOnce(async () => serverError());
    vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout"] });

    await manager.syncPendingEntries();
    expect((await entryById(id)).status).toBe("pending");

    await vi.advanceTimersByTimeAsync(1200);
    await vi.waitFor(async () => expect((await entryById(id)).status).toBe("synced"));
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });
});

describe("offlineQueueManager.dedupePendingEntries", () => {
  async function seed(id: string, status: "pending" | "syncing" | "error" | "synced", createdAt: number) {
    await new Promise<void>((resolve, reject) => {
      const request = indexedDB.open("athena-offline-cache");
      request.onsuccess = () => {
        const tx = request.result.transaction("queue", "readwrite");
        tx.objectStore("queue").put({
          id,
          type: "match",
          status,
          data: match(7),
          createdAt: new Date(createdAt),
          attempts: 0,
        });
        tx.oncomplete = () => {
          request.result.close();
          resolve();
        };
        tx.onerror = () => reject(tx.error);
      };
    });
  }

  it("keeps the best unsynced copy of each entry and leaves synced history alone", async () => {
    await seed("old-error", "error", 1);
    await seed("newer-pending", "pending", 3);
    await seed("oldest-pending", "pending", 2);
    await seed("synced", "synced", 0);

    const result = await manager.dedupePendingEntries();

    expect(result.removedEntryIds.sort()).toEqual(["newer-pending", "old-error"]);
    expect(result).toMatchObject({ removedCount: 2, remainingUnsyncedCount: 1, remainingPendingCount: 1 });
    expect((await storage.getAllQueuedEntries()).map((e) => e.id).sort()).toEqual([
      "oldest-pending",
      "synced",
    ]);
  });
});
