import { describe, it, expect, beforeEach, vi } from "vitest";
import { asNextRequest } from "../helpers/test-doubles";

const mockSavePersistedDatabaseConfig = vi.fn().mockResolvedValue(undefined);
const mockConfigure = vi.fn();
let mockQuery = vi.fn();
let useDocumentCandidate = false;
const mockConnectionCheck = vi.fn();
let mockIsConfigured = false;
const mockRequirePermission = vi.fn().mockResolvedValue(null);

vi.mock("@/lib/server/env-file", () => ({
  savePersistedDatabaseConfig: mockSavePersistedDatabaseConfig,
  loadSystemSettings: vi.fn(() => ({ signupEnabled: true })),
}));

vi.mock("@/lib/server/require-permission", () => ({
  requirePermission: mockRequirePermission,
}));

vi.mock("@/db/database-manager", async () => {
  const { sqlUsers } = await import("@/db/sql-users");
  return {
    DatabaseManager: {
      getInstance: vi.fn(() => ({
        isConfigured: () => mockIsConfigured,
        createServiceForConfig: () => useDocumentCandidate ? { checkConnection: mockConnectionCheck } : { query: mockQuery },
        configure: mockConfigure,
        getService: () => ({
          query: mockQuery,
          users: sqlUsers(mockQuery, "azuresql"),
        }),
        getConfig: () => ({ provider: "mariadb" }),
      })),
    },
    databaseManager: {
      getService: () => ({
        query: mockQuery,
        users: sqlUsers(mockQuery, "azuresql"),
      }),
      getConfig: () => ({ provider: "mariadb" }),
    },
  };
});

describe("/api/setup/database", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockIsConfigured = false;
    useDocumentCandidate = false;
    mockConnectionCheck.mockResolvedValue(undefined);
    mockRequirePermission.mockResolvedValue(null);
    mockQuery = vi.fn().mockResolvedValue({ recordset: [] });
  });

  it("validates required database provider", async () => {
    const route = await import("@/app/api/setup/database/route");
    const req = new Request("http://test/api/setup/database", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({}),
    });

    const res = await route.POST(asNextRequest(req));
    expect(res.status).toBe(400);
  });

  it.each(["firebase", "cosmos"])("verifies %s before saving its configuration", async (provider) => {
    useDocumentCandidate = true;
    const route = await import("@/app/api/setup/database/route");
    const response = await route.POST(asNextRequest(new Request("http://test/api/setup/database", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ provider, firebase: { serviceAccountJson: {} }, cosmos: { endpoint: "https://cosmos.test", key: "key" } }),
    })));
    expect(response.status).toBe(200);
    expect(mockConnectionCheck).toHaveBeenCalledOnce();
    expect(mockConnectionCheck.mock.invocationCallOrder[0]).toBeLessThan(mockSavePersistedDatabaseConfig.mock.invocationCallOrder[0]);
    expect((await response.json()).setupComplete).toBe(false);
  });

  it("keeps the current configuration when a document connection check fails", async () => {
    useDocumentCandidate = true;
    mockConnectionCheck.mockRejectedValue(new Error("Invalid credentials"));
    const route = await import("@/app/api/setup/database/route");
    const response = await route.POST(asNextRequest(new Request("http://test/api/setup/database", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ provider: "cosmos", cosmos: { endpoint: "https://cosmos.test", key: "bad" } }),
    })));
    expect(response.status).toBe(500);
    expect(mockSavePersistedDatabaseConfig).not.toHaveBeenCalled();
    expect(mockConfigure).not.toHaveBeenCalled();
    mockConnectionCheck.mockResolvedValue(undefined);
  });

  it("successfully configures database when valid", async () => {
    const route = await import("@/app/api/setup/database/route");
    const req = new Request("http://test/api/setup/database", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        provider: "mariadb",
        mariadb: {
          host: "localhost",
          database: "athena",
          user: "root",
          password: "password",
        },
      }),
    });

    const res = await route.POST(asNextRequest(req));
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.success).toBe(true);
    expect(data.adminExists).toBe(false);
    expect(mockConfigure).toHaveBeenCalled();
    expect(mockSavePersistedDatabaseConfig).toHaveBeenCalled();
  });

  it("requires database permission after an admin exists", async () => {
    mockIsConfigured = true;
    mockQuery = vi.fn().mockResolvedValue({ recordset: [{ count: 1 }] });
    mockRequirePermission.mockResolvedValue(
      new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401 }),
    );
    const route = await import("@/app/api/setup/database/route");
    const req = new Request("http://test/api/setup/database", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        provider: "mariadb",
        mariadb: { host: "localhost", database: "athena" },
      }),
    });

    const res = await route.POST(asNextRequest(req));

    expect(res.status).toBe(401);
    expect(mockConfigure).not.toHaveBeenCalled();
    expect(mockSavePersistedDatabaseConfig).not.toHaveBeenCalled();
  });

  it("marks setup complete when the connected database already has an admin", async () => {
    mockQuery = vi
      .fn()
      .mockResolvedValueOnce({ recordset: [{ "": 1 }] })
      .mockResolvedValueOnce({ recordset: [{ count: 1 }] });

    const route = await import("@/app/api/setup/database/route");
    const req = new Request("http://test/api/setup/database", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        provider: "mariadb",
        mariadb: {
          host: "localhost",
          database: "athena",
          user: "root",
          password: "password",
        },
      }),
    });

    const res = await route.POST(asNextRequest(req));
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.success).toBe(true);
    expect(data.adminExists).toBe(true);
    expect(data.setupComplete).toBe(true);
  });
});

