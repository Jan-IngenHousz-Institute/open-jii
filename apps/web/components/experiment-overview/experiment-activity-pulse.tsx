"use client";

import { MetricStatCard } from "~/components/metrics/metric-stat-card";
import { MetricTrendCard } from "~/components/metrics/metric-trend-card";
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
  const { data } = useExperimentMetrics(experimentId);

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

  // Device-published rows carry no contributor, so the card states the days it
  // collected on rather than reporting that nobody took the measurements.
  const hasContributors = scoped.contributors30d > 0;

  const renderContributors = () => (
    <MetricStatCard
      locale={locale}
      label={t("experiment.contributors")}
      value={number.format(scoped.contributors30d)}
      note={t("experiment.contributorsNote", { count: scoped.contributors30d })}
      context={window}
    />
  );

  const renderDays = () => (
    <MetricStatCard
      locale={locale}
      label={t("experiment.collectionDays")}
      value={t("experiment.daysOf", { active: scoped.activeDays, total: windowDays })}
      note={
        scoped.lastActivityDate === null
          ? undefined
          : t("experiment.lastRecorded", {
              date: day.format(new Date(`${scoped.lastActivityDate}T00:00:00Z`)),
            })
      }
      context={window}
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
              : t(change >= 0 ? "trendUp" : "trendDown", { days: windowDays })
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
        {hasContributors ? renderContributors() : renderDays()}
        <MetricTrendCard
          label={window}
          seriesName={t("experiment.trend")}
          days={scoped.activity}
          locale={locale}
          footer={t("activeDays", { active: scoped.activeDays, total: windowDays })}
          className="sm:col-span-2 lg:col-span-1"
        />
      </div>
    </section>
  );
}
