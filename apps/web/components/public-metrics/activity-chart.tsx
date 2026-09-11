"use client";

import { useState } from "react";

import type { MetricsActivityDay } from "@repo/api/domains/metrics/metrics.schema";
import { useTranslation } from "@repo/i18n";
import { AreaChart } from "@repo/ui/components/charts/area-chart";
import { BarChart } from "@repo/ui/components/charts/bar-chart";
import type { PlotlyChartConfig } from "@repo/ui/components/charts/types";
import { detectAxisType } from "@repo/ui/components/charts/utils";

const DAYS_SHOWN = 30;
// Device clocks drift, so daily_activity carries a tail of implausibly early
// dates. Twelve months is the honest span for a growth curve.
const CUMULATIVE_DAYS = 365;
const DAY_MS = 24 * 60 * 60 * 1000;

type ActivityMode = "daily" | "cumulative";

interface ActivityChartProps {
  data: MetricsActivityDay[];
  locale: string;
}

/** Days within a year of today, dropping clock-skewed outliers. */
function recentYear(data: MetricsActivityDay[]): MetricsActivityDay[] {
  const cutoff = Date.now() - CUMULATIVE_DAYS * DAY_MS;
  return data.filter((day) => Date.parse(day.date) >= cutoff);
}

/**
 * The last `DAYS_SHOWN` calendar days, silent ones included. The warehouse
 * only writes days that recorded something, so taking the last N rows would
 * stretch a sparse series across months and label it a month.
 */
function recentDays(data: MetricsActivityDay[]): MetricsActivityDay[] {
  const byDate = new Map(data.map((day) => [day.date, day]));
  const today = Date.now();

  return Array.from({ length: DAYS_SHOWN }, (_, index) => {
    const date = new Date(today - (DAYS_SHOWN - 1 - index) * DAY_MS).toISOString().slice(0, 10);
    return byDate.get(date) ?? { date, measurements: 0, cumulativeMeasurements: 0, volumeBytes: 0 };
  });
}

/** Daily bars or the twelve-month cumulative curve, over the same series. */
export function ActivityChart({ data, locale }: ActivityChartProps) {
  const { t } = useTranslation("publicMetrics");
  const [mode, setMode] = useState<ActivityMode>("daily");

  const isCumulative = mode === "cumulative";
  const points = isCumulative ? recentYear(data) : recentDays(data);

  const x = points.map((day) => day.date);
  const y = points.map((day) => (isCumulative ? day.cumulativeMeasurements : day.measurements));
  const label = t(`activityChart.${mode}`);

  const config: PlotlyChartConfig = {
    showLegend: false,
    showModeBar: false,
    // A display chart: hover reads values, drag would zoom or select.
    dragMode: false,
    scrollZoom: false,
    showGrid: true,
    backgroundColor: "rgba(0,0,0,0)",
    xAxisType: detectAxisType(x),
    // Plotly hangs the year off the first date tick on a second line. The
    // twelve-month view needs it; a month of days does not.
    xAxisTickFormat: isCumulative ? undefined : "%b %-d",
    locale,
  };

  const renderModeButton = (candidate: ActivityMode) => (
    <button
      key={candidate}
      type="button"
      aria-pressed={mode === candidate}
      onClick={() => setMode(candidate)}
      className="aria-pressed:bg-primary aria-pressed:text-primary-foreground text-muted-foreground rounded-full px-3 py-1 text-xs font-medium"
    >
      {t(`activityChart.${candidate}`)}
    </button>
  );

  const modes: ActivityMode[] = ["daily", "cumulative"];

  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h3 className="text-foreground text-sm font-medium">{t(`activityChart.title.${mode}`)}</h3>
        <div className="border-border flex shrink-0 rounded-full border">
          {modes.map(renderModeButton)}
        </div>
      </div>
      {isCumulative ? (
        <AreaChart
          data={[{ x, y, name: label, fill: "tozeroy", mode: "lines" }]}
          config={config}
          className="h-48 w-full sm:h-56"
        />
      ) : (
        <BarChart data={[{ x, y, name: label }]} config={config} className="h-48 w-full sm:h-56" />
      )}
    </div>
  );
}
