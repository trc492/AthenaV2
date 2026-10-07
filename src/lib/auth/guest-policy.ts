import type { GuestEventGrant } from "@/lib/server/event-guest";

const pages = new Set([
  "/dashboard",
  "/dashboard/teamlist",
  "/dashboard/pitscouting",
  "/dashboard/matchscouting",
  "/dashboard/analysis",
  "/dashboard/matchup",
  "/dashboard/schedule",
]);
export function isGuestPage(pathname: string) {
  return pages.has(pathname) || /^\/dashboard\/team\/\d+$/.test(pathname);
}

const scoutingReads = new Set([
  "/api/scouting/entries/match",
  "/api/scouting/entries/pit",
  "/api/scouting/entries/team",
  "/api/scouting/analysis/stats",
  "/api/scouting/analysis/analysis",
  "/api/events/custom-events",
]);

/** Allow only audited reads and pin every request to the signed event scope. */
export function scopeGuestApi(url: URL, grant: GuestEventGrant): URL | null {
  const scoped = new URL(url);
  const path = scoped.pathname;
  const eventRead =
    /^\/api\/events\/([^/]+)\/(teams|rankings|schedule|colors|status|matches)$/.exec(
      path,
    );
  const teamRead = /^\/api\/teams\/\d+\/(media|average-score)$/.test(path);
  if (!scoutingReads.has(path) && !eventRead && !teamRead) return null;
  if (eventRead && decodeURIComponent(eventRead[1]) !== grant.eventCode)
    return null;
  const params = scoped.searchParams;
  for (const [key, value] of Object.entries({
    eventCode: grant.eventCode,
    year: String(grant.year),
    season: String(grant.year),
    competitionType: grant.competitionType,
  })) {
    if (
      params.has(key) &&
      params.getAll(key).some((supplied) => supplied !== value)
    )
      return null;
    params.set(key, value);
  }
  return scoped;
}

export function isGuestAuthRequest(path: string, method: string) {
  if (method === "GET")
    return [
      "/api/auth/session",
      "/api/auth/csrf",
      "/api/auth/providers",
      "/api/auth/error",
    ].includes(path);
  return (
    method === "POST" &&
    ["/api/auth/signout", "/api/auth/callback/credentials"].includes(path)
  );
}
