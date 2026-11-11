"use client";

import { createContext, useContext, useEffect, useState, useSyncExternalStore, ReactNode } from "react";
import { GAME_CONFIG_UPDATED } from "@/lib/game-config/updates";
import { startActivePolling } from "@/lib/active-polling";
import gameConfig from "../../config/game-config-loader";
import type { YearConfig, GameConfig, CompetitionType } from "@/lib/types";
import { useSession } from "next-auth/react";

interface GameConfigContextType {
  config: GameConfig;
  currentYear: number;
  competitionType: CompetitionType;
  setCurrentYear: (year: number) => void;
  setCompetitionType: (type: CompetitionType) => void;
  getCurrentYearConfig: () => YearConfig | undefined;
  isInitialized: boolean;
}

const COMPETITION_TYPE_KEY = "selectedCompetitionType";
const GAME_YEAR_KEY = "selectedGameYear";
const DEFAULT_COMPETITION_TYPE: CompetitionType = "FRC";
const DEFAULT_YEAR = 2025;

// Selections live in localStorage; these helpers expose them as an external
// store so they are read during render without a hydration mismatch.
const storageListeners = new Set<() => void>();

function subscribeToSelections(listener: () => void) {
  storageListeners.add(listener);
  return () => {
    storageListeners.delete(listener);
  };
}

function writeSelection(key: string, value: string) {
  localStorage.setItem(key, value);
  storageListeners.forEach((listener) => listener());
}

function useStoredSelection(key: string): string | null {
  return useSyncExternalStore(
    subscribeToSelections,
    () => localStorage.getItem(key),
    () => null,
  );
}

function subscribeToNothing() {
  return () => {};
}

const GameConfigContext = createContext<GameConfigContextType | undefined>(
  undefined,
);

export function GameConfigProvider({ children, initialConfig }: { children: ReactNode; initialConfig?: GameConfig }) {
  const { data: session, status } = useSession();
  const guest = session?.guestEvent;
  const [liveConfig, setLiveConfig] = useState<GameConfig | null>(null);
  const config = liveConfig ?? initialConfig ?? gameConfig as unknown as GameConfig;

  useEffect(() => {
    if (status !== "authenticated") return;
    let disposed = false;
    let controller: AbortController | undefined;
    const refresh = async () => {
      if (!navigator.onLine || document.visibilityState === "hidden") return;
      controller?.abort();
      const request = new AbortController();
      controller = request;
      const timeout = window.setTimeout(() => request.abort(), 10_000);
      try {
        const response = await fetch("/api/scouting/config", { cache: "no-store", signal: request.signal });
        if (!response.ok) return;
        const data = await response.json();
        if (!disposed && !request.signal.aborted && data.config?.FRC && data.config?.FTC) {
          setLiveConfig((previous) => JSON.stringify(previous) === JSON.stringify(data.config) ? previous : data.config);
        }
      } catch {
        // Keep the last usable configuration while offline or on server failure.
      } finally {
        window.clearTimeout(timeout);
      }
    };
    const onStorage = (event: StorageEvent) => {
      if (event.key === GAME_CONFIG_UPDATED) void refresh();
    };
    void refresh();
    // Same-browser edits arrive by event; other devices only need occasional
    // checks while someone is actually using this tab.
    const stopPolling = startActivePolling(() => void refresh(), 2 * 60_000);
    window.addEventListener(GAME_CONFIG_UPDATED, refresh);
    window.addEventListener("storage", onStorage);
    return () => {
      disposed = true;
      controller?.abort();
      stopPolling();
      window.removeEventListener(GAME_CONFIG_UPDATED, refresh);
      window.removeEventListener("storage", onStorage);
    };
  }, [status, session?.user?.id]);
  // True once rendering on the client, where the stored selections are readable
  const isInitialized = useSyncExternalStore(
    subscribeToNothing,
    () => true,
    () => false,
  );

  const savedType = useStoredSelection(COMPETITION_TYPE_KEY);
  const competitionType: CompetitionType =
    guest ? guest.competitionType : savedType === "FRC" || savedType === "FTC"
      ? savedType
      : DEFAULT_COMPETITION_TYPE;

  const savedYear = parseInt(useStoredSelection(GAME_YEAR_KEY) ?? "");
  const availableYears = Object.keys(config[competitionType] ?? {}).map(Number);
  const preferredYear = Number.isNaN(savedYear) ? DEFAULT_YEAR : savedYear;
  const currentYear = guest?.year ?? (availableYears.includes(preferredYear)
    ? preferredYear : availableYears.length ? Math.max(...availableYears) : preferredYear);

  const setCurrentYear = (year: number) => {
    if (guest) return;
    writeSelection(GAME_YEAR_KEY, year.toString());
  };

  const setCompetitionType = (type: CompetitionType) => {
    if (guest) return;
    writeSelection(COMPETITION_TYPE_KEY, type);
    // Reset to latest available year when switching competition types
    const availableYears = Object.keys(config[type] || {});
    if (availableYears.length > 0) {
      const latestYear = Math.max(...availableYears.map((y) => parseInt(y)));
      setCurrentYear(latestYear);
    }
  };

  const getCurrentYearConfig = () => {
    return config[competitionType]?.[currentYear.toString()];
  };

  return (
    <GameConfigContext.Provider
      value={{
        config,
        currentYear,
        competitionType,
        setCurrentYear,
        setCompetitionType,
        getCurrentYearConfig,
        isInitialized,
      }}
    >
      {children}
    </GameConfigContext.Provider>
  );
}

export function useGameConfig() {
  const context = useContext(GameConfigContext);
  if (context === undefined) {
    throw new Error("useGameConfig must be used within a GameConfigProvider");
  }
  return context;
}

export function useCurrentGameConfig() {
  const { getCurrentYearConfig } = useGameConfig();
  return getCurrentYearConfig();
}
