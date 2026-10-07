import { test, expect } from "@playwright/test";

test("robots.txt is served", async ({ page }) => {
  const response = await page.goto("/robots.txt");
  expect(response?.status()).toBe(200);
  const text = await page.textContent("body");
  expect(text || "").toMatch(/User-Agent/i);
});

test("sitemap.xml is served", async ({ page }) => {
  const response = await page.goto("/sitemap.xml");
  expect(response?.status()).toBe(200);
  const text = await page.textContent("body");
  expect(text || "").toContain("sitemap");
});
test("landing page is served", async ({ page }) => {
  const response = await page.goto("/");
  expect(response?.status()).toBe(200);
  const text = await page.textContent("body");
  expect(text || "").toContain("Athena");
});
