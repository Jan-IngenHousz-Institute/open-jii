"use client";

import type { MetricsWindowDay } from "@repo/api/domains/metrics/metrics.schema";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
} from "@repo/ui/components/card";
import { AreaChart } from "@repo/ui/components/charts/area-chart";
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
 * The window's shape as a card in the same band as the figures. A display
 * chart: hover reads a day, drag would zoom or select.
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
    showGrid: false,
    sparkline: true,
    backgroundColor: "rgba(0,0,0,0)",
    xAxisType: detectAxisType(days.map((day) => day.date)),
    locale,
  };

  return (
    <Card
      className={cn(
        "@container/card from-primary/5 to-card dark:bg-card bg-linear-to-t shadow-xs",
        className,
      )}
    >
      <CardHeader>
        <CardDescription>{label}</CardDescription>
      </CardHeader>
      <CardContent className="px-3">
        <AreaChart
          data={[
            {
              x: days.map((day) => day.date),
              y: days.map((day) => day.measurements),
              name: seriesName,
              fill: "tozeroy",
              mode: "lines",
            },
          ]}
          config={config}
          className="h-14 w-full"
        />
      </CardContent>
      {footer === undefined ? null : (
        <CardFooter className="text-muted-foreground text-sm">{footer}</CardFooter>
      )}
    </Card>
  );
}
