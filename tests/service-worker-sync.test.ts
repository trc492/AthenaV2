import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { syncPendingEntries, retryFailedEntries } = vi.hoisted(() => ({
  syncPendingEntries: vi.fn(), retryFailedEntries: vi.fn(),
}));
vi.mock("@/lib/offline-queue-manager", () => ({
  offlineQueueManager: { syncPendingEntries, retryFailedEntries },
}));
vi.mock("@serwist/turbopack/worker", () => ({ defaultCache: [] }));
vi.mock("serwist", () => ({
  Serwist: class { addEventListeners() {} },
  NetworkFirst: class {},
  ExpirationPlugin: class {},
}));

describe("service worker background sync lifecycle", () => {
  const listeners = new Map<string, (event: { tag?: string; data?: { type: string }; waitUntil: (promise: Promise<unknown>) => void }) => void>();
  const register = vi.fn().mockResolvedValue(undefined);

  beforeEach(async () => {
    vi.resetModules();
    listeners.clear();
    vi.spyOn(console, "log").mockImplementation(() => {});
    vi.spyOn(console, "error").mockImplementation(() => {});
    vi.stubGlobal("self", {
      addEventListener: (name: string, listener: typeof listeners extends Map<string, infer T> ? T : never) => listeners.set(name, listener),
      registration: { sync: { register }, showNotification: vi.fn().mockResolvedValue(undefined) },
      clients: { matchAll: vi.fn().mockResolvedValue([]) },
    });
    await import("@/app/sw");
  });
  afterEach(() => vi.unstubAllGlobals());

  it.each(["offline-data-sync", "retry-failed-sync"])("rejects failed %s events so the browser can retry", async (tag) => {
    const failure = { success: false, syncedCount: 0, failedCount: 1, errors: ["Network unavailable"] };
    syncPendingEntries.mockResolvedValue(failure);
    retryFailedEntries.mockResolvedValue(failure);
    const waitUntil = vi.fn();
    listeners.get("sync")!({ tag, waitUntil });
    await expect(waitUntil.mock.calls[0][0]).rejects.toThrow("Network unavailable");
  });

  it("keeps sync registration alive until the registration promise settles", async () => {
    const waitUntil = vi.fn();
    listeners.get("message")!({ data: { type: "REGISTER_SYNC" }, waitUntil });
    expect(register).toHaveBeenCalledWith("offline-data-sync");
    await expect(waitUntil.mock.calls[0][0]).resolves.toBeUndefined();
  });
});
