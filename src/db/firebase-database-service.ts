import { DatabaseService } from "@/lib/types";
import type { PitEntry, MatchEntry, CustomEvent } from "@/lib/types";
import type { CompetitionType } from "@/lib/types";
// Minimal Firebase Admin-backed database service. Uses Firestore collections.
export class FirebaseDatabaseService implements DatabaseService {
  private admin: any;
  private db: any;

  constructor(
    private config?: {
      serviceAccountPath?: string;
      serviceAccountJson?: Record<string, unknown>;
      databaseURL?: string;
    },
  ) {
    try {
      // initialize firebase admin if not already
      // use dynamic import so application doesn't require firebase-admin in all environments
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      const admin = require("firebase-admin");
      if (!admin.apps || admin.apps.length === 0) {
        const opts: any = {};
        if (this.config?.serviceAccountJson)
          opts.credential = admin.credential.cert(
            this.config.serviceAccountJson,
          );
        else if (this.config?.serviceAccountPath)
          opts.credential = admin.credential.cert(
            require(this.config.serviceAccountPath),
          );
        if (this.config?.databaseURL)
          opts.databaseURL = this.config.databaseURL;
        admin.initializeApp(opts);
      }
      this.admin = admin;
      this.db = admin.firestore();
    } catch (err) {
      // If firebase-admin isn't installed or initialization fails, leave uninitialized and throw on use
      this.admin = null;
      this.db = null;
      const message = err instanceof Error ? err.message : String(err);
      console.warn(
        "FirebaseDatabaseService: firebase-admin not initialized",
        message,
      );
    }
  }

  private ensure() {
    if (!this.db)
      throw new Error(
        "Firebase not initialized. Install and configure firebase-admin or provide service account.",
      );
  }

  private collection(name: string) {
    this.ensure();
    return this.db.collection(name);
  }

  async addPitEntry(entry: Omit<PitEntry, "id">): Promise<number> {
    const ref = this.collection("pitEntries");
    const numericId = Date.now();
    await ref.add({ ...entry, numericId, createdAt: new Date() });
    return numericId;
  }

  async getPitEntry(
    teamNumber: number,
    year: number,
    competitionType?: CompetitionType,
  ): Promise<PitEntry | undefined> {
    const ref = this.collection("pitEntries");
    let q = ref.where("teamNumber", "==", teamNumber).where("year", "==", year);
    if (competitionType) q = q.where("competitionType", "==", competitionType);
    const snap = await q.limit(1).get();
    if (snap.empty) return undefined;
    const data = snap.docs[0].data();
    return { ...(data as PitEntry), id: data.numericId } as PitEntry;
  }

  async getAllPitEntries(
    year?: number,
    eventCode?: string,
    competitionType?: CompetitionType,
  ): Promise<PitEntry[]> {
    const ref = this.collection("pitEntries");
    let q: any = ref;
    if (year !== undefined) q = q.where("year", "==", year);
    if (eventCode !== undefined) q = q.where("eventCode", "==", eventCode);
    if (competitionType !== undefined)
      q = q.where("competitionType", "==", competitionType);
    const snap = await q.get();
    return snap.docs.map((d: any) => {
      const data = d.data();
      return { ...data, id: data.numericId } as PitEntry;
    });
  }

  async updatePitEntry(id: number, updates: Partial<PitEntry>): Promise<void> {
    const ref = this.collection("pitEntries");
    const snap = await ref.where("numericId", "==", id).limit(1).get();
    if (snap.empty) return;
    await snap.docs[0].ref.update({ ...updates, updatedAt: new Date() });
  }

  async deletePitEntry(id: number): Promise<void> {
    const ref = this.collection("pitEntries");
    const snap = await ref.where("numericId", "==", id).get();
    const batch = this.admin.firestore().batch();
    snap.docs.forEach((d: any) => batch.delete(d.ref));
    await batch.commit();
  }

  async checkPitScoutExists(
    teamNumber: number,
    eventCode: string,
  ): Promise<boolean> {
    const ref = this.collection("pitEntries");
    const snap = await ref
      .where("teamNumber", "==", teamNumber)
      .where("eventCode", "==", eventCode)
      .limit(1)
      .get();
    return !snap.empty;
  }

