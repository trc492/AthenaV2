import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Document, DocumentStore, DocumentChanges } from "@/db/document-store";
import { encodeDocument } from "@/db/document-store";
import { DocumentDatabaseService } from "@/db/document-database-service";
import type { MatchEntry, PitEntry } from "@/lib/types";

class MemoryStore implements DocumentStore {
  readonly collections = new Map<string, Map<string, Document>>();
  private pending = Promise.resolve();
  private collection(name: string) {
    if (!this.collections.has(name)) this.collections.set(name, new Map());
    return this.collections.get(name)!;
  }
  async list(name: string, filters: Document = {}) {
    return [...this.collection(name)].filter(([, data]) => Object.entries(filters).every(([field, value]) => data[field] === value)).map(([key, data]) => ({ key, data: structuredClone(data) }));
  }
  async get(name: string, key: string) { return structuredClone(this.collection(name).get(key)); }
  async create(name: string, key: string, data: Document) {
    if (this.collection(name).has(key)) throw Object.assign(new Error("Duplicate"), { code: 409 });
    this.collection(name).set(key, encodeDocument(data));
  }
  async remove(name: string, key: string) { this.collection(name).delete(key); }
  async transact(name: string, keys: string[], change: (documents: Map<string, Document | undefined>) => DocumentChanges) {
    const operation = this.pending.then(() => {
      const collection = this.collection(name);
      const writes = change(new Map(keys.map((key) => [key, structuredClone(collection.get(key))])));
      for (const [key, value] of writes) if (value === null) collection.delete(key); else collection.set(key, encodeDocument(value));
    });
    this.pending = operation.catch(() => undefined);
    await operation;
  }
  checkConnection = vi.fn(async () => undefined);
}
const pit: Omit<PitEntry, "id"> = { teamNumber: 254, year: 2026, competitionType: "FRC", driveTrain: "Swerve", eventCode: "2026test", gameSpecificData: { nested: { score: 12 } }, notes: undefined };
const match: Omit<MatchEntry, "id"> = { ...pit, matchNumber: 3, alliance: "red", notes: "ready", timestamp: new Date("2026-03-01T12:00:00Z") };
const account = { id: "one", name: "Scout", username: "ScoutOne", passwordHash: "hash", role: "admin" };
const scope = { eventCode: "2026test", year: 2026, competitionType: "FRC" as const };
let store: MemoryStore;
let service: DocumentDatabaseService;
beforeEach(() => { store = new MemoryStore(); service = new DocumentDatabaseService(store); });

