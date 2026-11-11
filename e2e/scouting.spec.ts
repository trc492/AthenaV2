import { test, expect } from "@playwright/test";
import { prepare, fill, save } from "./helpers/scouting";
import { createPitSchema, createMatchSchema } from "../src/lib/server/scouting-schema";

for (const [competition, year] of [["FRC", 2025], ["FRC", 2026], ["FTC", 2026]] as const) {
  for (const kind of ["pit", "match"] as const) {
    test(`${competition} ${year}: ${kind} submission satisfies the server validator and resets`, async ({ page }) => {
      const { submissions } = await prepare(page, competition, year);
      await fill(page, kind);
      await save(page, kind).click();
      await expect(page.getByRole("status").filter({ hasText: "saved successfully" })).toBeVisible();
      expect(submissions).toHaveLength(1);
      expect(submissions[0]).toMatchObject({ teamNumber: 254, year, competitionType: competition, eventCode: "e2e-event", notes: "Competition regression test" });
      if (kind === "pit") {
        expect(submissions[0]).not.toHaveProperty("weight");
        await expect(page.locator("#notes")).toHaveValue("");
      } else {
        expect(submissions[0]).toMatchObject({ matchNumber: 12, alliancePosition: 1 });
        await expect(page.locator("#matchNumber")).toHaveValue("13");
      }
    });
  }
}

for (const kind of ["pit", "match"] as const) {
  test(`${kind}: edits satisfy the strict update validator`, async ({ page }) => {
    const { state, submissions } = await prepare(page);
    state.entry = {
      id: 101, teamNumber: 254, year: 2025, competitionType: "FRC",
      eventCode: "e2e-event", driveTrain: "Swerve", weight: null, length: null, width: null,
      matchNumber: 12, alliance: "red", alliancePosition: 1,
      gameSpecificData: {}, notes: "Original notes",
    };
    await page.goto(`/scout/${kind}scout?editId=101`);
    await expect(page.getByRole("button", { name: "Update Entry", exact: true })).toBeVisible();
    const notes = kind === "pit" ? page.locator("#notes") : page.getByPlaceholder("Any additional observations about this match...");
    if (kind === "match") await page.getByRole("tab", { name: /Endgame/ }).click();
    await expect(notes).toHaveValue("Original notes");
    await notes.fill("Corrected notes");
    await page.getByRole("button", { name: "Update Entry", exact: true }).click();
    await expect.poll(() => submissions.length).toBe(1);
    expect(submissions[0]).toMatchObject({ id: 101, teamNumber: 254, notes: "Corrected notes" });
    expect(submissions[0]).not.toHaveProperty("scoutingForUserId");
  });

  test(`${kind}: offline submission persists a validator-compatible entry in IndexedDB`, async ({ page }) => {
    const { submissions } = await prepare(page);
    await fill(page, kind);
    await page.context().setOffline(true);
    await save(page, kind).click();
    await expect(page.getByRole("status").filter({ hasText: "saved on this device" })).toBeVisible();
    const queued = await page.evaluate(() => new Promise<{ type: string; data: unknown }[]>((resolve, reject) => {
      const open = indexedDB.open("athena-offline-cache");
      open.onerror = () => reject(open.error);
      open.onsuccess = () => {
        const db = open.result;
        const request = db.transaction("queue").objectStore("queue").getAll();
        request.onsuccess = () => { db.close(); resolve(request.result); };
        request.onerror = () => { db.close(); reject(request.error); };
      };
    }));
    expect(submissions).toHaveLength(0);
    expect(queued).toHaveLength(1);
    expect(queued[0].type).toBe(kind);
    const schema = kind === "pit" ? createPitSchema : createMatchSchema;
    const parsed = schema.safeParse(JSON.parse(JSON.stringify(queued[0].data)));
    expect(parsed.success, JSON.stringify(parsed.error?.issues)).toBe(true);
  });

  test(`${kind}: a duplicate submission is rejected and preserves entered data`, async ({ page }) => {
    const { state, submissions } = await prepare(page);
    state.duplicate = true;
    await fill(page, kind);
    await save(page, kind).click();
    await expect(page.getByText("Duplicate entry detected", { exact: true })).toBeVisible();
    expect(submissions).toHaveLength(1);
    if (kind === "match") {
      await expect(page.getByPlaceholder("Any additional observations about this match...")).toHaveValue("Competition regression test");
      await page.getByRole("tab", { name: "Auto", exact: true }).click();
      await expect(page.locator("#matchNumber")).toHaveValue("12");
    }
    await expect(page.getByPlaceholder("Enter team number (e.g. 254)")).toHaveValue("254");
    await expect(save(page, kind)).toBeEnabled();
  });

  test(`${kind}: validation rejection preserves data for retry`, async ({ page }) => {
    const { state, submissions } = await prepare(page);
    state.reject = true;
    await fill(page, kind);
    await save(page, kind).click();
    await expect(page.getByText("Failed to save data", { exact: true })).toBeVisible();
    await expect(save(page, kind)).toBeEnabled();
    if (kind === "pit") await expect(page.locator("#notes")).toHaveValue("Competition regression test");
    else await expect(page.getByPlaceholder("Any additional observations about this match...")).toHaveValue("Competition regression test");
    state.reject = false;
    // Retry with the keyboard while the error notification is still visible.
    await save(page, kind).focus();
    await save(page, kind).press("Enter");
    await expect(page.getByRole("status").filter({ hasText: "saved successfully" })).toBeVisible();
    expect(submissions).toHaveLength(2);
    expect(submissions[1].gameSpecificData).toEqual(submissions[0].gameSpecificData);
  });
}

