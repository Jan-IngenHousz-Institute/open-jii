import { defineConfig, mergeConfig } from "vitest/config";

import { baseConfig } from "@repo/vitest-config/base";

export default mergeConfig(
  baseConfig,
  defineConfig({
    test: {
      environment: "node",
      coverage: {
        exclude: [
          "**/*.spec.ts",
          "**/demo/**",
          "**/index.ts",
          "**/ports/**", // Port interfaces are type-only except trivial defaults
        ],
      },
    },
  }),
);
