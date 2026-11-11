import { readFileSync } from "node:fs";
import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { DatabaseConfig } from "@/lib/types";

const RUNTIME_DIR = join(/* turbopackIgnore: true */ process.cwd(), ".runtime");
const DATABASE_CONFIG_PATH = join(/* turbopackIgnore: true */ RUNTIME_DIR, "database-config.json");
const AUTH_SECRET_PATH = join(/* turbopackIgnore: true */ RUNTIME_DIR, "auth-secret.json");
const SYSTEM_SETTINGS_PATH = join(/* turbopackIgnore: true */ RUNTIME_DIR, "system-settings.json");
const APP_CONFIG_PATH = join(/* turbopackIgnore: true */ RUNTIME_DIR, "app-config.json");

export interface SystemSettings {
  /** When false, the public /signup page and POST /api/auth/register are disabled. */
  signupEnabled: boolean;
}

const DEFAULT_SYSTEM_SETTINGS: SystemSettings = {
  signupEnabled: false,
};

export function loadSystemSettings(): SystemSettings {
  try {
    const raw = readFileSync(/* turbopackIgnore: true */ SYSTEM_SETTINGS_PATH, "utf8");
    const parsed = JSON.parse(raw) as Partial<SystemSettings>;
    return { ...DEFAULT_SYSTEM_SETTINGS, ...parsed };
  } catch {
    return { ...DEFAULT_SYSTEM_SETTINGS };
  }
}

export async function saveSystemSettings(
  patch: Partial<SystemSettings>,
): Promise<SystemSettings> {
  const current = loadSystemSettings();
  const updated: SystemSettings = { ...current, ...patch };
  await mkdir(RUNTIME_DIR, { recursive: true });
  await writeFile(
    SYSTEM_SETTINGS_PATH,
    `${JSON.stringify(updated, null, 2)}\n`,
    "utf8",
  );
  return updated;
}

export function loadPersistedDatabaseConfig(): DatabaseConfig | null {
  try {
    const raw = readFileSync(/* turbopackIgnore: true */ DATABASE_CONFIG_PATH, "utf8");
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

export { getAuthSecret as getOrCreateAuthSecret } from "./runtime-secrets";

export {
  DATABASE_CONFIG_PATH,
  AUTH_SECRET_PATH,
  SYSTEM_SETTINGS_PATH,
  APP_CONFIG_PATH,
};

// ---------------------------------------------------------------------------
// App config — stores the canonical public URL for the deployment.
// Auth route handlers read this file at request time so setup changes also
// take effect in standalone Docker builds without rebuilding the image.
// ---------------------------------------------------------------------------

export interface AppConfig {
  /** The canonical public URL of the deployment, e.g. https://scouting.myteam.com */
  appUrl: string;
}

export function loadAppConfig(): AppConfig | null {
  try {
    const raw = readFileSync(/* turbopackIgnore: true */ APP_CONFIG_PATH, "utf8");
    const parsed = JSON.parse(raw) as Partial<AppConfig>;
    if (parsed?.appUrl) return parsed as AppConfig;
    return null;
  } catch {
    return null;
  }
}

export async function saveAppConfig(config: AppConfig): Promise<void> {
  await mkdir(RUNTIME_DIR, { recursive: true });
  await writeFile(
    APP_CONFIG_PATH,
    `${JSON.stringify(config, null, 2)}\n`,
    "utf8",
  );
}
