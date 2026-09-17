import { describe, it, expect } from "vitest";
import { validateImportAgainstSchema } from "@/lib/server/import-schema-validator";
import type { PitEntry, MatchEntry } from "@/lib/types";

describe("validateImportAgainstSchema", () => {
  it("allows empty import payload", () => {
    const result = validateImportAgainstSchema({ pitEntries: [], matchEntries: [] });
    expect(result.valid).toBe(true);
  });

  it("validates valid 2025 FRC pit entries", () => {
    const pitEntries: PitEntry[] = [
      {
        teamNumber: 111,
        year: 2025,
        competitionType: "FRC",
        driveTrain: "Swerve",
        gameSpecificData: {
          autonomous_startingPosition: "Left Barge",
          teleoperated_cycleTime: 15,
        },
      },
    ];

    const result = validateImportAgainstSchema({ pitEntries });
    expect(result.valid).toBe(true);
  });

  it("validates valid 2025 FRC match entries", () => {
    const matchEntries: MatchEntry[] = [
      {
        teamNumber: 111,
        matchNumber: 1,
        year: 2025,
        competitionType: "FRC",
        alliance: "blue",
        notes: "Good defense",
        timestamp: new Date(),
        gameSpecificData: {
          autonomous: {
            leave: true,
            L1_coral: 2,
          },
          teleop: {
            L2_coral: 4,
          },
        },
      },
    ];

    const result = validateImportAgainstSchema({ matchEntries });
    expect(result.valid).toBe(true);
  });

  it("validates both pit and match entries together", () => {
    const pitEntries: PitEntry[] = [
      {
        teamNumber: 111,
        year: 2025,
        competitionType: "FRC",
        driveTrain: "Tank",
        gameSpecificData: {},
      },
    ];
    const matchEntries: MatchEntry[] = [
      {
        teamNumber: 111,
        matchNumber: 1,
        year: 2025,
        competitionType: "FRC",
        alliance: "red",
        notes: "",
        timestamp: new Date(),
        gameSpecificData: {},
      },
    ];

    const result = validateImportAgainstSchema({ pitEntries, matchEntries });
    expect(result.valid).toBe(true);
  });

  it("rejects when year has no schema configuration in Athena", () => {
    const matchEntries: MatchEntry[] = [
      {
        teamNumber: 111,
        matchNumber: 1,
        year: 2012, // No config
        competitionType: "FRC",
        alliance: "red",
        notes: "",
        timestamp: new Date(),
        gameSpecificData: {},
      },
    ];

    const result = validateImportAgainstSchema({ matchEntries });
    expect(result.valid).toBe(false);
    expect(result.error).toContain("Missing schema configuration for FRC 2012");
  });

  it("rejects when match entries contain fields completely alien to the schema", () => {
    const matchEntries: MatchEntry[] = [
      {
        teamNumber: 111,
        matchNumber: 1,
        year: 2025,
        competitionType: "FRC",
        alliance: "red",
        notes: "",
        timestamp: new Date(),
        gameSpecificData: {
          alienCategory: {
            unknownField: 999,
          },
        },
      },
    ];

    const result = validateImportAgainstSchema({ matchEntries });
    expect(result.valid).toBe(false);
    expect(result.error).toContain("fields that do not match the schema configuration");
  });
});
