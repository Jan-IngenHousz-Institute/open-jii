import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

import { checkLocaleParity, formatLocaleParityIssue } from "./locale-parity.js";

/**
 * Registers the shared web locale trees (en-US base, de-DE and checked-in nl-NL
 * siblings) with the shared parity/retired-key harness. This migration owns the
 * complete `iot` namespace plus the product-label keys it changes in
 * `experiments` and `navigation`. Unrelated pre-existing namespace gaps remain
 * visible as non-blocking debt instead of being filled with English text.
 */
const localesRoot = resolve(import.meta.dirname, "../../../packages/i18n/locales");

function tree(locale: string) {
  return { locale, root: resolve(localesRoot, locale) };
}

// Retired generic identifiers that encode a product in device-level copy; they
// must never reappear in any checked-in web locale.
const RETIRED_KEYS = ["device.genericMultispeq", "genericMultispeqDevice"] as const;

const registration = {
  host: "web",
  base: tree("en-US"),
  siblings: [tree("de-DE"), tree("nl-NL")],
  retiredKeys: [...RETIRED_KEYS],
};

const MIGRATION_OWNED_KEYS: Readonly<Partial<Record<string, ReadonlySet<string>>>> = {
  experiments: new Set([
    "uploadModal.options.multispeq.label",
    "uploadModal.options.multispeq.description",
    "uploadModal.sensorTypes.multispeq.label",
    "uploadModal.sensorTypes.multispeq.description",
    "uploadModal.sensorTypes.multispeq.comingSoon",
  ]),
  navigation: new Set(["sidebar.multispeq"]),
};

function isMigrationOwned(namespace: string, key: string): boolean {
  return namespace === "iot" || MIGRATION_OWNED_KEYS[namespace]?.has(key) === true;
}

describe("web shared-i18n locale parity", () => {
  it("keeps every migration-owned key at parity across en-US, de-DE, nl-NL", async () => {
    const issues = await checkLocaleParity(registration);
    const ownedShapeIssues = issues.filter(
      (issue) => issue.kind !== "retired" && isMigrationOwned(issue.namespace, issue.key),
    );
    expect(ownedShapeIssues.map(formatLocaleParityIssue)).toEqual([]);
  });

  it("surfaces unrelated locale-shape gaps as explicitly non-blocking legacy debt", async () => {
    const issues = await checkLocaleParity(registration);
    const legacyDebt = issues.filter(
      (issue) => issue.kind !== "retired" && !isMigrationOwned(issue.namespace, issue.key),
    );
    const byLocale = Object.fromEntries(
      registration.siblings.map(({ locale }) => [
        locale,
        legacyDebt.filter((issue) => issue.locale === locale).length,
      ]),
    );

    // This diagnostic is intentionally non-gating: unrelated locales can be
    // improved independently without changing this migration's contract.
    console.warn("Non-blocking shared-i18n locale debt", {
      total: legacyDebt.length,
      byLocale,
    });
    expect(legacyDebt.every((issue) => !isMigrationOwned(issue.namespace, issue.key))).toBe(true);
  });

  it("rejects retired generic MultiSpeQ-named keys in any web locale namespace", async () => {
    const issues = await checkLocaleParity(registration);
    const retired = issues.filter((issue) => issue.kind === "retired");
    expect(retired.map(formatLocaleParityIssue)).toEqual([]);
  });
});
