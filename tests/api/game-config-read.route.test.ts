import { beforeEach, expect, it, vi } from "vitest";
import original from "../../config/years/FRC-2026.json";
import type { GameConfig } from "@/lib/types";

const { readSessionToken, verifyGuestEventLink, loadGameConfig } = vi.hoisted(() => ({
  readSessionToken: vi.fn(), verifyGuestEventLink: vi.fn(), loadGameConfig: vi.fn(),
}));
vi.mock("@/lib/server/auth-request", () => ({ readSessionToken }));
vi.mock("@/lib/server/event-guest", () => ({ verifyGuestEventLink }));
vi.mock("@/lib/server/game-config-store", () => ({ loadGameConfig }));
import { NextRequest } from "next/server";
import { GET as get } from "@/app/api/scouting/config/route";

const GET = () => get(new NextRequest("http://test/api/scouting/config"));

beforeEach(() => {
  readSessionToken.mockResolvedValue({ id: "scout", role: "scout" });
  verifyGuestEventLink.mockReset();
  loadGameConfig.mockReturnValue({ FRC: { "2026": original }, FTC: {} } as GameConfig);
});

it("lets scouts read the current configuration without admin permissions or caching", async () => {
  const first = await GET();
  expect(first.status).toBe(200);
  expect(first.headers.get("Cache-Control")).toContain("no-store");
  expect((await first.json()).config.FRC["2026"].gameName).toBe(original.gameName);
  loadGameConfig.mockReturnValue({ FRC: { "2026": { ...original, gameName: "Saved change" } }, FTC: {} });
  expect((await (await GET()).json()).config.FRC["2026"].gameName).toBe("Saved change");
});

it("rejects signed-out reads before loading configuration", async () => {
  readSessionToken.mockResolvedValue(null);
  expect((await GET()).status).toBe(401);
  expect(loadGameConfig).not.toHaveBeenCalled();
});

it("rejects guests whose signed link no longer verifies", async () => {
  readSessionToken.mockResolvedValue({ role: "guest", guestToken: "expired" });
  verifyGuestEventLink.mockReturnValue(null);
  expect((await GET()).status).toBe(401);
});

it("restricts guest reads to the season in their signed session", async () => {
  readSessionToken.mockResolvedValue({ role: "guest", guestToken: "signed" });
  verifyGuestEventLink.mockReturnValue({ competitionType: "FRC", year: 2026 });
  loadGameConfig.mockReturnValue({ FRC: { "2025": original, "2026": original }, FTC: { "2026": original } });
  expect((await (await GET()).json()).config).toEqual({ FRC: { "2026": original }, FTC: {} });
});

it("reports corrupt persisted data instead of returning bundled defaults", async () => {
  vi.spyOn(console, "error").mockImplementation(() => {});
  loadGameConfig.mockImplementation(() => { throw new Error("Invalid JSON"); });
  expect((await GET()).status).toBe(500);
});
