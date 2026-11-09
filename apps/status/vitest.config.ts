import { resolve } from "path";
import { defineConfig, mergeConfig } from "vitest/config";

import { uiConfig } from "@repo/vitest-config/ui";

// A zone with daylight saving that is not UTC, so a date or day count read in local time fails here.
process.env.TZ = "America/Los_Angeles";

export default mergeConfig(
  uiConfig,
  defineConfig({
    resolve: {
      alias: { "~": resolve(__dirname, ".") },
    },
    test: {
      setupFiles: ["./vitest.setup.ts"],
      // The page-level tests draw every component's 90 days of bars. In CI they share the runner with
      // web's suite under coverage and pass five seconds, while alone each takes about 0.1 s.
      testTimeout: 20_000,
      coverage: {
        exclude: [".next/**", "out/**", ".releaserc.js"],
      },
    },
  }),
);
