import type { MatchEntry, TeamStats, EPABreakdown, YearConfig, ScoringDefinition, TeamData, PitEntry } from "../lib/types";

/**
 * Calculate Expected Points Added (EPA) for a team based on their match performance
 * EPA represents how many points a team contributes on average
 */
export function calculateEPA(
  matches: MatchEntry[],
  year: number,
  config: YearConfig,
): EPABreakdown {
  if (matches.length === 0) {
    return { auto: 0, teleop: 0, endgame: 0, penalties: 0, totalEPA: 0 };
  }

  let totalAutoPoints = 0;
  let totalTeleopPoints = 0;
  let totalEndgamePoints = 0;
  let totalPenaltiesPoints = 0;

  for (const match of matches) {
    const autoPoints = calculatePeriodPoints(
      (match.gameSpecificData?.autonomous as Record<
        string,
        number | string | boolean
      >) || {},
      config.scoring.autonomous,
    );
    const teleopPoints = calculatePeriodPoints(
      (match.gameSpecificData?.teleop as Record<
        string,
        number | string | boolean
      >) || {},
      config.scoring.teleop,
    );
    const endgamePoints = calculatePeriodPoints(
      (match.gameSpecificData?.endgame as Record<
        string,
        number | string | boolean
      >) || {},
      config.scoring.endgame,
    );
    const penaltiesPoints = calculatePeriodPoints(
      (match.gameSpecificData?.fouls as Record<
        string,
        number | string | boolean
      >) || {},
      config.scoring.fouls || {},
    );

    totalAutoPoints += autoPoints;
    totalTeleopPoints += teleopPoints;
    totalEndgamePoints += endgamePoints;
    totalPenaltiesPoints += penaltiesPoints;
  }

  const matchCount = matches.length;
  const auto = isNaN(totalAutoPoints / matchCount)
    ? 0
    : totalAutoPoints / matchCount;
  const teleop = isNaN(totalTeleopPoints / matchCount)
    ? 0
    : totalTeleopPoints / matchCount;
  const endgame = isNaN(totalEndgamePoints / matchCount)
    ? 0
    : totalEndgamePoints / matchCount;
  const penalties = isNaN(totalPenaltiesPoints / matchCount)
    ? 0
    : totalPenaltiesPoints / matchCount;
  const totalEPA = isNaN(auto + teleop + endgame + penalties)
    ? 0
    : auto + teleop + endgame + penalties;

  return { auto, teleop, endgame, penalties, totalEPA };
}

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
function calculatePeriodPoints(
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

/**
 * Calculate comprehensive team statistics
 */
export function calculateTeamStats(
  matches: MatchEntry[],
  year: number,
  config: YearConfig,
): TeamStats {
  if (matches.length === 0) {
    return {
      totalMatches: 0,
      avgScore: 0,
      epa: 0,
      autoStats: {},
      teleopStats: {},
      endgameStats: {},
    };
  }

  const epaBreakdown = calculateEPA(matches, year, config);
  const autoStats = calculatePeriodAverages(matches, "autonomous");
  const teleopStats = calculatePeriodAverages(matches, "teleop");
  const endgameStats = calculatePeriodAverages(matches, "endgame");

  return {
    totalMatches: matches.length,
    avgScore: epaBreakdown.totalEPA,
    epa: epaBreakdown.totalEPA,
    autoStats,
    teleopStats,
    endgameStats,
  };
}

/**
 * Calculate averages for a specific period across all matches
 */
function calculatePeriodAverages(
  matches: MatchEntry[],
  period: string,
): Record<string, number> {
  const totals: Record<string, number> = {};
  const counts: Record<string, number> = {};

  for (const match of matches) {
    const periodData = match.gameSpecificData?.[period] || {};

    for (const [action, value] of Object.entries(periodData)) {
      if (typeof value === "number") {
        totals[action] = (totals[action] || 0) + value;
        counts[action] = (counts[action] || 0) + 1;
      }
    }
  }

  const averages: Record<string, number> = {};
  for (const action in totals) {
    averages[action] = counts[action] > 0 ? totals[action] / counts[action] : 0;
  }

  return averages;
}

/**
 * Calculate team rankings based on EPA
 */
export function calculateTeamRankings(
  allMatches: MatchEntry[],
  year: number,
  config: YearConfig,
): Array<{ teamNumber: number; epa: number; rank: number }> {
  // Group matches by team
  const teamMatches = new Map<number, MatchEntry[]>();
  for (const match of allMatches) {
    if (!teamMatches.has(match.teamNumber)) {
      teamMatches.set(match.teamNumber, []);
    }
    teamMatches.get(match.teamNumber)!.push(match);
  }

  // Calculate EPA for each team
  const teamEPAs = Array.from(teamMatches.entries()).map(
    ([teamNumber, matches]) => {
      const epa = calculateEPA(matches, year, config);
      return { teamNumber, epa: epa.totalEPA, matches: matches.length };
    },
  );

  // Sort by EPA (descending) and assign ranks
  teamEPAs.sort((a, b) => b.epa - a.epa);
  return teamEPAs.map((team, index) => ({
    teamNumber: team.teamNumber,
    epa: team.epa,
    rank: index + 1,
  }));
}

/**
 * Get percentile ranking for a team
 */
export function getTeamPercentile(
  teamNumber: number,
  allMatches: MatchEntry[],
  year: number,
  config: YearConfig,
): number {
  const rankings = calculateTeamRankings(allMatches, year, config);
  const teamRank = rankings.find((r) => r.teamNumber === teamNumber);
  if (!teamRank) return 0;
  return Math.round((1 - (teamRank.rank - 1) / rankings.length) * 100);
}

/**
 * Format numbers for display with appropriate precision
 */
export function formatStat(value: number, decimals: number = 1): string {
  return value.toFixed(decimals);
}

/**
 * Calculate consistency score (lower is more consistent)
 */
export function calculateConsistency(
  matches: MatchEntry[],
  year: number,
  config: YearConfig,
): number {
  if (matches.length < 2) return 0;
  const epas = matches.map((match) => {
    const singleMatchEPA = calculateEPA([match], year, config);
    return singleMatchEPA.totalEPA;
  });
  const mean = epas.reduce((sum, epa) => sum + epa, 0) / epas.length;
  const variance =
    epas.reduce((sum, epa) => sum + Math.pow(epa - mean, 2), 0) / epas.length;
  const standardDeviation = Math.sqrt(variance);
  // Return coefficient of variation (CV) as consistency score
  return mean !== 0 ? standardDeviation / Math.abs(mean) : 0;
}

/**
 * Scouter Performance Rating (SPR) result for a single scouter
 */
export interface ScouterPerformance {
  scouterId: string;
  errorValue: number; // Average error contribution (lower is better)
  matchesScounted: number; // Number of matches this scouter has data for
  percentile: number; // Percentile ranking (100 = best, 0 = worst)
  totalAbsoluteError: number; // Sum of absolute errors across all matches
}

/**
 * Verbose data for a single alliance equation
 */
export interface AllianceEquationData {
  matchNumber: number;
  alliance: "red" | "blue";
  scouterIds: string[];
  robotCount: number;
  expectedRobots: number;
  scoutedTotal: number;
  officialScore: number;
  foulPoints: number;
  adjustedOfficial: number;
  error: number;
  skipped: boolean;
  skipReason?: string;
}

/**
 * Result of the scouter accuracy analysis
 */
export interface ScouterAccuracyResult {
  scouters: ScouterPerformance[];
  overallMeanError: number; // Average error across all matches
  convergenceAchieved: boolean; // Whether the least-squares solution converged
  message?: string; // Additional info or warnings
  verboseData?: {
    equations: AllianceEquationData[];
    totalEquations: number;
    skippedEquations: number;
    usedEquations: number;
  };
}

/**
 * Calculate Scouter Performance Rating (SPR) - Similar to OPR but for scouter accuracy
 *
 * This function uses least-squares optimization to estimate each scouter's contribution to
 * scoring errors by comparing scouted data against official match results.
 *
 * **Algorithm Overview (inspired by OPR methodology):**
 *
 * 1. **Problem Setup**: For each match alliance, we have:
 *    - 3 scouters (one per robot) with unknown "error values" (U, V, W)
 *    - Sum of contributed points calculated from scouted data
 *    - Official alliance score from FRC/TBA (minus foul points awarded by opponent)
 *    - Observed error = |scoutedTotal - officialScore|
 *
 * 2. **Overdetermined System**: With N scouters and M matches (where M >> N):
 *    - Each match creates one equation: scouterU + scouterV + scouterW = observedError
 *    - We get 2M equations (one per alliance per match) for N unknowns
 *
 * 3. **Least-Squares Solution**: Solve using normal equations: (A^T × A) × x = A^T × b
 *    - A is the coefficient matrix (which scouters were in each alliance)
 *    - b is the observed error vector
 *    - x is the solution vector (error contribution per scouter)
 *
 * **Key Differences from OPR:**
 * - Lower values are better (less error contribution)
 * - Uses signed error during equation solving, but aggregates on absolute values for rankings
 * - Subtracts foul points from official scores (fouls aren't related to robot actions scouters observe)
 *
 * **Interpretation:**
 * - Scouters with <10 matches should be treated cautiously (insufficient data)
 * - Focus on relative comparisons rather than absolute values
 * - Top 25-50% performers are doing well
 *
 * @param matches - Array of match entries with userId (scouterId) populated
 * @param officialResults - Map of matchNumber -> { alliance -> officialScore, foulPoints }
 * @param config - Year configuration for scoring calculation
 * @returns ScouterAccuracyResult with per-scouter error metrics and rankings
 *
 * @example
 * ```typescript
 * const officialResults = new Map([
 *   [1, {
 *     red: { officialScore: 125, foulPoints: 10 },
 *     blue: { officialScore: 98, foulPoints: 5 }
 *   }],
 *   // ... more matches
 * ]);
 *
 * const result = computeScouterAccuracy(matchEntries, officialResults, yearConfig);
 * console.log(`Top performer: ${result.scouters[0].scouterId} with error value ${result.scouters[0].errorValue}`);
 * ```
 */
export function computeScouterAccuracy(
  matches: MatchEntry[],
  officialResults: Map<
    number,
    {
      red: { officialScore: number; foulPoints: number };
      blue: { officialScore: number; foulPoints: number };
    }
  >,
  config: YearConfig,
  options?: {
    /**
     * Expected number of robots per alliance. Defaults to competition type: FRC = 3, FTC = 2, otherwise 3.
     */
    expectedAllianceSize?: number;
    /**
     * When true, alliances with fewer than the expected number of robots are skipped to avoid skewed errors.
     */
    skipIncompleteAlliances?: boolean;
    /**
     * When true, includes detailed data about each alliance equation in the result.
     */
    verbose?: boolean;
  },
): ScouterAccuracyResult {
  const expectedAllianceSize =
    options?.expectedAllianceSize ??
    (config.competitionType?.toUpperCase() === "FTC" ? 2 : 3);
  const skipIncompleteAlliances = options?.skipIncompleteAlliances ?? true;
  const verbose = options?.verbose ?? false;

  // Verbose data collection
  const verboseEquations: AllianceEquationData[] = [];

  // Filter matches that have userId (scouterId) and official results
  const validMatches = matches.filter(
    (m) => m.userId && officialResults.has(m.matchNumber),
  );
  if (validMatches.length === 0) {
    return {
      scouters: [],
      overallMeanError: 0,
      convergenceAchieved: false,
      message: "No valid match data with scouter IDs and official results",
    };
  }

  // Build unique scouter list
  const scouterSet = new Set<string>();
  validMatches.forEach((m) => {
    if (m.userId) scouterSet.add(m.userId);
  });
  const scouters = Array.from(scouterSet).sort();

  if (scouters.length === 0) {
    return {
      scouters: [],
      overallMeanError: 0,
      convergenceAchieved: false,
      message: "No scouters found in match data",
    };
  }

  // Create scouter index map for matrix construction
  const scouterIndex = new Map<string, number>();
  scouters.forEach((id, idx) => scouterIndex.set(id, idx));

  // Group matches by matchNumber and alliance to create equations
  const allianceGroups = new Map<string, MatchEntry[]>();
  validMatches.forEach((match) => {
    const key = `${match.matchNumber}-${match.alliance}`;
    if (!allianceGroups.has(key)) {
      allianceGroups.set(key, []);
    }
    allianceGroups.get(key)!.push(match);
  });

  // Build coefficient matrix A and observation vector b
  const equations: { scouterIndices: number[]; observedError: number }[] = [];

  allianceGroups.forEach((allianceMatches, key) => {
    const [matchNumStr, alliance] = key.split("-");
    const matchNumber = parseInt(matchNumStr);
    const allianceKey = alliance as "red" | "blue";

    const officialData = officialResults.get(matchNumber);
    const robotCount = allianceMatches.length;
    const scouterIdsInAlliance = allianceMatches
      .map((m) => m.userId!)
      .filter(Boolean);

    // Check if we should skip this alliance
    const isIncomplete = robotCount < expectedAllianceSize;
    const shouldSkip = skipIncompleteAlliances && isIncomplete;
    const noOfficialData = !officialData;

    if (shouldSkip || noOfficialData) {
      // Record skipped equation in verbose data
      if (verbose) {
        verboseEquations.push({
          matchNumber,
          alliance: allianceKey,
          scouterIds: scouterIdsInAlliance,
          robotCount,
          expectedRobots: expectedAllianceSize,
          scoutedTotal: 0,
          officialScore: officialData?.[allianceKey]?.officialScore ?? 0,
          foulPoints: officialData?.[allianceKey]?.foulPoints ?? 0,
          adjustedOfficial: 0,
          error: 0,
          skipped: true,
          skipReason: noOfficialData
            ? "No official data"
            : `Incomplete alliance (${robotCount}/${expectedAllianceSize} robots)`,
        });
      }
      return;
    }

    const allianceOfficial = officialData[allianceKey];
    // Foul points are awarded TO the opposing alliance, so subtract opponent's fouls from this alliance's score
    const oppositeAllianceKey = allianceKey === "red" ? "blue" : "red";
    const opponentFoulPoints = officialData[oppositeAllianceKey].foulPoints;
    const adjustedOfficialScore =
      allianceOfficial.officialScore - opponentFoulPoints;

    // Calculate total contributed points from scouted data
    let scoutedTotal = 0;
    const scouterIndicesInAlliance: number[] = [];

    allianceMatches.forEach((match) => {
      const epa = calculateEPA([match], match.year, config);
      scoutedTotal += epa.totalEPA - epa.penalties; // Exclude penalties from scouted total

      const idx = scouterIndex.get(match.userId!);
      if (idx !== undefined) {
        scouterIndicesInAlliance.push(idx);
      }
    });

    // Keep signed error so under- and over-counting cannot cancel
    const observedError = scoutedTotal - adjustedOfficialScore;

    // Record in verbose data
    if (verbose) {
      verboseEquations.push({
        matchNumber,
        alliance: allianceKey,
        scouterIds: scouterIdsInAlliance,
        robotCount,
        expectedRobots: expectedAllianceSize,
        scoutedTotal: Math.round(scoutedTotal),
        officialScore: allianceOfficial.officialScore,
        foulPoints: opponentFoulPoints, // Opponent's fouls that were awarded to this alliance
        adjustedOfficial: adjustedOfficialScore,
        error: Math.round(observedError),
        skipped: false,
      });
    }

    // Add equation if we have scouters
    if (scouterIndicesInAlliance.length > 0) {
      equations.push({
        scouterIndices: scouterIndicesInAlliance,
        observedError,
      });
    }
  });

  if (equations.length === 0) {
    return {
      scouters: [],
      overallMeanError: 0,
      convergenceAchieved: false,
      message: "No valid equations could be formed",
    };
  }

  // Solve using normal equations: (A^T × A) × x = A^T × b
  // A is equation count × scouter count, b is equation count × 1
  const n = scouters.length;
  const m = equations.length;

  // Initialize A^T × A (n × n matrix) and A^T × b (n × 1 vector)
  const AtA: number[][] = Array(n)
    .fill(0)
    .map(() => Array(n).fill(0));
  const Atb: number[] = Array(n).fill(0);

  // Build normal equations
  equations.forEach((eq) => {
    const { scouterIndices, observedError } = eq;

    // For each pair of scouters in this equation, increment AtA
    scouterIndices.forEach((i) => {
      scouterIndices.forEach((j) => {
        AtA[i][j] += 1;
      });
      Atb[i] += observedError;
    });
  });

  // Add ridge regularization to improve numerical stability and handle underdetermined systems
  // This adds a small value to the diagonal, ensuring the matrix is positive definite
  const lambda = 0.01; // Regularization parameter (small to avoid over-penalizing)
  for (let i = 0; i < n; i++) {
    AtA[i][i] += lambda;
  }

  const solution = solveLinearSystem(AtA, Atb);

  if (!solution) {
    // Provide diagnostic information
    const scouterMatchCounts = new Map<string, number>();
    validMatches.forEach((m) => {
      if (m.userId) {
        scouterMatchCounts.set(
          m.userId,
          (scouterMatchCounts.get(m.userId) || 0) + 1,
        );
      }
    });

    // Check for isolated scouters (those who don't share matches with others)
    const sharedMatches = new Set<number>();
    allianceGroups.forEach((allianceMatches) => {
      if (allianceMatches.length > 1) {
        allianceMatches.forEach((m) => sharedMatches.add(m.matchNumber));
      }
    });

    const diagnosticInfo = [
      `Matrix is singular - cannot solve for ${n} scouters with ${m} equations`,
      `Scouters: ${n}, Equations: ${m}, Matches: ${validMatches.length}`,
      `Shared matches (with multiple scouters): ${sharedMatches.size}`,
      "Try: (1) More matches with official results, (2) Ensure scouters scout same matches, (3) More overlap between scouters",
    ];

    return {
      scouters: [],
      overallMeanError: 0,
      convergenceAchieved: false,
      message: diagnosticInfo.join("\n"),
    };
  }

  // Calculate match counts per scouter
  const matchCounts = new Map<string, number>();
  validMatches.forEach((m) => {
    if (m.userId) {
      matchCounts.set(m.userId, (matchCounts.get(m.userId) || 0) + 1);
    }
  });

  // Calculate total absolute error per scouter (for additional metric)
  const totalErrors = new Map<string, number>();
  equations.forEach((eq) => {
    const errorPerScouter =
      Math.abs(eq.observedError) / eq.scouterIndices.length;
    eq.scouterIndices.forEach((idx) => {
      const scouterId = scouters[idx];
      totalErrors.set(
        scouterId,
        (totalErrors.get(scouterId) || 0) + errorPerScouter,
      );
    });
  });

  // Build results
  const scouterPerformances: ScouterPerformance[] = scouters.map(
    (scouterId, idx) => {
      const rawError = solution[idx];
      return {
        scouterId,
        errorValue: Math.abs(rawError),
        matchesScounted: matchCounts.get(scouterId) || 0,
        percentile: 0, // Will calculate after sorting
        totalAbsoluteError: totalErrors.get(scouterId) || 0,
      };
    },
  );

  // Sort by error value (ascending - lower is better)
  scouterPerformances.sort((a, b) => a.errorValue - b.errorValue);

  // Assign percentiles (100 = best, 0 = worst).
  // Use (n - 1) spacing so the last ranked scouter maps to 0 instead of ~100/n.
  if (scouterPerformances.length === 1) {
    scouterPerformances[0].percentile = 100;
  } else {
    const denominator = scouterPerformances.length - 1;
    scouterPerformances.forEach((perf, idx) => {
      perf.percentile = Math.round((1 - idx / denominator) * 100);
    });
  }

  // Calculate overall mean error (absolute so magnitude reflects deviation)
  const overallMeanError =
    equations.reduce((sum, eq) => sum + Math.abs(eq.observedError), 0) /
    equations.length;

  const lowSampleWarning = scouterPerformances.some(
    (s) => s.matchesScounted < 10,
  )
    ? "Warning: Some scouters have fewer than 10 matches - results may be unreliable"
    : undefined;

  // Build verbose data summary
  const verboseDataResult = verbose
    ? {
        equations: verboseEquations.sort(
          (a, b) =>
            a.matchNumber - b.matchNumber ||
            a.alliance.localeCompare(b.alliance),
        ),
        totalEquations: verboseEquations.length,
        skippedEquations: verboseEquations.filter((e) => e.skipped).length,
        usedEquations: verboseEquations.filter((e) => !e.skipped).length,
      }
    : undefined;

  return {
    scouters: scouterPerformances,
    overallMeanError,
    convergenceAchieved: true,
    message: lowSampleWarning,
    verboseData: verboseDataResult,
  };
}

/**
 * Solve a system of linear equations Ax = b using Gaussian elimination with partial pivoting
 *
 * @param A - Coefficient matrix (n × n)
 * @param b - Right-hand side vector (n × 1)
 * @returns Solution vector x, or null if system is singular
 */
function solveLinearSystem(A: number[][], b: number[]): number[] | null {
  const n = A.length;

  // Create augmented matrix [A | b]
  const augmented: number[][] = A.map((row, i) => [...row, b[i]]);

  // Forward elimination with partial pivoting
  for (let col = 0; col < n; col++) {
    // Find pivot
    let maxRow = col;
    for (let row = col + 1; row < n; row++) {
      if (Math.abs(augmented[row][col]) > Math.abs(augmented[maxRow][col])) {
        maxRow = row;
      }
    }

    // Swap rows
    if (maxRow !== col) {
      [augmented[col], augmented[maxRow]] = [augmented[maxRow], augmented[col]];
    }

    // Check for singular matrix
    if (Math.abs(augmented[col][col]) < 1e-10) {
      return null;
    }

    // Eliminate column entries below pivot
    for (let row = col + 1; row < n; row++) {
      const factor = augmented[row][col] / augmented[col][col];
      for (let j = col; j <= n; j++) {
        augmented[row][j] -= factor * augmented[col][j];
      }
    }
  }

  // Back substitution
  const solution: number[] = Array(n).fill(0);
  for (let i = n - 1; i >= 0; i--) {
    solution[i] = augmented[i][n];
    for (let j = i + 1; j < n; j++) {
      solution[i] -= augmented[i][j] * solution[j];
    }
    solution[i] /= augmented[i][i];
  }

  return solution;
}

/**
 * Detailed game statistics structure computed dynamically from year configs and match data
 */
export interface DetailedGameStats {
  matchCount: number;
  epa: number;
  averages: Record<string, number>;
  rates: Record<string, number>;
  ratios: Record<string, number>;
  points: {
    autoEstimatedPoints: number;
    teleopEstimatedPoints: number;
    penaltyPoints: number;
  };
  bestEndgame: string;
  bestClimb: string;
  getMetricValue: (key: string) => number;
}

/**
 * Calculate detailed game statistics for a team based on year configuration
 */
export function calculateDetailedGameStats(
  matches: MatchEntry[] | undefined,
  config: YearConfig,
  teamData?: TeamData | null,
): DetailedGameStats | null {
  if (!matches || matches.length === 0) return null;

  const count = matches.length;
  const numTotals: Record<string, number> = {};
  const boolCounts: Record<string, number> = {};
  const enumCounts: Record<string, Record<string, number>> = {};

  for (const match of matches) {
    const periods = ["autonomous", "teleop", "endgame", "fouls"] as const;

    for (const period of periods) {
      const data =
        (match.gameSpecificData?.[period] as Record<
          string,
          number | string | boolean
        >) || {};

      for (const [rawKey, val] of Object.entries(data)) {
        const fullKey = `${period}.${rawKey}`;
        const shortKey = rawKey;

        if (typeof val === "number" || (!isNaN(Number(val)) && typeof val === "string" && val.trim() !== "")) {
          const num = Number(val);
          numTotals[fullKey] = (numTotals[fullKey] || 0) + num;
          numTotals[shortKey] = (numTotals[shortKey] || 0) + num;
        } else if (typeof val === "boolean") {
          if (val) {
            boolCounts[fullKey] = (boolCounts[fullKey] || 0) + 1;
            boolCounts[shortKey] = (boolCounts[shortKey] || 0) + 1;
          }
        } else if (typeof val === "string" && val !== "") {
          if (!enumCounts[fullKey]) enumCounts[fullKey] = {};
          if (!enumCounts[shortKey]) enumCounts[shortKey] = {};
          enumCounts[fullKey][val] = (enumCounts[fullKey][val] || 0) + 1;
          enumCounts[shortKey][val] = (enumCounts[shortKey][val] || 0) + 1;
        }
      }
    }
  }

  const averages: Record<string, number> = {};
  for (const [k, v] of Object.entries(numTotals)) {
    averages[k] = parseFloat((v / count).toFixed(1));
  }

  const rates: Record<string, number> = {};
  for (const [k, v] of Object.entries(boolCounts)) {
    rates[k] = parseFloat(((v / count) * 100).toFixed(1));
  }

  for (const [fieldKey, states] of Object.entries(enumCounts)) {
    for (const [stateVal, stateCount] of Object.entries(states)) {
      const rateKey = `${fieldKey}.${stateVal}`;
      rates[rateKey] = parseFloat(((stateCount / count) * 100).toFixed(1));
    }
  }

  // Precompute specific composite metrics
  const ratios: Record<string, number> = {};

  // Fuel accuracy
  const totalTeleopFuelAttempts =
    (numTotals["teleop.fuel_scored"] || 0) +
    (numTotals["teleop.fuel_missed"] || 0);
  if (totalTeleopFuelAttempts > 0) {
    ratios["teleop.fuel_accuracy"] = parseFloat(
      (
        ((numTotals["teleop.fuel_scored"] || 0) / totalTeleopFuelAttempts) *
        100
      ).toFixed(1),
    );
  } else {
    ratios["teleop.fuel_accuracy"] = 0;
  }

  // Coral / Algae aggregates
  averages["calculated.auto_coral"] = parseFloat(
    (
      ((numTotals["autonomous.L1_coral"] || 0) +
        (numTotals["autonomous.L2_coral"] || 0) +
        (numTotals["autonomous.L3_coral"] || 0) +
        (numTotals["autonomous.L4_coral"] || 0)) /
      count
    ).toFixed(1),
  );

  averages["calculated.auto_algae"] = parseFloat(
    (
      ((numTotals["autonomous.processor_algae"] || 0) +
        (numTotals["autonomous.net_algae"] || 0)) /
      count
    ).toFixed(1),
  );

  averages["calculated.teleop_coral"] = parseFloat(
    (
      ((numTotals["teleop.L1_coral"] || 0) +
        (numTotals["teleop.L2_coral"] || 0) +
        (numTotals["teleop.L3_coral"] || 0) +
        (numTotals["teleop.L4_coral"] || 0)) /
      count
    ).toFixed(1),
  );

  averages["calculated.teleop_algae"] = parseFloat(
    (
      ((numTotals["teleop.processor_algae"] || 0) +
        (numTotals["teleop.net_algae"] || 0)) /
      count
    ).toFixed(1),
  );

  // Artifact aggregates
  averages["calculated.auto_artifacts"] = parseFloat(
    (
      ((numTotals["autonomous.artifacts_classified"] || 0) +
        (numTotals["autonomous.artifacts_overflow"] || 0)) /
      count
    ).toFixed(1),
  );

  averages["calculated.teleop_artifacts"] = parseFloat(
    (
      ((numTotals["teleop.artifacts_classified"] || 0) +
        (numTotals["teleop.artifacts_overflow"] || 0) +
        (numTotals["teleop.artifacts_depot"] || 0)) /
      count
    ).toFixed(1),
  );

  // Determine best endgame state
  const allEndgameStates = matches.map((m) => {
    const eg = (m.gameSpecificData?.endgame as Record<string, string>) || {};
    return (
      eg.cage_climb ||
      eg.ending_robot_state ||
      eg.ending_based_state ||
      eg.climb_state ||
      "none"
    );
  });
  const stateFrequency: Record<string, number> = {};
  allEndgameStates.forEach((s) => {
    stateFrequency[s] = (stateFrequency[s] || 0) + 1;
  });
  const bestEndgame =
    Object.entries(stateFrequency).sort((a, b) => b[1] - a[1])[0]?.[0] || "none";

  // Best climb
  const l3Rate = rates["endgame.ending_robot_state.L3"] || rates["ending_robot_state.L3"] || 0;
  const l2Rate = rates["endgame.ending_robot_state.L2"] || rates["ending_robot_state.L2"] || 0;
  const l1Rate = rates["endgame.ending_robot_state.L1"] || rates["ending_robot_state.L1"] || 0;
  const bestClimb = l3Rate > 0 ? "L3" : l2Rate > 0 ? "L2" : l1Rate > 0 ? "L1" : "None";

  // Calculate estimated points
  const autoEstimatedPoints = (() => {
    if (config.teamPageConfig?.autoPerformance?.pointsFormula) {
      return config.teamPageConfig.autoPerformance.pointsFormula.reduce(
        (sum, item) => {
          const val =
            averages[item.key] ??
            (rates[item.key] != null ? rates[item.key] / 100 : 0);
          return sum + val * item.points;
        },
        0,
      );
    }
    return 0;
  })();

  const teleopEstimatedPoints = (() => {
    if (config.teamPageConfig?.teleopPerformance?.pointsFormula) {
      return config.teamPageConfig.teleopPerformance.pointsFormula.reduce(
        (sum, item) => {
          const val =
            averages[item.key] ??
            (rates[item.key] != null ? rates[item.key] / 100 : 0);
          return sum + val * item.points;
        },
        0,
      );
    }
    return 0;
  })();

  const penaltyPoints = (() => {
    if (config.teamPageConfig?.penalties) {
      const pen = config.teamPageConfig.penalties;
      const minorAvg = averages[pen.minorKey] || 0;
      const majorAvg = averages[pen.majorKey] || 0;
      return minorAvg * pen.minorPoints + majorAvg * pen.majorPoints;
    }
    return 0;
  })();

  const epa = teamData?.epa?.totalEPA || 0;

  const getMetricValue = (key: string): number => {
    if (key === "epa") return epa;
    if (key.startsWith("rates.")) {
      const sub = key.replace("rates.", "");
      return rates[sub] || 0;
    }
    if (ratios[key] !== undefined) return ratios[key];
    if (rates[key] !== undefined) return rates[key];
    if (averages[key] !== undefined) return averages[key];

    // Fallback: check stripped key
    const parts = key.split(".");
    const shortKey = parts[parts.length - 1];
    if (ratios[shortKey] !== undefined) return ratios[shortKey];
    if (rates[shortKey] !== undefined) return rates[shortKey];
    if (averages[shortKey] !== undefined) return averages[shortKey];

    return 0;
  };

  return {
    matchCount: count,
    epa,
    averages,
    rates,
    ratios,
    points: {
      autoEstimatedPoints: parseFloat(autoEstimatedPoints.toFixed(1)),
      teleopEstimatedPoints: parseFloat(teleopEstimatedPoints.toFixed(1)),
      penaltyPoints: parseFloat(penaltyPoints.toFixed(1)),
    },
    bestEndgame,
    bestClimb,
    getMetricValue,
  };
}

/**
 * Extract and deduplicate all scouting notes from team data
 */
export function extractScoutingNotes(teamData: TeamData | null | undefined): string[] {
  if (!teamData) return [];
  const notes: string[] = [];

  // Match entry notes
  if (teamData.matchEntries) {
    teamData.matchEntries.forEach((match) => {
      if (match.notes && match.notes.trim()) {
        notes.push(match.notes.trim());
      }
    });
  }

  // Pit entry notes
  if (teamData.pitEntry) {
    if (teamData.pitEntry.notes && teamData.pitEntry.notes.trim()) {
      notes.push(teamData.pitEntry.notes.trim());
    }
    const pitData = teamData.pitEntry.gameSpecificData;
    if (pitData && typeof pitData === "object") {
      Object.entries(pitData).forEach(([key, value]) => {
        if (
          key.toLowerCase().includes("note") &&
          typeof value === "string" &&
          value.trim()
        ) {
          notes.push(value.trim());
        }
      });
    }
  }

  return [...new Set(notes)];
}

