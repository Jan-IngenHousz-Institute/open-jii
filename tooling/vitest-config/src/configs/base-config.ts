import { defineConfig } from "vitest/config";

import { coverageEnabled } from "../coverage.js";

export const baseConfig = defineConfig({
  test: {
    coverage: {
      provider: "v8",
      reporter: [
        [
          "json",
          {
            file: `../coverage.json`,
          },
        ],
        "text",
      ],
      enabled: coverageEnabled,
      exclude: [
        "**/node_modules/**",
        "**/dist/**",
        "**/*.config.*",
        "**/*.setup.*",
        "**/models/**", // Exclude model files (type definitions only)
      ],
    },
  },
});
