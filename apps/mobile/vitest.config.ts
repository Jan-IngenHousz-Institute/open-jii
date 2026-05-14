import { resolve } from "path";
import { defineConfig } from "vitest/config";

// React-Native test harness lives in @repo/vitest-config/mobile. It ships
// everything needed to run React Native Testing Library (RNTL) component tests
// under vitest (Flow stripping, jest-style RN module mocks, self-registered setup file).
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
      reporter: [["json", { file: "../coverage.json" }], "text"],
      enabled: true,
      exclude: [
        "**/node_modules/**",
        "**/dist/**",
        "**/*.config.*",
        "**/*.setup.*",
        "src/app/**", // expo-router routes are thin shells covered by manual smoke
        "src/shared/i18n/locales/**", // pure JSON data
        "scripts/**",
        "drizzle/**",
      ],
      thresholds: {
        // Global floor agreed in OJD-1525. Far below the current 83% baseline;
        // a ratchet upward is left for follow-up.
        lines: 35,
        statements: 35,
        branches: 35,
        functions: 35,
        // Per-layer floors so a future regression in a critical area trips CI
        // long before the global average moves.
        "src/features/**/services/**": { lines: 80, statements: 80, branches: 50, functions: 70 },
        "src/features/**/api/**": { lines: 70, statements: 70, branches: 50, functions: 60 },
        "src/features/**/hooks/**": { lines: 60, statements: 60, branches: 40, functions: 50 },
        "src/shared/db/**": { lines: 80, statements: 80, branches: 70, functions: 80 },
        "src/shared/api/**": { lines: 70, statements: 70, branches: 60, functions: 70 },
      },
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
          exclude: ["**/node_modules/**", "src/**/hooks/__tests__/**"],
        },
      },
      {
        plugins: [react()],
        resolve: { alias: srcAlias },
        test: {
          name: "jsdom",
          globals: true,
          environment: "jsdom",
          include: ["src/**/hooks/__tests__/**/*.test.{ts,tsx}"],
        },
      },
    ],
  },
});
