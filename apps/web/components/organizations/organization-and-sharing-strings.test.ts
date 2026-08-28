import { readFileSync, readdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

import { zExperimentStatus } from "@repo/api/domains/experiment/experiment.schema";
import {
  ORGANIZATION_TYPE_SEARCH_ALIASES,
  zOrganizationType,
} from "@repo/api/domains/organization/organization.schema";
import { zSharingResourceType } from "@repo/api/domains/sharing/sharing.schema";
import deCommon from "@repo/i18n/locales/de-DE/common.json";
import deNavigation from "@repo/i18n/locales/de-DE/navigation.json";
import enCommon from "@repo/i18n/locales/en-US/common.json";
import enNavigation from "@repo/i18n/locales/en-US/navigation.json";
import nlCommon from "@repo/i18n/locales/nl-NL/common.json";
import nlNavigation from "@repo/i18n/locales/nl-NL/navigation.json";

/**
 * Locale coverage for the `organizations.*` and `sharing.*` keys — **and nothing else.**
 *
 * Every string those two prefixes render has to exist in every locale directory, not
 * only the configured ones: `nl-NL` is currently switched off in the i18n config but its
 * resources are maintained, and a gap left now is a gap nobody notices until it is
 * switched back on.
 *
 * The keys are read out of the source rather than listed here, so a key added to a
 * component without a translation fails this test instead of silently rendering its own
 * name in the UI.
 *
 * **What this file does not cover, and nothing else does either.** This is the only
 * locale-coverage guard in the repository, and {@link GUARDED_PREFIXES} is the whole of
 * its reach. `experiments.*`, `dangerZone.*`, `workbooks.*` and every other prefix are
 * unguarded: a key of theirs missing from one locale, or from all three, fails nothing
 * anywhere. Do not read a green run here as "the translations are complete" — read it as
 * "these two prefixes are complete". Adding a key outside them means checking the three
 * bundles by hand.
 *
 * Widening this to the remaining prefixes is worth doing and is deliberately not done
 * here: those prefixes have never been checked, so a repo-wide scan would fail on a
 * backlog that deserves its own pass rather than being backfilled under pressure.
 *
 * Two blind spots survive even inside the guarded prefixes:
 *
 * - **Interpolated keys.** The scan sees literal `t("…")` calls only, so
 *   `` t(`organizations.roles.${role}`) `` is invisible to it. Those vocabularies are
 *   covered by the enumerated lists below, which are hand-maintained — extend them in
 *   the same change that adds an interpolated key, and prefer sourcing them from an
 *   exported enum so a new member cannot ship as a raw key.
 * - **Placeholders inside a value.** A key's existence is guarded; `{{name}}` surviving
 *   translation is not.
 */

/**
 * The key prefixes this file guards. Declared once, because the source scan, the
 * sanity check and the locale-parity test all derive from it — otherwise the regex's
 * alternation and the parity test's filter drift apart and one of them silently
 * stops covering a prefix the other still claims.
 */
const GUARDED_PREFIXES = ["organizations", "sharing"] as const;

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
 * Literal `t("…")` keys under {@link GUARDED_PREFIXES}, used anywhere in the app. Keys
 * built from a template literal (a role, a type, a rejection reason) are covered by the
 * enumerated checks below instead — their prefixes are asserted whole.
 */
function usedScopedKeys(): string[] {
  const pattern = new RegExp(
    String.raw`\bt\(\s*"((?:${GUARDED_PREFIXES.join("|")})\.[\w.]+)"`,
    "gu",
  );
  const roots = ["components", "app", "lib"].map((segment) => resolve(webRoot, segment));
  const keys = new Set<string>();

  for (const root of roots) {
    for (const file of sourceFiles(root)) {
      const source = readFileSync(file, "utf8");
      for (const [, key] of source.matchAll(pattern)) {
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

describe("organization and sharing strings", () => {
  const bundles = Object.fromEntries(
    localeNames.map((locale) => [
      locale,
      {
        common: new Set(flatten(LOCALES[locale].common)),
        navigation: new Set(flatten(LOCALES[locale].navigation)),
      },
    ]),
  ) as Record<(typeof localeNames)[number], { common: Set<string>; navigation: Set<string> }>;

  /**
   * Pinned, because every `it.each(GUARDED_PREFIXES)` below shrinks silently with it:
   * drop a prefix from that list and those tests do not fail, there are simply fewer of
   * them, and coverage disappears with nothing red to show it. This is the one assertion
   * that has to be edited on purpose.
   */
  it("guards exactly the prefixes it claims to", () => {
    expect([...GUARDED_PREFIXES]).toEqual(["organizations", "sharing"]);
  });

  // Per prefix, not a single total: 278 `organizations.*` keys would satisfy any
  // combined floor on their own, so a scan that matched only that prefix would leave
  // every assertion vacuous for the other one and still look green.
  it.each(GUARDED_PREFIXES)("finds the %s keys the source actually uses", (prefix) => {
    const found = usedScopedKeys().filter((key) => key.startsWith(`${prefix}.`));

    expect(found.length).toBeGreaterThan(50);
  });

  it.each(localeNames)("%s translates every guarded key used in the source", (locale) => {
    const missing = usedScopedKeys().filter((key) => !resolves(bundles[locale].common, key));

    expect(missing).toEqual([]);
  });

  it.each(localeNames)("%s carries the enumerated organization vocabularies", (locale) => {
    const expected = [
      ...["owner", "admin", "member"].flatMap((role) => [
        `organizations.roles.${role}`,
        `organizations.roleHints.${role}`,
      ]),
      ...["unspecified", ...zOrganizationType.options].map((type) => `organizations.types.${type}`),
      ...["required", "format", "tooLong", "reserved", "taken"].map(
        (reason) => `organizations.errors.slug.${reason}`,
      ),
      ...["pending", "approved", "rejected", "cancelled"].map(
        (status) => `organizations.requests.status.${status}`,
      ),
      // Both are built from a template literal, so the source scan above cannot see
      // them. Read from the schema rather than listed, so a newly owned type has to be
      // given a label instead of shipping as a raw key on the showcase and in the
      // delete-blocker breakdown.
      ...zSharingResourceType.options.flatMap((type) => [
        `organizations.resources.types.${type}`,
        `organizations.delete.owned.${type}`,
      ]),
      // An experiment row's meta badge. Read from the schema rather than listed, so a
      // sixth status has to be given a label instead of shipping as a raw key.
      ...zExperimentStatus.options.map((status) => `organizations.resources.status.${status}`),
      // The generic noun a metadata title falls back to for an inaccessible org.
      "organizations.organization",
    ];

    const missing = expected.filter((key) => !resolves(bundles[locale].common, key));

    expect(missing).toEqual([]);
  });

  it.each(localeNames)("%s keeps visible organization types searchable", (locale) => {
    for (const type of zOrganizationType.options) {
      const visibleLabel = LOCALES[locale].common.organizations.types[type].toLowerCase();
      expect(ORGANIZATION_TYPE_SEARCH_ALIASES[type].toLowerCase(), type).toContain(visibleLabel);
    }
  });

  // Kept after the scan was widened to `sharing.*`, which now finds these too. Redundant
  // on purpose: if the scan ever stops matching, this is what still fails.
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

  // Parity is a different question from coverage: the scan catches a key no locale has,
  // this catches one that some locales have and others do not — including keys nothing
  // in the source references by a literal.
  it.each(GUARDED_PREFIXES)("keeps the three locales' %s key sets identical", (prefix) => {
    const keysFor = (locale: (typeof localeNames)[number]) =>
      [...bundles[locale].common].filter((key) => key.startsWith(`${prefix}.`)).sort();

    const reference = keysFor("en-US");
    expect(reference.length).toBeGreaterThan(50);
    for (const locale of localeNames) {
      expect(keysFor(locale), `${locale} diverges from en-US`).toEqual(reference);
    }
  });
});
