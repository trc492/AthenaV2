import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { encode } from "next-auth/jwt";
import { handlers } from "@/lib/auth/config";
import {
  createGuestEventLink as signGuestEventLink,
  verifyGuestEventLink,
} from "@/lib/server/event-guest";
import type { JWT } from "next-auth/jwt";

const { query, guestLinks } = vi.hoisted(() => ({
  query: vi.fn(),
  guestLinks: new Map<string, { token: string; revokedAt: number | null }>(),
}));
vi.mock("@/db/database-manager", async () => {
  const { sqlUsers } = await import("@/db/sql-users");
  return {
    databaseManager: {
      getService: () => ({
        users: sqlUsers(query, "azuresql"),
        getGuestLink: async (id: string) => guestLinks.get(id),
      }),
    },
  };
});
vi.mock("@/lib/server/env-file", () => ({
  getOrCreateAuthSecret: () => "session-test-secret",
}));

async function getSession(overrides: JWT = {}) {
  const token = await encode({
    secret: "session-test-secret",
    salt: "authjs.session-token",
    token: {
      sub: "user-1",
      id: "user-1",
      role: "admin",
      name: "Old name",
      ...overrides,
    },
  });
  return handlers.GET(
    new NextRequest("http://localhost/api/auth/session", {
      headers: { cookie: `authjs.session-token=${token}` },
    }),
  );
}

function createGuestEventLink(event: Parameters<typeof signGuestEventLink>[0]) {
  const link = signGuestEventLink(event);
  const grant = verifyGuestEventLink(link.token)!;
  guestLinks.set(grant.nonce, { token: link.token, revokedAt: null });
  return link;
}

