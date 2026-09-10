"use client";

import type { MetricsWindowDay } from "@repo/api/domains/metrics/metrics.schema";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
} from "@repo/ui/components/card";
import { BarChart } from "@repo/ui/components/charts/bar-chart";
import type { PlotlyChartConfig } from "@repo/ui/components/charts/types";
import { detectAxisType } from "@repo/ui/components/charts/utils";
import { cn } from "@repo/ui/lib/utils";

interface MetricTrendCardProps {
  label: string;
  seriesName: string;
  days: MetricsWindowDay[];
  locale: string;
  footer?: string;
  className?: string;
}

/**
 * The window's shape, as one bar per day. Daily counts are discrete, and a
 * filled area over a steady series draws a solid block that says nothing,
 * while bars stay readable whatever the shape. A display chart: hover reads a
 * day, drag would zoom or select.
 */
export function MetricTrendCard({
  label,
  seriesName,
  days,
  locale,
  footer,
  className,
}: MetricTrendCardProps) {
  const config: PlotlyChartConfig = {
    showLegend: false,
    showModeBar: false,
    dragMode: false,
    scrollZoom: false,
    showGrid: true,
    backgroundColor: "rgba(0,0,0,0)",
    xAxisType: detectAxisType(days.map((day) => day.date)),
    locale,
  };

  return (
    <Card
      className={cn(
        "@container/card from-primary/5 to-card dark:bg-card bg-linear-to-t shadow-xs gap-3 py-4",
        className,
      )}
    >
      <CardHeader>
        <CardDescription>{label}</CardDescription>
      </CardHeader>
      <CardContent className="px-2">
        <BarChart
          data={[
            {
              x: days.map((day) => day.date),
              y: days.map((day) => day.measurements),
              name: seriesName,
            },
          ]}
          config={config}
          className="h-20 w-full"
        />
      </CardContent>
      {footer === undefined ? null : (
        <CardFooter className="text-muted-foreground text-sm">{footer}</CardFooter>
      )}
    </Card>
  );
}
