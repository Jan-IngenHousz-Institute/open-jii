"use client";

import { MetricStatCard } from "@/components/metrics/metric-stat-card";
import { MetricTrendCard } from "@/components/metrics/metric-trend-card";
import { useMyScopedMetrics } from "@/hooks/metrics/useMyScopedMetrics/useMyScopedMetrics";
import { usePublicMetrics } from "@/hooks/metrics/usePublicMetrics/usePublicMetrics";

import { useTranslation } from "@repo/i18n";

interface ResearchActivityPanelProps {
  locale: string;
}

/**
 * The reader's own 30 days, with the community beside it as context rather
 * than as the headline. A trend beats a counter: the shape is what says
 * whether the work is moving.
 */
export function ResearchActivityPanel({ locale }: ResearchActivityPanelProps) {
  const { t } = useTranslation("publicMetrics");
  const { data: mine } = useMyScopedMetrics();
  const { data: platform } = usePublicMetrics();

  const scoped = mine?.scoped ?? null;
  if (scoped === null) {
    return null;
  }

  const number = new Intl.NumberFormat(locale);
  const compact = new Intl.NumberFormat(locale, { notation: "compact", maximumFractionDigits: 1 });
  // The warehouse groups by UTC day, so the label has to read it back as one.
  const day = new Intl.DateTimeFormat(locale, { day: "numeric", month: "short", timeZone: "UTC" });

  const windowDays = scoped.activity.length;
  const window = t("window", { days: windowDays });
  const community = platform?.community ?? null;

  // A percentage against nothing is not a comparison, so a first window shows none.
  const change =
    scoped.previousMeasurements > 0
      ? (scoped.measurements30d - scoped.previousMeasurements) / scoped.previousMeasurements
      : null;

  const peak = scoped.peak;

  const renderCommunity = (measurements30d: number) => (
    <MetricStatCard
      locale={locale}
      label={t("dashboard.activity.communityLabel")}
      value={compact.format(measurements30d)}
      title={number.format(measurements30d)}
      note={window}
    />
  );

  return (
    <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
      <MetricStatCard
        locale={locale}
        label={t("dashboard.activity.label")}
        value={compact.format(scoped.measurements30d)}
        title={number.format(scoped.measurements30d)}
        change={change}
        note={
          change === null
            ? undefined
            : t("previousWindow", {
                value: compact.format(scoped.previousMeasurements),
                days: windowDays,
              })
        }
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
      />
      {community === null ? null : renderCommunity(community.measurements30d)}
      <MetricTrendCard
        label={window}
        seriesName={t("dashboard.activity.trend")}
        days={scoped.activity}
        locale={locale}
        footer={t("activeDays", { active: scoped.activeDays, total: windowDays })}
        className="sm:col-span-2 xl:col-span-1"
      />
    </section>
  );
}
