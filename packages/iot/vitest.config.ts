import { defineConfig, mergeConfig } from "vitest/config";

import { baseConfig } from "@repo/vitest-config/base";

export default mergeConfig(
  baseConfig,
  defineConfig({
    test: {
      environment: "node",
      coverage: {
        exclude: [
          // IoT-specific exclusions (extends base config)
          "**/*.spec.ts", // Test files
          "**/*.test.ts", // Test files
          "**/test/**", // Test utilities
          "**/index.ts", // Barrel / re-export files
          "**/interface.ts", // Type-only files
          "**/types.ts", // Type-only files
          "**/config.ts", // Static config constants
          "**/commands.ts", // Static command constants
        ],
      },
    },
  }),
);
