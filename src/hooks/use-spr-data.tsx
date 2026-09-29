"use client";

import { useSelectedEvent } from "./use-event-config";
import { useGameConfig } from "./use-game-config";
import { useAsyncData } from "./use-async-data";

export interface ScouterSPR {
  scouterId: string;
  scouterName: string | null;
  errorValue: number;
  matchesScounted: number;
  percentile: number;
  totalAbsoluteError: number;
}

export interface SPRVerboseEquation {
  matchNumber: number;
  alliance: "red" | "blue";
  scouterIds: string[];
  scouterNames?: string[];
  robotCount: number;
  expectedRobots: number;
  scoutedTotal: number;
  officialScore: number;
  foulPoints: number;
  adjustedOfficial: number;
  error: number;
  skipped: boolean;
  skipReason?: string;
}

export interface SPRVerboseData {
  equations: SPRVerboseEquation[];
  totalEquations: number;
  skippedEquations: number;
  usedEquations: number;
}

export interface SPRData {
  scouters: ScouterSPR[];
  overallMeanError: number;
  convergenceAchieved: boolean;
  message?: string;
  verboseData?: SPRVerboseData;
  metadata: {
    totalMatches: number;
    uniqueScouters: number;
    officialResultsCount: number;
    eventCode: string;
    year: number;
    competitionType: string;
  };
}

export function useSPRData(options?: { verbose?: boolean }) {
  const verbose = options?.verbose ?? false;
  const selectedEvent = useSelectedEvent();
  const { currentYear, competitionType } = useGameConfig();
  const eventCode = selectedEvent?.eventCode;

  const { data, loading, error, reload } = useAsyncData<SPRData>(
    eventCode && currentYear
      ? `${eventCode}|${currentYear}|${competitionType}|${verbose}`
      : null,
    async () => {
      const params = new URLSearchParams({
        year: currentYear.toString(),
        eventCode: eventCode!,
        competitionType: competitionType,
        verbose: verbose ? "true" : "false",
      });

      const response = await fetch(`/api/scouting/analysis/spr?${params}`);

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(
          errorData.error || `Failed to fetch SPR data (${response.status})`,
        );
      }

      const json = await response.json();

      if (!json.success) {
        throw new Error(
          json.data?.message || "SPR calculation did not converge",
        );
      }

      return json.data as SPRData;
    },
  );

  return {
    data: error ? null : (data ?? null),
    loading,
    error: error
      ? error instanceof Error
        ? error.message
        : "Unknown error"
      : null,
    refetch: reload,
  };
}
