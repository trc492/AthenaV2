import { expect, test } from "@playwright/test";
import { prepare } from "./helpers/scouting";

const entries = Array.from({ length: 12 }, (_, index) => ({
  id: index + 1,
  teamNumber: index === 0 ? 254 : 100 + index,
  year: 2025,
  competitionType: "FRC",
  eventCode: "e2e-event",
  driveTrain: "Swerve",
  matchNumber: index + 1,
  alliance: "red",
  timestamp: "2025-03-01T12:00:00.000Z",
  notes: "Private scouting notes",
  gameSpecificData: { autoPoints: 0, totalPoints: 10 },
}));

for (const kind of ["pit", "match"] as const) {
  test(`${kind} table filters, sorts, paginates, and deletes selected records`, async ({ page }) => {
    await prepare(page);
    let records = [...entries];
    const deleted: number[] = [];
    await page.route(`**/api/scouting/entries/${kind}?**`, async (route) => {
      if (route.request().method() === "DELETE") {
        const id = Number(new URL(route.request().url()).searchParams.get("id"));
        deleted.push(id);
        records = records.filter((entry) => entry.id !== id);
        await route.fulfill({ json: { success: true } });
      } else {
        await route.fulfill({ json: records });
      }
    });
    await page.goto(`/dashboard/${kind}scouting`);
    const table = page.getByRole("table");
    await expect(table.getByRole("row")).toHaveCount(11);
    await page.getByRole("button", { name: "Next", exact: true }).click();
    await expect(table.getByRole("row")).toHaveCount(3);
    await page.getByRole("button", { name: "Previous", exact: true }).click();

    const filter = page.getByPlaceholder("Filter teams...");
    await filter.fill("25");
    await expect(table.getByRole("row")).toHaveCount(2);
    await table.getByRole("checkbox", { name: "Select row", exact: true }).check();
    await filter.clear();
    await table.getByRole("button", { name: "Team", exact: true }).click();
    await table.getByRole("button", { name: "Team", exact: true }).click();
    const selected = table.getByRole("row").filter({
      has: page.getByRole("cell", { name: "254", exact: true }),
    });
    await expect(selected.getByRole("checkbox")).toBeChecked();
    await page.getByRole("button", { name: "Delete 1 selected", exact: true }).click();
    await page.getByRole("alertdialog").getByRole("button", { name: "Delete", exact: true }).click();
    await expect.poll(() => deleted).toEqual([1]);
    await expect(table.getByRole("cell", { name: "254", exact: true })).toHaveCount(0);
    await expect(page.getByRole("button", { name: /Delete \d+ selected/ })).toHaveCount(0);

    await filter.fill("99999");
    await expect(table.getByText(`No ${kind} scouting data found.`)).toBeVisible();
  });

  test(`${kind} table hides editing and private notes for guests`, async ({ page }) => {
    await prepare(page);
    await page.route("**/api/auth/session", (route) => route.fulfill({ json: {
      user: { id: "guest", name: "Guest", role: "guest" },
      expires: new Date(Date.now() + 3_600_000).toISOString(),
      guestEvent: {
        name: "E2E Competition", eventCode: "e2e-event", year: 2025, competitionType: "FRC",
        expiresAt: Date.now() + 3_600_000, canAddScouting: false, canViewNotes: false,
      },
    } }));
    await page.route(`**/api/scouting/entries/${kind}?**`, (route) => route.fulfill({ json: entries }));
    await page.goto(`/dashboard/${kind}scouting`);
    const table = page.getByRole("table");
    await expect(table.getByRole("row")).toHaveCount(11);
    await expect(table.getByRole("checkbox")).toHaveCount(0);
    await expect(table.getByRole("button", { name: "Open menu" })).toHaveCount(0);
    await expect(table.getByRole("columnheader", { name: "Notes", exact: true })).toHaveCount(0);
    await expect(table.getByText("Private scouting notes")).toHaveCount(0);
  });
}
