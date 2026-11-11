import { expect, type Page } from "@playwright/test";
import { encode } from "next-auth/jwt";
import { createPitSchema, createMatchSchema, updatePitSchema, updateMatchSchema } from "../../src/lib/server/scouting-schema";

const secret = "athena-e2e-only-secret-do-not-use-in-production";
type Kind = "pit" | "match";

// Exercise the real pages, providers, controls, API client and server validators.
// Only authentication and external data/persistence are simulated.
export async function prepare(page: Page, competitionType = "FRC", year = 2025) {
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
  await page.context().route("**/api/**", async (route) => {
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
      if (state.duplicate && request.method() === "POST") {
        await route.fulfill({ status: 409, json: { error: "Entry already exists" } });
        return;
      }
      await route.fulfill({ status: state.reject ? 400 : 200, json: state.reject ? { error: "Invalid scouting data" } : { id: 101 } });
      return;
    }
    await route.fulfill({ json: body });
  });
  return { submissions, state };
}

export async function fill(page: Page, kind: Kind) {
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

export function save(page: Page, kind: Kind) {
  return page.getByRole("button", { name: kind === "pit" ? "Save Scouting Data" : "Save Data", exact: true });
}

