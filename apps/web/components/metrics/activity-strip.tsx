"use client";

import { useMemo } from "react";

import { cn } from "@repo/ui/lib/utils";

const WIDTH = 200;
const HEIGHT = 34;
const PADDING = 3;

export interface ActivityDay {
  date: string;
  measurements: number;
}

interface ActivityStripProps {
  days: ActivityDay[];
  /** Describes the line for readers who cannot see it. */
  label: string;
  className?: string;
}

/** A measurement sparkline. Plain SVG: a plot library at row height draws axes nobody reads. */
export function ActivityStrip({ days, label, className }: ActivityStripProps) {
  const path = useMemo(() => {
    if (days.length < 2) {
      return "";
    }

    const counts = days.map((day) => day.measurements);
    const peak = Math.max(...counts);
    const trough = Math.min(...counts);
    // A flat series would divide by zero; draw it along the baseline instead.
    const span = peak - trough || 1;

    const points = counts.map((count, index) => {
      const x = PADDING + (index / (counts.length - 1)) * (WIDTH - 2 * PADDING);
      const y = HEIGHT - PADDING - ((count - trough) / span) * (HEIGHT - 2 * PADDING);
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    });

    return `M ${points.join(" L ")}`;
  }, [days]);

  if (path === "") {
    return null;
  }

  return (
    <svg
      viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
      preserveAspectRatio="none"
      role="img"
      aria-label={label}
      className={cn("h-8 w-full", className)}
    >
      <path
        d={path}
        fill="none"
        className="stroke-chart-1"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        vectorEffect="non-scaling-stroke"
      />
    </svg>
  );
}
