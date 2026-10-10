"use client";

import type { EventScope } from "@/lib/offline-types";

import { teamApi } from "@/lib/api/database-client";
import { indexedDBService } from "@/lib/indexeddb-service";
import { loadWithOfflineCache } from "@/lib/offline-data";
import type { TeamData } from "@/lib/types";
import { useSession } from "next-auth/react";
import { useAsyncData } from "./use-async-data";
import { useSelectedEvent } from "./use-event-config";
import { useGameConfig } from "./use-game-config";

export function useTeamData(teamNumber: string) {
  const { data: session } = useSession();
  const isGuest = !!session?.guestEvent;
  const selectedEvent = useSelectedEvent();
  const { currentYear, competitionType } = useGameConfig();
  const eventCode = selectedEvent?.eventCode;
  const { data, loading, error } = useAsyncData(
    teamNumber && currentYear
      ? JSON.stringify([teamNumber, currentYear, eventCode, competitionType, session?.user?.id, isGuest])
      : null,
    () => loadWithOfflineCache({
      isGuest,
      load: () => teamApi.getTeamData(Number(teamNumber), currentYear, eventCode, competitionType),
      readCache: () => eventCode
        ? buildTeamDataFromCache(teamNumber, { eventCode, competitionType, year: currentYear })
        : Promise.resolve(null),
      offlineMessage: "Offline - no cached data available for this team",
      errorMessage: "Failed to load team data",
    }),
  );
  return {
    teamData: data?.data ?? null,
    loading,
    error: data?.error ?? (error ? "Failed to load team data" : null),
    isOfflineData: data?.isOfflineData ?? false,
  };
}

/** Reconstruct a partial TeamData from cached pit/match entries */
async function buildTeamDataFromCache(
  teamNumber: string,
  scope: EventScope,
): Promise<TeamData | null> {
  const teamNum = parseInt(teamNumber);

  const [cachedMatch, cachedPit] = await Promise.all([
    indexedDBService.getCachedMatchEntries(scope),
    indexedDBService.getCachedPitEntries(scope),
  ]);

  const matchEntries =
    cachedMatch?.entries.filter((e) => e.teamNumber === teamNum) ?? [];
  const pitEntry =
    cachedPit?.entries.find((e) => e.teamNumber === teamNum) ?? null;

  // Only return data if we have something useful
  if (matchEntries.length === 0 && !pitEntry) return null;

  return {
    teamNumber: teamNum,
    eventCode: scope.eventCode,
    matchEntries,
    pitEntry,
    // Server-computed fields are unavailable offline
    stats: null,
    epa: null,
    matchCount: matchEntries.length,
  };
}
