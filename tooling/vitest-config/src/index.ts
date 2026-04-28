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
