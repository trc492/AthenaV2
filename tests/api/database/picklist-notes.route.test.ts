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
    VIEW_PICKLIST: "VIEW_PICKLIST",
    EDIT_PICKLIST: "EDIT_PICKLIST",
  },
}));

describe("/api/scouting/picklist/notes", () => {
  let service: ServiceMock;

  beforeEach(() => {
    vi.resetModules();
    permissionResult = true;
    authSession = { user: { id: "user-1", role: "admin" } };

    service = {
      getPicklistNotes: vi.fn().mockResolvedValue([]),
      addPicklistNote: vi.fn().mockResolvedValue(21),
      updatePicklistNote: vi.fn().mockResolvedValue(undefined),
      deletePicklistNote: vi.fn().mockResolvedValue(undefined),
    };

    vi.doMock("@/db/database-manager", () => ({
      databaseManager: { getService: () => service },
    }));
  });

  it("returns 400 when picklistId missing on GET", async () => {
    const route = await import("@/app/api/scouting/picklist/notes/route");
    const req = new Request("http://test/api/scouting/picklist/notes");
    const res = await route.GET(asNextRequest(req));
    expect(res.status).toBe(400);
  });

  it("creates note when valid", async () => {
    const route = await import("@/app/api/scouting/picklist/notes/route");
    const req = new Request("http://test/api/scouting/picklist/notes", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ picklistId: 1, teamNumber: 111, note: "good" }),
    });

    const res = await route.POST(asNextRequest(req));
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.id).toBe(21);
  });

  it("updates by noteId when provided", async () => {
    const route = await import("@/app/api/scouting/picklist/notes/route");
    const req = new Request("http://test/api/scouting/picklist/notes", {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ noteId: 9, note: "update" }),
    });

    const res = await route.PUT(asNextRequest(req));
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.noteId).toBe(9);
  });

  it("returns 400 when delete missing params", async () => {
    const route = await import("@/app/api/scouting/picklist/notes/route");
    const req = new Request("http://test/api/scouting/picklist/notes");
    const res = await route.DELETE(asNextRequest(req));
    expect(res.status).toBe(400);
  });
});
