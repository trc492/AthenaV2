"use client";

import { useState, useEffect, useCallback } from "react";
import { useSelectedEvent } from "./use-event-config";
import { useGameConfig } from "./use-game-config";

const usersCache = new Map<string, UserWithPartners[]>();
const matchCountCache = new Map<string, number>();
const assignmentsCache = new Map<string, MatchAssignmentRow[]>();

const getAssignmentsCacheKey = (
  eventCode: string,
  year: number,
  competitionType: string,
) => `${competitionType}-${eventCode}-${year}`;
const getMatchCountCacheKey = (
  eventCode: string,
  year: number,
  competitionType: string,
) => `${eventCode}-${year}-${competitionType}`;

type ScheduleBlock = {
  id: number;
  eventCode: string;
  year: number;
  blockNumber: number;
  startMatch: number;
  endMatch: number;
  created_at?: Date;
  updated_at?: Date;
  redScouts: Array<string | null>;
  blueScouts: Array<string | null>;
};

interface User {
  id: string;
  name: string;
  username: string;
  role: string;
  createdAt?: Date;
  updatedAt?: Date;
}

interface UserWithPartners extends User {
  preferredPartners: string[];
}

type MatchAssignmentRow = {
  matchNumber: number;
  alliance: "red" | "blue";
  position: number;
  userId: string;
};

type ScheduleAssignmentChange = {
  startMatch: number;
  endMatch: number;
  alliance: "red" | "blue";
  position: number;
  userId: string | null;
};

