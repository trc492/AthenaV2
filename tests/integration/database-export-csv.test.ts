import { describe, it, expect, beforeEach, vi } from "vitest";
import { MockAuthSession, ServiceMock, asNextRequest } from "../helpers/test-doubles";

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
  },
}));

describe("export CSV integration", () => {
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
            teamNumber: 111,
            year: 2025,
            competitionType: "FRC",
            driveTrain: "Tank",
            weight: 120,
            length: 30,
            width: 28,
            eventName: "Event",
            eventCode: "EVT",
            gameSpecificData: { auto: { left: 1 } },
          },
        ],
        matchEntries: [],
      }),
    };

    vi.doMock("@/db/database-manager", () => ({
      databaseManager: { getService: () => service },
    }));
  });

  it("returns CSV content for pit export", async () => {
    const route = await import("@/app/api/scouting/admin/export/route");
    const req = new Request(
      "http://test/api/scouting/admin/export?format=csv&types=pit",
    );
    const res = await route.GET(asNextRequest(req));
    const text = await res.text();

    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toContain("text/csv");
    expect(text).toContain("type");
    expect(text).toContain("pit");
  });
});
