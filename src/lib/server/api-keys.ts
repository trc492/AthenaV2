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
 *  1. .runtime/api-keys.json (persisted via the settings UI / json config)
 *  2. Environment variables (set by user, docker, or CI)
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

  const resolveKey = (persistedVal: string | undefined, envVal: string | undefined): string => {
    if (persistedVal !== undefined && persistedVal.trim() !== "") {
      return persistedVal.trim();
    }
    if (envVal !== undefined && envVal.trim() !== "") {
      return envVal.trim();
    }
    return "";
  };

  return {
    tbaApiKey: resolveKey(persisted.tbaApiKey, process.env.TBA_API_KEY),
    ftcApiKey: resolveKey(persisted.ftcApiKey, process.env.FTC_API_KEY),
    nexusApiKey: resolveKey(persisted.nexusApiKey, process.env.NEXUS_API_KEY),
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
    persistedVal: string | undefined,
    envVar: string | undefined,
  ): { configured: boolean; source: "env" | "persisted" | "none" } {
    // If explicitly configured in the persisted JSON config, mark as persisted (editable)
    if (persistedVal !== undefined && persistedVal.trim() !== "") {
      return { configured: true, source: "persisted" };
    }
    // If set via environment variable only, mark as env (locked)
    if (envVar !== undefined && envVar.trim() !== "") {
      return { configured: true, source: "env" };
    }
    return { configured: false, source: "none" };
  }

  return {
    tbaApiKey: status(persisted.tbaApiKey, process.env.TBA_API_KEY),
    ftcApiKey: status(persisted.ftcApiKey, process.env.FTC_API_KEY),
    nexusApiKey: status(persisted.nexusApiKey, process.env.NEXUS_API_KEY),
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

  // Mirror to process.env for convenience in Node scripts/libraries
  if (merged.tbaApiKey !== undefined) {
    if (merged.tbaApiKey) process.env.TBA_API_KEY = merged.tbaApiKey;
    else delete process.env.TBA_API_KEY;
  }
  if (merged.ftcApiKey !== undefined) {
    if (merged.ftcApiKey) process.env.FTC_API_KEY = merged.ftcApiKey;
    else delete process.env.FTC_API_KEY;
  }
  if (merged.nexusApiKey !== undefined) {
    if (merged.nexusApiKey) process.env.NEXUS_API_KEY = merged.nexusApiKey;
    else delete process.env.NEXUS_API_KEY;
  }
}

export { API_KEYS_PATH };
