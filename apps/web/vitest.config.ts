import { resolve } from "path";
import { mergeConfig, defineConfig } from "vitest/config";

import { uiConfig } from "@repo/vitest-config/ui";

// Ensure alias is not overridden by uiConfig
const aliasConfig = defineConfig({
  resolve: {
    alias: {
      "@": resolve(__dirname, "."),
      "@/": resolve(__dirname, ".") + "/",
    },
  },
});

export default mergeConfig(aliasConfig, uiConfig);
