import { defineConfig, mergeConfig } from "vitest/config";

import { baseConfig } from "@repo/vitest-config/base";

// Pure unit tests that exercise the helper library directly, with no Lambda
// containers. Kept separate from vitest.config.ts (Docker integration) so they
// always run locally and in CI even when MACRO_SB_TEST_KEY is unset.
export default mergeConfig(
  baseConfig,
  defineConfig({
    test: {
      include: ["test/**/*.unit.test.ts"],
      coverage: { enabled: false },
    },
  }),
);
