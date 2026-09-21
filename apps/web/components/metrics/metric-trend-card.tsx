"use client";

import { BarChart } from "@/components/charts/bar-chart";
import { LineChart } from "@/components/charts/line-chart";
import type { ReactNode } from "react";
import { useMemo } from "react";

import type { MetricsWindowDay } from "@repo/api/domains/metrics/metrics.schema";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@repo/ui/components/card";
import type { PlotlyChartConfig } from "@repo/ui/components/charts/types";
import { useChartThemeRefresh } from "@repo/ui/components/charts/use-chart-theme-refresh";
import { detectAxisType, platformChartColor } from "@repo/ui/components/charts/utils";

const QUIET_BAR_OPACITY = 0.45;
const TRACK_OPACITY = 0.08;
/** Two hex digits, so the area under the line stays a wash. */
const AREA_ALPHA = "1f";

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
  const config: PlotlyChartConfig = useMemo(
    () => ({
      showLegend: false,
      showModeBar: false,
      showHoverName: false,
      dragMode: false,
      scrollZoom: false,
      showGrid: false,
      sparkline: true,
      bargap: 0.15,
      backgroundColor: "rgba(0,0,0,0)",
      xAxisType: detectAxisType(days.map((day) => day.date)),
      locale,
    }),
    [days, locale],
  );

  // Resolved here, not left to `layout.colorway`, so track and data share one colour.
  const themeVersion = useChartThemeRefresh();
  const seriesColor = platformChartColor(0);

  const bars = useMemo(() => {
    // Emphasis on the busiest day, so the strip is not thirty equal bars.
    const opacity = days.map((day) => (day.date === peakDate ? 1 : QUIET_BAR_OPACITY));
    const dates = days.map((day) => day.date);
    const measurements = days.map((day) => day.measurements);

    // A zero day draws no bar, so every day gets a faint slot behind the data and
    // a sparse window reads as quiet rather than as empty.
    const trackHeight = Math.max(...measurements, 0) || 1;

    return [
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
    ];
    // eslint-disable-next-line react-hooks/exhaustive-deps -- themeVersion is a cache key.
  }, [days, peakDate, seriesName, seriesColor, themeVersion]);

  const line = useMemo(() => {
    const areaColor = /^#[0-9a-f]{6}$/i.test(seriesColor)
      ? `${seriesColor}${AREA_ALPHA}`
      : undefined;

    return [
      {
        x: days.map((day) => day.date),
        y: days.map((day) => day.measurements),
        name: seriesName,
        color: seriesColor,
        line: { width: 1.5 },
        fill: "tozeroy" as const,
        fillcolor: areaColor,
      },
    ];
    // eslint-disable-next-line react-hooks/exhaustive-deps -- themeVersion is a cache key.
  }, [days, seriesName, seriesColor, themeVersion]);

  const renderBars = () => (
    <BarChart barmode="overlay" data={bars} config={config} className="h-10 w-full" />
  );

  const renderLine = () => <LineChart data={line} config={config} className="h-10 w-full" />;

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
      <CardContent>{mark === "line" ? renderLine() : renderBars()}</CardContent>
      {footer === undefined ? null : (
        <CardFooter className="text-muted-foreground mt-auto text-xs">{footer}</CardFooter>
      )}
    </Card>
  );
}
