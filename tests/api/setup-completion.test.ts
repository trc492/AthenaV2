import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  config: { provider: "azuresql", azuresql: { server: "one", database: "athena" } },
  configured: true,
  appUrl: "https://athena.test",
  hasAdmin: vi.fn(),
  files: new Map<string, string>(),
  failWrites: false,
}));

vi.mock("node:fs", () => ({
  readFileSync: (path: string) => {
    const value = mocks.files.get(path);
    if (value === undefined) throw new Error("Missing file");
    return value;
  },
}));
vi.mock("node:fs/promises", () => ({
  mkdir: vi.fn(),
  writeFile: async (path: string, value: string) => {
    if (mocks.failWrites) throw new Error("Read-only filesystem");
    mocks.files.set(path, value);
  },
  rename: async (from: string, to: string) => {
    mocks.files.set(to, mocks.files.get(from)!);
    mocks.files.delete(from);
  },
}));
vi.mock("@/db/database-manager", () => ({
  databaseManager: {
    isConfigured: () => mocks.configured,
    getConfig: () => mocks.config,
    getService: () => ({ users: { hasAdmin: mocks.hasAdmin } }),
  },
}));
vi.mock("@/lib/server/env-file", () => ({
  loadAppConfig: () => ({ appUrl: mocks.appUrl }),
}));
vi.mock("@/lib/server/user-service", () => ({ hasAnyAdmin: mocks.hasAdmin }));

beforeEach(() => {
  vi.resetModules();
  mocks.files.clear();
  mocks.config.azuresql.server = "one";
  mocks.configured = true;
  mocks.appUrl = "https://athena.test";
  mocks.failWrites = false;
  mocks.hasAdmin.mockReset().mockResolvedValue(true);
});

describe("public setup completion", () => {
  it("avoids database queries on repeated visits and after a restart", async () => {
    let { checkSetupStatus } = await import("@/lib/server/setup");
    expect((await checkSetupStatus({ useCachedCompletion: true })).isComplete).toBe(true);
    await checkSetupStatus({ useCachedCompletion: true });
    vi.resetModules();
    ({ checkSetupStatus } = await import("@/lib/server/setup"));
    await checkSetupStatus({ useCachedCompletion: true });
    expect(mocks.hasAdmin).toHaveBeenCalledTimes(1);
  });

  it("does not cache incomplete setup or bypass live setup checks", async () => {
    const { checkSetupStatus } = await import("@/lib/server/setup");
    await checkSetupStatus({ useCachedCompletion: true });
    mocks.hasAdmin.mockResolvedValue(false);
    expect((await checkSetupStatus()).needsAdmin).toBe(true);
    expect((await checkSetupStatus({ useCachedCompletion: true })).needsAdmin).toBe(true);
    mocks.hasAdmin.mockResolvedValue(true);
    expect((await checkSetupStatus({ useCachedCompletion: true })).isComplete).toBe(true);
    expect(mocks.hasAdmin).toHaveBeenCalledTimes(4);
  });

  it("verifies a changed database rather than reusing another database's marker", async () => {
    const { checkSetupStatus } = await import("@/lib/server/setup");
    await checkSetupStatus({ useCachedCompletion: true });
    mocks.config.azuresql.server = "two";
    mocks.hasAdmin.mockResolvedValue(false);
    expect((await checkSetupStatus({ useCachedCompletion: true })).needsAdmin).toBe(true);
    expect(mocks.hasAdmin).toHaveBeenCalledTimes(2);
  });

  it("still requires the local app URL and database configuration", async () => {
    const { checkSetupStatus } = await import("@/lib/server/setup");
    await checkSetupStatus({ useCachedCompletion: true });
    mocks.appUrl = "";
    expect(await checkSetupStatus({ useCachedCompletion: true })).toMatchObject({ isComplete: false, needsAppUrl: true });
    mocks.configured = false;
    expect((await checkSetupStatus({ useCachedCompletion: true })).needsDatabase).toBe(true);
    expect(mocks.hasAdmin).toHaveBeenCalledTimes(1);
  });

  it("does not persist completion after a failed database check", async () => {
    const { checkSetupStatus } = await import("@/lib/server/setup");
    mocks.hasAdmin.mockRejectedValueOnce(new Error("Database unavailable"));
    vi.spyOn(console, "warn").mockImplementation(() => {});
    await checkSetupStatus({ useCachedCompletion: true });
    await checkSetupStatus({ useCachedCompletion: true });
    expect(mocks.hasAdmin).toHaveBeenCalledTimes(2);
  });

  it("avoids repeated queries when runtime storage is read-only", async () => {
    mocks.failWrites = true;
    vi.spyOn(console, "warn").mockImplementation(() => {});
    const { checkSetupStatus } = await import("@/lib/server/setup");
    await checkSetupStatus({ useCachedCompletion: true });
    await checkSetupStatus({ useCachedCompletion: true });
    expect(mocks.hasAdmin).toHaveBeenCalledTimes(1);
  });
});
