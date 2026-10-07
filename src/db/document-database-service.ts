import { createHash, randomInt, randomUUID } from "node:crypto";
import type { CompetitionType, CustomEvent, DatabaseService, GuestLinkRecord, MatchEntry, Picklist, PicklistEntry, PicklistNote, PitEntry, ScheduleAssignmentChange, ScheduleAssignmentRecord, ScheduleAssignmentScope, UserCredentials, UserRecord, UserStore, UserUpdates } from "@/lib/types";
import type { Document, DocumentStore } from "./document-store";

const numericCollections = ["pitEntries", "matchEntries", "customEvents", "picklists", "picklistEntries", "picklistNotes"];
const usernameKey = (username: string) => `username-${createHash("sha256").update(username.toLowerCase()).digest("hex")}`;
const userKey = (id: string) => `user-${id}`;
const scheduleKey = (scope: ScheduleAssignmentScope) => createHash("sha256").update(JSON.stringify([scope.eventCode, scope.year, scope.competitionType])).digest("hex");
const now = () => new Date().toISOString();
function duplicateUsername(): Error {
  const error = new Error("This username is already in use");
  error.name = "DuplicateUsernameError";
  return error;
}
function profile(user: Document): UserRecord {
  const fields = ["id", "name", "username", "role", "preferredPartners", "avatarUrl", "deactivatedAt", "sessionVersion", "created_at", "updated_at"];
  return Object.fromEntries(fields.map((field) => [field, user[field]])) as unknown as UserRecord;
}
function domain<T>(data: Document): T {
  const result = { ...data };
  for (const field of ["numericId", "id", "athenaType", "athenaPartition"]) delete result[field];
  for (const field of ["timestamp", "date", "endDate", "created_at", "updated_at"]) {
    const value = result[field];
    if (value !== undefined && value !== null) {
      result[field] = typeof value === "object" && "toDate" in value
        ? (value as { toDate(): Date }).toDate() : new Date(value as string);
    }
  }
  return { ...result, id: data.numericId ?? (typeof data.id === "number" ? data.id : undefined) } as T;
}
const sortedAssignments = (rows: ScheduleAssignmentRecord[]) => [...rows].sort((a, b) => a.matchNumber - b.matchNumber || a.alliance.localeCompare(b.alliance) || a.position - b.position);
const assignmentSignature = (rows: ScheduleAssignmentRecord[]) => JSON.stringify(sortedAssignments(rows).map(({ matchNumber, alliance, position, userId }) => ({ matchNumber, alliance, position, userId })));

/** Domain behavior is identical across both document providers; no SQL emulation. */
export class DocumentDatabaseService implements DatabaseService {
  constructor(protected readonly store: DocumentStore) {}
  checkConnection() { return this.store.checkConnection(); }

