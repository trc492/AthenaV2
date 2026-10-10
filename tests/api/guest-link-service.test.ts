import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createHmac } from "node:crypto";
import type { DatabaseService, GuestLinkRecord } from "@/lib/types";
import {
  activeGuestLinks,
  issueGuestLink,
  resolveGuestEventLink,
} from "@/lib/server/guest-link-service";

const event = {
  name: "Event",
  eventCode: "2026test",
  year: 2026,
  competitionType: "FRC" as const,
};

describe("persistent guest links", () => {
  let records: Map<string, GuestLinkRecord>;
  let service: DatabaseService;
  beforeEach(() => {
    vi.stubEnv("AUTH_SECRET", "registry-test-secret");
    records = new Map();
    service = {
      addGuestLink: vi.fn(async (record: GuestLinkRecord) => {
        records.set(record.id, record);
      }),
      getGuestLinks: vi.fn(async () => [...records.values()]),
      getGuestLink: vi.fn(async (id: string) => records.get(id)),
      revokeGuestLink: vi.fn(async (id: string, revokedAt: number) => {
        records.get(id)!.revokedAt = revokedAt;
      }),
    } as unknown as DatabaseService;
  });
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.useRealTimers();
  });

  it("uses current stored access for existing tokens and sessions", async () => {
    const record = await issueGuestLink({ ...event, canAddScouting: true, canViewNotes: true }, "manager", service);
    records.set(record.id, { ...record, canAddScouting: false, canViewNotes: false });
    expect(await resolveGuestEventLink(record.token, service)).toMatchObject({ canAddScouting: false, canViewNotes: false });
    records.set(record.id, { ...record, canAddScouting: true, canViewNotes: false });
    expect(await resolveGuestEventLink(record.token, service)).toMatchObject({ canAddScouting: true, canViewNotes: false });
    expect((await activeGuestLinks(service))[0].path).toBe(`/guest/events/${record.token}`);
  });

  it("persists issued links and lists their copyable paths", async () => {
    const record = await issueGuestLink(event, "manager-1", service);
    expect(record.createdBy).toBe("manager-1");
    expect(await resolveGuestEventLink(record.token, service)).toMatchObject(
      event,
    );
    const links = await activeGuestLinks(service);
    expect(links).toHaveLength(1);
    expect(links[0].path).toBe(`/guest/events/${record.token}`);
    expect(links[0]).not.toHaveProperty("token");
  });

  it("removes revoked and expired links and refuses existing access", async () => {
    const revoked = await issueGuestLink(event, "manager", service);
    await service.revokeGuestLink(revoked.id, Date.now());
    expect(await resolveGuestEventLink(revoked.token, service)).toBeNull();
    const expired = await issueGuestLink(event, "manager", service);
    vi.useFakeTimers();
    vi.setSystemTime(expired.expiresAt);
    expect(await activeGuestLinks(service)).toEqual([]);
    expect(await resolveGuestEventLink(expired.token, service)).toBeNull();
  });

  it("fails closed when a tracked record is missing or storage fails", async () => {
    const record = await issueGuestLink(event, "manager", service);
    records.clear();
    expect(await resolveGuestEventLink(record.token, service)).toBeNull();
    vi.mocked(service.getGuestLink).mockRejectedValue(
      new Error("Database offline"),
    );
    expect(await resolveGuestEventLink(record.token, service)).toBeNull();
  });

  it("rejects an unrecorded signed link without registering it", async () => {
    const grant = {
      ...event,
      nonce: "a".repeat(32),
      expiresAt: Date.now() + 100000,
    };
    const payload = Buffer.from(JSON.stringify(grant)).toString("base64url");
    const signature = createHmac("sha256", "registry-test-secret")
      .update(`event-guest:v1:${payload}`)
      .digest("base64url");
    const token = `${payload}.${signature}`;
    expect(await activeGuestLinks(service)).toEqual([]);
    expect(await resolveGuestEventLink(token, service)).toBeNull();
    expect(await activeGuestLinks(service)).toEqual([]);
    expect(service.addGuestLink).not.toHaveBeenCalled();
  });
});
