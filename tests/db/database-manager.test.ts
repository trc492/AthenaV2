import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";

vi.mock("@/db/azuresql-database-service", () => ({
  AzureSqlDatabaseService: class AzureSqlDatabaseService {
    constructor(public config: any) {}
  },
}));

vi.mock("@/db/local-database-service", () => ({
  LocalDatabaseService: class LocalDatabaseService {
    constructor(public config: any) {}
  },
}));

vi.mock("@/db/firebase-database-service", () => ({
  FirebaseDatabaseService: class FirebaseDatabaseService {
    constructor(public config: any) {}
  },
}));

vi.mock("@/db/cosmos-database-service", () => ({
  CosmosDatabaseService: class CosmosDatabaseService {
    constructor(public config: any) {}
  },
}));

vi.mock("@/lib/server/env-file", () => ({
  loadPersistedDatabaseConfig: vi.fn(() => null),
  savePersistedDatabaseConfig: vi.fn(),
}));

const ORIGINAL_ENV = process.env;

function resetEnv() {
  process.env = { ...ORIGINAL_ENV };
}

async function loadManager() {
  const mod = await import("@/db/database-manager");
  return mod.DatabaseManager.getInstance();
}

beforeEach(() => {
  vi.resetModules();
  resetEnv();
});

afterEach(() => {
  resetEnv();
});

describe("DatabaseManager provider selection", () => {
  it("uses DATABASE_PROVIDER when set to firebase", async () => {
    process.env.DATABASE_PROVIDER = "firebase";
    process.env.FIREBASE_SERVICE_ACCOUNT_JSON = "{}";

    const manager = await loadManager();
    expect(manager.getConfig()?.provider).toBe("firebase");
  });

  it("uses azuresql when AZURE_SQL_CONNECTION_STRING is set", async () => {
    process.env.AZURE_SQL_CONNECTION_STRING = "Server=local;Database=athena;";

    const manager = await loadManager();
    expect(manager.getConfig()?.provider).toBe("azuresql");
  });

  it("uses mariadb when configured and no higher-priority providers exist", async () => {
    process.env.MARIADB_CONNECTION_STRING = "Server=local;Database=athena;";

    const manager = await loadManager();
    expect(manager.getConfig()?.provider).toBe("mariadb");
    expect(manager.getConfig()?.mariadb?.connectionString).toBe(
      "Server=local;Database=athena;",
    );
  });
});
