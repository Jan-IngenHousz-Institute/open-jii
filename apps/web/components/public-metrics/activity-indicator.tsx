"use client";

import { useIsHydrated } from "@/hooks/useIsHydrated";
import { formatLocaleNumber } from "@/util/format-locale-number";

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

/** The rolling 24h count. The recency line appears only when there is silence to report. */
export function ActivityIndicator({
  measurements24h,
  lastMeasurementAt,
  locale,
}: ActivityIndicatorProps) {
  const { t } = useTranslation("publicMetrics");

  // Rendered after hydration: the quiet-state copy depends on the wall clock and
  // would otherwise mismatch between server and client render.
  const isHydrated = useIsHydrated();
  const lastMeasurement =
    !isHydrated || measurements24h > 0 || lastMeasurementAt === null
      ? null
      : parseWarehouseTimestamp(lastMeasurementAt);
  const quietSince =
    lastMeasurement === null
      ? null
      : new Intl.DateTimeFormat(locale, { dateStyle: "medium" }).format(lastMeasurement);

  if (measurements24h === 0 && quietSince === null) {
    return null;
  }

  const label =
    measurements24h > 0
      ? t("indicator.active", { count: formatLocaleNumber(measurements24h, locale) })
      : t("indicator.quiet", { date: quietSince });

  return (
    <span className="bg-secondary text-secondary-foreground inline-flex items-center gap-2 rounded-full px-3 py-1 text-sm">
      <span className="bg-status-active-foreground inline-block h-2 w-2 rounded-full motion-safe:animate-pulse" />
      {label}
    </span>
  );
}
