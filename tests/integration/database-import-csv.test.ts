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
    IMPORT_DATA: "IMPORT_DATA",
  },
}));

describe("import CSV integration", () => {
  let service: ServiceMock;

  beforeEach(() => {
    vi.resetModules();
    permissionResult = true;
    authSession = { user: { id: "user-1", role: "admin" } };

    service = {
      importData: vi.fn().mockResolvedValue(undefined),
    };

    vi.doMock("@/db/database-manager", () => ({
      databaseManager: { getService: () => service },
    }));
  });

  it("parses CSV upload and calls import", async () => {
    const csv = [
      "type,id,teamNumber,year,driveTrain,weight,length,width,eventName,eventCode,auto_left",
      "pit,1,111,2025,Tank,120,30,28,Event,EVT,1",
    ].join("\n");

    const file = new File([csv], "data.csv", { type: "text/csv" });
    const form = new FormData();
    form.append("file", file);

    const route = await import("@/app/api/scouting/admin/import/route");
    const req = new Request("http://test/api/scouting/admin/import", {
      method: "POST",
      body: form,
    });

    const res = await route.POST(asNextRequest(req));
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.success).toBe(true);
    expect(service.importData).toHaveBeenCalledTimes(1);
  });
});
