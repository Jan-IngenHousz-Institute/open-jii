import { defineConfig, devices } from "@playwright/test";
import path from "node:path";

const baseURL = process.env.E2E_BASE_URL ?? "http://localhost:3000";
const locale = process.env.E2E_LOCALE ?? "en-US";
const authFile = path.join(import.meta.dirname, ".auth", "seed.json");

export default defineConfig({
  testDir: "./specs",
  outputDir: "./test-results",
  fullyParallel: false,
  workers: 1,
  retries: process.env.CI ? 1 : 0,
  reporter: [["list"], ["html", { outputFolder: "playwright-report", open: "never" }]],
  use: {
    baseURL,
    screenshot: "only-on-failure",
    trace: "on-first-retry",
    video: "retain-on-failure",
    viewport: { width: 1440, height: 900 },
  },
  projects: [
    {
      name: "setup",
      testMatch: /auth\.setup\.ts/,
      use: { ...devices["Desktop Chrome"] },
    },
    {
      name: "chromium",
      dependencies: ["setup"],
      testIgnore: /auth\.setup\.ts/,
      use: { ...devices["Desktop Chrome"], storageState: authFile },
    },
  ],
  webServer: process.env.CI
    ? [
        {
          command:
            "NODE_ENV=production pnpm --filter backend start:prod > /tmp/openjii-backend.log 2>&1",
          url: "http://127.0.0.1:3020/health",
          timeout: 120_000,
        },
        {
          command:
            "HOSTNAME=127.0.0.1 PORT=3000 node ../web/.next/standalone/apps/web/server.js > /tmp/openjii-web.log 2>&1",
          url: new URL(`/${locale}/login`, baseURL).toString(),
          timeout: 120_000,
        },
      ]
    : undefined,
});
