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
    // Production assets are required to exercise service-worker caching offline.
    command: "pnpm build && node scripts/start-e2e.mjs",
    url: baseURL,
    reuseExistingServer: false,
    env: {
      AUTH_SECRET: "athena-e2e-only-secret-do-not-use-in-production",
      NEXTAUTH_SECRET: "athena-e2e-only-secret-do-not-use-in-production",
      RELEASE_SECRET_SENTINEL: "athena-e2e-only-secret-do-not-use-in-production",
      SETUP_TOKEN: "athena-e2e-only-setup-token-do-not-use-in-production",
      AUTH_URL: baseURL,
      HOSTNAME: "127.0.0.1",
      PORT: port,
    },
    timeout: 240_000,
  },
});
