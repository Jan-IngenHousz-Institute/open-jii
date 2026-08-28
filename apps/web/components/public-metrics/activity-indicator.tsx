"use client";

import { useEffect, useState } from "react";

import { useTranslation } from "@repo/i18n";

interface ActivityIndicatorProps {
  measurements24h: number;
  lastMeasurementAt: string | null;
  locale: string;
}

/** Warehouse timestamps are UTC text, with or without an explicit zone. */
const HAS_TIMEZONE = /(?:Z|[+-]\d{2}:?\d{2})$/;

export function parseWarehouseTimestamp(value: string): Date | null {
  const normalized = HAS_TIMEZONE.test(value) ? value : `${value.replace(" ", "T")}Z`;
  const parsed = new Date(normalized);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

/**
 * Liveness as a number that moves: the rolling 24h count. The recency claim
 * only appears when there is silence to report; a permanently-true "active
 * recently" badge carries no information.
 */
export function ActivityIndicator({
  measurements24h,
  lastMeasurementAt,
  locale,
}: ActivityIndicatorProps) {
  const { t } = useTranslation("publicMetrics");

  // Rendered after mount: the quiet-state copy depends on the wall clock and
  // would otherwise mismatch between server and client render.
  const [quietSince, setQuietSince] = useState<string | null>(null);

  useEffect(() => {
    if (measurements24h > 0 || lastMeasurementAt === null) {
      return;
    }
    const parsed = parseWarehouseTimestamp(lastMeasurementAt);
    if (parsed !== null) {
      setQuietSince(new Intl.DateTimeFormat(locale, { dateStyle: "medium" }).format(parsed));
    }
  }, [measurements24h, lastMeasurementAt, locale]);

  if (measurements24h === 0 && quietSince === null) {
    return null;
  }

  const label =
    measurements24h > 0
      ? t("indicator.active", { count: new Intl.NumberFormat(locale).format(measurements24h) })
      : t("indicator.quiet", { date: quietSince });

  return (
    <span className="bg-secondary text-secondary-foreground inline-flex items-center gap-2 rounded-full px-3 py-1 text-sm">
      <span className="bg-status-active-foreground inline-block h-2 w-2 rounded-full motion-safe:animate-pulse" />
      {label}
    </span>
  );
}
