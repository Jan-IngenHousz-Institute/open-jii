"use client";

import { useResourceMetrics } from "~/hooks/metrics/useResourceMetrics/useResourceMetrics";
import { useLocale } from "~/hooks/useLocale";

import type { ResourceKind } from "@repo/api/domains/metrics/metrics.schema";
import { useTranslation } from "@repo/i18n";

import { MetricStatCard } from "./metric-stat-card";
import { MetricTrendCard } from "./metric-trend-card";

interface ResourceMetricsSummaryProps {
  kind: ResourceKind;
}

/**
 * The activity behind a list page, above its table. Counts only what the
 * reader may see, so the figures agree with the rows underneath.
 */
export function ResourceMetricsSummary({ kind }: ResourceMetricsSummaryProps) {
  const { t } = useTranslation("publicMetrics");
  const locale = useLocale();
  const { data } = useResourceMetrics(kind);

  if (data === undefined || data.activeCount === 0) {
    return null;
  }

  const number = new Intl.NumberFormat(locale);
  const compact = new Intl.NumberFormat(locale, { notation: "compact", maximumFractionDigits: 1 });
  // The warehouse groups by UTC day, so the label has to read it back as one.
  const day = new Intl.DateTimeFormat(locale, { day: "numeric", month: "short", timeZone: "UTC" });

  // A percentage against nothing is not a comparison, so a first window shows none.
  const change =
    data.previousMeasurements > 0
      ? (data.totalMeasurements - data.previousMeasurements) / data.previousMeasurements
      : null;

  const peak = data.peak;
  const measurementsFooter =
    peak === null
      ? t("resourceMetrics.window", { days: data.windowDays })
      : t("resourceMetrics.peak", {
          value: compact.format(peak.measurements),
          date: day.format(new Date(`${peak.date}T00:00:00Z`)),
        });

  return (
    <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      <MetricStatCard
        locale={locale}
        label={t(`resourceMetrics.${kind}.measurements`)}
        value={compact.format(data.totalMeasurements)}
        title={number.format(data.totalMeasurements)}
        change={change}
        footer={measurementsFooter}
      />
      <MetricStatCard
        locale={locale}
        label={t(`resourceMetrics.${kind}.active`)}
        value={number.format(data.activeCount)}
        footer={t("resourceMetrics.ofVisible", { count: data.visibleCount })}
      />
      <MetricTrendCard
        label={t("resourceMetrics.trend", { days: data.windowDays })}
        seriesName={t("resourceMetrics.series")}
        days={data.days}
        locale={locale}
        footer={t("resourceMetrics.activeDays", {
          active: data.activeDays,
          total: data.windowDays,
        })}
        className="sm:col-span-2 lg:col-span-1"
      />
    </section>
  );
}
