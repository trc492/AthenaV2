import { createHash, randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";
import { mkdir, rename, writeFile } from "node:fs/promises";
import { join } from "node:path";
import type { DatabaseConfig } from "@/lib/types";

const directory = join(process.cwd(), ".runtime");
const path = join(directory, "setup-completion.json");
let memory: { fingerprint: string; complete: boolean } | undefined;

function fingerprint(config: DatabaseConfig): string {
  // Tie the marker to the database configuration without storing credentials.
  return createHash("sha256").update(JSON.stringify(config)).digest("hex");
}

export function hasSavedSetupCompletion(config: DatabaseConfig): boolean {
  const key = fingerprint(config);
  if (memory?.fingerprint === key) return memory.complete;
  try {
    const saved = JSON.parse(readFileSync(path, "utf8"));
    return saved.fingerprint === key && saved.complete === true;
  } catch {
    return false;
  }
}

export async function saveSetupCompletion(
  config: DatabaseConfig,
  complete: boolean,
): Promise<void> {
  const state = { fingerprint: fingerprint(config), complete };
  if (memory?.fingerprint === state.fingerprint && memory.complete === complete) return;
  memory = state;
  try {
    await mkdir(directory, { recursive: true });
    const temporaryPath = `${path}.${randomUUID()}.tmp`;
    await writeFile(temporaryPath, `${JSON.stringify(state)}\n`, "utf8");
    await rename(temporaryPath, path);
  } catch (error) {
    // Keep the in-process marker on read-only deployments. A restart there
    // requires one fresh verification, rather than querying on every visit.
    console.warn("Unable to persist setup completion:", error);
  }
}
