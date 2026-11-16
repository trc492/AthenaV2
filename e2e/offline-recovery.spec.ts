import { test, expect, type Page } from "@playwright/test";
import { prepare, fill, save } from "./helpers/scouting";
import type { QueuedEntry } from "../src/lib/offline-types";

test.use({ serviceWorkers: "allow" });

async function queue(page: Page): Promise<QueuedEntry[]> {
  return page.evaluate(() => new Promise((resolve, reject) => {
    const open = indexedDB.open("athena-offline-cache");
    open.onerror = () => reject(open.error);
    open.onsuccess = () => {
      const db = open.result;
      const transaction = db.transaction("queue");
      const request = transaction.objectStore("queue").getAll();
      transaction.oncomplete = () => { db.close(); resolve(request.result); };
      transaction.onerror = () => { db.close(); reject(transaction.error); };
    };
  }));
}

for (const kind of ["pit", "match"] as const) {
  test(`${kind}: offline entries survive reload and the service worker replays them once on reconnect`, async ({ page, context }) => {
    const cdp = await context.newCDPSession(page);
    const workerErrors: string[] = [];
    cdp.on("ServiceWorker.workerErrorReported", ({ errorMessage }) => workerErrors.push(errorMessage.errorMessage));
    await cdp.send("ServiceWorker.enable");
    const { submissions } = await prepare(page);
    await fill(page, kind);
    await expect.poll(() => page.evaluate(() => !!navigator.serviceWorker.controller), { timeout: 15_000 }).toBe(true);
    // Reload under the active worker to cache the real authenticated page and assets.
    await page.reload();
    // The unsaved entry comes back from its local draft after the reload.
    await expect(page.getByText(/Recovered your unsaved (pit|match) entry/)).toBeVisible();
    await expect(page.getByPlaceholder("Enter team number (e.g. 254)")).toHaveValue("254");
    await expect.poll(() => page.evaluate(async () => !!await caches.match(location.href))).toBe(true);
    await context.setOffline(true);
    await save(page, kind).click();
    await expect(page.getByRole("status").filter({ hasText: "saved on this device" })).toBeVisible();
    const [saved] = await queue(page);
    expect(saved).toMatchObject({ type: kind, status: "pending", data: { teamNumber: 254 } });
    expect(submissions).toHaveLength(0);

    await page.reload();
    await expect(page.getByRole("heading", { name: kind === "pit" ? "Pit Scouting" : "Match Scouting", exact: true })).toBeVisible();
    expect(await queue(page)).toEqual([saved]);

    // Ask the real worker to replay, even if the window's auto-sync is disabled.
    // CDP dispatch avoids relying on Chromium's discretionary Background Sync scheduling.
    const registrationId = await new Promise<string>((resolve) => {
      cdp.on("ServiceWorker.workerRegistrationUpdated", ({ registrations }) => {
        const registration = registrations.find((item) => item.scopeURL === new URL("/", page.url()).href && !item.isDeleted);
        if (registration) resolve(registration.registrationId);
      });
      // Re-enable after the listener is attached to receive existing registrations.
      void cdp.send("ServiceWorker.disable").then(() => cdp.send("ServiceWorker.enable"));
    });
    await context.setOffline(false);
    await cdp.send("ServiceWorker.dispatchSyncEvent", { origin: new URL(page.url()).origin, registrationId, tag: "offline-data-sync", lastChance: false });
    await expect.poll(async () => (await queue(page))[0]?.status).toBe("synced");
    expect(submissions).toHaveLength(1);
    expect(submissions[0]).toMatchObject(JSON.parse(JSON.stringify(saved.data)));
    expect((await queue(page))[0]).toMatchObject({ id: saved.id, remoteId: 101 });

    await cdp.send("ServiceWorker.dispatchSyncEvent", { origin: new URL(page.url()).origin, registrationId, tag: "offline-data-sync", lastChance: false });
    // Wait for the second pass to finish, rather than checking before it has run.
    await expect.poll(() => page.evaluate(() => new Promise<number>((resolve, reject) => {
      const open = indexedDB.open("athena-offline-cache");
      open.onerror = () => reject(open.error);
      open.onsuccess = () => {
        const db = open.result;
        const request = db.transaction("sync_log").objectStore("sync_log").count();
        request.onsuccess = () => { db.close(); resolve(request.result); };
      };
    }))).toBeGreaterThanOrEqual(2);
    expect(submissions).toHaveLength(1);
    expect(workerErrors).toEqual([]);
    await cdp.detach();
  });
}
