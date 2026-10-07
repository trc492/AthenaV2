/** Storage primitives shared by Firestore and Cosmos. Keys are storage IDs, not domain IDs. */
export type Document = Record<string, unknown>;
export type StoredDocument = { key: string; data: Document };
export type DocumentChanges = Map<string, Document | null>;
export interface DocumentStore {
  list(collection: string, filters?: Document): Promise<StoredDocument[]>;
  get(collection: string, key: string): Promise<Document | undefined>;
  create(collection: string, key: string, data: Document): Promise<void>;
  remove(collection: string, key: string): Promise<void>;
  /** Large changes may commit in chunks to respect provider transaction limits. */
  updateMany?(collection: string, updates: Map<string, Document>): Promise<void>;
  /** The callback may run again on contention. Reads and writes commit atomically. */
  transact(collection: string, keys: string[], change: (documents: Map<string, Document | undefined>) => DocumentChanges): Promise<void>;
  checkConnection(): Promise<void>;
}

/** Omit undefined recursively; use portable ISO dates and base64 for binary data. */
export function encodeDocument(data: Document): Document {
  const encode = (value: unknown): unknown => {
    if (value instanceof Date) return value.toISOString();
    if (Buffer.isBuffer(value)) return value.toString("base64");
    if (value && typeof value === "object" && "toDate" in value && typeof value.toDate === "function") {
      return (value.toDate() as Date).toISOString();
    }
    if (Array.isArray(value)) return value.map((item) => encode(item) ?? null);
    if (value && typeof value === "object") {
      return Object.fromEntries(Object.entries(value).filter(([, v]) => v !== undefined).map(([k, v]) => [k, encode(v)]));
    }
    return value;
  };
  return encode(data) as Document;
}
