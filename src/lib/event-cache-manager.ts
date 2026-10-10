// Event Cache Manager
// Orchestrates downloading and caching all event data for full offline use

import { indexedDBService } from "@/lib/indexeddb-service";
import type { EventCacheStatus, EventScope } from "@/lib/offline-types";
import type { AnalysisData, MatchEntry, PitEntry } from "@/lib/types";

export type CacheStepId =
  | "session"
  | "pages"
  | "teams"
  | "schedule"
  | "scoutSchedule"
  | "scoutList"
  | "pitEntries"
  | "matchEntries"
  | "analysisData";

export interface CacheStep {
  id: CacheStepId;
  label: string;
  status: "pending" | "loading" | "success" | "error" | "skipped";
  detail?: string;
  error?: string;
}

// Steps for scout-only mode (lightweight)
export const SCOUT_STEPS: CacheStepId[] = [
  "session",
  "pages",
  "teams",
  "schedule",
  "scoutSchedule",
  "scoutList",
];

// Additional steps for full event cache
export const FULL_CACHE_STEPS: CacheStepId[] = [
  ...SCOUT_STEPS,
  "pitEntries",
  "matchEntries",
  "analysisData",
];

function buildStepLabel(id: CacheStepId): string {
  switch (id) {
    case "session":
      return "Auth Session";
    case "pages":
      return "App Pages";
    case "teams":
      return "Event Teams";
    case "schedule":
      return "Match Schedule";
    case "scoutSchedule":
      return "Scouting Schedule";
    case "scoutList":
      return "Scout List";
    case "pitEntries":
      return "Pit Scouting Data";
    case "matchEntries":
      return "Match Scouting Data";
    case "analysisData":
      return "Analysis Data";
  }
}

export function buildSteps(stepIds: CacheStepId[]): CacheStep[] {
  return stepIds.map((id) => ({
    id,
    label: buildStepLabel(id),
    status: "pending",
  }));
}

interface CacheOptions extends EventScope {
  eventName: string;
  userRole?: string;
  onStepUpdate: (stepId: CacheStepId, update: Partial<CacheStep>) => void;
}

async function fetchAndCache(
  url: string,
  options?: RequestInit,
): Promise<Response> {
  const response = await fetch(url, {
    cache: "no-cache",
    credentials: "include",
    ...options,
  });
  if (!response.ok) {
    throw new Error(`HTTP ${response.status}`);
  }
  return response;
}

/**
 * Single cache name that the SW's catch-all app-page handler uses.
 * Must stay in sync with APP_PAGES_CACHE in sw.ts.
 */
const APP_PAGES_CACHE = "app-pages";

