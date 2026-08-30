"use client";

import { cn } from "@repo/ui/lib/utils";

const CELL = 3;
const GAP = 1;
const HEIGHT = 14;
/** Four bands read as "none, some, more, most" without implying a scale. */
const BANDS = 4;

export interface ActivityDay {
  date: string;
  measurements: number;
}

interface ActivityStripProps {
  days: ActivityDay[];
  /** Describes the strip for readers who cannot see it. */
  label: string;
  className?: string;
}

/**
 * A day-per-cell activity strip, the shape a repository timeline uses: the
 * pattern of activity is the message, not the values. Plain SVG so it stays
 * legible at row height, where a plot library renders axes nobody can read.
 */
export function ActivityStrip({ days, label, className }: ActivityStripProps) {
  if (days.length === 0) {
    return null;
  }

  const peak = Math.max(...days.map((day) => day.measurements));
  const width = days.length * (CELL + GAP) - GAP;

  const bandOf = (measurements: number) => {
    if (measurements === 0 || peak === 0) {
      return 0;
    }
    // Ceil keeps any activity at band 1 or above, so a quiet day still shows.
    return Math.ceil((measurements / peak) * BANDS);
  };

  const renderDay = (day: ActivityDay, index: number) => {
    const band = bandOf(day.measurements);

    return (
      <rect
        key={day.date}
        x={index * (CELL + GAP)}
        y={0}
        width={CELL}
        height={HEIGHT}
        rx={1}
        className={band === 0 ? "fill-muted" : "fill-primary"}
        opacity={band === 0 ? 1 : 0.25 * band}
      />
    );
  };

  return (
    <svg
      viewBox={`0 0 ${width} ${HEIGHT}`}
      width={width}
      height={HEIGHT}
      role="img"
      aria-label={label}
      className={cn("shrink-0", className)}
    >
      {days.map(renderDay)}
    </svg>
  );
}
