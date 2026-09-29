export interface TeamScoreHistory {
  mean: number;
  scores: number[];
}

export interface WinProbability {
  red: number;
  blue: number;
  marginStandardDeviation: number;
}

// Normal approximation to the CDF, accurate enough for percentage display.
function normalCdf(value: number): number {
  const x = Math.abs(value);
  const t = 1 / (1 + 0.2316419 * x);
  const density = Math.exp(-x * x / 2) / Math.sqrt(2 * Math.PI);
  const tail = density * t * (0.319381530 + t * (-0.356563782 + t * (1.781477937 + t * (-1.821255978 + t * 1.330274429))));
  return value >= 0 ? 1 - tail : tail;
}

export function estimateWinProbability(
  red: TeamScoreHistory[],
  blue: TeamScoreHistory[],
): WinProbability | null {
  const teams = [...red, ...blue];
  if (!red.length || !blue.length || teams.some((team) =>
    !Number.isFinite(team.mean) || !team.scores.length ||
    team.scores.some((score) => !Number.isFinite(score))
  )) return null;

  const sampleVariances = teams.map((team) => {
    if (team.scores.length < 2) return null;
    const sampleMean = team.scores.reduce((sum, score) => sum + score, 0) / team.scores.length;
    return team.scores.reduce((sum, score) => sum + (score - sampleMean) ** 2, 0) / (team.scores.length - 1);
  });
  const measured = sampleVariances.filter((value): value is number => value !== null);
  if (!measured.length) return null;

  // A shared variance stabilizes estimates from teams with few scouted matches.
  const pooledVariance = measured.reduce((sum, variance) => sum + variance, 0) / measured.length;
  const teamVariances = teams.map((team, index) => {
    const degreesOfFreedom = team.scores.length - 1;
    const variance = sampleVariances[index] ?? pooledVariance;
    const shrunkVariance = (degreesOfFreedom * variance + 3 * pooledVariance) / (degreesOfFreedom + 3);
    // Predictive variance includes uncertainty in the estimated team mean.
    return shrunkVariance * (1 + 1 / team.scores.length);
  });
  const marginVariance = teamVariances.reduce((sum, variance) => sum + variance, 0);
  if (!(marginVariance > 0)) return null;

  const redMean = red.reduce((sum, team) => sum + team.mean, 0);
  const blueMean = blue.reduce((sum, team) => sum + team.mean, 0);
  const redProbability = normalCdf((redMean - blueMean) / Math.sqrt(marginVariance));
  return {
    red: redProbability,
    blue: 1 - redProbability,
    marginStandardDeviation: Math.sqrt(marginVariance),
  };
}
