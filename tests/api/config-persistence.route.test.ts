import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { NextRequest } from "next/server";
import original from "../../config/years/FRC-2026.json";

vi.mock("@/lib/auth/config", () => ({ auth: async () => ({ user: { id: "admin", role: "admin" } }) }));
vi.mock("@/lib/server/auth-request", () => ({ readSessionToken: async () => ({ id: "admin", role: "admin" }) }));
let directory: string;
beforeEach(() => {
  directory = mkdtempSync(join(tmpdir(), "athena-config-api-"));
  vi.spyOn(process, "cwd").mockReturnValue(directory);
  mkdirSync(join(directory, "config", "years"), { recursive: true });
  writeFileSync(join(directory, "config", "years", "FRC-2026.json"), JSON.stringify(original));
  vi.resetModules();
});
afterEach(() => {
  vi.restoreAllMocks();
  rmSync(directory, { recursive: true, force: true });
});

it("saves, lists, renames and deletes persistent overrides without changing bundled files", async () => {
  const route = await import("@/app/api/scouting/admin/configs/route");
  const request = (method: string, body: unknown) => new NextRequest("http://test/api/scouting/admin/configs", {
    method, headers: { "content-type": "application/json" }, body: JSON.stringify(body),
  });
  const saved = await route.POST(request("POST", {
    filename: "FRC-2026.json", config: { ...original, gameName: "Custom" },
  }));
  expect(saved.status).toBe(200);
  const reader = await import("@/app/api/scouting/config/route");
  expect((await (await reader.GET(new NextRequest("http://test/api/scouting/config"))).json()).config.FRC["2026"].gameName).toBe("Custom");
  const listed = await route.GET(new NextRequest("http://test/api/scouting/admin/configs"));
  expect((await listed.json()).configs).toContainEqual(expect.objectContaining({ filename: "FRC-2026.json", gameName: "Custom", isBuiltin: false }));
  expect((await (await route.GET(new NextRequest("http://test/api/scouting/admin/configs?file=FRC-2026.json"))).json()).config.gameName).toBe("Custom");

  expect((await route.PATCH(request("PATCH", {
    filename: "FRC-2026.json", competitionType: "FRC", year: 2030, gameName: "Next season",
  }))).status).toBe(200);
  const { loadGameConfig } = await import("@/lib/server/game-config-store");
  expect(loadGameConfig().FRC["2026"]).toBeUndefined();
  expect(loadGameConfig().FRC["2030"].gameName).toBe("Next season");
  expect((await route.DELETE(new NextRequest("http://test/api/scouting/admin/configs?file=FRC-2030.json"))).status).toBe(200);
  expect(loadGameConfig().FRC["2030"]).toBeUndefined();
  expect(JSON.parse(readFileSync(join(directory, "config", "years", "FRC-2026.json"), "utf8"))).toEqual(original);
});

it.each(["custom-season.json", "FTC-2026.json"])("rejects %s instead of saving a configuration the runtime would ignore or misidentify", async (filename) => {
  const route = await import("@/app/api/scouting/admin/configs/route");
  const response = await route.POST(new NextRequest("http://test/api/scouting/admin/configs", {
    method: "POST", headers: { "content-type": "application/json" },
    body: JSON.stringify({ filename, config: original }),
  }));
  expect(response.status).toBe(400);
});
