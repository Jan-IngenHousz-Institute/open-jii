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
import { detectAxisType } from "@repo/ui/components/charts/utils";
import { cn } from "@repo/ui/lib/utils";

const QUIET_BAR_OPACITY = 0.45;

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

  return (
    <Card
      className={cn(
        "@container/card from-primary/5 to-card dark:bg-card bg-linear-to-t shadow-xs gap-3 py-4",
        className,
      )}
    >
      <CardHeader>
        <CardDescription>{label}</CardDescription>
        <CardTitle
          title={title}
          className="line-clamp-1 min-w-0 text-2xl font-semibold tabular-nums"
        >
          {value}
        </CardTitle>
      </CardHeader>
      <CardContent className="px-4">
        <BarChart
          data={[
            {
              x: days.map((day) => day.date),
              y: days.map((day) => day.measurements),
              name: seriesName,
              marker: { opacity },
            },
          ]}
          config={config}
          className="h-12 w-full"
        />
      </CardContent>
      {footer === undefined ? null : (
        <CardFooter className="text-muted-foreground mt-auto text-sm">{footer}</CardFooter>
      )}
    </Card>
  );
}
