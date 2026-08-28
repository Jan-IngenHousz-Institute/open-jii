"use client";

import type { MetricsHourlyBin } from "@repo/api/domains/metrics/metrics.schema";
import { useTranslation } from "@repo/i18n";

interface SunClockProps {
  hourly: MetricsHourlyBin[];
}

const SIZE = 300;
const CENTER = SIZE / 2;
const INNER_RADIUS = SIZE * 0.19;
const OUTER_RADIUS = SIZE * 0.44;
const HOUR_GAP_RADIANS = 0.012;

function polar(radius: number, angle: number): [number, number] {
  return [CENTER + radius * Math.cos(angle), CENTER + radius * Math.sin(angle)];
}

function segmentPath(hour: number, fraction: number): string {
  const startAngle = (hour / 24) * Math.PI * 2 - Math.PI / 2 + HOUR_GAP_RADIANS;
  const endAngle = ((hour + 1) / 24) * Math.PI * 2 - Math.PI / 2 - HOUR_GAP_RADIANS;
  const radius = INNER_RADIUS + (OUTER_RADIUS - INNER_RADIUS) * fraction;

  const [x0, y0] = polar(INNER_RADIUS, startAngle);
  const [x1, y1] = polar(INNER_RADIUS, endAngle);
  const [x2, y2] = polar(radius, endAngle);
  const [x3, y3] = polar(radius, startAngle);

  return [
    `M${x0.toFixed(1)} ${y0.toFixed(1)}`,
    `L${x3.toFixed(1)} ${y3.toFixed(1)}`,
    `A${radius.toFixed(1)} ${radius.toFixed(1)} 0 0 1 ${x2.toFixed(1)} ${y2.toFixed(1)}`,
    `L${x1.toFixed(1)} ${y1.toFixed(1)}`,
    `A${INNER_RADIUS} ${INNER_RADIUS} 0 0 0 ${x0.toFixed(1)} ${y0.toFixed(1)}`,
    "Z",
  ].join(" ");
}

/** Radial 24-hour profile: field measurement follows daylight. */
export function SunClock({ hourly }: SunClockProps) {
  const { t } = useTranslation("publicMetrics");

  const max = Math.max(...hourly.map((bin) => bin.measurements), 1);

  const renderSegment = (bin: MetricsHourlyBin) => (
    <path
      key={bin.hourLocal}
      d={segmentPath(bin.hourLocal, bin.measurements / max)}
      className="fill-primary"
      opacity={0.25 + 0.75 * (bin.measurements / max)}
    />
  );

  const renderHourLabel = (hour: number) => {
    const angle = (hour / 24) * Math.PI * 2 - Math.PI / 2;
    const [x, y] = polar(OUTER_RADIUS + 15, angle);
    return (
      <text
        key={hour}
        x={x.toFixed(1)}
        y={(y + 3).toFixed(1)}
        textAnchor="middle"
        className="fill-muted-foreground text-[9px]"
      >
        {String(hour).padStart(2, "0")}
      </text>
    );
  };

  return (
    <figure className="flex flex-col items-center gap-2">
      <svg
        viewBox={`0 0 ${SIZE} ${SIZE}`}
        role="img"
        aria-label={t("sunClock.aria")}
        className="w-full max-w-[240px]"
      >
        <circle cx={CENTER} cy={CENTER} r={OUTER_RADIUS} fill="none" className="stroke-border" />
        <circle cx={CENTER} cy={CENTER} r={INNER_RADIUS} fill="none" className="stroke-border" />
        {hourly.map(renderSegment)}
        {[0, 6, 12, 18].map(renderHourLabel)}
      </svg>
      <figcaption className="text-muted-foreground text-xs">{t("sunClock.caption")}</figcaption>
    </figure>
  );
}
