import { CosmosClient, type Container, type Database, type JSONObject, type JSONValue, type OperationInput, type PartitionKey, type SqlParameter } from "@azure/cosmos";
import type { CosmosConfig } from "@/lib/types";
import { DocumentDatabaseService } from "./document-database-service";
import { encodeDocument, type Document, type DocumentChanges, type DocumentStore } from "./document-store";

const isolated = new Set(["users", "avatars", "schedules", "guestLinks"]);
// Old scouting documents predate the discriminator. Identify them by their shape.
const legacyShape: Record<string, string> = {
  pitEntries: "IS_DEFINED(c.driveTrain)",
  matchEntries: "IS_DEFINED(c.matchNumber) AND IS_DEFINED(c.gameSpecificData)",
  customEvents: "IS_DEFINED(c.matchCount) AND IS_DEFINED(c.date)",
  picklists: "IS_DEFINED(c.picklistType)",
  picklistEntries: "IS_DEFINED(c.picklistId) AND IS_DEFINED(c.rank)",
  picklistNotes: "IS_DEFINED(c.picklistId) AND IS_DEFINED(c.note)",
};
const status = (error: unknown) => Number((error as { code?: unknown }).code);
function decode(raw: Document): Document {
  const data = { ...raw };
  for (const field of ["_rid", "_self", "_etag", "_attachments", "_ts", "athenaType", "athenaPartition", "athenaDataId"]) delete data[field];
  // Cosmos reserves id for addressing; user/guest records retain their domain id.
  if (raw.athenaDataId !== undefined) data.id = raw.athenaDataId;
  return data;
}

