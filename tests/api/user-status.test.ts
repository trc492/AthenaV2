import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
const { query, auth } = vi.hoisted(() => ({ query: vi.fn(), auth: vi.fn() }));
vi.mock("@/db/database-manager", async () => {
  const { sqlUsers } = await import("@/db/sql-users");
  return {
    databaseManager: {
      getService: () => ({ users: sqlUsers(query, "azuresql") }),
    },
  };
});
vi.mock("@/lib/auth/config", () => ({ auth }));
import { PATCH, DELETE } from "@/app/api/users/[id]/route";
import { GET } from "@/app/api/users/route";
const context = (id = "scout-1") => ({ params: Promise.resolve({ id }) });
const request = (active: unknown) =>
  new NextRequest("http://localhost/api/users/scout-1", {
    method: "PATCH",
    body: JSON.stringify({ active }),
  });
describe("user deactivation", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    auth.mockResolvedValue({ user: { id: "admin-1", role: "admin" } });
    query.mockResolvedValue({ recordset: [{ id: "scout-1" }] });
  });
  it("deactivates without deleting historical data", async () => {
    expect((await PATCH(request(false), context())).status).toBe(200);
    expect(query.mock.calls[1][0]).toContain("deactivatedAt = GETDATE()");
    expect(query.mock.calls[1][0]).toContain(
      "sessionVersion = sessionVersion + 1",
    );
    expect(query.mock.calls.some(([sql]) => sql.includes("DELETE"))).toBe(
      false,
    );
  });
  it("restores an inactive account", async () => {
    expect((await PATCH(request(true), context())).status).toBe(200);
    expect(query.mock.calls[1][0]).toContain("deactivatedAt = NULL");
    expect(query.mock.calls[1][0]).toContain("deactivatedAt IS NOT NULL");
  });
  it("makes the old delete endpoint preserve the account too", async () => {
    expect((await DELETE(request(false), context())).status).toBe(200);
    expect(query.mock.calls[1][0]).toContain("UPDATE users");
  });
  it("prevents self deactivation", async () => {
    expect((await PATCH(request(false), context("admin-1"))).status).toBe(400);
    expect(query).not.toHaveBeenCalled();
  });
  it("restricts both operations to admins", async () => {
    auth.mockResolvedValue({ user: { id: "lead-1", role: "lead_scout" } });
    expect((await PATCH(request(false), context())).status).toBe(403);
    expect((await PATCH(request(true), context())).status).toBe(403);
    expect(query).not.toHaveBeenCalled();
  });
  it("rejects invalid status and missing users", async () => {
    expect((await PATCH(request("false"), context())).status).toBe(400);
    query.mockResolvedValue({ recordset: [] });
    expect((await PATCH(request(false), context())).status).toBe(404);
  });
  it("excludes inactive accounts from normal lists", async () => {
    query.mockResolvedValue({ recordset: [] });
    await GET(new NextRequest("http://localhost/api/users"));
    expect(query.mock.calls[0][0]).toContain("WHERE deactivatedAt IS NULL");
  });
  it("lets admins list inactive accounts for restoration", async () => {
    query.mockResolvedValue({ recordset: [] });
    await GET(
      new NextRequest("http://localhost/api/users?includeInactive=true"),
    );
    expect(query.mock.calls[0][0]).not.toContain("WHERE deactivatedAt IS NULL");
  });
  it("does not let scouts request inactive accounts", async () => {
    auth.mockResolvedValue({ user: { id: "scout-1", role: "scout" } });
    query.mockResolvedValue({ recordset: [] });
    await GET(
      new NextRequest("http://localhost/api/users?includeInactive=true"),
    );
    expect(query.mock.calls[0][0]).toContain("WHERE deactivatedAt IS NULL");
  });
});
