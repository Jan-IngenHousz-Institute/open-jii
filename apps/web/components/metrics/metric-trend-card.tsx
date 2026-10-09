"use client";

import type { ReactNode } from "react";

import type { MetricsWindowDay } from "@repo/api/domains/metrics/metrics.schema";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@repo/ui/components/card";

import { TrendSparkline } from "./trend-sparkline";

interface MetricTrendCardProps {
  label: string;
  value: ReactNode;
  title?: string;
  seriesName: string;
  days: MetricsWindowDay[];
  peakDate?: string | null;
  /** Bars read better on a sparse window, a line on a continuous one. */
  mark?: "bars" | "line";
  locale: string;
  footer?: string;
  className?: string;
}

/** A figure of the window with the window behind it. No axes: hover carries the values. */
export function MetricTrendCard({
  label,
  value,
  title,
  seriesName,
  days,
  peakDate = null,
  mark = "bars",
  locale,
  footer,
  className,
}: MetricTrendCardProps) {
  return (
    <Card padding="sm" className={className}>
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
        <TrendSparkline
          days={days}
          mark={mark}
          peakDate={peakDate}
          seriesName={seriesName}
          locale={locale}
          className="h-10 w-full"
        />
      </CardContent>
      {footer === undefined ? null : (
        <CardFooter className="text-muted-foreground mt-auto text-xs">{footer}</CardFooter>
      )}
    </Card>
  );
}
