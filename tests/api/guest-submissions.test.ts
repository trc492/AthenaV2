import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Session } from "next-auth";
import { NextRequest } from "next/server";
const state = vi.hoisted(() => ({ session: null as Session | null, db: {
  getAllMatchEntries: vi.fn(), getAllPitEntries: vi.fn(), addMatchEntry: vi.fn(), addPitEntry: vi.fn(),
} }));
vi.mock("@/lib/auth/config", () => ({ auth: async () => state.session }));
vi.mock("@/lib/server/db-service", () => ({ getDbService: () => state.db }));
import { POST as matchPost } from "@/app/api/scouting/entries/match/route";
import { POST as pitPost } from "@/app/api/scouting/entries/pit/route";
const grant = { name: "Event", eventCode: "EVT", year: 2026, competitionType: "FRC" as const, nonce: "a".repeat(32), expiresAt: Date.now() + 60000, canAddScouting: true };
beforeEach(() => {
  vi.clearAllMocks();
  state.session = { user: { id: "guest:link", role: "guest" }, guestEvent: { ...grant } } as Session;
  state.db.getAllMatchEntries.mockResolvedValue([]);
  state.db.getAllPitEntries.mockResolvedValue([]);
  state.db.addMatchEntry.mockResolvedValue(1);
  state.db.addPitEntry.mockResolvedValue(2);
});
describe.each(["match", "pit"] as const)("guest %s submissions", (kind) => {
  const post = kind === "match" ? matchPost : pitPost;
  const body = { eventCode: "EVT", year: 2026, competitionType: "FRC", teamNumber: 492, gameSpecificData: {}, notes: "Note", matchNumber: 1, alliance: "red", timestamp: new Date().toISOString(), driveTrain: "Swerve" };
  const request = (changes = {}) => new NextRequest(`http://test/api/scouting/entries/${kind}`, { method: "POST", body: JSON.stringify({ ...body, ...changes }) });
  it("accepts in-scope entries and assigns guest ownership", async () => {
    expect((await post(request({ scoutingForUserId: "admin", userId: "admin" }))).status).toBe(201);
    const add = kind === "match" ? state.db.addMatchEntry : state.db.addPitEntry;
    expect(add).toHaveBeenCalledWith(expect.objectContaining({ userId: "guest:link" }));
  });
  it("rejects forged scope in the body", async () => {
    for (const changes of [{ eventCode: "other" }, { year: 2025 }, { competitionType: "FTC" }]) {
      expect((await post(request(changes))).status).toBe(403);
    }
    expect(state.db.addMatchEntry).not.toHaveBeenCalled();
    expect(state.db.addPitEntry).not.toHaveBeenCalled();
  });
  it("rejects viewer-only and expired guests", async () => {
    state.session!.guestEvent!.canAddScouting = false;
    expect((await post(request())).status).toBe(403);
    state.session!.guestEvent = { ...grant, expiresAt: 1 };
    expect((await post(request())).status).toBe(403);
  });
});