  async addMatchEntry(entry: Omit<MatchEntry, "id">): Promise<number> {
    const ref = this.collection("matchEntries");
    const numericId = Date.now();
    await ref.add({ ...entry, numericId, createdAt: new Date() });
    return numericId;
  }

  async getMatchEntries(
    teamNumber: number,
    year?: number,
    competitionType?: CompetitionType,
  ): Promise<MatchEntry[]> {
    const ref = this.collection("matchEntries");
    let q: any = ref.where("teamNumber", "==", teamNumber);
    if (year !== undefined) q = q.where("year", "==", year);
    if (competitionType !== undefined)
      q = q.where("competitionType", "==", competitionType);
    const snap = await q.get();
    return snap.docs.map((d: any) => {
      const data = d.data();
      return { ...data, id: data.numericId } as MatchEntry;
    });
  }

  async getAllMatchEntries(
    year?: number,
    eventCode?: string,
    competitionType?: CompetitionType,
  ): Promise<MatchEntry[]> {
    const ref = this.collection("matchEntries");
    let q: any = ref;
    if (year !== undefined) q = q.where("year", "==", year);
    if (eventCode !== undefined) q = q.where("eventCode", "==", eventCode);
    if (competitionType !== undefined)
      q = q.where("competitionType", "==", competitionType);
    const snap = await q.get();
    return snap.docs.map((d: any) => {
      const data = d.data();
      return { ...data, id: data.numericId } as MatchEntry;
    });
  }

  async updateMatchEntry(
    id: number,
    updates: Partial<MatchEntry>,
  ): Promise<void> {
    const ref = this.collection("matchEntries");
    const snap = await ref.where("numericId", "==", id).limit(1).get();
    if (snap.empty) return;
    await snap.docs[0].ref.update({ ...updates, updatedAt: new Date() });
  }

  async deleteMatchEntry(id: number): Promise<void> {
    const ref = this.collection("matchEntries");
    const snap = await ref.where("numericId", "==", id).get();
    const batch = this.admin.firestore().batch();
    snap.docs.forEach((d: any) => batch.delete(d.ref));
    await batch.commit();
  }

  async checkMatchScoutExists(
    teamNumber: number,
    matchNumber: number,
    eventCode: string,
  ): Promise<boolean> {
    const ref = this.collection("matchEntries");
    const snap = await ref
      .where("teamNumber", "==", teamNumber)
      .where("matchNumber", "==", matchNumber)
      .where("eventCode", "==", eventCode)
      .limit(1)
      .get();
    return !snap.empty;
  }

  async addCustomEvent(event: Omit<CustomEvent, "id">): Promise<number> {
    const ref = this.collection("customEvents");
    const numericId = Date.now();
    await ref.add({ ...event, numericId, createdAt: new Date() });
    return numericId;
  }

  async getCustomEvent(
    eventCode: string,
    competitionType?: CompetitionType,
  ): Promise<CustomEvent | undefined> {
    const ref = this.collection("customEvents");
    let q: any = ref.where("eventCode", "==", eventCode);
    if (competitionType) q = q.where("competitionType", "==", competitionType);
    const snap = await q.limit(1).get();
    if (snap.empty) return undefined;
    return { ...(snap.docs[0].data() as CustomEvent), id: undefined };
  }

  async getAllCustomEvents(
    year?: number,
    competitionType?: CompetitionType,
  ): Promise<CustomEvent[]> {
    const ref = this.collection("customEvents");
    let q: any = ref;
    if (year !== undefined) q = q.where("year", "==", year);
    if (competitionType !== undefined)
      q = q.where("competitionType", "==", competitionType);
    const snap = await q.get();
    return snap.docs.map(
      (d: any) => ({ ...d.data(), id: undefined }) as CustomEvent,
    );
  }

  async updateCustomEvent(
    eventCode: string,
    updates: Partial<CustomEvent>,
  ): Promise<void> {
    const ref = this.collection("customEvents");
    const snap = await ref.where("eventCode", "==", eventCode).limit(1).get();
    if (snap.empty) return;
    await snap.docs[0].ref.update({ ...updates, updatedAt: new Date() });
  }

  async deleteCustomEvent(eventCode: string): Promise<void> {
    const ref = this.collection("customEvents");
    const snap = await ref.where("eventCode", "==", eventCode).get();
    const batch = this.admin.firestore().batch();
    snap.docs.forEach((d: any) => batch.delete(d.ref));
    await batch.commit();
  }

