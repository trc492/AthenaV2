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
    EXPORT_DATA: "EXPORT_DATA",
    IMPORT_DATA: "IMPORT_DATA",
  },
}));

describe("/api/scouting/admin/export and import", () => {
  let service: ServiceMock;

  beforeEach(() => {
    vi.resetModules();
    permissionResult = true;
    authSession = { user: { id: "user-1", role: "admin" } };

    service = {
      exportData: vi.fn().mockResolvedValue({
        pitEntries: [
          {
            id: 1,
            teamNumber: 1,
            year: 2025,
            competitionType: "FRC",
            eventCode: "EVT",
            gameSpecificData: {},
          },
        ],
        matchEntries: [
          {
            id: 2,
            teamNumber: 1,
            matchNumber: 1,
            year: 2025,
            competitionType: "FRC",
            eventCode: "EVT",
            alliance: "red",
            notes: "",
            timestamp: new Date(),
            gameSpecificData: {},
          },
        ],
      }),
      importData: vi.fn().mockResolvedValue(undefined),
    };

    vi.doMock("@/db/database-manager", () => ({
      databaseManager: { getService: () => service },
    }));
  });

  it("exports json and filters types", async () => {
    const route = await import("@/app/api/scouting/admin/export/route");
    const req = new Request(
      "http://test/api/scouting/admin/export?format=json&types=pit",
    );
    const res = await route.GET(asNextRequest(req));
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.pitEntries?.length).toBe(1);
    expect(body.matchEntries).toBeUndefined();
  });

  it("exports json with both pit and match when types=pit,match", async () => {
    const route = await import("@/app/api/scouting/admin/export/route");
    const req = new Request(
      "http://test/api/scouting/admin/export?format=json&types=pit,match",
    );
    const res = await route.GET(asNextRequest(req));
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.pitEntries?.length).toBe(1);
    expect(body.matchEntries?.length).toBe(1);
  });

  it("imports json payload with both empty arrays", async () => {
    const route = await import("@/app/api/scouting/admin/import/route");
    const req = new Request("http://test/api/scouting/admin/import", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ pitEntries: [], matchEntries: [] }),
    });

    const res = await route.POST(asNextRequest(req));
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.success).toBe(true);
    expect(service.importData).toHaveBeenCalledWith({
      pitEntries: [],
      matchEntries: [],
    });
  });

  it("imports json payload with only matchEntries (pitEntries omitted)", async () => {
    const timestamp = "2025-09-01T05:48:29.718Z";
    const route = await import("@/app/api/scouting/admin/import/route");
    const req = new Request("http://test/api/scouting/admin/import", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        matchEntries: [
          {
            teamNumber: 111,
            matchNumber: 1,
            year: 2025,
            competitionType: "FRC",
            alliance: "red",
            notes: "Great match",
            timestamp,
            gameSpecificData: {
              autonomous: { leave: true },
            },
          },
        ],
      }),
    });

    const res = await route.POST(asNextRequest(req));
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.success).toBe(true);
    expect(service.importData).toHaveBeenCalledTimes(1);
    const callArg = service.importData.mock.calls[0][0];
    expect(callArg.pitEntries).toEqual([]);
    expect(callArg.matchEntries.length).toBe(1);
    expect(callArg.matchEntries[0].timestamp).toEqual(new Date(timestamp));
  });

  it("rejects an invalid match timestamp", async () => {
    const route = await import("@/app/api/scouting/admin/import/route");
    const req = new Request("http://test/api/scouting/admin/import", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        matchEntries: [
          {
            teamNumber: 111,
            matchNumber: 1,
            year: 2025,
            competitionType: "FRC",
            alliance: "red",
            notes: "",
            timestamp: "not-a-date",
            gameSpecificData: {},
          },
        ],
      }),
    });

    const res = await route.POST(
      req as unknown as Parameters<typeof route.POST>[0],
    );
    const body = await res.json();

    expect(res.status).toBe(400);
    expect(body.error).toBe("Invalid timestamp for match 1, team 111");
    expect(service.importData).not.toHaveBeenCalled();
  });

  it("imports json payload with only pitEntries (matchEntries omitted)", async () => {
    const route = await import("@/app/api/scouting/admin/import/route");
    const req = new Request("http://test/api/scouting/admin/import", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        pitEntries: [
          {
            teamNumber: 111,
            year: 2025,
            competitionType: "FRC",
            driveTrain: "Tank",
            gameSpecificData: {
              autonomous_startingPosition: "Left Barge",
            },
          },
        ],
      }),
    });

    const res = await route.POST(asNextRequest(req));
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.success).toBe(true);
    expect(service.importData).toHaveBeenCalledTimes(1);
    const callArg = service.importData.mock.calls[0][0];
    expect(callArg.pitEntries.length).toBe(1);
    expect(callArg.matchEntries).toEqual([]);
  });

  it("rejects import if schema configuration is missing for the year", async () => {
    const route = await import("@/app/api/scouting/admin/import/route");
    const req = new Request("http://test/api/scouting/admin/import", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        matchEntries: [
          {
            teamNumber: 111,
            matchNumber: 1,
            year: 1999, // Unconfigured year
            competitionType: "FRC",
            alliance: "red",
            notes: "",
            timestamp: new Date().toISOString(),
            gameSpecificData: {},
          },
        ],
      }),
    });

    const res = await route.POST(asNextRequest(req));
    const body = await res.json();

    expect(res.status).toBe(400);
    expect(body.error).toContain("Missing schema configuration");
    expect(service.importData).not.toHaveBeenCalled();
  });
});
