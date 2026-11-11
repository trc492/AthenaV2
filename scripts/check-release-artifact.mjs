import assert from "node:assert/strict";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

const root = ".next/standalone";
assert.ok(existsSync(join(root, "server.js")), "Build the standalone application first");
for (const forbidden of [".runtime", ".env", ".env.local", ".env.production", ".env.production.local"]) {
  assert.ok(!existsSync(join(root, forbidden)), `${forbidden} must not be packaged`);
}
const config = JSON.parse(readFileSync(".next/required-server-files.json", "utf8")).config;
for (const name of ["AUTH_SECRET", "NEXTAUTH_SECRET", "SETUP_TOKEN"]) {
  assert.ok(!(name in (config.env ?? {})), `${name} must not be inlined by Next.js`);
}

// A caller can supply a non-production sentinel to prove its build-time value
// was not embedded. The sentinel is never printed, even when a check fails.
const sentinel = process.env.RELEASE_SECRET_SENTINEL;
if (sentinel) {
  const inspect = (directory) => {
    for (const entry of readdirSync(directory, { withFileTypes: true })) {
      const path = join(directory, entry.name);
      if (entry.isDirectory()) {
        if (entry.name !== "node_modules") inspect(path);
      } else if (/\.(js|json|html|map)$/.test(entry.name)) {
        assert.ok(!readFileSync(path, "utf8").includes(sentinel), `Build-time secret embedded in ${path}`);
      }
    }
  };
  inspect(root);
  inspect(".next/static");
}
console.log("Release artifact checks passed: runtime state excluded and auth secrets not inlined.");
