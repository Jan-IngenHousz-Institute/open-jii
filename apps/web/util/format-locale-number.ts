/**
 * Formats a number with locale-appropriate digit grouping, e.g.
 * 12345 -> "12,345" for "en-US", "12.345" for "de-DE".
 */
export function formatLocaleNumber(value: number, locale: string): string {
  return new Intl.NumberFormat(locale).format(value);
}
