import { afterEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import {
  createGuestEventLink,
  verifyGuestEventLink,
} from "@/lib/server/event-guest";

const getToken = vi.hoisted(() => vi.fn());
const resolveGrant = vi.hoisted(() => vi.fn());
vi.mock("@/lib/server/guest-link-service", () => ({
  resolveGuestEventLink: resolveGrant,
}));
vi.mock("next-auth/jwt", () => ({ getToken }));
vi.mock("@/lib/server/auth-request", () => ({
  withAuthOrigin: (request: NextRequest) => request,
}));
import proxy from "@/proxy";

function guest() {
  resolveGrant.mockImplementation(async (token: string) =>
    verifyGuestEventLink(token),
  );
  vi.stubEnv("AUTH_SECRET", "proxy-test-secret");
  const { token, expiresAt } = createGuestEventLink({
    name: "Event",
    eventCode: "2026test",
    year: 2026,
    competitionType: "FRC",
  });
  getToken.mockResolvedValue({ role: "guest", guestToken: token });
  return { expiresAt };
}
afterEach(() => {
  vi.unstubAllEnvs();
});

describe("guest proxy enforcement", () => {
  it("rejects all data mutations, including server action POSTs", async () => {
    guest();
    for (const method of ["POST", "PUT", "PATCH", "DELETE"]) {
      const response = await proxy(
        new NextRequest("http://test/api/scouting/entries/match", { method }),
      );
      expect(response.status).toBe(403);
    }
    expect(
      (
        await proxy(
          new NextRequest("http://test/dashboard", { method: "POST" }),
        )
      ).status,
    ).toBe(403);
  });

  it("rewrites reads with the signed event and prevents private routes", async () => {
    guest();
    const response = await proxy(
      new NextRequest("http://test/api/scouting/entries/team?teamNumber=492"),
    );
    const rewritten = new URL(response.headers.get("x-middleware-rewrite")!);
    expect(rewritten.searchParams.get("eventCode")).toBe("2026test");
    expect(rewritten.searchParams.get("year")).toBe("2026");
    expect(response.headers.get("cache-control")).toContain("no-store");
    expect(response.headers.get("x-athena-guest")).toBe("1");
    expect(
      (await proxy(new NextRequest("http://test/api/scouting/picklist")))
        .status,
    ).toBe(403);
    expect(
      (await proxy(new NextRequest("http://test/api/events/other/teams")))
        .status,
    ).toBe(403);
    const deniedPage = await proxy(
      new NextRequest("http://test/dashboard/picklist"),
    );
    expect(deniedPage.headers.get("location")).toBe("http://test/dashboard");
    expect(
      (
        await proxy(new NextRequest("http://test/dashboard/analysis"))
      ).headers.get("x-middleware-next"),
    ).toBe("1");
  });

  it("rejects an expired grant and keeps signout available", async () => {
    const { expiresAt } = guest();
    vi.spyOn(Date, "now").mockReturnValue(expiresAt);
    expect(
      (await proxy(new NextRequest("http://test/api/scouting/entries/match")))
        .status,
    ).toBe(401);
    expect(
      (
        await proxy(
          new NextRequest("http://test/api/auth/signout", { method: "POST" }),
        )
      ).headers.get("x-middleware-next"),
    ).toBe("1");
  });

  it("rejects revoked links on every guest request", async () => {
    guest();
    resolveGrant.mockResolvedValue(null);
    expect(
      (await proxy(new NextRequest("http://test/api/scouting/entries/match")))
        .status,
    ).toBe(401);
    expect(
      (await proxy(new NextRequest("http://test/dashboard"))).headers.get(
        "location",
      ),
    ).toBe("http://test/login");
  });
});
