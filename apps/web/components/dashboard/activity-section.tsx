"use client";

import { MetricStatCard } from "@/components/metrics/metric-stat-card";
import { TrendSparkline } from "@/components/metrics/trend-sparkline";
import { useMyScopedMetrics } from "@/hooks/metrics/useMyScopedMetrics/useMyScopedMetrics";
import { usePublicMetrics } from "@/hooks/metrics/usePublicMetrics/usePublicMetrics";
import { formatLocaleNumber } from "@/util/format-locale-number";

import { useTranslation } from "@repo/i18n";
import { Skeleton } from "@repo/ui/components/skeleton";

import { DashboardSection } from "./dashboard-section";

interface ActivitySectionProps {
  locale: string;
}

/** The reader's own 30 days, with the community beside it rather than as the headline. */
export function ActivitySection({ locale }: ActivitySectionProps) {
  const { t } = useTranslation("publicMetrics");
  const { data: mine, isPending } = useMyScopedMetrics();
  const { data: platform } = usePublicMetrics();

  if (isPending) {
    return <Skeleton aria-busy="true" className="h-56" />;
  }

  const scoped = mine?.scoped ?? null;

  // Nothing rather than a row of zeros, as on the list pages.
  if (scoped === null || scoped.measurements30d === 0) {
    return null;
  }

  const compact = new Intl.NumberFormat(locale, { notation: "compact", maximumFractionDigits: 1 });
  // Warehouse days are UTC.
  const day = new Intl.DateTimeFormat(locale, { day: "numeric", month: "short", timeZone: "UTC" });

  const windowDays = scoped.activity.length;
  const window = t("window", { days: windowDays });
  const community = platform?.community ?? null;
  const peak = scoped.peak;

  return (
    <DashboardSection id="last-30-days" title={t("dashboard.activity.title")}>
      <MetricStatCard
        locale={locale}
        label={t("dashboard.activity.label")}
        value={compact.format(scoped.measurements30d)}
        title={formatLocaleNumber(scoped.measurements30d, locale)}
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
        chart={
          <TrendSparkline
            days={scoped.activity}
            mark="bars"
            peakDate={peak?.date ?? null}
            seriesName={t("dashboard.activity.trend")}
            locale={locale}
            className="h-10 w-full"
          />
        }
      />

      <ul className="text-muted-foreground flex flex-wrap gap-x-4 gap-y-1 text-sm">
        <li>{t("dashboard.activity.activeExperiments", { count: scoped.activeExperiments30d })}</li>
        <li>{t("dashboard.activity.contributors", { count: scoped.contributors30d })}</li>
        {scoped.devices30d === null ? null : (
          <li>{t("dashboard.activity.devices", { count: scoped.devices30d })}</li>
        )}
        {community === null ? null : (
          <li title={formatLocaleNumber(community.measurements30d, locale)}>
            {t("dashboard.activity.communityLabel")}{" "}
            <span className="text-foreground font-medium tabular-nums">
              {compact.format(community.measurements30d)}
            </span>
          </li>
        )}
      </ul>
    </DashboardSection>
  );
}
