import { describe, it, expect, beforeEach, vi } from "vitest";
let authSession: any = { user: { id: "user-1", role: "admin" } };
const mockReadFileSync = vi.fn();
const mockMkdir = vi.fn();
const mockWriteFile = vi.fn();

vi.mock("@/db/azuresql-database-service", () => ({
  AzureSqlDatabaseService: class AzureSqlDatabaseService {
    constructor(public config: any) {}
  },
}));

vi.mock("@/db/local-database-service", () => ({
  LocalDatabaseService: class LocalDatabaseService {
    constructor(public config: any) {}
  },
}));

vi.mock("@/db/firebase-database-service", () => ({
  FirebaseDatabaseService: class FirebaseDatabaseService {
    constructor(public config: any) {}
  },
}));

vi.mock("@/db/cosmos-database-service", () => ({
  CosmosDatabaseService: class CosmosDatabaseService {
    constructor(public config: any) {}
  },
}));

vi.mock("@/lib/auth/config", () => ({
  auth: vi.fn(async () => authSession),
}));

vi.mock("@/lib/auth/roles", () => ({
  hasPermission: vi.fn(() => true),
  PERMISSIONS: {
    MANAGE_SYSTEM_CONFIG: "manage_system_config",
  },
}));

vi.mock("node:fs/promises", () => ({
  mkdir: mockMkdir,
  writeFile: mockWriteFile,
}));

vi.mock("node:fs", () => ({
  readFileSync: mockReadFileSync,
}));

beforeEach(() => {
  vi.resetModules();
  authSession = { user: { id: "user-1", role: "admin" } };
  mockReadFileSync.mockImplementation(() => {
    throw new Error("ENOENT");
  });
  mockMkdir.mockResolvedValue(undefined);
  mockWriteFile.mockResolvedValue(undefined);
  mockReadFileSync.mockClear();
  mockMkdir.mockClear();
  mockWriteFile.mockClear();
  process.env = {
    ...process.env,
    DATABASE_PROVIDER: "firebase",
    FIREBASE_SERVICE_ACCOUNT_JSON: "{}",
  };
});

describe("GET /api/scouting/admin/provider-options", () => {
  it("returns provider info", async () => {
    const route = await import("@/app/api/scouting/admin/provider-options/route");
    const response = await route.GET();
    const json = await response.json();

    expect(json.currentProvider).toBe("firebase");
    expect(json.providers).toContain("firebase");
    expect(json.config).toHaveProperty("provider", "firebase");
  });

  it("updates the active provider", async () => {
    const route = await import("@/app/api/scouting/admin/provider-options/route");
    const response = await route.POST(
      new Request("http://test/api/scouting/admin/provider-options", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          provider: "firebase",
          firebase: {
            serviceAccountPath: "/tmp/service-account.json",
            databaseURL: "https://example.firebaseio.com",
          },
        }),
      }) as any,
    );

    const json = await response.json();

    expect(response.status).toBe(200);
    expect(json.success).toBe(true);
    expect(json.currentProvider).toBe("firebase");
    expect(mockWriteFile).toHaveBeenCalled();
    expect(String(mockWriteFile.mock.calls[0]?.[0] ?? "")).toContain(
      ".runtime",
    );
  });
});