  async updateUserPreferredPartners(
    userId: string,
    preferredPartners: string[],
  ): Promise<void> {
    const ref = this.collection("users").doc(userId);
    await ref.set({ preferredPartners }, { merge: true });
  }

  async getUserPreferredPartners(userId: string): Promise<string[]> {
    const ref = this.collection("users").doc(userId);
    const snap = await ref.get();
    if (!snap.exists) return [];
    const data = snap.data();
    return data?.preferredPartners || [];
  }

  // picklist methods
  async addPicklist(picklist: any): Promise<number> {
    const ref = this.collection("picklists");
    const numericId = Date.now();
    await ref.add({ ...picklist, numericId, created_at: new Date() });
    return numericId;
  }

  async getPicklist(id: number): Promise<any | undefined> {
    const ref = this.collection("picklists");
    const snap = await ref.where("numericId", "==", id).limit(1).get();
    if (snap.empty) return undefined;
    return snap.docs[0].data();
  }

  async getPicklistByEvent(
    eventCode: string,
    year: number,
    competitionType: string,
    picklistType?: string,
  ): Promise<any | undefined> {
    let q: any = this.collection("picklists")
      .where("eventCode", "==", eventCode)
      .where("year", "==", year)
      .where("competitionType", "==", competitionType);
    if (picklistType) q = q.where("picklistType", "==", picklistType);
    const snap = await q.limit(1).get();
    if (snap.empty) return undefined;
    return snap.docs[0].data();
  }

  async getPicklistsByEvent(
    eventCode: string,
    year: number,
    competitionType: string,
  ): Promise<any[]> {
    const snap = await this.collection("picklists")
      .where("eventCode", "==", eventCode)
      .where("year", "==", year)
      .where("competitionType", "==", competitionType)
      .get();
    return snap.docs.map((d: any) => d.data());
  }

  async updatePicklist(id: number, updates: Partial<any>): Promise<void> {
    const ref = this.collection("picklists");
    const snap = await ref.where("numericId", "==", id).limit(1).get();
    if (snap.empty) return;
    await snap.docs[0].ref.update({ ...updates, updated_at: new Date() });
  }

  async deletePicklist(id: number): Promise<void> {
    const ref = this.collection("picklists");
    const snap = await ref.where("numericId", "==", id).get();
    const batch = this.admin.firestore().batch();
    snap.docs.forEach((d: any) => batch.delete(d.ref));
    await batch.commit();
  }

  async addPicklistEntry(entry: any): Promise<number> {
    const ref = this.collection("picklistEntries");
    const numericId = Date.now();
    await ref.add({ ...entry, numericId, created_at: new Date() });
    return numericId;
  }

  async getPicklistEntry(id: number): Promise<any | undefined> {
    const ref = this.collection("picklistEntries");
    const snap = await ref.where("numericId", "==", id).limit(1).get();
    if (snap.empty) return undefined;
    return snap.docs[0].data();
  }

  async getPicklistEntries(picklistId: number): Promise<any[]> {
    const snap = await this.collection("picklistEntries")
      .where("picklistId", "==", picklistId)
      .orderBy("rank", "asc")
      .get();
    return snap.docs.map((d: any) => d.data());
  }

  async updatePicklistEntry(id: number, updates: Partial<any>): Promise<void> {
    const ref = this.collection("picklistEntries");
    const snap = await ref.where("numericId", "==", id).limit(1).get();
    if (snap.empty) return;
    await snap.docs[0].ref.update({ ...updates, updated_at: new Date() });
  }

  async deletePicklistEntry(id: number): Promise<void> {
    const ref = this.collection("picklistEntries");
    const snap = await ref.where("numericId", "==", id).get();
    const batch = this.admin.firestore().batch();
    snap.docs.forEach((d: any) => batch.delete(d.ref));
    await batch.commit();
  }

  async updatePicklistEntryRank(
    picklistId: number,
    teamNumber: number,
    rank: number,
  ): Promise<void> {
    const ref = this.collection("picklistEntries");
    const snap = await ref
      .where("picklistId", "==", picklistId)
      .where("teamNumber", "==", teamNumber)
      .limit(1)
      .get();
    if (snap.empty) return;
    await snap.docs[0].ref.update({ rank, updated_at: new Date() });
  }

