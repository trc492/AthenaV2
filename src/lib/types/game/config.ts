import type { CompetitionType } from "../competition/competition";
import type { AnalysisInsightsConfig } from "../analysis/analysis";

export interface ScoringDefinition {
  label: string;
  description: string;
  points?: number;
  pointValues?: Record<string, number>;
  type?: "boolean" | "select" | "number";
  dependsOn?: string;
  increments?: number[];
}

export interface MetricDisplayConfig {
  key: string;
  label: string;
  type?: "number" | "rate" | "badge";
  threshold?: number;
  hideIfZero?: boolean;
  unit?: string;
  pointsMultiplier?: number;
}

export interface MatchupCardConfig {
  autoIcon?: string;
  autoMetrics: MetricDisplayConfig[];
  teleopIcon?: string;
  teleopMetrics: MetricDisplayConfig[];
  endgame: {
    stateKey?: string;
    bestClimbKey?: string;
    states: {
      key: string;
      label: string;
      threshold?: number;
    }[];
  };
  warnings?: {
    breakdownThreshold?: number;
    foulThreshold?: number;
    techFoulThreshold?: number;
    majorPenaltyThreshold?: number;
    minorPenaltyThreshold?: number;
  };
  playstyleKey?: string;
  pitHighlights?: {
    section: "autonomous" | "teleoperated" | "endgame" | "driveTeam";
    field: string;
    label: string;
    unit?: string;
  }[];
}

export interface TeamPageConfig {
  kpis: {
    auto: {
      key: string;
      label: string;
      subKey?: string;
      subLabel?: string;
      subFormat?: "percent" | "number";
      icon?: string;
    };
    teleop: {
      key: string;
      label: string;
      subKey?: string;
      subLabel?: string;
      subFormat?: "percent" | "number";
      icon?: string;
    };
  };
  autoPerformance: {
    metrics: MetricDisplayConfig[];
    showPointsEstimate?: boolean;
    pointsFormula?: { key: string; points: number }[];
  };
  teleopPerformance: {
    metrics: MetricDisplayConfig[];
    showPointsEstimate?: boolean;
    pointsFormula?: { key: string; points: number }[];
  };
  scoringBreakdownChart: {
    title: string;
    description: string;
    unit?: string;
    items: {
      name: string;
      key: string;
      fill?: string;
    }[];
  };
  endgame: {
    title: string;
    description: string;
    displayType?: "cards" | "chart";
    stateKey: string;
    breakdownKey?: string;
    states: {
      value: string;
      label: string;
      points?: number;
      highlightThreshold?: number;
      fill?: string;
    }[];
  };
  penalties: {
    title: string;
    description: string;
    minorKey: string;
    minorLabel: string;
    minorPoints: number;
    majorKey: string;
    majorLabel: string;
    majorPoints: number;
    techFoulAlertThreshold?: number;
    breakdownAlertThreshold?: number;
  };
  customSections?: {
    id: string;
    title: string;
    description?: string;
    type: "distribution" | "summaryCards";
    fieldKey?: string;
    items?: {
      key: string;
      label: string;
      pointsMultiplier?: number;
      pointsLabel?: string;
    }[];
  }[];
}

export interface YearConfig {
  competitionType: CompetitionType;
  gameName: string;
  startPositions?: string[];
  scoring: {
    autonomous: Record<string, ScoringDefinition>;
    teleop: Record<string, ScoringDefinition>;
    endgame: Record<string, ScoringDefinition>;
    fouls?: Record<string, ScoringDefinition>;
  };
  pitScouting: {
    autonomous: Record<
      string,
      {
        label: string;
        type: "text" | "number" | "boolean" | "select" | "multiselect";
        options?: string[];
        dependsOn?: string;
      }
    >;
    teleoperated: Record<
      string,
      {
        label: string;
        type: "text" | "number" | "boolean" | "select" | "multiselect";
        options?: string[];
        dependsOn?: string;
      }
    >;
    driveTeam?: Record<
      string,
      {
        label: string;
        type: "text" | "number" | "boolean" | "select" | "multiselect";
        options?: string[];
        dependsOn?: string;
      }
    >;
    endgame: Record<
      string,
      {
        label: string;
        type: "text" | "number" | "boolean" | "select" | "multiselect";
        options?: string[];
        dependsOn?: string;
      }
    >;
  };
  analysisInsights?: AnalysisInsightsConfig;
  matchupCardConfig?: MatchupCardConfig;
  teamPageConfig?: TeamPageConfig;
}

export interface GameConfig {
  FRC: {
    [year: string]: YearConfig;
  };
  FTC: {
    [year: string]: YearConfig;
  };
}
