import { defineConfig, mergeConfig } from "vitest/config";

import { baseConfig } from "@repo/vitest-config/base";

// Unit tests for the capture tooling. The browser suite under specs/ runs through Playwright.
export default mergeConfig(
  baseConfig,
  defineConfig({
    test: {
      environment: "node",
      include: ["ticket-screens/**/*.test.ts"],
      coverage: { enabled: false },
    },
  }),
);
