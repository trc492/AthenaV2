import { defineConfig } from "vitest/config";
import path from "node:path";

export default defineConfig({
  test: {
    include: ["tests/database/**/*.test.ts"],
    environment: "node",
    hookTimeout: 120_000,
    testTimeout: 30_000,
  },
  resolve: { alias: { "@": path.resolve(__dirname, "src") } },
});
