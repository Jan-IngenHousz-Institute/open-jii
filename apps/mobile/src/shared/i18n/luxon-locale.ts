import type { SupportedLocale } from "~/shared/i18n";

const FALLBACK = "en-GB";

// "en-US" is this app's identifier for English, not a statement about the
// United States: the audience is European, so dates read day-first, which is
// what en-GB gives and en-US would not.
const LUXON_LOCALE: Record<SupportedLocale, string> = {
  "en-US": "en-GB",
  "nl-NL": "nl-NL",
};

export function luxonLocale(language: string): string {
  return LUXON_LOCALE[language as SupportedLocale] ?? FALLBACK;
}
