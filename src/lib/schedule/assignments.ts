export type UserWithPartners = {
  id: string;
  name: string;
  username: string;
  role: string;
  preferredPartners: string[];
};

export type DisplayBlock = {
  id: number;
  name: string;
  blockNumber: number;
  matches: number[];
};

export type MatchAssignment = {
  matchNumber: number;
  redScouts: (string | null)[];
  blueScouts: (string | null)[];
};

export function computeUserWorkload(matches: MatchAssignment[], users: { id: string }[]): Map<string, number> {
  const workload = new Map(users.map((user) => [user.id, 0]));
  for (const match of matches) {
    for (const scoutId of [...match.redScouts, ...match.blueScouts]) {
      if (scoutId) workload.set(scoutId, (workload.get(scoutId) ?? 0) + 1);
    }
  }
  return workload;
}

export function hasPreferredPartnerInMatch(userId: string, match: MatchAssignment, usersById: Map<string, UserWithPartners>): boolean {
  const user = usersById.get(userId);
  if (!user) return false;
  const assigned = new Set([...match.redScouts, ...match.blueScouts]);
  return user.preferredPartners.some((partner) => assigned.has(partner));
}

/** Fills open positions without changing existing assignments or the input. */
export function autoAssignMatches(matches: MatchAssignment[], blocks: DisplayBlock[], sortedActiveUsers: UserWithPartners[], scoutsPerAlliance: number): MatchAssignment[] {
  const usersById = new Map(sortedActiveUsers.map((user) => [user.id, user]));
  const draft = matches.map((match) => ({
    ...match,
    redScouts: [...match.redScouts],
    blueScouts: [...match.blueScouts],
  }));
  const indexesByMatch = new Map(draft.map((match, index) => [match.matchNumber, index]));
  const workload = computeUserWorkload(draft, sortedActiveUsers);

  for (let blockIndex = 0; blockIndex < blocks.length; blockIndex++) {
    const blockMatchIndexes = blocks[blockIndex].matches
      .map((matchNumber) => indexesByMatch.get(matchNumber) ?? -1)
      .filter((index) => index >= 0 && index < draft.length);
    if (blockMatchIndexes.length === 0) continue;

    const previousBlockScouts = new Set<string>();
    if (blockIndex > 0) {
      blocks[blockIndex - 1].matches
        .map((matchNumber) => indexesByMatch.get(matchNumber) ?? -1)
        .filter((index) => index >= 0 && index < draft.length)
        .forEach((index) => {
          [...draft[index].redScouts, ...draft[index].blueScouts].forEach(
            (scoutId) => scoutId && previousBlockScouts.add(scoutId),
          );
        });
    }

    const assignGroupSlot = (alliance: "red" | "blue", position: number) => {
      const openIndexes = blockMatchIndexes.filter((index) => {
        const slots = alliance === "red" ? draft[index].redScouts : draft[index].blueScouts;
        return slots[position] === null;
      });
      if (openIndexes.length === 0) return;

      const candidates = sortedActiveUsers.filter((candidate) =>
        openIndexes.every((index) => {
          const assigned = [...draft[index].redScouts, ...draft[index].blueScouts];
          return !assigned.includes(candidate.id);
        }),
      );
      const representativeMatch = draft[openIndexes[0]];
      candidates.sort((a, b) => {
        const score = (candidate: UserWithPartners) => [
          previousBlockScouts.has(candidate.id) ? 1 : 0,
          workload.get(candidate.id) ?? 0,
          hasPreferredPartnerInMatch(candidate.id, representativeMatch, usersById) ? 0 : 1,
          sortedActiveUsers.findIndex((user) => user.id === candidate.id),
        ];
        const aScore = score(a);
        const bScore = score(b);
        for (let index = 0; index < aScore.length; index++) {
          if (aScore[index] !== bScore[index]) return aScore[index] - bScore[index];
        }
        return 0;
      });

      const best = candidates[0];
      if (!best) return;
      openIndexes.forEach((index) => {
        const slots = alliance === "red" ? draft[index].redScouts : draft[index].blueScouts;
        slots[position] = best.id;
        workload.set(best.id, (workload.get(best.id) ?? 0) + 1);
      });
    };

    for (let pos = 0; pos < scoutsPerAlliance; pos++) assignGroupSlot("red", pos);
    for (let pos = 0; pos < scoutsPerAlliance; pos++) assignGroupSlot("blue", pos);
  }

  return draft;
}
