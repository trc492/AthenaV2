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
    VIEW_DASHBOARD: "VIEW_DASHBOARD",
    MANAGE_EVENT_SETTINGS: "MANAGE_EVENT_SETTINGS",
  },
}));

describe("/api/events/custom-events", () => {
  let service: ServiceMock;

  beforeEach(() => {
    vi.resetModules();
    permissionResult = true;
    authSession = { user: { id: "user-1", role: "admin" } };

    service = {
      getCustomEvent: vi.fn().mockResolvedValue(undefined),
      getAllCustomEvents: vi.fn().mockResolvedValue([]),
      addCustomEvent: vi.fn().mockResolvedValue(301),
      updateCustomEvent: vi.fn().mockResolvedValue(undefined),
      deleteCustomEvent: vi.fn().mockResolvedValue(undefined),
    };

    vi.doMock("@/db/database-manager", () => ({
      databaseManager: { getService: () => service },
    }));
  });

  it("returns 404 when event code not found", async () => {
    const route = await import("@/app/api/events/custom-events/route");
    const req = new Request(
      "http://test/api/events/custom-events?eventCode=EVT",
    );
    const res = await route.GET(asNextRequest(req));
    expect(res.status).toBe(404);
  });

  it("creates custom event when valid", async () => {
    const route = await import("@/app/api/events/custom-events/route");
    const req = new Request("http://test/api/events/custom-events", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        eventCode: "EVT",
        name: "Event",
        date: new Date().toISOString(),
        matchCount: 10,
        year: 2025,
        competitionType: "FRC",
      }),
    });

    const res = await route.POST(asNextRequest(req));
    const data = await res.json();

    expect(res.status).toBe(201);
    expect(data.id).toBe(301);
  });
});
