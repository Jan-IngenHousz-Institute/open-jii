import { createRealI18n, TEST_LOCALES } from "@/test/real-i18n";
import { describe, expect, it } from "vitest";

import de from "@repo/i18n/locales/de-DE/common.json";
import en from "@repo/i18n/locales/en-US/common.json";
import nl from "@repo/i18n/locales/nl-NL/common.json";

const permanence = {
  "en-US": "Measurements you take here stay in the public demo permanently.",
  "nl-NL": "Metingen die je hier doet, blijven permanent in de openbare demo staan.",
  "de-DE":
    "Messungen, die du hier durchführst, bleiben dauerhaft in der öffentlichen Demo gespeichert.",
};

describe("guest prompt publication draft", () => {
  it.each(TEST_LOCALES)(
    "ships the permanent-measurement sentence and name-only prompt in %s",
    async (locale) => {
      const i18n = await createRealI18n(locale);
      expect(i18n.t("guestSession.permanentMeasurements")).toBe(permanence[locale]);
      for (const key of ["nameLabel", "nameHint", "accountRetention", "quotaHint"])
        expect(i18n.exists(`guestSession.${key}`)).toBe(true);
    },
  );
});

describe("demo entry and exit copy", () => {
  const english = Object.keys(en.demo).sort();

  it.each(TEST_LOCALES)("ships every demo string in %s", async (locale) => {
    const bundle = { "en-US": en, "nl-NL": nl, "de-DE": de }[locale];
    expect(Object.keys(bundle.demo).sort()).toEqual(english);
    for (const value of Object.values(bundle.demo)) expect(value).toMatch(/\S/);
    expect(bundle.experimentSettings.requestToJoinSubmit_true).toBeTruthy();

    const i18n = await createRealI18n(locale);
    expect(i18n.t("demo.leaveAction", { context: "retry" })).toBe(bundle.demo.retry);
    expect(i18n.t("demo.entryError", { context: "disabled" })).toBe(bundle.demo.unavailable);
  });
});
