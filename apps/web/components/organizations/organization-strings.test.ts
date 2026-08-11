import { readFileSync, readdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

import deCommon from "@repo/i18n/locales/de-DE/common.json";
import deNavigation from "@repo/i18n/locales/de-DE/navigation.json";
import enCommon from "@repo/i18n/locales/en-US/common.json";
import enNavigation from "@repo/i18n/locales/en-US/navigation.json";
import nlCommon from "@repo/i18n/locales/nl-NL/common.json";
import nlNavigation from "@repo/i18n/locales/nl-NL/navigation.json";

/**
 * Every string this surface renders has to exist in every locale directory, not
 * only the configured ones: `nl-NL` is currently switched off in the i18n config
 * but its resources are maintained, and a gap left now is a gap nobody notices
 * until it is switched back on.
 *
 * The keys are read out of the source rather than listed here, so a key added to a
 * component without a translation fails this test instead of silently rendering
 * its own name in the UI.
 */

const componentsDirectory = dirname(fileURLToPath(import.meta.url));
const webRoot = resolve(componentsDirectory, "..", "..");

/** Flatten a resource bundle to dotted paths, the shape `t()` addresses. */
function flatten(value: unknown, prefix = ""): string[] {
  if (typeof value !== "object" || value === null) return [prefix];

  return Object.entries(value as Record<string, unknown>).flatMap(([key, child]) =>
    flatten(child, prefix === "" ? key : `${prefix}.${key}`),
  );
}

function sourceFiles(directory: string): string[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = resolve(directory, entry.name);
    if (entry.isDirectory()) return entry.name === "node_modules" ? [] : sourceFiles(path);
    if (!/\.tsx?$/u.test(entry.name) || /\.test\.tsx?$/u.test(entry.name)) return [];
    return [path];
  });
}

/**
 * Literal `t("organizations.…")` keys used anywhere in the app. Keys built from a
 * template literal (a role, a type, a rejection reason) are covered by the
 * enumerated checks below instead — their prefixes are asserted whole.
 */
function usedOrganizationKeys(): string[] {
  const roots = ["components", "app", "lib"].map((segment) => resolve(webRoot, segment));
  const keys = new Set<string>();

  for (const root of roots) {
    for (const file of sourceFiles(root)) {
      const source = readFileSync(file, "utf8");
      for (const [, key] of source.matchAll(/\bt\(\s*"(organizations\.[\w.]+)"/gu)) {
        keys.add(key);
      }
    }
  }

  return [...keys].sort();
}

const LOCALES = {
  "en-US": { common: enCommon, navigation: enNavigation },
  "de-DE": { common: deCommon, navigation: deNavigation },
  "nl-NL": { common: nlCommon, navigation: nlNavigation },
} as const;

const localeNames = Object.keys(LOCALES) as (keyof typeof LOCALES)[];

/** A count-suffixed key resolves through i18next's plural forms. */
function resolves(bundleKeys: Set<string>, key: string): boolean {
  return bundleKeys.has(key) || (bundleKeys.has(`${key}_one`) && bundleKeys.has(`${key}_other`));
}

describe("organization strings", () => {
  const bundles = Object.fromEntries(
    localeNames.map((locale) => [
      locale,
      {
        common: new Set(flatten(LOCALES[locale].common)),
        navigation: new Set(flatten(LOCALES[locale].navigation)),
      },
    ]),
  ) as Record<(typeof localeNames)[number], { common: Set<string>; navigation: Set<string> }>;

  it("finds the keys the surface actually uses", () => {
    // A regex that stops matching would make every assertion below vacuous.
    expect(usedOrganizationKeys().length).toBeGreaterThan(100);
  });

  it.each(localeNames)("%s translates every organization key used in the source", (locale) => {
    const missing = usedOrganizationKeys().filter((key) => !resolves(bundles[locale].common, key));

    expect(missing).toEqual([]);
  });

  it.each(localeNames)("%s carries the enumerated organization vocabularies", (locale) => {
    const expected = [
      ...["owner", "admin", "member"].flatMap((role) => [
        `organizations.roles.${role}`,
        `organizations.roleHints.${role}`,
      ]),
      ...[
        "unspecified",
        "research_institute",
        "non_profit",
        "private_company",
        "government_agency",
        "university",
      ].map((type) => `organizations.types.${type}`),
      ...["required", "format", "tooLong", "reserved", "taken"].map(
        (reason) => `organizations.errors.slug.${reason}`,
      ),
      ...["pending", "approved", "rejected", "cancelled"].map(
        (status) => `organizations.requests.status.${status}`,
      ),
      ...["experiment", "macro", "protocol", "workbook"].map(
        (type) => `organizations.resources.types.${type}`,
      ),
      // The delete-blocker breakdown names every owned type, devices included —
      // the one the resources showcase never lists.
      ...["experiment", "macro", "protocol", "workbook", "device"].map(
        (type) => `organizations.delete.owned.${type}`,
      ),
      // The generic noun a metadata title falls back to for an inaccessible org.
      "organizations.organization",
    ];

    const missing = expected.filter((key) => !resolves(bundles[locale].common, key));

    expect(missing).toEqual([]);
  });

  it.each(localeNames)("%s translates the team grantee strings", (locale) => {
    const missing = [
      "sharing.granteeTypeTeam",
      "sharing.searchTeamsPlaceholder",
      "sharing.noTeamsFound",
      "sharing.teamMemberCount",
    ].filter((key) => !resolves(bundles[locale].common, key));

    expect(missing).toEqual([]);
  });

  it.each(localeNames)("%s translates the organizations navigation entry", (locale) => {
    const missing = [
      "sidebar.organizations",
      "sidebar.newOrganization",
      "sidebar.myOrganizations",
      "sidebar.organizationDirectory",
    ].filter((key) => !bundles[locale].navigation.has(key));

    expect(missing).toEqual([]);
  });

  it("keeps the three locales' organization key sets identical", () => {
    const keysFor = (locale: (typeof localeNames)[number]) =>
      [...bundles[locale].common].filter((key) => key.startsWith("organizations.")).sort();

    const reference = keysFor("en-US");
    expect(reference.length).toBeGreaterThan(100);
    for (const locale of localeNames) {
      expect(keysFor(locale), `${locale} diverges from en-US`).toEqual(reference);
    }
  });
});
