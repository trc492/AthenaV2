import { describe, it, expect, beforeEach, vi } from "vitest";
import { MockAuthSession, ServiceMock, asNextRequest } from "../../helpers/test-doubles";

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
    VIEW_PIT_SCOUTING: "VIEW_PIT_SCOUTING",
    CREATE_PIT_SCOUTING: "CREATE_PIT_SCOUTING",
    EDIT_PIT_SCOUTING: "EDIT_PIT_SCOUTING",
    DELETE_PIT_SCOUTING: "DELETE_PIT_SCOUTING",
    SCOUT_ON_BEHALF: "SCOUT_ON_BEHALF",
  },
}));

describe("/api/scouting/entries/pit", () => {
  let service: ServiceMock;

  beforeEach(() => {
    vi.resetModules();
    permissionResult = true;
    authSession = { user: { id: "user-1", role: "admin" } };

    service = {
      getAllPitEntries: vi.fn().mockResolvedValue([]),
      getPitEntry: vi.fn().mockResolvedValue(undefined),
      addPitEntry: vi.fn().mockResolvedValue(101),
      updatePitEntry: vi.fn().mockResolvedValue(undefined),
      deletePitEntry: vi.fn().mockResolvedValue(undefined),
    };

    vi.doMock("@/db/database-manager", () => ({
      databaseManager: { getService: () => service },
    }));
  });

  it("returns 403 when unauthorized", async () => {
    permissionResult = false;
    const route = await import("@/app/api/scouting/entries/pit/route");
    const req = new Request("http://test/api/scouting/entries/pit");
    const res = await route.GET(asNextRequest(req));
    expect(res.status).toBe(403);
  });

  it("returns 404 when ID not found", async () => {
    const route = await import("@/app/api/scouting/entries/pit/route");
    const req = new Request("http://test/api/scouting/entries/pit?id=99");
    const res = await route.GET(asNextRequest(req));
    expect(res.status).toBe(404);
  });

  it("rejects duplicate pit entry", async () => {
    service.getAllPitEntries.mockResolvedValue([
      {
        id: 1,
        teamNumber: 111,
        year: 2025,
        eventCode: "EVT",
        competitionType: "FRC",
      },
    ]);

    const route = await import("@/app/api/scouting/entries/pit/route");
    const req = new Request("http://test/api/scouting/entries/pit", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        teamNumber: 111,
        year: 2025,
        eventCode: "EVT",
        competitionType: "FRC",
        driveTrain: "Tank",
        weight: 120,
        length: 30,
        width: 28,
        gameSpecificData: {},
      }),
    });

    const res = await route.POST(asNextRequest(req));
    expect(res.status).toBe(409);
  });

  it("creates pit entry when valid", async () => {
    const route = await import("@/app/api/scouting/entries/pit/route");
    const req = new Request("http://test/api/scouting/entries/pit", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        teamNumber: 222,
        year: 2025,
        eventCode: "EVT",
        competitionType: "FRC",
        driveTrain: "Tank",
        weight: 120,
        length: 30,
        width: 28,
        gameSpecificData: {},
      }),
    });

    const res = await route.POST(asNextRequest(req));
    const data = await res.json();

    expect(res.status).toBe(201);
    expect(data.id).toBe(101);
    expect(service.addPitEntry).toHaveBeenCalled();
  });
});
