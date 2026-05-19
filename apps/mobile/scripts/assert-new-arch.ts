#!/usr/bin/env -S node --import tsx
/**
 * CI guard for the mobile React Native New Architecture (Fabric + Hermes +
 * Turbo Modules). Fails the build if a regression accidentally disables any
 * of these. Run via `pnpm --filter mobile assert-new-arch`.
 */
import { readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

interface Check {
  name: string;
  pass: boolean;
  details: string;
}

const __filename = fileURLToPath(import.meta.url);
const APP_ROOT = resolve(dirname(__filename), "..");
const appJson = JSON.parse(readFileSync(resolve(APP_ROOT, "app.json"), "utf-8")) as {
  expo?: {
    newArchEnabled?: boolean;
    jsEngine?: string;
  };
};

const expo = appJson.expo ?? {};
const checks: Check[] = [];

// 1. Fabric + Turbo Modules: both are gated on Expo's `newArchEnabled`. The
//    flag must be explicit (Expo SDK 55+ defaults to true, but the build
//    pipeline still emits a warning if absent — keep it explicit).
checks.push({
  name: "newArchEnabled is true",
  pass: expo.newArchEnabled === true,
  details: `app.json -> expo.newArchEnabled = ${String(expo.newArchEnabled)}`,
});

// 2. Hermes is the only JS engine that supports the new architecture's
//    static binding. `jsEngine` is undefined when using the default which IS
//    hermes; an explicit "jsc" string would be a regression.
const jsEngine = expo.jsEngine ?? "hermes";
checks.push({
  name: "jsEngine = hermes",
  pass: jsEngine === "hermes",
  details: `app.json -> expo.jsEngine = ${jsEngine} (default: hermes)`,
});

let failed = 0;
for (const check of checks) {
  const marker = check.pass ? "✓" : "✗";
  console.log(`${marker} ${check.name}: ${check.details}`);
  if (!check.pass) failed += 1;
}

if (failed > 0) {
  console.error(
    `\n${failed} new-arch check${failed === 1 ? "" : "s"} failed. ` +
      "See https://reactnative.dev/architecture/landing-page",
  );
  process.exit(1);
}

console.log("\nReact Native New Architecture lock-in: OK");
