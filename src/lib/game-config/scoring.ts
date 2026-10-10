import type { ScoringDefinition } from "@/lib/types";

/**
 * Calculate points for a period (autonomous, teleop, endgame) using config
 *
 * Supports two scoring types:
 * 1. Simple scoring: { points: 5 } - awards 5 points for boolean true or multiplies by number
 * 2. Enum scoring: { pointValues: { "shallow": 3, "deep": 6, "none": 0 } } - awards based on string value
 *
 * Example match data:
 * - climbing: "deep" -> awards 6 points (enum-based)
 * - mobility: true -> awards 3 points (simple boolean)
 * - speakerNotes: 4 -> awards 4 * 2 = 8 points (simple number multiplication)
 */
export function calculatePeriodPoints(
  periodData: Record<string, number | string | boolean>,
  periodConfig: Record<string, ScoringDefinition>,
): number {
  let points = 0;
  for (const [key, value] of Object.entries(periodData)) {
    // Find config key case-insensitively
    const configKey = Object.keys(periodConfig).find(
      (k) => k.toLowerCase() === key.toLowerCase(),
    );
    if (!configKey) continue;
    const scoringDef = periodConfig[configKey];

    if (typeof value === "number") {
      // For numeric values, multiply by points (simple scoring)
      const multiplier = scoringDef.points || 0;
      if (!isNaN(multiplier) && !isNaN(value)) {
        points += value * multiplier;
      }
    } else if (typeof value === "boolean" && value) {
      // For boolean values, add points if true (simple scoring)
      const pts = scoringDef.points || 0;
      if (!isNaN(pts)) {
        points += pts;
      }
    } else if (typeof value === "string" && value !== "" && value !== "none") {
      // For string values, check if we have enum-based scoring first
      if (
        scoringDef.pointValues &&
        scoringDef.pointValues[value] !== undefined
      ) {
        const pts = scoringDef.pointValues[value];
        if (!isNaN(pts)) {
          points += pts;
        }
      } else if (scoringDef.points) {
        // Fallback to simple scoring for valid string values
        const pts = scoringDef.points;
        if (!isNaN(pts)) {
          points += pts;
        }
      }
    }
  }
  return points;
}

