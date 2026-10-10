import { auth } from "@/lib/auth/config";
import { hasPermission, PERMISSIONS } from "@/lib/auth/roles";
import { calculatePeriodPoints } from "@/lib/game-config/scoring";
import { getDbService } from "@/lib/server/db-service";
import { guestDatabase } from "@/lib/server/guest-database";
import { calculateEPA } from "@/lib/statistics";
import { AnalysisMetricDefinition, CompetitionType, EPABreakdown, MatchEntry, YearConfig } from "@/lib/types";
import { NextRequest, NextResponse } from "next/server";
import gameConfig from "../../../../../../config/game-config-loader";


type MetricValueType = AnalysisMetricDefinition["valueType"];

function flattenScoutingData(
  value: unknown,
  prefix = "",
  output: Record<string, boolean | number> = {},
): Record<string, boolean | number> {
  if (!value || typeof value !== "object" || Array.isArray(value))
    return output;

  for (const [rawKey, rawChild] of Object.entries(
    value as Record<string, unknown>,
  )) {
    const key = rawKey.replace(/\s+/g, "_");
    const nextPrefix = prefix ? `${prefix}.${key}` : key;

    if (typeof rawChild === "boolean") {
      output[nextPrefix] = rawChild;
      continue;
    }

    if (typeof rawChild === "number" && Number.isFinite(rawChild)) {
      output[nextPrefix] = rawChild;
      continue;
    }

    if (rawChild && typeof rawChild === "object" && !Array.isArray(rawChild)) {
      flattenScoutingData(rawChild, nextPrefix, output);
    }
  }

  return output;
}

function toLabelPart(segment: string): string {
  return segment
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .replace(/[_.-]+/g, " ")
    .split(" ")
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase())
    .join(" ");
}

function toMetricLabel(key: string, valueType: MetricValueType): string {
  const segments = key.split(".").filter(Boolean);

  // Always drop the first overarching segment to avoid redundant scope prefixes
  // Example: `autonomous.autonomous.climb` -> `autonomous.climb` -> label `Climb`
  if (segments.length > 1) {
    segments.shift();
  }

  const readableKey = segments.map(toLabelPart).join(" • ");
  const suffix = valueType === "rate" ? "Rate" : "Average";
  return `${readableKey} ${suffix}`;
}

function formatCategory(period?: string): string {
  if (!period) return "General";
  const normalized = period.toLowerCase();
  if (normalized === "autonomous") return "Autonomous";
  if (normalized === "teleop") return "Teleop";
  if (normalized === "endgame") return "Endgame";
  if (normalized === "fouls") return "Fouls";
  return toLabelPart(period);
}

function buildMetricDefinition(
  key: string,
  valueType: MetricValueType,
  yearConfig?: YearConfig,
): AnalysisMetricDefinition {
  const suffix = valueType === "rate" ? "Rate" : "Average";
  const segments = key.split(".").filter(Boolean);
  const period = segments[0];
  const metricKey = segments.slice(1).join(".");

  const configLabel =
    yearConfig &&
    period &&
    metricKey &&
    (
      yearConfig.scoring as Record<string, Record<string, { label?: string }>>
    )?.[period]?.[metricKey]?.label;

  const label = configLabel
    ? `${configLabel} ${suffix}`
    : toMetricLabel(key, valueType);

  return {
    key,
    label,
    category: formatCategory(period),
    valueType,
  };
}

function calculateMatchEPA(match: MatchEntry, yearConfig?: YearConfig) {
  if (!yearConfig || !match.gameSpecificData) {
    const flattened = flattenScoutingData(match.gameSpecificData);
    return Object.values(flattened).reduce<number>((sum, value) => {
      if (typeof value === "number" && Number.isFinite(value))
        return sum + value;
      return sum;
    }, 0);
  }

  const autoPoints = calculatePeriodPoints(
    (match.gameSpecificData?.autonomous as Record<
      string,
      number | string | boolean
    >) || {},
    yearConfig.scoring.autonomous,
  );
  const teleopPoints = calculatePeriodPoints(
    (match.gameSpecificData?.teleop as Record<
      string,
      number | string | boolean
    >) || {},
    yearConfig.scoring.teleop,
  );
  const endgamePoints = calculatePeriodPoints(
    (match.gameSpecificData?.endgame as Record<
      string,
      number | string | boolean
    >) || {},
    yearConfig.scoring.endgame,
  );
  const penaltiesPoints = calculatePeriodPoints(
    (match.gameSpecificData?.fouls as Record<
      string,
      number | string | boolean
    >) || {},
    yearConfig.scoring.fouls || {},
  );

  return autoPoints + teleopPoints + endgamePoints + penaltiesPoints;
}

