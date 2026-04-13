import { defineConfig, mergeConfig } from "vitest/config";

import { baseConfig } from "@repo/vitest-config/base";

export default mergeConfig(
  baseConfig,
  defineConfig({
    test: {
      include: ["test/test.ts"],
      testTimeout: 60_000,
      hookTimeout: 120_000,
      pool: "forks",
      poolOptions: {
        forks: { singleFork: true },
      },
      fileParallelism: false,
      sequence: { concurrent: false },
    },
  }),
);
