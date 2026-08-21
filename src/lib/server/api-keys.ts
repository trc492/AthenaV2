import { readFileSync } from "node:fs";
import { existsSync } from "node:fs";
import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";

const RUNTIME_DIR = join(process.cwd(), ".runtime");
const API_KEYS_PATH = join(RUNTIME_DIR, "api-keys.json");

export interface ApiKeys {
  tbaApiKey: string;
  ftcApiKey: string;
  nexusApiKey: string;
}

const EMPTY_KEYS: ApiKeys = {
  tbaApiKey: "",
  ftcApiKey: "",
  nexusApiKey: "",
};

/**
 * Load API keys with this priority:
 *  1. Environment variables (set by user or CI)
 *  2. .runtime/api-keys.json (persisted via the settings UI)
 *  3. Empty strings (keys simply not configured yet)
 */
export function loadApiKeys(): ApiKeys {
  // Start from persisted file
  let persisted: Partial<ApiKeys> = {};
  if (existsSync(API_KEYS_PATH)) {
    try {
      persisted = JSON.parse(readFileSync(API_KEYS_PATH, "utf8")) as Partial<ApiKeys>;
    } catch {
      // ignore parse errors
    }
  }

  return {
    tbaApiKey: process.env.TBA_API_KEY || persisted.tbaApiKey || "",
    ftcApiKey: process.env.FTC_API_KEY || persisted.ftcApiKey || "",
    nexusApiKey: process.env.NEXUS_API_KEY || persisted.nexusApiKey || "",
  };
}

/**
 * Returns a summary of which keys are set (without exposing the values)
 * and which source provided them (env or persisted).
 */
export function getApiKeyStatus(): Record<
  keyof ApiKeys,
  { configured: boolean; source: "env" | "persisted" | "none" }
> {
  let persisted: Partial<ApiKeys> = {};
  if (existsSync(API_KEYS_PATH)) {
    try {
      persisted = JSON.parse(readFileSync(API_KEYS_PATH, "utf8")) as Partial<ApiKeys>;
    } catch {
      // ignore
    }
  }

  function status(
    envVar: string | undefined,
    persistedVal: string | undefined,
  ): { configured: boolean; source: "env" | "persisted" | "none" } {
    if (envVar) return { configured: true, source: "env" };
    if (persistedVal) return { configured: true, source: "persisted" };
    return { configured: false, source: "none" };
  }

  return {
    tbaApiKey: status(process.env.TBA_API_KEY, persisted.tbaApiKey),
    ftcApiKey: status(process.env.FTC_API_KEY, persisted.ftcApiKey),
    nexusApiKey: status(process.env.NEXUS_API_KEY, persisted.nexusApiKey),
  };
}

export async function saveApiKeys(keys: Partial<ApiKeys>): Promise<void> {
  // Merge with any existing persisted keys so we don't wipe unset fields
  let existing: Partial<ApiKeys> = {};
  if (existsSync(API_KEYS_PATH)) {
    try {
      existing = JSON.parse(readFileSync(API_KEYS_PATH, "utf8")) as Partial<ApiKeys>;
    } catch {
      // ignore
    }
  }

  const merged: Partial<ApiKeys> = { ...existing };

  // Only overwrite keys that were explicitly provided (non-undefined)
  (Object.keys(keys) as (keyof ApiKeys)[]).forEach((k) => {
    if (keys[k] !== undefined) merged[k] = keys[k];
  });

  await mkdir(RUNTIME_DIR, { recursive: true });
  await writeFile(API_KEYS_PATH, JSON.stringify(merged, null, 2) + "\n", "utf8");

  // Patch process.env so running API clients pick up the new values immediately
  // without needing a server restart.
  if (merged.tbaApiKey !== undefined)
    process.env.TBA_API_KEY = merged.tbaApiKey;
  if (merged.ftcApiKey !== undefined)
    process.env.FTC_API_KEY = merged.ftcApiKey;
  if (merged.nexusApiKey !== undefined)
    process.env.NEXUS_API_KEY = merged.nexusApiKey;
}

export { API_KEYS_PATH };
