import { existsSync, readdirSync, readFileSync } from "node:fs";
import { mkdir, rename, writeFile, unlink } from "node:fs/promises";
import { join } from "node:path";
import { randomUUID } from "node:crypto";
import bundled from "../../../config/game-config-loader";
import type { GameConfig, YearConfig } from "@/lib/types";

// These files are mounted/copied explicitly by deployment packaging, not traced
// from the developer machine into the standalone server.
export function configDirectories() {
  return {
    builtin: join(/* turbopackIgnore: true */ process.cwd(), "config", "years"),
    runtime: join(/* turbopackIgnore: true */ process.cwd(), ".runtime", "configs"),
    deleted: join(/* turbopackIgnore: true */ process.cwd(), ".runtime", "configs", "deleted"),
  };
}

export function isConfigDeleted(filename: string) {
  return existsSync(/* turbopackIgnore: true */ join(/* turbopackIgnore: true */ configDirectories().deleted, filename));
}

export function findGameConfigPath(filename: string) {
  if (isConfigDeleted(filename)) return null;
  const { runtime, builtin } = configDirectories();
  return [join(/* turbopackIgnore: true */ runtime, filename), join(/* turbopackIgnore: true */ builtin, filename)].find((path) => existsSync(/* turbopackIgnore: true */ path)) ?? null;
}

async function atomicWrite(path: string, content: string) {
  const temporary = `${path}.${randomUUID()}.tmp`;
  try {
    await writeFile(temporary, content, { encoding: "utf8", mode: 0o600 });
    await rename(temporary, path);
  } finally {
    await unlink(temporary).catch((error: NodeJS.ErrnoException) => {
      if (error.code !== "ENOENT") throw error;
    });
  }
}

export async function saveGameConfig(filename: string, config: YearConfig) {
  const { runtime, deleted } = configDirectories();
  await mkdir(runtime, { recursive: true });
  await atomicWrite(join(/* turbopackIgnore: true */ runtime, filename), `${JSON.stringify(config, null, 2)}\n`);
  await unlink(join(/* turbopackIgnore: true */ deleted, filename)).catch((error: NodeJS.ErrnoException) => {
    if (error.code !== "ENOENT") throw error;
  });
}

/** Keep bundled files immutable; tombstones survive image upgrades. */
export async function deleteGameConfig(filename: string) {
  const { deleted } = configDirectories();
  await mkdir(deleted, { recursive: true });
  await atomicWrite(join(/* turbopackIgnore: true */ deleted, filename), "{}\n");
}

/** Read at request time so forms, imports and analytics share the same config. */
export function loadGameConfig(): GameConfig {
  const config = structuredClone(bundled) as GameConfig;
  const { builtin, runtime, deleted } = configDirectories();
  for (const directory of [builtin, runtime, deleted]) {
    if (!existsSync(/* turbopackIgnore: true */ directory)) continue;
    for (const filename of readdirSync(/* turbopackIgnore: true */ directory)) {
      const match = /^(FRC|FTC)-(\d{4})\.json$/i.exec(filename);
      if (!match) continue;
      const program = match[1].toUpperCase() as "FRC" | "FTC";
      const year = match[2];
      if (directory === deleted) {
        delete config[program]?.[year];
      } else {
        // Fail visibly on corrupt persisted configuration rather than silently
        // calculating scores with an older bundled season.
        const value = JSON.parse(readFileSync(/* turbopackIgnore: true */ join(/* turbopackIgnore: true */ directory, filename), "utf8")) as YearConfig;
        config[program] ??= {};
        config[program][year] = value;
      }
    }
  }
  return config;
}
