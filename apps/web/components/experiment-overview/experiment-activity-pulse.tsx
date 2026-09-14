"use client";

import { MetricStatCard } from "~/components/metrics/metric-stat-card";
import { MetricTrendCard } from "~/components/metrics/metric-trend-card";
import {
  metricsBandGridOfThree,
  metricsBandTrendSpanOfThree,
  metricsBandTrendSpanWide,
} from "~/components/metrics/metrics-band-grid";
import { MetricsBandSkeleton } from "~/components/metrics/metrics-band-skeleton";
import { useExperimentMetrics } from "~/hooks/metrics/useExperimentMetrics/useExperimentMetrics";
import { useLocale } from "~/hooks/useLocale";

import { useTranslation } from "@repo/i18n";

interface ExperimentActivityPulseProps {
  experimentId: string;
}

/** Whether this experiment is still collecting. A silent one says so rather than vanishing. */
export function ExperimentActivityPulse({ experimentId }: ExperimentActivityPulseProps) {
  const { t } = useTranslation("publicMetrics");
  const locale = useLocale();
  const { data, isPending } = useExperimentMetrics(experimentId);

  if (isPending) {
    return (
      <section className="space-y-3">
        <h2 className="font-bold">{t("experiment.title")}</h2>
        <MetricsBandSkeleton cards={3} grid={metricsBandGridOfThree} />
      </section>
    );
  }

  const scoped = data?.scoped ?? null;
  if (scoped === null) {
    return null;
  }

  const number = new Intl.NumberFormat(locale);
  const compact = new Intl.NumberFormat(locale, { notation: "compact", maximumFractionDigits: 1 });
  // Warehouse days are UTC.
  const day = new Intl.DateTimeFormat(locale, { day: "numeric", month: "short", timeZone: "UTC" });

  const windowDays = scoped.activity.length;
  const window = t("window", { days: windowDays });
  const isCollecting = scoped.measurements30d > 0;

  const peak = scoped.peak;

  // Device-published rows carry no contributor, so the slot names the devices
  // that did the recording rather than crediting nobody.
  const hasContributors = scoped.contributors30d > 0;
  const devices = scoped.devices30d;
  const hasDevices = devices !== null && devices > 0;

  const renderContributors = () => (
    <MetricStatCard
      locale={locale}
      label={t("experiment.contributors")}
      value={number.format(scoped.contributors30d)}
      note={
        devices === null
          ? t("experiment.window", { days: windowDays })
          : t("experiment.devicesCount", { count: devices })
      }
      context={window}
    />
  );

  const renderDevices = (count: number) => (
    <MetricStatCard
      locale={locale}
      label={t("experiment.devices")}
      value={number.format(count)}
      note={t("experiment.devicesNote")}
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
      <div className={metricsBandGridOfThree}>
        <MetricStatCard
          locale={locale}
          label={t("experiment.measurements")}
          value={compact.format(scoped.measurements30d)}
          title={number.format(scoped.measurements30d)}
          comparison={{
            current: scoped.measurements30d,
            previous: scoped.previousMeasurements,
          }}
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
        {hasContributors ? renderContributors() : null}
        {!hasContributors && devices !== null && devices > 0 ? renderDevices(devices) : null}
        <MetricTrendCard
          label={t("dailyAverage")}
          value={compact.format(Math.round(scoped.measurements30d / windowDays))}
          title={number.format(Math.round(scoped.measurements30d / windowDays))}
          seriesName={t("experiment.trend")}
          days={scoped.activity}
          peakDate={peak?.date ?? null}
          locale={locale}
          footer={t("activeDays", { active: scoped.activeDays, total: windowDays })}
          className={
            hasContributors || hasDevices ? metricsBandTrendSpanOfThree : metricsBandTrendSpanWide
          }
        />
      </div>
    </section>
  );
}
