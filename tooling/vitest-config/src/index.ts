export const sharedConfig = {
  test: {
    globals: true,
    coverage: {
      provider: "v8" as const,
      reporter: [
        [
          "json",
          {
            file: `../coverage.json`,
          },
        ],
        [
          "lcov",
          {
            file: `../coverage/lcov.info`,
          },
        ],
        ["text"],
      ] as const,
      enabled: true,
    },
  },
};

// Re-export specific configs for backwards compatibility
export { baseConfig } from "./configs/base-config.js";
export { uiConfig } from "./configs/ui-config.js";
