import { defineConfig } from "@playwright/test";

const port = process.env.E2E_PORT || "3100";
const baseURL = `http://127.0.0.1:${port}`;

export default defineConfig({
  testDir: "e2e",
  timeout: 60_000,
  workers: 1,
  reporter: [["list"], ["html", { open: "never" }]],
  use: {
    baseURL,
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    serviceWorkers: "block",
  },
  webServer: {
    command: `node ./node_modules/next/dist/bin/next dev --hostname 127.0.0.1 --port ${port}`,
    url: baseURL,
    reuseExistingServer: false,
    env: {
      AUTH_SECRET: "athena-e2e-only-secret-do-not-use-in-production",
      NEXTAUTH_SECRET: "athena-e2e-only-secret-do-not-use-in-production",
      AUTH_URL: baseURL,
    },
    timeout: 120_000,
  },
});
