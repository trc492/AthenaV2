import { describe, it, expect, beforeEach, vi } from "vitest";

let authSession: any = { user: { id: "user-1", role: "admin" } };
let permissionResult = true;

vi.mock("@/lib/auth/config", () => ({
  auth: vi.fn(async () => authSession),
}));

vi.mock("@/lib/auth/roles", () => ({
  hasPermission: vi.fn(() => permissionResult),
  PERMISSIONS: {
    CREATE_SCHEDULE: "CREATE_SCHEDULE",
    EDIT_SCHEDULE: "EDIT_SCHEDULE",
    DELETE_SCHEDULE: "DELETE_SCHEDULE",
  },
}));

vi.mock("mssql", () => ({
  NVarChar: "NVarChar",
  Int: "Int",
}));

let serviceMock: any;
let pool: any;

vi.mock("@/db/database-manager", () => ({
  databaseManager: {
    getService: () => serviceMock,
  },
}));

describe("/api/schedule/assignments", () => {
  beforeEach(() => {
    vi.resetModules();
    permissionResult = true;
    authSession = { user: { id: "user-1", role: "admin" } };

    const request = {
      input: vi.fn().mockReturnThis(),
      query: vi.fn().mockResolvedValue(undefined),
    };

    pool = {
      request: vi.fn().mockReturnValue(request),
    };

    serviceMock = {
      getPool: vi.fn().mockResolvedValue(pool),
      query: vi.fn().mockResolvedValue(undefined),
    };
  });

  it("rejects missing fields", async () => {
    const route = await import("@/app/api/scouting/schedule/assignments/route");
    const req = new Request("http://test/api/scouting/schedule/assignments", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ eventCode: "EVT" }),
    });

    const res = await route.POST(req as any);
    expect(res.status).toBe(400);
  });

  it("returns 400 when provider not sql", async () => {
    serviceMock = {};
    const route = await import("@/app/api/scouting/schedule/assignments/route");
    const req = new Request("http://test/api/scouting/schedule/assignments", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        eventCode: "EVT",
        year: 2025,
        startMatch: 1,
        endMatch: 1,
        alliance: "red",
        position: 1,
        userId: "user-1",
      }),
    });

    const res = await route.POST(req as any);
    expect(res.status).toBe(400);
  });

  it("creates assignments when valid", async () => {
    const route = await import("@/app/api/scouting/schedule/assignments/route");
    const req = new Request("http://test/api/scouting/schedule/assignments", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        eventCode: "EVT",
        year: 2025,
        startMatch: 1,
        endMatch: 2,
        alliance: "red",
        position: 1,
        userId: "user-1",
      }),
    });

    const res = await route.POST(req as any);
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.success).toBe(true);
    expect(serviceMock.query).toHaveBeenCalled();
  });

  it("clears assignments on delete", async () => {
    const route = await import("@/app/api/scouting/schedule/assignments/route");
    const req = {
      nextUrl: new URL(
        "http://test/api/scouting/schedule/assignments?eventCode=EVT&year=2025",
      ),
    } as any;

    const res = await route.DELETE(req);
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.success).toBe(true);
  });
});