  readonly users: UserStore = {
    list: async (includeInactive = false) => (await this.store.list("users", { recordType: "user" })).map((d) => profile(d.data)).filter((u) => includeInactive || !u.deactivatedAt).sort((a, b) => a.name.localeCompare(b.name)),
    getById: async (id) => {
      const data = await this.store.get("users", userKey(id));
      return data ? data as unknown as UserCredentials : undefined;
    },
    getByUsername: async (username) => {
      const claim = await this.store.get("users", usernameKey(username));
      return claim ? this.users.getById(String(claim.userId)) : undefined;
    },
    getByIds: async (ids, activeOnly = false) => {
      const users = await Promise.all([...new Set(ids)].map((id) => this.users.getById(id)));
      return users.filter((u): u is UserCredentials => !!u && (!activeOnly || !u.deactivatedAt)).map((u) => profile(u as unknown as Document));
    },
    hasAdmin: async () => (await this.users.list()).some((u) => u.role === "admin"),
    create: async (user) => {
      const key = userKey(user.id), claimKey = usernameKey(user.username);
      await this.store.transact("users", [key, claimKey], (docs) => {
        if (docs.get(claimKey)) throw duplicateUsername();
        if (docs.get(key)) throw new Error("This user ID is already in use");
        const timestamp = now();
        return new Map<string, Document | null>([
          [key, { id: user.id, recordType: "user", name: user.name, username: user.username, password_hash: user.passwordHash, role: user.role, preferredPartners: null, avatarUrl: null, avatarData: null, avatarMimeType: null, deactivatedAt: null, sessionVersion: 0, push_subscriptions: null, created_at: timestamp, updated_at: timestamp }],
          [claimKey, { recordType: "username", userId: user.id }],
        ]);
      });
    },
    setActive: async (id, active) => {
      const key = userKey(id);
      await this.store.transact("users", [key], (docs) => {
        const user = docs.get(key);
        if (!user || (!user.deactivatedAt) === active) return new Map();
        return new Map([[key, { ...user, deactivatedAt: active ? null : now(), sessionVersion: Number(user.sessionVersion ?? 0) + 1, updated_at: now() }]]);
      });
    },
    getAvatar: async (id) => {
      for (let attempt = 0; attempt < 3; attempt++) {
        const user = await this.store.get("users", userKey(id));
        if (!user) return undefined;
        if (!user.avatarKey) return { avatarData: user.avatarData ? Buffer.from(String(user.avatarData), "base64") : null, avatarMimeType: user.avatarMimeType as string | null };
        const chunks = await Promise.all(Array.from({ length: Number(user.avatarChunks) }, (_, index) => this.store.get("avatars", `${user.avatarKey}-${index}`)));
        if (chunks.every((chunk) => chunk !== undefined)) return { avatarData: Buffer.concat(chunks.map((chunk) => Buffer.from(String(chunk!.bytes), "base64"))), avatarMimeType: user.avatarMimeType as string | null };
        // A concurrent upload can retire this version while it is being read.
        const latest = await this.store.get("users", userKey(id));
        if (latest?.avatarKey === user.avatarKey) throw new Error("Avatar data is incomplete");
      }
      throw new Error("Avatar changed concurrently; retry the request");
    },
    getSubscriptions: async (id) => {
      const docs = id === undefined ? await this.store.list("users", { recordType: "user" }) : [{ key: userKey(id), data: await this.store.get("users", userKey(id)) }];
      return docs.filter((d) => d.data && !d.data.deactivatedAt && d.data.push_subscriptions != null).map((d) => ({ id: String(d.data!.id), push_subscriptions: d.data!.push_subscriptions as string | null }));
    },
  };

  async updateUser(id: string, updates: UserUpdates): Promise<void> {
    const avatarKey = updates.avatarData ? randomUUID() : null;
    const chunks = updates.avatarData ? Math.ceil(updates.avatarData.length / (256 * 1024)) : 0;
    let committed = false;
    let retiredAvatar: { key: unknown; count: unknown } | undefined;
    try {
      // Keep even the application's maximum 2 MB avatar out of account documents.
      // Readers see the new chunks only after the pointer commits atomically.
      for (let index = 0; index < chunks; index++) {
        await this.store.create("avatars", `${avatarKey}-${index}`, { bytes: updates.avatarData!.subarray(index * 256 * 1024, (index + 1) * 256 * 1024).toString("base64") });
      }
      await this.updateUserRecord(id, updates, avatarKey, chunks, (user) => {
        retiredAvatar = { key: user.avatarKey, count: user.avatarChunks };
      });
      committed = true;
    } finally {
      if (!committed && avatarKey) {
        // A transport error may hide a successful commit. Never delete chunks
        // referenced by a live account, or when that status cannot be checked.
        const unused = await this.store.get("users", userKey(id)).then((user) => user?.avatarKey !== avatarKey).catch(() => false);
        if (unused) await this.cleanupAvatar(avatarKey, chunks);
      }
    }
    if (updates.avatarData !== undefined && retiredAvatar?.key) await this.cleanupAvatar(retiredAvatar.key, retiredAvatar.count);
  }
  private async cleanupAvatar(key: unknown, count: unknown) {
    for (let index = 0; index < Number(count); index++) {
      try { await this.store.remove("avatars", `${key}-${index}`); }
      catch (error) { console.warn("Could not remove retired avatar chunk", error); }
    }
  }
  private async updateUserRecord(id: string, updates: UserUpdates, avatarKey: string | null, avatarChunks: number, rememberAvatar: (user: Document) => void): Promise<void> {
    const key = userKey(id);
    // Include the old reservation in the transaction and retry if a concurrent rename wins.
    for (let attempt = 0; attempt < 5; attempt++) {
      const existing = await this.store.get("users", key);
      if (!existing) throw new Error("User not found");
      const oldClaim = usernameKey(String(existing.username));
      const newClaim = updates.username === undefined ? oldClaim : usernameKey(updates.username);
      let renamed = false;
      await this.store.transact("users", [...new Set([key, oldClaim, newClaim])], (docs) => {
        renamed = false;
        const user = docs.get(key);
        if (!user) throw new Error("User not found");
        if (usernameKey(String(user.username)) !== oldClaim) { renamed = true; return new Map(); }
        const claim = docs.get(newClaim);
        if (newClaim !== oldClaim && claim && claim.userId !== id) throw duplicateUsername();
        const data: Document = { ...user, updated_at: now() };
        for (const [field, value] of Object.entries(updates)) {
          if (field !== "avatarData" && value !== undefined) data[field === "passwordHash" ? "password_hash" : field === "pushSubscriptions" ? "push_subscriptions" : field] = value;
        }
        if (updates.avatarData !== undefined) {
          rememberAvatar(user);
          data.avatarData = null;
          data.avatarKey = avatarKey;
          data.avatarChunks = avatarChunks;
        }
        const writes = new Map<string, Document | null>([[key, data]]);
        if (newClaim !== oldClaim) { writes.set(oldClaim, null); writes.set(newClaim, { recordType: "username", userId: id }); }
        return writes;
      });
      if (!renamed) return;
    }
    throw new Error("User changed concurrently; retry the update");
  }
  async updateUserPreferredPartners(id: string, partners: string[]) {
    const key = userKey(id);
    await this.store.transact("users", [key], (docs) => {
      const user = docs.get(key);
      if (!user) throw new Error("User not found");
      return new Map([[key, { ...user, preferredPartners: JSON.stringify(partners), updated_at: now() }]]);
    });
  }
  async getUserPreferredPartners(id: string): Promise<string[]> {
    const user = await this.store.get("users", userKey(id));
    return user?.preferredPartners ? JSON.parse(String(user.preferredPartners)) : [];
  }

