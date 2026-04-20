import { resolve } from "path";
import { defineConfig } from "vitest/config";
// React-Native test harness lives in @repo/vitest-config/mobile. It ships
// everything needed to run RNTL component tests under vitest (Flow stripping,
// jest-style RN module mocks, self-registered setup file).
// @ts-expect-error — the vendored harness is plain .mjs without .d.ts
import { react, reactNative, rnSetupFile } from "@repo/vitest-config/mobile";

const srcAlias = {
  "~": resolve(__dirname, "src"),
  "~/": resolve(__dirname, "src") + "/",
};

export default defineConfig({
  // Two projects, both vitest — one `pnpm test` runs everything:
  //   - node  : logic tests + RNTL component tests (via @repo/vitest-config/mobile)
  //   - jsdom : hook tests that rely on @testing-library/react + DOM
  test: {
    coverage: {
      provider: "v8",
      reporter: [
        ["json", { file: "../coverage.json" }],
        "text",
      ],
      enabled: true,
      exclude: ["**/node_modules/**", "**/dist/**", "**/*.config.*", "**/*.setup.*"],
    },
    projects: [
      {
        plugins: [react(), reactNative()],
        resolve: { alias: srcAlias },
        test: {
          name: "node",
          globals: true,
          environment: "node",
          // rnSetupFile installs pirates hooks + core RN-module mocks;
          // vitest.setup.ts holds this app's native-wrapper package mocks.
          setupFiles: [rnSetupFile, "./vitest.setup.ts"],
          include: ["src/**/*.test.ts", "src/**/*.test.tsx"],
          exclude: ["**/node_modules/**", "src/hooks/__tests__/**"],
        },
      },
      {
        plugins: [react()],
        resolve: { alias: srcAlias },
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
