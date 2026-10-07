import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Document } from "@/db/document-store";
import type { DatabaseService, MatchEntry } from "@/lib/types";

const state = vi.hoisted(() => ({
  firestore: new Map<string, Map<string, Map<string, Record<string, unknown>>>>(),
  cosmos: new Map<string, Map<string, Map<string, Record<string, unknown>>>>(),
  apps: [] as { name: string; options: { credential: { projectId?: string } } }[],
  queries: [] as { container: string; query: string }[],
  batches: [] as { container: string; partition: unknown; operations: Record<string, unknown>[] }[],
  partitionPaths: new Map<string, string[]>(),
  batchFailures: [] as number[],
  deleteFailure: 0,
  firestoreFailure: false,
  etag: 0,
  pending: Promise.resolve(),
}));

vi.mock("firebase-admin/app", () => ({
  cert: (account: Record<string, unknown>) => account,
  applicationDefault: () => ({ projectId: "adc" }),
  getApps: () => state.apps,
  initializeApp: (options: { credential: { projectId?: string } }, name: string) => {
    const app = { name, options }; state.apps.push(app); return app;
  },
}));
vi.mock("firebase-admin/firestore", () => ({
  getFirestore: (app: { options: { credential: { projectId?: string } } }) => {
    const project = app.options.credential.projectId ?? "adc";
    if (!state.firestore.has(project)) state.firestore.set(project, new Map());
    const collections = state.firestore.get(project)!;
    const collection = (name: string) => {
      if (!collections.has(name)) collections.set(name, new Map());
      const rows = collections.get(name)!;
      const snapshot = (id: string) => ({ id, exists: rows.has(id), data: () => structuredClone(rows.get(id)) });
      const doc = (id: string) => ({
        id, rows,
        get: async () => snapshot(id),
        create: async (data: Document) => {
          if (rows.has(id)) throw Object.assign(new Error("Duplicate document"), { code: 6 });
          rows.set(id, structuredClone(data));
        },
        delete: async () => { rows.delete(id); },
      });
      const query = (filters: [string, unknown][] = [], limit = Infinity): object => ({
        doc,
        where: (field: string, op: string, value: unknown) => {
          expect(op).toBe("=="); return query([...filters, [field, value]], limit);
        },
        limit: (count: number) => query(filters, count),
        get: async () => {
          if (state.firestoreFailure) throw new Error("Firestore unavailable");
          return { docs: [...rows.keys()].filter((id) => filters.every(([field, value]) => rows.get(id)![field] === value)).slice(0, limit).map(snapshot) };
        },
      });
      return query();
    };
    return {
      collection,
      runTransaction: async (fn: (transaction: object) => Promise<void>) => {
        const operation = state.pending.then(async () => {
          const writes: (() => void)[] = [];
          type Ref = { id: string; rows: Map<string, Document> };
          await fn({
            getAll: async (...refs: Ref[]) => refs.map((ref) => ({ id: ref.id, exists: ref.rows.has(ref.id), data: () => structuredClone(ref.rows.get(ref.id)) })),
            set: (ref: Ref, value: Document) => { writes.push(() => ref.rows.set(ref.id, structuredClone(value))); },
            delete: (ref: Ref) => { writes.push(() => { ref.rows.delete(ref.id); }); },
          });
          for (const write of writes) write();
        });
        state.pending = operation.catch(() => undefined);
        await operation;
      },
    };
  },
}));

