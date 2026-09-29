"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { useSelectedEvent } from "./use-event-config";
import { useGameConfig } from "./use-game-config";

interface MatchScheduleTeam {
  teamNumber: number;
  alliance: "red" | "blue";
  position: number;
}

interface MatchScheduleEntry {
  matchNumber: number;
  compLevel: string;
  teams: MatchScheduleTeam[];
  startTime?: string | null;
}

interface MatchScheduleData {
  matches: MatchScheduleEntry[];
  competitionType: "FRC" | "FTC";
}

export function useMatchScheduleTeams() {
  const selectedEvent = useSelectedEvent();
  const selectedEventCode = selectedEvent?.eventCode;
  const { currentYear, competitionType } = useGameConfig();

  const [scheduleData, setScheduleData] = useState<MatchScheduleData | null>(
    null,
  );
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Fetch the match schedule
  useEffect(() => {
    const fetchSchedule = async () => {
      if (!selectedEvent?.eventCode) {
        setScheduleData(null);
        return;
      }

      setIsLoading(true);
      setError(null);

      try {
        const response = await fetch(
          `/api/events/${selectedEvent.eventCode}/schedule?competitionType=${competitionType}&season=${currentYear}`,
        );

        if (!response.ok) {
          throw new Error("Failed to fetch match schedule");
        }

        const data: MatchScheduleData = await response.json();
        setScheduleData(data);
      } catch (err) {
        console.error("Error fetching match schedule:", err);
        setError(
          err instanceof Error ? err.message : "Failed to load schedule",
        );
        setScheduleData(null);
      } finally {
        setIsLoading(false);
      }
    };

    fetchSchedule();
  }, [selectedEvent?.eventCode, currentYear, competitionType]);

  // Get team number for a specific match, alliance, and position
  const getTeamForPosition = useCallback(
    (
      matchNumber: number,
      alliance: "red" | "blue",
      position: number,
    ): number | null => {
      if (!scheduleData?.matches) return null;

      const match = scheduleData.matches.find(
        (m) => m.matchNumber === matchNumber,
      );
      if (!match) return null;

      const team = match.teams.find(
        (t) => t.alliance === alliance && t.position === position,
      );

      return team?.teamNumber ?? null;
    },
    [scheduleData],
  );

  // Get all teams for a specific match
  const getTeamsForMatch = useCallback(
    (matchNumber: number): MatchScheduleTeam[] => {
      if (!scheduleData?.matches) return [];

      const match = scheduleData.matches.find(
        (m) => m.matchNumber === matchNumber,
      );
      return match?.teams ?? [];
    },
    [scheduleData],
  );

  // Check if schedule data is available
  const hasScheduleData = useMemo(() => {
    return scheduleData?.matches && scheduleData.matches.length > 0;
  }, [scheduleData]);

  // Get the maximum match number in the schedule
  const maxMatchNumber = useMemo(() => {
    if (!scheduleData?.matches || scheduleData.matches.length === 0) return 0;
    return Math.max(...scheduleData.matches.map((m) => m.matchNumber));
  }, [scheduleData]);

  // Force refresh schedule
  const refreshSchedule = useCallback(async () => {
    if (!selectedEventCode) return;

    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch(
        `/api/events/${selectedEventCode}/schedule?competitionType=${competitionType}&season=${currentYear}`,
      );

      if (!response.ok) {
        throw new Error("Failed to fetch match schedule");
      }

      const data: MatchScheduleData = await response.json();
      setScheduleData(data);
    } catch (err) {
      console.error("Error fetching match schedule:", err);
      setError(err instanceof Error ? err.message : "Failed to load schedule");
    } finally {
      setIsLoading(false);
    }
  }, [selectedEventCode, currentYear, competitionType]);

  return {
    scheduleData,
    isLoading,
    error,
    hasScheduleData,
    maxMatchNumber,
    getTeamForPosition,
    getTeamsForMatch,
    refreshSchedule,
  };
}
