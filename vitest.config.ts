import { defineConfig } from "vitest/config";

import { sharedConfig } from "@repo/vitest-config";

export default defineConfig({
  ...sharedConfig,
  test: {
    projects: [
      {
        root: "./packages",
        test: {
          ...sharedConfig.test,
          // Project-specific configuration for packages
          // ...
        },
      },
      {
        root: "./apps/web",
        test: {
          ...sharedConfig.test,
          // Project-specific configuration for apps
          environment: "jsdom",
        },
      },
      {
        root: "./apps/backend",
        test: {
          ...sharedConfig.test,
          // Project-specific configuration for apps
        },
      },
    ],
  },
});
