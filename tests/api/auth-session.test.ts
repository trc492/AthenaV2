import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { encode } from "next-auth/jwt";
import { handlers } from "@/lib/auth/config";

const { query } = vi.hoisted(() => ({ query: vi.fn() }));
vi.mock("@/db/database-manager", () => ({
  databaseManager: { getService: () => ({ query }) },
}));
vi.mock("@/lib/server/env-file", () => ({
  getOrCreateAuthSecret: () => "session-test-secret",
}));

async function getSession() {
  const token = await encode({
    secret: "session-test-secret",
    salt: "authjs.session-token",
    token: { sub: "user-1", id: "user-1", role: "admin", name: "Old name" },
  });
  return handlers.GET(new NextRequest("http://localhost/api/auth/session", {
    headers: { cookie: `authjs.session-token=${token}` },
  }));
}

describe("existing account sessions", () => {
  beforeEach(() => {
    vi.stubEnv("AUTH_URL", "http://localhost");
    vi.stubEnv("NEXTAUTH_URL", "http://localhost");
    query.mockReset();
  });
  afterEach(() => vi.unstubAllEnvs());

  it("uses the current database role and profile after a demotion", async () => {
    query.mockResolvedValue({ recordset: [{
      id: "user-1", name: "Current name", username: "scout", role: "scout", avatarUrl: null,
    }] });
    const response = await getSession();
    expect((await response.json()).user).toMatchObject({ role: "scout", name: "Current name" });
    expect(query).toHaveBeenCalledWith(expect.stringContaining("WHERE id = @id"), { id: "user-1" });
  });

  it("rejects a deleted account and clears its session cookie", async () => {
    query.mockResolvedValue({ recordset: [] });
    const response = await getSession();
    expect(await response.json()).toBeNull();
    expect(response.headers.getSetCookie().some(cookie => cookie.includes("Max-Age=0"))).toBe(true);
  });

  it("fails closed if current permissions cannot be read", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    query.mockRejectedValue(new Error("Database unavailable"));
    expect(await (await getSession()).json()).toBeNull();
  });
});
