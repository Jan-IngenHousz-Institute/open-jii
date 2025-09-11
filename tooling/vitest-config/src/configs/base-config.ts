import { defineConfig } from "vitest/config";

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
      enabled: true,
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
