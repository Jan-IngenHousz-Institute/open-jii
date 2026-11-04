import { endOfDay, endOfMonth, startOfMonth, startOfYear, subMonths } from "date-fns";

import type { ExperimentRelativeTimeWindow } from "@repo/api/domains/experiment/data/experiment-data.schema";
import { resolveRelativeTimeWindow } from "@repo/api/transforms/relative-time-filter";

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
  relativeWindow?: ExperimentRelativeTimeWindow;
}

export const DATE_RANGE_PRESETS: DateRangePresetDef[] = [
  {
    id: "last1h",
    labelKey: "dataFilters.presetLastHour",
    relativeWindow: { last: 1, unit: "hours" },
  },
  {
    id: "last24h",
    labelKey: "dataFilters.presetLast24h",
    relativeWindow: { last: 24, unit: "hours" },
  },
  { id: "last7d", labelKey: "dataFilters.presetLast7d", relativeWindow: { last: 7, unit: "days" } },
  {
    id: "last30d",
    labelKey: "dataFilters.presetLast30d",
    relativeWindow: { last: 30, unit: "days" },
  },
  {
    id: "last90d",
    labelKey: "dataFilters.presetLast90d",
    relativeWindow: { last: 90, unit: "days" },
  },
  { id: "thisMonth", labelKey: "dataFilters.presetThisMonth" },
  { id: "lastMonth", labelKey: "dataFilters.presetLastMonth" },
  { id: "thisYear", labelKey: "dataFilters.presetThisYear" },
  { id: "yearToDate", labelKey: "dataFilters.presetYearToDate" },
];

export function computeDateRangePreset(id: DateRangePresetId): [Date, Date] {
  const now = new Date();
  const relative = DATE_RANGE_PRESETS.find((preset) => preset.id === id)?.relativeWindow;
  if (relative) {
    const [start, end] = resolveRelativeTimeWindow(relative, now.getTime());
    return [new Date(start), new Date(end)];
  }
  switch (id) {
    case "thisMonth":
      return [startOfMonth(now), now];
    case "lastMonth": {
      const prevMonth = subMonths(now, 1);
      return [startOfMonth(prevMonth), endOfDay(endOfMonth(prevMonth))];
    }
    case "thisYear":
    case "yearToDate":
      return [startOfYear(now), now];
    default:
      throw new Error(`Missing relative window for ${id}`);
  }
}

export function relativeTimePresetLabelKey(window: ExperimentRelativeTimeWindow): string {
  const preset = DATE_RANGE_PRESETS.find(
    (preset) =>
      preset.relativeWindow?.last === window.last && preset.relativeWindow.unit === window.unit,
  );
  return preset?.labelKey ?? "dataFilters.pickRange";
}
