import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { MariaDbDatabaseService } from "@/db/mariadb-database-service";
import { AzureSqlDatabaseService } from "@/db/azuresql-database-service";
import type { DatabaseService, MatchEntry, PitEntry } from "@/lib/types";

// Never read the application's database settings. Each run creates and drops
// only its own database on an explicitly configured localhost test server.
const provider = process.env.TEST_DATABASE_PROVIDER;
const password = process.env.TEST_DATABASE_PASSWORD;
if ((provider !== "mariadb" && provider !== "azuresql") || !password) {
  throw new Error("Set TEST_DATABASE_PROVIDER=mariadb|azuresql and TEST_DATABASE_PASSWORD for an isolated local test server.");
}
if (/[;{}]/.test(password)) throw new Error("Use a test password without connection-string delimiters (;{}).");
const port = Number(process.env.TEST_DATABASE_PORT || (provider === "mariadb" ? 3306 : 1433));
if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error("Invalid TEST_DATABASE_PORT");
const database = `athena_test_${randomUUID().replaceAll("-", "")}`;
let service: DatabaseService;
let closeService: (() => Promise<void>) | undefined;
let dropDatabase: (() => Promise<void>) | undefined;
let closeAdmin: (() => Promise<void>) | undefined;

beforeAll(async () => {
  if (provider === "mariadb") {
    const mysql = await import("mysql2/promise");
    const admin = await vi.waitFor(() => mysql.createConnection({
      host: "127.0.0.1", port, user: "root", password, connectTimeout: 2000,
    }), { timeout: 90_000, interval: 1000 });
    closeAdmin = () => admin.end();
    await admin.query(`CREATE DATABASE ${database}`);
    dropDatabase = async () => { await admin.query(`DROP DATABASE ${database}`); };
    const adapter = new MariaDbDatabaseService({ host: "127.0.0.1", port, user: "root", password, database });
    service = adapter;
    const pool = await adapter.getPool();
    closeService = () => pool.end();
  } else {
    const mssql = await import("mssql");
    const admin = await vi.waitFor(async () => {
      const connection = new mssql.ConnectionPool({
        server: "127.0.0.1", port, user: "sa", password, database: "master",
        connectionTimeout: 2000, options: { encrypt: false, trustServerCertificate: true },
      });
      try { return await connection.connect(); }
      catch (error) { await connection.close(); throw error; }
    }, { timeout: 90_000, interval: 1000 });
    closeAdmin = () => admin.close();
    await admin.request().query(`CREATE DATABASE ${database}`);
    dropDatabase = async () => {
      await admin.request().query(`ALTER DATABASE ${database} SET SINGLE_USER WITH ROLLBACK IMMEDIATE; DROP DATABASE ${database}`);
    };
    const adapter = new AzureSqlDatabaseService({
      connectionString: `Server=127.0.0.1,${port};Database=${database};User Id=sa;Password=${password};Encrypt=false;TrustServerCertificate=true`,
    });
    // mssql.connect uses its global pool; the admin pool above is deliberately separate.
    service = adapter;
    const pool = await adapter.getPool();
    closeService = () => pool.close();
  }
});

afterAll(async () => {
  try { await closeService?.(); }
  finally {
    try { await dropDatabase?.(); }
    finally { await closeAdmin?.(); }
  }
});

function pit(eventCode: string, overrides: Partial<PitEntry> = {}): PitEntry {
  return { teamNumber: 254, year: 2026, competitionType: "FRC", eventCode,
    driveTrain: "Swerve", notes: "Quote ' and unicode: café 🤖",
    gameSpecificData: { intake: ["ground", "station"], autonomous: { climb: true } }, ...overrides };
}
function match(eventCode: string, overrides: Partial<MatchEntry> = {}): MatchEntry {
  return { teamNumber: 254, year: 2026, competitionType: "FRC", eventCode,
    matchNumber: 1, alliance: "red", alliancePosition: 2, notes: "Match notes",
    timestamp: new Date("2026-10-23T12:30:45Z"),
    gameSpecificData: { autonomous: { fuel_scored: 3 }, endgame: { ending_robot_state: "L2" } }, ...overrides };
}

