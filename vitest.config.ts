import { resolve } from "path";
import { defineConfig } from "vitest/config";

import { sharedConfig } from "@repo/vitest-config";

export default defineConfig({
  resolve: {
    alias: {
      // Provide a fallback so running a single web test from repo root still resolves '@'
      "@": resolve(__dirname, "apps/web"),
      "@/": resolve(__dirname, "apps/web") + "/",
    },
  },
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
        root: "./tooling",
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
        resolve: {
          alias: {
            "@": resolve(__dirname, "apps/web"),
            "@/": resolve(__dirname, "apps/web") + "/",
            "~": resolve(__dirname, "apps/web"),
            "~/": resolve(__dirname, "apps/web") + "/",
          },
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
