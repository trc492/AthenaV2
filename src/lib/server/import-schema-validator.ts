import gameConfig from "../../../config/game-config-loader";
import type {
  YearConfig,
  CompetitionType,
  PitEntry,
  MatchEntry,
} from "@/lib/types";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

export interface ImportValidationResult {
  valid: boolean;
  error?: string;
}

/**
 * Retrieves the YearConfig for a given competition type and year.
 * Checks static game-config-loader first, then falls back to filesystem (config/years and .runtime/configs).
 */
export function getYearConfig(
  competitionType: string,
  year: number,
): YearConfig | null {
  const compUpper = competitionType.toUpperCase();

  // 1. Check static gameConfig
  const typedConfig = gameConfig as unknown as Record<
    string,
    Record<string, YearConfig>
  >;
  if (typedConfig[compUpper]?.[year.toString()]) {
    return typedConfig[compUpper][year.toString()];
  }

  // 2. Check filesystem directories
  const candidateFiles = [
    `${compUpper}-${year}.json`,
    `${compUpper.toLowerCase()}-${year}.json`,
    `${competitionType}-${year}.json`,
  ];

  const candidatePaths = candidateFiles.flatMap((filename) => [
    join(process.cwd(), "config", "years", filename),
    join(process.cwd(), ".runtime", "configs", filename),
  ]);

  for (const fullPath of candidatePaths) {
    if (!existsSync(fullPath)) continue;
    try {
      const raw = readFileSync(fullPath, "utf-8");
      return JSON.parse(raw) as YearConfig;
    } catch {
      // Try the next supported filename when a config is unreadable.
    }
  }

  return null;
}

/**
 * Validates that imported data (pit entries and/or match entries) matches
 * the schema configurations available in Athena for the respective years and competition types.
 */