vi.mock("@azure/cosmos", () => ({
  CosmosClient: class {
    readonly databases;
    constructor(config: { endpoint: string }) {
      if (!state.cosmos.has(config.endpoint)) state.cosmos.set(config.endpoint, new Map());
      const collections = state.cosmos.get(config.endpoint)!;
      const createContainer = async (definition: { id: string; partitionKey: { paths: string[] } }) => {
        const name = definition.id;
        if (!collections.has(name)) collections.set(name, new Map());
        const rows = collections.get(name)!;
        const paths = state.partitionPaths.get(name) ?? definition.partitionKey.paths;
        const partition = (body: Document) => {
          const values = paths.map((path) => body[path.slice(1)]);
          return values.length === 1 ? values[0] : values;
        };
        const shape = (kind: string, data: Document) => {
          if (data.athenaType !== undefined) return data.athenaType === kind;
          if (kind === "pitEntries") return "driveTrain" in data;
          if (kind === "matchEntries") return "matchNumber" in data && "gameSpecificData" in data;
          if (kind === "customEvents") return "matchCount" in data && "date" in data;
          if (kind === "picklists") return "picklistType" in data;
          if (kind === "picklistEntries") return "picklistId" in data && "rank" in data;
          if (kind === "picklistNotes") return "picklistId" in data && "note" in data;
          return kind === "guestLinks" && data.type === "guestLink";
        };
        const container = {
          items: {
            query: (spec: { query: string; parameters?: { name: string; value: unknown }[] }) => ({
              fetchAll: async () => {
                state.queries.push({ container: name, query: spec.query });
                const parameters = new Map((spec.parameters ?? []).map((p) => [p.name, p.value]));
                const kind = parameters.get("@kind");
                const filters = [...spec.query.matchAll(/c\["([^"]+)"\] = (@p\d+)/g)].map((m) => [m[1], parameters.get(m[2])] as const);
                const numeric = spec.query.match(/c.numericId = (@p\d+)/);
                const resources = [...rows.values()].filter((data) => (!kind || shape(String(kind), data)) && filters.every(([field, value]) => data[field] === value) && (!numeric || (data.numericId ?? data.id) === parameters.get(numeric[1])));
                return { resources: structuredClone(resources) };
              },
            }),
            create: async (body: Document) => {
              expect(typeof body.id).toBe("string");
              if (rows.has(String(body.id))) throw Object.assign(new Error("Duplicate"), { code: 409 });
              rows.set(String(body.id), { ...structuredClone(body), _etag: String(++state.etag) });
            },
            batch: async (operations: Record<string, unknown>[], pk: unknown) => {
              state.batches.push({ container: name, partition: pk, operations: structuredClone(operations) });
              const forcedFailure = state.batchFailures.shift();
              if (forcedFailure) return { code: forcedFailure, result: [{ statusCode: forcedFailure }] };
              const draft = new Map([...rows].map(([key, data]) => [key, structuredClone(data)]));
              for (const operation of operations) {
                const body = operation.resourceBody as Document | undefined;
                const key = String(operation.id ?? body?.id);
                const current = draft.get(key);
                expect(partition(body ?? current!)).toEqual(pk);
                if (operation.operationType === "Create" && current) return { code: 409, result: [{ statusCode: 409 }] };
                if (operation.ifMatch && current?._etag !== operation.ifMatch) return { code: 412, result: [{ statusCode: 412 }] };
                if (operation.operationType === "Delete") draft.delete(key);
                else draft.set(key, { ...body!, _etag: String(++state.etag) });
              }
              rows.clear(); for (const [key, value] of draft) rows.set(key, value);
              return { code: 200, result: operations.map(() => ({ statusCode: 200 })) };
            },
          },
          item: (id: string, pk: unknown) => ({
            read: async () => {
              const resource = rows.get(id);
              if (!resource || JSON.stringify(partition(resource)) !== JSON.stringify(pk)) throw Object.assign(new Error("Not found"), { code: 404 });
              return { resource: structuredClone(resource) };
            },
            delete: async () => {
              if (state.deleteFailure) throw Object.assign(new Error("Delete failed"), { code: state.deleteFailure });
              if (!rows.has(id)) throw Object.assign(new Error("Not found"), { code: 404 });
              expect(pk).toEqual(partition(rows.get(id)!)); rows.delete(id);
            },
          }),
        };
        return { container, resource: { partitionKey: { paths } } };
      };
      this.databases = { createIfNotExists: async () => ({ database: { containers: { createIfNotExists: createContainer } } }) };
    }
  },
}));

import { FirebaseDatabaseService } from "@/db/firebase-database-service";
import { CosmosDatabaseService } from "@/db/cosmos-database-service";
const cosmosConfig = { endpoint: "https://cosmos.test", key: "key", databaseId: "athena", containerId: "scouting" };
const firebaseConfig = { serviceAccountJson: { projectId: "project-one" } };
const match: Omit<MatchEntry, "id"> = { teamNumber: 254, year: 2026, competitionType: "FRC", eventCode: "2026test", matchNumber: 1, alliance: "red", notes: "test", timestamp: new Date("2026-03-01"), gameSpecificData: { score: 10 } };
const scope = { eventCode: "2026test", year: 2026, competitionType: "FRC" as const };

beforeEach(() => {
  state.firestore.clear(); state.cosmos.clear(); state.apps.length = 0; state.queries.length = 0; state.batches.length = 0; state.partitionPaths.clear(); state.batchFailures.length = 0;
  state.deleteFailure = 0; state.firestoreFailure = false; state.etag = 0; state.pending = Promise.resolve();
});

for (const provider of ["firebase", "cosmos"] as const) describe(`${provider} SDK adapter integration`, () => {
  let service: DatabaseService;
  beforeEach(() => { service = provider === "firebase" ? new FirebaseDatabaseService(firebaseConfig) : new CosmosDatabaseService(cosmosConfig); });
  it("round-trips scouting and picklist records through the SDK with numeric IDs", async () => {
    await service.checkConnection!();
    const id = await service.addMatchEntry(match);
    const pitId = await service.addPitEntry({ teamNumber: 254, year: 2026, competitionType: "FRC", driveTrain: "Swerve", gameSpecificData: {} });
    expect(await service.getAllMatchEntries()).toHaveLength(1);
    expect(await service.getAllPitEntries()).toMatchObject([{ id: pitId }]);
    expect(await service.getAllMatchEntries()).toMatchObject([{ id, timestamp: match.timestamp }]);
    await service.updateMatchEntry(id, { notes: "edited" });
    expect(await service.getMatchEntries(254)).toMatchObject([{ id, notes: "edited" }]);
    const listId = await service.addPicklist({ ...scope, picklistType: "main" });
    const noteId = await service.addPicklistNote({ picklistId: listId, teamNumber: 254, note: "good" });
    expect(await service.getPicklist(listId)).toMatchObject({ id: listId });
    expect(await service.getPicklistNote(noteId)).toMatchObject({ id: noteId });
    await service.deleteMatchEntry(id);
    expect(await service.getAllMatchEntries()).toEqual([]);
  });
  it("creates accounts, renames usernames and persists avatar bytes and activation", async () => {
    await service.users!.create({ id: "one", name: "One", username: "Scout", passwordHash: "hash", role: "admin" });
    await expect(service.users!.create({ id: "two", name: "Two", username: "SCOUT", passwordHash: "other", role: "scout" })).rejects.toThrow();
    expect(await service.users!.hasAdmin()).toBe(true);
    await service.updateUser("one", { username: "new", avatarData: Buffer.from("image"), avatarMimeType: "image/png" });
    expect(await service.users!.getByUsername("scout")).toBeUndefined();
    expect(await service.users!.getByUsername("NEW")).toMatchObject({ id: "one", password_hash: "hash" });
    expect(await service.users!.getAvatar("one")).toEqual({ avatarData: Buffer.from("image"), avatarMimeType: "image/png" });
    await service.users!.setActive("one", false);
    expect(await service.users!.hasAdmin()).toBe(false);
    expect(await service.users!.getById("one")).toMatchObject({ sessionVersion: 1 });
  });
  it("persists schedule ranges and rejects conflicting writes", async () => {
    await service.applyScheduleAssignmentChanges!(scope, [{ startMatch: 1, endMatch: 500, alliance: "red", position: 0, userId: "one" }], true, []);
    expect(await service.getScheduleAssignments!(scope)).toHaveLength(500);
    await expect(service.applyScheduleAssignmentChanges!(scope, [], true, [])).rejects.toMatchObject({ name: "ScheduleConflictError" });
    await service.applyScheduleAssignmentChanges!(scope, [], true);
    expect(await service.getScheduleAssignments!(scope)).toEqual([]);
  });
  it("round-trips a 2 MB avatar without storing oversized documents", async () => {
    await service.users!.create({ id: "one", name: "One", username: "one", passwordHash: "hash", role: "scout" });
    const image = Buffer.alloc(2 * 1024 * 1024, 42);
    await service.updateUser("one", { avatarData: image, avatarMimeType: "image/png" });
    expect((await service.users!.getAvatar("one"))!.avatarData!.equals(image)).toBe(true);
    const collections = provider === "firebase" ? state.firestore.get("project-one")! : state.cosmos.get(cosmosConfig.endpoint)!;
    for (const rows of collections.values()) for (const row of rows.values()) expect(Buffer.byteLength(JSON.stringify(row))).toBeLessThan(1024 * 1024);
    await service.updateUser("one", { avatarData: null, avatarMimeType: null });
    expect((await service.users!.getAvatar("one"))!.avatarData).toBeNull();
    expect((await service.users!.getById("one"))!.password_hash).toBe("hash");
    expect((collections.get(provider === "firebase" ? "avatars" : "scouting-avatars"))!.size).toBe(0);
  });
  it("filters exports and reimports data as editable rows", async () => {
    await service.addMatchEntry(match);
    await service.addMatchEntry({ ...match, competitionType: "FTC" });
    const exported = await service.exportData(2026, "FRC");
    expect(exported.matchEntries).toHaveLength(1);
    await service.importData(exported);
    expect(await service.getAllMatchEntries(2026, undefined, "FRC")).toHaveLength(2);
  });
  it("imports and resets more than 500 rows without a single oversized batch", async () => {
    await service.importData({ matchEntries: Array.from({ length: 501 }, () => ({ ...match, id: 1 })) });
    const rows = await service.getAllMatchEntries();
    expect(rows).toHaveLength(501);
    expect(new Set(rows.map((row) => row.id)).size).toBe(501);
    await service.resetDatabase();
    expect(await service.getAllMatchEntries()).toEqual([]);
  });
  it("reorders picklists larger than the Cosmos batch limit", async () => {
    const id = await service.addPicklist({ ...scope, picklistType: "main" });
    const entries = Array.from({ length: 201 }, (_, rank) => ({ teamNumber: rank + 1, rank: 200 - rank }));
    for (const entry of entries) await service.addPicklistEntry({ picklistId: id, teamNumber: entry.teamNumber, rank: 0 });
    await service.reorderPicklistEntries(id, entries);
    expect((await service.getPicklistEntries(id)).map((entry) => entry.teamNumber)).toEqual(entries.map((entry) => entry.teamNumber).reverse());
    expect(state.batches.every((batch) => batch.operations.length <= 100)).toBe(true);
  });
});

describe("provider-specific regression cases", () => {
  it("Firebase switches projects without restarting the process", async () => {
    const one = new FirebaseDatabaseService(firebaseConfig);
    await one.addMatchEntry(match);
    const two = new FirebaseDatabaseService({ serviceAccountJson: { projectId: "project-two" } });
    expect(await two.getAllMatchEntries()).toEqual([]);
    expect(await one.getAllMatchEntries()).toHaveLength(1);
    expect(state.apps).toHaveLength(2);
  });
  it("Firebase retains editability of older imports with id instead of numericId", async () => {
    const service = new FirebaseDatabaseService(firebaseConfig);
    await service.checkConnection();
    state.firestore.get("project-one")!.set("matchEntries", new Map([["old", { ...match, timestamp: match.timestamp.toISOString(), id: 42 }]]));
    await service.updateMatchEntry(42, { notes: "fixed" });
    expect(await service.getAllMatchEntries()).toMatchObject([{ id: 42, notes: "fixed" }]);
    await service.deleteMatchEntry(42);
    expect(await service.getAllMatchEntries()).toEqual([]);
  });
  it("Cosmos keeps shared records separated and reads untyped legacy scouting data", async () => {
    const service = new CosmosDatabaseService(cosmosConfig);
    await service.checkConnection();
    state.cosmos.get(cosmosConfig.endpoint)!.get("scouting")!.set("old", { ...match, timestamp: match.timestamp.toISOString(), id: "old", numericId: 42, _etag: "old" });
    await service.addPitEntry({ teamNumber: 254, year: 2026, competitionType: "FRC", driveTrain: "Swerve", gameSpecificData: {} });
    expect(await service.getAllMatchEntries()).toMatchObject([{ id: 42 }]);
    expect(await service.getAllPitEntries()).toHaveLength(1);
    const queries = state.queries.filter((query) => query.query.includes("@kind"));
    expect(queries.every((query) => query.query.includes("c.athenaType"))).toBe(true);
    expect(queries.some((query) => query.query.includes("NOT IS_DEFINED(c.athenaType)"))).toBe(true);
    await service.updateMatchEntry(42, { notes: "legacy edited" });
    expect(await service.getAllMatchEntries()).toMatchObject([{ id: 42, notes: "legacy edited" }]);
  });
  it("Cosmos addresses legacy event partitions and propagates deletion failures", async () => {
    state.partitionPaths.set("scouting", ["/eventCode"]);
    const service = new CosmosDatabaseService(cosmosConfig);
    const id = await service.addMatchEntry(match);
    await service.updateMatchEntry(id, { notes: "edited" });
    expect(state.batches[0].partition).toBe("2026test");
    state.deleteFailure = 403;
    await expect(service.deleteMatchEntry(id)).rejects.toThrow("Delete failed");
    state.deleteFailure = 0;
    await service.deleteMatchEntry(id);
    expect(await service.getAllMatchEntries()).toEqual([]);
  });
  it("Cosmos retries ETag contention and checks batch response failures", async () => {
    const service = new CosmosDatabaseService(cosmosConfig);
    const id = await service.addMatchEntry(match);
    state.batchFailures.push(412);
    await service.updateMatchEntry(id, { notes: "retry" });
    expect(state.batches).toHaveLength(2);
    expect(state.batches[1].operations[0]).toHaveProperty("ifMatch");
    state.batchFailures.push(403);
    await expect(service.updateMatchEntry(id, { notes: "failed" })).rejects.toThrow("403");
    expect(await service.getAllMatchEntries()).toMatchObject([{ notes: "retry" }]);
  });
  it("Cosmos validates account partitions before setup succeeds", async () => {
    state.partitionPaths.set("scouting-accounts", ["/id"]);
    await expect(new CosmosDatabaseService(cosmosConfig).checkConnection()).rejects.toThrow("users container must use /athenaPartition");
  });
  it("connection checks surface invalid or unavailable configuration", async () => {
    await expect(new CosmosDatabaseService({}).checkConnection()).rejects.toThrow("endpoint and key");
    state.firestoreFailure = true;
    await expect(new FirebaseDatabaseService(firebaseConfig).checkConnection()).rejects.toThrow("unavailable");
  });
});
