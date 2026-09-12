"use client";

import { MetricStatCard } from "@/components/metrics/metric-stat-card";
import { MetricTrendCard } from "@/components/metrics/metric-trend-card";
import { metricsBandGrid, metricsBandTrendSpan } from "@/components/metrics/metrics-band-grid";
import { MetricsBandSkeleton } from "@/components/metrics/metrics-band-skeleton";
import { useMyScopedMetrics } from "@/hooks/metrics/useMyScopedMetrics/useMyScopedMetrics";
import { usePublicMetrics } from "@/hooks/metrics/usePublicMetrics/usePublicMetrics";

import { useTranslation } from "@repo/i18n";

interface ResearchActivityPanelProps {
  locale: string;
}

/** The reader's own 30 days, with the community beside it rather than as the headline. */
export function ResearchActivityPanel({ locale }: ResearchActivityPanelProps) {
  const { t } = useTranslation("publicMetrics");
  const { data: mine, isPending } = useMyScopedMetrics();
  const { data: platform } = usePublicMetrics();

  if (isPending) {
    return <MetricsBandSkeleton cards={4} grid={metricsBandGrid} />;
  }

  const scoped = mine?.scoped ?? null;

  // No band rather than a row of zeros, as on the list pages.
  if (scoped === null || scoped.measurements30d === 0) {
    return null;
  }

  const number = new Intl.NumberFormat(locale);
  const compact = new Intl.NumberFormat(locale, { notation: "compact", maximumFractionDigits: 1 });
  // Warehouse days are UTC.
  const day = new Intl.DateTimeFormat(locale, { day: "numeric", month: "short", timeZone: "UTC" });

  const windowDays = scoped.activity.length;
  const window = t("window", { days: windowDays });
  const community = platform?.community ?? null;

  const peak = scoped.peak;

  const renderCommunity = (measurements30d: number) => (
    <MetricStatCard
      locale={locale}
      label={t("dashboard.activity.communityLabel")}
      value={compact.format(measurements30d)}
      title={number.format(measurements30d)}
      note={t("dashboard.activity.communityNote")}
      context={window}
    />
  );

  return (
    <section className={metricsBandGrid}>
      <MetricStatCard
        locale={locale}
        label={t("dashboard.activity.label")}
        value={compact.format(scoped.measurements30d)}
        title={number.format(scoped.measurements30d)}
        comparison={{ current: scoped.measurements30d, previous: scoped.previousMeasurements }}
        note={t("previousWindow", {
          value: compact.format(scoped.previousMeasurements),
          days: windowDays,
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
        label={t("dashboard.activity.experimentsLabel")}
        value={number.format(scoped.activeExperiments30d)}
        note={t("dashboard.activity.contributors", { count: scoped.contributors30d })}
        context={
          scoped.devices30d === null
            ? window
            : t("dashboard.activity.devices", { count: scoped.devices30d })
        }
      />
      {community === null ? null : renderCommunity(community.measurements30d)}
      <MetricTrendCard
        label={t("dailyAverage")}
        value={compact.format(Math.round(scoped.measurements30d / windowDays))}
        title={number.format(Math.round(scoped.measurements30d / windowDays))}
        seriesName={t("dashboard.activity.trend")}
        days={scoped.activity}
        peakDate={peak?.date ?? null}
        locale={locale}
        footer={t("activeDays", { active: scoped.activeDays, total: windowDays })}
        className={metricsBandTrendSpan}
      />
    </section>
  );
}
