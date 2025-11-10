import { resolve } from "path";
import { mergeConfig, defineConfig } from "vitest/config";

import { uiConfig } from "@repo/vitest-config/ui";

// Ensure alias is not overridden by uiConfig
const aliasConfig = defineConfig({
  resolve: {
    alias: {
      "@": resolve(__dirname, "."),
      "@/": resolve(__dirname, ".") + "/",
      "~": resolve(__dirname, "."),
      "~/": resolve(__dirname, ".") + "/",
    },
  },
});

// Web-specific configuration
const webConfig = defineConfig({
  test: {
    setupFiles: ["./components/question-card/test-setup.ts"],
    env: {
      NODE_ENV: "test",
      NEXT_PUBLIC_POSTHOG_KEY: "test-posthog-key",
      NEXT_PUBLIC_POSTHOG_HOST: "https://test.posthog.com",
    },
    coverage: {
      exclude: [
        // Web-specific exclusions (extends base config)
        ".next/**", // Next.js build artifacts
      ],
    },
  },
});

export default mergeConfig(mergeConfig(aliasConfig, uiConfig), webConfig);
