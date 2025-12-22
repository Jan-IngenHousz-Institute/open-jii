import { resolve } from "path";
import swc from "unplugin-swc";
import { defineConfig, mergeConfig } from "vitest/config";

import { baseConfig } from "@repo/vitest-config/base";

const commonTestConfig = {
  environment: "node",
  globals: true,
  setupFiles: ["./src/test/setup.ts"],
  pool: "threads",
  sequence: {
    concurrent: false,
  },
  fileParallelism: false,
};

const commonPlugins = [
  // This is required to build the test files with SWC and proper decorator support
  swc.vite(),
];

// Tests that need to be run in isolation
const isolatedTests = ["src/**/notifications.service.spec.ts"];

export default mergeConfig(
  baseConfig,
  defineConfig({
    test: {
      projects: [
        {
          test: {
            ...commonTestConfig,
            //name: "Non-isolated",
            isolate: false,
            include: ["src/**/*.spec.ts", "src/**/*.test.ts"],
            exclude: isolatedTests,
          },
          plugins: commonPlugins,
        },
        {
          test: {
            ...commonTestConfig,
            //name: "Isolated",
            isolate: true,
            include: isolatedTests,
          },
          plugins: commonPlugins,
        },
      ],
      coverage: {
        exclude: [
          // Backend-specific exclusions (extends base config)
          "src/main.ts", // Application entry point
          "src/**/models/**", // Model files (type definitions only)
          "**/*.e2e-spec.ts", // End-to-end test file
          "src/test/**", // Test utilities and setup
          "**/*.spec.ts", // Test files
          "**/*.test.ts", // Test files
          ".releaserc.js", // Semantic release configuration
        ],
      },
    },
  }),
);
