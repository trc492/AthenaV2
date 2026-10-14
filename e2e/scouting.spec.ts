import { test, expect, type Page } from "@playwright/test";
import { encode } from "next-auth/jwt";
import { createPitSchema, createMatchSchema, updatePitSchema, updateMatchSchema } from "../src/lib/server/scouting-schema";

const secret = "athena-e2e-only-secret-do-not-use-in-production";
type Kind = "pit" | "match";

// Exercise the real pages, providers, controls, API client and server validators.
// Only authentication and external data/persistence are simulated.
async function prepare(page: Page, competitionType = "FRC", year = 2025) {
  const cookie = "authjs.session-token";
  await page.context().addCookies([{ name: cookie, value: await encode({
    secret, salt: cookie, token: { sub: "e2e-scout", role: "scout" },
  }), url: "http://127.0.0.1:3100".replace(":3100", `:${process.env.E2E_PORT || "3100"}`) }]);
  await page.addInitScript(({ competitionType, year }) => {
    localStorage.setItem("selectedCompetitionType", competitionType);
    localStorage.setItem("selectedGameYear", String(year));
  }, { competitionType, year });
  const submissions: Record<string, unknown>[] = [];
  const state = { duplicate: false, reject: false, entry: null as Record<string, unknown> | null };
  await page.route("**/api/**", async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    const path = url.pathname;
    let body: unknown = [];
    if (path === "/api/auth/session") body = {
      user: { id: "e2e-scout", name: "Competition Scout", role: "scout" },
      expires: new Date(Date.now() + 86400000).toISOString(),
    };
    else if (path.includes("/custom-events")) body = [{ name: "E2E Competition", eventCode: "e2e-event", year }];
    else if (path.endsWith("/schedule")) body = { matches: [] };
    else if (path.endsWith("/check")) body = { exists: state.duplicate };
    else if (url.searchParams.has("id") && state.entry) body = state.entry;
    else if (/\/entries\/(pit|match)$/.test(path) && ["POST", "PUT"].includes(request.method())) {
      const payload = request.postDataJSON();
      const kind = path.endsWith("/pit") ? "pit" : "match";
      const schema = request.method() === "PUT"
        ? (kind === "pit" ? updatePitSchema : updateMatchSchema)
        : (kind === "pit" ? createPitSchema : createMatchSchema);
      const parsed = schema.safeParse(payload);
      // A validator regression must fail the test even if the UI handles the error.
      expect(parsed.success, JSON.stringify(parsed.error?.issues)).toBe(true);
      submissions.push(payload);
      await route.fulfill({ status: state.reject ? 400 : 200, json: state.reject ? { error: "Invalid scouting data" } : { id: 101 } });
      return;
    }
    await route.fulfill({ json: body });
  });
  return { submissions, state };
}

async function fill(page: Page, kind: Kind) {
  await page.goto(`/scout/${kind}scout`);
  await page.getByPlaceholder("Enter team number (e.g. 254)").fill("254");
  if (kind === "pit") {
    await page.getByRole("combobox").filter({ hasText: "Select drivetrain" }).click();
    await page.getByRole("option", { name: "Swerve Drive", exact: true }).click();
    await page.locator("#notes").fill("Competition regression test");
  } else {
    await page.locator("#matchNumber").fill("12");
    await page.getByRole("tab", { name: /Endgame/ }).click();
    await page.getByPlaceholder("Any additional observations about this match...").fill("Competition regression test");
  }
}

function save(page: Page, kind: Kind) {
  return page.getByRole("button", { name: kind === "pit" ? "Save Scouting Data" : "Save Data", exact: true });
}

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

  test(`${kind}: duplicate protection prevents submission`, async ({ page }) => {
    const { state, submissions } = await prepare(page);
    state.duplicate = true;
    await fill(page, kind);
    await save(page, kind).click();
    await expect(page.getByText("Duplicate entry detected", { exact: true })).toBeVisible();
    expect(submissions).toHaveLength(0);
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
