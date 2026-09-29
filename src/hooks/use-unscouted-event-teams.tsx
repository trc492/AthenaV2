"use client";

import { useEffect } from "react";
import { useEventTeams } from "./use-event-teams";
import { useSelectedEvent } from "./use-event-config";
import { useGameConfig } from "./use-game-config";
import { useAsyncData } from "./use-async-data";
import { offlineQueueManager } from "@/lib/offline-queue-manager";

// Hook returns team numbers for the event that have NOT yet had a pit entry
export function useUnscoutedEventTeamNumbers(): {
  teamNumbers: number[];
  loading: boolean;
  refresh: () => void;
} {
  const { teams, loading: teamsLoading } = useEventTeams();
  const selectedEvent = useSelectedEvent();
  const selectedEventCode = selectedEvent?.eventCode;
  const { currentYear, competitionType } = useGameConfig();

  const allTeamNumbers = teams
    .map((t) => t.teamNumber)
    .filter((n) => !!n) as number[];

  const {
    data: teamNumbers,
    loading,
    reload: refresh,
  } = useAsyncData<number[]>(
    teamsLoading
      ? null
      : `${selectedEventCode ?? ""}|${currentYear}|${competitionType}|${allTeamNumbers.join(",")}`,
    async () => {
      try {
        // Build params for server fetch
        const params = new URLSearchParams();
        if (currentYear) params.append("year", String(currentYear));
        if (selectedEventCode) params.append("eventCode", selectedEventCode);
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
                  (!selectedEventCode || d.eventCode === selectedEventCode) &&
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
        return unscouted;
      } catch (error) {
        console.error("Failed to compute unscouted team numbers:", error);
        return allTeamNumbers;
      }
    },
  );

  // Refresh immediately when a pit entry is created locally
  useEffect(() => {
    window.addEventListener("pitEntryCreated", refresh);
    return () => window.removeEventListener("pitEntryCreated", refresh);
  }, [refresh]);

  return {
    teamNumbers: teamNumbers ?? [],
    loading: teamsLoading || loading,
    refresh,
  };
}
