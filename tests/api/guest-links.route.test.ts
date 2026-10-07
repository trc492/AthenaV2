import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest, NextResponse } from "next/server";

const permission = vi.hoisted(() => vi.fn());
const store = vi.hoisted(() => ({
  addGuestLink: vi.fn(),
  getGuestLinks: vi.fn(),
  getGuestLink: vi.fn(),
  revokeGuestLink: vi.fn(),
}));
vi.mock("@/lib/server/db-service", () => ({ getDbService: () => store }));
vi.mock("@/lib/server/require-permission", () => ({
  requirePermission: permission,
  requirePermissionWithSession: async (value: string) => {
    const denied = await permission(value);
    return { denied, session: denied ? null : { user: { id: "admin" } } };
  },
}));
import { POST, GET, DELETE } from "@/app/api/events/guest-links/route";
import { verifyGuestEventLink } from "@/lib/server/event-guest";

const event = {
  eventCode: "2026test",
  name: "Event",
  year: 2026,
  competitionType: "FRC",
};
const request = (body: unknown) =>
  new NextRequest("http://test/api/events/guest-links", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

afterEach(() => vi.unstubAllEnvs());
beforeEach(() => {
  store.getGuestLinks.mockResolvedValue([]);
  store.getGuestLink.mockResolvedValue(undefined);
  store.addGuestLink.mockResolvedValue(undefined);
  store.revokeGuestLink.mockResolvedValue(undefined);
});

describe("guest link creation", () => {
  it("requires event management permission", async () => {
    permission.mockResolvedValue(
      NextResponse.json({ error: "Forbidden" }, { status: 403 }),
    );
    expect((await POST(request(event))).status).toBe(403);
    expect((await GET()).status).toBe(403);
    expect(
      (
        await DELETE(
          new NextRequest("http://test/api/events/guest-links?id=abc", {
            method: "DELETE",
          }),
        )
      ).status,
    ).toBe(403);
    expect(permission).toHaveBeenCalledWith("manage_event_settings");
  });

  it("rejects invalid scope", async () => {
    permission.mockResolvedValue(null);
    expect(
      (await POST(request({ ...event, competitionType: "VEX" }))).status,
    ).toBe(400);
    expect((await POST(request({ ...event, year: "2026" }))).status).toBe(400);
  });

  it("creates a verifiable event-only link", async () => {
    permission.mockResolvedValue(null);
    vi.stubEnv("AUTH_SECRET", "test-secret");
    const response = await POST(request(event));
    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toContain("no-store");
    const data = await response.json();
    expect(verifyGuestEventLink(data.path.split("/").pop())).toMatchObject(
      event,
    );
    expect(store.addGuestLink).toHaveBeenCalledWith(
      expect.objectContaining({
        createdBy: "admin",
        eventCode: "2026test",
        revokedAt: null,
      }),
    );
  });

  it("returns the active link list without caching it", async () => {
    permission.mockResolvedValue(null);
    const response = await GET();
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ links: [] });
    expect(response.headers.get("cache-control")).toContain("no-store");
  });

  it("revokes saved links and rejects unknown IDs", async () => {
    permission.mockResolvedValue(null);
    const id = "a".repeat(32);
    const revokeRequest = () =>
      new NextRequest(`http://test/api/events/guest-links?id=${id}`, {
        method: "DELETE",
      });
    expect((await DELETE(revokeRequest())).status).toBe(404);
    store.getGuestLink.mockResolvedValue({ id });
    expect((await DELETE(revokeRequest())).status).toBe(200);
    expect(store.revokeGuestLink).toHaveBeenCalledWith(id, expect.any(Number));
  });
});
