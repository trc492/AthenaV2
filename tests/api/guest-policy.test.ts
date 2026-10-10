import { describe, expect, it } from "vitest";
import {
  isGuestPage,
  scopeGuestApi,
  isGuestAuthRequest,
} from "@/lib/auth/guest-policy";
import { ROLES, PERMISSIONS, hasPermission } from "@/lib/auth/roles";
import type { GuestEventGrant } from "@/lib/server/event-guest";

const grant: GuestEventGrant = {
  name: "Event",
  eventCode: "2026test",
  year: 2026,
  competitionType: "FRC",
  expiresAt: Date.now() + 10000,
  nonce: "a".repeat(32),
};

describe("guest website policy", () => {
  it("allows normal event pages but hides private and write workflows", () => {
    for (const path of [
      "/dashboard",
      "/dashboard/teamlist",
      "/dashboard/team/492",
      "/dashboard/analysis",
      "/dashboard/matchup",
      "/dashboard/matchscouting",
      "/dashboard/pitscouting",
      "/dashboard/schedule",
    ])
      expect(isGuestPage(path)).toBe(true);
    for (const path of [
      "/dashboard/picklist",
      "/dashboard/guest-links",
      "/dashboard/admin/database",
      "/dashboard/settings",
      "/dashboard/spr",
      "/scout/matchscout",
      "/scout/pitscout",
    ])
      expect(isGuestPage(path)).toBe(false);
  });

  it("pins missing API scope and rejects any conflicting scope", () => {
    const scoped = scopeGuestApi(
      new URL("http://test/api/scouting/entries/team?teamNumber=492"),
      grant,
    )!;
    expect(Object.fromEntries(scoped.searchParams)).toMatchObject({
      teamNumber: "492",
      year: "2026",
      season: "2026",
      competitionType: "FRC",
      eventCode: "2026test",
    });
    for (const query of [
      "eventCode=other",
      "year=2025",
      "season=2025",
      "competitionType=FTC",
      "year=2026&year=2025",
    ])
      expect(
        scopeGuestApi(
          new URL(`http://test/api/scouting/entries/team?${query}`),
          grant,
        ),
      ).toBeNull();
    expect(
      scopeGuestApi(new URL("http://test/api/events/other/teams"), grant),
    ).toBeNull();
    expect(
      scopeGuestApi(new URL("http://test/api/events/2026test/teams"), grant),
    ).not.toBeNull();
  });

  it("denies unaudited and sensitive API routes", () => {
    for (const path of [
      "/api/users",
      "/api/events/guest-links",
      "/api/scouting/picklist",
      "/api/scouting/picklist/notes",
      "/api/scouting/admin/export",
      "/api/system/settings",
      "/api/scouting/schedule/assignments",
      "/api/scouting/entries/match-assignments",
    ])
      expect(scopeGuestApi(new URL(`http://test${path}`), grant)).toBeNull();
    expect(isGuestAuthRequest("/api/auth/session", "POST")).toBe(false);
    expect(isGuestAuthRequest("/api/auth/register", "POST")).toBe(false);
    expect(isGuestAuthRequest("/api/auth/signout", "POST")).toBe(true);
  });

  it("grants only event data viewing permissions", () => {
    for (const permission of Object.values(PERMISSIONS)) {
      expect(hasPermission(ROLES.GUEST, permission)).toBe(
        [
          PERMISSIONS.VIEW_DASHBOARD,
          PERMISSIONS.VIEW_MATCH_SCOUTING,
          PERMISSIONS.VIEW_PIT_SCOUTING,
        ].includes(permission as typeof PERMISSIONS.VIEW_DASHBOARD),
      );
    }
  });
});


it("allows submission pages only for guests authorized to scout", () => {
  expect(isGuestPage("/scout/matchscout", grant)).toBe(false);
  expect(isGuestPage("/scout/matchscout", { ...grant, canAddScouting: true })).toBe(true);
  expect(isGuestPage("/scout/pitscout", { ...grant, canAddScouting: true })).toBe(true);
  expect(isGuestPage("/dashboard/admin/database", { ...grant, canAddScouting: true })).toBe(false);
  expect(hasPermission("external", PERMISSIONS.VIEW_DASHBOARD)).toBe(false);
});
