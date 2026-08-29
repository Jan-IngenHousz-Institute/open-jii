"use client";

import { useState } from "react";

import type { MetricsActivityDay } from "@repo/api/domains/metrics/metrics.schema";
import { useTranslation } from "@repo/i18n";
import { AreaChart } from "@repo/ui/components/charts/area-chart";
import { BarChart } from "@repo/ui/components/charts/bar-chart";
import type { PlotlyChartConfig } from "@repo/ui/components/charts/types";
import { detectAxisType } from "@repo/ui/components/charts/utils";

const DAYS_SHOWN = 30;

type ActivityMode = "daily" | "cumulative" | "volume";

interface ActivityChartProps {
  data: MetricsActivityDay[];
  locale: string;
}

/** One chart, three measures: daily bars, cumulative area, volume bars. */
export function ActivityChart({ data, locale }: ActivityChartProps) {
  const { t } = useTranslation("publicMetrics");
  const [mode, setMode] = useState<ActivityMode>("daily");

  const isCumulative = mode === "cumulative";
  const points = isCumulative ? data : data.slice(-DAYS_SHOWN);

  const measureOf = (day: MetricsActivityDay) => {
    if (mode === "daily") {
      return day.measurements;
    }
    return isCumulative ? day.cumulativeMeasurements : day.volumeBytes;
  };

  const x = points.map((day) => day.date);
  const y = points.map(measureOf);
  const label = t(`activityChart.${mode}`);

  const config: PlotlyChartConfig = {
    showLegend: false,
    showModeBar: false,
    showGrid: true,
    backgroundColor: "rgba(0,0,0,0)",
    height: 208,
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

  const modes: ActivityMode[] = ["daily", "cumulative", "volume"];

  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h3 className="text-foreground text-sm font-medium">{t(`activityChart.title.${mode}`)}</h3>
        <div className="border-border flex rounded-full border">{modes.map(renderModeButton)}</div>
      </div>
      {isCumulative ? (
        <AreaChart
          data={[{ x, y, name: label, fill: "tozeroy", mode: "lines" }]}
          config={config}
          className="h-52 w-full"
        />
      ) : (
        <BarChart data={[{ x, y, name: label }]} config={config} className="h-52 w-full" />
      )}
    </div>
  );
}
