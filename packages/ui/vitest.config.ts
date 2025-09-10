import { defineConfig, mergeConfig } from "vitest/config";
import { uiConfig } from "@repo/vitest-config/ui";

export default mergeConfig(
  uiConfig,
  defineConfig({
    test: {
      setupFiles: ["./vitest.setup.ts"],
    },
  })
);
