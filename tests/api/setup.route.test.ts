import { describe, it, expect, beforeEach, vi } from "vitest";

const mockSavePersistedDatabaseConfig = vi.fn().mockResolvedValue(undefined);
const mockConfigure = vi.fn();
let mockQuery = vi.fn();

vi.mock("@/lib/server/env-file", () => ({
  savePersistedDatabaseConfig: mockSavePersistedDatabaseConfig,
}));

vi.mock("@/db/database-manager", () => {
  return {
    DatabaseManager: {
      getInstance: vi.fn(() => ({
        configure: mockConfigure,
        getService: () => ({
          query: mockQuery,
        }),
        getConfig: () => ({ provider: "mariadb" }),
      })),
    },
    databaseManager: {
      getService: () => ({
        query: mockQuery,
      }),
      getConfig: () => ({ provider: "mariadb" }),
    },
  };
});

describe("/api/setup/database", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockQuery = vi.fn().mockResolvedValue({ recordset: [] });
  });

  it("validates required database provider", async () => {
    const route = await import("@/app/api/setup/database/route");
    const req = new Request("http://test/api/setup/database", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({}),
    });

    const res = await route.POST(req as any);
    expect(res.status).toBe(400);
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

    const res = await route.POST(req as any);
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.success).toBe(true);
    expect(mockConfigure).toHaveBeenCalled();
    expect(mockSavePersistedDatabaseConfig).toHaveBeenCalled();
  });
});

describe("/api/setup/admin", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("rejects admin creation if an admin already exists", async () => {
    mockQuery = vi.fn().mockResolvedValueOnce({
      recordset: [{ id: "existing-admin-1" }],
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

    const res = await route.POST(req as any);
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

    const res = await route.POST(req as any);
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

    const res = await route.POST(req as any);
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

    const res = await route.POST(req as any);
    expect(res.status).toBe(400);
  });
});
