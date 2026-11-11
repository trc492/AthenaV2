import { randomBytes } from "node:crypto";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";

// Run only in the container, before Next loads its runtime configuration.
// The named volume retains these credentials when an image is replaced.
const directory = resolve(".runtime");
mkdirSync(directory, { recursive: true, mode: 0o700 });
function persistedSecret(filename) {
  const path = resolve(directory, filename);
  try {
    writeFileSync(path, JSON.stringify({ secret: randomBytes(48).toString("hex") }), {
      flag: "wx", mode: 0o600,
    });
  } catch (error) {
    if (error.code !== "EEXIST") throw error;
  }
  const value = JSON.parse(readFileSync(path, "utf8")).secret;
  if (typeof value !== "string" || value.length < 32) {
    throw new Error(`Invalid ${filename}; restore the runtime volume from backup.`);
  }
  return value;
}

process.env.AUTH_SECRET ||= process.env.NEXTAUTH_SECRET || persistedSecret("auth-secret.json");
if (process.env.ATHENA_SETUP_ENABLED === "false") {
  delete process.env.SETUP_TOKEN;
} else {
  process.env.SETUP_TOKEN ||= persistedSecret("setup-token.json");
  console.log("Athena: use the setup-token command in the installation guide to unlock browser setup.");
}

// Import in the same process so Node receives container shutdown signals directly.
await import(pathToFileURL(resolve("server.js")).href);
