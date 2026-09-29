"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  ReactNode,
} from "react";
import type { Event } from "@/lib/types";
import { useGameConfig } from "@/hooks/use-game-config";
import { TbaEvent } from "@/lib/api/tba-types";
import { FtcEvent } from "@/lib/api/ftcevents-types";
import type { CustomEvent } from "@/lib/types";
import { indexedDBService } from "@/lib/indexeddb-service";
import { useSession } from "next-auth/react";

interface EventContextType {
  events: Event[];
  selectedEvent: Event | null;
  setSelectedEvent: (event: Event) => void;
  setEvents: (events: Event[]) => void;
  isLoading: boolean;
  error: string | null;
  isOfflineData: boolean;
}

const EventContext = createContext<EventContextType | undefined>(undefined);

export function EventProvider({ children }: { children: ReactNode }) {
  const { status } = useSession();
  const { currentYear, competitionType, isInitialized } = useGameConfig();
  const [events, setEvents] = useState<Event[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isOfflineData, setIsOfflineData] = useState(false);

  const scopeKey = `${competitionType}:${currentYear}`;
  const [selection, setSelection] = useState<{
    scopeKey: string;
    event: Event | null;
  } | null>(null);
  const selectedEvent = selection?.scopeKey === scopeKey ? selection.event : null;

  const selectFromEvents = useCallback((nextEvents: Event[]) => {
    const savedEvent = localStorage.getItem("selectedEvent");
    let savedCode: string | undefined;
    if (savedEvent) {
      try {
        savedCode = JSON.parse(savedEvent).eventCode;
      } catch (error) {
        console.error("Error parsing saved event:", error);
      }
    }
    setEvents(nextEvents);
    setSelection({
      scopeKey,
      event: nextEvents.find((event) => event.eventCode === savedCode) ?? nextEvents[0] ?? null,
    });
  }, [scopeKey]);

  // Fetch events from TBA API and custom events
  useEffect(() => {
    if (status === "loading") return;

    if (status !== "authenticated") return;

    // Don't fetch until game config is initialized
    if (!isInitialized) return;

    let cancelled = false;
    const fetchEvents = async () => {
      const isOnline =
        typeof navigator !== "undefined" ? navigator.onLine : true;
      const teamNumber = competitionType === "FRC" ? 492 : 3543;

      // If offline, try to get cached data first
      if (!isOnline) {
        try {
          const cachedData = await indexedDBService.getCachedEventList(
            teamNumber,
            competitionType,
            currentYear,
          );
          if (cancelled) return;
          if (cachedData && cachedData.events.length > 0) {
            selectFromEvents(cachedData.events);
            setIsOfflineData(true);
            setIsLoading(false);
            return;
          }
        } catch (cacheError) {
          if (cancelled) return;
          console.warn("Failed to get cached events:", cacheError);
        }

        // No cached data available while offline
        selectFromEvents([]);
        setError(
          "Offline - no cached event data available. Connect to internet to download events.",
        );
        setIsLoading(false);
        return;
      }

      try {
        setIsLoading(true);
        setError(null);
        setIsOfflineData(false);

        // Fetch events using unified API
        let apiEvents: Event[] = [];
        try {
          const eventsResponse = await fetch(
            `/api/teams/${teamNumber}/events/${currentYear}?competitionType=${competitionType}`,
          );
          if (eventsResponse.ok) {
            const eventData = await eventsResponse.json();
            // Transform events to our Event format
            if (competitionType === "FRC") {
              apiEvents = eventData.map((tbaEvent: TbaEvent) => ({
                name: tbaEvent.name,
                region: `${tbaEvent.event_code.toUpperCase()}: ${tbaEvent.year}`,
                eventCode: tbaEvent.key,
              }));
            } else {
              // FTC
              apiEvents = eventData.map((ftcEvent: FtcEvent) => ({
                name: ftcEvent.name || "Unknown Event",
                region:
                  `${ftcEvent.city || ""}${ftcEvent.city && ftcEvent.stateprov ? ", " : ""}${ftcEvent.stateprov || ""}` ||
                  ftcEvent.typeName ||
                  "FTC Event",
                eventCode: ftcEvent.code || ftcEvent.eventId,
              }));
            }
          }
        } catch (apiError) {
          console.warn(
            "Failed to fetch events, continuing with custom events only:",
            apiError,
          );
        }

        // Fetch custom events
        let customEvents: Event[] = [];
        try {
          const customResponse = await fetch(
            `/api/events/custom-events?year=${currentYear}`,
          );
          if (customResponse.ok) {
            const customEventData = await customResponse.json();

            // Transform custom events to our Event format
            customEvents = customEventData.map((customEvent: CustomEvent) => ({
              name: customEvent.name,
              region: customEvent.location
                ? `${customEvent.location}${customEvent.region ? ", " + customEvent.region : ""}`
                : `Custom Event: ${customEvent.year}`,
              eventCode: customEvent.eventCode,
            }));
          }
        } catch (customError) {
          console.warn("Failed to fetch custom events:", customError);
        }

        // Combine API and custom events
        const allEvents = [...apiEvents, ...customEvents];
        if (cancelled) return;
        selectFromEvents(allEvents);

        // Cache events for offline use
        if (allEvents.length > 0) {
          try {
            await indexedDBService.cacheEventList(
              teamNumber,
              competitionType,
              currentYear,
              allEvents,
            );
          } catch (cacheError) {
            console.warn("Failed to cache events:", cacheError);
          }
        }

        if (allEvents.length === 0) {
          setError("No events found for this year");
        }
      } catch (err) {
        if (cancelled) return;
        console.error("Error fetching events:", err);

        // Try to fall back to cached data on fetch error
        try {
          const cachedData = await indexedDBService.getCachedEventList(
            teamNumber,
            competitionType,
            currentYear,
          );
          if (cancelled) return;
          if (cachedData && cachedData.events.length > 0) {
            selectFromEvents(cachedData.events);
            setIsOfflineData(true);
            setIsLoading(false);
            return;
          }
        } catch (cacheError) {
          if (cancelled) return;
          console.warn(
            "Failed to get cached events on error fallback:",
            cacheError,
          );
        }

        setError("Failed to load events");
        selectFromEvents([]);
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    };

    fetchEvents();
    return () => {
      cancelled = true;
    };
  }, [currentYear, competitionType, isInitialized, status, selectFromEvents]);

  // Save selected event to localStorage and cookies whenever it changes
  useEffect(() => {
    if (selectedEvent) {
      localStorage.setItem("selectedEvent", JSON.stringify(selectedEvent));
      // Also set a cookie for server-side access
      document.cookie = `selectedEvent=${encodeURIComponent(JSON.stringify(selectedEvent))}; path=/; max-age=${60 * 60 * 24 * 30}`; // 30 days
    }
  }, [selectedEvent]);

  const setSelectedEvent = (event: Event) => {
    setSelection({ scopeKey, event });
  };

  const contextValue: EventContextType = {
    events: status === "authenticated" ? events : [],
    selectedEvent: status === "authenticated" ? selectedEvent : null,
    setSelectedEvent,
    setEvents,
    isLoading:
      status === "authenticated"
        ? isLoading || selection?.scopeKey !== scopeKey
        : false,
    error: status === "authenticated" ? error : null,
    isOfflineData: status === "authenticated" ? isOfflineData : false,
  };

  return (
    <EventContext.Provider value={contextValue}>
      {children}
    </EventContext.Provider>
  );
}

export function useEventConfig() {
  const context = useContext(EventContext);
  if (context === undefined) {
    throw new Error("useEventConfig must be used within an EventProvider");
  }
  return context;
}

export function useSelectedEvent() {
  const { selectedEvent } = useEventConfig();
  return selectedEvent;
}

// Utility function to filter data by selected event
export function useEventFilter() {
  const { selectedEvent } = useEventConfig();

  const filterByEvent = <T extends { eventName?: string; eventCode?: string }>(
    data: T[],
  ): T[] => {
    if (!selectedEvent) return data;
    return data.filter(
      (item) =>
        item.eventName === selectedEvent.name ||
        item.eventCode === selectedEvent.eventCode,
    );
  };

  return { filterByEvent, selectedEvent };
}