export class CosmosDocumentStore implements DocumentStore {
  private client?: CosmosClient;
  private db?: Promise<Database>;
  private readonly containers = new Map<string, Promise<{ container: Container; paths: string[] }>>();
  constructor(private readonly config: CosmosConfig = {}) {}
  private database(): Promise<Database> {
    if (!this.config.endpoint || !this.config.key) throw new Error("Cosmos DB requires an endpoint and key");
    this.client ??= new CosmosClient({ endpoint: this.config.endpoint, key: this.config.key });
    if (!this.db) {
      this.db = this.client.databases.createIfNotExists({ id: this.config.databaseId || "athena" }).then(({ database }) => database).catch((error) => { this.db = undefined; throw error; });
    }
    return this.db;
  }
  private async container(kind: string) {
    // Scouting can share an explicitly configured container. Accounts and bearer
    // tokens remain separate, with a fixed partition for atomic account changes.
    // Legacy users containers only held partner preferences and may use /id.
    // Credentials accounts need a dedicated transaction-compatible partition.
    const physicalKind = kind === "users" ? "accounts" : kind;
    const id = this.config.containerId
      ? isolated.has(kind) ? `${this.config.containerId}-${physicalKind}` : this.config.containerId
      : physicalKind;
    if (!this.containers.has(id)) {
      const promise = this.database().then(async (database) => {
        const { container, resource } = await database.containers.createIfNotExists({ id, partitionKey: { paths: ["/athenaPartition"] } });
        if (!resource?.partitionKey?.paths?.length) throw new Error(`Cosmos container ${id} has no partition key definition`);
        if (kind === "users" && (resource.partitionKey.paths.length !== 1 || resource.partitionKey.paths[0] !== "/athenaPartition")) {
          throw new Error("The users container must use /athenaPartition to support atomic username reservations");
        }
        return { container, paths: resource.partitionKey.paths };
      }).catch((error) => { this.containers.delete(id); throw error; });
      this.containers.set(id, promise);
    }
    return this.containers.get(id)!;
  }
  private typePredicate(kind: string) {
    const legacy = legacyShape[kind];
    return legacy ? `(c.athenaType = @kind OR (NOT IS_DEFINED(c.athenaType) AND ${legacy}))` : kind === "guestLinks"
      ? "(c.athenaType = @kind OR c.type = 'guestLink')" : "c.athenaType = @kind";
  }
  private async rawList(kind: string, filters: Document = {}) {
    const { container } = await this.container(kind);
    const parameters: SqlParameter[] = [{ name: "@kind", value: kind }];
    const predicates = [this.typePredicate(kind)];
    for (const [field, value] of Object.entries(filters)) {
      const parameter = `@p${parameters.length}`;
      parameters.push({ name: parameter, value: value as JSONValue });
      // Legacy Firestore-shaped imports may have a numeric id only.
      predicates.push(field === "numericId" ? `(c.numericId = ${parameter} OR (NOT IS_DEFINED(c.numericId) AND c.id = ${parameter}))` : `c[${JSON.stringify(field)}] = ${parameter}`);
    }
    const { resources } = await container.items.query<Document>({ query: `SELECT * FROM c WHERE ${predicates.join(" AND ")}`, parameters }).fetchAll();
    return resources;
  }
  async list(kind: string, filters: Document = {}) {
    return (await this.rawList(kind, filters)).map((raw) => ({ key: String(raw.id), data: decode(raw) }));
  }
  async get(kind: string, key: string) {
    const raw = await this.rawGet(kind, key);
    return raw ? decode(raw) : undefined;
  }
  private async rawGet(kind: string, key: string): Promise<Document | undefined> {
    const { container, paths } = await this.container(kind);
    if (paths.length === 1 && ["/athenaPartition", "/id"].includes(paths[0])) {
      try {
        const { resource } = await container.item(key, paths[0] === "/id" ? key : kind).read<Document>();
        if (resource && resource.athenaType === kind) return resource;
      } catch (error) {
        if (status(error) !== 404) throw error;
      }
    }
    // Legacy records may have an undefined partition or a caller-chosen path.
    return (await this.rawList(kind, { id: key }))[0];
  }
  private body(kind: string, key: string, data: Document): JSONObject {
    return { ...encodeDocument(data), ...(data.id !== undefined ? { athenaDataId: data.id } : {}), id: key, athenaType: kind, athenaPartition: kind } as JSONObject;
  }
  private partition(paths: string[], data: Document): PartitionKey {
    const values = paths.map((path) => path.slice(1).split("/").reduce<unknown>((value, part) => value && typeof value === "object" ? (value as Document)[part] : undefined, data));
    return (values.length === 1 ? values[0] : values) as PartitionKey;
  }
  async create(kind: string, key: string, data: Document) {
    const { container } = await this.container(kind);
    await container.items.create(this.body(kind, key, data));
  }
  async remove(kind: string, key: string) {
    const { container, paths } = await this.container(kind);
    const raw = await this.rawGet(kind, key);
    if (!raw) return;
    // Always address the actual partition and propagate all non-404 failures.
    try { await container.item(key, this.partition(paths, raw)).delete(); }
    catch (error) { if (status(error) !== 404) throw error; }
  }
  async transact(kind: string, keys: string[], change: (documents: Map<string, Document | undefined>) => DocumentChanges) {
    const { container, paths } = await this.container(kind);
    for (let attempt = 0; attempt < 5; attempt++) {
      const raws = new Map(await Promise.all([...new Set(keys)].map(async (key) => [key, await this.rawGet(kind, key)] as const)));
      const writes = change(new Map([...raws].map(([key, raw]) => [key, raw ? decode(raw) : undefined])));
      if (!writes.size) return;
      if (writes.size > 100) throw new Error("An atomic Cosmos update may contain at most 100 documents");
      let partition: PartitionKey | undefined;
      let partitionSignature: string | undefined;
      const operations: OperationInput[] = [];
      for (const [key, value] of writes) {
        if (!keys.includes(key)) throw new Error("Transaction writes must be declared before reading");
        const raw = raws.get(key);
        if (value === null && !raw) continue;
        const body: Document = value === null ? raw! : this.body(kind, key, value);
        // Adding internal fields must not move a legacy item to a new partition.
        if (raw) for (const field of ["athenaPartition", "athenaType"]) {
          if (paths.includes(`/${field}`)) {
            if (raw[field] === undefined) delete body[field]; else body[field] = raw[field];
          }
        }
        const pk = this.partition(paths, body);
        const signature = JSON.stringify(pk);
        if (raw && JSON.stringify(this.partition(paths, raw)) !== signature) throw new Error("Cannot change a Cosmos partition key");
        if (partitionSignature !== undefined && partitionSignature !== signature) throw new Error("Atomic updates require documents in the same Cosmos partition");
        partition = pk; partitionSignature = signature;
        if (value === null) {
          // Delete has no ifMatch in the SDK batch input; use a conditional
          // replace first to enforce the read version within the same batch.
          operations.push({ operationType: "Replace", id: key, resourceBody: raw as JSONObject, ifMatch: String(raw!._etag) }, { operationType: "Delete", id: key });
        } else if (raw) operations.push({ operationType: "Replace", id: key, resourceBody: body as JSONObject, ifMatch: String(raw._etag) });
        else operations.push({ operationType: "Create", resourceBody: body as JSONObject });
      }
      if (!operations.length) return;
      if (operations.length > 100) throw new Error("An atomic Cosmos update may contain at most 100 operations");
      try {
        const result = await container.items.batch(operations, partition);
        const failure = result.result?.find((item) => item.statusCode >= 400 && item.statusCode !== 424)
          ?? result.result?.find((item) => item.statusCode >= 400);
        const code = failure?.statusCode ?? result.code ?? 200;
        if (code === 409 || code === 412) continue;
        if (code >= 400) throw Object.assign(new Error(`Cosmos transaction failed (${code})`), { code });
        return;
      } catch (error) {
        if (status(error) !== 409 && status(error) !== 412) throw error;
      }
    }
    throw new Error("Cosmos transaction changed concurrently; retry the operation");
  }
  async checkConnection() {
    // Provision and verify all resources before setup saves the provider.
    for (const kind of ["pitEntries", "matchEntries", "customEvents", "picklists", "picklistEntries", "picklistNotes", "users", "avatars", "schedules", "guestLinks"]) {
      const { container } = await this.container(kind);
      await container.items.query({ query: "SELECT TOP 1 c.id FROM c" }).fetchAll();
    }
  }
  async updateMany(kind: string, updates: Map<string, Document>) {
    const { paths } = await this.container(kind);
    const groups = new Map<string, string[]>();
    for (const key of updates.keys()) {
      const raw = await this.rawGet(kind, key);
      if (!raw) continue;
      const partition = JSON.stringify(this.partition(paths, raw)) ?? "undefined";
      const keys = groups.get(partition) ?? [];
      keys.push(key); groups.set(partition, keys);
    }
    for (const keys of groups.values()) for (let offset = 0; offset < keys.length; offset += 100) {
      const chunk = keys.slice(offset, offset + 100);
      await this.transact(kind, chunk, (documents) => new Map(chunk.flatMap((key) => {
        const data = documents.get(key);
        return data ? [[key, { ...data, ...updates.get(key) }] as const] : [];
      })));
    }
  }
}

export class CosmosDatabaseService extends DocumentDatabaseService {
  constructor(config?: CosmosConfig) { super(new CosmosDocumentStore(config)); }
}
export default CosmosDatabaseService;
