"use client";

import { toast } from "sonner";
import { useAsyncData } from "./use-async-data";
import { useEventConfig } from "./use-event-config";
import { useGameConfig } from "./use-game-config";
import { indexedDBService } from "@/lib/indexeddb-service";
import type { MatchEntry, PitEntry } from "@/lib/types";
import { useSession } from "next-auth/react";

interface EntryTypes {
  match: MatchEntry;
  pit: PitEntry;
}

interface EntriesResult<T> {
  entries: T[];
  error: string | null;
  isOfflineData: boolean;
}

function readCachedEntries<K extends keyof EntryTypes>(
  kind: K,
  eventCode: string,
): Promise<{ entries: EntryTypes[K][] } | null | undefined> {
  return (
    kind === "match"
      ? indexedDBService.getCachedMatchEntries(eventCode)
      : indexedDBService.getCachedPitEntries(eventCode)
  ) as Promise<{ entries: EntryTypes[K][] } | null | undefined>;
}

/**
 * Loads the match or pit entries for the selected event: tries the API
 * first and falls back to the IndexedDB cache when offline.
 */
export function useScoutingEntries<K extends keyof EntryTypes>(kind: K) {
  const { data: session } = useSession();
  const isGuest = !!session?.guestEvent;
  const { competitionType } = useGameConfig();
  const { selectedEvent } = useEventConfig();
  const eventCode = selectedEvent?.eventCode;

  const { data, loading, reload } = useAsyncData<EntriesResult<EntryTypes[K]>>(
    `${kind}|${eventCode ?? ""}|${competitionType}|${session?.user?.id ?? ""}`,
    async () => {
      const isOnline =
        typeof navigator !== "undefined" ? navigator.onLine : true;
      if (isGuest && !isOnline) return { entries: [], error: "Guest access requires an internet connection", isOfflineData: false };

      // If offline, go straight to IndexedDB
      if (!isOnline && eventCode) {
        const cached = await readCachedEntries(kind, eventCode);
        if (cached && cached.entries.length > 0) {
          return { entries: cached.entries, error: null, isOfflineData: true };
        }
        return {
          entries: [],
          error: `Offline — no cached ${kind} scouting data available. Use the pre-cache feature in Settings while online.`,
          isOfflineData: false,
        };
      }

      try {
        const params = new URLSearchParams();
        if (eventCode) params.append("eventCode", eventCode);
        params.append("competitionType", competitionType);

        const response = await fetch(
          `/api/scouting/entries/${kind}?${params.toString()}`,
        );
        if (!response.ok) {
          throw new Error(
            `Failed to fetch ${kind} entries: ${response.statusText}`,
          );
        }

        const entries: EntryTypes[K][] = await response.json();
        return { entries, error: null, isOfflineData: false };
      } catch (err) {
        console.error(`Error fetching ${kind} entries:`, err);

        // Fallback to IndexedDB cache on network error
        if (eventCode && !isGuest) {
          try {
            const cached = await readCachedEntries(kind, eventCode);
            if (cached && cached.entries.length > 0) {
              toast.info(`Showing cached ${kind} scouting data (offline)`);
              return {
                entries: cached.entries,
                error: null,
                isOfflineData: true,
              };
            }
          } catch (cacheErr) {
            console.warn(`Failed to read cached ${kind} entries:`, cacheErr);
          }
        }

        return {
          entries: [],
          error: `Failed to load ${kind} scouting data`,
          isOfflineData: false,
        };
      }
    },
  );

  return {
    entries: data?.entries ?? [],
    loading,
    error: data?.error ?? null,
    isOfflineData: data?.isOfflineData ?? false,
    refetch: reload,
  };
}
