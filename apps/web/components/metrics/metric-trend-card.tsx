"use client";

import type { ReactNode } from "react";

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
  footer?: ReactNode;
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
    <Card className={cn("gap-3 py-5", className)}>
      <CardHeader className="gap-1">
        <CardDescription className="text-xs font-medium uppercase tracking-wide">
          {label}
        </CardDescription>
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
          className="h-12 w-full"
        />
      </CardContent>
      {footer === undefined ? null : (
        <CardFooter className="text-muted-foreground text-xs">{footer}</CardFooter>
      )}
    </Card>
  );
}
