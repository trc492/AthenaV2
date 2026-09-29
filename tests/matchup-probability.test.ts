import { describe, expect, it } from "vitest";
import { estimateWinProbability } from "../src/lib/matchup-probability";

describe("estimateWinProbability", () => {
  it("gives equal alliances equal chances and reverses when sides swap", () => {
    const stronger = [{ mean: 30, scores: [20, 30, 40] }];
    const weaker = [{ mean: 20, scores: [10, 20, 30] }];
    const equal = estimateWinProbability(stronger, stronger);
    const ahead = estimateWinProbability(stronger, weaker);
    const behind = estimateWinProbability(weaker, stronger);

    expect(equal?.red).toBeCloseTo(0.5);
    expect(ahead?.red).toBeGreaterThan(0.5);
    expect(ahead?.red).toBeCloseTo(behind!.blue);
    expect(ahead!.red + ahead!.blue).toBeCloseTo(1);
  });

  it("uses the available teams to estimate variance for a one-match team", () => {
    const result = estimateWinProbability(
      [{ mean: 30, scores: [30] }],
      [{ mean: 20, scores: [10, 30] }],
    );
    expect(result?.red).toBeGreaterThan(0.5);
    expect(result?.marginStandardDeviation).toBeGreaterThan(0);
  });

  it("withholds a percentage without data or observed variation", () => {
    expect(estimateWinProbability([{ mean: 0, scores: [] }], [{ mean: 20, scores: [10, 30] }])).toBeNull();
    expect(estimateWinProbability([{ mean: 10, scores: [10] }], [{ mean: 20, scores: [20] }])).toBeNull();
    expect(estimateWinProbability([{ mean: 10, scores: [10, 10] }], [{ mean: 20, scores: [20, 20] }])).toBeNull();
  });
});
