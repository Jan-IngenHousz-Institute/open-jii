import {
  endOfDay,
  endOfMonth,
  startOfMonth,
  startOfYear,
  subDays,
  subHours,
  subMonths,
} from "date-fns";

export type DateRangePresetId =
  | "last1h"
  | "last24h"
  | "last7d"
  | "last30d"
  | "last90d"
  | "thisMonth"
  | "lastMonth"
  | "thisYear"
  | "yearToDate";

export interface DateRangePresetDef {
  id: DateRangePresetId;
  labelKey: string;
}

export const DATE_RANGE_PRESETS: DateRangePresetDef[] = [
  { id: "last1h", labelKey: "dataFilters.presetLastHour" },
  { id: "last24h", labelKey: "dataFilters.presetLast24h" },
  { id: "last7d", labelKey: "dataFilters.presetLast7d" },
  { id: "last30d", labelKey: "dataFilters.presetLast30d" },
  { id: "last90d", labelKey: "dataFilters.presetLast90d" },
  { id: "thisMonth", labelKey: "dataFilters.presetThisMonth" },
  { id: "lastMonth", labelKey: "dataFilters.presetLastMonth" },
  { id: "thisYear", labelKey: "dataFilters.presetThisYear" },
  { id: "yearToDate", labelKey: "dataFilters.presetYearToDate" },
];

export function computeDateRangePreset(id: DateRangePresetId): [Date, Date] {
  const now = new Date();
  switch (id) {
    case "last1h":
      return [subHours(now, 1), now];
    case "last24h":
      return [subHours(now, 24), now];
    case "last7d":
      return [subDays(now, 7), now];
    case "last30d":
      return [subDays(now, 30), now];
    case "last90d":
      return [subDays(now, 90), now];
    case "thisMonth":
      return [startOfMonth(now), now];
    case "lastMonth": {
      const prevMonth = subMonths(now, 1);
      return [startOfMonth(prevMonth), endOfDay(endOfMonth(prevMonth))];
    }
    case "thisYear":
    case "yearToDate":
      return [startOfYear(now), now];
  }
}
