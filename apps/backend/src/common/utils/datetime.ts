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

/**
 * Databricks SQL timestamps carry no offset, so treat those as UTC instead of
 * letting the parse drift with the server's timezone.
 */
export function parseDatabricksTimestamp(value: string | null | undefined): Date | null {
  const normalized = value?.trim();
  if (!normalized) {
    return null;
  }

  const withOffset = /^\d{4}-\d{2}-\d{2}[ T]\d{2}:\d{2}:\d{2}(?:\.\d+)?$/.test(normalized)
    ? `${normalized.replace(" ", "T")}Z`
    : normalized;

  const date = new Date(withOffset);
  return Number.isNaN(date.getTime()) ? null : date;
}
