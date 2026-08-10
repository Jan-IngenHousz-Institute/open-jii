import { createInstance } from "i18next";
import { describe, expect, it } from "vitest";

import deWorkbook from "../locales/de-DE/workbook.json";
import enWorkbook from "../locales/en-US/workbook.json";
import nlWorkbook from "../locales/nl-NL/workbook.json";

const localeCases = [
  {
    locale: "en-US",
    workbook: enWorkbook,
    expected: {
      omittedOne: "1 malformed or unmatched point omitted.",
      omittedOther: "2 malformed or unmatched points omitted.",
      invalidOne: "1 invalid or empty series could not be plotted.",
      invalidOther: "2 invalid or empty series could not be plotted.",
    },
  },
  {
    locale: "de-DE",
    workbook: deWorkbook,
    expected: {
      omittedOne: "1 fehlerhafter oder nicht zugeordneter Punkt wurde ausgelassen.",
      omittedOther: "2 fehlerhafte oder nicht zugeordnete Punkte wurden ausgelassen.",
      invalidOne: "1 ungültige oder leere Reihe konnte nicht geplottet werden.",
      invalidOther: "2 ungültige oder leere Reihen konnten nicht geplottet werden.",
    },
  },
  {
    locale: "nl-NL",
    workbook: nlWorkbook,
    expected: {
      omittedOne: "1 ongeldig of niet-overeenkomend punt is weggelaten.",
      omittedOther: "2 ongeldige of niet-overeenkomende punten zijn weggelaten.",
      invalidOne: "1 ongeldige of lege reeks kon niet worden geplot.",
      invalidOther: "2 ongeldige of lege reeksen konden niet worden geplot.",
    },
  },
] as const;

describe("workbook trace pluralization", () => {
  it("keeps every trace locale key in parity", () => {
    const keySets = localeCases.map(({ workbook }) =>
      Object.keys(workbook.output)
        .filter((key) => key.startsWith("timeseriesTrace"))
        .sort(),
    );

    expect(keySets[1]).toEqual(keySets[0]);
    expect(keySets[2]).toEqual(keySets[0]);
  });

  it.each(localeCases)(
    "renders grammatical singular and plural forms for $locale",
    async (entry) => {
      const i18n = createInstance();
      await i18n.init({
        lng: entry.locale,
        fallbackLng: false,
        defaultNS: "workbook",
        resources: { [entry.locale]: { workbook: entry.workbook } },
        interpolation: { escapeValue: false },
      });

      expect(i18n.t("output.timeseriesTraceOmittedPoints", { count: 1 })).toBe(
        entry.expected.omittedOne,
      );
      expect(i18n.t("output.timeseriesTraceOmittedPoints", { count: 2 })).toBe(
        entry.expected.omittedOther,
      );
      expect(i18n.t("output.timeseriesTraceInvalidSeries", { count: 1 })).toBe(
        entry.expected.invalidOne,
      );
      expect(i18n.t("output.timeseriesTraceInvalidSeries", { count: 2 })).toBe(
        entry.expected.invalidOther,
      );
    },
  );
});