describe("existing account sessions", () => {
  beforeEach(() => {
    vi.stubEnv("AUTH_URL", "http://localhost");
    vi.stubEnv("NEXTAUTH_URL", "http://localhost");
    query.mockReset();
    guestLinks.clear();
  });
  afterEach(() => vi.unstubAllEnvs());

  it("uses the current database role and profile after a demotion", async () => {
    query.mockResolvedValue({
      recordset: [
        {
          id: "user-1",
          name: "Current name",
          username: "scout",
          role: "scout",
          avatarUrl: null,
        },
      ],
    });
    const response = await getSession();
    expect((await response.json()).user).toMatchObject({
      role: "scout",
      name: "Current name",
    });
    expect(query).toHaveBeenCalledWith(
      expect.stringContaining("WHERE id = @id"),
      { id: "user-1" },
    );
  });

  it("rejects a deleted account and clears its session cookie", async () => {
    query.mockResolvedValue({ recordset: [] });
    const response = await getSession();
    expect(await response.json()).toBeNull();
    expect(
      response.headers
        .getSetCookie()
        .some((cookie) => cookie.includes("Max-Age=0")),
    ).toBe(true);
  });

  it("rejects a deactivated account and clears its session", async () => {
    query.mockResolvedValue({
      recordset: [
        {
          id: "user-1",
          role: "admin",
          deactivatedAt: "2026-10-02",
          sessionVersion: 1,
        },
      ],
    });
    const response = await getSession();
    expect(await response.json()).toBeNull();
    expect(
      response.headers
        .getSetCookie()
        .some((cookie) => cookie.includes("Max-Age=0")),
    ).toBe(true);
  });

  it("rejects a deactivated user at the real credentials login", async () => {
    query.mockResolvedValue({
      recordset: [
        {
          id: "user-1",
          username: "former-scout",
          role: "scout",
          deactivatedAt: "2026-10-02",
          password_hash: "unused",
        },
      ],
    });
    const csrfResponse = await handlers.GET(
      new NextRequest("http://localhost/api/auth/csrf"),
    );
    const { csrfToken } = await csrfResponse.json();
    const cookies = csrfResponse.headers
      .getSetCookie()
      .map((cookie) => cookie.split(";")[0])
      .join("; ");
    const response = await handlers.POST(
      new NextRequest("http://localhost/api/auth/callback/credentials", {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
          cookie: cookies,
        },
        body: new URLSearchParams({
          csrfToken,
          username: "former-scout",
          password: "password123",
          callbackUrl: "http://localhost/dashboard",
        }),
      }),
    );
    expect(response.headers.get("location")).toContain("CredentialsSignin");
    expect(
      response.headers
        .getSetCookie()
        .some((cookie) => cookie.startsWith("authjs.session-token=")),
    ).toBe(false);
  });

  it("rejects an old session after restoration", async () => {
    query.mockResolvedValue({
      recordset: [
        { id: "user-1", role: "scout", deactivatedAt: null, sessionVersion: 2 },
      ],
    });
    expect(await (await getSession({ sessionVersion: 0 })).json()).toBeNull();
  });

  it("allows a fresh session for a restored account", async () => {
    query.mockResolvedValue({
      recordset: [
        { id: "user-1", role: "scout", deactivatedAt: null, sessionVersion: 2 },
      ],
    });
    expect(
      await (await getSession({ sessionVersion: 2 })).json(),
    ).toMatchObject({ user: { role: "scout" } });
  });

  it("fails closed if current permissions cannot be read", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    query.mockRejectedValue(new Error("Database unavailable"));
    expect(await (await getSession()).json()).toBeNull();
  });

  it("uses the verified guest role and event without a database account", async () => {
    vi.stubEnv("AUTH_SECRET", "guest-secret");
    const event = {
      name: "Test",
      eventCode: "2026test",
      year: 2026,
      competitionType: "FRC" as const,
    };
    const { token: guestToken } = createGuestEventLink(event);
    const response = await getSession({ guestToken, role: "admin" });
    expect(await response.json()).toMatchObject({
      user: { role: "guest", username: "guest" },
      guestEvent: event,
    });
    expect(query).not.toHaveBeenCalled();
  });

  it("signs in from a guest link through the real credentials callback", async () => {
    vi.stubEnv("AUTH_SECRET", "guest-secret");
    const { token: guestToken } = createGuestEventLink({
      name: "Test",
      eventCode: "2026test",
      year: 2026,
      competitionType: "FRC",
    });
    const csrfResponse = await handlers.GET(
      new NextRequest("http://localhost/api/auth/csrf"),
    );
    const { csrfToken } = await csrfResponse.json();
    const csrfCookies = csrfResponse.headers
      .getSetCookie()
      .map((cookie) => cookie.split(";")[0])
      .join("; ");
    const loginResponse = await handlers.POST(
      new NextRequest("http://localhost/api/auth/callback/credentials", {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
          cookie: csrfCookies,
        },
        body: new URLSearchParams({
          csrfToken,
          guestToken,
          callbackUrl: "http://localhost/dashboard",
        }),
      }),
    );
    expect(loginResponse.headers.get("location")).toBe(
      "http://localhost/dashboard",
    );
    const sessionCookies = loginResponse.headers
      .getSetCookie()
      .map((cookie) => cookie.split(";")[0])
      .join("; ");
    const response = await handlers.GET(
      new NextRequest("http://localhost/api/auth/session", {
        headers: { cookie: sessionCookies },
      }),
    );
    expect(await response.json()).toMatchObject({
      user: { role: "guest" },
      guestEvent: { eventCode: "2026test" },
    });
    expect(query).not.toHaveBeenCalled();
  });

  it("rejects guest sessions whose grant expired even when the auth JWT is valid", async () => {
    vi.stubEnv("AUTH_SECRET", "guest-secret");
    const { token: guestToken, expiresAt } = createGuestEventLink({
      name: "Test",
      eventCode: "2026test",
      year: 2026,
      competitionType: "FRC",
    });
    vi.spyOn(Date, "now").mockReturnValue(expiresAt);
    expect(
      await (await getSession({ guestToken, role: "guest" })).json(),
    ).toBeNull();
    expect(query).not.toHaveBeenCalled();
  });

  it("rejects already signed-in guest sessions after revocation", async () => {
    vi.stubEnv("AUTH_SECRET", "guest-secret");
    const { token: guestToken } = createGuestEventLink({
      name: "Test",
      eventCode: "2026test",
      year: 2026,
      competitionType: "FRC",
    });
    const grant = verifyGuestEventLink(guestToken)!;
    guestLinks.set(grant.nonce, { token: guestToken, revokedAt: Date.now() });
    expect(
      await (await getSession({ guestToken, role: "guest" })).json(),
    ).toBeNull();
    expect(query).not.toHaveBeenCalled();
  });
});
