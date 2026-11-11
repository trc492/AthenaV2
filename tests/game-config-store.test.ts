import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import source from "../config/years/FRC-2026.json";
import type { YearConfig } from "@/lib/types";
import { deleteGameConfig, findGameConfigPath, loadGameConfig, saveGameConfig } from "@/lib/server/game-config-store";

let directory: string;
beforeEach(() => {
  directory = mkdtempSync(join(tmpdir(), "athena-config-"));
  vi.spyOn(process, "cwd").mockReturnValue(directory);
  mkdirSync(join(directory, "config", "years"), { recursive: true });
  writeFileSync(join(directory, "config", "years", "FRC-2026.json"), JSON.stringify(source));
});
afterEach(() => {
  vi.restoreAllMocks();
  rmSync(directory, { recursive: true, force: true });
});

describe("persistent game configuration", () => {
  it("preserves edits across module reloads and replacement of bundled files", async () => {
    await saveGameConfig("FRC-2026.json", { ...source, gameName: "Custom season" } as YearConfig);
    expect(findGameConfigPath("FRC-2026.json")).toBe(join(directory, ".runtime", "configs", "FRC-2026.json"));
    expect(JSON.parse(readFileSync(join(directory, "config", "years", "FRC-2026.json"), "utf8")).gameName).toBe(source.gameName);
    writeFileSync(join(directory, "config", "years", "FRC-2026.json"), JSON.stringify({ ...source, gameName: "New image default" }));
    vi.resetModules();
    const store = await import("@/lib/server/game-config-store");
    expect(store.loadGameConfig().FRC["2026"].gameName).toBe("Custom season");
    const { getYearConfig } = await import("@/lib/server/import-schema-validator");
    expect(getYearConfig("FRC", 2026)?.gameName).toBe("Custom season");
  });
  it("keeps deletions across upgrades and allows explicitly recreating a season", async () => {
    await deleteGameConfig("FRC-2026.json");
    expect(findGameConfigPath("FRC-2026.json")).toBeNull();
    expect(loadGameConfig().FRC["2026"]).toBeUndefined();
    await saveGameConfig("FRC-2026.json", source as YearConfig);
    expect(loadGameConfig().FRC["2026"].gameName).toBe(source.gameName);
  });
  it("does not silently score with defaults when a persisted override is corrupt", async () => {
    await saveGameConfig("FRC-2026.json", source as YearConfig);
    writeFileSync(findGameConfigPath("FRC-2026.json")!, "invalid-json");
    expect(() => loadGameConfig()).toThrow();
  });
});