describe(`${provider} real database persistence`, () => {
  it("upgrades required pit measurements without losing existing values", async () => {
    const measured = pit("schema-upgrade", { weight: 120, length: 30, width: 28 });
    const id = await service.addPitEntry(measured);
    const beforeUpgrade = await service.getAllPitEntries(2026, "schema-upgrade", "FRC");
    const adapter = service as MariaDbDatabaseService | AzureSqlDatabaseService;
    // Recreate version 1's constraints, then reconnect through normal initialization.
    for (const column of ["weight", "length", "width"]) {
      await adapter.query(`ALTER TABLE pitEntries ${provider === "mariadb" ? "MODIFY" : "ALTER"} COLUMN ${column} DECIMAL(10,2) NOT NULL`);
    }
    await adapter.query("UPDATE athenaSchema SET version = 1");
    await closeService?.();
    if (provider === "mariadb") {
      const upgraded = new MariaDbDatabaseService({ host: "127.0.0.1", port, user: "root", password, database });
      service = upgraded;
      closeService = async () => { await (await upgraded.getPool()).end(); };
      await upgraded.getPool();
    } else {
      const upgraded = new AzureSqlDatabaseService({
        connectionString: `Server=127.0.0.1,${port};Database=${database};User Id=sa;Password=${password};Encrypt=false;TrustServerCertificate=true`,
      });
      service = upgraded;
      closeService = async () => { await (await upgraded.getPool()).close(); };
      await upgraded.getPool();
    }
    expect(await service.getAllPitEntries(2026, "schema-upgrade", "FRC")).toEqual(beforeUpgrade);
    const optionalId = await service.addPitEntry(pit("schema-upgrade", { teamNumber: 492 }));
    expect(optionalId).toBeGreaterThan(0);
    await service.deletePitEntry(id);
    await service.deletePitEntry(optionalId);
  });

  it("round-trips pit and match data, updates by ID, and deletes", async () => {
    const p = pit("crud");
    const m = match("crud");
    const pitId = await service.addPitEntry(p);
    const matchId = await service.addMatchEntry(m);
    expect(pitId).toBeGreaterThan(0);
    expect(matchId).toBeGreaterThan(0);
    expect(await service.getAllPitEntries(2026, "crud", "FRC")).toMatchObject([{ ...p, id: pitId }]);
    expect(await service.getAllMatchEntries(2026, "crud", "FRC")).toMatchObject([{ ...m, id: matchId }]);
    await service.updatePitEntry(pitId, { notes: "Edited pit", gameSpecificData: { intake: ["ground"] } });
    await service.updateMatchEntry(matchId, { notes: "Edited match", gameSpecificData: { teleop: { fuel_scored: 9 } } });
    expect(await service.getAllPitEntries(2026, "crud", "FRC")).toMatchObject([{ notes: "Edited pit", gameSpecificData: { intake: ["ground"] } }]);
    expect(await service.getAllMatchEntries(2026, "crud", "FRC")).toMatchObject([{ notes: "Edited match", gameSpecificData: { teleop: { fuel_scored: 9 } } }]);
    await service.deletePitEntry(pitId);
    await service.deleteMatchEntry(matchId);
    expect(await service.getAllPitEntries(2026, "crud", "FRC")).toEqual([]);
    expect(await service.getAllMatchEntries(2026, "crud", "FRC")).toEqual([]);
  });

  it("enforces duplicate scouting constraints under concurrent writes", async () => {
    for (const kind of ["pit", "match"] as const) {
      const write = () => kind === "pit" ? service.addPitEntry(pit("duplicates")) : service.addMatchEntry(match("duplicates"));
      const results = await Promise.allSettled([write(), write()]);
      expect(results.filter((result) => result.status === "fulfilled")).toHaveLength(1);
      const failure = results.find((result) => result.status === "rejected");
      expect(failure?.status === "rejected" && failure.reason.message).toMatch(/duplicate/i);
    }
  });

  it("isolates scouting data by event, season and competition", async () => {
    const scopes = [
      { year: 2026, competitionType: "FRC" as const, eventCode: "scope" },
      { year: 2025, competitionType: "FRC" as const, eventCode: "scope" },
      { year: 2026, competitionType: "FTC" as const, eventCode: "scope" },
      { year: 2026, competitionType: "FRC" as const, eventCode: "other" },
    ];
    for (const scope of scopes) {
      await service.addPitEntry(pit(scope.eventCode, scope));
      await service.addMatchEntry(match(scope.eventCode, scope));
    }
    for (const scope of scopes) {
      const pits = await service.getAllPitEntries(scope.year, scope.eventCode, scope.competitionType);
      const matches = await service.getAllMatchEntries(scope.year, scope.eventCode, scope.competitionType);
      expect(pits).toHaveLength(1);
      expect(matches).toHaveLength(1);
      expect(pits[0]).toMatchObject(scope);
      expect(matches[0]).toMatchObject(scope);
    }
  });

  it("exports and reimports editable records with working IDs and timestamps", async () => {
    const pitId = await service.addPitEntry(pit("roundtrip", { teamNumber: 492, year: 2027 }));
    const matchId = await service.addMatchEntry(match("roundtrip", { teamNumber: 492, year: 2027 }));
    const exported = await service.exportData(2027);
    await service.deletePitEntry(pitId);
    await service.deleteMatchEntry(matchId);
    // Model the serialization performed by an actual JSON export/download.
    await service.importData(JSON.parse(JSON.stringify(exported)));
    const imported = await service.exportData(2027);
    expect(imported.pitEntries).toHaveLength(1);
    expect(imported.matchEntries).toHaveLength(1);
    expect(imported.matchEntries[0].timestamp).toEqual(new Date("2026-10-23T12:30:45Z"));
    await service.updatePitEntry(imported.pitEntries[0].id!, { notes: "Imported edit" });
    await service.updateMatchEntry(imported.matchEntries[0].id!, { notes: "Imported edit" });
    expect((await service.exportData(2027)).pitEntries[0].notes).toBe("Imported edit");
    expect((await service.exportData(2027)).matchEntries[0].notes).toBe("Imported edit");
  });

  it("atomically reserves usernames and persists activation and password changes", async () => {
    const create = (id: string) => service.users!.create({ id, name: "Scout", username: "NewScout", passwordHash: "old-hash", role: "scout" });
    const results = await Promise.allSettled([create("one"), create("two")]);
    expect(results.filter((result) => result.status === "fulfilled")).toHaveLength(1);
    const user = await service.users!.getByUsername("newscout");
    expect(user?.password_hash).toBe("old-hash");
    await service.updateUser(user!.id, { passwordHash: "new-hash" });
    await service.users!.setActive(user!.id, false);
    expect(await service.users!.list()).toEqual([]);
    expect(await service.users!.getById(user!.id)).toMatchObject({ password_hash: "new-hash", sessionVersion: 1 });
    await service.users!.setActive(user!.id, true);
    expect(await service.users!.getById(user!.id)).toMatchObject({ deactivatedAt: null, sessionVersion: 2 });
    expect(await service.users!.list()).toMatchObject([{ id: user!.id }]);
  });
});
