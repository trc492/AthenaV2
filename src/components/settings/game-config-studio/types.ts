import type { YearConfig, ScoringDefinition } from "@/lib/types";

export interface BuilderState {
  competitionType: "FRC" | "FTC";
  year: number;
  config: YearConfig;
  selectedFile?: string;
  isDirty: boolean;
}

export function slugifyKey(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^\w\s-]/g, "")
    .replace(/\s+/g, "_")
    .replace(/-+/g, "_")
    .replace(/^_+|_+$/g, "");
}

export const DEFAULT_NEW_CONFIG: YearConfig = {
  competitionType: "FRC",
  gameName: "NEW_GAME",
  startPositions: ["Left", "Center", "Right"],
  scoring: {
    autonomous: {
      leave: {
        label: "Leave Starting Zone",
        points: 2,
        description: "Robot leaves starting zone during auto",
        type: "boolean",
      },
      game_piece_scored: {
        label: "Game Pieces Scored (Auto)",
        points: 4,
        description: "Number of game pieces scored during autonomous",
        increments: [1, 2, 5],
      },
    },
    teleop: {
      game_piece_scored: {
        label: "Game Pieces Scored (Teleop)",
        points: 2,
        description: "Number of game pieces scored during teleop",
        increments: [1, 2, 5],
      },
      game_piece_missed: {
        label: "Game Pieces Missed",
        points: 0,
        description: "Missed scoring attempts",
        increments: [1, 2],
      },
    },
    endgame: {
      climb_state: {
        label: "Ending Climb State",
        description: "Robot's final climb status during endgame",
        pointValues: {
          none: 0,
          parked: 2,
          shallow: 6,
          deep: 12,
        },
      },
      robot_broke_down: {
        label: "Robot Broke Down",
        description: "Robot experienced mechanical or electrical failure",
        type: "boolean",
      },
    },
    fouls: {
      minor_fouls: {
        label: "Minor Fouls",
        points: -3,
        description: "Minor penalties committed",
      },
      tech_fouls: {
        label: "Tech Fouls",
        points: -10,
        description: "Technical fouls committed",
      },
    },
  },
  pitScouting: {
    autonomous: {
      autoRoutines: {
        label: "Available Auto Routines",
        type: "multiselect",
        options: ["Leave Only", "1 Piece Auto", "Multi Piece Auto"],
      },
    },
    teleoperated: {
      driveTrainType: {
        label: "Drivetrain Type",
        type: "select",
        options: ["Swerve", "Tank / West Coast", "Mecanum", "Other"],
      },
      intakeType: {
        label: "Intake Mechanism",
        type: "select",
        options: ["Ground Intake", "Source / Human Player", "Both"],
      },
      scoringCapability: {
        label: "Primary Scoring Goal",
        type: "select",
        options: ["High Goal", "Low Goal", "Both"],
      },
    },
    driveTeam: {
      drivePracticeHours: {
        label: "Driver Practice Hours",
        type: "select",
        options: ["<10 Hours", "10-25 Hours", "25-50 Hours", "50+ Hours"],
      },
    },
    endgame: {
      canClimb: {
        label: "Can Climb / Park",
        type: "boolean",
      },
      climbTimeSeconds: {
        label: "Estimated Climb Time (seconds)",
        type: "number",
        dependsOn: "canClimb",
      },
    },
  },
  analysisInsights: {
    insights: [
      {
        id: "breakdown_rate",
        title: "Breakdown Rate",
        description: "Frequency of robot breakdowns during matches",
        ranking: "lower",
        valueFormat: "percent",
        rawLabel: "Breakdowns / Matches",
        calculation: {
          type: "booleanRate",
          key: "endgame.robot_broke_down",
        },
      },
    ],
  },
  matchupCardConfig: {
    autoMetrics: [{ key: "autonomous.game_piece_scored", label: "Auto Scored" }],
    teleopMetrics: [{ key: "teleop.game_piece_scored", label: "Teleop Scored" }],
    endgame: {
      stateKey: "endgame.climb_state",
      states: [
        { key: "deep", label: "Deep Climb" },
        { key: "shallow", label: "Shallow Climb" },
        { key: "parked", label: "Parked" },
      ],
    },
    warnings: {
      breakdownThreshold: 15,
      foulThreshold: 1.0,
    },
  },
  teamPageConfig: {
    kpis: {
      auto: {
        key: "autonomous.game_piece_scored",
        label: "Avg Auto Scored",
      },
      teleop: {
        key: "teleop.game_piece_scored",
        label: "Avg Teleop Scored",
      },
    },
    autoPerformance: {
      metrics: [{ key: "autonomous.game_piece_scored", label: "Auto Scored" }],
      showPointsEstimate: true,
      pointsFormula: [{ key: "autonomous.game_piece_scored", points: 4 }],
    },
    teleopPerformance: {
      metrics: [{ key: "teleop.game_piece_scored", label: "Teleop Scored" }],
      showPointsEstimate: true,
      pointsFormula: [{ key: "teleop.game_piece_scored", points: 2 }],
    },
    scoringBreakdownChart: {
      title: "Scoring Breakdown",
      description: "Average scoring actions per match",
      items: [
        { name: "Auto Scored", key: "autonomous.game_piece_scored", fill: "#3b82f6" },
        { name: "Teleop Scored", key: "teleop.game_piece_scored", fill: "#10b981" },
      ],
    },
    endgame: {
      title: "Climb Distribution",
      description: "Endgame climb level frequencies",
      displayType: "chart",
      stateKey: "endgame.climb_state",
      states: [
        { value: "none", label: "None", points: 0 },
        { value: "parked", label: "Parked", points: 2 },
        { value: "shallow", label: "Shallow", points: 6 },
        { value: "deep", label: "Deep", points: 12 },
      ],
    },
    penalties: {
      title: "Penalties",
      description: "Foul averages",
      minorKey: "fouls.minor_fouls",
      minorLabel: "Minor Fouls",
      minorPoints: -3,
      majorKey: "fouls.tech_fouls",
      majorLabel: "Tech Fouls",
      majorPoints: -10,
    },
  },
};
