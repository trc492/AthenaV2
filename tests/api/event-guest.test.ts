import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { DatabaseService } from "@/lib/types";
import {
  createGuestEventLink,
  verifyGuestEventLink,
} from "@/lib/server/event-guest";
import { guestDatabase } from "@/lib/server/guest-database";
import type { Session } from "next-auth";

const event = {
  eventCode: "2026test",
  name: "Test Event",
  year: 2026,
  competitionType: "FRC" as const,
};

describe("guest event access", () => {
  beforeEach(() => {
    vi.stubEnv("AUTH_SECRET", "test-guest-secret");
  });
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.useRealTimers();
  });

  it("verifies a link and rejects changes to its event scope", () => {
    const { token } = createGuestEventLink(event);
    expect(verifyGuestEventLink(token)).toMatchObject(event);
    const [payload, signature] = token.split(".");
    const modified = {
      ...JSON.parse(Buffer.from(payload, "base64url").toString()),
      eventCode: "other",
    };
    expect(
      verifyGuestEventLink(
        `${Buffer.from(JSON.stringify(modified)).toString("base64url")}.${signature}`,
      ),
    ).toBeNull();
    expect(verifyGuestEventLink("invalid")).toBeNull();
  });

  it("rejects expired links and links signed with a different secret", () => {
    vi.useFakeTimers();
    const { token, expiresAt } = createGuestEventLink(event);
    vi.setSystemTime(expiresAt);
    expect(verifyGuestEventLink(token)).toBeNull();
    vi.useRealTimers();
    vi.stubEnv("AUTH_SECRET", "different-secret");
    expect(verifyGuestEventLink(token)).toBeNull();
  });

  it("filters every scope dimension and removes identities and free text", async () => {
    const entry = {
      ...event,
      teamNumber: 492,
      matchNumber: 1,
      alliance: "red",
      userId: "private",
      notes: "private",
      gameSpecificData: {
        score: 12,
        comments: "private",
        auto: { count: 3, notes: "private" },
      },
    };
    const getAllMatchEntries = vi
      .fn()
      .mockResolvedValue([
        entry,
        { ...entry, eventCode: "other" },
        { ...entry, year: 2025 },
        { ...entry, competitionType: "FTC" },
      ]);
    const getAllPitEntries = vi
      .fn()
      .mockResolvedValue([
        { ...entry, driveTrain: "Swerve", autoDrawing: "private" },
      ]);
    const service = {
      getAllMatchEntries,
      getAllPitEntries,
    } as unknown as DatabaseService;
    const grant = verifyGuestEventLink(createGuestEventLink(event).token)!;
    const scoped = guestDatabase(service, {
      user: { id: "guest", role: "guest" },
      guestEvent: grant,
      expires: new Date(grant.expiresAt).toISOString(),
    } as Session);
    const data = {
      matches: await scoped.getAllMatchEntries(),
      pits: await scoped.getAllPitEntries(),
    };
    expect(getAllMatchEntries).toHaveBeenCalledWith(2026, "2026test", "FRC");
    expect(getAllPitEntries).toHaveBeenCalledWith(2026, "2026test", "FRC");
    expect(data.matches).toHaveLength(1);
    expect(data.matches[0]).toMatchObject({
      teamNumber: 492,
      matchNumber: 1,
      alliance: "red",
      notes: "",
      gameSpecificData: { score: 12, auto: { count: 3 } },
    });
    expect(JSON.stringify(data)).not.toContain("private");
    expect(data.pits).toHaveLength(1);
    expect(() => scoped.addMatchEntry).toThrow("Operation unavailable");
    expect(() => scoped.query).toThrow("Operation unavailable");
  });
});


describe("configurable guest access", () => {
  it("preserves notes only when allowed, while always hiding identities and other events", async () => {
    const grant = { ...event, canViewNotes: true, expiresAt: Date.now() + 10000, nonce: "a".repeat(32) };
    const entry = { ...event, notes: "Useful note", userId: "private", gameSpecificData: { comments: "Nested note", scoutName: "private" } };
    const db = { getAllMatchEntries: vi.fn().mockResolvedValue([entry, { ...entry, eventCode: "other" }]) } as unknown as DatabaseService;
    const session = { user: { role: "guest" }, guestEvent: grant } as Session;
    const visible = await guestDatabase(db, session).getAllMatchEntries();
    expect(visible).toHaveLength(1);
    expect(visible[0]).toMatchObject({ notes: "Useful note", gameSpecificData: { comments: "Nested note" } });
    expect(visible[0]).not.toHaveProperty("userId");
    expect(visible[0].gameSpecificData).not.toHaveProperty("scoutName");
    const hidden = await guestDatabase(db, { ...session, guestEvent: { ...grant, canViewNotes: false } }).getAllMatchEntries();
    expect(hidden[0].notes).toBe("");
    expect(hidden[0].gameSpecificData).not.toHaveProperty("comments");
  });
});
