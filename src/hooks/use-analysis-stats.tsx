"use client";
import { useSession } from "next-auth/react";

import { useState, useEffect } from "react";
import { useSelectedEvent } from "./use-event-config";
import { useGameConfig } from "./use-game-config";
import { statsApi } from "@/lib/api/database-client";
import { indexedDBService } from "@/lib/indexeddb-service";
import { AnalysisMetricDefinition } from "@/lib/types";

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

export function useAnalysisStats() {
  const { data: session } = useSession();
  const isGuest = !!session?.guestEvent;
  const selectedEvent = useSelectedEvent();
  const { currentYear, getCurrentYearConfig, competitionType } =
    useGameConfig();
  const gameConfig = getCurrentYearConfig();
  const [stats, setStats] = useState<AnalysisStats>({
    teamsAnalyzed: 0,
    highestEPA: 0,
    averageEPA: 0,
    dataPoints: 0,
    availableMetrics: [],
    teamEPAData: [],
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isOfflineData, setIsOfflineData] = useState(false);

  useEffect(() => {
    async function fetchAnalysisStats() {
      if (!selectedEvent || !gameConfig) {
        setLoading(false);
        return;
      }

      try {
        setLoading(true);
        setError(null);
        setIsOfflineData(false);

        const isOnline =
          typeof navigator !== "undefined" ? navigator.onLine : true;
        if (isGuest && !isOnline) throw new Error("Guest access requires an internet connection");

        // If offline, go straight to IndexedDB
        if (!isOnline) {
          const cached = await indexedDBService.getCachedAnalysisData(
            selectedEvent.eventCode,
          );
          if (cached) {
            setStats(transformToStats(cached.data));
            setIsOfflineData(true);
            return;
          }
          setError(
            "Offline — no cached analysis data available. Use the pre-cache feature in Settings while online.",
          );
          return;
        }

        // Fetch analysis data from API
        const apiStats = await statsApi.getAnalysisData(
          currentYear,
          selectedEvent.eventCode,
          competitionType,
          true,
        );
        setStats(transformToStats(apiStats));
      } catch (err) {
        console.error("Error fetching analysis stats:", err);

        // Fallback to IndexedDB cache on network error
        if (selectedEvent?.eventCode && !isGuest) {
          try {
            const cached = await indexedDBService.getCachedAnalysisData(
              selectedEvent.eventCode,
            );
            if (cached) {
              setStats(transformToStats(cached.data));
              setIsOfflineData(true);
              return;
            }
          } catch (cacheErr) {
            console.warn("Failed to read cached analysis data:", cacheErr);
          }
        }

        setError("Failed to load analysis statistics");
      } finally {
        setLoading(false);
      }
    }

    fetchAnalysisStats();
  }, [selectedEvent, currentYear, gameConfig, competitionType, isGuest]);

  return { stats, loading, error, isOfflineData };
}
