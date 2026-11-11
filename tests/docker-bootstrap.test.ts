import { afterEach, describe, expect, it } from "vitest";
import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { spawnSync } from "node:child_process";

const directories: string[] = [];
const entrypoint = resolve("scripts/docker-entrypoint.mjs");
function installation() {
  const cwd = mkdtempSync(join(tmpdir(), "athena-container-"));
  directories.push(cwd);
  writeFileSync(join(cwd, "server.js"), `console.log(JSON.stringify({auth:process.env.AUTH_SECRET,setup:process.env.SETUP_TOKEN}));`);
  return cwd;
}
function start(cwd: string, overrides: Record<string, string> = {}) {
  const env = { ...process.env };
  for (const key of ["AUTH_SECRET", "NEXTAUTH_SECRET", "SETUP_TOKEN", "ATHENA_SETUP_ENABLED"]) delete env[key];
  return spawnSync(process.execPath, [entrypoint], { cwd, env: { ...env, ...overrides }, encoding: "utf8" });
}
afterEach(() => directories.splice(0).forEach((path) => rmSync(path, { recursive: true, force: true })));

describe("container bootstrap", () => {
  it("creates independent secrets once and retains them across replacements", () => {
    const cwd = installation();
    const first = start(cwd);
    expect(first.status).toBe(0);
    const auth = JSON.parse(readFileSync(join(cwd, ".runtime/auth-secret.json"), "utf8")).secret;
    const setup = JSON.parse(readFileSync(join(cwd, ".runtime/setup-token.json"), "utf8")).secret;
    expect(auth).toHaveLength(96);
    expect(setup).not.toBe(auth);
    expect(start(cwd).stdout).toBe(first.stdout);
  });

  it("honors supplied secrets and can disable setup", () => {
    const cwd = installation();
    const auth = "operator-auth-".repeat(4);
    const result = start(cwd, { AUTH_SECRET: auth, SETUP_TOKEN: "operator-setup-".repeat(4), ATHENA_SETUP_ENABLED: "false" });
    expect(result.status).toBe(0);
    expect(JSON.parse(result.stdout)).toEqual({ auth });
  });

  it("fails instead of silently rotating a damaged persisted credential", () => {
    const cwd = installation();
    mkdirSync(join(cwd, ".runtime"));
    writeFileSync(join(cwd, ".runtime/auth-secret.json"), '{"secret":"bad"}');
    const result = start(cwd);
    expect(result.status).not.toBe(0);
    expect(result.stderr).toContain("restore the runtime volume");
  });
});
