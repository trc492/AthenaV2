import { describe, it, expect, beforeEach, vi } from "vitest";
import type { NextRequest } from "next/server";
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
    CREATE_SCHEDULE: "CREATE_SCHEDULE",
    EDIT_SCHEDULE: "EDIT_SCHEDULE",
    DELETE_SCHEDULE: "DELETE_SCHEDULE",
  },
}));

vi.mock("mssql", () => ({
  NVarChar: "NVarChar",
  Int: "Int",
}));

let serviceMock: ServiceMock;
let pool: { request: ReturnType<typeof vi.fn> };

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
      query: vi.fn().mockResolvedValue({ recordset: [{ id: "user-1" }] }),
      applyScheduleAssignmentChanges: vi.fn().mockResolvedValue(undefined),
    };
  });

  it("rejects missing fields", async () => {
    const route = await import("@/app/api/scouting/schedule/assignments/route");
    const req = new Request("http://test/api/scouting/schedule/assignments", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ eventCode: "EVT" }),
    });

    const res = await route.POST(asNextRequest(req));
    expect(res.status).toBe(400);
  });

  it("returns 501 when provider is not SQL-backed", async () => {
    serviceMock = {};
    const route = await import("@/app/api/scouting/schedule/assignments/route");
    const req = new Request("http://test/api/scouting/schedule/assignments", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        eventCode: "EVT",
        year: 2025,
        competitionType: "FRC",
        startMatch: 1,
        endMatch: 1,
        alliance: "red",
        position: 1,
        userId: "user-1",
      }),
    });

    const res = await route.POST(asNextRequest(req));
    expect(res.status).toBe(501);
  });

  it("creates assignments when valid", async () => {
    const route = await import("@/app/api/scouting/schedule/assignments/route");
    const req = new Request("http://test/api/scouting/schedule/assignments", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        eventCode: "EVT",
        year: 2025,
        competitionType: "FRC",
        startMatch: 1,
        endMatch: 2,
        alliance: "red",
        position: 1,
        userId: "user-1",
      }),
    });

    const res = await route.POST(asNextRequest(req));
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.success).toBe(true);
    expect(serviceMock.applyScheduleAssignmentChanges).toHaveBeenCalledWith(
      { eventCode: "EVT", year: 2025, competitionType: "FRC" },
      [
        {
          startMatch: 1,
          endMatch: 2,
          alliance: "red",
          position: 1,
          userId: "user-1",
        },
      ],
      false,
      undefined,
    );
  });

  it("clears assignments on delete", async () => {
    const route = await import("@/app/api/scouting/schedule/assignments/route");
    // DELETE only reads `nextUrl`, so a minimal stand-in is enough.
    const req = {
      nextUrl: new URL(
        "http://test/api/scouting/schedule/assignments?eventCode=EVT&year=2025&competitionType=FRC",
      ),
    } as unknown as NextRequest;

    const res = await route.DELETE(req);
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.success).toBe(true);
    expect(serviceMock.applyScheduleAssignmentChanges).toHaveBeenCalledWith(
      { eventCode: "EVT", year: 2025, competitionType: "FRC" },
      [],
      true,
    );
  });

  it("rejects an FTC position that cannot be displayed", async () => {
    const route = await import("@/app/api/scouting/schedule/assignments/route");
    const req = new Request("http://test/api/scouting/schedule/assignments", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        eventCode: "EVT",
        year: 2025,
        competitionType: "FTC",
        startMatch: 1,
        endMatch: 1,
        alliance: "red",
        position: 2,
        userId: "user-1",
      }),
    });

    expect((await route.POST(asNextRequest(req))).status).toBe(400);
  });

  it("rejects permissive parseInt-style values", async () => {
    const route = await import("@/app/api/scouting/schedule/assignments/route");
    const req = new Request("http://test/api/scouting/schedule/assignments", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        eventCode: "EVT",
        year: "2025junk",
        competitionType: "FRC",
        startMatch: 1,
        endMatch: 1,
        alliance: "red",
        position: 0,
        userId: "user-1",
      }),
    });

    expect((await route.POST(asNextRequest(req))).status).toBe(400);
  });

  it("returns 409 instead of overwriting a concurrently changed schedule", async () => {
    const conflict = new Error("Schedule changed since it was loaded");
    conflict.name = "ScheduleConflictError";
    serviceMock.applyScheduleAssignmentChanges.mockRejectedValueOnce(conflict);
    const route = await import("@/app/api/scouting/schedule/assignments/route");
    const req = new Request("http://test/api/scouting/schedule/assignments", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        eventCode: "EVT",
        year: 2025,
        competitionType: "FRC",
        changes: [],
        replaceAll: true,
        expectedAssignments: [],
      }),
    });

    expect((await route.POST(asNextRequest(req))).status).toBe(409);
  });
});
