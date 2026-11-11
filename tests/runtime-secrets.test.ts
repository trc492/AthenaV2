import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { getAuthSecret, getSetupToken } from "@/lib/server/runtime-secrets";

let directory: string;
beforeEach(() => {
  directory = mkdtempSync(join(tmpdir(), "athena-secrets-"));
  vi.spyOn(process, "cwd").mockReturnValue(directory);
  vi.stubEnv("AUTH_SECRET", "");
  vi.stubEnv("NEXTAUTH_SECRET", "");
  vi.stubEnv("SETUP_TOKEN", "");
});
afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllEnvs();
  rmSync(directory, { recursive: true, force: true });
});

describe("runtime secrets", () => {
  it("fails closed in production without deployment secrets", () => {
    vi.stubEnv("NODE_ENV", "production");
    expect(() => getAuthSecret()).toThrow("Set AUTH_SECRET");
    expect(() => getSetupToken()).toThrow("Set SETUP_TOKEN");
    vi.stubEnv("AUTH_SECRET", "short");
    expect(() => getAuthSecret()).toThrow("32 characters");
  });
  it("reads a new deployment secret without rebuilding or reimporting", () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("AUTH_SECRET", "a".repeat(48));
    expect(getAuthSecret()).toBe("a".repeat(48));
    vi.stubEnv("AUTH_SECRET", "b".repeat(48));
    expect(getAuthSecret()).toBe("b".repeat(48));
    vi.stubEnv("AUTH_SECRET", "");
    vi.stubEnv("NEXTAUTH_SECRET", "c".repeat(48));
    expect(getAuthSecret()).toBe("c".repeat(48));
  });
  it("persists distinct development secrets across module reloads", async () => {
    vi.stubEnv("NODE_ENV", "development");
    const auth = getAuthSecret();
    const setup = getSetupToken();
    expect(auth.length).toBeGreaterThanOrEqual(32);
    expect(auth).not.toBe(setup);
    vi.resetModules();
    const reloaded = await import("@/lib/server/runtime-secrets");
    expect(reloaded.getAuthSecret()).toBe(auth);
    expect(reloaded.getSetupToken()).toBe(setup);
  });
});
