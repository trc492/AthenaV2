"use client";

import { useSelectedEvent } from "./use-event-config";
import { useGameConfig } from "./use-game-config";
import { useAsyncData } from "./use-async-data";
import { teamApi } from "@/lib/api/database-client";
import { indexedDBService } from "@/lib/indexeddb-service";
import type { TeamData } from "@/lib/types";

interface TeamDataResult {
  teamData: TeamData | null;
  error: string | null;
  isOfflineData: boolean;
}

export function useTeamData(teamNumber: string) {
  const selectedEvent = useSelectedEvent();
  const { currentYear, competitionType } = useGameConfig();
  const eventCode = selectedEvent?.eventCode;

  const { data, loading } = useAsyncData<TeamDataResult>(
    teamNumber && currentYear
      ? `${teamNumber}|${currentYear}|${eventCode ?? ""}|${competitionType}`
      : null,
    async () => {
      const isOnline =
        typeof navigator !== "undefined" ? navigator.onLine : true;

      // If offline, reconstruct from cached pit/match entries
      if (!isOnline && eventCode) {
        const offlineData = await buildTeamDataFromCache(teamNumber, eventCode);
        if (offlineData) {
          return { teamData: offlineData, error: null, isOfflineData: true };
        }
        return {
          teamData: null,
          error: "Offline — no cached data available for this team",
          isOfflineData: false,
        };
      }

      try {
        // Fetch team data from API
        const teamData = await teamApi.getTeamData(
          parseInt(teamNumber),
          currentYear,
          eventCode,
          competitionType,
        );
        return { teamData, error: null, isOfflineData: false };
      } catch (err) {
        console.error("Error fetching team data:", err);

        // Fallback to IndexedDB cache on network error
        if (eventCode) {
          try {
            const offlineData = await buildTeamDataFromCache(
              teamNumber,
              eventCode,
            );
            if (offlineData) {
              return {
                teamData: offlineData,
                error: null,
                isOfflineData: true,
              };
            }
          } catch (cacheErr) {
            console.warn("Failed to read cached team data:", cacheErr);
          }
        }

        return {
          teamData: null,
          error: "Failed to load team data",
          isOfflineData: false,
        };
      }
    },
  );

  return {
    teamData: data?.teamData ?? null,
    loading,
    error: data?.error ?? null,
    isOfflineData: data?.isOfflineData ?? false,
  };
}

/** Reconstruct a partial TeamData from cached pit/match entries */
async function buildTeamDataFromCache(
  teamNumber: string,
  eventCode: string,
): Promise<TeamData | null> {
  const teamNum = parseInt(teamNumber);

  const [cachedMatch, cachedPit] = await Promise.all([
    indexedDBService.getCachedMatchEntries(eventCode),
    indexedDBService.getCachedPitEntries(eventCode),
  ]);

  const matchEntries =
    cachedMatch?.entries.filter((e) => e.teamNumber === teamNum) ?? [];
  const pitEntry =
    cachedPit?.entries.find((e) => e.teamNumber === teamNum) ?? null;

  // Only return data if we have something useful
  if (matchEntries.length === 0 && !pitEntry) return null;

  return {
    teamNumber: teamNum,
    eventCode,
    matchEntries,
    pitEntry,
    // Server-computed fields are unavailable offline
    stats: null,
    epa: null,
    matchCount: matchEntries.length,
  };
}
