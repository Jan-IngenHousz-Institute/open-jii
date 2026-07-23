import { defineConfig, mergeConfig } from "vitest/config";

import { baseConfig } from "@repo/vitest-config/base";

// Unit / conformance tests that do NOT need the Docker containers. The guard
// conformance suite drives the real per-language guard code directly.
export default mergeConfig(
  baseConfig,
  defineConfig({
    test: {
      include: ["test/**/*.spec.ts"],
      testTimeout: 30_000,
      coverage: { enabled: false },
    },
  }),
);
