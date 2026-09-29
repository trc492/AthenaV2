import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { QueuedEntry } from "@/lib/offline-types";

const { storage } = vi.hoisted(() => ({ storage: {
  init: vi.fn(), getSyncConfig: vi.fn(), setSyncConfig: vi.fn(),
  getPendingEntries: vi.fn(), updateEntryStatus: vi.fn(), logSyncResult: vi.fn(),
  queuePitEntry: vi.fn(), queueMatchEntry: vi.fn(), close: vi.fn(),
} }));
vi.mock("@/lib/indexeddb-service", () => ({ indexedDBService: storage }));

describe("offline sync without a window (service worker)", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.stubGlobal("window", undefined);
    vi.stubGlobal("indexedDB", {});
    storage.getSyncConfig.mockResolvedValue({ maxRetries: 3, retryDelayMs: 1000, batchSize: 10, autoSyncEnabled: true });
  });
  afterEach(() => vi.unstubAllGlobals());

  const entries: QueuedEntry[] = [
    { id: "pit-1", type: "pit", status: "pending", attempts: 0, createdAt: new Date(),
      data: { teamNumber: 123, year: 2026, competitionType: "FRC", eventCode: "test", driveTrain: "Swerve", gameSpecificData: {} } },
    { id: "match-1", type: "match", status: "pending", attempts: 0, createdAt: new Date(),
      data: { teamNumber: 123, year: 2026, competitionType: "FRC", eventCode: "test", matchNumber: 1, alliance: "red", gameSpecificData: {}, notes: "", timestamp: new Date() } },
  ];

  it("uploads both entry types and records their remote IDs", async () => {
    const fetch = vi.fn().mockResolvedValueOnce(Response.json({ id: 101 })).mockResolvedValueOnce(Response.json({ id: 102 }));
    vi.stubGlobal("fetch", fetch);
    storage.getPendingEntries.mockResolvedValue(entries);
    const { offlineQueueManager } = await import("@/lib/offline-queue-manager");
    const result = await offlineQueueManager.syncPendingEntries();
    expect(result).toMatchObject({ success: true, syncedCount: 2, failedCount: 0 });
    expect(fetch).toHaveBeenCalledWith("/api/scouting/entries/pit", expect.objectContaining({ method: "POST", credentials: "same-origin", body: JSON.stringify(entries[0].data) }));
    expect(fetch).toHaveBeenCalledWith("/api/scouting/entries/match", expect.objectContaining({ method: "POST" }));
    expect(storage.updateEntryStatus).toHaveBeenCalledWith("pit-1", "synced", 101);
    expect(storage.updateEntryStatus).toHaveBeenCalledWith("match-1", "synced", 102);
  });

  it.each(["network", "server"])("keeps a failed %s upload pending without requeueing it or scheduling worker timers", async (failure) => {
    vi.stubGlobal("fetch", failure === "network"
      ? vi.fn().mockRejectedValue(new TypeError("Failed to fetch"))
      : vi.fn().mockResolvedValue(new Response(null, { status: 503 })));
    storage.getPendingEntries.mockResolvedValue([entries[0]]);
    const { offlineQueueManager } = await import("@/lib/offline-queue-manager");
    const result = await offlineQueueManager.syncPendingEntries();
    expect(result).toMatchObject({ success: false, syncedCount: 0, failedCount: 1 });
    expect(storage.updateEntryStatus).toHaveBeenCalledWith("pit-1", "pending", undefined, expect.any(String));
    expect(storage.queuePitEntry).not.toHaveBeenCalled();
    expect(storage.queueMatchEntry).not.toHaveBeenCalled();
  });
});
