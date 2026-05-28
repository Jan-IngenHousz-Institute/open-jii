import { DateTime } from "luxon";
import type { MeasurementItem } from "~/features/recent-measurements/hooks/use-all-measurements";

export type DayKind = "today" | "yesterday" | "other";

export interface MeasurementDaySection {
  /** Stable, sort-friendly day key (YYYY-MM-DD). */
  key: string;
  /** What kind of day this is — drives the i18n key the caller picks. */
  kind: DayKind;
  /** Localised "Tue 18 May" — caller wraps in the appropriate i18n key. */
  dateLabel: string;
  data: MeasurementItem[];
}

const DAY_KEY_RE = /^\d{4}-\d{2}-\d{2}$/;

/**
 * Groups measurements by calendar day. Rows carry a precomputed `dayKey`
 * ("YYYY-MM-DD", the local date resolved at save time) so the hot path is a
 * string bucket with no per-item Luxon parsing — that per-item parse was the
 * ~140 ms mount hitch on the Recent tab (OJD-1470). Legacy rows without a
 * valid dayKey fall back to parsing the ISO timestamp. Sections are
 * newest-day-first; order within a section is preserved.
 */
export function groupMeasurementsByDay(
  items: MeasurementItem[],
  now: DateTime = DateTime.now(),
  locale = "en-GB",
): MeasurementDaySection[] {
  const zone = now.zoneName ?? undefined;
  const startOfToday = now.startOf("day");
  const todayKey = startOfToday.toISODate();
  const yesterdayKey = startOfToday.minus({ days: 1 }).toISODate();

  const sectionsMap = new Map<string, MeasurementDaySection>();

  for (const item of items) {
    // Fast path: trust the precomputed day_key. Fall back to parsing the
    // timestamp for legacy rows pending backfill (dayKey "" or malformed).
    let key = DAY_KEY_RE.test(item.dayKey) ? item.dayKey : null;
    if (!key) {
      const dt = DateTime.fromISO(item.timestamp, { zone });
      key = dt.isValid ? dt.toISODate() : null;
    }
    if (!key) continue;

    let section = sectionsMap.get(key);
    if (!section) {
      const kind: DayKind =
        key === todayKey ? "today" : key === yesterdayKey ? "yesterday" : "other";
      // Label formatting is per-section (a handful), not per-item, so the
      // Luxon cost here is negligible.
      const labelDt = DateTime.fromISO(key);
      const dateLabel = labelDt.isValid ? labelDt.setLocale(locale).toFormat("ccc d LLL") : key;
      section = { key, kind, dateLabel, data: [] };
      sectionsMap.set(key, section);
    }
    section.data.push(item);
  }

  return Array.from(sectionsMap.values()).sort((a, b) => (a.key < b.key ? 1 : -1));
}