describe("document database domain behavior", () => {
  it("serializes optional fields, buffers and legacy Firestore timestamps portably", () => {
    const date = new Date("2026-03-01T12:00:00Z");
    expect(encodeDocument({ notes: undefined, nested: { optional: undefined, score: 1 }, created_at: { toDate: () => date }, bytes: Buffer.from("image") })).toEqual({ nested: { score: 1 }, created_at: date.toISOString(), bytes: Buffer.from("image").toString("base64") });
  });
  it("round-trips numeric IDs, dates, filters, updates and deletes", async () => {
    const pitId = await service.addPitEntry(pit);
    const matchId = await service.addMatchEntry(match);
    await service.addPitEntry({ ...pit, competitionType: "FTC" });
    expect(Number.isSafeInteger(pitId)).toBe(true);
    expect(await service.getPitEntry(254, 2026, "FRC")).toMatchObject({ id: pitId, competitionType: "FRC" });
    expect(await service.getPitEntry(254, 2026, "FTC")).toMatchObject({ competitionType: "FTC" });
    expect(await service.getAllPitEntries(2025)).toEqual([]);
    expect(await service.getAllMatchEntries(2026, "other", "FRC")).toEqual([]);
    expect(await service.getMatchEntries(254, 2026, "FRC")).toMatchObject([{ id: matchId, timestamp: match.timestamp }]);
    await service.updateMatchEntry(matchId, { id: 1, notes: "changed" });
    expect(await service.getMatchEntries(254)).toMatchObject([{ id: matchId, notes: "changed" }]);
    await service.deleteMatchEntry(matchId);
    await service.deletePitEntry(pitId);
    expect(await service.checkMatchScoutExists(254, 3, "2026test")).toBe(false);
    expect(await service.getAllPitEntries(2026, undefined, "FRC")).toEqual([]);
  });
  it("does not generate duplicate IDs in rapid concurrent writes", async () => {
    vi.spyOn(Date, "now").mockReturnValue(1000);
    try {
      const ids = await Promise.all(Array.from({ length: 100 }, () => service.addPitEntry(pit)));
      expect(new Set(ids).size).toBe(ids.length);
    } finally { vi.restoreAllMocks(); }
  });
  it("exports the requested scope and imports more than 500 rows with fresh editable IDs", async () => {
    await service.addMatchEntry(match);
    await service.addMatchEntry({ ...match, year: 2025 });
    await service.addMatchEntry({ ...match, competitionType: "FTC" });
    const exported = await service.exportData(2026, "FRC");
    expect(exported.matchEntries).toHaveLength(1);
    const originalId = exported.matchEntries[0].id;
    await service.importData({ matchEntries: Array.from({ length: 501 }, () => exported.matchEntries[0]) });
    const entries = await service.getAllMatchEntries(2026, undefined, "FRC");
    expect(entries).toHaveLength(502);
    expect(new Set(entries.map((e) => e.id)).size).toBe(502);
    const imported = entries.find((e) => e.id !== originalId)!;
    await service.updateMatchEntry(imported.id!, { notes: "import edited" });
    expect(await service.getAllMatchEntries()).toContainEqual(expect.objectContaining({ id: imported.id, notes: "import edited" }));
  });
  it("preserves IDs for picklists, entries, notes and events and cascades list deletion", async () => {
    const eventId = await service.addCustomEvent({ ...scope, name: "Test", date: new Date("2026-01-01"), matchCount: 10 });
    expect(await service.getCustomEvent(scope.eventCode, "FRC")).toMatchObject({ id: eventId, date: new Date("2026-01-01") });
    const id = await service.addPicklist({ ...scope, picklistType: "main" });
    const entryId = await service.addPicklistEntry({ picklistId: id, teamNumber: 254, rank: 2 });
    await service.addPicklistEntry({ picklistId: id, teamNumber: 1678, rank: 1 });
    const noteId = await service.addPicklistNote({ picklistId: id, teamNumber: 254, note: "great" });
    expect(await service.getPicklistByEvent(scope.eventCode, 2026, "FRC", "main")).toMatchObject({ id });
    expect(await service.getPicklistNote(noteId)).toMatchObject({ id: noteId });
    await service.updatePicklistNote(noteId, { note: "updated" });
    await service.reorderPicklistEntries(id, [{ teamNumber: 254, rank: 0 }, { teamNumber: 1678, rank: 1 }]);
    expect((await service.getPicklistEntries(id))[0]).toMatchObject({ id: entryId, rank: 0 });
    await service.deletePicklist(id);
    expect(await service.getPicklistEntries(id)).toEqual([]);
    expect(await service.getPicklistNotes(id)).toEqual([]);
    expect(await service.getPicklist(id)).toBeUndefined();
  });
  it("supports credentials accounts without exposing hashes or avatars in profiles", async () => {
    await service.users.create(account);
    expect(await service.users.hasAdmin()).toBe(true);
    expect(await service.users.getByUsername("sCoUtOnE")).toMatchObject({ id: "one", password_hash: "hash" });
    await service.updateUser("one", { avatarData: Buffer.from("image"), avatarMimeType: "image/png", pushSubscriptions: "[]", passwordHash: "newhash" });
    await service.updateUserPreferredPartners("one", ["two"]);
    expect(await service.getUserPreferredPartners("one")).toEqual(["two"]);
    expect(await service.users.getAvatar("one")).toEqual({ avatarData: Buffer.from("image"), avatarMimeType: "image/png" });
    expect(await service.users.getSubscriptions()).toEqual([{ id: "one", push_subscriptions: "[]" }]);
    const profiles = await service.users.list();
    expect(profiles[0]).not.toHaveProperty("password_hash");
    expect(profiles[0]).not.toHaveProperty("avatarData");
    expect(profiles[0]).not.toHaveProperty("push_subscriptions");
    await service.users.setActive("one", false);
    await service.users.setActive("one", false);
    expect(await service.users.hasAdmin()).toBe(false);
    expect(await service.users.list()).toEqual([]);
    expect(await service.users.getByIds(["one"], true)).toEqual([]);
    expect(await service.users.getSubscriptions()).toEqual([]);
    expect(await service.users.getById("one")).toMatchObject({ sessionVersion: 1 });
    await service.users.setActive("one", true);
    expect(await service.users.getById("one")).toMatchObject({ sessionVersion: 2, deactivatedAt: null });
  });
  it("reserves case-insensitive usernames atomically and releases old names on rename", async () => {
    const results = await Promise.allSettled([service.users.create(account), service.users.create({ ...account, id: "two", username: "SCOUTONE" })]);
    expect(results.map((result) => result.status).sort()).toEqual(["fulfilled", "rejected"]);
    expect(await service.users.list()).toHaveLength(1);
    await service.updateUser("one", { username: "Renamed" });
    expect(await service.users.getByUsername("scoutone")).toBeUndefined();
    expect(await service.users.getByUsername("RENAMED")).toMatchObject({ id: "one" });
    await service.users.create({ ...account, id: "two" });
    await expect(service.updateUser("one", { username: "scoutone" })).rejects.toThrow("already in use");
    expect(await service.users.getByUsername("renamed")).toMatchObject({ id: "one" });
  });
  it("commits schedule changes atomically and rejects stale editors", async () => {
    await service.applyScheduleAssignmentChanges(scope, [{ startMatch: 1, endMatch: 3, alliance: "red", position: 0, userId: "one" }], true, []);
    const loaded = await service.getScheduleAssignments(scope);
    expect(loaded).toHaveLength(3);
    await service.applyScheduleAssignmentChanges(scope, [{ startMatch: 2, endMatch: 2, alliance: "red", position: 0, userId: null }], false, loaded);
    await expect(service.applyScheduleAssignmentChanges(scope, [], true, loaded)).rejects.toMatchObject({ name: "ScheduleConflictError" });
    expect((await service.getScheduleAssignments(scope)).map((a) => a.matchNumber)).toEqual([1, 3]);
    expect(await service.getScheduleAssignments({ ...scope, competitionType: "FTC" })).toEqual([]);
  });
  it("deletes only the custom event's year and competition scope", async () => {
    await service.addCustomEvent({ ...scope, name: "Test", date: new Date(), matchCount: 10 });
    await service.addMatchEntry(match);
    await service.addMatchEntry({ ...match, competitionType: "FTC" });
    await service.deleteCustomEvent(scope.eventCode);
    expect(await service.getAllMatchEntries()).toMatchObject([{ competitionType: "FTC" }]);
  });
  it("reset removes accounts, schedules, all entities and bearer grants", async () => {
    await service.users.create(account);
    await service.addPitEntry(pit);
    await service.applyScheduleAssignmentChanges(scope, [{ startMatch: 1, endMatch: 1, alliance: "red", position: 0, userId: "one" }]);
    await store.create("guestLinks", "guest", { id: "guest", token: "secret" });
    await service.revokeGuestLink("guest", 123);
    expect(await service.getGuestLink("guest")).toMatchObject({ revokedAt: 123 });
    expect(await service.exportData()).not.toHaveProperty("guestLinks");
    await service.resetDatabase();
    expect(await service.users.hasAdmin()).toBe(false);
    expect(await service.getGuestLinks()).toEqual([]);
    expect(await service.getAllPitEntries()).toEqual([]);
    expect(await service.getScheduleAssignments(scope)).toEqual([]);
  });
});
