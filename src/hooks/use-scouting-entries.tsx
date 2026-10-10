"use client";

import { requestJSON } from "@/lib/fetcher";
import { indexedDBService } from "@/lib/indexeddb-service";
import { loadWithOfflineCache } from "@/lib/offline-data";
import type { MatchEntry, PitEntry } from "@/lib/types";
import { useSession } from "next-auth/react";
import { useAsyncData } from "./use-async-data";
import { useEventConfig } from "./use-event-config";
import { useGameConfig } from "./use-game-config";

import type { EventScope } from "@/lib/offline-types";

interface EntryTypes {
  match: MatchEntry;
  pit: PitEntry;
}

function readCachedEntries<K extends keyof EntryTypes>(
  kind: K,
  scope: EventScope,
): Promise<{ entries: EntryTypes[K][] } | null | undefined> {
  return (
    kind === "match"
      ? indexedDBService.getCachedMatchEntries(scope)
      : indexedDBService.getCachedPitEntries(scope)
  ) as Promise<{ entries: EntryTypes[K][] } | null | undefined>;
}

/**
 * Loads the match or pit entries for the selected event: tries the API
 * first and falls back to the IndexedDB cache when offline.
 */
export function useScoutingEntries<K extends keyof EntryTypes>(kind: K) {
  const { data: session } = useSession();
  const isGuest = !!session?.guestEvent;
  const { competitionType, currentYear } = useGameConfig();
  const { selectedEvent } = useEventConfig();
  const eventCode = selectedEvent?.eventCode;

  const { data, loading, reload, error } = useAsyncData(
    JSON.stringify([kind, eventCode, competitionType, currentYear, session?.user?.id, isGuest]),
    () => loadWithOfflineCache({
      isGuest,
      load: () => {
        const params = new URLSearchParams({ competitionType, year: String(currentYear) });
        if (eventCode) params.set("eventCode", eventCode);
        return requestJSON<EntryTypes[K][]>(`/api/scouting/entries/${kind}?${params}`);
      },
      readCache: async () => {
        if (!eventCode) return null;
        const cached = await readCachedEntries(kind, { eventCode, competitionType, year: currentYear });
        return cached?.entries ?? null;
      },
      offlineMessage: `Offline - no cached ${kind} scouting data available. Use the pre-cache feature in Settings while online.`,
      errorMessage: `Failed to load ${kind} scouting data`,
    }),
  );
  return {
    entries: data?.data ?? [],
    loading,
    error: data?.error ?? (error ? `Failed to load ${kind} scouting data` : null),
    isOfflineData: data?.isOfflineData ?? false,
    refetch: reload,
  };
}
