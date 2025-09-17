/** Convert an ISO datetime to a local Date suitable for the Calendar (date-only). */
export function isoToLocalCalendarDate(iso?: string | null): Date | undefined {
  if (!iso) return undefined;
  const d = new Date(iso);
  if (isNaN(d.getTime())) return undefined;
  // Return a safe midday local Date for the same Y-M-D (avoids DST edge issues)
  return new Date(d.getFullYear(), d.getMonth(), d.getDate(), 12, 0, 0, 0);
}

/** Convert a local calendar Date (no time) to an ISO string at local end-of-day (23:59:59.999). */
export function localCalendarDateToIsoEndOfDay(date?: Date): string | undefined {
  if (!date) return undefined;
  const end = new Date(date.getFullYear(), date.getMonth(), date.getDate(), 23, 59, 59, 999);
  if (isNaN(end.getTime())) return undefined;
  return end.toISOString(); // RFC 3339 with Z (UTC)
}

export function addDays(date: Date, days: number): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate() + days, 12, 0, 0, 0);
}

export function defaultEmbargoIso90Days(): string {
  const ninetyDaysFromNow = addDays(new Date(), 90);
  // store end-of-day for the picked date
  return localCalendarDateToIsoEndOfDay(ninetyDaysFromNow) ?? "";
}

/** Return a helper string indicating when the experiment will become public, or null if no valid date. */
export function embargoUntilHelperString(
  iso?: string | null,
  t?: (key: string, options?: Record<string, unknown>) => string,
): string | null {
  if (!iso || !t) return null;
  const embargoUntil = new Date(iso);
  if (isNaN(embargoUntil.getTime())) return null;

  // The experiment becomes public at midnight UTC after embargo ends
  // Calculate the next UTC midnight after embargoUntil
  const utcYear = embargoUntil.getUTCFullYear();
  const utcMonth = embargoUntil.getUTCMonth();
  const utcDate = embargoUntil.getUTCDate();
  // Set to next day midnight UTC
  const publicUtcMidnight = new Date(Date.UTC(utcYear, utcMonth, utcDate + 1, 0, 0, 0, 0));

  // Convert UTC midnight to local time for display
  const publicLocalString = publicUtcMidnight.toLocaleString(undefined, {
    year: "numeric",
    month: "long",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });

  return t("newExperiment.embargoUntilHelperString", { date: publicLocalString });
}
