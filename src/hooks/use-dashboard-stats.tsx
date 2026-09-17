"use client";

import { useState, useEffect } from "react";
import { useEventConfig } from "./use-event-config";
import { useGameConfig } from "./use-game-config";
import { statsApi } from "@/lib/api/database-client";

export interface DashboardStats {
  teamsScouted: number;
  matchesRecorded: number;
  dataQuality: number;
  ranking: number;
  pitScoutingProgress: { current: number; total: number };
  qualificationProgress: { current: number; total: number };
  nextMatch: string | null;
  eventComplete: boolean;
  recentActivity: Array<{
    type: "pit" | "match" | "analysis";
    message: string;
    timestamp: Date;
  }>;
  topTeams: Array<{
    teamNumber: number;
    name: string;
    epa: number;
  }>;
}

const DEFAULT_DASHBOARD_STATS: DashboardStats = {
  teamsScouted: 0,
  matchesRecorded: 0,
  dataQuality: 0,
  ranking: 0,
  pitScoutingProgress: { current: 0, total: 0 },
  qualificationProgress: { current: 0, total: 0 },
  nextMatch: null,
  eventComplete: false,
  recentActivity: [],
  topTeams: [],
};

export function useDashboardStats() {
  const { selectedEvent, isLoading: isEventLoading } = useEventConfig();
  const { currentYear, getCurrentYearConfig, competitionType, isInitialized } =
    useGameConfig();
  const gameConfig = getCurrentYearConfig();
  const [stats, setStats] = useState<DashboardStats>(DEFAULT_DASHBOARD_STATS);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isInitialized || isEventLoading) {
      // Keep loading placeholders visible while providers hydrate from local storage / APIs.
      setLoading(true);
      return;
    }

    async function fetchStats() {
      if (!selectedEvent || !gameConfig) {
        setStats(DEFAULT_DASHBOARD_STATS);
        setLoading(false);
        return;
      }

      try {
        setLoading(true);
        setError(null);

        // Fetch qualification matches count from our server-side proxy
        let qualMatchesCount = 0;
        let liveStatus: { label: string | null; complete: boolean } = {
          label: null,
          complete: false,
        };

        const statusRequest = fetch(
          `/api/events/${encodeURIComponent(selectedEvent.eventCode)}/status?competitionType=${competitionType}&season=${currentYear}`,
        )
          .then(async (response) => {
            if (response.ok) liveStatus = await response.json();
          })
          .catch(() => undefined);

        // Use unified matches API
        try {
          const matchesResp = await fetch(
            `/api/events/${encodeURIComponent(selectedEvent.eventCode)}/matches?competitionType=${competitionType}&season=${currentYear}`,
          );
          if (matchesResp.ok) {
            const matchesData = await matchesResp.json();
            qualMatchesCount =
              matchesData?.qualMatchesCount ?? matchesData?.totalMatches ?? 0;
            console.log(`Using event match count: ${qualMatchesCount}`);
          } else {
            // If unified API fails, fall back to custom events
            console.warn(
              "Unified API failed, falling back to custom event data",
            );
            const customEventResp = await fetch(
              `/api/events/custom-events?eventCode=${encodeURIComponent(selectedEvent.eventCode)}&competitionType=${competitionType}`,
            );
            if (customEventResp.ok) {
              const customEvent = await customEventResp.json();
              qualMatchesCount = customEvent?.matchCount ?? 0;
              console.log(
                `Using custom event match count: ${qualMatchesCount}`,
              );
            } else {
              console.warn("Custom event fallback also failed, using 0");
            }
          }
        } catch (apiError) {
          console.warn(
            "API error, attempting custom event fallback:",
            apiError,
          );
          try {
            const customEventResp = await fetch(
              `/api/events/custom-events?eventCode=${encodeURIComponent(selectedEvent.eventCode)}&competitionType=${competitionType}`,
            );
            if (customEventResp.ok) {
              const customEvent = await customEventResp.json();
              qualMatchesCount = customEvent?.matchCount ?? 0;
              console.log(
                `Using custom event match count: ${qualMatchesCount}`,
              );
            } else {
              console.warn("Custom event fallback also failed, using 0");
            }
          } catch (customEventError) {
            console.warn(
              "Both unified API and custom event fallback failed:",
              customEventError,
            );
          }
        }
        // Fetch stats from API
        const apiStats = await statsApi.getDashboardStats(
          currentYear,
          selectedEvent.eventCode,
          competitionType,
        );
        await statusRequest;

        // Transform API response to hook format
        const transformedStats: DashboardStats = {
          teamsScouted: apiStats.totalTeams,
          matchesRecorded: apiStats.totalMatches,
          dataQuality: apiStats.matchCompletion ?? 0,
          ranking:
            apiStats.teamStats.findIndex(
              (team) =>
                team.teamNumber === (competitionType === "FRC" ? 492 : 3543),
            ) + 1 || 0,
          pitScoutingProgress: {
            current: apiStats.totalPitScouts,
            total: apiStats.totalTeams,
          },
          qualificationProgress: {
            current: apiStats.uniqueMatches,
            total: qualMatchesCount,
          },
          nextMatch: liveStatus.label,
          eventComplete: liveStatus.complete,
          recentActivity: apiStats.recentActivity.map((activity) => ({
            type: "match" as const,
            message: `Match ${activity.matchNumber} scouted for Team ${activity.teamNumber}`,
            timestamp: new Date(activity.timestamp),
          })),
          topTeams: apiStats.teamStats.slice(0, 5).map((team) => ({
            teamNumber: team.teamNumber,
            name: team.name,
            epa: isNaN(team.totalEPA) ? 0 : team.totalEPA,
          })),
        };

        setStats(transformedStats);
      } catch (err) {
        console.error("Error fetching dashboard stats:", err);
        setError("Failed to load dashboard statistics");
      } finally {
        setLoading(false);
      }
    }

    fetchStats();
  }, [
    selectedEvent,
    currentYear,
    gameConfig,
    competitionType,
    isInitialized,
    isEventLoading,
  ]);

  return { stats, loading, error };
}
