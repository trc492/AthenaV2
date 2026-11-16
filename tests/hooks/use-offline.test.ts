// @vitest-environment happy-dom
import { act, renderHook, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { SyncResult } from "@/lib/offline-types";

const { queue, session } = vi.hoisted(() => ({
  queue: {
    syncPendingEntries: vi.fn(),
    retryFailedEntries: vi.fn(),
    clearSyncedEntries: vi.fn(),
    getPendingCount: vi.fn(),
    getTotalQueuedCount: vi.fn(),
    getSyncConfig: vi.fn(),
    setSyncConfig: vi.fn(),
    isSyncInProgress: vi.fn(),
    addSyncListener: vi.fn(),
    removeSyncListener: vi.fn(),
  },
  session: { current: { data: null as unknown } },
}));

vi.mock("@/lib/offline-queue-manager", () => ({ offlineQueueManager: queue }));
vi.mock("next-auth/react", () => ({ useSession: () => session.current }));

import { useOffline, useOnlineStatus } from "@/hooks/use-offline";

const okResult: SyncResult = {
  success: true,
  syncedCount: 2,
  failedCount: 0,
  errors: [],
  timestamp: new Date(),
};

function stubOnLine(online: boolean) {
  Object.defineProperty(navigator, "onLine", { configurable: true, get: () => online });
}

function setOnline(online: boolean) {
  stubOnLine(online);
  window.dispatchEvent(new Event(online ? "online" : "offline"));
}

const pause = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

beforeEach(() => {
  session.current = { data: { user: { id: "u1" } } };
  queue.getPendingCount.mockResolvedValue(2);
  queue.getTotalQueuedCount.mockResolvedValue(3);
  queue.getSyncConfig.mockResolvedValue({ autoSyncEnabled: true });
  queue.setSyncConfig.mockResolvedValue(undefined);
  queue.isSyncInProgress.mockReturnValue(false);
  queue.syncPendingEntries.mockResolvedValue(okResult);
  queue.retryFailedEntries.mockResolvedValue(okResult);
  queue.clearSyncedEntries.mockResolvedValue(1);
  vi.spyOn(console, "error").mockImplementation(() => {});
  stubOnLine(true);
});

afterEach(() => stubOnLine(true));

describe("useOffline", () => {
  it("reports queue counts from the offline queue", async () => {
    const { result } = renderHook(() => useOffline());

    await waitFor(() => expect(result.current.pendingCount).toBe(2));
    expect(result.current.totalQueuedCount).toBe(3);
    expect(result.current.autoSyncEnabled).toBe(true);
  });

  it("tracks online and offline transitions", async () => {
    const { result } = renderHook(() => useOffline());

    act(() => setOnline(false));
    expect(result.current.isOnline).toBe(false);
    expect(result.current.networkStatus.lastOffline).toBeInstanceOf(Date);

    act(() => setOnline(true));
    expect(result.current.isOnline).toBe(true);
    expect(result.current.networkStatus.lastOnline).toBeInstanceOf(Date);
  });

  it("syncs on demand and records the result", async () => {
    const { result } = renderHook(() => useOffline());

    let returned: SyncResult | undefined;
    await act(async () => {
      returned = await result.current.triggerSync();
    });

    expect(returned).toBe(okResult);
    expect(result.current.lastSyncResult).toBe(okResult);
    expect(result.current.syncInProgress).toBe(false);
  });

  it("refuses to sync while offline", async () => {
    const { result } = renderHook(() => useOffline());
    act(() => setOnline(false));

    await expect(result.current.triggerSync()).rejects.toThrow("Cannot sync while offline");
    await expect(result.current.retryFailedEntries()).rejects.toThrow(/offline/);
    expect(queue.syncPendingEntries).not.toHaveBeenCalled();
  });

  it("resets the in-progress flag when a sync fails", async () => {
    queue.syncPendingEntries.mockRejectedValue(new Error("server down"));
    const { result } = renderHook(() => useOffline());

    await act(async () => {
      await expect(result.current.triggerSync()).rejects.toThrow("server down");
    });
    expect(result.current.syncInProgress).toBe(false);
  });

  it("auto-syncs shortly after reconnecting when entries are waiting", async () => {
    const { result } = renderHook(() => useOffline());
    await waitFor(() => expect(result.current.pendingCount).toBe(2));
    act(() => setOnline(false));

    act(() => setOnline(true));

    await waitFor(() => expect(queue.syncPendingEntries).toHaveBeenCalledOnce(), {
      timeout: 2500,
    });
  });

  it("does not auto-sync on reconnect when auto-sync is off", async () => {
    queue.getSyncConfig.mockResolvedValue({ autoSyncEnabled: false });
    const { result } = renderHook(() => useOffline());
    await waitFor(() => expect(result.current.pendingCount).toBe(2));
    await waitFor(() => expect(result.current.autoSyncEnabled).toBe(false));

    act(() => setOnline(false));
    act(() => setOnline(true));
    await pause(1300);

    expect(queue.syncPendingEntries).not.toHaveBeenCalled();
  });

  it("cancels the pending auto-sync if the connection drops again", async () => {
    const { result } = renderHook(() => useOffline());
    await waitFor(() => expect(result.current.pendingCount).toBe(2));

    act(() => setOnline(true));
    act(() => setOnline(false));
    await pause(1300);

    expect(queue.syncPendingEntries).not.toHaveBeenCalled();
  });

  it("cancels the pending auto-sync on unmount", async () => {
    const { result, unmount } = renderHook(() => useOffline());
    await waitFor(() => expect(result.current.pendingCount).toBe(2));

    act(() => setOnline(true));
    unmount();
    await pause(1300);

    expect(queue.syncPendingEntries).not.toHaveBeenCalled();
  });

  it("persists the auto-sync toggle", async () => {
    const { result } = renderHook(() => useOffline());

    await act(async () => result.current.setAutoSyncEnabled(false));

    expect(queue.setSyncConfig).toHaveBeenCalledWith({ autoSyncEnabled: false });
    expect(result.current.autoSyncEnabled).toBe(false);
  });

  it("updates from background sync results via the queue listener", async () => {
    const { result, unmount } = renderHook(() => useOffline());
    const listener = queue.addSyncListener.mock.calls[0][0] as (r: SyncResult) => void;

    act(() => listener(okResult));
    expect(result.current.lastSyncResult).toBe(okResult);

    unmount();
    expect(queue.removeSyncListener).toHaveBeenCalledWith(listener);
  });

  it("is read-only for guests", async () => {
    session.current = { data: { guestEvent: { eventCode: "CASJ" } } };
    const { result } = renderHook(() => useOffline());

    await expect(result.current.triggerSync()).rejects.toThrow("read-only");
    await expect(result.current.retryFailedEntries()).rejects.toThrow("read-only");
    await expect(result.current.clearSyncedEntries()).rejects.toThrow("read-only");
    expect(queue.syncPendingEntries).not.toHaveBeenCalled();
  });
});

describe("useOnlineStatus", () => {
  it("follows the browser's online state", () => {
    const { result } = renderHook(() => useOnlineStatus());
    expect(result.current).toBe(true);

    act(() => setOnline(false));
    expect(result.current).toBe(false);
  });
});
