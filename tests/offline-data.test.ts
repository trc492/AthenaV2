import { afterEach, describe, expect, it, vi } from "vitest";
import { HttpError } from "@/lib/fetcher";
import { loadWithOfflineCache } from "@/lib/offline-data";

afterEach(() => vi.unstubAllGlobals());
const options = () => ({
  isGuest: false, load: vi.fn().mockResolvedValue("live"),
  readCache: vi.fn().mockResolvedValue("cached"),
  offlineMessage: "No offline data", errorMessage: "Failed to load",
});
describe("offline read policy", () => {
  it("prefers the server while online", async () => {
    vi.stubGlobal("navigator", { onLine: true });
    const input = options();
    expect(await loadWithOfflineCache(input)).toEqual({ data: "live", error: null, isOfflineData: false });
    expect(input.readCache).not.toHaveBeenCalled();
  });
  it("uses cached data on network failure", async () => {
    const input = options();
    input.load.mockRejectedValue(new TypeError("Network unavailable"));
    expect(await loadWithOfflineCache(input)).toMatchObject({ data: "cached", isOfflineData: true });
  });
  it.each([400, 401, 403, 404])("does not hide HTTP %i with cache contents", async (status) => {
    const input = options();
    input.load.mockRejectedValue(new HttpError(status, "Denied"));
    expect(await loadWithOfflineCache(input)).toMatchObject({ data: null, error: "Failed to load" });
    expect(input.readCache).not.toHaveBeenCalled();
  });
  it("requires online access for guests, even when data is cached", async () => {
    vi.stubGlobal("navigator", { onLine: false });
    const input = { ...options(), isGuest: true };
    expect(await loadWithOfflineCache(input)).toMatchObject({ data: null, isOfflineData: false });
    expect(input.readCache).not.toHaveBeenCalled();
    expect(input.load).not.toHaveBeenCalled();
  });
  it("treats an empty cached result as available", async () => {
    vi.stubGlobal("navigator", { onLine: false });
    const input = { ...options(), readCache: vi.fn().mockResolvedValue([]) };
    expect(await loadWithOfflineCache(input)).toMatchObject({ data: [], isOfflineData: true });
  });
});
