import { describe, expect, it } from "vitest";

import { zNotificationCategory } from "@repo/api/domains/notification/notification.schema";
import deNotifications from "@repo/i18n/locales/de-DE/notifications.json";
import enNotifications from "@repo/i18n/locales/en-US/notifications.json";
import nlNotifications from "@repo/i18n/locales/nl-NL/notifications.json";

/**
 * Locale coverage for the category vocabulary the preferences card renders.
 *
 * The card builds its keys as `` t(`categories.${category}.label`) `` from
 * `zNotificationCategory`, which is the right pattern but invisible to the literal
 * `t("…")` scan in `organization-and-sharing-strings.test.ts` — so until this file
 * existed nothing checked that a category added to the enum had copy anywhere.
 *
 * `nl-NL` is commented out of the i18n config and still maintained, so it is checked
 * like the other two: a gap left now is one nobody notices until it is switched on.
 */
const BUNDLES = {
  "en-US": enNotifications,
  "de-DE": deNotifications,
  "nl-NL": nlNotifications,
} as const;

type Bundle = (typeof BUNDLES)[keyof typeof BUNDLES];

const locales = Object.keys(BUNDLES) as (keyof typeof BUNDLES)[];

function categoryEntry(bundle: Bundle, category: string): Record<string, string> | undefined {
  return (bundle.categories as Record<string, Record<string, string> | undefined>)[category];
}

describe("notifications locale coverage", () => {
  describe.each(locales)("%s", (locale) => {
    const bundle = BUNDLES[locale];

    it.each(zNotificationCategory.options)("names and describes %s", (category) => {
      const entry = categoryEntry(bundle, category);

      expect(entry, `${locale} is missing categories.${category}`).toBeDefined();
      expect(entry?.label.trim(), `${locale} categories.${category}.label is empty`).not.toBe("");
      expect(
        entry?.description.trim(),
        `${locale} categories.${category}.description is empty`,
      ).not.toBe("");
    });

    it("carries no category the enum does not have", () => {
      expect(Object.keys(bundle.categories).sort()).toEqual(
        [...zNotificationCategory.options].sort(),
      );
    });

    it("keeps preferences.* in parity with en-US, with no empty value", () => {
      expect(Object.keys(bundle.preferences).sort()).toEqual(
        Object.keys(enNotifications.preferences).sort(),
      );
      for (const [key, value] of Object.entries(bundle.preferences)) {
        expect(value.trim(), `${locale} preferences.${key} is empty`).not.toBe("");
      }
    });

    it.each(["filters", "groups", "empty"] as const)(
      "keeps %s.* in parity with en-US, with no empty value",
      (group) => {
        expect(Object.keys(bundle[group]).sort()).toEqual(
          Object.keys(enNotifications[group]).sort(),
        );
        for (const [key, value] of Object.entries(bundle[group])) {
          expect(value.trim(), `${locale} ${group}.${key} is empty`).not.toBe("");
        }
      },
    );
  });
});
