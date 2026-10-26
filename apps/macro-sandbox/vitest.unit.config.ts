import { defineConfig, mergeConfig } from "vitest/config";

import { baseConfig } from "@repo/vitest-config/base";

// Key-free, docker-free unit checks that run in CI. Exercises the JS wrapper directly, unlike
// the data-contract suite in test.ts which needs the encrypted corpus key and a running stack.
export default mergeConfig(
  baseConfig,
  defineConfig({
    test: {
      include: ["test/*.unit.spec.ts"],
      testTimeout: 30_000,
      coverage: { enabled: false },
    },
  }),
);
