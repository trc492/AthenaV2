import { test, expect } from "@playwright/test";

const setupToken = "athena-e2e-only-setup-token-do-not-use-in-production";

test("live setup endpoints reject missing and incorrect tokens before mutations", async ({ request }) => {
  for (const endpoint of ["app-url", "database", "admin"]) {
    for (const token of ["", "wrong"]) {
      const response = await request.post(`/api/setup/${endpoint}`, {
        headers: { "X-Athena-Setup-Token": token }, data: {},
      });
      expect(response.status()).toBe(403);
    }
  }
  const accepted = await request.post("/api/setup/database", {
    headers: { "X-Athena-Setup-Token": setupToken }, data: {},
  });
  expect(accepted.status()).toBe(400);
  expect(await accepted.json()).toEqual({ error: "A valid database provider is required" });
});

test("setup wizard sends the entered token without putting it in the URL", async ({ page }) => {
  await page.route("**/api/setup/app-url", async (route) => {
    expect(route.request().headers()["x-athena-setup-token"]).toBe(setupToken);
    expect(route.request().url()).not.toContain(setupToken);
    await route.fulfill({ status: 400, json: { error: "Setup token submission verified" } });
  });
  await page.goto("/setup");
  await page.getByLabel("Setup token", { exact: true }).fill(setupToken);
  await page.getByPlaceholder("https://scouting.myteam.com").fill("https://scouting.example.com");
  await page.getByRole("button", { name: "Continue", exact: true }).click();
  await expect(page.getByText("Setup token submission verified")).toBeVisible();
});
