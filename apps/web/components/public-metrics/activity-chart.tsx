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

/** Days within a year of the newest one, dropping clock-skewed outliers. */
function recentYear(data: MetricsActivityDay[]): MetricsActivityDay[] {
  if (data.length === 0) {
    return data;
  }

  const cutoff = Date.parse(data[data.length - 1].date) - CUMULATIVE_DAYS * DAY_MS;
  return data.filter((day) => Date.parse(day.date) >= cutoff);
}

/** Daily bars or the twelve-month cumulative curve, over the same series. */
export function ActivityChart({ data, locale }: ActivityChartProps) {
  const { t } = useTranslation("publicMetrics");
  const [mode, setMode] = useState<ActivityMode>("daily");

  const isCumulative = mode === "cumulative";
  const points = isCumulative ? recentYear(data) : data.slice(-DAYS_SHOWN);

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
