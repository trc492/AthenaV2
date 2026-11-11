import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { requireSetupToken, withSetupLock } from "@/lib/server/setup-access";

let directory: string;
const token = "setup-test-only-".repeat(4);
beforeEach(() => {
  directory = mkdtempSync(join(tmpdir(), "athena-setup-"));
  vi.spyOn(process, "cwd").mockReturnValue(directory);
  vi.stubEnv("NODE_ENV", "production");
  vi.stubEnv("SETUP_TOKEN", token);
});
afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllEnvs();
  rmSync(directory, { recursive: true, force: true });
});

describe("setup protection", () => {
  it("rejects absent and incorrect tokens and accepts the deployment token", () => {
    const request = (value: string) => new Request("https://athena.test/api/setup/admin", {
      headers: { "x-athena-setup-token": value },
    });
    expect(requireSetupToken(request(""))?.status).toBe(403);
    expect(requireSetupToken(request("wrong"))?.status).toBe(403);
    expect(requireSetupToken(request(token))).toBeNull();
    vi.stubEnv("SETUP_TOKEN", "");
    expect(requireSetupToken(request(token))?.status).toBe(503);
  });
  it("prevents concurrent setup mutations and releases the lock on failure", async () => {
    let release!: () => void;
    let entered!: () => void;
    const started = new Promise<void>((resolve) => { entered = resolve; });
    const pending = new Promise<void>((resolve) => { release = resolve; });
    const first = withSetupLock(async () => {
      entered();
      await pending;
      return new Response("ok");
    });
    await started;
    const blocked = vi.fn(async () => new Response("unexpected"));
    expect((await withSetupLock(blocked)).status).toBe(409);
    expect(blocked).not.toHaveBeenCalled();
    release();
    await first;
    await expect(withSetupLock(async () => { throw new Error("database down"); })).rejects.toThrow("database down");
    expect((await withSetupLock(async () => new Response("ok"))).status).toBe(200);
  });
});
