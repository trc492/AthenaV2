import { afterEach, describe, expect, it, vi } from "vitest";
import { pitApi, matchApi } from "@/lib/api/database-client";

const storage = vi.hoisted(() => ({ queuePitEntry: vi.fn().mockResolvedValue("pit-queue"), queueMatchEntry: vi.fn().mockResolvedValue("match-queue") }));
vi.mock("@/lib/offline-queue-manager", () => ({ offlineQueueManager: storage }));
afterEach(() => { vi.unstubAllGlobals(); vi.clearAllMocks(); });
const pit = { teamNumber: 254, year: 2026, competitionType: "FRC" as const, driveTrain: "Swerve" as const, gameSpecificData: {} };
describe("scouting submissions", () => {
  it("queues submissions on a server failure", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response("Unavailable", { status: 503 })));
    expect(await pitApi.create(pit)).toEqual({ queueId: "pit-queue", isQueued: true });
  });
  it("does not queue a conflict even when its message changes", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(Response.json({ message: "Duplicate submission" }, { status: 409 })));
    await expect(pitApi.create(pit)).rejects.toMatchObject({ status: 409, message: "Duplicate submission" });
    expect(storage.queuePitEntry).not.toHaveBeenCalled();
  });
  it("does not queue permission failures", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(Response.json({ error: "Forbidden" }, { status: 403 })));
    await expect(pitApi.create(pit)).rejects.toMatchObject({ status: 403 });
    expect(storage.queuePitEntry).not.toHaveBeenCalled();
  });
  it("queues both entry types when offline without attempting a request", async () => {
    vi.stubGlobal("navigator", { onLine: false });
    const fetch = vi.fn(); vi.stubGlobal("fetch", fetch);
    expect(await pitApi.create(pit)).toMatchObject({ isQueued: true });
    expect(await matchApi.create({ ...pit, matchNumber: 1, alliance: "red", notes: "", timestamp: new Date() })).toEqual({ queueId: "match-queue", isQueued: true });
    expect(fetch).not.toHaveBeenCalled();
  });
});
