"use client";

import { MetricStatCard } from "~/components/metrics/metric-stat-card";
import { MetricTrendCard } from "~/components/metrics/metric-trend-card";
import { MetricsBandSkeleton } from "~/components/metrics/metrics-band-skeleton";
import { useExperimentMetrics } from "~/hooks/metrics/useExperimentMetrics/useExperimentMetrics";
import { useLocale } from "~/hooks/useLocale";

import { useTranslation } from "@repo/i18n";

interface ExperimentActivityPulseProps {
  experimentId: string;
}

/**
 * Whether this experiment is still collecting, answered where the question is
 * asked. A silent experiment says so rather than disappearing: on this page the
 * absence of a reading is itself the answer.
 */
export function ExperimentActivityPulse({ experimentId }: ExperimentActivityPulseProps) {
  const { t } = useTranslation("publicMetrics");
  const locale = useLocale();
  const { data, isPending } = useExperimentMetrics(experimentId);

  if (isPending) {
    return (
      <section className="space-y-3">
        <h2 className="font-bold">{t("experiment.title")}</h2>
        <MetricsBandSkeleton cards={3} className="sm:grid-cols-2 lg:grid-cols-3" />
      </section>
    );
  }

  const scoped = data?.scoped ?? null;
  if (scoped === null) {
    return null;
  }

  const number = new Intl.NumberFormat(locale);
  const compact = new Intl.NumberFormat(locale, { notation: "compact", maximumFractionDigits: 1 });
  // The warehouse groups by UTC day, so the label has to read it back as one.
  const day = new Intl.DateTimeFormat(locale, { day: "numeric", month: "short", timeZone: "UTC" });

  const windowDays = scoped.activity.length;
  const window = t("window", { days: windowDays });
  const isCollecting = scoped.measurements30d > 0;

  // A percentage against nothing is not a comparison, so a first window shows none.
  const change =
    scoped.previousMeasurements > 0
      ? (scoped.measurements30d - scoped.previousMeasurements) / scoped.previousMeasurements
      : null;

  const peak = scoped.peak;

  // Device-published rows carry no contributor. The slot is dropped rather
  // than filled with a recency claim: the figures lag the pipeline by up to a
  // refresh, which a reader who just took a measurement would catch.
  const hasContributors = scoped.contributors30d > 0;

  const renderContributors = () => (
    <MetricStatCard
      locale={locale}
      label={t("experiment.contributors")}
      value={number.format(scoped.contributors30d)}
      note={t("experiment.contributorsNote", { count: scoped.contributors30d })}
    />
  );

  if (!isCollecting) {
    return (
      <section className="space-y-3">
        <h2 className="font-bold">{t("experiment.title")}</h2>
        <p className="text-muted-foreground text-sm">{t("experiment.quiet")}</p>
      </section>
    );
  }

  return (
    <section className="space-y-3">
      <h2 className="font-bold">{t("experiment.title")}</h2>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <MetricStatCard
          locale={locale}
          label={t("experiment.measurements")}
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
        {hasContributors ? renderContributors() : null}
        <MetricTrendCard
          label={t("dailyAverage")}
          value={compact.format(Math.round(scoped.measurements30d / windowDays))}
          title={number.format(Math.round(scoped.measurements30d / windowDays))}
          seriesName={t("experiment.trend")}
          days={scoped.activity}
          peakDate={peak?.date ?? null}
          locale={locale}
          footer={t("activeDays", { active: scoped.activeDays, total: windowDays })}
          className={hasContributors ? "sm:col-span-2 lg:col-span-1" : "sm:col-span-2"}
        />
      </div>
    </section>
  );
}
