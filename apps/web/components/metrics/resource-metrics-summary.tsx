"use client";

import { useResourceMetrics } from "~/hooks/metrics/useResourceMetrics/useResourceMetrics";
import { useLocale } from "~/hooks/useLocale";

import type { ResourceKind } from "@repo/api/domains/metrics/metrics.schema";
import { useTranslation } from "@repo/i18n";

import { MetricStatCard } from "./metric-stat-card";
import { MetricTrendCard } from "./metric-trend-card";
import {
  metricsBandGrid,
  metricsBandTrendSpan,
  metricsBandTrendSpanWide,
} from "./metrics-band-grid";
import { MetricsBandSkeleton } from "./metrics-band-skeleton";

const RESOURCE_SECTIONS: Record<ResourceKind, string> = {
  experiment: "experiments",
  protocol: "protocols",
  macro: "macros",
  workbook: "workbooks",
};

interface ResourceMetricsSummaryProps {
  kind: ResourceKind;
}

/** The activity behind a list page. Counts only what the reader may see. */
export function ResourceMetricsSummary({ kind }: ResourceMetricsSummaryProps) {
  const { t } = useTranslation("publicMetrics");
  const locale = useLocale();
  const { data, isPending } = useResourceMetrics(kind);

  if (isPending) {
    return <MetricsBandSkeleton cards={4} grid={metricsBandGrid} />;
  }

  // A workspace with nothing recorded states nothing, rather than a row of zeros.
  if (data === undefined || data.activeCount === 0) {
    return null;
  }

  const number = new Intl.NumberFormat(locale);
  const compact = new Intl.NumberFormat(locale, { notation: "compact", maximumFractionDigits: 1 });
  // Warehouse days are UTC.
  const day = new Intl.DateTimeFormat(locale, { day: "numeric", month: "short", timeZone: "UTC" });

  const window = t("window", { days: data.windowDays });
  // A macro run is an analysis, not a measurement.
  const unit = t(`resourceMetrics.${kind}.unit`);
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
        unit,
      })}
      context={window}
    />
  );

  return (
    <section className={metricsBandGrid}>
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
        seriesName={t("resourceMetrics.series", { unit })}
        days={data.days}
        peakDate={peak?.date ?? null}
        locale={locale}
        footer={t("activeDays", { active: data.activeDays, total: data.windowDays })}
        className={busiest === null ? metricsBandTrendSpanWide : metricsBandTrendSpan}
      />
    </section>
  );
}