  private async add(collection: string, value: object): Promise<number> {
    // 48 random bits fit exactly in JS numbers and avoid timestamp collisions
    // across processes. Create-only writes reject a storage-ID collision.
    for (let attempt = 0; attempt < 5; attempt++) {
      const numericId = randomInt(1, 2 ** 48 - 1);
      try {
        await this.store.create(collection, String(numericId), { ...value, numericId, created_at: now(), updated_at: now() });
        return numericId;
      } catch (error) {
        const code = (error as { code?: unknown }).code;
        if (code !== 409 && code !== 6 && code !== "already-exists") throw error;
      }
    }
    throw new Error("Could not allocate a unique ID");
  }
  private async rows<T>(collection: string, filters: Document = {}): Promise<T[]> {
    return (await this.store.list(collection, Object.fromEntries(Object.entries(filters).filter(([, v]) => v !== undefined)))).map((d) => domain<T>(d.data));
  }
  private async one<T>(collection: string, filters: Document): Promise<T | undefined> { return (await this.rows<T>(collection, filters))[0]; }
  private async update(collection: string, filters: Document, updates: object) {
    const safe = { ...updates } as Document;
    for (const field of ["id", "numericId", "created_at"]) delete safe[field];
    for (const doc of await this.store.list(collection, filters)) {
      await this.store.transact(collection, [doc.key], (docs) => {
        const current = docs.get(doc.key);
        return current ? new Map([[doc.key, { ...current, ...safe, updated_at: now() }]]) : new Map();
      });
    }
  }
  private async remove(collection: string, filters: Document) {
    for (const doc of await this.store.list(collection, filters)) await this.store.remove(collection, doc.key);
  }
  addPitEntry(entry: Omit<PitEntry, "id">) { return this.add("pitEntries", entry); }
  getPitEntry(teamNumber: number, year: number, competitionType?: CompetitionType) { return this.one<PitEntry>("pitEntries", { teamNumber, year, ...(competitionType === undefined ? {} : { competitionType }) }); }
  getAllPitEntries(year?: number, eventCode?: string, competitionType?: CompetitionType) { return this.rows<PitEntry>("pitEntries", { year, eventCode, competitionType }); }
  updatePitEntry(id: number, updates: Partial<PitEntry>) { return this.update("pitEntries", { numericId: id }, updates); }
  deletePitEntry(id: number) { return this.remove("pitEntries", { numericId: id }); }
  async checkPitScoutExists(teamNumber: number, eventCode: string) { return !!await this.one("pitEntries", { teamNumber, eventCode }); }
  addMatchEntry(entry: Omit<MatchEntry, "id">) { return this.add("matchEntries", entry); }
  getMatchEntries(teamNumber: number, year?: number, competitionType?: CompetitionType) { return this.rows<MatchEntry>("matchEntries", { teamNumber, year, competitionType }); }
  getAllMatchEntries(year?: number, eventCode?: string, competitionType?: CompetitionType) { return this.rows<MatchEntry>("matchEntries", { year, eventCode, competitionType }); }
  updateMatchEntry(id: number, updates: Partial<MatchEntry>) { return this.update("matchEntries", { numericId: id }, updates); }
  deleteMatchEntry(id: number) { return this.remove("matchEntries", { numericId: id }); }
  async checkMatchScoutExists(teamNumber: number, matchNumber: number, eventCode: string) { return !!await this.one("matchEntries", { teamNumber, matchNumber, eventCode }); }
  addCustomEvent(event: Omit<CustomEvent, "id">) { return this.add("customEvents", event); }
  getCustomEvent(eventCode: string, competitionType?: CompetitionType) { return this.one<CustomEvent>("customEvents", { eventCode, ...(competitionType === undefined ? {} : { competitionType }) }); }
  getAllCustomEvents(year?: number, competitionType?: CompetitionType) { return this.rows<CustomEvent>("customEvents", { year, competitionType }); }
  updateCustomEvent(eventCode: string, updates: Partial<CustomEvent>) { return this.update("customEvents", { eventCode }, updates); }
  async deleteCustomEvent(eventCode: string) {
    for (const event of await this.getAllCustomEvents()) {
      if (event.eventCode !== eventCode) continue;
      const scope = { eventCode, year: event.year, competitionType: event.competitionType };
      for (const list of await this.rows<Picklist>("picklists", scope)) if (list.id !== undefined) await this.deletePicklist(list.id);
      await this.remove("matchEntries", scope);
      await this.remove("pitEntries", scope);
      await this.remove("schedules", scope);
    }
    await this.remove("customEvents", { eventCode });
  }
  addPicklist(list: Omit<Picklist, "id" | "created_at" | "updated_at">) { return this.add("picklists", list); }
  getPicklist(id: number) { return this.one<Picklist>("picklists", { numericId: id }); }
  getPicklistByEvent(eventCode: string, year: number, competitionType: CompetitionType, picklistType?: string) { return this.one<Picklist>("picklists", { eventCode, year, competitionType, ...(picklistType === undefined ? {} : { picklistType }) }); }
  getPicklistsByEvent(eventCode: string, year: number, competitionType: CompetitionType) { return this.rows<Picklist>("picklists", { eventCode, year, competitionType }); }
  updatePicklist(id: number, updates: Partial<Picklist>) { return this.update("picklists", { numericId: id }, updates); }
  async deletePicklist(id: number) {
    await this.remove("picklistEntries", { picklistId: id });
    await this.remove("picklistNotes", { picklistId: id });
    await this.remove("picklists", { numericId: id });
  }
  addPicklistEntry(entry: Omit<PicklistEntry, "id" | "created_at" | "updated_at">) { return this.add("picklistEntries", entry); }
  getPicklistEntry(id: number) { return this.one<PicklistEntry>("picklistEntries", { numericId: id }); }
  async getPicklistEntries(picklistId: number) { return (await this.rows<PicklistEntry>("picklistEntries", { picklistId })).sort((a, b) => a.rank - b.rank); }
  updatePicklistEntry(id: number, updates: Partial<PicklistEntry>) { return this.update("picklistEntries", { numericId: id }, updates); }
  deletePicklistEntry(id: number) { return this.remove("picklistEntries", { numericId: id }); }
  updatePicklistEntryRank(picklistId: number, teamNumber: number, rank: number) { return this.update("picklistEntries", { picklistId, teamNumber }, { rank }); }
  async reorderPicklistEntries(picklistId: number, entries: Array<{ teamNumber: number; rank: number }>) {
    const ranks = new Map(entries.map((e) => [e.teamNumber, e.rank]));
    const docs = (await this.store.list("picklistEntries", { picklistId })).filter((d) => ranks.has(Number(d.data.teamNumber)));
    const updates = new Map(docs.map((doc) => [doc.key, { rank: ranks.get(Number(doc.data.teamNumber)), updated_at: now() }]));
    if (this.store.updateMany) await this.store.updateMany("picklistEntries", updates);
    else for (const [key, patch] of updates) await this.store.transact("picklistEntries", [key], (current) => {
      const data = current.get(key);
      return data ? new Map([[key, { ...data, ...patch }]]) : new Map();
    });
  }
  addPicklistNote(note: Omit<PicklistNote, "id" | "created_at" | "updated_at">) { return this.add("picklistNotes", note); }
  getPicklistNote(id: number) { return this.one<PicklistNote>("picklistNotes", { numericId: id }); }
  getPicklistNotes(picklistId: number, teamNumber?: number) { return this.rows<PicklistNote>("picklistNotes", { picklistId, teamNumber }); }
  updatePicklistNote(id: number, updates: Partial<PicklistNote>) { return this.update("picklistNotes", { numericId: id }, updates); }
  deletePicklistNote(id: number) { return this.remove("picklistNotes", { numericId: id }); }

