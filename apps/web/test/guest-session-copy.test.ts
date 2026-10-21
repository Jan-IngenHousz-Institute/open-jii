import { createRealI18n, TEST_LOCALES } from "@/test/real-i18n";
import { describe, expect, it } from "vitest";

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
