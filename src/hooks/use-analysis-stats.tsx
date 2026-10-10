"use client";
import { useSession } from "next-auth/react";

import { statsApi } from "@/lib/api/database-client";
import { indexedDBService } from "@/lib/indexeddb-service";
import { loadWithOfflineCache } from "@/lib/offline-data";
import { AnalysisMetricDefinition } from "@/lib/types";
import { useAsyncData } from "./use-async-data";
import { useSelectedEvent } from "./use-event-config";
import { useGameConfig } from "./use-game-config";

export interface AnalysisStats {
  teamsAnalyzed: number;
  highestEPA: number;
  averageEPA: number;
  dataPoints: number;
  availableMetrics: AnalysisMetricDefinition[];
  teamEPAData: Array<{
    team: string;
    matchesPlayed: number;
    auto: number;
    teleop: number;
    endgame: number;
    penalties: number;
    totalEPA: number;
    totalEPAStats?: {
      min: number;
      q1: number;
      median: number;
      q3: number;
      max: number;
    };
    detailMetrics: Record<string, number>;
  }>;
}

function transformToStats(
  apiStats: import("@/lib/types").AnalysisData,
): AnalysisStats {
  return {
    teamsAnalyzed: apiStats.totalTeams,
    highestEPA:
      apiStats.teamEPAData.length > 0
        ? parseFloat(
            Math.max(
              ...apiStats.teamEPAData.map((team) => team.totalEPA),
            ).toFixed(3),
          )
        : 0,
    averageEPA:
      apiStats.teamEPAData.length > 0
        ? parseFloat(
            (
              apiStats.teamEPAData.reduce(
                (sum, team) => sum + team.totalEPA,
                0,
              ) / apiStats.teamEPAData.length
            ).toFixed(3),
          )
        : 0,
    dataPoints: apiStats.totalMatches,
    availableMetrics: apiStats.availableMetrics || [],
    teamEPAData: apiStats.teamEPAData.map((team) => ({
      team: team.teamNumber.toString(),
      matchesPlayed: team.matchesPlayed,
      auto: parseFloat((team.autoEPA || 0).toFixed(3)),
      teleop: parseFloat((team.teleopEPA || 0).toFixed(3)),
      endgame: parseFloat((team.endgameEPA || 0).toFixed(3)),
      penalties: parseFloat((team.penaltiesEPA || 0).toFixed(3)),
      totalEPA: parseFloat(team.totalEPA.toFixed(3)),
      totalEPAStats: team.totalEPAStats
        ? {
            min: parseFloat(team.totalEPAStats.min.toFixed(3)),
            q1: parseFloat(team.totalEPAStats.q1.toFixed(3)),
            median: parseFloat(team.totalEPAStats.median.toFixed(3)),
            q3: parseFloat(team.totalEPAStats.q3.toFixed(3)),
            max: parseFloat(team.totalEPAStats.max.toFixed(3)),
          }
        : undefined,
      detailMetrics: team.detailMetrics || {},
    })),
  };
}

const EMPTY_STATS: AnalysisStats = {
  teamsAnalyzed: 0, highestEPA: 0, averageEPA: 0, dataPoints: 0,
  availableMetrics: [], teamEPAData: [],
};

export function useAnalysisStats() {
  const { data: session } = useSession();
  const selectedEvent = useSelectedEvent();
  const { currentYear, getCurrentYearConfig, competitionType } = useGameConfig();
  const eventCode = selectedEvent?.eventCode;
  const gameConfig = getCurrentYearConfig();
  const isGuest = !!session?.guestEvent;
  const { data, loading, error } = useAsyncData(
    eventCode && gameConfig
      ? JSON.stringify([eventCode, currentYear, competitionType, session?.user?.id, isGuest])
      : null,
    () => loadWithOfflineCache({
      isGuest,
      load: async () => transformToStats(await statsApi.getAnalysisData(
        currentYear, eventCode, competitionType, true,
      )),
      readCache: async () => {
        if (!eventCode) return null;
        const cached = await indexedDBService.getCachedAnalysisData({
          eventCode, year: currentYear, competitionType,
        });
        return cached ? transformToStats(cached.data) : null;
      },
      offlineMessage: "Offline - no cached analysis data available. Use the pre-cache feature in Settings while online.",
      errorMessage: "Failed to load analysis statistics",
    }),
  );
  return {
    stats: data?.data ?? EMPTY_STATS,
    loading,
    error: data?.error ?? (error ? "Failed to load analysis statistics" : null),
    isOfflineData: data?.isOfflineData ?? false,
  };
}
