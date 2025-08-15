import { resolve } from "path";
import swc from "unplugin-swc";
import { defineConfig, mergeConfig } from "vitest/config";

import { baseConfig } from "@repo/vitest-config/base";

export default mergeConfig(
  baseConfig,
  defineConfig({
    test: {
      environment: "node",
      globals: true,
      setupFiles: ["./src/test/setup.ts"],
      pool: "forks",
      poolOptions: {
        forks: {
          singleFork: true,
        },
      },
      sequence: {
        concurrent: false,
      },
      fileParallelism: false,
      coverage: {
        exclude: [
          // Backend-specific exclusions (extends base config)
          "src/main.ts", // Application entry point
          "src/**/models/**", // Model files (type definitions only)
          "src/app.e2e-spec.ts", // End-to-end test file
        ],
      },
    },
    plugins: [
      // This is required to build the test files with SWC and proper decorator support
      swc.vite(),
    ],
  }),
);