  async exportData(year?: number, competitionType?: CompetitionType) {
    const [pitEntries, matchEntries] = await Promise.all([this.getAllPitEntries(year, undefined, competitionType), this.getAllMatchEntries(year, undefined, competitionType)]);
    return { pitEntries, matchEntries };
  }
  async importData(data: { pitEntries?: PitEntry[]; matchEntries?: MatchEntry[] }) {
    // Allocate fresh IDs as SQL imports do, so repeated imports never alias existing rows.
    for (const entry of data.pitEntries ?? []) { const copy = { ...entry }; delete copy.id; await this.addPitEntry(copy); }
    for (const entry of data.matchEntries ?? []) { const copy = { ...entry }; delete copy.id; await this.addMatchEntry(copy); }
  }
  async resetDatabase() {
    for (const collection of [...numericCollections, "users", "avatars", "schedules", "guestLinks"]) {
      for (const doc of await this.store.list(collection)) await this.store.remove(collection, doc.key);
    }
  }
  addGuestLink(link: GuestLinkRecord) { return this.store.create("guestLinks", link.id, link as unknown as Document); }
  async getGuestLinks() { return (await this.store.list("guestLinks")).map((d) => d.data as unknown as GuestLinkRecord); }
  async getGuestLink(id: string) { return await this.store.get("guestLinks", id) as unknown as GuestLinkRecord | undefined; }
  async revokeGuestLink(id: string, revokedAt: number) {
    await this.store.transact("guestLinks", [id], (docs) => {
      const link = docs.get(id);
      return link ? new Map([[id, { ...link, revokedAt }]]) : new Map();
    });
  }
  async getScheduleAssignments(scope: ScheduleAssignmentScope): Promise<ScheduleAssignmentRecord[]> {
    const doc = await this.store.get("schedules", scheduleKey(scope));
    return sortedAssignments((doc?.assignments ?? []) as ScheduleAssignmentRecord[]);
  }
  async applyScheduleAssignmentChanges(scope: ScheduleAssignmentScope, changes: ScheduleAssignmentChange[], replaceAll = false, expectedAssignments?: ScheduleAssignmentRecord[]) {
    const key = scheduleKey(scope);
    await this.store.transact("schedules", [key], (docs) => {
      const current = (docs.get(key)?.assignments ?? []) as ScheduleAssignmentRecord[];
      if (expectedAssignments && assignmentSignature(current) !== assignmentSignature(expectedAssignments)) {
        const error = new Error("Schedule changed since it was loaded"); error.name = "ScheduleConflictError"; throw error;
      }
      const slots = new Map((replaceAll ? [] : current).map((a) => [`${a.matchNumber}-${a.alliance}-${a.position}`, a]));
      for (const change of changes) for (let matchNumber = change.startMatch; matchNumber <= change.endMatch; matchNumber++) {
        const slot = `${matchNumber}-${change.alliance}-${change.position}`;
        if (change.userId) slots.set(slot, { matchNumber, alliance: change.alliance, position: change.position, userId: change.userId }); else slots.delete(slot);
      }
      return new Map([[key, { ...scope, assignments: sortedAssignments([...slots.values()]) }]]);
    });
  }
}
