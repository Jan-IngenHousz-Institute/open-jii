import { defineConfig, mergeConfig } from "vitest/config";

import { baseConfig } from "@repo/vitest-config/base";

export default mergeConfig(
  baseConfig,
  defineConfig({
    test: {
      environment: "node",
      coverage: {
        exclude: [
          // API-specific exclusions (extends base config)
          "**/*.spec.ts", // Test files
          "**/*.test.ts", // Test files
          "**/test/**", // Test utilities
        ],
      },
    },
  }),
);