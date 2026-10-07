import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { applicationDefault, cert, getApps, initializeApp } from "firebase-admin/app";
import { getFirestore, type Firestore, type Query } from "firebase-admin/firestore";
import type { FirebaseConfig } from "@/lib/types";
import { DocumentDatabaseService } from "./document-database-service";
import { encodeDocument, type Document, type DocumentChanges, type DocumentStore } from "./document-store";

export class FirebaseDocumentStore implements DocumentStore {
  private db?: Firestore;
  constructor(private readonly config: FirebaseConfig = {}) {}
  private database(): Firestore {
    if (this.db) return this.db;
    const account = this.config.serviceAccountJson ?? (this.config.serviceAccountPath
      ? JSON.parse(readFileSync(resolve(this.config.serviceAccountPath), "utf8")) : undefined);
    const name = `athena-${createHash("sha256").update(JSON.stringify([account ?? "adc", this.config.databaseURL])).digest("hex")}`;
    const app = getApps().find((candidate) => candidate.name === name) ?? initializeApp({
      credential: account ? cert(account) : applicationDefault(),
      ...(this.config.databaseURL ? { databaseURL: this.config.databaseURL } : {}),
    }, name);
    this.db = getFirestore(app);
    return this.db;
  }
  async list(collection: string, filters: Document = {}) {
    let query: Query = this.database().collection(collection);
    // Equality filters only; sort in the domain layer to avoid composite order indexes.
    for (const [field, value] of Object.entries(filters)) query = query.where(field, "==", value);
    const snapshot = await query.get();
    const rows = snapshot.docs.map((doc) => ({ key: doc.id, data: doc.data() }));
    // Older imports stored a domain id but omitted numericId. Keep them editable.
    if (filters.numericId !== undefined) {
      let legacy: Query = this.database().collection(collection);
      for (const [field, value] of Object.entries(filters)) legacy = legacy.where(field === "numericId" ? "id" : field, "==", value);
      const imported = await legacy.get();
      const seen = new Set(rows.map((row) => row.key));
      for (const doc of imported.docs) if (!seen.has(doc.id) && doc.data().numericId === undefined) rows.push({ key: doc.id, data: doc.data() });
    }
    return rows;
  }
  async get(collection: string, key: string) {
    const snapshot = await this.database().collection(collection).doc(key).get();
    return snapshot.exists ? snapshot.data() : undefined;
  }
  async create(collection: string, key: string, data: Document) {
    await this.database().collection(collection).doc(key).create(encodeDocument(data));
  }
  async remove(collection: string, key: string) {
    await this.database().collection(collection).doc(key).delete();
  }
  async transact(collection: string, keys: string[], change: (documents: Map<string, Document | undefined>) => DocumentChanges) {
    const db = this.database();
    await db.runTransaction(async (transaction) => {
      const refs = [...new Set(keys)].map((key) => db.collection(collection).doc(key));
      const snapshots = refs.length ? await transaction.getAll(...refs) : [];
      const writes = change(new Map(snapshots.map((snapshot) => [snapshot.id, snapshot.exists ? snapshot.data() : undefined])));
      for (const [key, value] of writes) {
        if (!keys.includes(key)) throw new Error("Transaction writes must be declared before reading");
        const ref = db.collection(collection).doc(key);
        if (value === null) transaction.delete(ref); else transaction.set(ref, encodeDocument(value));
      }
    });
  }
  async checkConnection() {
    await this.database().collection("users").limit(1).get();
  }
  async updateMany(collection: string, updates: Map<string, Document>) {
    const keys = [...updates.keys()];
    for (let offset = 0; offset < keys.length; offset += 500) {
      const chunk = keys.slice(offset, offset + 500);
      await this.transact(collection, chunk, (documents) => new Map(chunk.flatMap((key) => {
        const data = documents.get(key);
        return data ? [[key, { ...data, ...updates.get(key) }] as const] : [];
      })));
    }
  }
}

export class FirebaseDatabaseService extends DocumentDatabaseService {
  constructor(config?: FirebaseConfig) { super(new FirebaseDocumentStore(config)); }
}
export default FirebaseDatabaseService;
