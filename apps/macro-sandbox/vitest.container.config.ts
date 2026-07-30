import { defineConfig, mergeConfig } from "vitest/config";

import { baseConfig } from "@repo/vitest-config/base";

// Opt-in contract suite that builds and exercises the real Lambda containers.
export default mergeConfig(
  baseConfig,
  defineConfig({
    test: {
      include: ["test/handler-container.spec.ts"],
      testTimeout: 30_000,
      coverage: { enabled: false },
    },
  }),
);
