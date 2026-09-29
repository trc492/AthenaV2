"use client";

import React, {
  createContext,
  useContext,
  useSyncExternalStore,
  ReactNode,
} from "react";
import gameConfig from "../../config/game-config-loader";
import type { YearConfig, GameConfig, CompetitionType } from "@/lib/types";

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

export function GameConfigProvider({ children }: { children: ReactNode }) {
  const config = gameConfig as unknown as GameConfig;
  // True once rendering on the client, where the stored selections are readable
  const isInitialized = useSyncExternalStore(
    subscribeToNothing,
    () => true,
    () => false,
  );

  const savedType = useStoredSelection(COMPETITION_TYPE_KEY);
  const competitionType: CompetitionType =
    savedType === "FRC" || savedType === "FTC"
      ? savedType
      : DEFAULT_COMPETITION_TYPE;

  const savedYear = parseInt(useStoredSelection(GAME_YEAR_KEY) ?? "");
  const currentYear = Number.isNaN(savedYear) ? DEFAULT_YEAR : savedYear;

  const setCurrentYear = (year: number) => {
    writeSelection(GAME_YEAR_KEY, year.toString());
  };

  const setCompetitionType = (type: CompetitionType) => {
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
