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

// Web-specific configuration
const webConfig = defineConfig({
  test: {
    coverage: {
      exclude: [
        // Web-specific exclusions (extends base config)
        ".next/**", // Next.js build artifacts
      ],
    },
  },
});

export default mergeConfig(
  mergeConfig(aliasConfig, uiConfig),
  webConfig
);
