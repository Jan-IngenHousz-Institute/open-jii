"use client";

import type { MetricsWindowDay } from "@repo/api/domains/metrics/metrics.schema";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@repo/ui/components/card";
import { BarChart } from "@repo/ui/components/charts/bar-chart";
import type { PlotlyChartConfig } from "@repo/ui/components/charts/types";
import { detectAxisType, resolveChartColorway } from "@repo/ui/components/charts/utils";
import { cn } from "@repo/ui/lib/utils";

const QUIET_BAR_OPACITY = 0.45;
const TRACK_OPACITY = 0.08;

interface MetricTrendCardProps {
  label: string;
  value: string;
  /** The full figure behind an abbreviated `value`, shown on hover. */
  title?: string;
  seriesName: string;
  days: MetricsWindowDay[];
  /** The day to pick out of the strip, if the window had a standout one. */
  peakDate?: string | null;
  locale: string;
  footer?: string;
  className?: string;
}

/**
 * A figure of the window, with the days it came from underneath. One bar per
 * day: daily counts are discrete, and a filled area over a steady series draws
 * a solid block that says nothing. Axes are left off at this size, where a
 * tick label is unreadable and hover carries the values anyway.
 */
export function MetricTrendCard({
  label,
  value,
  title,
  seriesName,
  days,
  peakDate = null,
  locale,
  footer,
  className,
}: MetricTrendCardProps) {
  const config: PlotlyChartConfig = {
    showLegend: false,
    showModeBar: false,
    dragMode: false,
    scrollZoom: false,
    showGrid: false,
    sparkline: true,
    bargap: 0.15,
    backgroundColor: "rgba(0,0,0,0)",
    xAxisType: detectAxisType(days.map((day) => day.date)),
    locale,
  };

  // The busiest day carries the emphasis so the strip states something rather
  // than drawing thirty equal bars.
  const opacity = days.map((day) => (day.date === peakDate ? 1 : QUIET_BAR_OPACITY));

  const dates = days.map((day) => day.date);
  const measurements = days.map((day) => day.measurements);

  // A day with nothing draws no bar, so a sparse window would read as an empty
  // card. Every day gets a faint full-height slot behind the data instead: the
  // strip then shows how much of the window was quiet.
  const trackHeight = Math.max(...measurements, 0) || 1;
  const seriesColor = resolveChartColorway()?.[0];

  return (
    <Card className={cn("@container/card gap-2 py-3", className)}>
      <CardHeader className="gap-1">
        <CardDescription>{label}</CardDescription>
        <CardTitle
          title={title}
          className="line-clamp-1 min-w-0 text-2xl font-semibold tabular-nums"
        >
          {value}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <BarChart
          barmode="overlay"
          data={[
            {
              x: dates,
              y: dates.map(() => trackHeight),
              name: seriesName,
              color: seriesColor,
              marker: { opacity: TRACK_OPACITY },
              hoverinfo: "skip",
              showlegend: false,
            },
            {
              x: dates,
              y: measurements,
              name: seriesName,
              color: seriesColor,
              marker: { opacity },
            },
          ]}
          config={config}
          className="h-10 w-full"
        />
      </CardContent>
      {footer === undefined ? null : (
        <CardFooter className="text-muted-foreground mt-auto text-xs">{footer}</CardFooter>
      )}
    </Card>
  );
}