export function useScheduleData() {
  const selectedEvent = useSelectedEvent();
  const { currentYear, competitionType } = useGameConfig();
  const scheduleScopeKey = selectedEvent
    ? `${competitionType}-${selectedEvent.eventCode}-${currentYear}`
    : "none";

  // Core state
  const [users, setUsers] = useState<UserWithPartners[]>([]);
  const [blocks, setBlocks] = useState<ScheduleBlock[]>([]);
  const [matchAssignments, setMatchAssignments] = useState<
    MatchAssignmentRow[]
  >([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refreshTrigger, setRefreshTrigger] = useState(0);

  // Configuration state
  const [blockSize, setBlockSize] = useState<number>(5);
  const [matchCount, setMatchCount] = useState<number>(0);
  const [apiMatchCount, setApiMatchCount] = useState<number>(0);
  const [isApiMatchCountAvailable, setIsApiMatchCountAvailable] =
    useState(false);

  const announceScheduleUpdate = useCallback(() => {
    if (!selectedEvent) return;
    assignmentsCache.delete(
      getAssignmentsCacheKey(selectedEvent.eventCode, currentYear, competitionType),
    );
    window.dispatchEvent(
      new CustomEvent("schedule-updated", {
        detail: {
          eventCode: selectedEvent.eventCode,
          year: currentYear,
          competitionType,
        },
      }),
    );
    localStorage.setItem(`schedule-updated:${scheduleScopeKey}`, String(Date.now()));
  }, [selectedEvent, currentYear, competitionType, scheduleScopeKey]);

  const buildComputedBlocks = useCallback(
    (matchCountValue: number, blockSizeValue: number) => {
      const scoutsPerAlliance = competitionType === "FTC" ? 2 : 3;
      return Array.from(
        { length: Math.ceil(matchCountValue / blockSizeValue) },
        (_, i) => {
          const startMatch = i * blockSizeValue + 1;
          const endMatch = Math.min(
            startMatch + blockSizeValue - 1,
            matchCountValue,
          );
          return {
            id: i + 1,
            eventCode: selectedEvent?.eventCode || "",
            year: currentYear,
            blockNumber: i + 1,
            startMatch,
            endMatch,
            created_at: undefined,
            updated_at: undefined,
            redScouts: Array(scoutsPerAlliance).fill(null),
            blueScouts: Array(scoutsPerAlliance).fill(null),
          };
        },
      );
    },
    [competitionType, currentYear, selectedEvent?.eventCode],
  );

  const hydrateBlocksFromRows = useCallback(
    (computedBlocks: ScheduleBlock[], rows: MatchAssignmentRow[]) => {
      const byMatch = new Map<
        number,
        Map<"red" | "blue", Map<number, string>>
      >();
      for (const r of rows) {
        let byAlliance = byMatch.get(r.matchNumber);
        if (!byAlliance) {
          byAlliance = new Map();
          byMatch.set(r.matchNumber, byAlliance);
        }
        let byPos = byAlliance.get(r.alliance);
        if (!byPos) {
          byPos = new Map();
          byAlliance.set(r.alliance, byPos);
        }
        byPos.set(r.position, r.userId);
      }

      return computedBlocks.map((block) => {
        const getConsistent = (
          alliance: "red" | "blue",
          position: number,
        ): string | null => {
          let value: string | null = null;
          for (
            let matchNumber = block.startMatch;
            matchNumber <= block.endMatch;
            matchNumber++
          ) {
            const v =
              byMatch.get(matchNumber)?.get(alliance)?.get(position) ?? null;
            if (matchNumber === block.startMatch) value = v;
            else if (value !== v) return null;
          }
          return value;
        };

        const redScouts = [...block.redScouts];
        const blueScouts = [...block.blueScouts];
        for (let pos = 0; pos < redScouts.length; pos++) {
          redScouts[pos] = getConsistent("red", pos);
          blueScouts[pos] = getConsistent("blue", pos);
        }

        return { ...block, redScouts, blueScouts };
      });
    },
    [],
  );

  // Reset event-specific state when event changes
  useEffect(() => {
    setBlocks([]);
    setMatchAssignments([]);
    setMatchCount(0);
    setApiMatchCount(0);
    setIsApiMatchCountAvailable(false);
  }, [selectedEvent?.eventCode, currentYear, competitionType]);

  // Fetch users
  useEffect(() => {
    const fetchUsers = async () => {
      try {
        const cachedUsers = usersCache.get("users");
        if (cachedUsers) {
          setUsers(cachedUsers);
        }

        const usersResponse = await fetch("/api/users", { cache: "no-store" });
        if (!usersResponse.ok) {
          throw new Error("Failed to fetch users");
        }
        const usersData = await usersResponse.json();

        const usersWithPartners: UserWithPartners[] = usersData.users.map(
          (user: User & { preferredPartners?: string[] }) => ({
            ...user,
            preferredPartners: user.preferredPartners || [],
          }),
        );
        usersCache.set("users", usersWithPartners);
        setUsers(usersWithPartners);
      } catch (err) {
        console.error("Error fetching users:", err);
        setError(err instanceof Error ? err.message : "Failed to fetch users");
      }
    };

    fetchUsers();
  }, []);

  // Fetch match count from API
  useEffect(() => {
    const controller = new AbortController();
    const fetchMatchCount = async () => {
      if (!selectedEvent) {
        setApiMatchCount(0);
        setIsApiMatchCountAvailable(false);
        return;
      }

      try {
        const cacheKey = getMatchCountCacheKey(
          selectedEvent.eventCode,
          currentYear,
          competitionType,
        );
        const cachedCount = matchCountCache.get(cacheKey);
        if (cachedCount && cachedCount > 0) {
          setApiMatchCount(cachedCount);
          setIsApiMatchCountAvailable(true);
          setMatchCount((prev) => (prev === 0 ? cachedCount : prev));
          return;
        }

        const matchesResponse = await fetch(
          `/api/events/${encodeURIComponent(selectedEvent.eventCode)}/matches?competitionType=${competitionType}&season=${currentYear}`,
          { signal: controller.signal, cache: "no-cache" },
        );

        if (matchesResponse.ok) {
          const matchesData = await matchesResponse.json();
          const count =
            matchesData.qualMatchesCount || matchesData.totalMatches || 0;
          if (count > 0) {
            matchCountCache.set(cacheKey, count);
            setApiMatchCount(count);
            setIsApiMatchCountAvailable(true);
            setMatchCount((prev) => (prev === 0 ? count : prev));
            return;
          }
        }

        // A custom event may produce a successful but empty upstream response.
        {
          const customResponse = await fetch(
            `/api/events/custom-events?year=${currentYear}&competitionType=${competitionType}`,
            { signal: controller.signal, cache: "no-store" },
          );
          if (customResponse.ok) {
            const customEvents = await customResponse.json();
            const customEvent = customEvents.find(
              (e: { eventCode: string }) => e.eventCode === selectedEvent.eventCode,
            );
            const count = customEvent?.matchCount || 0;
            matchCountCache.set(cacheKey, count);
            setApiMatchCount(count);
            setIsApiMatchCountAvailable(count > 0);
            if (count > 0) setMatchCount((prev) => (prev === 0 ? count : prev));
          }
        }
      } catch (error) {
        if (controller.signal.aborted) return;
        console.error("Error fetching match count:", error);
        setIsApiMatchCountAvailable(false);
      }
    };

    fetchMatchCount();
    return () => controller.abort();
  }, [selectedEvent, currentYear, competitionType]);

  // Fetch virtual blocks for event
  useEffect(() => {
    const controller = new AbortController();
    const hydrateBlocks = async () => {
      if (!selectedEvent || matchCount <= 0 || blockSize <= 0) {
        setBlocks([]);
        setMatchAssignments([]);
        setIsLoading(false);
        return;
      }

      try {
        setIsLoading(true);
        setError(null);

        const computedBlocks = buildComputedBlocks(matchCount, blockSize);
        const assignmentCacheKey = getAssignmentsCacheKey(
          selectedEvent.eventCode,
          currentYear,
          competitionType,
        );
        const cachedRows = assignmentsCache.get(assignmentCacheKey);

        if (cachedRows) {
          setMatchAssignments(cachedRows);
          setBlocks(hydrateBlocksFromRows(computedBlocks, cachedRows));
          setIsLoading(false);
        }

        // Hydrate from matchAssignments by collapsing match-level assignments to shift-level,
        // only when consistent across the whole shift range.
        const res = await fetch(
          `/api/scouting/entries/match-assignments?eventCode=${encodeURIComponent(selectedEvent.eventCode)}&year=${currentYear}&competitionType=${competitionType}`,
          { signal: controller.signal, cache: "no-cache" },
        );

        if (!res.ok) {
          throw new Error(`Failed to load schedule (${res.status})`);
        }

        const rows = (await res.json()) as MatchAssignmentRow[];
        assignmentsCache.set(assignmentCacheKey, rows);
        setMatchAssignments(rows);

        setBlocks(hydrateBlocksFromRows(computedBlocks, rows));
      } catch (err) {
        if (controller.signal.aborted) return;
        console.error("Error hydrating schedule:", err);
        setError(err instanceof Error ? err.message : "Failed to load data");
        setBlocks([]);
        setMatchAssignments([]);
      } finally {
        setIsLoading(false);
      }
    };

    hydrateBlocks();
    return () => controller.abort();
  }, [
    selectedEvent,
    currentYear,
    competitionType,
    scheduleScopeKey,
    matchCount,
    blockSize,
    refreshTrigger,
    buildComputedBlocks,
    hydrateBlocksFromRows,
  ]);

  // Generate blocks based on match count and block size
  // Blocks are virtual now; this just triggers a refresh.
  const generateBlocks = useCallback(async () => {
    if (!selectedEvent || matchCount <= 0 || blockSize <= 0) return;
    setRefreshTrigger((prev) => prev + 1);
  }, [selectedEvent, matchCount, blockSize]);

  // Sync match count from API
  const syncMatchCountFromApi = useCallback(async () => {
    if (!selectedEvent) return { success: false, count: 0 };

    try {
      const matchesResponse = await fetch(
        `/api/events/${encodeURIComponent(selectedEvent.eventCode)}/matches?competitionType=${competitionType}&season=${currentYear}`,
        { cache: "no-store" },
      );

      if (matchesResponse.ok) {
        const matchesData = await matchesResponse.json();
        const count =
          matchesData.qualMatchesCount || matchesData.totalMatches || 0;
        if (count > 0) {
          matchCountCache.set(
            getMatchCountCacheKey(
              selectedEvent.eventCode,
              currentYear,
              competitionType,
            ),
            count,
          );
          setApiMatchCount(count);
          setIsApiMatchCountAvailable(true);
          setMatchCount(count);
          return { success: true, count };
        }
      }
      const customResponse = await fetch(
        `/api/events/custom-events?year=${currentYear}&competitionType=${competitionType}`,
        { cache: "no-store" },
      );
      if (customResponse.ok) {
        const customEvents = await customResponse.json();
        const customEvent = customEvents.find(
          (event: { eventCode: string }) =>
            event.eventCode === selectedEvent.eventCode,
        );
        const count = customEvent?.matchCount || 0;
        if (count > 0) {
          const cacheKey = getMatchCountCacheKey(
            selectedEvent.eventCode,
            currentYear,
            competitionType,
          );
          matchCountCache.set(cacheKey, count);
          setApiMatchCount(count);
          setIsApiMatchCountAvailable(true);
          setMatchCount(count);
          return { success: true, count };
        }
      }
      return { success: false, count: 0 };
    } catch (error) {
      console.error("Error syncing match count from API:", error);
      return { success: false, count: 0 };
    }
  }, [selectedEvent, competitionType, currentYear]);

  // Set manual match count
  const setManualMatchCount = useCallback((count: number) => {
    setMatchCount(count);
  }, []);

  // Assign scout to a virtual block position (range write)
  const assignScout = useCallback(
    async (
      blockId: number,
      userId: string | null,
      alliance: "red" | "blue",
      position: number,
    ) => {
      if (!selectedEvent) return;

      const block = blocks.find((b) => b.id === blockId);
      if (!block) return;

      const response = await fetch("/api/scouting/schedule/assignments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          eventCode: selectedEvent.eventCode,
          year: currentYear,
          competitionType,
          startMatch: block.startMatch,
          endMatch: block.endMatch,
          alliance,
          position,
          userId,
        }),
      });

      if (!response.ok) {
        throw new Error("Failed to save assignment");
      }
      announceScheduleUpdate();
    },
    [selectedEvent, currentYear, competitionType, blocks, announceScheduleUpdate],
  );

  // Assign scout to a single match/slot
  const assignMatchScout = useCallback(
    async (
      matchNumber: number,
      userId: string | null,
      alliance: "red" | "blue",
      position: number,
    ) => {
      if (!selectedEvent) return;

      const response = await fetch("/api/scouting/schedule/assignments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          eventCode: selectedEvent.eventCode,
          year: currentYear,
          competitionType,
          startMatch: matchNumber,
          endMatch: matchNumber,
          alliance,
          position,
          userId,
        }),
      });

      if (!response.ok) {
        throw new Error("Failed to save assignment");
      }
      announceScheduleUpdate();
    },
    [selectedEvent, currentYear, competitionType, announceScheduleUpdate],
  );

  // Assign scout to a match range/slot in a single request
  const assignScoutRange = useCallback(
    async (
      startMatch: number,
      endMatch: number,
      userId: string | null,
      alliance: "red" | "blue",
      position: number,
    ) => {
      if (!selectedEvent) return;

      const response = await fetch("/api/scouting/schedule/assignments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          eventCode: selectedEvent.eventCode,
          year: currentYear,
          competitionType,
          startMatch,
          endMatch,
          alliance,
          position,
          userId,
        }),
      });

      if (!response.ok) {
        throw new Error("Failed to save assignment range");
      }
      announceScheduleUpdate();
    },
    [selectedEvent, currentYear, competitionType, announceScheduleUpdate],
  );

  const replaceAllAssignments = useCallback(
    async (changes: ScheduleAssignmentChange[]) => {
      if (!selectedEvent) return;
      const response = await fetch("/api/scouting/schedule/assignments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          eventCode: selectedEvent.eventCode,
          year: currentYear,
          competitionType,
          changes,
          replaceAll: true,
          expectedAssignments: matchAssignments,
        }),
      });
      if (!response.ok) {
        const body = await response.json().catch(() => null);
        throw new Error(body?.error || "Failed to save schedule");
      }
      announceScheduleUpdate();
    },
    [
      selectedEvent,
      currentYear,
      competitionType,
      announceScheduleUpdate,
      matchAssignments,
    ],
  );

  // Clear all assignments for the event
  const clearAllAssignments = useCallback(async () => {
    if (!selectedEvent) return;

    const response = await fetch(
      `/api/scouting/schedule/assignments?eventCode=${encodeURIComponent(selectedEvent.eventCode)}&year=${currentYear}&competitionType=${competitionType}`,
      {
        method: "DELETE",
      },
    );

    if (!response.ok) {
      throw new Error("Failed to clear assignments");
    }

    announceScheduleUpdate();
    setRefreshTrigger((prev) => prev + 1);
  }, [selectedEvent, currentYear, competitionType, announceScheduleUpdate]);

  // Delete all blocks (virtual) => clear all schedule data
  const deleteAllBlocks = useCallback(async () => {
    // Clearing schedule == clearing all matchAssignments for this event
    await clearAllAssignments();
  }, [clearAllAssignments]);

  // Add/delete single block are no longer supported; keep them as helpers that refresh.
  const addBlock = useCallback(async () => {
    setRefreshTrigger((prev) => prev + 1);
  }, []);

  const deleteBlock = useCallback(async () => {
    setRefreshTrigger((prev) => prev + 1);
  }, []);

  // Refresh data manually
  const refreshData = useCallback(() => {
    setRefreshTrigger((prev) => prev + 1);
  }, []);

  return {
    // Data
    users,
    blocks,
    matchAssignments,

    // Configuration
    blockSize,
    setBlockSize,
    matchCount,
    setManualMatchCount,
    apiMatchCount,
    isApiMatchCountAvailable,
    competitionType,
    scheduleScopeKey,

    // State
    isLoading,
    error,
    hasEvent: !!selectedEvent,

    // Actions
    generateBlocks,
    syncMatchCountFromApi,
    assignScout,
    assignMatchScout,
    assignScoutRange,
    replaceAllAssignments,
    clearAllAssignments,
    deleteAllBlocks,
    addBlock,
    deleteBlock,
    refreshData,
  };
}
