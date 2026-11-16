import { test, expect } from "@playwright/test";
import { prepare, fill, save } from "./helpers/scouting";

const matchNotes = (page: import("@playwright/test").Page) =>
  page.getByPlaceholder("Any additional observations about this match...");
const recovered = (page: import("@playwright/test").Page) =>
  page.getByText(/Recovered your unsaved (match|pit) entry/);

test("match: unsaved entry survives a reload and can be discarded", async ({ page }) => {
  await prepare(page);
  await fill(page, "match");
  await page.waitForFunction(() => Object.keys(localStorage).some((k) => k.startsWith("athena-draft:match:")));

  await page.reload();
  await expect(recovered(page)).toBeVisible();
  await expect(page.locator("#matchNumber")).toHaveValue("12");
  await page.getByRole("tab", { name: /Endgame/ }).click();
  await expect(matchNotes(page)).toHaveValue("Competition regression test");

  await page.getByRole("button", { name: "Discard" }).click();
  await expect(matchNotes(page)).toHaveValue("");
  await page.getByRole("tab", { name: /Auto/ }).click();
  await expect(page.locator("#matchNumber")).toHaveValue("12");
  await expect.poll(() => page.evaluate(() =>
    Object.keys(localStorage).filter((k) => k.startsWith("athena-draft:")).length)).toBe(0);

  await page.reload();
  await expect(page.locator("#matchNumber")).toBeVisible();
  await expect(recovered(page)).toHaveCount(0);
});

test("match: submitting clears the draft", async ({ page }) => {
  await prepare(page);
  await fill(page, "match");
  await save(page, "match").click();
  await expect(page.getByRole("status").filter({ hasText: "saved successfully" })).toBeVisible();
  await expect(page.locator("#matchNumber")).toHaveValue("13");
  await page.reload();
  await expect(page.locator("#matchNumber")).toBeVisible();
  await expect(recovered(page)).toHaveCount(0);
  await page.getByRole("tab", { name: /Endgame/ }).click();
  await expect(matchNotes(page)).toHaveValue("");
});

test("pit: unsaved entry survives a reload", async ({ page }) => {
  await prepare(page);
  await fill(page, "pit");
  await page.waitForFunction(() => Object.keys(localStorage).some((k) => k.startsWith("athena-draft:pit:")));
  await page.reload();
  await expect(recovered(page)).toBeVisible();
  await expect(page.locator("#notes")).toHaveValue("Competition regression test");
  await expect(page.getByPlaceholder("Enter team number (e.g. 254)")).toHaveValue("254");
});

test("match: the periodic session refresh does not unmount the form", async ({ page }) => {
  await page.clock.install();
  await prepare(page);
  // Hold refreshed session responses so next-auth stays in its "loading" state.
  let sessionRequests = 0;
  await page.route("**/api/auth/session", async (route) => {
    sessionRequests += 1;
    if (sessionRequests > 1) await new Promise((resolve) => setTimeout(resolve, 3000));
    await route.fallback();
  });
  await fill(page, "match");
  const before = sessionRequests;

  await page.clock.fastForward("05:01");
  await page.mouse.move(10, 10);
  await page.mouse.move(40, 40);
  await expect.poll(() => sessionRequests).toBeGreaterThan(before);

  // While the refresh is pending, the form and its data must stay put.
  await expect(page.getByText("Select an event before scouting")).toHaveCount(0);
  await expect(matchNotes(page)).toHaveValue("Competition regression test");
  await page.getByRole("tab", { name: /Auto/ }).click();
  await expect(page.locator("#matchNumber")).toHaveValue("12");
});

test("scouting pages opt out of pull-to-refresh", async ({ page }) => {
  await prepare(page);
  await page.goto("/scout/matchscout");
  await expect(page.locator("#matchNumber")).toBeVisible();
  expect(await page.evaluate(() => getComputedStyle(document.documentElement).overscrollBehaviorY)).toBe("contain");
});
