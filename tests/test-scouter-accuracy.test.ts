import { describe, it, expect } from "vitest";

import { computeScouterAccuracy } from "../src/lib/statistics";
import type { MatchEntry, YearConfig } from "../src/lib/types";

const MATCH_COUNT = 60;

const mockConfig: YearConfig = {
  competitionType: "FRC",
  gameName: "REEFSCAPE",
  startPositions: ["Left", "Center Left", "Center Right", "Right"],
  pitScouting: {
    autonomous: {},
    teleoperated: {},
    endgame: {},
  },
  scoring: {
    autonomous: {
      leave: {
        label: "Leave",
        points: 3,
        description: "Leave starting zone",
        type: "boolean",
      },
      L1_coral: {
        label: "L1 Coral (Auto)",
        points: 3,
        description: "L1 coral scored",
      },
      L2_coral: {
        label: "L2 Coral (Auto)",
        points: 4,
        description: "L2 coral scored",
      },
      L3_coral: {
        label: "L3 Coral (Auto)",
        points: 6,
        description: "L3 coral scored",
      },
      L4_coral: {
        label: "L4 Coral (Auto)",
        points: 7,
        description: "L4 coral scored",
      },
    },
    teleop: {
      L1_coral: {
        label: "L1 Coral (Teleop)",
        points: 2,
        description: "L1 coral scored",
      },
      L2_coral: {
        label: "L2 Coral (Teleop)",
        points: 3,
        description: "L2 coral scored",
      },
      L3_coral: {
        label: "L3 Coral (Teleop)",
        points: 4,
        description: "L3 coral scored",
      },
      processor_algae: {
        label: "Processor Algae",
        points: 6,
        description: "Processor algae scored",
      },
      net_algae: {
        label: "Net Algae",
        points: 4,
        description: "Net algae scored",
      },
    },
    endgame: {
      shallow_climb: {
        label: "Shallow Climb",
        points: 2,
        description: "Shallow climb completed",
      },
      deep_climb: {
        label: "Deep Climb",
        points: 6,
        description: "Deep climb completed",
      },
      park: { label: "Park", points: 1, description: "Robot parked" },
    },
    fouls: {},
  },
};

const scouterBias: Record<string, number> = {
  alice: 1,
  diana: 1.05,
  bob: 1.1,
  charlie: 0.85,
  eve: 1.25,
};

const baseRobot = {
  autonomous: { leave: true, L1_coral: 3, L2_coral: 2 },
  teleop: { L1_coral: 8, L2_coral: 5, processor_algae: 2, net_algae: 4 },
  endgame: { deep_climb: 1 },
};

const baseResults = [
  { red: { score: 258, fouls: 5 }, blue: { score: 252, fouls: 0 } },
  { red: { score: 265, fouls: 10 }, blue: { score: 248, fouls: 5 } },
  { red: { score: 254, fouls: 0 }, blue: { score: 260, fouls: 5 } },
  { red: { score: 256, fouls: 5 }, blue: { score: 255, fouls: 10 } },
  { red: { score: 262, fouls: 10 }, blue: { score: 250, fouls: 0 } },
  { red: { score: 251, fouls: 0 }, blue: { score: 257, fouls: 5 } },
  { red: { score: 259, fouls: 5 }, blue: { score: 263, fouls: 10 } },
  { red: { score: 255, fouls: 10 }, blue: { score: 249, fouls: 0 } },
  { red: { score: 261, fouls: 0 }, blue: { score: 254, fouls: 5 } },
  { red: { score: 257, fouls: 5 }, blue: { score: 258, fouls: 10 } },
  { red: { score: 253, fouls: 10 }, blue: { score: 256, fouls: 0 } },
  { red: { score: 264, fouls: 0 }, blue: { score: 251, fouls: 5 } },
  { red: { score: 256, fouls: 5 }, blue: { score: 259, fouls: 10 } },
  { red: { score: 260, fouls: 10 }, blue: { score: 253, fouls: 0 } },
  { red: { score: 252, fouls: 0 }, blue: { score: 261, fouls: 5 } },
];

