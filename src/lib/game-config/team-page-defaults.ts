import type { TeamPageConfig, YearConfig } from "@/lib/types";

/** Defaults must reference the game being edited, including custom games. */
export function buildTeamPageDefaults(config: YearConfig): TeamPageConfig {
  const metrics = (section: "autonomous" | "teleop") =>
    Object.entries(config.scoring[section] || {}).map(([key, field]) => ({
      key: `${section}.${key}`, label: field.label,
    }));
  const auto = metrics("autonomous");
  const teleop = metrics("teleop");
  const state = Object.entries(config.scoring.endgame || {}).find(([, field]) => field.pointValues);
  const fouls = Object.entries(config.scoring.fouls || {});
  return {
    kpis: {
      auto: { ...(auto[0] || { key: "", label: "Autonomous" }), format: "number" },
      teleop: { ...(teleop[0] || { key: "", label: "Teleop" }), format: "number" },
    },
    autoPerformance: { metrics: auto, showPointsEstimate: true },
    teleopPerformance: { metrics: teleop, showPointsEstimate: true },
    scoringBreakdownChart: {
      title: "Scoring Breakdown", description: "Average actions per match",
      items: [...auto, ...teleop].map((metric) => ({ name: metric.label, key: metric.key })),
    },
    endgame: {
      title: "Endgame Distribution", description: "Endgame state frequencies",
      stateKey: state ? `endgame.${state[0]}` : "", displayType: "chart",
      states: Object.entries(state?.[1].pointValues || {}).map(([value, points]) => ({ value, label: value, points })),
    },
    penalties: {
      title: "Reliability & Penalties", description: "Robot reliability and penalty averages",
      minorKey: fouls[0] ? `fouls.${fouls[0][0]}` : "",
      minorLabel: fouls[0]?.[1].label || "Minor Fouls", minorPoints: fouls[0]?.[1].points ?? 0,
      majorKey: fouls[1] ? `fouls.${fouls[1][0]}` : "",
      majorLabel: fouls[1]?.[1].label || "Major Fouls", majorPoints: fouls[1]?.[1].points ?? 0,
    },
  };
}
