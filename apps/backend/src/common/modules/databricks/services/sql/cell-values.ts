/** Statement-result cells are strings; blank or absent reads as null. */
export function cellString(value: string | null | undefined): string | null {
  return value == null || value.trim() === "" ? null : value;
}

/** Number("") is 0; a blank cell must read as absent, never as zero. */
export function cellNumber(value: string | null | undefined): number | null {
  const cleaned = cellString(value);
  if (cleaned === null) {
    return null;
  }
  const parsed = Number(cleaned);
  return Number.isFinite(parsed) ? parsed : null;
}

/**
 * Warehouse timestamps arrive zone-less but are UTC ("2026-08-28 10:00:00");
 * anchor before ISO. Any other shape reads as absent rather than mis-zoned.
 */
export function cellUtcIso(value: string | null | undefined): string | null {
  if (!value) {
    return null;
  }
  const withT = value.replace(" ", "T");
  const candidate = withT.endsWith("Z") ? withT : `${withT}Z`;
  const parsed = new Date(candidate);
  return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString();
}
