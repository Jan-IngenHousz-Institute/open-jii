import { DateTime } from "luxon";
import { describe, expect, it } from "vitest";
import { SUPPORTED_LOCALES } from "~/shared/i18n";

import { luxonLocale } from "./luxon-locale";

describe("luxonLocale", () => {
  it("formats English day-first, which is why en-US maps to en-GB", () => {
    expect(luxonLocale("en-US")).toBe("en-GB");
  });

  it("passes Dutch through unchanged", () => {
    expect(luxonLocale("nl-NL")).toBe("nl-NL");
  });

  it.each(["de-DE", "fr", "", "not-a-locale"])("falls back to en-GB for %o", (language) => {
    expect(luxonLocale(language)).toBe("en-GB");
  });

  it.each(SUPPORTED_LOCALES)("gives %s a tag Luxon actually understands", (locale) => {
    const date = DateTime.fromISO("2026-03-09T00:00:00.000Z").setLocale(luxonLocale(locale));

    expect(date.isValid).toBe(true);
    // A tag Luxon cannot resolve falls back to the machine locale, which would
    // make this read "March" whatever the app language is.
    expect(date.toFormat("LLLL")).toBe(locale === "nl-NL" ? "maart" : "March");
  });

  it("produces a day-first English date, the behaviour the mapping exists for", () => {
    const date = DateTime.fromISO("2026-03-09T00:00:00.000Z").setLocale(luxonLocale("en-US"));

    expect(date.toFormat("d LLLL yyyy")).toBe("9 March 2026");
    expect(date.toLocaleString(DateTime.DATE_SHORT)).toBe("09/03/2026");
  });

  it("produces a Dutch month name", () => {
    const date = DateTime.fromISO("2026-03-09T00:00:00.000Z").setLocale(luxonLocale("nl-NL"));

    expect(date.toFormat("LLLL yyyy")).toBe("maart 2026");
  });
});
