"use client";

import { useEffect, useState } from "react";

import { useTranslation } from "@repo/i18n";

interface LivenessChipProps {
  lastMeasurementAt: string;
  locale: string;
}

const HAS_TIMEZONE = /(?:Z|[+-]\d{2}:?\d{2})$/;

/**
 * Warehouse timestamps are UTC and usually arrive as "YYYY-MM-DD HH:mm:ss".
 * `new Date` reads that shape as local time, which would shift the result by
 * the viewer's offset, so an explicit zone is added when none is present.
 */
export function parseWarehouseTimestamp(value: string): Date | null {
  const normalized = HAS_TIMEZONE.test(value) ? value : `${value.replace(" ", "T")}Z`;
  const parsed = new Date(normalized);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function formatTimeAgo(from: Date, locale: string): string {
  const formatter = new Intl.RelativeTimeFormat(locale, { numeric: "auto" });
  const elapsedMinutes = Math.round((from.getTime() - Date.now()) / 60_000);

  if (elapsedMinutes > -60) {
    return formatter.format(elapsedMinutes, "minute");
  }
  if (elapsedMinutes > -24 * 60) {
    return formatter.format(Math.round(elapsedMinutes / 60), "hour");
  }
  return formatter.format(Math.round(elapsedMinutes / (24 * 60)), "day");
}

export function LivenessChip({ lastMeasurementAt, locale }: LivenessChipProps) {
  const { t } = useTranslation("publicMetrics");

  // Rendered only after mount: the relative time depends on the wall clock and
  // would otherwise mismatch between server and client render.
  const [timeAgo, setTimeAgo] = useState<string | null>(null);

  useEffect(() => {
    const parsed = parseWarehouseTimestamp(lastMeasurementAt);
    if (parsed !== null) {
      setTimeAgo(formatTimeAgo(parsed, locale));
    }
  }, [lastMeasurementAt, locale]);

  if (timeAgo === null) {
    return null;
  }

  return (
    <span className="bg-secondary text-secondary-foreground inline-flex items-center gap-2 rounded-full px-3 py-1 text-sm">
      <span className="bg-tertiary inline-block h-2 w-2 rounded-full motion-safe:animate-pulse" />
      {t("lastMeasurement", { timeAgo })}
    </span>
  );
}
