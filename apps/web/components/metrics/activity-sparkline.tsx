"use client";

import type { MetricsWindowDay } from "@repo/api/domains/metrics/metrics.schema";
import { LineChart } from "@repo/ui/components/charts/line-chart";
import type { PlotlyChartConfig } from "@repo/ui/components/charts/types";
import { useChartThemeRefresh } from "@repo/ui/components/charts/use-chart-theme-refresh";
import { detectAxisType, platformChartColor } from "@repo/ui/components/charts/utils";
import { cn } from "@repo/ui/lib/utils";

interface ActivitySparklineProps {
  days: MetricsWindowDay[];
  /** Trace name, which is what hover prints. */
  seriesName: string;
  /** Describes the line for readers who cannot see it, as `ActivityStrip` does. */
  label: string;
  locale: string;
  className?: string;
}

/** `ActivityStrip` with hover: worth a plot library at card height, not at row height. */
export function ActivitySparkline({
  days,
  seriesName,
  label,
  locale,
  className,
}: ActivitySparklineProps) {
  // Resolved in JS, so this has to learn about a theme swap itself.
  useChartThemeRefresh();

  const config: PlotlyChartConfig = {
    showLegend: false,
    showModeBar: false,
    dragMode: false,
    scrollZoom: false,
    showGrid: false,
    sparkline: true,
    backgroundColor: "rgba(0,0,0,0)",
    xAxisType: detectAxisType(days.map((day) => day.date)),
    locale,
  };

  return (
    <div role="img" aria-label={label} className={cn("h-10 w-full", className)}>
      <LineChart
        data={[
          {
            x: days.map((day) => day.date),
            y: days.map((day) => day.measurements),
            name: seriesName,
            color: platformChartColor(0),
            line: { width: 1.5 },
          },
        ]}
        config={config}
        className="h-full w-full"
      />
    </div>
  );
}
