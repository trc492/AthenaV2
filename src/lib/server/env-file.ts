import { readFileSync } from "node:fs";
import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { DatabaseConfig } from "@/lib/types";

const RUNTIME_DIR = join(process.cwd(), ".runtime");
const DATABASE_CONFIG_PATH = join(RUNTIME_DIR, "database-config.json");
const AUTH_SECRET_PATH = join(RUNTIME_DIR, "auth-secret.json");

export function loadPersistedDatabaseConfig(): DatabaseConfig | null {
  try {
    const raw = readFileSync(DATABASE_CONFIG_PATH, "utf8");
    const parsed = JSON.parse(raw) as DatabaseConfig;
    return parsed;
  } catch {
    return null;
  }
}

export async function savePersistedDatabaseConfig(config: DatabaseConfig) {
  await mkdir(RUNTIME_DIR, { recursive: true });
  await writeFile(
    DATABASE_CONFIG_PATH,
    `${JSON.stringify(config, null, 2)}\n`,
    "utf8",
  );
}

/**
 * Returns the NEXTAUTH_SECRET.
 * next.config.ts handles the generate/persist/inject cycle, so by the time
 * any server-side code runs, process.env.NEXTAUTH_SECRET is always populated.
 * This function is kept for backwards compatibility with callers.
 */
export function getOrCreateAuthSecret(): string {
  // next.config.ts injects this for every runtime (Node + Edge).
  // Fall back to AUTH_SECRET in case someone sets only that.
  const secret = process.env.NEXTAUTH_SECRET || process.env.AUTH_SECRET;
  if (secret) return secret;

  // Should never reach here in practice, but guard defensively.
  throw new Error(
    "NEXTAUTH_SECRET is not available. This is a bug – next.config.ts should have injected it.",
  );
}

export { DATABASE_CONFIG_PATH, AUTH_SECRET_PATH };
