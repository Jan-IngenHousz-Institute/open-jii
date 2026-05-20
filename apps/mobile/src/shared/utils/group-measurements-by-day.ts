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

/**
 * Groups measurements by calendar day in the device timezone. Sections
 * preserve the descending order of the input (newest day first); within a
 * section, items keep their incoming order.
 */
export function groupMeasurementsByDay(
  items: MeasurementItem[],
  now: DateTime = DateTime.now(),
  locale = "en-GB",
): MeasurementDaySection[] {
  const today = now.startOf("day");
  const yesterday = today.minus({ days: 1 });

  const sectionsMap = new Map<string, MeasurementDaySection>();

  for (const item of items) {
    const dt = DateTime.fromISO(item.timestamp, { zone: now.zoneName ?? undefined });
    if (!dt.isValid) continue;
    const dayStart = dt.startOf("day");
    const key = dayStart.toISODate();
    if (!key) continue;

    let section = sectionsMap.get(key);
    if (!section) {
      const kind: DayKind = dayStart.equals(today)
        ? "today"
        : dayStart.equals(yesterday)
          ? "yesterday"
          : "other";
      const dateLabel = dayStart.setLocale(locale).toFormat("ccc d LLL");
      section = { key, kind, dateLabel, data: [] };
      sectionsMap.set(key, section);
    }
    section.data.push(item);
  }

  return Array.from(sectionsMap.values()).sort((a, b) => (a.key < b.key ? 1 : -1));
}