export function validateImportAgainstSchema(data: {
  pitEntries?: PitEntry[];
  matchEntries?: MatchEntry[];
}): ImportValidationResult {
  const pitEntries = data.pitEntries || [];
  const matchEntries = data.matchEntries || [];

  if (pitEntries.length === 0 && matchEntries.length === 0) {
    return { valid: true };
  }

  interface GroupData {
    competitionType: CompetitionType;
    year: number;
    hasPit: boolean;
    hasMatch: boolean;
    pitEntries: PitEntry[];
    matchEntries: MatchEntry[];
  }

  const groups = new Map<string, GroupData>();

  for (const p of pitEntries) {
    const compType = (
      (p.competitionType as string) || "FRC"
    ).toUpperCase() as CompetitionType;
    const year = Number(p.year);
    if (!year || isNaN(year)) {
      return { valid: false, error: "Invalid or missing year in pit scouting data." };
    }
    const key = `${compType}-${year}`;
    if (!groups.has(key)) {
      groups.set(key, {
        competitionType: compType,
        year,
        hasPit: true,
        hasMatch: false,
        pitEntries: [p],
        matchEntries: [],
      });
    } else {
      const g = groups.get(key)!;
      g.hasPit = true;
      g.pitEntries.push(p);
    }
  }

  for (const m of matchEntries) {
    const compType = ((m.competitionType as string) || "FRC").toUpperCase() as CompetitionType;
    const year = Number(m.year);
    if (!year || isNaN(year)) {
      return { valid: false, error: "Invalid or missing year in match scouting data." };
    }
    const key = `${compType}-${year}`;
    if (!groups.has(key)) {
      groups.set(key, {
        competitionType: compType,
        year,
        hasPit: false,
        hasMatch: true,
        pitEntries: [],
        matchEntries: [m],
      });
    } else {
      const g = groups.get(key)!;
      g.hasMatch = true;
      g.matchEntries.push(m);
    }
  }

  for (const group of groups.values()) {
    const config = getYearConfig(group.competitionType, group.year);
    if (!config) {
      return {
        valid: false,
        error: `Missing schema configuration for ${group.competitionType} ${group.year}. Please configure this game year before importing.`,
      };
    }

    // If pit data is present, verify schema has pit scouting defined
    if (group.hasPit) {
      const pitScouting = config.pitScouting;
      const hasPitConfig =
        pitScouting &&
        typeof pitScouting === "object" &&
        Object.keys(pitScouting).length > 0;

      if (!hasPitConfig) {
        return {
          valid: false,
          error: `Schema configuration for ${group.competitionType} ${group.year} does not have pit scouting configured, but pit scouting data is present in the import.`,
        };
      }

      // Check field compatibility if entries have gameSpecificData
      const pitCategories = new Set(Object.keys(pitScouting).map((k) => k.toLowerCase()));
      pitCategories.add("auto"); // common alias for autonomous
      const pitFieldNames = new Set<string>();
      for (const cat of Object.values(pitScouting)) {
        if (cat && typeof cat === "object") {
          for (const f of Object.keys(cat)) {
            pitFieldNames.add(f.toLowerCase());
          }
        }
      }
      // Common standard fields
      pitFieldNames.add("hasauto");
      pitFieldNames.add("autodrawing");
      pitFieldNames.add("notes");
      pitFieldNames.add("left");

      for (const entry of group.pitEntries) {
        const gameData = entry.gameSpecificData;
        if (gameData && typeof gameData === "object" && Object.keys(gameData).length > 0) {
          const keys = Object.keys(gameData);
          const hasAnyMatchingKey = keys.some((key) => {
            const lowerKey = key.toLowerCase();
            if (pitCategories.has(lowerKey) || pitFieldNames.has(lowerKey)) return true;
            // Also check prefix category_field
            const parts = lowerKey.split("_");
            if (parts.length >= 2 && (pitCategories.has(parts[0]) || pitFieldNames.has(parts.slice(1).join("_")))) {
              return true;
            }
            return false;
          });

          if (!hasAnyMatchingKey) {
            return {
              valid: false,
              error: `Imported pit scouting data for ${group.competitionType} ${group.year} contains fields that do not match the schema configuration.`,
            };
          }
        }
      }
    }

    // If match data is present, verify schema has match scoring defined
    if (group.hasMatch) {
      const scoring = config.scoring;
      const hasScoringConfig =
        scoring &&
        typeof scoring === "object" &&
        Object.keys(scoring).length > 0;

      if (!hasScoringConfig) {
        return {
          valid: false,
          error: `Schema configuration for ${group.competitionType} ${group.year} does not have match scoring configured, but match scouting data is present in the import.`,
        };
      }

      // Check field compatibility if entries have gameSpecificData
      const scoringSections = new Set(Object.keys(scoring).map((k) => k.toLowerCase()));
      scoringSections.add("auto"); // common alias for autonomous
      const scoringFieldNames = new Set<string>();
      for (const sec of Object.values(scoring)) {
        if (sec && typeof sec === "object") {
          for (const f of Object.keys(sec)) {
            scoringFieldNames.add(f.toLowerCase());
          }
        }
      }
      scoringFieldNames.add("notes");

      for (const entry of group.matchEntries) {
        const gameData = entry.gameSpecificData;
        if (gameData && typeof gameData === "object" && Object.keys(gameData).length > 0) {
          const keys = Object.keys(gameData);
          const hasAnyMatchingKey = keys.some((key) => {
            const lowerKey = key.toLowerCase();
            if (scoringSections.has(lowerKey) || scoringFieldNames.has(lowerKey)) return true;
            // Also check prefix section_field
            const parts = lowerKey.split("_");
            if (parts.length >= 2 && (scoringSections.has(parts[0]) || scoringFieldNames.has(parts.slice(1).join("_")))) {
              return true;
            }
            return false;
          });

          if (!hasAnyMatchingKey) {
            return {
              valid: false,
              error: `Imported match scouting data for ${group.competitionType} ${group.year} contains fields that do not match the schema configuration.`,
            };
          }
        }
      }
    }
  }

  return { valid: true };
}
