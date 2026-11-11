import { test, expect, type Page } from "@playwright/test";
import { prepare } from "./helpers/scouting";
import original from "../config/years/FRC-2026.json";

// Configuration polling runs every two minutes while the tab is active.
const configRefreshElapsed = 121_000;

async function prepareEditor(page: Page) {
  await prepare(page, "FRC", 2026);
  const state = { config: structuredClone(original), failLoad: false, failSave: false, writes: 0 };
  state.config.gameName = "Saved server configuration";
  await page.context().route("**/api/auth/session", (route) => route.fulfill({ json: {
    user: { id: "admin", name: "Config Admin", role: "admin" },
    expires: new Date(Date.now() + 86400000).toISOString(),
  } }));
  await page.context().route("**/api/scouting/config", (route) => route.fulfill({ json: {
    config: { FRC: { "2026": state.config }, FTC: {} },
  } }));
  await page.context().route("**/api/scouting/admin/configs**", async (route) => {
    if (route.request().method() === "POST") {
      state.writes++;
      if (state.failSave) return route.fulfill({ status: 500, json: { error: "Disk unavailable" } });
      state.config = route.request().postDataJSON().config;
      return route.fulfill({ json: { config: state.config, filename: "FRC-2026.json", success: true } });
    }
    if (state.failLoad) return route.fulfill({ status: 500, json: { error: "Configuration unavailable" } });
    if (new URL(route.request().url()).searchParams.has("file")) {
      return route.fulfill({ json: { config: state.config } });
    }
    return route.fulfill({ json: { configs: [{ filename: "FRC-2026.json", competitionType: "FRC", year: 2026, gameName: state.config.gameName, isBuiltin: false }] } });
  });
  return state;
}

async function openJson(page: Page) {
  await page.getByRole("button", { name: "JSON", exact: true }).click();
  return page.getByRole("textbox", { name: "Configuration JSON" });
}

test("loads saved data on entry, publishes changes to an open scout tab, and retains them on reload", async ({ page }) => {
  const state = await prepareEditor(page);
  const scout = await page.context().newPage();
  await scout.goto("/scout/matchscout");
  await expect(scout.getByText("Fuel Scored (Auto)", { exact: true })).toBeVisible();
  await page.goto("/dashboard/admin/game-config");
  const json = await openJson(page);
  await expect(json).toHaveValue(/Saved server configuration/);
  const changed = structuredClone(state.config);
  changed.scoring.autonomous.fuel_scored.label = "Updated auto scoring";
  await json.fill(JSON.stringify(changed));
  await page.getByRole("button", { name: "Apply JSON to editor" }).click();
  await expect(page.getByRole("status").filter({ hasText: "Unsaved changes" })).toBeVisible();
  await page.getByRole("button", { name: "Save Config", exact: true }).click();
  await expect(page.getByRole("status").filter({ hasText: "All changes saved" })).toBeVisible();
  await scout.bringToFront();
  await scout.evaluate(() => window.dispatchEvent(new Event("focus")));
  await expect(scout.getByText("Updated auto scoring", { exact: true })).toBeVisible();
  await page.reload();
  await expect(await openJson(page)).toHaveValue(/Updated auto scoring/);
  expect(state.writes).toBe(1);
});

test("failed initial reads show retry instead of editable bundled defaults", async ({ page }) => {
  const state = await prepareEditor(page);
  state.failLoad = true;
  await page.goto("/dashboard/admin/game-config");
  await expect(page.getByRole("alert").filter({ hasText: "Configuration unavailable" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Save Config", exact: true })).toHaveCount(0);
  state.failLoad = false;
  await page.getByRole("button", { name: "Retry loading configurations" }).click();
  await expect(await openJson(page)).toHaveValue(/Saved server configuration/);
});

test("invalid JSON cannot be applied and a failed save keeps the draft for retry", async ({ page }) => {
  const state = await prepareEditor(page);
  await page.goto("/dashboard/admin/game-config");
  const json = await openJson(page);
  await json.fill("{");
  await expect(page.getByRole("button", { name: "Apply JSON to editor" })).toBeDisabled();
  await json.fill(JSON.stringify({ ...state.config, gameName: "Retry draft" }));
  await page.getByRole("button", { name: "Apply JSON to editor" }).click();
  state.failSave = true;
  await page.getByRole("button", { name: "Save Config", exact: true }).click();
  await expect(page.getByRole("status").filter({ hasText: "Unsaved changes" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Save Config", exact: true })).toBeEnabled();
  expect(state.config.gameName).toBe("Saved server configuration");
  state.failSave = false;
  await page.getByRole("button", { name: "Save Config", exact: true }).click();
  await expect(page.getByRole("status").filter({ hasText: "All changes saved" })).toBeVisible();
  expect(state.config.gameName).toBe("Retry draft");
});

test("open clients pick up remote edits on the periodic refresh and keep data when refresh fails", async ({ page }) => {
  const state = await prepareEditor(page);
  await page.clock.install();
  await page.goto("/scout/matchscout");
  await expect(page.getByText("Fuel Scored (Auto)", { exact: true })).toBeVisible();
  await page.locator("#matchNumber").fill("12");
  await page.getByPlaceholder("Enter team number (e.g. 254)").fill("254");
  state.config.scoring.autonomous.fuel_scored.label = "Remote edit";
  await page.clock.fastForward(configRefreshElapsed);
  await expect(page.getByText("Remote edit", { exact: true })).toBeVisible();
  await expect(page.locator("#matchNumber")).toHaveValue("12");
  await expect(page.getByPlaceholder("Enter team number (e.g. 254)")).toHaveValue("254");
  await page.route("**/api/scouting/config", (route) => route.fulfill({ status: 500, json: { error: "Unavailable" } }));
  const failedRefresh = page.waitForResponse((response) =>
    new URL(response.url()).pathname === "/api/scouting/config" && response.status() === 500);
  await page.clock.fastForward(configRefreshElapsed);
  await failedRefresh;
  await expect(page.getByText("Remote edit", { exact: true })).toBeVisible();
});

test("pit scouting retains entered values when configuration changes", async ({ page }) => {
  const state = await prepareEditor(page);
  await page.clock.install();
  await page.goto("/scout/pitscout");
  await expect(page.getByText("Saved server configuration", { exact: false }).first()).toBeVisible();
  await page.getByPlaceholder("Enter team number (e.g. 254)").fill("254");
  await page.locator("#notes").fill("Keep these pit observations");
  state.config.gameName = "Updated pit configuration";
  await page.clock.fastForward(configRefreshElapsed);
  await expect(page.getByText("Updated pit configuration", { exact: false }).first()).toBeVisible();
  await expect(page.getByPlaceholder("Enter team number (e.g. 254)")).toHaveValue("254");
  await expect(page.locator("#notes")).toHaveValue("Keep these pit observations");
});

test("analysis reloads computed results when scoring configuration changes", async ({ page }) => {
  const state = await prepareEditor(page);
  let analysisReads = 0;
  await page.route("**/api/scouting/analysis/analysis?**", (route) => {
    analysisReads++;
    return route.fulfill({ json: { totalTeams: 0, totalMatches: 0, availableMetrics: [], teamEPAData: [] } });
  });
  await page.clock.install();
  await page.goto("/dashboard/analysis");
  await expect.poll(() => analysisReads).toBeGreaterThan(0);
  const beforeChange = analysisReads;
  state.config.scoring.autonomous.fuel_scored.points = 9;
  await page.clock.fastForward(configRefreshElapsed);
  await expect.poll(() => analysisReads).toBeGreaterThan(beforeChange);
});
