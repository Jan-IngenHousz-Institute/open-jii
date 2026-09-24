/** A list of names as the sentence it belongs in, not the CSV a form field would show. */
export function formatList(locale: string, items: string[]): string {
  return new Intl.ListFormat(locale, { type: "conjunction" }).format(items);
}
