import { describe, expect, it } from "vitest";
import frc2025 from "../config/years/FRC-2025.json";
import frc2026 from "../config/years/FRC-2026.json";
import ftc2026 from "../config/years/FTC-2026.json";
import { calculatePeriodPoints } from "@/lib/game-config/scoring";
import {
  calculateEPA, calculateDetailedGameStats, calculateTeamRankings,
  calculateConsistency,
} from "@/lib/statistics";
import type { EPABreakdown, MatchEntry, YearConfig } from "@/lib/types";

const currentConfig = frc2026 as YearConfig;

function match(gameSpecificData: MatchEntry["gameSpecificData"], overrides: Partial<MatchEntry> = {}): MatchEntry {
  return {
    teamNumber: 254, matchNumber: 1, alliance: "red", competitionType: "FRC",
    year: 2026, timestamp: new Date("2026-01-01T00:00:00Z"), notes: "",
    gameSpecificData, ...overrides,
  };
}

// Expected totals are hand calculated, independent of the scoring implementation.
const seasons: { name: string; config: YearConfig; data: MatchEntry["gameSpecificData"]; expected: EPABreakdown }[] = [
  {
    name: "FRC 2025", config: frc2025 as YearConfig,
    data: {
      autonomous: { leave: true, L4_coral: 2, processor_algae: 1 }, // 3 + 14 + 6
      teleop: { L2_coral: 3, net_algae: 2 }, // 9 + 8
      endgame: { ending_robot_state: "deep" },
      fouls: { fouls: 2, tech_fouls: 1 }, // -4 - 5
    },
    expected: { auto: 23, teleop: 17, endgame: 12, penalties: -9, totalEPA: 43 },
  },
  {
    name: "FRC 2026", config: frc2026 as YearConfig,
    data: {
      autonomous: { fuel_scored: 7, fuel_missed: 8, climb: true }, // 7 + 15
      teleop: { fuel_scored: 20, fuel_missed: 5, fuel_shuttled: 9 },
      endgame: { ending_robot_state: "L3", robot_playstyle: "defensive" },
      fouls: { fouls: 2, tech_fouls: 1 },
    },
    expected: { auto: 22, teleop: 20, endgame: 30, penalties: -25, totalEPA: 47 },
  },
  {
    name: "FTC 2026", config: ftc2026 as YearConfig,
    data: {
      autonomous: { leave: true, artifacts_classified: 2, artifacts_overflow: 1, patterns: 1 },
      teleop: { artifacts_classified: 4, artifacts_overflow: 2, artifacts_depot: 3, patterns: 2 },
      endgame: { ending_based_state: "full" },
      fouls: { minor_penalties: 2, major_penalties: 1 },
    },
    expected: { auto: 12, teleop: 21, endgame: 10, penalties: -25, totalEPA: 18 },
  },
];

describe.each(seasons)("$name scoring", ({ config, data, expected }) => {
  it("scores numeric, boolean and enum fields and subtracts penalties", () => {
    expect(calculateEPA([match(data)], 2026, config)).toEqual(expected);
  });
  it("averages over every match, including a scoreless match", () => {
    const epa = calculateEPA([match(data), match({})], 2026, config);
    expect(epa).toEqual({
      auto: expected.auto / 2, teleop: expected.teleop / 2,
      endgame: expected.endgame / 2, penalties: expected.penalties / 2,
      totalEPA: expected.totalEPA / 2,
    });
  });
  it("returns a zero breakdown and no detailed stats without matches", () => {
    expect(calculateEPA([], 2026, config)).toEqual({ auto: 0, teleop: 0, endgame: 0, penalties: 0, totalEPA: 0 });
    expect(calculateDetailedGameStats([], config)).toBeNull();
  });
});

describe("scoring edge cases", () => {
  it("ignores unknown fields, false booleans, unscored fields and unknown enum values", () => {
    expect(calculatePeriodPoints({ unknown: 100, climb: false, fuel_missed: 25 }, currentConfig.scoring.autonomous)).toBe(0);
    expect(calculatePeriodPoints({ ending_robot_state: "unknown" }, currentConfig.scoring.endgame)).toBe(0);
    expect(calculatePeriodPoints({ ending_robot_state: "none" }, currentConfig.scoring.endgame)).toBe(0);
  });
  it("matches field keys without case sensitivity", () => {
    expect(calculatePeriodPoints({ FUEL_SCORED: 4, CLIMB: true }, currentConfig.scoring.autonomous)).toBe(19);
  });
  it("allows a negative EPA when penalties exceed scored points", () => {
    expect(calculateEPA([match({ fouls: { tech_fouls: 2 } })], 2026, frc2026 as YearConfig).totalEPA).toBe(-30);
  });
  it("ranks teams using average contribution rather than number of matches", () => {
    const matches = [
      match({ teleop: { fuel_scored: 20 } }, { teamNumber: 1 }),
      match({ teleop: { fuel_scored: 20 } }, { teamNumber: 1, matchNumber: 2 }),
      match({ teleop: { fuel_scored: 30 } }, { teamNumber: 2 }),
    ];
    expect(calculateTeamRankings(matches, 2026, frc2026 as YearConfig)).toEqual([
      { teamNumber: 2, epa: 30, rank: 1 }, { teamNumber: 1, epa: 20, rank: 2 },
    ]);
    expect(calculateConsistency(matches.slice(0, 2), 2026, frc2026 as YearConfig)).toBe(0);
  });
});

describe("derived metrics", () => {
  it("uses the ratio of total fuel counts rather than the mean of match percentages", () => {
    const stats = calculateDetailedGameStats([
      match({ teleop: { fuel_scored: 1, fuel_missed: 1 } }),
      match({ teleop: { fuel_scored: 9, fuel_missed: 1 } }),
    ], frc2026 as YearConfig);
    expect(stats?.getMetricValue("teleop.fuel_accuracy")).toBe(83.3);
  });
  it("returns zero for a ratio with no attempts", () => {
    expect(calculateDetailedGameStats([match({})], frc2026 as YearConfig)?.getMetricValue("teleop.fuel_accuracy")).toBe(0);
  });
  it.each<{ config: YearConfig; key: string; data: MatchEntry["gameSpecificData"]; expected: number }>([
    { config: frc2025 as YearConfig, key: "calculated.auto_coral", data: { autonomous: { L1_coral: 2, L4_coral: 4 } }, expected: 3 },
    { config: ftc2026 as YearConfig, key: "calculated.teleop_artifacts", data: { teleop: { artifacts_classified: 3, artifacts_overflow: 2, artifacts_depot: 1 } }, expected: 3 },
  ])("averages summed metrics across matches: $key", ({ config, key, data, expected }) => {
    const stats = calculateDetailedGameStats([match(data), match({})], config as YearConfig);
    expect(stats?.getMetricValue(key)).toBe(expected);
  });
});
