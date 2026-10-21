import { vi } from "vitest";

import * as translations from "@repo/i18n";
import de from "@repo/i18n/locales/de-DE/common.json";
import en from "@repo/i18n/locales/en-US/common.json";
import nl from "@repo/i18n/locales/nl-NL/common.json";

export const TEST_LOCALES = ["en-US", "nl-NL", "de-DE"] as const;
export type TestLocale = (typeof TEST_LOCALES)[number];

const common = { "en-US": en, "nl-NL": nl, "de-DE": de };

/**
 * A real i18next instance over the shipped `common` bundle. The global mock answers
 * every `t` with its key, which cannot tell one `context` from another, so a test that
 * has to see which sentence a variant renders uses this instead.
 */
export async function createRealI18n(locale: TestLocale) {
  const { createInstance } = await vi.importActual<typeof translations>("@repo/i18n");
  const i18n = createInstance();
  await i18n.init({
    lng: locale,
    fallbackLng: "en-US",
    defaultNS: "common",
    resources: Object.fromEntries(TEST_LOCALES.map((name) => [name, { common: common[name] }])),
    interpolation: { escapeValue: false },
  });
  return i18n;
}

/** Points `useTranslation` from `@repo/i18n` at the real bundle for the rest of the test. */
export async function mockRealTranslations(locale: TestLocale) {
  const i18n = await createRealI18n(locale);
  vi.spyOn(translations, "useTranslation").mockImplementation(
    () => ({ t: i18n.t.bind(i18n), i18n }) as never,
  );
  return i18n;
}
