"use client";

import { useResourceMetrics } from "~/hooks/metrics/useResourceMetrics/useResourceMetrics";
import { useLocale } from "~/hooks/useLocale";

import type { ResourceKind } from "@repo/api/domains/metrics/metrics.schema";
import { useTranslation } from "@repo/i18n";

import { MetricStatCard } from "./metric-stat-card";
import { MetricTrendCard } from "./metric-trend-card";
import { MetricsBandSkeleton } from "./metrics-band-skeleton";

/** Where a kind's detail pages live, for the busiest card's link. */
const RESOURCE_SECTIONS: Record<ResourceKind, string> = {
  experiment: "experiments",
  protocol: "protocols",
  macro: "macros",
  workbook: "workbooks",
};

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
  const { data, isPending } = useResourceMetrics(kind);

  if (isPending) {
    return <MetricsBandSkeleton cards={4} className="sm:grid-cols-2 xl:grid-cols-4" />;
  }

  // A workspace with nothing recorded states nothing, rather than a row of zeros.
  if (data === undefined || data.activeCount === 0) {
    return null;
  }

  const number = new Intl.NumberFormat(locale);
  const compact = new Intl.NumberFormat(locale, { notation: "compact", maximumFractionDigits: 1 });
  // The warehouse groups by UTC day, so the label has to read it back as one.
  const day = new Intl.DateTimeFormat(locale, { day: "numeric", month: "short", timeZone: "UTC" });

  const window = t("window", { days: data.windowDays });
  const peak = data.peak;
  const busiest = data.busiest;

  const renderBusiest = (id: string, name: string, measurements: number) => (
    <MetricStatCard
      locale={locale}
      label={t(`resourceMetrics.${kind}.busiest`)}
      value={name}
      title={name}
      href={`/${locale}/platform/${RESOURCE_SECTIONS[kind]}/${id}`}
      note={t("resourceMetrics.busiestNote", {
        value: compact.format(measurements),
        total: compact.format(data.totalMeasurements),
      })}
      context={window}
    />
  );

  return (
    <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
      <MetricStatCard
        locale={locale}
        label={t(`resourceMetrics.${kind}.measurements`)}
        value={compact.format(data.totalMeasurements)}
        title={number.format(data.totalMeasurements)}
        comparison={{ current: data.totalMeasurements, previous: data.previousMeasurements }}
        note={t("previousWindow", {
          value: compact.format(data.previousMeasurements),
          days: data.windowDays,
        })}
        context={
          peak === null
            ? window
            : t("peak", {
                value: compact.format(peak.measurements),
                date: day.format(new Date(`${peak.date}T00:00:00Z`)),
              })
        }
      />
      <MetricStatCard
        locale={locale}
        label={t(`resourceMetrics.${kind}.active`)}
        value={number.format(data.activeCount)}
        note={t("resourceMetrics.ofVisible", { count: data.visibleCount })}
        context={window}
      />
      {busiest === null ? null : renderBusiest(busiest.id, busiest.name, busiest.measurements)}
      <MetricTrendCard
        label={t("dailyAverage")}
        value={compact.format(Math.round(data.totalMeasurements / data.windowDays))}
        title={number.format(Math.round(data.totalMeasurements / data.windowDays))}
        seriesName={t("resourceMetrics.series")}
        days={data.days}
        peakDate={peak?.date ?? null}
        locale={locale}
        footer={t("activeDays", { active: data.activeDays, total: data.windowDays })}
        className={busiest === null ? "sm:col-span-2" : "sm:col-span-2 xl:col-span-1"}
      />
    </section>
  );
}
