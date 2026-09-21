"use client";

import { useEffect, useState, useCallback } from "react";
import { useEventTeams } from "./use-event-teams";
import { useSelectedEvent } from "./use-event-config";
import { useGameConfig } from "./use-game-config";
import { offlineQueueManager } from "@/lib/offline-queue-manager";

// Hook returns team numbers for the event that have NOT yet had a pit entry
export function useUnscoutedEventTeamNumbers(): {
  teamNumbers: number[];
  loading: boolean;
  refresh: () => Promise<void>;
} {
  const { teams, loading: teamsLoading } = useEventTeams();
  const selectedEvent = useSelectedEvent();
  const { currentYear, competitionType } = useGameConfig();

  const [teamNumbers, setTeamNumbers] = useState<number[]>([]);
  const [loading, setLoading] = useState<boolean>(true);

  const refresh = useCallback(async () => {
    setLoading(true);

    try {
      const allTeamNumbers = teams
        .map((t) => t.teamNumber)
        .filter((n) => !!n) as number[];

      // Build params for server fetch
      const params = new URLSearchParams();
      if (currentYear) params.append("year", String(currentYear));
      if (selectedEvent?.eventCode) params.append("eventCode", selectedEvent.eventCode);
      if (competitionType) params.append("competitionType", competitionType);

      // Fetch pit entries for this event/year from server
      const resp = await fetch(`/api/scouting/entries/pit?${params.toString()}`);
      let serverEntries: Array<{ teamNumber: number }>;
      if (resp.ok) {
        serverEntries = await resp.json();
      } else {
        serverEntries = [];
      }

      const submittedSet = new Set<number>();
      serverEntries.forEach((e) => {
        if (e && typeof e.teamNumber === "number")
          submittedSet.add(e.teamNumber);
      });

      // Include queued (offline) pit entries
      if (typeof window !== "undefined") {
        try {
          const queued = await offlineQueueManager.getAllQueuedEntries();
          queued.forEach((q) => {
            const d = q.data;
            const teamNumber = d?.teamNumber;
            if (q.type === "pit" && typeof teamNumber === "number") {
              // Match by year/eventCode/competitionType when available
              if (
                (currentYear == null || d.year === currentYear) &&
                (!selectedEvent?.eventCode || d.eventCode === selectedEvent.eventCode) &&
                (!competitionType || d.competitionType === competitionType)
              ) {
                submittedSet.add(teamNumber);
              }
            }
          });
        } catch (err) {
          // ignore indexeddb errors and continue
          console.warn(
            "Failed to read queued entries for unscouted teams:",
            err,
          );
        }
      }

      const unscouted = allTeamNumbers
        .filter((n) => !submittedSet.has(n))
        .sort((a, b) => a - b);
      setTeamNumbers(unscouted);
    } catch (error) {
      console.error("Failed to compute unscouted team numbers:", error);
      setTeamNumbers(teams.map((t) => t.teamNumber));
    } finally {
      setLoading(false);
    }
  }, [teams, selectedEvent?.eventCode, currentYear, competitionType]);

  useEffect(() => {
    // initial load
    refresh();

    // Listen for local events that indicate a pit entry was created so we can refresh immediately
    const handler = async (e: Event) => {
      // payload may include teamNumber, but we just refresh
      await refresh();
    };

    window.addEventListener("pitEntryCreated", handler as EventListener);
    return () => {
      window.removeEventListener("pitEntryCreated", handler as EventListener);
    };
  }, [refresh]);

  // Also keep loading true while upstream teams are loading
  useEffect(() => {
    if (teamsLoading) setLoading(true);
  }, [teamsLoading]);

  return { teamNumbers, loading, refresh };
}
