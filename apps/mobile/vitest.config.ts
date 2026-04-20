import { resolve } from "path";
import react from "@vitejs/plugin-react";
import { reactNative } from "@srsholmes/vitest-react-native";
import { defineConfig } from "vitest/config";

const rnResolve = {
  extensions: [
    ".ios.ts",
    ".ios.tsx",
    ".native.ts",
    ".native.tsx",
    ".ts",
    ".tsx",
    ".js",
    ".jsx",
    ".json",
  ],
  conditions: ["react-native"],
  alias: {
    "~": resolve(__dirname, "src"),
    "~/": resolve(__dirname, "src") + "/",
  },
};

export default defineConfig({
  // Two projects:
  //   - node    : logic tests + RNTL component tests (@srsholmes/vitest-react-native)
  //   - jsdom   : hook tests that rely on @testing-library/react + DOM
  test: {
    coverage: {
      provider: "v8",
      reporter: [
        [
          "json",
          {
            file: "../coverage.json",
          },
        ],
        "text",
      ],
      enabled: true,
      exclude: ["**/node_modules/**", "**/dist/**", "**/*.config.*", "**/*.setup.*"],
    },
    projects: [
      {
        plugins: [react(), reactNative()],
        resolve: rnResolve,
        test: {
          name: "node",
          globals: true,
          environment: "node",
          setupFiles: ["@srsholmes/vitest-react-native/setup", "./vitest.setup.ts"],
          include: ["src/**/*.test.ts", "src/**/*.test.tsx"],
          // Hook tests live in __tests__ dirs and need jsdom.
          exclude: ["**/node_modules/**", "src/hooks/__tests__/**"],
          server: {
            deps: {
              external: ["react-native"],
            },
          },
        },
      },
      {
        plugins: [react()],
        resolve: {
          alias: {
            "~": resolve(__dirname, "src"),
            "~/": resolve(__dirname, "src") + "/",
          },
        },
        test: {
          name: "jsdom",
          globals: true,
          environment: "jsdom",
          include: ["src/hooks/__tests__/**/*.test.ts"],
        },
      },
    ],
  },
});