test("protected scouting pages redirect signed-out visitors to login", async ({ page }) => {
  await page.goto("/scout/pitscout");
  await expect(page).toHaveURL(/\/login$/);
  await expect(page.getByRole("heading", { name: "Log In" })).toBeVisible();
  await page.goto("/scout/matchscout");
  await expect(page).toHaveURL(/\/login$/);
});

test("2026 pit multiselect values survive submission as arrays", async ({ page }) => {
  const { submissions } = await prepare(page, "FRC", 2026);
  await fill(page, "pit");
  await page.getByRole("combobox").filter({ hasText: "Select intake method" }).click();
  await page.getByRole("option", { name: "Ground pickup", exact: true }).click();
  await page.getByRole("option", { name: "Outpost", exact: true }).click();
  await page.keyboard.press("Escape");
  await save(page, "pit").click();
  await expect(page.getByRole("status").filter({ hasText: "saved successfully" })).toBeVisible();
  expect(submissions[0].gameSpecificData).toMatchObject({ teleoperated_intakeType: ["Ground pickup", "Outpost"] });
});

test("match schedule fills the team and advances to the next scheduled team", async ({ page }) => {
  const { submissions } = await prepare(page);
  await page.route("**/api/events/*/schedule?**", (route) => route.fulfill({ json: {
    matches: [12, 13].map((matchNumber) => ({ matchNumber, teams: [{ alliance: "red", position: 1, teamNumber: matchNumber === 12 ? 254 : 492 }] })),
  } }));
  await page.goto("/scout/matchscout");
  await page.locator("#matchNumber").fill("12");
  await expect(page.getByPlaceholder("Enter team number (e.g. 254)")).toHaveValue("254");
  await page.getByRole("tab", { name: /Endgame/ }).click();
  await page.getByPlaceholder("Any additional observations about this match...").fill("Scheduled match");
  await save(page, "match").click();
  await expect(page.getByRole("status").filter({ hasText: "saved successfully" })).toBeVisible();
  expect(submissions[0]).toMatchObject({ teamNumber: 254, matchNumber: 12 });
  await expect(page.locator("#matchNumber")).toHaveValue("13");
  await expect(page.getByPlaceholder("Enter team number (e.g. 254)")).toHaveValue("492");
});

test("clearing match scores requires confirmation and preserves match identity", async ({ page }) => {
  await prepare(page);
  await fill(page, "match");
  await page.getByRole("button", { name: "Clear Form", exact: true }).click();
  await page.getByRole("alertdialog").getByRole("button", { name: "Cancel" }).click();
  await expect(page.getByPlaceholder("Any additional observations about this match...")).toHaveValue("Competition regression test");
  await page.getByRole("button", { name: "Clear Form", exact: true }).click();
  await page.getByRole("alertdialog").getByRole("button", { name: "Clear Form" }).click();
  await expect(page.getByPlaceholder("Any additional observations about this match...")).toHaveValue("");
  await page.getByRole("tab", { name: /Auto/ }).click();
  await expect(page.locator("#matchNumber")).toHaveValue("12");
  await expect(page.getByPlaceholder("Enter team number (e.g. 254)")).toHaveValue("254");
});
