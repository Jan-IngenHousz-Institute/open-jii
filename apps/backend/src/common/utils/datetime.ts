/**
 * Compact "YYYYMMDD_HHMMSS" timestamp from an instant. Used for filenames and
 * directory names where ISO 8601's colons and dashes are inconvenient.
 */
export function compactTimestamp(date: Date = new Date()): string {
  const iso = date.toISOString();
  const datePart = iso.slice(0, 10).replaceAll("-", "");
  const timePart = iso.slice(11, 19).replaceAll(":", "");
  return `${datePart}_${timePart}`;
}