  async reorderPicklistEntries(
    picklistId: number,
    entries: Array<{ teamNumber: number; rank: number }>,
  ): Promise<void> {
    const batch = this.admin.firestore().batch();
    const ref = this.collection("picklistEntries");
    for (const e of entries) {
      const snap = await ref
        .where("picklistId", "==", picklistId)
        .where("teamNumber", "==", e.teamNumber)
        .limit(1)
        .get();
      if (!snap.empty) {
        batch.update(snap.docs[0].ref, {
          rank: e.rank,
          updated_at: new Date(),
        });
      }
    }
    await batch.commit();
  }

  async addPicklistNote(note: any): Promise<number> {
    const ref = this.collection("picklistNotes");
    const numericId = Date.now();
    await ref.add({ ...note, numericId, created_at: new Date() });
    return numericId;
  }

  async getPicklistNote(id: number): Promise<any | undefined> {
    const ref = this.collection("picklistNotes");
    const snap = await ref.where("numericId", "==", id).limit(1).get();
    if (snap.empty) return undefined;
    return snap.docs[0].data();
  }

  async getPicklistNotes(
    picklistId: number,
    teamNumber?: number,
  ): Promise<any[]> {
    let q: any = this.collection("picklistNotes").where(
      "picklistId",
      "==",
      picklistId,
    );
    if (teamNumber !== undefined) q = q.where("teamNumber", "==", teamNumber);
    const snap = await q.get();
    return snap.docs.map((d: any) => d.data());
  }

  async updatePicklistNote(id: number, updates: Partial<any>): Promise<void> {
    const ref = this.collection("picklistNotes");
    const snap = await ref.where("numericId", "==", id).limit(1).get();
    if (snap.empty) return;
    await snap.docs[0].ref.update({ ...updates, updated_at: new Date() });
  }

  async deletePicklistNote(id: number): Promise<void> {
    const ref = this.collection("picklistNotes");
    const snap = await ref.where("numericId", "==", id).get();
    const batch = this.admin.firestore().batch();
    snap.docs.forEach((d: any) => batch.delete(d.ref));
    await batch.commit();
  }

  async exportData(): Promise<{
    pitEntries: PitEntry[];
    matchEntries: MatchEntry[];
  }> {
    const pitSnap = await this.collection("pitEntries").get();
    const matchSnap = await this.collection("matchEntries").get();
    const pitEntries = pitSnap.docs.map((d: any) => d.data() as PitEntry);
    const matchEntries = matchSnap.docs.map((d: any) => d.data() as MatchEntry);
    return { pitEntries, matchEntries };
  }

  async importData(data: {
    pitEntries?: PitEntry[];
    matchEntries?: MatchEntry[];
  }): Promise<void> {
    const batch = this.admin.firestore().batch();
    const pitEntries = data.pitEntries || [];
    const matchEntries = data.matchEntries || [];
    if (pitEntries.length > 0) {
      const pitRef = this.collection("pitEntries");
      for (const p of pitEntries) {
        const docRef = pitRef.doc();
        batch.set(docRef, p);
      }
    }
    if (matchEntries.length > 0) {
      const matchRef = this.collection("matchEntries");
      for (const m of matchEntries) {
        const docRef = matchRef.doc();
        batch.set(docRef, m);
      }
    }
    await batch.commit();
  }

  async resetDatabase(): Promise<void> {
    const collections = [
      "pitEntries",
      "matchEntries",
      "picklists",
      "picklistEntries",
      "picklistNotes",
      "customEvents",
    ];
    for (const name of collections) {
      const snap = await this.collection(name).get();
      const batch = this.admin.firestore().batch();
      snap.docs.forEach((d: any) => batch.delete(d.ref));
      await batch.commit();
    }
  }

  /**
   * Firebase Firestore does not have a relational users table — user records
   * are managed via Firebase Auth / the SDK layer. This stub satisfies the
   * DatabaseService interface; throw if called so misconfiguration is caught
   * at runtime.
   */
  async updateUser(_id: string, _updates: import("@/lib/types").UserUpdates): Promise<void> {
    throw new Error("updateUser is not supported by the Firebase provider. Use Firebase Auth or a relational provider for user management.");
  }
}

export default FirebaseDatabaseService;
