import { test, expect } from "@playwright/test";
import { readFileSync } from "node:fs";
import ts from "typescript";

// Run the actual storage module against Chromium's IndexedDB, without a server DB.
const browserSource = ["src/lib/offline-types.ts", "src/lib/indexeddb-service.ts"]
  .map((file) => readFileSync(file, "utf8")
    .replace(/^import[\s\S]*?from ["'][^"']+["'];/gm, "")
    .replace(/\bexport /g, ""))
  .map((source) => ts.transpileModule(source, { compilerOptions: { target: ts.ScriptTarget.ES2020, module: ts.ModuleKind.None } }).outputText)
  .join("\n");

test("event caches isolate seasons and competitions, including empty results and clears", async ({ page }) => {
  await page.route("http://cache.test/**", (route) => route.fulfill({ body: "<html></html>", contentType: "text/html" }));
  await page.goto("http://cache.test/");
  await page.addScriptTag({ content: browserSource });
  const result = await page.evaluate(async () => {
    // Names refer to the real module injected above.
    // @ts-expect-error browser-injected module
    const service = indexedDBService;
    const a = { eventCode: "same", year: 2025, competitionType: "FRC" };
    const b = { ...a, year: 2026 };
    const c = { ...b, competitionType: "FTC" };
    await service.cachePitEntries(a, [{ teamNumber: 1 }]);
    await service.cachePitEntries(b, [{ teamNumber: 2 }]);
    await service.cachePitEntries(c, []);
    await service.cacheEventTeams(b, [{ teamNumber: 2, nickname: "Team", key: "frc2" }]);
    const before = await Promise.all([a, b, c].map((scope) => service.getCachedPitEntries(scope)));
    await service.clearEventCache(b);
    const after = await Promise.all([a, b, c].map((scope) => service.getCachedPitEntries(scope)));
    return { before, after, teams: await service.getCachedEventTeams(b) };
  });
  expect(result.before.map((cache: { entries: unknown[] }) => cache.entries)).toEqual([[{ teamNumber: 1 }], [{ teamNumber: 2 }], []]);
  expect(result.after[0].entries).toEqual([{ teamNumber: 1 }]);
  expect(result.after[1]).toBeNull();
  expect(result.after[2].entries).toEqual([]);
  expect(result.teams).toBeNull();
});

test("upgrading old cache keys preserves queued submissions", async ({ page }) => {
  await page.route("http://cache.test/**", (route) => route.fulfill({ body: "<html></html>", contentType: "text/html" }));
  await page.goto("http://cache.test/");
  await page.evaluate(async () => {
    await new Promise<void>((resolve, reject) => {
      const request = indexedDB.open("athena-offline-cache", 5);
      request.onupgradeneeded = () => {
        const db = request.result;
        const queue = db.createObjectStore("queue", { keyPath: "id" });
        queue.createIndex("status", "status");
        queue.createIndex("type", "type");
        queue.createIndex("createdAt", "createdAt");
        queue.put({ id: "unsent", type: "pit", status: "pending", data: { teamNumber: 254 }, createdAt: new Date(), attempts: 0 });
        db.createObjectStore("cached_pit_entries", { keyPath: "eventCode" })
          .put({ eventCode: "old", entries: [{ teamNumber: 1 }] });
      };
      request.onerror = () => reject(request.error);
      request.onsuccess = () => { request.result.close(); resolve(); };
    });
  });
  await page.addScriptTag({ content: browserSource });
  const result = await page.evaluate(async () => {
    // @ts-expect-error browser-injected module
    const service = indexedDBService;
    await service.init();
    return {
      queue: await service.getPendingEntries(),
      cache: await service.getCachedPitEntries({ eventCode: "old", year: 2026, competitionType: "FRC" }),
    };
  });
  expect(result.queue).toHaveLength(1);
  expect(result.queue[0].id).toBe("unsent");
  expect(result.cache).toBeNull();
});
