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

const OFFSETLESS = /^(\d{4}-\d{2}-\d{2})[ T](\d{2}:\d{2}:\d{2})(?:\.\d+)?$/;

/**
 * Databricks SQL timestamps carry no offset, so treat those as UTC instead of
 * letting the parse drift with the server's timezone. Rejects impossible
 * calendar dates, which `Date` would otherwise roll forward into a wrong instant.
 */
export function parseDatabricksTimestamp(value: string | null | undefined): Date | null {
  const normalized = value?.trim();
  if (!normalized) {
    return null;
  }

  const offsetless = OFFSETLESS.exec(normalized);
  const date = new Date(offsetless ? `${normalized.replace(" ", "T")}Z` : normalized);
  if (Number.isNaN(date.getTime())) {
    return null;
  }

  // "2026-02-30" parses as 2026-03-02; only a round trip catches the rollover.
  if (offsetless && !date.toISOString().startsWith(`${offsetless[1]}T${offsetless[2]}`)) {
    return null;
  }

  return date;
}
