"use client";

import { useState, useEffect } from "react";
import { useSelectedEvent } from "./use-event-config";
import { useGameConfig } from "./use-game-config";
import { indexedDBService } from "@/lib/indexeddb-service";
import { useSession } from "next-auth/react";

export interface TeamInfo {
  teamNumber: number;
  nickname: string;
  key: string;
}

interface TeamState {
  teams: TeamInfo[];
  loading: boolean;
  error: string | null;
  isOfflineData: boolean;
}

export function useEventTeams() {
  const { data: session } = useSession();
  const isGuest = !!session?.guestEvent;
  const selectedEvent = useSelectedEvent();
  const { competitionType, currentYear } = useGameConfig();
  const [teamState, setTeamState] = useState<TeamState>({
    teams: [],
    loading: false,
    error: null,
    isOfflineData: false,
  });

  useEffect(() => {
    let isCancelled = false;

    async function fetchTeams() {
      if (!selectedEvent?.eventCode) {
        if (!isCancelled) {
          setTeamState({
            teams: [],
            loading: false,
            error: null,
            isOfflineData: false,
          });
        }
        return;
      }

      const isOnline =
        typeof navigator !== "undefined" ? navigator.onLine : true;

      setTeamState((prev) => ({
        ...prev,
        loading: true,
        error: null,
      }));

      let hasCachedTeams = false;
      try {
        const cachedData = isGuest ? null : await indexedDBService.getCachedEventTeams(
          selectedEvent.eventCode,
        );
        if (cachedData && cachedData.teams.length > 0 && !isCancelled) {
          hasCachedTeams = true;
          setTeamState({
            teams: [...cachedData.teams].sort(
              (a, b) => a.teamNumber - b.teamNumber,
            ),
            loading: isOnline,
            error: null,
            isOfflineData: true,
          });
        }
      } catch (cacheError) {
        console.warn("Failed to get cached teams:", cacheError);
      }

      // If offline, try to get cached data first
      if (!isOnline) {
        if (hasCachedTeams) {
          if (!isCancelled) {
            setTeamState((prev) => ({
              ...prev,
              loading: false,
              error: null,
              isOfflineData: true,
            }));
          }
          return;
        }

        // No cached data available while offline
        if (!isCancelled) {
          setTeamState({
            teams: [],
            loading: false,
            error:
              "Offline - no cached team data available. Connect to internet to download team list.",
            isOfflineData: false,
          });
        }
        return;
      }

      try {
        // Fetch data from our server-side API route with competition type
        const response = await fetch(
          `/api/events/${selectedEvent.eventCode}/teams?competitionType=${competitionType}&year=${currentYear}`,
        );

        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }

        const data = await response.json();

        if (data.error) {
          throw new Error(data.error);
        }

        // The API route returns teams with team_number, nickname, etc.
        const teams: TeamInfo[] = (data || []).map(
          (team: { team_number: number; nickname?: string; key?: string }) => ({
            teamNumber: team.team_number,
            nickname: team.nickname || `Team ${team.team_number}`,
            key:
              team.key || `${competitionType.toLowerCase()}${team.team_number}`,
          }),
        );

        const sortedTeams = teams.sort((a, b) => a.teamNumber - b.teamNumber);

        // Cache the teams for offline use
        try {
          if (!isGuest) await indexedDBService.cacheEventTeams(
            selectedEvent.eventCode,
            competitionType,
            currentYear,
            sortedTeams,
          );
        } catch (cacheError) {
          console.warn("Failed to cache teams:", cacheError);
        }

        if (!isCancelled) {
          setTeamState({
            teams: sortedTeams,
            loading: false,
            error: null,
            isOfflineData: false,
          });
        }
      } catch (error) {
        console.error("Error fetching teams:", error);

        if (hasCachedTeams) {
          if (!isCancelled) {
            setTeamState((prev) => ({
              ...prev,
              loading: false,
              error: null,
              isOfflineData: true,
            }));
          }
          return;
        }

        if (!isCancelled) {
          setTeamState({
            teams: [],
            loading: false,
            error: `Failed to fetch teams: ${error instanceof Error ? error.message : "Unknown error"}`,
            isOfflineData: false,
          });
        }
      }
    }

    fetchTeams();

    return () => {
      isCancelled = true;
    };
  }, [selectedEvent?.eventCode, competitionType, currentYear, isGuest]);

  return teamState;
}

// Hook to get just team numbers for dropdowns
export function useEventTeamNumbers(): number[] {
  const { teams } = useEventTeams();
  return teams
    .map((team) => team.teamNumber)
    .filter((teamNumber) => teamNumber && teamNumber > 0);
}

// Hook to get team info by number
export function useTeamInfo(teamNumber: number): TeamInfo | null {
  const { teams } = useEventTeams();
  return teams.find((team) => team.teamNumber === teamNumber) || null;
}
