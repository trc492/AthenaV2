import { test, expect } from "@playwright/test";
import { prepare } from "./helpers/scouting";

test("tour teaches the existing program switch and persists checklist progress", async ({ page }) => {
  await prepare(page);
  await page.goto("/dashboard");
  const checklist = page.getByRole("region", { name: "Get ready to scout" });
  await checklist.getByRole("button", { name: "Take a guided tour" }).click();
  const tour = page.getByRole("region", { name: "Guided tour" });
  await expect(tour.getByRole("heading", { name: "Open your profile menu" })).toBeVisible();
  await expect(page.getByRole("group", { name: "Competition program" })).toHaveCount(0);
  await page.getByRole("button", { name: /Competition Scout/ }).click();
  await expect(tour.getByRole("heading", { name: "Switch FRC and FTC" })).toBeVisible();
  await expect(tour.getByText("1 actions completed")).toBeVisible();
  await page.getByRole("menuitem", { name: "Switch to FTC" }).click();
  await expect.poll(() => page.evaluate(() => localStorage.getItem("selectedCompetitionType"))).toBe("FTC");
  await expect(tour.getByRole("heading", { name: "Open the event selector" })).toBeVisible();
  await page.locator('[data-tour-target="event"]').getByRole("button").click();
  await expect(tour.getByRole("heading", { name: "Choose a season", exact: true })).toBeVisible();
  await tour.getByRole("button", { name: "Skip step" }).click();
  await expect(tour.getByText("3 actions completed")).toBeVisible();
  // Wait for the outside click to close the menu, including its exit animation.
  const eventSelector = page.locator('[data-tour-target="event"]').getByRole("button");
  await expect(eventSelector).toHaveAttribute("aria-expanded", "false");
  await expect(page.getByRole("menuitem", { name: "E2E Competition", exact: true })).toBeHidden();
  await eventSelector.click();
  await page.getByRole("menuitem", { name: "E2E Competition", exact: true }).click();
  await expect(tour.getByRole("heading", { name: "Find your scouting assignment" })).toBeVisible();
  await page.locator('[data-tour-target="competition"]').click();
  await expect(tour.getByText("5 actions completed")).toBeVisible();
  await page.locator('[data-tour-target="settings"]').click();
  await expect(tour).toHaveCount(0);
  await checklist.getByRole("checkbox", { name: "Mark review your profile complete" }).check();
  await checklist.getByRole("button", { name: "Hide from dashboard" }).click();
  await page.goto("/dashboard");
  await page.reload();
  await expect(checklist).toHaveCount(0);
  await page.goto("/dashboard/settings");
  await expect(checklist.getByRole("checkbox", { name: "Mark review your profile complete" })).toBeChecked();
  await expect(checklist.getByRole("status")).toContainText("3 of 6 complete");
  await checklist.getByRole("button", { name: "Show on dashboard" }).click();
  await page.goto("/dashboard");
  await expect(checklist).toBeVisible();
});

test("mobile tour opens the sidebar, can be skipped, and can be replayed", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await prepare(page);
  await page.goto("/dashboard/settings");
  await page.getByRole("button", { name: "Take a guided tour" }).click();
  const sidebar = page.getByRole("dialog", { name: "Sidebar", exact: true });
  const tour = sidebar.getByRole("region", { name: "Guided tour" });
  await expect(tour).toBeVisible();
  // The sidebar slides in; visibility alone does not mean it has finished moving.
  await expect(async () => {
    const box = await tour.boundingBox();
    expect(box).not.toBeNull();
    expect(box!.x).toBeGreaterThanOrEqual(0);
    expect(box!.x + box!.width).toBeLessThanOrEqual(390);
    expect(box!.y + box!.height).toBeLessThanOrEqual(844);
  }).toPass();
  await sidebar.getByRole("button", { name: /Competition Scout/ }).click();
  await expect(page.getByRole("menuitem", { name: "Switch to FTC" })).toBeVisible();
  await page.keyboard.press("Escape");
  await tour.getByRole("button", { name: "Exit tour" }).click();
  await expect(sidebar).toBeHidden();
  await page.getByRole("button", { name: "Take a guided tour" }).click();
  await expect(tour.getByRole("heading", { name: "Open your profile menu" })).toBeVisible();
  await tour.getByRole("button", { name: "Exit tour" }).focus();
  await page.keyboard.press("Escape");
  await expect(sidebar).toBeHidden();
});

test("empty event lists still expose season and event selection", async ({ page }) => {
  await prepare(page);
  await page.route("**/api/events/custom-events?**", (route) => route.fulfill({ json: [] }));
  await page.goto("/dashboard");
  await page.getByRole("button", { name: /Choose an event/ }).click();
  await expect(page.getByText("Season", { exact: true })).toBeVisible();
  await expect(page.getByRole("combobox")).toBeVisible();
});

test("checklists respect roles and remain separate for different accounts", async ({ page }) => {
  await prepare(page);
  await page.goto("/dashboard");
  await expect(page.getByRole("link", { name: "Review integrations", exact: true })).toHaveCount(0);
  await page.getByRole("button", { name: "Dismiss checklist" }).click();
  await page.route("**/api/auth/session", (route) => route.fulfill({ json: {
    user: { id: "e2e-admin", name: "Team Admin", role: "admin" },
    expires: new Date(Date.now() + 86400000).toISOString(),
  } }));
  await page.reload();
  await expect(page.getByRole("region", { name: "Get ready to scout" })).toBeVisible();
  await expect(page.getByRole("link", { name: "Review integrations", exact: true })).toBeVisible();
});