function quantile(sortedValues: number[], q: number) {
  if (!sortedValues.length) return 0;
  const position = (sortedValues.length - 1) * q;
  const base = Math.floor(position);
  const rest = position - base;
  const next = sortedValues[base + 1];
  if (next === undefined) return sortedValues[base];
  return sortedValues[base] + rest * (next - sortedValues[base]);
}

// GET /api/scouting/analysis/analysis - Get analysis data for charts
export async function GET(request: NextRequest) {
  try {
    const session = await auth();
    if (
      !session?.user?.role ||
      !hasPermission(session.user.role, PERMISSIONS.VIEW_MATCH_SCOUTING)
    ) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
    }
    const { searchParams } = new URL(request.url);
    const year = searchParams.get("year")
      ? parseInt(searchParams.get("year")!)
      : undefined;
    const eventCode = searchParams.get("eventCode");
    const includeBoxPlot = searchParams.get("includeBoxPlot") === "true";
    const competitionType =
      (searchParams.get("competitionType") as CompetitionType) || "FRC";

    const service = guestDatabase(getDbService(), session);

    // Get all match entries for analysis, filtered by competition type
    const matchEntries = await service.getAllMatchEntries(
      year,
      undefined,
      competitionType,
    );

    // Filter by event if specified
    const filteredEntries = eventCode
      ? matchEntries.filter((entry) => entry.eventCode === eventCode)
      : matchEntries;

    // Group by scoring categories (this is a simplified example)
    const scoringCategories = ["auto", "teleop", "endgame", "total"];
    const categoryData: Record<string, number[]> = {};

    scoringCategories.forEach((category) => {
      categoryData[category] = [];
    });

    // Process each match entry
    filteredEntries.forEach((entry) => {
      if (entry.gameSpecificData) {
        scoringCategories.forEach((category) => {
          const value = entry.gameSpecificData[category];
          if (typeof value === "number") {
            categoryData[category].push(value);
          }
        });
      }
    });

    // Calculate averages for each category
    const analysisData = scoringCategories.map((category) => ({
      category,
      average:
        categoryData[category].length > 0
          ? categoryData[category].reduce((sum, val) => sum + val, 0) /
            categoryData[category].length
          : 0,
      count: categoryData[category].length,
      data: categoryData[category],
    }));

    // Calculate team-specific EPA data using proper statistics
    const teamEPAs: Record<
      number,
      {
        teamNumber: number;
        epaBreakdown: EPABreakdown;
        matches: number;
      }
    > = {};

    filteredEntries.forEach((entry) => {
      if (!teamEPAs[entry.teamNumber]) {
        teamEPAs[entry.teamNumber] = {
          teamNumber: entry.teamNumber,
          epaBreakdown: {
            auto: 0,
            teleop: 0,
            endgame: 0,
            penalties: 0,
            totalEPA: 0,
          },
          matches: 0,
        };
      }
      teamEPAs[entry.teamNumber].matches += 1;
    });

    // Calculate EPA for each team using proper function
    Object.keys(teamEPAs).forEach((teamNumberStr) => {
      const teamNumber = parseInt(teamNumberStr);
      const teamMatches = filteredEntries.filter(
        (entry) => entry.teamNumber === teamNumber,
      );

      if (
        teamMatches.length > 0 &&
        year &&
        gameConfig[competitionType] &&
        gameConfig[competitionType][year.toString()]
      ) {
        try {
          const yearConfig = gameConfig[competitionType][year.toString()];
          const epaBreakdown = calculateEPA(teamMatches, year, yearConfig);
          teamEPAs[teamNumber].epaBreakdown = epaBreakdown;
        } catch (error) {
          console.error(`Error calculating EPA for team ${teamNumber}:`, error);
          // Fallback to simple calculation
          let totalEPA = 0;
          teamMatches.forEach((match) => {
            if (match.gameSpecificData) {
              Object.values(match.gameSpecificData).forEach((value) => {
                if (typeof value === "number") {
                  totalEPA += value;
                }
              });
            }
          });
          teamEPAs[teamNumber].epaBreakdown = {
            auto: 0,
            teleop: 0,
            endgame: 0,
            penalties: 0,
            totalEPA,
          };
        }
      } else {
        // Fallback to simple calculation if no year config
        let totalEPA = 0;
        teamMatches.forEach((match) => {
          if (match.gameSpecificData) {
            Object.values(match.gameSpecificData).forEach((value) => {
              if (typeof value === "number") {
                totalEPA += value;
              }
            });
          }
        });
        teamEPAs[teamNumber].epaBreakdown = {
          auto: 0,
          teleop: 0,
          endgame: 0,
          penalties: 0,
          totalEPA,
        };
      }
    });

    // Convert to array and calculate averages
    const metricValueTypeByKey = new Map<string, MetricValueType>();
    const yearConfig: YearConfig | undefined = year
      ? gameConfig[competitionType]?.[year.toString()]
      : undefined;
    const allowedMetricKeyMap = new Map<string, string>();

    if (yearConfig) {
      Object.entries(yearConfig.scoring || {}).forEach(([period, scoring]) => {
        Object.keys(scoring || {}).forEach((metricKey) => {
          const composed = `${period}.${metricKey}`;
          allowedMetricKeyMap.set(composed.toLowerCase(), composed);
        });
      });
    }

    const teamEPAData = Object.values(teamEPAs)
      .map((team) => {
        const detailMetrics: Record<string, number> = {};
        const metricAccumulators: Record<
          string,
          {
            boolCount: number;
            trueCount: number;
            numericCount: number;
            numericSum: number;
          }
        > = {};

        let min = 0;
        let max = 0;
        let q1 = 0;
        let median = 0;
        let q3 = 0;

        const teamMatches = filteredEntries.filter(
          (entry) => entry.teamNumber === team.teamNumber,
        );

        if (includeBoxPlot) {
          const totalEPAValues = teamMatches
            .map((match) => calculateMatchEPA(match, yearConfig))
            .filter((value): value is number => Number.isFinite(value))
            .sort((a, b) => a - b);
          min = totalEPAValues[0] ?? 0;
          max = totalEPAValues[totalEPAValues.length - 1] ?? 0;
          q1 = quantile(totalEPAValues, 0.25);
          median = quantile(totalEPAValues, 0.5);
          q3 = quantile(totalEPAValues, 0.75);
        }
        teamMatches.forEach((match) => {
          const flattened = flattenScoutingData(match.gameSpecificData);
          Object.entries(flattened).forEach(([rawKey, value]) => {
            const normalizedKey = rawKey.toLowerCase();
            const canonicalKey = yearConfig
              ? allowedMetricKeyMap.get(normalizedKey)
              : rawKey;

            if (!canonicalKey) return;

            if (!metricAccumulators[canonicalKey]) {
              metricAccumulators[canonicalKey] = {
                boolCount: 0,
                trueCount: 0,
                numericCount: 0,
                numericSum: 0,
              };
            }

            if (typeof value === "boolean") {
              metricAccumulators[canonicalKey].boolCount += 1;
              if (value) metricAccumulators[canonicalKey].trueCount += 1;
            } else if (typeof value === "number" && Number.isFinite(value)) {
              metricAccumulators[canonicalKey].numericCount += 1;
              metricAccumulators[canonicalKey].numericSum += value;
            }
          });
        });

        Object.entries(metricAccumulators).forEach(([key, agg]) => {
          if (agg.numericCount > 0) {
            detailMetrics[key] = agg.numericSum / agg.numericCount;
            metricValueTypeByKey.set(key, "average");
            return;
          }

          if (agg.boolCount > 0) {
            detailMetrics[key] = (agg.trueCount / agg.boolCount) * 100;
            metricValueTypeByKey.set(key, "rate");
          }
        });

        return {
          teamNumber: team.teamNumber,
          name: `Team ${team.teamNumber}`,
          matchesPlayed: team.matches,
          totalEPA: team.epaBreakdown.totalEPA,
          autoEPA: team.epaBreakdown.auto,
          teleopEPA: team.epaBreakdown.teleop,
          endgameEPA: team.epaBreakdown.endgame,
          penaltiesEPA: team.epaBreakdown.penalties,
          totalEPAStats: includeBoxPlot
            ? {
                min,
                q1,
                median,
                q3,
                max,
              }
            : undefined,
          detailMetrics,
        };
      })
      .sort((a, b) => b.totalEPA - a.totalEPA);

    const availableMetrics: AnalysisMetricDefinition[] = Array.from(
      metricValueTypeByKey.entries(),
    )
      .map(([key, valueType]) =>
        buildMetricDefinition(key, valueType, yearConfig),
      )
      .sort((a, b) => {
        const categoryCompare = a.category.localeCompare(b.category);
        if (categoryCompare !== 0) return categoryCompare;
        return a.label.localeCompare(b.label);
      });

    return NextResponse.json({
      scoringAnalysis: analysisData,
      availableMetrics,
      teamEPAData: teamEPAData,
      totalMatches: filteredEntries.length,
      totalTeams: Object.keys(teamEPAs).length,
    });
  } catch (error) {
    console.error("Error fetching analysis data:", error);
    return NextResponse.json(
      { error: "Failed to fetch analysis data" },
      { status: 500 },
    );
  }
}
