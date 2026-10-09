"use client";

import type { MetricsWindowDay } from "@repo/api/domains/metrics/metrics.schema";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@repo/ui/components/tooltip";
import { cn } from "@repo/ui/lib/utils";

// The drawing is in these units and stretched to the box; strokes keep their width.
const WIDTH = 100;
const HEIGHT = 40;
const BAR_GAP = 0.15;
const QUIET_BAR_OPACITY = 0.45;
const TRACK_OPACITY = 0.08;
const AREA_OPACITY = 0.12;

interface TrendSparklineProps {
  days: MetricsWindowDay[];
  mark: "bars" | "line";
  peakDate: string | null;
  seriesName: string;
  locale: string;
  className?: string;
}

/**
 * A window of daily totals as bars or a filled line. Plain SVG like the table's activity strip:
 * loading a plot library for a card this size held the cards back on slow connections. Hovering a
 * day shows its date and total.
 */
export function TrendSparkline({
  days,
  mark,
  peakDate,
  seriesName,
  locale,
  className,
}: TrendSparklineProps) {
  const highest = Math.max(...days.map((day) => day.measurements), 0) || 1;
  const slot = WIDTH / (days.length || 1);
  // A line's points run edge to edge, so its hover targets are centred on them.
  const step = WIDTH / (days.length - 1 || 1);
  const isLine = mark === "line";
  const heightOf = (value: number) => (value / highest) * HEIGHT;
  const dateFormat = new Intl.DateTimeFormat(locale, { dateStyle: "medium", timeZone: "UTC" });
  const numberFormat = new Intl.NumberFormat(locale);

  function renderBar(day: MetricsWindowDay, index: number) {
    const barHeight = heightOf(day.measurements);

    return (
      <g key={day.date}>
        <rect
          x={index * slot}
          y={0}
          width={slot * (1 - BAR_GAP)}
          height={HEIGHT}
          className="fill-chart-1"
          opacity={TRACK_OPACITY}
        />
        <rect
          x={index * slot}
          y={HEIGHT - barHeight}
          width={slot * (1 - BAR_GAP)}
          height={barHeight}
          className="fill-chart-1"
          opacity={day.date === peakDate ? 1 : QUIET_BAR_OPACITY}
        />
      </g>
    );
  }

  function renderLine() {
    const points = days.map(
      (day, index) => `${index * step},${HEIGHT - heightOf(day.measurements)}`,
    );
    const line = `M ${points.join(" L ")}`;

    return (
      <>
        <path
          d={`${line} L ${WIDTH},${HEIGHT} L 0,${HEIGHT} Z`}
          className="fill-chart-1"
          opacity={AREA_OPACITY}
        />
        <path
          d={line}
          fill="none"
          className="stroke-chart-1"
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
          vectorEffect="non-scaling-stroke"
        />
      </>
    );
  }

  function renderHoverTarget(day: MetricsWindowDay, index: number) {
    return (
      <Tooltip key={day.date}>
        <TooltipTrigger asChild>
          <rect
            x={isLine ? index * step - step / 2 : index * slot}
            y={0}
            width={isLine ? step : slot}
            height={HEIGHT}
            fill="transparent"
          />
        </TooltipTrigger>
        <TooltipContent>
          {dateFormat.format(new Date(day.date))}: {numberFormat.format(day.measurements)}
        </TooltipContent>
      </Tooltip>
    );
  }

  return (
    <TooltipProvider delayDuration={0}>
      <svg
        viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
        preserveAspectRatio="none"
        role="img"
        aria-label={seriesName}
        className={cn("block overflow-visible", className)}
      >
        {isLine ? renderLine() : days.map(renderBar)}
        {days.map(renderHoverTarget)}
      </svg>
    </TooltipProvider>
  );
}
