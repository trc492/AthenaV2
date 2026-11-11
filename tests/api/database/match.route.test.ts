import { describe, it, expect, beforeEach, vi } from "vitest";
import {
  MockAuthSession,
  ServiceMock,
  asNextRequest,
} from "../../helpers/test-doubles";

let authSession: MockAuthSession | null = {
  user: { id: "user-1", role: "admin" },
};
let permissionResult = true;

vi.mock("@/lib/auth/config", () => ({
  auth: vi.fn(async () => authSession),
}));

vi.mock("@/lib/auth/roles", () => ({
  hasPermission: vi.fn(() => permissionResult),
  PERMISSIONS: {
    VIEW_MATCH_SCOUTING: "VIEW_MATCH_SCOUTING",
    CREATE_MATCH_SCOUTING: "CREATE_MATCH_SCOUTING",
    EDIT_MATCH_SCOUTING: "EDIT_MATCH_SCOUTING",
    DELETE_MATCH_SCOUTING: "DELETE_MATCH_SCOUTING",
    SCOUT_ON_BEHALF: "SCOUT_ON_BEHALF",
  },
}));

describe("/api/scouting/entries/match", () => {
  let service: ServiceMock;

  beforeEach(() => {
    vi.resetModules();
    permissionResult = true;
    authSession = { user: { id: "user-1", role: "admin" } };

    service = {
      getAllMatchEntries: vi.fn().mockResolvedValue([]),
      getMatchEntries: vi.fn().mockResolvedValue([]),
      checkMatchScoutExists: vi.fn().mockResolvedValue(false),
      addMatchEntry: vi.fn().mockResolvedValue(202),
      updateMatchEntry: vi.fn().mockResolvedValue(undefined),
      deleteMatchEntry: vi.fn().mockResolvedValue(undefined),
    };

    vi.doMock("@/db/database-manager", () => ({
      databaseManager: { getService: () => service },
    }));
  });

  it.each(["GET", "POST", "PUT", "DELETE"] as const)("%s denies missing permissions before accessing persistence", async (method) => {
    permissionResult = false;
    const route = await import("@/app/api/scouting/entries/match/route");
    const req = new Request("http://test/api/scouting/entries/match");
    const res = await route[method](asNextRequest(req));
    expect(res.status).toBe(403);
    for (const operation of Object.values(service)) expect(operation).not.toHaveBeenCalled();
  });

  it("returns 404 when ID not found", async () => {
    const route = await import("@/app/api/scouting/entries/match/route");
    const req = new Request("http://test/api/scouting/entries/match?id=99");
    const res = await route.GET(asNextRequest(req));
    expect(res.status).toBe(404);
  });
  it("uses the new provider after configuration changes without reloading the route", async () => {
    const route = await import("@/app/api/scouting/entries/match/route");
    expect((await route.GET(asNextRequest(new Request("http://test/api/scouting/entries/match")))).status).toBe(200);
    const original = service;
    service = { getAllMatchEntries: vi.fn().mockResolvedValue([{ id: 42 }]) };
    const response = await route.GET(asNextRequest(new Request("http://test/api/scouting/entries/match")));
    expect(await response.json()).toEqual([{ id: 42 }]);
    expect(original.getAllMatchEntries).toHaveBeenCalledOnce();
    expect(service.getAllMatchEntries).toHaveBeenCalledOnce();
  });

  it("rejects duplicate match entry", async () => {
    service.checkMatchScoutExists.mockResolvedValue(true);

    const route = await import("@/app/api/scouting/entries/match/route");
    const req = new Request("http://test/api/scouting/entries/match", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        teamNumber: 111,
        matchNumber: 2,
        year: 2025,
        eventCode: "EVT",
        competitionType: "FRC",
        alliance: "red",
        notes: "",
        timestamp: new Date().toISOString(),
        gameSpecificData: {},
      }),
    });

    const res = await route.POST(asNextRequest(req));
    expect(res.status).toBe(409);
    expect(service.checkMatchScoutExists).toHaveBeenCalledWith(111, 2, "EVT", 2025, "FRC");
    expect(service.addMatchEntry).not.toHaveBeenCalled();
  });

  it("returns 400 when delete lacks id", async () => {
    const route = await import("@/app/api/scouting/entries/match/route");
    const req = new Request("http://test/api/scouting/entries/match");
    const res = await route.DELETE(asNextRequest(req));
    expect(res.status).toBe(400);
  });

  it("creates match entry when valid", async () => {
    const route = await import("@/app/api/scouting/entries/match/route");
    const req = new Request("http://test/api/scouting/entries/match", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        teamNumber: 222,
        matchNumber: 3,
        year: 2025,
        eventCode: "EVT",
        competitionType: "FRC",
        alliance: "blue",
        notes: "",
        timestamp: new Date().toISOString(),
        gameSpecificData: {},
      }),
    });

    const res = await route.POST(asNextRequest(req));
    const data = await res.json();

    expect(res.status).toBe(201);
    expect(data.id).toBe(202);
    expect(service.addMatchEntry).toHaveBeenCalled();
  });

  it("rejects invalid writes before accessing persistence", async () => {
    const route = await import("@/app/api/scouting/entries/match/route");
    const response = await route.POST(asNextRequest(new Request("http://test/api/scouting/entries/match", {
      method: "POST", headers: { "content-type": "application/json" },
      body: JSON.stringify({ teamNumber: -1, competitionType: "unknown" }),
    })));
    expect(response.status).toBe(400);
    expect(service.addMatchEntry).not.toHaveBeenCalled();
  });

  it("rejects attempts to change ownership through updates", async () => {
    const route = await import("@/app/api/scouting/entries/match/route");
    const response = await route.PUT(asNextRequest(new Request("http://test/api/scouting/entries/match", {
      method: "PUT", headers: { "content-type": "application/json" },
      body: JSON.stringify({ id: 1, userId: "another-user", notes: "updated" }),
    })));
    expect(response.status).toBe(400);
    expect(service.updateMatchEntry).not.toHaveBeenCalled();
  });

  it.each(["GET", "POST", "PUT", "DELETE"] as const)("%s requires authentication", async (method) => {
    authSession = null;
    const route = await import("@/app/api/scouting/entries/match/route");
    const response = await route[method](asNextRequest(new Request("http://test/api/scouting/entries/match")));
    expect(response.status).toBe(401);
  });

  it("returns a safe error when persistence fails asynchronously", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    service.getAllMatchEntries.mockRejectedValue(new Error("private database details"));
    const route = await import("@/app/api/scouting/entries/match/route");
    const response = await route.GET(asNextRequest(new Request("http://test/api/scouting/entries/match")));
    expect(response.status).toBe(500);
    expect(await response.json()).toEqual({ error: "Failed to fetch match entries" });
  });
});