/** Cache auth session so offline reloads stay logged in */
async function cacheSession(opts: CacheOptions): Promise<void> {
  opts.onStepUpdate("session", {
    status: "loading",
    detail: "Caching auth session...",
  });
  try {
    const res = await fetch("/api/auth/session", {
      credentials: "include",
      cache: "no-cache",
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    // Write directly to the SW's auth-session cache so offline reloads
    // return the authenticated session without relying on SW interception.
    const cache = await caches.open("auth-session");
    await cache.put(new Request("/api/auth/session"), res.clone());
    opts.onStepUpdate("session", {
      status: "success",
      detail: "Session cached",
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Unknown error";
    opts.onStepUpdate("session", { status: "error", error: msg });
    throw err;
  }
}

/** Pages to pre-cache for offline use. All go into APP_PAGES_CACHE. */
const OFFLINE_PAGES = [
  "/",
  "/dashboard",
  "/dashboard/settings",
  "/scout/matchscout",
  "/scout/pitscout",
];

/** Cache pages for offline navigation.
 *  Writes directly into the same Cache API store the SW uses (APP_PAGES_CACHE)
 *  so that offline navigations are served the *authenticated* HTML.
 */
async function cachePages(opts: CacheOptions): Promise<void> {
  opts.onStepUpdate("pages", {
    status: "loading",
    detail: "Caching app pages...",
  });
  const cache = await caches.open(APP_PAGES_CACHE);
  let cached = 0;

  for (const url of OFFLINE_PAGES) {
    try {
      const res = await fetch(url, {
        credentials: "include",
        cache: "no-cache",
      });
      if (res.ok) {
        await cache.put(url, res.clone());
        cached++;
      }
    } catch {
      // Non-critical — continue with other pages
    }
  }

  if (cached === 0) {
    opts.onStepUpdate("pages", { status: "error", error: "No pages cached" });
    throw new Error("Failed to cache any pages");
  }

  opts.onStepUpdate("pages", {
    status: "success",
    detail: `${cached}/${OFFLINE_PAGES.length} pages cached`,
  });
}

/** Cache event teams and return count */
async function cacheTeams(opts: CacheOptions): Promise<number> {
  opts.onStepUpdate("teams", {
    status: "loading",
    detail: "Downloading team list...",
  });
  try {
    const url = `/api/events/${opts.eventCode}/teams?competitionType=${opts.competitionType}&year=${opts.year}`;
    const res = await fetchAndCache(url);
    const teams = await res.json();
    const teamCount = Array.isArray(teams) ? teams.length : 0;
    opts.onStepUpdate("teams", {
      status: "success",
      detail: `${teamCount} teams cached`,
    });
    return teamCount;
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Unknown error";
    opts.onStepUpdate("teams", { status: "error", error: msg });
    throw err;
  }
}

/** Cache match schedule */
async function cacheSchedule(opts: CacheOptions): Promise<void> {
  opts.onStepUpdate("schedule", {
    status: "loading",
    detail: "Downloading match schedule...",
  });
  try {
    const url = `/api/events/${opts.eventCode}/schedule?competitionType=${opts.competitionType}&season=${opts.year}`;
    const res = await fetchAndCache(url);
    await res.text();
    opts.onStepUpdate("schedule", {
      status: "success",
      detail: "Schedule cached",
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Unknown error";
    opts.onStepUpdate("schedule", { status: "error", error: msg });
    // Non-critical — continue
  }
}

/** Cache scouting schedule */
async function cacheScoutSchedule(opts: CacheOptions): Promise<void> {
  opts.onStepUpdate("scoutSchedule", {
    status: "loading",
    detail: "Downloading scouting schedule...",
  });
  try {
    const url = `/api/scouting/entries/match-assignments?eventCode=${encodeURIComponent(opts.eventCode)}&year=${opts.year}&competitionType=${opts.competitionType}`;
    const res = await fetchAndCache(url);
    await res.text();
    opts.onStepUpdate("scoutSchedule", {
      status: "success",
      detail: "Scouting schedule cached",
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Unknown error";
    opts.onStepUpdate("scoutSchedule", { status: "error", error: msg });
    // Non-critical — continue
  }
}

/** Download and cache the scout / user list for tablet offline support */
async function cacheScoutList(opts: CacheOptions): Promise<void> {
  opts.onStepUpdate("scoutList", {
    status: "loading",
    detail: "Downloading scout list...",
  });
  try {
    const res = await fetchAndCache("/api/users");
    const data = await res.json();
    const scoutUsers = (data.users || []).filter((user: { role: string }) =>
      ["scout", "lead_scout", "admin"].includes(user.role),
    );
    await indexedDBService.cacheScoutList(scoutUsers);
    opts.onStepUpdate("scoutList", {
      status: "success",
      detail: `${scoutUsers.length} scouts cached`,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Unknown error";
    opts.onStepUpdate("scoutList", { status: "error", error: msg });
    // Non-critical — continue
  }
}

/** Download and cache all pit entries for the event into IndexedDB */
async function cachePitEntries(opts: CacheOptions): Promise<number> {
  opts.onStepUpdate("pitEntries", {
    status: "loading",
    detail: "Downloading pit scouting data...",
  });
  try {
    const url = `/api/scouting/entries/pit?eventCode=${opts.eventCode}&year=${opts.year}&competitionType=${opts.competitionType}`;
    const res = await fetchAndCache(url);
    const entries: PitEntry[] = await res.json();
    const count = Array.isArray(entries) ? entries.length : 0;

    await indexedDBService.cachePitEntries(opts, entries);

    opts.onStepUpdate("pitEntries", {
      status: "success",
      detail: `${count} pit entries cached`,
    });
    return count;
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Unknown error";
    opts.onStepUpdate("pitEntries", { status: "error", error: msg });
    throw err;
  }
}

/** Download and cache all match entries for the event into IndexedDB */
async function cacheMatchEntries(opts: CacheOptions): Promise<number> {
  opts.onStepUpdate("matchEntries", {
    status: "loading",
    detail: "Downloading match scouting data...",
  });
  try {
    const url = `/api/scouting/entries/match?eventCode=${opts.eventCode}&year=${opts.year}&competitionType=${opts.competitionType}`;
    const res = await fetchAndCache(url);
    const entries: MatchEntry[] = await res.json();
    const count = Array.isArray(entries) ? entries.length : 0;

    await indexedDBService.cacheMatchEntries(opts, entries);

    opts.onStepUpdate("matchEntries", {
      status: "success",
      detail: `${count} match entries cached`,
    });
    return count;
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Unknown error";
    opts.onStepUpdate("matchEntries", { status: "error", error: msg });
    throw err;
  }
}

/** Download and cache analysis (EPA) data for the event into IndexedDB */
async function cacheAnalysisData(opts: CacheOptions): Promise<void> {
  opts.onStepUpdate("analysisData", {
    status: "loading",
    detail: "Downloading analysis data...",
  });
  try {
    const url = `/api/scouting/analysis/analysis?eventCode=${opts.eventCode}&year=${opts.year}&competitionType=${opts.competitionType}&includeBoxPlot=true`;
    const res = await fetchAndCache(url);
    const data: AnalysisData = await res.json();

    await indexedDBService.cacheAnalysisData(opts, data);

    opts.onStepUpdate("analysisData", {
      status: "success",
      detail: `${data.totalTeams} teams analysed`,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Unknown error";
    opts.onStepUpdate("analysisData", { status: "error", error: msg });
    // Non-critical — continue
  }
}

export interface CacheResult {
  success: boolean;
  stepResults: CacheStep[];
  teamCount: number;
  pitEntryCount: number;
  matchEntryCount: number;
}

/**
 * Run the full caching pipeline.
 * @param mode 'scout' for lightweight (pages + teams + schedules), 'full' for everything
 */
export async function runEventCache(
  mode: "scout" | "full",
  opts: CacheOptions,
): Promise<CacheResult> {
  const stepIds = mode === "full" ? FULL_CACHE_STEPS : SCOUT_STEPS;
  let teamCount = 0;
  let pitEntryCount = 0;
  let matchEntryCount = 0;
  let hasError = false;

  // Always run session + pages first
  try {
    await cacheSession(opts);
  } catch {
    hasError = true;
  }

  try {
    await cachePages(opts);
  } catch {
    hasError = true;
  }

  // Teams
  if (stepIds.includes("teams")) {
    try {
      teamCount = await cacheTeams(opts);
    } catch {
      hasError = true;
    }
  }

  // Schedules
  if (stepIds.includes("schedule")) {
    await cacheSchedule(opts);
  }

  if (stepIds.includes("scoutSchedule")) {
    await cacheScoutSchedule(opts);
  }

  // Scout list (only for tablet/admin accounts that can access /api/users)
  if (stepIds.includes("scoutList")) {
    const canAccessUsers =
      opts.userRole === "tablet" || opts.userRole === "admin";
    if (canAccessUsers) {
      await cacheScoutList(opts);
    } else {
      opts.onStepUpdate("scoutList", {
        status: "skipped",
        detail: "Not needed for your role",
      });
    }
  }

  // Full cache mode: pit & match entries
  if (mode === "full") {
    if (stepIds.includes("pitEntries")) {
      try {
        pitEntryCount = await cachePitEntries(opts);
      } catch {
        hasError = true;
      }
    }

    if (stepIds.includes("matchEntries")) {
      try {
        matchEntryCount = await cacheMatchEntries(opts);
      } catch {
        hasError = true;
      }
    }

    if (stepIds.includes("analysisData")) {
      await cacheAnalysisData(opts);
    }

    // Save cache status metadata
    try {
      const status: EventCacheStatus = {
        eventCode: opts.eventCode,
        eventName: opts.eventName,
        competitionType: opts.competitionType,
        year: opts.year,
        cachedAt: new Date(),
        pitEntryCount,
        matchEntryCount,
        teamCount,
        schedulesCached: true,
        pagesCached: true,
        sessionCached: true,
      };
      await indexedDBService.setEventCacheStatus(status);
    } catch {
      // Non-critical
    }
  }

  return {
    success: !hasError,
    stepResults: [],
    teamCount,
    pitEntryCount,
    matchEntryCount,
  };
}
