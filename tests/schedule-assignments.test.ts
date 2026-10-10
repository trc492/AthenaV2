import { describe, expect, it } from "vitest";
import { autoAssignMatches, computeUserWorkload, type MatchAssignment, type UserWithPartners } from "@/lib/schedule/assignments";

const users: UserWithPartners[] = ["a", "b", "c", "d"].map((id) => ({ id, name: id, username: id, role: "scout", preferredPartners: [] }));
const match = (matchNumber: number): MatchAssignment => ({ matchNumber, redScouts: [null], blueScouts: [null] });
const block = (matches: number[]) => ({ id: 1, name: "Group", blockNumber: 1, matches });
describe("schedule assignment domain", () => {
  it("fills nonconsecutive match numbers without mutating the input", () => {
    const original = [match(10), match(20)];
    const filled = autoAssignMatches(original, [block([10, 20])], users, 1);
    expect(filled.map((row) => [row.redScouts, row.blueScouts])).toEqual([
      [["a"], ["b"]], [["a"], ["b"]],
    ]);
    expect(original).toEqual([match(10), match(20)]);
  });
  it("preserves assigned positions and never assigns a scout twice in one match", () => {
    const original = { ...match(1), redScouts: ["a"] };
    const [filled] = autoAssignMatches([original], [block([1])], users, 1);
    expect(filled.redScouts).toEqual(["a"]);
    expect(filled.blueScouts).toEqual(["b"]);
  });
  it("leaves positions open when no eligible scout is available", () => {
    const [filled] = autoAssignMatches([match(1)], [block([1])], users.slice(0, 1), 1);
    expect(filled.redScouts).toEqual(["a"]);
    expect(filled.blueScouts).toEqual([null]);
  });
  it("rotates scouts between groups and counts existing workload", () => {
    const filled = autoAssignMatches([match(1), match(2)], [block([1]), { ...block([2]), id: 2 }], users, 1);
    expect(filled[1].redScouts).toEqual(["c"]);
    expect(filled[1].blueScouts).toEqual(["d"]);
    expect([...computeUserWorkload(filled, users).values()]).toEqual([1, 1, 1, 1]);
  });
});