describe("/api/setup/admin", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("rejects admin creation if an admin already exists", async () => {
    mockQuery = vi.fn().mockResolvedValueOnce({
      recordset: [{ count: 1 }],
    });

    const route = await import("@/app/api/setup/admin/route");
    const req = new Request("http://test/api/setup/admin", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: "Ada Lovelace",
        username: "ada",
        password: "Password123!",
      }),
    });

    const res = await route.POST(asNextRequest(req));
    expect(res.status).toBe(403);
  });

  it("creates admin when no admin exists", async () => {
    mockQuery = vi
      .fn()
      .mockResolvedValueOnce({ recordset: [] }) // No existing admin
      .mockResolvedValueOnce({ recordset: [] }) // No existing username
      .mockResolvedValueOnce({ recordset: [] }); // Insert query

    const route = await import("@/app/api/setup/admin/route");
    const req = new Request("http://test/api/setup/admin", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: "Ada Lovelace",
        username: "admin",
        password: "Password123!",
      }),
    });

    const res = await route.POST(asNextRequest(req));
    const data = await res.json();

    expect(res.status).toBe(201);
    expect(data.success).toBe(true);
  });
});

describe("/api/auth/register", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("registers a scout user successfully", async () => {
    mockQuery = vi
      .fn()
      .mockResolvedValueOnce({ recordset: [] }) // Check username
      .mockResolvedValueOnce({ recordset: [] }); // Insert user

    const route = await import("@/app/api/auth/register/route");
    const req = new Request("http://test/api/auth/register", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: "Scout One",
        username: "scout1",
        password: "Password123!",
      }),
    });

    const res = await route.POST(asNextRequest(req));
    const data = await res.json();

    expect(res.status).toBe(201);
    expect(data.message).toBe("User created successfully");
  });

  it("rejects invalid usernames", async () => {
    const route = await import("@/app/api/auth/register/route");
    const req = new Request("http://test/api/auth/register", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: "Scout One",
        username: "bad username with spaces!",
        password: "Password123!",
      }),
    });

    const res = await route.POST(asNextRequest(req));
    expect(res.status).toBe(400);
  });
});
