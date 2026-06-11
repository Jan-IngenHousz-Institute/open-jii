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
        // Global floor agreed in OJD-1525. Set just under the current 83% baseline
        // so CI catches regressions but doesn't trip on small day-to-day variance.
        lines: 35,
        statements: 35,
        branches: 35,
        functions: 35,
        // Per-layer floors are set just under today's measured coverage so a
        // future regression in a critical area trips CI long before the global
        // average moves. Ratchet upward as tests are added (raised after the
        // DDD finishing pass added domain/services/hooks suites).
        "src/features/**/domain/**": { lines: 85, statements: 85, branches: 75, functions: 80 },
        "src/features/**/services/**": { lines: 65, statements: 65, branches: 55, functions: 65 },
        "src/features/**/hooks/**": { lines: 70, statements: 70, branches: 50, functions: 60 },
        "src/shared/db/**": { lines: 75, statements: 75, branches: 65, functions: 75 },
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
          // Hook tests rely on @testing-library/react + DOM, so they run in
          // the jsdom project below. Colocated next to the hook (no
          // __tests__/ dir), selected by the hooks/ path segment.
          exclude: ["**/node_modules/**", "src/**/hooks/**/*.test.{ts,tsx}"],
        },
      },
      {
        plugins: [react()],
        resolve: { alias: srcAlias },
        test: {
          name: "jsdom",
          globals: true,
          environment: "jsdom",
          include: ["src/**/hooks/**/*.test.{ts,tsx}"],
        },
      },
    ],
  },
});
