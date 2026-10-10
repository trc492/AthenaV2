import type { ScoutingStore, MatchEntry, PitEntry } from "@/lib/types";

export class ScoutingError extends Error {
  constructor(public readonly status: number, message: string) {
    super(message);
    this.name = "ScoutingError";
  }
}

function requireOwnership(entry: { userId?: string } | undefined, actor: {
  userId: string;
  canEditAny: boolean;
}) {
  if (!entry) throw new ScoutingError(404, "Entry not found");
  if (entry.userId !== actor.userId && !actor.canEditAny) {
    throw new ScoutingError(403, "Forbidden - can only edit your own entries");
  }
}

/** Scouting rules are independent of HTTP and the selected database provider. */
export class ScoutingService {
  constructor(private readonly db: ScoutingStore) {}

  async createPit(entry: Omit<PitEntry, "id">): Promise<number> {
    const entries = await this.db.getAllPitEntries(entry.year, entry.eventCode, entry.competitionType);
    if (entries.some((existing) => existing.teamNumber === entry.teamNumber &&
      existing.eventCode === entry.eventCode && existing.year === entry.year &&
      existing.competitionType === entry.competitionType)) {
      throw new ScoutingError(409, `Pit scouting entry already exists for team ${entry.teamNumber} at this event`);
    }
    return this.db.addPitEntry(entry);
  }

  async createMatch(entry: Omit<MatchEntry, "id">): Promise<number> {
    const entries = await this.db.getAllMatchEntries(entry.year, entry.eventCode, entry.competitionType);
    if (entries.some((existing) => existing.teamNumber === entry.teamNumber &&
      existing.matchNumber === entry.matchNumber && existing.eventCode === entry.eventCode &&
      existing.year === entry.year && existing.competitionType === entry.competitionType)) {
      throw new ScoutingError(409, `Match scouting entry already exists for team ${entry.teamNumber} in match ${entry.matchNumber}`);
    }
    return this.db.addMatchEntry(entry);
  }

  async updatePit(id: number, updates: Partial<PitEntry>, actor: { userId: string; canEditAny: boolean }): Promise<void> {
    const entry = (await this.db.getAllPitEntries()).find((entry) => entry.id === id);
    requireOwnership(entry, actor);
    await this.db.updatePitEntry(id, updates);
  }

  async updateMatch(id: number, updates: Partial<MatchEntry>, actor: { userId: string; canEditAny: boolean }): Promise<void> {
    const entry = (await this.db.getAllMatchEntries()).find((entry) => entry.id === id);
    requireOwnership(entry, actor);
    await this.db.updateMatchEntry(id, updates);
  }
}