function createMatchEntries(matchCount: number = MATCH_COUNT): MatchEntry[] {
  const matches: MatchEntry[] = [];
  const scouterOrder = ["alice", "diana", "bob", "charlie", "eve"];

  let matchId = 1;

  for (let matchNumber = 1; matchNumber <= matchCount; matchNumber++) {
    const assignments = Array.from({ length: 6 }, (_, position) => {
      const scouterIndex =
        ((matchNumber - 1) * 2 + position) % scouterOrder.length;
      return scouterOrder[scouterIndex];
    });

    for (let allianceIndex = 0; allianceIndex < 2; allianceIndex++) {
      const alliance = allianceIndex === 0 ? "red" : "blue";
      const teamBase = allianceIndex === 0 ? 1000 : 2000;
      const allianceOffset = allianceIndex * 3;

      for (let position = 0; position < 3; position++) {
        const scouterId = assignments[allianceOffset + position];
        const bias = scouterBias[scouterId];

        matches.push({
          id: matchId++,
          matchNumber,
          teamNumber: teamBase + matchNumber * 10 + position,
          year: 2025,
          competitionType: "FRC",
          alliance,
          alliancePosition: position + 1,
          eventCode: "test2025",
          eventName: "Test Event 2025",
          userId: scouterId,
          notes: `Scouted by ${scouterId}`,
          timestamp: new Date("2026-01-01T00:00:00.000Z"),
          gameSpecificData: {
            autonomous: {
              leave: baseRobot.autonomous.leave,
              L1_coral: Math.round(baseRobot.autonomous.L1_coral * bias),
              L2_coral: Math.round(baseRobot.autonomous.L2_coral * bias),
            },
            teleop: {
              L1_coral: Math.round(baseRobot.teleop.L1_coral * bias),
              L2_coral: Math.round(baseRobot.teleop.L2_coral * bias),
              processor_algae: Math.round(
                baseRobot.teleop.processor_algae * bias,
              ),
              net_algae: Math.round(baseRobot.teleop.net_algae * bias),
            },
            endgame: {
              deep_climb: baseRobot.endgame.deep_climb,
            },
          },
        });
      }
    }
  }

  return matches;
}

function createOfficialResults(matchCount: number = MATCH_COUNT) {
  const results = new Map<
    number,
    {
      red: { officialScore: number; foulPoints: number };
      blue: { officialScore: number; foulPoints: number };
    }
  >();

  for (let match = 1; match <= matchCount; match++) {
    const cycle = baseResults[(match - 1) % baseResults.length];
    const drift = Math.floor((match - 1) / baseResults.length) * 3;

    results.set(match, {
      red: {
        officialScore: cycle.red.score + drift,
        foulPoints: cycle.red.fouls,
      },
      blue: {
        officialScore: cycle.blue.score + (drift % 5),
        foulPoints: cycle.blue.fouls,
      },
    });
  }

  return results;
}

describe("computeScouterAccuracy", () => {
  it("ranks scouters by accuracy and converges on the deterministic dataset", () => {
    const matches = createMatchEntries();
    const officialResults = createOfficialResults();

    const result = computeScouterAccuracy(
      matches,
      officialResults,
      mockConfig,
      {
        expectedAllianceSize: 3,
        skipIncompleteAlliances: true,
      },
    );

    expect(result.convergenceAchieved).toBe(true);
    expect(result.message).toBeUndefined();
    expect(result.scouters).toHaveLength(5);
    expect(result.overallMeanError).toBeGreaterThan(0);

    const ranking = result.scouters.map((scouter) => scouter.scouterId);

    expect(ranking.slice(0, 2).sort()).toEqual(["alice", "diana"]);
    expect(ranking.indexOf("alice")).toBeLessThan(ranking.indexOf("bob"));
    expect(ranking.indexOf("diana")).toBeLessThan(ranking.indexOf("bob"));
    expect(ranking.indexOf("bob")).toBeLessThan(ranking.indexOf("charlie"));
    expect(ranking.indexOf("charlie")).toBeLessThan(ranking.indexOf("eve"));
    expect(ranking[ranking.length - 1]).toBe("eve");

    expect(result.scouters.map((scouter) => scouter.percentile)).toEqual([
      100, 75, 50, 25, 0,
    ]);

    expect(
      result.scouters.every((scouter) => scouter.matchesScounted >= 10),
    ).toBe(true);
    expect(result.scouters[0].errorValue).toBeLessThan(
      result.scouters[result.scouters.length - 1].errorValue,
    );
  });
});
